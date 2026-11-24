/**
 * @file apps/server/src/controllers/DungeonChestService.ts
 * @module @etheria/server/controllers/DungeonChestService
 * @description Serviço autoritativo para Baús de Recompensa de Dungeons (Comum 75%, Épico 20%, Lendário 5%).
 *   - Semeia automaticamente os 3 baús padrão na tabela `dungeon_chest_configs`.
 *   - Permite configuração completa pelo /admin (chance de spawn, tamanho/offset no mapa, faixas ponderadas
 *     de Ouro e XP, e lista de drops de itens/equipamentos com min/max e chance %).
 *   - Sorteia a raridade do baú no servidor ao eliminar o último monstro da Dungeon e concede as recompensas
 *     ao clicar para abrir o baú (além das recompensas naturais de XP, Ouro e drops dos monstros).
 */

import type * as http from 'node:http';
import { PrismaClient, SnapshotManager, I18nCache } from '@etheria/database';
import { CharacterInventoryService } from './CharacterInventoryService.js';
import { AssetMirrorService } from './AssetMirrorService.js';
import type { TemporaryCombatController } from './TemporaryCombatController.js';

export interface WeightedRangeTierDto {
  min: number;
  max: number;
  chancePct: number;
}

export interface ChestItemDropRuleDto {
  itemTemplateId: number;
  minQty: number;
  maxQty: number;
  chancePct: number;
}

export interface DungeonChestSpawnDto {
  rarityCode: string;
  namePtBr: string;
  imageUrl: string;
  visualScale: number;
  visualOffsetX: number;
  visualOffsetY: number;
  glowColorHex: string;
  x: number;
  y: number;
}

export interface GrantedChestRewardsDto {
  rarityCode: string;
  namePtBr: string;
  imageUrl: string;
  glowColorHex: string;
  gold: number;
  exp: number;
  items: Array<{ itemTemplateId: number; namePtBr: string; iconUrl: string; quantity: number }>;
}

const RARITY_ORDER: Record<string, number> = { COMMON: 1, EPIC: 2, LEGENDARY: 3 };

export class DungeonChestService {
  private static seeded = false;

  public static getDefaultChests() {
    return [
      {
        rarityCode: 'COMMON',
        namePtBr: 'Baú Comum',
        imageUrl: '/play/assets/dungeon/chest_common.png',
        spawnChancePct: 75,
        visualScale: 0.36,
        visualOffsetX: 0,
        visualOffsetY: -10,
        glowColorHex: '#38bdf8',
        goldRewardsJson: [
          { min: 150, max: 350, chancePct: 70 },
          { min: 450, max: 750, chancePct: 30 },
        ],
        xpRewardsJson: [{ min: 120, max: 280, chancePct: 100 }],
        itemDropsJson: [],
        isActive: true,
      },
      {
        rarityCode: 'EPIC',
        namePtBr: 'Baú Épico',
        imageUrl: '/play/assets/dungeon/chest_epic.png',
        spawnChancePct: 20,
        visualScale: 0.39,
        visualOffsetX: 0,
        visualOffsetY: -12,
        glowColorHex: '#c084fc',
        goldRewardsJson: [
          { min: 600, max: 1200, chancePct: 70 },
          { min: 1800, max: 3000, chancePct: 30 },
        ],
        xpRewardsJson: [{ min: 400, max: 900, chancePct: 100 }],
        itemDropsJson: [],
        isActive: true,
      },
      {
        rarityCode: 'LEGENDARY',
        namePtBr: 'Baú Lendário',
        imageUrl: '/play/assets/dungeon/chest_legendary.png',
        spawnChancePct: 5,
        visualScale: 0.43,
        visualOffsetX: 0,
        visualOffsetY: -14,
        glowColorHex: '#fbbf24',
        goldRewardsJson: [
          { min: 1000, max: 1000, chancePct: 70 },
          { min: 10000, max: 10000, chancePct: 30 },
        ],
        xpRewardsJson: [{ min: 1200, max: 3000, chancePct: 100 }],
        itemDropsJson: [],
        isActive: true,
      },
    ];
  }

  public static async ensureDefaultChestsSeeded(prisma: PrismaClient): Promise<void> {
    if (this.seeded) return;
    try {
      const defaults = this.getDefaultChests();
      for (const d of defaults) {
        await (prisma as any).dungeonChestConfig.upsert({
          where: { rarityCode: d.rarityCode },
          update: {},
          create: d,
        });
      }
      this.seeded = true;
    } catch (err) {
      console.warn('[DungeonChestService] Aviso ao semear baús padrão:', err);
    }
  }

