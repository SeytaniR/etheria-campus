/**
 * @file apps/server/src/controllers/AdminItemsController.ts
 * @module @etheria/server
 * @description Controlador dedicado para a Gestão de Itens Não-Equipamento (`item_templates`) no Estúdio `/admin`.
 *   - Consumíveis (Poções de HP/MP, Comidas, Pergaminhos de Teleporte).
 *   - Trocadores Elementais (Pedras de Afinidade de Fogo, Água, Terra, Ar).
 *   - Materiais de Coleta & Crafting (Minérios, Ervas, Madeiras, Essências).
 *   - Itens de Missão, Chaves e Itens Especiais (Essências, Orbes de EXP).
 *   - Integração com catálogo oficial de 6.468 itens (`assets/items/items_catalog.json`) do repositório `mcrework`.
 */

import { PrismaClient } from '@prisma/client';
import { SnapshotManager } from '@etheria/database';
import type { AssetMirrorService } from './AssetMirrorService.js';

export interface ItemTemplateDto {
  code?: string;
  namePtBr: string;
  descriptionPtBr?: string;
  mcreworkIconKey?: string;
  itemCategory: string; // CONSUMABLE | ELEMENT_CHANGER | MATERIAL | QUEST | SPECIAL
  rarityTier?: string; // SS, S, A, B, C, D, F, COMMON
  requiredLevel?: number;
  isTradable?: boolean;
  priceGold?: number;
  maxStack?: number;
  cooldownSec?: number;
  targetType?: string; // SELF | ALLY | ENEMY | PET | NONE
  effectType?: string; // HEAL_HP | RESTORE_MP | BUFF_STATS | CHANGE_ELEMENT | TELEPORT | GRANT_EXP | MATERIAL | OPEN_CHEST
  effectValue?: number;
  specialEffectJson?: any;
  isActive?: boolean;
}

export class AdminItemsController {
  private readonly prisma: PrismaClient;
  private readonly snapshotManager: SnapshotManager;
  private readonly mcreworkRawBaseUrl = 'https://raw.githubusercontent.com/SeytaniR/mcrework/main/web';
  private readonly mcreworkPagesBaseUrl = 'https://seytanir.github.io/mcrework';
  private cachedMcreworkItems: any[] | null = null;
  private readonly assetMirrorService?: AssetMirrorService;

  constructor(prisma: PrismaClient, assetMirrorService?: AssetMirrorService) {
    this.prisma = prisma;
    this.snapshotManager = new SnapshotManager(prisma);
    this.assetMirrorService = assetMirrorService;
  }

  /**
   * Busca e cacheia os 6.468 itens do catálogo oficial do `mcrework`.
   */
  public async getMcreworkItemsCatalog() {
    if (this.cachedMcreworkItems) return this.cachedMcreworkItems;

    try {
      const res = await fetch(`${this.mcreworkRawBaseUrl}/assets/items/items_catalog.json`);
      if (!res.ok) {
        throw new Error(`Falha ao ler catálogo de itens do mcrework (${res.status})`);
      }
      const data: any = await res.json();
      const rawList = Array.isArray(data.items) ? data.items : [];

      const mapped = rawList.map((item: any) => {
        const rawIcon = item.icon_path || 'assets/items/icons/item_normal_060009.png';
        const cleanIcon = rawIcon.replace(/^\/+/, '');

        let suggestedCategory = 'CONSUMABLE';
        let suggestedEffect = 'HEAL_HP';
        let suggestedTarget = 'SELF';

        if (item.category === 'potions') {
          suggestedCategory = 'CONSUMABLE';
          suggestedEffect = (item.name || '').toLowerCase().includes('mana') || (item.name || '').toLowerCase().includes('mp') ? 'RESTORE_MP' : 'HEAL_HP';
        } else if (item.category === 'gems') {
          suggestedCategory = 'ELEMENT_CHANGER';
          suggestedEffect = 'CHANGE_ELEMENT';
        } else if (item.category === 'materials') {
          suggestedCategory = 'MATERIAL';
          suggestedEffect = 'MATERIAL';
          suggestedTarget = 'NONE';
        } else if (item.category === 'books') {
          suggestedCategory = 'SPECIAL';
          suggestedEffect = 'LEARN_SKILL';
        } else if (item.category === 'scrolls') {
          suggestedCategory = 'CONSUMABLE';
          suggestedEffect = 'TELEPORT';
        } else if (item.category === 'quest') {
          suggestedCategory = 'QUEST';
          suggestedEffect = 'QUEST_ITEM';
          suggestedTarget = 'NONE';
        } else {
          suggestedCategory = 'SPECIAL';
          suggestedEffect = 'OPEN_CHEST';
        }

        return {
          id: item.id,
          name: item.name,
          description: item.description || '',
          info: item.info || '',
          category: item.category || 'other',
          rarity: item.rarity || 'Normal',
          level: item.level || 0,
          price: item.price || 0,
          stackMax: item.stack_max || 99,
          mcreworkIconKey: cleanIcon,
          iconUrl: `${this.mcreworkPagesBaseUrl}/${cleanIcon}`,
          suggestedCategory,
          suggestedEffect,
          suggestedTarget,
        };
      });

      this.cachedMcreworkItems = mapped;
      return mapped;
    } catch (err: any) {
      console.error('Erro ao buscar catálogo de itens do mcrework:', err);
      return [];
    }
  }

