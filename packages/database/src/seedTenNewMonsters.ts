/**
 * @file packages/database/src/seedTenNewMonsters.ts
 * @module @etheria/database
 * @description Curadoria e Semeamento Procedural de 10 Novos Monstros (Ranks SS, S, A, B, C, D)
 *   com spritesheets visuais verificados do McRework, atributos procedurais equilibrados,
 *   habilidades ativas dedicadas com VFX e integração bidirecional no Snapshot JSON e PostgreSQL.
 * @rules
 *   - Regra #7: Arquivo estritamente < 1.000 linhas.
 *   - Não duplica monstros existentes (creature_000001 a creature_000023, creature_100017, etc.).
 *   - Imagens inspecionadas e validadas: somente monstros reais (criaturas, feras, demônios, dragões, espectros).
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const snapshotPath = path.resolve(__dirname, '../snapshots/lowcode.snapshot.json');

export interface NewMonsterDef {
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
    effectBlocks: any[];
  };
  biomes: number[];
  lootTemplateId: number;
}

export const TEN_NEW_MONSTERS: NewMonsterDef[] = [
  // -------------------------------------------------------------------------
  // 1. RANK SS: Ceifador Titânico das Sombras (creature_001088, 404x364px)
  // -------------------------------------------------------------------------
  {
    id: 18,
    code: 'monster_18',
    mcreworkMonsterKey: 'creature_001088',
    namePtBr: 'Ceifador Titânico das Sombras',
    descriptionPtBr: 'Uma abominação colossal armada com um machado forjado nas profundezas abissais. Seus golpes fatiam rochas e espalham chamas profanas.',
    raceCode: 'DEMON',
    fixedElementCode: 'FIRE',
    rarityTier: 'SS',
    combatStyle: 'MELEE',
    attackRange: 80,
    damageType: 'PHYSICAL',
    groundOffsetY: -8,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    baseAttributes: { STR: 32, VIT: 30, AGI: 12, DEX: 14, INT: 8, WIS: 8 },
    baseCombatAttributes: {
      BATTLE_MOVE_SPEED: 125,
      ATTACK_SPEED: 0.85,
      CRIT_RATE: 15,
      CRIT_DMG: 180,
      PHYS_ACCURACY: 105,
      MAG_ACCURACY: 95,
      PHYS_EVASION: 10,
      MAG_EVASION: 10,
    },
    skill: {
      id: 56,
      code: 'skill_mob_ruin_strike',
      namePtBr: 'Golpe Sísmico da Ruína',
      descriptionPtBr: 'Desfere um golpe devastador com seu machado colossal contra o solo, liberando uma onda de choque de chamas sombrias.',
      mcreworkIconKey: '10008',
      castActionId: 3,
      castMovement: 'MELEE_ADVANCE',
      mcreworkVfxKey: '10018',
      mpCost: 35,
      cooldownSeconds: 8.0,
      castRange: 90,
      aoeRadius: 80,
      targetScope: 'AOE_CIRCLE',
      effectBlocks: [
        {
          blockType: 'DAMAGE',
          damageType: 'PHYSICAL',
          scaleStat: 'PHYS_ATK',
          scalePct: 250,
          flatAmount: 35,
          critBonusPct: 15,
          elementCode: 'FIRE',
        },
      ],
    },
    biomes: [35, 29, 28], // DEMONIC_RIFT, LAVA_CALDERA, ASHLANDS
    lootTemplateId: 36, // item_essencia_demoniaca_oaod7
  },

  // -------------------------------------------------------------------------
  // 2. RANK SS: Imperador Glacial de Éter (creature_001083, 329x236px)
  // -------------------------------------------------------------------------
  {
    id: 19,
    code: 'monster_19',
    mcreworkMonsterKey: 'creature_001083',
    namePtBr: 'Imperador Glacial de Éter',
    descriptionPtBr: 'Um colosso colossal das profundezas de gelo eterno. Seus passos estremecem a terra e sua maça esmaga qualquer invasor.',
    raceCode: 'BEAST',
    fixedElementCode: 'WATER',
    rarityTier: 'SS',
    combatStyle: 'MELEE',
    attackRange: 85,
    damageType: 'PHYSICAL',
    groundOffsetY: -6,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    baseAttributes: { STR: 28, VIT: 36, AGI: 10, DEX: 12, INT: 12, WIS: 10 },
    baseCombatAttributes: {
      BATTLE_MOVE_SPEED: 115,
      ATTACK_SPEED: 0.80,
      CRIT_RATE: 12,
      CRIT_DMG: 175,
      PHYS_ACCURACY: 100,
      MAG_ACCURACY: 100,
      PHYS_EVASION: 8,
      MAG_EVASION: 14,
    },
    skill: {
      id: 57,
      code: 'skill_mob_glacial_slam',
      namePtBr: 'Impacto do Zero Absoluto',
      descriptionPtBr: 'Ergue sua maça colossal e a despenca sobre a terra, estilhaçando o solo em pontas de gelo e congelando o ar ao redor.',
      mcreworkIconKey: '10009',
      castActionId: 3,
      castMovement: 'MELEE_ADVANCE',
      mcreworkVfxKey: '419',
      mpCost: 40,
      cooldownSeconds: 7.5,
      castRange: 90,
      aoeRadius: 85,
      targetScope: 'AOE_CIRCLE',
      effectBlocks: [
        {
          blockType: 'DAMAGE',
          damageType: 'PHYSICAL',
          scaleStat: 'PHYS_ATK',
          scalePct: 240,
          flatAmount: 40,
          critBonusPct: 10,
          elementCode: 'WATER',
        },
      ],
    },
    biomes: [26, 27, 24], // ETERNAL_GLACIER, BLIZZARD_PEAK, FROZEN_TUNDRA
    lootTemplateId: 35, // item_essencia_de_selvagem_ghj3x
  },

  // -------------------------------------------------------------------------
  // 3. RANK S: Pyrodrake Carmesim (creature_001092, 212x171px)
  // -------------------------------------------------------------------------
  {
    id: 20,
    code: 'monster_20',
    mcreworkMonsterKey: 'creature_001092',
    namePtBr: 'Pyrodrake Carmesim',
    descriptionPtBr: 'Dragão alado soberano dos picos vulcânicos. Ele paira sobre o campo de batalha incinerando intrusos com jatos contínuos de magma ardente.',
    raceCode: 'DRAGON',
    fixedElementCode: 'FIRE',
    rarityTier: 'S',
    combatStyle: 'RANGED',
    attackRange: 160,
    damageType: 'MAGICAL',
    groundOffsetY: -4,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    baseAttributes: { STR: 18, VIT: 22, AGI: 16, DEX: 15, INT: 24, WIS: 14 },
    baseCombatAttributes: {
      BATTLE_MOVE_SPEED: 150,
      ATTACK_SPEED: 1.05,
      CRIT_RATE: 12,
      CRIT_DMG: 165,
      PHYS_ACCURACY: 98,
      MAG_ACCURACY: 104,
      PHYS_EVASION: 12,
      MAG_EVASION: 12,
    },
    skill: {
      id: 58,
      code: 'skill_mob_magma_breath',
      namePtBr: 'Sopro Ígneo de Magma',
      descriptionPtBr: 'O dragão sobrevoa e cospe uma labareda de fogo líquido de longo alcance, carbonizando as defesas inimigas.',
      mcreworkIconKey: '10018',
      castActionId: 7,
      castMovement: 'STAND_IN_PLACE',
      mcreworkVfxKey: '10002',
      mpCost: 30,
      cooldownSeconds: 6.0,
      castRange: 180,
      aoeRadius: 60,
      targetScope: 'CONE_FRONTAL',
      effectBlocks: [
        {
          blockType: 'DAMAGE',
          damageType: 'MAGICAL',
          scaleStat: 'MAG_ATK',
          scalePct: 210,
          flatAmount: 30,
          critBonusPct: 12,
          elementCode: 'FIRE',
        },
      ],
    },
    biomes: [29, 30, 28], // LAVA_CALDERA, STORM_PLATEAU, ASHLANDS
    lootTemplateId: 42,
  },

  // -------------------------------------------------------------------------
  // 4. RANK S: Leviathan do Abismo (creature_000045, 247x229px)
  // -------------------------------------------------------------------------
  {
    id: 21,
    code: 'monster_21',
    mcreworkMonsterKey: 'creature_000045',
    namePtBr: 'Leviathan do Abismo',
    descriptionPtBr: 'Serpente marinha ancestral que habita as fossas oceânicas mais profundas de Etheria. Seus ataques canalizam tsunamis de alta pressão.',
    raceCode: 'AQUATIC',
    fixedElementCode: 'WATER',
    rarityTier: 'S',
    combatStyle: 'MELEE',
    attackRange: 75,
    damageType: 'PHYSICAL',
    groundOffsetY: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    baseAttributes: { STR: 22, VIT: 25, AGI: 14, DEX: 16, INT: 18, WIS: 12 },
    baseCombatAttributes: {
      BATTLE_MOVE_SPEED: 140,
      ATTACK_SPEED: 1.00,
      CRIT_RATE: 10,
      CRIT_DMG: 160,
      PHYS_ACCURACY: 100,
      MAG_ACCURACY: 100,
      PHYS_EVASION: 10,
      MAG_EVASION: 12,
    },
    skill: {
      id: 59,
      code: 'skill_mob_abyssal_vortex',
      namePtBr: 'Vórtice das Fossas Abissais',
      descriptionPtBr: 'Gira seu corpo serpentino criando um redemoinho violento de alta pressão aquática que dilacera o oponente.',
      mcreworkIconKey: '10009',
      castActionId: 3,
      castMovement: 'MELEE_ADVANCE',
      mcreworkVfxKey: '10009',
      mpCost: 28,
      cooldownSeconds: 6.5,
      castRange: 80,
      aoeRadius: 70,
      targetScope: 'TARGET_PRIMARY',
      effectBlocks: [
        {
          blockType: 'DAMAGE',
          damageType: 'PHYSICAL',
          scaleStat: 'PHYS_ATK',
          scalePct: 190,
          flatAmount: 25,
          critBonusPct: 10,
          elementCode: 'WATER',
        },
      ],
    },
    biomes: [23, 22, 18], // ABYSSAL_TRENCH, CORAL_REEF, SEA_CLIFFS
    lootTemplateId: 41,
  },

  // -------------------------------------------------------------------------
  // 5. RANK A: Behemoth da Neve Eterna (creature_001086, 163x189px)
  // -------------------------------------------------------------------------
  {
    id: 22,
    code: 'monster_22',
    mcreworkMonsterKey: 'creature_001086',
    namePtBr: 'Behemoth da Neve Eterna',
    descriptionPtBr: 'Primata titânico de pelagem polar e crista carmesim. Seus punhos com braceletes de ferro cravado esmagam couraças com brutalidade.',
    raceCode: 'BEAST',
    fixedElementCode: 'EARTH',
    rarityTier: 'A',
    combatStyle: 'MELEE',
    attackRange: 65,
    damageType: 'PHYSICAL',
    groundOffsetY: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    baseAttributes: { STR: 22, VIT: 24, AGI: 12, DEX: 10, INT: 6, WIS: 6 },
    baseCombatAttributes: {
      BATTLE_MOVE_SPEED: 135,
      ATTACK_SPEED: 0.95,
      CRIT_RATE: 10,
      CRIT_DMG: 160,
      PHYS_ACCURACY: 96,
      MAG_ACCURACY: 90,
      PHYS_EVASION: 8,
      MAG_EVASION: 6,
    },
    skill: {
      id: 60,
      code: 'skill_mob_tundra_frenzy',
      namePtBr: 'Fúria Bruta da Tundra',
      descriptionPtBr: 'Entra em frenesi incontrolável, golpeando o solo e desferindo um impacto esmagador com seus punhos pesados.',
      mcreworkIconKey: '10011',
      castActionId: 3,
      castMovement: 'MELEE_ADVANCE',
      mcreworkVfxKey: '10015',
      mpCost: 22,
      cooldownSeconds: 5.5,
      castRange: 70,
      aoeRadius: 50,
      targetScope: 'TARGET_PRIMARY',
      effectBlocks: [
        {
          blockType: 'DAMAGE',
          damageType: 'PHYSICAL',
          scaleStat: 'PHYS_ATK',
          scalePct: 180,
          flatAmount: 20,
          critBonusPct: 10,
          elementCode: 'EARTH',
        },
      ],
    },
    biomes: [24, 25, 27], // FROZEN_TUNDRA, SNOWY_TAIGA, BLIZZARD_PEAK
    lootTemplateId: 35,
  },

  // -------------------------------------------------------------------------
  // 6. RANK A: Gárgula Wyvern dos Picos (creature_001091, 190x139px)
  // -------------------------------------------------------------------------
  {
    id: 23,
    code: 'monster_23',
    mcreworkMonsterKey: 'creature_001091',
    namePtBr: 'Gárgula Wyvern dos Picos',
    descriptionPtBr: 'Réptil alado veloz que embosca viajantes a partir de desfiladeiros rochosos. Suas asas produzem navalhas de ar pressurizado.',
    raceCode: 'REPTILIAN',
    fixedElementCode: 'AIR',
    rarityTier: 'A',
    combatStyle: 'RANGED',
    attackRange: 140,
    damageType: 'PHYSICAL',
    groundOffsetY: -4,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    baseAttributes: { STR: 18, VIT: 18, AGI: 18, DEX: 16, INT: 8, WIS: 8 },
    baseCombatAttributes: {
      BATTLE_MOVE_SPEED: 155,
      ATTACK_SPEED: 1.10,
      CRIT_RATE: 12,
      CRIT_DMG: 165,
      PHYS_ACCURACY: 102,
      MAG_ACCURACY: 95,
      PHYS_EVASION: 14,
      MAG_EVASION: 10,
    },
    skill: {
      id: 61,
      code: 'skill_mob_aerial_cleave',
      namePtBr: 'Lâminas de Vento Cortante',
      descriptionPtBr: 'Bate com vigor suas asas membranosas liberando rajadas afiadas de vento que perfuram armaduras à distância.',
      mcreworkIconKey: '10008',
      castActionId: 3,
      castMovement: 'STAND_IN_PLACE',
      mcreworkVfxKey: '10010',
      mpCost: 20,
      cooldownSeconds: 5.0,
      castRange: 150,
      aoeRadius: 40,
      targetScope: 'TARGET_PRIMARY',
      effectBlocks: [
        {
          blockType: 'DAMAGE',
          damageType: 'PHYSICAL',
          scaleStat: 'PHYS_ATK',
          scalePct: 175,
          flatAmount: 20,
          critBonusPct: 10,
          elementCode: 'AIR',
        },
      ],
    },
    biomes: [30, 13, 12], // STORM_PLATEAU, ALPINE_HIGHLANDS, ROCKY_CANYON
    lootTemplateId: 43, // item_essencia_reptiliana_wv5uc
  },

  // -------------------------------------------------------------------------
  // 7. RANK B: Dente-de-Sabre das Planícies (creature_000052, 150x110px)
  // -------------------------------------------------------------------------
  {
    id: 24,
    code: 'monster_24',
    mcreworkMonsterKey: 'creature_000052',
    namePtBr: 'Dente-de-Sabre das Planícies',
    descriptionPtBr: 'Predador felino ágil e territorial. Sua aceleração explosiva e mordida esmagadora derrubam presas maiores com rapidez.',
    raceCode: 'BEAST',
    fixedElementCode: 'EARTH',
    rarityTier: 'B',
    combatStyle: 'MELEE',
    attackRange: 55,
    damageType: 'PHYSICAL',
    groundOffsetY: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    baseAttributes: { STR: 18, VIT: 16, AGI: 16, DEX: 14, INT: 5, WIS: 6 },
    baseCombatAttributes: {
      BATTLE_MOVE_SPEED: 150,
      ATTACK_SPEED: 1.05,
      CRIT_RATE: 8,
      CRIT_DMG: 155,
      PHYS_ACCURACY: 98,
      MAG_ACCURACY: 90,
      PHYS_EVASION: 10,
      MAG_EVASION: 6,
    },
    skill: {
      id: 62,
      code: 'skill_mob_pounce_tear',
      namePtBr: 'Salto Dilacerador',
      descriptionPtBr: 'Salta de repente cravando suas garras e presas, rasgando as defesas do oponente.',
      mcreworkIconKey: '10008',
      castActionId: 3,
      castMovement: 'MELEE_ADVANCE',
      mcreworkVfxKey: '10008',
      mpCost: 16,
      cooldownSeconds: 4.5,
      castRange: 65,
      aoeRadius: 0,
      targetScope: 'TARGET_PRIMARY',
      effectBlocks: [
        {
          blockType: 'DAMAGE',
          damageType: 'PHYSICAL',
          scaleStat: 'PHYS_ATK',
          scalePct: 160,
          flatAmount: 18,
          critBonusPct: 8,
          elementCode: 'EARTH',
        },
      ],
    },
    biomes: [1, 9, 2], // VERDANT_PLAINS, DRY_STEPPES, TEMPERATE_WOODS
    lootTemplateId: 35,
  },

  // -------------------------------------------------------------------------
  // 8. RANK B: Banshee das Marés Espectrais (creature_000040, 197x190px)
  // -------------------------------------------------------------------------
  {
    id: 25,
    code: 'monster_25',
    mcreworkMonsterKey: 'creature_000040',
    namePtBr: 'Banshee das Marés Espectrais',
    descriptionPtBr: 'Aparição etérea flutuante envolta em névoa condensada. Seus lamentos mágicos perturbam a mente e causam paralisia nos viajantes.',
    raceCode: 'SPIRIT',
    fixedElementCode: 'WATER',
    rarityTier: 'B',
    combatStyle: 'RANGED',
    attackRange: 150,
    damageType: 'MAGICAL',
    groundOffsetY: -4,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    baseAttributes: { STR: 8, VIT: 14, AGI: 14, DEX: 14, INT: 20, WIS: 16 },
    baseCombatAttributes: {
      BATTLE_MOVE_SPEED: 130,
      ATTACK_SPEED: 0.95,
      CRIT_RATE: 8,
      CRIT_DMG: 150,
      PHYS_ACCURACY: 92,
      MAG_ACCURACY: 102,
      PHYS_EVASION: 12,
      MAG_EVASION: 14,
    },
    skill: {
      id: 63,
      code: 'skill_mob_spectral_wail',
      namePtBr: 'Lamento Espectral das Marés',
      descriptionPtBr: 'Solta um grito ressonante através das névoas, drenando a concentração e infligindo dano mágico direto.',
      mcreworkIconKey: '10009',
      castActionId: 7,
      castMovement: 'STAND_IN_PLACE',
      mcreworkVfxKey: '302',
      mpCost: 18,
      cooldownSeconds: 5.0,
      castRange: 160,
      aoeRadius: 45,
      targetScope: 'TARGET_PRIMARY',
      effectBlocks: [
        {
          blockType: 'DAMAGE',
          damageType: 'MAGICAL',
          scaleStat: 'MAG_ATK',
          scalePct: 165,
          flatAmount: 16,
          critBonusPct: 8,
          elementCode: 'WATER',
        },
      ],
    },
    biomes: [19, 20, 21], // MISTY_SWAMP, POISON_MANGROVE, MIRROR_LAKE
    lootTemplateId: 44, // item_essencia_espiritual_3bffa
  },

  // -------------------------------------------------------------------------
  // 9. RANK C: Escorpião Púrpura Venenoso (creature_000043, 131x112px)
  // -------------------------------------------------------------------------
  {
    id: 26,
    code: 'monster_26',
    mcreworkMonsterKey: 'creature_000043',
    namePtBr: 'Escorpião Púrpura Venenoso',
    descriptionPtBr: 'Aracnídeo gigante de carapaça resistente e ferrão bulboso. Habita cavernas e ruínas onde inocula neurotoxinas altamente corrosivas.',
    raceCode: 'BEAST',
    fixedElementCode: 'EARTH',
    rarityTier: 'C',
    combatStyle: 'MELEE',
    attackRange: 45,
    damageType: 'PHYSICAL',
    groundOffsetY: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    baseAttributes: { STR: 14, VIT: 16, AGI: 12, DEX: 12, INT: 6, WIS: 5 },
    baseCombatAttributes: {
      BATTLE_MOVE_SPEED: 125,
      ATTACK_SPEED: 0.95,
      CRIT_RATE: 7,
      CRIT_DMG: 150,
      PHYS_ACCURACY: 95,
      MAG_ACCURACY: 90,
      PHYS_EVASION: 8,
      MAG_EVASION: 6,
    },
    skill: {
      id: 64,
      code: 'skill_mob_toxic_sting',
      namePtBr: 'Ferrão de Neurotoxina',
      descriptionPtBr: 'Desfere uma ferroada rápida e certeira com sua cauda, injetando veneno que enfraquece a defesa do alvo.',
      mcreworkIconKey: '10018',
      castActionId: 3,
      castMovement: 'MELEE_ADVANCE',
      mcreworkVfxKey: '307',
      mpCost: 14,
      cooldownSeconds: 4.0,
      castRange: 55,
      aoeRadius: 0,
      targetScope: 'TARGET_PRIMARY',
      effectBlocks: [
        {
          blockType: 'DAMAGE',
          damageType: 'PHYSICAL',
          scaleStat: 'PHYS_ATK',
          scalePct: 145,
          flatAmount: 14,
          critBonusPct: 7,
          elementCode: 'EARTH',
        },
      ],
    },
    biomes: [10, 14, 16], // SAND_DUNES, DEEP_CAVERN, BADLANDS
    lootTemplateId: 35,
  },

  // -------------------------------------------------------------------------
  // 10. RANK D: Jiangshi das Catacumbas (creature_000027, 87x108px)
  // -------------------------------------------------------------------------
  {
    id: 27,
    code: 'monster_27',
    mcreworkMonsterKey: 'creature_000027',
    namePtBr: 'Jiangshi das Catacumbas',
    descriptionPtBr: 'Cadáver imperial preservado por talismãs ancestrais. Salta rigidamente em direção aos vivos para drenar o Qi e a vitalidade espiritual.',
    raceCode: 'DEMON',
    fixedElementCode: 'NEUTRAL',
    rarityTier: 'D',
    combatStyle: 'MELEE',
    attackRange: 40,
    damageType: 'PHYSICAL',
    groundOffsetY: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    baseAttributes: { STR: 12, VIT: 14, AGI: 8, DEX: 10, INT: 8, WIS: 6 },
    baseCombatAttributes: {
      BATTLE_MOVE_SPEED: 110,
      ATTACK_SPEED: 0.90,
      CRIT_RATE: 5,
      CRIT_DMG: 150,
      PHYS_ACCURACY: 94,
      MAG_ACCURACY: 92,
      PHYS_EVASION: 6,
      MAG_EVASION: 8,
    },
    skill: {
      id: 65,
      code: 'skill_mob_qi_drain',
      namePtBr: 'Drenagem de Qi Vital',
      descriptionPtBr: 'Estende as mãos rígidas e canaliza a energia vital do adversário, recuperando a própria energia mórbida.',
      mcreworkIconKey: '10008',
      castActionId: 3,
      castMovement: 'MELEE_ADVANCE',
      mcreworkVfxKey: '302',
      mpCost: 12,
      cooldownSeconds: 4.0,
      castRange: 50,
      aoeRadius: 0,
      targetScope: 'TARGET_PRIMARY',
      effectBlocks: [
        {
          blockType: 'DAMAGE',
          damageType: 'PHYSICAL',
          scaleStat: 'PHYS_ATK',
          scalePct: 130,
          flatAmount: 10,
          critBonusPct: 5,
          lifestealPct: 20,
          elementCode: 'NEUTRAL',
        },
      ],
    },
    biomes: [33, 32, 37], // ANCIENT_NECROPOLIS, DEADWOOD, ANCIENT_RUINS
    lootTemplateId: 36, // item_essencia_demoniaca_oaod7
  },
];

/**
 * Atualiza o arquivo de Snapshot JSON com os 10 novos monstros e suas habilidades
 */
