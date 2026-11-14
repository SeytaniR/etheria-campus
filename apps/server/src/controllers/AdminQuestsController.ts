/**
 * @file apps/server/src/controllers/AdminQuestsController.ts
 * @module @etheria/server
 * @description Controlador do Estúdio No-Code de Quests (`quest_templates`), Fluxograma por Capítulos/Episódios e Meta Quests Procedurais.
 *   - Missões Principais (`MAIN`) seguem progressão estritamente linear por Capítulos e Episódios (`1-1` -> `1-2` -> `1-3` ===> `2-1` -> `2-2`).
 *   - Missões Meta (`META`) escalam proceduralmente por N estágios (ex: `10 -> 100 -> 1.000 -> 10.000`) com suporte a
 *     Matar Monstro, Matar Raça (`KILL_RACE`) ou Coletar & Entregar Item (`COLLECT_ITEM`) e escalada própria de recompensas.
 *   - Todas as categorias (`MAIN`, `SIDE`, `EPIC`, `PROFICIENCY`, `META`) suportam Gatilho de Acionamento e Requisitos.
 */

import { PrismaClient } from '@prisma/client';
import { SnapshotManager, I18nCache } from '@etheria/database';
import { ensureInitialQuestsSeed } from './AdminQuestsInitialSeeds.js';
import {
  MetaQuestProceduralEngine,
  type MetaQuestConfigDto,
} from './MetaQuestProceduralEngine.js';
import { QuestProgressService } from './QuestProgressService.js';

export interface QuestObjectiveBlockDto {
  type: 'KILL_MONSTER' | 'KILL_RACE' | 'COLLECT_ITEM' | 'TALK_NPC' | 'VISIT_MAP' | 'WIN_BATTLES';
  monsterTemplateId?: number | null;
  raceCode?: string | null;
  itemTemplateId?: number | null;
  dropSourceMode?: 'SPECIFIC_MONSTER' | 'RACE' | 'ANY_MONSTER';
  dropMonsterTemplateId?: number | null;
  dropRaceCode?: string | null;
  dropChancePct?: number;
  npcTemplateId?: number | null;
  mapId?: number | null;
  requiredCount: number;
  labelPtBr?: string;
}

export interface QuestTriggerConfigDto {
  triggerMapId?: number | null;
  triggerMonsterId?: number | null;
  autoAcceptOnTrigger?: boolean;
}

export interface QuestRequirementsDto {
  minLevel?: number;
  prerequisiteQuestId?: number | null;
  requiredChapterCompleted?: number | null;
  requiredElement?: string | null;
  requiredClassId?: number | null;
  requireReborn?: boolean;
}

export interface QuestRewardDto {
  exp?: number;
  gold?: number;
  statPoints?: number;
  unlockSkillId?: number | null;
  grantPetMonsterId?: number | null;
  rewardItemTemplateId?: number | null;
  rewardItemQuantity?: number;
  rewardItemTemplateIds?: number[];
  rewardItems?: Array<{ itemTemplateId: number; quantity?: number }>;
  triggerReborn?: boolean;
}

export interface SaveQuestTemplateDto {
  titlePtBr: string;
  descriptionPtBr?: string;
  dialogueOfferPtBr?: string;
  dialogueActivePtBr?: string;
  dialogueCompletePtBr?: string;
  questCategory?: 'MAIN' | 'SIDE' | 'EPIC' | 'PROFICIENCY' | 'META';
  chapterOrder?: number;
  episodeOrder?: number;
  minLevel?: number;
  prerequisiteQuestId?: number | null;
  repeatType?: 'ONCE' | 'REPEATABLE' | 'DAILY';
  triggerType?: 'NPC_INTERACT' | 'AUTO_ON_PREV_QUEST' | 'ENTER_MAP' | 'REACH_LEVEL' | 'KILL_MONSTER_TRIGGER';
  triggerConfigJson?: QuestTriggerConfigDto;
  requirementsJson?: QuestRequirementsDto;
  giverNpcId?: number | null;
  giverMapId?: number | null;
  turnInNpcId?: number | null;
  turnInMapId?: number | null;
  objectivesJson?: QuestObjectiveBlockDto[];
  rewardsJson?: QuestRewardDto;
  metaConfigJson?: MetaQuestConfigDto | null;
  isActive?: boolean;
}

