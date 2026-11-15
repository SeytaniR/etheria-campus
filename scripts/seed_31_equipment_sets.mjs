/**
 * @file scripts/seed_31_equipment_sets.mjs
 * @description Cadastra declarativamente os 31 Conjuntos de Equipamentos no PostgreSQL,
 *   vincula os 372 equipamentos existentes aos seus respectivos conjuntos (12 peças por conjunto)
 *   e exporta o snapshot oficial lowcode.snapshot.json.
 * @rules Segue estritamente AGENTS.md (Limite < 1.000 linhas, dados preservados, sem hardcode no motor).
 */

import { PrismaClient } from '@prisma/client';
import { SnapshotManager } from '@etheria/database';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const prisma = new PrismaClient();
  const snapshotManager = new SnapshotManager(prisma);

  try {
    console.log('🚀 Iniciando cadastro de 31 Conjuntos de Equipamentos e vinculação dos 372 itens...');

    const jsonPath = path.resolve(__dirname, 'equipment_sets_definitions.json');
    const raw = await fs.readFile(jsonPath, 'utf-8');
    const setDefs = JSON.parse(raw);

    console.log(`📦 Carregadas ${setDefs.length} definições de conjuntos do JSON.`);

    // 1. Cadastra ou atualiza os 31 conjuntos e traduções i18n
    const createdSets = [];
    for (const s of setDefs) {
      const nameKey = `equipment_set.${s.code}.name`;
      const descKey = `equipment_set.${s.code}.desc`;

      // i18n pt-BR
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

      // i18n en-US
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

      createdSets.push({ ...s, dbId: setRow.id });
    }

    console.log(`✅ ${createdSets.length} Conjuntos de Equipamentos cadastrados/atualizados no banco!`);

    // 2. Vincula os 372 equipamentos existentes aos seus conjuntos
    console.log('🔗 Vinculando os 372 equipamentos aos seus conjuntos correspondentes...');
    let totalLinked = 0;

    for (const s of createdSets) {
      let updatedCount = 0;
      if (s.code === 'set_apprentice') {
        const res = await prisma.itemTemplate.updateMany({
          where: {
            itemCategory: 'CHARACTER_EQUIPMENT',
            code: { endsWith: '_do_aprendiz' },
          },
          data: { equipmentSetId: s.dbId },
        });
        updatedCount = res.count;
      } else {
        const res = await prisma.itemTemplate.updateMany({
          where: {
            itemCategory: 'CHARACTER_EQUIPMENT',
            code: { startsWith: s.prefix },
          },
          data: { equipmentSetId: s.dbId },
        });
        updatedCount = res.count;
      }

      totalLinked += updatedCount;
      console.log(`   - [ID #${s.dbId}] ${s.namePtBr} (${s.code}): ${updatedCount}/12 peças vinculadas.`);
    }

    console.log(`🎉 Total de equipamentos vinculados a conjuntos: ${totalLinked} de 372 itens.`);

    // 3. Exporta Snapshot Oficial
    console.log('💾 Exportando Snapshot Oficial lowcode.snapshot.json...');
    const snapshotPath = await snapshotManager.exportToDisk();
    console.log(`✅ Snapshot sincronizado com sucesso em: ${snapshotPath}`);

  } catch (err) {
    console.error('❌ Erro durante o seed de conjuntos de equipamentos:', err);
    throw err;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
