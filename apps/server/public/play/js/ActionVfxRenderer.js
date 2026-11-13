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

  drawActiveBursts(ctx, now) {
    for (let i = this.activeBursts.length - 1; i >= 0; i--) {
      const b = this.activeBursts[i];
      const elapsed = now - b.startMs;
      if (elapsed >= b.durationMs) {
        this.activeBursts.splice(i, 1);
        continue;
      }
      this.drawVfxFrame(ctx, b.vfxKey, b.x, b.y, elapsed, b.scale, b.colorHex, b.intensityPct);
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
}

window.ActionVfxRenderer = ActionVfxRenderer;
