/**
 * @file apps/server/public/admin/js/AdminUiStageRenderer.js
 * @description Renderizador WYSIWYG do Palco Visual de Interfaces no /admin.
 *   Renderiza as HUDs reais de Exploração (incluindo a nova HUD de Chat), HUDs de Batalha (Wild Rift)
 *   e Modais do jogo na resolução exata do layout selecionado (Mobile Vertical, Mobile Horizontal ou Desktop),
 *   com suporte completo a Click & Drag (mover), Alças de Redimensionamento/Escala (8 direções)
 *   e Galeria Visual para troca de ícones e imagens.
 */

class AdminUiStageRenderer {
  static getBuiltInHudAssets() {
    return [
      { label: 'Loja (Menu)', url: '/play/assets/hud/menu_shop.png' },
      { label: 'Pets (Menu)', url: '/play/assets/hud/menu_pets.png' },
      { label: 'Personagem (Menu)', url: '/play/assets/hud/menu_character.png' },
      { label: 'Mochila (Menu)', url: '/play/assets/hud/menu_inventory.png' },
      { label: 'Missões (Menu)', url: '/play/assets/hud/menu_quests.png' },
      { label: 'Eventos (Menu)', url: '/play/assets/hud/menu_events.png' },
      { label: 'Engrenagem Config', url: '/play/assets/hud/settings_gear_icon.png' },
      { label: 'Poção de Vida', url: '/play/assets/hud/shortcut_potion_hp.png' },
      { label: 'Poção de Mana', url: '/play/assets/hud/shortcut_potion_mp.png' },
      { label: 'Moeda de Ouro', url: '/play/assets/hud/gold_coin_icon.png' },
      { label: 'Cristal Astral', url: '/play/assets/hud/crystal_gem_icon.png' },
      { label: 'Moldura Avatar', url: '/play/assets/hud/player_avatar_frame.png' },
      { label: 'Moldura Minimapa', url: '/play/assets/hud/minimap_frame.png' },
      { label: 'Anel Joystick', url: '/play/assets/hud/joystick_outer_ring.png' },
      { label: 'Centro Interação', url: '/play/assets/hud/joystick_center_interact.png' },
      { label: 'Avatar Classe 1', url: '/play/assets/hud/avatars/class_1.png' },
    ];
  }

  static getSubIconsDefinition(code) {
    const map = {
      HUD_BOTTOM_MENU: [
        { key: '[data-action="shop"] img', label: '🛒 Botão Loja', def: '/play/assets/hud/menu_shop.png' },
        { key: '[data-action="pets"] img', label: '🐾 Botão Pets', def: '/play/assets/hud/menu_pets.png' },
        { key: '[data-action="character"] img', label: '🦸 Botão Personagem', def: '/play/assets/hud/menu_character.png' },
        { key: '[data-action="inventory"] img', label: '🎒 Botão Mochila', def: '/play/assets/hud/menu_inventory.png' },
        { key: '[data-action="quests"] img', label: '📜 Botão Missões', def: '/play/assets/hud/menu_quests.png' },
        { key: '[data-action="events"] img', label: '🎉 Botão Eventos', def: '/play/assets/hud/menu_events.png' },
      ],
      HUD_PLAYER_PROFILE: [
        { key: '#hudPlayerAvatarImg', label: '🧑 Retrato Principal', def: '/play/assets/hud/avatars/class_1.png' },
        { key: '.hud-avatar-frame', label: '🖼️ Moldura do Avatar', def: '/play/assets/hud/player_avatar_frame.png' },
        { key: '.hud-gold-badge img', label: '🪙 Ícone de Ouro', def: '/play/assets/hud/gold_coin_icon.png' },
        { key: '.hud-crystal-badge img', label: '💎 Ícone de Cristal', def: '/play/assets/hud/crystal_gem_icon.png' },
      ],
      HUD_MINIMAP: [
        { key: '.hud-minimap-frame', label: '🧭 Moldura da Bússola', def: '/play/assets/hud/minimap_frame.png' },
      ],
      HUD_JOYSTICK_EXPLORE: [
        { key: '.hud-joystick-ring', label: '⭕ Anel do Joystick', def: '/play/assets/hud/joystick_outer_ring.png' },
        { key: '#hudJoystickInteractBtn img', label: '💬 Botão Central de Ação', def: '/play/assets/hud/joystick_center_interact.png' },
      ],
      HUD_SHORTCUTS_DOCK: [
        { key: '[data-index="0"] img', label: '🧪 Ícone Slot #1', def: '/play/assets/hud/shortcut_potion_hp.png' },
        { key: '[data-index="1"] img', label: '💧 Ícone Slot #2', def: '/play/assets/hud/shortcut_potion_mp.png' },
      ],
      COMBAT_SKILLS_CLUSTER: [
        { key: '#imgActShortcut1', label: '🧪 Atalho Batalha Q', def: '/play/assets/hud/shortcut_potion_hp.png' },
        { key: '#imgActShortcut2', label: '💧 Atalho Batalha E', def: '/play/assets/hud/shortcut_potion_mp.png' },
      ],
    };
    return map[code] || [];
  }

