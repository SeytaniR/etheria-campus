/**
 * @file apps/server/src/controllers/AdminQuestsController.ts
 * @module @etheria/server
 * @description Controlador do Estúdio No-Code de Quests (`quest_templates`) e Progresso de Missões (`/play`).
 *   - Suporta as 4 categorias: Principal Linear (`MAIN`), Secundária (`SIDE`), Épica (`EPIC`) e Proficiência (`PROFICIENCY`).
 *   - Permite restringir o NPC de início e o NPC de entrega a um Mapa específico (com indicação de Nível) ou a Todos os Mapas (`null`).
 *   - Calcula os indicadores de cabeça dos NPCs no mapa (`/play`):
 *     - `!` em Vermelho (`AVAILABLE`): Missão disponível para aceitar.
 *     - `?` em Cinza (`IN_PROGRESS`): Missão em andamento.
 *     - `?` em Vermelho (`TURN_IN_READY`): Missão concluída aguardando entrega no NPC.
 */

import { PrismaClient } from '@prisma/client';
import { SnapshotManager } from '@etheria/database';

export interface QuestObjectiveBlockDto {
  type: 'KILL_MONSTER' | 'TALK_NPC' | 'VISIT_MAP' | 'TAME_PET' | 'WIN_BATTLES';
  monsterTemplateId?: number | null;
  npcTemplateId?: number | null;
  mapId?: number | null;
  requiredCount: number;
  labelPtBr?: string;
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
  minLevel?: number;
  prerequisiteQuestId?: number | null;
  repeatType?: 'ONCE' | 'REPEATABLE' | 'DAILY';
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
   * Lista todas as Quests enriquecidas com traduções PT-BR e nomes de NPCs/Mapas.
   */
  public async getQuestTemplates() {
    const [translations, quests, npcs, maps] = await Promise.all([
      this.prisma.i18nTranslation.findMany({ where: { locale: 'pt-BR' } }),
      this.prisma.questTemplate.findMany({ orderBy: [{ questCategory: 'asc' }, { chapterOrder: 'asc' }, { id: 'asc' }] }),
      this.prisma.npcTemplate.findMany(),
      this.prisma.gameMap.findMany(),
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

    return quests.map((q) => {
      const giverMapInfo = q.giverMapId ? mapInfoMap.get(q.giverMapId) : null;
      const turnInMapInfo = q.turnInMapId ? mapInfoMap.get(q.turnInMapId) : null;

      return {
        ...q,
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
      };
    });
  }

  /**
   * Cria ou atualiza uma Quest no banco PostgreSQL com chaves i18n auto-incrementadas (`quest_N`).
   */
  public async saveQuestTemplate(dto: SaveQuestTemplateDto, explicitId: number | null = null) {
    const validCategories = ['MAIN', 'SIDE', 'EPIC', 'PROFICIENCY'];
    const questCategory = validCategories.includes(String(dto.questCategory || '').toUpperCase())
      ? (String(dto.questCategory).toUpperCase() as 'MAIN' | 'SIDE' | 'EPIC' | 'PROFICIENCY')
      : 'MAIN';

    const chapterOrder = Math.max(1, Number(dto.chapterOrder) || 1);
    const minLevel = Math.max(1, Number(dto.minLevel) || 1);
    const prerequisiteQuestId = dto.prerequisiteQuestId ? Number(dto.prerequisiteQuestId) : null;
    const repeatType = ['ONCE', 'REPEATABLE', 'DAILY'].includes(String(dto.repeatType || '').toUpperCase())
      ? String(dto.repeatType).toUpperCase()
      : 'ONCE';

    const giverNpcId = dto.giverNpcId ? Number(dto.giverNpcId) : null;
    const giverMapId = dto.giverMapId ? Number(dto.giverMapId) : null;
    const turnInNpcId = dto.turnInNpcId ? Number(dto.turnInNpcId) : giverNpcId;
    const turnInMapId = dto.turnInMapId ? Number(dto.turnInMapId) : null;

    const objectivesJson = Array.isArray(dto.objectivesJson) ? dto.objectivesJson : [];
    const rewardsJson = dto.rewardsJson && typeof dto.rewardsJson === 'object' ? dto.rewardsJson : { exp: 100, gold: 50, statPoints: 0 };
    const isActive = dto.isActive !== undefined ? Boolean(dto.isActive) : true;

    let finalTitle = (dto.titlePtBr ?? '').trim();
    const finalDesc = (dto.descriptionPtBr ?? '').trim();
    const finalOffer = (dto.dialogueOfferPtBr ?? '').trim();
    const finalActive = (dto.dialogueActivePtBr ?? '').trim();
    const finalComplete = (dto.dialogueCompletePtBr ?? '').trim();

    let saved: any;

    await this.prisma.$transaction(async (tx) => {
      let targetId = explicitId;

      if (!targetId) {
        const tempCode = `quest_pending_${Date.now()}`;
        const created = await tx.questTemplate.create({
          data: {
            code: tempCode,
            titleI18nKey: `quest.${tempCode}.title`,
            questCategory,
            chapterOrder,
            minLevel,
            prerequisiteQuestId,
            repeatType,
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
          minLevel,
          prerequisiteQuestId,
          repeatType,
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
   * incluindo os indicadores na cabeça de cada NPC (`! vermelho`, `? cinza`, `? vermelho`).
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

    // Avalia cada Quest ativa para este personagem
    const enrichedQuests = allQuests
      .filter((q) => q.isActive !== false)
      .map((q) => {
        const prog = progressMap.get(q.id);
        const objectives = Array.isArray(q.objectivesJson) ? (q.objectivesJson as unknown as QuestObjectiveBlockDto[]) : [];
        const counts: number[] = Array.isArray(prog?.progressJson)
          ? (prog.progressJson as number[])
          : objectives.map(() => 0);

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
          // Verifica nível e pré-requisito
          const levelOk = (character.level || 1) >= (q.minLevel || 1);
          let prereqOk = true;
          if (q.prerequisiteQuestId) {
            const preProg = progressMap.get(q.prerequisiteQuestId);
            prereqOk = Boolean(preProg && preProg.status === 'TURNED_IN');
          }
          if (levelOk && prereqOk) {
            playerState = 'AVAILABLE';
          }
        }

        const giverMapAllowed = !q.giverMapId || !activeMapId || Number(q.giverMapId) === Number(activeMapId);
        const turnInMapAllowed = !q.turnInMapId || !activeMapId || Number(q.turnInMapId) === Number(activeMapId);

        return {
          ...q,
          playerState,
          progressCounts: counts,
          completedCount: prog?.completedCount || 0,
          giverMapAllowed,
          turnInMapAllowed,
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
      throw new Error('Esta missão não está disponível para aceitação no momento.');
    }
    if (!quest.giverMapAllowed) {
      throw new Error(`Esta missão só pode ser aceita no mapa: ${quest.giverMapNamePtBr}`);
    }

    const objectives = Array.isArray(quest.objectivesJson) ? (quest.objectivesJson as unknown as QuestObjectiveBlockDto[]) : [];
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

    return this.getCharacterQuestState(characterId, currentMapId);
  }

  /**
   * Atualiza objetivos `TALK_NPC` quando o jogador interage/conversa com um NPC no mapa.
   */
  public async interactNpcForQuest(characterId: number, npcTemplateId: number, currentMapId: number | null = null) {
    const state = await this.getCharacterQuestState(characterId, currentMapId);
    const inProgressQuests = state.quests.filter((q) => q.playerState === 'IN_PROGRESS');

    for (const q of inProgressQuests) {
      const objectives = Array.isArray(q.objectivesJson) ? (q.objectivesJson as unknown as QuestObjectiveBlockDto[]) : [];
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

    return this.getCharacterQuestState(characterId, currentMapId);
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
      const objectives = Array.isArray(q.objectivesJson) ? (q.objectivesJson as unknown as QuestObjectiveBlockDto[]) : [];
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

    await this.prisma.$transaction(async (tx) => {
      const pc = await tx.playerCharacter.findUnique({ where: { id: Number(characterId) } });
      if (!pc) throw new Error('Personagem não encontrado.');

      let newExp = Number(pc.experience || 0) + expGain;
      let newLevel = pc.level || 1;
      let newStatPoints = (pc.unspentStatPoints || 0) + statPointsGain;

      // Subida de nível automática simples por XP ganho na Quest
      while (newExp >= newLevel * 200) {
        newExp -= newLevel * 200;
        newLevel += 1;
        newStatPoints += 5;
      }

      await tx.playerCharacter.update({
        where: { id: pc.id },
        data: {
          experience: BigInt(newExp),
          level: newLevel,
          unspentStatPoints: newStatPoints,
          isReborn: triggerReborn ? true : pc.isReborn,
        },
      });

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

    return this.getCharacterQuestState(characterId, currentMapId);
  }

  /**
   * Semeia 5 Quests iniciais (Principal Cap.1 e Cap.2, Secundária, Proficiência e Épica) se o banco estiver vazio.
   */
  public async ensureInitialQuests() {
    try {
      const count = await this.prisma.questTemplate.count();
      if (count > 0) return;

      console.log('📜 [AdminQuestsController] Semeando Quests iniciais (Principal, Secundária, Proficiência e Épica)...');
      const npcs = await this.prisma.npcTemplate.findMany({ orderBy: { id: 'asc' } });
      const npc1 = npcs[0]?.id || 1;
      const npc2 = npcs[1]?.id || npc1;
      const npc3 = npcs[2]?.id || npc1;
      const npc4 = npcs[3]?.id || npc2;

      const q1 = await this.saveQuestTemplate({
        titlePtBr: 'Cap. 1: O Chamado de Izumo',
        descriptionPtBr: 'Apresente-se ao Sábio de Izumo para iniciar seu treinamento oficial no continente.',
        dialogueOfferPtBr: 'Bem-vindo a Izumo, jovem aventureiro! O Sábio de Izumo está procurando por você perto da praça central.',
        dialogueActivePtBr: 'O Sábio de Izumo está logo abaixo na vila. Vá conversar com ele!',
        dialogueCompletePtBr: 'Ah, então você é o novo recruta! Vejo grande potencial elemental em você.',
        questCategory: 'MAIN',
        chapterOrder: 1,
        minLevel: 1,
        prerequisiteQuestId: null,
        repeatType: 'ONCE',
        giverNpcId: npc1,
        giverMapId: null,
        turnInNpcId: npc2,
        turnInMapId: null,
        objectivesJson: [
          { type: 'TALK_NPC', npcTemplateId: npc2, mapId: null, requiredCount: 1, labelPtBr: 'Conversar com o Sábio de Izumo' },
        ],
        rewardsJson: { exp: 120, gold: 50, statPoints: 2 },
      });

      await this.saveQuestTemplate({
        titlePtBr: 'Cap. 2: Ameaça nas Estradas',
        descriptionPtBr: 'Derrote os saqueadores Sa Tặc da Areia que estão rondando os arredores de Izumo.',
        dialogueOfferPtBr: 'Antes de seguir viagem, precisamos conter os Sa Tặc da Areia. Derrote 2 deles em combate e volte até mim!',
        dialogueActivePtBr: 'Ainda restam Sa Tặc da Areia para derrotar. Use a Batalha para enfrentá-los!',
        dialogueCompletePtBr: 'Excelente! As rotas comerciais de Izumo estão seguras graças a você.',
        questCategory: 'MAIN',
        chapterOrder: 2,
        minLevel: 1,
        prerequisiteQuestId: q1.id,
        repeatType: 'ONCE',
        giverNpcId: npc2,
        giverMapId: null,
        turnInNpcId: npc2,
        turnInMapId: null,
        objectivesJson: [
          { type: 'KILL_MONSTER', monsterTemplateId: 1, requiredCount: 2, labelPtBr: 'Derrotar 2x Sa Tặc da Areia' },
        ],
        rewardsJson: { exp: 300, gold: 150, statPoints: 3 },
      });

      await this.saveQuestTemplate({
        titlePtBr: 'Remessa de Minérios Raros',
        descriptionPtBr: 'Avise o Joalheiro Pibu que a forja do Armeiro John já processou os cristais.',
        dialogueOfferPtBr: 'Ei! Estou ocupado na bigorna. Pode avisar o Joalheiro Pibu ali ao lado que os engastes dele ficaram prontos?',
        dialogueActivePtBr: 'O Joalheiro Pibu está esperando o recado logo ali à direita!',
        dialogueCompletePtBr: 'Maravilha! Eu estava mesmo aguardando esses engastes do John. Tome estas moedas pelo favor!',
        questCategory: 'SIDE',
        chapterOrder: 1,
        minLevel: 1,
        prerequisiteQuestId: null,
        repeatType: 'ONCE',
        giverNpcId: npc3,
        giverMapId: null,
        turnInNpcId: npc4,
        turnInMapId: null,
        objectivesJson: [
          { type: 'TALK_NPC', npcTemplateId: npc4, mapId: null, requiredCount: 1, labelPtBr: 'Entregar recado ao Joalheiro Pibu' },
        ],
        rewardsJson: { exp: 150, gold: 100, statPoints: 1 },
      });

      await this.saveQuestTemplate({
        titlePtBr: 'Proficiência: Veterano de Combate',
        descriptionPtBr: 'Prove sua maestria marcial vencendo 3 combates contra criaturas selvagens.',
        dialogueOfferPtBr: 'Quer aprimorar sua Proficiência de Combate? Vença 3 batalhas contra qualquer monstro e traga seu relatório!',
        dialogueActivePtBr: 'Continue treinando! Vença 3 batalhas para completar seu teste de Proficiência.',
        dialogueCompletePtBr: 'Sua postura de batalha evoluiu muito. Receba estes pontos extras de atributo!',
        questCategory: 'PROFICIENCY',
        chapterOrder: 1,
        minLevel: 1,
        prerequisiteQuestId: null,
        repeatType: 'REPEATABLE',
        giverNpcId: npc3,
        giverMapId: null,
        turnInNpcId: npc3,
        turnInMapId: null,
        objectivesJson: [
          { type: 'WIN_BATTLES', requiredCount: 3, labelPtBr: 'Vencer 3 Batalhas contra Monstros' },
        ],
        rewardsJson: { exp: 400, gold: 200, statPoints: 3 },
      });

      await this.saveQuestTemplate({
        titlePtBr: 'Prova Épica: Despertar Reborn',
        descriptionPtBr: 'Supere 5 batalhas decisivas para despertar sua linhagem espiritual e alcançar a Reencarnação.',
        dialogueOfferPtBr: 'Apenas guerreiros de nível 3 ou superior podem tentar o Ritual Épico de Reencarnação. Vença 5 batalhas para provar seu espírito!',
        dialogueActivePtBr: 'O caminho Épico exige perseverança. Vença 5 combates e retorne!',
        dialogueCompletePtBr: 'Que poder extraordinário! Sua alma ascendeu ao estado Reencarnado (Reborn)!',
        questCategory: 'EPIC',
        chapterOrder: 1,
        minLevel: 3,
        prerequisiteQuestId: null,
        repeatType: 'ONCE',
        giverNpcId: npc2,
        giverMapId: null,
        turnInNpcId: npc2,
        turnInMapId: null,
        objectivesJson: [
          { type: 'WIN_BATTLES', requiredCount: 5, labelPtBr: 'Vencer 5 Batalhas para o Ritual Épico' },
        ],
        rewardsJson: { exp: 1000, gold: 500, statPoints: 5, triggerReborn: true },
      });
    } catch (err) {
      console.warn('[AdminQuestsController] Aviso ao semear quests iniciais:', err);
    }
  }
}
