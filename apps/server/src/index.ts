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
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PrismaClient, SnapshotManager } from '@etheria/database';
import { AdminAuthService, type AdminTokenPayload } from './security/AdminAuthService.js';
import { AdminUsersController } from './controllers/AdminUsersController.js';
import { AdminMapsController } from './controllers/AdminMapsController.js';
import { GamePlayController } from './controllers/GamePlayController.js';
import { AdminMonstersController } from './controllers/AdminMonstersController.js';
import { AdminPetsController } from './controllers/AdminPetsController.js';
import { AdminEquipmentsController } from './controllers/AdminEquipmentsController.js';
import { AdminSkillsController } from './controllers/AdminSkillsController.js';
import { AdminQuestsController } from './controllers/AdminQuestsController.js';
import { AdminAttributesController } from './controllers/AdminAttributesController.js';
import { TemporaryCombatController } from './controllers/TemporaryCombatController.js';

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
  private readonly skillsController: AdminSkillsController;
  private readonly questsController: AdminQuestsController;
  private readonly attributesController: AdminAttributesController;
  private readonly combatController: TemporaryCombatController;
  private readonly publicDir: string;
  private readonly mapImageCache = new Map<number, { buffer: Buffer; contentType: string }>();

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
    this.skillsController = new AdminSkillsController(this.prisma);
    this.questsController = new AdminQuestsController(this.prisma, snapshotManager);
    this.attributesController = new AdminAttributesController(this.prisma);
    this.combatController = new TemporaryCombatController(this.prisma);
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
   * Valida se a sessão autenticada possui permissão suficiente para ler ou editar a tabela informada.
   * - DEV: passe livre irrestrito para todas as tabelas.
   * - ADMIN: valida permissões granulares configuradas pelo DEV.
   */
  private enforceTablePermission(
    res: http.ServerResponse,
    session: AdminTokenPayload,
    tableKey: string,
    mode: 'READ' | 'READ_WRITE'
  ): boolean {
    if (this.authService.canAccessTable(session, tableKey, mode)) {
      return true;
    }
    this.sendJson(res, 403, {
      error: `Acesso negado: Você possui permissão insuficiente para ${
        mode === 'READ_WRITE' ? 'editar' : 'visualizar'
      } a tabela "${tableKey}". Solicite liberação ao Desenvolvedor (DEV).`,
    });
    return false;
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
  };

  /**
   * Serve arquivos estáticos de `apps/server/public` de forma segura e modular.
   * Suporta rotas raiz, subpastas (/admin/js/*, /play/js/*) e sanitização contra traversal.
   */
  private async tryServeStatic(pathname: string, res: http.ServerResponse): Promise<boolean> {
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
   * Evita bloqueios de CORS, inspeção rígida de celular e requisições cross-domain,
   * servindo a imagem diretamente através do túnel Cloudflare via same-origin com cache em memória RAM.
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
   * Pré-carrega de forma assíncrona todas as imagens de fundo dos mapas ativos na memória RAM,
   * garantindo respostas com latência zero (0ms) para jogadores em redes móveis ou pelo Cloudflare Tunnel.
   */
  public async prewarmMapImages(): Promise<void> {
    try {
      const maps = await this.prisma.gameMap.findMany({
        select: { id: true, mcreworkMapImage: true },
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
   * Processa todas as requisições HTTP destinadas à API e aos arquivos estáticos da Rota `/admin`.
   */
  public async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      const urlObj = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      const pathname = urlObj.pathname;
      const method = req.method ?? 'GET';

      // 0. Asset Proxy Público (Imagens de Fundo dos Mapas em Cache RAM de Alta Performance)
      const mapAssetMatch = pathname.match(/^\/api\/assets\/map-image\/(\d+)$/);
      if (mapAssetMatch && (method === 'GET' || method === 'HEAD')) {
        const mapId = Number(mapAssetMatch[1]);
        await this.handleMapImageAsset(mapId, res);
        return;
      }

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

        // --- Rotas do CRUD de Contas de Usuários e Permissões ---
        if (pathname === '/api/admin/users' && method === 'GET') {
          this.sendJson(res, 200, await this.usersController.listUsers(session));
          return;
        }
        if (pathname === '/api/admin/users' && method === 'POST') {
          const dto = await this.readJsonBody(req);
          this.sendJson(res, 201, await this.usersController.createUser(dto, session));
          return;
        }
        const userPermsMatch = pathname.match(/^\/api\/admin\/users\/(\d+)\/permissions$/);
        if (userPermsMatch && method === 'PUT') {
          const id = Number(userPermsMatch[1]);
          const body = await this.readJsonBody<{ permissions?: Record<string, any>; tablePermissions?: Record<string, any> }>(req);
          const perms = body.permissions ?? body.tablePermissions ?? {};
          this.sendJson(res, 200, await this.usersController.updateTablePermissions(id, perms, session));
          return;
        }
        const userMatch = pathname.match(/^\/api\/admin\/users\/(\d+)$/);
        if (userMatch && method === 'PUT') {
          const id = Number(userMatch[1]);
          const dto = await this.readJsonBody(req);
          this.sendJson(res, 200, await this.usersController.updateUser(id, dto, session));
          return;
        }
        if (userMatch && method === 'DELETE') {
          const id = Number(userMatch[1]);
          this.sendJson(res, 200, await this.usersController.deleteUser(id, session));
          return;
        }

        // --- Rotas do Editor Visual de Mapas, NPCs, Classes & Galeria mcrework ---
        if (pathname === '/api/admin/mcrework/maps' && method === 'GET') {
          if (!this.enforceTablePermission(res, session, 'MAPS', 'READ')) return;
          this.sendJson(res, 200, await this.mapsController.getMcreworkCleanMapGallery());
          return;
        }
        if (pathname === '/api/admin/mcrework/npcs' && method === 'GET') {
          if (!this.enforceTablePermission(res, session, 'NPCS', 'READ')) return;
          this.sendJson(res, 200, await this.mapsController.getMcreworkNpcGallery());
          return;
        }
        if (pathname === '/api/admin/mcrework/characters' && method === 'GET') {
          if (!this.enforceTablePermission(res, session, 'CLASSES', 'READ')) return;
          this.sendJson(res, 200, await this.mapsController.getMcreworkCharacterGallery());
          return;
        }
        if (pathname === '/api/admin/maps/bootstrap' && method === 'GET') {
          // Permite carregar bootstrap se tiver acesso a MAPS, NPCS ou CLASSES
          if (
            !this.authService.canAccessTable(session, 'MAPS', 'READ') &&
            !this.authService.canAccessTable(session, 'NPCS', 'READ') &&
            !this.authService.canAccessTable(session, 'CLASSES', 'READ')
          ) {
            this.sendJson(res, 403, { error: 'Acesso negado às tabelas de Mapas, NPCs e Classes.' });
            return;
          }
          this.sendJson(res, 200, await this.mapsController.getEditorBootstrap());
          return;
        }
        if (pathname === '/api/admin/class-templates' && method === 'POST') {
          if (!this.enforceTablePermission(res, session, 'CLASSES', 'READ_WRITE')) return;
          const dto = await this.readJsonBody(req);
          this.sendJson(res, 201, await this.mapsController.saveClassTemplate(dto, null));
          return;
        }
        const classMatch = pathname.match(/^\/api\/admin\/class-templates\/(\d+)$/);
        if (classMatch && method === 'PUT') {
          if (!this.enforceTablePermission(res, session, 'CLASSES', 'READ_WRITE')) return;
          const id = Number(classMatch[1]);
          const dto = await this.readJsonBody(req);
          this.sendJson(res, 200, await this.mapsController.saveClassTemplate(dto, id));
          return;
        }
        if (classMatch && method === 'DELETE') {
          if (!this.enforceTablePermission(res, session, 'CLASSES', 'READ_WRITE')) return;
          const id = Number(classMatch[1]);
          this.sendJson(res, 200, await this.mapsController.deleteClassTemplate(id));
          return;
        }
        if (pathname === '/api/admin/npc-templates' && method === 'POST') {
          if (!this.enforceTablePermission(res, session, 'NPCS', 'READ_WRITE')) return;
          const dto = await this.readJsonBody(req);
          this.sendJson(res, 201, await this.mapsController.saveNpcTemplate(dto, null));
          return;
        }
        const npcMatch = pathname.match(/^\/api\/admin\/npc-templates\/(\d+)$/);
        if (npcMatch && method === 'PUT') {
          if (this.enforceTablePermission(res, session, 'NPCS', 'READ_WRITE')) this.sendJson(res, 200, await this.mapsController.saveNpcTemplate(await this.readJsonBody(req), Number(npcMatch[1])));
          return;
        }
        if (npcMatch && method === 'DELETE') {
          if (this.enforceTablePermission(res, session, 'NPCS', 'READ_WRITE')) this.sendJson(res, 200, await this.mapsController.deleteNpcTemplate(Number(npcMatch[1])));
          return;
        }
        if (pathname === '/api/admin/maps' && method === 'POST') {
          if (this.enforceTablePermission(res, session, 'MAPS', 'READ_WRITE')) this.sendJson(res, 201, await this.mapsController.saveMap(null, await this.readJsonBody(req)));
          return;
        }
        const mapMatch = pathname.match(/^\/api\/admin\/maps\/(\d+)$/);
        if (mapMatch && method === 'PUT') {
          if (this.enforceTablePermission(res, session, 'MAPS', 'READ_WRITE')) this.sendJson(res, 200, await this.mapsController.saveMap(Number(mapMatch[1]), await this.readJsonBody(req)));
          return;
        }
        if (mapMatch && method === 'DELETE') {
          if (this.enforceTablePermission(res, session, 'MAPS', 'READ_WRITE')) this.sendJson(res, 200, await this.mapsController.deleteMap(Number(mapMatch[1])));
          return;
        }
        const mapNpcRotateMatch = pathname.match(/^\/api\/admin\/map-npcs\/(\d+)\/rotate$/);
        if (mapNpcRotateMatch && method === 'POST') {
          if (!this.enforceTablePermission(res, session, 'NPCS', 'READ_WRITE') && !this.enforceTablePermission(res, session, 'MAPS', 'READ_WRITE')) return;
          const placementId = Number(mapNpcRotateMatch[1]);
          this.sendJson(res, 200, await this.mapsController.rotateMapNpcPlacement(placementId));
          return;
        }
        const mapTeleportNpcMatch = pathname.match(/^\/api\/admin\/maps\/(\d+)\/teleport-npcs$/);
        if (mapTeleportNpcMatch && method === 'POST') {
          if (!this.enforceTablePermission(res, session, 'MAPS', 'READ_WRITE') && !this.enforceTablePermission(res, session, 'NPCS', 'READ_WRITE')) return;
          const mapId = Number(mapTeleportNpcMatch[1]);
          const dto = await this.readJsonBody(req);
          this.sendJson(res, 201, await this.mapsController.saveMapTeleportNpc(mapId, dto));
          return;
        }
        const mapNpcTeleportMatch = pathname.match(/^\/api\/admin\/map-npcs\/(\d+)\/teleport$/);
        if (mapNpcTeleportMatch && method === 'PUT') {
          if (!this.enforceTablePermission(res, session, 'MAPS', 'READ_WRITE') && !this.enforceTablePermission(res, session, 'NPCS', 'READ_WRITE')) return;
          const placementId = Number(mapNpcTeleportMatch[1]);
          const dto = await this.readJsonBody(req);
          dto.id = placementId;
          const existingNpc = await this.prisma.mapNpc.findUnique({ where: { id: placementId } });
          if (!existingNpc) {
            this.sendJson(res, 404, { error: `Posicionamento de NPC #${placementId} não encontrado.` });
            return;
          }
          this.sendJson(res, 200, await this.mapsController.saveMapTeleportNpc(existingNpc.mapId, dto));
          return;
        }
        const mapNpcDeleteMatch = pathname.match(/^\/api\/admin\/map-npcs\/(\d+)$/);
        if (mapNpcDeleteMatch && method === 'DELETE') {
          if (!this.enforceTablePermission(res, session, 'MAPS', 'READ_WRITE') && !this.enforceTablePermission(res, session, 'NPCS', 'READ_WRITE')) return;
          const placementId = Number(mapNpcDeleteMatch[1]);
          this.sendJson(res, 200, await this.mapsController.deleteMapNpc(placementId));
          return;
        }

        // Templates de Monstros / Mobs (mcrework & PostgreSQL)
        if (pathname === '/api/admin/mcrework/monsters' && method === 'GET') {
          if (this.enforceTablePermission(res, session, 'MONSTERS', 'READ')) this.sendJson(res, 200, await this.monstersController.getMcreworkMonsterGallery());
          return;
        }
        if (pathname === '/api/admin/monster-templates' && method === 'GET') {
          if (this.enforceTablePermission(res, session, 'MONSTERS', 'READ')) this.sendJson(res, 200, await this.monstersController.getMonsterTemplates());
          return;
        }
        if (pathname === '/api/admin/monster-templates' && method === 'POST') {
          if (this.enforceTablePermission(res, session, 'MONSTERS', 'READ_WRITE')) this.sendJson(res, 201, await this.monstersController.createMonsterTemplate(await this.readJsonBody(req)));
          return;
        }
        const monsterMatch = pathname.match(/^\/api\/admin\/monster-templates\/(\d+)$/);
        if (monsterMatch && method === 'PUT') {
          if (this.enforceTablePermission(res, session, 'MONSTERS', 'READ_WRITE')) this.sendJson(res, 200, await this.monstersController.updateMonsterTemplate(Number(monsterMatch[1]), await this.readJsonBody(req)));
          return;
        }
        if (monsterMatch && method === 'DELETE') {
          if (this.enforceTablePermission(res, session, 'MONSTERS', 'READ_WRITE')) this.sendJson(res, 200, await this.monstersController.deleteMonsterTemplate(Number(monsterMatch[1])));
          return;
        }

        // --- Templates de Pets Companheiros (mcrework & PostgreSQL) ---
        if (pathname === '/api/admin/mcrework/pets' && method === 'GET') {
          if (this.enforceTablePermission(res, session, 'MONSTERS', 'READ')) this.sendJson(res, 200, await this.petsController.getMcreworkPetsGallery());
          return;
        }
        if (pathname === '/api/admin/pet-templates' && method === 'GET') {
          if (this.enforceTablePermission(res, session, 'MONSTERS', 'READ')) this.sendJson(res, 200, await this.petsController.getPetTemplates());
          return;
        }
        if (pathname === '/api/admin/pet-templates' && method === 'POST') {
          if (this.enforceTablePermission(res, session, 'MONSTERS', 'READ_WRITE')) this.sendJson(res, 201, await this.petsController.createPetTemplate(await this.readJsonBody(req)));
          return;
        }
        const petMatch = pathname.match(/^\/api\/admin\/pet-templates\/(\d+)$/);
        if (petMatch && method === 'PUT') {
          if (this.enforceTablePermission(res, session, 'MONSTERS', 'READ_WRITE')) this.sendJson(res, 200, await this.petsController.updatePetTemplate(Number(petMatch[1]), await this.readJsonBody(req)));
          return;
        }
        if (petMatch && method === 'DELETE') {
          if (this.enforceTablePermission(res, session, 'MONSTERS', 'READ_WRITE')) this.sendJson(res, 200, await this.petsController.deletePetTemplate(Number(petMatch[1])));
          return;
        }

        // --- Equipamentos e Itens (mcrework & PostgreSQL) ---
        if (pathname === '/api/admin/equipment-slots' && method === 'GET') {
          if (this.enforceTablePermission(res, session, 'MONSTERS', 'READ')) this.sendJson(res, 200, await this.equipmentsController.getEquipmentSlots());
          return;
        }
        if (pathname === '/api/admin/mcrework/equipment' && method === 'GET') {
          if (this.enforceTablePermission(res, session, 'MONSTERS', 'READ')) this.sendJson(res, 200, await this.equipmentsController.getMcreworkEquipmentGallery());
          return;
        }
        if (pathname === '/api/admin/equipments' && method === 'GET') {
          const cat = urlObj.searchParams.get('category') || undefined;
          if (this.enforceTablePermission(res, session, 'MONSTERS', 'READ')) this.sendJson(res, 200, await this.equipmentsController.getEquipmentTemplates(cat));
          return;
        }
        if (pathname === '/api/admin/equipments' && method === 'POST') {
          if (this.enforceTablePermission(res, session, 'MONSTERS', 'READ_WRITE')) this.sendJson(res, 201, await this.equipmentsController.createEquipmentTemplate(await this.readJsonBody(req)));
          return;
        }
        const eqMatch = pathname.match(/^\/api\/admin\/equipments\/(\d+)$/);
        if (eqMatch && method === 'PUT') {
          if (this.enforceTablePermission(res, session, 'MONSTERS', 'READ_WRITE')) this.sendJson(res, 200, await this.equipmentsController.updateEquipmentTemplate(Number(eqMatch[1]), await this.readJsonBody(req)));
          return;
        }
        if (eqMatch && method === 'DELETE') {
          if (this.enforceTablePermission(res, session, 'MONSTERS', 'READ_WRITE')) this.sendJson(res, 200, await this.equipmentsController.deleteEquipmentTemplate(Number(eqMatch[1])));
          return;
        }

        // --- Rotas de Habilidades (Skills) & Buffs/Debuffs (Status Effects) ---
        if (pathname === '/api/admin/mcrework/skill-assets' && method === 'GET') {
          if (this.enforceTablePermission(res, session, 'SKILLS', 'READ')) this.sendJson(res, 200, await this.skillsController.getMcreworkSkillAssets());
          return;
        }
        if (pathname === '/api/admin/status-effects' && method === 'GET') {
          if (this.enforceTablePermission(res, session, 'STATUS_EFFECTS', 'READ')) this.sendJson(res, 200, await this.skillsController.getStatusEffectTemplates());
          return;
        }
        if (pathname === '/api/admin/status-effects' && method === 'POST') {
          if (this.enforceTablePermission(res, session, 'STATUS_EFFECTS', 'READ_WRITE')) this.sendJson(res, 201, await this.skillsController.createStatusEffectTemplate(await this.readJsonBody(req)));
          return;
        }
        const statusEffectMatch = pathname.match(/^\/api\/admin\/status-effects\/(\d+)$/);
        if (statusEffectMatch && method === 'PUT') {
          if (this.enforceTablePermission(res, session, 'STATUS_EFFECTS', 'READ_WRITE')) this.sendJson(res, 200, await this.skillsController.updateStatusEffectTemplate(Number(statusEffectMatch[1]), await this.readJsonBody(req)));
          return;
        }
        if (statusEffectMatch && method === 'DELETE') {
          if (this.enforceTablePermission(res, session, 'STATUS_EFFECTS', 'READ_WRITE')) this.sendJson(res, 200, await this.skillsController.deleteStatusEffectTemplate(Number(statusEffectMatch[1])));
          return;
        }

        if (pathname === '/api/admin/skill-templates' && method === 'GET') {
          if (this.enforceTablePermission(res, session, 'SKILLS', 'READ')) this.sendJson(res, 200, await this.skillsController.getSkillTemplates());
          return;
        }
        if (pathname === '/api/admin/skill-templates' && method === 'POST') {
          if (this.enforceTablePermission(res, session, 'SKILLS', 'READ_WRITE')) this.sendJson(res, 201, await this.skillsController.createSkillTemplate(await this.readJsonBody(req)));
          return;
        }
        const skillMatch = pathname.match(/^\/api\/admin\/skill-templates\/(\d+)$/);
        if (skillMatch && method === 'PUT') {
          if (this.enforceTablePermission(res, session, 'SKILLS', 'READ_WRITE')) this.sendJson(res, 200, await this.skillsController.updateSkillTemplate(Number(skillMatch[1]), await this.readJsonBody(req)));
          return;
        }
        if (skillMatch && method === 'DELETE') {
          if (this.enforceTablePermission(res, session, 'SKILLS', 'READ_WRITE')) this.sendJson(res, 200, await this.skillsController.deleteSkillTemplate(Number(skillMatch[1])));
          return;
        }
        const autoLinkMatch = pathname.match(/^\/api\/admin\/skill-templates\/(\d+)\/auto-link-monsters$/);
        if (autoLinkMatch && method === 'POST') {
          if (!this.enforceTablePermission(res, session, 'SKILLS', 'READ_WRITE')) return;
          const id = Number(autoLinkMatch[1]);
          const dto = await this.readJsonBody(req);
          this.sendJson(res, 200, await this.skillsController.autoLinkSkillToMonsters(id, dto?.elementCode));
          return;
        }

        // --- Rotas do Estúdio Visual No-Code de Quests (`quest_templates`) ---
        if (pathname === '/api/admin/quest-templates' && method === 'GET') {
          if (!this.enforceTablePermission(res, session, 'QUESTS', 'READ')) return;
          this.sendJson(res, 200, await this.questsController.getQuestTemplates());
          return;
        }
        if (pathname === '/api/admin/quest-templates' && method === 'POST') {
          if (!this.enforceTablePermission(res, session, 'QUESTS', 'READ_WRITE')) return;
          const dto = await this.readJsonBody(req);
          this.sendJson(res, 201, await this.questsController.saveQuestTemplate(dto, null));
          return;
        }
        const questMatch = pathname.match(/^\/api\/admin\/quest-templates\/(\d+)$/);
        if (questMatch && method === 'PUT') {
          if (!this.enforceTablePermission(res, session, 'QUESTS', 'READ_WRITE')) return;
          const id = Number(questMatch[1]);
          const dto = await this.readJsonBody(req);
          this.sendJson(res, 200, await this.questsController.saveQuestTemplate(dto, id));
          return;
        }
        if (questMatch && method === 'DELETE') {
          if (!this.enforceTablePermission(res, session, 'QUESTS', 'READ_WRITE')) return;
          const id = Number(questMatch[1]);
          this.sendJson(res, 200, await this.questsController.deleteQuestTemplate(id));
          return;
        }

        // --- Rotas de Atributos Base, Combate & Matriz de Conversão Procedural ---
        if (pathname === '/api/admin/attributes' && method === 'GET') {
          if (!this.enforceTablePermission(res, session, 'ATTRIBUTES', 'READ')) return;
          this.sendJson(res, 200, await this.attributesController.getAttributesData());
          return;
        }
        if (pathname === '/api/admin/attributes/conversions' && method === 'PUT') {
          if (!this.enforceTablePermission(res, session, 'ATTRIBUTES', 'READ_WRITE')) return;
          const items = await this.readJsonBody(req);
          this.sendJson(res, 200, await this.attributesController.batchUpdateConversions(items));
          return;
        }
        if (pathname === '/api/admin/attributes/conversions/single' && method === 'PUT') {
          if (!this.enforceTablePermission(res, session, 'ATTRIBUTES', 'READ_WRITE')) return;
          const dto = await this.readJsonBody(req);
          this.sendJson(res, 200, await this.attributesController.updateConversion(dto));
          return;
        }
        const combatAttrMatch = pathname.match(/^\/api\/admin\/attributes\/combat\/([a-zA-Z0-9_]+)$/);
        if (combatAttrMatch && method === 'PUT') {
          if (!this.enforceTablePermission(res, session, 'ATTRIBUTES', 'READ_WRITE')) return;
          const code = combatAttrMatch[1];
          const dto = await this.readJsonBody(req);
          this.sendJson(res, 200, await this.attributesController.updateCombatAttribute(code, dto));
          return;
        }

        this.sendJson(res, 404, { error: 'Rota da API Admin não encontrada.' });
        return;
      }

      // 4. Rotas da API dos Jogadores e GM (`/api/play/*`)
      if (pathname === '/api/play/auth/login' && method === 'POST') {
        const body = await this.readJsonBody<{ username?: string; password?: string }>(req);
        const result = await this.authService.authenticatePlay(
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

      if (pathname.startsWith('/api/play/')) {
        const session = this.authService.verifyPlayToken(req);
        if (!session) {
          this.sendJson(res, 401, { error: 'Sessão expirada ou não autenticada. Faça login em /play.' });
          return;
        }

        let userAccountId = Number(session.sub);
        if (!Number.isInteger(userAccountId) || userAccountId <= 0) {
          const firstAdmin = await this.prisma.userAccount.findFirst({
            where: { role: 'ADMIN' },
            orderBy: { id: 'asc' },
          });
          if (!firstAdmin) {
            this.sendJson(res, 401, { error: 'Crie primeiro uma conta de usuário no banco.' });
            return;
          }
          userAccountId = firstAdmin.id;
        }

        if (pathname === '/api/play/bootstrap' && method === 'GET') {
          const data = await this.playController.getPlayBootstrap(userAccountId);
          this.sendJson(res, 200, {
            session: {
              userAccountId,
              username: session.username,
              role: session.role,
            },
            ...data,
          });
          return;
        }

        if (pathname === '/api/play/characters' && method === 'POST') {
          const dto = await this.readJsonBody(req);
          this.sendJson(res, 201, await this.playController.createCharacter(userAccountId, dto));
          return;
        }

        const charDeleteMatch = pathname.match(/^\/api\/play\/characters\/(\d+)$/);
        if (charDeleteMatch && method === 'DELETE') {
          const charId = Number(charDeleteMatch[1]);
          this.sendJson(res, 200, await this.playController.deleteCharacter(userAccountId, charId));
          return;
        }

        const playMapMatch = pathname.match(/^\/api\/play\/map\/(\d+)$/);
        if (playMapMatch && method === 'GET') {
          const mapId = Number(playMapMatch[1]);
          this.sendJson(res, 200, await this.playController.getMapStateForPlay(mapId));
          return;
        }

        const syncPosMatch = pathname.match(/^\/api\/play\/characters\/(\d+)\/sync-position$/);
        if (syncPosMatch && method === 'POST') {
          const charId = Number(syncPosMatch[1]);
          const dto = await this.readJsonBody(req);
          this.sendJson(
            res,
            200,
            await this.playController.syncPosition(userAccountId, session.role, charId, dto)
          );
          return;
        }

        const traverseMatch = pathname.match(/^\/api\/play\/characters\/(\d+)\/traverse-portal$/);
        if (traverseMatch && method === 'POST') {
          const charId = Number(traverseMatch[1]);
          const dto = await this.readJsonBody<{ portalId: number }>(req);
          this.sendJson(
            res,
            200,
            await this.playController.traversePortal(userAccountId, charId, Number(dto.portalId))
          );
          return;
        }

        const unstuckMatch = pathname.match(/^\/api\/play\/characters\/(\d+)\/unstuck$/);
        if (unstuckMatch && method === 'POST') {
          const charId = Number(unstuckMatch[1]);
          this.sendJson(res, 200, await this.playController.unstuckCharacter(userAccountId, charId));
          return;
        }

        const gmTeleportMatch = pathname.match(/^\/api\/play\/characters\/(\d+)\/gm-teleport$/);
        if (gmTeleportMatch && method === 'POST') {
          const charId = Number(gmTeleportMatch[1]);
          const dto = await this.readJsonBody(req);
          this.sendJson(
            res,
            200,
            await this.playController.gmTeleport(userAccountId, session.role, charId, dto)
          );
          return;
        }

        const toggleRebornMatch = pathname.match(/^\/api\/play\/characters\/(\d+)\/toggle-reborn$/);
        if (toggleRebornMatch && method === 'POST') {
          const charId = Number(toggleRebornMatch[1]);
          this.sendJson(
            res,
            200,
            await this.playController.toggleReborn(userAccountId, session.role, charId)
          );
          return;
        }

        const groundOffsetMatch = pathname.match(/^\/api\/play\/characters\/(\d+)\/ground-offset$/);
        if (groundOffsetMatch && method === 'POST') {
          const charId = Number(groundOffsetMatch[1]);
          const body = await this.readJsonBody<{ offset?: number }>(req);
          this.sendJson(
            res,
            200,
            await this.playController.updateClassGroundOffset(userAccountId, session.role, charId, Number(body.offset) || 0)
          );
          return;
        }

        // 📜 Rotas de Quests / Missões do Jogador e Indicadores de Cabeça dos NPCs (! vermelho, ? cinza, ? vermelho)
        const charQuestsMatch = pathname.match(/^\/api\/play\/characters\/(\d+)\/quests$/);
        if (charQuestsMatch && method === 'GET') {
          const charId = Number(charQuestsMatch[1]);
          const mapId = urlObj.searchParams.get('mapId') ? Number(urlObj.searchParams.get('mapId')) : null;
          this.sendJson(res, 200, await this.questsController.getCharacterQuestState(charId, mapId));
          return;
        }
        const acceptQuestMatch = pathname.match(/^\/api\/play\/characters\/(\d+)\/quests\/accept$/);
        if (acceptQuestMatch && method === 'POST') {
          const charId = Number(acceptQuestMatch[1]);
          const body = await this.readJsonBody<{ questTemplateId: number; mapId?: number | null }>(req);
          this.sendJson(
            res,
            200,
            await this.questsController.acceptQuest(charId, Number(body.questTemplateId), body.mapId ?? null)
          );
          return;
        }
        const interactNpcQuestMatch = pathname.match(/^\/api\/play\/characters\/(\d+)\/quests\/interact-npc$/);
        if (interactNpcQuestMatch && method === 'POST') {
          const charId = Number(interactNpcQuestMatch[1]);
          const body = await this.readJsonBody<{ npcTemplateId: number; mapId?: number | null }>(req);
          this.sendJson(
            res,
            200,
            await this.questsController.interactNpcForQuest(charId, Number(body.npcTemplateId), body.mapId ?? null)
          );
          return;
        }
        const turnInQuestMatch = pathname.match(/^\/api\/play\/characters\/(\d+)\/quests\/turn-in$/);
        if (turnInQuestMatch && method === 'POST') {
          const charId = Number(turnInQuestMatch[1]);
          const body = await this.readJsonBody<{ questTemplateId: number; mapId?: number | null }>(req);
          this.sendJson(
            res,
            200,
            await this.questsController.turnInQuest(charId, Number(body.questTemplateId), body.mapId ?? null)
          );
          return;
        }

        // ⚔️ Rotas da Arena de Combate em Tempo Real e Encontros no Mapa
        if (pathname === '/api/play/combat/encounter' && method === 'POST') {
          const body = await this.readJsonBody<{ characterId?: number; mapId: number }>(req);
          const state = await this.combatController.startEncounterByMap(
            Number(body.characterId) || 1,
            Number(body.mapId)
          );
          this.sendJson(res, 200, state);
          return;
        }
        if (pathname === '/api/play/temporary-combat/monsters' && method === 'GET') {
          this.sendJson(res, 200, await this.combatController.getAvailableMonsters());
          return;
        }
        if (pathname === '/api/play/temporary-combat/start' && method === 'POST') {
          const body = await this.readJsonBody<{
            characterId?: number;
            monsterTemplateId: number;
            quantity?: number;
            monsterLevel?: number;
          }>(req);
          const state = await this.combatController.startBattle(
            Number(body.characterId) || 0,
            Number(body.monsterTemplateId),
            Number(body.quantity) || 1,
            Number(body.monsterLevel) || 1
          );
          this.sendJson(res, 200, state);
          return;
        }
        if (pathname === '/api/play/temporary-combat/action' && method === 'POST') {
          const body = await this.readJsonBody<{
            battleId: string;
            actionType: 'ATTACK' | 'SKILL' | 'DEFEND';
            targetMonsterIndex?: number;
          }>(req);
          const state = this.combatController.executeAction(
            body.battleId,
            body.actionType || 'ATTACK',
            Number(body.targetMonsterIndex) || 0
          );
          if (state.isFinished && state.winner === 'PLAYER' && !state.victoryRecorded) {
            state.victoryRecorded = true;
            await this.questsController.recordBattleVictoryProgress(
              state.characterId || 1,
              state.monsterTemplateId || 1,
              state.monsters.length
            );
          }
          this.sendJson(res, 200, state);
          return;
        }
        if (pathname === '/api/play/temporary-combat/auto-resolve' && method === 'POST') {
          const body = await this.readJsonBody<{ battleId: string }>(req);
          const state = this.combatController.autoResolve(body.battleId);
          if (state.isFinished && state.winner === 'PLAYER' && !state.victoryRecorded) {
            state.victoryRecorded = true;
            await this.questsController.recordBattleVictoryProgress(
              state.characterId || 1,
              state.monsterTemplateId || 1,
              state.monsters.length
            );
          }
          this.sendJson(res, 200, state);
          return;
        }

        this.sendJson(res, 404, { error: 'Rota da API Play não encontrada.' });
        return;
      }

      // 5. Servir Arquivos Estáticos de `apps/server/public` (/admin, /play, /gm, subpastas /js, etc.)
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
    });
    return server;
  }
}

const port = Number(process.env.PORT ?? 4000);
const app = new EtheriaServerApp();
app.start(port);
