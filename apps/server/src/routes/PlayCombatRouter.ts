/**
 * @file apps/server/src/routes/PlayCombatRouter.ts
 * @module @etheria/server/routes/PlayCombatRouter
 * @description Sub-roteador especializado de combate, encontros, missões de combate e simulador GM (`/api/play/combat/*`, `/api/play/temporary-combat/*`).
 * @rules
 *   - Garante posse do personagem (BOLA/IDOR) antes de mutar qualquer instância de batalha.
 *   - Aplica validação autoritária anti-cheat (`CombatAntiCheatService`) na conclusão de combates.
 *   - Restringe integralmente `/api/play/temporary-combat/*` a contas `GM`, `ADMIN` ou `DEV`.
 *   - Mantém `PlayRouter.ts` modularizado estritamente abaixo de 1.000 linhas (Regra #7).
 * @dependencies node:http, @etheria/database, TemporaryCombatController, AdminQuestsController, MonsterCombatBuilder, DungeonService, DungeonChestService, CharacterProgressionService, PartyService, CombatAntiCheatService
 */

import type * as http from 'node:http';
import { I18nCache, type PrismaClient } from '@etheria/database';
import type { TemporaryCombatController, CombatUnit } from '../controllers/TemporaryCombatController.js';
import type { AdminQuestsController } from '../controllers/AdminQuestsController.js';
import { MonsterCombatBuilder, type QuestBattleConfigDto } from '../controllers/MonsterCombatBuilder.js';
import { DungeonService } from '../controllers/DungeonService.js';
import { DungeonChestService } from '../controllers/DungeonChestService.js';
import { CharacterProgressionService } from '../controllers/CharacterProgressionService.js';
import { PartyService } from '../controllers/PartyService.js';
import { CombatAntiCheatService } from '../security/CombatAntiCheatService.js';

export interface PlayCombatRouterDeps {
  prisma: PrismaClient;
  combatController: TemporaryCombatController;
  questsController: AdminQuestsController;
  sendJson: (res: http.ServerResponse, statusCode: number, data: unknown) => void;
  readJsonBody: <T = any>(req: http.IncomingMessage, maxBytes?: number) => Promise<T>;
  verifyCharacterOwnership: (userAccountId: number, role: string, charId: number) => Promise<boolean>;
}

export class PlayCombatRouter {
  constructor(private readonly deps: PlayCombatRouterDeps) {}