  static buildStageSceneHtml(scene, selectedTemplate) {
    const isCombat = scene === 'COMBAT_HUD';
    const isModal = scene === 'MODAL' || scene === 'INTERFACE';

    const exploreHudHtml = `
      <!-- 1. HUD Perfil do Jogador -->
      <div id="hudPlayerSection" class="hud-player-section" data-ui-code="HUD_PLAYER_PROFILE">
        <div class="hud-player-header-card">
          <div class="hud-avatar-wrapper">
            <div class="hud-avatar-glow"></div>
            <img id="hudPlayerAvatarImg" class="hud-avatar-img" src="/play/assets/hud/avatars/class_1.png" alt="Avatar" />
            <img class="hud-avatar-frame" src="/play/assets/hud/player_avatar_frame.png" alt="Moldura" />
            <div class="hud-level-badge">Nv. 10</div>
          </div>
          <div class="hud-player-bars-col">
            <div class="hud-player-meta-row">
              <span class="hud-player-name">Dani</span>
              <span class="hud-player-class-tag">Guardião</span>
            </div>
            <div class="hud-stat-bar hud-stat-hp">
              <span class="hud-stat-pill">HP</span>
              <div class="hud-bar-track">
                <div class="hud-bar-fill hud-fill-hp" style="width: 88%;"><span class="hud-bar-sheen"></span></div>
                <span class="hud-bar-numeric-text">1080/1200</span>
              </div>
            </div>
            <div class="hud-stat-bar hud-stat-mp">
              <span class="hud-stat-pill">MP</span>
              <div class="hud-bar-track">
                <div class="hud-bar-fill hud-fill-mp" style="width: 75%;"><span class="hud-bar-sheen"></span></div>
                <span class="hud-bar-numeric-text">540/710</span>
              </div>
            </div>
            <div class="hud-stat-bar hud-stat-xp">
              <span class="hud-stat-pill">XP</span>
              <div class="hud-bar-track hud-track-xp">
                <div class="hud-bar-fill hud-fill-xp" style="width: 62%;"></div>
              </div>
            </div>
            <div class="hud-currencies-row">
              <div class="hud-currency-badge hud-gold-badge">
                <img src="/play/assets/hud/gold_coin_icon.png" alt="Ouro" />
                <span>12,450</span>
              </div>
              <div class="hud-currency-badge hud-crystal-badge">
                <img src="/play/assets/hud/crystal_gem_icon.png" alt="Cristal" />
                <span>1,500</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. HUD Minimapa -->
      <div id="hudMinimapSection" class="hud-minimap-section" data-ui-code="HUD_MINIMAP">
        <div class="hud-minimap-wrapper">
          <div style="width:100%; height:100%; border-radius:50%; background:radial-gradient(circle at 40% 40%, #1e3a5f, #091326); display:flex; align-items:center; justify-content:center; color:#38bdf8; font-size:0.65rem; font-weight:800;">
            🗺️ VILA IZUMO
          </div>
          <img class="hud-minimap-frame" src="/play/assets/hud/minimap_frame.png" alt="Bússola" />
        </div>
        <div class="hud-coords-badge">28, 34</div>
      </div>

      <!-- 3. Botão Engrenagem -->
      <button type="button" id="hudSettingsBtn" class="hud-settings-btn" data-ui-code="HUD_SETTINGS_BTN">
        <img src="/play/assets/hud/settings_gear_icon.png" alt="Configurações" />
      </button>

      <!-- 4. Barra de Atalhos Rápidos -->
      <div id="hudShortcutsSection" class="hud-shortcuts-section" data-ui-code="HUD_SHORTCUTS_DOCK">
        <div class="hud-shortcuts-dock">
          <button type="button" class="hud-shortcut-slot" data-index="0">
            <span class="hud-slot-num">1</span>
            <img class="hud-slot-icon" src="/play/assets/hud/shortcut_potion_hp.png" alt="HP" />
            <span class="hud-slot-count-badge">5</span>
          </button>
          <button type="button" class="hud-shortcut-slot" data-index="1">
            <span class="hud-slot-num">2</span>
            <img class="hud-slot-icon" src="/play/assets/hud/shortcut_potion_mp.png" alt="MP" />
            <span class="hud-slot-count-badge">5</span>
          </button>
          <button type="button" class="hud-shortcut-slot slot-empty" data-index="2"><span class="hud-slot-num">3</span><span class="hud-slot-empty-icon">❖</span></button>
          <button type="button" class="hud-shortcut-slot slot-empty" data-index="3"><span class="hud-slot-num">4</span><span class="hud-slot-empty-icon">❖</span></button>
        </div>
      </div>

      <!-- 5. HUD de Pets Equipados -->
      <div id="hudPetsSection" class="hud-pets-section" data-ui-code="HUD_PETS_PANEL" style="display:flex;">
        <div class="hud-pet-card">
          <div class="hud-pet-avatar-box">
            <span style="font-size:1.1rem;">🐾</span>
            <span class="hud-pet-lvl">10</span>
          </div>
          <div class="hud-pet-info">
            <div class="hud-pet-name">Lobo Astral</div>
            <div class="hud-pet-hp-track"><div class="hud-pet-hp-fill" style="width:90%;"></div></div>
          </div>
        </div>
      </div>

      <!-- 6. Joystick de Exploração -->
      <div id="hudJoystickSection" class="hud-joystick-section" data-ui-code="HUD_JOYSTICK_EXPLORE">
        <div class="hud-joystick-glow-halo"></div>
        <div class="hud-joystick-hint-badge">
          <span class="hint-bullet">●</span> MOVER <span class="hint-sep">|</span> AÇÃO <span class="hint-icon">💬</span>
        </div>
        <div class="hud-joystick-dial">
          <img class="hud-joystick-ring" src="/play/assets/hud/joystick_outer_ring.png" alt="Dial" />
          <div class="hud-joystick-stick">
            <button type="button" id="hudJoystickInteractBtn" class="hud-joystick-interact-btn">
              <img src="/play/assets/hud/joystick_center_interact.png" alt="Ação" />
            </button>
          </div>
        </div>
      </div>

      <!-- 7. Menu Inferior Principal (6 Botões) -->
      <nav id="hudBottomMenuSection" class="hud-bottom-menu-section" data-ui-code="HUD_BOTTOM_MENU">
        <div class="hud-bottom-dock">
          <button type="button" class="hud-menu-btn" data-action="shop"><img src="/play/assets/hud/menu_shop.png" alt="Loja" /></button>
          <button type="button" class="hud-menu-btn" data-action="pets"><img src="/play/assets/hud/menu_pets.png" alt="Pets" /></button>
          <button type="button" class="hud-menu-btn" data-action="character"><img src="/play/assets/hud/menu_character.png" alt="Personagem" /></button>
          <button type="button" class="hud-menu-btn" data-action="inventory"><img src="/play/assets/hud/menu_inventory.png" alt="Mochila" /></button>
          <button type="button" class="hud-menu-btn" data-action="quests"><img src="/play/assets/hud/menu_quests.png" alt="Missões" /></button>
          <button type="button" class="hud-menu-btn" data-action="events"><img src="/play/assets/hud/menu_events.png" alt="Eventos" /></button>
        </div>
      </nav>

      <!-- 8. Nova HUD de Chat Multi-Canal -->
      <section id="hudChatSection" class="hud-chat-section" data-ui-code="HUD_CHAT">
        <div class="hud-chat-header">
          <div class="hud-chat-tabs">
            <button type="button" class="hud-chat-tab active">Geral</button>
            <button type="button" class="hud-chat-tab">Mapa</button>
            <button type="button" class="hud-chat-tab">Grupo</button>
            <button type="button" class="hud-chat-tab">Sistema</button>
          </div>
          <button type="button" class="hud-chat-toggle-btn">▼</button>
        </div>
        <div class="hud-chat-body">
          <div class="hud-chat-messages">
            <div class="hud-chat-msg msg-system"><span class="chat-badge">[Sistema]</span> Bem-vindo a Etheria!</div>
            <div class="hud-chat-msg msg-map"><span class="chat-badge">[Mapa]</span> <strong>Sentinela Ren:</strong> O Véu oscila...</div>
          </div>
          <div class="hud-chat-input-row">
            <input type="text" class="hud-chat-input" placeholder="Digite sua mensagem..." readonly />
            <button type="button" class="hud-chat-send-btn">➤</button>
          </div>
        </div>
      </section>

      <!-- 9. Prompt de Interação NPC/Portal -->
      <div id="interactionPrompt" data-ui-code="HUD_INTERACTION_PROMPT" style="position:absolute; bottom:84px; left:50%; transform:translateX(-50%); z-index:25; display:flex; align-items:center; gap:10px; background:rgba(15,23,42,0.96); border:2px solid #a855f7; padding:8px 16px; border-radius:999px; box-shadow:0 8px 24px rgba(168,85,247,0.4); white-space:nowrap; pointer-events:auto;">
        <span style="font-size:0.78rem; font-weight:700; color:#f8fafc;">🧙 Guardião Genkapu</span>
        <button type="button" class="btn-primary" style="padding:4px 12px; border-radius:999px; font-size:0.74rem;">💬 Conversar</button>
      </div>
    `;

    if (isCombat) {
      const showResult = selectedTemplate && selectedTemplate.code === 'COMBAT_RESULT_BANNER';
      return `
        <!-- Placar Superior -->
        <div class="action-hud-top" data-ui-code="COMBAT_TOP_COUNTER" style="position:absolute; top:12px; left:16px; z-index:30; pointer-events:auto;">
          <div style="background:rgba(15,23,42,0.88); border:1px solid rgba(56,189,248,0.45); padding:6px 14px; border-radius:999px; font-size:0.75rem; color:#86efac; font-weight:700;">
            👾 <span>3</span> Restante(s) no Véu
          </div>
        </div>

        <!-- Botão de Engrenagem (Ativo em Batalha) -->
        <button type="button" id="hudSettingsBtn" class="hud-settings-btn" data-ui-code="HUD_SETTINGS_BTN">
          <img src="/play/assets/hud/settings_gear_icon.png" alt="Configurações" />
        </button>

        <!-- Banner de Preparação Tática -->
        <div id="actionPrepBanner" class="action-prep-banner" data-ui-code="COMBAT_PREP_BANNER" style="position:absolute; top:56px; left:50%; transform:translateX(-50%); background:rgba(15,23,42,0.92); border:1.5px solid #eab308; border-radius:12px; padding:8px 14px; display:flex; align-items:center; gap:12px; z-index:30; pointer-events:auto;">
          <div style="font-size:1.3rem; font-weight:900; color:#fde047; font-family:monospace;">18s</div>
          <div>
            <strong style="font-size:0.76rem; color:#f8fafc; display:block;">⚔️ Preparação no Véu</strong>
            <span style="font-size:0.65rem; color:#94a3b8;">Posicione-se ou clique em Pronto</span>
          </div>
          <button type="button" style="background:linear-gradient(135deg,#22c55e,#16a34a); color:#020617; font-weight:800; padding:6px 12px; border-radius:8px; font-size:0.74rem; border:none;">⚡ PRONTO!</button>
        </div>

        <!-- Unidade Simulada no Centro com Barras Overhead -->
        <div style="position:absolute; top:48%; left:46%; transform:translate(-50%,-50%); display:flex; flex-direction:column; align-items:center; pointer-events:none; opacity:0.85;">
          <div style="background:rgba(2,6,23,0.85); border:1px solid #334155; border-radius:4px; padding:2px 6px; width:74px; margin-bottom:4px;">
            <div style="font-size:0.58rem; color:#fde047; text-align:center; font-weight:700;">Dani (Nv.10)</div>
            <div style="height:4px; background:#1e293b; border-radius:2px; overflow:hidden; margin-top:1px;"><div style="width:85%; height:100%; background:#22c55e;"></div></div>
            <div style="height:3px; background:#1e293b; border-radius:2px; overflow:hidden; margin-top:1px;"><div style="width:70%; height:100%; background:#38bdf8;"></div></div>
          </div>
          <div style="width:42px; height:42px; border-radius:50%; background:radial-gradient(circle, rgba(56,189,248,0.4), transparent); border:2px solid #38bdf8; display:flex; align-items:center; justify-content:center; font-size:1.3rem;">🦸</div>
        </div>

        <!-- Joystick de Combate (Esquerda) -->
        <div id="actionJoystickZone" class="action-joystick-zone" data-ui-code="COMBAT_JOYSTICK" style="position:absolute; bottom:26px; left:26px; width:126px; height:126px; border-radius:50%; background:rgba(15,23,42,0.55); border:2px solid rgba(56,189,248,0.45); display:flex; align-items:center; justify-content:center; pointer-events:auto; z-index:30;">
          <div style="width:48px; height:48px; border-radius:50%; background:radial-gradient(circle, #38bdf8, #0284c7); box-shadow:0 0 12px rgba(56,189,248,0.6);"></div>
        </div>

        <!-- Cluster de Ataque e Skills Wild Rift (Direita) -->
        <div id="actionButtonsCluster" class="action-buttons-cluster" data-ui-code="COMBAT_SKILLS_CLUSTER" style="position:absolute; bottom:18px; right:18px; width:230px; height:210px; pointer-events:auto; z-index:30;">
          <button type="button" id="btnActShortcut1" style="position:absolute; bottom:14px; right:162px; width:40px; height:40px; border-radius:50%; background:#0f172a; border:1.5px solid #38bdf8; display:flex; align-items:center; justify-content:center; padding:4px;">
            <img id="imgActShortcut1" src="/play/assets/hud/shortcut_potion_hp.png" style="width:100%; height:100%; object-fit:contain;" />
          </button>
          <button type="button" id="btnActShortcut2" style="position:absolute; bottom:62px; right:168px; width:40px; height:40px; border-radius:50%; background:#0f172a; border:1.5px solid #38bdf8; display:flex; align-items:center; justify-content:center; padding:4px;">
            <img id="imgActShortcut2" src="/play/assets/hud/shortcut_potion_mp.png" style="width:100%; height:100%; object-fit:contain;" />
          </button>
          <button type="button" style="position:absolute; bottom:12px; right:104px; width:50px; height:50px; border-radius:50%; background:#1e293b; border:2px solid #eab308; font-size:1.2rem;">⚡</button>
          <button type="button" style="position:absolute; bottom:68px; right:102px; width:50px; height:50px; border-radius:50%; background:#1e293b; border:2px solid #eab308; font-size:1.2rem;">🌀</button>
          <button type="button" style="position:absolute; bottom:112px; right:64px; width:50px; height:50px; border-radius:50%; background:#1e293b; border:2px solid #eab308; font-size:1.2rem;">🛡️</button>
          <button type="button" style="position:absolute; bottom:124px; right:8px; width:52px; height:52px; border-radius:50%; background:#1e293b; border:2px solid #f43f5e; font-size:1.2rem;">💥</button>
          <button type="button" id="btnActAttack" style="position:absolute; bottom:14px; right:14px; width:76px; height:76px; border-radius:50%; background:linear-gradient(135deg,#f59e0b,#b45309); border:3px solid #fef08a; font-size:1.8rem; box-shadow:0 0 20px rgba(245,158,11,0.5);">⚔️</button>
        </div>

        <!-- Banner de Resultado -->
        <div id="actionResultBanner" data-ui-code="COMBAT_RESULT_BANNER" style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:270px; background:rgba(15,23,42,0.96); border:2px solid #eab308; border-radius:16px; padding:16px; text-align:center; z-index:45; pointer-events:auto; display:${showResult ? 'flex' : 'none'}; flex-direction:column; gap:8px;">
          <h3 style="margin:0; color:#fde047;">🏆 VITÓRIA NO VÉU!</h3>
          <div style="font-size:0.75rem; color:#cbd5e1;">+120 XP • +45 Ouro • 1x Essência</div>
          <button type="button" class="btn-primary" style="padding:6px 14px; border-radius:999px; font-size:0.75rem;">✅ Continuar</button>
        </div>
      `;
    }

    if (isModal) {
      const activeModal = selectedTemplate || {
        code: 'MODAL_CHARACTER',
        namePtBr: 'Modal de Ficha do Personagem',
        domSelector: '#playCharacterModal > div',
      };
      return `
        ${exploreHudHtml}
        <div style="position:absolute; inset:0; background:rgba(2,6,23,0.68); z-index:40; display:flex; align-items:center; justify-content:center; pointer-events:none;">
          ${this.buildModalPreviewDom(activeModal)}
        </div>
      `;
    }

    return exploreHudHtml;
  }

