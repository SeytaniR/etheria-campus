/**
 * @file apps/server/public/play/js/BattleTransitionController.js
 * @module @etheria/play
 * @description Motor de Transição Cinemática de Batalha (Action RPG).
 * Gerencia efeitos visuais de entrada em combate (Fratura de Cristal, Corte de Lâminas,
 * Vórtice Arcano e Pulso Cósmico), síntese de áudio procedural via Web Audio API,
 * congelamento de frame de exploração e banner cinemático de encontro de monstros.
 *
 * Segue estritamente AGENTS.md (Regra #7: < 1.000 linhas).
 */

class BattleTransitionController {
  constructor() {
    this.isActive = false;
    this.progress = 0;
    this.startTime = 0;
    this.duration = 980; // ms (rápido, impactante e sem travar o ritmo)
    this.arena = null;
    this.battleState = null;
    this.isTestMode = false;

    // Configurações persistidas
    this.styles = ['SHATTER', 'SLASH', 'VORTEX', 'PULSE'];
    this.configuredStyle = localStorage.getItem('etheria_battle_transition_style') || 'RANDOM';
    this.currentStyle = 'SHATTER';
    this.soundEnabled = localStorage.getItem('etheria_battle_transition_sfx') !== 'false';
    this.volume = 0.55;

    // Buffer de snapshot do canvas de exploração
    this.freezeCanvas = document.createElement('canvas');
    this.freezeCtx = this.freezeCanvas.getContext('2d');

    // Estado da animação procedural
    this.shards = [];
    this.particles = [];
    this.slashEmbers = [];
    this.audioCtx = null;
    this.screenShake = 0;

    // Dados do encontro para o banner
    this.encounterInfo = {
      title: 'BATALHA INICIADA!',
      enemyName: 'Inimigo',
      enemyTier: 'NORMAL',
      enemyLevel: 1,
      enemyCount: 1,
      elementCode: 'NEUTRAL',
      raceCode: 'HUMAN',
    };

    this.bindGlobalKeyboard();
  }

