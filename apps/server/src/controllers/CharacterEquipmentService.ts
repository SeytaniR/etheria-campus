/**
 * @file apps/server/src/controllers/CharacterEquipmentService.ts
 * @module @etheria/server
 * @description Serviço Autoritário para Gerenciamento de Equipamentos do Jogador.
 *   - Gerencia equipar e desequipar itens nos 16 slots com transações atômicas no PostgreSQL.
 *   - Valida autoritariamente posse na mochila, slot compatível, classe e nível requerido.
 *   - Consolida e calcula bônus de atributos de combate derivados dos equipamentos ativos.
 *   - Previne qualquer tipo de duplicação, BOLA/IDOR ou trapaça de status vinda do cliente.
 * @rules Segue estritamente AGENTS.md (Limite < 1.000 linhas, SRP, Servidor Autoritário).
 */

import { PrismaClient } from '@prisma/client';
import { I18nCache } from '@etheria/database';
import { CharacterInventoryService } from './CharacterInventoryService.js';

export const VALID_CHARACTER_EQUIPMENT_SLOTS = [
  'HEAD',
  'SHOULDER',
  'CHEST',
  'BELT',
  'LEGS',
  'FEET',
  'ORNAMENT_1',
  'ORNAMENT_2',
  'RING',
  'NECKLACE',
  'WEAPON_1',
  'WEAPON_2',
  'FISHING_ROD',
  'FLYING_MOUNT',
  'WINGS',
  'FASHION',
] as const;

export type CharacterEquipmentSlotCode = typeof VALID_CHARACTER_EQUIPMENT_SLOTS[number];

export interface EquippedSlotDetailDto {
  slotCode: string;
  item: {
    id: number;
    code: string;
    namePtBr: string;
    descriptionPtBr: string;
    iconUrl: string;
    equipmentSlotCode: string;
    rarityTier: string;
    requiredLevel: number;
    combatStatBonuses: Record<string, number>;
  } | null;
}

export class CharacterEquipmentService {
  private static resolveIconUrl(mcreworkIconKey: string | null | undefined): string {
    const key = mcreworkIconKey || 'assets/equipment/icons/equip_normal_200001.png';
    return `/api/assets/mcrework/${key.replace(/^\/+/, '')}`;
  }

  /**
   * Retorna os detalhes de todos os slots de equipamentos do personagem, com os dados completos dos itens equipados.
   */
  public static async getCharacterEquippedDetails(
    prisma: PrismaClient,
    characterId: number
  ): Promise<{ slots: EquippedSlotDetailDto[]; consolidatedBonuses: Record<string, number> }> {
    const pc = await prisma.playerCharacter.findUnique({
      where: { id: Number(characterId) },
      select: { id: true, equippedItemsJson: true },
    });
    if (!pc) {
      throw new Error(`Personagem #${characterId} não encontrado.`);
    }

    const equippedMap = (pc.equippedItemsJson && typeof pc.equippedItemsJson === 'object'
      ? (pc.equippedItemsJson as Record<string, number>)
      : {}) as Record<string, number>;

    const itemIds = Array.from(
      new Set(
        Object.values(equippedMap)
          .map((id) => Number(id))
          .filter((id) => Number.isInteger(id) && id > 0)
      )
    );

    const [itemsList, i18nMap] = await Promise.all([
      itemIds.length > 0
        ? prisma.itemTemplate.findMany({
            where: { id: { in: itemIds } },
          })
        : [],
      I18nCache.getTranslations(prisma, 'pt-BR'),
    ]);

    const itemsById = new Map<number, any>(itemsList.map((it) => [it.id, it]));
    const consolidatedBonuses: Record<string, number> = {};

    const slots: EquippedSlotDetailDto[] = VALID_CHARACTER_EQUIPMENT_SLOTS.map((slotCode) => {
      const itemId = Number(equippedMap[slotCode]) || 0;
      const it = itemId > 0 ? itemsById.get(itemId) : null;

      if (it) {
        const bonuses = (it.combatStatBonusesJson && typeof it.combatStatBonusesJson === 'object'
          ? (it.combatStatBonusesJson as Record<string, number>)
          : {}) as Record<string, number>;

        for (const [stat, val] of Object.entries(bonuses)) {
          const numVal = Number(val) || 0;
          if (numVal !== 0) {
            consolidatedBonuses[stat] = (consolidatedBonuses[stat] || 0) + numVal;
          }
        }

        return {
          slotCode,
          item: {
            id: it.id,
            code: it.code,
            namePtBr: i18nMap.get(it.nameI18nKey) ?? it.code,
            descriptionPtBr: it.descriptionI18nKey ? (i18nMap.get(it.descriptionI18nKey) ?? '') : '',
            iconUrl: this.resolveIconUrl(it.mcreworkIconKey),
            equipmentSlotCode: it.equipmentSlotCode ?? slotCode,
            rarityTier: it.rarityTier ?? 'COMMON',
            requiredLevel: it.requiredLevel ?? 1,
            combatStatBonuses: bonuses,
          },
        };
      }

      return {
        slotCode,
        item: null,
      };
    });

    return {
      slots,
      consolidatedBonuses,
    };
  }

