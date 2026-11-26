/**
 * @file apps/server/src/controllers/CrystalShopService.ts
 * @module @etheria/server
 * @description Serviço Autoritário da Loja Cristal (`/play`):
 *   - Separa estritamente ofertas em Destaque (Carrossel) e Grid de Ícones com vigência opcional.
 *   - Enriquece cada oferta com metadados completos do ItemTemplate (raridade, nível, slot, conjunto, bônus de combate).
 *   - Executa compras autoritárias em Cristais da Conta com verificação prévia de mochila cheia antes do débito.
 * @rules Segue estritamente AGENTS.md (Regra #1 JSDoc completo, Regra #7 < 1.000 linhas, Zero Hardcode).
 * @dependencies @prisma/client, @etheria/database (I18nCache), ./CharacterInventoryService.js, ./CrystalCurrencyService.js, ./EventDateAndRewardHelper.js
 */

import type { PrismaClient } from '@prisma/client';
import { I18nCache } from '@etheria/database';
import { CharacterInventoryService } from './CharacterInventoryService.js';
import { CrystalCurrencyService } from './CrystalCurrencyService.js';
import { EventDateAndRewardHelper } from './EventDateAndRewardHelper.js';

export interface CrystalShopOfferDto {
  id: number;
  code: string;
  itemTemplateId: number;
  itemCode: string;
  titlePtBr: string;
  itemNamePtBr: string;
  descriptionPtBr: string;
  iconUrl: string;
  bannerImageUrl: string;
  quantity: number;
  priceCrystals: number;
  isFeatured: boolean;
  sortOrder: number;
  startsAt: string | null;
  endsAt: string | null;
  itemCategory: string;
  equipmentSlotCode: string | null;
  slotNamePtBr: string | null;
  equipmentSetNamePtBr: string | null;
  rarityTier: string;
  requiredLevel: number;
  combatStatBonuses: Record<string, number>;
  effectType: string | null;
  specialEffectJson: any;
  isNonStackable: boolean;
}

export class CrystalShopService {
  /**
   * Converte uma oferta do banco + ItemTemplate + traduções em DTO completo para Carrossel, Grid e Modal de Detalhes.
   */
  public static enrichOfferDto(offer: any, i18nMap: Map<string, string>): CrystalShopOfferDto {
    const it = offer.itemTemplate;
    const itemNamePtBr = i18nMap.get(it?.nameI18nKey) ?? it?.code ?? `Item #${offer.itemTemplateId}`;
    const itemDescPtBr = it?.descriptionI18nKey ? (i18nMap.get(it.descriptionI18nKey) ?? '') : '';
    const titlePtBr = String(offer.titlePtBr ?? '').trim() || itemNamePtBr;
    const descriptionPtBr = String(offer.descriptionPtBr ?? '').trim() || itemDescPtBr;

    const iconUrl =
      String(offer.iconImageUrl ?? '').trim() || CharacterInventoryService.resolveIconUrl(it?.mcreworkIconKey);
    const bannerImageUrl = String(offer.bannerImageUrl ?? '').trim();

    const slotNamePtBr = it?.equipmentSlot
      ? (i18nMap.get(it.equipmentSlot.nameI18nKey) ?? it.equipmentSlotCode ?? null)
      : (it?.equipmentSlotCode ?? null);
    const equipmentSetNamePtBr = it?.equipmentSet
      ? (i18nMap.get(it.equipmentSet.nameI18nKey) ?? it.equipmentSet.code ?? null)
      : null;

    return {
      id: offer.id,
      code: offer.code,
      itemTemplateId: offer.itemTemplateId,
      itemCode: it?.code ?? `item_${offer.itemTemplateId}`,
      titlePtBr,
      itemNamePtBr,
      descriptionPtBr,
      iconUrl,
      bannerImageUrl,
      quantity: Math.max(1, Number(offer.quantity) || 1),
      priceCrystals: Math.max(1, Number(offer.priceCrystals) || 1),
      isFeatured: Boolean(offer.isFeatured),
      sortOrder: Number(offer.sortOrder) || 0,
      startsAt: offer.startsAt ? new Date(offer.startsAt).toISOString() : null,
      endsAt: offer.endsAt ? new Date(offer.endsAt).toISOString() : null,
      itemCategory: it?.itemCategory ?? 'MATERIAL',
      equipmentSlotCode: it?.equipmentSlotCode ?? null,
      slotNamePtBr,
      equipmentSetNamePtBr,
      rarityTier: it?.rarityTier ?? 'COMMON',
      requiredLevel: Math.max(1, Number(it?.requiredLevel) || 1),
      combatStatBonuses: (it?.combatStatBonusesJson as Record<string, number>) ?? {},
      effectType: it?.effectType ?? null,
      specialEffectJson: it?.specialEffectJson ?? {},
      isNonStackable: CharacterInventoryService.isNonStackable(it),
    };
  }

