/**
 * @file apps/server/src/controllers/MonsterGlobalConfigService.ts
 * @module @etheria/server/controllers/MonsterGlobalConfigService
 * @description Serviço autoritativo e cache em memória para Configuração Global de Monstros (`monster_global_configs`).
 *   Centraliza todos os modificadores procedurais de monstros:
 *   - Ranks (`F`, `D`, `C`, `B`, `A`, `S`, `SS`): multiplicadores de HP/ATQ/DEF, Crítico, Precisão, Peso de Spawn, XP e Ouro.
 *   - Hierarquia (`NORMAL`, `LEADER`, `BOSS`): escala base de atributos, tamanho, rolagens de drop, XP, Ouro e chances de spawn.
 *   - Escalonamento e Variação de Nível, Limites de Encontro, Penalidades de Nível do Mapa e Regras de Dungeon.
 * @rules Segue estritamente AGENTS.md (Pilar 4 Zero Hardcode, Cláusula 0, Regra #7 < 1.000 linhas).
 * @dependencies node:http, @etheria/database (PrismaClient, SnapshotManager)
 */

import type * as http from 'node:http';
import { PrismaClient, SnapshotManager } from '@etheria/database';

export const MONSTER_RANK_ORDER = ['F', 'D', 'C', 'B', 'A', 'S', 'SS'] as const;
export type MonsterRankCode = (typeof MONSTER_RANK_ORDER)[number];

export interface RankConfigEntry {
  hpMult: number;
  atkMult: number;
  defMult: number;
  critBonusPct: number;
  accBonus: number;
  spawnWeight: number;
  xpMult: number;
  goldMult: number;
}

export interface VariantConfigEntry {
  statMult: number;
  scaleMult: number;
  lootRolls: number;
  xpMult: number;
  goldMult: number;
  spawnChancePct?: number;
  maxPerEncounter?: number;
  blocksLeaders?: boolean;
}

export interface MonsterGlobalConfigDto {
  code: string;
  levelVarianceMin: number;
  levelVarianceMax: number;
  levelStatBonusPct: number;
  baseUnitXpPerLevel: number;
  baseUnitGoldPerLevel: number;
  encounterMinMonsters: number;
  encounterMaxMonsters: number;
  encounterExtraPerAllyMin: number;
  encounterExtraPerAllyMax: number;
  encounterMaxTotalCap: number;
  overlevelDiffThreshold: number;
  overlevelPenaltyPct: number;
  underlevelDiffThreshold: number;
  underlevelPenaltyPct: number;
  variantConfigsJson: {
    NORMAL: VariantConfigEntry;
    LEADER: VariantConfigEntry;
    BOSS: VariantConfigEntry;
  };
  rankConfigsJson: Record<MonsterRankCode, RankConfigEntry>;
  dungeonNormalHpMult: number;
  dungeonNormalDamageDealtMult: number;
  dungeonNormalAggroRadius: number;
  dungeonBossHpMult: number;
  dungeonBossDamageDealtMult: number;
  dungeonBossAggroRadius: number;
}

