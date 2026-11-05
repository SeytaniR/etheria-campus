/**
 * @file packages/database/src/seedData.ts
 * @module @etheria/database
 * @description Dados fundamentais e imutáveis de fundação do Etheria Campus:
 *   - 40 Biomas (exclusivos para cruzamento procedural de spawn Mapa <-> Bioma <-> Monstro)
 *   - 5 Tipos de Mapa (com dominação de Alianças/Facções, spawn e PvP fixos)
 *   - 5 Elementos (Fogo, Terra, Ar, Água e Neutro penalizado) + Matriz de Confronto (±25%)
 *   - 11 Raças (Humanos + Ciclo de 10 Raças) + Matriz de Vantagem (+10%)
 *   - 6 Atributos Base, 16 Atributos de Combate e Matriz de Derivação Procedural
 *   - 16 Slots de Equipamento de Personagem (incluindo Cinto) + 6 Slots de Pet
 *   - 6 Raridades de Monstros/Pets
 * @rules Segue estritamente docs/ARCHITECTURE.md e docs/DATABASE_SCHEMA.md.
 */

export interface InitialBiomeSeed {
  code: string;
  category: string;
  namePtBr: string;
  descriptionPtBr: string;
}

/**
 * Lista oficial dos 40 Biomas para o vínculo procedural Mapa <-> Bioma <-> Monstro.
 */
