/**
 * @file apps/server/public/play/js/LevelUpVfxController.js
 * @module @etheria/play
 * @description Controlador de Efeitos Especiais de Level Up no Mapa de Exploração.
 * Renderiza aura ascendente em anéis rúnicos dourados, feixes celestiais,
 * partículas com texturas offscreen (60+ FPS sem shadowBlur) e tipografia
 * flutuante arcana ao redor do personagem.
 *
 * Segue estritamente AGENTS.md (Regra #7: < 1.000 linhas) e PERFORMANCE_STANDARDS.md.
 */

class LevelUpVfxController {
  constructor() {
    this.client = null;
    this.activeEffects = [];
    this.audioCtx = null;

    // Texturas de brilho pré-renderizadas em offscreen canvas (Zero shadowBlur!)
    this.glowTextures = {
      gold: this.createOffscreenGlow(254, 240, 138),
      amber: this.createOffscreenGlow(245, 158, 11),
      cyan: this.createOffscreenGlow(56, 189, 248),
      white: this.createOffscreenGlow(255, 255, 255),
    };
  }

  attach(client) {
    this.client = client;
    window.LevelUpVfxController = this;
  }

  createOffscreenGlow(r, g, b) {
    const size = 32;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const cx = c.getContext('2d');
    const half = size / 2;
    const grad = cx.createRadialGradient(half, half, 1.0, half, half, half);
    grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1.0)`);
    grad.addColorStop(0.35, `rgba(${r}, ${g}, ${b}, 0.85)`);
    grad.addColorStop(0.70, `rgba(${r}, ${g}, ${b}, 0.25)`);
    grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    cx.fillStyle = grad;
    cx.beginPath();
    cx.arc(half, half, half, 0, Math.PI * 2);
    cx.fill();
    return c;
  }

  getAudioContext() {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.audioCtx = new AudioCtx();
    }
    return this.audioCtx;
  }

  playCelestialSfx() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume();

      // Arpejo celestial procedural límpido: C5 -> E5 -> G5 -> C6
      const freqs = [523.25, 659.25, 783.99, 1046.50];
      const now = ctx.currentTime;

      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);

        gain.gain.setValueAtTime(0.001, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.24, now + idx * 0.08 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 0.55);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.60);
      });
    } catch {}
  }

  /**
   * Dispara a celebração visual de Level Up em torno das coordenadas do herói.
   */
  trigger(worldX, worldY, newLevel, statPointsGained = 5) {
    const now = performance.now();
    const duration = 2800; // ms

    // Cria as partículas ascendentes (Zero GC: criadas uma única vez por level-up)
    const sparkles = [];
    const count = 32;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 8 + Math.random() * 38;
      const type = Math.random() > 0.4 ? 'gold' : (Math.random() > 0.5 ? 'amber' : 'white');
      sparkles.push({
        offsetX: Math.cos(angle) * dist,
        y: (Math.sin(angle) * dist * 0.5), // Elíptico no chão
        baseVy: -(75 + Math.random() * 85),
        size: 3.5 + Math.random() * 3.5,
        type,
        delay: Math.random() * 450,
        swayFreq: 2.5 + Math.random() * 3.0,
        swayAmp: 4 + Math.random() * 8,
        phase: Math.random() * Math.PI * 2,
      });
    }

    const effect = {
      worldX,
      worldY,
      newLevel,
      statPointsGained,
      startTime: now,
      duration,
      sparkles,
    };

    this.activeEffects.push(effect);
    this.playCelestialSfx();

    // Pulsação na HUD (Avatar e Barra de EXP)
    if (window.PlayHudController?.pulseLevelBadge) {
      window.PlayHudController.pulseLevelBadge(newLevel);
    }
  }

  /**
   * Atualiza e renderiza todos os efeitos de Level Up ativos no Canvas do mundo.
   */
  renderWorld(ctx, now, zoom = 1.0) {
    if (this.activeEffects.length === 0) return;

    for (let e = this.activeEffects.length - 1; e >= 0; e--) {
      const fx = this.activeEffects[e];
      const elapsed = now - fx.startTime;

      if (elapsed >= fx.duration) {
        this.activeEffects.splice(e, 1);
        continue;
      }

      const progress = Math.min(1.0, elapsed / fx.duration);
      const wx = fx.worldX;
      const wy = fx.worldY;

      // 1. Halo Rúnico no Chão (Círculo de Luz Sagrada)
      const floorPulse = 0.5 + 0.5 * Math.sin(progress * Math.PI);
      const floorRx = 46 * (0.8 + 0.2 * floorPulse);
      const floorRy = floorRx * 0.52;

      ctx.save();
      // Duplo fill concêntrico (Zero shadowBlur!)
      ctx.beginPath();
      ctx.ellipse(wx, wy, floorRx * 1.3, floorRy * 1.3, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(245, 158, 11, ${0.22 * floorPulse})`;
      ctx.fill();

