/**
 * @file apps/server/src/controllers/QuestProgressService.ts
 * @module @etheria/server
 * @description Serviço de Runtime para Progresso, Aceite, Combate e Entrega de Quests (`/play`),
 *   suportando Quests tradicionais (`MAIN`, `SIDE`, `EPIC`, `PROFICIENCY`) e Quests Meta
 *   Procedurais (`META`) multi-estágio com contagem cumulativa e base inicial de Mochila/Ouro.
 * @rules
 *   - Quests `META` mantêm 1 registro em `CharacterQuestProgress` avançando `currentStage` (`1..N`).
 *   - Contagem de abates (`KILL_MONSTER`, `KILL_RACE`) e entregas (`COLLECT_ITEM`) é cumulativa entre estágios.
 *   - A entrega de `COLLECT_ITEM` ao NPC valida e consome itens reais de `character_inventory_items`.
 * @dependencies MetaQuestProceduralEngine, CharacterInventoryService, I18nCache, PrismaClient.
 */

import { I18nCache } from '@etheria/database';
import { MetaQuestProceduralEngine, type MetaQuestConfigDto } from './MetaQuestProceduralEngine.js';
import {
  CharacterInventoryService,
  type DefeatedMonsterDropUnit,
} from './CharacterInventoryService.js';

export interface QuestObjectiveRuntimeDto {
  type: 'KILL_MONSTER' | 'KILL_LEADER' | 'KILL_BOSS' | 'KILL_RACE' | 'COLLECT_ITEM' | 'TALK_NPC' | 'VISIT_MAP' | 'WIN_BATTLES';
  variantTier?: 'ANY' | 'NORMAL' | 'LEADER' | 'BOSS' | string | null;
  monsterTemplateId?: number | null;
  raceCode?: string | null;
  itemTemplateId?: number | null;
  dropSourceMode?: string;
  dropMonsterTemplateId?: number | null;
  dropRaceCode?: string | null;
  dropChancePct?: number;
  npcTemplateId?: number | null;
  mapId?: number | null;
  requiredCount: number;
  labelPtBr?: string;
}

export class QuestProgressService {
  private readonly prisma: any;
  private readonly getAllQuestsFn: () => Promise<any[]>;

  constructor(prisma: any, getAllQuestsFn: () => Promise<any[]>) {
    this.prisma = prisma;
    this.getAllQuestsFn = getAllQuestsFn;
  }