export const INITIAL_BIOMES: InitialBiomeSeed[] = [
  // Grupo 1: Florestais & Botânicos (1 a 8)
  { code: 'VERDANT_PLAINS', category: 'FOREST', namePtBr: 'Planície Verdejante', descriptionPtBr: 'Campos abertos de grama baixa, vento leve e clima ameno.' },
  { code: 'TEMPERATE_WOODS', category: 'FOREST', namePtBr: 'Bosque Temperado', descriptionPtBr: 'Árvores espaçadas com luz solar filtrada, trilhas claras e fauna silvestre.' },
  { code: 'DENSE_FOREST', category: 'FOREST', namePtBr: 'Floresta Densa', descriptionPtBr: 'Vegetação fechada de árvores antigas e copas altas, lar de predadores e espíritos.' },
  { code: 'TROPICAL_JUNGLE', category: 'FOREST', namePtBr: 'Selva Tropical', descriptionPtBr: 'Mata úmida, cipós, plantas carnívoras gigantes e répteis tropicais.' },
  { code: 'BAMBOO_GROVE', category: 'FOREST', namePtBr: 'Floresta de Bambu', descriptionPtBr: 'Bosques orientais altos e silenciosos, lar de feras ágeis e mestres marciais.' },
  { code: 'FAIRY_GARDEN', category: 'FOREST', namePtBr: 'Jardim Feérico', descriptionPtBr: 'Floresta encantada com flores gigantes luminescentes e criaturas fadas.' },
  { code: 'AUTUMN_WOODS', category: 'FOREST', namePtBr: 'Bosque Outonal', descriptionPtBr: 'Floresta de folhas douradas e vermelhas em queda constante.' },
  { code: 'GIANT_ROOTS', category: 'FOREST', namePtBr: 'Raízes Gigantes', descriptionPtBr: 'Sub-bosque formado pelas raízes colossais de uma Árvore do Mundo.' },

  // Grupo 2: Áridos, Rochosos & Montanhosos (9 a 16)
  { code: 'DRY_STEPPES', category: 'ARID', namePtBr: 'Estepes Secas', descriptionPtBr: 'Terras áridas de vegetação rasteira amarelada e ventos fortes.' },
  { code: 'SAND_DUNES', category: 'ARID', namePtBr: 'Deserto de Dunas', descriptionPtBr: 'Mar de areia escaldante com tempestades solares e feras do deserto.' },
  { code: 'HIDDEN_OASIS', category: 'ARID', namePtBr: 'Oásis Escondido', descriptionPtBr: 'Refúgio fértil de água cristalina e palmeiras no meio do deserto.' },
  { code: 'ROCKY_CANYON', category: 'ARID', namePtBr: 'Cânion Rochoso', descriptionPtBr: 'Desfiladeiros estreitos de pedra avermelhada e pontes suspensas.' },
  { code: 'ALPINE_HIGHLANDS', category: 'ARID', namePtBr: 'Cordilheira Alpina', descriptionPtBr: 'Montanhas altas de pedra fria, ar rarefeito e feras aladas.' },
  { code: 'DEEP_CAVERN', category: 'ARID', namePtBr: 'Caverna Subterrânea', descriptionPtBr: 'Túneis escuros de pedra úmida, estalactites e criaturas subterrâneas.' },
  { code: 'CRYSTAL_MINE', category: 'ARID', namePtBr: 'Mina de Cristais', descriptionPtBr: 'Grutas iluminadas por veios de minérios raros e cristais mágicos.' },
  { code: 'BADLANDS', category: 'ARID', namePtBr: 'Terras Devastadas', descriptionPtBr: 'Solo rachado, seco e hostil, sem vegetação.' },

  // Grupo 3: Aquáticos, Costeiros & Pântanos (17 a 23)
  { code: 'TROPICAL_COAST', category: 'AQUATIC', namePtBr: 'Costa Tropical', descriptionPtBr: 'Praias de areia clara, recifes rasos e criaturas costeiras.' },
  { code: 'SEA_CLIFFS', category: 'AQUATIC', namePtBr: 'Penhasco Marítimo', descriptionPtBr: 'Rochas costeiras açoitadas por ondas violentas e tempestades marinhas.' },
  { code: 'MISTY_SWAMP', category: 'AQUATIC', namePtBr: 'Pântano Nebuloso', descriptionPtBr: 'Águas paradas e lamacentas cobertas por neblina densa.' },
  { code: 'POISON_MANGROVE', category: 'AQUATIC', namePtBr: 'Manguezal Venenoso', descriptionPtBr: 'Charco tóxico de águas esverdeadas, esporos venenosos e plantas putrefatas.' },
  { code: 'MIRROR_LAKE', category: 'AQUATIC', namePtBr: 'Lago Espelhado', descriptionPtBr: 'Margens de grandes lagos serenos e mágicos.' },
  { code: 'CORAL_REEF', category: 'AQUATIC', namePtBr: 'Recife de Corais', descriptionPtBr: 'Ambiente repleto de corais coloridos e criaturas marinhas exóticas.' },
  { code: 'ABYSSAL_TRENCH', category: 'AQUATIC', namePtBr: 'Fenda Abissal', descriptionPtBr: 'Profundezas oceânicas escuras sob imensa pressão.' },

  // Grupo 4: Gélidos & Polares (24 a 27)
  { code: 'FROZEN_TUNDRA', category: 'GLACIAL', namePtBr: 'Tundra Congelada', descriptionPtBr: 'Planícies cobertas de geada, neve rasa e ventos cortantes.' },
  { code: 'SNOWY_TAIGA', category: 'GLACIAL', namePtBr: 'Floresta Boreal Nevada', descriptionPtBr: 'Pinheiros cobertos de neve pesada e predadores glaciais.' },
  { code: 'ETERNAL_GLACIER', category: 'GLACIAL', namePtBr: 'Geleira Eterna', descriptionPtBr: 'Paredes e pontes de gelo puro e translúcido.' },
  { code: 'BLIZZARD_PEAK', category: 'GLACIAL', namePtBr: 'Pico da Nevasca', descriptionPtBr: 'Topo de montanha sob tempestade de neve perpétua.' },

  // Grupo 5: Vulcânicos & Elementais (28 a 31)
  { code: 'ASHLANDS', category: 'VOLCANIC', namePtBr: 'Campos de Cinzas', descriptionPtBr: 'Terra coberta por fuligem vulcânica cinzenta e fumaça sulfúrica.' },
  { code: 'LAVA_CALDERA', category: 'VOLCANIC', namePtBr: 'Caldeira de Lava', descriptionPtBr: 'Rios de magma incandescente e rocha derretida.' },
  { code: 'STORM_PLATEAU', category: 'VOLCANIC', namePtBr: 'Platô das Tempestades', descriptionPtBr: 'Região elevada constantemente atingida por raios e ventos.' },
  { code: 'FLOATING_ISLANDS', category: 'VOLCANIC', namePtBr: 'Ilhas Flutuantes', descriptionPtBr: 'Fragmentos de terra suspensos no céu por magia gravitacional.' },

  // Grupo 6: Sombrios, Mortos-Vivos & Corrompidos (32 a 35)
  { code: 'DEADWOOD', category: 'UNDEAD', namePtBr: 'Floresta Morta', descriptionPtBr: 'Árvores secas e retorcidas sob noite eterna.' },
  { code: 'ANCIENT_NECROPOLIS', category: 'UNDEAD', namePtBr: 'Necrópole Antiga', descriptionPtBr: 'Cemitérios monumentais, mausoléus e espíritos antigos.' },
  { code: 'BLIGHTED_LANDS', category: 'UNDEAD', namePtBr: 'Terras Corrompidas', descriptionPtBr: 'Solo contaminado por miasma e criaturas corrompidas.' },
  { code: 'DEMONIC_RIFT', category: 'UNDEAD', namePtBr: 'Fenda Demoníaca', descriptionPtBr: 'Território dimensional rasgado pelo submundo.' },

  // Grupo 7: Arcanos, Acadêmicos & Ruínas (36 a 40)
  { code: 'ACADEMY_GROUNDS', category: 'ARCANE', namePtBr: 'Jardins da Academia', descriptionPtBr: 'Pátios pavimentados, fontes mágicas e arquitetura clássica do Campus.' },
  { code: 'ANCIENT_RUINS', category: 'ARCANE', namePtBr: 'Ruínas Ancestrais', descriptionPtBr: 'Templos de pedra cobertos de musgo de uma civilização perdida.' },
  { code: 'ASTRAL_SANCTUARY', category: 'ARCANE', namePtBr: 'Santuário Astral', descriptionPtBr: 'Dimensão etérea com céu estrelado e energia cósmica.' },
  { code: 'CLOCKWORK_FORGE', category: 'ARCANE', namePtBr: 'Forja Mecânica', descriptionPtBr: 'Complexo de engrenagens a vapor e magia tecno-arcana.' },
  { code: 'CELESTIAL_PALACE', category: 'ARCANE', namePtBr: 'Palácio Celestial', descriptionPtBr: 'Salões de mármore branco e ouro acima das nuvens.' },
];

