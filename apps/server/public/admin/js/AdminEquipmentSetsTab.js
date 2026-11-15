/**
 * @file apps/server/public/admin/js/AdminEquipmentSetsTab.js
 * @module @etheria/server
 * @description Módulo de UI para Gestão Oficial de Conjuntos de Equipamentos (`equipment_sets`) na Rota `/admin`.
 *   - Regra de Ativação:
 *     * 100% das Peças (12/12) -> 100% do Bônus de Combate
 *     * 50% das Peças (6/12)   -> 40% do Bônus de Combate
 *     * Permite combinação de 2 conjuntos (6 + 6) resultando em 80% do bônus total combinado.
 *   - Visualização das peças vinculadas, criação, edição e exclusão de conjuntos.
 * @rules Segue estritamente AGENTS.md (Limite < 1.000 linhas, SRP, UI responsiva).
 */

class AdminEquipmentSetsTab {
  static attach(app) {
    app.equipmentSets = [];
    app.equipmentSetSearchQuery = '';
    app.equipmentSetLevelFilter = 'ALL';
    app.equipmentSetRarityFilter = 'ALL';

    AdminEquipmentSetsTab.injectTabAndModalDom();

    app.loadEquipmentSets = async function () {
      try {
        this.equipmentSets = await this.api('/api/admin/equipment-sets');
        this.renderEquipmentSetsCrudTable();
        this.populateEquipmentSetDropdowns?.();
      } catch (err) {
        console.error('Erro ao carregar conjuntos de equipamentos:', err);
      }
    };

    app.filterEquipmentSetsCrudTable = function () {
      const input = document.getElementById('equipSetSearchInput');
      this.equipmentSetSearchQuery = (input ? input.value : '').toLowerCase().trim();
      this.equipmentSetLevelFilter = document.getElementById('equipSetLevelFilterSelect')?.value || 'ALL';
      this.equipmentSetRarityFilter = document.getElementById('equipSetRarityFilterSelect')?.value || 'ALL';
      this.renderEquipmentSetsCrudTable();
    };

    app.openCreateEquipmentSetModal = function () {
      document.getElementById('equipSetEditIdInput').value = '';
      document.getElementById('equipSetCodeInput').value = '';
      document.getElementById('equipSetNameInput').value = '';
      document.getElementById('equipSetDescriptionInput').value = '';
      document.getElementById('equipSetReqLevelInput').value = '40';
      document.getElementById('equipSetRaritySelect').value = 'B';
      document.getElementById('equipSetMinFullInput').value = '12';
      document.getElementById('equipSetMinHalfInput').value = '6';
      document.getElementById('equipSetHalfBonusRatioInput').value = '40';
      document.getElementById('equipSetFullBonusRatioInput').value = '100';
      document.getElementById('equipSetActiveSelect').value = 'true';

      const statKeys = [
        'MAX_HP', 'MAX_MP', 'PHYS_ATK', 'MAG_ATK', 'PHYS_DEF', 'MAG_DEF',
        'BATTLE_MOVE_SPEED', 'ATTACK_SPEED', 'CRIT_RATE', 'CRIT_DMG', 'HEAL_POWER', 'PHYS_PEN', 'MAG_PEN'
      ];
      statKeys.forEach((k) => {
        const el = document.getElementById(`setStat_${k}`);
        if (el) el.value = '';
      });

      document.getElementById('equipSetModalTitle').textContent = '🛡️ Novo Conjunto de Equipamentos';
      AdminApp.openModal('equipmentSetModal');
    };

    app.openEditEquipmentSetModal = async function (id) {
      try {
        const s = await this.api(`/api/admin/equipment-sets/${id}`);
        if (!s) return;

        document.getElementById('equipSetEditIdInput').value = s.id;
        document.getElementById('equipSetCodeInput').value = s.code;
        document.getElementById('equipSetNameInput').value = s.namePtBr;
        document.getElementById('equipSetDescriptionInput').value = s.descriptionPtBr || '';
        document.getElementById('equipSetReqLevelInput').value = s.requiredLevel || 1;
        document.getElementById('equipSetRaritySelect').value = s.rarityTier || 'F';
        document.getElementById('equipSetMinFullInput').value = s.minPiecesFull || 12;
        document.getElementById('equipSetMinHalfInput').value = s.minPiecesHalf || 6;
        document.getElementById('equipSetHalfBonusRatioInput').value = s.halfBonusRatioPct || 40;
        document.getElementById('equipSetFullBonusRatioInput').value = s.fullBonusRatioPct || 100;
        document.getElementById('equipSetActiveSelect').value = s.isActive !== false ? 'true' : 'false';

        const stats = s.bonusCombatStatsJson || {};
        const statKeys = [
          'MAX_HP', 'MAX_MP', 'PHYS_ATK', 'MAG_ATK', 'PHYS_DEF', 'MAG_DEF',
          'BATTLE_MOVE_SPEED', 'ATTACK_SPEED', 'CRIT_RATE', 'CRIT_DMG', 'HEAL_POWER', 'PHYS_PEN', 'MAG_PEN'
        ];
        statKeys.forEach((k) => {
          const el = document.getElementById(`setStat_${k}`);
          if (el) el.value = stats[k] !== undefined && stats[k] !== null ? stats[k] : '';
        });

        document.getElementById('equipSetModalTitle').textContent = `🛡️ Editar Conjunto #${s.id} (${s.code})`;
        AdminApp.openModal('equipmentSetModal');
      } catch (err) {
        alert(`Erro ao carregar conjunto: ${err.message}`);
      }
    };

    app.openViewEquipmentSetPiecesModal = async function (id) {
      try {
        const s = await this.api(`/api/admin/equipment-sets/${id}`);
        if (!s) return;

        const container = document.getElementById('equipmentSetPiecesContainer');
        document.getElementById('equipmentSetViewTitle').textContent = `🛡️ Peças do Conjunto: ${s.namePtBr} (${s.items?.length || 0}/12 Peças)`;

        if (!s.items || s.items.length === 0) {
          container.innerHTML = `<div style="padding:16px; color:#94a3b8; text-align:center;">Nenhuma peça vinculada a este conjunto ainda.</div>`;
        } else {
          container.innerHTML = `
            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:10px;">
              ${s.items.map((it) => {
                const icon = it.mcreworkIconKey || 'assets/equipment/icons/equip_normal_200001.png';
                return `
                  <div style="background:#0f172a; border:1px solid #334155; border-radius:8px; padding:10px; display:flex; align-items:center; gap:10px;">
                    <img src="https://seytanir.github.io/mcrework/${icon.replace(/^\/+/, '')}" style="width:40px; height:40px; object-fit:contain; border-radius:6px; background:#020617; border:1px solid #1e293b;" />
                    <div style="flex:1; overflow:hidden;">
                      <div style="font-size:0.82rem; font-weight:800; color:#fde047; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">${it.namePtBr}</div>
                      <div style="font-size:0.7rem; color:#94a3b8;">Slot: <strong style="color:#38bdf8;">${it.equipmentSlotCode}</strong> &bull; Nv.${it.requiredLevel}</div>
                      <div style="font-size:0.65rem; color:#64748b;">${it.code}</div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `;
        }
        AdminApp.openModal('equipmentSetViewModal');
      } catch (err) {
        alert(`Erro ao visualizar peças do conjunto: ${err.message}`);
      }
    };

    app.saveEquipmentSetTemplate = async function () {
      const editId = document.getElementById('equipSetEditIdInput').value;
      const namePtBr = document.getElementById('equipSetNameInput').value.trim();
      if (!namePtBr) {
        alert('O nome do conjunto em português é obrigatório.');
        return;
      }

      const statKeys = [
        'MAX_HP', 'MAX_MP', 'PHYS_ATK', 'MAG_ATK', 'PHYS_DEF', 'MAG_DEF',
        'BATTLE_MOVE_SPEED', 'ATTACK_SPEED', 'CRIT_RATE', 'CRIT_DMG', 'HEAL_POWER', 'PHYS_PEN', 'MAG_PEN'
      ];
      const bonusCombatStatsJson = {};
      statKeys.forEach((k) => {
        const val = parseFloat(document.getElementById(`setStat_${k}`)?.value);
        if (!isNaN(val) && val !== 0) {
          bonusCombatStatsJson[k] = val;
        }
      });

      const payload = {
        namePtBr,
        code: document.getElementById('equipSetCodeInput').value.trim() || undefined,
        descriptionPtBr: document.getElementById('equipSetDescriptionInput').value.trim() || undefined,
        requiredLevel: parseInt(document.getElementById('equipSetReqLevelInput').value, 10) || 1,
        rarityTier: document.getElementById('equipSetRaritySelect').value || 'F',
        minPiecesFull: parseInt(document.getElementById('equipSetMinFullInput').value, 10) || 12,
        minPiecesHalf: parseInt(document.getElementById('equipSetMinHalfInput').value, 10) || 6,
        halfBonusRatioPct: parseFloat(document.getElementById('equipSetHalfBonusRatioInput').value) || 40.0,
        fullBonusRatioPct: parseFloat(document.getElementById('equipSetFullBonusRatioInput').value) || 100.0,
        isActive: document.getElementById('equipSetActiveSelect').value === 'true',
        bonusCombatStatsJson,
      };

      try {
        if (editId) {
          await this.api(`/api/admin/equipment-sets/${editId}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          });
        } else {
          await this.api('/api/admin/equipment-sets', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
        }
        AdminApp.closeModal('equipmentSetModal');
        await this.loadEquipmentSets();
        if (typeof this.loadEquipments === 'function') {
          this.loadEquipments();
        }
      } catch (err) {
        alert(`Erro ao salvar conjunto: ${err.message}`);
      }
    };

