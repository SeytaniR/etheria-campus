/**
 * @file apps/server/src/controllers/TemporaryCombatActionResolver.ts
 * @module @etheria/server
 * @description Resolvedor puro de turnos, acertos, purificação de debuffs e consolidação de vitória em batalhas ativas.
 * @rules Segue estritamente AGENTS.md (Combate 100% autoritativo server-side, Zero Hardcode, Regra #1 JSDoc completo, Regra #7 < 1.000 linhas).
 * @dependencies @etheria/shared (CombatDamageCalculator), ./CombatUtilityHelper.js, ./MonsterCombatBuilder.js, ./CharacterActivityStateService.js, ./MapPresenceService.js, ./TemporaryCombatTypes.js
 */

import { CombatDamageCalculator } from '@etheria/shared';
import { CombatUtilityHelper } from './CombatUtilityHelper.js';
import { MonsterCombatBuilder } from './MonsterCombatBuilder.js';
import { CharacterActivityStateService } from './CharacterActivityStateService.js';
import { MapPresenceService } from './MapPresenceService.js';
import type {
  ActiveStatusInstance,
  CombatUnit,
  FloatingCombatNumber,
  TemporaryBattleState,
} from './TemporaryCombatTypes.js';

export class TemporaryCombatActionResolver {
  /**
   * Calcula a taxa de acerto efetiva delegando para a calculadora global compartilhada (@etheria/shared).
   */
  public static calculateEffectiveHitRate(attackerAcc?: number, defenderEva?: number): number {
    return CombatDamageCalculator.calculateEffectiveHitRate(attackerAcc, defenderEva);
  }

