/**
 * @file scripts/seed_fishing_pack_v1.mjs
 * @module @etheria/scripts
 * @description Script idempotente e não-destrutivo de cadastro do Pacote Completo de Pesca (v0.68.0):
 *   - Corrige o ícone incorreto da isca `Minhoca` (`item_minhoca_rilyq`) para `/play/assets/fishing/baits/bait_minhoca_viva.png`
 *     e aplica bônus inicial leve (+4% fisgada, +4 D, +1 C) apenas se ainda estiver totalmente zerada.
 *   - Cadastra 36 novos peixes (`FISH`) cobrindo todos os ranks F..SS em `pt-BR`, `en-US` e `es-ES`.
 *   - Cadastra 11 novas iscas (`FISHING_BAIT`) complementando a Minhoca (totalizando 12 iscas distintas).
 *   - Cadastra 12 novas varas de pesca (`FISHING_ROD`, `rod_7`..`rod_18`) preservando integralmente `rod_1`..`rod_6` e `item_lambari_uutu9`.
 * @rules Cláusula 0.2 (idempotente, zero remoção/sobrescrita destrutiva), Regra #4 (i18n trilíngue), Regra #7 (< 1.000 linhas).
 * @dependencies @prisma/client, ../packages/database/dist/SnapshotManager.js, ../packages/database/dist/I18nCache.js, node:path, node:url
 */

import { PrismaClient } from '@prisma/client';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SnapshotManager } from '../packages/database/dist/SnapshotManager.js';
import { I18nCache } from '../packages/database/dist/I18nCache.js';

export const MINHOCA_ICON_PATH = '/play/assets/fishing/baits/bait_minhoca_viva.png';
export const MINHOCA_DEFAULT_CONFIG = {
  catchChanceBonusPct: 4,
  rankBonusWeights: { F: 0, D: 4, C: 1, B: 0, A: 0, S: 0, SS: 0 },
};

const mkFish = (code, rarityTier, priceGold, ptName, ptDesc, enName, enDesc, esName, esDesc) => ({
  code,
  rarityTier,
  priceGold,
  iconPath: `/play/assets/fishing/fish/${code}.png`,
  names: { 'pt-BR': ptName, 'en-US': enName, 'es-ES': esName },
  descs: { 'pt-BR': ptDesc, 'en-US': enDesc, 'es-ES': esDesc },
});

