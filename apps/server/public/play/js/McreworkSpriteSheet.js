/**
 * @file apps/server/public/play/js/McreworkSpriteSheet.js
 * @module @etheria/server
 * @description Carregador e Animador 8-Direções de Atlas de Sprites (`mcrework`) para Personagens e NPCs.
 *   Aplica escala calibrada (-30% do tamanho bruto, scale = 0.70) e recorte anatômico de sobreposição
 *   (apenas a região do corpo que estiver sob polígonos de overlap recebe opacidade, mantendo o restante 100% opaco).
 */

class McreworkSpriteSheet {
  constructor(atlasJsonUrl, atlasWebpUrl, thumbUrl) {
    this.atlasJsonUrl = atlasJsonUrl;
    this.atlasWebpUrl = atlasWebpUrl;
    this.thumbUrl = thumbUrl;
    this.atlasData = null;
    this.image = null;
    this.thumbImage = null;
    this.ready = false;
    this.loading = false;
  }

  load() {
    if (this.loading || this.ready) return;
    this.loading = true;

    if (this.thumbUrl) {
      const tImg = new Image();
      tImg.crossOrigin = 'anonymous';
      tImg.onload = () => {
        this.thumbImage = tImg;
      };
      tImg.src = this.thumbUrl;
    }

    fetch(this.atlasJsonUrl)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((json) => {
        this.atlasData = json;
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          this.image = img;
          this.ready = true;
        };
        img.src = this.atlasWebpUrl;
      })
      .catch(() => {
        this.loading = false;
      });
  }

  /**
   * Renderiza o sprite aplicando máscara de recorte (clipping) anatômica:
   * - A parte do corpo que estiver FORA dos polígonos de sobreposição fica 100% opaca (globalAlpha = 1.0).
   * - APENAS a parte do corpo que estiver SOBREPOSTA (sob telhado, copa de árvore, etc.) recebe overlapAlpha.
   */
  renderSpriteWithOverlapClipping(ctx, img, sx, sy, sw, sh, dx, dy, dw, dh, meshOrAlpha) {
    // 1. Compatibilidade com chamadas legadas passando alpha numérico direto
    if (typeof meshOrAlpha === 'number') {
      ctx.globalAlpha = meshOrAlpha;
      ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
      return;
    }

    const mesh = meshOrAlpha;
    const hittingPolys =
      mesh && typeof mesh.getIntersectingOverlapPolygons === 'function'
        ? mesh.getIntersectingOverlapPolygons(dx, dy, dw, dh)
        : [];

    // Se o sprite não toca em nenhum polígono de sobreposição: fast-path 100% opaco
    if (hittingPolys.length === 0) {
      ctx.globalAlpha = 1.0;
      ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
      return;
    }

    // Opacidade para a parte sobreposta do corpo (restringe entre 0.1 e 0.9, padrão ~0.50)
    const overlapAlpha = Math.max(0.1, Math.min(0.9, Number(mesh.overlapOpacity) || 0.50));

    // 2. Parte do corpo FORA da sobreposição: 100% opaca via recorte 'evenodd'
    ctx.save();
    ctx.beginPath();
    ctx.rect(dx - 30, dy - 30, dw + 60, dh + 60);
    for (let pIdx = 0; pIdx < hittingPolys.length; pIdx++) {
      const pts = hittingPolys[pIdx].points;
      if (!pts || pts.length < 3) continue;
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.closePath();
    }
    ctx.clip('evenodd');
    ctx.globalAlpha = 1.0;
    ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
    ctx.restore();

    // 3. Parte do corpo DENTRO da sobreposição: somente a região coberta recebe overlapAlpha
    ctx.save();
    ctx.beginPath();
    for (let pIdx = 0; pIdx < hittingPolys.length; pIdx++) {
      const pts = hittingPolys[pIdx].points;
      if (!pts || pts.length < 3) continue;
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.closePath();
    }
    ctx.clip();
    ctx.globalAlpha = overlapAlpha;
    ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
    ctx.restore();
  }

  draw(ctx, worldX, worldY, action, direction, elapsedMs, meshOrAlpha = null, groundOffsetY = 0) {
    this.load();

    ctx.save();

    // Escala calibrada: redução de 30% nos modelos para proporção anatômica ideal no cenário 2.5D
    const scale = 0.70;
    const gOffY = Math.round((Number(groundOffsetY) || 0) * scale);

    // Sombra elíptica proporcional nos pés da entidade (sempre no nível do chão fixo)
    ctx.beginPath();
    ctx.ellipse(worldX, worldY, Math.round(18 * scale), Math.round(9 * scale), 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fill();

    if (this.ready && this.atlasData && this.image) {
      const anims = this.atlasData.animations || {};
      const frames = this.atlasData.frames || {};
      const dir = ((direction % 8) + 8) % 8;

      // No mcrework, a chave da animação é `${action}-${dir}`
      // Ações: 0 = Parado (Stand), 1 = Caminhada (Walk), 2 = Corrida (Run), 3 = Golpe (Atk)...
      // Direções: 0 = Sul (Frente), 1 = Sudeste, 2 = Leste, 3 = Nordeste, 4 = Norte (Costas), 5 = Noroeste, 6 = Oeste, 7 = Sudoeste
      const primaryKey = `${action}-${dir}`;
      let seq =
        anims[primaryKey] ||
        (action !== 0 ? anims[`1-${dir}`] : null) ||
        anims[`0-${dir}`] ||
        anims[`${action}-0`] ||
        anims['0-0'] ||
        Object.values(anims)[0];

      if (!Array.isArray(seq) || seq.length === 0) {
        seq = Object.keys(frames);
      }

      if (seq.length > 0) {
        // No mcrework oficial, cada frame tem 80ms (12.5 FPS) com repetições calibradas no atlas
        const frameIdx = Math.floor((elapsedMs / 80) % seq.length);
        const frameKey = seq[frameIdx];
        const fObj = frames[frameKey];

        if (fObj && fObj.frame) {
          const sx = fObj.frame.x;
          const sy = fObj.frame.y;
          const sw = fObj.frame.w;
          const sh = fObj.frame.h;

          const origW = (fObj.sourceSize?.w || sw) * scale;
          const origH = (fObj.sourceSize?.h || sh) * scale;
          const offX = (fObj.spriteSourceSize?.x || 0) * scale;
          const offY = (fObj.spriteSourceSize?.y || 0) * scale;
          const drawW = Math.round(sw * scale);
          const drawH = Math.round(sh * scale);

          // Ancoragem nos pés (0.5 no X, 0.92 no Y) + ajuste fino customizado de distância ao chão (gOffY)
          const anchorX = 0.5;
          const anchorY = 0.92;
          const drawX = Math.round(worldX - origW * anchorX + offX);
          const drawY = Math.round(worldY - origH * anchorY + offY + gOffY);

          this.renderSpriteWithOverlapClipping(
            ctx,
            this.image,
            sx, sy, sw, sh,
            drawX, drawY, drawW, drawH,
            meshOrAlpha
          );
          ctx.restore();
          return;
        }
      }
    }

    // Fallback para miniatura com escala proporcional enquanto o atlas carrega
    if (this.thumbImage) {
      const w = Math.round(64 * scale);
      const h = Math.round(76 * scale);
      const drawX = Math.round(worldX - w / 2);
      const drawY = Math.round(worldY - h * 0.92 + gOffY);
      const imgW = this.thumbImage.naturalWidth || this.thumbImage.width || w;
      const imgH = this.thumbImage.naturalHeight || this.thumbImage.height || h;
      this.renderSpriteWithOverlapClipping(
        ctx,
        this.thumbImage,
        0, 0, imgW, imgH,
        drawX, drawY, w, h,
        meshOrAlpha
      );
    } else {
      ctx.beginPath();
      ctx.arc(worldX, worldY - Math.round(24 * scale) + gOffY, Math.round(16 * scale), 0, Math.PI * 2);
      ctx.fillStyle = '#38bdf8';
      ctx.fill();
    }

    ctx.restore();
  }
}

window.McreworkSpriteSheet = McreworkSpriteSheet;