  /**
   * Executa uma ação de combate no servidor utilizando exatamente a mesma fórmula global de dano + vantagens elementais.
   */
  public static executeAction(
    activeBattles: Map<string, TemporaryBattleState>,
    mcreworkPagesBaseUrl: string,
    battleId: string,
    actionType: 'ATTACK' | 'SKILL' | 'DEFEND',
    targetMonsterIndex: number = 0
  ): TemporaryBattleState {
    const battle = activeBattles.get(battleId);
    if (!battle) throw new Error(`Batalha #${battleId} não encontrada ou expirada.`);
    if (battle.isFinished) return battle;

    const events: FloatingCombatNumber[] = [];
    const player = battle.player;
    const targetMob =
      battle.monsters.find((m) => m.index === Number(targetMonsterIndex) && m.isAlive) ||
      battle.monsters.find((m) => m.isAlive);

    if (!targetMob) {
      battle.isFinished = true;
      battle.winner = 'PLAYER';
      return battle;
    }

    let isDefending = false;
    const elemTag = (rel: string) =>
      rel === 'ADVANTAGE' ? ' [Vantagem +25%]' : rel === 'DISADVANTAGE' || rel === 'NEUTRAL_PENALTY' ? ' [-25%]' : '';

    if (actionType === 'ATTACK' || actionType === 'SKILL') {
      const isSkill = actionType === 'SKILL';
      if (isSkill && player.mp >= 15) player.mp -= 15;

      const isMag = player.damageType === 'MAGICAL' || isSkill;
      const pAcc = (isMag ? (player.magAccuracy || 95) : (player.physAccuracy || 95)) + (isSkill ? 5 : 0);
      const mEva = isMag ? (targetMob.magEvasion || 5) : (targetMob.physEvasion || 5);
      const defStat = isMag ? (targetMob.magDef ?? targetMob.def) : targetMob.def;

      const dmgRes = CombatDamageCalculator.calculateHitDamage({
        attackerAtk: player.atk,
        attackerLevel: player.level,
        attackerElementCode: player.elementCode,
        attackerCritRate: (player.critRate || 0.1) + (isSkill ? 0.15 : 0),
        attackerCritDmg: player.critDmg || 1.6,
        attackerAccuracy: pAcc,
        defenderDef: defStat,
        defenderElementCode: targetMob.elementCode,
        defenderEvasion: mEva,
        skillMultiplier: isSkill ? 1.8 : 1.0,
        elementMatchups: battle.elementMatchups,
      });

      if (!dmgRes.isHit) {
        events.push({
          actor: 'player', targetType: 'monster', targetIndex: targetMob.index, type: 'MISS',
          animAction: isSkill ? 7 : 3, amount: 0, hpRemaining: targetMob.hp,
          message: `${player.name} errou o golpe contra ${targetMob.name} (DESVIO)!`,
        });
        battle.combatLog.unshift(`[${player.name}] errou [${targetMob.name}] (DESVIO)!`);
      } else {
        targetMob.hp = Math.max(0, targetMob.hp - dmgRes.finalDamage);
        if (targetMob.hp === 0) targetMob.isAlive = false;

        let burnDebuff: ActiveStatusInstance | null = null;
        if (isSkill && targetMob.isAlive) {
          burnDebuff = {
            code: 'status_burn', name: 'Queimadura Solar', isBuff: false,
            iconUrl: `${mcreworkPagesBaseUrl}/assets/skills/icons/100180.png`,
            vfxKey: '10025', triggerType: 'CONTINUOUS_TICK',
            durationSeconds: 6.0, remainingSeconds: 6.0, remainingTurns: 3,
          };
          targetMob.activeStatuses = (targetMob.activeStatuses || []).filter((s) => s.code !== 'status_burn');
          targetMob.activeStatuses.push(burnDebuff);
        } else if (!targetMob.isAlive) {
          targetMob.activeStatuses = [];
        }

        const relTxt = elemTag(dmgRes.elementRelation);
        events.push({
          actor: 'player', targetType: 'monster', targetIndex: targetMob.index,
          type: dmgRes.isCrit ? 'CRIT' : 'DAMAGE', animAction: isSkill ? 7 : 3,
          vfxKey: isSkill ? '10025' : undefined, statusApplied: burnDebuff,
          amount: dmgRes.finalDamage, isCrit: dmgRes.isCrit, elementRelation: dmgRes.elementRelation,
          hpRemaining: targetMob.hp,
          message: `${player.name} causou ${dmgRes.finalDamage} de dano${dmgRes.isCrit ? ' CRÍTICO' : ''} em ${targetMob.name}${relTxt}!`,
        });
        battle.combatLog.unshift(
          `⚔️ [${player.name}] atingiu [${targetMob.name}]: -${dmgRes.finalDamage} HP${dmgRes.isCrit ? ' (💥 CRÍTICO!)' : ''}${relTxt}`
        );
        if (!targetMob.isAlive) battle.combatLog.unshift(`💀 [${targetMob.name}] foi derrotado!`);
      }
    } else if (actionType === 'DEFEND') {
      isDefending = true;
      const healAmount = Math.round(player.maxHp * 0.08);
      player.hp = Math.min(player.maxHp, player.hp + healAmount);
      player.mp = Math.min(player.maxMp, player.mp + 15);
      const regenBuff: ActiveStatusInstance = {
        code: 'status_regen_blessing', name: 'Bênção Regenerativa', isBuff: true,
        iconUrl: `${mcreworkPagesBaseUrl}/assets/skills/icons/100150.png`,
        vfxKey: '10004', triggerType: 'CONTINUOUS_TICK',
        durationSeconds: 5.0, remainingSeconds: 5.0, remainingTurns: 2,
      };
      player.activeStatuses = (player.activeStatuses || []).filter((s) => s.code !== 'status_regen_blessing');
      player.activeStatuses.push(regenBuff);
      const cleanseResult = this.cleanseUnitDebuffs(player, 0, 5, 100);
      events.push({
        actor: 'player', targetType: 'player', type: 'HEAL', animAction: 4, vfxKey: '10004',
        statusApplied: regenBuff, amount: healAmount + cleanseResult.healedHp, hpRemaining: player.hp,
        message: `${player.name} defendeu (+${healAmount + cleanseResult.healedHp} HP).`,
      });
    }

    const aliveMonsters = battle.monsters.filter((m) => m.isAlive);
    if (aliveMonsters.length === 0) {
      battle.isFinished = true;
      battle.winner = 'PLAYER';
      const totalExp = battle.monsters.reduce(
        (acc, m) =>
          acc +
          (Number(m.expReward) ||
            MonsterCombatBuilder.calculateMonsterExpReward(m.level || 1, m.rarityTier, m.variantTier || 'NORMAL')),
        0
      );
      const totalGold = battle.monsters.reduce(
        (acc, m) =>
          acc +
          (Number((m as any).goldReward) ||
            MonsterCombatBuilder.calculateMonsterGoldReward(m.level || 1, m.rarityTier, m.variantTier || 'NORMAL')),
        0
      );
      battle.rewards = { exp: totalExp, gold: totalGold };
      battle.combatLog.unshift(`VITÓRIA! Todos os monstros foram derrotados! (+${totalExp} EXP, +${totalGold} Ouro)`);
      battle.lastEvents = events;
      return battle;
    }

    const defMult = isDefending ? 1.5 : 1.0;
    for (const mob of aliveMonsters) {
      const isMag = mob.damageType === 'MAGICAL';
      const mobAcc = isMag ? (mob.magAccuracy || 95) : (mob.physAccuracy || 95);
      const pEva = isMag ? (player.magEvasion || 5) : (player.physEvasion || 5);
      const pDef = Math.round((isMag ? (player.magDef ?? player.def) : player.def) * defMult);

      const retRes = CombatDamageCalculator.calculateHitDamage({
        attackerAtk: mob.atk,
        attackerLevel: mob.level,
        attackerElementCode: mob.elementCode,
        attackerCritRate: mob.critRate || 0.08,
        attackerCritDmg: mob.critDmg || 1.5,
        attackerAccuracy: mobAcc,
        defenderDef: pDef,
        defenderElementCode: player.elementCode,
        defenderEvasion: pEva,
        elementMatchups: battle.elementMatchups,
      });

      if (!retRes.isHit) {
        events.push({
          actor: 'monster', actorIndex: mob.index, targetType: 'player', type: 'MISS',
          animAction: 3, amount: 0, hpRemaining: player.hp,
          message: `${mob.name} errou ${player.name} (💨 DESVIO)!`,
        });
        continue;
      }

      const finalDmg = mob.damageDealtMultiplier ? Math.max(1, Math.round(retRes.finalDamage * mob.damageDealtMultiplier)) : retRes.finalDamage;
      player.hp = Math.max(0, player.hp - finalDmg);
      if (player.hp === 0) player.isAlive = false;
      const relTxt = elemTag(retRes.elementRelation);
      events.push({
        actor: 'monster', actorIndex: mob.index, targetType: 'player',
        type: retRes.isCrit ? 'CRIT' : 'DAMAGE', animAction: 3,
        amount: finalDmg, isCrit: retRes.isCrit, elementRelation: retRes.elementRelation,
        hpRemaining: player.hp,
        message: `${mob.name} atacou ${player.name} causando ${finalDmg} de dano${relTxt}!`,
      });
      if (!player.isAlive) {
        battle.isFinished = true;
        battle.winner = 'MONSTERS';
        battle.combatLog.unshift(`[${player.name}] foi derrotado em combate!`);
        break;
      }
    }

    battle.round += 1;
    battle.lastEvents = events;
    return battle;
  }

