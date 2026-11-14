/**
 * @file apps/server/src/controllers/CharacterInventoryService.ts
 * @module @etheria/server
 * @description Serviço Autoritário de Inventário em Grade, Carteira e Stacks (`character_inventory_items`).
 *   - Gerencia grade visual de 150 slots (50 desbloqueados Nv.1, 50 Nv.2 bloqueados, 50 Nv.3 bloqueados).
 *   - Limite de stack de 999 para acumuláveis e estritamente 1 para Armas, Equipamentos, Joias e Asas.
 *   - Drag & Drop (mover/trocar/juntar), divisão de stack (split), destruição com confirmação e auto-sort.
 *   - Validação prévia de capacidade máxima para abertura segura de baús e cápsulas.
 * @rules Segue estritamente AGENTS.md (Limite < 900 linhas, Arquitetura OO).
 */

import { I18nCache } from '@etheria/database';

export const INVENTORY_CONFIG = {
  TOTAL_SLOTS: 300,
  DEFAULT_UNLOCKED_SLOTS: 100,
  MAX_STACK_DEFAULT: 999,
  MAX_STACK_EQUIPMENT: 1,
  NON_STACKABLE_CATEGORIES: [
    'CHARACTER_EQUIPMENT',
    'EQUIPMENT',
    'WEAPON',
    'ARMOR',
    'JEWELRY',
    'WINGS',
  ],
};

export interface DefeatedMonsterDropUnit {
  monsterTemplateId: number;
  raceCode: string;
  variantTier?: 'NORMAL' | 'LEADER' | 'BOSS';
  count: number;
  lootRollsCount?: number;
}

export interface GrantedQuestDropSummary {
  itemTemplateId: number;
  namePtBr: string;
  quantity: number;
}

export interface InventoryItemDetailDto {
  id: number;
  slotIndex: number;
  itemTemplateId: number;
  code: string;
  namePtBr: string;
  descriptionPtBr: string;
  iconUrl: string;
  itemCategory: string;
  equipmentSlotCode: string | null;
  combatStatBonuses: Record<string, number>;
  rarityTier: string;
  effectType: string | null;
  specialEffectJson: any;
  quantity: number;
  maxStack: number;
  isNonStackable: boolean;
}

export interface InventorySlotDto {
  slotIndex: number;
  isLocked: boolean;
  lockedMessage: string | null;
  item: InventoryItemDetailDto | null;
}

export class CharacterInventoryService {
  public static resolveIconUrl(mcreworkIconKey: string | null | undefined): string {
    const key = mcreworkIconKey || 'assets/items/icons/item_normal_060009.png';
    return `/api/assets/mcrework/${key.replace(/^\/+/, '')}`;
  }

  /**
   * Determina se o item é não-acumulável (Armas, Equipamentos, Joias, Asas).
   */
  public static isNonStackable(itemTemplate: any): boolean {
    if (!itemTemplate) return false;
    if (itemTemplate.equipmentSlotCode) return true;
    const cat = String(itemTemplate.itemCategory || '').toUpperCase();
    return INVENTORY_CONFIG.NON_STACKABLE_CATEGORIES.includes(cat);
  }

  /**
   * Retorna a quantidade de slots desbloqueados para o personagem (Nv 1 = 50).
   */
  public static getUnlockedSlotsCount(_characterId: number): number {
    return INVENTORY_CONFIG.DEFAULT_UNLOCKED_SLOTS;
  }