  getAudioContext() {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.audioCtx = new AudioCtx();
      }
    }
    return this.audioCtx;
  }

  bindGlobalKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (!this.isActive) return;
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') {
        this.skip();
      }
    });
  }

  setTransitionStyle(style) {
    this.configuredStyle = style;
    localStorage.setItem('etheria_battle_transition_style', style);
  }

  toggleSound(enabled) {
    this.soundEnabled = enabled !== undefined ? enabled : !this.soundEnabled;
    localStorage.setItem('etheria_battle_transition_sfx', String(this.soundEnabled));
    return this.soundEnabled;
  }

  /**
   * Captura o frame atual do mundo no gameCanvas antes de renderizar a arena
   */
  captureExplorationFrame(canvas) {
    if (!canvas || canvas.width === 0 || canvas.height === 0) return;
    this.freezeCanvas.width = canvas.width;
    this.freezeCanvas.height = canvas.height;
    this.freezeCtx.clearRect(0, 0, canvas.width, canvas.height);
    this.freezeCtx.drawImage(canvas, 0, 0);
  }

  /**
   * Inicia a transição de combate oficial
   */
  start(battleState, arena, forcedStyle = null) {
    const canvas = arena?.client?.canvas || document.getElementById('gameCanvas');
    if (!canvas) return;

    this.arena = arena;
    this.battleState = battleState;
    this.isTestMode = false;
    this.captureExplorationFrame(canvas);

    // Determina o estilo da transição
    if (forcedStyle) {
      this.currentStyle = forcedStyle;
    } else if (this.configuredStyle === 'RANDOM') {
      const idx = Math.floor(Math.random() * this.styles.length);
      this.currentStyle = this.styles[idx];
    } else {
      this.currentStyle = this.configuredStyle;
    }

    // Extrai dados do monstro para o banner
    const mob = battleState?.monsters?.[0] || {};
    const mobCount = Array.isArray(battleState?.monsters) ? battleState.monsters.length : 1;
    this.encounterInfo = {
      title: mobCount > 1 ? 'EMBOSCADA DE MONSTROS!' : 'ENCONTRO DE COMBATE!',
      enemyName: mob.name || 'Monstro Selvagem',
      enemyTier: mob.variantTier || 'NORMAL',
      enemyLevel: Number(mob.level) || 1,
      enemyCount: mobCount,
      elementCode: mob.elementCode || 'NEUTRAL',
      raceCode: mob.raceCode || 'BEAST',
    };

    if (this.arena) {
      this.arena.isTransitioning = true;
    }

    this.buildProceduralGeometry(canvas.width, canvas.height);
    this.playAudioCue(this.currentStyle);

    this.isActive = true;
    this.progress = 0;
    this.startTime = performance.now();
    this.screenShake = 14;
  }

  /**
   * Simula um teste visual da transição sob demanda (para menu GM e pré-visualização)
   */
  test(forcedStyle = 'SHATTER') {
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) return;

    this.captureExplorationFrame(canvas);
    this.currentStyle = forcedStyle === 'RANDOM'
      ? this.styles[Math.floor(Math.random() * this.styles.length)]
      : (forcedStyle || 'SHATTER');

    this.encounterInfo = {
      title: '⚔️ TESTE DE TRANSIÇÃO GM ⚔️',
      enemyName: 'Dragão Elemental de Éter',
      enemyTier: 'BOSS',
      enemyLevel: 60,
      enemyCount: 1,
      elementCode: 'FIRE',
      raceCode: 'DRAGON',
    };

    this.isTestMode = true;
    this.buildProceduralGeometry(canvas.width, canvas.height);
    this.playAudioCue(this.currentStyle);

    this.isActive = true;
    this.progress = 0;
    this.startTime = performance.now();
    this.screenShake = 16;
  }

  /**
   * Constrói a malha de estilhaços e partículas para o estilo ativo
   */
  buildProceduralGeometry(w, h) {
    this.shards = [];
    this.particles = [];
    this.slashEmbers = [];

    const cx = w / 2;
    const cy = h / 2;

    if (this.currentStyle === 'SHATTER') {
      // Cria malha triangular orgânica com jitter (6 colunas x 4 linhas x 2 triângulos = 48 cacos de cristal)
      const cols = 6;
      const rows = 4;
      const cellW = w / cols;
      const cellH = h / rows;

      // Grade de vértices com jitter
      const grid = [];
      for (let r = 0; r <= rows; r++) {
        grid[r] = [];
        for (let c = 0; c <= cols; c++) {
          const jitterX = (c === 0 || c === cols) ? 0 : (Math.random() - 0.5) * cellW * 0.45;
          const jitterY = (r === 0 || r === rows) ? 0 : (Math.random() - 0.5) * cellH * 0.45;
          grid[r][c] = { x: c * cellW + jitterX, y: r * cellH + jitterY };
        }
      }

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const p0 = grid[r][c];
          const p1 = grid[r][c + 1];
          const p2 = grid[r + 1][c + 1];
          const p3 = grid[r + 1][c];

          // Triângulo A (p0, p1, p2)
          this.createShard([p0, p1, p2], cx, cy);
          // Triângulo B (p0, p2, p3)
          this.createShard([p0, p2, p3], cx, cy);
        }
      }

      // Adiciona fagulhas de cristal
      for (let i = 0; i < 45; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spd = 200 + Math.random() * 450;
        this.particles.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd,
          color: Math.random() > 0.5 ? '#38bdf8' : '#fbbf24',
          size: 2 + Math.random() * 4,
          alpha: 1,
        });
      }
    } else if (this.currentStyle === 'SLASH') {
      // 4 Fatias formadas por dois cortes em 'X'
      this.slashEmbers = [];
      for (let i = 0; i < 60; i++) {
        const isDiag1 = Math.random() > 0.5;
        const pos = Math.random();
        const px = isDiag1 ? pos * w : pos * w;
        const py = isDiag1 ? pos * h : (1 - pos) * h;
        const spd = (Math.random() - 0.5) * 350;
        this.slashEmbers.push({
          x: px,
          y: py,
          vx: spd,
          vy: spd - 60,
          color: Math.random() > 0.3 ? '#ef4444' : '#f59e0b',
          size: 2 + Math.random() * 3.5,
          life: 0.4 + Math.random() * 0.6,
        });
      }
    } else if (this.currentStyle === 'VORTEX') {
      // Partículas em espiral
      for (let i = 0; i < 70; i++) {
        this.particles.push({
          radius: 60 + Math.random() * Math.max(w, h) * 0.65,
          angle: Math.random() * Math.PI * 2,
          speed: 2.5 + Math.random() * 5.0,
          color: Math.random() > 0.4 ? '#a855f7' : '#38bdf8',
          size: 2 + Math.random() * 3.5,
        });
      }
    }
  }

  createShard(pts, cx, cy) {
    const scx = (pts[0].x + pts[1].x + pts[2].x) / 3;
    const scy = (pts[0].y + pts[1].y + pts[2].y) / 3;
    const dx = scx - cx;
    const dy = scy - cy;
    const dist = Math.hypot(dx, dy) || 1;
    const normX = dx / dist;
    const normY = dy / dist;

    const baseSpeed = 400 + Math.random() * 650;
    this.shards.push({
      pts,
      cx: scx,
      cy: scy,
      vx: normX * baseSpeed + (Math.random() - 0.5) * 120,
      vy: normY * baseSpeed + (Math.random() - 0.5) * 120 - 40,
      rotSpeed: (Math.random() - 0.5) * 6.5,
      edgeColor: Math.random() > 0.5 ? '#38bdf8' : '#e0e7ff',
    });
  }

  /**
   * Pula a transição instantaneamente
   */
  skip() {
    if (!this.isActive) return;
    this.progress = 1.0;
    this.finish();
  }

  finish() {
    this.isActive = false;
    this.screenShake = 0;
    if (this.arena) {
      this.arena.isTransitioning = false;
      const modal = document.getElementById('actionCombatModal');
      if (modal) {
        modal.classList.remove('transitioning');
      }
    }
  }

  /**
   * Síntese de Áudio Procedural via Web Audio API (Zero Dependências de Arquivos)
   */
  playAudioCue(style) {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;
      const master = ctx.createGain();
      master.gain.setValueAtTime(this.volume, now);
      master.connect(ctx.destination);

      // 1. Sub-bass Impact Thump (Impacto Pesado de Encontro)
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(160, now);
      subOsc.frequency.exponentialRampToValueAtTime(32, now + 0.38);
      subGain.gain.setValueAtTime(0.85, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
      subOsc.connect(subGain);
      subGain.connect(master);
      subOsc.start(now);
      subOsc.stop(now + 0.50);

      // 2. Acorde de Tensão Heroica / Orquestral
      const chordFreqs = style === 'SLASH' ? [220, 277, 330, 440] : [196, 246, 293, 392];
      chordFreqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = idx % 2 === 0 ? 'sawtooth' : 'triangle';
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.12, now + 0.6);

        g.gain.setValueAtTime(0.08, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1400, now);

        osc.connect(filter);
        filter.connect(g);
        g.connect(master);
        osc.start(now);
        osc.stop(now + 0.68);
      });

      // 3. Efeito Específico do Estilo
      if (style === 'SHATTER') {
        // Quebra de Vidro Cristalino (Ruído Ressonante Agudo)
        const bufferSize = ctx.sampleRate * 0.35;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.08));
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const bpf = ctx.createBiquadFilter();
        bpf.type = 'bandpass';
        bpf.frequency.setValueAtTime(3200, now);
        bpf.Q.setValueAtTime(4.5, now);
        const nGain = ctx.createGain();
        nGain.gain.setValueAtTime(0.45, now);
        nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        noise.connect(bpf);
        bpf.connect(nGain);
        nGain.connect(master);
        noise.start(now);
      } else if (style === 'SLASH') {
        // Zunido Cortante de Lâmina
        const slashOsc = ctx.createOscillator();
        const sGain = ctx.createGain();
        slashOsc.type = 'sawtooth';
        slashOsc.frequency.setValueAtTime(850, now);
        slashOsc.frequency.exponentialRampToValueAtTime(140, now + 0.22);
        sGain.gain.setValueAtTime(0.35, now);
        sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        slashOsc.connect(sGain);
        sGain.connect(master);
        slashOsc.start(now);
        slashOsc.stop(now + 0.26);
      }
    } catch {
      // Ignora silenciosamente restrições do navegador até primeira interação
    }
  }

  /**
   * Renderizador Central no Loop 60 FPS (chamado em renderWorld após ctx.restore)
   */
  render(ctx, now, canvas) {
    if (!this.isActive) return;

    try {
      const curNow = (typeof now === 'number' && now > 0) ? now : performance.now();
      if (!this.startTime || this.startTime > curNow) {
        this.startTime = curNow;
      }

      const elapsed = curNow - this.startTime;
      this.progress = Math.max(0.0, Math.min(1.0, elapsed / this.duration));

      const w = canvas.width;
      const h = canvas.height;

      // Aplica Screen Shake
      if (this.screenShake > 0) {
        const sx = (Math.random() - 0.5) * this.screenShake;
        const sy = (Math.random() - 0.5) * this.screenShake;
        ctx.translate(sx, sy);
        this.screenShake *= 0.88;
        if (this.screenShake < 0.3) this.screenShake = 0;
      }

      ctx.save();

      // Renderiza o estilo visual específico
      switch (this.currentStyle) {
        case 'SLASH':
          this.renderSlash(ctx, this.progress, w, h);
          break;
        case 'VORTEX':
          this.renderVortex(ctx, this.progress, w, h);
          break;
        case 'PULSE':
          this.renderPulse(ctx, this.progress, w, h);
          break;
        case 'SHATTER':
        default:
          this.renderShatter(ctx, this.progress, w, h);
          break;
      }

      // Renderiza o banner épico de encontro
      this.renderEncounterBanner(ctx, this.progress, w, h);

      ctx.restore();

      if (this.progress >= 1.0) {
        this.finish();
      }
    } catch (err) {
      console.warn('Erro visual na transição de batalha:', err);
      this.finish();
    }
  }

  /**
   * ESTILO 1: Fratura Dimensional de Cristal (Shatter)
   */
  renderShatter(ctx, p, w, h) {
    // 1. Flash inicial de luz branca/dourada
    if (p < 0.15) {
      const flashAlpha = 1 - p / 0.15;
      ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha * 0.75})`;
      ctx.fillRect(0, 0, w, h);
    }

    // 2. Renderização de cada caco de cristal voando e girando
    const t = p * p; // Aceleração física quadrática
    const shardAlpha = p < 0.5 ? 1.0 : Math.max(0, 1.0 - (p - 0.5) / 0.5);

    for (const s of this.shards) {
      const curX = s.cx + s.vx * t;
      const curY = s.cy + s.vy * t + 350 * t * t; // Adiciona gravidade suave
      const rot = s.rotSpeed * p;
      const scale = Math.max(0.1, 1.0 - p * 0.35);

      ctx.save();
      ctx.globalAlpha = shardAlpha;
      ctx.translate(curX, curY);
      ctx.rotate(rot);
      ctx.scale(scale, scale);
      ctx.translate(-s.cx, -s.cy);

      // Traça o triângulo e aplica o recorte da imagem original
      ctx.beginPath();
      ctx.moveTo(s.pts[0].x, s.pts[0].y);
      ctx.lineTo(s.pts[1].x, s.pts[1].y);
      ctx.lineTo(s.pts[2].x, s.pts[2].y);
      ctx.closePath();
      ctx.clip();

      ctx.drawImage(this.freezeCanvas, 0, 0);

      // Borda de cristal brilhante
      ctx.strokeStyle = s.edgeColor;
      ctx.lineWidth = 1.8;
      ctx.stroke();

      ctx.restore();
    }

    // 3. Fagulhas e faíscas de energia
    for (const pt of this.particles) {
      const px = pt.x + pt.vx * p;
      const py = pt.y + pt.vy * p;
      const pAlpha = Math.max(0, 1 - p);
      ctx.fillStyle = pt.color;
      ctx.globalAlpha = pAlpha;
      ctx.beginPath();
      const pR = Math.max(0.1, pt.size * Math.max(0.01, 1 - p * 0.5));
      ctx.arc(px, py, pR, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * ESTILO 2: Corte de Lâminas Duplo (X-Slash)
   */
  renderSlash(ctx, p, w, h) {
    const cx = w / 2;
    const cy = h / 2;

    // 1. Linhas de corte em 'X' neon nos primeiros 220ms
    if (p < 0.22) {
      const slashT = p / 0.22;
      ctx.save();
      ctx.strokeStyle = '#ef4444';
      ctx.shadowColor = '#f43f5e';
      ctx.shadowBlur = 18;
      ctx.lineWidth = 6;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(w * slashT, h * slashT);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(w, 0);
      ctx.lineTo(w - w * slashT, h * slashT);
      ctx.stroke();
      ctx.restore();
    }

    // 2. Separação das 4 fatias triangulares deslizando para longe do centro
    const slideDist = Math.max(0, p - 0.18) * 450;
    const fade = Math.max(0, 1 - p * 1.15);

    if (fade > 0) {
      const slices = [
        { pts: [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: cx, y: cy }], dx: 0, dy: -slideDist },
        { pts: [{ x: w, y: 0 }, { x: w, y: h }, { x: cx, y: cy }], dx: slideDist, dy: 0 },
        { pts: [{ x: w, y: h }, { x: 0, y: h }, { x: cx, y: cy }], dx: 0, dy: slideDist },
        { pts: [{ x: 0, y: h }, { x: 0, y: 0 }, { x: cx, y: cy }], dx: -slideDist, dy: 0 },
      ];

      for (const sl of slices) {
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(sl.dx, sl.dy);
        ctx.beginPath();
        ctx.moveTo(sl.pts[0].x, sl.pts[0].y);
        ctx.lineTo(sl.pts[1].x, sl.pts[1].y);
        ctx.lineTo(sl.pts[2].x, sl.pts[2].y);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(this.freezeCanvas, 0, 0);

        // Borda de brasa incandescente
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.restore();
      }
    }

    // 3. Brasas incandescentes do corte
    for (const em of this.slashEmbers) {
      const ex = em.x + em.vx * p;
      const ey = em.y + em.vy * p;
      const eAlpha = Math.max(0, 1 - p * 1.2);
      ctx.fillStyle = em.color;
      ctx.globalAlpha = eAlpha;
      ctx.fillRect(ex, ey, em.size, em.size);
    }
  }

  /**
   * ESTILO 3: Vórtice Arcano Dimensional
   */
  renderVortex(ctx, p, w, h) {
    const cx = w / 2;
    const cy = h / 2;

    // Vórtice espiral sugando para o centro
    ctx.save();
    ctx.translate(cx, cy);
    const rotAngle = p * Math.PI * 4;
    ctx.rotate(rotAngle);
    const scale = Math.max(0.01, 1 - p * p);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);

    ctx.globalAlpha = Math.max(0, 1 - p * 1.1);
    ctx.drawImage(this.freezeCanvas, 0, 0);
    ctx.restore();

    // Anéis de choque cósmicos expansivos
    const maxR = Math.hypot(w, h) * 0.65;
    const ringR = p * maxR;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(0.1, ringR), 0, Math.PI * 2);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = Math.max(0.1, (1 - p) * 12);
    ctx.globalAlpha = Math.max(0, 1 - p);
    ctx.stroke();
    ctx.restore();

    // Partículas orbitais
    for (const pt of this.particles) {
      const r = Math.max(0, pt.radius * (1 - p));
      const a = pt.angle + p * pt.speed;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      ctx.fillStyle = pt.color;
      ctx.globalAlpha = Math.max(0, 1 - p * 1.2);
      ctx.beginPath();
      ctx.arc(px, py, Math.max(0.1, pt.size), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * ESTILO 4: Pulso Cósmico & Cortina de Aço
   */
  renderPulse(ctx, p, w, h) {
    // 1. Flash duplo (Branco -> Púrpura Real)
    if (p < 0.25) {
      const flash = Math.sin(p * Math.PI * 4);
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.abs(flash) * 0.85})`;
      ctx.fillRect(0, 0, w, h);
    }

    // 2. Cortina horizontal abrindo do centro
    const slitH = Math.pow(p, 1.8) * (h / 2);
    const topH = h / 2 - slitH;
    const botY = h / 2 + slitH;

    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - p * 1.1);

    // Bloco Superior subindo
    if (topH > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w, topH);
      ctx.clip();
      ctx.drawImage(this.freezeCanvas, 0, -slitH * 0.5);
      ctx.restore();
    }

    // Bloco Inferior descendo
    if (botY < h) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, botY, w, h - botY);
      ctx.clip();
      ctx.drawImage(this.freezeCanvas, 0, slitH * 0.5);
      ctx.restore();
    }

    // Linha de laser horizontal no ponto de abertura
    ctx.strokeStyle = '#c084fc';
    ctx.shadowColor = '#a855f7';
    ctx.shadowBlur = 14;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, h / 2 - slitH);
    ctx.lineTo(w, h / 2 - slitH);
    ctx.moveTo(0, h / 2 + slitH);
    ctx.lineTo(w, h / 2 + slitH);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Renderiza a Placa / Banner Cinemático de Encontro de Combate
   */
  renderEncounterBanner(ctx, p, w, h) {
    // Banner visível entre 15% e 90% da transição
    if (p < 0.15 || p > 0.92) return;

    // Fade-in e Fade-out suaves
    let alpha = 1.0;
    if (p < 0.28) {
      alpha = (p - 0.15) / 0.13;
    } else if (p > 0.78) {
      alpha = (0.92 - p) / 0.14;
    }

    const bannerW = Math.min(480, w * 0.90);
    const bannerH = 96;
    const bx = (w - bannerW) / 2;
    const by = (h - bannerH) / 2 - 12;

    ctx.save();
    ctx.globalAlpha = alpha;

    // Fundo Acrílico Escuro Premium
    ctx.fillStyle = 'rgba(2, 6, 23, 0.92)';
    ctx.beginPath();
    ctx.roundRect(bx, by, bannerW, bannerH, 12);
    ctx.fill();

    // Borda Dourada / Neon com Glow
    ctx.strokeStyle = this.encounterInfo.enemyTier === 'BOSS' ? '#f43f5e' : '#eab308';
    ctx.shadowColor = this.encounterInfo.enemyTier === 'BOSS' ? 'rgba(244, 63, 94, 0.7)' : 'rgba(234, 179, 8, 0.6)';
    ctx.shadowBlur = 12;
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // Título Superior
    ctx.textAlign = 'center';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillStyle = this.encounterInfo.enemyTier === 'BOSS' ? '#fb7185' : '#fde047';
    ctx.fillText(this.encounterInfo.title, w / 2, by + 28);

    // Nome do Monstro com Rank e Nível
    const countText = this.encounterInfo.enemyCount > 1 ? ` (${this.encounterInfo.enemyCount}x)` : '';
    const tierText = this.encounterInfo.enemyTier !== 'NORMAL' ? ` [${this.encounterInfo.enemyTier}]` : '';
    ctx.font = 'bold 17px sans-serif';
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(`${this.encounterInfo.enemyName}${countText} • Nv.${this.encounterInfo.enemyLevel}${tierText}`, w / 2, by + 56);

    // Instrução sutil para pular
    ctx.font = '600 11px sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('⚡ Toque na tela ou pressione Espaço para iniciar', w / 2, by + 78);

    ctx.restore();
  }
}

// Instância singleton global
window.BattleTransitionController = new BattleTransitionController();