  /**
   * Calcula o estado completo de Quests de um Personagem no Mapa Atual (`/play`),
   * resolvendo dinamicamente estágio ativo de Quests `META` e estoque da mochila para `COLLECT_ITEM`.
   */
  public async getCharacterQuestState(characterId: number, currentMapId: number | null = null) {
    const [character, allQuests, progressRows, bagMap, items, monsters, races, i18nMap] = await Promise.all([
      this.prisma.playerCharacter.findUnique({ where: { id: Number(characterId) } }),
      this.getAllQuestsFn(),
      this.prisma.characterQuestProgress.findMany({ where: { characterId: Number(characterId) } }),
      CharacterInventoryService.getBagQuantityMap(this.prisma, Number(characterId)),
      this.prisma.itemTemplate.findMany({ select: { id: true, code: true, nameI18nKey: true } }),
      this.prisma.monsterTemplate.findMany({ select: { id: true, code: true, nameI18nKey: true } }),
      this.prisma.race.findMany({ select: { code: true, nameI18nKey: true } }),
      I18nCache.getTranslations(this.prisma, 'pt-BR'),
    ]);

    if (!character) {
      throw new Error(`Personagem #${characterId} não encontrado.`);
    }

    const itemNameMap = new Map<number, string>(
      items.map((i: any) => [Number(i.id), i18nMap.get(i.nameI18nKey) ?? i.code]),
    );
    const mobNameMap = new Map<number, string>(
      monsters.map((m: any) => [Number(m.id), i18nMap.get(m.nameI18nKey) ?? m.code]),
    );
    const raceNameMap = new Map<string, string>(
      races.map((r: any) => [String(r.code).toUpperCase(), i18nMap.get(r.nameI18nKey) ?? r.code]),
    );

    const activeMapId = currentMapId ? Number(currentMapId) : character.currentMapId;
    const progressMap = new Map<number, any>();
    for (const p of progressRows) {
      progressMap.set(p.questTemplateId, p);
    }

    const enrichedQuests = allQuests
      .filter((q) => q.isActive !== false)
      .map((q) => {
        const prog = progressMap.get(q.id);
        const isMeta = q.questCategory === 'META' && Boolean(q.metaConfigJson);
        const metaCfg: MetaQuestConfigDto | null = isMeta
          ? MetaQuestProceduralEngine.normalizeConfig(q.metaConfigJson)
          : null;

        let activeStageInfo: {
          isMeta: boolean;
          currentStage: number;
          totalStages: number;
          requiredCount: number;
          targetType: string;
          nextStageRequiredCount: number | null;
        } | null = null;

        let objectives: QuestObjectiveRuntimeDto[] = Array.isArray(q.objectivesJson)
          ? (q.objectivesJson as QuestObjectiveRuntimeDto[])
          : [];
        let rew: any = q.rewardsJson || {};
        let effectiveDialogueComplete = q.dialogueCompletePtBr || '';

        if (isMeta && metaCfg) {
          const rawStage = prog ? Math.max(1, Number(prog.currentStage) || 1) : 1;
          const resolved = MetaQuestProceduralEngine.resolveActiveStage(metaCfg, rawStage);
          const stage = resolved.stage;
          const labelPtBr = MetaQuestProceduralEngine.formatTargetLabelPtBr(metaCfg, stage, {
            monsterName: metaCfg.monsterTemplateId ? mobNameMap.get(Number(metaCfg.monsterTemplateId)) : undefined,
            raceName: metaCfg.raceCode ? raceNameMap.get(String(metaCfg.raceCode).toUpperCase()) : undefined,
            itemName: metaCfg.itemTemplateId ? itemNameMap.get(Number(metaCfg.itemTemplateId)) : undefined,
          });

          objectives = [
            {
              type: metaCfg.targetType,
              variantTier: metaCfg.variantTier || 'ANY',
              monsterTemplateId: metaCfg.targetType === 'KILL_MONSTER' ? metaCfg.monsterTemplateId : null,
              raceCode: metaCfg.targetType === 'KILL_RACE' ? metaCfg.raceCode : null,
              itemTemplateId: metaCfg.targetType === 'COLLECT_ITEM' ? metaCfg.itemTemplateId : null,
              dropSourceMode: metaCfg.dropSourceMode,
              dropMonsterTemplateId: metaCfg.dropMonsterTemplateId,
              dropRaceCode: metaCfg.dropRaceCode,
              dropChancePct: metaCfg.dropChancePct,
              requiredCount: stage.requiredCount,
              labelPtBr,
            },
          ];

          rew = {
            exp: stage.rewardExp,
            gold: stage.rewardGold,
            statPoints: 0,
            rewardItemTemplateId: stage.rewardItemTemplateId,
            rewardItemQuantity: stage.rewardItemQuantity,
            triggerReborn: Boolean(stage.triggerReborn),
          };
          if (stage.stageDialogueCompletePtBr) {
            effectiveDialogueComplete = stage.stageDialogueCompletePtBr;
          }

          activeStageInfo = {
            isMeta: true,
            currentStage: resolved.stageIndex,
            totalStages: resolved.totalStages,
            requiredCount: stage.requiredCount,
            targetType: metaCfg.targetType,
            nextStageRequiredCount:
              resolved.stageIndex < resolved.totalStages
                ? (metaCfg.stages[resolved.stageIndex]?.requiredCount ?? null)
                : null,
          };
        }

        const rawCounts: number[] = Array.isArray(prog?.progressJson)
          ? (prog.progressJson as number[])
          : objectives.map(() => 0);

        const formattedObjectives = objectives.map((obj, idx) => {
          const req = Math.max(1, Number(obj.requiredCount) || 1);
          if (obj.type === 'COLLECT_ITEM' && obj.itemTemplateId) {
            const delivered = prog && prog.status !== 'TURNED_IN' ? Math.max(0, Number(rawCounts[idx] || 0)) : 0;
            const inBag = bagMap.get(Number(obj.itemTemplateId)) || 0;
            const effectiveCur = Math.min(req, delivered + inBag);
            const neededFromBag = Math.max(0, req - delivered);
            const itemName = itemNameMap.get(Number(obj.itemTemplateId)) ?? `Item #${obj.itemTemplateId}`;
            return {
              ...obj,
              currentCount: effectiveCur,
              deliveredCount: delivered,
              bagCount: inBag,
              neededFromBag,
              requiredCount: req,
              completed: delivered + inBag >= req,
              descriptionPtBr: obj.labelPtBr || `Coletar e entregar ${req.toLocaleString('pt-BR')}x ${itemName}`,
            };
          }

          let fallbackLabel = obj.labelPtBr || obj.type;
          if (!obj.labelPtBr) {
            const effTier =
              obj.type === 'KILL_BOSS'
                ? 'BOSS'
                : obj.type === 'KILL_LEADER'
                ? 'LEADER'
                : String(obj.variantTier || 'ANY').toUpperCase();
            const tierPrefix =
              effTier === 'BOSS'
                ? '💀 Boss de '
                : effTier === 'LEADER'
                ? '👑 Líder de '
                : '';
            if (obj.type === 'KILL_MONSTER' || obj.type === 'KILL_LEADER' || obj.type === 'KILL_BOSS') {
              const mName = obj.monsterTemplateId
                ? (mobNameMap.get(Number(obj.monsterTemplateId)) ?? `Monstro #${obj.monsterTemplateId}`)
                : 'Qualquer Monstro';
              fallbackLabel = tierPrefix
                ? `Eliminar ${req.toLocaleString('pt-BR')}x ${tierPrefix}${mName}`
                : `Abater ${req.toLocaleString('pt-BR')}x ${mName}`;
            } else if (obj.type === 'KILL_RACE') {
              const rName = obj.raceCode ? (raceNameMap.get(String(obj.raceCode).toUpperCase()) ?? obj.raceCode) : 'Qualquer';
              fallbackLabel = tierPrefix
                ? `Eliminar ${req.toLocaleString('pt-BR')}x ${tierPrefix}Raça ${rName}`
                : `Abater ${req.toLocaleString('pt-BR')}x Raça ${rName}`;
            }
          }
          const cur = Math.min(req, Math.max(0, Number(rawCounts[idx] || 0)));
          return {
            ...obj,
            currentCount: cur,
            requiredCount: req,
            completed: cur >= req,
            descriptionPtBr: fallbackLabel,
          };
        });

        const reqCfg = (q.requirementsJson || {}) as any;
        let playerState: 'LOCKED' | 'AVAILABLE' | 'IN_PROGRESS' | 'TURN_IN_READY' | 'COMPLETED' = 'LOCKED';

        if (prog && prog.status !== 'TURNED_IN') {
          const allObjectivesDone =
            formattedObjectives.length === 0 || formattedObjectives.every((o) => Boolean(o.completed));
          playerState = allObjectivesDone ? 'TURN_IN_READY' : 'IN_PROGRESS';
        } else if (prog && prog.status === 'TURNED_IN') {
          playerState = q.repeatType === 'ONCE' ? 'COMPLETED' : 'AVAILABLE';
        } else {
          const levelOk = (character.level || 1) >= (q.minLevel || 1);
          const allPrereqsOk = (q.autoRequiredQuestIds || []).every((reqQuestId: number) => {
            const preProg = progressMap.get(Number(reqQuestId));
            return Boolean(preProg && preProg.status === 'TURNED_IN');
          });
          const classOk = !reqCfg.requiredClassId || Number(character.classTemplateId) === Number(reqCfg.requiredClassId);
          const elementOk =
            !reqCfg.requiredElement ||
            String(character.elementCode || '').toUpperCase() === String(reqCfg.requiredElement).toUpperCase();
          const rebornOk = !reqCfg.requireReborn || Boolean(character.isReborn);

          if (levelOk && allPrereqsOk && classOk && elementOk && rebornOk) {
            playerState = 'AVAILABLE';
          }
        }

        const giverMapAllowed = !q.giverMapId || !activeMapId || Number(q.giverMapId) === Number(activeMapId);
        const turnInMapAllowed = !q.turnInMapId || !activeMapId || Number(q.turnInMapId) === Number(activeMapId);
        const rewardItemId = rew.rewardItemTemplateId ? Number(rew.rewardItemTemplateId) : null;
        const rewardItemQty = rewardItemId ? Math.max(1, Number(rew.rewardItemQuantity) || 1) : 0;

        return {
          ...q,
          questBattleConfig: (q.triggerConfigJson as any)?.questBattleConfig || q.questBattleConfig || null,
          dialogueCompletePtBr: effectiveDialogueComplete || q.dialogueCompletePtBr,
          objectivesJson: objectives,
          rewardsJson: rew,
          status: playerState === 'TURN_IN_READY' ? 'READY_TO_TURN_IN' : playerState,
          playerState,
          progressCounts: rawCounts,
          objectives: formattedObjectives,
          metaStageInfo: activeStageInfo,
          rewards: {
            exp: Number(rew.exp) || 0,
            gold: Number(rew.gold) || 0,
            freePointsBonus: 0,
            rewardItemTemplateId: rewardItemId,
            rewardItemQuantity: rewardItemQty,
            rewardItemTemplateIds: Array.isArray(rew.rewardItemTemplateIds) ? rew.rewardItemTemplateIds : [],
            rewardItems: Array.isArray(rew.rewardItems) ? rew.rewardItems : [],
            rewardItemNamePtBr: rewardItemId ? (itemNameMap.get(rewardItemId) ?? `Item #${rewardItemId}`) : null,
            triggerReborn: Boolean(rew.triggerReborn),
          },
          category: q.questCategory,
          completedCount: prog?.completedCount || 0,
          giverMapAllowed,
          turnInMapAllowed,
          canAcceptOnCurrentMap: giverMapAllowed,
          canTurnInOnCurrentMap: turnInMapAllowed,
        };
      });

    const npcHeadIndicators: Record<
      number,
      { symbol: '!' | '?'; color: 'RED' | 'GRAY'; state: 'TURN_IN_READY' | 'AVAILABLE' | 'IN_PROGRESS' }
    > = {};

    for (const q of enrichedQuests) {
      const giverId = Number(q.giverNpcId) || 0;
      const turnInId = Number(q.turnInNpcId || q.giverNpcId) || 0;

      if (q.playerState === 'TURN_IN_READY' && turnInId && q.turnInMapAllowed) {
        npcHeadIndicators[turnInId] = { symbol: '?', color: 'RED', state: 'TURN_IN_READY' };
      } else if (q.playerState === 'AVAILABLE' && giverId && q.giverMapAllowed) {
        if (npcHeadIndicators[giverId]?.state !== 'TURN_IN_READY') {
          npcHeadIndicators[giverId] = { symbol: '!', color: 'RED', state: 'AVAILABLE' };
        }
      } else if (q.playerState === 'IN_PROGRESS' && turnInId && q.turnInMapAllowed) {
        if (!npcHeadIndicators[turnInId]) {
          npcHeadIndicators[turnInId] = { symbol: '?', color: 'GRAY', state: 'IN_PROGRESS' };
        }
      }
    }

    return {
      characterId: character.id,
      currentMapId: activeMapId,
      characterGold: Number(character.gold ?? 0),
      quests: enrichedQuests,
      npcHeadIndicators,
    };
  }

