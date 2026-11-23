/**
 * @file apps/server/public/admin/js/AdminQuestStepsEditor.js
 * @module @etheria/server
 * @description Submódulo No-Code do Estúdio de Quests (`/admin`) para:
 *   1. Coeficientes de XP e Ouro (Global em lote na aba Quests e individual por Quest).
 *   2. Modo de XP Dinâmico por Porcentagem de Faixa de Nível (ex: Nv. 1 -> Nv. 10 lido da tabela de XP).
 *   3. Checklist Sequencial e Configuração de Fala/Botão/Ação por Etapa de NPC.
 */

class AdminQuestStepsEditor {
  static attach(app) {
    setTimeout(() => this.injectControlsIntoAdminDom(), 0);

    app.applyGlobalQuestCoefficients = async function () {
      const expC = Number(document.getElementById('globalQuestExpCoefInput')?.value);
      const goldC = Number(document.getElementById('globalQuestGoldCoefInput')?.value);
      if (!Number.isFinite(expC) || expC < 0 || !Number.isFinite(goldC) || goldC < 0) {
        alert('Informe coeficientes numéricos válidos (ex: 1, 1.5, 2, 0.5).');
        return;
      }
      if (!confirm(`Aplicar Coeficiente de XP = ${expC}x e Ouro = ${goldC}x em todas as Quests narrativas (mantendo Quests META intactas)?`)) {
        return;
      }
      try {
        const res = await this.api('/api/admin/quest-templates/coefficients', {
          method: 'POST',
          body: JSON.stringify({ expCoefficient: expC, goldCoefficient: goldC, includeMeta: false }),
        });
        await this.loadQuestTemplates();
        alert(`✅ Coeficientes atualizados em ${res.updatedCount || 0} quest(s)!`);
      } catch (err) {
        alert(`Erro ao aplicar coeficientes: ${err.message}`);
      }
    };

    app.loadQuestCoefficientsAndStepsIntoForm = function (existing) {
      AdminQuestStepsEditor.injectControlsIntoAdminDom();
      const rew = existing?.rewardsJson || {};
      const trig = existing?.triggerConfigJson || {};

      const setVal = (id, v) => {
        const el = document.getElementById(id);
        if (el) el.value = String(v);
      };

      setVal('questExpCoefInput', existing?.expCoefficient ?? 1.0);
      setVal('questGoldCoefInput', existing?.goldCoefficient ?? 1.0);
      setVal('questExpModeSelect', rew.expMode || 'FIXED');
      setVal('questExpFromLvInput', rew.expTargetLevelFrom ?? 1);
      setVal('questExpToLvInput', rew.expTargetLevelTo ?? 10);
      setVal('questExpRangePctInput', rew.expRangePct ?? 100);
      setVal('questSequentialSelect', trig.sequentialObjectives ? 'true' : 'false');
      setVal('questAcceptBtnLabelInput', trig.acceptButtonLabelPtBr || '');
      setVal('questTurnInBtnLabelInput', trig.turnInButtonLabelPtBr || '');

      this.onQuestExpModeChanged();
    };

    app.onQuestExpModeChanged = function () {
      const mode = document.getElementById('questExpModeSelect')?.value || 'FIXED';
      const wrap = document.getElementById('questExpRangeFieldsWrap');
      if (wrap) wrap.style.display = mode === 'LEVEL_RANGE_PCT' ? 'grid' : 'none';
    };

    app.applyCoefficientsAndStepsToDto = function (dto) {
      const expC = Number(document.getElementById('questExpCoefInput')?.value);
      const goldC = Number(document.getElementById('questGoldCoefInput')?.value);
      dto.expCoefficient = Number.isFinite(expC) && expC >= 0 ? expC : 1.0;
      dto.goldCoefficient = Number.isFinite(goldC) && goldC >= 0 ? goldC : 1.0;

      dto.triggerConfigJson = dto.triggerConfigJson || {};
      dto.triggerConfigJson.sequentialObjectives = document.getElementById('questSequentialSelect')?.value === 'true';
      const accLbl = (document.getElementById('questAcceptBtnLabelInput')?.value || '').trim();
      const turnLbl = (document.getElementById('questTurnInBtnLabelInput')?.value || '').trim();
      dto.triggerConfigJson.acceptButtonLabelPtBr = accLbl || null;
      dto.triggerConfigJson.turnInButtonLabelPtBr = turnLbl || null;

      dto.rewardsJson = dto.rewardsJson || {};
      const expMode = document.getElementById('questExpModeSelect')?.value || 'FIXED';
      dto.rewardsJson.expMode = expMode;
      if (expMode === 'LEVEL_RANGE_PCT') {
        dto.rewardsJson.expTargetLevelFrom = Math.max(1, Number(document.getElementById('questExpFromLvInput')?.value) || 1);
        dto.rewardsJson.expTargetLevelTo = Math.max(2, Number(document.getElementById('questExpToLvInput')?.value) || 10);
        dto.rewardsJson.expRangePct = Math.max(0, Number(document.getElementById('questExpRangePctInput')?.value) || 0);
      }
      return dto;
    };

    app.renderObjectiveStepExtraHtml = function (obj, idx) {
      const hasStep = Boolean(obj.stepActionType || obj.stepDialoguePtBr || obj.stepButtonLabelPtBr || obj.stepExpSharePct);
      const actType = obj.stepActionType || 'DIALOGUE';
      const grantStr = Array.isArray(obj.stepGrantItemIds) ? obj.stepGrantItemIds.join(', ') : '';
      const equipStr = Array.isArray(obj.requireEquipItemIds) ? obj.requireEquipItemIds.join(', ') : '';

      return `
        <details ${hasStep ? 'open' : ''} style="grid-column:1 / -1; margin-top:6px; background:rgba(15,23,42,0.85); border:1px dashed #38bdf8; border-radius:6px; padding:6px 8px;">
          <summary style="cursor:pointer; font-size:0.72rem; color:#7dd3fc; font-weight:700;">
            🧩 Configuração Interativa da Etapa (Modal do NPC, Botão, Ação e % XP da Etapa)
          </summary>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(170px, 1fr)); gap:8px; margin-top:8px;">
            <div>
              <label style="font-size:0.69rem; color:#fde047;">Rótulo no Checklist</label>
              <input type="text" value="${String(obj.labelPtBr || '').replace(/"/g, '&quot;')}" placeholder="Ex: Falar com o Sábio" onchange="AdminApp.updateVisualQuestObjectiveField(${idx}, 'labelPtBr', this.value, false)" />
            </div>
            <div>
              <label style="font-size:0.69rem; color:#fde047;">Tipo de Ação da Etapa</label>
              <select onchange="AdminApp.updateVisualQuestObjectiveField(${idx}, 'stepActionType', this.value, false)">
                <option value="DIALOGUE" ${actType === 'DIALOGUE' ? 'selected' : ''}>💬 Diálogo + Confirmação</option>
                <option value="GRANT_AND_EQUIP" ${actType === 'GRANT_AND_EQUIP' ? 'selected' : ''}>🛡️ Entregar & Exigir Equipar</option>
                <option value="CHOOSE_PETS" ${actType === 'CHOOSE_PETS' ? 'selected' : ''}>🐾 Escolher Companheiros (Pets)</option>
                <option value="QUEST_BATTLE" ${actType === 'QUEST_BATTLE' ? 'selected' : ''}>⚔️ Batalha de Treino no Véu</option>
              </select>
            </div>
            <div>
              <label style="font-size:0.69rem; color:#86efac;">Texto do Botão do Modal</label>
              <input type="text" value="${String(obj.stepButtonLabelPtBr || '').replace(/"/g, '&quot;')}" placeholder="Ex: Compreendido" onchange="AdminApp.updateVisualQuestObjectiveField(${idx}, 'stepButtonLabelPtBr', this.value, false)" />
            </div>
            <div>
              <label style="font-size:0.69rem; color:#38bdf8;">% XP da Faixa ao Concluir Etapa</label>
              <input type="number" step="1" min="0" max="100" value="${Number(obj.stepExpSharePct || 0)}" onchange="AdminApp.updateVisualQuestObjectiveField(${idx}, 'stepExpSharePct', this.value, true)" />
            </div>
          </div>
          <div style="margin-top:6px;">
            <label style="font-size:0.69rem; color:#cbd5e1;">Fala do NPC nesta Etapa (PT-BR)</label>
            <textarea rows="2" style="width:100%;" onchange="AdminApp.updateVisualQuestObjectiveField(${idx}, 'stepDialoguePtBr', this.value, false)">${String(obj.stepDialoguePtBr || '')}</textarea>
          </div>
          ${
            actType === 'GRANT_AND_EQUIP'
              ? `<div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:6px;">
                  <div>
                    <label style="font-size:0.69rem; color:#5eead4;">IDs de Itens Entregues (vírgula)</label>
                    <input type="text" value="${grantStr}" placeholder="Ex: 45, 46, 47, 48, 49, 50, 55, 56" onchange="AdminApp.updateObjectiveIdList(${idx}, 'stepGrantItemIds', this.value)" />
                  </div>
                  <div>
                    <label style="font-size:0.69rem; color:#fde047;">IDs Obrigatórios Equipar (vírgula)</label>
                    <input type="text" value="${equipStr}" placeholder="Ex: 45, 46, 47, 48, 49, 50, 55, 56" onchange="AdminApp.updateObjectiveIdList(${idx}, 'requireEquipItemIds', this.value)" />
                  </div>
                </div>`
              : ''
          }
          ${
            actType === 'CHOOSE_PETS'
              ? `<div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:6px;">
                  <div>
                    <label style="font-size:0.69rem; color:#fde047;">Rank Permitido</label>
                    <input type="text" value="${obj.stepPetRank || 'F'}" onchange="AdminApp.updateVisualQuestObjectiveField(${idx}, 'stepPetRank', this.value, false)" />
                  </div>
                  <div>
                    <label style="font-size:0.69rem; color:#fde047;">Qtd Companheiros Diferentes</label>
                    <input type="number" min="1" max="3" value="${Number(obj.stepPetPickCount || 2)}" onchange="AdminApp.updateVisualQuestObjectiveField(${idx}, 'stepPetPickCount', this.value, true)" />
                  </div>
                </div>`
              : ''
          }
        </details>
      `;
    };

    app.updateObjectiveIdList = function (idx, field, csvStr) {
      const obj = this.editingQuestObjectives[idx];
      if (!obj) return;
      obj[field] = String(csvStr || '')
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isInteger(n) && n > 0);
    };
  }

  static injectControlsIntoAdminDom() {
    // 1. Barra Global de Coeficientes de XP e Ouro no topo da aba Quests
    const tabQuests = document.getElementById('tabQuests');
    if (tabQuests && !document.getElementById('globalQuestCoefficientsBar')) {
      const bar = document.createElement('div');
      bar.id = 'globalQuestCoefficientsBar';
      bar.style.cssText = 'display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; background:rgba(15,23,42,0.92); border:1.5px solid #22c55e; border-radius:10px; padding:10px 14px; margin-bottom:12px;';
      bar.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:2px;">
          <strong style="color:#86efac; font-size:0.84rem;">⚖️ Coeficientes Globais de XP e Ouro das Quests</strong>
          <span style="font-size:0.72rem; color:#94a3b8;">Padrão <code>1.0</code>. Ex: <code>2.0</code> dobra automaticamente XP/Ouro; <code>0.5</code> reduz à metade. (Não altera Quests META).</span>
        </div>
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <label style="font-size:0.74rem; color:#38bdf8; font-weight:700;">Coef. XP:
            <input type="number" id="globalQuestExpCoefInput" step="0.05" min="0" value="1" style="width:78px; margin-left:4px;" />
          </label>
          <label style="font-size:0.74rem; color:#fde047; font-weight:700;">Coef. Ouro:
            <input type="number" id="globalQuestGoldCoefInput" step="0.05" min="0" value="1" style="width:78px; margin-left:4px;" />
          </label>
          <button type="button" class="btn-success" style="padding:6px 12px; font-size:0.76rem; font-weight:800;" onclick="AdminApp.applyGlobalQuestCoefficients()">
            ⚡ Aplicar em Lote
          </button>
        </div>
      `;
      const drawWrap = document.getElementById('questsDrawIoWrapper');
      if (drawWrap && drawWrap.parentNode) {
        drawWrap.parentNode.insertBefore(bar, drawWrap);
      }
    }

    // 2. Campos de Checklist Sequencial e Botões Customizados no bloco de Objetivos
    const objSec = document.getElementById('questNormalObjectivesSection');
    if (objSec && !document.getElementById('questSequentialControlsRow')) {
      const row = document.createElement('div');
      row.id = 'questSequentialControlsRow';
      row.style.cssText = 'display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:8px; margin-bottom:10px; padding:8px; background:rgba(2,6,23,0.7); border-radius:8px; border:1px solid #1e3a5f;';
      row.innerHTML = `
        <div class="field">
          <label style="color:#38bdf8; font-weight:700;">📋 Checklist em Ordem Estrita?</label>
          <select id="questSequentialSelect">
            <option value="false">Não (Ordem livre)</option>
            <option value="true">✅ Sim (Etapa 1 ➔ 2 ➔ 3...)</option>
          </select>
        </div>
        <div class="field">
          <label style="color:#86efac;">Botão de Aceitar (Opcional)</label>
          <input type="text" id="questAcceptBtnLabelInput" placeholder="Ex: Iniciar Preparação" />
        </div>
        <div class="field">
          <label style="color:#fde047;">Botão de Concluir (Opcional)</label>
          <input type="text" id="questTurnInBtnLabelInput" placeholder="Ex: Receber Título e Concluir" />
        </div>
      `;
      const container = document.getElementById('questVisualObjectivesContainer');
      if (container) objSec.insertBefore(row, container);
    }

    // 3. Campos de Coeficiente de XP/Ouro + Modo Faixa de Nível no bloco de Recompensas
    const rewSec = document.getElementById('questNormalRewardsSection');
    if (rewSec && !document.getElementById('questCoefficientsModalRow')) {
      const row = document.createElement('div');
      row.id = 'questCoefficientsModalRow';
      row.style.cssText = 'margin-top:10px; padding-top:10px; border-top:1px dashed #334155; display:flex; flex-direction:column; gap:8px;';
      row.innerHTML = `
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:10px;">
          <div class="field">
            <label style="color:#38bdf8; font-weight:800;">⚖️ Coeficiente de XP</label>
            <input type="number" id="questExpCoefInput" step="0.05" min="0" value="1" />
          </div>
          <div class="field">
            <label style="color:#fde047; font-weight:800;">⚖️ Coeficiente de Ouro</label>
            <input type="number" id="questGoldCoefInput" step="0.05" min="0" value="1" />
          </div>
          <div class="field">
            <label style="color:#c084fc; font-weight:700;">📈 Modo de Cálculo de XP</label>
            <select id="questExpModeSelect" onchange="AdminApp.onQuestExpModeChanged()">
              <option value="FIXED">Valor Fixo × Coef. XP</option>
              <option value="LEVEL_RANGE_PCT">% da Tabela de XP (Nível A ➔ B) × Coef.</option>
            </select>
          </div>
        </div>
        <div id="questExpRangeFieldsWrap" style="display:none; grid-template-columns:repeat(3, 1fr); gap:10px; background:rgba(2,6,23,0.7); padding:8px; border-radius:8px; border:1px solid #6366f1;">
          <div class="field"><label>Nível Inicial</label><input type="number" id="questExpFromLvInput" min="1" value="1" /></div>
          <div class="field"><label>Nível Alvo</label><input type="number" id="questExpToLvInput" min="2" value="10" /></div>
          <div class="field"><label>% da Faixa na Entrega Final</label><input type="number" id="questExpRangePctInput" min="0" max="100" value="20" /></div>
        </div>
      `;
      rewSec.appendChild(row);
    }
  }
}

window.AdminQuestStepsEditor = AdminQuestStepsEditor;
