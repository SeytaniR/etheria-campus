/**
 * @file apps/server/public/play/js/PlayHudController.js
 * @module @etheria/client/hud
 * @description Controlador Modular da Interface Principal do Jogador (Mobile Portrait & Responsivo).
 *   Implementa fielmente o layout de referência:
 *   - Topo-Esquerdo: Avatar circular do personagem com moldura dourada, Nível, Barras HP/MP/XP e Moedas (Ouro e Cristal).
 *   - Topo-Direito: Mini Mapa em tempo real com moldura ornamental de bússola, cone direcional do jogador,
 *     coordenadas dinâmicas e botão discreto de engrenagem para configurações.
 *   - Lateral Esquerda: Barra de atalhos rápidos com 6 slots para poções, comida e pergaminhos.
 *   - Lateral Direita: HUD compacta de até 3 Pets equipados (exibida SOMENTE quando houver pet equipado: 0 oculto, 1, 2 ou 3).
 *   - Canto Inferior Direito: Joystick virtual analógico com anel bússola e botão de interação central (balão de diálogo/ação).
 *   - Barra Inferior: 6 botões de menu (Loja, Pets, Personagem, Mochila, Quests, Eventos) SEM texto, apenas ícones.
 *   - Arquitetura 100% modulada para suporte futuro a personalização pelo jogador e pelo admin.
 */

class PlayHudController {
  constructor() {
    this.playApp = null;
    this.container = null;
    this.minimapCanvas = null;
    this.minimapCtx = null;
    this.minimapScale = 0.20;
    this.joystickActive = false;
    this.joystickPointerId = null;
    this.joystickCenter = { x: 0, y: 0 };
    this.joystickVector = { x: 0, y: 0 };

    // Configuração de Layout Padrão Modulado (preparado para edição/customização futura)
    this.layoutConfig = {
      version: 'v0.15.0',
      mode: 'mobile-portrait',
      playerHud: { enabled: true, top: 12, left: 12, scale: 1.0 },
      minimap: { enabled: true, top: 12, right: 12, scale: 1.0 },
      shortcuts: { enabled: true, left: 10, bottom: 95, scale: 1.0 },
      pets: { enabled: true, right: 10, top: 180, scale: 1.0 },
      joystick: { enabled: true, right: 20, bottom: 95, scale: 1.0 },
      bottomMenu: { enabled: true, bottom: 6, scale: 1.0 },
    };

    // Estado interno das Huds
    this.state = {
      character: null,
      map: null,
      playerX: 0,
      playerY: 0,
      playerDir: 0,
      equippedPets: [],
      gold: 0,
      diamonds: 0,
      shortcuts: [
        { id: 1, slotNum: 1, item: null, name: 'Slot #1 (Vazio)' },
        { id: 2, slotNum: 2, item: null, name: 'Slot #2 (Vazio)' },
        { id: 3, slotNum: 3, item: null, name: 'Slot #3 (Vazio)' },
        { id: 4, slotNum: 4, item: null, name: 'Slot #4 (Vazio)' },
        { id: 5, slotNum: 5, item: null, name: 'Slot #5 (Vazio)' },
        { id: 6, slotNum: 6, item: null, name: 'Slot #6 (Vazio)' },
      ],
    };
  }

  /**
   * Inicializa o controlador HUD, montando a árvore DOM e associando eventos ao PlayApp.
   */
  init(playApp) {
    this.playApp = playApp;
    this.buildDom();
    this.setupEvents();
    this.setupJoystick();
    console.log('🎮 [PlayHudController] HUD Modular Inicializada com Sucesso.');
  }