export function updateSnapshotWithNewMonsters(): void {
  if (!fs.existsSync(snapshotPath)) {
    console.error('Snapshot file not found at:', snapshotPath);
    return;
  }

  const raw = fs.readFileSync(snapshotPath, 'utf-8');
  const snapshot = JSON.parse(raw);

  // 1. Adiciona i18n
  const existingTranslations = new Map<string, any>(snapshot.i18nTranslations.map((t: any) => [`${t.key}_${t.locale}`, t]));
  let nextTransId = Math.max(...snapshot.i18nTranslations.map((t: any) => t.id || 0), 1000);

  function ensureI18n(key: string, text: string) {
    const mapKey = `${key}_pt-BR`;
    if (!existingTranslations.has(mapKey)) {
      const entry = {
        id: ++nextTransId,
        locale: 'pt-BR',
        key,
        text,
        updatedAt: new Date().toISOString(),
      };
      snapshot.i18nTranslations.push(entry);
      existingTranslations.set(mapKey, entry);
    } else {
      const existing = existingTranslations.get(mapKey);
      if (existing) existing.text = text;
    }
  }

  // 2. Adiciona Skills
  const existingSkillIds = new Set(snapshot.skillTemplates.map((s: any) => s.id));
  const existingSkillCodes = new Set(snapshot.skillTemplates.map((s: any) => s.code));

  for (const m of TEN_NEW_MONSTERS) {
    const sk = m.skill;
    const nameKey = `skill.${sk.code}.name`;
    const descKey = `skill.${sk.code}.description`;
    ensureI18n(nameKey, sk.namePtBr);
    ensureI18n(descKey, sk.descriptionPtBr);

    if (!existingSkillIds.has(sk.id) && !existingSkillCodes.has(sk.code)) {
      snapshot.skillTemplates.push({
        id: sk.id,
        code: sk.code,
        nameI18nKey: nameKey,
        descriptionI18nKey: descKey,
        mcreworkIconKey: sk.mcreworkIconKey,
        castActionId: sk.castActionId,
        castMovement: sk.castMovement,
        mcreworkVfxKey: sk.mcreworkVfxKey,
        vfxColorHex: null,
        vfxColorIntensity: 100,
        skillType: 'ACTIVE',
        triggerType: 'MANUAL',
        mpCost: sk.mpCost,
        apCost: 2,
        cooldownSeconds: sk.cooldownSeconds,
        cooldownTurns: 0,
        castRange: sk.castRange,
        aoeRadius: sk.aoeRadius,
        coneAngleDeg: 90,
        lineWidthPx: 48,
        groundZoneDurationSec: 0,
        groundZoneTickSec: 1,
        ignoreEvasion: false,
        targetScope: sk.targetScope,
        hitCount: 1,
        effectBlocksJson: sk.effectBlocks,
        isActive: true,
      });
      existingSkillIds.add(sk.id);
      existingSkillCodes.add(sk.code);
    }
  }

  // 3. Adiciona Monstros
  const existingMobIds = new Set(snapshot.monsterTemplates.map((mob: any) => mob.id));
  const existingMobCodes = new Set(snapshot.monsterTemplates.map((mob: any) => mob.code));

  for (const m of TEN_NEW_MONSTERS) {
    const mobNameKey = `monster.${m.code}.name`;
    const mobDescKey = `monster.${m.code}.description`;
    ensureI18n(mobNameKey, m.namePtBr);
    ensureI18n(mobDescKey, m.descriptionPtBr);

    const existing = snapshot.monsterTemplates.find((mob: any) => mob.id === m.id);
    if (!existing) {
      snapshot.monsterTemplates.push({
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
        skillIdsJson: [m.skill.id],
        lootTableJson: [
          { itemTemplateId: m.lootTemplateId, minQty: 1, maxQty: 1, chancePct: 80 },
        ],
        isActive: true,
      });
      existingMobIds.add(m.id);
      existingMobCodes.add(m.code);
    } else {
      existing.groundOffsetY = m.groundOffsetY;
      existing.shadowOffsetX = m.shadowOffsetX ?? 0;
      existing.shadowOffsetY = m.shadowOffsetY ?? 0;
      existing.lootTableJson = [
        { itemTemplateId: m.lootTemplateId, minQty: 1, maxQty: 1, chancePct: 80 },
      ];
    }
  }

  // 4. Adiciona Vínculos com Biomas
  const existingBiomes = new Set(snapshot.monsterBiomes.map((mb: any) => `${mb.monsterTemplateId}_${mb.biomeId}`));
  let nextMbId = Math.max(...snapshot.monsterBiomes.map((mb: any) => mb.id || 0), 100);

  for (const m of TEN_NEW_MONSTERS) {
    for (const bId of m.biomes) {
      const key = `${m.id}_${bId}`;
      if (!existingBiomes.has(key)) {
        snapshot.monsterBiomes.push({
          id: ++nextMbId,
          monsterTemplateId: m.id,
          biomeId: bId,
        });
        existingBiomes.add(key);
      }
    }
  }

  snapshot.exportedAt = new Date().toISOString();
  fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf-8');
  console.log(`✅ [Snapshot] lowcode.snapshot.json atualizado com 10 novos monstros e habilidades!`);
}

