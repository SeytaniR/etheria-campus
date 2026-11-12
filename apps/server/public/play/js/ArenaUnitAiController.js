/**
 * @file apps/server/public/play/js/ArenaUnitAiController.js
 * @module @etheria/server
 * @description Inteligência Artificial Tática para Modelos Autônomos (Pets e Monstros) na Arena 2.5D.
 *   - Avaliação Geral por Time: identifica automaticamente Tank (protege Rangeds), Top Dano
 *     (foca em maximizar dano) e Mais Frágil (bater de longe / flanquear pelas bordas).
 *   - Regras Melee: busca inimigo mais próximo (ou intercepta ameaças aos Rangeds quando Tank).
 *   - Regras Ranged: ataca inimigo mais próximo no alcance, se movimenta para buscar alvos,
 *     foge buscando abrigo atrás de um Melee aliado quando ameaçado, mas aceita luta
 *     corpo a corpo (Stand & Fight) quando encurralado ou após kiting prolongado.
 * @rules Segue estritamente AGENTS.md (Pilar 3: OOP Modular, Pilar 4: Scores procedurais, Regra #7).
 * @dependencies ArenaPhysicsSolver
 */

class ArenaUnitAiController {
  constructor() {
    this.lastTacticalEvalMs = 0;
  }

  /**
   * Garante estrutura de estado de IA persistente na unidade sem poluir objetos originais.
   */
  ensureAiState(unit) {
    if (!unit.aiState) {
      unit.aiState = {
        kiteDuration: 0,
        corneredDuration: 0,
        standAndFightTimer: 0,
        kiteCooldown: 0,
        chaseDuration: 0,
        prevThreatDist: Infinity,
        prevTargetDist: Infinity,
        lastTargetId: null,
        avoidTargetId: null,
        avoidTargetUntil: 0,
      };
    }
    return unit.aiState;
  }

  /**
   * Calcula centro geométrico de um conjunto de unidades vivas.
   */
  computeCentroid(units) {
    let sumX = 0;
    let sumY = 0;
    let count = 0;
    for (const u of units) {
      if (!u || !u.isAlive) continue;
      sumX += u.x;
      sumY += u.y;
      count += 1;
    }
    return count > 0 ? { x: sumX / count, y: sumY / count, count } : { x: 0, y: 0, count: 0 };
  }