      ctx.beginPath();
      ctx.ellipse(wx, wy, floorRx, floorRy, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(254, 240, 138, ${0.45 * floorPulse})`;
      ctx.fill();

      // Anel rúnico externo com traços rotativos
      const rotAngle = (now / 600) % (Math.PI * 2);
      ctx.beginPath();
      ctx.ellipse(wx, wy, floorRx * 0.95, floorRy * 0.95, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(253, 224, 71, ${0.85 * floorPulse})`;
      ctx.lineWidth = 2.2 / zoom;
      ctx.setLineDash([8 / zoom, 6 / zoom]);
      ctx.lineDashOffset = -rotAngle * 18;
      ctx.stroke();
      ctx.setLineDash([]);

      // 2. Anéis Celestiais Ascendentes (Ondas de Luz Subindo em Espiral)
      const ringCount = 3;
      for (let r = 0; r < ringCount; r++) {
        const ringProg = ((elapsed + r * 350) % 1100) / 1100;
        const ringY = wy - ringProg * 82;
        const ringRx = (36 + ringProg * 22);
        const ringRy = ringRx * 0.44;
        const ringAlpha = (1.0 - ringProg) * floorPulse;

        ctx.beginPath();
        ctx.ellipse(wx, ringY, ringRx, ringRy, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(254, 240, 138, ${0.75 * ringAlpha})`;
        ctx.lineWidth = 1.8 / zoom;
        ctx.stroke();
      }

      // 3. Partículas e Feixes Cintilantes (Blit ultra-rápido de texturas offscreen)
      for (const sp of fx.sparkles) {
        if (elapsed < sp.delay) continue;
        const pElapsed = (elapsed - sp.delay) / 1000;
        const py = wy + sp.y + sp.baseVy * pElapsed;
        const sway = Math.sin(pElapsed * sp.swayFreq + sp.phase) * sp.swayAmp;
        const px = wx + sp.offsetX + sway;

        const particleProgress = Math.min(1.0, pElapsed / 1.6);
        const pAlpha = (1.0 - particleProgress) * floorPulse;
        if (pAlpha <= 0.02) continue;

        const tex = this.glowTextures[sp.type] || this.glowTextures.gold;
        const dSize = Math.max(4, (sp.size * 3.4) / zoom);

        ctx.globalAlpha = pAlpha;
        ctx.drawImage(tex, px - dSize / 2, py - dSize / 2, dSize, dSize);
      }
      ctx.globalAlpha = 1.0;

      // 4. Tipografia Flutuante Heróica ("✦ LEVEL UP! ✦ Nível X")
      this.drawFloatingBanner(ctx, wx, wy, fx, progress, zoom);

      ctx.restore();
    }
  }

  drawFloatingBanner(ctx, wx, wy, fx, progress, zoom) {
    // Easing de subida suave (sobe 48px nos primeiros 20%, depois flutua lentamente)
    const riseY = progress < 0.25
      ? (progress / 0.25) * 44
      : 44 + (progress - 0.25) * 16;
    const textY = wy - 88 - riseY;

    // Fade in rápido, sustentação longa, fade out suave nos últimos 20%
    let alpha = 1.0;
    if (progress < 0.12) alpha = progress / 0.12;
    else if (progress > 0.78) alpha = (1.0 - progress) / 0.22;

    if (alpha <= 0.01) return;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Fundo em pílula translúcida escura com borda dourada
    const boxW = 196 / zoom;
    const boxH = 44 / zoom;
    const boxX = wx - boxW / 2;
    const boxY = textY - boxH / 2;

    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 12 / zoom);
    ctx.fillStyle = `rgba(15, 23, 42, ${0.88 * alpha})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(234, 179, 8, ${0.92 * alpha})`;
    ctx.lineWidth = 1.8 / zoom;
    ctx.stroke();

    // Linha 1: ✦ LEVEL UP! ✦
    ctx.font = `900 ${Math.round(14 / zoom)}px sans-serif`;
    ctx.fillStyle = `rgba(254, 240, 138, ${alpha})`;
    ctx.fillText('✦ LEVEL UP! ✦', wx, textY - 8 / zoom);

    // Linha 2: Nível X (+5 Pontos)
    ctx.font = `bold ${Math.round(11 / zoom)}px sans-serif`;
    ctx.fillStyle = `rgba(110, 231, 183, ${alpha})`;
    ctx.fillText(`Nível ${fx.newLevel} (+${fx.statPointsGained} Pontos)`, wx, textY + 9 / zoom);

    ctx.restore();
  }
}

window.LevelUpVfxController = LevelUpVfxController;
