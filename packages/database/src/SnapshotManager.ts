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
    };

    await fs.writeFile(this.snapshotFilePath, JSON.stringify(snapshot, null, 2), 'utf-8');
    return this.snapshotFilePath;
  }
}