  /**
   * Avaliação Tática Geral do Time de IAs:
   * - Calcula proceduralmente Tankiness, Potencial de Dano e Fragilidade usando os atributos reais.
   * - Distribui os papéis: `TANK_PROTECTOR`, `DPS_PRIORITY`, `FRAGILE_SKIRMISHER` ou `STANDARD`.
   */
  evaluateTeamTactics(allies, enemies) {
    const aliveAllies = allies.filter((u) => u && u.isAlive);
    const aliveAi = aliveAllies.filter((u) => !u.isPlayer);
    const aliveEnemies = enemies.filter((u) => u && u.isAlive);

    const enemyCentroid = this.computeCentroid(aliveEnemies);
    const hasRangedAlly = aliveAllies.some((u) => u.combatStyle === 'RANGED');

    if (aliveAi.length === 0) {
      return { enemyCentroid, aliveAllies, aliveEnemies };
    }

    const metrics = aliveAi.map((u) => {
      const defTotal = (Number(u.def) || 25) + (Number(u.magDef) || Number(u.def) || 25);
      const maxHp = Math.max(1, Number(u.maxHp) || 300);
      const hpRatio = Math.max(0.08, (Number(u.hp) || maxHp) / maxHp);
      const isMelee = u.combatStyle !== 'RANGED';

      const tankScore = maxHp * (1 + defTotal * 0.005) * (isMelee ? 1.2 : 0.72);
      const damageScore =
        (Number(u.atk) || 40) *
        (Number(u.attackSpeed) || 1.0) *
        (1 + (Number(u.critRate) || 0.05) * ((Number(u.critDmg) || 1.5) - 1));
      const fragilityScore = 100000 / Math.max(1, maxHp * (0.35 + 0.65 * hpRatio) * (1 + defTotal * 0.006));

      u.tacticalRole = 'STANDARD';
      u.isTopDamage = false;
      return { u, tankScore, damageScore, fragilityScore, hpRatio };
    });

    // 1. Quem é o mais Tank? Foca em proteger os Rangeds (prioriza Melee se disponível)
    let tankCandidate = null;
    if (hasRangedAlly || metrics.length >= 2) {
      const sortedTank = [...metrics].sort((a, b) => b.tankScore - a.tankScore);
      tankCandidate = sortedTank[0]?.u || null;
      if (tankCandidate) {
        tankCandidate.tacticalRole = 'TANK_PROTECTOR';
      }
    }

    // 2. Quem é o que mais dá Dano? Foca em maximizar dano
    const sortedDps = [...metrics].sort((a, b) => b.damageScore - a.damageScore);
    const topDps = sortedDps.find((m) => m.u !== tankCandidate) || sortedDps[0];
    if (topDps) {
      topDps.u.isTopDamage = true;
      if (topDps.u.tacticalRole === 'STANDARD') {
        topDps.u.tacticalRole = 'DPS_PRIORITY';
      }
    }

    // 3. Quem é o mais Frágil? Foca em bater de longe ou atacar pelas bordas sem se expor
    const sortedFragile = [...metrics].sort((a, b) => b.fragilityScore - a.fragilityScore);
    const mostFragile =
      sortedFragile.find((m) => m.u !== tankCandidate && (m.u.tacticalRole === 'STANDARD' || m.hpRatio < 0.55 || m.u.combatStyle === 'RANGED')) ||
      (metrics.length === 1 && sortedFragile[0]?.hpRatio < 0.45 ? sortedFragile[0] : null);

    if (mostFragile && mostFragile.u !== tankCandidate) {
      mostFragile.u.tacticalRole = 'FRAGILE_SKIRMISHER';
    }

    return { enemyCentroid, aliveAllies, aliveEnemies };
  }

