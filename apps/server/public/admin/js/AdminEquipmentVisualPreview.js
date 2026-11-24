/**
 * @file apps/server/public/admin/js/AdminEquipmentVisualPreview.js
 * @module @etheria/server/admin
 * @description Palco 2.5D Interativo no Modal de Equipamentos (/admin) para Asas e Montarias Voadoras.
 *   - Carrega Mapas reais (`app.savedMaps` / `/api/admin/maps/bootstrap`), Classes protótipo (`app.classTemplates`)
 *     e Pets seguidores com fidelidade 1:1 ao `/play` via `PlayFlightAndWingsController.drawPlayerWithCosmetics`.
 *   - Suporta controles mobile-friendly de Escala, Posição X/Y, Distância ao Chão (Z / `groundOffsetY`),
 *     Altitude de Voo e Offsets do Cavaleiro com atualização em tempo real em 8 direções.
 */

class AdminEquipmentVisualPreview {
  static animId = null;
  static dir = 0;
  static action = 0;
  static spriteCache = new Map();
  static mapImg = null;
  static mapIdLoaded = null;
  static classesCache = null;
  static monstersCache = null;

  static getDirLabel(d) {
    const names = ['Sul (S)', 'Sudeste (SE)', 'Leste (L)', 'Nordeste (NE)', 'Norte (N)', 'Noroeste (NO)', 'Oeste (O)', 'Sudoeste (SO)'];
    return names[((d % 8) + 8) % 8] || 'Sul (S)';
  }

  static parseSafeNum(id, fallback = 0, isFloat = false) {
    const el = document.getElementById(id);
    if (!el) return fallback;
    const raw = isFloat ? parseFloat(el.value) : parseInt(el.value, 10);
    return Number.isFinite(raw) ? raw : fallback;
  }

  static getOrCreateAtlasSprite(key, jsonUrl, webpUrl, thumbUrl) {
    if (!key || !window.McreworkSpriteSheet) return null;
    const existing = this.spriteCache.get(key);
    if (existing && existing.atlasJsonUrl === jsonUrl) {
      return existing;
    }
    const sp = new window.McreworkSpriteSheet(jsonUrl, webpUrl, thumbUrl);
    sp.load();
    this.spriteCache.set(key, sp);
    return sp;
  }

  static async ensureCatalogsLoaded(app) {
    const mapSel = document.getElementById('equipPreviewMapSelect');
    const classSel = document.getElementById('equipPreviewClassSelect');
    const petSel = document.getElementById('equipPreviewPetSelect');

    let maps = Array.isArray(app?.savedMaps) && app.savedMaps.length > 0
      ? app.savedMaps
      : (Array.isArray(app?.mapsList) ? app.mapsList : []);
    let classes = Array.isArray(app?.classTemplates) && app.classTemplates.length > 0
      ? app.classTemplates
      : (Array.isArray(this.classesCache) ? this.classesCache : []);

    if ((maps.length === 0 || classes.length === 0) && app?.api) {
      try {
        const boot = await app.api('/api/admin/maps/bootstrap');
        if (Array.isArray(boot?.maps) && boot.maps.length > 0) {
          maps = boot.maps;
          app.savedMaps = boot.maps;
          app.mapsList = boot.maps;
        }
        if (Array.isArray(boot?.classTemplates) && boot.classTemplates.length > 0) {
          classes = boot.classTemplates;
          app.classTemplates = boot.classTemplates;
        }
      } catch {
        // mantém fallback
      }
    }

    this.classesCache = classes;

    if (mapSel && mapSel.options.length === 0 && maps.length > 0) {
      mapSel.innerHTML = maps
        .map((m) => `<option value="${m.id}" ${Number(m.id) === 1 ? 'selected' : ''}>🗺️ #${m.id} ${m.namePtBr}</option>`)
        .join('');
    }

    if (classSel && classSel.options.length === 0 && classes.length > 0) {
      classSel.innerHTML = classes
        .map((c) => `<option value="${c.id}">👤 #${c.id} ${c.namePtBr}</option>`)
        .join('');
    }

    if (!this.monstersCache && app?.api) {
      try {
        const list = Array.isArray(app?.allMonsterTemplates) && app.allMonsterTemplates.length > 0
          ? app.allMonsterTemplates
          : await app.api('/api/admin/monster-templates');
        this.monstersCache = Array.isArray(list) ? list.filter((m) => m.isTamableAsPet).slice(0, 40) : [];
      } catch {
        this.monstersCache = [];
      }
    }
    if (petSel && petSel.options.length <= 1 && Array.isArray(this.monstersCache) && this.monstersCache.length > 0) {
      petSel.innerHTML = '<option value="">🐾 Sem Pet</option>' +
        this.monstersCache.map((m) => `<option value="${m.id}">🐾 #${m.id} ${m.namePtBr}</option>`).join('');
    }
    this.syncMapImage(app);
    this.syncSliders();
  }