  /**
   * Carrega o saldo de moedas e a grade completa de 150 slots do personagem.
   */
  public static async getWalletAndBag(prisma: any, characterId: number) {
    const safeCharId = Number(characterId);
    const unlockedCount = this.getUnlockedSlotsCount(safeCharId);

    const [pc, rows, i18nMap] = await Promise.all([
      prisma.playerCharacter.findUnique({
        where: { id: safeCharId },
        select: { id: true, gold: true },
      }),
      prisma.characterInventoryItem.findMany({
        where: { characterId: safeCharId, quantity: { gt: 0 } },
        include: { itemTemplate: true },
        orderBy: { slotIndex: 'asc' },
      }),
      I18nCache.getTranslations(prisma, 'pt-BR'),
    ]);

    const itemMap = new Map<number, InventoryItemDetailDto>();
    for (const r of rows) {
      const it = r.itemTemplate;
      const nonStack = this.isNonStackable(it);
      itemMap.set(r.slotIndex, {
        id: r.id,
        slotIndex: r.slotIndex,
        itemTemplateId: r.itemTemplateId,
        code: it?.code ?? `item_${r.itemTemplateId}`,
        namePtBr: i18nMap.get(it?.nameI18nKey) ?? it?.code ?? `Item #${r.itemTemplateId}`,
        descriptionPtBr: it?.descriptionI18nKey ? (i18nMap.get(it.descriptionI18nKey) ?? '') : '',
        iconUrl: this.resolveIconUrl(it?.mcreworkIconKey),
        itemCategory: it?.itemCategory ?? 'MATERIAL',
        equipmentSlotCode: it?.equipmentSlotCode ?? null,
        combatStatBonuses: it?.combatStatBonusesJson ?? {},
        rarityTier: it?.rarityTier ?? 'COMMON',
        effectType: it?.effectType ?? null,
        specialEffectJson: it?.specialEffectJson ?? {},
        quantity: Number(r.quantity) || 0,
        maxStack: nonStack ? INVENTORY_CONFIG.MAX_STACK_EQUIPMENT : INVENTORY_CONFIG.MAX_STACK_DEFAULT,
        isNonStackable: nonStack,
      });
    }

    const slots: InventorySlotDto[] = [];
    for (let i = 0; i < INVENTORY_CONFIG.TOTAL_SLOTS; i++) {
      const isLocked = i >= unlockedCount;
      const lockedMessage = i >= 200 ? 'Libera na mochila nível 3' : (i >= 100 ? 'Libera na mochila nível 2' : null);
      slots.push({
        slotIndex: i,
        isLocked,
        lockedMessage,
        item: itemMap.get(i) || null,
      });
    }

    return {
      characterId: safeCharId,
      gold: Number(pc?.gold ?? 0),
      diamonds: 1500,
      bagLevel: 1,
      unlockedSlotsCount: unlockedCount,
      totalSlotsCount: INVENTORY_CONFIG.TOTAL_SLOTS,
      occupiedSlotsCount: rows.length,
      freeSlotsCount: Math.max(0, unlockedCount - rows.length),
      slots,
      items: Array.from(itemMap.values()),
    };
  }

  /**
   * Retorna a quantidade de slots livres disponíveis na área desbloqueada do inventário.
   */
  public static async countFreeSlots(prismaOrTx: any, characterId: number, maxUnlocked: number = INVENTORY_CONFIG.DEFAULT_UNLOCKED_SLOTS): Promise<number> {
    const occupied = await prismaOrTx.characterInventoryItem.count({
      where: {
        characterId: Number(characterId),
        slotIndex: { lt: maxUnlocked },
        quantity: { gt: 0 },
      },
    });
    return Math.max(0, maxUnlocked - occupied);
  }

  /**
   * Encontra o menor índice de slot livre na área desbloqueada.
   */
  public static async findLowestEmptySlot(prismaOrTx: any, characterId: number, maxUnlocked: number = INVENTORY_CONFIG.DEFAULT_UNLOCKED_SLOTS): Promise<number | null> {
    const occupiedRows = await prismaOrTx.characterInventoryItem.findMany({
      where: {
        characterId: Number(characterId),
        slotIndex: { lt: maxUnlocked },
        quantity: { gt: 0 },
      },
      select: { slotIndex: true },
    });
    const occupiedSet = new Set(occupiedRows.map((r: any) => Number(r.slotIndex)));
    for (let i = 0; i < maxUnlocked; i++) {
      if (!occupiedSet.has(i)) return i;
    }
    return null;
  }

