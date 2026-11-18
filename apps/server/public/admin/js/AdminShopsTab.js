/**
 * @file apps/server/public/admin/js/AdminShopsTab.js
 * @module @etheria/server
 * @description Submódulo da Aba de Lojas (`shop_templates`) na Rota `/admin`.
 *   Gerencia criação, edição e exclusão de lojas e catálogos de mercadorias
 *   (equipamentos e consumíveis com preços em ouro e requisitos de nível),
 *   que podem ser vinculadas a qualquer NPC (Armeiro, Alquimista, Caçador, Cozinheiro, etc.).
 */

class AdminShopsTab {
  static attach(app) {
    app.shopTemplates = [];
    app.shopEditingId = null;
    app.shopEditingCatalog = [];
    app.shopItemPickerCache = [];
    app.shopItemPickerFilter = '';
    app.shopItemPickerCategory = 'ALL';

    /**
     * Carrega a lista completa de lojas do backend.
     */
    app.loadShops = async function () {
      try {
        const shops = await this.api('/api/admin/shop-templates');
        this.shopTemplates = Array.isArray(shops) ? shops : [];
        this.renderShopsTable();
        this.populateNpcShopDropdown();
      } catch (err) {
        console.error('Erro ao carregar lojas:', err);
      }
    };

    /**
     * Renderiza as linhas da tabela de Lojas no painel administrativo.
     */
    app.renderShopsTable = function () {
      const tbody = document.getElementById('shopsTableBody');
      if (!tbody) return;

      if (!this.shopTemplates || this.shopTemplates.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" style="color:var(--text-muted); padding:16px; text-align:center;">
              Nenhuma loja cadastrada ainda. Clique em <strong>"➕ Nova Loja"</strong> para criar o catálogo de um mercador!
            </td>
          </tr>`;
        return;
      }

      tbody.innerHTML = this.shopTemplates
        .map((shop) => {
          const catalog = Array.isArray(shop.catalogJson) ? shop.catalogJson : [];
          const npcs = Array.isArray(shop.linkedNpcs) ? shop.linkedNpcs : [];

          // Prévia visual dos primeiros 5 itens do catálogo
          const previewIcons = catalog
            .slice(0, 5)
            .map(
              (item) => `
              <img src="${item.iconUrl || '/play/assets/hud/menu_shop.png'}" 
                   alt="${item.namePtBr}" 
                   title="${item.namePtBr} (${item.priceGold} Ouro)" 
                   style="width:26px; height:26px; object-fit:contain; background:#020617; border:1px solid rgba(255,255,255,0.15); border-radius:4px; padding:2px;" />
            `
            )
            .join('');
          const moreCount = catalog.length > 5 ? `<span style="font-size:0.7rem; color:var(--text-muted); align-self:center;">+${catalog.length - 5}</span>` : '';

          const npcsBadges =
            npcs.length > 0
              ? npcs
                  .map(
                    (npc) => `
                  <span style="display:inline-flex; align-items:center; gap:4px; background:rgba(30,41,59,0.8); border:1px solid var(--border); border-radius:4px; padding:2px 6px; font-size:0.72rem;">
                    🧙 <strong>${npc.namePtBr}</strong> <code style="font-size:0.65rem; color:var(--text-muted);">#${npc.id}</code>
                  </span>`
                  )
                  .join(' ')
              : `<span style="color:var(--text-muted); font-size:0.74rem; font-style:italic;">Nenhum NPC vinculado</span>`;

          const statusBadge = shop.isActive
            ? `<span style="color:#86efac; font-weight:700; font-size:0.75rem;">🟢 Ativa</span>`
            : `<span style="color:#fca5a5; font-size:0.75rem;">🔴 Inativa</span>`;

          return `
            <tr>
              <td><strong>#${shop.id}</strong> &bull; <span style="color:var(--accent); font-family:monospace;">${shop.code}</span></td>
              <td>
                <div style="font-weight:700; color:#f8fafc; font-size:0.86rem;">🏪 ${shop.namePtBr}</div>
                <div style="font-size:0.72rem; color:var(--text-muted);">${shop.descriptionPtBr || 'Sem descrição cadastrada'}</div>
              </td>
              <td>
                <div style="display:flex; align-items:center; gap:4px; flex-wrap:wrap;">
                  ${previewIcons || '<span style="color:var(--text-muted); font-size:0.72rem;">Vazio</span>'}
                  ${moreCount}
                </div>
                <div style="font-size:0.7rem; color:var(--accent); margin-top:3px; font-weight:600;">
                  ${catalog.length} mercadoria(s) à venda
                </div>
              </td>
              <td>
                <div style="display:flex; flex-wrap:wrap; gap:4px; max-width:280px;">
                  ${npcsBadges}
                </div>
              </td>
              <td>${statusBadge}</td>
              <td>
                <div style="display:flex; gap:6px;">
                  <button type="button" class="btn-primary" onclick="AdminApp.openShopModal(${shop.id})" style="padding:4px 10px; font-size:0.78rem;">✏️ Editar</button>
                  <button type="button" class="btn-danger" onclick="AdminApp.deleteShop(${shop.id})" style="padding:4px 8px; font-size:0.78rem;">🗑️</button>
                </div>
              </td>
            </tr>`;
        })
        .join('');
    };

    /**
     * Atualiza o `<select>` de Lojas no modal de NPCs para permitir vincular a loja ao NPC.
     */
    app.populateNpcShopDropdown = function (selectedShopId = null) {
      const select = document.getElementById('npcShopTemplateSelect');
      if (!select) return;

      const curVal = selectedShopId !== null ? String(selectedShopId) : select.value;
      const options = [
        `<option value="">-- Nenhuma Loja Vinculada --</option>`,
        ...(this.shopTemplates || []).map(
          (s) => `<option value="${s.id}">🏪 #${s.id} - ${s.namePtBr} (${(s.catalogJson || []).length} itens)</option>`
        ),
      ];
      select.innerHTML = options.join('');
      select.value = curVal || '';
    };

