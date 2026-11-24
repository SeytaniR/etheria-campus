/**
 * @file apps/server/src/controllers/QuestStepActionService.ts
 * @module @etheria/server
 * @description Motor Autoritário de Etapas Sequenciais de Quests (Checklist), Ações de Modal por NPC,
 *   Validação de Equipamento de Peças, Escolha de Companheiros Iniciais Rank F e Coeficientes Dinâmicos de XP/Ouro.
 * @rules Segue estritamente AGENTS.md (Servidor Autoritário, Zero Hardcode, OOP Modular, Regra #7 < 1.000 linhas).
 * @dependencies @etheria/database (I18nCache), ./CharacterInventoryService.js, ./CharacterProgressionService.js, ./CharacterPetService.js
 */

import { I18nCache } from '@etheria/database';
import { CharacterInventoryService } from './CharacterInventoryService.js';
import { CharacterProgressionService } from './CharacterProgressionService.js';
import { CharacterPetService } from './CharacterPetService.js';

export interface LevelExpEntry {
  level: number;
  experienceToNext: number;
  totalExperience: number;
}

export interface EffectiveQuestRewardsDto {
  baseExp: number;
  baseGold: number;
  expCoefficient: number;
  goldCoefficient: number;
  exp: number;
  gold: number;
  totalRangeExp?: number;
  expMode: 'FIXED' | 'LEVEL_RANGE_PCT';
  expTargetLevelFrom: number | null;
  expTargetLevelTo: number | null;
  expRangePct: number;
}

export class QuestStepActionService {
  /**
   * Carrega o mapa completo de experiência acumulada por nível diretamente da tabela `level_experience_templates`.
   */
  public static async loadLevelExpMap(prisma: any): Promise<Map<number, LevelExpEntry>> {
    const rows = await prisma.levelExperienceTemplate.findMany({
      where: { level: { lte: 1000 } },
      orderBy: { level: 'asc' },
    });
    const map = new Map<number, LevelExpEntry>();
    for (const r of rows) {
      map.set(Number(r.level), {
        level: Number(r.level),
        experienceToNext: Number(r.experienceToNext || 0),
        totalExperience: Number(r.totalExperience || 0),
      });
    }
    return map;
  }

  /**
   * Calcula o total de EXP necessário na tabela oficial para ir de `fromLevel` até `toLevel`
   * e aplica uma porcentagem (`pct`, ex: 20 = 20%).
   */
  public static computeExpForLevelRange(
    levelExpMap: Map<number, LevelExpEntry>,
    fromLevel: number,
    toLevel: number,
    pct: number = 100
  ): number {
    const safeFrom = Math.max(1, Math.floor(Number(fromLevel) || 1));
    const safeTo = Math.max(safeFrom + 1, Math.floor(Number(toLevel) || safeFrom + 1));
    const fromEntry = levelExpMap.get(safeFrom);
    const toEntry = levelExpMap.get(safeTo);

    let totalDiff = 0;
    if (fromEntry && toEntry && toEntry.totalExperience > fromEntry.totalExperience) {
      totalDiff = toEntry.totalExperience - fromEntry.totalExperience;
    } else {
      // Fallback somando experienceToNext nível a nível
      for (let lv = safeFrom; lv < safeTo; lv++) {
        const e = levelExpMap.get(lv);
        totalDiff += e ? e.experienceToNext : lv * 42000;
      }
    }
    const safePct = Math.max(0, Number(pct) || 0);
    return Math.max(0, Math.round(totalDiff * (safePct / 100)));
  }