  /**
   * Retorna mapa rápido `itemTemplateId -> totalQuantity` para validação de objetivos `COLLECT_ITEM`.
   */
  public static async getBagQuantityMap(prismaOrTx: any, characterId: number): Promise<Map<number, number>> {
    const rows = await prismaOrTx.characterInventoryItem.findMany({
      where: { characterId: Number(characterId), quantity: { gt: 0 } },
      select: { itemTemplateId: true, quantity: true },
    });
    const map = new Map<number, number>();
    for (const r of rows) {
      map.set(Number(r.itemTemplateId), (map.get(Number(r.itemTemplateId)) || 0) + Math.max(0, Number(r.quantity) || 0));
    }
    return map;
  }

  /**
   * Credita Ouro na carteira do personagem (`PlayerCharacter.gold`).
   */
  public static async addGold(prismaOrTx: any, characterId: number, amount: number): Promise<number> {
    const safeAmount = Math.max(0, Math.round(Number(amount) || 0));
    if (safeAmount <= 0) {
      const current = await prismaOrTx.playerCharacter.findUnique({
        where: { id: Number(characterId) },
        select: { gold: true },
      });
      return Number(current?.gold ?? 0);
    }
    const updated = await prismaOrTx.playerCharacter.update({
      where: { id: Number(characterId) },
      data: {
        gold: { increment: BigInt(safeAmount) },
      },
      select: { gold: true },
    });
    return Number(updated?.gold ?? 0);
  }

  /**
   * Adiciona itens na mochila respeitando limites de stack (999 para acumuláveis, 1 para equipamentos).
   * Aloca em pilhas existentes primeiro e depois nos menores slots livres desbloqueados.
   */
  public static async addItem(
    prismaOrTx: any,
    characterId: number,
    itemTemplateId: number,
    quantity: number,
    preferSlotIndex?: number
  ): Promise<{ added: number; remaining: number }> {
    const safeCharId = Number(characterId);
    const safeItemId = Number(itemTemplateId) || 0;
    let remaining = Math.max(0, Math.round(Number(quantity) || 0));
    if (safeItemId <= 0 || remaining <= 0) return { added: 0, remaining: 0 };

    const item = await prismaOrTx.itemTemplate.findUnique({
      where: { id: safeItemId },
    });
    if (!item) {
      throw new Error(`Item #${safeItemId} não encontrado no catálogo para adicionar à mochila.`);
    }

    const nonStack = this.isNonStackable(item);
    const maxStack = nonStack ? INVENTORY_CONFIG.MAX_STACK_EQUIPMENT : INVENTORY_CONFIG.MAX_STACK_DEFAULT;
    const unlockedCount = this.getUnlockedSlotsCount(safeCharId);
    let totalAdded = 0;

    // 1. Se for acumulável, primeiro preenche slots existentes com espaço
    if (!nonStack) {
      const existingRows = await prismaOrTx.characterInventoryItem.findMany({
        where: {
          characterId: safeCharId,
          itemTemplateId: safeItemId,
          slotIndex: { lt: unlockedCount },
          quantity: { lt: maxStack },
        },
        orderBy: { slotIndex: 'asc' },
      });

      for (const row of existingRows) {
        if (remaining <= 0) break;
        const currentQty = Number(row.quantity) || 0;
        const space = maxStack - currentQty;
        const toAdd = Math.min(remaining, space);
        if (toAdd > 0) {
          await prismaOrTx.characterInventoryItem.update({
            where: { id: row.id },
            data: { quantity: currentQty + toAdd },
          });
          remaining -= toAdd;
          totalAdded += toAdd;
        }
      }
    }

    // 2. Se ainda restam unidades, aloca em novos slots vazios
    while (remaining > 0) {
      let targetSlot: number | null = null;
      if (preferSlotIndex !== undefined && preferSlotIndex >= 0 && preferSlotIndex < unlockedCount) {
        const occ = await prismaOrTx.characterInventoryItem.findFirst({
          where: { characterId: safeCharId, slotIndex: preferSlotIndex },
        });
        if (!occ) targetSlot = preferSlotIndex;
        preferSlotIndex = undefined;
      }
      if (targetSlot === null) {
        targetSlot = await this.findLowestEmptySlot(prismaOrTx, safeCharId, unlockedCount);
      }
      if (targetSlot === null) {
        // Mochila cheia nos slots desbloqueados
        break;
      }

      const toAdd = Math.min(remaining, maxStack);
      await prismaOrTx.characterInventoryItem.create({
        data: {
          characterId: safeCharId,
          itemTemplateId: safeItemId,
          slotIndex: targetSlot,
          quantity: toAdd,
        },
      });
      remaining -= toAdd;
      totalAdded += toAdd;
    }

    return { added: totalAdded, remaining };
  }

