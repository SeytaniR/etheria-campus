/**
 * @file apps/server/public/admin/js/AdminEquipmentsTab.js
 * @module @etheria/server
 * @description Submódulo da Aba Tabela de Cadastro de Equipamentos (`item_templates`) da Rota `/admin`.
 *   - CRUD completo de Equipamentos com busca por nome/código/ícone e filtros por Slot, Categoria e Raridade.
 *   - Gerenciamento dos 16 Slots de Personagem e 6 Slots de Pet com suporte a restrições de classe e nível.
 *   - Configuração de Atributos Base (VIT, STR, INT, WIS, AGI, DEX) e Atributos de Combate da Arena
 *     (ATK, MATK, DEF, MDEF, Vel. Movimento Batalha px/s, Aspd, Precisão, Desvio, Crítico e Alcance).
 *   - Galeria oficial de 1.865 ícones e equipamentos do catálogo mcrework com preenchimento inteligente com 1 clique.
 */

class AdminEquipmentsTab {
  static attach(app) {
    app.equipmentTemplates = [];
    app.equipmentSlots = [];
    app.mcreworkEquipment = [];
    app.selectedMcreworkEquipmentIcon = '';
    app.equipmentSearchQuery = '';
    app.equipmentSlotFilter = 'ALL';
    app.equipmentCategoryFilter = 'ALL';
    app.equipmentRarityFilter = 'ALL';
    app.equipmentGallerySearchQuery = '';
    app.equipmentGalleryGroupFilter = 'ALL';

    AdminEquipmentsTab.injectTabAndModalDom();

    app.loadEquipmentTemplates = async function () {
      try {
        this.equipmentTemplates = await this.api('/api/admin/equipments');
        this.renderEquipmentsCrudTable();
      } catch (err) {
        console.error('Falha ao carregar templates de equipamentos:', err);
      }
    };

    app.loadEquipmentSlots = async function () {
      if (this.equipmentSlots && this.equipmentSlots.length > 0) return;
      try {
        this.equipmentSlots = await this.api('/api/admin/equipment-slots');
        this.populateEquipmentSlotDropdowns();
      } catch (err) {
        console.error('Falha ao carregar slots de equipamentos:', err);
      }
    };

    app.loadMcreworkEquipment = async function () {
      if (this.mcreworkEquipment && this.mcreworkEquipment.length > 0) return;
      try {
        this.mcreworkEquipment = await this.api('/api/admin/mcrework/equipment');
      } catch (err) {
        console.error('Falha ao carregar catálogo mcrework de equipamentos:', err);
      }
    };

    app.populateEquipmentSlotDropdowns = function () {
      const filterSelect = document.getElementById('equipSlotFilterSelect');
      const formSelect = document.getElementById('equipSlotSelect');
      if (!this.equipmentSlots) return;

      const optsHtml = this.equipmentSlots
        .map((s) => `<option value="${s.code}">[${s.ownerType === 'PET' ? '🐾 Pet' : '👤 Char'}] ${s.labelPtBr}</option>`)
        .join('');

      if (filterSelect) {
        filterSelect.innerHTML = `<option value="ALL">Todos os Slots</option>${optsHtml}`;
      }
      if (formSelect) {
        formSelect.innerHTML = optsHtml;
      }
    };

    app.filterEquipmentsCrudTable = function () {
      const input = document.getElementById('equipSearchInput');
      this.equipmentSearchQuery = (input ? input.value : '').toLowerCase().trim();
      this.equipmentSlotFilter = document.getElementById('equipSlotFilterSelect')?.value || 'ALL';
      this.equipmentCategoryFilter = document.getElementById('equipCategoryFilterSelect')?.value || 'ALL';
      this.equipmentRarityFilter = document.getElementById('equipRarityFilterSelect')?.value || 'ALL';
      this.renderEquipmentsCrudTable();
    };

    app.filterEquipmentGallery = function () {
      const input = document.getElementById('equipGallerySearchInput');
      this.equipmentGallerySearchQuery = (input ? input.value : '').toLowerCase().trim();
      this.renderEquipmentGallery();
    };

    app.setEquipmentGalleryGroup = function (group) {
      this.equipmentGalleryGroupFilter = group;
      const groupBtns = document.querySelectorAll('.equip-gal-btn');
      groupBtns.forEach((b) => {
        b.className = b.dataset.group === group ? 'btn-primary equip-gal-btn' : 'equip-gal-btn';
      });
      this.renderEquipmentGallery();
    };

    app.openCreateEquipmentModal = async function () {
      await this.loadEquipmentSlots();
      await this.loadMcreworkEquipment();

      document.getElementById('equipEditIdInput').value = '';
      document.getElementById('equipModalTitle').textContent = '🛡️ Cadastrar Novo Equipamento';
      document.getElementById('equipNameInput').value = '';
      document.getElementById('equipDescriptionInput').value = '';
      document.getElementById('equipCodeInput').value = '';
      document.getElementById('equipCategorySelect').value = 'CHARACTER_EQUIPMENT';
      document.getElementById('equipSlotSelect').value = 'WEAPON_1';
      document.getElementById('equipRaritySelect').value = 'COMMON';
      document.getElementById('equipReqLevelInput').value = '1';
      document.getElementById('equipPriceInput').value = '100';
      document.getElementById('equipActiveSelect').value = 'true';
      document.getElementById('equipIconKeyInput').value = 'assets/equipment/icons/equip_normal_100001.png';
      this.updateEquipmentIconPreview('assets/equipment/icons/equip_normal_100001.png');

      ['VIT', 'STR', 'INT', 'WIS', 'AGI', 'DEX'].forEach((attr) => {
        const inp = document.getElementById(`equipBase${attr}Input`);
        if (inp) inp.value = '0';
      });

      const combatFields = [
        'PHYS_ATK', 'MAG_ATK', 'PHYS_DEF', 'MAG_DEF',
        'BATTLE_MOVE_SPEED', 'ATTACK_SPEED', 'PHYS_ACCURACY',
        'MAG_ACCURACY', 'PHYS_EVASION', 'MAG_EVASION',
        'CRIT_CHANCE_PCT', 'CRIT_DAMAGE_PCT', 'ATTACK_RANGE'
      ];
      combatFields.forEach((cf) => {
        const inp = document.getElementById(`equipCombat${cf}Input`);
        if (inp) inp.value = '0';
      });

      this.renderEquipmentGallery();
      document.getElementById('equipmentModal').style.display = 'flex';
    };

    app.openEditEquipmentModal = async function (id) {
      await this.loadEquipmentSlots();
      await this.loadMcreworkEquipment();

      const item = (this.equipmentTemplates || []).find((e) => e.id === id);
      if (!item) return;

      document.getElementById('equipEditIdInput').value = item.id;
      document.getElementById('equipModalTitle').textContent = `✏️ Editar Equipamento: ${item.namePtBr}`;
      document.getElementById('equipNameInput').value = item.namePtBr || '';
      document.getElementById('equipDescriptionInput').value = item.descriptionPtBr || '';
      document.getElementById('equipCodeInput').value = item.code || '';
      document.getElementById('equipCategorySelect').value = item.itemCategory || 'CHARACTER_EQUIPMENT';
      document.getElementById('equipSlotSelect').value = item.equipmentSlotCode || 'WEAPON_1';
      document.getElementById('equipRaritySelect').value = item.rarityTier || 'COMMON';
      document.getElementById('equipReqLevelInput').value = item.requiredLevel ?? 1;
      document.getElementById('equipPriceInput').value = item.priceGold ?? 0;
      document.getElementById('equipActiveSelect').value = String(item.isActive ?? true);
      document.getElementById('equipIconKeyInput').value = item.mcreworkIconKey || '';
      this.updateEquipmentIconPreview(item.mcreworkIconKey);

      const b = item.baseStatBonusesJson || {};
      ['VIT', 'STR', 'INT', 'WIS', 'AGI', 'DEX'].forEach((attr) => {
        const inp = document.getElementById(`equipBase${attr}Input`);
        if (inp) inp.value = b[attr] ?? 0;
      });

      const cb = item.combatStatBonusesJson || {};
      const combatFields = [
        'PHYS_ATK', 'MAG_ATK', 'PHYS_DEF', 'MAG_DEF',
        'BATTLE_MOVE_SPEED', 'ATTACK_SPEED', 'PHYS_ACCURACY',
        'MAG_ACCURACY', 'PHYS_EVASION', 'MAG_EVASION',
        'CRIT_CHANCE_PCT', 'CRIT_DAMAGE_PCT', 'ATTACK_RANGE'
      ];
      combatFields.forEach((cf) => {
        const inp = document.getElementById(`equipCombat${cf}Input`);
        if (inp) inp.value = cb[cf] ?? 0;
      });

      this.renderEquipmentGallery();
      document.getElementById('equipmentModal').style.display = 'flex';
    };

    app.updateEquipmentIconPreview = function (iconKey) {
      const preview = document.getElementById('equipActiveIconImg');
      const badge = document.getElementById('equipActiveIconBadge');
      if (!iconKey) iconKey = 'assets/equipment/icons/equip_normal_100001.png';
      const clean = iconKey.replace(/^\/+/, '');
      const url = `https://seytanir.github.io/mcrework/${clean}`;
      if (preview) preview.src = url;
      if (badge) badge.textContent = clean;
    };

    app.selectMcreworkEquipment = function (item) {
      document.getElementById('equipIconKeyInput').value = item.mcreworkIconKey;
      this.updateEquipmentIconPreview(item.mcreworkIconKey);

      const nameInp = document.getElementById('equipNameInput');
      if (!nameInp.value || nameInp.value.trim() === '') {
        nameInp.value = item.name;
      }
      const descInp = document.getElementById('equipDescriptionInput');
      if (!descInp.value || descInp.value.trim() === '') {
        descInp.value = item.description;
      }

      if (item.suggestedSlot) {
        document.getElementById('equipSlotSelect').value = item.suggestedSlot;
      }
      if (item.suggestedCategory) {
        document.getElementById('equipCategorySelect').value = item.suggestedCategory;
      }
      if (item.reqLevel) {
        document.getElementById('equipReqLevelInput').value = item.reqLevel;
      }

      if (Array.isArray(item.stats) && item.stats.length > 0) {
        item.stats.forEach((st) => {
          const valNum = parseInt(String(st.value).replace(/[^0-9-]/g, ''), 10) || 0;
          const lbl = (st.label || '').toLowerCase();
          if (lbl.includes('ataque físico') || lbl.includes('dano físico')) {
            const el = document.getElementById('equipCombatPHYS_ATKInput');
            if (el && Number(el.value) === 0) el.value = valNum;
          } else if (lbl.includes('ataque mágico') || lbl.includes('dano mágico')) {
            const el = document.getElementById('equipCombatMAG_ATKInput');
            if (el && Number(el.value) === 0) el.value = valNum;
          } else if (lbl.includes('defesa física')) {
            const el = document.getElementById('equipCombatPHYS_DEFInput');
            if (el && Number(el.value) === 0) el.value = valNum;
          } else if (lbl.includes('defesa mágica')) {
            const el = document.getElementById('equipCombatMAG_DEFInput');
            if (el && Number(el.value) === 0) el.value = valNum;
          }
        });
      }
    };

    app.renderEquipmentGallery = function () {
      const grid = document.getElementById('equipGalleryGrid');
      if (!grid) return;

      const q = (this.equipmentGallerySearchQuery || '').toLowerCase();
      const grp = this.equipmentGalleryGroupFilter || 'ALL';

      const filtered = (this.mcreworkEquipment || []).filter((item) => {
        if (grp !== 'ALL' && item.categoryGroup !== grp) return false;
        if (!q) return true;
        return (item.name && item.name.toLowerCase().includes(q)) ||
               (item.positionName && item.positionName.toLowerCase().includes(q)) ||
               (item.typeName && item.typeName.toLowerCase().includes(q)) ||
               (item.mcreworkIconKey && item.mcreworkIconKey.toLowerCase().includes(q));
      });

      const countBadge = document.getElementById('equipGalleryCountBadge');
      if (countBadge) countBadge.textContent = `${filtered.length} de ${this.mcreworkEquipment.length} ícones`;

      if (filtered.length === 0) {
        grid.innerHTML = '<div style="color:var(--text-muted); padding:16px; font-size:0.8rem; grid-column:1/-1; text-align:center;">Nenhum equipamento encontrado com a busca.</div>';
        return;
      }

      grid.innerHTML = filtered.slice(0, 160).map((item) => `
        <div onclick='AdminApp.selectMcreworkEquipment(${JSON.stringify(item).replace(/'/g, "&apos;")})'
             title="${item.name} (${item.positionName}) - Nível ${item.reqLevel}"
             style="cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:4px; padding:6px; background:rgba(30,41,59,0.7); border:1px solid #334155; border-radius:8px; transition:all 0.15s ease;"
             onmouseover="this.style.borderColor='#38bdf8'; this.style.transform='scale(1.05)';"
             onmouseout="this.style.borderColor='#334155'; this.style.transform='scale(1)';"
        >
          <img src="${item.iconUrl}" alt="${item.name}" loading="lazy" style="width:36px; height:36px; object-fit:contain;" />
          <span style="font-size:0.65rem; color:#cbd5e1; text-align:center; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:80px;">${item.name}</span>
          <span style="font-size:0.60rem; color:#38bdf8;">${item.positionName}</span>
        </div>
      `).join('');
    };

    app.saveEquipmentTemplate = async function () {
      const editId = document.getElementById('equipEditIdInput').value;
      const namePtBr = document.getElementById('equipNameInput').value.trim();
      const descriptionPtBr = document.getElementById('equipDescriptionInput').value.trim();
      const code = document.getElementById('equipCodeInput').value.trim();
      const itemCategory = document.getElementById('equipCategorySelect').value;
      const equipmentSlotCode = document.getElementById('equipSlotSelect').value;
      const rarityTier = document.getElementById('equipRaritySelect').value;
      const requiredLevel = parseInt(document.getElementById('equipReqLevelInput').value, 10) || 1;
      const priceGold = parseInt(document.getElementById('equipPriceInput').value, 10) || 0;
      const isActive = document.getElementById('equipActiveSelect').value === 'true';
      const mcreworkIconKey = document.getElementById('equipIconKeyInput').value.trim();

      if (!namePtBr) {
        alert('Por favor, informe o nome do equipamento em português.');
        return;
      }

      const baseStatBonusesJson = {};
      ['VIT', 'STR', 'INT', 'WIS', 'AGI', 'DEX'].forEach((attr) => {
        const val = parseInt(document.getElementById(`equipBase${attr}Input`)?.value, 10) || 0;
        if (val !== 0) baseStatBonusesJson[attr] = val;
      });

      const combatStatBonusesJson = {};
      const combatFields = [
        'PHYS_ATK', 'MAG_ATK', 'PHYS_DEF', 'MAG_DEF',
        'BATTLE_MOVE_SPEED', 'ATTACK_SPEED', 'PHYS_ACCURACY',
        'MAG_ACCURACY', 'PHYS_EVASION', 'MAG_EVASION',
        'CRIT_CHANCE_PCT', 'CRIT_DAMAGE_PCT', 'ATTACK_RANGE'
      ];
      combatFields.forEach((cf) => {
        const val = parseFloat(document.getElementById(`equipCombat${cf}Input`)?.value) || 0;
        if (val !== 0) combatStatBonusesJson[cf] = val;
      });

      const payload = {
        code: code || undefined,
        namePtBr,
        descriptionPtBr,
        itemCategory,
        equipmentSlotCode,
        rarityTier,
        requiredLevel,
        priceGold,
        isActive,
        mcreworkIconKey,
        baseStatBonusesJson,
        combatStatBonusesJson,
      };

      try {
        if (editId) {
          await this.api(`/api/admin/equipments/${editId}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          });
        } else {
          await this.api('/api/admin/equipments', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
        }
        document.getElementById('equipmentModal').style.display = 'none';
        await this.loadEquipmentTemplates();
      } catch (err) {
        alert(`Erro ao salvar Equipamento: ${err.message}`);
      }
    };

    app.deleteEquipmentTemplate = async function (id, name) {
      if (!confirm(`Deseja realmente excluir o equipamento "${name}" (#${id})?`)) return;
      try {
        await this.api(`/api/admin/equipments/${id}`, { method: 'DELETE' });
        await this.loadEquipmentTemplates();
      } catch (err) {
        alert(`Erro ao excluir Equipamento: ${err.message}`);
      }
    };

    app.renderEquipmentsCrudTable = function () {
      const container = document.getElementById('equipmentsTableContainer');
      if (!container) return;

      const q = (this.equipmentSearchQuery || '').toLowerCase();
      const sF = this.equipmentSlotFilter || 'ALL';
      const cF = this.equipmentCategoryFilter || 'ALL';
      const rF = this.equipmentRarityFilter || 'ALL';

      const filtered = (this.equipmentTemplates || []).filter((e) => {
        if (sF !== 'ALL' && e.equipmentSlotCode !== sF) return false;
        if (cF !== 'ALL' && e.itemCategory !== cF) return false;
        if (rF !== 'ALL' && e.rarityTier !== rF) return false;
        if (!q) return true;
        return (e.namePtBr && e.namePtBr.toLowerCase().includes(q)) ||
               (e.code && e.code.toLowerCase().includes(q)) ||
               (e.equipmentSlotCode && e.equipmentSlotCode.toLowerCase().includes(q)) ||
               (e.mcreworkIconKey && e.mcreworkIconKey.toLowerCase().includes(q));
      });

      const countBadge = document.getElementById('equipmentsCounterBadge');
      if (countBadge) countBadge.textContent = `${filtered.length} de ${this.equipmentTemplates.length} equipamentos cadastrados`;

      if (filtered.length === 0) {
        container.innerHTML = `
          <div style="text-align:center; padding:36px 12px; color:var(--text-muted);">
            🛡️ Nenhum equipamento encontrado com os filtros atuais. Clique em <strong>➕ Novo Equipamento</strong> para cadastrar!
          </div>
        `;
        return;
      }

      const rarityColors = { SS: '#fbbf24', S: '#c084fc', A: '#38bdf8', B: '#4ade80', C: '#fde047', D: '#cbd5e1', F: '#94a3b8', COMMON: '#94a3b8' };
      const slotIcons = {
        HEAD: '👑', CHEST: '🥋', SHOULDER: '🛡️', BELT: '🎗️', LEGS: '👖', FEET: '👢',
        WEAPON_1: '⚔️', WEAPON_2: '🛡️', NECKLACE: '📿', RING: '💍', ORNAMENT_1: '🧿', ORNAMENT_2: '🔮',
        WINGS: '🪽', FASHION: '👗', FISHING_ROD: '🎣', FLYING_MOUNT: '🦅',
        PET_EQUIP_1: '🐾', PET_EQUIP_2: '🐾', PET_EQUIP_3: '🐾', PET_EQUIP_4: '🐾', PET_EQUIP_5: '🐾', PET_EQUIP_6: '🐾'
      };

      container.innerHTML = `
        <table class="data-table" style="width:100%; border-collapse:collapse; font-size:0.83rem;">
          <thead>
            <tr style="border-bottom:1px solid var(--border); text-align:left; color:#94a3b8;">
              <th style="padding:10px;">Ícone</th>
              <th style="padding:10px;">Nome & Código</th>
              <th style="padding:10px;">Slot / Categoria</th>
              <th style="padding:10px;">Raridade</th>
              <th style="padding:10px;">Nível Mín.</th>
              <th style="padding:10px;">Bônus de Atributos Base</th>
              <th style="padding:10px;">Atributos de Combate da Arena</th>
              <th style="padding:10px;">Preço</th>
              <th style="padding:10px;">Status</th>
              <th style="padding:10px; text-align:right;">Ações</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map((item) => {
              const b = item.baseStatBonusesJson || {};
              const cb = item.combatStatBonusesJson || {};
              const rColor = rarityColors[item.rarityTier] || '#94a3b8';
              const sIcon = slotIcons[item.equipmentSlotCode] || '🛡️';
              const isPet = item.itemCategory === 'PET_EQUIPMENT';

              const baseStatsText = Object.entries(b)
                .filter(([_, v]) => v !== 0)
                .map(([k, v]) => `<span style="margin-right:6px; color:#fde047;">${k}: ${v > 0 ? '+' : ''}${v}</span>`)
                .join('') || '<span style="color:var(--text-muted);">-</span>';

              const combatStatsText = Object.entries(cb)
                .filter(([_, v]) => v !== 0)
                .map(([k, v]) => {
                  let color = '#38bdf8';
                  if (k === 'BATTLE_MOVE_SPEED') color = '#4ade80';
                  if (k === 'ATTACK_SPEED') color = '#f43f5e';
                  return `<span style="margin-right:6px; color:${color}; font-size:0.75rem;">${k}: ${v > 0 ? '+' : ''}${v}</span>`;
                })
                .join('<br/>') || '<span style="color:var(--text-muted);">-</span>';

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
                    <span style="color:#bae6fd; font-weight:600;">${sIcon} ${item.slotNamePtBr}</span>
                    <div style="font-size:0.72rem; color:${isPet ? '#c084fc' : '#94a3b8'};">${isPet ? '🐾 Equip. de Pet' : '👤 Equip. de Personagem'}</div>
                  </td>
                  <td style="padding:8px 10px;">
                    <span style="font-weight:700; color:${rColor}; border:1px solid ${rColor}; padding:2px 8px; border-radius:4px; font-size:0.75rem;">
                      ${item.rarityTier}
                    </span>
                  </td>
                  <td style="padding:8px 10px; font-weight:700; color:#cbd5e1;">
                    Nv. ${item.requiredLevel}
                  </td>
                  <td style="padding:8px 10px; font-size:0.75rem; font-family:monospace;">
                    ${baseStatsText}
                  </td>
                  <td style="padding:8px 10px; font-family:monospace;">
                    ${combatStatsText}
                  </td>
                  <td style="padding:8px 10px; font-weight:700; color:#fde047;">
                    🪙 ${item.priceGold || 0}
                  </td>
                  <td style="padding:8px 10px;">
                    ${item.isActive ? '<span style="color:#4ade80; font-weight:700;">🟢 Ativo</span>' : '<span style="color:#f87171;">🔴 Inativo</span>'}
                  </td>
                  <td style="padding:8px 10px; text-align:right; white-space:nowrap;">
                    <button class="btn-primary" style="padding:4px 8px; font-size:0.75rem; margin-right:4px;" onclick="AdminApp.openEditEquipmentModal(${item.id})">✏️ Editar</button>
                    <button class="btn-danger" style="padding:4px 8px; font-size:0.75rem;" onclick="AdminApp.deleteEquipmentTemplate(${item.id}, '${item.namePtBr}')">🗑️</button>
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
    const btnPets = document.getElementById('tabBtnPets');
    if (navTabs && !document.getElementById('tabBtnEquipments')) {
      const btn = document.createElement('button');
      btn.id = 'tabBtnEquipments';
      btn.onclick = () => window.AdminApp.switchTab('equipments');
      btn.textContent = '🛡️ Equipamentos';
      if (btnPets && btnPets.nextSibling) {
        navTabs.insertBefore(btn, btnPets.nextSibling);
      } else {
        navTabs.appendChild(btn);
      }
    }

    // 2. Injeta Painel da Aba (#tabEquipments) dentro de #adminApp
    const adminApp = document.getElementById('adminApp');
    if (adminApp && !document.getElementById('tabEquipments')) {
      const panel = document.createElement('div');
      panel.id = 'tabEquipments';
      panel.style.cssText = 'display:none; padding:16px; max-width:1200px; margin:0 auto; width:100%; gap:16px; flex-direction:column;';
      panel.innerHTML = `
        <div class="panel">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
            <div>
              <h3 style="margin:0; color:#38bdf8;">🛡️ Tabela de Equipamentos & Itens (Templates no PostgreSQL)</h3>
              <p style="font-size:0.8rem; color:var(--text-muted); margin:4px 0 0;">
                Gerencie armaduras, roupas, armas, elmos, escudos, botas, joias, asas e itens de pet com atributos base e de combate da arena.
              </p>
            </div>
            <div style="display:flex; gap:8px; align-items:center;">
              <span id="equipmentsCounterBadge" style="font-size:0.8rem; color:var(--text-muted);"></span>
              <button class="btn-primary" onclick="AdminApp.openCreateEquipmentModal()">➕ Novo Equipamento</button>
            </div>
          </div>
          <!-- Filtros e Busca -->
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:10px; margin-top:14px; padding-bottom:12px; border-bottom:1px solid var(--border);">
            <div class="field">
              <label>🔍 Buscar por Nome/Código</label>
              <input type="text" id="equipSearchInput" placeholder="Ex: Espada, Elmo, equip_..." oninput="AdminApp.filterEquipmentsCrudTable()" />
            </div>
            <div class="field">
              <label>Slot de Equipamento</label>
              <select id="equipSlotFilterSelect" onchange="AdminApp.filterEquipmentsCrudTable()">
                <option value="ALL">Todos os Slots</option>
              </select>
            </div>
            <div class="field">
              <label>Categoria</label>
              <select id="equipCategoryFilterSelect" onchange="AdminApp.filterEquipmentsCrudTable()">
                <option value="ALL">Todas as Categorias</option>
                <option value="CHARACTER_EQUIPMENT">👤 Personagem (16 Slots)</option>
                <option value="PET_EQUIPMENT">🐾 Pet (6 Slots)</option>
              </select>
            </div>
            <div class="field">
              <label>Raridade</label>
              <select id="equipRarityFilterSelect" onchange="AdminApp.filterEquipmentsCrudTable()">
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
          <div id="equipmentsTableContainer" style="overflow-x:auto; margin-top:12px;"></div>
        </div>
      `;
      const tabPets = document.getElementById('tabPets');
      if (tabPets && tabPets.nextSibling) {
        adminApp.insertBefore(panel, tabPets.nextSibling);
      } else {
        adminApp.appendChild(panel);
      }
    }

    // 3. Injeta Modal (#equipmentModal) no body
    if (document.getElementById('equipmentModal')) return;

    const modal = document.createElement('div');
    modal.id = 'equipmentModal';
    modal.className = 'modal-backdrop';
    modal.style.display = 'none';

    modal.innerHTML = `
      <div class="modal-box" style="max-width:1050px; width:96%; max-height:92vh; display:block; overflow-y:auto; -webkit-overflow-scrolling:touch; padding:16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:10px; margin-bottom:12px;">
          <h3 id="equipModalTitle" style="color:#38bdf8; margin:0; font-size:1.05rem;">🛡️ Cadastrar / Editar Equipamento</h3>
          <div style="display:flex; gap:8px;">
            <button class="btn-success" onclick="AdminApp.saveEquipmentTemplate()" style="padding:6px 14px; font-weight:700;">💾 Salvar</button>
            <button class="btn-danger" onclick="AdminApp.closeModal('equipmentModal')" style="padding:6px 10px;">✕</button>
          </div>
        </div>

        <input type="hidden" id="equipEditIdInput" value="" />
        <input type="hidden" id="equipIconKeyInput" value="" />

        <!-- BLOCO 1: IDENTIDADE & SLOT -->
        <div style="background:rgba(15,23,42,0.75); border:1px solid #334155; border-radius:10px; padding:12px; margin-bottom:12px;">
          <div style="font-size:0.80rem; font-weight:700; color:#38bdf8; margin-bottom:8px;">1️⃣ Identidade, Slot de Equipamento & Restrições</div>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(170px, 1fr)); gap:10px;">
            <div class="field">
              <label>Nome do Equipamento (PT-BR) *</label>
              <input type="text" id="equipNameInput" placeholder="Ex: Espada Longa de Aço" />
            </div>
            <div class="field">
              <label>Código Único (opcional)</label>
              <input type="text" id="equipCodeInput" placeholder="Auto-gerado se vazio" />
            </div>
            <div class="field">
              <label>Categoria de Equipamento</label>
              <select id="equipCategorySelect">
                <option value="CHARACTER_EQUIPMENT">👤 Equipamento de Personagem (16 Slots)</option>
                <option value="PET_EQUIPMENT">🐾 Equipamento de Pet (6 Slots)</option>
              </select>
            </div>
            <div class="field">
              <label>Slot de Equipamento *</label>
              <select id="equipSlotSelect"></select>
            </div>
            <div class="field">
              <label>Raridade</label>
              <select id="equipRaritySelect">
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
              <input type="number" id="equipReqLevelInput" value="1" min="1" max="100" />
            </div>
            <div class="field">
              <label>Preço em Moedas de Ouro (🪙)</label>
              <input type="number" id="equipPriceInput" value="100" min="0" />
            </div>
            <div class="field">
              <label>Status</label>
              <select id="equipActiveSelect">
                <option value="true">🟢 Ativo (Visível no Jogo)</option>
                <option value="false">🔴 Inativo (Oculto)</option>
              </select>
            </div>
            <div class="field" style="grid-column: 1 / -1;">
              <label>Descrição em Português</label>
              <input type="text" id="equipDescriptionInput" placeholder="Ex: Forjada com ligas de ferro temperado em chamas de dragão..." />
            </div>
          </div>
        </div>

        <!-- BLOCO 2 & 3: BÔNUS DE ATRIBUTOS BASE & COMBATE -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
          <!-- Atributos Base -->
          <div style="background:rgba(15,23,42,0.75); border:1px solid #334155; border-radius:10px; padding:12px;">
            <div style="font-size:0.80rem; font-weight:700; color:#fde047; margin-bottom:8px;">2️⃣ Bônus de Atributos Base (VIT, STR, INT, WIS, AGI, DEX)</div>
            <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px;">
              <div class="field"><label>VIT</label><input type="number" id="equipBaseVITInput" value="0" /></div>
              <div class="field"><label>STR</label><input type="number" id="equipBaseSTRInput" value="0" /></div>
              <div class="field"><label>INT</label><input type="number" id="equipBaseINTInput" value="0" /></div>
              <div class="field"><label>WIS</label><input type="number" id="equipBaseWISInput" value="0" /></div>
              <div class="field"><label>AGI</label><input type="number" id="equipBaseAGIInput" value="0" /></div>
              <div class="field"><label>DEX</label><input type="number" id="equipBaseDEXInput" value="0" /></div>
            </div>
          </div>

          <!-- Atributos de Combate em Batalha Action -->
          <div style="background:rgba(15,23,42,0.75); border:1px solid #334155; border-radius:10px; padding:12px;">
            <div style="font-size:0.80rem; font-weight:700; color:#38bdf8; margin-bottom:8px;">3️⃣ Bônus de Combate na Arena (ATK, DEF, Vel., Aspd)</div>
            <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:8px;">
              <div class="field"><label>Ataque Físico (+ATK)</label><input type="number" id="equipCombatPHYS_ATKInput" value="0" /></div>
              <div class="field"><label>Ataque Mágico (+MATK)</label><input type="number" id="equipCombatMAG_ATKInput" value="0" /></div>
              <div class="field"><label>Defesa Física (+DEF)</label><input type="number" id="equipCombatPHYS_DEFInput" value="0" /></div>
              <div class="field"><label>Defesa Mágica (+MDEF)</label><input type="number" id="equipCombatMAG_DEFInput" value="0" /></div>
              <div class="field"><label>Vel. Batalha (px/s bônus)</label><input type="number" id="equipCombatBATTLE_MOVE_SPEEDInput" value="0" /></div>
              <div class="field"><label>Vel. Ataque (+Aspd)</label><input type="number" id="equipCombatATTACK_SPEEDInput" value="0" step="0.05" /></div>
              <div class="field"><label>Precisão Física</label><input type="number" id="equipCombatPHYS_ACCURACYInput" value="0" /></div>
              <div class="field"><label>Desvio Físico</label><input type="number" id="equipCombatPHYS_EVASIONInput" value="0" /></div>
              <div class="field"><label>Taxa Crítica (%)</label><input type="number" id="equipCombatCRIT_CHANCE_PCTInput" value="0" /></div>
              <div class="field"><label>Alcance Ataque (px)</label><input type="number" id="equipCombatATTACK_RANGEInput" value="0" /></div>
            </div>
          </div>
        </div>

        <!-- BLOCO 4: GALERIA DE 1.865 ÍCONES DO MCREWORK & PRÉ-VISUALIZAÇÃO -->
        <div style="background:rgba(15,23,42,0.75); border:1px solid #334155; border-radius:10px; padding:12px; margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:8px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <img id="equipActiveIconImg" src="" style="width:42px; height:42px; object-fit:contain; border-radius:6px; background:#020617; border:1px solid #38bdf8;" />
              <div>
                <strong style="color:#c084fc; font-size:0.82rem;">4️⃣ Galeria Oficial de Ícones & Equipamentos (mcrework)</strong>
                <div id="equipActiveIconBadge" style="font-size:0.68rem; color:var(--text-muted); font-family:monospace;"></div>
              </div>
            </div>
            <span id="equipGalleryCountBadge" style="font-size:0.75rem; color:#bae6fd;"></span>
          </div>

          <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px;">
            <button class="btn-primary equip-gal-btn" data-group="ALL" onclick="AdminApp.setEquipmentGalleryGroup('ALL')">🌐 Todos</button>
            <button class="equip-gal-btn" data-group="weapons" onclick="AdminApp.setEquipmentGalleryGroup('weapons')">⚔️ Armas (123)</button>
            <button class="equip-gal-btn" data-group="armor" onclick="AdminApp.setEquipmentGalleryGroup('armor')">🥋 Armaduras (600)</button>
            <button class="equip-gal-btn" data-group="offhand" onclick="AdminApp.setEquipmentGalleryGroup('offhand')">🛡️ Escudos/Offhand (101)</button>
            <button class="equip-gal-btn" data-group="jewelry" onclick="AdminApp.setEquipmentGalleryGroup('jewelry')">💍 Joias (137)</button>
            <button class="equip-gal-btn" data-group="wings_costumes" onclick="AdminApp.setEquipmentGalleryGroup('wings_costumes')">🪽 Asas & Trajes (334)</button>
            <button class="equip-gal-btn" data-group="pet" onclick="AdminApp.setEquipmentGalleryGroup('pet')">🐾 Pets (570)</button>
          </div>

          <input type="text" id="equipGallerySearchInput" placeholder="🔎 Filtrar ícone por nome, posição ou tipo..." oninput="AdminApp.filterEquipmentGallery()" style="margin-bottom:8px; width:100%;" />
          <div id="equipGalleryGrid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(88px, 1fr)); gap:8px; max-height:220px; overflow-y:auto; padding:4px;"></div>
        </div>

        <div style="border-top:1px solid var(--border); padding-top:10px;">
          <button class="btn-success" style="width:100%; padding:12px; font-weight:700; font-size:0.95rem;" onclick="AdminApp.saveEquipmentTemplate()">
            💾 Salvar Equipamento Completo na Tabela
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  }
}

window.AdminEquipmentsTab = AdminEquipmentsTab;
