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
    this.isDungeonMode = false;
    this.dungeonExitDestination = null;
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
    this.groundZones = [];
    this.classSkills = [];
    this.skillCatalog = [];
    this.statusCatalog = [];
    this.selectedTargetMob = null;
    this.vfxRenderer = window.ActionVfxRenderer ? new window.ActionVfxRenderer() : null;

    // Submódulo de IA Tática e Controle de Recálculo Periódico
    this.aiController = window.ArenaUnitAiController ? new window.ArenaUnitAiController() : null;
    this.nextTacticsEvalTime = 0;
    this.allyTeamTactics = { enemyCentroid: { x: 0, y: 0, count: 0 } };
    this.enemyTeamTactics = { enemyCentroid: { x: 0, y: 0, count: 0 } };

    // Motor de Movimento, Windup/CastPoint, Input Buffering, Desacoplamento e Deslize Vetorial
    this.motionEngine = window.ActionMotionEngine ? new window.ActionMotionEngine(this) : null;

    // Inputs e Controles
    this.keysDown = new Set();
    this.joystickActive = false;
    this.joystickTouchId = null;
    this.joystickOrigin = { x: 0, y: 0 };
    this.joystickVector = { x: 0, y: 0 };

    // Cooldowns das Habilidades do Jogador (ms)
    this.skillCooldowns = { attack: 0, skill1: 0, skill2: 0, skill3: 0, skill4: 0 };

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
      else if (e.key === '3') this.triggerSkill(3);
      else if (e.key === '4') this.triggerSkill(4);
      else if (e.key.toLowerCase() === 'q') this.triggerCombatShortcut(0);
      else if (e.key.toLowerCase() === 'e') this.triggerCombatShortcut(1);
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
    const b = this.client?.getMapBounds ? this.client.getMapBounds() : { width: 2000, height: 1500 };
    if (x < 28 || y < 28 || x > b.width - 28 || y > b.height - 28) return true;
    const mesh = this.client?.mesh;
    if (!mesh) return false;
    return typeof mesh.isPointBlocked === 'function' ? mesh.isPointBlocked(x, y) : (typeof mesh.isPointInCollision === 'function' ? mesh.isPointInCollision(x, y) : false);
  }

  findFairSpawnPositions(cx, cy) {
    if (window.ArenaPhysicsSolver) {
      return window.ArenaPhysicsSolver.findFairSpawnPositions(cx, cy, this.arenaRadiusX, this.arenaRadiusY, (x, y) => this.isBlocked(x, y));
    }
    return { px: cx - 180, py: cy, mx: cx + 180, my: cy };
  }

  openArena(battleState) {
    this.isDungeonMode = Boolean(battleState.isDungeon);
    this.dungeonExitDestination = null;
    this.dungeonChest = null; this.lastKilledMonsterPos = null;
    window.PlayDungeonChestController?.clearPromptButton?.();
    const wasAlreadyInArena = this.isActive && Boolean(this.preCombatWorldPos);
    if (this.client && !wasAlreadyInArena) {
      this.preCombatWorldPos = {
        mapId: this.client.currentMap ? this.client.currentMap.id : 1,
        x: this.client.playerX, y: this.client.playerY, dir: this.client.playerDir || 0,
      };
    }
    if (!this.isDungeonMode && window.BattleTransitionController) window.BattleTransitionController.start(battleState, this);
    else this.isTransitioning = false;
    this.currentBattle = battleState;
    this.combatDamageDealt = 0; this.combatHitsCount = 0;
    this.isActive = true;
    const vig = document.getElementById('veilVignetteOverlay'); if (vig) vig.classList.add('active');
    this.combatState = this.isDungeonMode ? 'FIGHTING' : 'PREPARATION';
    this.prepTimeRemaining = this.isDungeonMode ? 0 : 20.0;
    this.isLocalPlayerReady = this.isDungeonMode;
    this.readyPlayerIds = new Set();
    this.totalRealPlayers = Number(battleState.totalRealPlayers) || 1;
    this.elementMatchups = battleState.elementMatchups || this.client?.elementMatchups || [];

    if (this.isDungeonMode) {
      this.arenaCenterX = Math.round((battleState.mapWidth || 2000) / 2);
      this.arenaCenterY = Math.round((battleState.mapHeight || 1500) / 2);
      this.arenaRadiusX = 999999;
      this.arenaRadiusY = 999999;
    } else {
      const baseOriginX = this.preCombatWorldPos ? this.preCombatWorldPos.x : (this.client?.playerX || 400);
      const baseOriginY = this.preCombatWorldPos ? this.preCombatWorldPos.y : (this.client?.playerY || 300);
      this.arenaCenterX = Math.round(baseOriginX);
      this.arenaCenterY = Math.round(baseOriginY);
      this.arenaRadiusX = 650;
      this.arenaRadiusY = 470;
    }

    const spawns = this.isDungeonMode
      ? { px: battleState.playerStartX ?? this.client?.playerX ?? 500, py: battleState.playerStartY ?? this.client?.playerY ?? 500, mx: this.arenaCenterX, my: this.arenaCenterY }
      : this.findFairSpawnPositions(this.arenaCenterX, this.arenaCenterY);
    const pState = battleState.player || {};
    const pDir = this.isDungeonMode ? (this.client?.playerDir || 0) : this.compute8Direction(spawns.mx - spawns.px, spawns.my - spawns.py);
    const baseCombat = this.client?.activeChar?.baseCombatAttributesJson || {};
    const globalCombatAttr = (this.client?.combatAttributes || []).find((ca) => ca.code === 'BATTLE_MOVE_SPEED');
    const globalDefaultSpeed = globalCombatAttr ? Number(globalCombatAttr.baseDefault) : 180;
    const classMoveSpeed = Number(baseCombat.BATTLE_MOVE_SPEED);
    const agiConv = (this.client?.attributeConversions || []).find((c) => c.baseAttributeCode === 'AGI' && c.combatAttributeCode === 'BATTLE_MOVE_SPEED');
    const agiRatio = agiConv ? Number(agiConv.ratioPerPoint) : 0.5;
    const totalAgi = (Number(this.client?.activeChar?.distributedStatsJson?.AGI) || 0) + (Number(this.client?.activeChar?.baseAttributesJson?.AGI) || 10);
    const battleSpeed = window.GameRulesConstants
      ? window.GameRulesConstants.clampBattleMoveSpeed(Number(pState.battleMoveSpeed || (classMoveSpeed ? classMoveSpeed + totalAgi * agiRatio : null) || (globalDefaultSpeed ? globalDefaultSpeed + totalAgi * agiRatio : null) || 180))
      : Math.min(185, Math.max(60, Number(pState.battleMoveSpeed || (classMoveSpeed ? classMoveSpeed + totalAgi * agiRatio : null) || (globalDefaultSpeed ? globalDefaultSpeed + totalAgi * agiRatio : null) || 180)));

    this.projectiles = []; this.groundZones = [];
    this.vfxRenderer?.reset(); this.motionEngine?.reset();
    this.classSkills = Array.isArray(battleState.classSkills) ? battleState.classSkills : [];
    this.skillCatalog = Array.isArray(battleState.skillCatalog) ? battleState.skillCatalog : [];
    this.statusCatalog = Array.isArray(battleState.statusCatalog) ? battleState.statusCatalog : [];
    this.skillCooldowns = { attack: 0, skill1: 0, skill2: 0, skill3: 0, skill4: 0 };
    this.selectedTargetMob = null;

    this.player = {
      id: pState.id || 'player_1', isPlayer: true, team: 'ALLY', bodyRadiusX: 24, bodyRadiusY: 17,
      x: spawns.px, y: spawns.py, speed: battleSpeed, dir: pDir, action: 0, isAlive: true,
      hp: pState.hp || 500, maxHp: pState.maxHp || 500, mp: pState.mp || 200, maxMp: pState.maxMp || 200,
      atk: pState.atk || 75, physAtk: pState.physAtk || pState.atk || 75, magAtk: pState.magAtk || pState.atk || 75, healPower: pState.healPower || pState.atk || 50,
      def: pState.def || 40, magDef: pState.magDef || pState.def || 40, activeStatuses: [], shieldHp: 0, shieldMaxHp: 0,
      name: pState.name || this.client?.activeChar?.name || 'Herói',
      level: Number(pState.level || this.client?.activeChar?.level) || 1,
      elementCode: pState.elementCode || this.client?.activeChar?.elementCode || 'NEUTRAL',
      raceCode: pState.raceCode || this.client?.activeChar?.raceCode || 'HUMAN',
      physAccuracy: Math.min(125, Math.max(20, Number(baseCombat.PHYS_ACCURACY) || 95)),
      physEvasion: Math.min(75, Math.max(0, Number(baseCombat.PHYS_EVASION) || 5)),
      magAccuracy: Math.min(125, Math.max(20, Number(baseCombat.MAG_ACCURACY) || 95)),
      magEvasion: Math.min(75, Math.max(0, Number(baseCombat.MAG_EVASION) || 5)),
      critRate: Math.min(0.80, (Number(baseCombat.CRIT_RATE) || 5) / 100),
      critDmg: Math.min(3.00, (Number(baseCombat.CRIT_DMG) || 150) / 100),
      attackSpeed: Number(baseCombat.ATTACK_SPEED) || 1.0,
      sprite: this.getSprite(pState.atlasJsonUrl, pState.atlasWebpUrl, pState.thumbUrl) ||
              (this.client?.activeChar ? this.client.getOrCreateSprite(`char_${this.client.activeChar.mcreworkCharKey}`, this.client.activeChar.atlasJsonUrl, this.client.activeChar.atlasWebpUrl, this.client.activeChar.thumbUrl) : null),
      groundOffsetY: pState.groundOffsetY || this.client?.activeChar?.groundOffsetY || 0,
      shadowOffsetX: pState.shadowOffsetX || this.client?.activeChar?.shadowOffsetX || 0,
      shadowOffsetY: pState.shadowOffsetY || this.client?.activeChar?.shadowOffsetY || 0,
      combatStyle: pState.combatStyle || this.client?.activeChar?.combatStyle || 'MELEE',
      attackRange: pState.attackRange || this.client?.activeChar?.attackRange || (pState.combatStyle === 'RANGED' ? 220 : 60),
      damageType: pState.damageType || this.client?.activeChar?.damageType || 'PHYSICAL',
      equippedWings: pState.equippedWings || this.client?.activeChar?.visualAppearance?.equippedWings || null,
      isAttacking: false, attackTimer: 0, isDashing: false, dashTimer: 0, hitTimer: 0,
    };
    if (this.client) {
      this.battleOutcome = null;
      this.client.isFlying = false; this.client.isLandingFlight = false; this.client.flightAltitudeCurrent = 0; this.client.flightTargetAltitude = 0;
      window.PlayFlightAndWingsController?.updateFlightHudButton(this.client);
      if (window.PlayMapPresenceController) window.PlayMapPresenceController.setLocalCombatStatus(true);
      this.client.playerX = spawns.px; this.client.playerY = spawns.py; this.client.playerDir = pDir;
      this.client.currentPath = null; this.client.moveTargetX = null; this.client.moveTargetY = null;
      this.client.targetDestX = null; this.client.targetDestY = null;
    }

    const isBlockedFn = (x, y) => this.isBlocked(x, y);
    const pList = Array.isArray(battleState.pets) ? battleState.pets : [];
    const mStates = Array.isArray(battleState.monsters) ? battleState.monsters : [];
    const mDir = this.compute8Direction(spawns.px - spawns.mx, spawns.py - spawns.my);
    const getSp = (j, w, t) => this.getSprite(j, w, t);
    const rawPetModels = pList.map((p, idx) => window.ArenaPhysicsSolver.createAiUnitModel(p, idx, false, spawns.px, spawns.py, pDir, battleSpeed, getSp));
    const rawMobModels = mStates.map((m, idx) => window.ArenaPhysicsSolver.createAiUnitModel(m, idx, true, this.isDungeonMode && m.spawnX !== undefined ? m.spawnX : spawns.mx, this.isDungeonMode && m.spawnY !== undefined ? m.spawnY : spawns.my, mDir, battleSpeed, getSp, battleState.monsterTemplateId));

    if (window.ArenaPhysicsSolver) {
      const petCoords = window.ArenaPhysicsSolver.buildTeamFormationPositions(spawns.px, spawns.py, spawns.mx, spawns.my, rawPetModels, this.arenaCenterX, this.arenaCenterY, this.arenaRadiusX, this.arenaRadiusY, isBlockedFn, [{ x: spawns.px, y: spawns.py }]);
      rawPetModels.forEach((p, idx) => { if (petCoords[idx]) { p.x = petCoords[idx].x; p.y = petCoords[idx].y; } });
      if (!this.isDungeonMode) {
        const mobCoords = window.ArenaPhysicsSolver.buildTeamFormationPositions(spawns.mx, spawns.my, spawns.px, spawns.py, rawMobModels, this.arenaCenterX, this.arenaCenterY, this.arenaRadiusX, this.arenaRadiusY, isBlockedFn, [{ x: spawns.px, y: spawns.py }, ...rawPetModels]);
        rawMobModels.forEach((m, idx) => { if (mobCoords[idx]) { m.x = mobCoords[idx].x; m.y = mobCoords[idx].y; } });
      }
      window.ArenaPhysicsSolver.resolveAllUnitCollisions([this.player, ...rawPetModels, ...rawMobModels], this.arenaCenterX, this.arenaCenterY, this.arenaRadiusX, this.arenaRadiusY, isBlockedFn);
    }

    this.pets = rawPetModels;
    this.monsters = rawMobModels;
    if (this.aiController) {
      this.allyTeamTactics = this.aiController.evaluateTeamTactics([this.player, ...this.pets], this.monsters);
      this.enemyTeamTactics = this.aiController.evaluateTeamTactics(this.monsters, [this.player, ...this.pets]);
      this.nextTacticsEvalTime = performance.now() + 350;
    }

    this.floatingTexts = [];
    const modal = document.getElementById('actionCombatModal');
    if (modal) { modal.style.display = 'flex'; if (this.isTransitioning) modal.classList.add('transitioning'); }
    const resultBanner = document.getElementById('actionResultBanner'); if (resultBanner) resultBanner.style.display = 'none';
    const prepBanner = document.getElementById('actionPrepBanner'); if (prepBanner) prepBanner.style.display = this.isDungeonMode ? 'none' : 'flex';
    const timerEl = document.getElementById('actPrepTimer'); if (timerEl) timerEl.textContent = '20s';
    const btnReady = document.getElementById('btnActReady'); if (btnReady) { btnReady.classList.remove('ready'); btnReady.textContent = '⚡ PRONTO!'; }
    const statusEl = document.getElementById('actPrepStatusText');
    if (statusEl) statusEl.textContent = this.totalRealPlayers > 1 ? `Aguardando: 0/${this.totalRealPlayers} jogadores prontos` : 'Trace sua estratégia ou clique em Pronto';
    this.floatingTexts.push({ x: spawns.px, y: spawns.py - 60, text: this.isDungeonMode ? '🏰 DUNGEON NO VÉU' : 'PREPARE-SE PARA A BATALHA', color: this.isDungeonMode ? '#c084fc' : '#38bdf8', life: 2.2 });

    this.renderSkillButtonsHud();
    this.updateCombatShortcutsHud();
    if (window.PlayHudController?.setCombatMode) window.PlayHudController.setCombatMode(true);
    else document.body.classList.add('is-in-combat');
    this.updateHud();
  }

  updateCombatShortcutsHud() { window.ArenaHudControls?.updateCombatShortcutsHud(this); }

  triggerCombatShortcut(slotIdx) { window.ArenaHudControls?.triggerCombatShortcut(this, slotIdx); }

  renderSkillButtonsHud() { window.ArenaHudControls?.renderSkillButtonsHud(this); }

  toggleReady() { window.ArenaHudControls?.toggleReady(this); }

  startFightNow() { window.ArenaHudControls?.startFightNow(this); }

  closeArena() {
    this.isTransitioning = false; this.isActive = false; this.combatState = 'INACTIVE';
    this.dungeonChest = null; this.lastKilledMonsterPos = null;
    window.PlayDungeonChestController?.clearPromptButton?.();
    this.pets = []; this.monsters = []; this.projectiles = []; this.selectedTargetMob = null;
    if (window.PlayHudController?.setCombatMode) window.PlayHudController.setCombatMode(false);
    else document.body.classList.remove('is-in-combat');
    const vig = document.getElementById('veilVignetteOverlay'); if (vig) vig.classList.remove('active');
    ['actionCombatModal', 'actionPrepBanner', 'actionResultBanner'].forEach((id) => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    const outcome = document.getElementById('combatOutcomeModal'); if (outcome) outcome.classList.remove('active');
    if (this.client) {
      this.client.encounterCooldownUntil = performance.now() + 5000;
      this.client.moveTargetX = null; this.client.moveTargetY = null;
      this.client.targetDestX = null; this.client.targetDestY = null;
      this.client.currentPath = null; this.client.dpadDx = 0; this.client.dpadDy = 0;
      this.client.isMoving = false; this.client.keysDown?.clear(); this.keysDown?.clear();
      if (this.battleOutcome === 'DEFEAT' && !window.CombatOutcomeController) {
        const charId = this.client?.activeChar?.id;
        if (charId) this.client.api(`/api/play/characters/${charId}/respawn`, { method: 'POST' }).then((res) => { if (res?.mapId) this.client.loadMapIntoWorld(res.mapId, res.spawnX, res.spawnY); }).catch(() => {});
      } else if (this.preCombatWorldPos && !this.dungeonExitDestination) {
        this.client.playerX = this.preCombatWorldPos.x; this.client.playerY = this.preCombatWorldPos.y; this.client.playerDir = this.preCombatWorldPos.dir;
        if (this.client.activeChar) { this.client.activeChar.posX = this.preCombatWorldPos.x; this.client.activeChar.posY = this.preCombatWorldPos.y; }
        if (window.PlayPetsController) { window.PlayPetsController.followerX = this.preCombatWorldPos.x - 74; window.PlayPetsController.followerY = this.preCombatWorldPos.y + 16; window.PlayPetsController.followerIsMoving = false; }
        const coordsEl = document.getElementById('hudCoords'); if (coordsEl) coordsEl.textContent = `X:${Math.round(this.client.playerX)} Y:${Math.round(this.client.playerY)}`;
      }
      this.preCombatWorldPos = null;
      window.PlayFlightAndWingsController?.updateFlightHudButton(this.client);
      if (window.PlayMapPresenceController) window.PlayMapPresenceController.setLocalCombatStatus(false);
    }
    this.isDungeonMode = false;
  }

  fleeBattle() {
    if (!this.isActive || this.combatState === 'RESULT') return;
    if (this.isDungeonMode) { void this.handleDungeonFlee(); return; }
    this.showResult(false, 'Você recuou da batalha com segurança e retornou ao mapa.', true);
  }

  async handleDungeonFlee() {
    if (!confirm('⚠️ Atenção: Se você fugir da Dungeon agora, gastará sua entrada diária de hoje.\n\nDeseja realmente fugir e sair da Dungeon?')) return;
    try {
      const res = await this.client.api('/api/play/dungeon/flee', {
        method: 'POST',
        body: JSON.stringify({
          characterId: this.client?.activeChar?.id,
          mapId: this.currentBattle?.dungeonMapId || this.client?.currentMap?.id,
          battleId: this.currentBattle?.battleId,
        }),
      });
      if (res?.exitDestination) this.dungeonExitDestination = res.exitDestination;
    } catch (err) { console.warn('[DungeonFlee] Erro ao registrar fuga:', err); }
    this.showResult(false, 'Você fugiu da Dungeon! Seu ingresso diário de hoje foi consumido.', true);
  }

  updateHud() { window.ArenaHudControls?.updateHud(this); }

  updateCooldownOverlay(elemId, expireTime, now) { window.ArenaHudControls?.updateCooldownOverlay(elemId, expireTime, now); }

  dealDamageToUnit(unit, dmg, text, color, now) {
    if (!unit || !unit.isAlive) return;
    if (unit.team === 'ENEMY') { this.combatDamageDealt = (this.combatDamageDealt || 0) + Math.max(0, Number(dmg) || 0); this.combatHitsCount = (this.combatHitsCount || 0) + 1; }
    if (unit.team === 'ENEMY' && this.isDungeonMode && !unit.isAggroed) {
      unit.isAggroed = true;
      this.floatingTexts.push({ x: unit.x, y: unit.y - 68, text: '!', color: '#ef4444', life: 0.9 });
    }
    unit.hp = Math.max(0, unit.hp - dmg);
    unit.hitTimer = 0.24; unit.actionStartTime = now; unit.action = 5;
    this.floatingTexts.push({ x: unit.x, y: unit.y - 48, text, color, life: 1.05 });
    if (unit.hp === 0) {
      unit.isAlive = false; unit.actionStartTime = now; unit.action = 6;
      if (!unit.isPlayer && unit.team === 'ENEMY') this.lastKilledMonsterPos = { x: unit.x, y: unit.y };
      if (unit.isPlayer) this.showResult(false, 'Você foi derrotado na arena.');
    }
  }

  dealDamageToMob(mob, dmg, text, color, now) {
    this.dealDamageToUnit(mob, dmg, text, color, now);
  }

  cleanseUnitDebuffs(unit, maxDebuffs = 0, healPerDebuffPct = 0, cleanseChancePct = 100) {
    return window.ActionSkillEngine
      ? window.ActionSkillEngine.cleanseUnitWithFilter(this, unit, 'ALL', maxDebuffs, healPerDebuffPct, cleanseChancePct)
      : 0;
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
    if (!this.isActive || this.combatState !== 'FIGHTING' || !this.player || !this.player.isAlive) return;
    const now = performance.now();
    const target = this.getLockedTarget();
    if (this.motionEngine) {
      this.motionEngine.requestAttack(this.player, target, now);
      return;
    }
  }

  triggerSkill(skillNum) {
    if (!this.isActive || this.combatState !== 'FIGHTING' || !this.player || !this.player.isAlive) return;
    const now = performance.now();
    const cdKey = `skill${skillNum}`;
    const cdExpire = this.skillCooldowns[cdKey] || 0;

    // FASE 3: Enfileira no Input Buffer se cooldown restante <= 160ms
    if (now < cdExpire) {
      if (this.motionEngine && (cdExpire - now) <= this.motionEngine.BUFFER_WINDOW_MS) {
        this.motionEngine.enqueueBufferedAction('SKILL', { skillNum }, now);
      }
      return;
    }

    const realSkill = (this.classSkills || [])[skillNum - 1];
    const target = this.getLockedTarget();

    // FASE 5: Cancelamento de Backswing e Auto-Attack Reset
    if (this.motionEngine) {
      this.motionEngine.cancelBackswing('SKILL_CAST');
      if (realSkill && (realSkill.resetsAutoAttack || realSkill.castMovement === 'DASH_LINEAR')) {
        this.motionEngine.resetAutoAttackTimer();
      }
    }

    if (realSkill && window.ActionSkillEngine) {
      const needsEnemy = !['SELF', 'ALLY_SINGLE', 'ALLY_LOWEST_HP_PCT', 'ALLY_ALL', 'AOE_SELF_AROUND'].includes(realSkill.targetScope);
      if (needsEnemy && !target) return;
      if (target && needsEnemy && ['TARGET_PRIMARY', 'MELEE_FRONTLINE', 'RANGED_ANY', 'AOE_CIRCLE'].includes(realSkill.targetScope)) {
        const dist = Math.hypot(target.x - this.player.x, target.y - this.player.y);
        const maxRange = (Number(realSkill.castRange) || 160) + (realSkill.castMovement === 'MELEE_ADVANCE' || realSkill.castMovement === 'DASH_LINEAR' || realSkill.castMovement === 'LEAP_AOE' || realSkill.castMovement === 'TELEPORT_BACKSTAB' ? 95 : 24);
        if (dist > maxRange) {
          if (this.motionEngine) {
            this.motionEngine.startApproach(this.player, target, maxRange, 'SKILL', { skillNum });
            return;
          }
          this.floatingTexts.push({ x: this.player.x, y: this.player.y - 45, text: 'FORA DE ALCANCE', color: '#fde047', life: 0.7 });
          return;
        }
      }
      window.ActionSkillEngine.executeSkill(this, this.player, realSkill, target, now, cdKey);
      return;
    }

    if (!target) return;
    if (skillNum === 1) this.executeHomingSkill(target, 20, 3800, 'TARGET_AOE', 150, 1.85, '🌪️', '#a78bfa', true, now, 'skill1');
    else if (skillNum === 2) this.executeHomingSkill(target, 35, 5800, 'GLOBAL_AOE', 0, 2.25, '⚡', '#38bdf8', true, now, 'skill2');
  }

  executeHomingSkill(target, mpCost, cdMs, skillType, aoeRadius, dmgMultiplier, emoji, color, isMagical, now, cdKey) {
    window.ArenaProjectileResolver?.executeHomingSkill(this, target, mpCost, cdMs, skillType, aoeRadius, dmgMultiplier, emoji, color, isMagical, now, cdKey);
  }

  spawnHomingProjectile(target, skillType, aoeRadius, dmg, isCrit, emoji, color, isMagical, startX, startY, speed, attackerAcc, team = 'ALLY', critDmgMult = null, extra = null) {
    window.ArenaProjectileResolver?.spawnHomingProjectile(this, target, skillType, aoeRadius, dmg, isCrit, emoji, color, isMagical, startX, startY, speed, attackerAcc, team, critDmgMult, extra);
  }

  updateProjectiles(dt, now) {
    window.ArenaProjectileResolver?.updateProjectiles(this, dt, now);
  }

  resolveHomingImpact(p, now) {
    window.ArenaProjectileResolver?.resolveHomingImpact(this, p, now);
  }

  calculateHitRate(attackerAcc, defenderEva) {
    return window.CombatDamageCalculator
      ? window.CombatDamageCalculator.calculateEffectiveHitRate(attackerAcc, defenderEva)
      : Math.max(10, Math.min(95, (Number(attackerAcc) || 95) - Math.min(75, Math.max(0, Number(defenderEva) || 5))));
  }

  applyDamageWithHitEvasionRoll(defender, p, attackerAcc, now) {
    if (window.ActionSkillEngine) {
      window.ActionSkillEngine.applyProjectileHit(this, defender, p, attackerAcc, now);
    }
  }

  /**
   * Executa ataque de Pet ou Monstro (suportando disparo à distância Ranged ou golpe Melee/Corpo a Corpo).
   */
  executeAiUnitAttack(attacker, target, isCloseBrawl, now) {
    window.ArenaProjectileResolver?.executeAiUnitAttack(this, attacker, target, isCloseBrawl, now);
  }

  async checkVictoryCondition() {
    if (this.combatState !== 'FIGHTING') return;
    const aliveMobs = this.monsters.filter((m) => m.isAlive);
    if (aliveMobs.length === 0) {
      if (this.isDungeonMode && window.PlayDungeonChestController) {
        const pos = this.lastKilledMonsterPos || this.player || { x: 500, y: 500 };
        await window.PlayDungeonChestController.spawnChestAtLastMonster(this, pos.x, pos.y);
        return;
      }
      this.combatState = 'RESULT';
      const expGained = this.monsters.reduce((acc, m) => acc + (Number(m.expReward) || (Number(m.level) || 1) * 28), 0);
      const goldGained = this.monsters.reduce((acc, m) => acc + (Number(m.goldReward) || Math.ceil((Number(m.level) || 1) * 10 * ({ SS: 2.5, S: 1.8, A: 1.6, B: 1.35, C: 1.2, F: 0.8 }[m.rarityTier] || 1.0) * (m.variantTier === 'BOSS' ? 1.5 : m.variantTier === 'LEADER' ? 1.3 : 1.0))), 0);
      const res = await this.recordBattleVictoryOnServer();
      const vData = { expGained, goldGained, ...(res || {}) };
      if (window.CombatOutcomeController) {
        window.CombatOutcomeController.showVictory(vData, this, this.client);
      } else {
        this.showResult(true, `Você venceu!<br><br><strong>+${expGained} EXP</strong> &bull; <strong>+${goldGained} Ouro</strong>`);
      }
    }
  }

  async recordBattleVictoryOnServer() {
    try {
      if (!this.currentBattle || !this.client) return null;
      const res = await this.client.api('/api/play/combat/victory', { method: 'POST', body: JSON.stringify({ battleId: this.currentBattle.battleId, battleNonce: this.currentBattle.battleNonce, totalDamageDealt: Math.round(this.combatDamageDealt || 0), hitsCount: this.combatHitsCount || 0 }) });
      if (res?.exitDestination) { this.dungeonExitDestination = res.exitDestination; }
      if (res?.questState) { this.client.questState = res.questState; this.client.updateQuestHudBadge?.(); }
      if (res?.characterGold !== undefined && this.client.activeChar) { this.client.activeChar.gold = res.characterGold; }
      if (res?.playerProgression && this.client.activeChar) {
        const pProg = res.playerProgression;
        this.client.activeChar.level = pProg.newLevel;
        this.client.activeChar.experience = pProg.newExp;
        this.client.activeChar.unspentStatPoints = pProg.unspentStatPoints;
        if (pProg.maxXp) this.client.activeChar.maxXp = pProg.maxXp;
      }
      if (Array.isArray(res?.petsProgression) && res.petsProgression.length > 0) {
        for (const petProg of res.petsProgression) {
          const matchedPet = (this.client.activeChar?.equippedPets || []).find((p) => p.id === petProg.petId);
          if (matchedPet) { matchedPet.level = petProg.newLevel; matchedPet.experience = petProg.newExp; }
        }
        if (window.PlayHudController && this.client.activeChar?.equippedPets) window.PlayHudController.updatePets(this.client.activeChar.equippedPets);
      }
      this.client.updateHudInfo?.();
      return res;
    } catch (err) { console.warn('Falha ao sincronizar vitória no backend:', err); return null; }
  }

  showResult(isVictory, messageHtml, isFled = false) {
    this.combatState = 'RESULT';
    this.battleOutcome = isFled ? 'FLED' : (isVictory ? 'VICTORY' : 'DEFEAT');
    if (window.CombatOutcomeController) {
      if (isFled) window.CombatOutcomeController.showFled(this, this.client);
      else if (isVictory) window.CombatOutcomeController.showVictory({ expGained: 0, goldGained: 0 }, this, this.client);
      else window.CombatOutcomeController.showDefeat(this, this.client);
      return;
    }
    const modal = document.getElementById('actionCombatModal'); if (modal) modal.style.display = 'flex';
    const prepBanner = document.getElementById('actionPrepBanner'); if (prepBanner) prepBanner.style.display = 'none';
    const banner = document.getElementById('actionResultBanner');
    const title = document.getElementById('actionResultTitle');
    const rewards = document.getElementById('actionResultRewards');
    if (!banner || !title || !rewards) return;
    title.textContent = isFled ? 'Fuga da Batalha' : (isVictory ? 'VITÓRIA!' : 'VOCÊ FOI DERROTADO!');
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

    if (window.ActionSkillEngine && window.ActionSkillEngine.isActionBlocked(this.player)) {
      this.player.action = 0;
      return;
    }
    const pEffMove = window.ActionSkillEngine ? window.ActionSkillEngine.getEffectiveStats(this.player).moveSpeedMult : 1.0;
    const maxBattleSpeed = window.GameRulesConstants?.MAX_BATTLE_MOVE_SPEED ?? 185;
    let curSpeed = Math.min(maxBattleSpeed, this.player.speed * pEffMove);

    // FASES 1, 2, 3 e 4: Cinemática Suave, Aceleração/Desaceleração, Deslize Vetorial e Windup/CastPoint
    if (this.motionEngine) {
      this.motionEngine.updatePlayerKinematics(this.player, vx, vy, curSpeed, dt, performance.now());
      return;
    }
    if (vx !== 0 || vy !== 0) {
      this.player.x += vx * curSpeed * dt;
      this.player.y += vy * curSpeed * dt;
      this.player.dir = this.compute8Direction(vx, vy);
      this.player.action = 1;
    } else {
      this.player.action = 0;
    }
  }

  updatePhysics(dt, now) {
    if (!this.isActive || !this.player || !this.player.isAlive) return;

    // 0. Contagem regressiva durante PREPARATION
    if (this.combatState === 'PREPARATION') {
      if (this.isTransitioning) return;
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
      if (this.combatState === 'CHEST_WAIT') this.updatePlayerMovement(dt);
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

    if (window.ActionSkillEngine) {
      window.ActionSkillEngine.tickStatusesAndZones(this, now);
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

    // 2. Atualiza IA Tática dos Monstros e Pets (passando modo Dungeon & Aggro Curto)
    const aggroCb = (u) => this.floatingTexts.push({ x: u.x, y: u.y - 68, text: '!', color: '#ef4444', life: 0.9 });
    const enemyContext = {
      mesh, cx: this.arenaCenterX, cy: this.arenaCenterY, rx: this.arenaRadiusX, ry: this.arenaRadiusY,
      isBlockedFn, compute8DirFn, enemyCentroid: this.enemyTeamTactics.enemyCentroid, preferredEnemy: null,
      isDungeonMode: this.isDungeonMode, player: this.player, onAggro: aggroCb,
      onPerformAttack: (mob, target, isCloseBrawl) => this.executeAiUnitAttack(mob, target, isCloseBrawl, now),
    };
    for (const mob of this.monsters) {
      if (this.aiController) this.aiController.updateUnit(mob, this.monsters, allyTeam, enemyContext, dt, now);
    }

    const allyContext = {
      mesh, cx: this.arenaCenterX, cy: this.arenaCenterY, rx: this.arenaRadiusX, ry: this.arenaRadiusY,
      isBlockedFn, compute8DirFn, enemyCentroid: this.allyTeamTactics.enemyCentroid,
      preferredEnemy: this.selectedTargetMob && this.selectedTargetMob.isAlive ? this.selectedTargetMob : null,
      isDungeonMode: this.isDungeonMode, player: this.player,
      onPerformAttack: (pet, target, isCloseBrawl) => this.executeAiUnitAttack(pet, target, isCloseBrawl, now),
    };
    for (const pet of this.pets) {
      if (this.aiController) this.aiController.updateUnit(pet, allyTeam, this.monsters, allyContext, dt, now);
    }

    // 4. Colisão Física Universal entre Todos os Modelos
    if (window.ArenaPhysicsSolver) {
      window.ArenaPhysicsSolver.resolveAllUnitCollisions([this.player, ...this.pets, ...this.monsters], this.arenaCenterX, this.arenaCenterY, this.arenaRadiusX, this.arenaRadiusY, isBlockedFn);
    }

    if (this.client) {
      this.client.playerX = this.player.x; this.client.playerY = this.player.y; this.client.playerDir = this.player.dir;
    }

    // 5. Floating Texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const f = this.floatingTexts[i]; f.y -= dt * 28; f.life -= dt;
      if (f.life <= 0) this.floatingTexts.splice(i, 1);
    }
  }

  getCamFocusX() {
    if (!this.player) return this.client?.playerX || 0;
    if (this.isDungeonMode) return this.player.x;
    const m = this.monsters.find((mob) => mob.isAlive);
    return m ? Math.round(this.player.x * 0.65 + m.x * 0.35) : this.player.x;
  }
  getCamFocusY() {
    if (!this.player) return this.client?.playerY || 0;
    if (this.isDungeonMode) return this.player.y;
    const m = this.monsters.find((mob) => mob.isAlive);
    return m ? Math.round(this.player.y * 0.65 + m.y * 0.35) : this.player.y;
  }
  drawArenaRingOnFloor(ctx, now, zoom) { if (this.isActive) this.vfxRenderer?.drawArenaFloorAndProjectiles(ctx, this, now, zoom); }
  renderActiveVfx(ctx, now) {
    if (!this.isActive) return;
    this.vfxRenderer?.drawActiveBursts(ctx, now, this);
  }
  populateRenderQueue(renderQueue, now) {
    if (!this.isActive) return;
    const push = renderQueue.pushItem ? (t, y, d) => renderQueue.pushItem(t, y, d) : (t, y, d) => renderQueue.push({ type: t, y, data: d });
    if (this.player && this.player.isAlive) push('COMBAT_PLAYER', this.player.y, this.player);
    for (const pet of this.pets) { if (pet.fadeAlpha > 0) push('COMBAT_PET', pet.y, pet); }
    for (const mob of this.monsters) { if (mob.fadeAlpha > 0) push('COMBAT_MONSTER', mob.y, mob); }
    if (this.dungeonChest && !this.dungeonChest.opened) push('DUNGEON_CHEST', Number(this.dungeonChest.y) || 0, this.dungeonChest);
  }
  renderFloatingTexts(ctx) { this.vfxRenderer?.drawFloatingTexts(ctx, this.floatingTexts); }
}

window.ActionCombatArena = ActionCombatArena;
