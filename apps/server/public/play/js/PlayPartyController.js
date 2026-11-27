/**
 * @file apps/server/public/play/js/PlayPartyController.js
 * @description Controlador do Sistema de Equipes (Até 3 Jogadores) no Etheria Campus.
 * 
 * PILARES IMPLEMENTADOS:
 * - Pilar 1 (UI & Gestão): 1 ícone minimalista à direita com badge [X/3], modal completo de gestão (expulsar, transferir, sair).
 * - Pilar 2 (Fila Indiana): Membros seguem o líder automaticamente em fila única (~45px de espaçamento).
 *   Controles manuais travados durante a equipe (sair da equipe devolve o controle).
 *   Mudança de mapa do líder transporta os seguidores juntos instantaneamente.
 * - Pilar 3 (Combate Co-op & Pets): Máx 1 pet por jogador em equipe (solo leva até 3).
 * - Pilar 4 (Economia): +30% EXP, Ouro e Drops divididos igualmente com Math.ceil.
 *   Missões: Abates contam integralmente para todos os membros ativos.
 * - Pilar 5 (Sinergia): Proteção contra fogo amigo e chat de equipe isolado (/p).
 */

class PlayPartyController {
  constructor() {
    this.client = null;
    this.party = null;
    this.pendingInvites = [];
    this.nearbyPlayers = [];
    this.isOpen = false;
    this.lastProcessedMapChange = 0;
    this.inviteBannerTimers = new Map();
    this.leaderTrail = []; // Buffer de posições para fila indiana suave
    this.isTransitioningMap = false;
  }

  /**
   * Inicializa o controlador de equipe vinculado ao cliente PlayApp.
   */
  init(clientApp) {
    this.client = clientApp || window.PlayApp;
    this.injectHudElements();
    this.setupGlobalShortcuts();
    void this.fetchPartyState();
  }

  /**
   * Obtém a instância autoritária do cliente de jogo.
   */
  getClient() {
    return this.client || window.PlayApp || null;
  }

  /**
   * Retorna o ID do personagem ativo local.
   */
  getLocalCharId() {
    const char = this.getClient()?.activeChar;
    return char ? Number(char.id) : 0;
  }

  /**
   * Verifica se o jogador local está atualmente em uma equipe.
   */
  hasParty() {
    return Boolean(this.party && Array.isArray(this.party.members) && this.party.members.length > 0);
  }

  /**
   * Verifica se o jogador local é o Líder da equipe.
   */
  isLeader() {
    if (!this.hasParty()) return false;
    const leaderId = Number(this.party.leaderCharacterId ?? this.party.leaderId ?? 0);
    return leaderId > 0 && leaderId === this.getLocalCharId();
  }

  /**
   * Verifica se o jogador local é um Seguidor (membro não-líder).
   */
  isFollower() {
    if (!this.hasParty()) return false;
    const leaderId = Number(this.party.leaderCharacterId ?? this.party.leaderId ?? 0);
    return leaderId > 0 && leaderId !== this.getLocalCharId();
  }

