/**
 * @file AdminEquipmentTableView.js
 * @description Sub-módulo visual e de listagem da aba Equipamentos no painel Admin:
 * injeta o botão/painel da aba, gerencia filtros da tabela CRUD e da galeria mcrework,
 * e renderiza as visões desktop (tabela) e mobile (cards) dos equipamentos cadastrados.
 */
class AdminEquipmentTableView {
  /**
   * Injeta o botão da aba Equipamentos e o painel #tabEquipments no DOM do Admin.
   */
  static injectTabDom() {
    // 1. Injeta Botão na Barra Superior (.nav-tabs)
    const navTabs = document.querySelector('.nav-tabs');
    const btnMonsters = document.getElementById('tabBtnMonsters');
    if (navTabs && !document.getElementById('tabBtnEquipments')) {
      const btn = document.createElement('button');
      btn.id = 'tabBtnEquipments';
      btn.onclick = () => window.AdminApp.switchTab('equipments');
      btn.textContent = '🛡️ Equipamentos';
      if (btnMonsters && btnMonsters.nextSibling) {
        navTabs.insertBefore(btn, btnMonsters.nextSibling);
      } else {
        navTabs.appendChild(btn);
      }
    }

    // 2. Injeta Painel da Aba (#tabEquipments) dentro de #adminApp
    const adminApp = document.getElementById('adminApp');
    if (adminApp && !document.getElementById('tabEquipments')) {
      const panel = document.createElement('div');
      panel.id = 'tabEquipments';
      panel.style.cssText = 'display:none; padding:14px; max-width:1300px; margin:0 auto; width:100%; gap:14px; flex-direction:column; box-sizing:border-box;';
      panel.innerHTML = `
        <div class="panel" style="padding:14px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <div>
              <h3 style="margin:0; font-size:1.05rem; color:#38bdf8;">🛡️ Tabela de Equipamentos & Armas (Templates no PostgreSQL)</h3>
              <p style="font-size:0.78rem; color:var(--text-muted); margin:4px 0 0;">
                Gerencie armaduras, roupas, armas, elmos, escudos, botas, joias, asas e equipamentos de pet com bônus exclusivos de combate na arena.
              </p>
            </div>
            <div style="display:flex; gap:8px; align-items:center;">
              <span id="equipmentsCounterBadge" style="font-size:0.78rem; color:var(--text-muted); font-weight:600;"></span>
              <button class="btn-primary" onclick="AdminApp.openCreateEquipmentModal()" style="min-height:40px; font-weight:700; padding:8px 16px; border-radius:6px;">
                ➕ Novo Equipamento
              </button>
            </div>
          </div>

          <!-- Filtros e Busca Adaptativos -->
          <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-top:12px; background:rgba(15,23,42,0.6); padding:8px 10px; border-radius:8px; border:1px solid #334155;">
            <input type="text" id="equipSearchInput" placeholder="🔍 Buscar equipamento por nome ou código..." oninput="AdminApp.filterEquipmentsCrudTable()" style="flex:1; min-width:180px; padding:7px 10px; font-size:0.82rem;" />
            <select id="equipSlotFilterSelect" onchange="AdminApp.filterEquipmentsCrudTable()" style="width:160px; padding:7px; font-size:0.8rem;">
              <option value="ALL">Todos os Slots</option>
            </select>
            <select id="equipSetFilterSelect" onchange="AdminApp.filterEquipmentsCrudTable()" style="width:160px; padding:7px; font-size:0.8rem;">
              <option value="ALL">Todos os Conjuntos</option>
            </select>
            <select id="equipCategoryFilterSelect" onchange="AdminApp.filterEquipmentsCrudTable()" style="width:145px; padding:7px; font-size:0.8rem;">
              <option value="ALL">Todas Categorias</option>
              <option value="CHARACTER_EQUIPMENT">👤 Personagem</option>
              <option value="PET_EQUIPMENT">🐾 Pet</option>
            </select>
            <select id="equipRarityFilterSelect" onchange="AdminApp.filterEquipmentsCrudTable()" style="width:130px; padding:7px; font-size:0.8rem;">
              <option value="ALL">Todas Raridades</option>
              <option value="SS">Rank SS (Mítico)</option>
              <option value="S">Rank S (Lendário)</option>
              <option value="A">Rank A (Épico)</option>
              <option value="B">Rank B (Raro)</option>
              <option value="C">Rank C (Incomum)</option>
              <option value="D">Rank D (Regular)</option>
              <option value="F">Rank F (Básico)</option>
              <option value="COMMON">COMMON (Comum)</option>
            </select>
          </div>

          <div id="equipmentsTableContainer" style="margin-top:12px;"></div>
        </div>
      `;
      const tabMonsters = document.getElementById('tabMonsters');
      if (tabMonsters && tabMonsters.nextSibling) {
        adminApp.insertBefore(panel, tabMonsters.nextSibling);
      } else {
        adminApp.appendChild(panel);
      }
    }
  }

