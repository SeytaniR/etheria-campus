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
        if (typeof window !== 'undefined' && typeof window.onMcreworkSpriteLoaded === 'function') {
          window.onMcreworkSpriteLoaded(this);
        }
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
          if (typeof window !== 'undefined' && typeof window.onMcreworkSpriteLoaded === 'function') {
            window.onMcreworkSpriteLoaded(this);
          }
        };
        img.src = this.atlasWebpUrl;
      })
      .catch(() => {
        this.loading = false;
      });
  }

  drawImageMaybeFlipped(ctx, img, sx, sy, sw, sh, dx, dy, dw, dh, flipX) {
    if (!flipX) {
      ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
      return;
    }
    ctx.save();
    ctx.translate(dx + dw, dy);
    ctx.scale(-1, 1);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);
    ctx.restore();
  }

  /**
   * Renderiza o sprite aplicando máscara de recorte (clipping) anatômica:
   * - A parte do corpo que estiver FORA dos polígonos de sobreposição fica 100% opaca (globalAlpha = 1.0).
   * - APENAS a parte do corpo que estiver SOBREPOSTA (sob telhado, copa de árvore, etc.) recebe overlapAlpha.
   */
  renderSpriteWithOverlapClipping(ctx, img, sx, sy, sw, sh, dx, dy, dw, dh, meshOrAlpha, flipX = false) {
    // 1. Compatibilidade com chamadas legadas passando alpha numérico direto
    if (typeof meshOrAlpha === 'number') {
      ctx.globalAlpha = meshOrAlpha;
      this.drawImageMaybeFlipped(ctx, img, sx, sy, sw, sh, dx, dy, dw, dh, flipX);
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
      this.drawImageMaybeFlipped(ctx, img, sx, sy, sw, sh, dx, dy, dw, dh, flipX);
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
    this.drawImageMaybeFlipped(ctx, img, sx, sy, sw, sh, dx, dy, dw, dh, flipX);
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
    this.drawImageMaybeFlipped(ctx, img, sx, sy, sw, sh, dx, dy, dw, dh, flipX);
    ctx.restore();
  }

  draw(
    ctx,
    worldX,
    worldY,
    action,
    direction,
    elapsedMs,
    meshOrAlpha = null,
    groundOffsetY = 0,
    customScale = 0.70,
    clampLastFrame = false,
    shadowOffsetX = 0,
    shadowOffsetY = 0
  ) {
    this.load();

    ctx.save();

    // Escala calibrada: padrão 0.70 no mundo aberto (-30% do bruto) ou customScale na Arena/Preview
    const scale = Number(customScale) > 0 ? Number(customScale) : 0.70;
    const gOffY = Math.round((Number(groundOffsetY) || 0) * scale);
    const sOffX = Math.round((Number(shadowOffsetX) || 0) * scale);
    const sOffY = Math.round((Number(shadowOffsetY) || 0) * scale);

    // Sombra elíptica proporcional nos pés da entidade (com ajuste fino shadowOffsetX / shadowOffsetY)
    ctx.beginPath();
    ctx.ellipse(worldX + sOffX, worldY + sOffY, Math.round(18 * scale), Math.round(9 * scale), 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fill();

    const rawDir = (((Number(direction) || 0) % 8) + 8) % 8;
    const isMonster = Boolean(this.atlasJsonUrl && this.atlasJsonUrl.includes('/monsters/'));
    const isNpcSingleAngle =
      Boolean(this.atlasJsonUrl && this.atlasJsonUrl.includes('/npcs/')) ||
      Boolean(
        this.atlasData?.animations &&
          this.atlasData.animations['0-0']?.[0] &&
          this.atlasData.animations['0-0']?.[0] === this.atlasData.animations['4-0']?.[0]
      );

    let effectiveDir = rawDir;
    let flipX = false;

    if (isNpcSingleAngle) {
      flipX = rawDir > 0;
    } else if (isMonster) {
      // Monstros possuem 2 ângulos mestres: SE (dir 1) e NW (dir 5).
      // Ao espelhar horizontalmente (flipX), habilitamos todos os 4 quadrantes isométricos:
      // - SE (dir 1, 2, 0): nativo SE (olhando Sudeste / Direita-Baixo)
      // - SW (dir 7, 6): SE espelhado (olhando Sudoeste / Esquerda-Baixo)
      // - NW (dir 5, 4): nativo NW (olhando Noroeste / Esquerda-Cima)
      // - NE (dir 3): NW espelhado (olhando Nordeste / Direita-Cima)
      if (rawDir === 7 || rawDir === 6) {
        effectiveDir = 1;
        flipX = true;
      } else if (rawDir === 3) {
        effectiveDir = 5;
        flipX = true;
      } else if (rawDir === 4 || rawDir === 5) {
        effectiveDir = 5;
        flipX = false;
      } else {
        effectiveDir = 1;
        flipX = false;
      }
    }

    if (this.ready && this.atlasData && this.image) {
      const anims = this.atlasData.animations || {};
      const frames = this.atlasData.frames || {};

      // No mcrework, a chave da animação é `${effectiveDir}-${action}`
      // Ações: 0 = Parado, 1 = Caminhada/Corrida, 2 = Postura, 3 = Ataque, 4 = Defesa, 5 = Dano, 6 = Morte, 7 = Magia
      const primaryKey = `${effectiveDir}-${action}`;
      let seq = anims[primaryKey];
      let isSynthesizedRun = false;

      // Se a criatura estiver correndo (action = 1) e for um monstro:
      // 1. Monstros com ciclo nativo de caminhada (uniqueFrames >= 3, ex: creature_000004) usam seu walk nativo.
      // 2. Monstros de batalha clássicos com walk estático (uniqueFrames <= 2, ex: creature_000001):
      //    Utilizamos os frames de corrida/investida da batalha, intercalando a passada firme (stride)
      //    com a pose de avanço/investida do ataque (action 3), criando um galope de combate agressivo e orgânico!
      if (action === 1 && isMonster) {
        const uniqueWalk = Array.isArray(seq) ? new Set(seq).size : 0;
        if (uniqueWalk <= 2) {
          const strideFrame = (Array.isArray(seq) && seq[0]) || anims[`${effectiveDir}-0`]?.[0];
          const atkSeq = anims[`${effectiveDir}-3`] || anims[`1-3`] || anims[`0-3`];
          const chargeFrame = Array.isArray(atkSeq) && atkSeq[0] ? atkSeq[0] : null;

          if (chargeFrame && strideFrame && chargeFrame !== strideFrame) {
            // Ciclo de corrida: 160ms na passada firme (stride) + 160ms na investida aérea (charge)
            seq = [strideFrame, strideFrame, chargeFrame, chargeFrame];
            isSynthesizedRun = true;
          } else if (anims[`${effectiveDir}-0`]) {
            seq = anims[`${effectiveDir}-0`];
          }
        }
      }

      if (!seq || !Array.isArray(seq) || seq.length === 0) {
        seq =
          (action !== 0 ? anims[`${effectiveDir}-1`] : null) ||
          anims[`${effectiveDir}-0`] ||
          anims[`0-${action}`] ||
          anims['0-0'] ||
          Object.values(anims)[0];
      }

      if (seq.length > 0) {
        // No mcrework oficial, cada frame tem 80ms (12.5 FPS) com repetições calibradas no atlas
        const rawFrameIdx = Math.floor(Math.max(0, elapsedMs) / 80);
        const frameIdx = clampLastFrame
          ? Math.min(seq.length - 1, rawFrameIdx)
          : rawFrameIdx % seq.length;
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

          // Ancoragem nos pés (0.5 no X, 0.92 no Y) + suporte a espelhamento horizontal (flipX)
          const anchorX = 0.5;
          const anchorY = 0.92;
          const effectiveOffX = flipX ? origW - offX - drawW : offX;

          // Física de passo e galope:
          let stepBob = 0;
          if (action === 1 && isMonster) {
            if (isSynthesizedRun) {
              const phase = rawFrameIdx % 4;
              stepBob = phase >= 2 ? Math.round(-3.5 * scale) : Math.round(1.0 * scale);
            } else {
              stepBob = Math.round(Math.sin((elapsedMs / 1000) * 12) * (2.0 * scale));
            }
          }

          // Inclinação corporal (tilt) na direção da corrida para dinamismo visual de investida
          let runTilt = 0;
          if (action === 1 && isMonster) {
            const baseAngle = 0.085; // ~4.9 graus
            if (effectiveDir === 5) {
              runTilt = flipX ? baseAngle : -baseAngle;
            } else {
              runTilt = flipX ? -baseAngle : baseAngle;
            }
          }

          if (runTilt !== 0) {
            ctx.translate(worldX, worldY);
            ctx.rotate(runTilt);
            ctx.translate(-worldX, -worldY);
          }

          const drawX = Math.round(worldX - origW * anchorX + effectiveOffX);
          const drawY = Math.round(worldY - origH * anchorY + offY + gOffY + stepBob);

          this.renderSpriteWithOverlapClipping(
            ctx,
            this.image,
            sx, sy, sw, sh,
            drawX, drawY, drawW, drawH,
            meshOrAlpha,
            flipX
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
        meshOrAlpha,
        flipX
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
