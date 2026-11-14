/**
 * @file apps/server/src/controllers/CharacterInventoryService.ts
 * @module @etheria/server
 * @description Serviço Orientado a Objetos para Carteira de Ouro (`PlayerCharacter.gold`) e Mochila
 *   Básica (`character_inventory_items`).
 * @rules
 *   - AVISO DE ESTADO INCOMPLETO (A3 / Regra #8): Esta é a fundação mínima criada para suportar
 *     coleta/entrega real de itens em Quests (`COLLECT_ITEM`) e recebimento de recompensas em Ouro/Itens.
 *     O sistema completo de economia, limites de slots, loja, troca, equipamentos equipáveis e
 *     tabela global de loot/drops dos monstros será expandido posteriormente sobre estas tabelas sem
 *     quebrar os registros existentes.
 * @dependencies PrismaClient (`player_characters`, `character_inventory_items`, `item_templates`), I18nCache.
 */

import { I18nCache } from '@etheria/database';

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

export class CharacterInventoryService {
  private static resolveIconUrl(mcreworkIconKey: string | null | undefined): string {
    const key = mcreworkIconKey || 'assets/items/icons/item_normal_060009.png';
    return `/api/assets/mcrework/${key.replace(/^\/+/, '')}`;
  }

  /**
   * Carrega o saldo de Ouro e os itens empilhados na mochila básica do personagem.
   */
  public static async getWalletAndBag(prisma: any, characterId: number) {
    const [pc, rows, i18nMap] = await Promise.all([
      prisma.playerCharacter.findUnique({
        where: { id: Number(characterId) },
        select: { id: true, gold: true },
      }),
      prisma.characterInventoryItem.findMany({
        where: { characterId: Number(characterId), quantity: { gt: 0 } },
        include: { itemTemplate: true },
        orderBy: { itemTemplateId: 'asc' },
      }),
      I18nCache.getTranslations(prisma, 'pt-BR'),
    ]);

    return {
      characterId: Number(characterId),
      gold: Number(pc?.gold ?? 0),
      isBaseIncomplete: true,
      incompleteNoticePtBr:
        'Base inicial de carteira e mochila (criada para quests de coleta/entrega e recompensas). Sistema completo de Economia, Lojas e Drops globais ainda será expandido.',
      items: rows.map((r: any) => ({
        id: r.id,
        itemTemplateId: r.itemTemplateId,
        code: r.itemTemplate?.code ?? `item_${r.itemTemplateId}`,
        namePtBr: i18nMap.get(r.itemTemplate?.nameI18nKey) ?? r.itemTemplate?.code ?? `Item #${r.itemTemplateId}`,
        descriptionPtBr: r.itemTemplate?.descriptionI18nKey
          ? (i18nMap.get(r.itemTemplate.descriptionI18nKey) ?? '')
          : '',
        mcreworkIconKey: r.itemTemplate?.mcreworkIconKey ?? null,
        iconUrl: this.resolveIconUrl(r.itemTemplate?.mcreworkIconKey),
        itemCategory: r.itemTemplate?.itemCategory ?? 'MATERIAL',
        equipmentSlotCode: r.itemTemplate?.equipmentSlotCode ?? null,
        combatStatBonuses: r.itemTemplate?.combatStatBonusesJson ?? {},
        rarityTier: r.itemTemplate?.rarityTier ?? 'COMMON',
        effectType: r.itemTemplate?.effectType ?? null,
        specialEffectJson: r.itemTemplate?.specialEffectJson ?? {},
        quantity: Number(r.quantity) || 0,
      })),
    };
  }

  /**
   * Retorna mapa rápido `itemTemplateId -> quantity` para validação de objetivos `COLLECT_ITEM`.
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
   * Adiciona quantidade de um `ItemTemplate` na mochila básica do personagem.
   */
  public static async addItem(
    prismaOrTx: any,
    characterId: number,
    itemTemplateId: number,
    quantity: number,
  ): Promise<number> {
    const safeItemId = Number(itemTemplateId) || 0;
    const safeQty = Math.max(0, Math.round(Number(quantity) || 0));
    if (safeItemId <= 0 || safeQty <= 0) return 0;

    const item = await prismaOrTx.itemTemplate.findUnique({
      where: { id: safeItemId },
      select: { id: true },
    });
    if (!item) {
      throw new Error(`Item #${safeItemId} não encontrado no catálogo para adicionar à mochila.`);
    }

    const row = await prismaOrTx.characterInventoryItem.upsert({
      where: {
        characterId_itemTemplateId: {
          characterId: Number(characterId),
          itemTemplateId: safeItemId,
        },
      },
      create: {
        characterId: Number(characterId),
        itemTemplateId: safeItemId,
        quantity: safeQty,
      },
      update: {
        quantity: { increment: safeQty },
      },
    });
    return Number(row?.quantity ?? safeQty);
  }

  /**
   * Valida e consome itens da mochila do personagem ao entregar ao NPC.
   */
  public static async consumeItem(
    prismaOrTx: any,
    characterId: number,
    itemTemplateId: number,
    quantity: number,
  ): Promise<number> {
    const safeItemId = Number(itemTemplateId) || 0;
    const safeQty = Math.max(0, Math.round(Number(quantity) || 0));
    if (safeItemId <= 0 || safeQty <= 0) return 0;

    const existing = await prismaOrTx.characterInventoryItem.findUnique({
      where: {
        characterId_itemTemplateId: {
          characterId: Number(characterId),
          itemTemplateId: safeItemId,
        },
      },
    });
    const currentQty = Number(existing?.quantity ?? 0);
    if (!existing || currentQty < safeQty) {
      throw new Error(
        `Itens insuficientes na mochila para entrega ao NPC (necessário ${safeQty}, você possui ${currentQty}).`,
      );
    }

    const remaining = currentQty - safeQty;
    if (remaining <= 0) {
      await prismaOrTx.characterInventoryItem.delete({
        where: {
          characterId_itemTemplateId: {
            characterId: Number(characterId),
            itemTemplateId: safeItemId,
          },
        },
      });
      return 0;
    }

    const updated = await prismaOrTx.characterInventoryItem.update({
      where: {
        characterId_itemTemplateId: {
          characterId: Number(characterId),
          itemTemplateId: safeItemId,
        },
      },
      data: { quantity: remaining },
    });
    return Number(updated.quantity);
  }

  /**
   * Hook provisório de drop em batalha ligado a Quests ativas de tipo `COLLECT_ITEM`,
   * enquanto a tabela global de Drops de Monstros / Economia não é implementada.
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
      await this.addItem(prismaOrTx, characterId, itemId, qty);
      summary.push({
        itemTemplateId: itemId,
        namePtBr: itemNamesMap.get(itemId) ?? `Item #${itemId}`,
        quantity: qty,
      });
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
      await this.addItem(prismaOrTx, characterId, itemId, qty);
      summary.push({
        itemTemplateId: itemId,
        namePtBr: itemNamesMap.get(itemId) ?? `Item #${itemId}`,
        quantity: qty,
      });
    }
    return summary;
  }
}