/**
 * Os 5 Tipos de Mapa com regras de Dominação, Spawn e PvP fixadas.
 */
export const INITIAL_MAP_TYPES = [
  {
    code: 'CITY',
    namePtBr: 'Cidade',
    dominationTarget: 'ALLIANCE',
    allowMonsterSpawn: false,
    pvpRule: 'DUEL_ONLY',
    forcesCriminalStatus: false,
  },
  {
    code: 'VILLAGE',
    namePtBr: 'Vila',
    dominationTarget: 'ALLIANCE',
    allowMonsterSpawn: false,
    pvpRule: 'DUEL_ONLY',
    forcesCriminalStatus: false,
  },
  {
    code: 'SUBURB',
    namePtBr: 'Subúrbio',
    dominationTarget: 'FACTION',
    allowMonsterSpawn: true,
    pvpRule: 'DUEL_ONLY',
    forcesCriminalStatus: false,
  },
  {
    code: 'HOSTILE_ZONE',
    namePtBr: 'Zona Hostil',
    dominationTarget: 'FACTION',
    allowMonsterSpawn: true,
    pvpRule: 'FORCED_PK',
    forcesCriminalStatus: true,
  },
  {
    code: 'CONFLICT_ZONE',
    namePtBr: 'Zona de Conflito',
    dominationTarget: 'FACTION',
    allowMonsterSpawn: true,
    pvpRule: 'OPEN_PVP',
    forcesCriminalStatus: false,
  },
];

