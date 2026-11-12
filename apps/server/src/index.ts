/**
 * @file apps/server/src/index.ts
 * @module @etheria/server
 * @description Servidor HTTP & API Autoritária do Etheria Campus.
 *   Serve a Rota `/admin` (Studio Low-Code), Rota `/play` (MMORPG 2.5D Client),
 *   delega o roteamento para submódulos especializados (AdminRouter, PlayRouter)
 *   e gerencia a persistência no PostgreSQL + Snapshots.
 * @rules Segue estritamente AGENTS.md (Cláusula 0 de Segurança, Regra #7 de 1.000 linhas).
 * @dependencies node:http, node:fs/promises, node:path, @etheria/database
 */

import * as http from 'node:http';
import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import * as path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PrismaClient, SnapshotManager } from '@etheria/database';
import { AdminAuthService } from './security/AdminAuthService.js';
import { AdminUsersController } from './controllers/AdminUsersController.js';
import { AdminMapsController } from './controllers/AdminMapsController.js';
import { GamePlayController } from './controllers/GamePlayController.js';
import { AdminMonstersController } from './controllers/AdminMonstersController.js';
import { AdminPetsController } from './controllers/AdminPetsController.js';
import { AdminEquipmentsController } from './controllers/AdminEquipmentsController.js';
import { AdminItemsController } from './controllers/AdminItemsController.js';
import { AdminFlyingMountsController } from './controllers/AdminFlyingMountsController.js';
import { AdminSkillsController } from './controllers/AdminSkillsController.js';
import { AdminQuestsController } from './controllers/AdminQuestsController.js';
import { AdminAttributesController } from './controllers/AdminAttributesController.js';
import { AdminExperienceController } from './controllers/AdminExperienceController.js';
import { AdminWorldMapsController } from './controllers/AdminWorldMapsController.js';
import { TemporaryCombatController } from './controllers/TemporaryCombatController.js';
import { AdminRouter } from './routes/AdminRouter.js';
import { PlayRouter } from './routes/PlayRouter.js';

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
  private readonly playController: GamePlayController;
  private readonly monstersController: AdminMonstersController;
  private readonly petsController: AdminPetsController;
  private readonly equipmentsController: AdminEquipmentsController;
  private readonly itemsController: AdminItemsController;
  private readonly mountsController: AdminFlyingMountsController;
  private readonly skillsController: AdminSkillsController;
  private readonly questsController: AdminQuestsController;
  private readonly attributesController: AdminAttributesController;
  private readonly experienceController: AdminExperienceController;
  private readonly worldMapsController: AdminWorldMapsController;
  private readonly combatController: TemporaryCombatController;
  private readonly adminRouter: AdminRouter;
  private readonly playRouter: PlayRouter;
  private readonly publicDir: string;
  private readonly mapImageCache = new Map<number, { buffer: Buffer; contentType: string }>();
  private static readonly MAX_CACHED_MAP_IMAGES = 12;

  constructor() {
    this.prisma = new PrismaClient();
    const snapshotManager = new SnapshotManager(this.prisma);
    this.authService = new AdminAuthService(this.prisma);
    this.usersController = new AdminUsersController(this.prisma);
    this.mapsController = new AdminMapsController(this.prisma);
    this.playController = new GamePlayController(this.prisma);
    this.monstersController = new AdminMonstersController(this.prisma);
    this.petsController = new AdminPetsController(this.prisma);
    this.equipmentsController = new AdminEquipmentsController(this.prisma);
    this.itemsController = new AdminItemsController(this.prisma);
    this.mountsController = new AdminFlyingMountsController(this.prisma);
    this.skillsController = new AdminSkillsController(this.prisma);
    this.questsController = new AdminQuestsController(this.prisma, snapshotManager);
    this.attributesController = new AdminAttributesController(this.prisma);
    this.experienceController = new AdminExperienceController(this.prisma);
    this.worldMapsController = new AdminWorldMapsController(this.prisma, snapshotManager);
    this.combatController = new TemporaryCombatController(this.prisma);
    this.publicDir = path.resolve(__dirname, '../public');

    const sendJson = this.sendJson.bind(this);
    const readJsonBody = this.readJsonBody.bind(this);

    this.adminRouter = new AdminRouter({
      prisma: this.prisma,
      authService: this.authService,
      usersController: this.usersController,
      mapsController: this.mapsController,
      monstersController: this.monstersController,
      petsController: this.petsController,
      equipmentsController: this.equipmentsController,
      itemsController: this.itemsController,
      mountsController: this.mountsController,
      skillsController: this.skillsController,
      questsController: this.questsController,
      attributesController: this.attributesController,
      experienceController: this.experienceController,
      worldMapsController: this.worldMapsController,
      sendJson,
      readJsonBody,
    });

    this.playRouter = new PlayRouter({
      prisma: this.prisma,
      authService: this.authService,
      playController: this.playController,
      combatController: this.combatController,
      questsController: this.questsController,
      sendJson,
      readJsonBody,
    });
  }

  /**
   * Lê e decodifica o corpo JSON de uma requisição HTTP com limite de segurança (10 MB para malhas de mapas).
   */
  public async readJsonBody<T = any>(req: http.IncomingMessage): Promise<T> {
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
        } catch {
          reject(new Error('JSON inválido no corpo da requisição.'));
        }
      });
      req.on('error', reject);
    });
  }

  /**
   * Envia uma resposta JSON padronizada com serialização resiliente de BigInt para string.
   */
  public sendJson(res: http.ServerResponse, statusCode: number, data: unknown): void {
    const payload = JSON.stringify(data, (_, value) =>
      typeof value === 'bigint' ? value.toString() : value
    );
    res.writeHead(statusCode, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(payload);
  }

  /**
   * Tabela de Tipos MIME suportados para servir arquivos estáticos de `public/`.
   */
  private static readonly MIME_TYPES: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
    '.pdf': 'application/pdf',
  };

  /**
   * Serve arquivos estáticos de `apps/server/public` de forma segura e modular.
   * Suporta rotas raiz, subpastas (/admin/js/*, /play/js/*) e sanitização contra traversal.
   */
  private async tryServeStatic(pathname: string, res: http.ServerResponse): Promise<boolean> {
    if (pathname === '/shared/CombatDamageCalculator.js') {
      try {
        const sharedCalcPath = path.resolve(__dirname, '../../../packages/shared/dist/CombatDamageCalculator.js');
        const data = await fs.readFile(sharedCalcPath);
        res.writeHead(200, {
          'Content-Type': 'application/javascript; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
        });
        res.end(data);
        return true;
      } catch {
        return false;
      }
    }

    let relPath = pathname;
    if (relPath === '/' || relPath === '/admin' || relPath === '/admin/') {
      relPath = '/admin/index.html';
    } else if (relPath === '/play' || relPath === '/play/' || relPath === '/gm' || relPath === '/gm/') {
      relPath = '/play/index.html';
    }

    const safeRel = path.normalize(relPath).replace(/^(\.\.[\/\\])+/, '').replace(/^[\\\/]+/, '');
    const fullPath = path.join(this.publicDir, safeRel);

    if (!fullPath.startsWith(this.publicDir)) {
      return false;
    }

    try {
      const stats = await fs.stat(fullPath);
      if (!stats.isFile()) return false;
      const ext = path.extname(fullPath).toLowerCase();
      const contentType = EtheriaServerApp.MIME_TYPES[ext] || 'application/octet-stream';
      const fileData = await fs.readFile(fullPath);
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      });
      res.end(fileData);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Proxy reverso resiliente e de alta performance para imagens de mapas.
   * Evita bloqueios de CORS e requisições cross-domain, servindo via same-origin com cache em memória RAM.
   * Implementa expulsão FIFO para respeitar o limite máximo de imagens simultâneas em memória.
   */
  private async handleMapImageAsset(mapId: number, res: http.ServerResponse): Promise<void> {
    try {
      const cached = this.mapImageCache.get(mapId);
      if (cached) {
        res.writeHead(200, {
          'Content-Type': cached.contentType,
          'Content-Length': cached.buffer.length,
          'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(cached.buffer);
        return;
      }

      const map = await this.prisma.gameMap.findUnique({
        where: { id: mapId },
        select: { mcreworkMapImage: true },
      });

      if (!map || !map.mcreworkMapImage) {
        this.sendJson(res, 404, { error: `Imagem do mapa #${mapId} não encontrada.` });
        return;
      }

      let targetUrl = map.mcreworkMapImage.trim();
      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = `https://seytanir.github.io/mcrework/${targetUrl.replace(/^\/+/, '')}`;
      }

      const upstream = await globalThis.fetch(targetUrl);
      if (!upstream.ok) {
        this.sendJson(res, upstream.status, { error: `Erro upstream ao baixar imagem do mapa: HTTP ${upstream.status}` });
        return;
      }

      const contentType = upstream.headers.get('content-type') || 'image/jpeg';
      const arrayBuf = await upstream.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);

      // Limita o tamanho do cache em memória com eviction FIFO
      if (this.mapImageCache.size >= EtheriaServerApp.MAX_CACHED_MAP_IMAGES && !this.mapImageCache.has(mapId)) {
        const oldestKey = this.mapImageCache.keys().next().value;
        if (oldestKey !== undefined) {
          this.mapImageCache.delete(oldestKey);
        }
      }

      this.mapImageCache.set(mapId, { buffer, contentType });

      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': buffer.length,
        'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(buffer);
    } catch (err: any) {
      this.sendJson(res, 500, { error: `Falha interna no proxy da imagem do mapa: ${err?.message || err}` });
    }
  }

  /**
   * Pré-carrega de forma assíncrona as imagens de fundo dos primeiros 5 mapas na memória RAM,
   * garantindo respostas com latência zero (0ms) no boot sem sobrecarregar a memória em ARM64.
   */
  public async prewarmMapImages(): Promise<void> {
    try {
      const maps = await this.prisma.gameMap.findMany({
        where: { mcreworkMapImage: { not: '' } },
        select: { id: true, mcreworkMapImage: true },
        take: 5,
        orderBy: { id: 'asc' },
      });
      for (const map of maps) {
        if (!map.mcreworkMapImage) continue;
        let targetUrl = map.mcreworkMapImage.trim();
        if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
          targetUrl = `https://seytanir.github.io/mcrework/${targetUrl.replace(/^\/+/, '')}`;
        }
        try {
          const upstream = await globalThis.fetch(targetUrl);
          if (upstream.ok) {
            const contentType = upstream.headers.get('content-type') || 'image/jpeg';
            const arrayBuf = await upstream.arrayBuffer();
            this.mapImageCache.set(map.id, { buffer: Buffer.from(arrayBuf), contentType });
          }
        } catch {
          // Fallback silencioso; se falhar no boot, carrega sob demanda
        }
      }
      console.log(`🗺️ [AssetCache] ${this.mapImageCache.size} imagem(ns) de mapas pré-carregadas em memória RAM.`);
    } catch (err: any) {
      console.warn(`[AssetCache] Falha ao pré-aquecer cache de mapas: ${err?.message || err}`);
    }
  }

  /**
   * Processa todas as requisições HTTP destinadas à API e aos arquivos estáticos.
   */
  public async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      const urlObj = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      const pathname = urlObj.pathname;
      const method = req.method ?? 'GET';

      // 0. Asset Proxy Público (Imagens de Fundo dos Mapas em Cache RAM com Limite de Memória)
      const mapAssetMatch = pathname.match(/^\/api\/assets\/map-image\/(\d+)$/);
      if (mapAssetMatch && (method === 'GET' || method === 'HEAD')) {
        const mapId = Number(mapAssetMatch[1]);
        await this.handleMapImageAsset(mapId, res);
        return;
      }

      // 1. Delegar para o AdminRouter (/api/admin/*)
      if (await this.adminRouter.handle(req, res, pathname, method, urlObj)) {
        return;
      }

      // 2. Delegar para o PlayRouter (/api/play/*)
      if (await this.playRouter.handle(req, res, pathname, method, urlObj)) {
        return;
      }

      // 3. Servir Arquivos Estáticos de `apps/server/public` (/admin, /play, /gm, subpastas /js, etc.)
      const served = await this.tryServeStatic(pathname, res);
      if (served) return;

      this.sendJson(res, 404, { error: 'Página não encontrada.' });
    } catch (err: any) {
      console.error('❌ [EtheriaServerApp Error]:', err);
      const isForbidden = typeof err?.message === 'string' && err.message.toLowerCase().includes('acesso negado');
      this.sendJson(res, isForbidden ? 403 : 400, { error: err?.message ?? 'Erro interno no servidor.' });
    }
  }

  /**
   * Inicia o servidor HTTP na porta configurada.
   */
  public start(port: number): http.Server {
    if (process.platform === 'win32') {
      // Mantém a VM do Ubuntu WSL2 acordada enquanto o servidor estiver rodando para o PostgreSQL nunca hibernar
      const wslKeepAlive = spawn('wsl.exe', ['-e', 'sleep', 'infinity'], {
        stdio: 'ignore',
        detached: false,
      });
      wslKeepAlive.on('error', () => {});
    }

    const server = http.createServer((req, res) => {
      void this.handleRequest(req, res);
    });
    server.listen(port, '0.0.0.0', () => {
      console.log(`🚀 [Etheria Campus Server] Rodando em http://localhost:${port}/admin`);
      void this.prewarmMapImages();
      void this.monstersController.ensureInitialMonsters();
      void this.skillsController.ensureInitialSkillsAndBuffs();
      void this.questsController.ensureInitialQuests();
      void this.petsController.seedInitialPetsIfEmpty();
      void this.equipmentsController.seedInitialEquipmentsIfEmpty();
      void this.itemsController.seedInitialItemsIfEmpty();
      void this.mountsController.seedInitialFlyingMountsIfEmpty();
      void this.experienceController.seedInitialLevelExperienceIfEmpty();
      void this.worldMapsController.seedInitialWorldMapsIfEmpty();
    });
    return server;
  }
}

const port = Number(process.env.PORT ?? 4000);
const app = new EtheriaServerApp();
app.start(port);
