/**
 * @file apps/server/public/admin/js/AdminAttributesTab.js
 * @module @etheria/server
 * @description Submódulo da Aba Atributos & Conversões (`base_attributes`, `combat_attributes`,
 *   `attribute_conversions`) da Rota `/admin`.
 *   - Permite visualizar e editar os Atributos Base, Atributos de Combate e a Matriz de Conversão Procedural.
 *   - Agrupa os 21 Atributos de Combate por famílias (Vitais, Ofensivos/Defensivos, Acerto/Desvio, Controle, Anomalias).
 *   - Fornece a função universal `calculateCombatAttributes(baseAttrs)` compartilhada com a aba de Personagens.
 */

class AdminAttributesTab {
  static attach(app) {
    app.attributesData = {
      baseAttributes: [],
      combatAttributes: [],
      attributeConversions: [],
    };

    AdminAttributesTab.injectTabDom();

    app.loadAttributesData = async function () {
      try {
        const data = await this.api('/api/admin/attributes');
        this.attributesData = data || {
          baseAttributes: [],
          combatAttributes: [],
          attributeConversions: [],
        };
        this.renderAttributesTabContent();
      } catch (err) {
        console.error('Falha ao carregar Atributos e Conversões:', err);
      }
    };

    /**
     * Calcula a ficha de Atributos de Combate a partir dos 6 Atributos Base
     * utilizando a base padrão (`baseDefault`) e a matriz de conversão ativa (`attributeConversions`).
     */
    app.calculateCombatAttributes = function (baseAttrs = {}, customCombatBases = {}) {
      const combatAttrs = this.attributesData?.combatAttributes || [];
      const conversions = this.attributesData?.attributeConversions || [];

      const result = {};
      for (const ca of combatAttrs) {
        const baseDef = (customCombatBases && customCombatBases[ca.code] !== undefined)
          ? Number(customCombatBases[ca.code])
          : (Number(ca.baseDefault) || 0);
        let bonus = 0;
        for (const conv of conversions) {
          if (conv.combatAttributeCode === ca.code) {
            const baseVal = Number(baseAttrs[conv.baseAttributeCode]) || 0;
            bonus += baseVal * (Number(conv.ratioPerPoint) || 0);
          }
        }
        let finalVal = baseDef + bonus;
        if (ca.code === 'BATTLE_MOVE_SPEED') {
          const cap = baseDef * 1.40; // Teto rigoroso de 40% de aumento na velocidade de batalha
          if (finalVal > cap) finalVal = cap;
        }
        result[ca.code] = {
          code: ca.code,
          namePtBr: ca.namePtBr,
          baseDefault: baseDef,
          bonusFromAttrs: bonus,
          isPercentage: Boolean(ca.isPercentage),
          value: finalVal,
        };
      }
      return result;
    };

    app.renderAttributesTabContent = function () {
      this.renderBaseAttributesList();
      this.renderCombatAttributesTable();
      this.renderConversionsMatrix();
    };

    app.renderBaseAttributesList = function () {
      const container = document.getElementById('baseAttributesCardsContainer');
      if (!container) return;

      const baseList = this.attributesData.baseAttributes || [];
      container.innerHTML = baseList
        .map((ba) => {
          const relatedConvs = (this.attributesData.attributeConversions || []).filter(
            (c) => c.baseAttributeCode === ba.code
          );
          const effectsList = relatedConvs
            .map((c) => {
              const ca = (this.attributesData.combatAttributes || []).find((x) => x.code === c.combatAttributeCode);
              const caName = ca ? ca.namePtBr : c.combatAttributeCode;
              const ratioStr = ca?.isPercentage
                ? `+${(c.ratioPerPoint * 100).toFixed(2)}%`
                : `+${c.ratioPerPoint}`;
              return `<span style="display:inline-block; margin:2px 4px 2px 0; padding:1px 6px; background:rgba(56,189,248,0.12); border:1px solid #38bdf8; border-radius:4px; font-size:0.7rem; color:#7dd3fc;">${caName}: <strong>${ratioStr}</strong>/pt</span>`;
            })
            .join(' ');

          return `
          <div style="background:rgba(15,23,42,0.85); border:1px solid var(--border); border-radius:8px; padding:10px; display:flex; flex-direction:column; gap:4px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <strong style="color:#fde047; font-size:0.88rem;">${ba.namePtBr} <span style="color:var(--text-muted); font-size:0.75rem;">(${ba.code})</span></strong>
            </div>
            <div style="font-size:0.72rem; color:var(--text-muted); line-height:1.35;">${ba.descriptionPtBr}</div>
            <div style="margin-top:4px;">${effectsList || '<span style="font-size:0.7rem; color:var(--text-muted);">Sem conversões ativas</span>'}</div>
          </div>`;
        })
        .join('');
    };

    app.renderCombatAttributesTable = function () {
      const tbody = document.getElementById('combatAttributesTableBody');
      if (!tbody) return;

      const combatList = this.attributesData.combatAttributes || [];
      const getFamilyBadge = (code) => {
        if (['MAX_HP', 'MAX_MP', 'HEAL_POWER', 'MP_REGEN'].includes(code)) {
          return '<span style="padding:2px 6px; border-radius:4px; background:rgba(34,197,94,0.15); color:#86efac; font-size:0.68rem; font-weight:700;">💚 Recursos</span>';
        }
        if (['PHYS_ATK', 'MAG_ATK', 'PHYS_DEF', 'MAG_DEF', 'PHYS_PEN', 'MAG_PEN'].includes(code)) {
          return '<span style="padding:2px 6px; border-radius:4px; background:rgba(239,68,68,0.15); color:#fca5a5; font-size:0.68rem; font-weight:700;">🗡️ Ofensivo/Defensivo</span>';
        }
        if (['SPEED', 'CRIT_RATE', 'CRIT_DMG'].includes(code)) {
          return '<span style="padding:2px 6px; border-radius:4px; background:rgba(245,158,11,0.15); color:#fde68a; font-size:0.68rem; font-weight:700;">⚡ Iniciativa / Crítico</span>';
        }
        if (['PHYS_ACCURACY', 'PHYS_EVASION', 'MAG_ACCURACY', 'MAG_EVASION'].includes(code)) {
          return '<span style="padding:2px 6px; border-radius:4px; background:rgba(56,189,248,0.15); color:#7dd3fc; font-size:0.68rem; font-weight:700;">🎯 Acerto / Desvio</span>';
        }
        if (['CONTROL_HIT', 'CONTROL_RESIST'].includes(code)) {
          return '<span style="padding:2px 6px; border-radius:4px; background:rgba(192,132,252,0.15); color:#d8b4fe; font-size:0.68rem; font-weight:700;">💫 Controle (Hard CC)</span>';
        }
        if (['ANOMALY_HIT', 'ANOMALY_RESIST'].includes(code)) {
          return '<span style="padding:2px 6px; border-radius:4px; background:rgba(244,63,94,0.15); color:#fda4af; font-size:0.68rem; font-weight:700;">🧪 Anomalias / DoT</span>';
        }
        return '<span style="font-size:0.68rem; color:var(--text-muted);">Geral</span>';
      };

      tbody.innerHTML = combatList
        .map((ca) => {
          const formatVal = ca.isPercentage
            ? `${(ca.baseDefault * 100).toFixed(1)}% (${ca.baseDefault})`
            : `${ca.baseDefault}`;

          return `
          <tr>
            <td><strong>${ca.namePtBr}</strong></td>
            <td><code>${ca.code}</code></td>
            <td>${getFamilyBadge(ca.code)}</td>
            <td>
              <input type="number" step="${ca.isPercentage ? '0.01' : '1'}" id="combatBaseDefault_${ca.code}" value="${ca.baseDefault}" style="width:85px; padding:3px 6px; font-size:0.75rem;" />
              <span style="font-size:0.7rem; color:var(--text-muted); margin-left:4px;">${ca.isPercentage ? '(Em decimal: 0.05 = 5%)' : ''}</span>
            </td>
            <td>
              <span style="padding:2px 6px; border-radius:4px; background:${ca.isPercentage ? 'rgba(56,189,248,0.15)' : 'rgba(148,163,184,0.15)'}; color:${ca.isPercentage ? '#38bdf8' : '#94a3b8'}; font-size:0.7rem; font-weight:700;">
                ${ca.isPercentage ? 'Porcentagem (%)' : 'Numérico Fixo'}
              </span>
            </td>
            <td>
              <button class="btn-primary" onclick="AdminApp.saveCombatAttributeBase('${ca.code}')" style="padding:3px 8px; font-size:0.72rem;">💾 Salvar</button>
            </td>
          </tr>`;
        })
        .join('');
    };

    app.renderConversionsMatrix = function () {
      const container = document.getElementById('conversionsMatrixContainer');
      if (!container) return;

      const baseList = this.attributesData.baseAttributes || [];
      const combatList = this.attributesData.combatAttributes || [];
      const conversions = this.attributesData.attributeConversions || [];

      container.innerHTML = baseList
        .map((ba) => {
          const baseConvs = conversions.filter((c) => c.baseAttributeCode === ba.code);
          const rowsHtml = baseConvs
            .map((c) => {
              const ca = combatList.find((x) => x.code === c.combatAttributeCode);
              const caName = ca ? ca.namePtBr : c.combatAttributeCode;
              const unitHint = ca?.isPercentage ? '(Ex: 0.002 = +0.20%)' : '(Pontos fixos)';
              return `
              <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; padding:4px 6px; background:#020617; border:1px solid var(--border); border-radius:6px;">
                <div style="flex:1; font-size:0.76rem;">
                  <strong>${caName}</strong> <code style="color:var(--text-muted); font-size:0.68rem;">[${c.combatAttributeCode}]</code>
                </div>
                <div style="display:flex; align-items:center; gap:4px;">
                  <span style="font-size:0.68rem; color:var(--text-muted);">${unitHint}</span>
                  <input type="number" step="0.0001" class="conv-ratio-input" data-base="${ba.code}" data-combat="${c.combatAttributeCode}" value="${c.ratioPerPoint}" style="width:78px; padding:3px 6px; font-size:0.76rem;" />
                  <button type="button" class="btn-danger" onclick="AdminApp.removeConversionPair('${ba.code}', '${c.combatAttributeCode}')" style="padding:2px 6px; font-size:0.68rem;">✕</button>
                </div>
              </div>`;
            })
            .join('');

          // Select para adicionar nova conversão a este atributo base
          const unusedCombatAttrs = combatList.filter(
            (ca) => !baseConvs.some((c) => c.combatAttributeCode === ca.code)
          );
          const addOptions = unusedCombatAttrs
            .map((ca) => `<option value="${ca.code}">${ca.namePtBr} (${ca.code})</option>`)
            .join('');

          const addFormHtml =
            unusedCombatAttrs.length > 0
              ? `<div style="display:flex; gap:6px; align-items:center; margin-top:6px; padding-top:6px; border-top:1px dashed var(--border);">
                   <select id="addConvSelect_${ba.code}" style="flex:1; padding:3px 6px; font-size:0.72rem;">
                     ${addOptions}
                   </select>
                   <input type="number" step="0.001" id="addConvRatio_${ba.code}" placeholder="Taxa" value="1.0" style="width:65px; padding:3px; font-size:0.74rem;" />
                   <button type="button" class="btn-primary" onclick="AdminApp.addNewConversionPair('${ba.code}')" style="padding:3px 8px; font-size:0.72rem;">➕ Add</button>
                 </div>`
              : '';

          return `
          <div style="background:rgba(15,23,42,0.85); border:1.5px solid #334155; border-radius:8px; padding:10px; display:flex; flex-direction:column; gap:6px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <strong style="color:#fde047; font-size:0.86rem;">⚡ 1 Ponto de ${ba.namePtBr} (${ba.code}) concede:</strong>
              <span style="font-size:0.7rem; color:var(--text-muted);">${baseConvs.length} conversão(ões)</span>
            </div>
            <div style="display:flex; flex-direction:column; gap:4px;">
              ${rowsHtml || '<div style="font-size:0.72rem; color:var(--text-muted);">Nenhuma conversão vinculada.</div>'}
            </div>
            ${addFormHtml}
          </div>`;
        })
        .join('');
    };

    app.saveCombatAttributeBase = async function (code) {
      try {
        const input = document.getElementById(`combatBaseDefault_${code}`);
        const baseDefault = Number(input?.value) || 0;
        await this.api(`/api/admin/attributes/combat/${code}`, {
          method: 'PUT',
          body: JSON.stringify({ baseDefault }),
        });
        await this.loadAttributesData();
      } catch (err) {
        alert(`Erro ao salvar atributo de combate ${code}: ${err.message}`);
      }
    };

    app.saveAllConversionsMatrix = async function () {
      try {
        const inputs = Array.from(document.querySelectorAll('.conv-ratio-input'));
        const payload = inputs.map((inp) => ({
          baseAttributeCode: inp.getAttribute('data-base'),
          combatAttributeCode: inp.getAttribute('data-combat'),
          ratioPerPoint: Number(inp.value) || 0,
        }));

        await this.api('/api/admin/attributes/conversions', {
          method: 'PUT',
          body: JSON.stringify(payload),
        });

        alert('✅ Matriz de Conversões salva com sucesso no banco de dados e sincronizada no snapshot!');
        await this.loadAttributesData();
      } catch (err) {
        alert(`Erro ao salvar matriz de conversões: ${err.message}`);
      }
    };

    app.addNewConversionPair = async function (baseCode) {
      try {
        const sel = document.getElementById(`addConvSelect_${baseCode}`);
        const rat = document.getElementById(`addConvRatio_${baseCode}`);
        if (!sel || !rat) return;

        const combatCode = sel.value;
        const ratioPerPoint = Number(rat.value) || 0;

        await this.api('/api/admin/attributes/conversions/single', {
          method: 'PUT',
          body: JSON.stringify({
            baseAttributeCode: baseCode,
            combatAttributeCode: combatCode,
            ratioPerPoint,
          }),
        });

        await this.loadAttributesData();
      } catch (err) {
        alert(`Erro ao adicionar conversão: ${err.message}`);
      }
    };

    app.removeConversionPair = async function (baseCode, combatCode) {
      if (!confirm(`Remover a conversão de ${baseCode} -> ${combatCode}?`)) return;
      try {
        await this.api('/api/admin/attributes/conversions/single', {
          method: 'PUT',
          body: JSON.stringify({
            baseAttributeCode: baseCode,
            combatAttributeCode: combatCode,
            ratioPerPoint: 0,
          }),
        });
        await this.loadAttributesData();
      } catch (err) {
        alert(`Erro ao remover conversão: ${err.message}`);
      }
    };
  }