export const FISH_CATALOG = [
  // Rank F (6)
  mkFish('fish_sardinha', 'F', 15,
    'Sardinha Prateada', 'Pequeno peixe costeiro de cardume, rápido no anzol e muito comum nas margens.',
    'Silver Sardine', 'Small coastal schooling fish, nimble on the hook and very common near shores.',
    'Sardina Plateada', 'Pequeño pez costero de cardumen, rápido en el anzuelo y muy común en las orillas.'),
  mkFish('fish_guppy_arco_iris', 'F', 18,
    'Guppy Arco-Íris', 'Pequenino peixe de águas calmas com cauda vibrante multicolorida.',
    'Rainbow Guppy', 'Tiny calm-water fish sporting a vibrant multicolored tail fin.',
    'Guppy Arcoíris', 'Pequeño pez de aguas tranquilas con una cola vibrante multicolor.'),
  mkFish('fish_tilapia', 'F', 20,
    'Tilápia Comum', 'Peixe rústico de lago e rio, muito apreciado nas tavernas de Etheria.',
    'Common Tilapia', 'Hardy lake and river fish widely enjoyed across Etheria taverns.',
    'Tilapia Común', 'Pez rústico de lago y río muy apreciado en las tabernas de Etheria.'),
  mkFish('fish_barbo_tigre', 'F', 22,
    'Barbo-Tigre', 'Peixe ágil de escamas douradas e listras escuras verticais.',
    'Tiger Barb', 'Agile fish with golden scales and bold vertical dark stripes.',
    'Barbo Tigre', 'Pez ágil de escamas doradas y franjas oscuras verticales.'),
  mkFish('fish_bagre_cinza', 'F', 24,
    'Bagre de Fundo', 'Peixe de bigodes sensíveis que patrulha o leito lodoso dos rios.',
    'Channel Catfish', 'Whiskered bottom-dweller that patrols muddy riverbeds.',
    'Bagre Gris', 'Pez de bigotes sensibles que patrulla el lecho fangoso de los ríos.'),
  mkFish('fish_peixe_arqueiro', 'F', 26,
    'Peixe-Arqueiro', 'Conhecido por disparar jatos d’água precisos contra insetos na superfície.',
    'Archerfish', 'Renowned for shooting precise water jets at surface insects.',
    'Pez Arquero', 'Conocido por disparar chorros de agua precisos contra insectos.'),

  // Rank D (6)
  mkFish('fish_tetra_neon', 'D', 42,
    'Tetra Neon', 'Brilha com uma faixa azul-elétrica e rubra mesmo em águas turvas.',
    'Neon Tetra', 'Glows with an electric blue and crimson stripe even in murky water.',
    'Tetra Neón', 'Brilla con una franja azul eléctrica y roja incluso en aguas turbias.'),
  mkFish('fish_kinguio', 'D', 45,
    'Kinguio Dourado', 'Peixe ornamental de nadadeiras longas, símbolo de boa sorte para pescadores.',
    'Golden Goldfish', 'Long-finned ornamental fish considered a lucky omen by anglers.',
    'Kinguio Dorado', 'Pez ornamental de aletas largas, símbolo de buena suerte.'),
  mkFish('fish_espadinha_rubra', 'D', 48,
    'Espadinha Rubra', 'Escamas alaranjadas vivas e ponta alongada na nadadeira caudal.',
    'Crimson Swordtail', 'Vivid orange scales paired with an elongated sword-like tail.',
    'Cola de Espada Roja', 'Escamas naranjas vivas y punta alargada en la aleta caudal.'),
  mkFish('fish_peixe_agulha', 'D', 52,
    'Peixe-Agulha', 'Corpo esguio e bico dentado que corta a correnteza como uma flecha.',
    'Silver Needlefish', 'Slender body and toothed beak that slices swiftly through currents.',
    'Pez Aguja', 'Cuerpo esbelto y pico dentado que corta la corriente como una flecha.'),
  mkFish('fish_acara_bandeira', 'D', 55,
    'Acará-Bandeira', 'Elegante peixe prateado de nadadeiras altas e faixas negras simétricas.',
    'Silver Angelfish', 'Graceful silver fish with tall fins and symmetrical dark bands.',
    'Pez Ángel Plateado', 'Elegante pez plateado de aletas altas y franjas negras simétricas.'),
  mkFish('fish_cascudo_leopardo', 'D', 58,
    'Cascudo-Leopardo', 'Armadura natural de placas ósseas manchadas, resistente até fora d’água.',
    'Leopard Pleco', 'Natural armored plates with spotted patterns, tough to reel in.',
    'Pleco Leopardo', 'Armadura natural de placas moteadas, resistente en cada tirón.'),

  // Rank C (6)
  mkFish('fish_linguado', 'C', 85,
    'Linguado Camuflado', 'Predador achatado que se esconde perfeitamente na areia do fundo.',
    'Camouflaged Flounder', 'Flat-bodied ambush predator camouflaged cleanly against sandy beds.',
    'Lenguado Camuflado', 'Depredador plano que se oculta perfectamente en la arena del fondo.'),
  mkFish('fish_peixe_palhaco', 'C', 90,
    'Peixe-Palhaço', 'Inconfundível pelas faixas alaranjadas e brancas contornadas de preto.',
    'Clownfish', 'Unmistakable reef swimmer with bold orange and crisp white bands.',
    'Pez Payaso', 'Inconfundible por sus franjas naranjas y blancas con borde negro.'),
  mkFish('fish_piranha_vermelha', 'C', 95,
    'Piranha-Vermelha', 'Mandíbula feroz e ventre escarlate capaz de testar linhas mais finas.',
    'Red-Bellied Piranha', 'Fierce jaw and scarlet belly ready to snap weak fishing lines.',
    'Piraña Roja', 'Mandíbula feroz y vientre escarlata capaz de probar sedales débiles.'),
  mkFish('fish_truta_arco_iris', 'C', 100,
    'Truta Arco-Íris', 'Habitante de corredeiras frias com reflexo rosado ao longo dos flancos.',
    'Rainbow Trout', 'Cold-stream swimmer displaying a shimmering rose lateral band.',
    'Trucha Arcoíris', 'Habitante de rápidos fríos con reflejo rosado en los flancos.'),
  mkFish('fish_peixe_borboleta', 'C', 105,
    'Peixe-Borboleta-Fio', 'Padrão geométrico amarelo e branco adornado por falso olho defensivo.',
    'Threadfin Butterflyfish', 'Yellow and white geometric markings crowned by a protective eyespot.',
    'Pez Mariposa', 'Patrón amarillo y blanco adornado con un falso ojo defensivo.'),
  mkFish('fish_cirurgiao_amarelo', 'C', 110,
    'Cirurgião-Amarelo', 'De cor amarelo-ouro intensa, desliza velozmente entre corais claros.',
    'Yellow Tang', 'Brilliant golden-yellow reef dweller gliding between coral shelves.',
    'Cirujano Amarillo', 'De intenso color amarillo oro, se desliza veloz entre corales.'),

  // Rank B (6)
  mkFish('fish_salmao_prateado', 'B', 190,
    'Salmão Prateado', 'Peixe migratório musculoso famoso por saltar cachoeiras contra a maré.',
    'Silver Salmon', 'Muscular migratory fish famous for leaping upriver waterfalls.',
    'Salmón Plateado', 'Pez migratorio musculoso famoso por remontar cascadas.'),
  mkFish('fish_pargo_vermelho', 'B', 200,
    'Pargo-Vermelho', 'Peixe nobre de escamas rosadas e carnoso, valioso no comércio marítimo.',
    'Red Snapper', 'Prized rosy-scaled fish highly sought after by coastal merchants.',
    'Pargo Rojo', 'Pez noble de escamas rosadas muy valioso en mercados costeros.'),
  mkFish('fish_acara_disco', 'B', 210,
    'Acará-Disco', 'Corpo circular em azul-turquesa e rubi como uma joia submersa.',
    'Turquoise Discus', 'Circular body patterned in turquoise and ruby like a living jewel.',
    'Pez Disco Turquesa', 'Cuerpo circular en azul turquesa y rubí como una joya acuática.'),
  mkFish('fish_cirurgiao_azul', 'B', 220,
    'Cirurgião-Patela', 'Azul-cobalto intenso com detalhe negro real e cauda amarelo-viva.',
    'Royal Blue Tang', 'Deep cobalt blue swimmer highlighted with black palette and yellow tail.',
    'Cirujano Azul Real', 'Azul cobalto intenso con dibujo negro real y cola amarilla.'),
  mkFish('fish_betta_real', 'B', 230,
    'Betta Real Violeta', 'Véus esvoaçantes em azul e púrpura de temperamento territorial altivo.',
    'Royal Violet Betta', 'Flowing violet and indigo veils with a proud territorial spirit.',
    'Betta Real Violeta', 'Velos flotantes azules y púrpuras de porte majestuoso.'),
  mkFish('fish_oscar_tigre', 'B', 240,
    'Acará-Açu Tigre', 'Robusto ciclídeo manchado em brasa e carvão, combativo até a borda.',
    'Tiger Oscar', 'Stout cichlid mottled in ember orange and charcoal, fierce on the reel.',
    'Óscar Tigre', 'Robusto cíclido moteado en brasa y carbón, combativo hasta el final.'),

  // Rank A (5)
  mkFish('fish_mahi_mahi', 'A', 480,
    'Dourado-do-Mar', 'Nadador oceânico de testa altiva em verde-esmeralda, azul e ouro.',
    'Mahi-Mahi', 'High-browed ocean sprinter gleaming in emerald, azure, and gold.',
    'Dorado del Mar', 'Nadador oceánico de frente alta en verde esmeralda, azul y oro.'),
  mkFish('fish_baiacu_espinho', 'A', 490,
    'Baiacu-Espinho', 'Infla sua armadura de espinhos quando mordisca a isca, exigindo destreza.',
    'Spiny Pufferfish', 'Inflates its thorny armor when hooked, testing an angler’s skill.',
    'Pez Globo Espinoso', 'Infla su armadura de púas al morder, exigiendo gran destreza.'),
  mkFish('fish_idolo_mouro', 'A', 520,
    'Ídolo-Mouro', 'Silhueta exótica em branco, preto e amarelo com longo filamento dorsal.',
    'Moorish Idol', 'Exotic black, white, and yellow profile with a trailing dorsal banner.',
    'Ídolo Moro', 'Silueta exótica blanca, negra y amarilla con largo penacho dorsal.'),
  mkFish('fish_barracuda', 'A', 540,
    'Barracuda Prateada', 'Predador veloz como um torpedo de aço, raramente cai em anzóis comuns.',
    'Great Barracuda', 'Torpedo-fast silver predator that rarely falls for ordinary hooks.',
    'Barracuda Plateada', 'Depredador veloz como un torpedo que rara vez cae en anzuelos simples.'),
  mkFish('fish_peixe_leao', 'A', 560,
    'Peixe-Leão', 'Majestosa coroa de espinhos listrados em marrom e creme de grande raridade.',
    'Lionfish', 'Majestic crown of striped chestnut and cream spines of high rarity.',
    'Pez León', 'Majestuosa corona de espinas listadas en marrón y crema muy rara.'),

  // Rank S (4)
  mkFish('fish_peixe_voador', 'S', 1250,
    'Peixe-Voador', 'Abre suas asas prateadas para planar acima das ondas ao sentir o anzol.',
    'Flying Fish', 'Spreads wing-like pectoral fins to glide across waves when hooked.',
    'Pez Volador', 'Despliega aletas como alas para planear sobre las olas al picar.'),
  mkFish('fish_carpa_koi', 'S', 1350,
    'Carpa Koi Imperial', 'Nobre linhagem manchada em neve, laca e nanquim associada à ascensão.',
    'Imperial Koi Carp', 'Noble bloodline patterned in snow white, lacquer red, and ink black.',
    'Carpa Koi Imperial', 'Noble linaje moteado en blanco nieve, rojo laca y negro tinta.'),
  mkFish('fish_atum_azul', 'S', 1450,
    'Atum-Azul', 'Colosso hidrodinâmico de alto-mar que coloca qualquer vara à prova.',
    'Bluefin Tuna', 'Hydrodynamic open-ocean giant that pushes every rod to its limit.',
    'Atún Rojo', 'Coloso hidrodinámico de alta mar que pone a prueba cualquier caña.'),
  mkFish('fish_peixe_mandarim', 'S', 1600,
    'Peixe-Mandarim', 'Obra viva pintada em azul-celeste, turquesa e mandarina brilhante.',
    'Mandarinfish', 'Living artwork painted in azure, turquoise, and glowing tangerine swirls.',
    'Pez Mandarín', 'Obra viva pintada en azul celeste, turquesa y mandarina brillante.'),

  // Rank SS (3)
  mkFish('fish_peixe_vela', 'SS', 4200,
    'Peixe-Vela', 'Soberano dos mares com vela dorsal safira e lança afiada de velocidade extrema.',
    'Sailfish', 'Sovereign of the seas bearing a sapphire sail and swift spear-like bill.',
    'Pez Vela', 'Soberano de los mares con vela dorsal zafiro y lanza veloz.'),
  mkFish('fish_pirarucu', 'SS', 4600,
    'Pirarucu Rubro', 'Gigante ancestral das águas interiores cuja cauda parece brasa viva.',
    'Crimson Arapaima', 'Ancestral freshwater titan whose crimson tail glows like live embers.',
    'Pirarucú Carmesí', 'Gigante ancestral de aguas dulces cuya cola arde como brasa viva.'),
  mkFish('fish_esturjao_ancestral', 'SS', 5000,
    'Esturjão Ancestral', 'Relíquia blindada de eras antigas, a captura suprema dos mestres pescadores.',
    'Ancestral Sturgeon', 'Armored relic from bygone eras—the ultimate trophy of master anglers.',
    'Esturión Ancestral', 'Reliquia acorazada de eras antiguas, captura suprema de maestros.'),
];

