/**
 * @file apps/server/public/play/js/ArenaProjectileResolver.js
 * @module @etheria/client/arena-projectiles
 * @description Submódulo da Arena de Combate (`/play`) responsável pelo ciclo de vida de projéteis
 *   teleguiados, resolução de impactos AoE/alvo único e execução de ataques básicos de Pets/Monstros.
 */

class ArenaProjectileResolver {
  static executeHomingSkill(arena, target, mpCost, cdMs, skillType, aoeRadius, dmgMultiplier, emoji, color, isMagical, now, cdKey) {
    if (now < arena.skillCooldowns[cdKey] || arena.player.mp < mpCost) return;
    arena.skillCooldowns[cdKey] = now + cdMs;
    arena.player.mp = Math.max(0, arena.player.mp - mpCost);
    arena.player.actionStartTime = now; arena.player.action = 7; arena.player.attackTimer = 0.40;
    arena.player.dir = arena.compute8Direction(target.x - arena.player.x, target.y - arena.player.y);
    ArenaProjectileResolver.spawnHomingProjectile(arena, target, skillType, aoeRadius, arena.player.atk, false, emoji, color, isMagical, undefined, undefined, undefined, 'ALLY', arena.player.critDmg, { attackerUnit: arena.player, skillMultiplier: dmgMultiplier });
    arena.updateHud();
  }

  static spawnHomingProjectile(arena, target, skillType, aoeRadius, dmg, isCrit, emoji, color, isMagical, startX, startY, speed, attackerAcc, team = 'ALLY', critDmgMult = null, extra = null) {
    arena.projectiles.push({
      x: startX !== undefined ? startX : arena.player.x,
      y: startY !== undefined ? startY : arena.player.y - 20,
      target, skillType, aoeRadius, dmg, isCrit, emoji, color, isMagical,
      speed: speed || 620, attackerAcc, team, critDmgMult,
      attackerUnit: extra?.attackerUnit || (team === 'ALLY' ? arena.player : null),
      skillMultiplier: extra?.skillMultiplier ?? 1.0,
    });
  }

  static updateProjectiles(arena, dt, now) {
    for (let i = arena.projectiles.length - 1; i >= 0; i--) {
      const p = arena.projectiles[i];
      if (!p.target || !p.target.isAlive) {
        if (p.team === 'ENEMY') {
          const aliveAllies = [arena.player, ...arena.pets].filter((u) => u && u.isAlive);
          p.target = aliveAllies[0] || null;
        } else {
          p.target = arena.getLockedTarget();
        }
        if (!p.target) { arena.projectiles.splice(i, 1); continue; }
      }
      const tx = p.target.x;
      const ty = p.target.y - 20;
      const dx = tx - p.x;
      const dy = ty - p.y;
      const dist = Math.hypot(dx, dy);

      if (dist <= 26 || p.skillType === 'GLOBAL_AOE') {
        ArenaProjectileResolver.resolveHomingImpact(arena, p, now);
        arena.projectiles.splice(i, 1);
      } else {
        p.x += (dx / dist) * p.speed * dt;
        p.y += (dy / dist) * p.speed * dt;
      }
    }
  }

  static resolveHomingImpact(arena, p, now) {
    const acc = p.attackerAcc !== undefined ? p.attackerAcc : (p.isMagical ? (arena.player.magAccuracy || 100) : (arena.player.physAccuracy || 100));

    if (p.team === 'ENEMY') {
      arena.applyDamageWithHitEvasionRoll(p.target, p, acc, now);
      arena.updateHud();
      return;
    }

    if (p.skillType === 'TARGET_AOE') {
      const cx = p.target.x;
      const cy = p.target.y;
      for (const mob of arena.monsters) {
        if (!mob.isAlive) continue;
        if (Math.hypot(mob.x - cx, mob.y - cy) <= p.aoeRadius) {
          arena.applyDamageWithHitEvasionRoll(mob, p, acc, now);
        }
      }
    } else if (p.skillType === 'GLOBAL_AOE') {
      for (const mob of arena.monsters) {
        if (mob.isAlive) arena.applyDamageWithHitEvasionRoll(mob, p, acc, now);
      }
    } else {
      arena.applyDamageWithHitEvasionRoll(p.target, p, acc, now);
    }
    arena.updateHud();
    arena.checkVictoryCondition();
  }

  static executeAiUnitAttack(arena, attacker, target, isCloseBrawl, now) {
    if (window.ActionSkillEngine && !window.ActionSkillEngine.isActionBlocked(attacker) && !window.ActionSkillEngine.isSilenced(attacker) && Array.isArray(attacker.skillIds) && attacker.skillIds.length > 0 && Math.random() < 0.28) {
      const skId = attacker.skillIds[Math.floor(Math.random() * attacker.skillIds.length)];
      const sk = (arena.skillCatalog || []).find((s) => Number(s.id) === Number(skId) && s.skillType !== 'PASSIVE');
      if (sk && attacker.mp >= (Number(sk.mpCost) || 0)) {
        const aspd = Number(attacker.attackSpeed) || 1.0;
        attacker.nextAttackTime = now + Math.round(1600 / aspd);
        window.ActionSkillEngine.executeSkill(arena, attacker, sk, target, now, null);
        return;
      }
    }
    const effAtt = window.ActionSkillEngine ? window.ActionSkillEngine.getEffectiveStats(attacker) : attacker;
    const aspd = Number(effAtt.attackSpeed || attacker.attackSpeed) || 1.0;
    const baseCd = attacker.team === 'ALLY' ? 1400 : 1550;
    attacker.nextAttackTime = now + Math.round(baseCd / aspd) + Math.random() * 350;
    attacker.attackTimer = 0.34;
    attacker.actionStartTime = now;

    const isMag = attacker.damageType === 'MAGICAL';
    const isRangedShot = attacker.combatStyle === 'RANGED' && !isCloseBrawl;
    attacker.action = isRangedShot ? 7 : 3;

    const acc = isMag ? (attacker.magAccuracy || 95) : (attacker.physAccuracy || 95);
    if (isRangedShot) {
      const emoji = isMag ? (attacker.team === 'ALLY' ? '✨' : '🔮') : '🏹';
      const color = attacker.team === 'ALLY' ? (isMag ? '#c084fc' : '#38bdf8') : (isMag ? '#f43f5e' : '#fb923c');
      ArenaProjectileResolver.spawnHomingProjectile(
        arena,
        target, 'SINGLE_TARGET', 0, attacker.atk, false, emoji, color, isMag,
        attacker.x, attacker.y - 20, 560, acc, attacker.team, attacker.critDmg || 1.5,
        { attackerUnit: attacker, skillMultiplier: 1.0 }
      );
      return;
    }

    const dmgScale = isCloseBrawl ? 0.85 : 1.0;
    arena.applyDamageWithHitEvasionRoll(
      target,
      {
        team: attacker.team, dmg: attacker.atk, attackerUnit: attacker, skillMultiplier: dmgScale,
        critDmgMult: attacker.critDmg || 1.5,
        emoji: isMag ? '💥' : (attacker.team === 'ALLY' ? '🐾' : '💔'),
        color: attacker.team === 'ALLY' ? (isMag ? '#c084fc' : '#38bdf8') : (isMag ? '#c084fc' : '#ef4444'),
        isMagical: isMag,
      },
      acc, now
    );

    if (attacker.team === 'ALLY') {
      arena.updateHud();
      arena.checkVictoryCondition();
    } else {
      arena.updateHud();
    }
  }
}

window.ArenaProjectileResolver = ArenaProjectileResolver;
