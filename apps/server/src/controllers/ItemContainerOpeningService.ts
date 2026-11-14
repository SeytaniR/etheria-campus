/**
 * @file apps/server/src/controllers/ItemContainerOpeningService.ts
 * @module @etheria/server
 * @description Serviço autoritário para abertura de Itens Baús/Cápsulas (`OPEN_CHEST`)
 *   e Giros de Roleta da Sorte (`ROULETTE`).
 *   - Garante consumo atômico de 1 unidade do item no inventário via transação Prisma.
 *   - Executa rolagem de probabilidade independente para baús/cápsulas (ex: 50% gema, 100% arma).
 *   - Executa rolagem de probabilidade cumulativa (fatias até 100%) para roletas com N giros.
 *   - Credita os itens ganhos e ouro bônus na mochila do personagem.
 *   - Retorna os metadados enriquecidos para o modal com animação de roleta e revelação de itens.
 */

import type { PrismaClient } from '@etheria/database';
import { I18nCache } from '@etheria/database';
import { CharacterInventoryService } from './CharacterInventoryService.js';

export interface ItemContainerEntryDto {
  itemTemplateId: number;
  chancePct: number; // 0.01 .. 100
  minQty: number; // >= 1
  maxQty: number; // >= minQty
}

export interface ItemContainerConfigDto {
  containerType?: 'CHEST' | 'CAPSULE' | 'ROULETTE';
  rollCount?: number; // Para roleta: quantidade de itens sorteados (padrão 1)
  bonusGoldMin?: number;
  bonusGoldMax?: number;
  entries: ItemContainerEntryDto[];
}

export interface RewardedItemSummary {
  itemTemplateId: number;
  code: string;
  namePtBr: string;
  descriptionPtBr: string;
  iconUrl: string;
  rarityTier: string;
  itemCategory: string;
  quantity: number;
}

export interface RouletteSliceSummary {
  itemTemplateId: number;
  namePtBr: string;
  iconUrl: string;
  rarityTier: string;
  chancePct: number;
  minQty: number;
  maxQty: number;
}

export class ItemContainerOpeningService {
  private static resolveIconUrl(mcreworkIconKey: string | null | undefined): string {
    const key = mcreworkIconKey || 'assets/items/icons/item_normal_060009.png';
    return `/api/assets/mcrework/${key.replace(/^\/+/, '')}`;
  }

