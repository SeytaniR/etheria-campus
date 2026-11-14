/**
 * @file apps/server/public/play/js/PlayBagController.js
 * @module @etheria/client/inventory
 * @description Submódulo Autoritário de Inventário em Grade, Carteira & Equipamentos (/play).
 *   - Grade de 150 slots (50 desbloqueados Nv.1, 50 Nv.2 bloqueados, 50 Nv.3 bloqueados).
 *   - Borda colorida por raridade (F: branco até SS: preto cósmico), stack máx 999 (1 para equipamentos).
 *   - Toque no item para inspeção completa em modal (detalhes, atributos, equipar, usar, dividir, destruir).
 *   - Drag & Drop com mouse e seleção por toque para mover/trocar/juntar slots.
 *   - Barra de busca instantânea, filtros por categoria e raridade, e auto-organização (Auto-Sort).
 *   - Paperdoll de 12 Slots de Equipamento com validação de capacidade da mochila ao desequipar.
 * @rules Segue estritamente AGENTS.md (Limite < 1.000 linhas, Arquitetura Modular).
 */

const PlayBagController = {
  SLOT_DEFINITIONS: [
    { code: 'HEAD', label: 'Elmo', icon: '🧢', col: 'left' },
    { code: 'SHOULDER', label: 'Ombros', icon: '🛡️', col: 'left' },
    { code: 'CHEST', label: 'Peitoral', icon: '🥋', col: 'left' },
    { code: 'BELT', label: 'Cinto', icon: '🎗️', col: 'left' },
    { code: 'LEGS', label: 'Calças', icon: '👖', col: 'left' },
    { code: 'FEET', label: 'Botas', icon: '👢', col: 'left' },
    { code: 'WEAPON_1', label: 'Arma 1', icon: '⚔️', col: 'right' },
    { code: 'WEAPON_2', label: 'Arma 2', icon: '📖', col: 'right' },
    { code: 'NECKLACE', label: 'Colar', icon: '📿', col: 'right' },
    { code: 'RING', label: 'Anel', icon: '💍', col: 'right' },
    { code: 'ORNAMENT_1', label: 'Amuleto', icon: '🔮', col: 'right' },
    { code: 'ORNAMENT_2', label: 'Talismã', icon: '🧿', col: 'right' },
  ],

  RARITY_MAP: {
    F: { border: '#f8fafc', glow: 'rgba(248,250,252,0.3)', label: 'Comum [Rank F]', color: '#f8fafc', bg: '#020617' },
    COMMON: { border: '#f8fafc', glow: 'rgba(248,250,252,0.3)', label: 'Comum [Rank F]', color: '#f8fafc', bg: '#020617' },
    D: { border: '#22c55e', glow: 'rgba(34,197,94,0.35)', label: 'Incomum [Rank D]', color: '#22c55e', bg: '#020617' },
    UNCOMMON: { border: '#22c55e', glow: 'rgba(34,197,94,0.35)', label: 'Incomum [Rank D]', color: '#22c55e', bg: '#020617' },
    C: { border: '#3b82f6', glow: 'rgba(59,130,246,0.4)', label: 'Raro [Rank C]', color: '#3b82f6', bg: '#020617' },
    RARE: { border: '#3b82f6', glow: 'rgba(59,130,246,0.4)', label: 'Raro [Rank C]', color: '#3b82f6', bg: '#020617' },
    B: { border: '#a855f7', glow: 'rgba(168,85,247,0.45)', label: 'Épico [Rank B]', color: '#a855f7', bg: '#020617' },
    EPIC: { border: '#a855f7', glow: 'rgba(168,85,247,0.45)', label: 'Épico [Rank B]', color: '#a855f7', bg: '#020617' },
    A: { border: '#f97316', glow: 'rgba(249,115,22,0.5)', label: 'Lendário [Rank A]', color: '#f97316', bg: '#020617' },
    LEGENDARY: { border: '#f97316', glow: 'rgba(249,115,22,0.5)', label: 'Lendário [Rank A]', color: '#f97316', bg: '#020617' },
    S: { border: '#ef4444', glow: 'rgba(239,68,68,0.55)', label: 'Mítico [Rank S]', color: '#ef4444', bg: '#020617' },
    MYTHIC: { border: '#ef4444', glow: 'rgba(239,68,68,0.55)', label: 'Mítico [Rank S]', color: '#ef4444', bg: '#020617' },
    SS: { border: '#000000', glow: 'rgba(0,0,0,0.95)', label: 'Cósmico [Rank SS]', color: '#ffffff', isCosmic: true, bg: '#09090b' },
    COSMIC: { border: '#000000', glow: 'rgba(0,0,0,0.95)', label: 'Cósmico [Rank SS]', color: '#ffffff', isCosmic: true, bg: '#09090b' },
  },

  currentBag: null,
  activeCategory: 'ALL',
  activeRarity: 'ALL',
  searchQuery: '',
  draggedSlot: null,
  pendingMoveFrom: null,

  attach(client) {
    this.client = client;
    this.injectBagModalDom();
    this.injectCharacterModalDom();
    this.injectItemDetailModalDom();

    // 1. Abertura do Modal de Mochila em Grade
    client.openBagModal = async function () {
      if (!this.activeChar) return;
      document.getElementById('bagModal').style.display = 'flex';
      await PlayBagController.loadBag();
    };

    // 2. Ações de Equipar e Desequipar
    client.equipInventoryItem = async function (itemTemplateId, slotCode) {
      if (!this.activeChar) return;
      try {
        await this.api(`/api/play/characters/${this.activeChar.id}/equipment/equip`, {
          method: 'POST',
          body: JSON.stringify({ itemTemplateId: Number(itemTemplateId), slotCode: slotCode || undefined }),
        });
        this.showNotification?.('⚔️ Equipamento vestido com sucesso!', 'success');
        PlayBagController.closeItemDetailModal();
        await PlayBagController.loadBag();
        if (document.getElementById('characterModal')?.style.display === 'flex') {
          await this.openCharacterModal();
        }
      } catch (err) {
        alert(`Erro ao equipar: ${err.message}`);
      }
    };

    client.unequipCharacterSlot = async function (slotCode) {
      if (!this.activeChar) return;
      try {
        await this.api(`/api/play/characters/${this.activeChar.id}/equipment/unequip`, {
          method: 'POST',
          body: JSON.stringify({ slotCode }),
        });
        this.showNotification?.(`Desequipou item do slot ${slotCode}.`, 'info');
        await this.openCharacterModal();
        if (document.getElementById('bagModal')?.style.display === 'flex') {
          await PlayBagController.loadBag();
        }
      } catch (err) {
        alert(`Erro ao desequipar: ${err.message}`);
      }
    };

    // 3. Modal de Personagem & Atributos
    client.openCharacterModal = async function () {
      if (!this.activeChar) return;
      const bodyEl = document.getElementById('characterModalBody');
      if (!bodyEl) return;
      document.getElementById('characterModal').style.display = 'flex';
      bodyEl.innerHTML = `<div style="padding:16px; text-align:center; color:#94a3b8;">⏳ Carregando atributos...</div>`;

      try {
        const [charFull, equipRes] = await Promise.all([
          this.api(`/api/play/characters/${this.activeChar.id}`),
          this.api(`/api/play/characters/${this.activeChar.id}/equipment`),
        ]);
        if (charFull) {
          this.activeChar = charFull;
          this.updateHudInfo?.();
        }
        PlayBagController.renderCharacterSheet(charFull, equipRes);
      } catch (err) {
        bodyEl.innerHTML = `<div style="color:#fca5a5; padding:12px;">Erro ao carregar personagem: ${err.message}</div>`;
      }
    };

    client.distributeStatPoint = async function (attr) {
      if (!this.activeChar) return;
      try {
        const res = await this.api(`/api/play/characters/${this.activeChar.id}/distribute-stats`, {
          method: 'POST',
          body: JSON.stringify({ attribute: attr, points: 1 }),
        });
        if (res && res.success) {
          this.activeChar.unspentStatPoints = res.unspentStatPoints;
          this.activeChar.distributedStatsJson = res.distributedStatsJson;
          await this.openCharacterModal();
          this.showNotification?.(`+1 ponto atribuído em ${attr}!`, 'success');
        }
      } catch (err) {
        alert(`Erro ao distribuir ponto: ${err.message}`);
      }
    };

    client.openStatsModal = client.openCharacterModal;
  },

  async loadBag() {
    const bodyEl = document.getElementById('bagModalBody');
    if (!bodyEl || !this.client?.activeChar) return;

    try {
      const res = await this.client.api(`/api/play/characters/${this.client.activeChar.id}/inventory`);
      this.currentBag = res;
      this.client.activeChar.gold = Number(res?.gold ?? this.client.activeChar.gold ?? 0);
      this.client.updateHudInfo?.();
      this.renderBagGrid();
    } catch (err) {
      bodyEl.innerHTML = `<div style="color:#fca5a5; padding:12px;">Erro ao carregar mochila: ${err.message}</div>`;
    }
  },

  renderBagGrid() {
    const bodyEl = document.getElementById('bagModalBody');
    if (!bodyEl || !this.currentBag) return;

    const bag = this.currentBag;
    const slots = bag.slots || [];
    const occupied = bag.occupiedSlotsCount || 0;
    const unlocked = bag.unlockedSlotsCount || 100;

    const filterCategory = this.activeCategory;
    const filterRarity = this.activeRarity;
    const query = this.searchQuery.trim().toLowerCase();

    // Toolbar superior com Ouro, Capacidade e Botão Organizar
    let html = `
      <div style="display:flex; justify-content:space-between; align-items:center; background:#020617; border:1px solid #334155; border-radius:8px; padding:7px 10px; gap:8px;">
        <div style="display:flex; align-items:center; gap:10px;">
          <span style="color:#fde047; font-size:0.86rem; font-weight:800; font-family:monospace;">🪙 ${Number(bag.gold || 0).toLocaleString('pt-BR')}</span>
          <span style="color:#94a3b8; font-size:0.75rem; font-weight:700;">🎒 ${occupied} / ${unlocked} Slots</span>
        </div>
        <button type="button" class="btn-primary" style="padding:3px 9px; font-size:0.73rem; font-weight:700; border-radius:6px; background:#1e293b; border:1px solid #475569;" onclick="window.PlayBagController.triggerAutoSort()">
          🔄 Organizar
        </button>
      </div>

      <!-- Barra de Filtros e Busca -->
      <div style="display:flex; flex-direction:column; gap:6px;">
        <div style="display:flex; gap:6px;">
          <input type="text" id="bagSearchInput" value="${this.escapeHtml(this.searchQuery)}" placeholder="🔍 Buscar por nome do item..." style="flex:1; background:#0f172a; border:1px solid #334155; border-radius:6px; padding:4px 8px; font-size:0.74rem; color:#f8fafc;" oninput="window.PlayBagController.onSearchChange(this.value)" />
          <select id="bagRarityFilter" style="background:#0f172a; border:1px solid #334155; border-radius:6px; padding:4px 6px; font-size:0.72rem; color:#f8fafc;" onchange="window.PlayBagController.onRarityChange(this.value)">
            <option value="ALL" ${filterRarity === 'ALL' ? 'selected' : ''}>Todas Raridades</option>
            <option value="F" ${filterRarity === 'F' ? 'selected' : ''}>Comum (F)</option>
            <option value="D" ${filterRarity === 'D' ? 'selected' : ''}>Incomum (D)</option>
            <option value="C" ${filterRarity === 'C' ? 'selected' : ''}>Raro (C)</option>
            <option value="B" ${filterRarity === 'B' ? 'selected' : ''}>Épico (B)</option>
            <option value="A" ${filterRarity === 'A' ? 'selected' : ''}>Lendário (A)</option>
            <option value="S" ${filterRarity === 'S' ? 'selected' : ''}>Mítico (S)</option>
            <option value="SS" ${filterRarity === 'SS' ? 'selected' : ''}>Cósmico (SS)</option>
          </select>
        </div>
        <div style="display:flex; gap:4px; overflow-x:auto; padding-bottom:2px;" class="bag-category-pills">
          ${[
            { id: 'ALL', label: 'Todos' },
            { id: 'EQUIPMENT', label: 'Equipamentos' },
            { id: 'CONSUMABLE', label: 'Consumíveis' },
            { id: 'MATERIAL', label: 'Materiais' },
            { id: 'SPECIAL', label: 'Especiais' },
          ].map((cat) => `
            <button type="button" class="bag-cat-btn ${filterCategory === cat.id ? 'active' : ''}" style="padding:2px 8px; font-size:0.68rem; font-weight:700; border-radius:4px; border:1px solid ${filterCategory === cat.id ? '#38bdf8' : '#334155'}; background:${filterCategory === cat.id ? '#0284c7' : '#1e293b'}; color:#f8fafc; cursor:pointer;" onclick="window.PlayBagController.onCategoryChange('${cat.id}')">
              ${cat.label}
            </button>
          `).join('')}
        </div>
      </div>

      ${this.pendingMoveFrom !== null ? `
        <div style="background:linear-gradient(90deg,rgba(234,179,8,0.2),rgba(202,138,4,0.1)); border:1px solid #eab308; border-radius:6px; padding:4px 8px; font-size:0.72rem; color:#fde047; display:flex; justify-content:space-between; align-items:center;">
          <span>🎯 Slot #${this.pendingMoveFrom + 1} selecionado. Toque no slot de destino para mover/trocar:</span>
          <button type="button" class="btn-danger" style="padding:1px 6px; font-size:0.68rem;" onclick="window.PlayBagController.cancelPendingMove()">Cancelar</button>
        </div>
      ` : ''}

      <!-- Container da Grade com Scroll Vertical -->
      <div id="bagGridScrollArea" style="max-height:360px; overflow-y:auto; padding-right:3px; display:flex; flex-direction:column; gap:8px;">
        <!-- Seção 1: Mochila Nível 1 (Slots 0 a 99 - 100 Slots Desbloqueados) -->
        <div class="bag-slots-grid" style="display:grid; grid-template-columns:repeat(5, 1fr); gap:6px;">
          ${slots.slice(0, 100).map((s) => this.renderSlotHtml(s, query, filterCategory, filterRarity)).join('')}
        </div>

        <!-- Seção 2: Mochila Nível 2 (Slots 100 a 199 - Bloqueado) -->
        <div style="margin-top:6px; border-top:1px dashed #334155; padding-top:6px;">
          <div style="display:flex; align-items:center; gap:6px; margin-bottom:5px; color:#64748b; font-size:0.72rem; font-weight:700;">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="#000000"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
            <span>Mochila Nível 2 — Bloqueado (Libera na mochila nível 2)</span>
          </div>
          <div class="bag-slots-grid" style="display:grid; grid-template-columns:repeat(5, 1fr); gap:6px;">
            ${slots.slice(100, 200).map((s) => this.renderSlotHtml(s)).join('')}
          </div>
        </div>

        <!-- Seção 3: Mochila Nível 3 (Slots 200 a 299 - Bloqueado) -->
        <div style="margin-top:6px; border-top:1px dashed #334155; padding-top:6px;">
          <div style="display:flex; align-items:center; gap:6px; margin-bottom:5px; color:#64748b; font-size:0.72rem; font-weight:700;">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="#000000"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
            <span>Mochila Nível 3 — Bloqueado (Libera na mochila nível 3)</span>
          </div>
          <div class="bag-slots-grid" style="display:grid; grid-template-columns:repeat(5, 1fr); gap:6px;">
            ${slots.slice(200, 300).map((s) => this.renderSlotHtml(s)).join('')}
          </div>
        </div>
      </div>
    `;

    bodyEl.innerHTML = html;
    this.setupDragAndDropEvents();
  },

  renderSlotHtml(slot, query = '', filterCategory = 'ALL', filterRarity = 'ALL') {
    const idx = slot.slotIndex;
    const isLocked = slot.isLocked;

    if (isLocked) {
      return `
        <div class="bag-slot bag-slot-locked" style="width:100%; aspect-ratio:1/1; background:rgba(2,6,23,0.7); border:1px solid #1e293b; border-radius:7px; display:flex; align-items:center; justify-content:center; opacity:0.45; cursor:not-allowed;" title="${slot.lockedMessage || 'Bloqueado'}">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="#000000"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
        </div>
      `;
    }

    const it = slot.item;
    const isSelected = this.pendingMoveFrom === idx;

    if (!it) {
      return `
        <div class="bag-slot bag-slot-empty ${isSelected ? 'is-selected' : ''}" data-slot-index="${idx}" style="width:100%; aspect-ratio:1/1; background:rgba(15,23,42,0.6); border:1px dashed rgba(255,255,255,0.1); border-radius:7px; display:flex; align-items:center; justify-content:center; cursor:pointer;" onclick="window.PlayBagController.onSlotClick(${idx})" title="Slot #${idx + 1} (Vazio)">
        </div>
      `;
    }

    // Filtragem visual
    let matches = true;
    if (query && !it.namePtBr.toLowerCase().includes(query)) matches = false;
    if (filterCategory !== 'ALL') {
      const cat = String(it.itemCategory || '').toUpperCase();
      if (filterCategory === 'EQUIPMENT' && !it.isNonStackable) matches = false;
      else if (filterCategory === 'CONSUMABLE' && cat !== 'CONSUMABLE') matches = false;
      else if (filterCategory === 'MATERIAL' && cat !== 'MATERIAL') matches = false;
      else if (filterCategory === 'SPECIAL' && it.effectType !== 'OPEN_CHEST' && it.effectType !== 'ROULETTE') matches = false;
    }
    if (filterRarity !== 'ALL') {
      const rKey = String(it.rarityTier || '').toUpperCase();
      if (filterRarity === 'F' && !['F', 'COMMON'].includes(rKey)) matches = false;
      else if (filterRarity === 'D' && !['D', 'UNCOMMON'].includes(rKey)) matches = false;
      else if (filterRarity === 'C' && !['C', 'RARE'].includes(rKey)) matches = false;
      else if (filterRarity === 'B' && !['B', 'EPIC'].includes(rKey)) matches = false;
      else if (filterRarity === 'A' && !['A', 'LEGENDARY'].includes(rKey)) matches = false;
      else if (filterRarity === 'S' && !['S', 'MYTHIC'].includes(rKey)) matches = false;
      else if (filterRarity === 'SS' && !['SS', 'COSMIC'].includes(rKey)) matches = false;
    }

    const rar = this.RARITY_MAP[String(it.rarityTier || '').toUpperCase()] || this.RARITY_MAP.F;
    const borderStyle = rar.isCosmic
      ? 'border:2px solid #000000; box-shadow:0 0 10px rgba(0,0,0,0.95), inset 0 0 6px rgba(255,255,255,0.2); background:radial-gradient(circle,#18181b 0%,#09090b 100%);'
      : `border:2px solid ${rar.border}; box-shadow:0 0 5px ${rar.glow}; background:${rar.bg};`;

    const opacity = matches ? '1' : '0.18';
    const highlightOutline = isSelected ? 'outline:2.5px solid #fde047; outline-offset:1px;' : '';

    return `
      <div class="bag-slot bag-slot-filled ${isSelected ? 'is-selected' : ''}" data-slot-index="${idx}" draggable="true" style="width:100%; aspect-ratio:1/1; border-radius:7px; position:relative; display:flex; align-items:center; justify-content:center; cursor:pointer; opacity:${opacity}; ${borderStyle} ${highlightOutline}" onclick="window.PlayBagController.onSlotClick(${idx})" title="${it.namePtBr} (x${it.quantity})">
        <img src="${it.iconUrl}" style="width:84%; height:84%; object-fit:contain; pointer-events:none;" onerror="this.style.display='none'" />
        ${it.quantity > 1 ? `
          <span style="position:absolute; bottom:2px; right:2px; font-size:0.62rem; font-weight:900; font-family:monospace; color:#f8fafc; background:rgba(0,0,0,0.75); padding:0px 3.5px; border-radius:3px; text-shadow:0 1px 2px #000; pointer-events:none;">
            ${it.quantity}
          </span>
        ` : ''}
      </div>
    `;
  },

  setupDragAndDropEvents() {
    const slots = document.querySelectorAll('.bag-slot-filled[draggable="true"]');
    slots.forEach((el) => {
      el.addEventListener('dragstart', (e) => {
        const slotIdx = Number(el.getAttribute('data-slot-index'));
        this.draggedSlot = slotIdx;
        e.dataTransfer.setData('text/plain', String(slotIdx));
        e.dataTransfer.effectAllowed = 'move';

        const img = el.querySelector('img');
        if (img) {
          // Cria o avatar visual para acompanhar o arrasto
          let ghost = document.getElementById('bagDragGhostElement');
          if (!ghost) {
            ghost = document.createElement('div');
            ghost.id = 'bagDragGhostElement';
            document.body.appendChild(ghost);
          }
          ghost.style.cssText = `
            position: fixed;
            top: -9999px;
            left: -9999px;
            width: 48px;
            height: 48px;
            border-radius: 8px;
            background: #0f172a;
            border: 2px solid #38bdf8;
            box-shadow: 0 4px 15px rgba(0,0,0,0.7), 0 0 10px rgba(56,189,248,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            pointer-events: none;
            z-index: 999999;
          `;
          ghost.innerHTML = `<img src="${img.src}" style="width:82%; height:82%; object-fit:contain;" />`;
          e.dataTransfer.setDragImage(ghost, 24, 24);

          // Ativa o seguidor flutuante visual em tempo real
          this.showFloatingFollower(img.src, e.clientX, e.clientY);
        }

        el.style.opacity = '0.35';
      });

      el.addEventListener('dragend', () => {
        el.style.opacity = '1';
        this.hideFloatingFollower();
        document.querySelectorAll('.bag-slots-grid .bag-slot').forEach((z) => {
          z.style.outline = '';
          z.style.boxShadow = '';
        });
        const ghost = document.getElementById('bagDragGhostElement');
        if (ghost) ghost.remove();
      });
    });

    // Registra listener global para atualizar a posição do ícone flutuante
    if (!this.hasDragMoveListener) {
      this.hasDragMoveListener = true;
      document.addEventListener('dragover', (e) => {
        if (this.draggedSlot !== null) {
          this.updateFloatingFollower(e.clientX, e.clientY);
        }
      });
      document.addEventListener('drop', () => {
        this.hideFloatingFollower();
      });
    }

    const dropZones = document.querySelectorAll('.bag-slots-grid .bag-slot');
    dropZones.forEach((zone) => {
      zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        zone.style.outline = '2px solid #38bdf8';
        zone.style.boxShadow = '0 0 10px rgba(56,189,248,0.6)';
      });
      zone.addEventListener('dragleave', () => {
        zone.style.outline = '';
        zone.style.boxShadow = '';
      });
      zone.addEventListener('drop', async (e) => {
        e.preventDefault();
        zone.style.outline = '';
        zone.style.boxShadow = '';
        this.hideFloatingFollower();
        const from = this.draggedSlot;
        const to = Number(zone.getAttribute('data-slot-index'));
        this.draggedSlot = null;
        if (from !== null && !isNaN(to) && from !== to) {
          await this.executeMove(from, to);
        }
      });
    });
  },

  showFloatingFollower(iconSrc, x, y) {
    let follower = document.getElementById('bagFloatingFollower');
    if (!follower) {
      follower = document.createElement('div');
      follower.id = 'bagFloatingFollower';
      follower.style.cssText = `
        position: fixed;
        width: 48px;
        height: 48px;
        border-radius: 8px;
        background: rgba(15, 23, 42, 0.95);
        border: 2px solid #38bdf8;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.75), 0 0 14px rgba(56, 189, 248, 0.7);
        display: none;
        align-items: center;
        justify-content: center;
        pointer-events: none;
        z-index: 100000;
        transform: translate(-50%, -50%);
      `;
      document.body.appendChild(follower);
    }
    follower.innerHTML = `<img src="${iconSrc}" style="width:82%; height:82%; object-fit:contain; pointer-events:none;" />`;
    follower.style.display = 'flex';
    follower.style.left = `${x}px`;
    follower.style.top = `${y}px`;
  },

  updateFloatingFollower(x, y) {
    const follower = document.getElementById('bagFloatingFollower');
    if (follower && follower.style.display !== 'none' && x > 0 && y > 0) {
      follower.style.left = `${x}px`;
      follower.style.top = `${y}px`;
    }
  },

  hideFloatingFollower() {
    const follower = document.getElementById('bagFloatingFollower');
    if (follower) follower.style.display = 'none';
  },

  async onSlotClick(slotIndex) {
    if (this.pendingMoveFrom !== null) {
      // Se já havia um slot selecionado para mover, executa o movimento para o slot clicado
      const from = this.pendingMoveFrom;
      this.pendingMoveFrom = null;
      if (from !== slotIndex) {
        await this.executeMove(from, slotIndex);
      } else {
        this.renderBagGrid();
      }
      return;
    }

    const slot = this.currentBag?.slots?.[slotIndex];
    if (!slot || !slot.item) return;

    // Abre janela de inspeção detalhada do item
    this.openItemDetailModal(slot.item, slotIndex);
  },

  openItemDetailModal(it, slotIndex) {
    const modal = document.getElementById('bagItemDetailModal');
    const content = document.getElementById('bagItemDetailContent');
    if (!modal || !content) return;

    const rar = this.RARITY_MAP[String(it.rarityTier || '').toUpperCase()] || this.RARITY_MAP.F;
    const borderStyle = rar.isCosmic
      ? 'border:2px solid #000000; box-shadow:0 0 12px rgba(0,0,0,0.95); background:#09090b;'
      : `border:2px solid ${rar.border}; box-shadow:0 0 8px ${rar.glow}; background:${rar.bg};`;

    const stats = it.combatStatBonuses || {};
    const statsList = Object.entries(stats)
      .map(([k, v]) => `<span style="background:rgba(15,23,42,0.7); border:1px solid #334155; padding:2px 6px; border-radius:4px; font-size:0.7rem; color:#86efac; font-weight:700;">${k}: +${v}</span>`)
      .join(' ');

    const isChest = it.effectType === 'OPEN_CHEST';
    const isRoulette = it.effectType === 'ROULETTE';
    let actionBtnHtml = '';

    if (it.isNonStackable && it.equipmentSlotCode) {
      actionBtnHtml += `<button type="button" class="btn-primary" style="flex:1; padding:7px 10px; font-weight:800; font-size:0.78rem; border-radius:6px; background:#0284c7;" onclick="window.PlayApp.equipInventoryItem(${it.itemTemplateId}, '${it.equipmentSlotCode}')">⚔️ Equipar</button>`;
    } else if (isChest) {
      const chestLabel = it.specialEffectJson?.containerType === 'CAPSULE' ? '💊 Abrir Cápsula' : '🎁 Abrir Baú';
      actionBtnHtml += `<button type="button" class="btn-success" style="flex:1; padding:7px 10px; font-weight:800; font-size:0.78rem; border-radius:6px; background:#16a34a;" onclick="window.PlayBagController.closeItemDetailModal(); window.PlayApp.openItemContainer(${it.itemTemplateId})">${chestLabel}</button>`;
    } else if (isRoulette) {
      actionBtnHtml += `<button type="button" class="btn-primary" style="flex:1; padding:7px 10px; font-weight:800; font-size:0.78rem; border-radius:6px; background:linear-gradient(135deg,#d97706,#b45309); border:1px solid #f59e0b;" onclick="window.PlayBagController.closeItemDetailModal(); window.PlayApp.openItemContainer(${it.itemTemplateId})">🎰 Girar Roleta</button>`;
    }

    if (!it.isNonStackable && it.quantity > 1) {
      actionBtnHtml += `<button type="button" class="btn-secondary" style="padding:7px 10px; font-size:0.76rem; border-radius:6px; background:#334155;" onclick="window.PlayBagController.openSplitStackModal(${slotIndex}, ${it.quantity})">✂️ Dividir</button>`;
    }

    actionBtnHtml += `
      <button type="button" class="btn-secondary" style="padding:7px 10px; font-size:0.76rem; border-radius:6px; background:#1e293b; border:1px solid #475569;" onclick="window.PlayBagController.startMoveFrom(${slotIndex})">🎯 Mover</button>
      <button type="button" class="btn-danger" style="padding:7px 10px; font-size:0.76rem; border-radius:6px;" onclick="window.PlayBagController.promptDeleteItem(${slotIndex}, '${this.escapeHtml(it.namePtBr)}', ${it.quantity})">🗑️ Destruir</button>
    `;

    content.innerHTML = `
      <div style="display:flex; gap:12px; align-items:center;">
        <div style="width:64px; height:64px; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0; ${borderStyle}">
          <img src="${it.iconUrl}" style="width:85%; height:85%; object-fit:contain;" />
        </div>
        <div style="flex:1;">
          <h4 style="margin:0; font-size:0.95rem; font-weight:900; color:${rar.color};">${it.namePtBr}</h4>
          <div style="display:flex; align-items:center; gap:6px; margin-top:3px; flex-wrap:wrap;">
            <span style="font-size:0.68rem; font-weight:800; color:${rar.color}; background:rgba(0,0,0,0.5); padding:1px 6px; border-radius:4px; border:1px solid ${rar.border};">${rar.label}</span>
            <span style="font-size:0.68rem; color:#94a3b8; font-weight:700;">${it.itemCategory}</span>
            ${it.equipmentSlotCode ? `<span style="font-size:0.68rem; color:#38bdf8; font-weight:700;">Slot: ${it.equipmentSlotCode}</span>` : ''}
          </div>
          <div style="margin-top:3px; font-size:0.74rem; color:#cbd5e1; font-family:monospace;">
            Quantidade: <strong style="color:#fde047;">${it.quantity}</strong> (Máx Stack: ${it.maxStack})
          </div>
        </div>
      </div>

      ${it.descriptionPtBr ? `
        <div style="background:#0f172a; border:1px solid #1e293b; border-radius:6px; padding:7px 9px; font-size:0.73rem; color:#cbd5e1; line-height:1.35;">
          ${it.descriptionPtBr}
        </div>
      ` : ''}

      ${statsList ? `
        <div>
          <div style="font-size:0.7rem; color:#94a3b8; font-weight:700; margin-bottom:3px;">Atributos de Combate:</div>
          <div style="display:flex; flex-wrap:wrap; gap:4px;">${statsList}</div>
        </div>
      ` : ''}

      <div style="display:flex; gap:6px; margin-top:6px; flex-wrap:wrap;">
        ${actionBtnHtml}
      </div>
    `;

    modal.style.display = 'flex';
  },

  closeItemDetailModal() {
    const modal = document.getElementById('bagItemDetailModal');
    if (modal) modal.style.display = 'none';
  },

  startMoveFrom(slotIndex) {
    this.closeItemDetailModal();
    this.pendingMoveFrom = slotIndex;
    this.renderBagGrid();
    this.client?.showNotification?.(`Toque no slot de destino para mover ou trocar.`, 'info');
  },

  cancelPendingMove() {
    this.pendingMoveFrom = null;
    this.renderBagGrid();
  },

  async executeMove(fromSlot, toSlot) {
    try {
      const res = await this.client.api(`/api/play/characters/${this.client.activeChar.id}/inventory/move`, {
        method: 'POST',
        body: JSON.stringify({ fromSlot, toSlot }),
      });
      this.currentBag = res;
      this.pendingMoveFrom = null;
      this.renderBagGrid();
    } catch (err) {
      alert(`Erro ao mover item: ${err.message}`);
    }
  },

  openSplitStackModal(slotIndex, maxQty) {
    this.closeItemDetailModal();
    const splitQty = prompt(`Dividir Stack (Quantidade total: ${maxQty}):\nDigite a quantidade a separar (1 a ${maxQty - 1}):`, '1');
    if (!splitQty) return;
    const num = parseInt(splitQty, 10);
    if (isNaN(num) || num < 1 || num >= maxQty) {
      alert('Quantidade inválida para divisão.');
      return;
    }
    this.executeSplit(slotIndex, num);
  },

  async executeSplit(fromSlot, splitQuantity) {
    try {
      const res = await this.client.api(`/api/play/characters/${this.client.activeChar.id}/inventory/split`, {
        method: 'POST',
        body: JSON.stringify({ fromSlot, splitQuantity }),
      });
      this.currentBag = res;
      this.renderBagGrid();
      this.client?.showNotification?.('✂️ Pilha dividida com sucesso!', 'success');
    } catch (err) {
      alert(`Erro ao dividir pilha: ${err.message}`);
    }
  },

  promptDeleteItem(slotIndex, itemName, qty) {
    this.closeItemDetailModal();
    const confirmDestroy = confirm(`⚠️ Confirmação de Exclusão:\n\nDeseja realmente destruir x${qty} "${itemName}"?\n\nEsta ação é irreversível e o item será perdido permanentemente.`);
    if (!confirmDestroy) return;
    this.executeDelete(slotIndex);
  },

  async executeDelete(slotIndex) {
    try {
      const res = await this.client.api(`/api/play/characters/${this.client.activeChar.id}/inventory/slots/${slotIndex}`, {
        method: 'DELETE',
      });
      this.currentBag = res;
      this.renderBagGrid();
      this.client?.showNotification?.('🗑️ Item destruído.', 'info');
    } catch (err) {
      alert(`Erro ao destruir item: ${err.message}`);
    }
  },

  async triggerAutoSort() {
    try {
      const res = await this.client.api(`/api/play/characters/${this.client.activeChar.id}/inventory/sort`, {
        method: 'POST',
      });
      this.currentBag = res;
      this.renderBagGrid();
      this.client?.showNotification?.('🔄 Mochila organizada com sucesso!', 'success');
    } catch (err) {
      alert(`Erro ao organizar mochila: ${err.message}`);
    }
  },

  onCategoryChange(catId) {
    this.activeCategory = catId;
    this.renderBagGrid();
  },

  onRarityChange(rarityKey) {
    this.activeRarity = rarityKey;
    this.renderBagGrid();
  },

  onSearchChange(text) {
    this.searchQuery = text;
    this.renderBagGrid();
  },

  renderCharacterSheet(c, equipRes) {
    const bodyEl = document.getElementById('characterModalBody');
    if (!bodyEl) return;

    const base = c.baseAttributesJson || { VIT: 10, STR: 10, INT: 10, WIS: 10, AGI: 10, DEX: 10 };
    const grow = c.growthPerLevelJson || { VIT: 2, STR: 2, INT: 2, WIS: 2, AGI: 2, DEX: 2 };
    const dist = c.distributedStatsJson || { VIT: 0, STR: 0, INT: 0, WIS: 0, AGI: 0, DEX: 0 };
    const lvUps = Math.max(0, (c.level || 1) - 1);

    const totalBase = {};
    for (const k of ['VIT', 'STR', 'INT', 'WIS', 'AGI', 'DEX']) {
      totalBase[k] = (base[k] || 10) + (grow[k] || 2) * lvUps + (dist[k] || 0);
    }

    const equippedSlots = equipRes?.slots || [];
    const equipMap = {};
    for (const s of equippedSlots) {
      equipMap[s.slotCode] = s.item;
    }

    const leftDefs = this.SLOT_DEFINITIONS.filter((s) => s.col === 'left');
    const rightDefs = this.SLOT_DEFINITIONS.filter((s) => s.col === 'right');

    const renderEquipBox = (s) => {
      const it = equipMap[s.code];
      const hasItem = Boolean(it);
      const iconUrl = it?.iconUrl || '';
      const rar = it ? (this.RARITY_MAP[String(it.rarityTier || '').toUpperCase()] || this.RARITY_MAP.F) : null;
      const borderStyle = rar ? (rar.isCosmic ? 'border:1.5px solid #000; box-shadow:0 0 8px #000;' : `border:1.5px solid ${rar.border}; box-shadow:0 0 5px ${rar.glow};`) : 'border:1px dashed #334155;';

      return `
        <div class="equip-slot-box" data-slot="${s.code}" data-item="${it ? encodeURIComponent(JSON.stringify(it)) : ''}" onclick="window.PlayBagController.onPaperdollClick('${s.code}')" style="width:42px; height:42px; border-radius:6px; background:#020617; display:flex; align-items:center; justify-content:center; position:relative; cursor:pointer; ${borderStyle}" title="${s.label} (${s.code}): ${hasItem ? it.namePtBr : 'Vazio'}">
          ${hasItem ? `<img src="${iconUrl}" style="width:82%; height:82%; object-fit:contain;" />` : `<span style="font-size:1.05rem; opacity:0.4;">${s.icon}</span>`}
          <span style="position:absolute; bottom:0px; left:2px; font-size:0.5rem; color:#64748b; font-weight:800;">${s.code.slice(0, 3)}</span>
        </div>
      `;
    };

    bodyEl.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; background:#020617; border:1px solid #eab308; border-radius:8px; padding:6px 10px;">
        <div>
          <strong style="color:#fde047; font-size:0.88rem;">${c.name} (Nv. ${c.level})</strong>
          <div style="font-size:0.68rem; color:#94a3b8;">${c.classNamePtBr || 'Classe'} &bull; Elemento: ${c.elementNamePtBr || c.elementCode}</div>
        </div>
        ${(c.unspentStatPoints || 0) > 0 ? `
          <div style="background:#eab308; color:#020617; font-weight:900; font-size:0.74rem; padding:2px 8px; border-radius:99px;">
            ★ ${c.unspentStatPoints} Pts Livres
          </div>
        ` : ''}
      </div>

      <!-- Paperdoll de 12 Slots de Equipamento -->
      <div style="background:#0a0f1d; border:1px solid #1e293b; border-radius:8px; padding:8px; display:flex; justify-content:space-between; align-items:center;">
        <div style="display:grid; grid-template-columns:repeat(2, 42px); gap:6px;">
          ${leftDefs.map(renderEquipBox).join('')}
        </div>
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center;">
          <img src="${c.thumbUrl || '/play/assets/hud/menu_character.png'}" style="width:72px; height:72px; object-fit:contain; border-radius:8px;" />
          <span style="font-size:0.64rem; color:#64748b; margin-top:3px;">Paperdoll 12 Slots</span>
        </div>
        <div style="display:grid; grid-template-columns:repeat(2, 42px); gap:6px;">
          ${rightDefs.map(renderEquipBox).join('')}
        </div>
      </div>
      <div id="characterSlotDetailPanel" style="display:none; background:#020617; border:1px solid #38bdf8; border-radius:6px; padding:6px 8px;"></div>

      <!-- Atributos Base -->
      <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:6px;">
        ${['VIT', 'STR', 'INT', 'WIS', 'AGI', 'DEX'].map((k) => `
          <div style="background:#0f172a; border:1px solid #334155; border-radius:6px; padding:5px; text-align:center;">
            <div style="font-size:0.66rem; color:#94a3b8; font-weight:700;">${k}</div>
            <div style="font-size:0.95rem; font-weight:900; color:#f8fafc;">${totalBase[k]}</div>
            ${(c.unspentStatPoints || 0) > 0 ? `
              <button onclick="window.PlayApp.distributeStatPoint('${k}')" class="btn-success" style="padding:1px 6px; font-size:0.65rem; font-weight:800; border-radius:4px; margin-top:2px;">+1</button>
            ` : ''}
          </div>
        `).join('')}
      </div>
    `;
  },

  onPaperdollClick(slotCode) {
    const box = document.querySelector(`.equip-slot-box[data-slot="${slotCode}"]`);
    const panel = document.getElementById('characterSlotDetailPanel');
    if (!box || !panel) return;

    const raw = box.getAttribute('data-item');
    if (!raw) {
      panel.style.display = 'block';
      panel.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="color:#94a3b8; font-size:0.75rem;">Slot <strong>${slotCode}</strong> vazio.</span>
          <button class="btn-primary" style="padding:3px 7px; font-size:0.7rem;" onclick="window.PlayApp.openBagModal()">🎒 Abrir Mochila</button>
        </div>
      `;
      return;
    }

    try {
      const it = JSON.parse(decodeURIComponent(raw));
      panel.style.display = 'block';
      panel.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
          <div style="display:flex; align-items:center; gap:6px;">
            <img src="${it.iconUrl}" style="width:30px; height:30px; object-fit:contain; border-radius:4px; background:#020617;" />
            <div>
              <div style="font-size:0.8rem; font-weight:800; color:#fde047;">${it.namePtBr}</div>
              <div style="font-size:0.66rem; color:#94a3b8;">${slotCode} &bull; Rank ${it.rarityTier}</div>
            </div>
          </div>
          <button class="btn-danger" style="padding:4px 10px; font-size:0.72rem; font-weight:700;" onclick="window.PlayApp.unequipCharacterSlot('${slotCode}')">
            Desequipar
          </button>
        </div>
      `;
    } catch {
      panel.style.display = 'none';
    }
  },

  injectBagModalDom() {
    if (document.getElementById('bagModal')) return;
    const modal = document.createElement('div');
    modal.id = 'bagModal';
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal-box" style="width:min(95vw, 440px); max-height:92dvh; overflow:hidden; display:flex; flex-direction:column; padding:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #334155; padding-bottom:8px; margin-bottom:8px;">
          <h3 style="color:#fde047; font-size:0.95rem; margin:0;">🎒 Inventário & Carteira</h3>
          <button class="btn-danger" style="padding:3px 9px;" onclick="document.getElementById('bagModal').style.display='none'">✕</button>
        </div>
        <div id="bagModalBody" style="display:flex; flex-direction:column; gap:8px; flex:1; overflow:hidden;"></div>
      </div>`;
    document.body.appendChild(modal);
  },

  injectCharacterModalDom() {
    if (document.getElementById('characterModal')) return;
    const modal = document.createElement('div');
    modal.id = 'characterModal';
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal-box" style="width:min(96vw, 460px); max-height:92dvh; overflow-y:auto; padding:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #334155; padding-bottom:8px; margin-bottom:8px;">
          <h3 style="color:#fde047; font-size:0.95rem; margin:0;">👤 Personagem & Atributos</h3>
          <button class="btn-danger" style="padding:3px 9px;" onclick="document.getElementById('characterModal').style.display='none'">✕</button>
        </div>
        <div id="characterModalBody" style="display:flex; flex-direction:column; gap:8px;"></div>
      </div>`;
    document.body.appendChild(modal);
  },

  injectItemDetailModalDom() {
    if (document.getElementById('bagItemDetailModal')) return;
    const modal = document.createElement('div');
    modal.id = 'bagItemDetailModal';
    modal.className = 'modal-backdrop';
    modal.style.zIndex = '10000';
    modal.innerHTML = `
      <div class="modal-box" style="width:min(92vw, 380px); background:#0b1329; border:1.5px solid #38bdf8; box-shadow:0 0 25px rgba(56,189,248,0.3); padding:14px;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #1e293b; padding-bottom:6px; margin-bottom:10px;">
          <h4 style="color:#38bdf8; font-size:0.86rem; margin:0;">🔍 Detalhes do Item</h4>
          <button class="btn-danger" style="padding:2px 8px; font-size:0.75rem;" onclick="window.PlayBagController.closeItemDetailModal()">✕</button>
        </div>
        <div id="bagItemDetailContent" style="display:flex; flex-direction:column; gap:8px;"></div>
      </div>`;
    document.body.appendChild(modal);
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },
};

window.PlayBagController = PlayBagController;
