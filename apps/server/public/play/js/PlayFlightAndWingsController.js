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
    this.frameImages = new Map();
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

    fetch(this.manifestUrl)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((json) => {
        this.manifestData = json || {};
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

  drawFrame(ctx, worldX, worldY, direction = 0, action = 0, elapsedMs = 0, meshOrAlpha = null, scale = 0.70, anchorX = 0.5, anchorY = 0.5) {
    if (!this.loading && !this.ready) this.load();
    if (!this.manifestData) return false;

    const rawDir = (((Number(direction) || 0) % 8) + 8) % 8;
    const key = `${rawDir}-${action}`;
    let seq = this.manifestData[key];
    if (!Array.isArray(seq) || seq.length === 0) {
      seq = this.manifestData[`${rawDir}-0`] || this.manifestData[`0-${action}`] || this.manifestData['0-0'];
    }
    if (!Array.isArray(seq) || seq.length === 0) return false;

    const frameIdx = Math.floor(Math.max(0, elapsedMs) / 80) % seq.length;
    const entry = seq[frameIdx];
    const rel = entry?.file ? entry.file.replace(/^\/+/, '') : '';
    const img = rel ? this.frameImages.get(rel) : null;
    if (!img || !img.complete || img.naturalWidth <= 0) return false;

    const rawW = entry.width || img.naturalWidth;
    const rawH = entry.height || img.naturalHeight;
    const dw = Math.round(rawW * scale);
    const dh = Math.round(rawH * scale);
    const dx = Math.round(worldX - dw * anchorX);
    const dy = Math.round(worldY - dh * anchorY);

    ctx.save();
    if (window.McreworkSpriteSheet?.prototype?.renderSpriteWithOverlapClipping) {
      window.McreworkSpriteSheet.prototype.renderSpriteWithOverlapClipping(
        ctx, img, 0, 0, rawW, rawH, dx, dy, dw, dh, meshOrAlpha, false
      );
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

  static syncVisualAppearance(client, visualAppearance) {
    if (!client) return;
    const vis = visualAppearance || { equippedWings: null, equippedMount: null };
    if (client.activeChar) {
      client.activeChar.visualAppearance = vis;
    }

    if (vis.equippedWings?.modelId) {
      this.getOrCreateManifestSprite(vis.equippedWings.modelId, vis.equippedWings.manifestUrl, vis.equippedWings.thumbUrl);
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
    if (btn) return btn;

    const worldScreen = document.getElementById('worldScreen');
    if (!worldScreen) return null;
    btn = document.createElement('button');
    btn.id = 'hudFlightToggleBtn';
    btn.type = 'button';
    btn.title = 'Subir / Descer da Montaria Voadora (Tecla V)';
    btn.style.cssText = [
      'position:fixed', 'left:50%', 'bottom:72px', 'transform:translateX(-50%)',
      'z-index:28', 'display:none', 'align-items:center', 'gap:6px',
      'padding:7px 14px', 'border-radius:999px', 'font-size:0.78rem', 'font-weight:800',
      'color:#f8fafc', 'cursor:pointer',
      'background:linear-gradient(135deg, rgba(14,116,144,0.92), rgba(30,58,138,0.92))',
      'border:1.5px solid #38bdf8', 'box-shadow:0 4px 16px rgba(14,165,233,0.45)',
      'backdrop-filter:blur(6px)',
    ].join(';');
    btn.onclick = (e) => {
      e.stopPropagation();
      this.toggleFlight(client || window.PlayApp);
    };
    worldScreen.appendChild(btn);
    return btn;
  }

  static updateFlightHudButton(client) {
    const btn = this.ensureFlightHudButton(client);
    if (!btn) return;
    const mount = client?.activeChar?.visualAppearance?.equippedMount;
    if (!mount || client?.actionCombatArena?.isActive) {
      btn.style.display = 'none';
      return;
    }
    btn.style.display = 'inline-flex';
    if (client.isLandingFlight) {
      btn.textContent = '🪂 Pousando...';
    } else if (client.isFlying) {
      btn.textContent = '🪂 Descer da Montaria (V)';
    } else {
      btn.textContent = '🦅 Voar na Montaria (V)';
    }
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
    if (!mount || client.actionCombatArena?.isActive) return;
    client.isFlying = true;
    client.isLandingFlight = false;
    client.flightLandingTarget = null;
    client._onFlightLanded = null;
    client.flightAltitudeCurrent = Number(client.flightAltitudeCurrent) || 0;
    client.flightTargetAltitude = Math.max(36, Number(mount.flightAltitude) || 72);
    client.currentPath = null;
    this.spawnMistBurst(client.playerX, client.playerY, client.flightAltitudeCurrent + 16, 6);
    this.updateFlightHudButton(client);
    window.PlayMapPresenceController?.triggerImmediateSync?.();
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

  static drawWingForUnit(ctx, wingsObj, x, y, dir, action, now, mesh, groundOffsetY = 0, customScale = 0.70) {
    if (!wingsObj || !wingsObj.modelId) return false;
    const sp = this.getOrCreateManifestSprite(wingsObj.modelId, wingsObj.manifestUrl, wingsObj.thumbUrl);
    if (!sp) return false;
    const baseScale = Number(customScale) > 0 ? Number(customScale) : 0.70;
    const wingScale = Number(wingsObj.visualScale) > 0 ? Number(wingsObj.visualScale) * (baseScale / 0.70) : baseScale;
    const gOffY = Math.round((Number(groundOffsetY) || 0) * baseScale);
    const offX = Number(wingsObj.visualOffsetX) || 0;
    const offY = wingsObj.visualOffsetY !== undefined ? Number(wingsObj.visualOffsetY) : -30;
    const wingX = Math.round(x + offX);
    const wingY = Math.round(y + gOffY + offY * (baseScale / 0.70));
    return sp.drawFrame(ctx, wingX, wingY, dir, action, now, mesh, wingScale, 0.5, 0.5);
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
      wingsObj = null, mountObj = null, followerPet = null,
      isFlying = false, flightAltitude = 0, customScale = 0.70,
    } = opts;

    const rawDir = (((Number(dir) || 0) % 8) + 8) % 8;
    const drawWingsBehind = !(rawDir === 3 || rawDir === 4 || rawDir === 5);
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
        mManifest?.drawFrame(ctx, mX, mY - 8, rawDir, action, now, null, mScale, 0.5, 0.55);
      }

      // 4. Cavaleiro em Idle + Pet seguidor colado logo atrás do personagem + Asas
      const riderX = Math.round(worldX + (Number(mountObj.riderOffsetX) || 0));
      const riderY = Math.round(elevY + (Number(mountObj.riderOffsetY) ?? -22));
      const petInFrontOfRider = rawDir === 3 || rawDir === 4 || rawDir === 5;

      if (followerPet && !petInFrontOfRider) {
        this.drawMountedFollowerPet(ctx, client, followerPet, riderX, riderY, rawDir, now, scale);
      }
      if (wingsObj && drawWingsBehind) {
        this.drawWingForUnit(ctx, wingsObj, riderX, riderY, rawDir, 0, now, null, groundOffsetY, scale);
      }
      charSprite?.draw(ctx, riderX, riderY, 0, rawDir, now, null, groundOffsetY, scale, false, shadowOffsetX, shadowOffsetY, true);
      if (wingsObj && !drawWingsBehind) {
        this.drawWingForUnit(ctx, wingsObj, riderX, riderY, rawDir, 0, now, null, groundOffsetY, scale);
      }
      if (followerPet && petInFrontOfRider) {
        this.drawMountedFollowerPet(ctx, client, followerPet, riderX, riderY, rawDir, now, scale);
      }

      this.drawMistHaloUnderMount(ctx, worldX + 8, elevY + 4, now + 900, 0.65);
      return elevY - 66 + Math.round((groundOffsetY + (Number(mountObj.riderOffsetY) ?? -22)) * scale);
    }

    // No solo (sem voo ativo): personagem + asas equipadas (com clip de sobreposição ativo no chão)
    if (wingsObj && drawWingsBehind) {
      this.drawWingForUnit(ctx, wingsObj, worldX, worldY, rawDir, action, now, effectiveMesh, groundOffsetY, scale);
    }
    charSprite?.draw(ctx, worldX, worldY, action, rawDir, now, effectiveMesh, groundOffsetY, scale, false, shadowOffsetX, shadowOffsetY, false);
    if (wingsObj && !drawWingsBehind) {
      this.drawWingForUnit(ctx, wingsObj, worldX, worldY, rawDir, action, now, effectiveMesh, groundOffsetY, scale);
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