  static syncMapImage(app) {
    const mapSel = document.getElementById('equipPreviewMapSelect');
    const mapId = Number(mapSel?.value) || 1;
    if (this.mapIdLoaded !== mapId) {
      this.mapIdLoaded = mapId;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = `/api/assets/map-image/${mapId}`;
      this.mapImg = img;
    }
  }

  static start(app) {
    this.stop();
    void this.ensureCatalogsLoaded(app);
    const loop = (now) => {
      const box = document.getElementById('equipVisual25dBox');
      const modal = document.getElementById('equipmentModal');
      if (!box || box.style.display === 'none' || !modal || modal.style.display === 'none') {
        this.animId = null;
        return;
      }
      this.renderFrame(app, now);
      this.animId = requestAnimationFrame(loop);
    };
    this.animId = requestAnimationFrame(loop);
  }

  static renderNow(app) {
    this.syncSliders();
    if (this.animId === null) {
      this.start(app);
    } else {
      this.renderFrame(app, performance.now());
    }
  }

  static stop() {
    if (this.animId !== null) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }

  static rotateDir(delta) {
    this.dir = ((this.dir + delta) % 8 + 8) % 8;
    const lbl = document.getElementById('equipPreviewDirLabel');
    if (lbl) lbl.textContent = this.getDirLabel(this.dir);
  }

  static setAction(act) {
    this.action = Number(act) || 0;
    const b0 = document.getElementById('btnEquipPrevAct0');
    const b1 = document.getElementById('btnEquipPrevAct1');
    if (b0) b0.className = this.action === 0 ? 'btn-primary' : '';
    if (b1) b1.className = this.action === 1 ? 'btn-primary' : '';
  }

  static setInputValue(id, value, isFloat = false) {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = isFloat ? String(Math.round(Number(value) * 100) / 100) : String(Math.round(Number(value)));
    this.syncSliders();
  }

  static nudgeInput(id, delta, isFloat = false, min = -200, max = 200) {
    const el = document.getElementById(id);
    if (!el) return;
    const cur = parseFloat(el.value);
    const base = Number.isFinite(cur) ? cur : 0;
    let next = base + delta;
    next = Math.max(min, Math.min(max, next));
    el.value = isFloat ? String(Math.round(next * 100) / 100) : String(Math.round(next));
    this.syncSliders();
  }

  static syncSliders() {
    const pairs = [
      ['equipGroundOffsetYInput', 'equipGroundOffsetYRange'],
      ['equipVisualScaleInput', 'equipVisualScaleRange'],
      ['equipMountAltitudeInput', 'equipMountAltitudeRange'],
    ];
    for (const [numId, rngId] of pairs) {
      const n = document.getElementById(numId);
      const r = document.getElementById(rngId);
      if (n && r && Number.isFinite(parseFloat(n.value))) {
        r.value = n.value;
      }
    }
    const zBadge = document.getElementById('equipGroundZStatusBadge');
    if (zBadge) {
      const zVal = this.parseSafeNum('equipGroundOffsetYInput', 0, false);
      zBadge.textContent = zVal === 0 ? '0px (Solo)' : zVal < 0 ? `${zVal}px (Mais Alto)` : `+${zVal}px (Mais Baixo)`;
      zBadge.style.color = zVal === 0 ? '#86efac' : '#fde047';
    }
  }