  /**
   * Retorna o estado completo da Loja Cristal para o personagem, com o saldo real de Cristais da Conta.
   */
  public static async getPlayShopState(prisma: PrismaClient, characterId: number, now: Date = new Date()) {
    const safeCharId = Number(characterId);
    const [pc, rawOffers, i18nMap] = await Promise.all([
      prisma.playerCharacter.findUnique({
        where: { id: safeCharId },
        select: {
          id: true,
          userAccountId: true,
          userAccount: { select: { crystals: true } },
        },
      }),
      prisma.crystalShopOffer.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        include: {
          itemTemplate: {
            include: {
              equipmentSlot: true,
              equipmentSet: true,
            },
          },
        },
      }),
      I18nCache.getTranslations(prisma),
    ]);

    if (!pc) {
      throw new Error('Personagem não encontrado.');
    }

    const activeOffers = rawOffers
      .filter((o) => o.itemTemplate && EventDateAndRewardHelper.isEventWithinSchedule(o, now))
      .map((o) => this.enrichOfferDto(o, i18nMap));

    const featuredOffers = activeOffers.filter((o) => o.isFeatured);
    const gridOffers = activeOffers.filter((o) => !o.isFeatured);

    return {
      characterId: safeCharId,
      userAccountId: pc.userAccountId,
      crystals: Math.max(0, Number(pc.userAccount?.crystals ?? 0)),
      featuredOffers,
      gridOffers,
    };
  }

  /**
   * Realiza compra autoritativa de uma oferta da Loja Cristal:
   * - Verifica vigência;
   * - Verifica espaço disponível na mochila ANTES de debitar Cristais;
   * - Debita Cristais atomicamente da Conta e entrega o pacote de itens na mochila.
   */
  public static async purchaseOffer(
    prisma: PrismaClient,
    characterId: number,
    offerId: number,
    now: Date = new Date()
  ) {
    const safeCharId = Number(characterId);
    const safeOfferId = Number(offerId);

    const offer = await prisma.crystalShopOffer.findUnique({
      where: { id: safeOfferId },
      include: { itemTemplate: true },
    });
    if (!offer || !offer.itemTemplate) {
      throw new Error('Oferta da Loja Cristal não encontrada.');
    }
    if (!EventDateAndRewardHelper.isEventWithinSchedule(offer, now)) {
      throw new Error('Esta oferta não está disponível ou está fora do período de vigência.');
    }

    const qty = Math.max(1, Number(offer.quantity) || 1);
    const priceCrystals = Math.max(1, Number(offer.priceCrystals) || 1);

    const outcome = await prisma.$transaction(async (tx) => {
      const pc = await tx.playerCharacter.findUnique({
        where: { id: safeCharId },
        select: { id: true, userAccountId: true },
      });
      if (!pc) {
        throw new Error('Personagem não encontrado.');
      }

      // 1. Verifica capacidade da mochila antes de tocar nos Cristais da conta
      const cap = await EventDateAndRewardHelper.checkInventoryCapacityForItems(tx, safeCharId, [
        { itemTemplateId: offer.itemTemplateId, quantity: qty },
      ]);
      if (!cap.fits) {
        throw new Error(
          `Mochila cheia! Libere pelo menos ${cap.missingSlots} espaço(s) na sua mochila antes de comprar.`
        );
      }

      // 2. Debita Cristais atomicamente da Conta
      const debit = await CrystalCurrencyService.debitCrystalsAtomic(
        tx,
        pc.userAccountId,
        priceCrystals,
        'CRYSTAL_SHOP_PURCHASE',
        {
          characterId: safeCharId,
          referenceCode: offer.code,
          metadataJson: {
            offerId: offer.id,
            itemTemplateId: offer.itemTemplateId,
            quantity: qty,
          },
        }
      );

      // 3. Adiciona os itens na mochila do personagem selecionado
      const addRes = await CharacterInventoryService.addItem(tx, safeCharId, offer.itemTemplateId, qty);
      if (addRes.remaining > 0) {
        throw new Error('Mochila cheia! Não foi possível armazenar todos os itens comprados.');
      }

      const i18nMap = await I18nCache.getTranslations(tx as any);
      const itemName = String(offer.titlePtBr || '').trim() || (i18nMap.get(offer.itemTemplate.nameI18nKey) ?? offer.itemTemplate.code);

      return {
        offerId: offer.id,
        itemTemplateId: offer.itemTemplateId,
        itemName,
        quantity: qty,
        priceCrystals,
        crystals: debit.balanceAfter,
      };
    });

    const shopState = await this.getPlayShopState(prisma, safeCharId, now);
    return {
      ok: true,
      ...outcome,
      shopState,
    };
  }
}
