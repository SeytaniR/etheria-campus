/**
 * @file apps/server/src/controllers/AdminFishingRodsController.ts
 * @module @etheria/server
 * @description Controlador CRUD dedicado às Varas de Pesca (`item_templates` com `itemCategory = 'FISHING_ROD'`)
 *   na Rota `/admin`. Varas de pesca NÃO concedem atributos de combate; controlam tempo de ciclo (`T`),
 *   chance de fisgada (%) e pesos de raridade de peixes (`F..SS`), exigindo nível mínimo padrão 50.
 * @rules Segue estritamente AGENTS.md (Regra #1 JSDoc, Regra #6 auto-incremento `rod_N`, Regra #7 < 1.000 linhas, Regra #10 espelhamento local).
 * @dependencies @prisma/client, @etheria/database (SnapshotManager), ./AssetMirrorService.js
 */

import { PrismaClient } from '@prisma/client';
import { SnapshotManager } from '@etheria/database';
import { AssetMirrorService } from './AssetMirrorService.js';

export const FISHING_RANKS = ['F', 'D', 'C', 'B', 'A', 'S', 'SS'] as const;
export type FishingRankTier = (typeof FISHING_RANKS)[number];

export interface FishingRodConfig {
  castIntervalSec: number;
  catchChancePct: number;
  rankWeights: Record<FishingRankTier, number>;
}

export const DEFAULT_FISHING_ROD_CONFIG: FishingRodConfig = {
  castIntervalSec: 10,
  catchChancePct: 65,
  rankWeights: {
    F: 45,
    D: 25,
    C: 15,
    B: 8,
    A: 4.5,
    S: 2,
    SS: 0.5,
  },
};

export interface FishingRodDto {
  code?: string;
  namePtBr: string;
  descriptionPtBr?: string;
  mcreworkIconKey?: string;
  rarityTier?: string;
  requiredLevel?: number;
  isTradable?: boolean;
  priceGold?: number;
  fishingRodConfig?: Partial<FishingRodConfig>;
  isActive?: boolean;
}

export function normalizeFishingRodConfig(raw: unknown): FishingRodConfig {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const rawInterval = Number(src.castIntervalSec);
  const castIntervalSec = Number.isFinite(rawInterval)
    ? Math.max(2, Math.min(120, Math.round(rawInterval * 10) / 10))
    : DEFAULT_FISHING_ROD_CONFIG.castIntervalSec;

  const rawCatch = Number(src.catchChancePct);
  const catchChancePct = Number.isFinite(rawCatch)
    ? Math.max(1, Math.min(100, Math.round(rawCatch * 10) / 10))
    : DEFAULT_FISHING_ROD_CONFIG.catchChancePct;

  const srcWeights =
    src.rankWeights && typeof src.rankWeights === 'object'
      ? (src.rankWeights as Record<string, unknown>)
      : {};

  const rankWeights: Record<FishingRankTier, number> = {
    F: 0,
    D: 0,
    C: 0,
    B: 0,
    A: 0,
    S: 0,
    SS: 0,
  };

  let sum = 0;
  for (const r of FISHING_RANKS) {
    const val = Number(srcWeights[r]);
    const clean = Number.isFinite(val) && val >= 0 ? Math.min(1000, Math.round(val * 100) / 100) : DEFAULT_FISHING_ROD_CONFIG.rankWeights[r];
    rankWeights[r] = clean;
    sum += clean;
  }
  if (sum <= 0) {
    rankWeights.F = DEFAULT_FISHING_ROD_CONFIG.rankWeights.F;
    rankWeights.D = DEFAULT_FISHING_ROD_CONFIG.rankWeights.D;
    rankWeights.C = DEFAULT_FISHING_ROD_CONFIG.rankWeights.C;
    rankWeights.B = DEFAULT_FISHING_ROD_CONFIG.rankWeights.B;
    rankWeights.A = DEFAULT_FISHING_ROD_CONFIG.rankWeights.A;
    rankWeights.S = DEFAULT_FISHING_ROD_CONFIG.rankWeights.S;
    rankWeights.SS = DEFAULT_FISHING_ROD_CONFIG.rankWeights.SS;
  }

  return { castIntervalSec, catchChancePct, rankWeights };
}

export class AdminFishingRodsController {
  private readonly prisma: PrismaClient;
  private readonly snapshotManager: SnapshotManager;
  private readonly mcreworkRawBaseUrl = 'https://raw.githubusercontent.com/SeytaniR/mcrework/main/web';
  private readonly mcreworkPagesBaseUrl = 'https://seytanir.github.io/mcrework';
  private cachedMcreworkRods: any[] | null = null;
  private readonly assetMirrorService?: AssetMirrorService;

  constructor(prisma: PrismaClient, assetMirrorService?: AssetMirrorService) {
    this.prisma = prisma;
    this.snapshotManager = new SnapshotManager(prisma);
    this.assetMirrorService = assetMirrorService;
  }

