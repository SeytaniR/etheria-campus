/**
 * @file apps/server/src/controllers/HunterPetController.ts
 * @module @etheria/server
 * @description Controlador da Função de Caçador (`HUNTER`):
 *   Gerencia a geração/invocação de Pets a partir do consumo de Essências dos Monstros derrotados,
 *   com custos escalonados por Raridade (F, D, C, B, A, S, SS) configuráveis na tabela `hunter_pet_cost_rules`.
 * @rules Segue estritamente AGENTS.md (Zero Hardcode via hunter_pet_cost_rules, transações atômicas, Regra #7 < 1.000 linhas).
 * @dependencies node:http, @prisma/client, @etheria/database (I18nCache, SnapshotManager), ./CharacterPetService.js, ./CharacterInventoryService.js
 */

import type * as http from 'node:http';
import { PrismaClient } from '@prisma/client';
import { I18nCache, SnapshotManager } from '@etheria/database';
import { CharacterPetService } from './CharacterPetService.js';
import { CharacterInventoryService } from './CharacterInventoryService.js';

export interface RaceEssenceInfo {
  raceCode: string;
  raceNamePtBr: string;
  itemCode: string;
  namePtBr: string;
  iconUrl: string;
}

export const RACE_ESSENCE_MAP: Record<string, RaceEssenceInfo> = {
  PLANT: {
    raceCode: 'PLANT',
    raceNamePtBr: 'Planta / Botânico',
    itemCode: 'item_essencia_de_planta_i8e6j',
    namePtBr: 'Essência Botânica',
    iconUrl: '/play/assets/items/essences/item_essence_botanica.png',
  },
  BEAST: {
    raceCode: 'BEAST',
    raceNamePtBr: 'Besta / Selvagem',
    itemCode: 'item_essencia_de_selvagem_ghj3x',
    namePtBr: 'Essência Selvagem',
    iconUrl: '/play/assets/items/essences/item_essence_selvagem.png',
  },
  AQUATIC: {
    raceCode: 'AQUATIC',
    raceNamePtBr: 'Aquático',
    itemCode: 'item_essencia_aquatica_r17fz',
    namePtBr: 'Essência Aquática',
    iconUrl: '/play/assets/items/essences/item_essence_aquatica.png',
  },
  DEMON: {
    raceCode: 'DEMON',
    raceNamePtBr: 'Demônio',
    itemCode: 'item_essencia_demoniaca_oaod7',
    namePtBr: 'Essência Demoníaca',
    iconUrl: '/play/assets/items/essences/item_essence_demoniaca.png',
  },
  DRAGON: {
    raceCode: 'DRAGON',
    raceNamePtBr: 'Dragão',
    itemCode: 'item_essencia_draconica_gjrko',
    namePtBr: 'Essência Dracônica',
    iconUrl: '/play/assets/items/essences/item_essence_draconica.png',
  },
  FAIRY: {
    raceCode: 'FAIRY',
    raceNamePtBr: 'Fada / Élfico',
    itemCode: 'item_essencia_elfica_gfegf',
    namePtBr: 'Essência Élfica',
    iconUrl: '/play/assets/items/essences/item_essence_elfica.png',
  },
  HUMAN: {
    raceCode: 'HUMAN',
    raceNamePtBr: 'Humano',
    itemCode: 'item_essencia_humana_l30fi',
    namePtBr: 'Essência Humana',
    iconUrl: '/play/assets/items/essences/item_essence_humana.png',
  },
  REPTILIAN: {
    raceCode: 'REPTILIAN',
    raceNamePtBr: 'Reptiliano',
    itemCode: 'item_essencia_reptiliana_wv5uc',
    namePtBr: 'Essência Reptiliana',
    iconUrl: '/play/assets/items/essences/item_essence_reptiliana.png',
  },
  ROBOTIC: {
    raceCode: 'ROBOTIC',
    raceNamePtBr: 'Robótico',
    itemCode: 'item_essencia_robotica_ukpuv',
    namePtBr: 'Essência Robótica',
    iconUrl: '/play/assets/items/essences/item_essence_robotica.png',
  },
  SPIRIT: {
    raceCode: 'SPIRIT',
    raceNamePtBr: 'Espírito',
    itemCode: 'item_essencia_espiritual_3bffa',
    namePtBr: 'Essência Espiritual',
    iconUrl: '/play/assets/items/essences/item_essence_espiritual.png',
  },
  CELESTIAL: {
    raceCode: 'CELESTIAL',
    raceNamePtBr: 'Celestial / Angelical',
    itemCode: 'item_essencia_angelical_m0xhm',
    namePtBr: 'Essência Celestial',
    iconUrl: '/play/assets/items/essences/item_essence_angelical.png',
  },
};

