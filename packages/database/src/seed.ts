/**
 * @file packages/database/src/seed.ts
 * @module @etheria/database
 * @description Popula o banco PostgreSQL com todas as tabelas fundamentais do Etheria Campus
 *   (40 Biomas, 5 Tipos de Mapa, 5 Elementos + Matriz, 11 Raças + Matriz, 6 Atributos Base,
 *   16 Atributos de Combate + Conversões, 16+6 Slots de Equipamento e 6 Raridades) e gera o Snapshot JSON.
 * @rules Execução idempotente via `upsert` para nunca duplicar nem apagar dados existentes do usuário.
 */

import { PrismaClient } from '@prisma/client';
import * as fsSync from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootEnvPath = path.resolve(__dirname, '../../../.env');
if (fsSync.existsSync(rootEnvPath)) {
  for (const rawLine of fsSync.readFileSync(rootEnvPath, 'utf-8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq > 0) {
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[k]) process.env[k] = v;
    }
  }
}
import {
  INITIAL_BIOMES,
  INITIAL_MAP_TYPES,
  INITIAL_ELEMENTS,
  buildElementMatchups,
  INITIAL_RACES,
  buildRaceMatchups,
  INITIAL_BASE_ATTRIBUTES,
  INITIAL_COMBAT_ATTRIBUTES,
  INITIAL_ATTRIBUTE_CONVERSIONS,
  INITIAL_EQUIPMENT_SLOTS,
  INITIAL_MONSTER_RARITIES,
} from './seedData.js';
import { SnapshotManager } from './SnapshotManager.js';

const prisma = new PrismaClient();

/**
 * Registra uma tradução i18n (pt-BR) de forma idempotente.
 */
async function upsertPtBrTranslation(key: string, text: string): Promise<void> {
  await prisma.i18nTranslation.upsert({
    where: { key_locale: { key, locale: 'pt-BR' } },
    update: { text },
    create: { key, locale: 'pt-BR', text },
  });
}

/**
 * Executa a população inicial de todas as tabelas base do Etheria Campus.
 */
