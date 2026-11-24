/**
 * @file apps/server/src/controllers/AdminShopsController.ts
 * @module @etheria/server
 * @description Controlador CRUD da Tabela de Lojas (`shop_templates`) na Rota `/admin`.
 *   Permite criar, editar e excluir lojas contendo Equipamentos e Itens (`item_templates`),
 *   que podem ser vinculadas genericamente a qualquer NPC (Armeiro, Alquimista, Caçador,
 *   Cozinheiro, Minerador, Loja pura, etc.).
 * @rules Segue estritamente AGENTS.md (Regra #7 < 1.000 linhas, compra autoritativa via transação, Regra #10 assets locais).
 * @dependencies @prisma/client, @etheria/database (I18nCache, SnapshotManager), ./AssetMirrorService.js
 */

import { PrismaClient } from '@prisma/client';
import { I18nCache, SnapshotManager } from '@etheria/database';
import { AssetMirrorService } from './AssetMirrorService.js';

export interface ShopCatalogEntryDto {
  entryType: 'ITEM' | 'EQUIPMENT';
  targetId: number;
  priceGold: number;
  currencyType?: 'GOLD' | 'DIAMOND';
  requiredLevel?: number;
  maxBatchBuy?: number;
}

export interface SaveShopTemplateDto {
  id?: number;
  namePtBr: string;
  descriptionPtBr?: string | null;
  catalogJson?: ShopCatalogEntryDto[];
  isActive?: boolean;
}

interface CatalogMeta {
  id: number;
  code: string;
  namePtBr: string;
  iconUrl: string;
  subType: string;
  rarity: string;
  requiredLevel: number;
  defaultPriceGold: number;
  isEquipment: boolean;
}

