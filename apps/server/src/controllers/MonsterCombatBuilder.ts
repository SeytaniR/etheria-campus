/**
 * @file apps/server/src/controllers/MonsterCombatBuilder.ts
 * @module @etheria/server
 * @description Construtor Único e Autoritativo de Status de Monstros em Combate.
 *   Compartilhado 100% entre a Batalha Real In-Game (`startEncounterByMap`) e a Batalha do Painel GM
 *   (`startBattle`), garantindo realidade idêntica nos dois ambientes.
 * @rules
 *   - Sem redutores artificiais sobre `attribute_conversions`: monstros usam 100% (1.0x) das razões do banco.
 *   - Escalonamento de +20% por nível nos atributos base do monstro (`baseStat * (1 + (mobLvl - 1) * 0.20)`).
 *   - Variação de nível em mapas de -10 a +10 em relação ao nível do mapa (ex: mapa nível 100 -> 90 a 110).
 *   - Multiplicadores de Rank F..SS aplicados em HP/MP, Ataque (Físico/Mágico), Defesa (Física/Mágica), Crítico e Precisão.
 *   - Hierarquia de encontro: NORMAL (1x), LEADER (2x atributos base e 2x recompensas) e BOSS (4x atributos e 4x recompensas).
 * @dependencies @etheria/shared (ElementMatchupEntry), ./MonsterGlobalConfigService.js
 */

import type { ElementMatchupEntry } from '@etheria/shared';
import { DEFAULT_MONSTER_GLOBAL_CONFIG, MonsterGlobalConfigService } from './MonsterGlobalConfigService.js';

export type MonsterVariantTier = 'NORMAL' | 'LEADER' | 'BOSS';

export interface QuestBattleMonsterSlotDto {
  monsterTemplateId: number;
  quantity: number;
  variantTier?: MonsterVariantTier;
  levelMode?: 'FIXED' | 'PLAYER_LEVEL';
  level?: number;
  customNamePtBr?: string | null;
  elementCode?: string | null;
  raceCode?: string | null;
  rarityTier?: string | null;
  combatStyle?: 'MELEE' | 'RANGED' | null;
  attackRange?: number | null;
  damageType?: 'PHYSICAL' | 'MAGICAL' | null;
  baseAttributes?: {
    VIT?: number;
    STR?: number;
    INT?: number;
    WIS?: number;
    AGI?: number;
    DEX?: number;
  } | null;
  combatOverrides?: {
    maxHp?: number | null;
    maxMp?: number | null;
    physAtk?: number | null;
    magAtk?: number | null;
    def?: number | null;
    magDef?: number | null;
    speed?: number | null;
    battleMoveSpeed?: number | null;
    attackSpeed?: number | null;
    critRatePct?: number | null;
    critDmgPct?: number | null;
    physAccuracy?: number | null;
    magAccuracy?: number | null;
    physEvasion?: number | null;
    magEvasion?: number | null;
  } | null;
  skillIds?: number[] | null;
}

export interface QuestBattleConfigDto {
  enabled: boolean;
  buttonLabelPtBr?: string | null;
  monsters: QuestBattleMonsterSlotDto[];
}

export interface MonsterScalingContext {
  conversions: Array<{
    baseAttributeCode: string;
    combatAttributeCode: string;
    ratioPerPoint: number;
  }>;
  globalDefaultMoveSpeed: number;
  elementMatchups: ElementMatchupEntry[];
}

export interface RarityScalingProfile {
  hp: number;
  atk: number;
  def: number;
  critBonus: number;
  accBonus: number;
  spawnWeight: number;
}

