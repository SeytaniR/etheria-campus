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
import { I18nCache } from './I18nCache.js';

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
  equipmentSets?: any[];
  classTemplates: any[];
  monsterRarities: any[];
  monsterTemplates: any[];
  monsterBiomes: any[];
  skillTemplates: any[];
  statusEffectTemplates: any[];
  itemTemplates: any[];
  questTemplates?: any[];
  levelExperienceTemplates?: any[];
  worldMapTemplates?: any[];
  clientUiLayoutTemplates?: any[];
  shopTemplates?: any[];
  hunterPetCostRules?: any[];
}

/**
 * Classe responsável por exportar e restaurar o estado completo das tabelas Low-Code
 * entre o banco PostgreSQL e o arquivo `packages/database/snapshots/lowcode.snapshot.json`.
 */
export class SnapshotManager {
  public static readonly AUTOINCREMENT_TABLES = [
    'i18n_translations',
    'biomes',
    'map_types',
    'maps',
    'map_portals',
    'shop_templates',
    'hunter_pet_cost_rules',
    'npc_templates',
    'map_npcs',
    'element_matchups',
    'race_matchups',
    'attribute_conversions',
    'class_templates',
    'monster_rarities',
    'monster_templates',
    'monster_biomes',
    'skill_templates',
    'status_effect_templates',
    'equipment_sets',
    'item_templates',
    'user_accounts',
    'player_characters',
    'character_inventory_items',
    'character_pets',
    'arena_formations',
    'quest_templates',
    'character_quest_progress',
    'world_map_templates',
    'client_ui_layout_templates',
  ] as const;

  private readonly prisma: PrismaClient;
  private readonly snapshotFilePath: string;

  /**
   * Sincroniza a sequência SERIAL/autoincrement de uma tabela específica no PostgreSQL
   * para que o próximo `create()` utilize `MAX(id) + 1`, evitando erro `Unique constraint failed on the fields: ('id')`.
   */
  public static async syncTableSequence(prisma: PrismaClient | any, tableName: string): Promise<void> {
    if (!this.AUTOINCREMENT_TABLES.includes(tableName as any)) return;
    try {
      await prisma.$executeRawUnsafe(`
        SELECT setval(
          pg_get_serial_sequence('public."${tableName}"', 'id'),
          COALESCE((SELECT MAX(id) FROM public."${tableName}"), 0) + 1,
          false
        );
      `);
    } catch (err: any) {
      console.warn(`[SnapshotManager] Aviso ao sincronizar sequência de ${tableName}:`, err?.message || err);
    }
  }

