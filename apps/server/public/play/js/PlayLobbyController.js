/**
 * @file apps/server/public/play/js/PlayLobbyController.js
 * @module @etheria/server
 * @description Submódulo de Seleção, Edição, Deleção e Criação de Personagens no Lobby do Jogo.
 */

class PlayLobbyController {
  static attach(client) {
    client.activeLobbyTab = 'characters'; // 'characters' | 'create'
    client.selectedClassIdForCreation = null;

    client.switchLobbyTab = function (tab) {
      this.activeLobbyTab = tab;
      this.renderLobby();
    };

    client.renderLobby = function () {
      if (this.session) {
        const badge = document.getElementById('lobbyUserBadge');
        if (badge) {
          badge.textContent = `👤 ${this.session.username} (${this.session.role})`;
        }
      }

      // Se o usuário não tiver personagens e a aba for characters, podemos alternar automaticamente para 'create' se for o primeiro login
      const myChars = this.myCharacters || [];
      if (myChars.length === 0 && this.activeLobbyTab !== 'create') {
        this.activeLobbyTab = 'create';
      }

      // Atualizar botões de abas no topo
      const tabCharsBtn = document.getElementById('tabBtnHeroes');
      const tabCreateBtn = document.getElementById('tabBtnCreate');
      if (tabCharsBtn && tabCreateBtn) {
        tabCharsBtn.classList.toggle('active', this.activeLobbyTab === 'characters');
        tabCreateBtn.classList.toggle('active', this.activeLobbyTab === 'create');
      }

      const heroesView = document.getElementById('lobbyHeroesView');
      const createView = document.getElementById('lobbyCreateView');

      if (this.activeLobbyTab === 'characters') {
        if (heroesView) heroesView.style.display = 'block';
        if (createView) createView.style.display = 'none';
        this.renderHeroesList();
      } else {
        if (heroesView) heroesView.style.display = 'none';
        if (createView) createView.style.display = 'block';
        this.renderCreationView();
      }
    };

    // -------------------------------------------------------------------------
    // 1. RENDERIZAÇÃO DA LISTA DE PERSONAGENS EXISTENTES
    // -------------------------------------------------------------------------
    client.renderHeroesList = function () {
      const container = document.getElementById('myCharactersList');
      if (!container) return;

      const myChars = this.myCharacters || [];
      if (myChars.length === 0) {
        container.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 48px 24px; background: rgba(15, 23, 42, 0.85); border: 1.5px dashed rgba(234, 179, 8, 0.4); border-radius: 16px;">
            <div style="font-size: 2.4rem; margin-bottom: 8px;">🧙‍♂️</div>
            <h3 style="color: #fde047; margin: 0 0 6px 0; font-size: 1.25rem;">Nenhum Herói Criado Ainda</h3>
            <p style="color: #94a3b8; font-size: 0.88rem; max-width: 460px; margin: 0 auto 18px auto;">
              Você ainda não possui nenhum personagem nesta conta. Desperte seu primeiro herói e comece sua jornada em Etheria!
            </p>
            <button class="login-btn-enter" style="margin: 0 auto; padding: 10px 24px;" onclick="PlayApp.switchLobbyTab('create')">
              ✨ Criar Primeiro Herói
            </button>
          </div>`;
        return;
      }

      const esc = (v) => (window.EtheriaSanitizer ? window.EtheriaSanitizer.escapeHtml(v) : String(v ?? ''));
      const canToggleReborn = ['ADMIN', 'GM', 'DEV'].includes(this.session?.role);

      container.innerHTML = myChars
        .map((c) => {
          const el = this.getElementStyle(c.elementCode);
          const avatarSrc = c.classCode
            ? `/play/assets/hud/avatars/${c.classCode}.png`
            : (c.thumbUrl || '/play/assets/hud/player_avatar_frame.png');
          const isReborn = Boolean(c.isReborn);
          const hasRebornSkin = Boolean(c.rebornMcreworkCharKey);
          const xp = Number(c.experience) || 0;
          const maxXp = Number(c.maxXp) || (c.level || 1) * 200;
          const xpPct = Math.min(100, Math.round((xp / maxXp) * 100));
          const safeName = esc(c.name);
          const safeClassName = esc(c.classNamePtBr);
          const safeElementName = esc(c.elementNamePtBr);
          const safeMapName = esc(c.currentMapNamePtBr || 'Mapa #1');

          return `
            <div class="hero-card">
              <div class="hero-card-header">
                <div class="hero-avatar-wrap">
                  <img class="hero-avatar-img" src="${avatarSrc}" alt="${safeName}" onerror="this.src='/play/assets/hud/player_avatar_frame.png'" />
                  <div class="hero-element-badge-float" style="background: ${el.bg}; border-color: ${el.color};" title="Elemento Primordial: ${safeElementName}">
                    ${el.icon}
                  </div>
                </div>

                <div class="hero-info-body">
                  <div class="hero-name-row">
                    <span class="hero-name" title="${safeName}">${safeName}</span>
                    ${isReborn ? '<span class="hero-reborn-pill">🌟 REBORN</span>' : ''}
                  </div>

                  <div class="hero-class-meta">
                    <span style="color: #fde047; font-weight: 700;">Nv. ${c.level}</span>
                    <span>&bull;</span>
                    <span style="color: #cbd5e1;">${safeClassName}</span>
                    <span>&bull;</span>
                    <span style="color: #94a3b8; font-size: 0.74rem;">${esc(c.raceCode)}</span>
                  </div>

                  <div class="hero-stats-chips">
                    <div class="hero-chip">
                      <span>🗺️</span>
                      <strong>${safeMapName}</strong>
                    </div>
                    <div class="hero-chip">
                      <span>🪙</span>
                      <strong style="color: #fde047; font-family: monospace;">${(c.gold || 0).toLocaleString('pt-BR')}</strong>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Barra de Progresso de Experiência -->
              <div class="hero-xp-bar-wrap">
                <div class="hero-xp-bar-labels">
                  <span>EXP</span>
                  <span>${xp} / ${maxXp} (${xpPct}%)</span>
                </div>
                <div class="hero-xp-bar-track">
                  <div class="hero-xp-bar-fill" style="width: ${xpPct}%;"></div>
                </div>
              </div>

              <!-- Linha de Ações: Jogar, Alternar Visual (Skin) e Deletar -->
              <div class="hero-actions-row">
                <button class="hero-btn-play" onclick="PlayApp.enterWorldWithCharacter(${c.id})" title="Entrar no mundo com ${safeName}">
                  ⚔️ Jogar
                </button>

                ${
                  canToggleReborn
                    ? `<button class="hero-btn-skin" onclick="PlayApp.toggleCharacterReborn(${c.id}, ${hasRebornSkin})" title="${hasRebornSkin ? 'Alternar entre Visual Padrão e Visual Reborn' : 'Esta classe não possui visual Reborn alternativo'}">
                  ${isReborn ? '✨ Skin Padrão' : '🌟 Skin Reborn'}
                </button>`
                    : ''
                }

                <button class="hero-btn-delete" onclick="PlayApp.deleteCharacter(${c.id})" title="Excluir este personagem">
                  🗑️
                </button>
              </div>
            </div>`;
        })
        .join('');
    };

    // -------------------------------------------------------------------------
    // 2. RENDERIZAÇÃO DA VISÃO DE CRIAÇÃO COM DETALHES DE BASE DA CLASSE
    // -------------------------------------------------------------------------
    client.renderCreationView = function () {
      const classes = this.classTemplates || [];
      if (!this.selectedClassIdForCreation && classes.length > 0) {
        this.selectedClassIdForCreation = classes[0].id;
      }

      const esc = (v) => (window.EtheriaSanitizer ? window.EtheriaSanitizer.escapeHtml(v) : String(v ?? ''));
      const gridContainer = document.getElementById('creationClassesGrid');
      if (gridContainer) {
        gridContainer.innerHTML = classes
          .map((ct) => {
            const isSel = ct.id === this.selectedClassIdForCreation ? 'selected' : '';
            const thumb = ct.code ? `/play/assets/hud/avatars/${ct.code}.png` : ct.thumbUrl;
            const safeClassName = esc(ct.namePtBr);
            return `
              <div class="creation-class-pill ${isSel}" onclick="PlayApp.selectClassForCreation(${ct.id})">
                <img src="${thumb}" alt="${safeClassName}" onerror="this.src='/play/assets/hud/player_avatar_frame.png'" />
                <span class="creation-class-name">${safeClassName}</span>
                <span class="creation-class-race">${esc(ct.raceNamePtBr || ct.raceCode)}</span>
              </div>`;
          })
          .join('');
      }

      // Painel de Detalhes da Classe Selecionada
      const previewContainer = document.getElementById('selectedClassPreviewPanel');
      if (previewContainer) {
        const selectedClass = classes.find((c) => c.id === this.selectedClassIdForCreation);
        if (!selectedClass) {
          previewContainer.innerHTML = `<div style="color: #94a3b8; font-size: 0.85rem;">Selecione uma classe ao lado.</div>`;
          return;
        }

        const baseStats = selectedClass.baseAttributesJson || {
          VIT: 10,
          STR: 10,
          INT: 10,
          WIS: 10,
          AGI: 10,
          DEX: 10,
        };
        const growth = selectedClass.growthPerLevelJson || {
          VIT: 2,
          STR: 2,
          INT: 2,
          WIS: 2,
          AGI: 2,
          DEX: 2,
        };

        const thumb = selectedClass.code ? `/play/assets/hud/avatars/${selectedClass.code}.png` : selectedClass.thumbUrl;
        const maxStat = 25; // Base de escala visual para as barras de atributos

        const renderStat = (code, label, icon, desc) => {
          const val = baseStats[code] || 10;
          const inc = growth[code] || 2;
          const pct = Math.min(100, Math.round((val / maxStat) * 100));
          return `
            <div class="attribute-item-box" title="${desc}">
              <div class="attribute-item-top">
                <span style="font-weight: 700; color: #cbd5e1;">${icon} ${label} (${code})</span>
                <span style="font-family: monospace; color: #fde047; font-weight: 800;">${val} <small style="color: #86efac; font-weight: normal;">(+${inc}/nv)</small></span>
              </div>
              <div class="attribute-item-bar">
                <div class="attribute-item-fill" style="width: ${pct}%;"></div>
              </div>
            </div>`;
        };

        const safeSelName = esc(selectedClass.namePtBr);
        const safeSelRace = esc(selectedClass.raceNamePtBr || selectedClass.raceCode);
        const safeSelDesc = esc(selectedClass.descriptionPtBr || 'Classe lendária de Etheria moldada pela harmonia arcana e treinamento marcial rigoroso.');

        previewContainer.innerHTML = `
          <div class="class-preview-card">
            <div class="class-preview-header">
              <img src="${thumb}" alt="${safeSelName}" onerror="this.src='/play/assets/hud/player_avatar_frame.png'" />
              <div>
                <h4 style="margin: 0; font-size: 1.15rem; color: #fde047;">${safeSelName}</h4>
                <div style="font-size: 0.78rem; color: #38bdf8; margin-top: 2px;">
                  Raça: <strong>${safeSelRace}</strong> &bull; Código: <code>${esc(selectedClass.code)}</code>
                </div>
                <div style="font-size: 0.76rem; color: #94a3b8; margin-top: 4px; line-height: 1.35;">
                  ${safeSelDesc}
                </div>
              </div>
            </div>

            <!-- Estilo de Combate -->
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <span class="hero-chip">⚔️ Estilo: <strong>${selectedClass.combatStyle === 'RANGED' ? 'À Distância' : 'Corpo a Corpo'}</strong></span>
              <span class="hero-chip">💥 Dano: <strong>${selectedClass.damageType === 'MAGICAL' ? 'Mágico' : 'Físico'}</strong></span>
              <span class="hero-chip">🎯 Alcance: <strong>${selectedClass.attackRange || 60}px</strong></span>
            </div>

            <!-- Os 6 Atributos Base Iniciais -->
            <div>
              <div style="font-size: 0.8rem; font-weight: 800; color: #f59e0b; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                <span>📊</span> 6 Atributos Primordiais de Base & Crescimento
              </div>
              <div class="attributes-six-grid">
                ${renderStat('VIT', 'Vitalidade', '❤️', 'Aumenta HP máximo e regeneração')}
                ${renderStat('STR', 'Força', '💪', 'Aumenta Ataque Físico')}
                ${renderStat('INT', 'Inteligência', '🔮', 'Aumenta Ataque Mágico e MP')}
                ${renderStat('WIS', 'Sabedoria', '✨', 'Aumenta Cura e Resistência')}
                ${renderStat('AGI', 'Agilidade', '⚡', 'Aumenta Velocidade e Evasão')}
                ${renderStat('DEX', 'Destreza', '🎯', 'Aumenta Precisão e Crítico')}
              </div>
            </div>
          </div>`;
      }
    };

    client.selectClassForCreation = function (classId) {
      this.selectedClassIdForCreation = Number(classId);
      this.renderCreationView();
    };

    // -------------------------------------------------------------------------
    // 3. AÇÕES DO LOBBY: CRIAR, EXCLUIR, ALTERNAR REBORN, ENTRAR
    // -------------------------------------------------------------------------
    client.createCharacter = async function () {
      const nameInput = document.getElementById('newCharName');
      const name = nameInput ? nameInput.value.trim() : '';
      if (!name) {
        alert('Por favor, digite o nome do seu novo herói.');
        return;
      }
      if (name.length < 2 || name.length > 24) {
        alert('O nome do personagem deve ter entre 2 e 24 caracteres.');
        return;
      }
      if (!this.selectedClassIdForCreation) {
        alert('Selecione uma Classe para o seu herói.');
        return;
      }

      try {
        const created = await this.api('/api/play/characters', {
          method: 'POST',
          body: JSON.stringify({
            name,
            classTemplateId: this.selectedClassIdForCreation,
          }),
        });

        if (nameInput) nameInput.value = '';
        await this.loadPlayBootstrap();
        const el = this.getElementStyle(created.elementCode);

        // Feedback comemorativo
        alert(
          `🎉 Parabéns! O Herói "${created.name}" despertou com sucesso em Etheria!\n\n` +
          `🎲 Elemento Primordial Concedido: ${el.icon} ${created.elementNamePtBr}\n` +
          `📍 Ponto de Spawn: Mapa #${created.currentMapId || 1} (${Math.round(created.posX)}, ${Math.round(created.posY)})\n\n` +
          `Entrando no mundo...`
        );

        await this.enterWorldWithCharacter(created.id);
      } catch (err) {
        alert(`Erro ao criar personagem: ${err.message}`);
      }
    };

