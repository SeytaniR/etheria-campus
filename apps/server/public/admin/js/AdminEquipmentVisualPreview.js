/**
 * @file apps/server/public/admin/js/AdminEquipmentVisualPreview.js
 * @module @etheria/server/admin
 * @description Palco 2.5D Interativo no Modal de Equipamentos (/admin) para Asas e Montarias Voadoras.
 *   - Renderiza o Mapa real do jogo (`/api/assets/map-image/:id`), um modelo de Classe e (opcionalmente) um Pet seguidor.
 *   - Reutiliza `PlayFlightAndWingsController.drawPlayerWithCosmetics` para garantir fidelidade 1:1 com `/play`.
 *   - Permite ajustar tamanho (`visualScale`), posição (`visualOffsetX`, `visualOffsetY`), altitude (`flightAltitude`)
 *     e posição do cavaleiro (`riderOffsetX`, `riderOffsetY`) em tempo real com rotação em 8 direções.
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

  static getOrCreateAtlasSprite(key, jsonUrl, webpUrl, thumbUrl) {
    if (!key || !window.McreworkSpriteSheet) return null;
    if (!this.spriteCache.has(key)) {
      const sp = new window.McreworkSpriteSheet(jsonUrl, webpUrl, thumbUrl);
      sp.load();
      this.spriteCache.set(key, sp);
    }
    return this.spriteCache.get(key);
  }

  static async ensureCatalogsLoaded(app) {
    const mapSel = document.getElementById('equipPreviewMapSelect');
    const classSel = document.getElementById('equipPreviewClassSelect');
    const petSel = document.getElementById('equipPreviewPetSelect');

    let maps = Array.isArray(app?.mapsList) ? app.mapsList : [];
    if (maps.length === 0 && app?.api) {
      try {
        const boot = await app.api('/api/admin/maps/bootstrap');
        if (Array.isArray(boot?.maps)) {
          maps = boot.maps;
          app.mapsList = boot.maps;
        }
      } catch {
        maps = [];
      }
    }
    if (mapSel && mapSel.options.length === 0 && maps.length > 0) {
      mapSel.innerHTML = maps
        .map((m) => `<option value="${m.id}" ${Number(m.id) === 1 ? 'selected' : ''}>#${m.id} ${m.namePtBr}</option>`)
        .join('');
    }

    if (!this.classesCache && app?.api) {
      try {
        this.classesCache = await app.api('/api/admin/classes');
      } catch {
        this.classesCache = [];
      }
    }
    if (classSel && classSel.options.length === 0 && Array.isArray(this.classesCache) && this.classesCache.length > 0) {
      classSel.innerHTML = this.classesCache
        .map((c) => `<option value="${c.id}">#${c.id} ${c.namePtBr} (${c.mcreworkCharKey})</option>`)
        .join('');
    }

    if (!this.monstersCache && app?.api) {
      try {
        const list = await app.api('/api/admin/monster-templates');
        this.monstersCache = Array.isArray(list) ? list.filter((m) => m.isTamableAsPet).slice(0, 40) : [];
      } catch {
        this.monstersCache = [];
      }
    }
    if (petSel && petSel.options.length <= 1 && Array.isArray(this.monstersCache) && this.monstersCache.length > 0) {
      petSel.innerHTML = '<option value="">Sem Pet de Preview</option>' +
        this.monstersCache.map((m) => `<option value="${m.id}">🐾 #${m.id} ${m.namePtBr}</option>`).join('');
    }
    this.syncMapImage(app);
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

  static nudgeInput(id, delta, isFloat = false, min = -200, max = 200) {
    const el = document.getElementById(id);
    if (!el) return;
    const cur = parseFloat(el.value) || 0;
    let next = cur + delta;
    next = Math.max(min, Math.min(max, next));
    el.value = isFloat ? String(Math.round(next * 100) / 100) : String(Math.round(next));
  }

  static renderFrame(app, now) {
    const canvas = document.getElementById('equipVisualPreviewCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // 1. Mapa de Fundo Real
    const maps = Array.isArray(app?.mapsList) ? app.mapsList : [];
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
    const visualScale = parseFloat(document.getElementById('equipVisualScaleInput')?.value) || 0.70;
    const visualOffsetX = parseInt(document.getElementById('equipVisualOffsetXInput')?.value, 10) || 0;
    const visualOffsetY = parseInt(document.getElementById('equipVisualOffsetYInput')?.value, 10) || 0;
    const flightAlt = parseInt(document.getElementById('equipMountAltitudeInput')?.value, 10) || 72;
    const riderOffsetX = parseInt(document.getElementById('equipMountRiderOffsetXInput')?.value, 10) || 0;
    const riderOffsetY = parseInt(document.getElementById('equipMountRiderOffsetInput')?.value, 10) ?? -22;

    const classId = Number(document.getElementById('equipPreviewClassSelect')?.value) || 1;
    const cls = (this.classesCache || []).find((c) => Number(c.id) === classId) || {
      mcreworkCharKey: '100101', groundOffsetY: 0, shadowOffsetX: 0, shadowOffsetY: 0,
    };
    const cKey = cls.mcreworkCharKey || '100101';
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
      if (slotCode === 'WINGS') {
        wingsObj = {
          modelId,
          visualFormat: 'CHAR_MANIFEST',
          manifestUrl: `/api/assets/mcrework/assets/wings/${modelId}/char_manifest.json`,
          thumbUrl: `/api/assets/mcrework/assets/wings/${modelId}/thumb.png`,
          visualScale,
          visualOffsetX,
          visualOffsetY,
        };
      } else if (slotCode === 'FLYING_MOUNT') {
        const isAtlas = visualFormat === 'ATLAS' || modelId.startsWith('mount_');
        mountObj = isAtlas ? {
          modelId,
          visualFormat: 'ATLAS',
          atlasJsonUrl: `/api/assets/mcrework/assets/mounts/${modelId}/atlas.json`,
          atlasWebpUrl: `/api/assets/mcrework/assets/mounts/${modelId}/atlas.webp`,
          thumbUrl: `/api/assets/mcrework/assets/mounts/${modelId}/thumb.webp`,
          flightAltitude: flightAlt,
          riderOffsetX,
          riderOffsetY,
          groundOffsetY: 0,
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
          groundOffsetY: 0,
          visualScale,
          visualOffsetX,
          visualOffsetY,
        };
      }
    }

    const worldX = Math.round(w / 2);
    const worldY = slotCode === 'FLYING_MOUNT' ? Math.round(h * 0.80) : Math.round(h * 0.68);

    // Marcador de solo
    ctx.strokeStyle = 'rgba(253, 224, 71, 0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(worldX - 18, worldY); ctx.lineTo(worldX + 18, worldY);
    ctx.moveTo(worldX, worldY - 8); ctx.lineTo(worldX, worldY + 8);
    ctx.stroke();

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
        isFlying: slotCode === 'FLYING_MOUNT',
        flightAltitude: slotCode === 'FLYING_MOUNT' ? flightAlt : 0,
        customScale: 0.70,
      });
    } else if (charSprite) {
      charSprite.draw(ctx, worldX, worldY, this.action, this.dir, now, null, cls.groundOffsetY || 0, 0.70);
    }
  }
}

window.AdminEquipmentVisualPreview = AdminEquipmentVisualPreview;
