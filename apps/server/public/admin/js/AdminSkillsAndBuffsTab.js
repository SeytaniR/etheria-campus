/**
 * @file apps/server/public/admin/js/AdminSkillsAndBuffsTab.js
 * @module @etheria/server
 * @description Submódulo No-Code Visual de Habilidades (`skill_templates`) da Rota `/admin`.
 *   - Permite criar e editar Habilidades Ativas e Passivas em Modo 100% Visual (Construtor de Blocos).
 *   - Inclui Palco Canvas 2.5D com reprodução ao vivo dos 128 Efeitos Especiais (VFX) do `mcrework`.
 *   - Fornece seletor de vínculo de habilidades para os modais de Personagens e Monstros.
 */

class AdminSkillsAndBuffsTab {
  static attach(app) {
    app.skillTemplates = [];
    app.mcreworkSkillIcons = [];
    app.mcreworkVfxList = [];

    app.editingSkillBlocks = [];
    app.selectedSkillIconKey = 'assets/skills/icons/100156.png';
    app.selectedSkillVfxKey = '10008';
    app.selectedSkillVfxColorHex = null;
    app.selectedSkillVfxColorIntensity = 100;
    app.skillAssetPickerMode = 'icon';

    app.vfxPreviewCache = new Map();
    app.vfxPreviewAnimFrame = null;

    if (window.AdminVfxColorPicker) {
      window.AdminVfxColorPicker.attach(app);
    }
    if (window.AdminStatusEffectsTab) {
      window.AdminStatusEffectsTab.attach(app);
    }
    if (window.AdminArenaPreview) {
      window.AdminArenaPreview.attach(app);
    }
    if (window.AdminSkillsAutoLink) {
      window.AdminSkillsAutoLink.attach(app);
    }

    if (window.AdminSkillsModalDom) {
      window.AdminSkillsModalDom.injectTabsAndModalsDom();
    }

    app.loadSkillsAndBuffsData = async function () {
      try {
        const [skills, statuses] = await Promise.all([
          this.api('/api/admin/skill-templates'),
          this.api('/api/admin/status-effects'),
        ]);
        this.skillTemplates = skills || [];
        this.statusEffectTemplates = statuses || [];
        this.renderSkillsCrudTable();
        if (typeof this.renderStatusEffectsCrudTable === 'function') {
          this.renderStatusEffectsCrudTable();
        }
      } catch (err) {
        console.error('Falha ao carregar Habilidades e Buffs/Debuffs:', err);
      }
    };

    app.ensureSkillAssetsLoaded = async function () {
      if (this.mcreworkSkillIcons.length > 0 && this.mcreworkVfxList.length > 0) return;
      try {
        const data = await this.api('/api/admin/mcrework/skill-assets');
        this.mcreworkSkillIcons = data.icons || [];
        this.mcreworkVfxList = data.vfxList || [];
      } catch (err) {
        console.error('Erro ao carregar catálogo de ícones/VFX do mcrework:', err);
      }
    };

    app.getOrLoadVfxAtlas = function (vfxKey) {
      if (!vfxKey) return null;
      const key = String(vfxKey).trim();
      if (this.vfxPreviewCache.has(key)) {
        return this.vfxPreviewCache.get(key);
      }
      const entry = { key, ready: false, atlasData: null, image: null };
      this.vfxPreviewCache.set(key, entry);

      const jsonUrl = `https://seytanir.github.io/mcrework/assets/effects/${key}/atlas.json`;
      const webpUrl = `https://seytanir.github.io/mcrework/assets/effects/${key}/atlas.webp`;

      fetch(jsonUrl)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((json) => {
          entry.atlasData = json;
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            entry.image = img;
            entry.ready = true;
          };
          img.src = webpUrl;
        })
        .catch(() => {});

      return entry;
    };

    app.drawVfxOnCanvas = function (ctx, vfxKey, centerX, centerY, elapsedMs, scale = 0.85, colorHex = null, intensityPct = 100) {
      const vfx = this.getOrLoadVfxAtlas(vfxKey);
      if (!vfx || !vfx.ready || !vfx.atlasData || !vfx.image) return;

      if (window.VfxColorProcessor) {
        window.VfxColorProcessor.drawVfxFrame(
          ctx,
          vfx.image,
          vfx.atlasData,
          elapsedMs,
          centerX,
          centerY,
          scale,
          colorHex,
          intensityPct
        );
        return;
      }

      const frames = vfx.atlasData.frames || {};
      const seq = vfx.atlasData.animations?.play || Object.keys(frames);
      if (!seq || seq.length === 0) return;

      const frameIdx = Math.floor((elapsedMs / 75) % seq.length);
      const fObj = frames[seq[frameIdx]];
      if (!fObj || !fObj.frame) return;

      const sx = fObj.frame.x;
      const sy = fObj.frame.y;
      const sw = fObj.frame.w;
      const sh = fObj.frame.h;
      const dw = Math.round(sw * scale);
      const dh = Math.round(sh * scale);

      ctx.save();
      ctx.drawImage(vfx.image, sx, sy, sw, sh, Math.round(centerX - dw / 2), Math.round(centerY - dh / 2), dw, dh);
      ctx.restore();
    };

