/**
 * @file apps/server/public/play/js/ActionSkillEngine.js
 * @module @etheria/server
 * @description Motor Modular de Execução de Habilidades Action & Efeitos de Status (`skill_templates`
 *   e `status_effect_templates`) na Arena 2.5D (`/play`).
 *   - Movimentos Action: Dash Linear, Salto AoE, Teleporte nas Costas, Avanço Melee, Conjurador Parado.
 *   - Geometrias Action: Cone Frontal, Linha Perfurante, AoE ao redor, AoE Circular, Zonas Persistentes no Solo.
 *   - Blocos Visuais completos: DAMAGE (composto, PEN, lifesteal, execução, bônus/anomalia, -CD/crit, +HP/alvo),
 *     HEAL (composto, menor % HP), SHIELD (composto), STATUS (CC/Anomalia/DoT/HoT/Retaliação), CLEANSE_DISPEL tipado e RESOURCE_COOLDOWN.
 * @rules Segue AGENTS.md (Pilar 3: OOP, Pilar 4: Zero Hardcode, Regra #7 < 1.000 linhas).
 * @dependencies CombatDamageCalculator, ArenaPhysicsSolver, ActionVfxRenderer
 */

class ActionSkillEngine {
  static hasControlFlag(unit, flag) {
    const statuses = Array.isArray(unit?.activeStatuses) ? unit.activeStatuses : [];
    return statuses.some((st) => Array.isArray(st.controlFlagsJson) && st.controlFlagsJson.includes(flag));
  }

  static isActionBlocked(unit) {
    return (
      ActionSkillEngine.hasControlFlag(unit, 'STUN') ||
      ActionSkillEngine.hasControlFlag(unit, 'PARALYSIS') ||
      ActionSkillEngine.hasControlFlag(unit, 'FREEZE') ||
      ActionSkillEngine.hasControlFlag(unit, 'SLEEP')
    );
  }

  static isSilenced(unit) {
    return ActionSkillEngine.hasControlFlag(unit, 'SILENCE');
  }

  static getTaunter(unit) {
    const statuses = Array.isArray(unit?.activeStatuses) ? unit.activeStatuses : [];
    for (const st of statuses) {
      if (Array.isArray(st.controlFlagsJson) && st.controlFlagsJson.includes('TAUNT') && st.sourceUnit?.isAlive) {
        return st.sourceUnit;
      }
    }
    return null;
  }

  static getEffectiveStats(unit) {
    const sumMod = (code) => {
      let total = 0;
      for (const st of unit?.activeStatuses || []) {
        const val = Number(st.statModifiersJson?.[code]) || 0;
        if (val) total += val * Math.max(1, Number(st.stacks) || 1);
      }
      return total;
    };

    const pct = (base, pctVal, minVal = 1) => Math.max(minVal, base * (1 + pctVal / 100));
    const atkGen = sumMod('ATK_PCT');
    const defGen = sumMod('DEF_PCT');
    const spdGen = sumMod('SPEED_PCT');
    const isSlowed = ActionSkillEngine.hasControlFlag(unit, 'SLOW');
    const blindPenalty = ActionSkillEngine.hasControlFlag(unit, 'BLIND') ? -15 : 0;

    return {
      maxHp: Math.max(1, Number(unit.maxHp) || 300),
      maxMp: Math.max(1, Number(unit.maxMp) || 100),
      physAtk: pct(Number(unit.physAtk ?? unit.atk) || 40, sumMod('PHYS_ATK_PCT') + atkGen, 4),
      magAtk: pct(Number(unit.magAtk ?? unit.atk) || 40, sumMod('MAG_ATK_PCT') + atkGen, 4),
      healPower: pct(Number(unit.healPower ?? unit.atk) || 40, sumMod('HEAL_POWER_PCT'), 4),
      atk: pct(Number(unit.atk) || 40, (unit.damageType === 'MAGICAL' ? sumMod('MAG_ATK_PCT') : sumMod('PHYS_ATK_PCT')) + atkGen, 4),
      physDef: pct(Number(unit.def) || 25, sumMod('PHYS_DEF_PCT') + defGen, 0),
      magDef: pct(Number(unit.magDef ?? unit.def) || 25, sumMod('MAG_DEF_PCT') + defGen, 0),
      attackSpeed: Math.max(0.25, (Number(unit.attackSpeed) || 1.0) * (1 + sumMod('ATTACK_SPEED_PCT') / 100)),
      moveSpeedMult: Math.max(0.2, 1 + (sumMod('BATTLE_MOVE_SPEED_PCT') + spdGen + (isSlowed && !sumMod('BATTLE_MOVE_SPEED_PCT') ? -25 : 0)) / 100),
      physEvasion: Math.max(0, Math.min(75, (Number(unit.physEvasion) || 5) + sumMod('PHYS_EVASION_PCT'))),
      magEvasion: Math.max(0, Math.min(75, (Number(unit.magEvasion) || 5) + sumMod('MAG_EVASION_PCT'))),
      physAccuracy: Math.max(20, Math.min(125, (Number(unit.physAccuracy) || 95) + sumMod('PHYS_ACCURACY_PCT') + blindPenalty)),
      magAccuracy: Math.max(20, Math.min(125, (Number(unit.magAccuracy) || 95) + sumMod('MAG_ACCURACY_PCT') + blindPenalty)),
      critRate: Math.max(0, Math.min(0.95, (Number(unit.critRate) || 0.05) + sumMod('CRIT_RATE_PCT') / 100)),
      critDmg: Math.max(1.1, Math.min(3.5, (Number(unit.critDmg) || 1.5) + sumMod('CRIT_DMG_PCT') / 100)),
      physPenPct: Math.max(0, Math.min(100, sumMod('PHYS_PEN_PCT'))),
      magPenPct: Math.max(0, Math.min(100, sumMod('MAG_PEN_PCT'))),
      attackRange: Math.max(35, (Number(unit.attackRange) || 60) + sumMod('ATTACK_RANGE_FLAT')),
      controlResistPct: Math.max(0, Math.min(90, sumMod('CONTROL_RESIST_PCT'))),
      healReceivedMult: Math.max(0.1, 1 + sumMod('HEAL_RECEIVED_PCT') / 100),
      reflectMeleePct: Math.max(0, Math.min(100, sumMod('REFLECT_MELEE_PCT'))),
      extraMpCostPct: Math.max(0, sumMod('EXTRA_MP_COST_PCT')),
    };
  }

