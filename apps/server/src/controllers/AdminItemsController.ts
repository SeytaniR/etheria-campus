/**
 * @file apps/server/src/controllers/AdminItemsController.ts
 * @module @etheria/server
 * @description Controlador dedicado para a Gestão de Itens Não-Equipamento (`item_templates`) no Estúdio `/admin`.
 *   - Consumíveis (Poções de HP/MP, Comidas, Pergaminhos de Teleporte).
 *   - Trocadores Elementais (Pedras de Afinidade de Fogo, Água, Terra, Ar).
 *   - Materiais de Coleta & Crafting (Minérios, Ervas, Madeiras, Essências).
 *   - Itens de Missão, Chaves e Itens Especiais (Cápsulas de Captura de Pet, Orbes de EXP).
 *   - Integração com catálogo oficial de 6.468 itens (`assets/items/items_catalog.json`) do repositório `mcrework`.
 */

import { PrismaClient } from '@prisma/client';
import { SnapshotManager } from '@etheria/database';

export interface ItemTemplateDto {
  code?: string;
  namePtBr: string;
  descriptionPtBr?: string;
  mcreworkIconKey?: string;
  itemCategory: string; // CONSUMABLE | ELEMENT_CHANGER | MATERIAL | QUEST | SPECIAL
  rarityTier?: string; // SS, S, A, B, C, D, F, COMMON
  requiredLevel?: number;
  priceGold?: number;
  maxStack?: number;
  cooldownSec?: number;
  targetType?: string; // SELF | ALLY | ENEMY | PET | NONE
  effectType?: string; // HEAL_HP | RESTORE_MP | BUFF_STATS | CHANGE_ELEMENT | TELEPORT | CATCH_PET | GRANT_EXP | MATERIAL | OPEN_CHEST
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

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.snapshotManager = new SnapshotManager(prisma);
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
      orderBy: [{ requiredLevel: 'asc' }, { id: 'asc' }],
    });

    const i18nKeys = items.flatMap((i) => [i.nameI18nKey, i.descriptionI18nKey]);
    const translations = await this.prisma.i18nTranslation.findMany({
      where: { key: { in: i18nKeys }, locale: 'pt-BR' },
    });
    const transMap = new Map(translations.map((t) => [t.key, t.text]));

    return items.map((item) => {
      const iconKey = item.mcreworkIconKey || 'assets/items/icons/item_normal_060009.png';
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
        priceGold: item.priceGold,
        maxStack: item.maxStack,
        cooldownSec: item.cooldownSec,
        targetType: item.targetType,
        effectType: item.effectType,
        effectValue: item.effectValue,
        specialEffectJson: item.specialEffectJson,
        isActive: item.isActive,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
    });
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
    const slug = cleanName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

    const randSuffix = Math.random().toString(36).substring(2, 7);
    const code = dto.code && dto.code.trim() ? dto.code.trim() : `item_${slug}_${randSuffix}`;

    const nameI18nKey = `item.${code}.name`;
    const descI18nKey = `item.${code}.desc`;

    await this.prisma.i18nTranslation.upsert({
      where: { key_locale: { key: nameI18nKey, locale: 'pt-BR' } },
      update: { text: cleanName },
      create: { key: nameI18nKey, locale: 'pt-BR', text: cleanName },
    });

    if (dto.descriptionPtBr) {
      await this.prisma.i18nTranslation.upsert({
        where: { key_locale: { key: descI18nKey, locale: 'pt-BR' } },
        update: { text: dto.descriptionPtBr.trim() },
        create: { key: descI18nKey, locale: 'pt-BR', text: dto.descriptionPtBr.trim() },
      });
    }

    const created = await this.prisma.itemTemplate.create({
      data: {
        code,
        nameI18nKey,
        descriptionI18nKey: descI18nKey,
        mcreworkIconKey: dto.mcreworkIconKey || null,
        itemCategory: dto.itemCategory,
        equipmentSlotCode: null,
        rarityTier: dto.rarityTier || 'COMMON',
        requiredLevel: dto.requiredLevel ?? 1,
        priceGold: dto.priceGold ?? 0,
        maxStack: dto.maxStack ?? 99,
        cooldownSec: dto.cooldownSec ?? 0.0,
        targetType: dto.targetType || 'SELF',
        effectType: dto.effectType || null,
        effectValue: dto.effectValue ?? 0.0,
        specialEffectJson: dto.specialEffectJson || {},
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });

    await this.snapshotManager.exportToDisk();
    return created;
  }

  /**
   * Atualiza um item não-equipamento existente.
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

    const updated = await this.prisma.itemTemplate.update({
      where: { id },
      data: {
        mcreworkIconKey: dto.mcreworkIconKey !== undefined ? dto.mcreworkIconKey : existing.mcreworkIconKey,
        itemCategory: dto.itemCategory !== undefined ? dto.itemCategory : existing.itemCategory,
        rarityTier: dto.rarityTier !== undefined ? dto.rarityTier : existing.rarityTier,
        requiredLevel: dto.requiredLevel !== undefined ? dto.requiredLevel : existing.requiredLevel,
        priceGold: dto.priceGold !== undefined ? dto.priceGold : existing.priceGold,
        maxStack: dto.maxStack !== undefined ? dto.maxStack : existing.maxStack,
        cooldownSec: dto.cooldownSec !== undefined ? dto.cooldownSec : existing.cooldownSec,
        targetType: dto.targetType !== undefined ? dto.targetType : existing.targetType,
        effectType: dto.effectType !== undefined ? dto.effectType : existing.effectType,
        effectValue: dto.effectValue !== undefined ? dto.effectValue : existing.effectValue,
        specialEffectJson: dto.specialEffectJson !== undefined ? (dto.specialEffectJson as any) : existing.specialEffectJson,
        isActive: dto.isActive !== undefined ? dto.isActive : existing.isActive,
      },
    });

    await this.snapshotManager.exportToDisk();
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
   * Semeia um catálogo inicial de 12 itens clássicos (poções, pedras elementais, materiais, cápsula de pet).
   */
  public async seedInitialItemsIfEmpty() {
    try {
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
        {
          code: 'item_capsula_selamento_astral',
          namePtBr: 'Cápsula de Selamento Astral',
          descriptionPtBr: 'Artefato mágico de contenção usado em monstros para tentar capturá-los como Pets.',
          mcreworkIconKey: 'assets/items/icons/item_normal_100001.png',
          itemCategory: 'SPECIAL',
          rarityTier: 'B',
          requiredLevel: 5,
          priceGold: 150,
          maxStack: 50,
          cooldownSec: 5.0,
          targetType: 'ENEMY',
          effectType: 'CATCH_PET',
          effectValue: 15,
          specialEffectJson: { bonusCatchRatePct: 15 },
        },
      ];

      for (const s of seeds) {
        await this.createItemTemplate(s);
      }
      console.log('✅ [AdminItemsController] 12 itens clássicos semeados com sucesso.');
    } catch (err: any) {
      console.warn('Aviso ao semear itens iniciais:', err?.message || err);
    }
  }
}