  static injectTabDom() {
    const navTabs = document.querySelector('.nav-tabs');
    const btnMonsters = document.getElementById('tabBtnMonsters');
    if (navTabs && !document.getElementById('tabBtnAttributes')) {
      const btnAttr = document.createElement('button');
      btnAttr.id = 'tabBtnAttributes';
      btnAttr.onclick = () => window.AdminApp.switchTab('attributes');
      btnAttr.textContent = '📊 Atributos & Conversões';

      if (btnMonsters && btnMonsters.nextSibling) {
        navTabs.insertBefore(btnAttr, btnMonsters.nextSibling);
      } else {
        navTabs.appendChild(btnAttr);
      }
    }

    const adminAppEl = document.getElementById('adminApp');
    if (adminAppEl && !document.getElementById('tabAttributes')) {
      const panel = document.createElement('div');
      panel.id = 'tabAttributes';
      panel.style.cssText =
        'display:none; padding:16px; max-width:1250px; margin:0 auto; width:100%; gap:16px; flex-direction:column;';
      panel.innerHTML = `
        <div class="panel">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:12px;">
            <div>
              <h3 style="margin:0; color:#38bdf8;">📊 Atributos Base, Combate & Matriz Procedural de Conversões</h3>
              <p style="margin:4px 0 0; font-size:0.8rem; color:var(--text-muted);">
                Defina os 6 Atributos Base, os 21 Atributos de Combate (incluindo Acerto/Desvio, Família de Controle e Anomalias) e quanto cada ponto distribuído gera nos personagens e monstros.
              </p>
            </div>
            <button class="btn-success" onclick="AdminApp.saveAllConversionsMatrix()" style="padding:8px 16px; font-weight:700;">
              💾 Salvar Todas as Conversões
            </button>
          </div>

          <!-- SEÇÃO 1: OS 6 ATRIBUTOS BASE -->
          <div style="margin-bottom:16px;">
            <h4 style="color:#fde047; font-size:0.86rem; margin-bottom:8px;">1️⃣ Os 6 Atributos Base do Personagem (Ficha Primária)</h4>
            <div id="baseAttributesCardsContainer" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:10px;"></div>
          </div>

          <!-- SEÇÃO 2: MATRIZ PROCEDURAL DE CONVERSÕES -->
          <div style="margin-bottom:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <h4 style="color:#38bdf8; font-size:0.86rem; margin:0;">2️⃣ Matriz Procedural de Conversão (1 Atributo Base ➔ Atributos de Combate)</h4>
              <button class="btn-primary" onclick="AdminApp.saveAllConversionsMatrix()" style="padding:4px 10px; font-size:0.75rem;">💾 Salvar Matriz</button>
            </div>
            <div id="conversionsMatrixContainer" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(340px, 1fr)); gap:12px;"></div>
          </div>

          <!-- SEÇÃO 3: TABELA DOS 21 ATRIBUTOS DE COMBATE -->
          <div>
            <h4 style="color:#c084fc; font-size:0.86rem; margin-bottom:8px;">3️⃣ Catálogo dos 21 Atributos Derivados de Combate (Base Padrão & Formato)</h4>
            <div style="overflow-x:auto;">
              <table class="crud-table">
                <thead>
                  <tr>
                    <th>Nome (PT-BR)</th>
                    <th>Código</th>
                    <th>Família / Categoria</th>
                    <th>Valor Base Padrão</th>
                    <th>Formato</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody id="combatAttributesTableBody"></tbody>
              </table>
            </div>
          </div>
        </div>`;
      adminAppEl.appendChild(panel);
    }
  }
}

window.AdminAttributesTab = AdminAttributesTab;
