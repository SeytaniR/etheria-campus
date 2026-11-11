/**
 * @file apps/server/public/admin/js/AdminMetaQuestsPanel.js
 * @module @etheria/server
 * @description Submódulo OOP do Construtor de Quests Meta Procedurais (`/admin`),
 *   com seletor de Alvo (Monstro, Raça ou Coleta/Entrega de Item), multiplicador
 *   de metas (ex: x10: 10, 100, 1000...), trilhas de escalada de recompensas e
 *   grade editável por estágio antes de salvar.
 */

class AdminMetaQuestsPanel {
  static getBuilderSectionHtml() {
    return `
      <!-- BLOCO META PROCEDURAL (EXIBIDO QUANDO CATEGORIA === 'META') -->
      <div id="questMetaBuilderSection" style="display:none; background:rgba(15,23,42,0.88); border:2px solid #f97316; border-radius:10px; padding:12px; margin-bottom:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
          <div>
            <div style="font-size:0.84rem; font-weight:800; color:#fdba74;">
              🟠 Construtor de Quest Meta Procedural (Estágios 1 ➔ N • Contagem Cumulativa)
            </div>
            <div style="font-size:0.72rem; color:#94a3b8;">
              Ao concluir cada estágio com o NPC, a missão avança automaticamente para a próxima etapa com recompensas escaladas.
            </div>
          </div>
          <span id="metaTargetSequencePreview" style="background:#020617; border:1px solid #f97316; color:#fed7aa; padding:4px 10px; border-radius:99px; font-size:0.72rem; font-weight:700;">
            10 ➔ 100 ➔ 1.000
          </span>
        </div>

        <!-- 1. OBJETIVO E FATOR PROCEDURAL DO ALVO -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(170px, 1fr)); gap:10px; background:#020617; border:1px solid #334155; border-radius:8px; padding:10px; margin-bottom:10px;">
          <div class="field">
            <label style="color:#fdba74; font-weight:700;">🎯 Tipo de Meta</label>
            <select id="metaTargetTypeSelect" onchange="AdminApp.onMetaTargetTypeChanged()">
              <option value="KILL_MONSTER">🐉 Matar Monstro Específico</option>
              <option value="KILL_RACE">🐾 Matar Raça / Tipo de Monstro</option>
              <option value="COLLECT_ITEM">📦 Coletar & Entregar Item</option>
            </select>
          </div>
          <div class="field" id="metaTargetMonsterField">
            <label>🐉 Monstro Alvo</label>
            <select id="metaMonsterSelect"></select>
          </div>
          <div class="field" id="metaTargetRaceField" style="display:none;">
            <label>🐾 Raça / Tipo Alvo (Ex: Selvagens, Demônios)</label>
            <select id="metaRaceSelect"></select>
          </div>
          <div class="field" id="metaTargetItemField" style="display:none;">
            <label>📦 Item a Coletar e Entregar ao NPC</label>
            <select id="metaItemSelect"></select>
          </div>
          <div class="field">
            <label style="color:#fde047;">📌 Quantidade Inicial (Estágio 1)</label>
            <input type="number" id="metaInitialCountInput" value="10" min="1" oninput="AdminApp.updateMetaSequencePreview()" />
          </div>
          <div class="field">
            <label style="color:#38bdf8;">✖️ Multiplicador do Alvo (Padrão x10)</label>
            <input type="number" id="metaTargetMultiplierInput" value="10" min="1" step="0.5" oninput="AdminApp.updateMetaSequencePreview()" />
          </div>
          <div class="field">
            <label style="color:#86efac;">🔢 Nº de Vezes / Estágios (1..15)</label>
            <input type="number" id="metaStageCountInput" value="5" min="1" max="15" oninput="AdminApp.updateMetaSequencePreview()" />
          </div>
        </div>

        <!-- PROVISÓRIO PARA COLLECT_ITEM (Base Inicial de Mochila & Economia Incompleta) -->
        <div id="metaCollectDropBox" style="display:none; background:rgba(245,158,11,0.08); border:1px dashed #f59e0b; border-radius:8px; padding:10px; margin-bottom:10px;">
          <div style="font-size:0.74rem; color:#fde68a; font-weight:700; margin-bottom:6px;">
            ⚠️ Fonte Provisória de Drop para Coleta (Base Inicial Incompleta até o Módulo de Economia/Drops Globais)
          </div>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(170px, 1fr)); gap:8px;">
            <div class="field">
              <label>Quem dropa este item durante a quest?</label>
              <select id="metaDropSourceSelect" onchange="AdminApp.onMetaDropSourceChanged()">
                <option value="SPECIFIC_MONSTER">🐉 Monstro Específico</option>
                <option value="RACE">🐾 Qualquer Monstro da Raça</option>
                <option value="ANY_MONSTER">🌍 Qualquer Monstro em Batalha</option>
              </select>
            </div>
            <div class="field" id="metaDropMonsterField">
              <label>Monstro que dropa</label>
              <select id="metaDropMonsterSelect"></select>
            </div>
            <div class="field" id="metaDropRaceField" style="display:none;">
              <label>Raça que dropa</label>
              <select id="metaDropRaceSelect"></select>
            </div>
            <div class="field">
              <label>Chance de Drop por Abate (%)</label>
              <input type="number" id="metaDropChanceInput" value="100" min="1" max="100" />
            </div>
          </div>
        </div>

        <!-- 2. TRILHAS DE ESCALADA INDEPENDENTE DAS RECOMPENSAS -->
        <div style="background:#020617; border:1px solid #22c55e; border-radius:8px; padding:10px; margin-bottom:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:8px;">
            <span style="font-size:0.78rem; font-weight:700; color:#86efac;">
              🎁 Seletor de Recompensas & Fórmula de Escalada (Independente do x10 dos Alvos)
            </span>
            <button type="button" class="btn-amber" onclick="AdminApp.generateMetaStageGrid()" style="padding:5px 12px; font-size:0.76rem; font-weight:800;">
              ⚡ Gerar / Recalcular Grade dos Estágios
            </button>
          </div>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(215px, 1fr)); gap:8px;">
            <!-- EXP -->
            <div style="border:1px solid #1e293b; border-radius:6px; padding:8px; background:rgba(15,23,42,0.6);">
              <label style="display:flex; align-items:center; gap:6px; font-size:0.75rem; color:#86efac; font-weight:700; margin-bottom:6px;">
                <input type="checkbox" id="metaRewExpEnabled" checked style="width:auto;" /> ✨ Conceder EXP
              </label>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
                <div class="field"><label>Base Est. 1</label><input type="number" id="metaRewExpBase" value="250" min="0" /></div>
                <div class="field"><label>Fator</label><input type="number" id="metaRewExpFactor" value="2.2" min="0" step="0.1" /></div>
              </div>
              <select id="metaRewExpMode" style="margin-top:4px; font-size:0.74rem;">
                <option value="MULTIPLIER">✖️ Multiplicador por Estágio (Ex: x2.2)</option>
                <option value="LINEAR_PCT">📈 Linear % por Estágio (+X%)</option>
                <option value="ADDITIVE">➕ Soma Fixa por Estágio (+X)</option>
              </select>
            </div>
            <!-- GOLD -->
            <div style="border:1px solid #1e293b; border-radius:6px; padding:8px; background:rgba(15,23,42,0.6);">
              <label style="display:flex; align-items:center; gap:6px; font-size:0.75rem; color:#fde047; font-weight:700; margin-bottom:6px;">
                <input type="checkbox" id="metaRewGoldEnabled" checked style="width:auto;" /> 🪙 Conceder Ouro (Carteira)
              </label>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
                <div class="field"><label>Base Est. 1</label><input type="number" id="metaRewGoldBase" value="150" min="0" /></div>
                <div class="field"><label>Fator</label><input type="number" id="metaRewGoldFactor" value="2.0" min="0" step="0.1" /></div>
              </div>
              <select id="metaRewGoldMode" style="margin-top:4px; font-size:0.74rem;">
                <option value="MULTIPLIER">✖️ Multiplicador por Estágio (Ex: x2.0)</option>
                <option value="LINEAR_PCT">📈 Linear % por Estágio (+X%)</option>
                <option value="ADDITIVE">➕ Soma Fixa por Estágio (+X)</option>
              </select>
            </div>
            <!-- STAT POINTS -->
            <div style="border:1px solid #1e293b; border-radius:6px; padding:8px; background:rgba(15,23,42,0.6);">
              <label style="display:flex; align-items:center; gap:6px; font-size:0.75rem; color:#7dd3fc; font-weight:700; margin-bottom:6px;">
                <input type="checkbox" id="metaRewStatEnabled" checked style="width:auto;" /> 📊 Pontos de Atributo
              </label>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
                <div class="field"><label>Base Est. 1</label><input type="number" id="metaRewStatBase" value="2" min="0" /></div>
                <div class="field"><label>Fator</label><input type="number" id="metaRewStatFactor" value="2" min="0" step="0.5" /></div>
              </div>
              <select id="metaRewStatMode" style="margin-top:4px; font-size:0.74rem;">
                <option value="ADDITIVE" selected>➕ Soma Fixa por Estágio (+X)</option>
                <option value="MULTIPLIER">✖️ Multiplicador por Estágio</option>
                <option value="LINEAR_PCT">📈 Linear % por Estágio (+X%)</option>
              </select>
            </div>
            <!-- ITEM REWARD -->
            <div style="border:1px solid #1e293b; border-radius:6px; padding:8px; background:rgba(15,23,42,0.6);">
              <label style="display:flex; align-items:center; gap:6px; font-size:0.75rem; color:#d8b4fe; font-weight:700; margin-bottom:6px;">
                <input type="checkbox" id="metaRewItemEnabled" style="width:auto;" /> 🎒 Conceder Item (Mochila)
              </label>
              <select id="metaRewItemTemplateSelect" style="font-size:0.74rem; margin-bottom:5px;"></select>
              <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:4px;">
                <div class="field"><label>Qtd Base</label><input type="number" id="metaRewItemBase" value="1" min="1" /></div>
                <div class="field"><label>Fator</label><input type="number" id="metaRewItemFactor" value="1" min="0" step="1" /></div>
                <div class="field">
                  <label>Modo</label>
                  <select id="metaRewItemMode" style="font-size:0.7rem;">
                    <option value="ADDITIVE">➕</option>
                    <option value="MULTIPLIER">✖️</option>
                    <option value="LINEAR_PCT">📈%</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 3. GRADE EDITÁVEL DOS ESTÁGIOS ANTES DE SALVAR -->
        <div style="overflow-x:auto; background:#020617; border:1px solid #334155; border-radius:8px; padding:8px;">
          <div style="font-size:0.74rem; color:#fde047; font-weight:700; margin-bottom:6px;">
            ✏️ Grade Editável de Estágios (Edite manualmente qualquer célula antes de clicar em Salvar Quest):
          </div>
          <table class="crud-table" style="font-size:0.74rem;">
            <thead>
              <tr>
                <th>Estágio</th>
                <th>🎯 Meta (Cumulativa)</th>
                <th>✨ EXP</th>
                <th>🪙 Ouro</th>
                <th>📊 Pts Atributo</th>
                <th>🎒 Item Recompensa</th>
                <th>Qtd</th>
                <th>👑 Reborn</th>
              </tr>
            </thead>
            <tbody id="metaStagesTableBody"></tbody>
          </table>
        </div>
      </div>`;
  }