  /**
   * Seleciona o alvo prioritário e, quando aplicável para Tanks, uma posição de interceptação para proteger Rangeds.
   */
  selectTargetAndDirective(unit, allies, enemies, enemyCentroid, preferredEnemy = null) {
    const aliveEnemies = enemies.filter((e) => e && e.isAlive);
    if (aliveEnemies.length === 0) return { target: null, interceptPos: null };

    if (window.ActionSkillEngine) {
      const taunter = window.ActionSkillEngine.getTaunter(unit);
      if (taunter && aliveEnemies.includes(taunter)) {
        return { target: taunter, interceptPos: null };
      }
    }

    const range = Math.max(48, Number(unit.attackRange) || (unit.combatStyle === 'RANGED' ? 220 : 60));

    // A) Papel TANK_PROTECTOR: intercepta inimigos se aproximando dos Rangeds aliados
    if (unit.tacticalRole === 'TANK_PROTECTOR') {
      const rangedAllies = allies.filter((a) => a && a.isAlive && a !== unit && a.combatStyle === 'RANGED');
      let bestThreat = null;
      let bestGuardedAlly = null;
      let closestThreatToRanged = 320; // Raio de proteção tática aos Rangeds aliados

      for (const allyR of rangedAllies) {
        for (const en of aliveEnemies) {
          const dThreat = Math.hypot(en.x - allyR.x, en.y - allyR.y);
          if (dThreat < closestThreatToRanged) {
            closestThreatToRanged = dThreat;
            bestThreat = en;
            bestGuardedAlly = allyR;
          }
        }
      }

      if (bestThreat && bestGuardedAlly) {
        const vx = bestGuardedAlly.x - bestThreat.x;
        const vy = bestGuardedAlly.y - bestThreat.y;
        const vLen = Math.hypot(vx, vy) || 1;
        const distEnemyToUnit = Math.hypot(bestThreat.x - unit.x, bestThreat.y - unit.y);
        const interceptPos =
          distEnemyToUnit > range
            ? {
                x: bestThreat.x + (vx / vLen) * Math.min(54, Math.max(38, range * 0.8)),
                y: bestThreat.y + (vy / vLen) * Math.min(54, Math.max(38, range * 0.8)),
              }
            : null;
        return { target: bestThreat, interceptPos };
      }
    }

    // B) Unidade RANGED: prioriza inimigo mais próximo DENTRO do alcance
    if (unit.combatStyle === 'RANGED') {
      const inRange = aliveEnemies.filter((e) => Math.hypot(e.x - unit.x, e.y - unit.y) <= range);
      if (inRange.length > 0) {
        if (preferredEnemy && preferredEnemy.isAlive && inRange.includes(preferredEnemy)) {
          const dPref = Math.hypot(preferredEnemy.x - unit.x, preferredEnemy.y - unit.y);
          if (dPref <= range * 0.92) return { target: preferredEnemy, interceptPos: null };
        }

        let best = inRange[0];
        let bestScore = Infinity;
        for (const en of inRange) {
          const d = Math.hypot(en.x - unit.x, en.y - unit.y);
          const hpBonus = unit.isTopDamage ? (en.hp / Math.max(1, en.maxHp)) * 55 : 0;
          const score = d + hpBonus;
          if (score < bestScore) {
            bestScore = score;
            best = en;
          }
        }
        return { target: best, interceptPos: null };
      }
    }

    // C) Unidade FRAGILE_SKIRMISHER (Melee pelas bordas): prefere alvos isolados/periféricos longe do centro inimigo
    if (unit.tacticalRole === 'FRAGILE_SKIRMISHER' && unit.combatStyle !== 'RANGED' && aliveEnemies.length > 1) {
      let bestEdgeTarget = aliveEnemies[0];
      let bestScore = Infinity;
      for (const en of aliveEnemies) {
        const dUnit = Math.hypot(en.x - unit.x, en.y - unit.y);
        const dFromCentroid = Math.hypot(en.x - enemyCentroid.x, en.y - enemyCentroid.y);
        const score = dUnit - dFromCentroid * 0.55;
        if (score < bestScore) {
          bestScore = score;
          bestEdgeTarget = en;
        }
      }
      return { target: bestEdgeTarget, interceptPos: null };
    }

    // D) Padrão Melee / Top Dano / Busca de Alvo: inimigo mais próximo (desempate leve por foco ou baixo HP)
    let closest = aliveEnemies[0];
    let bestMetric = Infinity;
    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const avoidId = unit.aiState && unit.aiState.avoidTargetUntil > nowMs ? unit.aiState.avoidTargetId : null;
    for (const en of aliveEnemies) {
      const d = Math.hypot(en.x - unit.x, en.y - unit.y);
      let mod = (avoidId && en.id === avoidId && aliveEnemies.length > 1) ? 260 : 0;
      if (unit.isTopDamage) {
        mod += (en.hp / Math.max(1, en.maxHp)) * 45;
      }
      if (preferredEnemy === en) {
        mod -= 35;
      }
      if (d + mod < bestMetric) {
        bestMetric = d + mod;
        closest = en;
      }
    }
    return { target: closest, interceptPos: null };
  }