  /**
   * Equipa um item da mochila básica em um slot específico do personagem (Servidor Autoritário).
   * - Consome 1 unidade do item da mochila básica.
   * - Se o slot já possuía um item equipado, devolve o antigo para a mochila.
   * - Retorna a ficha atualizada e o inventário.
   */
  public static async equipItem(
    prisma: PrismaClient,
    userAccountId: number,
    role: string,
    characterId: number,
    itemTemplateId: number,
    targetSlotCode?: string
  ) {
    const pc = await prisma.playerCharacter.findUnique({
      where: { id: Number(characterId) },
      include: { classTemplate: true },
    });
    if (!pc) throw new Error('Personagem não encontrado.');
    if (pc.userAccountId !== userAccountId && !['ADMIN', 'GM'].includes(role)) {
      throw new Error('Acesso negado: este personagem não pertence à sua conta.');
    }

    const item = await prisma.itemTemplate.findUnique({
      where: { id: Number(itemTemplateId) },
    });
    if (!item) throw new Error(`Item #${itemTemplateId} não encontrado no catálogo.`);

    if (item.itemCategory !== 'CHARACTER_EQUIPMENT') {
      throw new Error(`O item "${item.code}" não é um equipamento de personagem equipável.`);
    }

    if (item.requiredLevel && pc.level < item.requiredLevel) {
      throw new Error(`Nível insuficiente para equipar este item (Requer Nv.${item.requiredLevel}).`);
    }

    // Validação de Classe (se houver restrição)
    const reqClasses = Array.isArray(item.reqClassCodesJson) ? item.reqClassCodesJson : [];
    if (reqClasses.length > 0 && pc.classTemplate?.code && !reqClasses.includes(pc.classTemplate.code)) {
      throw new Error(`Este equipamento não pode ser usado pela classe ${pc.classTemplate.code}.`);
    }

    // Resolução do Slot
    let finalSlot = targetSlotCode?.trim().toUpperCase();
    if (!finalSlot) {
      finalSlot = item.equipmentSlotCode?.trim().toUpperCase() || 'WEAPON_1';
    }

    // Regra de compatibilidade de slots flexíveis (ex: anéis e ornamentos)
    if (item.equipmentSlotCode === 'ORNAMENT_1' && finalSlot === 'ORNAMENT_2') {
      // permitido
    } else if (item.equipmentSlotCode === 'ORNAMENT_2' && finalSlot === 'ORNAMENT_1') {
      // permitido
    } else if (item.equipmentSlotCode && item.equipmentSlotCode !== finalSlot) {
      throw new Error(`Este item pertence ao slot "${item.equipmentSlotCode}", não pode ser equipado em "${finalSlot}".`);
    }

    if (!VALID_CHARACTER_EQUIPMENT_SLOTS.includes(finalSlot as any)) {
      throw new Error(`Slot de equipamento "${finalSlot}" inválido.`);
    }

    let updatedPc: any = null;

    await prisma.$transaction(async (tx) => {
      // 1. Valida se o item existe na mochila com quantidade >= 1
      const invRow = await tx.characterInventoryItem.findUnique({
        where: {
          characterId_itemTemplateId: {
            characterId: pc.id,
            itemTemplateId: item.id,
          },
        },
      });

      if (!invRow || invRow.quantity <= 0) {
        throw new Error(`Você não possui o item "${item.code}" na sua mochila para equipar.`);
      }

      // 2. Remove 1 unidade da mochila
      await CharacterInventoryService.consumeItem(tx, pc.id, item.id, 1);

      // 3. Lê o slot atual e se tiver item antigo, devolve para a mochila
      const equippedMap = (pc.equippedItemsJson && typeof pc.equippedItemsJson === 'object'
        ? { ...(pc.equippedItemsJson as Record<string, number>) }
        : {}) as Record<string, number>;

      const oldItemId = Number(equippedMap[finalSlot]) || 0;
      if (oldItemId > 0) {
        await CharacterInventoryService.addItem(tx, pc.id, oldItemId, 1);
      }

      // 4. Grava o novo item no slot
      equippedMap[finalSlot] = item.id;

      updatedPc = await tx.playerCharacter.update({
        where: { id: pc.id },
        data: {
          equippedItemsJson: equippedMap as any,
        },
      });
    });

    const [equippedDetails, bag] = await Promise.all([
      this.getCharacterEquippedDetails(prisma, pc.id),
      CharacterInventoryService.getWalletAndBag(prisma, pc.id),
    ]);

    return {
      success: true,
      equippedSlot: finalSlot,
      equippedItems: equippedDetails.slots,
      consolidatedBonuses: equippedDetails.consolidatedBonuses,
      bag,
    };
  }