export class MonsterCombatBuilder {
  public static calculateMonsterGoldReward(
    level: number,
    rarityTier?: string | null,
    variantTier: MonsterVariantTier = 'NORMAL'
  ): number {
    const cfg = MonsterGlobalConfigService.getCachedConfig();
    const mobLvl = Math.max(1, Math.round(Number(level) || 1));
    const rKey = MonsterGlobalConfigService.normalizeRankCode(rarityTier || 'D');
    const rankWeight = cfg.rankConfigsJson[rKey]?.goldMult ?? 1.00;
    const variantWeight = cfg.variantConfigsJson[variantTier]?.goldMult ?? 1.00;
    return Math.max(
      1,
      Math.ceil(mobLvl * cfg.baseUnitGoldPerLevel * rankWeight * variantWeight)
    );
  }

  public static calculateMonsterExpReward(
    level: number,
    rarityTier?: string | null,
    variantTier: MonsterVariantTier = 'NORMAL'
  ): number {
    const cfg = MonsterGlobalConfigService.getCachedConfig();
    const mobLvl = Math.max(1, Math.round(Number(level) || 1));
    const rKey = MonsterGlobalConfigService.normalizeRankCode(rarityTier || 'F');
    const rankWeight = cfg.rankConfigsJson[rKey]?.xpMult ?? 1.0;
    const variantWeight = cfg.variantConfigsJson[variantTier]?.xpMult ?? 1.0;
    return Math.max(
      1,
      Math.round(cfg.baseUnitXpPerLevel * mobLvl * rankWeight * variantWeight)
    );
  }

  /**
   * Limite de Nivelamento (Map Leveling Scaling):
   * Reduz XP e Ouro conforme configurações globais de mapa acima/abaixo do nível do jogador.
   */
  public static applyMapLevelingPenalty(
    baseExp: number,
    baseGold: number,
    playerLevel: number,
    mapLevel: number
  ): { exp: number; gold: number; penaltyMultiplier: number; penaltyReason: string | null } {
    const cfg = MonsterGlobalConfigService.getCachedConfig();
    let penaltyMultiplier = 1.0;
    let penaltyReason: string | null = null;

    const pLevel = Math.max(1, Math.round(Number(playerLevel) || 1));
    const mLevel = Math.max(1, Math.round(Number(mapLevel) || 1));

    if (mLevel >= pLevel + cfg.overlevelDiffThreshold) {
      penaltyMultiplier = Math.max(0, Math.round((100 - cfg.overlevelPenaltyPct) * 100) / 10000);
      penaltyReason = 'MAP_OVERLEVEL_95';
    } else if (mLevel <= pLevel - cfg.underlevelDiffThreshold) {
      penaltyMultiplier = Math.max(0, Math.round((100 - cfg.underlevelPenaltyPct) * 100) / 10000);
      penaltyReason = 'MAP_UNDERLEVEL_50';
    }

    const exp = baseExp > 0 ? Math.max(1, Math.ceil(baseExp * penaltyMultiplier)) : 0;
    const gold = baseGold > 0 ? Math.max(0, Math.ceil(baseGold * penaltyMultiplier)) : 0;

    return { exp, gold, penaltyMultiplier, penaltyReason };
  }

  public static async loadScalingContext(prisma: any): Promise<MonsterScalingContext> {
    const [conversions, battleMoveAttr, elementMatchups] = await Promise.all([
      prisma.attributeConversion.findMany(),
      prisma.combatAttribute.findUnique({ where: { code: 'BATTLE_MOVE_SPEED' } }),
      prisma.elementMatchup ? prisma.elementMatchup.findMany() : Promise.resolve([]),
      MonsterGlobalConfigService.ensureLoaded(prisma),
    ]);

    return {
      conversions: Array.isArray(conversions) ? conversions : [],
      globalDefaultMoveSpeed: Number(battleMoveAttr?.baseDefault) || 180,
      elementMatchups: (elementMatchups || []).map((m: any) => ({
        attackerElementCode: String(m.attackerElementCode),
        defenderElementCode: String(m.defenderElementCode),
        damageMultiplier: Number(m.damageMultiplier) || 1.0,
      })),
    };
  }