/**
 * Os 5 Elementos (Sem Luz/Escuridão; Neutro penalizado).
 */
export const INITIAL_ELEMENTS = [
  { code: 'FIRE', namePtBr: 'Fogo', initialRollChance: 0.20 },
  { code: 'EARTH', namePtBr: 'Terra', initialRollChance: 0.20 },
  { code: 'AIR', namePtBr: 'Ar', initialRollChance: 0.20 },
  { code: 'WATER', namePtBr: 'Água', initialRollChance: 0.20 },
  { code: 'NEUTRAL', namePtBr: 'Neutro', initialRollChance: 0.10 },
];

/**
 * Gera a matriz completa 5x5 de multiplicadores de Elementos:
 * - Ciclo Ativo (+25% / -25%): FIRE > EARTH > AIR > WATER > FIRE
 * - NEUTRAL: causa -25% (0.75x) contra todos e sofre +25% (1.25x) de todos os elementos ativos.
 */
export function buildElementMatchups(): Array<{ attackerElementCode: string; defenderElementCode: string; damageMultiplier: number }> {
  const codes = ['FIRE', 'EARTH', 'AIR', 'WATER', 'NEUTRAL'];
  const beats: Record<string, string> = {
    FIRE: 'EARTH',
    EARTH: 'AIR',
    AIR: 'WATER',
    WATER: 'FIRE',
  };

  const matchups: Array<{ attackerElementCode: string; defenderElementCode: string; damageMultiplier: number }> = [];

  for (const attacker of codes) {
    for (const defender of codes) {
      let mult = 1.0;
      if (attacker === 'NEUTRAL') {
        mult = 0.75; // Neutro sempre causa 25% a menos de dano
      } else if (defender === 'NEUTRAL') {
        mult = 1.25; // Neutro sempre sofre 25% a mais de dano
      } else if (beats[attacker] === defender) {
        mult = 1.25; // Vantagem elemental (+25%)
      } else if (beats[defender] === attacker) {
        mult = 0.75; // Desvantagem elemental (-25%)
      }
      matchups.push({ attackerElementCode: attacker, defenderElementCode: defender, damageMultiplier: mult });
    }
  }
  return matchups;
}

/**
 * As 11 Raças oficiais do jogo.
 */
export const INITIAL_RACES = [
  { code: 'HUMAN', namePtBr: 'Humano' },
  { code: 'PLANT', namePtBr: 'Planta' },
  { code: 'DRAGON', namePtBr: 'Dragão' },
  { code: 'REPTILIAN', namePtBr: 'Reptiliano' },
  { code: 'AQUATIC', namePtBr: 'Aquático' },
  { code: 'ROBOTIC', namePtBr: 'Robótico' },
  { code: 'CELESTIAL', namePtBr: 'Celestial' },
  { code: 'DEMON', namePtBr: 'Demônio' },
  { code: 'FAIRY', namePtBr: 'Fada' },
  { code: 'SPIRIT', namePtBr: 'Espírito' },
  { code: 'BEAST', namePtBr: 'Selvagem' },
];

/**
 * Gera a matriz de vantagem racial (+10%):
 * - HUMAN tem +10% (1.10x) sobre todas as outras 10 raças.
 * - Ciclo das 10 raças (+10%): PLANT > DRAGON > REPTILIAN > AQUATIC > ROBOTIC > CELESTIAL > DEMON > FAIRY > SPIRIT > BEAST > PLANT.
 */
