/**
 * @file apps/server/public/play/js/ActionVfxRenderer.js
 * @module @etheria/server
 * @description Renderizador Modular de VFX Animados (mcrework com recolorização VfxColorProcessor),
 *   Zonas Persistentes no Solo, Indicadores Geométricos (Cone / Linha / AoE), Escudos e Ícones de Buff/Debuff
 *   acima da cabeça das unidades na Arena Action (`/play`).
 * @rules Segue AGENTS.md (Regra #7 < 1.000 linhas).
 * @dependencies VfxColorProcessor
 */

class ActionVfxRenderer {
  constructor() {
    this.vfxCache = new Map();
    this.iconCache = new Map();
    this.activeBursts = [];
    this.activeTelegraphs = [];

    // Atmosfera do Véu / The Veil (Mundo Invertido de Stranger Things)
    this.veilEffectsEnabled = localStorage.getItem('etheria_veil_effects') !== 'false';
    this.veilSpores = [];
    this.veilTendrils = [];
    this.veilLightning = null;
    this.nextVeilLightningTime = performance.now() + 3500;
    this.lastVeilTime = performance.now();
    this.lastArenaKey = '';
    this.floorGradCache = null;
    this.lastFloorGradKey = '';

    // Texturas de halo bioluminescente pré-renderizadas em Canvas Offscreen (Zero shadowBlur no loop!)
    this.sporeGlowTextures = {
      ash: this.createParticleGlowTexture(210, 220, 235),
      cyan: this.createParticleGlowTexture(56, 189, 248),
      crimson: this.createParticleGlowTexture(244, 63, 94),
    };
  }

