/**
 * @file apps/server/public/play/js/PlayFlightAndWingsController.js
 * @module @etheria/client/flight
 * @description Controlador 2.5D de Asas Celestiais e Montarias Voadoras em Etheria Campus.
 *   - Carregador `McreworkManifestSprite` para spritesheets no formato `char_manifest.json` + `bmp_*.png` (8 direções).
 *   - Suporta montarias em atlas (`mount_*`) e planadores/nuvens/tapetes (`equip_fly_*`), além de asas animadas (`equip_wing_*`).
 *   - Física de voo no mapa aberto: elevação gradual até `flightAltitude`, personagem em pose idle acompanhando as 8 direções,
 *     nuvens/névoa suaves sob a montaria, bônus de velocidade e bypass de polígonos de colisão dentro dos limites do mapa.
 *   - Pouso inteligente: caso o jogador peça para descer sobre uma área bloqueada/colisão, voa até o ponto livre mais próximo
 *     dentro do perímetro da imagem do mapa antes de iniciar a animação de descida.
 */

class McreworkManifestSprite {
  constructor(manifestUrl, thumbUrl) {
    this.manifestUrl = manifestUrl;
    this.thumbUrl = thumbUrl;
    this.manifestData = null;
    this.dirResolution = null;
    this.frameImages = new Map();
    this.thumbImage = null;
    this.ready = false;
    this.loading = false;
  }

  static getUniqueFileSet(seq) {
    const files = new Set();
    if (!Array.isArray(seq)) return files;
    for (const entry of seq) {
      if (entry && entry.file) {
        files.add(String(entry.file).replace(/^\/+/, ''));
      }
    }
    return files;
  }

  buildDirResolution() {
    if (!this.manifestData) {
      this.dirResolution = null;
      return;
    }
    const mirrorMap = { 5: 3, 6: 2, 7: 1 };
    const u4 = McreworkManifestSprite.getUniqueFileSet(this.manifestData['4-0']);
    const resolution = {};
    for (let d = 0; d < 8; d++) {
      if (d <= 4) {
        resolution[d] = { effectiveDir: d, flipX: false };
      } else {
        const m = mirrorMap[d];
        const uD = McreworkManifestSprite.getUniqueFileSet(this.manifestData[`${d}-0`]);
        const uM = McreworkManifestSprite.getUniqueFileSet(this.manifestData[`${m}-0`]);
        const allCollapsedToNorth = uD.size > 0 && u4.size > 0 && Array.from(uD).every((f) => u4.has(f));
        if (uM.size >= 2 && (uD.size <= 1 || allCollapsedToNorth)) {
          resolution[d] = { effectiveDir: m, flipX: true };
        } else {
          resolution[d] = { effectiveDir: d, flipX: false };
        }
      }
    }
    this.dirResolution = resolution;
  }