  static readStatFromUnit(unit, statCode) {
    const eff = ActionSkillEngine.getEffectiveStats(unit);
    switch (statCode) {
      case 'PHYS_ATK': return eff.physAtk;
      case 'MAG_ATK': return eff.magAtk;
      case 'HEAL_POWER': return eff.healPower;
      case 'PHYS_DEF': return eff.physDef;
      case 'MAG_DEF': return eff.magDef;
      case 'DEF': return unit.damageType === 'MAGICAL' ? eff.magDef : eff.physDef;
      case 'MAX_HP': return eff.maxHp;
      case 'MAX_MP': return eff.maxMp;
      case 'SPEED': return Number(unit.speed) || 40;
      default: return eff.atk;
    }
  }

  static evaluateFormula(unit, scaleStat, scalePct, secStat, secPct, flatAmount) {
    const p1 = ActionSkillEngine.readStatFromUnit(unit, scaleStat) * ((Number(scalePct) || 0) / 100);
    const p2 = secStat && secStat !== 'NONE' && Number(secPct) > 0
      ? ActionSkillEngine.readStatFromUnit(unit, secStat) * (Number(secPct) / 100)
      : 0;
    return Math.max(0, p1 + p2 + (Number(flatAmount) || 0));
  }

  static resolveTargets(arena, caster, primaryTarget, scope, castRange, aoeRadius, coneAngleDeg = 90, lineWidthPx = 48) {
    const isCasterAlly = caster.team === 'ALLY';
    const allies = (isCasterAlly ? [arena.player, ...arena.pets] : arena.monsters).filter((u) => u && u.isAlive);
    const enemies = (isCasterAlly ? arena.monsters : [arena.player, ...arena.pets]).filter((u) => u && u.isAlive);
    const maxR = Math.max(40, Number(castRange) || 160);
    const areaR = Math.max(40, Number(aoeRadius) || maxR);

    switch (scope) {
      case 'SELF':
        return [caster];
      case 'ALLY_SINGLE':
        return [primaryTarget && primaryTarget.team === caster.team && primaryTarget.isAlive ? primaryTarget : caster];
      case 'ALLY_LOWEST_HP_PCT': {
        const sorted = [...allies].sort((a, b) => a.hp / Math.max(1, a.maxHp) - b.hp / Math.max(1, b.maxHp));
        return sorted[0] ? [sorted[0]] : [caster];
      }
      case 'ALLY_ALL':
        return allies.filter((u) => Number(castRange) <= 0 || Math.hypot(u.x - caster.x, u.y - caster.y) <= Math.max(areaR, maxR));
      case 'ALL_ENEMIES':
      case 'ROW_FRONT':
        return enemies;
      case 'AOE_SELF_AROUND':
        return enemies.filter((u) => Math.hypot(u.x - caster.x, u.y - caster.y) <= areaR);
      case 'AOE_CIRCLE':
      case 'GROUND_ZONE': {
        const cx = primaryTarget ? primaryTarget.x : caster.x;
        const cy = primaryTarget ? primaryTarget.y : caster.y;
        return enemies.filter((u) => Math.hypot(u.x - cx, u.y - cy) <= areaR);
      }
      case 'CONE_FRONTAL': {
        const dirX = primaryTarget ? primaryTarget.x - caster.x : 1;
        const dirY = primaryTarget ? primaryTarget.y - caster.y : 0;
        const baseAng = Math.atan2(dirY, dirX);
        const halfRad = ((Number(coneAngleDeg) || 90) * Math.PI) / 360;
        return enemies.filter((u) => {
          const d = Math.hypot(u.x - caster.x, u.y - caster.y);
          if (d > maxR + 24) return false;
          let diff = Math.atan2(u.y - caster.y, u.x - caster.x) - baseAng;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          return Math.abs(diff) <= halfRad;
        });
      }
      case 'LINE_PIERCE': {
        const dx = (primaryTarget ? primaryTarget.x - caster.x : 1) || 1;
        const dy = primaryTarget ? primaryTarget.y - caster.y : 0;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len;
        const uy = dy / len;
        const halfW = Math.max(16, (Number(lineWidthPx) || 48) / 2);
        return enemies.filter((u) => {
          const vx = u.x - caster.x;
          const vy = u.y - caster.y;
          const proj = vx * ux + vy * uy;
          if (proj < -12 || proj > maxR + 24) return false;
          const perp = Math.abs(vx * -uy + vy * ux);
          return perp <= halfW + 18;
        });
      }
      default:
        return primaryTarget && primaryTarget.isAlive ? [primaryTarget] : (enemies[0] ? [enemies[0]] : []);
    }
  }