const mkBait = (code, rarityTier, priceGold, catchChanceBonusPct, rankBonusWeights, ptName, ptDesc, enName, enDesc, esName, esDesc) => ({
  code,
  rarityTier,
  priceGold,
  iconPath: `/play/assets/fishing/baits/${code}.png`,
  fishingBaitConfig: { catchChanceBonusPct, rankBonusWeights },
  names: { 'pt-BR': ptName, 'en-US': enName, 'es-ES': esName },
  descs: { 'pt-BR': ptDesc, 'en-US': enDesc, 'es-ES': esDesc },
});

export const BAIT_CATALOG = [
  mkBait('bait_gafanhoto', 'F', 15, 5, { F: 0, D: 5, C: 2, B: 0, A: 0, S: 0, SS: 0 },
    'Gafanhoto Vivo', 'Isca natural leve ideal para peixes rápidos próximos à superfície.',
    'Live Grasshopper', 'Light natural bait ideal for quick surface-feeding fish.',
    'Saltamontes Vivo', 'Cebo natural ligero ideal para peces rápidos de superficie.'),
  mkBait('bait_minhoca_silicone', 'D', 30, 6, { F: 0, D: 6, C: 5, B: 1, A: 0, S: 0, SS: 0 },
    'Minhoca de Silicone', 'Isca macia violeta com vibração constante que atrai cardumes médios.',
    'Silicone Soft Worm', 'Soft violet lure with steady vibration that draws mid-tier fish.',
    'Lombriz de Silicona', 'Señuelo blando violeta con vibración constante para peces medianos.'),
  mkBait('bait_peixinho_vivo', 'D', 45, 8, { F: 0, D: 2, C: 8, B: 4, A: 1, S: 0, SS: 0 },
    'Peixinho Isca Viva', 'Pequeno lambari brilhante preso ao anzol para despertar predadores.',
    'Live Minnow Bait', 'Bright little minnow rigged to tempt hungry freshwater predators.',
    'Pezuelo Vivo', 'Pequeño pez brillante en el anzuelo para atraer depredadores.'),
  mkBait('bait_camarao_vivo', 'C', 70, 10, { F: 0, D: 0, C: 8, B: 8, A: 3, S: 0, SS: 0 },
    'Camarão Fresco', 'Isca irresistível de aroma marinho que eleva capturas de porte médio e raro.',
    'Fresh Shrimp Bait', 'Irresistible marine-scented bait boosting uncommon and rare catches.',
    'Camarón Fresco', 'Cebo marino irresistible que aumenta capturas medianas y raras.'),
  mkBait('bait_mosca_artesanal', 'C', 85, 11, { F: 0, D: 0, C: 6, B: 10, A: 4, S: 1, SS: 0 },
    'Mosca Artesanal de Penas', 'Anzol atado à mão com penas coloridas para pesca técnica de precisão.',
    'Hand-Tied Feather Fly', 'Precision-crafted feathered fly ideal for elusive, wary fish.',
    'Mosca Artesanal', 'Anzuelo atado a mano con plumas coloridas para pesca de precisión.'),
  mkBait('bait_colher_metalica', 'B', 130, 12, { F: 0, D: 0, C: 2, B: 12, A: 7, S: 2, SS: 0 },
    'Isca Colher Metálica', 'Lâmina polida em prata e rubi que reflete clarões na água profunda.',
    'Metallic Spoon Lure', 'Polished ruby-and-silver blade flashing brightly in deeper waters.',
    'Cucharilla Metálica', 'Lámina pulida en plata y rubí que destella en aguas profundas.'),
  mkBait('bait_jig_grub', 'B', 160, 14, { F: 0, D: 0, C: 0, B: 10, A: 10, S: 3, SS: 0.5 },
    'Jig Grub Laranja', 'Cabeça chumbada roxa com cauda espiralada para atrair grandes caçadores.',
    'Orange Curly-Tail Jig', 'Weighted jighead with fluttering curl tail built for large hunters.',
    'Jig Grub Naranja', 'Cabeza plomada púrpura con cola espiral para grandes cazadores.'),
  mkBait('bait_plug_vermelho', 'A', 240, 16, { F: 0, D: 0, C: 0, B: 6, A: 14, S: 6, SS: 1.5 },
    'Plug Cabeça-Vermelha', 'Isca rígida de barbela com duas garatéias para fisgar predadores épicos.',
    'Red-Head Crankbait', 'Hard-bodied diving lure with twin trebles built for epic predators.',
    'Señuelo Cabeza Roja', 'Señuelo rígido de profundidad con ancoretas para presas épicas.'),
  mkBait('bait_sapo_artificial', 'A', 300, 18, { F: 0, D: 0, C: 0, B: 3, A: 15, S: 8, SS: 2.5 },
    'Sapo Artificial Flutuante', 'Isca articulada de superfície perfeita para arrancar monstros de juncos.',
    'Floating Frog Lure', 'Articulated topwater frog designed to lure apex fish from cover.',
    'Rana Artificial Flotante', 'Señuelo articulado de superficie ideal para presas grandes.'),
  mkBait('bait_popper_dourado', 'S', 440, 22, { F: 0, D: 0, C: 0, B: 0, A: 12, S: 14, SS: 5 },
    'Popper Azul-Dourado', 'Cria estampidos rítmicos na água e atrai espécimes lendários de elite.',
    'Azure-Gold Popper', 'Produces rhythmic surface splashes that summon legendary catches.',
    'Popper Azul Dorado', 'Genera chasquidos rítmicos que atraen especies legendarias.'),
  mkBait('bait_spinnerbait_dupla', 'SS', 650, 25, { F: 0, D: 0, C: 0, B: 0, A: 8, S: 18, SS: 10 },
    'Spinnerbait Dupla Prateada', 'Duas pás giratórias de altíssima vibração cobiçadas pelos gigantes míticos.',
    'Twin-Blade Spinnerbait', 'High-vibration dual spinning blades prized for mythical leviathans.',
    'Spinnerbait Doble Plateada', 'Doble hélice de alta vibración para atraer gigantes míticos.'),
];