  public static getConversionRatio(
    ctx: MonsterScalingContext,
    baseAttr: string,
    combatAttr: string,
    fallback: number
  ): number {
    const match = ctx.conversions.find(
      (c) => c.baseAttributeCode === baseAttr && c.combatAttributeCode === combatAttr
    );
    return match ? Number(match.ratioPerPoint) : fallback;
  }

  public static resolveRarityProfile(rarityTier?: string | null): RarityScalingProfile {
    const key = MonsterGlobalConfigService.normalizeRankCode(rarityTier);
    const cfgRank =
      MonsterGlobalConfigService.getCachedConfig().rankConfigsJson?.[key] ||
      DEFAULT_MONSTER_GLOBAL_CONFIG.rankConfigsJson[key] ||
      DEFAULT_MONSTER_GLOBAL_CONFIG.rankConfigsJson.F;
    return {
      hp: cfgRank.hpMult,
      atk: cfgRank.atkMult,
      def: cfgRank.defMult,
      critBonus: cfgRank.critBonusPct / 100,
      accBonus: cfgRank.accBonus,
      spawnWeight: cfgRank.spawnWeight,
    };
  }

  /**
   * Sorteio Justo em 2 Etapas (Rank-First):
   *   1) Agrupa os candidatos por Rank (F..SS) e sorteia primeiro o Rank pelo `spawnWeight` único de cada Rank presente,
   *      impedindo que maior quantidade de monstros raros em um mapa aumente a chance desse Rank nascer.
   *   2) Sorteia uniformemente um template dentro do Rank escolhido.
   */
  public static pickWeightedMonsterTemplate<T extends { rarityTier?: string | null }>(candidates: T[]): T {
    const buckets = new Map<string, T[]>();
    for (const c of candidates) {
      const rank = MonsterGlobalConfigService.normalizeRankCode(c.rarityTier);
      const list = buckets.get(rank);
      if (list) list.push(c);
      else buckets.set(rank, [c]);
    }
    const ranks = Array.from(buckets.keys());
    if (ranks.length === 1) {
      const only = buckets.get(ranks[0])!;
      return only[Math.floor(Math.random() * only.length)];
    }
    let totalWeight = 0;
    const rankWeights = ranks.map((r) => {
      const w = Math.max(0, Number(MonsterCombatBuilder.resolveRarityProfile(r).spawnWeight) || 0);
      totalWeight += w;
      return w;
    });
    let chosenRank = ranks[ranks.length - 1];
    if (totalWeight <= 0) {
      chosenRank = ranks[Math.floor(Math.random() * ranks.length)];
    } else {
      let roll = Math.random() * totalWeight;
      for (let i = 0; i < ranks.length; i++) {
        roll -= rankWeights[i];
        if (roll <= 0) {
          chosenRank = ranks[i];
          break;
        }
      }
    }
    const bucket = buckets.get(chosenRank)!;
    return bucket[Math.floor(Math.random() * bucket.length)];
  }

  /**
   * Sorteia o nível do monstro no mapa usando a variação configurável (padrão -10 a +10) em relação ao nível do mapa.
   */
  public static resolveBalancedMapMonsterLevel(
    requiredLevel: number,
    _levelVarianceMin?: number | null,
    _levelVarianceMax?: number | null
  ): number {
    const cfg = MonsterGlobalConfigService.getCachedConfig();
    const reqLvl = Math.max(1, Math.round(Number(requiredLevel) || 1));
    const minLvl = Math.max(1, reqLvl + cfg.levelVarianceMin);
    const maxLvl = Math.max(minLvl, reqLvl + cfg.levelVarianceMax);
    return minLvl + Math.floor(Math.random() * (maxLvl - minLvl + 1));
  }

