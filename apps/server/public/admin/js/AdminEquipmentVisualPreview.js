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
  static autoRotate = false;
  static lastAutoRotateAt = 0;
  static previewZoom = 1.0;
  static previewReborn = false;
  static dragTarget = 'GLOBAL';
  static dragState = null;
  static lastStartedSlot = '';
  static wingDirOffsets = {};
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

  static syncPreviewControlsUi() {
    document.querySelectorAll('.equip-zoom-btn').forEach((btn) => {
      const z = parseFloat(btn.dataset.zoom || '1');
      btn.className = Math.abs(z - this.previewZoom) < 0.05 ? 'equip-zoom-btn btn-primary' : 'equip-zoom-btn';
    });
    const rebBtn = document.getElementById('btnEquipPrevReborn');
    if (rebBtn) {
      rebBtn.textContent = this.previewReborn ? '✨ Reborn' : '👤 Base';
      rebBtn.className = this.previewReborn ? 'btn-primary' : '';
    }
    const dragBtn = document.getElementById('btnEquipPrevDragMode');
    if (dragBtn) {
      dragBtn.textContent = this.dragTarget === 'DIR' ? '🎯 Arraste: Dir Atual' : '🖐️ Arraste: Global';
      dragBtn.className = this.dragTarget === 'DIR' ? 'btn-primary' : '';
    }
  }

  static setZoom(z) {
    const num = parseFloat(z);
    this.previewZoom = Number.isFinite(num) ? Math.max(1.0, Math.min(3.0, num)) : 1.0;
    this.syncPreviewControlsUi();
  }

  static toggleReborn(app) {
    this.previewReborn = !this.previewReborn;
    this.syncPreviewControlsUi();
    this.renderNow(app);
  }

  static toggleDragTarget() {
    this.dragTarget = this.dragTarget === 'DIR' ? 'GLOBAL' : 'DIR';
    this.syncPreviewControlsUi();
  }

  static bindCanvasDrag(app) {
    const canvas = document.getElementById('equipVisualPreviewCanvas');
    if (!canvas || canvas.dataset.dragBound === '1') return;
    canvas.dataset.dragBound = '1';

    canvas.addEventListener('pointerdown', (e) => {
      const slotCode = document.getElementById('equipSlotSelect')?.value || '';
      if (!slotCode) return;
      canvas.setPointerCapture?.(e.pointerId);
      canvas.style.cursor = 'grabbing';
      const curDir = this.wingDirOffsets?.[String(this.dir)] || { x: 0, y: 0, layer: 'AUTO' };
      this.dragState = {
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startGlobalX: this.parseSafeNum('equipVisualOffsetXInput', 0, false),
        startGlobalY: this.parseSafeNum('equipVisualOffsetYInput', 0, false),
        startDirX: Number(curDir.x) || 0,
        startDirY: Number(curDir.y) || 0,
      };
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!this.dragState || (this.dragState.pointerId !== undefined && e.pointerId !== this.dragState.pointerId)) return;
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const zoom = Math.max(1.0, Number(this.previewZoom) || 1.0);
      const dx = Math.round(((e.clientX - this.dragState.startClientX) * scaleX) / zoom);
      const dy = Math.round(((e.clientY - this.dragState.startClientY) * scaleY) / zoom);
      if (this.dragTarget === 'DIR') {
        this.updateCurrentDirOffset('x', this.dragState.startDirX + dx);
        this.updateCurrentDirOffset('y', this.dragState.startDirY + dy);
      } else {
        const nextX = Math.max(-150, Math.min(150, this.dragState.startGlobalX + dx));
        const nextY = Math.max(-150, Math.min(150, this.dragState.startGlobalY + dy));
        const xEl = document.getElementById('equipVisualOffsetXInput');
        const yEl = document.getElementById('equipVisualOffsetYInput');
        if (xEl) xEl.value = String(nextX);
        if (yEl) yEl.value = String(nextY);
        this.syncSliders();
      }
      this.renderFrame(app, performance.now());
    });

    const endDrag = (e) => {
      if (this.dragState && (this.dragState.pointerId === undefined || e.pointerId === this.dragState.pointerId)) {
        canvas.releasePointerCapture?.(e.pointerId);
        this.dragState = null;
        canvas.style.cursor = 'grab';
      }
    };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
  }

  static start(app) {
    this.stop();
    this.bindCanvasDrag(app);
    const slotCode = document.getElementById('equipSlotSelect')?.value || '';
    if (slotCode && slotCode !== this.lastStartedSlot) {
      this.lastStartedSlot = slotCode;
      this.previewZoom = slotCode === 'WEAPON_1' ? 2.0 : 1.0;
    }
    void this.ensureCatalogsLoaded(app);
    this.lastAutoRotateAt = performance.now();
    this.syncDirUi();
    this.syncPreviewControlsUi();
    const loop = (now) => {
      const box = document.getElementById('equipVisual25dBox');
      const modal = document.getElementById('equipmentModal');
      if (!box || box.style.display === 'none' || !modal || modal.style.display === 'none') {
        this.animId = null;
        return;
      }
      if (this.autoRotate && now - this.lastAutoRotateAt >= 900) {
        this.lastAutoRotateAt = now;
        this.rotateDir(1);
      }
      this.renderFrame(app, now);
      this.animId = requestAnimationFrame(loop);
    };
    this.animId = requestAnimationFrame(loop);
  }

  static renderNow(app) {
    this.syncSliders();
    this.syncDirUi();
    if (this.animId === null) {
      this.start(app);
    } else {
      this.renderFrame(app, performance.now());
    }
  }

  static stop() {
    this.autoRotate = false;
    if (this.animId !== null) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }

  static setDir(d) {
    this.dir = ((Number(d) % 8) + 8) % 8;
    this.syncDirUi();
  }

  static rotateDir(delta) {
    this.dir = ((this.dir + delta) % 8 + 8) % 8;
    this.syncDirUi();
  }

  static toggleAutoRotate() {
    this.autoRotate = !this.autoRotate;
    this.lastAutoRotateAt = performance.now();
    this.syncDirUi();
  }

  static syncDirUi() {
    const labelText = this.getDirLabel(this.dir);
    const lbl = document.getElementById('equipPreviewDirLabel');
    if (lbl) lbl.textContent = labelText;
    const fineLbl = document.getElementById('equipWingCurDirLabel');
    if (fineLbl) fineLbl.textContent = labelText;
    document.querySelectorAll('.equip-dir-btn').forEach((btn) => {
      const dStr = String(btn.dataset.dir);
      const ov = this.wingDirOffsets?.[dStr];
      const hasOverride = Boolean(ov && (Number(ov.x) || Number(ov.y) || (ov.layer && ov.layer !== 'AUTO')));
      btn.className = Number(btn.dataset.dir) === this.dir ? 'equip-dir-btn btn-primary' : 'equip-dir-btn';
      btn.style.borderColor = hasOverride ? '#fde047' : '';
    });
    const rotBtn = document.getElementById('btnEquipPrevAutoRot');
    if (rotBtn) rotBtn.className = this.autoRotate ? 'btn-primary' : '';
    this.syncDirFineInputs();
  }

  static loadWingDirOffsets(map) {
    this.wingDirOffsets = {};
    if (map && typeof map === 'object') {
      for (const [k, v] of Object.entries(map)) {
        if (!v || typeof v !== 'object') continue;
        const entry = {
          x: Number(v.x) || 0,
          y: Number(v.y) || 0,
          layer: ['AUTO', 'BACK', 'FRONT'].includes(v.layer) ? v.layer : 'AUTO',
        };
        if (entry.x !== 0 || entry.y !== 0 || entry.layer !== 'AUTO') {
          this.wingDirOffsets[String(k)] = entry;
        }
      }
    }
    this.syncDirUi();
  }

  static getWingDirOffsets() {
    const clean = {};
    for (const [k, v] of Object.entries(this.wingDirOffsets || {})) {
      if (!v) continue;
      const x = Number(v.x) || 0;
      const y = Number(v.y) || 0;
      const layer = ['AUTO', 'BACK', 'FRONT'].includes(v.layer) ? v.layer : 'AUTO';
      if (x !== 0 || y !== 0 || layer !== 'AUTO') {
        clean[String(k)] = { x, y, layer };
      }
    }
    return clean;
  }

  static syncDirFineInputs() {
    const cur = this.wingDirOffsets?.[String(this.dir)] || { x: 0, y: 0, layer: 'AUTO' };
    const xEl = document.getElementById('equipWingDirOffXInput');
    const yEl = document.getElementById('equipWingDirOffYInput');
    const lEl = document.getElementById('equipWingDirLayerSelect');
    if (xEl) xEl.value = String(Number(cur.x) || 0);
    if (yEl) yEl.value = String(Number(cur.y) || 0);
    if (lEl) lEl.value = ['AUTO', 'BACK', 'FRONT'].includes(cur.layer) ? cur.layer : 'AUTO';
  }

  static updateCurrentDirOffset(field, rawVal) {
    const dirKey = String(this.dir);
    const cur = { ...(this.wingDirOffsets?.[dirKey] || { x: 0, y: 0, layer: 'AUTO' }) };
    if (field === 'layer') {
      cur.layer = ['AUTO', 'BACK', 'FRONT'].includes(rawVal) ? rawVal : 'AUTO';
    } else {
      cur[field] = Math.max(-80, Math.min(80, Math.round(Number(rawVal) || 0)));
    }
    if ((cur.x || 0) === 0 && (cur.y || 0) === 0 && (cur.layer || 'AUTO') === 'AUTO') {
      delete this.wingDirOffsets[dirKey];
    } else {
      this.wingDirOffsets[dirKey] = cur;
    }

    const mirrorPair = { 1: 7, 7: 1, 2: 6, 6: 2, 3: 5, 5: 3 }[this.dir];
    const shouldMirror = Boolean(document.getElementById('equipWingMirrorPairChk')?.checked);
    if (shouldMirror && mirrorPair !== undefined) {
      const mKey = String(mirrorPair);
      const mEntry = {
        x: -(Number(cur.x) || 0),
        y: Number(cur.y) || 0,
        layer: cur.layer || 'AUTO',
      };
      if (mEntry.x === 0 && mEntry.y === 0 && mEntry.layer === 'AUTO') {
        delete this.wingDirOffsets[mKey];
      } else {
        this.wingDirOffsets[mKey] = mEntry;
      }
    }
    this.syncDirUi();
  }

  static nudgeDirOffset(field, delta) {
    const cur = this.wingDirOffsets?.[String(this.dir)] || { x: 0, y: 0, layer: 'AUTO' };
    this.updateCurrentDirOffset(field, (Number(cur[field]) || 0) + delta);
  }

  static resetAllDirOffsets() {
    this.wingDirOffsets = {};
    this.syncDirUi();
  }

  static setAction(act) {
    this.action = Number(act) || 0;
    const b0 = document.getElementById('btnEquipPrevAct0');
    const b1 = document.getElementById('btnEquipPrevAct1');
    const b3 = document.getElementById('btnEquipPrevAct3');
    if (b0) b0.className = this.action === 0 ? 'btn-primary' : '';
    if (b1) b1.className = this.action === 1 ? 'btn-primary' : '';
    if (b3) b3.className = this.action === 3 ? 'btn-primary' : '';
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
      ['equipVisualOffsetXInput', 'equipVisualOffsetXRange'],
      ['equipVisualOffsetYInput', 'equipVisualOffsetYRange'],
      ['equipMountAltitudeInput', 'equipMountAltitudeRange'],
      ['equipWingBackDepthInput', 'equipWingBackDepthRange'],
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
    const xBadge = document.getElementById('equipOffsetXStatusBadge');
    if (xBadge) {
      const xVal = this.parseSafeNum('equipVisualOffsetXInput', 0, false);
      xBadge.textContent = `${xVal > 0 ? '+' : ''}${xVal}px`;
      xBadge.style.color = xVal === 0 ? '#86efac' : '#fde047';
    }
    const yBadge = document.getElementById('equipOffsetYStatusBadge');
    if (yBadge) {
      const yVal = this.parseSafeNum('equipVisualOffsetYInput', 0, false);
      yBadge.textContent = `${yVal > 0 ? '+' : ''}${yVal}px`;
      yBadge.style.color = yVal === 0 ? '#86efac' : '#fde047';
    }
  }

  static renderFrame(app, now) {
    const canvas = document.getElementById('equipVisualPreviewCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const slotCode = document.getElementById('equipSlotSelect')?.value || '';
    const visVal = document.getElementById('equipVisualModelSelect')?.value || '';
    const visualScale = this.parseSafeNum('equipVisualScaleInput', slotCode === 'WINGS' ? 0.65 : 0.70, true);
    const visualOffsetX = this.parseSafeNum('equipVisualOffsetXInput', 0, false);
    const visualOffsetY = this.parseSafeNum('equipVisualOffsetYInput', slotCode === 'WINGS' ? -30 : 0, false);
    const groundOffsetZ = this.parseSafeNum('equipGroundOffsetYInput', 0, false);
    const wingBackDepth = this.parseSafeNum('equipWingBackDepthInput', 0, false);
    const flightAlt = this.parseSafeNum('equipMountAltitudeInput', 72, false);
    const riderOffsetX = this.parseSafeNum('equipMountRiderOffsetXInput', 0, false);
    const riderOffsetY = this.parseSafeNum('equipMountRiderOffsetInput', -22, false);
    const femaleOffsetX = this.parseSafeNum('equipWeaponFemaleOffXInput', 0, false);
    const femaleOffsetY = this.parseSafeNum('equipWeaponFemaleOffYInput', 0, false);

    const classes = Array.isArray(this.classesCache) && this.classesCache.length > 0
      ? this.classesCache
      : (Array.isArray(app?.classTemplates) ? app.classTemplates : []);
    const classId = Number(document.getElementById('equipPreviewClassSelect')?.value) || (classes[0]?.id || 1);
    const cls = classes.find((c) => Number(c.id) === classId) || classes[0] || {
      mcreworkCharKey: 'PC_MALE_000004', groundOffsetY: 0, shadowOffsetX: 0, shadowOffsetY: 0,
    };
    const usingReborn = Boolean(this.previewReborn && cls.rebornMcreworkCharKey);
    const cKey = usingReborn ? cls.rebornMcreworkCharKey : (cls.mcreworkCharKey || 'PC_MALE_000004');
    const charGroundOffsetY = usingReborn ? (cls.rebornGroundOffsetY ?? cls.groundOffsetY ?? 0) : (cls.groundOffsetY || 0);
    const charShadowX = usingReborn ? (cls.rebornShadowOffsetX ?? cls.shadowOffsetX ?? 0) : (cls.shadowOffsetX || 0);
    const charShadowY = usingReborn ? (cls.rebornShadowOffsetY ?? cls.shadowOffsetY ?? 0) : (cls.shadowOffsetY || 0);

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

    const [kind, modelId, visualFormat, extraModelId] = visVal.split('|');
    const femaleSelEl = document.getElementById('equipWeaponFemaleModelSelect');
    const resolvedFemaleId = femaleSelEl ? (femaleSelEl.value || null) : (extraModelId || null);

    let wingsObj = null;
    let mountObj = null;
    let weaponObj = null;
    if (visVal) {
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
          backDepth: wingBackDepth,
          dirOffsets: this.getWingDirOffsets(),
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
      } else if (slotCode === 'WEAPON_1' && modelId) {
        weaponObj = {
          modelId,
          maleModelId: modelId,
          femaleModelId: resolvedFemaleId,
          visualFormat: 'CHAR_MANIFEST',
          manifestUrl: `/api/assets/mcrework/assets/weapons/${modelId}/char_manifest.json`,
          maleManifestUrl: `/api/assets/mcrework/assets/weapons/${modelId}/char_manifest.json`,
          femaleManifestUrl: resolvedFemaleId ? `/api/assets/mcrework/assets/weapons/${resolvedFemaleId}/char_manifest.json` : null,
          visualScale,
          visualOffsetX,
          visualOffsetY,
          femaleOffsetX,
          femaleOffsetY,
          groundOffsetY: groundOffsetZ,
          dirOffsets: this.getWingDirOffsets(),
        };
      }
    }

    const worldX = Math.round(w / 2);
    const worldY = slotCode === 'FLYING_MOUNT' ? Math.round(h * 0.82) : Math.round(h * 0.72);
    const zoom = Math.max(1.0, Number(this.previewZoom) || 1.0);
    const pivotX = worldX;
    const pivotY = worldY - 28;

    ctx.save();
    if (zoom > 1.01) {
      ctx.translate(pivotX, pivotY);
      ctx.scale(zoom, zoom);
      ctx.translate(-pivotX, -pivotY);
    }

    // 1. Mapa de Fundo Real (escala 1:1 junto com o personagem no zoom)
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
        groundOffsetY: charGroundOffsetY,
        shadowOffsetX: charShadowX,
        shadowOffsetY: charShadowY,
        wingsObj,
        mountObj,
        weaponObj,
        charKey: cKey,
        followerPet,
        isFlying: slotCode === 'FLYING_MOUNT' && Boolean(mountObj),
        flightAltitude: slotCode === 'FLYING_MOUNT' && Boolean(mountObj) ? flightAlt : 0,
        customScale: 0.70,
      });
    } else if (charSprite) {
      charSprite.draw(ctx, worldX, worldY, this.action, this.dir, now, null, charGroundOffsetY, 0.70);
    }

    ctx.restore();

    // Badges HUD fora da matriz de zoom (sempre nítidos)
    ctx.save();
    ctx.fillStyle = 'rgba(2, 6, 23, 0.78)';
    ctx.fillRect(6, 6, 206, 20);
    ctx.font = 'bold 10px sans-serif';
    ctx.fillStyle = '#fde047';
    ctx.textAlign = 'left';
    ctx.fillText(`🔍 ${zoom.toFixed(1)}x • X:${visualOffsetX} Y:${visualOffsetY} Z:${groundOffsetZ}`, 12, 19);

    if (slotCode === 'WEAPON_1' && weaponObj && window.PlayFlightAndWingsController) {
      const activeRes = window.PlayFlightAndWingsController.resolveWeaponModelForChar(weaponObj, cKey);
      const tag = activeRes ? `${activeRes.modelId} (${usingReborn ? 'Reborn' : 'Base'})` : (usingReborn ? 'Reborn' : 'Base');
      const bw = Math.min(w - 220, Math.max(120, tag.length * 6 + 14));
      ctx.fillStyle = 'rgba(2, 6, 23, 0.78)';
      ctx.fillRect(w - bw - 6, 6, bw, 20);
      ctx.fillStyle = '#38bdf8';
      ctx.textAlign = 'right';
      ctx.fillText(tag, w - 12, 19);
    }
    ctx.restore();
  }
}

window.AdminEquipmentVisualPreview = AdminEquipmentVisualPreview;
