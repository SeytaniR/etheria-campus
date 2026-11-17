/**
 * @file packages/database/src/seedBatchFiveMonsters.ts
 * @description Semeador do quinto lote de 10 monstros procedurais (#58 a #67), com prioridade total
 * para classes baixas (Ranks F e D) e para as raças Humano, Fada e Celestial, com drops de essência a 80%.
 * @rules Estrita observância da Regra #7 (< 1.000 linhas).
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const snapshotPath = path.resolve(__dirname, '../snapshots/lowcode.snapshot.json');

export interface MonsterSeedItem {
  id: number;
  code: string;
  mcreworkMonsterKey: string;
  namePtBr: string;
  descriptionPtBr: string;
  raceCode: string;
  fixedElementCode: string;
  rarityTier: string;
  combatStyle: 'MELEE' | 'RANGED';
  attackRange: number;
  damageType: 'PHYSICAL' | 'MAGICAL';
  groundOffsetY: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  baseAttributes: {
    STR: number;
    VIT: number;
    AGI: number;
    DEX: number;
    INT: number;
    WIS: number;
  };
  baseCombatAttributes: {
    BATTLE_MOVE_SPEED: number;
    ATTACK_SPEED: number;
    CRIT_RATE: number;
    CRIT_DMG: number;
    PHYS_ACCURACY: number;
    MAG_ACCURACY: number;
    PHYS_EVASION: number;
    MAG_EVASION: number;
  };
  skill: {
    id: number;
    code: string;
    namePtBr: string;
    descriptionPtBr: string;
    mcreworkIconKey: string;
    castActionId: number;
    mcreworkVfxKey: string;
    mpCost: number;
    cooldownSeconds: number;
    castRange: number;
    aoeRadius: number;
    targetScope: 'SINGLE_TARGET' | 'AOE_TARGET';
    effectBlocks: any[];
  };
  lootTemplateId: number;
  biomes: number[];
}

export const BATCH_FIVE_MONSTERS: MonsterSeedItem[] = [
  // 1. RANK F: Salteador Voador das Dunas (creature_000037, 102x111px) - HUMAN
  {
    id: 58,
    code: 'monster_58',
    mcreworkMonsterKey: 'creature_000037',
    namePtBr: 'Salteador Voador das Dunas',
    descriptionPtBr: 'Ladrão nômade ágil que salta entre dunas armando emboscadas para viajantes distraídos.',
    raceCode: 'HUMAN',
    fixedElementCode: 'AIR',
    rarityTier: 'F',
    combatStyle: 'RANGED',
    attackRange: 160,
    damageType: 'PHYSICAL',
    groundOffsetY: -2,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    baseAttributes: { STR: 9, VIT: 13, AGI: 12, DEX: 11, INT: 6, WIS: 6 },
    baseCombatAttributes: {
      BATTLE_MOVE_SPEED: 125,
      ATTACK_SPEED: 0.95,
      CRIT_RATE: 7,
      CRIT_DMG: 150,
      PHYS_ACCURACY: 95,
      MAG_ACCURACY: 95,
      PHYS_EVASION: 8,
      MAG_EVASION: 6
    },
    skill: {
      id: 96,
      code: 'skill_mob_bandit_quickdraw',
      namePtBr: 'Tiro Rápido do Salteador',
      descriptionPtBr: 'Dispara um projétil de arremesso veloz que causa dano físico imediato.',
      mcreworkIconKey: '10001',
      castActionId: 7,
      mcreworkVfxKey: '10008',
      mpCost: 10,
      cooldownSeconds: 5,
      castRange: 170,
      aoeRadius: 0,
      targetScope: 'SINGLE_TARGET',
      effectBlocks: [
        {
          blockType: 'DAMAGE',
          damageType: 'PHYSICAL',
          scaleStat: 'PHYS_ATK',
          scalePct: 140,
          flatAmount: 18,
          critBonusPct: 8,
          elementCode: 'AIR'
        }
      ]
    },
    lootTemplateId: 34, // item_essencia_humana_l30fi
    biomes: [10, 9, 11] // SAND_DUNES, DRY_STEPPES, HIDDEN_OASIS
  },

  // 2. RANK F: Vigia das Estradas Reais (creature_000046, 122x142px) - HUMAN
  {
    id: 59,
    code: 'monster_59',
    mcreworkMonsterKey: 'creature_000046',
    namePtBr: 'Vigia das Estradas Reais',
    descriptionPtBr: 'Patrulheiro renegado que cobra pedágios ilegais em estradas isoladas com seu bastão pesado.',
    raceCode: 'HUMAN',
    fixedElementCode: 'NEUTRAL',
    rarityTier: 'F',
    combatStyle: 'MELEE',
    attackRange: 75,
    damageType: 'PHYSICAL',
    groundOffsetY: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    baseAttributes: { STR: 11, VIT: 14, AGI: 9, DEX: 9, INT: 6, WIS: 8 },
    baseCombatAttributes: {
      BATTLE_MOVE_SPEED: 120,
      ATTACK_SPEED: 0.90,
      CRIT_RATE: 6,
      CRIT_DMG: 150,
      PHYS_ACCURACY: 95,
      MAG_ACCURACY: 95,
      PHYS_EVASION: 6,
      MAG_EVASION: 6
    },
    skill: {
      id: 97,
      code: 'skill_mob_baton_strike',
      namePtBr: 'Golpe de Bastão do Vigia',
      descriptionPtBr: 'Desfere uma pancada contundente na cabeça do alvo com um porrete pesado.',
      mcreworkIconKey: '10002',
      castActionId: 5,
      mcreworkVfxKey: '10008',
      mpCost: 10,
      cooldownSeconds: 5,
      castRange: 80,
      aoeRadius: 0,
      targetScope: 'SINGLE_TARGET',
      effectBlocks: [
        {
          blockType: 'DAMAGE',
          damageType: 'PHYSICAL',
          scaleStat: 'PHYS_ATK',
          scalePct: 145,
          flatAmount: 20,
          critBonusPct: 6,
          elementCode: 'NEUTRAL'
        }
      ]
    },
    lootTemplateId: 34, // item_essencia_humana_l30fi
    biomes: [1, 2, 36] // VERDANT_PLAINS, TEMPERATE_WOODS, ACADEMY_GROUNDS
  },

  // 3. RANK D: Clérigo Renegado das Areias (creature_000035, 95x97px) - HUMAN
  {
    id: 60,
    code: 'monster_60',
    mcreworkMonsterKey: 'creature_000035',
    namePtBr: 'Clérigo Renegado das Areias',
    descriptionPtBr: 'Ex-monge devoto corrompido pelos ventos do deserto, conjurando feitiços punitivos de poeira e terra.',
    raceCode: 'HUMAN',
    fixedElementCode: 'EARTH',
    rarityTier: 'D',
    combatStyle: 'RANGED',
    attackRange: 180,
    damageType: 'MAGICAL',
    groundOffsetY: -2,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    baseAttributes: { STR: 9, VIT: 15, AGI: 11, DEX: 13, INT: 14, WIS: 14 },
    baseCombatAttributes: {
      BATTLE_MOVE_SPEED: 125,
      ATTACK_SPEED: 1.00,
      CRIT_RATE: 8,
      CRIT_DMG: 150,
      PHYS_ACCURACY: 96,
      MAG_ACCURACY: 100,
      PHYS_EVASION: 8,
      MAG_EVASION: 10
    },
    skill: {
      id: 98,
      code: 'skill_mob_sand_curse',
      namePtBr: 'Praga das Areias Escaldantes',
      descriptionPtBr: 'Conjura um vórtice de terra sufocante que atinge o inimigo com dano mágico contínuo.',
      mcreworkIconKey: '10003',
      castActionId: 7,
      mcreworkVfxKey: '10014',
      mpCost: 14,
      cooldownSeconds: 6,
      castRange: 190,
      aoeRadius: 0,
      targetScope: 'SINGLE_TARGET',
      effectBlocks: [
        {
          blockType: 'DAMAGE',
          damageType: 'MAGICAL',
          scaleStat: 'MAG_ATK',
          scalePct: 165,
          flatAmount: 28,
          critBonusPct: 8,
          elementCode: 'EARTH'
        }
      ]
    },
    lootTemplateId: 34, // item_essencia_humana_l30fi
    biomes: [10, 11, 12] // SAND_DUNES, HIDDEN_OASIS, ROCKY_CANYON
  },

  // 4. RANK F: Pixie Fúngico dos Bosques (creature_000014, 76x83px) - FAIRY
  {
    id: 61,
    code: 'monster_61',
    mcreworkMonsterKey: 'creature_000014',
    namePtBr: 'Pixie Fúngico dos Bosques',
    descriptionPtBr: 'Fadinha minúscula com chapéu de cogumelo que flutua entre a relva dispersando pó mágico inebriante.',
    raceCode: 'FAIRY',
    fixedElementCode: 'EARTH',
    rarityTier: 'F',
    combatStyle: 'RANGED',
    attackRange: 170,
    damageType: 'MAGICAL',
    groundOffsetY: -4,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    baseAttributes: { STR: 5, VIT: 11, AGI: 14, DEX: 12, INT: 11, WIS: 9 },
    baseCombatAttributes: {
      BATTLE_MOVE_SPEED: 130,
      ATTACK_SPEED: 1.00,
      CRIT_RATE: 7,
      CRIT_DMG: 150,
      PHYS_ACCURACY: 95,
      MAG_ACCURACY: 98,
      PHYS_EVASION: 10,
      MAG_EVASION: 10
    },
    skill: {
      id: 99,
      code: 'skill_mob_pixie_spore_puff',
      namePtBr: 'Sopro Feérico de Esporos',
      descriptionPtBr: 'Lança uma rajada de pólen fúngico cintilante que desorienta e danifica o oponente.',
      mcreworkIconKey: '10006',
      castActionId: 7,
      mcreworkVfxKey: '10015',
      mpCost: 11,
      cooldownSeconds: 5,
      castRange: 180,
      aoeRadius: 0,
      targetScope: 'SINGLE_TARGET',
      effectBlocks: [
        {
          blockType: 'DAMAGE',
          damageType: 'MAGICAL',
          scaleStat: 'MAG_ATK',
          scalePct: 145,
          flatAmount: 18,
          critBonusPct: 8,
          elementCode: 'EARTH'
        }
      ]
    },
    lootTemplateId: 39, // item_essencia_elfica_gfegf
    biomes: [6, 2, 5] // FAIRY_GARDEN, TEMPERATE_WOODS, BAMBOO_GROVE
  },

  // 5. RANK F: Gato Feérico Ilusório (creature_001069, 141x101px) - FAIRY
  {
    id: 62,
    code: 'monster_62',
    mcreworkMonsterKey: 'creature_001069',
    namePtBr: 'Gato Feérico Ilusório',
    descriptionPtBr: 'Espírito felino alado e travesso que desaparece no ar e reaparece desferindo unhadas brincalhonas.',
    raceCode: 'FAIRY',
    fixedElementCode: 'AIR',
    rarityTier: 'F',
    combatStyle: 'MELEE',
    attackRange: 75,
    damageType: 'PHYSICAL',
    groundOffsetY: -3,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    baseAttributes: { STR: 8, VIT: 12, AGI: 15, DEX: 13, INT: 8, WIS: 8 },
    baseCombatAttributes: {
      BATTLE_MOVE_SPEED: 135,
      ATTACK_SPEED: 1.05,
      CRIT_RATE: 8,
      CRIT_DMG: 150,
      PHYS_ACCURACY: 96,
      MAG_ACCURACY: 95,
      PHYS_EVASION: 12,
      MAG_EVASION: 10
    },
    skill: {
      id: 100,
      code: 'skill_mob_phantom_claw',
      namePtBr: 'Garras da Ilusão Feérica',
      descriptionPtBr: 'Salta no ar com elegância feérica e rasga o alvo com garras de brisa encantada.',
      mcreworkIconKey: '10001',
      castActionId: 5,
      mcreworkVfxKey: '10008',
      mpCost: 11,
      cooldownSeconds: 5,
      castRange: 80,
      aoeRadius: 0,
      targetScope: 'SINGLE_TARGET',
      effectBlocks: [
        {
          blockType: 'DAMAGE',
          damageType: 'PHYSICAL',
          scaleStat: 'PHYS_ATK',
          scalePct: 150,
          flatAmount: 20,
          critBonusPct: 10,
          elementCode: 'AIR'
        }
      ]
    },
    lootTemplateId: 39, // item_essencia_elfica_gfegf
    biomes: [6, 1, 7] // FAIRY_GARDEN, VERDANT_PLAINS, AUTUMN_WOODS
  },

  // 6. RANK D: Fada Borboleta Noturna (creature_001078, 122x121px) - FAIRY
  {
    id: 63,
    code: 'monster_63',
    mcreworkMonsterKey: 'creature_001078',
    namePtBr: 'Fada Borboleta Noturna',
    descriptionPtBr: 'Criatura feérica com asas de mariposa lunar cujas escamas reflexivas refletem o brilho das estrelas.',
    raceCode: 'FAIRY',
    fixedElementCode: 'NEUTRAL',
    rarityTier: 'D',
    combatStyle: 'RANGED',
    attackRange: 190,
    damageType: 'MAGICAL',
    groundOffsetY: -4,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    baseAttributes: { STR: 7, VIT: 14, AGI: 14, DEX: 14, INT: 15, WIS: 13 },
    baseCombatAttributes: {
      BATTLE_MOVE_SPEED: 135,
      ATTACK_SPEED: 1.00,
      CRIT_RATE: 9,
      CRIT_DMG: 150,
      PHYS_ACCURACY: 96,
      MAG_ACCURACY: 102,
      PHYS_EVASION: 10,
      MAG_EVASION: 12
    },
    skill: {
      id: 101,
      code: 'skill_mob_butterfly_flutter',
      namePtBr: 'Espectro de Asas Noturnas',
      descriptionPtBr: 'Bate suas asas resplandecentes disparando dardos de éter translúcido.',
      mcreworkIconKey: '10006',
      castActionId: 7,
      mcreworkVfxKey: '10015',
      mpCost: 14,
      cooldownSeconds: 6,
      castRange: 200,
      aoeRadius: 0,
      targetScope: 'SINGLE_TARGET',
      effectBlocks: [
        {
          blockType: 'DAMAGE',
          damageType: 'MAGICAL',
          scaleStat: 'MAG_ATK',
          scalePct: 165,
          flatAmount: 26,
          critBonusPct: 10,
          elementCode: 'NEUTRAL'
        }
      ]
    },
    lootTemplateId: 39, // item_essencia_elfica_gfegf
    biomes: [6, 3, 19] // FAIRY_GARDEN, DENSE_FOREST, MISTY_SWAMP
  },

  // 7. RANK D: Espírito Silvestre Guardião (creature_100006, 106x107px) - FAIRY
  {
    id: 64,
    code: 'monster_64',
    mcreworkMonsterKey: 'creature_100006',
    namePtBr: 'Espírito Silvestre Guardião',
    descriptionPtBr: 'Guardião encantado dos bosques arcanos que protege ninhos e fontes de água pura.',
    raceCode: 'FAIRY',
    fixedElementCode: 'EARTH',
    rarityTier: 'D',
    combatStyle: 'MELEE',
    attackRange: 80,
    damageType: 'PHYSICAL',
    groundOffsetY: -2,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    baseAttributes: { STR: 12, VIT: 16, AGI: 12, DEX: 12, INT: 11, WIS: 12 },
    baseCombatAttributes: {
      BATTLE_MOVE_SPEED: 130,
      ATTACK_SPEED: 0.95,
      CRIT_RATE: 8,
      CRIT_DMG: 150,
      PHYS_ACCURACY: 98,
      MAG_ACCURACY: 96,
      PHYS_EVASION: 8,
      MAG_EVASION: 8
    },
    skill: {
      id: 102,
      code: 'skill_mob_sylph_strike',
      namePtBr: 'Estocada Floral do Silfo',
      descriptionPtBr: 'Atinge o adversário com folhas energizadas endurecidas como lanças vegetais.',
      mcreworkIconKey: '10005',
      castActionId: 5,
      mcreworkVfxKey: '10013',
      mpCost: 13,
      cooldownSeconds: 6,
      castRange: 85,
      aoeRadius: 0,
      targetScope: 'SINGLE_TARGET',
      effectBlocks: [
        {
          blockType: 'DAMAGE',
          damageType: 'PHYSICAL',
          scaleStat: 'PHYS_ATK',
          scalePct: 160,
          flatAmount: 25,
          critBonusPct: 8,
          elementCode: 'EARTH'
        }
      ]
    },
    lootTemplateId: 39, // item_essencia_elfica_gfegf
    biomes: [3, 8, 6] // DENSE_FOREST, GIANT_ROOTS, FAIRY_GARDEN
  },

  // 8. RANK F: Noviço Celestial Aprendiz (creature_200127, 117x115px) - CELESTIAL
  {
    id: 65,
    code: 'monster_65',
    mcreworkMonsterKey: 'creature_200127',
    namePtBr: 'Noviço Celestial Aprendiz',
    descriptionPtBr: 'Pequeno querubim em treinamento que voa desajeitadamente disparando feixes de luz cândida.',
    raceCode: 'CELESTIAL',
    fixedElementCode: 'AIR',
    rarityTier: 'F',
    combatStyle: 'RANGED',
    attackRange: 175,
    damageType: 'MAGICAL',
    groundOffsetY: -3,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    baseAttributes: { STR: 5, VIT: 12, AGI: 12, DEX: 12, INT: 12, WIS: 12 },
    baseCombatAttributes: {
      BATTLE_MOVE_SPEED: 130,
      ATTACK_SPEED: 0.95,
      CRIT_RATE: 7,
      CRIT_DMG: 150,
      PHYS_ACCURACY: 95,
      MAG_ACCURACY: 98,
      PHYS_EVASION: 8,
      MAG_EVASION: 10
    },
    skill: {
      id: 103,
      code: 'skill_mob_angelic_spark',
      namePtBr: 'Centelha Angelical Pura',
      descriptionPtBr: 'Dispara um raio de luz celestial que purifica e queima magicamente alvos hostis.',
      mcreworkIconKey: '10006',
      castActionId: 7,
      mcreworkVfxKey: '10015',
      mpCost: 11,
      cooldownSeconds: 5,
      castRange: 180,
      aoeRadius: 0,
      targetScope: 'SINGLE_TARGET',
      effectBlocks: [
        {
          blockType: 'DAMAGE',
          damageType: 'MAGICAL',
          scaleStat: 'MAG_ATK',
          scalePct: 145,
          flatAmount: 18,
          critBonusPct: 8,
          elementCode: 'AIR'
        }
      ]
    },
    lootTemplateId: 40, // item_essencia_angelical_m0xhm
    biomes: [40, 31, 36] // CELESTIAL_PALACE, FLOATING_ISLANDS, ACADEMY_GROUNDS
  },

  // 9. RANK D: Emissário da Luz Sagrada (creature_001106, 137x125px) - CELESTIAL
  {
    id: 66,
    code: 'monster_66',
    mcreworkMonsterKey: 'creature_001106',
    namePtBr: 'Emissário da Luz Sagrada',
    descriptionPtBr: 'Arauto divino com asas aurorais que desce dos templos superiores para advertir intrusos.',
    raceCode: 'CELESTIAL',
    fixedElementCode: 'AIR',
    rarityTier: 'D',
    combatStyle: 'RANGED',
    attackRange: 195,
    damageType: 'MAGICAL',
    groundOffsetY: -3,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    baseAttributes: { STR: 8, VIT: 15, AGI: 13, DEX: 13, INT: 16, WIS: 15 },
    baseCombatAttributes: {
      BATTLE_MOVE_SPEED: 135,
      ATTACK_SPEED: 1.00,
      CRIT_RATE: 9,
      CRIT_DMG: 150,
      PHYS_ACCURACY: 96,
      MAG_ACCURACY: 102,
      PHYS_EVASION: 10,
      MAG_EVASION: 12
    },
    skill: {
      id: 104,
      code: 'skill_mob_radiant_flash',
      namePtBr: 'Clarão da Alvorada Sagrada',
      descriptionPtBr: 'Emana um feixe concentrado de luz solar que perfura defesas mágicas.',
      mcreworkIconKey: '10006',
      castActionId: 7,
      mcreworkVfxKey: '10015',
      mpCost: 15,
      cooldownSeconds: 6,
      castRange: 205,
      aoeRadius: 0,
      targetScope: 'SINGLE_TARGET',
      effectBlocks: [
        {
          blockType: 'DAMAGE',
          damageType: 'MAGICAL',
          scaleStat: 'MAG_ATK',
          scalePct: 170,
          flatAmount: 30,
          critBonusPct: 10,
          elementCode: 'AIR'
        }
      ]
    },
    lootTemplateId: 40, // item_essencia_angelical_m0xhm
    biomes: [40, 38, 31] // CELESTIAL_PALACE, ASTRAL_SANCTUARY, FLOATING_ISLANDS
  },

  // 10. RANK D: Espírito Seráfico Alvo (creature_200005, 107x170px) - CELESTIAL
  {
    id: 67,
    code: 'monster_67',
    mcreworkMonsterKey: 'creature_200005',
    namePtBr: 'Espírito Seráfico Alvo',
    descriptionPtBr: 'Entidade etérea vestida de branco imaculado que vigia os santuários astrais nas montanhas.',
    raceCode: 'CELESTIAL',
    fixedElementCode: 'NEUTRAL',
    rarityTier: 'D',
    combatStyle: 'RANGED',
    attackRange: 190,
    damageType: 'MAGICAL',
    groundOffsetY: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    baseAttributes: { STR: 7, VIT: 16, AGI: 12, DEX: 13, INT: 16, WIS: 16 },
    baseCombatAttributes: {
      BATTLE_MOVE_SPEED: 130,
      ATTACK_SPEED: 0.95,
      CRIT_RATE: 8,
      CRIT_DMG: 150,
      PHYS_ACCURACY: 96,
      MAG_ACCURACY: 102,
      PHYS_EVASION: 8,
      MAG_EVASION: 12
    },
    skill: {
      id: 105,
      code: 'skill_mob_seraphic_orb',
      namePtBr: 'Orbe da Paz Celestial',
      descriptionPtBr: 'Arremessa uma esfera de condensação espiritual sagrada sobre o inimigo.',
      mcreworkIconKey: '10007',
      castActionId: 7,
      mcreworkVfxKey: '10015',
      mpCost: 14,
      cooldownSeconds: 6,
      castRange: 200,
      aoeRadius: 0,
      targetScope: 'SINGLE_TARGET',
      effectBlocks: [
        {
          blockType: 'DAMAGE',
          damageType: 'MAGICAL',
          scaleStat: 'MAG_ATK',
          scalePct: 165,
          flatAmount: 28,
          critBonusPct: 8,
          elementCode: 'NEUTRAL'
        }
      ]
    },
    lootTemplateId: 40, // item_essencia_angelical_m0xhm
    biomes: [38, 40, 13] // ASTRAL_SANCTUARY, CELESTIAL_PALACE, ALPINE_HIGHLANDS
  }
];

export function updateSnapshotWithBatchFive() {
  if (!fs.existsSync(snapshotPath)) return;
  const snap = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));

  for (const m of BATCH_FIVE_MONSTERS) {
    // 1. Skill
    const sk = m.skill;
    const skNameKey = `skill.${sk.code}.name`;
    const skDescKey = `skill.${sk.code}.description`;

    const skillTrans = [
      { key: skNameKey, locale: 'pt-BR', text: sk.namePtBr },
      { key: skNameKey, locale: 'en-US', text: sk.namePtBr },
      { key: skDescKey, locale: 'pt-BR', text: sk.descriptionPtBr },
      { key: skDescKey, locale: 'en-US', text: sk.descriptionPtBr },
    ];
    for (const t of skillTrans) {
      const idx = snap.i18nTranslations.findIndex((x: any) => x.key === t.key && x.locale === t.locale);
      if (idx >= 0) snap.i18nTranslations[idx] = t;
      else snap.i18nTranslations.push(t);
    }

    const skillObj = {
      id: sk.id,
      code: sk.code,
      nameI18nKey: skNameKey,
      descriptionI18nKey: skDescKey,
      mcreworkIconKey: sk.mcreworkIconKey,
      castActionId: sk.castActionId,
      castMovement: 'STATIONARY_CAST',
      mcreworkVfxKey: sk.mcreworkVfxKey,
      mpCost: sk.mpCost,
      cooldownSeconds: sk.cooldownSeconds,
      castRange: sk.castRange,
      aoeRadius: sk.aoeRadius,
      targetScope: sk.targetScope,
      effectBlocksJson: sk.effectBlocks,
      isActive: true,
    };
    const skIdx = snap.skillTemplates.findIndex((x: any) => x.id === sk.id);
    if (skIdx >= 0) snap.skillTemplates[skIdx] = skillObj;
    else snap.skillTemplates.push(skillObj);

    // 2. Monster
    const mNameKey = `monster.${m.code}.name`;
    const mDescKey = `monster.${m.code}.description`;

    const mobTrans = [
      { key: mNameKey, locale: 'pt-BR', text: m.namePtBr },
      { key: mNameKey, locale: 'en-US', text: m.namePtBr },
      { key: mDescKey, locale: 'pt-BR', text: m.descriptionPtBr },
      { key: mDescKey, locale: 'en-US', text: m.descriptionPtBr },
    ];
    for (const t of mobTrans) {
      const idx = snap.i18nTranslations.findIndex((x: any) => x.key === t.key && x.locale === t.locale);
      if (idx >= 0) snap.i18nTranslations[idx] = t;
      else snap.i18nTranslations.push(t);
    }

    const mobObj = {
      id: m.id,
      code: m.code,
      mcreworkMonsterKey: m.mcreworkMonsterKey,
      nameI18nKey: mNameKey,
      descriptionI18nKey: mDescKey,
      groundOffsetY: m.groundOffsetY,
      shadowOffsetX: m.shadowOffsetX,
      shadowOffsetY: m.shadowOffsetY,
      raceCode: m.raceCode,
      fixedElementCode: m.fixedElementCode,
      rarityTier: m.rarityTier,
      combatStyle: m.combatStyle,
      attackRange: m.attackRange,
      damageType: m.damageType,
      isTamableAsPet: true,
      baseAttributesJson: m.baseAttributes,
      baseCombatAttributesJson: m.baseCombatAttributes,
      skillIdsJson: [sk.id],
      lootTableJson: [
        {
          itemTemplateId: m.lootTemplateId,
          minQty: 1,
          maxQty: 1,
          chancePct: 80,
        },
      ],
      isActive: true,
    };

    const mobIdx = snap.monsterTemplates.findIndex((x: any) => x.id === m.id);
    if (mobIdx >= 0) snap.monsterTemplates[mobIdx] = mobObj;
    else snap.monsterTemplates.push(mobObj);

    // 3. Biomes
    for (const bId of m.biomes) {
      const exists = snap.monsterBiomes.some(
        (mb: any) => mb.monsterTemplateId === m.id && mb.biomeId === bId
      );
      if (!exists) {
        snap.monsterBiomes.push({ monsterTemplateId: m.id, biomeId: bId });
      }
    }
  }

  snap.exportedAt = new Date().toISOString();
  fs.writeFileSync(snapshotPath, JSON.stringify(snap, null, 2), 'utf8');
  console.log('✅ [Snapshot] lowcode.snapshot.json atualizado com o quinto lote de 10 monstros (#58-#67)!');
}

export async function runBatchFiveMonsterSeed() {
  updateSnapshotWithBatchFive();

  if (!process.env.DATABASE_URL) {
    console.log('ℹ️ DATABASE_URL ausente localmente. Apenas snapshot atualizado.');
    return;
  }

  const prisma = new PrismaClient();
  const rawBaseUrl = 'https://raw.githubusercontent.com/SeytaniR/mcrework/main/web';
  const cacheBaseDir = path.resolve(__dirname, '../../../apps/server/cache/mcrework');

  try {
    console.log('🌱 Inserindo quinto lote de 10 monstros, habilidades e biomas no banco de dados...');

    for (const m of BATCH_FIVE_MONSTERS) {
      // Espelhar assets do monstro
      const monsterDir = path.join(cacheBaseDir, 'assets', 'monsters', m.mcreworkMonsterKey);
      fs.mkdirSync(monsterDir, { recursive: true });

      const files = ['thumb.webp', 'atlas.json', 'atlas.webp'];
      for (const fn of files) {
        const dest = path.join(monsterDir, fn);
        if (!fs.existsSync(dest)) {
          const u = `${rawBaseUrl}/assets/monsters/${m.mcreworkMonsterKey}/${fn}`;
          try {
            const r = await fetch(u);
            if (r.ok) {
              const buf = Buffer.from(await r.arrayBuffer());
              fs.writeFileSync(dest, buf);
            }
          } catch (err: any) {
            console.warn(`[WARN] Falha ao baixar ${fn} para ${m.mcreworkMonsterKey}:`, err.message);
          }
        }
      }

      // 1. Skill
      const sk = m.skill;
      const skNameKey = `skill.${sk.code}.name`;
      const skDescKey = `skill.${sk.code}.description`;

      await prisma.i18nTranslation.upsert({
        where: { key_locale: { key: skNameKey, locale: 'pt-BR' } },
        create: { key: skNameKey, locale: 'pt-BR', text: sk.namePtBr },
        update: { text: sk.namePtBr },
      });
      await prisma.i18nTranslation.upsert({
        where: { key_locale: { key: skNameKey, locale: 'en-US' } },
        create: { key: skNameKey, locale: 'en-US', text: sk.namePtBr },
        update: { text: sk.namePtBr },
      });
      await prisma.i18nTranslation.upsert({
        where: { key_locale: { key: skDescKey, locale: 'pt-BR' } },
        create: { key: skDescKey, locale: 'pt-BR', text: sk.descriptionPtBr },
        update: { text: sk.descriptionPtBr },
      });
      await prisma.i18nTranslation.upsert({
        where: { key_locale: { key: skDescKey, locale: 'en-US' } },
        create: { key: skDescKey, locale: 'en-US', text: sk.descriptionPtBr },
        update: { text: sk.descriptionPtBr },
      });

      await prisma.skillTemplate.upsert({
        where: { id: sk.id },
        create: {
          id: sk.id,
          code: sk.code,
          nameI18nKey: skNameKey,
          descriptionI18nKey: skDescKey,
          mcreworkIconKey: sk.mcreworkIconKey,
          castActionId: sk.castActionId,
          castMovement: 'STATIONARY_CAST',
          mcreworkVfxKey: sk.mcreworkVfxKey,
          mpCost: sk.mpCost,
          cooldownSeconds: sk.cooldownSeconds,
          castRange: sk.castRange,
          aoeRadius: sk.aoeRadius,
          targetScope: sk.targetScope,
          effectBlocksJson: sk.effectBlocks,
          isActive: true,
        },
        update: {
          code: sk.code,
          nameI18nKey: skNameKey,
          descriptionI18nKey: skDescKey,
          mcreworkIconKey: sk.mcreworkIconKey,
          castActionId: sk.castActionId,
          castMovement: 'STATIONARY_CAST',
          mcreworkVfxKey: sk.mcreworkVfxKey,
          mpCost: sk.mpCost,
          cooldownSeconds: sk.cooldownSeconds,
          castRange: sk.castRange,
          aoeRadius: sk.aoeRadius,
          targetScope: sk.targetScope,
          effectBlocksJson: sk.effectBlocks,
          isActive: true,
        },
      });

      // 2. Monster
      const mNameKey = `monster.${m.code}.name`;
      const mDescKey = `monster.${m.code}.description`;

      await prisma.i18nTranslation.upsert({
        where: { key_locale: { key: mNameKey, locale: 'pt-BR' } },
        create: { key: mNameKey, locale: 'pt-BR', text: m.namePtBr },
        update: { text: m.namePtBr },
      });
      await prisma.i18nTranslation.upsert({
        where: { key_locale: { key: mNameKey, locale: 'en-US' } },
        create: { key: mNameKey, locale: 'en-US', text: m.namePtBr },
        update: { text: m.namePtBr },
      });
      await prisma.i18nTranslation.upsert({
        where: { key_locale: { key: mDescKey, locale: 'pt-BR' } },
        create: { key: mDescKey, locale: 'pt-BR', text: m.descriptionPtBr },
        update: { text: m.descriptionPtBr },
      });
      await prisma.i18nTranslation.upsert({
        where: { key_locale: { key: mDescKey, locale: 'en-US' } },
        create: { key: mDescKey, locale: 'en-US', text: m.descriptionPtBr },
        update: { text: m.descriptionPtBr },
      });

      await prisma.monsterTemplate.upsert({
        where: { id: m.id },
        create: {
          id: m.id,
          code: m.code,
          mcreworkMonsterKey: m.mcreworkMonsterKey,
          nameI18nKey: mNameKey,
          descriptionI18nKey: mDescKey,
          groundOffsetY: m.groundOffsetY,
          shadowOffsetX: m.shadowOffsetX,
          shadowOffsetY: m.shadowOffsetY,
          raceCode: m.raceCode,
          fixedElementCode: m.fixedElementCode,
          rarityTier: m.rarityTier,
          combatStyle: m.combatStyle,
          attackRange: m.attackRange,
          damageType: m.damageType,
          isTamableAsPet: true,
          baseAttributesJson: m.baseAttributes,
          baseCombatAttributesJson: m.baseCombatAttributes,
          skillIdsJson: [sk.id],
          lootTableJson: [
            {
              itemTemplateId: m.lootTemplateId,
              minQty: 1,
              maxQty: 1,
              chancePct: 80,
            },
          ],
          isActive: true,
        },
        update: {
          code: m.code,
          mcreworkMonsterKey: m.mcreworkMonsterKey,
          nameI18nKey: mNameKey,
          descriptionI18nKey: mDescKey,
          groundOffsetY: m.groundOffsetY,
          shadowOffsetX: m.shadowOffsetX,
          shadowOffsetY: m.shadowOffsetY,
          raceCode: m.raceCode,
          fixedElementCode: m.fixedElementCode,
          rarityTier: m.rarityTier,
          combatStyle: m.combatStyle,
          attackRange: m.attackRange,
          damageType: m.damageType,
          isTamableAsPet: true,
          baseAttributesJson: m.baseAttributes,
          baseCombatAttributesJson: m.baseCombatAttributes,
          skillIdsJson: [sk.id],
          lootTableJson: [
            {
              itemTemplateId: m.lootTemplateId,
              minQty: 1,
              maxQty: 1,
              chancePct: 80,
            },
          ],
          isActive: true,
        },
      });

      // 3. Biomes
      for (const bId of m.biomes) {
        await prisma.monsterBiome.upsert({
          where: {
            monsterTemplateId_biomeId: {
              monsterTemplateId: m.id,
              biomeId: bId,
            },
          },
          create: {
            monsterTemplateId: m.id,
            biomeId: bId,
          },
          update: {},
        });
      }
    }

    console.log('✅ Quinto lote de 10 monstros, habilidades e biomas inseridos com sucesso!');
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runBatchFiveMonsterSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