export function buildRaceMatchups(): Array<{ attackerRaceCode: string; defenderRaceCode: string; damageMultiplier: number }> {
  const allRaces = INITIAL_RACES.map((r) => r.code);
  const cycle = ['PLANT', 'DRAGON', 'REPTILIAN', 'AQUATIC', 'ROBOTIC', 'CELESTIAL', 'DEMON', 'FAIRY', 'SPIRIT', 'BEAST'];
  const beats: Record<string, string> = {};
  for (let i = 0; i < cycle.length; i++) {
    beats[cycle[i]] = cycle[(i + 1) % cycle.length];
  }

  const matchups: Array<{ attackerRaceCode: string; defenderRaceCode: string; damageMultiplier: number }> = [];
  for (const attacker of allRaces) {
    for (const defender of allRaces) {
      let mult = 1.0;
      if (attacker === 'HUMAN' && defender !== 'HUMAN') {
        mult = 1.10;
      } else if (defender === 'HUMAN' && attacker !== 'HUMAN') {
        mult = 0.90;
      } else if (beats[attacker] === defender) {
        mult = 1.10;
      } else if (beats[defender] === attacker) {
        mult = 0.90;
      }
      matchups.push({ attackerRaceCode: attacker, defenderRaceCode: defender, damageMultiplier: mult });
    }
  }
  return matchups;
}

/**
 * Os 6 Atributos Base.
 */
export const INITIAL_BASE_ATTRIBUTES = [
  { code: 'VIT', namePtBr: 'Vitalidade', descriptionPtBr: 'Aumenta o HP Máximo, a Defesa Física e a Resistência a efeitos contínuos.' },
  { code: 'STR', namePtBr: 'Força', descriptionPtBr: 'Aumenta o Ataque Físico, a Penetração Física e o Dano Crítico.' },
  { code: 'INT', namePtBr: 'Inteligência', descriptionPtBr: 'Aumenta o Ataque Mágico, o MP Máximo e a Penetração Mágica.' },
  { code: 'WIS', namePtBr: 'Sabedoria', descriptionPtBr: 'Aumenta o Poder de Cura/Escudo, a Defesa Mágica e a Regeneração de MP.' },
  { code: 'AGI', namePtBr: 'Agilidade', descriptionPtBr: 'Aumenta a Velocidade de Iniciativa no Turno, a Esquiva e o Ataque Físico Leve.' },
  { code: 'DEX', namePtBr: 'Destreza', descriptionPtBr: 'Aumenta a Chance Crítica, a Precisão e a Chance de Aplicar Debuffs.' },
];

/**
 * Os 16 Atributos Derivados de Combate.
 */
export const INITIAL_COMBAT_ATTRIBUTES = [
  { code: 'MAX_HP', namePtBr: 'HP Máximo', baseDefault: 120, isPercentage: false },
  { code: 'MAX_MP', namePtBr: 'MP Máximo', baseDefault: 60, isPercentage: false },
  { code: 'PHYS_ATK', namePtBr: 'Ataque Físico', baseDefault: 15, isPercentage: false },
  { code: 'MAG_ATK', namePtBr: 'Ataque Mágico', baseDefault: 15, isPercentage: false },
  { code: 'PHYS_DEF', namePtBr: 'Defesa Física', baseDefault: 10, isPercentage: false },
  { code: 'MAG_DEF', namePtBr: 'Defesa Mágica', baseDefault: 10, isPercentage: false },
  { code: 'PHYS_PEN', namePtBr: 'Penetração Física', baseDefault: 0, isPercentage: false },
  { code: 'MAG_PEN', namePtBr: 'Penetração Mágica', baseDefault: 0, isPercentage: false },
  { code: 'HEAL_POWER', namePtBr: 'Poder de Cura e Escudo', baseDefault: 10, isPercentage: false },
  { code: 'MP_REGEN', namePtBr: 'Regeneração de MP', baseDefault: 5, isPercentage: false },
  { code: 'SPEED', namePtBr: 'Velocidade de Iniciativa', baseDefault: 100, isPercentage: false },
  { code: 'EVASION', namePtBr: 'Taxa de Esquiva', baseDefault: 0.02, isPercentage: true },
  { code: 'ACCURACY', namePtBr: 'Taxa de Precisão', baseDefault: 1.0, isPercentage: true },
  { code: 'CRIT_RATE', namePtBr: 'Chance Crítica', baseDefault: 0.05, isPercentage: true },
  { code: 'CRIT_DMG', namePtBr: 'Multiplicador de Dano Crítico', baseDefault: 1.5, isPercentage: true },
  { code: 'STATUS_HIT_RATE', namePtBr: 'Taxa de Aplicação de Efeitos', baseDefault: 0.0, isPercentage: true },
  { code: 'DOT_RESIST', namePtBr: 'Resistência a Dano Contínuo', baseDefault: 0.0, isPercentage: true },
];