export class AdminQuestsController {
  private readonly prisma: PrismaClient;
  private readonly snapshotManager: SnapshotManager;
  private readonly progressService: QuestProgressService;

  constructor(prisma: PrismaClient, snapshotManager: SnapshotManager) {
    this.prisma = prisma;
    this.snapshotManager = snapshotManager;
    this.progressService = new QuestProgressService(prisma, () => this.getQuestTemplates());
  }

  /**
   * Lista todas as Quests enriquecidas com traduções PT-BR, Episódios, Metas Procedurais, Gatilhos e Requisitos.
   */
  public async getQuestTemplates() {
    const [i18nMap, quests, npcs, maps, monsters, classes, races, items] = await Promise.all([
      I18nCache.getTranslations(this.prisma, 'pt-BR'),
      this.prisma.questTemplate.findMany({
        orderBy: [{ chapterOrder: 'asc' }, { episodeOrder: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.npcTemplate.findMany(),
      this.prisma.gameMap.findMany(),
      this.prisma.monsterTemplate.findMany(),
      this.prisma.classTemplate.findMany(),
      this.prisma.race.findMany(),
      this.prisma.itemTemplate.findMany({ select: { id: true, code: true, nameI18nKey: true } }),
    ]);

    const npcNameMap = new Map<number, string>(
      npcs.map((n) => [n.id, i18nMap.get(n.nameI18nKey) ?? n.code]),
    );
    const mapInfoMap = new Map<number, { namePtBr: string; requiredLevel: number }>(
      maps.map((m) => [
        m.id,
        {
          namePtBr: i18nMap.get(m.nameI18nKey) ?? m.code,
          requiredLevel: m.requiredLevel || 1,
        },
      ]),
    );
    const mobNameMap = new Map<number, string>(
      monsters.map((mob) => [mob.id, i18nMap.get(mob.nameI18nKey) ?? mob.code]),
    );
    const classNameMap = new Map<number, string>(
      classes.map((cl) => [cl.id, i18nMap.get(cl.nameI18nKey) ?? cl.code]),
    );
    const raceNameMap = new Map<string, string>(
      races.map((r) => [String(r.code).toUpperCase(), i18nMap.get(r.nameI18nKey) ?? r.code]),
    );
    const itemNameMap = new Map<number, string>(
      items.map((it) => [it.id, i18nMap.get(it.nameI18nKey) ?? it.code]),
    );

    const mainQuests = quests
      .filter((q) => q.questCategory === 'MAIN' && q.isActive !== false)
      .sort(
        (a, b) =>
          (a.chapterOrder || 1) - (b.chapterOrder || 1) ||
          (a.episodeOrder || 1) - (b.episodeOrder || 1) ||
          a.id - b.id,
      );

    return quests.map((q) => {
      const giverMapInfo = q.giverMapId ? mapInfoMap.get(q.giverMapId) : null;
      const turnInMapInfo = q.turnInMapId ? mapInfoMap.get(q.turnInMapId) : null;
      const chapter = Math.max(1, Number(q.chapterOrder) || 1);
      const episode = Math.max(1, Number(q.episodeOrder) || 1);
      const episodeCode = `${chapter}-${episode}`;

      const trigCfg = (q.triggerConfigJson || {}) as QuestTriggerConfigDto;
      const reqCfg = (q.requirementsJson || {}) as QuestRequirementsDto;

      const autoRequiredQuestIds: number[] = [];
      let linearLockDescriptionPtBr = '';

      if (q.questCategory === 'MAIN') {
        const sameChapterPrevEpisodes = mainQuests.filter(
          (mq) =>
            mq.isActive !== false &&
            mq.id !== q.id &&
            Number(mq.chapterOrder) === chapter &&
            (Number(mq.episodeOrder) < episode ||
              (Number(mq.episodeOrder) === episode && mq.id < q.id)),
        );

        if (sameChapterPrevEpisodes.length > 0) {
          for (const prev of sameChapterPrevEpisodes) {
            autoRequiredQuestIds.push(prev.id);
          }
          const immediatePrev = sameChapterPrevEpisodes[sameChapterPrevEpisodes.length - 1];
          linearLockDescriptionPtBr = `🔒 Libera ao concluir Ep. ${immediatePrev.chapterOrder}-${immediatePrev.episodeOrder} (${i18nMap.get(immediatePrev.titleI18nKey) ?? immediatePrev.code})`;
        } else if (chapter > 1) {
          const prevChapterQuests = mainQuests.filter((mq) => mq.isActive !== false && Number(mq.chapterOrder) === chapter - 1);
          for (const prev of prevChapterQuests) {
            autoRequiredQuestIds.push(prev.id);
          }
          if (prevChapterQuests.length > 0) {
            linearLockDescriptionPtBr = `🔒 Libera ao concluir todo o Capítulo ${chapter - 1} (${prevChapterQuests.length} episódio(s))`;
          }
        } else {
          linearLockDescriptionPtBr = `🟢 Início da Jornada (Capítulo 1 • Episódio 1-1)`;
        }
      } else if (reqCfg.requiredChapterCompleted && Number(reqCfg.requiredChapterCompleted) >= 1) {
        const targetChap = Number(reqCfg.requiredChapterCompleted);
        const chapQuests = mainQuests.filter((mq) => mq.isActive !== false && Number(mq.chapterOrder) === targetChap);
        for (const cq of chapQuests) {
          autoRequiredQuestIds.push(cq.id);
        }
      }

      const explicitPrereqId = q.prerequisiteQuestId || reqCfg.prerequisiteQuestId || null;
      if (explicitPrereqId && !autoRequiredQuestIds.includes(Number(explicitPrereqId))) {
        autoRequiredQuestIds.push(Number(explicitPrereqId));
      }

      let triggerSummaryPtBr = '';
      const tType = q.triggerType || 'NPC_INTERACT';
      if (tType === 'NPC_INTERACT') {
        const npcName = q.giverNpcId ? (npcNameMap.get(q.giverNpcId) ?? `NPC #${q.giverNpcId}`) : 'NPC';
        triggerSummaryPtBr = `💬 Falar com ${npcName}`;
      } else if (tType === 'AUTO_ON_PREV_QUEST') {
        triggerSummaryPtBr = `⚡ Automático ao concluir episódio anterior`;
      } else if (tType === 'ENTER_MAP') {
        const mInfo = trigCfg.triggerMapId ? mapInfoMap.get(Number(trigCfg.triggerMapId)) : giverMapInfo;
        const mLabel = mInfo ? `${mInfo.namePtBr} (Nv.${mInfo.requiredLevel})` : 'Qualquer Mapa';
        triggerSummaryPtBr = `🗺️ Ao entrar em ${mLabel}`;
      } else if (tType === 'REACH_LEVEL') {
        triggerSummaryPtBr = `⭐ Ao atingir Nível ${q.minLevel || 1}`;
      } else if (tType === 'KILL_MONSTER_TRIGGER') {
        const mobName = trigCfg.triggerMonsterId
          ? (mobNameMap.get(Number(trigCfg.triggerMonsterId)) ?? `Monstro #${trigCfg.triggerMonsterId}`)
          : 'Qualquer Monstro';
        triggerSummaryPtBr = `🐉 Ao derrotar ${mobName}`;
      }

      const reqParts: string[] = [];
      reqParts.push(`Nv. Mín ${q.minLevel || 1}`);
      if (q.questCategory === 'MAIN' && linearLockDescriptionPtBr) {
        reqParts.push(linearLockDescriptionPtBr.replace('🔒 ', '').replace('🟢 ', ''));
      } else if (explicitPrereqId) {
        const pq = quests.find((x) => x.id === Number(explicitPrereqId));
        if (pq) {
          reqParts.push(`Após Ep. ${pq.chapterOrder}-${pq.episodeOrder} (${i18nMap.get(pq.titleI18nKey) ?? pq.code})`);
        }
      }
      if (reqCfg.requiredChapterCompleted) reqParts.push(`Cap. ${reqCfg.requiredChapterCompleted} Completo`);
      if (reqCfg.requiredClassId) reqParts.push(`Classe: ${classNameMap.get(Number(reqCfg.requiredClassId)) ?? `#${reqCfg.requiredClassId}`}`);
      if (reqCfg.requiredElement) reqParts.push(`Elem: ${reqCfg.requiredElement}`);
      if (reqCfg.requireReborn) reqParts.push(`Exige Reborn ✨`);

      const rawMeta = (q as any).metaConfigJson;
      const normalizedMeta = q.questCategory === 'META' && rawMeta
        ? MetaQuestProceduralEngine.normalizeConfig(rawMeta)
        : null;

      let metaSummaryPtBr: string | null = null;
      if (normalizedMeta && normalizedMeta.stages.length > 0) {
        const firstCount = normalizedMeta.stages[0].requiredCount.toLocaleString('pt-BR');
        const lastCount = normalizedMeta.stages[normalizedMeta.stages.length - 1].requiredCount.toLocaleString('pt-BR');
        const targetLabel =
          normalizedMeta.targetType === 'KILL_RACE'
            ? `Raça ${raceNameMap.get(String(normalizedMeta.raceCode || '').toUpperCase()) ?? normalizedMeta.raceCode}`
            : normalizedMeta.targetType === 'COLLECT_ITEM'
            ? `Item ${itemNameMap.get(Number(normalizedMeta.itemTemplateId)) ?? `#${normalizedMeta.itemTemplateId}`}`
            : `Monstro ${mobNameMap.get(Number(normalizedMeta.monsterTemplateId)) ?? `#${normalizedMeta.monsterTemplateId}`}`;
        metaSummaryPtBr = `🎯 ${normalizedMeta.stages.length} Estágios (${firstCount} → ${lastCount}) • ${targetLabel}`;
      }

      const rewJson = (q.rewardsJson || {}) as QuestRewardDto;
      const rewardItemNamePtBr = rewJson.rewardItemTemplateId
        ? (itemNameMap.get(Number(rewJson.rewardItemTemplateId)) ?? `Item #${rewJson.rewardItemTemplateId}`)
        : null;

      return {
        ...q,
        metaConfigJson: normalizedMeta,
        metaSummaryPtBr,
        rewardItemNamePtBr,
        episodeCode,
        titlePtBr: i18nMap.get(q.titleI18nKey) ?? q.code,
        descriptionPtBr: q.descriptionI18nKey ? (i18nMap.get(q.descriptionI18nKey) ?? '') : '',
        dialogueOfferPtBr: q.dialogueOfferI18nKey ? (i18nMap.get(q.dialogueOfferI18nKey) ?? '') : '',
        dialogueActivePtBr: q.dialogueActiveI18nKey ? (i18nMap.get(q.dialogueActiveI18nKey) ?? '') : '',
        dialogueCompletePtBr: q.dialogueCompleteI18nKey ? (i18nMap.get(q.dialogueCompleteI18nKey) ?? '') : '',
        giverNpcNamePtBr: q.giverNpcId ? (npcNameMap.get(q.giverNpcId) ?? `NPC #${q.giverNpcId}`) : 'Automática',
        turnInNpcNamePtBr: q.turnInNpcId ? (npcNameMap.get(q.turnInNpcId) ?? `NPC #${q.turnInNpcId}`) : 'Mesmo NPC',
        giverMapNamePtBr: giverMapInfo
          ? `#${q.giverMapId} ${giverMapInfo.namePtBr} (Nv.${giverMapInfo.requiredLevel})`
          : '🌍 Todos os Mapas com este NPC',
        turnInMapNamePtBr: turnInMapInfo
          ? `#${q.turnInMapId} ${turnInMapInfo.namePtBr} (Nv.${turnInMapInfo.requiredLevel})`
          : '🌍 Todos os Mapas com este NPC',
        autoRequiredQuestIds,
        linearLockDescriptionPtBr,
        triggerSummaryPtBr,
        requirementSummaryPtBr: reqParts.join(' • '),
      };
    });
  }

  /**
   * Cria ou atualiza uma Quest (normal ou Meta Procedural) no PostgreSQL com chaves i18n (`quest_N`).
   */
  public async saveQuestTemplate(dto: SaveQuestTemplateDto, explicitId: number | null = null) {
    const validCategories = ['MAIN', 'SIDE', 'EPIC', 'PROFICIENCY', 'META'];
    const questCategory = validCategories.includes(String(dto.questCategory || '').toUpperCase())
      ? (String(dto.questCategory).toUpperCase() as 'MAIN' | 'SIDE' | 'EPIC' | 'PROFICIENCY' | 'META')
      : 'MAIN';

    const chapterOrder = Math.max(1, Number(dto.chapterOrder) || 1);
    const episodeOrder = Math.max(1, Number(dto.episodeOrder) || 1);
    const minLevel = Math.max(1, Number(dto.minLevel ?? dto.requirementsJson?.minLevel) || 1);
    let prerequisiteQuestId = dto.prerequisiteQuestId ? Number(dto.prerequisiteQuestId) : null;

    const repeatType = ['ONCE', 'REPEATABLE', 'DAILY'].includes(String(dto.repeatType || '').toUpperCase())
      ? String(dto.repeatType).toUpperCase()
      : 'ONCE';

    const validTriggers = ['NPC_INTERACT', 'AUTO_ON_PREV_QUEST', 'ENTER_MAP', 'REACH_LEVEL', 'KILL_MONSTER_TRIGGER'];
    const triggerType = validTriggers.includes(String(dto.triggerType || '').toUpperCase())
      ? String(dto.triggerType).toUpperCase()
      : 'NPC_INTERACT';

    const triggerConfigJson: QuestTriggerConfigDto = {
      triggerMapId: dto.triggerConfigJson?.triggerMapId ? Number(dto.triggerConfigJson.triggerMapId) : null,
      triggerMonsterId: dto.triggerConfigJson?.triggerMonsterId ? Number(dto.triggerConfigJson.triggerMonsterId) : null,
      autoAcceptOnTrigger: Boolean(dto.triggerConfigJson?.autoAcceptOnTrigger),
    };

    const requirementsJson: QuestRequirementsDto = {
      minLevel,
      prerequisiteQuestId,
      requiredChapterCompleted: dto.requirementsJson?.requiredChapterCompleted
        ? Number(dto.requirementsJson.requiredChapterCompleted)
        : null,
      requiredElement: dto.requirementsJson?.requiredElement || null,
      requiredClassId: dto.requirementsJson?.requiredClassId ? Number(dto.requirementsJson.requiredClassId) : null,
      requireReborn: Boolean(dto.requirementsJson?.requireReborn),
    };

    const giverNpcId = dto.giverNpcId ? Number(dto.giverNpcId) : null;
    const giverMapId = dto.giverMapId ? Number(dto.giverMapId) : null;
    const turnInNpcId = dto.turnInNpcId ? Number(dto.turnInNpcId) : giverNpcId;
    const turnInMapId = dto.turnInMapId ? Number(dto.turnInMapId) : null;

    let objectivesJson: QuestObjectiveBlockDto[] = Array.isArray(dto.objectivesJson) ? dto.objectivesJson : [];
    let rewardsJson: QuestRewardDto =
      dto.rewardsJson && typeof dto.rewardsJson === 'object'
        ? { ...dto.rewardsJson, statPoints: 0 }
        : { exp: 100, gold: 50, statPoints: 0 };
    // REGRA SAGRADA MANDATÓRIA: Nenhuma missão pode conceder pontos de atributos livres para distribuir.
    rewardsJson.statPoints = 0;

    let metaConfigJson: MetaQuestConfigDto | null = null;
    if (questCategory === 'META') {
      metaConfigJson = MetaQuestProceduralEngine.normalizeConfig(dto.metaConfigJson || {});
      const firstStage = metaConfigJson.stages[0];
      objectivesJson = [
        {
          type: metaConfigJson.targetType,
          monsterTemplateId: metaConfigJson.targetType === 'KILL_MONSTER' ? metaConfigJson.monsterTemplateId : null,
          raceCode: metaConfigJson.targetType === 'KILL_RACE' ? metaConfigJson.raceCode : null,
          itemTemplateId: metaConfigJson.targetType === 'COLLECT_ITEM' ? metaConfigJson.itemTemplateId : null,
          dropSourceMode: metaConfigJson.dropSourceMode,
          dropMonsterTemplateId: metaConfigJson.dropMonsterTemplateId,
          dropRaceCode: metaConfigJson.dropRaceCode,
          dropChancePct: metaConfigJson.dropChancePct,
          requiredCount: firstStage?.requiredCount || 10,
        },
      ];
      rewardsJson = {
        exp: firstStage?.rewardExp || 0,
        gold: firstStage?.rewardGold || 0,
        statPoints: 0,
        rewardItemTemplateId: firstStage?.rewardItemTemplateId || null,
        rewardItemQuantity: firstStage?.rewardItemQuantity || 0,
        triggerReborn: Boolean(firstStage?.triggerReborn),
      };
    }

    const isActive = dto.isActive !== undefined ? Boolean(dto.isActive) : true;
    let finalTitle = (dto.titlePtBr ?? '').trim();
    const finalDesc = (dto.descriptionPtBr ?? '').trim();
    const finalOffer = (dto.dialogueOfferPtBr ?? '').trim();
    const finalActive = (dto.dialogueActivePtBr ?? '').trim();
    const finalComplete = (dto.dialogueCompletePtBr ?? '').trim();

    let saved: any;

    await this.prisma.$transaction(async (tx) => {
      if (questCategory === 'MAIN' && !prerequisiteQuestId) {
        const allMain = await tx.questTemplate.findMany({
          where: { questCategory: 'MAIN' },
          orderBy: [{ chapterOrder: 'asc' }, { episodeOrder: 'asc' }, { id: 'asc' }],
        });
        const candidates = allMain.filter((mq) => {
          if (explicitId && mq.id === explicitId) return false;
          if (mq.chapterOrder === chapterOrder && mq.episodeOrder < episodeOrder) return true;
          if (episodeOrder === 1 && chapterOrder > 1 && mq.chapterOrder === chapterOrder - 1) return true;
          return false;
        });
        if (candidates.length > 0) {
          prerequisiteQuestId = candidates[candidates.length - 1].id;
          requirementsJson.prerequisiteQuestId = prerequisiteQuestId;
        }
      }

      let targetId = explicitId;

      if (!targetId) {
        const tempCode = `quest_pending_${Date.now()}`;
        const created = await tx.questTemplate.create({
          data: {
            code: tempCode,
            titleI18nKey: `quest.${tempCode}.title`,
            questCategory,
            chapterOrder,
            episodeOrder,
            minLevel,
            prerequisiteQuestId,
            repeatType,
            triggerType,
            triggerConfigJson: triggerConfigJson as any,
            requirementsJson: requirementsJson as any,
            giverNpcId,
            giverMapId,
            turnInNpcId,
            turnInMapId,
            objectivesJson: objectivesJson as any,
            rewardsJson: rewardsJson as any,
            metaConfigJson: metaConfigJson as any,
            isActive,
          },
        });
        targetId = created.id;
      }

      const autoCode = `quest_${targetId}`;
      const titleKey = `quest.${autoCode}.title`;
      const descKey = `quest.${autoCode}.description`;
      const offerKey = `quest.${autoCode}.dialogue_offer`;
      const activeKey = `quest.${autoCode}.dialogue_active`;
      const completeKey = `quest.${autoCode}.dialogue_complete`;

      if (!finalTitle) finalTitle = `Missão #${targetId}`;

      const i18nEntries = [
        { key: titleKey, text: finalTitle },
        { key: descKey, text: finalDesc },
        { key: offerKey, text: finalOffer },
        { key: activeKey, text: finalActive },
        { key: completeKey, text: finalComplete },
      ];

      for (const entry of i18nEntries) {
        await tx.i18nTranslation.upsert({
          where: { key_locale: { key: entry.key, locale: 'pt-BR' } },
          update: { text: entry.text },
          create: { key: entry.key, locale: 'pt-BR', text: entry.text },
        });
      }

      saved = await tx.questTemplate.update({
        where: { id: targetId },
        data: {
          code: autoCode,
          titleI18nKey: titleKey,
          descriptionI18nKey: descKey,
          dialogueOfferI18nKey: offerKey,
          dialogueActiveI18nKey: activeKey,
          dialogueCompleteI18nKey: completeKey,
          questCategory,
          chapterOrder,
          episodeOrder,
          minLevel,
          prerequisiteQuestId,
          repeatType,
          triggerType,
          triggerConfigJson: triggerConfigJson as any,
          requirementsJson: requirementsJson as any,
          giverNpcId,
          giverMapId,
          turnInNpcId,
          turnInMapId,
          objectivesJson: objectivesJson as any,
          rewardsJson: rewardsJson as any,
          metaConfigJson: metaConfigJson as any,
          isActive,
        },
      });
    });

    await this.snapshotManager.exportToDisk();
    return saved;
  }

  public async deleteQuestTemplate(id: number) {
    await this.prisma.questTemplate.delete({ where: { id } });
    await this.snapshotManager.exportToDisk();
    return { deletedId: id };
  }

  public async getCharacterQuestState(characterId: number, currentMapId: number | null = null) {
    return this.progressService.getCharacterQuestState(characterId, currentMapId);
  }

  public async acceptQuest(characterId: number, questTemplateId: number, currentMapId: number | null = null) {
    return this.progressService.acceptQuest(characterId, questTemplateId, currentMapId);
  }

  public async interactNpcForQuest(characterId: number, npcTemplateId: number, currentMapId: number | null = null) {
    return this.progressService.interactNpcForQuest(characterId, npcTemplateId, currentMapId);
  }

  public async recordBattleVictoryBatch(
    characterId: number,
    defeatedMonsters: Array<{ monsterTemplateId: number; raceCode?: string; count?: number }>,
    bonusGold: number = 0,
  ) {
    return this.progressService.recordBattleVictoryBatch(characterId, defeatedMonsters, bonusGold);
  }

  public async recordBattleVictoryProgress(
    characterId: number,
    defeatedMonsterTemplateId: number,
    defeatedCount: number = 1,
  ) {
    return this.progressService.recordBattleVictoryBatch(characterId, [
      { monsterTemplateId: defeatedMonsterTemplateId, count: defeatedCount },
    ]);
  }

  public async turnInQuest(characterId: number, questTemplateId: number, currentMapId: number | null = null) {
    return this.progressService.turnInQuest(characterId, questTemplateId, currentMapId);
  }

  public async ensureInitialQuests() {
    return ensureInitialQuestsSeed(this, this.prisma);
  }
}
