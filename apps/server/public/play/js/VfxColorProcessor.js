/**
 * @file apps/server/public/play/js/VfxColorProcessor.js
 * @module @etheria/shared-client
 * @description Processador de Cores de Partículas VFX para Spritesheets e Miniaturas Transparentes (RGBA).
 *   - Recolore partículas brancas, monocromáticas ou coloridas mantendo 100% do canal alfa transparente,
 *     suavidade de halo (anti-aliasing/glow) e sombras internas.
 *   - Pré-assado (pre-baked) em Canvas Offscreen cacheado em WeakMap (custo ZERO por frame em 60 FPS).
 *   - Compartilhado entre o Estúdio `/admin` (Preview 2.5D e Tabelas) e o cliente `/play` (Combate Real).
 * @rules Segue estritamente AGENTS.md (Pilar 2: Performance WebGL/Canvas e Pilar 3: OOP Modular).
 */

class VfxColorProcessor {
  static MAX_COLORS_PER_IMAGE = 12;
  static MAX_THUMB_ENTRIES = 160;
  static tintCache = new WeakMap();
  static thumbCache = new Map();

  /**
   * Valida e normaliza uma string Hexadecimal (`#RGB` ou `#RRGGBB`).
   * Retorna `{ r, g, b, hex }` ou `null` quando vazia/inválida (cor original).
   */
  static parseHexColor(rawHex) {
    if (!rawHex || typeof rawHex !== 'string') return null;
    const trimmed = rawHex.trim();
    if (!trimmed) return null;

    let match = trimmed.match(/^#?([0-9a-fA-F]{6})$/);
    if (match) {
      const hex = match[1].toLowerCase();
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        hex: `#${hex}`,
      };
    }

    match = trimmed.match(/^#?([0-9a-fA-F]{3})$/);
    if (match) {
      const s = match[1].toLowerCase();
      const hex = `${s[0]}${s[0]}${s[1]}${s[1]}${s[2]}${s[2]}`;
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        hex: `#${hex}`,
      };
    }

    return null;
  }

  /**
   * Garante intensidade inteira entre 0 e 100%.
   */
  static clampIntensity(rawVal, fallback = 100) {
    if (rawVal === undefined || rawVal === null || rawVal === '' || Number.isNaN(Number(rawVal))) {
      return fallback;
    }
    return Math.max(0, Math.min(100, Math.round(Number(rawVal))));
  }

  /**
   * Retorna a versão tingida do atlas/imagem em cache Offscreen Canvas (ou a própria imagem se original).
   * Preserva integralmente pixels transparentes (alpha === 0) e preserva degradê luminoso das partículas.
   */
  static getTintedSource(sourceImg, colorHex, intensityPct = 100) {
    if (!sourceImg) return null;
    const parsed = this.parseHexColor(colorHex);
    const intensity = this.clampIntensity(intensityPct, 100);
    if (!parsed || intensity <= 0) {
      return sourceImg;
    }

    const w = sourceImg.naturalWidth || sourceImg.width || 0;
    const h = sourceImg.naturalHeight || sourceImg.height || 0;
    if (w <= 0 || h <= 0) {
      return sourceImg;
    }

    let imgMap = this.tintCache.get(sourceImg);
    if (!imgMap) {
      imgMap = new Map();
      this.tintCache.set(sourceImg, imgMap);
    }

    const cacheKey = `${parsed.hex}_${intensity}`;
    if (imgMap.has(cacheKey)) {
      return imgMap.get(cacheKey);
    }

    const offscreen = document.createElement('canvas');
    offscreen.width = w;
    offscreen.height = h;
    const octx = offscreen.getContext('2d', { willReadFrequently: true });
    if (!octx) return sourceImg;

    octx.clearRect(0, 0, w, h);
    octx.drawImage(sourceImg, 0, 0, w, h);

    const mix = intensity / 100;
    const invMix = 1 - mix;
    const tr = parsed.r;
    const tg = parsed.g;
    const tb = parsed.b;

    try {
      const imgData = octx.getImageData(0, 0, w, h);
      const data = imgData.data;
      const len = data.length;

      for (let i = 0; i < len; i += 4) {
        const a = data[i + 3];
        // Fundo transparente permanece intocado
        if (a === 0) continue;

        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Combina pico RGB com luminância Rec.601 para tingir partículas brancas (100%)
        // mantendo contraste de núcleo e halos coloridos sem escurecer azuis/vermelhos.
        const maxCh = r > g ? (r > b ? r : b) : (g > b ? g : b);
        const peak = maxCh / 255;
        const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        const effectiveLuma = 0.65 * peak + 0.35 * lum;

        data[i] = Math.round(r * invMix + tr * effectiveLuma * mix);
        data[i + 1] = Math.round(g * invMix + tg * effectiveLuma * mix);
        data[i + 2] = Math.round(b * invMix + tb * effectiveLuma * mix);
        // Canal alfa original mantido exatamente igual (a)
      }

      octx.putImageData(imgData, 0, 0);
    } catch (_corsFallback) {
      // Fallback seguro via compositing caso o canvas esteja marcado como tainted por CORS
      octx.globalCompositeOperation = 'source-atop';
      octx.globalAlpha = mix;
      octx.fillStyle = parsed.hex;
      octx.fillRect(0, 0, w, h);
      octx.globalCompositeOperation = 'source-over';
      octx.globalAlpha = 1.0;
    }

    // Eviction FIFO para evitar crescimento infinito ao arrastar seletor de cor ao vivo
    if (imgMap.size >= this.MAX_COLORS_PER_IMAGE) {
      const oldestKey = imgMap.keys().next().value;
      if (oldestKey !== undefined) {
        imgMap.delete(oldestKey);
      }
    }
    imgMap.set(cacheKey, offscreen);

    return offscreen;
  }