  /**
   * Processa rotas `/api/play/combat/*` e `/api/play/temporary-combat/*`.
   */
  public async handle(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    pathname: string,
    method: string,
    session: { userAccountId: number; username: string; role: string }
  ): Promise<boolean> {
    const { userAccountId, role } = session;

    // Registro Autoritário de Vitória na Arena em Tempo Real (Avança KILL_MONSTER, KILL_RACE e Drops de Quest)
    if (pathname === '/api/play/combat/victory' && method === 'POST') {
      const body = await this.deps.readJsonBody<{
        battleId?: string;
        battleNonce?: string;
        totalDamageDealt?: number;
        hitsCount?: number;
      }>(req);
      const battleId = String(body.battleId || '');
      const battle = this.deps.combatController.getBattleState(battleId);
      if (!battle || battle.victoryRecorded) {
        this.deps.sendJson(res, 200, { alreadyRecorded: true });
        return true;
      }

      if (!(await this.deps.verifyCharacterOwnership(userAccountId, role, Number(battle.characterId) || 0))) {
        this.deps.sendJson(res, 403, { error: 'Acesso negado: esta batalha não pertence à sua conta.' });
        return true;
      }

      const check = CombatAntiCheatService.validateVictoryClaim(battle, role, body);
      if (!check.ok) {
        console.warn(
          `[ANTI-CHEAT] Bloqueada vitória suspeita user=${userAccountId} char=${battle.characterId} battle=${battleId}: ${check.reason}`
        );
        this.deps.sendJson(res, 400, { error: check.reason || 'Validação de combate falhou.' });
        return true;
      }

      const victoryData = this.deps.combatController.finalizeRealTimeVictory(battleId);
      if (!victoryData) {
        this.deps.sendJson(res, 200, { alreadyRecorded: true });
        return true;
      }

      const party = PartyService.getPartyByCharacterId(victoryData.characterId);
      const partySize = party ? party.members.length : 1;
      const rewards = PartyService.calculatePartyRewards(victoryData.expReward, victoryData.goldReward, partySize);

      const battleMapId = Number((victoryData as any).mapId) || 1;
      const [battleMap, primaryPc] = await Promise.all([
        this.deps.prisma.gameMap.findUnique({ where: { id: battleMapId }, select: { requiredLevel: true } }),
        this.deps.prisma.playerCharacter.findUnique({ where: { id: victoryData.characterId }, select: { level: true } }),
      ]);
      const mapLvl = battleMap?.requiredLevel ?? 1;
      const primaryScaling = MonsterCombatBuilder.applyMapLevelingPenalty(
        rewards.expPerMember,
        rewards.goldPerMember,
        primaryPc?.level ?? 1,
        mapLvl
      );

      const chestRewards = (victoryData as any).isDungeon
        ? await DungeonChestService.rollAndGrantChestItems(
            this.deps.prisma,
            victoryData.characterId,
            (victoryData as any).dungeonChest
          )
        : null;
      const awardedExp = primaryScaling.exp + (chestRewards?.exp || 0);
      const awardedGold = primaryScaling.gold + (chestRewards?.gold || 0);

      const progressResult = await this.deps.questsController.recordBattleVictoryBatch(
        victoryData.characterId,
        victoryData.defeatedMonsters,
        awardedGold
      );
      const progression = await CharacterProgressionService.awardProgression(
        this.deps.prisma,
        victoryData.characterId,
        awardedExp
      );

      if (party && party.members.length > 1) {
        for (const member of party.members) {
          if (member.characterId !== victoryData.characterId) {
            try {
              const memScaling = MonsterCombatBuilder.applyMapLevelingPenalty(
                rewards.expPerMember,
                rewards.goldPerMember,
                member.level || 1,
                mapLvl
              );
              await this.deps.questsController.recordBattleVictoryBatch(
                member.characterId,
                victoryData.defeatedMonsters,
                memScaling.gold
              );
              await CharacterProgressionService.awardProgression(
                this.deps.prisma,
                member.characterId,
                memScaling.exp
              );
            } catch {}
          }
        }
      }

      const exitDestination = (victoryData as any).isDungeon
        ? await DungeonService.completeDungeonRun(
            this.deps.prisma,
            battleId,
            victoryData.characterId,
            (victoryData as any).dungeonRunId
          )
        : null;

      this.deps.sendJson(res, 200, {
        alreadyRecorded: false,
        expGained: awardedExp,
        goldGained: awardedGold,
        levelingPenaltyMultiplier: primaryScaling.penaltyMultiplier,
        levelingPenaltyReason: primaryScaling.penaltyReason,
        partyBonusApplied: partySize > 1,
        partyMembersCount: partySize,
        playerProgression: progression?.player ?? null,
        petsProgression: progression?.pets ?? [],
        dungeonCompleted: Boolean((victoryData as any).isDungeon),
        chestRewards,
        exitDestination,
        ...progressResult,
      });
      return true;
    }

    // Encontros no Mapa em Tempo Real
    if (pathname === '/api/play/combat/encounter' && method === 'POST') {
      const body = await this.deps.readJsonBody<{ characterId?: number; mapId: number }>(req);
      const characterId = Number(body.characterId) || 0;
      if (characterId <= 0) {
        this.deps.sendJson(res, 400, { error: 'Personagem inválido para iniciar encontro.' });
        return true;
      }
      if (!(await this.deps.verifyCharacterOwnership(userAccountId, role, characterId))) {
        this.deps.sendJson(res, 403, { error: 'Acesso negado: este personagem não pertence à sua conta.' });
        return true;
      }

      const encCheck = CombatAntiCheatService.checkEncounterAllowed(characterId, role, false);
      if (!encCheck.ok) {
        this.deps.sendJson(res, 429, { error: encCheck.reason });
        return true;
      }

      const state = await this.deps.combatController.startEncounterByMap(characterId, Number(body.mapId));
      this.deps.sendJson(res, 200, state);
      return true;
    }

    // Batalha de Missão no Véu
    if (pathname === '/api/play/combat/quest-battle' && method === 'POST') {
      const body = await this.deps.readJsonBody<{ characterId: number; questId: number }>(req);
      const characterId = Number(body.characterId) || 0;
      const questId = Number(body.questId) || 0;
      if (characterId <= 0 || questId <= 0) {
        this.deps.sendJson(res, 400, { error: 'Personagem ou Missão inválidos.' });
        return true;
      }
      if (!(await this.deps.verifyCharacterOwnership(userAccountId, role, characterId))) {
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
      if ((character as any).isFlying) {
        this.deps.sendJson(res, 400, { error: 'Você precisa estar no chão para iniciar uma luta! Pouse sua montaria primeiro.' });
        return true;
      }

      const trigCfg = (quest.triggerConfigJson || {}) as { questBattleConfig?: QuestBattleConfigDto | null };
      const stepObjBattle = Array.isArray(quest.objectivesJson)
        ? (quest.objectivesJson as any[]).find((o) => o?.stepBattleConfig?.enabled)?.stepBattleConfig
        : null;
      const questBattleCfg: QuestBattleConfigDto | null = (stepObjBattle || trigCfg.questBattleConfig || null) as QuestBattleConfigDto | null;

      if (
        questBattleCfg &&
        questBattleCfg.enabled &&
        Array.isArray(questBattleCfg.monsters) &&
        questBattleCfg.monsters.length > 0
      ) {
        const [scalingCtx, i18nMap] = await Promise.all([
          MonsterCombatBuilder.loadScalingContext(this.deps.prisma),
          I18nCache.getTranslations(this.deps.prisma),
        ]);

        const requestedIds = Array.from(
          new Set(
            questBattleCfg.monsters
              .map((m) => Number(m.monsterTemplateId))
              .filter((id) => Number.isFinite(id) && id > 0)
          )
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
              '/api/assets/mcrework'
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
              scalingCtx
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
        targetVariantTier
      );
      this.deps.sendJson(res, 200, state);
      return true;
    }

    // Rotas do Simulador de Combate (EXCLUSIVO GM / ADMIN / DEV)
    if (pathname.startsWith('/api/play/temporary-combat/')) {
      if (!['ADMIN', 'GM', 'DEV'].includes(role)) {
        this.deps.sendJson(res, 403, {
          error: 'Acesso negado: o simulador de combate é exclusivo para contas GM, ADMIN ou DEV.',
        });
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
        if (characterId > 0 && !(await this.deps.verifyCharacterOwnership(userAccountId, role, characterId))) {
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
        await this.awardGmSandboxVictory(state, userAccountId, role);
        this.deps.sendJson(res, 200, state);
        return true;
      }

      if (pathname === '/api/play/temporary-combat/auto-resolve' && method === 'POST') {
        const body = await this.deps.readJsonBody<{ battleId: string }>(req);
        const state = this.deps.combatController.autoResolve(body.battleId);
        await this.awardGmSandboxVictory(state, userAccountId, role);
        this.deps.sendJson(res, 200, state);
        return true;
      }
    }

    return false;
  }

  private async awardGmSandboxVictory(state: any, userAccountId: number, role: string): Promise<void> {
    if (!state?.isFinished || state.winner !== 'PLAYER' || state.victoryRecorded) return;
    state.victoryRecorded = true;
    if (!state.characterId) return;
    if (!(await this.deps.verifyCharacterOwnership(userAccountId, role, state.characterId))) return;

    const batch = this.deps.combatController.buildDefeatedBatch(state);
    const [bMap, pc] = await Promise.all([
      this.deps.prisma.gameMap.findUnique({ where: { id: state.mapId || 1 }, select: { requiredLevel: true } }),
      this.deps.prisma.playerCharacter.findUnique({ where: { id: state.characterId }, select: { level: true } }),
    ]);
    const scaled = MonsterCombatBuilder.applyMapLevelingPenalty(
      Number(state.rewards?.exp) || 0,
      Number(state.rewards?.gold) || 0,
      pc?.level ?? 1,
      bMap?.requiredLevel ?? 1
    );
    await this.deps.questsController.recordBattleVictoryBatch(state.characterId, batch, scaled.gold);
    const progression = await CharacterProgressionService.awardProgression(
      this.deps.prisma,
      state.characterId,
      scaled.exp
    );
    if (progression && state.rewards) {
      state.rewards.exp = scaled.exp;
      state.rewards.gold = scaled.gold;
      state.rewards.playerProgression = progression.player;
      state.rewards.petsProgression = progression.pets;
    }
  }
}
