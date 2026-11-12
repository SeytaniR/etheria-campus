/**
 * @file apps/server/public/admin/js/AdminStatusEffectsTab.js
 * @module @etheria/server
 * @description Submódulo da Aba Buffs & Debuffs (`status_effect_templates`) da Rota `/admin`.
 *   Buffs e Debuffs possuem Ícone próprio (exibido acima da cabeça do alvo em batalha),
 *   Efeito Especial (VFX 2.5D do `mcrework`) acionado quando seu gatilho dispara,
 *   e Construtor Visual de modificadores de atributos, DoT/HoT e Controles de Grupo.
 */

class AdminStatusEffectsTab {
  static attach(app) {
    app.statusEffectTemplates = [];
    app.selectedStatusIconKey = 'assets/skills/icons/100156.png';
    app.selectedStatusVfxKey = '10002';
    app.selectedStatusVfxColorHex = null;
    app.selectedStatusVfxColorIntensity = 100;
    app.statusAssetPickerMode = 'icon';
    app.editingStatusModifiers = [];

    app.STATUS_MODIFIER_OPTIONS = [
      { code: 'PHYS_ATK_PCT', label: '🗡️ Ataque Físico (PHYS_ATK %)' },
      { code: 'MAG_ATK_PCT', label: '🔮 Ataque Mágico (MAG_ATK %)' },
      { code: 'HEAL_POWER_PCT', label: '💚 Poder de Cura (HEAL_POWER %)' },
      { code: 'PHYS_DEF_PCT', label: '🛡️ Defesa Física (PHYS_DEF %)' },
      { code: 'MAG_DEF_PCT', label: '✨ Defesa Mágica (MAG_DEF %)' },
      { code: 'ATTACK_SPEED_PCT', label: '⚡ Vel. de Ataque (ATTACK_SPEED %)' },
      { code: 'BATTLE_MOVE_SPEED_PCT', label: '🏃 Vel. de Movimento (BATTLE_MOVE_SPEED %)' },
      { code: 'PHYS_EVASION_PCT', label: '💨 Esquiva Física (PHYS_EVASION %)' },
      { code: 'MAG_EVASION_PCT', label: '🌀 Esquiva Mágica (MAG_EVASION %)' },
      { code: 'PHYS_ACCURACY_PCT', label: '🎯 Precisão Física (PHYS_ACCURACY %)' },
      { code: 'MAG_ACCURACY_PCT', label: '🧿 Precisão Mágica (MAG_ACCURACY %)' },
      { code: 'CRIT_RATE_PCT', label: '💥 Taxa Crítica (CRIT_RATE %)' },
      { code: 'CRIT_DMG_PCT', label: '🔥 Dano Crítico (CRIT_DMG %)' },
      { code: 'PHYS_PEN_PCT', label: '🔱 Perfuração Física (PHYS_PEN %)' },
      { code: 'MAG_PEN_PCT', label: '🌌 Perfuração Mágica (MAG_PEN %)' },
      { code: 'ATTACK_RANGE_FLAT', label: '🔭 Alcance de Ataque (px fixo)' },
      { code: 'CONTROL_RESIST_PCT', label: '💎 Resistência a CC & Anomalias (%)' },
      { code: 'HEAL_RECEIVED_PCT', label: '💔 Cura Recebida (% ex: -40)' },
      { code: 'REFLECT_MELEE_PCT', label: '🛡️ Refletir Dano Melee (%)' },
      { code: 'EXTRA_MP_COST_PCT', label: '💧 Dreno Extra de MP / Feitiço (%)' },
      { code: 'ATK_PCT', label: '⚔️ ATK Geral (Legado %)' },
      { code: 'DEF_PCT', label: '🛡️ DEF Geral (Legado %)' },
      { code: 'SPEED_PCT', label: '⚡ SPD Geral (Legado %)' },
    ];

    AdminStatusEffectsTab.injectModalDom();

    app.renderStatusEffectsCrudTable = function () {
      const tbody = document.getElementById('statusEffectsTableBody');
      if (!tbody) return;

      if (!this.statusEffectTemplates || this.statusEffectTemplates.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="color:var(--text-muted); padding:16px; text-align:center;">Nenhum Buff/Debuff cadastrado. Clique em <strong>"➕ Novo Buff / Debuff"</strong> acima!</td></tr>`;
        return;
      }

      const triggerLabels = {
        CONTINUOUS_TICK: '⏱️ A cada Segundo / Tick Periódico',
        WHILE_ACTIVE: '♾️ Enquanto Ativo (Passivo Contínuo)',
        ON_APPLY: '⚡ Ao Ser Aplicado',
        ON_HIT_TAKEN: '🛡️ Ao Receber Golpe',
        ON_ATTACK: '🗡️ Ao Atacar',
        ON_EXPIRE: '⏳ Ao Expirar Efeito',
        ON_TURN_START: '⏱️ Periódico (Tick)',
        ON_TURN_END: '⏳ Ao Expirar',
      };

      tbody.innerHTML = this.statusEffectTemplates
        .map((st) => {
          const mods = st.statModifiersJson || {};
          const dot = st.dotHotFormulaJson || {};
          const flags = Array.isArray(st.controlFlagsJson) ? st.controlFlagsJson : [];

          const summaryParts = [];
          for (const [k, v] of Object.entries(mods)) {
            if (!Number(v)) continue;
            const unit = k === 'ATTACK_RANGE_FLAT' ? 'px' : '%';
            summaryParts.push(`${k.replace(/_PCT|_FLAT/g, '')} ${Number(v) > 0 ? '+' : ''}${v}${unit}`);
          }
          if (dot.mode === 'DAMAGE') {
            summaryParts.push(`💥 DoT: ${dot.scalePct || 0}% ${dot.scaleStat || 'PHYS_ATK'} + ${dot.flatAmount || 0}`);
          } else if (dot.mode === 'HEAL') {
            summaryParts.push(`💚 HoT: ${dot.scalePct || 0}% ${dot.scaleStat || 'HEAL_POWER'} + ${dot.flatAmount || 0}`);
          }
          if (dot.reactiveStatusId) {
            const rst = (this.statusEffectTemplates || []).find((x) => Number(x.id) === Number(dot.reactiveStatusId));
            summaryParts.push(`🛡️ Retalia: [${rst ? rst.namePtBr : '#' + dot.reactiveStatusId}] (${dot.reactiveDurationSec || 1.5}s)`);
          }
          if (flags.length > 0) summaryParts.push(`🔒 ${flags.join(', ')}`);
          if (st.breakOnDamage) summaryParts.push('💤 Quebra ao Dano');

          return `
          <tr>
            <td>
              <strong>#${st.id}</strong> &bull; <span style="color:#c084fc; font-weight:700;">${st.code}</span>
            </td>
            <td>
              <div style="display:flex; align-items:center; gap:8px;">
                <img src="${st.iconUrl}" alt="Icon" title="Ícone na Cabeça do Alvo" style="width:40px; height:40px; border-radius:6px; border:1.5px solid ${st.isBuff ? '#22c55e' : '#ef4444'}; background:#020617; object-fit:contain;" />
                ${
                  st.vfxThumbUrl
                    ? `<div style="display:flex; flex-direction:column; align-items:center; gap:2px;"><canvas class="vfx-color-thumb" data-vfx-thumb="${st.vfxThumbUrl}" data-vfx-color="${st.vfxColorHex || ''}" data-vfx-intensity="${st.vfxColorIntensity ?? 100}" width="40" height="40" title="VFX #${st.mcreworkVfxKey}${st.vfxColorHex ? ' • ' + st.vfxColorHex : ''}" style="width:40px; height:40px; border-radius:6px; border:1.5px solid ${st.vfxColorHex || '#38bdf8'}; background:#020617;"></canvas>${st.vfxColorHex ? `<span style="font-size:0.60rem; font-family:monospace; color:#f8fafc; background:${st.vfxColorHex}33; border:1px solid ${st.vfxColorHex}; padding:0 4px; border-radius:4px;">${st.vfxColorHex}</span>` : ''}</div>`
                    : `<span style="font-size:0.7rem; color:var(--text-muted);">Sem VFX</span>`
                }
              </div>
            </td>
            <td>
              <strong>${st.namePtBr}</strong>
              <div style="font-size:0.72rem; color:var(--text-muted); max-width:250px; white-space:normal;">📜 ${st.descriptionPtBr || '<em>Sem descrição</em>'}</div>
            </td>
            <td>
              <span style="padding:3px 9px; border-radius:99px; background:${st.isBuff ? 'rgba(34,197,94,0.18)' : 'rgba(239,68,68,0.18)'}; color:${st.isBuff ? '#86efac' : '#fca5a5'}; font-size:0.75rem; font-weight:800;">
                ${st.isBuff ? '🟢 BUFF' : '🔴 DEBUFF'}
              </span>
              <div style="font-size:0.68rem; color:#94a3b8; margin-top:3px;">Cat: ${st.statusCategory || (st.isBuff ? 'BUFF' : 'ANOMALY')}</div>
            </td>
            <td>
              <div style="font-size:0.75rem; font-weight:700; color:#fde047;">${triggerLabels[st.triggerType] || st.triggerType}</div>
              <div style="font-size:0.7rem; color:var(--text-muted);">⏱️ ${(st.durationSeconds ?? (st.defaultDurationTurns ? st.defaultDurationTurns * 2.5 : 5.0)).toFixed(1)}s (Tick: ${(st.tickIntervalSeconds ?? 1.0).toFixed(1)}s) &bull; Máx ${st.maxStacks}x</div>
            </td>
            <td>
              <div style="font-size:0.74rem; color:#e2e8f0; max-width:260px; white-space:normal;">
                ${summaryParts.join(' &bull; ') || '<em>Efeito visual</em>'}
              </div>
            </td>
            <td>
              <div style="display:flex; gap:6px;">
                <button class="btn-primary" onclick="AdminApp.openStatusEffectModal(${st.id})">✏️ Editar</button>
                <button class="btn-danger" onclick="AdminApp.deleteStatusEffect(${st.id})">🗑️</button>
              </div>
            </td>
          </tr>`;
        })
        .join('');
      if (window.VfxColorProcessor) {
        window.VfxColorProcessor.hydrateAllThumbCanvases(tbody);
      }
    };

    app.openStatusEffectModal = async function (editId = null) {
      document.getElementById('statusEffectModal').style.display = 'flex';
      await this.ensureSkillAssetsLoaded();

      const existing = editId ? this.statusEffectTemplates.find((s) => s.id === Number(editId)) : null;

      if (existing) {
        document.getElementById('statusModalTitle').textContent = `🧪 Editar Buff/Debuff #${existing.id} (${existing.code})`;
        document.getElementById('statusEditIdInput').value = String(existing.id);
        document.getElementById('statusCodeInput').value = `#${existing.id} • ${existing.code}`;
        document.getElementById('statusNameInput').value = existing.namePtBr || '';
        document.getElementById('statusDescInput').value = existing.descriptionPtBr || '';
        document.getElementById('statusIsBuffSelect').value = existing.isBuff ? 'true' : 'false';
        if (document.getElementById('statusCategorySelect')) {
          document.getElementById('statusCategorySelect').value = existing.statusCategory || (existing.isBuff ? 'BUFF' : 'ANOMALY');
        }
        if (document.getElementById('statusBreakOnDamageCheck')) {
          document.getElementById('statusBreakOnDamageCheck').checked = Boolean(existing.breakOnDamage);
        }
        document.getElementById('statusTriggerSelect').value = existing.triggerType || 'CONTINUOUS_TICK';
        document.getElementById('statusDurationInput').value = String(existing.durationSeconds ?? (existing.defaultDurationTurns ? existing.defaultDurationTurns * 2.5 : 5.0));
        if (document.getElementById('statusTickIntervalInput')) {
          document.getElementById('statusTickIntervalInput').value = String(existing.tickIntervalSeconds ?? 1.0);
        }
        document.getElementById('statusMaxStacksInput').value = String(existing.maxStacks || 1);

        const mods = existing.statModifiersJson || {};
        this.editingStatusModifiers = Object.entries(mods)
          .filter(([, v]) => Number(v) !== 0)
          .map(([statCode, value]) => ({ statCode, value: Number(value) || 0 }));

        const dot = existing.dotHotFormulaJson || {};
        document.getElementById('statusDotModeSelect').value = dot.mode || 'NONE';
        document.getElementById('statusDotScaleStatSelect').value = dot.scaleStat || 'MAX_HP';
        document.getElementById('statusDotScalePctInput').value = String(dot.scalePct ?? 10);
        document.getElementById('statusDotFlatInput').value = String(dot.flatAmount ?? 0);
        document.getElementById('statusDotElementSelect').value = dot.elementCode || 'FIRE';
        this.populateStatusReactiveSelect(dot.reactiveStatusId || '');
        if (document.getElementById('statusReactiveChanceInput')) document.getElementById('statusReactiveChanceInput').value = String(dot.reactiveChancePct ?? 100);
        if (document.getElementById('statusReactiveDurInput')) document.getElementById('statusReactiveDurInput').value = String(dot.reactiveDurationSec ?? 1.5);

        const flags = new Set(Array.isArray(existing.controlFlagsJson) ? existing.controlFlagsJson : []);
        document.querySelectorAll('input[name="statusControlFlag"]').forEach((chk) => {
          chk.checked = flags.has(chk.value);
        });

        this.selectedStatusIconKey = existing.iconKey || 'assets/skills/icons/100156.png';
        this.selectedStatusVfxKey = existing.mcreworkVfxKey || '10002';
        this.selectedStatusVfxColorHex = existing.vfxColorHex || null;
        this.selectedStatusVfxColorIntensity = existing.vfxColorIntensity ?? 100;
      } else {
        const maxId = this.statusEffectTemplates.reduce((acc, s) => Math.max(acc, Number(s.id) || 0), 0);
        const nextId = maxId + 1;
        document.getElementById('statusModalTitle').textContent = `🧪 Novo Buff / Debuff #${nextId} (status_${nextId})`;
        document.getElementById('statusEditIdInput').value = '';
        document.getElementById('statusCodeInput').value = `#${nextId} • status_${nextId} (Automático)`;
        document.getElementById('statusNameInput').value = '';
        document.getElementById('statusDescInput').value = '';
        document.getElementById('statusIsBuffSelect').value = 'true';
        if (document.getElementById('statusCategorySelect')) document.getElementById('statusCategorySelect').value = 'BUFF';
        if (document.getElementById('statusBreakOnDamageCheck')) document.getElementById('statusBreakOnDamageCheck').checked = false;
        document.getElementById('statusTriggerSelect').value = 'CONTINUOUS_TICK';
        document.getElementById('statusDurationInput').value = '5.0';
        if (document.getElementById('statusTickIntervalInput')) {
          document.getElementById('statusTickIntervalInput').value = '1.0';
        }
        document.getElementById('statusMaxStacksInput').value = '1';

        this.editingStatusModifiers = [];

        document.getElementById('statusDotModeSelect').value = 'NONE';
        document.getElementById('statusDotScaleStatSelect').value = 'PHYS_ATK';
        document.getElementById('statusDotScalePctInput').value = '20';
        document.getElementById('statusDotFlatInput').value = '0';
        document.getElementById('statusDotElementSelect').value = 'FIRE';
        this.populateStatusReactiveSelect('');
        if (document.getElementById('statusReactiveChanceInput')) document.getElementById('statusReactiveChanceInput').value = '100';
        if (document.getElementById('statusReactiveDurInput')) document.getElementById('statusReactiveDurInput').value = '1.5';

        document.querySelectorAll('input[name="statusControlFlag"]').forEach((chk) => {
          chk.checked = false;
        });

        this.selectedStatusIconKey = 'assets/skills/icons/100156.png';
        this.selectedStatusVfxKey = '10002';
        this.selectedStatusVfxColorHex = null;
        this.selectedStatusVfxColorIntensity = 100;
      }

      this.renderStatusModifiersEditor();
      this.updateStatusVisualSummary();
      if (typeof this.syncVfxColorControls === 'function') {
        this.syncVfxColorControls('status', this.selectedStatusVfxColorHex, this.selectedStatusVfxColorIntensity);
      }
      this.renderStatusAssetGallery();
      this.startVfxPreviewCanvasLoop(
        'statusVfxPreviewCanvas',
        () => this.selectedStatusVfxKey,
        () => `https://seytanir.github.io/mcrework/${this.selectedStatusIconKey.replace(/^\/+/, '')}`,
        () => ({ colorHex: this.selectedStatusVfxColorHex, intensity: this.selectedStatusVfxColorIntensity })
      );
    };

    app.populateStatusReactiveSelect = function (selectedId = '') {
      const sel = document.getElementById('statusReactiveStatusSelect');
      if (!sel) return;
      const opts = (this.statusEffectTemplates || [])
        .map((st) => `<option value="${st.id}" ${Number(selectedId) === Number(st.id) ? 'selected' : ''}>#${st.id} ${st.isBuff ? '🟢' : '🔴'} ${st.namePtBr}</option>`)
        .join('');
      sel.innerHTML = `<option value="">— Nenhum Contra-Efeito —</option>${opts}`;
    };

    app.addStatusModifierRow = function (statCode = null, value = null) {
      const code = statCode || document.getElementById('statusModAddStatSelect')?.value || 'PHYS_ATK_PCT';
      const val = value !== null ? Number(value) : (Number(document.getElementById('statusModAddValInput')?.value) || 0);
      if (!Array.isArray(this.editingStatusModifiers)) this.editingStatusModifiers = [];
      const existingIdx = this.editingStatusModifiers.findIndex((m) => m.statCode === code);
      if (existingIdx >= 0) this.editingStatusModifiers[existingIdx].value = val;
      else this.editingStatusModifiers.push({ statCode: code, value: val });
      this.renderStatusModifiersEditor();
    };

    app.updateStatusModifierRow = function (idx, field, val) {
      const row = this.editingStatusModifiers[idx];
      if (!row) return;
      if (field === 'statCode') row.statCode = val;
      else row.value = Number(val) || 0;
    };

    app.removeStatusModifierRow = function (idx) {
      this.editingStatusModifiers.splice(idx, 1);
      this.renderStatusModifiersEditor();
    };

    app.renderStatusModifiersEditor = function () {
      const addSel = document.getElementById('statusModAddStatSelect');
      if (addSel && addSel.options.length === 0) {
        addSel.innerHTML = this.STATUS_MODIFIER_OPTIONS
          .map((o) => `<option value="${o.code}">${o.label}</option>`)
          .join('');
      }
      const box = document.getElementById('statusModifiersRowsBox');
      if (!box) return;
      if (!this.editingStatusModifiers || this.editingStatusModifiers.length === 0) {
        box.innerHTML = '<div style="font-size:0.74rem; color:#64748b; padding:6px;">Nenhum modificador de atributo adicionado (use o seletor acima para adicionar +ATK%, -DEF%, +CRIT_RATE%, +ATTACK_RANGE_FLAT, etc.).</div>';
        return;
      }
      box.innerHTML = this.editingStatusModifiers
        .map((m, idx) => {
          const opts = this.STATUS_MODIFIER_OPTIONS
            .map((o) => `<option value="${o.code}" ${o.code === m.statCode ? 'selected' : ''}>${o.label}</option>`)
            .join('');
          return `
          <div style="display:grid; grid-template-columns:1fr 110px auto; gap:8px; align-items:center; background:#0f172a; padding:6px 8px; border-radius:6px; border:1px solid #334155;">
            <select onchange="AdminApp.updateStatusModifierRow(${idx}, 'statCode', this.value)" style="font-size:0.75rem;">${opts}</select>
            <input type="number" step="0.5" value="${m.value}" onchange="AdminApp.updateStatusModifierRow(${idx}, 'value', this.value)" style="font-size:0.78rem;" />
            <button type="button" class="btn-danger" onclick="AdminApp.removeStatusModifierRow(${idx})" style="padding:4px 8px; font-size:0.72rem;">🗑️</button>
          </div>`;
        })
        .join('');
    };

    app.updateStatusVisualSummary = function () {
      const mode = document.getElementById('statusDotModeSelect')?.value || 'NONE';
      const stat = document.getElementById('statusDotScaleStatSelect')?.value || 'MAX_HP';
      const pct = Number(document.getElementById('statusDotScalePctInput')?.value) || 0;
      const flat = Number(document.getElementById('statusDotFlatInput')?.value) || 0;
      const elem = document.getElementById('statusDotElementSelect')?.value || 'NEUTRAL';
      const badge = document.getElementById('statusVisualFormulaPreview');
      if (!badge) return;

      if (mode === 'NONE') {
        badge.textContent = 'Sem Dano/Cura Periódico (apenas modificadores de atributo ou controle)';
      } else if (mode === 'DAMAGE') {
        badge.textContent = `💥 Fórmula Visual: Causa [${pct}% de ${stat} + ${flat}] de Dano (${elem}) toda vez que o gatilho disparar`;
      } else {
        badge.textContent = `💚 Fórmula Visual: Restaura [${pct}% de ${stat} + ${flat}] de HP toda vez que o gatilho disparar`;
      }
    };

    app.switchStatusAssetPicker = function (mode) {
      this.statusAssetPickerMode = mode;
      document.getElementById('btnStatusPickIcon').className = mode === 'icon' ? 'btn-primary' : '';
      document.getElementById('btnStatusPickVfx').className = mode === 'vfx' ? 'btn-primary' : '';
      this.renderStatusAssetGallery();
    };

    app.renderStatusAssetGallery = function () {
      const grid = document.getElementById('statusAssetsGalleryGrid');
      if (!grid) return;
      const q = (document.getElementById('statusAssetSearchInput')?.value || '').toLowerCase().trim();

      const iconImg = document.getElementById('statusSelectedIconImg');
      if (iconImg) {
        iconImg.src = `https://seytanir.github.io/mcrework/${this.selectedStatusIconKey.replace(/^\/+/, '')}`;
      }
      const vfxLabel = document.getElementById('statusSelectedVfxLabel');
      if (vfxLabel) {
        vfxLabel.textContent = this.selectedStatusVfxKey ? `VFX #${this.selectedStatusVfxKey}` : 'Nenhum VFX';
      }
      if (typeof this.refreshSelectedVfxThumb === 'function') {
        this.refreshSelectedVfxThumb('status');
      }

      if (this.statusAssetPickerMode === 'icon') {
        const filtered = this.mcreworkSkillIcons
          .filter((ic) => !q || `${ic.iconKey} ${ic.suggestedName}`.toLowerCase().includes(q))
          .slice(0, 120);
        grid.innerHTML = filtered
          .map((ic) => {
            const isSel = ic.iconKey === this.selectedStatusIconKey;
            return `
            <div class="gallery-card ${isSel ? 'selected' : ''}" onclick="AdminApp.pickStatusIcon('${ic.iconKey}', '${ic.defaultVfxKey || ''}')" style="padding:6px;">
              <img src="${ic.iconUrl}" alt="${ic.iconNum}" loading="lazy" style="width:42px; height:42px; object-fit:contain; margin:0 auto;" />
              <span style="font-size:0.68rem; color:var(--text-muted); text-align:center;">#${ic.iconNum}</span>
            </div>`;
          })
          .join('');
      } else {
        const filtered = this.mcreworkVfxList.filter((v) => !q || `${v.vfxKey} ${v.name}`.toLowerCase().includes(q));
        grid.innerHTML = filtered
          .map((v) => {
            const isSel = v.vfxKey === this.selectedStatusVfxKey;
            return `
            <div class="gallery-card ${isSel ? 'selected' : ''}" onclick="AdminApp.pickStatusVfx('${v.vfxKey}')" style="padding:6px;">
              <img src="${v.thumbUrl}" alt="${v.vfxKey}" crossorigin="anonymous" loading="lazy" style="width:48px; height:48px; object-fit:contain; margin:0 auto;" />
              <strong style="font-size:0.7rem; text-align:center;">VFX #${v.vfxKey}</strong>
              <span style="font-size:0.64rem; color:var(--text-muted); text-align:center;">${v.frames} frames</span>
            </div>`;
          })
          .join('');
      }
    };

    app.pickStatusIcon = function (iconKey, defaultVfxKey) {
      this.selectedStatusIconKey = iconKey;
      if (defaultVfxKey && !this.selectedStatusVfxKey) {
        this.selectedStatusVfxKey = defaultVfxKey;
      }
      this.renderStatusAssetGallery();
    };

    app.pickStatusVfx = function (vfxKey) {
      this.selectedStatusVfxKey = vfxKey;
      this.getOrLoadVfxAtlas(vfxKey);
      this.renderStatusAssetGallery();
    };

    app.saveStatusEffect = async function () {
      try {
        const editId = document.getElementById('statusEditIdInput').value.trim();
        const namePtBr = document.getElementById('statusNameInput').value.trim();
        const descriptionPtBr = document.getElementById('statusDescInput').value.trim();
        const isBuff = document.getElementById('statusIsBuffSelect').value === 'true';
        const triggerType = document.getElementById('statusTriggerSelect').value || 'CONTINUOUS_TICK';
        const durationSeconds = Number(document.getElementById('statusDurationInput').value) || 5.0;
        const tickIntervalSeconds = Number(document.getElementById('statusTickIntervalInput')?.value) || 1.0;
        const defaultDurationTurns = Math.max(1, Math.round(durationSeconds / 2.5));
        const maxStacks = Number(document.getElementById('statusMaxStacksInput').value) || 1;

        if (!namePtBr) {
          alert('Informe um nome em português para o Buff/Debuff.');
          return;
        }

        const statusCategory = document.getElementById('statusCategorySelect')?.value || (isBuff ? 'BUFF' : 'ANOMALY');
        const breakOnDamage = Boolean(document.getElementById('statusBreakOnDamageCheck')?.checked);

        const statModifiersJson = {};
        for (const m of this.editingStatusModifiers || []) {
          if (m.statCode && Number.isFinite(Number(m.value)) && Number(m.value) !== 0) {
            statModifiersJson[m.statCode] = Number(m.value);
          }
        }

        const reactiveStatusId = Number(document.getElementById('statusReactiveStatusSelect')?.value) || null;
        const dotHotFormulaJson = {
          mode: document.getElementById('statusDotModeSelect').value || 'NONE',
          scaleStat: document.getElementById('statusDotScaleStatSelect').value || 'MAX_HP',
          scalePct: Number(document.getElementById('statusDotScalePctInput').value) || 0,
          flatAmount: Number(document.getElementById('statusDotFlatInput').value) || 0,
          elementCode: document.getElementById('statusDotElementSelect').value || 'FIRE',
          reactiveStatusId,
          reactiveChancePct: reactiveStatusId ? (Number(document.getElementById('statusReactiveChanceInput')?.value) || 100) : 0,
          reactiveDurationSec: reactiveStatusId ? (Number(document.getElementById('statusReactiveDurInput')?.value) || 1.5) : 0,
        };

        const controlFlagsJson = Array.from(document.querySelectorAll('input[name="statusControlFlag"]:checked')).map(
          (c) => c.value
        );

        const dto = {
          namePtBr,
          descriptionPtBr,
          iconKey: this.selectedStatusIconKey,
          mcreworkVfxKey: this.selectedStatusVfxKey,
          vfxColorHex: this.selectedStatusVfxColorHex || null,
          vfxColorIntensity: this.selectedStatusVfxColorIntensity ?? 100,
          isBuff,
          statusCategory,
          breakOnDamage,
          triggerType,
          durationSeconds,
          tickIntervalSeconds,
          defaultDurationTurns,
          maxStacks,
          statModifiersJson,
          dotHotFormulaJson,
          controlFlagsJson,
        };

        const path = editId ? `/api/admin/status-effects/${editId}` : '/api/admin/status-effects';
        const method = editId ? 'PUT' : 'POST';
        await this.api(path, { method, body: JSON.stringify(dto) });

        this.closeModal('statusEffectModal');
        await this.loadSkillsAndBuffsData();
      } catch (err) {
        alert(`Erro ao salvar Buff/Debuff: ${err.message}`);
      }
    };

    app.deleteStatusEffect = async function (id) {
      if (!confirm('Deseja realmente excluir este Buff/Debuff?')) return;
      try {
        await this.api(`/api/admin/status-effects/${id}`, { method: 'DELETE' });
        await this.loadSkillsAndBuffsData();
      } catch (err) {
        alert(`Erro ao excluir Buff/Debuff: ${err.message}`);
      }
    };
  }