  static performCastMovement(arena, caster, target, skill) {
    if (!target || !window.ArenaPhysicsSolver) return;
    const mv = skill.castMovement || 'STAND_IN_PLACE';
    if (mv === 'STAND_IN_PLACE') return;
    const dx = target.x - caster.x;
    const dy = target.y - caster.y;
    const dist = Math.hypot(dx, dy) || 1;
    let destX = caster.x;
    let destY = caster.y;

    if (mv === 'TELEPORT_BACKSTAB') {
      const ux = dx / dist;
      const uy = dy / dist;
      destX = target.x + ux * 46;
      destY = target.y + uy * 26;
      arena.vfxRenderer?.spawnBurst(skill.mcreworkVfxKey, caster.x, caster.y - 20, skill.vfxColorHex, skill.vfxColorIntensity, 380, 0.65);
    } else if (mv === 'DASH_LINEAR' || mv === 'LEAP_AOE') {
      const stopDist = mv === 'LEAP_AOE' ? 28 : 42;
      const travel = Math.min(Number(skill.castRange) || 160, Math.max(0, dist - stopDist));
      destX = caster.x + (dx / dist) * travel;
      destY = caster.y + (dy / dist) * travel;
    } else if (mv === 'MELEE_ADVANCE' && dist > 68) {
      const travel = Math.min(95, dist - 52);
      destX = caster.x + (dx / dist) * travel;
      destY = caster.y + (dy / dist) * travel;
    }

    window.ArenaPhysicsSolver.moveWithCollision(
      caster, destX, destY,
      arena.arenaCenterX, arena.arenaCenterY, arena.arenaRadiusX, arena.arenaRadiusY,
      (x, y) => arena.isBlocked(x, y)
    );
    caster.dir = arena.compute8Direction(target.x - caster.x, target.y - caster.y);
  }

  static executeSkill(arena, caster, skill, primaryTarget, now, slotKey = null) {
    if (!caster || !caster.isAlive || !skill) return false;
    if (ActionSkillEngine.isActionBlocked(caster)) {
      arena.floatingTexts.push({ x: caster.x, y: caster.y - 52, text: 'ATORDOADO', color: '#fde047', life: 0.7 });
      return false;
    }
    if (skill.skillType !== 'PASSIVE' && ActionSkillEngine.isSilenced(caster)) {
      arena.floatingTexts.push({ x: caster.x, y: caster.y - 52, text: 'SILENCIADO', color: '#c084fc', life: 0.7 });
      return false;
    }

    const casterEff = ActionSkillEngine.getEffectiveStats(caster);
    const baseMp = Math.max(0, Number(skill.mpCost) || 0);
    const totalMp = baseMp + Math.round((casterEff.maxMp * casterEff.extraMpCostPct) / 100);
    if (caster.mp < totalMp) {
      if (caster.isPlayer) arena.floatingTexts.push({ x: caster.x, y: caster.y - 50, text: 'MP INSUFICIENTE', color: '#38bdf8', life: 0.8 });
      return false;
    }

    caster.mp = Math.max(0, caster.mp - totalMp);
    if (slotKey && caster.isPlayer) {
      const cdSec = Math.max(0, Number(skill.cooldownSeconds ?? skill.cooldownTurns) || 0);
      arena.skillCooldowns[slotKey] = now + Math.round(cdSec * 1000);
    }

    caster.actionStartTime = now;
    caster.action = Number(skill.castActionId) || 7;
    caster.attackTimer = 0.38;

    // FASE 2 e 5: Desacoplamento de Mira e Auto-Attack Reset
    if (primaryTarget) {
      caster.dir = arena.compute8Direction(primaryTarget.x - caster.x, primaryTarget.y - caster.y);
      if (caster.isPlayer && arena.motionEngine) {
        arena.motionEngine.lockAimTowards(caster, primaryTarget.x, primaryTarget.y, 0.38);
      }
    }
    if (caster.isPlayer && arena.motionEngine) {
      arena.motionEngine.cancelBackswing('SKILL_EXEC');
      if (skill.resetsAutoAttack || skill.castMovement === 'DASH_LINEAR' || skill.castMovement === 'MELEE_ADVANCE') {
        arena.motionEngine.resetAutoAttackTimer();
      }
    }

    ActionSkillEngine.performCastMovement(arena, caster, primaryTarget, skill);

    const dx = primaryTarget ? primaryTarget.x - caster.x : 1;
    const dy = primaryTarget ? primaryTarget.y - caster.y : 0;
    if (skill.targetScope === 'CONE_FRONTAL') {
      arena.vfxRenderer?.spawnTelegraph('CONE', { x: caster.x, y: caster.y - 10, dx, dy, range: skill.castRange || 90, angleDeg: skill.coneAngleDeg || 90, color: skill.vfxColorHex || '#f97316' });
    } else if (skill.targetScope === 'LINE_PIERCE') {
      arena.vfxRenderer?.spawnTelegraph('LINE', { x: caster.x, y: caster.y - 10, dx, dy, range: skill.castRange || 200, width: skill.lineWidthPx || 48, color: skill.vfxColorHex || '#38bdf8' });
    } else if (skill.targetScope === 'AOE_SELF_AROUND' || skill.targetScope === 'AOE_CIRCLE') {
      const cx = skill.targetScope === 'AOE_SELF_AROUND' ? caster.x : (primaryTarget?.x ?? caster.x);
      const cy = skill.targetScope === 'AOE_SELF_AROUND' ? caster.y : (primaryTarget?.y ?? caster.y);
      arena.vfxRenderer?.spawnTelegraph('CIRCLE', { x: cx, y: cy, radius: skill.aoeRadius || skill.castRange || 110, color: skill.vfxColorHex || '#a855f7' });
    }

    const zoneDur = Number(skill.groundZoneDurationSec) || 0;
    if (zoneDur > 0 || skill.targetScope === 'GROUND_ZONE') {
      const zx = skill.targetScope === 'AOE_SELF_AROUND' ? caster.x : (primaryTarget ? primaryTarget.x : caster.x);
      const zy = skill.targetScope === 'AOE_SELF_AROUND' ? caster.y : (primaryTarget ? primaryTarget.y : caster.y);
      const isFriendlyZone = (skill.effectBlocksJson || []).every((b) => b.blockType === 'HEAL' || b.blockType === 'SHIELD');
      const zone = {
        x: zx, y: zy, radius: Math.max(45, Number(skill.aoeRadius) || 100),
        caster, skill, tickIntervalSec: Math.max(0.25, Number(skill.groundZoneTickSec) || 1.0),
        expiresAt: now + Math.max(1000, Math.round(zoneDur * 1000)),
        nextTickAt: now + Math.round((Math.max(0.25, Number(skill.groundZoneTickSec) || 1.0)) * 1000),
        createdAt: now, tickCount: 0, isFriendly: isFriendlyZone,
        vfxKey: skill.mcreworkVfxKey, vfxColorHex: skill.vfxColorHex, vfxColorIntensity: skill.vfxColorIntensity ?? 100,
      };
      arena.groundZones.push(zone);
      ActionSkillEngine.executeZonePulse(arena, zone, now, true);
    } else {
      const hits = Math.max(1, Number(skill.hitCount) || 1);
      for (let h = 0; h < hits; h++) {
        ActionSkillEngine.runSkillBlocks(arena, caster, primaryTarget, skill, now, true);
      }
    }

    arena.updateHud();
    arena.checkVictoryCondition();
    return true;
  }

