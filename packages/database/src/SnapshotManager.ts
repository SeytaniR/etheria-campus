/**
 * @file packages/database/src/SnapshotManager.ts
 * @module @etheria/database
 * @description Gerenciador Orientado a Objetos responsável por sincronizar bidirecionalmente
 *   os dados Low-Code do PostgreSQL com arquivos JSON versionados em `packages/database/snapshots/`.
 * @rules Garante zero perda de dados entre trocas de conta de IA e migração imediata para a VPS Ubuntu.
 * @dependencies @prisma/client, node:fs/promises, node:path
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Estrutura do arquivo de Snapshot Low-Code que espelha o estado do banco PostgreSQL no Git.
 */
export interface LowCodeDatabaseSnapshot {
  version: string;
  exportedAt: string;
  i18nTranslations: any[];
  biomes: any[];
  mapTypes: any[];
  maps: any[];
  mapPortals: any[];
  npcTemplates: any[];
  mapNpcs: any[];
  elements: any[];
  elementMatchups: any[];
  races: any[];
  raceMatchups: any[];
  baseAttributes: any[];
  combatAttributes: any[];
  attributeConversions: any[];
  equipmentSlots: any[];
  classTemplates: any[];
  monsterRarities: any[];
  monsterTemplates: any[];
  monsterBiomes: any[];
  skillTemplates: any[];
  statusEffectTemplates: any[];
  itemTemplates: any[];
  questTemplates?: any[];
  petTemplates?: any[];
  flyingMountTemplates?: any[];
  levelExperienceTemplates?: any[];
}

/**
 * Classe responsável por exportar e restaurar o estado completo das tabelas Low-Code
 * entre o banco PostgreSQL e o arquivo `packages/database/snapshots/lowcode.snapshot.json`.
 */
export class SnapshotManager {
  private readonly prisma: PrismaClient;
  private readonly snapshotFilePath: string;

  /**
   * @param prisma Instância ativa do PrismaClient conectada ao PostgreSQL.
   * @param customSnapshotDir Diretório opcional para gravação dos snapshots.
   */
  constructor(prisma: PrismaClient, customSnapshotDir?: string) {
    this.prisma = prisma;
    const dir = customSnapshotDir ?? path.resolve(__dirname, '../snapshots');
    this.snapshotFilePath = path.join(dir, 'lowcode.snapshot.json');
  }

  /**
   * Exporta todas as tabelas de configuração Low-Code do PostgreSQL para o arquivo JSON versionado.
   * Deve ser chamado automaticamente após alterações na Rota `/admin`.
   */
  public async exportToDisk(): Promise<string> {
    await fs.mkdir(path.dirname(this.snapshotFilePath), { recursive: true });

    const snapshot: LowCodeDatabaseSnapshot = {
      version: '0.2.0',
      exportedAt: new Date().toISOString(),
      i18nTranslations: await this.prisma.i18nTranslation.findMany({ orderBy: { id: 'asc' } }),
      biomes: await this.prisma.biome.findMany({ orderBy: { id: 'asc' } }),
      mapTypes: await this.prisma.mapType.findMany({ orderBy: { id: 'asc' } }),
      maps: await this.prisma.gameMap.findMany({ orderBy: { id: 'asc' } }),
      mapPortals: await this.prisma.mapPortal.findMany({ orderBy: { id: 'asc' } }),
      npcTemplates: await this.prisma.npcTemplate.findMany({ orderBy: { id: 'asc' } }),
      mapNpcs: await this.prisma.mapNpc.findMany({ orderBy: { id: 'asc' } }),
      elements: await this.prisma.element.findMany({ orderBy: { code: 'asc' } }),
      elementMatchups: await this.prisma.elementMatchup.findMany({ orderBy: { id: 'asc' } }),
      races: await this.prisma.race.findMany({ orderBy: { code: 'asc' } }),
      raceMatchups: await this.prisma.raceMatchup.findMany({ orderBy: { id: 'asc' } }),
      baseAttributes: await this.prisma.baseAttribute.findMany({ orderBy: { code: 'asc' } }),
      combatAttributes: await this.prisma.combatAttribute.findMany({ orderBy: { code: 'asc' } }),
      attributeConversions: await this.prisma.attributeConversion.findMany({ orderBy: { id: 'asc' } }),
      equipmentSlots: await this.prisma.equipmentSlot.findMany({ orderBy: [{ ownerType: 'asc' }, { slotIndex: 'asc' }] }),
      classTemplates: await this.prisma.classTemplate.findMany({ orderBy: { id: 'asc' } }),
      monsterRarities: await this.prisma.monsterRarity.findMany({ orderBy: { id: 'asc' } }),
      monsterTemplates: await this.prisma.monsterTemplate.findMany({ orderBy: { id: 'asc' } }),
      monsterBiomes: await this.prisma.monsterBiome.findMany({ orderBy: { id: 'asc' } }),
      skillTemplates: await this.prisma.skillTemplate.findMany({ orderBy: { id: 'asc' } }),
      statusEffectTemplates: await this.prisma.statusEffectTemplate.findMany({ orderBy: { id: 'asc' } }),
      itemTemplates: await this.prisma.itemTemplate.findMany({ orderBy: { id: 'asc' } }),
      questTemplates: await this.prisma.questTemplate.findMany({ orderBy: { id: 'asc' } }),
      petTemplates: await this.prisma.petTemplate.findMany({ orderBy: { id: 'asc' } }),
      flyingMountTemplates: await this.prisma.flyingMountTemplate.findMany({ orderBy: { id: 'asc' } }),
      levelExperienceTemplates: (await this.prisma.levelExperienceTemplate.findMany({ orderBy: { level: 'asc' } })).map((l) => ({
        ...l,
        experienceToNext: l.experienceToNext.toString(),
        totalExperience: l.totalExperience.toString(),
      })),
    };

    await fs.writeFile(this.snapshotFilePath, JSON.stringify(snapshot, null, 2), 'utf-8');
    return this.snapshotFilePath;
  }