    client.toggleCharacterReborn = async function (charId, hasRebornSkin) {
      if (!hasRebornSkin) {
        alert('ℹ️ A forma Reborn desta classe ainda está sendo forjada nos santuários de Etheria. Em breve novos visuais alternativos estarão disponíveis!');
        return;
      }

      try {
        await this.api(`/api/play/characters/${charId}/toggle-reborn`, { method: 'POST' });
        await this.loadPlayBootstrap();
        this.renderLobby();
      } catch (err) {
        alert(`Erro ao alternar skin: ${err.message}`);
      }
    };

    client.deleteCharacter = async function (charId) {
      const char = (this.myCharacters || []).find((c) => c.id === Number(charId));
      const charName = char ? char.name : `ID #${charId}`;
      if (!confirm(`⚠️ ATENÇÃO: Tem certeza que deseja excluir o personagem "${charName}"?\n\nEsta ação é irreversível!`)) {
        return;
      }

      try {
        await this.api(`/api/play/characters/${charId}`, { method: 'DELETE' });
        await this.loadPlayBootstrap();
        this.renderLobby();
      } catch (err) {
        alert(`Erro ao excluir personagem: ${err.message}`);
      }
    };

    client.enterWorldWithCharacter = async function (charId) {
      const found = (this.myCharacters || []).find((c) => c.id === Number(charId));
      if (!found) return;

      this.activeChar = found;
      if (window.PlayChatController) {
        window.PlayChatController.updatePlayer(found);
      }
      this.playerX = Number(found.posX) || 500;
      this.playerY = Number(found.posY) || 500;
      this.moveTargetX = null;
      this.moveTargetY = null;

      const lobbyScreen = document.getElementById('lobbyScreen');
      if (lobbyScreen) lobbyScreen.style.display = 'none';

      const worldScreen = document.getElementById('worldScreen');
      if (worldScreen) worldScreen.style.display = 'block';

      const isGmOrAdmin = this.session && ['ADMIN', 'GM', 'DEV'].includes(String(this.session.role || '').toUpperCase());
      const btnGm = document.getElementById('btnToggleGm');
      if (btnGm) btnGm.style.display = isGmOrAdmin ? 'inline-block' : 'none';
      window.PlayGmSandboxPanel?.refreshVisibility(this);

      if (isGmOrAdmin && window.location.pathname.startsWith('/gm')) {
        const gmDrawer = document.getElementById('gmDrawer');
        if (gmDrawer) gmDrawer.classList.add('open');
      }

      this.resizeCanvas();
      if (window.PlayPartyController) {
        window.PlayPartyController.init(this);
      }
      await this.loadMapIntoWorld(found.currentMapId || 1, this.playerX, this.playerY, null, { restoreFromChar: true });
    };

    client.backToLobby = function () {
      this.activeChar = null;
      const worldScreen = document.getElementById('worldScreen');
      if (worldScreen) worldScreen.style.display = 'none';
      this.loadPlayBootstrap().then(() => this.showLobby());
    };

    // -------------------------------------------------------------------------
    // 4. MODAL INFORMATIVO DE REGISTRO / CADASTRO
    // -------------------------------------------------------------------------
    client.showRegisterModal = function () {
      const modal = document.getElementById('registerNoticeModal');
      if (modal) modal.style.display = 'flex';
    };

    client.closeRegisterModal = function () {
      const modal = document.getElementById('registerNoticeModal');
      if (modal) modal.style.display = 'none';
    };
  }
}

window.PlayLobbyController = PlayLobbyController;