  static executeZonePulse(arena, zone, now, isFirstTick) {
    const isCasterAlly = zone.caster.team === 'ALLY';
    const enemies = (isCasterAlly ? arena.monsters : [arena.player, ...arena.pets]).filter(
      (u) => u && u.isAlive && Math.hypot(u.x - zone.x, u.y - zone.y) <= zone.radius
    );
    const allies = (isCasterAlly ? [arena.player, ...arena.pets] : arena.monsters).filter(
      (u) => u && u.isAlive && Math.hypot(u.x - zone.x, u.y - zone.y) <= zone.radius
    );
    ActionSkillEngine.runSkillBlocks(arena, zone.caster, enemies[0] || allies[0] || zone.caster, zone.skill, now, isFirstTick, { enemiesOverride: enemies, alliesOverride: allies });
    zone.tickCount += 1;
  }

  static runSkillBlocks(arena, caster, primaryTarget, skill, now, isFirstTick = true, overrides = null) {
    const blocks = Array.isArray(skill.effectBlocksJson) ? skill.effectBlocksJson : [];
    const defaultEnemies = overrides?.enemiesOverride || ActionSkillEngine.resolveTargets(
      arena, caster, primaryTarget, skill.targetScope || 'TARGET_PRIMARY',
      skill.castRange || 160, skill.aoeRadius || 0, skill.coneAngleDeg || 90, skill.lineWidthPx || 48
    );

    const isCasterAlly = caster.team === 'ALLY';
    const allAllies = overrides?.alliesOverride || (isCasterAlly ? [arena.player, ...arena.pets] : arena.monsters).filter((u) => u && u.isAlive);

    if (skill.mcreworkVfxKey) {
      const vfxTargets = (skill.targetScope === 'SELF' || skill.targetScope === 'ALLY_ALL' || skill.targetScope === 'ALLY_LOWEST_HP_PCT')
        ? [caster] : defaultEnemies.slice(0, 6);
      for (const vt of vfxTargets) {
        arena.vfxRenderer?.spawnBurst(skill.mcreworkVfxKey, vt.x, vt.y - 24, skill.vfxColorHex, skill.vfxColorIntensity ?? 100);
      }
    }

    for (const blk of blocks) {
      if (blk.blockType === 'DAMAGE') {
        let enemiesHit = 0;
        let anyCrit = false;
        const effCaster = ActionSkillEngine.getEffectiveStats(caster);
        for (const mob of defaultEnemies) {
          if (!mob || !mob.isAlive) continue;
          const effMob = ActionSkillEngine.getEffectiveStats(mob);
          const rawPower = ActionSkillEngine.evaluateFormula(
            caster, blk.scaleStat || 'PHYS_ATK', blk.scalePct ?? 100,
            blk.secondaryScaleStat, blk.secondaryScalePct, blk.flatAmount
          );
          const isMag = blk.damageType === 'MAGICAL';
          const isTrue = blk.damageType === 'TRUE';
          const basePen = isMag ? effCaster.magPenPct : effCaster.physPenPct;
          const armorPenPct = Math.min(100, (Number(blk.armorPenPct) || 0) + basePen);
          const anomalyCount = (mob.activeStatuses || []).filter((s) => !s.isBuff).length;
          let bonusMult = 1 + (anomalyCount * (Number(blk.bonusPerAnomalyPct) || 0)) / 100;
          if (Number(blk.executeHpBelowPct) > 0 && (mob.hp / Math.max(1, mob.maxHp)) * 100 <= Number(blk.executeHpBelowPct)) {
            bonusMult += (Number(blk.executeBonusDmgPct) || 0) / 100;
          }
          const Calc = window.CombatDamageCalculator;
          const dmgRes = Calc ? Calc.calculateHitDamage({
            attackerAtk: rawPower,
            attackerLevel: Number(caster.level) || 1,
            attackerElementCode: blk.elementCode && blk.elementCode !== 'INHERIT' ? blk.elementCode : (caster.elementCode || 'NEUTRAL'),
            attackerCritRate: effCaster.critRate,
            attackerCritDmg: effCaster.critDmg,
            flatCritRateBonus: Number(blk.critBonusPct) || 0,
            attackerAccuracy: isMag ? effCaster.magAccuracy : effCaster.physAccuracy,
            defenderDef: isMag ? effMob.magDef : effMob.physDef,
            defenderElementCode: mob.elementCode || 'NEUTRAL',
            defenderEvasion: isMag ? effMob.magEvasion : effMob.physEvasion,
            armorPenPct,
            ignoreEvasion: Boolean(skill.ignoreEvasion),
            skipDefenseMitigation: isTrue,
            skillMultiplier: 1.0,
            bonusDamageMultiplier: bonusMult,
            elementMatchups: arena.elementMatchups,
          }) : { isHit: true, isCrit: false, finalDamage: Math.max(4, Math.round(rawPower)), elementRelation: 'NORMAL' };

          if (!dmgRes.isHit) {
            arena.floatingTexts.push({ x: mob.x, y: mob.y - 48, text: 'DESVIO', color: '#38bdf8', life: 1.0 });
            continue;
          }
          enemiesHit += 1;
          if (dmgRes.isCrit) anyCrit = true;

          const text = dmgRes.isCrit ? `CRÍTICO -${dmgRes.finalDamage}` : `-${dmgRes.finalDamage}`;
          const color = dmgRes.isCrit ? '#fde047' : (dmgRes.elementRelation === 'ADVANTAGE' ? '#fb923c' : '#ffffff');
          ActionSkillEngine.applyIncomingDamage(arena, mob, caster, dmgRes.finalDamage, text, color, now, caster.combatStyle !== 'RANGED');

          const lsPct = Number(blk.lifestealPct) || 0;
          if (lsPct > 0 && caster.isAlive) {
            const lsHeal = Math.max(1, Math.round((dmgRes.finalDamage * lsPct) / 100));
            caster.hp = Math.min(caster.maxHp, caster.hp + lsHeal);
            arena.floatingTexts.push({ x: caster.x, y: caster.y - 48, text: `+${lsHeal}`, color: '#4ade80', life: 0.9 });
          }
        }
        if (enemiesHit > 0 && Number(blk.healCasterMaxHpPerHitPct) > 0 && caster.isAlive) {
          const healAmt = Math.round((caster.maxHp * Number(blk.healCasterMaxHpPerHitPct) * enemiesHit) / 100);
          caster.hp = Math.min(caster.maxHp, caster.hp + healAmt);
          arena.floatingTexts.push({ x: caster.x, y: caster.y - 54, text: `+${healAmt}`, color: '#4ade80', life: 1.0 });
        }
        if (anyCrit && Number(blk.cdReduceOnCritSec) > 0 && caster.isPlayer) {
          ActionSkillEngine.reduceOtherCooldowns(arena, Number(blk.cdReduceOnCritSec), skill.id);
        }
      } else if (blk.blockType === 'HEAL') {
        const tMode = blk.targetMode || (blk.targetSelf ? 'SELF' : skill.targetScope || 'ALLY_SINGLE');
        const targets = tMode === 'ALLY_ALL'
          ? allAllies
          : tMode === 'ALLY_LOWEST_HP_PCT'
          ? ActionSkillEngine.resolveTargets(arena, caster, primaryTarget, 'ALLY_LOWEST_HP_PCT', skill.castRange, skill.aoeRadius)
          : tMode === 'SELF' ? [caster] : [primaryTarget?.team === caster.team ? primaryTarget : caster];
        for (const t of targets) {
          if (!t || !t.isAlive) continue;
          const srcUnit = blk.scaleSource === 'TARGET' ? t : caster;
          const baseHeal = ActionSkillEngine.evaluateFormula(srcUnit, blk.scaleStat || 'HEAL_POWER', blk.scalePct ?? 100, blk.secondaryScaleStat, blk.secondaryScalePct, blk.flatAmount);
          const effTarget = ActionSkillEngine.getEffectiveStats(t);
          const finalHeal = Math.max(1, Math.round(baseHeal * effTarget.healReceivedMult));
          t.hp = Math.min(t.maxHp, t.hp + finalHeal);
          arena.floatingTexts.push({ x: t.x, y: t.y - 48, text: `+${finalHeal}`, color: '#4ade80', life: 1.0 });
        }
      } else if (blk.blockType === 'SHIELD') {
        const tMode = blk.targetMode || (blk.targetSelf === false ? 'ALLY_ALL' : 'SELF');
        const targets = tMode === 'ALLY_ALL' ? allAllies : (tMode === 'ALLY_SINGLE' && primaryTarget?.team === caster.team ? [primaryTarget] : [caster]);
        const durMs = Math.max(500, Math.round((Number(blk.durationSeconds ?? blk.durationTurns) || 6) * 1000));
        for (const t of targets) {
          if (!t || !t.isAlive) continue;
          const srcUnit = blk.scaleSource === 'TARGET' ? t : caster;
          const shieldAmt = Math.max(10, Math.round(ActionSkillEngine.evaluateFormula(srcUnit, blk.scaleStat || 'MAX_HP', blk.scalePct ?? 20, blk.secondaryScaleStat, blk.secondaryScalePct, blk.flatAmount)));
          t.shieldHp = shieldAmt;
          t.shieldMaxHp = shieldAmt;
          t.shieldExpiresAt = now + durMs;
          arena.floatingTexts.push({ x: t.x, y: t.y - 52, text: `ESCUDO +${shieldAmt}`, color: '#38bdf8', life: 1.0 });
        }
      } else if (blk.blockType === 'STATUS') {
        if (blk.firstTickOnly && !isFirstTick) continue;
        const stTpl = (arena.statusCatalog || []).find((s) => Number(s.id) === Number(blk.statusEffectId));
        if (!stTpl) continue;
        const tMode = blk.targetMode || (blk.targetSelf ? 'SELF' : 'TARGET');
        const targets = tMode === 'SELF' ? [caster] : (tMode === 'ALLY_ALL' ? allAllies : defaultEnemies);
        for (const t of targets) {
          if (!t || !t.isAlive) continue;
          if (Math.random() * 100 > (Number(blk.applyChancePct) || 100)) continue;
          ActionSkillEngine.applyStatusEffect(arena, t, caster, stTpl, Number(blk.durationSeconds ?? blk.durationTurns) || stTpl.durationSeconds || 5, now);
        }
      } else if (blk.blockType === 'CLEANSE_DISPEL' || blk.blockType === 'CLEANSE') {
        const tMode = blk.cleanseTarget || (blk.targetSelf ? 'SELF' : 'TARGET');
        const targets = tMode === 'ALL_ALLIES'
          ? allAllies
          : tMode === 'ALLY_LOWEST_HP_PCT'
          ? ActionSkillEngine.resolveTargets(arena, caster, primaryTarget, 'ALLY_LOWEST_HP_PCT', skill.castRange, skill.aoeRadius)
          : tMode === 'TARGET' ? [primaryTarget || caster] : [caster];
        for (const t of targets) {
          ActionSkillEngine.cleanseUnitWithFilter(arena, t, blk.cleanseFilter || 'ALL', Number(blk.maxDebuffs) || 0, Number(blk.healPerDebuffPct) || 0, Number(blk.cleanseChancePct) || 100);
        }
      } else if (blk.blockType === 'RESOURCE_COOLDOWN') {
        const amt = Number(blk.amount) || 0;
        const rTargets = blk.resourceTarget === 'ALLY_ALL' ? allAllies : (blk.resourceTarget === 'TARGET' && primaryTarget ? [primaryTarget] : [caster]);
        if (blk.resourceAction === 'REDUCE_OTHER_CDS_SEC') {
          ActionSkillEngine.reduceOtherCooldowns(arena, amt, skill.id);
        } else {
          for (const t of rTargets) {
            if (!t || !t.isAlive) continue;
            const addMp = blk.resourceAction === 'RESTORE_MP_PCT' ? Math.round((t.maxMp * amt) / 100) : Math.round(amt);
            t.mp = Math.min(t.maxMp, t.mp + addMp);
            arena.floatingTexts.push({ x: t.x, y: t.y - 46, text: `+${addMp} MP`, color: '#38bdf8', life: 0.9 });
          }
        }
      }
    }
  }

