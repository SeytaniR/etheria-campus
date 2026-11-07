/**
 * @file apps/server/public/play/js/TemporaryCombatArena.js
 * @module @etheria/server
 * @description MÓDULO TEMPORÁRIO DE ARENA 2.5D ANIMADA E COMBATE SIMULADO GM.
 *   Renderiza o Herói e os Monstros em um Canvas 2.5D interativo a 60 FPS usando `McreworkSpriteSheet`,
 *   executando as animações reais de batalha do atlas (Idle=0, Avanço=1, Ataque=3, Defesa=4, Dano/Hit=5, Morte=6, Skill=7),
 *   com coreografia de turno, barras de HP/MP em espaço 2.5D, seleção de alvo no Canvas e números flutuantes.
 *   AVISO: Módulo 100% isolado para fácil substituição futura quando a arena definitiva for implementada.
 */

class TemporaryCombatArena {
  constructor(client) {
    this.client = client;
    this.currentBattle = null;
    this.selectedTargetIndex = 0;
    this.isResolving = false;
    this.animFrameId = null;

    // Cache de McreworkSpriteSheet por chave de sprite
    this.spriteSheets = new Map();

    // Estado visual em tempo real das entidades no Canvas 2.5D
    this.visualUnits = {
      player: null,
      monsters: [],
    };

    // Efeitos visuais temporários no Canvas (números flutuantes, impactos, auras)
    this.floatingNumbers = [];
    this.impactEffects = [];

    this.injectStyles();
    this.injectModalDom();
  }

