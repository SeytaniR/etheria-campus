/**
 * @file apps/server/public/play/js/PlayGmSandboxPanel.js
 * @module @etheria/client/gm-sandbox
 * @description Arsenal & Sandbox Completo de Game Master (/gm e /play).
 *   Permite ao GM/ADMIN/DEV pegar ou equipar qualquer item, equipamento, conjunto completo,
 *   asa ou montaria voadora, adicionar ouro/XP/nível/pontos, trocar classe/elemento e gerar pets.
 */

class PlayGmSandboxPanel {
  static catalog = null;
  static categoryFilter = 'ALL';
  static rarityFilter = 'ALL';
  static searchQuery = '';
  static giveQuantity = 1;

  static isGmUser(client) {
    const r = String(client?.session?.role || '').toUpperCase();
    return ['ADMIN', 'GM', 'DEV'].includes(r) || window.location.pathname.startsWith('/gm');
  }

  static init(client) {
    this.client = client || window.PlayApp;
    this.injectDrawerQuickTools();
    this.injectFloatingGmButton();
    this.injectModalDom();
  }

  static injectFloatingGmButton() {
    if (document.getElementById('hudFloatingGmArsenalBtn')) return;
    const worldScreen = document.getElementById('worldScreen');
    if (!worldScreen) return;

    const btn = document.createElement('button');
    btn.id = 'hudFloatingGmArsenalBtn';
    btn.type = 'button';
    btn.title = 'Abrir Arsenal & Sandbox GM Completo';
    btn.style.cssText = [
      'position:fixed', 'top:12px', 'left:50%', 'transform:translateX(-50%)',
      'z-index:34', 'display:none', 'align-items:center', 'gap:6px',
      'padding:6px 14px', 'border-radius:999px', 'font-size:0.76rem', 'font-weight:900',
      'color:#f3e8ff', 'cursor:pointer',
      'background:linear-gradient(135deg, rgba(126,34,206,0.94), rgba(190,24,93,0.94))',
      'border:1.5px solid #e879f9', 'box-shadow:0 4px 16px rgba(168,85,247,0.5)',
    ].join(';');
    btn.innerHTML = '🧰 Arsenal GM (Tudo Liberado)';
    btn.onclick = (e) => {
      e.stopPropagation();
      this.openModal();
    };
    worldScreen.appendChild(btn);
  }

  static refreshVisibility(client) {
    const c = client || this.client || window.PlayApp;
    this.init(c);
    const isGm = this.isGmUser(c);
    const floatBtn = document.getElementById('hudFloatingGmArsenalBtn');
    if (floatBtn) floatBtn.style.display = isGm ? 'inline-flex' : 'none';
    const topBtn = document.getElementById('btnToggleGm');
    if (topBtn) topBtn.style.display = isGm ? 'inline-block' : 'none';
  }

