/**
 * @file scripts/seed_level40_equipment_sets.mjs
 * @module @etheria/scripts
 * @description Montagem oficial de 6 Conjuntos de Equipamentos de Nível 40 na tabela de equipamentos.
 * 
 * Regras Estritas:
 *  - 6 Conjuntos cobrindo o propósito de 2 classes cada:
 *    1. Necromante + Barda ("Conjunto do Réquiem Noturno")
 *    2. Mago + Curandeira ("Conjunto do Éter Celestial")
 *    3. Guerreira + Lanceiro ("Conjunto da Vanguarda Titânica")
 *    4. Espadachim + Lutadora ("Conjunto do Fluxo Carmesim")
 *    5. Paladino + Caçadora ("Conjunto da Sentinela Sagrada")
 *    6. Atirador + Assassino ("Conjunto da Sombra Letal")
 *  - Requisito de Nível: 40 para todas as 72 peças.
 *  - Sem restrição de classe: reqClassCodesJson: [].
 *  - Bônus exclusivamente de combate (combatStatBonusesJson), baseStatBonusesJson: {}.
 *  - Cobre exatamente os 12 slots de combate (HEAD, SHOULDER, CHEST, BELT, LEGS, FEET, ORNAMENT_1, ORNAMENT_2, RING, NECKLACE, WEAPON_1, WEAPON_2).
 *  - Sem asas, sem modas, sem varas de pesca.
 *  - Preço em ouro = 0 (isTradable = false, priceGold = 0).
 *  - Raridade: RARE (Azul / Rank C).
 *  - Espelha ícones automaticamente para apps/server/cache/mcrework/.
 *  - Exporta snapshot oficial atualizado (lowcode.snapshot.json).
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

export const LEVEL_40_EQUIPMENT_SETS = [
  // =========================================================================
  // CONJUNTO 1: NECROMANTE + BARDA ("Conjunto do Réquiem Noturno")
  // =========================================================================
  {
    code: 'equip_lv40_requiem_head',
    slot: 'HEAD',
    namePtBr: 'Diadema do Réquiem Noturno',
    descPtBr: 'Uma tiara de prata fosca incrustada com ametista sombria. Ressona com lamentos etéreos, aguçando a mente do conjurador para canalizar maldições e harmonias fúnebres.',
    icon: 'assets/equipment/icons/equip_normal_040304.png',
    combatStats: { MAX_HP: 140, MAX_MP: 85, MAG_DEF: 24, PHYS_DEF: 16, MAG_ACCURACY: 12 },
  },
  {
    code: 'equip_lv40_requiem_shoulder',
    slot: 'SHOULDER',
    namePtBr: 'Manto Espectral do Réquiem',
    descPtBr: 'Ombreiras de veludo negro reforçadas com fios de prata lunar. Absorvem o impacto de feitiços rivais e envolvem o portador em uma névoa espectral evasiva.',
    icon: 'assets/equipment/icons/equip_normal_040404.png',
    combatStats: { MAX_HP: 120, MAX_MP: 70, MAG_DEF: 20, PHYS_DEF: 14, MAG_EVASION: 14 },
  },
  {
    code: 'equip_lv40_requiem_chest',
    slot: 'CHEST',
    namePtBr: 'Veste Espiritual do Réquiem',
    descPtBr: 'Túnica cerimonial tecida com seda de mariposa do submundo e encantada com cânticos de descanso eterno. Concede grande reserva mágica e sustentação vital.',
    icon: 'assets/equipment/icons/equip_normal_040504.png',
    combatStats: { MAX_HP: 280, MAX_MP: 160, MAG_DEF: 38, PHYS_DEF: 26, HEAL_POWER: 16 },
  },
  {
    code: 'equip_lv40_requiem_belt',
    slot: 'BELT',
    namePtBr: 'Faixa Fúnebre do Réquiem',
    descPtBr: 'Faixa acetinada amarrada com sinos de prata silenciosos. Regula o fluxo de éter permitindo a rápida regeneração de mana durante baladas e rituais.',
    icon: 'assets/equipment/icons/equip_normal_040604.png',
    combatStats: { MAX_HP: 110, MAX_MP: 90, MAG_DEF: 18, PHYS_DEF: 12, MP_REGEN: 5 },
  },
  {
    code: 'equip_lv40_requiem_legs',
    slot: 'LEGS',
    namePtBr: 'Saiote Sombrio do Réquiem',
    descPtBr: 'Perneiras flexíveis de tecido abissal que amortecem passos e diminuem o atrito mágico, facilitando manobras de posicionamento rítmico.',
    icon: 'assets/equipment/icons/equip_normal_040704.png',
    combatStats: { MAX_HP: 200, MAX_MP: 110, MAG_DEF: 28, PHYS_DEF: 18, MAG_EVASION: 12 },
  },
  {
    code: 'equip_lv40_requiem_feet',
    slot: 'FEET',
    namePtBr: 'Botas do Silêncio do Réquiem',
    descPtBr: 'Calçados leves forrados em couro de serpente noturna. Permitem passos fantasmagóricos e deslocamento ágil pelas fileiras de combate.',
    icon: 'assets/equipment/icons/equip_normal_040804.png',
    combatStats: { MAX_HP: 100, MAX_MP: 60, MAG_DEF: 16, PHYS_DEF: 12, BATTLE_MOVE_SPEED: 14, MAG_EVASION: 10 },
  },
  {
    code: 'equip_lv40_requiem_ornament1',
    slot: 'ORNAMENT_1',
    namePtBr: 'Broche da Lua Pálida',
    descPtBr: 'Insígnia mágica forjada na forma de lua crescente. Canaliza vibrações melódicas que amplificam a precisão e o alcance dos feitiços e canções.',
    icon: 'assets/equipment/icons/equip_normal_320004.png',
    combatStats: { MAX_MP: 75, MAG_ATK: 18, MAG_ACCURACY: 16, CRIT_RATE: 4 },
  },
  {
    code: 'equip_lv40_requiem_ornament2',
    slot: 'ORNAMENT_2',
    namePtBr: 'Selo da Harmonia Espectral',
    descPtBr: 'Talismã esculpido em jade arroxeado. Dissipa ressonâncias caóticas, potencializando a eficácia de feitiços curativos e cânticos de proteção.',
    icon: 'assets/equipment/icons/equip_normal_330004.png',
    combatStats: { MAX_HP: 110, HEAL_POWER: 20, MAG_EVASION: 12, CRIT_DMG: 12 },
  },
  {
    code: 'equip_lv40_requiem_ring',
    slot: 'RING',
    namePtBr: 'Anel do Sussurro Fúnebre',
    descPtBr: 'Aro de prata escura engastado com uma pedra de ônix polida. Vibra em harmonia com as cordas do alaúde, aumentando o impacto crítico de acordes e maldições.',
    icon: 'assets/equipment/icons/equip_normal_310004.png',
    combatStats: { MAG_ATK: 24, CRIT_RATE: 5, CRIT_DMG: 15, MAX_MP: 60 },
  },
  {
    code: 'equip_lv40_requiem_necklace',
    slot: 'NECKLACE',
    namePtBr: 'Colar da Melodia Noturna',
    descPtBr: 'Fio de gemas purpúreas que emitem uma pulsação constante de mana e cura contínua para o portador e aliados próximos.',
    icon: 'assets/equipment/icons/equip_normal_300004.png',
    combatStats: { MAX_HP: 130, MAX_MP: 100, MP_REGEN: 4, HEAL_POWER: 18 },
  },
  {
    code: 'equip_lv40_requiem_weapon1',
    slot: 'WEAPON_1',
    namePtBr: 'Alaúde do Réquiem das Sombras',
    descPtBr: 'Um alaúde magistralmente trabalhado em ébano e prata, com cordas de seda rúnica encantada. Capaz de dedilhar acordes melancólicos de suporte ou disparar ondas sônicas de puro dano mágico.',
    icon: 'assets/equipment/icons/equip_normal_160005.png',
    combatStats: { MAG_ATK: 78, MAG_ACCURACY: 26, ATTACK_SPEED: 0.08, ATTACK_RANGE: 20, CRIT_RATE: 5 },
  },
  {
    code: 'equip_lv40_requiem_weapon2',
    slot: 'WEAPON_2',
    namePtBr: 'Cítara Espectral do Véu',
    descPtBr: 'Instrumento ressonador secundário empunhado na mão inábil. Suas vibrações harmônicas sustentam a barreira mágica e restauram o vigor das melodias de batalha.',
    icon: 'assets/equipment/icons/equip_normal_161005.png',
    combatStats: { MAG_ATK: 32, MAX_MP: 120, MAG_DEF: 22, HEAL_POWER: 22, MAG_EVASION: 14 },
  },

  // =========================================================================
  // CONJUNTO 2: MAGO + CURANDEIRA ("Conjunto do Éter Celestial")
  // =========================================================================
  {
    code: 'equip_lv40_celestial_head',
    slot: 'HEAD',
    namePtBr: 'Coroa da Clarividência Celestial',
    descPtBr: 'Diadema de ouro solar ornado com safira límpida. Foca a percepção mágica para antecipar fluxos arcanos e desferir curas e raios milimetricamente calculados.',
    icon: 'assets/equipment/icons/equip_normal_030304.png',
    combatStats: { MAX_HP: 130, MAX_MP: 110, MAG_DEF: 26, PHYS_DEF: 14, MAG_ACCURACY: 16 },
  },
  {
    code: 'equip_lv40_celestial_shoulder',
    slot: 'SHOULDER',
    namePtBr: 'Ombreiras do Éter Sagrado',
    descPtBr: 'Protetores tecidos em seda celeste com placas aladas douradas. Desviam investidas hostis e irradiam um campo protetor sustentado pelo poder sagrado.',
    icon: 'assets/equipment/icons/equip_normal_030404.png',
    combatStats: { MAX_HP: 115, MAX_MP: 90, MAG_DEF: 22, PHYS_DEF: 14, HEAL_POWER: 14 },
  },
  {
    code: 'equip_lv40_celestial_chest',
    slot: 'CHEST',
    namePtBr: 'Túnica Arcana do Éter',
    descPtBr: 'Veste cerimonial de azul cerúleo profundo com runas arcanas costuradas em ouro. Amplifica dramaticamente a potência de destruição elemental e milagres de restauração.',
    icon: 'assets/equipment/icons/equip_normal_030504.png',
    combatStats: { MAX_HP: 260, MAX_MP: 190, MAG_DEF: 42, PHYS_DEF: 22, HEAL_POWER: 24 },
  },
  {
    code: 'equip_lv40_celestial_belt',
    slot: 'BELT',
    namePtBr: 'Cordão Rúnico do Éter',
    descPtBr: 'Cinto de seda trançada com contas de safira encantada. Armazena pequenas centelhas de energia divina que recuperam o éter continuamente.',
    icon: 'assets/equipment/icons/equip_normal_030604.png',
    combatStats: { MAX_HP: 105, MAX_MP: 100, MAG_DEF: 20, PHYS_DEF: 12, MP_REGEN: 6 },
  },
  {
    code: 'equip_lv40_celestial_legs',
    slot: 'LEGS',
    namePtBr: 'Calças Rúnicas do Éter',
    descPtBr: 'Vestimenta inferior confortável e encantada com glifos de leveza, permitindo ao conjurador canalizar encantamentos sem perda de postura.',
    icon: 'assets/equipment/icons/equip_normal_030704.png',
    combatStats: { MAX_HP: 190, MAX_MP: 120, MAG_DEF: 30, PHYS_DEF: 16, MAG_ACCURACY: 14 },
  },
  {
    code: 'equip_lv40_celestial_feet',
    slot: 'FEET',
    namePtBr: 'Sapatos Alados do Éter',
    descPtBr: 'Calçados leves abençoados pelos espíritos celestes. Concedem velocidade de locomoção e firmeza mágica em terrenos acidentados.',
    icon: 'assets/equipment/icons/equip_normal_030804.png',
    combatStats: { MAX_HP: 95, MAX_MP: 70, MAG_DEF: 18, PHYS_DEF: 10, BATTLE_MOVE_SPEED: 12, MAG_EVASION: 10 },
  },
  {
    code: 'equip_lv40_celestial_ornament1',
    slot: 'ORNAMENT_1',
    namePtBr: 'Amuleto do Relâmpago Divino',
    descPtBr: 'Ornamento esmeraldino que canaliza o éter atmosférico. Aumenta a velocidade de impacto de magias ofensivas e a precisão mística.',
    icon: 'assets/equipment/icons/equip_normal_320005.png',
    combatStats: { MAX_MP: 90, MAG_ATK: 22, MAG_ACCURACY: 18, CRIT_DMG: 14 },
  },
  {
    code: 'equip_lv40_celestial_ornament2',
    slot: 'ORNAMENT_2',
    namePtBr: 'Relíquia da Água Sagrada',
    descPtBr: 'Frasco de cristal contendo a essência purificada da nascente sagrada de Etheria. Fortalece o poder curativo e a restauração de aliados.',
    icon: 'assets/equipment/icons/equip_normal_330005.png',
    combatStats: { MAX_HP: 120, MAX_MP: 80, HEAL_POWER: 26, MAG_DEF: 16 },
  },
  {
    code: 'equip_lv40_celestial_ring',
    slot: 'RING',
    namePtBr: 'Anel do Vórtice Astral',
    descPtBr: 'Anel esculpido em platina e safira estrelada. Canaliza o ápice do dano mágico e maximiza a contundência de feitiços elementais.',
    icon: 'assets/equipment/icons/equip_normal_310005.png',
    combatStats: { MAG_ATK: 28, CRIT_RATE: 6, CRIT_DMG: 18, MAX_MP: 70 },
  },
  {
    code: 'equip_lv40_celestial_necklace',
    slot: 'NECKLACE',
    namePtBr: 'Colar da Benesse Celestial',
    descPtBr: 'Cordão adornado com prismas de luz que refratam o éter puro, sustentando uma fonte ininterrupta de mana e vigor curativo.',
    icon: 'assets/equipment/icons/equip_normal_300005.png',
    combatStats: { MAX_HP: 140, MAX_MP: 120, MP_REGEN: 5, HEAL_POWER: 22 },
  },
  {
    code: 'equip_lv40_celestial_weapon1',
    slot: 'WEAPON_1',
    namePtBr: 'Cajado do Vórtice Celestial',
    descPtBr: 'Um cajado majestoso encimado por um orbe de tempestade flutuante. Catalisa os elementos do ar e do fogo em explosões devastadoras ou em bênçãos restauradoras.',
    icon: 'assets/equipment/icons/equip_normal_120005.png',
    combatStats: { MAG_ATK: 86, MAG_ACCURACY: 28, HEAL_POWER: 24, ATTACK_SPEED: 0.06, ATTACK_RANGE: 22 },
  },
  {
    code: 'equip_lv40_celestial_weapon2',
    slot: 'WEAPON_2',
    namePtBr: 'Grimório da Revelação Sagrada',
    descPtBr: 'Um tomo encadernado em couro sagrado com fechos de ouro. Suas páginas gravadas com cânticos sagrados elevam a barreira protetora e ampliam a cura divina.',
    icon: 'assets/equipment/icons/equip_normal_121005.png',
    combatStats: { MAG_ATK: 34, MAX_MP: 140, MAG_DEF: 26, PHYS_DEF: 16, HEAL_POWER: 28 },
  },

  // =========================================================================
  // CONJUNTO 3: GUERREIRA + LANCEIRO ("Conjunto da Vanguarda Titânica")
  // =========================================================================
  {
    code: 'equip_lv40_titan_head',
    slot: 'HEAD',
    namePtBr: 'Elmo de Batalha da Vanguarda',
    descPtBr: 'Um elmo imponente de placas de aço temperado com viseira protetora. Protege a cabeça contra impactos contundentes e garante foco implacável na vanguarda.',
    icon: 'assets/equipment/icons/equip_normal_010304.png',
    combatStats: { MAX_HP: 220, PHYS_DEF: 32, MAG_DEF: 20, PHYS_ACCURACY: 10 },
  },
  {
    code: 'equip_lv40_titan_shoulder',
    slot: 'SHOULDER',
    namePtBr: 'Ombreiras de Placas da Vanguarda',
    descPtBr: 'Ombreiras de aço laminado gravadas com a efígie de um leão rugindo. Amortecem investidas frontais e dispersam o choque de armas pesadas.',
    icon: 'assets/equipment/icons/equip_normal_010404.png',
    combatStats: { MAX_HP: 180, PHYS_DEF: 28, MAG_DEF: 18, HP_REGEN: 3 },
  },
  {
    code: 'equip_lv40_titan_chest',
    slot: 'CHEST',
    namePtBr: 'Peitoral de Aço da Vanguarda',
    descPtBr: 'Uma couraça maciça de aço dobrado forjada pelos mestres ferreiros de Etheria. Transforma o combatente em uma muralha inamovível contra qualquer ataque.',
    icon: 'assets/equipment/icons/equip_normal_010504.png',
    combatStats: { MAX_HP: 440, PHYS_DEF: 58, MAG_DEF: 34, HP_REGEN: 5 },
  },
  {
    code: 'equip_lv40_titan_belt',
    slot: 'BELT',
    namePtBr: 'Cinturão de Guerra da Vanguarda',
    descPtBr: 'Cinto largo de couro cru reforçado com chapas de ferro rebitadas. Mantém o centro de gravidade firme para suportar o peso da armadura pesada.',
    icon: 'assets/equipment/icons/equip_normal_010604.png',
    combatStats: { MAX_HP: 160, PHYS_DEF: 22, MAG_DEF: 14, PHYS_ACCURACY: 8 },
  },
  {
    code: 'equip_lv40_titan_legs',
    slot: 'LEGS',
    namePtBr: 'Perneiras Pesadas da Vanguarda',
    descPtBr: 'Protetores de perna completos de ferro forjado. Garantem proteção total aos membros inferiores contra golpes rasteiros e garras monstruosas.',
    icon: 'assets/equipment/icons/equip_normal_010704.png',
    combatStats: { MAX_HP: 300, PHYS_DEF: 40, MAG_DEF: 24, PHYS_DEF: 10 },
  },
  {
    code: 'equip_lv40_titan_feet',
    slot: 'FEET',
    namePtBr: 'Grevas Maciças da Vanguarda',
    descPtBr: 'Botas de combate de ferro reforçado com travas de sola para terreno lamacento. Fixam o herói ao solo para repelir investidas e estocar com poder.',
    icon: 'assets/equipment/icons/equip_normal_010804.png',
    combatStats: { MAX_HP: 150, PHYS_DEF: 24, MAG_DEF: 16, BATTLE_MOVE_SPEED: 10, PHYS_ACCURACY: 8 },
  },
  {
    code: 'equip_lv40_titan_ornament1',
    slot: 'ORNAMENT_1',
    namePtBr: 'Insígnia do Titã Inabalável',
    descPtBr: 'Broche de ferro batido com o lema dos guardiões de Etheria. Confere contundência física e firmeza para manter o aggro dos inimigos.',
    icon: 'assets/equipment/icons/equip_normal_320001.png',
    combatStats: { MAX_HP: 160, PHYS_ATK: 16, PHYS_ACCURACY: 14, PHYS_DEF: 12 },
  },
  {
    code: 'equip_lv40_titan_ornament2',
    slot: 'ORNAMENT_2',
    namePtBr: 'Selo do Baluarte de Ferro',
    descPtBr: 'Talismã esculpido em hematita maciça que ancora as energias do corpo físico, estimulando a regeneração natural dos tecidos.',
    icon: 'assets/equipment/icons/equip_normal_330002.png',
    combatStats: { MAX_HP: 180, HP_REGEN: 6, PHYS_DEF: 16, MAG_DEF: 12 },
  },
  {
    code: 'equip_lv40_titan_ring',
    slot: 'RING',
    namePtBr: 'Anel do Impacto Contundente',
    descPtBr: 'Aro de aço denso com pontas rústicas de impacto. Multiplica o choque de cada golpe desferido com maça, lança ou espada de duas mãos.',
    icon: 'assets/equipment/icons/equip_normal_310002.png',
    combatStats: { PHYS_ATK: 24, CRIT_DMG: 18, MAX_HP: 120, PHYS_ACCURACY: 10 },
  },
  {
    code: 'equip_lv40_titan_necklace',
    slot: 'NECKLACE',
    namePtBr: 'Gargantilha da Fortitude Titânica',
    descPtBr: 'Colar de elos grossos de ferro negro com uma gema terrena. Pulsa com a tenacidade da terra profunda, elevando o vigor e a resistência.',
    icon: 'assets/equipment/icons/equip_normal_300001.png',
    combatStats: { MAX_HP: 240, PHYS_DEF: 22, MAG_DEF: 18, HP_REGEN: 4 },
  },
  {
    code: 'equip_lv40_titan_weapon1',
    slot: 'WEAPON_1',
    namePtBr: 'Rompe-Montanhas Titânico',
    descPtBr: 'Uma arma colossal de ferro maciço e lâminas de impacto. Quer seja empunhada como maça de esmagamento pela Guerreira ou como ponta de impacto pelo Lanceiro, é capaz de partir armaduras ao meio.',
    icon: 'assets/equipment/icons/equip_normal_110005.png',
    combatStats: { PHYS_ATK: 82, PHYS_ACCURACY: 22, CRIT_DMG: 20, ATTACK_SPEED: 0.05, ATTACK_RANGE: 12 },
  },
  {
    code: 'equip_lv40_titan_weapon2',
    slot: 'WEAPON_2',
    namePtBr: 'Escudo Torre da Vanguarda',
    descPtBr: 'Um escudo imponente de corpo inteiro forjado em ferro e carvalho reforçado. Permite absorver o castigo de chefes e bestas titânicas sem ceder um único centímetro.',
    icon: 'assets/equipment/icons/equip_normal_111005.png',
    combatStats: { MAX_HP: 260, PHYS_DEF: 42, MAG_DEF: 28, PHYS_ATK: 18, PHYS_ACCURACY: 10 },
  },

  // =========================================================================
  // CONJUNTO 4: ESPADACHIM + LUTADORA ("Conjunto do Fluxo Carmesim")
  // =========================================================================
  {
    code: 'equip_lv40_crimson_head',
    slot: 'HEAD',
    namePtBr: 'Tiara de Duelo do Fluxo Carmesim',
    descPtBr: 'Uma tiara ágil de couro vermelho e lâminas em miniatura. Mantém a visão limpa e alerta para interceptar aberturas na guarda adversária.',
    icon: 'assets/equipment/icons/equip_normal_050304.png',
    combatStats: { MAX_HP: 160, PHYS_DEF: 22, MAG_DEF: 16, CRIT_RATE: 5, PHYS_ACCURACY: 14 },
  },
  {
    code: 'equip_lv40_crimson_shoulder',
    slot: 'SHOULDER',
    namePtBr: 'Protetores de Ombro Carmesim',
    descPtBr: 'Ombreiras articuladas de couro endurecido com guarnições de aço rubi. Permitem ampla rotação de braço para golpes velozes e cortes diagonais.',
    icon: 'assets/equipment/icons/equip_normal_050404.png',
    combatStats: { MAX_HP: 140, PHYS_DEF: 20, MAG_DEF: 14, PHYS_EVASION: 14, ATTACK_SPEED: 0.04 },
  },
  {
    code: 'equip_lv40_crimson_chest',
    slot: 'CHEST',
    namePtBr: 'Colete Laminado Carmesim',
    descPtBr: 'Colete de couro escovado tingido no sangue de dragão com lâminas flexíveis sobre o torso. Une leveza extrema e proteção tática contra estocadas.',
    icon: 'assets/equipment/icons/equip_normal_050504.png',
    combatStats: { MAX_HP: 320, PHYS_DEF: 38, MAG_DEF: 24, CRIT_RATE: 6, PHYS_EVASION: 16 },
  },
  {
    code: 'equip_lv40_crimson_belt',
    slot: 'BELT',
    namePtBr: 'Faixa Marcial Carmesim',
    descPtBr: 'Faixa de tecido reforçado com suportes para lâminas de arremesso e fixadores de bainha. Equilibra o centro do corpo para esquivas instantâneas.',
    icon: 'assets/equipment/icons/equip_normal_050604.png',
    combatStats: { MAX_HP: 130, PHYS_DEF: 18, MAG_DEF: 12, BATTLE_MOVE_SPEED: 8, CRIT_RATE: 4 },
  },
  {
    code: 'equip_lv40_crimson_legs',
    slot: 'LEGS',
    namePtBr: 'Calças Ágeis do Fluxo Carmesim',
    descPtBr: 'Calças leves de corte atlético com joelheiras de couro moldado. Oferecem liberdade irrestrita para chutes altos, passos evasivos e saltos.',
    icon: 'assets/equipment/icons/equip_normal_050704.png',
    combatStats: { MAX_HP: 220, PHYS_DEF: 28, MAG_DEF: 18, PHYS_EVASION: 16, ATTACK_SPEED: 0.03 },
  },
  {
    code: 'equip_lv40_crimson_feet',
    slot: 'FEET',
    namePtBr: 'Botas Velozes do Fluxo Carmesim',
    descPtBr: 'Botas de sola aderente e cano curto. Garantem aceleração explosiva para fechar a distância contra conjuradores e arqueiros em fração de segundo.',
    icon: 'assets/equipment/icons/equip_normal_050804.png',
    combatStats: { MAX_HP: 120, PHYS_DEF: 16, MAG_DEF: 12, BATTLE_MOVE_SPEED: 20, PHYS_EVASION: 14 },
  },
  {
    code: 'equip_lv40_crimson_ornament1',
    slot: 'ORNAMENT_1',
    namePtBr: 'Talismã da Fúria Tempestuosa',
    descPtBr: 'Pequena gema rubra esculpida como uma gota de sangue. Canaliza adrenalina na corrente sanguínea elevando o dano de acertos críticos.',
    icon: 'assets/equipment/icons/equip_normal_320003.png',
    combatStats: { PHYS_ATK: 20, CRIT_RATE: 5, CRIT_DMG: 16, PHYS_ACCURACY: 12 },
  },
  {
    code: 'equip_lv40_crimson_ornament2',
    slot: 'ORNAMENT_2',
    namePtBr: 'Emblema do Corte Perfeito',
    descPtBr: 'Medalhão de aço cirúrgico afiado como navalha. Aumenta a penetração de armadura e a precisão dos combos rápidos.',
    icon: 'assets/equipment/icons/equip_normal_330003.png',
    combatStats: { PHYS_ATK: 18, PHYS_ACCURACY: 16, PHYS_EVASION: 12, CRIT_DMG: 14 },
  },
  {
    code: 'equip_lv40_crimson_ring',
    slot: 'RING',
    namePtBr: 'Anel da Lâmina Sangrenta',
    descPtBr: 'Aro de ferro escuro adornado com um rubi brilhante. Cada golpe crítico desferido ressoa no anel aumentando a contundência marcial.',
    icon: 'assets/equipment/icons/equip_normal_310003.png',
    combatStats: { PHYS_ATK: 26, CRIT_RATE: 7, CRIT_DMG: 20, ATTACK_SPEED: 0.04 },
  },
  {
    code: 'equip_lv40_crimson_necklace',
    slot: 'NECKLACE',
    namePtBr: 'Colar da Rapidez Marcial',
    descPtBr: 'Gargantilha de couro com pingente de garra afiada. Estimula reflexos motores imediatos, elevando vida e velocidade de ataque.',
    icon: 'assets/equipment/icons/equip_normal_300002.png',
    combatStats: { MAX_HP: 160, PHYS_ATK: 16, ATTACK_SPEED: 0.05, PHYS_EVASION: 10 },
  },
  {
    code: 'equip_lv40_crimson_weapon1',
    slot: 'WEAPON_1',
    namePtBr: 'Lâmina Vorpal do Fluxo Carmesim',
    descPtBr: 'Uma espada longa de corte afiadíssimo, forjada em liga de aço estelar e essência de rubi. Ideal para os cortes precisos do Espadachim ou as estocadas velozes da Lutadora.',
    icon: 'assets/equipment/icons/equip_normal_050104.png',
    combatStats: { PHYS_ATK: 84, CRIT_RATE: 8, CRIT_DMG: 24, ATTACK_SPEED: 0.10, ATTACK_RANGE: 12, PHYS_ACCURACY: 24 },
  },
  {
    code: 'equip_lv40_crimson_weapon2',
    slot: 'WEAPON_2',
    namePtBr: 'Adaga de Aparar da Ventania',
    descPtBr: 'Uma lâmina curta de aparar e contra-ataque empunhada na mão secundária. Permite desviar ataques frontais e revidar imediatamente com estocadas críticas.',
    icon: 'assets/equipment/icons/equip_normal_050204.png',
    combatStats: { PHYS_ATK: 36, PHYS_DEF: 20, PHYS_EVASION: 20, CRIT_RATE: 5, ATTACK_SPEED: 0.06 },
  },

  // =========================================================================
  // CONJUNTO 5: PALADINO + CAÇADORA ("Conjunto da Sentinela Sagrada")
  // =========================================================================
  {
    code: 'equip_lv40_sentinel_head',
    slot: 'HEAD',
    namePtBr: 'Elmo Alado da Sentinela Sagrada',
    descPtBr: 'Um capuz nobre de couro reforçado com asas douradas de metalurgia élfica. Confere visão de águia e proteção sagrada contra ciladas e feitiços.',
    icon: 'assets/equipment/icons/equip_normal_020304.png',
    combatStats: { MAX_HP: 180, PHYS_DEF: 26, MAG_DEF: 24, PHYS_ACCURACY: 16 },
  },
  {
    code: 'equip_lv40_sentinel_shoulder',
    slot: 'SHOULDER',
    namePtBr: 'Ombreiras Nobres da Sentinela',
    descPtBr: 'Protetores de ombro de malha de latão e couro de cervo sagrado. Harmonizam o vigor físico com a bênção dos espíritos da floresta de Etheria.',
    icon: 'assets/equipment/icons/equip_normal_020404.png',
    combatStats: { MAX_HP: 150, PHYS_DEF: 22, MAG_DEF: 20, HEAL_POWER: 12, PHYS_EVASION: 10 },
  },
  {
    code: 'equip_lv40_sentinel_chest',
    slot: 'CHEST',
    namePtBr: 'Cota de Malha Dourada da Sentinela',
    descPtBr: 'Armadura híbrida combinando cota de malha leve de ouro e courinho curtido. Excelente proteção balanceada contra cortes, tiros e descargas mágicas.',
    icon: 'assets/equipment/icons/equip_normal_020504.png',
    combatStats: { MAX_HP: 360, PHYS_DEF: 46, MAG_DEF: 40, HEAL_POWER: 16, CRIT_RATE: 4 },
  },
  {
    code: 'equip_lv40_sentinel_belt',
    slot: 'BELT',
    namePtBr: 'Cinto de Caça da Sentinela',
    descPtBr: 'Cinto ornamentado com bolsos táticos para cantis sagrados e armadilhas rápidas. Fortalece o equilíbrio e a recuperação gradual de vida.',
    icon: 'assets/equipment/icons/equip_normal_020604.png',
    combatStats: { MAX_HP: 140, PHYS_DEF: 20, MAG_DEF: 18, HP_REGEN: 4, PHYS_ACCURACY: 10 },
  },
  {
    code: 'equip_lv40_sentinel_legs',
    slot: 'LEGS',
    namePtBr: 'Perneiras Nobres da Sentinela',
    descPtBr: 'Calças de malha entrelaçada que permitem agachamento estável para disparos precisos ou marcha resoluta para bloquear corredores de avanço.',
    icon: 'assets/equipment/icons/equip_normal_020704.png',
    combatStats: { MAX_HP: 250, PHYS_DEF: 34, MAG_DEF: 28, PHYS_ACCURACY: 12, PHYS_EVASION: 10 },
  },
  {
    code: 'equip_lv40_sentinel_feet',
    slot: 'FEET',
    namePtBr: 'Botas Rastejadoras da Sentinela',
    descPtBr: 'Botas de marcha confeccionadas com solado silencioso de seiva de borracha. Permitem perseguir presas ou avançar na vanguarda sem tropeços.',
    icon: 'assets/equipment/icons/equip_normal_020804.png',
    combatStats: { MAX_HP: 130, PHYS_DEF: 18, MAG_DEF: 16, BATTLE_MOVE_SPEED: 14, PHYS_EVASION: 12 },
  },
  {
    code: 'equip_lv40_sentinel_ornament1',
    slot: 'ORNAMENT_1',
    namePtBr: 'Broche da Flecha Solar',
    descPtBr: 'Um broche de ouro com a insígnia da flecha solar. Aumenta consideravelmente a precisão física e a taxa de acerto crítico em alvos móveis.',
    icon: 'assets/equipment/icons/equip_normal_320006.png',
    combatStats: { PHYS_ATK: 18, PHYS_ACCURACY: 20, CRIT_RATE: 5, MAX_HP: 100 },
  },
  {
    code: 'equip_lv40_sentinel_ornament2',
    slot: 'ORNAMENT_2',
    namePtBr: 'Talismã do Guardião Imaculado',
    descPtBr: 'Relíquia sagrada gravada com orações de proteção. Melhora a absorção mágica e potencia as bênçãos e curas de combate.',
    icon: 'assets/equipment/icons/equip_normal_330006.png',
    combatStats: { MAX_HP: 140, HEAL_POWER: 18, MAG_DEF: 16, PHYS_DEF: 12 },
  },
  {
    code: 'equip_lv40_sentinel_ring',
    slot: 'RING',
    namePtBr: 'Anel da Aliança Sagrada',
    descPtBr: 'Aro de ouro nobre com um topázio reluzente. Simboliza o juramento entre os caçadores da floresta e os paladinos da cidadela.',
    icon: 'assets/equipment/icons/equip_normal_310006.png',
    combatStats: { PHYS_ATK: 22, CRIT_RATE: 5, CRIT_DMG: 14, MAX_HP: 110 },
  },
  {
    code: 'equip_lv40_sentinel_necklace',
    slot: 'NECKLACE',
    namePtBr: 'Colar do Olho de Falcão',
    descPtBr: 'Gargantilha de ouro fosco com uma pedra olho-de-tigre lapidada. Aumenta a clareza de mira e a vitalidade contínua do herói.',
    icon: 'assets/equipment/icons/equip_normal_300003.png',
    combatStats: { MAX_HP: 180, PHYS_ACCURACY: 16, PHYS_DEF: 16, HEAL_POWER: 12 },
  },
  {
    code: 'equip_lv40_sentinel_weapon1',
    slot: 'WEAPON_1',
    namePtBr: 'Lança Solar da Sentinela',
    descPtBr: 'Uma arma de combate de haste reforçada com ponta de lâmina radiante. Atua com excelência tanto como bastão de combate sagrado do Paladino quanto como pique de caça da Caçadora.',
    icon: 'assets/equipment/icons/equip_normal_060104.png',
    combatStats: { PHYS_ATK: 80, PHYS_ACCURACY: 26, CRIT_RATE: 6, ATTACK_SPEED: 0.07, ATTACK_RANGE: 16 },
  },
  {
    code: 'equip_lv40_sentinel_weapon2',
    slot: 'WEAPON_2',
    namePtBr: 'Braçadeira Balística da Sentinela',
    descPtBr: 'Uma braçadeira de precisão para a mão inábil acoplada com trilho estabilizador e placa de broquel. Permite desviar tiros e estabilizar ataques à distância.',
    icon: 'assets/equipment/icons/equip_normal_030204.png',
    combatStats: { PHYS_ATK: 28, PHYS_DEF: 24, MAG_DEF: 20, PHYS_ACCURACY: 22, PHYS_EVASION: 12 },
  },

  // =========================================================================
  // CONJUNTO 6: ATIRADOR + ASSASSINO ("Conjunto da Sombra Letal")
  // =========================================================================
  {
    code: 'equip_lv40_shadow_head',
    slot: 'HEAD',
    namePtBr: 'Capuz Furtivo da Sombra Letal',
    descPtBr: 'Capuz negro com máscara integrada que oculta completamente as feições do assassino. Seu tecido camufla a respiração e a presença térmica.',
    icon: 'assets/equipment/icons/equip_normal_060304.png',
    combatStats: { MAX_HP: 140, PHYS_DEF: 18, MAG_DEF: 16, CRIT_RATE: 6, PHYS_ACCURACY: 18 },
  },
  {
    code: 'equip_lv40_shadow_shoulder',
    slot: 'SHOULDER',
    namePtBr: 'Ombreiras Silenciosas da Sombra',
    descPtBr: 'Ombreiras anatômicas de couro de fera noturna sem placas de metal, eliminando qualquer ruído metálico durante aproximações furtivas.',
    icon: 'assets/equipment/icons/equip_normal_060404.png',
    combatStats: { MAX_HP: 120, PHYS_DEF: 16, MAG_DEF: 14, PHYS_EVASION: 18, ATTACK_SPEED: 0.04 },
  },
  {
    code: 'equip_lv40_shadow_chest',
    slot: 'CHEST',
    namePtBr: 'Colete de Couro Noturno da Sombra',
    descPtBr: 'Colete leve e aerodinâmico tratado com cera preta repelente de luz. Permite recarregar munições e sacar lâminas em alta velocidade.',
    icon: 'assets/equipment/icons/equip_normal_060504.png',
    combatStats: { MAX_HP: 280, PHYS_DEF: 32, MAG_DEF: 22, CRIT_RATE: 7, PHYS_EVASION: 20 },
  },
  {
    code: 'equip_lv40_shadow_belt',
    slot: 'BELT',
    namePtBr: 'Cinto de Cartuchos da Sombra',
    descPtBr: 'Cinto utilitário repleto de cartuchos especiais e frascos de peçonha mortal. Concede velocidade de movimento e recarga ágil.',
    icon: 'assets/equipment/icons/equip_normal_060604.png',
    combatStats: { MAX_HP: 110, PHYS_DEF: 14, MAG_DEF: 10, BATTLE_MOVE_SPEED: 12, CRIT_RATE: 4 },
  },
  {
    code: 'equip_lv40_shadow_legs',
    slot: 'LEGS',
    namePtBr: 'Calças Camufladas da Sombra',
    descPtBr: 'Calças de tecido fosco com faixas de aperto nos tornozelos. Evitam que a roupa se prenda em folhagens durante emboscadas noturnas.',
    icon: 'assets/equipment/icons/equip_normal_060704.png',
    combatStats: { MAX_HP: 200, PHYS_DEF: 24, MAG_DEF: 16, PHYS_EVASION: 18, ATTACK_SPEED: 0.04 },
  },
  {
    code: 'equip_lv40_shadow_feet',
    slot: 'FEET',
    namePtBr: 'Botas Silenciosas da Sombra',
    descPtBr: 'Calçados com sola de pele de leopardo que anulam o som dos passos em pisos de pedra, madeira ou terra batida.',
    icon: 'assets/equipment/icons/equip_normal_060804.png',
    combatStats: { MAX_HP: 100, PHYS_DEF: 14, MAG_DEF: 10, BATTLE_MOVE_SPEED: 24, PHYS_EVASION: 18 },
  },
  {
    code: 'equip_lv40_shadow_ornament1',
    slot: 'ORNAMENT_1',
    namePtBr: 'Amuleto da Mira Certeira',
    descPtBr: 'Ornamento com lente de precisão lapidada. Aumenta substancialmente a precisão de disparos a longa distância e cortes nas artérias.',
    icon: 'assets/equipment/icons/equip_normal_320007.png',
    combatStats: { PHYS_ATK: 22, PHYS_ACCURACY: 24, CRIT_RATE: 6, ATTACK_RANGE: 10 },
  },
  {
    code: 'equip_lv40_shadow_ornament2',
    slot: 'ORNAMENT_2',
    namePtBr: 'Selo do Golpe Furtivo',
    descPtBr: 'Talismã em forma de adaga de prata escura. Detona dano crítico colossal quando o golpe conecta em pontos vitais da presa.',
    icon: 'assets/equipment/icons/equip_normal_330007.png',
    combatStats: { PHYS_ATK: 20, CRIT_DMG: 22, PHYS_EVASION: 14, ATTACK_SPEED: 0.04 },
  },
  {
    code: 'equip_lv40_shadow_ring',
    slot: 'RING',
    namePtBr: 'Anel do Assassino da Penumbra',
    descPtBr: 'Aro com lâmina oculta embutida. Amplifica a letalidade de rajadas e golpes furtivos desferidos pelas costas.',
    icon: 'assets/equipment/icons/equip_normal_310007.png',
    combatStats: { PHYS_ATK: 30, CRIT_RATE: 8, CRIT_DMG: 22, PHYS_ACCURACY: 14 },
  },
  {
    code: 'equip_lv40_shadow_necklace',
    slot: 'NECKLACE',
    namePtBr: 'Colar da Letalidade Sombria',
    descPtBr: 'Fio de seda negra com presas de víbora envenenadas. Eleva a velocidade de reação e o poder dos golpes letais.',
    icon: 'assets/equipment/icons/equip_normal_300006.png',
    combatStats: { MAX_HP: 140, PHYS_ATK: 18, ATTACK_SPEED: 0.06, PHYS_EVASION: 14 },
  },
  {
    code: 'equip_lv40_shadow_weapon1',
    slot: 'WEAPON_1',
    namePtBr: 'Mosquete do Predador Noturno',
    descPtBr: 'Um rifle de precisão balística com cano estriado e gatilho sensível. Dispara projéteis de alto calibre com alcance extremo e letalidade devastadora.',
    icon: 'assets/equipment/icons/equip_normal_030103.png',
    combatStats: { PHYS_ATK: 88, PHYS_ACCURACY: 32, CRIT_RATE: 10, CRIT_DMG: 26, ATTACK_SPEED: 0.08, ATTACK_RANGE: 30 },
  },
  {
    code: 'equip_lv40_shadow_weapon2',
    slot: 'WEAPON_2',
    namePtBr: 'Manoplas com Lâmina Oculta da Sombra',
    descPtBr: 'Luvas de combate reforçadas com lâmina retrátil de aço negro e veneno paralisante na mão inábil. Ideal para aparar tiros e estocar à queima-roupa.',
    icon: 'assets/equipment/icons/equip_normal_060204.png',
    combatStats: { PHYS_ATK: 38, PHYS_EVASION: 22, PHYS_DEF: 18, CRIT_RATE: 6, ATTACK_SPEED: 0.06 },
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
    console.log(`--- INICIANDO MONTAGEM DE 6 CONJUNTOS DE NÍVEL 40 (${LEVEL_40_EQUIPMENT_SETS.length} PEÇAS) ---`);

    let createdCount = 0;
    let updatedCount = 0;

    for (const item of LEVEL_40_EQUIPMENT_SETS) {
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
      const existing = await prisma.itemTemplate.findUnique({ where: { code: item.code } });
      const upserted = await prisma.itemTemplate.upsert({
        where: { code: item.code },
        update: {
          nameI18nKey: nameKey,
          descriptionI18nKey: descKey,
          mcreworkIconKey: item.icon,
          itemCategory: 'CHARACTER_EQUIPMENT',
          equipmentSlotCode: item.slot,
          rarityTier: 'RARE',
          requiredLevel: 40,
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
          rarityTier: 'RARE',
          requiredLevel: 40,
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

      if (existing) {
        updatedCount++;
      } else {
        createdCount++;
      }

      console.log(`[Item #${upserted.id}] ${upserted.code} (${item.slot}) -> ${item.namePtBr}`);

      // 3. Garante download do ícone para cache local
      await downloadIconIfNeeded(item.icon);
    }

    console.log(`\nResumo da montagem: ${createdCount} criados, ${updatedCount} atualizados.`);

    // 4. Exporta snapshot atualizado
    console.log('\n--- EXPORTANDO SNAPSHOT LOWCODE ---');
    const { SnapshotManager } = await import('@etheria/database');
    const sm = new SnapshotManager(prisma);
    const snapPath = await sm.exportToDisk();
    console.log(`Snapshot exportado com sucesso: ${snapPath}`);

    console.log('\n✅ 6 Conjuntos de Nível 40 (72 peças) configurados com sucesso!');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('❌ Erro durante a montagem de equipamentos:', err);
  process.exit(1);
});
