/**
 * @file apps/server/src/controllers/AdminQuestsInitialSeeds.ts
 * @module @etheria/server
 * @description Semeador oficial do Arco Narrativo do Capítulo 1: O Manto da Restauração (Vila Izumo, Nível 1 ao 10).
 * @rules
 *   - REGRA SAGRADA MANDATÓRIA: 0 pontos de atributos livres distribuíveis em quests!
 *   - Apenas Level Up (+5 pontos base por nível) concede atributos distribuíveis.
 *   - Missão 1-1 concede o Conjunto Inicial do Aprendiz completo (12 peças de combate).
 */

import { PrismaClient } from '@prisma/client';
import type { AdminQuestsController } from './AdminQuestsController.js';

export async function ensureInitialQuestsSeed(
  controller: AdminQuestsController,
  prisma: PrismaClient
): Promise<void> {
  try {
    const existing = await prisma.questTemplate.findMany({ orderBy: { id: 'asc' } });
    const npcs = await prisma.npcTemplate.findMany({ orderBy: { id: 'asc' } });
    const npcKaori = npcs.find((n) => n.code === 'npc_1')?.id || 1;
    const npcGenpaku = npcs.find((n) => n.code === 'npc_2')?.id || 2;
    const npcJinbei = npcs.find((n) => n.code === 'npc_3')?.id || 3;
    const npcRen = npcs.find((n) => n.code === 'npc_4')?.id || 4;
    const npcMou = npcs.find((n) => n.code === 'npc_5')?.id || 5;
    const npcDaisuke = npcs.find((n) => n.code === 'npc_6')?.id || 6;
    const npcKoji = npcs.find((n) => n.code === 'npc_7')?.id || 7;

    if (existing.length > 0) {
      return;
    }

    console.log(
      '📜 [AdminQuestsInitialSeeds] Semeando Arco Oficial do Capítulo 1: O Manto da Restauração (Vila Izumo, Lv 1 ao 10)...'
    );

    // IDs do Conjunto Inicial do Aprendiz (12 peças)
    const apprenticeItemIds = [45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56];

    // MISSÃO 1-1: O Chamado da Restauração
    const ep1_1 = await controller.saveQuestTemplate({
      titlePtBr: 'O Chamado da Restauração',
      descriptionPtBr: 'Apresente-se à Oficial Kaori em Vila Izumo, receba o Conjunto Inicial do Aprendiz (12 peças) e encontre o Arquivista Mestre Genpaku no Templo Ancestral.',
      dialogueOfferPtBr: 'Respire fundo, recruta. Desde que o Conselho ruiu, fendas invisíveis sangram o éter bruto sobre nossas terras. Mas o Alto Curador assumiu a vigília da civilização. Aqui está sua comissão oficial e as doze peças do Conjunto do Aprendiz. Equipe-as em sua mochila e procure o Mestre Genpaku no Templo Ancestral!',
      dialogueActivePtBr: 'Vista seu equipamento completo em sua mochila e procure o Arquivista Mestre Genpaku no platô ao norte!',
      dialogueCompletePtBr: 'Aproxime-se, jovem restaurador... Deixe-me sentir a ressonância do seu éter. Sim, você carrega a marca do Primeiro Arquivista. Mas escute: o Véu está gemendo sob um peso nunca antes visto.',
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
    });

    // MISSÃO 1-2: A Fenda e a Bolha Dimensional
    const ep1_2 = await controller.saveQuestTemplate({
      titlePtBr: 'A Fenda e a Bolha Dimensional',
      descriptionPtBr: 'Aprenda os segredos do Véu com o Armeiro Jinbei e treine combate dimensional com a Sentinela Ren no bosque.',
      dialogueOfferPtBr: 'O Véu é uma bolha que nos protege do cataclismo. Tudo o que sangrar ou quebrar lá dentro não toca o mundo físico. Vá ao Armeiro Jinbei para afinar suas lâminas e procure a Sentinela Ren para seu batismo dimensional.',
      dialogueActivePtBr: 'Não hesite ao ser sugado pelo vácuo do Véu! Mantenha os pés ágeis, esquive dos golpes pesados e descarregue suas habilidades!',
      dialogueCompletePtBr: 'Excelente controle gravitacional! Veja como o espólio se materializou intacto no chão físico ao fechar a fenda. Essa é a magia do Véu: vitória isolada, espólio no plano real!',
      questCategory: 'MAIN',
      chapterOrder: 1,
      episodeOrder: 2,
      minLevel: 2,
      prerequisiteQuestId: ep1_1.id,
      repeatType: 'ONCE',
      triggerType: 'AUTO_ON_PREV_QUEST',
      triggerConfigJson: { autoAcceptOnTrigger: false },
      requirementsJson: { minLevel: 2, prerequisiteQuestId: ep1_1.id },
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
    });

    // MISSÃO 1-3: Ecos do Éter e os Resíduos Censurados
    const ep1_3 = await controller.saveQuestTemplate({
      titlePtBr: 'Ecos do Éter e os Resíduos Censurados',
      descriptionPtBr: 'Purifique anomalias na orla de Izumo, recolha amostras de resíduos etéreos e entregue para análise ao Lapidador Mou.',
      dialogueOfferPtBr: 'O Alto Curador ordenou o abate de feras da margem para recolher Resíduos de Véu e abastecer os motores da capital. Mas quando olhei nos olhos daquelas criaturas, não vi invasores... elas pareciam guardiãs sofrendo. Purifique 3 combates e leve os resíduos ao Lapidador Mou.',
      dialogueActivePtBr: 'Cuidado ao manusear esses resíduos na mochila! A ressonância deles é muito densa.',
      dialogueCompletePtBr: 'Pelos ancestrais... Isto não é lixo de aberração! Esta geometria hexagonal é uma matriz de contenção primordial! E este papiro censurado proibia drenar essas feras... O que o Curador está realmente nos mandando matar?!',
      questCategory: 'MAIN',
      chapterOrder: 1,
      episodeOrder: 3,
      minLevel: 4,
      prerequisiteQuestId: ep1_2.id,
      repeatType: 'ONCE',
      triggerType: 'NPC_INTERACT',
      triggerConfigJson: { autoAcceptOnTrigger: false },
      requirementsJson: { minLevel: 4, prerequisiteQuestId: ep1_2.id },
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
    });

    // MISSÃO 1-4: O Sussurro da Dissidência
    const ep1_4 = await controller.saveQuestTemplate({
      titlePtBr: 'O Sussurro da Dissidência',
      descriptionPtBr: 'Consulte o Comandante Daisuke sobre os relatórios rasurados, sobreviva à emboscada dos rebeldes no bambuzal e reporte o incidente.',
      dialogueOfferPtBr: 'Guarde esse papiro rasurado. Vá falar com o Comandante Daisuke no Portão Leste, mas passe discretamente pela trilha dos bambus. Sinto que há sombras nos vigiando desde que você cruzou a ponte.',
      dialogueActivePtBr: 'O que foi essa oscilação violenta nos bambuzais? Suas vestes estão chamuscadas de magia dissidente!',
      dialogueCompletePtBr: 'Dissidentes atacando dentro de Izumo?! Eles gritaram que você é um fantoche do Curador? Não dê ouvidos a fanáticos! Mas... olhe para o céu da arena: aquela borda roxa trincada não estava ali antes. Algo grave está acontecendo.',
      questCategory: 'MAIN',
      chapterOrder: 1,
      episodeOrder: 4,
      minLevel: 6,
      prerequisiteQuestId: ep1_3.id,
      repeatType: 'ONCE',
      triggerType: 'NPC_INTERACT',
      triggerConfigJson: { autoAcceptOnTrigger: false },
      requirementsJson: { minLevel: 6, prerequisiteQuestId: ep1_3.id },
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
    });

    // MISSÃO 1-5: O Rompimento do Marco e a Passagem Proibida
    await controller.saveQuestTemplate({
      titlePtBr: 'O Rompimento do Marco e a Passagem Proibida',
      descriptionPtBr: 'Abata o Guardião Alfa que bloqueia o Portal 1 de Izumo, liberte a rota para o Pantanal das Nuvens e receba sua consagração de Nível 10.',
      dialogueOfferPtBr: 'Chegou sua hora, Restaurador! O portal para o Pantanal das Nuvens está bloqueado por uma tempestade etérea colossal. O Alto Curador ordenou a drenagem total do monstro alfa. Adentre o Véu, abata o guardião e liberte a passagem!',
      dialogueActivePtBr: 'O chão tremeu quando a fenda se abriu! Você conseguiu derrotar a fera colossal do marco?',
      dialogueCompletePtBr: 'Você conseguiu! O portal para o Pantanal das Nuvens finalmente se estabilizou e está liberado para você! Em nome da Ordem da Restauração, eu o consagro Agente de Campo de Nível 10! As terras do Pantanal o aguardam!',
      questCategory: 'MAIN',
      chapterOrder: 1,
      episodeOrder: 5,
      minLevel: 8,
      prerequisiteQuestId: ep1_4.id,
      repeatType: 'ONCE',
      triggerType: 'NPC_INTERACT',
      triggerConfigJson: { autoAcceptOnTrigger: false },
      requirementsJson: { minLevel: 8, prerequisiteQuestId: ep1_4.id },
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
    });

    // MISSÕES SECUNDÁRIAS (SIDE, PROFICIENCY, EPIC) - TODAS COM statPoints: 0
    await controller.saveQuestTemplate({
      titlePtBr: 'Remessa de Minérios Raros',
      descriptionPtBr: 'Avise o Lapidador Mou que a forja do Armeiro Jinbei já processou os cristais.',
      dialogueOfferPtBr: 'Ei! Pode avisar o Lapidador Mou ali ao lado que os engastes dele ficaram prontos?',
      dialogueActivePtBr: 'O Lapidador Mou está esperando o recado logo ali à direita!',
      dialogueCompletePtBr: 'Maravilha! Eu estava mesmo aguardando esses engastes. Tome estas moedas!',
      questCategory: 'SIDE',
      chapterOrder: 1,
      episodeOrder: 1,
      minLevel: 1,
      prerequisiteQuestId: null,
      repeatType: 'ONCE',
      triggerType: 'NPC_INTERACT',
      triggerConfigJson: { autoAcceptOnTrigger: false },
      requirementsJson: { minLevel: 1 },
      giverNpcId: npcJinbei,
      giverMapId: null,
      turnInNpcId: npcMou,
      turnInMapId: null,
      objectivesJson: [
        { type: 'TALK_NPC', npcTemplateId: npcMou, mapId: null, requiredCount: 1, labelPtBr: 'Entregar recado ao Lapidador Mou' },
      ],
      rewardsJson: { exp: 150, gold: 100, statPoints: 0 },
    });

    await controller.saveQuestTemplate({
      titlePtBr: 'Proficiência: Veterano de Combate',
      descriptionPtBr: 'Prove sua maestria marcial vencendo 3 combates contra criaturas selvagens.',
      dialogueOfferPtBr: 'Quer aprimorar sua Proficiência? Vença 3 batalhas contra qualquer monstro!',
      dialogueActivePtBr: 'Continue treinando! Vença 3 batalhas para completar seu teste.',
      dialogueCompletePtBr: 'Sua postura de batalha evoluiu muito! Continue honrando o manto da Restauração.',
      questCategory: 'PROFICIENCY',
      chapterOrder: 1,
      episodeOrder: 1,
      minLevel: 1,
      prerequisiteQuestId: null,
      repeatType: 'REPEATABLE',
      triggerType: 'NPC_INTERACT',
      triggerConfigJson: { autoAcceptOnTrigger: false },
      requirementsJson: { minLevel: 1 },
      giverNpcId: npcJinbei,
      giverMapId: null,
      turnInNpcId: npcJinbei,
      turnInMapId: null,
      objectivesJson: [{ type: 'WIN_BATTLES', requiredCount: 3, labelPtBr: 'Vencer 3 Batalhas contra Monstros' }],
      rewardsJson: { exp: 400, gold: 200, statPoints: 0 },
    });

    await controller.saveQuestTemplate({
      titlePtBr: 'Prova Épica: Despertar Reborn',
      descriptionPtBr: 'Supere 5 batalhas decisivas após concluir o Capítulo 1 para alcançar a Reencarnação.',
      dialogueOfferPtBr: 'Apenas guerreiros que concluíram o Capítulo 1 podem tentar o Ritual Épico de Reencarnação!',
      dialogueActivePtBr: 'O caminho Épico exige perseverança. Vença 5 combates e retorne!',
      dialogueCompletePtBr: 'Que poder extraordinário! Sua alma ascendeu ao estado Reencarnado (Reborn)!',
      questCategory: 'EPIC',
      chapterOrder: 2,
      episodeOrder: 1,
      minLevel: 3,
      prerequisiteQuestId: ep1_1.id,
      repeatType: 'ONCE',
      triggerType: 'REACH_LEVEL',
      triggerConfigJson: { autoAcceptOnTrigger: false },
      requirementsJson: { minLevel: 3, requiredChapterCompleted: 1, prerequisiteQuestId: ep1_1.id },
      giverNpcId: npcGenpaku,
      giverMapId: null,
      turnInNpcId: npcGenpaku,
      turnInMapId: null,
      objectivesJson: [{ type: 'WIN_BATTLES', requiredCount: 5, labelPtBr: 'Vencer 5 Batalhas para o Ritual Épico' }],
      rewardsJson: { exp: 1000, gold: 500, statPoints: 0, triggerReborn: true },
    });
  } catch (err) {
    console.warn('[AdminQuestsInitialSeeds] Aviso ao semear quests iniciais:', err);
  }
}