  static injectDrawerQuickTools() {
    const drawer = document.getElementById('gmDrawer');
    if (!drawer || document.getElementById('gmDrawerArsenalBox')) return;

    const box = document.createElement('div');
    box.id = 'gmDrawerArsenalBox';
    box.style.cssText = 'display:flex; flex-direction:column; gap:6px; background:rgba(88,28,135,0.28); border:1.5px solid #c084fc; border-radius:10px; padding:10px;';
    box.innerHTML = `
      <button type="button" class="btn-primary" style="width:100%; padding:9px; font-weight:900; font-size:0.82rem; background:linear-gradient(135deg,#9333ea,#db2777); border:1px solid #f0abfc; border-radius:8px; color:#fff;" onclick="window.PlayGmSandboxPanel.openModal()">
        🧰 ABRIR ARSENAL GM COMPLETO (ITENS / EQUIP / OURO / XP)
      </button>
      <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:4px;">
        <button type="button" style="font-size:0.70rem; padding:4px;" onclick="window.PlayGmSandboxPanel.runAction({action:'ADD_GOLD',amount:100000})">+100k 🪙</button>
        <button type="button" style="font-size:0.70rem; padding:4px;" onclick="window.PlayGmSandboxPanel.runAction({action:'SET_LEVEL',level:70})">Nv. 70</button>
        <button type="button" style="font-size:0.70rem; padding:4px;" onclick="window.PlayGmSandboxPanel.runAction({action:'SET_LEVEL',level:100})">Nv. 100</button>
        <button type="button" style="font-size:0.70rem; padding:4px;" onclick="window.PlayGmSandboxPanel.runAction({action:'GIVE_FLIGHT_KIT',autoEquip:true})">🪽 Asa+Voo</button>
        <button type="button" style="font-size:0.70rem; padding:4px;" onclick="window.PlayGmSandboxPanel.runAction({action:'GIVE_ALL_ESSENCES',quantity:5000})">🧪 Essências</button>
        <button type="button" class="btn-danger" style="font-size:0.70rem; padding:4px;" onclick="window.PlayGmSandboxPanel.runAction({action:'CLEAR_BAG'})">🗑️ Limpar Bag</button>
      </div>
    `;
    drawer.insertBefore(box, drawer.children[1] || null);
  }

