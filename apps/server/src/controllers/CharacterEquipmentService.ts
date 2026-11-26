/**
 * @file apps/server/src/controllers/CharacterEquipmentService.ts
 * @module @etheria/server
 * @description Serviço Autoritário para Gerenciamento de Equipamentos do Jogador.
 *   - Gerencia equipar e desequipar itens nos 16 slots com transações atômicas no PostgreSQL.
 *   - Valida autoritariamente posse na mochila, slot compatível, classe e nível requerido.
 *   - Consolida e calcula bônus de atributos de combate derivados dos equipamentos ativos.
 *   - Previne qualquer tipo de duplicação, BOLA/IDOR ou trapaça de status vinda do cliente.
 * @rules Segue estritamente AGENTS.md (Limite < 1.000 linhas, SRP, Servidor Autoritário).
 * @dependencies @prisma/client, @etheria/database (I18nCache), @etheria/shared (GameRulesConstants), ./CharacterInventoryService.js, ./MapPresenceService.js, ./MapRuntimeCacheService.js, ./AssetMirrorService.js
 */

import { PrismaClient } from '@prisma/client';
import { I18nCache } from '@etheria/database';
import { VALID_CHARACTER_EQUIPMENT_SLOTS, type CharacterEquipmentSlotCode } from '@etheria/shared';
import { CharacterInventoryService } from './CharacterInventoryService.js';
import { MapPresenceService } from './MapPresenceService.js';
import { MapRuntimeCacheService } from './MapRuntimeCacheService.js';
import { AssetMirrorService } from './AssetMirrorService.js';

export { VALID_CHARACTER_EQUIPMENT_SLOTS, type CharacterEquipmentSlotCode };

export interface ActiveSetBonusDto {
  setId: number;
  code: string;
  namePtBr: string;
  piecesEquipped: number;
  totalPieces: number;
  activationTier: 'FULL' | 'HALF';
  bonusRatioPct: number;
  appliedStats: Record<string, number>;
}

export interface WingDirOffsetDto {
  x?: number;
  y?: number;
  layer?: 'AUTO' | 'BACK' | 'FRONT';
}

export interface EquippedWingsVisualDto {
  itemId: number;
  modelId: string;
  visualFormat: 'CHAR_MANIFEST';
  manifestUrl: string;
  thumbUrl: string;
  visualScale: number;
  visualOffsetX: number;
  visualOffsetY: number;
  groundOffsetY: number;
  backDepth?: number;
  dirOffsets?: Record<string, WingDirOffsetDto>;
}

export interface EquippedMountVisualDto {
  itemId: number;
  modelId: string;
  visualFormat: 'CHAR_MANIFEST' | 'ATLAS';
  manifestUrl?: string | null;
  atlasJsonUrl?: string | null;
  atlasWebpUrl?: string | null;
  thumbUrl: string;
  flightAltitude: number;
  riderOffsetX: number;
  riderOffsetY: number;
  groundOffsetY: number;
  visualScale: number;
  visualOffsetX: number;
  visualOffsetY: number;
  speedBonusPct: number;
}

export interface EquippedWeaponVisualDto {
  itemId: number;
  modelId: string;
  maleModelId: string;
  femaleModelId?: string | null;
  visualFormat: 'CHAR_MANIFEST';
  manifestUrl: string;
  maleManifestUrl: string;
  femaleManifestUrl?: string | null;
  visualScale: number;
  visualOffsetX: number;
  visualOffsetY: number;
  femaleOffsetX?: number;
  femaleOffsetY?: number;
  groundOffsetY: number;
  dirOffsets?: Record<string, WingDirOffsetDto>;
}

export interface CharacterVisualAppearanceDto {
  equippedWings: EquippedWingsVisualDto | null;
  equippedMount: EquippedMountVisualDto | null;
  equippedWeapon: EquippedWeaponVisualDto | null;
}

export interface EquippedSlotDetailDto {
  slotCode: string;
  item: {
    id: number;
    code: string;
    namePtBr: string;
    descriptionPtBr: string;
    iconUrl: string;
    equipmentSlotCode: string;
    equipmentSetId?: number | null;
    equipmentSetNamePtBr?: string | null;
    rarityTier: string;
    requiredLevel: number;
    combatStatBonuses: Record<string, number>;
    specialEffectJson?: any;
  } | null;
}

