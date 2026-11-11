/**
 * @file apps/server/src/controllers/CombatUtilityHelper.ts
 * @module @etheria/server
 * @description Utilitários puros de suporte ao combate temporário (Limpeza de Debuffs e Agrupamento de Monstros Derrotados para Quests).
 */

export interface CleanseResult {
  removedCount: number;
  removedNames: string[];
  healedHp: number;
}

export class CombatUtilityHelper {
  /**
   * Processador procedural de Limpeza de Debuffs (`CLEANSE_DISPEL` / gatilhos `ON_DEBUFF_RECEIVED` e `ON_TURN_START_CLEANSE`).
   */
  public static cleanseUnitDebuffs(
    unit: { isAlive: boolean; hp: number; maxHp: number; activeStatuses?: any[] },
    maxDebuffs: number = 0,
    healPerDebuffPct: number = 0,
    cleanseChancePct: number = 100
  ): CleanseResult {
    if (!unit || !unit.isAlive || !Array.isArray(unit.activeStatuses) || unit.activeStatuses.length === 0) {
      return { removedCount: 0, removedNames: [], healedHp: 0 };
    }
    const chance = Math.max(0, Math.min(100, Number(cleanseChancePct) || 100));
    if (Math.random() * 100 > chance) {
      return { removedCount: 0, removedNames: [], healedHp: 0 };
    }

    const limit = Number(maxDebuffs) > 0 ? Number(maxDebuffs) : Infinity;
    const removedNames: string[] = [];
    const remaining: any[] = [];

    for (const st of unit.activeStatuses) {
      if (!st.isBuff && removedNames.length < limit) {
        removedNames.push(st.name || st.code);
      } else {
        remaining.push(st);
      }
    }

    unit.activeStatuses = remaining;

    let healedHp = 0;
    const healPct = Math.max(0, Number(healPerDebuffPct) || 0);
    if (removedNames.length > 0 && healPct > 0) {
      healedHp = Math.round(unit.maxHp * (healPct / 100) * removedNames.length);
      unit.hp = Math.min(unit.maxHp, unit.hp + healedHp);
    }

    return {
      removedCount: removedNames.length,
      removedNames,
      healedHp,
    };
  }

  /**
   * Agrupa monstros derrotados de uma batalha (inclusive encontros mistos) por ID e Raça.
   */
  public static buildDefeatedBatch(
    battle: { monsterTemplateId?: number; monsters?: Array<{ monsterTemplateId?: number; raceCode?: string }> }
  ): Array<{ monsterTemplateId: number; raceCode: string; count: number }> {
    const grouped = new Map<string, { monsterTemplateId: number; raceCode: string; count: number }>();
    for (const mob of battle.monsters || []) {
      const mobId = Number(mob.monsterTemplateId || battle.monsterTemplateId || 1);
      const raceCode = String(mob.raceCode || 'BEAST').toUpperCase();
      const key = `${mobId}:${raceCode}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        grouped.set(key, { monsterTemplateId: mobId, raceCode, count: 1 });
      }
    }
    return Array.from(grouped.values());
  }
}