export class AdminShopsController {
  private readonly prisma: PrismaClient;
  private readonly snapshotManager: SnapshotManager;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.snapshotManager = new SnapshotManager(prisma);
  }

  private resolveIconUrl(rawKey?: string | null): string {
    if (!rawKey) return '/play/assets/hud/menu_shop.png';
    return AssetMirrorService.toSameOriginUrl(String(rawKey).trim()) || '/play/assets/hud/menu_shop.png';
  }

  private sanitizeCatalog(raw: unknown): ShopCatalogEntryDto[] {
    if (!Array.isArray(raw)) return [];
    const seen = new Set<string>();
    const out: ShopCatalogEntryDto[] = [];

    for (const entry of raw) {
      if (!entry || typeof entry !== 'object') continue;
      const e = entry as Record<string, unknown>;
      const entryType = String(e.entryType || 'ITEM').toUpperCase() === 'EQUIPMENT' ? 'EQUIPMENT' : 'ITEM';
      const targetId = Math.round(Number(e.targetId) || 0);
      if (targetId <= 0) continue;

      const dedupKey = `${entryType}_${targetId}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);

      const priceGold = Math.max(0, Math.round(Number(e.priceGold) || 0));
      const currencyType = String(e.currencyType || 'GOLD').toUpperCase() === 'DIAMOND' ? 'DIAMOND' : 'GOLD';
      const requiredLevel = Math.max(1, Math.round(Number(e.requiredLevel) || 1));
      const maxBatchBuy = entryType === 'EQUIPMENT' ? 1 : Math.max(1, Math.min(999, Math.round(Number(e.maxBatchBuy) || 99)));

      out.push({
        entryType,
        targetId,
        priceGold,
        currencyType,
        requiredLevel,
        maxBatchBuy,
      });
    }

    return out;
  }

  public async getShopTemplates() {
    const [i18nMap, shops, allItems] = await Promise.all([
      I18nCache.getTranslations(this.prisma, 'pt-BR'),
      this.prisma.shopTemplate.findMany({
        orderBy: { id: 'asc' },
        include: {
          npcs: true,
        },
      }),
      this.prisma.itemTemplate.findMany({
        select: {
          id: true,
          code: true,
          nameI18nKey: true,
          mcreworkIconKey: true,
          itemCategory: true,
          equipmentSlotCode: true,
          rarityTier: true,
          requiredLevel: true,
          priceGold: true,
        },
      }),
    ]);

    const itemMetaMap = new Map<number, CatalogMeta>();
    for (const item of allItems) {
      const isEquipment = item.itemCategory === 'CHARACTER_EQUIPMENT' || item.itemCategory === 'PET_EQUIPMENT';
      itemMetaMap.set(item.id, {
        id: item.id,
        code: item.code,
        namePtBr: i18nMap.get(item.nameI18nKey) ?? item.code,
        iconUrl: this.resolveIconUrl(item.mcreworkIconKey),
        subType: item.equipmentSlotCode || item.itemCategory,
        rarity: item.rarityTier || 'COMMON',
        requiredLevel: item.requiredLevel || 1,
        defaultPriceGold: item.priceGold || 0,
        isEquipment,
      });
    }

    return shops.map((s) => {
      const rawCatalog = this.sanitizeCatalog(s.catalogJson);
      const enrichedCatalog = rawCatalog.map((entry) => {
        const meta = itemMetaMap.get(entry.targetId);
        return {
          ...entry,
          namePtBr: meta?.namePtBr ?? `${entry.entryType === 'EQUIPMENT' ? 'Equipamento' : 'Item'} #${entry.targetId}`,
          code: meta?.code ?? `#${entry.targetId}`,
          iconUrl: meta?.iconUrl ?? '/play/assets/hud/menu_shop.png',
          subType: meta?.subType ?? entry.entryType,
          rarity: meta?.rarity ?? 'COMMON',
          defaultPriceGold: meta?.defaultPriceGold ?? 0,
          exists: Boolean(meta),
        };
      });

      return {
        id: s.id,
        code: s.code,
        namePtBr: s.namePtBr,
        descriptionPtBr: s.descriptionPtBr || '',
        catalogJson: enrichedCatalog,
        isActive: s.isActive,
        linkedNpcs: (s.npcs || []).map((n: any) => ({
          id: n.id,
          code: n.code,
          mcreworkNpcKey: n.mcreworkNpcKey,
          namePtBr: i18nMap.get(n.nameI18nKey) ?? n.code,
        })),
      };
    });
  }

  public async createShopTemplate(dto: SaveShopTemplateDto) {
    const cleanName = String(dto.namePtBr || '').trim();
    if (!cleanName) {
      throw new Error('Informe o Nome da Loja.');
    }

    await SnapshotManager.syncTableSequence(this.prisma, 'shop_templates');
    const catalogJson = this.sanitizeCatalog(dto.catalogJson);
    const isActive = dto.isActive !== undefined ? Boolean(dto.isActive) : true;
    const descriptionPtBr = dto.descriptionPtBr ? String(dto.descriptionPtBr).trim() : '';

    let createdId = 0;
    await this.prisma.$transaction(async (tx) => {
      const tempCode = `shop_pending_${Date.now()}`;
      const created = await tx.shopTemplate.create({
        data: {
          code: tempCode,
          namePtBr: cleanName,
          descriptionPtBr,
          catalogJson: catalogJson as any,
          isActive,
        },
      });
      const autoCode = `shop_${created.id}`;
      await tx.shopTemplate.update({
        where: { id: created.id },
        data: { code: autoCode },
      });
      createdId = created.id;
    });

    await this.snapshotManager.exportToDisk();
    const all = await this.getShopTemplates();
    return all.find((s: any) => s.id === createdId) || all[all.length - 1];
  }

  public async updateShopTemplate(id: number, dto: SaveShopTemplateDto) {
    const existing = await this.prisma.shopTemplate.findUnique({ where: { id } });
    if (!existing) {
      throw new Error(`Loja #${id} não encontrada.`);
    }

    const cleanName = dto.namePtBr !== undefined ? String(dto.namePtBr).trim() : existing.namePtBr;
    if (!cleanName) {
      throw new Error('O Nome da Loja não pode ficar vazio.');
    }

    const catalogJson = dto.catalogJson !== undefined ? this.sanitizeCatalog(dto.catalogJson) : this.sanitizeCatalog(existing.catalogJson);
    const isActive = dto.isActive !== undefined ? Boolean(dto.isActive) : existing.isActive;
    const descriptionPtBr = dto.descriptionPtBr !== undefined ? String(dto.descriptionPtBr || '').trim() : (existing.descriptionPtBr || '');

    await this.prisma.shopTemplate.update({
      where: { id },
      data: {
        code: `shop_${id}`,
        namePtBr: cleanName,
        descriptionPtBr,
        catalogJson: catalogJson as any,
        isActive,
      },
    });

    await this.snapshotManager.exportToDisk();
    const all = await this.getShopTemplates();
    return all.find((s: any) => s.id === id);
  }

  public async deleteShopTemplate(id: number) {
    const existing = await this.prisma.shopTemplate.findUnique({
      where: { id },
      include: { npcs: true },
    });
    if (!existing) {
      throw new Error(`Loja #${id} não encontrada.`);
    }

    await this.prisma.$transaction(async (tx) => {
      for (const npc of existing.npcs || []) {
        const curRoles = Array.isArray(npc.rolesJson) ? (npc.rolesJson as string[]) : [];
        const nextRoles = curRoles.filter((r) => r !== 'SHOP');
        await tx.npcTemplate.update({
          where: { id: npc.id },
          data: {
            shopTemplateId: null,
            rolesJson: nextRoles as any,
          },
        });
      }
      await tx.shopTemplate.delete({ where: { id } });
    });

    await this.snapshotManager.exportToDisk();
    return { deletedId: id };
  }
}