  /**
   * Busca e cacheia as varas de pesca (`type === 1201`) do catálogo do `mcrework`.
   */
  public async getMcreworkFishingRodsCatalog() {
    if (this.cachedMcreworkRods) return this.cachedMcreworkRods;
    try {
      const res = await fetch(`${this.mcreworkRawBaseUrl}/assets/equipment/catalog.json`);
      if (!res.ok) {
        throw new Error(`Falha ao ler catálogo de equipamentos do mcrework (${res.status})`);
      }
      const data: any = await res.json();
      const items = Array.isArray(data?.items) ? data.items : [];
      const rods = items
        .filter((it: any) => Number(it.type) === 1201)
        .map((it: any) => {
          const cleanIcon = String(it.icon || 'assets/equipment/icons/equip_normal_600001.png').replace(/^\/+/, '');
          return {
            id: it.id,
            name: it.name,
            description: it.description || '',
            reqLevel: Math.max(50, Number(it.req_level) || 50),
            quality: it.quality || 'Comum',
            mcreworkIconKey: cleanIcon,
            iconUrl: `${this.mcreworkPagesBaseUrl}/${cleanIcon}`,
          };
        });
      this.cachedMcreworkRods = rods;
      return rods;
    } catch (err) {
      console.error('Erro ao buscar catálogo de varas de pesca do mcrework:', err);
      return [];
    }
  }

