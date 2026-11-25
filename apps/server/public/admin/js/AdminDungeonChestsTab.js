/**
 * @file apps/server/public/admin/js/AdminDungeonChestsTab.js
 * @module @etheria/server/admin
 * @description Aba administrativa "Baús de Dungeon" (/admin):
 *   - Permite ajustar chance de spawn (Comum 75%, Épico 20%, Lendário 5%), tamanho e offset 2.5D no mapa
 *     com palco de preview ao vivo (Mapa real + Herói de referência + Baú com aura).
 *   - Editor visual de faixas ponderadas de Ouro (ex: 70% 1000 / 30% 10000), faixas de XP e drops de Itens/Equipamentos.
 */

class AdminDungeonChestsTab {
  static previewAnimId = null;
  static previewImages = new Map();
  static previewMapImg = null;
  static previewMapId = null;
  static previewHeroSprite = null;
  static previewClassesCache = null;
  static previewHeroDepthMode = 'SIDE';

  static setPreviewHeroDepthMode(mode) {
    this.previewHeroDepthMode = ['BEHIND', 'SIDE', 'FRONT'].includes(mode) ? mode : 'SIDE';
    ['BEHIND', 'SIDE', 'FRONT'].forEach((m) => {
      const btn = document.getElementById(`dcDepthBtn${m}`);
      if (btn) btn.className = this.previewHeroDepthMode === m ? 'btn-primary' : '';
    });
  }

