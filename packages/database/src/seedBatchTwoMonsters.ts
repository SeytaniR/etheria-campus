/**
 * @file packages/database/src/seedBatchTwoMonsters.ts
 * @description Semeador do segundo lote de 10 novos monstros procedurais (#28 a #37) com habilidades dedicadas,
 * biomas de spawn e drops de essência (80% de chance, 1 unidade) condizentes com a raça.
 * Todos os monstros deste lote são superiores em poder e atributos em relação ao primeiro lote.
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
    castMovement: string;
    mcreworkVfxKey: string;
    mpCost: number;
    cooldownSeconds: number;
    castRange: number;
    aoeRadius: number;
    targetScope: string;
    effectBlocks: Array<{
      blockType: string;
      damageType: string;
      scaleStat: string;
      scalePct: number;
      flatAmount: number;
      critBonusPct?: number;
      elementCode: string;
    }>;
  };
  biomes: number[];
  lootTemplateId: number;
}

export const batchTwoMonsters: MonsterSeedItem[] = [
  // -------------------------------------------------------------------------
  // 1. RANK SS: Dragão Titânico do Gelo Eterno (creature_200054, 287x229px)
  // -------------------------------------------------------------------------
  {
    id: 28,
    code: 'monster_28',
    mcreworkMonsterKey: 'creature_200054',
    namePtBr: 'Dragão Titânico do Gelo Eterno',
    descriptionPtBr: 'Um dragão primordial encouraçado por rochas glaciais impenetráveis. Suas asas congelam o próprio éter ao redor e seu sopro glacial soterra impérios inteiros.',
    raceCode: 'DRAGON',
    fixedElementCode: 'WATER',
    rarityTier: 'SS',
    combatStyle: 'MELEE',
    attackRange: 90,
    damageType: 'PHYSICAL',
    groundOffsetY: -6,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    baseAttributes: { STR: 36, VIT: 35, AGI: 14, DEX: 15, INT: 16, WIS: 14 },
    baseCombatAttributes: {
      BATTLE_MOVE_SPEED: 135,
      ATTACK_SPEED: 0.90,
      CRIT_RATE: 18,
      CRIT_DMG: 190,
      PHYS_ACCURACY: 110,
      MAG_ACCURACY: 105,
      PHYS_EVASION: 12,
      MAG_EVASION: 15,
    },
    skill: {
      id: 66,
      code: 'skill_mob_glacial_cataclysm',
      namePtBr: 'Cataclismo Glacial Titânico',
      descriptionPtBr: 'Libera uma explosão massiva de ar congelante e estilhaços de gelo eterno em área, infligindo dano devastador.',
      mcreworkIconKey: '10010',
      castActionId: 3,
      castMovement: 'MELEE_ADVANCE',
      mcreworkVfxKey: '10006',
      mpCost: 45,
      cooldownSeconds: 9.0,
      castRange: 100,
      aoeRadius: 90,
      targetScope: 'AOE_CIRCLE',
      effectBlocks: [
        {
          blockType: 'DAMAGE',
          damageType: 'MAGICAL',
          scaleStat: 'MAG_ATK',
          scalePct: 280,
          flatAmount: 50,
          critBonusPct: 18,
          elementCode: 'WATER',
        },
      ],
    },
    biomes: [26, 27, 24], // ETERNAL_GLACIER, BLIZZARD_PEAK, FROZEN_TUNDRA
    lootTemplateId: 42, // item_essencia_draconica_gjrko
  },

  // -------------------------------------------------------------------------
  // 2. RANK SS: Arquidemônio das Chamas Abissais (creature_200019, 220x208px)
  // -------------------------------------------------------------------------
  {
    id: 29,
    code: 'monster_29',
    mcreworkMonsterKey: 'creature_200019',
    namePtBr: 'Arquidemônio das Chamas Abissais',
    descriptionPtBr: 'Soberano infernal forjado no magma primordial. Empunha o fogo negro do abismo capaz de incinerar armaduras divinas e corromper a alma de seus adversários.',
    raceCode: 'DEMON',
    fixedElementCode: 'FIRE',
    rarityTier: 'SS',
    combatStyle: 'MELEE',
    attackRange: 85,
    damageType: 'PHYSICAL',
    groundOffsetY: -4,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    baseAttributes: { STR: 35, VIT: 32, AGI: 15, DEX: 16, INT: 20, WIS: 12 },
    baseCombatAttributes: {
      BATTLE_MOVE_SPEED: 145,
      ATTACK_SPEED: 1.05,
      CRIT_RATE: 20,
      CRIT_DMG: 200,
      PHYS_ACCURACY: 112,
      MAG_ACCURACY: 110,
      PHYS_EVASION: 14,
      MAG_EVASION: 12,
    },
    skill: {
      id: 67,
      code: 'skill_mob_infernal_eruption',
      namePtBr: 'Erupção do Inferno Abissal',
      descriptionPtBr: 'Invoca pilares de fogo vulcânico do solo abaixo dos alvos, queimando tudo em uma onda de calor extremo.',
      mcreworkIconKey: '10008',
      castActionId: 3,
      castMovement: 'MELEE_ADVANCE',
      mcreworkVfxKey: '10018',
      mpCost: 40,
      cooldownSeconds: 7.5,
      castRange: 95,
      aoeRadius: 85,
      targetScope: 'AOE_CIRCLE',
      effectBlocks: [
        {
          blockType: 'DAMAGE',
          damageType: 'PHYSICAL',
          scaleStat: 'PHYS_ATK',
          scalePct: 275,
          flatAmount: 45,
          critBonusPct: 20,
          elementCode: 'FIRE',
        },
      ],
    },
    biomes: [29, 35, 28], // LAVA_CALDERA, DEMONIC_RIFT, ASHLANDS
    lootTemplateId: 36, // item_essencia_demoniaca_oaod7
  },

  // -------------------------------------------------------------------------
  // 3. RANK S: Qilin do Relâmpago Celestial (creature_100060, 275x267px)
  // -------------------------------------------------------------------------
  {
    id: 30,
    code: 'monster_30',
    mcreworkMonsterKey: 'creature_100060',
    namePtBr: 'Qilin do Relâmpago Celestial',
    descriptionPtBr: 'Besta sagrada tempestuosa que corre sobre os céus elétricos. Seus cascos disparam raios bifurcados e sua juba emana estática pura da abóbada celeste.',
    raceCode: 'BEAST',
    fixedElementCode: 'AIR',
    rarityTier: 'S',
    combatStyle: 'MELEE',
    attackRange: 75,
    damageType: 'PHYSICAL',
    groundOffsetY: -6,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    baseAttributes: { STR: 30, VIT: 28, AGI: 26, DEX: 22, INT: 14, WIS: 12 },
    baseCombatAttributes: {
      BATTLE_MOVE_SPEED: 185,
      ATTACK_SPEED: 1.25,
      CRIT_RATE: 22,
      CRIT_DMG: 185,
      PHYS_ACCURACY: 115,
      MAG_ACCURACY: 105,
      PHYS_EVASION: 18,
      MAG_EVASION: 16,
    },
    skill: {
      id: 68,
      code: 'skill_mob_thunder_dash',
      namePtBr: 'Investida Trovejante do Qilin',
      descriptionPtBr: 'Arranca na velocidade do trovão atravessando o oponente com uma descarga de alta voltagem.',
      mcreworkIconKey: '10012',
      castActionId: 3,
      castMovement: 'DASH_TARGET',
      mcreworkVfxKey: '10014',
      mpCost: 30,
      cooldownSeconds: 6.0,
      castRange: 80,
      aoeRadius: 0,
      targetScope: 'SINGLE_TARGET',
      effectBlocks: [
        {
          blockType: 'DAMAGE',
          damageType: 'PHYSICAL',
          scaleStat: 'PHYS_ATK',
          scalePct: 240,
          flatAmount: 30,
          critBonusPct: 22,
          elementCode: 'AIR',
        },
      ],
    },
    biomes: [30, 31, 1], // STORM_PLATEAU, FLOATING_ISLANDS, VERDANT_PLAINS
    lootTemplateId: 35, // item_essencia_de_selvagem_ghj3x
  },

  // -------------------------------------------------------------------------
  // 4. RANK S: Colosso Rúnico dos Titãs (creature_200176, 337x336px)
  // -------------------------------------------------------------------------
  {
    id: 31,
    code: 'monster_31',
    mcreworkMonsterKey: 'creature_200176',
    namePtBr: 'Colosso Rúnico dos Titãs',
    descriptionPtBr: 'Um monólito colossal esculpido em granito puro e runas de éter ancestral. Sua couraça é virtualmente impenetrável e cada passo seu racha placas tectônicas.',
    raceCode: 'ROBOTIC',
    fixedElementCode: 'EARTH',
    rarityTier: 'S',
    combatStyle: 'MELEE',
    attackRange: 95,
    damageType: 'PHYSICAL',
    groundOffsetY: -8,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    baseAttributes: { STR: 34, VIT: 36, AGI: 10, DEX: 12, INT: 10, WIS: 12 },
    baseCombatAttributes: {
      BATTLE_MOVE_SPEED: 115,
      ATTACK_SPEED: 0.75,
      CRIT_RATE: 12,
      CRIT_DMG: 175,
      PHYS_ACCURACY: 105,
      MAG_ACCURACY: 95,
      PHYS_EVASION: 6,
      MAG_EVASION: 8,
    },
    skill: {
      id: 69,
      code: 'skill_mob_titan_slam',
      namePtBr: 'Impacto Titânico Sísmico',
      descriptionPtBr: 'Esmaga seus punhos rochosos contra o chão, gerando um terremoto que quebra o solo e causa atordoamento por impacto.',
      mcreworkIconKey: '10004',
      castActionId: 3,
      castMovement: 'MELEE_ADVANCE',
      mcreworkVfxKey: '10016',
      mpCost: 35,
      cooldownSeconds: 8.5,
      castRange: 100,
      aoeRadius: 90,
      targetScope: 'AOE_CIRCLE',
      effectBlocks: [
        {
          blockType: 'DAMAGE',
          damageType: 'PHYSICAL',
          scaleStat: 'PHYS_ATK',
          scalePct: 260,
          flatAmount: 40,
          critBonusPct: 12,
          elementCode: 'EARTH',
        },
      ],
    },
    biomes: [12, 13, 37], // ROCKY_CANYON, ALPINE_HIGHLANDS, ANCIENT_RUINS
    lootTemplateId: 38, // item_essencia_robotica_ukpuv
  },

  // -------------------------------------------------------------------------
  // 5. RANK S: Dragão Celeste do Éter Primordial (creature_200124, 194x175px)
  // -------------------------------------------------------------------------
  {
    id: 32,
    code: 'monster_32',
    mcreworkMonsterKey: 'creature_200124',
    namePtBr: 'Dragão Celeste do Éter Primordial',
    descriptionPtBr: 'Entidade dragônica serpentina envolta em nebulosas astrais. Desce das nuvens para purificar ou consumir intrusos com feixes de energia etérea radiante.',
    raceCode: 'DRAGON',
    fixedElementCode: 'AIR',
    rarityTier: 'S',
    combatStyle: 'RANGED',
    attackRange: 260,
    damageType: 'MAGICAL',
    groundOffsetY: -4,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    baseAttributes: { STR: 16, VIT: 26, AGI: 22, DEX: 24, INT: 34, WIS: 26 },
    baseCombatAttributes: {
      BATTLE_MOVE_SPEED: 165,
      ATTACK_SPEED: 1.15,
      CRIT_RATE: 18,
      CRIT_DMG: 195,
      PHYS_ACCURACY: 100,
      MAG_ACCURACY: 120,
      PHYS_EVASION: 15,
      MAG_EVASION: 20,
    },
    skill: {
      id: 70,
      code: 'skill_mob_astral_burst',
      namePtBr: 'Sopro Astral Primordial',
      descriptionPtBr: 'Dispara uma rajada de cometas astrais em direção aos alvos, pulverizando defesas mágicas.',
      mcreworkIconKey: '10011',
      castActionId: 7,
      castMovement: 'STATIONARY_CAST',
      mcreworkVfxKey: '10015',
      mpCost: 45,
      cooldownSeconds: 6.5,
      castRange: 270,
      aoeRadius: 80,
      targetScope: 'AOE_CIRCLE',
      effectBlocks: [
        {
          blockType: 'DAMAGE',
          damageType: 'MAGICAL',
          scaleStat: 'MAG_ATK',
          scalePct: 265,
          flatAmount: 35,
          critBonusPct: 18,
          elementCode: 'AIR',
        },
      ],
    },
    biomes: [31, 38, 40], // FLOATING_ISLANDS, ASTRAL_SANCTUARY, CELESTIAL_PALACE
    lootTemplateId: 42, // item_essencia_draconica_gjrko
  },

  // -------------------------------------------------------------------------
  // 6. RANK A: Ent Guardião da Floresta Ancestral (creature_000005, 253x184px)
  // -------------------------------------------------------------------------
  {
    id: 33,
    code: 'monster_33',
    mcreworkMonsterKey: 'creature_000005',
    namePtBr: 'Ent Guardião da Floresta Ancestral',
    descriptionPtBr: 'Guardião secular de madeira petrificada e vinhas espinhosas. Projeta raízes subterrâneas para perfurar inimigos que ousem profanar os bosques sagrados.',
    raceCode: 'PLANT',
    fixedElementCode: 'EARTH',
    rarityTier: 'A',
    combatStyle: 'MELEE',
    attackRange: 90,
    damageType: 'PHYSICAL',
    groundOffsetY: -6,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    baseAttributes: { STR: 28, VIT: 32, AGI: 12, DEX: 14, INT: 16, WIS: 18 },
    baseCombatAttributes: {
      BATTLE_MOVE_SPEED: 120,
      ATTACK_SPEED: 0.85,
      CRIT_RATE: 12,
      CRIT_DMG: 165,
      PHYS_ACCURACY: 102,
      MAG_ACCURACY: 105,
      PHYS_EVASION: 8,
      MAG_EVASION: 12,
    },
    skill: {
      id: 71,
      code: 'skill_mob_thorn_roots',
      namePtBr: 'Aprisionamento de Raízes Espinhosas',
      descriptionPtBr: 'Brota gavinhas e estacas de madeira maciça do chão empalando o alvo e drenando sua força vital.',
      mcreworkIconKey: '10006',
      castActionId: 3,
      castMovement: 'MELEE_ADVANCE',
      mcreworkVfxKey: '10013',
      mpCost: 30,
      cooldownSeconds: 7.0,
      castRange: 95,
      aoeRadius: 0,
      targetScope: 'SINGLE_TARGET',
      effectBlocks: [
        {
          blockType: 'DAMAGE',
          damageType: 'PHYSICAL',
          scaleStat: 'PHYS_ATK',
          scalePct: 220,
          flatAmount: 25,
          critBonusPct: 12,
          elementCode: 'EARTH',
        },
      ],
    },
    biomes: [8, 3, 32], // GIANT_ROOTS, DENSE_FOREST, DEADWOOD
    lootTemplateId: 37, // item_essencia_de_planta_i8e6j
  },

  // -------------------------------------------------------------------------
  // 7. RANK A: Sereia Feiticeira do Abismo Oceânico (creature_001098, 181x192px)
  // -------------------------------------------------------------------------
  {
    id: 34,
    code: 'monster_34',
    mcreworkMonsterKey: 'creature_001098',
    namePtBr: 'Sereia Feiticeira do Abismo Oceânico',
    descriptionPtBr: 'Bela e fatal habitante das profundezas oceânicas abissais. Conjuradora de vórtices d\'água sob alta pressão e canções místicas que despedaçam a mente dos navegantes.',
    raceCode: 'AQUATIC',
    fixedElementCode: 'WATER',
    rarityTier: 'A',
    combatStyle: 'RANGED',
    attackRange: 240,
    damageType: 'MAGICAL',
    groundOffsetY: -4,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    baseAttributes: { STR: 14, VIT: 24, AGI: 20, DEX: 22, INT: 30, WIS: 24 },
    baseCombatAttributes: {
      BATTLE_MOVE_SPEED: 160,
      ATTACK_SPEED: 1.10,
      CRIT_RATE: 16,
      CRIT_DMG: 175,
      PHYS_ACCURACY: 95,
      MAG_ACCURACY: 115,
      PHYS_EVASION: 14,
      MAG_EVASION: 18,
    },
    skill: {
      id: 72,
      code: 'skill_mob_oceanic_maelstrom',
      namePtBr: 'Maelstrom Oceânico Tridente',
      descriptionPtBr: 'Canaliza um turbilhão aquático giratório esmagando os alvos com pressão hidrostática letal.',
      mcreworkIconKey: '10009',
      castActionId: 7,
      castMovement: 'STATIONARY_CAST',
      mcreworkVfxKey: '10005',
      mpCost: 35,
      cooldownSeconds: 6.0,
      castRange: 250,
      aoeRadius: 80,
      targetScope: 'AOE_CIRCLE',
      effectBlocks: [
        {
          blockType: 'DAMAGE',
          damageType: 'MAGICAL',
          scaleStat: 'MAG_ATK',
          scalePct: 235,
          flatAmount: 30,
          critBonusPct: 16,
          elementCode: 'WATER',
        },
      ],
    },
    biomes: [23, 22, 21], // ABYSSAL_TRENCH, CORAL_REEF, MIRROR_LAKE
    lootTemplateId: 41, // item_essencia_aquatica_r17fz
  },

  // -------------------------------------------------------------------------
  // 8. RANK A: Tigre Branco Feroz dos Picos Sagrados (creature_100058, 216x182px)
  // -------------------------------------------------------------------------
  {
    id: 35,
    code: 'monster_35',
    mcreworkMonsterKey: 'creature_100058',
    namePtBr: 'Tigre Branco Feroz dos Picos Sagrados',
    descriptionPtBr: 'Predador supremo das montanhas celestiais dotado de garras energizadas por éter puro. Seus rugidos ecoam por vales inteiros desestabilizando tropas inimigas.',
    raceCode: 'BEAST',
    fixedElementCode: 'AIR',
    rarityTier: 'A',
    combatStyle: 'MELEE',
    attackRange: 70,
    damageType: 'PHYSICAL',
    groundOffsetY: -2,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    baseAttributes: { STR: 31, VIT: 27, AGI: 24, DEX: 22, INT: 10, WIS: 12 },
    baseCombatAttributes: {
      BATTLE_MOVE_SPEED: 180,
      ATTACK_SPEED: 1.30,
      CRIT_RATE: 24,
      CRIT_DMG: 190,
      PHYS_ACCURACY: 112,
      MAG_ACCURACY: 95,
      PHYS_EVASION: 16,
      MAG_EVASION: 12,
    },
    skill: {
      id: 73,
      code: 'skill_mob_savage_pounce',
      namePtBr: 'Bote Feroz Dilacerante',
      descriptionPtBr: 'Salta em velocidade cega contra a presa, desferindo uma série de patadas cortantes.',
      mcreworkIconKey: '10003',
      castActionId: 3,
      castMovement: 'DASH_TARGET',
      mcreworkVfxKey: '10017',
      mpCost: 25,
      cooldownSeconds: 5.5,
      castRange: 75,
      aoeRadius: 0,
      targetScope: 'SINGLE_TARGET',
      effectBlocks: [
        {
          blockType: 'DAMAGE',
          damageType: 'PHYSICAL',
          scaleStat: 'PHYS_ATK',
          scalePct: 245,
          flatAmount: 25,
          critBonusPct: 24,
          elementCode: 'AIR',
        },
      ],
    },
    biomes: [13, 25, 27], // ALPINE_HIGHLANDS, SNOWY_TAIGA, BLIZZARD_PEAK
    lootTemplateId: 35, // item_essencia_de_selvagem_ghj3x
  },

  // -------------------------------------------------------------------------
  // 9. RANK B: Lorde Basilisco dos Pântanos Sombrios (creature_001076, 139x121px)
  // -------------------------------------------------------------------------
  {
    id: 36,
    code: 'monster_36',
    mcreworkMonsterKey: 'creature_001076',
    namePtBr: 'Lorde Basilisco dos Pântanos Sombrios',
    descriptionPtBr: 'Rei dos répteis venenosos habitante de charcos fétidos. Seu olhar de safira paralisa presas enquanto suas presas injetam peçonha neurotóxica corrosiva.',
    raceCode: 'REPTILIAN',
    fixedElementCode: 'EARTH',
    rarityTier: 'B',
    combatStyle: 'MELEE',
    attackRange: 70,
    damageType: 'PHYSICAL',
    groundOffsetY: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    baseAttributes: { STR: 26, VIT: 25, AGI: 22, DEX: 20, INT: 16, WIS: 14 },
    baseCombatAttributes: {
      BATTLE_MOVE_SPEED: 165,
      ATTACK_SPEED: 1.15,
      CRIT_RATE: 16,
      CRIT_DMG: 170,
      PHYS_ACCURACY: 105,
      MAG_ACCURACY: 100,
      PHYS_EVASION: 14,
      MAG_EVASION: 12,
    },
    skill: {
      id: 74,
      code: 'skill_mob_venomous_gaze',
      namePtBr: 'Presas de Peçonha do Basilisco',
      descriptionPtBr: 'Golpeia como um chicote inoculando uma toxina que consome a vitalidade do alvo ao longo do tempo.',
      mcreworkIconKey: '10005',
      castActionId: 3,
      castMovement: 'MELEE_ADVANCE',
      mcreworkVfxKey: '10009',
      mpCost: 25,
      cooldownSeconds: 6.5,
      castRange: 75,
      aoeRadius: 0,
      targetScope: 'SINGLE_TARGET',
      effectBlocks: [
        {
          blockType: 'DAMAGE',
          damageType: 'PHYSICAL',
          scaleStat: 'PHYS_ATK',
          scalePct: 210,
          flatAmount: 20,
          critBonusPct: 16,
          elementCode: 'EARTH',
        },
      ],
    },
    biomes: [19, 20, 34], // MISTY_SWAMP, POISON_MANGROVE, BLIGHTED_LANDS
    lootTemplateId: 43, // item_essencia_reptiliana_wv5uc
  },

  // -------------------------------------------------------------------------
  // 10. RANK B: Faraó Espectral das Dunas Douradas (creature_200017, 225x214px)
  // -------------------------------------------------------------------------
  {
    id: 37,
    code: 'monster_37',
    mcreworkMonsterKey: 'creature_200017',
    namePtBr: 'Faraó Espectral das Dunas Douradas',
    descriptionPtBr: 'Monarca mumificado erguido por maldições milenares do deserto. Flutua envolto em bandagens rúnicas e canaliza tempestades de areia e espíritos penados.',
    raceCode: 'SPIRIT',
    fixedElementCode: 'EARTH',
    rarityTier: 'B',
    combatStyle: 'RANGED',
    attackRange: 220,
    damageType: 'MAGICAL',
    groundOffsetY: -4,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    baseAttributes: { STR: 15, VIT: 24, AGI: 18, DEX: 20, INT: 28, WIS: 22 },
    baseCombatAttributes: {
      BATTLE_MOVE_SPEED: 155,
      ATTACK_SPEED: 1.05,
      CRIT_RATE: 15,
      CRIT_DMG: 165,
      PHYS_ACCURACY: 98,
      MAG_ACCURACY: 110,
      PHYS_EVASION: 12,
      MAG_EVASION: 16,
    },
    skill: {
      id: 75,
      code: 'skill_mob_pharaoh_curse',
      namePtBr: 'Maldição das Areias Faraônicas',
      descriptionPtBr: 'Ergue uma tempestade de poeira mágica e espíritos ancestrais que sufocam e laceram os inimigos.',
      mcreworkIconKey: '10007',
      castActionId: 7,
      castMovement: 'STATIONARY_CAST',
      mcreworkVfxKey: '10019',
      mpCost: 30,
      cooldownSeconds: 7.0,
      castRange: 230,
      aoeRadius: 85,
      targetScope: 'AOE_CIRCLE',
      effectBlocks: [
        {
          blockType: 'DAMAGE',
          damageType: 'MAGICAL',
          scaleStat: 'MAG_ATK',
          scalePct: 215,
          flatAmount: 25,
          critBonusPct: 15,
          elementCode: 'EARTH',
        },
      ],
    },
    biomes: [10, 11, 33], // SAND_DUNES, HIDDEN_OASIS, ANCIENT_NECROPOLIS
    lootTemplateId: 44, // item_essencia_espiritual_3bffa
  },
];

/**
 * Atualiza o snapshot lowcode.snapshot.json com os 10 novos monstros.
 */
