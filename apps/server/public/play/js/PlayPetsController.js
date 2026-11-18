/**
 * @file apps/server/public/play/js/PlayPetsController.js
 * @module @etheria/client/pets
 * @description Controlador Cliente do Sistema Procedural de Pets na Rota `/play`:
 *   - Acompanhamento 2.5D em Tempo Real: O Pet do Slot 1 caminha junto ao jogador durante a exploração dos mapas.
 *   - Modal Completo de Pets (Responsivo Mobile Portrait/Landscape & Desktop):
 *     1. Aba Atributos & Formação: Exibe Elemento Sorteado, Raça, Raridade (F..SS + Multiplicadores),
 *        status "Inativado Temporariamente" quando o monstro é inativado no `/admin`, seleção de Slots 1..3
 *        e distribuição interativa dos 76 pontos iniciais (+4 pontos por Level Up) sobre a base fixa de 1 ponto.
 *     2. Aba Habilidades Livres (Máx. 3): Permite ao jogador fixar livremente até 3 habilidades da tabela `skill_templates`.
 *     3. Aba Catálogo / Gerar Pet: Lista todos os monstros ativos com `Pet Capturável = Sim` para geração procedural.
 */

class PlayPetsController {
  constructor() {
    this.client = null;
    this.isOpen = false;
    this.selectedPetId = null;
    this.activeTab = 'STATS'; // 'STATS' | 'SKILLS' | 'GENERATE'
    this.pendingAllocations = { VIT: 0, STR: 0, INT: 0, WIS: 0, AGI: 0, DEX: 0 };
    this.skillSearchQuery = '';
    this.generateSearchQuery = '';
    this.isSubmitting = false;

    // Estado de Movimento do Pet Seguidor (Slot 1) no Mapa de Exploração
    this.followerX = null;
    this.followerY = null;
    this.followerDir = 0;
    this.followerIsMoving = false;
    this.lastMapId = null;
  }

  init(clientApp) {
    this.client = clientApp || window.PlayApp;
    this.injectStyles();
  }

  getClient() {
    return this.client || window.PlayApp || null;
  }

  getActiveChar() {
    return this.getClient()?.activeChar || null;
  }

  getAllPets() {
    const char = this.getActiveChar();
    if (!char) return [];
    return Array.isArray(char.pets) ? char.pets : (Array.isArray(char.equippedPets) ? char.equippedPets : []);
  }

  getPrimaryFollowerPet() {
    const char = this.getActiveChar();
    if (!char) return null;
    if (char.primaryFollowerPet && !char.primaryFollowerPet.isTemporarilyDisabled) {
      return char.primaryFollowerPet;
    }
    const all = this.getAllPets();
    return all.find((p) => Number(p.deploySlot) === 1 && !p.isTemporarilyDisabled) || null;
  }

  /**
   * Atualiza o estado de pets do personagem ativo e sincroniza a HUD lateral direita.
   */
  applyPetsPayload(payload) {
    const client = this.getClient();
    if (!client || !client.activeChar || !payload) return;

    client.activeChar.pets = Array.isArray(payload.allPets) ? payload.allPets : [];
    client.activeChar.equippedPets = Array.isArray(payload.equippedPets) ? payload.equippedPets : [];
    client.activeChar.primaryFollowerPet = payload.primaryFollowerPet || null;

    if (window.PlayHudController) {
      window.PlayHudController.updatePets(client.activeChar.equippedPets);
    }

    if (this.isOpen) {
      this.renderModal();
    }
  }

  async refreshPetsFromServer() {
    const client = this.getClient();
    const char = this.getActiveChar();
    if (!client || !char) return;
    try {
      const payload = await client.api(`/api/play/characters/${char.id}/pets`);
      this.applyPetsPayload(payload);
    } catch (err) {
      console.warn('[PlayPetsController] Aviso ao atualizar pets:', err.message);
    }
  }

  // ============================================================================
  // 1. SEGUIDOR 2.5D NO MAPA DE EXPLORAÇÃO (PET DO SLOT 1 CAMINHANDO JUNTO)
  // ============================================================================

  updateFollowerPhysics(client, dt) {
    const pet = this.getPrimaryFollowerPet();
    if (!pet || !client || !client.currentMap) {
      this.followerX = null;
      this.followerY = null;
      this.followerIsMoving = false;
      return;
    }

    const dirAngles = [
      Math.PI / 2,
      (3 * Math.PI) / 4,
      Math.PI,
      -(3 * Math.PI) / 4,
      -Math.PI / 2,
      -Math.PI / 4,
      0,
      Math.PI / 4,
    ];
    const pAngle = dirAngles[client.playerDir] ?? Math.PI / 2;
    // Posiciona o Pet 42px atrás e levemente à lateral do jogador
    const followAngle = pAngle + Math.PI + 0.42;
    const followDist = 42;
    const targetX = client.playerX + Math.cos(followAngle) * followDist;
    const targetY = client.playerY + Math.sin(followAngle) * (followDist * 0.82);

    if (
      this.followerX === null ||
      this.followerY === null ||
      this.lastMapId !== client.currentMap.id ||
      Math.hypot(client.playerX - this.followerX, client.playerY - this.followerY) > 360
    ) {
      this.followerX = targetX;
      this.followerY = targetY;
      this.followerDir = client.playerDir || 0;
      this.followerIsMoving = false;
      this.lastMapId = client.currentMap.id;
      return;
    }

    const dx = targetX - this.followerX;
    const dy = targetY - this.followerY;
    const dist = Math.hypot(dx, dy);

    if (dist > 10) {
      this.followerIsMoving = true;
      this.followerDir = client.calculateDirection8(dx, dy);
      const speed = (client.baseMoveSpeed || 168) * (dist > 95 ? 1.25 : 1.02);
      const step = Math.min(dist, speed * dt);
      this.followerX += (dx / dist) * step;
      this.followerY += (dy / dist) * step;
    } else {
      this.followerIsMoving = Boolean(client.isMoving);
      if (!client.isMoving) {
        this.followerDir = client.playerDir;
      }
    }
  }

  populateRenderQueue(client, renderQueue) {
    const pet = this.getPrimaryFollowerPet();
    if (!pet || this.followerX === null || this.followerY === null) return;
    renderQueue.pushItem('PET_FOLLOWER', this.followerY, pet);
  }

