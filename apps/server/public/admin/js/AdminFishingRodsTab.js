/**
 * @file apps/server/public/admin/js/AdminFishingRodsTab.js
 * @module @etheria/server
 * @description Submódulo da Aba dedicada de Varas de Pesca (`FISHING_ROD`) na Rota `/admin`.
 *   - Separa as Varas de Pesca dos equipamentos de combate (zero atributos de combate).
 *   - Configura nível mínimo (padrão 50), tempo de pesca (`castIntervalSec`), chance de fisgada (`catchChancePct`)
 *     e pesos de raridade dos peixes (`F, D, C, B, A, S, SS`), com normalização 100% em 1 clique.
 *   - Integração com as 12 varas de pesca do catálogo `mcrework` (tipo 1201) + espelhamento local ao salvar.
 */

class AdminFishingRodsTab {
  static RANKS = ['F', 'D', 'C', 'B', 'A', 'S', 'SS'];
  static RANK_COLORS = {
    SS: '#fbbf24',
    S: '#c084fc',
    A: '#38bdf8',
    B: '#4ade80',
    C: '#fde047',
    D: '#fdba74',
    F: '#94a3b8',
  };

  static attach(app) {
    app.fishingRods = [];
    app.mcreworkFishingRods = [];
    app.fishingRodSearchQuery = '';
    app.fishingRodSavingInProgress = false;
    app.fishingRodDuplicatingMode = false;

    AdminFishingRodsTab.injectTabAndModalDom();

    app.loadFishingRods = async function () {
      try {
        this.fishingRods = await this.api('/api/admin/fishing-rods');
        this.renderFishingRodsCrudTable();
      } catch (err) {
        console.error('Falha ao carregar varas de pesca:', err);
      }
    };

    app.loadMcreworkFishingRods = async function () {
      if (this.mcreworkFishingRods && this.mcreworkFishingRods.length > 0) return;
      try {
        this.mcreworkFishingRods = await this.api('/api/admin/mcrework/fishing-rods');
      } catch (err) {
        console.error('Falha ao carregar galeria de varas do mcrework:', err);
      }
    };

    app.filterFishingRodsTable = function () {
      this.fishingRodSearchQuery = (document.getElementById('fishingRodSearchInput')?.value || '').toLowerCase().trim();
      this.renderFishingRodsCrudTable();
    };

    app.updateFishingRodIconPreview = function (iconKey) {
      const trimmed = String(iconKey || 'assets/equipment/icons/equip_normal_600001.png').trim();
      const isDirect =
        trimmed.startsWith('/play/') ||
        trimmed.startsWith('/assets/') ||
        trimmed.startsWith('/api/') ||
        /^https?:\/\//i.test(trimmed);
      const url = isDirect ? trimmed : `/api/assets/mcrework/${trimmed.replace(/^\/+/, '')}`;
      const img = document.getElementById('rodActiveIconImg');
      const badge = document.getElementById('rodActiveIconBadge');
      if (img) img.src = url;
      if (badge) badge.textContent = isDirect ? trimmed : trimmed.replace(/^\/+/, '');
    };

    app.updateFishingRodRankSumBadge = function () {
      const badge = document.getElementById('rodRankSumBadge');
      if (!badge) return;
      let sum = 0;
      for (const r of AdminFishingRodsTab.RANKS) {
        sum += Math.max(0, Number(document.getElementById(`rodRankWeight_${r}`)?.value) || 0);
      }
      const rounded = Math.round(sum * 100) / 100;
      badge.textContent = `Total: ${rounded}%`;
      const isHundred = Math.abs(rounded - 100) < 0.05;
      badge.style.color = isHundred ? '#4ade80' : '#fde047';
      badge.style.borderColor = isHundred ? '#16a34a' : '#eab308';
    };

    app.normalizeFishingRodRankWeightsUi = function () {
      const vals = AdminFishingRodsTab.RANKS.map((r) =>
        Math.max(0, Number(document.getElementById(`rodRankWeight_${r}`)?.value) || 0)
      );
      const sum = vals.reduce((a, b) => a + b, 0);
      if (sum <= 0) return;
      let acc = 0;
      AdminFishingRodsTab.RANKS.forEach((r, idx) => {
        const inp = document.getElementById(`rodRankWeight_${r}`);
        if (!inp) return;
        if (idx === AdminFishingRodsTab.RANKS.length - 1) {
          inp.value = String(Math.max(0, Math.round((100 - acc) * 100) / 100));
        } else {
          const share = Math.round(((vals[idx] / sum) * 100) * 100) / 100;
          acc += share;
          inp.value = String(share);
        }
      });
      this.updateFishingRodRankSumBadge();
    };

    app.populateFishingRodModal = function (mode, rod = null) {
      const isEdit = mode === 'edit' && rod;
      const isDup = mode === 'duplicate' && rod;
      this.fishingRodDuplicatingMode = isDup;

      document.getElementById('rodEditIdInput').value = isEdit ? String(rod.id) : '';
      const codeInp = document.getElementById('rodCodeInput');
      codeInp.value = isEdit ? (rod.code || '') : '';
      codeInp.disabled = !!isEdit;

      const titleEl = document.getElementById('rodModalTitle');
      if (isEdit) titleEl.textContent = `✏️ Editar Vara de Pesca #${rod.id}: ${rod.namePtBr}`;
      else if (isDup) titleEl.textContent = `📋 Duplicar Vara de Pesca (base: ${rod.namePtBr})`;
      else titleEl.textContent = '🎣 Cadastrar Nova Vara de Pesca';

      const src = rod || {
        namePtBr: '',
        descriptionPtBr: '',
        rarityTier: 'C',
        requiredLevel: 50,
        isTradable: true,
        priceGold: 500,
        isActive: true,
        mcreworkIconKey: 'assets/equipment/icons/equip_normal_600001.png',
        fishingRodConfig: {
          castIntervalSec: 10,
          catchChancePct: 65,
          rankWeights: { F: 45, D: 25, C: 15, B: 8, A: 4.5, S: 2, SS: 0.5 },
        },
      };

      document.getElementById('rodNameInput').value = isDup ? `${src.namePtBr || ''} (Cópia)`.trim() : (src.namePtBr || '');
      document.getElementById('rodDescriptionInput').value = src.descriptionPtBr || '';
      document.getElementById('rodRaritySelect').value = src.rarityTier || 'C';
      document.getElementById('rodReqLevelInput').value = String(src.requiredLevel ?? 50);
      document.getElementById('rodTradableSelect').value = src.isTradable !== false ? 'true' : 'false';
      document.getElementById('rodPriceInput').value = String(src.isTradable === false ? 0 : (src.priceGold ?? 500));
      document.getElementById('rodActiveSelect').value = String(src.isActive !== false);

      const cfg = src.fishingRodConfig || {};
      document.getElementById('rodCastIntervalInput').value = String(cfg.castIntervalSec ?? 10);
      document.getElementById('rodCatchChanceInput').value = String(cfg.catchChancePct ?? 65);
      const weights = cfg.rankWeights || {};
      for (const r of AdminFishingRodsTab.RANKS) {
        const inp = document.getElementById(`rodRankWeight_${r}`);
        if (inp) inp.value = String(weights[r] ?? 0);
      }

      const iconKey = src.mcreworkIconKey || 'assets/equipment/icons/equip_normal_600001.png';
      document.getElementById('rodIconKeyInput').value = iconKey;
      this.updateFishingRodIconPreview(iconKey);
      this.updateFishingRodRankSumBadge();
    };

    app.openCreateFishingRodModal = async function () {
      await this.loadMcreworkFishingRods();
      this.populateFishingRodModal('create', null);
      this.renderMcreworkRodsGallery();
      document.getElementById('fishingRodModal').style.display = 'flex';
    };

    app.openEditFishingRodModal = async function (id) {
      await this.loadMcreworkFishingRods();
      const rod = (this.fishingRods || []).find((r) => Number(r.id) === Number(id));
      if (!rod) return;
      this.populateFishingRodModal('edit', rod);
      this.renderMcreworkRodsGallery();
      document.getElementById('fishingRodModal').style.display = 'flex';
    };

    app.openDuplicateFishingRodModal = async function (id) {
      await this.loadMcreworkFishingRods();
      const rod = (this.fishingRods || []).find((r) => Number(r.id) === Number(id));
      if (!rod) return;
      this.populateFishingRodModal('duplicate', rod);
      this.renderMcreworkRodsGallery();
      document.getElementById('fishingRodModal').style.display = 'flex';
    };

    app.selectMcreworkRodByIndex = function (idx) {
      const rod = (this.mcreworkFishingRods || [])[idx];
      if (!rod) return;
      document.getElementById('rodIconKeyInput').value = rod.mcreworkIconKey;
      this.updateFishingRodIconPreview(rod.mcreworkIconKey);

      const isEdit = !!document.getElementById('rodEditIdInput')?.value;
      if (!isEdit && !this.fishingRodDuplicatingMode) {
        const nameInp = document.getElementById('rodNameInput');
        if (nameInp && !nameInp.value.trim()) nameInp.value = rod.name || '';
        const descInp = document.getElementById('rodDescriptionInput');
        if (descInp && !descInp.value.trim() && rod.description) descInp.value = rod.description;
      }
    };

    app.renderMcreworkRodsGallery = function () {
      const grid = document.getElementById('rodGalleryGrid');
      if (!grid) return;
      const list = this.mcreworkFishingRods || [];
      if (list.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:var(--text-muted); padding:12px;">Carregando catálogo mcrework...</div>';
        return;
      }
      grid.innerHTML = list.map((r, idx) => `
        <div onclick="AdminApp.selectMcreworkRodByIndex(${idx})"
             title="${this.escapeHtml(r.name)} (Nv.${r.reqLevel})"
             style="cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:4px; padding:6px; background:rgba(15,23,42,0.85); border:1px solid #334155; border-radius:8px;">
          <img src="${r.iconUrl}" alt="${this.escapeHtml(r.name)}" style="width:38px; height:38px; object-fit:contain;" />
          <span style="font-size:0.65rem; color:#e2e8f0; text-align:center; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:90px;">${this.escapeHtml(r.name)}</span>
          <span style="font-size:0.6rem; color:#38bdf8;">Nv.${r.reqLevel}</span>
        </div>
      `).join('');
    };

    app.saveFishingRod = async function () {
      if (this.fishingRodSavingInProgress) return;
      const editId = document.getElementById('rodEditIdInput').value.trim();
      const namePtBr = document.getElementById('rodNameInput').value.trim();
      if (!namePtBr) {
        alert('Informe o nome da Vara de Pesca em português.');
        return;
      }

      const rankWeights = {};
      for (const r of AdminFishingRodsTab.RANKS) {
        rankWeights[r] = Math.max(0, Number(document.getElementById(`rodRankWeight_${r}`)?.value) || 0);
      }

      const payload = {
        code: editId ? undefined : (document.getElementById('rodCodeInput').value.trim() || undefined),
        namePtBr,
        descriptionPtBr: document.getElementById('rodDescriptionInput').value.trim(),
        rarityTier: document.getElementById('rodRaritySelect').value,
        requiredLevel: Math.max(1, Number(document.getElementById('rodReqLevelInput').value) || 50),
        isTradable: document.getElementById('rodTradableSelect').value !== 'false',
        priceGold: Math.max(0, Number(document.getElementById('rodPriceInput').value) || 0),
        isActive: document.getElementById('rodActiveSelect').value === 'true',
        mcreworkIconKey: document.getElementById('rodIconKeyInput').value.trim(),
        fishingRodConfig: {
          castIntervalSec: Math.max(2, Number(document.getElementById('rodCastIntervalInput').value) || 10),
          catchChancePct: Math.max(1, Math.min(100, Number(document.getElementById('rodCatchChanceInput').value) || 65)),
          rankWeights,
        },
      };

      this.fishingRodSavingInProgress = true;
      try {
        if (editId) {
          await this.api(`/api/admin/fishing-rods/${editId}`, { method: 'PUT', body: JSON.stringify(payload) });
        } else {
          await this.api('/api/admin/fishing-rods', { method: 'POST', body: JSON.stringify(payload) });
        }
        document.getElementById('fishingRodModal').style.display = 'none';
        await this.loadFishingRods();
      } catch (err) {
        alert(`Erro ao salvar Vara de Pesca: ${err.message}`);
      } finally {
        this.fishingRodSavingInProgress = false;
      }
    };

    app.deleteFishingRodById = async function (id) {
      const rod = (this.fishingRods || []).find((r) => Number(r.id) === Number(id));
      if (!confirm(`Deseja realmente excluir a vara "${rod?.namePtBr || '#' + id}"?`)) return;
      try {
        await this.api(`/api/admin/fishing-rods/${id}`, { method: 'DELETE' });
        await this.loadFishingRods();
      } catch (err) {
        alert(`Erro ao excluir Vara de Pesca: ${err.message}`);
      }
    };

    app.renderFishingRodsCrudTable = function () {
      const container = document.getElementById('fishingRodsTableContainer');
      if (!container) return;
      const q = (this.fishingRodSearchQuery || '').toLowerCase();
      const filtered = (this.fishingRods || []).filter((r) => {
        if (!q) return true;
        return (r.namePtBr || '').toLowerCase().includes(q) || (r.code || '').toLowerCase().includes(q);
      });

      const badge = document.getElementById('fishingRodsCounterBadge');
      if (badge) badge.textContent = `${filtered.length} de ${(this.fishingRods || []).length} vara(s)`;

      if (filtered.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:32px; color:var(--text-muted);">🎣 Nenhuma Vara de Pesca cadastrada ainda. Clique em <strong>➕ Nova Vara de Pesca</strong> para importar do mcrework!</div>`;
        return;
      }

      container.innerHTML = `
        <table class="data-table" style="width:100%; border-collapse:collapse; font-size:0.83rem;">
          <thead>
            <tr style="border-bottom:1px solid var(--border); text-align:left; color:#94a3b8;">
              <th style="padding:10px;">Ícone</th>
              <th style="padding:10px;">Nome & Código</th>
              <th style="padding:10px;">Nível / Raridade</th>
              <th style="padding:10px;">Tempo Ciclo (T)</th>
              <th style="padding:10px;">Chance Fisgada</th>
              <th style="padding:10px;">Raridade dos Peixes (F..SS)</th>
              <th style="padding:10px;">Preço</th>
              <th style="padding:10px; text-align:right;">Ações</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map((rod) => {
              const cfg = rod.fishingRodConfig || {};
              const rw = cfg.rankWeights || {};
              const rankPills = AdminFishingRodsTab.RANKS
                .filter((r) => Number(rw[r]) > 0)
                .map((r) => `<span style="border:1px solid ${AdminFishingRodsTab.RANK_COLORS[r]}; color:${AdminFishingRodsTab.RANK_COLORS[r]}; padding:1px 5px; border-radius:4px; font-size:0.7rem; font-weight:700;">${r}:${rw[r]}</span>`)
                .join(' ');
              return `
                <tr style="border-bottom:1px solid rgba(51,65,85,0.4);">
                  <td style="padding:8px 10px;">
                    <img src="${rod.iconUrl}" alt="${this.escapeHtml(rod.namePtBr)}" style="width:38px; height:38px; object-fit:contain; border-radius:6px; background:#020617; border:1px solid #06b6d4;" />
                  </td>
                  <td style="padding:8px 10px;">
                    <strong style="color:#f8fafc;">#${rod.id} &bull; ${this.escapeHtml(rod.namePtBr)}</strong>
                    <div style="font-size:0.72rem; color:var(--text-muted); font-family:monospace;">${this.escapeHtml(rod.code)}</div>
                  </td>
                  <td style="padding:8px 10px;">
                    <strong style="color:#67e8f9;">Nv. ${rod.requiredLevel}</strong>
                    <span style="margin-left:6px; color:${AdminFishingRodsTab.RANK_COLORS[rod.rarityTier] || '#cbd5e1'}; font-weight:700;">[${this.escapeHtml(rod.rarityTier)}]</span>
                  </td>
                  <td style="padding:8px 10px; font-weight:800; color:#fde047;">⏱️ ${cfg.castIntervalSec ?? 10}s</td>
                  <td style="padding:8px 10px; font-weight:800; color:#4ade80;">🎣 ${cfg.catchChancePct ?? 65}%</td>
                  <td style="padding:8px 10px;"><div style="display:flex; flex-wrap:wrap; gap:4px;">${rankPills}</div></td>
                  <td style="padding:8px 10px;">${rod.isTradable === false ? '<span style="color:#94a3b8;">🚫 Não negoc.</span>' : `<strong style="color:#fde047;">🪙 ${rod.priceGold || 0}</strong>`}</td>
                  <td style="padding:8px 10px; text-align:right; white-space:nowrap;">
                    <button class="btn-primary" style="padding:4px 8px; font-size:0.75rem; margin-right:4px;" onclick="AdminApp.openEditFishingRodModal(${rod.id})">✏️ Editar</button>
                    <button class="btn-secondary" style="padding:4px 8px; font-size:0.75rem; margin-right:4px; background:#0284c7; color:#fff; border:none; border-radius:4px;" onclick="AdminApp.openDuplicateFishingRodModal(${rod.id})">📋 Duplicar</button>
                    <button class="btn-danger" style="padding:4px 8px; font-size:0.75rem;" onclick="AdminApp.deleteFishingRodById(${rod.id})">🗑️</button>
                  </td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>`;
    };
  }

  static injectTabAndModalDom() {
    const adminApp = document.getElementById('adminApp');
    if (adminApp && !document.getElementById('tabFishingRods')) {
      const panel = document.createElement('div');
      panel.id = 'tabFishingRods';
      panel.style.cssText = 'display:none; padding:16px; max-width:1200px; margin:0 auto; width:100%; gap:16px; flex-direction:column;';
      panel.innerHTML = `
        <div class="panel">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <div>
              <h3 style="margin:0; color:#67e8f9;">🎣 Tabela de Varas de Pesca (Sem Atributos de Combate)</h3>
              <p style="font-size:0.8rem; color:var(--text-muted); margin:4px 0 0;">
                Configure tempo por fisgada, chance de captura e pesos de raridade de peixes (F..SS). Nível mínimo padrão: 50.
              </p>
            </div>
            <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
              <span id="fishingRodsCounterBadge" style="font-size:0.8rem; color:var(--text-muted);"></span>
              <button class="btn-primary" style="background:#0891b2; border-color:#22d3ee;" onclick="AdminApp.openCreateFishingRodModal()">➕ Nova Vara de Pesca</button>
            </div>
          </div>
          <div style="display:flex; gap:10px; margin-top:12px; padding-bottom:10px; border-bottom:1px solid var(--border); flex-wrap:wrap;">
            <input type="text" id="fishingRodSearchInput" placeholder="🔍 Buscar vara por nome ou código..." oninput="AdminApp.filterFishingRodsTable()" style="flex:1; min-width:200px;" />
          </div>
          <div id="fishingRodsTableContainer" style="overflow-x:auto; margin-top:12px;"></div>
        </div>
      `;
      adminApp.appendChild(panel);
    }

    if (document.getElementById('fishingRodModal')) return;
    const modal = document.createElement('div');
    modal.id = 'fishingRodModal';
    modal.className = 'modal-backdrop';
    modal.style.display = 'none';
    modal.innerHTML = `
      <div class="modal-box" style="max-width:900px; width:96%; max-height:92vh; display:block; overflow-y:auto; padding:16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:10px; margin-bottom:12px; gap:8px; flex-wrap:wrap;">
          <h3 id="rodModalTitle" style="color:#67e8f9; margin:0; font-size:1.05rem;">🎣 Cadastrar / Editar Vara de Pesca</h3>
          <div style="display:flex; gap:8px;">
            <button class="btn-success" onclick="AdminApp.saveFishingRod()" style="padding:6px 14px; font-weight:700;">💾 Salvar</button>
            <button class="btn-danger" onclick="AdminApp.closeModal('fishingRodModal')" style="padding:6px 10px;">✕</button>
          </div>
        </div>
        <input type="hidden" id="rodEditIdInput" value="" />
        <input type="hidden" id="rodIconKeyInput" value="assets/equipment/icons/equip_normal_600001.png" />

        <div style="background:rgba(15,23,42,0.75); border:1px solid #334155; border-radius:10px; padding:12px; margin-bottom:12px;">
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 170px), 1fr)); gap:10px;">
            <div class="field"><label>Nome da Vara (PT-BR) *</label><input type="text" id="rodNameInput" placeholder="Ex: Vara de Bambu Azul" /></div>
            <div class="field"><label>Código (Auto: rod_N)</label><input type="text" id="rodCodeInput" placeholder="Auto-gerado se vazio" /></div>
            <div class="field">
              <label>Raridade da Vara</label>
              <select id="rodRaritySelect">
                <option value="COMMON">COMMON</option><option value="F">Rank F</option><option value="D">Rank D</option>
                <option value="C" selected>Rank C</option><option value="B">Rank B</option><option value="A">Rank A</option>
                <option value="S">Rank S</option><option value="SS">Rank SS</option>
              </select>
            </div>
            <div class="field"><label>Nível Mínimo Requerido</label><input type="number" id="rodReqLevelInput" value="50" min="1" max="9999" /></div>
            <div class="field">
              <label>Comercializável?</label>
              <select id="rodTradableSelect"><option value="true">🪙 Sim</option><option value="false">🚫 Não</option></select>
            </div>
            <div class="field"><label>Preço em Ouro</label><input type="number" id="rodPriceInput" value="500" min="0" /></div>
            <div class="field">
              <label>Status</label>
              <select id="rodActiveSelect"><option value="true">🟢 Ativa</option><option value="false">🔴 Inativa</option></select>
            </div>
            <div class="field" style="grid-column:1 / -1;"><label>Descrição</label><input type="text" id="rodDescriptionInput" placeholder="Descrição da vara de pesca..." /></div>
          </div>
        </div>

        <div style="background:rgba(8,51,68,0.45); border:1.5px solid #06b6d4; border-radius:10px; padding:12px; margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
            <strong style="color:#67e8f9; font-size:0.86rem;">🎣 Parâmetros de Pesca (Qualidade & Raridade)</strong>
            <div style="display:flex; gap:6px; align-items:center;">
              <span id="rodRankSumBadge" style="font-size:0.74rem; padding:2px 8px; border-radius:99px; border:1px solid #4ade80; color:#4ade80; font-weight:700;">Total: 100%</span>
              <button type="button" onclick="AdminApp.normalizeFishingRodRankWeightsUi()" style="font-size:0.72rem; padding:3px 8px;">⚖️ Normalizar p/ 100%</button>
            </div>
          </div>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap:10px; margin-bottom:10px;">
            <div class="field"><label>⏱️ Tempo por Tentativa (segundos)</label><input type="number" id="rodCastIntervalInput" value="10" min="2" max="120" step="0.5" /></div>
            <div class="field"><label>🎯 Chance de Fisgar Peixe (%)</label><input type="number" id="rodCatchChanceInput" value="65" min="1" max="100" step="0.5" /></div>
          </div>
          <div style="font-size:0.74rem; color:#bae6fd; margin-bottom:6px;">
            Pesos de Raridade ao Fisgar (ranks sem peixes cadastrados têm o peso redistribuído automaticamente):
          </div>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(90px, 1fr)); gap:8px;">
            ${AdminFishingRodsTab.RANKS.map((r) => `
              <div class="field">
                <label style="color:${AdminFishingRodsTab.RANK_COLORS[r]}; font-weight:800;">Rank ${r}</label>
                <input type="number" id="rodRankWeight_${r}" min="0" max="1000" step="0.5" value="0" oninput="AdminApp.updateFishingRodRankSumBadge()" />
              </div>
            `).join('')}
          </div>
        </div>

        <div style="background:rgba(15,23,42,0.75); border:1px solid #334155; border-radius:10px; padding:12px; margin-bottom:12px;">
          <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
            <img id="rodActiveIconImg" src="" style="width:42px; height:42px; object-fit:contain; border-radius:6px; background:#020617; border:1px solid #22d3ee;" />
            <div>
              <strong style="color:#67e8f9; font-size:0.84rem;">🌐 Varas de Pesca do Repositório mcrework (12 Modelos)</strong>
              <div id="rodActiveIconBadge" style="font-size:0.68rem; color:var(--text-muted); font-family:monospace;"></div>
            </div>
          </div>
          <div id="rodGalleryGrid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(92px, 1fr)); gap:8px; max-height:190px; overflow-y:auto;"></div>
        </div>

        <button class="btn-success" style="width:100%; padding:12px; font-weight:800;" onclick="AdminApp.saveFishingRod()">💾 Salvar Vara de Pesca</button>
      </div>
    `;
    document.body.appendChild(modal);
  }
}

window.AdminFishingRodsTab = AdminFishingRodsTab;
