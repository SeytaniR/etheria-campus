/**
 * @file scripts/apply_izumo_lore_and_lock_stats.mjs
 * @module @etheria/scripts
 * @description Migração Oficial do Arco do Capítulo 1: O Manto da Restauração (Vila Izumo, Nível 1 ao 10).
 * @rules
 *   - REGRA SAGRADA MANDATÓRIA: 0 pontos de atributos livres distribuíveis em quests!
 *   - Apenas Level Up (+5 pontos base por nível) concede atributos distribuíveis.
 *   - Missão 1-1 concede o Conjunto Inicial do Aprendiz completo (12 peças de combate).
 *   - Curadoria e renomeação dos 7 NPCs de Vila Izumo com remoção de isDecorationOnly para Jinbei e Ren.
 *   - Exporta o snapshot oficial lowcode.snapshot.json.
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

const prisma = new PrismaClient();

async function upsertI18n(key, text) {
  return prisma.i18nTranslation.upsert({
    where: { key_locale: { key, locale: 'pt-BR' } },
    update: { text },
    create: { key, locale: 'pt-BR', text },
  });
}

async function main() {
  console.log('🚀 [apply_izumo_lore] Iniciando aplicação da Lore de Izumo e Blindagem de Atributos...');

  try {
    // 1. Curadoria e Renomeação dos 7 NPCs de Vila Izumo
    console.log('\n--- 1. ATUALIZANDO TRADUÇÕES DOS 7 NPCS DE IZUMO ---');
    const npcTranslations = [
      { key: 'npc.npc_1.name', text: 'Oficial Kaori (Acolhedora da Restauração)' },
      { key: 'npc.npc_2.name', text: 'Arquivista Mestre Genpaku (Sábio do Templo Ancestral)' },
      { key: 'npc.npc_3.name', text: 'Armeiro Jinbei (Forjador de Véu)' },
      { key: 'npc.npc_4.name', text: 'Sentinela Ren (Batedora do Bosque)' },
      { key: 'npc.npc_5.name', text: 'Lapidador Mou (Artífice de Essências)' },
      { key: 'npc.npc_6.name', text: 'Comandante Daisuke (Capitão da Guarda)' },
      { key: 'npc.npc_7.name', text: 'Alquimista Koji (Boticário de Izumo)' },
    ];
    for (const t of npcTranslations) {
      await upsertI18n(t.key, t.text);
      console.log(`✅ Tradução gravada: ${t.key} -> ${t.text}`);
    }

    // 2. Atualizar NpcTemplates (desmarcar isDecorationOnly para Jinbei e Ren)
    console.log('\n--- 2. ATIVANDO NPCS DE COMBATE/QUESTS EM NPC_TEMPLATES ---');
    await prisma.npcTemplate.updateMany({
      where: { code: { in: ['npc_3', 'npc_4'] } },
      data: {
        isDecorationOnly: false,
        triggersJson: [{ type: 'QUEST' }],
      },
    });
    console.log('✅ Jinbei (npc_3) e Ren (npc_4) ativados para interação de missões!');

    // 3. Blindar todas as quests existentes contra statPoints livres
    console.log('\n--- 3. BLINDAGEM SAGRADA: ZERANDO statPoints EM TODAS AS QUESTS ---');
    const existingQuests = await prisma.questTemplate.findMany();
    for (const q of existingQuests) {
      const rew = (q.rewardsJson || {}) ;
      if (rew.statPoints || rew.freePointsBonus) {
        rew.statPoints = 0;
        rew.freePointsBonus = 0;
        await prisma.questTemplate.update({
          where: { id: q.id },
          data: { rewardsJson: rew },
        });
        console.log(`🔒 Quest #${q.id} (${q.code}): statPoints forçado a 0 com sucesso.`);
      }
    }

    // 4. Cadastrar / Substituir o Arco Principal de 5 Missões (Capítulo 1: Nível 1 ao 10)
    console.log('\n--- 4. CADASTRANDO O ARCO DE 5 MISSÕES PRINCIPAIS (NV 1 AO 10) ---');
    const npcs = await prisma.npcTemplate.findMany({ orderBy: { id: 'asc' } });
    const npcMap = new Map(npcs.map((n) => [n.code, n.id]));
    const npcKaori = npcMap.get('npc_1') || 1;
    const npcGenpaku = npcMap.get('npc_2') || 2;
    const npcJinbei = npcMap.get('npc_3') || 3;
    const npcRen = npcMap.get('npc_4') || 4;
    const npcMou = npcMap.get('npc_5') || 5;
    const npcDaisuke = npcMap.get('npc_6') || 6;

    // IDs do Conjunto do Aprendiz (12 peças)
    const apprenticeItemIds = [45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56];

    // MISSÃO 1-1
    await upsertI18n('quest.quest_main_01.title', 'O Chamado da Restauração');
    await upsertI18n(
      'quest.quest_main_01.desc',
      'Apresente-se à Oficial Kaori em Vila Izumo, receba o Conjunto Inicial do Aprendiz (12 peças) e encontre o Arquivista Mestre Genpaku no Templo Ancestral.'
    );
    await upsertI18n(
      'quest.quest_main_01.dialogue_offer',
      'Respire fundo, recruta. Desde que o Conselho ruiu, fendas invisíveis sangram o éter bruto sobre nossas terras. Mas o Alto Curador assumiu a vigília da civilização. Aqui está sua comissão oficial e as doze peças do Conjunto do Aprendiz. Equipe-as em sua mochila e procure o Mestre Genpaku no Templo Ancestral!'
    );
    await upsertI18n(
      'quest.quest_main_01.dialogue_active',
      'Vista seu equipamento completo em sua mochila e procure o Arquivista Mestre Genpaku no platô ao norte!'
    );
    await upsertI18n(
      'quest.quest_main_01.dialogue_complete',
      'Aproxime-se, jovem restaurador... Deixe-me sentir a ressonância do seu éter. Sim, você carrega a marca do Primeiro Arquivista. Mas escute: o Véu está gemendo sob um peso nunca antes visto.'
    );

    const q1 = await prisma.questTemplate.upsert({
      where: { code: 'quest_main_01' },
      update: {
        titleI18nKey: 'quest.quest_main_01.title',
        descriptionI18nKey: 'quest.quest_main_01.desc',
        dialogueOfferI18nKey: 'quest.quest_main_01.dialogue_offer',
        dialogueActiveI18nKey: 'quest.quest_main_01.dialogue_active',
        dialogueCompleteI18nKey: 'quest.quest_main_01.dialogue_complete',
        questCategory: 'MAIN',
        chapterOrder: 1,
        episodeOrder: 1,
        minLevel: 1,
        prerequisiteQuestId: null,
        repeatType: 'ONCE',
        triggerType: 'NPC_INTERACT',
        triggerConfigJson: { autoAcceptOnTrigger: false },
        requirementsJson: { minLevel: 1 },
        giverNpcId: npcKaori,
        giverMapId: null,
        turnInNpcId: npcGenpaku,
        turnInMapId: null,
        objectivesJson: [
          { type: 'TALK_NPC', npcTemplateId: npcKaori, mapId: null, requiredCount: 1, labelPtBr: 'Aceitar a comissão com a Oficial Kaori' },
          { type: 'TALK_NPC', npcTemplateId: npcGenpaku, mapId: null, requiredCount: 1, labelPtBr: 'Apresentar-se ao Arquivista Mestre Genpaku' },
        ],
        rewardsJson: {
          exp: 220,
          gold: 100,
          statPoints: 0,
          rewardItemTemplateIds: apprenticeItemIds,
        },
        isActive: true,
      },
      create: {
        code: 'quest_main_01',
        titleI18nKey: 'quest.quest_main_01.title',
        descriptionI18nKey: 'quest.quest_main_01.desc',
        dialogueOfferI18nKey: 'quest.quest_main_01.dialogue_offer',
        dialogueActiveI18nKey: 'quest.quest_main_01.dialogue_active',
        dialogueCompleteI18nKey: 'quest.quest_main_01.dialogue_complete',
        questCategory: 'MAIN',
        chapterOrder: 1,
        episodeOrder: 1,
        minLevel: 1,
        prerequisiteQuestId: null,
        repeatType: 'ONCE',
        triggerType: 'NPC_INTERACT',
        triggerConfigJson: { autoAcceptOnTrigger: false },
        requirementsJson: { minLevel: 1 },
        giverNpcId: npcKaori,
        giverMapId: null,
        turnInNpcId: npcGenpaku,
        turnInMapId: null,
        objectivesJson: [
          { type: 'TALK_NPC', npcTemplateId: npcKaori, mapId: null, requiredCount: 1, labelPtBr: 'Aceitar a comissão com a Oficial Kaori' },
          { type: 'TALK_NPC', npcTemplateId: npcGenpaku, mapId: null, requiredCount: 1, labelPtBr: 'Apresentar-se ao Arquivista Mestre Genpaku' },
        ],
        rewardsJson: {
          exp: 220,
          gold: 100,
          statPoints: 0,
          rewardItemTemplateIds: apprenticeItemIds,
        },
        isActive: true,
      },
    });
    console.log(`✅ Quest 1-1 configurada: #${q1.id} (${q1.code})`);

    // MISSÃO 1-2
    await upsertI18n('quest.quest_main_02.title', 'A Fenda e a Bolha Dimensional');
    await upsertI18n(
      'quest.quest_main_02.desc',
      'Aprenda os segredos do Véu com o Armeiro Jinbei e treine combate dimensional com a Sentinela Ren no bosque.'
    );
    await upsertI18n(
      'quest.quest_main_02.dialogue_offer',
      'O Véu é uma bolha que nos protege do cataclismo. Tudo o que sangrar ou quebrar lá dentro não toca o mundo físico. Vá ao Armeiro Jinbei para afinar suas lâminas e procure a Sentinela Ren para seu batismo dimensional.'
    );
    await upsertI18n(
      'quest.quest_main_02.dialogue_active',
      'Não hesite ao ser sugado pelo vácuo do Véu! Mantenha os pés ágeis, esquive dos golpes pesados e descarregue suas habilidades!'
    );
    await upsertI18n(
      'quest.quest_main_02.dialogue_complete',
      'Excelente controle gravitacional! Veja como o espólio se materializou intacto no chão físico ao fechar a fenda. Essa é a magia do Véu: vitória isolada, espólio no plano real!'
    );

    const q2 = await prisma.questTemplate.upsert({
      where: { code: 'quest_main_02' },
      update: {
        titleI18nKey: 'quest.quest_main_02.title',
        descriptionI18nKey: 'quest.quest_main_02.desc',
        dialogueOfferI18nKey: 'quest.quest_main_02.dialogue_offer',
        dialogueActiveI18nKey: 'quest.quest_main_02.dialogue_active',
        dialogueCompleteI18nKey: 'quest.quest_main_02.dialogue_complete',
        questCategory: 'MAIN',
        chapterOrder: 1,
        episodeOrder: 2,
        minLevel: 2,
        prerequisiteQuestId: q1.id,
        repeatType: 'ONCE',
        triggerType: 'AUTO_ON_PREV_QUEST',
        triggerConfigJson: { autoAcceptOnTrigger: false },
        requirementsJson: { minLevel: 2, prerequisiteQuestId: q1.id },
        giverNpcId: npcGenpaku,
        giverMapId: null,
        turnInNpcId: npcRen,
        turnInMapId: null,
        objectivesJson: [
          { type: 'TALK_NPC', npcTemplateId: npcJinbei, mapId: null, requiredCount: 1, labelPtBr: 'Consultar o Armeiro Jinbei sobre afiação no vácuo' },
          { type: 'WIN_BATTLES', requiredCount: 2, labelPtBr: 'Vencer 2 combates de treino no Véu' },
          { type: 'TALK_NPC', npcTemplateId: npcRen, mapId: null, requiredCount: 1, labelPtBr: 'Reportar a estabilização à Sentinela Ren' },
        ],
        rewardsJson: {
          exp: 750,
          gold: 250,
          statPoints: 0,
          rewardItems: [
            { itemTemplateId: 1, quantity: 5 },
            { itemTemplateId: 2, quantity: 5 },
          ],
        },
        isActive: true,
      },
      create: {
        code: 'quest_main_02',
        titleI18nKey: 'quest.quest_main_02.title',
        descriptionI18nKey: 'quest.quest_main_02.desc',
        dialogueOfferI18nKey: 'quest.quest_main_02.dialogue_offer',
        dialogueActiveI18nKey: 'quest.quest_main_02.dialogue_active',
        dialogueCompleteI18nKey: 'quest.quest_main_02.dialogue_complete',
        questCategory: 'MAIN',
        chapterOrder: 1,
        episodeOrder: 2,
        minLevel: 2,
        prerequisiteQuestId: q1.id,
        repeatType: 'ONCE',
        triggerType: 'AUTO_ON_PREV_QUEST',
        triggerConfigJson: { autoAcceptOnTrigger: false },
        requirementsJson: { minLevel: 2, prerequisiteQuestId: q1.id },
        giverNpcId: npcGenpaku,
        giverMapId: null,
        turnInNpcId: npcRen,
        turnInMapId: null,
        objectivesJson: [
          { type: 'TALK_NPC', npcTemplateId: npcJinbei, mapId: null, requiredCount: 1, labelPtBr: 'Consultar o Armeiro Jinbei sobre afiação no vácuo' },
          { type: 'WIN_BATTLES', requiredCount: 2, labelPtBr: 'Vencer 2 combates de treino no Véu' },
          { type: 'TALK_NPC', npcTemplateId: npcRen, mapId: null, requiredCount: 1, labelPtBr: 'Reportar a estabilização à Sentinela Ren' },
        ],
        rewardsJson: {
          exp: 750,
          gold: 250,
          statPoints: 0,
          rewardItems: [
            { itemTemplateId: 1, quantity: 5 },
            { itemTemplateId: 2, quantity: 5 },
          ],
        },
        isActive: true,
      },
    });
    console.log(`✅ Quest 1-2 configurada: #${q2.id} (${q2.code})`);

    // MISSÃO 1-3
    await upsertI18n('quest.quest_main_03.title', 'Ecos do Éter e os Resíduos Censurados');
    await upsertI18n(
      'quest.quest_main_03.desc',
      'Purifique anomalias na orla de Izumo, recolha amostras de resíduos etéreos e entregue para análise ao Lapidador Mou.'
    );
    await upsertI18n(
      'quest.quest_main_03.dialogue_offer',
      'O Alto Curador ordenou o abate de feras da margem para recolher Resíduos de Véu e abastecer os motores da capital. Mas quando olhei nos olhos daquelas criaturas, não vi invasores... elas pareciam guardiãs sofrendo. Purifique 3 combates e leve os resíduos ao Lapidador Mou.'
    );
    await upsertI18n(
      'quest.quest_main_03.dialogue_active',
      'Cuidado ao manusear esses resíduos na mochila! A ressonância deles é muito densa.'
    );
    await upsertI18n(
      'quest.quest_main_03.dialogue_complete',
      'Pelos ancestrais... Isto não é lixo de aberração! Esta geometria hexagonal é uma matriz de contenção primordial! E este papiro censurado proibia drenar essas feras... O que o Curador está realmente nos mandando matar?!'
    );

    const q3 = await prisma.questTemplate.upsert({
      where: { code: 'quest_main_03' },
      update: {
        titleI18nKey: 'quest.quest_main_03.title',
        descriptionI18nKey: 'quest.quest_main_03.desc',
        dialogueOfferI18nKey: 'quest.quest_main_03.dialogue_offer',
        dialogueActiveI18nKey: 'quest.quest_main_03.dialogue_active',
        dialogueCompleteI18nKey: 'quest.quest_main_03.dialogue_complete',
        questCategory: 'MAIN',
        chapterOrder: 1,
        episodeOrder: 3,
        minLevel: 4,
        prerequisiteQuestId: q2.id,
        repeatType: 'ONCE',
        triggerType: 'NPC_INTERACT',
        triggerConfigJson: { autoAcceptOnTrigger: false },
        requirementsJson: { minLevel: 4, prerequisiteQuestId: q2.id },
        giverNpcId: npcRen,
        giverMapId: null,
        turnInNpcId: npcMou,
        turnInMapId: null,
        objectivesJson: [
          { type: 'WIN_BATTLES', requiredCount: 3, labelPtBr: 'Vencer 3 batalhas contra anomalias no Véu' },
          { type: 'TALK_NPC', npcTemplateId: npcMou, mapId: null, requiredCount: 1, labelPtBr: 'Entregar os resíduos ao Lapidador Mou' },
        ],
        rewardsJson: {
          exp: 1400,
          gold: 500,
          statPoints: 0,
        },
        isActive: true,
      },
      create: {
        code: 'quest_main_03',
        titleI18nKey: 'quest.quest_main_03.title',
        descriptionI18nKey: 'quest.quest_main_03.desc',
        dialogueOfferI18nKey: 'quest.quest_main_03.dialogue_offer',
        dialogueActiveI18nKey: 'quest.quest_main_03.dialogue_active',
        dialogueCompleteI18nKey: 'quest.quest_main_03.dialogue_complete',
        questCategory: 'MAIN',
        chapterOrder: 1,
        episodeOrder: 3,
        minLevel: 4,
        prerequisiteQuestId: q2.id,
        repeatType: 'ONCE',
        triggerType: 'NPC_INTERACT',
        triggerConfigJson: { autoAcceptOnTrigger: false },
        requirementsJson: { minLevel: 4, prerequisiteQuestId: q2.id },
        giverNpcId: npcRen,
        giverMapId: null,
        turnInNpcId: npcMou,
        turnInMapId: null,
        objectivesJson: [
          { type: 'WIN_BATTLES', requiredCount: 3, labelPtBr: 'Vencer 3 batalhas contra anomalias no Véu' },
          { type: 'TALK_NPC', npcTemplateId: npcMou, mapId: null, requiredCount: 1, labelPtBr: 'Entregar os resíduos ao Lapidador Mou' },
        ],
        rewardsJson: {
          exp: 1400,
          gold: 500,
          statPoints: 0,
        },
        isActive: true,
      },
    });
    console.log(`✅ Quest 1-3 configurada: #${q3.id} (${q3.code})`);

    // MISSÃO 1-4
    await upsertI18n('quest.quest_main_04.title', 'O Sussurro da Dissidência');
    await upsertI18n(
      'quest.quest_main_04.desc',
      'Consulte o Comandante Daisuke sobre os relatórios rasurados, sobreviva à emboscada dos rebeldes no bambuzal e reporte o incidente.'
    );
    await upsertI18n(
      'quest.quest_main_04.dialogue_offer',
      'Guarde esse papiro rasurado. Vá falar com o Comandante Daisuke no Portão Leste, mas passe discretamente pela trilha dos bambus. Sinto que há sombras nos vigiando desde que você cruzou a ponte.'
    );
    await upsertI18n(
      'quest.quest_main_04.dialogue_active',
      'O que foi essa oscilação violenta nos bambuzais? Suas vestes estão chamuscadas de magia dissidente!'
    );
    await upsertI18n(
      'quest.quest_main_04.dialogue_complete',
      'Dissidentes atacando dentro de Izumo?! Eles gritaram que você é um fantoche do Curador? Não dê ouvidos a fanáticos! Mas... olhe para o céu da arena: aquela borda roxa trincada não estava ali antes. Algo grave está acontecendo.'
    );

    const q4 = await prisma.questTemplate.upsert({
      where: { code: 'quest_main_04' },
      update: {
        titleI18nKey: 'quest.quest_main_04.title',
        descriptionI18nKey: 'quest.quest_main_04.desc',
        dialogueOfferI18nKey: 'quest.quest_main_04.dialogue_offer',
        dialogueActiveI18nKey: 'quest.quest_main_04.dialogue_active',
        dialogueCompleteI18nKey: 'quest.quest_main_04.dialogue_complete',
        questCategory: 'MAIN',
        chapterOrder: 1,
        episodeOrder: 4,
        minLevel: 6,
        prerequisiteQuestId: q3.id,
        repeatType: 'ONCE',
        triggerType: 'NPC_INTERACT',
        triggerConfigJson: { autoAcceptOnTrigger: false },
        requirementsJson: { minLevel: 6, prerequisiteQuestId: q3.id },
        giverNpcId: npcMou,
        giverMapId: null,
        turnInNpcId: npcDaisuke,
        turnInMapId: null,
        objectivesJson: [
          { type: 'WIN_BATTLES', requiredCount: 2, labelPtBr: 'Sobreviver à emboscada e vencer 2 batalhas no Véu' },
          { type: 'TALK_NPC', npcTemplateId: npcDaisuke, mapId: null, requiredCount: 1, labelPtBr: 'Reportar o ataque ao Comandante Daisuke' },
        ],
        rewardsJson: {
          exp: 2100,
          gold: 800,
          statPoints: 0,
          unlockSkillId: 1,
        },
        isActive: true,
      },
      create: {
        code: 'quest_main_04',
        titleI18nKey: 'quest.quest_main_04.title',
        descriptionI18nKey: 'quest.quest_main_04.desc',
        dialogueOfferI18nKey: 'quest.quest_main_04.dialogue_offer',
        dialogueActiveI18nKey: 'quest.quest_main_04.dialogue_active',
        dialogueCompleteI18nKey: 'quest.quest_main_04.dialogue_complete',
        questCategory: 'MAIN',
        chapterOrder: 1,
        episodeOrder: 4,
        minLevel: 6,
        prerequisiteQuestId: q3.id,
        repeatType: 'ONCE',
        triggerType: 'NPC_INTERACT',
        triggerConfigJson: { autoAcceptOnTrigger: false },
        requirementsJson: { minLevel: 6, prerequisiteQuestId: q3.id },
        giverNpcId: npcMou,
        giverMapId: null,
        turnInNpcId: npcDaisuke,
        turnInMapId: null,
        objectivesJson: [
          { type: 'WIN_BATTLES', requiredCount: 2, labelPtBr: 'Sobreviver à emboscada e vencer 2 batalhas no Véu' },
          { type: 'TALK_NPC', npcTemplateId: npcDaisuke, mapId: null, requiredCount: 1, labelPtBr: 'Reportar o ataque ao Comandante Daisuke' },
        ],
        rewardsJson: {
          exp: 2100,
          gold: 800,
          statPoints: 0,
          unlockSkillId: 1,
        },
        isActive: true,
      },
    });
    console.log(`✅ Quest 1-4 configurada: #${q4.id} (${q4.code})`);

    // MISSÃO 1-5
    await upsertI18n('quest.quest_main_05.title', 'O Rompimento do Marco e a Passagem Proibida');
    await upsertI18n(
      'quest.quest_main_05.desc',
      'Abata o Guardião Alfa que bloqueia o Portal 1 de Izumo, liberte a rota para o Pantanal das Nuvens e receba sua consagração de Nível 10.'
    );
    await upsertI18n(
      'quest.quest_main_05.dialogue_offer',
      'Chegou sua hora, Restaurador! O portal para o Pantanal das Nuvens está bloqueado por uma tempestade etérea colossal. O Alto Curador ordenou a drenagem total do monstro alfa. Adentre o Véu, abata o guardião e liberte a passagem!'
    );
    await upsertI18n(
      'quest.quest_main_05.dialogue_active',
      'O chão tremeu quando a fenda se abriu! Você conseguiu derrotar a fera colossal do marco?'
    );
    await upsertI18n(
      'quest.quest_main_05.dialogue_complete',
      'Você conseguiu! O portal para o Pantanal das Nuvens finalmente se estabilizou e está liberado para você! Em nome da Ordem da Restauração, eu o consagro Agente de Campo de Nível 10! As terras do Pantanal o aguardam!'
    );

    const q5 = await prisma.questTemplate.upsert({
      where: { code: 'quest_main_05' },
      update: {
        titleI18nKey: 'quest.quest_main_05.title',
        descriptionI18nKey: 'quest.quest_main_05.desc',
        dialogueOfferI18nKey: 'quest.quest_main_05.dialogue_offer',
        dialogueActiveI18nKey: 'quest.quest_main_05.dialogue_active',
        dialogueCompleteI18nKey: 'quest.quest_main_05.dialogue_complete',
        questCategory: 'MAIN',
        chapterOrder: 1,
        episodeOrder: 5,
        minLevel: 8,
        prerequisiteQuestId: q4.id,
        repeatType: 'ONCE',
        triggerType: 'NPC_INTERACT',
        triggerConfigJson: { autoAcceptOnTrigger: false },
        requirementsJson: { minLevel: 8, prerequisiteQuestId: q4.id },
        giverNpcId: npcDaisuke,
        giverMapId: null,
        turnInNpcId: npcKaori,
        turnInMapId: null,
        objectivesJson: [
          { type: 'WIN_BATTLES', requiredCount: 3, labelPtBr: 'Derrotar anomalias e o Guardião Alfa no Véu' },
          { type: 'TALK_NPC', npcTemplateId: npcKaori, mapId: null, requiredCount: 1, labelPtBr: 'Consagrar a abertura do portal com a Oficial Kaori' },
        ],
        rewardsJson: {
          exp: 2800,
          gold: 1500,
          statPoints: 0,
        },
        isActive: true,
      },
      create: {
        code: 'quest_main_05',
        titleI18nKey: 'quest.quest_main_05.title',
        descriptionI18nKey: 'quest.quest_main_05.desc',
        dialogueOfferI18nKey: 'quest.quest_main_05.dialogue_offer',
        dialogueActiveI18nKey: 'quest.quest_main_05.dialogue_active',
        dialogueCompleteI18nKey: 'quest.quest_main_05.dialogue_complete',
        questCategory: 'MAIN',
        chapterOrder: 1,
        episodeOrder: 5,
        minLevel: 8,
        prerequisiteQuestId: q4.id,
        repeatType: 'ONCE',
        triggerType: 'NPC_INTERACT',
        triggerConfigJson: { autoAcceptOnTrigger: false },
        requirementsJson: { minLevel: 8, prerequisiteQuestId: q4.id },
        giverNpcId: npcDaisuke,
        giverMapId: null,
        turnInNpcId: npcKaori,
        turnInMapId: null,
        objectivesJson: [
          { type: 'WIN_BATTLES', requiredCount: 3, labelPtBr: 'Derrotar anomalias e o Guardião Alfa no Véu' },
          { type: 'TALK_NPC', npcTemplateId: npcKaori, mapId: null, requiredCount: 1, labelPtBr: 'Consagrar a abertura do portal com a Oficial Kaori' },
        ],
        rewardsJson: {
          exp: 2800,
          gold: 1500,
          statPoints: 0,
        },
        isActive: true,
      },
    });
    console.log(`✅ Quest 1-5 configurada: #${q5.id} (${q5.code})`);

    // 5. Exportar snapshot oficial atualizado
    console.log('\n--- 5. EXPORTANDO SNAPSHOT LOWCODE OFICIAL ---');
    const { SnapshotManager } = await import('@etheria/database');
    const sm = new SnapshotManager(prisma);
    const snapPath = await sm.exportToDisk();
    console.log(`✅ Snapshot exportado com sucesso em: ${snapPath}`);

    console.log('\n🎉 [apply_izumo_lore] Todas as operações foram concluídas com sucesso!');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('❌ Falha na execução do apply_izumo_lore:', err);
  process.exit(1);
});