  injectStyles() {
    if (document.getElementById('temporaryCombatStyles')) return;
    const style = document.createElement('style');
    style.id = 'temporaryCombatStyles';
    style.textContent = `
      .arena-backdrop {
        position: fixed;
        inset: 0;
        z-index: 99999;
        background: rgba(2, 6, 23, 0.96);
        backdrop-filter: blur(8px);
        display: none;
        flex-direction: column;
        justify-content: space-between;
        padding: 10px;
        gap: 8px;
        box-sizing: border-box;
        user-select: none;
        font-family: system-ui, -apple-system, sans-serif;
      }
      .arena-canvas-wrapper {
        flex: 1;
        position: relative;
        overflow: hidden;
        background: radial-gradient(ellipse at 50% 65%, #1e1b4b 0%, #090d16 70%, #020617 100%);
        border: 1.5px solid #4f46e5;
        border-radius: 12px;
        box-shadow: inset 0 0 40px rgba(0,0,0,0.85);
        min-height: 240px;
      }
      #arenaBattleCanvas {
        width: 100%;
        height: 100%;
        display: block;
        cursor: pointer;
        touch-action: manipulation;
      }
      .arena-target-bar {
        position: absolute;
        bottom: 8px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        justify-content: center;
        z-index: 10;
        background: rgba(2, 6, 23, 0.82);
        padding: 4px 8px;
        border-radius: 999px;
        border: 1px solid #334155;
        max-width: 95%;
      }
      .arena-target-pill {
        font-size: 0.72rem;
        padding: 3px 9px;
        border-radius: 999px;
        border: 1px solid #475569;
        background: #0f172a;
        color: #e2e8f0;
        cursor: pointer;
        font-weight: 600;
        white-space: nowrap;
      }
      .arena-target-pill.active {
        border-color: #fde047;
        background: rgba(253, 224, 71, 0.18);
        color: #fde047;
        box-shadow: 0 0 10px rgba(253, 224, 71, 0.35);
      }
      .arena-target-pill.dead {
        opacity: 0.4;
        text-decoration: line-through;
        cursor: default;
      }
      .arena-bottom-panel {
        display: grid;
        grid-template-columns: 1.15fr 0.85fr;
        gap: 8px;
        min-height: 124px;
        max-height: 165px;
      }
      @media (max-width: 680px) {
        .arena-bottom-panel {
          grid-template-columns: 1fr;
          max-height: 210px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  injectModalDom() {
    if (document.getElementById('temporaryCombatModal')) return;

    const modal = document.createElement('div');
    modal.id = 'temporaryCombatModal';
    modal.className = 'arena-backdrop';
    modal.innerHTML = `
      <!-- Cabeçalho da Arena -->
      <div style="display:flex; justify-content:space-between; align-items:center; background:#0f172a; border:1px solid #334155; padding:7px 12px; border-radius:8px; flex-shrink:0;">
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <span style="font-size:1.1rem;">⚔️</span>
          <strong style="color:#f43f5e; font-size:0.9rem;">Arena Tática 2.5D (Simulador GM)</strong>
          <span id="arenaTurnStatusText" style="font-size:0.75rem; color:#fde047; background:rgba(253,224,71,0.12); border:1px solid rgba(253,224,71,0.4); padding:2px 8px; border-radius:99px; font-weight:700;">
            🎯 Sua Vez — Escolha uma Ação
          </span>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <span id="arenaRoundBadge" style="background:#1e1b4b; color:#c084fc; font-weight:700; padding:3px 10px; border-radius:99px; font-size:0.78rem; border:1px solid #c084fc;">
            Rodada 1
          </span>
          <button class="btn-danger" onclick="PlayApp.combatArena.closeArena()" style="padding:4px 10px; font-size:0.78rem;">
            ✕ Sair
          </button>
        </div>
      </div>

      <!-- Palco de Batalha Canvas 2.5D Real -->
      <div class="arena-canvas-wrapper" id="arenaCanvasWrapper">
        <canvas id="arenaBattleCanvas"></canvas>
        <!-- Barra Rápida de Seleção de Alvo -->
        <div id="arenaTargetPillsBar" class="arena-target-bar"></div>
      </div>

      <!-- Painel Inferior: Comandos de Batalha & Log Tático -->
      <div class="arena-bottom-panel">
        <div style="display:flex; flex-direction:column; gap:6px; background:#0f172a; border:1px solid #334155; padding:8px 10px; border-radius:8px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong style="font-size:0.76rem; color:#94a3b8;">Ações de Combate 2.5D:</strong>
            <span style="font-size:0.7rem; color:#fde047;">Toque em um monstro na arena para mirar</span>
          </div>
          <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:6px; flex:1;">
            <button id="btnArenaAttack" class="btn-primary" onclick="PlayApp.combatArena.performAction('ATTACK')" style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; font-weight:700; font-size:0.78rem; padding:6px 4px;">
              <span style="font-size:1.05rem;">🗡️</span>
              <span>Ataque</span>
            </button>
            <button id="btnArenaSkill" onclick="PlayApp.combatArena.performAction('SKILL')" style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; font-weight:700; font-size:0.78rem; padding:6px 4px; background:linear-gradient(135deg, #7c3aed, #9333ea); border-color:#a855f7; color:#fff;">
              <span style="font-size:1.05rem;">🔥</span>
              <span>Skill (15 MP)</span>
            </button>
            <button id="btnArenaDefend" onclick="PlayApp.combatArena.performAction('DEFEND')" style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; font-weight:700; font-size:0.78rem; padding:6px 4px; background:#334155; color:#e2e8f0;">
              <span style="font-size:1.05rem;">🛡️</span>
              <span>Defender</span>
            </button>
            <button id="btnArenaAuto" onclick="PlayApp.combatArena.autoResolveBattle()" style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; font-weight:700; font-size:0.78rem; padding:6px 4px; background:linear-gradient(135deg, #059669, #10b981); border-color:#34d399; color:#fff;">
              <span style="font-size:1.05rem;">⏩</span>
              <span>Auto-Luta</span>
            </button>
          </div>
        </div>

        <!-- Registro de Combate -->
        <div style="display:flex; flex-direction:column; background:#020617; border:1px solid #1e293b; padding:7px 10px; border-radius:8px; overflow:hidden; max-height:125px;">
          <strong style="font-size:0.73rem; color:#94a3b8; margin-bottom:3px;">📜 Log de Batalha:</strong>
          <div id="arenaCombatLog" style="flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:3px; font-size:0.71rem; line-height:1.35; color:#cbd5e1; font-family:monospace;"></div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const canvas = document.getElementById('arenaBattleCanvas');
    if (canvas) {
      canvas.addEventListener('pointerdown', (ev) => this.handleCanvasClick(ev));
    }
  }

  getOrCreateSpriteSheet(unit) {
    const key = unit.atlasJsonUrl || unit.spriteKey || unit.thumbUrl;
    if (this.spriteSheets.has(key)) {
      return this.spriteSheets.get(key);
    }
    const sheet = new window.McreworkSpriteSheet(unit.atlasJsonUrl, unit.atlasWebpUrl, unit.thumbUrl);
    sheet.load();
    this.spriteSheets.set(key, sheet);
    return sheet;
  }

  openArena(battleState) {
    // Remove banner de vitória/derrota anterior se existir
    const oldBanner = document.getElementById('arenaResultOverlayBanner');
    if (oldBanner) oldBanner.remove();

    this.currentBattle = battleState;
    this.selectedTargetIndex = 0;
    this.isResolving = false;
    this.floatingNumbers = [];
    this.impactEffects = [];

    document.getElementById('temporaryCombatModal').style.display = 'flex';

    this.setupVisualUnitsFromState(battleState);
    this.renderUiControls();
    this.startCanvasLoop();
  }

  closeArena() {
    document.getElementById('temporaryCombatModal').style.display = 'none';
    this.currentBattle = null;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  /**
   * Inicializa e sincroniza as unidades visuais 2.5D com o estado da batalha.
   * Direções do mcrework: 2 = Leste (Direita), 6 = Oeste (Esquerda).
   */
  setupVisualUnitsFromState(b) {
    const now = performance.now();
    const p = b.player;
    this.visualUnits.player = {
      ...p,
      displayHp: p.hp,
      displayMp: p.mp,
      sheet: this.getOrCreateSpriteSheet(p),
      action: p.isAlive ? 0 : 6,
      dir: 2, // Olhando para a direita (para os monstros)
      animStartTime: now,
      clampLastFrame: !p.isAlive,
      offsetX: 0,
      offsetY: 0,
      homeX: 0,
      homeY: 0,
      isGuardActive: false,
    };

    this.visualUnits.monsters = b.monsters.map((m, idx) => ({
      ...m,
      displayHp: m.hp,
      sheet: this.getOrCreateSpriteSheet(m),
      action: m.isAlive ? 0 : 6,
      dir: 6, // Olhando para a esquerda (para o jogador)
      animStartTime: now + idx * 170, // Desfasa levemente a respiração dos monstros para realismo
      clampLastFrame: !m.isAlive,
      offsetX: 0,
      offsetY: 0,
      homeX: 0,
      homeY: 0,
    }));
  }

  /**
   * Calcula as coordenadas 2.5D de formação no Canvas responsivo.
   */
  computeFormationPositions(w, h) {
    if (this.visualUnits.player) {
      this.visualUnits.player.homeX = Math.round(w * 0.22);
      this.visualUnits.player.homeY = Math.round(h * 0.64);
    }

    const mobs = this.visualUnits.monsters || [];
    const count = mobs.length;

    // Formação tática escalonada em profundidade 2.5D para 1 a 5 monstros
    const presets = {
      1: [{ rx: 0.75, ry: 0.62 }],
      2: [
        { rx: 0.71, ry: 0.50 },
        { rx: 0.78, ry: 0.74 },
      ],
      3: [
        { rx: 0.76, ry: 0.44 },
        { rx: 0.68, ry: 0.62 },
        { rx: 0.78, ry: 0.80 },
      ],
      4: [
        { rx: 0.72, ry: 0.39 },
        { rx: 0.81, ry: 0.52 },
        { rx: 0.69, ry: 0.68 },
        { rx: 0.79, ry: 0.83 },
      ],
      5: [
        { rx: 0.75, ry: 0.36 },
        { rx: 0.66, ry: 0.50 },
        { rx: 0.82, ry: 0.57 },
        { rx: 0.69, ry: 0.72 },
        { rx: 0.80, ry: 0.85 },
      ],
    };

    const layout = presets[count] || presets[5];
    mobs.forEach((m, i) => {
      const slot = layout[i] || { rx: 0.75, ry: 0.5 + i * 0.1 };
      m.homeX = Math.round(w * slot.rx);
      m.homeY = Math.round(h * slot.ry);
    });
  }

  startCanvasLoop() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }

    const renderFrame = (now) => {
      const modal = document.getElementById('temporaryCombatModal');
      if (!modal || modal.style.display === 'none' || !this.currentBattle) {
        this.animFrameId = null;
        return;
      }

      const canvas = document.getElementById('arenaBattleCanvas');
      const wrapper = document.getElementById('arenaCanvasWrapper');
      if (canvas && wrapper) {
        const rect = wrapper.getBoundingClientRect();
        const cw = Math.max(320, Math.floor(rect.width));
        const ch = Math.max(240, Math.floor(rect.height));
        if (canvas.width !== cw || canvas.height !== ch) {
          canvas.width = cw;
          canvas.height = ch;
        }

        this.computeFormationPositions(cw, ch);
        const ctx = canvas.getContext('2d');
        this.drawBattlefield25D(ctx, cw, ch, now);
      }

      this.animFrameId = requestAnimationFrame(renderFrame);
    };

    this.animFrameId = requestAnimationFrame(renderFrame);
  }

  /**
   * Desenha o cenário tático 2.5D, plataformas isométricas, modelos animados do mcrework,
   * barras de vida/mana, indicadores de alvo e números de dano flutuantes.
   */
  drawBattlefield25D(ctx, w, h, now) {
    ctx.clearRect(0, 0, w, h);

    // 1. Grade de piso isométrico 2.5D sutil para percepção de profundidade
    ctx.save();
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.12)';
    ctx.lineWidth = 1;
    const horizonY = Math.round(h * 0.22);

    // Linhas horizontais de perspectiva
    for (let y = horizonY; y < h; y += Math.max(22, Math.round((y - horizonY) * 0.25 + 16))) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    // Linhas diagonais convergentes ao centro do horizonte
    const centerX = w / 2;
    for (let x = -w * 0.5; x <= w * 1.5; x += Math.round(w * 0.14)) {
      ctx.beginPath();
      ctx.moveTo(centerX + (x - centerX) * 0.35, horizonY);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    ctx.restore();

    const pUnit = this.visualUnits.player;
    const mobUnits = this.visualUnits.monsters || [];

    // 2. Desenha plataformas táticas nos pés de cada unidade
    if (pUnit) {
      this.drawTacticalPad(ctx, pUnit.homeX, pUnit.homeY, '#38bdf8', false, pUnit.isAlive, now);
    }
    for (const m of mobUnits) {
      const isTarget = m.index === this.selectedTargetIndex && m.isAlive;
      this.drawTacticalPad(ctx, m.homeX, m.homeY, isTarget ? '#fde047' : '#f43f5e', isTarget, m.isAlive, now);
    }

    // 3. Ordena todas as unidades por coordenada Y atual (Depth Sorting 2.5D real)
    const renderList = [];
    if (pUnit) {
      renderList.push({ type: 'player', unit: pUnit, x: pUnit.homeX + pUnit.offsetX, y: pUnit.homeY + pUnit.offsetY });
    }
    for (const m of mobUnits) {
      renderList.push({ type: 'monster', unit: m, x: m.homeX + m.offsetX, y: m.homeY + m.offsetY });
    }
    renderList.sort((a, b) => a.y - b.y);

    // Escala responsiva dos modelos 2.5D na Arena (maior que no mundo aberto para destaque visual)
    const arenaScale = w < 520 ? 0.82 : 0.98;

    // 4. Desenha cada modelo 2.5D com sua animação ativa (Idle, Walk, Attack, Hit, Die, Skill)
    for (const item of renderList) {
      const u = item.unit;
      const elapsed = Math.max(0, now - (u.animStartTime || 0));

      if (u.sheet) {
        u.sheet.draw(
          ctx,
          item.x,
          item.y,
          u.action,
          u.dir,
          elapsed,
          u.isAlive ? 1.0 : 0.55,
          u.groundOffsetY || 0,
          arenaScale,
          Boolean(u.clampLastFrame)
        );
      }

      // Escudo energético se o Herói estiver em Postura de Defesa
      if (item.type === 'player' && u.isGuardActive && u.isAlive) {
        ctx.save();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
        ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(item.x, item.y - 36 * arenaScale, 34 * arenaScale, 46 * arenaScale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // 5. Desenha HUD flutuante (Nome, Nível, Barra de HP/MP e Marcador de Alvo) acima da unidade
      this.drawUnitOverlayHud(ctx, item.type, u, item.x, item.y, arenaScale, now);
    }

    // 6. Desenha efeitos de impacto (cortes, explosões de skill)
    this.drawImpactEffects(ctx, now);

    // 7. Desenha números de combate flutuantes (Dano, Crítico, Cura)
    this.drawFloatingNumbers(ctx, now);
  }

  drawTacticalPad(ctx, x, y, colorHex, isSelectedTarget, isAlive, now) {
    ctx.save();
    const pulse = isSelectedTarget ? 1 + Math.sin(now / 140) * 0.12 : 1;
    const rx = Math.round(32 * pulse);
    const ry = Math.round(14 * pulse);

    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = isAlive ? 'rgba(15, 23, 42, 0.65)' : 'rgba(15, 23, 42, 0.3)';
    ctx.fill();
    ctx.lineWidth = isSelectedTarget ? 2.5 : 1.5;
    ctx.strokeStyle = isAlive ? colorHex : '#475569';
    ctx.stroke();

    if (isSelectedTarget && isAlive) {
      ctx.beginPath();
      ctx.ellipse(x, y, rx + 6, ry + 3, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(253, 224, 71, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();
  }

  drawUnitOverlayHud(ctx, type, u, x, y, scale, now) {
    ctx.save();
    const headY = Math.round(y - 88 * scale);
    const barW = type === 'player' ? 86 : 74;
    const barH = type === 'player' ? 7 : 6;
    const barX = Math.round(x - barW / 2);

    // Indicador de Alvo Selecionado
    const isTarget = type === 'monster' && u.index === this.selectedTargetIndex && u.isAlive;
    if (isTarget) {
      const bounce = Math.sin(now / 150) * 3;
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fde047';
      ctx.fillText('🎯 ALVO', x, headY - 22 + bounce);
    }

    // Nome e Nível
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const labelText = `${u.name} (Nv.${u.level})`;
    ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
    ctx.fillText(labelText, x + 1, headY - 8);
    ctx.fillStyle = type === 'player' ? '#fde047' : isTarget ? '#fef08a' : '#f8fafc';
    ctx.fillText(labelText, x, headY - 9);

    // Barra de HP
    const hpRatio = Math.max(0, Math.min(1, (u.displayHp ?? u.hp) / Math.max(1, u.maxHp)));
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(barX, headY - 4, barW, barH);
    ctx.fillStyle = hpRatio > 0.45 ? '#22c55e' : hpRatio > 0.2 ? '#eab308' : '#ef4444';
    ctx.fillRect(barX, headY - 4, Math.round(barW * hpRatio), barH);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, headY - 4, barW, barH);

    // Texto numérico do HP
    ctx.font = '600 9px monospace';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(`${Math.round(u.displayHp ?? u.hp)}/${u.maxHp}`, x, headY + barH + 6);

    // Barra de MP para o Jogador
    if (type === 'player') {
      const mpRatio = Math.max(0, Math.min(1, (u.displayMp ?? u.mp) / Math.max(1, u.maxMp)));
      const mpY = headY + barH + 9;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(barX, mpY, barW, 5);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(barX, mpY, Math.round(barW * mpRatio), 5);
    }

    ctx.restore();
  }

  drawImpactEffects(ctx, now) {
    this.impactEffects = this.impactEffects.filter((ef) => now - ef.startTime < ef.duration);
    for (const ef of this.impactEffects) {
      const progress = (now - ef.startTime) / ef.duration;
      const radius = ef.maxRadius * progress;
      const alpha = Math.max(0, 1 - progress);

      ctx.save();
      ctx.beginPath();
      ctx.arc(ef.x, ef.y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = ef.color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 4;
      ctx.stroke();

      // Linhas de corte diagonal se for golpe físico/crítico
      ctx.beginPath();
      ctx.moveTo(ef.x - 24 * progress, ef.y - 24 * progress);
      ctx.lineTo(ef.x + 24 * progress, ef.y + 24 * progress);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawFloatingNumbers(ctx, now) {
    this.floatingNumbers = this.floatingNumbers.filter((fn) => now - fn.startTime < fn.duration);
    for (const fn of this.floatingNumbers) {
      const progress = (now - fn.startTime) / fn.duration;
      const curY = fn.y - progress * 52;
      const alpha = progress < 0.75 ? 1 : 1 - (progress - 0.75) / 0.25;

      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.font = fn.isCrit ? '900 17px system-ui, sans-serif' : '800 14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#020617';
      ctx.fillText(fn.text, fn.x + 1.5, curY + 1.5);
      ctx.fillStyle = fn.color;
      ctx.fillText(fn.text, fn.x, curY);
      ctx.restore();
    }
  }

  spawnFloatingNumber(x, y, text, color, isCrit = false) {
    this.floatingNumbers.push({
      x,
      y: y - 55,
      text,
      color,
      isCrit,
      startTime: performance.now(),
      duration: 1150,
    });
  }

  spawnImpactEffect(x, y, color = '#fde047', maxRadius = 42) {
    this.impactEffects.push({
      x,
      y: y - 35,
      color,
      maxRadius,
      startTime: performance.now(),
      duration: 360,
    });
  }

  /**
   * Permite clicar ou tocar diretamente sobre um monstro no Canvas 2.5D para selecioná-lo como alvo.
   */
  handleCanvasClick(ev) {
    if (!this.currentBattle || this.isResolving) return;
    const canvas = document.getElementById('arenaBattleCanvas');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = ((ev.clientX - rect.left) / rect.width) * canvas.width;
    const clickY = ((ev.clientY - rect.top) / rect.height) * canvas.height;

    let bestMob = null;
    let bestDist = 75; // Raio de toque confortável em torno do modelo 2.5D

    for (const m of this.visualUnits.monsters) {
      if (!m.isAlive) continue;
      const centerX = m.homeX;
      const centerY = m.homeY - 35;
      const dist = Math.hypot(clickX - centerX, clickY - centerY);
      if (dist < bestDist) {
        bestDist = dist;
        bestMob = m;
      }
    }

    if (bestMob) {
      this.selectTarget(bestMob.index);
    }
  }

  selectTarget(index) {
    const mob = this.currentBattle?.monsters.find((m) => m.index === index && m.isAlive);
    if (mob) {
      this.selectedTargetIndex = index;
      this.renderUiControls();
    }
  }

  setButtonsDisabled(disabled, statusText = null) {
    ['btnArenaAttack', 'btnArenaSkill', 'btnArenaDefend', 'btnArenaAuto'].forEach((id) => {
      const btn = document.getElementById(id);
      if (btn) btn.disabled = disabled;
    });
    const badge = document.getElementById('arenaTurnStatusText');
    if (badge && statusText) {
      badge.textContent = statusText;
    }
  }

  renderUiControls() {
    if (!this.currentBattle) return;
    const b = this.currentBattle;

    const roundEl = document.getElementById('arenaRoundBadge');
    if (roundEl) roundEl.textContent = `Rodada ${b.round}`;

    // Renderiza pílulas rápidas de alvo
    const pillsBar = document.getElementById('arenaTargetPillsBar');
    if (pillsBar) {
      pillsBar.innerHTML = b.monsters
        .map((m) => {
          const isSel = m.index === this.selectedTargetIndex && m.isAlive;
          return `
            <button type="button" class="arena-target-pill ${isSel ? 'active' : ''} ${!m.isAlive ? 'dead' : ''}" onclick="PlayApp.combatArena.selectTarget(${m.index})">
              ${isSel ? '🎯 ' : ''}${m.name} (${m.hp} HP)
            </button>`;
        })
        .join('');
    }

    // Atualiza Log de Combate
    const logContainer = document.getElementById('arenaCombatLog');
    if (logContainer) {
      logContainer.innerHTML = b.combatLog
        .map((line) => `<div style="padding:2px 0; border-bottom:1px solid rgba(255,255,255,0.06);">${line}</div>`)
        .join('');
    }
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Anima suavemente o deslocamento de uma unidade (`offsetX`, `offsetY`) no Canvas 2.5D.
   */
  animateUnitMove(vUnit, toOffsetX, toOffsetY, durationMs) {
    return new Promise((resolve) => {
      const startX = vUnit.offsetX;
      const startY = vUnit.offsetY;
      const startTime = performance.now();

      const step = (now) => {
        const t = Math.min(1, (now - startTime) / Math.max(1, durationMs));
        vUnit.offsetX = startX + (toOffsetX - startX) * t;
        vUnit.offsetY = startY + (toOffsetY - startY) * t;
        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          resolve();
        }
      };
      requestAnimationFrame(step);
    });
  }

  /**
   * Executa a coreografia sequencial 2.5D das animações do turno (Avanço -> Golpe/Skill -> Reação de Dano/Morte -> Retorno).
   */
  async playTurnChoreography(events, nextState) {
    const vPlayer = this.visualUnits.player;
    if (!vPlayer) return;

    vPlayer.isGuardActive = false;

    for (const ev of events) {
      if (ev.actor === 'player') {
        if (ev.animAction === 4 || ev.type === 'HEAL') {
          // Postura Defensiva (action = 4) + Cura
          this.setButtonsDisabled(true, `🛡️ ${vPlayer.name} assumiu Postura Defensiva!`);
          vPlayer.action = 4;
          vPlayer.dir = 2;
          vPlayer.animStartTime = performance.now();
          vPlayer.isGuardActive = true;
          vPlayer.displayHp = ev.hpRemaining;
          vPlayer.displayMp = nextState.player.mp;
          this.spawnImpactEffect(vPlayer.homeX, vPlayer.homeY, '#38bdf8', 48);
          this.spawnFloatingNumber(vPlayer.homeX, vPlayer.homeY, `💚 +${ev.amount} HP`, '#86efac', false);
          await this.sleep(550);
          vPlayer.action = 0;
        } else {
          // Ataque Físico (action = 3) ou Skill Especial (action = 7)
          const vTarget = this.visualUnits.monsters.find((m) => m.index === ev.targetIndex);
          if (vTarget) {
            const isSkill = ev.animAction === 7;
            this.setButtonsDisabled(
              true,
              isSkill ? `🔥 ${vPlayer.name} conjura Habilidade Especial!` : `🗡️ ${vPlayer.name} avança para atacar!`
            );

            // 1. Corre até a frente do monstro alvo (action = 1)
            const targetOffX = vTarget.homeX - 58 - vPlayer.homeX;
            const targetOffY = vTarget.homeY - vPlayer.homeY;
            vPlayer.action = 1;
            vPlayer.dir = 2;
            vPlayer.animStartTime = performance.now();
            await this.animateUnitMove(vPlayer, isSkill ? targetOffX * 0.45 : targetOffX, isSkill ? targetOffY * 0.45 : targetOffY, 240);

            // 2. Executa animação de Ataque (3) ou Skill (7)
            vPlayer.action = isSkill ? 7 : 3;
            vPlayer.dir = 2;
            vPlayer.animStartTime = performance.now();
            vPlayer.displayMp = nextState.player.mp;

            if (isSkill) {
              this.spawnImpactEffect(vPlayer.homeX + vPlayer.offsetX, vPlayer.homeY + vPlayer.offsetY, '#c084fc', 50);
            }

            await this.sleep(280);

            // 3. Impacto no monstro: monstro executa animação de Dano/Hit (5) ou Morte (6)
            this.spawnImpactEffect(vTarget.homeX, vTarget.homeY, isSkill ? '#a855f7' : '#fde047', isSkill ? 58 : 42);
            this.spawnFloatingNumber(
              vTarget.homeX,
              vTarget.homeY,
              ev.isCrit ? `💥 CRÍTICO! -${ev.amount}` : `-${ev.amount}`,
              ev.isCrit ? '#fde047' : '#f87171',
              Boolean(ev.isCrit)
            );

            vTarget.displayHp = ev.hpRemaining;
            vTarget.hp = ev.hpRemaining;
            if (ev.hpRemaining <= 0) {
              vTarget.isAlive = false;
              vTarget.action = 6; // Animação de Morte (6)
              vTarget.clampLastFrame = true;
              vTarget.animStartTime = performance.now();
            } else {
              vTarget.action = 5; // Animação de Tomando Dano/Hit (5)
              vTarget.animStartTime = performance.now();
            }

            await this.sleep(380);

            if (vTarget.isAlive) {
              vTarget.action = 0;
              vTarget.animStartTime = performance.now();
            }

            // 4. Herói retorna ao seu posto
            vPlayer.action = 1;
            vPlayer.dir = 6;
            await this.animateUnitMove(vPlayer, 0, 0, 210);
            vPlayer.dir = 2;
            vPlayer.action = 0;
            vPlayer.animStartTime = performance.now();
          }
        }
      } else if (ev.actor === 'monster') {
        const vMob = this.visualUnits.monsters.find((m) => m.index === ev.actorIndex);
        if (vMob && vMob.isAlive) {
          this.setButtonsDisabled(true, `👾 ${vMob.name} contra-ataca!`);

          // 1. Monstro avança até o Herói (action = 1, dir = 6)
          const targetOffX = vPlayer.homeX + 58 - vMob.homeX;
          const targetOffY = vPlayer.homeY - vMob.homeY;
          vMob.action = 1;
          vMob.dir = 6;
          vMob.animStartTime = performance.now();
          await this.animateUnitMove(vMob, targetOffX, targetOffY, 230);

          // 2. Monstro executa animação de Ataque (action = 3)
          vMob.action = 3;
          vMob.dir = 6;
          vMob.animStartTime = performance.now();
          await this.sleep(260);

          // 3. Impacto no Herói: Herói executa animação de Dano/Hit (5), Defesa (4) ou Morte (6)
          this.spawnImpactEffect(vPlayer.homeX, vPlayer.homeY, '#ef4444', 40);
          this.spawnFloatingNumber(
            vPlayer.homeX,
            vPlayer.homeY,
            ev.isCrit ? `💥 CRÍTICO! -${ev.amount}` : `-${ev.amount}`,
            ev.isCrit ? '#fde047' : '#f87171',
            Boolean(ev.isCrit)
          );

          vPlayer.displayHp = ev.hpRemaining;
          vPlayer.hp = ev.hpRemaining;
          if (ev.hpRemaining <= 0) {
            vPlayer.isAlive = false;
            vPlayer.action = 6; // Animação de Morte (6)
            vPlayer.clampLastFrame = true;
            vPlayer.animStartTime = performance.now();
          } else {
            vPlayer.action = vPlayer.isGuardActive ? 4 : 5;
            vPlayer.animStartTime = performance.now();
          }

          await this.sleep(360);

          if (vPlayer.isAlive) {
            vPlayer.action = 0;
            vPlayer.animStartTime = performance.now();
          }

          // 4. Monstro retorna ao seu slot na formação
          vMob.action = 1;
          vMob.dir = 2;
          await this.animateUnitMove(vMob, 0, 0, 200);
          vMob.dir = 6;
          vMob.action = 0;
          vMob.animStartTime = performance.now();
        }
      }
    }
  }

  async performAction(actionType) {
    if (!this.currentBattle || this.currentBattle.isFinished || this.isResolving) return;

    try {
      this.isResolving = true;
      this.setButtonsDisabled(true, '⏳ Executando turno...');

      const res = await this.client.api('/api/play/temporary-combat/action', {
        method: 'POST',
        body: JSON.stringify({
          battleId: this.currentBattle.battleId,
          actionType,
          targetMonsterIndex: this.selectedTargetIndex,
        }),
      });

      this.currentBattle = res;

      // Executa toda a coreografia 2.5D animada no Canvas antes de liberar o próximo turno
      await this.playTurnChoreography(res.lastEvents || [], res);

      // Auto-seleciona próximo monstro vivo se o alvo atual foi derrotado
      const curTarget = res.monsters.find((m) => m.index === this.selectedTargetIndex && m.isAlive);
      if (!curTarget) {
        const nextAlive = res.monsters.find((m) => m.isAlive);
        if (nextAlive) this.selectedTargetIndex = nextAlive.index;
      }

      this.renderUiControls();

      if (res.isFinished) {
        this.setButtonsDisabled(true, res.winner === 'PLAYER' ? '🏆 Vitória!' : '💀 Derrota!');
        await this.sleep(450);
        this.showBattleResult(res);
      } else {
        this.setButtonsDisabled(false, '🎯 Sua Vez — Escolha uma Ação');
      }
    } catch (err) {
      alert(`Erro no turno de combate: ${err.message}`);
      this.setButtonsDisabled(false, '🎯 Sua Vez — Escolha uma Ação');
    } finally {
      this.isResolving = false;
    }
  }

  async autoResolveBattle() {
    if (!this.currentBattle || this.currentBattle.isFinished || this.isResolving) return;
    try {
      this.isResolving = true;
      this.setButtonsDisabled(true, '⏩ Auto-Batalha 2.5D em andamento...');

      // Executa turnos animados acelerados até a batalha terminar
      let safety = 0;
      while (this.currentBattle && !this.currentBattle.isFinished && safety < 25) {
        safety++;
        const aliveMob = this.currentBattle.monsters.find((m) => m.isAlive);
        if (!aliveMob) break;
        this.selectedTargetIndex = aliveMob.index;
        const useSkill = this.currentBattle.player.mp >= 15 && Math.random() < 0.45;

        const res = await this.client.api('/api/play/temporary-combat/action', {
          method: 'POST',
          body: JSON.stringify({
            battleId: this.currentBattle.battleId,
            actionType: useSkill ? 'SKILL' : 'ATTACK',
            targetMonsterIndex: this.selectedTargetIndex,
          }),
        });

        this.currentBattle = res;
        await this.playTurnChoreography(res.lastEvents || [], res);
        this.renderUiControls();
      }

      if (this.currentBattle?.isFinished) {
        this.showBattleResult(this.currentBattle);
      }
    } catch (err) {
      alert(`Erro na Auto-Batalha: ${err.message}`);
    } finally {
      this.isResolving = false;
      if (this.currentBattle && !this.currentBattle.isFinished) {
        this.setButtonsDisabled(false, '🎯 Sua Vez — Escolha uma Ação');
      }
    }
  }

  showBattleResult(b) {
    const old = document.getElementById('arenaResultOverlayBanner');
    if (old) old.remove();

    const isWin = b.winner === 'PLAYER';
    const rewardExp = b.rewards?.exp || 0;
    const rewardGold = b.rewards?.gold || 0;

    const banner = document.createElement('div');
    banner.id = 'arenaResultOverlayBanner';
    banner.style.cssText = `
      position: absolute;
      inset: 0;
      z-index: 200;
      background: rgba(2, 6, 23, 0.88);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 14px;
      padding: 20px;
      text-align: center;
    `;

    banner.innerHTML = `
      <div style="font-size:3.4rem;">${isWin ? '🏆' : '💀'}</div>
      <h2 style="color:${isWin ? '#fde047' : '#ef4444'}; margin:0; font-size:1.75rem; text-shadow:0 0 20px ${isWin ? 'rgba(253,224,71,0.5)' : 'rgba(239,68,68,0.5)'};">
        ${isWin ? 'VITÓRIA NA BATALHA!' : 'DERROTA NO COMBATE!'}
      </h2>
      <p style="color:#94a3b8; max-width:400px; margin:0; font-size:0.86rem;">
        ${isWin ? `Todos os monstros foram derrotados em ${b.round} rodada(s)!` : 'Seu personagem tombou em combate.'}
      </p>
      ${
        isWin
          ? `<div style="display:flex; gap:16px; background:#0f172a; padding:10px 20px; border-radius:8px; border:1px solid #334155;">
               <span style="color:#86efac; font-weight:700;">✨ +${rewardExp} EXP</span>
               <span style="color:#fde047; font-weight:700;">🪙 +${rewardGold} Ouro</span>
             </div>`
          : ''
      }
      <button class="btn-primary" onclick="this.parentElement.remove(); PlayApp.combatArena.closeArena();" style="padding:10px 24px; font-weight:700; font-size:0.92rem; border-radius:999px;">
        ✅ Voltar ao Mapa
      </button>
    `;

    document.getElementById('temporaryCombatModal').appendChild(banner);
  }
}

window.TemporaryCombatArena = TemporaryCombatArena;
