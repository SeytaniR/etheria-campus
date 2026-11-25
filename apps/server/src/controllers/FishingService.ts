/**
 * @file apps/server/src/controllers/FishingService.ts
 * @module @etheria/server
 * @description Motor Autoritário de Pesca Contínua (AFK) no servidor:
 *   - Valida proximidade às áreas de pesca do mapa (`fishingMeshJson`), personagem no chão, fora de combate e vara equipada (`FISHING_ROD`).
 *   - Gerencia sessão contínua com fila ordenada de iscas (`FISHING_BAIT`), consumindo 1 unidade a cada ciclo `T` e avançando para a próxima quando acabar.
 *   - Executa sorteio Rank-First com redistribuição automática entre ranks que possuem peixes cadastrados (`FISH`), aplicando bônus de fisgada e raridade da isca ativa.
 * @rules Segue estritamente AGENTS.md (Cláusula 0 servidor autoritativo, Regra #1 JSDoc, Regra #7 < 1.000 linhas).
 * @dependencies @prisma/client, @etheria/database (I18nCache), @etheria/shared (MapPolygonMesh), ./CharacterInventoryService.js, ./AdminFishingRodsController.js, ./AssetMirrorService.js
 */

import type { PrismaClient } from '@prisma/client';
import { I18nCache } from '@etheria/database';
import { MapPolygonMesh, type MapPolygon } from '@etheria/shared';
import { CharacterInventoryService } from './CharacterInventoryService.js';
import {
  FISHING_RANKS,
  normalizeFishingRodConfig,
  type FishingRankTier,
  type FishingRodConfig,
} from './AdminFishingRodsController.js';
import { AssetMirrorService } from './AssetMirrorService.js';

export const FISHING_PROXIMITY_PX = 96;
export const FISHING_SERVER_PROXIMITY_TOLERANCE_PX = 128;
export const FISHING_TIMER_TOLERANCE_RATIO = 0.88;

export interface FishingBaitConfig {
  catchChanceBonusPct: number;
  rankBonusWeights: Record<FishingRankTier, number>;
}

export interface FishPoolEntry {
  id: number;
  code: string;
  namePtBr: string;
  rarityTier: FishingRankTier;
  iconUrl: string;
}

export interface FishingSessionState {
  characterId: number;
  mapId: number;
  startedAt: number;
  lastCycleAt: number;
  castIntervalSec: number;
  catchChancePct: number;
  rodItemId: number;
  rodNamePtBr: string;
  rodIconUrl: string;
  rodRankWeights: Record<FishingRankTier, number>;
  baitQueue: number[];
  waterPoint: { x: number; y: number };
  caughtCount: number;
  missedCount: number;
  attemptsCount: number;
  tickInFlight: boolean;
}

export function normalizeFishingBaitConfig(raw: unknown): FishingBaitConfig {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const rawBonus = Number(src.catchChanceBonusPct);
  const catchChanceBonusPct = Number.isFinite(rawBonus)
    ? Math.max(0, Math.min(100, Math.round(rawBonus * 10) / 10))
    : 0;
  const srcWeights =
    src.rankBonusWeights && typeof src.rankBonusWeights === 'object'
      ? (src.rankBonusWeights as Record<string, unknown>)
      : {};
  const rankBonusWeights: Record<FishingRankTier, number> = {
    F: 0, D: 0, C: 0, B: 0, A: 0, S: 0, SS: 0,
  };
  for (const r of FISHING_RANKS) {
    const v = Number(srcWeights[r]);
    rankBonusWeights[r] = Number.isFinite(v) && v >= 0 ? Math.min(1000, Math.round(v * 100) / 100) : 0;
  }
  return { catchChanceBonusPct, rankBonusWeights };
}

export function computeEffectiveRankWeights(
  rodWeights: Partial<Record<FishingRankTier, number>>,
  baitBonusWeights?: Partial<Record<FishingRankTier, number>> | null
): Record<FishingRankTier, number> {
  const out: Record<FishingRankTier, number> = { F: 0, D: 0, C: 0, B: 0, A: 0, S: 0, SS: 0 };
  for (const r of FISHING_RANKS) {
    const base = Math.max(0, Number(rodWeights?.[r]) || 0);
    const bonus = Math.max(0, Number(baitBonusWeights?.[r]) || 0);
    out[r] = Math.round((base + bonus) * 1000) / 1000;
  }
  return out;
}