    app.deleteEquipmentSetTemplate = async function (id, name) {
      if (!confirm(`⚠️ Excluir Conjunto de Equipamentos:\n\nDeseja realmente excluir o conjunto "${name}" (ID #${id})?\n\nAs peças vinculadas a ele NÃO serão apagadas, apenas desvinculadas.`)) {
        return;
      }
      try {
        await this.api(`/api/admin/equipment-sets/${id}`, { method: 'DELETE' });
        await this.loadEquipmentSets();
        if (typeof this.loadEquipments === 'function') {
          this.loadEquipments();
        }
      } catch (err) {
        alert(`Erro ao excluir conjunto: ${err.message}`);
      }
    };

    app.renderEquipmentSetsCrudTable = function () {
      const container = document.getElementById('equipmentSetsTableContainer');
      if (!container) return;

      const q = (this.equipmentSetSearchQuery || '').toLowerCase();
      const lF = this.equipmentSetLevelFilter || 'ALL';
      const rF = this.equipmentSetRarityFilter || 'ALL';

      const filtered = (this.equipmentSets || []).filter((s) => {
        if (lF !== 'ALL' && String(s.requiredLevel) !== lF) return false;
        if (rF !== 'ALL' && s.rarityTier !== rF) return false;
        if (q) {
          const matchCode = s.code && s.code.toLowerCase().includes(q);
          const matchName = s.namePtBr && s.namePtBr.toLowerCase().includes(q);
          const matchDesc = s.descriptionPtBr && s.descriptionPtBr.toLowerCase().includes(q);
          if (!matchCode && !matchName && !matchDesc) return false;
        }
        return true;
      });

      const countBadge = document.getElementById('equipmentSetsCounterBadge');
      if (countBadge) {
        countBadge.textContent = `${filtered.length} de ${this.equipmentSets?.length || 0} conjuntos`;
      }

      if (filtered.length === 0) {
        container.innerHTML = `<div style="padding:20px; text-align:center; color:var(--text-muted); background:rgba(15,23,42,0.4); border-radius:8px;">Nenhum conjunto de equipamentos encontrado.</div>`;
        return;
      }

      const formatBonuses = (b) => {
        if (!b || typeof b !== 'object') return '<span style="color:#64748b;">—</span>';
        const entries = Object.entries(b);
        if (entries.length === 0) return '<span style="color:#64748b;">Sem bônus</span>';
        return entries
          .map(([k, v]) => `<span style="display:inline-block; margin:2px 3px; padding:2px 6px; font-size:0.68rem; background:#1e293b; color:#38bdf8; border-radius:4px; border:1px solid #334155;"><strong>${k}:</strong> +${v}</span>`)
          .join('');
      };

      const formatRarity = (rar) => {
        const colors = {
          SS: '#fbbf24',
          S: '#c084fc',
          A: '#38bdf8',
          B: '#4ade80',
          C: '#fde047',
          D: '#fdba74',
          F: '#cbd5e1',
          COMMON: '#cbd5e1',
          RARE: '#4ade80',
          EPIC: '#38bdf8',
          LEGENDARY: '#c084fc',
          MYTHIC: '#fbbf24',
        };
        const c = colors[rar] || '#cbd5e1';
        const label = ['SS', 'S', 'A', 'B', 'C', 'D', 'F'].includes(rar) ? `Rank ${rar}` : rar;
        return `<span style="font-size:0.7rem; font-weight:800; padding:2px 6px; border-radius:4px; border:1px solid ${c}; color:${c}; background:rgba(15,23,42,0.6);">${label}</span>`;
      };

      let tableHtml = `
        <table class="crud-table" style="width:100%; font-size:0.8rem; border-collapse:collapse;">
          <thead>
            <tr style="background:#0f172a; border-bottom:2px solid #334155; text-align:left;">
              <th style="padding:8px 10px; width:60px;">ID</th>
              <th style="padding:8px 10px;">Conjunto & Identificação</th>
              <th style="padding:8px 10px; width:110px;">Nível & Rank</th>
              <th style="padding:8px 10px; width:150px;">Regra de Ativação</th>
              <th style="padding:8px 10px; width:100px;">Peças</th>
              <th style="padding:8px 10px;">Bônus de Combate (100% / 40%)</th>
              <th style="padding:8px 10px; width:130px; text-align:center;">Ações</th>
            </tr>
          </thead>
          <tbody>
      `;

      for (const s of filtered) {
        const piecesCount = s.piecesCount || 0;
        const piecesColor = piecesCount >= (s.minPiecesFull || 12) ? '#4ade80' : (piecesCount >= (s.minPiecesHalf || 6) ? '#fde047' : '#94a3b8');

        tableHtml += `
          <tr style="border-bottom:1px solid #1e293b; background:rgba(15,23,42,0.3);">
            <td style="padding:8px 10px; font-weight:700; color:#64748b;">#${s.id}</td>
            <td style="padding:8px 10px;">
              <div style="font-weight:800; color:#fde047; font-size:0.84rem;">${s.namePtBr}</div>
              <div style="font-size:0.68rem; color:#94a3b8; margin-top:2px;"><code>${s.code}</code></div>
              ${s.descriptionPtBr ? `<div style="font-size:0.68rem; color:#64748b; font-style:italic; margin-top:2px;">${s.descriptionPtBr}</div>` : ''}
            </td>
            <td style="padding:8px 10px;">
              <div style="font-weight:700; color:#f8fafc;">Nv. ${s.requiredLevel}</div>
              <div style="margin-top:3px;">${formatRarity(s.rarityTier)}</div>
            </td>
            <td style="padding:8px 10px; font-size:0.72rem;">
              <div style="color:#4ade80;">★ 100%: <strong>${s.minPiecesFull || 12} peças</strong> (100% bônus)</div>
              <div style="color:#38bdf8; margin-top:2px;">★ 50%: <strong>${s.minPiecesHalf || 6} peças</strong> (${s.halfBonusRatioPct || 40}% bônus)</div>
            </td>
            <td style="padding:8px 10px;">
              <button onclick="AdminApp.openViewEquipmentSetPiecesModal(${s.id})" style="padding:3px 8px; font-size:0.74rem; font-weight:800; border-radius:6px; background:#1e293b; border:1px solid ${piecesColor}; color:${piecesColor}; cursor:pointer;">
                🛡️ ${piecesCount}/${s.minPiecesFull || 12}
              </button>
            </td>
            <td style="padding:8px 10px;">
              ${formatBonuses(s.bonusCombatStatsJson)}
            </td>
            <td style="padding:8px 10px; text-align:center;">
              <div style="display:flex; gap:6px; justify-content:center;">
                <button class="btn-primary" onclick="AdminApp.openEditEquipmentSetModal(${s.id})" style="padding:4px 8px; font-size:0.72rem;" title="Editar">✏️</button>
                <button class="btn-danger" onclick="AdminApp.deleteEquipmentSetTemplate(${s.id}, '${s.namePtBr.replace(/'/g, "\\'")}')" style="padding:4px 8px; font-size:0.72rem;" title="Excluir">🗑️</button>
              </div>
            </td>
          </tr>
        `;
      }

      tableHtml += `</tbody></table>`;
      container.innerHTML = tableHtml;
    };
  }

  static injectTabAndModalDom() {
    // 1. Botão na Barra de Navegação Superior (.nav-tabs)
    const navTabs = document.querySelector('.nav-tabs');
    const btnEquips = document.getElementById('tabBtnEquipments');
    if (navTabs && !document.getElementById('tabBtnEquipmentSets')) {
      const btn = document.createElement('button');
      btn.id = 'tabBtnEquipmentSets';
      btn.onclick = () => window.AdminApp.switchTab('equipment-sets');
      btn.textContent = '👑 Conjuntos de Equip.';
      btn.style.borderColor = '#eab308';
      if (btnEquips && btnEquips.nextSibling) {
        navTabs.insertBefore(btn, btnEquips.nextSibling);
      } else {
        navTabs.appendChild(btn);
      }
    }

    // 2. Painel da Aba (#tabEquipmentSets)
    const adminApp = document.getElementById('adminApp');
    if (adminApp && !document.getElementById('tabEquipmentSets')) {
      const panel = document.createElement('div');
      panel.id = 'tabEquipmentSets';
      panel.style.cssText = 'display:none; padding:14px; max-width:1300px; margin:0 auto; width:100%; gap:14px; flex-direction:column; box-sizing:border-box;';
      panel.innerHTML = `
        <div class="panel" style="padding:14px;">
          <!-- Topo do Painel com Banner Didático -->
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <div>
              <h3 style="margin:0; font-size:1.05rem; color:#eab308;">👑 Tabela Oficial de Conjuntos de Equipamentos (\`equipment_sets\`)</h3>
              <p style="font-size:0.78rem; color:var(--text-muted); margin:4px 0 0;">
                Configure bônus concedidos a jogadores que equiparem peças do mesmo conjunto na arena.
              </p>
            </div>
            <div style="display:flex; gap:8px; align-items:center;">
              <span id="equipmentSetsCounterBadge" style="font-size:0.78rem; color:var(--text-muted); font-weight:600;"></span>
              <button class="btn-primary" onclick="AdminApp.openCreateEquipmentSetModal()" style="min-height:38px; font-weight:700; padding:8px 16px; border-radius:6px; background:#eab308; color:#020617; border-color:#ca8a04;">
                ➕ Novo Conjunto
              </button>
            </div>
          </div>

          <!-- Banner Informativo da Regra de Bônus 50% / 100% -->
          <div style="background:rgba(234,179,8,0.1); border:1px solid #eab308; border-radius:8px; padding:10px 14px; margin-top:10px; display:flex; align-items:center; gap:12px;">
            <span style="font-size:1.4rem;">💡</span>
            <div style="font-size:0.75rem; color:#fef08a; line-height:1.4;">
              <strong>Regra de Ouro dos Conjuntos:</strong> Equipar <strong>100% das peças (12 itens)</strong> concede <strong>100% do bônus de combate</strong>. Equipar <strong>50% das peças (6 itens)</strong> concede <strong>40% do bônus</strong>. Isso abre total liberdade para o jogador combinar <strong>dois conjuntos (6 + 6)</strong> com 80% do poder total, sacrificando 20% pela versatilidade híbrida!
            </div>
          </div>

          <!-- Filtros e Busca -->
          <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-top:12px; background:rgba(15,23,42,0.6); padding:8px 10px; border-radius:8px; border:1px solid #334155;">
            <input type="text" id="equipSetSearchInput" placeholder="🔍 Buscar conjunto por nome, código ou lore..." oninput="AdminApp.filterEquipmentSetsCrudTable()" style="flex:1; min-width:180px; padding:7px 10px; font-size:0.82rem;" />
            <select id="equipSetLevelFilterSelect" onchange="AdminApp.filterEquipmentSetsCrudTable()" style="width:140px; padding:7px; font-size:0.8rem;">
              <option value="ALL">Todos os Níveis</option>
              <option value="1">Nível 1 (Aprendiz)</option>
              <option value="40">Nível 40 (Balanceados/Espec.)</option>
              <option value="50">Nível 50 (Épicos Mais Fortes)</option>
              <option value="60">Nível 60 (Lendários Mais Fortes)</option>
            </select>
            <select id="equipSetRarityFilterSelect" onchange="AdminApp.filterEquipmentSetsCrudTable()" style="width:130px; padding:7px; font-size:0.8rem;">
              <option value="ALL">Todas Raridades</option>
              <option value="SS">Rank SS (Mítico)</option>
              <option value="S">Rank S (Lendário)</option>
              <option value="A">Rank A (Épico)</option>
              <option value="B">Rank B (Raro)</option>
              <option value="C">Rank C (Incomum)</option>
              <option value="D">Rank D (Regular)</option>
              <option value="F">Rank F (Básico)</option>
            </select>
          </div>

          <div id="equipmentSetsTableContainer" style="margin-top:12px;"></div>
        </div>
      `;
      const tabEquips = document.getElementById('tabEquipments');
      if (tabEquips && tabEquips.nextSibling) {
        adminApp.insertBefore(panel, tabEquips.nextSibling);
      } else {
        adminApp.appendChild(panel);
      }
    }

    // 3. Modal de Cadastro / Edição (#equipmentSetModal)
    if (!document.getElementById('equipmentSetModal')) {
      const modal = document.createElement('div');
      modal.id = 'equipmentSetModal';
      modal.className = 'modal-backdrop';
      modal.style.display = 'none';
      modal.innerHTML = `
        <div class="modal-box" style="max-width:850px; width:95%; max-height:92vh; display:block; overflow-y:auto; padding:14px;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #334155; padding-bottom:10px; margin-bottom:12px;">
            <h3 id="equipSetModalTitle" style="color:#eab308; margin:0; font-size:1.05rem;">🛡️ Cadastrar Conjunto de Equipamentos</h3>
            <div style="display:flex; gap:8px;">
              <button class="btn-success" onclick="AdminApp.saveEquipmentSetTemplate()" style="padding:6px 14px; font-weight:700;">💾 Salvar</button>
              <button class="btn-danger" onclick="AdminApp.closeModal('equipmentSetModal')" style="padding:6px 10px;">✕</button>
            </div>
          </div>

          <input type="hidden" id="equipSetEditIdInput" value="" />

          <!-- Identidade -->
          <div style="background:#0f172a; border:1px solid #334155; border-radius:8px; padding:12px; margin-bottom:12px;">
            <div style="font-weight:700; color:#eab308; font-size:0.8rem; margin-bottom:8px;">1️⃣ Identificação & Regras de Ativação</div>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:10px;">
              <div class="field">
                <label>Nome do Conjunto (PT-BR) *</label>
                <input type="text" id="equipSetNameInput" placeholder="Ex: Conjunto Soberano Abissal" />
              </div>
              <div class="field">
                <label>Código Único (opcional)</label>
                <input type="text" id="equipSetCodeInput" placeholder="Auto-gerado se vazio" />
              </div>
              <div class="field">
                <label>Nível Mínimo Requerido</label>
                <input type="number" id="equipSetReqLevelInput" value="40" min="1" max="100" />
              </div>
              <div class="field">
                <label>Raridade do Conjunto</label>
                <select id="equipSetRaritySelect">
                  <option value="SS">Rank SS (Mítico)</option>
                  <option value="S">Rank S (Lendário)</option>
                  <option value="A">Rank A (Épico)</option>
                  <option value="B">Rank B (Raro)</option>
                  <option value="C">Rank C (Incomum)</option>
                  <option value="D">Rank D (Regular)</option>
                  <option value="F">Rank F (Básico)</option>
                </select>
              </div>
              <div class="field">
                <label>Peças para 100% de Bônus</label>
                <input type="number" id="equipSetMinFullInput" value="12" min="1" max="16" />
              </div>
              <div class="field">
                <label>Peças para 50% (Metade)</label>
                <input type="number" id="equipSetMinHalfInput" value="6" min="1" max="16" />
              </div>
              <div class="field">
                <label>% Concedida no 50% (Metade)</label>
                <input type="number" id="equipSetHalfBonusRatioInput" value="40" min="1" max="100" />
              </div>
              <div class="field">
                <label>% Concedida no 100% (Full)</label>
                <input type="number" id="equipSetFullBonusRatioInput" value="100" min="1" max="200" />
              </div>
              <div class="field">
                <label>Status</label>
                <select id="equipSetActiveSelect">
                  <option value="true">🟢 Ativo</option>
                  <option value="false">🔴 Inativo</option>
                </select>
              </div>
              <div class="field" style="grid-column:1 / -1;">
                <label>Descrição / Lore do Conjunto</label>
                <input type="text" id="equipSetDescriptionInput" placeholder="Ex: Canaliza as trevas primordiais para amplificar a letalidade mística..." />
              </div>
            </div>
          </div>

          <!-- Bônus de Combate -->
          <div style="background:#0f172a; border:1px solid #eab308; border-radius:8px; padding:12px;">
            <div style="font-weight:700; color:#eab308; font-size:0.8rem; margin-bottom:8px;">2️⃣ ⚔️ Bônus de Combate Concedido pelo Conjunto Completo (100%)</div>
            <p style="font-size:0.7rem; color:#94a3b8; margin:0 0 10px 0;">
              Estes bônus serão concedidos em 100% ao equipar todas as 12 peças, e em 40% ao equipar a metade (6 peças).
            </p>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:8px;">
              <div class="field"><label>MAX_HP (Vida Máxima)</label><input type="number" id="setStat_MAX_HP" placeholder="0" /></div>
              <div class="field"><label>MAX_MP (Mana Máxima)</label><input type="number" id="setStat_MAX_MP" placeholder="0" /></div>
              <div class="field"><label>PHYS_ATK (Ataque Físico)</label><input type="number" id="setStat_PHYS_ATK" placeholder="0" /></div>
              <div class="field"><label>MAG_ATK (Ataque Mágico)</label><input type="number" id="setStat_MAG_ATK" placeholder="0" /></div>
              <div class="field"><label>PHYS_DEF (Defesa Física)</label><input type="number" id="setStat_PHYS_DEF" placeholder="0" /></div>
              <div class="field"><label>MAG_DEF (Defesa Mágica)</label><input type="number" id="setStat_MAG_DEF" placeholder="0" /></div>
              <div class="field"><label>BATTLE_MOVE_SPEED (Velocidade)</label><input type="number" id="setStat_BATTLE_MOVE_SPEED" placeholder="0" /></div>
              <div class="field"><label>ATTACK_SPEED (Vel. Ataque)</label><input type="number" id="setStat_ATTACK_SPEED" placeholder="0" /></div>
              <div class="field"><label>CRIT_RATE (Taxa Crítica %)</label><input type="number" id="setStat_CRIT_RATE" placeholder="0" step="0.1" /></div>
              <div class="field"><label>CRIT_DMG (Dano Crítico %)</label><input type="number" id="setStat_CRIT_DMG" placeholder="0" step="0.1" /></div>
              <div class="field"><label>HEAL_POWER (Amp. Cura)</label><input type="number" id="setStat_HEAL_POWER" placeholder="0" /></div>
              <div class="field"><label>PHYS_PEN (Pen. Física)</label><input type="number" id="setStat_PHYS_PEN" placeholder="0" /></div>
              <div class="field"><label>MAG_PEN (Pen. Mágica)</label><input type="number" id="setStat_MAG_PEN" placeholder="0" /></div>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    // 4. Modal para Visualizar Peças do Conjunto (#equipmentSetViewModal)
    if (!document.getElementById('equipmentSetViewModal')) {
      const viewModal = document.createElement('div');
      viewModal.id = 'equipmentSetViewModal';
      viewModal.className = 'modal-backdrop';
      viewModal.style.display = 'none';
      viewModal.innerHTML = `
        <div class="modal-box" style="max-width:850px; width:95%; max-height:85vh; display:block; overflow-y:auto; padding:14px;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #334155; padding-bottom:10px; margin-bottom:12px;">
            <h3 id="equipmentSetViewTitle" style="color:#eab308; margin:0; font-size:1.02rem;">🛡️ Peças do Conjunto</h3>
            <button class="btn-danger" onclick="AdminApp.closeModal('equipmentSetViewModal')" style="padding:6px 12px;">✕ Fechar</button>
          </div>
          <div id="equipmentSetPiecesContainer" style="padding:4px 0;"></div>
        </div>
      `;
      document.body.appendChild(viewModal);
    }
  }
}

window.AdminEquipmentSetsTab = AdminEquipmentSetsTab;
