/**
 * @file apps/server/public/play/js/ActionCombatArena.js
 * @module @etheria/server
 * @description Arena Instanciada no Mapa Real (1300x940 px) com Combate Livre em Tempo Real,
 *   Colisão Física entre Todos os Modelos, Formação Tática e IA Coordenadora de Equipes.
 * @rules Segue estritamente AGENTS.md (Pilar 3: OOP Modular, Regra #7 < 1.000 linhas).
 * @dependencies ArenaPhysicsSolver, ArenaUnitAiController, ClientPolygonMesh, McreworkSpriteSheet
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

    // Dimensões da Arena no Mapa Real (1300 x 940 px elíptico)
    this.arenaCenterX = 0;
    this.arenaCenterY = 0;
    this.arenaRadiusX = 650;
    this.arenaRadiusY = 470;

    // Entidades na arena
    this.player = null;
    this.monsters = [];
    this.pets = [];
    this.floatingTexts = [];
    this.projectiles = [];
    this.selectedTargetMob = null;

    // Submódulo de IA Tática e Controle de Recálculo Periódico
    this.aiController = window.ArenaUnitAiController ? new window.ArenaUnitAiController() : null;
    this.nextTacticsEvalTime = 0;
    this.allyTeamTactics = { enemyCentroid: { x: 0, y: 0, count: 0 } };
    this.enemyTeamTactics = { enemyCentroid: { x: 0, y: 0, count: 0 } };

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
    if (window.ArenaPhysicsSolver) {
      return window.ArenaPhysicsSolver.findFairSpawnPositions(cx, cy, this.arenaRadiusX, this.arenaRadiusY, (x, y) => this.isBlocked(x, y));
    }
    return { px: cx - 320, py: cy, mx: cx + 320, my: cy };
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
    this.arenaRadiusX = 650;
    this.arenaRadiusY = 470;

    const spawns = this.findFairSpawnPositions(this.arenaCenterX, this.arenaCenterY);
    const pState = battleState.player || {};
    const pDir = this.compute8Direction(spawns.mx - spawns.px, spawns.my - spawns.py);

    const baseCombat = this.client?.activeChar?.baseCombatAttributesJson || {};
    const globalCombatAttr = (this.client?.combatAttributes || []).find((ca) => ca.code === 'BATTLE_MOVE_SPEED');
    const globalDefaultSpeed = globalCombatAttr ? Number(globalCombatAttr.baseDefault) : 180;
    const classMoveSpeed = Number(baseCombat.BATTLE_MOVE_SPEED);
    const agiConv = (this.client?.attributeConversions || []).find(
      (c) => c.baseAttributeCode === 'AGI' && c.combatAttributeCode === 'BATTLE_MOVE_SPEED'
    );
    const agiRatio = agiConv ? Number(agiConv.ratioPerPoint) : 0.5;
    const totalAgi =
      (Number(this.client?.activeChar?.distributedStatsJson?.AGI) || 0) +
      (Number(this.client?.activeChar?.baseAttributesJson?.AGI) || 10);

    const battleSpeed = Math.max(
      60,
      Number(
        pState.battleMoveSpeed ||
        (classMoveSpeed ? classMoveSpeed + totalAgi * agiRatio : null) ||
        (globalDefaultSpeed ? globalDefaultSpeed + totalAgi * agiRatio : null) ||
        180
      )
    );

    this.projectiles = [];
    this.selectedTargetMob = null;

    this.player = {
      id: pState.id || 'player_1',
      isPlayer: true,
      team: 'ALLY',
      bodyRadiusX: 24,
      bodyRadiusY: 17,
      x: spawns.px, y: spawns.py, speed: battleSpeed, dir: pDir, action: 0, isAlive: true,
      hp: pState.hp || 500, maxHp: pState.maxHp || 500, mp: pState.mp || 200, maxMp: pState.maxMp || 200,
      atk: pState.atk || 75, def: pState.def || 40, magDef: pState.magDef || pState.def || 40,
      name: pState.name || this.client?.activeChar?.name || 'Herói',
      physAccuracy: Math.min(125, Math.max(20, Number(baseCombat.PHYS_ACCURACY) || 95)),
      physEvasion: Math.min(75, Math.max(0, Number(baseCombat.PHYS_EVASION) || 5)),
      magAccuracy: Math.min(125, Math.max(20, Number(baseCombat.MAG_ACCURACY) || 95)),
      magEvasion: Math.min(75, Math.max(0, Number(baseCombat.MAG_EVASION) || 5)),
      critRate: Math.min(0.80, (Number(baseCombat.CRIT_RATE) || 5) / 100),
      critDmg: Math.min(3.00, (Number(baseCombat.CRIT_DMG) || 150) / 100),
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
      combatStyle: pState.combatStyle || this.client?.activeChar?.combatStyle || 'MELEE',
      attackRange: pState.attackRange || this.client?.activeChar?.attackRange || (pState.combatStyle === 'RANGED' ? 220 : 60),
      damageType: pState.damageType || this.client?.activeChar?.damageType || 'PHYSICAL',
      isAttacking: false, attackTimer: 0, isDashing: false, dashTimer: 0, hitTimer: 0,
    };

    if (this.client) {
      this.client.playerX = spawns.px; this.client.playerY = spawns.py; this.client.playerDir = pDir;
      this.client.currentPath = null; this.client.moveTargetX = null; this.client.moveTargetY = null;
    }

    const isBlockedFn = (x, y) => this.isBlocked(x, y);
    const pList = Array.isArray(battleState.pets) ? battleState.pets : [];
    const mStates = Array.isArray(battleState.monsters) ? battleState.monsters : [];

    const mDir = this.compute8Direction(spawns.px - spawns.mx, spawns.py - spawns.my);
    const getSp = (j, w, t) => this.getSprite(j, w, t);
    const rawPetModels = pList.map((p, idx) =>
      window.ArenaPhysicsSolver.createAiUnitModel(p, idx, false, spawns.px, spawns.py, pDir, battleSpeed, getSp)
    );
    const rawMobModels = mStates.map((m, idx) =>
      window.ArenaPhysicsSolver.createAiUnitModel(m, idx, true, spawns.mx, spawns.my, mDir, battleSpeed, getSp, battleState.monsterTemplateId)
    );

    if (window.ArenaPhysicsSolver) {
      const petCoords = window.ArenaPhysicsSolver.buildTeamFormationPositions(
        spawns.px, spawns.py, spawns.mx, spawns.my, rawPetModels,
        this.arenaCenterX, this.arenaCenterY, this.arenaRadiusX, this.arenaRadiusY, isBlockedFn, [{ x: spawns.px, y: spawns.py }]
      );
      rawPetModels.forEach((p, idx) => { if (petCoords[idx]) { p.x = petCoords[idx].x; p.y = petCoords[idx].y; } });

      const mobCoords = window.ArenaPhysicsSolver.buildTeamFormationPositions(
        spawns.mx, spawns.my, spawns.px, spawns.py, rawMobModels,
        this.arenaCenterX, this.arenaCenterY, this.arenaRadiusX, this.arenaRadiusY, isBlockedFn, [{ x: spawns.px, y: spawns.py }, ...rawPetModels]
      );
      rawMobModels.forEach((m, idx) => { if (mobCoords[idx]) { m.x = mobCoords[idx].x; m.y = mobCoords[idx].y; } });
    }

    this.pets = rawPetModels;
    this.monsters = rawMobModels;

    if (window.ArenaPhysicsSolver) {
      window.ArenaPhysicsSolver.resolveAllUnitCollisions(
        [this.player, ...this.pets, ...this.monsters],
        this.arenaCenterX, this.arenaCenterY, this.arenaRadiusX, this.arenaRadiusY, isBlockedFn
      );
    }

    if (this.aiController) {
      this.allyTeamTactics = this.aiController.evaluateTeamTactics([this.player, ...this.pets], this.monsters);
      this.enemyTeamTactics = this.aiController.evaluateTeamTactics(this.monsters, [this.player, ...this.pets]);
      this.nextTacticsEvalTime = performance.now() + 350;
    }

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

  dealDamageToUnit(unit, dmg, text, color, now) {
    if (!unit || !unit.isAlive) return;
    unit.hp = Math.max(0, unit.hp - dmg);
    unit.hitTimer = 0.24;
    unit.actionStartTime = now;
    unit.action = 5;
    this.floatingTexts.push({ x: unit.x, y: unit.y - 48, text, color, life: 1.05 });

    if (unit.hp === 0) {
      unit.isAlive = false;
      unit.actionStartTime = now;
      unit.action = 6;
      if (unit.isPlayer) {
        this.showResult(false, 'Você foi derrotado na arena.');
      }
    }
  }

  dealDamageToMob(mob, dmg, text, color, now) {
    this.dealDamageToUnit(mob, dmg, text, color, now);
  }

  cleanseUnitDebuffs(unit, maxDebuffs = 0, healPerDebuffPct = 0, cleanseChancePct = 100) {
    if (!unit || !unit.isAlive) return 0;
    if (Math.random() * 100 > (Number(cleanseChancePct) || 100)) return 0;
    const statuses = Array.isArray(unit.activeStatuses) ? unit.activeStatuses : [];
    const limit = Number(maxDebuffs) > 0 ? Number(maxDebuffs) : Infinity;
    let removed = 0;
    unit.activeStatuses = statuses.filter((st) => {
      if (!st.isBuff && removed < limit) {
        removed += 1;
        return false;
      }
      return true;
    });
    if (removed > 0) {
      const healPct = Math.max(0, Number(healPerDebuffPct) || 0);
      if (healPct > 0) {
        const healAmt = Math.round(unit.maxHp * (healPct / 100) * removed);
        unit.hp = Math.min(unit.maxHp, unit.hp + healAmt);
      }
      this.floatingTexts.push({
        x: unit.x, y: unit.y - 54, text: `✨ PURIFICADO! (-${removed} Debuff)`, color: '#2dd4bf', life: 1.25,
      });
    }
    return removed;
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
      const dist = Math.hypot(target.x - this.player.x, target.y - this.player.y);
      const maxRange = this.player.attackRange || (this.player.combatStyle === 'RANGED' ? 220 : 60);
      if (dist > maxRange + 25) {
        this.floatingTexts.push({ x: this.player.x, y: this.player.y - 45, text: '📏 Fora de Alcance!', color: '#fde047', life: 0.7 });
        return;
      }
      this.player.dir = this.compute8Direction(target.x - this.player.x, target.y - this.player.y);
      const isCrit = Math.random() < (this.player.critRate || 0.15);
      const isMagical = this.player.damageType === 'MAGICAL';
      const defStat = isMagical ? (target.magDef || target.def) : target.def;
      const rawDmg = Math.max(12, Math.round(this.player.atk * (100 / (100 + defStat * 0.4))));
      const isRanged = this.player.combatStyle === 'RANGED';
      const projectileEmoji = isMagical ? (isRanged ? '🔮' : '✨') : (isRanged ? '🏹' : '⚔️');
      const projectileColor = isMagical ? '#c084fc' : '#fde047';
      this.spawnHomingProjectile(target, 'SINGLE', 0, rawDmg, isCrit, projectileEmoji, projectileColor, isMagical);
    }
    this.updateHud();
  }

  triggerSkill(skillNum) {
    if (!this.isActive || this.combatState !== 'FIGHTING' || !this.player || !this.player.isAlive) return;
    const now = performance.now();
    const target = this.getLockedTarget();
    if (!target) return;

    if (skillNum === 1) {
      this.executeHomingSkill(target, 20, 3800, 'TARGET_AOE', 150, 1.85, '🌪️', '#a78bfa', true, now, 'skill1');
    } else if (skillNum === 2) {
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

  spawnHomingProjectile(target, skillType, aoeRadius, dmg, isCrit, emoji, color, isMagical, startX, startY, speed, attackerAcc, team = 'ALLY', critDmgMult = null) {
    this.projectiles.push({
      x: startX !== undefined ? startX : this.player.x,
      y: startY !== undefined ? startY : this.player.y - 20,
      target, skillType, aoeRadius, dmg, isCrit, emoji, color, isMagical,
      speed: speed || 620,
      attackerAcc,
      team,
      critDmgMult,
    });
  }

  updateProjectiles(dt, now) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      if (!p.target || !p.target.isAlive) {
        if (p.team === 'ENEMY') {
          const aliveAllies = [this.player, ...this.pets].filter((u) => u && u.isAlive);
          p.target = aliveAllies[0] || null;
        } else {
          p.target = this.getLockedTarget();
        }
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

    if (p.team === 'ENEMY') {
      this.applyDamageWithHitEvasionRoll(p.target, p, acc, now);
      this.updateHud();
      return;
    }

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

  calculateHitRate(attackerAcc, defenderEva) {
    const acc = Number(attackerAcc) <= 1.5 ? Number(attackerAcc) * 100 : Number(attackerAcc);
    const eva = Number(defenderEva) <= 1.5 ? Number(defenderEva) * 100 : Number(defenderEva);
    const clampedEva = Math.min(75, Math.max(0, eva || 0));
    const clampedAcc = Math.min(125, Math.max(20, acc || 95));
    return Math.max(10, Math.min(95, clampedAcc - clampedEva));
  }

  applyDamageWithHitEvasionRoll(defender, p, attackerAcc, now) {
    if (!defender || !defender.isAlive) return;
    if (defender.isPlayer && defender.isDashing) {
      this.floatingTexts.push({ x: defender.x, y: defender.y - 45, text: '💨 DESVIO!', color: '#38bdf8', life: 0.9 });
      return;
    }

    const eva = p.isMagical ? (defender.magEvasion || 5) : (defender.physEvasion || 5);
    const hitRate = this.calculateHitRate(attackerAcc, eva);
    if (Math.random() * 100 > hitRate) {
      this.floatingTexts.push({ x: defender.x, y: defender.y - 48, text: '💨 DESVIO!', color: '#38bdf8', life: 1.05 });
      return;
    }

    const variance = 0.92 + Math.random() * 0.16;
    const defStat = p.isMagical ? (defender.magDef || defender.def || 25) : (defender.def || 25);
    const baseDmg = !p.alreadyMitigated && p.team === 'ENEMY' ? Math.max(4, Math.round(p.dmg * (100 / (100 + defStat * 0.45)))) : p.dmg;
    let finalDmg = Math.round(baseDmg * variance);
    if (p.isCrit) finalDmg = Math.round(finalDmg * (p.critDmgMult || this.player?.critDmg || 1.55));
    const text = p.isCrit ? `💥 CRÍTICO! -${finalDmg}` : `${p.emoji} -${finalDmg}`;
    const color = p.isCrit ? '#fde047' : p.color;
    this.dealDamageToUnit(defender, finalDmg, text, color, now);
  }

  /**
   * Executa ataque de Pet ou Monstro (suportando disparo à distância Ranged ou golpe Melee/Corpo a Corpo).
   */
  executeAiUnitAttack(attacker, target, isCloseBrawl, now) {
    const aspd = Number(attacker.attackSpeed) || 1.0;
    const baseCd = attacker.team === 'ALLY' ? 1400 : 1550;
    attacker.nextAttackTime = now + Math.round(baseCd / aspd) + Math.random() * 350;
    attacker.attackTimer = 0.34;
    attacker.actionStartTime = now;

    const isMag = attacker.damageType === 'MAGICAL';
    const isRangedShot = attacker.combatStyle === 'RANGED' && !isCloseBrawl;
    attacker.action = isRangedShot ? 7 : 3;

    const acc = isMag ? (attacker.magAccuracy || 95) : (attacker.physAccuracy || 95);
    const isCrit = Math.random() < (attacker.critRate || 0.08);

    if (isRangedShot) {
      const emoji = isMag ? (attacker.team === 'ALLY' ? '✨' : '🔮') : '🏹';
      const color = attacker.team === 'ALLY' ? (isMag ? '#c084fc' : '#38bdf8') : (isMag ? '#f43f5e' : '#fb923c');
      const defStat = isMag ? (target.magDef || target.def || 25) : (target.def || 25);
      const rawDmg = attacker.team === 'ALLY'
        ? Math.max(6, Math.round(attacker.atk * (100 / (100 + defStat * 0.4))))
        : attacker.atk;
      this.spawnHomingProjectile(
        target, 'SINGLE_TARGET', 0, rawDmg, isCrit, emoji, color, isMag,
        attacker.x, attacker.y - 20, 560, acc, attacker.team, attacker.critDmg || 1.5
      );
      return;
    }

    // Ataque Melee ou Ranged lutando corpo-a-corpo (Close Brawl)
    const defStat = isMag ? (target.magDef || target.def || 25) : (target.def || 25);
    const baseDmg = Math.max(4, Math.round(attacker.atk * (100 / (100 + defStat * 0.45))));
    const dmgScale = isCloseBrawl ? 0.85 : 1.0; // Ranged em luta CQC bate ligeiramente reduzido
    this.applyDamageWithHitEvasionRoll(
      target,
      {
        team: attacker.team,
        alreadyMitigated: true,
        dmg: Math.max(3, Math.round(baseDmg * dmgScale)),
        isCrit,
        critDmgMult: attacker.critDmg || 1.5,
        emoji: isMag ? '💥' : (attacker.team === 'ALLY' ? '🐾' : '💔'),
        color: attacker.team === 'ALLY' ? (isMag ? '#c084fc' : '#38bdf8') : (isMag ? '#c084fc' : '#ef4444'),
        isMagical: isMag,
      },
      acc,
      now
    );

    if (attacker.team === 'ALLY') {
      this.updateHud();
      this.checkVictoryCondition();
    } else {
      this.updateHud();
    }
  }

  triggerDash() {
    if (!this.isActive || this.combatState !== 'FIGHTING' || !this.player || !this.player.isAlive || this.player.isDashing) return;
    const now = performance.now();
    if (now < this.skillCooldowns.dash) return;
    this.skillCooldowns.dash = now + 1800; this.player.isDashing = true; this.player.dashTimer = 0.22;
  }

  checkVictoryCondition() {
    if (this.combatState !== 'FIGHTING') return;
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

  updatePlayerMovement(dt) {
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
        this.client.moveTargetX = this.client.currentPath[0]?.x ?? null;
        this.client.moveTargetY = this.client.currentPath[0]?.y ?? null;
        if (this.client.currentPath.length === 0) this.client.currentPath = null;
      } else { vx = dx / dist; vy = dy / dist; }
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
      const targetX = this.player.x + vx * curSpeed * dt;
      const targetY = this.player.y + vy * curSpeed * dt;
      const isBlockedFn = (x, y) => this.isBlocked(x, y);

      const moved = window.ArenaPhysicsSolver
        ? window.ArenaPhysicsSolver.moveWithCollision(this.player, targetX, targetY, this.arenaCenterX, this.arenaCenterY, this.arenaRadiusX, this.arenaRadiusY, isBlockedFn)
        : false;

      if (!moved && this.client && (this.client.moveTargetX !== null || this.client.moveTargetY !== null)) {
        this.client.moveTargetX = null; this.client.moveTargetY = null; this.client.currentPath = null;
      }

      this.player.dir = this.compute8Direction(vx, vy);
      if (!this.player.isAttacking) this.player.action = 1;
    } else if (!this.player.isAttacking && this.player.hitTimer <= 0) {
      this.player.action = 0;
    }
  }

  updatePhysics(dt, now) {
    if (!this.isActive || !this.player || !this.player.isAlive) return;

    // 0. Contagem regressiva durante PREPARATION
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
        this.client.currentPath = null; this.client.moveTargetX = null; this.client.moveTargetY = null;
        this.client.dpadDx = 0; this.client.dpadDy = 0; this.client.isMoving = false;
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

    if (this.combatState !== 'FIGHTING') {
      for (const pet of this.pets) {
        if (!pet.isAlive && pet.fadeAlpha > 0) pet.fadeAlpha = Math.max(0, pet.fadeAlpha - dt * 1.1);
      }
      for (const mob of this.monsters) {
        if (!mob.isAlive && mob.fadeAlpha > 0) mob.fadeAlpha = Math.max(0, mob.fadeAlpha - dt * 1.1);
      }
      for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
        const f = this.floatingTexts[i]; f.y -= dt * 28; f.life -= dt;
        if (f.life <= 0) this.floatingTexts.splice(i, 1);
      }
      return;
    }

    this.updateProjectiles(dt, now);
    this.updatePlayerMovement(dt);

    const allyTeam = [this.player, ...this.pets];
    const mesh = this.client?.mesh;
    const isBlockedFn = (x, y) => this.isBlocked(x, y);
    const compute8DirFn = (dx, dy) => this.compute8Direction(dx, dy);

    // 1. Recalcula Táticas Coletivas por Equipe a cada 0.35s
    if (this.aiController && now >= this.nextTacticsEvalTime) {
      this.allyTeamTactics = this.aiController.evaluateTeamTactics(allyTeam, this.monsters);
      this.enemyTeamTactics = this.aiController.evaluateTeamTactics(this.monsters, allyTeam);
      this.nextTacticsEvalTime = now + 350;
    }

    // 2. Atualiza IA Tática dos Monstros (Time Inimigo)
    const enemyContext = {
      mesh,
      cx: this.arenaCenterX,
      cy: this.arenaCenterY,
      rx: this.arenaRadiusX,
      ry: this.arenaRadiusY,
      isBlockedFn,
      compute8DirFn,
      enemyCentroid: this.enemyTeamTactics.enemyCentroid,
      preferredEnemy: null,
      onPerformAttack: (mob, target, isCloseBrawl) => this.executeAiUnitAttack(mob, target, isCloseBrawl, now),
    };
    for (const mob of this.monsters) {
      if (this.aiController) {
        this.aiController.updateUnit(mob, this.monsters, allyTeam, enemyContext, dt, now);
      }
    }

    // 3. Atualiza IA Tática dos Pets Aliados
    const allyContext = {
      mesh,
      cx: this.arenaCenterX,
      cy: this.arenaCenterY,
      rx: this.arenaRadiusX,
      ry: this.arenaRadiusY,
      isBlockedFn,
      compute8DirFn,
      enemyCentroid: this.allyTeamTactics.enemyCentroid,
      preferredEnemy: this.selectedTargetMob && this.selectedTargetMob.isAlive ? this.selectedTargetMob : null,
      onPerformAttack: (pet, target, isCloseBrawl) => this.executeAiUnitAttack(pet, target, isCloseBrawl, now),
    };
    for (const pet of this.pets) {
      if (this.aiController) {
        this.aiController.updateUnit(pet, allyTeam, this.monsters, allyContext, dt, now);
      }
    }

    // 4. Colisão Física Universal entre Todos os Modelos (evita acúmulo em uma única sombra)
    if (window.ArenaPhysicsSolver) {
      window.ArenaPhysicsSolver.resolveAllUnitCollisions(
        [this.player, ...this.pets, ...this.monsters],
        this.arenaCenterX,
        this.arenaCenterY,
        this.arenaRadiusX,
        this.arenaRadiusY,
        isBlockedFn
      );
    }

    if (this.client) {
      this.client.playerX = this.player.x;
      this.client.playerY = this.player.y;
      this.client.playerDir = this.player.dir;
    }

    // 5. Floating Texts
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