export function updateSnapshotWithBatchTwo() {
  if (!fs.existsSync(snapshotPath)) {
    console.error('Arquivo snapshot não encontrado em:', snapshotPath);
    return;
  }

  const snap = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));

  for (const m of batchTwoMonsters) {
    const sk = m.skill;
    const skillNameKey = `skill.${sk.code}.name`;
    const skillDescKey = `skill.${sk.code}.description`;
    const mobNameKey = `monster.${m.code}.name`;
    const mobDescKey = `monster.${m.code}.description`;

    // 1. Traduções i18n
    const trans = [
      { key: skillNameKey, locale: 'pt-BR', text: sk.namePtBr },
      { key: skillDescKey, locale: 'pt-BR', text: sk.descriptionPtBr },
      { key: mobNameKey, locale: 'pt-BR', text: m.namePtBr },
      { key: mobDescKey, locale: 'pt-BR', text: m.descriptionPtBr },
    ];
    for (const t of trans) {
      const idx = snap.i18nTranslations.findIndex(
        (x: any) => x.key === t.key && x.locale === t.locale
      );
      if (idx >= 0) snap.i18nTranslations[idx] = t;
      else snap.i18nTranslations.push(t);
    }

    // 2. Habilidade
    const skillEntry = {
      id: sk.id,
      code: sk.code,
      nameI18nKey: skillNameKey,
      descriptionI18nKey: skillDescKey,
      mcreworkIconKey: sk.mcreworkIconKey,
      castActionId: sk.castActionId,
      castMovement: sk.castMovement,
      mcreworkVfxKey: sk.mcreworkVfxKey,
      mpCost: sk.mpCost,
      cooldownSeconds: sk.cooldownSeconds,
      castRange: sk.castRange,
      aoeRadius: sk.aoeRadius,
      targetScope: sk.targetScope,
      effectBlocksJson: sk.effectBlocks,
      requiredLevel: 1,
      requiredClassTemplateId: null,
      isActive: true,
    };
    const sIdx = snap.skillTemplates.findIndex((x: any) => x.id === sk.id);
    if (sIdx >= 0) snap.skillTemplates[sIdx] = skillEntry;
    else snap.skillTemplates.push(skillEntry);

    // 3. Monstro
    const monsterEntry = {
      id: m.id,
      code: m.code,
      mcreworkMonsterKey: m.mcreworkMonsterKey,
      nameI18nKey: mobNameKey,
      descriptionI18nKey: mobDescKey,
      groundOffsetY: m.groundOffsetY,
      shadowOffsetX: m.shadowOffsetX ?? 0,
      shadowOffsetY: m.shadowOffsetY ?? 0,
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
        { itemTemplateId: m.lootTemplateId, minQty: 1, maxQty: 1, chancePct: 80 },
      ],
      isActive: true,
    };
    const mIdx = snap.monsterTemplates.findIndex((x: any) => x.id === m.id);
    if (mIdx >= 0) snap.monsterTemplates[mIdx] = monsterEntry;
    else snap.monsterTemplates.push(monsterEntry);

    // 4. Biomas
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
  console.log('✅ [Snapshot] lowcode.snapshot.json atualizado com o segundo lote de 10 monstros!');
}