  static buildModalPreviewDom(tpl) {
    const code = tpl.code || 'MODAL_CHARACTER';
    const boxStyle = `background:#0f172a; border:2px solid #eab308; border-radius:16px; width:86%; max-width:520px; padding:14px; box-shadow:0 16px 40px rgba(0,0,0,0.9); pointer-events:auto; color:#f8fafc; display:flex; flex-direction:column; gap:10px;`;

    const wrapWithSelector = (selector, innerHtml) => {
      if (selector === '#gmDrawer') {
        return `<aside id="gmDrawer" data-ui-code="${code}" style="position:absolute; right:10px; top:54px; width:280px; background:#0f172a; border:1.5px solid #a855f7; border-radius:12px; padding:12px; pointer-events:auto; z-index:50; color:#f8fafc;">${innerHtml}</aside>`;
      }
      if (selector.includes('.hud-modal-dialog')) {
        const parentId = selector.split(' ')[0].replace('#', '');
        return `<div id="${parentId}" style="width:100%; display:flex; justify-content:center;"><div class="hud-modal-dialog" data-ui-code="${code}" style="${boxStyle}">${innerHtml}</div></div>`;
      }
      const parentId = selector.split('>')[0].trim().replace('#', '');
      return `<div id="${parentId}" style="width:100%; display:flex; justify-content:center;"><div data-ui-code="${code}" style="${boxStyle}">${innerHtml}</div></div>`;
    };

    const previewBody = `
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #334155; padding-bottom:8px;">
        <strong style="color:#fde047; font-size:0.95rem;">🪟 ${tpl.namePtBr}</strong>
        <span style="color:#94a3b8; font-weight:800; cursor:pointer;">✕</span>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:0.74rem; color:#cbd5e1;">
        <div style="background:#020617; border:1px solid #1e293b; border-radius:8px; padding:10px;">
          <div style="color:#38bdf8; font-weight:700; margin-bottom:4px;">Painel Principal</div>
          <div>Arraste esta janela para mover ou puxe as bordas/cantos para redimensionar neste layout.</div>
        </div>
        <div style="background:#020617; border:1px solid #1e293b; border-radius:8px; padding:10px;">
          <div style="color:#86efac; font-weight:700; margin-bottom:4px;">Seletor: ${tpl.domSelector}</div>
          <div>Cores de fundo, borda, raio e tamanho são aplicados ao vivo no /play.</div>
        </div>
      </div>
    `;

    return wrapWithSelector(tpl.domSelector || '#playCharacterModal > div', previewBody);
  }