  resolveSequence(direction = 0, action = 0) {
    if (!this.manifestData) return { seq: null, effectiveDir: 0, flipX: false };
    if (!this.dirResolution) this.buildDirResolution();

    const rawDir = (((Number(direction) || 0) % 8) + 8) % 8;
    const rawAct = Number(action) || 0;
    const resolved = this.dirResolution?.[rawDir] || { effectiveDir: rawDir, flipX: false };
    const effDir = resolved.effectiveDir;

    let seq = this.manifestData[`${effDir}-${rawAct}`];
    const idleSeq = this.manifestData[`${effDir}-0`];
    const idleUniqueCount = McreworkManifestSprite.getUniqueFileSet(idleSeq).size;
    const seqUniqueCount = McreworkManifestSprite.getUniqueFileSet(seq).size;

    if (!Array.isArray(seq) || seq.length === 0 || (rawAct !== 0 && seqUniqueCount <= 1 && idleUniqueCount >= 2)) {
      seq = idleSeq;
    }
    if (!Array.isArray(seq) || seq.length === 0) {
      seq = this.manifestData[`0-${rawAct}`] || this.manifestData['0-0'];
    }
    return { seq, effectiveDir: effDir, flipX: Boolean(resolved.flipX) };
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

    fetch(this.manifestUrl)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((json) => {
        this.manifestData = json || {};
        this.buildDirResolution();
        const uniqueFiles = new Set();
        for (const seq of Object.values(this.manifestData)) {
          if (Array.isArray(seq)) {
            for (const entry of seq) {
              if (entry && entry.file) uniqueFiles.add(entry.file.replace(/^\/+/, ''));
            }
          }
        }
        const filesArr = Array.from(uniqueFiles);
        if (filesArr.length === 0) {
          this.loading = false;
          return;
        }
        let loadedCount = 0;
        const onFinishOne = () => {
          loadedCount += 1;
          if (loadedCount >= filesArr.length) {
            this.ready = true;
          }
        };
        for (const rel of filesArr) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            this.frameImages.set(rel, img);
            this.ready = true;
            onFinishOne();
          };
          img.onerror = onFinishOne;
          img.src = `/api/assets/mcrework/${rel}`;
        }
      })
      .catch(() => {
        this.loading = false;
      });
  }

  static computeWeaponAnchorY(rawH) {
    if (!rawH || rawH <= 0) return 110 / 150;
    // Canvases compactos (<= 200px, ex: 200x150, 250x188, 190x143) mantêm pivô proporcional 110/150 (~0.733).
    // Canvases expandidos (> 200px, ex: 300x240, 320x256, 400x300, 460x460) mantêm pivô central h/2 com pés em h/2 + 46px.
    return rawH > 200 ? (rawH / 2 + 46) / rawH : (110 / 150);
  }

  drawFrame(ctx, worldX, worldY, direction = 0, action = 0, elapsedMs = 0, meshOrAlpha = null, scale = 0.70, anchorX = 0.5, anchorY = 0.5, clampLastFrame = false) {
    if (!this.loading && !this.ready) this.load();
    if (!this.manifestData) return false;

    const { seq, flipX } = this.resolveSequence(direction, action);
    if (!Array.isArray(seq) || seq.length === 0) return false;

    const rawFrameIdx = Math.floor(Math.max(0, elapsedMs) / 80);
    const frameIdx = clampLastFrame
      ? Math.min(seq.length - 1, rawFrameIdx)
      : rawFrameIdx % seq.length;
    const entry = seq[frameIdx];
    const rel = entry?.file ? entry.file.replace(/^\/+/, '') : '';
    const img = rel ? this.frameImages.get(rel) : null;
    if (!img || !img.complete || img.naturalWidth <= 0) return false;

    const rawW = entry.width || img.naturalWidth;
    const rawH = entry.height || img.naturalHeight;
    const dw = Math.round(rawW * scale);
    const dh = Math.round(rawH * scale);
    const resolvedAnchorY =
      anchorY === 'WEAPON_AUTO'
        ? McreworkManifestSprite.computeWeaponAnchorY(rawH)
        : anchorY;
    const dx = Math.round(worldX - dw * anchorX);
    const dy = Math.round(worldY - dh * resolvedAnchorY);

    ctx.save();
    if (window.McreworkSpriteSheet?.prototype?.renderSpriteWithOverlapClipping) {
      window.McreworkSpriteSheet.prototype.renderSpriteWithOverlapClipping(
        ctx, img, 0, 0, rawW, rawH, dx, dy, dw, dh, meshOrAlpha, flipX
      );
    } else if (flipX) {
      ctx.translate(dx + dw, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0, rawW, rawH, 0, 0, dw, dh);
    } else {
      ctx.drawImage(img, 0, 0, rawW, rawH, dx, dy, dw, dh);
    }
    ctx.restore();
    return true;
  }
}

class PlayFlightAndWingsController {
  static manifestSprites = new Map();
  static atlasSprites = new Map();
  static mistParticles = [];
  static lastMistSpawnTime = 0;

  static getOrCreateManifestSprite(modelId, manifestUrl, thumbUrl) {
    if (!modelId || !manifestUrl) return null;
    const key = `mf_${modelId}`;
    let sp = this.manifestSprites.get(key);
    if (!sp) {
      sp = new McreworkManifestSprite(manifestUrl, thumbUrl);
      sp.load();
      this.manifestSprites.set(key, sp);
    }
    return sp;
  }

  static getOrCreateAtlasSprite(modelId, atlasJsonUrl, atlasWebpUrl, thumbUrl, client) {
    if (!modelId || !atlasJsonUrl) return null;
    const key = `mount_${modelId}`;
    if (client?.getOrCreateSprite) {
      return client.getOrCreateSprite(key, atlasJsonUrl, atlasWebpUrl, thumbUrl);
    }
    let sp = this.atlasSprites.get(key);
    if (!sp && window.McreworkSpriteSheet) {
      sp = new McreworkSpriteSheet(atlasJsonUrl, atlasWebpUrl, thumbUrl);
      sp.load();
      this.atlasSprites.set(key, sp);
    }
    return sp;
  }

  static resolveWeaponModelForChar(weaponObj, charKey) {
    if (!weaponObj) return null;
    const isFemale = Boolean(charKey && /female/i.test(String(charKey)));
    const modelId =
      isFemale && weaponObj.femaleModelId
        ? weaponObj.femaleModelId
        : (weaponObj.maleModelId || weaponObj.modelId || weaponObj.femaleModelId || '');
    if (!modelId) return null;
    const manifestUrl =
      isFemale && weaponObj.femaleModelId
        ? (weaponObj.femaleManifestUrl || `/api/assets/mcrework/assets/weapons/${modelId}/char_manifest.json`)
        : (weaponObj.maleManifestUrl || weaponObj.manifestUrl || `/api/assets/mcrework/assets/weapons/${modelId}/char_manifest.json`);
    return { modelId, manifestUrl };
  }