/**
 * Insere os 10 novos monstros diretamente no PostgreSQL caso o PrismaClient esteja conectado.
 */
export async function seedBatchTwoIntoDatabase(prisma: PrismaClient) {
  console.log('🌱 Inserindo segundo lote de 10 monstros e habilidades no banco de dados...');

  for (const m of batchTwoMonsters) {
    const sk = m.skill;
    const skillNameKey = `skill.${sk.code}.name`;
    const skillDescKey = `skill.${sk.code}.description`;
    const mobNameKey = `monster.${m.code}.name`;
    const mobDescKey = `monster.${m.code}.description`;

    // i18n
    await prisma.i18nTranslation.upsert({
      where: { key_locale: { key: skillNameKey, locale: 'pt-BR' } },
      create: { key: skillNameKey, locale: 'pt-BR', text: sk.namePtBr },
      update: { text: sk.namePtBr },
    });
    await prisma.i18nTranslation.upsert({
      where: { key_locale: { key: skillDescKey, locale: 'pt-BR' } },
      create: { key: skillDescKey, locale: 'pt-BR', text: sk.descriptionPtBr },
      update: { text: sk.descriptionPtBr },
    });
    await prisma.i18nTranslation.upsert({
      where: { key_locale: { key: mobNameKey, locale: 'pt-BR' } },
      create: { key: mobNameKey, locale: 'pt-BR', text: m.namePtBr },
      update: { text: m.namePtBr },
    });
    await prisma.i18nTranslation.upsert({
      where: { key_locale: { key: mobDescKey, locale: 'pt-BR' } },
      create: { key: mobDescKey, locale: 'pt-BR', text: m.descriptionPtBr },
      update: { text: m.descriptionPtBr },
    });

    // Habilidade
    await prisma.skillTemplate.upsert({
      where: { id: sk.id },
      create: {
        id: sk.id,
        code: sk.code,
        nameI18nKey: skillNameKey,
        descriptionI18nKey: skillDescKey,
        mcreworkIconKey: sk.mcreworkIconKey,
        castActionId: sk.castActionId,
        castMovement: sk.castMovement,
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
        nameI18nKey: skillNameKey,
        descriptionI18nKey: skillDescKey,
        mcreworkIconKey: sk.mcreworkIconKey,
        castActionId: sk.castActionId,
        castMovement: sk.castMovement,
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

    // Monstro
    await prisma.monsterTemplate.upsert({
      where: { id: m.id },
      create: {
        id: m.id,
        code: m.code,
        mcreworkMonsterKey: m.mcreworkMonsterKey,
        nameI18nKey: mobNameKey,
        descriptionI18nKey: mobDescKey,
        groundOffsetY: m.groundOffsetY,
        shadowOffsetX: m.shadowOffsetX ?? 0,
        shadowOffsetY: m.shadowOffsetY ?? 0,
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
          { itemTemplateId: m.lootTemplateId, minQty: 1, maxQty: 1, chancePct: 80 },
        ],
        isActive: true,
      },
      update: {
        code: m.code,
        mcreworkMonsterKey: m.mcreworkMonsterKey,
        nameI18nKey: mobNameKey,
        descriptionI18nKey: mobDescKey,
        groundOffsetY: m.groundOffsetY,
        shadowOffsetX: m.shadowOffsetX ?? 0,
        shadowOffsetY: m.shadowOffsetY ?? 0,
        raceCode: m.raceCode,
        fixedElementCode: m.fixedElementCode,
        rarityTier: m.rarityTier,
        combatStyle: m.combatStyle,
        attackRange: m.attackRange,
        damageType: m.damageType,
        baseAttributesJson: m.baseAttributes,
        baseCombatAttributesJson: m.baseCombatAttributes,
        skillIdsJson: [sk.id],
        lootTableJson: [
          { itemTemplateId: m.lootTemplateId, minQty: 1, maxQty: 1, chancePct: 80 },
        ],
        isActive: true,
      },
    });

    // Vínculos com biomas
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

  for (const tbl of ['i18n_translations', 'skill_templates', 'monster_templates', 'monster_biomes']) {
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('public."${tbl}"', 'id'), COALESCE((SELECT MAX(id) FROM public."${tbl}"), 0) + 1, false);`
    ).catch(() => {});
  }

  console.log('✅ Segundo lote de 10 monstros, habilidades e biomas inseridos com sucesso!');
}

// Execução direta via CLI
if (process.argv[1] && process.argv[1].includes('seedBatchTwoMonsters')) {
  updateSnapshotWithBatchTwo();
  const prisma = new PrismaClient();
  seedBatchTwoIntoDatabase(prisma)
    .catch((e) => {
      console.warn('Banco local offline ou inacessível (Snapshot JSON atualizado com sucesso):', e.message);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