  /**
   * Desenha um quadro animado de um Atlas VFX no contexto Canvas aplicando tintura em tempo real.
   */
  static drawVfxFrame(
    ctx,
    atlasImage,
    atlasData,
    elapsedMs,
    centerX,
    centerY,
    scale = 0.85,
    colorHex = null,
    intensityPct = 100
  ) {
    if (!ctx || !atlasImage || !atlasData) return;

    const frames = atlasData.frames || {};
    const seq = atlasData.animations?.play || Object.keys(frames);
    if (!seq || seq.length === 0) return;

    const frameIdx = Math.floor((Math.max(0, elapsedMs) / 75) % seq.length);
    const fObj = frames[seq[frameIdx]];
    if (!fObj || !fObj.frame) return;

    const sx = fObj.frame.x;
    const sy = fObj.frame.y;
    const sw = fObj.frame.w;
    const sh = fObj.frame.h;
    const dw = Math.round(sw * scale);
    const dh = Math.round(sh * scale);

    const drawSource = this.getTintedSource(atlasImage, colorHex, intensityPct) || atlasImage;

    ctx.save();
    ctx.drawImage(
      drawSource,
      sx,
      sy,
      sw,
      sh,
      Math.round(centerX - dw / 2),
      Math.round(centerY - dh / 2),
      dw,
      dh
    );
    ctx.restore();
  }

  /**
   * Renderiza uma miniatura de VFX (`thumb.png`) já colorida em um elemento `<canvas>`.
   * Carrega de forma assíncrona com CORS habilitado e atualiza automaticamente todos os canvases pendentes.
   */
  static renderThumbToCanvas(canvasEl, thumbUrl, colorHex = null, intensityPct = 100) {
    if (!canvasEl) return;
    canvasEl.dataset.vfxThumb = thumbUrl || '';
    canvasEl.dataset.vfxColor = colorHex || '';
    canvasEl.dataset.vfxIntensity = String(this.clampIntensity(intensityPct, 100));

    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;

    const cw = canvasEl.width || 42;
    const ch = canvasEl.height || 42;
    ctx.clearRect(0, 0, cw, ch);

    if (!thumbUrl) return;

    let entry = this.thumbCache.get(thumbUrl);
    if (!entry) {
      if (this.thumbCache.size >= this.MAX_THUMB_ENTRIES) {
        const oldestKey = this.thumbCache.keys().next().value;
        if (oldestKey !== undefined) {
          this.thumbCache.delete(oldestKey);
        }
      }
      entry = { ready: false, image: null, error: false, waiters: new Set() };
      this.thumbCache.set(thumbUrl, entry);

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        entry.image = img;
        entry.ready = true;
        const listeners = Array.from(entry.waiters);
        entry.waiters.clear();
        for (const waitingCanvas of listeners) {
          if (waitingCanvas.isConnected && waitingCanvas.dataset.vfxThumb === thumbUrl) {
            this.drawThumbImageOnCanvas(
              waitingCanvas,
              img,
              waitingCanvas.dataset.vfxColor || null,
              Number(waitingCanvas.dataset.vfxIntensity ?? 100)
            );
          }
        }
      };
      img.onerror = () => {
        entry.error = true;
        entry.waiters.clear();
      };
      img.src = thumbUrl;
    }

    if (entry.ready && entry.image) {
      this.drawThumbImageOnCanvas(canvasEl, entry.image, colorHex, intensityPct);
    } else if (!entry.error) {
      entry.waiters.add(canvasEl);
    }
  }

  static drawThumbImageOnCanvas(canvasEl, img, colorHex, intensityPct) {
    const ctx = canvasEl.getContext('2d');
    if (!ctx || !img) return;

    const cw = canvasEl.width || 42;
    const ch = canvasEl.height || 42;
    const iw = img.naturalWidth || img.width || cw;
    const ih = img.naturalHeight || img.height || ch;
    if (iw <= 0 || ih <= 0) return;

    const scale = Math.min(cw / iw, ch / ih);
    const dw = Math.max(1, Math.round(iw * scale));
    const dh = Math.max(1, Math.round(ih * scale));
    const dx = Math.round((cw - dw) / 2);
    const dy = Math.round((ch - dh) / 2);

    const tinted = this.getTintedSource(img, colorHex, intensityPct) || img;
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(tinted, 0, 0, iw, ih, dx, dy, dw, dh);
  }

  /**
   * Hidrata todas as miniaturas `<canvas class="vfx-color-thumb">` dentro de um container DOM.
   */
  static hydrateAllThumbCanvases(root = document) {
    if (!root || typeof root.querySelectorAll !== 'function') return;
    const list = root.querySelectorAll('canvas.vfx-color-thumb[data-vfx-thumb]');
    list.forEach((canvas) => {
      const url = canvas.dataset.vfxThumb || '';
      const color = canvas.dataset.vfxColor || null;
      const intensity = Number(canvas.dataset.vfxIntensity ?? 100);
      this.renderThumbToCanvas(canvas, url, color, intensity);
    });
  }
}

window.VfxColorProcessor = VfxColorProcessor;