  /**
   * Constrói e injeta os elementos HTML no `#worldScreen`.
   */
  buildDom() {
    const worldScreen = document.getElementById('worldScreen');
    if (!worldScreen) return;

    // Remove HUD legada se existir
    const existing = document.getElementById('playMobileHud');
    if (existing) existing.remove();

    this.container = document.createElement('div');
    this.container.id = 'playMobileHud';
    this.container.className = 'play-mobile-hud';

    this.container.innerHTML = `
      <!-- 1. Topo-Esquerdo: Placa Real Unificada do Jogador (Avatar, Nome, Nível, HP/MP/XP e Economia) -->
      <div id="hudPlayerSection" class="hud-player-section">
        <div class="hud-player-header-card">
          <!-- Cuna do Avatar e Moldura Dourada -->
          <div class="hud-avatar-wrapper">
            <div class="hud-avatar-glow"></div>
            <img id="hudPlayerAvatarImg" class="hud-avatar-img" src="/play/assets/hud/avatars/class_1.png" alt="Avatar" />
            <img class="hud-avatar-frame" src="/play/assets/hud/player_avatar_frame.png" alt="Moldura" />
            <div id="hudPlayerLevelBadge" class="hud-level-badge">Nv. 1</div>
          </div>

          <!-- Placa de Status Esculpida e Integrada -->
          <div class="hud-player-bars-col">
            <!-- Linha do Nome do Personagem e Classe -->
            <div class="hud-player-meta-row">
              <span id="hudPlayerName" class="hud-player-name">Aventureiro</span>
              <span id="hudPlayerClass" class="hud-player-class-tag">Guerreiro</span>
            </div>

            <!-- Barra de HP (Vida) -->
            <div class="hud-stat-bar hud-stat-hp">
              <span class="hud-stat-pill">HP</span>
              <div class="hud-bar-track">
                <div id="hudFillHp" class="hud-bar-fill hud-fill-hp" style="width: 100%;">
                  <span class="hud-bar-sheen"></span>
                </div>
                <span id="hudTextHp" class="hud-bar-numeric-text">100%</span>
              </div>
            </div>

            <!-- Barra de MP (Mana) -->
            <div class="hud-stat-bar hud-stat-mp">
              <span class="hud-stat-pill">MP</span>
              <div class="hud-bar-track">
                <div id="hudFillMp" class="hud-bar-fill hud-fill-mp" style="width: 100%;">
                  <span class="hud-bar-sheen"></span>
                </div>
                <span id="hudTextMp" class="hud-bar-numeric-text">100%</span>
              </div>
            </div>

            <!-- Barra de XP (Experiência) -->
            <div class="hud-stat-bar hud-stat-xp">
              <span class="hud-stat-pill">XP</span>
              <div class="hud-bar-track hud-track-xp">
                <div id="hudFillXp" class="hud-bar-fill hud-fill-xp" style="width: 0%;"></div>
              </div>
            </div>

            <!-- Bandeja de Economia Integrada (Ouro e Cristais) -->
            <div class="hud-currencies-row">
              <div class="hud-currency-badge hud-gold-badge" title="Ouro">
                <img src="/play/assets/hud/gold_coin_icon.png" alt="Ouro" />
                <span id="hudGoldAmount">0</span>
              </div>
              <div class="hud-currency-badge hud-crystal-badge" title="Cristais">
                <img src="/play/assets/hud/crystal_gem_icon.png" alt="Cristal" />
                <span id="hudCrystalAmount">0</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. Topo-Direito: Mini Mapa Ampliado, Bússola e Coordenadas -->
      <div id="hudMinimapSection" class="hud-minimap-section" title="Toque no mapa para expandir e ver NPCs e Mapa Mundo">
        <div class="hud-minimap-wrapper" id="hudMinimapWrapper">
          <canvas id="hudMinimapCanvas" width="160" height="160"></canvas>
          <img class="hud-minimap-frame" src="/play/assets/hud/minimap_frame.png" alt="Bússola" />
        </div>
        <div id="hudCoordinatesBadge" class="hud-coords-badge">0, 0</div>
      </div>

      <!-- Botão de Configurações do Jogo (Engrenagem Superior Direita: Ativa em Exploração e Batalha) -->
      <button id="hudSettingsBtn" class="hud-settings-btn" title="Configurações do Jogo">
        <img src="/play/assets/hud/settings_gear_icon.png" alt="Configurações" />
      </button>

      <!-- Botão de Voo / Descida (Somente ícone, exibido apenas com Montaria Voadora equipada) -->
      <button type="button" id="hudFlightToggleBtn" class="hud-flight-btn is-unequipped" data-mount-equipped="false" style="display: none;" title="Voar / Descer da Montaria Voadora (Tecla V)">
        <img src="/play/assets/hud/flight_toggle_icon.png" alt="Voar / Pousar" />
      </button>

      <!-- 3. Lateral Esquerda: Barra de 6 Atalhos Rápidos com Caixas Elegantes Sem Falsos Ícones -->
      <div id="hudShortcutsSection" class="hud-shortcuts-section">
        <div id="hudShortcutsDock" class="hud-shortcuts-dock">
          ${this.state.shortcuts
            .map(
              (s, idx) => `
            <button type="button" class="hud-shortcut-slot ${!s.item ? 'slot-empty' : ''}" data-index="${idx}" title="${s.item ? `${s.item.name}${s.item.count !== undefined ? ' (x' + s.item.count + ')' : ''}` : `Slot de Atalho #${idx + 1} (Vazio)`}">
              <span class="hud-slot-num">${idx + 1}</span>
              ${s.item ? `<img class="hud-slot-icon" src="${s.item.icon}" alt="${s.item.name}" />${s.item.count !== undefined ? `<span class="hud-slot-count-badge">${s.item.count}</span>` : ''}` : `<span class="hud-slot-empty-icon">❖</span>`}
            </button>
          `
            )
            .join('')}
        </div>
        <button type="button" id="hudCollapseShortcutsBtn" class="hud-dock-collapse-btn hud-collapse-shortcuts-btn" title="Recolher Atalhos" aria-label="Recolher Atalhos">
          <span id="hudShortcutsCollapseIcon" class="hud-collapse-icon">◀</span>
        </button>
      </div>

      <!-- 4. Lateral Direita: HUD dos Pets Equipados (0 a 3) -->
      <div id="hudPetsSection" class="hud-pets-section" style="display: none;"></div>

      <!-- 5. Canto Inferior Direito: Joystick Virtual com Botão Central de Interação -->
      <div id="hudJoystickSection" class="hud-joystick-section">
        <div class="hud-joystick-glow-halo"></div>
        <div id="hudJoystickDial" class="hud-joystick-dial">
          <img class="hud-joystick-ring" src="/play/assets/hud/joystick_outer_ring.png" alt="Dial" />
          <div id="hudJoystickStick" class="hud-joystick-stick">
            <button type="button" id="hudJoystickInteractBtn" class="hud-joystick-interact-btn" title="Mover ou Tocar para Interagir / Conversar / Coletar">
              <img src="/play/assets/hud/joystick_center_interact.png" alt="Ação" />
            </button>
          </div>
        </div>
      </div>

      <!-- 6. Barra Inferior: Menu Mobile Amigável com Ícones + Rótulos Sutis e Badge de Missões -->
      <nav id="hudBottomMenuSection" class="hud-bottom-menu-section">
        <button type="button" id="hudCollapseBottomMenuBtn" class="hud-dock-collapse-btn hud-collapse-bottom-btn" title="Recolher Menu" aria-label="Recolher Menu">
          <span id="hudBottomCollapseIcon" class="hud-collapse-icon">▾</span>
        </button>
        <div id="hudBottomDock" class="hud-bottom-dock">
          <button type="button" class="hud-menu-btn" data-action="shop" title="Loja">
            <span class="hud-menu-icon-wrap"><img src="/play/assets/hud/menu_shop.png" alt="Loja" /></span>
            <span class="hud-menu-label">Loja</span>
          </button>
          <button type="button" class="hud-menu-btn" data-action="pets" title="Pets">
            <span class="hud-menu-icon-wrap"><img src="/play/assets/hud/menu_pets.png" alt="Pets" /></span>
            <span class="hud-menu-label">Pets</span>
          </button>
          <button type="button" class="hud-menu-btn" data-action="character" title="Personagem">
            <span class="hud-menu-icon-wrap"><img src="/play/assets/hud/menu_character.png" alt="Personagem" /></span>
            <span class="hud-menu-label">Herói</span>
          </button>
          <button type="button" class="hud-menu-btn" data-action="inventory" title="Mochila / Inventário">
            <span class="hud-menu-icon-wrap"><img src="/play/assets/hud/menu_inventory.png" alt="Mochila" /></span>
            <span class="hud-menu-label">Mochila</span>
          </button>
          <button type="button" class="hud-menu-btn" data-action="quests" title="Missões">
            <span class="hud-menu-icon-wrap">
              <img src="/play/assets/hud/menu_quests.png" alt="Quests" />
              <span id="hudBottomQuestsBadge" class="hud-menu-badge" style="display:none;">0</span>
            </span>
            <span class="hud-menu-label">Quests</span>
          </button>
          <button type="button" class="hud-menu-btn" data-action="events" title="Eventos">
            <span class="hud-menu-icon-wrap">
              <img src="/play/assets/hud/menu_events.png" alt="Eventos" />
              <span id="hudBottomEventsBadge" class="hud-menu-badge" style="display:none;">0</span>
            </span>
            <span class="hud-menu-label">Eventos</span>
          </button>
        </div>
      </nav>

      <!-- 7. HUD de Chat Multi-Canal (Gerenciado por PlayChatController.js) -->
      <section id="hudChatSection" class="hud-chat-section"></section>
    `;

    worldScreen.appendChild(this.container);

    this.minimapCanvas = document.getElementById('hudMinimapCanvas');
    if (this.minimapCanvas) {
      this.minimapCtx = this.minimapCanvas.getContext('2d');
    }
  }

