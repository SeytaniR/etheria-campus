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
  worldMapTemplates?: any[];
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
      worldMapTemplates: await this.prisma.worldMapTemplate.findMany({ orderBy: { id: 'asc' } }),
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
              overlapOpacity: m.overlapOpacity, collisionMeshJson: m.collisionMeshJson, overlapMeshJson: m.overlapMeshJson,
            },
            update: {
              code: m.code, nameI18nKey: m.nameI18nKey,
              mapTypeId: m.mapTypeId, primaryBiomeId: m.primaryBiomeId, secondaryBiomeId: m.secondaryBiomeId,
              mcreworkMapImage: m.mcreworkMapImage, requiredLevel: m.requiredLevel,
              spawnX: m.spawnX, spawnY: m.spawnY,
              encounterRatePct: m.encounterRatePct, levelVarianceMin: m.levelVarianceMin, levelVarianceMax: m.levelVarianceMax,
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
              mcreworkMonsterKey: m.mcreworkMonsterKey, groundOffsetY: m.groundOffsetY,
              raceCode: m.raceCode, combatStyle: m.combatStyle || 'MELEE', attackRange: m.attackRange || 60,
              damageType: m.damageType || 'PHYSICAL',
              rarityTier: m.rarityTier, fixedElementCode: m.fixedElementCode,
              baseAttributesJson: m.baseAttributesJson, lootTableJson: m.lootTableJson,
            },
            update: {
              code: m.code, nameI18nKey: m.nameI18nKey, descriptionI18nKey: m.descriptionI18nKey,
              mcreworkMonsterKey: m.mcreworkMonsterKey, groundOffsetY: m.groundOffsetY,
              raceCode: m.raceCode, combatStyle: m.combatStyle || 'MELEE', attackRange: m.attackRange || 60,
              damageType: m.damageType || 'PHYSICAL',
              rarityTier: m.rarityTier, fixedElementCode: m.fixedElementCode,
              baseAttributesJson: m.baseAttributesJson, lootTableJson: m.lootTableJson,
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

      return { restored: true, message: `Snapshot importado com sucesso a partir de ${this.snapshotFilePath}` };
    } catch (err: any) {
      return { restored: false, message: `Falha ao restaurar snapshot: ${err?.message || err}` };
    }
  }
}