  static attachStageInteractions(app) {
    const stage = document.getElementById('uiStudioStageScreen');
    if (!stage || stage.dataset.boundInteractions === 'true') return;
    stage.dataset.boundInteractions = 'true';

    let dragState = null;

    stage.addEventListener('pointerdown', (ev) => {
      const handleEl = ev.target.closest('[data-gizmo-handle]');
      const hudEl = ev.target.closest('[data-ui-code]');

      if (!handleEl && !hudEl) return;
      ev.preventDefault();
      ev.stopPropagation();

      if (hudEl && !handleEl) {
        const clickedCode = hudEl.getAttribute('data-ui-code');
        const found = (app.uiLayoutTemplates || []).find((t) => t.code === clickedCode);
        if (found && Number(app.selectedStudioUiId) !== Number(found.id)) {
          app.selectStudioUiElement(found.id);
        }
      }

      const activeTpl = app.getSelectedStudioTemplate();
      if (!activeTpl) return;

      const targetDom = stage.querySelector(`[data-ui-code="${activeTpl.code}"]`);
      if (!targetDom) return;

      const cfg = app.getActiveViewportConfig(activeTpl);
      const rect = targetDom.getBoundingClientRect();
      const stageZoom = app.studioStageZoom || 1;

      dragState = {
        mode: handleEl ? handleEl.getAttribute('data-gizmo-handle') : 'move',
        startX: ev.clientX,
        startY: ev.clientY,
        startOffsetX: Number(cfg.offsetX || 0),
        startOffsetY: Number(cfg.offsetY || 0),
        startScale: Number(cfg.scale || 1.0),
        startWidth: Number(cfg.widthPx || Math.round(rect.width / stageZoom)),
        startHeight: Number(cfg.heightPx || Math.round(rect.height / stageZoom)),
        stageZoom,
      };

      stage.setPointerCapture(ev.pointerId);
    });

    stage.addEventListener('pointermove', (ev) => {
      if (!dragState) return;
      const activeTpl = app.getSelectedStudioTemplate();
      if (!activeTpl) return;

      const cfg = app.getActiveViewportConfig(activeTpl);
      const dx = (ev.clientX - dragState.startX) / dragState.stageZoom;
      const dy = (ev.clientY - dragState.startY) / dragState.stageZoom;
      const snap = app.studioSnapGrid ? 5 : 1;

      const guideV = document.getElementById('uiStudioGuideV');
      const guideH = document.getElementById('uiStudioGuideH');

      if (dragState.mode === 'move') {
        let nx = Math.round((dragState.startOffsetX + dx) / snap) * snap;
        let ny = Math.round((dragState.startOffsetY + dy) / snap) * snap;

        if (Math.abs(nx) <= 4) {
          nx = 0;
          if (guideV) guideV.style.display = 'block';
        } else if (guideV) {
          guideV.style.display = 'none';
        }

        if (Math.abs(ny) <= 4) {
          ny = 0;
          if (guideH) guideH.style.display = 'block';
        } else if (guideH) {
          guideH.style.display = 'none';
        }

        cfg.offsetX = nx;
        cfg.offsetY = ny;
      } else if (['se', 'sw', 'ne', 'nw'].includes(dragState.mode)) {
        const sign = dragState.mode.includes('e') || dragState.mode.includes('s') ? 1 : -1;
        const delta = ((dx * sign) + (dy * sign)) / 220;
        const newScale = Math.min(2.5, Math.max(0.3, Number((dragState.startScale + delta).toFixed(2))));
        cfg.scale = newScale;
      } else if (dragState.mode === 'e' || dragState.mode === 'w') {
        const sign = dragState.mode === 'e' ? 1 : -1;
        cfg.widthPx = Math.max(40, Math.round(dragState.startWidth + dx * sign));
      } else if (dragState.mode === 's' || dragState.mode === 'n') {
        const sign = dragState.mode === 's' ? 1 : -1;
        cfg.heightPx = Math.max(28, Math.round(dragState.startHeight + dy * sign));
      }

      app.markStudioDirty(activeTpl.id);
      app.syncInspectorInputsFromConfig(cfg);
      app.applyStageLayoutsAndGizmo();
    });

    const endDrag = () => {
      if (!dragState) return;
      dragState = null;
      const guideV = document.getElementById('uiStudioGuideV');
      const guideH = document.getElementById('uiStudioGuideH');
      if (guideV) guideV.style.display = 'none';
      if (guideH) guideH.style.display = 'none';
    };

    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);
  }
}

window.AdminUiStageRenderer = AdminUiStageRenderer;