  /**
   * Associa os eventos de clique nos menus, atalhos e configurações.
   */
  setupEvents() {
    // 1. Botões do Menu Inferior
    const menuButtons = this.container.querySelectorAll('.hud-menu-btn');
    menuButtons.forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const action = btn.getAttribute('data-action');
        this.handleMenuAction(action);
      });
    });

    // 2. Slots da Barra de Atalhos
    const shortcutSlots = this.container.querySelectorAll('.hud-shortcut-slot');
    shortcutSlots.forEach((slot) => {
      slot.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const idx = Number(slot.getAttribute('data-index'));
        this.triggerShortcut(idx, slot);
      });
    });

    // 3. Mini Mapa: Clique abre o Mapa Local Expandido com NPCs e Botão de Mapa Mundo
    const minimapWrapper = document.getElementById('hudMinimapWrapper');
    if (minimapWrapper) {
      minimapWrapper.addEventListener('click', (ev) => {
        if (ev.target.closest('#hudSettingsBtn')) return;
        ev.stopPropagation();
        if (window.PlayMapModalController) {
          window.PlayMapModalController.openExpandedMap(
            this.playApp,
            this.state.map,
            this.mapBgImage,
            this.state.playerX,
            this.state.playerY
          );
        }
      });
    }

    // 4. Botão de Configurações (Engrenagem)
    const settingsBtn = document.getElementById('hudSettingsBtn');
    if (settingsBtn) settingsBtn.addEventListener('click', (ev) => { ev.stopPropagation(); this.openSettingsMenu(); });

    // 4.1. Vincula botão de Voo exclusivamente via PlayFlightAndWingsController (evita duplo clique)
    window.PlayFlightAndWingsController?.updateFlightHudButton(this.playApp || window.PlayApp);

    // 5. Clique / Tap no Avatar do Jogador (abre atributos)
    const avatar = document.getElementById('hudPlayerAvatarImg');
    if (avatar) avatar.addEventListener('click', () => { window.PlayApp?.openStatsModal?.(); });

    // 6. Botão Central de Ação do Joystick
    const interactBtn = document.getElementById('hudJoystickInteractBtn');
    if (interactBtn) {
      interactBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (this.joystickDragged) return;
        this.triggerInteraction();
      });
    }

    // 7. Botão Discreto de Recolher/Expandir Atalhos Esquerdos
    const collapseShortcutsBtn = document.getElementById('hudCollapseShortcutsBtn');
    const shortcutsDock = document.getElementById('hudShortcutsDock');
    const shortcutsIcon = document.getElementById('hudShortcutsCollapseIcon');
    if (collapseShortcutsBtn && shortcutsDock) {
      collapseShortcutsBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const isCollapsed = shortcutsDock.classList.toggle('is-collapsed');
        collapseShortcutsBtn.classList.toggle('is-collapsed', isCollapsed);
        if (shortcutsIcon) shortcutsIcon.textContent = isCollapsed ? '▶' : '◀';
        collapseShortcutsBtn.title = isCollapsed ? 'Expandir Atalhos' : 'Recolher Atalhos';
      });
    }

    // 8. Botão Discreto de Recolher/Expandir Menu Inferior
    const collapseBottomBtn = document.getElementById('hudCollapseBottomMenuBtn');
    const bottomDock = document.getElementById('hudBottomDock');
    const bottomIcon = document.getElementById('hudBottomCollapseIcon');
    if (collapseBottomBtn && bottomDock) {
      collapseBottomBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const isCollapsed = bottomDock.classList.toggle('is-collapsed');
        collapseBottomBtn.classList.toggle('is-collapsed', isCollapsed);
        if (bottomIcon) bottomIcon.textContent = isCollapsed ? '▴' : '▾';
        collapseBottomBtn.title = isCollapsed ? 'Expandir Menu' : 'Recolher Menu';
      });
    }
    this.playApp?.updateQuestHudBadge?.();
    window.PlayEventsController?.refreshBadge?.(this.playApp);

    // 9. HUD de Chat Multi-Canal Autoritário
    if (window.PlayChatController) {
      window.PlayChatController.init(this.client || window.PlayApp);
    }
  }

  /**
   * Configura o joystick virtual com suporte touch e pointer para mobile.
   */
  setupJoystick() {
    const dial = document.getElementById('hudJoystickDial');
    const stick = document.getElementById('hudJoystickStick');
    if (!dial || !stick) return;

    const maxRadius = 46; // limite de arraste proporcional ao dial ampliado
    this.joystickDragged = false;

    const onPointerDown = (ev) => {
      this.joystickActive = true;
      this.joystickPointerId = ev.pointerId;
      this.joystickDragged = false;
      dial.setPointerCapture(ev.pointerId);

      const rect = dial.getBoundingClientRect();
      this.joystickCenter = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
      updateThumb(ev.clientX, ev.clientY);
    };

    const updateThumb = (clientX, clientY) => {
      const dx = clientX - this.joystickCenter.x;
      const dy = clientY - this.joystickCenter.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 10) {
        this.joystickDragged = true;
      }

      if (dist === 0) {
        stick.style.transform = `translate(0px, 0px)`;
        this.setMoveVector(0, 0);
        return;
      }

      const clampedDist = Math.min(dist, maxRadius);
      const angle = Math.atan2(dy, dx);
      const thumbX = clampedDist * Math.cos(angle);
      const thumbY = clampedDist * Math.sin(angle);

      stick.style.transform = `translate(${thumbX}px, ${thumbY}px)`;

      // Normaliza para [-1, 1] com zona morta de 8px
      const deadZone = 8;
      if (dist < deadZone) {
        this.setMoveVector(0, 0);
      } else {
        const nx = dx / dist;
        const ny = dy / dist;
        this.setMoveVector(nx, ny);
      }
    };

    const onPointerMove = (ev) => {
      if (!this.joystickActive || ev.pointerId !== this.joystickPointerId) return;
      updateThumb(ev.clientX, ev.clientY);
    };

    const onPointerUp = (ev) => {
      if (ev.pointerId !== this.joystickPointerId) return;
      this.joystickActive = false;
      this.joystickPointerId = null;
      stick.style.transform = `translate(0px, 0px)`;
      this.setMoveVector(0, 0);
    };

    dial.addEventListener('pointerdown', onPointerDown);
    dial.addEventListener('pointermove', onPointerMove);
    dial.addEventListener('pointerup', onPointerUp);
    dial.addEventListener('pointercancel', onPointerUp);
  }

  /**
   * Converte o vetor do joystick virtual em direção para o motor do jogo.
   */
  setMoveVector(vx, vy) {
    this.joystickVector = { x: vx, y: vy };
    if (!this.playApp) return;

    if (vx === 0 && vy === 0) {
      if (typeof this.playApp.setDpad === 'function') {
        this.playApp.setDpad(0, 0);
      }
      return;
    }

    // Mapeia para 8 direções limpas
    const threshold = 0.38;
    const dx = vx > threshold ? 1 : vx < -threshold ? -1 : 0;
    const dy = vy > threshold ? 1 : vy < -threshold ? -1 : 0;

    if (typeof this.playApp.setDpad === 'function') {
      this.playApp.setDpad(dx, dy);
    }
  }

  /**
   * Dispara a ação de interação principal (conversar com NPC, portal ou interagir).
   */
  triggerInteraction() {
    // 1. Se houver prompt de interação visível (#interactionBtn), dispara seu clique
    const promptBtn = document.getElementById('interactionBtn');
    const promptContainer = document.getElementById('interactionPrompt');
    if (promptContainer && promptContainer.style.display !== 'none' && promptBtn) {
      promptBtn.click();
      return;
    }

    // 2. Se estiver perto de um portal, aciona
    if (this.playApp && typeof this.playApp.checkNearbyInteractions === 'function') {
      this.playApp.checkNearbyInteractions();
      return;
    }

    // 3. Efeito visual tátil de clique
    const btn = document.getElementById('hudJoystickInteractBtn');
    if (btn) {
      btn.classList.add('hud-btn-pressed');
      setTimeout(() => btn.classList.remove('hud-btn-pressed'), 180);
    }
  }

  /**
   * Executa a ação do menu inferior.
   */
  handleMenuAction(action) {
    if (!this.playApp) return;

    switch (action) {
      case 'shop':
        window.PlayCrystalShopController?.openModal?.(this.playApp);
        break;
      case 'pets':
        this.openPetsWindow();
        break;
      case 'character':
        if (typeof this.playApp.openStatsModal === 'function') {
          this.playApp.openStatsModal();
        }
        break;
      case 'inventory':
        if (typeof this.playApp.openBagModal === 'function') {
          this.playApp.openBagModal();
        }
        break;
      case 'quests':
        if (typeof this.playApp.openQuestLogModal === 'function') {
          this.playApp.openQuestLogModal();
        }
        break;
      case 'events':
        window.PlayEventsController?.openModal?.(this.playApp);
        break;
    }
  }

  /**
   * Alterna modo de combate: oculta minimapa, menus, perfil, pets e atalhos de exploração.
   */
  setCombatMode(isActive) {
    if (isActive) {
      document.body.classList.add('is-in-combat');
      document.body.classList.remove('is-fishing');
      window.PlayFishingController?.onEnterCombat?.();
      window.PlayEventsController?.closeModal?.();
      window.PlayCrystalShopController?.closeModal?.();
    } else {
      document.body.classList.remove('is-in-combat');
      window.PlayFishingController?.onExitCombat?.();
    }
  }

  /**
   * Atualiza visualmente os slots da barra de atalhos de exploração.
   */
  updateShortcutsDisplay() {
    const dock = document.getElementById('hudShortcutsDock');
    if (!dock) return;
    const slots = dock.querySelectorAll('.hud-shortcut-slot');
    slots.forEach((slotEl, idx) => {
      const s = this.state.shortcuts[idx];
      if (!s) return;
      if (s.item) {
        slotEl.classList.remove('slot-empty');
        slotEl.title = `${s.item.name}${s.item.count !== undefined ? ' (x' + s.item.count + ')' : ''}`;
        slotEl.innerHTML = `
          <span class="hud-slot-num">${idx + 1}</span>
          <img class="hud-slot-icon" src="${s.item.icon}" alt="${s.item.name}" />
          ${s.item.count !== undefined ? `<span class="hud-slot-count-badge">${s.item.count}</span>` : ''}
        `;
      } else {
        slotEl.classList.add('slot-empty');
        slotEl.title = `Slot de Atalho #${idx + 1} (Vazio)`;
        slotEl.innerHTML = `
          <span class="hud-slot-num">${idx + 1}</span>
          <span class="hud-slot-empty-icon">❖</span>
        `;
      }
    });
  }

  /**
   * Dispara o uso de um item do slot de atalhos.
   */
  triggerShortcut(idx, slotEl) {
    const slot = this.state.shortcuts[idx];
    if (!slot) return;
    if (slotEl) {
      slotEl.classList.add('hud-slot-pressed');
      setTimeout(() => slotEl.classList.remove('hud-slot-pressed'), 200);
    }
    if (!slot.item) {
      if (this.playApp?.showNotification) {
        this.playApp.showNotification(`Slot #${idx + 1} vazio. Equipe consumíveis pela mochila!`, 'info');
      }
      return;
    }
    if (this.playApp?.actionArena?.isActive) {
      this.playApp.actionArena.triggerCombatShortcut(idx);
      return;
    }
    const it = slot.item;
    if (it.count !== undefined && it.count <= 0) {
      if (this.playApp?.showNotification) this.playApp.showNotification(`${it.name} esgotado!`, 'warning');
      return;
    }
    if (it.count !== undefined) it.count--;
    if (this.playApp?.showNotification) this.playApp.showNotification(`Usou ${it.name}!`, 'success');
    this.updateShortcutsDisplay();
  }

  /**
   * Abre o menu de configurações e opções do jogo.
   */
  openSettingsMenu() {
    return window.PlayHudMinimapAndModals?.openSettingsMenu(this);
  }

  /**
   * Abre a janela de gerenciamento procedural dos pets do jogador.
   */
  openPetsWindow() {
    return window.PlayHudMinimapAndModals?.openPetsWindow();
  }

  // ==========================================================================
  // ATUALIZAÇÃO REATIVA DE DADOS & RENDERIZAÇÃO
  // ==========================================================================

  /**
   * Atualiza as informações do jogador na HUD Superior Esquerda.
   */
  updatePlayer(charData) {
    if (!charData) return;
    this.state.character = charData;

    if (window.PlayChatController) {
      window.PlayChatController.updatePlayer(charData);
    }

    // 1. Avatar do Personagem (imagem oficial recortada dos 12 heróis com máximo preenchimento)
    const avatarImg = document.getElementById('hudPlayerAvatarImg');
    if (avatarImg) {
      const classId = charData.classTemplateId || charData.classTemplate?.id;
      const classCode = charData.classCode || (classId ? `class_${classId}` : null) || charData.classTemplate?.code;
      const officialAvatar = classCode ? `/play/assets/hud/avatars/${classCode}.png` : null;

      const thumb =
        officialAvatar ||
        charData.avatarUrl ||
        charData.thumbUrl ||
        charData.classTemplate?.avatarUrl ||
        (charData.mcreworkCharKey ? `/api/assets/mcrework/assets/characters/${charData.mcreworkCharKey}/thumb.webp` : null) ||
        (charData.classTemplate?.mcreworkCharKey ? `/api/assets/mcrework/assets/characters/${charData.classTemplate.mcreworkCharKey}/thumb.webp` : null) ||
        '/play/assets/hud/avatars/class_1.png';
      avatarImg.src = thumb;
    }

    // 2. Metadados do Jogador (Nome, Classe e Nível)
    const nameEl = document.getElementById('hudPlayerName');
    if (nameEl) {
      nameEl.textContent = charData.name || 'Aventureiro';
    }

    const classEl = document.getElementById('hudPlayerClass');
    if (classEl) {
      const clsName = charData.classNamePtBr || charData.className || charData.classTemplate?.name || 'Guerreiro';
      classEl.textContent = clsName;
    }

    const lvlBadge = document.getElementById('hudPlayerLevelBadge');
    if (lvlBadge) {
      lvlBadge.textContent = `Nv. ${charData.level || 1}`;
    }

    // 3. Barras de Vida, Mana e Experiência
    const fillHp = document.getElementById('hudFillHp');
    const textHp = document.getElementById('hudTextHp');
    if (fillHp) {
      const curHp = charData.currentHp !== undefined ? charData.currentHp : (charData.hp !== undefined ? charData.hp : 100);
      const maxHp = charData.maxHp || 100;
      const pct = Math.max(0, Math.min(100, Math.round((curHp / maxHp) * 100)));
      fillHp.style.width = `${pct}%`;
      if (textHp) textHp.textContent = `${pct}%`;
    }

    const fillMp = document.getElementById('hudFillMp');
    const textMp = document.getElementById('hudTextMp');
    if (fillMp) {
      const curMp = charData.currentMp !== undefined ? charData.currentMp : (charData.mp !== undefined ? charData.mp : 100);
      const maxMp = charData.maxMp || 100;
      const pct = Math.max(0, Math.min(100, Math.round((curMp / maxMp) * 100)));
      fillMp.style.width = `${pct}%`;
      if (textMp) textMp.textContent = `${pct}%`;
    }

    const fillXp = document.getElementById('hudFillXp');
    if (fillXp) {
      const curXp = charData.currentXp !== undefined ? charData.currentXp : (charData.experience !== undefined ? charData.experience : 0);
      const maxXp = charData.maxXp || 1000;
      const pct = Math.max(0, Math.min(100, Math.round((curXp / maxXp) * 100)));
      fillXp.style.width = `${pct}%`;
    }

    // 4. Moedas (Ouro do Personagem e Cristais da Conta)
    const gold = charData.gold !== undefined ? charData.gold : this.state.gold;
    const crystals =
      charData.crystals !== undefined
        ? charData.crystals
        : charData.diamonds !== undefined
        ? charData.diamonds
        : this.state.diamonds;
    this.updateCurrencies(gold, crystals);

    // 5. Pets equipados vinculados ao personagem
    const pets = charData.equippedPets || charData.pets;
    if (Array.isArray(pets)) {
      this.updatePets(pets);
    }
  }

  /**
   * Atualiza as moedas do jogador.
   */
  updateCurrencies(gold, diamonds = 0) {
    this.state.gold = Number(gold) || 0;
    this.state.diamonds = Number(diamonds) || 0;

    const goldEl = document.getElementById('hudGoldAmount');
    if (goldEl) {
      goldEl.textContent = this.state.gold.toLocaleString('pt-BR');
    }

    const diamondEl = document.getElementById('hudCrystalAmount');
    if (diamondEl) {
      diamondEl.textContent = this.state.diamonds.toLocaleString('pt-BR');
    }
  }

  /**
   * Atualiza a HUD dos Pets na Lateral Direita.
   * REGRA ESTRITA: Exibe SOMENTE quando houver pet equipado.
   */
  updatePets(petsList) {
    return window.PlayHudMinimapAndModals?.updatePets(this, petsList);
  }

  /**
   * Renderiza o Mini Mapa em tempo real com visão circular do mapa atual,
   * marcador direcional do jogador e coordenadas exatas.
   */
  updateMinimap(currentMap, mapImage, playerX, playerY, playerDir = 0) {
    return window.PlayHudMinimapAndModals?.updateMinimap(this, currentMap, mapImage, playerX, playerY, playerDir);
  }

  pulseLevelBadge(newLevel) {
    const lvlBadge = document.getElementById('hudPlayerLevelBadge');
    if (lvlBadge) {
      lvlBadge.textContent = `Nv. ${newLevel}`;
      lvlBadge.classList.add('level-up-pulse');
      setTimeout(() => lvlBadge.classList.remove('level-up-pulse'), 1800);
    }
  }
}

// Exporta como singleton global
window.PlayHudController = new PlayHudController();