  /**
   * Calcula as recompensas efetivas de uma Quest aplicando:
   * 1. Modo de XP (`FIXED` ou `LEVEL_RANGE_PCT` baseado na tabela real `level_experience_templates`).
   * 2. Coeficiente de XP (`expCoefficient`, padrão `1.0`) e Coeficiente de Ouro (`goldCoefficient`, padrão `1.0`).
   */
  public static resolveEffectiveRewards(
    quest: any,
    rew: any,
    levelExpMap: Map<number, LevelExpEntry>
  ): EffectiveQuestRewardsDto {
    const expCoefficient = Math.max(0, Number(quest?.expCoefficient ?? 1.0));
    const goldCoefficient = Math.max(0, Number(quest?.goldCoefficient ?? 1.0));
    const safeRew = rew && typeof rew === 'object' ? rew : {};

    const expMode: 'FIXED' | 'LEVEL_RANGE_PCT' =
      String(safeRew.expMode || '').toUpperCase() === 'LEVEL_RANGE_PCT' ? 'LEVEL_RANGE_PCT' : 'FIXED';
    const expTargetLevelFrom = safeRew.expTargetLevelFrom ? Number(safeRew.expTargetLevelFrom) : null;
    const expTargetLevelTo = safeRew.expTargetLevelTo ? Number(safeRew.expTargetLevelTo) : null;
    const expRangePct = Number(safeRew.expRangePct ?? 100);

    let baseExp = Math.max(0, Number(safeRew.exp) || 0);
    let totalRangeExp: number | undefined;
    if (expMode === 'LEVEL_RANGE_PCT' && expTargetLevelFrom && expTargetLevelTo) {
      totalRangeExp = this.computeExpForLevelRange(levelExpMap, expTargetLevelFrom, expTargetLevelTo, 100);
      baseExp = this.computeExpForLevelRange(levelExpMap, expTargetLevelFrom, expTargetLevelTo, expRangePct);
    }

    const baseGold = Math.max(0, Number(safeRew.gold) || 0);
    const exp = Math.max(0, Math.round(baseExp * expCoefficient));
    const gold = Math.max(0, Math.round(baseGold * goldCoefficient));

    return {
      baseExp,
      baseGold,
      expCoefficient,
      goldCoefficient,
      exp,
      gold,
      totalRangeExp,
      expMode,
      expTargetLevelFrom,
      expTargetLevelTo,
      expRangePct,
    };
  }

  /**
   * Calcula o EXP concedido ao concluir uma etapa intermediária do checklist (caso `stepExpSharePct > 0`),
   * sempre respeitando a tabela de XP oficial e o `expCoefficient` da quest.
   */
  public static computeStepExpReward(
    quest: any,
    stepObj: any,
    levelExpMap: Map<number, LevelExpEntry>
  ): number {
    const stepPct = Math.max(0, Number(stepObj?.stepExpSharePct) || 0);
    const stepFixedExp = Math.max(0, Number(stepObj?.stepExpFixed) || 0);
    const expCoef = Math.max(0, Number(quest?.expCoefficient ?? 1.0));
    if (stepPct > 0) {
      const rew = (quest?.rewardsJson || {}) as any;
      const fromLv = Number(rew.expTargetLevelFrom) || 1;
      const toLv = Number(rew.expTargetLevelTo) || 10;
      const rawStepExp = this.computeExpForLevelRange(levelExpMap, fromLv, toLv, stepPct);
      return Math.max(0, Math.round(rawStepExp * expCoef));
    }
    if (stepFixedExp > 0) {
      return Math.max(0, Math.round(stepFixedExp * expCoef));
    }
    return 0;
  }