  static attach(app) {
    app.dungeonChestsList = [];
    app.dungeonChestItemsCatalog = [];
    app.selectedDungeonChestId = null;
    app.dungeonChestItemSearch = '';

    this.injectTabDom();

    app.loadDungeonChestsTab = async function () {
      try {
        const data = await this.api('/api/admin/dungeon-chests');
        this.dungeonChestsList = Array.isArray(data?.chests) ? data.chests : [];
        this.dungeonChestItemsCatalog = Array.isArray(data?.itemsCatalog) ? data.itemsCatalog : [];
        if (!this.selectedDungeonChestId && this.dungeonChestsList.length > 0) {
          this.selectedDungeonChestId = this.dungeonChestsList[0].id;
        }
        this.renderDungeonChestsTab();
        AdminDungeonChestsTab.startPreviewLoop(this);
      } catch (err) {
        console.error('Erro ao carregar Baús de Dungeon:', err);
      }
    };

    app.selectDungeonChest = function (id) {
      this.selectedDungeonChestId = Number(id);
      this.renderDungeonChestsTab();
    };

    app.getSelectedDungeonChest = function () {
      return (
        (this.dungeonChestsList || []).find((c) => Number(c.id) === Number(this.selectedDungeonChestId)) ||
        (this.dungeonChestsList || [])[0] ||
        null
      );
    };

    app.nudgeSelectedChestField = function (field, delta, min, max, isFloat = false) {
      const c = this.getSelectedDungeonChest();
      if (!c) return;
      const cur = Number(c[field]);
      const base = Number.isFinite(cur) ? cur : 0;
      let next = Math.max(min, Math.min(max, base + delta));
      next = isFloat ? Math.round(next * 100) / 100 : Math.round(next);
      this.updateSelectedChestField(field, next);
      this.syncChestControlInputs?.();
    };

    app.syncChestControlInputs = function () {
      const c = this.getSelectedDungeonChest();
      if (!c) return;
      const setPair = (id, val, lblId, lblTxt) => {
        const el = document.getElementById(id);
        if (el) el.value = String(val);
        const l = document.getElementById(lblId);
        if (l) l.textContent = lblTxt;
      };
      const sc = Number(c.visualScale) || 0.36;
      const ox = Number(c.visualOffsetX) || 0;
      const oy = Number(c.visualOffsetY ?? -10);
      setPair('dcScaleRange', sc, 'dcScaleLbl', `🔍 Tamanho no Mapa (${sc.toFixed(2)}x)`);
      setPair('dcScaleNum', sc, '', '');
      setPair('dcOffsetXRange', ox, 'dcOffsetXLbl', `↔️ Posição Horizontal X (${ox >= 0 ? '+' : ''}${ox}px)`);
      setPair('dcOffsetXNum', ox, '', '');
      setPair('dcOffsetYRange', oy, 'dcOffsetYLbl', `📏 Assento no Chão / Z (0px = base no solo: ${oy >= 0 ? '+' : ''}${oy}px)`);
      setPair('dcOffsetYNum', oy, '', '');
    };

    app.updateSelectedChestField = function (field, val) {
      const c = this.getSelectedDungeonChest();
      if (!c) return;
      if (['spawnChancePct', 'visualScale'].includes(field)) c[field] = Number(val) || 0;
      else if (['visualOffsetX', 'visualOffsetY'].includes(field)) c[field] = Math.round(Number(val) || 0);
      else if (field === 'isActive') c[field] = Boolean(val);
      else c[field] = val;

      const sumEl = document.getElementById('dcTotalSpawnSumBadge');
      if (sumEl) {
        const total = (this.dungeonChestsList || []).filter((x) => x.isActive !== false).reduce((a, x) => a + (Number(x.spawnChancePct) || 0), 0);
        sumEl.textContent = `Soma das Chances Ativas: ${total.toFixed(1)}%`;
        sumEl.style.color = Math.abs(total - 100) < 0.05 ? '#86efac' : '#fde047';
      }
    };

    app.addChestTierRow = function (kind) {
      const c = this.getSelectedDungeonChest();
      if (!c) return;
      const key = kind === 'GOLD' ? 'goldRewardsJson' : 'xpRewardsJson';
      if (!Array.isArray(c[key])) c[key] = [];
      c[key].push({ min: kind === 'GOLD' ? 500 : 200, max: kind === 'GOLD' ? 1000 : 400, chancePct: 50 });
      this.renderDungeonChestsTab();
    };

    app.updateChestTierRow = function (kind, idx, field, val) {
      const c = this.getSelectedDungeonChest();
      if (!c) return;
      const key = kind === 'GOLD' ? 'goldRewardsJson' : 'xpRewardsJson';
      if (!Array.isArray(c[key]) || !c[key][idx]) return;
      c[key][idx][field] = Number(val) || 0;
    };

    app.removeChestTierRow = function (kind, idx) {
      const c = this.getSelectedDungeonChest();
      if (!c) return;
      const key = kind === 'GOLD' ? 'goldRewardsJson' : 'xpRewardsJson';
      if (!Array.isArray(c[key])) return;
      c[key].splice(idx, 1);
      this.renderDungeonChestsTab();
    };

    app.addChestItemDropRow = function () {
      const c = this.getSelectedDungeonChest();
      if (!c) return;
      const sel = document.getElementById('dcNewItemDropSelect');
      const itemId = Number(sel?.value || 0);
      if (!itemId) {
        alert('Selecione um item ou equipamento primeiro.');
        return;
      }
      if (!Array.isArray(c.itemDropsJson)) c.itemDropsJson = [];
      c.itemDropsJson.push({ itemTemplateId: itemId, minQty: 1, maxQty: 1, chancePct: 25 });
      this.renderDungeonChestsTab();
    };

    app.updateChestItemDropRow = function (idx, field, val) {
      const c = this.getSelectedDungeonChest();
      if (!c || !Array.isArray(c.itemDropsJson) || !c.itemDropsJson[idx]) return;
      c.itemDropsJson[idx][field] = Number(val) || 0;
    };

    app.removeChestItemDropRow = function (idx) {
      const c = this.getSelectedDungeonChest();
      if (!c || !Array.isArray(c.itemDropsJson)) return;
      c.itemDropsJson.splice(idx, 1);
      this.renderDungeonChestsTab();
    };

    app.filterChestCatalogOptions = function (query) {
      this.dungeonChestItemSearch = String(query || '').trim().toLowerCase();
      const sel = document.getElementById('dcNewItemDropSelect');
      if (!sel) return;
      sel.innerHTML = AdminDungeonChestsTab.buildItemCatalogOptionsHtml(this);
    };

    app.saveSelectedDungeonChest = async function () {
      const c = this.getSelectedDungeonChest();
      if (!c) return;
      try {
        const updated = await this.api(`/api/admin/dungeon-chests/${c.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            namePtBr: c.namePtBr,
            imageUrl: c.imageUrl,
            spawnChancePct: c.spawnChancePct,
            visualScale: c.visualScale,
            visualOffsetX: c.visualOffsetX,
            visualOffsetY: c.visualOffsetY,
            glowColorHex: c.glowColorHex,
            goldRewardsJson: c.goldRewardsJson,
            xpRewardsJson: c.xpRewardsJson,
            itemDropsJson: c.itemDropsJson,
            isActive: c.isActive !== false,
          }),
        });
        const idx = (this.dungeonChestsList || []).findIndex((x) => x.id === updated.id);
        if (idx >= 0) this.dungeonChestsList[idx] = updated;
        this.renderDungeonChestsTab();
        alert(`✅ Configurações de "${updated.namePtBr}" salvas com sucesso no banco!`);
      } catch (err) {
        alert(`Erro ao salvar Baú: ${err.message}`);
      }
    };

    app.renderDungeonChestsTab = function () {
      const cardsEl = document.getElementById('dcChestCardsBar');
      const formEl = document.getElementById('dcChestEditorForm');
      if (!cardsEl || !formEl) return;

      const list = this.dungeonChestsList || [];
      const totalActive = list.filter((x) => x.isActive !== false).reduce((a, x) => a + (Number(x.spawnChancePct) || 0), 0);
      const sumEl = document.getElementById('dcTotalSpawnSumBadge');
      if (sumEl) {
        sumEl.textContent = `Soma das Chances Ativas: ${totalActive.toFixed(1)}%`;
        sumEl.style.color = Math.abs(totalActive - 100) < 0.05 ? '#86efac' : '#fde047';
      }

      cardsEl.innerHTML = list
        .map((c) => {
          const isSel = Number(c.id) === Number(this.selectedDungeonChestId);
          const glow = c.glowColorHex || '#38bdf8';
          const dropCount = Array.isArray(c.itemDropsJson) ? c.itemDropsJson.length : 0;
          return `
            <div onclick="AdminApp.selectDungeonChest(${c.id})" style="cursor:pointer; display:flex; align-items:center; gap:12px; padding:10px 14px; border-radius:12px; background:${isSel ? 'rgba(30,41,59,0.95)' : 'rgba(15,23,42,0.72)'}; border:2px solid ${isSel ? glow : '#334155'}; box-shadow:${isSel ? `0 0 16px ${glow}44` : 'none'}; transition:0.15s;">
              <img src="${this.escapeHtml(c.imageUrl)}" style="width:54px; height:54px; object-fit:contain; filter:drop-shadow(0 0 8px ${glow}88);" />
              <div style="flex:1; min-width:0;">
                <div style="font-size:0.88rem; font-weight:800; color:${glow};">${this.escapeHtml(c.namePtBr)}</div>
                <div style="font-size:0.74rem; color:#e2e8f0;">Spawn: <strong>${Number(c.spawnChancePct)}%</strong> • Escala: ${Number(c.visualScale).toFixed(2)}x</div>
                <div style="font-size:0.68rem; color:#94a3b8;">${dropCount} drop(s) de itens • ${c.isActive !== false ? '✅ Ativo' : '🚫 Inativo'}</div>
              </div>
            </div>
          `;
        })
        .join('');

      const c = this.getSelectedDungeonChest();
      if (!c) {
        formEl.innerHTML = '<div style="color:#94a3b8; padding:16px;">Nenhum baú encontrado.</div>';
        return;
      }

      const goldRows = Array.isArray(c.goldRewardsJson) ? c.goldRewardsJson : [];
      const xpRows = Array.isArray(c.xpRewardsJson) ? c.xpRewardsJson : [];
      const itemRows = Array.isArray(c.itemDropsJson) ? c.itemDropsJson : [];
      const itemById = new Map((this.dungeonChestItemsCatalog || []).map((it) => [Number(it.id), it]));

      const renderTierTable = (kind, rows, label, color) => {
        const sumPct = rows.reduce((a, r) => a + (Number(r.chancePct) || 0), 0);
        return `
          <div style="background:#020617; border:1px solid #334155; border-radius:10px; padding:10px; display:flex; flex-direction:column; gap:8px;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
              <div>
                <strong style="color:${color}; font-size:0.82rem;">${label}</strong>
                <span style="font-size:0.7rem; color:#94a3b8; margin-left:8px;">Soma chances: <b style="color:${Math.abs(sumPct - 100) < 0.1 ? '#86efac' : '#fde047'}">${sumPct}%</b> (Ex: 1000..1000 @ 70% e 10000..10000 @ 30%)</span>
              </div>
              <button type="button" class="btn-primary" style="padding:4px 10px; font-size:0.72rem;" onclick="AdminApp.addChestTierRow('${kind}')">➕ Adicionar Faixa</button>
            </div>
            ${
              rows.length === 0
                ? '<div style="font-size:0.74rem; color:#64748b;">Nenhuma faixa cadastrada (concede 0).</div>'
                : rows
                    .map(
                      (r, i) => `
                  <div style="display:grid; grid-template-columns:1fr 1fr 110px auto; gap:6px; align-items:center;">
                    <label style="font-size:0.68rem; color:#94a3b8;">Mínimo<input type="number" min="0" value="${Number(r.min) || 0}" oninput="AdminApp.updateChestTierRow('${kind}', ${i}, 'min', this.value)" style="width:100%; padding:4px 6px; margin-top:2px;" /></label>
                    <label style="font-size:0.68rem; color:#94a3b8;">Máximo<input type="number" min="0" value="${Number(r.max) || 0}" oninput="AdminApp.updateChestTierRow('${kind}', ${i}, 'max', this.value)" style="width:100%; padding:4px 6px; margin-top:2px;" /></label>
                    <label style="font-size:0.68rem; color:#94a3b8;">Chance (%)<input type="number" min="0" max="100" step="0.5" value="${Number(r.chancePct) || 0}" oninput="AdminApp.updateChestTierRow('${kind}', ${i}, 'chancePct', this.value)" style="width:100%; padding:4px 6px; margin-top:2px;" /></label>
                    <button type="button" class="btn-danger" style="padding:5px 8px; margin-top:14px;" onclick="AdminApp.removeChestTierRow('${kind}', ${i})">🗑️</button>
                  </div>
                `
                    )
                    .join('')
            }
          </div>
        `;
      };

      const itemRowsHtml =
        itemRows.length === 0
          ? '<div style="font-size:0.74rem; color:#64748b;">Nenhum drop de item configurado neste baú.</div>'
          : itemRows
              .map((d, i) => {
                const it = itemById.get(Number(d.itemTemplateId));
                return `
                  <div style="display:grid; grid-template-columns:1fr 78px 78px 92px auto; gap:6px; align-items:center; background:#0f172a; border:1px solid #1e293b; border-radius:8px; padding:6px 8px;">
                    <div style="display:flex; align-items:center; gap:8px; min-width:0;">
                      ${it?.iconUrl ? `<img src="${this.escapeHtml(it.iconUrl)}" style="width:28px; height:28px; object-fit:contain; background:#020617; border-radius:5px; border:1px solid #334155;" />` : ''}
                      <div style="min-width:0;">
                        <div style="font-size:0.76rem; font-weight:700; color:#f8fafc; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">#${d.itemTemplateId} ${this.escapeHtml(it?.namePtBr || 'Item Desconhecido')}</div>
                        <div style="font-size:0.64rem; color:#94a3b8;">${this.escapeHtml(it?.itemCategory || '')} ${it?.rarityTier ? `• Rank ${it.rarityTier}` : ''}</div>
                      </div>
                    </div>
                    <label style="font-size:0.64rem; color:#94a3b8;">Qtd Mín<input type="number" min="1" value="${Number(d.minQty) || 1}" oninput="AdminApp.updateChestItemDropRow(${i}, 'minQty', this.value)" style="width:100%; padding:3px 5px;" /></label>
                    <label style="font-size:0.64rem; color:#94a3b8;">Qtd Máx<input type="number" min="1" value="${Number(d.maxQty) || 1}" oninput="AdminApp.updateChestItemDropRow(${i}, 'maxQty', this.value)" style="width:100%; padding:3px 5px;" /></label>
                    <label style="font-size:0.64rem; color:#94a3b8;">Chance %<input type="number" min="0.01" max="100" step="0.1" value="${Number(d.chancePct) || 0}" oninput="AdminApp.updateChestItemDropRow(${i}, 'chancePct', this.value)" style="width:100%; padding:3px 5px;" /></label>
                    <button type="button" class="btn-danger" style="padding:5px 8px;" onclick="AdminApp.removeChestItemDropRow(${i})">🗑️</button>
                  </div>
                `;
              })
              .join('');

      formEl.innerHTML = `
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 140px), 1fr)); gap:8px; align-items:end;">
          <div class="field" style="margin:0;"><label>Nome do Baú</label><input type="text" value="${this.escapeHtml(c.namePtBr)}" oninput="AdminApp.updateSelectedChestField('namePtBr', this.value)" /></div>
          <div class="field" style="margin:0;"><label>Chance de Spawn (%)</label><input type="number" min="0" max="100" step="0.5" value="${Number(c.spawnChancePct)}" oninput="AdminApp.updateSelectedChestField('spawnChancePct', this.value)" /></div>
          <div class="field" style="margin:0;"><label>Cor Aura</label><input type="color" value="${this.escapeHtml(c.glowColorHex || '#38bdf8')}" oninput="AdminApp.updateSelectedChestField('glowColorHex', this.value)" style="height:36px; width:100%; padding:2px;" /></div>
          <label style="display:flex; align-items:center; gap:5px; font-size:0.78rem; padding-bottom:8px; cursor:pointer;"><input type="checkbox" ${c.isActive !== false ? 'checked' : ''} onchange="AdminApp.updateSelectedChestField('isActive', this.checked)" /> Ativo</label>
        </div>

        <div style="background:#020617; border:1px solid #334155; border-radius:10px; padding:10px; display:flex; flex-direction:column; gap:10px;">
          <!-- Distância do Baú ao Chão (Z / Offset Y) -->
          <div class="field" style="margin:0;">
            <label id="dcOffsetYLbl" style="color:#fde047; font-weight:700;">📏 Assento no Chão / Z (0px = base no solo: ${Number(c.visualOffsetY ?? -10) >= 0 ? '+' : ''}${Number(c.visualOffsetY ?? -10)}px)</label>
            <input id="dcOffsetYRange" type="range" min="-140" max="140" step="1" value="${Number(c.visualOffsetY ?? -10)}" oninput="AdminApp.updateSelectedChestField('visualOffsetY', this.value); AdminApp.syncChestControlInputs()" style="width:100%; margin:3px 0;" />
            <div style="display:grid; grid-template-columns:auto auto 1fr auto auto auto; gap:4px; align-items:center;">
              <button type="button" onclick="AdminApp.nudgeSelectedChestField('visualOffsetY', -5, -140, 140)" style="padding:6px 8px; min-height:34px;">⬆ -5</button>
              <button type="button" onclick="AdminApp.nudgeSelectedChestField('visualOffsetY', -1, -140, 140)" style="padding:6px 8px; min-height:34px;">-1</button>
              <input id="dcOffsetYNum" type="number" min="-140" max="140" value="${Number(c.visualOffsetY ?? -10)}" oninput="AdminApp.updateSelectedChestField('visualOffsetY', this.value); AdminApp.syncChestControlInputs()" style="text-align:center; min-height:34px;" />
              <button type="button" onclick="AdminApp.nudgeSelectedChestField('visualOffsetY', 1, -140, 140)" style="padding:6px 8px; min-height:34px;">+1</button>
              <button type="button" onclick="AdminApp.nudgeSelectedChestField('visualOffsetY', 5, -140, 140)" style="padding:6px 8px; min-height:34px;">+5 ⬇</button>
              <button type="button" onclick="AdminApp.updateSelectedChestField('visualOffsetY', 0); AdminApp.syncChestControlInputs()" style="padding:6px 7px; min-height:34px;" title="Zerar Z">↩0</button>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 210px), 1fr)); gap:10px;">
            <div class="field" style="margin:0;">
              <label id="dcScaleLbl">🔍 Tamanho no Mapa (${Number(c.visualScale || 0.36).toFixed(2)}x)</label>
              <input id="dcScaleRange" type="range" min="0.15" max="1.20" step="0.01" value="${Number(c.visualScale) || 0.36}" oninput="AdminApp.updateSelectedChestField('visualScale', this.value); AdminApp.syncChestControlInputs()" style="width:100%; margin:3px 0;" />
              <div style="display:grid; grid-template-columns:auto 1fr auto; gap:4px; align-items:center;">
                <button type="button" onclick="AdminApp.nudgeSelectedChestField('visualScale', -0.02, 0.15, 1.20, true)" style="padding:6px 10px; min-height:34px;">-0.02</button>
                <input id="dcScaleNum" type="number" min="0.15" max="1.20" step="0.01" value="${Number(c.visualScale) || 0.36}" oninput="AdminApp.updateSelectedChestField('visualScale', this.value); AdminApp.syncChestControlInputs()" style="text-align:center; min-height:34px;" />
                <button type="button" onclick="AdminApp.nudgeSelectedChestField('visualScale', 0.02, 0.15, 1.20, true)" style="padding:6px 10px; min-height:34px;">+0.02</button>
              </div>
            </div>
            <div class="field" style="margin:0;">
              <label id="dcOffsetXLbl">↔️ Posição Horizontal X (${Number(c.visualOffsetX) || 0}px)</label>
              <input id="dcOffsetXRange" type="range" min="-120" max="120" step="1" value="${Number(c.visualOffsetX) || 0}" oninput="AdminApp.updateSelectedChestField('visualOffsetX', this.value); AdminApp.syncChestControlInputs()" style="width:100%; margin:3px 0;" />
              <div style="display:grid; grid-template-columns:auto 1fr auto auto; gap:4px; align-items:center;">
                <button type="button" onclick="AdminApp.nudgeSelectedChestField('visualOffsetX', -2, -120, 120)" style="padding:6px 10px; min-height:34px;">-2</button>
                <input id="dcOffsetXNum" type="number" min="-120" max="120" value="${Number(c.visualOffsetX) || 0}" oninput="AdminApp.updateSelectedChestField('visualOffsetX', this.value); AdminApp.syncChestControlInputs()" style="text-align:center; min-height:34px;" />
                <button type="button" onclick="AdminApp.nudgeSelectedChestField('visualOffsetX', 2, -120, 120)" style="padding:6px 10px; min-height:34px;">+2</button>
                <button type="button" onclick="AdminApp.updateSelectedChestField('visualOffsetX', 0); AdminApp.syncChestControlInputs()" style="padding:6px 7px; min-height:34px;">↩0</button>
              </div>
            </div>
          </div>
        </div>

        ${renderTierTable('GOLD', goldRows, '🪙 Recompensas Extras de Ouro do Baú', '#fde047')}
        ${renderTierTable('XP', xpRows, '⭐ Recompensas Extras de XP do Baú', '#7dd3fc')}

        <div style="background:#020617; border:1px solid #334155; border-radius:10px; padding:10px; display:flex; flex-direction:column; gap:8px;">
          <strong style="color:#86efac; font-size:0.82rem;">🎒 Lista de Itens & Equipamentos do Baú (Drops Independentes)</strong>
          <div style="display:grid; grid-template-columns:180px 1fr auto; gap:6px; align-items:center;">
            <input type="text" placeholder="🔍 Filtrar catálogo..." value="${this.escapeHtml(this.dungeonChestItemSearch || '')}" oninput="AdminApp.filterChestCatalogOptions(this.value)" style="padding:5px 8px; font-size:0.74rem;" />
            <select id="dcNewItemDropSelect" style="padding:5px 8px; font-size:0.74rem;">${AdminDungeonChestsTab.buildItemCatalogOptionsHtml(this)}</select>
            <button type="button" class="btn-success" style="padding:5px 12px; font-size:0.74rem;" onclick="AdminApp.addChestItemDropRow()">➕ Adicionar Item</button>
          </div>
          <div style="display:flex; flex-direction:column; gap:5px; max-height:240px; overflow-y:auto;">${itemRowsHtml}</div>
        </div>

        <div style="display:flex; justify-content:flex-end;">
          <button type="button" class="btn-success" style="padding:9px 20px; font-weight:800; font-size:0.85rem;" onclick="AdminApp.saveSelectedDungeonChest()">💾 Salvar Configurações do Baú</button>
        </div>
      `;
    };
  }

  static buildItemCatalogOptionsHtml(app) {
    const q = (app.dungeonChestItemSearch || '').trim().toLowerCase();
    const list = (app.dungeonChestItemsCatalog || []).filter((it) => {
      if (!q) return true;
      return (
        String(it.namePtBr || '').toLowerCase().includes(q) ||
        String(it.code || '').toLowerCase().includes(q) ||
        String(it.itemCategory || '').toLowerCase().includes(q) ||
        String(it.id) === q
      );
    });
    return list
      .slice(0, 150)
      .map(
        (it) =>
          `<option value="${it.id}">[#${it.id}] ${app.escapeHtml(it.namePtBr)} (${it.itemCategory}${it.rarityTier ? ' • ' + it.rarityTier : ''})</option>`
      )
      .join('');
  }

  static async ensurePreviewRefs(app) {
    const mapSel = document.getElementById('dcPreviewMapSelect');
    const clsSel = document.getElementById('dcPreviewClassSelect');
    let maps = Array.isArray(app?.savedMaps) && app.savedMaps.length > 0
      ? app.savedMaps
      : (Array.isArray(app?.mapsList) ? app.mapsList : []);
    let classes = Array.isArray(app?.classTemplates) && app.classTemplates.length > 0
      ? app.classTemplates
      : (Array.isArray(this.previewClassesCache) ? this.previewClassesCache : []);

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
      } catch {}
    }

    this.previewClassesCache = classes;

    if (mapSel && mapSel.options.length === 0 && maps.length > 0) {
      const sorted = [...maps].sort((a, b) => (b.mapType?.code === 'DUNGEON' ? 1 : 0) - (a.mapType?.code === 'DUNGEON' ? 1 : 0));
      mapSel.innerHTML = sorted
        .map((m) => `<option value="${m.id}">${m.mapType?.code === 'DUNGEON' ? '🏰 ' : '🗺️ '}#${m.id} ${m.namePtBr}</option>`)
        .join('');
    }
    if (clsSel && clsSel.options.length === 0 && classes.length > 0) {
      clsSel.innerHTML = classes
        .map((c, idx) => `<option value="${c.id}" ${idx === 0 ? 'selected' : ''}>👤 #${c.id} ${c.namePtBr}</option>`)
        .join('');
    }

    const mapId = Number(mapSel?.value || maps.find((m) => m.mapType?.code === 'DUNGEON')?.id || 1);
    if (this.previewMapId !== mapId) {
      this.previewMapId = mapId;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = `/api/assets/map-image/${mapId}`;
      this.previewMapImg = img;
    }

    const selClassId = Number(clsSel?.value || classes[0]?.id || 0);
    const chosenCls = classes.find((c) => Number(c.id) === selClassId) || classes[0];
    const key = chosenCls?.mcreworkCharKey || 'char_000001';
    this.previewHeroGroundY = Number(chosenCls?.groundOffsetY) || 0;
    if (key && this.previewHeroKey !== key && window.McreworkSpriteSheet) {
      this.previewHeroKey = key;
      this.previewHeroSprite = new window.McreworkSpriteSheet(
        `/api/assets/mcrework/assets/characters/${key}/atlas.json`,
        `/api/assets/mcrework/assets/characters/${key}/atlas.webp`,
        `/api/assets/mcrework/assets/characters/${key}/thumb.webp`
      );
      this.previewHeroSprite.load();
    }
  }

  static startPreviewLoop(app) {
    if (this.previewAnimId !== null) cancelAnimationFrame(this.previewAnimId);
    void this.ensurePreviewRefs(app);
    const loop = (now) => {
      const tab = document.getElementById('tabDungeonChests');
      if (!tab || tab.style.display === 'none') {
        this.previewAnimId = null;
        return;
      }
      this.renderPreviewCanvas(app, now);
      this.previewAnimId = requestAnimationFrame(loop);
    };
    this.previewAnimId = requestAnimationFrame(loop);
  }

  static renderPreviewCanvas(app, now) {
    const canvas = document.getElementById('dcPreviewCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    if (this.previewMapImg && this.previewMapImg.complete && this.previewMapImg.naturalWidth > 0) {
      const iw = this.previewMapImg.naturalWidth;
      const ih = this.previewMapImg.naturalHeight;
      const sx = Math.max(0, Math.round((iw - W) / 2));
      const sy = Math.max(0, Math.round((ih - H) / 2));
      ctx.drawImage(this.previewMapImg, sx, sy, Math.min(W, iw), Math.min(H, ih), 0, 0, W, H);
    } else {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, W, H);
    }

    const chest = app.getSelectedDungeonChest();
    if (!chest) return;

    const anchorX = Math.round(W * 0.60);
    const anchorY = Math.round(H * 0.68);
    // Marca do ponto de morte do último monstro e linha de referência do solo (Z = 0)
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(anchorX, anchorY, 16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(253, 224, 71, 0.55)';
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(anchorX - 64, anchorY);
    ctx.lineTo(anchorX + 64, anchorY);
    ctx.stroke();
    ctx.restore();

    const mode = this.previewHeroDepthMode || 'SIDE';
    const heroX = mode === 'SIDE' ? Math.round(W * 0.28) : anchorX - 28;
    const heroY = mode === 'BEHIND' ? anchorY - 26 : (mode === 'FRONT' ? anchorY + 28 : anchorY);
    const entities = [
      { kind: 'HERO', y: heroY },
      { kind: 'CHEST', y: anchorY },
    ].sort((a, b) => a.y - b.y);

    for (const ent of entities) {
      if (ent.kind === 'HERO') {
        if (this.previewHeroSprite) {
          this.previewHeroSprite.draw(ctx, heroX, heroY, 0, 2, now, null, this.previewHeroGroundY || 0, 0.70, false, 0, 0, false);
        }
      } else if (window.PlayDungeonChestController?.renderChestAt) {
        window.PlayDungeonChestController.renderChestAt(ctx, chest, anchorX, anchorY, now, {
          isPreview: true,
          labelText: `✨ ${chest.namePtBr} (${Number(chest.spawnChancePct)}%)`,
        });
      }
    }
  }

  static injectTabDom() {
    const adminApp = document.getElementById('adminApp');
    if (!adminApp || document.getElementById('tabDungeonChests')) return;
    const panel = document.createElement('div');
    panel.id = 'tabDungeonChests';
    panel.style.cssText = 'display:none; flex-direction:column; gap:12px; padding:12px 16px; max-width:1520px; margin:0 auto; width:100%; box-sizing:border-box;';
    panel.innerHTML = `
      <div class="panel" style="padding:12px 16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        <div>
          <strong style="color:#e9d5ff; font-size:1rem;">🎁 Baús de Recompensa de Dungeons</strong>
          <div style="font-size:0.75rem; color:#94a3b8;">Aparecem no lugar do último monstro eliminado (além do XP, Ouro e drops naturais dos monstros).</div>
        </div>
        <span id="dcTotalSpawnSumBadge" style="font-size:0.82rem; font-weight:800; padding:5px 12px; border-radius:999px; background:#020617; border:1px solid #334155;"></span>
      </div>

      <div id="dcChestCardsBar" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(250px, 1fr)); gap:10px;"></div>

      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 340px), 1fr)); gap:12px; align-items:start;">
        <div class="panel" style="padding:12px; display:flex; flex-direction:column; gap:8px;">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:6px; flex-wrap:wrap;">
            <strong style="font-size:0.84rem; color:#38bdf8;">🎬 Preview 2.5D no Mapa</strong>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:5px; width:100%;">
              <select id="dcPreviewMapSelect" onchange="AdminDungeonChestsTab.ensurePreviewRefs(AdminApp)" style="padding:5px 6px; font-size:0.72rem; min-height:34px;"></select>
              <select id="dcPreviewClassSelect" onchange="AdminDungeonChestsTab.ensurePreviewRefs(AdminApp)" style="padding:5px 6px; font-size:0.72rem; min-height:34px;"></select>
            </div>
          </div>
          <canvas id="dcPreviewCanvas" width="366" height="260" style="width:100%; border-radius:10px; border:1.5px solid #334155; background:#020617;"></canvas>
          <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:5px;">
            <button type="button" id="dcDepthBtnBEHIND" onclick="AdminDungeonChestsTab.setPreviewHeroDepthMode('BEHIND')" style="font-size:0.70rem; padding:5px;">⬆️ Herói Atrás</button>
            <button type="button" id="dcDepthBtnSIDE" class="btn-primary" onclick="AdminDungeonChestsTab.setPreviewHeroDepthMode('SIDE')" style="font-size:0.70rem; padding:5px;">↔️ Ao Lado</button>
            <button type="button" id="dcDepthBtnFRONT" onclick="AdminDungeonChestsTab.setPreviewHeroDepthMode('FRONT')" style="font-size:0.70rem; padding:5px;">⬇️ Na Frente</button>
          </div>
          <div style="font-size:0.7rem; color:#94a3b8; line-height:1.35;">
            A linha tracejada dourada e a sombra ficam fixas no solo (Z=0). Use os botões acima para testar a profundidade 2.5D (Y-Sorting) entre o Herói (<code>0.70x</code>) e o Baú.
          </div>
        </div>

        <div id="dcChestEditorForm" class="panel" style="padding:14px; display:flex; flex-direction:column; gap:12px;"></div>
      </div>
    `;
    adminApp.appendChild(panel);
  }
}

window.AdminDungeonChestsTab = AdminDungeonChestsTab;