  drawFollowerPet(client, ctx, pet, now) {
    if (!pet || this.followerX === null || this.followerY === null) return;
    const sprite = client.getOrCreateSprite(
      `pet_${pet.mcreworkMonsterKey}`,
      pet.atlasJsonUrl,
      pet.atlasWebpUrl,
      pet.thumbUrl
    );
    const gOffset = Number(pet.groundOffsetY) || 0;
    const action = this.followerIsMoving ? 1 : 0;
    sprite.draw(
      ctx,
      this.followerX,
      this.followerY,
      action,
      this.followerDir,
      now,
      client.mesh,
      gOffset,
      0.58,
      false,
      pet.shadowOffsetX || 0,
      pet.shadowOffsetY || 0
    );

    const elStyle = client.getElementStyle ? client.getElementStyle(pet.elementCode) : { icon: '🐾' };
    const labelY = this.followerY - 52 + Math.round(gOffset * 0.58);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 9px sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(`[Pet • Rank ${pet.rarityTier || 'F'}]`, this.followerX, labelY - 11);
    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = '#bae6fd';
    ctx.fillText(`${elStyle.icon || '🐾'} ${pet.nickname} (Nv.${pet.level || 1})`, this.followerX, labelY);
    ctx.restore();
  }

  // ============================================================================
  // 2. MODAL COMPLETO DE GESTÃO DE PETS (ATRIBUTOS, SLOTS 1..3, 3 SKILLS, GERADOR)
  // ============================================================================

  openModal() {
    this.isOpen = true;
    const all = this.getAllPets();
    if (!this.selectedPetId && all.length > 0) {
      this.selectedPetId = all[0].id;
    } else if (this.selectedPetId && !all.some((p) => Number(p.id) === Number(this.selectedPetId))) {
      this.selectedPetId = all[0]?.id || null;
    }
    if (all.length === 0) {
      this.activeTab = 'GENERATE';
    }
    this.resetPendingAllocations();
    this.renderModal();
    void this.refreshPetsFromServer();
  }

  closeModal() {
    this.isOpen = false;
    const existing = document.getElementById('hudPetsModal');
    if (existing) existing.remove();
  }

  selectPet(petId) {
    this.selectedPetId = Number(petId);
    this.resetPendingAllocations();
    if (this.activeTab === 'GENERATE') {
      this.activeTab = 'STATS';
    }
    this.renderModal();
  }

  switchTab(tab) {
    this.activeTab = tab;
    this.renderModal();
  }

  resetPendingAllocations() {
    this.pendingAllocations = { VIT: 0, STR: 0, INT: 0, WIS: 0, AGI: 0, DEX: 0 };
  }

  getTotalPendingPoints() {
    return Object.values(this.pendingAllocations).reduce((acc, v) => acc + (Number(v) || 0), 0);
  }

  adjustPendingStat(attr, delta) {
    const all = this.getAllPets();
    const pet = all.find((p) => Number(p.id) === Number(this.selectedPetId));
    if (!pet) return;

    const unspent = Number(pet.unspentStatPoints || 0);
    const currentTotal = this.getTotalPendingPoints();
    const curVal = Number(this.pendingAllocations[attr] || 0);

    if (delta > 0) {
      const remaining = Math.max(0, unspent - currentTotal);
      const add = Math.min(delta, remaining);
      if (add <= 0) return;
      this.pendingAllocations[attr] = curVal + add;
    } else if (delta < 0) {
      const sub = Math.min(Math.abs(delta), curVal);
      if (sub <= 0) return;
      this.pendingAllocations[attr] = curVal - sub;
    }
    this.renderModal();
  }

  async confirmStatDistribution() {
    const client = this.getClient();
    const char = this.getActiveChar();
    if (!client || !char || !this.selectedPetId || this.isSubmitting) return;
    const total = this.getTotalPendingPoints();
    if (total <= 0) return;

    this.isSubmitting = true;
    try {
      const payload = await client.api(`/api/play/characters/${char.id}/pets/${this.selectedPetId}/distribute-stats`, {
        method: 'POST',
        body: JSON.stringify({ allocations: this.pendingAllocations }),
      });
      this.resetPendingAllocations();
      this.applyPetsPayload(payload);
    } catch (err) {
      alert(err.message);
    } finally {
      this.isSubmitting = false;
    }
  }

  async setPetSlot(petId, slot) {
    const client = this.getClient();
    const char = this.getActiveChar();
    if (!client || !char || this.isSubmitting) return;

    this.isSubmitting = true;
    try {
      const payload = await client.api(`/api/play/characters/${char.id}/pets/${petId}/deploy-slot`, {
        method: 'POST',
        body: JSON.stringify({ deploySlot: slot }),
      });
      this.applyPetsPayload(payload);
    } catch (err) {
      alert(err.message);
    } finally {
      this.isSubmitting = false;
    }
  }

  async togglePetSkill(petId, skillId) {
    const client = this.getClient();
    const char = this.getActiveChar();
    if (!client || !char || this.isSubmitting) return;

    const pet = this.getAllPets().find((p) => Number(p.id) === Number(petId));
    if (!pet) return;

    const current = Array.isArray(pet.skillIdsJson) ? pet.skillIdsJson.map(Number) : [];
    const sId = Number(skillId);
    let nextSkills;
    if (current.includes(sId)) {
      nextSkills = current.filter((id) => id !== sId);
    } else {
      if (current.length >= 3) {
        alert('Um Pet pode ter no máximo 3 habilidades fixadas! Remova uma antes de fixar outra.');
        return;
      }
      nextSkills = [...current, sId];
    }

    this.isSubmitting = true;
    try {
      const payload = await client.api(`/api/play/characters/${char.id}/pets/${petId}/skills`, {
        method: 'POST',
        body: JSON.stringify({ skillIds: nextSkills }),
      });
      this.applyPetsPayload(payload);
    } catch (err) {
      alert(err.message);
    } finally {
      this.isSubmitting = false;
    }
  }