export function pickNextAvailableBait(
  baitQueue: number[],
  inventoryQtyByItemId: Map<number, number>
): number | null {
  if (!Array.isArray(baitQueue)) return null;
  for (const id of baitQueue) {
    const qty = Number(inventoryQtyByItemId.get(Number(id)) || 0);
    if (qty >= 1) return Number(id);
  }
  return null;
}

export function rollFishByRankFirst(
  effectiveWeights: Record<FishingRankTier, number>,
  fishByRank: Map<FishingRankTier, FishPoolEntry[]>,
  rng: () => number = Math.random
): FishPoolEntry | null {
  const availableRanks = FISHING_RANKS.filter((r) => (fishByRank.get(r)?.length ?? 0) > 0);
  if (availableRanks.length === 0) return null;

  let totalWeight = 0;
  for (const r of availableRanks) {
    totalWeight += Math.max(0, Number(effectiveWeights[r]) || 0);
  }

  let chosenRank: FishingRankTier = availableRanks[0];
  if (totalWeight <= 0) {
    chosenRank = availableRanks[Math.floor(rng() * availableRanks.length)] || availableRanks[0];
  } else {
    let roll = rng() * totalWeight;
    for (const r of availableRanks) {
      roll -= Math.max(0, Number(effectiveWeights[r]) || 0);
      if (roll <= 0) {
        chosenRank = r;
        break;
      }
    }
  }

  const pool = fishByRank.get(chosenRank) || [];
  if (pool.length === 0) return null;
  const idx = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
  return pool[idx];
}

function normalizeFishRarity(rawRarity: string | null | undefined): FishingRankTier {
  const upper = String(rawRarity || 'F').trim().toUpperCase();
  if ((FISHING_RANKS as readonly string[]).includes(upper)) return upper as FishingRankTier;
  return 'F';
}

export class FishingService {
  private static readonly activeSessions = new Map<number, FishingSessionState>();

  public static stopSession(characterId: number): boolean {
    return this.activeSessions.delete(Number(characterId));
  }

  public static hasActiveSession(characterId: number): boolean {
    return this.activeSessions.has(Number(characterId));
  }

  private static async loadBaitsInBag(prisma: any, characterId: number, i18nMap: Map<string, string>) {
    const invRows = await prisma.characterInventoryItem.findMany({
      where: {
        characterId: Number(characterId),
        quantity: { gt: 0 },
        itemTemplate: { itemCategory: 'FISHING_BAIT', isActive: true },
      },
      include: { itemTemplate: true },
      orderBy: [{ itemTemplate: { requiredLevel: 'asc' } }, { slotIndex: 'asc' }],
    });

    const merged = new Map<number, any>();
    for (const r of invRows) {
      const it = r.itemTemplate;
      if (!it) continue;
      const spec = (it.specialEffectJson && typeof it.specialEffectJson === 'object' ? it.specialEffectJson : {}) as any;
      const baitCfg = normalizeFishingBaitConfig(spec.fishingBaitConfig);
      const prev = merged.get(it.id);
      if (prev) {
        prev.quantity += Number(r.quantity) || 0;
      } else {
        merged.set(it.id, {
          itemTemplateId: it.id,
          code: it.code,
          namePtBr: i18nMap.get(it.nameI18nKey) || it.code,
          rarityTier: it.rarityTier || 'COMMON',
          iconUrl: AssetMirrorService.toSameOriginUrl(it.mcreworkIconKey || 'assets/items/icons/item_normal_180067.png'),
          quantity: Number(r.quantity) || 0,
          fishingBaitConfig: baitCfg,
        });
      }
    }
    return Array.from(merged.values());
  }

