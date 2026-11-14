/**
 * @file scripts/seed_apprentice_equipment.mjs
 * @module @etheria/scripts
 * @description Script de automação e calibração de Game Design para criação do
 *   Conjunto Inicial de Equipamentos do Jogador (Nível 1) - "Conjunto do Aprendiz".
 * @rules
 *   - Cobre exatamente os 12 slots de combate para PERSONAGEM:
 *     HEAD, SHOULDER, CHEST, BELT, LEGS, FEET, ORNAMENT_1, ORNAMENT_2, RING, NECKLACE, WEAPON_1, WEAPON_2.
 *   - Proibido para slots não-combate (FISHING_ROD, WINGS, FASHION, FLYING_MOUNT).
 *   - 100% universal para todas as 12 classes (reqClassCodesJson: []).
 *   - Equipamentos utilizam exclusivamente bônus de atributos de combate (combatStatBonusesJson).
 *   - baseStatBonusesJson deve ser vazio ({}) conforme regra v0.19.0+.
 *   - priceGold = 0, isTradable = false, maxStack = 1, requiredLevel = 1, rarityTier = 'COMMON'.
 *   - Exporta o snapshot oficial (lowcode.snapshot.json) e espelha ícones na cache local.
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

export const APPRENTICE_EQUIPMENT_SET = [
  {
    code: 'equip_elmo_do_aprendiz',
    slot: 'HEAD',
    namePtBr: 'Elmo de Couro do Aprendiz',
    descPtBr: 'Um capuz reforçado com guarnições de couro flexível concedido aos novos recrutas de Etheria. Concede proteção básica à cabeça e clareza mental nos primeiros confrontos.',
    icon: 'assets/equipment/icons/equip_normal_200001.png',
    combatStats: {
      MAX_HP: 25,
      PHYS_DEF: 4,
      MAG_DEF: 4,
      MAG_ACCURACY: 2,
    },
  },
  {
    code: 'equip_ombreiras_do_aprendiz',
    slot: 'SHOULDER',
    namePtBr: 'Ombreiras de Treino do Aprendiz',
    descPtBr: 'Protetores de ombro acolchoados em couro macio e presilhas de latão. Absorvem impactos laterais sem comprometer a agilidade do portador.',
    icon: 'assets/equipment/icons/equip_normal_250001.png',
    combatStats: {
      MAX_HP: 20,
      PHYS_DEF: 3,
      MAG_DEF: 3,
      PHYS_EVASION: 2,
    },
  },
  {
    code: 'equip_peitoral_do_aprendiz',
    slot: 'CHEST',
    namePtBr: 'Túnica Acolchoada do Aprendiz',
    descPtBr: 'Vestimenta leve tecida com fios resistentes de linho e placas de couro curtido. É a principal proteção corporal padrão entregue pela Academia de Etheria a todos os calouros.',
    icon: 'assets/equipment/icons/equip_normal_210001.png',
    combatStats: {
      MAX_HP: 45,
      MAX_MP: 15,
      PHYS_DEF: 8,
      MAG_DEF: 8,
    },
  },
  {
    code: 'equip_cinto_do_aprendiz',
    slot: 'BELT',
    namePtBr: 'Cinto de Fivela do Aprendiz',
    descPtBr: 'Cinto rústico de couro cru com suporte reforçado para cantis e bolsas de reagentes. Mantém a postura firme durante manobras evasivas.',
    icon: 'assets/equipment/icons/equip_normal_220001.png',
    combatStats: {
      MAX_HP: 20,
      PHYS_DEF: 3,
      MAG_DEF: 3,
      MP_REGEN: 1,
    },
  },
  {
    code: 'equip_calcas_do_aprendiz',
    slot: 'LEGS',
    namePtBr: 'Calças de Treino do Aprendiz',
    descPtBr: 'Calças confeccionadas em lona grossa com joelheiras de couro reforçado. Permitem mobilidade livre para esquivas rápidas em terrenos irregulares.',
    icon: 'assets/equipment/icons/equip_normal_230001.png',
    combatStats: {
      MAX_HP: 35,
      PHYS_DEF: 6,
      MAG_DEF: 6,
      PHYS_EVASION: 2,
    },
  },
  {
    code: 'equip_botas_do_aprendiz',
    slot: 'FEET',
    namePtBr: 'Botas de Caminhada do Aprendiz',
    descPtBr: 'Calçados resistentes de solado emborrachado adequados para longas marchas e deslocamentos táticos pelas arenas do campus.',
    icon: 'assets/equipment/icons/equip_normal_240001.png',
    combatStats: {
      MAX_HP: 15,
      PHYS_DEF: 3,
      MAG_DEF: 3,
      BATTLE_MOVE_SPEED: 5,
      PHYS_EVASION: 3,
    },
  },
  {
    code: 'equip_amuleto_do_aprendiz',
    slot: 'ORNAMENT_1',
    namePtBr: 'Amuleto de Cobre do Aprendiz',
    descPtBr: 'Pequeno ornamento de cobre polido cravado com o símbolo dos novatos. Canaliza energias harmoniosas que aumentam a precisão de feitiços e ataques.',
    icon: 'assets/equipment/icons/equip_normal_320001.png',
    combatStats: {
      MAX_HP: 15,
      PHYS_ACCURACY: 4,
      MAG_ACCURACY: 4,
      CRIT_RATE: 2,
    },
  },
  {
    code: 'equip_talisma_do_aprendiz',
    slot: 'ORNAMENT_2',
    namePtBr: 'Talismã Protetor do Aprendiz',
    descPtBr: 'Ornamento encantado esculpido em madeira de salgueiro sagrado. Repele vibrações nocivas concedendo esquiva e resistência a quem o carrega.',
    icon: 'assets/equipment/icons/equip_normal_330002.png',
    combatStats: {
      MAX_MP: 15,
      PHYS_EVASION: 3,
      MAG_EVASION: 4,
      HEAL_POWER: 3,
    },
  },
  {
    code: 'equip_anel_do_aprendiz',
    slot: 'RING',
    namePtBr: 'Anel de Latão do Aprendiz',
    descPtBr: 'Um aro de latão fosco gravado com runas simples de foco. Aumenta a força dos golpes e a contundência crítica dos calouros.',
    icon: 'assets/equipment/icons/equip_normal_310002.png',
    combatStats: {
      PHYS_ATK: 4,
      MAG_ATK: 4,
      CRIT_RATE: 3,
      CRIT_DMG: 5,
    },
  },
  {
    code: 'equip_colar_do_aprendiz',
    slot: 'NECKLACE',
    namePtBr: 'Colar de Madeira do Aprendiz',
    descPtBr: 'Colar simples adornado com uma semente lapidada da Grande Árvore de Etheria. Promove a recuperação natural e estabilidade de mana e vida.',
    icon: 'assets/equipment/icons/equip_normal_300001.png',
    combatStats: {
      MAX_HP: 25,
      MAX_MP: 25,
      MP_REGEN: 1,
      HEAL_POWER: 4,
    },
  },
  {
    code: 'equip_arma_do_aprendiz',
    slot: 'WEAPON_1',
    namePtBr: 'Lâmina Rúnica do Aprendiz',
    descPtBr: 'Uma espada rúnica universal balanceada pela Academia de Etheria. Sua liga híbrida de aço e cristal canaliza tanto vigor físico quanto pulsos de energia mágica, garantindo que guerreiros, ladinos e magos desfiram golpes precisos.',
    icon: 'assets/equipment/icons/equip_normal_050100.png',
    combatStats: {
      PHYS_ATK: 14,
      MAG_ATK: 14,
      PHYS_ACCURACY: 6,
      MAG_ACCURACY: 6,
      ATTACK_SPEED: 0.05,
      ATTACK_RANGE: 10,
    },
  },
  {
    code: 'equip_foco_do_aprendiz',
    slot: 'WEAPON_2',
    namePtBr: 'Grimório Protetor do Aprendiz',
    descPtBr: 'Um tomo de batalha encadernado em placas rígidas com fecho metálico. Serve simultaneamente como foco arcano de concentração mágica e como broquel de bloqueio rápido para desviar golpes inimigos.',
    icon: 'assets/equipment/icons/equip_normal_121002.png',
    combatStats: {
      MAX_MP: 20,
      PHYS_DEF: 5,
      MAG_DEF: 5,
      PHYS_EVASION: 3,
      MAG_EVASION: 3,
      HEAL_POWER: 3,
    },
  },
];

async function downloadIconIfNeeded(iconRelPath) {
  const localCachePath = path.join(projectRoot, 'apps/server/cache/mcrework', iconRelPath);
  if (fs.existsSync(localCachePath)) {
    return;
  }
  fs.mkdirSync(path.dirname(localCachePath), { recursive: true });
  const remoteUrl = `https://seytanir.github.io/mcrework/${iconRelPath}`;
  try {
    const res = await fetch(remoteUrl);
    if (res.ok) {
      const buffer = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(localCachePath, buffer);
      console.log(`[IconCache] Baixado: ${iconRelPath}`);
    } else {
      console.warn(`[IconCache] Aviso: Não foi possível baixar ${remoteUrl} (${res.status})`);
    }
  } catch (err) {
    console.warn(`[IconCache] Erro ao baixar ${remoteUrl}:`, err.message);
  }
}

async function main() {
  const prisma = new PrismaClient();

  try {
    console.log('--- INICIANDO SEED DO CONJUNTO DO APRENDIZ (NÍVEL 1) ---');

    for (const item of APPRENTICE_EQUIPMENT_SET) {
      const nameKey = `item.${item.code}.name`;
      const descKey = `item.${item.code}.desc`;

      // 1. Cadastra/Atualiza traduções i18n
      await prisma.i18nTranslation.upsert({
        where: { key_locale: { key: nameKey, locale: 'pt-BR' } },
        update: { text: item.namePtBr },
        create: { key: nameKey, locale: 'pt-BR', text: item.namePtBr },
      });

      await prisma.i18nTranslation.upsert({
        where: { key_locale: { key: descKey, locale: 'pt-BR' } },
        update: { text: item.descPtBr },
        create: { key: descKey, locale: 'pt-BR', text: item.descPtBr },
      });

      // 2. Cadastra/Atualiza o itemTemplate
      const upserted = await prisma.itemTemplate.upsert({
        where: { code: item.code },
        update: {
          nameI18nKey: nameKey,
          descriptionI18nKey: descKey,
          mcreworkIconKey: item.icon,
          itemCategory: 'CHARACTER_EQUIPMENT',
          equipmentSlotCode: item.slot,
          rarityTier: 'COMMON',
          requiredLevel: 1,
          isTradable: false,
          priceGold: 0,
          maxStack: 1,
          cooldownSec: 0,
          targetType: 'SELF',
          effectType: null,
          effectValue: 0,
          reqClassCodesJson: [],
          baseStatBonusesJson: {},
          combatStatBonusesJson: item.combatStats,
          specialEffectJson: {},
          isActive: true,
        },
        create: {
          code: item.code,
          nameI18nKey: nameKey,
          descriptionI18nKey: descKey,
          mcreworkIconKey: item.icon,
          itemCategory: 'CHARACTER_EQUIPMENT',
          equipmentSlotCode: item.slot,
          rarityTier: 'COMMON',
          requiredLevel: 1,
          isTradable: false,
          priceGold: 0,
          maxStack: 1,
          cooldownSec: 0,
          targetType: 'SELF',
          effectType: null,
          effectValue: 0,
          reqClassCodesJson: [],
          baseStatBonusesJson: {},
          combatStatBonusesJson: item.combatStats,
          specialEffectJson: {},
          isActive: true,
        },
      });

      console.log(`[Item #${upserted.id}] ${upserted.code} (${item.slot}) -> ${item.namePtBr}`);

      // 3. Garante download do ícone para cache local
      await downloadIconIfNeeded(item.icon);
    }

    // 4. Exporta snapshot atualizado
    console.log('\n--- EXPORTANDO SNAPSHOT LOWCODE ---');
    const { SnapshotManager } = await import('@etheria/database');
    const sm = new SnapshotManager(prisma);
    const snapPath = await sm.exportToDisk();
    console.log(`Snapshot exportado com sucesso: ${snapPath}`);

    console.log('\n✅ Conjunto Inicial do Aprendiz (12 peças) configurado com sucesso!');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('❌ Erro durante o seed do conjunto inicial:', err);
  process.exit(1);
});