  /**
   * Verifica quantos itens de uma lista obrigatória estão atualmente equipados no personagem.
   */
  public static inspectEquippedItems(
    equippedItemsJson: any,
    requiredItemIds: number[]
  ): { equippedCount: number; totalRequired: number; missingIds: number[] } {
    const eqMap =
      equippedItemsJson && typeof equippedItemsJson === 'object'
        ? (equippedItemsJson as Record<string, any>)
        : {};
    const equippedSet = new Set<number>(
      Object.values(eqMap)
        .map((v) => Number(v))
        .filter((id) => Number.isInteger(id) && id > 0)
    );
    const uniqueReq = Array.from(
      new Set((requiredItemIds || []).map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))
    );
    const missingIds = uniqueReq.filter((id) => !equippedSet.has(id));
    return {
      equippedCount: uniqueReq.length - missingIds.length,
      totalRequired: uniqueReq.length,
      missingIds,
    };
  }

  /**
   * Retorna os monstros elegíveis como companheiro inicial para um determinado Rank (ex: Rank F).
   */
  public static async getStarterPetCandidates(prisma: any, rankCode: string = 'F') {
    const safeRank = String(rankCode || 'F').trim().toUpperCase();
    const [mobs, i18nMap] = await Promise.all([
      prisma.monsterTemplate.findMany({
        where: {
          rarityTier: safeRank,
          isTamableAsPet: true,
          isActive: true,
        },
        orderBy: { id: 'asc' },
      }),
      I18nCache.getTranslations(prisma),
    ]);

    return mobs.map((m: any) => ({
      id: m.id,
      code: m.code,
      namePtBr: i18nMap.get(m.nameI18nKey) ?? m.code,
      rarityTier: m.rarityTier,
      raceCode: m.raceCode,
      fixedElementCode: m.fixedElementCode,
      combatStyle: m.combatStyle || 'MELEE',
      damageType: m.damageType || 'PHYSICAL',
      thumbUrl: `/api/assets/mcrework/assets/monsters/${m.mcreworkMonsterKey}/thumb.webp`,
      atlasJsonUrl: `/api/assets/mcrework/assets/monsters/${m.mcreworkMonsterKey}/atlas.json`,
      atlasWebpUrl: `/api/assets/mcrework/assets/monsters/${m.mcreworkMonsterKey}/atlas.webp`,
    }));
  }

  /**
   * Confirma uma etapa ativa do Checklist de uma Quest via clique no botão do modal do NPC.
   * Valida ordem sequencial, entrega itens de etapa, cria pets escolhidos ou libera a batalha no Véu.
   */
  public static async confirmQuestStep(
    prisma: any,
    getStateFn: (charId: number, mapId: number | null) => Promise<any>,
    characterId: number,
    questTemplateId: number,
    stepIndex: number,
    payload: { mapId?: number | null; selectedMonsterIds?: number[] } = {}
  ) {
    const mapId = payload.mapId ?? null;
    const state = await getStateFn(characterId, mapId);
    const quest = state.quests.find((q: any) => Number(q.id) === Number(questTemplateId));
    if (!quest) throw new Error('Missão não encontrada.');
    if (quest.playerState !== 'IN_PROGRESS') {
      throw new Error('Esta missão não está em andamento.');
    }

    const objectives = Array.isArray(quest.objectives) ? quest.objectives : [];
    const idx = Number(stepIndex);
    if (!Number.isInteger(idx) || idx < 0 || idx >= objectives.length) {
      throw new Error('Etapa da missão inválida.');
    }

    const isSequential = Boolean((quest.triggerConfigJson as any)?.sequentialObjectives);
    if (isSequential) {
      const firstIncompleteIdx = objectives.findIndex((o: any) => !o.completed);
      if (firstIncompleteIdx !== idx) {
        throw new Error('Siga as etapas da missão exatamente na ordem indicada no checklist!');
      }
    }

    const obj = objectives[idx];
    if (obj.completed) {
      return { questState: state, alreadyCompleted: true };
    }

    const actionType = String(obj.stepActionType || 'DIALOGUE').toUpperCase();
    const counts = [...(quest.progressCounts || objectives.map(() => 0))];
    const levelExpMap = await this.loadLevelExpMap(prisma);

    let grantedItemsCount = 0;
    let grantedPets: any[] = [];
    let stepCompletedNow = false;
    let stepExpAwarded = 0;
    let progressionSummary: any = null;

    if (actionType === 'QUEST_BATTLE') {
      return {
        questState: state,
        launchBattle: true,
        questId: quest.id,
        stepIndex: idx,
      };
    }

    await prisma.$transaction(async (tx: any) => {
      const pc = await tx.playerCharacter.findUnique({ where: { id: Number(characterId) } });
      if (!pc) throw new Error('Personagem não encontrado.');

      if (actionType === 'DIALOGUE') {
        counts[idx] = Math.max(1, Number(obj.requiredCount) || 1);
        stepCompletedNow = true;
      } else if (actionType === 'GRANT_AND_EQUIP') {
        const grantIds: number[] = Array.isArray(obj.stepGrantItemIds)
          ? obj.stepGrantItemIds.map((x: any) => Number(x)).filter((x: number) => x > 0)
          : [];
        const reqEquipIds: number[] = Array.isArray(obj.requireEquipItemIds) && obj.requireEquipItemIds.length > 0
          ? obj.requireEquipItemIds.map((x: any) => Number(x)).filter((x: number) => x > 0)
          : grantIds;

        // Entrega apenas 1 vez (counts[idx] === 0)
        if ((counts[idx] || 0) < 1 && grantIds.length > 0) {
          const freeSlots = await CharacterInventoryService.countFreeSlots(tx, pc.id);
          if (freeSlots < grantIds.length) {
            throw new Error(
              `Mochila sem espaço suficiente! Libere pelo menos ${grantIds.length} slot(s) para receber os equipamentos (Você tem ${freeSlots}).`
            );
          }
          for (const itemId of grantIds) {
            await CharacterInventoryService.addItem(tx, pc.id, itemId, 1);
            grantedItemsCount++;
          }
          counts[idx] = 1;
        }

        // Verifica se já equipou todas as peças exigidas
        const eqCheck = this.inspectEquippedItems(pc.equippedItemsJson, reqEquipIds);
        if (reqEquipIds.length === 0 || eqCheck.missingIds.length === 0) {
          counts[idx] = 2;
          stepCompletedNow = true;
        }
      } else if (actionType === 'CHOOSE_PETS') {
        const pickCount = Math.max(1, Number(obj.stepPetPickCount) || 2);
        const rankCode = String(obj.stepPetRank || 'F').trim().toUpperCase();
        const requireDistinct = obj.stepPetRequireDistinct !== false;

        const chosen = Array.isArray(payload.selectedMonsterIds)
          ? payload.selectedMonsterIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
          : [];

        if (chosen.length !== pickCount) {
          throw new Error(`Selecione exatamente ${pickCount} companheiro(s) de Rank ${rankCode} para firmar o vínculo.`);
        }
        if (requireDistinct && new Set(chosen).size !== pickCount) {
          throw new Error(`Você precisa escolher ${pickCount} companheiros DIFERENTES!`);
        }

        const dbMobs = await tx.monsterTemplate.findMany({
          where: {
            id: { in: chosen },
            rarityTier: rankCode,
            isTamableAsPet: true,
            isActive: true,
          },
        });
        if (dbMobs.length !== new Set(chosen).size) {
          throw new Error(`Um ou mais monstros escolhidos não são Companheiros válidos de Rank ${rankCode}.`);
        }

        if ((counts[idx] || 0) < 1) {
          for (const mobId of chosen) {
            const pet = await CharacterPetService.generatePetForCharacter(tx, pc.id, mobId);
            grantedPets.push(pet);
          }
          counts[idx] = 1;
          stepCompletedNow = true;
        }
      }

      if (stepCompletedNow) {
        stepExpAwarded = this.computeStepExpReward(quest, obj, levelExpMap);
        if (stepExpAwarded > 0) {
          progressionSummary = await CharacterProgressionService.awardProgression(tx, pc.id, stepExpAwarded);
        }
      }

      const allDone = objectives.every((o: any, i: number) => {
        if (i === idx) return stepCompletedNow;
        return Boolean(o.completed);
      });

      await tx.characterQuestProgress.update({
        where: {
          characterId_questTemplateId: {
            characterId: pc.id,
            questTemplateId: quest.id,
          },
        },
        data: {
          progressJson: counts as any,
          status: allDone ? 'COMPLETED_PENDING_TURNIN' : 'IN_PROGRESS',
        },
      });
    });

    const updatedState = await getStateFn(characterId, mapId);
    const updatedPc = await prisma.playerCharacter.findUnique({
      where: { id: Number(characterId) },
      select: { id: true, level: true, experience: true, gold: true, unspentStatPoints: true },
    });

    return {
      questState: updatedState,
      stepCompleted: stepCompletedNow,
      grantedItemsCount,
      grantedPetsCount: grantedPets.length,
      stepExpAwarded,
      character: updatedPc
        ? {
            id: updatedPc.id,
            level: progressionSummary?.player?.newLevel ?? updatedPc.level,
            exp: progressionSummary?.player?.newExp ?? Number(updatedPc.experience),
            maxXp: progressionSummary?.player?.maxXp ?? (updatedPc.level * 42000),
            gold: Number(updatedPc.gold),
            freePoints: progressionSummary?.player?.unspentStatPoints ?? updatedPc.unspentStatPoints,
            unspentStatPoints: progressionSummary?.player?.unspentStatPoints ?? updatedPc.unspentStatPoints,
            playerProgression: progressionSummary?.player ?? null,
            petsProgression: progressionSummary?.pets ?? [],
          }
        : null,
    };
  }

  /**
   * Reavalia automaticamente etapas `GRANT_AND_EQUIP` assim que o jogador equipa uma peça na mochila/ficha.
   */
  public static async syncEquipObjectivesForCharacter(
    prisma: any,
    getStateFn: (charId: number, mapId: number | null) => Promise<any>,
    characterId: number
  ) {
    const pc = await prisma.playerCharacter.findUnique({
      where: { id: Number(characterId) },
      select: { id: true, equippedItemsJson: true, currentMapId: true },
    });
    if (!pc) return null;

    const state = await getStateFn(characterId, pc.currentMapId || null);
    const inProgress = state.quests.filter((q: any) => q.playerState === 'IN_PROGRESS');
    if (inProgress.length === 0) return null;

    const levelExpMap = await this.loadLevelExpMap(prisma);
    let anyCompleted = false;
    let totalStepExp = 0;
    let lastProgression: any = null;

    for (const q of inProgress) {
      const objectives = Array.isArray(q.objectives) ? q.objectives : [];
      const counts = [...(q.progressCounts || objectives.map(() => 0))];
      const isSequential = Boolean((q.triggerConfigJson as any)?.sequentialObjectives);
      let changed = false;

      for (let i = 0; i < objectives.length; i++) {
        const obj = objectives[i];
        if (String(obj.stepActionType || '').toUpperCase() !== 'GRANT_AND_EQUIP') continue;
        if (Number(counts[i] || 0) !== 1) continue; // Só valida se os itens já foram entregues e ainda não concluiu
        if (isSequential) {
          const prevUnfinished = objectives.slice(0, i).some((prev: any) => !prev.completed);
          if (prevUnfinished) break;
        }

        const reqIds: number[] =
          Array.isArray(obj.requireEquipItemIds) && obj.requireEquipItemIds.length > 0
            ? obj.requireEquipItemIds
            : Array.isArray(obj.stepGrantItemIds)
            ? obj.stepGrantItemIds
            : [];
        const check = this.inspectEquippedItems(pc.equippedItemsJson, reqIds);
        if (reqIds.length > 0 && check.missingIds.length === 0) {
          counts[i] = 2;
          changed = true;
          anyCompleted = true;
          const stepExp = this.computeStepExpReward(q, obj, levelExpMap);
          if (stepExp > 0) {
            totalStepExp += stepExp;
            lastProgression = await CharacterProgressionService.awardProgression(prisma, pc.id, stepExp);
          }
        }
      }

      if (changed) {
        const allDone = objectives.every((o: any, idx: number) => {
          if (String(o.stepActionType || '').toUpperCase() === 'GRANT_AND_EQUIP') {
            return Number(counts[idx] || 0) >= 2;
          }
          return Boolean(o.completed);
        });
        await prisma.characterQuestProgress.update({
          where: {
            characterId_questTemplateId: {
              characterId: pc.id,
              questTemplateId: q.id,
            },
          },
          data: {
            progressJson: counts as any,
            status: allDone ? 'COMPLETED_PENDING_TURNIN' : 'IN_PROGRESS',
          },
        });
      }
    }

    if (!anyCompleted) return null;
    const updatedState = await getStateFn(characterId, pc.currentMapId || null);
    return {
      questState: updatedState,
      stepExpAwarded: totalStepExp,
      progression: lastProgression,
    };
  }

  /**
   * Recolhe em lote TODAS as Quests Meta concluídas (`READY_TO_TURN_IN` / `TURN_IN_READY`),
   * incluindo estágios subsequentes que já estejam completos pelo acúmulo de abates/itens.
   */
  public static async claimAllMetaQuests(
    questsController: any,
    characterId: number,
    currentMapId: number | null = null
  ) {
    let claimedCount = 0;
    let totalExp = 0;
    let totalGold = 0;
    let totalStatPoints = 0;
    let totalLeveledUp = false;
    let totalStatPointsFromLevel = 0;
    let latestCharacter: any = null;
    let stoppedReason: string | null = null;
    const maxClaims = 250;

    for (let round = 0; round < maxClaims; round++) {
      const state = await questsController.getCharacterQuestState(characterId, currentMapId);
      const readyMeta = (state.quests || []).filter(
        (q: any) =>
          (q.category === 'META' || q.questCategory === 'META') &&
          (q.status === 'READY_TO_TURN_IN' || q.playerState === 'TURN_IN_READY')
      );
      if (readyMeta.length === 0) break;

      let claimedAnyInRound = false;
      for (const mq of readyMeta) {
        if (claimedCount >= maxClaims) break;
        const rew = mq.rewards || {};
        const expEst = Math.max(0, Number(rew.exp) || 0);
        const goldEst = Math.max(0, Number(rew.gold) || 0);
        const statEst = Math.max(0, Number(rew.rewardStatPoints ?? rew.statPoints) || 0);
        try {
          const res = await questsController.turnInQuest(characterId, mq.id, currentMapId);
          claimedCount++;
          claimedAnyInRound = true;
          totalExp += expEst;
          totalGold += goldEst;
          totalStatPoints += statEst;
          if (res?.character) {
            latestCharacter = res.character;
            if (res.character.playerProgression?.leveledUp) {
              totalLeveledUp = true;
              totalStatPointsFromLevel += Number(res.character.playerProgression.statPointsGained || 0);
            }
          }
        } catch (err: any) {
          stoppedReason = err?.message || 'Não foi possível recolher algumas metas de caça.';
          break;
        }
      }
      if (!claimedAnyInRound || stoppedReason) break;
    }

    const finalState = await questsController.getCharacterQuestState(characterId, currentMapId);
    if (latestCharacter && totalLeveledUp) {
      latestCharacter = {
        ...latestCharacter,
        playerProgression: {
          ...(latestCharacter.playerProgression || {}),
          leveledUp: true,
          newLevel: latestCharacter.level,
          statPointsGained:
            totalStatPointsFromLevel || Number(latestCharacter.playerProgression?.statPointsGained || 0),
        },
      };
    }

    return {
      claimedCount,
      totalExp,
      totalGold,
      totalStatPoints,
      stoppedReason,
      questState: finalState,
      character: latestCharacter,
    };
  }

  /**
   * Sub-roteador modular para rotas de etapas de checklist, seleção de companheiros iniciais
   * e resgate em lote de Quests Meta (`/play`).
   */
  public static async handlePlayQuestStepRoute(
    req: any,
    res: any,
    pathname: string,
    method: string,
    urlObj: URL,
    questsController: any,
    verifyOwnershipFn: (charId: number) => Promise<boolean>,
    readJsonBody: <T = any>(req: any) => Promise<T>,
    sendJson: (res: any, status: number, payload: unknown) => void
  ): Promise<boolean> {
    const claimAllMetaMatch = pathname.match(/^\/api\/play\/characters\/(\d+)\/quests\/claim-all-meta$/);
    if (claimAllMetaMatch && method === 'POST') {
      const charId = Number(claimAllMetaMatch[1]);
      if (!(await verifyOwnershipFn(charId))) {
        sendJson(res, 403, { error: 'Acesso negado: este personagem não pertence à sua conta.' });
        return true;
      }
      try {
        const body = await readJsonBody<{ mapId?: number | null }>(req);
        const result = await this.claimAllMetaQuests(questsController, charId, body?.mapId ?? null);
        sendJson(res, 200, result);
      } catch (err: any) {
        sendJson(res, 400, { error: err?.message || 'Erro ao recolher metas concluídas.' });
      }
      return true;
    }

    const starterPetsMatch = pathname.match(/^\/api\/play\/characters\/(\d+)\/quests\/starter-pets$/);
    if (starterPetsMatch && method === 'GET') {
      const charId = Number(starterPetsMatch[1]);
      if (!(await verifyOwnershipFn(charId))) {
        sendJson(res, 403, { error: 'Acesso negado: este personagem não pertence à sua conta.' });
        return true;
      }
      const rank = urlObj.searchParams.get('rank') || 'F';
      sendJson(res, 200, { candidates: await questsController.getStarterPetCandidates(rank) });
      return true;
    }

    const confirmStepMatch = pathname.match(/^\/api\/play\/characters\/(\d+)\/quests\/(\d+)\/confirm-step$/);
    if (confirmStepMatch && method === 'POST') {
      const charId = Number(confirmStepMatch[1]);
      const questId = Number(confirmStepMatch[2]);
      if (!(await verifyOwnershipFn(charId))) {
        sendJson(res, 403, { error: 'Acesso negado: este personagem não pertence à sua conta.' });
        return true;
      }
      try {
        const body = await readJsonBody<{ stepIndex: number; mapId?: number | null; selectedMonsterIds?: number[] }>(req);
        const result = await questsController.confirmQuestStep(charId, questId, Number(body.stepIndex), {
          mapId: body.mapId ?? null,
          selectedMonsterIds: Array.isArray(body.selectedMonsterIds) ? body.selectedMonsterIds : [],
        });
        sendJson(res, 200, result);
      } catch (err: any) {
        sendJson(res, 400, { error: err?.message || 'Erro ao confirmar etapa da missão.' });
      }
      return true;
    }

    return false;
  }
}