export const DEFAULT_HUNTER_COST_RULES: Record<string, number> = {
  F: 30,
  D: 70,
  C: 120,
  B: 300,
  A: 700,
  S: 1600,
  SS: 3500,
};

export const DEFAULT_HUNTER_REWARD_RULES: Record<string, number> = {
  F: 15,
  D: 35,
  C: 60,
  B: 150,
  A: 350,
  S: 800,
  SS: 1750,
};

export class HunterPetController {
  private static readonly mcreworkPagesBaseUrl = '/api/assets/mcrework';

  /**
   * Retorna os custos de essências por raridade salvos na tabela `hunter_pet_cost_rules` (com fallback padrão).
   */
  public static async getCostRules(prisma: PrismaClient): Promise<Record<string, number>> {
    try {
      const rows = await (prisma as any).hunterPetCostRule.findMany({ orderBy: { id: 'asc' } });
      if (Array.isArray(rows) && rows.length > 0) {
        const out: Record<string, number> = { ...DEFAULT_HUNTER_COST_RULES };
        for (const r of rows) {
          out[r.rarityTier] = Number(r.essenceCost) || DEFAULT_HUNTER_COST_RULES[r.rarityTier] || 30;
        }
        return out;
      }
    } catch (err) {
      console.warn('[HunterPetController] Tabela hunter_pet_cost_rules não acessível, usando padrões:', err);
    }
    return { ...DEFAULT_HUNTER_COST_RULES };
  }

  /**
   * Retorna a recompensa de essências por raridade para a venda/reciclagem de pets.
   */
  public static async getRewardRules(prisma: PrismaClient): Promise<Record<string, number>> {
    try {
      const rows = await (prisma as any).hunterPetCostRule.findMany({ orderBy: { id: 'asc' } });
      if (Array.isArray(rows) && rows.length > 0) {
        const out: Record<string, number> = { ...DEFAULT_HUNTER_REWARD_RULES };
        for (const r of rows) {
          out[r.rarityTier] = Number(r.essenceReward) || DEFAULT_HUNTER_REWARD_RULES[r.rarityTier] || 15;
        }
        return out;
      }
    } catch (err) {
      console.warn('[HunterPetController] Falha ao ler regras de recompensa, usando padrões:', err);
    }
    return { ...DEFAULT_HUNTER_REWARD_RULES };
  }

