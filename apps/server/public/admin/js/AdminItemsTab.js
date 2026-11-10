/**
 * @file apps/server/public/admin/js/AdminItemsTab.js
 * @module @etheria/server
 * @description Submódulo da Aba Tabela de Cadastro de Itens Não-Equipamento (`item_templates`) da Rota `/admin`.
 *   - CRUD completo de Itens: Consumíveis, Trocadores de Elemento, Materiais de Crafting e Itens Especiais.
 *   - Configuração de Pilha Máxima (maxStack), Efeito Numérico, Tempo de Recarga (cooldown) e Alvo.
 *   - Integração com catálogo oficial de 6.468 itens do mcrework com preenchimento em 1 clique.
 */

class AdminItemsTab {
  static attach(app) {
    app.itemTemplates = [];
    app.mcreworkItems = [];
    app.itemSearchQuery = '';
    app.itemCategoryFilter = 'ALL';
    app.itemRarityFilter = 'ALL';
    app.itemGallerySearchQuery = '';
    app.itemGalleryCategoryFilter = 'ALL';

    AdminItemsTab.injectTabAndModalDom();

    app.loadItemTemplates = async function () {
      try {
        this.itemTemplates = await this.api('/api/admin/items');
        this.renderItemsCrudTable();
      } catch (err) {
        console.error('Falha ao carregar templates de itens:', err);
      }
    };

    app.loadMcreworkItems = async function () {
      if (this.mcreworkItems && this.mcreworkItems.length > 0) return;
      try {
        this.mcreworkItems = await this.api('/api/admin/mcrework/items');
      } catch (err) {
        console.error('Falha ao carregar catálogo mcrework de itens:', err);
      }
    };

    app.filterItemsCrudTable = function () {
      const input = document.getElementById('itemSearchInput');
      this.itemSearchQuery = (input ? input.value : '').toLowerCase().trim();
      this.itemCategoryFilter = document.getElementById('itemCategoryFilterSelect')?.value || 'ALL';
      this.itemRarityFilter = document.getElementById('itemRarityFilterSelect')?.value || 'ALL';
      this.renderItemsCrudTable();
    };

    app.filterItemGallery = function () {
      const input = document.getElementById('itemGallerySearchInput');
      this.itemGallerySearchQuery = (input ? input.value : '').toLowerCase().trim();
      this.renderItemGallery();
    };

    app.setItemGalleryCategory = function (cat) {
      this.itemGalleryCategoryFilter = cat;
      const btns = document.querySelectorAll('.item-gal-btn');
      btns.forEach((b) => {
        b.className = b.dataset.cat === cat ? 'btn-primary item-gal-btn' : 'item-gal-btn';
      });
      this.renderItemGallery();
    };

    app.openCreateItemModal = async function () {
      await this.loadMcreworkItems();

      document.getElementById('itemEditIdInput').value = '';
      document.getElementById('itemModalTitle').textContent = '📦 Cadastrar Novo Item';
      document.getElementById('itemNameInput').value = '';
      document.getElementById('itemDescriptionInput').value = '';
      document.getElementById('itemCodeInput').value = '';
      document.getElementById('itemCategorySelect').value = 'CONSUMABLE';
      document.getElementById('itemRaritySelect').value = 'COMMON';
      document.getElementById('itemReqLevelInput').value = '1';
      document.getElementById('itemPriceInput').value = '25';
      document.getElementById('itemMaxStackInput').value = '99';
      document.getElementById('itemCooldownInput').value = '3.0';
      document.getElementById('itemTargetSelect').value = 'SELF';
      document.getElementById('itemEffectSelect').value = 'HEAL_HP';
      document.getElementById('itemEffectValueInput').value = '150';
      document.getElementById('itemActiveSelect').value = 'true';
      document.getElementById('itemIconKeyInput').value = 'assets/items/icons/item_normal_060009.png';
      this.updateItemIconPreview('assets/items/icons/item_normal_060009.png');

      this.renderItemGallery();
      document.getElementById('itemModal').style.display = 'flex';
    };

    app.openEditItemModal = async function (id) {
      await this.loadMcreworkItems();

      const item = (this.itemTemplates || []).find((i) => i.id === id);
      if (!item) return;

      document.getElementById('itemEditIdInput').value = item.id;
      document.getElementById('itemModalTitle').textContent = `✏️ Editar Item: ${item.namePtBr}`;
      document.getElementById('itemNameInput').value = item.namePtBr || '';
      document.getElementById('itemDescriptionInput').value = item.descriptionPtBr || '';
      document.getElementById('itemCodeInput').value = item.code || '';
      document.getElementById('itemCategorySelect').value = item.itemCategory || 'CONSUMABLE';
      document.getElementById('itemRaritySelect').value = item.rarityTier || 'COMMON';
      document.getElementById('itemReqLevelInput').value = item.requiredLevel ?? 1;
      document.getElementById('itemPriceInput').value = item.priceGold ?? 0;
      document.getElementById('itemMaxStackInput').value = item.maxStack ?? 99;
      document.getElementById('itemCooldownInput').value = item.cooldownSec ?? 0.0;
      document.getElementById('itemTargetSelect').value = item.targetType || 'SELF';
      document.getElementById('itemEffectSelect').value = item.effectType || 'HEAL_HP';
      document.getElementById('itemEffectValueInput').value = item.effectValue ?? 0.0;
      document.getElementById('itemActiveSelect').value = String(item.isActive ?? true);
      document.getElementById('itemIconKeyInput').value = item.mcreworkIconKey || '';
      this.updateItemIconPreview(item.mcreworkIconKey);

      this.renderItemGallery();
      document.getElementById('itemModal').style.display = 'flex';
    };

    app.updateItemIconPreview = function (iconKey) {
      const preview = document.getElementById('itemActiveIconImg');
      const badge = document.getElementById('itemActiveIconBadge');
      if (!iconKey) iconKey = 'assets/items/icons/item_normal_060009.png';
      const clean = iconKey.replace(/^\/+/, '');
      const url = `https://seytanir.github.io/mcrework/${clean}`;
      if (preview) preview.src = url;
      if (badge) badge.textContent = clean;
    };

    app.selectMcreworkItem = function (item) {
      document.getElementById('itemIconKeyInput').value = item.mcreworkIconKey;
      this.updateItemIconPreview(item.mcreworkIconKey);

      const nameInp = document.getElementById('itemNameInput');
      if (!nameInp.value || nameInp.value.trim() === '') {
        nameInp.value = item.name;
      }
      const descInp = document.getElementById('itemDescriptionInput');
      if (!descInp.value || descInp.value.trim() === '') {
        descInp.value = item.info || item.description || '';
      }

      if (item.suggestedCategory) {
        document.getElementById('itemCategorySelect').value = item.suggestedCategory;
      }
      if (item.suggestedEffect) {
        document.getElementById('itemEffectSelect').value = item.suggestedEffect;
      }
      if (item.suggestedTarget) {
        document.getElementById('itemTargetSelect').value = item.suggestedTarget;
      }
      if (item.stackMax) {
        document.getElementById('itemMaxStackInput').value = Math.min(item.stackMax, 999);
      }
      if (item.price) {
        document.getElementById('itemPriceInput').value = item.price;
      }
    };

    app.renderItemGallery = function () {
      const grid = document.getElementById('itemGalleryGrid');
      if (!grid) return;

      const q = (this.itemGallerySearchQuery || '').toLowerCase();
      const cat = this.itemGalleryCategoryFilter || 'ALL';

      const filtered = (this.mcreworkItems || []).filter((item) => {
        if (cat !== 'ALL' && item.category !== cat) return false;
        if (!q) return true;
        return (item.name && item.name.toLowerCase().includes(q)) ||
               (item.category && item.category.toLowerCase().includes(q)) ||
               (item.mcreworkIconKey && item.mcreworkIconKey.toLowerCase().includes(q));
      });

      const countBadge = document.getElementById('itemGalleryCountBadge');
      if (countBadge) countBadge.textContent = `${filtered.length} de ${this.mcreworkItems.length} ícones`;

      if (filtered.length === 0) {
        grid.innerHTML = '<div style="color:var(--text-muted); padding:16px; font-size:0.8rem; grid-column:1/-1; text-align:center;">Nenhum item encontrado com a busca.</div>';
        return;
      }

      grid.innerHTML = filtered.slice(0, 160).map((item) => `
        <div onclick='AdminApp.selectMcreworkItem(${JSON.stringify(item).replace(/'/g, "&apos;")})'
             title="${item.name} (${item.category}) - ${item.info || item.description}"
             style="cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:4px; padding:6px; background:rgba(30,41,59,0.7); border:1px solid #334155; border-radius:8px; transition:all 0.15s ease;"
             onmouseover="this.style.borderColor='#38bdf8'; this.style.transform='scale(1.05)';"
             onmouseout="this.style.borderColor='#334155'; this.style.transform='scale(1)';"
        >
          <img src="${item.iconUrl}" alt="${item.name}" loading="lazy" style="width:36px; height:36px; object-fit:contain;" />
          <span style="font-size:0.65rem; color:#cbd5e1; text-align:center; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:80px;">${item.name}</span>
          <span style="font-size:0.60rem; color:#38bdf8;">${item.category}</span>
        </div>
      `).join('');
    };

    app.saveItemTemplate = async function () {
      const editId = document.getElementById('itemEditIdInput').value;
      const namePtBr = document.getElementById('itemNameInput').value.trim();
      const descriptionPtBr = document.getElementById('itemDescriptionInput').value.trim();
      const code = document.getElementById('itemCodeInput').value.trim();
      const itemCategory = document.getElementById('itemCategorySelect').value;
      const rarityTier = document.getElementById('itemRaritySelect').value;
      const requiredLevel = parseInt(document.getElementById('itemReqLevelInput').value, 10) || 1;
      const priceGold = parseInt(document.getElementById('itemPriceInput').value, 10) || 0;
      const maxStack = parseInt(document.getElementById('itemMaxStackInput').value, 10) || 99;
      const cooldownSec = parseFloat(document.getElementById('itemCooldownInput').value) || 0.0;
      const targetType = document.getElementById('itemTargetSelect').value;
      const effectType = document.getElementById('itemEffectSelect').value;
      const effectValue = parseFloat(document.getElementById('itemEffectValueInput').value) || 0.0;
      const isActive = document.getElementById('itemActiveSelect').value === 'true';
      const mcreworkIconKey = document.getElementById('itemIconKeyInput').value.trim();

      if (!namePtBr) {
        alert('Por favor, informe o nome do item em português.');
        return;
      }

      const payload = {
        code: code || undefined,
        namePtBr,
        descriptionPtBr,
        itemCategory,
        rarityTier,
        requiredLevel,
        priceGold,
        maxStack,
        cooldownSec,
        targetType,
        effectType,
        effectValue,
        isActive,
        mcreworkIconKey,
      };

      try {
        if (editId) {
          await this.api(`/api/admin/items/${editId}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          });
        } else {
          await this.api('/api/admin/items', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
        }
        document.getElementById('itemModal').style.display = 'none';
        await this.loadItemTemplates();
      } catch (err) {
        alert(`Erro ao salvar Item: ${err.message}`);
      }
    };

    app.deleteItemTemplate = async function (id, name) {
      if (!confirm(`Deseja realmente excluir o item "${name}" (#${id})?`)) return;
      try {
        await this.api(`/api/admin/items/${id}`, { method: 'DELETE' });
        await this.loadItemTemplates();
      } catch (err) {
        alert(`Erro ao excluir Item: ${err.message}`);
      }
    };

    app.renderItemsCrudTable = function () {
      const container = document.getElementById('itemsTableContainer');
      if (!container) return;

      const q = (this.itemSearchQuery || '').toLowerCase();
      const cF = this.itemCategoryFilter || 'ALL';
      const rF = this.itemRarityFilter || 'ALL';

      const filtered = (this.itemTemplates || []).filter((i) => {
        if (cF !== 'ALL' && i.itemCategory !== cF) return false;
        if (rF !== 'ALL' && i.rarityTier !== rF) return false;
        if (!q) return true;
        return (i.namePtBr && i.namePtBr.toLowerCase().includes(q)) ||
               (i.code && i.code.toLowerCase().includes(q)) ||
               (i.itemCategory && i.itemCategory.toLowerCase().includes(q)) ||
               (i.mcreworkIconKey && i.mcreworkIconKey.toLowerCase().includes(q));
      });

      const countBadge = document.getElementById('itemsCounterBadge');
      if (countBadge) countBadge.textContent = `${filtered.length} de ${this.itemTemplates.length} itens cadastrados`;

      if (filtered.length === 0) {
        container.innerHTML = `
          <div style="text-align:center; padding:36px 12px; color:var(--text-muted);">
            📦 Nenhum item encontrado com os filtros atuais. Clique em <strong>➕ Novo Item</strong> para cadastrar!
          </div>
        `;
        return;
      }

      const rarityColors = { SS: '#fbbf24', S: '#c084fc', A: '#38bdf8', B: '#4ade80', C: '#fde047', D: '#cbd5e1', F: '#94a3b8', COMMON: '#94a3b8' };
      const categoryLabels = {
        CONSUMABLE: '<span style="background:#16a34a; color:#fff; padding:2px 8px; border-radius:4px; font-size:0.75rem;">🧪 Consumível</span>',
        ELEMENT_CHANGER: '<span style="background:#0284c7; color:#fff; padding:2px 8px; border-radius:4px; font-size:0.75rem;">🔮 Trocador Elemental</span>',
        MATERIAL: '<span style="background:#d97706; color:#fff; padding:2px 8px; border-radius:4px; font-size:0.75rem;">🪵 Material</span>',
        QUEST: '<span style="background:#9333ea; color:#fff; padding:2px 8px; border-radius:4px; font-size:0.75rem;">📜 Missão</span>',
        SPECIAL: '<span style="background:#e11d48; color:#fff; padding:2px 8px; border-radius:4px; font-size:0.75rem;">📦 Especial</span>',
      };

      const effectLabels = {
        HEAL_HP: (v) => `💚 Cura +${v} HP`,
        RESTORE_MP: (v) => `💧 Restaura +${v} MP`,
        BUFF_STATS: (v) => `⚡ Buff Temporário (+${v})`,
        CHANGE_ELEMENT: () => `🌀 Altera Afinidade Elemental`,
        TELEPORT: () => `🌌 Teleporte Instantâneo`,
        CATCH_PET: (v) => `🐾 Captura de Pet (+${v}%)`,
        GRANT_EXP: (v) => `✨ Concede +${v} EXP`,
        MATERIAL: () => `⚒️ Recurso de Criação`,
        OPEN_CHEST: () => `🎁 Recompensa / Baú`,
      };

      container.innerHTML = `
        <table class="data-table" style="width:100%; border-collapse:collapse; font-size:0.83rem;">
          <thead>
            <tr style="border-bottom:1px solid var(--border); text-align:left; color:#94a3b8;">
              <th style="padding:10px;">Ícone</th>
              <th style="padding:10px;">Nome & Código</th>
              <th style="padding:10px;">Categoria</th>
              <th style="padding:10px;">Raridade</th>
              <th style="padding:10px;">Efeito Prático</th>
              <th style="padding:10px;">Pilha / Cooldown</th>
              <th style="padding:10px;">Nível / Preço</th>
              <th style="padding:10px;">Status</th>
              <th style="padding:10px; text-align:right;">Ações</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map((item) => {
              const rColor = rarityColors[item.rarityTier] || '#94a3b8';
              const effectFn = effectLabels[item.effectType] || ((v) => `${item.effectType || '-'} (${v})`);
              const effectText = effectFn(item.effectValue);

              return `
                <tr style="border-bottom:1px solid rgba(51,65,85,0.4);">
                  <td style="padding:8px 10px;">
                    <img src="${item.iconUrl}" alt="${item.namePtBr}" style="width:38px; height:38px; object-fit:contain; border-radius:6px; background:rgba(15,23,42,0.8); border:1px solid #334155;" />
                  </td>
                  <td style="padding:8px 10px;">
                    <strong style="color:#f8fafc; font-size:0.88rem;">${item.namePtBr}</strong>
                    <div style="font-size:0.72rem; color:var(--text-muted); font-family:monospace;">${item.code}</div>
                  </td>
                  <td style="padding:8px 10px;">
                    ${categoryLabels[item.itemCategory] || item.itemCategory}
                  </td>
                  <td style="padding:8px 10px;">
                    <span style="font-weight:700; color:${rColor}; border:1px solid ${rColor}; padding:2px 8px; border-radius:4px; font-size:0.75rem;">
                      ${item.rarityTier}
                    </span>
                  </td>
                  <td style="padding:8px 10px; font-weight:600; color:#38bdf8;">
                    ${effectText}
                    <div style="font-size:0.72rem; color:var(--text-muted);">Alvo: ${item.targetType || 'SELF'}</div>
                  </td>
                  <td style="padding:8px 10px; font-size:0.75rem; color:#cbd5e1; font-family:monospace;">
                    📦 Max: ${item.maxStack || 99}<br/>
                    ⏱️ CD: ${item.cooldownSec ? item.cooldownSec + 's' : '0s'}
                  </td>
                  <td style="padding:8px 10px; font-size:0.75rem; color:#cbd5e1;">
                    Nv. ${item.requiredLevel}<br/>
                    <strong style="color:#fde047;">🪙 ${item.priceGold || 0}</strong>
                  </td>
                  <td style="padding:8px 10px;">
                    ${item.isActive ? '<span style="color:#4ade80; font-weight:700;">🟢 Ativo</span>' : '<span style="color:#f87171;">🔴 Inativo</span>'}
                  </td>
                  <td style="padding:8px 10px; text-align:right; white-space:nowrap;">
                    <button class="btn-primary" style="padding:4px 8px; font-size:0.75rem; margin-right:4px;" onclick="AdminApp.openEditItemModal(${item.id})">✏️ Editar</button>
                    <button class="btn-danger" style="padding:4px 8px; font-size:0.75rem;" onclick="AdminApp.deleteItemTemplate(${item.id}, '${item.namePtBr}')">🗑️</button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
    };
  }

  static injectTabAndModalDom() {
    // 1. Injeta Botão na Barra Superior (.nav-tabs)
    const navTabs = document.querySelector('.nav-tabs');
    const btnEquips = document.getElementById('tabBtnEquipments');
    if (navTabs && !document.getElementById('tabBtnItems')) {
      const btn = document.createElement('button');
      btn.id = 'tabBtnItems';
      btn.onclick = () => window.AdminApp.switchTab('items');
      btn.textContent = '📦 Tabela de Itens';
      if (btnEquips && btnEquips.nextSibling) {
        navTabs.insertBefore(btn, btnEquips.nextSibling);
      } else {
        navTabs.appendChild(btn);
      }
    }

    // 2. Injeta Painel da Aba (#tabItems) dentro de #adminApp
    const adminApp = document.getElementById('adminApp');
    if (adminApp && !document.getElementById('tabItems')) {
      const panel = document.createElement('div');
      panel.id = 'tabItems';
      panel.style.cssText = 'display:none; padding:16px; max-width:1200px; margin:0 auto; width:100%; gap:16px; flex-direction:column;';
      panel.innerHTML = `
        <div class="panel">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
            <div>
              <h3 style="margin:0; color:#38bdf8;">📦 Tabela de Itens (Consumíveis, Trocadores, Materiais, Especiais)</h3>
              <p style="font-size:0.8rem; color:var(--text-muted); margin:4px 0 0;">
                Gerencie poções de vida/mana, pedras de afinidade elemental, materiais de criação, pergaminhos e itens especiais de captura.
              </p>
            </div>
            <div style="display:flex; gap:8px; align-items:center;">
              <span id="itemsCounterBadge" style="font-size:0.8rem; color:var(--text-muted);"></span>
              <button class="btn-primary" onclick="AdminApp.openCreateItemModal()">➕ Novo Item</button>
            </div>
          </div>
          <!-- Filtros e Busca -->
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:10px; margin-top:14px; padding-bottom:12px; border-bottom:1px solid var(--border);">
            <div class="field">
              <label>🔍 Buscar por Nome/Código</label>
              <input type="text" id="itemSearchInput" placeholder="Ex: Poção, Pedra, item_..." oninput="AdminApp.filterItemsCrudTable()" />
            </div>
            <div class="field">
              <label>Categoria de Item</label>
              <select id="itemCategoryFilterSelect" onchange="AdminApp.filterItemsCrudTable()">
                <option value="ALL">Todas as Categorias</option>
                <option value="CONSUMABLE">🧪 Consumível (Poções, Comidas)</option>
                <option value="ELEMENT_CHANGER">🔮 Trocador Elemental (Pedras)</option>
                <option value="MATERIAL">🪵 Material de Crafting</option>
                <option value="QUEST">📜 Item de Missão</option>
                <option value="SPECIAL">📦 Especial (Cápsulas, Baús)</option>
              </select>
            </div>
            <div class="field">
              <label>Raridade</label>
              <select id="itemRarityFilterSelect" onchange="AdminApp.filterItemsCrudTable()">
                <option value="ALL">Todas as Raridades</option>
                <option value="SS">SS (Mítico)</option>
                <option value="S">S (Lendário)</option>
                <option value="A">A (Épico)</option>
                <option value="B">B (Raro)</option>
                <option value="C">C (Incomum)</option>
                <option value="D">D (Regular)</option>
                <option value="F">F (Básico)</option>
                <option value="COMMON">COMMON (Comum)</option>
              </select>
            </div>
          </div>
          <div id="itemsTableContainer" style="overflow-x:auto; margin-top:12px;"></div>
        </div>
      `;
      const tabEquips = document.getElementById('tabEquipments');
      if (tabEquips && tabEquips.nextSibling) {
        adminApp.insertBefore(panel, tabEquips.nextSibling);
      } else {
        adminApp.appendChild(panel);
      }
    }

    // 3. Injeta Modal (#itemModal) no body
    if (document.getElementById('itemModal')) return;

    const modal = document.createElement('div');
    modal.id = 'itemModal';
    modal.className = 'modal-backdrop';
    modal.style.display = 'none';

    modal.innerHTML = `
      <div class="modal-box" style="max-width:1050px; width:96%; max-height:92vh; display:block; overflow-y:auto; -webkit-overflow-scrolling:touch; padding:16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:10px; margin-bottom:12px;">
          <h3 id="itemModalTitle" style="color:#38bdf8; margin:0; font-size:1.05rem;">📦 Cadastrar / Editar Item</h3>
          <div style="display:flex; gap:8px;">
            <button class="btn-success" onclick="AdminApp.saveItemTemplate()" style="padding:6px 14px; font-weight:700;">💾 Salvar</button>
            <button class="btn-danger" onclick="AdminApp.closeModal('itemModal')" style="padding:6px 10px;">✕</button>
          </div>
        </div>

        <input type="hidden" id="itemEditIdInput" value="" />
        <input type="hidden" id="itemIconKeyInput" value="" />

        <!-- BLOCO 1: IDENTIDADE & CATEGORIA -->
        <div style="background:rgba(15,23,42,0.75); border:1px solid #334155; border-radius:10px; padding:12px; margin-bottom:12px;">
          <div style="font-size:0.80rem; font-weight:700; color:#38bdf8; margin-bottom:8px;">1️⃣ Identidade, Categoria & Economia</div>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(170px, 1fr)); gap:10px;">
            <div class="field">
              <label>Nome do Item (PT-BR) *</label>
              <input type="text" id="itemNameInput" placeholder="Ex: Poção de Cura Maior" />
            </div>
            <div class="field">
              <label>Código Único (opcional)</label>
              <input type="text" id="itemCodeInput" placeholder="Auto-gerado se vazio" />
            </div>
            <div class="field">
              <label>Categoria do Item *</label>
              <select id="itemCategorySelect">
                <option value="CONSUMABLE">🧪 Consumível (Poções, Comidas)</option>
                <option value="ELEMENT_CHANGER">🔮 Trocador Elemental (Pedras)</option>
                <option value="MATERIAL">🪵 Material de Crafting</option>
                <option value="QUEST">📜 Item de Missão</option>
                <option value="SPECIAL">📦 Especial (Cápsulas, Baús)</option>
              </select>
            </div>
            <div class="field">
              <label>Raridade</label>
              <select id="itemRaritySelect">
                <option value="COMMON">COMMON (Comum)</option>
                <option value="F">F (Básico)</option>
                <option value="D">D (Regular)</option>
                <option value="C">C (Incomum)</option>
                <option value="B">B (Raro)</option>
                <option value="A">A (Épico)</option>
                <option value="S">S (Lendário)</option>
                <option value="SS">SS (Mítico)</option>
              </select>
            </div>
            <div class="field">
              <label>Nível Mínimo Requerido</label>
              <input type="number" id="itemReqLevelInput" value="1" min="1" max="100" />
            </div>
            <div class="field">
              <label>Preço em Ouro (🪙)</label>
              <input type="number" id="itemPriceInput" value="25" min="0" />
            </div>
            <div class="field">
              <label>Pilha Máxima (maxStack)</label>
              <input type="number" id="itemMaxStackInput" value="99" min="1" max="999" />
            </div>
            <div class="field">
              <label>Status</label>
              <select id="itemActiveSelect">
                <option value="true">🟢 Ativo (Visível no Jogo)</option>
                <option value="false">🔴 Inativo (Oculto)</option>
              </select>
            </div>
            <div class="field" style="grid-column: 1 / -1;">
              <label>Descrição em Português</label>
              <input type="text" id="itemDescriptionInput" placeholder="Ex: Elixir alquímico que restaura instantaneamente os pontos de vida..." />
            </div>
          </div>
        </div>

        <!-- BLOCO 2: MECÂNICA DE USO & EFEITOS -->
        <div style="background:rgba(15,23,42,0.75); border:1px solid #334155; border-radius:10px; padding:12px; margin-bottom:12px;">
          <div style="font-size:0.80rem; font-weight:700; color:#4ade80; margin-bottom:8px;">2️⃣ Mecânica de Uso, Efeito Prático & Recarga</div>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:10px;">
            <div class="field">
              <label>Tipo de Efeito Prático</label>
              <select id="itemEffectSelect">
                <option value="HEAL_HP">💚 Cura de Pontos de Vida (HP)</option>
                <option value="RESTORE_MP">💧 Restauração de Mana (MP)</option>
                <option value="BUFF_STATS">⚡ Buff Temporário de Atributos</option>
                <option value="CHANGE_ELEMENT">🌀 Alteração de Afinidade Elemental</option>
                <option value="TELEPORT">🌌 Teleporte para Ponto de Retorno</option>
                <option value="CATCH_PET">🐾 Captura de Monstro / Domesticar Pet</option>
                <option value="GRANT_EXP">✨ Concessão Direta de Experiência</option>
                <option value="MATERIAL">⚒️ Recurso Passivo / Material</option>
                <option value="OPEN_CHEST">🎁 Abertura de Baú / Recompensa</option>
              </select>
            </div>
            <div class="field">
              <label>Valor Numérico do Efeito</label>
              <input type="number" id="itemEffectValueInput" value="150" step="1" />
            </div>
            <div class="field">
              <label>Tempo de Recarga (segundos)</label>
              <input type="number" id="itemCooldownInput" value="3.0" step="0.5" min="0" />
            </div>
            <div class="field">
              <label>Alvo do Uso</label>
              <select id="itemTargetSelect">
                <option value="SELF">👤 Próprio Personagem (SELF)</option>
                <option value="ALLY">🛡️ Aliado Próximo (ALLY)</option>
                <option value="ENEMY">⚔️ Inimigo em Batalha (ENEMY)</option>
                <option value="PET">🐾 Pet Companheiro (PET)</option>
                <option value="NONE">⚪ Nenhum / Material Passivo (NONE)</option>
              </select>
            </div>
          </div>
        </div>

        <!-- BLOCO 3: GALERIA DE 6.468 ÍCONES DO MCREWORK & PRÉ-VISUALIZAÇÃO -->
        <div style="background:rgba(15,23,42,0.75); border:1px solid #334155; border-radius:10px; padding:12px; margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:8px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <img id="itemActiveIconImg" src="" style="width:42px; height:42px; object-fit:contain; border-radius:6px; background:#020617; border:1px solid #38bdf8;" />
              <div>
                <strong style="color:#c084fc; font-size:0.82rem;">3️⃣ Galeria Oficial de Ícones de Itens (mcrework)</strong>
                <div id="itemActiveIconBadge" style="font-size:0.68rem; color:var(--text-muted); font-family:monospace;"></div>
              </div>
            </div>
            <span id="itemGalleryCountBadge" style="font-size:0.75rem; color:#bae6fd;"></span>
          </div>

          <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px;">
            <button class="btn-primary item-gal-btn" data-cat="ALL" onclick="AdminApp.setItemGalleryCategory('ALL')">🌐 Todos</button>
            <button class="item-gal-btn" data-cat="potions" onclick="AdminApp.setItemGalleryCategory('potions')">🧪 Poções (339)</button>
            <button class="item-gal-btn" data-cat="gems" onclick="AdminApp.setItemGalleryCategory('gems')">💎 Gemas/Pedras (144)</button>
            <button class="item-gal-btn" data-cat="scrolls" onclick="AdminApp.setItemGalleryCategory('scrolls')">📜 Pergaminhos (178)</button>
            <button class="item-gal-btn" data-cat="materials" onclick="AdminApp.setItemGalleryCategory('materials')">🪵 Materiais (292)</button>
            <button class="item-gal-btn" data-cat="books" onclick="AdminApp.setItemGalleryCategory('books')">📖 Livros/Tomos (378)</button>
            <button class="item-gal-btn" data-cat="quest" onclick="AdminApp.setItemGalleryCategory('quest')">🗝️ Missão (25)</button>
            <button class="item-gal-btn" data-cat="other" onclick="AdminApp.setItemGalleryCategory('other')">📦 Outros / Baús</button>
          </div>

          <input type="text" id="itemGallerySearchInput" placeholder="🔎 Filtrar ícone por nome ou categoria..." oninput="AdminApp.filterItemGallery()" style="margin-bottom:8px; width:100%;" />
          <div id="itemGalleryGrid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(88px, 1fr)); gap:8px; max-height:220px; overflow-y:auto; padding:4px;"></div>
        </div>

        <div style="border-top:1px solid var(--border); padding-top:10px;">
          <button class="btn-success" style="width:100%; padding:12px; font-weight:700; font-size:0.95rem;" onclick="AdminApp.saveItemTemplate()">
            💾 Salvar Item Completo na Tabela
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  }
}

window.AdminItemsTab = AdminItemsTab;
