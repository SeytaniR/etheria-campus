/**
 * @file apps/server/public/play/js/ActionCombatArena.js
 * @module @etheria/server
 * @description Arena Instanciada no Mapa Real com Combate Livre em Tempo Real e Pathfinding de Monstros.
 */

class ActionCombatArena {
  constructor(client) {
    this.client = client;
    this.currentBattle = null;
    this.isActive = false;
    this.combatState = 'INACTIVE'; // 'INACTIVE' | 'PREPARATION' | 'FIGHTING' | 'RESULT'

    // Contagem Regressiva e Sistema de Pronto
    this.prepTimeRemaining = 20.0;
    this.totalRealPlayers = 1;
    this.readyPlayerIds = new Set();
    this.isLocalPlayerReady = false;

    // Dimensões da Arena no Mapa Real (+30% de área de combate)
    this.arenaCenterX = 0;
    this.arenaCenterY = 0;
    this.arenaRadiusX = 468;
    this.arenaRadiusY = 338;

    // Entidades na arena
    this.player = null;
    this.monsters = [];
    this.pets = [];
    this.floatingTexts = [];
    this.projectiles = [];
    this.selectedTargetMob = null;

    // Inputs e Controles
    this.keysDown = new Set();
    this.joystickActive = false;
    this.joystickTouchId = null;
    this.joystickOrigin = { x: 0, y: 0 };
    this.joystickVector = { x: 0, y: 0 };

    // Cooldowns das Habilidades do Jogador (ms)
    this.skillCooldowns = {
      attack: 0,
      skill1: 0,
      skill2: 0,
      dash: 0,
    };

    // Cache de spritesheets
    this.spriteCache = new Map();

    this.setupGlobalEvents();
  }

  getSprite(atlasJsonUrl, atlasWebpUrl, thumbUrl) {
    const key = atlasJsonUrl || thumbUrl;
    if (!key) return null;
    if (this.spriteCache.has(key)) return this.spriteCache.get(key);
    if (typeof window.McreworkSpriteSheet !== 'function') return null;
    const sprite = new window.McreworkSpriteSheet(atlasJsonUrl, atlasWebpUrl, thumbUrl);
    sprite.load();
    this.spriteCache.set(key, sprite);
    return sprite;
  }