  /**
   * Lista todas as Varas de Pesca cadastradas em `item_templates`.
   */
  public async getFishingRods() {
    const items = await this.prisma.itemTemplate.findMany({
      where: {
        OR: [{ itemCategory: 'FISHING_ROD' }, { equipmentSlotCode: 'FISHING_ROD' }],
      },
      orderBy: [{ requiredLevel: 'asc' }, { id: 'asc' }],
    });

    const i18nKeys = items.flatMap((i) => [i.nameI18nKey, i.descriptionI18nKey]);
    const translations = await this.prisma.i18nTranslation.findMany({
      where: { key: { in: i18nKeys }, locale: 'pt-BR' },
    });
    const transMap = new Map(translations.map((t) => [t.key, t.text]));

    return items.map((item) => {
      const iconKey = item.mcreworkIconKey || 'assets/equipment/icons/equip_normal_600001.png';
      const spec = (item.specialEffectJson && typeof item.specialEffectJson === 'object' ? item.specialEffectJson : {}) as any;
      return {
        id: item.id,
        code: item.code,
        namePtBr: transMap.get(item.nameI18nKey) || item.code,
        descriptionPtBr: transMap.get(item.descriptionI18nKey) || '',
        mcreworkIconKey: item.mcreworkIconKey,
        iconUrl: AssetMirrorService.toSameOriginUrl(iconKey),
        itemCategory: 'FISHING_ROD',
        equipmentSlotCode: 'FISHING_ROD',
        rarityTier: item.rarityTier || 'COMMON',
        requiredLevel: item.requiredLevel ?? 50,
        isTradable: item.isTradable !== false,
        priceGold: item.priceGold ?? 0,
        fishingRodConfig: normalizeFishingRodConfig(spec.fishingRodConfig),
        isActive: item.isActive,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
    });
  }

  private async resolveNextRodCode(requestedCode?: string): Promise<string> {
    if (requestedCode && requestedCode.trim()) {
      const clean = requestedCode.trim();
      const collision = await this.prisma.itemTemplate.findUnique({ where: { code: clean }, select: { id: true } });
      if (collision) {
        throw new Error(`Já existe outro item/vara com o código "${clean}".`);
      }
      return clean;
    }

    const existing = await this.prisma.itemTemplate.findMany({
      where: {
        OR: [{ itemCategory: 'FISHING_ROD' }, { code: { startsWith: 'rod_' } }],
      },
      select: { code: true },
    });
    let maxNum = 0;
    for (const row of existing) {
      const m = String(row.code || '').match(/^rod_(\d+)$/i);
      if (m) maxNum = Math.max(maxNum, Number(m[1]) || 0);
    }
    let next = maxNum + 1;
    while (await this.prisma.itemTemplate.findUnique({ where: { code: `rod_${next}` }, select: { id: true } })) {
      next++;
    }
    return `rod_${next}`;
  }

  /**
   * Cadastra uma nova Vara de Pesca sem atributos de combate.
   */
  public async createFishingRod(dto: FishingRodDto) {
    if (!dto.namePtBr || !dto.namePtBr.trim()) {
      throw new Error('O nome da vara de pesca em português é obrigatório.');
    }

    await SnapshotManager.syncTableSequence(this.prisma, 'i18n_translations');
    await SnapshotManager.syncTableSequence(this.prisma, 'item_templates');

    const cleanName = dto.namePtBr.trim();
    const code = await this.resolveNextRodCode(dto.code);
    const nameI18nKey = `item.${code}.name`;
    const descI18nKey = `item.${code}.desc`;
    const isTradable = dto.isTradable !== false;
    const priceGold = isTradable ? Math.max(0, Math.round(Number(dto.priceGold) || 0)) : 0;
    const requiredLevel = Math.max(1, Math.min(9999, Math.round(Number(dto.requiredLevel ?? 50) || 50)));
    const rodConfig = normalizeFishingRodConfig(dto.fishingRodConfig);
    const iconKey = (dto.mcreworkIconKey || 'assets/equipment/icons/equip_normal_600001.png').trim();

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
        mcreworkIconKey: iconKey,
        itemCategory: 'FISHING_ROD',
        equipmentSlotCode: 'FISHING_ROD',
        rarityTier: String(dto.rarityTier || 'COMMON'),
        requiredLevel,
        isTradable,
        priceGold,
        maxStack: 1,
        cooldownSec: 0,
        targetType: 'NONE',
        effectType: null,
        effectValue: 0,
        reqClassCodesJson: [],
        baseStatBonusesJson: {},
        combatStatBonusesJson: {},
        specialEffectJson: { fishingRodConfig: rodConfig } as any,
        isActive: dto.isActive !== undefined ? Boolean(dto.isActive) : true,
      },
    });

    await this.snapshotManager.exportToDisk();
    if (this.assetMirrorService && created.mcreworkIconKey) {
      await this.assetMirrorService.mirrorItemIcon(created.mcreworkIconKey);
    }
    return created;
  }

  /**
   * Atualiza uma Vara de Pesca existente mantendo zero atributos de combate.
   */
  public async updateFishingRod(id: number, dto: Partial<FishingRodDto>) {
    const existing = await this.prisma.itemTemplate.findUnique({ where: { id } });
    if (!existing || (existing.itemCategory !== 'FISHING_ROD' && existing.equipmentSlotCode !== 'FISHING_ROD')) {
      throw new Error(`Vara de pesca #${id} não encontrada.`);
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

    const oldSpec = (existing.specialEffectJson && typeof existing.specialEffectJson === 'object' ? existing.specialEffectJson : {}) as any;
    const isTradable = dto.isTradable !== undefined ? dto.isTradable !== false : existing.isTradable !== false;
    const priceGold = isTradable
      ? Math.max(0, Math.round(Number(dto.priceGold !== undefined ? dto.priceGold : existing.priceGold) || 0))
      : 0;
    const requiredLevel =
      dto.requiredLevel !== undefined
        ? Math.max(1, Math.min(9999, Math.round(Number(dto.requiredLevel) || 50)))
        : existing.requiredLevel;
    const rodConfig =
      dto.fishingRodConfig !== undefined
        ? normalizeFishingRodConfig(dto.fishingRodConfig)
        : normalizeFishingRodConfig(oldSpec.fishingRodConfig);

    const updated = await this.prisma.itemTemplate.update({
      where: { id },
      data: {
        mcreworkIconKey: dto.mcreworkIconKey !== undefined ? dto.mcreworkIconKey : existing.mcreworkIconKey,
        itemCategory: 'FISHING_ROD',
        equipmentSlotCode: 'FISHING_ROD',
        rarityTier: dto.rarityTier !== undefined ? String(dto.rarityTier || 'COMMON') : existing.rarityTier,
        requiredLevel,
        isTradable,
        priceGold,
        maxStack: 1,
        baseStatBonusesJson: {},
        combatStatBonusesJson: {},
        reqClassCodesJson: [],
        specialEffectJson: { ...oldSpec, fishingRodConfig: rodConfig } as any,
        isActive: dto.isActive !== undefined ? Boolean(dto.isActive) : existing.isActive,
      },
    });

    await this.snapshotManager.exportToDisk();
    if (this.assetMirrorService && updated.mcreworkIconKey) {
      await this.assetMirrorService.mirrorItemIcon(updated.mcreworkIconKey);
    }
    return updated;
  }

  /**
   * Exclui uma Vara de Pesca e suas chaves i18n.
   */
  public async deleteFishingRod(id: number) {
    const existing = await this.prisma.itemTemplate.findUnique({ where: { id } });
    if (!existing || (existing.itemCategory !== 'FISHING_ROD' && existing.equipmentSlotCode !== 'FISHING_ROD')) {
      throw new Error(`Vara de pesca #${id} não encontrada.`);
    }
    await this.prisma.itemTemplate.delete({ where: { id } });
    await this.prisma.i18nTranslation.deleteMany({
      where: { key: { in: [existing.nameI18nKey, existing.descriptionI18nKey] } },
    });
    await this.snapshotManager.exportToDisk();
    return { success: true, message: `Vara de pesca #${id} excluída com sucesso.` };
  }
}