  /**
   * Jogador aceita uma Quest no NPC (`! vermelho`), iniciando no Estágio 1 quando for Meta Quest.
   */
  public async acceptQuest(characterId: number, questTemplateId: number, currentMapId: number | null = null) {
    const state = await this.getCharacterQuestState(characterId, currentMapId);
    const quest = state.quests.find((q) => q.id === Number(questTemplateId));
    if (!quest) {
      throw new Error('Missão não encontrada.');
    }
    if (quest.playerState !== 'AVAILABLE') {
      throw new Error(
        quest.linearLockDescriptionPtBr || 'Esta missão ainda está bloqueada pelos requisitos anteriores.',
      );
    }
    if (!quest.giverMapAllowed) {
      throw new Error(`Esta missão só pode ser aceita no mapa: ${quest.giverMapNamePtBr}`);
    }

    const objectives = Array.isArray(quest.objectives) ? quest.objectives : [];
    const initialCounts = objectives.map((obj: any) => {
      if (obj.type === 'VISIT_MAP' && (!obj.mapId || Number(obj.mapId) === Number(state.currentMapId))) {
        return obj.requiredCount || 1;
      }
      return 0;
    });

    const allDone = objectives.every((obj: any, idx: number) =>
      obj.type === 'COLLECT_ITEM' ? Boolean(obj.completed) : (initialCounts[idx] || 0) >= (obj.requiredCount || 1),
    );
    const newStatus = allDone ? 'COMPLETED_PENDING_TURNIN' : 'IN_PROGRESS';

    await this.prisma.characterQuestProgress.upsert({
      where: {
        characterId_questTemplateId: {
          characterId: Number(characterId),
          questTemplateId: Number(questTemplateId),
        },
      },
      update: {
        status: newStatus,
        currentStage: 1,
        progressJson: initialCounts as any,
      },
      create: {
        characterId: Number(characterId),
        questTemplateId: Number(questTemplateId),
        status: newStatus,
        currentStage: 1,
        progressJson: initialCounts as any,
      },
    });

    const updatedState = await this.getCharacterQuestState(characterId, currentMapId);
    return { questState: updatedState };
  }