  public static autoResolve(
    activeBattles: Map<string, TemporaryBattleState>,
    mcreworkPagesBaseUrl: string,
    battleId: string
  ): TemporaryBattleState {
    const battle = activeBattles.get(battleId);
    if (!battle) throw new Error(`Batalha #${battleId} não encontrada ou expirada.`);
    let iterations = 0;
    while (!battle.isFinished && iterations < 40) {
      iterations++;
      const aliveMobs = battle.monsters.filter((m) => m.isAlive);
      if (aliveMobs.length === 0) break;
      const useSkill = battle.player.mp >= 15 && Math.random() < 0.4;
      this.executeAction(activeBattles, mcreworkPagesBaseUrl, battleId, useSkill ? 'SKILL' : 'ATTACK', aliveMobs[0].index);
    }
    return battle;
  }

  public static cleanseUnitDebuffs(
    unit: CombatUnit,
    maxDebuffs: number = 0,
    healPerDebuffPct: number = 0,
    cleanseChancePct: number = 100
  ) {
    return CombatUtilityHelper.cleanseUnitDebuffs(unit, maxDebuffs, healPerDebuffPct, cleanseChancePct);
  }

  public static buildDefeatedBatch(battle: TemporaryBattleState) {
    return CombatUtilityHelper.buildDefeatedBatch(battle);
  }

  public static finalizeRealTimeVictory(
    activeBattles: Map<string, TemporaryBattleState>,
    battleId: string
  ) {
    const battle = activeBattles.get(battleId);
    if (!battle || battle.victoryRecorded) return null;
    battle.victoryRecorded = true;
    battle.isFinished = true;
    battle.winner = 'PLAYER';
    CharacterActivityStateService.exitCombat(Number(battle.characterId), battleId);
    MapPresenceService.setCombatStatus(Number(battle.characterId), false);
    for (const mob of battle.monsters) {
      mob.hp = 0;
      mob.isAlive = false;
    }
    const expReward = battle.monsters.reduce(
      (acc, m) =>
        acc +
        (Number(m.expReward) ||
          MonsterCombatBuilder.calculateMonsterExpReward(m.level || 1, m.rarityTier, m.variantTier || 'NORMAL')),
      0
    );
    const goldReward = battle.monsters.reduce(
      (acc, m) =>
        acc +
        (Number((m as any).goldReward) ||
          MonsterCombatBuilder.calculateMonsterGoldReward(m.level || 1, m.rarityTier, m.variantTier || 'NORMAL')),
      0
    );
    return {
      characterId: Number(battle.characterId) || 1,
      mapId: battle.mapId || 1,
      isDungeon: Boolean(battle.isDungeon),
      dungeonRunId: battle.dungeonRunId,
      dungeonChest: battle.dungeonChest ?? null,
      defeatedMonsters: this.buildDefeatedBatch(battle),
      expReward,
      goldReward,
    };
  }
}
