/**
 * @file apps/server/src/routes/AdminRouter.ts
 * @module @etheria/server/routes/AdminRouter
 * @description Roteador central para todos os endpoints administrativos (`/api/admin/*`).
 *   Gerencia autenticação dual-mode, controle granular de permissões (RBAC) por tabela
 *   e direcionamento para controladores especializados do Studio Low-Code.
 * @rules Segue estritamente AGENTS.md (Cláusula 0 de Segurança e Regra #7 de modularidade).
 */

import type * as http from 'node:http';
import type { PrismaClient } from '@etheria/database';
import type { AdminAuthService, AdminTokenPayload } from '../security/AdminAuthService.js';
import type { AdminUsersController } from '../controllers/AdminUsersController.js';
import type { AdminMapsController } from '../controllers/AdminMapsController.js';
import type { AdminMonstersController } from '../controllers/AdminMonstersController.js';
import type { AdminUiLayoutsController } from '../controllers/AdminUiLayoutsController.js';
import type { AdminEquipmentsController } from '../controllers/AdminEquipmentsController.js';
import type { AdminItemsController } from '../controllers/AdminItemsController.js';
import type { AdminFlyingMountsController } from '../controllers/AdminFlyingMountsController.js';
import type { AdminSkillsController } from '../controllers/AdminSkillsController.js';
import type { AdminQuestsController } from '../controllers/AdminQuestsController.js';
import type { AdminAttributesController } from '../controllers/AdminAttributesController.js';
import type { AdminExperienceController } from '../controllers/AdminExperienceController.js';
import type { AdminWorldMapsController } from '../controllers/AdminWorldMapsController.js';

export interface AdminRouterDeps {
  prisma: PrismaClient;
  authService: AdminAuthService;
  usersController: AdminUsersController;
  mapsController: AdminMapsController;
  monstersController: AdminMonstersController;
  uiLayoutsController: AdminUiLayoutsController;
  equipmentsController: AdminEquipmentsController;
  itemsController: AdminItemsController;
  mountsController: AdminFlyingMountsController;
  skillsController: AdminSkillsController;
  questsController: AdminQuestsController;
  attributesController: AdminAttributesController;
  experienceController: AdminExperienceController;
  worldMapsController: AdminWorldMapsController;
  sendJson: (res: http.ServerResponse, statusCode: number, data: unknown) => void;
  readJsonBody: <T = any>(req: http.IncomingMessage) => Promise<T>;
}

