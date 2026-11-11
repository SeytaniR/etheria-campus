/**
 * @file packages/shared/src/CombatDamageCalculator.ts
 * @module @etheria/shared
 * @description Calculadora Universal de Acerto, Desvio, Mitigação Defensiva e Multiplicadores
 *   Elementais compartilha 100% entre o Servidor (@etheria/server) e a Arena 2.5D (/play).
 * @rules
 *   - Acerto e Desvio seguem teto/piso estritos: Evitação máx 75%, Acerto máx 125%, Chance final [10%..95%].
 *   - Mitigação de Defesa assintótica por nível (`docs/ARCHITECTURE.md` §4.2):
 *     `(100 + 10 * lvlAtacante) / (defEfetiva + 100 + 10 * lvlAtacante)`.
 *   - Vantagem/Desvantagem Elemental lida diretamente de `element_matchups` (`FIRE > EARTH > AIR > WATER > FIRE` ±25%, `NEUTRAL` -25% causado / +25% recebido).
 */

export interface ElementMatchupEntry {
  attackerElementCode: string;
  defenderElementCode: string;
  damageMultiplier: number;
}

export type ElementRelationType = 'ADVANTAGE' | 'DISADVANTAGE' | 'NEUTRAL_PENALTY' | 'NORMAL';

export interface DamageCalculationInput {
  attackerAtk: number;
  attackerLevel: number;
  attackerElementCode?: string | null;
  attackerCritRate?: number;
  attackerCritDmg?: number;
  attackerAccuracy?: number;
  defenderDef: number;
  defenderElementCode?: string | null;
  defenderEvasion?: number;
  skillMultiplier?: number;
  elementMatchups?: ElementMatchupEntry[];
  skipDefenseMitigation?: boolean;
  forceHit?: boolean;
  forceCrit?: boolean;
  varianceMin?: number;
  varianceMax?: number;
}

export interface DamageCalculationResult {
  isHit: boolean;
  isCrit: boolean;
  hitRate: number;
  finalDamage: number;
  defenseMultiplier: number;
  elementMultiplier: number;
  elementRelation: ElementRelationType;
}

export class CombatDamageCalculator {
  private static readonly ELEMENT_CYCLE_STRONG: Record<string, string> = {
    FIRE: 'EARTH',
    EARTH: 'AIR',
    AIR: 'WATER',
    WATER: 'FIRE',
  };

  /**
   * Calcula a taxa efetiva de acerto (%) respeitando os tetos oficiais do projeto ([10%..95%]).
   */
  public static calculateEffectiveHitRate(attackerAcc?: number, defenderEva?: number): number {
    const rawAcc = Number(attackerAcc);
    const rawEva = Number(defenderEva);
    const acc = Number.isFinite(rawAcc) && rawAcc <= 1.5 && rawAcc > 0 ? rawAcc * 100 : (Number.isFinite(rawAcc) ? rawAcc : 95);
    const eva = Number.isFinite(rawEva) && rawEva <= 1.5 && rawEva > 0 ? rawEva * 100 : (Number.isFinite(rawEva) ? rawEva : 5);
    const clampedEva = Math.min(75, Math.max(0, eva));
    const clampedAcc = Math.min(125, Math.max(20, acc));
    return Math.max(10, Math.min(95, clampedAcc - clampedEva));
  }

