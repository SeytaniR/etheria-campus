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
    app.statusAssetPickerMode = 'icon';

    AdminStatusEffectsTab.injectModalDom();

    app.renderStatusEffectsCrudTable = function () {
      const tbody = document.getElementById('statusEffectsTableBody');
      if (!tbody) return;

      if (!this.statusEffectTemplates || this.statusEffectTemplates.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="color:var(--text-muted); padding:16px; text-align:center;">Nenhum Buff/Debuff cadastrado. Clique em <strong>"➕ Novo Buff / Debuff"</strong> acima!</td></tr>`;
        return;
      }

      const triggerLabels = {
        WHILE_ACTIVE: '♾️ Enquanto Ativo (Contínuo)',
        ON_TURN_START: '🌅 No Início do Turno do Alvo',
        ON_TURN_END: '🌙 No Fim do Turno do Alvo',
        ON_APPLY: '⚡ Ao Ser Aplicado',
        ON_HIT_TAKEN: '🛡️ Ao Receber Golpe',
        ON_ATTACK: '🗡️ Ao Atacar',
      };

      tbody.innerHTML = this.statusEffectTemplates
        .map((st) => {
          const mods = st.statModifiersJson || {};
          const dot = st.dotHotFormulaJson || {};
          const flags = Array.isArray(st.controlFlagsJson) ? st.controlFlagsJson : [];

          const summaryParts = [];
          if (mods.ATK_PCT) summaryParts.push(`ATK ${mods.ATK_PCT > 0 ? '+' : ''}${mods.ATK_PCT}%`);
          if (mods.DEF_PCT) summaryParts.push(`DEF ${mods.DEF_PCT > 0 ? '+' : ''}${mods.DEF_PCT}%`);
          if (mods.SPEED_PCT) summaryParts.push(`SPD ${mods.SPEED_PCT > 0 ? '+' : ''}${mods.SPEED_PCT}%`);
          if (dot.mode === 'DAMAGE') {
            summaryParts.push(
              `💥 Dano: ${dot.scalePct || 0}% ${dot.scaleStat || 'ATK'} + ${dot.flatAmount || 0} (${dot.elementCode || 'NEUTRAL'})`
            );
          } else if (dot.mode === 'HEAL') {
            summaryParts.push(`💚 Cura: ${dot.scalePct || 0}% ${dot.scaleStat || 'MAX_HP'} + ${dot.flatAmount || 0}`);
          }
          if (flags.length > 0) summaryParts.push(`🔒 Controle: ${flags.join(', ')}`);

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
                    ? `<img src="${st.vfxThumbUrl}" alt="VFX" title="VFX #${st.mcreworkVfxKey}" style="width:40px; height:40px; border-radius:6px; border:1px solid #38bdf8; background:#020617; object-fit:contain;" />`
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
                ${st.isBuff ? '🟢 BUFF (Positivo)' : '🔴 DEBUFF (Negativo)'}
              </span>
            </td>
            <td>
              <div style="font-size:0.75rem; font-weight:700; color:#fde047;">${triggerLabels[st.triggerType] || st.triggerType}</div>
              <div style="font-size:0.7rem; color:var(--text-muted);">⏱️ ${st.defaultDurationTurns} turno(s) &bull; Máx ${st.maxStacks}x</div>
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
        document.getElementById('statusTriggerSelect').value = existing.triggerType || 'ON_TURN_START';
        document.getElementById('statusDurationInput').value = String(existing.defaultDurationTurns || 2);
        document.getElementById('statusMaxStacksInput').value = String(existing.maxStacks || 1);

        const mods = existing.statModifiersJson || {};
        document.getElementById('statusModAtkPct').value = String(mods.ATK_PCT || 0);
        document.getElementById('statusModDefPct').value = String(mods.DEF_PCT || 0);
        document.getElementById('statusModSpeedPct').value = String(mods.SPEED_PCT || 0);

        const dot = existing.dotHotFormulaJson || {};
        document.getElementById('statusDotModeSelect').value = dot.mode || 'NONE';
        document.getElementById('statusDotScaleStatSelect').value = dot.scaleStat || 'MAX_HP';
        document.getElementById('statusDotScalePctInput').value = String(dot.scalePct ?? 10);
        document.getElementById('statusDotFlatInput').value = String(dot.flatAmount ?? 10);
        document.getElementById('statusDotElementSelect').value = dot.elementCode || 'FIRE';

        const flags = new Set(Array.isArray(existing.controlFlagsJson) ? existing.controlFlagsJson : []);
        document.querySelectorAll('input[name="statusControlFlag"]').forEach((chk) => {
          chk.checked = flags.has(chk.value);
        });

        this.selectedStatusIconKey = existing.iconKey || 'assets/skills/icons/100156.png';
        this.selectedStatusVfxKey = existing.mcreworkVfxKey || '10002';
      } else {
        const maxId = this.statusEffectTemplates.reduce((acc, s) => Math.max(acc, Number(s.id) || 0), 0);
        const nextId = maxId + 1;
        document.getElementById('statusModalTitle').textContent = `🧪 Novo Buff / Debuff #${nextId} (status_${nextId})`;
        document.getElementById('statusEditIdInput').value = '';
        document.getElementById('statusCodeInput').value = `#${nextId} • status_${nextId} (Automático)`;
        document.getElementById('statusNameInput').value = '';
        document.getElementById('statusDescInput').value = '';
        document.getElementById('statusIsBuffSelect').value = 'true';
        document.getElementById('statusTriggerSelect').value = 'ON_TURN_START';
        document.getElementById('statusDurationInput').value = '3';
        document.getElementById('statusMaxStacksInput').value = '1';

        document.getElementById('statusModAtkPct').value = '0';
        document.getElementById('statusModDefPct').value = '0';
        document.getElementById('statusModSpeedPct').value = '0';

        document.getElementById('statusDotModeSelect').value = 'NONE';
        document.getElementById('statusDotScaleStatSelect').value = 'MAX_HP';
        document.getElementById('statusDotScalePctInput').value = '10';
        document.getElementById('statusDotFlatInput').value = '10';
        document.getElementById('statusDotElementSelect').value = 'FIRE';

        document.querySelectorAll('input[name="statusControlFlag"]').forEach((chk) => {
          chk.checked = false;
        });

        this.selectedStatusIconKey = 'assets/skills/icons/100156.png';
        this.selectedStatusVfxKey = '10002';
      }

      this.updateStatusVisualSummary();
      this.renderStatusAssetGallery();
      this.startVfxPreviewCanvasLoop(
        'statusVfxPreviewCanvas',
        () => this.selectedStatusVfxKey,
        () => `https://seytanir.github.io/mcrework/${this.selectedStatusIconKey.replace(/^\/+/, '')}`
      );
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
        badge.textContent = 'Sem Dano/Cura por turno (apenas modificadores de atributo ou controle)';
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
              <img src="${v.thumbUrl}" alt="${v.vfxKey}" loading="lazy" style="width:48px; height:48px; object-fit:contain; margin:0 auto;" />
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
        const triggerType = document.getElementById('statusTriggerSelect').value || 'ON_TURN_START';
        const defaultDurationTurns = Number(document.getElementById('statusDurationInput').value) || 2;
        const maxStacks = Number(document.getElementById('statusMaxStacksInput').value) || 1;

        if (!namePtBr) {
          alert('Informe um nome em português para o Buff/Debuff.');
          return;
        }

        const statModifiersJson = {
          ATK_PCT: Number(document.getElementById('statusModAtkPct').value) || 0,
          DEF_PCT: Number(document.getElementById('statusModDefPct').value) || 0,
          SPEED_PCT: Number(document.getElementById('statusModSpeedPct').value) || 0,
        };

        const dotHotFormulaJson = {
          mode: document.getElementById('statusDotModeSelect').value || 'NONE',
          scaleStat: document.getElementById('statusDotScaleStatSelect').value || 'MAX_HP',
          scalePct: Number(document.getElementById('statusDotScalePctInput').value) || 0,
          flatAmount: Number(document.getElementById('statusDotFlatInput').value) || 0,
          elementCode: document.getElementById('statusDotElementSelect').value || 'FIRE',
        };

        const controlFlagsJson = Array.from(document.querySelectorAll('input[name="statusControlFlag"]:checked')).map(
          (c) => c.value
        );

        const dto = {
          namePtBr,
          descriptionPtBr,
          iconKey: this.selectedStatusIconKey,
          mcreworkVfxKey: this.selectedStatusVfxKey,
          isBuff,
          triggerType,
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
              <label style="color:#fde047; font-weight:700;">⚡ Gatilho do Buff/Debuff</label>
              <select id="statusTriggerSelect">
                <option value="ON_TURN_START">🌅 No Início do Turno do Alvo</option>
                <option value="ON_TURN_END">🌙 No Fim do Turno do Alvo</option>
                <option value="WHILE_ACTIVE">♾️ Enquanto Estiver Ativo (Contínuo)</option>
                <option value="ON_APPLY">⚡ Imediatamente Ao Ser Aplicado</option>
                <option value="ON_HIT_TAKEN">🛡️ Quando o Alvo Receber Golpe</option>
                <option value="ON_ATTACK">🗡️ Quando o Alvo Atacar</option>
              </select>
            </div>
            <div class="field"><label>Duração Padrão (Turnos)</label><input type="number" id="statusDurationInput" value="3" min="1" max="20" /></div>
            <div class="field"><label>Máximo de Acúmulos (Stacks)</label><input type="number" id="statusMaxStacksInput" value="1" min="1" max="10" /></div>
          </div>
          <div class="field" style="margin-top:8px;">
            <label>Descrição em Português (PT-BR)</label>
            <textarea id="statusDescInput" rows="2" placeholder="Descreva o que este Buff ou Debuff faz quando aplicado..."></textarea>
          </div>
        </div>

        <div style="background:rgba(15,23,42,0.75); border:1px solid #334155; border-radius:10px; padding:12px; margin-bottom:12px;">
          <div style="font-size:0.8rem; font-weight:700; color:#fde047; margin-bottom:8px;">2️⃣ Construtor Visual de Efeitos (Atributos, Dano/Cura por Gatilho & Controle)</div>
          <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; margin-bottom:10px;">
            <div><label style="font-size:0.72rem; color:#f87171;">🗡️ Modificador de ATK (%)</label><input type="number" id="statusModAtkPct" value="0" /></div>
            <div><label style="font-size:0.72rem; color:#38bdf8;">🛡️ Modificador de DEF (%)</label><input type="number" id="statusModDefPct" value="0" /></div>
            <div><label style="font-size:0.72rem; color:#fde047;">⚡ Modificador de SPEED (%)</label><input type="number" id="statusModSpeedPct" value="0" /></div>
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
                <option value="MAX_HP">❤️ HP Máximo do Alvo</option>
                <option value="ATK">🗡️ Ataque (ATK)</option>
              </select>
            </div>
            <div>
              <label style="font-size:0.72rem;">Multiplicador (%)</label>
              <input type="number" id="statusDotScalePctInput" value="10" oninput="AdminApp.updateStatusVisualSummary()" />
            </div>
            <div>
              <label style="font-size:0.72rem;">+ Valor Fixo</label>
              <input type="number" id="statusDotFlatInput" value="10" oninput="AdminApp.updateStatusVisualSummary()" />
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
          <div id="statusVisualFormulaPreview" style="font-size:0.75rem; color:#86efac; margin-top:6px; font-weight:600;"></div>

          <div style="display:flex; gap:14px; flex-wrap:wrap; margin-top:10px; padding-top:8px; border-top:1px solid var(--border);">
            <span style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">Controles de Grupo (CC):</span>
            <label style="display:flex; align-items:center; gap:5px; font-size:0.76rem; cursor:pointer;"><input type="checkbox" name="statusControlFlag" value="STUN" /> 💫 Atordoar (Impede agir)</label>
            <label style="display:flex; align-items:center; gap:5px; font-size:0.76rem; cursor:pointer;"><input type="checkbox" name="statusControlFlag" value="SILENCE" /> 🤐 Silenciar (Bloqueia Skills)</label>
            <label style="display:flex; align-items:center; gap:5px; font-size:0.76rem; cursor:pointer;"><input type="checkbox" name="statusControlFlag" value="FREEZE" /> ❄️ Congelar</label>
          </div>
        </div>

        <div style="background:rgba(15,23,42,0.75); border:1.5px solid #c084fc; border-radius:10px; padding:12px;">
          <div style="font-size:0.8rem; font-weight:700; color:#fde047; margin-bottom:8px;">3️⃣ 🎨 Ícone na Cabeça do Alvo & Efeito Especial (VFX 2.5D Ao Vivo)</div>
          <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap; margin-bottom:10px; background:#020617; padding:10px; border-radius:8px;">
            <div style="position:relative; width:140px; height:140px; background:radial-gradient(ellipse at center bottom, #3b0764 0%, #020617 75%); border:1.5px solid #c084fc; border-radius:8px; overflow:hidden; flex-shrink:0;">
              <canvas id="statusVfxPreviewCanvas" width="140" height="140"></canvas>
              <span style="position:absolute; bottom:3px; right:5px; font-size:0.6rem; color:#d8b4fe;">Cabeça + VFX</span>
            </div>
            <div style="flex:1; display:flex; flex-direction:column; gap:8px;">
              <div style="display:flex; align-items:center; gap:10px;">
                <img id="statusSelectedIconImg" src="" alt="Icon" style="width:44px; height:44px; border-radius:8px; border:2px solid #fde047; background:#0f172a; object-fit:contain;" />
                <div>
                  <div style="font-size:0.82rem; font-weight:700; color:#fde047;">Ícone Acima da Cabeça & Efeito: <span id="statusSelectedVfxLabel" style="color:#38bdf8;"></span></div>
                  <div style="font-size:0.72rem; color:var(--text-muted);">Alterne abaixo para escolher o Ícone ou o Efeito Especial (VFX) animado do mcrework:</div>
                </div>
              </div>
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