export class AdminRouter {
  constructor(private readonly deps: AdminRouterDeps) {}

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
    if (this.deps.authService.canAccessTable(session, tableKey, mode)) {
      return true;
    }
    this.deps.sendJson(res, 403, {
      error: `Acesso negado: Você possui permissão insuficiente para ${
        mode === 'READ_WRITE' ? 'editar' : 'visualizar'
      } a tabela "${tableKey}". Solicite liberação ao Desenvolvedor (DEV).`,
    });
    return false;
  }

  /**
   * Processa requisições HTTP para a rota `/api/admin/*`.
   * Retorna `true` caso a requisição tenha sido atendida por este roteador, ou `false` caso pertença a outro domínio.
   */
  public async handle(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    pathname: string,
    method: string,
    urlObj: URL
  ): Promise<boolean> {
    if (!pathname.startsWith('/api/admin/')) {
      return false;
    }

    // 1. Status de Conexão e Diagnóstico de Localhost para a tela de login do /admin
    if (pathname === '/api/admin/auth/context' && method === 'GET') {
      const isStrictLocalhost = this.deps.authService.isStrictLocalhost(req);
      const tokenPayload = this.deps.authService.verifyRequestToken(req);
      this.deps.sendJson(res, 200, {
        isStrictLocalhost,
        envLoginAllowed: isStrictLocalhost,
        authenticated: Boolean(tokenPayload),
        session: tokenPayload,
      });
      return true;
    }

    // 2. Endpoint de Login da Rota /admin
    if (pathname === '/api/admin/auth/login' && method === 'POST') {
      const body = await this.deps.readJsonBody<{ username?: string; password?: string }>(req);
      const result = await this.deps.authService.authenticate(
        req,
        body.username ?? '',
        body.password ?? ''
      );
      if (!result.success) {
        this.deps.sendJson(res, 401, { error: result.error });
        return true;
      }
      this.deps.sendJson(res, 200, {
        token: result.token,
        session: result.payload,
      });
      return true;
    }

    // 3. Proteção Obrigatória (Guard) para todas as demais rotas `/api/admin/*`
    const session = this.deps.authService.verifyRequestToken(req);
    if (!session) {
      this.deps.sendJson(res, 401, {
        error: 'Não autorizado. Faça login na rota /admin.',
      });
      return true;
    }

    // --- Rotas do CRUD de Contas de Usuários e Permissões ---
    if (pathname === '/api/admin/users' && method === 'GET') {
      this.deps.sendJson(res, 200, await this.deps.usersController.listUsers(session));
      return true;
    }
    if (pathname === '/api/admin/users' && method === 'POST') {
      const dto = await this.deps.readJsonBody(req);
      this.deps.sendJson(res, 201, await this.deps.usersController.createUser(dto, session));
      return true;
    }
    const userPermsMatch = pathname.match(/^\/api\/admin\/users\/(\d+)\/permissions$/);
    if (userPermsMatch && method === 'PUT') {
      const id = Number(userPermsMatch[1]);
      const body = await this.deps.readJsonBody<{ permissions?: Record<string, any>; tablePermissions?: Record<string, any> }>(req);
      const perms = body.permissions ?? body.tablePermissions ?? {};
      this.deps.sendJson(res, 200, await this.deps.usersController.updateTablePermissions(id, perms, session));
      return true;
    }
    const userMatch = pathname.match(/^\/api\/admin\/users\/(\d+)$/);
    if (userMatch && method === 'PUT') {
      this.deps.sendJson(res, 200, await this.deps.usersController.updateUser(Number(userMatch[1]), await this.deps.readJsonBody(req), session));
      return true;
    }
    if (userMatch && method === 'DELETE') {
      this.deps.sendJson(res, 200, await this.deps.usersController.deleteUser(Number(userMatch[1]), session));
      return true;
    }

    // --- Rotas do Editor Visual de Mapas, NPCs, Classes & Galeria mcrework ---
    if (pathname === '/api/admin/mcrework/maps' && method === 'GET') {
      if (this.enforceTablePermission(res, session, 'MAPS', 'READ')) {
        this.deps.sendJson(res, 200, await this.deps.mapsController.getMcreworkCleanMapGallery());
      }
      return true;
    }
    if (pathname === '/api/admin/mcrework/npcs' && method === 'GET') {
      if (this.enforceTablePermission(res, session, 'NPCS', 'READ')) {
        this.deps.sendJson(res, 200, await this.deps.mapsController.getMcreworkNpcGallery());
      }
      return true;
    }
    if (pathname === '/api/admin/mcrework/characters' && method === 'GET') {
      if (this.enforceTablePermission(res, session, 'CLASSES', 'READ')) {
        this.deps.sendJson(res, 200, await this.deps.mapsController.getMcreworkCharacterGallery());
      }
      return true;
    }
    if (pathname === '/api/admin/maps/bootstrap' && method === 'GET') {
      if (
        !this.deps.authService.canAccessTable(session, 'MAPS', 'READ') &&
        !this.deps.authService.canAccessTable(session, 'NPCS', 'READ') &&
        !this.deps.authService.canAccessTable(session, 'CLASSES', 'READ')
      ) {
        this.deps.sendJson(res, 403, { error: 'Acesso negado às tabelas de Mapas, NPCs e Classes.' });
        return true;
      }
      this.deps.sendJson(res, 200, await this.deps.mapsController.getEditorBootstrap());
      return true;
    }
    if (pathname === '/api/admin/class-templates' && method === 'POST') {
      if (this.enforceTablePermission(res, session, 'CLASSES', 'READ_WRITE')) {
        this.deps.sendJson(res, 201, await this.deps.mapsController.saveClassTemplate(await this.deps.readJsonBody(req), null));
      }
      return true;
    }
    const classMatch = pathname.match(/^\/api\/admin\/class-templates\/(\d+)$/);
    if (classMatch && method === 'PUT') {
      if (this.enforceTablePermission(res, session, 'CLASSES', 'READ_WRITE')) {
        this.deps.sendJson(res, 200, await this.deps.mapsController.saveClassTemplate(await this.deps.readJsonBody(req), Number(classMatch[1])));
      }
      return true;
    }
    if (classMatch && method === 'DELETE') {
      if (this.enforceTablePermission(res, session, 'CLASSES', 'READ_WRITE')) {
        this.deps.sendJson(res, 200, await this.deps.mapsController.deleteClassTemplate(Number(classMatch[1])));
      }
      return true;
    }
    if (pathname === '/api/admin/npc-templates' && method === 'POST') {
      if (this.enforceTablePermission(res, session, 'NPCS', 'READ_WRITE')) {
        this.deps.sendJson(res, 201, await this.deps.mapsController.saveNpcTemplate(await this.deps.readJsonBody(req), null));
      }
      return true;
    }
    const npcMatch = pathname.match(/^\/api\/admin\/npc-templates\/(\d+)$/);
    if (npcMatch && method === 'PUT') {
      if (this.enforceTablePermission(res, session, 'NPCS', 'READ_WRITE')) {
        this.deps.sendJson(res, 200, await this.deps.mapsController.saveNpcTemplate(await this.deps.readJsonBody(req), Number(npcMatch[1])));
      }
      return true;
    }
    if (npcMatch && method === 'DELETE') {
      if (this.enforceTablePermission(res, session, 'NPCS', 'READ_WRITE')) {
        this.deps.sendJson(res, 200, await this.deps.mapsController.deleteNpcTemplate(Number(npcMatch[1])));
      }
      return true;
    }
    if (pathname === '/api/admin/maps' && method === 'POST') {
      if (this.enforceTablePermission(res, session, 'MAPS', 'READ_WRITE')) {
        this.deps.sendJson(res, 201, await this.deps.mapsController.saveMap(null, await this.deps.readJsonBody(req)));
      }
      return true;
    }
    const mapMatch = pathname.match(/^\/api\/admin\/maps\/(\d+)$/);
    if (mapMatch && method === 'PUT') {
      if (this.enforceTablePermission(res, session, 'MAPS', 'READ_WRITE')) {
        this.deps.sendJson(res, 200, await this.deps.mapsController.saveMap(Number(mapMatch[1]), await this.deps.readJsonBody(req)));
      }
      return true;
    }
    if (mapMatch && method === 'DELETE') {
      if (this.enforceTablePermission(res, session, 'MAPS', 'READ_WRITE')) {
        this.deps.sendJson(res, 200, await this.deps.mapsController.deleteMap(Number(mapMatch[1])));
      }
      return true;
    }
    const mapNpcRotateMatch = pathname.match(/^\/api\/admin\/map-npcs\/(\d+)\/rotate$/);
    if (mapNpcRotateMatch && method === 'POST') {
      if (!this.enforceTablePermission(res, session, 'NPCS', 'READ_WRITE') && !this.enforceTablePermission(res, session, 'MAPS', 'READ_WRITE')) return true;
      const placementId = Number(mapNpcRotateMatch[1]);
      this.deps.sendJson(res, 200, await this.deps.mapsController.rotateMapNpcPlacement(placementId));
      return true;
    }
    const mapTeleportNpcMatch = pathname.match(/^\/api\/admin\/maps\/(\d+)\/teleport-npcs$/);
    if (mapTeleportNpcMatch && method === 'POST') {
      if (!this.enforceTablePermission(res, session, 'MAPS', 'READ_WRITE') && !this.enforceTablePermission(res, session, 'NPCS', 'READ_WRITE')) return true;
      const mapId = Number(mapTeleportNpcMatch[1]);
      const dto = await this.deps.readJsonBody(req);
      this.deps.sendJson(res, 201, await this.deps.mapsController.saveMapTeleportNpc(mapId, dto));
      return true;
    }
    const mapNpcTeleportMatch = pathname.match(/^\/api\/admin\/map-npcs\/(\d+)\/teleport$/);
    if (mapNpcTeleportMatch && method === 'PUT') {
      if (!this.enforceTablePermission(res, session, 'MAPS', 'READ_WRITE') && !this.enforceTablePermission(res, session, 'NPCS', 'READ_WRITE')) return true;
      const placementId = Number(mapNpcTeleportMatch[1]);
      const dto = await this.deps.readJsonBody(req);
      dto.id = placementId;
      const existingNpc = await this.deps.prisma.mapNpc.findUnique({ where: { id: placementId } });
      if (!existingNpc) {
        this.deps.sendJson(res, 404, { error: `Posicionamento de NPC #${placementId} não encontrado.` });
        return true;
      }
      this.deps.sendJson(res, 200, await this.deps.mapsController.saveMapTeleportNpc(existingNpc.mapId, dto));
      return true;
    }
    const mapNpcDeleteMatch = pathname.match(/^\/api\/admin\/map-npcs\/(\d+)$/);
    if (mapNpcDeleteMatch && method === 'DELETE') {
      if (!this.enforceTablePermission(res, session, 'MAPS', 'READ_WRITE') && !this.enforceTablePermission(res, session, 'NPCS', 'READ_WRITE')) return true;
      const placementId = Number(mapNpcDeleteMatch[1]);
      this.deps.sendJson(res, 200, await this.deps.mapsController.deleteMapNpc(placementId));
      return true;
    }

    // --- Mapas Gerais / Mundo (Continentes + Pontos + Logo Transparente) ---
    if (pathname === '/api/admin/world-maps' && method === 'GET') {
      if (this.enforceTablePermission(res, session, 'MAPS', 'READ')) {
        this.deps.sendJson(res, 200, await this.deps.worldMapsController.getWorldMapsBootstrap());
      }
      return true;
    }
    if (pathname === '/api/admin/world-maps' && method === 'POST') {
      if (this.enforceTablePermission(res, session, 'MAPS', 'READ_WRITE')) {
        this.deps.sendJson(res, 200, await this.deps.worldMapsController.saveWorldMap(await this.deps.readJsonBody(req)));
      }
      return true;
    }

    // --- Templates de Monstros / Mobs (mcrework & PostgreSQL) ---
    if (pathname === '/api/admin/mcrework/monsters' && method === 'GET') {
      if (this.enforceTablePermission(res, session, 'MONSTERS', 'READ')) {
        this.deps.sendJson(res, 200, await this.deps.monstersController.getMcreworkMonsterGallery());
      }
      return true;
    }
    if (pathname === '/api/admin/monster-templates' && method === 'GET') {
      if (this.enforceTablePermission(res, session, 'MONSTERS', 'READ')) {
        this.deps.sendJson(res, 200, await this.deps.monstersController.getMonsterTemplates());
      }
      return true;
    }
    if (pathname === '/api/admin/monster-templates' && method === 'POST') {
      if (this.enforceTablePermission(res, session, 'MONSTERS', 'READ_WRITE')) {
        this.deps.sendJson(res, 201, await this.deps.monstersController.createMonsterTemplate(await this.deps.readJsonBody(req)));
      }
      return true;
    }
    const monsterMatch = pathname.match(/^\/api\/admin\/monster-templates\/(\d+)$/);
    if (monsterMatch && method === 'PUT') {
      if (this.enforceTablePermission(res, session, 'MONSTERS', 'READ_WRITE')) {
        this.deps.sendJson(res, 200, await this.deps.monstersController.updateMonsterTemplate(Number(monsterMatch[1]), await this.deps.readJsonBody(req)));
      }
      return true;
    }
    if (monsterMatch && method === 'DELETE') {
      if (this.enforceTablePermission(res, session, 'MONSTERS', 'READ_WRITE')) {
        this.deps.sendJson(res, 200, await this.deps.monstersController.deleteMonsterTemplate(Number(monsterMatch[1])));
      }
      return true;
    }

    // --- Layouts de Interface do Cliente (Mobile Vertical, Mobile Horizontal e Desktop) ---
    if (pathname === '/api/admin/ui-layouts' && method === 'GET') {
      if (this.enforceTablePermission(res, session, 'MAPS', 'READ')) {
        this.deps.sendJson(res, 200, await this.deps.uiLayoutsController.getUiLayouts());
      }
      return true;
    }
    if (pathname === '/api/admin/ui-layouts/reset-defaults' && method === 'POST') {
      if (this.enforceTablePermission(res, session, 'MAPS', 'READ_WRITE')) {
        this.deps.sendJson(res, 200, await this.deps.uiLayoutsController.resetDefaultUiLayouts());
      }
      return true;
    }
    if (pathname === '/api/admin/ui-layouts' && method === 'POST') {
      if (this.enforceTablePermission(res, session, 'MAPS', 'READ_WRITE')) {
        this.deps.sendJson(res, 201, await this.deps.uiLayoutsController.createUiLayout(await this.deps.readJsonBody(req)));
      }
      return true;
    }
    const uiLayoutMatch = pathname.match(/^\/api\/admin\/ui-layouts\/(\d+)$/);
    if (uiLayoutMatch && method === 'PUT') {
      if (this.enforceTablePermission(res, session, 'MAPS', 'READ_WRITE')) {
        this.deps.sendJson(res, 200, await this.deps.uiLayoutsController.updateUiLayout(Number(uiLayoutMatch[1]), await this.deps.readJsonBody(req)));
      }
      return true;
    }
    if (uiLayoutMatch && method === 'DELETE') {
      if (this.enforceTablePermission(res, session, 'MAPS', 'READ_WRITE')) {
        this.deps.sendJson(res, 200, await this.deps.uiLayoutsController.deleteUiLayout(Number(uiLayoutMatch[1])));
      }
      return true;
    }

    // --- Equipamentos e Itens (mcrework & PostgreSQL) ---
    if (pathname === '/api/admin/equipment-slots' && method === 'GET') {
      if (this.enforceTablePermission(res, session, 'MONSTERS', 'READ')) {
        this.deps.sendJson(res, 200, await this.deps.equipmentsController.getEquipmentSlots());
      }
      return true;
    }
    if (pathname === '/api/admin/mcrework/equipment' && method === 'GET') {
      if (this.enforceTablePermission(res, session, 'MONSTERS', 'READ')) {
        this.deps.sendJson(res, 200, await this.deps.equipmentsController.getMcreworkEquipmentGallery());
      }
      return true;
    }
    if (pathname === '/api/admin/equipments' && method === 'GET') {
      const cat = urlObj.searchParams.get('category') || undefined;
      if (this.enforceTablePermission(res, session, 'MONSTERS', 'READ')) {
        this.deps.sendJson(res, 200, await this.deps.equipmentsController.getEquipmentTemplates(cat));
      }
      return true;
    }
    if (pathname === '/api/admin/equipments' && method === 'POST') {
      if (this.enforceTablePermission(res, session, 'MONSTERS', 'READ_WRITE')) {
        this.deps.sendJson(res, 201, await this.deps.equipmentsController.createEquipmentTemplate(await this.deps.readJsonBody(req)));
      }
      return true;
    }
    const eqMatch = pathname.match(/^\/api\/admin\/equipments\/(\d+)$/);
    if (eqMatch && method === 'PUT') {
      if (this.enforceTablePermission(res, session, 'MONSTERS', 'READ_WRITE')) {
        this.deps.sendJson(res, 200, await this.deps.equipmentsController.updateEquipmentTemplate(Number(eqMatch[1]), await this.deps.readJsonBody(req)));
      }
      return true;
    }
    if (eqMatch && method === 'DELETE') {
      if (this.enforceTablePermission(res, session, 'MONSTERS', 'READ_WRITE')) {
        this.deps.sendJson(res, 200, await this.deps.equipmentsController.deleteEquipmentTemplate(Number(eqMatch[1])));
      }
      return true;
    }

    // --- Itens Gerais e Consumíveis (mcrework & PostgreSQL) ---
    if (pathname === '/api/admin/mcrework/items' && method === 'GET') {
      if (this.enforceTablePermission(res, session, 'MONSTERS', 'READ')) {
        this.deps.sendJson(res, 200, await this.deps.itemsController.getMcreworkItemsCatalog());
      }
      return true;
    }
    if (pathname === '/api/admin/items' && method === 'GET') {
      const cat = urlObj.searchParams.get('category') || undefined;
      if (this.enforceTablePermission(res, session, 'MONSTERS', 'READ')) {
        this.deps.sendJson(res, 200, await this.deps.itemsController.getItemTemplates(cat));
      }
      return true;
    }
    if (pathname === '/api/admin/items' && method === 'POST') {
      if (this.enforceTablePermission(res, session, 'MONSTERS', 'READ_WRITE')) {
        this.deps.sendJson(res, 201, await this.deps.itemsController.createItemTemplate(await this.deps.readJsonBody(req)));
      }
      return true;
    }
    const itemMatch = pathname.match(/^\/api\/admin\/items\/(\d+)$/);
    if (itemMatch && method === 'PUT') {
      if (this.enforceTablePermission(res, session, 'MONSTERS', 'READ_WRITE')) {
        this.deps.sendJson(res, 200, await this.deps.itemsController.updateItemTemplate(Number(itemMatch[1]), await this.deps.readJsonBody(req)));
      }
      return true;
    }
    if (itemMatch && method === 'DELETE') {
      if (this.enforceTablePermission(res, session, 'MONSTERS', 'READ_WRITE')) {
        this.deps.sendJson(res, 200, await this.deps.itemsController.deleteItemTemplate(Number(itemMatch[1])));
      }
      return true;
    }

    // --- Montarias Voadoras (mcrework & PostgreSQL) ---
    if (pathname === '/api/admin/mcrework/mounts' && method === 'GET') {
      if (this.enforceTablePermission(res, session, 'MONSTERS', 'READ')) {
        this.deps.sendJson(res, 200, await this.deps.mountsController.getMcreworkMountsGallery());
      }
      return true;
    }
    if (pathname === '/api/admin/flying-mounts' && method === 'GET') {
      const type = urlObj.searchParams.get('type') || undefined;
      if (this.enforceTablePermission(res, session, 'MONSTERS', 'READ')) {
        this.deps.sendJson(res, 200, await this.deps.mountsController.getFlyingMountTemplates(type));
      }
      return true;
    }
    if (pathname === '/api/admin/flying-mounts' && method === 'POST') {
      if (this.enforceTablePermission(res, session, 'MONSTERS', 'READ_WRITE')) {
        this.deps.sendJson(res, 201, await this.deps.mountsController.createFlyingMountTemplate(await this.deps.readJsonBody(req)));
      }
      return true;
    }
    const mountMatch = pathname.match(/^\/api\/admin\/flying-mounts\/(\d+)$/);
    if (mountMatch && method === 'PUT') {
      if (this.enforceTablePermission(res, session, 'MONSTERS', 'READ_WRITE')) {
        this.deps.sendJson(res, 200, await this.deps.mountsController.updateFlyingMountTemplate(Number(mountMatch[1]), await this.deps.readJsonBody(req)));
      }
      return true;
    }
    if (mountMatch && method === 'DELETE') {
      if (this.enforceTablePermission(res, session, 'MONSTERS', 'READ_WRITE')) {
        this.deps.sendJson(res, 200, await this.deps.mountsController.deleteFlyingMountTemplate(Number(mountMatch[1])));
      }
      return true;
    }

    // --- Rotas de Habilidades (Skills) & Buffs/Debuffs (Status Effects) ---
    if (pathname === '/api/admin/mcrework/skill-assets' && method === 'GET') {
      if (this.enforceTablePermission(res, session, 'SKILLS', 'READ')) {
        this.deps.sendJson(res, 200, await this.deps.skillsController.getMcreworkSkillAssets());
      }
      return true;
    }
    if (pathname === '/api/admin/status-effects' && method === 'GET') {
      if (this.enforceTablePermission(res, session, 'STATUS_EFFECTS', 'READ')) {
        this.deps.sendJson(res, 200, await this.deps.skillsController.getStatusEffectTemplates());
      }
      return true;
    }
    if (pathname === '/api/admin/status-effects' && method === 'POST') {
      if (this.enforceTablePermission(res, session, 'STATUS_EFFECTS', 'READ_WRITE')) {
        this.deps.sendJson(res, 201, await this.deps.skillsController.createStatusEffectTemplate(await this.deps.readJsonBody(req)));
      }
      return true;
    }
    const statusEffectMatch = pathname.match(/^\/api\/admin\/status-effects\/(\d+)$/);
    if (statusEffectMatch && method === 'PUT') {
      if (this.enforceTablePermission(res, session, 'STATUS_EFFECTS', 'READ_WRITE')) {
        this.deps.sendJson(res, 200, await this.deps.skillsController.updateStatusEffectTemplate(Number(statusEffectMatch[1]), await this.deps.readJsonBody(req)));
      }
      return true;
    }
    if (statusEffectMatch && method === 'DELETE') {
      if (this.enforceTablePermission(res, session, 'STATUS_EFFECTS', 'READ_WRITE')) {
        this.deps.sendJson(res, 200, await this.deps.skillsController.deleteStatusEffectTemplate(Number(statusEffectMatch[1])));
      }
      return true;
    }

    if (pathname === '/api/admin/skill-templates' && method === 'GET') {
      if (this.enforceTablePermission(res, session, 'SKILLS', 'READ')) {
        this.deps.sendJson(res, 200, await this.deps.skillsController.getSkillTemplates());
      }
      return true;
    }
    if (pathname === '/api/admin/skill-templates' && method === 'POST') {
      if (this.enforceTablePermission(res, session, 'SKILLS', 'READ_WRITE')) {
        this.deps.sendJson(res, 201, await this.deps.skillsController.createSkillTemplate(await this.deps.readJsonBody(req)));
      }
      return true;
    }
    const skillMatch = pathname.match(/^\/api\/admin\/skill-templates\/(\d+)$/);
    if (skillMatch && method === 'PUT') {
      if (this.enforceTablePermission(res, session, 'SKILLS', 'READ_WRITE')) {
        this.deps.sendJson(res, 200, await this.deps.skillsController.updateSkillTemplate(Number(skillMatch[1]), await this.deps.readJsonBody(req)));
      }
      return true;
    }
    if (skillMatch && method === 'DELETE') {
      if (this.enforceTablePermission(res, session, 'SKILLS', 'READ_WRITE')) {
        this.deps.sendJson(res, 200, await this.deps.skillsController.deleteSkillTemplate(Number(skillMatch[1])));
      }
      return true;
    }
    const autoLinkMatch = pathname.match(/^\/api\/admin\/skill-templates\/(\d+)\/auto-link-monsters$/);
    if (autoLinkMatch && method === 'POST') {
      if (this.enforceTablePermission(res, session, 'SKILLS', 'READ_WRITE')) {
        this.deps.sendJson(res, 200, await this.deps.skillsController.autoLinkSkillToMonsters(Number(autoLinkMatch[1]), (await this.deps.readJsonBody(req))?.elementCode));
      }
      return true;
    }

    // --- Rotas do Estúdio Visual No-Code de Quests (`quest_templates`) ---
    if (pathname === '/api/admin/quest-templates' && method === 'GET') {
      if (this.enforceTablePermission(res, session, 'QUESTS', 'READ')) {
        this.deps.sendJson(res, 200, await this.deps.questsController.getQuestTemplates());
      }
      return true;
    }
    if (pathname === '/api/admin/quest-templates' && method === 'POST') {
      if (this.enforceTablePermission(res, session, 'QUESTS', 'READ_WRITE')) {
        this.deps.sendJson(res, 201, await this.deps.questsController.saveQuestTemplate(await this.deps.readJsonBody(req), null));
      }
      return true;
    }
    const questMatch = pathname.match(/^\/api\/admin\/quest-templates\/(\d+)$/);
    if (questMatch && method === 'PUT') {
      if (this.enforceTablePermission(res, session, 'QUESTS', 'READ_WRITE')) {
        this.deps.sendJson(res, 200, await this.deps.questsController.saveQuestTemplate(await this.deps.readJsonBody(req), Number(questMatch[1])));
      }
      return true;
    }
    if (questMatch && method === 'DELETE') {
      if (this.enforceTablePermission(res, session, 'QUESTS', 'READ_WRITE')) {
        this.deps.sendJson(res, 200, await this.deps.questsController.deleteQuestTemplate(Number(questMatch[1])));
      }
      return true;
    }

    // --- Rotas de Atributos Base, Combate & Matriz de Conversão Procedural ---
    if (pathname === '/api/admin/attributes' && method === 'GET') {
      if (this.enforceTablePermission(res, session, 'ATTRIBUTES', 'READ')) {
        this.deps.sendJson(res, 200, await this.deps.attributesController.getAttributesData());
      }
      return true;
    }
    if (pathname === '/api/admin/attributes/conversions' && method === 'PUT') {
      if (this.enforceTablePermission(res, session, 'ATTRIBUTES', 'READ_WRITE')) {
        this.deps.sendJson(res, 200, await this.deps.attributesController.batchUpdateConversions(await this.deps.readJsonBody(req)));
      }
      return true;
    }
    if (pathname === '/api/admin/attributes/conversions/single' && method === 'PUT') {
      if (this.enforceTablePermission(res, session, 'ATTRIBUTES', 'READ_WRITE')) {
        this.deps.sendJson(res, 200, await this.deps.attributesController.updateConversion(await this.deps.readJsonBody(req)));
      }
      return true;
    }
    const combatAttrMatch = pathname.match(/^\/api\/admin\/attributes\/combat\/([a-zA-Z0-9_]+)$/);
    if (combatAttrMatch && method === 'PUT') {
      if (this.enforceTablePermission(res, session, 'ATTRIBUTES', 'READ_WRITE')) {
        this.deps.sendJson(res, 200, await this.deps.attributesController.updateCombatAttribute(combatAttrMatch[1], await this.deps.readJsonBody(req)));
      }
      return true;
    }

    // --- Níveis e Progressão de Experiência (XP) Procedural & Brackets ---
    if (pathname === '/api/admin/experience' && method === 'GET') {
      const bracket = urlObj.searchParams.get('bracket');
      if (this.enforceTablePermission(res, session, 'ATTRIBUTES', 'READ')) {
        this.deps.sendJson(res, 200, await this.deps.experienceController.getLevelExperienceTemplates(bracket ? Number(bracket) : undefined));
      }
      return true;
    }
    if (pathname === '/api/admin/experience/procedural' && method === 'POST') {
      if (this.enforceTablePermission(res, session, 'ATTRIBUTES', 'READ_WRITE')) {
        this.deps.sendJson(res, 200, await this.deps.experienceController.generateProceduralCurve(await this.deps.readJsonBody(req)));
      }
      return true;
    }
    const bracketMatch = pathname.match(/^\/api\/admin\/experience\/bracket\/(\d+)$/);
    if (bracketMatch && method === 'PUT') {
      if (this.enforceTablePermission(res, session, 'ATTRIBUTES', 'READ_WRITE')) {
        this.deps.sendJson(res, 200, await this.deps.experienceController.updateBracketGroup(Number(bracketMatch[1]), await this.deps.readJsonBody(req)));
      }
      return true;
    }
    const levelMatch = pathname.match(/^\/api\/admin\/experience\/(\d+)$/);
    if (levelMatch && method === 'PUT') {
      if (this.enforceTablePermission(res, session, 'ATTRIBUTES', 'READ_WRITE')) {
        this.deps.sendJson(res, 200, await this.deps.experienceController.updateSingleLevel(Number(levelMatch[1]), await this.deps.readJsonBody(req)));
      }
      return true;
    }

    this.deps.sendJson(res, 404, { error: 'Rota da API Admin não encontrada.' });
    return true;
  }
}
