/**
 * @file apps/server/src/routes/PlayRouter.ts
 * @module @etheria/server/routes/PlayRouter
 * @description Roteador seguro para endpoints do jogador e GM (`/api/play/*`).
 *   Gerencia autenticação de sessão dos jogadores, mitigação contra BOLA/IDOR (validação estrita
 *   de posse de personagem), teleporte, sincronização de posição, missões e instâncias de combate.
 * @rules Segue estritamente AGENTS.md (Cláusula 0 de Segurança, Regra #7 de modularidade e Cláusula 0.2).
 */

import type * as http from 'node:http';
import type { PrismaClient } from '@etheria/database';
import type { AdminAuthService } from '../security/AdminAuthService.js';
import type { GamePlayController } from '../controllers/GamePlayController.js';
import type { TemporaryCombatController } from '../controllers/TemporaryCombatController.js';
import type { AdminQuestsController } from '../controllers/AdminQuestsController.js';

export interface PlayRouterDeps {
  prisma: PrismaClient;
  authService: AdminAuthService;
  playController: GamePlayController;
  combatController: TemporaryCombatController;
  questsController: AdminQuestsController;
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

    // --- Estado do Mapa para Exploração em Tempo Real ---
    const playMapMatch = pathname.match(/^\/api\/play\/map\/(\d+)$/);
    if (playMapMatch && method === 'GET') {
      const mapId = Number(playMapMatch[1]);
      this.deps.sendJson(res, 200, await this.deps.playController.getMapStateForPlay(mapId));
      return true;
    }

    // --- Movimentação, Portais e Desengasgo ---
    const syncPosMatch = pathname.match(/^\/api\/play\/characters\/(\d+)\/sync-position$/);
    if (syncPosMatch && method === 'POST') {
      const charId = Number(syncPosMatch[1]);
      const dto = await this.deps.readJsonBody(req);
      this.deps.sendJson(
        res,
        200,
        await this.deps.playController.syncPosition(userAccountId, session.role, charId, dto)
      );
      return true;
    }

    const traverseMatch = pathname.match(/^\/api\/play\/characters\/(\d+)\/traverse-portal$/);
    if (traverseMatch && method === 'POST') {
      const charId = Number(traverseMatch[1]);
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

    const acceptQuestMatch = pathname.match(/^\/api\/play\/characters\/(\d+)\/quests\/accept$/);
    if (acceptQuestMatch && method === 'POST') {
      const charId = Number(acceptQuestMatch[1]);
      if (!(await this.verifyCharacterOwnership(userAccountId, session.role, charId))) {
        this.deps.sendJson(res, 403, { error: 'Acesso negado: este personagem não pertence à sua conta.' });
        return true;
      }
      const body = await this.deps.readJsonBody<{ questTemplateId: number; mapId?: number | null }>(req);
      this.deps.sendJson(
        res,
        200,
        await this.deps.questsController.acceptQuest(charId, Number(body.questTemplateId), body.mapId ?? null)
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

    const turnInQuestMatch = pathname.match(/^\/api\/play\/characters\/(\d+)\/quests\/turn-in$/);
    if (turnInQuestMatch && method === 'POST') {
      const charId = Number(turnInQuestMatch[1]);
      if (!(await this.verifyCharacterOwnership(userAccountId, session.role, charId))) {
        this.deps.sendJson(res, 403, { error: 'Acesso negado: este personagem não pertence à sua conta.' });
        return true;
      }
      const body = await this.deps.readJsonBody<{ questTemplateId: number; mapId?: number | null }>(req);
      this.deps.sendJson(
        res,
        200,
        await this.deps.questsController.turnInQuest(charId, Number(body.questTemplateId), body.mapId ?? null)
      );
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
          await this.deps.questsController.recordBattleVictoryProgress(
            state.characterId,
            state.monsterTemplateId || 1,
            state.monsters.length
          );
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
          await this.deps.questsController.recordBattleVictoryProgress(
            state.characterId,
            state.monsterTemplateId || 1,
            state.monsters.length
          );
        }
      }
      this.deps.sendJson(res, 200, state);
      return true;
    }

    this.deps.sendJson(res, 404, { error: 'Rota da API Play não encontrada.' });
    return true;
  }
}