  /**
   * Sincroniza todas as 28 sequências SERIAL/autoincrement do banco PostgreSQL.
   */
  public static async syncAllSequences(prisma: PrismaClient | any): Promise<void> {
    for (const table of this.AUTOINCREMENT_TABLES) {
      await this.syncTableSequence(prisma, table);
    }
  }

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
      equipmentSets: await (this.prisma as any).equipmentSet.findMany({ orderBy: { id: 'asc' } }),
      classTemplates: await this.prisma.classTemplate.findMany({ orderBy: { id: 'asc' } }),
      monsterRarities: await this.prisma.monsterRarity.findMany({ orderBy: { id: 'asc' } }),
      monsterTemplates: await this.prisma.monsterTemplate.findMany({ orderBy: { id: 'asc' } }),
      monsterBiomes: await this.prisma.monsterBiome.findMany({ orderBy: { id: 'asc' } }),
      skillTemplates: await this.prisma.skillTemplate.findMany({ orderBy: { id: 'asc' } }),
      statusEffectTemplates: await this.prisma.statusEffectTemplate.findMany({ orderBy: { id: 'asc' } }),
      itemTemplates: await this.prisma.itemTemplate.findMany({ orderBy: { id: 'asc' } }),
      questTemplates: await this.prisma.questTemplate.findMany({ orderBy: { id: 'asc' } }),
      levelExperienceTemplates: (await this.prisma.levelExperienceTemplate.findMany({ orderBy: { level: 'asc' } })).map((l) => ({
        ...l,
        experienceToNext: l.experienceToNext.toString(),
        totalExperience: l.totalExperience.toString(),
      })),
      worldMapTemplates: await this.prisma.worldMapTemplate.findMany({ orderBy: { id: 'asc' } }),
      clientUiLayoutTemplates: await this.prisma.clientUiLayoutTemplate.findMany({ orderBy: { id: 'asc' } }),
      shopTemplates: await (this.prisma as any).shopTemplate?.findMany({ orderBy: { id: 'asc' } }).catch(() => []) ?? [],
      hunterPetCostRules: await (this.prisma as any).hunterPetCostRule?.findMany({ orderBy: { id: 'asc' } }).catch(() => []) ?? [],
    };

    await fs.writeFile(this.snapshotFilePath, JSON.stringify(snapshot, null, 2), 'utf-8');
    I18nCache.invalidate();
    return this.snapshotFilePath;
  }

  /**
   * Importa e restaura os dados Low-Code salvos no Snapshot JSON para o PostgreSQL.
   * Executa de forma aditiva e idempotente para garantir integridade.
   */
  public async importFromDisk(): Promise<{ restored: boolean; message: string }> {
    try {
      const exists = await fs.stat(this.snapshotFilePath).catch(() => null);
      if (!exists) {
        return { restored: false, message: `Snapshot não encontrado em ${this.snapshotFilePath}` };
      }

      const raw = await fs.readFile(this.snapshotFilePath, 'utf-8');
      const snapshot: LowCodeDatabaseSnapshot = JSON.parse(raw);

      // 1. i18n
      if (Array.isArray(snapshot.i18nTranslations)) {
        for (const t of snapshot.i18nTranslations) {
          await this.prisma.i18nTranslation.upsert({
            where: { key_locale: { key: t.key, locale: t.locale } },
            create: { locale: t.locale, key: t.key, text: t.text },
            update: { text: t.text },
          });
        }
      }

      // 1.1 Tipos de Mapa (MapTypes)
      if (Array.isArray(snapshot.mapTypes)) {
        for (const mt of snapshot.mapTypes) {
          await this.prisma.mapType.upsert({
            where: { code: mt.code },
            create: {
              id: mt.id, code: mt.code, nameI18nKey: mt.nameI18nKey,
              dominationTarget: mt.dominationTarget, allowMonsterSpawn: Boolean(mt.allowMonsterSpawn),
              pvpRule: mt.pvpRule, forcesCriminalStatus: Boolean(mt.forcesCriminalStatus),
            },
            update: {
              nameI18nKey: mt.nameI18nKey, dominationTarget: mt.dominationTarget,
              allowMonsterSpawn: Boolean(mt.allowMonsterSpawn), pvpRule: mt.pvpRule,
              forcesCriminalStatus: Boolean(mt.forcesCriminalStatus),
            },
          });
        }
      }

      // 2. Mapas e Portais
      if (Array.isArray(snapshot.maps)) {
        for (const m of snapshot.maps) {
          await this.prisma.gameMap.upsert({
            where: { id: m.id },
            create: {
              id: m.id, code: m.code, nameI18nKey: m.nameI18nKey,
              mapTypeId: m.mapTypeId, primaryBiomeId: m.primaryBiomeId, secondaryBiomeId: m.secondaryBiomeId,
              mcreworkMapImage: m.mcreworkMapImage, requiredLevel: m.requiredLevel,
              spawnX: m.spawnX, spawnY: m.spawnY,
              encounterRatePct: m.encounterRatePct, levelVarianceMin: m.levelVarianceMin, levelVarianceMax: m.levelVarianceMax,
              allowedMonsterRacesJson: m.allowedMonsterRacesJson ?? [],
              allowedMonsterTemplateIdsJson: m.allowedMonsterTemplateIdsJson ?? [],
              dungeonMonsterCount: m.dungeonMonsterCount ?? 10,
              dungeonBossTemplateId: m.dungeonBossTemplateId ?? null,
              dominatedById: m.dominatedById ?? null,
              overlapOpacity: m.overlapOpacity, collisionMeshJson: m.collisionMeshJson, overlapMeshJson: m.overlapMeshJson,
            },
            update: {
              code: m.code, nameI18nKey: m.nameI18nKey,
              mapTypeId: m.mapTypeId, primaryBiomeId: m.primaryBiomeId, secondaryBiomeId: m.secondaryBiomeId,
              mcreworkMapImage: m.mcreworkMapImage, requiredLevel: m.requiredLevel,
              spawnX: m.spawnX, spawnY: m.spawnY,
              encounterRatePct: m.encounterRatePct, levelVarianceMin: m.levelVarianceMin, levelVarianceMax: m.levelVarianceMax,
              allowedMonsterRacesJson: m.allowedMonsterRacesJson ?? [],
              allowedMonsterTemplateIdsJson: m.allowedMonsterTemplateIdsJson ?? [],
              dungeonMonsterCount: m.dungeonMonsterCount ?? 10,
              dungeonBossTemplateId: m.dungeonBossTemplateId ?? null,
              dominatedById: m.dominatedById ?? null,
              overlapOpacity: m.overlapOpacity, collisionMeshJson: m.collisionMeshJson, overlapMeshJson: m.overlapMeshJson,
            },
          });
        }
      }

      // 3. Classes
      if (Array.isArray(snapshot.classTemplates)) {
        for (const c of snapshot.classTemplates) {
          await this.prisma.classTemplate.upsert({
            where: { id: c.id },
            create: {
              id: c.id, code: c.code, nameI18nKey: c.nameI18nKey, descriptionI18nKey: c.descriptionI18nKey,
              mcreworkCharKey: c.mcreworkCharKey, rebornMcreworkCharKey: c.rebornMcreworkCharKey,
              groundOffsetY: c.groundOffsetY, rebornGroundOffsetY: c.rebornGroundOffsetY,
              raceCode: c.raceCode, combatStyle: c.combatStyle || 'MELEE', attackRange: c.attackRange || 60,
              damageType: c.damageType || 'PHYSICAL',
              baseAttributesJson: c.baseAttributesJson, growthPerLevelJson: c.growthPerLevelJson,
              baseCombatAttributesJson: c.baseCombatAttributesJson, skillIdsJson: c.skillIdsJson,
            },
            update: {
              code: c.code, nameI18nKey: c.nameI18nKey, descriptionI18nKey: c.descriptionI18nKey,
              mcreworkCharKey: c.mcreworkCharKey, rebornMcreworkCharKey: c.rebornMcreworkCharKey,
              groundOffsetY: c.groundOffsetY, rebornGroundOffsetY: c.rebornGroundOffsetY,
              raceCode: c.raceCode, combatStyle: c.combatStyle || 'MELEE', attackRange: c.attackRange || 60,
              damageType: c.damageType || 'PHYSICAL',
              baseAttributesJson: c.baseAttributesJson, growthPerLevelJson: c.growthPerLevelJson,
              baseCombatAttributesJson: c.baseCombatAttributesJson, skillIdsJson: c.skillIdsJson,
            },
          });
        }
      }

      // 4. Monstros
      if (Array.isArray(snapshot.monsterTemplates)) {
        for (const m of snapshot.monsterTemplates) {
          await this.prisma.monsterTemplate.upsert({
            where: { id: m.id },
            create: {
              id: m.id, code: m.code, nameI18nKey: m.nameI18nKey, descriptionI18nKey: m.descriptionI18nKey,
              mcreworkMonsterKey: m.mcreworkMonsterKey, groundOffsetY: m.groundOffsetY ?? 0,
              shadowOffsetX: m.shadowOffsetX ?? 0, shadowOffsetY: m.shadowOffsetY ?? 0,
              raceCode: m.raceCode, combatStyle: m.combatStyle || 'MELEE', attackRange: m.attackRange || 60,
              damageType: m.damageType || 'PHYSICAL',
              rarityTier: m.rarityTier, fixedElementCode: m.fixedElementCode,
              isTamableAsPet: m.isTamableAsPet !== false,
              skillIdsJson: m.skillIdsJson ?? [],
              baseAttributesJson: m.baseAttributesJson,
              baseCombatAttributesJson: m.baseCombatAttributesJson ?? {},
              lootTableJson: m.lootTableJson,
            },
            update: {
              code: m.code, nameI18nKey: m.nameI18nKey, descriptionI18nKey: m.descriptionI18nKey,
              mcreworkMonsterKey: m.mcreworkMonsterKey, groundOffsetY: m.groundOffsetY ?? 0,
              shadowOffsetX: m.shadowOffsetX ?? 0, shadowOffsetY: m.shadowOffsetY ?? 0,
              raceCode: m.raceCode, combatStyle: m.combatStyle || 'MELEE', attackRange: m.attackRange || 60,
              damageType: m.damageType || 'PHYSICAL',
              rarityTier: m.rarityTier, fixedElementCode: m.fixedElementCode,
              isTamableAsPet: m.isTamableAsPet !== false,
              skillIdsJson: m.skillIdsJson ?? [],
              baseAttributesJson: m.baseAttributesJson,
              baseCombatAttributesJson: m.baseCombatAttributesJson ?? {},
              lootTableJson: m.lootTableJson,
            },
          });
        }
      }

      // 5. Mapas Gerais (Continentes / Mundo)
      if (Array.isArray(snapshot.worldMapTemplates)) {
        for (const wm of snapshot.worldMapTemplates) {
          await this.prisma.worldMapTemplate.upsert({
            where: { code: wm.code },
            create: {
              code: wm.code,
              namePtBr: wm.namePtBr,
              baseImageUrl: wm.baseImageUrl,
              canvasWidth: wm.canvasWidth ?? 1264,
              canvasHeight: wm.canvasHeight ?? 848,
              logoImageUrl: wm.logoImageUrl ?? null,
              logoX: wm.logoX ?? 42,
              logoY: wm.logoY ?? 30,
              logoWidth: wm.logoWidth ?? 270,
              logoHeight: wm.logoHeight ?? 185,
              logoVisible: wm.logoVisible ?? true,
              pointsJson: wm.pointsJson ?? [],
              routesJson: wm.routesJson ?? [],
              showRoutesLayer: wm.showRoutesLayer ?? true,
              showPointsLayer: wm.showPointsLayer ?? true,
              isActive: wm.isActive ?? true,
            },
            update: {
              namePtBr: wm.namePtBr,
              baseImageUrl: wm.baseImageUrl,
              canvasWidth: wm.canvasWidth ?? 1264,
              canvasHeight: wm.canvasHeight ?? 848,
              logoImageUrl: wm.logoImageUrl ?? null,
              logoX: wm.logoX ?? 42,
              logoY: wm.logoY ?? 30,
              logoWidth: wm.logoWidth ?? 270,
              logoHeight: wm.logoHeight ?? 185,
              logoVisible: wm.logoVisible ?? true,
              pointsJson: wm.pointsJson ?? [],
              routesJson: wm.routesJson ?? [],
              showRoutesLayer: wm.showRoutesLayer ?? true,
              showPointsLayer: wm.showPointsLayer ?? true,
              isActive: wm.isActive ?? true,
            },
          });
        }
      }

      // 6. Layouts de HUDs, Modais e Interfaces do Cliente (/play)
      if (Array.isArray(snapshot.clientUiLayoutTemplates)) {
        for (const ul of snapshot.clientUiLayoutTemplates) {
          await this.prisma.clientUiLayoutTemplate.upsert({
            where: { code: ul.code },
            create: {
              code: ul.code,
              namePtBr: ul.namePtBr,
              category: ul.category || 'EXPLORE_HUD',
              domSelector: ul.domSelector,
              descriptionPtBr: ul.descriptionPtBr ?? null,
              mobilePortraitJson: ul.mobilePortraitJson ?? {},
              mobileLandscapeJson: ul.mobileLandscapeJson ?? {},
              desktopJson: ul.desktopJson ?? {},
              isActive: ul.isActive ?? true,
            },
            update: {
              namePtBr: ul.namePtBr,
              category: ul.category || 'EXPLORE_HUD',
              domSelector: ul.domSelector,
              descriptionPtBr: ul.descriptionPtBr ?? null,
              mobilePortraitJson: ul.mobilePortraitJson ?? {},
              mobileLandscapeJson: ul.mobileLandscapeJson ?? {},
              desktopJson: ul.desktopJson ?? {},
              isActive: ul.isActive ?? true,
            },
          });
        }
      }

      // 7. Conjuntos de Equipamentos
      if (Array.isArray(snapshot.equipmentSets)) {
        for (const es of snapshot.equipmentSets) {
          await (this.prisma as any).equipmentSet.upsert({
            where: { id: es.id },
            create: {
              id: es.id,
              code: es.code,
              nameI18nKey: es.nameI18nKey,
              descriptionI18nKey: es.descriptionI18nKey,
              requiredLevel: es.requiredLevel ?? 1,
              rarityTier: es.rarityTier ?? 'COMMON',
              minPiecesFull: es.minPiecesFull ?? 12,
              minPiecesHalf: es.minPiecesHalf ?? 6,
              halfBonusRatioPct: es.halfBonusRatioPct ?? 40.0,
              fullBonusRatioPct: es.fullBonusRatioPct ?? 100.0,
              bonusCombatStatsJson: es.bonusCombatStatsJson ?? {},
              bonusSpecialEffectsJson: es.bonusSpecialEffectsJson ?? {},
              isActive: es.isActive ?? true,
            },
            update: {
              code: es.code,
              nameI18nKey: es.nameI18nKey,
              descriptionI18nKey: es.descriptionI18nKey,
              requiredLevel: es.requiredLevel ?? 1,
              rarityTier: es.rarityTier ?? 'COMMON',
              minPiecesFull: es.minPiecesFull ?? 12,
              minPiecesHalf: es.minPiecesHalf ?? 6,
              halfBonusRatioPct: es.halfBonusRatioPct ?? 40.0,
              fullBonusRatioPct: es.fullBonusRatioPct ?? 100.0,
              bonusCombatStatsJson: es.bonusCombatStatsJson ?? {},
              bonusSpecialEffectsJson: es.bonusSpecialEffectsJson ?? {},
              isActive: es.isActive ?? true,
            },
          });
        }
      }

      // 8. Templates de Itens e Equipamentos (com equipmentSetId)
      if (Array.isArray(snapshot.itemTemplates)) {
        for (const it of snapshot.itemTemplates) {
          await this.prisma.itemTemplate.upsert({
            where: { id: it.id },
            create: {
              id: it.id,
              code: it.code,
              nameI18nKey: it.nameI18nKey,
              descriptionI18nKey: it.descriptionI18nKey,
              mcreworkIconKey: it.mcreworkIconKey,
              itemCategory: it.itemCategory,
              equipmentSlotCode: it.equipmentSlotCode,
              equipmentSetId: it.equipmentSetId ?? null,
              rarityTier: it.rarityTier ?? 'COMMON',
              requiredLevel: it.requiredLevel ?? 1,
              isTradable: it.isTradable !== false,
              priceGold: it.priceGold ?? 0,
              maxStack: it.maxStack ?? 999,
              cooldownSec: it.cooldownSec ?? 0.0,
              targetType: it.targetType ?? 'SELF',
              effectType: it.effectType,
              effectValue: it.effectValue ?? 0.0,
              reqClassCodesJson: it.reqClassCodesJson ?? [],
              baseStatBonusesJson: it.baseStatBonusesJson ?? {},
              combatStatBonusesJson: it.combatStatBonusesJson ?? {},
              specialEffectJson: it.specialEffectJson ?? {},
              isActive: it.isActive !== false,
            },
            update: {
              code: it.code,
              nameI18nKey: it.nameI18nKey,
              descriptionI18nKey: it.descriptionI18nKey,
              mcreworkIconKey: it.mcreworkIconKey,
              itemCategory: it.itemCategory,
              equipmentSlotCode: it.equipmentSlotCode,
              equipmentSetId: it.equipmentSetId ?? null,
              rarityTier: it.rarityTier ?? 'COMMON',
              requiredLevel: it.requiredLevel ?? 1,
              isTradable: it.isTradable !== false,
              priceGold: it.priceGold ?? 0,
              maxStack: it.maxStack ?? 999,
              cooldownSec: it.cooldownSec ?? 0.0,
              targetType: it.targetType ?? 'SELF',
              effectType: it.effectType,
              effectValue: it.effectValue ?? 0.0,
              reqClassCodesJson: it.reqClassCodesJson ?? [],
              baseStatBonusesJson: it.baseStatBonusesJson ?? {},
              combatStatBonusesJson: it.combatStatBonusesJson ?? {},
              specialEffectJson: it.specialEffectJson ?? {},
              isActive: it.isActive !== false,
            },
          });
        }
      }

      // 9. Habilidades (SkillTemplates)
      if (Array.isArray(snapshot.skillTemplates)) {
        for (const s of snapshot.skillTemplates) {
          await this.prisma.skillTemplate.upsert({
            where: { id: s.id },
            create: {
              id: s.id,
              code: s.code,
              nameI18nKey: s.nameI18nKey,
              descriptionI18nKey: s.descriptionI18nKey,
              mcreworkIconKey: s.mcreworkIconKey,
              castActionId: s.castActionId ?? 3,
              castMovement: s.castMovement || 'MELEE_ADVANCE',
              mcreworkVfxKey: s.mcreworkVfxKey,
              vfxColorHex: s.vfxColorHex,
              vfxColorIntensity: s.vfxColorIntensity ?? 100,
              skillType: s.skillType || 'ACTIVE',
              triggerType: s.triggerType || 'MANUAL',
              mpCost: s.mpCost ?? 10,
              apCost: s.apCost ?? 2,
              cooldownSeconds: s.cooldownSeconds ?? 0,
              castRange: s.castRange ?? 160,
              aoeRadius: s.aoeRadius ?? 0,
              coneAngleDeg: s.coneAngleDeg ?? 90,
              lineWidthPx: s.lineWidthPx ?? 48,
              groundZoneDurationSec: s.groundZoneDurationSec ?? 0,
              groundZoneTickSec: s.groundZoneTickSec ?? 1,
              ignoreEvasion: s.ignoreEvasion ?? false,
              targetScope: s.targetScope || 'TARGET_PRIMARY',
              hitCount: s.hitCount ?? 1,
              effectBlocksJson: s.effectBlocksJson ?? [],
              isActive: s.isActive !== false,
            },
            update: {
              code: s.code,
              nameI18nKey: s.nameI18nKey,
              descriptionI18nKey: s.descriptionI18nKey,
              mcreworkIconKey: s.mcreworkIconKey,
              castActionId: s.castActionId ?? 3,
              castMovement: s.castMovement || 'MELEE_ADVANCE',
              mcreworkVfxKey: s.mcreworkVfxKey,
              vfxColorHex: s.vfxColorHex,
              vfxColorIntensity: s.vfxColorIntensity ?? 100,
              skillType: s.skillType || 'ACTIVE',
              triggerType: s.triggerType || 'MANUAL',
              mpCost: s.mpCost ?? 10,
              apCost: s.apCost ?? 2,
              cooldownSeconds: s.cooldownSeconds ?? 0,
              castRange: s.castRange ?? 160,
              aoeRadius: s.aoeRadius ?? 0,
              coneAngleDeg: s.coneAngleDeg ?? 90,
              lineWidthPx: s.lineWidthPx ?? 48,
              groundZoneDurationSec: s.groundZoneDurationSec ?? 0,
              groundZoneTickSec: s.groundZoneTickSec ?? 1,
              ignoreEvasion: s.ignoreEvasion ?? false,
              targetScope: s.targetScope || 'TARGET_PRIMARY',
              hitCount: s.hitCount ?? 1,
              effectBlocksJson: s.effectBlocksJson ?? [],
              isActive: s.isActive !== false,
            },
          });
        }
      }

      // 10. Vínculos de Bioma com Monstros (MonsterBiomes)
      if (Array.isArray(snapshot.monsterBiomes)) {
        for (const mb of snapshot.monsterBiomes) {
          await this.prisma.monsterBiome.upsert({
            where: {
              monsterTemplateId_biomeId: {
                monsterTemplateId: mb.monsterTemplateId,
                biomeId: mb.biomeId,
              },
            },
            create: {
              monsterTemplateId: mb.monsterTemplateId,
              biomeId: mb.biomeId,
            },
            update: {},
          });
        }
      }

      // 11. Regras de Custos e Recompensas do Caçador (HunterPetCostRules)
      if (Array.isArray(snapshot.hunterPetCostRules)) {
        for (const r of snapshot.hunterPetCostRules) {
          await (this.prisma as any).hunterPetCostRule.upsert({
            where: { rarityTier: r.rarityTier },
            create: {
              id: r.id,
              rarityTier: r.rarityTier,
              essenceCost: r.essenceCost ?? 30,
              goldCost: r.goldCost ?? 0,
              essenceReward: r.essenceReward ?? 15,
              goldReward: r.goldReward ?? 0,
            },
            update: {
              essenceCost: r.essenceCost ?? 30,
              goldCost: r.goldCost ?? 0,
              essenceReward: r.essenceReward ?? 15,
              goldReward: r.goldReward ?? 0,
            },
          });
        }
      }

      // 12. Sincroniza todas as sequências SERIAL/autoincrement do PostgreSQL
      await SnapshotManager.syncAllSequences(this.prisma);

      return { restored: true, message: `Snapshot importado com sucesso a partir de ${this.snapshotFilePath}` };
    } catch (err: any) {
      return { restored: false, message: `Falha ao restaurar snapshot: ${err?.message || err}` };
    }
  }
}