  static syncVisualAppearance(client, visualAppearance) {
    if (!client) return;
    const vis = visualAppearance || { equippedWings: null, equippedMount: null, equippedWeapon: null };
    if (client.activeChar) {
      client.activeChar.visualAppearance = vis;
    }

    if (vis.equippedWings?.modelId) {
      this.getOrCreateManifestSprite(vis.equippedWings.modelId, vis.equippedWings.manifestUrl, vis.equippedWings.thumbUrl);
    }
    if (vis.equippedWeapon) {
      const wRes = this.resolveWeaponModelForChar(vis.equippedWeapon, client.activeChar?.mcreworkCharKey);
      if (wRes) {
        this.getOrCreateManifestSprite(wRes.modelId, wRes.manifestUrl, null);
      }
    }
    if (vis.equippedMount?.modelId) {
      if (vis.equippedMount.visualFormat === 'ATLAS') {
        this.getOrCreateAtlasSprite(
          vis.equippedMount.modelId,
          vis.equippedMount.atlasJsonUrl,
          vis.equippedMount.atlasWebpUrl,
          vis.equippedMount.thumbUrl,
          client
        );
      } else {
        this.getOrCreateManifestSprite(vis.equippedMount.modelId, vis.equippedMount.manifestUrl, vis.equippedMount.thumbUrl);
      }
    } else if (client.isFlying || (client.flightAltitudeCurrent || 0) > 0) {
      client.isFlying = false;
      client.isLandingFlight = false;
      client.flightTargetAltitude = 0;
      client.flightAltitudeCurrent = 0;
    }

    this.updateFlightHudButton(client);
  }

  static ensureFlightHudButton(client) {
    if (typeof document === 'undefined') return null;
    let btn = document.getElementById('hudFlightToggleBtn');
    if (!btn) {
      const container = document.getElementById('playMobileHud') || document.getElementById('worldScreen');
      if (!container) return null;
      btn = document.createElement('button');
      btn.id = 'hudFlightToggleBtn';
      btn.type = 'button';
      btn.className = 'hud-flight-btn is-unequipped';
      btn.dataset.mountEquipped = 'false';
      btn.style.display = 'none';
      btn.innerHTML = '<img src="/play/assets/hud/flight_toggle_icon.png" alt="Voar / Pousar" />';
      container.appendChild(btn);
    }
    if (!btn.dataset.flightBound) {
      btn.dataset.flightBound = 'true';
      btn.onclick = (e) => {
        e.stopPropagation();
        this.toggleFlight(client || window.PlayApp);
      };
    }
    return btn;
  }

  static updateFlightHudButton(client) {
    const btn = this.ensureFlightHudButton(client);
    if (!btn) return;
    const mount = client?.activeChar?.visualAppearance?.equippedMount;
    const inCombat = Boolean(client?.actionArena?.isActive || client?.actionCombatArena?.isActive);
    const canShow = Boolean(mount) && !inCombat;
    btn.dataset.mountEquipped = canShow ? 'true' : 'false';
    btn.classList.toggle('is-unequipped', !canShow);
    btn.classList.toggle('is-flying', canShow && Boolean(client?.isFlying));
    btn.classList.toggle('is-landing', canShow && Boolean(client?.isLandingFlight));
    btn.style.display = canShow ? 'inline-flex' : 'none';
    if (!btn.querySelector('img')) {
      btn.innerHTML = '<img src="/play/assets/hud/flight_toggle_icon.png" alt="Voar / Pousar" />';
    }
    btn.title = client?.isLandingFlight
      ? 'Pousando em área livre...'
      : client?.isFlying
      ? 'Descer da Montaria Voadora (Tecla V)'
      : 'Subir na Montaria Voadora (Tecla V)';
  }

  static toggleFlight(client) {
    if (!client || !client.activeChar) return;
    const mount = client.activeChar.visualAppearance?.equippedMount;
    if (!mount) {
      client.showNotification?.('Equipe uma Montaria Voadora primeiro.', 'info');
      return;
    }
    if (client.actionCombatArena?.isActive) {
      client.showNotification?.('Não é possível voar dentro da arena de combate.', 'info');
      return;
    }
    if (client.isFlying && !client.isLandingFlight) {
      this.requestSafeLanding(client);
    } else if (!client.isFlying) {
      this.startTakeoff(client);
    }
  }

  static startTakeoff(client) {
    const mount = client?.activeChar?.visualAppearance?.equippedMount;
    if (!mount || client.actionArena?.isActive || client.actionCombatArena?.isActive) return;
    client.isFlying = true;
    client.isLandingFlight = false;
    client.flightLandingTarget = null;
    client._onFlightLanded = null;
    if (client.activeChar) client.activeChar.isFlying = true;
    client.flightAltitudeCurrent = Number(client.flightAltitudeCurrent) || 0;
    client.flightTargetAltitude = Math.max(36, Number(mount.flightAltitude) || 72);
    client.currentPath = null;
    this.spawnMistBurst(client.playerX, client.playerY, client.flightAltitudeCurrent + 16, 6);
    this.updateFlightHudButton(client);
    window.PlayMapPresenceController?.triggerImmediateSync?.();
  }