  /**
   * Anexa os métodos de filtro, galeria e renderização da tabela de equipamentos no AdminApp.
   */
  static attach(app) {
    app.filterEquipmentsCrudTable = function () {
      const input = document.getElementById('equipSearchInput');
      this.equipmentSearchQuery = (input ? input.value : '').toLowerCase().trim();
      this.equipmentSlotFilter = document.getElementById('equipSlotFilterSelect')?.value || 'ALL';
      this.equipmentSetFilter = document.getElementById('equipSetFilterSelect')?.value || 'ALL';
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

    app.formatEquipmentCombatBadges = function (cb) {
      if (!cb || typeof cb !== 'object' || Object.keys(cb).length === 0) {
        return '<span style="color:var(--text-muted); font-size:0.75rem;">— Sem bônus de combate</span>';
      }

      const badges = [];
      const addBadge = (label, val, color, unit = '') => {
        if (!val || val === 0) return;
        const sign = val > 0 ? '+' : '';
        badges.push(`<span style="display:inline-flex; align-items:center; gap:2px; padding:1px 6px; border-radius:4px; background:rgba(15,23,42,0.8); border:1px solid ${color}; font-size:0.70rem; color:${color}; font-family:monospace; white-space:nowrap;"><strong>${label}</strong> ${sign}${val}${unit}</span>`);
      };

      addBadge('⚔️ ATK', cb.PHYS_ATK, '#f87171');
      addBadge('🔮 MATK', cb.MAG_ATK, '#c084fc');
      addBadge('✨ Cura', cb.HEAL_POWER, '#86efac');
      addBadge('🎯 Alcance', cb.ATTACK_RANGE, '#fde047', 'px');
      addBadge('❤️ HP', cb.MAX_HP, '#4ade80');
      addBadge('💧 MP', cb.MAX_MP, '#38bdf8');
      addBadge('🛡️ DEF', cb.PHYS_DEF, '#60a5fa');
      addBadge('🔮 MDEF', cb.MAG_DEF, '#a78bfa');
      addBadge('🏃 Vel', cb.BATTLE_MOVE_SPEED, '#38bdf8', 'px/s');
      addBadge('⚡ Aspd', cb.ATTACK_SPEED, '#fde047', '/s');
      addBadge('💥 Crit', cb.CRIT_RATE ?? cb.CRIT_CHANCE_PCT, '#f43f5e', '%');
      addBadge('⚡ DanoCrit', cb.CRIT_DMG ?? cb.CRIT_DAMAGE_PCT, '#fb7185', '%');
      addBadge('🎯 Prec', cb.PHYS_ACCURACY, '#4ade80', '%');
      addBadge('💨 Desv', cb.PHYS_EVASION, '#a3e635', '%');
      addBadge('🔮 PrecMag', cb.MAG_ACCURACY, '#c084fc', '%');
      addBadge('✨ DesvMag', cb.MAG_EVASION, '#e879f9', '%');

      return badges.length > 0
        ? `<div style="display:flex; flex-wrap:wrap; gap:4px;">${badges.join('')}</div>`
        : '<span style="color:var(--text-muted); font-size:0.75rem;">— Sem bônus de combate</span>';
    };

    app.renderEquipmentsCrudTable = function () {
      const container = document.getElementById('equipmentsTableContainer');
      if (!container) return;

      const q = (this.equipmentSearchQuery || '').toLowerCase();
      const sF = this.equipmentSlotFilter || 'ALL';
      const setF = this.equipmentSetFilter || 'ALL';
      const cF = this.equipmentCategoryFilter || 'ALL';
      const rF = this.equipmentRarityFilter || 'ALL';

      const filtered = (this.equipmentTemplates || []).filter((e) => {
        if (sF !== 'ALL' && e.equipmentSlotCode !== sF) return false;
        if (setF !== 'ALL') {
          if (setF === 'NONE' && e.equipmentSetId) return false;
          if (setF !== 'NONE' && String(e.equipmentSetId) !== setF) return false;
        }
        if (cF !== 'ALL' && e.itemCategory !== cF) return false;
        if (rF !== 'ALL' && e.rarityTier !== rF) return false;
        if (!q) return true;
        return (e.namePtBr && e.namePtBr.toLowerCase().includes(q)) ||
               (e.code && e.code.toLowerCase().includes(q)) ||
               (e.equipmentSlotCode && e.equipmentSlotCode.toLowerCase().includes(q)) ||
               (e.descriptionPtBr && e.descriptionPtBr.toLowerCase().includes(q)) ||
               (e.mcreworkIconKey && e.mcreworkIconKey.toLowerCase().includes(q));
      });

      const countBadge = document.getElementById('equipmentsCounterBadge');
      if (countBadge) countBadge.textContent = `${filtered.length} de ${this.equipmentTemplates.length} equipamentos`;

      if (filtered.length === 0) {
        container.innerHTML = `
          <div style="text-align:center; padding:36px 12px; color:var(--text-muted); background:rgba(15,23,42,0.6); border-radius:8px;">
            🛡️ Nenhum equipamento encontrado com os filtros atuais. Clique em <strong>➕ Novo Equipamento</strong> para cadastrar!
          </div>
        `;
        return;
      }

      const rarityColors = {
        SS: { text: '#fbbf24', border: '#f59e0b', bg: 'rgba(245,158,11,0.18)' },
        S: { text: '#c084fc', border: '#a855f7', bg: 'rgba(168,85,247,0.18)' },
        A: { text: '#38bdf8', border: '#0ea5e9', bg: 'rgba(14,165,233,0.18)' },
        B: { text: '#4ade80', border: '#22c55e', bg: 'rgba(34,197,94,0.18)' },
        C: { text: '#fde047', border: '#eab308', bg: 'rgba(234,179,8,0.18)' },
        D: { text: '#fdba74', border: '#f97316', bg: 'rgba(249,115,22,0.18)' },
        F: { text: '#cbd5e1', border: '#64748b', bg: 'rgba(100,116,139,0.18)' },
        COMMON: { text: '#cbd5e1', border: '#64748b', bg: 'rgba(100,116,139,0.18)' },
        RARE: { text: '#4ade80', border: '#22c55e', bg: 'rgba(34,197,94,0.18)' },
        EPIC: { text: '#38bdf8', border: '#0ea5e9', bg: 'rgba(14,165,233,0.18)' },
        LEGENDARY: { text: '#c084fc', border: '#a855f7', bg: 'rgba(168,85,247,0.18)' },
        MYTHIC: { text: '#fbbf24', border: '#f59e0b', bg: 'rgba(245,158,11,0.18)' },
      };

      const slotIcons = {
        HEAD: '👑', CHEST: '🥋', SHOULDER: '🛡️', BELT: '🎗️', LEGS: '👖', FEET: '👢',
        WEAPON_1: '⚔️', WEAPON_2: '🛡️', NECKLACE: '📿', RING: '💍', ORNAMENT_1: '🧿', ORNAMENT_2: '🔮',
        WINGS: '🪽', FASHION: '👗', FISHING_ROD: '🎣', FLYING_MOUNT: '🦅',
        PET_EQUIP_1: '🐾', PET_EQUIP_2: '🐾', PET_EQUIP_3: '🐾', PET_EQUIP_4: '🐾', PET_EQUIP_5: '🐾', PET_EQUIP_6: '🐾'
      };

      // 1. VISÃO DESKTOP (Tabela Completa sem Ouro e sem Atributos Base)
      const desktopTableHtml = `
        <div class="equipments-desktop-view" style="overflow-x:auto;">
          <table class="data-table" style="width:100%; border-collapse:collapse; font-size:0.83rem; min-width:860px;">
            <thead>
              <tr style="border-bottom:1px solid var(--border); text-align:left; color:#94a3b8;">
                <th style="padding:10px; width:50px;">Ícone</th>
                <th style="padding:10px;">Nome & Código</th>
                <th style="padding:10px;">Slot / Categoria</th>
                <th style="padding:10px; width:140px; color:#eab308;">👑 Conjunto</th>
                <th style="padding:10px; width:90px;">Raridade</th>
                <th style="padding:10px; width:75px;">Nível Mín.</th>
                <th style="padding:10px; color:#38bdf8;">⚔️ Atributos de Combate da Arena</th>
                <th style="padding:10px; width:80px;">Status</th>
                <th style="padding:10px; text-align:right; width:110px;">Ações</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.map((item) => {
                const cb = item.combatStatBonusesJson || {};
                const rStyle = rarityColors[item.rarityTier] || rarityColors.COMMON;
                const sIcon = slotIcons[item.equipmentSlotCode] || '🛡️';
                const isPet = item.itemCategory === 'PET_EQUIPMENT';

                return `
                  <tr style="border-bottom:1px solid rgba(51,65,85,0.4);">
                    <td style="padding:8px 10px;">
                      <img src="${item.iconUrl}" alt="${item.namePtBr}" style="width:40px; height:40px; object-fit:contain; border-radius:6px; background:#020617; border:1px solid ${rStyle.border};" />
                    </td>
                    <td style="padding:8px 10px;">
                      <strong style="color:#f8fafc; font-size:0.88rem;">${item.namePtBr}</strong>${item.equipmentSlotCode === 'WEAPON_1' && item.specialEffectJson?.weaponModelId ? '<span style="font-size:0.65rem; color:#22d3ee; background:rgba(34,211,238,0.12); border:1px solid #0891b2; padding:1px 5px; border-radius:4px; margin-left:4px;">⚔️ 2.5D</span>' : ''}
                      <div style="font-size:0.71rem; color:var(--text-muted); font-family:monospace;">${item.code}</div>
                      ${item.descriptionPtBr ? `<div style="font-size:0.71rem; color:#94a3b8; max-width:240px; margin-top:2px; line-height:1.2;">📜 ${item.descriptionPtBr}</div>` : ''}
                    </td>
                    <td style="padding:8px 10px;">
                      <span style="color:#bae6fd; font-weight:700;">${sIcon} ${item.slotNamePtBr}</span>
                      <div style="font-size:0.70rem; color:${isPet ? '#c084fc' : '#94a3b8'}; margin-top:2px;">${isPet ? '🐾 Pet' : '👤 Personagem'}</div>
                    </td>
                    <td style="padding:8px 10px;">
                      ${item.equipmentSetNamePtBr ? `<span style="font-weight:700; color:#fde047; font-size:0.75rem; background:rgba(234,179,8,0.15); border:1px solid #eab308; padding:2px 6px; border-radius:4px; white-space:nowrap;">👑 ${item.equipmentSetNamePtBr}</span>` : '<span style="color:#64748b; font-size:0.75rem;">—</span>'}
                    </td>
                    <td style="padding:8px 10px;">
                      <span style="font-weight:800; color:${rStyle.text}; background:${rStyle.bg}; border:1px solid ${rStyle.border}; padding:2px 8px; border-radius:99px; font-size:0.72rem; white-space:nowrap;">
                        ${['SS', 'S', 'A', 'B', 'C', 'D', 'F'].includes(item.rarityTier) ? `Rank ${item.rarityTier}` : item.rarityTier}
                      </span>
                    </td>
                    <td style="padding:8px 10px; font-weight:700; color:#cbd5e1;">
                      Nv. ${item.requiredLevel}
                    </td>
                    <td style="padding:8px 10px;">
                      ${this.formatEquipmentCombatBadges(cb)}
                    </td>
                    <td style="padding:8px 10px;">
                      ${item.isActive ? '<span style="color:#86efac; font-weight:700; font-size:0.74rem;">● Ativo</span>' : '<span style="color:#94a3b8; font-size:0.74rem;">○ Inativo</span>'}
                    </td>
                    <td style="padding:8px 10px; text-align:right; white-space:nowrap;">
                      <button class="btn-primary" style="padding:5px 9px; font-size:0.75rem; margin-right:4px;" onclick="AdminApp.openEditEquipmentModal(${item.id})">✏️ Editar</button>
                      <button class="btn-danger" style="padding:5px 8px; font-size:0.72rem;" onclick="AdminApp.deleteEquipmentTemplate(${item.id}, '${item.namePtBr}')">🗑️</button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;

      // 2. VISÃO MOBILE VERTICAL (Cards Adaptativos Touch-Friendly)
      const mobileCardsHtml = `
        <div class="equipments-mobile-view">
          ${filtered.map((item) => {
            const cb = item.combatStatBonusesJson || {};
            const rStyle = rarityColors[item.rarityTier] || rarityColors.COMMON;
            const sIcon = slotIcons[item.equipmentSlotCode] || '🛡️';
            const isPet = item.itemCategory === 'PET_EQUIPMENT';

            return `
              <div class="equipment-mobile-card">
                <!-- Cabeçalho do Card -->
                <div class="equipment-mobile-card-header">
                  <img src="${item.iconUrl}" alt="${item.namePtBr}" class="equipment-mobile-card-thumb" style="border-color:${rStyle.border};" />
                  <div class="equipment-mobile-card-title">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:6px;">
                      <strong style="font-size:0.92rem; color:#f8fafc;">${item.namePtBr}</strong>
                      <span style="font-weight:800; color:${rStyle.text}; background:${rStyle.bg}; border:1px solid ${rStyle.border}; padding:1px 7px; border-radius:99px; font-size:0.70rem; white-space:nowrap;">${['SS', 'S', 'A', 'B', 'C', 'D', 'F'].includes(item.rarityTier) ? `Rank ${item.rarityTier}` : item.rarityTier}</span>
                    </div>
                    <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap; font-size:0.70rem; color:var(--text-muted); margin-top:2px;">
                      <span style="color:#38bdf8; font-family:monospace;">${item.code}</span>
                      <span style="color:${item.isActive ? '#86efac' : '#94a3b8'};">${item.isActive ? '● Ativo' : '○ Inativo'}</span>
                    </div>
                  </div>
                </div>

                <!-- Chips de Slot e Categoria -->
                <div style="display:flex; flex-wrap:wrap; gap:4px; font-size:0.72rem;">
                  <span style="padding:2px 8px; border-radius:99px; background:rgba(56,189,248,0.15); color:#bae6fd; font-weight:700;">${sIcon} ${item.slotNamePtBr}</span>${item.equipmentSlotCode === 'WEAPON_1' && item.specialEffectJson?.weaponModelId ? '<span style="padding:2px 7px; border-radius:99px; background:rgba(34,211,238,0.12); border:1px solid #0891b2; color:#22d3ee; font-weight:700;">⚔️ 2.5D</span>' : ''}
                  <span style="padding:2px 8px; border-radius:99px; background:${isPet ? 'rgba(192,132,252,0.15)' : 'rgba(148,163,184,0.15)'}; color:${isPet ? '#c084fc' : '#cbd5e1'}; font-weight:600;">${isPet ? '🐾 Pet' : '👤 Personagem'}</span>
                  <span style="padding:2px 8px; border-radius:99px; background:rgba(234,179,8,0.15); color:#fde047; font-weight:700;">Nv. ${item.requiredLevel}</span>
                  ${item.equipmentSetNamePtBr ? `<span style="padding:2px 8px; border-radius:99px; background:rgba(234,179,8,0.2); border:1px solid #eab308; color:#fde047; font-weight:700;">👑 ${item.equipmentSetNamePtBr}</span>` : ''}
                </div>

                ${item.descriptionPtBr ? `<div style="font-size:0.73rem; color:var(--text-muted); line-height:1.3; background:#020617; padding:6px 8px; border-radius:6px; border:1px solid #1e293b;">📜 ${item.descriptionPtBr}</div>` : ''}

                <!-- Bônus de Combate -->
                <div>
                  <div style="font-size:0.70rem; color:#38bdf8; font-weight:700; margin-bottom:4px;">⚔️ BÔNUS DE COMBATE:</div>
                  <div class="equipment-mobile-card-stats-box">
                    ${this.formatEquipmentCombatBadges(cb)}
                  </div>
                </div>

                <!-- Ações Touch-Friendly -->
                <div class="equipment-mobile-card-actions">
                  <button type="button" class="btn-primary" onclick="AdminApp.openEditEquipmentModal(${item.id})">
                    ✏️ Editar Equipamento
                  </button>
                  <button type="button" class="btn-danger" style="padding:0 14px;" onclick="AdminApp.deleteEquipmentTemplate(${item.id}, '${item.namePtBr}')">
                    🗑️
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;

      container.innerHTML = desktopTableHtml + mobileCardsHtml;
    };
  }
}

window.AdminEquipmentTableView = AdminEquipmentTableView;