    /**
     * Carrega a lista completa de itens e equipamentos para o seletor do catálogo.
     */
    app.ensureShopItemPickerCache = async function () {
      if (this.shopItemPickerCache.length > 0) return;
      try {
        const [items, equips] = await Promise.all([
          this.api('/api/admin/items').catch(() => []),
          this.api('/api/admin/equipments').catch(() => []),
        ]);

        const combined = [];
        for (const it of Array.isArray(items) ? items : []) {
          combined.push({
            entryType: 'ITEM',
            targetId: it.id,
            namePtBr: it.namePtBr,
            code: it.code,
            iconUrl: it.iconUrl,
            subType: it.itemCategory || 'ITEM',
            rarity: it.rarityTier || 'COMMON',
            requiredLevel: it.requiredLevel || 1,
            defaultPrice: it.priceGold || 10,
          });
        }
        for (const eq of Array.isArray(equips) ? equips : []) {
          combined.push({
            entryType: 'EQUIPMENT',
            targetId: eq.id,
            namePtBr: eq.namePtBr,
            code: eq.code,
            iconUrl: eq.iconUrl,
            subType: eq.equipmentSlotCode || eq.itemCategory || 'EQUIPMENT',
            rarity: eq.rarityTier || 'F',
            requiredLevel: eq.requiredLevel || 1,
            defaultPrice: eq.priceGold || 100,
          });
        }

        this.shopItemPickerCache = combined;
      } catch (err) {
        console.error('Erro ao carregar catálogo para a loja:', err);
      }
    };

    /**
     * Abre o modal de criação / edição de Loja.
     */
    app.openShopModal = async function (shopId = null) {
      this.shopEditingId = shopId;
      const modal = document.getElementById('shopModal');
      if (!modal) return;
      modal.style.display = 'flex';

      await this.ensureShopItemPickerCache();

      const titleEl = document.getElementById('shopModalTitle');
      const nameInput = document.getElementById('shopNameInput');
      const descInput = document.getElementById('shopDescInput');
      const activeInput = document.getElementById('shopActiveInput');

      if (shopId) {
        const existing = this.shopTemplates.find((s) => s.id === Number(shopId));
        if (existing) {
          titleEl.textContent = `🏪 Editar Loja #${existing.id} (${existing.code})`;
          nameInput.value = existing.namePtBr || '';
          descInput.value = existing.descriptionPtBr || '';
          activeInput.checked = Boolean(existing.isActive);
          this.shopEditingCatalog = JSON.parse(JSON.stringify(existing.catalogJson || []));
        }
      } else {
        const nextId = (this.shopTemplates || []).reduce((acc, s) => Math.max(acc, s.id || 0), 0) + 1;
        titleEl.textContent = `🏪 Cadastrar Nova Loja #${nextId}`;
        nameInput.value = '';
        descInput.value = '';
        activeInput.checked = true;
        this.shopEditingCatalog = [];
      }

      this.renderShopCatalogList();
      this.renderShopItemPicker();
    };

