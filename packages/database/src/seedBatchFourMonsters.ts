/**
 * @file packages/database/src/seedBatchFourMonsters.ts
 * @description Semeador do quarto lote de 10 monstros procedurais (#48 a #57) com habilidades dedicadas,
 * biomas de spawn e drops de essência (80% de chance, 1 unidade) condizentes com a raça.
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

export const BATCH_FOUR_MONSTERS: MonsterSeedItem[] = [
  // 1. RANK SS: Minotauro Dourado Colossal (creature_100001, 261x238px) - BEAST
  {
    id: 48,
    code: 'monster_48',
    mcreworkMonsterKey: 'creature_100001',
    namePtBr: 'Minotauro Dourado Colossal',
    descriptionPtBr: 'Colosso bestial de armadura áurea e chifres massivos que rege os vales flamejantes com força titânica.',
    raceCode: 'BEAST',
    fixedElementCode: 'FIRE',
    rarityTier: 'SS',
    combatStyle: 'MELEE',
    attackRange: 85,
    damageType: 'PHYSICAL',
    groundOffsetY: -2,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    baseAttributes: { STR: 36, VIT: 40, AGI: 22, DEX: 24, INT: 14, WIS: 18 },
    baseCombatAttributes: {
      BATTLE_MOVE_SPEED: 145,
      ATTACK_SPEED: 1.15,
      CRIT_RATE: 18,
      CRIT_DMG: 185,
      PHYS_ACCURACY: 110,
      MAG_ACCURACY: 95,
      PHYS_EVASION: 24,
      MAG_EVASION: 20
    },
    skill: {
      id: 86,
      code: 'skill_mob_golden_rampage',
      namePtBr: 'Investida Dourada Destruidora',
      descriptionPtBr: 'O Minotauro Colossal investe com fúria titânica, esmagando o solo e causando dano físico massivo em cone.',
      mcreworkIconKey: '10001',
      castActionId: 5,
      mcreworkVfxKey: '10008',
      mpCost: 40,
      cooldownSeconds: 10,
      castRange: 110,
      aoeRadius: 160,
      targetScope: 'AOE_TARGET',
      effectBlocks: [
        {
          blockType: 'DAMAGE',
          damageType: 'PHYSICAL',
          scaleStat: 'PHYS_ATK',
          scalePct: 260,
          flatAmount: 120,
          critBonusPct: 15,
          elementCode: 'FIRE'
        }
      ]
    },
    lootTemplateId: 35, // item_essencia_de_selvagem_ghj3x
    biomes: [29, 12, 9] // LAVA_CALDERA, ROCKY_CANYON, DRY_STEPPES
  },

  // 2. RANK S: Wyvern Alado das Alturas (creature_200007, 186x147px) - DRAGON
  {
    id: 49,
    code: 'monster_49',
    mcreworkMonsterKey: 'creature_200007',
    namePtBr: 'Wyvern Alado das Alturas',
    descriptionPtBr: 'Dragão alado serpentino que domina as correntes de vento dos picos celestes com agilidade sobre-humana.',
    raceCode: 'DRAGON',
    fixedElementCode: 'AIR',
    rarityTier: 'S',
    combatStyle: 'RANGED',
    attackRange: 220,
    damageType: 'MAGICAL',
    groundOffsetY: -4,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    baseAttributes: { STR: 26, VIT: 28, AGI: 32, DEX: 28, INT: 30, WIS: 24 },
    baseCombatAttributes: {
      BATTLE_MOVE_SPEED: 165,
      ATTACK_SPEED: 1.25,
      CRIT_RATE: 16,
      CRIT_DMG: 175,
      PHYS_ACCURACY: 105,
      MAG_ACCURACY: 115,
      PHYS_EVASION: 28,
      MAG_EVASION: 28
    },
    skill: {
      id: 87,
      code: 'skill_mob_wyvern_tempest_blast',
      namePtBr: 'Sopro das Tempestades Celestes',
      descriptionPtBr: 'Dispara uma rajada de vento cortante de alta velocidade que perfura defesas mágicas.',
      mcreworkIconKey: '10006',
      castActionId: 7,
      mcreworkVfxKey: '10012',
      mpCost: 35,
      cooldownSeconds: 8,
      castRange: 240,
      aoeRadius: 120,
      targetScope: 'AOE_TARGET',
      effectBlocks: [
        {
          blockType: 'DAMAGE',
          damageType: 'MAGICAL',
          scaleStat: 'MAG_ATK',
          scalePct: 230,
          flatAmount: 80,
          critBonusPct: 14,
          elementCode: 'AIR'
        }
      ]
    },
    lootTemplateId: 42, // item_essencia_draconica_gjrko
    biomes: [30, 31, 13] // STORM_PLATEAU, FLOATING_ISLANDS, ALPINE_HIGHLANDS
  },

  // 3. RANK S: Rei Cogumelo Tóxico Ancestral (creature_200009, 234x202px) - PLANT
  {
    id: 50,
    code: 'monster_50',
    mcreworkMonsterKey: 'creature_200009',
    namePtBr: 'Rei Cogumelo Tóxico Ancestral',
    descriptionPtBr: 'Monarca fúngico milenar que excreta esporos mortais capazes de derreter escudos e armaduras.',
    raceCode: 'PLANT',
    fixedElementCode: 'EARTH',
    rarityTier: 'S',
    combatStyle: 'MELEE',
    attackRange: 90,
    damageType: 'PHYSICAL',
    groundOffsetY: -2,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    baseAttributes: { STR: 28, VIT: 38, AGI: 14, DEX: 18, INT: 28, WIS: 30 },
    baseCombatAttributes: {
      BATTLE_MOVE_SPEED: 125,
      ATTACK_SPEED: 0.95,
      CRIT_RATE: 14,
      CRIT_DMG: 165,
      PHYS_ACCURACY: 102,
      MAG_ACCURACY: 110,
      PHYS_EVASION: 18,
      MAG_EVASION: 22
    },
    skill: {
      id: 88,
      code: 'skill_mob_spore_cataclysm',
      namePtBr: 'Cataclismo de Esporos Venenosos',
      descriptionPtBr: 'Libera uma nuvem densa de toxinas fúngicas em área, corroendo a vitalidade dos alvos próximos.',
      mcreworkIconKey: '10003',
      castActionId: 6,
      mcreworkVfxKey: '10014',
      mpCost: 32,
      cooldownSeconds: 9,
      castRange: 100,
      aoeRadius: 180,
      targetScope: 'AOE_TARGET',
      effectBlocks: [
        {
          blockType: 'DAMAGE',
          damageType: 'MAGICAL',
          scaleStat: 'MAG_ATK',
          scalePct: 210,
          flatAmount: 95,
          critBonusPct: 12,
          elementCode: 'EARTH'
        }
      ]
    },
    lootTemplateId: 37, // item_essencia_de_planta_i8e6j
    biomes: [20, 8, 4] // POISON_MANGROVE, GIANT_ROOTS, TROPICAL_JUNGLE
  },

  // 4. RANK A: Lorde Jiangshi das Criptas Reais (creature_200004, 126x173px) - DEMON
  {
    id: 51,
    code: 'monster_51',
    mcreworkMonsterKey: 'creature_200004',
    namePtBr: 'Lorde Jiangshi das Criptas Reais',
    descriptionPtBr: 'Antigo imperador embalsamado reanimado por artes proibidas, com unhas afiadas como navalhas e saltos fantasmagóricos.',
    raceCode: 'DEMON',
    fixedElementCode: 'NEUTRAL',
    rarityTier: 'A',
    combatStyle: 'MELEE',
    attackRange: 80,
    damageType: 'PHYSICAL',
    groundOffsetY: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    baseAttributes: { STR: 28, VIT: 30, AGI: 24, DEX: 22, INT: 20, WIS: 18 },
    baseCombatAttributes: {
      BATTLE_MOVE_SPEED: 140,
      ATTACK_SPEED: 1.10,
      CRIT_RATE: 15,
      CRIT_DMG: 160,
      PHYS_ACCURACY: 104,
      MAG_ACCURACY: 100,
      PHYS_EVASION: 20,
      MAG_EVASION: 20
    },
    skill: {
      id: 89,
      code: 'skill_mob_vampiric_talon',
      namePtBr: 'Garras Malditas de Sangue',
      descriptionPtBr: 'Desfere um golpe cortante com unhas necróticas drenando a energia vital da presa.',
      mcreworkIconKey: '10008',
      castActionId: 5,
      mcreworkVfxKey: '10011',
      mpCost: 26,
      cooldownSeconds: 7,
      castRange: 90,
      aoeRadius: 0,
      targetScope: 'SINGLE_TARGET',
      effectBlocks: [
        {
          blockType: 'DAMAGE',
          damageType: 'PHYSICAL',
          scaleStat: 'PHYS_ATK',
          scalePct: 200,
          flatAmount: 60,
          critBonusPct: 14,
          elementCode: 'NEUTRAL'
        }
      ]
    },
    lootTemplateId: 36, // item_essencia_demoniaca_oaod7
    biomes: [33, 34, 37] // ANCIENT_NECROPOLIS, BLIGHTED_LANDS, ANCIENT_RUINS
  },

  // 5. RANK A: Urso Pardo das Estepes Selvagens (creature_000025, 167x180px) - BEAST
  {
    id: 52,
    code: 'monster_52',
    mcreworkMonsterKey: 'creature_000025',
    namePtBr: 'Urso Pardo das Estepes Selvagens',
    descriptionPtBr: 'Predador maciço das planícies com musculatura densa e garras brutais que despedaçam presas em segundos.',
    raceCode: 'BEAST',
    fixedElementCode: 'EARTH',
    rarityTier: 'A',
    combatStyle: 'MELEE',
    attackRange: 85,
    damageType: 'PHYSICAL',
    groundOffsetY: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    baseAttributes: { STR: 30, VIT: 32, AGI: 18, DEX: 20, INT: 12, WIS: 16 },
    baseCombatAttributes: {
      BATTLE_MOVE_SPEED: 135,
      ATTACK_SPEED: 1.05,
      CRIT_RATE: 14,
      CRIT_DMG: 165,
      PHYS_ACCURACY: 102,
      MAG_ACCURACY: 92,
      PHYS_EVASION: 18,
      MAG_EVASION: 16
    },
    skill: {
      id: 90,
      code: 'skill_mob_grizzly_crush',
      namePtBr: 'Patada Esmagadora do Urso',
      descriptionPtBr: 'Despenca uma pata colossal sobre a vítima, abalando a terra ao redor com força bruta.',
      mcreworkIconKey: '10002',
      castActionId: 5,
      mcreworkVfxKey: '10008',
      mpCost: 28,
      cooldownSeconds: 8,
      castRange: 95,
      aoeRadius: 130,
      targetScope: 'AOE_TARGET',
      effectBlocks: [
        {
          blockType: 'DAMAGE',
          damageType: 'PHYSICAL',
          scaleStat: 'PHYS_ATK',
          scalePct: 210,
          flatAmount: 70,
          critBonusPct: 12,
          elementCode: 'EARTH'
        }
      ]
    },
    lootTemplateId: 35, // item_essencia_de_selvagem_ghj3x
    biomes: [9, 13, 1] // DRY_STEPPES, ALPINE_HIGHLANDS, VERDANT_PLAINS
  },

  // 6. RANK B: Dragão Encouraçado dos Lagos Profundos (creature_000048, 282x162px) - REPTILIAN
  {
    id: 53,
    code: 'monster_53',
    mcreworkMonsterKey: 'creature_000048',
    namePtBr: 'Dragão Encouraçado dos Lagos Profundos',
    descriptionPtBr: 'Besta anfíbia encouraçada com placas quelônias intransponíveis que habita as águas calmas de grandes lagos.',
    raceCode: 'REPTILIAN',
    fixedElementCode: 'WATER',
    rarityTier: 'B',
    combatStyle: 'MELEE',
    attackRange: 95,
    damageType: 'PHYSICAL',
    groundOffsetY: -2,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    baseAttributes: { STR: 24, VIT: 28, AGI: 15, DEX: 18, INT: 16, WIS: 20 },
    baseCombatAttributes: {
      BATTLE_MOVE_SPEED: 130,
      ATTACK_SPEED: 0.95,
      CRIT_RATE: 12,
      CRIT_DMG: 155,
      PHYS_ACCURACY: 98,
      MAG_ACCURACY: 98,
      PHYS_EVASION: 16,
      MAG_EVASION: 18
    },
    skill: {
      id: 91,
      code: 'skill_mob_submerged_slam',
      namePtBr: 'Golpe da Carapaça Submersa',
      descriptionPtBr: 'Gira a carapaça pesada impulsionada por jatos de água lodosa atingindo múltiplos inimigos.',
      mcreworkIconKey: '10005',
      castActionId: 5,
      mcreworkVfxKey: '10013',
      mpCost: 24,
      cooldownSeconds: 7,
      castRange: 100,
      aoeRadius: 140,
      targetScope: 'AOE_TARGET',
      effectBlocks: [
        {
          blockType: 'DAMAGE',
          damageType: 'PHYSICAL',
          scaleStat: 'PHYS_ATK',
          scalePct: 185,
          flatAmount: 50,
          critBonusPct: 10,
          elementCode: 'WATER'
        }
      ]
    },
    lootTemplateId: 43, // item_essencia_reptiliana_wv5uc
    biomes: [21, 19, 18] // MIRROR_LAKE, MISTY_SWAMP, SEA_CLIFFS
  },

  // 7. RANK B: Guardião Feérico da Coroa Dourada (creature_200008, 127x136px) - FAIRY
  {
    id: 54,
    code: 'monster_54',
    mcreworkMonsterKey: 'creature_200008',
    namePtBr: 'Guardião Feérico da Coroa Dourada',
    descriptionPtBr: 'Espírito élfico da alta realeza feérica que resguarda os santuários ancestrais e bosques sagrados.',
    raceCode: 'FAIRY',
    fixedElementCode: 'AIR',
    rarityTier: 'B',
    combatStyle: 'RANGED',
    attackRange: 210,
    damageType: 'MAGICAL',
    groundOffsetY: -2,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    baseAttributes: { STR: 14, VIT: 20, AGI: 26, DEX: 24, INT: 26, WIS: 22 },
    baseCombatAttributes: {
      BATTLE_MOVE_SPEED: 155,
      ATTACK_SPEED: 1.15,
      CRIT_RATE: 15,
      CRIT_DMG: 160,
      PHYS_ACCURACY: 96,
      MAG_ACCURACY: 108,
      PHYS_EVASION: 22,
      MAG_EVASION: 24
    },
    skill: {
      id: 92,
      code: 'skill_mob_fairy_radiance',
      namePtBr: 'Resplendor Feérico Solar',
      descriptionPtBr: 'Invoca feixes cintilantes de poeira feérica que cegam e queimam magicamente o alvo.',
      mcreworkIconKey: '10006',
      castActionId: 7,
      mcreworkVfxKey: '10015',
      mpCost: 22,
      cooldownSeconds: 6,
      castRange: 220,
      aoeRadius: 0,
      targetScope: 'SINGLE_TARGET',
      effectBlocks: [
        {
          blockType: 'DAMAGE',
          damageType: 'MAGICAL',
          scaleStat: 'MAG_ATK',
          scalePct: 190,
          flatAmount: 45,
          critBonusPct: 12,
          elementCode: 'AIR'
        }
      ]
    },
    lootTemplateId: 39, // item_essencia_elfica_gfegf
    biomes: [6, 3, 38] // FAIRY_GARDEN, DENSE_FOREST, ASTRAL_SANCTUARY
  },

  // 8. RANK C: Nautilus Mecânico Submerso (creature_000010, 96x90px) - ROBOTIC
  {
    id: 55,
    code: 'monster_55',
    mcreworkMonsterKey: 'creature_000010',
    namePtBr: 'Nautilus Mecânico Submerso',
    descriptionPtBr: 'Polvo de latão e engrenagens movido a vapor criado para patrulhar docas e forjas submersas.',
    raceCode: 'ROBOTIC',
    fixedElementCode: 'WATER',
    rarityTier: 'C',
    combatStyle: 'RANGED',
    attackRange: 190,
    damageType: 'MAGICAL',
    groundOffsetY: -3,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    baseAttributes: { STR: 16, VIT: 22, AGI: 20, DEX: 22, INT: 24, WIS: 18 },
    baseCombatAttributes: {
      BATTLE_MOVE_SPEED: 145,
      ATTACK_SPEED: 1.10,
      CRIT_RATE: 12,
      CRIT_DMG: 150,
      PHYS_ACCURACY: 95,
      MAG_ACCURACY: 104,
      PHYS_EVASION: 18,
      MAG_EVASION: 18
    },
    skill: {
      id: 93,
      code: 'skill_mob_hydro_pulse',
      namePtBr: 'Pulso Hidro-Propulsor',
      descriptionPtBr: 'Dispara uma rajada pressurizada de vapor aquático através de pistões mecânicos.',
      mcreworkIconKey: '10004',
      castActionId: 7,
      mcreworkVfxKey: '10013',
      mpCost: 18,
      cooldownSeconds: 6,
      castRange: 200,
      aoeRadius: 0,
      targetScope: 'SINGLE_TARGET',
      effectBlocks: [
        {
          blockType: 'DAMAGE',
          damageType: 'MAGICAL',
          scaleStat: 'MAG_ATK',
          scalePct: 175,
          flatAmount: 35,
          critBonusPct: 10,
          elementCode: 'WATER'
        }
      ]
    },
    lootTemplateId: 38, // item_essencia_robotica_ukpuv
    biomes: [39, 22, 17] // CLOCKWORK_FORGE, CORAL_REEF, TROPICAL_COAST
  },

  // 9. RANK C: Querubim Celestial das Nuvens (creature_100003, 103x98px) - CELESTIAL
  {
    id: 56,
    code: 'monster_56',
    mcreworkMonsterKey: 'creature_100003',
    namePtBr: 'Querubim Celestial das Nuvens',
    descriptionPtBr: 'Pequena entidade sacra alada que flutua entre os templos celestes entoando hinos de admoestação.',
    raceCode: 'CELESTIAL',
    fixedElementCode: 'AIR',
    rarityTier: 'C',
    combatStyle: 'RANGED',
    attackRange: 200,
    damageType: 'MAGICAL',
    groundOffsetY: -4,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    baseAttributes: { STR: 12, VIT: 18, AGI: 22, DEX: 20, INT: 24, WIS: 22 },
    baseCombatAttributes: {
      BATTLE_MOVE_SPEED: 150,
      ATTACK_SPEED: 1.10,
      CRIT_RATE: 13,
      CRIT_DMG: 150,
      PHYS_ACCURACY: 94,
      MAG_ACCURACY: 105,
      PHYS_EVASION: 20,
      MAG_EVASION: 22
    },
    skill: {
      id: 94,
      code: 'skill_mob_sacred_glare',
      namePtBr: 'Clarão Sagrado dos Querubins',
      descriptionPtBr: 'Emite uma centelha de luz sagrada que atinge o alvo com dano mágico concentrado.',
      mcreworkIconKey: '10006',
      castActionId: 7,
      mcreworkVfxKey: '10015',
      mpCost: 18,
      cooldownSeconds: 6,
      castRange: 210,
      aoeRadius: 0,
      targetScope: 'SINGLE_TARGET',
      effectBlocks: [
        {
          blockType: 'DAMAGE',
          damageType: 'MAGICAL',
          scaleStat: 'MAG_ATK',
          scalePct: 170,
          flatAmount: 30,
          critBonusPct: 12,
          elementCode: 'AIR'
        }
      ]
    },
    lootTemplateId: 40, // item_essencia_angelical_m0xhm
    biomes: [40, 31, 38] // CELESTIAL_PALACE, FLOATING_ISLANDS, ASTRAL_SANCTUARY
  },

  // 10. RANK D: Donzela Espiritual da Nevasca (creature_000042, 142x142px) - SPIRIT
  {
    id: 57,
    code: 'monster_57',
    mcreworkMonsterKey: 'creature_000042',
    namePtBr: 'Donzela Espiritual da Nevasca',
    descriptionPtBr: 'Aparição fantasmagórica gélida que surge durante as nevascas solitárias sussurrando canções melancólicas.',
    raceCode: 'SPIRIT',
    fixedElementCode: 'WATER',
    rarityTier: 'D',
    combatStyle: 'RANGED',
    attackRange: 190,
    damageType: 'MAGICAL',
    groundOffsetY: -4,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    baseAttributes: { STR: 10, VIT: 16, AGI: 18, DEX: 18, INT: 20, WIS: 18 },
    baseCombatAttributes: {
      BATTLE_MOVE_SPEED: 140,
      ATTACK_SPEED: 1.05,
      CRIT_RATE: 10,
      CRIT_DMG: 145,
      PHYS_ACCURACY: 92,
      MAG_ACCURACY: 100,
      PHYS_EVASION: 16,
      MAG_EVASION: 18
    },
    skill: {
      id: 95,
      code: 'skill_mob_glacial_touch',
      namePtBr: 'Toque Espiritual Glacial',
      descriptionPtBr: 'Envolve o alvo com geada ectoplásmica que congela o ar ao redor.',
      mcreworkIconKey: '10005',
      castActionId: 7,
      mcreworkVfxKey: '10012',
      mpCost: 15,
      cooldownSeconds: 5,
      castRange: 200,
      aoeRadius: 0,
      targetScope: 'SINGLE_TARGET',
      effectBlocks: [
        {
          blockType: 'DAMAGE',
          damageType: 'MAGICAL',
          scaleStat: 'MAG_ATK',
          scalePct: 160,
          flatAmount: 25,
          critBonusPct: 10,
          elementCode: 'WATER'
        }
      ]
    },
    lootTemplateId: 44, // item_essencia_espiritual_3bffa
    biomes: [24, 25, 27] // FROZEN_TUNDRA, SNOWY_TAIGA, BLIZZARD_PEAK
  }
];

export function updateSnapshotWithBatchFour() {
  if (!fs.existsSync(snapshotPath)) return;
  const snap = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));

  for (const m of BATCH_FOUR_MONSTERS) {
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
  console.log('✅ [Snapshot] lowcode.snapshot.json atualizado com o quarto lote de 10 monstros (#48-#57)!');
}

export async function runBatchFourMonsterSeed() {
  updateSnapshotWithBatchFour();

  if (!process.env.DATABASE_URL) {
    console.log('ℹ️ DATABASE_URL ausente localmente. Apenas snapshot atualizado.');
    return;
  }

  const prisma = new PrismaClient();
  const rawBaseUrl = 'https://raw.githubusercontent.com/SeytaniR/mcrework/main/web';
  const cacheBaseDir = path.resolve(__dirname, '../../../apps/server/cache/mcrework');

  try {
    console.log('🌱 Inserindo quarto lote de 10 monstros, habilidades e biomas no banco de dados...');

    for (const m of BATCH_FOUR_MONSTERS) {
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

    console.log('✅ Quarto lote de 10 monstros, habilidades e biomas inseridos com sucesso!');
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runBatchFourMonsterSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