    app.renderEntitySkillsChecklist = function (containerId, selectedIds = []) {
      const box = document.getElementById(containerId);
      if (!box) return;
      const selSet = new Set((selectedIds || []).map((n) => Number(n)));

      if (!this.skillTemplates || this.skillTemplates.length === 0) {
        box.innerHTML = `<div style="color:var(--text-muted); font-size:0.75rem; padding:8px;">Nenhuma habilidade cadastrada ainda. Crie habilidades na aba <strong>⚡ Habilidades</strong>.</div>`;
        return;
      }

      box.innerHTML = this.skillTemplates
        .map((sk) => {
          const isChecked = selSet.has(Number(sk.id));
          const elem = typeof this.getSkillDetectedElement === 'function' ? this.getSkillDetectedElement(sk) : 'NEUTRAL';
          const elemBadge = typeof this.getElementBadge === 'function' ? this.getElementBadge(elem) : { label: 'Neutro', icon: '⚪', bg: 'rgba(148,163,184,0.2)', text: '#cbd5e1', border: '#64748b' };
          const scopeLabel = typeof this.getScopeLabel === 'function' ? this.getScopeLabel(sk.targetScope) : (sk.targetScope || '🎯 Melee');
          const isPassive = sk.skillType === 'PASSIVE';
          const blocksSummary = this.formatSkillBlocksSummary(sk.effectBlocksJson);
          const desc = sk.descriptionPtBr ? `📜 ${sk.descriptionPtBr}` : (blocksSummary || 'Sem descrição cadastrada.');
          const searchStr = `${sk.id} ${sk.code} ${sk.namePtBr} ${elemBadge.label} ${sk.targetScope} ${sk.descriptionPtBr || ''}`.toLowerCase().replace(/"/g, '&quot;');

          return `
          <label class="entity-skill-card" data-skill-search="${searchStr}" data-skill-element="${elem}" style="display:flex; flex-direction:column; gap:6px; padding:8px 10px; background:${isChecked ? 'rgba(56,189,248,0.16)' : 'rgba(15,23,42,0.85)'}; border:${isChecked ? '1.5px solid #38bdf8' : '1px solid var(--border)'}; border-radius:8px; cursor:pointer; transition:all 0.15s ease; box-sizing:border-box;">
            <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:8px;">
              <div style="display:flex; align-items:flex-start; gap:8px; min-width:0; flex:1;">
                <input type="checkbox" class="entity-skill-checkbox" data-container="${containerId}" value="${sk.id}" ${isChecked ? 'checked' : ''} onchange="AdminApp.onEntitySkillToggle('${containerId}')" style="width:18px; height:18px; cursor:pointer; flex-shrink:0; margin-top:2px;" />
                <img src="${sk.iconUrl}" alt="${sk.namePtBr}" style="width:36px; height:36px; border-radius:6px; border:1px solid ${isChecked ? '#38bdf8' : '#475569'}; object-fit:contain; background:#020617; flex-shrink:0;" />
                <div style="min-width:0; flex:1;">
                  <div class="skill-card-title" style="font-weight:700; color:${isChecked ? '#38bdf8' : '#f8fafc'}; font-size:0.80rem; word-break:break-word; line-height:1.25;">#${sk.id} ${sk.namePtBr}</div>
                  <div style="display:flex; align-items:center; gap:4px; flex-wrap:wrap; margin-top:3px;">
                    <span style="font-size:0.65rem; padding:1px 5px; border-radius:4px; background:${elemBadge.bg}; color:${elemBadge.text}; border:1px solid ${elemBadge.border}; font-weight:700;">${elemBadge.icon} ${elemBadge.label}</span>
                    <span style="font-size:0.65rem; padding:1px 5px; border-radius:4px; background:rgba(15,23,42,0.9); color:#94a3b8; border:1px solid #334155;">${scopeLabel}</span>
                    ${isPassive ? '<span style="font-size:0.65rem; color:#d8b4fe; font-weight:700;">♾️ Passiva</span>' : `<span style="font-size:0.65rem; color:#38bdf8; font-weight:700;">💧 ${sk.mpCost || 0} MP</span>`}
                    ${(sk.cooldownSeconds ?? sk.cooldownTurns ?? 0) > 0 ? `<span style="font-size:0.65rem; color:#fde047;">⏳ CD: ${sk.cooldownSeconds ?? sk.cooldownTurns}s</span>` : ''}
                  </div>
                </div>
              </div>
            </div>
            <div style="font-size:0.70rem; color:#cbd5e1; line-height:1.25; background:rgba(2,6,23,0.6); padding:4px 6px; border-radius:4px; border:1px solid rgba(255,255,255,0.06); word-break:break-word;">
              ${desc}
            </div>
          </label>`;
        })
        .join('');

      if (typeof this.onEntitySkillToggle === 'function') {
        this.onEntitySkillToggle(containerId);
      }
    };

    app.getSelectedEntitySkillIds = function (containerId) {
      const box = document.getElementById(containerId);
      if (!box) return [];
      return Array.from(box.querySelectorAll('input.entity-skill-checkbox:checked')).map((c) => Number(c.value));
    };

    app.formatSkillBlocksSummary = function (blocks) {
      if (!Array.isArray(blocks) || blocks.length === 0) return '<em>Sem blocos</em>';
      return blocks
        .map((b) => {
          if (b.blockType === 'DAMAGE') {
            return `💥 Dano (${b.damageType || 'PHYSICAL'}): ${b.scalePct || 100}% ${b.scaleStat || 'ATK'} + ${b.flatAmount || 0}`;
          }
          if (b.blockType === 'HEAL') {
            return `💚 Cura: ${b.scalePct || 20}% ${b.scaleStat || 'MAX_HP'} + ${b.flatAmount || 0}`;
          }
          if (b.blockType === 'STATUS') {
            const st = (this.statusEffectTemplates || []).find((s) => s.id === Number(b.statusEffectId));
            const dur = b.durationSeconds ?? b.durationTurns ?? (st?.durationSeconds ?? st?.defaultDurationTurns ?? 5);
            return `🧪 Aplica [${st ? st.namePtBr : `Status #${b.statusEffectId}`}] (${b.applyChancePct ?? 100}%, ${dur}s)`;
          }
          if (b.blockType === 'SHIELD') {
            const dur = b.durationSeconds ?? b.durationTurns ?? 5;
            return `🛡️ Escudo: ${b.scalePct || 15}% ${b.scaleStat || 'MAX_HP'} (${dur}s)`;
          }
          if (b.blockType === 'CLEANSE_DISPEL' || b.blockType === 'CLEANSE') {
            const qtyTxt = Number(b.maxDebuffs) > 0 ? `até ${b.maxDebuffs}` : 'Todos';
            const healTxt = Number(b.healPerDebuffPct) > 0 ? `, +${b.healPerDebuffPct}% HP/debuff` : '';
            return `✨ Limpar Debuffs (${qtyTxt}, ${b.cleanseChancePct ?? 100}%${healTxt})`;
          }
          return b.blockType;
        })
        .join('<br/>');
    };

    app.renderSkillsCrudTable = function () {
      const tbody = document.getElementById('skillsTableBody');
      if (!tbody) return;

      if (!this.skillTemplates || this.skillTemplates.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="color:var(--text-muted); padding:16px; text-align:center;">Nenhuma Habilidade cadastrada. Clique em <strong>"➕ Nova Habilidade Visual"</strong> acima!</td></tr>`;
        return;
      }

      tbody.innerHTML = this.skillTemplates
        .map((sk) => {
          const isPassive = sk.skillType === 'PASSIVE';
          return `
          <tr>
            <td>
              <strong>#${sk.id}</strong> &bull; <span style="color:#38bdf8; font-weight:700;">${sk.code}</span>
            </td>
            <td>
              <div style="display:flex; align-items:center; gap:8px;">
                <img src="${sk.iconUrl}" alt="Skill Icon" style="width:42px; height:42px; border-radius:6px; border:1.5px solid #38bdf8; background:#020617; object-fit:contain;" />
                ${
                  sk.vfxThumbUrl
                    ? `<div style="display:flex; flex-direction:column; align-items:center; gap:2px;"><canvas class="vfx-color-thumb" data-vfx-thumb="${sk.vfxThumbUrl}" data-vfx-color="${sk.vfxColorHex || ''}" data-vfx-intensity="${sk.vfxColorIntensity ?? 100}" width="42" height="42" title="VFX #${sk.mcreworkVfxKey}${sk.vfxColorHex ? ' • ' + sk.vfxColorHex : ''}" style="width:42px; height:42px; border-radius:6px; border:1.5px solid ${sk.vfxColorHex || '#f43f5e'}; background:#020617;"></canvas>${sk.vfxColorHex ? `<span style="font-size:0.62rem; font-family:monospace; color:#f8fafc; background:${sk.vfxColorHex}33; border:1px solid ${sk.vfxColorHex}; padding:0 4px; border-radius:4px;">${sk.vfxColorHex}</span>` : ''}</div>`
                    : ''
                }
              </div>
            </td>
            <td>
              <strong>${sk.namePtBr}</strong>
              <div style="font-size:0.72rem; color:var(--text-muted); max-width:250px; white-space:normal;">📜 ${sk.descriptionPtBr || ''}</div>
            </td>
            <td>
              <span style="padding:3px 9px; border-radius:99px; background:${isPassive ? 'rgba(192,132,252,0.18)' : 'rgba(56,189,248,0.18)'}; color:${isPassive ? '#d8b4fe' : '#7dd3fc'}; font-size:0.74rem; font-weight:800;">
                ${isPassive ? '♾️ PASSIVA' : '⚡ ATIVA'}
              </span>
              <div style="font-size:0.7rem; color:#fde047; margin-top:3px;">Gatilho: ${typeof this.getSkillTriggerLabel === 'function' ? this.getSkillTriggerLabel(sk.triggerType) : sk.triggerType}</div>
            </td>
            <td>
              <div style="font-size:0.74rem; font-weight:600;">🎯 ${sk.targetScope} (${sk.hitCount || 1} hit)</div>
              <div style="font-size:0.7rem; color:#7dd3fc;">💧 ${sk.mpCost || 0} MP &bull; ⏳ CD: ${sk.cooldownSeconds ?? sk.cooldownTurns ?? 0}s &bull; 📏 ${sk.castRange ?? 160}px</div>
            </td>
            <td>
              <div style="font-size:0.73rem; line-height:1.35;">${this.formatSkillBlocksSummary(sk.effectBlocksJson)}</div>
            </td>
            <td>
              <div style="display:flex; flex-direction:column; gap:4px;">
                <button class="btn-primary" onclick="AdminApp.openSkillTemplateModal(${sk.id})" style="padding:3px 8px; font-size:0.72rem;">✏️ Editar</button>
                <button type="button" class="btn-primary" onclick="AdminApp.openAutoLinkModal(${sk.id})" style="padding:3px 8px; font-size:0.71rem; background:#0284c7; border-color:#38bdf8;" title="Auto-vincular a todos os monstros de um elemento">🔗 Auto-Vincular</button>
                <button class="btn-danger" onclick="AdminApp.deleteSkillTemplate(${sk.id})" style="padding:3px 8px; font-size:0.72rem;">🗑️ Excluir</button>
              </div>
            </td>
          </tr>`;
        })
        .join('');
      if (window.VfxColorProcessor) {
        window.VfxColorProcessor.hydrateAllThumbCanvases(tbody);
      }
    };

    app.openSkillTemplateModal = async function (editId = null) {
      document.getElementById('skillTemplateModal').style.display = 'flex';
      await this.ensureSkillAssetsLoaded();

      const existing = editId ? this.skillTemplates.find((s) => s.id === Number(editId)) : null;

      if (existing) {
        document.getElementById('skillModalTitle').textContent = `⚡ Editar Habilidade #${existing.id} (${existing.code})`;
        document.getElementById('skillEditIdInput').value = String(existing.id);
        document.getElementById('skillCodeInput').value = `#${existing.id} • ${existing.code}`;
        document.getElementById('skillNameInput').value = existing.namePtBr || '';
        document.getElementById('skillDescInput').value = existing.descriptionPtBr || '';
        document.getElementById('skillTypeSelect').value = existing.skillType || 'ACTIVE';
        document.getElementById('skillTriggerSelect').value = existing.triggerType || 'ACTIVE';
        document.getElementById('skillTargetScopeSelect').value = existing.targetScope || 'MELEE_FRONTLINE';
        document.getElementById('skillHitCountInput').value = String(existing.hitCount || 1);
        document.getElementById('skillMpCostInput').value = String(existing.mpCost ?? 10);
        document.getElementById('skillCooldownInput').value = String(existing.cooldownSeconds ?? existing.cooldownTurns ?? 0);
        if (document.getElementById('skillCastRangeInput')) {
          document.getElementById('skillCastRangeInput').value = String(existing.castRange ?? 160);
        }
        if (document.getElementById('skillAoeRadiusInput')) {
          document.getElementById('skillAoeRadiusInput').value = String(existing.aoeRadius ?? 0);
        }
        document.getElementById('skillCastMovementSelect').value = existing.castMovement || 'MELEE_ADVANCE';
        document.getElementById('skillCastActionSelect').value = String(existing.castActionId || 3);

        const autoCheck = document.getElementById('skillAutoLinkOnSaveCheck');
        if (autoCheck) autoCheck.checked = false;
        const autoElemSel = document.getElementById('skillAutoLinkOnSaveElementSelect');
        if (autoElemSel && typeof this.getSkillDetectedElement === 'function') {
          autoElemSel.value = this.getSkillDetectedElement(existing);
        }

        this.selectedSkillIconKey = existing.mcreworkIconKey || 'assets/skills/icons/100156.png';
        this.selectedSkillVfxKey = existing.mcreworkVfxKey || '10008';
        this.selectedSkillVfxColorHex = existing.vfxColorHex || null;
        this.selectedSkillVfxColorIntensity = existing.vfxColorIntensity ?? 100;
        this.editingSkillBlocks = Array.isArray(existing.effectBlocksJson)
          ? JSON.parse(JSON.stringify(existing.effectBlocksJson))
          : [];
      } else {
        const maxId = this.skillTemplates.reduce((acc, s) => Math.max(acc, Number(s.id) || 0), 0);
        const nextId = maxId + 1;
        document.getElementById('skillModalTitle').textContent = `⚡ Nova Habilidade #${nextId} (skill_${nextId})`;
        document.getElementById('skillEditIdInput').value = '';
        document.getElementById('skillCodeInput').value = `#${nextId} • skill_${nextId} (Automático)`;
        document.getElementById('skillNameInput').value = '';
        document.getElementById('skillDescInput').value = '';
        document.getElementById('skillTypeSelect').value = 'ACTIVE';
        document.getElementById('skillTriggerSelect').value = 'ACTIVE';
        document.getElementById('skillTargetScopeSelect').value = 'MELEE_FRONTLINE';
        document.getElementById('skillHitCountInput').value = '1';
        document.getElementById('skillMpCostInput').value = '12';
        document.getElementById('skillCooldownInput').value = '3.0';
        if (document.getElementById('skillCastRangeInput')) document.getElementById('skillCastRangeInput').value = '160';
        if (document.getElementById('skillAoeRadiusInput')) document.getElementById('skillAoeRadiusInput').value = '0';
        document.getElementById('skillCastMovementSelect').value = 'MELEE_ADVANCE';
        document.getElementById('skillCastActionSelect').value = '3';

        const autoCheck = document.getElementById('skillAutoLinkOnSaveCheck');
        if (autoCheck) autoCheck.checked = false;

        this.selectedSkillIconKey = 'assets/skills/icons/100156.png';
        this.selectedSkillVfxKey = '10008';
        this.selectedSkillVfxColorHex = null;
        this.selectedSkillVfxColorIntensity = 100;
        this.editingSkillBlocks = [
          {
            blockType: 'DAMAGE',
            damageType: 'PHYSICAL',
            elementCode: 'INHERIT',
            scaleStat: 'ATK',
            scalePct: 150,
            flatAmount: 15,
            critBonusPct: 10,
            lifestealPct: 0,
          },
        ];
      }

      this.renderVisualSkillBlocks();
      if (typeof this.syncVfxColorControls === 'function') {
        this.syncVfxColorControls('skill', this.selectedSkillVfxColorHex, this.selectedSkillVfxColorIntensity);
      }
      this.renderSkillAssetGallery();
      this.startVfxPreviewCanvasLoop(
        'skillVfxPreviewCanvas',
        () => this.selectedSkillVfxKey,
        () => `https://seytanir.github.io/mcrework/${this.selectedSkillIconKey.replace(/^\/+/, '')}`,
        () => ({ colorHex: this.selectedSkillVfxColorHex, intensity: this.selectedSkillVfxColorIntensity })
      );
    };

    app.addVisualSkillBlock = function (blockType) {
      if (blockType === 'DAMAGE') {
        this.editingSkillBlocks.push({
          blockType: 'DAMAGE',
          damageType: 'PHYSICAL',
          elementCode: 'INHERIT',
          scaleStat: 'ATK',
          scalePct: 140,
          flatAmount: 15,
          critBonusPct: 10,
          lifestealPct: 0,
        });
      } else if (blockType === 'HEAL') {
        this.editingSkillBlocks.push({
          blockType: 'HEAL',
          scaleStat: 'MAX_HP',
          scalePct: 20,
          flatAmount: 25,
          targetSelf: false,
        });
      } else if (blockType === 'STATUS') {
        const firstStatusId = this.statusEffectTemplates?.[0]?.id || 1;
        this.editingSkillBlocks.push({
          blockType: 'STATUS',
          statusEffectId: firstStatusId,
          applyChancePct: 100,
          durationSeconds: 5.0,
          durationTurns: 5,
          targetSelf: false,
        });
      } else if (blockType === 'SHIELD') {
        this.editingSkillBlocks.push({
          blockType: 'SHIELD',
          scaleStat: 'MAX_HP',
          scalePct: 20,
          flatAmount: 30,
          durationSeconds: 5.0,
          durationTurns: 5,
        });
      } else if (blockType === 'CLEANSE_DISPEL') {
        this.editingSkillBlocks.push({
          blockType: 'CLEANSE_DISPEL',
          cleanseTarget: 'SELF',
          targetSelf: true,
          maxDebuffs: 0,
          cleanseChancePct: 100,
          healPerDebuffPct: 0,
        });
      }
      this.renderVisualSkillBlocks();
    };

    app.removeVisualSkillBlock = function (idx) {
      this.editingSkillBlocks.splice(idx, 1);
      this.renderVisualSkillBlocks();
    };

    app.updateVisualSkillBlockField = function (idx, field, rawValue, isNumeric = false, isBool = false) {
      const blk = this.editingSkillBlocks[idx];
      if (!blk) return;
      if (isBool) {
        blk[field] = rawValue === 'true' || rawValue === true;
      } else if (isNumeric) {
        blk[field] = Number(rawValue) || 0;
      } else {
        blk[field] = rawValue;
      }
      this.renderVisualSkillBlocks();
    };

    app.renderVisualSkillBlocks = function () {
      const container = document.getElementById('skillVisualBlocksContainer');
      if (!container) return;

      if (this.editingSkillBlocks.length === 0) {
        container.innerHTML = `<div style="color:var(--text-muted); padding:12px; text-align:center; border:1px dashed var(--border); border-radius:8px;">Nenhum bloco adicionado. Use os botões acima para adicionar Dano, Cura, Buff/Debuff ou Escudo!</div>`;
        return;
      }

      const statusOptionsHtml = (this.statusEffectTemplates || [])
        .map(
          (st) =>
            `<option value="${st.id}">#${st.id} ${st.isBuff ? '🟢 [BUFF]' : '🔴 [DEBUFF]'} ${st.namePtBr}</option>`
        )
        .join('');

      container.innerHTML = this.editingSkillBlocks
        .map((blk, i) => {
          if (blk.blockType === 'DAMAGE') {
            return `
            <div style="background:#020617; border:1px solid #f43f5e; border-radius:8px; padding:10px; display:flex; flex-direction:column; gap:8px;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong style="color:#fb7185; font-size:0.82rem;">💥 Bloco #${i + 1}: Causar Dano (Modo Visual)</strong>
                <button type="button" class="btn-danger" onclick="AdminApp.removeVisualSkillBlock(${i})" style="padding:2px 8px; font-size:0.72rem;">🗑️ Remover</button>
              </div>
              <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(135px, 1fr)); gap:8px;">
                <div>
                  <label style="font-size:0.7rem;">Natureza do Dano</label>
                  <select onchange="AdminApp.updateVisualSkillBlockField(${i}, 'damageType', this.value)">
                    <option value="PHYSICAL" ${blk.damageType === 'PHYSICAL' ? 'selected' : ''}>🗡️ Físico</option>
                    <option value="MAGICAL" ${blk.damageType === 'MAGICAL' ? 'selected' : ''}>🔮 Mágico</option>
                    <option value="TRUE" ${blk.damageType === 'TRUE' ? 'selected' : ''}>⚡ Verdadeiro (Ignora Def)</option>
                  </select>
                </div>
                <div>
                  <label style="font-size:0.7rem;">Elemento</label>
                  <select onchange="AdminApp.updateVisualSkillBlockField(${i}, 'elementCode', this.value)">
                    <option value="INHERIT" ${blk.elementCode === 'INHERIT' ? 'selected' : ''}>🔄 Herdar do Conjurador</option>
                    <option value="FIRE" ${blk.elementCode === 'FIRE' ? 'selected' : ''}>🔥 Fogo</option>
                    <option value="WATER" ${blk.elementCode === 'WATER' ? 'selected' : ''}>💧 Água</option>
                    <option value="EARTH" ${blk.elementCode === 'EARTH' ? 'selected' : ''}>🪨 Terra</option>
                    <option value="AIR" ${blk.elementCode === 'AIR' ? 'selected' : ''}>🌪️ Ar</option>
                    <option value="NEUTRAL" ${blk.elementCode === 'NEUTRAL' ? 'selected' : ''}>⚪ Neutro</option>
                  </select>
                </div>
                <div>
                  <label style="font-size:0.7rem;">Atributo Escalador</label>
                  <select onchange="AdminApp.updateVisualSkillBlockField(${i}, 'scaleStat', this.value)">
                    <option value="ATK" ${blk.scaleStat === 'ATK' ? 'selected' : ''}>🗡️ Ataque Total (ATK)</option>
                    <option value="MAX_HP" ${blk.scaleStat === 'MAX_HP' ? 'selected' : ''}>❤️ Vida Máxima (MAX_HP)</option>
                    <option value="DEF" ${blk.scaleStat === 'DEF' ? 'selected' : ''}>🛡️ Defesa (DEF)</option>
                    <option value="SPEED" ${blk.scaleStat === 'SPEED' ? 'selected' : ''}>⚡ Velocidade (SPEED)</option>
                  </select>
                </div>
                <div>
                  <label style="font-size:0.7rem;">Multiplicador (%)</label>
                  <input type="number" value="${blk.scalePct ?? 150}" onchange="AdminApp.updateVisualSkillBlockField(${i}, 'scalePct', this.value, true)" />
                </div>
                <div>
                  <label style="font-size:0.7rem;">+ Dano Fixo Base</label>
                  <input type="number" value="${blk.flatAmount ?? 15}" onchange="AdminApp.updateVisualSkillBlockField(${i}, 'flatAmount', this.value, true)" />
                </div>
                <div>
                  <label style="font-size:0.7rem;">Bônus Crítico (%)</label>
                  <input type="number" value="${blk.critBonusPct ?? 10}" onchange="AdminApp.updateVisualSkillBlockField(${i}, 'critBonusPct', this.value, true)" />
                </div>
              </div>
              <div style="font-size:0.74rem; color:#fde047; background:rgba(253,224,71,0.08); padding:4px 8px; border-radius:4px;">
                📐 <strong>Resumo Visual:</strong> Causa <strong>${blk.scalePct ?? 150}% de ${blk.scaleStat || 'ATK'} + ${blk.flatAmount ?? 0}</strong> de dano ${blk.damageType || 'PHYSICAL'} (${blk.elementCode || 'INHERIT'})
              </div>
            </div>`;
          }

          if (blk.blockType === 'HEAL') {
            return `
            <div style="background:#020617; border:1px solid #22c55e; border-radius:8px; padding:10px; display:flex; flex-direction:column; gap:8px;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong style="color:#86efac; font-size:0.82rem;">💚 Bloco #${i + 1}: Restaurar Vida (Cura Visual)</strong>
                <button type="button" class="btn-danger" onclick="AdminApp.removeVisualSkillBlock(${i})" style="padding:2px 8px; font-size:0.72rem;">🗑️ Remover</button>
              </div>
              <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:8px;">
                <div>
                  <label style="font-size:0.7rem;">Quem Recebe a Cura?</label>
                  <select onchange="AdminApp.updateVisualSkillBlockField(${i}, 'targetSelf', this.value, false, true)">
                    <option value="false" ${!blk.targetSelf ? 'selected' : ''}>🎯 Alvo da Habilidade</option>
                    <option value="true" ${blk.targetSelf ? 'selected' : ''}>🙋 Próprio Conjurador</option>
                  </select>
                </div>
                <div>
                  <label style="font-size:0.7rem;">Atributo Escalador</label>
                  <select onchange="AdminApp.updateVisualSkillBlockField(${i}, 'scaleStat', this.value)">
                    <option value="MAX_HP" ${blk.scaleStat === 'MAX_HP' ? 'selected' : ''}>❤️ HP Máximo</option>
                    <option value="ATK" ${blk.scaleStat === 'ATK' ? 'selected' : ''}>✨ Poder / Ataque</option>
                  </select>
                </div>
                <div>
                  <label style="font-size:0.7rem;">Multiplicador (%)</label>
                  <input type="number" value="${blk.scalePct ?? 20}" onchange="AdminApp.updateVisualSkillBlockField(${i}, 'scalePct', this.value, true)" />
                </div>
                <div>
                  <label style="font-size:0.7rem;">+ Cura Fixa Base</label>
                  <input type="number" value="${blk.flatAmount ?? 25}" onchange="AdminApp.updateVisualSkillBlockField(${i}, 'flatAmount', this.value, true)" />
                </div>
              </div>
            </div>`;
          }

          if (blk.blockType === 'STATUS') {
            return `
            <div style="background:#020617; border:1px solid #c084fc; border-radius:8px; padding:10px; display:flex; flex-direction:column; gap:8px;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong style="color:#d8b4fe; font-size:0.82rem;">🧪 Bloco #${i + 1}: Aplicar Buff ou Debuff da Tabela</strong>
                <button type="button" class="btn-danger" onclick="AdminApp.removeVisualSkillBlock(${i})" style="padding:2px 8px; font-size:0.72rem;">🗑️ Remover</button>
              </div>
              <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:8px;">
                <div>
                  <label style="font-size:0.7rem;">Buff / Debuff a Aplicar</label>
                  <select onchange="AdminApp.updateVisualSkillBlockField(${i}, 'statusEffectId', this.value, true)">
                    ${statusOptionsHtml}
                  </select>
                </div>
                <div>
                  <label style="font-size:0.7rem;">Aplicar em Quem?</label>
                  <select onchange="AdminApp.updateVisualSkillBlockField(${i}, 'targetSelf', this.value, false, true)">
                    <option value="false" ${!blk.targetSelf ? 'selected' : ''}>🎯 No Alvo da Skill</option>
                    <option value="true" ${blk.targetSelf ? 'selected' : ''}>🙋 No Próprio Conjurador</option>
                  </select>
                </div>
                <div>
                  <label style="font-size:0.7rem;">Chance de Aplicar (%)</label>
                  <input type="number" min="1" max="100" value="${blk.applyChancePct ?? 100}" onchange="AdminApp.updateVisualSkillBlockField(${i}, 'applyChancePct', this.value, true)" />
                </div>
                <div>
                  <label style="font-size:0.7rem;">Duração (Segundos)</label>
                  <input type="number" min="0.5" max="60" step="0.5" value="${blk.durationSeconds ?? blk.durationTurns ?? 5}" onchange="AdminApp.updateVisualSkillBlockField(${i}, 'durationSeconds', this.value, true); AdminApp.updateVisualSkillBlockField(${i}, 'durationTurns', Math.round(Number(this.value)), true);" />
                </div>
              </div>
            </div>`;
          }

          if (blk.blockType === 'CLEANSE_DISPEL' || blk.blockType === 'CLEANSE') {
            return typeof this.renderCleanseSkillBlockCard === 'function'
              ? this.renderCleanseSkillBlockCard(blk, i)
              : '';
          }

          return `
          <div style="background:#020617; border:1px solid #38bdf8; border-radius:8px; padding:10px; display:flex; justify-content:space-between; align-items:center;">
            <strong style="color:#7dd3fc; font-size:0.82rem;">🛡️ Bloco #${i + 1}: Escudo Protetor (${blk.scalePct || 20}% MAX_HP + ${blk.flatAmount || 25})</strong>
            <button type="button" class="btn-danger" onclick="AdminApp.removeVisualSkillBlock(${i})" style="padding:2px 8px; font-size:0.72rem;">🗑️ Remover</button>
          </div>`;
        })
        .join('');

      this.editingSkillBlocks.forEach((blk, i) => {
        if (blk.blockType === 'STATUS') {
          const selects = container.querySelectorAll('select');
          selects.forEach((s) => {
            if (s.getAttribute('onchange')?.includes(`(${i}, 'statusEffectId'`)) {
              s.value = String(blk.statusEffectId || 1);
            }
          });
        }
      });
    };

    app.switchSkillAssetPicker = function (mode) {
      this.skillAssetPickerMode = mode;
      document.getElementById('btnSkillPickIcon').className = mode === 'icon' ? 'btn-primary' : '';
      document.getElementById('btnSkillPickVfx').className = mode === 'vfx' ? 'btn-primary' : '';
      this.renderSkillAssetGallery();
    };

    app.renderSkillAssetGallery = function () {
      const grid = document.getElementById('skillAssetsGalleryGrid');
      if (!grid) return;
      const q = (document.getElementById('skillAssetSearchInput')?.value || '').toLowerCase().trim();

      const iconImg = document.getElementById('skillSelectedIconImg');
      if (iconImg) {
        iconImg.src = `https://seytanir.github.io/mcrework/${this.selectedSkillIconKey.replace(/^\/+/, '')}`;
      }
      const vfxLabel = document.getElementById('skillSelectedVfxLabel');
      if (vfxLabel) {
        vfxLabel.textContent = this.selectedSkillVfxKey ? `VFX #${this.selectedSkillVfxKey}` : 'Nenhum VFX';
      }
      if (typeof this.refreshSelectedVfxThumb === 'function') {
        this.refreshSelectedVfxThumb('skill');
      }

      if (this.skillAssetPickerMode === 'icon') {
        const filtered = this.mcreworkSkillIcons
          .filter((ic) => !q || `${ic.iconKey} ${ic.suggestedName}`.toLowerCase().includes(q))
          .slice(0, 120);
        grid.innerHTML = filtered
          .map((ic) => {
            const isSel = ic.iconKey === this.selectedSkillIconKey;
            return `
            <div class="gallery-card ${isSel ? 'selected' : ''}" onclick="AdminApp.pickSkillIcon('${ic.iconKey}', '${ic.defaultVfxKey || ''}')" style="padding:6px;">
              <img src="${ic.iconUrl}" alt="${ic.iconNum}" loading="lazy" style="width:42px; height:42px; object-fit:contain; margin:0 auto;" />
              <span style="font-size:0.68rem; color:var(--text-muted); text-align:center;">#${ic.iconNum}</span>
            </div>`;
          })
          .join('');
      } else {
        const filtered = this.mcreworkVfxList.filter((v) => !q || `${v.vfxKey} ${v.name}`.toLowerCase().includes(q));
        grid.innerHTML = filtered
          .map((v) => {
            const isSel = v.vfxKey === this.selectedSkillVfxKey;
            return `
            <div class="gallery-card ${isSel ? 'selected' : ''}" onclick="AdminApp.pickSkillVfx('${v.vfxKey}')" style="padding:6px;">
              <img src="${v.thumbUrl}" alt="${v.vfxKey}" crossorigin="anonymous" loading="lazy" style="width:48px; height:48px; object-fit:contain; margin:0 auto;" />
              <strong style="font-size:0.7rem; text-align:center;">VFX #${v.vfxKey}</strong>
              <span style="font-size:0.64rem; color:var(--text-muted); text-align:center;">${v.frames} frames</span>
            </div>`;
          })
          .join('');
      }
    };

    app.pickSkillIcon = function (iconKey, defaultVfxKey) {
      this.selectedSkillIconKey = iconKey;
      if (defaultVfxKey) {
        this.selectedSkillVfxKey = defaultVfxKey;
        this.getOrLoadVfxAtlas(defaultVfxKey);
      }
      this.renderSkillAssetGallery();
    };

    app.pickSkillVfx = function (vfxKey) {
      this.selectedSkillVfxKey = vfxKey;
      this.getOrLoadVfxAtlas(vfxKey);
      this.renderSkillAssetGallery();
    };

    app.saveSkillTemplate = async function () {
      try {
        const editId = document.getElementById('skillEditIdInput').value.trim();
        const namePtBr = document.getElementById('skillNameInput').value.trim();
        const descriptionPtBr = document.getElementById('skillDescInput').value.trim();
        const skillType = document.getElementById('skillTypeSelect').value || 'ACTIVE';
        const triggerType = document.getElementById('skillTriggerSelect').value || 'ACTIVE';
        const targetScope = document.getElementById('skillTargetScopeSelect').value || 'MELEE_FRONTLINE';
        const hitCount = Number(document.getElementById('skillHitCountInput').value) || 1;
        const mpCost = Number(document.getElementById('skillMpCostInput').value) || 0;
        const cooldownVal = Number(document.getElementById('skillCooldownInput').value) || 0;
        const castRange = Number(document.getElementById('skillCastRangeInput')?.value) || 160;
        const aoeRadius = Number(document.getElementById('skillAoeRadiusInput')?.value) || 0;
        const castMovement = document.getElementById('skillCastMovementSelect').value || 'MELEE_ADVANCE';
        const castActionId = Number(document.getElementById('skillCastActionSelect').value) || 3;

        if (!namePtBr) {
          alert('Informe um nome em português para a Habilidade.');
          return;
        }

        const dto = {
          namePtBr,
          descriptionPtBr,
          mcreworkIconKey: this.selectedSkillIconKey,
          mcreworkVfxKey: this.selectedSkillVfxKey,
          vfxColorHex: this.selectedSkillVfxColorHex || null,
          vfxColorIntensity: this.selectedSkillVfxColorIntensity ?? 100,
          castMovement,
          castActionId,
          skillType,
          triggerType,
          targetScope,
          hitCount,
          mpCost,
          apCost: 0,
          cooldownSeconds: cooldownVal,
          cooldownTurns: Math.round(cooldownVal),
          castRange,
          aoeRadius,
          effectBlocksJson: this.editingSkillBlocks,
        };

        const path = editId ? `/api/admin/skill-templates/${editId}` : '/api/admin/skill-templates';
        const method = editId ? 'PUT' : 'POST';
        const res = await this.api(path, { method, body: JSON.stringify(dto) });

        const savedId = editId ? Number(editId) : res?.id;
        const autoCheck = document.getElementById('skillAutoLinkOnSaveCheck');
        if (autoCheck && autoCheck.checked && savedId) {
          const autoElem = document.getElementById('skillAutoLinkOnSaveElementSelect')?.value || 'ALL';
          try {
            await this.api(`/api/admin/skill-templates/${savedId}/auto-link-monsters`, {
              method: 'POST',
              body: JSON.stringify({ elementCode: autoElem }),
            });
            if (typeof this.loadMonstersData === 'function') {
              await this.loadMonstersData();
            }
          } catch (autoErr) {
            console.warn('Aviso no auto-vínculo ao salvar:', autoErr);
          }
        }

        this.closeModal('skillTemplateModal');
        await this.loadSkillsAndBuffsData();
      } catch (err) {
        alert(`Erro ao salvar Habilidade: ${err.message}`);
      }
    };

    app.deleteSkillTemplate = async function (id) {
      if (!confirm('Deseja realmente excluir esta Habilidade da tabela?')) return;
      try {
        await this.api(`/api/admin/skill-templates/${id}`, { method: 'DELETE' });
        await this.loadSkillsAndBuffsData();
      } catch (err) {
        alert(`Erro ao excluir Habilidade: ${err.message}`);
      }
    };
  }

}

window.AdminSkillsAndBuffsTab = AdminSkillsAndBuffsTab;