  /**
   * Valida e consome itens da mochila a partir de seus slots (usado em Quests, receitas e lojas).
   */
  public static async consumeItem(
    prismaOrTx: any,
    characterId: number,
    itemTemplateId: number,
    quantity: number
  ): Promise<number> {
    const safeCharId = Number(characterId);
    const safeItemId = Number(itemTemplateId) || 0;
    let needed = Math.max(0, Math.round(Number(quantity) || 0));
    if (safeItemId <= 0 || needed <= 0) return 0;

    const rows = await prismaOrTx.characterInventoryItem.findMany({
      where: {
        characterId: safeCharId,
        itemTemplateId: safeItemId,
        quantity: { gt: 0 },
      },
      orderBy: { slotIndex: 'asc' },
    });

    const totalAvailable = rows.reduce((acc: number, r: any) => acc + (Number(r.quantity) || 0), 0);
    if (totalAvailable < needed) {
      throw new Error(`Itens insuficientes na mochila (necessário ${needed}, disponível ${totalAvailable}).`);
    }

    for (const r of rows) {
      if (needed <= 0) break;
      const curQty = Number(r.quantity) || 0;
      if (curQty <= needed) {
        await prismaOrTx.characterInventoryItem.delete({ where: { id: r.id } });
        needed -= curQty;
      } else {
        await prismaOrTx.characterInventoryItem.update({
          where: { id: r.id },
          data: { quantity: curQty - needed },
        });
        needed = 0;
      }
    }

    return totalAvailable - Math.round(Number(quantity) || 0);
  }

  /**
   * Move ou troca de posição itens entre dois slots do inventário (Drag & Drop autoritário).
   * Suporta:
   * - Mover para slot vazio
   * - Juntar stacks do mesmo item acumulável (até 999)
   * - Trocar itens de slots (swap)
   */
  public static async moveOrSwapSlot(
    prisma: any,
    characterId: number,
    fromSlot: number,
    toSlot: number
  ) {
    const safeCharId = Number(characterId);
    const unlockedCount = this.getUnlockedSlotsCount(safeCharId);

    if (fromSlot < 0 || fromSlot >= unlockedCount || toSlot < 0 || toSlot >= unlockedCount) {
      throw new Error('Slot fora do limite desbloqueado da mochila.');
    }
    if (fromSlot === toSlot) {
      return this.getWalletAndBag(prisma, safeCharId);
    }

    return prisma.$transaction(async (tx: any) => {
      const fromRow = await tx.characterInventoryItem.findUnique({
        where: { characterId_slotIndex: { characterId: safeCharId, slotIndex: fromSlot } },
        include: { itemTemplate: true },
      });
      if (!fromRow || fromRow.quantity <= 0) {
        throw new Error(`Slot #${fromSlot} está vazio.`);
      }

      const toRow = await tx.characterInventoryItem.findUnique({
        where: { characterId_slotIndex: { characterId: safeCharId, slotIndex: toSlot } },
        include: { itemTemplate: true },
      });

      // Caso 1: Destino Vazio -> Mover
      if (!toRow) {
        await tx.characterInventoryItem.update({
          where: { id: fromRow.id },
          data: { slotIndex: toSlot },
        });
        return;
      }

      // Caso 2: Mesmo item acumulável -> Juntar Stacks
      const isFromNonStack = this.isNonStackable(fromRow.itemTemplate);
      const isToNonStack = this.isNonStackable(toRow.itemTemplate);

      if (fromRow.itemTemplateId === toRow.itemTemplateId && !isFromNonStack && !isToNonStack) {
        const spaceInTo = INVENTORY_CONFIG.MAX_STACK_DEFAULT - Number(toRow.quantity);
        if (spaceInTo > 0) {
          const transfer = Math.min(Number(fromRow.quantity), spaceInTo);
          const newToQty = Number(toRow.quantity) + transfer;
          const newFromQty = Number(fromRow.quantity) - transfer;

          await tx.characterInventoryItem.update({
            where: { id: toRow.id },
            data: { quantity: newToQty },
          });

          if (newFromQty <= 0) {
            await tx.characterInventoryItem.delete({ where: { id: fromRow.id } });
          } else {
            await tx.characterInventoryItem.update({
              where: { id: fromRow.id },
              data: { quantity: newFromQty },
            });
          }
          return;
        }
      }

      // Caso 3: Itens diferentes ou pilhas cheias -> Swap (Troca de posições)
      // Usa slotIndex negativo temporário para contornar unique constraint
      const tempSlot = -(fromRow.id + 1000);
      await tx.characterInventoryItem.update({
        where: { id: fromRow.id },
        data: { slotIndex: tempSlot },
      });
      await tx.characterInventoryItem.update({
        where: { id: toRow.id },
        data: { slotIndex: fromSlot },
      });
      await tx.characterInventoryItem.update({
        where: { id: fromRow.id },
        data: { slotIndex: toSlot },
      });
    }).then(() => this.getWalletAndBag(prisma, safeCharId));
  }