  static applyIncomingDamage(arena, defender, attacker, dmg, text, color, now, isMeleeHit = true) {
    if (!defender || !defender.isAlive) return;

    // Quebra Sleep se breakOnDamage
    if (Array.isArray(defender.activeStatuses)) {
      defender.activeStatuses = defender.activeStatuses.filter((st) => !st.breakOnDamage);
    }

    let remainingDmg = dmg;
    if (Number(defender.shieldHp) > 0) {
      const absorbed = Math.min(defender.shieldHp, remainingDmg);
      defender.shieldHp -= absorbed;
      remainingDmg -= absorbed;
    }

    arena.dealDamageToUnit(defender, remainingDmg, remainingDmg > 0 ? text : 'ABSORVIDO', remainingDmg > 0 ? color : '#38bdf8', now);

    // Reflexão melee e contra-status reativo (ex: Falange Inabalável, Armadura de Ossos)
    if (attacker && attacker.isAlive) {
      const effDef = ActionSkillEngine.getEffectiveStats(defender);
      if (isMeleeHit && effDef.reflectMeleePct > 0 && dmg > 0) {
        const refl = Math.max(1, Math.round((dmg * effDef.reflectMeleePct) / 100));
        arena.dealDamageToUnit(attacker, refl, `REFLEXO -${refl}`, '#fb923c', now);
      }
      for (const st of defender.activeStatuses || []) {
        const rId = Number(st.dotHotFormulaJson?.reactiveStatusId);
        if (rId > 0) {
          const rChance = Number(st.dotHotFormulaJson?.reactiveChancePct) || 100;
          if (Math.random() * 100 <= rChance) {
            const rTpl = (arena.statusCatalog || []).find((s) => Number(s.id) === rId);
            if (rTpl) {
              ActionSkillEngine.applyStatusEffect(arena, attacker, defender, rTpl, Number(st.dotHotFormulaJson?.reactiveDurationSec) || 1.5, now);
            }
          }
        }
      }
    }
  }

