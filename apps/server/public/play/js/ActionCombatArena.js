/**
 * @file apps/server/public/play/js/ActionCombatArena.js
 * @module @etheria/server
 * @description Arena Instanciada no Mapa Real com Combate Livre em Tempo Real (Action RPG / Mobile First).
 *   - Instanciação visual na região atual do mapa aberta pelo client.
 *   - Isolamento visual: NPCs e outros jogadores que não participam da batalha somem da tela.
 *   - Validação de colisão (mesh.isPointInCollision) e sobreposição anatômica (mesh.isPointInOverlap).
 *   - Posicionamento com Distância Justa (~280px) em piso desobstruído com ângulo tático.
 *   - Contagem regressiva de 20s com botão "⚡ PRONTO!" para início acelerado se todos confirmarem.
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

    // Coordenadas Centrais e Raio da Arena no Mapa Real (+30% de área de combate)
    this.arenaCenterX = 0;
    this.arenaCenterY = 0;
    this.arenaRadiusX = 468;
    this.arenaRadiusY = 338; // Proporção isométrica ~0.72

    // Entidades na arena
    this.player = null;
    this.monsters = [];
    this.floatingTexts = [];

    // Inputs e Controles
    this.keysDown = new Set();
    this.joystickActive = false;
    this.joystickTouchId = null;
    this.joystickOrigin = { x: 0, y: 0 };
    this.joystickVector = { x: 0, y: 0 };

    // Cooldowns das Habilidades do Jogador (ms)
    this.skillCooldowns = {
      attack: 0,
      skill1: 0, // Turbilhão Arcana (AoE)
      skill2: 0, // Raio Elemental Perfurante
      dash: 0,   // Esquiva
    };

    // Cache de spritesheets das criaturas e herói
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
      if (e.key === ' ' || e.key.toLowerCase() === 'j') {
        this.triggerAttack();
      } else if (e.key === '1') {
        this.triggerSkill(1);
      } else if (e.key === '2') {
        this.triggerSkill(2);
      } else if (e.key.toLowerCase() === 'k' || e.key === 'Shift') {
        this.triggerDash();
      } else if (e.key === 'Escape') {
        this.fleeBattle();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (!this.isActive) return;
      this.keysDown.delete(e.key.toLowerCase());
    });

    // Joystick Virtual (Suporte Unificado Touch + Mouse via Pointer Events)
    const zone = document.getElementById('actionJoystickZone');
    if (zone) {
      const startJoystick = (clientX, clientY, id) => {
        this.joystickActive = true;
        this.joystickTouchId = id;
        const rect = zone.getBoundingClientRect();
        this.joystickOrigin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        this.handleJoystickMove(clientX, clientY);
      };

      const moveJoystick = (clientX, clientY, id) => {
        if (!this.joystickActive || this.joystickTouchId !== id) return;
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

      zone.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        try { zone.setPointerCapture(e.pointerId); } catch (_) {}
        startJoystick(e.clientX, e.clientY, e.pointerId);
      });

      zone.addEventListener('pointermove', (e) => {
        if (!this.joystickActive) return;
        e.preventDefault();
        moveJoystick(e.clientX, e.clientY, e.pointerId);
      });

      const endPointer = (e) => {
        try { zone.releasePointerCapture(e.pointerId); } catch (_) {}
        stopJoystick(e.pointerId);
      };
      zone.addEventListener('pointerup', endPointer);
      zone.addEventListener('pointercancel', endPointer);
    }

    // Botão de Continuar / Fechar Resultado da Batalha
    const closeBtn = document.getElementById('btnActionCloseResult');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.closeArena();
      });
      closeBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.closeArena();
      });
    }
  }

  handleJoystickMove(clientX, clientY) {
    const maxRadius = 45;
    const dx = clientX - this.joystickOrigin.x;
    const dy = clientY - this.joystickOrigin.y;
    const dist = Math.hypot(dx, dy);

    if (dist === 0) {
      this.joystickVector = { x: 0, y: 0 };
      return;
    }
    const clampedDist = Math.min(maxRadius, dist);
    const nx = dx / dist;
    const ny = dy / dist;
    this.joystickVector = { x: nx, y: ny };

    const thumb = document.getElementById('actionJoystickThumb');
    if (thumb) {
      thumb.style.transform = `translate(${nx * clampedDist}px, ${ny * clampedDist}px)`;
    }
  }

  /**
   * Helper seguro de validação de colisão da malha poligonal do mapa.
   */
  isBlocked(x, y) {
    const mesh = this.client?.mesh;
    if (!mesh) return false;
    if (typeof mesh.isPointBlocked === 'function') return mesh.isPointBlocked(x, y);
    if (typeof mesh.isPointInCollision === 'function') return mesh.isPointInCollision(x, y);
    return false;
  }

  /**
   * Encontra posições justas e livres de colisão para jogador e monstros.
   * Testa eixos diagonais isométricos e cardeais garantindo separação tática (~364px com arena +30%).
   */
  findFairSpawnPositions(cx, cy) {
    const testDistances = [364, 320, 280, 240, 200, 160];
    const angles = [
      -Math.PI / 4,      // NW - SE
      (-3 * Math.PI) / 4, // SW - NE
      0,                 // W - E
      Math.PI / 2,       // N - S
      Math.PI / 4,
      (3 * Math.PI) / 4,
      Math.PI,
      -Math.PI / 2,
    ];

    for (const dist of testDistances) {
      const half = dist / 2;
      for (const ang of angles) {
        const px = Math.round(cx - Math.cos(ang) * half);
        const py = Math.round(cy - Math.sin(ang) * (half * 0.72));
        const mx = Math.round(cx + Math.cos(ang) * half);
        const my = Math.round(cy + Math.sin(ang) * (half * 0.72));

        const pCol = this.isBlocked(px, py);
        const mCol = this.isBlocked(mx, my);

        if (!pCol && !mCol) {
          return { px, py, mx, my };
        }
      }
    }

    // Fallback seguro caso toda a vizinhança imediata tenha colisão densa
    return { px: cx - 80, py: cy, mx: cx + 80, my: cy };
  }

  /**
   * Abre a Arena de Ação Livre instanciada no mapa real.
   */
  openArena(battleState) {
    this.currentBattle = battleState;
    this.isActive = true;
    this.combatState = 'PREPARATION';
    this.prepTimeRemaining = 20.0;
    this.isLocalPlayerReady = false;
    this.readyPlayerIds = new Set();
    this.totalRealPlayers = Number(battleState.totalRealPlayers) || 1;

    // Centro da arena é a localização atual do jogador no mapa (+30% de área de combate)
    this.arenaCenterX = Math.round(this.client?.playerX || 400);
    this.arenaCenterY = Math.round(this.client?.playerY || 300);
    this.arenaRadiusX = 468;
    this.arenaRadiusY = 338;

    // Encontra distância justa em terreno desobstruído
    const spawns = this.findFairSpawnPositions(this.arenaCenterX, this.arenaCenterY);

    // Configura o Jogador na arena
    const pState = battleState.player || {};
    const pDir = this.compute8Direction(spawns.mx - spawns.px, spawns.my - spawns.py);

    this.player = {
      x: spawns.px,
      y: spawns.py,
      speed: 215,
      dir: pDir,
      action: 0,
      isAlive: true,
      hp: pState.hp || 500,
      maxHp: pState.maxHp || 500,
      mp: pState.mp || 200,
      maxMp: pState.maxMp || 200,
      atk: pState.atk || 75,
      def: pState.def || 40,
      name: pState.name || this.client?.activeChar?.name || 'Herói',
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
      isAttacking: false,
      attackTimer: 0,
      isDashing: false,
      dashTimer: 0,
      hitTimer: 0,
    };

    // Sincroniza posição do cliente no mapa
    if (this.client) {
      this.client.playerX = spawns.px;
      this.client.playerY = spawns.py;
      this.client.playerDir = pDir;
    }

    // Configura Monstros a partir da distância justa
    const mStates = Array.isArray(battleState.monsters) ? battleState.monsters : [];
    this.monsters = mStates.map((m, idx) => {
      const offsetPerp = (idx - (mStates.length - 1) / 2) * 50;
      let mx = spawns.mx;
      let my = spawns.my + offsetPerp;

      if (this.isBlocked(mx, my)) {
        mx = spawns.mx;
        my = spawns.my;
      }

      const mDir = this.compute8Direction(spawns.px - mx, spawns.py - my);
      return {
        id: m.id || `mob_${idx}`,
        templateId: battleState.monsterTemplateId,
        name: m.name || `Monstro #${idx + 1}`,
        x: mx,
        y: my,
        dir: mDir,
        action: 0,
        isAlive: true,
        hp: m.hp || 300,
        maxHp: m.maxHp || 300,
        atk: m.atk || 45,
        def: m.def || 25,
        speed: 110 + idx * 10,
        attackRange: 52,
        nextAttackTime: performance.now() + 1000 + idx * 400,
        hitTimer: 0,
        attackTimer: 0,
        fadeAlpha: 1.0,
        sprite: this.getSprite(m.atlasJsonUrl, m.atlasWebpUrl, m.thumbUrl),
        groundOffsetY: m.groundOffsetY || 0,
        shadowOffsetX: m.shadowOffsetX || 0,
        shadowOffsetY: m.shadowOffsetY || 0,
      };
    });

    this.floatingTexts = [];

    // Interface HUD
    const modal = document.getElementById('actionCombatModal');
    if (modal) modal.style.display = 'flex';

    const resultBanner = document.getElementById('actionResultBanner');
    if (resultBanner) resultBanner.style.display = 'none';

    // Banner de Preparação e Contagem de 20s
    const prepBanner = document.getElementById('actionPrepBanner');
    if (prepBanner) prepBanner.style.display = 'flex';

    const timerEl = document.getElementById('actPrepTimer');
    if (timerEl) timerEl.textContent = '20s';

    const btnReady = document.getElementById('btnActReady');
    if (btnReady) {
      btnReady.classList.remove('ready');
      btnReady.textContent = '⚡ PRONTO!';
    }

    const statusEl = document.getElementById('actPrepStatusText');
    if (statusEl) {
      statusEl.textContent = this.totalRealPlayers > 1
        ? `👥 Aguardando: 0/${this.totalRealPlayers} jogadores prontos`
        : 'Trace sua estratégia ou clique em Pronto';
    }

    this.floatingTexts.push({
      x: spawns.px,
      y: spawns.py - 60,
      text: '⏳ PREPARE-SE PARA A BATALHA!',
      color: '#38bdf8',
      life: 2.2,
    });

    this.updateHud();
  }

  /**
   * Alterna estado de "Pronto" do jogador local.
   * Se todos os jogadores reais estiverem prontos, a luta inicia imediatamente.
   */
  toggleReady() {
    if (!this.isActive || this.combatState !== 'PREPARATION') return;

    this.isLocalPlayerReady = !this.isLocalPlayerReady;
    const localId = this.client?.activeChar?.id || 'p1';

    const btnReady = document.getElementById('btnActReady');
    const statusEl = document.getElementById('actPrepStatusText');

    if (this.isLocalPlayerReady) {
      this.readyPlayerIds.add(localId);
      if (btnReady) {
        btnReady.classList.add('ready');
        btnReady.textContent = '✔️ VOCÊ ESTÁ PRONTO';
      }
    } else {
      this.readyPlayerIds.delete(localId);
      if (btnReady) {
        btnReady.classList.remove('ready');
        btnReady.textContent = '⚡ PRONTO!';
      }
    }

    // Se todos derem pronto, acelera e inicia agora
    if (this.readyPlayerIds.size >= this.totalRealPlayers) {
      this.startFightNow();
    } else if (statusEl) {
      statusEl.textContent = `👥 Aguardando: ${this.readyPlayerIds.size}/${this.totalRealPlayers} jogadores prontos...`;
    }
  }

  /**
   * Inicia o combate ativo após término da contagem ou confirmação de todos.
   */
  startFightNow() {
    if (!this.isActive || this.combatState !== 'PREPARATION') return;

    this.combatState = 'FIGHTING';
    const prepBanner = document.getElementById('actionPrepBanner');
    if (prepBanner) prepBanner.style.display = 'none';

    this.floatingTexts.push({
      x: this.player ? this.player.x : this.arenaCenterX,
      y: (this.player ? this.player.y : this.arenaCenterY) - 70,
      text: '⚔️ LUTA INICIADA!',
      color: '#fde047',
      life: 1.8,
    });
  }

  closeArena() {
    this.isActive = false;
    this.combatState = 'INACTIVE';

    const modal = document.getElementById('actionCombatModal');
    if (modal) modal.style.display = 'none';

    const prepBanner = document.getElementById('actionPrepBanner');
    if (prepBanner) prepBanner.style.display = 'none';

    const resultBanner = document.getElementById('actionResultBanner');
    if (resultBanner) resultBanner.style.display = 'none';

    // Trégua de 5 segundos no mapa após combate para evitar re-encontros imediatos
    if (this.client) {
      this.client.encounterCooldownUntil = performance.now() + 5000;
      this.client.moveTargetX = null;
      this.client.moveTargetY = null;
      this.client.dpadDx = 0;
      this.client.dpadDy = 0;
      this.client.isMoving = false;
      if (this.player) {
        this.client.playerX = this.player.x;
        this.client.playerY = this.player.y;
        this.client.playerDir = this.player.dir;
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

    const hpBar = document.getElementById('actHudPlayerHpBar');
    if (hpBar) hpBar.style.width = `${hpPct}%`;
    const mpBar = document.getElementById('actHudPlayerMpBar');
    if (mpBar) mpBar.style.width = `${mpPct}%`;

    const hpText = document.getElementById('actHudPlayerHpText');
    if (hpText) hpText.textContent = `${Math.ceil(this.player.hp)} / ${this.player.maxHp}`;

    const pName = document.getElementById('actHudPlayerName');
    if (pName) pName.textContent = this.player.name;

    const aliveCount = this.monsters.filter((m) => m.isAlive).length;
    const mobCountElem = document.getElementById('actHudMonstersAlive');
    if (mobCountElem) mobCountElem.textContent = String(aliveCount);

    const now = performance.now();
    this.updateCooldownOverlay('cdOverlaySkill1', this.skillCooldowns.skill1, now);
    this.updateCooldownOverlay('cdOverlaySkill2', this.skillCooldowns.skill2, now);
    this.updateCooldownOverlay('cdOverlayDash', this.skillCooldowns.dash, now);
  }

  updateCooldownOverlay(elemId, expireTime, now) {
    const el = document.getElementById(elemId);
    if (!el) return;
    if (expireTime > now) {
      const remainingSec = ((expireTime - now) / 1000).toFixed(1);
      el.textContent = `${remainingSec}s`;
      el.style.display = 'flex';
    } else {
      el.style.display = 'none';
    }
  }

  dealDamageToMob(mob, dmg, text, color, now) {
    mob.hp = Math.max(0, mob.hp - dmg);
    mob.hitTimer = 0.28;
    mob.actionStartTime = now;
    mob.action = 5;
    this.floatingTexts.push({ x: mob.x, y: mob.y - 48, text, color, life: 1.1 });
    if (mob.hp === 0) {
      mob.isAlive = false;
      mob.actionStartTime = now;
      mob.action = 6;
    }
  }

  triggerAttack() {
    if (!this.isActive || this.combatState !== 'FIGHTING' || !this.player || !this.player.isAlive || this.player.isAttacking) {
      return;
    }
    const now = performance.now();
    if (now < this.skillCooldowns.attack) return;
    this.skillCooldowns.attack = now + 320;

    this.player.isAttacking = true;
    this.player.attackTimer = 0.32;
    this.player.actionStartTime = now;
    this.player.action = 3; // Ataque Físico

    const hitRadius = 75;
    for (const mob of this.monsters) {
      if (!mob.isAlive) continue;
      const dx = mob.x - this.player.x;
      const dy = mob.y - this.player.y;
      const dist = Math.hypot(dx, dy);

      if (dist <= hitRadius) {
        const isCrit = Math.random() < 0.18;
        const variance = 0.9 + Math.random() * 0.25;
        let rawDmg = Math.round(this.player.atk * (100 / (100 + mob.def * 0.4)) * variance);
        if (isCrit) rawDmg = Math.round(rawDmg * 1.55);
        const dmg = Math.max(8, rawDmg);

        if (dist > 0) {
          const pushX = mob.x + (dx / dist) * 20;
          const pushY = mob.y + (dy / dist) * 20;
          if (!this.isBlocked(pushX, pushY)) {
            mob.x = pushX;
            mob.y = pushY;
          }
        }
        this.dealDamageToMob(mob, dmg, isCrit ? `💥 CRÍTICO! -${dmg}` : `-${dmg}`, isCrit ? '#fde047' : '#f87171', now);
      }
    }
    this.updateHud();
    this.checkVictoryCondition();
  }

  triggerSkill(skillNum) {
    if (!this.isActive || this.combatState !== 'FIGHTING' || !this.player || !this.player.isAlive) {
      return;
    }
    const now = performance.now();

    if (skillNum === 1) {
      // Turbilhão Arcana (AoE)
      if (now < this.skillCooldowns.skill1 || this.player.mp < 20) return;
      this.skillCooldowns.skill1 = now + 4000;
      this.player.mp = Math.max(0, this.player.mp - 20);
      this.player.actionStartTime = now;
      this.player.action = 7;
      this.player.attackTimer = 0.40;

      for (const mob of this.monsters) {
        if (!mob.isAlive) continue;
        if (Math.hypot(mob.x - this.player.x, mob.y - this.player.y) <= 140) {
          const dmg = Math.round(this.player.atk * 1.9);
          this.dealDamageToMob(mob, dmg, `🌪️ -${dmg}`, '#a78bfa', now);
        }
      }
      this.updateHud();
      this.checkVictoryCondition();
    } else if (skillNum === 2) {
      // Raio Elemental Perfurante
      if (now < this.skillCooldowns.skill2 || this.player.mp < 35) return;
      this.skillCooldowns.skill2 = now + 6000;
      this.player.mp = Math.max(0, this.player.mp - 35);
      this.player.actionStartTime = now;
      this.player.action = 7;
      this.player.attackTimer = 0.45;

      for (const mob of this.monsters) {
        if (!mob.isAlive) continue;
        if (Math.hypot(mob.x - this.player.x, mob.y - this.player.y) <= 180) {
          const dmg = Math.round(this.player.atk * 2.35);
          this.dealDamageToMob(mob, dmg, `⚡ -${dmg}`, '#38bdf8', now);
        }
      }
      this.updateHud();
      this.checkVictoryCondition();
    }
  }

  triggerDash() {
    if (!this.isActive || this.combatState !== 'FIGHTING' || !this.player || !this.player.isAlive || this.player.isDashing) {
      return;
    }
    const now = performance.now();
    if (now < this.skillCooldowns.dash) return;
    this.skillCooldowns.dash = now + 1800;

    this.player.isDashing = true;
    this.player.dashTimer = 0.22;
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
    const modal = document.getElementById('actionCombatModal');
    if (modal) modal.style.display = 'flex';

    const prepBanner = document.getElementById('actionPrepBanner');
    if (prepBanner) prepBanner.style.display = 'none';

    const banner = document.getElementById('actionResultBanner');
    const title = document.getElementById('actionResultTitle');
    const rewards = document.getElementById('actionResultRewards');
    if (!banner || !title || !rewards) return;

    if (isFled) {
      title.textContent = '🏃 Fuga da Batalha';
      title.style.color = '#7dd3fc';
    } else if (isVictory) {
      title.textContent = '🏆 VITÓRIA!';
      title.style.color = '#fde047';
    } else {
      title.textContent = '💀 VOCÊ FOI DERROTADO!';
      title.style.color = '#f87171';
    }

    rewards.innerHTML = messageHtml;
    banner.style.display = 'flex';
  }

  compute8Direction(dx, dy) {
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    const sector = Math.round((90 - angle) / 45);
    return ((sector % 8) + 8) % 8;
  }

  /**
   * Atualização de física a 60 FPS executada pelo gameLoop do cliente.
   */
  updatePhysics(dt, now) {
    if (!this.isActive || !this.player || !this.player.isAlive) return;

    // 0. Atualiza Contagem de 20s durante PREPARATION
    if (this.combatState === 'PREPARATION') {
      this.prepTimeRemaining = Math.max(0, this.prepTimeRemaining - dt);
      const timerEl = document.getElementById('actPrepTimer');
      if (timerEl) {
        timerEl.textContent = `${Math.ceil(this.prepTimeRemaining)}s`;
      }
      if (this.prepTimeRemaining <= 0) {
        this.startFightNow();
        return;
      }

      // Durante a preparação ninguém faz nada (tempo para sincronização e estratégia rápida)
      this.player.action = 0; // Postura parado
      if (this.client) {
        this.client.moveTargetX = null;
        this.client.moveTargetY = null;
        this.client.dpadDx = 0;
        this.client.dpadDy = 0;
        this.client.isMoving = false;
      }
      for (const mob of this.monsters) {
        if (!mob.isAlive) continue;
        mob.action = 0; // Postura parado
        mob.dir = this.compute8Direction(this.player.x - mob.x, this.player.y - mob.y);
      }
      return;
    }

    // 1. Movimentação do Jogador em Combate Ativo (FIGHTING)
    let vx = 0;
    let vy = 0;

    // A. Teclado (WASD / Setas) checado no Set local e do cliente
    const keys = this.keysDown;
    const clientKeys = this.client?.keysDown;
    const isDown = (k) => keys.has(k) || (clientKeys && clientKeys.has(k));

    if (isDown('w') || isDown('arrowup')) vy -= 1;
    if (isDown('s') || isDown('arrowdown')) vy += 1;
    if (isDown('a') || isDown('arrowleft')) vx -= 1;
    if (isDown('d') || isDown('arrowright')) vx += 1;

    // B. D-Pad Virtual Touch do Cliente
    if (vx === 0 && vy === 0 && this.client && (this.client.dpadDx !== 0 || this.client.dpadDy !== 0)) {
      vx = this.client.dpadDx;
      vy = this.client.dpadDy;
    }

    // C. Joystick Virtual (Touch / Mouse)
    if (this.joystickActive && (this.joystickVector.x !== 0 || this.joystickVector.y !== 0)) {
      vx = this.joystickVector.x;
      vy = this.joystickVector.y;
    }

    if (vx !== 0 || vy !== 0) {
      const len = Math.hypot(vx, vy);
      vx /= len;
      vy /= len;
      if (this.client) {
        this.client.moveTargetX = null;
        this.client.moveTargetY = null;
      }
    } else if (this.client && this.client.moveTargetX !== null && this.client.moveTargetY !== null) {
      // D. Movimentação por Clique / Toque no Mapa (Click-to-Move)
      const dx = this.client.moveTargetX - this.player.x;
      const dy = this.client.moveTargetY - this.player.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= 8) {
        this.client.moveTargetX = null;
        this.client.moveTargetY = null;
      } else {
        vx = dx / dist;
        vy = dy / dist;
      }
    }

    let curSpeed = this.player.speed;
    if (this.player.isDashing) {
      this.player.dashTimer -= dt;
      if (this.player.dashTimer <= 0) {
        this.player.isDashing = false;
      } else {
        curSpeed *= 2.3;
      }
    }

    if (this.player.isAttacking) {
      this.player.attackTimer -= dt;
      if (this.player.attackTimer <= 0) {
        this.player.isAttacking = false;
        this.player.action = 0;
      }
    }
    if (this.player.hitTimer > 0) {
      this.player.hitTimer -= dt;
    }

    if (vx !== 0 || vy !== 0) {
      let targetX = this.player.x + vx * curSpeed * dt;
      let targetY = this.player.y + vy * curSpeed * dt;

      // Clamping elíptico na barreira da arena
      const normX = (targetX - this.arenaCenterX) / this.arenaRadiusX;
      const normY = (targetY - this.arenaCenterY) / this.arenaRadiusY;
      const distSq = normX * normX + normY * normY;
      if (distSq > 1) {
        const scale = 1 / Math.sqrt(distSq);
        targetX = this.arenaCenterX + (targetX - this.arenaCenterX) * scale;
        targetY = this.arenaCenterY + (targetY - this.arenaCenterY) * scale;
      }

      // Validação de Malha de Colisão do Mapa Real com deslizamento em quinas
      if (!this.isBlocked(targetX, targetY)) {
        this.player.x = targetX;
        this.player.y = targetY;
      } else if (!this.isBlocked(targetX, this.player.y)) {
        this.player.x = targetX;
      } else if (!this.isBlocked(this.player.x, targetY)) {
        this.player.y = targetY;
      } else if (this.client && (this.client.moveTargetX !== null || this.client.moveTargetY !== null)) {
        this.client.moveTargetX = null;
        this.client.moveTargetY = null;
      }

      this.player.dir = this.compute8Direction(vx, vy);
      if (!this.player.isAttacking) {
        this.player.action = 1; // Correndo
      }

      // Sincroniza posição contínua no mapa aberto
      if (this.client) {
        this.client.playerX = this.player.x;
        this.client.playerY = this.player.y;
        this.client.playerDir = this.player.dir;
      }
    } else if (!this.player.isAttacking && this.player.hitTimer <= 0) {
      this.player.action = 0; // Parado
    }

    // 2. IA dos Monstros
    for (const mob of this.monsters) {
      if (!mob.isAlive) {
        mob.fadeAlpha = Math.max(0, mob.fadeAlpha - dt * 1.5);
        continue;
      }

      // Em PREPARATION, monstros mantêm postura idle olhando para o jogador
      if (this.combatState === 'PREPARATION') {
        mob.action = 0;
        mob.dir = this.compute8Direction(this.player.x - mob.x, this.player.y - mob.y);
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
        let nMx = mob.x + (mdx / mDist) * mob.speed * dt;
        let nMy = mob.y + (mdy / mDist) * mob.speed * dt;

        // Clamping elíptico na arena
        const mNormX = (nMx - this.arenaCenterX) / this.arenaRadiusX;
        const mNormY = (nMy - this.arenaCenterY) / this.arenaRadiusY;
        const mDistSq = mNormX * mNormX + mNormY * mNormY;
        if (mDistSq > 1) {
          const scale = 1 / Math.sqrt(mDistSq);
          nMx = this.arenaCenterX + (nMx - this.arenaCenterX) * scale;
          nMy = this.arenaCenterY + (nMy - this.arenaCenterY) * scale;
        }

        // Validação de Colisão do Monstro com o Mapa
        if (!this.isBlocked(nMx, nMy)) {
          mob.x = nMx;
          mob.y = nMy;
        } else if (!this.isBlocked(nMx, mob.y)) {
          mob.x = nMx;
        } else if (!this.isBlocked(mob.x, nMy)) {
          mob.y = nMy;
        }

        mob.dir = this.compute8Direction(mdx, mdy);
        mob.action = 1; // Correndo / Saltitando suavemente
      } else {
        mob.action = 0;
        mob.dir = this.compute8Direction(mdx, mdy);

        if (now >= mob.nextAttackTime) {
          mob.nextAttackTime = now + 1800 + Math.random() * 800;
          mob.attackTimer = 0.40;
          mob.actionStartTime = now;
          mob.action = 3; // Ataque

          if (!this.player.isDashing) {
            const dmg = Math.max(5, Math.round(mob.atk * (100 / (100 + this.player.def * 0.5))));
            this.player.hp = Math.max(0, this.player.hp - dmg);
            this.player.hitTimer = 0.22;
            this.player.actionStartTime = now;
            this.player.action = 5;

            this.floatingTexts.push({
              x: this.player.x,
              y: this.player.y - 45,
              text: `💔 -${dmg}`,
              color: '#ef4444',
              life: 1.0,
            });

            if (this.player.hp === 0) {
              this.player.isAlive = false;
              this.player.actionStartTime = now;
              this.player.action = 6;
              this.showResult(false, 'Você foi derrotado na arena.');
              break;
            }
          }
        }
      }
    }

    // 3. Floating Texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const f = this.floatingTexts[i];
      f.y -= dt * 28;
      f.life -= dt;
      if (f.life <= 0) this.floatingTexts.splice(i, 1);
    }
  }

  /**
   * Ponto focal da câmera para enquadramento equilibrado entre o jogador e seu oponente.
   */
  getCamFocusX() {
    if (!this.player) return this.client?.playerX || 0;
    const livingMob = this.monsters.find((m) => m.isAlive);
    if (!livingMob) return this.player.x;
    return Math.round(this.player.x * 0.65 + livingMob.x * 0.35);
  }

  getCamFocusY() {
    if (!this.player) return this.client?.playerY || 0;
    const livingMob = this.monsters.find((m) => m.isAlive);
    if (!livingMob) return this.player.y;
    return Math.round(this.player.y * 0.65 + livingMob.y * 0.35);
  }

  /**
   * Desenha o anel místico no chão do mapa real sob as entidades.
   */
  drawArenaRingOnFloor(ctx, now, zoom) {
    if (!this.isActive) return;
    const cx = this.arenaCenterX;
    const cy = this.arenaCenterY;
    const rx = this.arenaRadiusX;
    const ry = this.arenaRadiusY;

    ctx.save();

    // 1. Apenas contorno místico pulsante sem qualquer preenchimento colorido sobre o mapa
    const pulse = 0.85 + 0.15 * Math.sin(now / 260);
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(56, 189, 248, ${0.50 * pulse})`;
    ctx.lineWidth = 2.5 / zoom;
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 8;
    ctx.stroke();

    // 3. Glifos rúnicos nos 8 eixos da arena
    for (let i = 0; i < 8; i++) {
      const ang = (i * Math.PI) / 4;
      const gx = cx + Math.cos(ang) * rx;
      const gy = cy + Math.sin(ang) * ry;
      ctx.beginPath();
      ctx.arc(gx, gy, 4.5 / zoom, 0, Math.PI * 2);
      ctx.fillStyle = '#38bdf8';
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Popula a fila de renderização (Y-Sorting) com os participantes da arena.
   * NPCs e jogadores alheios são excluídos para isolamento visual completo.
   */
  populateRenderQueue(renderQueue, now) {
    if (!this.isActive) return;

    if (this.player && this.player.isAlive) {
      renderQueue.push({
        type: 'COMBAT_PLAYER',
        y: this.player.y,
        data: this.player,
      });
    }

    for (const mob of this.monsters) {
      if (mob.fadeAlpha <= 0) continue;
      renderQueue.push({
        type: 'COMBAT_MONSTER',
        y: mob.y,
        data: mob,
      });
    }
  }

  /**
   * Renderiza os textos flutuantes de dano e notificações no espaço de mundo.
   */
  renderFloatingTexts(ctx) {
    for (const f of this.floatingTexts) {
      ctx.save();
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = f.color || '#fff';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 4;
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }
  }
}

window.ActionCombatArena = ActionCombatArena;