  private static async resolveEquippedRod(prisma: PrismaClient, pc: any, i18nMap: Map<string, string>) {
    const eqMap = (pc?.equippedItemsJson && typeof pc.equippedItemsJson === 'object' ? pc.equippedItemsJson : {}) as Record<string, number>;
    const rodId = Number(eqMap.FISHING_ROD) || 0;
    if (rodId <= 0) return null;
    const rod = await prisma.itemTemplate.findUnique({ where: { id: rodId } });
    if (!rod || !rod.isActive) return null;
    if (rod.itemCategory !== 'FISHING_ROD' && rod.equipmentSlotCode !== 'FISHING_ROD') return null;

    const spec = (rod.specialEffectJson && typeof rod.specialEffectJson === 'object' ? rod.specialEffectJson : {}) as any;
    const cfg: FishingRodConfig = normalizeFishingRodConfig(spec.fishingRodConfig);
    return {
      id: rod.id,
      code: rod.code,
      namePtBr: i18nMap.get(rod.nameI18nKey) || rod.code,
      iconUrl: AssetMirrorService.toSameOriginUrl(rod.mcreworkIconKey || 'assets/equipment/icons/equip_normal_600001.png'),
      rarityTier: rod.rarityTier || 'COMMON',
      requiredLevel: rod.requiredLevel ?? 50,
      fishingRodConfig: cfg,
    };
  }

  public static async getStatus(prisma: PrismaClient, characterId: number) {
    const safeCharId = Number(characterId);
    const [pc, i18nMap, fishCount] = await Promise.all([
      prisma.playerCharacter.findUnique({
        where: { id: safeCharId },
        select: { id: true, level: true, currentMapId: true, posX: true, posY: true, isFlying: true, equippedItemsJson: true },
      }),
      I18nCache.getTranslations(prisma),
      prisma.itemTemplate.count({ where: { itemCategory: 'FISH', isActive: true } }),
    ]);
    if (!pc) throw new Error('Personagem não encontrado.');

    const [equippedRod, baitsInBag] = await Promise.all([
      this.resolveEquippedRod(prisma, pc, i18nMap),
      this.loadBaitsInBag(prisma, safeCharId, i18nMap),
    ]);

    const activeSession = this.activeSessions.get(safeCharId) || null;
    return {
      equippedRod,
      baitsInBag,
      activeSession: activeSession ? this.serializeSession(activeSession) : null,
      fishPoolCount: fishCount,
      proximityPx: FISHING_PROXIMITY_PX,
    };
  }

  private static serializeSession(s: FishingSessionState) {
    return {
      characterId: s.characterId,
      mapId: s.mapId,
      startedAt: s.startedAt,
      lastCycleAt: s.lastCycleAt,
      castIntervalSec: s.castIntervalSec,
      catchChancePct: s.catchChancePct,
      rodItemId: s.rodItemId,
      rodNamePtBr: s.rodNamePtBr,
      rodIconUrl: s.rodIconUrl,
      baitQueue: s.baitQueue,
      waterPoint: s.waterPoint,
      caughtCount: s.caughtCount,
      missedCount: s.missedCount,
      attemptsCount: s.attemptsCount,
    };
  }