export async function runDatabaseSeed(): Promise<void> {
  console.log('🌱 [Etheria Database] Iniciando população das tabelas base no PostgreSQL...');

  // 1. 40 Biomas
  for (const b of INITIAL_BIOMES) {
    const nameKey = `biome.${b.code.toLowerCase()}.name`;
    const descKey = `biome.${b.code.toLowerCase()}.desc`;
    await upsertPtBrTranslation(nameKey, b.namePtBr);
    await upsertPtBrTranslation(descKey, b.descriptionPtBr);

    await prisma.biome.upsert({
      where: { code: b.code },
      update: { category: b.category, nameI18nKey: nameKey, descriptionI18nKey: descKey },
      create: { code: b.code, category: b.category, nameI18nKey: nameKey, descriptionI18nKey: descKey },
    });
  }
  console.log(`✅ 40 Biomas sincronizados.`);

  // 2. 5 Tipos de Mapa
  for (const mt of INITIAL_MAP_TYPES) {
    const nameKey = `map_type.${mt.code.toLowerCase()}.name`;
    await upsertPtBrTranslation(nameKey, mt.namePtBr);

    await prisma.mapType.upsert({
      where: { code: mt.code },
      update: {
        nameI18nKey: nameKey,
        dominationTarget: mt.dominationTarget,
        allowMonsterSpawn: mt.allowMonsterSpawn,
        pvpRule: mt.pvpRule,
        forcesCriminalStatus: mt.forcesCriminalStatus,
      },
      create: {
        code: mt.code,
        nameI18nKey: nameKey,
        dominationTarget: mt.dominationTarget,
        allowMonsterSpawn: mt.allowMonsterSpawn,
        pvpRule: mt.pvpRule,
        forcesCriminalStatus: mt.forcesCriminalStatus,
      },
    });
  }
  console.log(`✅ 5 Tipos de Mapa sincronizados.`);

  // 3. 5 Elementos + Matriz de Confronto (±25% e penalidade de Neutro)
  for (const el of INITIAL_ELEMENTS) {
    const nameKey = `element.${el.code.toLowerCase()}.name`;
    await upsertPtBrTranslation(nameKey, el.namePtBr);

    await prisma.element.upsert({
      where: { code: el.code },
      update: { nameI18nKey: nameKey, initialRollChance: el.initialRollChance },
      create: { code: el.code, nameI18nKey: nameKey, initialRollChance: el.initialRollChance },
    });
  }

  for (const em of buildElementMatchups()) {
    await prisma.elementMatchup.upsert({
      where: {
        attackerElementCode_defenderElementCode: {
          attackerElementCode: em.attackerElementCode,
          defenderElementCode: em.defenderElementCode,
        },
      },
      update: { damageMultiplier: em.damageMultiplier },
      create: em,
    });
  }
  console.log(`✅ 5 Elementos e Matriz 5x5 sincronizados.`);

  // 4. 11 Raças + Matriz de Vantagem (+10%)
  for (const r of INITIAL_RACES) {
    const nameKey = `race.${r.code.toLowerCase()}.name`;
    await upsertPtBrTranslation(nameKey, r.namePtBr);

    await prisma.race.upsert({
      where: { code: r.code },
      update: { nameI18nKey: nameKey },
      create: { code: r.code, nameI18nKey: nameKey },
    });
  }

  for (const rm of buildRaceMatchups()) {
    await prisma.raceMatchup.upsert({
      where: {
        attackerRaceCode_defenderRaceCode: {
          attackerRaceCode: rm.attackerRaceCode,
          defenderRaceCode: rm.defenderRaceCode,
        },
      },
      update: { damageMultiplier: rm.damageMultiplier },
      create: rm,
    });
  }
  console.log(`✅ 11 Raças e Matriz 11x11 (+10%) sincronizadas.`);

  // 5. 6 Atributos Base, 16 Atributos de Combate e Matriz de Conversão Procedural
  for (const ba of INITIAL_BASE_ATTRIBUTES) {
    const nameKey = `attr.base.${ba.code.toLowerCase()}.name`;
    const descKey = `attr.base.${ba.code.toLowerCase()}.desc`;
    await upsertPtBrTranslation(nameKey, ba.namePtBr);
    await upsertPtBrTranslation(descKey, ba.descriptionPtBr);

    await prisma.baseAttribute.upsert({
      where: { code: ba.code },
      update: { nameI18nKey: nameKey, descriptionI18nKey: descKey },
      create: { code: ba.code, nameI18nKey: nameKey, descriptionI18nKey: descKey },
    });
  }

  for (const ca of INITIAL_COMBAT_ATTRIBUTES) {
    const nameKey = `attr.combat.${ca.code.toLowerCase()}.name`;
    await upsertPtBrTranslation(nameKey, ca.namePtBr);

    await prisma.combatAttribute.upsert({
      where: { code: ca.code },
      update: { nameI18nKey: nameKey, baseDefault: ca.baseDefault, isPercentage: ca.isPercentage },
      create: { code: ca.code, nameI18nKey: nameKey, baseDefault: ca.baseDefault, isPercentage: ca.isPercentage },
    });
  }

  for (const conv of INITIAL_ATTRIBUTE_CONVERSIONS) {
    await prisma.attributeConversion.upsert({
      where: {
        baseAttributeCode_combatAttributeCode: {
          baseAttributeCode: conv.baseAttributeCode,
          combatAttributeCode: conv.combatAttributeCode,
        },
      },
      update: { ratioPerPoint: conv.ratioPerPoint },
      create: conv,
    });
  }
  console.log(`✅ Atributos Base, Atributos de Combate e Conversões Procedurais sincronizados.`);

  // 6. 16 Slots de Personagem (incluindo Cinto) + 6 Slots de Pet
  for (const slot of INITIAL_EQUIPMENT_SLOTS) {
    const nameKey = `equip_slot.${slot.code.toLowerCase()}.name`;
    await upsertPtBrTranslation(nameKey, slot.namePtBr);

    await prisma.equipmentSlot.upsert({
      where: { code: slot.code },
      update: { ownerType: slot.ownerType, slotIndex: slot.slotIndex, nameI18nKey: nameKey },
      create: { code: slot.code, ownerType: slot.ownerType, slotIndex: slot.slotIndex, nameI18nKey: nameKey },
    });
  }
  console.log(`✅ 16 Slots de Personagem + 6 Slots de Pet sincronizados.`);

  // 7. 6 Raridades de Monstros/Pets
  for (const mr of INITIAL_MONSTER_RARITIES) {
    const nameKey = `rarity.${mr.code.toLowerCase()}.name`;
    await upsertPtBrTranslation(nameKey, mr.namePtBr);

    await prisma.monsterRarity.upsert({
      where: { code: mr.code },
      update: {
        nameI18nKey: nameKey,
        statMultiplier: mr.statMultiplier,
        expMultiplier: mr.expMultiplier,
        dropMultiplier: mr.dropMultiplier,
        visualScaleMultiplier: mr.visualScaleMultiplier,
        spawnWeight: mr.spawnWeight,
      },
      create: {
        code: mr.code,
        nameI18nKey: nameKey,
        statMultiplier: mr.statMultiplier,
        expMultiplier: mr.expMultiplier,
        dropMultiplier: mr.dropMultiplier,
        visualScaleMultiplier: mr.visualScaleMultiplier,
        spawnWeight: mr.spawnWeight,
      },
    });
  }
  console.log(`✅ 6 Raridades de Monstro sincronizadas.`);

  // 8. Exportar Snapshot automático para sincronia no Git
  const snapshotManager = new SnapshotManager(prisma);
  const file = await snapshotManager.exportToDisk();
  console.log(`💾 Snapshot JSON atualizado em: ${file}`);
}

runDatabaseSeed()
  .catch((err) => {
    console.error('❌ Erro ao executar seed do banco:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