  /**
   * Constrói os atributos finais de combate de um Monstro usando 100% das conversões do banco,
   * escalonamento por nível, multiplicadores de Rank (F..SS) e hierarquia (NORMAL/LEADER/BOSS) da Configuração Global.
   */
  public static buildMonsterUnit(
    template: any,
    monsterLevel: number,
    index: number,
    displayName: string,
    ctx: MonsterScalingContext,
    pagesBaseUrl: string,
    variantTier: MonsterVariantTier = 'NORMAL'
  ) {
    const cfg = MonsterGlobalConfigService.getCachedConfig();
    const mobLvl = Math.max(1, Math.round(Number(monsterLevel) || 1));
    const lvUps = Math.max(0, mobLvl - 1);
    const levelStatFactor = 1 + lvUps * (cfg.levelStatBonusPct / 100);
    const vCfg = cfg.variantConfigsJson[variantTier] || cfg.variantConfigsJson.NORMAL;
    const variantStatMultiplier = vCfg.statMult;
    const combinedStatFactor = levelStatFactor * variantStatMultiplier;

    const rawBase = (template.baseAttributesJson as any) || {};
    const effStats = {
      VIT: (Number(rawBase.VIT) || 12) * combinedStatFactor,
      STR: (Number(rawBase.STR) || 12) * combinedStatFactor,
      INT: (Number(rawBase.INT) || 10) * combinedStatFactor,
      WIS: (Number(rawBase.WIS) || 10) * combinedStatFactor,
      AGI: (Number(rawBase.AGI) || 10) * combinedStatFactor,
      DEX: (Number(rawBase.DEX) || 10) * combinedStatFactor,
    };

    const rTier = String(template.rarityTier || 'F').trim().toUpperCase();
    const rarity = this.resolveRarityProfile(rTier);

    const vitHpRatio = this.getConversionRatio(ctx, 'VIT', 'MAX_HP', 20);
    const intMpRatio = this.getConversionRatio(ctx, 'INT', 'MAX_MP', 12);
    const strPhysAtkRatio = this.getConversionRatio(ctx, 'STR', 'PHYS_ATK', 2.5);
    const agiPhysAtkRatio = this.getConversionRatio(ctx, 'AGI', 'PHYS_ATK', 0.5);
    const intMagAtkRatio = this.getConversionRatio(ctx, 'INT', 'MAG_ATK', 2.5);
    const vitDefRatio = this.getConversionRatio(ctx, 'VIT', 'PHYS_DEF', 1.5);
    const wisMagDefRatio = this.getConversionRatio(ctx, 'WIS', 'MAG_DEF', 1.8);
    const agiSpdRatio = this.getConversionRatio(ctx, 'AGI', 'SPEED', 1.5);
    const agiMoveRatio = this.getConversionRatio(ctx, 'AGI', 'BATTLE_MOVE_SPEED', 0.5);

    const damageType: 'PHYSICAL' | 'MAGICAL' =
      String(template.damageType || 'PHYSICAL').toUpperCase() === 'MAGICAL' ? 'MAGICAL' : 'PHYSICAL';

    const physAtk = Math.max(8, Math.round((effStats.STR * strPhysAtkRatio + effStats.AGI * agiPhysAtkRatio) * rarity.atk));
    const magAtk = Math.max(8, Math.round(effStats.INT * intMagAtkRatio * rarity.atk));
    const healPowerRatio = this.getConversionRatio(ctx, 'WIS', 'HEAL_POWER', 2.0);
    const healPower = Math.max(8, Math.round(effStats.WIS * healPowerRatio * rarity.atk));
    const rawAtk = damageType === 'MAGICAL' ? magAtk : physAtk;

    const maxHp = Math.max(50, Math.round(effStats.VIT * vitHpRatio * rarity.hp));
    const maxMp = Math.max(20, Math.round(effStats.INT * intMpRatio * rarity.hp));
    const atk = Math.max(8, Math.round(rawAtk));
    const def = Math.max(5, Math.round(effStats.VIT * vitDefRatio * rarity.def));
    const magDef = Math.max(5, Math.round(effStats.WIS * wisMagDefRatio * rarity.def));
    const speed = Math.max(10, Math.round(effStats.AGI * agiSpdRatio));

    const cb = (template.baseCombatAttributesJson as any) || {};
    const baseMoveSpeed = Number(cb.BATTLE_MOVE_SPEED) || ctx.globalDefaultMoveSpeed;
    const battleMoveSpeed = Math.max(40, Math.min(185, Math.round(baseMoveSpeed + Math.min(120, effStats.AGI * agiMoveRatio))));
    const dexCritBonus = Math.max(0, effStats.DEX - 10) * this.getConversionRatio(ctx, 'DEX', 'CRIT_RATE', 0.002);
    const strCritDmgBonus = Math.max(0, effStats.STR - 10) * this.getConversionRatio(ctx, 'STR', 'CRIT_DMG', 0.003);
    const agiEvaBonusPct = Math.max(0, effStats.AGI - 10) * (this.getConversionRatio(ctx, 'AGI', 'PHYS_EVASION', 0.002) * 100);
    const wisEvaBonusPct = Math.max(0, effStats.WIS - 10) * (this.getConversionRatio(ctx, 'WIS', 'MAG_EVASION', 0.0015) * 100);
    const dexPhysAccBonusPct = Math.max(0, effStats.DEX - 10) * (this.getConversionRatio(ctx, 'DEX', 'PHYS_ACCURACY', 0.002) * 100);
    const dexMagAccBonusPct = Math.max(0, effStats.DEX - 10) * (this.getConversionRatio(ctx, 'DEX', 'MAG_ACCURACY', 0.002) * 100);

    const rarityAccBonus = rarity.accBonus;
    const rarityCritBonus = rarity.critBonus;

    const mobKey = template.mcreworkMonsterKey;
    const modelScale = vCfg.scaleMult;
    const nameColorHex = variantTier === 'BOSS' ? '#fb7185' : variantTier === 'LEADER' ? '#38bdf8' : '#f8fafc';
    const rewardMultiplier = vCfg.lootRolls;
    const expReward = this.calculateMonsterExpReward(mobLvl, rTier, variantTier);
    const goldReward = this.calculateMonsterGoldReward(mobLvl, rTier, variantTier);

    return {
      id: `mob_${template.id}_${index}`,
      monsterTemplateId: Number(template.id),
      index,
      name: displayName,
      level: mobLvl,
      variantTier,
      modelScale,
      nameColorHex,
      rewardMultiplier,
      expReward,
      goldReward,
      hp: maxHp,
      maxHp,
      mp: maxMp,
      maxMp,
      atk,
      physAtk,
      magAtk,
      healPower,
      def,
      magDef,
      skillIds: Array.isArray(template.skillIdsJson) ? template.skillIdsJson.map(Number).filter(Number.isFinite) : [],
      critRate: Math.min(0.85, (Number(cb.CRIT_RATE) || 5) / 100 + dexCritBonus + rarityCritBonus),
      critDmg: Math.min(3.00, (Number(cb.CRIT_DMG) || 150) / 100 + strCritDmgBonus),
      attackSpeed: Number(cb.ATTACK_SPEED) || 1.0,
      speed,
      battleMoveSpeed,
      spriteKey: mobKey,
      atlasJsonUrl: `${pagesBaseUrl}/assets/monsters/${mobKey}/atlas.json`,
      atlasWebpUrl: `${pagesBaseUrl}/assets/monsters/${mobKey}/atlas.webp`,
      groundOffsetY: template.groundOffsetY || 0,
      thumbUrl: `${pagesBaseUrl}/assets/monsters/${mobKey}/thumb.webp`,
      elementCode: template.fixedElementCode || 'NEUTRAL',
      raceCode: template.raceCode || 'BEAST',
      rarityTier: rTier,
      combatStyle: (template.combatStyle as 'MELEE' | 'RANGED') || 'MELEE',
      attackRange: template.attackRange || 60,
      damageType,
      basicAttackVfxKey: (template.combatStyle as 'MELEE' | 'RANGED') === 'RANGED' ? '10002' : '10008',
      basicAttackVfxColorHex: (template.combatStyle as 'MELEE' | 'RANGED') === 'RANGED' ? '#f97316' : '#ef4444',
      physAccuracy: Math.min(135, Math.max(20, Math.round((Number(cb.PHYS_ACCURACY) || 95) + dexPhysAccBonusPct + rarityAccBonus))),
      physEvasion: Math.min(75, Math.max(0, Math.round((Number(cb.PHYS_EVASION) || 5) + agiEvaBonusPct))),
      magAccuracy: Math.min(135, Math.max(20, Math.round((Number(cb.MAG_ACCURACY) || 95) + dexMagAccBonusPct + rarityAccBonus))),
      magEvasion: Math.min(75, Math.max(0, Math.round((Number(cb.MAG_EVASION) || 5) + wisEvaBonusPct))),
      isAlive: true,
      activeStatuses: [],
    };
  }

