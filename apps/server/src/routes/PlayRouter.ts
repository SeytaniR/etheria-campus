/**
 * @file apps/server/src/routes/PlayRouter.ts
 * @module @etheria/server/routes/PlayRouter
 * @description Roteador seguro para endpoints do jogador e GM (`/api/play/*`).
 *   Gerencia autenticação de sessão dos jogadores, mitigação contra BOLA/IDOR (validação estrita
 *   de posse de personagem), teleporte, sincronização de posição, missões e instâncias de combate.
 * @rules Segue estritamente AGENTS.md (Cláusula 0 de Segurança, Regra #7 de modularidade e Cláusula 0.2).
 * @dependencies node:http, @etheria/database, ../security/AdminAuthService.js, ../security/RateLimiter.js, ./PartyRouter.js, ./PlayCombatRouter.js, controllers Play/*
 */

import type * as http from 'node:http';
import { I18nCache, SUPPORTED_LOCALES, type PrismaClient } from '@etheria/database';
import type { AdminAuthService } from '../security/AdminAuthService.js';
import type { GamePlayController } from '../controllers/GamePlayController.js';
import type { TemporaryCombatController, CombatUnit } from '../controllers/TemporaryCombatController.js';
import type { AdminQuestsController } from '../controllers/AdminQuestsController.js';
import type { AssetMirrorService } from '../controllers/AssetMirrorService.js';
import { CharacterEquipmentService } from '../controllers/CharacterEquipmentService.js';
import { CharacterInventoryService } from '../controllers/CharacterInventoryService.js';
import { MonsterCombatBuilder, type QuestBattleConfigDto } from '../controllers/MonsterCombatBuilder.js';
import { ItemContainerOpeningService } from '../controllers/ItemContainerOpeningService.js';
import { CharacterPetService } from '../controllers/CharacterPetService.js';
import { HunterPetController } from '../controllers/HunterPetController.js';
import { QuestStepActionService } from '../controllers/QuestStepActionService.js';
import { DungeonService } from '../controllers/DungeonService.js';
import { DungeonChestService } from '../controllers/DungeonChestService.js';
import { GmSandboxService } from '../controllers/GmSandboxService.js';
import { CharacterProgressionService } from '../controllers/CharacterProgressionService.js';
import { GameChatService } from '../controllers/GameChatService.js';
import { MapPresenceService } from '../controllers/MapPresenceService.js';
import { PartyService } from '../controllers/PartyService.js';
import { FishingService } from '../controllers/FishingService.js';
import { GameEventsService } from '../controllers/GameEventsService.js';
import { PartyRouter } from './PartyRouter.js';
import { PlayCombatRouter } from './PlayCombatRouter.js';
import { RateLimiter } from '../security/RateLimiter.js';

export interface PlayRouterDeps {
  prisma: PrismaClient;
  authService: AdminAuthService;
  playController: GamePlayController;
  combatController: TemporaryCombatController;
  questsController: AdminQuestsController;
  assetMirrorService: AssetMirrorService;
  sendJson: (res: http.ServerResponse, statusCode: number, data: unknown) => void;
  readJsonBody: <T = any>(req: http.IncomingMessage, maxBytes?: number) => Promise<T>;
}

export class PlayRouter {
  private readonly partyRouter: PartyRouter;
  private readonly combatRouter: PlayCombatRouter;
  private readonly rateLimiter = new RateLimiter();

  constructor(private readonly deps: PlayRouterDeps) {
    this.partyRouter = new PartyRouter({
      prisma: deps.prisma,
      readJsonBody: deps.readJsonBody,
      sendJson: deps.sendJson,
      verifyCharacterOwnership: (uid, r, cid) => this.verifyCharacterOwnership(uid, r, cid),
    });
    this.combatRouter = new PlayCombatRouter({
      prisma: deps.prisma,
      combatController: deps.combatController,
      questsController: deps.questsController,
      sendJson: deps.sendJson,
      readJsonBody: deps.readJsonBody,
      verifyCharacterOwnership: (uid, r, cid) => this.verifyCharacterOwnership(uid, r, cid),
    });
  }

  /**
   * Valida se um personagem pertence à conta autenticada (ou se o usuário é ADMIN/GM).
   * Previne vulnerabilidades BOLA/IDOR onde um jogador manipula IDs alheios.
   */
  public async verifyCharacterOwnership(userAccountId: number, role: string, charId: number): Promise<boolean> {
    if (['ADMIN', 'GM', 'DEV'].includes(role)) return true;
    const char = await this.deps.prisma.playerCharacter.findUnique({
      where: { id: charId },
      select: { userAccountId: true },
    });
    return Boolean(char && char.userAccountId === userAccountId);
  }