  /**
   * Divide uma pilha de itens acumuláveis (Split Stack) e aloca a quantidade separada em um slot livre.
   */
  public static async splitStack(
    prisma: any,
    characterId: number,
    fromSlot: number,
    splitQuantity: number,
    targetSlot?: number
  ) {
    const safeCharId = Number(characterId);
    const splitQty = Math.max(1, Math.round(Number(splitQuantity) || 1));
    const unlockedCount = this.getUnlockedSlotsCount(safeCharId);

    if (fromSlot < 0 || fromSlot >= unlockedCount) {
      throw new Error('Slot de origem inválido.');
    }

    return prisma.$transaction(async (tx: any) => {
      const fromRow = await tx.characterInventoryItem.findUnique({
        where: { characterId_slotIndex: { characterId: safeCharId, slotIndex: fromSlot } },
        include: { itemTemplate: true },
      });
      if (!fromRow || fromRow.quantity <= 1) {
        throw new Error('Este item não possui quantidade suficiente para ser dividido.');
      }
      if (this.isNonStackable(fromRow.itemTemplate)) {
        throw new Error('Itens de equipamento não podem ser divididos.');
      }
      if (splitQty >= fromRow.quantity) {
        throw new Error(`A quantidade a separar deve ser menor que a quantidade total (${fromRow.quantity}).`);
      }

      let destSlot: number | null = targetSlot !== undefined ? Number(targetSlot) : null;
      if (destSlot !== null) {
        if (destSlot < 0 || destSlot >= unlockedCount) {
          throw new Error('Slot de destino bloqueado ou inválido.');
        }
        const occ = await tx.characterInventoryItem.findUnique({
          where: { characterId_slotIndex: { characterId: safeCharId, slotIndex: destSlot } },
        });
        if (occ) throw new Error(`O slot #${destSlot} já está ocupado.`);
      } else {
        destSlot = await this.findLowestEmptySlot(tx, safeCharId, unlockedCount);
        if (destSlot === null) throw new Error('Mochila cheia! Não há slots livres para dividir o item.');
      }

      await tx.characterInventoryItem.update({
        where: { id: fromRow.id },
        data: { quantity: fromRow.quantity - splitQty },
      });

      await tx.characterInventoryItem.create({
        data: {
          characterId: safeCharId,
          itemTemplateId: fromRow.itemTemplateId,
          slotIndex: destSlot,
          quantity: splitQty,
        },
      });
    }).then(() => this.getWalletAndBag(prisma, safeCharId));
  }

