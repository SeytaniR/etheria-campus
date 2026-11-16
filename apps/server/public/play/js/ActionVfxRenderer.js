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
      ctx.beginPath();
      ctx.arc(cx + Math.cos(ang) * rx, cy + Math.sin(ang) * ry, 4.5 / zoom, 0, Math.PI * 2);
      ctx.fillStyle = '#38bdf8';
      ctx.fill();
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
      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6.5 / zoom, 0, Math.PI * 2);
      ctx.fillStyle = p.color || '#fde047';
      ctx.shadowColor = p.color || '#fde047';
      ctx.shadowBlur = 10;
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

    // 1. Anel externo com brilho e borda em destaque
    ctx.beginPath();
    ctx.ellipse(target.x, target.y - 4, rx, ry, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.90)';
    ctx.lineWidth = 2.4 / zoom;
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 9;
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
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 8;
    ctx.fillText('▼', target.x, cy);
    ctx.restore();
  }

  drawFloatingTexts(ctx, floatingTexts) {
    for (const f of floatingTexts || []) {
      ctx.save();
      ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = f.color || '#fff';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
      ctx.shadowBlur = 3;
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }
  }

  /* ==========================================================================
     ATMOSFERA DO VÉU / THE VEIL (MUNDO INVERTIDO DE STRANGER THINGS)
     ========================================================================== */

  /**
   * Inicializa partículas e raízes dimensionais alinhadas à elipse da arena instanciada.
   */
  initVeilAtmosphere(cx, cy, rx, ry) {
    this.lastArenaKey = `${Math.round(cx)}_${Math.round(cy)}_${Math.round(rx)}_${Math.round(ry)}`;
    this.veilSpores = [];
    this.veilTendrils = [];
    this.veilLightning = null;
    this.nextVeilLightningTime = performance.now() + 3200 + Math.random() * 2500;
    this.lastVeilTime = performance.now();

    // 1. Esporos e Cinzas Dimensionais Flutuantes (85 partículas com paralaxe 2.5D)
    const sporeColors = [
      { r: 203, g: 213, b: 225 }, // 55% Cinza Ectoplasmático / Cinzas do Véu
      { r: 56, g: 189, b: 248 },  // 25% Ciano Necrótico Fantasmal
      { r: 244, g: 63, b: 94 },   // 20% Carmesim Dimensional
    ];

    for (let i = 0; i < 85; i++) {
      const ang = Math.random() * Math.PI * 2;
      const distRatio = Math.sqrt(Math.random()) * 1.08;
      const depth = 0.35 + Math.random() * 0.85;
      const roll = Math.random();
      const col = roll > 0.80 ? sporeColors[2] : (roll > 0.55 ? sporeColors[1] : sporeColors[0]);

      this.veilSpores.push({
        baseX: cx + Math.cos(ang) * rx * distRatio,
        y: cy + Math.sin(ang) * ry * distRatio + (Math.random() * 40 - 20),
        depth,
        size: (1.2 + Math.random() * 2.4) * depth,
        vy: -(9 + Math.random() * 22) * depth,
        freq: 0.8 + Math.random() * 1.8,
        amp: (10 + Math.random() * 22) * depth,
        phase: Math.random() * Math.PI * 2,
        baseAlpha: 0.35 + Math.random() * 0.55,
        pulseSpeed: 1.2 + Math.random() * 2.0,
        r: col.r,
        g: col.g,
        b: col.b,
      });
    }

    // 2. Vinhas e Raízes Eldritch Rastejantes enraizadas na borda elíptica
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
   * Renderiza a atmosfera do solo do Véu (piso elíptico abissal, distorções dimensionais e raízes).
   */
  drawVeilFloorAtmosphere(ctx, arena, now, zoom = 1.0) {
    const cx = arena.arenaCenterX;
    const cy = arena.arenaCenterY;
    const rx = arena.arenaRadiusX;
    const ry = arena.arenaRadiusY;
    const curKey = `${Math.round(cx)}_${Math.round(cy)}_${Math.round(rx)}_${Math.round(ry)}`;
    if (curKey !== this.lastArenaKey || this.veilSpores.length === 0) {
      this.initVeilAtmosphere(cx, cy, rx, ry);
    }

    ctx.save();

    // 1. Piso Sombrio Abissal do Véu Delimitado na Elipse da Arena
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(cx, cy, rx * 0.12, cx, cy, rx);
    grad.addColorStop(0, 'rgba(15, 23, 42, 0.42)');
    grad.addColorStop(0.55, 'rgba(30, 27, 75, 0.52)');
    grad.addColorStop(0.85, 'rgba(69, 10, 10, 0.65)');
    grad.addColorStop(1, 'rgba(2, 6, 23, 0.90)');
    ctx.fillStyle = grad;
    ctx.fill();

    // 2. Ondas de Distorção Dimensional Concêntricas Pulsantes
    for (let i = 1; i <= 2; i++) {
      const pulseRatio = 0.38 * i + 0.05 * Math.sin((now / 360) + i);
      const ringAlpha = 0.15 + 0.08 * Math.sin((now / 430) + i * 1.5);
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx * pulseRatio, ry * pulseRatio, 0, 0, Math.PI * 2);
      ctx.strokeStyle = i === 1 ? `rgba(225, 29, 72, ${ringAlpha})` : `rgba(56, 189, 248, ${ringAlpha * 0.8})`;
      ctx.lineWidth = 1.5 / zoom;
      ctx.stroke();
    }

    // 3. Raízes e Tentáculos Eldritch Rastejantes
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

      // Ponta bioluminescente orgânica
      const tipPulse = 0.65 + 0.35 * Math.sin((now / 230) + tendril.tipPulsePhase);
      ctx.beginPath();
      ctx.arc(prevX, prevY, (2.3 * tipPulse) / zoom, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(244, 63, 94, ${0.85 * tipPulse})`;
      ctx.shadowColor = '#f43f5e';
      ctx.shadowBlur = 6;
      ctx.fill();
    }

    // 4. Barreira Elíptica do Véu com Descargas Estáticas de Energia
    const perimeterArcs = 12;
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
   * Renderiza a atmosfera aérea do Véu (esporos/cinzas 2.5D com paralaxe e relâmpagos avermelhados).
   */
  drawVeilAirAndSpores(ctx, arena, now, zoom = 1.0) {
    if (!this.veilEffectsEnabled) return;
    const cx = arena.arenaCenterX;
    const cy = arena.arenaCenterY;
    const rx = arena.arenaRadiusX;
    const ry = arena.arenaRadiusY;
    const dt = Math.min(0.08, (now - this.lastVeilTime) / 1000);
    this.lastVeilTime = now;

    ctx.save();

    // 1. Relâmpago Dimensional do Véu (Red Atmospheric Lightning no Céu)
    if (now >= this.nextVeilLightningTime && !this.veilLightning) {
      this.triggerVeilLightning(cx, cy, rx, ry, now);
    }

    if (this.veilLightning) {
      const elapsed = now - this.veilLightning.startMs;
      if (elapsed >= this.veilLightning.durationMs) {
        this.veilLightning = null;
      } else {
        const progress = elapsed / this.veilLightning.durationMs;
        const flashAlpha = Math.max(0, 1 - progress);

        // Clarão difuso na atmosfera do Véu
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx * 1.15, ry * 1.15, 0, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(225, 29, 72, ${0.09 * flashAlpha})`;
        ctx.fill();

        // Linhas principais do raio avermelhado
        ctx.beginPath();
        const mainPts = this.veilLightning.mainBranch;
        if (mainPts && mainPts.length > 1) {
          ctx.moveTo(mainPts[0].x, mainPts[0].y);
          for (let p = 1; p < mainPts.length; p++) {
            ctx.lineTo(mainPts[p].x, mainPts[p].y);
          }
        }
        ctx.strokeStyle = `rgba(244, 63, 94, ${0.92 * flashAlpha})`;
        ctx.lineWidth = 2.4 / zoom;
        ctx.shadowColor = '#e11d48';
        ctx.shadowBlur = 12;
        ctx.stroke();

        // Núcleo branco incandescente
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.85 * flashAlpha})`;
        ctx.lineWidth = 1.0 / zoom;
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

    // 2. Atualização e Renderização dos Esporos / Cinzas Dimensionais (Stranger Things Style)
    for (const sp of this.veilSpores) {
      sp.y += sp.vy * dt;

      // Wrap-around vertical quando passa do topo da arena
      const minY = cy - ry * 1.15;
      const maxY = cy + ry * 1.10;
      if (sp.y < minY) {
        sp.y = maxY + (Math.random() * 20);
        const ang = Math.random() * Math.PI * 2;
        const distRatio = Math.sqrt(Math.random()) * 0.95;
        sp.baseX = cx + Math.cos(ang) * rx * distRatio;
      }

      const swayX = Math.sin((now / 1000) * sp.freq + sp.phase) * sp.amp;
      const renderX = sp.baseX + swayX;
      const renderY = sp.y;

      const pulse = 0.8 + 0.2 * Math.sin((now / 1000) * sp.pulseSpeed + sp.phase);
      const alpha = Math.max(0.1, Math.min(1.0, sp.baseAlpha * pulse));

      ctx.beginPath();
      ctx.arc(renderX, renderY, sp.size / zoom, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${sp.r}, ${sp.g}, ${sp.b}, ${alpha})`;
      ctx.shadowColor = `rgb(${sp.r}, ${sp.g}, ${sp.b})`;
      ctx.shadowBlur = 4;
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Dispara um relâmpago ramificado avermelhado cortando os céus do Véu.
   */
  triggerVeilLightning(cx, cy, rx, ry, now) {
    this.nextVeilLightningTime = now + 3500 + Math.random() * 4000;
    const startX = cx + (Math.random() * rx * 1.2 - rx * 0.6);
    const startY = cy - ry * 1.25;
    const numSegments = 7;
    const mainBranch = [{ x: startX, y: startY }];

    let curX = startX;
    let curY = startY;
    const segH = (ry * 1.6) / numSegments;
    const subBranches = [];

    for (let s = 1; s <= numSegments; s++) {
      curX += (Math.random() - 0.5) * 55;
      curY += segH * (0.8 + Math.random() * 0.4);
      mainBranch.push({ x: curX, y: curY });

      if (s === 3 || s === 5) {
        const subBranch = [{ x: curX, y: curY }];
        let subX = curX;
        let subY = curY;
        const subSegments = 3;
        for (let ss = 0; ss < subSegments; ss++) {
          subX += (Math.random() - 0.5) * 45;
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
    try {
      localStorage.setItem('etheria_veil_effects', this.veilEffectsEnabled ? 'true' : 'false');
    } catch {}
    return this.veilEffectsEnabled;
  }
}

window.ActionVfxRenderer = ActionVfxRenderer;
