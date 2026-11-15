/**
 * @file scripts/migrate_equipment_rarity_to_ranks.mjs
 * @module @etheria/scripts
 * @description Migração oficial de alinhamento de raridades de equipamentos e conjuntos
 * para o padrão nativo de Ranks de Etheria (SS, S, A, B, C, D, F), conforme instrução do usuário.
 * 
 * Mapeamento:
 *  - Nível 60 (Lendário) -> Rank S (Preservando edição do usuário em Adagas do Ceifador Fantasma)
 *  - Nível 50 (Épico)    -> Rank A
 *  - Nível 40 (Raro)     -> Rank B
 *  - Nível 1 (Aprendiz)  -> Rank F
 *  - Sets e traduções i18n devidamente alinhados aos Ranks oficiais.
 * 
 * Regras Estritas:
 *  - Segue AGENTS.md (< 1.000 linhas).
 *  - Não destrói dados existentes, preserva edições manuais feitas pelo usuário.
 *  - Atualiza banco de dados, arquivos declarativos e snapshot canônico.
 */

import { PrismaClient } from '@prisma/client';
import { SnapshotManager } from '@etheria/database';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

export async function runRarityMigration() {
  const prisma = new PrismaClient();
  const snapshotManager = new SnapshotManager(prisma);

  try {
    console.log('🚀 Iniciando Migração de Raridades para Ranks Oficiais (SS, S, A, B, C, D, F)...');

    // 1. Atualiza rarityTier em item_templates
    console.log('📦 1. Atualizando rarityTier em item_templates...');

    // 1.1 Nível 60 -> Rank S (preservando o item editado pelo usuário equip_lv60_ghostreaper_weapon1)
    const resLv60 = await prisma.itemTemplate.updateMany({
      where: {
        itemCategory: 'CHARACTER_EQUIPMENT',
        code: { startsWith: 'equip_lv60_' },
        NOT: { code: 'equip_lv60_ghostreaper_weapon1' },
      },
      data: { rarityTier: 'S' },
    });
    console.log(`   - Nível 60 -> Rank S: ${resLv60.count} itens atualizados (+ 1 já configurado pelo usuário).`);

    // 1.2 Nível 50 -> Rank A
    const resLv50 = await prisma.itemTemplate.updateMany({
      where: {
        itemCategory: 'CHARACTER_EQUIPMENT',
        code: { startsWith: 'equip_lv50_' },
      },
      data: { rarityTier: 'A' },
    });
    console.log(`   - Nível 50 -> Rank A: ${resLv50.count} itens atualizados.`);

    // 1.3 Nível 40 -> Rank B
    const resLv40 = await prisma.itemTemplate.updateMany({
      where: {
        itemCategory: 'CHARACTER_EQUIPMENT',
        code: { startsWith: 'equip_lv40_' },
      },
      data: { rarityTier: 'B' },
    });
    console.log(`   - Nível 40 -> Rank B: ${resLv40.count} itens atualizados.`);

    // 1.4 Nível 1 (Aprendiz) -> Rank F
    const resLv1 = await prisma.itemTemplate.updateMany({
      where: {
        itemCategory: 'CHARACTER_EQUIPMENT',
        OR: [
          { code: { endsWith: '_do_aprendiz' } },
          { requiredLevel: 1 },
        ],
      },
      data: { rarityTier: 'F' },
    });
    console.log(`   - Nível 1 / Aprendiz -> Rank F: ${resLv1.count} itens atualizados.`);

    // 1.5 Qualquer outro item remanescente com tags de texto antigas
    await prisma.itemTemplate.updateMany({
      where: { rarityTier: 'LEGENDARY' },
      data: { rarityTier: 'S' },
    });
    await prisma.itemTemplate.updateMany({
      where: { rarityTier: 'EPIC' },
      data: { rarityTier: 'A' },
    });
    await prisma.itemTemplate.updateMany({
      where: { rarityTier: 'RARE' },
      data: { rarityTier: 'B' },
    });
    await prisma.itemTemplate.updateMany({
      where: { rarityTier: 'COMMON' },
      data: { rarityTier: 'F' },
    });

    // 2. Atualiza rarityTier em equipment_sets
    console.log('👑 2. Atualizando rarityTier em equipment_sets...');
    const setsLv60 = await prisma.equipmentSet.updateMany({
      where: { requiredLevel: 60 },
      data: { rarityTier: 'S' },
    });
    const setsLv50 = await prisma.equipmentSet.updateMany({
      where: { requiredLevel: 50 },
      data: { rarityTier: 'A' },
    });
    const setsLv40 = await prisma.equipmentSet.updateMany({
      where: { requiredLevel: 40 },
      data: { rarityTier: 'B' },
    });
    const setsLv1 = await prisma.equipmentSet.updateMany({
      where: { requiredLevel: 1 },
      data: { rarityTier: 'F' },
    });
    console.log(`   - Conjuntos atualizados: Lv.60: ${setsLv60.count} (Rank S), Lv.50: ${setsLv50.count} (Rank A), Lv.40: ${setsLv40.count} (Rank B), Lv.1: ${setsLv1.count} (Rank F).`);

    // 3. Alinha descrições i18n para substituir tags textuais antigas pelos Ranks oficiais
    console.log('🌐 3. Alinhando tags de raridade nas descrições de itens em i18n_translations...');
    const descsToUpdate = await prisma.i18nTranslation.findMany({
      where: {
        key: { startsWith: 'item_template:' },
        key: { endsWith: ':description' },
      },
      select: { id: true, key: true, locale: true, text: true },
    });

    let transUpdatedCount = 0;
    for (const t of descsToUpdate) {
      let newText = t.text;
      if (newText.includes('(Lendário)')) newText = newText.replace(/\(Lendário\)/g, '(Rank S)');
      if (newText.includes('(Legendary)')) newText = newText.replace(/\(Legendary\)/g, '(Rank S)');
      if (newText.includes('(Épico)')) newText = newText.replace(/\(Épico\)/g, '(Rank A)');
      if (newText.includes('(Epic)')) newText = newText.replace(/\(Epic\)/g, '(Rank A)');
      if (newText.includes('(Raro)')) newText = newText.replace(/\(Raro\)/g, '(Rank B)');
      if (newText.includes('(Rare)')) newText = newText.replace(/\(Rare\)/g, '(Rank B)');
      if (newText.includes('(Comum)')) newText = newText.replace(/\(Comum\)/g, '(Rank F)');
      if (newText.includes('(Common)')) newText = newText.replace(/\(Common\)/g, '(Rank F)');

      if (newText !== t.text) {
        await prisma.i18nTranslation.update({
          where: { id: t.id },
          data: { text: newText },
        });
        transUpdatedCount++;
      }
    }
    console.log(`   - Traduções de descrições alinhadas com Ranks oficiais: ${transUpdatedCount} registros.`);

    // 4. Alinha arquivos JSON declarativos locais
    console.log('📁 4. Sincronizando arquivos JSON de definição...');
    
    // 4.1 equipment_sets_definitions.json
    const setsDefsPath = path.join(__dirname, 'equipment_sets_definitions.json');
    if (fs.existsSync(setsDefsPath)) {
      const setsDefs = JSON.parse(fs.readFileSync(setsDefsPath, 'utf-8'));
      for (const s of setsDefs) {
        if (s.requiredLevel === 60) s.rarityTier = 'S';
        else if (s.requiredLevel === 50) s.rarityTier = 'A';
        else if (s.requiredLevel === 40) s.rarityTier = 'B';
        else if (s.requiredLevel === 1) s.rarityTier = 'F';
      }
      fs.writeFileSync(setsDefsPath, JSON.stringify(setsDefs, null, 2), 'utf-8');
      console.log('   - equipment_sets_definitions.json atualizado.');
    }

    // 4.2 twelve_level60_equipment_sets.json
    const lv60JsonPath = path.join(__dirname, 'twelve_level60_equipment_sets.json');
    if (fs.existsSync(lv60JsonPath)) {
      const itemsLv60 = JSON.parse(fs.readFileSync(lv60JsonPath, 'utf-8'));
      for (const it of itemsLv60) {
        if (it.descPtBr) it.descPtBr = it.descPtBr.replace(/\(Lendário\)/g, '(Rank S)');
        if (it.descEn) it.descEn = it.descEn.replace(/\(Legendary\)/g, '(Rank S)');
      }
      fs.writeFileSync(lv60JsonPath, JSON.stringify(itemsLv60, null, 2), 'utf-8');
      console.log('   - twelve_level60_equipment_sets.json atualizado.');
    }

    // 4.3 twelve_level50_equipment_sets.json
    const lv50JsonPath = path.join(__dirname, 'twelve_level50_equipment_sets.json');
    if (fs.existsSync(lv50JsonPath)) {
      const itemsLv50 = JSON.parse(fs.readFileSync(lv50JsonPath, 'utf-8'));
      for (const it of itemsLv50) {
        if (it.descPtBr) it.descPtBr = it.descPtBr.replace(/\(Épico\)/g, '(Rank A)');
        if (it.descEn) it.descEn = it.descEn.replace(/\(Epic\)/g, '(Rank A)');
      }
      fs.writeFileSync(lv50JsonPath, JSON.stringify(itemsLv50, null, 2), 'utf-8');
      console.log('   - twelve_level50_equipment_sets.json atualizado.');
    }

    // 4.4 twelve_level40_equipment_sets.json
    const lv40JsonPath = path.join(__dirname, 'twelve_level40_equipment_sets.json');
    if (fs.existsSync(lv40JsonPath)) {
      const itemsLv40 = JSON.parse(fs.readFileSync(lv40JsonPath, 'utf-8'));
      for (const it of itemsLv40) {
        if (it.descPtBr) it.descPtBr = it.descPtBr.replace(/\(Raro\)/g, '(Rank B)');
        if (it.descEn) it.descEn = it.descEn.replace(/\(Rare\)/g, '(Rank B)');
      }
      fs.writeFileSync(lv40JsonPath, JSON.stringify(itemsLv40, null, 2), 'utf-8');
      console.log('   - twelve_level40_equipment_sets.json atualizado.');
    }

    // 5. Exporta Snapshot Oficial Atualizado
    console.log('💾 5. Exportando Snapshot Oficial lowcode.snapshot.json...');
    const snapshotPath = await snapshotManager.exportToDisk();
    console.log(`✅ Snapshot sincronizado com sucesso em: ${snapshotPath}`);

    console.log('\n🎉 Migração de raridades para Ranks oficiais concluída com êxito!');
  } catch (err) {
    console.error('❌ Erro durante a migração de raridades:', err);
    throw err;
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runRarityMigration()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