  /**
   * Retorna o estado completo da tela do Caçador para o Personagem:
   * - Custos por raridade (invocação)
   * - Recompensas por raridade (venda de pets)
   * - Raças disponíveis e quantia atual de cada essência no inventário do jogador
   * - Todos os pets domáveis ativos (com visual, raça, raridade e atributos)
   */
  public static async getHunterBootstrap(prisma: PrismaClient, characterId: number) {
    const [i18nMap, costRules, rewardRules, invItems, monsters] = await Promise.all([
      I18nCache.getTranslations(prisma),
      this.getCostRules(prisma),
      this.getRewardRules(prisma),
      prisma.characterInventoryItem.findMany({
        where: { characterId: Number(characterId) },
        include: { itemTemplate: true },
      }),
      prisma.monsterTemplate.findMany({
        where: { isActive: true, isTamableAsPet: true },
        orderBy: [{ rarityTier: 'asc' }, { id: 'asc' }],
      }),
    ]);

    // Calcula quantias de essência no inventário
    const essenceCounts: Record<string, number> = {};
    for (const inv of invItems) {
      const code = inv.itemTemplate?.code;
      if (code && code.includes('essencia')) {
        essenceCounts[code] = (essenceCounts[code] || 0) + (inv.quantity || 1);
      }
    }

    const races = Object.values(RACE_ESSENCE_MAP).map((r) => ({
      ...r,
      playerQuantity: essenceCounts[r.itemCode] || 0,
    }));

    const tamablePets = monsters.map((m) => {
      const key = m.mcreworkMonsterKey;
      return {
        id: m.id,
        code: m.code,
        namePtBr: i18nMap.get(m.nameI18nKey) ?? m.code,
        raceCode: m.raceCode,
        rarityTier: m.rarityTier || 'F',
        fixedElementCode: m.fixedElementCode,
        combatStyle: m.combatStyle,
        attackRange: m.attackRange,
        damageType: m.damageType,
        thumbUrl: `${this.mcreworkPagesBaseUrl}/assets/monsters/${key}/thumb.webp`,
        atlasJsonUrl: `${this.mcreworkPagesBaseUrl}/assets/monsters/${key}/atlas.json`,
        atlasWebpUrl: `${this.mcreworkPagesBaseUrl}/assets/monsters/${key}/atlas.webp`,
        baseAttributesJson: m.baseAttributesJson,
        baseCombatAttributesJson: m.baseCombatAttributesJson,
      };
    });

    const petsPayload = await CharacterPetService.getCharacterPetsPayload(prisma, characterId);

    return {
      costRules,
      rewardRules,
      races,
      tamablePets,
      playerEssences: essenceCounts,
      petsPayload,
    };
  }

  /**
   * Realiza a criação do Pet no Caçador:
   * Valida quantidade de essências, deduz do inventário e cria o pet nível 1 com elemento aleatório.
   */
  public static async craftPet(
    prisma: PrismaClient,
    characterId: number,
    dto: { monsterTemplateId: number; customNickname?: string }
  ) {
    const targetMonsterId = Math.round(Number(dto.monsterTemplateId) || 0);
    if (!targetMonsterId) {
      throw new Error('Selecione o pet desejado para invocar.');
    }

    const mt = await prisma.monsterTemplate.findUnique({
      where: { id: targetMonsterId },
    });
    if (!mt) {
      throw new Error(`Monstro #${targetMonsterId} não encontrado.`);
    }
    if (!mt.isActive || !mt.isTamableAsPet) {
      throw new Error('Este monstro não está disponível como Pet Domável.');
    }

    const essenceMeta = RACE_ESSENCE_MAP[mt.raceCode];
    if (!essenceMeta) {
      throw new Error(`Não há essência configurada para a raça "${mt.raceCode}".`);
    }

    const costRules = await this.getCostRules(prisma);
    const requiredCost = costRules[mt.rarityTier] || DEFAULT_HUNTER_COST_RULES[mt.rarityTier] || 30;

    // Busca o ItemTemplate da essência
    const essenceItem = await prisma.itemTemplate.findUnique({
      where: { code: essenceMeta.itemCode },
    });
    if (!essenceItem) {
      throw new Error(`Item de essência "${essenceMeta.itemCode}" não encontrado no catálogo.`);
    }

    // Busca os stacks dessa essência no inventário do personagem
    const stacks = await prisma.characterInventoryItem.findMany({
      where: { characterId: Number(characterId), itemTemplateId: essenceItem.id },
      orderBy: { slotIndex: 'asc' },
    });

    const totalAvailable = stacks.reduce((acc, s) => acc + (s.quantity || 1), 0);
    if (totalAvailable < requiredCost) {
      throw new Error(
        `Essências insuficientes! Para criar um pet Rank ${mt.rarityTier} você precisa de ${requiredCost}x ${essenceMeta.namePtBr}, mas possui apenas ${totalAvailable}.`
      );
    }

    // Executa em transação segura
    let createdPet: any;
    await prisma.$transaction(async (tx) => {
      let remainingToDeduct = requiredCost;
      for (const stack of stacks) {
        if (remainingToDeduct <= 0) break;
        if (stack.quantity <= remainingToDeduct) {
          remainingToDeduct -= stack.quantity;
          await tx.characterInventoryItem.delete({ where: { id: stack.id } });
        } else {
          await tx.characterInventoryItem.update({
            where: { id: stack.id },
            data: { quantity: stack.quantity - remainingToDeduct },
          });
          remainingToDeduct = 0;
        }
      }

      createdPet = await CharacterPetService.generatePetForCharacter(
        tx as any,
        characterId,
        mt.id,
        dto.customNickname
      );
    });

    const petsPayload = await CharacterPetService.getCharacterPetsPayload(prisma, characterId);
    const updatedBootstrap = await this.getHunterBootstrap(prisma, characterId);

    return {
      success: true,
      createdPet,
      petsPayload,
      deducted: {
        itemCode: essenceMeta.itemCode,
        namePtBr: essenceMeta.namePtBr,
        amount: requiredCost,
      },
      updatedPlayerEssences: updatedBootstrap.playerEssences,
    };
  }

