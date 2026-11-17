/**
 * @file scripts/seed_12_level70_equipment_sets.mjs
 * @module @etheria/scripts
 * @description Semeador declarativo oficial dos 12 Conjuntos MÍTICOS (Rank SS) de Nível 70 (144 peças),
 * com 1 conjunto especializado para cada uma das 12 classes de Etheria Campus.
 *
 * Regras Estritas:
 *  - 12 Conjuntos de Nível 70 (Rank SS) cobrindo os 12 slots de combate (144 peças).
 *  - 144 ícones PNG verificados visualmente, coerentes com a classe/conjunto e sem repetição.
 *  - Espelha ícones automaticamente em apps/server/cache/mcrework/.
 *  - Atualiza lowcode.snapshot.json e persiste em PostgreSQL (equipment_sets, item_templates, i18n_translations).
 *  - Conforme Regra #7 (< 1.000 linhas).
 */

import { PrismaClient } from '@prisma/client';
import { SnapshotManager } from '@etheria/database';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const envPath = path.join(projectRoot, '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx > 0) {
      const k = trimmed.slice(0, idx).trim();
      const v = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

const itemsJsonPath = path.join(__dirname, 'twelve_level70_equipment_sets.json');
const setsDefsPath = path.join(__dirname, 'equipment_sets_definitions.json');
const snapshotPath = path.join(projectRoot, 'packages', 'database', 'snapshots', 'lowcode.snapshot.json');

export const TWELVE_LEVEL_70_EQUIPMENT_SETS = JSON.parse(fs.readFileSync(itemsJsonPath, 'utf-8'));
export const ALL_EQUIPMENT_SETS_DEFS = JSON.parse(fs.readFileSync(setsDefsPath, 'utf-8'));

/**
 * Atualiza o lowcode.snapshot.json diretamente em disco (útil mesmo quando o banco local está offline).
 */
export function updateLocalSnapshotWithLv70() {
  if (!fs.existsSync(snapshotPath)) return;
  const snap = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'));

  const lv70Sets = ALL_EQUIPMENT_SETS_DEFS.filter((s) => s.requiredLevel === 70);
  let maxSetId = (snap.equipmentSets || []).reduce((acc, s) => Math.max(acc, Number(s.id) || 0), 0);
  const setCodeToId = new Map();

  for (const s of lv70Sets) {
    const nameKey = `equipment_set.${s.code}.name`;
    const descKey = `equipment_set.${s.code}.desc`;

    const trans = [
      { key: nameKey, locale: 'pt-BR', text: s.namePtBr },
      { key: descKey, locale: 'pt-BR', text: s.descriptionPtBr || '' },
      { key: nameKey, locale: 'en-US', text: s.namePtBr },
    ];
    for (const t of trans) {
      const idx = snap.i18nTranslations.findIndex((x) => x.key === t.key && x.locale === t.locale);
      if (idx >= 0) snap.i18nTranslations[idx] = t;
      else snap.i18nTranslations.push(t);
    }

    let existingSet = snap.equipmentSets.find((x) => x.code === s.code);
    const setId = existingSet ? existingSet.id : ++maxSetId;
    const setObj = {
      id: setId,
      code: s.code,
      nameI18nKey: nameKey,
      descriptionI18nKey: descKey,
      requiredLevel: 70,
      rarityTier: 'SS',
      minPiecesFull: s.minPiecesFull || 12,
      minPiecesHalf: s.minPiecesHalf || 6,
      halfBonusRatioPct: s.halfBonusRatioPct || 40.0,
      fullBonusRatioPct: s.fullBonusRatioPct || 100.0,
      bonusCombatStatsJson: s.bonusCombatStatsJson || {},
      isActive: true,
    };

    const sIdx = snap.equipmentSets.findIndex((x) => x.code === s.code);
    if (sIdx >= 0) snap.equipmentSets[sIdx] = setObj;
    else snap.equipmentSets.push(setObj);

    setCodeToId.set(s.code, setId);
    if (s.prefix) setCodeToId.set(s.prefix, setId);
  }

  let maxItemId = (snap.itemTemplates || []).reduce((acc, it) => Math.max(acc, Number(it.id) || 0), 0);

  for (const item of TWELVE_LEVEL_70_EQUIPMENT_SETS) {
    let matchedSetId = null;
    for (const [prefix, sid] of setCodeToId.entries()) {
      if (item.code.startsWith(prefix)) {
        matchedSetId = sid;
        break;
      }
    }

    const nameKey = `item_template:${item.code}:name`;
    const descKey = `item_template:${item.code}:description`;

    const trans = [
      { key: nameKey, locale: 'pt-BR', text: item.namePtBr },
      { key: nameKey, locale: 'en', text: item.nameEn || item.namePtBr },
      { key: descKey, locale: 'pt-BR', text: item.descPtBr },
      { key: descKey, locale: 'en', text: item.descEn || item.descPtBr },
    ];
    for (const t of trans) {
      const idx = snap.i18nTranslations.findIndex((x) => x.key === t.key && x.locale === t.locale);
      if (idx >= 0) snap.i18nTranslations[idx] = t;
      else snap.i18nTranslations.push(t);
    }

    let existingItem = snap.itemTemplates.find((x) => x.code === item.code);
    const itemId = existingItem ? existingItem.id : ++maxItemId;
    const itemObj = {
      id: itemId,
      code: item.code,
      nameI18nKey: nameKey,
      descriptionI18nKey: descKey,
      itemCategory: 'CHARACTER_EQUIPMENT',
      equipmentSlotCode: item.slot,
      rarityTier: 'SS',
      requiredLevel: 70,
      priceGold: 0,
      isTradable: false,
      mcreworkIconKey: item.icon,
      reqClassCodesJson: [],
      baseStatBonusesJson: {},
      combatStatBonusesJson: item.combatStats,
      specialEffectJson: {},
      equipmentSetId: matchedSetId,
      isActive: true,
    };

    const iIdx = snap.itemTemplates.findIndex((x) => x.code === item.code);
    if (iIdx >= 0) snap.itemTemplates[iIdx] = itemObj;
    else snap.itemTemplates.push(itemObj);
  }

  snap.exportedAt = new Date().toISOString();
  fs.writeFileSync(snapshotPath, JSON.stringify(snap, null, 2), 'utf-8');
  console.log(`✅ [Snapshot Local] lowcode.snapshot.json atualizado com 12 conjuntos e 144 equipamentos de Nível 70 (Rank SS)!`);
}

export async function runTwelveLevel70EquipmentSeed() {
  updateLocalSnapshotWithLv70();

  if (!process.env.DATABASE_URL) {
    console.log('ℹ️  DATABASE_URL ausente localmente — apenas o lowcode.snapshot.json foi atualizado.');
    return;
  }

  const prisma = new PrismaClient();
  const rawBaseUrl = 'https://raw.githubusercontent.com/SeytaniR/mcrework/main/web';
  const cacheBaseDir = path.join(projectRoot, 'apps', 'server', 'cache', 'mcrework');

  console.log(`\n👑 Iniciando Seed Declarativo de 12 Conjuntos Míticos (Rank SS) de Nível 70 (${TWELVE_LEVEL_70_EQUIPMENT_SETS.length} peças)...`);

  try {
    const setCodeToDbId = new Map();
    const lv70Sets = ALL_EQUIPMENT_SETS_DEFS.filter((s) => s.requiredLevel === 70);

    for (const s of lv70Sets) {
      const nameKey = `equipment_set.${s.code}.name`;
      const descKey = `equipment_set.${s.code}.desc`;

      await prisma.i18nTranslation.upsert({
        where: { key_locale: { key: nameKey, locale: 'pt-BR' } },
        create: { key: nameKey, locale: 'pt-BR', text: s.namePtBr },
        update: { text: s.namePtBr },
      });

      if (s.descriptionPtBr) {
        await prisma.i18nTranslation.upsert({
          where: { key_locale: { key: descKey, locale: 'pt-BR' } },
          create: { key: descKey, locale: 'pt-BR', text: s.descriptionPtBr },
          update: { text: s.descriptionPtBr },
        });
      }

      await prisma.i18nTranslation.upsert({
        where: { key_locale: { key: nameKey, locale: 'en-US' } },
        create: { key: nameKey, locale: 'en-US', text: s.namePtBr },
        update: { text: s.namePtBr },
      });

      const setRow = await prisma.equipmentSet.upsert({
        where: { code: s.code },
        create: {
          code: s.code,
          nameI18nKey: nameKey,
          descriptionI18nKey: descKey,
          requiredLevel: 70,
          rarityTier: 'SS',
          minPiecesFull: s.minPiecesFull || 12,
          minPiecesHalf: s.minPiecesHalf || 6,
          halfBonusRatioPct: s.halfBonusRatioPct || 40.0,
          fullBonusRatioPct: s.fullBonusRatioPct || 100.0,
          bonusCombatStatsJson: s.bonusCombatStatsJson || {},
          isActive: true,
        },
        update: {
          nameI18nKey: nameKey,
          descriptionI18nKey: descKey,
          requiredLevel: 70,
          rarityTier: 'SS',
          minPiecesFull: s.minPiecesFull || 12,
          minPiecesHalf: s.minPiecesHalf || 6,
          halfBonusRatioPct: s.halfBonusRatioPct || 40.0,
          fullBonusRatioPct: s.fullBonusRatioPct || 100.0,
          bonusCombatStatsJson: s.bonusCombatStatsJson || {},
          isActive: true,
        },
      });

      setCodeToDbId.set(s.code, setRow.id);
      if (s.prefix) {
        setCodeToDbId.set(s.prefix, setRow.id);
      }
    }

    let createdCount = 0;
    let updatedCount = 0;
    let iconMirrorCount = 0;

    for (const item of TWELVE_LEVEL_70_EQUIPMENT_SETS) {
      if (item.icon) {
        const targetPath = path.join(cacheBaseDir, item.icon);
        if (!fs.existsSync(targetPath)) {
          fs.mkdirSync(path.dirname(targetPath), { recursive: true });
          try {
            const res = await fetch(`${rawBaseUrl}/${item.icon}`);
            if (res.ok) {
              const buf = Buffer.from(await res.arrayBuffer());
              fs.writeFileSync(targetPath, buf);
              iconMirrorCount++;
            }
          } catch (err) {
            console.warn(`[WARN] Falha ao baixar ícone ${item.icon}:`, err.message);
          }
        }
      }

      let matchedSetId = null;
      for (const [prefix, dbId] of setCodeToDbId.entries()) {
        if (item.code.startsWith(prefix)) {
          matchedSetId = dbId;
          break;
        }
      }

      const nameKey = `item_template:${item.code}:name`;
      const descKey = `item_template:${item.code}:description`;

      const existing = await prisma.itemTemplate.findUnique({
        where: { code: item.code },
        select: { id: true },
      });

      await prisma.itemTemplate.upsert({
        where: { code: item.code },
        create: {
          code: item.code,
          nameI18nKey: nameKey,
          descriptionI18nKey: descKey,
          itemCategory: 'CHARACTER_EQUIPMENT',
          equipmentSlotCode: item.slot,
          rarityTier: 'SS',
          requiredLevel: 70,
          priceGold: 0,
          isTradable: false,
          mcreworkIconKey: item.icon,
          reqClassCodesJson: [],
          baseStatBonusesJson: {},
          combatStatBonusesJson: item.combatStats,
          specialEffectJson: {},
          equipmentSetId: matchedSetId,
          isActive: true,
        },
        update: {
          nameI18nKey: nameKey,
          descriptionI18nKey: descKey,
          itemCategory: 'CHARACTER_EQUIPMENT',
          equipmentSlotCode: item.slot,
          rarityTier: 'SS',
          requiredLevel: 70,
          priceGold: 0,
          isTradable: false,
          mcreworkIconKey: item.icon,
          reqClassCodesJson: [],
          baseStatBonusesJson: {},
          combatStatBonusesJson: item.combatStats,
          specialEffectJson: {},
          equipmentSetId: matchedSetId,
          isActive: true,
        },
      });

      if (existing) updatedCount++; else createdCount++;

      await prisma.i18nTranslation.upsert({
        where: { key_locale: { key: nameKey, locale: 'pt-BR' } },
        create: { key: nameKey, locale: 'pt-BR', text: item.namePtBr },
        update: { text: item.namePtBr },
      });

      await prisma.i18nTranslation.upsert({
        where: { key_locale: { key: nameKey, locale: 'en' } },
        create: { key: nameKey, locale: 'en', text: item.nameEn || item.namePtBr },
        update: { text: item.nameEn || item.namePtBr },
      });

      await prisma.i18nTranslation.upsert({
        where: { key_locale: { key: descKey, locale: 'pt-BR' } },
        create: { key: descKey, locale: 'pt-BR', text: item.descPtBr },
        update: { text: item.descPtBr },
      });

      await prisma.i18nTranslation.upsert({
        where: { key_locale: { key: descKey, locale: 'en' } },
        create: { key: descKey, locale: 'en', text: item.descEn || item.descPtBr },
        update: { text: item.descEn || item.descPtBr },
      });
    }

    console.log(`✅ Peças de Nível 70 (Rank SS) cadastradas: ${createdCount} criadas, ${updatedCount} atualizadas (Ícones espelhados: ${iconMirrorCount}).`);

    const snapshotManager = new SnapshotManager(prisma);
    await snapshotManager.exportToDisk();
    console.log(`✅ Snapshot canônico sincronizado com sucesso!`);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runTwelveLevel70EquipmentSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