  static injectModalDom() {
    if (document.getElementById('gmSandboxModal')) return;
    const modal = document.createElement('div');
    modal.id = 'gmSandboxModal';
    modal.className = 'modal-backdrop';
    modal.style.zIndex = '11000';
    modal.onclick = (e) => {
      if (e.target === modal) modal.style.display = 'none';
    };

    modal.innerHTML = `
      <div class="modal-box" style="width:min(96vw, 880px); max-height:92dvh; background:#090d1a; border:2px solid #c084fc; box-shadow:0 0 35px rgba(168,85,247,0.45); padding:14px; display:flex; flex-direction:column; gap:10px; overflow-y:auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #334155; padding-bottom:8px; flex-wrap:wrap; gap:8px;">
          <div>
            <h3 style="margin:0; color:#e879f9; font-size:1.02rem;">🧰 Arsenal & Sandbox Game Master (Acesso Total)</h3>
            <span id="gmSandboxStatusMsg" style="font-size:0.73rem; color:#86efac; font-weight:700;">Pronto para testes em tempo real.</span>
          </div>
          <button type="button" class="btn-danger" style="padding:4px 12px; font-weight:800;" onclick="document.getElementById('gmSandboxModal').style.display='none'">✕ Fechar</button>
        </div>

        <!-- BLOCO 1: PROGRESSÃO, OURO, NÍVEL, ATRIBUTOS, CLASSE & KITS RÁPIDOS -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(250px, 1fr)); gap:8px;">
          <div style="background:#0f172a; border:1px solid #334155; border-radius:8px; padding:9px; display:flex; flex-direction:column; gap:6px;">
            <strong style="color:#fde047; font-size:0.78rem;">🪙 Ouro, Nível & Experiência</strong>
            <div style="display:flex; gap:4px; flex-wrap:wrap;">
              <button type="button" class="btn-primary" style="flex:1; font-size:0.71rem; padding:4px;" onclick="window.PlayGmSandboxPanel.runAction({action:'ADD_GOLD',amount:50000})">+50k 🪙</button>
              <button type="button" class="btn-primary" style="flex:1; font-size:0.71rem; padding:4px;" onclick="window.PlayGmSandboxPanel.runAction({action:'ADD_GOLD',amount:1000000})">+1M 🪙</button>
              <button type="button" style="font-size:0.71rem; padding:4px;" onclick="window.PlayGmSandboxPanel.runAction({action:'SET_GOLD',amount:0})">Zerar 🪙</button>
            </div>
            <div style="display:flex; gap:4px; flex-wrap:wrap;">
              <button type="button" style="flex:1; font-size:0.71rem; padding:4px;" onclick="window.PlayGmSandboxPanel.runAction({action:'SET_LEVEL',level:1})">Nv.1</button>
              <button type="button" style="flex:1; font-size:0.71rem; padding:4px;" onclick="window.PlayGmSandboxPanel.runAction({action:'SET_LEVEL',level:50})">Nv.50</button>
              <button type="button" style="flex:1; font-size:0.71rem; padding:4px;" onclick="window.PlayGmSandboxPanel.runAction({action:'SET_LEVEL',level:70})">Nv.70</button>
              <button type="button" class="btn-success" style="flex:1; font-size:0.71rem; padding:4px; font-weight:800;" onclick="window.PlayGmSandboxPanel.runAction({action:'SET_LEVEL',level:100})">Nv.100</button>
            </div>
            <div style="display:flex; gap:4px;">
              <input type="number" id="gmCustomLevelInp" value="100" min="1" max="100" style="width:65px; padding:3px 6px; font-size:0.74rem; background:#020617; border:1px solid #334155; color:#fff; border-radius:4px;" />
              <button type="button" style="flex:1; font-size:0.71rem; padding:4px;" onclick="window.PlayGmSandboxPanel.runAction({action:'SET_LEVEL',level:Number(document.getElementById('gmCustomLevelInp').value)||100})">Definir Nível</button>
              <button type="button" style="flex:1; font-size:0.71rem; padding:4px;" onclick="window.PlayGmSandboxPanel.runAction({action:'ADD_XP',amount:250000})">+250k XP</button>
            </div>
          </div>

          <div style="background:#0f172a; border:1px solid #334155; border-radius:8px; padding:9px; display:flex; flex-direction:column; gap:6px;">
            <strong style="color:#38bdf8; font-size:0.78rem;">🎭 Classe, Elemento, Atributos & Kits</strong>
            <div style="display:flex; gap:4px;">
              <select id="gmSandboxClassSelect" style="flex:1; padding:4px; font-size:0.73rem; background:#020617; border:1px solid #334155; color:#fff; border-radius:4px;"></select>
              <select id="gmSandboxElemSelect" style="width:95px; padding:4px; font-size:0.73rem; background:#020617; border:1px solid #334155; color:#fff; border-radius:4px;">
                <option value="FIRE">🔥 Fogo</option>
                <option value="WATER">💧 Água</option>
                <option value="EARTH">🪨 Terra</option>
                <option value="AIR">🌪️ Ar</option>
                <option value="NEUTRAL">⚪ Neutro</option>
              </select>
              <button type="button" class="btn-primary" style="font-size:0.71rem; padding:4px 8px;" onclick="window.PlayGmSandboxPanel.applyClassAndElement()">Aplicar</button>
            </div>
            <div style="display:flex; gap:4px;">
              <button type="button" style="flex:1; font-size:0.71rem; padding:4px;" onclick="window.PlayGmSandboxPanel.runAction({action:'ADD_STAT_POINTS',amount:200})">+200 Pts Atrib.</button>
              <button type="button" style="flex:1; font-size:0.71rem; padding:4px;" onclick="window.PlayGmSandboxPanel.runAction({action:'RESET_STATS'})">🔄 Reset Atrib.</button>
            </div>
            <div style="display:flex; gap:4px;">
              <button type="button" class="btn-success" style="flex:1; font-size:0.71rem; padding:4px; font-weight:800;" onclick="window.PlayGmSandboxPanel.runAction({action:'GIVE_FLIGHT_KIT',autoEquip:true})">🪽 Equipar Asa+Voo</button>
              <button type="button" style="flex:1; font-size:0.71rem; padding:4px;" onclick="window.PlayGmSandboxPanel.runAction({action:'GIVE_ALL_ESSENCES',quantity:5000})">🧪 +5k Essências</button>
              <button type="button" class="btn-danger" style="font-size:0.71rem; padding:4px 7px;" onclick="window.PlayGmSandboxPanel.runAction({action:'CLEAR_BAG'})">🗑️ Limpar Bag</button>
            </div>
          </div>
        </div>

        <!-- BLOCO 2: ENTREGA DE CONJUNTO COMPLETO (81 CONJUNTOS) & GERADOR DE PETS -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:8px;">
          <div style="background:#0f172a; border:1px solid #334155; border-radius:8px; padding:9px; display:flex; flex-direction:column; gap:6px;">
            <strong style="color:#c084fc; font-size:0.78rem;">👑 Conjuntos Completos (Personagem & Pet)</strong>
            <select id="gmSandboxSetSelect" style="width:100%; padding:5px; font-size:0.74rem; background:#020617; border:1px solid #334155; color:#fff; border-radius:4px;"></select>
            <div style="display:flex; gap:6px;">
              <button type="button" class="btn-primary" style="flex:1; font-size:0.73rem; padding:5px; font-weight:800;" onclick="window.PlayGmSandboxPanel.giveSelectedSet('BAG')">🎁 Pegar Peças na Mochila</button>
              <button type="button" class="btn-success" style="flex:1; font-size:0.73rem; padding:5px; font-weight:800;" onclick="window.PlayGmSandboxPanel.giveSelectedSet('EQUIP')">⚔️ Equipar Conjunto Agora</button>
            </div>
          </div>

          <div style="background:#0f172a; border:1px solid #334155; border-radius:8px; padding:9px; display:flex; flex-direction:column; gap:6px;">
            <strong style="color:#4ade80; font-size:0.78rem;">🐾 Invocar Qualquer Pet Direto na Conta</strong>
            <select id="gmSandboxPetMonsterSelect" style="width:100%; padding:5px; font-size:0.74rem; background:#020617; border:1px solid #334155; color:#fff; border-radius:4px;"></select>
            <div style="display:flex; gap:6px;">
              <input type="number" id="gmSandboxPetLevelInp" value="70" min="1" max="100" style="width:65px; padding:4px; font-size:0.74rem; background:#020617; border:1px solid #334155; color:#fff; border-radius:4px;" title="Nível do Pet" />
              <select id="gmSandboxPetElemSelect" style="flex:1; padding:4px; font-size:0.73rem; background:#020617; border:1px solid #334155; color:#fff; border-radius:4px;">
                <option value="FIRE">🔥 Fogo</option>
                <option value="WATER">💧 Água</option>
                <option value="EARTH">🪨 Terra</option>
                <option value="AIR">🌪️ Ar</option>
                <option value="NEUTRAL">⚪ Neutro</option>
              </select>
              <button type="button" class="btn-success" style="font-size:0.73rem; padding:5px 10px; font-weight:800;" onclick="window.PlayGmSandboxPanel.spawnSelectedPet()">🐾 Gerar Pet</button>
            </div>
          </div>
        </div>

        <!-- BLOCO 3: CATÁLOGO UNIVERSAL DE ITENS E EQUIPAMENTOS -->
        <div style="background:#0f172a; border:1px solid #334155; border-radius:8px; padding:10px; display:flex; flex-direction:column; gap:8px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
            <strong style="color:#f8fafc; font-size:0.80rem;">🎒 Catálogo Universal de Equipamentos, Asas, Montarias e Itens</strong>
            <span id="gmSandboxCatalogCount" style="font-size:0.72rem; color:#38bdf8; font-weight:700;"></span>
          </div>

          <div style="display:flex; gap:4px; flex-wrap:wrap;">
            ${[
              { id: 'ALL', label: '🌐 Todos' },
              { id: 'FLIGHT_WINGS', label: '🪽 Asas & 🦅 Montarias' },
              { id: 'CHARACTER_EQUIPMENT', label: '⚔️ Equip. Personagem' },
              { id: 'PET_EQUIPMENT', label: '🐾 Equip. Pet' },
              { id: 'MATERIAL', label: '🧪 Essências & Materiais' },
              { id: 'CONSUMABLE', label: '🍷 Consumíveis & Baús' },
            ].map((c) => `<button type="button" class="gm-cat-filter-btn" data-cat="${c.id}" style="padding:3px 8px; font-size:0.70rem; font-weight:700; border-radius:5px; border:1px solid #334155; background:#1e293b; color:#f8fafc; cursor:pointer;" onclick="window.PlayGmSandboxPanel.setCategoryFilter('${c.id}')">${c.label}</button>`).join('')}
          </div>

          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <input type="text" id="gmSandboxSearchInp" placeholder="🔍 Buscar por nome, código ou slot (ex: asa, nuvem, lv100, chifre, essencia)..." style="flex:1; min-width:180px; padding:5px 8px; font-size:0.75rem; background:#020617; border:1px solid #334155; color:#fff; border-radius:5px;" oninput="window.PlayGmSandboxPanel.onSearch(this.value)" />
            <select id="gmSandboxRaritySelect" style="padding:5px; font-size:0.74rem; background:#020617; border:1px solid #334155; color:#fff; border-radius:5px;" onchange="window.PlayGmSandboxPanel.setRarityFilter(this.value)">
              <option value="ALL">Todas Raridades</option>
              <option value="SS">Rank SS</option>
              <option value="S">Rank S</option>
              <option value="A">Rank A</option>
              <option value="B">Rank B</option>
              <option value="C">Rank C</option>
              <option value="D">Rank D</option>
              <option value="F">Rank F</option>
            </select>
            <select id="gmSandboxQtySelect" style="padding:5px; font-size:0.74rem; background:#020617; border:1px solid #334155; color:#fde047; font-weight:800; border-radius:5px;" onchange="window.PlayGmSandboxPanel.giveQuantity=Number(this.value)||1">
              <option value="1">Qtd: 1x</option>
              <option value="5">Qtd: 5x</option>
              <option value="50">Qtd: 50x</option>
              <option value="500">Qtd: 500x</option>
              <option value="3500">Qtd: 3500x</option>
            </select>
          </div>

          <div id="gmSandboxItemsGrid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(235px, 1fr)); gap:6px; max-height:310px; overflow-y:auto; padding:2px;"></div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  static async openModal() {
    this.init(window.PlayApp);
    const modal = document.getElementById('gmSandboxModal');
    if (modal) modal.style.display = 'flex';
    await this.loadCatalog();
    this.syncCharacterSelectors();
    this.renderItemsGrid();
  }

  static async loadCatalog(force = false) {
    if (this.catalog && !force) return;
    const client = this.client || window.PlayApp;
    if (!client) return;
    try {
      this.catalog = await client.api('/api/play/gm/sandbox/catalog');
      this.populateDropdowns();
    } catch (err) {
      this.setStatus(`Erro ao carregar catálogo GM: ${err.message}`, true);
    }
  }

  static populateDropdowns() {
    if (!this.catalog) return;
    const classSel = document.getElementById('gmSandboxClassSelect');
    if (classSel) {
      classSel.innerHTML = (this.catalog.classes || [])
        .map((c) => `<option value="${c.id}">#${c.id} ${c.namePtBr} (${c.code})</option>`)
        .join('');
    }
    const setSel = document.getElementById('gmSandboxSetSelect');
    if (setSel) {
      setSel.innerHTML = (this.catalog.equipmentSets || [])
        .map((s) => `<option value="${s.id}">[Rank ${s.rarityTier} • Nv.${s.requiredLevel}] ${s.namePtBr} (${s.piecesCount} pçs)</option>`)
        .join('');
    }
    const petSel = document.getElementById('gmSandboxPetMonsterSelect');
    if (petSel) {
      petSel.innerHTML = (this.catalog.monsters || [])
        .map((m) => `<option value="${m.id}">#${m.id} [Rank ${m.rarityTier}] ${m.namePtBr} (${m.raceCode})</option>`)
        .join('');
    }
  }

  static syncCharacterSelectors() {
    const ch = (this.client || window.PlayApp)?.activeChar;
    if (!ch) return;
    const classSel = document.getElementById('gmSandboxClassSelect');
    if (classSel && ch.classTemplateId) classSel.value = String(ch.classTemplateId);
    const elemSel = document.getElementById('gmSandboxElemSelect');
    if (elemSel && ch.elementCode) elemSel.value = String(ch.elementCode).toUpperCase();
    const lvlInp = document.getElementById('gmCustomLevelInp');
    if (lvlInp && ch.level) lvlInp.value = String(ch.level);
  }

  static setCategoryFilter(cat) {
    this.categoryFilter = cat;
    document.querySelectorAll('.gm-cat-filter-btn').forEach((b) => {
      const active = b.getAttribute('data-cat') === cat;
      b.style.background = active ? '#7e22ce' : '#1e293b';
      b.style.borderColor = active ? '#e879f9' : '#334155';
    });
    this.renderItemsGrid();
  }

  static setRarityFilter(rar) {
    this.rarityFilter = rar;
    this.renderItemsGrid();
  }

  static onSearch(val) {
    this.searchQuery = String(val || '').trim().toLowerCase();
    this.renderItemsGrid();
  }

  static renderItemsGrid() {
    const grid = document.getElementById('gmSandboxItemsGrid');
    const countEl = document.getElementById('gmSandboxCatalogCount');
    if (!grid || !this.catalog) return;

    const all = this.catalog.items || [];
    const cat = this.categoryFilter;
    const rar = this.rarityFilter;
    const q = this.searchQuery;

    const filtered = all.filter((it) => {
      if (cat === 'FLIGHT_WINGS') {
        if (it.equipmentSlotCode !== 'WINGS' && it.equipmentSlotCode !== 'FLYING_MOUNT') return false;
      } else if (cat !== 'ALL' && it.itemCategory !== cat) {
        return false;
      }
      if (rar !== 'ALL' && String(it.rarityTier || '').toUpperCase() !== rar) return false;
      if (!q) return true;
      return (
        it.namePtBr.toLowerCase().includes(q) ||
        it.code.toLowerCase().includes(q) ||
        String(it.equipmentSlotCode || '').toLowerCase().includes(q)
      );
    });

    if (countEl) countEl.textContent = `${filtered.length} de ${all.length} itens`;

    const slice = filtered.slice(0, 120);
    if (slice.length === 0) {
      grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:18px; color:#94a3b8; font-size:0.78rem;">Nenhum item encontrado com os filtros atuais.</div>`;
      return;
    }

    grid.innerHTML = slice.map((it) => {
      const canEquipChar = it.itemCategory === 'CHARACTER_EQUIPMENT' && it.equipmentSlotCode;
      const statsStr = Object.entries(it.combatStatBonuses || {})
        .slice(0, 4)
        .map(([k, v]) => `${k}:+${v}`)
        .join(' ');
      return `
        <div style="background:#020617; border:1px solid #334155; border-radius:7px; padding:7px; display:flex; align-items:center; gap:8px;">
          <img src="${it.iconUrl}" style="width:36px; height:36px; object-fit:contain; background:#0f172a; border-radius:6px; border:1px solid #475569; flex-shrink:0;" loading="lazy" />
          <div style="flex:1; min-width:0;">
            <div style="font-size:0.74rem; font-weight:800; color:#f8fafc; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${it.namePtBr}">${it.namePtBr}</div>
            <div style="font-size:0.65rem; color:#38bdf8;">Rank ${it.rarityTier} • Nv.${it.requiredLevel}${it.equipmentSlotCode ? ` • ${it.equipmentSlotCode}` : ''}</div>
            ${statsStr ? `<div style="font-size:0.62rem; color:#86efac; font-family:monospace; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${statsStr}</div>` : ''}
          </div>
          <div style="display:flex; flex-direction:column; gap:3px; flex-shrink:0;">
            <button type="button" class="btn-primary" style="padding:3px 7px; font-size:0.67rem; font-weight:800;" onclick="window.PlayGmSandboxPanel.giveItem(${it.id}, false)">➕ Bag</button>
            ${canEquipChar ? `<button type="button" class="btn-success" style="padding:3px 7px; font-size:0.67rem; font-weight:800;" onclick="window.PlayGmSandboxPanel.giveItem(${it.id}, true)">⚡ Equip</button>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  static setStatus(msg, isErr = false) {
    const el = document.getElementById('gmSandboxStatusMsg');
    if (el) {
      el.textContent = msg;
      el.style.color = isErr ? '#fca5a5' : '#86efac';
    }
    (this.client || window.PlayApp)?.showNotification?.(msg, isErr ? 'error' : 'success');
  }

  static async runAction(payload) {
    const client = this.client || window.PlayApp;
    if (!client?.activeChar) {
      alert('Entre no mundo com um personagem primeiro.');
      return;
    }
    try {
      const res = await client.api('/api/play/gm/sandbox/action', {
        method: 'POST',
        body: JSON.stringify({ characterId: client.activeChar.id, ...payload }),
      });
      this.applyServerState(res);
      this.setStatus(res.message || 'Ação GM aplicada!');
    } catch (err) {
      this.setStatus(err.message || 'Erro ao executar ação GM.', true);
    }
  }

  static applyServerState(res) {
    const client = this.client || window.PlayApp;
    if (!client || !res) return;
    if (res.character) {
      client.activeChar = res.character;
      client.getOrCreateSprite?.(
        `char_${client.activeChar.mcreworkCharKey}`,
        client.activeChar.atlasJsonUrl,
        client.activeChar.atlasWebpUrl,
        client.activeChar.thumbUrl
      )?.load();
      window.PlayFlightAndWingsController?.syncVisualAppearance(client, res.character.visualAppearance);
      if (res.character.visualAppearance?.equippedMount && !client.isFlying && !client.actionCombatArena?.isActive) {
        window.PlayFlightAndWingsController?.updateFlightHudButton(client);
      }
      if (window.PlayPetsController) {
        window.PlayPetsController.syncFromCharacter?.(res.character);
      }
    }
    if (res.equippedDetails) {
      client._equippedDetails = res.equippedDetails;
      if (document.getElementById('statsModal')?.style.display === 'flex') {
        client.renderStatsModalView?.();
      }
    }
    if (res.bag && window.PlayBagController) {
      window.PlayBagController.currentBag = res.bag;
      if (document.getElementById('bagModal')?.style.display === 'flex') {
        window.PlayBagController.renderBagGrid();
      }
    }
    client.updateHudInfo?.();
    this.syncCharacterSelectors();
  }

  static giveItem(itemTemplateId, autoEquip) {
    const qty = autoEquip ? 1 : (Number(this.giveQuantity) || 1);
    void this.runAction({ action: 'GIVE_ITEM', itemTemplateId, quantity: qty, autoEquip });
  }

  static giveSelectedSet(mode) {
    const sel = document.getElementById('gmSandboxSetSelect');
    const setId = Number(sel?.value);
    if (!setId) return;
    void this.runAction({ action: 'GIVE_SET', equipmentSetId: setId, mode });
  }

  static applyClassAndElement() {
    const classTemplateId = Number(document.getElementById('gmSandboxClassSelect')?.value);
    const elementCode = document.getElementById('gmSandboxElemSelect')?.value;
    void this.runAction({ action: 'SET_CLASS_OR_ELEMENT', classTemplateId, elementCode });
  }

  static spawnSelectedPet() {
    const monsterTemplateId = Number(document.getElementById('gmSandboxPetMonsterSelect')?.value);
    const level = Number(document.getElementById('gmSandboxPetLevelInp')?.value) || 70;
    const elementCode = document.getElementById('gmSandboxPetElemSelect')?.value || 'FIRE';
    if (!monsterTemplateId) return;
    void this.runAction({ action: 'SPAWN_PET', monsterTemplateId, level, elementCode });
  }
}

window.PlayGmSandboxPanel = PlayGmSandboxPanel;
