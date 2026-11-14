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
 */

import type { ElementMatchupEntry } from '@etheria/shared';

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
  /**
   * Multiplicadores oficiais por Rank:
   * F = 1.0x em tudo, 0% crit, 0 prec
   * D = 1.3x em tudo, 0% crit, 0 prec
   * C = 1.5x em tudo, 5% crit, 0 prec
   * B = 1.8x em tudo, 5% crit, 5 prec
   * A = 2.1x em tudo, 10% crit, 5 prec
   * S = 2.7x em tudo, 15% crit, 5 prec
   * SS = 4.0x em tudo, 20% crit, 10 prec
   */
  public static readonly RARITY_PROFILES: Record<string, RarityScalingProfile> = {
    SS: { hp: 4.0, atk: 4.0, def: 4.0, critBonus: 0.20, accBonus: 10, spawnWeight: 1 },
    S: { hp: 2.7, atk: 2.7, def: 2.7, critBonus: 0.15, accBonus: 5, spawnWeight: 4 },
    A: { hp: 2.1, atk: 2.1, def: 2.1, critBonus: 0.10, accBonus: 5, spawnWeight: 15 },
    B: { hp: 1.8, atk: 1.8, def: 1.8, critBonus: 0.05, accBonus: 5, spawnWeight: 35 },
    C: { hp: 1.5, atk: 1.5, def: 1.5, critBonus: 0.05, accBonus: 0, spawnWeight: 70 },
    D: { hp: 1.3, atk: 1.3, def: 1.3, critBonus: 0.00, accBonus: 0, spawnWeight: 110 },
    F: { hp: 1.0, atk: 1.0, def: 1.0, critBonus: 0.00, accBonus: 0, spawnWeight: 140 },
    COMMON: { hp: 1.0, atk: 1.0, def: 1.0, critBonus: 0.00, accBonus: 0, spawnWeight: 140 },
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
   * Sorteia o nível do monstro no mapa com variação de -10 a +10 em relação ao nível do mapa
   * (ex: se o mapa é nível 100, os monstros nascem com nível entre 90 e 110).
   */
  public static resolveBalancedMapMonsterLevel(
    requiredLevel: number,
    _levelVarianceMin?: number | null,
    _levelVarianceMax?: number | null
  ): number {
    const reqLvl = Math.max(1, Math.round(Number(requiredLevel) || 1));
    const minLvl = Math.max(1, reqLvl - 10);
    const maxLvl = Math.max(minLvl, reqLvl + 10);
    return minLvl + Math.floor(Math.random() * (maxLvl - minLvl + 1));
  }

  /**
   * Constrói os atributos finais de combate de um Monstro usando 100% das conversões do banco,
   * escalonamento de +20% por nível, multiplicadores de Rank (F..SS) e hierarquia (NORMAL/LEADER/BOSS).
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
    const mobLvl = Math.max(1, Math.round(Number(monsterLevel) || 1));
    const lvUps = Math.max(0, mobLvl - 1);
    // Cada nível aplica um bônus de +20% nos atributos do monstro
    const levelStatFactor = 1 + lvUps * 0.20;
    // Bônus de Hierarquia: Básico = 1x, Líder = 2x atributos base, Boss = 4x status
    const variantStatMultiplier = variantTier === 'BOSS' ? 4.0 : variantTier === 'LEADER' ? 2.0 : 1.0;
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
    const battleMoveSpeed = Math.round(baseMoveSpeed + Math.min(120, effStats.AGI * agiMoveRatio));
    const dexCritBonus = Math.max(0, effStats.DEX - 10) * this.getConversionRatio(ctx, 'DEX', 'CRIT_RATE', 0.002);
    const strCritDmgBonus = Math.max(0, effStats.STR - 10) * this.getConversionRatio(ctx, 'STR', 'CRIT_DMG', 0.003);
    const agiEvaBonusPct = Math.max(0, effStats.AGI - 10) * (this.getConversionRatio(ctx, 'AGI', 'PHYS_EVASION', 0.002) * 100);
    const wisEvaBonusPct = Math.max(0, effStats.WIS - 10) * (this.getConversionRatio(ctx, 'WIS', 'MAG_EVASION', 0.0015) * 100);
    const dexPhysAccBonusPct = Math.max(0, effStats.DEX - 10) * (this.getConversionRatio(ctx, 'DEX', 'PHYS_ACCURACY', 0.002) * 100);
    const dexMagAccBonusPct = Math.max(0, effStats.DEX - 10) * (this.getConversionRatio(ctx, 'DEX', 'MAG_ACCURACY', 0.002) * 100);

    const rarityAccBonus = rarity.accBonus;
    const rarityCritBonus = rarity.critBonus;

    const mobKey = template.mcreworkMonsterKey;
    const modelScale = variantTier === 'BOSS' ? 1.65 : variantTier === 'LEADER' ? 1.28 : 1.0;
    const nameColorHex = variantTier === 'BOSS' ? '#fb7185' : variantTier === 'LEADER' ? '#38bdf8' : '#f8fafc';
    const rewardMultiplier = variantTier === 'BOSS' ? 4 : variantTier === 'LEADER' ? 2 : 1;

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
      if (hasNum(ov.battleMoveSpeed)) u.battleMoveSpeed = Math.max(40, Math.round(Number(ov.battleMoveSpeed)));
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
