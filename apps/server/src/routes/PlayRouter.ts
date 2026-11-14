/**
 * @file apps/server/src/routes/PlayRouter.ts
 * @module @etheria/server/routes/PlayRouter
 * @description Roteador seguro para endpoints do jogador e GM (`/api/play/*`).
 *   Gerencia autenticação de sessão dos jogadores, mitigação contra BOLA/IDOR (validação estrita
 *   de posse de personagem), teleporte, sincronização de posição, missões e instâncias de combate.
 * @rules Segue estritamente AGENTS.md (Cláusula 0 de Segurança, Regra #7 de modularidade e Cláusula 0.2).
 */

import type * as http from 'node:http';
import { I18nCache, type PrismaClient } from '@etheria/database';
import type { AdminAuthService } from '../security/AdminAuthService.js';
import type { GamePlayController } from '../controllers/GamePlayController.js';
import type { TemporaryCombatController, CombatUnit } from '../controllers/TemporaryCombatController.js';
import type { AdminQuestsController } from '../controllers/AdminQuestsController.js';
import type { AssetMirrorService } from '../controllers/AssetMirrorService.js';
import { CharacterEquipmentService } from '../controllers/CharacterEquipmentService.js';
import { CharacterInventoryService } from '../controllers/CharacterInventoryService.js';
import { MonsterCombatBuilder, type QuestBattleConfigDto } from '../controllers/MonsterCombatBuilder.js';
import { ItemContainerOpeningService } from '../controllers/ItemContainerOpeningService.js';
import { CharacterProgressionService } from '../controllers/CharacterProgressionService.js';
import { GameChatService } from '../controllers/GameChatService.js';
import { MapPresenceService } from '../controllers/MapPresenceService.js';

export interface PlayRouterDeps {
  prisma: PrismaClient;
  authService: AdminAuthService;
  playController: GamePlayController;
  combatController: TemporaryCombatController;
  questsController: AdminQuestsController;
  assetMirrorService: AssetMirrorService;
  sendJson: (res: http.ServerResponse, statusCode: number, data: unknown) => void;
  readJsonBody: <T = any>(req: http.IncomingMessage) => Promise<T>;
}

export class PlayRouter {
  constructor(private readonly deps: PlayRouterDeps) {}

