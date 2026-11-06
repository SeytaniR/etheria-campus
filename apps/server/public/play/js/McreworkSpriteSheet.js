/**
 * @file apps/server/public/play/js/McreworkSpriteSheet.js
 * @module @etheria/server
 * @description Carregador e Animador 8-Direções de Atlas de Sprites (`mcrework`) para Personagens e NPCs.
 *   Aplica escala proporcional calibrada (-30% do tamanho bruto original, scale = 0.70) para proporção perfeita no mapa 2.5D.
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

  draw(ctx, worldX, worldY, action, direction, elapsedMs, alpha = 1.0) {
    this.load();

    ctx.save();
    ctx.globalAlpha = alpha;

    // Escala calibrada: redução de 30% nos modelos para proporção anatômica ideal no cenário 2.5D
    const scale = 0.70;

    // Sombra elíptica proporcional nos pés da entidade
    ctx.beginPath();
    ctx.ellipse(worldX, worldY, Math.round(18 * scale), Math.round(9 * scale), 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fill();

    if (this.ready && this.atlasData && this.image) {
      const anims = this.atlasData.animations || {};
      const frames = this.atlasData.frames || {};
      const dir = ((direction % 8) + 8) % 8;

      // No mcrework, a chave da animação é `${dir}-${action}`
      // Ações: 0 = Parado (Stand), 1 = Caminhada (Walk), 2 = Corrida (Run), 3 = Golpe (Atk)...
      const primaryKey = `${dir}-${action}`;
      let seq =
        anims[primaryKey] ||
        (action !== 0 ? anims[`${dir}-1`] : null) ||
        anims[`${dir}-0`] ||
        anims[`0-${action}`] ||
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

          // Ancoragem padrão nos pés (0.5 no X, 0.92 no Y)
          const anchorX = 0.5;
          const anchorY = 0.92;
          const drawX = Math.round(worldX - origW * anchorX + offX);
          const drawY = Math.round(worldY - origH * anchorY + offY);

          ctx.drawImage(this.image, sx, sy, sw, sh, drawX, drawY, drawW, drawH);
          ctx.restore();
          return;
        }
      }
    }

    // Fallback para miniatura com escala proporcional enquanto o atlas carrega
    if (this.thumbImage) {
      const w = Math.round(64 * scale);
      const h = Math.round(76 * scale);
      ctx.drawImage(this.thumbImage, Math.round(worldX - w / 2), Math.round(worldY - h * 0.92), w, h);
    } else {
      ctx.beginPath();
      ctx.arc(worldX, worldY - Math.round(24 * scale), Math.round(16 * scale), 0, Math.PI * 2);
      ctx.fillStyle = '#38bdf8';
      ctx.fill();
    }

    ctx.restore();
  }
}

window.McreworkSpriteSheet = McreworkSpriteSheet;