export const DEFAULT_MONSTER_GLOBAL_CONFIG: MonsterGlobalConfigDto = {
  code: 'GLOBAL',
  levelVarianceMin: -10,
  levelVarianceMax: 10,
  levelStatBonusPct: 20.0,
  baseUnitXpPerLevel: 28.0,
  baseUnitGoldPerLevel: 10.0,
  encounterMinMonsters: 2,
  encounterMaxMonsters: 6,
  encounterExtraPerAllyMin: 1,
  encounterExtraPerAllyMax: 2,
  encounterMaxTotalCap: 25,
  overlevelDiffThreshold: 10,
  overlevelPenaltyPct: 95.0,
  underlevelDiffThreshold: 30,
  underlevelPenaltyPct: 50.0,
  variantConfigsJson: {
    NORMAL: { statMult: 1.0, scaleMult: 1.0, lootRolls: 1, xpMult: 1.0, goldMult: 1.0 },
    LEADER: { statMult: 2.0, scaleMult: 1.28, lootRolls: 2, xpMult: 1.1765, goldMult: 1.3, spawnChancePct: 30.0, maxPerEncounter: 2 },
    BOSS: { statMult: 4.0, scaleMult: 1.65, lootRolls: 4, xpMult: 1.4286, goldMult: 1.5, spawnChancePct: 5.0, blocksLeaders: true },
  },
  rankConfigsJson: {
    F: { hpMult: 1.0, atkMult: 1.0, defMult: 1.0, critBonusPct: 0, accBonus: 0, spawnWeight: 140, xpMult: 1.0, goldMult: 0.8 },
    D: { hpMult: 1.3, atkMult: 1.3, defMult: 1.3, critBonusPct: 0, accBonus: 0, spawnWeight: 110, xpMult: 1.25, goldMult: 1.0 },
    C: { hpMult: 1.5, atkMult: 1.5, defMult: 1.5, critBonusPct: 5, accBonus: 0, spawnWeight: 70, xpMult: 1.5, goldMult: 1.2 },
    B: { hpMult: 1.8, atkMult: 1.8, defMult: 1.8, critBonusPct: 5, accBonus: 5, spawnWeight: 35, xpMult: 2.1429, goldMult: 1.35 },
    A: { hpMult: 2.1, atkMult: 2.1, defMult: 2.1, critBonusPct: 10, accBonus: 5, spawnWeight: 15, xpMult: 5.0, goldMult: 1.6 },
    S: { hpMult: 2.7, atkMult: 2.7, defMult: 2.7, critBonusPct: 15, accBonus: 5, spawnWeight: 4, xpMult: 10.0, goldMult: 1.8 },
    SS: { hpMult: 4.0, atkMult: 4.0, defMult: 4.0, critBonusPct: 20, accBonus: 10, spawnWeight: 1, xpMult: 15.0, goldMult: 2.5 },
  },
  dungeonNormalHpMult: 2.0,
  dungeonNormalDamageDealtMult: 0.7,
  dungeonNormalAggroRadius: 210,
  dungeonBossHpMult: 3.0,
  dungeonBossDamageDealtMult: 0.7,
  dungeonBossAggroRadius: 250,
};

const num = (val: unknown, fallback: number, min: number, max: number): number => {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
};

const intNum = (val: unknown, fallback: number, min: number, max: number): number =>
  Math.round(num(val, fallback, min, max));

export class MonsterGlobalConfigService {
  private static cachedConfig: MonsterGlobalConfigDto = DEFAULT_MONSTER_GLOBAL_CONFIG;
  private static loadedFromDb = false;

  public static normalizeRankCode(raw?: string | null): MonsterRankCode {
    const key = String(raw || 'F').trim().toUpperCase();
    if (key === 'COMMON') return 'F';
    return (MONSTER_RANK_ORDER as readonly string[]).includes(key) ? (key as MonsterRankCode) : 'F';
  }

