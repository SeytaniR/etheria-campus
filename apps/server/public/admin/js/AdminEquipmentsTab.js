/**
 * @file apps/server/public/admin/js/AdminEquipmentsTab.js
 * @module @etheria/server
 * @description Submódulo da Aba Tabela de Cadastro de Equipamentos e Armas (`item_templates`) da Rota `/admin`.
 *   - CRUD completo de Equipamentos com busca em tempo real por nome/código e filtros por Slot, Categoria e Raridade.
 *   - Gerenciamento dos 16 Slots de Personagem e 6 Slots de Pet com suporte a restrições de nível e classes.
 *   - Bônus EXCLUSIVOS de combate na arena action (sem atributos base).
 *   - Remoção de valor em ouro (itens não comercializáveis pelo jogo).
 *   - Layout 100% responsivo e adaptativo para Mobile Vertical (Portrait) e Desktop.
 *   - Modal desacoplado em AdminEquipmentModalDom.js mantendo estrita conformidade com a Regra #7 (< 1.000 linhas).
 */

class AdminEquipmentsTab {
  static attach(app) {
    app.equipmentTemplates = [];
    app.equipmentSlots = [];
    app.equipmentSets = [];
    app.mcreworkEquipment = [];
    app.selectedMcreworkEquipmentIcon = '';
    app.equipmentSearchQuery = '';
    app.equipmentSlotFilter = 'ALL';
    app.equipmentSetFilter = 'ALL';
    app.equipmentCategoryFilter = 'ALL';
    app.equipmentRarityFilter = 'ALL';
    app.equipmentGallerySearchQuery = '';
    app.equipmentGalleryGroupFilter = 'ALL';

    AdminEquipmentsTab.injectTabAndModalDom();
    if (window.AdminEquipmentTableView) window.AdminEquipmentTableView.attach(app);

    app.loadEquipmentTemplates = async function () {
      try {
        if (!this.equipmentSets || this.equipmentSets.length === 0) {
          try {
            this.equipmentSets = await this.api('/api/admin/equipment-sets');
          } catch {}
        }
        this.equipmentTemplates = await this.api('/api/admin/equipments');
        this.populateEquipmentSetDropdowns?.();
        this.renderEquipmentsCrudTable();
      } catch (err) {
        console.error('Falha ao carregar templates de equipamentos:', err);
      }
    };

    app.loadEquipmentSlots = async function () {
      if (this.equipmentSlots && this.equipmentSlots.length > 0) return;
      try {
        this.equipmentSlots = await this.api('/api/admin/equipment-slots');
        this.populateEquipmentSlotDropdowns();
      } catch (err) {
        console.error('Falha ao carregar slots de equipamentos:', err);
      }
    };

    app.loadMcreworkEquipment = async function () {
      if (!this.mcreworkEquipment || this.mcreworkEquipment.length === 0) {
        try {
          this.mcreworkEquipment = await this.api('/api/admin/mcrework/equipment');
        } catch (err) {
          console.error('Falha ao carregar catálogo mcrework de equipamentos:', err);
        }
      }
      if (!this.mcreworkVisualModels) {
        try {
          this.mcreworkVisualModels = await this.api('/api/admin/equipments/visual-models');
        } catch (err) {
          console.warn('Falha ao carregar catálogo visual 2.5D de asas/montarias:', err);
        }
      }
    };

    app.populateVisualModelsDropdown = function (slotCode, currentFx) {
      const box = document.getElementById('equipVisual25dBox');
      const titleEl = document.getElementById('equipVisual25dTitle');
      const sel = document.getElementById('equipVisualModelSelect');
      const mountRow = document.getElementById('equipMountCalibrationRow');
      const wingDepthSec = document.getElementById('equipWingBackDepthSection');
      if (!box || !sel) return;

      const isWing = slotCode === 'WINGS';
      const isMount = slotCode === 'FLYING_MOUNT';
      const isWeapon = slotCode === 'WEAPON_1';
      const wingBox = document.getElementById('equipWingDepthBox');
      const femField = document.getElementById('equipWeaponFemaleModelField');
      const femSel = document.getElementById('equipWeaponFemaleModelSelect');
      const femDetails = document.getElementById('equipWeaponFemaleOffsetDetails');
      const modelLbl = document.getElementById('equipVisualModelLabel');
      const mirrorChk = document.getElementById('equipWingMirrorPairChk');
      box.style.display = (isWing || isMount || isWeapon) ? 'block' : 'none';
      if (wingBox) wingBox.style.display = (isWing || isWeapon) ? 'flex' : 'none';
      if (wingDepthSec) wingDepthSec.style.display = isWing ? 'flex' : 'none';
      if (mountRow) mountRow.style.display = isMount ? 'grid' : 'none';
      if (femField) femField.style.display = isWeapon ? 'block' : 'none';
      if (femDetails) femDetails.style.display = isWeapon ? 'block' : 'none';
      if (modelLbl) modelLbl.textContent = isWeapon ? '⚔️ Modelo 2.5D Masculino (equip_mc*)' : 'Modelo 2.5D Animado (mcrework)';
      if (mirrorChk) mirrorChk.checked = isWing;
      if (titleEl) {
        titleEl.textContent = isWeapon
          ? '⚔️ Vínculo, Tamanho & Calibração 2.5D (Arma Principal)'
          : isWing
            ? '🪽 Vínculo, Tamanho & Calibração 2.5D (Asas Celestiais)'
            : '🦅 Vínculo, Tamanho & Calibração 2.5D (Montaria Voadora)';
      }
      if (!isWing && !isMount && !isWeapon) {
        window.AdminEquipmentVisualPreview?.stop();
        return;
      }

      const cat = this.mcreworkVisualModels || { wings: [], gliders: [], mounts: [], weapons: [] };
      const opts = ['<option value="">Sem modelo 2.5D vinculado</option>'];
      if (isWing) {
        for (const w of cat.wings || []) {
          opts.push(`<option value="WING|${w.modelId}|CHAR_MANIFEST">🪽 ${w.name} (${w.modelId})</option>`);
        }
      } else if (isMount) {
        for (const g of cat.gliders || []) {
          opts.push(`<option value="GLIDER|${g.modelId}|CHAR_MANIFEST">☁️ ${g.name} (${g.modelId})</option>`);
        }
        for (const m of cat.mounts || []) {
          opts.push(`<option value="MOUNT|${m.modelId}|ATLAS">🦅 ${m.name} (${m.modelId})</option>`);
        }
      } else if (isWeapon) {
        for (const w of cat.weapons || []) {
          opts.push(`<option value="WEAPON|${w.maleModelId}|CHAR_MANIFEST|${w.femaleModelId || ''}">⚔️ [${w.typeName || 'Arma'}] ${w.name} (${w.maleModelId})</option>`);
        }
        if (femSel) {
          const seenFem = new Set();
          const femOpts = ['<option value="">Usar mesmo modelo / Padrão</option>'];
          for (const w of cat.weapons || []) {
            if (!w.femaleModelId || seenFem.has(w.femaleModelId)) continue;
            seenFem.add(w.femaleModelId);
            femOpts.push(`<option value="${w.femaleModelId}">👩 [${w.typeName || 'Arma'}] ${w.name} (${w.femaleModelId})</option>`);
          }
          femSel.innerHTML = femOpts.join('');
        }
      }
      sel.innerHTML = opts.join('');

      // Montarias voadoras só interferem nos 6 atributos permitidos (HP, MP, ATQ/DEF Fís/Mág)
      const disallowedForMount = ['HEAL_POWER', 'ATTACK_RANGE', 'BATTLE_MOVE_SPEED', 'ATTACK_SPEED', 'CRIT_RATE', 'CRIT_DMG', 'PHYS_ACCURACY', 'PHYS_EVASION', 'MAG_ACCURACY', 'MAG_EVASION'];
      for (const statCode of disallowedForMount) {
        const inp = document.getElementById(`equipCombat${statCode}Input`);
        if (inp) {
          if (isMount) { inp.value = '0'; inp.disabled = true; inp.style.opacity = '0.35'; }
          else { inp.disabled = false; inp.style.opacity = '1'; }
        }
      }

      const fx = currentFx && typeof currentFx === 'object' ? currentFx : {};
      const mid = isWing ? (fx.wingModelId || '') : (isMount ? (fx.mountModelId || '') : (fx.weaponModelId || ''));
      if (mid) {
        let match = Array.from(sel.options).find((o) => o.value.includes(`|${mid}|`));
        if (!match && isWeapon) {
          const customOpt = document.createElement('option');
          customOpt.value = `WEAPON|${mid}|CHAR_MANIFEST|${fx.weaponFemaleModelId || ''}`;
          customOpt.textContent = `⚔️ [Custom] ${mid}`;
          sel.appendChild(customOpt);
          match = customOpt;
        }
        if (match) sel.value = match.value;
      }
      if (isWeapon && femSel) {
        const fid = String(fx.weaponFemaleModelId || '').trim();
        if (fid && !Array.from(femSel.options).some((o) => o.value === fid)) {
          const opt = document.createElement('option');
          opt.value = fid;
          opt.textContent = `👩 [Custom] ${fid}`;
          femSel.appendChild(opt);
        }
        femSel.value = fid;
        const fxX = document.getElementById('equipWeaponFemaleOffXInput');
        const fxY = document.getElementById('equipWeaponFemaleOffYInput');
        if (fxX) fxX.value = fx.femaleOffsetX ?? 0;
        if (fxY) fxY.value = fx.femaleOffsetY ?? 0;
      }
      document.getElementById('equipVisualScaleInput').value = fx.visualScale ?? (isWing ? 0.65 : 0.70);
      document.getElementById('equipVisualOffsetXInput').value = fx.visualOffsetX ?? 0;
      document.getElementById('equipVisualOffsetYInput').value = fx.visualOffsetY ?? (isWing ? -30 : 0);
      const gOffInp = document.getElementById('equipGroundOffsetYInput');
      if (gOffInp) gOffInp.value = fx.groundOffsetY ?? 0;
      const depthInp = document.getElementById('equipWingBackDepthInput');
      if (depthInp) depthInp.value = fx.backDepth ?? 0;
      window.AdminEquipmentVisualPreview?.loadWingDirOffsets?.((isWing || isWeapon) ? (fx.dirOffsets || {}) : {});
      if (isMount) {
        document.getElementById('equipMountAltitudeInput').value = fx.flightAltitude ?? 72;
        document.getElementById('equipMountRiderOffsetXInput').value = fx.riderOffsetX ?? 0;
        document.getElementById('equipMountRiderOffsetInput').value = fx.riderOffsetY ?? -22;
        document.getElementById('equipMountSpeedBonusInput').value = fx.speedBonusPct ?? 25;
      }
      window.AdminEquipmentVisualPreview?.syncSliders?.();
      window.AdminEquipmentVisualPreview?.start(this);
    };

    app.onEquipmentSlotChange = function () {
      const slotCode = document.getElementById('equipSlotSelect')?.value || '';
      this.populateVisualModelsDropdown(slotCode, {});
    };

    app.onVisualModelSelectChange = function () {
      const val = document.getElementById('equipVisualModelSelect')?.value || '';
      if (!val) return;
      const [kind, modelId] = val.split('|');
      const cat = this.mcreworkVisualModels || { wings: [], gliders: [], mounts: [] };
      const setNum = (id, v) => {
        const el = document.getElementById(id);
        if (el) el.value = v;
      };
      if (kind === 'WING') {
        const w = (cat.wings || []).find((x) => x.modelId === modelId);
        if (w?.iconKey) {
          document.getElementById('equipIconKeyInput').value = w.iconKey;
          this.updateEquipmentIconPreview(w.iconKey);
        }
        setNum('equipVisualScaleInput', 0.65);
        setNum('equipVisualOffsetXInput', 0);
        setNum('equipVisualOffsetYInput', -30);
        setNum('equipWingBackDepthInput', 0);
        window.AdminEquipmentVisualPreview?.loadWingDirOffsets?.({});
      } else if (kind === 'GLIDER') {
        const g = (cat.gliders || []).find((x) => x.modelId === modelId);
        if (g?.iconKey) {
          document.getElementById('equipIconKeyInput').value = g.iconKey;
          this.updateEquipmentIconPreview(g.iconKey);
        }
        setNum('equipVisualScaleInput', 0.70);
        setNum('equipVisualOffsetXInput', 0);
        setNum('equipVisualOffsetYInput', 0);
        setNum('equipMountRiderOffsetXInput', 0);
        setNum('equipMountRiderOffsetInput', -22);
        setNum('equipMountAltitudeInput', 72);
      } else if (kind === 'WEAPON') {
        const [, , , femModelId] = val.split('|');
        const femSel = document.getElementById('equipWeaponFemaleModelSelect');
        if (femSel) femSel.value = femModelId || '';
        setNum('equipVisualScaleInput', 0.70);
        setNum('equipVisualOffsetXInput', 0);
        setNum('equipVisualOffsetYInput', 0);
        setNum('equipGroundOffsetYInput', 0);
        setNum('equipWeaponFemaleOffXInput', 0);
        setNum('equipWeaponFemaleOffYInput', 0);
        window.AdminEquipmentVisualPreview?.loadWingDirOffsets?.({});
        window.AdminEquipmentVisualPreview?.setZoom?.(2.0);
      } else if (kind === 'MOUNT') {
        const m = (cat.mounts || []).find((x) => x.modelId === modelId);
        if (m) {
          setNum('equipVisualScaleInput', 0.70);
          setNum('equipVisualOffsetXInput', 0);
          setNum('equipVisualOffsetYInput', 0);
          setNum('equipGroundOffsetYInput', m.groundOffsetY ?? 0);
          setNum('equipMountRiderOffsetXInput', 0);
          setNum('equipMountAltitudeInput', m.flightAltitude ?? 65);
          setNum('equipMountRiderOffsetInput', m.riderOffsetY ?? -45);
          setNum('equipMountSpeedBonusInput', m.speedBonusPct ?? 35);
        }
      }
      window.AdminEquipmentVisualPreview?.syncSliders?.();
      window.AdminEquipmentVisualPreview?.renderNow?.(this);
    };

    app.populateEquipmentSlotDropdowns = function () {
      const filterSelect = document.getElementById('equipSlotFilterSelect');
      const formSelect = document.getElementById('equipSlotSelect');
      if (!this.equipmentSlots) return;

      const optsHtml = this.equipmentSlots
        .filter((s) => s.code !== 'FISHING_ROD')
        .map((s) => `<option value="${s.code}">[${s.ownerType === 'PET' ? '🐾 Pet' : '👤 Char'}] ${s.labelPtBr}</option>`)
        .join('');

      if (filterSelect) {
        filterSelect.innerHTML = `<option value="ALL">Todos os Slots</option>${optsHtml}`;
      }
      if (formSelect) {
        formSelect.innerHTML = optsHtml;
      }
    };

    app.populateEquipmentSetDropdowns = function () {
      const filterSelect = document.getElementById('equipSetFilterSelect');
      const formSelect = document.getElementById('equipSetSelect');
      if (!this.equipmentSets) return;

      const optsHtml = this.equipmentSets
        .map((s) => `<option value="${s.id}">👑 ${s.namePtBr} (Nv.${s.requiredLevel})</option>`)
        .join('');

      if (filterSelect) {
        const curVal = filterSelect.value;
        filterSelect.innerHTML = `<option value="ALL">Todos os Conjuntos</option><option value="NONE">Sem Conjunto</option>${optsHtml}`;
        if (curVal) filterSelect.value = curVal;
      }
      if (formSelect) {
        const curVal = formSelect.value;
        formSelect.innerHTML = `<option value="">Nenhum Conjunto</option>${optsHtml}`;
        if (curVal) formSelect.value = curVal;
      }
    };

    app.openCreateEquipmentModal = async function () {
      await this.loadEquipmentSlots();
      await this.loadMcreworkEquipment();

      document.getElementById('equipEditIdInput').value = '';
      document.getElementById('equipModalTitle').textContent = '🛡️ Cadastrar Novo Equipamento';
      document.getElementById('equipNameInput').value = '';
      document.getElementById('equipDescriptionInput').value = '';
      document.getElementById('equipCodeInput').value = '';
      document.getElementById('equipCategorySelect').value = 'CHARACTER_EQUIPMENT';
      document.getElementById('equipSlotSelect').value = 'WEAPON_1';
      if (document.getElementById('equipSetSelect')) {
        document.getElementById('equipSetSelect').value = '';
      }
      document.getElementById('equipRaritySelect').value = 'F';
      document.getElementById('equipReqLevelInput').value = '1';
      document.getElementById('equipActiveSelect').value = 'true';
      document.getElementById('equipIconKeyInput').value = 'assets/equipment/icons/equip_normal_100001.png';
      this.updateEquipmentIconPreview('assets/equipment/icons/equip_normal_100001.png');

      const combatFields = [
        'PHYS_ATK', 'MAG_ATK', 'HEAL_POWER', 'ATTACK_RANGE',
        'MAX_HP', 'MAX_MP', 'PHYS_DEF', 'MAG_DEF',
        'BATTLE_MOVE_SPEED', 'ATTACK_SPEED', 'CRIT_RATE', 'CRIT_DMG',
        'PHYS_ACCURACY', 'MAG_ACCURACY', 'PHYS_EVASION', 'MAG_EVASION'
      ];
      combatFields.forEach((cf) => {
        const inp = document.getElementById(`equipCombat${cf}Input`);
        if (inp) inp.value = '0';
      });

      document.getElementById('equipmentModal').style.display = 'flex';
      this.populateVisualModelsDropdown('WEAPON_1', {});
      this.renderEquipmentGallery();
    };

    app.openEditEquipmentModal = async function (id) {
      await this.loadEquipmentSlots();
      await this.loadMcreworkEquipment();

      const item = (this.equipmentTemplates || []).find((e) => e.id === id);
      if (!item) return;

      document.getElementById('equipEditIdInput').value = item.id;
      document.getElementById('equipModalTitle').textContent = `✏️ Editar Equipamento: ${item.namePtBr}`;
      document.getElementById('equipNameInput').value = item.namePtBr || '';
      document.getElementById('equipDescriptionInput').value = item.descriptionPtBr || '';
      document.getElementById('equipCodeInput').value = item.code || '';
      document.getElementById('equipCategorySelect').value = item.itemCategory || 'CHARACTER_EQUIPMENT';
      document.getElementById('equipSlotSelect').value = item.equipmentSlotCode || 'WEAPON_1';
      if (document.getElementById('equipSetSelect')) {
        document.getElementById('equipSetSelect').value = item.equipmentSetId ? String(item.equipmentSetId) : '';
      }
      document.getElementById('equipRaritySelect').value = item.rarityTier || 'F';
      document.getElementById('equipReqLevelInput').value = item.requiredLevel ?? 1;
      document.getElementById('equipActiveSelect').value = String(item.isActive ?? true);
      document.getElementById('equipIconKeyInput').value = item.mcreworkIconKey || '';
      this.updateEquipmentIconPreview(item.mcreworkIconKey);

      const cb = item.combatStatBonusesJson || {};
      const combatFields = [
        'PHYS_ATK', 'MAG_ATK', 'HEAL_POWER', 'ATTACK_RANGE',
        'MAX_HP', 'MAX_MP', 'PHYS_DEF', 'MAG_DEF',
        'BATTLE_MOVE_SPEED', 'ATTACK_SPEED',
        'PHYS_ACCURACY', 'MAG_ACCURACY', 'PHYS_EVASION', 'MAG_EVASION'
      ];
      combatFields.forEach((cf) => {
        const inp = document.getElementById(`equipCombat${cf}Input`);
        if (inp) inp.value = cb[cf] ?? 0;
      });

      // Suporte unificado para CRIT_RATE / CRIT_CHANCE_PCT e CRIT_DMG / CRIT_DAMAGE_PCT
      const critRateEl = document.getElementById('equipCombatCRIT_RATEInput');
      if (critRateEl) critRateEl.value = cb.CRIT_RATE ?? cb.CRIT_CHANCE_PCT ?? 0;
      const critDmgEl = document.getElementById('equipCombatCRIT_DMGInput');
      if (critDmgEl) critDmgEl.value = cb.CRIT_DMG ?? cb.CRIT_DAMAGE_PCT ?? 0;

      document.getElementById('equipmentModal').style.display = 'flex';
      this.populateVisualModelsDropdown(item.equipmentSlotCode || 'WEAPON_1', item.specialEffectJson || {});
      this.renderEquipmentGallery();
    };

    app.updateEquipmentIconPreview = function (iconKey) {
      const preview = document.getElementById('equipActiveIconImg');
      const badge = document.getElementById('equipActiveIconBadge');
      if (!iconKey) iconKey = 'assets/equipment/icons/equip_normal_100001.png';
      const clean = iconKey.replace(/^\/+/, '');
      const url = `/api/assets/mcrework/${clean}`;
      if (preview) preview.src = url;
      if (badge) badge.textContent = clean;
    };

    app.selectMcreworkEquipment = function (item) {
      document.getElementById('equipIconKeyInput').value = item.mcreworkIconKey;
      this.updateEquipmentIconPreview(item.mcreworkIconKey);

      const nameInp = document.getElementById('equipNameInput');
      if (!nameInp.value || nameInp.value.trim() === '') {
        nameInp.value = item.name;
      }
      const descInp = document.getElementById('equipDescriptionInput');
      if (!descInp.value || descInp.value.trim() === '') {
        descInp.value = item.description;
      }

      if (item.suggestedSlot) {
        document.getElementById('equipSlotSelect').value = item.suggestedSlot;
        const initFx = item.suggestedSlot === 'WEAPON_1' && (item.suggestedWeaponMaleModelId || item.suggestedWeaponFemaleModelId)
          ? {
              weaponModelId: item.suggestedWeaponMaleModelId || item.suggestedWeaponFemaleModelId,
              weaponFemaleModelId: item.suggestedWeaponFemaleModelId || undefined,
            }
          : item.suggestedModelId
            ? {
                wingModelId: item.suggestedSlot === 'WINGS' ? item.suggestedModelId : undefined,
                mountModelId: item.suggestedSlot === 'FLYING_MOUNT' ? item.suggestedModelId : undefined,
              }
            : {};
        this.populateVisualModelsDropdown(item.suggestedSlot, initFx);
      }
      if (item.suggestedCategory) {
        document.getElementById('equipCategorySelect').value = item.suggestedCategory;
      }
      if (item.reqLevel) {
        document.getElementById('equipReqLevelInput').value = item.reqLevel;
      }

      if (Array.isArray(item.stats) && item.stats.length > 0) {
        item.stats.forEach((st) => {
          const valNum = parseInt(String(st.value).replace(/[^0-9-]/g, ''), 10) || 0;
          const lbl = (st.label || '').toLowerCase();
          if (lbl.includes('ataque físico') || lbl.includes('dano físico')) {
            const el = document.getElementById('equipCombatPHYS_ATKInput');
            if (el && Number(el.value) === 0) el.value = valNum;
          } else if (lbl.includes('ataque mágico') || lbl.includes('dano mágico')) {
            const el = document.getElementById('equipCombatMAG_ATKInput');
            if (el && Number(el.value) === 0) el.value = valNum;
          } else if (lbl.includes('defesa física')) {
            const el = document.getElementById('equipCombatPHYS_DEFInput');
            if (el && Number(el.value) === 0) el.value = valNum;
          } else if (lbl.includes('defesa mágica')) {
            const el = document.getElementById('equipCombatMAG_DEFInput');
            if (el && Number(el.value) === 0) el.value = valNum;
          } else if (lbl.includes('vida') || lbl.includes('hp')) {
            const el = document.getElementById('equipCombatMAX_HPInput');
            if (el && Number(el.value) === 0) el.value = valNum;
          } else if (lbl.includes('mana') || lbl.includes('mp')) {
            const el = document.getElementById('equipCombatMAX_MPInput');
            if (el && Number(el.value) === 0) el.value = valNum;
          }
        });
      }
    };

    app.saveEquipmentTemplate = async function () {
      const editId = document.getElementById('equipEditIdInput').value;
      const namePtBr = document.getElementById('equipNameInput').value.trim();
      const descriptionPtBr = document.getElementById('equipDescriptionInput').value.trim();
      const code = document.getElementById('equipCodeInput').value.trim();
      const itemCategory = document.getElementById('equipCategorySelect').value;
      const equipmentSlotCode = document.getElementById('equipSlotSelect').value;
      const rarityTier = document.getElementById('equipRaritySelect').value;
      const requiredLevel = parseInt(document.getElementById('equipReqLevelInput').value, 10) || 1;
      const isActive = document.getElementById('equipActiveSelect').value === 'true';
      const mcreworkIconKey = document.getElementById('equipIconKeyInput').value.trim();

      if (!namePtBr) {
        alert('Por favor, informe o nome do equipamento em português.');
        return;
      }

      // Equipamentos e armas NÃO dão bônus de atributos base
      const baseStatBonusesJson = {};

      // Bônus exclusivos de atributos de combate na arena
      const combatStatBonusesJson = {};
      const combatFields = [
        'PHYS_ATK', 'MAG_ATK', 'HEAL_POWER', 'ATTACK_RANGE',
        'MAX_HP', 'MAX_MP', 'PHYS_DEF', 'MAG_DEF',
        'BATTLE_MOVE_SPEED', 'ATTACK_SPEED', 'CRIT_RATE', 'CRIT_DMG',
        'PHYS_ACCURACY', 'MAG_ACCURACY', 'PHYS_EVASION', 'MAG_EVASION'
      ];
      combatFields.forEach((cf) => {
        const val = parseFloat(document.getElementById(`equipCombat${cf}Input`)?.value) || 0;
        if (val !== 0) combatStatBonusesJson[cf] = val;
      });

      const equipmentSetId = document.getElementById('equipSetSelect')?.value
        ? Number(document.getElementById('equipSetSelect').value)
        : null;

      const existingItem = editId ? (this.equipmentTemplates || []).find((e) => String(e.id) === String(editId)) : null;
      const baseFx = (existingItem?.specialEffectJson && typeof existingItem.specialEffectJson === 'object') ? { ...existingItem.specialEffectJson } : {};
      let specialEffectJson = baseFx;
      if (equipmentSlotCode === 'WINGS' || equipmentSlotCode === 'FLYING_MOUNT' || equipmentSlotCode === 'WEAPON_1') {
        const visVal = document.getElementById('equipVisualModelSelect')?.value || '';
        if (visVal) {
          const [kind, modelId, visualFormat, femaleModelId] = visVal.split('|');
          const visualScale = parseFloat(document.getElementById('equipVisualScaleInput')?.value) || (equipmentSlotCode === 'WINGS' ? 0.65 : 0.70);
          const visualOffsetX = parseInt(document.getElementById('equipVisualOffsetXInput')?.value, 10) || 0;
          const rawOffY = parseInt(document.getElementById('equipVisualOffsetYInput')?.value, 10);
          const visualOffsetY = Number.isFinite(rawOffY) ? rawOffY : (equipmentSlotCode === 'WINGS' ? -30 : 0);
          const rawGroundZ = parseInt(document.getElementById('equipGroundOffsetYInput')?.value, 10);
          const groundOffsetY = Number.isFinite(rawGroundZ) ? rawGroundZ : 0;
          if (equipmentSlotCode === 'WINGS') {
            const rawDepth = parseInt(document.getElementById('equipWingBackDepthInput')?.value, 10);
            const backDepth = Number.isFinite(rawDepth) ? rawDepth : 0;
            const dirOffsets = window.AdminEquipmentVisualPreview?.getWingDirOffsets?.() || {};
            specialEffectJson = {
              wingModelId: modelId,
              visualFormat: visualFormat || 'CHAR_MANIFEST',
              manifestUrl: `/api/assets/mcrework/assets/wings/${modelId}/char_manifest.json`,
              visualScale,
              visualOffsetX,
              visualOffsetY,
              groundOffsetY,
              backDepth,
              ...(Object.keys(dirOffsets).length > 0 ? { dirOffsets } : {}),
            };
          } else if (equipmentSlotCode === 'FLYING_MOUNT') {
            const rawRiderY = parseInt(document.getElementById('equipMountRiderOffsetInput')?.value, 10);
            specialEffectJson = {
              mountModelId: modelId,
              visualFormat: visualFormat || 'CHAR_MANIFEST',
              manifestUrl: kind === 'GLIDER' ? `/api/assets/mcrework/assets/wings/${modelId}/char_manifest.json` : undefined,
              visualScale,
              visualOffsetX,
              visualOffsetY,
              groundOffsetY,
              flightAltitude: parseInt(document.getElementById('equipMountAltitudeInput')?.value, 10) || 72,
              riderOffsetX: parseInt(document.getElementById('equipMountRiderOffsetXInput')?.value, 10) || 0,
              riderOffsetY: Number.isFinite(rawRiderY) ? rawRiderY : -22,
              speedBonusPct: parseFloat(document.getElementById('equipMountSpeedBonusInput')?.value) || 25,
            };
          } else if (kind === 'WEAPON' && modelId) {
            const dirOffsets = window.AdminEquipmentVisualPreview?.getWingDirOffsets?.() || {};
            const chosenFemale = document.getElementById('equipWeaponFemaleModelSelect')?.value || '';
            const femaleOffsetX = parseInt(document.getElementById('equipWeaponFemaleOffXInput')?.value, 10) || 0;
            const femaleOffsetY = parseInt(document.getElementById('equipWeaponFemaleOffYInput')?.value, 10) || 0;
            delete specialEffectJson.weaponVisualCleared;
            delete specialEffectJson.weaponFemaleModelId;
            delete specialEffectJson.femaleManifestUrl;
            delete specialEffectJson.femaleOffsetX;
            delete specialEffectJson.femaleOffsetY;
            delete specialEffectJson.dirOffsets;
            Object.assign(specialEffectJson, {
              weaponModelId: modelId,
              ...(chosenFemale ? { weaponFemaleModelId: chosenFemale, femaleManifestUrl: `/api/assets/mcrework/assets/weapons/${chosenFemale}/char_manifest.json` } : {}),
              visualFormat: 'CHAR_MANIFEST',
              manifestUrl: `/api/assets/mcrework/assets/weapons/${modelId}/char_manifest.json`,
              visualScale,
              visualOffsetX,
              visualOffsetY,
              ...(femaleOffsetX !== 0 ? { femaleOffsetX } : {}),
              ...(femaleOffsetY !== 0 ? { femaleOffsetY } : {}),
              groundOffsetY,
              ...(Object.keys(dirOffsets).length > 0 ? { dirOffsets } : {}),
            });
          }
        } else if (equipmentSlotCode === 'WEAPON_1') {
          for (const k of ['weaponModelId', 'weaponFemaleModelId', 'manifestUrl', 'femaleManifestUrl', 'visualFormat', 'visualScale', 'visualOffsetX', 'visualOffsetY', 'femaleOffsetX', 'femaleOffsetY', 'groundOffsetY', 'dirOffsets']) {
            delete specialEffectJson[k];
          }
          specialEffectJson.weaponVisualCleared = true;
        } else {
          specialEffectJson = {};
        }
      }

      const payload = {
        code: code || undefined,
        namePtBr,
        descriptionPtBr,
        itemCategory,
        equipmentSlotCode,
        equipmentSetId,
        rarityTier,
        requiredLevel,
        priceGold: 0, // Não comercializado pelo jogo
        isActive,
        mcreworkIconKey,
        baseStatBonusesJson,
        combatStatBonusesJson,
        specialEffectJson,
      };

      try {
        if (editId) {
          await this.api(`/api/admin/equipments/${editId}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          });
        } else {
          await this.api('/api/admin/equipments', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
        }
        window.AdminEquipmentVisualPreview?.stop();
        document.getElementById('equipmentModal').style.display = 'none';
        await this.loadEquipmentTemplates();
      } catch (err) {
        alert(`Erro ao salvar Equipamento: ${err.message}`);
      }
    };

    app.deleteEquipmentTemplate = async function (id, name) {
      if (!confirm(`Deseja realmente excluir o equipamento "${name}" (#${id})?`)) return;
      try {
        await this.api(`/api/admin/equipments/${id}`, { method: 'DELETE' });
        await this.loadEquipmentTemplates();
      } catch (err) {
        alert(`Erro ao excluir Equipamento: ${err.message}`);
      }
    };
  }

  static injectTabAndModalDom() {
    // 1 e 2. Injeta Botão e Painel da Aba via AdminEquipmentTableView
    if (window.AdminEquipmentTableView && typeof window.AdminEquipmentTableView.injectTabDom === 'function') {
      window.AdminEquipmentTableView.injectTabDom();
    }

    // 3. Injeta Modal desacoplado
    if (window.AdminEquipmentModalDom && typeof window.AdminEquipmentModalDom.injectModalDom === 'function') {
      window.AdminEquipmentModalDom.injectModalDom();
    }
  }
}

window.AdminEquipmentsTab = AdminEquipmentsTab;
