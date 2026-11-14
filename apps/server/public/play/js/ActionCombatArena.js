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

    this.elementMatchups = battleState.elementMatchups || this.client?.elementMatchups || [];
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
    const agiConv = (this.client?.attributeConversions || []).find((c) => c.baseAttributeCode === 'AGI' && c.combatAttributeCode === 'BATTLE_MOVE_SPEED');
    const agiRatio = agiConv ? Number(agiConv.ratioPerPoint) : 0.5;
    const totalAgi = (Number(this.client?.activeChar?.distributedStatsJson?.AGI) || 0) + (Number(this.client?.activeChar?.baseAttributesJson?.AGI) || 10);
    const battleSpeed = Math.max(60, Number(pState.battleMoveSpeed || (classMoveSpeed ? classMoveSpeed + totalAgi * agiRatio : null) || (globalDefaultSpeed ? globalDefaultSpeed + totalAgi * agiRatio : null) || 180));

    this.projectiles = [];
    this.groundZones = [];
    this.vfxRenderer?.reset();
    this.motionEngine?.reset();
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
              (this.client?.activeChar ? this.client.getOrCreateSprite(
                `char_${this.client.activeChar.mcreworkCharKey}`, this.client.activeChar.atlasJsonUrl, this.client.activeChar.atlasWebpUrl, this.client.activeChar.thumbUrl
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
      this.preCombatWorldPos = {
        mapId: this.client.currentMap ? this.client.currentMap.id : 1,
        x: this.client.playerX,
        y: this.client.playerY,
        dir: this.client.playerDir || 0,
      };
      this.battleOutcome = null;
      if (window.PlayMapPresenceController) {
        window.PlayMapPresenceController.setLocalCombatStatus(true);
      }
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
    if (statusEl) statusEl.textContent = this.totalRealPlayers > 1 ? `Aguardando: 0/${this.totalRealPlayers} jogadores prontos` : 'Trace sua estratégia ou clique em Pronto';

    this.floatingTexts.push({
      x: spawns.px,
      y: spawns.py - 60,
      text: 'PREPARE-SE PARA A BATALHA',
      color: '#38bdf8',
      life: 2.2,
    });

    this.renderSkillButtonsHud();
    this.updateCombatShortcutsHud();
    if (window.PlayHudController?.setCombatMode) window.PlayHudController.setCombatMode(true);
    else document.body.classList.add('is-in-combat');
    this.updateHud();
  }

  updateCombatShortcutsHud() {
    const hud = window.PlayHudController;
    for (let i = 0; i < 2; i++) {
      const btn = document.getElementById(`btnActShortcut${i + 1}`), img = document.getElementById(`imgActShortcut${i + 1}`), qty = document.getElementById(`qtyActShortcut${i + 1}`);
      if (!btn) continue;
      const s = hud?.state?.shortcuts?.[i];
      if (s?.item) {
        btn.style.display = 'flex';
        btn.title = `${s.item.name} (${s.item.count !== undefined ? 'x' + s.item.count : 'Usar'})`;
        if (img) img.src = s.item.icon;
        if (qty) qty.textContent = s.item.count !== undefined ? String(s.item.count) : '';
        btn.style.opacity = (s.item.count !== undefined && s.item.count <= 0) ? '0.4' : '1';
      } else {
        btn.style.display = 'none';
      }
    }
  }

  triggerCombatShortcut(slotIdx) {
    if (!this.isActive || !this.player || !this.player.isAlive) return;
    const hud = window.PlayHudController, slot = hud?.state?.shortcuts?.[slotIdx];
    if (!slot?.item) {
      if (this.client?.showNotification) this.client.showNotification(`Slot #${slotIdx + 1} vazio!`, 'info');
      return;
    }
    const it = slot.item;
    if (it.count !== undefined && it.count <= 0) {
      if (this.client?.showNotification) this.client.showNotification(`${it.name} esgotado!`, 'warning');
      return;
    }
    const now = performance.now(), cdKey = `shortcut${slotIdx}`;
    if (this.skillCooldowns[cdKey] && this.skillCooldowns[cdKey] > now) return;
    this.skillCooldowns[cdKey] = now + 1200;

    const isMp = it.type === 'HEAL_MP' || it.name.toLowerCase().includes('mana') || it.name.toLowerCase().includes('mp');
    if (isMp) {
      const healMp = it.value || 80;
      this.player.mp = Math.min(this.player.maxMp, this.player.mp + healMp);
      this.floatingTexts.push({ x: this.player.x, y: this.player.y - 50, text: `+${healMp} MP`, color: '#38bdf8', life: 1.4 });
    } else {
      const healHp = it.value || 150;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + healHp);
      this.floatingTexts.push({ x: this.player.x, y: this.player.y - 50, text: `+${healHp} HP`, color: '#22c55e', life: 1.4 });
    }
    if (it.count !== undefined) it.count--;
    this.updateCombatShortcutsHud();
    if (hud?.updateShortcutsDisplay) hud.updateShortcutsDisplay();
    this.updateHud();
  }

  renderSkillButtonsHud() {
    const fallbackIcons = ['⚡', '🌀', '🛡️', '💥'];
    for (let i = 1; i <= 4; i++) {
      const btn = document.getElementById(`btnActSkill${i}`);
      const lbl = document.getElementById(`lblActSkill${i}`);
      const sk = (this.classSkills || [])[i - 1];
      if (!btn || !lbl) continue;
      if (sk) {
        btn.title = `${sk.namePtBr} (${sk.mpCost || 0} MP • ${sk.cooldownSeconds ?? 0}s) [Tecla ${i}]`;
        lbl.innerHTML = sk.iconUrl ? `<img class="action-skill-icon-img" src="${sk.iconUrl}" alt="${sk.namePtBr}" />` : fallbackIcons[i - 1];
        btn.style.opacity = '1';
      } else {
        btn.title = `Slot #${i} (Sem habilidade vinculada)`;
        lbl.textContent = fallbackIcons[i - 1];
        btn.style.opacity = '0.6';
      }
    }
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
    else if (statusEl) statusEl.textContent = `Aguardando: ${this.readyPlayerIds.size}/${this.totalRealPlayers} jogadores prontos...`;
  }

  startFightNow() {
    if (!this.isActive || this.combatState !== 'PREPARATION') return;
    this.combatState = 'FIGHTING';
    const prepBanner = document.getElementById('actionPrepBanner'); if (prepBanner) prepBanner.style.display = 'none';
    const px = this.player ? this.player.x : this.arenaCenterX, py = (this.player ? this.player.y : this.arenaCenterY) - 70;
    this.floatingTexts.push({ x: px, y: py, text: 'COMBATE INICIADO', color: '#fde047', life: 1.8 });
  }

  closeArena() {
    this.isActive = false;
    this.combatState = 'INACTIVE';
    this.pets = [];
    this.monsters = [];
    this.projectiles = [];
    this.selectedTargetMob = null;

    if (window.PlayHudController?.setCombatMode) window.PlayHudController.setCombatMode(false);
    else document.body.classList.remove('is-in-combat');

    const modal = document.getElementById('actionCombatModal'); if (modal) modal.style.display = 'none';
    const prepBanner = document.getElementById('actionPrepBanner'); if (prepBanner) prepBanner.style.display = 'none';
    const resultBanner = document.getElementById('actionResultBanner'); if (resultBanner) resultBanner.style.display = 'none';

    if (this.client) {
      this.client.encounterCooldownUntil = performance.now() + 5000;
      this.client.moveTargetX = null; this.client.moveTargetY = null; this.client.currentPath = null;
      this.client.dpadDx = 0; this.client.dpadDy = 0; this.client.isMoving = false;

      if (window.PlayMapPresenceController) {
        window.PlayMapPresenceController.setLocalCombatStatus(false);
      }

      if (this.battleOutcome === 'DEFEAT') {
        const charId = this.client?.activeChar?.id;
        if (charId) {
          this.client.api(`/api/play/characters/${charId}/respawn`, { method: 'POST' })
            .then((res) => { if (res?.mapId) this.client.loadMapIntoWorld(res.mapId, res.spawnX, res.spawnY); })
            .catch(() => {});
        }
      } else if (this.preCombatWorldPos) {
        this.client.playerX = this.preCombatWorldPos.x;
        this.client.playerY = this.preCombatWorldPos.y;
        this.client.playerDir = this.preCombatWorldPos.dir;
      }
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
    this.updateCooldownOverlay('cdOverlaySkill3', this.skillCooldowns.skill3, now);
    this.updateCooldownOverlay('cdOverlaySkill4', this.skillCooldowns.skill4, now);
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
    if (now < this.skillCooldowns[cdKey] || this.player.mp < mpCost) return;
    this.skillCooldowns[cdKey] = now + cdMs;
    this.player.mp = Math.max(0, this.player.mp - mpCost);
    this.player.actionStartTime = now; this.player.action = 7; this.player.attackTimer = 0.40;
    this.player.dir = this.compute8Direction(target.x - this.player.x, target.y - this.player.y);
    this.spawnHomingProjectile(target, skillType, aoeRadius, this.player.atk, false, emoji, color, isMagical, undefined, undefined, undefined, undefined, 'ALLY', this.player.critDmg, { attackerUnit: this.player, skillMultiplier: dmgMultiplier });
    this.updateHud();
  }

  spawnHomingProjectile(target, skillType, aoeRadius, dmg, isCrit, emoji, color, isMagical, startX, startY, speed, attackerAcc, team = 'ALLY', critDmgMult = null, extra = null) {
    this.projectiles.push({
      x: startX !== undefined ? startX : this.player.x,
      y: startY !== undefined ? startY : this.player.y - 20,
      target, skillType, aoeRadius, dmg, isCrit, emoji, color, isMagical,
      speed: speed || 620, attackerAcc, team, critDmgMult,
      attackerUnit: extra?.attackerUnit || (team === 'ALLY' ? this.player : null),
      skillMultiplier: extra?.skillMultiplier ?? 1.0,
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
    if (window.ActionSkillEngine && !window.ActionSkillEngine.isActionBlocked(attacker) && !window.ActionSkillEngine.isSilenced(attacker) && Array.isArray(attacker.skillIds) && attacker.skillIds.length > 0 && Math.random() < 0.28) {
      const skId = attacker.skillIds[Math.floor(Math.random() * attacker.skillIds.length)];
      const sk = (this.skillCatalog || []).find((s) => Number(s.id) === Number(skId) && s.skillType !== 'PASSIVE');
      if (sk && attacker.mp >= (Number(sk.mpCost) || 0)) {
        const aspd = Number(attacker.attackSpeed) || 1.0;
        attacker.nextAttackTime = now + Math.round(1600 / aspd);
        window.ActionSkillEngine.executeSkill(this, attacker, sk, target, now, null);
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
      this.spawnHomingProjectile(
        target, 'SINGLE_TARGET', 0, attacker.atk, false, emoji, color, isMag,
        attacker.x, attacker.y - 20, 560, acc, attacker.team, attacker.critDmg || 1.5,
        { attackerUnit: attacker, skillMultiplier: 1.0 }
      );
      return;
    }

    const dmgScale = isCloseBrawl ? 0.85 : 1.0;
    this.applyDamageWithHitEvasionRoll(
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
      this.updateHud();
      this.checkVictoryCondition();
    } else {
      this.updateHud();
    }
  }

  checkVictoryCondition() {
    if (this.combatState !== 'FIGHTING') return;
    const aliveMobs = this.monsters.filter((m) => m.isAlive);
    if (aliveMobs.length === 0) {
      const expGained = this.monsters.reduce((acc, m) => acc + (Number(m.level) || 1) * 65 * Math.max(1, Number(m.rewardMultiplier) || 1), 0);
      const goldGained = this.monsters.reduce((acc, m) => acc + Math.max(10, (Number(m.level) || 1) * 18) * Math.max(1, Number(m.rewardMultiplier) || 1), 0);
      this.recordBattleVictoryOnServer(expGained, goldGained);
      this.showResult(true, `Você venceu o confronto na arena!<br><br><strong>+${expGained} EXP</strong> &bull; <strong>+${goldGained} Ouro</strong>`);
    }
  }

  async recordBattleVictoryOnServer() {
    try {
      if (!this.currentBattle || !this.client) return;
      const res = await this.client.api('/api/play/combat/victory', { method: 'POST', body: JSON.stringify({ battleId: this.currentBattle.battleId }) });
      if (res?.questState) { this.client.questState = res.questState; this.client.updateQuestHudBadge?.(); }
      if (res?.characterGold !== undefined && this.client.activeChar) { this.client.activeChar.gold = res.characterGold; }
      if (res?.playerProgression && this.client.activeChar) {
        const pProg = res.playerProgression;
        this.client.activeChar.level = pProg.newLevel;
        this.client.activeChar.experience = pProg.newExp;
        this.client.activeChar.unspentStatPoints = pProg.unspentStatPoints;
        if (pProg.maxXp) this.client.activeChar.maxXp = pProg.maxXp;
        if (pProg.leveledUp) {
          const rEl = document.getElementById('actionResultRewards');
          if (rEl) rEl.innerHTML += `<div style="margin-top:6px; color:#fde047; font-weight:900; font-size:1.02rem; text-shadow:0 0 10px rgba(234,179,8,0.7);">🎉 LEVEL UP! Nível ${pProg.newLevel}! (+${pProg.statPointsGained} Pontos)</div>`;
          this.client.showNotification?.(`🎉 LEVEL UP! Nível ${pProg.newLevel}! (+${pProg.statPointsGained} Pontos)`, 'success');
        }
      }
      if (Array.isArray(res?.petsProgression) && res.petsProgression.length > 0) {
        const rEl = document.getElementById('actionResultRewards');
        for (const petProg of res.petsProgression) {
          const matchedPet = (this.client.activeChar?.equippedPets || []).find((p) => p.id === petProg.petId);
          if (matchedPet) { matchedPet.level = petProg.newLevel; matchedPet.experience = petProg.newExp; }
          if (petProg.leveledUp) {
            if (rEl) rEl.innerHTML += `<div style="margin-top:4px; color:#a7f3d0; font-weight:700;">🐾 Pet ${petProg.nickname} subiu para Nível ${petProg.newLevel}!</div>`;
            this.client.showNotification?.(`🐾 Pet ${petProg.nickname} subiu para Nível ${petProg.newLevel}!`, 'info');
          }
        }
        if (window.PlayHudController && this.client.activeChar?.equippedPets) window.PlayHudController.updatePets(this.client.activeChar.equippedPets);
      }
      this.client.updateHudInfo?.();
      if (Array.isArray(res?.droppedItems) && res.droppedItems.length > 0) {
        const rEl = document.getElementById('actionResultRewards');
        const dropTxt = res.droppedItems.map((d) => `+${d.quantity}x ${d.namePtBr}`).join(' &bull; ');
        if (rEl) rEl.innerHTML += `<div style="margin-top:6px; color:#5eead4; font-weight:700;">${dropTxt}</div>`;
      }
    } catch (err) { console.warn('Falha ao sincronizar vitória no backend:', err); }
  }

  showResult(isVictory, messageHtml, isFled = false) {
    this.combatState = 'RESULT';
    this.battleOutcome = isFled ? 'FLED' : (isVictory ? 'VICTORY' : 'DEFEAT');
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
    let curSpeed = this.player.speed * pEffMove;

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
  drawArenaRingOnFloor(ctx, now, zoom) { if (this.isActive) this.vfxRenderer?.drawArenaFloorAndProjectiles(ctx, this, now, zoom); }
  renderActiveVfx(ctx, now) { if (this.isActive) this.vfxRenderer?.drawActiveBursts(ctx, now); }
  populateRenderQueue(renderQueue, now) {
    if (!this.isActive) return;
    if (this.player && this.player.isAlive) renderQueue.push({ type: 'COMBAT_PLAYER', y: this.player.y, data: this.player });
    for (const pet of this.pets) { if (pet.fadeAlpha > 0) renderQueue.push({ type: 'COMBAT_PET', y: pet.y, data: pet }); }
    for (const mob of this.monsters) { if (mob.fadeAlpha > 0) renderQueue.push({ type: 'COMBAT_MONSTER', y: mob.y, data: mob }); }
  }
  renderFloatingTexts(ctx) { this.vfxRenderer?.drawFloatingTexts(ctx, this.floatingTexts); }
}

window.ActionCombatArena = ActionCombatArena;
