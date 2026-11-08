/**
 * @file apps/server/src/controllers/AdminQuestsController.ts
 * @module @etheria/server
 * @description Controlador do Estúdio No-Code de Quests (`quest_templates`), Fluxograma por Capítulos/Episódios e Progresso (`/play`).
 *   - Missões Principais (`MAIN`) seguem progressão estritamente linear por Capítulos e Episódios (`1-1` -> `1-2` -> `1-3` ===> `2-1` -> `2-2`):
 *     - O Episódio `E` só libera quando o Episódio `E-1` do mesmo Capítulo é concluído.
 *     - O Capítulo `C` só libera quando TODOS os Episódios do Capítulo `C-1` são concluídos.
 *   - Todas as categorias (`MAIN`, `SIDE`, `EPIC`, `PROFICIENCY`) possuem Gatilho de Acionamento (`triggerType` + `triggerConfigJson`)
 *     e Requisitos de Desbloqueio (`requirementsJson`).
 *   - Calcula os indicadores de cabeça dos NPCs no mapa (`/play`):
 *     - `!` em Vermelho (`AVAILABLE`): Missão disponível para aceitar.
 *     - `?` em Cinza (`IN_PROGRESS`): Missão em andamento.
 *     - `?` em Vermelho (`TURN_IN_READY`): Missão concluída aguardando entrega no NPC.
 */

import { PrismaClient } from '@prisma/client';
import { SnapshotManager } from '@etheria/database';
import { ensureInitialQuestsSeed } from './AdminQuestsInitialSeeds.js';

export interface QuestObjectiveBlockDto {
  type: 'KILL_MONSTER' | 'TALK_NPC' | 'VISIT_MAP' | 'TAME_PET' | 'WIN_BATTLES';
  monsterTemplateId?: number | null;
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
  triggerReborn?: boolean;
}

export interface SaveQuestTemplateDto {
  titlePtBr: string;
  descriptionPtBr?: string;
  dialogueOfferPtBr?: string;
  dialogueActivePtBr?: string;
  dialogueCompletePtBr?: string;
  questCategory?: 'MAIN' | 'SIDE' | 'EPIC' | 'PROFICIENCY';
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
  isActive?: boolean;
}

export class AdminQuestsController {
  private readonly prisma: PrismaClient;
  private readonly snapshotManager: SnapshotManager;

  constructor(prisma: PrismaClient, snapshotManager: SnapshotManager) {
    this.prisma = prisma;
    this.snapshotManager = snapshotManager;
  }