  static computeEffectiveZoom(client, baseZoom = 1.0) {
    const bz = Number(baseZoom) || 1.0;
    if (!client || client.actionArena?.isActive || client.actionCombatArena?.isActive) return bz;
    const alt = Number(client.flightAltitudeCurrent) || 0;
    if (alt <= 0.5) return bz;
    const targetAlt = Math.max(36, Number(client?.activeChar?.visualAppearance?.equippedMount?.flightAltitude) || 72);
    const altFrac = Math.min(1, Math.max(0, alt / targetAlt));
    return Number((bz * (1 - 0.18 * altFrac)).toFixed(4));
  }

  static getFlyingPlayerScale(client, baseScale = 0.70) {
    const bs = Number(baseScale) || 0.70;
    if (!client || client.actionArena?.isActive || client.actionCombatArena?.isActive) return bs;
    const alt = Number(client.flightAltitudeCurrent) || 0;
    if (alt <= 0.5) return bs;
    const targetAlt = Math.max(36, Number(client?.activeChar?.visualAppearance?.equippedMount?.flightAltitude) || 72);
    const altFrac = Math.min(1, Math.max(0, alt / targetAlt));
    return Number((bs * (1 + 0.16 * altFrac)).toFixed(4));
  }

  static restoreFlightOnMapLoad(client, mapData, opts = {}) {
    if (!client) return;
    const isDungeon = Boolean(mapData?.isDungeon || mapData?.mapType?.code === 'DUNGEON');
    const mount = client.activeChar?.visualAppearance?.equippedMount;
    const shouldFly =
      !isDungeon &&
      Boolean(mount) &&
      ((opts.restoreFromChar && Boolean(client.activeChar?.isFlying)) || (opts.keepFlight && Boolean(client.isFlying)));
    if (shouldFly) {
      const tgt = Math.max(36, Number(mount.flightAltitude) || 72);
      client.isFlying = true;
      client.isLandingFlight = false;
      client.flightLandingTarget = null;
      client.flightAltitudeCurrent = tgt;
      client.flightTargetAltitude = tgt;
      if (client.activeChar) client.activeChar.isFlying = true;
    } else {
      client.isFlying = false;
      client.isLandingFlight = false;
      client.flightLandingTarget = null;
      client.flightAltitudeCurrent = 0;
      client.flightTargetAltitude = 0;
      if (client.activeChar) client.activeChar.isFlying = false;
    }
    this.syncVisualAppearance(client, client.activeChar?.visualAppearance);
  }

  static assertGroundedForCombat(client, actionLabel = 'iniciar uma luta') {
    if (!client) return true;
    if (client.isFlying || (Number(client.flightAltitudeCurrent) || 0) > 0.5) {
      client.showNotification?.(
        `🦅 Você precisa estar no chão para ${actionLabel}! Pouse sua montaria primeiro (V ou botão de voo).`,
        'warning'
      );
      return false;
    }
    return true;
  }

  static findNearestWalkablePoint(x, y, mesh, bounds) {
    const pad = 24;
    const maxW = Math.max(200, (bounds?.width || 2000) - pad);
    const maxH = Math.max(200, (bounds?.height || 1500) - pad);
    const clampPt = (px, py) => ({
      x: Math.round(Math.max(pad, Math.min(maxW, px))),
      y: Math.round(Math.max(pad, Math.min(maxH, py))),
    });
    const isFree = (px, py) => {
      if (px < pad || px > maxW || py < pad || py > maxH) return false;
      if (!mesh) return true;
      return !mesh.isPointBlockedWithBody(px, py, 8, 6);
    };

    const start = clampPt(x, y);
    if (isFree(start.x, start.y)) return start;

    for (let radius = 18; radius <= 1200; radius += 18) {
      const steps = Math.max(12, Math.round((2 * Math.PI * radius) / 22));
      for (let i = 0; i < steps; i++) {
        const ang = (i / steps) * Math.PI * 2;
        const cx = Math.round(start.x + Math.cos(ang) * radius);
        const cy = Math.round(start.y + Math.sin(ang) * radius);
        if (isFree(cx, cy)) {
          return { x: cx, y: cy };
        }
      }
    }

    if (clientCurrentSpawnFallback(bounds)) {
      return clientCurrentSpawnFallback(bounds);
    }
    return start;
  }