  static applyStatusEffect(arena, target, sourceUnit, stTpl, durationSec, now) {
    if (!target || !target.isAlive || !stTpl) return;
    if (!stTpl.isBuff && (stTpl.statusCategory === 'HARD_CC' || stTpl.statusCategory === 'ANOMALY')) {
      const effT = ActionSkillEngine.getEffectiveStats(target);
      if (effT.controlResistPct > 0 && Math.random() * 100 < effT.controlResistPct) {
        arena.floatingTexts.push({ x: target.x, y: target.y - 46, text: 'RESISTIDO', color: '#cbd5e1', life: 0.75 });
        return;
      }
    }

    if (!Array.isArray(target.activeStatuses)) target.activeStatuses = [];
    const maxStacks = Math.max(1, Number(stTpl.maxStacks) || 1);
    const durMs = Math.max(400, Math.round((Number(durationSec) || Number(stTpl.durationSeconds) || 5) * 1000));
    const tickMs = Math.max(250, Math.round((Number(stTpl.tickIntervalSeconds) || 1.0) * 1000));
    const existing = target.activeStatuses.find((s) => Number(s.id) === Number(stTpl.id));

    if (existing) {
      existing.stacks = Math.min(maxStacks, (existing.stacks || 1) + 1);
      existing.expiresAt = now + durMs;
      existing.sourceUnit = sourceUnit;
    } else {
      target.activeStatuses.push({
        id: stTpl.id,
        code: stTpl.code,
        name: stTpl.namePtBr || stTpl.code,
        isBuff: Boolean(stTpl.isBuff),
        statusCategory: stTpl.statusCategory || (stTpl.isBuff ? 'BUFF' : 'ANOMALY'),
        breakOnDamage: Boolean(stTpl.breakOnDamage),
        iconUrl: stTpl.iconUrl,
        vfxKey: stTpl.mcreworkVfxKey,
        vfxColorHex: stTpl.vfxColorHex || null,
        vfxColorIntensity: stTpl.vfxColorIntensity ?? 100,
        statModifiersJson: stTpl.statModifiersJson || {},
        dotHotFormulaJson: stTpl.dotHotFormulaJson || {},
        controlFlagsJson: Array.isArray(stTpl.controlFlagsJson) ? stTpl.controlFlagsJson : [],
        stacks: 1,
        sourceUnit,
        expiresAt: now + durMs,
        tickIntervalMs: tickMs,
        nextTickAt: now + tickMs,
      });
    }

    if (stTpl.mcreworkVfxKey) {
      arena.vfxRenderer?.spawnBurst(stTpl.mcreworkVfxKey, target.x, target.y - 24, stTpl.vfxColorHex, stTpl.vfxColorIntensity ?? 100, 500, 0.7);
    }
  }