  private static sanitizeTiers(raw: unknown): WeightedRangeTierDto[] {
    if (!Array.isArray(raw)) return [];
    const out: WeightedRangeTierDto[] = [];
    for (const row of raw) {
      if (!row || typeof row !== 'object') continue;
      const min = Math.max(0, Math.round(Number((row as any).min) || 0));
      const max = Math.max(min, Math.round(Number((row as any).max) || min));
      const chancePct = Math.max(0, Math.min(100, Number((row as any).chancePct) || 0));
      if (chancePct > 0) out.push({ min, max, chancePct });
    }
    return out;
  }

  private static sanitizeItemDrops(raw: unknown): ChestItemDropRuleDto[] {
    if (!Array.isArray(raw)) return [];
    const out: ChestItemDropRuleDto[] = [];
    for (const row of raw) {
      if (!row || typeof row !== 'object') continue;
      const itemTemplateId = Math.round(Number((row as any).itemTemplateId) || 0);
      if (itemTemplateId <= 0) continue;
      const minQty = Math.max(1, Math.round(Number((row as any).minQty) || 1));
      const maxQty = Math.max(minQty, Math.round(Number((row as any).maxQty) || minQty));
      const chancePct = Math.max(0.01, Math.min(100, Number((row as any).chancePct) || 0));
      out.push({ itemTemplateId, minQty, maxQty, chancePct });
    }
    return out;
  }

  public static rollWeightedNumericReward(rawTiers: unknown): number {
    const tiers = this.sanitizeTiers(rawTiers);
    if (tiers.length === 0) return 0;
    const totalWeight = tiers.reduce((acc, t) => acc + t.chancePct, 0);
    if (totalWeight <= 0) return 0;
    const pool = Math.max(100, totalWeight);
    let roll = Math.random() * pool;
    for (const t of tiers) {
      roll -= t.chancePct;
      if (roll <= 0) {
        const lo = Math.min(t.min, t.max);
        const hi = Math.max(t.min, t.max);
        return lo + Math.floor(Math.random() * (hi - lo + 1));
      }
    }
    return 0;
  }

  public static async listAdminPayload(prisma: PrismaClient) {
    await this.ensureDefaultChestsSeeded(prisma);
    const [chestsRaw, itemsRaw, i18nMap] = await Promise.all([
      (prisma as any).dungeonChestConfig.findMany({ orderBy: { id: 'asc' } }),
      prisma.itemTemplate.findMany({
        select: { id: true, code: true, nameI18nKey: true, itemCategory: true, rarityTier: true, mcreworkIconKey: true, equipmentSlotCode: true },
        orderBy: [{ itemCategory: 'asc' }, { id: 'asc' }],
      }),
      I18nCache.getTranslations(prisma, 'pt-BR'),
    ]);

    const chests = (chestsRaw as any[]).sort(
      (a, b) => (RARITY_ORDER[a.rarityCode] || 99) - (RARITY_ORDER[b.rarityCode] || 99)
    );
    const itemsCatalog = itemsRaw.map((it) => ({
      id: it.id,
      code: it.code,
      namePtBr: i18nMap.get(it.nameI18nKey) || it.code,
      itemCategory: it.itemCategory,
      rarityTier: it.rarityTier,
      equipmentSlotCode: it.equipmentSlotCode,
      iconUrl: AssetMirrorService.toSameOriginUrl(it.mcreworkIconKey),
    }));

    return { chests, itemsCatalog };
  }