  public static async startFishing(
    prisma: PrismaClient,
    role: string,
    characterId: number,
    dto: { baitQueue?: number[]; posX?: number; posY?: number }
  ) {
    const safeCharId = Number(characterId);
    const [pc, i18nMap, fishCount] = await Promise.all([
      prisma.playerCharacter.findUnique({ where: { id: safeCharId } }),
      I18nCache.getTranslations(prisma),
      prisma.itemTemplate.count({ where: { itemCategory: 'FISH', isActive: true } }),
    ]);
    if (!pc) throw new Error('Personagem não encontrado.');
    if ((pc as any).isFlying) {
      throw new Error('Você precisa pousar sua montaria no chão antes de pescar.');
    }
    if (fishCount <= 0) {
      throw new Error('Nenhum peixe foi cadastrado no catálogo ainda. Cadastre peixes em /admin > Tabela de Itens.');
    }

    const rod = await this.resolveEquippedRod(prisma, pc, i18nMap);
    if (!rod) {
      throw new Error('Equipe uma Vara de Pesca no seu personagem antes de pescar.');
    }

    const isGmElevated = ['ADMIN', 'GM', 'DEV'].includes(String(role || '').toUpperCase());
    if (!isGmElevated && pc.level < rod.requiredLevel) {
      throw new Error(`Nível insuficiente para usar ${rod.namePtBr} (Requer Nv.${rod.requiredLevel}).`);
    }

    const map = await prisma.gameMap.findUnique({
      where: { id: pc.currentMapId ?? 1 },
      select: { id: true, fishingMeshJson: true },
    });
    const fishingMesh = new MapPolygonMesh(((map as any)?.fishingMeshJson as MapPolygon[]) || []);

    // Verifica coordenada enviada dentro de janela plausível do sync para evitar rejeição por latência de 1s
    let checkX = Number(pc.posX);
    let checkY = Number(pc.posY);
    if (Number.isFinite(Number(dto.posX)) && Number.isFinite(Number(dto.posY))) {
      const drift = Math.hypot(Number(dto.posX) - pc.posX, Number(dto.posY) - pc.posY);
      if (drift <= 240) {
        checkX = Number(dto.posX);
        checkY = Number(dto.posY);
      }
    }

    const closest = fishingMesh.findClosestPoint(checkX, checkY, FISHING_SERVER_PROXIMITY_TOLERANCE_PX);
    if (!closest) {
      throw new Error('Aproxime-se mais de uma área de pesca demarcada na água para começar a pescar.');
    }

    // Sanitiza fila ordenada de iscas garantindo IDs únicos válidos de FISHING_BAIT
    const requestedIds = Array.isArray(dto.baitQueue)
      ? Array.from(new Set(dto.baitQueue.map((x) => Number(x)).filter((x) => Number.isInteger(x) && x > 0)))
      : [];
    let validBaitQueue: number[] = [];
    if (requestedIds.length > 0) {
      const validBaits = await prisma.itemTemplate.findMany({
        where: { id: { in: requestedIds }, itemCategory: 'FISHING_BAIT', isActive: true },
        select: { id: true },
      });
      const validSet = new Set(validBaits.map((b) => b.id));
      validBaitQueue = requestedIds.filter((id) => validSet.has(id));
    }

    const now = Date.now();
    const session: FishingSessionState = {
      characterId: safeCharId,
      mapId: pc.currentMapId ?? 1,
      startedAt: now,
      lastCycleAt: now,
      castIntervalSec: rod.fishingRodConfig.castIntervalSec,
      catchChancePct: rod.fishingRodConfig.catchChancePct,
      rodItemId: rod.id,
      rodNamePtBr: rod.namePtBr,
      rodIconUrl: rod.iconUrl,
      rodRankWeights: rod.fishingRodConfig.rankWeights,
      baitQueue: validBaitQueue,
      waterPoint: closest.point,
      caughtCount: 0,
      missedCount: 0,
      attemptsCount: 0,
      tickInFlight: false,
    };

    this.activeSessions.set(safeCharId, session);
    const baitsInBag = await this.loadBaitsInBag(prisma, safeCharId, i18nMap);

    return {
      ok: true,
      active: true,
      session: this.serializeSession(session),
      baitsInBag,
    };
  }

