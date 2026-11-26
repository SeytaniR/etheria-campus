/**
 * @file PlayHudMinimapAndModals.js
 * @description Sub-módulo da HUD do jogador responsável pelos modais de opções/pets,
 * barra lateral de pets equipados e renderização do minimapa circular em canvas.
 */
class PlayHudMinimapAndModals {
  /**
   * Abre o menu de configurações e opções do jogo.
   */
  static openSettingsMenu(hud) {
    const isGm = Boolean(hud?.playApp && hud.playApp.session && ['ADMIN', 'GM', 'DEV'].includes(String(hud.playApp.session.role || '').toUpperCase()));
    const isCombatActive = Boolean(hud?.playApp?.actionArena?.isActive);
    const tr = (k, fb) => (window.EtheriaI18n ? window.EtheriaI18n.t(k) : fb);
    const localeOpts = window.EtheriaI18n ? window.EtheriaI18n.renderLocaleOptionsHtml() : '<option value="pt-BR">🇧🇷 PT-BR</option><option value="en-US">🇺🇸 EN-US</option><option value="es-ES">🇪🇸 ES-ES</option>';

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.id = 'hudSettingsModal';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="hud-modal-dialog">
        <div class="hud-modal-header">
          <h3>${tr('play.settings.title', '⚙️ Opções & Configurações')}</h3>
          <button class="hud-modal-close" onclick="document.getElementById('hudSettingsModal').remove()">✕</button>
        </div>
        <div class="hud-modal-body">
          ${
            isCombatActive
              ? `<div class="hud-settings-row" style="background:rgba(239, 68, 68, 0.15); border:1.5px solid #ef4444; border-radius:8px; padding:10px 12px; margin-bottom:4px;">
              <div style="display:flex; flex-direction:column; gap:2px;"><span style="color:#fca5a5; font-weight:800; font-size:0.86rem;">${tr('play.settings.combatActive', '⚔️ Combate em Andamento')}</span><small style="color:#f87171; font-size:0.72rem;">${tr('play.settings.combatRetreatHint', 'Recuar com segurança e voltar ao mapa')}</small></div>
              <button class="btn-danger" style="background:#ef4444; color:#fff; font-weight:800; padding:8px 16px; border-radius:8px; cursor:pointer;" onclick="if(window.PlayApp?.actionArena) { window.PlayApp.actionArena.fleeBattle(); } document.getElementById('hudSettingsModal').remove();">${tr('play.settings.btnFlee', '🏃 Fugir da Batalha')}</button>
            </div>`
              : ''
          }
          <div class="hud-settings-row" style="background:rgba(56, 189, 248, 0.12); border:1.5px solid #38bdf8; border-radius:8px; padding:9px 11px;">
            <div style="display:flex; flex-direction:column; gap:2px;">
              <span style="color:#7dd3fc; font-weight:800; font-size:0.85rem;">${tr('play.settings.customHudTitle', '📐 Personalizar Interface (HUDs)')}</span>
              <small style="color:#94a3b8; font-size:0.7rem;">${tr('play.settings.customHudHint', 'Mover, redimensionar e mudar cores no seu dispositivo')}</small>
            </div>
            <button class="btn-primary" onclick="if(window.PlayClientHudEditor) window.PlayClientHudEditor.openEditor(); document.getElementById('hudSettingsModal')?.remove();">${tr('play.settings.btnEditHud', '🎨 Editar HUDs')}</button>
          </div>
          <div class="hud-settings-row">
            <div style="display:flex; flex-direction:column; gap:2px;">
              <span>${tr('play.settings.languageTitle', '🌐 Idioma do Jogo')}</span>
              <small style="color:#94a3b8; font-size:0.7rem;">${tr('play.settings.languageHint', 'Altera interface e entidades traduzidas')}</small>
            </div>
            <select data-i18n-locale-select onchange="window.PlayApp?.changeLocale(this.value)" style="background:#0f172a; color:#f8fafc; border:1px solid #475569; border-radius:6px; padding:5px 8px; font-size:0.8rem; cursor:pointer;">${localeOpts}</select>
          </div>
          <div class="hud-settings-row">
            <span>${tr('play.settings.soundTitle', '🔊 Efeitos Sonoros & Música')}</span>
            <input type="checkbox" checked style="width:24px; height:24px; accent-color:#f59e0b;" />
          </div>
          <div class="hud-settings-row">
            <span>${tr('play.settings.centerCamera', '📍 Centralizar Câmera no Jogador')}</span>
            <button class="btn-primary" onclick="if(window.PlayApp) window.PlayApp.centerCameraOnPlayer(); document.getElementById('hudSettingsModal').remove();">${tr('play.settings.btnCenter', 'Centralizar')}</button>
          </div>
          <div class="hud-settings-row">
            <span>${tr('play.settings.unstuckTitle', '🆘 Destravar Personagem (Spawn)')}</span>
            <button class="btn-amber" onclick="if(window.PlayApp) window.PlayApp.unstuckCharacter(); document.getElementById('hudSettingsModal').remove();">${tr('play.settings.btnUnstuck', 'Destravar')}</button>
          </div>
          ${
            isGm
              ? `<div class="hud-settings-row" style="border-top:1px dashed #475569; padding-top:10px; gap:6px; flex-wrap:wrap;">
              <span style="color:#c084fc; font-weight:700;">${tr('play.settings.gmTitle', '⚡ Painel & Arsenal GM')}</span>
              <div style="display:flex; gap:6px;">
                <button class="btn-primary" style="background:#7e22ce;" onclick="window.PlayGmSandboxPanel?.openModal(); document.getElementById('hudSettingsModal')?.remove();">${tr('play.settings.btnGmArsenal', '🧰 Arsenal GM')}</button>
                <button class="btn-gm" onclick="if(window.PlayApp) window.PlayApp.toggleGmDrawer(); document.getElementById('hudSettingsModal')?.remove();">${tr('play.settings.btnGmPanel', '⚡ Painel GM')}</button>
              </div>
            </div>`
              : ''
          }
          <div class="hud-settings-row" style="border-top:1px dashed #475569; padding-top:10px;">
            <span>${tr('play.settings.switchChar', '🔄 Trocar de Personagem')}</span>
            <button onclick="if(window.PlayApp) window.PlayApp.backToLobby(); document.getElementById('hudSettingsModal').remove();">${tr('play.settings.btnSwitch', 'Trocar')}</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  /**
   * Abre a janela de gerenciamento procedural dos pets do jogador.
   */
  static openPetsWindow() {
    if (window.PlayPetsController) {
      window.PlayPetsController.openModal();
    }
  }

  /**
   * Atualiza a HUD dos Pets na Lateral Direita.
   * REGRA ESTRITA: Exibe SOMENTE quando houver pet equipado.
   */
  static updatePets(hud, petsList) {
    const petsSection = document.getElementById('hudPetsSection');
    if (!petsSection) return;

    const safeList = Array.isArray(petsList) ? petsList.slice(0, 3) : [];
    if (hud?.state) hud.state.equippedPets = safeList;

    if (safeList.length === 0) {
      petsSection.style.display = 'none';
      petsSection.innerHTML = '';
      return;
    }

    petsSection.style.display = 'flex';
    petsSection.innerHTML = safeList
      .map((pet) => {
        const nickname = pet.nickname || pet.name || pet.monsterTemplate?.namePtBr || 'Pet';
        const thumbUrl = pet.thumbUrl || pet.iconUrl || pet.monsterTemplate?.thumbUrl || '/play/assets/hud/menu_pets.png';
        const level = pet.level || 1;
        const hpPct = pet.hpPct !== undefined ? pet.hpPct : (pet.maxHp ? Math.min(100, Math.max(0, Math.round((pet.currentHp / pet.maxHp) * 100))) : 100);
        const mpPct = pet.mpPct !== undefined ? pet.mpPct : (pet.maxMp ? Math.min(100, Math.max(0, Math.round((pet.currentMp / pet.maxMp) * 100))) : 100);
        const xpPct = pet.xpPct !== undefined ? pet.xpPct : (pet.maxXp ? Math.min(100, Math.max(0, Math.round((pet.currentXp / pet.maxXp) * 100))) : 60);

        return `
      <div class="hud-pet-entry" data-pet-id="${pet.id || ''}" title="${nickname} (Nv.${level})">
        <div class="hud-pet-avatar-wrapper">
          <img class="hud-pet-avatar-img" src="${thumbUrl}" alt="${nickname}" onerror="this.src='/play/assets/hud/menu_pets.png'" />
          <img class="hud-pet-avatar-frame" src="/play/assets/hud/pet_avatar_frame.png" alt="Frame" />
          <div class="hud-pet-level-badge">Nv. ${level}</div>
        </div>
        <div class="hud-pet-bars-col">
          <div class="hud-pet-stat-bar hud-pet-bar-hp">
            <span class="hud-pet-stat-label">HP</span>
            <div class="hud-pet-bar-track">
              <div class="hud-pet-bar-fill hud-pet-fill-hp" style="width: ${hpPct}%;"></div>
            </div>
          </div>
          <div class="hud-pet-stat-bar hud-pet-bar-mp">
            <span class="hud-pet-stat-label">MP</span>
            <div class="hud-pet-bar-track">
              <div class="hud-pet-bar-fill hud-pet-fill-mp" style="width: ${mpPct}%;"></div>
            </div>
          </div>
          <div class="hud-pet-stat-bar hud-pet-bar-xp">
            <span class="hud-pet-stat-label">XP</span>
            <div class="hud-pet-bar-track">
              <div class="hud-pet-bar-fill hud-pet-fill-xp" style="width: ${xpPct}%;"></div>
            </div>
          </div>
        </div>
      </div>
    `;
      })
      .join('');
  }

  /**
   * Renderiza o Mini Mapa em tempo real com visão circular do mapa atual,
   * marcador direcional do jogador e coordenadas exatas.
   */
  static updateMinimap(hud, currentMap, mapImage, playerX, playerY, playerDir = 0) {
    hud.state.map = currentMap;
    hud.mapBgImage = mapImage;
    hud.state.playerX = playerX;
    hud.state.playerY = playerY;
    hud.state.playerDir = playerDir;

    // 1. Atualiza coordenadas abaixo do minimap
    const coordsEl = document.getElementById('hudCoordinatesBadge');
    if (coordsEl) {
      coordsEl.textContent = `${Math.round(playerX)}, ${Math.round(playerY)}`;
    }

    if (!hud.minimapCtx || !hud.minimapCanvas) return;
    const ctx = hud.minimapCtx;
    const S = hud.minimapCanvas.width; // 112
    const cx = S / 2;
    const cy = S / 2;
    const radius = S / 2 - 4;

    ctx.clearRect(0, 0, S, S);

    // Salva o estado para aplicar o recorte circular perfeito
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();

    // 2. Fundo escuro
    ctx.fillStyle = '#0b1320';
    ctx.fillRect(0, 0, S, S);

    // 3. Renderiza a área do mapa centralizada no jogador
    if (mapImage && mapImage.complete && mapImage.naturalWidth > 0) {
      const zoom = 0.12; // Escala do minimap
      const viewW = S / zoom;
      const viewH = S / zoom;
      const srcX = playerX - viewW / 2;
      const srcY = playerY - viewH / 2;

      ctx.drawImage(mapImage, srcX, srcY, viewW, viewH, 0, 0, S, S);
    } else {
      // Placeholder pré-renderizado em offscreen canvas caso imagem esteja carregando
      if (!hud._minimapPlaceholder || hud._minimapPlaceholderSize !== S) {
        const off = document.createElement('canvas');
        off.width = S;
        off.height = S;
        const octx = off.getContext('2d');
        if (octx) {
          const grad = octx.createRadialGradient(cx, cy, 10, cx, cy, radius);
          grad.addColorStop(0, '#1e3a5f');
          grad.addColorStop(1, '#060f1e');
          octx.fillStyle = grad;
          octx.fillRect(0, 0, S, S);
          octx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
          octx.lineWidth = 1;
          octx.beginPath();
          octx.arc(cx, cy, radius * 0.4, 0, Math.PI * 2);
          octx.arc(cx, cy, radius * 0.7, 0, Math.PI * 2);
          octx.stroke();
        }
        hud._minimapPlaceholder = off;
        hud._minimapPlaceholderSize = S;
      }
      ctx.drawImage(hud._minimapPlaceholder, 0, 0);
    }

    // 4. Marcador direcional do jogador (cone ciano idêntico à referência)
    ctx.save();
    ctx.translate(cx, cy);

    // Mapeia direção 0..7 para ângulo em radianos
    // 0: Sul (baixo), 1: Sudoeste, 2: Oeste, 3: Noroeste, 4: Norte, 5: Nordeste, 6: Leste, 7: Sudeste
    const dirAngles = [
      Math.PI / 2, // 0: S
      (3 * Math.PI) / 4, // 1: SW
      Math.PI, // 2: W
      -(3 * Math.PI) / 4, // 3: NW
      -Math.PI / 2, // 4: N
      -Math.PI / 4, // 5: NE
      0, // 6: E
      Math.PI / 4, // 7: SE
    ];
    const angle = dirAngles[playerDir] !== undefined ? dirAngles[playerDir] : -Math.PI / 2;
    ctx.rotate(angle);

    // Seta triangular ciana
    ctx.beginPath();
    ctx.moveTo(12, 0); // Ponta
    ctx.lineTo(-8, -7);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-8, 7);
    ctx.closePath();
    ctx.fillStyle = '#00f5ff';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();

    ctx.restore();
    ctx.restore(); // Fecha o clip circular
  }
}

window.PlayHudMinimapAndModals = PlayHudMinimapAndModals;