  static requestSafeLanding(client, onLandedCallback = null) {
    if (!client) return;
    if (!client.isFlying && (client.flightAltitudeCurrent || 0) <= 0.5) {
      client.isFlying = false;
      client.isLandingFlight = false;
      onLandedCallback?.();
      return;
    }

    const bounds = client.getMapBounds?.() || { width: 2000, height: 1500 };
    const mesh = client.mesh;
    const pad = 22;
    const curX = client.playerX;
    const curY = client.playerY;
    const inBounds = curX >= pad && curX <= bounds.width - pad && curY >= pad && curY <= bounds.height - pad;
    const needsMove = !inBounds || (mesh && mesh.isPointBlockedWithBody(curX, curY, 8, 6));

    client.isLandingFlight = true;
    client._onFlightLanded = onLandedCallback;

    if (needsMove) {
      const safePt = this.findNearestWalkablePoint(curX, curY, mesh, bounds);
      client.flightLandingTarget = safePt;
      client.currentPath = null;
      client.targetDestX = safePt.x;
      client.targetDestY = safePt.y;
      client.moveTargetX = safePt.x;
      client.moveTargetY = safePt.y;
      client.showNotification?.('🪂 Voando para o local livre mais próximo para pousar.', 'info');
    } else {
      client.flightLandingTarget = null;
      client.flightTargetAltitude = 0;
      client.currentPath = null;
      client.moveTargetX = null;
      client.moveTargetY = null;
      client.targetDestX = null;
      client.targetDestY = null;
    }
    this.updateFlightHudButton(client);
  }

  static getMoveSpeedMultiplier(client) {
    if (!client?.isFlying) return 1;
    const mount = client?.activeChar?.visualAppearance?.equippedMount;
    if (!mount) return 1;
    return 1 + Math.max(0, Number(mount.speedBonusPct) || 0) / 100;
  }

  static updateFlightPhysics(client, dt, now) {
    if (!client || !client.activeChar) return;
    const mount = client.activeChar.visualAppearance?.equippedMount;
    if (!mount) {
      client.isFlying = false;
      client.isLandingFlight = false;
      client.flightAltitudeCurrent = 0;
      client.flightTargetAltitude = 0;
      return;
    }

    if (client.isLandingFlight && client.flightLandingTarget) {
      const dx = client.flightLandingTarget.x - client.playerX;
      const dy = client.flightLandingTarget.y - client.playerY;
      if (Math.hypot(dx, dy) <= 12) {
        client.playerX = client.flightLandingTarget.x;
        client.playerY = client.flightLandingTarget.y;
        client.flightLandingTarget = null;
        client.moveTargetX = null;
        client.moveTargetY = null;
        client.targetDestX = null;
        client.targetDestY = null;
        client.flightTargetAltitude = 0;
      }
    }

    const cur = Number(client.flightAltitudeCurrent) || 0;
    const target = client.isFlying && !client.isLandingFlight
      ? Math.max(36, Number(mount.flightAltitude) || 72)
      : (client.flightLandingTarget ? cur : 0);

    const climbSpeed = 145;
    if (cur < target) {
      client.flightAltitudeCurrent = Math.min(target, cur + climbSpeed * dt);
    } else if (cur > target) {
      client.flightAltitudeCurrent = Math.max(target, cur - climbSpeed * dt);
    }

    if (client.isLandingFlight && !client.flightLandingTarget && (client.flightAltitudeCurrent || 0) <= 0.5) {
      client.flightAltitudeCurrent = 0;
      client.isFlying = false;
      client.isLandingFlight = false;
      if (client.activeChar) client.activeChar.isFlying = false;
      this.spawnMistBurst(client.playerX, client.playerY, 6, 7);
      const cb = client._onFlightLanded;
      client._onFlightLanded = null;
      this.updateFlightHudButton(client);
      window.PlayMapPresenceController?.triggerImmediateSync?.();
      cb?.();
    }

    // Spawn de nuvens/névoa sutis durante voo em altitude
    if (client.flightAltitudeCurrent > 10 && now - this.lastMistSpawnTime > (client.isMoving ? 140 : 280)) {
      this.lastMistSpawnTime = now;
      this.spawnMistParticle(
        client.playerX + (Math.random() - 0.5) * 34,
        client.playerY - client.flightAltitudeCurrent + (Math.random() - 0.5) * 14,
        client.isMoving ? 1 : 0.4
      );
    }

    for (let i = this.mistParticles.length - 1; i >= 0; i--) {
      const p = this.mistParticles[i];
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.r += p.grow * dt;
      if (p.age >= p.life) {
        this.mistParticles.splice(i, 1);
      }
    }
  }