  static injectModalDom() {
    if (document.getElementById('statusEffectModal')) return;
    const stModal = document.createElement('div');
    stModal.id = 'statusEffectModal';
    stModal.className = 'modal-backdrop';
    stModal.style.display = 'none';
    stModal.innerHTML = `
      <div class="modal-box" style="max-width:900px; width:96%; max-height:92vh; display:block; overflow-y:auto; padding:16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:10px; margin-bottom:12px;">
          <h3 id="statusModalTitle" style="color:#c084fc; margin:0;">🧪 Novo Buff / Debuff</h3>
          <div style="display:flex; gap:8px;">
            <button class="btn-success" onclick="AdminApp.saveStatusEffect()" style="padding:6px 14px; font-weight:700;">💾 Salvar</button>
            <button class="btn-danger" onclick="AdminApp.closeModal('statusEffectModal')" style="padding:6px 10px;">✕</button>
          </div>
        </div>
        <input type="hidden" id="statusEditIdInput" value="" />

        <div style="background:rgba(15,23,42,0.75); border:1px solid #334155; border-radius:10px; padding:12px; margin-bottom:12px;">
          <div style="font-size:0.8rem; font-weight:700; color:#fde047; margin-bottom:8px;">1️⃣ Identidade, Natureza & Gatilho Próprio</div>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(175px, 1fr)); gap:10px;">
            <div class="field"><label>ID & Código</label><input type="text" id="statusCodeInput" readonly style="color:#c084fc; font-weight:700;" /></div>
            <div class="field"><label>Nome (PT-BR)</label><input type="text" id="statusNameInput" placeholder="Ex: Queimadura Solar" /></div>
            <div class="field">
              <label>Natureza</label>
              <select id="statusIsBuffSelect">
                <option value="true">🟢 BUFF (Efeito Benéfico)</option>
                <option value="false">🔴 DEBUFF (Efeito Negativo)</option>
              </select>
            </div>
            <div class="field">
              <label>Família / Categoria (Cleanse)</label>
              <select id="statusCategorySelect">
                <option value="BUFF">🟢 BUFF / Postura / Escudo</option>
                <option value="HARD_CC">⚡ CONTROL_HIT (Hard CC)</option>
                <option value="ANOMALY">☣️ ANOMALY_HIT (DoT / Debuff)</option>
                <option value="SLOW">🕸️ SLOW (Lentidão)</option>
              </select>
            </div>
            <div class="field">
              <label style="color:#fde047; font-weight:700;">⚡ Gatilho do Buff/Debuff</label>
              <select id="statusTriggerSelect">
                <option value="CONTINUOUS_TICK">⏱️ A cada Segundo / Tick Periódico</option>
                <option value="WHILE_ACTIVE">♾️ Enquanto Estiver Ativo (Passivo Contínuo)</option>
                <option value="ON_APPLY">⚡ Imediatamente Ao Ser Aplicado</option>
                <option value="ON_HIT_TAKEN">🛡️ Quando o Alvo Receber Golpe</option>
                <option value="ON_ATTACK">🗡️ Quando o Alvo Atacar</option>
                <option value="ON_EXPIRE">⏳ No Término (Ao Expirar Efeito)</option>
              </select>
            </div>
            <div class="field"><label>⏱️ Duração (Segundos)</label><input type="number" id="statusDurationInput" value="5.0" min="0.5" max="300" step="0.5" /></div>
            <div class="field"><label>Intervalo de Tick (Segundos)</label><input type="number" id="statusTickIntervalInput" value="1.0" min="0.1" max="60" step="0.5" /></div>
            <div class="field"><label>Máximo de Acúmulos (Stacks)</label><input type="number" id="statusMaxStacksInput" value="1" min="1" max="10" /></div>
          </div>
          <div class="field" style="margin-top:8px;">
            <label>Descrição em Português (PT-BR)</label>
            <textarea id="statusDescInput" rows="2" placeholder="Descreva o que este Buff ou Debuff faz quando aplicado..."></textarea>
          </div>
        </div>

        <div style="background:rgba(15,23,42,0.75); border:1px solid #334155; border-radius:10px; padding:12px; margin-bottom:12px;">
          <div style="font-size:0.8rem; font-weight:700; color:#fde047; margin-bottom:8px;">2️⃣ Construtor Visual Dinâmico (Modificadores, DoT/HoT, Retaliação & CC)</div>
          <div style="background:#020617; padding:10px; border-radius:8px; border:1px solid var(--border); margin-bottom:10px;">
            <div style="display:grid; grid-template-columns:1fr 120px auto; gap:8px; align-items:end; margin-bottom:8px;">
              <div><label style="font-size:0.72rem; color:#7dd3fc;">➕ Adicionar Modificador de Atributo</label><select id="statusModAddStatSelect"></select></div>
              <div><label style="font-size:0.72rem;">Valor (+ ou -)</label><input type="number" id="statusModAddValInput" step="0.5" value="20" /></div>
              <button type="button" class="btn-primary" onclick="AdminApp.addStatusModifierRow()" style="padding:7px 12px; font-size:0.76rem; font-weight:700;">➕ Adicionar</button>
            </div>
            <div id="statusModifiersRowsBox" style="display:flex; flex-direction:column; gap:6px;"></div>
          </div>

          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(145px, 1fr)); gap:8px; background:#020617; padding:10px; border-radius:8px; border:1px solid var(--border);">
            <div>
              <label style="font-size:0.72rem;">Ação quando o Gatilho Disparar</label>
              <select id="statusDotModeSelect" onchange="AdminApp.updateStatusVisualSummary()">
                <option value="NONE">⚪ Nenhum Dano/Cura periódico</option>
                <option value="DAMAGE">💥 Causar Dano Periódico (DoT)</option>
                <option value="HEAL">💚 Restaurar Vida Periódica (HoT)</option>
              </select>
            </div>
            <div>
              <label style="font-size:0.72rem;">Escalar por Atributo</label>
              <select id="statusDotScaleStatSelect" onchange="AdminApp.updateStatusVisualSummary()">
                <option value="PHYS_ATK">🗡️ Ataque Físico (PHYS_ATK)</option>
                <option value="MAG_ATK">🔮 Ataque Mágico (MAG_ATK)</option>
                <option value="HEAL_POWER">💚 Poder de Cura (HEAL_POWER)</option>
                <option value="MAX_HP">❤️ HP Máximo do Alvo</option>
                <option value="MAX_MP">💧 MP Máximo</option>
                <option value="ATK">⚔️ ATK Geral</option>
              </select>
            </div>
            <div>
              <label style="font-size:0.72rem;">Multiplicador (%)</label>
              <input type="number" id="statusDotScalePctInput" value="20" oninput="AdminApp.updateStatusVisualSummary()" />
            </div>
            <div>
              <label style="font-size:0.72rem;">+ Valor Fixo</label>
              <input type="number" id="statusDotFlatInput" value="0" oninput="AdminApp.updateStatusVisualSummary()" />
            </div>
            <div>
              <label style="font-size:0.72rem;">Elemento do Efeito</label>
              <select id="statusDotElementSelect" onchange="AdminApp.updateStatusVisualSummary()">
                <option value="FIRE">🔥 Fogo</option>
                <option value="WATER">💧 Água</option>
                <option value="EARTH">🪨 Terra</option>
                <option value="AIR">🌪️ Ar</option>
                <option value="NEUTRAL">⚪ Neutro</option>
              </select>
            </div>
          </div>
          <div style="display:grid; grid-template-columns:1fr 90px 90px; gap:8px; align-items:end; background:#020617; padding:8px 10px; border-radius:8px; border:1px solid var(--border); margin-top:8px;">
            <div><label style="font-size:0.71rem; color:#c084fc;">🛡️ Contra-Efeito Reativo ao Receber Golpe (ex: Confusão)</label><select id="statusReactiveStatusSelect"></select></div>
            <div><label style="font-size:0.71rem;">Chance (%)</label><input type="number" id="statusReactiveChanceInput" min="1" max="100" value="100" /></div>
            <div><label style="font-size:0.71rem;">Duração (s)</label><input type="number" id="statusReactiveDurInput" min="0.5" max="30" step="0.5" value="1.5" /></div>
          </div>
          <div id="statusVisualFormulaPreview" style="font-size:0.75rem; color:#86efac; margin-top:6px; font-weight:600;"></div>

          <div style="display:flex; gap:12px; flex-wrap:wrap; margin-top:10px; padding-top:8px; border-top:1px solid var(--border); align-items:center;">
            <span style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">Controles de Grupo (CC):</span>
            <label style="display:flex; align-items:center; gap:4px; font-size:0.75rem; cursor:pointer;"><input type="checkbox" name="statusControlFlag" value="STUN" /> 💫 Atordoar</label>
            <label style="display:flex; align-items:center; gap:4px; font-size:0.75rem; cursor:pointer;"><input type="checkbox" name="statusControlFlag" value="PARALYSIS" /> ⚡ Paralisia</label>
            <label style="display:flex; align-items:center; gap:4px; font-size:0.75rem; cursor:pointer;"><input type="checkbox" name="statusControlFlag" value="SILENCE" /> 🤐 Silêncio</label>
            <label style="display:flex; align-items:center; gap:4px; font-size:0.75rem; cursor:pointer;"><input type="checkbox" name="statusControlFlag" value="FREEZE" /> ❄️ Congelar</label>
            <label style="display:flex; align-items:center; gap:4px; font-size:0.75rem; cursor:pointer;"><input type="checkbox" name="statusControlFlag" value="CONFUSION" /> 🌀 Confusão</label>
            <label style="display:flex; align-items:center; gap:4px; font-size:0.75rem; cursor:pointer;"><input type="checkbox" name="statusControlFlag" value="SLEEP" /> 💤 Sono</label>
            <label style="display:flex; align-items:center; gap:4px; font-size:0.75rem; cursor:pointer;"><input type="checkbox" name="statusControlFlag" value="TAUNT" /> 📢 Provocar (Taunt)</label>
            <label style="display:flex; align-items:center; gap:4px; font-size:0.75rem; cursor:pointer;"><input type="checkbox" name="statusControlFlag" value="SLOW" /> 🕸️ Lentidão</label>
            <label style="display:flex; align-items:center; gap:4px; font-size:0.75rem; cursor:pointer;"><input type="checkbox" name="statusControlFlag" value="BLIND" /> 🕶️ Cegueira</label>
            <label style="display:flex; align-items:center; gap:4px; font-size:0.75rem; cursor:pointer; color:#fde047; margin-left:auto;"><input type="checkbox" id="statusBreakOnDamageCheck" /> 💤 Quebrar ao sofrer dano</label>
          </div>
        </div>

        <div style="background:rgba(15,23,42,0.75); border:1.5px solid #c084fc; border-radius:10px; padding:12px;">
          <div style="font-size:0.8rem; font-weight:700; color:#fde047; margin-bottom:8px;">3️⃣ 🏟️ Arena de Batalha 2.5D Realista: Ícone na Cabeça do Alvo & Efeito Especial (VFX Ao Vivo)</div>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(175px, 1fr)); gap:8px; margin-bottom:8px; background:rgba(2,6,23,0.75); padding:8px; border-radius:8px; border:1px solid var(--border); align-items:end;">
            <div>
              <label style="font-size:0.7rem; color:#7dd3fc; font-weight:700;">🦸 Conjurador (Esquerda)</label>
              <select id="statusArenaCasterSelect" onchange="AdminApp.triggerArenaPreviewNow()" style="padding:5px 7px; font-size:0.76rem;"></select>
            </div>
            <div>
              <label style="font-size:0.7rem; color:#fda4af; font-weight:700;">🐉 Alvo do Buff/Debuff (Direita)</label>
              <select id="statusArenaTargetSelect" onchange="AdminApp.triggerArenaPreviewNow()" style="padding:5px 7px; font-size:0.76rem;"></select>
            </div>
            <div>
              <label style="font-size:0.7rem; color:#fde047; font-weight:700;">⚔️ Formação</label>
              <select id="statusArenaFormationSelect" onchange="AdminApp.triggerArenaPreviewNow()" style="padding:5px 7px; font-size:0.76rem;">
                <option value="1" selected>1x1 (Duelo Individual)</option>
                <option value="3">1x3 (Formação de Batalha)</option>
              </select>
            </div>
            <div>
              <button type="button" class="btn-primary" onclick="AdminApp.triggerArenaPreviewNow()" style="width:100%; padding:6px 10px; font-size:0.76rem; font-weight:700;">
                ▶️ Testar Efeito Agora
              </button>
            </div>
          </div>

          <div style="display:flex; gap:12px; align-items:stretch; flex-wrap:wrap; margin-bottom:10px; background:#020617; padding:10px; border-radius:8px;">
            <div style="position:relative; width:480px; max-width:100%; height:210px; background:#020617; border:1.5px solid #c084fc; border-radius:8px; overflow:hidden; flex-shrink:0; display:flex; justify-content:center;">
              <canvas id="statusVfxPreviewCanvas" width="480" height="210" style="width:100%; height:100%; object-fit:contain;"></canvas>
              <span style="position:absolute; bottom:4px; right:6px; font-size:0.62rem; color:#d8b4fe; background:rgba(2,6,23,0.8); padding:1px 6px; border-radius:4px;">🏟️ Arena 2.5D + Ícone na Cabeça</span>
            </div>
            <div style="flex:1; display:flex; flex-direction:column; justify-content:space-between; gap:8px; min-width:230px;">
              <div style="display:flex; align-items:center; gap:10px;">
                <img id="statusSelectedIconImg" src="" alt="Icon" style="width:44px; height:44px; border-radius:8px; border:2px solid #fde047; background:#0f172a; object-fit:contain;" />
                <canvas id="statusSelectedVfxThumbCanvas" width="42" height="42" title="Prévia do Efeito Especial colorido" style="width:42px; height:42px; border-radius:8px; border:2px solid #c084fc; background:#0f172a; flex-shrink:0;"></canvas>
                <div>
                  <div style="font-size:0.82rem; font-weight:700; color:#fde047;">Ícone Acima da Cabeça & Efeito: <span id="statusSelectedVfxLabel" style="color:#38bdf8;"></span></div>
                  <div style="font-size:0.72rem; color:var(--text-muted);">Alterne abaixo para escolher o Ícone ou o Efeito Especial (VFX) animado do mcrework:</div>
                </div>
              </div>
              ${window.AdminVfxColorPicker ? window.AdminVfxColorPicker.buildControlsHtml('status') : ''}
              <div style="display:flex; gap:6px; flex-wrap:wrap;">
                <button type="button" id="btnStatusPickIcon" class="btn-primary" onclick="AdminApp.switchStatusAssetPicker('icon')" style="padding:5px 12px; font-size:0.76rem;">🖼️ Escolher Ícone da Cabeça</button>
                <button type="button" id="btnStatusPickVfx" onclick="AdminApp.switchStatusAssetPicker('vfx')" style="padding:5px 12px; font-size:0.76rem;">✨ Escolher Efeito Especial (VFX)</button>
                <input type="text" id="statusAssetSearchInput" placeholder="🔍 Filtrar..." oninput="AdminApp.renderStatusAssetGallery()" style="flex:1; min-width:140px; padding:5px 8px; font-size:0.78rem;" />
              </div>
            </div>
          </div>
          <div id="statusAssetsGalleryGrid" class="gallery-grid" style="max-height:220px;"></div>
        </div>
      </div>`;
    document.body.appendChild(stModal);
  }
}

window.AdminStatusEffectsTab = AdminStatusEffectsTab;
