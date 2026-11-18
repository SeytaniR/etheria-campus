/**
 * @file apps/server/src/controllers/MonsterMetaQuestService.ts
 * @module @etheria/server
 * @description Sistema Procedural Automático de Quests Meta (Conquistas e Metas de Caça por Monstro e por Tipo/Raça).
 * @rules
 *   - Toda vez que um monstro é adicionado, cria-se automaticamente sua Quest Meta com 5 estágios (10, 100, 1.000, 10.000, 100.000).
 *   - Recompensas escalam x10: Ouro (10, 100, 1.000, 10.000, 100.000) e EXP (100, 1.000, 10.000, 100.000, 1.000.000).
 *   - Concede RIGOROSAMENTE 1 ponto de atributo fixo por missão/estágio completado (sempre 1 ponto, não escala).
 *   - Concede 1x Medalha de Caçador (item não comercializável) por missão completada.
 *   - Se o monstro for inativado ou deletado, a Quest Meta correspondente é inativada/deletada automaticamente.
 *   - Cria Quests Meta para tipos/raças de monstros na mesma proporção de metas e recompensas.
 *   - Auto-aceitação automática para personagens desde a criação, sem necessidade de NPC.
 */

import { PrismaClient, SnapshotManager } from '@etheria/database';
import type { MetaQuestConfigDto, MetaQuestStageDto } from './MetaQuestProceduralEngine.js';

export class MonsterMetaQuestService {
  public static readonly HUNTER_MEDAL_CODE = 'item_hunter_medal';
  public static readonly TARGET_TIERS = [10, 100, 1_000, 10_000, 100_000];

  public static readonly MONSTER_RACES: Array<{ code: string; labelPtBr: string }> = [
    { code: 'AQUATIC', labelPtBr: 'Aquático' },
    { code: 'BEAST', labelPtBr: 'Selvagem' },
    { code: 'CELESTIAL', labelPtBr: 'Celestial' },
    { code: 'DEMON', labelPtBr: 'Demônio' },
    { code: 'DRAGON', labelPtBr: 'Dragão' },
    { code: 'FAIRY', labelPtBr: 'Fada' },
    { code: 'HUMAN', labelPtBr: 'Humano' },
    { code: 'PLANT', labelPtBr: 'Planta' },
    { code: 'REPTILIAN', labelPtBr: 'Reptiliano' },
    { code: 'ROBOTIC', labelPtBr: 'Robótico' },
    { code: 'SPIRIT', labelPtBr: 'Espírito' },
  ];

  /**
   * Garante a existência do item 'Medalha de Caçador' (não comercializável) no banco de dados.
   */
  public static async getOrSeedHunterMedal(prisma: any): Promise<any> {
    await SnapshotManager.syncTableSequence(prisma, 'i18n_translations');
    await SnapshotManager.syncTableSequence(prisma, 'item_templates');

    let item = await prisma.itemTemplate.findUnique({
      where: { code: this.HUNTER_MEDAL_CODE },
    });

    const nameKey = 'item.item_hunter_medal.name';
    const descKey = 'item.item_hunter_medal.desc';

    await prisma.i18nTranslation.upsert({
      where: { key_locale: { key: nameKey, locale: 'pt-BR' } },
      create: { key: nameKey, locale: 'pt-BR', text: 'Medalha de Caçador' },
      update: { text: 'Medalha de Caçador' },
    });

    await prisma.i18nTranslation.upsert({
      where: { key_locale: { key: descKey, locale: 'pt-BR' } },
      create: {
        key: descKey,
        locale: 'pt-BR',
        text: 'Condecoração de honra concedida por completar grandes metas de caça em Etheria. Intransferível e não comercializável.',
      },
      update: {
        text: 'Condecoração de honra concedida por completar grandes metas de caça em Etheria. Intransferível e não comercializável.',
      },
    });

    if (!item) {
      item = await prisma.itemTemplate.create({
        data: {
          code: this.HUNTER_MEDAL_CODE,
          nameI18nKey: nameKey,
          descriptionI18nKey: descKey,
          mcreworkIconKey: '/play/assets/hud/item_hunter_medal.png',
          itemCategory: 'MATERIAL',
          rarityTier: 'S',
          requiredLevel: 1,
          isTradable: false,
          priceGold: 0,
          maxStack: 99999,
          cooldownSec: 0,
          targetType: 'NONE',
          effectType: 'MATERIAL',
          effectValue: 0,
          reqClassCodesJson: [],
          baseStatBonusesJson: {},
          combatStatBonusesJson: {},
          specialEffectJson: {},
          isActive: true,
        },
      });
    }

    return item;
  }