  /**
   * Restaura todas as tabelas Low-Code do snapshot JSON para o PostgreSQL.
   */
  public async restoreFromDisk(): Promise<void> {
    const raw = await fs.readFile(this.snapshotFilePath, 'utf-8');
    const snap: LowCodeDatabaseSnapshot = JSON.parse(raw);

    console.log(`📦 [SnapshotManager] Restaurando snapshot de: ${snap.exportedAt}`);

    // 1. i18n
    for (const t of snap.i18nTranslations) {
      await this.prisma.i18nTranslation.upsert({
        where: { key_locale: { key: t.key, locale: t.locale } },
        update: { text: t.text },
        create: { id: t.id, key: t.key, locale: t.locale, text: t.text },
      });
    }

    // 2. Base lookup tables
    for (const b of snap.biomes) {
      await this.prisma.biome.upsert({
        where: { code: b.code },
        update: { category: b.category, nameI18nKey: b.nameI18nKey, descriptionI18nKey: b.descriptionI18nKey },
        create: { id: b.id, code: b.code, category: b.category, nameI18nKey: b.nameI18nKey, descriptionI18nKey: b.descriptionI18nKey },
      });
    }

    for (const mt of snap.mapTypes) {
      await this.prisma.mapType.upsert({
        where: { code: mt.code },
        update: { nameI18nKey: mt.nameI18nKey, dominationTarget: mt.dominationTarget, allowMonsterSpawn: mt.allowMonsterSpawn, pvpRule: mt.pvpRule, forcesCriminalStatus: mt.forcesCriminalStatus },
        create: { id: mt.id, code: mt.code, nameI18nKey: mt.nameI18nKey, dominationTarget: mt.dominationTarget, allowMonsterSpawn: mt.allowMonsterSpawn, pvpRule: mt.pvpRule, forcesCriminalStatus: mt.forcesCriminalStatus },
      });
    }

    for (const el of snap.elements) {
      await this.prisma.element.upsert({
        where: { code: el.code },
        update: { nameI18nKey: el.nameI18nKey, initialRollChance: el.initialRollChance },
        create: { id: el.id, code: el.code, nameI18nKey: el.nameI18nKey, initialRollChance: el.initialRollChance },
      });
    }

    for (const em of snap.elementMatchups) {
      await this.prisma.elementMatchup.upsert({
        where: { attackerElementCode_defenderElementCode: { attackerElementCode: em.attackerElementCode, defenderElementCode: em.defenderElementCode } },
        update: { damageMultiplier: em.damageMultiplier },
        create: { id: em.id, attackerElementCode: em.attackerElementCode, defenderElementCode: em.defenderElementCode, damageMultiplier: em.damageMultiplier },
      });
    }

    for (const r of snap.races) {
      await this.prisma.race.upsert({
        where: { code: r.code },
        update: { nameI18nKey: r.nameI18nKey },
        create: { id: r.id, code: r.code, nameI18nKey: r.nameI18nKey },
      });
    }

    for (const rm of snap.raceMatchups) {
      await this.prisma.raceMatchup.upsert({
        where: { attackerRaceCode_defenderRaceCode: { attackerRaceCode: rm.attackerRaceCode, defenderRaceCode: rm.defenderRaceCode } },
        update: { damageMultiplier: rm.damageMultiplier },
        create: { id: rm.id, attackerRaceCode: rm.attackerRaceCode, defenderRaceCode: rm.defenderRaceCode, damageMultiplier: rm.damageMultiplier },
      });
    }

    for (const ba of snap.baseAttributes) {
      await this.prisma.baseAttribute.upsert({
        where: { code: ba.code },
        update: { nameI18nKey: ba.nameI18nKey, descriptionI18nKey: ba.descriptionI18nKey, iconKey: ba.iconKey },
        create: { id: ba.id, code: ba.code, nameI18nKey: ba.nameI18nKey, descriptionI18nKey: ba.descriptionI18nKey, iconKey: ba.iconKey },
      });
    }

    for (const ca of snap.combatAttributes) {
      await this.prisma.combatAttribute.upsert({
        where: { code: ca.code },
        update: { nameI18nKey: ca.nameI18nKey, descriptionI18nKey: ca.descriptionI18nKey, isPercentage: ca.isPercentage, baseValue: ca.baseValue },
        create: { id: ca.id, code: ca.code, nameI18nKey: ca.nameI18nKey, descriptionI18nKey: ca.descriptionI18nKey, isPercentage: ca.isPercentage, baseValue: ca.baseValue },
      });
    }

    for (const ac of snap.attributeConversions) {
      await this.prisma.attributeConversion.upsert({
        where: { baseAttributeCode_combatAttributeCode: { baseAttributeCode: ac.baseAttributeCode, combatAttributeCode: ac.combatAttributeCode } },
        update: { pointsRequired: ac.pointsRequired, combatAttributeBonus: ac.combatAttributeBonus },
        create: { id: ac.id, baseAttributeCode: ac.baseAttributeCode, combatAttributeCode: ac.combatAttributeCode, pointsRequired: ac.pointsRequired, combatAttributeBonus: ac.combatAttributeBonus },
      });
    }

    for (const es of snap.equipmentSlots) {
      await this.prisma.equipmentSlot.upsert({
        where: { ownerType_slotIndex: { ownerType: es.ownerType, slotIndex: es.slotIndex } },
        update: { nameI18nKey: es.nameI18nKey, iconKey: es.iconKey, allowedItemTypesJson: es.allowedItemTypesJson },
        create: { id: es.id, ownerType: es.ownerType, slotIndex: es.slotIndex, nameI18nKey: es.nameI18nKey, iconKey: es.iconKey, allowedItemTypesJson: es.allowedItemTypesJson },
      });
    }

    for (const mr of snap.monsterRarities) {
      await this.prisma.monsterRarity.upsert({
        where: { tier: mr.tier },
        update: { nameI18nKey: mr.nameI18nKey, colorHex: mr.colorHex, dropMultiplier: mr.dropMultiplier, expMultiplier: mr.expMultiplier, hpMultiplier: mr.hpMultiplier },
        create: { id: mr.id, tier: mr.tier, nameI18nKey: mr.nameI18nKey, colorHex: mr.colorHex, dropMultiplier: mr.dropMultiplier, expMultiplier: mr.expMultiplier, hpMultiplier: mr.hpMultiplier },
      });
    }

    // 3. Maps
    for (const m of snap.maps) {
      const { id, createdAt, updatedAt, ...rest } = m;
      await this.prisma.gameMap.upsert({
        where: { id },
        update: rest,
        create: { id, ...rest },
      });
    }

    // 4. Map portals, NPCs
    for (const p of snap.mapPortals) {
      const { id, createdAt, updatedAt, ...rest } = p;
      await this.prisma.mapPortal.upsert({
        where: { id },
        update: rest,
        create: { id, ...rest },
      });
    }

    for (const n of snap.npcTemplates) {
      const { id, createdAt, updatedAt, ...rest } = n;
      await this.prisma.npcTemplate.upsert({
        where: { id },
        update: rest,
        create: { id, ...rest },
      });
    }

    for (const mn of snap.mapNpcs) {
      const { id, createdAt, updatedAt, ...rest } = mn;
      await this.prisma.mapNpc.upsert({
        where: { id },
        update: rest,
        create: { id, ...rest },
      });
    }

    // 5. Classes, Monsters, Skills, Items, Pets, Mounts, Levels
    for (const c of snap.classTemplates) {
      const { id, createdAt, updatedAt, ...rest } = c;
      await this.prisma.classTemplate.upsert({
        where: { id },
        update: rest,
        create: { id, ...rest },
      });
    }

    for (const mt of snap.monsterTemplates) {
      const { id, createdAt, updatedAt, ...rest } = mt;
      await this.prisma.monsterTemplate.upsert({
        where: { id },
        update: rest,
        create: { id, ...rest },
      });
    }

    for (const mb of snap.monsterBiomes) {
      const { id, createdAt, updatedAt, ...rest } = mb;
      await this.prisma.monsterBiome.upsert({
        where: { monsterTemplateId_biomeCode: { monsterTemplateId: mb.monsterTemplateId, biomeCode: mb.biomeCode } },
        update: rest,
        create: { id, ...rest },
      });
    }

    for (const sk of snap.skillTemplates) {
      const { id, createdAt, updatedAt, ...rest } = sk;
      await this.prisma.skillTemplate.upsert({
        where: { id },
        update: rest,
        create: { id, ...rest },
      });
    }

    for (const se of snap.statusEffectTemplates) {
      const { id, createdAt, updatedAt, ...rest } = se;
      await this.prisma.statusEffectTemplate.upsert({
        where: { id },
        update: rest,
        create: { id, ...rest },
      });
    }

    for (const it of snap.itemTemplates) {
      const { id, createdAt, updatedAt, ...rest } = it;
      await this.prisma.itemTemplate.upsert({
        where: { id },
        update: rest,
        create: { id, ...rest },
      });
    }

    if (snap.petTemplates) {
      for (const pet of snap.petTemplates) {
        const { id, createdAt, updatedAt, ...rest } = pet;
        await this.prisma.petTemplate.upsert({
          where: { id },
          update: rest,
          create: { id, ...rest },
        });
      }
    }

    if (snap.flyingMountTemplates) {
      for (const fm of snap.flyingMountTemplates) {
        const { id, createdAt, updatedAt, ...rest } = fm;
        await this.prisma.flyingMountTemplate.upsert({
          where: { id },
          update: rest,
          create: { id, ...rest },
        });
      }
    }

    if (snap.questTemplates) {
      for (const q of snap.questTemplates) {
        const { id, createdAt, updatedAt, ...rest } = q;
        await this.prisma.questTemplate.upsert({
          where: { id },
          update: rest,
          create: { id, ...rest },
        });
      }
    }

    if (snap.levelExperienceTemplates) {
      for (const lv of snap.levelExperienceTemplates) {
        const { id, createdAt, updatedAt, ...rest } = lv;
        await this.prisma.levelExperienceTemplate.upsert({
          where: { level: lv.level },
          update: {
            experienceToNext: BigInt(lv.experienceToNext),
            totalExperience: BigInt(lv.totalExperience),
            attributePointsGain: lv.attributePointsGain,
            skillPointsGain: lv.skillPointsGain,
          },
          create: {
            id,
            level: lv.level,
            experienceToNext: BigInt(lv.experienceToNext),
            totalExperience: BigInt(lv.totalExperience),
            attributePointsGain: lv.attributePointsGain,
            skillPointsGain: lv.skillPointsGain,
          },
        });
      }
    }

    // 6. Atualizar sequences no PostgreSQL para auto-incremento contínuo
    const sequenceTables = [
      ['i18n_translations', 'id'],
      ['game_maps', 'id'],
      ['map_portals', 'id'],
      ['npc_templates', 'id'],
      ['map_npcs', 'id'],
      ['class_templates', 'id'],
      ['monster_templates', 'id'],
      ['skill_templates', 'id'],
      ['status_effect_templates', 'id'],
      ['item_templates', 'id'],
      ['pet_templates', 'id'],
      ['flying_mount_templates', 'id'],
      ['quest_templates', 'id'],
      ['level_experience_templates', 'id'],
    ];

    for (const [tbl, col] of sequenceTables) {
      try {
        await this.prisma.$executeRawUnsafe(
          `SELECT setval(pg_get_serial_sequence('${tbl}', '${col}'), coalesce(max(${col}), 1)) FROM "${tbl}";`
        );
      } catch (e) {
        // Ignora caso a tabela não tenha sequence dedicada
      }
    }

    console.log(`✅ [SnapshotManager] Todas as tabelas restauradas com sucesso!`);
  }
}
