/**
 * @file apps/server/public/play/js/PlayPetsController.js
 * @module @etheria/client/pets
 * @description Controlador Cliente do Sistema Procedural de Pets na Rota `/play`:
 *   - Seguidor 2.5D com Física de Guia/Distanciamento (Tether Leash): O Pet do Slot 1 caminha
 *     atrás/ao lado do jogador mantendo distância segura (66px-74px) sem jamais sobrepor o herói.
 *   - Modal Minimalista e Compacto (Mobile Portrait, Mobile Landscape e Desktop):
 *     1. Aba Status: Barra de seleção rápida, Slots 1..3/Reserva em pílulas, distribuição de 76+4/lv pontos e grade compacta de combate.
 *     2. Aba Skills (Máx. 3): 3 slots compactos no topo + lista enxuta com busca instantânea.
 *     3. Aba Capturáveis: Grade compacta de geração procedural com Elemento Aleatório e Raridade.
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
    this.lastPetId = null;
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
  // 1. SEGUIDOR 2.5D NO MAPA (FÍSICA DE GUIA / TETHER SEM SOBREPOSIÇÃO)
  // ============================================================================

  updateFollowerPhysics(client, dt) {
    const pet = this.getPrimaryFollowerPet();
    if (!pet || !client || !client.currentMap) {
      this.followerX = null;
      this.followerY = null;
      this.followerIsMoving = false;
      return;
    }

    const px = Number(client.playerX) || 500;
    const py = Number(client.playerY) || 500;

    // Enquanto o jogador estiver voando na montaria, o Pet embarca colado ao jogador em idle
    if (client.isFlying || (Number(client.flightAltitudeCurrent) || 0) > 0.5) {
      this.followerX = px;
      this.followerY = py;
      this.followerDir = client.playerDir || 0;
      this.followerIsMoving = false;
      this.lastMapId = client.currentMap.id;
      this.lastPetId = pet.id;
      return;
    }

    // Inicializa ou reposiciona se trocou de mapa/pet ou ficou muito longe (> 380px)
    if (
      this.followerX === null ||
      this.followerY === null ||
      this.lastMapId !== client.currentMap.id ||
      this.lastPetId !== pet.id ||
      Math.hypot(px - this.followerX, py - this.followerY) > 380
    ) {
      this.followerX = px - 74;
      this.followerY = py + 16;
      this.followerDir = client.playerDir || 0;
      this.followerIsMoving = false;
      this.lastMapId = client.currentMap.id;
      this.lastPetId = pet.id;
      return;
    }

    const dx = px - this.followerX;
    const dy = py - this.followerY;
    const dist = Math.hypot(dx, dy);

    const minSafeDist = 58; // Se o jogador caminhar para cima do pet, o pet dá espaço
    const stopFollowDist = 68; // Distância ideal em que o pet para atrás do jogador
    const startFollowDist = 74; // Distância em que a guia puxa o pet para caminhar

    if (dist > startFollowDist) {
      // Caminha na direção do jogador, mas para exatamente a `stopFollowDist` (68px) dele
      this.followerIsMoving = true;
      this.followerDir = client.calculateDirection8(dx, dy);
      const excess = dist - stopFollowDist;
      const speed = (client.baseMoveSpeed || 168) * (dist > 130 ? 1.28 : 1.04);
      const step = Math.min(excess, speed * dt);
      this.followerX += (dx / dist) * step;
      this.followerY += (dy / dist) * step;
    } else if (dist < minSafeDist) {
      // Jogador encostou no pet: afasta suavemente para o lado/trás mantendo 62px de separação
      this.followerIsMoving = true;
      const pushAngle = dist > 2 ? Math.atan2(-dy, -dx) + 0.35 : (Math.PI * 0.85);
      const pushStep = Math.min(minSafeDist - dist + 4, (client.baseMoveSpeed || 168) * 0.95 * dt);
      this.followerX += Math.cos(pushAngle) * pushStep;
      this.followerY += Math.sin(pushAngle) * pushStep;
      this.followerDir = client.calculateDirection8(px - this.followerX, py - this.followerY);
    } else {
      this.followerIsMoving = false;
      if (dist > 10) {
        this.followerDir = client.calculateDirection8(dx, dy);
      }
    }
  }

  populateRenderQueue(client, renderQueue) {
    if (client?.isFlying || (Number(client?.flightAltitudeCurrent) || 0) > 0.5) return;
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
      0.56,
      false,
      pet.shadowOffsetX || 0,
      pet.shadowOffsetY || 0
    );

    const elStyle = client.getElementStyle ? client.getElementStyle(pet.elementCode) : { icon: '🐾' };
    const labelY = this.followerY - 50 + Math.round(gOffset * 0.56);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillStyle = '#7dd3fc';
    ctx.fillText(`${elStyle.icon || '🐾'} ${pet.nickname} [${pet.rarityTier || 'F'}]`, this.followerX, labelY);
    ctx.restore();
  }

  // ============================================================================
  // 2. MODAL COMPACTO & MINIMALISTA (MOBILE PORTRAIT, LANDSCAPE & DESKTOP)
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
        alert('Máximo de 3 habilidades por Pet! Remova uma antes de fixar outra.');
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
    const nextName = prompt('Novo nome do Pet (2 a 24 caracteres):', currentName || '');
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
    const pinnedCount = Array.isArray(selectedPet?.skillIdsJson) ? selectedPet.skillIdsJson.length : 0;

    modal.innerHTML = `
      <div class="hud-modal-dialog pm-modal">
        <!-- Topo Ultra-Compacto -->
        <div class="pm-topbar">
          <div class="pm-title">
            <span>🐾 Pets</span>
            <span class="pm-count-badge">${equippedCount}/3</span>
          </div>
          <div class="pm-tabs">
            <button type="button" class="pm-tab ${this.activeTab === 'STATS' ? 'active' : ''}" onclick="window.PlayPetsController.switchTab('STATS')">📊 Status</button>
            <button type="button" class="pm-tab ${this.activeTab === 'SKILLS' ? 'active' : ''}" onclick="window.PlayPetsController.switchTab('SKILLS')">⚡ Skills (${pinnedCount}/3)</button>
            <button type="button" class="pm-tab ${this.activeTab === 'GENERATE' ? 'active' : ''}" onclick="window.PlayPetsController.switchTab('GENERATE')">🥚 Capturáveis</button>
          </div>
          <button type="button" class="pm-close" onclick="window.PlayPetsController.closeModal()">✕</button>
        </div>

        <!-- Barra Horizontal de Seleção Rápida de Pets (Compacta em Mobile e Desktop) -->
        <div class="pm-pet-strip">
          ${allPets.map((p) => this.renderPetChipHtml(p, selectedPet?.id === p.id)).join('')}
          <button type="button" class="pm-add-chip ${this.activeTab === 'GENERATE' ? 'active' : ''}" onclick="window.PlayPetsController.switchTab('GENERATE')">
            <span>＋</span>
            <small>Novo Pet</small>
          </button>
        </div>

        <!-- Corpo Principal -->
        <div class="pm-body">
          ${this.renderActiveTabContent(selectedPet)}
        </div>
      </div>
    `;
    if (window.PlayUiLayoutApplier) {
      window.PlayUiLayoutApplier.applyAll();
    }
  }

  renderPetChipHtml(p, isSelected) {
    const client = this.getClient();
    const elStyle = client?.getElementStyle ? client.getElementStyle(p.elementCode) : { icon: '⚪' };
    const isDisabled = Boolean(p.isTemporarilyDisabled);
    const slotTag = isDisabled ? '⚠️' : p.deploySlot === 1 ? '⭐1' : p.deploySlot ? `S${p.deploySlot}` : '';

    return `
      <button type="button" class="pm-pet-chip ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}" onclick="window.PlayPetsController.selectPet(${p.id})">
        <div class="pm-chip-avatar">
          <img src="${p.thumbUrl}" alt="${p.nickname}" onerror="this.src='/play/assets/hud/menu_pets.png'" />
          <span class="pm-rank rank-${(p.rarityTier || 'F').toLowerCase()}">${p.rarityTier || 'F'}</span>
          ${slotTag ? `<span class="pm-chip-slot">${slotTag}</span>` : ''}
        </div>
        <div class="pm-chip-info">
          <div class="pm-chip-name">${p.nickname}</div>
          <div class="pm-chip-sub">
            <span>${elStyle.icon} Nv.${p.level}</span>
            ${p.unspentStatPoints > 0 ? `<span class="pm-dot-pts">+${p.unspentStatPoints}</span>` : ''}
          </div>
        </div>
      </button>
    `;
  }

  renderActiveTabContent(pet) {
    if (this.activeTab === 'GENERATE') {
      return this.renderGenerateTabHtml();
    }
    if (!pet) {
      return `
        <div class="pm-empty">
          <span>🥚 Nenhum Pet selecionado.</span>
          <button type="button" class="pm-btn-primary" onclick="window.PlayPetsController.switchTab('GENERATE')">Gerar Primeiro Pet</button>
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
    const elStyle = client?.getElementStyle ? client.getElementStyle(pet.elementCode) : { icon: '⚪', color: '#cbd5e1', bg: 'rgba(148,163,184,0.18)' };
    const isDisabled = Boolean(pet.isTemporarilyDisabled);
    const pendingTotal = this.getTotalPendingPoints();
    const remainingPoints = Math.max(0, Number(pet.unspentStatPoints || 0) - pendingTotal);
    const fixed = pet.fixedBaseStats || { VIT: 1, STR: 1, INT: 1, WIS: 1, AGI: 1, DEX: 1 };
    const dist = pet.distributedStatsJson || { VIT: 0, STR: 0, INT: 0, WIS: 0, AGI: 0, DEX: 0 };
    const cs = pet.computedCombatStats || {};
    const rp = pet.rarityProfile || { hp: 1, atk: 1, def: 1 };

    const attrs = [
      { key: 'VIT', name: 'VIT', hint: 'HP/DEF', color: '#4ade80' },
      { key: 'STR', name: 'STR', hint: 'ATK Fís', color: '#f87171' },
      { key: 'INT', name: 'INT', hint: 'MP/Mág', color: '#38bdf8' },
      { key: 'WIS', name: 'WIS', hint: 'DEF Mág', color: '#c084fc' },
      { key: 'AGI', name: 'AGI', hint: 'Vel/Esq', color: '#fde047' },
      { key: 'DEX', name: 'DEX', hint: 'Crit/Prec', color: '#fb923c' },
    ];

    return `
      ${isDisabled ? `<div class="pm-alert-disabled">⚠️ <strong>Inativado Temporariamente:</strong> Monstro base desativado no servidor.</div>` : ''}

      <!-- Cabeçalho Compacto do Pet + Pílulas de Slot -->
      <div class="pm-hero">
        <div class="pm-hero-left">
          <div class="pm-hero-avatar">
            <img src="${pet.thumbUrl}" alt="${pet.nickname}" />
            <span class="pm-rank rank-${(pet.rarityTier || 'F').toLowerCase()}">${pet.rarityTier || 'F'}</span>
          </div>
          <div class="pm-hero-meta">
            <div class="pm-hero-title-row">
              <strong>${pet.nickname}</strong>
              <button type="button" class="pm-icon-btn" title="Renomear" onclick="window.PlayPetsController.promptRenamePet(${pet.id}, '${pet.nickname.replace(/'/g, "\\'")}')">✏️</button>
              <span class="pm-elem-pill" style="background:${elStyle.bg}; color:${elStyle.color};">${elStyle.icon} ${pet.elementNamePtBr || pet.elementCode}</span>
            </div>
            <div class="pm-hero-tags">
              <span>${pet.raceNamePtBr || pet.raceCode}</span> •
              <span>${pet.combatStyle === 'RANGED' ? `🏹 ${pet.attackRange}px` : `⚔️ ${pet.attackRange}px`}</span> •
              <span>${pet.damageType === 'MAGICAL' ? '🔮 Mág' : '🗡️ Fís'}</span> •
              <span style="color:#fde047;">👑 ${rp.hp}x Status</span>
            </div>
            <div class="pm-xp-line">
              <span class="pm-lv-tag">Nv.${pet.level}</span>
              <div class="pm-xp-track"><div class="pm-xp-fill" style="width:${pet.xpPct || 0}%;"></div></div>
              <span class="pm-xp-txt">${pet.xpPct || 0}%</span>
            </div>
          </div>
        </div>

        <!-- Slots 1, 2, 3 e Reserva em linha compacta -->
        <div class="pm-slots-bar">
          <button type="button" class="pm-slot-pill ${pet.deploySlot === 1 ? 's1' : ''}" ${isDisabled ? 'disabled' : ''} onclick="window.PlayPetsController.setPetSlot(${pet.id}, 1)" title="Acompanha no mapa e entra em Equipe/Solo">⭐ Slot 1 (Mapa)</button>
          <button type="button" class="pm-slot-pill ${pet.deploySlot === 2 ? 's2' : ''}" ${isDisabled ? 'disabled' : ''} onclick="window.PlayPetsController.setPetSlot(${pet.id}, 2)" title="Combate Solo">⚔️ Slot 2</button>
          <button type="button" class="pm-slot-pill ${pet.deploySlot === 3 ? 's2' : ''}" ${isDisabled ? 'disabled' : ''} onclick="window.PlayPetsController.setPetSlot(${pet.id}, 3)" title="Combate Solo">⚔️ Slot 3</button>
          <button type="button" class="pm-slot-pill ${pet.deploySlot === null ? 'res' : ''}" onclick="window.PlayPetsController.setPetSlot(${pet.id}, null)">📦 Reserva</button>
        </div>
      </div>

      <!-- Grade Responsiva: Atributos Base (Esquerda) + Status de Combate (Direita) -->
      <div class="pm-stats-split">
        <div class="pm-card">
          <div class="pm-card-head">
            <span>Atributos Base</span>
            <div style="display:flex; align-items:center; gap:6px;">
              <span class="pm-pts-badge">Livres: <b>${remainingPoints}</b></span>
              ${
                pendingTotal > 0
                  ? `<button type="button" class="pm-btn-save" onclick="window.PlayPetsController.confirmStatDistribution()">Salvar +${pendingTotal}</button>
                     <button type="button" class="pm-btn-clear" onclick="window.PlayPetsController.resetPendingAllocations(); window.PlayPetsController.renderModal();">↺</button>`
                  : ''
              }
            </div>
          </div>
          <div class="pm-attr-list">
            ${attrs
              .map((a) => {
                const baseVal = Number(fixed[a.key] ?? 1) + Number(dist[a.key] ?? 0);
                const pendVal = Number(this.pendingAllocations[a.key] ?? 0);
                return `
                  <div class="pm-attr-item">
                    <div class="pm-attr-lbl">
                      <b style="color:${a.color};">${a.name}</b>
                      <small>${a.hint}</small>
                    </div>
                    <div class="pm-attr-val">
                      <span>${baseVal + pendVal}</span>
                      ${pendVal > 0 ? `<em class="pm-pend">+${pendVal}</em>` : ''}
                    </div>
                    <div class="pm-attr-btns">
                      <button type="button" ${pendVal <= 0 ? 'disabled' : ''} onclick="window.PlayPetsController.adjustPendingStat('${a.key}', -1)">-</button>
                      <button type="button" class="p" ${remainingPoints < 1 ? 'disabled' : ''} onclick="window.PlayPetsController.adjustPendingStat('${a.key}', 1)">+1</button>
                      <button type="button" class="p" ${remainingPoints < 5 ? 'disabled' : ''} onclick="window.PlayPetsController.adjustPendingStat('${a.key}', 5)">+5</button>
                      <button type="button" class="p" ${remainingPoints < 10 ? 'disabled' : ''} onclick="window.PlayPetsController.adjustPendingStat('${a.key}', 10)">+10</button>
                    </div>
                  </div>
                `;
              })
              .join('')}
          </div>
        </div>

        <div class="pm-card">
          <div class="pm-card-head">
            <span>Status de Combate</span>
            <small style="color:#fde047;">Rank ${pet.rarityTier} (${rp.hp}x)</small>
          </div>
          <div class="pm-cstats-grid">
            <div class="pm-cstat"><span>❤️ HP</span><b style="color:#4ade80;">${cs.maxHp || 100}</b></div>
            <div class="pm-cstat"><span>💧 MP</span><b style="color:#38bdf8;">${cs.maxMp || 50}</b></div>
            <div class="pm-cstat"><span>🗡️ ATK Fís</span><b style="color:#f87171;">${cs.physAtk || 10}</b></div>
            <div class="pm-cstat"><span>🔮 ATK Mág</span><b style="color:#c084fc;">${cs.magAtk || 10}</b></div>
            <div class="pm-cstat"><span>🛡️ DEF Fís</span><b style="color:#fbbf24;">${cs.def || 8}</b></div>
            <div class="pm-cstat"><span>✨ DEF Mág</span><b style="color:#a78bfa;">${cs.magDef || 8}</b></div>
            <div class="pm-cstat"><span>🏃 Vel. Mov</span><b style="color:#38bdf8;">${cs.battleMoveSpeed || 160}</b></div>
            <div class="pm-cstat"><span>⚡ Vel. Atq</span><b style="color:#fde047;">${Number(cs.attackSpeed || 1).toFixed(2)}/s</b></div>
            <div class="pm-cstat"><span>💥 Crítico</span><b style="color:#fb7185;">${cs.critRatePct ?? 5}%</b></div>
            <div class="pm-cstat"><span>🔥 Dano Crit</span><b style="color:#f43f5e;">${cs.critDmgPct ?? 150}%</b></div>
            <div class="pm-cstat"><span>🎯 Precisão</span><b style="color:#86efac;">${cs.physAccuracy ?? 95}%</b></div>
            <div class="pm-cstat"><span>💨 Esquiva</span><b style="color:#67e8f9;">${cs.physEvasion ?? 5}%</b></div>
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
    const filtered = allSkills.filter((sk) => !q || `${sk.id} ${sk.namePtBr} ${sk.descriptionPtBr || ''}`.toLowerCase().includes(q));

    return `
      <!-- 3 Slots Fixados Compactos -->
      <div class="pm-pinned-bar">
        ${[0, 1, 2]
          .map((idx) => {
            const sk = pinnedSkills[idx];
            if (!sk) {
              return `<div class="pm-pin-slot empty"><span>Slot #${idx + 1} Livre</span></div>`;
            }
            return `
              <div class="pm-pin-slot">
                <img src="${sk.iconUrl}" alt="${sk.namePtBr}" />
                <div class="pm-pin-meta">
                  <b>${sk.namePtBr}</b>
                  <small>${sk.mpCost || 0} MP • ${sk.cooldownSeconds || 0}s</small>
                </div>
                <button type="button" class="pm-unpin-btn" onclick="window.PlayPetsController.togglePetSkill(${pet.id}, ${sk.id})">✕</button>
              </div>
            `;
          })
          .join('')}
      </div>

      <div class="pm-search-bar">
        <span>📚 Habilidades Livres (${filtered.length})</span>
        <input
          type="text"
          placeholder="🔍 Buscar skill..."
          value="${this.skillSearchQuery.replace(/"/g, '&quot;')}"
          oninput="window.PlayPetsController.skillSearchQuery = this.value; window.PlayPetsController.renderModal();"
        />
      </div>

      <div class="pm-skills-list">
        ${filtered
          .map((sk) => {
            const isPinned = pinnedIds.includes(Number(sk.id));
            return `
              <div class="pm-skill-row ${isPinned ? 'pinned' : ''}">
                <img src="${sk.iconUrl}" alt="${sk.namePtBr}" />
                <div class="pm-skill-info">
                  <div class="pm-skill-top">
                    <b>${sk.namePtBr}</b>
                    <span>💧${sk.mpCost || 0}</span>
                    <span>⏳${sk.cooldownSeconds || 0}s</span>
                  </div>
                  <div class="pm-skill-desc">${sk.descriptionPtBr || 'Habilidade de combate.'}</div>
                </div>
                <button type="button" class="pm-skill-btn ${isPinned ? 'rem' : 'add'}" onclick="window.PlayPetsController.togglePetSkill(${pet.id}, ${sk.id})">
                  ${isPinned ? 'Remover' : 'Fixar'}
                </button>
              </div>
            `;
          })
          .join('')}
      </div>
    `;
  }

  renderGenerateTabHtml() {
    const client = this.getClient();
    const tamable = Array.isArray(client?.availablePets) ? client.availablePets : [];
    const q = (this.generateSearchQuery || '').toLowerCase().trim();
    const filtered = tamable.filter((m) => !q || `${m.id} ${m.namePtBr} ${m.raceCode} ${m.rarityTier}`.toLowerCase().includes(q));

    return `
      <div class="pm-search-bar" style="margin-top:0;">
        <span>🥚 Monstros Capturáveis (${filtered.length})</span>
        <input
          type="text"
          placeholder="🔍 Nome, raça ou rank..."
          value="${this.generateSearchQuery.replace(/"/g, '&quot;')}"
          oninput="window.PlayPetsController.generateSearchQuery = this.value; window.PlayPetsController.renderModal();"
        />
      </div>

      <div class="pm-gen-grid">
        ${filtered
          .map(
            (m) => `
            <div class="pm-gen-card">
              <div class="pm-gen-top">
                <div class="pm-chip-avatar">
                  <img src="${m.thumbUrl}" alt="${m.namePtBr}" />
                  <span class="pm-rank rank-${(m.rarityTier || 'F').toLowerCase()}">${m.rarityTier || 'F'}</span>
                </div>
                <div class="pm-gen-meta">
                  <b>${m.namePtBr}</b>
                  <small>${m.raceCode} • ${m.combatStyle === 'RANGED' ? '🏹 Ranged' : '⚔️ Melee'} • ${m.damageType === 'MAGICAL' ? '🔮' : '🗡️'}</small>
                </div>
              </div>
              <button type="button" class="pm-gen-btn" onclick="window.PlayPetsController.generatePetFromMonster(${m.id})">✨ Gerar Pet (+76 pts)</button>
            </div>
          `
          )
          .join('')}
      </div>
    `;
  }

  injectStyles() {
    if (document.getElementById('playPetsSystemStyles')) return;
    const style = document.createElement('style');
    style.id = 'playPetsSystemStyles';
    style.textContent = `
      .pm-modal { width: 86%; max-width: 560px; max-height: 88dvh; background: rgba(9, 14, 28, 0.97); border: 1.5px solid rgba(56, 189, 248, 0.38); border-radius: 14px; box-shadow: 0 18px 48px rgba(0,0,0,0.85); display: flex; flex-direction: column; overflow: hidden; color: #f8fafc; animation: none !important; }
      .pm-topbar { display: flex; align-items: center; justify-content: space-between; gap: 6px; padding: 8px 12px; background: rgba(2, 6, 23, 0.9); border-bottom: 1px solid rgba(148, 163, 184, 0.16); }
      .pm-title { display: flex; align-items: center; gap: 6px; font-weight: 800; font-size: 0.88rem; color: #fde047; white-space: nowrap; }
      .pm-count-badge { font-size: 0.68rem; padding: 1px 6px; border-radius: 99px; background: rgba(56, 189, 248, 0.2); color: #7dd3fc; border: 1px solid rgba(56, 189, 248, 0.4); }
      .pm-tabs { display: flex; gap: 4px; background: #020617; padding: 3px; border-radius: 8px; border: 1px solid #1e293b; }
      .pm-tab { background: transparent; border: none; color: #94a3b8; padding: 4px 9px; border-radius: 6px; font-size: 0.72rem; font-weight: 700; cursor: pointer; white-space: nowrap; transition: all 0.15s; }
      .pm-tab.active { background: #0284c7; color: #fff; }
      .pm-close { background: rgba(239, 68, 68, 0.18); border: 1px solid rgba(239, 68, 68, 0.4); color: #fca5a5; width: 26px; height: 26px; border-radius: 6px; cursor: pointer; font-weight: 800; font-size: 0.78rem; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
      .pm-pet-strip { display: flex; align-items: center; gap: 6px; padding: 7px 10px; background: rgba(2, 6, 23, 0.6); border-bottom: 1px solid rgba(148, 163, 184, 0.14); overflow-x: auto; scrollbar-width: thin; flex-shrink: 0; }
      .pm-pet-chip { display: flex; align-items: center; gap: 7px; padding: 4px 8px 4px 5px; border-radius: 9px; background: rgba(15, 23, 42, 0.9); border: 1px solid rgba(148, 163, 184, 0.22); color: #e2e8f0; cursor: pointer; flex-shrink: 0; text-align: left; }
      .pm-pet-chip.selected { border-color: #38bdf8; background: rgba(14, 165, 233, 0.18); box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.3); }
      .pm-pet-chip.disabled { opacity: 0.6; border-color: #ef4444; }
      .pm-chip-avatar { position: relative; width: 34px; height: 34px; border-radius: 7px; background: #020617; border: 1px solid #334155; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
      .pm-chip-avatar img { width: 30px; height: 30px; object-fit: contain; }
      .pm-rank { position: absolute; bottom: -3px; right: -3px; font-size: 0.54rem; font-weight: 900; padding: 0 4px; border-radius: 3px; background: #334155; color: #fff; line-height: 1.25; }
      .pm-rank.rank-ss { background: #e11d48; } .pm-rank.rank-s { background: #d97706; } .pm-rank.rank-a { background: #9333ea; } .pm-rank.rank-b { background: #0284c7; } .pm-rank.rank-c { background: #16a34a; }
      .pm-chip-slot { position: absolute; top: -4px; left: -4px; font-size: 0.52rem; font-weight: 900; padding: 0 3px; border-radius: 3px; background: #eab308; color: #020617; }
      .pm-chip-info { display: flex; flex-direction: column; min-width: 0; }
      .pm-chip-name { font-size: 0.72rem; font-weight: 800; color: #f8fafc; max-width: 84px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .pm-chip-sub { display: flex; align-items: center; gap: 4px; font-size: 0.63rem; color: #94a3b8; }
      .pm-dot-pts { background: #22c55e; color: #022c22; font-weight: 900; padding: 0 4px; border-radius: 99px; font-size: 0.58rem; }
      .pm-add-chip { display: flex; align-items: center; gap: 4px; padding: 6px 10px; border-radius: 9px; background: rgba(56, 189, 248, 0.1); border: 1px dashed rgba(56, 189, 248, 0.45); color: #7dd3fc; font-size: 0.72rem; font-weight: 700; cursor: pointer; flex-shrink: 0; }
      .pm-body { flex: 1; min-height: 0; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 8px; }
      .pm-alert-disabled { background: rgba(239, 68, 68, 0.16); border: 1px solid #ef4444; color: #fecaca; padding: 6px 10px; border-radius: 7px; font-size: 0.72rem; }
      .pm-hero { background: rgba(15, 23, 42, 0.75); border: 1px solid rgba(148, 163, 184, 0.18); border-radius: 10px; padding: 8px 10px; display: flex; flex-direction: column; gap: 7px; }
      .pm-hero-left { display: flex; align-items: center; gap: 10px; }
      .pm-hero-avatar { position: relative; width: 46px; height: 46px; border-radius: 9px; background: #020617; border: 1px solid #38bdf8; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
      .pm-hero-avatar img { width: 42px; height: 42px; object-fit: contain; }
      .pm-hero-meta { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
      .pm-hero-title-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
      .pm-hero-title-row strong { font-size: 0.88rem; color: #fef08a; }
      .pm-icon-btn { background: transparent; border: none; cursor: pointer; font-size: 0.74rem; padding: 0 2px; }
      .pm-elem-pill { font-size: 0.65rem; padding: 1px 6px; border-radius: 99px; font-weight: 700; }
      .pm-hero-tags { font-size: 0.68rem; color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .pm-xp-line { display: flex; align-items: center; gap: 6px; margin-top: 1px; }
      .pm-lv-tag { font-size: 0.68rem; font-weight: 800; color: #38bdf8; }
      .pm-xp-track { flex: 1; height: 5px; background: #020617; border-radius: 99px; overflow: hidden; border: 1px solid #1e293b; }
      .pm-xp-fill { height: 100%; background: linear-gradient(90deg, #0284c7, #38bdf8); }
      .pm-xp-txt { font-size: 0.63rem; color: #64748b; }
      .pm-slots-bar { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; }
      .pm-slot-pill { background: #020617; border: 1px solid #334155; color: #94a3b8; padding: 4px 6px; border-radius: 6px; font-size: 0.68rem; font-weight: 700; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .pm-slot-pill.s1 { background: rgba(234, 179, 8, 0.2); border-color: #eab308; color: #fde047; }
      .pm-slot-pill.s2 { background: rgba(56, 189, 248, 0.2); border-color: #38bdf8; color: #7dd3fc; }
      .pm-slot-pill.res { background: rgba(148, 163, 184, 0.2); border-color: #94a3b8; color: #f8fafc; }
      .pm-stats-split { display: grid; grid-template-columns: 1.08fr 0.92fr; gap: 8px; }
      @media (max-width: 640px) { .pm-stats-split { grid-template-columns: 1fr; } .pm-topbar { flex-wrap: wrap; } }
      .pm-card { background: rgba(15, 23, 42, 0.72); border: 1px solid rgba(148, 163, 184, 0.16); border-radius: 10px; padding: 8px; display: flex; flex-direction: column; gap: 6px; }
      .pm-card-head { display: flex; align-items: center; justify-content: space-between; font-size: 0.75rem; font-weight: 800; color: #e2e8f0; }
      .pm-pts-badge { font-size: 0.68rem; padding: 1px 7px; border-radius: 99px; background: rgba(34, 197, 94, 0.18); color: #86efac; border: 1px solid rgba(34, 197, 94, 0.45); }
      .pm-btn-save { background: #22c55e; border: none; color: #022c22; font-weight: 900; font-size: 0.68rem; padding: 2px 8px; border-radius: 5px; cursor: pointer; }
      .pm-btn-clear { background: #1e293b; border: 1px solid #475569; color: #cbd5e1; font-size: 0.68rem; padding: 1px 6px; border-radius: 5px; cursor: pointer; }
      .pm-attr-list { display: flex; flex-direction: column; gap: 4px; }
      .pm-attr-item { display: flex; align-items: center; justify-content: space-between; gap: 6px; background: rgba(2, 6, 23, 0.65); padding: 4px 7px; border-radius: 6px; }
      .pm-attr-lbl { display: flex; align-items: baseline; gap: 5px; min-width: 78px; }
      .pm-attr-lbl b { font-size: 0.74rem; }
      .pm-attr-lbl small { font-size: 0.62rem; color: #64748b; }
      .pm-attr-val { font-size: 0.78rem; font-weight: 800; color: #f8fafc; min-width: 44px; text-align: right; }
      .pm-pend { font-style: normal; color: #4ade80; font-size: 0.68rem; margin-left: 2px; }
      .pm-attr-btns { display: flex; gap: 3px; }
      .pm-attr-btns button { background: #1e293b; border: 1px solid #334155; color: #cbd5e1; padding: 2px 6px; border-radius: 4px; font-size: 0.66rem; font-weight: 800; cursor: pointer; }
      .pm-attr-btns button.p { background: rgba(2, 132, 199, 0.28); border-color: #0284c7; color: #7dd3fc; }
      .pm-attr-btns button:disabled { opacity: 0.3; cursor: not-allowed; }
      .pm-cstats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
      .pm-cstat { background: rgba(2, 6, 23, 0.6); padding: 4px 6px; border-radius: 6px; display: flex; flex-direction: column; font-size: 0.62rem; color: #94a3b8; }
      .pm-cstat b { font-size: 0.75rem; margin-top: 1px; }
      .pm-pinned-bar { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
      @media (max-width: 540px) { .pm-pinned-bar { grid-template-columns: 1fr; } }
      .pm-pin-slot { display: flex; align-items: center; gap: 6px; background: rgba(15, 23, 42, 0.85); border: 1px solid #38bdf8; border-radius: 8px; padding: 5px 7px; }
      .pm-pin-slot.empty { justify-content: center; border-style: dashed; border-color: #334155; color: #64748b; font-size: 0.68rem; padding: 8px; }
      .pm-pin-slot img, .pm-skill-row img { width: 30px; height: 30px; border-radius: 6px; background: #020617; border: 1px solid #334155; object-fit: contain; flex-shrink: 0; }
      .pm-pin-meta { flex: 1; min-width: 0; display: flex; flex-direction: column; }
      .pm-pin-meta b { font-size: 0.72rem; color: #7dd3fc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .pm-pin-meta small { font-size: 0.62rem; color: #94a3b8; }
      .pm-unpin-btn { background: rgba(239, 68, 68, 0.2); border: 1px solid #ef4444; color: #fca5a5; width: 22px; height: 22px; border-radius: 5px; cursor: pointer; font-size: 0.68rem; font-weight: 800; }
      .pm-search-bar { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 0.74rem; font-weight: 800; color: #cbd5e1; margin-top: 4px; }
      .pm-search-bar input { background: #020617; border: 1px solid #334155; color: #f8fafc; padding: 4px 8px; border-radius: 6px; font-size: 0.72rem; width: 170px; }
      .pm-skills-list { display: flex; flex-direction: column; gap: 4px; }
      .pm-skill-row { display: flex; align-items: center; gap: 8px; background: rgba(15, 23, 42, 0.72); border: 1px solid rgba(148, 163, 184, 0.16); border-radius: 8px; padding: 5px 8px; }
      .pm-skill-row.pinned { border-color: #22c55e; background: rgba(34, 197, 94, 0.08); }
      .pm-skill-info { flex: 1; min-width: 0; }
      .pm-skill-top { display: flex; align-items: center; gap: 6px; font-size: 0.73rem; }
      .pm-skill-top span { font-size: 0.64rem; color: #7dd3fc; }
      .pm-skill-desc { font-size: 0.65rem; color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .pm-skill-btn { padding: 4px 8px; border-radius: 5px; font-size: 0.68rem; font-weight: 800; cursor: pointer; border: 1px solid transparent; }
      .pm-skill-btn.add { background: #0284c7; color: #fff; }
      .pm-skill-btn.rem { background: rgba(239, 68, 68, 0.2); border-color: #ef4444; color: #fca5a5; }
      .pm-gen-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(175px, 1fr)); gap: 6px; }
      .pm-gen-card { background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(148, 163, 184, 0.18); border-radius: 8px; padding: 7px; display: flex; flex-direction: column; gap: 6px; justify-content: space-between; }
      .pm-gen-top { display: flex; align-items: center; gap: 7px; }
      .pm-gen-meta { flex: 1; min-width: 0; display: flex; flex-direction: column; }
      .pm-gen-meta b { font-size: 0.74rem; color: #f8fafc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .pm-gen-meta small { font-size: 0.62rem; color: #94a3b8; }
      .pm-gen-btn { background: linear-gradient(135deg, #16a34a, #22c55e); border: none; color: #022c22; font-weight: 900; font-size: 0.69rem; padding: 5px 8px; border-radius: 6px; cursor: pointer; width: 100%; }
      .pm-empty { padding: 24px 12px; text-align: center; color: #94a3b8; display: flex; flex-direction: column; align-items: center; gap: 10px; font-size: 0.78rem; }
      .pm-btn-primary { background: #0284c7; border: none; color: #fff; padding: 6px 14px; border-radius: 6px; font-weight: 800; font-size: 0.74rem; cursor: pointer; }
    `;
    document.head.appendChild(style);
  }
}

window.PlayPetsController = new PlayPetsController();