  public static async updateChestConfig(
    prisma: PrismaClient,
    snapshotManager: SnapshotManager | undefined,
    id: number,
    dto: Record<string, unknown>
  ) {
    await this.ensureDefaultChestsSeeded(prisma);
    const existing = await (prisma as any).dungeonChestConfig.findUnique({ where: { id: Number(id) } });
    if (!existing) throw new Error(`Configuração de Baú #${id} não encontrada.`);

    const spawnChancePct =
      dto.spawnChancePct !== undefined
        ? Math.max(0, Math.min(100, Number(dto.spawnChancePct) || 0))
        : existing.spawnChancePct;
    const visualScale =
      dto.visualScale !== undefined
        ? Math.max(0.1, Math.min(2.0, Number(dto.visualScale) || 0.36))
        : existing.visualScale;
    const visualOffsetX =
      dto.visualOffsetX !== undefined
        ? Math.max(-200, Math.min(200, Math.round(Number(dto.visualOffsetX) || 0)))
        : existing.visualOffsetX;
    const visualOffsetY =
      dto.visualOffsetY !== undefined
        ? Math.max(-200, Math.min(200, Math.round(Number(dto.visualOffsetY) || 0)))
        : existing.visualOffsetY;

    const updated = await (prisma as any).dungeonChestConfig.update({
      where: { id: Number(id) },
      data: {
        namePtBr: dto.namePtBr !== undefined ? String(dto.namePtBr).trim() || existing.namePtBr : existing.namePtBr,
        imageUrl: dto.imageUrl !== undefined ? String(dto.imageUrl).trim() || existing.imageUrl : existing.imageUrl,
        spawnChancePct,
        visualScale,
        visualOffsetX,
        visualOffsetY,
        glowColorHex:
          dto.glowColorHex !== undefined
            ? String(dto.glowColorHex).trim() || existing.glowColorHex
            : existing.glowColorHex,
        goldRewardsJson: dto.goldRewardsJson !== undefined ? this.sanitizeTiers(dto.goldRewardsJson) : existing.goldRewardsJson,
        xpRewardsJson: dto.xpRewardsJson !== undefined ? this.sanitizeTiers(dto.xpRewardsJson) : existing.xpRewardsJson,
        itemDropsJson: dto.itemDropsJson !== undefined ? this.sanitizeItemDrops(dto.itemDropsJson) : existing.itemDropsJson,
        isActive: dto.isActive !== undefined ? Boolean(dto.isActive) : existing.isActive,
      },
    });

    if (snapshotManager) {
      await snapshotManager.exportToDisk().catch(() => {});
    }
    return updated;
  }

  public static async rollChestForBattle(
    prisma: PrismaClient,
    combatController: TemporaryCombatController,
    battleId: string,
    x: number,
    y: number
  ): Promise<DungeonChestSpawnDto> {
    await this.ensureDefaultChestsSeeded(prisma);
    const battle = combatController.getBattleState(battleId);
    if (!battle || !battle.isDungeon) {
      throw new Error('Batalha de Dungeon não encontrada.');
    }
    if (battle.dungeonChest) {
      return battle.dungeonChest as DungeonChestSpawnDto;
    }

    const activeChests = (await (prisma as any).dungeonChestConfig.findMany({
      where: { isActive: true },
      orderBy: { id: 'asc' },
    })) as any[];

    const poolList = activeChests.length > 0 ? activeChests : this.getDefaultChests();
    const totalWeight = poolList.reduce((acc, c) => acc + Math.max(0, Number(c.spawnChancePct) || 0), 0);
    let chosen = poolList[0];
    if (totalWeight > 0) {
      let roll = Math.random() * totalWeight;
      for (const c of poolList) {
        roll -= Math.max(0, Number(c.spawnChancePct) || 0);
        if (roll <= 0) {
          chosen = c;
          break;
        }
      }
    }

    const spawned: DungeonChestSpawnDto = {
      rarityCode: String(chosen.rarityCode || 'COMMON'),
      namePtBr: String(chosen.namePtBr || 'Baú Comum'),
      imageUrl: String(chosen.imageUrl || '/play/assets/dungeon/chest_common.png'),
      visualScale: Number(chosen.visualScale) || 0.36,
      visualOffsetX: Number(chosen.visualOffsetX) || 0,
      visualOffsetY: Number(chosen.visualOffsetY) ?? -10,
      glowColorHex: String(chosen.glowColorHex || '#38bdf8'),
      x: Math.round(Number(x) || battle.playerStartX || 500),
      y: Math.round(Number(y) || battle.playerStartY || 500),
    };
    battle.dungeonChest = spawned;
    return spawned;
  }