  static renderFrame(app, now) {
    const canvas = document.getElementById('equipVisualPreviewCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // 1. Mapa de Fundo Real
    const maps = Array.isArray(app?.savedMaps) && app.savedMaps.length > 0
      ? app.savedMaps
      : (Array.isArray(app?.mapsList) ? app.mapsList : []);
    const mapId = Number(document.getElementById('equipPreviewMapSelect')?.value) || 1;
    const mapObj = maps.find((m) => Number(m.id) === mapId);

    if (this.mapImg && this.mapImg.complete && this.mapImg.naturalWidth > 0) {
      const sxCenter = Number(mapObj?.spawnX) || this.mapImg.naturalWidth / 2;
      const syCenter = Number(mapObj?.spawnY) || this.mapImg.naturalHeight / 2;
      const cropX = Math.max(0, Math.min(this.mapImg.naturalWidth - w, Math.round(sxCenter - w / 2)));
      const cropY = Math.max(0, Math.min(this.mapImg.naturalHeight - h, Math.round(syCenter - h * 0.72)));
      ctx.drawImage(this.mapImg, cropX, cropY, Math.min(w, this.mapImg.naturalWidth), Math.min(h, this.mapImg.naturalHeight), 0, 0, w, h);
    } else {
      ctx.fillStyle = '#0b1120';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(56,189,248,0.12)';
      for (let x = 0; x < w; x += 28) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = 0; y < h; y += 28) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    }

    const slotCode = document.getElementById('equipSlotSelect')?.value || '';
    const visVal = document.getElementById('equipVisualModelSelect')?.value || '';
    const visualScale = this.parseSafeNum('equipVisualScaleInput', slotCode === 'WINGS' ? 0.65 : 0.70, true);
    const visualOffsetX = this.parseSafeNum('equipVisualOffsetXInput', 0, false);
    const visualOffsetY = this.parseSafeNum('equipVisualOffsetYInput', slotCode === 'WINGS' ? -30 : 0, false);
    const groundOffsetZ = this.parseSafeNum('equipGroundOffsetYInput', 0, false);
    const flightAlt = this.parseSafeNum('equipMountAltitudeInput', 72, false);
    const riderOffsetX = this.parseSafeNum('equipMountRiderOffsetXInput', 0, false);
    const riderOffsetY = this.parseSafeNum('equipMountRiderOffsetInput', -22, false);

    const classes = Array.isArray(this.classesCache) && this.classesCache.length > 0
      ? this.classesCache
      : (Array.isArray(app?.classTemplates) ? app.classTemplates : []);
    const classId = Number(document.getElementById('equipPreviewClassSelect')?.value) || (classes[0]?.id || 1);
    const cls = classes.find((c) => Number(c.id) === classId) || classes[0] || {
      mcreworkCharKey: 'char_000001', groundOffsetY: 0, shadowOffsetX: 0, shadowOffsetY: 0,
    };
    const cKey = cls.mcreworkCharKey || 'char_000001';
    const charSprite = this.getOrCreateAtlasSprite(
      `prev_char_${cKey}`,
      `/api/assets/mcrework/assets/characters/${cKey}/atlas.json`,
      `/api/assets/mcrework/assets/characters/${cKey}/atlas.webp`,
      `/api/assets/mcrework/assets/characters/${cKey}/thumb.webp`
    );

    const petId = Number(document.getElementById('equipPreviewPetSelect')?.value) || 0;
    const petTpl = petId > 0 ? (this.monstersCache || []).find((m) => Number(m.id) === petId) : null;
    const followerPet = petTpl ? {
      mcreworkMonsterKey: petTpl.mcreworkMonsterKey,
      atlasJsonUrl: `/api/assets/mcrework/assets/monsters/${petTpl.mcreworkMonsterKey}/atlas.json`,
      atlasWebpUrl: `/api/assets/mcrework/assets/monsters/${petTpl.mcreworkMonsterKey}/atlas.webp`,
      thumbUrl: `/api/assets/mcrework/assets/monsters/${petTpl.mcreworkMonsterKey}/thumb.webp`,
      groundOffsetY: petTpl.groundOffsetY || 0,
    } : null;

    let wingsObj = null;
    let mountObj = null;
    if (visVal) {
      const [kind, modelId, visualFormat] = visVal.split('|');
      if (slotCode === 'WINGS' && modelId) {
        wingsObj = {
          modelId,
          visualFormat: 'CHAR_MANIFEST',
          manifestUrl: `/api/assets/mcrework/assets/wings/${modelId}/char_manifest.json`,
          thumbUrl: `/api/assets/mcrework/assets/wings/${modelId}/thumb.png`,
          visualScale,
          visualOffsetX,
          visualOffsetY,
          groundOffsetY: groundOffsetZ,
        };
      } else if (slotCode === 'FLYING_MOUNT' && modelId) {
        const isAtlas = visualFormat === 'ATLAS' || kind === 'MOUNT' || modelId.startsWith('mount_');
        mountObj = isAtlas ? {
          modelId,
          visualFormat: 'ATLAS',
          atlasJsonUrl: `/api/assets/mcrework/assets/mounts/${modelId}/atlas.json`,
          atlasWebpUrl: `/api/assets/mcrework/assets/mounts/${modelId}/atlas.webp`,
          thumbUrl: `/api/assets/mcrework/assets/mounts/${modelId}/thumb.webp`,
          flightAltitude: flightAlt,
          riderOffsetX,
          riderOffsetY,
          groundOffsetY: groundOffsetZ,
          visualScale,
          visualOffsetX,
          visualOffsetY,
        } : {
          modelId,
          visualFormat: 'CHAR_MANIFEST',
          manifestUrl: `/api/assets/mcrework/assets/wings/${modelId}/char_manifest.json`,
          thumbUrl: `/api/assets/mcrework/assets/wings/${modelId}/thumb.png`,
          flightAltitude: flightAlt,
          riderOffsetX,
          riderOffsetY,
          groundOffsetY: groundOffsetZ,
          visualScale,
          visualOffsetX,
          visualOffsetY,
        };
      }
    }

    const worldX = Math.round(w / 2);
    const worldY = slotCode === 'FLYING_MOUNT' ? Math.round(h * 0.82) : Math.round(h * 0.70);

    // Linha horizontal de referência do solo (Z = 0)
    ctx.save();
    ctx.strokeStyle = 'rgba(253, 224, 71, 0.50)';
    ctx.setLineDash([4, 3]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(worldX - 64, worldY); ctx.lineTo(worldX + 64, worldY);
    ctx.moveTo(worldX, worldY - 8); ctx.lineTo(worldX, worldY + 8);
    ctx.stroke();
    ctx.restore();

    if (window.PlayFlightAndWingsController) {
      const dummyClient = {
        getOrCreateSprite: (k, j, wp, t) => this.getOrCreateAtlasSprite(k, j, wp, t),
      };
      window.PlayFlightAndWingsController.drawPlayerWithCosmetics(ctx, {
        client: dummyClient,
        charSprite,
        worldX,
        worldY,
        action: this.action,
        dir: this.dir,
        now,
        mesh: null,
        groundOffsetY: cls.groundOffsetY || 0,
        shadowOffsetX: cls.shadowOffsetX || 0,
        shadowOffsetY: cls.shadowOffsetY || 0,
        wingsObj,
        mountObj,
        followerPet,
        isFlying: slotCode === 'FLYING_MOUNT' && Boolean(mountObj),
        flightAltitude: slotCode === 'FLYING_MOUNT' && Boolean(mountObj) ? flightAlt : 0,
        customScale: 0.70,
      });
    } else if (charSprite) {
      charSprite.draw(ctx, worldX, worldY, this.action, this.dir, now, null, cls.groundOffsetY || 0, 0.70);
    }

    // Badge discreto no canto superior esquerdo do palco
    ctx.save();
    ctx.fillStyle = 'rgba(2, 6, 23, 0.75)';
    ctx.fillRect(6, 6, 128, 20);
    ctx.font = 'bold 10px sans-serif';
    ctx.fillStyle = '#fde047';
    ctx.textAlign = 'left';
    ctx.fillText(`📏 Chão (Z): ${groundOffsetZ >= 0 ? '+' : ''}${groundOffsetZ}px`, 12, 19);
    ctx.restore();
  }
}

window.AdminEquipmentVisualPreview = AdminEquipmentVisualPreview;