  async promptRenamePet(petId, currentName) {
    const client = this.getClient();
    const char = this.getActiveChar();
    if (!client || !char) return;
    const nextName = prompt('Novo nome para o seu Pet (2 a 24 caracteres):', currentName || '');
    if (!nextName || !nextName.trim() || nextName.trim() === currentName) return;

    try {
      const payload = await client.api(`/api/play/characters/${char.id}/pets/${petId}/rename`, {
        method: 'POST',
        body: JSON.stringify({ nickname: nextName.trim() }),
      });
      this.applyPetsPayload(payload);
    } catch (err) {
      alert(err.message);
    }
  }

  async generatePetFromMonster(monsterTemplateId) {
    const client = this.getClient();
    const char = this.getActiveChar();
    if (!client || !char || this.isSubmitting) return;

    this.isSubmitting = true;
    try {
      const payload = await client.api(`/api/play/characters/${char.id}/pets/generate`, {
        method: 'POST',
        body: JSON.stringify({ monsterTemplateId: Number(monsterTemplateId) }),
      });
      const all = Array.isArray(payload.allPets) ? payload.allPets : [];
      if (all.length > 0) {
        const newest = all.reduce((a, b) => (Number(b.id) > Number(a.id) ? b : a), all[0]);
        this.selectedPetId = newest.id;
      }
      this.activeTab = 'STATS';
      this.resetPendingAllocations();
      this.applyPetsPayload(payload);
    } catch (err) {
      alert(err.message);
    } finally {
      this.isSubmitting = false;
    }
  }

  renderModal() {
    let modal = document.getElementById('hudPetsModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.className = 'modal-backdrop';
      modal.id = 'hudPetsModal';
      modal.style.display = 'flex';
      modal.addEventListener('click', (ev) => {
        if (ev.target === modal) this.closeModal();
      });
      document.body.appendChild(modal);
    }

    const allPets = this.getAllPets();
    const equippedCount = allPets.filter((p) => p.deploySlot && !p.isTemporarilyDisabled).length;
    const selectedPet = allPets.find((p) => Number(p.id) === Number(this.selectedPetId)) || allPets[0] || null;
    if (selectedPet && this.selectedPetId !== selectedPet.id) {
      this.selectedPetId = selectedPet.id;
    }

    modal.innerHTML = `
      <div class="hud-modal-dialog pet-system-modal-dialog">
        <div class="hud-modal-header" style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
          <div style="display:flex; align-items:center; gap:8px;">
            <h3 style="margin:0;">🐾 Companheiros & Pets (${equippedCount}/3 em Formação)</h3>
          </div>
          <div style="display:flex; align-items:center; gap:6px;">
            <button type="button" class="pet-tab-btn ${this.activeTab === 'STATS' ? 'active' : ''}" onclick="window.PlayPetsController.switchTab('STATS')">📊 Atributos & Slots</button>
            <button type="button" class="pet-tab-btn ${this.activeTab === 'SKILLS' ? 'active' : ''}" onclick="window.PlayPetsController.switchTab('SKILLS')">⚡ Habilidades (Máx 3)</button>
            <button type="button" class="pet-tab-btn ${this.activeTab === 'GENERATE' ? 'active' : ''}" onclick="window.PlayPetsController.switchTab('GENERATE')">🥚 Catálogo Capturável</button>
            <button type="button" class="hud-modal-close" onclick="window.PlayPetsController.closeModal()">✕</button>
          </div>
        </div>

        <div class="pet-system-modal-layout">
          <!-- Coluna Esquerda: Lista de Pets do Jogador -->
          <div class="pet-roster-sidebar">
            <div class="pet-roster-header">
              <span>Meus Pets (${allPets.length})</span>
              <button type="button" class="pet-mini-btn" onclick="window.PlayPetsController.switchTab('GENERATE')">+ Gerar</button>
            </div>
            <div class="pet-roster-list">
              ${
                allPets.length === 0
                  ? `<div style="padding:16px 10px; text-align:center; color:#94a3b8; font-size:0.78rem;">
                       Nenhum Pet gerado ainda.<br/>
                       Use a aba <strong>🥚 Catálogo Capturável</strong> ao lado para gerar um Pet!
                     </div>`
                  : allPets.map((p) => this.renderRosterCardHtml(p, selectedPet?.id === p.id)).join('')
              }
            </div>
          </div>

          <!-- Painel Principal Direito -->
          <div class="pet-main-content">
            ${this.renderActiveTabContent(selectedPet)}
          </div>
        </div>
      </div>
    `;
  }