  /**
   * Sorteia e entrega os itens do Baú de Dungeon (retornando também Ouro e XP extras para somar à vitória).
   */
  public static async rollAndGrantChestItems(
    prisma: PrismaClient,
    characterId: number,
    chestSpawn: DungeonChestSpawnDto | null | undefined
  ): Promise<GrantedChestRewardsDto | null> {
    if (!chestSpawn) return null;
    await this.ensureDefaultChestsSeeded(prisma);

    const cfg = await (prisma as any).dungeonChestConfig.findUnique({
      where: { rarityCode: chestSpawn.rarityCode },
    });
    if (!cfg) return null;

    const gold = this.rollWeightedNumericReward(cfg.goldRewardsJson);
    const exp = this.rollWeightedNumericReward(cfg.xpRewardsJson);
    const dropRules = this.sanitizeItemDrops(cfg.itemDropsJson);

    const wonDrops: Array<{ itemTemplateId: number; quantity: number }> = [];
    for (const rule of dropRules) {
      if (Math.random() * 100 < rule.chancePct) {
        const qty = rule.minQty + Math.floor(Math.random() * (rule.maxQty - rule.minQty + 1));
        if (qty > 0) wonDrops.push({ itemTemplateId: rule.itemTemplateId, quantity: qty });
      }
    }

    const grantedItems: GrantedChestRewardsDto['items'] = [];
    if (wonDrops.length > 0) {
      const [templates, i18nMap] = await Promise.all([
        prisma.itemTemplate.findMany({ where: { id: { in: wonDrops.map((w) => w.itemTemplateId) } } }),
        I18nCache.getTranslations(prisma, 'pt-BR'),
      ]);
      const tplById = new Map(templates.map((t) => [t.id, t]));

      for (const drop of wonDrops) {
        const tpl = tplById.get(drop.itemTemplateId);
        if (!tpl) continue;
        try {
          await prisma.$transaction(async (tx) => {
            await CharacterInventoryService.addItem(tx, characterId, tpl.id, drop.quantity);
          });
          grantedItems.push({
            itemTemplateId: tpl.id,
            namePtBr: i18nMap.get(tpl.nameI18nKey) || tpl.code,
            iconUrl: AssetMirrorService.toSameOriginUrl(tpl.mcreworkIconKey),
            quantity: drop.quantity,
          });
        } catch (err) {
          console.warn(`[DungeonChestService] Mochila cheia ou erro ao entregar item #${tpl.id}:`, err);
        }
      }
    }

    return {
      rarityCode: String(cfg.rarityCode),
      namePtBr: String(cfg.namePtBr),
      imageUrl: String(cfg.imageUrl),
      glowColorHex: String(cfg.glowColorHex || '#38bdf8'),
      gold,
      exp,
      items: grantedItems,
    };
  }

  public static async handleAdminRoutes(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    pathname: string,
    method: string,
    prisma: PrismaClient,
    snapshotManager: SnapshotManager | undefined,
    sendJson: (res: http.ServerResponse, statusCode: number, data: unknown) => void,
    readJsonBody: <T = any>(req: http.IncomingMessage) => Promise<T>,
    enforcePermission?: (mode: 'READ' | 'READ_WRITE') => boolean
  ): Promise<boolean> {
    if (pathname === '/api/admin/dungeon-chests' && method === 'GET') {
      if (enforcePermission && !enforcePermission('READ')) return true;
      sendJson(res, 200, await this.listAdminPayload(prisma));
      return true;
    }
    const putMatch = pathname.match(/^\/api\/admin\/dungeon-chests\/(\d+)$/);
    if (putMatch && method === 'PUT') {
      if (enforcePermission && !enforcePermission('READ_WRITE')) return true;
      const dto = await readJsonBody<Record<string, unknown>>(req);
      sendJson(res, 200, await this.updateChestConfig(prisma, snapshotManager, Number(putMatch[1]), dto));
      return true;
    }
    return false;
  }

  public static async handlePlayRoutes(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    pathname: string,
    method: string,
    userAccountId: number,
    userRole: string,
    prisma: PrismaClient,
    combatController: TemporaryCombatController,
    verifyCharacterOwnership: (userAccountId: number, role: string, charId: number) => Promise<boolean>,
    sendJson: (res: http.ServerResponse, statusCode: number, data: unknown) => void,
    readJsonBody: <T = any>(req: http.IncomingMessage) => Promise<T>
  ): Promise<boolean> {
    if (pathname === '/api/play/dungeon/spawn-chest' && method === 'POST') {
      const body = await readJsonBody<{ battleId: string; x?: number; y?: number }>(req);
      const battle = combatController.getBattleState(String(body.battleId || ''));
      if (!battle || !battle.isDungeon) {
        sendJson(res, 404, { error: 'Instância de Dungeon não encontrada.' });
        return true;
      }
      if (!(await verifyCharacterOwnership(userAccountId, userRole, Number(battle.characterId) || 0))) {
        sendJson(res, 403, { error: 'Acesso negado.' });
        return true;
      }
      const chest = await this.rollChestForBattle(
        prisma,
        combatController,
        String(body.battleId),
        Number(body.x),
        Number(body.y)
      );
      sendJson(res, 200, { ok: true, chest });
      return true;
    }
    return false;
  }
}