  /**
   * Destrói/Exclui o item posicionado em um slot específico após confirmação do jogador.
   */
  public static async deleteSlotItem(prisma: any, characterId: number, slotIndex: number) {
    const safeCharId = Number(characterId);
    const safeSlot = Number(slotIndex);

    const existing = await prisma.characterInventoryItem.findUnique({
      where: { characterId_slotIndex: { characterId: safeCharId, slotIndex: safeSlot } },
    });
    if (!existing) {
      throw new Error(`Nenhum item encontrado no slot #${safeSlot}.`);
    }

    await prisma.characterInventoryItem.delete({
      where: { id: existing.id },
    });

    return this.getWalletAndBag(prisma, safeCharId);
  }

  /**
   * Organização Automática Inteligente da Mochila (Auto-Sort):
   * 1. Junta pilhas do mesmo item até 999.
   * 2. Ordena por Categoria > Raridade (descendente) > Nome alfabético.
   * 3. Reposiciona sequencialmente nos slots 0, 1, 2...
   */
  public static async autoSort(prisma: any, characterId: number) {
    const safeCharId = Number(characterId);
    const [rows, i18nMap] = await Promise.all([
      prisma.characterInventoryItem.findMany({
        where: { characterId: safeCharId, quantity: { gt: 0 } },
        include: { itemTemplate: true },
      }),
      I18nCache.getTranslations(prisma, 'pt-BR'),
    ]);

    if (rows.length === 0) {
      return this.getWalletAndBag(prisma, safeCharId);
    }

    // 1. Agrupa e funde itens acumuláveis
    const stackableGroups = new Map<number, { itemTemplate: any; totalQty: number }>();
    const nonStackableItems: any[] = [];

    for (const r of rows) {
      const it = r.itemTemplate;
      if (this.isNonStackable(it)) {
        nonStackableItems.push(r);
      } else {
        const cur = stackableGroups.get(r.itemTemplateId) || { itemTemplate: it, totalQty: 0 };
        cur.totalQty += Number(r.quantity) || 0;
        stackableGroups.set(r.itemTemplateId, cur);
      }
    }

    const flattenedUnits: Array<{ itemTemplateId: number; quantity: number; itemTemplate: any }> = [];

    // Desmembra grupos acumulados em blocos de até 999
    for (const [tplId, g] of stackableGroups.entries()) {
      let q = g.totalQty;
      while (q > 0) {
        const chunk = Math.min(q, INVENTORY_CONFIG.MAX_STACK_DEFAULT);
        flattenedUnits.push({ itemTemplateId: tplId, quantity: chunk, itemTemplate: g.itemTemplate });
        q -= chunk;
      }
    }

    // Adiciona equipamentos unitários
    for (const eq of nonStackableItems) {
      flattenedUnits.push({ itemTemplateId: eq.itemTemplateId, quantity: 1, itemTemplate: eq.itemTemplate });
    }

    // Pesos de ordenação
    const catWeight: Record<string, number> = {
      CHARACTER_EQUIPMENT: 1,
      EQUIPMENT: 1,
      WEAPON: 1,
      ARMOR: 1,
      JEWELRY: 1,
      WINGS: 1,
      CONSUMABLE: 2,
      MATERIAL: 3,
      SPECIAL: 4,
    };
    const rarityWeight: Record<string, number> = {
      SS: 7,
      COSMIC: 7,
      S: 6,
      MYTHIC: 6,
      A: 5,
      LEGENDARY: 5,
      B: 4,
      EPIC: 4,
      C: 3,
      RARE: 3,
      D: 2,
      UNCOMMON: 2,
      F: 1,
      COMMON: 1,
    };

    flattenedUnits.sort((a, b) => {
      const catA = catWeight[String(a.itemTemplate?.itemCategory || '').toUpperCase()] || 9;
      const catB = catWeight[String(b.itemTemplate?.itemCategory || '').toUpperCase()] || 9;
      if (catA !== catB) return catA - catB;

      const rarA = rarityWeight[String(a.itemTemplate?.rarityTier || '').toUpperCase()] || 0;
      const rarB = rarityWeight[String(b.itemTemplate?.rarityTier || '').toUpperCase()] || 0;
      if (rarA !== rarB) return rarB - rarA; // Maior raridade primeiro

      const nameA = i18nMap.get(a.itemTemplate?.nameI18nKey) ?? a.itemTemplate?.code ?? '';
      const nameB = i18nMap.get(b.itemTemplate?.nameI18nKey) ?? b.itemTemplate?.code ?? '';
      return nameA.localeCompare(nameB);
    });

    // Persiste a reordenação em transação atômica
    return prisma.$transaction(async (tx: any) => {
      await tx.characterInventoryItem.deleteMany({ where: { characterId: safeCharId } });
      await tx.characterInventoryItem.createMany({
        data: flattenedUnits.map((u, idx) => ({
          characterId: safeCharId,
          itemTemplateId: u.itemTemplateId,
          slotIndex: idx,
          quantity: u.quantity,
        })),
      });
    }).then(() => this.getWalletAndBag(prisma, safeCharId));
  }