  static cleanseUnitWithFilter(arena, unit, filter = 'ALL', maxDebuffs = 0, healPerDebuffPct = 0, cleanseChancePct = 100) {
    if (!unit || !unit.isAlive) return 0;
    if (Math.random() * 100 > (Number(cleanseChancePct) || 100)) return 0;
    const statuses = Array.isArray(unit.activeStatuses) ? unit.activeStatuses : [];
    let removed = 0;
    let remCc = 0;
    let remDot = 0;
    const lim = Number(maxDebuffs) > 0 ? Number(maxDebuffs) : Infinity;

    unit.activeStatuses = statuses.filter((st) => {
      if (st.isBuff) return true;
      const cat = st.statusCategory || 'ANOMALY';
      const isSlow = cat === 'SLOW' || (st.controlFlagsJson || []).includes('SLOW');
      const isHardCc = cat === 'HARD_CC';
      const isDot = cat === 'ANOMALY';

      if (filter === 'HARD_CC_AND_DOT') {
        if (isHardCc && remCc < lim) { remCc++; removed++; return false; }
        if (isDot && remDot < lim) { remDot++; removed++; return false; }
        return true;
      }
      const match = filter === 'ALL'
        || (filter === 'HARD_CC' && isHardCc)
        || (filter === 'ANOMALY_DOT' && isDot)
        || (filter === 'SLOW' && isSlow);
      if (match && removed < lim) { removed++; return false; }
      return true;
    });

    if (removed > 0) {
      if (healPerDebuffPct > 0) {
        const healAmt = Math.round(unit.maxHp * (healPerDebuffPct / 100) * removed);
        unit.hp = Math.min(unit.maxHp, unit.hp + healAmt);
      }
      arena.floatingTexts.push({ x: unit.x, y: unit.y - 54, text: `PURIFICADO (-${removed})`, color: '#2dd4bf', life: 1.1 });
    }
    return removed;
  }

  static reduceOtherCooldowns(arena, sec, currentSkillId = null) {
    const ms = Math.max(0, Math.round(sec * 1000));
    const slots = arena.classSkills || [];
    for (let idx = 0; idx < 4; idx++) {
      const sk = slots[idx];
      if (sk && Number(sk.id) === Number(currentSkillId)) continue;
      const key = `skill${idx + 1}`;
      if (arena.skillCooldowns[key] > 0) {
        arena.skillCooldowns[key] = Math.max(0, arena.skillCooldowns[key] - ms);
      }
    }
  }