  /**
   * Retorna os itens não-equipamento cadastrados no PostgreSQL.
   */
  public async getItemTemplates(categoryFilter?: string) {
    const where: any = {
      itemCategory: { notIn: ['CHARACTER_EQUIPMENT', 'PET_EQUIPMENT'] },
    };
    if (categoryFilter && categoryFilter !== 'ALL') {
      where.itemCategory = categoryFilter;
    }

    const items = await this.prisma.itemTemplate.findMany({
      where,
      orderBy: [{ id: 'asc' }],
    });

    const i18nKeys = items.flatMap((i) => [i.nameI18nKey, i.descriptionI18nKey]);
    const translations = await this.prisma.i18nTranslation.findMany({
      where: { key: { in: i18nKeys }, locale: 'pt-BR' },
    });
    const transMap = new Map(translations.map((t) => [t.key, t.text]));

    return items.map((item) => {
      const iconKey = item.mcreworkIconKey || 'assets/items/icons/item_normal_060009.png';
      const spec = (item.specialEffectJson || {}) as any;
      let containerSummaryPtBr: string | null = null;
      if (item.effectType === 'OPEN_CHEST' || item.effectType === 'ROULETTE') {
        const entries = Array.isArray(spec.entries) ? spec.entries : [];
        if (item.effectType === 'ROULETTE') {
          const totalChance = entries.reduce((acc: number, e: any) => acc + (Number(e.chancePct) || 0), 0);
          containerSummaryPtBr = `🎰 Roleta: ${entries.length} prêmio(s) (${totalChance.toFixed(1)}% total, ${spec.rollCount || 1} giro(s))`;
        } else {
          containerSummaryPtBr = `🎁 ${spec.containerType === 'CAPSULE' ? 'Cápsula' : 'Baú'}: ${entries.length} item(ns) com chance configurada`;
        }
      }

      return {
        id: item.id,
        code: item.code,
        namePtBr: transMap.get(item.nameI18nKey) || item.code,
        descriptionPtBr: transMap.get(item.descriptionI18nKey) || '',
        mcreworkIconKey: item.mcreworkIconKey,
        iconUrl: `${this.mcreworkPagesBaseUrl}/${iconKey.replace(/^\/+/, '')}`,
        itemCategory: item.itemCategory,
        rarityTier: item.rarityTier,
        requiredLevel: item.requiredLevel,
        isTradable: item.isTradable !== false,
        priceGold: item.priceGold,
        maxStack: item.maxStack,
        cooldownSec: item.cooldownSec,
        targetType: item.targetType,
        effectType: item.effectType,
        effectValue: item.effectValue,
        specialEffectJson: item.specialEffectJson,
        containerSummaryPtBr,
        isActive: item.isActive,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
    });
  }

  private toFiniteInt(raw: unknown, fallback: number, min: number, max: number): number {
    if (raw === undefined || raw === null || raw === '') return fallback;
    const num = Number(raw);
    if (!Number.isFinite(num)) return fallback;
    return Math.max(min, Math.min(max, Math.round(num)));
  }

  private toFiniteFloat(raw: unknown, fallback: number, min: number, max: number): number {
    if (raw === undefined || raw === null || raw === '') return fallback;
    const num = Number(raw);
    if (!Number.isFinite(num)) return fallback;
    return Math.max(min, Math.min(max, num));
  }

  private isPassiveItemEffect(itemCategory: string, effectType: string | null): boolean {
    if (effectType === null || effectType === 'NONE' || effectType === 'MATERIAL' || effectType === 'QUEST_ITEM') {
      return true;
    }
    return itemCategory === 'MATERIAL' && !effectType;
  }

  private normalizeItemFields(dto: Partial<ItemTemplateDto>, base?: any) {
    const itemCategory = dto.itemCategory !== undefined ? String(dto.itemCategory) : (base?.itemCategory ?? 'CONSUMABLE');
    const isTradable = dto.isTradable !== undefined ? dto.isTradable !== false : (base ? base.isTradable !== false : true);
    const requiredLevel = this.toFiniteInt(dto.requiredLevel, base?.requiredLevel ?? 1, 1, 9999);
    const maxStack = this.toFiniteInt(dto.maxStack, base?.maxStack ?? 999, 1, 99999);
    const rawPrice = this.toFiniteInt(dto.priceGold, base?.priceGold ?? 0, 0, 2000000000);
    const priceGold = isTradable ? rawPrice : 0;

    let rawEffect: string | null = dto.effectType !== undefined
      ? (dto.effectType === '' || dto.effectType === 'NONE' ? null : String(dto.effectType))
      : (base ? (base.effectType ?? null) : null);

    if (itemCategory === 'MATERIAL' && dto.effectType === undefined && !base) {
      rawEffect = 'MATERIAL';
    }

    const isPassive = this.isPassiveItemEffect(itemCategory, rawEffect);
    const effectType = rawEffect === 'NONE' ? null : rawEffect;
    const targetType = isPassive
      ? 'NONE'
      : (dto.targetType !== undefined ? String(dto.targetType || 'SELF') : (base?.targetType || 'SELF'));
    const cooldownSec = isPassive
      ? 0.0
      : this.toFiniteFloat(dto.cooldownSec, base?.cooldownSec ?? 0.0, 0, 86400);
    const effectValue = isPassive
      ? 0.0
      : this.toFiniteFloat(dto.effectValue, base?.effectValue ?? 0.0, 0, 1000000000);

    let specialEffectJson: any =
      dto.specialEffectJson !== undefined ? (dto.specialEffectJson as any) : (base?.specialEffectJson ?? {});

    if (effectType === 'OPEN_CHEST' || effectType === 'ROULETTE') {
      if (specialEffectJson && typeof specialEffectJson === 'object') {
        const containerType =
          effectType === 'ROULETTE'
            ? 'ROULETTE'
            : specialEffectJson.containerType === 'CAPSULE'
            ? 'CAPSULE'
            : 'CHEST';
        const rawEntries = Array.isArray(specialEffectJson.entries) ? specialEffectJson.entries : [];
        const cleanEntries = rawEntries
          .map((e: any) => ({
            itemTemplateId: Math.max(1, Math.round(Number(e.itemTemplateId) || 0)),
            chancePct: Math.max(0.01, Math.min(100, Number(e.chancePct) || 0)),
            minQty: Math.max(1, Math.round(Number(e.minQty ?? e.quantity ?? 1) || 1)),
            maxQty: Math.max(
              Math.max(1, Math.round(Number(e.minQty ?? e.quantity ?? 1) || 1)),
              Math.round(Number(e.maxQty ?? e.quantity ?? 1) || 1),
            ),
          }))
          .filter((e: any) => e.itemTemplateId > 0 && e.chancePct > 0);

        specialEffectJson = {
          containerType,
          rollCount:
            containerType === 'ROULETTE'
              ? Math.max(1, Math.min(10, Math.round(Number(specialEffectJson.rollCount) || 1)))
              : 1,
          bonusGoldMin: Math.max(0, Math.round(Number(specialEffectJson.bonusGoldMin) || 0)),
          bonusGoldMax: Math.max(
            Math.max(0, Math.round(Number(specialEffectJson.bonusGoldMin) || 0)),
            Math.round(Number(specialEffectJson.bonusGoldMax) || 0),
          ),
          entries: cleanEntries,
        };
      }
    }

    return {
      mcreworkIconKey: dto.mcreworkIconKey !== undefined ? (dto.mcreworkIconKey || null) : (base?.mcreworkIconKey ?? null),
      itemCategory,
      rarityTier: dto.rarityTier !== undefined ? String(dto.rarityTier || 'COMMON') : (base?.rarityTier ?? 'COMMON'),
      requiredLevel,
      isTradable,
      priceGold,
      maxStack,
      cooldownSec,
      targetType,
      effectType,
      effectValue,
      specialEffectJson,
      isActive: dto.isActive !== undefined ? Boolean(dto.isActive) : (base ? Boolean(base.isActive) : true),
    };
  }

  private async resolveUniqueItemCode(namePtBr: string, requestedCode?: string): Promise<string> {
    if (requestedCode && requestedCode.trim()) {
      const explicitCode = requestedCode.trim();
      const collision = await this.prisma.itemTemplate.findUnique({ where: { code: explicitCode }, select: { id: true } });
      if (collision) {
        throw new Error(`Já existe outro item com o código "${explicitCode}". Deixe em branco para gerar um código único.`);
      }
      return explicitCode;
    }

    const slug = namePtBr
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'item';

    for (let attempt = 0; attempt < 8; attempt++) {
      const randSuffix = Math.random().toString(36).substring(2, 7);
      const candidate = `item_${slug}_${randSuffix}`;
      const existing = await this.prisma.itemTemplate.findUnique({ where: { code: candidate }, select: { id: true } });
      if (!existing) return candidate;
    }
    return `item_${slug}_${Date.now().toString(36)}`;
  }

  /**
   * Cadastra um novo item não-equipamento no PostgreSQL.
   */
  public async createItemTemplate(dto: ItemTemplateDto) {
    if (!dto.namePtBr || !dto.namePtBr.trim()) {
      throw new Error('O nome do item em português é obrigatório.');
    }
    if (!dto.itemCategory) {
      throw new Error('A categoria do item é obrigatória.');
    }

    const cleanName = dto.namePtBr.trim();
    const code = await this.resolveUniqueItemCode(cleanName, dto.code);
    const nameI18nKey = `item.${code}.name`;
    const descI18nKey = `item.${code}.desc`;
    const fields = this.normalizeItemFields(dto);

    await this.prisma.i18nTranslation.upsert({
      where: { key_locale: { key: nameI18nKey, locale: 'pt-BR' } },
      update: { text: cleanName },
      create: { key: nameI18nKey, locale: 'pt-BR', text: cleanName },
    });

    await this.prisma.i18nTranslation.upsert({
      where: { key_locale: { key: descI18nKey, locale: 'pt-BR' } },
      update: { text: (dto.descriptionPtBr || '').trim() },
      create: { key: descI18nKey, locale: 'pt-BR', text: (dto.descriptionPtBr || '').trim() },
    });

    const created = await this.prisma.itemTemplate.create({
      data: {
        code,
        nameI18nKey,
        descriptionI18nKey: descI18nKey,
        equipmentSlotCode: null,
        ...fields,
      },
    });

    await this.snapshotManager.exportToDisk();
    if (this.assetMirrorService && created.mcreworkIconKey) {
      await this.assetMirrorService.mirrorItemIcon(created.mcreworkIconKey);
    }
    return created;
  }

  /**
   * Atualiza um item não-equipamento existente sem afetar nenhum outro registro.
   */
  public async updateItemTemplate(id: number, dto: Partial<ItemTemplateDto>) {
    const existing = await this.prisma.itemTemplate.findUnique({ where: { id } });
    if (!existing) {
      throw new Error(`Item #${id} não encontrado.`);
    }

    if (dto.namePtBr && dto.namePtBr.trim()) {
      await this.prisma.i18nTranslation.upsert({
        where: { key_locale: { key: existing.nameI18nKey, locale: 'pt-BR' } },
        update: { text: dto.namePtBr.trim() },
        create: { key: existing.nameI18nKey, locale: 'pt-BR', text: dto.namePtBr.trim() },
      });
    }

    if (dto.descriptionPtBr !== undefined) {
      await this.prisma.i18nTranslation.upsert({
        where: { key_locale: { key: existing.descriptionI18nKey, locale: 'pt-BR' } },
        update: { text: dto.descriptionPtBr.trim() },
        create: { key: existing.descriptionI18nKey, locale: 'pt-BR', text: dto.descriptionPtBr.trim() },
      });
    }

    const fields = this.normalizeItemFields(dto, existing);

    const updated = await this.prisma.itemTemplate.update({
      where: { id },
      data: fields,
    });

    await this.snapshotManager.exportToDisk();
    if (this.assetMirrorService && updated.mcreworkIconKey) {
      await this.assetMirrorService.mirrorItemIcon(updated.mcreworkIconKey);
    }
    return updated;
  }

  /**
   * Exclui um item e remove suas chaves de tradução.
   */
  public async deleteItemTemplate(id: number) {
    const existing = await this.prisma.itemTemplate.findUnique({ where: { id } });
    if (!existing) {
      throw new Error(`Item #${id} não encontrado.`);
    }

    await this.prisma.itemTemplate.delete({ where: { id } });
    await this.prisma.i18nTranslation.deleteMany({
      where: { key: { in: [existing.nameI18nKey, existing.descriptionI18nKey] } },
    });

    await this.snapshotManager.exportToDisk();
    return { success: true, message: `Item #${id} excluído com sucesso.` };
  }

  /**
   * Semeia um catálogo inicial de itens clássicos (poções, pedras elementais, materiais)
   * e remove itens legados de captura de pet.
   */
  public async seedInitialItemsIfEmpty() {
    try {
      // Remove qualquer item legado de captura de pet do banco
      await this.prisma.itemTemplate.deleteMany({
        where: { OR: [{ effectType: 'CATCH_PET' }, { code: 'item_capsula_selamento_astral' }] },
      });

      const count = await this.prisma.itemTemplate.count({
        where: { itemCategory: { notIn: ['CHARACTER_EQUIPMENT', 'PET_EQUIPMENT'] } },
      });
      if (count > 0) return;

      const seeds: ItemTemplateDto[] = [
        {
          code: 'item_pocao_cura_menor',
          namePtBr: 'Poção de Cura Menor',
          descriptionPtBr: 'Extrato vegetal refrescante que regenera 150 pontos de vida instantaneamente.',
          mcreworkIconKey: 'assets/items/icons/item_normal_060009.png',
          itemCategory: 'CONSUMABLE',
          rarityTier: 'COMMON',
          requiredLevel: 1,
          priceGold: 15,
          maxStack: 99,
          cooldownSec: 3.0,
          targetType: 'SELF',
          effectType: 'HEAL_HP',
          effectValue: 150,
        },
        {
          code: 'item_pocao_cura_maior',
          namePtBr: 'Poção de Cura Maior',
          descriptionPtBr: 'Elixir concentrado de pétalas sagradas, regenera 600 pontos de vida.',
          mcreworkIconKey: 'assets/items/icons/item_normal_060010.png',
          itemCategory: 'CONSUMABLE',
          rarityTier: 'B',
          requiredLevel: 15,
          priceGold: 80,
          maxStack: 99,
          cooldownSec: 4.0,
          targetType: 'SELF',
          effectType: 'HEAL_HP',
          effectValue: 600,
        },
        {
          code: 'item_frasco_mana_cristalina',
          namePtBr: 'Frasco de Mana Cristalina',
          descriptionPtBr: 'Água pura infundida com poeira de cristal que restaura 200 pontos de mana.',
          mcreworkIconKey: 'assets/items/icons/item_normal_060011.png',
          itemCategory: 'CONSUMABLE',
          rarityTier: 'COMMON',
          requiredLevel: 5,
          priceGold: 25,
          maxStack: 99,
          cooldownSec: 3.0,
          targetType: 'SELF',
          effectType: 'RESTORE_MP',
          effectValue: 200,
        },
        {
          code: 'item_carne_assada_revigorante',
          namePtBr: 'Carne Assada Revigorante',
          descriptionPtBr: 'Alimento suculento que restaura 25 HP por segundo ao longo de 10 segundos.',
          mcreworkIconKey: 'assets/items/icons/item_normal_060012.png',
          itemCategory: 'CONSUMABLE',
          rarityTier: 'COMMON',
          requiredLevel: 1,
          priceGold: 20,
          maxStack: 50,
          cooldownSec: 10.0,
          targetType: 'SELF',
          effectType: 'BUFF_STATS',
          effectValue: 25,
          specialEffectJson: { durationSec: 10, hpPerSec: 25 },
        },
        {
          code: 'item_pergaminho_retorno',
          namePtBr: 'Pergaminho de Retorno à Capital',
          descriptionPtBr: 'Inscrições arcanas que teleportam o herói diretamente ao ponto seguro da capital.',
          mcreworkIconKey: 'assets/items/icons/item_normal_070001.png',
          itemCategory: 'CONSUMABLE',
          rarityTier: 'COMMON',
          requiredLevel: 1,
          priceGold: 50,
          maxStack: 20,
          cooldownSec: 10.0,
          targetType: 'SELF',
          effectType: 'TELEPORT',
          effectValue: 1,
        },
        {
          code: 'item_pedra_afinidade_flamejante',
          namePtBr: 'Pedra de Afinidade Flamejante',
          descriptionPtBr: 'Cristal ardente que altera a sintonia elemental do personagem ou pet para FOGO.',
          mcreworkIconKey: 'assets/items/icons/item_normal_080001.png',
          itemCategory: 'ELEMENT_CHANGER',
          rarityTier: 'A',
          requiredLevel: 10,
          priceGold: 500,
          maxStack: 10,
          targetType: 'SELF',
          effectType: 'CHANGE_ELEMENT',
          effectValue: 0,
          specialEffectJson: { targetElementCode: 'FIRE' },
        },
        {
          code: 'item_orbe_mare_cristalina',
          namePtBr: 'Orbe da Maré Cristalina',
          descriptionPtBr: 'Esfera fluida que altera a sintonia elemental do personagem ou pet para ÁGUA.',
          mcreworkIconKey: 'assets/items/icons/item_normal_080002.png',
          itemCategory: 'ELEMENT_CHANGER',
          rarityTier: 'A',
          requiredLevel: 10,
          priceGold: 500,
          maxStack: 10,
          targetType: 'SELF',
          effectType: 'CHANGE_ELEMENT',
          effectValue: 0,
          specialEffectJson: { targetElementCode: 'WATER' },
        },
        {
          code: 'item_semente_terra_ancestral',
          namePtBr: 'Semente da Terra Ancestral',
          descriptionPtBr: 'Fóssil vegetal que altera a sintonia elemental do personagem ou pet para TERRA.',
          mcreworkIconKey: 'assets/items/icons/item_normal_080003.png',
          itemCategory: 'ELEMENT_CHANGER',
          rarityTier: 'A',
          requiredLevel: 10,
          priceGold: 500,
          maxStack: 10,
          targetType: 'SELF',
          effectType: 'CHANGE_ELEMENT',
          effectValue: 0,
          specialEffectJson: { targetElementCode: 'EARTH' },
        },
        {
          code: 'item_pena_vendaval_veloz',
          namePtBr: 'Pena do Vendaval Veloz',
          descriptionPtBr: 'Pluma etérea que altera a sintonia elemental do personagem ou pet para AR.',
          mcreworkIconKey: 'assets/items/icons/item_normal_080004.png',
          itemCategory: 'ELEMENT_CHANGER',
          rarityTier: 'A',
          requiredLevel: 10,
          priceGold: 500,
          maxStack: 10,
          targetType: 'SELF',
          effectType: 'CHANGE_ELEMENT',
          effectValue: 0,
          specialEffectJson: { targetElementCode: 'AIR' },
        },
        {
          code: 'item_madeira_nobre_floresta',
          namePtBr: 'Madeira Nobre da Floresta',
          descriptionPtBr: 'Troncos nobres e resistentes para fabricação de arcos, bastões e construções.',
          mcreworkIconKey: 'assets/items/icons/item_normal_090001.png',
          itemCategory: 'MATERIAL',
          rarityTier: 'COMMON',
          requiredLevel: 1,
          priceGold: 10,
          maxStack: 999,
          targetType: 'NONE',
          effectType: 'MATERIAL',
          effectValue: 0,
        },
        {
          code: 'item_minerio_ferro_puro',
          namePtBr: 'Minério de Ferro Puro',
          descriptionPtBr: 'Pedra mineral rica em ferro para forja de lâminas, escudos e armaduras pesadas.',
          mcreworkIconKey: 'assets/items/icons/item_normal_090002.png',
          itemCategory: 'MATERIAL',
          rarityTier: 'COMMON',
          requiredLevel: 1,
          priceGold: 12,
          maxStack: 999,
          targetType: 'NONE',
          effectType: 'MATERIAL',
          effectValue: 0,
        },
      ];

      for (const s of seeds) {
        await this.createItemTemplate(s);
      }
      console.log(`✅ [AdminItemsController] ${seeds.length} itens clássicos semeados com sucesso.`);
    } catch (err: any) {
      console.warn('Aviso ao semear itens iniciais:', err?.message || err);
    }
  }
}