    /**
     * Renderiza a lista de itens atualmente no catálogo da loja aberta no modal.
     */
    app.renderShopCatalogList = function () {
      const container = document.getElementById('shopCatalogList');
      if (!container) return;

      const countBadge = document.getElementById('shopCatalogCountBadge');
      if (countBadge) {
        countBadge.textContent = `${this.shopEditingCatalog.length} mercadoria(s)`;
      }

      if (this.shopEditingCatalog.length === 0) {
        container.innerHTML = `
          <div style="color:var(--text-muted); font-size:0.78rem; text-align:center; padding:18px; border:1px dashed var(--border); border-radius:8px;">
            Nenhum item adicionado ao catálogo ainda.<br>
            Utilize a busca ao lado para adicionar equipamentos ou itens à venda!
          </div>`;
        return;
      }

      container.innerHTML = this.shopEditingCatalog
        .map((entry, index) => {
          const isEquip = entry.entryType === 'EQUIPMENT';
          return `
            <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; background:rgba(15,23,42,0.85); border:1px solid var(--border); border-radius:8px; padding:6px 10px;">
              <div style="display:flex; align-items:center; gap:8px; flex:1; min-width:0;">
                <img src="${entry.iconUrl || '/play/assets/hud/menu_shop.png'}" alt="" style="width:36px; height:36px; object-fit:contain; background:#020617; border:1px solid var(--border); border-radius:6px; flex-shrink:0;" />
                <div style="min-width:0;">
                  <strong style="font-size:0.82rem; color:#f8fafc; display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                    ${entry.namePtBr}
                  </strong>
                  <span style="font-size:0.68rem; color:var(--text-muted);">
                    <span style="color:${isEquip ? '#67e8f9' : '#86efac'}; font-weight:700;">[${isEquip ? 'Equipamento' : 'Item'}]</span>
                    ${entry.subType} &bull; Raridade: <strong>${entry.rarity}</strong>
                  </span>
                </div>
              </div>
              <div style="display:flex; align-items:center; gap:8px;">
                <div style="display:flex; flex-direction:column; width:80px;">
                  <label style="font-size:0.65rem; color:#fde047; font-weight:700;">Preço (Ouro)</label>
                  <input type="number" min="0" value="${entry.priceGold}" 
                         onchange="AdminApp.updateShopCatalogEntry(${index}, 'priceGold', this.value)" 
                         style="padding:3px 6px; font-size:0.75rem; background:#020617; border:1px solid var(--border); border-radius:4px; color:#fde047; font-weight:700;" />
                </div>
                <div style="display:flex; flex-direction:column; width:65px;">
                  <label style="font-size:0.65rem; color:var(--text-muted);">Nível Mín.</label>
                  <input type="number" min="1" max="999" value="${entry.requiredLevel || 1}" 
                         onchange="AdminApp.updateShopCatalogEntry(${index}, 'requiredLevel', this.value)" 
                         style="padding:3px 6px; font-size:0.75rem; background:#020617; border:1px solid var(--border); border-radius:4px;" />
                </div>
                <div style="display:flex; flex-direction:column; width:65px;">
                  <label style="font-size:0.65rem; color:var(--text-muted);">Lote Máx</label>
                  <input type="number" min="1" max="999" value="${entry.maxBatchBuy || (isEquip ? 1 : 99)}" 
                         ${isEquip ? 'disabled' : ''} 
                         onchange="AdminApp.updateShopCatalogEntry(${index}, 'maxBatchBuy', this.value)" 
                         style="padding:3px 6px; font-size:0.75rem; background:#020617; border:1px solid var(--border); border-radius:4px;" />
                </div>
                <button type="button" class="btn-danger" onclick="AdminApp.removeShopCatalogEntry(${index})" style="padding:4px 8px; font-size:0.75rem; margin-top:12px;">✕</button>
              </div>
            </div>
          `;
        })
        .join('');
    };

    app.updateShopCatalogEntry = function (index, field, value) {
      if (!this.shopEditingCatalog[index]) return;
      const num = Math.max(0, Math.round(Number(value) || 0));
      this.shopEditingCatalog[index][field] = num;
    };

    app.removeShopCatalogEntry = function (index) {
      this.shopEditingCatalog.splice(index, 1);
      this.renderShopCatalogList();
      this.renderShopItemPicker();
    };