/**
 * Insere diretamente no banco via Prisma Client
 */
export async function seedMonstersIntoDatabase(prisma: PrismaClient): Promise<void> {
  console.log('🌱 Inserindo 10 novos monstros e habilidades no banco de dados...');

  for (const m of TEN_NEW_MONSTERS) {
    const sk = m.skill;
    const skillNameKey = `skill.${sk.code}.name`;
    const skillDescKey = `skill.${sk.code}.description`;
    const mobNameKey = `monster.${m.code}.name`;
    const mobDescKey = `monster.${m.code}.description`;

    // i18n
    await prisma.i18nTranslation.upsert({
      where: { key_locale: { key: skillNameKey, locale: 'pt-BR' } },
      create: { locale: 'pt-BR', key: skillNameKey, text: sk.namePtBr },
      update: { text: sk.namePtBr },
    });
    await prisma.i18nTranslation.upsert({
      where: { key_locale: { key: skillDescKey, locale: 'pt-BR' } },
      create: { locale: 'pt-BR', key: skillDescKey, text: sk.descriptionPtBr },
      update: { text: sk.descriptionPtBr },
    });
    await prisma.i18nTranslation.upsert({
      where: { key_locale: { key: mobNameKey, locale: 'pt-BR' } },
      create: { locale: 'pt-BR', key: mobNameKey, text: m.namePtBr },
      update: { text: m.namePtBr },
    });
    await prisma.i18nTranslation.upsert({
      where: { key_locale: { key: mobDescKey, locale: 'pt-BR' } },
      create: { locale: 'pt-BR', key: mobDescKey, text: m.descriptionPtBr },
      update: { text: m.descriptionPtBr },
    });

    // Skill
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
        vfxColorHex: null,
        vfxColorIntensity: 100,
        skillType: 'ACTIVE',
        triggerType: 'MANUAL',
        mpCost: sk.mpCost,
        apCost: 2,
        cooldownSeconds: sk.cooldownSeconds,
        castRange: sk.castRange,
        aoeRadius: sk.aoeRadius,
        coneAngleDeg: 90,
        lineWidthPx: 48,
        groundZoneDurationSec: 0,
        groundZoneTickSec: 1,
        ignoreEvasion: false,
        targetScope: sk.targetScope,
        hitCount: 1,
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

  console.log('✅ Todos os 10 monstros, habilidades e biomas inseridos com sucesso!');
}

// Auto-execução ao rodar diretamente via CLI
if (process.argv[1] && process.argv[1].includes('seedTenNewMonsters')) {
  updateSnapshotWithNewMonsters();
  const prisma = new PrismaClient();
  seedMonstersIntoDatabase(prisma)
    .catch((e) => {
      console.warn('Banco local offline ou inacessível (Snapshot JSON atualizado com sucesso):', e.message);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