  public static normalizeConfig(raw: any): MonsterGlobalConfigDto {
    const src = raw && typeof raw === 'object' ? raw : {};
    const d = DEFAULT_MONSTER_GLOBAL_CONFIG;

    const levelVarianceMin = intNum(src.levelVarianceMin, d.levelVarianceMin, -100, 100);
    const levelVarianceMax = Math.max(levelVarianceMin, intNum(src.levelVarianceMax, d.levelVarianceMax, -100, 100));
    const encounterMinMonsters = intNum(src.encounterMinMonsters, d.encounterMinMonsters, 1, 25);
    const encounterMaxMonsters = Math.max(encounterMinMonsters, intNum(src.encounterMaxMonsters, d.encounterMaxMonsters, 1, 25));
    const encounterExtraPerAllyMin = intNum(src.encounterExtraPerAllyMin, d.encounterExtraPerAllyMin, 0, 10);
    const encounterExtraPerAllyMax = Math.max(encounterExtraPerAllyMin, intNum(src.encounterExtraPerAllyMax, d.encounterExtraPerAllyMax, 0, 10));

    const srcVariants = (src.variantConfigsJson && typeof src.variantConfigsJson === 'object' ? src.variantConfigsJson : {}) as any;
    const normVariant = (key: 'NORMAL' | 'LEADER' | 'BOSS'): VariantConfigEntry => {
      const defV = d.variantConfigsJson[key];
      const inV = srcVariants[key] && typeof srcVariants[key] === 'object' ? srcVariants[key] : {};
      const out: VariantConfigEntry = {
        statMult: num(inV.statMult, defV.statMult, 0.1, 100),
        scaleMult: num(inV.scaleMult, defV.scaleMult, 0.3, 4),
        lootRolls: intNum(inV.lootRolls, defV.lootRolls, 1, 20),
        xpMult: num(inV.xpMult, defV.xpMult, 0.01, 100),
        goldMult: num(inV.goldMult, defV.goldMult, 0, 100),
      };
      if (key === 'LEADER') {
        out.spawnChancePct = num(inV.spawnChancePct, defV.spawnChancePct ?? 30, 0, 100);
        out.maxPerEncounter = intNum(inV.maxPerEncounter, defV.maxPerEncounter ?? 2, 0, 25);
      } else if (key === 'BOSS') {
        out.spawnChancePct = num(inV.spawnChancePct, defV.spawnChancePct ?? 5, 0, 100);
        out.blocksLeaders = inV.blocksLeaders !== undefined ? Boolean(inV.blocksLeaders) : Boolean(defV.blocksLeaders ?? true);
      }
      return out;
    };

    const srcRanks = (src.rankConfigsJson && typeof src.rankConfigsJson === 'object' ? src.rankConfigsJson : {}) as any;
    const rankConfigsJson = {} as Record<MonsterRankCode, RankConfigEntry>;
    for (const r of MONSTER_RANK_ORDER) {
      const defR = d.rankConfigsJson[r];
      const inR = srcRanks[r] && typeof srcRanks[r] === 'object' ? srcRanks[r] : {};
      rankConfigsJson[r] = {
        hpMult: num(inR.hpMult, defR.hpMult, 0.1, 100),
        atkMult: num(inR.atkMult, defR.atkMult, 0.1, 100),
        defMult: num(inR.defMult, defR.defMult, 0.1, 100),
        critBonusPct: num(inR.critBonusPct, defR.critBonusPct, -50, 100),
        accBonus: num(inR.accBonus, defR.accBonus, -50, 100),
        spawnWeight: num(inR.spawnWeight, defR.spawnWeight, 0, 100000),
        xpMult: num(inR.xpMult, defR.xpMult, 0.01, 500),
        goldMult: num(inR.goldMult, defR.goldMult, 0, 500),
      };
    }

    return {
      code: 'GLOBAL',
      levelVarianceMin,
      levelVarianceMax,
      levelStatBonusPct: num(src.levelStatBonusPct, d.levelStatBonusPct, 0, 500),
      baseUnitXpPerLevel: num(src.baseUnitXpPerLevel, d.baseUnitXpPerLevel, 0.1, 100000),
      baseUnitGoldPerLevel: num(src.baseUnitGoldPerLevel, d.baseUnitGoldPerLevel, 0, 100000),
      encounterMinMonsters,
      encounterMaxMonsters,
      encounterExtraPerAllyMin,
      encounterExtraPerAllyMax,
      encounterMaxTotalCap: intNum(src.encounterMaxTotalCap, d.encounterMaxTotalCap, encounterMaxMonsters, 50),
      overlevelDiffThreshold: intNum(src.overlevelDiffThreshold, d.overlevelDiffThreshold, 1, 500),
      overlevelPenaltyPct: num(src.overlevelPenaltyPct, d.overlevelPenaltyPct, 0, 100),
      underlevelDiffThreshold: intNum(src.underlevelDiffThreshold, d.underlevelDiffThreshold, 1, 500),
      underlevelPenaltyPct: num(src.underlevelPenaltyPct, d.underlevelPenaltyPct, 0, 100),
      variantConfigsJson: {
        NORMAL: normVariant('NORMAL'),
        LEADER: normVariant('LEADER'),
        BOSS: normVariant('BOSS'),
      },
      rankConfigsJson,
      dungeonNormalHpMult: num(src.dungeonNormalHpMult, d.dungeonNormalHpMult, 0.1, 50),
      dungeonNormalDamageDealtMult: num(src.dungeonNormalDamageDealtMult, d.dungeonNormalDamageDealtMult, 0.05, 10),
      dungeonNormalAggroRadius: intNum(src.dungeonNormalAggroRadius, d.dungeonNormalAggroRadius, 40, 2000),
      dungeonBossHpMult: num(src.dungeonBossHpMult, d.dungeonBossHpMult, 0.1, 50),
      dungeonBossDamageDealtMult: num(src.dungeonBossDamageDealtMult, d.dungeonBossDamageDealtMult, 0.05, 10),
      dungeonBossAggroRadius: intNum(src.dungeonBossAggroRadius, d.dungeonBossAggroRadius, 40, 2000),
    };
  }

