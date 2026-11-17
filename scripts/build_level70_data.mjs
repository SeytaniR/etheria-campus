/**
 * @file scripts/build_level70_data.mjs
 * @description Constrói declarativamente os 12 Conjuntos Míticos (Rank SS) de Nível 70 (144 peças),
 * garantindo 1 conjunto especializado para cada uma das 12 classes de Etheria Campus,
 * com coerência visual verificada nos ícones PNG e zero repetição de equipamentos.
 * @rules Estrita observância da Regra #7 (< 1.000 linhas).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const NEW_12_LV70_SETS = [
  {
    code: 'set_lv70_sovereignblade',
    namePtBr: 'Conjunto do Soberano da Espada Astral',
    descriptionPtBr: 'Armadura real forjada em éter púrpura e ouro estelar para mestres da lâmina. Especializado: Espadachim (Ataque Físico, Crítico e Velocidade de Ataque).',
    prefix: 'equip_lv70_sovereignblade',
    requiredLevel: 70,
    rarityTier: 'SS',
    minPiecesFull: 12,
    minPiecesHalf: 6,
    halfBonusRatioPct: 40.0,
    fullBonusRatioPct: 100.0,
    bonusCombatStatsJson: { MAX_HP: 3400, PHYS_ATK: 640, CRIT_RATE: 18.0, CRIT_DMG: 42.0, ATTACK_SPEED: 0.90, BATTLE_MOVE_SPEED: 85 }
  },
  {
    code: 'set_lv70_valkyriestorm',
    namePtBr: 'Conjunto da Valquíria das Tempestades',
    descriptionPtBr: 'Traje alado consagrado pelos ventos celestes que confere reflexos relâmpago e esquiva suprema. Especializado: Ladina (Esquiva, Velocidade e Crítico).',
    prefix: 'equip_lv70_valkyriestorm',
    requiredLevel: 70,
    rarityTier: 'SS',
    minPiecesFull: 12,
    minPiecesHalf: 6,
    halfBonusRatioPct: 40.0,
    fullBonusRatioPct: 100.0,
    bonusCombatStatsJson: { MAX_HP: 3100, PHYS_ATK: 580, PHYS_EVASION: 95, CRIT_RATE: 19.0, ATTACK_SPEED: 0.95, BATTLE_MOVE_SPEED: 105 }
  },
  {
    code: 'set_lv70_draconicwarlord',
    namePtBr: 'Conjunto do Senhor da Guerra Dracônico',
    descriptionPtBr: 'Couraça colossal de escamas e chifres de dragão primordial com vitalidade e defesa intransponíveis. Especializado: Guerreira (HP Máximo, Defesa Física e Força Bruta).',
    prefix: 'equip_lv70_draconicwarlord',
    requiredLevel: 70,
    rarityTier: 'SS',
    minPiecesFull: 12,
    minPiecesHalf: 6,
    halfBonusRatioPct: 40.0,
    fullBonusRatioPct: 100.0,
    bonusCombatStatsJson: { MAX_HP: 5200, PHYS_ATK: 520, PHYS_DEF: 450, MAG_DEF: 240, BATTLE_MOVE_SPEED: 50, HP_REGEN: 120 }
  },
  {
    code: 'set_lv70_lunarpriestess',
    namePtBr: 'Conjunto da Sacerdotisa do Santuário Lunar',
    descriptionPtBr: 'Vestes sagradas tecidas sob a luz da meia-lua astral que amplificam milagres de cura e proteção divina. Especializado: Curandeira (Poder de Cura, MP e Defesa Mágica).',
    prefix: 'equip_lv70_lunarpriestess',
    requiredLevel: 70,
    rarityTier: 'SS',
    minPiecesFull: 12,
    minPiecesHalf: 6,
    halfBonusRatioPct: 40.0,
    fullBonusRatioPct: 100.0,
    bonusCombatStatsJson: { MAX_HP: 4000, MAX_MP: 1350, HEAL_POWER: 490, MAG_DEF: 350, PHYS_DEF: 270, BATTLE_MOVE_SPEED: 55, HP_REGEN: 90 }
  },
  {
    code: 'set_lv70_astralranger',
    namePtBr: 'Conjunto da Patrulheira do Horizonte Astral',
    descriptionPtBr: 'Indumentária élfica estelar que garante alcance estendido, passos de vento e disparos certeiros. Especializado: Caçadora (Alcance, Mobilidade e Precisão Crítica).',
    prefix: 'equip_lv70_astralranger',
    requiredLevel: 70,
    rarityTier: 'SS',
    minPiecesFull: 12,
    minPiecesHalf: 6,
    halfBonusRatioPct: 40.0,
    fullBonusRatioPct: 100.0,
    bonusCombatStatsJson: { MAX_HP: 3300, PHYS_ATK: 610, CRIT_RATE: 18.0, CRIT_DMG: 38.0, BATTLE_MOVE_SPEED: 100, ATTACK_RANGE: 55 }
  },
  {
    code: 'set_lv70_bloodphantom',
    namePtBr: 'Conjunto da Sombra Carmesim do Crepúsculo',
    descriptionPtBr: 'Vestimenta furtiva banhada em névoa rubra para execuções letais instantâneas. Especializado: Assassina (Dano Crítico Explosivo, Taxa Crítica e Evasão).',
    prefix: 'equip_lv70_bloodphantom',
    requiredLevel: 70,
    rarityTier: 'SS',
    minPiecesFull: 12,
    minPiecesHalf: 6,
    halfBonusRatioPct: 40.0,
    fullBonusRatioPct: 100.0,
    bonusCombatStatsJson: { MAX_HP: 3150, PHYS_ATK: 660, CRIT_RATE: 22.0, CRIT_DMG: 50.0, PHYS_EVASION: 90, BATTLE_MOVE_SPEED: 100 }
  },
  {
    code: 'set_lv70_celestialmuse',
    namePtBr: 'Conjunto da Musa da Sinfonia Celestial',
    descriptionPtBr: 'Traje harmônico resplandecente que acelera feitiços, restaura energias e encanta o campo de batalha. Especializado: Barda (Velocidade, Magia, Cura e Regeneração de MP).',
    prefix: 'equip_lv70_celestialmuse',
    requiredLevel: 70,
    rarityTier: 'SS',
    minPiecesFull: 12,
    minPiecesHalf: 6,
    halfBonusRatioPct: 40.0,
    fullBonusRatioPct: 100.0,
    bonusCombatStatsJson: { MAX_HP: 3250, MAG_ATK: 460, HEAL_POWER: 390, ATTACK_SPEED: 0.85, BATTLE_MOVE_SPEED: 95, CRIT_RATE: 13.0, MP_REGEN: 70 }
  },
  {
    code: 'set_lv70_dragoonemperor',
    namePtBr: 'Conjunto do Imperador Dragoon dos Céus',
    descriptionPtBr: 'Armadura imperial dourada projetada para investidas aéreas e estocadas que perfuram qualquer blindagem. Especializado: Lanceiro (Penetração Física, Ataque e Defesa).',
    prefix: 'equip_lv70_dragoonemperor',
    requiredLevel: 70,
    rarityTier: 'SS',
    minPiecesFull: 12,
    minPiecesHalf: 6,
    halfBonusRatioPct: 40.0,
    fullBonusRatioPct: 100.0,
    bonusCombatStatsJson: { MAX_HP: 3800, PHYS_ATK: 600, PHYS_PEN: 260, PHYS_DEF: 320, CRIT_RATE: 16.0, CRIT_DMG: 32.0, BATTLE_MOVE_SPEED: 80 }
  },
  {
    code: 'set_lv70_arcanesovereign',
    namePtBr: 'Conjunto do Arquimago da Chama Primordial',
    descriptionPtBr: 'Manto real inscrito com runas primordiais de destruição arcana e penetração elemental absoluta. Especializado: Mago (Ataque Mágico Massivo, Penetração e Crítico).',
    prefix: 'equip_lv70_arcanesovereign',
    requiredLevel: 70,
    rarityTier: 'SS',
    minPiecesFull: 12,
    minPiecesHalf: 6,
    halfBonusRatioPct: 40.0,
    fullBonusRatioPct: 100.0,
    bonusCombatStatsJson: { MAX_HP: 2950, MAG_ATK: 740, MAG_PEN: 255, MAG_DEF: 240, CRIT_RATE: 17.5, CRIT_DMG: 42.0, BATTLE_MOVE_SPEED: 60 }
  },
  {
    code: 'set_lv70_seraphiccrusader',
    namePtBr: 'Conjunto do Cruzado Seráfico de Aethelgard',
    descriptionPtBr: 'Armadura sacrossanta alada de ouro e safira com baluarte defensivo duplo e bênção curativa. Especializado: Paladino (Defesa Física/Mágica, HP, Ataque e Cura).',
    prefix: 'equip_lv70_seraphiccrusader',
    requiredLevel: 70,
    rarityTier: 'SS',
    minPiecesFull: 12,
    minPiecesHalf: 6,
    halfBonusRatioPct: 40.0,
    fullBonusRatioPct: 100.0,
    bonusCombatStatsJson: { MAX_HP: 5000, PHYS_DEF: 470, MAG_DEF: 360, MAG_ATK: 390, PHYS_ATK: 390, HEAL_POWER: 220, BATTLE_MOVE_SPEED: 50 }
  },
  {
    code: 'set_lv70_hellfireartillery',
    namePtBr: 'Conjunto do Artilheiro da Forja Infernal',
    descriptionPtBr: 'Equipamento balístico de grosso calibre com poder de fogo avassalador e perfuração blindada. Especializado: Atirador (Ataque Físico, Penetração, Alcance e Crítico).',
    prefix: 'equip_lv70_hellfireartillery',
    requiredLevel: 70,
    rarityTier: 'SS',
    minPiecesFull: 12,
    minPiecesHalf: 6,
    halfBonusRatioPct: 40.0,
    fullBonusRatioPct: 100.0,
    bonusCombatStatsJson: { MAX_HP: 3050, PHYS_ATK: 720, PHYS_PEN: 275, CRIT_RATE: 18.0, CRIT_DMG: 44.0, BATTLE_MOVE_SPEED: 70, ATTACK_RANGE: 65 }
  },
  {
    code: 'set_lv70_abyssaloverlord',
    namePtBr: 'Conjunto do Soberano da Noite Eterna',
    descriptionPtBr: 'Paramentos abissais que drenam a força vital dos inimigos e comandam as trevas eternas. Especializado: Necromante (Ataque Mágico, HP, Penetração Mágica e Regeneração).',
    prefix: 'equip_lv70_abyssaloverlord',
    requiredLevel: 70,
    rarityTier: 'SS',
    minPiecesFull: 12,
    minPiecesHalf: 6,
    halfBonusRatioPct: 40.0,
    fullBonusRatioPct: 100.0,
    bonusCombatStatsJson: { MAX_HP: 3600, MAG_ATK: 640, MAG_PEN: 235, MAG_DEF: 260, CRIT_RATE: 16.0, CRIT_DMG: 36.0, HP_REGEN: 85, BATTLE_MOVE_SPEED: 60 }
  }
];

const SET_BLUEPRINTS = [
  {
    setCode: 'set_lv70_sovereignblade',
    prefix: 'equip_lv70_sovereignblade',
    setName: 'Soberano da Espada Astral',
    classFocus: 'Espadachim',
    archetype: 'PHYS_CRIT_SPEED',
    icons: {
      HEAD: '050313', SHOULDER: '050413', CHEST: '050513', BELT: '050613', LEGS: '050713', FEET: '050813',
      WEAPON_1: '050113', WEAPON_2: '050213',
      RING: '001013', NECKLACE: '000913', ORNAMENT_1: '001113', ORNAMENT_2: '001213'
    },
    pieceNames: {
      HEAD: 'Diadema do Soberano Astral',
      SHOULDER: 'Ombreiras do Soberano Astral',
      CHEST: 'Couraça do Soberano Astral',
      BELT: 'Cinturão do Soberano Astral',
      LEGS: 'Grevas do Soberano Astral',
      FEET: 'Botas do Soberano Astral',
      WEAPON_1: 'Espada Longa do Soberano Astral',
      WEAPON_2: 'Wakizashi do Soberano Astral',
      RING: 'Anel Real do Soberano Astral',
      NECKLACE: 'Colar Real do Soberano Astral',
      ORNAMENT_1: 'Broche Rubro do Soberano Astral',
      ORNAMENT_2: 'Pingente de Safira do Soberano Astral'
    }
  },
  {
    setCode: 'set_lv70_valkyriestorm',
    prefix: 'equip_lv70_valkyriestorm',
    setName: 'Valquíria das Tempestades',
    classFocus: 'Ladina',
    archetype: 'PHYS_EVA_SPEED',
    icons: {
      HEAD: '050312', SHOULDER: '050412', CHEST: '050512', BELT: '050612', LEGS: '050712', FEET: '050812',
      WEAPON_1: '050108', WEAPON_2: '050212',
      RING: '011013', NECKLACE: '010913', ORNAMENT_1: '011114', ORNAMENT_2: '011214'
    },
    pieceNames: {
      HEAD: 'Elmo Alado da Valquíria das Tempestades',
      SHOULDER: 'Espaldares da Valquíria das Tempestades',
      CHEST: 'Peitoral da Valquíria das Tempestades',
      BELT: 'Cinto da Valquíria das Tempestades',
      LEGS: 'Perneiras da Valquíria das Tempestades',
      FEET: 'Botas Aladas da Valquíria das Tempestades',
      WEAPON_1: 'Lâmina Solar da Valquíria',
      WEAPON_2: 'Adaga Curva dos Ventos Celestes',
      RING: 'Anel Alado da Valquíria',
      NECKLACE: 'Torques Alado da Valquíria',
      ORNAMENT_1: 'Insígnia Solar da Valquíria',
      ORNAMENT_2: 'Pluma Celeste da Valquíria'
    }
  },
  {
    setCode: 'set_lv70_draconicwarlord',
    prefix: 'equip_lv70_draconicwarlord',
    setName: 'Senhor da Guerra Dracônico',
    classFocus: 'Guerreira',
    archetype: 'TANK_BRUISER',
    icons: {
      HEAD: '010311', SHOULDER: '010411', CHEST: '010511', BELT: '010611', LEGS: '010711', FEET: '010811',
      WEAPON_1: '010114', WEAPON_2: '010211',
      RING: '011014', NECKLACE: '010914', ORNAMENT_1: '011111', ORNAMENT_2: '001214'
    },
    pieceNames: {
      HEAD: 'Elmo de Chifres do Senhor Dracônico',
      SHOULDER: 'Ombreiras de Escamas do Senhor Dracônico',
      CHEST: 'Armadura Pesada do Senhor Dracônico',
      BELT: 'Cinturão de Garra do Senhor Dracônico',
      LEGS: 'Coxotes Rubros do Senhor Dracônico',
      FEET: 'Sabatons Dourados do Senhor Dracônico',
      WEAPON_1: 'Machado Carniceiro Dracônico',
      WEAPON_2: 'Escudo de Escamas Rubras Dracônico',
      RING: 'Anel de Sangue Dracônico',
      NECKLACE: 'Colar de Rubi Dracônico',
      ORNAMENT_1: 'Coração de Magma Dracônico',
      ORNAMENT_2: 'Pedra Ancestral do Bastião Dracônico'
    }
  },
  {
    setCode: 'set_lv70_lunarpriestess',
    prefix: 'equip_lv70_lunarpriestess',
    setName: 'Sacerdotisa do Santuário Lunar',
    classFocus: 'Curandeira',
    archetype: 'HEALER_SUPPORT',
    icons: {
      HEAD: '040311', SHOULDER: '040411', CHEST: '040511', BELT: '040611', LEGS: '040711', FEET: '040811',
      WEAPON_1: '040110', WEAPON_2: '040211',
      RING: '001014', NECKLACE: '000914', ORNAMENT_1: '400301', ORNAMENT_2: '011215'
    },
    pieceNames: {
      HEAD: 'Tiara da Meia-Lua Sagrada',
      SHOULDER: 'Manto Lunar de Safira',
      CHEST: 'Túnica do Santuário Lunar',
      BELT: 'Faixa Estelar do Santuário Lunar',
      LEGS: 'Saiote do Santuário Lunar',
      FEET: 'Botas Sagradas do Santuário Lunar',
      WEAPON_1: 'Báculo Esmeralda da Vida Eterna',
      WEAPON_2: 'Escritura Sagrada da Redenção Lunar',
      RING: 'Anel de Safira Lunar',
      NECKLACE: 'Colar de Lágrimas Lunares',
      ORNAMENT_1: 'Cruz Radiante do Santuário Lunar',
      ORNAMENT_2: 'Insígnia Alada da Graça Lunar'
    }
  },
  {
    setCode: 'set_lv70_astralranger',
    prefix: 'equip_lv70_astralranger',
    setName: 'Patrulheira do Horizonte Astral',
    classFocus: 'Caçadora',
    archetype: 'RANGED_HUNTER',
    icons: {
      HEAD: '030311', SHOULDER: '030411', CHEST: '030511', BELT: '030611', LEGS: '030711', FEET: '030811',
      WEAPON_1: '030111', WEAPON_2: '030211',
      RING: '001007', NECKLACE: '000907', ORNAMENT_1: '001107', ORNAMENT_2: '001207'
    },
    pieceNames: {
      HEAD: 'Visor da Patrulheira do Horizonte',
      SHOULDER: 'Ombreiras Estelares do Horizonte',
      CHEST: 'Gibão da Patrulheira do Horizonte',
      BELT: 'Cinto de Vento do Horizonte',
      LEGS: 'Perneiras Ágeis do Horizonte',
      FEET: 'Botas Silvestres do Horizonte',
      WEAPON_1: 'Balestra de Repetição do Horizonte',
      WEAPON_2: 'Aljava de Flechas Estelares',
      RING: 'Anel Esmeralda da Floresta Astral',
      NECKLACE: 'Amuleto Esmeralda da Caçada Astral',
      ORNAMENT_1: 'Gema Verdejante do Horizonte',
      ORNAMENT_2: 'Talismã de Jade da Patrulheira'
    }
  },
  {
    setCode: 'set_lv70_bloodphantom',
    prefix: 'equip_lv70_bloodphantom',
    setName: 'Sombra Carmesim do Crepúsculo',
    classFocus: 'Assassina',
    archetype: 'ASSASSIN_BURST',
    icons: {
      HEAD: '060312', SHOULDER: '060412', CHEST: '060512', BELT: '060612', LEGS: '060712', FEET: '060812',
      WEAPON_1: '050112', WEAPON_2: '050211',
      RING: '011012', NECKLACE: '010912', ORNAMENT_1: '001111', ORNAMENT_2: '001211'
    },
    pieceNames: {
      HEAD: 'Bandana Alada da Sombra Carmesim',
      SHOULDER: 'Ombreiras Ocultas da Sombra Carmesim',
      CHEST: 'Kimono Furtivo da Sombra Carmesim',
      BELT: 'Faixa Tática da Sombra Carmesim',
      LEGS: 'Calças Furtivas da Sombra Carmesim',
      FEET: 'Tabi Silenciosas da Sombra Carmesim',
      WEAPON_1: 'Lâmina Negra do Crepúsculo',
      WEAPON_2: 'Adaga Venenosa do Crepúsculo',
      RING: 'Anel Carmesim do Assassinato',
      NECKLACE: 'Gargantilha de Sangue Noturno',
      ORNAMENT_1: 'Presa Envenenada do Crepúsculo',
      ORNAMENT_2: 'Cristal Sombrio da Furtividade'
    }
  },
  {
    setCode: 'set_lv70_celestialmuse',
    prefix: 'equip_lv70_celestialmuse',
    setName: 'Musa da Sinfonia Celestial',
    classFocus: 'Barda',
    archetype: 'BARD_HARMONY',
    icons: {
      HEAD: '020312', SHOULDER: '020412', CHEST: '020512', BELT: '020612', LEGS: '020712', FEET: '020812',
      WEAPON_1: '020111', WEAPON_2: '020211',
      RING: '011008', NECKLACE: '010908', ORNAMENT_1: '001109', ORNAMENT_2: '001212'
    },
    pieceNames: {
      HEAD: 'Boina Real da Musa Celestial',
      SHOULDER: 'Ombreiras de Cristal da Musa Celestial',
      CHEST: 'Veste Sinfônica da Musa Celestial',
      BELT: 'Cinto Harmônico da Musa Celestial',
      LEGS: 'Calças Melódicas da Musa Celestial',
      FEET: 'Botas Aladas da Musa Celestial',
      WEAPON_1: 'Harpa Dourada da Sinfonia Celestial',
      WEAPON_2: 'Batuta Floral da Ressonância',
      RING: 'Anel Harmônico de Coral Celestial',
      NECKLACE: 'Colar de Pérolas Ressonantes',
      ORNAMENT_1: 'Leque Dourado da Musa Celestial',
      ORNAMENT_2: 'Esfera Acústica do Éter'
    }
  },
  {
    setCode: 'set_lv70_dragoonemperor',
    prefix: 'equip_lv70_dragoonemperor',
    setName: 'Imperador Dragoon dos Céus',
    classFocus: 'Lanceiro',
    archetype: 'LANCER_PIERCE',
    icons: {
      HEAD: '010313', SHOULDER: '010413', CHEST: '010513', BELT: '010613', LEGS: '010713', FEET: '010813',
      WEAPON_1: '060112', WEAPON_2: '060210',
      RING: '011011', NECKLACE: '010911', ORNAMENT_1: '011109', ORNAMENT_2: '011211'
    },
    pieceNames: {
      HEAD: 'Elmo Imperial Dragoon dos Céus',
      SHOULDER: 'Ombreiras Imperiais Dragoon dos Céus',
      CHEST: 'Peitoral Imperial Dragoon dos Céus',
      BELT: 'Cinturão Imperial Dragoon dos Céus',
      LEGS: 'Grevas Imperiais Dragoon dos Céus',
      FEET: 'Sabatons Imperiais Dragoon dos Céus',
      WEAPON_1: 'Lança Perfuratriz do Imperador Dragoon',
      WEAPON_2: 'Garra de Investida Rubra Dragoon',
      RING: 'Anel Imperial de Topázio Dragoon',
      NECKLACE: 'Medalhão Imperial Dragoon dos Céus',
      ORNAMENT_1: 'Orbe Solar da Perfuração Celeste',
      ORNAMENT_2: 'Flama Espiral do Imperador Dragoon'
    }
  },
  {
    setCode: 'set_lv70_arcanesovereign',
    prefix: 'equip_lv70_arcanesovereign',
    setName: 'Arquimago da Chama Primordial',
    classFocus: 'Mago',
    archetype: 'MAGE_BURST',
    icons: {
      HEAD: '040312', SHOULDER: '040412', CHEST: '040512', BELT: '040612', LEGS: '040712', FEET: '040812',
      WEAPON_1: '120004', WEAPON_2: '040212',
      RING: '001015', NECKLACE: '000915', ORNAMENT_1: '001115', ORNAMENT_2: '011208'
    },
    pieceNames: {
      HEAD: 'Mitra do Arquimago Primordial',
      SHOULDER: 'Espaldares Rúnicos do Arquimago Primordial',
      CHEST: 'Manto Real do Arquimago Primordial',
      BELT: 'Cinto de Runas do Arquimago Primordial',
      LEGS: 'Saiote Ígneo do Arquimago Primordial',
      FEET: 'Botas Arcanas do Arquimago Primordial',
      WEAPON_1: 'Cetro do Núcleo Primordial',
      WEAPON_2: 'Grimório das Runas Primordiais',
      RING: 'Anel de Diamante Primordial',
      NECKLACE: 'Colar de Cristais Primordiais',
      ORNAMENT_1: 'Varinha Catalisadora Primordial',
      ORNAMENT_2: 'Prisma de Ametista Primordial'
    }
  },
  {
    setCode: 'set_lv70_seraphiccrusader',
    prefix: 'equip_lv70_seraphiccrusader',
    setName: 'Cruzado Seráfico de Aethelgard',
    classFocus: 'Paladino',
    archetype: 'PALADIN_FORTRESS',
    icons: {
      HEAD: '010312', SHOULDER: '010412', CHEST: '010512', BELT: '010612', LEGS: '010712', FEET: '010812',
      WEAPON_1: '010108', WEAPON_2: '010213',
      RING: '011015', NECKLACE: '010915', ORNAMENT_1: '001215', ORNAMENT_2: '011209'
    },
    pieceNames: {
      HEAD: 'Elmo Alado do Cruzado Seráfico',
      SHOULDER: 'Ombreiras Douradas do Cruzado Seráfico',
      CHEST: 'Couraça Sacra do Cruzado Seráfico',
      BELT: 'Cinturão de Ouro do Cruzado Seráfico',
      LEGS: 'Grevas Rúnicas do Cruzado Seráfico',
      FEET: 'Sabatons Alados do Cruzado Seráfico',
      WEAPON_1: 'Martelo Sagrado da Luz Seráfica',
      WEAPON_2: 'Égide Real do Cruzado Seráfico',
      RING: 'Anel Sagrado de Aethelgard',
      NECKLACE: 'Colar de Relíquias Seráficas',
      ORNAMENT_1: 'Estandarte Sagrado do Cruzado',
      ORNAMENT_2: 'Magatama Celeste da Proteção'
    }
  },
  {
    setCode: 'set_lv70_hellfireartillery',
    prefix: 'equip_lv70_hellfireartillery',
    setName: 'Artilheiro da Forja Infernal',
    classFocus: 'Atirador',
    archetype: 'GUNNER_ARTILLERY',
    icons: {
      HEAD: '030312', SHOULDER: '030412', CHEST: '030512', BELT: '030612', LEGS: '030712', FEET: '030812',
      WEAPON_1: '030112', WEAPON_2: '030212',
      RING: '001008', NECKLACE: '000908', ORNAMENT_1: '400501', ORNAMENT_2: '011213'
    },
    pieceNames: {
      HEAD: 'Chapéu Tático do Artilheiro Infernal',
      SHOULDER: 'Ombreiras Balísticas do Artilheiro Infernal',
      CHEST: 'Sobretudo Blindado do Artilheiro Infernal',
      BELT: 'Cinto de Munição do Artilheiro Infernal',
      LEGS: 'Perneiras Táticas do Artilheiro Infernal',
      FEET: 'Botas de Recuo do Artilheiro Infernal',
      WEAPON_1: 'Canhão de Cano Duplo da Forja Infernal',
      WEAPON_2: 'Cartucheira Incendiária de Magma',
      RING: 'Anel de Ignição Balística',
      NECKLACE: 'Corrente de Pólvora Rubra',
      ORNAMENT_1: 'Mira Laser da Forja Infernal',
      ORNAMENT_2: 'Núcleo de Âmbar Pressurizado'
    }
  },
  {
    setCode: 'set_lv70_abyssaloverlord',
    prefix: 'equip_lv70_abyssaloverlord',
    setName: 'Soberano da Noite Eterna',
    classFocus: 'Necromante',
    archetype: 'NECRO_DRAIN',
    icons: {
      HEAD: '030313', SHOULDER: '030413', CHEST: '030513', BELT: '030613', LEGS: '030713', FEET: '030813',
      WEAPON_1: '040112', WEAPON_2: '400201',
      RING: '310004', NECKLACE: '400401', ORNAMENT_1: '400101', ORNAMENT_2: '011115'
    },
    pieceNames: {
      HEAD: 'Coroa de Chifres da Noite Eterna',
      SHOULDER: 'Ombreiras Abissais da Noite Eterna',
      CHEST: 'Couraça Espectral da Noite Eterna',
      BELT: 'Cinturão de Almas da Noite Eterna',
      LEGS: 'Perneiras Abissais da Noite Eterna',
      FEET: 'Botas Profanas da Noite Eterna',
      WEAPON_1: 'Báculo Púrpura da Noite Eterna',
      WEAPON_2: 'Necronomicon da Noite Eterna',
      RING: 'Anel do Vórtice da Noite Eterna',
      NECKLACE: 'Colar de Orbes da Noite Eterna',
      ORNAMENT_1: 'Diadema de Osso da Noite Eterna',
      ORNAMENT_2: 'Pêndulo de Almas Abissais'
    }
  }
];

function computeSlotCombatStats(archetype, slot) {
  const isMagic = ['HEALER_SUPPORT', 'BARD_HARMONY', 'MAGE_BURST', 'NECRO_DRAIN'].includes(archetype);
  const isHybrid = archetype === 'PALADIN_FORTRESS';
  const isTank = ['TANK_BRUISER', 'PALADIN_FORTRESS'].includes(archetype);
  const isHealer = ['HEALER_SUPPORT', 'BARD_HARMONY', 'PALADIN_FORTRESS'].includes(archetype);

  switch (slot) {
    case 'HEAD':
      return isMagic
        ? { MAG_ATK: 380, MAX_MP: 820, MAG_DEF: 210, CRIT_RATE: 85 }
        : isTank
          ? { MAX_HP: 1950, PHYS_DEF: 310, MAG_DEF: 240, PHYS_ATK: 260 }
          : { PHYS_ATK: 390, MAX_HP: 1150, PHYS_DEF: 210, CRIT_RATE: 90 };
    case 'SHOULDER':
      return isMagic
        ? { MAG_ATK: 290, MAX_MP: 640, MAG_DEF: 280, MAG_EVASION: 70 }
        : isTank
          ? { MAX_HP: 1750, PHYS_DEF: 340, MAG_DEF: 260, HP_REGEN: 65 }
          : { PHYS_ATK: 310, MAX_HP: 980, PHYS_DEF: 240, PHYS_EVASION: 75 };
    case 'CHEST':
      return isMagic
        ? { MAG_ATK: 460, MAX_MP: 980, MAG_DEF: 360, HP_REGEN: 80 }
        : isTank
          ? { MAX_HP: 2600, PHYS_DEF: 440, MAG_DEF: 320, HP_REGEN: 95 }
          : { PHYS_ATK: 470, MAX_HP: 1650, PHYS_DEF: 320, CRIT_DMG: 90 };
    case 'BELT':
      return isMagic
        ? { MAG_ATK: 250, MAX_MP: 540, MP_REGEN: 55, MAG_DEF: 185 }
        : isTank
          ? { MAX_HP: 1550, PHYS_DEF: 270, MAG_DEF: 210, HP_REGEN: 60 }
          : { PHYS_ATK: 265, MAX_HP: 920, PHYS_DEF: 195, MP_REGEN: 40 };
    case 'LEGS':
      return isMagic
        ? { MAG_ATK: 350, MAX_MP: 740, MAG_DEF: 295, MAG_EVASION: 80 }
        : isTank
          ? { MAX_HP: 2100, PHYS_DEF: 370, MAG_DEF: 275, PHYS_ATK: 240 }
          : { PHYS_ATK: 360, MAX_HP: 1320, PHYS_DEF: 265, PHYS_EVASION: 85 };
    case 'FEET':
      return isMagic
        ? { MAG_ATK: 230, MAX_MP: 480, MAG_DEF: 225, BATTLE_MOVE_SPEED: 90, MAG_EVASION: 70 }
        : isTank
          ? { MAX_HP: 1450, PHYS_DEF: 285, MAG_DEF: 220, BATTLE_MOVE_SPEED: 75 }
          : { PHYS_ATK: 255, MAX_HP: 880, PHYS_DEF: 210, BATTLE_MOVE_SPEED: 105, PHYS_EVASION: 80 };
    case 'WEAPON_1':
      if (isHealer && isMagic) {
        return { MAG_ATK: 780, HEAL_POWER: 620, MAX_MP: 1050, CRIT_RATE: 120, MAG_ACCURACY: 95 };
      }
      if (isMagic) {
        return { MAG_ATK: 920, MAX_MP: 1050, CRIT_RATE: 150, CRIT_DMG: 135, MAG_ACCURACY: 105 };
      }
      if (isHybrid) {
        return { PHYS_ATK: 680, MAG_ATK: 680, HEAL_POWER: 380, MAX_HP: 1800, PHYS_ACCURACY: 95 };
      }
      return { PHYS_ATK: 920, CRIT_RATE: 155, CRIT_DMG: 140, PHYS_ACCURACY: 105, ATTACK_SPEED: 35 };
    case 'WEAPON_2':
      if (isTank) {
        return { MAX_HP: 2400, PHYS_DEF: 460, MAG_DEF: 380, HP_REGEN: 90, PHYS_ATK: 320 };
      }
      if (isMagic) {
        return { MAG_ATK: 590, MAG_DEF: 310, MAX_MP: 760, HEAL_POWER: isHealer ? 410 : 120, MAG_ACCURACY: 85 };
      }
      return { PHYS_ATK: 610, PHYS_DEF: 260, CRIT_RATE: 115, CRIT_DMG: 105, PHYS_ACCURACY: 85 };
    case 'RING':
      return isMagic
        ? { MAG_ATK: 285, MAX_MP: 540, CRIT_RATE: 110, HP_REGEN: 50 }
        : { PHYS_ATK: 295, MAX_HP: 860, CRIT_RATE: 115, HP_REGEN: 55 };
    case 'NECKLACE':
      return isMagic
        ? { MAG_ATK: 315, MAX_MP: 640, CRIT_DMG: 105, MAG_ACCURACY: 75 }
        : { PHYS_ATK: 325, MAX_HP: 980, CRIT_DMG: 110, PHYS_ACCURACY: 80 };
    case 'ORNAMENT_1':
      return isMagic
        ? { MAG_ATK: 265, HEAL_POWER: isHealer ? 260 : 80, CRIT_RATE: 95, MAG_ACCURACY: 70 }
        : { PHYS_ATK: 275, CRIT_RATE: 100, PHYS_ACCURACY: 75, BATTLE_MOVE_SPEED: 45 };
    case 'ORNAMENT_2':
      return isMagic
        ? { MAG_ATK: 265, MAX_HP: 1100, MAG_DEF: 210, MP_REGEN: 50 }
        : { PHYS_ATK: 275, MAX_HP: 1200, PHYS_DEF: 220, CRIT_DMG: 95 };
    default:
      return { MAX_HP: 1000 };
  }
}

const SLOT_SUFFIX = {
  HEAD: 'head',
  SHOULDER: 'shoulder',
  CHEST: 'chest',
  BELT: 'belt',
  LEGS: 'legs',
  FEET: 'feet',
  WEAPON_1: 'weapon1',
  WEAPON_2: 'weapon2',
  RING: 'ring',
  NECKLACE: 'necklace',
  ORNAMENT_1: 'ornament1',
  ORNAMENT_2: 'ornament2'
};

// 1. Atualiza equipment_sets_definitions.json
const setsDefsPath = path.join(__dirname, 'equipment_sets_definitions.json');
let allSets = JSON.parse(fs.readFileSync(setsDefsPath, 'utf-8'));
const newSetCodes = new Set(NEW_12_LV70_SETS.map((s) => s.code));
allSets = allSets.filter((s) => !newSetCodes.has(s.code)).concat(NEW_12_LV70_SETS);
fs.writeFileSync(setsDefsPath, JSON.stringify(allSets, null, 2), 'utf-8');
console.log(`✅ equipment_sets_definitions.json atualizado com ${allSets.length} conjuntos (incluindo os 12 novos de Lv.70 Rank SS)!`);

// 2. Constrói os 144 itens de Nível 70 (Rank SS)
const lv70Items = [];
const allSlots = ['HEAD', 'SHOULDER', 'CHEST', 'BELT', 'LEGS', 'FEET', 'WEAPON_1', 'WEAPON_2', 'RING', 'NECKLACE', 'ORNAMENT_1', 'ORNAMENT_2'];

for (const bp of SET_BLUEPRINTS) {
  for (const slot of allSlots) {
    const code = `${bp.prefix}_${SLOT_SUFFIX[slot]}`;
    const namePtBr = bp.pieceNames[slot];
    const iconCode = bp.icons[slot];
    const icon = `assets/equipment/icons/equip_normal_${iconCode}.png`;
    const combatStats = computeSlotCombatStats(bp.archetype, slot);
    const descPtBr = `Relíquia mítica de alto escalão imbuída com poder ancestral. [Conjunto ${bp.setName}: Lv. 70 (Rank SS) - Especializado: ${bp.classFocus}].`;

    lv70Items.push({
      code,
      slot,
      namePtBr,
      nameEn: namePtBr,
      descPtBr,
      descEn: descPtBr,
      icon,
      combatStats
    });
  }
}

const outLv70Path = path.join(__dirname, 'twelve_level70_equipment_sets.json');
fs.writeFileSync(outLv70Path, JSON.stringify(lv70Items, null, 2), 'utf-8');
console.log(`✅ twelve_level70_equipment_sets.json gerado com ${lv70Items.length} peças míticas (Rank SS)!`);