  static spawnMistParticle(x, y, driftMult = 1) {
    if (this.mistParticles.length >= 26) this.mistParticles.shift();
    this.mistParticles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 18 * driftMult,
      vy: 6 + Math.random() * 8,
      r: 10 + Math.random() * 10,
      grow: 10,
      age: 0,
      life: 1.0 + Math.random() * 0.55,
      alpha: 0.22 + Math.random() * 0.14,
    });
  }

  static spawnMistBurst(x, y, altY, count = 6) {
    for (let i = 0; i < count; i++) {
      this.spawnMistParticle(x + (Math.random() - 0.5) * 44, y - altY + (Math.random() - 0.5) * 16, 1.8);
    }
  }

  static drawWorldMistParticles(ctx) {
    if (this.mistParticles.length === 0) return;
    ctx.save();
    for (const p of this.mistParticles) {
      const t = Math.min(1, p.age / p.life);
      const a = p.alpha * (1 - t);
      if (a <= 0.01) continue;
      ctx.fillStyle = `rgba(224, 242, 254, ${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.r * 1.45, p.r * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  static drawMistHaloUnderMount(ctx, x, elevY, now, scale = 1) {
    ctx.save();
    const drift = Math.sin(now / 650) * 6;
    ctx.fillStyle = 'rgba(224, 242, 254, 0.20)';
    ctx.beginPath();
    ctx.ellipse(x + drift, elevY + 6, 34 * scale, 12 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.beginPath();
    ctx.ellipse(x - drift * 0.8 - 10, elevY + 10, 22 * scale, 8 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  static shouldDrawWingsBehind(rawDir, wingsObj) {
    const dirKey = String((((Number(rawDir) || 0) % 8) + 8) % 8);
    const layer = wingsObj?.dirOffsets?.[dirKey]?.layer;
    if (layer === 'FRONT') return false;
    if (layer === 'BACK') return true;
    const d = Number(dirKey);
    return !(d === 3 || d === 4 || d === 5);
  }

  static computeWingTransform(wingsObj, x, y, rawDir, groundOffsetY = 0, customScale = 0.70) {
    const d = (((Number(rawDir) || 0) % 8) + 8) % 8;
    const baseScale = Number(customScale) > 0 ? Number(customScale) : 0.70;
    const scaleRatio = baseScale / 0.70;
    const wingScale = Number(wingsObj.visualScale) > 0 ? Number(wingsObj.visualScale) * scaleRatio : baseScale;
    const gOffY = Math.round(((Number(groundOffsetY) || 0) + (Number(wingsObj.groundOffsetY) || 0)) * baseScale);

    const backDepth = Number(wingsObj.backDepth) || 0;
    const [fx, fy] = this.getDirVector8(d);
    const depthShiftX = -fx * backDepth * scaleRatio;
    const depthShiftY = -fy * backDepth * 0.55 * scaleRatio;

    const isLeftSide = d === 5 || d === 6 || d === 7;
    const baseOffX = (Number(wingsObj.visualOffsetX) || 0) * (isLeftSide ? -1 : 1) * scaleRatio;
    const baseOffY = (wingsObj.visualOffsetY !== undefined ? Number(wingsObj.visualOffsetY) : -30) * scaleRatio;

    const dOv = wingsObj.dirOffsets && typeof wingsObj.dirOffsets === 'object' ? wingsObj.dirOffsets[String(d)] : null;
    const dirOffX = (Number(dOv?.x) || 0) * scaleRatio;
    const dirOffY = (Number(dOv?.y) || 0) * scaleRatio;

    return {
      wingX: Math.round(x + baseOffX + depthShiftX + dirOffX),
      wingY: Math.round(y + gOffY + baseOffY + depthShiftY + dirOffY),
      wingScale,
    };
  }

  static drawWingForUnit(ctx, wingsObj, x, y, dir, action, now, mesh, groundOffsetY = 0, customScale = 0.70) {
    if (!wingsObj || !wingsObj.modelId) return false;
    const sp = this.getOrCreateManifestSprite(wingsObj.modelId, wingsObj.manifestUrl, wingsObj.thumbUrl);
    if (!sp) return false;
    const { wingX, wingY, wingScale } = this.computeWingTransform(wingsObj, x, y, dir, groundOffsetY, customScale);
    return sp.drawFrame(ctx, wingX, wingY, dir, action, now, mesh, wingScale, 0.5, 0.5);
  }

  static shouldDrawWeaponBehind(rawDir, weaponObj) {
    const dirKey = String((((Number(rawDir) || 0) % 8) + 8) % 8);
    const layer = weaponObj?.dirOffsets?.[dirKey]?.layer;
    if (layer === 'BACK') return true;
    if (layer === 'FRONT') return false;
    return false;
  }

  static computeWeaponTransform(weaponObj, x, y, rawDir, customScale = 0.70) {
    const d = (((Number(rawDir) || 0) % 8) + 8) % 8;
    const baseScale = Number(customScale) > 0 ? Number(customScale) : 0.70;
    const scaleRatio = baseScale / 0.70;
    const weaponScale = Number(weaponObj.visualScale) > 0 ? Number(weaponObj.visualScale) * scaleRatio : baseScale;
    const gOffWeapon = Math.round((Number(weaponObj.groundOffsetY) || 0) * baseScale);
    const isLeftSide = d === 5 || d === 6 || d === 7;
    const baseOffX = (Number(weaponObj.visualOffsetX) || 0) * (isLeftSide ? -1 : 1) * scaleRatio;
    const baseOffY = (Number(weaponObj.visualOffsetY) || 0) * scaleRatio;
    const dOv = weaponObj.dirOffsets && typeof weaponObj.dirOffsets === 'object' ? weaponObj.dirOffsets[String(d)] : null;
    const dirOffX = (Number(dOv?.x) || 0) * scaleRatio;
    const dirOffY = (Number(dOv?.y) || 0) * scaleRatio;
    const feetBaseY = Math.round(4 * scaleRatio);
    return {
      weaponX: Math.round(x + baseOffX + dirOffX),
      weaponY: Math.round(y + feetBaseY + gOffWeapon + baseOffY + dirOffY),
      weaponScale,
    };
  }

  static drawWeaponForUnit(ctx, weaponObj, x, y, dir, action, now, mesh, customScale = 0.70, charKey = null, clampLastFrame = false) {
    const res = this.resolveWeaponModelForChar(weaponObj, charKey);
    if (!res) return false;
    const sp = this.getOrCreateManifestSprite(res.modelId, res.manifestUrl, null);
    if (!sp) return false;
    const { weaponX, weaponY, weaponScale } = this.computeWeaponTransform(weaponObj, x, y, dir, customScale);
    return sp.drawFrame(ctx, weaponX, weaponY, dir, action, now, mesh, weaponScale, 0.5, 'WEAPON_AUTO', clampLastFrame);
  }

  static getDirVector8(rawDir) {
    const table = [
      [0, 1],        // 0: S
      [0.707, 0.707],// 1: SE
      [1, 0],        // 2: E
      [0.707, -0.707],// 3: NE
      [0, -1],       // 4: N
      [-0.707, -0.707],// 5: NW
      [-1, 0],       // 6: W
      [-0.707, 0.707],// 7: SW
    ];
    return table[(((Number(rawDir) || 0) % 8) + 8) % 8] || [0, 1];
  }

  static drawMountedFollowerPet(ctx, client, followerPet, riderX, riderY, rawDir, now, baseScale) {
    if (!followerPet?.mcreworkMonsterKey || !client?.getOrCreateSprite) return;
    const petSprite = client.getOrCreateSprite(
      `pet_${followerPet.mcreworkMonsterKey}`,
      followerPet.atlasJsonUrl,
      followerPet.atlasWebpUrl,
      followerPet.thumbUrl
    );
    if (!petSprite) return;
    const [dx, dy] = this.getDirVector8(rawDir);
    const petX = Math.round(riderX - dx * 20);
    const petY = Math.round(riderY - dy * 10 - 2);
    const petScale = Math.max(0.32, baseScale * 0.68);
    petSprite.draw(
      ctx,
      petX,
      petY,
      0, // sempre animação Idle acompanhando a direção da montaria
      rawDir,
      now,
      null, // malha de sobreposição desabilitada em voo
      Number(followerPet.groundOffsetY) || 0,
      petScale,
      false,
      0,
      0,
      true // skipShadow
    );
  }

  static drawPlayerWithCosmetics(ctx, opts) {
    const {
      client, charSprite, worldX, worldY, action, dir, now, mesh,
      groundOffsetY = 0, shadowOffsetX = 0, shadowOffsetY = 0,
      wingsObj = null, mountObj = null, weaponObj = null, charKey = null,
      followerPet = null, clampLastFrame = false,
      isFlying = false, flightAltitude = 0, customScale = 0.70,
    } = opts;

    const rawDir = (((Number(dir) || 0) % 8) + 8) % 8;
    const drawWingsBehind = this.shouldDrawWingsBehind(rawDir, wingsObj);
    const drawWeaponBehind = weaponObj ? this.shouldDrawWeaponBehind(rawDir, weaponObj) : false;
    const wingTime = opts.wingNow !== undefined ? opts.wingNow : now;
    const alt = isFlying || flightAltitude > 0.5 ? Math.max(0, Number(flightAltitude) || 0) : 0;
    const scale = Number(customScale) > 0 ? Number(customScale) : 0.70;
    // Em voo, desabilita malhas de sobreposição (mesh = null) para voar por cima das estruturas
    const effectiveMesh = alt > 0.5 || isFlying ? null : mesh;

    if (mountObj && alt > 0.5) {
      const altRatio = Math.min(1, alt / 90);
      // 1. Sombra projetada lá embaixo no solo
      ctx.save();
      ctx.beginPath();
      const sRx = Math.round((22 - 6 * altRatio) * scale);
      const sRy = Math.round((10 - 3 * altRatio) * scale);
      ctx.ellipse(worldX + Math.round(shadowOffsetX * scale), worldY + Math.round(shadowOffsetY * scale), sRx, sRy, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 0, 0, ${(0.42 - 0.16 * altRatio).toFixed(2)})`;
      ctx.fill();
      ctx.restore();

      const bobY = Math.sin(now / 360) * 3.5;
      const elevY = Math.round(worldY - alt + bobY);

      // 2. Névoa/nuvens sutis abaixo da montaria
      this.drawMistHaloUnderMount(ctx, worldX, elevY, now, 1.0);

      // 3. Desenho da Montaria Voadora acompanhando as 8 direções com escala/offset calibráveis
      const mScale = Number(mountObj.visualScale) > 0 ? Number(mountObj.visualScale) * (scale / 0.70) : scale;
      const mX = Math.round(worldX + (Number(mountObj.visualOffsetX) || 0));
      const mY = Math.round(elevY + (Number(mountObj.visualOffsetY) || 0));
      if (mountObj.visualFormat === 'ATLAS') {
        const mSprite = this.getOrCreateAtlasSprite(
          mountObj.modelId, mountObj.atlasJsonUrl, mountObj.atlasWebpUrl, mountObj.thumbUrl, client
        );
        mSprite?.draw(ctx, mX, mY, action, rawDir, now, null, mountObj.groundOffsetY || 0, mScale, false, 0, 0, true);
      } else {
        const mManifest = this.getOrCreateManifestSprite(mountObj.modelId, mountObj.manifestUrl, mountObj.thumbUrl);
        const mGroundZ = Math.round((Number(mountObj.groundOffsetY) || 0) * mScale);
        mManifest?.drawFrame(ctx, mX, mY - 8 + mGroundZ, rawDir, action, now, null, mScale, 0.5, 0.55);
      }

      // 4. Cavaleiro em Idle + Arma equipada + Pet seguidor colado logo atrás do personagem + Asas
      const riderX = Math.round(worldX + (Number(mountObj.riderOffsetX) || 0));
      const riderY = Math.round(elevY + (Number(mountObj.riderOffsetY) ?? -22));
      const petInFrontOfRider = rawDir === 3 || rawDir === 4 || rawDir === 5;

      if (followerPet && !petInFrontOfRider) {
        this.drawMountedFollowerPet(ctx, client, followerPet, riderX, riderY, rawDir, now, scale);
      }
      if (wingsObj && drawWingsBehind) {
        this.drawWingForUnit(ctx, wingsObj, riderX, riderY, rawDir, 0, wingTime, null, groundOffsetY, scale);
      }
      if (weaponObj && drawWeaponBehind) {
        this.drawWeaponForUnit(ctx, weaponObj, riderX, riderY, rawDir, 0, now, null, scale, charKey, false);
      }
      charSprite?.draw(ctx, riderX, riderY, 0, rawDir, now, null, groundOffsetY, scale, false, shadowOffsetX, shadowOffsetY, true);
      if (weaponObj && !drawWeaponBehind) {
        this.drawWeaponForUnit(ctx, weaponObj, riderX, riderY, rawDir, 0, now, null, scale, charKey, false);
      }
      if (wingsObj && !drawWingsBehind) {
        this.drawWingForUnit(ctx, wingsObj, riderX, riderY, rawDir, 0, wingTime, null, groundOffsetY, scale);
      }
      if (followerPet && petInFrontOfRider) {
        this.drawMountedFollowerPet(ctx, client, followerPet, riderX, riderY, rawDir, now, scale);
      }

      this.drawMistHaloUnderMount(ctx, worldX + 8, elevY + 4, now + 900, 0.65);
      return elevY - 66 + Math.round((groundOffsetY + (Number(mountObj.riderOffsetY) ?? -22)) * scale);
    }

    // No solo (sem voo ativo): personagem + arma equipada + asas equipadas (com clip de sobreposição ativo no chão)
    if (wingsObj && drawWingsBehind) {
      this.drawWingForUnit(ctx, wingsObj, worldX, worldY, rawDir, action, wingTime, effectiveMesh, groundOffsetY, scale);
    }
    if (weaponObj && drawWeaponBehind) {
      this.drawWeaponForUnit(ctx, weaponObj, worldX, worldY, rawDir, action, now, effectiveMesh, scale, charKey, clampLastFrame);
    }
    charSprite?.draw(ctx, worldX, worldY, action, rawDir, now, effectiveMesh, groundOffsetY, scale, clampLastFrame, shadowOffsetX, shadowOffsetY, false);
    if (weaponObj && !drawWeaponBehind) {
      this.drawWeaponForUnit(ctx, weaponObj, worldX, worldY, rawDir, action, now, effectiveMesh, scale, charKey, clampLastFrame);
    }
    if (wingsObj && !drawWingsBehind) {
      this.drawWingForUnit(ctx, wingsObj, worldX, worldY, rawDir, action, wingTime, effectiveMesh, groundOffsetY, scale);
    }
    return worldY - 66 + Math.round(groundOffsetY * scale);
  }
}

function clientCurrentSpawnFallback(bounds) {
  const map = window.PlayApp?.currentMap;
  if (!map || !bounds) return null;
  if (typeof map.spawnX === 'number' && typeof map.spawnY === 'number') {
    return { x: map.spawnX, y: map.spawnY };
  }
  return null;
}

window.McreworkManifestSprite = McreworkManifestSprite;
window.PlayFlightAndWingsController = PlayFlightAndWingsController;