  /**
   * Pré-renderiza textura radial suave de partícula bioluminescente para renderização ultra-rápida (60+ FPS).
   */
  createParticleGlowTexture(r, g, b) {
    const size = 32;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const cx = c.getContext('2d');
    const half = size / 2;
    const gObj = cx.createRadialGradient(half, half, 1.2, half, half, half);
    gObj.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1.0)`);
    gObj.addColorStop(0.35, `rgba(${r}, ${g}, ${b}, 0.85)`);
    gObj.addColorStop(0.7, `rgba(${r}, ${g}, ${b}, 0.28)`);
    gObj.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    cx.fillStyle = gObj;
    cx.beginPath();
    cx.arc(half, half, half, 0, Math.PI * 2);
    cx.fill();
    return c;
  }

  getOrLoadVfx(vfxKey) {
    if (!vfxKey) return null;
    const key = String(vfxKey).trim();
    if (this.vfxCache.has(key)) return this.vfxCache.get(key);
    const entry = { key, ready: false, atlasData: null, image: null };
    this.vfxCache.set(key, entry);

    fetch(`/api/assets/mcrework/assets/effects/${key}/atlas.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((json) => {
        entry.atlasData = json;
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          entry.image = img;
          entry.ready = true;
        };
        img.src = `/api/assets/mcrework/assets/effects/${key}/atlas.webp`;
      })
      .catch(() => {});

    return entry;
  }

  getOrLoadIcon(iconUrl) {
    if (!iconUrl) return null;
    if (this.iconCache.has(iconUrl)) return this.iconCache.get(iconUrl);
    const entry = { ready: false, img: null };
    this.iconCache.set(iconUrl, entry);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      entry.img = img;
      entry.ready = true;
    };
    img.src = iconUrl;
    return entry;
  }

  spawnBurst(vfxKey, x, y, colorHex = null, intensityPct = 100, durationMs = 650, scale = 0.85) {
    if (!vfxKey) return;
    this.getOrLoadVfx(vfxKey);
    this.activeBursts.push({
      vfxKey: String(vfxKey).trim(),
      x,
      y,
      colorHex: colorHex || null,
      intensityPct: intensityPct ?? 100,
      startMs: performance.now(),
      durationMs: Math.max(250, durationMs),
      scale,
    });
  }

  spawnTelegraph(shape, params) {
    this.activeTelegraphs.push({
      shape,
      ...params,
      startMs: performance.now(),
      durationMs: params.durationMs || 480,
    });
  }

  reset() {
    this.activeBursts = [];
    this.activeTelegraphs = [];
  }

  drawVfxFrame(ctx, vfxKey, x, y, elapsedMs, scale = 0.85, colorHex = null, intensityPct = 100) {
    const vfx = this.getOrLoadVfx(vfxKey);
    if (!vfx || !vfx.ready || !vfx.atlasData || !vfx.image) return;
    if (window.VfxColorProcessor) {
      window.VfxColorProcessor.drawVfxFrame(
        ctx,
        vfx.image,
        vfx.atlasData,
        elapsedMs,
        x,
        y,
        scale,
        colorHex,
        intensityPct
      );
    }
  }

  drawGroundZonesAndTelegraphs(ctx, groundZones, now) {
    if (Array.isArray(groundZones)) {
      for (const gz of groundZones) {
        const radius = Math.max(28, Number(gz.radius) || 90);
        const pulse = 0.78 + 0.22 * Math.sin(now / 180);
        const ringColor = gz.vfxColorHex || (gz.isFriendly ? '#4ade80' : '#f97316');
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(gz.x, gz.y, radius, Math.round(radius * 0.62), 0, 0, Math.PI * 2);
        ctx.fillStyle = `${ringColor}28`;
        ctx.fill();
        ctx.strokeStyle = ringColor;
        ctx.globalAlpha = 0.72 * pulse;
        ctx.lineWidth = 2.2;
        ctx.stroke();
        ctx.restore();

        if (gz.vfxKey) {
          this.drawVfxFrame(ctx, gz.vfxKey, gz.x, gz.y - 14, now - gz.createdAt, 0.9, gz.vfxColorHex, gz.vfxColorIntensity);
        }
      }
    }

    for (let i = this.activeTelegraphs.length - 1; i >= 0; i--) {
      const tg = this.activeTelegraphs[i];
      const elapsed = now - tg.startMs;
      if (elapsed >= tg.durationMs) {
        this.activeTelegraphs.splice(i, 1);
        continue;
      }
      const alpha = Math.max(0, 1 - elapsed / tg.durationMs);
      const col = tg.color || '#38bdf8';
      ctx.save();
      ctx.globalAlpha = 0.42 * alpha;
      ctx.fillStyle = col;
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;

      if (tg.shape === 'CONE') {
        const halfRad = ((tg.angleDeg || 90) * Math.PI) / 360;
        const baseRad = Math.atan2(tg.dy || 0, tg.dx || 1);
        ctx.beginPath();
        ctx.moveTo(tg.x, tg.y);
        ctx.arc(tg.x, tg.y, tg.range || 90, baseRad - halfRad, baseRad + halfRad);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 0.85 * alpha;
        ctx.stroke();
      } else if (tg.shape === 'LINE') {
        const ang = Math.atan2(tg.dy || 0, tg.dx || 1);
        const w = tg.width || 48;
        const len = tg.range || 180;
        ctx.translate(tg.x, tg.y);
        ctx.rotate(ang);
        ctx.fillRect(0, -w / 2, len, w);
        ctx.globalAlpha = 0.85 * alpha;
        ctx.strokeRect(0, -w / 2, len, w);
      } else {
        const r = tg.radius || 90;
        ctx.beginPath();
        ctx.ellipse(tg.x, tg.y, r, Math.round(r * 0.62), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.85 * alpha;
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  drawActiveBursts(ctx, now, arena = null) {
    for (let i = this.activeBursts.length - 1; i >= 0; i--) {
      const b = this.activeBursts[i];
      const elapsed = now - b.startMs;
      if (elapsed >= b.durationMs) {
        this.activeBursts.splice(i, 1);
        continue;
      }
      this.drawVfxFrame(ctx, b.vfxKey, b.x, b.y, elapsed, b.scale, b.colorHex, b.intensityPct);
    }

    // Camada Atmosférica Aérea do Véu (Esporos, cinzas 2.5D e relâmpagos avermelhados no céu)
    if (this.veilEffectsEnabled && arena && arena.isActive) {
      this.drawVeilAirAndSpores(ctx, arena, now, arena.client?.zoom || 1.0);
    }
  }

  drawUnitOverlays(ctx, unit, headY, now) {
    if (!unit || !unit.isAlive) return;

    if (Number(unit.shieldHp) > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(unit.x, unit.y - 20, 26, 30, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.72)';
      ctx.lineWidth = 2;
      ctx.stroke();
      const sbw = 46;
      const sx = unit.x - sbw / 2;
      const sy = headY - 4;
      const ratio = Math.min(1, Number(unit.shieldHp) / Math.max(1, Number(unit.shieldMaxHp) || Number(unit.shieldHp)));
      ctx.fillStyle = '#020617';
      ctx.fillRect(sx, sy, sbw, 4);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(sx, sy, sbw * ratio, 4);
      ctx.restore();
    }

    const statuses = Array.isArray(unit.activeStatuses) ? unit.activeStatuses : [];
    if (statuses.length === 0) return;

    const iconSize = 15;
    const totalW = Math.min(4, statuses.length) * (iconSize + 3) - 3;
    let startX = Math.round(unit.x - totalW / 2);
    const bounce = Math.sin(now / 190) * 1.5;
    const iconY = Math.round(headY - 24 + bounce);

    ctx.save();
    for (const st of statuses.slice(0, 4)) {
      ctx.fillStyle = 'rgba(2, 6, 23, 0.9)';
      ctx.fillRect(startX - 1, iconY - 1, iconSize + 2, iconSize + 2);
      ctx.strokeStyle = st.isBuff ? '#4ade80' : '#f43f5e';
      ctx.lineWidth = 1.4;
      ctx.strokeRect(startX - 1, iconY - 1, iconSize + 2, iconSize + 2);
      const ic = this.getOrLoadIcon(st.iconUrl);
      if (ic && ic.ready && ic.img) {
        ctx.drawImage(ic.img, startX, iconY, iconSize, iconSize);
      }
      if ((st.stacks || 1) > 1) {
        ctx.fillStyle = '#fde047';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`x${st.stacks}`, startX + iconSize + 1, iconY + iconSize);
      }
      startX += iconSize + 3;
    }
    ctx.restore();
  }

  drawArenaFloorAndProjectiles(ctx, arena, now, zoom = 1.0) {
    const cx = arena.arenaCenterX;
    const cy = arena.arenaCenterY;
    const rx = arena.arenaRadiusX;
    const ry = arena.arenaRadiusY;

    // 0. Atmosfera Sombria de Chão do Véu (Piso elíptico abissal, distorções e tentáculos rastejantes)
    if (this.veilEffectsEnabled) {
      this.drawVeilFloorAtmosphere(ctx, arena, now, zoom);
    }

    ctx.save();
    if (!arena.isDungeonMode) {
      const pulse = 0.85 + 0.15 * Math.sin(now / 260);
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(56, 189, 248, ${0.18 * pulse})`;
      ctx.lineWidth = 6 / zoom;
      ctx.stroke();
      ctx.strokeStyle = `rgba(56, 189, 248, ${0.50 * pulse})`;
      ctx.lineWidth = 2.5 / zoom;
      ctx.stroke();

      for (let i = 0; i < 8; i++) {
        const ang = (i * Math.PI) / 4;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(ang) * rx, cy + Math.sin(ang) * ry, 4.5 / zoom, 0, Math.PI * 2);
        ctx.fillStyle = '#38bdf8';
        ctx.fill();
      }
    }

    // Anel de Alcance de Ataque do Jogador
    if (arena.player && arena.player.isAlive) {
      const pRange = arena.player.attackRange || 220;
      ctx.save();
      ctx.beginPath();
      ctx.setLineDash([8, 8]);
      ctx.ellipse(arena.player.x, arena.player.y, pRange, pRange * 0.74, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.20)';
      ctx.lineWidth = 1.5 / zoom;
      ctx.stroke();
      ctx.restore();
    }

    // Retículo Dinâmico de Mira no Chão para o Alvo Travado
    const target = arena.getLockedTarget();
    if (target && target.isAlive) {
      this.drawTargetReticleOnFloor(ctx, target, now, zoom);
    }

    this.drawGroundZonesAndTelegraphs(ctx, arena.groundZones, now);
    for (const p of arena.projectiles || []) {
      const projColor = p.color || '#fde047';
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 10.5 / zoom, 0, Math.PI * 2);
      ctx.fillStyle = projColor;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6.5 / zoom, 0, Math.PI * 2);
      ctx.fillStyle = projColor;
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  /**
   * Renderiza o retículo dinâmico de foco sob os pés do alvo que receberá o ataque.
   */
  drawTargetReticleOnFloor(ctx, target, now, zoom = 1.0) {
    if (!target || !target.isAlive) return;
    ctx.save();
    const pulse = 0.90 + 0.10 * Math.sin(now / 160);
    const rot = (now / 1100) % (Math.PI * 2);
    const rx = Math.max(26, (target.bodyRadiusX || 24) * 1.35 * pulse);
    const ry = Math.max(16, (target.bodyRadiusY || 17) * 1.35 * pulse);

    // 1. Anel externo com brilho e borda em destaque (halo sem shadowBlur)
    ctx.beginPath();
    ctx.ellipse(target.x, target.y - 4, rx, ry, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.30)';
    ctx.lineWidth = 5.4 / zoom;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.90)';
    ctx.lineWidth = 2.4 / zoom;
    ctx.stroke();

    // 2. 4 Pips de mira em cruz giratória
    for (let i = 0; i < 4; i++) {
      const ang = rot + (i * Math.PI) / 2;
      const px = target.x + Math.cos(ang) * (rx + 5);
      const py = target.y - 4 + Math.sin(ang) * (ry + 4);
      const inX = target.x + Math.cos(ang) * (rx - 6);
      const inY = target.y - 4 + Math.sin(ang) * (ry - 5);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(inX, inY);
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 2.6 / zoom;
      ctx.stroke();
    }

    // 3. Ponto central sutil
    ctx.beginPath();
    ctx.arc(target.x, target.y - 4, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#ef4444';
    ctx.fill();
    ctx.restore();
  }

  /**
   * Renderiza o indicador de foco aéreo (chevron pulsante) sobre o alvo.
   */
  drawMonsterTargetOverlays(ctx, target, headY, now) {
    if (!target || !target.isAlive) return;
    ctx.save();
    const bounce = Math.sin(now / 140) * 3.5;
    const cy = headY - 14 + bounce;
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.85)';
    ctx.lineWidth = 3;
    ctx.strokeText('▼', target.x, cy);
    ctx.fillText('▼', target.x, cy);
    ctx.restore();
  }

  drawFloatingTexts(ctx, floatingTexts) {
    for (const f of floatingTexts || []) {
      ctx.save();
      ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.92)';
      ctx.lineWidth = 3;
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color || '#fff';
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }
  }

  /* ==========================================================================
     ATMOSFERA DO VÉU / THE VEIL (MUNDO INVERTIDO DE STRANGER THINGS - TELA TODA)
     ========================================================================== */

  /**
   * Inicializa partículas e raízes dimensionais preenchendo a tela toda e a arena instanciada.
   */
  initVeilAtmosphere(cx, cy, rx, ry, viewL, viewT, viewW, viewH) {
    this.lastArenaKey = `${Math.round(cx)}_${Math.round(cy)}_${Math.round(rx)}_${Math.round(ry)}`;
    this.veilSpores = [];
    this.veilTendrils = [];
    this.veilLightning = null;
    this.nextVeilLightningTime = performance.now() + 3000 + Math.random() * 2500;
    this.lastVeilTime = performance.now();

    const vl = typeof viewL === 'number' ? viewL : cx - 1100;
    const vt = typeof viewT === 'number' ? viewT : cy - 800;
    const vw = typeof viewW === 'number' ? Math.max(1600, viewW) : 2200;
    const vh = typeof viewH === 'number' ? Math.max(1200, viewH) : 1600;

    // 1. Esporos e Cinzas Dimensionais Flutuantes (160 partículas cobrindo toda a tela visível)
    const sporeColors = [
      { r: 203, g: 213, b: 225 }, // 55% Cinza Ectoplasmático / Cinzas do Véu
      { r: 56, g: 189, b: 248 },  // 25% Ciano Necrótico Fantasmal
      { r: 244, g: 63, b: 94 },   // 20% Carmesim Dimensional
    ];

    for (let i = 0; i < 160; i++) {
      const depth = 0.35 + Math.random() * 0.85;
      const roll = Math.random();
      const col = roll > 0.80 ? sporeColors[2] : (roll > 0.55 ? sporeColors[1] : sporeColors[0]);
      const glowType = roll > 0.80 ? 'crimson' : (roll > 0.55 ? 'cyan' : 'ash');

      this.veilSpores.push({
        baseX: vl + Math.random() * vw,
        y: vt + Math.random() * vh,
        depth,
        size: (1.2 + Math.random() * 2.5) * depth,
        vy: -(9 + Math.random() * 24) * depth,
        freq: 0.7 + Math.random() * 1.8,
        amp: (12 + Math.random() * 25) * depth,
        phase: Math.random() * Math.PI * 2,
        baseAlpha: 0.35 + Math.random() * 0.55,
        pulseSpeed: 1.1 + Math.random() * 1.9,
        glowType,
        r: col.r,
        g: col.g,
        b: col.b,
      });
    }

    // 2. Vinhas e Raízes Eldritch Rastejantes enraizadas na borda elíptica da arena
    const numTendrils = 22;
    for (let i = 0; i < numTendrils; i++) {
      const baseAng = (i / numTendrils) * Math.PI * 2 + (Math.random() * 0.18 - 0.09);
      const startX = cx + Math.cos(baseAng) * rx;
      const startY = cy + Math.sin(baseAng) * ry;
      const inwardAng = baseAng + Math.PI + (Math.random() * 0.6 - 0.3);
      const length = 50 + Math.random() * 105;
      const numNodes = 6;
      const nodes = [];
      for (let n = 0; n <= numNodes; n++) {
        const t = n / numNodes;
        nodes.push({
          relDist: t * length,
          lateralJitter: (Math.random() - 0.5) * 14 * Math.sin(t * Math.PI),
          swayFreq: 1.1 + Math.random() * 1.6,
          swayPhase: Math.random() * Math.PI * 2,
        });
      }
      this.veilTendrils.push({
        startX,
        startY,
        baseAng,
        inwardAng,
        nodes,
        length,
        thick: 3.2 + Math.random() * 2.6,
        tipPulsePhase: Math.random() * Math.PI * 2,
      });
    }
  }

  /**
   * Renderiza a atmosfera do solo do Véu (escurecimento em tela toda, piso abissal da arena e raízes).
   */
  drawVeilFloorAtmosphere(ctx, arena, now, zoom = 1.0) {
    const cx = arena.arenaCenterX;
    const cy = arena.arenaCenterY;
    const rx = arena.arenaRadiusX;
    const ry = arena.arenaRadiusY;

    // Viewport da tela no espaço do mundo
    const canvas = arena.client?.canvas || ctx.canvas;
    const camX = arena.client?.camX ?? 0;
    const camY = arena.client?.camY ?? 0;
    const viewL = -camX / zoom;
    const viewT = -camY / zoom;
    const viewW = canvas.width / zoom;
    const viewH = canvas.height / zoom;

    const curKey = `${Math.round(cx)}_${Math.round(cy)}_${Math.round(rx)}_${Math.round(ry)}`;
    if (curKey !== this.lastArenaKey || this.veilSpores.length === 0) {
      this.initVeilAtmosphere(cx, cy, rx, ry, viewL, viewT, viewW, viewH);
    }

    ctx.save();

    // 1. Camada Sombria Global do Véu Cobrindo Toda a Tela Visível (Mundo Invertido Fullscreen)
    ctx.fillStyle = arena.isDungeonMode ? 'rgba(7, 11, 24, 0.38)' : 'rgba(7, 11, 24, 0.58)';
    ctx.fillRect(viewL - 80, viewT - 80, viewW + 160, viewH + 160);

    if (arena.isDungeonMode) {
      ctx.restore();
      return;
    }

    // 2. Foco Dimensional Abissal do Piso na Elipse da Arena (Cache inteligente de gradiente)
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    const gradKey = `${Math.round(cx)}_${Math.round(cy)}_${Math.round(rx)}`;
    if (gradKey !== this.lastFloorGradKey || !this.floorGradCache) {
      this.lastFloorGradKey = gradKey;
      const grad = ctx.createRadialGradient(cx, cy, rx * 0.12, cx, cy, rx);
      grad.addColorStop(0, 'rgba(15, 23, 42, 0.35)');
      grad.addColorStop(0.55, 'rgba(30, 27, 75, 0.45)');
      grad.addColorStop(0.85, 'rgba(69, 10, 10, 0.58)');
      grad.addColorStop(1, 'rgba(2, 6, 23, 0.85)');
      this.floorGradCache = grad;
    }
    ctx.fillStyle = this.floorGradCache;
    ctx.fill();

    // 3. Ondas de Distorção Dimensional Concêntricas Pulsantes na Arena
    for (let i = 1; i <= 2; i++) {
      const pulseRatio = 0.38 * i + 0.05 * Math.sin((now / 360) + i);
      const ringAlpha = 0.16 + 0.08 * Math.sin((now / 430) + i * 1.5);
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx * pulseRatio, ry * pulseRatio, 0, 0, Math.PI * 2);
      ctx.strokeStyle = i === 1 ? `rgba(225, 29, 72, ${ringAlpha})` : `rgba(56, 189, 248, ${ringAlpha * 0.8})`;
      ctx.lineWidth = 1.5 / zoom;
      ctx.stroke();
    }

    // 4. Raízes e Tentáculos Eldritch Rastejantes
    for (const tendril of this.veilTendrils) {
      ctx.beginPath();
      ctx.moveTo(tendril.startX, tendril.startY);
      let prevX = tendril.startX;
      let prevY = tendril.startY;

      for (let n = 1; n < tendril.nodes.length; n++) {
        const node = tendril.nodes[n];
        const dist = node.relDist;
        const sway = Math.sin((now / 1000) * node.swayFreq + node.swayPhase) * 5.5;
        const ang = tendril.inwardAng + (node.lateralJitter + sway) * 0.04;
        const nx = tendril.startX + Math.cos(ang) * dist;
        const ny = tendril.startY + Math.sin(ang) * dist * (ry / rx);
        const mx = (prevX + nx) / 2;
        const my = (prevY + ny) / 2;
        ctx.quadraticCurveTo(prevX, prevY, mx, my);
        prevX = nx;
        prevY = ny;
      }
      ctx.lineTo(prevX, prevY);
      ctx.strokeStyle = '#180718';
      ctx.lineWidth = tendril.thick / zoom;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Veia interna avermelhada pulsante
      ctx.strokeStyle = 'rgba(225, 29, 72, 0.58)';
      ctx.lineWidth = Math.max(1, (tendril.thick * 0.38) / zoom);
      ctx.stroke();

      // Ponta bioluminescente orgânica sem shadowBlur (duplo fill rápido)
      const tipPulse = 0.65 + 0.35 * Math.sin((now / 230) + tendril.tipPulsePhase);
      const tipR = (2.2 * tipPulse) / zoom;
      ctx.beginPath();
      ctx.arc(prevX, prevY, tipR * 1.8, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(244, 63, 94, ${0.30 * tipPulse})`;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(prevX, prevY, tipR, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 120, 150, ${0.92 * tipPulse})`;
      ctx.fill();
    }

    // 5. Barreira Elíptica da Arena com Descargas Estáticas de Energia
    const perimeterArcs = 14;
    for (let k = 0; k < perimeterArcs; k++) {
      const arcAng = (k / perimeterArcs) * Math.PI * 2 + ((now / 2200) % (Math.PI * 2));
      const px = cx + Math.cos(arcAng) * rx;
      const py = cy + Math.sin(arcAng) * ry;
      const sparkLen = (6 + Math.sin(now / 160 + k) * 5) / zoom;
      const sparkAng = arcAng + Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(px - Math.cos(sparkAng) * sparkLen, py - Math.sin(sparkAng) * sparkLen);
      ctx.lineTo(px + Math.cos(sparkAng) * sparkLen, py + Math.sin(sparkAng) * sparkLen);
      ctx.strokeStyle = k % 2 === 0 ? 'rgba(244, 63, 94, 0.75)' : 'rgba(56, 189, 248, 0.75)';
      ctx.lineWidth = 1.6 / zoom;
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Renderiza a atmosfera aérea do Véu na tela toda (vinheta sombria, esporos/cinzas 2.5D e relâmpagos).
   */
  drawVeilAirAndSpores(ctx, arena, now, zoom = 1.0) {
    if (!this.veilEffectsEnabled) return;

    // Viewport da tela no espaço do mundo
    const canvas = arena.client?.canvas || ctx.canvas;
    const camX = arena.client?.camX ?? 0;
    const camY = arena.client?.camY ?? 0;
    const viewL = -camX / zoom;
    const viewT = -camY / zoom;
    const viewW = canvas.width / zoom;
    const viewH = canvas.height / zoom;

    const dt = Math.min(0.08, (now - this.lastVeilTime) / 1000);
    this.lastVeilTime = now;

    ctx.save();

    // 1. Vinheta Sombria Fullscreen gerenciada por overlay CSS acelerado por GPU (#veilVignetteOverlay)
    const vigEl = document.getElementById('veilVignetteOverlay');
    if (vigEl && !vigEl.classList.contains('active')) {
      vigEl.classList.add('active');
    }

    // 2. Relâmpago Dimensional do Véu Cortando o Céu da Tela Toda
    if (now >= this.nextVeilLightningTime && !this.veilLightning) {
      this.triggerVeilLightning(viewL, viewT, viewW, viewH, now);
    }

    if (this.veilLightning) {
      const elapsed = now - this.veilLightning.startMs;
      if (elapsed >= this.veilLightning.durationMs) {
        this.veilLightning = null;
      } else {
        const progress = elapsed / this.veilLightning.durationMs;
        const flashAlpha = Math.max(0, 1 - progress);

        // Clarão difuso em toda a tela visível
        ctx.fillStyle = `rgba(225, 29, 72, ${0.10 * flashAlpha})`;
        ctx.fillRect(viewL - 20, viewT - 20, viewW + 40, viewH + 40);

        // Linhas principais do raio avermelhado sem shadowBlur (duplo stroke com glow)
        ctx.beginPath();
        const mainPts = this.veilLightning.mainBranch;
        if (mainPts && mainPts.length > 1) {
          ctx.moveTo(mainPts[0].x, mainPts[0].y);
          for (let p = 1; p < mainPts.length; p++) {
            ctx.lineTo(mainPts[p].x, mainPts[p].y);
          }
        }
        ctx.strokeStyle = `rgba(225, 29, 72, ${0.40 * flashAlpha})`;
        ctx.lineWidth = 5.2 / zoom;
        ctx.stroke();

        ctx.strokeStyle = `rgba(244, 63, 94, ${0.95 * flashAlpha})`;
        ctx.lineWidth = 2.2 / zoom;
        ctx.stroke();

        // Núcleo branco incandescente
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.90 * flashAlpha})`;
        ctx.lineWidth = 0.9 / zoom;
        ctx.stroke();

        // Sub-ramificações
        for (const sub of this.veilLightning.subBranches || []) {
          if (sub.length > 1) {
            ctx.beginPath();
            ctx.moveTo(sub[0].x, sub[0].y);
            for (let sp = 1; sp < sub.length; sp++) {
              ctx.lineTo(sub[sp].x, sub[sp].y);
            }
            ctx.strokeStyle = `rgba(244, 63, 94, ${0.72 * flashAlpha})`;
            ctx.lineWidth = 1.4 / zoom;
            ctx.stroke();
          }
        }
      }
    }

    // 3. Atualização e Renderização dos Esporos / Cinzas Dimensionais Cobrindo a Tela Toda (Textura offscreen ultrarrápida)
    const minY = viewT - 40;
    const maxY = viewT + viewH + 40;

    for (const sp of this.veilSpores) {
      sp.y += sp.vy * dt;

      // Wrap-around vertical em tela cheia
      if (sp.y < minY) {
        sp.y = maxY + Math.random() * 30;
        sp.baseX = viewL + Math.random() * viewW;
      } else if (sp.y > maxY + 60) {
        sp.y = minY;
      }

      // Reajuste horizontal suave se a câmera deslizar
      if (sp.baseX < viewL - 120) sp.baseX = viewL + viewW + Math.random() * 40;
      else if (sp.baseX > viewL + viewW + 120) sp.baseX = viewL - Math.random() * 40;

      const swayX = Math.sin((now / 1000) * sp.freq + sp.phase) * sp.amp;
      const renderX = sp.baseX + swayX;
      const renderY = sp.y;

      const pulse = 0.8 + 0.2 * Math.sin((now / 1000) * sp.pulseSpeed + sp.phase);
      const alpha = Math.max(0.1, Math.min(1.0, sp.baseAlpha * pulse));

      // Zero shadowBlur: renderização direta de textura pré-compilada em offscreen canvas
      const tex = this.sporeGlowTextures[sp.glowType] || this.sporeGlowTextures.ash;
      const drawSize = Math.max(4, (sp.size * 3.6) / zoom);
      ctx.globalAlpha = alpha;
      ctx.drawImage(tex, renderX - drawSize / 2, renderY - drawSize / 2, drawSize, drawSize);
    }
    ctx.globalAlpha = 1.0;

    ctx.restore();
  }

  /**
   * Dispara um relâmpago ramificado avermelhado cortando os céus da tela toda.
   */
  triggerVeilLightning(viewL, viewT, viewW, viewH, now) {
    this.nextVeilLightningTime = now + 3500 + Math.random() * 4000;
    const startX = viewL + (0.15 + Math.random() * 0.70) * viewW;
    const startY = viewT - 20;
    const numSegments = 8;
    const mainBranch = [{ x: startX, y: startY }];

    let curX = startX;
    let curY = startY;
    const segH = (viewH * 0.75) / numSegments;
    const subBranches = [];

    for (let s = 1; s <= numSegments; s++) {
      curX += (Math.random() - 0.5) * 65;
      curY += segH * (0.8 + Math.random() * 0.4);
      mainBranch.push({ x: curX, y: curY });

      if (s === 3 || s === 5) {
        const subBranch = [{ x: curX, y: curY }];
        let subX = curX;
        let subY = curY;
        const subSegments = 3;
        for (let ss = 0; ss < subSegments; ss++) {
          subX += (Math.random() - 0.5) * 55;
          subY += segH * 0.7;
          subBranch.push({ x: subX, y: subY });
        }
        subBranches.push(subBranch);
      }
    }

    this.veilLightning = {
      startMs: now,
      durationMs: 290,
      mainBranch,
      subBranches,
    };
  }

  /**
   * Alterna ligar/desligar os efeitos do Véu, persistindo no localStorage.
   */
  toggleVeilEffects(forcedState) {
    if (typeof forcedState === 'boolean') {
      this.veilEffectsEnabled = forcedState;
    } else {
      this.veilEffectsEnabled = !this.veilEffectsEnabled;
    }
    const vigEl = document.getElementById('veilVignetteOverlay');
    if (vigEl) {
      if (this.veilEffectsEnabled) vigEl.classList.add('active');
      else vigEl.classList.remove('active');
    }
    try {
      localStorage.setItem('etheria_veil_effects', this.veilEffectsEnabled ? 'true' : 'false');
    } catch {}
    return this.veilEffectsEnabled;
  }
}

window.ActionVfxRenderer = ActionVfxRenderer;