  setupGlobalEvents() {
    window.addEventListener('keydown', (e) => {
      if (!this.isActive) return;
      this.keysDown.add(e.key.toLowerCase());
      if (e.key === ' ' || e.key.toLowerCase() === 'j') this.triggerAttack();
      else if (e.key === '1') this.triggerSkill(1);
      else if (e.key === '2') this.triggerSkill(2);
      else if (e.key.toLowerCase() === 'k' || e.key === 'Shift') this.triggerDash();
      else if (e.key === 'Escape') this.fleeBattle();
    });

    window.addEventListener('keyup', (e) => {
      if (!this.isActive) return;
      this.keysDown.delete(e.key.toLowerCase());
    });

    // Joystick Virtual (Pointer Events)
    const zone = document.getElementById('actionJoystickZone');
    if (zone) {
      const startJoystick = (clientX, clientY, id) => {
        this.joystickActive = true;
        this.joystickTouchId = id;
        const rect = zone.getBoundingClientRect();
        this.joystickOrigin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        this.handleJoystickMove(clientX, clientY);
      };

      const stopJoystick = (id) => {
        if (this.joystickTouchId === id || id === undefined) {
          this.joystickActive = false;
          this.joystickTouchId = null;
          this.joystickVector = { x: 0, y: 0 };
          const thumb = document.getElementById('actionJoystickThumb');
          if (thumb) thumb.style.transform = 'translate(0px, 0px)';
        }
      };

      zone.addEventListener('pointerdown', (e) => { e.preventDefault(); try { zone.setPointerCapture(e.pointerId); } catch (_) {} startJoystick(e.clientX, e.clientY, e.pointerId); });
      zone.addEventListener('pointermove', (e) => { if (!this.joystickActive || this.joystickTouchId !== e.pointerId) return; e.preventDefault(); this.handleJoystickMove(e.clientX, e.clientY); });
      const endPointer = (e) => { try { zone.releasePointerCapture(e.pointerId); } catch (_) {} stopJoystick(e.pointerId); };
      zone.addEventListener('pointerup', endPointer);
      zone.addEventListener('pointercancel', endPointer);
    }

    const closeBtn = document.getElementById('btnActionCloseResult');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); this.closeArena(); });
    }
  }

  handleJoystickMove(clientX, clientY) {
    const dx = clientX - this.joystickOrigin.x, dy = clientY - this.joystickOrigin.y, dist = Math.hypot(dx, dy);
    if (dist === 0) { this.joystickVector = { x: 0, y: 0 }; return; }
    const clampedDist = Math.min(45, dist), nx = dx / dist, ny = dy / dist;
    this.joystickVector = { x: nx, y: ny };
    const thumb = document.getElementById('actionJoystickThumb');
    if (thumb) thumb.style.transform = `translate(${nx * clampedDist}px, ${ny * clampedDist}px)`;
  }

  isBlocked(x, y) {
    const mesh = this.client?.mesh;
    if (!mesh) return false;
    return typeof mesh.isPointBlocked === 'function' ? mesh.isPointBlocked(x, y) : (typeof mesh.isPointInCollision === 'function' ? mesh.isPointInCollision(x, y) : false);
  }

  findFairSpawnPositions(cx, cy) {
    const angles = [-Math.PI / 4, (-3 * Math.PI) / 4, 0, Math.PI / 2, Math.PI / 4, (3 * Math.PI) / 4, Math.PI, -Math.PI / 2];
    for (const dist of [364, 320, 280, 240, 200, 160]) {
      const half = dist / 2;
      for (const ang of angles) {
        const px = Math.round(cx - Math.cos(ang) * half), py = Math.round(cy - Math.sin(ang) * (half * 0.72));
        const mx = Math.round(cx + Math.cos(ang) * half), my = Math.round(cy + Math.sin(ang) * (half * 0.72));
        if (!this.isBlocked(px, py) && !this.isBlocked(mx, my)) return { px, py, mx, my };
      }
    }
    return { px: cx - 80, py: cy, mx: cx + 80, my: cy };
  }

  openArena(battleState) {
    this.currentBattle = battleState;
    this.isActive = true;
    this.combatState = 'PREPARATION';
    this.prepTimeRemaining = 20.0;
    this.isLocalPlayerReady = false;
    this.readyPlayerIds = new Set();
    this.totalRealPlayers = Number(battleState.totalRealPlayers) || 1;

    this.arenaCenterX = Math.round(this.client?.playerX || 400);
    this.arenaCenterY = Math.round(this.client?.playerY || 300);
    this.arenaRadiusX = 468;
    this.arenaRadiusY = 338;

    const spawns = this.findFairSpawnPositions(this.arenaCenterX, this.arenaCenterY);
    const pState = battleState.player || {};
    const pDir = this.compute8Direction(spawns.mx - spawns.px, spawns.my - spawns.py);

    const baseCombat = this.client?.activeChar?.baseCombatAttributesJson || {};
    const baseSpeed = Number(baseCombat.BATTLE_MOVE_SPEED) || 180;
    const agi = (Number(this.client?.activeChar?.distributedStatsJson?.AGI) || 0) + (Number(this.client?.activeChar?.baseAttributesJson?.AGI) || 10);
    const battleSpeed = Math.min(baseSpeed * 1.40, baseSpeed + agi * 0.5);

    this.projectiles = [];
    this.selectedTargetMob = null;

    this.player = {
      x: spawns.px, y: spawns.py, speed: battleSpeed, dir: pDir, action: 0, isAlive: true,
      hp: pState.hp || 500, maxHp: pState.maxHp || 500, mp: pState.mp || 200, maxMp: pState.maxMp || 200,
      atk: pState.atk || 75, def: pState.def || 40, name: pState.name || this.client?.activeChar?.name || 'Herói',
      physAccuracy: Number(baseCombat.PHYS_ACCURACY) || 100,
      physEvasion: Number(baseCombat.PHYS_EVASION) || 10,
      magAccuracy: Number(baseCombat.MAG_ACCURACY) || 100,
      magEvasion: Number(baseCombat.MAG_EVASION) || 10,
      critRate: (Number(baseCombat.CRIT_RATE) || 5) / 100,
      critDmg: (Number(baseCombat.CRIT_DMG) || 150) / 100,
      attackSpeed: Number(baseCombat.ATTACK_SPEED) || 1.0,
      sprite: this.getSprite(pState.atlasJsonUrl, pState.atlasWebpUrl, pState.thumbUrl) ||
              (this.client?.activeChar ? this.client.getOrCreateSprite(
                `char_${this.client.activeChar.mcreworkCharKey}`,
                this.client.activeChar.atlasJsonUrl,
                this.client.activeChar.atlasWebpUrl,
                this.client.activeChar.thumbUrl
              ) : null),
      groundOffsetY: pState.groundOffsetY || this.client?.activeChar?.groundOffsetY || 0,
      shadowOffsetX: pState.shadowOffsetX || this.client?.activeChar?.shadowOffsetX || 0,
      shadowOffsetY: pState.shadowOffsetY || this.client?.activeChar?.shadowOffsetY || 0,
      combatStyle: pState.combatStyle || 'MELEE', attackRange: pState.attackRange || (pState.combatStyle === 'RANGED' ? 220 : 60),
      isAttacking: false, attackTimer: 0, isDashing: false, dashTimer: 0, hitTimer: 0,
    };

    if (this.client) {
      this.client.playerX = spawns.px; this.client.playerY = spawns.py; this.client.playerDir = pDir;
      this.client.currentPath = null; this.client.moveTargetX = null; this.client.moveTargetY = null;
    }

    const mStates = Array.isArray(battleState.monsters) ? battleState.monsters : [];
    this.monsters = mStates.map((m, idx) => {
      const offsetPerp = (idx - (mStates.length - 1) / 2) * 50;
      let mx = spawns.mx, my = spawns.my + offsetPerp;
      if (this.isBlocked(mx, my)) { mx = spawns.mx; my = spawns.my; }
      const mDir = this.compute8Direction(spawns.px - mx, spawns.py - my);
      return {
        id: m.id || `mob_${idx}`, templateId: battleState.monsterTemplateId,
        name: m.name || `Monstro #${idx + 1}`, x: mx, y: my, dir: mDir, action: 0, isAlive: true,
        hp: m.hp || 300, maxHp: m.maxHp || 300, atk: m.atk || 45, def: m.def || 25,
        speed: 110 + idx * 10, combatStyle: m.combatStyle || 'MELEE', attackRange: m.attackRange || (m.combatStyle === 'RANGED' ? 220 : 52),
        nextAttackTime: performance.now() + 1000 + idx * 400, hitTimer: 0, attackTimer: 0, fadeAlpha: 1.0,
        sprite: this.getSprite(m.atlasJsonUrl, m.atlasWebpUrl, m.thumbUrl),
        groundOffsetY: m.groundOffsetY || 0, shadowOffsetX: m.shadowOffsetX || 0, shadowOffsetY: m.shadowOffsetY || 0,
        path: null, nextRepathTime: 0,
      };
    });

    const pList = Array.isArray(battleState.pets) ? battleState.pets : [];
    this.pets = pList.map((p, idx) => {
      const offsetX = -36 - idx * 16;
      const offsetY = idx === 0 ? -26 : (idx === 1 ? 26 : 0);
      let px = spawns.px + offsetX, py = spawns.py + offsetY;
      if (this.isBlocked(px, py)) { px = spawns.px - 20; py = spawns.py; }
      return {
        id: p.id || `pet_${idx}`, name: p.name || `Pet #${idx + 1}`,
        x: px, y: py, dir: pDir, action: 0, isAlive: true,
        hp: p.hp || 320, maxHp: p.maxHp || 320, atk: p.atk || 42, def: p.def || 28,
        speed: Math.min(battleSpeed * 0.92, 175), combatStyle: p.combatStyle || 'MELEE', attackRange: p.attackRange || (p.combatStyle === 'RANGED' ? 220 : 55),
        nextAttackTime: performance.now() + 1000 + idx * 450, hitTimer: 0, attackTimer: 0, fadeAlpha: 1.0,
        sprite: this.getSprite(p.atlasJsonUrl, p.atlasWebpUrl, p.thumbUrl),
        groundOffsetY: p.groundOffsetY || 0, shadowOffsetX: p.shadowOffsetX || 0, shadowOffsetY: p.shadowOffsetY || 0,
        path: null, targetMob: null,
      };
    });

    this.floatingTexts = [];

    const modal = document.getElementById('actionCombatModal'); if (modal) modal.style.display = 'flex';
    const resultBanner = document.getElementById('actionResultBanner'); if (resultBanner) resultBanner.style.display = 'none';
    const prepBanner = document.getElementById('actionPrepBanner'); if (prepBanner) prepBanner.style.display = 'flex';
    const timerEl = document.getElementById('actPrepTimer'); if (timerEl) timerEl.textContent = '20s';
    const btnReady = document.getElementById('btnActReady'); if (btnReady) { btnReady.classList.remove('ready'); btnReady.textContent = '⚡ PRONTO!'; }
    const statusEl = document.getElementById('actPrepStatusText');
    if (statusEl) statusEl.textContent = this.totalRealPlayers > 1 ? `👥 Aguardando: 0/${this.totalRealPlayers} jogadores prontos` : 'Trace sua estratégia ou clique em Pronto';

    this.floatingTexts.push({
      x: spawns.px,
      y: spawns.py - 60,
      text: '⏳ PREPARE-SE PARA A BATALHA!',
      color: '#38bdf8',
      life: 2.2,
    });

    this.updateHud();
  }

  toggleReady() {
    if (!this.isActive || this.combatState !== 'PREPARATION') return;
    this.isLocalPlayerReady = !this.isLocalPlayerReady;
    const localId = this.client?.activeChar?.id || 'p1', btnReady = document.getElementById('btnActReady'), statusEl = document.getElementById('actPrepStatusText');
    if (this.isLocalPlayerReady) {
      this.readyPlayerIds.add(localId);
      if (btnReady) { btnReady.classList.add('ready'); btnReady.textContent = '✔️ VOCÊ ESTÁ PRONTO'; }
    } else {
      this.readyPlayerIds.delete(localId);
      if (btnReady) { btnReady.classList.remove('ready'); btnReady.textContent = '⚡ PRONTO!'; }
    }
    if (this.readyPlayerIds.size >= this.totalRealPlayers) this.startFightNow();
    else if (statusEl) statusEl.textContent = `👥 Aguardando: ${this.readyPlayerIds.size}/${this.totalRealPlayers} jogadores prontos...`;
  }

  startFightNow() {
    if (!this.isActive || this.combatState !== 'PREPARATION') return;
    this.combatState = 'FIGHTING';
    const prepBanner = document.getElementById('actionPrepBanner'); if (prepBanner) prepBanner.style.display = 'none';
    const px = this.player ? this.player.x : this.arenaCenterX, py = (this.player ? this.player.y : this.arenaCenterY) - 70;
    this.floatingTexts.push({ x: px, y: py, text: '⚔️ LUTA INICIADA!', color: '#fde047', life: 1.8 });
  }

  closeArena() {
    this.isActive = false;
    this.combatState = 'INACTIVE';
    this.pets = [];
    this.monsters = [];
    this.projectiles = [];
    this.selectedTargetMob = null;

    const modal = document.getElementById('actionCombatModal'); if (modal) modal.style.display = 'none';
    const prepBanner = document.getElementById('actionPrepBanner'); if (prepBanner) prepBanner.style.display = 'none';
    const resultBanner = document.getElementById('actionResultBanner'); if (resultBanner) resultBanner.style.display = 'none';

    if (this.client) {
      this.client.encounterCooldownUntil = performance.now() + 5000;
      this.client.moveTargetX = null; this.client.moveTargetY = null; this.client.currentPath = null;
      this.client.dpadDx = 0; this.client.dpadDy = 0; this.client.isMoving = false;
      if (this.player) { this.client.playerX = this.player.x; this.client.playerY = this.player.y; this.client.playerDir = this.player.dir; }
    }
  }

  fleeBattle() {
    if (!this.isActive) return;
    this.showResult(false, 'Você recuou da batalha com segurança e retornou ao mapa.', true);
  }

  updateHud() {
    if (!this.player) return;
    const hpPct = Math.max(0, Math.min(100, (this.player.hp / this.player.maxHp) * 100));
    const mpPct = Math.max(0, Math.min(100, (this.player.mp / this.player.maxMp) * 100));

    const hpBar = document.getElementById('actHudPlayerHpBar'); if (hpBar) hpBar.style.width = `${hpPct}%`;
    const mpBar = document.getElementById('actHudPlayerMpBar'); if (mpBar) mpBar.style.width = `${mpPct}%`;
    const hpText = document.getElementById('actHudPlayerHpText'); if (hpText) hpText.textContent = `${Math.ceil(this.player.hp)} / ${this.player.maxHp}`;
    const pName = document.getElementById('actHudPlayerName'); if (pName) pName.textContent = this.player.name;

    const aliveCount = this.monsters.filter((m) => m.isAlive).length;
    const mobCountElem = document.getElementById('actHudMonstersAlive'); if (mobCountElem) mobCountElem.textContent = String(aliveCount);

    const now = performance.now();
    this.updateCooldownOverlay('cdOverlaySkill1', this.skillCooldowns.skill1, now);
    this.updateCooldownOverlay('cdOverlaySkill2', this.skillCooldowns.skill2, now);
    this.updateCooldownOverlay('cdOverlayDash', this.skillCooldowns.dash, now);
  }

  updateCooldownOverlay(elemId, expireTime, now) {
    const el = document.getElementById(elemId); if (!el) return;
    if (expireTime > now) { el.textContent = `${((expireTime - now) / 1000).toFixed(1)}s`; el.style.display = 'flex'; }
    else el.style.display = 'none';
  }

  dealDamageToMob(mob, dmg, text, color, now) {
    mob.hp = Math.max(0, mob.hp - dmg); mob.hitTimer = 0.28; mob.actionStartTime = now; mob.action = 5;
    this.floatingTexts.push({ x: mob.x, y: mob.y - 48, text, color, life: 1.1 });
    if (mob.hp === 0) { mob.isAlive = false; mob.actionStartTime = now; mob.action = 6; }
  }

  getLockedTarget() {
    if (this.selectedTargetMob && this.selectedTargetMob.isAlive) return this.selectedTargetMob;
    let nearest = null;
    let minDist = Infinity;
    for (const m of this.monsters) {
      if (!m.isAlive) continue;
      const d = Math.hypot(m.x - this.player.x, m.y - this.player.y);
      if (d < minDist) { minDist = d; nearest = m; }
    }
    this.selectedTargetMob = nearest;
    return nearest;
  }

  triggerAttack() {
    if (!this.isActive || this.combatState !== 'FIGHTING' || !this.player || !this.player.isAlive || this.player.isAttacking) {
      return;
    }
    const now = performance.now();
    if (now < this.skillCooldowns.attack) return;

    const aspd = this.player.attackSpeed || 1.0;
    const intervalMs = Math.max(280, Math.round(380 / aspd));
    this.skillCooldowns.attack = now + intervalMs;

    this.player.isAttacking = true;
    this.player.attackTimer = 0.28;
    this.player.actionStartTime = now;
    this.player.action = 3;

    const target = this.getLockedTarget();
    if (target) {
      this.player.dir = this.compute8Direction(target.x - this.player.x, target.y - this.player.y);
      const isCrit = Math.random() < (this.player.critRate || 0.15);
      const rawDmg = Math.max(12, Math.round(this.player.atk * (100 / (100 + target.def * 0.4))));
      const isRanged = this.player.combatStyle === 'RANGED';
      this.spawnHomingProjectile(target, 'SINGLE', 0, rawDmg, isCrit, isRanged ? '🏹' : '⚔️', '#fde047', false);
    }
    this.updateHud();
  }

  triggerSkill(skillNum) {
    if (!this.isActive || this.combatState !== 'FIGHTING' || !this.player || !this.player.isAlive) return;
    const now = performance.now();
    const target = this.getLockedTarget();
    if (!target) return;

    if (skillNum === 1) {
      // Habilidade 1: Dano em Área Teleguiado (TARGET_AOE - raio 140px no entorno do alvo primário)
      this.executeHomingSkill(target, 20, 3800, 'TARGET_AOE', 150, 1.85, '🌪️', '#a78bfa', true, now, 'skill1');
    } else if (skillNum === 2) {
      // Habilidade 2: Alcance Global (GLOBAL_AOE - atinge todos os inimigos da arena toda)
      this.executeHomingSkill(target, 35, 5800, 'GLOBAL_AOE', 0, 2.25, '⚡', '#38bdf8', true, now, 'skill2');
    }
  }

  executeHomingSkill(target, mpCost, cdMs, skillType, aoeRadius, dmgMultiplier, emoji, color, isMagical, now, cdKey) {
    if (now < this.skillCooldowns[cdKey] || this.player.mp < mpCost) return;
    this.skillCooldowns[cdKey] = now + cdMs;
    this.player.mp = Math.max(0, this.player.mp - mpCost);
    this.player.actionStartTime = now; this.player.action = 7; this.player.attackTimer = 0.40;
    this.player.dir = this.compute8Direction(target.x - this.player.x, target.y - this.player.y);
    const isCrit = Math.random() < (this.player.critRate || 0.15);
    const rawDmg = Math.round(this.player.atk * dmgMultiplier);
    this.spawnHomingProjectile(target, skillType, aoeRadius, rawDmg, isCrit, emoji, color, isMagical);
    this.updateHud();
  }

  spawnHomingProjectile(target, skillType, aoeRadius, dmg, isCrit, emoji, color, isMagical, startX, startY, speed, attackerAcc) {
    this.projectiles.push({
      x: startX !== undefined ? startX : this.player.x,
      y: startY !== undefined ? startY : this.player.y - 20,
      target, skillType, aoeRadius, dmg, isCrit, emoji, color, isMagical,
      speed: speed || 620,
      attackerAcc,
    });
  }

  updateProjectiles(dt, now) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      if (!p.target || !p.target.isAlive) {
        p.target = this.getLockedTarget();
        if (!p.target) { this.projectiles.splice(i, 1); continue; }
      }
      const tx = p.target.x;
      const ty = p.target.y - 20;
      const dx = tx - p.x;
      const dy = ty - p.y;
      const dist = Math.hypot(dx, dy);

      if (dist <= 26 || p.skillType === 'GLOBAL_AOE') {
        this.resolveHomingImpact(p, now);
        this.projectiles.splice(i, 1);
      } else {
        p.x += (dx / dist) * p.speed * dt;
        p.y += (dy / dist) * p.speed * dt;
      }
    }
  }

  resolveHomingImpact(p, now) {
    const acc = p.attackerAcc !== undefined ? p.attackerAcc : (p.isMagical ? (this.player.magAccuracy || 100) : (this.player.physAccuracy || 100));

    if (p.skillType === 'TARGET_AOE') {
      const cx = p.target.x;
      const cy = p.target.y;
      for (const mob of this.monsters) {
        if (!mob.isAlive) continue;
        if (Math.hypot(mob.x - cx, mob.y - cy) <= p.aoeRadius) {
          this.applyDamageWithHitEvasionRoll(mob, p, acc, now);
        }
      }
    } else if (p.skillType === 'GLOBAL_AOE') {
      for (const mob of this.monsters) {
        if (mob.isAlive) this.applyDamageWithHitEvasionRoll(mob, p, acc, now);
      }
    } else {
      this.applyDamageWithHitEvasionRoll(p.target, p, acc, now);
    }
    this.updateHud();
    this.checkVictoryCondition();
  }

  applyDamageWithHitEvasionRoll(mob, p, attackerAcc, now) {
    const eva = p.isMagical ? (mob.magEvasion || 10) : (mob.physEvasion || 10);
    const hitRate = Math.max(15, Math.min(100, 90 + (attackerAcc - eva) * 0.20));
    const isHit = Math.random() * 100 <= hitRate;

    if (!isHit) {
      this.floatingTexts.push({ x: mob.x, y: mob.y - 48, text: '💨 DESVIO!', color: '#38bdf8', life: 1.1 });
      return;
    }

    const variance = 0.92 + Math.random() * 0.16;
    let finalDmg = Math.round(p.dmg * variance);
    if (p.isCrit) finalDmg = Math.round(finalDmg * (this.player.critDmg || 1.55));
    const text = p.isCrit ? `💥 CRÍTICO! -${finalDmg}` : `${p.emoji} -${finalDmg}`;
    const color = p.isCrit ? '#fde047' : p.color;
    this.dealDamageToMob(mob, finalDmg, text, color, now);
  }

  triggerDash() {
    if (!this.isActive || this.combatState !== 'FIGHTING' || !this.player || !this.player.isAlive || this.player.isDashing) return;
    const now = performance.now();
    if (now < this.skillCooldowns.dash) return;
    this.skillCooldowns.dash = now + 1800; this.player.isDashing = true; this.player.dashTimer = 0.22;
  }

  checkVictoryCondition() {
    const aliveMobs = this.monsters.filter((m) => m.isAlive);
    if (aliveMobs.length === 0) {
      const expGained = this.monsters.length * 65;
      const goldGained = this.monsters.length * 25;
      this.recordBattleVictoryOnServer(expGained, goldGained);
      this.showResult(true, `Você venceu o confronto na arena!<br><br>✨ <strong>+${expGained} EXP</strong> &bull; 🪙 <strong>+${goldGained} Ouro</strong>`);
    }
  }

  async recordBattleVictoryOnServer(exp, gold) {
    try {
      if (this.currentBattle && this.client) {
        await this.client.api('/api/play/temporary-combat/action', {
          method: 'POST',
          body: JSON.stringify({
            battleId: this.currentBattle.battleId,
            actionType: 'ATTACK',
            targetMonsterIndex: 0,
          }),
        });
      }
    } catch (err) {
      console.warn('Falha ao sincronizar vitória no backend:', err);
    }
  }

  showResult(isVictory, messageHtml, isFled = false) {
    this.combatState = 'RESULT';
    const modal = document.getElementById('actionCombatModal'); if (modal) modal.style.display = 'flex';
    const prepBanner = document.getElementById('actionPrepBanner'); if (prepBanner) prepBanner.style.display = 'none';
    const banner = document.getElementById('actionResultBanner');
    const title = document.getElementById('actionResultTitle');
    const rewards = document.getElementById('actionResultRewards');
    if (!banner || !title || !rewards) return;
    title.textContent = isFled ? '🏃 Fuga da Batalha' : (isVictory ? '🏆 VITÓRIA!' : '💀 VOCÊ FOI DERROTADO!');
    title.style.color = isFled ? '#7dd3fc' : (isVictory ? '#fde047' : '#f87171');
    rewards.innerHTML = messageHtml;
    banner.style.display = 'flex';
  }

  compute8Direction(dx, dy) {
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    const sector = Math.round((90 - angle) / 45);
    return ((sector % 8) + 8) % 8;
  }

  updatePhysics(dt, now) {
    if (!this.isActive || !this.player || !this.player.isAlive) return;

    // 0. Atualiza Contagem de 20s durante PREPARATION
    if (this.combatState === 'PREPARATION') {
      this.prepTimeRemaining = Math.max(0, this.prepTimeRemaining - dt);
      const timerEl = document.getElementById('actPrepTimer');
      if (timerEl) timerEl.textContent = `${Math.ceil(this.prepTimeRemaining)}s`;
      if (this.prepTimeRemaining <= 0) {
        this.startFightNow();
        return;
      }

      this.player.action = 0;
      if (this.client) {
        this.client.currentPath = null;
        this.client.moveTargetX = null;
        this.client.moveTargetY = null;
        this.client.dpadDx = 0;
        this.client.dpadDy = 0;
        this.client.isMoving = false;
      }
      for (const mob of this.monsters) {
        if (!mob.isAlive) continue;
        mob.action = 0;
        mob.dir = this.compute8Direction(this.player.x - mob.x, this.player.y - mob.y);
      }
      for (const pet of this.pets) {
        if (!pet.isAlive) continue;
        pet.action = 0;
        const firstMob = this.monsters.find((m) => m.isAlive);
        pet.dir = firstMob ? this.compute8Direction(firstMob.x - pet.x, firstMob.y - pet.y) : this.player.dir;
      }
      return;
    }

    this.updateProjectiles(dt, now);

    // 1. Movimentação do Jogador em Combate Ativo (FIGHTING)
    let vx = 0;
    let vy = 0;

    const keys = this.keysDown;
    const clientKeys = this.client?.keysDown;
    const isDown = (k) => keys.has(k) || (clientKeys && clientKeys.has(k));

    if (isDown('w') || isDown('arrowup')) vy -= 1;
    if (isDown('s') || isDown('arrowdown')) vy += 1;
    if (isDown('a') || isDown('arrowleft')) vx -= 1;
    if (isDown('d') || isDown('arrowright')) vx += 1;

    if (vx === 0 && vy === 0 && this.client && (this.client.dpadDx !== 0 || this.client.dpadDy !== 0)) {
      vx = this.client.dpadDx;
      vy = this.client.dpadDy;
    }

    if (this.joystickActive && (this.joystickVector.x !== 0 || this.joystickVector.y !== 0)) {
      vx = this.joystickVector.x;
      vy = this.joystickVector.y;
    }

    if (vx !== 0 || vy !== 0) {
      const len = Math.hypot(vx, vy);
      vx /= len; vy /= len;
      if (this.client) { this.client.currentPath = null; this.client.moveTargetX = null; this.client.moveTargetY = null; }
    } else if (this.client && this.client.currentPath && this.client.currentPath.length > 0) {
      const wp = this.client.currentPath[0];
      const dx = wp.x - this.player.x, dy = wp.y - this.player.y, dist = Math.hypot(dx, dy);
      if (dist <= 12) {
        this.client.currentPath.shift();
        if (this.client.currentPath.length > 0) {
          this.client.moveTargetX = this.client.currentPath[0].x; this.client.moveTargetY = this.client.currentPath[0].y;
        } else {
          this.client.currentPath = null; this.client.moveTargetX = null; this.client.moveTargetY = null;
        }
      } else {
        vx = dx / dist; vy = dy / dist;
      }
    } else if (this.client && this.client.moveTargetX !== null && this.client.moveTargetY !== null) {
      const dx = this.client.moveTargetX - this.player.x, dy = this.client.moveTargetY - this.player.y, dist = Math.hypot(dx, dy);
      if (dist <= 8) { this.client.moveTargetX = null; this.client.moveTargetY = null; } else { vx = dx / dist; vy = dy / dist; }
    }

    let curSpeed = this.player.speed;
    if (this.player.isDashing) {
      this.player.dashTimer -= dt;
      if (this.player.dashTimer <= 0) this.player.isDashing = false; else curSpeed *= 2.3;
    }
    if (this.player.isAttacking) {
      this.player.attackTimer -= dt;
      if (this.player.attackTimer <= 0) { this.player.isAttacking = false; this.player.action = 0; }
    }
    if (this.player.hitTimer > 0) this.player.hitTimer -= dt;

    if (vx !== 0 || vy !== 0) {
      let targetX = this.player.x + vx * curSpeed * dt;
      let targetY = this.player.y + vy * curSpeed * dt;

      const normX = (targetX - this.arenaCenterX) / this.arenaRadiusX, normY = (targetY - this.arenaCenterY) / this.arenaRadiusY;
      const distSq = normX * normX + normY * normY;
      if (distSq > 1) {
        const scale = 1 / Math.sqrt(distSq);
        targetX = this.arenaCenterX + (targetX - this.arenaCenterX) * scale;
        targetY = this.arenaCenterY + (targetY - this.arenaCenterY) * scale;
      }
      if (!this.isBlocked(targetX, targetY)) { this.player.x = targetX; this.player.y = targetY; }
      else if (!this.isBlocked(targetX, this.player.y)) this.player.x = targetX;
      else if (!this.isBlocked(this.player.x, targetY)) this.player.y = targetY;
      else if (this.client && (this.client.moveTargetX !== null || this.client.moveTargetY !== null)) {
        this.client.moveTargetX = null; this.client.moveTargetY = null; this.client.currentPath = null;
      }

      this.player.dir = this.compute8Direction(vx, vy);
      if (!this.player.isAttacking) this.player.action = 1;
      if (this.client) { this.client.playerX = this.player.x; this.client.playerY = this.player.y; this.client.playerDir = this.player.dir; }
    } else if (!this.player.isAttacking && this.player.hitTimer <= 0) {
      this.player.action = 0;
    }

    // 2. IA dos Monstros com Desvio Dinâmico de Obstáculos (Pathfinding)
    for (const mob of this.monsters) {
      if (!mob.isAlive) {
        mob.fadeAlpha = Math.max(0, mob.fadeAlpha - dt * 1.5);
        continue;
      }

      if (mob.hitTimer > 0) {
        mob.hitTimer -= dt;
        if (mob.hitTimer <= 0) mob.action = 0;
        continue;
      }
      if (mob.attackTimer > 0) {
        mob.attackTimer -= dt;
        if (mob.attackTimer <= 0) mob.action = 0;
        continue;
      }

      const mdx = this.player.x - mob.x;
      const mdy = this.player.y - mob.y;
      const mDist = Math.hypot(mdx, mdy);

      if (mDist > mob.attackRange) {
        let steerX = mdx;
        let steerY = mdy;

        // Verifica se a linha reta até o jogador está livre de obstáculos
        const mesh = this.client?.mesh;
        const isDirectClear = mesh ? mesh.isSegmentClear(mob.x, mob.y, this.player.x, this.player.y, 16) : true;

        if (isDirectClear) {
          mob.path = null;
        } else {
          // Desvio inteligente via A* e String Pulling
          if (!mob.path || mob.path.length === 0 || now >= (mob.nextRepathTime || 0)) {
            mob.path = mesh ? mesh.findPath(mob.x, mob.y, this.player.x, this.player.y) : null;
            mob.nextRepathTime = now + 350 + Math.random() * 150;
          }

          if (mob.path && mob.path.length > 0) {
            if (Math.hypot(mob.path[0].x - mob.x, mob.path[0].y - mob.y) <= 14) mob.path.shift();
            if (mob.path.length > 0) { steerX = mob.path[0].x - mob.x; steerY = mob.path[0].y - mob.y; }
          }
        }

        const steerLen = Math.hypot(steerX, steerY);
        let nMx = mob.x + (steerLen > 0 ? (steerX / steerLen) * mob.speed * dt : 0);
        let nMy = mob.y + (steerLen > 0 ? (steerY / steerLen) * mob.speed * dt : 0);

        const mNormX = (nMx - this.arenaCenterX) / this.arenaRadiusX;
        const mNormY = (nMy - this.arenaCenterY) / this.arenaRadiusY;
        const mDistSq = mNormX * mNormX + mNormY * mNormY;
        if (mDistSq > 1) {
          const scale = 1 / Math.sqrt(mDistSq);
          nMx = this.arenaCenterX + (nMx - this.arenaCenterX) * scale;
          nMy = this.arenaCenterY + (nMy - this.arenaCenterY) * scale;
        }

        if (!this.isBlocked(nMx, nMy)) { mob.x = nMx; mob.y = nMy; }
        else if (!this.isBlocked(nMx, mob.y)) mob.x = nMx;
        else if (!this.isBlocked(mob.x, nMy)) mob.y = nMy;

        mob.dir = this.compute8Direction(steerX, steerY);
        mob.action = 1;
      } else {
        mob.action = 0;
        mob.dir = this.compute8Direction(mdx, mdy);

        if (now >= mob.nextAttackTime) {
          mob.nextAttackTime = now + 1800 + Math.random() * 800;
          mob.attackTimer = 0.40; mob.actionStartTime = now; mob.action = 3;
          if (!this.player.isDashing) {
            const mobAcc = mob.physAccuracy || 95, pEva = this.player.physEvasion || 10;
            const hitRate = Math.max(15, Math.min(100, 90 + (mobAcc - pEva) * 0.20));
            if (Math.random() * 100 > hitRate) {
              this.floatingTexts.push({ x: this.player.x, y: this.player.y - 45, text: '💨 DESVIO!', color: '#38bdf8', life: 1.0 });
            } else {
              const dmg = Math.max(5, Math.round(mob.atk * (100 / (100 + this.player.def * 0.5))));
              this.player.hp = Math.max(0, this.player.hp - dmg);
              this.player.hitTimer = 0.22; this.player.actionStartTime = now; this.player.action = 5;
              this.floatingTexts.push({ x: this.player.x, y: this.player.y - 45, text: `💔 -${dmg}`, color: '#ef4444', life: 1.0 });
              if (this.player.hp === 0) {
                this.player.isAlive = false; this.player.actionStartTime = now; this.player.action = 6;
                this.showResult(false, 'Você foi derrotado na arena.'); break;
              }
            }
          }
        }
      }
    }

    // 2.5. IA Autônoma dos Pets Aliados (2 a 3 pets)
    for (const pet of this.pets) {
      if (!pet.isAlive) {
        if (pet.fadeAlpha > 0) pet.fadeAlpha = Math.max(0, pet.fadeAlpha - dt * 0.8);
        continue;
      }
      if (pet.hitTimer > 0) {
        pet.hitTimer -= dt;
        if (pet.hitTimer <= 0 && pet.action === 5) pet.action = 0;
      }
      if (pet.attackTimer > 0) {
        pet.attackTimer -= dt;
        if (pet.attackTimer <= 0 && pet.action === 3) pet.action = 0;
        continue;
      }

      let target = (this.selectedTargetMob && this.selectedTargetMob.isAlive) ? this.selectedTargetMob : null;
      if (!target) {
        let minDist = Infinity;
        for (const m of this.monsters) {
          if (!m.isAlive) continue;
          const d = Math.hypot(m.x - pet.x, m.y - pet.y);
          if (d < minDist) { minDist = d; target = m; }
        }
      }
      pet.targetMob = target;

      if (target) {
        const pdx = target.x - pet.x, pdy = target.y - pet.y, dist = Math.hypot(pdx, pdy);
        if (dist > pet.attackRange) {
          const s = pet.speed * dt;
          let nx = pet.x + (pdx / dist) * s, ny = pet.y + (pdy / dist) * s;
          const pNormX = (nx - this.arenaCenterX) / this.arenaRadiusX, pNormY = (ny - this.arenaCenterY) / this.arenaRadiusY;
          if (pNormX * pNormX + pNormY * pNormY <= 1) {
            if (!this.isBlocked(nx, ny)) { pet.x = nx; pet.y = ny; }
            else if (!this.isBlocked(nx, pet.y)) pet.x = nx;
            else if (!this.isBlocked(pet.x, ny)) pet.y = ny;
          }
          pet.dir = this.compute8Direction(pdx, pdy);
          pet.action = 1;
        } else {
          pet.action = 0;
          pet.dir = this.compute8Direction(pdx, pdy);
          if (now >= pet.nextAttackTime) {
            pet.nextAttackTime = now + 1500 + Math.random() * 500;
            pet.attackTimer = 0.35; pet.actionStartTime = now; pet.action = 3;
            this.spawnHomingProjectile(target, 'SINGLE_TARGET', 0, pet.atk, false, '🐾', '#38bdf8', false, pet.x, pet.y - 20, 500, 100);
          }
        }
      } else {
        const fdx = (this.player.x - 30) - pet.x, fdy = this.player.y - pet.y, fDist = Math.hypot(fdx, fdy);
        if (fDist > 65) {
          const s = pet.speed * dt;
          pet.x += (fdx / fDist) * s; pet.y += (fdy / fDist) * s;
          pet.dir = this.compute8Direction(fdx, fdy); pet.action = 1;
        } else {
          pet.action = 0;
        }
      }
    }

    // 3. Floating Texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const f = this.floatingTexts[i]; f.y -= dt * 28; f.life -= dt;
      if (f.life <= 0) this.floatingTexts.splice(i, 1);
    }
  }

  getCamFocusX() {
    if (!this.player) return this.client?.playerX || 0;
    const m = this.monsters.find((m) => m.isAlive);
    return m ? Math.round(this.player.x * 0.65 + m.x * 0.35) : this.player.x;
  }

  getCamFocusY() {
    if (!this.player) return this.client?.playerY || 0;
    const m = this.monsters.find((m) => m.isAlive);
    return m ? Math.round(this.player.y * 0.65 + m.y * 0.35) : this.player.y;
  }

  drawArenaRingOnFloor(ctx, now, zoom) {
    if (!this.isActive) return;
    const cx = this.arenaCenterX;
    const cy = this.arenaCenterY;
    const rx = this.arenaRadiusX;
    const ry = this.arenaRadiusY;

    ctx.save();
    const pulse = 0.85 + 0.15 * Math.sin(now / 260);
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(56, 189, 248, ${0.50 * pulse})`;
    ctx.lineWidth = 2.5 / zoom;
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 8;
    ctx.stroke();

    for (let i = 0; i < 8; i++) {
      const ang = (i * Math.PI) / 4;
      const gx = cx + Math.cos(ang) * rx;
      const gy = cy + Math.sin(ang) * ry;
      ctx.beginPath();
      ctx.arc(gx, gy, 4.5 / zoom, 0, Math.PI * 2);
      ctx.fillStyle = '#38bdf8';
      ctx.fill();
    }

    // Retículo de Foco Teleguiado no Alvo Travado
    const target = this.getLockedTarget();
    if (target && target.isAlive) {
      const pPulse = 1 + 0.12 * Math.sin(now / 150);
      ctx.beginPath();
      ctx.ellipse(target.x, target.y - 8, 22 * pPulse, 12 * pPulse, 0, 0, Math.PI * 2);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2.5 / zoom;
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 10;
      ctx.stroke();
    }

    this.renderProjectiles(ctx, zoom);
    ctx.restore();
  }

  renderProjectiles(ctx, zoom = 1.0) {
    if (!this.isActive || !this.projectiles || this.projectiles.length === 0) return;
    for (const p of this.projectiles) {
      ctx.save(); ctx.beginPath(); ctx.arc(p.x, p.y, 6.5 / zoom, 0, Math.PI * 2);
      ctx.fillStyle = p.color || '#fde047'; ctx.shadowColor = p.color || '#fde047'; ctx.shadowBlur = 10;
      ctx.fill(); ctx.restore();
    }
  }

  populateRenderQueue(renderQueue, now) {
    if (!this.isActive) return;
    if (this.player && this.player.isAlive) renderQueue.push({ type: 'COMBAT_PLAYER', y: this.player.y, data: this.player });
    for (const pet of this.pets) {
      if (pet.fadeAlpha > 0) renderQueue.push({ type: 'COMBAT_PET', y: pet.y, data: pet });
    }
    for (const mob of this.monsters) {
      if (mob.fadeAlpha > 0) renderQueue.push({ type: 'COMBAT_MONSTER', y: mob.y, data: mob });
    }
  }

  renderFloatingTexts(ctx) {
    for (const f of this.floatingTexts) {
      ctx.save(); ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = f.color || '#fff';
      ctx.shadowColor = '#000'; ctx.shadowBlur = 4; ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
      ctx.fillText(f.text, f.x, f.y); ctx.restore();
    }
  }
}

window.ActionCombatArena = ActionCombatArena;
