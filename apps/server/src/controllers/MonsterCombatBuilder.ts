/**
 * @file apps/server/src/controllers/MonsterCombatBuilder.ts
 * @module @etheria/server
 * @description Construtor Único e Autoritativo de Status de Monstros em Combate.
 *   Compartilhado 100% entre a Batalha Real In-Game (`startEncounterByMap`) e a Batalha do Painel GM
 *   (`startBattle`), garantindo realidade idêntica nos dois ambientes.
 * @rules
 *   - Sem redutores artificiais sobre `attribute_conversions`: monstros usam 100% (1.0x) das razões do banco.
 *   - Escalonamento balanceado por nível do mapa (`baseStat * (1 + (mobLvl - 1) * 0.12)`).
 *   - Limite balanceado de variação positiva para mapas iniciais (Lv 1..3 em vez de saltos abruptos).
 *   - Tier de Raridade com buff extra em A, S e SS aplicados também em MAG_DEF.
 *   - Ataque mágico (`MAGICAL`) deriva de `INT -> MAG_ATK`; ataque físico (`PHYSICAL`) de `STR + AGI -> PHYS_ATK`.
 */

import type { ElementMatchupEntry } from '@etheria/shared';

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
  spawnWeight: number;
}

export class MonsterCombatBuilder {
  /** Multiplicadores por Raridade com buff reforçado nas classes A, S e SS. */
  public static readonly RARITY_PROFILES: Record<string, RarityScalingProfile> = {
    SS: { hp: 3.20, atk: 1.95, def: 1.70, spawnWeight: 1 },
    S: { hp: 2.15, atk: 1.60, def: 1.45, spawnWeight: 4 },
    A: { hp: 1.50, atk: 1.35, def: 1.25, spawnWeight: 15 },
    B: { hp: 1.10, atk: 1.05, def: 1.00, spawnWeight: 35 },
    C: { hp: 1.00, atk: 1.00, def: 1.00, spawnWeight: 70 },
    D: { hp: 0.90, atk: 0.90, def: 0.90, spawnWeight: 110 },
    F: { hp: 0.85, atk: 0.85, def: 0.85, spawnWeight: 140 },
    COMMON: { hp: 0.85, atk: 0.85, def: 0.85, spawnWeight: 140 },
  };