  /**
   * Processa requisições HTTP para a rota `/api/play/*`.
   * Retorna `true` caso a requisição tenha sido atendida por este roteador, ou `false` caso pertença a outro domínio.
   */
  public async handle(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    pathname: string,
    method: string,
    urlObj: URL
  ): Promise<boolean> {
    if (!pathname.startsWith('/api/play/')) {
      return false;
    }

    // 1. Endpoint de Login da Rota /play (Rate-limited contra brute-force)
    if (pathname === '/api/play/auth/login' && method === 'POST') {
      const clientIp = RateLimiter.getClientIp(req);
      const rl = this.rateLimiter.consume(`play_login:${clientIp}`, 10, 60_000);
      if (!rl.allowed) {
        this.deps.sendJson(res, 429, {
          error: `Muitas tentativas de login. Aguarde ${rl.retryAfterSec}s e tente novamente.`,
        });
        return true;
      }
      const body = await this.deps.readJsonBody<{ username?: string; password?: string }>(req);
      const result = await this.deps.authService.authenticatePlay(
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

    // 1.1 Manifesto público de download local de assets
    if (pathname === '/api/play/assets-manifest' && method === 'GET') {
      const manifest = await this.deps.assetMirrorService.buildPlayAssetsManifest(this.deps.prisma);
      this.deps.sendJson(res, 200, manifest);
      return true;
    }

    // 1.2 Mapas Gerais / Mundo dos Continentes (Público / Não requer sessão para visualização rápida)
    if (pathname === '/api/play/world-maps' && method === 'GET') {
      const worldMaps = await this.deps.prisma.worldMapTemplate.findMany({
        where: { isActive: true },
        orderBy: { id: 'asc' },
      });
      this.deps.sendJson(res, 200, { worldMaps });
      return true;
    }

    // 2. Proteção de Sessão JWT para jogadores
    const session = this.deps.authService.verifyPlayToken(req);
    if (!session) {
      this.deps.sendJson(res, 401, { error: 'Sessão expirada ou não autenticada. Faça login em /play.' });
      return true;
    }

    const userAccountId = Number(session.sub);
    // VULN-01 Fix: Rejeita imediatamente tokens com subject inválido sem qualquer fallback silencioso para ADMIN
    if (!Number.isInteger(userAccountId) || userAccountId <= 0) {
      this.deps.sendJson(res, 401, { error: 'Token de sessão inválido. Faça login em /play.' });
      return true;
    }

    // 👥 Roteador de Equipes (Parties de até 3 Jogadores)
    if (pathname.startsWith('/api/play/party')) {
      return await this.partyRouter.handle(req, res, pathname, method, { userAccountId, role: session.role });
    }

    // --- Bootstrap do Jogo (Personagens do Usuário, Mapas, Classes e Offset) ---
    if (pathname === '/api/play/bootstrap' && method === 'GET') {
      const [data, account] = await Promise.all([
        this.deps.playController.getPlayBootstrap(userAccountId),
        this.deps.prisma.userAccount.findUnique({
          where: { id: userAccountId },
          select: { locale: true },
        }),
      ]);
      this.deps.sendJson(res, 200, {
        session: {
          userAccountId,
          username: session.username,
          role: session.role,
          locale: I18nCache.normalizeLocale(account?.locale),
          activeLocale: I18nCache.getCurrentLocale(),
        },
        ...data,
      });
      return true;
    }

    // --- Preferência Persistente de Idioma do Jogador Autenticado ---
    if (pathname === '/api/play/locale' && method === 'POST') {
      const body = await this.deps.readJsonBody<{ locale?: string }>(req);
      if (!body.locale || !I18nCache.isSupportedLocaleInput(body.locale)) {
        this.deps.sendJson(res, 400, {
          error: 'Idioma não suportado. Use pt-BR, en-US ou es-ES.',
          supportedLocales: [...SUPPORTED_LOCALES],
        });
        return true;
      }
      const normalized = I18nCache.normalizeLocale(body.locale);
      await this.deps.prisma.userAccount.update({
        where: { id: userAccountId },
        data: { locale: normalized },
      });
      this.deps.sendJson(res, 200, { ok: true, locale: normalized });
      return true;
    }

    // --- Criação e Deleção de Personagens ---
    if (pathname === '/api/play/characters' && method === 'POST') {
      const dto = await this.deps.readJsonBody(req);
      this.deps.sendJson(res, 201, await this.deps.playController.createCharacter(userAccountId, dto));
      return true;
    }

    const charByIdMatch = pathname.match(/^\/api\/play\/characters\/(\d+)$/);
    if (charByIdMatch && method === 'GET') {
      const charId = Number(charByIdMatch[1]);
      if (!(await this.verifyCharacterOwnership(userAccountId, session.role, charId))) {
        this.deps.sendJson(res, 403, { error: 'Acesso negado: este personagem não pertence à sua conta.' });
        return true;
      }
      this.deps.sendJson(res, 200, await this.deps.playController.getCharacterById(userAccountId, session.role, charId));
      return true;
    }
    if (charByIdMatch && method === 'DELETE') {
      const charId = Number(charByIdMatch[1]);
      this.deps.sendJson(res, 200, await this.deps.playController.deleteCharacter(userAccountId, charId));
      return true;
    }

    // --- Gerenciamento Autoritário de Equipamentos do Jogador ---
    const charEquipDetailsMatch = pathname.match(/^\/api\/play\/characters\/(\d+)\/equipment$/);
    if (charEquipDetailsMatch && method === 'GET') {
      const charId = Number(charEquipDetailsMatch[1]);
      if (!(await this.verifyCharacterOwnership(userAccountId, session.role, charId))) {
        this.deps.sendJson(res, 403, { error: 'Acesso negado: este personagem não pertence à sua conta.' });
        return true;
      }
      this.deps.sendJson(res, 200, await CharacterEquipmentService.getCharacterEquippedDetails(this.deps.prisma, charId));
      return true;
    }

    const charEquipItemMatch = pathname.match(/^\/api\/play\/characters\/(\d+)\/equipment\/equip$/);
    if (charEquipItemMatch && method === 'POST') {
      const charId = Number(charEquipItemMatch[1]);
      const body = await this.deps.readJsonBody<{ itemTemplateId: number; slotCode?: string }>(req);
      const result = await CharacterEquipmentService.equipItem(this.deps.prisma, userAccountId, session.role, charId, Number(body.itemTemplateId), body.slotCode);
      const questSync = await this.deps.questsController.syncEquipObjectivesForCharacter(charId).catch(() => null);
      this.deps.sendJson(res, 200, { ...result, questSync });
      return true;
    }

    const charUnequipItemMatch = pathname.match(/^\/api\/play\/characters\/(\d+)\/equipment\/unequip$/);
    if (charUnequipItemMatch && method === 'POST') {
      const charId = Number(charUnequipItemMatch[1]);
      const body = await this.deps.readJsonBody<{ slotCode: string }>(req);
      const result = await CharacterEquipmentService.unequipItem(
        this.deps.prisma,
        userAccountId,
        session.role,
        charId,
        body.slotCode
      );
      if (String(body.slotCode || '').trim().toUpperCase() === 'FISHING_ROD') {
        FishingService.stopSession(charId);
      }
      this.deps.sendJson(res, 200, result);
      return true;
    }

    // --- Distribuição Autoritária de Pontos de Atributos Base (Regra Sagrada: 5 pts por Level Up) ---
    const charDistributeStatsMatch = pathname.match(/^\/api\/play\/characters\/(\d+)\/distribute-stats$/);
    if (charDistributeStatsMatch && method === 'POST') {
      const charId = Number(charDistributeStatsMatch[1]);
      if (!(await this.verifyCharacterOwnership(userAccountId, session.role, charId))) {
        this.deps.sendJson(res, 403, { error: 'Acesso negado: este personagem não pertence à sua conta.' });
        return true;
      }
      const body = await this.deps.readJsonBody<{
        attribute?: string;
        points?: number;
        allocations?: Record<string, number>;
      }>(req);

      const VALID_ATTRS = ['VIT', 'STR', 'INT', 'WIS', 'AGI', 'DEX'];
      const allocationsToApply: Record<string, number> = {};

      if (body.allocations && typeof body.allocations === 'object') {
        for (const [rawAttr, rawPts] of Object.entries(body.allocations)) {
          const attr = String(rawAttr || '').toUpperCase();
          const pts = Number(rawPts) || 0;
          if (pts > 0) {
            if (!VALID_ATTRS.includes(attr)) {
              this.deps.sendJson(res, 400, { error: `Atributo inválido: "${attr}". Escolha entre VIT, STR, INT, WIS, AGI ou DEX.` });
              return true;
            }
            allocationsToApply[attr] = (allocationsToApply[attr] || 0) + pts;
          }
        }
      } else if (body.attribute) {
        const attr = String(body.attribute || '').toUpperCase();
        const points = Math.max(1, Number(body.points) || 1);
        if (!VALID_ATTRS.includes(attr)) {
          this.deps.sendJson(res, 400, { error: 'Atributo inválido. Escolha entre VIT, STR, INT, WIS, AGI ou DEX.' });
          return true;
        }
        allocationsToApply[attr] = points;
      }

      const totalRequested = Object.values(allocationsToApply).reduce((sum, p) => sum + p, 0);
      if (totalRequested <= 0) {
        this.deps.sendJson(res, 400, { error: 'Nenhum ponto válido especificado para distribuição.' });
        return true;
      }

      try {
        const result = await this.deps.prisma.$transaction(async (tx) => {
          const dec = await tx.playerCharacter.updateMany({
            where: {
              id: charId,
              unspentStatPoints: { gte: totalRequested },
            },
            data: {
              unspentStatPoints: { decrement: totalRequested },
            },
          });

          if (dec.count === 0) {
            return null;
          }

          const pc = await tx.playerCharacter.findUnique({ where: { id: charId } });
          if (!pc) {
            throw new Error('Personagem não encontrado.');
          }

          const dist = (pc.distributedStatsJson && typeof pc.distributedStatsJson === 'object'
            ? { ...(pc.distributedStatsJson as Record<string, number>) }
            : { VIT: 0, STR: 0, INT: 0, WIS: 0, AGI: 0, DEX: 0 }) as Record<string, number>;

          for (const [attr, pts] of Object.entries(allocationsToApply)) {
            dist[attr] = (Number(dist[attr]) || 0) + pts;
          }

          return await tx.playerCharacter.update({
            where: { id: charId },
            data: { distributedStatsJson: dist },
            select: { unspentStatPoints: true, distributedStatsJson: true },
          });
        });

        if (!result) {
          this.deps.sendJson(res, 400, {
            error: `Pontos insuficientes para distribuir (Solicitados: ${totalRequested}).`,
          });
          return true;
        }

        this.deps.sendJson(res, 200, {
          success: true,
          unspentStatPoints: result.unspentStatPoints,
          distributedStatsJson: result.distributedStatsJson,
        });
      } catch (err: any) {
        this.deps.sendJson(res, 400, { error: err?.message || 'Erro ao distribuir pontos.' });
      }
      return true;
    }

    // --- Estado do Mapa para Exploração em Tempo Real ---
    const playMapMatch = pathname.match(/^\/api\/play\/map\/(\d+)$/);
    if (playMapMatch && method === 'GET') {
      const mapId = Number(playMapMatch[1]);
      this.deps.sendJson(res, 200, await this.deps.playController.getMapStateForPlay(mapId));
      return true;
    }

    // --- Movimentação, Presença Multiplayer em Tempo Real, Portais e Desengasgo ---
    const syncPosMatch = pathname.match(/^\/api\/play\/characters\/(\d+)\/sync-position$/);
    if (syncPosMatch && method === 'POST') {
      const charId = Number(syncPosMatch[1]);
      const dto = await this.deps.readJsonBody<any>(req);
      const syncResult = await this.deps.playController.syncPosition(userAccountId, session.role, charId, dto);

      const otherPlayers = await MapPresenceService.updatePresence(this.deps.prisma, charId, {
        mapId: Number(dto.mapId) || (syncResult as any).currentMapId || 1,
        posX: Number((syncResult as any).posX ?? dto.posX),
        posY: Number((syncResult as any).posY ?? dto.posY),
        dir: dto.dir,
        isMoving: dto.isMoving,
        isInCombat: dto.isInCombat,
        isFlying: dto.isFlying,
        flightAltitude: dto.flightAltitude,
      });

      const party = PartyService.getPartyByCharacterId(charId);
      const pendingInvites = PartyService.getPendingInvites(charId);

      this.deps.sendJson(res, 200, {
        ...syncResult,
        otherPlayers,
        party: party || null,
        pendingInvites,
      });
      return true;
    }

    const respawnMatch = pathname.match(/^\/api\/play\/characters\/(\d+)\/respawn$/);
    if (respawnMatch && method === 'POST') {
      const charId = Number(respawnMatch[1]);
      if (!(await this.verifyCharacterOwnership(userAccountId, session.role, charId))) {
        this.deps.sendJson(res, 403, { error: 'Acesso negado: personagem não pertence à sua conta.' });
        return true;
      }
      try {
        const respawnData = await MapPresenceService.respawnCharacter(this.deps.prisma, userAccountId, charId);
        this.deps.sendJson(res, 200, respawnData);
      } catch (err: any) {
        this.deps.sendJson(res, 400, { error: err.message || 'Erro ao processar respawn.' });
      }
      return true;
    }

    const traverseMatch = pathname.match(/^\/api\/play\/characters\/(\d+)\/traverse-portal$/);
    if (traverseMatch && method === 'POST') {
      const charId = Number(traverseMatch[1]);
      if (!(await this.verifyCharacterOwnership(userAccountId, session.role, charId))) {
        this.deps.sendJson(res, 403, { error: 'Acesso negado: personagem não pertence à sua conta.' });
        return true;
      }
      MapPresenceService.removePlayer(charId);
      const dto = await this.deps.readJsonBody<{ portalId: number }>(req);
      const travelResult = await this.deps.playController.traversePortal(userAccountId, charId, Number(dto.portalId));

      // Se for Líder de equipe, sincroniza o mapa para os seguidores na fila indiana
      const party = PartyService.getPartyByCharacterId(charId);
      if (party && party.leaderCharacterId === charId && (travelResult as any)?.currentMapId) {
        PartyService.syncLeaderMapChange(
          charId,
          Number((travelResult as any).currentMapId),
          Number((travelResult as any).posX ?? 500),
          Number((travelResult as any).posY ?? 500)
        );
      }

      this.deps.sendJson(res, 200, travelResult);
      return true;
    }

    const unstuckMatch = pathname.match(/^\/api\/play\/characters\/(\d+)\/unstuck$/);
    if (unstuckMatch && method === 'POST') {
      const charId = Number(unstuckMatch[1]);
      if (!(await this.verifyCharacterOwnership(userAccountId, session.role, charId))) {
        this.deps.sendJson(res, 403, { error: 'Acesso negado: personagem não pertence à sua conta.' });
        return true;
      }
      MapPresenceService.removePlayer(charId);
      this.deps.sendJson(res, 200, await this.deps.playController.unstuckCharacter(userAccountId, charId));
      return true;
    }

    // --- Ferramentas Administrativas & GM in-game ---
    const gmTeleportMatch = pathname.match(/^\/api\/play\/characters\/(\d+)\/gm-teleport$/);
    if (gmTeleportMatch && method === 'POST') {
      const charId = Number(gmTeleportMatch[1]);
      const dto = await this.deps.readJsonBody(req);
      this.deps.sendJson(
        res,
        200,
        await this.deps.playController.gmTeleport(userAccountId, session.role, charId, dto)
      );
      return true;
    }

    const toggleRebornMatch = pathname.match(/^\/api\/play\/characters\/(\d+)\/toggle-reborn$/);
    if (toggleRebornMatch && method === 'POST') {
      const charId = Number(toggleRebornMatch[1]);
      this.deps.sendJson(
        res,
        200,
        await this.deps.playController.toggleReborn(userAccountId, session.role, charId)
      );
      return true;
    }

    const groundOffsetMatch = pathname.match(/^\/api\/play\/characters\/(\d+)\/ground-offset$/);
    if (groundOffsetMatch && method === 'POST') {
      const charId = Number(groundOffsetMatch[1]);
      const body = await this.deps.readJsonBody<{ offset?: number }>(req);
      this.deps.sendJson(
        res,
        200,
        await this.deps.playController.updateClassGroundOffset(userAccountId, session.role, charId, Number(body.offset) || 0)
      );
      return true;
    }

    // 🎒 Carteira de Ouro & Mochila Básica (Base Inicial Incompleta para Quests)
    const charInventoryMatch = pathname.match(/^\/api\/play\/characters\/(\d+)\/inventory$/);
    if (charInventoryMatch && method === 'GET') {
      const charId = Number(charInventoryMatch[1]);
      if (!(await this.verifyCharacterOwnership(userAccountId, session.role, charId))) {
        this.deps.sendJson(res, 403, { error: 'Acesso negado: este personagem não pertence à sua conta.' });
        return true;
      }
      this.deps.sendJson(res, 200, await this.deps.playController.getCharacterInventory(charId));
      return true;
    }

    // 🎒 Mover ou Trocar Slots no Inventário (Drag & Drop / Swap / Merge)
    const charInvMoveMatch = pathname.match(/^\/api\/play\/characters\/(\d+)\/inventory\/move$/);
    if (charInvMoveMatch && method === 'POST') {
      const charId = Number(charInvMoveMatch[1]);
      if (!(await this.verifyCharacterOwnership(userAccountId, session.role, charId))) {
        this.deps.sendJson(res, 403, { error: 'Acesso negado: este personagem não pertence à sua conta.' });
        return true;
      }
      const body = await this.deps.readJsonBody<{ fromSlot: number; toSlot: number }>(req);
      try {
        const bag = await CharacterInventoryService.moveOrSwapSlot(
          this.deps.prisma,
          charId,
          Number(body.fromSlot),
          Number(body.toSlot)
        );
        this.deps.sendJson(res, 200, bag);
      } catch (err: any) {
        this.deps.sendJson(res, 400, { error: err.message || 'Erro ao mover item.' });
      }
      return true;
    }

    // ✂️ Dividir Pilha de Itens Acumuláveis (Split Stack)
    const charInvSplitMatch = pathname.match(/^\/api\/play\/characters\/(\d+)\/inventory\/split$/);
    if (charInvSplitMatch && method === 'POST') {
      const charId = Number(charInvSplitMatch[1]);
      if (!(await this.verifyCharacterOwnership(userAccountId, session.role, charId))) {
        this.deps.sendJson(res, 403, { error: 'Acesso negado: este personagem não pertence à sua conta.' });
        return true;
      }
      const body = await this.deps.readJsonBody<{ fromSlot: number; splitQuantity: number; targetSlot?: number }>(req);
      try {
        const bag = await CharacterInventoryService.splitStack(
          this.deps.prisma,
          charId,
          Number(body.fromSlot),
          Number(body.splitQuantity),
          body.targetSlot !== undefined ? Number(body.targetSlot) : undefined
        );
        this.deps.sendJson(res, 200, bag);
      } catch (err: any) {
        this.deps.sendJson(res, 400, { error: err.message || 'Erro ao dividir stack.' });
      }
      return true;
    }

    // 🔄 Organização Automática da Mochila (Auto-Sort)
    const charInvSortMatch = pathname.match(/^\/api\/play\/characters\/(\d+)\/inventory\/sort$/);
    if (charInvSortMatch && method === 'POST') {
      const charId = Number(charInvSortMatch[1]);
      if (!(await this.verifyCharacterOwnership(userAccountId, session.role, charId))) {
        this.deps.sendJson(res, 403, { error: 'Acesso negado: este personagem não pertence à sua conta.' });
        return true;
      }
      try {
        const bag = await CharacterInventoryService.autoSort(this.deps.prisma, charId);
        this.deps.sendJson(res, 200, bag);
      } catch (err: any) {
        this.deps.sendJson(res, 400, { error: err.message || 'Erro ao organizar mochila.' });
      }
      return true;
    }

    // 🗑️ Exclusão / Destruição de Item do Slot
    const charInvDeleteSlotMatch = pathname.match(/^\/api\/play\/characters\/(\d+)\/inventory\/slots\/(\d+)$/);
    if (charInvDeleteSlotMatch && method === 'DELETE') {
      const charId = Number(charInvDeleteSlotMatch[1]);
      const slotIndex = Number(charInvDeleteSlotMatch[2]);
      if (!(await this.verifyCharacterOwnership(userAccountId, session.role, charId))) {
        this.deps.sendJson(res, 403, { error: 'Acesso negado: este personagem não pertence à sua conta.' });
        return true;
      }
      try {
        const bag = await CharacterInventoryService.deleteSlotItem(this.deps.prisma, charId, slotIndex);
        this.deps.sendJson(res, 200, bag);
      } catch (err: any) {
        this.deps.sendJson(res, 400, { error: err.message || 'Erro ao excluir item do slot.' });
      }
      return true;
    }

    // 🐾 Gestão Procedural de Pets (Geração, 76+4/lv Atributos, Slots 1..3 e 3 Habilidades Livres)
    if (await CharacterPetService.handlePlayPetsRoute(req, res, pathname, method, this.deps.prisma, (cId) => this.verifyCharacterOwnership(userAccountId, session.role, cId), this.deps.readJsonBody, this.deps.sendJson)) {
      return true;
    }

    // 🏹 Função de Caçador (Geração de Pets por Essências e Custos de Raridade)
    if (await HunterPetController.handlePlayHunterRoute(req, res, pathname, method, this.deps.prisma, (cId) => this.verifyCharacterOwnership(userAccountId, session.role, cId), this.deps.readJsonBody, this.deps.sendJson)) {
      return true;
    }
    // 🏰 Sistema de Dungeons Instanciadas (1x ao dia) & Arsenal GM Sandbox
    if (await DungeonService.handlePlayDungeonRoute(req, res, pathname, method, session.role, this.deps.prisma, this.deps.combatController, this.deps.assetMirrorService, (cId) => this.verifyCharacterOwnership(userAccountId, session.role, cId), this.deps.readJsonBody, this.deps.sendJson)) return true;
    if (await GmSandboxService.handleRoute(req, res, pathname, method, userAccountId, session.role, this.deps.prisma, this.deps.playController, this.deps.readJsonBody, this.deps.sendJson)) return true;
    if (await QuestStepActionService.handlePlayQuestStepRoute(req, res, pathname, method, urlObj, this.deps.questsController, (cId) => this.verifyCharacterOwnership(userAccountId, session.role, cId), this.deps.readJsonBody, this.deps.sendJson)) return true;

    // 🎁 Abertura Autoritária de Baú / Cápsula / Roleta da Sorte
    const charOpenContainerMatch = pathname.match(/^\/api\/play\/characters\/(\d+)\/items\/open-container$/);
    if (charOpenContainerMatch && method === 'POST') {
      const charId = Number(charOpenContainerMatch[1]);
      if (!(await this.verifyCharacterOwnership(userAccountId, session.role, charId))) {
        this.deps.sendJson(res, 403, { error: 'Acesso negado: este personagem não pertence à sua conta.' });
        return true;
      }
      const body = await this.deps.readJsonBody<{ itemTemplateId: number }>(req);
      try {
        const result = await ItemContainerOpeningService.openContainer(this.deps.prisma, charId, Number(body.itemTemplateId));
        this.deps.sendJson(res, 200, result);
      } catch (err: any) {
        this.deps.sendJson(res, 400, { error: err.message || 'Erro ao abrir item.' });
      }
      return true;
    }

    // 💬 Chat Multi-Canal (Sistema, Mundo, Local, Guilda, Facção, Equipe)
    if (pathname === '/api/play/chat/messages' && method === 'GET') {
      const sinceId = urlObj.searchParams.get('sinceId') ? Number(urlObj.searchParams.get('sinceId')) : undefined;
      const charId = urlObj.searchParams.get('charId') ? Number(urlObj.searchParams.get('charId')) : undefined;
      let mapId = urlObj.searchParams.get('mapId') ? Number(urlObj.searchParams.get('mapId')) : undefined;
      let teamId: string | undefined;

      if (charId) {
        if (!(await this.verifyCharacterOwnership(userAccountId, session.role, charId))) {
          this.deps.sendJson(res, 403, { error: 'Acesso negado: personagem não pertence à sua conta.' });
          return true;
        }
        const pc = await this.deps.prisma.playerCharacter.findUnique({
          where: { id: charId },
          select: { currentMapId: true },
        });
        if (pc?.currentMapId) mapId = pc.currentMapId;
        const p = PartyService.getPartyByCharacterId(charId);
        if (p) teamId = p.id;
      }

      // Ignora guildId, factionId e teamId vindos da query string do cliente (anti-IDOR)
      const messages = GameChatService.getMessages({ sinceId, mapId, teamId });
      this.deps.sendJson(res, 200, { success: true, messages });
      return true;
    }

    if (pathname === '/api/play/chat/send' && method === 'POST') {
      const rl = this.rateLimiter.consume(`play_chat:${userAccountId}`, 15, 30_000);
      if (!rl.allowed) {
        this.deps.sendJson(res, 429, {
          error: `Chat em cooldown. Aguarde ${rl.retryAfterSec}s antes de enviar outra mensagem.`,
        });
        return true;
      }
      const body = await this.deps.readJsonBody<{
        channel: string;
        message: string;
        charId: number;
        mapId?: number;
      }>(req);
      const charId = Number(body.charId);
      if (!charId || !(await this.verifyCharacterOwnership(userAccountId, session.role, charId))) {
        this.deps.sendJson(res, 403, { error: 'Acesso negado: personagem inválido ou não pertence à sua conta.' });
        return true;
      }

      try {
        const msg = await GameChatService.sendMessage(this.deps.prisma, {
          category: (body.channel || 'MUNDO').toUpperCase() as any,
          text: String(body.message || ''),
          senderCharacterId: charId,
          clientMapId: body.mapId ? Number(body.mapId) : undefined,
        });
        this.deps.sendJson(res, 200, { success: true, message: msg });
      } catch (err: any) {
        this.deps.sendJson(res, 400, { error: err.message || 'Erro ao enviar mensagem no chat.' });
      }
      return true;
    }

    // 📜 Rotas de Quests / Missões do Jogador com Mitigação BOLA/IDOR
    const charQuestsMatch = pathname.match(/^\/api\/play\/characters\/(\d+)\/quests$/);
    if (charQuestsMatch && method === 'GET') {
      const charId = Number(charQuestsMatch[1]);
      if (!(await this.verifyCharacterOwnership(userAccountId, session.role, charId))) {
        this.deps.sendJson(res, 403, { error: 'Acesso negado: este personagem não pertence à sua conta.' });
        return true;
      }
      const mapId = urlObj.searchParams.get('mapId') ? Number(urlObj.searchParams.get('mapId')) : null;
      this.deps.sendJson(res, 200, await this.deps.questsController.getCharacterQuestState(charId, mapId));
      return true;
    }

    const acceptQuestMatch = pathname.match(/^\/api\/play\/characters\/(\d+)\/quests(?:\/(\d+))?\/accept$/);
    if (acceptQuestMatch && method === 'POST') {
      const charId = Number(acceptQuestMatch[1]);
      if (!(await this.verifyCharacterOwnership(userAccountId, session.role, charId))) {
        this.deps.sendJson(res, 403, { error: 'Acesso negado: este personagem não pertence à sua conta.' });
        return true;
      }
      const body = await this.deps.readJsonBody<{ questTemplateId?: number; mapId?: number | null }>(req);
      const questId = Number(acceptQuestMatch[2] || body.questTemplateId);
      this.deps.sendJson(
        res,
        200,
        await this.deps.questsController.acceptQuest(charId, questId, body.mapId ?? null)
      );
      return true;
    }

    const interactNpcQuestMatch = pathname.match(/^\/api\/play\/characters\/(\d+)\/quests\/interact-npc$/);
    if (interactNpcQuestMatch && method === 'POST') {
      const charId = Number(interactNpcQuestMatch[1]);
      if (!(await this.verifyCharacterOwnership(userAccountId, session.role, charId))) {
        this.deps.sendJson(res, 403, { error: 'Acesso negado: este personagem não pertence à sua conta.' });
        return true;
      }
      const body = await this.deps.readJsonBody<{ npcTemplateId: number; mapId?: number | null }>(req);
      this.deps.sendJson(
        res,
        200,
        await this.deps.questsController.interactNpcForQuest(charId, Number(body.npcTemplateId), body.mapId ?? null)
      );
      return true;
    }

    const turnInQuestMatch = pathname.match(/^\/api\/play\/characters\/(\d+)\/quests(?:\/(\d+))?\/(?:turn-in|claim-meta)$/);
    if (turnInQuestMatch && method === 'POST') {
      const charId = Number(turnInQuestMatch[1]);
      if (!(await this.verifyCharacterOwnership(userAccountId, session.role, charId))) {
        this.deps.sendJson(res, 403, { error: 'Acesso negado: este personagem não pertence à sua conta.' });
        return true;
      }
      const body = await this.deps.readJsonBody<{ questTemplateId?: number; mapId?: number | null }>(req);
      const questId = Number(turnInQuestMatch[2] || body.questTemplateId);
      this.deps.sendJson(
        res,
        200,
        await this.deps.questsController.turnInQuest(charId, questId, body.mapId ?? null)
      );
      return true;
    }

    // 🎣 Sistema Autoritário de Pesca Contínua (AFK)
    if (pathname === '/api/play/fishing/status' && method === 'GET') {
      const charId = Number(urlObj.searchParams.get('characterId'));
      if (!charId || !(await this.verifyCharacterOwnership(userAccountId, session.role, charId))) {
        this.deps.sendJson(res, 403, { error: 'Acesso negado: este personagem não pertence à sua conta.' });
        return true;
      }
      try {
        this.deps.sendJson(res, 200, await FishingService.getStatus(this.deps.prisma, charId));
      } catch (err: any) {
        this.deps.sendJson(res, 400, { error: err.message || 'Erro ao consultar status de pesca.' });
      }
      return true;
    }

    if (pathname === '/api/play/fishing/start' && method === 'POST') {
      const body = await this.deps.readJsonBody<{ characterId: number; baitQueue?: number[]; posX?: number; posY?: number }>(req);
      const charId = Number(body.characterId);
      if (!charId || !(await this.verifyCharacterOwnership(userAccountId, session.role, charId))) {
        this.deps.sendJson(res, 403, { error: 'Acesso negado: este personagem não pertence à sua conta.' });
        return true;
      }
      try {
        this.deps.sendJson(
          res,
          200,
          await FishingService.startFishing(this.deps.prisma, session.role, charId, body)
        );
      } catch (err: any) {
        this.deps.sendJson(res, 400, { error: err.message || 'Não foi possível iniciar a pesca.' });
      }
      return true;
    }

    if (pathname === '/api/play/fishing/tick' && method === 'POST') {
      const body = await this.deps.readJsonBody<{ characterId: number }>(req);
      const charId = Number(body.characterId);
      if (!charId || !(await this.verifyCharacterOwnership(userAccountId, session.role, charId))) {
        this.deps.sendJson(res, 403, { error: 'Acesso negado: este personagem não pertence à sua conta.' });
        return true;
      }
      try {
        this.deps.sendJson(res, 200, await FishingService.tickFishing(this.deps.prisma, charId));
      } catch (err: any) {
        this.deps.sendJson(res, 400, { error: err.message || 'Erro no ciclo de pesca.' });
      }
      return true;
    }

    if (pathname === '/api/play/fishing/stop' && method === 'POST') {
      const body = await this.deps.readJsonBody<{ characterId: number }>(req);
      const charId = Number(body.characterId);
      if (!charId || !(await this.verifyCharacterOwnership(userAccountId, session.role, charId))) {
        this.deps.sendJson(res, 403, { error: 'Acesso negado: este personagem não pertence à sua conta.' });
        return true;
      }
      FishingService.stopSession(charId);
      this.deps.sendJson(res, 200, { ok: true, stopped: true });
      return true;
    }

    // 🎉 Sistema Modular de Eventos & Check-in Diário (00:00 BRT)
    const getEventsMatch = pathname.match(/^\/api\/play\/characters\/(\d+)\/events$/);
    if (getEventsMatch && method === 'GET') {
      const charId = Number(getEventsMatch[1]);
      if (!charId || !(await this.verifyCharacterOwnership(userAccountId, session.role, charId))) {
        this.deps.sendJson(res, 403, { error: 'Acesso negado: este personagem não pertence à sua conta.' });
        return true;
      }
      try {
        this.deps.sendJson(res, 200, await GameEventsService.getPlayEventsState(this.deps.prisma, charId));
      } catch (err: any) {
        this.deps.sendJson(res, 400, { error: err.message || 'Erro ao carregar eventos do personagem.' });
      }
      return true;
    }

    const claimEventMatch = pathname.match(/^\/api\/play\/characters\/(\d+)\/events\/(\d+)\/claim$/);
    if (claimEventMatch && method === 'POST') {
      const charId = Number(claimEventMatch[1]);
      const eventId = Number(claimEventMatch[2]);
      if (!charId || !eventId || !(await this.verifyCharacterOwnership(userAccountId, session.role, charId))) {
        this.deps.sendJson(res, 403, { error: 'Acesso negado: este personagem não pertence à sua conta.' });
        return true;
      }
      try {
        this.deps.sendJson(res, 200, await GameEventsService.claimEventReward(this.deps.prisma, charId, eventId));
      } catch (err: any) {
        this.deps.sendJson(res, 400, { error: err.message || 'Não foi possível resgatar a recompensa do evento.' });
      }
      return true;
    }

    // ⚔️ Rotas de Combate, Encontros, Missões de Batalha e Simulador GM
    if (
      await this.combatRouter.handle(req, res, pathname, method, {
        userAccountId,
        username: session.username,
        role: session.role,
      })
    ) {
      return true;
    }

    this.deps.sendJson(res, 404, { error: 'Rota da API Play não encontrada.' });
    return true;
  }
}