  /**
   * Abre um Baú/Cápsula ou gira uma Roleta de forma segura e autoritária no servidor.
   */
  public static async openContainer(
    prisma: PrismaClient,
    characterId: number,
    itemTemplateId: number,
  ) {
    const safeCharId = Number(characterId);
    const safeItemId = Number(itemTemplateId);

    if (!Number.isInteger(safeCharId) || safeCharId <= 0) {
      throw new Error('ID de personagem inválido.');
    }
    if (!Number.isInteger(safeItemId) || safeItemId <= 0) {
      throw new Error('ID de item inválido.');
    }

    // 1. Busca o item na mochila do personagem
    const [character, inventoryRow] = await Promise.all([
      prisma.playerCharacter.findUnique({
        where: { id: safeCharId },
        select: { id: true, name: true, level: true },
      }),
      prisma.characterInventoryItem.findFirst({
        where: {
          characterId: safeCharId,
          itemTemplateId: safeItemId,
          quantity: { gt: 0 },
        },
        include: {
          itemTemplate: true,
        },
      }),
    ]);

    if (!character) {
      throw new Error('Personagem não encontrado.');
    }
    if (!inventoryRow || Number(inventoryRow.quantity) < 1) {
      throw new Error('Você não possui este item na mochila.');
    }

    const tpl = inventoryRow.itemTemplate;
    const isChest = tpl.effectType === 'OPEN_CHEST';
    const isRoulette = tpl.effectType === 'ROULETTE';

    if (!isChest && !isRoulette) {
      throw new Error('Este item não é um baú, cápsula ou roleta abrível.');
    }

    const rawSpecial = (tpl.specialEffectJson || {}) as Partial<ItemContainerConfigDto>;
    const containerType: 'CHEST' | 'CAPSULE' | 'ROULETTE' =
      rawSpecial.containerType || (isRoulette ? 'ROULETTE' : 'CHEST');
    const rawEntries: any[] = Array.isArray(rawSpecial.entries) ? rawSpecial.entries : [];

    // Filtra e normaliza as entradas válidas
    const entries: ItemContainerEntryDto[] = rawEntries
      .map((e) => ({
        itemTemplateId: Number(e.itemTemplateId) || 0,
        chancePct: Math.max(0.01, Math.min(100, Number(e.chancePct) || 0)),
        minQty: Math.max(1, Math.round(Number(e.minQty ?? e.quantity ?? 1) || 1)),
        maxQty: Math.max(
          Math.max(1, Math.round(Number(e.minQty ?? e.quantity ?? 1) || 1)),
          Math.round(Number(e.maxQty ?? e.quantity ?? 1) || 1),
        ),
      }))
      .filter((e) => e.itemTemplateId > 0 && e.chancePct > 0);

    if (entries.length === 0) {
      throw new Error('Este item não possui itens de recompensa configurados em sua tabela.');
    }

    // Valida previamente se o jogador possui espaço seguro na mochila no pior cenário
    const maxPossibleNewSlots = containerType === 'ROULETTE'
      ? Math.max(1, Number(rawSpecial.rollCount) || 1)
      : entries.length;

    const freeSlots = await CharacterInventoryService.countFreeSlots(prisma, safeCharId, 50);
    const effectiveFreeSlots = Number(inventoryRow.quantity) === 1 ? freeSlots + 1 : freeSlots;
    if (effectiveFreeSlots < maxPossibleNewSlots) {
      const containerName = containerType === 'CAPSULE' ? 'esta cápsula' : (containerType === 'ROULETTE' ? 'esta roleta' : 'este baú');
      throw new Error(`Mochila cheia! É necessário ter pelo menos ${maxPossibleNewSlots} slots livres para abrir ${containerName} com segurança (Disponíveis: ${effectiveFreeSlots}).`);
    }

    // 2. Busca todos os templates dos itens de recompensa para validar existência
    const rewardItemIds = Array.from(new Set(entries.map((e) => e.itemTemplateId)));
    const [rewardTemplates, i18nMap] = await Promise.all([
      prisma.itemTemplate.findMany({
        where: { id: { in: rewardItemIds } },
      }),
      I18nCache.getTranslations(prisma, 'pt-BR'),
    ]);

    const rewardTemplateMap = new Map<number, any>(rewardTemplates.map((t) => [t.id, t]));

    // 3. Executa sorteio autoritário e transação atômica
    let rolledRewards: Array<{ itemTemplateId: number; quantity: number }> = [];
    let winningIndex: number = -1;
    let winningItemTemplateId: number | null = null;
    let rolledGold: number = 0;

    const goldMin = Math.max(0, Math.round(Number(rawSpecial.bonusGoldMin) || 0));
    const goldMax = Math.max(goldMin, Math.round(Number(rawSpecial.bonusGoldMax) || goldMin));
    if (goldMax > 0) {
      rolledGold = goldMin + Math.floor(Math.random() * (goldMax - goldMin + 1));
    }

    if (containerType === 'ROULETTE') {
      // 🎲 ROLETA DA SORTE: Distribuição ponderada das fatias (soma até 100%)
      const rollCount = Math.max(1, Math.min(10, Math.round(Number(rawSpecial.rollCount) || 1)));
      const totalChance = entries.reduce((acc, e) => acc + e.chancePct, 0);

      for (let r = 0; r < rollCount; r++) {
        const rng = Math.random() * (totalChance > 0 ? totalChance : 100);
        let cumulative = 0;
        let picked = entries[0];
        let pickedIdx = 0;

        for (let i = 0; i < entries.length; i++) {
          cumulative += entries[i].chancePct;
          if (rng <= cumulative) {
            picked = entries[i];
            pickedIdx = i;
            break;
          }
        }

        const qty = picked.minQty + Math.floor(Math.random() * (picked.maxQty - picked.minQty + 1));
        if (qty > 0 && rewardTemplateMap.has(picked.itemTemplateId)) {
          rolledRewards.push({ itemTemplateId: picked.itemTemplateId, quantity: qty });
          if (winningIndex === -1) {
            winningIndex = pickedIdx;
            winningItemTemplateId = picked.itemTemplateId;
          }
        }
      }
    } else {
      // 📦 BAÚ / CÁPSULA: Cada entrada tem sua chance independente de 0.01% a 100%
      for (const entry of entries) {
        if (!rewardTemplateMap.has(entry.itemTemplateId)) continue;
        const roll = Math.random() * 100;
        if (entry.chancePct >= 100 || roll <= entry.chancePct) {
          const qty = entry.minQty + Math.floor(Math.random() * (entry.maxQty - entry.minQty + 1));
          if (qty > 0) {
            rolledRewards.push({ itemTemplateId: entry.itemTemplateId, quantity: qty });
          }
        }
      }
    }

    // Agrupa quantidades de itens repetidos sorteados
    const consolidatedMap = new Map<number, number>();
    for (const r of rolledRewards) {
      consolidatedMap.set(r.itemTemplateId, (consolidatedMap.get(r.itemTemplateId) || 0) + r.quantity);
    }

    // 4. Transação Prisma: Consome 1 baú e credita as recompensas
    let remainingContainerQty = 0;
    await prisma.$transaction(async (tx) => {
      remainingContainerQty = await CharacterInventoryService.consumeItem(tx, safeCharId, safeItemId, 1);

      if (rolledGold > 0) {
        await CharacterInventoryService.addGold(tx, safeCharId, rolledGold);
      }

      for (const [rItemId, rQty] of consolidatedMap.entries()) {
        await CharacterInventoryService.addItem(tx, safeCharId, rItemId, rQty);
      }
    });

    // 5. Monta retorno detalhado com nomes, ícones e raridades
    const rewardedItems: RewardedItemSummary[] = Array.from(consolidatedMap.entries()).map(
      ([rItemId, qty]) => {
        const itemTpl = rewardTemplateMap.get(rItemId);
        return {
          itemTemplateId: rItemId,
          code: itemTpl?.code ?? `item_${rItemId}`,
          namePtBr: i18nMap.get(itemTpl?.nameI18nKey) ?? itemTpl?.code ?? `Item #${rItemId}`,
          descriptionPtBr: itemTpl?.descriptionI18nKey ? (i18nMap.get(itemTpl.descriptionI18nKey) ?? '') : '',
          iconUrl: this.resolveIconUrl(itemTpl?.mcreworkIconKey),
          rarityTier: itemTpl?.rarityTier ?? 'COMMON',
          itemCategory: itemTpl?.itemCategory ?? 'MATERIAL',
          quantity: qty,
        };
      },
    );

    // Para a roleta, retorna todas as fatias ordenadas para a animação visual da roda/fita
    const rouletteSlices: RouletteSliceSummary[] =
      containerType === 'ROULETTE'
        ? entries.map((e) => {
            const itemTpl = rewardTemplateMap.get(e.itemTemplateId);
            return {
              itemTemplateId: e.itemTemplateId,
              namePtBr: i18nMap.get(itemTpl?.nameI18nKey) ?? itemTpl?.code ?? `Item #${e.itemTemplateId}`,
              iconUrl: this.resolveIconUrl(itemTpl?.mcreworkIconKey),
              rarityTier: itemTpl?.rarityTier ?? 'COMMON',
              chancePct: e.chancePct,
              minQty: e.minQty,
              maxQty: e.maxQty,
            };
          })
        : [];

    const containerNamePtBr = i18nMap.get(tpl.nameI18nKey) ?? tpl.code;
    const updatedBag = await CharacterInventoryService.getWalletAndBag(prisma, safeCharId);

    return {
      success: true,
      containerType,
      containerItem: {
        id: tpl.id,
        code: tpl.code,
        namePtBr: containerNamePtBr,
        iconUrl: this.resolveIconUrl(tpl.mcreworkIconKey),
        rarityTier: tpl.rarityTier,
      },
      rewards: rewardedItems,
      bonusGold: rolledGold,
      rouletteResult:
        containerType === 'ROULETTE'
          ? {
              winningIndex: Math.max(0, winningIndex),
              winningItemTemplateId: winningItemTemplateId || entries[0].itemTemplateId,
              slices: rouletteSlices,
            }
          : null,
      remainingContainerQuantity: remainingContainerQty,
      walletAndBag: updatedBag,
    };
  }
}