/**
 * Matriz inicial de conversão (1 ponto de Atributo Base -> X pontos em Atributo de Combate).
 */
export const INITIAL_ATTRIBUTE_CONVERSIONS = [
  { baseAttributeCode: 'VIT', combatAttributeCode: 'MAX_HP', ratioPerPoint: 20.0 },
  { baseAttributeCode: 'VIT', combatAttributeCode: 'PHYS_DEF', ratioPerPoint: 1.5 },
  { baseAttributeCode: 'VIT', combatAttributeCode: 'DOT_RESIST', ratioPerPoint: 0.002 },

  { baseAttributeCode: 'STR', combatAttributeCode: 'PHYS_ATK', ratioPerPoint: 2.5 },
  { baseAttributeCode: 'STR', combatAttributeCode: 'PHYS_PEN', ratioPerPoint: 0.8 },
  { baseAttributeCode: 'STR', combatAttributeCode: 'CRIT_DMG', ratioPerPoint: 0.003 },

  { baseAttributeCode: 'INT', combatAttributeCode: 'MAG_ATK', ratioPerPoint: 2.5 },
  { baseAttributeCode: 'INT', combatAttributeCode: 'MAX_MP', ratioPerPoint: 12.0 },
  { baseAttributeCode: 'INT', combatAttributeCode: 'MAG_PEN', ratioPerPoint: 0.8 },

  { baseAttributeCode: 'WIS', combatAttributeCode: 'HEAL_POWER', ratioPerPoint: 2.2 },
  { baseAttributeCode: 'WIS', combatAttributeCode: 'MAG_DEF', ratioPerPoint: 1.8 },
  { baseAttributeCode: 'WIS', combatAttributeCode: 'MP_REGEN', ratioPerPoint: 0.6 },

  { baseAttributeCode: 'AGI', combatAttributeCode: 'SPEED', ratioPerPoint: 1.5 },
  { baseAttributeCode: 'AGI', combatAttributeCode: 'EVASION', ratioPerPoint: 0.0015 },
  { baseAttributeCode: 'AGI', combatAttributeCode: 'PHYS_ATK', ratioPerPoint: 0.8 },

  { baseAttributeCode: 'DEX', combatAttributeCode: 'CRIT_RATE', ratioPerPoint: 0.002 },
  { baseAttributeCode: 'DEX', combatAttributeCode: 'ACCURACY', ratioPerPoint: 0.002 },
  { baseAttributeCode: 'DEX', combatAttributeCode: 'STATUS_HIT_RATE', ratioPerPoint: 0.0025 },
];

/**
 * Os 16 Slots de Equipamento do Personagem (incluindo Cinto) + 6 Slots de Equipamento do Pet.
 */