export class CharacterEquipmentService {
  private static resolveIconUrl(mcreworkIconKey: string | null | undefined): string {
    return AssetMirrorService.toSameOriginUrl(
      mcreworkIconKey || 'assets/equipment/icons/equip_normal_200001.png'
    );
  }

  private static resolveCharacterActiveCharKey(character: any): string | null {
    if (!character) return null;
    if (character.isReborn && character.classTemplate?.rebornMcreworkCharKey) {
      return character.classTemplate.rebornMcreworkCharKey;
    }
    return character.classTemplate?.mcreworkCharKey ?? character.mcreworkCharKey ?? null;
  }

  public static resolveVisualAppearance(
    equippedMap: Record<string, number>,
    itemsById: Map<number, any>,
    charKey?: string | null
  ): CharacterVisualAppearanceDto {
    let equippedWings: EquippedWingsVisualDto | null = null;
    let equippedMount: EquippedMountVisualDto | null = null;
    let equippedWeapon: EquippedWeaponVisualDto | null = null;

    const wingItemId = Number(equippedMap?.WINGS) || 0;
    const wingItem = wingItemId > 0 ? itemsById.get(wingItemId) : null;
    if (wingItem) {
      const fx = (wingItem.specialEffectJson && typeof wingItem.specialEffectJson === 'object' ? wingItem.specialEffectJson : {}) as any;
      let modelId = String(fx.wingModelId || '').trim();
      if (!modelId && typeof wingItem.mcreworkIconKey === 'string') {
        const m = wingItem.mcreworkIconKey.match(/assets\/wings\/([^/]+)\//i);
        if (m) modelId = m[1];
      }
      if (modelId) {
        equippedWings = {
          itemId: wingItem.id,
          modelId,
          visualFormat: 'CHAR_MANIFEST',
          manifestUrl: fx.manifestUrl || `/api/assets/mcrework/assets/wings/${modelId}/char_manifest.json`,
          thumbUrl: `/api/assets/mcrework/assets/wings/${modelId}/thumb.png`,
          visualScale: Number(fx.visualScale) > 0 ? Number(fx.visualScale) : 0.65,
          visualOffsetX: Number(fx.visualOffsetX) || 0,
          visualOffsetY: fx.visualOffsetY !== undefined ? Number(fx.visualOffsetY) : -30,
          groundOffsetY: Number(fx.groundOffsetY ?? 0),
          backDepth: Number(fx.backDepth ?? 0),
          dirOffsets: fx.dirOffsets && typeof fx.dirOffsets === 'object' ? fx.dirOffsets : {},
        };
      }
    }

    const mountItemId = Number(equippedMap?.FLYING_MOUNT) || 0;
    const mountItem = mountItemId > 0 ? itemsById.get(mountItemId) : null;
    if (mountItem) {
      const fx = (mountItem.specialEffectJson && typeof mountItem.specialEffectJson === 'object' ? mountItem.specialEffectJson : {}) as any;
      let modelId = String(fx.mountModelId || '').trim();
      if (!modelId && typeof mountItem.mcreworkIconKey === 'string') {
        const m = mountItem.mcreworkIconKey.match(/assets\/wings\/([^/]+)\//i);
        if (m) modelId = m[1];
      }
      if (modelId) {
        const isAtlas = fx.visualFormat === 'ATLAS' || modelId.startsWith('mount_');
        equippedMount = isAtlas
          ? {
              itemId: mountItem.id,
              modelId,
              visualFormat: 'ATLAS',
              atlasJsonUrl: `/api/assets/mcrework/assets/mounts/${modelId}/atlas.json`,
              atlasWebpUrl: `/api/assets/mcrework/assets/mounts/${modelId}/atlas.webp`,
              thumbUrl: `/api/assets/mcrework/assets/mounts/${modelId}/thumb.webp`,
              flightAltitude: Number(fx.flightAltitude ?? 65),
              riderOffsetX: Number(fx.riderOffsetX ?? 0),
              riderOffsetY: Number(fx.riderOffsetY ?? -42),
              groundOffsetY: Number(fx.groundOffsetY ?? 0),
              visualScale: Number(fx.visualScale) > 0 ? Number(fx.visualScale) : 0.70,
              visualOffsetX: Number(fx.visualOffsetX) || 0,
              visualOffsetY: Number(fx.visualOffsetY) || 0,
              speedBonusPct: Number(fx.speedBonusPct ?? 25),
            }
          : {
              itemId: mountItem.id,
              modelId,
              visualFormat: 'CHAR_MANIFEST',
              manifestUrl: fx.manifestUrl || `/api/assets/mcrework/assets/wings/${modelId}/char_manifest.json`,
              thumbUrl: `/api/assets/mcrework/assets/wings/${modelId}/thumb.png`,
              flightAltitude: Number(fx.flightAltitude ?? 72),
              riderOffsetX: Number(fx.riderOffsetX ?? 0),
              riderOffsetY: Number(fx.riderOffsetY ?? -22),
              groundOffsetY: Number(fx.groundOffsetY ?? 0),
              visualScale: Number(fx.visualScale) > 0 ? Number(fx.visualScale) : 0.70,
              visualOffsetX: Number(fx.visualOffsetX) || 0,
              visualOffsetY: Number(fx.visualOffsetY) || 0,
              speedBonusPct: Number(fx.speedBonusPct ?? 25),
            };
      }
    }

    const weaponItemId = Number(equippedMap?.WEAPON_1) || 0;
    const weaponItem = weaponItemId > 0 ? itemsById.get(weaponItemId) : null;
    if (weaponItem) {
      const fx = (weaponItem.specialEffectJson && typeof weaponItem.specialEffectJson === 'object' ? weaponItem.specialEffectJson : {}) as any;
      const maleModelId = String(fx.weaponModelId || '').trim();
      const femaleModelId = String(fx.weaponFemaleModelId || '').trim() || null;
      if (maleModelId || femaleModelId) {
        const isFemale = Boolean(charKey && /female/i.test(String(charKey)));
        const resolvedMaleId = maleModelId || femaleModelId!;
        const resolvedModelId = isFemale && femaleModelId ? femaleModelId : resolvedMaleId;
        const maleManifestUrl = `/api/assets/mcrework/assets/weapons/${resolvedMaleId}/char_manifest.json`;
        const femaleManifestUrl = femaleModelId ? `/api/assets/mcrework/assets/weapons/${femaleModelId}/char_manifest.json` : null;
        equippedWeapon = {
          itemId: weaponItem.id,
          modelId: resolvedModelId,
          maleModelId: resolvedMaleId,
          femaleModelId,
          visualFormat: 'CHAR_MANIFEST',
          manifestUrl: `/api/assets/mcrework/assets/weapons/${resolvedModelId}/char_manifest.json`,
          maleManifestUrl,
          femaleManifestUrl,
          visualScale: Number(fx.visualScale) > 0 ? Number(fx.visualScale) : 0.70,
          visualOffsetX: Number(fx.visualOffsetX) || 0,
          visualOffsetY: Number(fx.visualOffsetY) || 0,
          femaleOffsetX: Number(fx.femaleOffsetX) || 0,
          femaleOffsetY: Number(fx.femaleOffsetY) || 0,
          groundOffsetY: Number(fx.groundOffsetY ?? 0),
          dirOffsets: fx.dirOffsets && typeof fx.dirOffsets === 'object' ? fx.dirOffsets : {},
        };
      }
    }

    return { equippedWings, equippedMount, equippedWeapon };
  }

  /**
   * Carrega em lote a aparência visual equipada (Asas, Montaria Voadora e Arma Principal) para uma lista de personagens.
   */
  public static async loadVisualAppearanceByCharId(
    prisma: PrismaClient,
    characters: Array<{
      id: number;
      equippedItemsJson: any;
      isReborn?: boolean;
      mcreworkCharKey?: string | null;
      classTemplate?: { mcreworkCharKey?: string | null; rebornMcreworkCharKey?: string | null } | null;
    }>
  ): Promise<Map<number, CharacterVisualAppearanceDto>> {
    const result = new Map<number, CharacterVisualAppearanceDto>();
    const itemIds = new Set<number>();
    for (const c of characters) {
      const eq = (c.equippedItemsJson && typeof c.equippedItemsJson === 'object' ? c.equippedItemsJson : {}) as Record<string, number>;
      if (Number(eq.WINGS) > 0) itemIds.add(Number(eq.WINGS));
      if (Number(eq.FLYING_MOUNT) > 0) itemIds.add(Number(eq.FLYING_MOUNT));
      if (Number(eq.WEAPON_1) > 0) itemIds.add(Number(eq.WEAPON_1));
    }
    if (itemIds.size === 0) {
      for (const c of characters) result.set(c.id, { equippedWings: null, equippedMount: null, equippedWeapon: null });
      return result;
    }
    const items = await prisma.itemTemplate.findMany({ where: { id: { in: Array.from(itemIds) } } });
    const itemsById = new Map<number, any>(items.map((it) => [it.id, it]));

    for (const c of characters) {
      const eq = (c.equippedItemsJson && typeof c.equippedItemsJson === 'object' ? c.equippedItemsJson : {}) as Record<string, number>;
      const charKey = this.resolveCharacterActiveCharKey(c);
      result.set(c.id, this.resolveVisualAppearance(eq, itemsById, charKey));
    }
    return result;
  }

  /**
   * Valida no servidor se o personagem realmente possui montaria voadora equipada para voar sobre colisões.
   */
  public static async resolveAuthoritativeFlightPermission(
    prisma: PrismaClient,
    character: { id: number; equippedItemsJson: any },
    wantsToFly?: boolean
  ): Promise<{ isFlyingAllowed: boolean; speedMultiplier: number }> {
    if (!wantsToFly) return { isFlyingAllowed: false, speedMultiplier: 1 };
    const visMap = await this.loadVisualAppearanceByCharId(prisma, [character]);
    const mount = visMap.get(character.id)?.equippedMount;
    if (!mount) return { isFlyingAllowed: false, speedMultiplier: 1 };
    return {
      isFlyingAllowed: true,
      speedMultiplier: 1 + Math.max(0, Number(mount.speedBonusPct) || 0) / 100,
    };
  }

  /**
   * Retorna os detalhes de todos os slots de equipamentos do personagem, com os dados completos dos itens equipados.
   */
  public static async getCharacterEquippedDetails(
    prisma: PrismaClient,
    characterId: number
  ): Promise<{
    slots: EquippedSlotDetailDto[];
    consolidatedBonuses: Record<string, number>;
    activeSetBonuses: ActiveSetBonusDto[];
    visualAppearance: CharacterVisualAppearanceDto;
  }> {
    const pc = await prisma.playerCharacter.findUnique({
      where: { id: Number(characterId) },
      select: {
        id: true,
        equippedItemsJson: true,
        isReborn: true,
        classTemplate: { select: { mcreworkCharKey: true, rebornMcreworkCharKey: true } },
      },
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
            include: { equipmentSet: true },
          })
        : [],
      I18nCache.getTranslations(prisma),
    ]);

    const itemsById = new Map<number, any>(itemsList.map((it) => [it.id, it]));
    const consolidatedBonuses: Record<string, number> = {};

    const slots: EquippedSlotDetailDto[] = VALID_CHARACTER_EQUIPMENT_SLOTS.map((slotCode) => {
      const itemId = Number(equippedMap[slotCode]) || 0;
      const it = itemId > 0 ? itemsById.get(itemId) : null;

      if (it) {
        const isFishingRod = it.itemCategory === 'FISHING_ROD' || it.equipmentSlotCode === 'FISHING_ROD';
        const bonuses = isFishingRod
          ? {}
          : ((it.combatStatBonusesJson && typeof it.combatStatBonusesJson === 'object'
              ? (it.combatStatBonusesJson as Record<string, number>)
              : {}) as Record<string, number>);

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
            equipmentSetId: it.equipmentSetId,
            equipmentSetNamePtBr: it.equipmentSet ? (i18nMap.get(it.equipmentSet.nameI18nKey) || it.equipmentSet.code) : null,
            rarityTier: it.rarityTier ?? 'COMMON',
            requiredLevel: it.requiredLevel ?? 1,
            combatStatBonuses: bonuses,
            specialEffectJson: it.specialEffectJson || {},
          },
        };
      }

      return {
        slotCode,
        item: null,
      };
    });

    const visualAppearance = this.resolveVisualAppearance(equippedMap, itemsById, this.resolveCharacterActiveCharKey(pc));

    // --- Cálculo de Bônus de Conjuntos de Equipamentos (100% full = 100% bônus, 50% half = 40% bônus) ---
    const setPiecesCount = new Map<number, { set: any; count: number }>();
    for (const slotCode of VALID_CHARACTER_EQUIPMENT_SLOTS) {
      const itemId = Number(equippedMap[slotCode]) || 0;
      const it = itemId > 0 ? itemsById.get(itemId) : null;
      if (it && it.equipmentSet) {
        const setId = it.equipmentSet.id;
        const entry = setPiecesCount.get(setId) || { set: it.equipmentSet, count: 0 };
        entry.count += 1;
        setPiecesCount.set(setId, entry);
      }
    }

    const activeSetBonuses: ActiveSetBonusDto[] = [];

    for (const [setId, { set, count }] of setPiecesCount.entries()) {
      const minFull = set.minPiecesFull || 12;
      const minHalf = set.minPiecesHalf || 6;
      let ratio = 0;
      let tier: 'FULL' | 'HALF' | null = null;

      if (count >= minFull) {
        ratio = (set.fullBonusRatioPct ?? 100.0) / 100.0;
        tier = 'FULL';
      } else if (count >= minHalf) {
        ratio = (set.halfBonusRatioPct ?? 40.0) / 100.0;
        tier = 'HALF';
      }

      if (tier && ratio > 0) {
        const stats = (set.bonusCombatStatsJson && typeof set.bonusCombatStatsJson === 'object'
          ? (set.bonusCombatStatsJson as Record<string, number>)
          : {}) as Record<string, number>;

        const ALLOWED_SET_STATS = new Set(['MAX_HP', 'MAX_MP', 'PHYS_ATK', 'MAG_ATK', 'PHYS_DEF', 'MAG_DEF']);
        const appliedStats: Record<string, number> = {};
        for (const [stat, val] of Object.entries(stats)) {
          const numVal = Number(val) || 0;
          if (ALLOWED_SET_STATS.has(stat) && numVal !== 0) {
            const scaled = Math.round(numVal * ratio);
            appliedStats[stat] = scaled;
            consolidatedBonuses[stat] = (consolidatedBonuses[stat] || 0) + scaled;
          }
        }

        activeSetBonuses.push({
          setId,
          code: set.code,
          namePtBr: i18nMap.get(set.nameI18nKey) || set.code,
          piecesEquipped: count,
          totalPieces: minFull,
          activationTier: tier,
          bonusRatioPct: Math.round(ratio * 100),
          appliedStats,
        });
      }
    }

    return {
      slots,
      consolidatedBonuses,
      activeSetBonuses,
      visualAppearance,
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
    const isGmElevated = ['ADMIN', 'GM', 'DEV'].includes(role);
    if (pc.userAccountId !== userAccountId && !isGmElevated) {
      throw new Error('Acesso negado: este personagem não pertence à sua conta.');
    }

    const item = await prisma.itemTemplate.findUnique({
      where: { id: Number(itemTemplateId) },
    });
    if (!item) throw new Error(`Item #${itemTemplateId} não encontrado no catálogo.`);

    if (item.itemCategory !== 'CHARACTER_EQUIPMENT' && item.itemCategory !== 'FISHING_ROD') {
      throw new Error(`O item "${item.code}" não é um equipamento de personagem equipável.`);
    }

    if (!isGmElevated && item.requiredLevel && pc.level < item.requiredLevel) {
      throw new Error(`Nível insuficiente para equipar este item (Requer Nv.${item.requiredLevel}).`);
    }

    // Validação de Classe (GM/ADMIN/DEV têm passe livre para testes)
    const reqClasses = Array.isArray(item.reqClassCodesJson) ? item.reqClassCodesJson : [];
    if (!isGmElevated && reqClasses.length > 0 && pc.classTemplate?.code && !reqClasses.includes(pc.classTemplate.code)) {
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
    if (finalSlot === 'FLYING_MOUNT' && (pc as any).isFlying) {
      throw new Error('Você precisa pousar no chão antes de trocar sua Montaria Voadora.');
    }

    let updatedPc: any = null;

    await prisma.$transaction(async (tx) => {
      // 1. Valida se o item existe na mochila com quantidade >= 1
      const invRow = await tx.characterInventoryItem.findFirst({
        where: {
          characterId: pc.id,
          itemTemplateId: item.id,
          quantity: { gt: 0 },
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

    MapPresenceService.invalidateCharacterCache(pc.id);
    MapRuntimeCacheService.invalidateCharacter(pc.id);

    const [equippedDetails, bag] = await Promise.all([
      this.getCharacterEquippedDetails(prisma, pc.id),
      CharacterInventoryService.getWalletAndBag(prisma, pc.id),
    ]);

    return {
      success: true,
      equippedSlot: finalSlot,
      equippedItems: equippedDetails.slots,
      consolidatedBonuses: equippedDetails.consolidatedBonuses,
      activeSetBonuses: equippedDetails.activeSetBonuses,
      visualAppearance: equippedDetails.visualAppearance,
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
    if (pc.userAccountId !== userAccountId && !['ADMIN', 'GM', 'DEV'].includes(role)) {
      throw new Error('Acesso negado: este personagem não pertence à sua conta.');
    }

    const finalSlot = String(slotCode || '').trim().toUpperCase();
    if (!VALID_CHARACTER_EQUIPMENT_SLOTS.includes(finalSlot as any)) {
      throw new Error(`Slot de equipamento "${finalSlot}" inválido.`);
    }
    if (finalSlot === 'FLYING_MOUNT' && (pc as any).isFlying) {
      throw new Error('Você precisa pousar no chão antes de desequipar sua Montaria Voadora.');
    }
    if (finalSlot === 'FLYING_MOUNT' && (pc as any).isFlying) {
      throw new Error('Você precisa pousar no chão antes de trocar sua Montaria Voadora.');
    }

    const equippedMap = (pc.equippedItemsJson && typeof pc.equippedItemsJson === 'object'
      ? { ...(pc.equippedItemsJson as Record<string, number>) }
      : {}) as Record<string, number>;

    const itemId = Number(equippedMap[finalSlot]) || 0;
    if (itemId <= 0) {
      throw new Error(`O slot "${finalSlot}" já está vazio.`);
    }

    await prisma.$transaction(async (tx) => {
      // 1. Valida se há espaço na mochila
      const freeSlots = await CharacterInventoryService.countFreeSlots(tx, pc.id);
      if (freeSlots <= 0) {
        throw new Error('Mochila cheia! Libere um slot no inventário para desequipar este item.');
      }

      // 2. Devolve para a mochila
      await CharacterInventoryService.addItem(tx, pc.id, itemId, 1);

      // 3. Remove do mapa de equipamentos
      delete equippedMap[finalSlot];

      await tx.playerCharacter.update({
        where: { id: pc.id },
        data: {
          equippedItemsJson: equippedMap as any,
        },
      });
    });

    MapPresenceService.invalidateCharacterCache(pc.id);
    MapRuntimeCacheService.invalidateCharacter(pc.id);

    const [equippedDetails, bag] = await Promise.all([
      this.getCharacterEquippedDetails(prisma, pc.id),
      CharacterInventoryService.getWalletAndBag(prisma, pc.id),
    ]);

    return {
      success: true,
      unequippedSlot: finalSlot,
      equippedItems: equippedDetails.slots,
      consolidatedBonuses: equippedDetails.consolidatedBonuses,
      activeSetBonuses: equippedDetails.activeSetBonuses,
      visualAppearance: equippedDetails.visualAppearance,
      bag,
    };
  }

  public static async assertGroundedForBattle(prisma: PrismaClient, characterId: number): Promise<void> {
    if (!characterId || Number(characterId) <= 0) return;
    const pc = await prisma.playerCharacter.findUnique({
      where: { id: Number(characterId) },
      select: { isFlying: true },
    });
    if ((pc as any)?.isFlying) {
      throw new Error('Você precisa estar no chão para iniciar uma luta! Pouse sua montaria primeiro.');
    }
  }
}