const mkRod = (code, iconFile, rarityTier, requiredLevel, priceGold, castIntervalSec, catchChancePct, rankWeights, ptName, ptDesc, enName, enDesc, esName, esDesc) => ({
  code,
  rarityTier,
  requiredLevel,
  priceGold,
  iconPath: `/play/assets/fishing/rods/${iconFile}`,
  fishingRodConfig: { castIntervalSec, catchChancePct, rankWeights },
  names: { 'pt-BR': ptName, 'en-US': enName, 'es-ES': esName },
  descs: { 'pt-BR': ptDesc, 'en-US': enDesc, 'es-ES': esDesc },
});

export const ROD_CATALOG = [
  mkRod('rod_7', 'rod_7_bambu_trancado.png', 'F', 50, 400, 14, 80,
    { F: 65, D: 22, C: 8, B: 3, A: 2, S: 0, SS: 0 },
    'Vara de Bambu Trançado', 'Vara leve de bambu reforçado com amarração artesanal e carretilha simples.',
    'Braided Bamboo Rod', 'Lightweight reinforced bamboo rod with hand-wrapped grip and simple reel.',
    'Caña de Bambú Trenzado', 'Caña ligera de bambú reforzado con empuñadura artesanal.'),
  mkRod('rod_8', 'rod_8_fibra_carmesim.png', 'F', 50, 750, 13, 83,
    { F: 56, D: 26, C: 11, B: 5, A: 2, S: 0, SS: 0 },
    'Vara de Fibra Carmesim', 'Haste esguia em fibra vermelha balanceada com cabo de cortiça natural.',
    'Crimson Fiber Rod', 'Balanced crimson composite rod fitted with a natural cork grip.',
    'Caña de Fibra Carmesí', 'Caña esbelta de fibra roja equilibrada con mango de corcho.'),
  mkRod('rod_9', 'rod_9_tatica_grafite.png', 'D', 52, 1400, 12, 86,
    { F: 46, D: 28, C: 16, B: 6, A: 3, S: 1, SS: 0 },
    'Vara Tática de Grafite', 'Construção moderna em carbono escuro com molinete metálico de recolhimento firme.',
    'Graphite Tactical Rod', 'Dark carbon-graphite rod equipped with a high-tension metal reel.',
    'Caña Táctica de Grafito', 'Caña moderna de grafito oscuro con carrete metálico firme.'),
  mkRod('rod_10', 'rod_10_guardiao_floresta.png', 'D', 54, 2200, 11.5, 88,
    { F: 38, D: 28, C: 20, B: 8, A: 4, S: 1.5, SS: 0.5 },
    'Vara do Guardião da Floresta', 'Vara clássica de madeira nobre e anéis esmeralda muito confiável em rios.',
    'Forest Keeper Rod', 'Classic hardwood rod accented with emerald rings, prized on rivers.',
    'Caña Guardián del Bosque', 'Caña clásica de madera noble con anillos esmeralda.'),
  mkRod('rod_11', 'rod_11_mares_escamadas.png', 'C', 56, 3600, 11, 90,
    { F: 30, D: 26, C: 24, B: 11, A: 5, S: 3, SS: 1 },
    'Vara das Marés Escamadas', 'Revestida em escamas azul-safira para suportar mares agitados e fisgadas fortes.',
    'Scaled Tides Rod', 'Wrapped in sapphire scale plating built for rough tides and heavy pulls.',
    'Caña Mareas Escamadas', 'Revestida de escamas zafiro para soportar corrientes intensas.'),
  mkRod('rod_12', 'rod_12_druidica_raiz.png', 'C', 58, 5200, 10.5, 91,
    { F: 24, D: 24, C: 26, B: 14, A: 7, S: 3.5, SS: 1.5 },
    'Vara Drúidica de Raiz Viva', 'Galho vivo entrelaçado com vinhas encantadas que sintonizam a vida aquática.',
    'Living-Root Druidic Rod', 'Living branch entwined with enchanted vines attuned to aquatic life.',
    'Caña Druídica Raíz Viva', 'Rama viva entrelazada con lianas encantadas en armonía fluvial.'),
  mkRod('rod_13', 'rod_13_cronomecanica.png', 'B', 60, 8500, 9.5, 93,
    { F: 16, D: 20, C: 25, B: 20, A: 11, S: 5.5, SS: 2.5 },
    'Vara Cronomecânica de Bronze', 'Engrenagens de latão e cronômetro de precisão que reduzem o intervalo entre lances.',
    'Chronomech Brass Rod', 'Precision brass clockwork gears that shorten every casting cycle.',
    'Caña Cronomecánica Bronce', 'Engranajes de latón y cronómetro que aceleran cada lance.'),
  mkRod('rod_14', 'rod_14_glacial_cristal.png', 'A', 64, 14000, 9, 95,
    { F: 10, D: 15, C: 21, B: 23, A: 17, S: 9.5, SS: 4.5 },
    'Vara Glacial de Cristal', 'Lâmina esculpida em gelo eterno cuja névoa ártica atrai espécimes raros e épicos.',
    'Glacial Crystal Rod', 'Sculpted from eternal crystal ice, drawing rare and epic deep-water catches.',
    'Caña Glacial de Cristal', 'Tallada en cristal helado eterno que atrae especies épicas.'),
  mkRod('rod_15', 'rod_15_dragao_infernal.png', 'A', 68, 22000, 8.5, 97,
    { F: 6, D: 12, C: 18, B: 23, A: 21, S: 13, SS: 7 },
    'Vara do Dragão Infernal', 'Forjada em escamas dracônicas ardentes com chamas vivas na ponteira e no molinete.',
    'Infernal Dragon Rod', 'Forged from blazing draconic scales wreathed in living flame.',
    'Caña Dragón Infernal', 'Forjada con escamas dracónicas ardientes y fuego vivo.'),
  mkRod('rod_16', 'rod_16_abissal_leviata.png', 'S', 72, 36000, 8, 98,
    { F: 3, D: 8, C: 14, B: 22, A: 24, S: 18, SS: 11 },
    'Vara Abissal do Leviatã', 'Barbatanas de cobalto e núcleo luminescente das fossas oceânicas profundas.',
    'Abyssal Leviathan Rod', 'Cobalt fins and deep-trench bioluminescent core made for apex beasts.',
    'Caña Abisal del Leviatán', 'Aletas cobalto y núcleo abisal luminescente para presas supremas.'),
  mkRod('rod_17', 'rod_17_celestial_serafim.png', 'S', 76, 55000, 7, 100,
    { F: 1, D: 5, C: 10, B: 19, A: 26, S: 23, SS: 16 },
    'Vara Celestial Serafim', 'Ouro sagrado e asas alvas abençoadas com 100% de precisão na fisgada.',
    'Celestial Seraph Rod', 'Sacred gold and angelic wings granting 100% hook-set mastery.',
    'Caña Celestial Serafín', 'Oro sagrado y alas angelicales con 100% de precisión de picada.'),
  mkRod('rod_18', 'rod_18_cosmica_veu_astral.png', 'SS', 80, 90000, 6, 100,
    { F: 0, D: 2, C: 6, B: 14, A: 25, S: 28, SS: 25 },
    'Vara Cósmica do Véu Astral', 'Órbitas estelares envolvem esta relíquia suprema, atraindo monstros míticos do Véu.',
    'Astral Veil Cosmic Rod', 'Orbiting starlight rings infuse this supreme relic to summon mythic catches.',
    'Caña Cósmica Velo Astral', 'Órbitas estelares envuelven esta reliquia suprema para capturas míticas.'),
];

