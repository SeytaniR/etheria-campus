/**
 * @file scripts/seed_12_level60_equipment_sets.mjs
 * @module @etheria/scripts
 * @description Montagem declarativa oficial de 12 Conjuntos LENDÁRIOS de Nível 60 ("Mais Fortes" - 144 peças)
 * cobrindo os 6 pares de classes originais com foco e ponderação assimétrica (Classe A > B e Classe B > A),
 * categorias de conjuntos, regras de bônus (100% full / 40% half) e vinculação direta ao banco de dados.
 * 
 * Regras Estritas:
 *  - 12 Conjuntos de Nível 60 cobrindo 12 peças cada (144 peças de combate lendárias).
 *  - Atributos amplificados (+35% a +50% em relação ao Lv. 50 Épico).
 *  - Sem restrição de classe: reqClassCodesJson: [].
 *  - Bônus exclusivamente de combate (combatStatBonusesJson), baseStatBonusesJson: {}.
 *  - Cobre exatamente os 12 slots de combate (HEAD, SHOULDER, CHEST, BELT, LEGS, FEET, ORNAMENT_1, ORNAMENT_2, RING, NECKLACE, WEAPON_1, WEAPON_2).
 *  - Sem asas, sem modas, sem varas de pesca.
 *  - Preço em ouro = 0 (isTradable = false, priceGold = 0, rarityTier = 'LEGENDARY').
 *  - Espelha ícones automaticamente para apps/server/cache/mcrework/.
 *  - Exporta snapshot oficial atualizado (lowcode.snapshot.json).
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

// Carrega .env se existir
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

// Lê catálogo de dados dos 12 conjuntos de Lv. 60 e definições de conjuntos
const itemsJsonPath = path.join(__dirname, 'twelve_level60_equipment_sets.json');
const setsDefsPath = path.join(__dirname, 'equipment_sets_definitions.json');

export const TWELVE_LEVEL_60_EQUIPMENT_SETS = JSON.parse(fs.readFileSync(itemsJsonPath, 'utf-8'));
export const ALL_EQUIPMENT_SETS_DEFS = JSON.parse(fs.readFileSync(setsDefsPath, 'utf-8'));

export async function runTwelveLevel60EquipmentSeed() {
  const prisma = new PrismaClient();
  const rawBaseUrl = 'https://raw.githubusercontent.com/SeytaniR/mcrework/main/web';
  const cacheBaseDir = path.join(projectRoot, 'apps', 'server', 'cache', 'mcrework');

  console.log(`\n👑 Iniciando Seed Declarativo de 12 Conjuntos Lendários de Nível 60 (${TWELVE_LEVEL_60_EQUIPMENT_SETS.length} peças)...`);

  try {
    // 1. Cadastra ou atualiza todos os conjuntos em equipment_sets
    console.log(`📦 Sincronizando ${ALL_EQUIPMENT_SETS_DEFS.length} definições de conjuntos em equipment_sets...`);
    const setCodeToDbId = new Map();

    for (const s of ALL_EQUIPMENT_SETS_DEFS) {
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
          requiredLevel: s.requiredLevel,
          rarityTier: s.rarityTier,
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
          requiredLevel: s.requiredLevel,
          rarityTier: s.rarityTier,
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

    console.log(`✅ Conjuntos de Equipamentos cadastrados e mapeados no banco.`);

    // 2. Itera sobre as 144 peças de nível 60, baixando ícones e salvando em item_templates
    let createdCount = 0;
    let updatedCount = 0;
    let iconMirrorCount = 0;

    for (const item of TWELVE_LEVEL_60_EQUIPMENT_SETS) {
      // 2.1 Espelha ícone no cache
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
            console.warn(`[WARN] Não foi possível baixar ícone ${item.icon}:`, err.message);
          }
        }
      }

      // 2.2 Determina qual conjunto o item pertence a partir do prefixo do código
      let matchedSetId = null;
      for (const [prefix, dbId] of setCodeToDbId.entries()) {
        if (item.code.startsWith(prefix)) {
          matchedSetId = dbId;
          break;
        }
      }

      // 2.3 Upsert em item_templates
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
          rarityTier: 'LEGENDARY',
          requiredLevel: 60,
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
          rarityTier: 'LEGENDARY',
          requiredLevel: 60,
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

      // 2.4 Upsert de traduções i18n
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

    console.log(`✅ Sucesso! Peças de Nível 60 cadastradas: ${createdCount} criadas, ${updatedCount} atualizadas.`);
    console.log(`🖼️  Ícones espelhados no cache local: ${iconMirrorCount}`);

    // 3. Validação final da contagem de itens por conjunto
    console.log('🔍 Verificando vinculação das peças nos 12 novos conjuntos...');
    const new12SetCodes = ALL_EQUIPMENT_SETS_DEFS.filter(s => s.requiredLevel === 60).map(s => s.code);
    for (const code of new12SetCodes) {
      const set = await prisma.equipmentSet.findUnique({
        where: { code },
        include: { _count: { select: { items: true } } }
      });
      console.log(`   - [Lv. 60] ${code}: ${set?._count.items || 0}/12 peças vinculadas.`);
    }

    // 4. Exporta snapshot canônico lowcode.snapshot.json
    console.log(`💾 Exportando Snapshot Oficial lowcode.snapshot.json...`);
    const snapshotManager = new SnapshotManager(prisma);
    const snapshotPath = await snapshotManager.exportToDisk();
    console.log(`✅ Snapshot canônico sincronizado com sucesso em: ${snapshotPath}`);

  } catch (err) {
    console.error('❌ Erro durante o seed de 12 conjuntos lendários:', err);
    throw err;
  } finally {
    await prisma.$disconnect();
  }
}

// Execução direta via CLI
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runTwelveLevel60EquipmentSeed()
    .then(() => {
      console.log('🎉 Seed de 12 Conjuntos Lendários de Nível 60 finalizado com êxito!');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