  public static async tickFishing(prisma: PrismaClient, characterId: number) {
    const safeCharId = Number(characterId);
    const session = this.activeSessions.get(safeCharId);
    if (!session) {
      return { ok: true, active: false, stoppedReason: 'NO_SESSION' };
    }
    if (session.tickInFlight) {
      return {
        ok: true,
        active: true,
        ready: false,
        remainingMs: Math.max(250, session.castIntervalSec * 1000 - (Date.now() - session.lastCycleAt)),
      };
    }

    const now = Date.now();
    const cycleMs = session.castIntervalSec * 1000;
    const elapsed = now - session.lastCycleAt;
    if (elapsed < cycleMs * FISHING_TIMER_TOLERANCE_RATIO) {
      return {
        ok: true,
        active: true,
        ready: false,
        remainingMs: Math.max(50, Math.round(cycleMs - elapsed)),
      };
    }

    session.tickInFlight = true;
    try {
      const [pc, i18nMap, activeFishes] = await Promise.all([
        prisma.playerCharacter.findUnique({
          where: { id: safeCharId },
          select: { id: true, currentMapId: true, isFlying: true, equippedItemsJson: true },
        }),
        I18nCache.getTranslations(prisma),
        prisma.itemTemplate.findMany({
          where: { itemCategory: 'FISH', isActive: true },
          orderBy: { id: 'asc' },
        }),
      ]);

      if (!pc || pc.currentMapId !== session.mapId || (pc as any).isFlying) {
        this.activeSessions.delete(safeCharId);
        return { ok: true, active: false, stoppedReason: 'STATE_CHANGED' };
      }

      const eqMap = (pc.equippedItemsJson && typeof pc.equippedItemsJson === 'object' ? pc.equippedItemsJson : {}) as Record<string, number>;
      if (Number(eqMap.FISHING_ROD) !== session.rodItemId) {
        this.activeSessions.delete(safeCharId);
        return { ok: true, active: false, stoppedReason: 'ROD_UNEQUIPPED', message: 'Vara de Pesca desequipada. Pesca encerrada.' };
      }

      const fishByRank = new Map<FishingRankTier, FishPoolEntry[]>();
      for (const r of FISHING_RANKS) fishByRank.set(r, []);
      for (const f of activeFishes) {
        const rank = normalizeFishRarity(f.rarityTier);
        fishByRank.get(rank)!.push({
          id: f.id,
          code: f.code,
          namePtBr: i18nMap.get(f.nameI18nKey) || f.code,
          rarityTier: rank,
          iconUrl: AssetMirrorService.toSameOriginUrl(f.mcreworkIconKey || 'assets/items/icons/item_normal_180065.png'),
        });
      }

      let caught = false;
      let caughtFish: FishPoolEntry | null = null;
      let consumedBait: { id: number; namePtBr: string } | null = null;
      let bagFull = false;

      await prisma.$transaction(async (tx) => {
        const unlocked = CharacterInventoryService.getUnlockedSlotsCount(safeCharId);
        const occupied = await tx.characterInventoryItem.count({
          where: { characterId: safeCharId, slotIndex: { lt: unlocked }, quantity: { gt: 0 } },
        });
        const invBaitRows =
          session.baitQueue.length > 0
            ? await tx.characterInventoryItem.findMany({
                where: { characterId: safeCharId, itemTemplateId: { in: session.baitQueue }, quantity: { gt: 0 } },
                include: { itemTemplate: true },
              })
            : [];

        const qtyById = new Map<number, number>();
        const tplById = new Map<number, any>();
        for (const r of invBaitRows) {
          qtyById.set(r.itemTemplateId, (qtyById.get(r.itemTemplateId) || 0) + (Number(r.quantity) || 0));
          if (r.itemTemplate) tplById.set(r.itemTemplateId, r.itemTemplate);
        }

        const chosenBaitId = pickNextAvailableBait(session.baitQueue, qtyById);
        let baitCfg: FishingBaitConfig | null = null;

        if (chosenBaitId !== null) {
          const baitTpl = tplById.get(chosenBaitId);
          await CharacterInventoryService.consumeItem(tx, safeCharId, chosenBaitId, 1);
          const spec = (baitTpl?.specialEffectJson && typeof baitTpl.specialEffectJson === 'object' ? baitTpl.specialEffectJson : {}) as any;
          baitCfg = normalizeFishingBaitConfig(spec.fishingBaitConfig);
          consumedBait = {
            id: chosenBaitId,
            namePtBr: baitTpl ? (i18nMap.get(baitTpl.nameI18nKey) || baitTpl.code) : `Isca #${chosenBaitId}`,
          };
        }

        const effectiveCatch = Math.min(100, Math.max(1, session.catchChancePct + (baitCfg?.catchChanceBonusPct || 0)));
        caught = Math.random() * 100 < effectiveCatch;

        if (caught) {
          const effectiveWeights = computeEffectiveRankWeights(session.rodRankWeights, baitCfg?.rankBonusWeights);
          const candidate = rollFishByRankFirst(effectiveWeights, fishByRank);
          if (candidate) {
            const addRes = await CharacterInventoryService.addItem(tx, safeCharId, candidate.id, 1);
            if (addRes.added <= 0 && occupied >= unlocked) {
              bagFull = true;
              caught = false;
            } else {
              caughtFish = candidate;
            }
          } else {
            caught = false;
          }
        }
      });

      session.lastCycleAt = Date.now();
      session.attemptsCount += 1;
      if (bagFull) {
        this.activeSessions.delete(safeCharId);
        return {
          ok: true,
          active: false,
          ready: true,
          bagFull: true,
          stoppedReason: 'BAG_FULL',
          message: 'Mochila cheia! Pesca encerrada.',
        };
      }

      if (caught) session.caughtCount += 1;
      else session.missedCount += 1;

      const remainingBaits = await this.loadBaitsInBag(prisma, safeCharId, i18nMap);
      return {
        ok: true,
        active: true,
        ready: true,
        caught,
        fish: caughtFish,
        consumedBait,
        remainingBaits,
        session: this.serializeSession(session),
        nextCycleMs: session.castIntervalSec * 1000,
      };
    } finally {
      session.tickInFlight = false;
    }
  }
}
