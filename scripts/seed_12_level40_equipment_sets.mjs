/**
 * @file scripts/seed_12_level40_equipment_sets.mjs
 * @module @etheria/scripts
 * @description Montagem declarativa oficial de 12 Conjuntos Especializados de Nível 40 (144 peças)
 * cobrindo os 6 pares de classes originais com foco e ponderação assimétrica (Classe A > B e Classe B > A).
 * 
 * Regras Estritas:
 *  - 12 Conjuntos de Nível 40 cobrindo 12 peças cada (144 peças de combate).
 *  - Sem restrição de classe: reqClassCodesJson: [].
 *  - Bônus exclusivamente de combate (combatStatBonusesJson), baseStatBonusesJson: {}.
 *  - Cobre exatamente os 12 slots de combate (HEAD, SHOULDER, CHEST, BELT, LEGS, FEET, ORNAMENT_1, ORNAMENT_2, RING, NECKLACE, WEAPON_1, WEAPON_2).
 *  - Sem asas, sem modas, sem varas de pesca.
 *  - Preço em ouro = 0 (isTradable = false, priceGold = 0, rarityTier = 'RARE').
 *  - Espelha ícones automaticamente para apps/server/cache/mcrework/.
 *  - Exporta snapshot oficial atualizado (lowcode.snapshot.json).
 *  - Conforme Regra #7 (< 1.000 linhas).
 */

import { PrismaClient } from '@prisma/client';
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

// Lê catálogo de dados dos 12 conjuntos
const dataJsonPath = path.join(__dirname, 'twelve_level40_equipment_sets.json');
export const TWELVE_LEVEL_40_EQUIPMENT_SETS = JSON.parse(fs.readFileSync(dataJsonPath, 'utf-8'));

export async function runTwelveLevel40EquipmentSeed() {
  const prisma = new PrismaClient();
  const rawBaseUrl = 'https://raw.githubusercontent.com/SeytaniR/mcrework/main/web';
  const cacheBaseDir = path.join(projectRoot, 'apps', 'server', 'cache', 'mcrework');

  console.log(`\n🛡️  Iniciando Seed Declarativo de 12 Conjuntos de Nível 40 (${TWELVE_LEVEL_40_EQUIPMENT_SETS.length} peças)...`);

  try {
    let createdCount = 0;
    let updatedCount = 0;
    let iconMirrorCount = 0;

    for (const item of TWELVE_LEVEL_40_EQUIPMENT_SETS) {
      // 1. Espelha ícone para cache local se ainda não existir
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

      // 2. Upsert declarativo em item_templates
      const nameKey = `item_template:${item.code}:name`;
      const descKey = `item_template:${item.code}:description`;

      const existing = await prisma.itemTemplate.findUnique({
        where: { code: item.code },
        select: { id: true }
      });

      const template = await prisma.itemTemplate.upsert({
        where: { code: item.code },
        create: {
          code: item.code,
          nameI18nKey: nameKey,
          descriptionI18nKey: descKey,
          itemCategory: 'CHARACTER_EQUIPMENT',
          equipmentSlotCode: item.slot,
          rarityTier: 'RARE',
          requiredLevel: 40,
          priceGold: 0,
          isTradable: false,
          mcreworkIconKey: item.icon,
          reqClassCodesJson: [],
          baseStatBonusesJson: {},
          combatStatBonusesJson: item.combatStats,
          specialEffectJson: {},
          isActive: true,
        },
        update: {
          nameI18nKey: nameKey,
          descriptionI18nKey: descKey,
          itemCategory: 'CHARACTER_EQUIPMENT',
          equipmentSlotCode: item.slot,
          rarityTier: 'RARE',
          requiredLevel: 40,
          priceGold: 0,
          isTradable: false,
          mcreworkIconKey: item.icon,
          reqClassCodesJson: [],
          baseStatBonusesJson: {},
          combatStatBonusesJson: item.combatStats,
          specialEffectJson: {},
          isActive: true,
        }
      });

      if (existing) updatedCount++; else createdCount++;

      // 3. Upsert de traduções i18n
      await prisma.i18nTranslation.upsert({
        where: { key_locale: { key: nameKey, locale: 'pt-BR' } },
        create: { key: nameKey, locale: 'pt-BR', text: item.namePtBr },
        update: { text: item.namePtBr }
      });

      await prisma.i18nTranslation.upsert({
        where: { key_locale: { key: nameKey, locale: 'en' } },
        create: { key: nameKey, locale: 'en', text: item.nameEn || item.namePtBr },
        update: { text: item.nameEn || item.namePtBr }
      });

      await prisma.i18nTranslation.upsert({
        where: { key_locale: { key: descKey, locale: 'pt-BR' } },
        create: { key: descKey, locale: 'pt-BR', text: item.descPtBr },
        update: { text: item.descPtBr }
      });

      await prisma.i18nTranslation.upsert({
        where: { key_locale: { key: descKey, locale: 'en' } },
        create: { key: descKey, locale: 'en', text: item.descEn || item.descPtBr },
        update: { text: item.descEn || item.descPtBr }
      });
    }

    console.log(`✅ Sucesso! Peças cadastradas: ${createdCount} criadas, ${updatedCount} atualizadas.`);
    console.log(`🖼️  Ícones espelhados no cache: ${iconMirrorCount}`);

    // 4. Exporta snapshot oficial atualizado
    console.log(`📦 Atualizando snapshot canônico lowcode.snapshot.json...`);
    const { SnapshotManager } = await import('@etheria/database');
    const snapshotManager = new SnapshotManager(prisma);
    const snapshotPath = await snapshotManager.exportToDisk();
    console.log(`💾 Snapshot exportado com sucesso em: ${snapshotPath}`);

  } catch (err) {
    console.error('❌ Erro no seed de 12 conjuntos de equipamentos:', err);
    throw err;
  } finally {
    await prisma.$disconnect();
  }
}

// Execução direta via CLI
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runTwelveLevel40EquipmentSeed()
    .then(() => {
      console.log('🎉 Seed de 12 Conjuntos de Nível 40 finalizado!');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
