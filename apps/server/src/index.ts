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
import * as zlib from 'node:zlib';
import { promisify } from 'node:util';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PrismaClient, SnapshotManager } from '@etheria/database';
import { AdminAuthService } from './security/AdminAuthService.js';
import { AdminUsersController } from './controllers/AdminUsersController.js';
import { AdminMapsController } from './controllers/AdminMapsController.js';
import { GamePlayController } from './controllers/GamePlayController.js';
import { AdminMonstersController } from './controllers/AdminMonstersController.js';
import { AdminUiLayoutsController } from './controllers/AdminUiLayoutsController.js';
import { AdminEquipmentsController } from './controllers/AdminEquipmentsController.js';
import { AdminEquipmentSetsController } from './controllers/AdminEquipmentSetsController.js';
import { AdminItemsController } from './controllers/AdminItemsController.js';
import { AdminShopsController } from './controllers/AdminShopsController.js';
import { AdminSkillsController } from './controllers/AdminSkillsController.js';
import { AdminQuestsController } from './controllers/AdminQuestsController.js';
import { AdminAttributesController } from './controllers/AdminAttributesController.js';
import { AdminExperienceController } from './controllers/AdminExperienceController.js';
import { AdminWorldMapsController } from './controllers/AdminWorldMapsController.js';
import { AdminMapUploadController } from './controllers/AdminMapUploadController.js';
import { TemporaryCombatController } from './controllers/TemporaryCombatController.js';
import { DungeonService } from './controllers/DungeonService.js';
import { MonsterGlobalConfigService } from './controllers/MonsterGlobalConfigService.js';
import { AssetMirrorService } from './controllers/AssetMirrorService.js';
import { MapRuntimeCacheService } from './controllers/MapRuntimeCacheService.js';
import { AdminRouter } from './routes/AdminRouter.js';
import { PlayRouter } from './routes/PlayRouter.js';
import { InputSanitizer } from './security/InputSanitizer.js';

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
  private readonly uiLayoutsController: AdminUiLayoutsController;
  private readonly equipmentsController: AdminEquipmentsController;
  private readonly equipmentSetsController: AdminEquipmentSetsController;
  private readonly itemsController: AdminItemsController;
  private readonly shopsController: AdminShopsController;
  private readonly skillsController: AdminSkillsController;
  private readonly questsController: AdminQuestsController;
  private readonly attributesController: AdminAttributesController;
  private readonly experienceController: AdminExperienceController;
  private readonly worldMapsController: AdminWorldMapsController;
  private readonly mapUploadController: AdminMapUploadController;
  private readonly combatController: TemporaryCombatController;
  private readonly assetMirrorService: AssetMirrorService;
  private readonly adminRouter: AdminRouter;
  private readonly playRouter: PlayRouter;
  private readonly publicDir: string;
  private readonly mapImageCache = new Map<number, { buffer: Buffer; contentType: string }>();
  private static readonly MAX_CACHED_MAP_IMAGES = 12;

  constructor() {
    this.prisma = new PrismaClient();
    const snapshotManager = new SnapshotManager(this.prisma);
    this.assetMirrorService = new AssetMirrorService();
    this.authService = new AdminAuthService(this.prisma);
    this.usersController = new AdminUsersController(this.prisma);
    this.mapsController = new AdminMapsController(this.prisma, this.assetMirrorService);
    this.playController = new GamePlayController(this.prisma, this.assetMirrorService);
    this.monstersController = new AdminMonstersController(this.prisma, this.assetMirrorService);
    this.uiLayoutsController = new AdminUiLayoutsController(this.prisma, snapshotManager);
    this.equipmentsController = new AdminEquipmentsController(this.prisma, this.assetMirrorService);
    this.equipmentSetsController = new AdminEquipmentSetsController(this.prisma);
    this.itemsController = new AdminItemsController(this.prisma, this.assetMirrorService);
    this.shopsController = new AdminShopsController(this.prisma);
    this.skillsController = new AdminSkillsController(this.prisma, this.assetMirrorService);
    this.questsController = new AdminQuestsController(this.prisma, snapshotManager);
    this.attributesController = new AdminAttributesController(this.prisma);
    this.experienceController = new AdminExperienceController(this.prisma);
    this.worldMapsController = new AdminWorldMapsController(this.prisma, snapshotManager);
    this.combatController = new TemporaryCombatController(this.prisma);
    this.publicDir = path.resolve(__dirname, '../public');
    this.mapUploadController = new AdminMapUploadController(this.publicDir);

    const sendJson = this.sendJson.bind(this);
    const readJsonBody = this.readJsonBody.bind(this);

    this.adminRouter = new AdminRouter({
      prisma: this.prisma,
      authService: this.authService,
      usersController: this.usersController,
      mapsController: this.mapsController,
      mapUploadController: this.mapUploadController,
      monstersController: this.monstersController,
      uiLayoutsController: this.uiLayoutsController,
      equipmentsController: this.equipmentsController,
      equipmentSetsController: this.equipmentSetsController,
      itemsController: this.itemsController,
      shopsController: this.shopsController,
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
      assetMirrorService: this.assetMirrorService,
      sendJson,
      readJsonBody,
    });
  }

  /**
   * Cabeçalhos padrão de endurecimento HTTP (Security Headers).
   */
  private static readonly SECURITY_HEADERS: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  };

  /**
   * Retorna cabeçalhos CORS estritos apenas quando `ALLOWED_CORS_ORIGINS` está configurado.
   */
  private buildCorsHeaders(req?: http.IncomingMessage): Record<string, string> {
    const allowedRaw = (process.env.ALLOWED_CORS_ORIGINS ?? '').trim();
    const origin = req?.headers?.origin;
    if (!allowedRaw || !origin) return {};
    const allowList = allowedRaw.split(',').map((o) => o.trim()).filter(Boolean);
    if (allowList.includes(origin)) {
      return {
        'Access-Control-Allow-Origin': origin,
        'Vary': 'Origin',
      };
    }
    return {};
  }

  /**
   * Lê e decodifica o corpo JSON de uma requisição HTTP com limite de segurança padrão de 1 MB
   * (rotas específicas de malha/upload de mapas podem passar limite explícito de 15 MB).
   */
  public async readJsonBody<T = any>(req: http.IncomingMessage, maxBytes: number = 1 * 1024 * 1024): Promise<T> {
    const limit = Math.max(1024, Number(maxBytes) || 1 * 1024 * 1024);
    const limitMb = Math.round((limit / (1024 * 1024)) * 10) / 10;
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let totalSize = 0;
      req.on('data', (chunk: Buffer) => {
        totalSize += chunk.length;
        if (totalSize > limit) {
          reject(new Error(`Payload excede o limite de ${limitMb} MB.`));
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
      ...EtheriaServerApp.SECURITY_HEADERS,
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

  private static readonly gzipAsync = promisify(zlib.gzip);
  private static readonly COMPRESSIBLE_EXTS = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg']);
  private static readonly IMMUTABLE_ASSET_EXTS = new Set(['.png', '.webp', '.jpg', '.jpeg', '.gif', '.svg', '.woff', '.woff2']);

  /**
   * Serve arquivos estáticos de `apps/server/public` de forma segura e modular.
   * Suporta rotas raiz, subpastas (/admin/js/*, /play/js/*), ETag/304 e compressão Gzip.
   */
  private async tryServeStatic(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    pathname: string
  ): Promise<boolean> {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return false;
    }

    const sendStaticPayload = async (
      resolvedFull: string,
      ext: string,
      cacheControl: string,
      extraHeaders: Record<string, string> = {}
    ): Promise<boolean> => {
      try {
        const stats = await fs.stat(resolvedFull);
        if (!stats.isFile()) return false;
        const etag = `W/"${stats.size}-${Math.floor(stats.mtimeMs)}"`;
        const isCompressible = EtheriaServerApp.COMPRESSIBLE_EXTS.has(ext);
        const acceptEncoding = String(req.headers['accept-encoding'] || '');
        const useGzip = isCompressible && stats.size >= 1024 && /\bgzip\b/i.test(acceptEncoding);

        const baseHeaders: Record<string, string> = {
          'Content-Type': EtheriaServerApp.MIME_TYPES[ext] || 'application/octet-stream',
          'Cache-Control': cacheControl,
          ETag: etag,
          ...EtheriaServerApp.SECURITY_HEADERS,
          ...extraHeaders,
        };
        if (isCompressible) {
          baseHeaders['Vary'] = 'Accept-Encoding';
        }

        const ifNoneMatch = String(req.headers['if-none-match'] || '').trim();
        if (ifNoneMatch === etag) {
          res.writeHead(304, baseHeaders);
          res.end();
          return true;
        }

        let payload: Buffer = await fs.readFile(resolvedFull);
        if (useGzip) {
          payload = await EtheriaServerApp.gzipAsync(payload);
          baseHeaders['Content-Encoding'] = 'gzip';
        }
        baseHeaders['Content-Length'] = String(payload.length);
        res.writeHead(200, baseHeaders);
        if (req.method === 'HEAD') res.end();
        else res.end(payload);
        return true;
      } catch {
        return false;
      }
    };

    if (pathname === '/shared/CombatDamageCalculator.js') {
      const sharedCalcPath = path.resolve(__dirname, '../../../packages/shared/dist/CombatDamageCalculator.js');
      return sendStaticPayload(sharedCalcPath, '.js', 'no-cache');
    }

    let relPath = pathname;
    if (relPath === '/' || relPath === '/admin' || relPath === '/admin/') {
      relPath = '/admin/index.html';
    } else if (relPath === '/play' || relPath === '/play/' || relPath === '/gm' || relPath === '/gm/') {
      relPath = '/play/index.html';
    }

    const safeRel = path.normalize(relPath).replace(/^(\.\.[\/\\])+/, '').replace(/^[\\\/]+/, '');
    const resolvedPublic = path.resolve(this.publicDir);
    const resolvedFull = path.resolve(resolvedPublic, safeRel);

    if (!resolvedFull.startsWith(resolvedPublic + path.sep)) {
      return false;
    }

    const ext = path.extname(resolvedFull).toLowerCase();
    const normalizedRel = safeRel.replace(/\\/g, '/');
    const isLongLivedAsset =
      (normalizedRel.startsWith('play/assets/') || normalizedRel.startsWith('assets/')) &&
      EtheriaServerApp.IMMUTABLE_ASSET_EXTS.has(ext);
    const cacheControl = isLongLivedAsset ? 'public, max-age=86400' : 'no-cache';
    const extraHeaders: Record<string, string> = {};
    if (normalizedRel === 'play/sw.js') {
      extraHeaders['Service-Worker-Allowed'] = '/';
    }

    return sendStaticPayload(resolvedFull, ext, cacheControl, extraHeaders);
  }

  /**
   * Proxy reverso resiliente para imagens de mapas via cache persistente em disco + RAM.
   */
  private async handleMapImageAsset(
    mapId: number,
    res: http.ServerResponse,
    method: string = 'GET',
    req?: http.IncomingMessage
  ): Promise<void> {
    try {
      const corsHeaders = this.buildCorsHeaders(req);
      const cached = this.mapImageCache.get(mapId);
      if (cached) {
        res.writeHead(200, {
          'Content-Type': cached.contentType,
          'Content-Length': cached.buffer.length,
          'Cache-Control': 'public, max-age=31536000, immutable',
          ...EtheriaServerApp.SECURITY_HEADERS,
          ...corsHeaders,
        });
        if (method === 'HEAD') res.end();
        else res.end(cached.buffer);
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

      if (map.mcreworkMapImage.startsWith('/assets/')) {
        const localRel = map.mcreworkMapImage.replace(/^\/+/, '');
        const localPath = path.join(this.publicDir, localRel);
        try {
          const buffer = await fs.readFile(localPath);
          const ext = path.extname(localPath).toLowerCase();
          const contentType = EtheriaServerApp.MIME_TYPES[ext] || 'image/png';
          this.mapImageCache.set(mapId, { buffer, contentType });
          res.writeHead(200, {
            'Content-Type': contentType,
            'Content-Length': buffer.length,
            'Cache-Control': 'public, max-age=31536000, immutable',
            ...EtheriaServerApp.SECURITY_HEADERS,
            ...corsHeaders,
          });
          if (method === 'HEAD') res.end();
          else res.end(buffer);
          return;
        } catch {
          // prossegue para mirror
        }
      }

      const asset = await this.assetMirrorService.getOrFetchAsset(map.mcreworkMapImage);
      if (!asset) {
        this.sendJson(res, 502, { error: `Falha ao baixar imagem do mapa #${mapId} no mirror local.` });
        return;
      }

      if (this.mapImageCache.size >= EtheriaServerApp.MAX_CACHED_MAP_IMAGES && !this.mapImageCache.has(mapId)) {
        const oldestKey = this.mapImageCache.keys().next().value;
        if (oldestKey !== undefined) this.mapImageCache.delete(oldestKey);
      }
      this.mapImageCache.set(mapId, { buffer: asset.buffer, contentType: asset.contentType });

      res.writeHead(200, {
        'Content-Type': asset.contentType,
        'Content-Length': asset.buffer.length,
        'Cache-Control': 'public, max-age=31536000, immutable',
        ...EtheriaServerApp.SECURITY_HEADERS,
        ...corsHeaders,
      });
      if (method === 'HEAD') res.end();
      else res.end(asset.buffer);
    } catch (err: any) {
      this.sendJson(res, 500, { error: `Falha interna no proxy da imagem do mapa: ${err?.message || err}` });
    }
  }

  /**
   * Pré-aquece no disco local da VPS todos os assets curados ativos (mapas, sprites, ícones e VFX).
   */
  public async prewarmMapImages(): Promise<void> {
    await this.assetMirrorService.prewarmCuratedAssets(this.prisma);
  }

  /**
   * Processa todas as requisições HTTP destinadas à API e aos arquivos estáticos.
   */
  public async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      const urlObj = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      const pathname = urlObj.pathname;
      const method = req.method ?? 'GET';

      // 0a. Asset Proxy Público para mapas (/api/assets/map-image/:id)
      const mapAssetMatch = pathname.match(/^\/api\/assets\/map-image\/(\d+)$/);
      if (mapAssetMatch && (method === 'GET' || method === 'HEAD')) {
        const mapId = Number(mapAssetMatch[1]);
        await this.handleMapImageAsset(mapId, res, method, req);
        return;
      }

      // 0b. Asset Mirror Persistente em Disco para qualquer asset curado (/api/assets/mcrework/assets/...)
      const mcreworkAssetMatch = pathname.match(/^\/api\/assets\/mcrework\/(assets\/.+)$/);
      if (mcreworkAssetMatch && (method === 'GET' || method === 'HEAD')) {
        const asset = await this.assetMirrorService.getOrFetchAsset(mcreworkAssetMatch[1]);
        if (!asset) {
          this.sendJson(res, 404, { error: `Asset não encontrado: ${mcreworkAssetMatch[1]}` });
          return;
        }
        res.writeHead(200, {
          'Content-Type': asset.contentType,
          'Content-Length': asset.buffer.length,
          'Cache-Control': 'public, max-age=31536000, immutable',
          ...EtheriaServerApp.SECURITY_HEADERS,
          ...this.buildCorsHeaders(req),
        });
        if (method === 'HEAD') res.end();
        else res.end(asset.buffer);
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
      const served = await this.tryServeStatic(req, res, pathname);
      if (served) return;

      this.sendJson(res, 404, { error: 'Página não encontrada.' });
    } catch (err: any) {
      console.error('❌ [EtheriaServerApp Error]:', err);
      const safeErr = InputSanitizer.sanitizeHttpError(err);
      this.sendJson(res, safeErr.statusCode, { error: safeErr.message });
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
      void (async () => {
        await SnapshotManager.syncAllSequences(this.prisma);
        void this.prewarmMapImages();
        void this.monstersController.ensureInitialMonsters();
        void this.skillsController.ensureInitialSkillsAndBuffs();
        void this.questsController.ensureInitialQuests();
        void this.uiLayoutsController.seedInitialUiLayoutsIfEmpty();
        void this.equipmentsController.seedInitialEquipmentsIfEmpty();
        void this.itemsController.seedInitialItemsIfEmpty();
        void this.experienceController.seedInitialLevelExperienceIfEmpty();
        void this.worldMapsController.seedInitialWorldMapsIfEmpty();
        void DungeonService.ensureDungeonMapType(this.prisma);
        void MonsterGlobalConfigService.ensureLoaded(this.prisma);
      })();
    });

    let shuttingDown = false;
    const gracefulShutdown = async (signal: string) => {
      if (shuttingDown) return;
      shuttingDown = true;
      console.log(`🛑 [Etheria Campus Server] Encerrando com segurança (${signal})...`);
      const forceExitTimer = setTimeout(() => {
        process.exit(0);
      }, 3000);
      forceExitTimer.unref();

      try {
        await MapRuntimeCacheService.flushAll(this.prisma);
      } catch (err: any) {
        console.warn('[EtheriaServerApp] Aviso ao descarregar posições em cache:', err?.message || err);
      }
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
      await this.prisma.$disconnect().catch(() => {});
      process.exit(0);
    };

    process.once('SIGTERM', () => void gracefulShutdown('SIGTERM'));
    process.once('SIGINT', () => void gracefulShutdown('SIGINT'));

    return server;
  }
}

const port = Number(process.env.PORT ?? 4000);
const app = new EtheriaServerApp();
app.start(port);
