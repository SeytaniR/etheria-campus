/**
 * @file apps/server/src/index.ts
 * @module @etheria/server
 * @description Servidor HTTP & API Autoritária do Etheria Campus.
 *   Serve a Rota `/admin` (Studio Low-Code), valida a proteção dual-mode (`.env` restrito ao localhost
 *   vs CRUD de usuários do banco para acessos externos) e gerencia a persistência no PostgreSQL + Snapshots.
 * @rules Segue estritamente AGENTS.md (Cláusula 0 de Segurança e Arquitetura OO).
 * @dependencies node:http, node:fs/promises, node:path, @etheria/database
 */

import * as http from 'node:http';
import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@etheria/database';
import { AdminAuthService } from './security/AdminAuthService.js';
import { AdminUsersController } from './controllers/AdminUsersController.js';
import { AdminMapsController } from './controllers/AdminMapsController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Carrega variáveis do arquivo `.env` na raiz do monorepo sem dependências externas.
 */
function loadDotEnv(): void {
  const envPath = path.resolve(__dirname, '../../../.env');
  if (!fsSync.existsSync(envPath)) return;
  const content = fsSync.readFileSync(envPath, 'utf-8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    let val = line.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

loadDotEnv();

export class EtheriaServerApp {
  private readonly prisma: PrismaClient;
  private readonly authService: AdminAuthService;
  private readonly usersController: AdminUsersController;
  private readonly mapsController: AdminMapsController;
  private readonly publicDir: string;

  constructor() {
    this.prisma = new PrismaClient();
    this.authService = new AdminAuthService(this.prisma);
    this.usersController = new AdminUsersController(this.prisma);
    this.mapsController = new AdminMapsController(this.prisma);
    this.publicDir = path.resolve(__dirname, '../public');
  }

  /**
   * Lê e decodifica o corpo JSON de uma requisição HTTP com limite de segurança (10 MB para malhas de mapas).
   */
  private async readJsonBody<T = any>(req: http.IncomingMessage): Promise<T> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let totalSize = 0;
      req.on('data', (chunk: Buffer) => {
        totalSize += chunk.length;
        if (totalSize > 10 * 1024 * 1024) {
          reject(new Error('Payload excede o limite de 10 MB.'));
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => {
        try {
          const raw = Buffer.concat(chunks).toString('utf-8');
          resolve(raw ? JSON.parse(raw) : ({} as T));
        } catch (err) {
          reject(new Error('JSON inválido no corpo da requisição.'));
        }
      });
      req.on('error', reject);
    });
  }

  /**
   * Envia uma resposta JSON padronizada.
   */
  private sendJson(res: http.ServerResponse, statusCode: number, data: unknown): void {
    const payload = JSON.stringify(data);
    res.writeHead(statusCode, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(payload);
  }

  /**
   * Processa todas as requisições HTTP destinadas à API e aos arquivos estáticos da Rota `/admin`.
   */
  public async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      const urlObj = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      const pathname = urlObj.pathname;
      const method = req.method ?? 'GET';

      // 1. Status de Conexão e Diagnóstico de Localhost para a tela de login do /admin
      if (pathname === '/api/admin/auth/context' && method === 'GET') {
        const isStrictLocalhost = this.authService.isStrictLocalhost(req);
        const tokenPayload = this.authService.verifyRequestToken(req);
        this.sendJson(res, 200, {
          isStrictLocalhost,
          envLoginAllowed: isStrictLocalhost,
          authenticated: Boolean(tokenPayload),
          session: tokenPayload,
        });
        return;
      }

      // 2. Endpoint de Login da Rota /admin
      if (pathname === '/api/admin/auth/login' && method === 'POST') {
        const body = await this.readJsonBody<{ username?: string; password?: string }>(req);
        const result = await this.authService.authenticate(
          req,
          body.username ?? '',
          body.password ?? ''
        );
        if (!result.success) {
          this.sendJson(res, 401, { error: result.error });
          return;
        }
        this.sendJson(res, 200, {
          token: result.token,
          session: result.payload,
        });
        return;
      }

      // 3. Proteção Obrigatória (Guard) para todas as demais rotas `/api/admin/*`
      if (pathname.startsWith('/api/admin/')) {
        const session = this.authService.verifyRequestToken(req);
        if (!session) {
          this.sendJson(res, 401, {
            error: 'Não autorizado. Faça login na rota /admin.',
          });
          return;
        }

        // --- Rotas do CRUD de Contas de Usuários ---
        if (pathname === '/api/admin/users' && method === 'GET') {
          this.sendJson(res, 200, await this.usersController.listUsers());
          return;
        }
        if (pathname === '/api/admin/users' && method === 'POST') {
          const dto = await this.readJsonBody(req);
          this.sendJson(res, 201, await this.usersController.createUser(dto));
          return;
        }
        const userMatch = pathname.match(/^\/api\/admin\/users\/(\d+)$/);
        if (userMatch && method === 'PUT') {
          const id = Number(userMatch[1]);
          const dto = await this.readJsonBody(req);
          this.sendJson(res, 200, await this.usersController.updateUser(id, dto));
          return;
        }
        if (userMatch && method === 'DELETE') {
          const id = Number(userMatch[1]);
          this.sendJson(res, 200, await this.usersController.deleteUser(id));
          return;
        }

        // --- Rotas do Editor Visual de Mapas & Galeria mcrework ---
        if (pathname === '/api/admin/mcrework/maps' && method === 'GET') {
          this.sendJson(res, 200, await this.mapsController.getMcreworkCleanMapGallery());
          return;
        }
        if (pathname === '/api/admin/mcrework/npcs' && method === 'GET') {
          this.sendJson(res, 200, await this.mapsController.getMcreworkNpcGallery());
          return;
        }
        if (pathname === '/api/admin/maps/bootstrap' && method === 'GET') {
          this.sendJson(res, 200, await this.mapsController.getEditorBootstrap());
          return;
        }
        if (pathname === '/api/admin/npc-templates' && method === 'POST') {
          const dto = await this.readJsonBody(req);
          this.sendJson(res, 201, await this.mapsController.saveNpcTemplate(dto));
          return;
        }
        if (pathname === '/api/admin/maps' && method === 'POST') {
          const dto = await this.readJsonBody(req);
          this.sendJson(res, 201, await this.mapsController.saveMap(null, dto));
          return;
        }
        const mapMatch = pathname.match(/^\/api\/admin\/maps\/(\d+)$/);
        if (mapMatch && method === 'PUT') {
          const id = Number(mapMatch[1]);
          const dto = await this.readJsonBody(req);
          this.sendJson(res, 200, await this.mapsController.saveMap(id, dto));
          return;
        }
        if (mapMatch && method === 'DELETE') {
          const id = Number(mapMatch[1]);
          this.sendJson(res, 200, await this.mapsController.deleteMap(id));
          return;
        }

        this.sendJson(res, 404, { error: 'Rota da API Admin não encontrada.' });
        return;
      }

      // 4. Redirecionamento da raiz ou `/admin` para a interface do Studio Low-Code
      if (pathname === '/' || pathname === '/admin' || pathname === '/admin/') {
        const htmlPath = path.join(this.publicDir, 'admin', 'index.html');
        const html = await fs.readFile(htmlPath, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
        return;
      }

      if (pathname === '/admin/admin.js') {
        const jsPath = path.join(this.publicDir, 'admin', 'admin.js');
        const js = await fs.readFile(jsPath, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
        res.end(js);
        return;
      }

      this.sendJson(res, 404, { error: 'Página não encontrada.' });
    } catch (err: any) {
      console.error('❌ [EtheriaServerApp Error]:', err);
      this.sendJson(res, 400, { error: err?.message ?? 'Erro interno no servidor.' });
    }
  }

  /**
   * Inicia o servidor HTTP na porta configurada.
   */
  public start(port: number): http.Server {
    const server = http.createServer((req, res) => {
      void this.handleRequest(req, res);
    });
    server.listen(port, '0.0.0.0', () => {
      console.log(`🚀 [Etheria Campus Server] Rodando em http://localhost:${port}/admin`);
    });
    return server;
  }
}

const port = Number(process.env.PORT ?? 4000);
const app = new EtheriaServerApp();
app.start(port);