  /**
   * Constrói os 5 estágios procedurais com as regras fixadas pelo usuário:
   * 10 / 100 / 1.000 / 10.000 / 100.000 monstros.
   * Ouro: 10, 100, 1000, 10000, 100000 (x10).
   * XP: 100, 1000, 10000, 100000, 1000000 (x10).
   * Ponto de Atributo: FIXO 1 por missão/estágio (não escala).
   * Medalha: 1x Medalha de Caçador por missão/estágio.
   */
  public static buildProceduralStages(medalItemId: number): MetaQuestStageDto[] {
    return this.TARGET_TIERS.map((target, idx) => {
      const step = idx; // 0..4
      const gold = 10 * Math.pow(10, step);
      const exp = 100 * Math.pow(10, step);
      return {
        stageIndex: idx + 1,
        requiredCount: target,
        rewardExp: exp,
        rewardGold: gold,
        rewardStatPoints: 1, // 1 ponto de atributo FIXO por quest concluída
        rewardItemTemplateId: medalItemId,
        rewardItemQuantity: 1, // 1 Medalha por quest concluída
        triggerReborn: false,
        stageDialogueCompletePtBr: `Meta de ${target.toLocaleString('pt-BR')} abates atingida com louvor! Recompensas concedidas: ${gold.toLocaleString('pt-BR')} Ouro, ${exp.toLocaleString('pt-BR')} XP, +1 Ponto de Atributo e 1x Medalha de Caçador.`,
      };
    });
  }

  /**
   * Sincroniza proceduralmente todas as Quests Meta para monstros e tipos de monstros.
   */
  public static async syncAllMetaQuests(prisma: any): Promise<{ mobQuestsCount: number; raceQuestsCount: number }> {
    await SnapshotManager.syncTableSequence(prisma, 'i18n_translations');
    await SnapshotManager.syncTableSequence(prisma, 'quest_templates');
    const medal = await this.getOrSeedHunterMedal(prisma);
    const stages = this.buildProceduralStages(medal.id);

    // 1. Sincroniza Quests Meta por Monstro Individual
    const allMonsters = await prisma.monsterTemplate.findMany();
    const activeMonsters = allMonsters.filter((m: any) => m.isActive);
    const inactiveMonsters = allMonsters.filter((m: any) => !m.isActive);
    const activeMonsterIds = new Set(activeMonsters.map((m: any) => Number(m.id)));

    // Inativa quests de monstros inativos
    for (const inact of inactiveMonsters) {
      const qCode = `quest_meta_mob_${inact.id}`;
      await prisma.questTemplate.updateMany({
        where: { code: qCode },
        data: { isActive: false },
      });
    }

    // Exclui quests de monstros que foram deletados do banco
    const existingMobQuests = await prisma.questTemplate.findMany({
      where: { code: { startsWith: 'quest_meta_mob_' } },
      select: { id: true, code: true },
    });
    const allMonsterIdSet = new Set(allMonsters.map((m: any) => Number(m.id)));
    for (const q of existingMobQuests) {
      const match = q.code.match(/^quest_meta_mob_(\d+)$/);
      if (match) {
        const mobId = Number(match[1]);
        if (!allMonsterIdSet.has(mobId)) {
          await prisma.characterQuestProgress.deleteMany({ where: { questTemplateId: q.id } });
          await prisma.questTemplate.delete({ where: { id: q.id } });
        }
      }
    }

    // Cria ou atualiza as quests dos monstros ativos
    const i18nList = await prisma.i18nTranslation.findMany({ where: { locale: 'pt-BR' } });
    const i18nMap = new Map<string, string>(i18nList.map((t: any) => [t.key, t.text]));

    for (const mob of activeMonsters) {
      const mobName = i18nMap.get(mob.nameI18nKey) ?? mob.code;
      const qCode = `quest_meta_mob_${mob.id}`;
      const titleKey = `quest.meta.mob.${mob.id}.title`;
      const descKey = `quest.meta.mob.${mob.id}.desc`;

      await prisma.i18nTranslation.upsert({
        where: { key_locale: { key: titleKey, locale: 'pt-BR' } },
        create: { key: titleKey, locale: 'pt-BR', text: `Meta de Caça: ${mobName}` },
        update: { text: `Meta de Caça: ${mobName}` },
      });

      await prisma.i18nTranslation.upsert({
        where: { key_locale: { key: descKey, locale: 'pt-BR' } },
        create: {
          key: descKey,
          locale: 'pt-BR',
          text: `Extermine espécimes de ${mobName} em Etheria para provar sua maestria e receber honrarias de caçador.`,
        },
        update: {
          text: `Extermine espécimes de ${mobName} em Etheria para provar sua maestria e receber honrarias de caçador.`,
        },
      });

      const metaCfg: MetaQuestConfigDto = {
        targetType: 'KILL_MONSTER',
        variantTier: 'ANY',
        monsterTemplateId: mob.id,
        initialRequiredCount: 10,
        targetMultiplier: 10,
        stageCount: 5,
        stages,
      };

      await prisma.questTemplate.upsert({
        where: { code: qCode },
        create: {
          code: qCode,
          titleI18nKey: titleKey,
          descriptionI18nKey: descKey,
          questCategory: 'META',
          chapterOrder: 99,
          episodeOrder: mob.id,
          minLevel: 1,
          repeatType: 'ONCE',
          triggerType: 'KILL_MONSTER_TRIGGER',
          triggerConfigJson: {},
          requirementsJson: {},
          objectivesJson: [
            {
              type: 'KILL_MONSTER',
              monsterTemplateId: mob.id,
              requiredCount: 10,
            },
          ],
          rewardsJson: {
            gold: 10,
            exp: 100,
            statPoints: 1,
            rewardStatPoints: 1,
            rewardItemTemplateId: medal.id,
            rewardItemQuantity: 1,
          },
          metaConfigJson: metaCfg as any,
          isActive: true,
        },
        update: {
          titleI18nKey: titleKey,
          descriptionI18nKey: descKey,
          metaConfigJson: metaCfg as any,
          isActive: true,
        },
      });
    }

    // 2. Sincroniza Quests Meta por Tipo/Raça de Monstro
    for (const r of this.MONSTER_RACES) {
      const qCode = `quest_meta_race_${r.code.toLowerCase()}`;
      const titleKey = `quest.meta.race.${r.code.toLowerCase()}.title`;
      const descKey = `quest.meta.race.${r.code.toLowerCase()}.desc`;

      await prisma.i18nTranslation.upsert({
        where: { key_locale: { key: titleKey, locale: 'pt-BR' } },
        create: { key: titleKey, locale: 'pt-BR', text: `Meta de Caça: Raça ${r.labelPtBr}` },
        update: { text: `Meta de Caça: Raça ${r.labelPtBr}` },
      });

      await prisma.i18nTranslation.upsert({
        where: { key_locale: { key: descKey, locale: 'pt-BR' } },
        create: {
          key: descKey,
          locale: 'pt-BR',
          text: `Elimine monstros de raça ${r.labelPtBr} nos campos e masmorras para aperfeiçoar seu conhecimento anatômico e marcial.`,
        },
        update: {
          text: `Elimine monstros de raça ${r.labelPtBr} nos campos e masmorras para aperfeiçoar seu conhecimento anatômico e marcial.`,
        },
      });

      const metaCfg: MetaQuestConfigDto = {
        targetType: 'KILL_RACE',
        variantTier: 'ANY',
        raceCode: r.code,
        initialRequiredCount: 10,
        targetMultiplier: 10,
        stageCount: 5,
        stages,
      };

      await prisma.questTemplate.upsert({
        where: { code: qCode },
        create: {
          code: qCode,
          titleI18nKey: titleKey,
          descriptionI18nKey: descKey,
          questCategory: 'META',
          chapterOrder: 98,
          episodeOrder: 1,
          minLevel: 1,
          repeatType: 'ONCE',
          triggerType: 'KILL_MONSTER_TRIGGER',
          triggerConfigJson: {},
          requirementsJson: {},
          objectivesJson: [
            {
              type: 'KILL_RACE',
              raceCode: r.code,
              requiredCount: 10,
            },
          ],
          rewardsJson: {
            gold: 10,
            exp: 100,
            statPoints: 1,
            rewardStatPoints: 1,
            rewardItemTemplateId: medal.id,
            rewardItemQuantity: 1,
          },
          metaConfigJson: metaCfg as any,
          isActive: true,
        },
        update: {
          titleI18nKey: titleKey,
          descriptionI18nKey: descKey,
          metaConfigJson: metaCfg as any,
          isActive: true,
        },
      });
    }

    return {
      mobQuestsCount: activeMonsters.length,
      raceQuestsCount: this.MONSTER_RACES.length,
    };
  }