  /**
   * Atualiza objetivos `TALK_NPC` quando o jogador interage com um NPC no mapa.
   */
  public async interactNpcForQuest(characterId: number, npcTemplateId: number, currentMapId: number | null = null) {
    const state = await this.getCharacterQuestState(characterId, currentMapId);
    const inProgressQuests = state.quests.filter((q) => q.playerState === 'IN_PROGRESS');

    for (const q of inProgressQuests) {
      const objectives = Array.isArray(q.objectives) ? q.objectives : [];
      const counts = [...q.progressCounts];
      let changed = false;

      objectives.forEach((obj: any, idx: number) => {
        if (obj.type === 'TALK_NPC' && Number(obj.npcTemplateId) === Number(npcTemplateId)) {
          const mapOk = !obj.mapId || !state.currentMapId || Number(obj.mapId) === Number(state.currentMapId);
          if (mapOk && (counts[idx] || 0) < (obj.requiredCount || 1)) {
            counts[idx] = obj.requiredCount || 1;
            changed = true;
          }
        }
      });

      if (changed) {
        const allDone = objectives.every((obj: any, idx: number) =>
          obj.type === 'COLLECT_ITEM' ? Boolean(obj.completed) : (counts[idx] || 0) >= (obj.requiredCount || 1),
        );
        await this.prisma.characterQuestProgress.update({
          where: {
            characterId_questTemplateId: {
              characterId: Number(characterId),
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

    const updatedState = await this.getCharacterQuestState(characterId, currentMapId);
    return { questState: updatedState };
  }

  /**
   * Avança automaticamente objetivos `KILL_MONSTER`, `KILL_RACE`, `WIN_BATTLES` e drops
   * provisórios de `COLLECT_ITEM` ao vencer batalha com 1 ou múltiplos monstros/raças mistas.
   */
  public async recordBattleVictoryBatch(
    characterId: number,
    defeatedMonsters: Array<{ monsterTemplateId: number; raceCode?: string; count?: number }>,
    bonusGold: number = 0,
  ) {
    if (!characterId) return null;

    const mobIds = Array.from(
      new Set(defeatedMonsters.map((d) => Number(d.monsterTemplateId)).filter((id) => Number.isInteger(id) && id > 0)),
    );
    const dbMonsters = mobIds.length
      ? await this.prisma.monsterTemplate.findMany({
          where: { id: { in: mobIds } },
          select: { id: true, raceCode: true },
        })
      : [];
    const raceByMobId = new Map<number, string>(
      dbMonsters.map((m: any) => [Number(m.id), String(m.raceCode || '').toUpperCase()]),
    );

    const normalizedUnits: DefeatedMonsterDropUnit[] = defeatedMonsters
      .map((u: any) => {
        const mobId = Number(u.monsterTemplateId) || 0;
        const raceCode = String(u.raceCode || raceByMobId.get(mobId) || '').trim().toUpperCase();
        const rawTier = String(u.variantTier || 'NORMAL').toUpperCase();
        const variantTier: 'NORMAL' | 'LEADER' | 'BOSS' =
          rawTier === 'BOSS' ? 'BOSS' : rawTier === 'LEADER' ? 'LEADER' : 'NORMAL';
        const count = Math.max(1, Math.round(Number(u.count) || 1));
        const lootRollsCount = Math.max(count, Math.round(Number(u.lootRollsCount ?? count) || count));
        return {
          monsterTemplateId: mobId,
          raceCode,
          variantTier,
          count,
          lootRollsCount,
        };
      })
      .filter((u) => u.monsterTemplateId > 0);

    const stateBefore = await this.getCharacterQuestState(characterId, null);
    const inProgressQuests = stateBefore.quests.filter((q) => q.playerState === 'IN_PROGRESS');

    const [itemsList, i18nMap] = await Promise.all([
      this.prisma.itemTemplate.findMany({ select: { id: true, code: true, nameI18nKey: true } }),
      I18nCache.getTranslations(this.prisma, 'pt-BR'),
    ]);
    const itemNameMap = new Map<number, string>(
      itemsList.map((i: any) => [Number(i.id), i18nMap.get(i.nameI18nKey) ?? i.code]),
    );

    const updatedGold = await CharacterInventoryService.addGold(this.prisma, characterId, bonusGold);
    const monsterLootDrops = await CharacterInventoryService.rollMonsterLootDrops(
      this.prisma,
      characterId,
      normalizedUnits,
      itemNameMap,
    );
    const questDrops = await CharacterInventoryService.grantProvisionalQuestDrops(
      this.prisma,
      characterId,
      inProgressQuests,
      normalizedUnits,
      itemNameMap,
    );
    const mergedDropMap = new Map<number, { itemTemplateId: number; namePtBr: string; quantity: number }>();
    for (const d of [...monsterLootDrops, ...questDrops]) {
      const existing = mergedDropMap.get(d.itemTemplateId);
      if (existing) existing.quantity += d.quantity;
      else mergedDropMap.set(d.itemTemplateId, { ...d });
    }
    const droppedItems = Array.from(mergedDropMap.values());

    for (const q of inProgressQuests) {
      const objectives = Array.isArray(q.objectives) ? q.objectives : [];
      const counts = [...q.progressCounts];
      let changed = false;

      objectives.forEach((obj: any, idx: number) => {
        const req = Math.max(1, Number(obj.requiredCount) || 1);
        if (obj.type === 'COLLECT_ITEM') return;
        if ((counts[idx] || 0) >= req) return;

        if (obj.type === 'WIN_BATTLES') {
          counts[idx] = Math.min(req, (counts[idx] || 0) + 1);
          changed = true;
        } else if (obj.type === 'KILL_MONSTER' || obj.type === 'KILL_LEADER' || obj.type === 'KILL_BOSS') {
          const reqTier =
            obj.type === 'KILL_BOSS'
              ? 'BOSS'
              : obj.type === 'KILL_LEADER'
              ? 'LEADER'
              : String(obj.variantTier || 'ANY').toUpperCase();
          const matchedKills = normalizedUnits.reduce((sum, u) => {
            const mobOk = !obj.monsterTemplateId || Number(obj.monsterTemplateId) === u.monsterTemplateId;
            const tierOk = !reqTier || reqTier === 'ANY' || (u.variantTier || 'NORMAL') === reqTier;
            return sum + (mobOk && tierOk ? u.count : 0);
          }, 0);
          if (matchedKills > 0) {
            counts[idx] = Math.min(req, (counts[idx] || 0) + matchedKills);
            changed = true;
          }
        } else if (obj.type === 'KILL_RACE') {
          const targetRace = String(obj.raceCode || '').trim().toUpperCase();
          const reqTier = String(obj.variantTier || 'ANY').toUpperCase();
          const matchedRaceKills = normalizedUnits.reduce((sum, u) => {
            const raceOk = !targetRace || targetRace === u.raceCode;
            const tierOk = !reqTier || reqTier === 'ANY' || (u.variantTier || 'NORMAL') === reqTier;
            return sum + (raceOk && tierOk ? u.count : 0);
          }, 0);
          if (matchedRaceKills > 0) {
            counts[idx] = Math.min(req, (counts[idx] || 0) + matchedRaceKills);
            changed = true;
          }
        }
      });

      if (changed) {
        const allDone = objectives.every((obj: any, idx: number) =>
          obj.type === 'COLLECT_ITEM' ? Boolean(obj.completed) : (counts[idx] || 0) >= (obj.requiredCount || 1),
        );
        await this.prisma.characterQuestProgress.update({
          where: {
            characterId_questTemplateId: {
              characterId: Number(characterId),
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

    const questState = await this.getCharacterQuestState(characterId, null);
    return {
      questState,
      droppedItems,
      characterGold: updatedGold,
    };
  }

  /**
   * Jogador entrega a Quest (ou o Estágio atual da Quest Meta) no NPC (`? vermelho`),
   * entregando itens solicitados da mochila, recebendo recompensas escaladas e avançando ao próximo estágio.
   */
  public async turnInQuest(characterId: number, questTemplateId: number, currentMapId: number | null = null) {
    const state = await this.getCharacterQuestState(characterId, currentMapId);
    const quest = state.quests.find((q) => q.id === Number(questTemplateId));
    if (!quest) {
      throw new Error('Missão não encontrada.');
    }
    if (quest.playerState !== 'TURN_IN_READY') {
      throw new Error('Os objetivos desta missão ainda não foram concluídos.');
    }
    if (!quest.turnInMapAllowed) {
      throw new Error(`Esta missão só pode ser concluída no mapa: ${quest.turnInMapNamePtBr}`);
    }

    const rewards = quest.rewards || {};
    const expGain = Math.max(0, Number(rewards.exp) || 0);
    const goldGain = Math.max(0, Number(rewards.gold) || 0);
    // REGRA SAGRADA MANDATÓRIA: Nenhuma missão pode conceder pontos livres de atributo para distribuir.
    // Apenas a evolução de nível concede estritamente 5 pontos de atributo base por level up.
    const statPointsGain = 0;
    const rewardItemTemplateId = rewards.rewardItemTemplateId ? Number(rewards.rewardItemTemplateId) : null;
    const rewardItemQuantity = rewardItemTemplateId ? Math.max(1, Number(rewards.rewardItemQuantity) || 1) : 0;
    const triggerReborn = Boolean(rewards.triggerReborn);

    const objectives = Array.isArray(quest.objectives) ? quest.objectives : [];
    const nextCounts = [...(quest.progressCounts || objectives.map(() => 0))];

    const isMeta = quest.questCategory === 'META' && Boolean(quest.metaStageInfo);
    const currentStage = isMeta ? Number(quest.metaStageInfo.currentStage) || 1 : 1;
    const totalStages = isMeta ? Number(quest.metaStageInfo.totalStages) || 1 : 1;
    const hasNextStage = isMeta && currentStage < totalStages;

    let updatedCharSummary: any = null;
    let advancedToStage: number | null = null;

    await this.prisma.$transaction(async (tx: any) => {
      const pc = await tx.playerCharacter.findUnique({ where: { id: Number(characterId) } });
      if (!pc) throw new Error('Personagem não encontrado.');

      // 1. Consome da mochila os itens necessários para completar este estágio (acumulado)
      for (let idx = 0; idx < objectives.length; idx++) {
        const obj = objectives[idx];
        if (obj.type === 'COLLECT_ITEM' && obj.itemTemplateId) {
          const deliveredSoFar = Math.max(0, Number(nextCounts[idx] || 0));
          const stageTarget = Math.max(1, Number(obj.requiredCount) || 1);
          const neededFromBag = Math.max(0, stageTarget - deliveredSoFar);
          if (neededFromBag > 0) {
            await CharacterInventoryService.consumeItem(tx, pc.id, Number(obj.itemTemplateId), neededFromBag);
          }
          nextCounts[idx] = Math.max(deliveredSoFar, stageTarget);
        }
      }

      // 2. Aplica EXP, Level Up, Pontos de Atributo (Exclusivo Level Up), Reborn e Ouro
      let newExp = Number(pc.experience || 0) + expGain;
      let newLevel = pc.level || 1;
      let newStatPoints = Number(pc.unspentStatPoints || 0);

      const expLevels = await tx.levelExperienceTemplate.findMany({
        where: { level: { gte: newLevel } },
        orderBy: { level: 'asc' },
      });
      const expMap = new Map<number, number>(
        expLevels.map((l: any) => [Number(l.level), Number(l.experienceToNext)])
      );

      while (true) {
        const requiredExp = expMap.get(newLevel) ?? (newLevel * 200);
        if (requiredExp > 0 && newExp >= requiredExp) {
          newExp -= requiredExp;
          newLevel += 1;
          newStatPoints += 5; // Apenas Level Up concede rigorosamente 5 pontos base distribuíveis
        } else {
          break;
        }
      }

      const newGold = BigInt(Math.max(0, Number(pc.gold || 0) + goldGain));

      const updatedPc = await tx.playerCharacter.update({
        where: { id: pc.id },
        data: {
          experience: BigInt(newExp),
          level: newLevel,
          gold: newGold,
          unspentStatPoints: newStatPoints,
          isReborn: triggerReborn ? true : pc.isReborn,
        },
      });

      // 3. Concede Itens de Recompensa na Mochila Básica (Singular ou Múltiplos)
      if (rewardItemTemplateId && rewardItemQuantity > 0) {
        await CharacterInventoryService.addItem(tx, pc.id, rewardItemTemplateId, rewardItemQuantity);
      }
      if (Array.isArray(rewards.rewardItemTemplateIds)) {
        for (const rId of rewards.rewardItemTemplateIds) {
          const safeId = Number(rId);
          if (safeId > 0) {
            await CharacterInventoryService.addItem(tx, pc.id, safeId, 1);
          }
        }
      } else if (Array.isArray(rewards.rewardItems)) {
        for (const rItem of rewards.rewardItems) {
          const rId = Number(rItem.itemTemplateId || rItem.id);
          const rQty = Math.max(1, Number(rItem.quantity || rItem.qty) || 1);
          if (rId > 0) {
            await CharacterInventoryService.addItem(tx, pc.id, rId, rQty);
          }
        }
      }

      updatedCharSummary = {
        id: updatedPc.id,
        level: updatedPc.level,
        exp: Number(updatedPc.experience),
        gold: Number(updatedPc.gold),
        freePoints: updatedPc.unspentStatPoints,
        isReborn: updatedPc.isReborn,
      };

      // 4. Avança para próximo estágio da Quest Meta OU finaliza a Quest
      if (hasNextStage) {
        const nextStage = currentStage + 1;
        advancedToStage = nextStage;
        const bagAfterConsume = await CharacterInventoryService.getBagQuantityMap(tx, pc.id);
        const metaCfg = MetaQuestProceduralEngine.normalizeConfig(quest.metaConfigJson);
        const nextStageReq = metaCfg.stages[nextStage - 1]?.requiredCount || 1;
        let nextStageReady = false;
        if (metaCfg.targetType === 'COLLECT_ITEM' && metaCfg.itemTemplateId) {
          const alreadyDeliv = Math.max(0, Number(nextCounts[0] || 0));
          const remBag = bagAfterConsume.get(Number(metaCfg.itemTemplateId)) || 0;
          nextStageReady = alreadyDeliv + remBag >= nextStageReq;
        }

        await tx.characterQuestProgress.update({
          where: {
            characterId_questTemplateId: {
              characterId: pc.id,
              questTemplateId: quest.id,
            },
          },
          data: {
            status: nextStageReady ? 'COMPLETED_PENDING_TURNIN' : 'IN_PROGRESS',
            currentStage: nextStage,
            progressJson: nextCounts as any,
            completedCount: { increment: 1 },
          },
        });
      } else {
        await tx.characterQuestProgress.update({
          where: {
            characterId_questTemplateId: {
              characterId: pc.id,
              questTemplateId: quest.id,
            },
          },
          data: {
            status: 'TURNED_IN',
            progressJson: nextCounts as any,
            completedCount: { increment: 1 },
          },
        });
      }
    });

    if (!hasNextStage) {
      const afterState = await this.getCharacterQuestState(characterId, currentMapId);
      for (const nextQ of afterState.quests) {
        const trigCfg = (nextQ.triggerConfigJson || {}) as any;
        if (
          nextQ.playerState === 'AVAILABLE' &&
          nextQ.triggerType === 'AUTO_ON_PREV_QUEST' &&
          trigCfg.autoAcceptOnTrigger &&
          (nextQ.autoRequiredQuestIds || []).includes(quest.id)
        ) {
          try {
            await this.acceptQuest(characterId, nextQ.id, currentMapId);
          } catch {
            // Ignora se tiver restrição de mapa diferente do atual
          }
        }
      }
    }

    const finalState = await this.getCharacterQuestState(characterId, currentMapId);
    return {
      questState: finalState,
      character: updatedCharSummary,
      advancedToStage,
      completedAllStages: !hasNextStage,
    };
  }
}
