/**
 * @file apps/server/public/play/js/PlayMapModalController.js
 * @module PlayMapModalController
 * @description Controlador dos Modais de Mapa Expandido do Jogo:
 *   1. Mapa Local Expandido: Mostra o mapa atual em alta resolução com a localização
 *      exata do Jogador, de todos os NPCs cadastrados e dos Portais.
 *   2. Mapa Mundo Geral: Visualizador dos Continentes com rotas, pontos clicáveis
 *      e destaque do mapa onde o jogador se encontra no momento.
 */

(function () {
  'use strict';

  class PlayMapModalController {
    constructor() {
      this.playApp = null;
      this.currentMap = null;
      this.mapBgImage = null;
      this.playerX = 0;
      this.playerY = 0;
      this.worldMapsData = null;
      this.selectedContinentIdx = 0;
    }

    /**
     * Abre o modal do Mapa Atual Expandido.
     */
    openExpandedMap(playApp, currentMap, mapBgImage, playerX, playerY) {
      this.playApp = playApp || window.PlayApp;
      this.currentMap = currentMap || this.playApp?.currentMap;
      this.mapBgImage = mapBgImage || this.playApp?.mapBgImage;
      this.playerX = playerX !== undefined ? playerX : (this.playApp?.playerX || 0);
      this.playerY = playerY !== undefined ? playerY : (this.playApp?.playerY || 0);

      if (!this.currentMap) {
        if (this.playApp?.showNotification) {
          this.playApp.showNotification('Carregando informações do mapa...', 'info');
        }
        return;
      }

      // Remove se já aberto
      this.closeModals();

      const mapW = this.mapBgImage?.naturalWidth || this.currentMap.width || 2000;
      const mapH = this.mapBgImage?.naturalHeight || this.currentMap.height || 1500;
      const mapImgUrl = this.mapBgImage?.src || this.currentMap.mcreworkMapImage || '';
      const npcs = this.currentMap.npcs || [];
      const portals = this.currentMap.portals || [];

      const modal = document.createElement('div');
      modal.id = 'hudExpandedMapModal';
      modal.className = 'hud-map-modal-backdrop';

      modal.innerHTML = `
        <div class="hud-map-modal-dialog">
          <!-- Top Bar -->
          <div class="hud-map-modal-header">
            <div class="hud-map-title-group">
              <span class="hud-map-icon">📍</span>
              <div>
                <h3 class="hud-map-title">${this.currentMap.namePtBr || 'Mapa Atual'}</h3>
                <span class="hud-map-subtitle">Nv. ${this.currentMap.requiredLevel || 1} • ${this.currentMap.biome?.namePtBr || 'Região de Etheria'}</span>
              </div>
            </div>
            <div class="hud-map-header-actions">
              <button type="button" id="hudOpenWorldMapBtn" class="hud-btn-world-map" title="Abrir Mapa Mundo dos Continentes">
                <span class="hud-btn-icon">🗺️</span>
                <span>Mapa Mundo</span>
              </button>
              <button type="button" class="hud-map-close-btn" title="Fechar Mapa">✕</button>
            </div>
          </div>

          <!-- Quick Stats / Coordinates Bar -->
          <div class="hud-map-info-bar">
            <span class="hud-map-coord-badge">Sua Posição: <strong>${Math.round(this.playerX)}, ${Math.round(this.playerY)}</strong></span>
            <div class="hud-map-legend">
              <span class="legend-item"><span class="legend-dot dot-player"></span> Você</span>
              <span class="legend-item"><span class="legend-dot dot-npc"></span> NPCs (${npcs.length})</span>
              <span class="legend-item"><span class="legend-dot dot-portal"></span> Portais (${portals.length})</span>
            </div>
          </div>

          <!-- Main Scrollable Map Viewport -->
          <div class="hud-map-viewport-container" id="hudMapViewport">
            <div class="hud-map-stage" id="hudMapStage" style="width: ${mapW}px; height: ${mapH}px;">
              ${mapImgUrl ? `<img class="hud-map-bg-img" src="${mapImgUrl}" alt="Mapa" />` : ''}

              <!-- Marcador do Jogador -->
              <div class="hud-map-pin pin-player" style="left: ${this.playerX}px; top: ${this.playerY}px;">
                <div class="pin-pulse"></div>
                <div class="pin-marker">🟢</div>
                <div class="pin-label">Você (${Math.round(this.playerX)}, ${Math.round(this.playerY)})</div>
              </div>

              <!-- Marcadores de Portais -->
              ${portals
                .map(
                  (p) => `
                <div class="hud-map-pin pin-portal" style="left: ${p.posX}px; top: ${p.posY}px;">
                  <div class="pin-marker">🌀</div>
                  <div class="pin-label">${p.namePtBr || 'Portal'}</div>
                </div>
              `
                )
                .join('')}

              <!-- Marcadores de NPCs -->
              ${npcs
                .map(
                  (npc) => `
                <div class="hud-map-pin pin-npc" id="mapNpcPin_${npc.id}" style="left: ${npc.posX}px; top: ${npc.posY}px;">
                  <div class="pin-marker">💬</div>
                  <div class="pin-label"><strong>${npc.namePtBr}</strong></div>
                </div>
              `
                )
                .join('')}
            </div>
          </div>

          <!-- NPC Drawer / Quick Directory -->
          <div class="hud-map-npcs-drawer">
            <div class="hud-map-drawer-header">
              <span>👥 NPCs Neste Mapa (${npcs.length}):</span>
            </div>
            <div class="hud-map-npc-chips">
              ${
                npcs.length > 0
                  ? npcs
                      .map(
                        (n) => `
                <button type="button" class="hud-npc-chip" data-npc-id="${n.id}" data-x="${n.posX}" data-y="${n.posY}">
                  <span class="chip-icon">💬</span>
                  <span class="chip-name">${n.namePtBr}</span>
                  <span class="chip-coords">(${n.posX}, ${n.posY})</span>
                </button>
              `
                      )
                      .join('')
                  : '<span class="hud-no-npcs">Nenhum NPC registrado neste setor.</span>'
              }
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      // Eventos do Modal do Mapa
      const closeBtn = modal.querySelector('.hud-map-close-btn');
      if (closeBtn) closeBtn.addEventListener('click', () => this.closeModals());

      const worldMapBtn = modal.querySelector('#hudOpenWorldMapBtn');
      if (worldMapBtn) {
        worldMapBtn.addEventListener('click', () => {
          this.openWorldMap();
        });
      }

      // Centraliza a visão do mapa inicial no jogador
      const viewport = modal.querySelector('#hudMapViewport');
      if (viewport) {
        setTimeout(() => {
          const vw = viewport.clientWidth;
          const vh = viewport.clientHeight;
          viewport.scrollLeft = Math.max(0, this.playerX - vw / 2);
          viewport.scrollTop = Math.max(0, this.playerY - vh / 2);
        }, 50);
      }

      // Clique em um chip de NPC: centraliza a tela no NPC e destaca seu pin
      const npcChips = modal.querySelectorAll('.hud-npc-chip');
      npcChips.forEach((chip) => {
        chip.addEventListener('click', () => {
          const x = Number(chip.getAttribute('data-x'));
          const y = Number(chip.getAttribute('data-y'));
          const npcId = chip.getAttribute('data-npc-id');
          if (viewport) {
            viewport.scrollTo({
              left: Math.max(0, x - viewport.clientWidth / 2),
              top: Math.max(0, y - viewport.clientHeight / 2),
              behavior: 'smooth',
            });
          }
          const pin = modal.querySelector(`#mapNpcPin_${npcId}`);
          if (pin) {
            pin.classList.add('pin-highlighted');
            setTimeout(() => pin.classList.remove('pin-highlighted'), 2000);
          }
        });
      });
    }

    /**
     * Abre o visualizador do Mapa Mundo Geral (Continentes / Rotas).
     */
    async openWorldMap() {
      this.closeModals();

      const modal = document.createElement('div');
      modal.id = 'hudWorldMapModal';
      modal.className = 'hud-map-modal-backdrop';

      modal.innerHTML = `
        <div class="hud-map-modal-dialog hud-world-map-dialog">
          <div class="hud-map-modal-header">
            <div class="hud-map-title-group">
              <span class="hud-map-icon">🌍</span>
              <div>
                <h3 class="hud-map-title">Mapa Mundo de Etheria</h3>
                <span class="hud-map-subtitle">Continentes, Rotas e Localização Geral</span>
              </div>
            </div>
            <div class="hud-map-header-actions">
              <button type="button" id="hudBackToLocalMapBtn" class="hud-btn-world-map" title="Voltar ao Mapa Local">
                <span class="hud-btn-icon">📍</span>
                <span>Mapa Local</span>
              </button>
              <button type="button" class="hud-map-close-btn" title="Fechar">✕</button>
            </div>
          </div>

          <!-- Continent Selector Tabs -->
          <div class="hud-world-tabs-bar" id="hudWorldTabsBar">
            <span class="hud-loading-txt">Carregando continentes...</span>
          </div>

          <!-- World Map Canvas Viewport -->
          <div class="hud-world-viewport" id="hudWorldViewport">
            <div class="hud-world-canvas-wrapper" id="hudWorldCanvasWrapper">
              <!-- Renderizado dinamicamente -->
            </div>
          </div>

          <!-- Footer Legend -->
          <div class="hud-world-footer-bar">
            <span class="hud-world-status-txt" id="hudWorldStatusTxt">Carregando dados do mundo...</span>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      modal.querySelector('.hud-map-close-btn')?.addEventListener('click', () => this.closeModals());
      modal.querySelector('#hudBackToLocalMapBtn')?.addEventListener('click', () => {
        this.openExpandedMap(this.playApp, this.currentMap, this.mapBgImage, this.playerX, this.playerY);
      });

      // Carrega os templates de mapa mundo
      try {
        const token = localStorage.getItem('etheria_token');
        const res = await fetch('/api/play/world-maps', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        this.worldMapsData = data.worldMaps || [];

        if (this.worldMapsData.length === 0) {
          const tabsBar = modal.querySelector('#hudWorldTabsBar');
          if (tabsBar) tabsBar.innerHTML = '<span style="color:#f87171;">Nenhum mapa de continente cadastrado no momento.</span>';
          return;
        }

        this.renderWorldMapContinent(modal);
      } catch (err) {
        console.error('[PlayMapModalController] Erro ao carregar mapas mundo:', err);
        const tabsBar = modal.querySelector('#hudWorldTabsBar');
        if (tabsBar) tabsBar.innerHTML = `<span style="color:#f87171;">Erro ao carregar mapa mundo: ${err.message}</span>`;
      }
    }

    /**
     * Renderiza o continente ativo dentro do modal do Mapa Mundo.
     */
    renderWorldMapContinent(modal) {
      if (!this.worldMapsData || !this.worldMapsData.length) return;

      const tabsBar = modal.querySelector('#hudWorldTabsBar');
      const wrapper = modal.querySelector('#hudWorldCanvasWrapper');
      const statusTxt = modal.querySelector('#hudWorldStatusTxt');

      // 1. Renderiza Abas de Continentes
      if (tabsBar) {
        tabsBar.innerHTML = this.worldMapsData
          .map(
            (c, idx) => `
          <button type="button" class="hud-continent-tab ${idx === this.selectedContinentIdx ? 'active' : ''}" data-idx="${idx}">
            ${c.namePtBr || `Continente ${idx + 1}`}
          </button>
        `
          )
          .join('');

        tabsBar.querySelectorAll('.hud-continent-tab').forEach((tab) => {
          tab.addEventListener('click', () => {
            this.selectedContinentIdx = Number(tab.getAttribute('data-idx'));
            this.renderWorldMapContinent(modal);
          });
        });
      }

      // 2. Continente Atual
      const continent = this.worldMapsData[this.selectedContinentIdx];
      if (!continent || !wrapper) return;

      const cw = continent.canvasWidth || 1264;
      const ch = continent.canvasHeight || 848;
      const points = Array.isArray(continent.pointsJson) ? continent.pointsJson : [];
      const routes = Array.isArray(continent.routesJson) ? continent.routesJson : [];

      // Verifica se o mapa atual do jogador está presente neste continente
      let playerCurrentPoint = null;
      if (this.currentMap) {
        playerCurrentPoint = points.find(
          (p) => Number(p.mapId) === Number(this.currentMap.id) || (p.code && p.code === this.currentMap.code)
        );
      }

      if (statusTxt) {
        if (playerCurrentPoint) {
          statusTxt.innerHTML = `📍 Você está no mapa <strong>${this.currentMap.namePtBr}</strong> deste continente!`;
        } else {
          statusTxt.innerHTML = `Explorando <strong>${continent.namePtBr}</strong>. (Seu mapa atual pode estar em outro continente).`;
        }
      }

      wrapper.style.width = `${cw}px`;
      wrapper.style.height = `${ch}px`;

      // Monta as linhas de rotas em SVG
      const svgRoutes = routes
        .map((r) => {
          const fromPt = points.find((p) => p.id === r.fromPointId);
          const toPt = points.find((p) => p.id === r.toPointId);
          if (!fromPt || !toPt) return '';
          return `<line x1="${fromPt.x}" y1="${fromPt.y}" x2="${toPt.x}" y2="${toPt.y}" stroke="rgba(234, 179, 8, 0.75)" stroke-width="3" stroke-dasharray="6,4" />`;
        })
        .join('');

      wrapper.innerHTML = `
        <!-- Imagem Base Limpa do Continente -->
        <img class="hud-world-base-img" src="${continent.baseImageUrl}" alt="${continent.namePtBr}" />

        <!-- Logotipo Etheria Campus -->
        ${
          continent.logoImageUrl && continent.logoVisible !== false
            ? `<img class="hud-world-logo-img" src="${continent.logoImageUrl}" style="left:${continent.logoX || 42}px; top:${continent.logoY || 30}px; width:${continent.logoWidth || 270}px; height:${continent.logoHeight || 185}px;" alt="Logo" />`
            : ''
        }

        <!-- Camada SVG de Rotas -->
        <svg class="hud-world-routes-svg" viewBox="0 0 ${cw} ${ch}" style="width:${cw}px; height:${ch}px;">
          ${svgRoutes}
        </svg>

        <!-- Camada de Pontos de Mapa -->
        <div class="hud-world-points-layer">
          ${points
            .map((p) => {
              const isCurrent = playerCurrentPoint && playerCurrentPoint.id === p.id;
              return `
              <div class="hud-world-point-node ${isCurrent ? 'point-player-here' : ''}" style="left:${p.x}px; top:${p.y}px;" title="${p.namePtBr || p.name || 'Ponto'}">
                ${isCurrent ? '<div class="point-player-pulse"></div>' : ''}
                <div class="point-icon-gem">${isCurrent ? '📍' : '⭐'}</div>
                <div class="point-name-tag">
                  <strong>${p.namePtBr || p.name || 'Ponto'}</strong>
                  ${isCurrent ? '<span class="tag-here">VOCÊ ESTÁ AQUI</span>' : ''}
                </div>
              </div>
            `;
            })
            .join('')}
        </div>
      `;

      // Centraliza no ponto do jogador se existir
      const worldViewport = modal.querySelector('#hudWorldViewport');
      if (worldViewport && playerCurrentPoint) {
        setTimeout(() => {
          worldViewport.scrollLeft = Math.max(0, playerCurrentPoint.x - worldViewport.clientWidth / 2);
          worldViewport.scrollTop = Math.max(0, playerCurrentPoint.y - worldViewport.clientHeight / 2);
        }, 60);
      }
    }

    /**
     * Fecha quaisquer modais de mapa abertos.
     */
    closeModals() {
      const exp = document.getElementById('hudExpandedMapModal');
      if (exp) exp.remove();
      const world = document.getElementById('hudWorldMapModal');
      if (world) world.remove();
    }
  }

  window.PlayMapModalController = new PlayMapModalController();
})();