  /**
   * Realiza a venda / reciclagem de um Pet no Caçador:
   * - Devolve todos os equipamentos equipados no pet para a mochila do jogador.
   * - Exclui o Pet.
   * - Adiciona a quantia configurada de essência da raça do pet na mochila do jogador.
   * - Adiciona a quantia configurada de ouro (se houver).
   */
  public static async sellPet(
    prisma: PrismaClient,
    characterId: number,
    characterPetId: number
  ) {
    const targetPetId = Math.round(Number(characterPetId) || 0);
    if (!targetPetId) {
      throw new Error('Selecione o pet que deseja vender.');
    }

    const pet = await prisma.characterPet.findFirst({
      where: { id: targetPetId, characterId: Number(characterId) },
      include: { monsterTemplate: true },
    });
    if (!pet) {
      throw new Error('Pet não encontrado ou não pertence a este personagem.');
    }

    const raceCode = pet.monsterTemplate?.raceCode;
    const essenceMeta = raceCode ? RACE_ESSENCE_MAP[raceCode] : null;
    if (!essenceMeta) {
      throw new Error(`Não há essência configurada para a raça "${raceCode || 'desconhecida'}" deste pet.`);
    }

    const essenceItem = await prisma.itemTemplate.findUnique({
      where: { code: essenceMeta.itemCode },
    });
    if (!essenceItem) {
      throw new Error(`Item de essência "${essenceMeta.itemCode}" não encontrado no catálogo.`);
    }

    const rarityTier = pet.monsterTemplate?.rarityTier || 'F';
    const rewardRules = await this.getRewardRules(prisma);
    const essenceReward = rewardRules[rarityTier] || DEFAULT_HUNTER_REWARD_RULES[rarityTier] || 15;

    // Busca regra no banco para ouro se configurado
    let goldReward = 0;
    try {
      const ruleRow = await (prisma as any).hunterPetCostRule.findUnique({
        where: { rarityTier },
      });
      if (ruleRow?.goldReward) {
        goldReward = Math.max(0, Number(ruleRow.goldReward));
      }
    } catch {
      goldReward = 0;
    }

    // Identifica equipamentos equipados para devolução à mochila
    const eqMap = (pet.equippedItemsJson && typeof pet.equippedItemsJson === 'object'
      ? (pet.equippedItemsJson as Record<string, number>)
      : {}) as Record<string, number>;
    const returnedEquipIds: number[] = [];
    for (const rawItemId of Object.values(eqMap)) {
      const itemId = Number(rawItemId);
      if (Number.isInteger(itemId) && itemId > 0) {
        returnedEquipIds.push(itemId);
      }
    }

    // Valida slots livres na mochila para receber equipamentos de volta
    const freeSlots = await CharacterInventoryService.countFreeSlots(prisma, characterId);
    if (returnedEquipIds.length > 0 && freeSlots < returnedEquipIds.length) {
      throw new Error(
        `Mochila cheia! Você precisa de pelo menos ${returnedEquipIds.length} slot(s) livre(s) na mochila para recolher os equipamentos deste pet antes de vendê-lo.`
      );
    }

    // Executa em transação segura
    let returnedEquipmentsCount = 0;
    await prisma.$transaction(async (tx) => {
      // 1. Devolve equipamentos para a mochila do jogador
      for (const itemId of returnedEquipIds) {
        try {
          await CharacterInventoryService.addItem(tx, characterId, itemId, 1);
          returnedEquipmentsCount += 1;
        } catch (err: any) {
          console.warn(`[HunterPetController] Erro ao devolver equipamento #${itemId} do pet #${pet.id}:`, err?.message || err);
        }
      }

      // 2. Exclui o pet
      await tx.characterPet.delete({
        where: { id: pet.id },
      });

      // 3. Credita a essência da raça
      await CharacterInventoryService.addItem(tx, characterId, essenceItem.id, essenceReward);

      // 4. Credita ouro se houver
      if (goldReward > 0) {
        await CharacterInventoryService.addGold(tx, characterId, goldReward);
      }
    });

    const petsPayload = await CharacterPetService.getCharacterPetsPayload(prisma, characterId);
    const updatedBootstrap = await this.getHunterBootstrap(prisma, characterId);

    return {
      success: true,
      soldPet: {
        id: pet.id,
        nickname: pet.nickname,
        rarityTier,
        raceCode,
      },
      reward: {
        itemCode: essenceMeta.itemCode,
        namePtBr: essenceMeta.namePtBr,
        essenceAmount: essenceReward,
        goldAmount: goldReward,
      },
      returnedEquipmentsCount,
      petsPayload,
      updatedPlayerEssences: updatedBootstrap.playerEssences,
    };
  }

