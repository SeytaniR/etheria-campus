/**
 * @file apps/server/public/play/js/ActionCombatArena.js
 * @module @etheria/server
 * @description Arena Instanciada 2.5D com Combate Livre em Tempo Real (Action RPG / Mobile First).
 *   Substitui completamente o antigo modelo por turnos.
 *   Permite movimentação livre em 8 direções (Joystick Virtual / WASD), ataques com hitbox dinâmica,
 *   conjuração de magias com cooldown, esquiva/dash e IA de perseguição dos monstros em tempo real a 60 FPS.
 */

class ActionCombatArena {
  constructor(client) {
    this.client = client;
    this.currentBattle = null;
    this.isActive = false;
    this.animFrameId = null;
    this.lastFrameTime = performance.now();

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

    // Cooldowns das Habilidades do Jogador (em milissegundos)
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

    // Touch Joystick Virtual Mobile
    const zone = document.getElementById('actionJoystickZone');
    if (!zone) return;

    zone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.changedTouches[0];
      this.joystickActive = true;
      this.joystickTouchId = touch.identifier;
      const rect = zone.getBoundingClientRect();
      this.joystickOrigin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      this.handleJoystickMove(touch.clientX, touch.clientY);
    }, { passive: false });

    zone.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.joystickTouchId) {
          this.handleJoystickMove(touch.clientX, touch.clientY);
          break;
        }
      }
    }, { passive: false });

    const endTouch = (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === this.joystickTouchId) {
          this.joystickActive = false;
          this.joystickTouchId = null;
          this.joystickVector = { x: 0, y: 0 };
          const thumb = document.getElementById('actionJoystickThumb');
          if (thumb) thumb.style.transform = 'translate(0px, 0px)';
          break;
        }
      }
    };
    zone.addEventListener('touchend', endTouch);
    zone.addEventListener('touchcancel', endTouch);
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
   * Abre a Arena de Ação Livre com os monstros e dados da batalha.
   */
  openArena(battleState) {
    this.currentBattle = battleState;
    this.isActive = true;

    const modal = document.getElementById('actionCombatModal');
    if (modal) modal.style.display = 'flex';

    const banner = document.getElementById('actionResultBanner');
    if (banner) banner.style.display = 'none';

    // Inicializa dimensões do canvas
    const canvas = document.getElementById('actionBattleCanvas');
    const wrapper = document.getElementById('actionCanvasWrapper');
    const cw = wrapper ? wrapper.clientWidth || window.innerWidth : window.innerWidth;
    const ch = wrapper ? wrapper.clientHeight || window.innerHeight : window.innerHeight;
    canvas.width = cw;
    canvas.height = ch;

    // Configura o Jogador
    const pState = battleState.player || {};
    this.player = {
      x: cw * 0.30,
      y: ch * 0.52,
      vx: 0,
      vy: 0,
      speed: 215, // px por segundo
      dir: 0,     // 0 = Leste
      action: 0,  // Stand
      isAlive: true,
      hp: pState.hp || 500,
      maxHp: pState.maxHp || 500,
      mp: pState.mp || 200,
      maxMp: pState.maxMp || 200,
      atk: pState.atk || 75,
      def: pState.def || 40,
      name: pState.name || 'Herói',
      sprite: this.getSprite(pState.atlasJsonUrl, pState.atlasWebpUrl, pState.thumbUrl),
      groundOffsetY: pState.groundOffsetY || 0,
      isAttacking: false,
      attackTimer: 0,
      isDashing: false,
      dashTimer: 0,
      hitTimer: 0,
    };

    // Configura os Monstros espalhados na arena
    const mStates = Array.isArray(battleState.monsters) ? battleState.monsters : [];
    this.monsters = mStates.map((m, idx) => {
      const angle = (idx / Math.max(1, mStates.length)) * Math.PI - Math.PI / 2;
      return {
        id: m.id || `mob_${idx}`,
        templateId: battleState.monsterTemplateId,
        name: m.name || `Monstro #${idx + 1}`,
        x: cw * 0.68 + Math.cos(angle) * (cw * 0.12),
        y: ch * 0.50 + Math.sin(angle) * (ch * 0.22),
        dir: 2, // Olhando para o jogador
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
      };
    });

    this.floatingTexts = [];
    this.updateHud();

    this.lastFrameTime = performance.now();
    cancelAnimationFrame(this.animFrameId);
    this.loop = this.loop.bind(this);
    this.animFrameId = requestAnimationFrame(this.loop);
  }

  closeArena() {
    this.isActive = false;
    cancelAnimationFrame(this.animFrameId);
    const modal = document.getElementById('actionCombatModal');
    if (modal) modal.style.display = 'none';

    // Trégua de 5 segundos no mapa após combate para evitar encontros imediatos
    if (this.client) {
      this.client.encounterCooldownUntil = performance.now() + 5000;
    }
  }

  fleeBattle() {
    if (!this.isActive) return;
    this.showResult(false, 'Você fugiu da batalha com segurança e retornou ao mapa.', true);
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

    // Overlays de Cooldown
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

  triggerAttack() {
    if (!this.isActive || !this.player || !this.player.isAlive || this.player.isAttacking) return;
    const now = performance.now();
    if (now < this.skillCooldowns.attack) return;
    this.skillCooldowns.attack = now + 320;

    this.player.isAttacking = true;
    this.player.attackTimer = 0.32;
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

        mob.hp = Math.max(0, mob.hp - dmg);
        mob.hitTimer = 0.22;
        mob.action = 5; // Hit
        if (dist > 0) {
          mob.x += (dx / dist) * 20;
          mob.y += (dy / dist) * 20;
        }

        this.floatingTexts.push({
          x: mob.x,
          y: mob.y - 45,
          text: isCrit ? `💥 CRÍTICO! -${dmg}` : `-${dmg}`,
          color: isCrit ? '#fde047' : '#f87171',
          life: 1.0,
        });

        if (mob.hp === 0) {
          mob.isAlive = false;
          mob.action = 6; // Morte
        }
      }
    }
    this.updateHud();
    this.checkVictoryCondition();
  }

  triggerSkill(skillNum) {
    if (!this.isActive || !this.player || !this.player.isAlive) return;
    const now = performance.now();

    if (skillNum === 1) {
      // Turbilhão Arcana (AoE 360°)
      if (now < this.skillCooldowns.skill1 || this.player.mp < 20) return;
      this.skillCooldowns.skill1 = now + 4000;
      this.player.mp = Math.max(0, this.player.mp - 20);
      this.player.action = 7; // Cast / Skill
      this.player.attackTimer = 0.40;

      const aoeRadius = 140;
      for (const mob of this.monsters) {
        if (!mob.isAlive) continue;
        const dist = Math.hypot(mob.x - this.player.x, mob.y - this.player.y);
        if (dist <= aoeRadius) {
          const dmg = Math.round(this.player.atk * 1.9);
          mob.hp = Math.max(0, mob.hp - dmg);
          mob.hitTimer = 0.3;
          mob.action = 5;
          this.floatingTexts.push({
            x: mob.x,
            y: mob.y - 50,
            text: `🌪️ -${dmg}`,
            color: '#a78bfa',
            life: 1.2,
          });
          if (mob.hp === 0) {
            mob.isAlive = false;
            mob.action = 6;
          }
        }
      }
      this.updateHud();
      this.checkVictoryCondition();
    } else if (skillNum === 2) {
      // Raio Elemental Perfurante
      if (now < this.skillCooldowns.skill2 || this.player.mp < 35) return;
      this.skillCooldowns.skill2 = now + 6000;
      this.player.mp = Math.max(0, this.player.mp - 35);
      this.player.action = 7;
      this.player.attackTimer = 0.45;

      for (const mob of this.monsters) {
        if (!mob.isAlive) continue;
        const dist = Math.hypot(mob.x - this.player.x, mob.y - this.player.y);
        if (dist <= 180) {
          const dmg = Math.round(this.player.atk * 2.35);
          mob.hp = Math.max(0, mob.hp - dmg);
          mob.hitTimer = 0.35;
          mob.action = 5;
          this.floatingTexts.push({
            x: mob.x,
            y: mob.y - 50,
            text: `⚡ -${dmg}`,
            color: '#38bdf8',
            life: 1.2,
          });
          if (mob.hp === 0) {
            mob.isAlive = false;
            mob.action = 6;
          }
        }
      }
      this.updateHud();
      this.checkVictoryCondition();
    }
  }

  triggerDash() {
    if (!this.isActive || !this.player || !this.player.isAlive || this.player.isDashing) return;
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
      this.showResult(true, `Você derrotou todos os monstros da arena!<br><br>✨ <strong>+${expGained} EXP</strong> &bull; 🪙 <strong>+${goldGained} Ouro</strong>`);
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
    const rad = Math.atan2(dy, dx);
    let deg = (rad * 180) / Math.PI;
    if (deg < 0) deg += 360;
    return Math.floor((deg + 22.5) / 45) % 8;
  }

  loop(now) {
    if (!this.isActive) return;
    const dt = Math.min(0.1, (now - this.lastFrameTime) / 1000);
    this.lastFrameTime = now;

    this.updatePhysics(dt, now);
    this.renderCanvas(now);
    this.updateHud();

    this.animFrameId = requestAnimationFrame(this.loop);
  }

  updatePhysics(dt, now) {
    const canvas = document.getElementById('actionBattleCanvas');
    if (!canvas || !this.player || !this.player.isAlive) return;

    const cw = canvas.width;
    const ch = canvas.height;
    const centerX = cw * 0.50;
    const centerY = ch * 0.52;
    const arenaRadiusX = cw * 0.42;
    const arenaRadiusY = ch * 0.38;

    // 1. Movimento do Jogador
    let vx = 0;
    let vy = 0;

    if (this.keysDown.has('w') || this.keysDown.has('arrowup')) vy -= 1;
    if (this.keysDown.has('s') || this.keysDown.has('arrowdown')) vy += 1;
    if (this.keysDown.has('a') || this.keysDown.has('arrowleft')) vx -= 1;
    if (this.keysDown.has('d') || this.keysDown.has('arrowright')) vx += 1;

    if (this.joystickActive && (this.joystickVector.x !== 0 || this.joystickVector.y !== 0)) {
      vx = this.joystickVector.x;
      vy = this.joystickVector.y;
    } else if (vx !== 0 || vy !== 0) {
      const len = Math.hypot(vx, vy);
      vx /= len;
      vy /= len;
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
      this.player.x += vx * curSpeed * dt;
      this.player.y += vy * curSpeed * dt;
      this.player.dir = this.compute8Direction(vx, vy);
      if (!this.player.isAttacking) {
        this.player.action = 1; // Correndo
      }
    } else if (!this.player.isAttacking && this.player.hitTimer <= 0) {
      this.player.action = 0; // Parado
    }

    // Clamping do Jogador na elipse da arena
    const pNormX = (this.player.x - centerX) / arenaRadiusX;
    const pNormY = (this.player.y - centerY) / arenaRadiusY;
    const pDistSq = pNormX * pNormX + pNormY * pNormY;
    if (pDistSq > 1) {
      const scale = 1 / Math.sqrt(pDistSq);
      this.player.x = centerX + (this.player.x - centerX) * scale;
      this.player.y = centerY + (this.player.y - centerY) * scale;
    }

    // 2. IA dos Monstros
    for (const mob of this.monsters) {
      if (!mob.isAlive) {
        mob.fadeAlpha = Math.max(0, mob.fadeAlpha - dt * 1.5);
        continue;
      }

      if (mob.hitTimer > 0) {
        mob.hitTimer -= dt;
        continue;
      }
      if (mob.attackTimer > 0) {
        mob.attackTimer -= dt;
        continue;
      }

      const mdx = this.player.x - mob.x;
      const mdy = this.player.y - mob.y;
      const mDist = Math.hypot(mdx, mdy);

      if (mDist > mob.attackRange) {
        mob.x += (mdx / mDist) * mob.speed * dt;
        mob.y += (mdy / mDist) * mob.speed * dt;
        mob.dir = this.compute8Direction(mdx, mdy);
        mob.action = 1; // Correndo
      } else {
        mob.action = 0;
        if (now >= mob.nextAttackTime) {
          mob.nextAttackTime = now + 1800 + Math.random() * 800;
          mob.attackTimer = 0.40;
          mob.action = 3; // Ataque

          if (!this.player.isDashing) {
            const dmg = Math.max(5, Math.round(mob.atk * (100 / (100 + this.player.def * 0.5))));
            this.player.hp = Math.max(0, this.player.hp - dmg);
            this.player.hitTimer = 0.22;
            this.player.action = 5; // Hit

            this.floatingTexts.push({
              x: this.player.x,
              y: this.player.y - 45,
              text: `💔 -${dmg}`,
              color: '#ef4444',
              life: 1.0,
            });

            if (this.player.hp === 0) {
              this.player.isAlive = false;
              this.player.action = 6; // Morte
              this.showResult(false, 'Você foi derrotado pelos monstros na arena.');
              break;
            }
          }
        }
      }

      // Clamping do Monstro na elipse
      const mNormX = (mob.x - centerX) / arenaRadiusX;
      const mNormY = (mob.y - centerY) / arenaRadiusY;
      const mDistSq = mNormX * mNormX + mNormY * mNormY;
      if (mDistSq > 1) {
        const scale = 1 / Math.sqrt(mDistSq);
        mob.x = centerX + (mob.x - centerX) * scale;
        mob.y = centerY + (mob.y - centerY) * scale;
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

  renderCanvas(now) {
    const canvas = document.getElementById('actionBattleCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cw = canvas.width;
    const ch = canvas.height;
    const centerX = cw * 0.50;
    const centerY = ch * 0.52;
    const arenaRadiusX = cw * 0.42;
    const arenaRadiusY = ch * 0.38;

    ctx.clearRect(0, 0, cw, ch);

    // 1. Chão e Barreira Mística 2.5D
    const bgGrad = ctx.createRadialGradient(centerX, centerY, 40, centerX, centerY, Math.max(cw, ch) * 0.6);
    bgGrad.addColorStop(0, '#1e1b4b');
    bgGrad.addColorStop(0.65, '#090d16');
    bgGrad.addColorStop(1, '#020617');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, cw, ch);

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, arenaRadiusX, arenaRadiusY, 0, 0, Math.PI * 2);
    const floorGrad = ctx.createRadialGradient(centerX, centerY, 20, centerX, centerY, arenaRadiusX);
    floorGrad.addColorStop(0, 'rgba(56, 189, 248, 0.20)');
    floorGrad.addColorStop(0.75, 'rgba(15, 23, 42, 0.65)');
    floorGrad.addColorStop(1, 'rgba(2, 6, 23, 0.90)');
    ctx.fillStyle = floorGrad;
    ctx.fill();

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.restore();

    // 2. Y-Sorting para Profundidade
    const units = [];
    if (this.player) {
      units.push({
        isPlayer: true,
        x: this.player.x,
        y: this.player.y,
        dir: this.player.dir,
        action: this.player.action,
        sprite: this.player.sprite,
        groundOffsetY: this.player.groundOffsetY,
        alpha: 1.0,
      });
    }

    for (const mob of this.monsters) {
      if (mob.fadeAlpha <= 0) continue;
      units.push({
        isPlayer: false,
        x: mob.x,
        y: mob.y,
        dir: mob.dir,
        action: mob.action,
        sprite: mob.sprite,
        groundOffsetY: mob.groundOffsetY,
        alpha: mob.fadeAlpha,
        mobRef: mob,
      });
    }

    units.sort((a, b) => a.y - b.y);

    // 3. Renderiza Entidades
    for (const u of units) {
      ctx.save();
      ctx.globalAlpha = u.alpha;

      ctx.beginPath();
      ctx.ellipse(u.x, u.y, 24, 10, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fill();

      if (u.sprite) {
        u.sprite.draw(ctx, u.x, u.y, u.action, u.dir, now, null, u.groundOffsetY, 0.70);
      } else {
        ctx.beginPath();
        ctx.arc(u.x, u.y - 20, 18, 0, Math.PI * 2);
        ctx.fillStyle = u.isPlayer ? '#38bdf8' : '#ef4444';
        ctx.fill();
      }

      if (!u.isPlayer && u.mobRef && u.mobRef.isAlive) {
        const mob = u.mobRef;
        const bw = 46;
        const bh = 5;
        const bx = mob.x - bw / 2;
        const by = mob.y - 68;
        const hpFrac = Math.max(0, Math.min(1, mob.hp / mob.maxHp));

        ctx.fillStyle = 'rgba(2, 6, 23, 0.75)';
        ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(bx, by, bw * hpFrac, bh);

        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#f8fafc';
        ctx.fillText(mob.name, mob.x, by - 3);
      }

      ctx.restore();
    }

    // 4. Floating Texts
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