async function upsertTranslations(prisma, i18nKey, textsByLocale) {
  for (const [locale, text] of Object.entries(textsByLocale)) {
    await prisma.i18nTranslation.upsert({
      where: { key_locale: { key: i18nKey, locale } },
      update: { text },
      create: { key: i18nKey, locale, text },
    });
  }
}

export async function runSeedFishingPack(prisma) {
  await SnapshotManager.syncTableSequence(prisma, 'i18n_translations');
  await SnapshotManager.syncTableSequence(prisma, 'item_templates');

  const summary = {
    minhocaUpdated: false,
    fishCreated: 0,
    fishSkipped: 0,
    baitsCreated: 0,
    baitsSkipped: 0,
    rodsCreated: 0,
    rodsSkipped: 0,
  };

  // 1. Corrige o ícone da Minhoca existente (e bônus apenas se ainda estiver 100% zerada)
  let minhoca = await prisma.itemTemplate.findUnique({ where: { code: 'item_minhoca_rilyq' } });
  if (!minhoca) {
    const minhocaTr = await prisma.i18nTranslation.findFirst({
      where: { locale: 'pt-BR', text: 'Minhoca', i18nKey: { startsWith: 'item.' } },
    });
    if (minhocaTr) {
      minhoca = await prisma.itemTemplate.findFirst({
        where: { nameI18nKey: minhocaTr.i18nKey, itemCategory: 'FISHING_BAIT' },
      });
    }
  }
  if (minhoca) {
    const spec = (minhoca.specialEffectJson && typeof minhoca.specialEffectJson === 'object')
      ? { ...minhoca.specialEffectJson }
      : {};
    const cfg = spec.fishingBaitConfig || {};
    const rw = cfg.rankBonusWeights || {};
    const isAllZero =
      Number(cfg.catchChanceBonusPct || 0) === 0 &&
      ['F', 'D', 'C', 'B', 'A', 'S', 'SS'].every((r) => Number(rw[r] || 0) === 0);
    await prisma.itemTemplate.update({
      where: { id: minhoca.id },
      data: {
        mcreworkIconKey: MINHOCA_ICON_PATH,
        ...(isAllZero
          ? { specialEffectJson: { ...spec, fishingBaitConfig: MINHOCA_DEFAULT_CONFIG } }
          : {}),
      },
    });
    summary.minhocaUpdated = true;
  }

  // 2. 36 Peixes (`FISH`)
  for (const fish of FISH_CATALOG) {
    const exists = await prisma.itemTemplate.findUnique({ where: { code: fish.code }, select: { id: true } });
    if (exists) {
      summary.fishSkipped++;
      continue;
    }
    const nameKey = `item.${fish.code}.name`;
    const descKey = `item.${fish.code}.desc`;
    await upsertTranslations(prisma, nameKey, fish.names);
    await upsertTranslations(prisma, descKey, fish.descs);
    await prisma.itemTemplate.create({
      data: {
        code: fish.code,
        nameI18nKey: nameKey,
        descriptionI18nKey: descKey,
        mcreworkIconKey: fish.iconPath,
        itemCategory: 'FISH',
        equipmentSlotCode: null,
        rarityTier: fish.rarityTier,
        requiredLevel: 1,
        isTradable: true,
        priceGold: fish.priceGold,
        maxStack: 999,
        cooldownSec: 0,
        targetType: 'NONE',
        effectType: null,
        effectValue: 0,
        reqClassCodesJson: [],
        baseStatBonusesJson: {},
        combatStatBonusesJson: {},
        specialEffectJson: {},
        isActive: true,
      },
    });
    summary.fishCreated++;
  }

  // 3. 11 Novas Iscas (`FISHING_BAIT`)
  for (const bait of BAIT_CATALOG) {
    const exists = await prisma.itemTemplate.findUnique({ where: { code: bait.code }, select: { id: true } });
    if (exists) {
      summary.baitsSkipped++;
      continue;
    }
    const nameKey = `item.${bait.code}.name`;
    const descKey = `item.${bait.code}.desc`;
    await upsertTranslations(prisma, nameKey, bait.names);
    await upsertTranslations(prisma, descKey, bait.descs);
    await prisma.itemTemplate.create({
      data: {
        code: bait.code,
        nameI18nKey: nameKey,
        descriptionI18nKey: descKey,
        mcreworkIconKey: bait.iconPath,
        itemCategory: 'FISHING_BAIT',
        equipmentSlotCode: null,
        rarityTier: bait.rarityTier,
        requiredLevel: 1,
        isTradable: true,
        priceGold: bait.priceGold,
        maxStack: 999,
        cooldownSec: 0,
        targetType: 'NONE',
        effectType: 'FISHING_BAIT',
        effectValue: 0,
        reqClassCodesJson: [],
        baseStatBonusesJson: {},
        combatStatBonusesJson: {},
        specialEffectJson: { fishingBaitConfig: bait.fishingBaitConfig },
        isActive: true,
      },
    });
    summary.baitsCreated++;
  }

  // 4. 12 Novas Varas (`FISHING_ROD`, `rod_7`..`rod_18`)
  for (const rod of ROD_CATALOG) {
    const exists = await prisma.itemTemplate.findUnique({ where: { code: rod.code }, select: { id: true } });
    if (exists) {
      summary.rodsSkipped++;
      continue;
    }
    const nameKey = `item.${rod.code}.name`;
    const descKey = `item.${rod.code}.desc`;
    await upsertTranslations(prisma, nameKey, rod.names);
    await upsertTranslations(prisma, descKey, rod.descs);
    await prisma.itemTemplate.create({
      data: {
        code: rod.code,
        nameI18nKey: nameKey,
        descriptionI18nKey: descKey,
        mcreworkIconKey: rod.iconPath,
        itemCategory: 'FISHING_ROD',
        equipmentSlotCode: 'FISHING_ROD',
        rarityTier: rod.rarityTier,
        requiredLevel: rod.requiredLevel,
        isTradable: true,
        priceGold: rod.priceGold,
        maxStack: 1,
        cooldownSec: 0,
        targetType: 'NONE',
        effectType: null,
        effectValue: 0,
        reqClassCodesJson: [],
        baseStatBonusesJson: {},
        combatStatBonusesJson: {},
        specialEffectJson: { fishingRodConfig: rod.fishingRodConfig },
        isActive: true,
      },
    });
    summary.rodsCreated++;
  }

  I18nCache.invalidate();
  await new SnapshotManager(prisma).exportToDisk();

  const [totalFish, totalBaits, totalRods] = await Promise.all([
    prisma.itemTemplate.count({ where: { itemCategory: 'FISH' } }),
    prisma.itemTemplate.count({ where: { itemCategory: 'FISHING_BAIT' } }),
    prisma.itemTemplate.count({
      where: { OR: [{ itemCategory: 'FISHING_ROD' }, { equipmentSlotCode: 'FISHING_ROD' }] },
    }),
  ]);

  return { ...summary, totals: { totalFish, totalBaits, totalRods } };
}

async function main() {
  const prisma = new PrismaClient();
  try {
    console.log('🎣 Aplicando Pacote Completo de Pesca v0.68.0 (36 peixes, 11 iscas + Minhoca, 12 varas)...');
    const res = await runSeedFishingPack(prisma);
    console.log('✅ Seed de Pesca concluído:', JSON.stringify(res));
  } finally {
    await prisma.$disconnect();
  }
}

const isDirectCli = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isDirectCli) {
  main().catch((err) => {
    console.error('❌ Erro no seed_fishing_pack_v1:', err);
    process.exit(1);
  });
}