  /**
   * Garante que todas as Quests Meta ativas sejam aceitas automaticamente pelo personagem.
   */
  public static async ensurePlayerMetaQuests(prisma: any, characterId: number): Promise<number> {
    if (!characterId) return 0;

    const metaQuests = await prisma.questTemplate.findMany({
      where: { questCategory: 'META', isActive: true },
      select: { id: true },
    });

    if (metaQuests.length === 0) return 0;

    const existingProgress = await prisma.characterQuestProgress.findMany({
      where: { characterId: Number(characterId) },
      select: { questTemplateId: true },
    });

    const enrolledSet = new Set(existingProgress.map((p: any) => p.questTemplateId));
    const missing = metaQuests.filter((q: any) => !enrolledSet.has(q.id));

    if (missing.length === 0) return 0;

    await SnapshotManager.syncTableSequence(prisma, 'character_quest_progress');

    for (const q of missing) {
      await prisma.characterQuestProgress.upsert({
        where: {
          characterId_questTemplateId: {
            characterId: Number(characterId),
            questTemplateId: q.id,
          },
        },
        create: {
          characterId: Number(characterId),
          questTemplateId: q.id,
          status: 'IN_PROGRESS',
          currentStage: 1,
          progressJson: [0],
          completedCount: 0,
        },
        update: {},
      });
    }

    return missing.length;
  }
}