  /**
   * Hook de drops de Quest ligado a `COLLECT_ITEM`.
   */
  public static async grantProvisionalQuestDrops(
    prismaOrTx: any,
    characterId: number,
    inProgressQuests: any[],
    defeatedMonsters: DefeatedMonsterDropUnit[],
    itemNamesMap: Map<number, string>,
  ): Promise<GrantedQuestDropSummary[]> {
    const grantedTotals = new Map<number, number>();

    for (const q of inProgressQuests) {
      const meta = q.questCategory === 'META' ? q.metaConfigJson : null;
      const candidateConfigs: Array<{
        itemTemplateId: number;
        dropSourceMode: string;
        dropMonsterTemplateId: number | null;
        dropRaceCode: string | null;
        dropChancePct: number;
        stillNeeded: boolean;
      }> = [];

      if (meta && meta.targetType === 'COLLECT_ITEM' && meta.itemTemplateId) {
        const obj = q.objectives?.[0];
        const stillNeeded = obj ? Number(obj.currentCount || 0) < Number(obj.requiredCount || 1) : true;
        candidateConfigs.push({
          itemTemplateId: Number(meta.itemTemplateId),
          dropSourceMode: String(meta.dropSourceMode || 'ANY_MONSTER'),
          dropMonsterTemplateId: meta.dropMonsterTemplateId ? Number(meta.dropMonsterTemplateId) : null,
          dropRaceCode: meta.dropRaceCode ? String(meta.dropRaceCode).toUpperCase() : null,
          dropChancePct: Math.max(1, Math.min(100, Number(meta.dropChancePct ?? 100) || 100)),
          stillNeeded,
        });
      } else {
        for (const obj of q.objectives || []) {
          if (obj.type === 'COLLECT_ITEM' && obj.itemTemplateId) {
            const stillNeeded = Number(obj.currentCount || 0) < Number(obj.requiredCount || 1);
            candidateConfigs.push({
              itemTemplateId: Number(obj.itemTemplateId),
              dropSourceMode: String(obj.dropSourceMode || 'ANY_MONSTER'),
              dropMonsterTemplateId: obj.dropMonsterTemplateId ? Number(obj.dropMonsterTemplateId) : null,
              dropRaceCode: obj.dropRaceCode ? String(obj.dropRaceCode).toUpperCase() : null,
              dropChancePct: Math.max(1, Math.min(100, Number(obj.dropChancePct ?? 100) || 100)),
              stillNeeded,
            });
          }
        }
      }

      for (const cfg of candidateConfigs) {
        if (!cfg.stillNeeded) continue;
        let matchingKills = 0;
        for (const unit of defeatedMonsters) {
          const matches =
            cfg.dropSourceMode === 'ANY_MONSTER' ||
            (cfg.dropSourceMode === 'SPECIFIC_MONSTER' &&
              cfg.dropMonsterTemplateId &&
              Number(unit.monsterTemplateId) === cfg.dropMonsterTemplateId) ||
            (cfg.dropSourceMode === 'RACE' &&
              cfg.dropRaceCode &&
              String(unit.raceCode || '').toUpperCase() === cfg.dropRaceCode);
          if (matches) {
            matchingKills += Math.max(1, Number(unit.count) || 1);
          }
        }
        if (matchingKills <= 0) continue;

        let dropped = 0;
        for (let k = 0; k < matchingKills; k++) {
          if (cfg.dropChancePct >= 100 || Math.random() * 100 <= cfg.dropChancePct) {
            dropped += 1;
          }
        }
        if (dropped > 0) {
          grantedTotals.set(cfg.itemTemplateId, (grantedTotals.get(cfg.itemTemplateId) || 0) + dropped);
        }
      }
    }

    const summary: GrantedQuestDropSummary[] = [];
    for (const [itemId, qty] of grantedTotals.entries()) {
      const res = await this.addItem(prismaOrTx, characterId, itemId, qty);
      if (res.added > 0) {
        summary.push({
          itemTemplateId: itemId,
          namePtBr: itemNamesMap.get(itemId) ?? `Item #${itemId}`,
          quantity: res.added,
        });
      }
    }
    return summary;
  }