  renderRosterCardHtml(p, isSelected) {
    const client = this.getClient();
    const elStyle = client?.getElementStyle ? client.getElementStyle(p.elementCode) : { icon: '⚪', color: '#cbd5e1' };
    const isDisabled = Boolean(p.isTemporarilyDisabled);
    const slotBadge = isDisabled
      ? `<span class="pet-badge-disabled">⚠️ Inativado Temporariamente</span>`
      : p.deploySlot === 1
      ? `<span class="pet-badge-slot1">⭐ Slot 1 (Mapa & Equipe)</span>`
      : p.deploySlot === 2 || p.deploySlot === 3
      ? `<span class="pet-badge-slot">⚔️ Slot ${p.deploySlot} (Solo)</span>`
      : `<span class="pet-badge-reserve">📦 Reserva</span>`;

    return `
      <div class="pet-roster-item ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled-pet' : ''}" onclick="window.PlayPetsController.selectPet(${p.id})">
        <div class="pet-roster-thumb-wrap">
          <img src="${p.thumbUrl}" alt="${p.nickname}" onerror="this.src='/play/assets/hud/menu_pets.png'" />
          <span class="pet-rank-pill rank-${(p.rarityTier || 'F').toLowerCase()}">${p.rarityTier || 'F'}</span>
        </div>
        <div class="pet-roster-meta">
          <div class="pet-roster-name-row">
            <strong>${p.nickname}</strong>
            <span style="font-size:0.72rem; color:${elStyle.color};">${elStyle.icon} Nv.${p.level}</span>
          </div>
          <div style="font-size:0.68rem; color:#94a3b8;">${p.speciesNamePtBr || ''} • ${p.raceNamePtBr || p.raceCode}</div>
          <div style="margin-top:3px; display:flex; align-items:center; justify-content:space-between; gap:4px;">
            ${slotBadge}
            ${p.unspentStatPoints > 0 ? `<span class="pet-unspent-pill">+${p.unspentStatPoints} pts</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  renderActiveTabContent(pet) {
    if (this.activeTab === 'GENERATE') {
      return this.renderGenerateTabHtml();
    }
    if (!pet) {
      return `
        <div style="padding:36px 16px; text-align:center; color:#94a3b8;">
          Selecione um Pet na lista ou gere um novo na aba <strong>🥚 Catálogo Capturável</strong>.
        </div>
      `;
    }
    if (this.activeTab === 'SKILLS') {
      return this.renderSkillsTabHtml(pet);
    }
    return this.renderStatsTabHtml(pet);
  }

  renderStatsTabHtml(pet) {
    const client = this.getClient();
    const elStyle = client?.getElementStyle ? client.getElementStyle(pet.elementCode) : { icon: '⚪', color: '#cbd5e1', bg: 'rgba(148,163,184,0.2)' };
    const isDisabled = Boolean(pet.isTemporarilyDisabled);
    const pendingTotal = this.getTotalPendingPoints();
    const remainingPoints = Math.max(0, Number(pet.unspentStatPoints || 0) - pendingTotal);
    const fixed = pet.fixedBaseStats || { VIT: 1, STR: 1, INT: 1, WIS: 1, AGI: 1, DEX: 1 };
    const dist = pet.distributedStatsJson || { VIT: 0, STR: 0, INT: 0, WIS: 0, AGI: 0, DEX: 0 };
    const cs = pet.computedCombatStats || {};
    const rp = pet.rarityProfile || { hp: 1, atk: 1, def: 1, critBonus: 0, accBonus: 0 };

    const attrMeta = [
      { key: 'VIT', label: 'Vitalidade (VIT)', desc: 'HP Máx e Defesa Física', color: '#4ade80' },
      { key: 'STR', label: 'Força (STR)', desc: 'Ataque Físico e Dano Crítico', color: '#f87171' },
      { key: 'INT', label: 'Inteligência (INT)', desc: 'MP Máx e Ataque Mágico', color: '#38bdf8' },
      { key: 'WIS', label: 'Sabedoria (WIS)', desc: 'Defesa Mágica, Cura e Esquiva Mág.', color: '#c084fc' },
      { key: 'AGI', label: 'Agilidade (AGI)', desc: 'Vel. Movimento, Esquiva e Ataque', color: '#fde047' },
      { key: 'DEX', label: 'Destreza (DEX)', desc: 'Taxa Crítica e Precisão Fís/Mág', color: '#fb923c' },
    ];

    return `
      <div class="pet-details-scroll">
        ${
          isDisabled
            ? `<div class="pet-disabled-alert">
                 ⚠️ <strong>INATIVADO TEMPORARIAMENTE:</strong> O monstro base deste Pet foi inativado ou desmarcado como Pet no servidor. Ele permanece salvo no seu inventário, mas não pode entrar em combate ou acompanhar no mapa até ser reativado.
               </div>`
            : ''
        }

        <!-- Cabeçalho do Pet -->
        <div class="pet-hero-banner">
          <div class="pet-hero-avatar">
            <img src="${pet.thumbUrl}" alt="${pet.nickname}" />
            <span class="pet-rank-pill rank-${(pet.rarityTier || 'F').toLowerCase()}">Rank ${pet.rarityTier || 'F'}</span>
          </div>
          <div class="pet-hero-info">
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <h4 style="margin:0; font-size:1.05rem; color:#fef08a;">${pet.nickname}</h4>
              <button type="button" class="pet-mini-btn" onclick="window.PlayPetsController.promptRenamePet(${pet.id}, '${pet.nickname.replace(/'/g, "\\'")}')">✏️ Renomear</button>
              <span style="font-size:0.75rem; padding:2px 8px; border-radius:99px; background:${elStyle.bg}; color:${elStyle.color}; font-weight:700;">
                ${elStyle.icon} ${pet.elementNamePtBr || pet.elementCode} (Sorteado)
              </span>
            </div>
            <div style="font-size:0.76rem; color:#cbd5e1; margin-top:4px; display:flex; flex-wrap:wrap; gap:10px;">
              <span>🧬 <strong>Tipo:</strong> ${pet.raceNamePtBr || pet.raceCode}</span>
              <span>⚔️ <strong>Estilo:</strong> ${pet.combatStyle === 'RANGED' ? `À Distância (${pet.attackRange}px)` : `Corpo a Corpo (${pet.attackRange}px)`}</span>
              <span>💥 <strong>Dano:</strong> ${pet.damageType === 'MAGICAL' ? '🔮 Mágico' : '🗡️ Físico'}</span>
            </div>
            <div style="font-size:0.72rem; color:#fde047; margin-top:3px;">
              👑 <strong>Bônus de Raridade (${pet.rarityTier}):</strong> ${rp.hp}x HP/MP • ${rp.atk}x ATK • ${rp.def}x DEF ${rp.critBonus ? `• +${Math.round(rp.critBonus * 100)}% Crit` : ''} ${rp.accBonus ? `• +${rp.accBonus} Prec` : ''}
            </div>
            <!-- Barra de Nível e XP (Ganha 50% da XP do Jogador) -->
            <div class="pet-xp-row">
              <span style="font-weight:800; color:#38bdf8; font-size:0.76rem;">Nv. ${pet.level}</span>
              <div class="pet-xp-bar-track">
                <div class="pet-xp-bar-fill" style="width:${pet.xpPct || 0}%;"></div>
              </div>
              <span style="font-size:0.7rem; color:#94a3b8;">${Number(pet.experience || 0).toLocaleString('pt-BR')} / ${Number(pet.maxXp || 42000).toLocaleString('pt-BR')} XP (50% do Herói)</span>
            </div>
          </div>
        </div>

        <!-- Seletor de Slot de Formação (Slots 1, 2, 3 ou Reserva) -->
        <div class="pet-slot-selector-box">
          <div style="font-size:0.75rem; font-weight:700; color:#e2e8f0; margin-bottom:6px;">
            🛡️ Posição na Formação (Solo leva Slots 1, 2 e 3 • Equipe e Mapa usam o Slot 1):
          </div>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button type="button" class="pet-slot-btn ${pet.deploySlot === 1 ? 'active-slot1' : ''}" ${isDisabled ? 'disabled' : ''} onclick="window.PlayPetsController.setPetSlot(${pet.id}, 1)">
              ⭐ Slot 1 (Principal / Mapa & Equipe)
            </button>
            <button type="button" class="pet-slot-btn ${pet.deploySlot === 2 ? 'active' : ''}" ${isDisabled ? 'disabled' : ''} onclick="window.PlayPetsController.setPetSlot(${pet.id}, 2)">
              ⚔️ Slot 2 (Auxiliar Solo)
            </button>
            <button type="button" class="pet-slot-btn ${pet.deploySlot === 3 ? 'active' : ''}" ${isDisabled ? 'disabled' : ''} onclick="window.PlayPetsController.setPetSlot(${pet.id}, 3)">
              ⚔️ Slot 3 (Auxiliar Solo)
            </button>
            <button type="button" class="pet-slot-btn ${pet.deploySlot === null ? 'active-reserve' : ''}" onclick="window.PlayPetsController.setPetSlot(${pet.id}, null)">
              📦 Guardar na Reserva
            </button>
          </div>
        </div>

        <!-- Painel de Distribuição de Atributos Base (1 Fixo + 76 no Nv.1 + 4/Level Up) -->
        <div class="pet-stats-grid-layout">
          <div class="pet-base-attrs-panel">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <strong style="font-size:0.82rem; color:#f8fafc;">📊 Atributos Base (1 Fixo + Livres)</strong>
              <span class="pet-points-avail-badge">Pontos Livres: <strong>${remainingPoints}</strong></span>
            </div>

            <div class="pet-attr-rows">
              ${attrMeta
                .map((a) => {
                  const baseVal = Number(fixed[a.key] ?? 1);
                  const distVal = Number(dist[a.key] ?? 0);
                  const pendVal = Number(this.pendingAllocations[a.key] ?? 0);
                  const totalVal = baseVal + distVal + pendVal;
                  return `
                    <div class="pet-attr-row">
                      <div style="flex:1; min-width:0;">
                        <div style="font-size:0.78rem; font-weight:700; color:${a.color};">${a.label}</div>
                        <div style="font-size:0.66rem; color:#94a3b8;">${a.desc}</div>
                      </div>
                      <div style="text-align:right; margin-right:8px;">
                        <div style="font-size:0.86rem; font-weight:800; color:#f8fafc;">
                          ${totalVal}
                          ${pendVal > 0 ? `<span style="color:#4ade80; font-size:0.74rem;">(+${pendVal})</span>` : ''}
                        </div>
                        <div style="font-size:0.64rem; color:#64748b;">1 fixo + ${distVal} dist</div>
                      </div>
                      <div style="display:flex; gap:3px;">
                        <button type="button" class="pet-alloc-btn" ${pendVal <= 0 ? 'disabled' : ''} onclick="window.PlayPetsController.adjustPendingStat('${a.key}', -1)">-1</button>
                        <button type="button" class="pet-alloc-btn plus" ${remainingPoints <= 0 ? 'disabled' : ''} onclick="window.PlayPetsController.adjustPendingStat('${a.key}', 1)">+1</button>
                        <button type="button" class="pet-alloc-btn plus" ${remainingPoints < 5 ? 'disabled' : ''} onclick="window.PlayPetsController.adjustPendingStat('${a.key}', 5)">+5</button>
                        <button type="button" class="pet-alloc-btn plus" ${remainingPoints < 10 ? 'disabled' : ''} onclick="window.PlayPetsController.adjustPendingStat('${a.key}', 10)">+10</button>
                      </div>
                    </div>
                  `;
                })
                .join('')}
            </div>

            ${
              pendingTotal > 0
                ? `<div style="display:flex; gap:8px; margin-top:10px;">
                     <button type="button" class="pet-confirm-stats-btn" onclick="window.PlayPetsController.confirmStatDistribution()">
                       ✅ Confirmar Distribuição (+${pendingTotal} pts)
                     </button>
                     <button type="button" class="pet-slot-btn" onclick="window.PlayPetsController.resetPendingAllocations(); window.PlayPetsController.renderModal();">
                       Limpar
                     </button>
                   </div>`
                : ''
            }
          </div>

          <!-- Status Finais de Combate (Derivados com Raridade + Não-Derivados do Monstro) -->
          <div class="pet-combat-stats-panel">
            <strong style="font-size:0.82rem; color:#f8fafc; display:block; margin-bottom:8px;">
              ⚔️ Status de Combate (c/ Bônus Rank ${pet.rarityTier})
            </strong>
            <div class="pet-combat-stats-list">
              <div class="pet-cstat-item"><span>❤️ HP Máximo</span><strong style="color:#4ade80;">${cs.maxHp || 100}</strong></div>
              <div class="pet-cstat-item"><span>💧 MP Máximo</span><strong style="color:#38bdf8;">${cs.maxMp || 50}</strong></div>
              <div class="pet-cstat-item"><span>🗡️ Ataque Físico</span><strong style="color:#f87171;">${cs.physAtk || 10}</strong></div>
              <div class="pet-cstat-item"><span>🔮 Ataque Mágico</span><strong style="color:#c084fc;">${cs.magAtk || 10}</strong></div>
              <div class="pet-cstat-item"><span>🛡️ Defesa Física</span><strong style="color:#fbbf24;">${cs.def || 8}</strong></div>
              <div class="pet-cstat-item"><span>✨ Defesa Mágica</span><strong style="color:#a78bfa;">${cs.magDef || 8}</strong></div>
              <div class="pet-cstat-item"><span>🏃 Vel. Movimento</span><strong style="color:#38bdf8;">${cs.battleMoveSpeed || 160} px/s</strong></div>
              <div class="pet-cstat-item"><span>⚡ Vel. Ataque</span><strong style="color:#fde047;">${Number(cs.attackSpeed || 1.0).toFixed(2)} /s</strong></div>
              <div class="pet-cstat-item"><span>💥 Taxa Crítica</span><strong style="color:#fb7185;">${cs.critRatePct ?? 5}%</strong></div>
              <div class="pet-cstat-item"><span>🔥 Dano Crítico</span><strong style="color:#f43f5e;">${cs.critDmgPct ?? 150}%</strong></div>
              <div class="pet-cstat-item"><span>🎯 Precisão Fís/Mág</span><strong style="color:#86efac;">${cs.physAccuracy ?? 95}% / ${cs.magAccuracy ?? 95}%</strong></div>
              <div class="pet-cstat-item"><span>💨 Esquiva Fís/Mág</span><strong style="color:#67e8f9;">${cs.physEvasion ?? 5}% / ${cs.magEvasion ?? 5}%</strong></div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderSkillsTabHtml(pet) {
    const client = this.getClient();
    const allSkills = Array.isArray(client?.skillTemplates) ? client.skillTemplates : [];
    const pinnedIds = Array.isArray(pet.skillIdsJson) ? pet.skillIdsJson.map(Number) : [];
    const pinnedSkills = pinnedIds.map((id) => allSkills.find((s) => Number(s.id) === id)).filter(Boolean);

    const q = (this.skillSearchQuery || '').toLowerCase().trim();
    const filteredSkills = allSkills.filter((sk) => {
      if (!q) return true;
      return `${sk.id} ${sk.namePtBr} ${sk.descriptionPtBr || ''} ${sk.code || ''}`.toLowerCase().includes(q);
    });

    return `
      <div class="pet-details-scroll">
        <div class="pet-skills-header-box">
          <div>
            <strong style="font-size:0.88rem; color:#fef08a;">⚡ Habilidades Fixadas em ${pet.nickname} (${pinnedIds.length}/3)</strong>
            <div style="font-size:0.72rem; color:#94a3b8; margin-top:2px;">
              Escolha livremente até 3 habilidades da tabela de habilidades. Habilidades com elemento herdado usam o elemento do Pet (<strong>${pet.elementNamePtBr || pet.elementCode}</strong>).
            </div>
          </div>
        </div>

        <!-- 3 Slots de Habilidades do Pet -->
        <div class="pet-pinned-skills-grid">
          ${[0, 1, 2]
            .map((slotIdx) => {
              const sk = pinnedSkills[slotIdx];
              if (!sk) {
                return `
                  <div class="pet-skill-slot-card empty">
                    <span>❖ Slot de Habilidade #${slotIdx + 1} Vago</span>
                    <small>Clique em "Fixar" em qualquer habilidade abaixo</small>
                  </div>
                `;
              }
              return `
                <div class="pet-skill-slot-card">
                  <img src="${sk.iconUrl}" alt="${sk.namePtBr}" />
                  <div style="flex:1; min-width:0;">
                    <div style="font-weight:700; font-size:0.8rem; color:#38bdf8;">${sk.namePtBr}</div>
                    <div style="font-size:0.68rem; color:#cbd5e1;">💧 ${sk.mpCost || 0} MP • ⏳ ${sk.cooldownSeconds || 0}s</div>
                  </div>
                  <button type="button" class="pet-mini-btn danger" onclick="window.PlayPetsController.togglePetSkill(${pet.id}, ${sk.id})">Remover</button>
                </div>
              `;
            })
            .join('')}
        </div>

        <!-- Catálogo Completo de Habilidades Livres -->
        <div style="margin-top:12px; display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
          <strong style="font-size:0.82rem; color:#f8fafc;">📚 Todas as Habilidades Disponíveis (${filteredSkills.length})</strong>
          <input
            type="text"
            placeholder="🔍 Buscar habilidade..."
            value="${this.skillSearchQuery.replace(/"/g, '&quot;')}"
            oninput="window.PlayPetsController.skillSearchQuery = this.value; window.PlayPetsController.renderModal();"
            style="background:#0f172a; border:1px solid #334155; color:#f8fafc; padding:5px 10px; border-radius:6px; font-size:0.76rem; width:210px;"
          />
        </div>