  /**
   * Roteador de endpoints HTTP de Caçador para a rota `/play`.
   */
  public static async handlePlayHunterRoute(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    pathname: string,
    method: string,
    prisma: PrismaClient,
    verifyOwnership: (cId: number) => Promise<boolean>,
    readJsonBody: <T = any>(req: http.IncomingMessage) => Promise<T>,
    sendJson: (res: http.ServerResponse, statusCode: number, data: unknown) => void
  ): Promise<boolean> {
    const bootstrapMatch = pathname.match(/^\/api\/play\/characters\/(\d+)\/hunter-bootstrap$/);
    if (bootstrapMatch && method === 'GET') {
      const charId = Number(bootstrapMatch[1]);
      if (!(await verifyOwnership(charId))) {
        sendJson(res, 403, { error: 'Acesso não autorizado a este personagem.' });
        return true;
      }
      try {
        const data = await this.getHunterBootstrap(prisma, charId);
        sendJson(res, 200, data);
      } catch (err: any) {
        sendJson(res, 500, { error: err.message || 'Erro ao carregar dados do Caçador.' });
      }
      return true;
    }

    const craftMatch = pathname.match(/^\/api\/play\/characters\/(\d+)\/hunter-craft$/);
    if (craftMatch && method === 'POST') {
      const charId = Number(craftMatch[1]);
      if (!(await verifyOwnership(charId))) {
        sendJson(res, 403, { error: 'Acesso não autorizado a este personagem.' });
        return true;
      }
      try {
        const body = await readJsonBody<{ monsterTemplateId: number; customNickname?: string }>(req);
        const result = await this.craftPet(prisma, charId, body);
        sendJson(res, 201, result);
      } catch (err: any) {
        sendJson(res, 400, { error: err.message || 'Erro ao criar pet.' });
      }
      return true;
    }

    const sellMatch = pathname.match(/^\/api\/play\/characters\/(\d+)\/hunter-sell-pet$/);
    if (sellMatch && method === 'POST') {
      const charId = Number(sellMatch[1]);
      if (!(await verifyOwnership(charId))) {
        sendJson(res, 403, { error: 'Acesso não autorizado a este personagem.' });
        return true;
      }
      try {
        const body = await readJsonBody<{ characterPetId: number }>(req);
        const result = await this.sellPet(prisma, charId, body.characterPetId);
        sendJson(res, 200, result);
      } catch (err: any) {
        sendJson(res, 400, { error: err.message || 'Erro ao vender pet.' });
      }
      return true;
    }

    return false;
  }