  /**
   * Lista todas as Quests enriquecidas com traduções PT-BR, código de Episódio (`1-1`, `1-2`...),
   * cadeia linear automática de Capítulos/Episódios, Gatilhos e Requisitos.
   */
  public async getQuestTemplates() {
    const [translations, quests, npcs, maps, monsters, classes] = await Promise.all([
      this.prisma.i18nTranslation.findMany({ where: { locale: 'pt-BR' } }),
      this.prisma.questTemplate.findMany({
        orderBy: [{ chapterOrder: 'asc' }, { episodeOrder: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.npcTemplate.findMany(),
      this.prisma.gameMap.findMany(),
      this.prisma.monsterTemplate.findMany(),
      this.prisma.classTemplate.findMany(),
    ]);

    const i18nMap = new Map<string, string>();
    for (const t of translations) {
      i18nMap.set(t.key, t.text);
    }

    const npcNameMap = new Map<number, string>();
    for (const n of npcs) {
      npcNameMap.set(n.id, i18nMap.get(n.nameI18nKey) ?? n.code);
    }

    const mapInfoMap = new Map<number, { namePtBr: string; requiredLevel: number }>();
    for (const m of maps) {
      mapInfoMap.set(m.id, {
        namePtBr: i18nMap.get(m.nameI18nKey) ?? m.code,
        requiredLevel: m.requiredLevel || 1,
      });
    }

    const mobNameMap = new Map<number, string>();
    for (const mob of monsters) {
      mobNameMap.set(mob.id, i18nMap.get(mob.nameI18nKey) ?? mob.code);
    }

    const classNameMap = new Map<number, string>();
    for (const cl of classes) {
      classNameMap.set(cl.id, i18nMap.get(cl.nameI18nKey) ?? cl.code);
    }

    // Ordena todas as quests MAIN por (chapterOrder, episodeOrder, id) para calcular a cadeia linear
    const mainQuests = quests
      .filter((q) => q.questCategory === 'MAIN')
      .sort(
        (a, b) =>
          (a.chapterOrder || 1) - (b.chapterOrder || 1) ||
          (a.episodeOrder || 1) - (b.episodeOrder || 1) ||
          a.id - b.id
      );

    return quests.map((q) => {
      const giverMapInfo = q.giverMapId ? mapInfoMap.get(q.giverMapId) : null;
      const turnInMapInfo = q.turnInMapId ? mapInfoMap.get(q.turnInMapId) : null;
      const chapter = Math.max(1, Number(q.chapterOrder) || 1);
      const episode = Math.max(1, Number(q.episodeOrder) || 1);
      const episodeCode = `${chapter}-${episode}`;

      const trigCfg = (q.triggerConfigJson || {}) as QuestTriggerConfigDto;
      const reqCfg = (q.requirementsJson || {}) as QuestRequirementsDto;

      // Calcula os pré-requisitos lineares automáticos para Quests Principais (MAIN)
      const autoRequiredQuestIds: number[] = [];
      let linearLockDescriptionPtBr = '';

      if (q.questCategory === 'MAIN') {
        const sameChapterPrevEpisodes = mainQuests.filter(
          (mq) =>
            mq.id !== q.id &&
            Number(mq.chapterOrder) === chapter &&
            (Number(mq.episodeOrder) < episode ||
              (Number(mq.episodeOrder) === episode && mq.id < q.id))
        );

        if (sameChapterPrevEpisodes.length > 0) {
          for (const prev of sameChapterPrevEpisodes) {
            autoRequiredQuestIds.push(prev.id);
          }
          const immediatePrev = sameChapterPrevEpisodes[sameChapterPrevEpisodes.length - 1];
          linearLockDescriptionPtBr = `🔒 Libera ao concluir Ep. ${immediatePrev.chapterOrder}-${immediatePrev.episodeOrder} (${i18nMap.get(immediatePrev.titleI18nKey) ?? immediatePrev.code})`;
        } else if (chapter > 1) {
          // Primeiro episódio de um Capítulo > 1: exige TODOS os episódios do Capítulo anterior (chapter - 1)
          const prevChapterQuests = mainQuests.filter((mq) => Number(mq.chapterOrder) === chapter - 1);
          for (const prev of prevChapterQuests) {
            autoRequiredQuestIds.push(prev.id);
          }
          if (prevChapterQuests.length > 0) {
            linearLockDescriptionPtBr = `🔒 Libera ao concluir todo o Capítulo ${chapter - 1} (${prevChapterQuests.length} episódio(s))`;
          }
        } else {
          linearLockDescriptionPtBr = `🟢 Início da Jornada (Capítulo 1 • Episódio 1-1)`;
        }
      } else {
        // Para SIDE, EPIC e PROFICIENCY, verifica se exige um Capítulo completo ou Quest específica
        if (reqCfg.requiredChapterCompleted && Number(reqCfg.requiredChapterCompleted) >= 1) {
          const targetChap = Number(reqCfg.requiredChapterCompleted);
          const chapQuests = mainQuests.filter((mq) => Number(mq.chapterOrder) === targetChap);
          for (const cq of chapQuests) {
            autoRequiredQuestIds.push(cq.id);
          }
        }
      }

      const explicitPrereqId = q.prerequisiteQuestId || reqCfg.prerequisiteQuestId || null;
      if (explicitPrereqId && !autoRequiredQuestIds.includes(Number(explicitPrereqId))) {
        autoRequiredQuestIds.push(Number(explicitPrereqId));
      }

      // Resumo amigável do Gatilho (Trigger)
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

      // Resumo amigável dos Requisitos (Requirements)
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
      if (reqCfg.requiredChapterCompleted) {
        reqParts.push(`Cap. ${reqCfg.requiredChapterCompleted} Completo`);
      }
      if (reqCfg.requiredClassId) {
        reqParts.push(`Classe: ${classNameMap.get(Number(reqCfg.requiredClassId)) ?? `#${reqCfg.requiredClassId}`}`);
      }
      if (reqCfg.requiredElement) {
        reqParts.push(`Elem: ${reqCfg.requiredElement}`);
      }
      if (reqCfg.requireReborn) {
        reqParts.push(`Exige Reborn ✨`);
      }

      return {
        ...q,
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
   * Cria ou atualiza uma Quest no banco PostgreSQL com chaves i18n auto-incrementadas (`quest_N`),
   * mantendo a numeração de Capítulo (`chapterOrder`) e Episódio (`episodeOrder`) e os gatilhos/requisitos.
   */
  public async saveQuestTemplate(dto: SaveQuestTemplateDto, explicitId: number | null = null) {
    const validCategories = ['MAIN', 'SIDE', 'EPIC', 'PROFICIENCY'];
    const questCategory = validCategories.includes(String(dto.questCategory || '').toUpperCase())
      ? (String(dto.questCategory).toUpperCase() as 'MAIN' | 'SIDE' | 'EPIC' | 'PROFICIENCY')
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

    const objectivesJson = Array.isArray(dto.objectivesJson) ? dto.objectivesJson : [];
    const rewardsJson =
      dto.rewardsJson && typeof dto.rewardsJson === 'object'
        ? dto.rewardsJson
        : { exp: 100, gold: 50, statPoints: 0 };
    const isActive = dto.isActive !== undefined ? Boolean(dto.isActive) : true;

    let finalTitle = (dto.titlePtBr ?? '').trim();
    const finalDesc = (dto.descriptionPtBr ?? '').trim();
    const finalOffer = (dto.dialogueOfferPtBr ?? '').trim();
    const finalActive = (dto.dialogueActivePtBr ?? '').trim();
    const finalComplete = (dto.dialogueCompletePtBr ?? '').trim();

    let saved: any;

    await this.prisma.$transaction(async (tx) => {
      // Se for uma Quest MAIN e não tiver prerequisiteQuestId explícito, vincula automaticamente ao episódio anterior
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

  /**
   * Calcula o estado completo de Quests de um Personagem no Mapa Atual (`/play`),
   * aplicando a trava linear de Episódios (`1-1` -> `1-2` -> `1-3`) e Capítulos (`Cap. 1` -> `Cap. 2`),
   * além dos Requisitos (`requirementsJson`) e Gatilhos (`triggerType`).
   */
  public async getCharacterQuestState(characterId: number, currentMapId: number | null = null) {
    const [character, allQuests, progressRows] = await Promise.all([
      this.prisma.playerCharacter.findUnique({ where: { id: Number(characterId) } }),
      this.getQuestTemplates(),
      this.prisma.characterQuestProgress.findMany({ where: { characterId: Number(characterId) } }),
    ]);

    if (!character) {
      throw new Error(`Personagem #${characterId} não encontrado.`);
    }

    const activeMapId = currentMapId ? Number(currentMapId) : character.currentMapId;
    const progressMap = new Map<number, any>();
    for (const p of progressRows) {
      progressMap.set(p.questTemplateId, p);
    }

    const enrichedQuests = allQuests
      .filter((q) => q.isActive !== false)
      .map((q) => {
        const prog = progressMap.get(q.id);
        const objectives = Array.isArray(q.objectivesJson)
          ? (q.objectivesJson as unknown as QuestObjectiveBlockDto[])
          : [];
        const counts: number[] = Array.isArray(prog?.progressJson)
          ? (prog.progressJson as number[])
          : objectives.map(() => 0);

        const reqCfg = (q.requirementsJson || {}) as QuestRequirementsDto;

        let playerState: 'LOCKED' | 'AVAILABLE' | 'IN_PROGRESS' | 'TURN_IN_READY' | 'COMPLETED' = 'LOCKED';

        if (prog) {
          if (prog.status === 'COMPLETED_PENDING_TURNIN') {
            playerState = 'TURN_IN_READY';
          } else if (prog.status === 'IN_PROGRESS') {
            playerState = 'IN_PROGRESS';
          } else if (prog.status === 'TURNED_IN') {
            playerState = q.repeatType === 'ONCE' ? 'COMPLETED' : 'AVAILABLE';
          }
        } else {
          // 1. Verifica Nível Mínimo
          const levelOk = (character.level || 1) >= (q.minLevel || 1);

          // 2. Verifica Cadeia Linear de Episódios/Capítulos + Quest Pré-Requisito
          const allPrereqsOk = (q.autoRequiredQuestIds || []).every((reqQuestId: number) => {
            const preProg = progressMap.get(Number(reqQuestId));
            return Boolean(preProg && preProg.status === 'TURNED_IN');
          });

          // 3. Verifica Classe, Elemento e Reborn nos Requisitos
          const classOk =
            !reqCfg.requiredClassId || Number(character.classTemplateId) === Number(reqCfg.requiredClassId);
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

        // Formata objetivos com contadores atuais para o cliente /play
        const formattedObjectives = objectives.map((obj, idx) => {
          const cur = Number(counts[idx] || 0);
          const req = Math.max(1, Number(obj.requiredCount) || 1);
          return {
            ...obj,
            currentCount: cur,
            requiredCount: req,
            completed: cur >= req,
            descriptionPtBr: obj.labelPtBr || obj.type,
          };
        });

        const rew = (q.rewardsJson || {}) as QuestRewardDto;

        return {
          ...q,
          status:
            playerState === 'TURN_IN_READY'
              ? 'READY_TO_TURN_IN'
              : playerState,
          playerState,
          progressCounts: counts,
          objectives: formattedObjectives,
          rewards: {
            exp: Number(rew.exp) || 0,
            gold: Number(rew.gold) || 0,
            freePointsBonus: Number(rew.statPoints) || 0,
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

    // Calcula o indicador de cabeça por npcTemplateId no mapa atual:
    // Prioridade 1: ? Vermelho (TURN_IN_READY)
    // Prioridade 2: ! Vermelho (AVAILABLE)
    // Prioridade 3: ? Cinza (IN_PROGRESS)
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
      quests: enrichedQuests,
      npcHeadIndicators,
    };
  }

  /**
   * Jogador aceita uma Quest no NPC (`! vermelho`).
   */
  public async acceptQuest(characterId: number, questTemplateId: number, currentMapId: number | null = null) {
    const state = await this.getCharacterQuestState(characterId, currentMapId);
    const quest = state.quests.find((q) => q.id === Number(questTemplateId));
    if (!quest) {
      throw new Error('Missão não encontrada.');
    }
    if (quest.playerState !== 'AVAILABLE') {
      throw new Error(
        quest.linearLockDescriptionPtBr || 'Esta missão ainda está bloqueada pelos requisitos anteriores.'
      );
    }
    if (!quest.giverMapAllowed) {
      throw new Error(`Esta missão só pode ser aceita no mapa: ${quest.giverMapNamePtBr}`);
    }

    const objectives = Array.isArray(quest.objectivesJson)
      ? (quest.objectivesJson as unknown as QuestObjectiveBlockDto[])
      : [];
    const initialCounts = objectives.map((obj) => {
      if (obj.type === 'VISIT_MAP' && (!obj.mapId || Number(obj.mapId) === Number(state.currentMapId))) {
        return obj.requiredCount || 1;
      }
      return 0;
    });

    const allDone = objectives.every((obj, idx) => (initialCounts[idx] || 0) >= (obj.requiredCount || 1));
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
        progressJson: initialCounts as any,
      },
      create: {
        characterId: Number(characterId),
        questTemplateId: Number(questTemplateId),
        status: newStatus,
        progressJson: initialCounts as any,
      },
    });

    const updatedState = await this.getCharacterQuestState(characterId, currentMapId);
    return { questState: updatedState };
  }

  /**
   * Atualiza objetivos `TALK_NPC` quando o jogador interage/conversa com um NPC no mapa.
   */
  public async interactNpcForQuest(characterId: number, npcTemplateId: number, currentMapId: number | null = null) {
    const state = await this.getCharacterQuestState(characterId, currentMapId);
    const inProgressQuests = state.quests.filter((q) => q.playerState === 'IN_PROGRESS');

    for (const q of inProgressQuests) {
      const objectives = Array.isArray(q.objectivesJson)
        ? (q.objectivesJson as unknown as QuestObjectiveBlockDto[])
        : [];
      const counts = [...q.progressCounts];
      let changed = false;

      objectives.forEach((obj, idx) => {
        if (obj.type === 'TALK_NPC' && Number(obj.npcTemplateId) === Number(npcTemplateId)) {
          const mapOk = !obj.mapId || !state.currentMapId || Number(obj.mapId) === Number(state.currentMapId);
          if (mapOk && (counts[idx] || 0) < (obj.requiredCount || 1)) {
            counts[idx] = obj.requiredCount || 1;
            changed = true;
          }
        }
      });

      if (changed) {
        const allDone = objectives.every((obj, idx) => (counts[idx] || 0) >= (obj.requiredCount || 1));
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
   * Avança automaticamente objetivos `KILL_MONSTER` e `WIN_BATTLES` quando o jogador vence uma batalha.
   */
  public async recordBattleVictoryProgress(
    characterId: number,
    defeatedMonsterTemplateId: number,
    defeatedCount: number = 1
  ) {
    if (!characterId) return;
    const state = await this.getCharacterQuestState(characterId, null);
    const inProgressQuests = state.quests.filter((q) => q.playerState === 'IN_PROGRESS');

    for (const q of inProgressQuests) {
      const objectives = Array.isArray(q.objectivesJson)
        ? (q.objectivesJson as unknown as QuestObjectiveBlockDto[])
        : [];
      const counts = [...q.progressCounts];
      let changed = false;

      objectives.forEach((obj, idx) => {
        const req = Math.max(1, Number(obj.requiredCount) || 1);
        if ((counts[idx] || 0) >= req) return;

        if (obj.type === 'WIN_BATTLES') {
          counts[idx] = Math.min(req, (counts[idx] || 0) + 1);
          changed = true;
        } else if (obj.type === 'KILL_MONSTER') {
          if (!obj.monsterTemplateId || Number(obj.monsterTemplateId) === Number(defeatedMonsterTemplateId)) {
            counts[idx] = Math.min(req, (counts[idx] || 0) + Math.max(1, Number(defeatedCount) || 1));
            changed = true;
          }
        }
      });

      if (changed) {
        const allDone = objectives.every((obj, idx) => (counts[idx] || 0) >= (obj.requiredCount || 1));
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
  }

  /**
   * Jogador entrega a Quest concluída no NPC (`? vermelho`) e recebe as recompensas.
   * Se o próximo episódio tiver gatilho `AUTO_ON_PREV_QUEST`, inicia-o automaticamente!
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

    const rewards = (quest.rewardsJson as QuestRewardDto) || {};
    const expGain = Math.max(0, Number(rewards.exp) || 0);
    const statPointsGain = Math.max(0, Number(rewards.statPoints) || 0);
    const triggerReborn = Boolean(rewards.triggerReborn);

    let updatedCharSummary: any = null;

    await this.prisma.$transaction(async (tx) => {
      const pc = await tx.playerCharacter.findUnique({ where: { id: Number(characterId) } });
      if (!pc) throw new Error('Personagem não encontrado.');

      let newExp = Number(pc.experience || 0) + expGain;
      let newLevel = pc.level || 1;
      let newStatPoints = (pc.unspentStatPoints || 0) + statPointsGain;

      while (newExp >= newLevel * 200) {
        newExp -= newLevel * 200;
        newLevel += 1;
        newStatPoints += 5;
      }

      const updatedPc = await tx.playerCharacter.update({
        where: { id: pc.id },
        data: {
          experience: BigInt(newExp),
          level: newLevel,
          unspentStatPoints: newStatPoints,
          isReborn: triggerReborn ? true : pc.isReborn,
        },
      });

      updatedCharSummary = {
        id: updatedPc.id,
        level: updatedPc.level,
        exp: Number(updatedPc.experience),
        freePoints: updatedPc.unspentStatPoints,
        isReborn: updatedPc.isReborn,
      };

      await tx.characterQuestProgress.update({
        where: {
          characterId_questTemplateId: {
            characterId: pc.id,
            questTemplateId: quest.id,
          },
        },
        data: {
          status: 'TURNED_IN',
          completedCount: { increment: 1 },
        },
      });
    });

    // Verifica se alguma Quest recém-desbloqueada possui gatilho AUTO_ON_PREV_QUEST com autoAcceptOnTrigger
    const afterState = await this.getCharacterQuestState(characterId, currentMapId);
    for (const nextQ of afterState.quests) {
      const trigCfg = (nextQ.triggerConfigJson || {}) as QuestTriggerConfigDto;
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

    const finalState = await this.getCharacterQuestState(characterId, currentMapId);
    return {
      questState: finalState,
      character: updatedCharSummary,
    };
  }

  /**
   * Semeia e atualiza a árvore inicial de Quests com Capítulos e Episódios (`1-1`, `1-2`, `1-3` -> `2-1`, `2-2`),
   * além de Secundária, Proficiência e Épica, com Gatilhos e Requisitos preenchidos.
   */
  public async ensureInitialQuests() {
    return ensureInitialQuestsSeed(this, this.prisma);
  }
}