  public static getCachedConfig(): MonsterGlobalConfigDto {
    return this.cachedConfig;
  }

  public static setCachedConfigForTest(partial: Partial<MonsterGlobalConfigDto>): MonsterGlobalConfigDto {
    this.cachedConfig = this.normalizeConfig({ ...this.cachedConfig, ...partial });
    return this.cachedConfig;
  }

  public static async ensureLoaded(prisma: PrismaClient | any): Promise<MonsterGlobalConfigDto> {
    if (this.loadedFromDb) return this.cachedConfig;
    try {
      const existing = await prisma.monsterGlobalConfig.findUnique({ where: { code: 'GLOBAL' } });
      if (existing) {
        this.cachedConfig = this.normalizeConfig(existing);
        this.loadedFromDb = true;
        return this.cachedConfig;
      }
      const d = DEFAULT_MONSTER_GLOBAL_CONFIG;
      const created = await prisma.monsterGlobalConfig.upsert({
        where: { code: 'GLOBAL' },
        create: d as any,
        update: {},
      });
      this.cachedConfig = this.normalizeConfig(created);
      this.loadedFromDb = true;
    } catch (err) {
      console.warn('[MonsterGlobalConfigService] Aviso ao carregar configuração global:', err);
    }
    return this.cachedConfig;
  }

  public static async updateConfig(
    prisma: PrismaClient | any,
    dto: Record<string, unknown>,
    snapshotManager?: SnapshotManager
  ): Promise<MonsterGlobalConfigDto> {
    const clean = this.normalizeConfig(dto);
    const saved = await prisma.monsterGlobalConfig.upsert({
      where: { code: 'GLOBAL' },
      create: clean as any,
      update: clean as any,
    });
    this.cachedConfig = this.normalizeConfig(saved);
    this.loadedFromDb = true;
    if (snapshotManager) {
      await snapshotManager.exportToDisk().catch(() => {});
    }
    return this.cachedConfig;
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
    enforcePerm: (mode: 'READ' | 'READ_WRITE') => boolean
  ): Promise<boolean> {
    if (pathname === '/api/admin/monster-config' && method === 'GET') {
      if (!enforcePerm('READ')) return true;
      this.loadedFromDb = false;
      const config = await this.ensureLoaded(prisma);
      sendJson(res, 200, { config, defaults: DEFAULT_MONSTER_GLOBAL_CONFIG });
      return true;
    }
    if (pathname === '/api/admin/monster-config' && method === 'PUT') {
      if (!enforcePerm('READ_WRITE')) return true;
      const body = await readJsonBody(req);
      const config = await this.updateConfig(prisma, body, snapshotManager);
      sendJson(res, 200, { config, message: 'Configuração global de monstros salva com sucesso.' });
      return true;
    }
    if (pathname === '/api/admin/monster-config/reset' && method === 'POST') {
      if (!enforcePerm('READ_WRITE')) return true;
      const config = await this.updateConfig(prisma, DEFAULT_MONSTER_GLOBAL_CONFIG as any, snapshotManager);
      sendJson(res, 200, { config, message: 'Configuração global de monstros restaurada aos padrões.' });
      return true;
    }
    return false;
  }
}
