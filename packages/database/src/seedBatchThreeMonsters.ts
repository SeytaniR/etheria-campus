/**
 * @file packages/database/src/seedBatchThreeMonsters.ts
 * @description Semeador do terceiro lote de 10 monstros procedurais (#38 a #47) com habilidades dedicadas,
 * biomas de spawn e drops de essência (80% de chance, 1 unidade) condizentes com a raça.
 * Este lote é calibrado em poder intermediário (ranks A a C), um pouco mais fracos que o lote 2 (#28-#37).
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

export const batchThreeMonsters: MonsterSeedItem[] = [
  // -------------------------------------------------------------------------
  // 1. RANK A: Drake Vulcânico de Fogo Fátuo (creature_001115, 143x144px)
  // -------------------------------------------------------------------------
  {
    id: 38,
    code: 'monster_38',
    mcreworkMonsterKey: 'creature_001115',
    namePtBr: 'Drake Vulcânico de Fogo Fátuo',
    descriptionPtBr: 'Jovem dragão habitante das chaminés vulcânicas. Suas escamas vertem labaredas incandescentes e seus ataques afiados incendeiam o solo onde pisa.',
    raceCode: 'DRAGON',
    fixedElementCode: 'FIRE',
    rarityTier: 'A',
    combatStyle: 'MELEE',
    attackRange: 75,
    damageType: 'PHYSICAL',
    groundOffsetY: -2,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    baseAttributes: { STR: 26, VIT: 24, AGI: 20, DEX: 18, INT: 14, WIS: 10 },
    baseCombatAttributes: {
      BATTLE_MOVE_SPEED: 160,
      ATTACK_SPEED: 1.15,
      CRIT_RATE: 16,
      CRIT_DMG: 165,
      PHYS_ACCURACY: 105,
      MAG_ACCURACY: 95,
      PHYS_EVASION: 12,
      MAG_EVASION: 10,
    },
    skill: {
      id: 76,
      code: 'skill_mob_drake_ignite',
      namePtBr: 'Sopro de Brasas Vulcânicas',
      descriptionPtBr: 'Expele uma baforada de cinzas e brasas ardentes que queima o adversário com dano concentrado.',
      mcreworkIconKey: '10008',
      castActionId: 3,
      castMovement: 'MELEE_ADVANCE',
      mcreworkVfxKey: '10018',
      mpCost: 25,
      cooldownSeconds: 6.0,
      castRange: 80,
      aoeRadius: 0,
      targetScope: 'SINGLE_TARGET',
      effectBlocks: [
        {
          blockType: 'DAMAGE',
          damageType: 'PHYSICAL',
          scaleStat: 'PHYS_ATK',
          scalePct: 215,
          flatAmount: 25,
          critBonusPct: 16,
          elementCode: 'FIRE',
        },
      ],
    },
    biomes: [29, 28, 12], // LAVA_CALDERA, ASHLANDS, ROCKY_CANYON
    lootTemplateId: 42, // item_essencia_draconica_gjrko
  },

  // -------------------------------------------------------------------------
  // 2. RANK A: Emissário Noturno do Abismo (creature_001104, 220x180px)
  // -------------------------------------------------------------------------
  {
    id: 39,
    code: 'monster_39',
    mcreworkMonsterKey: 'creature_001104',
    namePtBr: 'Emissário Noturno do Abismo',
    descriptionPtBr: 'Guerreiro demoníaco alado enviado para ceifar os invasores dos portais sombrios. Suas asas produzem rajadas cortantes de energia abissal.',
    raceCode: 'DEMON',
    fixedElementCode: 'FIRE',
    rarityTier: 'A',
    combatStyle: 'MELEE',
    attackRange: 80,
    damageType: 'PHYSICAL',
    groundOffsetY: -4,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    baseAttributes: { STR: 25, VIT: 23, AGI: 22, DEX: 18, INT: 16, WIS: 8 },
    baseCombatAttributes: {
      BATTLE_MOVE_SPEED: 155,
      ATTACK_SPEED: 1.10,
      CRIT_RATE: 15,
      CRIT_DMG: 160,
      PHYS_ACCURACY: 102,
      MAG_ACCURACY: 95,
      PHYS_EVASION: 14,
      MAG_EVASION: 12,
    },
    skill: {
      id: 77,
      code: 'skill_mob_nether_cleave',
      namePtBr: 'Talho das Trevas Abissais',
      descriptionPtBr: 'Executa um corte giratório com lâminas impregnadas de éter maligno, golpeando em arco frontal.',
      mcreworkIconKey: '10003',
      castActionId: 3,
      castMovement: 'MELEE_ADVANCE',
      mcreworkVfxKey: '10017',
      mpCost: 28,
      cooldownSeconds: 6.5,
      castRange: 85,
      aoeRadius: 75,
      targetScope: 'AOE_CIRCLE',
      effectBlocks: [
        {
          blockType: 'DAMAGE',
          damageType: 'PHYSICAL',
          scaleStat: 'PHYS_ATK',
          scalePct: 210,
          flatAmount: 20,
          critBonusPct: 15,
          elementCode: 'FIRE',
        },
      ],
    },
    biomes: [35, 34, 28], // DEMONIC_RIFT, BLIGHTED_LANDS, ASHLANDS
    lootTemplateId: 36, // item_essencia_demoniaca_oaod7
  },

  // -------------------------------------------------------------------------
  // 3. RANK B: Falcão das Tempestades Douradas (creature_001107, 108x107px)
  // -------------------------------------------------------------------------
  {
    id: 40,
    code: 'monster_40',
    mcreworkMonsterKey: 'creature_001107',
    namePtBr: 'Falcão das Tempestades Douradas',
    descriptionPtBr: 'Ave de rapina veloz que plana sobre os platôs ventosos. Mergulha em alta velocidade rasgando o vento para cravar suas garras na presa.',
    raceCode: 'BEAST',
    fixedElementCode: 'AIR',
    rarityTier: 'B',
    combatStyle: 'MELEE',
    attackRange: 65,
    damageType: 'PHYSICAL',
    groundOffsetY: -4,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    baseAttributes: { STR: 22, VIT: 20, AGI: 26, DEX: 22, INT: 8, WIS: 8 },
    baseCombatAttributes: {
      BATTLE_MOVE_SPEED: 175,
      ATTACK_SPEED: 1.25,
      CRIT_RATE: 18,
      CRIT_DMG: 165,
      PHYS_ACCURACY: 110,
      MAG_ACCURACY: 90,
      PHYS_EVASION: 16,
      MAG_EVASION: 12,
    },
    skill: {
      id: 78,
      code: 'skill_mob_tempest_swoop',
      namePtBr: 'Rasante Tempestuoso',
      descriptionPtBr: 'Investe em voo rasante em linha reta, cortando o ar e atingindo o inimigo desprevenido.',
      mcreworkIconKey: '10012',
      castActionId: 3,
      castMovement: 'DASH_TARGET',
      mcreworkVfxKey: '10014',
      mpCost: 20,
      cooldownSeconds: 5.0,
      castRange: 75,
      aoeRadius: 0,
      targetScope: 'SINGLE_TARGET',
      effectBlocks: [
        {
          blockType: 'DAMAGE',
          damageType: 'PHYSICAL',
          scaleStat: 'PHYS_ATK',
          scalePct: 195,
          flatAmount: 20,
          critBonusPct: 18,
          elementCode: 'AIR',
        },
      ],
    },
    biomes: [30, 13, 1], // STORM_PLATEAU, ALPINE_HIGHLANDS, VERDANT_PLAINS
    lootTemplateId: 35, // item_essencia_de_selvagem_ghj3x
  },

  // -------------------------------------------------------------------------
  // 4. RANK B: Caranguejo Blindado dos Corais (creature_001105, 135x129px)
  // -------------------------------------------------------------------------
  {
    id: 41,
    code: 'monster_41',
    mcreworkMonsterKey: 'creature_001105',
    namePtBr: 'Caranguejo Blindado dos Corais',
    descriptionPtBr: 'Crustáceo colossal fortificado com conchas e minerais marinhos endurecidos. Usa suas pinças como escudos maciços e esmagadores de crânios.',
    raceCode: 'AQUATIC',
    fixedElementCode: 'WATER',
    rarityTier: 'B',
    combatStyle: 'MELEE',
    attackRange: 65,
    damageType: 'PHYSICAL',
    groundOffsetY: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    baseAttributes: { STR: 24, VIT: 28, AGI: 12, DEX: 14, INT: 8, WIS: 10 },
    baseCombatAttributes: {
      BATTLE_MOVE_SPEED: 125,
      ATTACK_SPEED: 0.90,
      CRIT_RATE: 10,
      CRIT_DMG: 150,
      PHYS_ACCURACY: 98,
      MAG_ACCURACY: 90,
      PHYS_EVASION: 6,
      MAG_EVASION: 8,
    },
    skill: {
      id: 79,
      code: 'skill_mob_coral_pincer',
      namePtBr: 'Pinçada Esmagadora de Coral',
      descriptionPtBr: 'Prende o alvo com sua pinça massiva, partindo defesas físicas sob imensa pressão hidráulica.',
      mcreworkIconKey: '10004',
      castActionId: 3,
      castMovement: 'MELEE_ADVANCE',
      mcreworkVfxKey: '10005',
      mpCost: 22,
      cooldownSeconds: 6.0,
      castRange: 70,
      aoeRadius: 0,
      targetScope: 'SINGLE_TARGET',
      effectBlocks: [
        {
          blockType: 'DAMAGE',
          damageType: 'PHYSICAL',
          scaleStat: 'PHYS_ATK',
          scalePct: 190,
          flatAmount: 22,
          critBonusPct: 10,
          elementCode: 'WATER',
        },
      ],
    },
    biomes: [22, 17, 18], // CORAL_REEF, TROPICAL_COAST, SEA_CLIFFS
    lootTemplateId: 41, // item_essencia_aquatica_r17fz
  },

  // -------------------------------------------------------------------------
  // 5. RANK B: Orquídea Carnívora Sedutora (creature_000032, 114x119px)
  // -------------------------------------------------------------------------
  {
    id: 42,
    code: 'monster_42',
    mcreworkMonsterKey: 'creature_000032',
    namePtBr: 'Orquídea Carnívora Sedutora',
    descriptionPtBr: 'Planta predadora encantada dotada de pétalas hipnóticas e néctar aromático letal. Captura andarilhos com chicotes espinhosos para digestão lenta.',
    raceCode: 'PLANT',
    fixedElementCode: 'EARTH',
    rarityTier: 'B',
    combatStyle: 'RANGED',
    attackRange: 210,
    damageType: 'MAGICAL',
    groundOffsetY: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    baseAttributes: { STR: 12, VIT: 22, AGI: 16, DEX: 18, INT: 26, WIS: 16 },
    baseCombatAttributes: {
      BATTLE_MOVE_SPEED: 140,
      ATTACK_SPEED: 1.05,
      CRIT_RATE: 14,
      CRIT_DMG: 160,
      PHYS_ACCURACY: 95,
      MAG_ACCURACY: 108,
      PHYS_EVASION: 10,
      MAG_EVASION: 14,
    },
    skill: {
      id: 80,
      code: 'skill_mob_hypnotic_spores',
      namePtBr: 'Esporos Hipnóticos da Orquídea',
      descriptionPtBr: 'Libera uma nuvem de esporos venenosos que sufocam e corroem a mente do adversário.',
      mcreworkIconKey: '10006',
      castActionId: 7,
      castMovement: 'STATIONARY_CAST',
      mcreworkVfxKey: '10013',
      mpCost: 25,
      cooldownSeconds: 6.5,
      castRange: 220,
      aoeRadius: 75,
      targetScope: 'AOE_CIRCLE',
      effectBlocks: [
        {
          blockType: 'DAMAGE',
          damageType: 'MAGICAL',
          scaleStat: 'MAG_ATK',
          scalePct: 200,
          flatAmount: 20,
          critBonusPct: 14,
          elementCode: 'EARTH',
        },
      ],
    },
    biomes: [4, 6, 3], // TROPICAL_JUNGLE, FAIRY_GARDEN, DENSE_FOREST
    lootTemplateId: 37, // item_essencia_de_planta_i8e6j
  },

  // -------------------------------------------------------------------------
  // 6. RANK B: Ninfa da Aurora Cristalina (creature_001123, 119x96px)
  // -------------------------------------------------------------------------
  {
    id: 43,
    code: 'monster_43',
    mcreworkMonsterKey: 'creature_001123',
    namePtBr: 'Ninfa da Aurora Cristalina',
    descriptionPtBr: 'Fada luminescente gerada no encontro das correntes térmicas polares. Usa o reflexo do gelo para tecer feixes de luz congelante desorientadores.',
    raceCode: 'FAIRY',
    fixedElementCode: 'WATER',
    rarityTier: 'B',
    combatStyle: 'RANGED',
    attackRange: 230,
    damageType: 'MAGICAL',
    groundOffsetY: -4,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    baseAttributes: { STR: 10, VIT: 18, AGI: 22, DEX: 20, INT: 25, WIS: 18 },
    baseCombatAttributes: {
      BATTLE_MOVE_SPEED: 165,
      ATTACK_SPEED: 1.15,
      CRIT_RATE: 15,
      CRIT_DMG: 160,
      PHYS_ACCURACY: 92,
      MAG_ACCURACY: 112,
      PHYS_EVASION: 15,
      MAG_EVASION: 18,
    },
    skill: {
      id: 81,
      code: 'skill_mob_aurora_ray',
      namePtBr: 'Feixe da Aurora Polar',
      descriptionPtBr: 'Dispara uma flecha de luz prismática glacial que resfria e danifica o alvo à distância.',
      mcreworkIconKey: '10011',
      castActionId: 7,
      castMovement: 'STATIONARY_CAST',
      mcreworkVfxKey: '10006',
      mpCost: 25,
      cooldownSeconds: 5.5,
      castRange: 240,
      aoeRadius: 0,
      targetScope: 'SINGLE_TARGET',
      effectBlocks: [
        {
          blockType: 'DAMAGE',
          damageType: 'MAGICAL',
          scaleStat: 'MAG_ATK',
          scalePct: 205,
          flatAmount: 22,
          critBonusPct: 15,
          elementCode: 'WATER',
        },
      ],
    },
    biomes: [26, 6, 21], // ETERNAL_GLACIER, FAIRY_GARDEN, MIRROR_LAKE
    lootTemplateId: 39, // item_essencia_elfica_gfegf
  },

  // -------------------------------------------------------------------------
  // 7. RANK C: Rã Peçonhenta das Marismas (creature_001064, 139x116px)
  // -------------------------------------------------------------------------
  {
    id: 44,
    code: 'monster_44',
    mcreworkMonsterKey: 'creature_001064',
    namePtBr: 'Rã Peçonhenta das Marismas',
    descriptionPtBr: 'Anfíbio predador que habita águas estagnadas e manguezais. Lança sua língua viscosa para capturar presas e borrifar veneno corrosivo.',
    raceCode: 'REPTILIAN',
    fixedElementCode: 'EARTH',
    rarityTier: 'C',
    combatStyle: 'MELEE',
    attackRange: 70,
    damageType: 'PHYSICAL',
    groundOffsetY: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    baseAttributes: { STR: 20, VIT: 22, AGI: 18, DEX: 18, INT: 14, WIS: 10 },
    baseCombatAttributes: {
      BATTLE_MOVE_SPEED: 150,
      ATTACK_SPEED: 1.10,
      CRIT_RATE: 12,
      CRIT_DMG: 155,
      PHYS_ACCURACY: 100,
      MAG_ACCURACY: 95,
      PHYS_EVASION: 12,
      MAG_EVASION: 10,
    },
    skill: {
      id: 82,
      code: 'skill_mob_toxic_tongue',
      namePtBr: 'Chicote de Língua Ácida',
      descriptionPtBr: 'Estica sua língua rápida como um chicote inoculando secreção cáustica na pele do alvo.',
      mcreworkIconKey: '10005',
      castActionId: 3,
      castMovement: 'MELEE_ADVANCE',
      mcreworkVfxKey: '10009',
      mpCost: 18,
      cooldownSeconds: 5.0,
      castRange: 75,
      aoeRadius: 0,
      targetScope: 'SINGLE_TARGET',
      effectBlocks: [
        {
          blockType: 'DAMAGE',
          damageType: 'PHYSICAL',
          scaleStat: 'PHYS_ATK',
          scalePct: 180,
          flatAmount: 18,
          critBonusPct: 12,
          elementCode: 'EARTH',
        },
      ],
    },
    biomes: [20, 19, 11], // POISON_MANGROVE, MISTY_SWAMP, HIDDEN_OASIS
    lootTemplateId: 43, // item_essencia_reptiliana_wv5uc
  },

  // -------------------------------------------------------------------------
  // 8. RANK C: Guardião Monólito de Granito (creature_001102, 167x121px)
  // -------------------------------------------------------------------------
  {
    id: 45,
    code: 'monster_45',
    mcreworkMonsterKey: 'creature_001102',
    namePtBr: 'Guardião Monólito de Granito',
    descriptionPtBr: 'Totem rúnico esculpido para proteger túmulos e marcos de fronteira arcanos. Bate suas arestas duras com força descomunal contra intrusos.',
    raceCode: 'ROBOTIC',
    fixedElementCode: 'EARTH',
    rarityTier: 'C',
    combatStyle: 'MELEE',
    attackRange: 75,
    damageType: 'PHYSICAL',
    groundOffsetY: -2,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    baseAttributes: { STR: 24, VIT: 26, AGI: 8, DEX: 12, INT: 10, WIS: 12 },
    baseCombatAttributes: {
      BATTLE_MOVE_SPEED: 110,
      ATTACK_SPEED: 0.80,
      CRIT_RATE: 8,
      CRIT_DMG: 145,
      PHYS_ACCURACY: 96,
      MAG_ACCURACY: 90,
      PHYS_EVASION: 4,
      MAG_EVASION: 6,
    },
    skill: {
      id: 83,
      code: 'skill_mob_monolith_strike',
      namePtBr: 'Golpe de Placa Rúnica',
      descriptionPtBr: 'Desaba sobre o solo com seu corpo de granito sólido, causando uma pequena onda de choque local.',
      mcreworkIconKey: '10004',
      castActionId: 3,
      castMovement: 'MELEE_ADVANCE',
      mcreworkVfxKey: '10016',
      mpCost: 20,
      cooldownSeconds: 7.0,
      castRange: 80,
      aoeRadius: 0,
      targetScope: 'SINGLE_TARGET',
      effectBlocks: [
        {
          blockType: 'DAMAGE',
          damageType: 'PHYSICAL',
          scaleStat: 'PHYS_ATK',
          scalePct: 185,
          flatAmount: 20,
          critBonusPct: 8,
          elementCode: 'EARTH',
        },
      ],
    },
    biomes: [37, 12, 14], // ANCIENT_RUINS, ROCKY_CANYON, DEEP_CAVERN
    lootTemplateId: 38, // item_essencia_robotica_ukpuv
  },

  // -------------------------------------------------------------------------
  // 9. RANK C: Corsário Renegado das Ilhas (creature_000038, 165x129px)
  // -------------------------------------------------------------------------
  {
    id: 46,
    code: 'monster_46',
    mcreworkMonsterKey: 'creature_000038',
    namePtBr: 'Corsário Renegado das Ilhas',
    descriptionPtBr: 'Ladrão do mar veterano empunhando sabres enferrujados e trabucos curtos. Saqueador de navios mercantes ao longo das rotas costeiras.',
    raceCode: 'HUMAN',
    fixedElementCode: 'WATER',
    rarityTier: 'C',
    combatStyle: 'MELEE',
    attackRange: 65,
    damageType: 'PHYSICAL',
    groundOffsetY: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    baseAttributes: { STR: 21, VIT: 20, AGI: 20, DEX: 20, INT: 10, WIS: 10 },
    baseCombatAttributes: {
      BATTLE_MOVE_SPEED: 155,
      ATTACK_SPEED: 1.15,
      CRIT_RATE: 14,
      CRIT_DMG: 155,
      PHYS_ACCURACY: 102,
      MAG_ACCURACY: 90,
      PHYS_EVASION: 12,
      MAG_EVASION: 10,
    },
    skill: {
      id: 84,
      code: 'skill_mob_cutlass_slash',
      namePtBr: 'Estocada Suja do Bucaneiro',
      descriptionPtBr: 'Desfere um golpe baixo e traiçoeiro com o sabre, aproveitando brechas na guarda do alvo.',
      mcreworkIconKey: '10003',
      castActionId: 3,
      castMovement: 'MELEE_ADVANCE',
      mcreworkVfxKey: '10017',
      mpCost: 18,
      cooldownSeconds: 5.0,
      castRange: 70,
      aoeRadius: 0,
      targetScope: 'SINGLE_TARGET',
      effectBlocks: [
        {
          blockType: 'DAMAGE',
          damageType: 'PHYSICAL',
          scaleStat: 'PHYS_ATK',
          scalePct: 175,
          flatAmount: 18,
          critBonusPct: 14,
          elementCode: 'WATER',
        },
      ],
    },
    biomes: [17, 18, 16], // TROPICAL_COAST, SEA_CLIFFS, BADLANDS
    lootTemplateId: 34, // item_essencia_humana_l30fi
  },

  // -------------------------------------------------------------------------
  // 10. RANK C: Espectro Penado do Vazio (creature_001095, 189x132px)
  // -------------------------------------------------------------------------
  {
    id: 47,
    code: 'monster_47',
    mcreworkMonsterKey: 'creature_001095',
    namePtBr: 'Espectro Penado do Vazio',
    descriptionPtBr: 'Entidade incorpórea aprisionada entre os planos da existência. Seu toque drena o calor e a estamina dos vivos em um gemido espectral aterrador.',
    raceCode: 'SPIRIT',
    fixedElementCode: 'NEUTRAL',
    rarityTier: 'C',
    combatStyle: 'RANGED',
    attackRange: 200,
    damageType: 'MAGICAL',
    groundOffsetY: -4,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    baseAttributes: { STR: 10, VIT: 18, AGI: 20, DEX: 18, INT: 24, WIS: 16 },
    baseCombatAttributes: {
      BATTLE_MOVE_SPEED: 150,
      ATTACK_SPEED: 1.05,
      CRIT_RATE: 12,
      CRIT_DMG: 150,
      PHYS_ACCURACY: 94,
      MAG_ACCURACY: 105,
      PHYS_EVASION: 16,
      MAG_EVASION: 16,
    },
    skill: {
      id: 85,
      code: 'skill_mob_phantom_wail',
      namePtBr: 'Lamento Fúnebre do Espectro',
      descriptionPtBr: 'Emite um uivo agudo que reverbera pela alma do adversário causando calafrios e dano psíquico.',
      mcreworkIconKey: '10007',
      castActionId: 7,
      castMovement: 'STATIONARY_CAST',
      mcreworkVfxKey: '10015',
      mpCost: 22,
      cooldownSeconds: 6.0,
      castRange: 210,
      aoeRadius: 0,
      targetScope: 'SINGLE_TARGET',
      effectBlocks: [
        {
          blockType: 'DAMAGE',
          damageType: 'MAGICAL',
          scaleStat: 'MAG_ATK',
          scalePct: 185,
          flatAmount: 20,
          critBonusPct: 12,
          elementCode: 'NEUTRAL',
        },
      ],
    },
    biomes: [33, 34, 32], // ANCIENT_NECROPOLIS, BLIGHTED_LANDS, DEADWOOD
    lootTemplateId: 44, // item_essencia_espiritual_3bffa
  },
];

/**
 * Atualiza o snapshot lowcode.snapshot.json com o terceiro lote de 10 monstros.
 */
export function updateSnapshotWithBatchThree() {
  if (!fs.existsSync(snapshotPath)) {
    console.error('Arquivo snapshot não encontrado em:', snapshotPath);
    return;
  }

  const snap = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));

  for (const m of batchThreeMonsters) {
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
  console.log('✅ [Snapshot] lowcode.snapshot.json atualizado com o terceiro lote de 10 monstros!');
}

/**
 * Insere os 10 novos monstros diretamente no PostgreSQL caso o PrismaClient esteja conectado.
 */
export async function seedBatchThreeIntoDatabase(prisma: PrismaClient) {
  console.log('🌱 Inserindo terceiro lote de 10 monstros e habilidades no banco de dados...');

  for (const m of batchThreeMonsters) {
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

  console.log('✅ Terceiro lote de 10 monstros, habilidades e biomas inseridos com sucesso!');
}

// Execução direta via CLI
if (process.argv[1] && process.argv[1].includes('seedBatchThreeMonsters')) {
  updateSnapshotWithBatchThree();
  const prisma = new PrismaClient();
  seedBatchThreeIntoDatabase(prisma)
    .catch((e) => {
      console.warn('Banco local offline ou inacessível (Snapshot JSON atualizado com sucesso):', e.message);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