export const INITIAL_EQUIPMENT_SLOTS = [
  // 16 Slots de Personagem
  { code: 'SHOULDER', ownerType: 'CHARACTER', slotIndex: 1, namePtBr: 'Ombro' },
  { code: 'HEAD', ownerType: 'CHARACTER', slotIndex: 2, namePtBr: 'Cabeça' },
  { code: 'CHEST', ownerType: 'CHARACTER', slotIndex: 3, namePtBr: 'Peito' },
  { code: 'BELT', ownerType: 'CHARACTER', slotIndex: 4, namePtBr: 'Cinto' },
  { code: 'LEGS', ownerType: 'CHARACTER', slotIndex: 5, namePtBr: 'Pernas' },
  { code: 'FEET', ownerType: 'CHARACTER', slotIndex: 6, namePtBr: 'Pés' },
  { code: 'ORNAMENT_1', ownerType: 'CHARACTER', slotIndex: 7, namePtBr: 'Adorno 1' },
  { code: 'ORNAMENT_2', ownerType: 'CHARACTER', slotIndex: 8, namePtBr: 'Adorno 2' },
  { code: 'RING', ownerType: 'CHARACTER', slotIndex: 9, namePtBr: 'Anel' },
  { code: 'NECKLACE', ownerType: 'CHARACTER', slotIndex: 10, namePtBr: 'Colar' },
  { code: 'WEAPON_1', ownerType: 'CHARACTER', slotIndex: 11, namePtBr: 'Arma 1' },
  { code: 'WEAPON_2', ownerType: 'CHARACTER', slotIndex: 12, namePtBr: 'Arma 2' },
  { code: 'FISHING_ROD', ownerType: 'CHARACTER', slotIndex: 13, namePtBr: 'Vara de Pesca' },
  { code: 'FLYING_MOUNT', ownerType: 'CHARACTER', slotIndex: 14, namePtBr: 'Montaria Voadora' },
  { code: 'WINGS', ownerType: 'CHARACTER', slotIndex: 15, namePtBr: 'Asas' },
  { code: 'FASHION', ownerType: 'CHARACTER', slotIndex: 16, namePtBr: 'Moda' },

  // 6 Slots de Pet
  { code: 'PET_EQUIP_1', ownerType: 'PET', slotIndex: 1, namePtBr: 'Equipamento 1' },
  { code: 'PET_EQUIP_2', ownerType: 'PET', slotIndex: 2, namePtBr: 'Equipamento 2' },
  { code: 'PET_EQUIP_3', ownerType: 'PET', slotIndex: 3, namePtBr: 'Equipamento 3' },
  { code: 'PET_EQUIP_4', ownerType: 'PET', slotIndex: 4, namePtBr: 'Equipamento 4' },
  { code: 'PET_EQUIP_5', ownerType: 'PET', slotIndex: 5, namePtBr: 'Equipamento 5' },
  { code: 'PET_EQUIP_6', ownerType: 'PET', slotIndex: 6, namePtBr: 'Equipamento 6' },
];

/**
 * Raridades padrões de Monstros e Pets.
 */
export const INITIAL_MONSTER_RARITIES = [
  { code: 'COMMON', namePtBr: 'Comum', statMultiplier: 1.0, expMultiplier: 1.0, dropMultiplier: 1.0, visualScaleMultiplier: 1.0, spawnWeight: 600 },
  { code: 'UNCOMMON', namePtBr: 'Incomum', statMultiplier: 1.25, expMultiplier: 1.3, dropMultiplier: 1.25, visualScaleMultiplier: 1.05, spawnWeight: 250 },
  { code: 'ELITE', namePtBr: 'Elite', statMultiplier: 1.8, expMultiplier: 2.2, dropMultiplier: 2.0, visualScaleMultiplier: 1.15, spawnWeight: 100 },
  { code: 'RARE', namePtBr: 'Raro', statMultiplier: 2.6, expMultiplier: 3.5, dropMultiplier: 3.5, visualScaleMultiplier: 1.2, spawnWeight: 35 },
  { code: 'MINIBOSS', namePtBr: 'Subchefe', statMultiplier: 4.5, expMultiplier: 7.0, dropMultiplier: 6.0, visualScaleMultiplier: 1.35, spawnWeight: 12 },
  { code: 'BOSS', namePtBr: 'Chefe', statMultiplier: 9.0, expMultiplier: 15.0, dropMultiplier: 12.0, visualScaleMultiplier: 1.5, spawnWeight: 3 },
];
