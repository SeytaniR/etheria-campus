/**
 * @file apps/server/src/controllers/AdminQuestsInitialSeeds.ts
 * @module @etheria/server
 * @description Semeador da árvore inicial de Quests por Capítulos e Episódios (1-1, 1-2, 1-3 -> 2-1, 2-2).
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
    const npc1 = npcs[0]?.id || 1;
    const npc2 = npcs[1]?.id || npc1;
    const npc3 = npcs[2]?.id || npc1;
    const npc4 = npcs[3]?.id || npc2;

    if (existing.length > 0) {
      return;
    }

    console.log(
      '📜 [AdminQuestsInitialSeeds] Estruturando Quests por Capítulos e Episódios (1-1, 1-2, 1-3 => 2-1, 2-2)...'
    );

    // CAPÍTULO 1 — EPISÓDIO 1-1
    const ep1_1 = await controller.saveQuestTemplate({
      titlePtBr: 'O Chamado de Izumo',
      descriptionPtBr: 'Apresente-se ao Sábio de Izumo para iniciar o Capítulo 1 da sua jornada.',
      dialogueOfferPtBr: 'Bem-vindo a Izumo, jovem aventureiro! O Sábio de Izumo está procurando por você.',
      dialogueActivePtBr: 'O Sábio de Izumo está logo abaixo na vila. Vá conversar com ele!',
      dialogueCompletePtBr: 'Ah, então você é o novo recruta! Vejo grande potencial elemental em você.',
      questCategory: 'MAIN',
      chapterOrder: 1,
      episodeOrder: 1,
      minLevel: 1,
      prerequisiteQuestId: null,
      repeatType: 'ONCE',
      triggerType: 'NPC_INTERACT',
      triggerConfigJson: { autoAcceptOnTrigger: false },
      requirementsJson: { minLevel: 1 },
      giverNpcId: npc1,
      giverMapId: null,
      turnInNpcId: npc2,
      turnInMapId: null,
      objectivesJson: [
        { type: 'TALK_NPC', npcTemplateId: npc2, mapId: null, requiredCount: 1, labelPtBr: 'Conversar com o Sábio de Izumo' },
      ],
      rewardsJson: { exp: 120, gold: 50, statPoints: 2 },
    });

    // CAPÍTULO 1 — EPISÓDIO 1-2
    const ep1_2 = await controller.saveQuestTemplate({
      titlePtBr: 'Forja e Preparação',
      descriptionPtBr: 'Inspecione o equipamento inicial com o Armeiro John antes de sair para patrulhar.',
      dialogueOfferPtBr: 'Antes de enfrentar os monstros lá fora, vá até o Armeiro John verificar suas lâminas.',
      dialogueActivePtBr: 'Procure o Armeiro John aqui na vila para validar seu equipamento!',
      dialogueCompletePtBr: 'Suas armas estão afiadas! Agora você está pronto para o batismo de fogo.',
      questCategory: 'MAIN',
      chapterOrder: 1,
      episodeOrder: 2,
      minLevel: 1,
      prerequisiteQuestId: ep1_1.id,
      repeatType: 'ONCE',
      triggerType: 'AUTO_ON_PREV_QUEST',
      triggerConfigJson: { autoAcceptOnTrigger: false },
      requirementsJson: { minLevel: 1, prerequisiteQuestId: ep1_1.id },
      giverNpcId: npc2,
      giverMapId: null,
      turnInNpcId: npc3,
      turnInMapId: null,
      objectivesJson: [
        { type: 'TALK_NPC', npcTemplateId: npc3, mapId: null, requiredCount: 1, labelPtBr: 'Falar com o Armeiro John' },
      ],
      rewardsJson: { exp: 180, gold: 80, statPoints: 2 },
    });

    // CAPÍTULO 1 — EPISÓDIO 1-3
    const ep1_3 = await controller.saveQuestTemplate({
      titlePtBr: 'Expurgo nos Arredores de Izumo',
      descriptionPtBr: 'Derrote os saqueadores Sa Tặc da Areia para concluir o Capítulo 1 e liberar o Capítulo 2.',
      dialogueOfferPtBr: 'Os Sa Tặc da Areia estão bloqueando a estrada! Derrote 2 deles e reporte ao Sábio.',
      dialogueActivePtBr: 'Ainda restam Sa Tặc da Areia para derrotar. Entre em combate para abatê-los!',
      dialogueCompletePtBr: 'Magnífico! Você concluiu todas as provações do Capítulo 1.',
      questCategory: 'MAIN',
      chapterOrder: 1,
      episodeOrder: 3,
      minLevel: 1,
      prerequisiteQuestId: ep1_2.id,
      repeatType: 'ONCE',
      triggerType: 'NPC_INTERACT',
      triggerConfigJson: { autoAcceptOnTrigger: false },
      requirementsJson: { minLevel: 1, prerequisiteQuestId: ep1_2.id },
      giverNpcId: npc3,
      giverMapId: null,
      turnInNpcId: npc2,
      turnInMapId: null,
      objectivesJson: [
        { type: 'KILL_MONSTER', monsterTemplateId: 1, requiredCount: 2, labelPtBr: 'Derrotar 2x Sa Tặc da Areia' },
      ],
      rewardsJson: { exp: 350, gold: 180, statPoints: 3 },
    });

    // CAPÍTULO 2 — EPISÓDIO 2-1
    const ep2_1 = await controller.saveQuestTemplate({
      titlePtBr: 'Rumo às Terras de Dong Xuen',
      descriptionPtBr: 'Com Izumo segura, inicie a expedição do Capítulo 2 consultando o Joalheiro Pibu.',
      dialogueOfferPtBr: 'Agora que Izumo está em paz, converse com o Joalheiro Pibu sobre os cristais corrompidos.',
      dialogueActivePtBr: 'Converse com o Joalheiro Pibu para investigar os cristais corrompidos.',
      dialogueCompletePtBr: 'Estes cristais emanam uma energia antiga... Precisamos conter o avanço!',
      questCategory: 'MAIN',
      chapterOrder: 2,
      episodeOrder: 1,
      minLevel: 2,
      prerequisiteQuestId: ep1_3.id,
      repeatType: 'ONCE',
      triggerType: 'NPC_INTERACT',
      triggerConfigJson: { autoAcceptOnTrigger: false },
      requirementsJson: { minLevel: 2, requiredChapterCompleted: 1, prerequisiteQuestId: ep1_3.id },
      giverNpcId: npc2,
      giverMapId: null,
      turnInNpcId: npc4,
      turnInMapId: null,
      objectivesJson: [
        { type: 'TALK_NPC', npcTemplateId: npc4, mapId: null, requiredCount: 1, labelPtBr: 'Investigar com o Joalheiro Pibu' },
      ],
      rewardsJson: { exp: 420, gold: 220, statPoints: 3 },
    });

    // CAPÍTULO 2 — EPISÓDIO 2-2
    await controller.saveQuestTemplate({
      titlePtBr: 'Contra-Ataque da Fronteira',
      descriptionPtBr: 'Vença 2 batalhas decisivas para conter o avanço das criaturas corrompidas no Capítulo 2.',
      dialogueOfferPtBr: 'As criaturas estão se multiplicando! Vença 2 batalhas na fronteira.',
      dialogueActivePtBr: 'Vença 2 combates e traga os fragmentos purificados!',
      dialogueCompletePtBr: 'Incrível! O Capítulo 2 foi concluído com honra!',
      questCategory: 'MAIN',
      chapterOrder: 2,
      episodeOrder: 2,
      minLevel: 2,
      prerequisiteQuestId: ep2_1.id,
      repeatType: 'ONCE',
      triggerType: 'AUTO_ON_PREV_QUEST',
      triggerConfigJson: { autoAcceptOnTrigger: false },
      requirementsJson: { minLevel: 2, prerequisiteQuestId: ep2_1.id },
      giverNpcId: npc4,
      giverMapId: null,
      turnInNpcId: npc2,
      turnInMapId: null,
      objectivesJson: [{ type: 'WIN_BATTLES', requiredCount: 2, labelPtBr: 'Vencer 2 Batalhas na Fronteira' }],
      rewardsJson: { exp: 600, gold: 320, statPoints: 4 },
    });

    // SECUNDÁRIA (SIDE)
    await controller.saveQuestTemplate({
      titlePtBr: 'Remessa de Minérios Raros',
      descriptionPtBr: 'Avise o Joalheiro Pibu que a forja do Armeiro John já processou os cristais.',
      dialogueOfferPtBr: 'Ei! Pode avisar o Joalheiro Pibu ali ao lado que os engastes dele ficaram prontos?',
      dialogueActivePtBr: 'O Joalheiro Pibu está esperando o recado logo ali à direita!',
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
      giverNpcId: npc3,
      giverMapId: null,
      turnInNpcId: npc4,
      turnInMapId: null,
      objectivesJson: [
        { type: 'TALK_NPC', npcTemplateId: npc4, mapId: null, requiredCount: 1, labelPtBr: 'Entregar recado ao Joalheiro Pibu' },
      ],
      rewardsJson: { exp: 150, gold: 100, statPoints: 1 },
    });

    // PROFICIÊNCIA (PROFICIENCY)
    await controller.saveQuestTemplate({
      titlePtBr: 'Proficiência: Veterano de Combate',
      descriptionPtBr: 'Prove sua maestria marcial vencendo 3 combates contra criaturas selvagens.',
      dialogueOfferPtBr: 'Quer aprimorar sua Proficiência? Vença 3 batalhas contra qualquer monstro!',
      dialogueActivePtBr: 'Continue treinando! Vença 3 batalhas para completar seu teste.',
      dialogueCompletePtBr: 'Sua postura de batalha evoluiu muito. Receba estes pontos extras de atributo!',
      questCategory: 'PROFICIENCY',
      chapterOrder: 1,
      episodeOrder: 1,
      minLevel: 1,
      prerequisiteQuestId: null,
      repeatType: 'REPEATABLE',
      triggerType: 'NPC_INTERACT',
      triggerConfigJson: { autoAcceptOnTrigger: false },
      requirementsJson: { minLevel: 1 },
      giverNpcId: npc3,
      giverMapId: null,
      turnInNpcId: npc3,
      turnInMapId: null,
      objectivesJson: [{ type: 'WIN_BATTLES', requiredCount: 3, labelPtBr: 'Vencer 3 Batalhas contra Monstros' }],
      rewardsJson: { exp: 400, gold: 200, statPoints: 3 },
    });

    // ÉPICA (EPIC)
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
      prerequisiteQuestId: ep1_3.id,
      repeatType: 'ONCE',
      triggerType: 'REACH_LEVEL',
      triggerConfigJson: { autoAcceptOnTrigger: false },
      requirementsJson: { minLevel: 3, requiredChapterCompleted: 1, prerequisiteQuestId: ep1_3.id },
      giverNpcId: npc2,
      giverMapId: null,
      turnInNpcId: npc2,
      turnInMapId: null,
      objectivesJson: [{ type: 'WIN_BATTLES', requiredCount: 5, labelPtBr: 'Vencer 5 Batalhas para o Ritual Épico' }],
      rewardsJson: { exp: 1000, gold: 500, statPoints: 5, triggerReborn: true },
    });
  } catch (err) {
    console.warn('[AdminQuestsInitialSeeds] Aviso ao semear quests iniciais:', err);
  }
}