  static attach(app) {
    app.editingMetaStages = [];

    app.toggleMetaQuestUi = function (isMeta) {
      const metaSec = document.getElementById('questMetaBuilderSection');
      const objSec = document.getElementById('questNormalObjectivesSection');
      const rewSec = document.getElementById('questNormalRewardsSection');
      if (metaSec) metaSec.style.display = isMeta ? 'block' : 'none';
      if (objSec) objSec.style.display = isMeta ? 'none' : 'block';
      if (rewSec) rewSec.style.display = isMeta ? 'none' : 'block';
      if (isMeta && (!Array.isArray(this.editingMetaStages) || this.editingMetaStages.length === 0)) {
        this.generateMetaStageGrid();
      }
    };

    app.onMetaTargetTypeChanged = function () {
      const t = document.getElementById('metaTargetTypeSelect')?.value || 'KILL_MONSTER';
      const fMob = document.getElementById('metaTargetMonsterField');
      const fRace = document.getElementById('metaTargetRaceField');
      const fItem = document.getElementById('metaTargetItemField');
      const dropBox = document.getElementById('metaCollectDropBox');
      if (fMob) fMob.style.display = t === 'KILL_MONSTER' ? 'block' : 'none';
      if (fRace) fRace.style.display = t === 'KILL_RACE' ? 'block' : 'none';
      if (fItem) fItem.style.display = t === 'COLLECT_ITEM' ? 'block' : 'none';
      if (dropBox) dropBox.style.display = t === 'COLLECT_ITEM' ? 'block' : 'none';
      this.onMetaDropSourceChanged();
    };

    app.onMetaDropSourceChanged = function () {
      const mode = document.getElementById('metaDropSourceSelect')?.value || 'ANY_MONSTER';
      const dMob = document.getElementById('metaDropMonsterField');
      const dRace = document.getElementById('metaDropRaceField');
      if (dMob) dMob.style.display = mode === 'SPECIFIC_MONSTER' ? 'block' : 'none';
      if (dRace) dRace.style.display = mode === 'RACE' ? 'block' : 'none';
    };

    app.updateMetaSequencePreview = function () {
      const el = document.getElementById('metaTargetSequencePreview');
      if (!el) return;
      const init = Math.max(1, Math.round(Number(document.getElementById('metaInitialCountInput')?.value) || 10));
      const mult = Math.max(1, Number(document.getElementById('metaTargetMultiplierInput')?.value) || 10);
      const count = Math.max(1, Math.min(15, Math.round(Number(document.getElementById('metaStageCountInput')?.value) || 5)));
      const parts = [];
      for (let i = 1; i <= count; i++) {
        parts.push(Math.round(init * Math.pow(mult, i - 1)).toLocaleString('pt-BR'));
      }
      el.textContent = parts.join(' ➔ ');
    };

    app.computeMetaScaledTrack = function (enabledId, baseId, factorId, modeId, stageIndex) {
      if (!document.getElementById(enabledId)?.checked) return 0;
      const base = Math.max(0, Number(document.getElementById(baseId)?.value) || 0);
      const factor = Math.max(0, Number(document.getElementById(factorId)?.value) || 0);
      const mode = document.getElementById(modeId)?.value || 'MULTIPLIER';
      const step = Math.max(0, stageIndex - 1);
      let val = base;
      if (mode === 'MULTIPLIER') val = base * Math.pow(factor > 0 ? factor : 1, step);
      else if (mode === 'LINEAR_PCT') val = base * (1 + (factor / 100) * step);
      else val = base + factor * step;
      return Math.max(0, Math.round(Number.isFinite(val) ? val : 0));
    };

    app.generateMetaStageGrid = function () {
      const init = Math.max(1, Math.round(Number(document.getElementById('metaInitialCountInput')?.value) || 10));
      const mult = Math.max(1, Number(document.getElementById('metaTargetMultiplierInput')?.value) || 10);
      const count = Math.max(1, Math.min(15, Math.round(Number(document.getElementById('metaStageCountInput')?.value) || 5)));
      const itemOn = Boolean(document.getElementById('metaRewItemEnabled')?.checked);
      const baseItemId = itemOn ? (Number(document.getElementById('metaRewItemTemplateSelect')?.value) || null) : null;

      const stages = [];
      for (let s = 1; s <= count; s++) {
        const req = Math.max(1, Math.round(init * Math.pow(mult, s - 1)));
        const itemQty = baseItemId
          ? Math.max(1, this.computeMetaScaledTrack('metaRewItemEnabled', 'metaRewItemBase', 'metaRewItemFactor', 'metaRewItemMode', s))
          : 0;
        stages.push({
          stageIndex: s,
          requiredCount: req,
          rewardExp: this.computeMetaScaledTrack('metaRewExpEnabled', 'metaRewExpBase', 'metaRewExpFactor', 'metaRewExpMode', s),
          rewardGold: this.computeMetaScaledTrack('metaRewGoldEnabled', 'metaRewGoldBase', 'metaRewGoldFactor', 'metaRewGoldMode', s),
          rewardStatPoints: this.computeMetaScaledTrack('metaRewStatEnabled', 'metaRewStatBase', 'metaRewStatFactor', 'metaRewStatMode', s),
          rewardItemTemplateId: baseItemId,
          rewardItemQuantity: itemQty,
          triggerReborn: false,
        });
      }
      this.editingMetaStages = stages;
      this.updateMetaSequencePreview();
      this.renderMetaStagesGrid();
    };

    app.updateMetaStageCell = function (idx, field, val, isNum = false) {
      const row = this.editingMetaStages[idx];
      if (!row) return;
      if (field === 'triggerReborn') {
        row.triggerReborn = Boolean(val);
      } else if (isNum) {
        row[field] = val === '' || val === null ? null : Math.max(0, Math.round(Number(val) || 0));
      } else {
        row[field] = val;
      }
      if (field === 'rewardItemTemplateId' && !row.rewardItemTemplateId) {
        row.rewardItemQuantity = 0;
      } else if (field === 'rewardItemTemplateId' && row.rewardItemTemplateId && !row.rewardItemQuantity) {
        row.rewardItemQuantity = 1;
        this.renderMetaStagesGrid();
      }
    };

    app.renderMetaStagesGrid = function () {
      const tbody = document.getElementById('metaStagesTableBody');
      if (!tbody) return;
      const itemOptsHtml = (selectedId) =>
        `<option value="">— Nenhum —</option>` +
        (this.itemTemplates || [])
          .map((it) => `<option value="${it.id}" ${Number(selectedId) === Number(it.id) ? 'selected' : ''}>#${it.id} ${it.namePtBr}</option>`)
          .join('');

      tbody.innerHTML = (this.editingMetaStages || [])
        .map(
          (st, i) => `
          <tr>
            <td><strong style="color:#fdba74;">Estágio ${st.stageIndex}</strong></td>
            <td><input type="number" min="1" value="${st.requiredCount}" onchange="AdminApp.updateMetaStageCell(${i}, 'requiredCount', this.value, true)" style="min-width:95px; font-weight:700; color:#fde047;" /></td>
            <td><input type="number" min="0" value="${st.rewardExp}" onchange="AdminApp.updateMetaStageCell(${i}, 'rewardExp', this.value, true)" style="min-width:80px;" /></td>
            <td><input type="number" min="0" value="${st.rewardGold}" onchange="AdminApp.updateMetaStageCell(${i}, 'rewardGold', this.value, true)" style="min-width:80px;" /></td>
            <td><input type="number" min="0" value="${st.rewardStatPoints}" onchange="AdminApp.updateMetaStageCell(${i}, 'rewardStatPoints', this.value, true)" style="min-width:60px;" /></td>
            <td>
              <select onchange="AdminApp.updateMetaStageCell(${i}, 'rewardItemTemplateId', this.value, true)" style="min-width:140px; font-size:0.72rem;">
                ${itemOptsHtml(st.rewardItemTemplateId)}
              </select>
            </td>
            <td><input type="number" min="0" value="${st.rewardItemQuantity || 0}" onchange="AdminApp.updateMetaStageCell(${i}, 'rewardItemQuantity', this.value, true)" style="width:60px;" /></td>
            <td style="text-align:center;"><input type="checkbox" ${st.triggerReborn ? 'checked' : ''} onchange="AdminApp.updateMetaStageCell(${i}, 'triggerReborn', this.checked)" style="width:auto;" /></td>
          </tr>`
        )
        .join('');
    };

    app.populateMetaSelectors = function () {
      const mobOpts = (this.monsterTemplates || [])
        .map((m) => `<option value="${m.id}">#${m.id} ${m.namePtBr} (Rank ${m.rarityTier || 'F'})</option>`)
        .join('');
      const raceList = Array.isArray(this.races) && this.races.length > 0 ? this.races : [
        { code: 'BEAST', namePtBr: 'Selvagem' }, { code: 'DEMON', namePtBr: 'Demônio' },
      ];
      const raceOpts = raceList.map((r) => `<option value="${r.code}">${r.namePtBr || r.code} (${r.code})</option>`).join('');
      const itemOpts = (this.itemTemplates || []).map((i) => `<option value="${i.id}">#${i.id} ${i.namePtBr} (${i.code})</option>`).join('');

      ['metaMonsterSelect', 'metaDropMonsterSelect'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = mobOpts || `<option value="">Sem monstros</option>`;
      });
      ['metaRaceSelect', 'metaDropRaceSelect'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = raceOpts;
      });
      ['metaItemSelect', 'metaRewItemTemplateSelect'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = itemOpts || `<option value="">Cadastre itens primeiro</option>`;
      });
    };

    app.loadMetaConfigIntoForm = function (existingQuest) {
      this.populateMetaSelectors();
      const mc = existingQuest?.metaConfigJson;
      if (mc && typeof mc === 'object') {
        document.getElementById('metaTargetTypeSelect').value = mc.targetType || 'KILL_MONSTER';
        if (mc.monsterTemplateId) document.getElementById('metaMonsterSelect').value = String(mc.monsterTemplateId);
        if (mc.raceCode) document.getElementById('metaRaceSelect').value = mc.raceCode;
        if (mc.itemTemplateId) document.getElementById('metaItemSelect').value = String(mc.itemTemplateId);
        document.getElementById('metaDropSourceSelect').value = mc.dropSourceMode || 'ANY_MONSTER';
        if (mc.dropMonsterTemplateId) document.getElementById('metaDropMonsterSelect').value = String(mc.dropMonsterTemplateId);
        if (mc.dropRaceCode) document.getElementById('metaDropRaceSelect').value = mc.dropRaceCode;
        document.getElementById('metaDropChanceInput').value = String(mc.dropChancePct ?? 100);
        document.getElementById('metaInitialCountInput').value = String(mc.initialRequiredCount ?? 10);
        document.getElementById('metaTargetMultiplierInput').value = String(mc.targetMultiplier ?? 10);
        document.getElementById('metaStageCountInput').value = String(mc.stageCount ?? (mc.stages?.length || 5));

        const rt = mc.rewardTracks || {};
        if (rt.exp) {
          document.getElementById('metaRewExpEnabled').checked = Boolean(rt.exp.enabled);
          document.getElementById('metaRewExpBase').value = String(rt.exp.baseValue ?? 250);
          document.getElementById('metaRewExpFactor').value = String(rt.exp.scaleFactor ?? 2.2);
          document.getElementById('metaRewExpMode').value = rt.exp.scaleMode || 'MULTIPLIER';
        }
        if (rt.gold) {
          document.getElementById('metaRewGoldEnabled').checked = Boolean(rt.gold.enabled);
          document.getElementById('metaRewGoldBase').value = String(rt.gold.baseValue ?? 150);
          document.getElementById('metaRewGoldFactor').value = String(rt.gold.scaleFactor ?? 2.0);
          document.getElementById('metaRewGoldMode').value = rt.gold.scaleMode || 'MULTIPLIER';
        }
        if (rt.statPoints) {
          document.getElementById('metaRewStatEnabled').checked = Boolean(rt.statPoints.enabled);
          document.getElementById('metaRewStatBase').value = String(rt.statPoints.baseValue ?? 2);
          document.getElementById('metaRewStatFactor').value = String(rt.statPoints.scaleFactor ?? 2);
          document.getElementById('metaRewStatMode').value = rt.statPoints.scaleMode || 'ADDITIVE';
        }
        if (rt.item) {
          document.getElementById('metaRewItemEnabled').checked = Boolean(rt.item.enabled);
          if (rt.item.itemTemplateId) document.getElementById('metaRewItemTemplateSelect').value = String(rt.item.itemTemplateId);
          document.getElementById('metaRewItemBase').value = String(rt.item.baseValue ?? 1);
          document.getElementById('metaRewItemFactor').value = String(rt.item.scaleFactor ?? 1);
          document.getElementById('metaRewItemMode').value = rt.item.scaleMode || 'ADDITIVE';
        }
        this.editingMetaStages = JSON.parse(JSON.stringify(mc.stages || []));
      } else {
        document.getElementById('metaTargetTypeSelect').value = 'KILL_MONSTER';
        document.getElementById('metaInitialCountInput').value = '10';
        document.getElementById('metaTargetMultiplierInput').value = '10';
        document.getElementById('metaStageCountInput').value = '5';
        document.getElementById('metaRewExpEnabled').checked = true;
        document.getElementById('metaRewGoldEnabled').checked = true;
        document.getElementById('metaRewStatEnabled').checked = true;
        document.getElementById('metaRewItemEnabled').checked = false;
        this.generateMetaStageGrid();
      }
      this.onMetaTargetTypeChanged();
      this.updateMetaSequencePreview();
      this.renderMetaStagesGrid();
    };

    app.buildMetaConfigDtoFromForm = function () {
      const readTrack = (eId, bId, fId, mId, itemSelId = null) => ({
        enabled: Boolean(document.getElementById(eId)?.checked),
        baseValue: Math.max(0, Number(document.getElementById(bId)?.value) || 0),
        scaleFactor: Math.max(0, Number(document.getElementById(fId)?.value) || 0),
        scaleMode: document.getElementById(mId)?.value || 'MULTIPLIER',
        itemTemplateId: itemSelId ? (Number(document.getElementById(itemSelId)?.value) || null) : null,
      });
      return {
        targetType: document.getElementById('metaTargetTypeSelect')?.value || 'KILL_MONSTER',
        monsterTemplateId: Number(document.getElementById('metaMonsterSelect')?.value) || null,
        raceCode: document.getElementById('metaRaceSelect')?.value || null,
        itemTemplateId: Number(document.getElementById('metaItemSelect')?.value) || null,
        dropSourceMode: document.getElementById('metaDropSourceSelect')?.value || 'ANY_MONSTER',
        dropMonsterTemplateId: Number(document.getElementById('metaDropMonsterSelect')?.value) || null,
        dropRaceCode: document.getElementById('metaDropRaceSelect')?.value || null,
        dropChancePct: Math.max(1, Math.min(100, Number(document.getElementById('metaDropChanceInput')?.value) || 100)),
        initialRequiredCount: Math.max(1, Math.round(Number(document.getElementById('metaInitialCountInput')?.value) || 10)),
        targetMultiplier: Math.max(1, Number(document.getElementById('metaTargetMultiplierInput')?.value) || 10),
        stageCount: Math.max(1, Math.min(15, Math.round(Number(document.getElementById('metaStageCountInput')?.value) || 5))),
        rewardTracks: {
          exp: readTrack('metaRewExpEnabled', 'metaRewExpBase', 'metaRewExpFactor', 'metaRewExpMode'),
          gold: readTrack('metaRewGoldEnabled', 'metaRewGoldBase', 'metaRewGoldFactor', 'metaRewGoldMode'),
          statPoints: readTrack('metaRewStatEnabled', 'metaRewStatBase', 'metaRewStatFactor', 'metaRewStatMode'),
          item: readTrack('metaRewItemEnabled', 'metaRewItemBase', 'metaRewItemFactor', 'metaRewItemMode', 'metaRewItemTemplateSelect'),
        },
        stages: this.editingMetaStages || [],
      };
    };
  }
}

window.AdminMetaQuestsPanel = AdminMetaQuestsPanel;