  /**
   * Desequipa um item de um slot específico e devolve para a mochila básica (Servidor Autoritário).
   */
  public static async unequipItem(
    prisma: PrismaClient,
    userAccountId: number,
    role: string,
    characterId: number,
    slotCode: string
  ) {
    const pc = await prisma.playerCharacter.findUnique({
      where: { id: Number(characterId) },
    });
    if (!pc) throw new Error('Personagem não encontrado.');
    if (pc.userAccountId !== userAccountId && !['ADMIN', 'GM'].includes(role)) {
      throw new Error('Acesso negado: este personagem não pertence à sua conta.');
    }

    const finalSlot = String(slotCode || '').trim().toUpperCase();
    if (!VALID_CHARACTER_EQUIPMENT_SLOTS.includes(finalSlot as any)) {
      throw new Error(`Slot de equipamento "${finalSlot}" inválido.`);
    }

    const equippedMap = (pc.equippedItemsJson && typeof pc.equippedItemsJson === 'object'
      ? { ...(pc.equippedItemsJson as Record<string, number>) }
      : {}) as Record<string, number>;

    const itemId = Number(equippedMap[finalSlot]) || 0;
    if (itemId <= 0) {
      throw new Error(`O slot "${finalSlot}" já está vazio.`);
    }

    await prisma.$transaction(async (tx) => {
      // 1. Devolve para a mochila
      await CharacterInventoryService.addItem(tx, pc.id, itemId, 1);

      // 2. Remove do mapa de equipamentos
      delete equippedMap[finalSlot];

      await tx.playerCharacter.update({
        where: { id: pc.id },
        data: {
          equippedItemsJson: equippedMap as any,
        },
      });
    });

    const [equippedDetails, bag] = await Promise.all([
      this.getCharacterEquippedDetails(prisma, pc.id),
      CharacterInventoryService.getWalletAndBag(prisma, pc.id),
    ]);

    return {
      success: true,
      unequippedSlot: finalSlot,
      equippedItems: equippedDetails.slots,
      consolidatedBonuses: equippedDetails.consolidatedBonuses,
      bag,
    };
  }
}