  /**
   * Valida se um personagem pertence à conta autenticada (ou se o usuário é ADMIN/GM).
   * Previne vulnerabilidades BOLA/IDOR onde um jogador manipula IDs alheios.
   */
  public async verifyCharacterOwnership(
    userAccountId: number,
    role: string,
    charId: number
  ): Promise<boolean> {
    if (['ADMIN', 'GM'].includes(role)) {
      return true;
    }
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

    // 1. Endpoint de Login da Rota /play
    if (pathname === '/api/play/auth/login' && method === 'POST') {
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

    // --- Bootstrap do Jogo (Personagens do Usuário, Mapas, Classes e Offset) ---
    if (pathname === '/api/play/bootstrap' && method === 'GET') {
      const data = await this.deps.playController.getPlayBootstrap(userAccountId);
      this.deps.sendJson(res, 200, {
        session: {
          userAccountId,
          username: session.username,
          role: session.role,
        },
        ...data,
      });
      return true;
    }

    // --- Criação e Deleção de Personagens ---
    if (pathname === '/api/play/characters' && method === 'POST') {
      const dto = await this.deps.readJsonBody(req);
      this.deps.sendJson(res, 201, await this.deps.playController.createCharacter(userAccountId, dto));
      return true;
    }

    const charDeleteMatch = pathname.match(/^\/api\/play\/characters\/(\d+)$/);
    if (charDeleteMatch && method === 'DELETE') {
      const charId = Number(charDeleteMatch[1]);
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
      const result = await CharacterEquipmentService.equipItem(
        this.deps.prisma,
        userAccountId,
        session.role,
        charId,
        Number(body.itemTemplateId),
        body.slotCode
      );
      this.deps.sendJson(res, 200, result);
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
      const body = await this.deps.readJsonBody<{ attribute: string; points?: number }>(req);
      const attr = String(body.attribute || '').toUpperCase();
      const points = Math.max(1, Number(body.points) || 1);
      if (!['VIT', 'STR', 'INT', 'WIS', 'AGI', 'DEX'].includes(attr)) {
        this.deps.sendJson(res, 400, { error: 'Atributo inválido. Escolha entre VIT, STR, INT, WIS, AGI ou DEX.' });
        return true;
      }

      const pc = await this.deps.prisma.playerCharacter.findUnique({ where: { id: charId } });
      if (!pc) {
        this.deps.sendJson(res, 404, { error: 'Personagem não encontrado.' });
        return true;
      }

      if ((pc.unspentStatPoints || 0) < points) {
        this.deps.sendJson(res, 400, { error: `Pontos insuficientes para distribuir (Disponíveis: ${pc.unspentStatPoints || 0}).` });
        return true;
      }

      const dist = (pc.distributedStatsJson && typeof pc.distributedStatsJson === 'object'
        ? { ...(pc.distributedStatsJson as Record<string, number>) }
        : { VIT: 0, STR: 0, INT: 0, WIS: 0, AGI: 0, DEX: 0 }) as Record<string, number>;

      dist[attr] = (Number(dist[attr]) || 0) + points;
      const updated = await this.deps.prisma.playerCharacter.update({
        where: { id: charId },
        data: {
          unspentStatPoints: Math.max(0, (pc.unspentStatPoints || 0) - points),
          distributedStatsJson: dist,
        },
      });

      this.deps.sendJson(res, 200, {
        success: true,
        unspentStatPoints: updated.unspentStatPoints,
        distributedStatsJson: updated.distributedStatsJson,
      });
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
      });

      this.deps.sendJson(res, 200, {
        ...syncResult,
        otherPlayers,
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
      MapPresenceService.removePlayer(charId);
      const dto = await this.deps.readJsonBody<{ portalId: number }>(req);
      this.deps.sendJson(
        res,
        200,
        await this.deps.playController.traversePortal(userAccountId, charId, Number(dto.portalId))
      );
      return true;
    }

    const unstuckMatch = pathname.match(/^\/api\/play\/characters\/(\d+)\/unstuck$/);
    if (unstuckMatch && method === 'POST') {
      const charId = Number(unstuckMatch[1]);
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
        const result = await ItemContainerOpeningService.openContainer(
          this.deps.prisma,
          charId,
          Number(body.itemTemplateId),
        );
        this.deps.sendJson(res, 200, result);
      } catch (err: any) {
        this.deps.sendJson(res, 400, { error: err.message || 'Erro ao abrir item.' });
      }
      return true;
    }

    // 💬 Chat Multi-Canal (Sistema, Mundo, Local, Guilda, Facção, Equipe)
    if (pathname === '/api/play/chat/messages' && method === 'GET') {
      const sinceId = urlObj.searchParams.get('sinceId') ? Number(urlObj.searchParams.get('sinceId')) : undefined;
      const mapId = urlObj.searchParams.get('mapId') ? Number(urlObj.searchParams.get('mapId')) : undefined;
      const guildId = urlObj.searchParams.get('guildId') ? Number(urlObj.searchParams.get('guildId')) : undefined;
      const factionId = urlObj.searchParams.get('factionId') || undefined;
      const teamId = urlObj.searchParams.get('teamId') ? Number(urlObj.searchParams.get('teamId')) : undefined;

      const messages = GameChatService.getMessages({
        sinceId,
        mapId,
        guildId,
        factionId,
        teamId,
      });
      this.deps.sendJson(res, 200, { success: true, messages });
      return true;
    }

    if (pathname === '/api/play/chat/send' && method === 'POST') {
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

    const turnInQuestMatch = pathname.match(/^\/api\/play\/characters\/(\d+)\/quests(?:\/(\d+))?\/turn-in$/);
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

    // 🏆 Registro Autoritário de Vitória na Arena em Tempo Real (Avança KILL_MONSTER, KILL_RACE e Drops de Quest)
    if (pathname === '/api/play/combat/victory' && method === 'POST') {
      const body = await this.deps.readJsonBody<{ battleId: string }>(req);
      const victoryData = this.deps.combatController.finalizeRealTimeVictory(String(body.battleId || ''));
      if (!victoryData) {
        this.deps.sendJson(res, 200, { alreadyRecorded: true });
        return true;
      }
      if (!(await this.verifyCharacterOwnership(userAccountId, session.role, victoryData.characterId))) {
        this.deps.sendJson(res, 403, { error: 'Acesso negado: esta batalha não pertence à sua conta.' });
        return true;
      }
      const progressResult = await this.deps.questsController.recordBattleVictoryBatch(
        victoryData.characterId,
        victoryData.defeatedMonsters,
        victoryData.goldReward
      );
      const progression = await CharacterProgressionService.awardProgression(
        this.deps.prisma,
        victoryData.characterId,
        victoryData.expReward
      );
      this.deps.sendJson(res, 200, {
        alreadyRecorded: false,
        expGained: victoryData.expReward,
        goldGained: victoryData.goldReward,
        playerProgression: progression?.player ?? null,
        petsProgression: progression?.pets ?? [],
        ...progressResult,
      });
      return true;
    }

    // ⚔️ Rotas da Arena de Combate em Tempo Real e Encontros no Mapa
    if (pathname === '/api/play/combat/encounter' && method === 'POST') {
      const body = await this.deps.readJsonBody<{ characterId?: number; mapId: number }>(req);
      const characterId = Number(body.characterId) || 0;
      if (characterId > 0 && !(await this.verifyCharacterOwnership(userAccountId, session.role, characterId))) {
        this.deps.sendJson(res, 403, { error: 'Acesso negado: este personagem não pertence à sua conta.' });
        return true;
      }
      const state = await this.deps.combatController.startEncounterByMap(
        characterId || 1,
        Number(body.mapId)
      );
      this.deps.sendJson(res, 200, state);
      return true;
    }

    // ⚔️ Iniciar Batalha de Treino / Missão no Véu (ex: Izumo Nv 1-10)
    if (pathname === '/api/play/combat/quest-battle' && method === 'POST') {
      const body = await this.deps.readJsonBody<{ characterId: number; questId: number }>(req);
      const characterId = Number(body.characterId) || 0;
      const questId = Number(body.questId) || 0;
      if (characterId > 0 && !(await this.verifyCharacterOwnership(userAccountId, session.role, characterId))) {
        this.deps.sendJson(res, 403, { error: 'Acesso negado: este personagem não pertence à sua conta.' });
        return true;
      }

      const [character, quest] = await Promise.all([
        this.deps.prisma.playerCharacter.findUnique({ where: { id: characterId } }),
        this.deps.prisma.questTemplate.findUnique({ where: { id: questId } }),
      ]);

      if (!character || !quest) {
        this.deps.sendJson(res, 404, { error: 'Personagem ou Missão não encontrados.' });
        return true;
      }

      const trigCfg = (quest.triggerConfigJson || {}) as { questBattleConfig?: QuestBattleConfigDto | null };
      const questBattleCfg = trigCfg.questBattleConfig;

      if (
        questBattleCfg &&
        questBattleCfg.enabled &&
        Array.isArray(questBattleCfg.monsters) &&
        questBattleCfg.monsters.length > 0
      ) {
        const [scalingCtx, i18nMap] = await Promise.all([
          MonsterCombatBuilder.loadScalingContext(this.deps.prisma),
          I18nCache.getTranslations(this.deps.prisma, 'pt-BR'),
        ]);

        const requestedIds = Array.from(
          new Set(
            questBattleCfg.monsters
              .map((m) => Number(m.monsterTemplateId))
              .filter((id) => Number.isFinite(id) && id > 0),
          ),
        );

        const templates = await this.deps.prisma.monsterTemplate.findMany({
          where: requestedIds.length > 0 ? { id: { in: requestedIds } } : { isActive: true },
          orderBy: { id: 'asc' },
        });
        const templateMap = new Map<number, any>(templates.map((t) => [t.id, t]));
        const fallbackTemplate = templates[0] || (await this.deps.prisma.monsterTemplate.findFirst());

        if (fallbackTemplate) {
          const customUnits: CombatUnit[] = [];
          for (const slot of questBattleCfg.monsters) {
            const baseTpl = templateMap.get(Number(slot.monsterTemplateId)) || fallbackTemplate;
            const defaultNamePtBr = i18nMap.get(baseTpl.nameI18nKey) ?? baseTpl.code;
            const units = MonsterCombatBuilder.buildCustomQuestMonsterUnits(
              baseTpl,
              defaultNamePtBr,
              slot,
              character.level || 1,
              customUnits.length,
              scalingCtx,
              '/api/assets/mcrework',
            );
            customUnits.push(...units);
          }

          if (customUnits.length > 0) {
            const state = await this.deps.combatController.startBattle(
              characterId,
              customUnits[0].monsterTemplateId || fallbackTemplate.id,
              customUnits.length,
              character.level || 1,
              customUnits,
              scalingCtx,
            );
            this.deps.sendJson(res, 200, state);
            return true;
          }
        }
      }

      let targetMobId = 1;
      let targetVariantTier: 'NORMAL' | 'LEADER' | 'BOSS' = 'NORMAL';
      const objs = Array.isArray(quest.objectivesJson) ? (quest.objectivesJson as any[]) : [];
      const mobObj = objs.find(
        (o) => (o.type === 'KILL_MONSTER' || o.type === 'KILL_LEADER' || o.type === 'KILL_BOSS') && o.monsterTemplateId
      );
      if (mobObj) {
        targetMobId = Number(mobObj.monsterTemplateId) || 1;
        const effTier =
          mobObj.type === 'KILL_BOSS'
            ? 'BOSS'
            : mobObj.type === 'KILL_LEADER'
            ? 'LEADER'
            : String(mobObj.variantTier || 'NORMAL').toUpperCase();
        if (effTier === 'BOSS' || effTier === 'LEADER') targetVariantTier = effTier;
      } else {
        const availableMobs = await this.deps.prisma.monsterTemplate.findMany({
          select: { id: true, rarityTier: true },
          where: { isActive: true },
          orderBy: { id: 'asc' },
        });
        if (availableMobs.length > 0) {
          const suitable = availableMobs.find((m: any) => m.rarityTier === 'F') || availableMobs[0];
          targetMobId = suitable.id;
        }
      }

      const qty = targetVariantTier === 'BOSS' ? 1 : Math.floor(Math.random() * 2) + 1;
      const state = await this.deps.combatController.startBattle(
        characterId,
        targetMobId,
        qty,
        character.level || 1,
        undefined,
        undefined,
        targetVariantTier,
      );
      this.deps.sendJson(res, 200, state);
      return true;
    }

    if (pathname === '/api/play/temporary-combat/monsters' && method === 'GET') {
      this.deps.sendJson(res, 200, await this.deps.combatController.getAvailableMonsters());
      return true;
    }

    if (pathname === '/api/play/temporary-combat/start' && method === 'POST') {
      const body = await this.deps.readJsonBody<{
        characterId?: number;
        monsterTemplateId: number;
        quantity?: number;
        monsterLevel?: number;
      }>(req);
      const characterId = Number(body.characterId) || 0;
      if (characterId > 0 && !(await this.verifyCharacterOwnership(userAccountId, session.role, characterId))) {
        this.deps.sendJson(res, 403, { error: 'Acesso negado: este personagem não pertence à sua conta.' });
        return true;
      }
      const state = await this.deps.combatController.startBattle(
        characterId,
        Number(body.monsterTemplateId),
        Number(body.quantity) || 1,
        Number(body.monsterLevel) || 1
      );
      this.deps.sendJson(res, 200, state);
      return true;
    }

    if (pathname === '/api/play/temporary-combat/action' && method === 'POST') {
      const body = await this.deps.readJsonBody<{
        battleId: string;
        actionType: 'ATTACK' | 'SKILL' | 'DEFEND';
        targetMonsterIndex?: number;
      }>(req);
      const state = this.deps.combatController.executeAction(
        body.battleId,
        body.actionType || 'ATTACK',
        Number(body.targetMonsterIndex) || 0
      );
      if (state.isFinished && state.winner === 'PLAYER' && !state.victoryRecorded) {
        state.victoryRecorded = true;
        if (state.characterId && (await this.verifyCharacterOwnership(userAccountId, session.role, state.characterId))) {
          const batch = this.deps.combatController.buildDefeatedBatch(state);
          await this.deps.questsController.recordBattleVictoryBatch(
            state.characterId,
            batch,
            Number(state.rewards?.gold) || 0
          );
          const progression = await CharacterProgressionService.awardProgression(
            this.deps.prisma,
            state.characterId,
            Number(state.rewards?.exp) || 0
          );
          if (progression && state.rewards) {
            (state.rewards as any).playerProgression = progression.player;
            (state.rewards as any).petsProgression = progression.pets;
          }
        }
      }
      this.deps.sendJson(res, 200, state);
      return true;
    }

    if (pathname === '/api/play/temporary-combat/auto-resolve' && method === 'POST') {
      const body = await this.deps.readJsonBody<{ battleId: string }>(req);
      const state = this.deps.combatController.autoResolve(body.battleId);
      if (state.isFinished && state.winner === 'PLAYER' && !state.victoryRecorded) {
        state.victoryRecorded = true;
        if (state.characterId && (await this.verifyCharacterOwnership(userAccountId, session.role, state.characterId))) {
          const batch = this.deps.combatController.buildDefeatedBatch(state);
          await this.deps.questsController.recordBattleVictoryBatch(
            state.characterId,
            batch,
            Number(state.rewards?.gold) || 0
          );
          const progression = await CharacterProgressionService.awardProgression(
            this.deps.prisma,
            state.characterId,
            Number(state.rewards?.exp) || 0
          );
          if (progression && state.rewards) {
            (state.rewards as any).playerProgression = progression.player;
            (state.rewards as any).petsProgression = progression.pets;
          }
        }
      }
      this.deps.sendJson(res, 200, state);
      return true;
    }

    this.deps.sendJson(res, 404, { error: 'Rota da API Play não encontrada.' });
    return true;
  }
}