  static tickStatusesAndZones(arena, now) {
    // 1. Zonas persistentes no solo
    for (let i = arena.groundZones.length - 1; i >= 0; i--) {
      const gz = arena.groundZones[i];
      if (now >= gz.expiresAt) {
        arena.groundZones.splice(i, 1);
        continue;
      }
      if (now >= gz.nextTickAt) {
        gz.nextTickAt += gz.tickIntervalSec * 1000;
        ActionSkillEngine.executeZonePulse(arena, gz, now, false);
      }
    }

    // 2. Status ativos (Escudos expirados + DoT / HoT por tick)
    const allUnits = [arena.player, ...(arena.pets || []), ...(arena.monsters || [])].filter((u) => u && u.isAlive);
    for (const u of allUnits) {
      if (u.shieldHp > 0 && u.shieldExpiresAt && now >= u.shieldExpiresAt) {
        u.shieldHp = 0;
        u.shieldMaxHp = 0;
      }
      if (!Array.isArray(u.activeStatuses) || u.activeStatuses.length === 0) continue;
      u.activeStatuses = u.activeStatuses.filter((st) => now < st.expiresAt);
      for (const st of u.activeStatuses) {
        if (now >= st.nextTickAt) {
          st.nextTickAt += st.tickIntervalMs;
          const dot = st.dotHotFormulaJson || {};
          if (dot.mode === 'DAMAGE' && st.sourceUnit) {
            const raw = ActionSkillEngine.evaluateFormula(st.sourceUnit, dot.scaleStat || 'PHYS_ATK', dot.scalePct || 20, null, 0, dot.flatAmount || 0) * Math.max(1, st.stacks || 1);
            const dmg = Math.max(2, Math.round(raw));
            ActionSkillEngine.applyIncomingDamage(arena, u, st.sourceUnit, dmg, `-${dmg}`, '#fb7185', now, false);
          } else if (dot.mode === 'HEAL') {
            const src = st.sourceUnit || u;
            const heal = Math.max(2, Math.round(ActionSkillEngine.evaluateFormula(src, dot.scaleStat || 'HEAL_POWER', dot.scalePct || 15, null, 0, dot.flatAmount || 0) * Math.max(1, st.stacks || 1)));
            u.hp = Math.min(u.maxHp, u.hp + heal);
            arena.floatingTexts.push({ x: u.x, y: u.y - 46, text: `+${heal}`, color: '#4ade80', life: 0.9 });
          }
        }
      }
    }
  }

  static applyProjectileHit(arena, defender, p, attackerAcc, now) {
    if (!defender || !defender.isAlive) return;
    if (defender.isPlayer && defender.isDashing) {
      arena.floatingTexts.push({ x: defender.x, y: defender.y - 45, text: 'DESVIO', color: '#38bdf8', life: 0.9 });
      return;
    }
    const atkUnit = p.attackerUnit || arena.player || {};
    const effAtk = ActionSkillEngine.getEffectiveStats(atkUnit);
    const effDef = ActionSkillEngine.getEffectiveStats(defender);
    const eva = p.isMagical ? (effDef.magEvasion ?? 5) : (effDef.physEvasion ?? 5);
    const defStat = p.isMagical ? (effDef.magDef ?? 25) : (effDef.physDef ?? 25);
    const penPct = p.isMagical ? (effAtk.magPenPct || 0) : (effAtk.physPenPct || 0);
    const effAcc = attackerAcc ?? (p.isMagical ? effAtk.magAccuracy : effAtk.physAccuracy);
    const Calc = window.CombatDamageCalculator;
    const res = Calc ? Calc.calculateHitDamage({
      attackerAtk: effAtk.atk ?? p.dmg ?? atkUnit.atk ?? 40,
      attackerLevel: Number(atkUnit.level) || 1,
      attackerElementCode: atkUnit.elementCode || 'NEUTRAL',
      attackerCritRate: effAtk.critRate ?? 0.08,
      attackerCritDmg: effAtk.critDmg || p.critDmgMult || atkUnit.critDmg || 1.5,
      attackerAccuracy: effAcc,
      defenderDef: defStat,
      defenderElementCode: defender.elementCode || 'NEUTRAL',
      defenderEvasion: eva,
      armorPenPct: penPct,
      skillMultiplier: p.skillMultiplier ?? 1.0,
      elementMatchups: arena.elementMatchups,
    }) : { isHit: true, isCrit: false, finalDamage: Math.max(4, Math.round(p.dmg || 40)), elementRelation: 'NORMAL' };

    if (!res.isHit) {
      arena.floatingTexts.push({ x: defender.x, y: defender.y - 48, text: 'DESVIO', color: '#38bdf8', life: 1.05 });
      return;
    }
    const text = res.isCrit ? `CRÍTICO -${res.finalDamage}` : `-${res.finalDamage}`;
    const color = res.isCrit
      ? '#fde047'
      : (res.elementRelation === 'ADVANTAGE'
        ? '#fb923c'
        : (defender.team === 'ALLY' ? '#f87171' : (p.color || '#ffffff')));
    ActionSkillEngine.applyIncomingDamage(arena, defender, atkUnit, res.finalDamage, text, color, now, atkUnit.combatStyle !== 'RANGED');
  }
}

window.ActionSkillEngine = ActionSkillEngine;