  /**
   * Retorna todas as regras de custos e recompensas configuradas para o Admin.
   */
  public static async getAdminCostRules(prisma: PrismaClient) {
    try {
      const rows = await (prisma as any).hunterPetCostRule.findMany({ orderBy: { id: 'asc' } });
      if (Array.isArray(rows) && rows.length > 0) {
        return rows;
      }
    } catch (err) {
      console.warn('[HunterPetController] Falha ao ler hunterPetCostRule:', err);
    }
    return Object.entries(DEFAULT_HUNTER_COST_RULES).map(([rarityTier, essenceCost], idx) => ({
      id: idx + 1,
      rarityTier,
      essenceCost,
      goldCost: 0,
      essenceReward: DEFAULT_HUNTER_REWARD_RULES[rarityTier] || 15,
      goldReward: 0,
    }));
  }

  /**
   * Salva alterações de custos e recompensas no banco e exporta para o snapshot canônico.
   */
  public static async updateAdminCostRules(
    prisma: PrismaClient,
    rules: Array<{ rarityTier: string; essenceCost: number; goldCost?: number; essenceReward?: number; goldReward?: number }>
  ) {
    if (!Array.isArray(rules) || rules.length === 0) {
      throw new Error('Lista de regras de custos inválida.');
    }

    const updatedRows = [];
    for (const r of rules) {
      const tier = String(r.rarityTier || '').trim().toUpperCase();
      const essenceCost = Math.max(1, Math.round(Number(r.essenceCost) || 30));
      const goldCost = Math.max(0, Math.round(Number(r.goldCost) || 0));
      const essenceReward = Math.max(1, Math.round(Number(r.essenceReward) || Math.floor(essenceCost / 2)));
      const goldReward = Math.max(0, Math.round(Number(r.goldReward) || 0));
      if (!tier) continue;

      const saved = await (prisma as any).hunterPetCostRule.upsert({
        where: { rarityTier: tier },
        update: { essenceCost, goldCost, essenceReward, goldReward },
        create: { rarityTier: tier, essenceCost, goldCost, essenceReward, goldReward },
      });
      updatedRows.push(saved);
    }

    try {
      const sm = new SnapshotManager(prisma);
      await sm.exportToDisk();
    } catch (snapErr) {
      console.warn('[HunterPetController] Erro ao sincronizar snapshot de custos de caçador:', snapErr);
    }

    return updatedRows;
  }

  /**
   * Roteador de endpoints HTTP de Caçador para a rota `/admin`.
   */
  public static async handleAdminHunterRoute(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    pathname: string,
    method: string,
    prisma: PrismaClient,
    sendJson: (res: http.ServerResponse, statusCode: number, data: unknown) => void,
    readJsonBody: <T = any>(req: http.IncomingMessage) => Promise<T>,
    enforcePermission?: (mode: 'READ' | 'READ_WRITE') => boolean
  ): Promise<boolean> {
    if (pathname === '/api/admin/hunter/costs') {
      if (method === 'GET') {
        if (enforcePermission && !enforcePermission('READ')) return true;
        try {
          const list = await this.getAdminCostRules(prisma);
          sendJson(res, 200, list);
        } catch (err: any) {
          sendJson(res, 500, { error: err.message || 'Erro ao carregar custos do Caçador.' });
        }
        return true;
      }
      if (method === 'PUT') {
        if (enforcePermission && !enforcePermission('READ_WRITE')) return true;
        try {
          const body = await readJsonBody<{ rules: Array<{ rarityTier: string; essenceCost: number; goldCost?: number; essenceReward?: number; goldReward?: number }> }>(req);
          const updated = await this.updateAdminCostRules(prisma, body.rules);
          sendJson(res, 200, { success: true, rules: updated });
        } catch (err: any) {
          sendJson(res, 400, { error: err.message || 'Erro ao salvar custos do Caçador.' });
        }
        return true;
      }
    }
    return false;
  }
}