  /**
   * Resolve o multiplicador elemental a partir da tabela `element_matchups` do banco
   * (ou ciclo oficial FIRE > EARTH > AIR > WATER > FIRE + penalidade NEUTRAL como fallback).
   */
  public static resolveElementMultiplier(
    attackerElement?: string | null,
    defenderElement?: string | null,
    matchups?: ElementMatchupEntry[]
  ): number {
    const atkEl = String(attackerElement || 'NEUTRAL').trim().toUpperCase() || 'NEUTRAL';
    const defEl = String(defenderElement || 'NEUTRAL').trim().toUpperCase() || 'NEUTRAL';

    if (Array.isArray(matchups) && matchups.length > 0) {
      const exact = matchups.find(
        (m) =>
          String(m.attackerElementCode || '').toUpperCase() === atkEl &&
          String(m.defenderElementCode || '').toUpperCase() === defEl
      );
      if (exact && Number.isFinite(Number(exact.damageMultiplier))) {
        return Number(exact.damageMultiplier);
      }
    }

    if (atkEl === 'NEUTRAL') {
      return 0.75;
    }
    if (defEl === 'NEUTRAL') {
      return 1.25;
    }
    if (CombatDamageCalculator.ELEMENT_CYCLE_STRONG[atkEl] === defEl) {
      return 1.25;
    }
    if (CombatDamageCalculator.ELEMENT_CYCLE_STRONG[defEl] === atkEl) {
      return 0.75;
    }
    return 1.0;
  }

  public static classifyElementRelation(
    elementMultiplier: number,
    attackerElement?: string | null
  ): ElementRelationType {
    const atkEl = String(attackerElement || 'NEUTRAL').trim().toUpperCase();
    if (elementMultiplier > 1.05) return 'ADVANTAGE';
    if (elementMultiplier < 0.95) {
      return atkEl === 'NEUTRAL' ? 'NEUTRAL_PENALTY' : 'DISADVANTAGE';
    }
    return 'NORMAL';
  }

  /**
   * Mitigação proporcional por nível (`(100 + 10 * lvl) / (def + 100 + 10 * lvl)`).
   */
  public static computeDefenseMultiplier(defenderDef: number, attackerLevel: number): number {
    const safeDef = Math.max(0, Number(defenderDef) || 0);
    const safeLvl = Math.max(1, Number(attackerLevel) || 1);
    const baseline = 100 + 10 * safeLvl;
    return baseline / (safeDef + baseline);
  }

  /**
   * Calcula um impacto completo (acerto, mitigação por defesa/nível, vantagem elemental, crítico e variação).
   */
  public static calculateHitDamage(input: DamageCalculationInput): DamageCalculationResult {
    const hitRate = this.calculateEffectiveHitRate(input.attackerAccuracy, input.defenderEvasion);
    const elementMultiplier = this.resolveElementMultiplier(
      input.attackerElementCode,
      input.defenderElementCode,
      input.elementMatchups
    );
    const elementRelation = this.classifyElementRelation(elementMultiplier, input.attackerElementCode);
    const defenseMultiplier = input.skipDefenseMitigation
      ? 1.0
      : this.computeDefenseMultiplier(input.defenderDef, input.attackerLevel);

    if (!input.forceHit && Math.random() * 100 > hitRate) {
      return {
        isHit: false,
        isCrit: false,
        hitRate,
        finalDamage: 0,
        defenseMultiplier,
        elementMultiplier,
        elementRelation,
      };
    }

    const baseAtk = Math.max(1, Number(input.attackerAtk) || 10);
    const skillMult = Math.max(0.1, Number(input.skillMultiplier) || 1.0);
    const vMin = input.varianceMin ?? 0.92;
    const vMax = input.varianceMax ?? 1.08;
    const variance = vMin + Math.random() * Math.max(0, vMax - vMin);

    const critRate = Math.max(0, Math.min(0.8, Number(input.attackerCritRate) || 0.05));
    const critDmg = Math.max(1.1, Math.min(3.0, Number(input.attackerCritDmg) || 1.5));
    const isCrit = input.forceCrit !== undefined ? input.forceCrit : Math.random() < critRate;

    let raw = baseAtk * skillMult * defenseMultiplier * elementMultiplier * variance;
    if (isCrit) {
      raw *= critDmg;
    }

    return {
      isHit: true,
      isCrit,
      hitRate,
      finalDamage: Math.max(4, Math.round(raw)),
      defenseMultiplier,
      elementMultiplier,
      elementRelation,
    };
  }
}