  /**
   * Rola e credita na mochila os drops configurados diretamente na tabela do monstro (`monster_templates.loot_table_json`).
   */
  public static async rollMonsterLootDrops(
    prismaOrTx: any,
    characterId: number,
    defeatedMonsters: DefeatedMonsterDropUnit[],
    itemNamesMap: Map<number, string>,
  ): Promise<GrantedQuestDropSummary[]> {
    const mobIds = Array.from(
      new Set(defeatedMonsters.map((u) => Number(u.monsterTemplateId)).filter((id) => Number.isInteger(id) && id > 0)),
    );
    if (mobIds.length === 0) return [];

    const dbMobs = await prismaOrTx.monsterTemplate.findMany({
      where: { id: { in: mobIds } },
      select: { id: true, lootTableJson: true },
    });
    const lootByMobId = new Map<number, any[]>(
      dbMobs.map((m: any) => [Number(m.id), Array.isArray(m.lootTableJson) ? m.lootTableJson : []]),
    );

    const grantedTotals = new Map<number, number>();
    for (const unit of defeatedMonsters) {
      const entries = lootByMobId.get(Number(unit.monsterTemplateId)) || [];
      if (entries.length === 0) continue;
      const kills = Math.max(1, Math.round(Number(unit.lootRollsCount ?? unit.count) || 1));

      for (let k = 0; k < kills; k++) {
        for (const entry of entries) {
          const itemId = Number(entry?.itemTemplateId) || 0;
          if (itemId <= 0 || !itemNamesMap.has(itemId)) continue;
          const chance = Math.max(0.01, Math.min(100, Number(entry?.chancePct) || 0));
          if (chance < 100 && Math.random() * 100 > chance) continue;

          const minQ = Math.max(1, Math.round(Number(entry?.minQty ?? entry?.quantity ?? 1) || 1));
          const maxQ = Math.max(minQ, Math.round(Number(entry?.maxQty ?? entry?.quantity ?? minQ) || minQ));
          const qty = minQ + Math.floor(Math.random() * (maxQ - minQ + 1));
          if (qty > 0) {
            grantedTotals.set(itemId, (grantedTotals.get(itemId) || 0) + qty);
          }
        }
      }
    }

    const summary: GrantedQuestDropSummary[] = [];
    for (const [itemId, qty] of grantedTotals.entries()) {
      const res = await this.addItem(prismaOrTx, characterId, itemId, qty);
      if (res.added > 0) {
        summary.push({
          itemTemplateId: itemId,
          namePtBr: itemNamesMap.get(itemId) ?? `Item #${itemId}`,
          quantity: res.added,
        });
      }
    }
    return summary;
  }
}