  /**
   * Calcula destino seguro para um Ranged recuar:
   * Prioriza posicionar-se ATRÁS de um aliado Melee (preferindo o Tank) em relação à ameaça.
   */
  computeRangedRetreatTarget(unit, threat, allies, enemyCentroid, cx, cy, rx, ry, isBlockedFn) {
    const meleeAllies = allies.filter((a) => a && a.isAlive && a !== unit && a.combatStyle !== 'RANGED');

    if (meleeAllies.length > 0) {
      let anchor = meleeAllies.find((a) => a.tacticalRole === 'TANK_PROTECTOR');
      if (!anchor) {
        let bestDist = Infinity;
        for (const a of meleeAllies) {
          const d = Math.hypot(a.x - unit.x, a.y - unit.y);
          if (d < bestDist) {
            bestDist = d;
            anchor = a;
          }
        }
      }

      if (anchor) {
        const dx = anchor.x - threat.x;
        const dy = anchor.y - threat.y;
        const len = Math.hypot(dx, dy) || 1;
        const coverDist = 96;
        const idealX = anchor.x + (dx / len) * coverDist;
        const idealY = anchor.y + (dy / len) * coverDist;
        if (window.ArenaPhysicsSolver) {
          return window.ArenaPhysicsSolver.findNearestFreePoint(idealX, idealY, cx, cy, rx, ry, isBlockedFn, [], 42, 30);
        }
        return { x: idealX, y: idealY };
      }
    }

    // Fallback sem aliado Melee: foge em arco tangencial dentro dos limites da arena
    const awayAng = Math.atan2(unit.y - threat.y, unit.x - threat.x);
    const awayCentroidAng = Math.atan2(unit.y - enemyCentroid.y, unit.x - enemyCentroid.x);
    const baseEscapeAng = Math.atan2(
      Math.sin(awayAng) * 0.7 + Math.sin(awayCentroidAng) * 0.3,
      Math.cos(awayAng) * 0.7 + Math.cos(awayCentroidAng) * 0.3
    );

    const offsets = [0, 0.6, -0.6, 1.2, -1.2, 1.85, -1.85];
    for (const off of offsets) {
      const ang = baseEscapeAng + off;
      const candX = unit.x + Math.cos(ang) * 115;
      const candY = unit.y + Math.sin(ang) * 90;
      if (
        !window.ArenaPhysicsSolver ||
        window.ArenaPhysicsSolver.isPointValidInArena(candX, candY, cx, cy, rx, ry, isBlockedFn, 0.91)
      ) {
        return { x: candX, y: candY };
      }
    }
    return null;
  }

  /**
   * Move unidade em direção a (destX, destY) usando A* (quando há obstáculo) + ArenaPhysicsSolver.
   */
  steerUnitTowards(unit, destX, destY, mesh, cx, cy, rx, ry, isBlockedFn, dt, now, compute8DirFn, speedScale = 1.0) {
    const dx = destX - unit.x;
    const dy = destY - unit.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= 6) {
      unit.action = 0;
      return false;
    }

    let steerX = dx;
    let steerY = dy;
    const isClear = mesh && typeof mesh.isSegmentClear === 'function' ? mesh.isSegmentClear(unit.x, unit.y, destX, destY, 16) : true;

    if (isClear) {
      unit.path = null;
    } else {
      if (!unit.path || unit.path.length === 0 || now >= (unit.nextRepathTime || 0)) {
        unit.path = mesh && typeof mesh.findPath === 'function' ? mesh.findPath(unit.x, unit.y, destX, destY) : null;
        unit.nextRepathTime = now + 350 + Math.random() * 140;
      }
      if (unit.path && unit.path.length > 0) {
        if (Math.hypot(unit.path[0].x - unit.x, unit.path[0].y - unit.y) <= 16) {
          unit.path.shift();
        }
        if (unit.path.length > 0) {
          steerX = unit.path[0].x - unit.x;
          steerY = unit.path[0].y - unit.y;
        }
      }
    }

    const sLen = Math.hypot(steerX, steerY) || 1;
    const statusSpeedMult = window.ActionSkillEngine ? window.ActionSkillEngine.getEffectiveStats(unit).moveSpeedMult : 1.0;
    const step = (Number(unit.speed) || 140) * speedScale * statusSpeedMult * dt;
    const nextX = unit.x + (steerX / sLen) * step;
    const nextY = unit.y + (steerY / sLen) * step;

    if (window.ArenaPhysicsSolver) {
      window.ArenaPhysicsSolver.moveWithCollision(unit, nextX, nextY, cx, cy, rx, ry, isBlockedFn);
    } else {
      unit.x = nextX;
      unit.y = nextY;
    }