  /**
   * Constrói unidades de monstros customizadas exclusivamente para a luta de uma Quest (`questBattleConfig`),
   * aplicando em memória overrides de nome, nível, quantidade, elemento, raça, rank, estilo, atributos base,
   * status de combate diretos e habilidades sem alterar o registro original em `monster_templates`.
   */
  public static buildCustomQuestMonsterUnits(
    baseTemplate: any,
    defaultNamePtBr: string,
    slotCfg: QuestBattleMonsterSlotDto,
    playerLevel: number,
    startIndex: number,
    ctx: MonsterScalingContext,
    pagesBaseUrl: string
  ) {
    const origBase = (baseTemplate.baseAttributesJson as any) || {};
    const customBase = slotCfg.baseAttributes || {};
    const mergedBase = {
      VIT: Number(customBase.VIT) > 0 ? Number(customBase.VIT) : Number(origBase.VIT) || 12,
      STR: Number(customBase.STR) > 0 ? Number(customBase.STR) : Number(origBase.STR) || 12,
      INT: Number(customBase.INT) > 0 ? Number(customBase.INT) : Number(origBase.INT) || 10,
      WIS: Number(customBase.WIS) > 0 ? Number(customBase.WIS) : Number(origBase.WIS) || 10,
      AGI: Number(customBase.AGI) > 0 ? Number(customBase.AGI) : Number(origBase.AGI) || 10,
      DEX: Number(customBase.DEX) > 0 ? Number(customBase.DEX) : Number(origBase.DEX) || 10,
    };

    const virtualTemplate = {
      ...baseTemplate,
      fixedElementCode: slotCfg.elementCode || baseTemplate.fixedElementCode || 'NEUTRAL',
      raceCode: slotCfg.raceCode || baseTemplate.raceCode || 'BEAST',
      rarityTier: slotCfg.rarityTier || baseTemplate.rarityTier || 'F',
      combatStyle: slotCfg.combatStyle || baseTemplate.combatStyle || 'MELEE',
      attackRange: Number(slotCfg.attackRange) > 0 ? Number(slotCfg.attackRange) : Number(baseTemplate.attackRange) || 60,
      damageType: slotCfg.damageType || baseTemplate.damageType || 'PHYSICAL',
      baseAttributesJson: mergedBase,
      skillIdsJson: Array.isArray(slotCfg.skillIds) ? slotCfg.skillIds : baseTemplate.skillIdsJson,
    };

    const rawTier = String(slotCfg.variantTier || 'NORMAL').toUpperCase();
    const variantTier: MonsterVariantTier =
      rawTier === 'BOSS' ? 'BOSS' : rawTier === 'LEADER' ? 'LEADER' : 'NORMAL';
    const qty = Math.max(1, Math.min(25, Math.round(Number(slotCfg.quantity) || 1)));
    const mobLevel =
      slotCfg.levelMode === 'PLAYER_LEVEL'
        ? Math.max(1, Number(playerLevel) || 1)
        : Math.max(1, Math.round(Number(slotCfg.level) || Number(playerLevel) || 1));

    const baseName = String(slotCfg.customNamePtBr || '').trim() || defaultNamePtBr || baseTemplate.code;
    const rTier = String(virtualTemplate.rarityTier || 'F').toUpperCase();
    const raritySuffix = rTier === 'SS' ? ' ⭐[SS]' : rTier === 'S' ? ' ⭐[S]' : '';
    const tagPrefix =
      variantTier === 'BOSS' ? '💀 [BOSS] ' : variantTier === 'LEADER' ? '👑 [LÍDER] ' : '';

    const ov = slotCfg.combatOverrides || {};
    const hasNum = (v: any) => v !== null && v !== undefined && v !== '' && Number(v) > 0;

    const units = [];
    for (let i = 0; i < qty; i++) {
      const unitIdx = startIndex + i;
      const displayName =
        qty > 1 ? `${tagPrefix}${baseName} #${i + 1}${raritySuffix}` : `${tagPrefix}${baseName}${raritySuffix}`;
      const u = this.buildMonsterUnit(virtualTemplate, mobLevel, unitIdx, displayName, ctx, pagesBaseUrl, variantTier);

      if (hasNum(ov.maxHp)) {
        u.maxHp = Math.max(1, Math.round(Number(ov.maxHp)));
        u.hp = u.maxHp;
      }
      if (hasNum(ov.maxMp)) {
        u.maxMp = Math.max(1, Math.round(Number(ov.maxMp)));
        u.mp = u.maxMp;
      }
      if (hasNum(ov.physAtk)) u.physAtk = Math.max(1, Math.round(Number(ov.physAtk)));
      if (hasNum(ov.magAtk)) u.magAtk = Math.max(1, Math.round(Number(ov.magAtk)));
      u.atk = u.damageType === 'MAGICAL' ? u.magAtk : u.physAtk;
      if (hasNum(ov.def)) u.def = Math.max(1, Math.round(Number(ov.def)));
      if (hasNum(ov.magDef)) u.magDef = Math.max(1, Math.round(Number(ov.magDef)));
      if (hasNum(ov.speed)) u.speed = Math.max(1, Math.round(Number(ov.speed)));
      if (hasNum(ov.battleMoveSpeed)) u.battleMoveSpeed = Math.min(185, Math.max(40, Math.round(Number(ov.battleMoveSpeed))));
      if (hasNum(ov.attackSpeed)) u.attackSpeed = Math.max(0.2, Number(ov.attackSpeed));
      if (hasNum(ov.critRatePct)) u.critRate = Math.min(0.95, Math.max(0, Number(ov.critRatePct) / 100));
      if (hasNum(ov.critDmgPct)) u.critDmg = Math.min(5.0, Math.max(1.0, Number(ov.critDmgPct) / 100));
      if (hasNum(ov.physAccuracy)) u.physAccuracy = Math.max(10, Math.round(Number(ov.physAccuracy)));
      if (hasNum(ov.magAccuracy)) u.magAccuracy = Math.max(10, Math.round(Number(ov.magAccuracy)));
      if (ov.physEvasion !== null && ov.physEvasion !== undefined && (ov.physEvasion as any) !== '') {
        u.physEvasion = Math.min(75, Math.max(0, Math.round(Number(ov.physEvasion))));
      }
      if (ov.magEvasion !== null && ov.magEvasion !== undefined && (ov.magEvasion as any) !== '') {
        u.magEvasion = Math.min(75, Math.max(0, Math.round(Number(ov.magEvasion))));
      }
      units.push(u);
    }
    return units;
  }
}
