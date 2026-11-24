/**
 * @file scripts/build_level70_batch2_data.mjs
 * @description Constrói declarativamente a 2ª Coleção de 12 Conjuntos Míticos (Rank SS) de Nível 70 (144 peças),
 * garantindo uma especialização alternativa única para cada uma das 12 classes de Etheria Campus,
 * com coerência visual estrita nos ícones PNG e zero repetição de equipamentos no jogo.
 * @rules Estrita observância da Regra #7 (< 1.000 linhas).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const NEW_12_LV70_BATCH2_SETS = [
  {
    code: 'set_lv70_solardawn',
    namePtBr: 'Conjunto da Alvorada Solar Ígnea',
    descriptionPtBr: 'Armadura dourada consagrada aos raios solares que canaliza poder ígneo devastador. Especializado: Espadachim (Ataque Físico, Dano Crítico e Alta Velocidade de Ataque).',
    prefix: 'equip_lv70_solardawn',
    requiredLevel: 70,
    rarityTier: 'SS',
    minPiecesFull: 12,
    minPiecesHalf: 6,
    halfBonusRatioPct: 40.0,
    fullBonusRatioPct: 100.0,
    bonusCombatStatsJson: { MAX_HP: 3500, PHYS_ATK: 650 }
  },
  {
    code: 'set_lv70_nightstalker',
    namePtBr: 'Conjunto do Rastreador das Sombras Noturnas',
    descriptionPtBr: 'Vestimenta de couro furtivo imbuída com essência de sombra e veneno letal. Especializado: Ladina (Evasão Suprema, Velocidade e Taxa Crítica).',
    prefix: 'equip_lv70_nightstalker',
    requiredLevel: 70,
    rarityTier: 'SS',
    minPiecesFull: 12,
    minPiecesHalf: 6,
    halfBonusRatioPct: 40.0,
    fullBonusRatioPct: 100.0,
    bonusCombatStatsJson: { MAX_HP: 3100, PHYS_ATK: 590 }
  },
  {
    code: 'set_lv70_crimsontitan',
    namePtBr: 'Conjunto do Titã Carmesim Esmagador',
    descriptionPtBr: 'Armadura colossal forjada em aço sanguíneo para resistir a golpes titânicos e esmagar muralhas. Especializado: Guerreira (HP Máximo, Defesa Física e Golpe Esmagador).',
    prefix: 'equip_lv70_crimsontitan',
    requiredLevel: 70,
    rarityTier: 'SS',
    minPiecesFull: 12,
    minPiecesHalf: 6,
    halfBonusRatioPct: 40.0,
    fullBonusRatioPct: 100.0,
    bonusCombatStatsJson: { MAX_HP: 5500, PHYS_ATK: 530, PHYS_DEF: 460, MAG_DEF: 250 }
  },
  {
    code: 'set_lv70_emeraldgenesis',
    namePtBr: 'Conjunto da Guardiã da Gênese Esmeralda',
    descriptionPtBr: 'Mantos tecidos com cipós sagrados e folhas celestiais do jardim primordial. Especializado: Curandeira (Poder de Cura, Reserva de MP e Vitalidade).',
    prefix: 'equip_lv70_emeraldgenesis',
    requiredLevel: 70,
    rarityTier: 'SS',
    minPiecesFull: 12,
    minPiecesHalf: 6,
    halfBonusRatioPct: 40.0,
    fullBonusRatioPct: 100.0,
    bonusCombatStatsJson: { MAX_HP: 4100, MAX_MP: 1400, MAG_DEF: 360, PHYS_DEF: 280 }
  },
  {
    code: 'set_lv70_windrunner',
    namePtBr: 'Conjunto da Corredora dos Ventos Ancestrais',
    descriptionPtBr: 'Traje de caça élfico que concede a agilidade dos tufões e alcance sem precedentes. Especializado: Caçadora (Alcance de Ataque, Velocidade de Movimento e Precisão Crítica).',
    prefix: 'equip_lv70_windrunner',
    requiredLevel: 70,
    rarityTier: 'SS',
    minPiecesFull: 12,
    minPiecesHalf: 6,
    halfBonusRatioPct: 40.0,
    fullBonusRatioPct: 100.0,
    bonusCombatStatsJson: { MAX_HP: 3350, PHYS_ATK: 620 }
  },
  {
    code: 'set_lv70_voideclipse',
    namePtBr: 'Conjunto da Executora do Eclipse do Vazio',
    descriptionPtBr: 'Indumentária de seda sombria banhada no vácuo celestial para execuções sem chance de defesa. Especializado: Assassina (Dano Crítico Letal, Penetração Física e Velocidade).',
    prefix: 'equip_lv70_voideclipse',
    requiredLevel: 70,
    rarityTier: 'SS',
    minPiecesFull: 12,
    minPiecesHalf: 6,
    halfBonusRatioPct: 40.0,
    fullBonusRatioPct: 100.0,
    bonusCombatStatsJson: { MAX_HP: 3200, PHYS_ATK: 670 }
  },
  {
    code: 'set_lv70_royalsymphony',
    namePtBr: 'Conjunto do Maestro da Sinfonia Real',
    descriptionPtBr: 'Cota de malha aristocrática bordada a fios de ouro que afina os acordes mais gloriosos no campo. Especializado: Barda (Velocidade de Conjuração, Magia, Cura e Regeneração de MP).',
    prefix: 'equip_lv70_royalsymphony',
    requiredLevel: 70,
    rarityTier: 'SS',
    minPiecesFull: 12,
    minPiecesHalf: 6,
    halfBonusRatioPct: 40.0,
    fullBonusRatioPct: 100.0,
    bonusCombatStatsJson: { MAX_HP: 3300, MAG_ATK: 480 }
  },
  {
    code: 'set_lv70_glacialdragoon',
    namePtBr: 'Conjunto do Lanceiro do Dragão Glacial',
    descriptionPtBr: 'Armadura de placas de gelo negro e aço reforçado feita para perfurar as mais duras couraças. Especializado: Lanceiro (Penetração Física, Ataque e Defesa Blindada).',
    prefix: 'equip_lv70_glacialdragoon',
    requiredLevel: 70,
    rarityTier: 'SS',
    minPiecesFull: 12,
    minPiecesHalf: 6,
    halfBonusRatioPct: 40.0,
    fullBonusRatioPct: 100.0,
    bonusCombatStatsJson: { MAX_HP: 3900, PHYS_ATK: 610, PHYS_DEF: 340 }
  },
  {
    code: 'set_lv70_crystalarchon',
    namePtBr: 'Conjunto do Arconte do Cristal Astral',
    descriptionPtBr: 'Vestimenta de cristal ressonante pulsando com pura energia taumatúrgica do cosmos. Especializado: Mago (Ataque Mágico Titânico, Penetração Mágica e Poder Crítico).',
    prefix: 'equip_lv70_crystalarchon',
    requiredLevel: 70,
    rarityTier: 'SS',
    minPiecesFull: 12,
    minPiecesHalf: 6,
    halfBonusRatioPct: 40.0,
    fullBonusRatioPct: 100.0,
    bonusCombatStatsJson: { MAX_HP: 3000, MAG_ATK: 760, MAG_DEF: 250 }
  },
  {
    code: 'set_lv70_divinearchon',
    namePtBr: 'Conjunto do Arconte Sagrado Imortal',
    descriptionPtBr: 'Armadura sacra impenetrável consagrada pelos altos coros celestes para proteção inviolável. Especializado: Paladino (Defesa Física/Mágica Dupla, HP Supremo e Cura).',
    prefix: 'equip_lv70_divinearchon',
    requiredLevel: 70,
    rarityTier: 'SS',
    minPiecesFull: 12,
    minPiecesHalf: 6,
    halfBonusRatioPct: 40.0,
    fullBonusRatioPct: 100.0,
    bonusCombatStatsJson: { MAX_HP: 5200, PHYS_DEF: 480, MAG_DEF: 370, PHYS_ATK: 400, MAG_ATK: 400 }
  },
  {
    code: 'set_lv70_siegemarksman',
    namePtBr: 'Conjunto do Franco-Atirador do Cerco Pesado',
    descriptionPtBr: 'Traje de combate blindado com sistemas de ancoragem balística para disparos perfurantes de longo alcance. Especializado: Atirador (Ataque Físico, Penetração, Alcance e Dano Crítico).',
    prefix: 'equip_lv70_siegemarksman',
    requiredLevel: 70,
    rarityTier: 'SS',
    minPiecesFull: 12,
    minPiecesHalf: 6,
    halfBonusRatioPct: 40.0,
    fullBonusRatioPct: 100.0,
    bonusCombatStatsJson: { MAX_HP: 3100, PHYS_ATK: 735 }
  },
  {
    code: 'set_lv70_bloodlich',
    namePtBr: 'Conjunto do Grão-Lich do Sangue Carmesim',
    descriptionPtBr: 'Paramentos funerários vermelhos que canalizam a arte proibida do sangue e roubam o vigor vital. Especializado: Necromante (Ataque Mágico, Penetração, Vitalidade e Drenagem de Sangue).',
    prefix: 'equip_lv70_bloodlich',
    requiredLevel: 70,
    rarityTier: 'SS',
    minPiecesFull: 12,
    minPiecesHalf: 6,
    halfBonusRatioPct: 40.0,
    fullBonusRatioPct: 100.0,
    bonusCombatStatsJson: { MAX_HP: 3700, MAG_ATK: 660, MAG_DEF: 270 }
  }
];

export const SET_BLUEPRINTS = [
  {
    setCode: 'set_lv70_solardawn',
    prefix: 'equip_lv70_solardawn',
    setName: 'Alvorada Solar Ígnea',
    classFocus: 'Espadachim',
    archetype: 'PHYS_CRIT_SPEED',
    icons: {
      HEAD: '050314', SHOULDER: '050414', CHEST: '050514', BELT: '050614', LEGS: '050714', FEET: '050814',
      WEAPON_1: '050109', WEAPON_2: '060209',
      RING: '501001', NECKLACE: '500901', ORNAMENT_1: '501101', ORNAMENT_2: '501201'
    },
    pieceNames: {
      HEAD: 'Elmo Radiante da Alvorada Solar',
      SHOULDER: 'Espaldares da Alvorada Solar',
      CHEST: 'Couraça de Ouro da Alvorada Solar',
      BELT: 'Cinturão Flamejante da Alvorada Solar',
      LEGS: 'Grevas Solares da Alvorada Solar',
      FEET: 'Botas de Chamas da Alvorada Solar',
      WEAPON_1: 'Espada Longa da Alvorada Dourada',
      WEAPON_2: 'Wakizashi das Labaredas Solares',
      RING: 'Selo Solar da Alvorada Ígnea',
      NECKLACE: 'Amuleto do Coração do Sol',
      ORNAMENT_1: 'Insígnia Ígnea da Alvorada',
      ORNAMENT_2: 'Gema Prismática da Alvorada'
    }
  },
  {
    setCode: 'set_lv70_nightstalker',
    prefix: 'equip_lv70_nightstalker',
    setName: 'Rastreador das Sombras Noturnas',
    classFocus: 'Ladina',
    archetype: 'PHYS_EVA_SPEED',
    icons: {
      HEAD: '030314', SHOULDER: '030414', CHEST: '030514', BELT: '030614', LEGS: '030714', FEET: '030814',
      WEAPON_1: '060109', WEAPON_2: '060211',
      RING: '501002', NECKLACE: '500902', ORNAMENT_1: '501102', ORNAMENT_2: '501202'
    },
    pieceNames: {
      HEAD: 'Capuz Noturno do Rastreador',
      SHOULDER: 'Ombreiras da Névoa do Rastreador',
      CHEST: 'Gibão Furtivo do Rastreador',
      BELT: 'Cinto de Abrolhos do Rastreador',
      LEGS: 'Calçotes da Meia-Noite do Rastreador',
      FEET: 'Sapatilhas Silenciosas do Rastreador',
      WEAPON_1: 'Presa Venenosa da Meia-Noite',
      WEAPON_2: 'Estilete Fantasmagórico das Sombras',
      RING: 'Anel Noturno do Rastreador',
      NECKLACE: 'Pingente da Névoa Obscura',
      ORNAMENT_1: 'Orbe de Beladona do Rastreador',
      ORNAMENT_2: 'Talismã dos Passos Silenciosos'
    }
  },
  {
    setCode: 'set_lv70_crimsontitan',
    prefix: 'equip_lv70_crimsontitan',
    setName: 'Titã Carmesim Esmagador',
    classFocus: 'Guerreira',
    archetype: 'TANK_BRUISER',
    icons: {
      HEAD: '020314', SHOULDER: '020414', CHEST: '020514', BELT: '020614', LEGS: '020714', FEET: '020814',
      WEAPON_1: '020114', WEAPON_2: '020212',
      RING: '501003', NECKLACE: '500903', ORNAMENT_1: '501103', ORNAMENT_2: '501203'
    },
    pieceNames: {
      HEAD: 'Elmo Chifrudo do Titã Carmesim',
      SHOULDER: 'Espaldares Sanguíneos do Titã Carmesim',
      CHEST: 'Couraça de Aço do Titã Carmesim',
      BELT: 'Faixa de Guerra do Titã Carmesim',
      LEGS: 'Perneiras de Ferro do Titã Carmesim',
      FEET: 'Botas Esmagadoras do Titã Carmesim',
      WEAPON_1: 'Machado Decapitador Carmesim',
      WEAPON_2: 'Escudo de Espinhos do Titã Carmesim',
      RING: 'Anel da Força Titânica Carmesim',
      NECKLACE: 'Gargantilha de Sangue do Colosso',
      ORNAMENT_1: 'Totem da Fúria Carmesim',
      ORNAMENT_2: 'Relíquia de Granito do Titã'
    }
  },
  {
    setCode: 'set_lv70_emeraldgenesis',
    prefix: 'equip_lv70_emeraldgenesis',
    setName: 'Guardiã da Gênese Esmeralda',
    classFocus: 'Curandeira',
    archetype: 'HEALER_SUPPORT',
    icons: {
      HEAD: '040313', SHOULDER: '040413', CHEST: '040513', BELT: '040613', LEGS: '040713', FEET: '040813',
      WEAPON_1: '120006', WEAPON_2: '040208',
      RING: '501004', NECKLACE: '500904', ORNAMENT_1: '501104', ORNAMENT_2: '501204'
    },
    pieceNames: {
      HEAD: 'Tiara Florida da Gênese Esmeralda',
      SHOULDER: 'Estola de Folhas da Gênese Esmeralda',
      CHEST: 'Veste Botânica da Gênese Esmeralda',
      BELT: 'Cordão Vital da Gênese Esmeralda',
      LEGS: 'Saia Sagrada da Gênese Esmeralda',
      FEET: 'Sandálias da Terra da Gênese Esmeralda',
      WEAPON_1: 'Cetro da Floresta da Gênese',
      WEAPON_2: 'Grimório Sagrado da Flor Eterna',
      RING: 'Aro da Bênção Esmeralda',
      NECKLACE: 'Gota de Seiva Ancestral',
      ORNAMENT_1: 'Broto da Árvore da Vida',
      ORNAMENT_2: 'Amuleto da Serenidade Esmeralda'
    }
  },
  {
    setCode: 'set_lv70_windrunner',
    prefix: 'equip_lv70_windrunner',
    setName: 'Corredora dos Ventos Ancestrais',
    classFocus: 'Caçadora',
    archetype: 'PHYS_CRIT_SPEED',
    icons: {
      HEAD: '060314', SHOULDER: '060414', CHEST: '060514', BELT: '060614', LEGS: '060714', FEET: '060814',
      WEAPON_1: '030113', WEAPON_2: '030213',
      RING: '501005', NECKLACE: '500905', ORNAMENT_1: '501105', ORNAMENT_2: '501205'
    },
    pieceNames: {
      HEAD: 'Elmo Alado da Corredora dos Ventos',
      SHOULDER: 'Guarda-Ombros da Corredora dos Ventos',
      CHEST: 'Corselete Élfico da Corredora dos Ventos',
      BELT: 'Cinto de Cartucheira da Corredora dos Ventos',
      LEGS: 'Perneiras Silvestres da Corredora dos Ventos',
      FEET: 'Botas dos Tufões da Corredora dos Ventos',
      WEAPON_1: 'Arco Composto dos Quatro Ventos',
      WEAPON_2: 'Aljava Encantada da Rajada Célere',
      RING: 'Aliança dos Ventos Uivantes',
      NECKLACE: 'Gargantilha da Águia Dourada',
      ORNAMENT_1: 'Pena Sagrada do Falcão dos Céus',
      ORNAMENT_2: 'Bússola Esmeralda do Caçador'
    }
  },
  {
    setCode: 'set_lv70_voideclipse',
    prefix: 'equip_lv70_voideclipse',
    setName: 'Executora do Eclipse do Vazio',
    classFocus: 'Assassina',
    archetype: 'PHYS_BURST_CRIT',
    icons: {
      HEAD: '060315', SHOULDER: '060415', CHEST: '060515', BELT: '060615', LEGS: '060715', FEET: '060815',
      WEAPON_1: '060113', WEAPON_2: '060206',
      RING: '501006', NECKLACE: '500906', ORNAMENT_1: '501106', ORNAMENT_2: '501206'
    },
    pieceNames: {
      HEAD: 'Máscara Obscura do Eclipse do Vazio',
      SHOULDER: 'Hombreiras de Penumbra do Eclipse',
      CHEST: 'Armadura de Seda Sombria do Eclipse',
      BELT: 'Faixa Espelhada do Eclipse do Vazio',
      LEGS: 'Perneiras Espectrais do Eclipse do Vazio',
      FEET: 'Passadas do Vácuo do Eclipse do Vazio',
      WEAPON_1: 'Lâmina Crescente do Eclipse',
      WEAPON_2: 'Katar Sombrio do Vazio Estelar',
      RING: 'Anel da Singularidade Sombria',
      NECKLACE: 'Pingente do Buraco Negro',
      ORNAMENT_1: 'Orbe do Crepúsculo Abissal',
      ORNAMENT_2: 'Cristal Roxo da Destruição Oculta'
    }
  },
  {
    setCode: 'set_lv70_royalsymphony',
    prefix: 'equip_lv70_royalsymphony',
    setName: 'Maestro da Sinfonia Real',
    classFocus: 'Barda',
    archetype: 'BARD_HARMONY',
    icons: {
      HEAD: '020315', SHOULDER: '020415', CHEST: '020515', BELT: '020615', LEGS: '020715', FEET: '020815',
      WEAPON_1: '050107', WEAPON_2: '050208',
      RING: '111001', NECKLACE: '510001', ORNAMENT_1: '501301', ORNAMENT_2: '501401'
    },
    pieceNames: {
      HEAD: 'Chapéu Nobre do Maestro Real',
      SHOULDER: 'Charreteiras de Veludo do Maestro Real',
      CHEST: 'Casaca Cerimonial do Maestro Real',
      BELT: 'Cinto com Fivela de Ouro do Maestro',
      LEGS: 'Calças de Gala do Maestro Real',
      FEET: 'Sapatos Polidos do Maestro Real',
      WEAPON_1: 'Florete Harmônico do Menestrel Real',
      WEAPON_2: 'Broquel Dourado das Sete Notas',
      RING: 'Anel de Ouro da Ária Suprema',
      NECKLACE: 'Medalhão da Clave Imperial',
      ORNAMENT_1: 'Diapasão Cristalino da Ressonância',
      ORNAMENT_2: 'Partitura Ancestral dos Reis'
    }
  },
  {
    setCode: 'set_lv70_glacialdragoon',
    prefix: 'equip_lv70_glacialdragoon',
    setName: 'Lanceiro do Dragão Glacial',
    classFocus: 'Lanceiro',
    archetype: 'PHYS_PIERCE_BALANCED',
    icons: {
      HEAD: '010314', SHOULDER: '010414', CHEST: '010514', BELT: '010614', LEGS: '010714', FEET: '010814',
      WEAPON_1: '010113', WEAPON_2: '010208',
      RING: '111002', NECKLACE: '510002', ORNAMENT_1: '501302', ORNAMENT_2: '501402'
    },
    pieceNames: {
      HEAD: 'Elmo de Geada do Dragão Glacial',
      SHOULDER: 'Espaldares de Gelo Negro do Lanceiro',
      CHEST: 'Couraça de Placas do Dragão Glacial',
      BELT: 'Cinturão de Escamas do Dragão Glacial',
      LEGS: 'Grevas Glaciais do Dragão do Norte',
      FEET: 'Botas Quebra-Gelo do Dragão Glacial',
      WEAPON_1: 'Lança do Presa de Gelo Eterno',
      WEAPON_2: 'Escudo Crista do Dragão Glacial',
      RING: 'Anel da Nevasca Implacável',
      NECKLACE: 'Pingente do Coração de Gelo',
      ORNAMENT_1: 'Fragmento de Geada Perene',
      ORNAMENT_2: 'Escama Azul do Wyrm do Norte'
    }
  },
  {
    setCode: 'set_lv70_crystalarchon',
    prefix: 'equip_lv70_crystalarchon',
    setName: 'Arconte do Cristal Astral',
    classFocus: 'Mago',
    archetype: 'MAGE_BURST',
    icons: {
      HEAD: '040315', SHOULDER: '040415', CHEST: '040515', BELT: '040615', LEGS: '040715', FEET: '040815',
      WEAPON_1: '040109', WEAPON_2: '040207',
      RING: '111003', NECKLACE: '510003', ORNAMENT_1: '501303', ORNAMENT_2: '501403'
    },
    pieceNames: {
      HEAD: 'Coroa de Prismas do Arconte do Cristal',
      SHOULDER: 'Ombreiras de Ametista do Arconte Astral',
      CHEST: 'Manto Estelar do Arconte do Cristal',
      BELT: 'Faixa Ressonante do Arconte do Cristal',
      LEGS: 'Hábito Cristalino do Arconte do Cristal',
      FEET: 'Botins Flutuantes do Arconte do Cristal',
      WEAPON_1: 'Cajado Arcano do Cristal Puro',
      WEAPON_2: 'Esfera Cósmica da Convergência',
      RING: 'Aro Arcano do Prisma Cósmico',
      NECKLACE: 'Colar de Estilhaços Astrais',
      ORNAMENT_1: 'Ampulheta de Areia Temporal',
      ORNAMENT_2: 'Prisma Arcano dos Sete Raios'
    }
  },
  {
    setCode: 'set_lv70_divinearchon',
    prefix: 'equip_lv70_divinearchon',
    setName: 'Arconte Sagrado Imortal',
    classFocus: 'Paladino',
    archetype: 'PALADIN_FORTRESS',
    icons: {
      HEAD: '050315', SHOULDER: '050415', CHEST: '050515', BELT: '050615', LEGS: '050715', FEET: '050815',
      WEAPON_1: '020113', WEAPON_2: '050209',
      RING: '111004', NECKLACE: '510004', ORNAMENT_1: '501304', ORNAMENT_2: '501404'
    },
    pieceNames: {
      HEAD: 'Elmo Seráfico do Arconte Sagrado',
      SHOULDER: 'Espaldares Sagrados do Arconte Imortal',
      CHEST: 'Couraça Inviolável do Arconte Sagrado',
      BELT: 'Cinturão dos Santos do Arconte Sagrado',
      LEGS: 'Grevas Celestiais do Arconte Sagrado',
      FEET: 'Passadas Firmes do Arconte Sagrado',
      WEAPON_1: 'Montante Abençoado do Julgamento',
      WEAPON_2: 'Escudo Pavise do Arconte Imortal',
      RING: 'Selo Sagrado da Redenção',
      NECKLACE: 'Cruz Dourada dos Santos Mártires',
      ORNAMENT_1: 'Cálice da Luz Imperecível',
      ORNAMENT_2: 'Insígnia dos Querubins Divinos'
    }
  },
  {
    setCode: 'set_lv70_siegemarksman',
    prefix: 'equip_lv70_siegemarksman',
    setName: 'Franco-Atirador do Cerco Pesado',
    classFocus: 'Atirador',
    archetype: 'PHYS_PIERCE_BALANCED',
    icons: {
      HEAD: '030315', SHOULDER: '030415', CHEST: '030515', BELT: '030615', LEGS: '030715', FEET: '030815',
      WEAPON_1: '030110', WEAPON_2: '030210',
      RING: '161001', NECKLACE: '510005', ORNAMENT_1: '501305', ORNAMENT_2: '501405'
    },
    pieceNames: {
      HEAD: 'Capacete Balístico do Franco-Atirador',
      SHOULDER: 'Placas Reforçadas do Franco-Atirador',
      CHEST: 'Colete Balístico do Cerco Pesado',
      BELT: 'Cinto Tático com Coldres do Franco-Atirador',
      LEGS: 'Calças Reforçadas com Joelheiras de Aço',
      FEET: 'Botas Magnéticas de Fixação Balística',
      WEAPON_1: 'Fuzil Antimaterial do Cerco Blindado',
      WEAPON_2: 'Tambor de Munição Perfurante Pesada',
      RING: 'Aliança Balística de Precisão',
      NECKLACE: 'Plaqueta de Identificação de Elite',
      ORNAMENT_1: 'Mira Telescópica de Precisão Extrema',
      ORNAMENT_2: 'Estojo de Cartuchos de Alta Pressão'
    }
  },
  {
    setCode: 'set_lv70_bloodlich',
    prefix: 'equip_lv70_bloodlich',
    setName: 'Grão-Lich do Sangue Carmesim',
    classFocus: 'Necromante',
    archetype: 'NECRO_DRAIN',
    icons: {
      HEAD: '040314', SHOULDER: '040414', CHEST: '040514', BELT: '040614', LEGS: '040714', FEET: '040814',
      WEAPON_1: '160007', WEAPON_2: '161007',
      RING: '161002', NECKLACE: '510006', ORNAMENT_1: '501306', ORNAMENT_2: '501406'
    },
    pieceNames: {
      HEAD: 'Capuz Funerário do Grão-Lich',
      SHOULDER: 'Espaldares Sanguíneos do Grão-Lich',
      CHEST: 'Robe Vampírico do Grão-Lich Carmesim',
      BELT: 'Faixa Mortuária do Grão-Lich Carmesim',
      LEGS: 'Vestes Sanguinolentas do Grão-Lich',
      FEET: 'Passos da Morte do Grão-Lich Carmesim',
      WEAPON_1: 'Foice Sanguínea do Ceifador de Almas',
      WEAPON_2: 'Filactéria Maldita do Sangue Eterno',
      RING: 'Selo Sombrio da Noite Carniceira',
      NECKLACE: 'Amuleto da Condenação das Sombras',
      ORNAMENT_1: 'Cálice Sangrento do Necromante',
      ORNAMENT_2: 'Crânio Cristalizado da Agonia'
    }
  }
];

export const SLOT_SUFFIX = {
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

export const ALL_SLOTS = [
  'HEAD', 'SHOULDER', 'CHEST', 'BELT', 'LEGS', 'FEET',
  'WEAPON_1', 'WEAPON_2', 'RING', 'NECKLACE', 'ORNAMENT_1', 'ORNAMENT_2'
];

export function computeSlotCombatStats(archetype, slot) {
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

// 1. Atualiza equipment_sets_definitions.json
const setsDefsPath = path.join(__dirname, 'equipment_sets_definitions.json');
let allSets = JSON.parse(fs.readFileSync(setsDefsPath, 'utf-8'));
const newSetCodes = new Set(NEW_12_LV70_BATCH2_SETS.map((s) => s.code));
allSets = allSets.filter((s) => !newSetCodes.has(s.code)).concat(NEW_12_LV70_BATCH2_SETS);
fs.writeFileSync(setsDefsPath, JSON.stringify(allSets, null, 2), 'utf-8');
console.log(`✅ equipment_sets_definitions.json atualizado com ${allSets.length} conjuntos (incluindo os 12 novos do Batch 2 de Lv.70 Rank SS)!`);

// 2. Constrói os 144 itens de Nível 70 (Rank SS) - Batch 2
const lv70Batch2Items = [];

for (const bp of SET_BLUEPRINTS) {
  for (const slot of ALL_SLOTS) {
    const code = `${bp.prefix}_${SLOT_SUFFIX[slot]}`;
    const namePtBr = bp.pieceNames[slot];
    const iconCode = bp.icons[slot];
    const icon = `assets/equipment/icons/equip_normal_${iconCode}.png`;
    const combatStats = computeSlotCombatStats(bp.archetype, slot);
    const descPtBr = `Relíquia mítica de alto escalão imbuída com poder ancestral. [Conjunto ${bp.setName}: Lv. 70 (Rank SS) - Especializado: ${bp.classFocus}].`;

    lv70Batch2Items.push({
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

const outLv70Batch2Path = path.join(__dirname, 'twelve_level70_batch2_equipment_sets.json');
fs.writeFileSync(outLv70Batch2Path, JSON.stringify(lv70Batch2Items, null, 2), 'utf-8');
console.log(`✅ twelve_level70_batch2_equipment_sets.json gerado com ${lv70Batch2Items.length} peças míticas (Rank SS)!`);