    unit.dir = compute8DirFn(steerX, steerY);
    unit.action = 1;
    return true;
  }

  /**
   * Atualiza um modelo autônomo (Pet ou Monstro) em um tick da Arena.
   */
  updateUnit(unit, allies, enemies, context, dt, now) {
    if (!unit || !unit.isAlive) {
      if (unit && unit.fadeAlpha > 0) {
        unit.fadeAlpha = Math.max(0, unit.fadeAlpha - dt * 1.1);
      }
      return;
    }

    if (window.ActionSkillEngine && window.ActionSkillEngine.isActionBlocked(unit)) {
      unit.action = 0;
      return;
    }

    if (unit.hitTimer > 0) {
      unit.hitTimer -= dt;
      if (unit.hitTimer <= 0 && unit.action === 5) unit.action = 0;
      return;
    }
    if (unit.attackTimer > 0) {
      unit.attackTimer -= dt;
      if (unit.attackTimer <= 0 && (unit.action === 3 || unit.action === 7)) unit.action = 0;
      return;
    }

    const ai = this.ensureAiState(unit);
    if (ai.standAndFightTimer > 0) ai.standAndFightTimer = Math.max(0, ai.standAndFightTimer - dt);
    if (ai.kiteCooldown > 0) ai.kiteCooldown = Math.max(0, ai.kiteCooldown - dt);

    const { mesh, cx, cy, rx, ry, isBlockedFn, compute8DirFn, onPerformAttack, enemyCentroid, preferredEnemy } = context;

    const { target, interceptPos } = this.selectTargetAndDirective(unit, allies, enemies, enemyCentroid, preferredEnemy);
    unit.targetMob = target;
    if (!target) {
      unit.action = 0;
      return;
    }

    const isRanged = unit.combatStyle === 'RANGED';
    const effRange = Math.max(54, Number(unit.attackRange) || (isRanged ? 220 : 60));

    if (!isRanged) {
      // ================== ESTADO MELEE ==================
      const dist = Math.hypot(target.x - unit.x, target.y - unit.y);
      if (ai.lastTargetId !== target.id) {
        ai.lastTargetId = target.id;
        ai.chaseDuration = 0;
      }

      if (dist > effRange) {
        ai.chaseDuration = dist >= ai.prevTargetDist - 2 ? ai.chaseDuration + dt : Math.max(0, ai.chaseDuration - dt * 0.5);
        ai.prevTargetDist = dist;
        if (ai.chaseDuration >= 2.4 && enemies.filter((e) => e && e.isAlive).length > 1) {
          ai.avoidTargetId = target.id;
          ai.avoidTargetUntil = now + 2600;
          ai.chaseDuration = 0;
        }

        let dest = interceptPos;
        if (!dest) {
          const avoid = unit.tacticalRole === 'FRAGILE_SKIRMISHER' ? enemyCentroid : null;
          dest = window.ArenaPhysicsSolver
            ? window.ArenaPhysicsSolver.computeSurroundAttackSlot(unit, target, allies, effRange, cx, cy, rx, ry, isBlockedFn, avoid)
            : { x: target.x, y: target.y };
        }
        this.steerUnitTowards(unit, dest.x, dest.y, mesh, cx, cy, rx, ry, isBlockedFn, dt, now, compute8DirFn);
      } else {
        ai.chaseDuration = 0;
        unit.action = 0;
        unit.dir = compute8DirFn(target.x - unit.x, target.y - unit.y);
        if (now >= (unit.nextAttackTime || 0)) {
          onPerformAttack(unit, target, false);
        }
      }
      return;
    }

    // ================== ESTADO RANGED ==================
    let nearestThreat = target;
    let nearestThreatDist = Math.hypot(target.x - unit.x, target.y - unit.y);
    for (const en of enemies) {
      if (!en || !en.isAlive) continue;
      const d = Math.hypot(en.x - unit.x, en.y - unit.y);
      if (d < nearestThreatDist) {
        nearestThreatDist = d;
        nearestThreat = en;
      }
    }

    const dangerDist = unit.tacticalRole === 'FRAGILE_SKIRMISHER'
      ? Math.min(165, effRange * 0.72)
      : Math.min(130, effRange * 0.58);

    const isThreatened = nearestThreatDist < dangerDist;

    // Dispara imediatamente se o cooldown estiver pronto e houver alvo no alcance (orb-walking)
    const distToTarget = Math.hypot(target.x - unit.x, target.y - unit.y);
    if (distToTarget <= effRange && now >= (unit.nextAttackTime || 0)) {
      const isCloseBrawl = ai.standAndFightTimer > 0 && nearestThreatDist <= 78;
      const fireTarget = isCloseBrawl ? nearestThreat : target;
      unit.dir = compute8DirFn(fireTarget.x - unit.x, fireTarget.y - unit.y);
      onPerformAttack(unit, fireTarget, isCloseBrawl);
      return;
    }

    // Avalia se Ranged deve aceitar luta corpo a corpo (anti-fuga infinita / encurralado)
    if (isThreatened && ai.standAndFightTimer <= 0 && ai.kiteCooldown <= 0) {
      const normPos = Math.hypot((unit.x - cx) / Math.max(40, rx), (unit.y - cy) / Math.max(40, ry));
      const notEscaping = nearestThreatDist <= ai.prevThreatDist + 4;
      ai.kiteDuration += dt;
      if (normPos >= 0.88 || notEscaping) {
        ai.corneredDuration += dt;
      } else {
        ai.corneredDuration = Math.max(0, ai.corneredDuration - dt * 0.5);
      }
      ai.prevThreatDist = nearestThreatDist;

      if (ai.kiteDuration >= 2.2 || ai.corneredDuration >= 0.85) {
        // Aceita que terá que lutar corpo a corpo / manter posição firme!
        ai.standAndFightTimer = 2.8;
        ai.kiteCooldown = 4.2;
        ai.kiteDuration = 0;
        ai.corneredDuration = 0;
      } else {
        const coverSpot = this.computeRangedRetreatTarget(unit, nearestThreat, allies, enemyCentroid, cx, cy, rx, ry, isBlockedFn);
        if (coverSpot) {
          const moved = this.steerUnitTowards(unit, coverSpot.x, coverSpot.y, mesh, cx, cy, rx, ry, isBlockedFn, dt, now, compute8DirFn, 1.04);
          if (!moved) {
            ai.corneredDuration += dt * 1.5;
          }
          return;
        }
        ai.standAndFightTimer = 2.5;
      }
    } else if (!isThreatened) {
      ai.kiteDuration = Math.max(0, ai.kiteDuration - dt * 0.6);
      ai.corneredDuration = 0;
    }

    // Se aceitou Stand & Fight (luta corpo a corpo), mantém posição encarando o inimigo
    if (ai.standAndFightTimer > 0 && nearestThreatDist <= effRange) {
      unit.action = 0;
      unit.dir = compute8DirFn(nearestThreat.x - unit.x, nearestThreat.y - unit.y);
      return;
    }

    // Se alvo está fora de alcance, aproxima-se até entrar na zona confortável (~82% do alcance)
    const comfortableDist = unit.tacticalRole === 'FRAGILE_SKIRMISHER' ? effRange * 0.90 : effRange * 0.82;
    if (distToTarget > comfortableDist) {
      const meleeAnchor = allies.find((a) => a && a.isAlive && a !== unit && a.combatStyle !== 'RANGED');
      let approachDest = { x: target.x, y: target.y };
      if (meleeAnchor) {
        const anchorToTarget = Math.hypot(target.x - meleeAnchor.x, target.y - meleeAnchor.y);
        if (anchorToTarget <= effRange * 0.65) {
          const dx = meleeAnchor.x - target.x;
          const dy = meleeAnchor.y - target.y;
          const len = Math.hypot(dx, dy) || 1;
          const backOffset = Math.min(86, Math.max(40, effRange * 0.84 - anchorToTarget));
          const candX = meleeAnchor.x + (dx / len) * backOffset;
          const candY = meleeAnchor.y + (dy / len) * backOffset;
          if (Math.hypot(target.x - candX, target.y - candY) <= effRange * 0.90) {
            approachDest = { x: candX, y: candY };
          }
        }
      }
      this.steerUnitTowards(unit, approachDest.x, approachDest.y, mesh, cx, cy, rx, ry, isBlockedFn, dt, now, compute8DirFn);
      return;
    }

    // Dentro do alcance ideal: aguarda próximo ataque olhando para o alvo
    unit.action = 0;
    unit.dir = compute8DirFn(target.x - unit.x, target.y - unit.y);
  }
}

window.ArenaUnitAiController = ArenaUnitAiController;