  /**
   * Injeta o botão flutuante na HUD e a estrutura base do modal no DOM.
   */
  injectHudElements() {
    if (document.getElementById('hudPartyBtn')) return;

    // 1. Botão da HUD Lateral Direita
    const hudBtn = document.createElement('button');
    hudBtn.id = 'hudPartyBtn';
    hudBtn.className = 'hud-party-btn';
    hudBtn.type = 'button';
    hudBtn.title = 'Equipe (Toque para gerenciar ou criar)';
    hudBtn.innerHTML = `
      <span id="hudPartyCrown" class="hud-party-leader-crown" style="display:none;">👑</span>
      <img id="hudPartyIconImg" class="hud-party-icon-img" src="/play/assets/hud/menu_party.svg" alt="Equipe" />
      <span id="hudPartyBadge" class="hud-party-badge">0/3</span>
    `;
    hudBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      this.toggleModal();
    });
    document.body.appendChild(hudBtn);

    // 2. Modal de Gestão de Equipe
    const modalBackdrop = document.createElement('div');
    modalBackdrop.id = 'partyModalBackdrop';
    modalBackdrop.className = 'party-modal-backdrop';
    modalBackdrop.innerHTML = `
      <div class="party-modal-container" id="partyModalContainer">
        <div class="party-modal-header">
          <div class="party-modal-title">
            <span>👥</span>
            <span id="partyModalHeaderTitle">Equipe de Aventureiros</span>
          </div>
          <button type="button" class="party-modal-close-btn" id="partyModalCloseBtn" title="Fechar">✕</button>
        </div>
        <div class="party-modal-body" id="partyModalBody">
          <!-- Conteúdo dinâmico gerado por renderModalContent() -->
        </div>
        <div class="party-modal-footer" id="partyModalFooter">
          <!-- Botões de ação dinâmica -->
        </div>
      </div>
    `;

    modalBackdrop.addEventListener('click', (ev) => {
      if (ev.target === modalBackdrop) {
        this.closeModal();
      }
    });

    const closeBtn = modalBackdrop.querySelector('#partyModalCloseBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeModal());
    }

    document.body.appendChild(modalBackdrop);

    // 3. Container de Notificações de Convite Flutuante
    if (!document.getElementById('partyInvitesContainer')) {
      const invitesContainer = document.createElement('div');
      invitesContainer.id = 'partyInvitesContainer';
      invitesContainer.style.position = 'fixed';
      invitesContainer.style.top = '75px';
      invitesContainer.style.right = '14px';
      invitesContainer.style.zIndex = '1050';
      invitesContainer.style.display = 'flex';
      invitesContainer.style.flexDirection = 'column';
      invitesContainer.style.gap = '8px';
      invitesContainer.style.pointerEvents = 'none';
      document.body.appendChild(invitesContainer);
    }
  }

  /**
   * Configura atalhos globais de teclado (ex: tecla 'P' para abrir equipe).
   */
  setupGlobalShortcuts() {
    window.addEventListener('keydown', (ev) => {
      if (ev.target && (ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA')) {
        return;
      }
      if (ev.key === 'p' || ev.key === 'P') {
        ev.preventDefault();
        this.toggleModal();
      }
    });
  }

  /**
   * Recebe atualização periódica autoritária do endpoint `sync-position`.
   */
  handleSyncUpdate(party, pendingInvites, otherPlayers) {
    const prevParty = this.party;
    this.party = party || null;
    this.pendingInvites = Array.isArray(pendingInvites) ? pendingInvites : [];
    if (Array.isArray(otherPlayers)) {
      this.nearbyPlayers = otherPlayers;
    }

    this.updateHudButton();
    this.renderPendingInvitesBanners();

    // Sincroniza vitais se o modal estiver aberto
    if (this.isOpen) {
      this.renderModalContent();
    }

    // Verifica se o líder mudou de mapa e transporta os seguidores
    if (this.isFollower() && this.party?.targetMapChange) {
      this.handleLeaderMapChange(this.party.targetMapChange);
    }
  }

  /**
   * Executa a transição automática de mapa quando o líder passa por um portal.
   */
  async handleLeaderMapChange(mapChange) {
    if (this.isTransitioningMap) return;
    if (!mapChange || !mapChange.mapId || mapChange.timestamp <= this.lastProcessedMapChange) {
      return;
    }

    const client = this.getClient();
    if (!client) return;

    const currentMapId = client.currentMap?.id || client.activeChar?.currentMapId;
    if (currentMapId === mapChange.mapId) {
      this.lastProcessedMapChange = mapChange.timestamp;
      return;
    }

    this.lastProcessedMapChange = mapChange.timestamp;
    this.isTransitioningMap = true;

    try {
      if (window.PlayChatController) {
        window.PlayChatController.addSystemNotice(`[Equipe] Seguindo o líder para o novo mapa...`);
      }
      // Se houver controlador de portal disponível, usa-o para transição suave
      if (typeof client.loadMapIntoWorld === 'function') {
        await client.loadMapIntoWorld(mapChange.mapId, mapChange.posX, mapChange.posY);
      }
    } catch (err) {
      console.error('[PlayPartyController] Erro ao seguir líder para novo mapa:', err);
    } finally {
      this.isTransitioningMap = false;
    }
  }

  /**
   * Atualiza a aparência do botão na HUD com contagem de membros e coroa.
   */
  updateHudButton() {
    const btn = document.getElementById('hudPartyBtn');
    const badge = document.getElementById('hudPartyBadge');
    const crown = document.getElementById('hudPartyCrown');
    if (!btn || !badge) return;

    if (this.hasParty()) {
      const count = this.party.members?.length || 1;
      badge.textContent = `${count}/3`;
      btn.classList.add('in-party');
      if (this.isLeader()) {
        btn.classList.add('is-leader');
        if (crown) crown.style.display = 'block';
      } else {
        btn.classList.remove('is-leader');
        if (crown) crown.style.display = 'none';
      }
    } else {
      badge.textContent = this.pendingInvites.length > 0 ? `!(${this.pendingInvites.length})` : '0/3';
      btn.classList.remove('in-party', 'is-leader');
      if (crown) crown.style.display = 'none';
    }
  }

  /**
   * Abre ou fecha o modal de equipe.
   */
  toggleModal() {
    if (this.isOpen) {
      this.closeModal();
    } else {
      this.openModal();
    }
  }

  openModal() {
    const backdrop = document.getElementById('partyModalBackdrop');
    if (!backdrop) return;
    this.isOpen = true;
    backdrop.classList.add('active');
    this.renderModalContent();
    void this.fetchPartyState();
    void this.fetchNearbyPlayers();
  }

  closeModal() {
    const backdrop = document.getElementById('partyModalBackdrop');
    if (!backdrop) return;
    this.isOpen = false;
    backdrop.classList.remove('active');
  }

  /**
   * Renderiza o conteúdo do modal de equipe.
   */
  renderModalContent() {
    const body = document.getElementById('partyModalBody');
    const footer = document.getElementById('partyModalFooter');
    const title = document.getElementById('partyModalHeaderTitle');
    if (!body || !footer) return;

    const myCharId = this.getLocalCharId();

    if (!this.hasParty()) {
      // Estado: Sem Equipe
      if (title) title.textContent = 'Equipe de Aventureiros';
      body.innerHTML = `
        <div class="party-perks-box">
          <div class="party-perk-item"><span>⭐</span><span><strong>+30% EXP</strong> dividida</span></div>
          <div class="party-perk-item"><span>🪙</span><span><strong>+30% Ouro</strong> dividido</span></div>
          <div class="party-perk-item"><span>🎁</span><span><strong>+30% Drops</strong> divididos</span></div>
          <div class="party-perk-item"><span>📜</span><span><strong>Missões 100%</strong> contam a todos</span></div>
          <div class="party-perk-item" style="grid-column: span 2;">
            <span>🚶</span><span><strong>Fila Indiana:</strong> Membros seguem o líder e mudam de mapa juntos.</span>
          </div>
        </div>

        <div style="text-align:center; padding:12px; color:#cbd5e1; font-size:0.8rem;">
          Você não está em nenhuma equipe no momento.<br/>
          Crie uma nova equipe ou convide aventureiros próximos no mapa!
        </div>

        <div class="party-nearby-section" id="partyNearbySection">
          <div class="party-nearby-header">
            <span>Jogadores Próximos no Mapa (< 350px)</span>
            <button type="button" class="party-btn-action" onclick="window.PlayPartyController.fetchNearbyPlayers()" title="Atualizar Lista">🔄</button>
          </div>
          <div class="party-nearby-list" id="partyNearbyList">
            ${this.renderNearbyPlayersHtml()}
          </div>
        </div>
      `;

      footer.innerHTML = `
        <div></div>
        <button type="button" class="party-btn-primary" onclick="window.PlayPartyController.createParty()">
          ⚔️ Criar Nova Equipe
        </button>
      `;
      return;
    }

    // Estado: Em Equipe (1 a 3 membros)
    const members = this.party.members || [];
    const isLeader = this.isLeader();
    if (title) title.textContent = `Minha Equipe (${members.length}/3)`;

    let membersHtml = '';
    for (let i = 0; i < 3; i++) {
      const member = members[i];
      if (member) {
        const isMe = Number(member.characterId) === myCharId;
        const curHp = Number(member.currentHp ?? member.hp ?? 100);
        const maxHp = Math.max(1, Number(member.maxHp ?? 100));
        const curMp = Number(member.currentMp ?? member.mp ?? 50);
        const maxMp = Math.max(1, Number(member.maxMp ?? 50));
        const hpPercent = Math.max(0, Math.min(100, Math.round((curHp / maxHp) * 100)));
        const mpPercent = Math.max(0, Math.min(100, Math.round((curMp / maxMp) * 100)));
        const thumb = member.thumbUrl || `/api/assets/mcrework/assets/characters/${member.mcreworkCharKey || '100101'}/thumb.webp`;

        let actionBtns = '';
        if (isLeader && !isMe) {
          actionBtns = `
            <div class="party-member-actions">
              <button type="button" class="party-btn-action transfer" onclick="window.PlayPartyController.transferLeadership(${member.characterId})" title="Passar Liderança da Equipe">👑 Líder</button>
              <button type="button" class="party-btn-action kick" onclick="window.PlayPartyController.kickMember(${member.characterId})" title="Expulsar da Equipe">❌ Expulsar</button>
            </div>
          `;
        }

        const safeMemberName = window.EtheriaSanitizer ? window.EtheriaSanitizer.escapeHtml(member.name) : String(member.name ?? '');
        membersHtml += `
          <div class="party-member-card ${member.isLeader ? 'is-leader-card' : ''} ${isMe ? 'is-me-card' : ''}">
            <div class="party-member-avatar">
              <img src="${thumb}" alt="${safeMemberName}" onerror="this.src='/play/assets/hud/player_avatar_frame.png'" />
            </div>
            <div class="party-member-info">
              <div class="party-member-name-row">
                <span class="party-member-name">${safeMemberName} (Nv.${member.level}) ${isMe ? '<small style="color:#38bdf8;">(Você)</small>' : ''}</span>
                <span class="party-member-badge ${member.isLeader ? 'leader' : 'follower'}">
                  ${member.isLeader ? '👑 Líder' : '🛡️ Membro'}
                </span>
              </div>
              <div class="party-bars-container">
                <div class="party-bar-wrap">
                  <div class="party-bar-fill-hp" style="width:${hpPercent}%;"></div>
                  <div class="party-bar-text">HP ${curHp}/${maxHp}</div>
                </div>
                <div class="party-bar-wrap">
                  <div class="party-bar-fill-mp" style="width:${mpPercent}%;"></div>
                  <div class="party-bar-text">MP ${curMp}/${maxMp}</div>
                </div>
              </div>
            </div>
            ${actionBtns}
          </div>
        `;
      } else {
        // Slot Vazio
        membersHtml += `
          <div class="party-slot-empty">
            <span>❖</span>
            <span>Slot Vago (Aguardando Aventureiro)</span>
          </div>
        `;
      }
    }

    let nearbySection = '';
    if (members.length < 3) {
      nearbySection = `
        <div class="party-nearby-section" id="partyNearbySection">
          <div class="party-nearby-header">
            <span>Convidar Jogadores Próximos (< 350px)</span>
            <button type="button" class="party-btn-action" onclick="window.PlayPartyController.fetchNearbyPlayers()" title="Atualizar Lista">🔄</button>
          </div>
          <div class="party-nearby-list" id="partyNearbyList">
            ${this.renderNearbyPlayersHtml()}
          </div>
        </div>
      `;
    }

    body.innerHTML = `
      <div class="party-perks-box">
        <div class="party-perk-item"><span>⭐</span><span><strong>+30% EXP</strong> dividida</span></div>
        <div class="party-perk-item"><span>🪙</span><span><strong>+30% Ouro</strong> dividido</span></div>
        <div class="party-perk-item"><span>🎁</span><span><strong>+30% Drops</strong> divididos</span></div>
        <div class="party-perk-item"><span>📜</span><span><strong>Missões 100%</strong> contam a todos</span></div>
        <div class="party-perk-item" style="grid-column: span 2;">
          <span>🚶</span><span><strong>Fila Indiana Ativa:</strong> Membros colam atrás do líder e mudam de mapa juntos.</span>
        </div>
      </div>

      <div class="party-members-list">
        ${membersHtml}
      </div>

      ${nearbySection}
    `;

    footer.innerHTML = `
      <button type="button" class="party-btn-leave" onclick="window.PlayPartyController.leaveParty()">
        🚪 Sair da Equipe
      </button>
      <div style="font-size:0.7rem; color:#94a3b8; font-family:monospace;">
        ${isLeader ? 'Você é o Líder da Equipe' : 'Seguindo o Líder em Fila Indiana'}
      </div>
    `;
  }

  /**
   * Renderiza a lista de jogadores próximos para convite.
   */
  renderNearbyPlayersHtml() {
    const list = this.nearbyPlayers.filter((p) => {
      const myId = this.getLocalCharId();
      if (p.characterId === myId) return false;
      // Não exibe se já for membro da minha equipe
      if (this.party?.members?.some((m) => m.characterId === p.characterId)) return false;
      return true;
    });

    if (list.length === 0) {
      return `<div style="text-align:center; padding:8px; color:#64748b; font-size:0.72rem;">Nenhum jogador desocupado a menos de 350px.</div>`;
    }

    const esc = (v) => (window.EtheriaSanitizer ? window.EtheriaSanitizer.escapeHtml(v) : String(v ?? ''));
    return list.map((p) => `
      <div class="party-nearby-row">
        <div>
          <span class="party-nearby-name">${esc(p.name)} (Nv.${p.level})</span>
          <span class="party-nearby-dist">~${p.distance || 0}px</span>
        </div>
        <button type="button" class="party-btn-invite" onclick="window.PlayPartyController.invitePlayer(${p.characterId})">
          + Convidar
        </button>
      </div>
    `).join('');
  }

  async fetchPartyState() {
    const client = this.getClient();
    const charId = this.getLocalCharId();
    if (!client || !charId) return;

    try {
      const res = await client.api(`/api/play/party/state?characterId=${charId}`);
      if (res && (res.ok || res.success)) {
        this.party = res.party || null;
        this.pendingInvites = Array.isArray(res.invites) ? res.invites : [];
        this.updateHudButton();
        this.renderPendingInvitesBanners();
        if (this.isOpen) this.renderModalContent();
      }
    } catch (_) {}
  }

  /**
   * Busca jogadores próximos via API.
   */
  async fetchNearbyPlayers() {
    const client = this.getClient();
    const charId = this.getLocalCharId();
    if (!client || !charId) return;

    try {
      const mapId = client.currentMap?.id || 1;
      const res = await client.api(`/api/play/party/nearby?characterId=${charId}&mapId=${mapId}`);
      const list = res?.nearbyPlayers || res?.candidates;
      if (res && (res.ok || res.success) && Array.isArray(list)) {
        this.nearbyPlayers = list;
        const container = document.getElementById('partyNearbyList');
        if (container) {
          container.innerHTML = this.renderNearbyPlayersHtml();
        }
      }
    } catch (_) {}
  }

  /**
   * Renderiza os banners de convite recebido flutuantes com temporizador de 30s.
   */
  renderPendingInvitesBanners() {
    const container = document.getElementById('partyInvitesContainer');
    if (!container) return;

    const now = Date.now();
    const activeInvites = this.pendingInvites.filter((inv) => inv.expiresAt > now);
    const getInvId = (inv) => inv.id || inv.inviteId;
    const getFromName = (inv) => inv.fromCharacterName || inv.fromName || 'Aventureiro';

    // Remove banners de convites não mais ativos
    for (const [inviteId, timerId] of this.inviteBannerTimers.entries()) {
      if (!activeInvites.some((inv) => getInvId(inv) === inviteId)) {
        clearInterval(timerId);
        this.inviteBannerTimers.delete(inviteId);
        const el = document.getElementById(`inviteBanner_${inviteId}`);
        if (el) el.remove();
      }
    }

    // Cria/atualiza banners para convites ativos
    for (const inv of activeInvites) {
      const invId = getInvId(inv);
      const fromName = getFromName(inv);
      let banner = document.getElementById(`inviteBanner_${invId}`);
      if (!banner) {
        banner = document.createElement('div');
        banner.id = `inviteBanner_${invId}`;
        banner.className = 'party-invite-banner';
        banner.style.pointerEvents = 'auto';
        container.appendChild(banner);

        // Temporizador de contagem regressiva
        const intervalId = setInterval(() => {
          const remainingSec = Math.max(0, Math.ceil((inv.expiresAt - Date.now()) / 1000));
          const timerEl = document.getElementById(`inviteTimer_${invId}`);
          if (timerEl) timerEl.textContent = `${remainingSec}s`;
          if (remainingSec <= 0) {
            clearInterval(intervalId);
            this.inviteBannerTimers.delete(invId);
            banner.remove();
          }
        }, 1000);
        this.inviteBannerTimers.set(invId, intervalId);
      }

      const remainingSec = Math.max(0, Math.ceil((inv.expiresAt - now) / 1000));
      const safeName = window.EtheriaSanitizer ? window.EtheriaSanitizer.escapeHtml(fromName) : String(fromName);
      banner.innerHTML = `
        <div class="party-invite-banner-header">
          <span>⚔️ Convite de Equipe!</span>
          <span class="party-invite-banner-timer" id="inviteTimer_${invId}">${remainingSec}s</span>
        </div>
        <div class="party-invite-banner-body">
          <strong>${safeName}</strong> (Nv.${inv.fromLevel || 1}) convidou você para formar uma equipe!
        </div>
        <div class="party-invite-banner-actions">
          <button type="button" class="party-invite-btn-decline" onclick="window.PlayPartyController.declineInvite('${invId}')">
            ✕ Recusar
          </button>
          <button type="button" class="party-invite-btn-accept" onclick="window.PlayPartyController.acceptInvite('${invId}')">
            ✓ Aceitar
          </button>
        </div>
      `;
    }
  }

  // --- Ações de API ---

  async createParty() {
    const client = this.getClient();
    const charId = this.getLocalCharId();
    if (!client || !charId) return;

    try {
      const res = await client.api('/api/play/party/create', {
        method: 'POST',
        body: JSON.stringify({ characterId: charId }),
      });
      if (res && (res.ok || res.success) && res.party) {
        this.party = res.party;
        this.updateHudButton();
        this.renderModalContent();
        if (window.PlayChatController) {
          window.PlayChatController.addSystemNotice('[Equipe] Equipe criada com sucesso! Você é o Líder.');
        }
      } else {
        alert(res?.error || 'Erro ao criar equipe.');
      }
    } catch (err) {
      alert(err.message || 'Falha de comunicação.');
    }
  }

  async invitePlayer(targetCharId) {
    const client = this.getClient();
    const charId = this.getLocalCharId();
    if (!client || !charId) return;

    try {
      const res = await client.api('/api/play/party/invite', {
        method: 'POST',
        body: JSON.stringify({ characterId: charId, targetCharacterId: targetCharId }),
      });
      if (res && (res.ok || res.success)) {
        if (window.PlayChatController) {
          window.PlayChatController.addSystemNotice(`[Equipe] Convite enviado com sucesso!`);
        }
        await this.fetchNearbyPlayers();
      } else {
        alert(res?.error || 'Não foi possível convidar este jogador.');
      }
    } catch (err) {
      alert(err.message || 'Falha ao enviar convite.');
    }
  }

  async acceptInvite(inviteId) {
    const client = this.getClient();
    const charId = this.getLocalCharId();
    if (!client || !charId) return;

    try {
      const res = await client.api('/api/play/party/accept', {
        method: 'POST',
        body: JSON.stringify({ characterId: charId, inviteId }),
      });
      if (res && (res.ok || res.success) && res.party) {
        this.party = res.party;
        this.pendingInvites = this.pendingInvites.filter((inv) => (inv.id || inv.inviteId) !== inviteId);
        this.renderPendingInvitesBanners();
        this.updateHudButton();
        this.renderModalContent();
        if (window.PlayChatController) {
          window.PlayChatController.addSystemNotice(`[Equipe] Você entrou na equipe! Formação em fila indiana ativada.`);
        }
      } else {
        alert(res?.error || 'Erro ao aceitar convite.');
      }
    } catch (err) {
      alert(err.message || 'Falha ao aceitar convite.');
    }
  }

  async declineInvite(inviteId) {
    const client = this.getClient();
    const charId = this.getLocalCharId();
    if (!client || !charId) return;

    try {
      await client.api('/api/play/party/decline', {
        method: 'POST',
        body: JSON.stringify({ characterId: charId, inviteId }),
      });
      this.pendingInvites = this.pendingInvites.filter((inv) => (inv.id || inv.inviteId) !== inviteId);
      this.renderPendingInvitesBanners();
      this.updateHudButton();
    } catch (_) {}
  }

  async leaveParty() {
    const client = this.getClient();
    const charId = this.getLocalCharId();
    if (!client || !charId) return;

    if (!confirm('Deseja realmente sair da equipe? Seus controles manuais serão destravados.')) return;

    try {
      const res = await client.api('/api/play/party/leave', {
        method: 'POST',
        body: JSON.stringify({ characterId: charId }),
      });
      if (res && (res.ok || res.success)) {
        this.party = null;
        this.updateHudButton();
        this.renderModalContent();
        if (window.PlayChatController) {
          window.PlayChatController.addSystemNotice(`[Equipe] Você saiu da equipe. Controles manuais recuperados.`);
        }
      } else {
        alert(res?.error || 'Erro ao sair da equipe.');
      }
    } catch (err) {
      alert(err.message || 'Falha ao sair da equipe.');
    }
  }

  async kickMember(targetCharId) {
    const client = this.getClient();
    const charId = this.getLocalCharId();
    if (!client || !charId) return;

    if (!confirm('Deseja expulsar este membro da equipe?')) return;

    try {
      const res = await client.api('/api/play/party/kick', {
        method: 'POST',
        body: JSON.stringify({ characterId: charId, targetCharacterId: targetCharId }),
      });
      if (res && (res.ok || res.success) && res.party) {
        this.party = res.party;
        this.renderModalContent();
        if (window.PlayChatController) {
          window.PlayChatController.addSystemNotice(`[Equipe] Membro expulso com sucesso.`);
        }
      } else {
        alert(res?.error || 'Erro ao expulsar membro.');
      }
    } catch (err) {
      alert(err.message || 'Falha ao expulsar membro.');
    }
  }

  async transferLeadership(targetCharId) {
    const client = this.getClient();
    const charId = this.getLocalCharId();
    if (!client || !charId) return;

    if (!confirm('Deseja transferir a liderança da equipe para este membro?')) return;

    try {
      const res = await client.api('/api/play/party/transfer', {
        method: 'POST',
        body: JSON.stringify({ characterId: charId, targetCharacterId: targetCharId }),
      });
      if (res && (res.ok || res.success) && res.party) {
        this.party = res.party;
        this.updateHudButton();
        this.renderModalContent();
        if (window.PlayChatController) {
          window.PlayChatController.addSystemNotice(`[Equipe] Liderança transferida com sucesso.`);
        }
      } else {
        alert(res?.error || 'Erro ao transferir liderança.');
      }
    } catch (err) {
      alert(err.message || 'Falha ao transferir liderança.');
    }
  }

  // --- Algoritmo de Movimento em Fila Indiana (Follower Snake Movement) ---

  /**
   * Executado no ciclo do gameLoop quando o jogador local é um seguidor da equipe.
   * Trava controles manuais e segue suavemente o líder ou o membro à frente (~45px).
   */
  updateFollowerMovement(dt) {
    const client = this.getClient();
    if (!client || !this.isFollower() || this.isTransitioningMap) return;

    const myCharId = this.getLocalCharId();
    const members = this.party?.members || [];
    const myIndex = members.findIndex((m) => m.characterId === myCharId);
    if (myIndex <= 0) return; // Índice inválido ou líder

    // Identifica o alvo a ser seguido (o membro imediatamente à frente na fila)
    const targetMember = members[myIndex - 1];
    if (!targetMember) return;

    // Localiza a posição do membro alvo no mapa
    let targetX = targetMember.posX;
    let targetY = targetMember.posY;

    // Se o alvo estiver na lista de presença dos outros jogadores, pega a coordenada em tempo real
    const presencePlayers = window.PlayMapPresenceController?.otherPlayers || [];
    const liveTarget = presencePlayers.find((p) => p.characterId === targetMember.characterId);
    if (liveTarget) {
      targetX = liveTarget.posX;
      targetY = liveTarget.posY;
    }

    if (targetX === undefined || targetY === undefined) return;

    const currentX = client.playerX;
    const currentY = client.playerY;
    const dx = targetX - currentX;
    const dy = targetY - currentY;
    const dist = Math.hypot(dx, dy);

    const DESIRED_SPACING = 45; // Distância fixa nostálgica de fila indiana

    // Se a distância for muito grande (desync/portal), teletransporta para perto do líder
    if (dist > 450) {
      client.playerX = targetX - 35;
      client.playerY = targetY;
      client.isMoving = false;
      return;
    }

    if (dist > DESIRED_SPACING) {
      // Calcula velocidade dinâmica com leve aceleração de catch-up se estiver ficando para trás
      const baseSpeed = 205;
      const catchupFactor = Math.min(1.6, 1.0 + (dist - DESIRED_SPACING) / 120);
      const moveSpeed = baseSpeed * catchupFactor;
      const step = Math.min(dist - DESIRED_SPACING, moveSpeed * dt);

      const vx = dx / dist;
      const vy = dy / dist;

      client.playerX += vx * step;
      client.playerY += vy * step;
      client.isMoving = true;

      // Atualiza direção visual (0..7)
      const angle = Math.atan2(dy, dx); // radianos (-PI a PI)
      // Converte ângulo para octante
      let octant = Math.round((angle * 4) / Math.PI);
      if (octant < 0) octant += 8;
      // Mapeia para o sistema de direção 0..7 do motor
      const dirMap = [2, 1, 0, 7, 6, 5, 4, 3]; // Leste, Sudeste, Sul, Sudoeste, Oeste, Noroeste, Norte, Nordeste
      client.playerDir = dirMap[octant % 8] ?? 0;
    } else {
      client.isMoving = false;
    }
  }
}

// Instância global do controlador de equipes
window.PlayPartyController = new PlayPartyController();
