/**
 * @file scripts/build_level60_data.mjs
 * @description Constrói declarativamente as definições completas de:
 *   1) 12 Novos Conjuntos Lendários de Nível 60 em equipment_sets_definitions.json (totalizando 43 conjuntos).
 *   2) 144 Novas Peças Lendárias de Nível 60 em twelve_level60_equipment_sets.json (totalizando 516 itens no jogo).
 * @rules Estrita observância de AGENTS.md (< 1.000 linhas, 100% combate, sem restrição de classe, sem ouro, sem cosméticos).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// 1. Definições dos 12 Novos Conjuntos Lendários de Nível 60
const NEW_12_SETS = [
  {
    code: 'set_lv60_eclipse',
    namePtBr: 'Conjunto do Eclipse Cósmico',
    descriptionPtBr: 'Necromancia estelar com dreno colossal de essência e aniquilação mágica em área. Ponderado Necromante (75%) > Barda (25%).',
    prefix: 'equip_lv60_eclipse',
    requiredLevel: 60,
    rarityTier: 'LEGENDARY',
    minPiecesFull: 12,
    minPiecesHalf: 6,
    halfBonusRatioPct: 40.0,
    fullBonusRatioPct: 100.0,
    bonusCombatStatsJson: { MAX_HP: 2400, MAG_ATK: 450, MAG_PEN: 165, MAG_DEF: 180, CRIT_RATE: 11.5, CRIT_DMG: 25.0, BATTLE_MOVE_SPEED: 45 }
  },
  {
    code: 'set_lv60_starharmony',
    namePtBr: 'Conjunto da Harmonia Estelar',
    descriptionPtBr: 'Sinfonia cósmica ressoante com suporte em grande escala, aceleração e mana infinita. Ponderado Barda (75%) > Necromante (25%).',
    prefix: 'equip_lv60_starharmony',
    requiredLevel: 60,
    rarityTier: 'LEGENDARY',
    minPiecesFull: 12,
    minPiecesHalf: 6,
    halfBonusRatioPct: 40.0,
    fullBonusRatioPct: 100.0,
    bonusCombatStatsJson: { MAX_HP: 2200, MAG_ATK: 320, HEAL_POWER: 270, ATTACK_SPEED: 0.65, BATTLE_MOVE_SPEED: 75, CRIT_RATE: 9.0, MP_REGEN: 45 }
  },
  {
    code: 'set_lv60_singularity',
    namePtBr: 'Conjunto da Singularidade Cósmica',
    descriptionPtBr: 'Distorção arcana primordial capaz de colapsar o éter em explosões de puro poder elemental. Ponderado Mago (75%) > Curandeira (25%).',
    prefix: 'equip_lv60_singularity',
    requiredLevel: 60,
    rarityTier: 'LEGENDARY',
    minPiecesFull: 12,
    minPiecesHalf: 6,
    halfBonusRatioPct: 40.0,
    fullBonusRatioPct: 100.0,
    bonusCombatStatsJson: { MAX_HP: 2000, MAG_ATK: 520, MAG_PEN: 180, MAG_DEF: 165, CRIT_RATE: 13.0, CRIT_DMG: 30.0, BATTLE_MOVE_SPEED: 45 }
  },
  {
    code: 'set_lv60_redemption',
    namePtBr: 'Conjunto da Redenção Divina',
    descriptionPtBr: 'Luz sagrada suprema com milagres curativos massivos, escudos regenerativos e proteção celestial. Ponderado Curandeira (75%) > Mago (25%).',
    prefix: 'equip_lv60_redemption',
    requiredLevel: 60,
    rarityTier: 'LEGENDARY',
    minPiecesFull: 12,
    minPiecesHalf: 6,
    halfBonusRatioPct: 40.0,
    fullBonusRatioPct: 100.0,
    bonusCombatStatsJson: { MAX_HP: 2800, MAX_MP: 900, HEAL_POWER: 340, MAG_DEF: 240, PHYS_DEF: 190, BATTLE_MOVE_SPEED: 40, HP_REGEN: 60 }
  },
  {
    code: 'set_lv60_berserker',
    namePtBr: 'Conjunto do Berserker Imortal',
    descriptionPtBr: 'Blindagem forjada no núcleo de estrelas mortas com resiliência colossal e esmagamento físico brutal. Ponderado Guerreira (75%) > Lanceiro (25%).',
    prefix: 'equip_lv60_berserker',
    requiredLevel: 60,
    rarityTier: 'LEGENDARY',
    minPiecesFull: 12,
    minPiecesHalf: 6,
    halfBonusRatioPct: 40.0,
    fullBonusRatioPct: 100.0,
    bonusCombatStatsJson: { MAX_HP: 3600, PHYS_ATK: 360, PHYS_DEF: 310, MAG_DEF: 160, BATTLE_MOVE_SPEED: 35, HP_REGEN: 80 }
  },
  {
    code: 'set_lv60_galaxybreaker',
    namePtBr: 'Conjunto do Rompedor de Galáxias',
    descriptionPtBr: 'Estocadas supersônicas capazes de perfurar as defesas mais densas e rasgar linhas de batalha. Ponderado Lanceiro (75%) > Guerreira (25%).',
    prefix: 'equip_lv60_galaxybreaker',
    requiredLevel: 60,
    rarityTier: 'LEGENDARY',
    minPiecesFull: 12,
    minPiecesHalf: 6,
    halfBonusRatioPct: 40.0,
    fullBonusRatioPct: 100.0,
    bonusCombatStatsJson: { MAX_HP: 2600, PHYS_ATK: 420, PHYS_PEN: 185, PHYS_DEF: 220, CRIT_RATE: 12.0, CRIT_DMG: 22.0, BATTLE_MOVE_SPEED: 65 }
  },
  {
    code: 'set_lv60_thunderblade',
    namePtBr: 'Conjunto da Lâmina do Trovão Primordial',
    descriptionPtBr: 'Cortes em velocidade da luz com precisão atômica, taxa crítica fenomenal e contra-ataques reflexivos. Ponderado Espadachim (75%) > Lutadora (25%).',
    prefix: 'equip_lv60_thunderblade',
    requiredLevel: 60,
    rarityTier: 'LEGENDARY',
    minPiecesFull: 12,
    minPiecesHalf: 6,
    halfBonusRatioPct: 40.0,
    fullBonusRatioPct: 100.0,
    bonusCombatStatsJson: { MAX_HP: 2400, PHYS_ATK: 450, CRIT_RATE: 15.0, CRIT_DMG: 32.0, ATTACK_SPEED: 0.75, BATTLE_MOVE_SPEED: 70 }
  },
  {
    code: 'set_lv60_elementalfury',
    namePtBr: 'Conjunto da Fúria Elemental dos Titãs',
    descriptionPtBr: 'Golpes marciais devastadores que canalizam calor e impacto puro para pulverizar alvos no corpo a corpo. Ponderado Lutadora (75%) > Espadachim (25%).',
    prefix: 'equip_lv60_elementalfury',
    requiredLevel: 60,
    rarityTier: 'LEGENDARY',
    minPiecesFull: 12,
    minPiecesHalf: 6,
    halfBonusRatioPct: 40.0,
    fullBonusRatioPct: 100.0,
    bonusCombatStatsJson: { MAX_HP: 3100, PHYS_ATK: 400, PHYS_DEF: 255, PHYS_PEN: 140, ATTACK_SPEED: 0.60, BATTLE_MOVE_SPEED: 50 }
  },
  {
    code: 'set_lv60_celestialfortress',
    namePtBr: 'Conjunto da Fortaleza Celestial',
    descriptionPtBr: 'Égide sacrossanta de platina estelar com resistência mista absoluta e sustentação de fé radiante. Ponderado Paladino (75%) > Caçadora (25%).',
    prefix: 'equip_lv60_celestialfortress',
    requiredLevel: 60,
    rarityTier: 'LEGENDARY',
    minPiecesFull: 12,
    minPiecesHalf: 6,
    halfBonusRatioPct: 40.0,
    fullBonusRatioPct: 100.0,
    bonusCombatStatsJson: { MAX_HP: 3500, PHYS_DEF: 330, MAG_DEF: 250, PHYS_ATK: 270, HEAL_POWER: 150, BATTLE_MOVE_SPEED: 35 }
  },
  {
    code: 'set_lv60_voidstalker',
    namePtBr: 'Conjunto do Caçador do Vácuo Astral',
    descriptionPtBr: 'Mobilidade e alcance supremos para disparos cósmicos que aniquilam alvos a distâncias imensas. Ponderado Caçadora (75%) > Paladino (25%).',
    prefix: 'equip_lv60_voidstalker',
    requiredLevel: 60,
    rarityTier: 'LEGENDARY',
    minPiecesFull: 12,
    minPiecesHalf: 6,
    halfBonusRatioPct: 40.0,
    fullBonusRatioPct: 100.0,
    bonusCombatStatsJson: { MAX_HP: 2300, PHYS_ATK: 430, CRIT_RATE: 14.0, CRIT_DMG: 28.0, BATTLE_MOVE_SPEED: 85, ATTACK_RANGE: 40 }
  },
  {
    code: 'set_lv60_orbitaldestroyer',
    namePtBr: 'Conjunto do Aniquilador Orbital',
    descriptionPtBr: 'Calibre hiperbárico de destruição com perfuração titânica e capacidade de alvejar alvos prioritários. Ponderado Atirador (75%) > Assassino (25%).',
    prefix: 'equip_lv60_orbitaldestroyer',
    requiredLevel: 60,
    rarityTier: 'LEGENDARY',
    minPiecesFull: 12,
    minPiecesHalf: 6,
    halfBonusRatioPct: 40.0,
    fullBonusRatioPct: 100.0,
    bonusCombatStatsJson: { MAX_HP: 2100, PHYS_ATK: 510, PHYS_PEN: 195, CRIT_RATE: 13.5, CRIT_DMG: 32.0, BATTLE_MOVE_SPEED: 55, ATTACK_RANGE: 50 }
  },
  {
    code: 'set_lv60_ghostreaper',
    namePtBr: 'Conjunto do Ceifador Fantasma Cósmico',
    descriptionPtBr: 'Letalidade sobrenatural silenciosa nas trevas, evasão fantasmagórica e execuções críticas imediatas. Ponderado Assassino (75%) > Atirador (25%).',
    prefix: 'equip_lv60_ghostreaper',
    requiredLevel: 60,
    rarityTier: 'LEGENDARY',
    minPiecesFull: 12,
    minPiecesHalf: 6,
    halfBonusRatioPct: 40.0,
    fullBonusRatioPct: 100.0,
    bonusCombatStatsJson: { MAX_HP: 2200, PHYS_ATK: 465, CRIT_RATE: 18.0, CRIT_DMG: 38.0, PHYS_EVASION: 75, BATTLE_MOVE_SPEED: 85 }
  }
];

// Atualiza equipment_sets_definitions.json
const setsDefsPath = path.join(__dirname, 'equipment_sets_definitions.json');
let allSets = JSON.parse(fs.readFileSync(setsDefsPath, 'utf-8'));
// Remove se já existiam e appenda os 12 novos
const newCodes = new Set(NEW_12_SETS.map(s => s.code));
allSets = allSets.filter(s => !newCodes.has(s.code)).concat(NEW_12_SETS);
fs.writeFileSync(setsDefsPath, JSON.stringify(allSets, null, 2), 'utf-8');
console.log(`✅ equipment_sets_definitions.json atualizado com ${allSets.length} conjuntos de equipamentos!`);

// 2. Construtor dos 144 itens
const items = [];

function makeItem(data) {
  items.push(data);
}

// Par 1A: Necromante > Barda (Eclipse Cósmico) - Series 04 Tier 09
makeItem({
  code: 'equip_lv60_eclipse_head',
  slot: 'HEAD',
  namePtBr: 'Coroa do Eclipse Cósmico',
  nameEn: 'Cosmic Eclipse Crown',
  descPtBr: 'Diadema forjado em platina estelar negra que canaliza a visão sombria do vácuo. [Conjunto Eclipse Cósmico: Lv. 60 (Lendário) - Necromante (75%) > Barda (25%)].',
  descEn: 'Diadema forjado em platina estelar negra que canaliza a visão sombria do vácuo. [Cosmic Eclipse Set: Lv. 60 (Legendary) - Necromante (75%) > Barda (25%)].',
  icon: 'assets/equipment/icons/equip_normal_040309.png',
  combatStats: { MAG_ATK: 270, MAX_MP: 580, MAG_DEF: 140, CRIT_RATE: 60 }
});
makeItem({
  code: 'equip_lv60_eclipse_shoulder',
  slot: 'SHOULDER',
  namePtBr: 'Mantos do Eclipse Cósmico',
  nameEn: 'Cosmic Eclipse Mantles',
  descPtBr: 'Ombreiras de seda sombria que absorvem feitiços rivais e desviam ataques mágicos. [Conjunto Eclipse Cósmico: Lv. 60 (Lendário) - Necromante (75%) > Barda (25%)].',
  descEn: 'Ombreiras de seda sombria que absorvem feitiços rivais e desviam ataques mágicos. [Cosmic Eclipse Set: Lv. 60 (Legendary) - Necromante (75%) > Barda (25%)].',
  icon: 'assets/equipment/icons/equip_normal_040409.png',
  combatStats: { MAG_ATK: 200, MAX_MP: 440, MAG_DEF: 200, MAG_EVASION: 50 }
});
makeItem({
  code: 'equip_lv60_eclipse_chest',
  slot: 'CHEST',
  namePtBr: 'Veste Maior do Eclipse Cósmico',
  nameEn: 'Cosmic Eclipse Greater Robe',
  descPtBr: 'Túnica forrada com runas ancestrais de dreno vital que renovam a vida a cada feitiço. [Conjunto Eclipse Cósmico: Lv. 60 (Lendário) - Necromante (75%) > Barda (25%)].',
  descEn: 'Túnica forrada com runas ancestrais de dreno vital que renovam a vida a cada feitiço. [Cosmic Eclipse Set: Lv. 60 (Legendary) - Necromante (75%) > Barda (25%)].',
  icon: 'assets/equipment/icons/equip_normal_040509.png',
  combatStats: { MAG_ATK: 330, MAX_MP: 720, MAG_DEF: 260, HP_REGEN: 60 }
});
makeItem({
  code: 'equip_lv60_eclipse_belt',
  slot: 'BELT',
  namePtBr: 'Faixa do Eclipse Cósmico',
  nameEn: 'Cosmic Eclipse Sash',
  descPtBr: 'Cinto com orbes gravitacionais que restauram mana continuamente durante o combate. [Conjunto Eclipse Cósmico: Lv. 60 (Lendário) - Necromante (75%) > Barda (25%)].',
  descEn: 'Cinto com orbes gravitacionais que restauram mana continuamente durante o combate. [Cosmic Eclipse Set: Lv. 60 (Legendary) - Necromante (75%) > Barda (25%)].',
  icon: 'assets/equipment/icons/equip_normal_040609.png',
  combatStats: { MAG_ATK: 180, MAX_MP: 360, MP_REGEN: 35, MAG_DEF: 120 }
});
makeItem({
  code: 'equip_lv60_eclipse_legs',
  slot: 'LEGS',
  namePtBr: 'Saiote do Eclipse Cósmico',
  nameEn: 'Cosmic Eclipse Skirt',
  descPtBr: 'Perneiras de éter escuro que silenciam passos e aumentam drasticamente a evasão mágica. [Conjunto Eclipse Cósmico: Lv. 60 (Lendário) - Necromante (75%) > Barda (25%)].',
  descEn: 'Perneiras de éter escuro que silenciam passos e aumentam drasticamente a evasão mágica. [Cosmic Eclipse Set: Lv. 60 (Legendary) - Necromante (75%) > Barda (25%)].',
  icon: 'assets/equipment/icons/equip_normal_040709.png',
  combatStats: { MAG_ATK: 250, MAX_MP: 520, MAG_DEF: 210, MAG_EVASION: 60 }
});
makeItem({
  code: 'equip_lv60_eclipse_feet',
  slot: 'FEET',
  namePtBr: 'Botas do Eclipse Cósmico',
  nameEn: 'Cosmic Eclipse Boots',
  descPtBr: 'Calçados que permitem deslizar sobre as sombras com velocidade e leveza inigualáveis. [Conjunto Eclipse Cósmico: Lv. 60 (Lendário) - Necromante (75%) > Barda (25%)].',
  descEn: 'Calçados que permitem deslizar sobre as sombras com velocidade e leveza inigualáveis. [Cosmic Eclipse Set: Lv. 60 (Legendary) - Necromante (75%) > Barda (25%)].',
  icon: 'assets/equipment/icons/equip_normal_040809.png',
  combatStats: { MAG_ATK: 160, MAX_MP: 320, MAG_DEF: 160, BATTLE_MOVE_SPEED: 65, MAG_EVASION: 50 }
});
makeItem({
  code: 'equip_lv60_eclipse_weapon1',
  slot: 'WEAPON_1',
  namePtBr: 'Báculo do Eclipse Cósmico',
  nameEn: 'Cosmic Eclipse Staff',
  descPtBr: 'Cetro lendário coroado por um núcleo estelar escuro pulsante de puro poder necrótico. [Conjunto Eclipse Cósmico: Lv. 60 (Lendário) - Necromante (75%) > Barda (25%)].',
  descEn: 'Cetro lendário coroado por um núcleo estelar escuro pulsante de puro poder necrótico. [Cosmic Eclipse Set: Lv. 60 (Legendary) - Necromante (75%) > Barda (25%)].',
  icon: 'assets/equipment/icons/equip_normal_040116.png',
  combatStats: { MAG_ATK: 650, MAX_MP: 750, CRIT_RATE: 110, CRIT_DMG: 95, MAG_ACCURACY: 75 }
});
makeItem({
  code: 'equip_lv60_eclipse_weapon2',
  slot: 'WEAPON_2',
  namePtBr: 'Tomo do Fim dos Tempos',
  nameEn: 'End of Times Tome',
  descPtBr: 'Grimório lendário com inscrições prohibidas de dreno vital que catalisam maldições mortais. [Conjunto Eclipse Cósmico: Lv. 60 (Lendário) - Necromante (75%) > Barda (25%)].',
  descEn: 'Grimório lendário com inscrições prohibidas de dreno vital que catalisam maldições mortais. [Cosmic Eclipse Set: Lv. 60 (Legendary) - Necromante (75%) > Barda (25%)].',
  icon: 'assets/equipment/icons/equip_normal_040215.png',
  combatStats: { MAG_ATK: 420, MAG_DEF: 220, MAX_MP: 520, HP_REGEN: 55, MAG_ACCURACY: 60 }
});
makeItem({
  code: 'equip_lv60_eclipse_ring',
  slot: 'RING',
  namePtBr: 'Anel do Eclipse Cósmico',
  nameEn: 'Cosmic Eclipse Ring',
  descPtBr: 'Aro de obsidiana estelar que suga a vitalidade dos inimigos a cada impacto arcano. [Conjunto Eclipse Cósmico: Lv. 60 (Lendário) - Necromante (75%) > Barda (25%)].',
  descEn: 'Aro de obsidiana estelar que suga a vitalidade dos inimigos a cada impacto arcano. [Cosmic Eclipse Set: Lv. 60 (Legendary) - Necromante (75%) > Barda (25%)].',
  icon: 'assets/equipment/icons/equip_normal_011009.png',
  combatStats: { MAG_ATK: 200, MAX_MP: 380, CRIT_RATE: 80, HP_REGEN: 35 }
});
makeItem({
  code: 'equip_lv60_eclipse_necklace',
  slot: 'NECKLACE',
  namePtBr: 'Colar do Eclipse Cósmico',
  nameEn: 'Cosmic Eclipse Necklace',
  descPtBr: 'Gargantilha de ônix astral que intensifica dano crítico e precisão mágica. [Conjunto Eclipse Cósmico: Lv. 60 (Lendário) - Necromante (75%) > Barda (25%)].',
  descEn: 'Gargantilha de ônix astral que intensifica dano crítico e precisão mágica. [Cosmic Eclipse Set: Lv. 60 (Legendary) - Necromante (75%) > Barda (25%)].',
  icon: 'assets/equipment/icons/equip_normal_010909.png',
  combatStats: { MAG_ATK: 220, MAX_MP: 450, CRIT_DMG: 75, MAG_ACCURACY: 50 }
});
makeItem({
  code: 'equip_lv60_eclipse_ornament1',
  slot: 'ORNAMENT_1',
  namePtBr: 'Talismã do Eclipse Cósmico',
  nameEn: 'Cosmic Eclipse Talisman',
  descPtBr: 'Relíquia estelar que curva os raios de luz e garante precisão mágica absoluta. [Conjunto Eclipse Cósmico: Lv. 60 (Lendário) - Necromante (75%) > Barda (25%)].',
  descEn: 'Relíquia estelar que curva os raios de luz e garante precisão mágica absoluta. [Cosmic Eclipse Set: Lv. 60 (Legendary) - Necromante (75%) > Barda (25%)].',
  icon: 'assets/equipment/icons/equip_normal_011109.png',
  combatStats: { MAG_ATK: 170, MAX_MP: 330, MAG_ACCURACY: 60, MP_REGEN: 30 }
});
makeItem({
  code: 'equip_lv60_eclipse_ornament2',
  slot: 'ORNAMENT_2',
  namePtBr: 'Orbe das Almas do Eclipse',
  nameEn: 'Eclipse Souls Orb',
  descPtBr: 'Esfera condensada de almas estelares que regenera vida continuamente. [Conjunto Eclipse Cósmico: Lv. 60 (Lendário) - Necromante (75%) > Barda (25%)].',
  descEn: 'Esfera condensada de almas estelares que regenera vida continuamente. [Cosmic Eclipse Set: Lv. 60 (Legendary) - Necromante (75%) > Barda (25%)].',
  icon: 'assets/equipment/icons/equip_normal_011209.png',
  combatStats: { MAG_ATK: 170, MAX_MP: 330, HP_REGEN: 55, BATTLE_MOVE_SPEED: 25 }
});

// Par 1B: Barda > Necromante (Harmonia Estelar) - Series 04 Tier 10
makeItem({
  code: 'equip_lv60_starharmony_head',
  slot: 'HEAD',
  namePtBr: 'Diadema da Harmonia Estelar',
  nameEn: 'Star Harmony Circlet',
  descPtBr: 'Coroa cintilante com gemas celestes que amplifica o alcance vocal e a clareza melódica. [Conjunto Harmonia Estelar: Lv. 60 (Lendário) - Barda (75%) > Necromante (25%)].',
  descEn: 'Coroa cintilante com gemas celestes que amplifica o alcance vocal e a clareza melódica. [Star Harmony Set: Lv. 60 (Legendary) - Barda (75%) > Necromante (25%)].',
  icon: 'assets/equipment/icons/equip_normal_040310.png',
  combatStats: { MAG_ATK: 230, HEAL_POWER: 180, MAG_DEF: 130, MAX_MP: 550, CRIT_RATE: 50 }
});
makeItem({
  code: 'equip_lv60_starharmony_shoulder',
  slot: 'SHOULDER',
  namePtBr: 'Estola da Harmonia Estelar',
  nameEn: 'Star Harmony Stole',
  descPtBr: 'Manto de gala bordado em fios de prata que dissipa feitiços hostis com harmonias sonoras. [Conjunto Harmonia Estelar: Lv. 60 (Lendário) - Barda (75%) > Necromante (25%)].',
  descEn: 'Manto de gala bordado em fios de prata que dissipa feitiços hostis com harmonias sonoras. [Star Harmony Set: Lv. 60 (Legendary) - Barda (75%) > Necromante (25%)].',
  icon: 'assets/equipment/icons/equip_normal_040410.png',
  combatStats: { MAG_ATK: 180, HEAL_POWER: 150, MAG_DEF: 190, MAX_MP: 420, MAG_EVASION: 50 }
});
makeItem({
  code: 'equip_lv60_starharmony_chest',
  slot: 'CHEST',
  namePtBr: 'Veste de Gala da Harmonia Estelar',
  nameEn: 'Star Harmony Gala Robe',
  descPtBr: 'Vestimenta ressonante que restaura a mana do bardo e amplia a regeneração da equipe. [Conjunto Harmonia Estelar: Lv. 60 (Lendário) - Barda (75%) > Necromante (25%)].',
  descEn: 'Vestimenta ressonante que restaura a mana do bardo e amplia a regeneração da equipe. [Star Harmony Set: Lv. 60 (Legendary) - Barda (75%) > Necromante (25%)].',
  icon: 'assets/equipment/icons/equip_normal_040510.png',
  combatStats: { MAG_ATK: 280, HEAL_POWER: 220, MAG_DEF: 240, MP_REGEN: 40, MAX_MP: 680 }
});
makeItem({
  code: 'equip_lv60_starharmony_belt',
  slot: 'BELT',
  namePtBr: 'Faixa Rítmica da Harmonia Estelar',
  nameEn: 'Star Harmony Rhythm Sash',
  descPtBr: 'Cinto com sinos arcanos que mantém a cadência de conjuração e o fluxo de energia ininterruptos. [Conjunto Harmonia Estelar: Lv. 60 (Lendário) - Barda (75%) > Necromante (25%)].',
  descEn: 'Cinto com sinos arcanos que mantém a cadência de conjuração e o fluxo de energia ininterruptos. [Star Harmony Set: Lv. 60 (Legendary) - Barda (75%) > Necromante (25%)].',
  icon: 'assets/equipment/icons/equip_normal_040610.png',
  combatStats: { MAG_ATK: 160, HEAL_POWER: 130, MP_REGEN: 35, MAG_DEF: 110, MAX_MP: 350 }
});
makeItem({
  code: 'equip_lv60_starharmony_legs',
  slot: 'LEGS',
  namePtBr: 'Saiote Ressoante da Harmonia Estelar',
  nameEn: 'Star Harmony Resonant Skirt',
  descPtBr: 'Perneiras flexíveis que facilitam movimentos evasivos graciosos durante a canção. [Conjunto Harmonia Estelar: Lv. 60 (Lendário) - Barda (75%) > Necromante (25%)].',
  descEn: 'Perneiras flexíveis que facilitam movimentos evasivos graciosos durante a canção. [Star Harmony Set: Lv. 60 (Legendary) - Barda (75%) > Necromante (25%)].',
  icon: 'assets/equipment/icons/equip_normal_040710.png',
  combatStats: { MAG_ATK: 220, HEAL_POWER: 170, MAG_DEF: 190, MAX_MP: 480, MAG_EVASION: 55 }
});
makeItem({
  code: 'equip_lv60_starharmony_feet',
  slot: 'FEET',
  namePtBr: 'Botas Ágeis da Harmonia Estelar',
  nameEn: 'Star Harmony Agile Boots',
  descPtBr: 'Calçados leves encantados com o vento que proporcionam locomoção ultra veloz na arena. [Conjunto Harmonia Estelar: Lv. 60 (Lendário) - Barda (75%) > Necromante (25%)].',
  descEn: 'Calçados leves encantados com o vento que proporcionam locomoção ultra veloz na arena. [Star Harmony Set: Lv. 60 (Legendary) - Barda (75%) > Necromante (25%)].',
  icon: 'assets/equipment/icons/equip_normal_040810.png',
  combatStats: { MAG_ATK: 150, HEAL_POWER: 120, MAG_DEF: 140, BATTLE_MOVE_SPEED: 85, MAG_EVASION: 45 }
});
makeItem({
  code: 'equip_lv60_starharmony_weapon1',
  slot: 'WEAPON_1',
  namePtBr: 'Alaúde da Harmonia Cósmica',
  nameEn: 'Cosmic Harmony Lute',
  descPtBr: 'Instrumento divino esculpido em madeira astral com cordas de luz que canalizam canções radiantes. [Conjunto Harmonia Estelar: Lv. 60 (Lendário) - Barda (75%) > Necromante (25%)].',
  descEn: 'Instrumento divino esculpido em madeira astral com cordas de luz que canalizam canções radiantes. [Star Harmony Set: Lv. 60 (Legendary) - Barda (75%) > Necromante (25%)].',
  icon: 'assets/equipment/icons/equip_normal_020116.png',
  combatStats: { MAG_ATK: 580, HEAL_POWER: 360, ATTACK_SPEED: 0.70, BATTLE_MOVE_SPEED: 70, MAX_MP: 650 }
});
makeItem({
  code: 'equip_lv60_starharmony_weapon2',
  slot: 'WEAPON_2',
  namePtBr: 'Flauta Celestial de Éter',
  nameEn: 'Celestial Ether Flute',
  descPtBr: 'Instrumento de sopro cristalino que tece acordes curativos e protege contra energias necróticas. [Conjunto Harmonia Estelar: Lv. 60 (Lendário) - Barda (75%) > Necromante (25%)].',
  descEn: 'Instrumento de sopro cristalino que tece acordes curativos e protege contra energias necróticas. [Star Harmony Set: Lv. 60 (Legendary) - Barda (75%) > Necromante (25%)].',
  icon: 'assets/equipment/icons/equip_normal_020214.png',
  combatStats: { MAG_ATK: 380, HEAL_POWER: 240, MP_REGEN: 45, MAG_DEF: 190, MAX_MP: 450 }
});
makeItem({
  code: 'equip_lv60_starharmony_ring',
  slot: 'RING',
  namePtBr: 'Aliança da Harmonia Estelar',
  nameEn: 'Star Harmony Ring',
  descPtBr: 'Aro com safiras cintilantes que recupera mana em cascata e eleva a chance crítica mágica. [Conjunto Harmonia Estelar: Lv. 60 (Lendário) - Barda (75%) > Necromante (25%)].',
  descEn: 'Aro com safiras cintilantes que recupera mana em cascata e eleva a chance crítica mágica. [Star Harmony Set: Lv. 60 (Legendary) - Barda (75%) > Necromante (25%)].',
  icon: 'assets/equipment/icons/equip_normal_001009.png',
  combatStats: { MAG_ATK: 180, HEAL_POWER: 140, MP_REGEN: 30, CRIT_RATE: 70, MAX_MP: 360 }
});
makeItem({
  code: 'equip_lv60_starharmony_necklace',
  slot: 'NECKLACE',
  namePtBr: 'Gargantilha da Harmonia Estelar',
  nameEn: 'Star Harmony Choker',
  descPtBr: 'Colar afinado na frequência das esferas celestiais que amplia o poder restaurador de feitiços. [Conjunto Harmonia Estelar: Lv. 60 (Lendário) - Barda (75%) > Necromante (25%)].',
  descEn: 'Colar afinado na frequência das esferas celestiais que amplia o poder restaurador de feitiços. [Star Harmony Set: Lv. 60 (Legendary) - Barda (75%) > Necromante (25%)].',
  icon: 'assets/equipment/icons/equip_normal_000909.png',
  combatStats: { MAG_ATK: 200, HEAL_POWER: 160, MP_REGEN: 35, MAX_MP: 420, BATTLE_MOVE_SPEED: 60 }
});
makeItem({
  code: 'equip_lv60_starharmony_ornament1',
  slot: 'ORNAMENT_1',
  namePtBr: 'Diapasão da Harmonia Estelar',
  nameEn: 'Star Harmony Tuning Fork',
  descPtBr: 'Sintonizador ressonante de éter que afina os feitiços com velocidade e precisão melódica. [Conjunto Harmonia Estelar: Lv. 60 (Lendário) - Barda (75%) > Necromante (25%)].',
  descEn: 'Sintonizador ressonante de éter que afina os feitiços com velocidade e precisão melódica. [Star Harmony Set: Lv. 60 (Legendary) - Barda (75%) > Necromante (25%)].',
  icon: 'assets/equipment/icons/equip_normal_001109.png',
  combatStats: { MAG_ATK: 160, HEAL_POWER: 130, BATTLE_MOVE_SPEED: 45, MP_REGEN: 25 }
});
makeItem({
  code: 'equip_lv60_starharmony_ornament2',
  slot: 'ORNAMENT_2',
  namePtBr: 'Partitura das Nove Esferas',
  nameEn: 'Nine Spheres Sheet',
  descPtBr: 'Notas celestes transcritas que concedem evasão mágica reflexiva em situações críticas. [Conjunto Harmonia Estelar: Lv. 60 (Lendário) - Barda (75%) > Necromante (25%)].',
  descEn: 'Notas celestes transcritas que concedem evasão mágica reflexiva em situações críticas. [Star Harmony Set: Lv. 60 (Legendary) - Barda (75%) > Necromante (25%)].',
  icon: 'assets/equipment/icons/equip_normal_001209.png',
  combatStats: { MAG_ATK: 160, HEAL_POWER: 130, MAG_EVASION: 50, MP_REGEN: 25 }
});

// Helper para gerar os outros 10 conjuntos com atributos balanceados e consistentes
const remainingSetsMeta = [
  // Par 2A: Mago > Curandeira (Singularidade)
  {
    prefix: 'equip_lv60_singularity',
    setNamePtBr: 'Singularidade Cósmica',
    setNameEn: 'Cosmic Singularity',
    classRatio: 'Mago (75%) > Curandeira (25%)',
    armorSeries: '03',
    armorTier: '09',
    weapon1Icon: 'assets/equipment/icons/equip_normal_030116.png',
    weapon2Icon: 'assets/equipment/icons/equip_normal_030214.png',
    ringIcon: 'assets/equipment/icons/equip_normal_011010.png',
    neckIcon: 'assets/equipment/icons/equip_normal_010910.png',
    orn1Icon: 'assets/equipment/icons/equip_normal_011110.png',
    orn2Icon: 'assets/equipment/icons/equip_normal_011210.png',
    w1NamePtBr: 'Cetro da Singularidade Cósmica',
    w1NameEn: 'Cosmic Singularity Scepter',
    w2NamePtBr: 'Orbe da Singularidade Absoluta',
    w2NameEn: 'Absolute Singularity Orb',
    isPhys: false,
    theme: 'arcane_blast'
  },
  // Par 2B: Curandeira > Mago (Redenção)
  {
    prefix: 'equip_lv60_redemption',
    setNamePtBr: 'Redenção Divina',
    setNameEn: 'Divine Redemption',
    classRatio: 'Curandeira (75%) > Mago (25%)',
    armorSeries: '03',
    armorTier: '10',
    weapon1Icon: 'assets/equipment/icons/equip_normal_030117.png',
    weapon2Icon: 'assets/equipment/icons/equip_normal_030215.png',
    ringIcon: 'assets/equipment/icons/equip_normal_001010.png',
    neckIcon: 'assets/equipment/icons/equip_normal_000910.png',
    orn1Icon: 'assets/equipment/icons/equip_normal_001110.png',
    orn2Icon: 'assets/equipment/icons/equip_normal_001210.png',
    w1NamePtBr: 'Báculo da Redenção Divina',
    w1NameEn: 'Divine Redemption Staff',
    w2NamePtBr: 'Relicário da Redenção Suprema',
    w2NameEn: 'Supreme Redemption Reliquary',
    isPhys: false,
    theme: 'divine_heal'
  },
  // Par 3A: Guerreira > Lanceiro (Berserker)
  {
    prefix: 'equip_lv60_berserker',
    setNamePtBr: 'Berserker Imortal',
    setNameEn: 'Immortal Berserker',
    classRatio: 'Guerreira (75%) > Lanceiro (25%)',
    armorSeries: '01',
    armorTier: '09',
    weapon1Icon: 'assets/equipment/icons/equip_normal_010116.png',
    weapon2Icon: 'assets/equipment/icons/equip_normal_010214.png',
    ringIcon: 'assets/equipment/icons/equip_normal_011011.png',
    neckIcon: 'assets/equipment/icons/equip_normal_010911.png',
    orn1Icon: 'assets/equipment/icons/equip_normal_011111.png',
    orn2Icon: 'assets/equipment/icons/equip_normal_011211.png',
    w1NamePtBr: 'Espadão do Berserker Imortal',
    w1NameEn: 'Immortal Berserker Greatsword',
    w2NamePtBr: 'Escudo Muralha do Berserker',
    w2NameEn: 'Berserker Bulwark Shield',
    isPhys: true,
    theme: 'warrior_tank'
  },
  // Par 3B: Lanceiro > Guerreira (Rompedor de Galáxias)
  {
    prefix: 'equip_lv60_galaxybreaker',
    setNamePtBr: 'Rompedor de Galáxias',
    setNameEn: 'Galaxy Breaker',
    classRatio: 'Lanceiro (75%) > Guerreira (25%)',
    armorSeries: '01',
    armorTier: '10',
    weapon1Icon: 'assets/equipment/icons/equip_normal_010117.png',
    weapon2Icon: 'assets/equipment/icons/equip_normal_010215.png',
    ringIcon: 'assets/equipment/icons/equip_normal_001011.png',
    neckIcon: 'assets/equipment/icons/equip_normal_000911.png',
    orn1Icon: 'assets/equipment/icons/equip_normal_001111.png',
    orn2Icon: 'assets/equipment/icons/equip_normal_001211.png',
    w1NamePtBr: 'Lança Rompedora de Galáxias',
    w1NameEn: 'Galaxy Breaker Lance',
    w2NamePtBr: 'Broquel de Impulso Galáctico',
    w2NameEn: 'Galactic Impulse Buckler',
    isPhys: true,
    theme: 'lancer_pierce'
  },
  // Par 4A: Espadachim > Lutadora (Lâmina do Trovão)
  {
    prefix: 'equip_lv60_thunderblade',
    setNamePtBr: 'Lâmina do Trovão Primordial',
    setNameEn: 'Primordial Thunderblade',
    classRatio: 'Espadachim (75%) > Lutadora (25%)',
    armorSeries: '05',
    armorTier: '09',
    weapon1Icon: 'assets/equipment/icons/equip_normal_050116.png',
    weapon2Icon: 'assets/equipment/icons/equip_normal_050214.png',
    ringIcon: 'assets/equipment/icons/equip_normal_011012.png',
    neckIcon: 'assets/equipment/icons/equip_normal_010912.png',
    orn1Icon: 'assets/equipment/icons/equip_normal_011112.png',
    orn2Icon: 'assets/equipment/icons/equip_normal_011212.png',
    w1NamePtBr: 'Katana do Trovão Primordial',
    w1NameEn: 'Primordial Thunder Katana',
    w2NamePtBr: 'Wakizashi do Trovão Primordial',
    w2NameEn: 'Primordial Thunder Wakizashi',
    isPhys: true,
    theme: 'swordsman_crit'
  },
  // Par 4B: Lutadora > Espadachim (Fúria Elemental)
  {
    prefix: 'equip_lv60_elementalfury',
    setNamePtBr: 'Fúria Elemental dos Titãs',
    setNameEn: 'Titans Elemental Fury',
    classRatio: 'Lutadora (75%) > Espadachim (25%)',
    armorSeries: '05',
    armorTier: '10',
    weapon1Icon: 'assets/equipment/icons/equip_normal_050117.png',
    weapon2Icon: 'assets/equipment/icons/equip_normal_050215.png',
    ringIcon: 'assets/equipment/icons/equip_normal_001012.png',
    neckIcon: 'assets/equipment/icons/equip_normal_000912.png',
    orn1Icon: 'assets/equipment/icons/equip_normal_001112.png',
    orn2Icon: 'assets/equipment/icons/equip_normal_001212.png',
    w1NamePtBr: 'Manoplas da Fúria Elemental',
    w1NameEn: 'Elemental Fury Gauntlets',
    w2NamePtBr: 'Braçadeiras da Fúria Titânica',
    w2NameEn: 'Titanic Fury Bracers',
    isPhys: true,
    theme: 'fighter_brawl'
  },
  // Par 5A: Paladino > Caçadora (Fortaleza Celestial)
  {
    prefix: 'equip_lv60_celestialfortress',
    setNamePtBr: 'Fortaleza Celestial',
    setNameEn: 'Celestial Fortress',
    classRatio: 'Paladino (75%) > Caçadora (25%)',
    armorSeries: '02',
    armorTier: '09',
    weapon1Icon: 'assets/equipment/icons/equip_normal_020117.png',
    weapon2Icon: 'assets/equipment/icons/equip_normal_020215.png',
    ringIcon: 'assets/equipment/icons/equip_normal_011009.png',
    neckIcon: 'assets/equipment/icons/equip_normal_010909.png',
    orn1Icon: 'assets/equipment/icons/equip_normal_011113.png',
    orn2Icon: 'assets/equipment/icons/equip_normal_011211.png',
    w1NamePtBr: 'Martelo da Fortaleza Celestial',
    w1NameEn: 'Celestial Fortress Warhammer',
    w2NamePtBr: 'Pavês da Fortaleza Celestial',
    w2NameEn: 'Celestial Fortress Tower Shield',
    isPhys: true,
    theme: 'paladin_shield'
  },
  // Par 5B: Caçadora > Paladino (Caçador do Vácuo)
  {
    prefix: 'equip_lv60_voidstalker',
    setNamePtBr: 'Caçador do Vácuo Astral',
    setNameEn: 'Astral Void Stalker',
    classRatio: 'Caçadora (75%) > Paladino (25%)',
    armorSeries: '02',
    armorTier: '10',
    weapon1Icon: 'assets/equipment/icons/equip_normal_020115.png',
    weapon2Icon: 'assets/equipment/icons/equip_normal_020213.png',
    ringIcon: 'assets/equipment/icons/equip_normal_001009.png',
    neckIcon: 'assets/equipment/icons/equip_normal_000909.png',
    orn1Icon: 'assets/equipment/icons/equip_normal_011114.png',
    orn2Icon: 'assets/equipment/icons/equip_normal_011210.png',
    w1NamePtBr: 'Arco do Caçador do Vácuo',
    w1NameEn: 'Void Stalker Bow',
    w2NamePtBr: 'Aljava do Caçador do Vácuo',
    w2NameEn: 'Void Stalker Quiver',
    isPhys: true,
    theme: 'ranger_bow'
  },
  // Par 6A: Atirador > Assassino (Aniquilador Orbital)
  {
    prefix: 'equip_lv60_orbitaldestroyer',
    setNamePtBr: 'Aniquilador Orbital',
    setNameEn: 'Orbital Destroyer',
    classRatio: 'Atirador (75%) > Assassino (25%)',
    armorSeries: '06',
    armorTier: '09',
    weapon1Icon: 'assets/equipment/icons/equip_normal_060117.png',
    weapon2Icon: 'assets/equipment/icons/equip_normal_060215.png',
    ringIcon: 'assets/equipment/icons/equip_normal_011010.png',
    neckIcon: 'assets/equipment/icons/equip_normal_010910.png',
    orn1Icon: 'assets/equipment/icons/equip_normal_011115.png',
    orn2Icon: 'assets/equipment/icons/equip_normal_011212.png',
    w1NamePtBr: 'Rifle Aniquilador Orbital',
    w1NameEn: 'Orbital Destroyer Rifle',
    w2NamePtBr: 'Canhão Secundário Orbital',
    w2NameEn: 'Orbital Secondary Cannon',
    isPhys: true,
    theme: 'gunner_heavy'
  },
  // Par 6B: Assassino > Atirador (Ceifador Fantasma)
  {
    prefix: 'equip_lv60_ghostreaper',
    setNamePtBr: 'Ceifador Fantasma Cósmico',
    setNameEn: 'Cosmic Ghost Reaper',
    classRatio: 'Assassino (75%) > Atirador (25%)',
    armorSeries: '06',
    armorTier: '10',
    weapon1Icon: 'assets/equipment/icons/equip_normal_060116.png',
    weapon2Icon: 'assets/equipment/icons/equip_normal_060214.png',
    ringIcon: 'assets/equipment/icons/equip_normal_001010.png',
    neckIcon: 'assets/equipment/icons/equip_normal_000910.png',
    orn1Icon: 'assets/equipment/icons/equip_normal_001110.png',
    orn2Icon: 'assets/equipment/icons/equip_normal_001210.png',
    w1NamePtBr: 'Adagas do Ceifador Fantasma',
    w1NameEn: 'Ghost Reaper Daggers',
    w2NamePtBr: 'Garra Sombria do Ceifador',
    w2NameEn: 'Ghost Reaper Shadow Claw',
    isPhys: true,
    theme: 'assassin_stealth'
  }
];

for (const m of remainingSetsMeta) {
  const p = m.prefix;
  const s = m.setNamePtBr;
  const se = m.setNameEn;
  const r = m.classRatio;
  const as = m.armorSeries;
  const at = m.armorTier;

  // Gerador de estatísticas temáticas de alto escalão (Lv. 60 Lendário)
  let statsGen;
  if (m.theme === 'arcane_blast') {
    statsGen = {
      head: { MAG_ATK: 290, MAX_MP: 620, MAG_DEF: 140, CRIT_RATE: 70 },
      shoulder: { MAG_ATK: 220, MAX_MP: 480, MAG_DEF: 200, MAG_PEN: 50 },
      chest: { MAG_ATK: 360, MAX_MP: 780, MAG_DEF: 250, MAG_PEN: 70 },
      belt: { MAG_ATK: 190, MAX_MP: 400, MP_REGEN: 35, MAG_DEF: 120 },
      legs: { MAG_ATK: 270, MAX_MP: 560, MAG_DEF: 210, MAG_PEN: 60 },
      feet: { MAG_ATK: 170, MAX_MP: 360, MAG_DEF: 160, BATTLE_MOVE_SPEED: 65, MAG_EVASION: 50 },
      w1: { MAG_ATK: 740, MAX_MP: 800, CRIT_RATE: 120, CRIT_DMG: 105, MAG_ACCURACY: 85 },
      w2: { MAG_ATK: 460, MAG_DEF: 200, MAX_MP: 580, MAG_PEN: 80, MAG_ACCURACY: 65 },
      ring: { MAG_ATK: 210, MAX_MP: 420, CRIT_RATE: 85, MAG_PEN: 50 },
      neck: { MAG_ATK: 230, MAX_MP: 480, CRIT_DMG: 80, MAG_ACCURACY: 55 },
      orn1: { MAG_ATK: 180, MAX_MP: 360, MAG_ACCURACY: 65, MAG_PEN: 50 },
      orn2: { MAG_ATK: 180, MAX_MP: 360, CRIT_DMG: 70, BATTLE_MOVE_SPEED: 30 }
    };
  } else if (m.theme === 'divine_heal') {
    statsGen = {
      head: { MAG_ATK: 220, HEAL_POWER: 250, MAG_DEF: 180, PHYS_DEF: 150, MAX_HP: 850 },
      shoulder: { MAG_ATK: 170, HEAL_POWER: 200, MAG_DEF: 220, PHYS_DEF: 170, MAX_HP: 650 },
      chest: { MAG_ATK: 260, HEAL_POWER: 310, MAG_DEF: 280, PHYS_DEF: 220, MAX_HP: 1100 },
      belt: { MAG_ATK: 150, HEAL_POWER: 170, MP_REGEN: 45, MAG_DEF: 160, MAX_HP: 550 },
      legs: { MAG_ATK: 210, HEAL_POWER: 240, MAG_DEF: 240, PHYS_DEF: 180, MAX_HP: 750 },
      feet: { MAG_ATK: 140, HEAL_POWER: 160, MAG_DEF: 180, PHYS_DEF: 140, BATTLE_MOVE_SPEED: 60 },
      w1: { MAG_ATK: 550, HEAL_POWER: 520, MAX_MP: 850, MAG_DEF: 280, MP_REGEN: 50 },
      w2: { MAG_ATK: 350, HEAL_POWER: 340, PHYS_DEF: 260, MAG_DEF: 290, MAX_HP: 600 },
      ring: { MAG_ATK: 170, HEAL_POWER: 190, MP_REGEN: 40, MAG_DEF: 200, MAX_HP: 500 },
      neck: { MAG_ATK: 190, HEAL_POWER: 220, MP_REGEN: 45, MAG_DEF: 220, MAX_HP: 550 },
      orn1: { MAG_ATK: 150, HEAL_POWER: 170, HP_REGEN: 60, MP_REGEN: 35 },
      orn2: { MAG_ATK: 150, HEAL_POWER: 170, MAG_DEF: 180, BATTLE_MOVE_SPEED: 30 }
    };
  } else if (m.theme === 'warrior_tank') {
    statsGen = {
      head: { PHYS_DEF: 310, MAG_DEF: 200, MAX_HP: 1200, PHYS_ATK: 130, HP_REGEN: 60 },
      shoulder: { PHYS_DEF: 240, MAG_DEF: 160, MAX_HP: 950, PHYS_ATK: 100 },
      chest: { PHYS_DEF: 390, MAG_DEF: 260, MAX_HP: 1600, PHYS_ATK: 160, HP_REGEN: 80 },
      belt: { PHYS_DEF: 210, MAG_DEF: 140, MAX_HP: 800, PHYS_ATK: 90, HP_REGEN: 50 },
      legs: { PHYS_DEF: 290, MAG_DEF: 190, MAX_HP: 1100, PHYS_ATK: 120 },
      feet: { PHYS_DEF: 190, MAG_DEF: 130, MAX_HP: 700, PHYS_ATK: 80, BATTLE_MOVE_SPEED: 60 },
      w1: { PHYS_ATK: 720, MAX_HP: 1750, PHYS_DEF: 180, PHYS_PEN: 90, CRIT_RATE: 80 },
      w2: { PHYS_ATK: 240, PHYS_DEF: 520, MAG_DEF: 240, MAX_HP: 1450, HP_REGEN: 70 },
      ring: { PHYS_ATK: 220, PHYS_DEF: 200, MAX_HP: 850, HP_REGEN: 50 },
      neck: { PHYS_ATK: 240, PHYS_DEF: 220, MAX_HP: 950, HP_REGEN: 60 },
      orn1: { PHYS_ATK: 190, PHYS_DEF: 180, MAX_HP: 750, PHYS_PEN: 50 },
      orn2: { PHYS_ATK: 190, PHYS_DEF: 180, MAX_HP: 750, BATTLE_MOVE_SPEED: 30 }
    };
  } else if (m.theme === 'lancer_pierce') {
    statsGen = {
      head: { PHYS_DEF: 270, MAG_DEF: 160, MAX_HP: 950, PHYS_ATK: 180, CRIT_RATE: 75 },
      shoulder: { PHYS_DEF: 210, MAG_DEF: 130, MAX_HP: 750, PHYS_ATK: 140, PHYS_PEN: 45 },
      chest: { PHYS_DEF: 340, MAG_DEF: 210, MAX_HP: 1250, PHYS_ATK: 230, PHYS_PEN: 70 },
      belt: { PHYS_DEF: 180, MAG_DEF: 110, MAX_HP: 650, PHYS_ATK: 120, PHYS_PEN: 40 },
      legs: { PHYS_DEF: 250, MAG_DEF: 150, MAX_HP: 880, PHYS_ATK: 160, PHYS_PEN: 50 },
      feet: { PHYS_DEF: 170, MAG_DEF: 110, MAX_HP: 600, PHYS_ATK: 110, BATTLE_MOVE_SPEED: 80 },
      w1: { PHYS_ATK: 760, MAX_HP: 1350, PHYS_PEN: 140, CRIT_RATE: 95, PHYS_ACCURACY: 85 },
      w2: { PHYS_ATK: 320, PHYS_DEF: 340, MAG_DEF: 160, MAX_HP: 900, PHYS_PEN: 80 },
      ring: { PHYS_ATK: 240, PHYS_DEF: 130, MAX_HP: 700, CRIT_RATE: 80, PHYS_PEN: 60 },
      neck: { PHYS_ATK: 260, PHYS_DEF: 140, MAX_HP: 750, CRIT_DMG: 75, PHYS_PEN: 65 },
      orn1: { PHYS_ATK: 200, PHYS_DEF: 110, MAX_HP: 600, PHYS_ACCURACY: 60 },
      orn2: { PHYS_ATK: 200, PHYS_DEF: 110, MAX_HP: 600, BATTLE_MOVE_SPEED: 50 }
    };
  } else if (m.theme === 'swordsman_crit') {
    statsGen = {
      head: { PHYS_DEF: 260, MAG_DEF: 140, MAX_HP: 850, PHYS_ATK: 190, CRIT_RATE: 80 },
      shoulder: { PHYS_DEF: 200, MAG_DEF: 110, MAX_HP: 700, PHYS_ATK: 150, PHYS_EVASION: 45 },
      chest: { PHYS_DEF: 330, MAG_DEF: 180, MAX_HP: 1150, PHYS_ATK: 240, CRIT_RATE: 70 },
      belt: { PHYS_DEF: 180, MAG_DEF: 100, MAX_HP: 600, PHYS_ATK: 130, CRIT_RATE: 40 },
      legs: { PHYS_DEF: 240, MAG_DEF: 130, MAX_HP: 800, PHYS_ATK: 170, PHYS_EVASION: 50 },
      feet: { PHYS_DEF: 160, MAG_DEF: 90, MAX_HP: 550, PHYS_ATK: 120, BATTLE_MOVE_SPEED: 85 },
      w1: { PHYS_ATK: 730, CRIT_RATE: 130, CRIT_DMG: 115, ATTACK_SPEED: 0.65, PHYS_ACCURACY: 80 },
      w2: { PHYS_ATK: 430, PHYS_DEF: 220, CRIT_RATE: 95, ATTACK_SPEED: 0.50, PHYS_ACCURACY: 65 },
      ring: { PHYS_ATK: 240, CRIT_RATE: 100, CRIT_DMG: 70, MAX_HP: 650 },
      neck: { PHYS_ATK: 260, CRIT_RATE: 105, CRIT_DMG: 75, MAX_HP: 700 },
      orn1: { PHYS_ATK: 200, PHYS_ACCURACY: 65, CRIT_RATE: 60, MAX_HP: 550 },
      orn2: { PHYS_ATK: 200, BATTLE_MOVE_SPEED: 55, PHYS_EVASION: 50, MAX_HP: 550 }
    };
  } else if (m.theme === 'fighter_brawl') {
    statsGen = {
      head: { PHYS_DEF: 280, MAG_DEF: 160, MAX_HP: 1150, PHYS_ATK: 170, PHYS_EVASION: 60 },
      shoulder: { PHYS_DEF: 210, MAG_DEF: 120, MAX_HP: 900, PHYS_ATK: 140, PHYS_EVASION: 45 },
      chest: { PHYS_DEF: 350, MAG_DEF: 210, MAX_HP: 1550, PHYS_ATK: 210, HP_REGEN: 60 },
      belt: { PHYS_DEF: 190, MAG_DEF: 110, MAX_HP: 800, PHYS_ATK: 120, HP_REGEN: 50 },
      legs: { PHYS_DEF: 260, MAG_DEF: 150, MAX_HP: 1050, PHYS_ATK: 150, PHYS_EVASION: 50 },
      feet: { PHYS_DEF: 170, MAG_DEF: 100, MAX_HP: 700, PHYS_ATK: 110, BATTLE_MOVE_SPEED: 80 },
      w1: { PHYS_ATK: 680, ATTACK_SPEED: 0.85, MAX_HP: 1450, PHYS_PEN: 110, PHYS_DEF: 70 },
      w2: { PHYS_ATK: 390, ATTACK_SPEED: 0.60, MAX_HP: 1100, PHYS_DEF: 260, PHYS_PEN: 80 },
      ring: { PHYS_ATK: 220, PHYS_DEF: 190, MAX_HP: 850, PHYS_PEN: 50 },
      neck: { PHYS_ATK: 240, PHYS_DEF: 210, MAX_HP: 900, PHYS_PEN: 55 },
      orn1: { PHYS_ATK: 180, PHYS_DEF: 160, MAX_HP: 750, PHYS_EVASION: 50 },
      orn2: { PHYS_ATK: 180, PHYS_DEF: 160, MAX_HP: 750, BATTLE_MOVE_SPEED: 45 }
    };
  } else if (m.theme === 'paladin_shield') {
    statsGen = {
      head: { PHYS_DEF: 290, MAG_DEF: 230, MAX_HP: 1100, PHYS_ATK: 140, HEAL_POWER: 140 },
      shoulder: { PHYS_DEF: 230, MAG_DEF: 180, MAX_HP: 880, PHYS_ATK: 110, HEAL_POWER: 110 },
      chest: { PHYS_DEF: 370, MAG_DEF: 300, MAX_HP: 1500, PHYS_ATK: 180, HEAL_POWER: 180 },
      belt: { PHYS_DEF: 200, MAG_DEF: 160, MAX_HP: 750, PHYS_ATK: 100, HP_REGEN: 40 },
      legs: { PHYS_DEF: 270, MAG_DEF: 210, MAX_HP: 1000, PHYS_ATK: 130, HEAL_POWER: 130 },
      feet: { PHYS_DEF: 180, MAG_DEF: 140, MAX_HP: 650, PHYS_ATK: 90, BATTLE_MOVE_SPEED: 60 },
      w1: { PHYS_ATK: 670, HEAL_POWER: 280, MAX_HP: 1500, PHYS_DEF: 240, MAG_DEF: 180 },
      w2: { PHYS_ATK: 260, PHYS_DEF: 480, MAG_DEF: 360, MAX_HP: 1300, HEAL_POWER: 200 },
      ring: { PHYS_ATK: 200, PHYS_DEF: 210, MAG_DEF: 170, MAX_HP: 750, HEAL_POWER: 120 },
      neck: { PHYS_ATK: 220, PHYS_DEF: 230, MAG_DEF: 190, MAX_HP: 800, HEAL_POWER: 140 },
      orn1: { PHYS_ATK: 170, PHYS_DEF: 170, MAG_DEF: 140, MAX_HP: 600, HP_REGEN: 45 },
      orn2: { PHYS_ATK: 170, PHYS_DEF: 170, MAG_DEF: 140, MAX_HP: 600, BATTLE_MOVE_SPEED: 30 }
    };
  } else if (m.theme === 'ranger_bow') {
    statsGen = {
      head: { PHYS_DEF: 250, MAG_DEF: 150, MAX_HP: 800, PHYS_ATK: 200, CRIT_RATE: 75 },
      shoulder: { PHYS_DEF: 190, MAG_DEF: 120, MAX_HP: 650, PHYS_ATK: 150, PHYS_EVASION: 50 },
      chest: { PHYS_DEF: 310, MAG_DEF: 190, MAX_HP: 1050, PHYS_ATK: 250, CRIT_RATE: 65 },
      belt: { PHYS_DEF: 170, MAG_DEF: 110, MAX_HP: 580, PHYS_ATK: 130, CRIT_RATE: 45 },
      legs: { PHYS_DEF: 230, MAG_DEF: 140, MAX_HP: 750, PHYS_ATK: 170, PHYS_EVASION: 55 },
      feet: { PHYS_DEF: 150, MAG_DEF: 100, MAX_HP: 500, PHYS_ATK: 120, BATTLE_MOVE_SPEED: 90 },
      w1: { PHYS_ATK: 740, CRIT_RATE: 120, CRIT_DMG: 100, ATTACK_RANGE: 85, PHYS_ACCURACY: 80 },
      w2: { PHYS_ATK: 380, PHYS_DEF: 190, CRIT_RATE: 85, ATTACK_RANGE: 55, PHYS_ACCURACY: 70 },
      ring: { PHYS_ATK: 230, CRIT_RATE: 90, CRIT_DMG: 70, MAX_HP: 600 },
      neck: { PHYS_ATK: 250, CRIT_RATE: 95, CRIT_DMG: 75, MAX_HP: 650 },
      orn1: { PHYS_ATK: 190, PHYS_ACCURACY: 70, ATTACK_RANGE: 40, MAX_HP: 500 },
      orn2: { PHYS_ATK: 190, BATTLE_MOVE_SPEED: 60, PHYS_EVASION: 55, MAX_HP: 500 }
    };
  } else if (m.theme === 'gunner_heavy') {
    statsGen = {
      head: { PHYS_DEF: 250, MAG_DEF: 150, MAX_HP: 780, PHYS_ATK: 210, CRIT_RATE: 80 },
      shoulder: { PHYS_DEF: 190, MAG_DEF: 120, MAX_HP: 620, PHYS_ATK: 160, PHYS_PEN: 50 },
      chest: { PHYS_DEF: 320, MAG_DEF: 190, MAX_HP: 1000, PHYS_ATK: 270, PHYS_PEN: 80 },
      belt: { PHYS_DEF: 170, MAG_DEF: 110, MAX_HP: 550, PHYS_ATK: 140, PHYS_PEN: 45 },
      legs: { PHYS_DEF: 230, MAG_DEF: 140, MAX_HP: 720, PHYS_ATK: 180, PHYS_PEN: 55 },
      feet: { PHYS_DEF: 150, MAG_DEF: 100, MAX_HP: 480, PHYS_ATK: 130, BATTLE_MOVE_SPEED: 75 },
      w1: { PHYS_ATK: 780, PHYS_PEN: 160, CRIT_RATE: 120, ATTACK_RANGE: 105, PHYS_ACCURACY: 85 },
      w2: { PHYS_ATK: 410, PHYS_DEF: 190, PHYS_PEN: 110, ATTACK_RANGE: 65, PHYS_ACCURACY: 70 },
      ring: { PHYS_ATK: 250, CRIT_RATE: 100, PHYS_PEN: 70, MAX_HP: 580 },
      neck: { PHYS_ATK: 270, CRIT_DMG: 85, PHYS_PEN: 75, MAX_HP: 620 },
      orn1: { PHYS_ATK: 210, PHYS_ACCURACY: 75, ATTACK_RANGE: 50, MAX_HP: 500 },
      orn2: { PHYS_ATK: 210, BATTLE_MOVE_SPEED: 50, PHYS_PEN: 60, MAX_HP: 500 }
    };
  } else if (m.theme === 'assassin_stealth') {
    statsGen = {
      head: { PHYS_DEF: 240, MAG_DEF: 140, MAX_HP: 750, PHYS_ATK: 210, CRIT_RATE: 95 },
      shoulder: { PHYS_DEF: 180, MAG_DEF: 110, MAX_HP: 600, PHYS_ATK: 160, PHYS_EVASION: 60 },
      chest: { PHYS_DEF: 300, MAG_DEF: 180, MAX_HP: 980, PHYS_ATK: 260, PHYS_EVASION: 80 },
      belt: { PHYS_DEF: 160, MAG_DEF: 100, MAX_HP: 520, PHYS_ATK: 140, CRIT_RATE: 55 },
      legs: { PHYS_DEF: 220, MAG_DEF: 130, MAX_HP: 700, PHYS_ATK: 180, PHYS_EVASION: 65 },
      feet: { PHYS_DEF: 140, MAG_DEF: 90, MAX_HP: 450, PHYS_ATK: 130, BATTLE_MOVE_SPEED: 95, PHYS_EVASION: 60 },
      w1: { PHYS_ATK: 710, CRIT_RATE: 150, CRIT_DMG: 135, ATTACK_SPEED: 0.75, PHYS_EVASION: 85 },
      w2: { PHYS_ATK: 420, ATTACK_SPEED: 0.65, CRIT_RATE: 110, PHYS_EVASION: 70, PHYS_ACCURACY: 65 },
      ring: { PHYS_ATK: 250, CRIT_RATE: 115, CRIT_DMG: 85, MAX_HP: 550 },
      neck: { PHYS_ATK: 270, CRIT_RATE: 120, CRIT_DMG: 90, MAX_HP: 600 },
      orn1: { PHYS_ATK: 210, PHYS_EVASION: 75, CRIT_RATE: 65, MAX_HP: 480 },
      orn2: { PHYS_ATK: 210, BATTLE_MOVE_SPEED: 65, PHYS_ACCURACY: 70, MAX_HP: 480 }
    };
  }

  // Monta as 12 peças
  makeItem({
    code: `${p}_head`,
    slot: 'HEAD',
    namePtBr: `Elmo do ${s}`,
    nameEn: `${se} Helm`,
    descPtBr: `Proteção craniana lendária forjada para campeões veteranos. [Conjunto ${s}: Lv. 60 (Lendário) - ${r}].`,
    descEn: `Legendary headgear forged for veteran champions. [${se} Set: Lv. 60 (Legendary) - ${r}].`,
    icon: `assets/equipment/icons/equip_normal_${as}03${at}.png`,
    combatStats: statsGen.head
  });
  makeItem({
    code: `${p}_shoulder`,
    slot: 'SHOULDER',
    namePtBr: `Ombreiras do ${s}`,
    nameEn: `${se} Pauldrons`,
    descPtBr: `Espaldares reforçados que defletem impactos e estabilizam postura marcial. [Conjunto ${s}: Lv. 60 (Lendário) - ${r}].`,
    descEn: `Reinforced pauldrons that deflect strikes and stabilize battle posture. [${se} Set: Lv. 60 (Legendary) - ${r}].`,
    icon: `assets/equipment/icons/equip_normal_${as}04${at}.png`,
    combatStats: statsGen.shoulder
  });
  makeItem({
    code: `${p}_chest`,
    slot: 'CHEST',
    namePtBr: `Peitoral do ${s}`,
    nameEn: `${se} Chestplate`,
    descPtBr: `Armadura de tronco sublime com resistência física e mágica incomparáveis. [Conjunto ${s}: Lv. 60 (Lendário) - ${r}].`,
    descEn: `Sublime torso armor granting unmatched physical and magical defense. [${se} Set: Lv. 60 (Legendary) - ${r}].`,
    icon: `assets/equipment/icons/equip_normal_${as}05${at}.png`,
    combatStats: statsGen.chest
  });
  makeItem({
    code: `${p}_belt`,
    slot: 'BELT',
    namePtBr: `Cinto do ${s}`,
    nameEn: `${se} Belt`,
    descPtBr: `Cinturão reforçado com placas rúnicas para equilíbrio perfeito em combate. [Conjunto ${s}: Lv. 60 (Lendário) - ${r}].`,
    descEn: `Reinforced belt with runic plating for ideal combat equilibrium. [${se} Set: Lv. 60 (Legendary) - ${r}].`,
    icon: `assets/equipment/icons/equip_normal_${as}06${at}.png`,
    combatStats: statsGen.belt
  });
  makeItem({
    code: `${p}_legs`,
    slot: 'LEGS',
    namePtBr: `Grevas do ${s}`,
    nameEn: `${se} Greaves`,
    descPtBr: `Perneiras articuladas de alta mobilidade e absorção de choque contínuo. [Conjunto ${s}: Lv. 60 (Lendário) - ${r}].`,
    descEn: `Articulated greaves providing high mobility and continuous shock absorption. [${se} Set: Lv. 60 (Legendary) - ${r}].`,
    icon: `assets/equipment/icons/equip_normal_${as}07${at}.png`,
    combatStats: statsGen.legs
  });
  makeItem({
    code: `${p}_feet`,
    slot: 'FEET',
    namePtBr: `Botas do ${s}`,
    nameEn: `${se} Boots`,
    descPtBr: `Calçados lendários que conferem propulsão e agilidade suprema em terreno hostil. [Conjunto ${s}: Lv. 60 (Lendário) - ${r}].`,
    descEn: `Legendary footwear providing supreme speed and propulsion across hostile terrain. [${se} Set: Lv. 60 (Legendary) - ${r}].`,
    icon: `assets/equipment/icons/equip_normal_${as}08${at}.png`,
    combatStats: statsGen.feet
  });
  makeItem({
    code: `${p}_weapon1`,
    slot: 'WEAPON_1',
    namePtBr: m.w1NamePtBr,
    nameEn: m.w1NameEn,
    descPtBr: `Arma primária lendária consagrada nas mais ferozes guerras divinas. [Conjunto ${s}: Lv. 60 (Lendário) - ${r}].`,
    descEn: `Legendary primary weapon consecrated in the fiercest divine wars. [${se} Set: Lv. 60 (Legendary) - ${r}].`,
    icon: m.weapon1Icon,
    combatStats: statsGen.w1
  });
  makeItem({
    code: `${p}_weapon2`,
    slot: 'WEAPON_2',
    namePtBr: m.w2NamePtBr,
    nameEn: m.w2NameEn,
    descPtBr: `Armamento secundário lendário perfeitamente balanceado para máxima eficácia tática. [Conjunto ${s}: Lv. 60 (Lendário) - ${r}].`,
    descEn: `Legendary secondary equipment perfectly balanced for maximum tactical efficiency. [${se} Set: Lv. 60 (Legendary) - ${r}].`,
    icon: m.weapon2Icon,
    combatStats: statsGen.w2
  });
  makeItem({
    code: `${p}_ring`,
    slot: 'RING',
    namePtBr: `Anel do ${s}`,
    nameEn: `${se} Ring`,
    descPtBr: `Joia lendária incrustada com essência cósmica que aprimora o poder de batalha. [Conjunto ${s}: Lv. 60 (Lendário) - ${r}].`,
    descEn: `Legendary ring encrusted with cosmic essence boosting combat prowess. [${se} Set: Lv. 60 (Legendary) - ${r}].`,
    icon: m.ringIcon,
    combatStats: statsGen.ring
  });
  makeItem({
    code: `${p}_necklace`,
    slot: 'NECKLACE',
    namePtBr: `Colar do ${s}`,
    nameEn: `${se} Necklace`,
    descPtBr: `Amuleto sagrado que amplia atributos ofensivos e letalidade de golpes. [Conjunto ${s}: Lv. 60 (Lendário) - ${r}].`,
    descEn: `Sacred necklace amplifying offensive attributes and critical strike power. [${se} Set: Lv. 60 (Legendary) - ${r}].`,
    icon: m.neckIcon,
    combatStats: statsGen.neck
  });
  makeItem({
    code: `${p}_ornament1`,
    slot: 'ORNAMENT_1',
    namePtBr: `Ornamento Tático do ${s}`,
    nameEn: `${se} Tactical Ornament`,
    descPtBr: `Acessório tático lendário que aperfeiçoa reflexos, precisão e velocidade. [Conjunto ${s}: Lv. 60 (Lendário) - ${r}].`,
    descEn: `Tactical legendary ornament improving reflexes, accuracy, and quickness. [${se} Set: Lv. 60 (Legendary) - ${r}].`,
    icon: m.orn1Icon,
    combatStats: statsGen.orn1
  });
  makeItem({
    code: `${p}_ornament2`,
    slot: 'ORNAMENT_2',
    namePtBr: `Insígnia dos Deuses do ${s}`,
    nameEn: `${se} Gods Insignia`,
    descPtBr: `Selo de glória que canaliza a bênção dos deuses ancestrais de Etheria. [Conjunto ${s}: Lv. 60 (Lendário) - ${r}].`,
    descEn: `Glory crest channeling the blessings of ancient Etherian gods. [${se} Set: Lv. 60 (Legendary) - ${r}].`,
    icon: m.orn2Icon,
    combatStats: statsGen.orn2
  });
}

// Salva twelve_level60_equipment_sets.json
const itemsPath = path.join(__dirname, 'twelve_level60_equipment_sets.json');
fs.writeFileSync(itemsPath, JSON.stringify(items, null, 2), 'utf-8');
console.log(`🎉 twelve_level60_equipment_sets.json gerado com ${items.length} itens lendários de Nível 60!`);