    /**
     * Renderiza o seletor de itens para adicionar à loja.
     */
    app.renderShopItemPicker = function () {
      const grid = document.getElementById('shopItemPickerGrid');
      if (!grid) return;

      const q = (this.shopItemPickerFilter || '').toLowerCase().trim();
      const cat = this.shopItemPickerCategory || 'ALL';

      const existingKeys = new Set(this.shopEditingCatalog.map((e) => `${e.entryType}_${e.targetId}`));

      const filtered = (this.shopItemPickerCache || []).filter((it) => {
        if (cat === 'ITEM' && it.entryType !== 'ITEM') return false;
        if (cat === 'EQUIPMENT' && it.entryType !== 'EQUIPMENT') return false;
        if (q && !it.namePtBr.toLowerCase().includes(q) && !it.code.toLowerCase().includes(q)) return false;
        return true;
      });

      if (filtered.length === 0) {
        grid.innerHTML = `<div style="grid-column:1/-1; color:var(--text-muted); font-size:0.75rem; text-align:center; padding:12px;">Nenhum item encontrado.</div>`;
        return;
      }

      grid.innerHTML = filtered
        .slice(0, 100)
        .map((it) => {
          const isAdded = existingKeys.has(`${it.entryType}_${it.targetId}`);
          return `
            <div style="display:flex; align-items:center; justify-content:space-between; gap:6px; background:${isAdded ? 'rgba(74,222,128,0.1)' : 'rgba(15,23,42,0.8)'}; border:1px solid ${isAdded ? '#4ade80' : 'var(--border)'}; border-radius:6px; padding:4px 8px;">
              <div style="display:flex; align-items:center; gap:6px; min-width:0; flex:1;">
                <img src="${it.iconUrl || '/play/assets/hud/menu_shop.png'}" alt="" style="width:28px; height:28px; object-fit:contain; background:#020617; border-radius:4px;" />
                <div style="min-width:0;">
                  <strong style="font-size:0.76rem; color:#f8fafc; display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${it.namePtBr}</strong>
                  <span style="font-size:0.65rem; color:var(--text-muted);">${it.subType} &bull; Lvl ${it.requiredLevel}</span>
                </div>
              </div>
              ${
                isAdded
                  ? `<span style="font-size:0.68rem; color:#4ade80; font-weight:700;">Adicionado</span>`
                  : `<button type="button" class="btn-primary" onclick="AdminApp.addItemToShopCatalog('${it.entryType}', ${it.targetId})" style="padding:2px 8px; font-size:0.72rem;">➕ Adicionar</button>`
              }
            </div>
          `;
        })
        .join('');
    };

    app.filterShopItemPicker = function (query) {
      this.shopItemPickerFilter = query;
      this.renderShopItemPicker();
    };

    app.setShopItemPickerCategory = function (category) {
      this.shopItemPickerCategory = category;
      this.renderShopItemPicker();
    };

    app.addItemToShopCatalog = function (entryType, targetId) {
      const meta = (this.shopItemPickerCache || []).find((it) => it.entryType === entryType && it.targetId === Number(targetId));
      if (!meta) return;

      this.shopEditingCatalog.push({
        entryType,
        targetId: meta.targetId,
        priceGold: meta.defaultPrice || 50,
        currencyType: 'GOLD',
        requiredLevel: meta.requiredLevel || 1,
        maxBatchBuy: entryType === 'EQUIPMENT' ? 1 : 99,
        namePtBr: meta.namePtBr,
        code: meta.code,
        iconUrl: meta.iconUrl,
        subType: meta.subType,
        rarity: meta.rarity,
      });

      this.renderShopCatalogList();
      this.renderShopItemPicker();
    };

    /**
     * Salva as alterações da loja no backend (POST ou PUT).
     */
    app.saveShop = async function () {
      const name = (document.getElementById('shopNameInput')?.value || '').trim();
      const description = (document.getElementById('shopDescInput')?.value || '').trim();
      const isActive = document.getElementById('shopActiveInput')?.checked ?? true;

      if (!name) {
        alert('Por favor, informe o Nome da Loja.');
        return;
      }

      const payload = {
        namePtBr: name,
        descriptionPtBr: description,
        isActive,
        catalogJson: this.shopEditingCatalog.map((e) => ({
          entryType: e.entryType,
          targetId: e.targetId,
          priceGold: e.priceGold,
          currencyType: e.currencyType || 'GOLD',
          requiredLevel: e.requiredLevel || 1,
          maxBatchBuy: e.maxBatchBuy || 99,
        })),
      };

      try {
        if (this.shopEditingId) {
          await this.api(`/api/admin/shop-templates/${this.shopEditingId}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          });
        } else {
          await this.api('/api/admin/shop-templates', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
        }

        this.closeModal('shopModal');
        await this.loadShops();
        alert('✅ Loja e catálogo salvos com sucesso!');
      } catch (err) {
        alert(`Erro ao salvar loja: ${err.message}`);
      }
    };

    /**
     * Exclui uma loja após confirmação.
     */
    app.deleteShop = async function (id) {
      if (!confirm('Deseja realmente excluir esta loja?\nOs NPCs que estavam vinculados a ela permanecerão no jogo, apenas com a função de loja desvinculada.')) {
        return;
      }

      try {
        await this.api(`/api/admin/shop-templates/${id}`, { method: 'DELETE' });
        await this.loadShops();
        alert('✅ Loja excluída com sucesso!');
      } catch (err) {
        alert(`Erro ao excluir loja: ${err.message}`);
      }
    };
  }
}

window.AdminShopsTab = AdminShopsTab;