  public static async loadScalingContext(prisma: any): Promise<MonsterScalingContext> {
    const [conversions, battleMoveAttr, elementMatchups] = await Promise.all([
      prisma.attributeConversion.findMany(),
      prisma.combatAttribute.findUnique({ where: { code: 'BATTLE_MOVE_SPEED' } }),
      prisma.elementMatchup ? prisma.elementMatchup.findMany() : Promise.resolve([]),
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
    const key = String(rarityTier || 'F').trim().toUpperCase();
    return MonsterCombatBuilder.RARITY_PROFILES[key] || MonsterCombatBuilder.RARITY_PROFILES.F;
  }

  /**
   * Sorteia o nível do monstro no mapa com proteção para níveis iniciais (evitando picos exagerados).
   */
  public static resolveBalancedMapMonsterLevel(
    requiredLevel: number,
    levelVarianceMin?: number | null,
    levelVarianceMax?: number | null
  ): number {
    const reqLvl = Math.max(1, Math.min(100, Number(requiredLevel) || 1));
    const minVar = Number.isFinite(Number(levelVarianceMin)) ? Number(levelVarianceMin) : -2;
    const rawMaxVar = Number.isFinite(Number(levelVarianceMax)) ? Number(levelVarianceMax) : 5;
    // Em mapas iniciais (ex: Nv 1..10), limita a variação positiva proporcionalmente para manter curva justa
    const balancedMaxVar =
      rawMaxVar <= 2 ? rawMaxVar : Math.min(rawMaxVar, Math.max(2, Math.floor(reqLvl * 0.35)));
    const safeMin = Math.min(minVar, balancedMaxVar);
    const span = Math.max(0, balancedMaxVar - safeMin);
    const rolledVar = safeMin + Math.floor(Math.random() * (span + 1));
    return Math.max(1, Math.min(100, reqLvl + rolledVar));
  }

  /**
   * Constrói os atributos finais de combate de um Monstro usando 100% das conversões do banco,
   * sem redutores artificiais, com escalonamento balanceado de nível e tier de raridade.
   */
  public static buildMonsterUnit(
    template: any,
    monsterLevel: number,
    index: number,
    displayName: string,
    ctx: MonsterScalingContext,
    pagesBaseUrl: string
  ) {
    const mobLvl = Math.max(1, Math.min(100, Math.round(Number(monsterLevel) || 1)));
    const lvUps = Math.max(0, mobLvl - 1);
    const levelStatFactor = 1 + lvUps * 0.12;

    const rawBase = (template.baseAttributesJson as any) || {};
    const effStats = {
      VIT: (Number(rawBase.VIT) || 12) * levelStatFactor,
      STR: (Number(rawBase.STR) || 12) * levelStatFactor,
      INT: (Number(rawBase.INT) || 10) * levelStatFactor,
      WIS: (Number(rawBase.WIS) || 10) * levelStatFactor,
      AGI: (Number(rawBase.AGI) || 10) * levelStatFactor,
      DEX: (Number(rawBase.DEX) || 10) * levelStatFactor,
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
    const battleMoveSpeed = Math.round(ctx.globalDefaultMoveSpeed + Math.min(120, effStats.AGI * agiMoveRatio));

    const cb = (template.baseCombatAttributesJson as any) || {};
    const dexCritBonus = Math.max(0, effStats.DEX - 10) * this.getConversionRatio(ctx, 'DEX', 'CRIT_RATE', 0.002);
    const strCritDmgBonus = Math.max(0, effStats.STR - 10) * this.getConversionRatio(ctx, 'STR', 'CRIT_DMG', 0.003);
    const agiEvaBonusPct = Math.max(0, effStats.AGI - 10) * (this.getConversionRatio(ctx, 'AGI', 'PHYS_EVASION', 0.002) * 100);
    const wisEvaBonusPct = Math.max(0, effStats.WIS - 10) * (this.getConversionRatio(ctx, 'WIS', 'MAG_EVASION', 0.0015) * 100);
    const dexPhysAccBonusPct = Math.max(0, effStats.DEX - 10) * (this.getConversionRatio(ctx, 'DEX', 'PHYS_ACCURACY', 0.002) * 100);
    const dexMagAccBonusPct = Math.max(0, effStats.DEX - 10) * (this.getConversionRatio(ctx, 'DEX', 'MAG_ACCURACY', 0.002) * 100);

    const rarityAccBonus = rTier === 'SS' ? 12 : rTier === 'S' ? 8 : rTier === 'A' ? 4 : 0;
    const rarityCritBonus = rTier === 'SS' ? 0.10 : rTier === 'S' ? 0.06 : rTier === 'A' ? 0.03 : 0;

    const mobKey = template.mcreworkMonsterKey;

    return {
      id: `mob_${template.id}_${index}`,
      monsterTemplateId: Number(template.id),
      index,
      name: displayName,
      level: mobLvl,
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
      critRate: Math.min(0.80, (Number(cb.CRIT_RATE) || 5) / 100 + dexCritBonus + rarityCritBonus),
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
      physAccuracy: Math.min(125, Math.max(20, Math.round((Number(cb.PHYS_ACCURACY) || 95) + dexPhysAccBonusPct + rarityAccBonus))),
      physEvasion: Math.min(75, Math.max(0, Math.round((Number(cb.PHYS_EVASION) || 5) + agiEvaBonusPct))),
      magAccuracy: Math.min(125, Math.max(20, Math.round((Number(cb.MAG_ACCURACY) || 95) + dexMagAccBonusPct + rarityAccBonus))),
      magEvasion: Math.min(75, Math.max(0, Math.round((Number(cb.MAG_EVASION) || 5) + wisEvaBonusPct))),
      isAlive: true,
      activeStatuses: [],
    };
  }
}