        <div class="pet-catalog-skills-list">
          ${filteredSkills
            .map((sk) => {
              const isPinned = pinnedIds.includes(Number(sk.id));
              return `
                <div class="pet-catalog-skill-row ${isPinned ? 'pinned' : ''}">
                  <img src="${sk.iconUrl}" alt="${sk.namePtBr}" />
                  <div style="flex:1; min-width:0;">
                    <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                      <strong style="font-size:0.8rem; color:${isPinned ? '#4ade80' : '#f8fafc'};">#${sk.id} ${sk.namePtBr}</strong>
                      <span style="font-size:0.68rem; color:#38bdf8;">💧 ${sk.mpCost || 0} MP</span>
                      <span style="font-size:0.68rem; color:#fde047;">⏳ CD: ${sk.cooldownSeconds || 0}s</span>
                      <span style="font-size:0.68rem; color:#94a3b8;">📏 ${sk.castRange || 160}px</span>
                    </div>
                    <div style="font-size:0.71rem; color:#94a3b8; margin-top:2px;">${sk.descriptionPtBr || 'Habilidade de combate.'}</div>
                  </div>
                  <button
                    type="button"
                    class="pet-mini-btn ${isPinned ? 'danger' : 'primary'}"
                    onclick="window.PlayPetsController.togglePetSkill(${pet.id}, ${sk.id})"
                  >
                    ${isPinned ? '✓ Fixada (Remover)' : '📌 Fixar no Pet'}
                  </button>
                </div>
              `;
            })
            .join('')}
        </div>
      </div>
    `;
  }

  renderGenerateTabHtml() {
    const client = this.getClient();
    const tamableMonsters = Array.isArray(client?.availablePets) ? client.availablePets : [];
    const q = (this.generateSearchQuery || '').toLowerCase().trim();
    const filtered = tamableMonsters.filter((m) => {
      if (!q) return true;
      return `${m.id} ${m.namePtBr} ${m.raceCode} ${m.rarityTier}`.toLowerCase().includes(q);
    });

    return `
      <div class="pet-details-scroll">
        <div class="pet-skills-header-box" style="margin-bottom:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
            <div>
              <strong style="font-size:0.9rem; color:#fef08a;">🥚 Catálogo Procedural de Pets Capturáveis (${filtered.length})</strong>
              <div style="font-size:0.72rem; color:#94a3b8; margin-top:2px;">
                Exibe automaticamente todos os monstros ativos com <strong>"Pet Capturável = Sim"</strong>. Ao gerar, o Pet recebe <strong>Elemento Aleatório</strong>, <strong>1 ponto fixo</strong> em cada atributo base + <strong>76 pontos livres</strong> no Nv.1 (+4 por Level Up) e herda Raça, Raridade (F..SS) e Status Não-Derivados do monstro.
              </div>
            </div>
            <input
              type="text"
              placeholder="🔍 Filtrar por nome, raça ou rank..."
              value="${this.generateSearchQuery.replace(/"/g, '&quot;')}"
              oninput="window.PlayPetsController.generateSearchQuery = this.value; window.PlayPetsController.renderModal();"
              style="background:#0f172a; border:1px solid #334155; color:#f8fafc; padding:6px 10px; border-radius:6px; font-size:0.76rem; width:230px;"
            />
          </div>
        </div>

        <div class="pet-generate-grid">
          ${filtered
            .map((m) => {
              const cb = m.baseCombatAttributesJson || {};
              return `
                <div class="pet-generate-card">
                  <div class="pet-generate-card-top">
                    <div class="pet-roster-thumb-wrap" style="width:52px; height:52px;">
                      <img src="${m.thumbUrl}" alt="${m.namePtBr}" style="width:48px; height:48px; object-fit:contain;" />
                      <span class="pet-rank-pill rank-${(m.rarityTier || 'F').toLowerCase()}">${m.rarityTier || 'F'}</span>
                    </div>
                    <div style="flex:1; min-width:0;">
                      <strong style="font-size:0.84rem; color:#f8fafc; display:block;">#${m.id} ${m.namePtBr}</strong>
                      <div style="font-size:0.7rem; color:#94a3b8; margin-top:2px;">
                        🧬 ${m.raceCode} • ${m.combatStyle === 'RANGED' ? `🏹 Ranged (${m.attackRange}px)` : `⚔️ Melee (${m.attackRange}px)`} • ${m.damageType === 'MAGICAL' ? '🔮 Mágico' : '🗡️ Físico'}
                      </div>
                      <div style="font-size:0.68rem; color:#38bdf8; margin-top:2px;">
                        🏃 Mov: ${cb.BATTLE_MOVE_SPEED || 160} • ⚡ Aspd: ${cb.ATTACK_SPEED || 1.0}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    class="pet-confirm-stats-btn"
                    style="margin-top:8px; width:100%; padding:6px 10px; font-size:0.75rem;"
                    onclick="window.PlayPetsController.generatePetFromMonster(${m.id})"
                  >
                    ✨ Gerar Pet Procedural (Nv.1 • +76 Pts)
                  </button>
                </div>
              `;
            })
            .join('')}
        </div>
      </div>
    `;
  }

  injectStyles() {
    if (document.getElementById('playPetsSystemStyles')) return;
    const style = document.createElement('style');
    style.id = 'playPetsSystemStyles';
    style.textContent = `
      .pet-system-modal-dialog { width: min(96vw, 960px) !important; max-width: 960px !important; max-height: 90vh !important; display: flex; flex-direction: column; padding: 0 !important; overflow: hidden; }
      .pet-system-modal-layout { display: grid; grid-template-columns: 270px 1fr; flex: 1; min-height: 0; overflow: hidden; }
      @media (max-width: 760px) { .pet-system-modal-layout { grid-template-columns: 1fr; grid-template-rows: 175px 1fr; } }
      .pet-roster-sidebar { background: rgba(2, 6, 23, 0.75); border-right: 1px solid rgba(148, 163, 184, 0.18); display: flex; flex-direction: column; min-height: 0; }
      .pet-roster-header { padding: 10px 12px; font-size: 0.78rem; font-weight: 800; color: #cbd5e1; border-bottom: 1px solid rgba(148, 163, 184, 0.15); display: flex; justify-content: space-between; align-items: center; }
      .pet-roster-list { flex: 1; overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 6px; }
      .pet-roster-item { display: flex; gap: 8px; padding: 8px; border-radius: 8px; background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(148, 163, 184, 0.2); cursor: pointer; transition: all 0.15s ease; }
      .pet-roster-item.selected { border-color: #38bdf8; background: rgba(56, 189, 248, 0.14); }
      .pet-roster-item.disabled-pet { opacity: 0.68; border-color: #ef4444; }
      .pet-roster-thumb-wrap { position: relative; width: 46px; height: 46px; border-radius: 8px; background: #020617; border: 1px solid #334155; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
      .pet-roster-thumb-wrap img { width: 42px; height: 42px; object-fit: contain; }
      .pet-rank-pill { position: absolute; bottom: -4px; right: -4px; font-size: 0.62rem; font-weight: 900; padding: 1px 5px; border-radius: 4px; background: #334155; color: #fff; border: 1px solid rgba(255,255,255,0.25); }
      .pet-rank-pill.rank-ss { background: #e11d48; color: #fff; }
      .pet-rank-pill.rank-s { background: #d97706; color: #fff; }
      .pet-rank-pill.rank-a { background: #9333ea; color: #fff; }
      .pet-rank-pill.rank-b { background: #0284c7; color: #fff; }
      .pet-rank-pill.rank-c { background: #16a34a; color: #fff; }
      .pet-roster-meta { flex: 1; min-width: 0; }
      .pet-roster-name-row { display: flex; justify-content: space-between; align-items: center; gap: 4px; font-size: 0.8rem; color: #f8fafc; }
      .pet-badge-slot1 { font-size: 0.63rem; padding: 1px 6px; border-radius: 4px; background: rgba(234,179,8,0.2); color: #fde047; border: 1px solid #eab308; font-weight: 700; }
      .pet-badge-slot { font-size: 0.63rem; padding: 1px 6px; border-radius: 4px; background: rgba(56,189,248,0.2); color: #7dd3fc; border: 1px solid #38bdf8; font-weight: 700; }
      .pet-badge-reserve { font-size: 0.63rem; padding: 1px 6px; border-radius: 4px; background: rgba(148,163,184,0.15); color: #94a3b8; }
      .pet-badge-disabled { font-size: 0.62rem; padding: 1px 6px; border-radius: 4px; background: rgba(239,68,68,0.22); color: #fca5a5; border: 1px solid #ef4444; font-weight: 700; }
      .pet-unspent-pill { font-size: 0.63rem; padding: 1px 5px; border-radius: 99px; background: #22c55e; color: #022c22; font-weight: 900; }
      .pet-main-content { flex: 1; min-height: 0; overflow-y: auto; padding: 12px 14px; }
      .pet-tab-btn { background: rgba(15, 23, 42, 0.9); border: 1px solid #334155; color: #cbd5e1; padding: 5px 10px; border-radius: 6px; font-size: 0.74rem; font-weight: 700; cursor: pointer; }
      .pet-tab-btn.active { background: #0284c7; border-color: #38bdf8; color: #fff; }
      .pet-disabled-alert { background: rgba(239, 68, 68, 0.16); border: 1.5px solid #ef4444; color: #fecaca; padding: 8px 12px; border-radius: 8px; font-size: 0.76rem; margin-bottom: 10px; }
      .pet-hero-banner { display: flex; gap: 12px; align-items: center; background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 10px; padding: 10px 12px; margin-bottom: 10px; }
      .pet-hero-avatar { position: relative; width: 64px; height: 64px; background: #020617; border: 1.5px solid #38bdf8; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
      .pet-hero-avatar img { width: 58px; height: 58px; object-fit: contain; }
      .pet-hero-info { flex: 1; min-width: 0; }
      .pet-xp-row { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
      .pet-xp-bar-track { flex: 1; height: 7px; background: #020617; border-radius: 99px; overflow: hidden; border: 1px solid #334155; }
      .pet-xp-bar-fill { height: 100%; background: linear-gradient(90deg, #0284c7, #38bdf8); }
      .pet-slot-selector-box { background: rgba(15, 23, 42, 0.65); border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 8px; padding: 8px 10px; margin-bottom: 10px; }
      .pet-slot-btn { background: #0f172a; border: 1px solid #334155; color: #cbd5e1; padding: 5px 10px; border-radius: 6px; font-size: 0.73rem; font-weight: 700; cursor: pointer; }
      .pet-slot-btn.active-slot1 { background: rgba(234,179,8,0.22); border-color: #eab308; color: #fde047; }
      .pet-slot-btn.active { background: rgba(56,189,248,0.22); border-color: #38bdf8; color: #7dd3fc; }
      .pet-slot-btn.active-reserve { background: rgba(148,163,184,0.22); border-color: #94a3b8; color: #f8fafc; }
      .pet-stats-grid-layout { display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 10px; }
      @media (max-width: 760px) { .pet-stats-grid-layout { grid-template-columns: 1fr; } }
      .pet-base-attrs-panel, .pet-combat-stats-panel { background: rgba(15, 23, 42, 0.78); border: 1px solid rgba(148, 163, 184, 0.18); border-radius: 8px; padding: 10px; }
      .pet-points-avail-badge { font-size: 0.74rem; padding: 2px 8px; border-radius: 99px; background: rgba(34, 197, 94, 0.2); color: #86efac; border: 1px solid #22c55e; }
      .pet-attr-rows { display: flex; flex-direction: column; gap: 6px; }
      .pet-attr-row { display: flex; align-items: center; justify-content: space-between; background: rgba(2, 6, 23, 0.65); padding: 5px 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05); }
      .pet-alloc-btn { background: #1e293b; border: 1px solid #475569; color: #e2e8f0; padding: 3px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 700; cursor: pointer; }
      .pet-alloc-btn.plus { background: rgba(2, 132, 199, 0.3); border-color: #38bdf8; color: #7dd3fc; }
      .pet-alloc-btn:disabled { opacity: 0.35; cursor: not-allowed; }
      .pet-confirm-stats-btn { background: linear-gradient(135deg, #16a34a, #22c55e); border: 1px solid #4ade80; color: #022c22; font-weight: 900; padding: 7px 14px; border-radius: 6px; cursor: pointer; flex: 1; }
      .pet-combat-stats-list { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
      .pet-cstat-item { background: rgba(2, 6, 23, 0.6); padding: 5px 8px; border-radius: 6px; display: flex; flex-direction: column; font-size: 0.7rem; color: #94a3b8; }
      .pet-cstat-item strong { font-size: 0.82rem; margin-top: 1px; }
      .pet-pinned-skills-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 8px; }
      @media (max-width: 680px) { .pet-pinned-skills-grid { grid-template-columns: 1fr; } }
      .pet-skill-slot-card { display: flex; align-items: center; gap: 8px; background: rgba(15, 23, 42, 0.9); border: 1.5px solid #38bdf8; border-radius: 8px; padding: 8px; }
      .pet-skill-slot-card.empty { flex-direction: column; justify-content: center; border-style: dashed; border-color: #475569; color: #64748b; font-size: 0.74rem; padding: 12px; }
      .pet-skill-slot-card img, .pet-catalog-skill-row img { width: 38px; height: 38px; border-radius: 6px; border: 1px solid #38bdf8; background: #020617; object-fit: contain; flex-shrink: 0; }
      .pet-catalog-skills-list { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
      .pet-catalog-skill-row { display: flex; align-items: center; gap: 10px; background: rgba(15, 23, 42, 0.75); border: 1px solid rgba(148, 163, 184, 0.18); border-radius: 8px; padding: 7px 10px; }
      .pet-catalog-skill-row.pinned { border-color: #22c55e; background: rgba(34, 197, 94, 0.1); }
      .pet-mini-btn { background: #1e293b; border: 1px solid #475569; color: #e2e8f0; padding: 4px 8px; border-radius: 5px; font-size: 0.71rem; font-weight: 700; cursor: pointer; white-space: nowrap; }
      .pet-mini-btn.primary { background: #0284c7; border-color: #38bdf8; color: #fff; }
      .pet-mini-btn.danger { background: rgba(239,68,68,0.2); border-color: #ef4444; color: #fca5a5; }
      .pet-generate-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 8px; }
      .pet-generate-card { background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(148, 163, 184, 0.22); border-radius: 8px; padding: 9px; display: flex; flex-direction: column; justify-content: space-between; }
      .pet-generate-card-top { display: flex; gap: 8px; align-items: center; }
    `;
    document.head.appendChild(style);
  }
}

window.PlayPetsController = new PlayPetsController();
