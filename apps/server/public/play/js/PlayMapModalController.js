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
            <!-- Controles Flutuantes de Zoom In / Out / Reset -->
            <div class="hud-world-zoom-controls">
              <button type="button" class="hud-zoom-btn" id="btnWorldZoomIn" title="Aproximar Zoom">+</button>
              <button type="button" class="hud-zoom-btn" id="btnWorldZoomOut" title="Afastar Zoom">-</button>
              <button type="button" class="hud-zoom-btn" id="btnWorldZoomReset" title="Centralizar no Jogador / Resetar">⟲</button>
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
        const token = this.playApp?.token || localStorage.getItem('etheria_play_token') || localStorage.getItem('etheria_admin_token') || '';
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
     * Renderiza o continente ativo dentro do modal do Mapa Mundo com Pan (Arrastar) e Zoom interativo.
     */
    renderWorldMapContinent(modal) {
      if (!this.worldMapsData || !this.worldMapsData.length) return;

      const tabsBar = modal.querySelector('#hudWorldTabsBar');
      const viewport = modal.querySelector('#hudWorldViewport');
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
      if (!continent || !wrapper || !viewport) return;

      const cw = continent.canvasWidth || 1264;
      const ch = continent.canvasHeight || 848;
      const points = Array.isArray(continent.pointsJson) ? continent.pointsJson : [];
      const routes = Array.isArray(continent.routesJson) ? continent.routesJson : [];

      const mapNameMap = new Map((this.playApp?.mapsList || []).map((m) => [Number(m.id), m.namePtBr || m.code]));

      // Verifica se o mapa atual do jogador está presente neste continente
      let playerCurrentPoint = null;
      if (this.currentMap) {
        playerCurrentPoint = points.find(
          (p) =>
            (p.gameMapId && Number(p.gameMapId) === Number(this.currentMap.id)) ||
            (p.mapId && Number(p.mapId) === Number(this.currentMap.id)) ||
            (p.code && p.code === this.currentMap.code)
        );
      }

      if (statusTxt) {
        if (playerCurrentPoint) {
          statusTxt.innerHTML = `📍 Você está no mapa <strong>${this.currentMap.namePtBr}</strong> deste continente!`;
        } else {
          statusTxt.innerHTML = `Explorando <strong>${continent.namePtBr}</strong>. (Seu mapa atual pode estar em outro continente).`;
        }
      }

      const getPointLabel = (p) => {
        if (p.customLabel && String(p.customLabel).trim()) return String(p.customLabel).trim();
        if (p.gameMapId && mapNameMap.has(Number(p.gameMapId))) return mapNameMap.get(Number(p.gameMapId));
        if (p.namePtBr && String(p.namePtBr).trim()) return String(p.namePtBr).trim();
        if (p.name && String(p.name).trim()) return String(p.name).trim();
        if (p.refLabel && String(p.refLabel).trim()) return String(p.refLabel).trim();
        return p.refId ? `Ponto #${p.refId}` : 'Ponto';
      };

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
              const ptLabel = getPointLabel(p);
              return `
              <div class="hud-world-point-node ${isCurrent ? 'point-player-here' : ''}" style="left:${p.x}px; top:${p.y}px;" title="${ptLabel}">
                ${isCurrent ? '<div class="point-player-pulse"></div>' : ''}
                <div class="point-icon-gem">${isCurrent ? '📍' : (p.isCity ? '🏛️' : '⭐')}</div>
                <div class="point-name-tag">
                  <strong>${ptLabel}</strong>
                  ${isCurrent ? '<span class="tag-here">VOCÊ ESTÁ AQUI</span>' : ''}
                </div>
              </div>
            `;
            })
            .join('')}
        </div>
      `;

      // 3. Pan & Zoom Engine (Arrastar com Mouse/Touch e Zoom In/Out)
      let vw = viewport.clientWidth || 600;
      let vh = viewport.clientHeight || 400;
      const fitZoom = Math.min(vw / cw, vh / ch);
      let zoom = Math.max(0.4, Math.min(2.5, fitZoom * 1.05 || 0.75));
      let panX = playerCurrentPoint
        ? (vw / 2) - (playerCurrentPoint.x * zoom)
        : (vw - cw * zoom) / 2;
      let panY = playerCurrentPoint
        ? (vh / 2) - (playerCurrentPoint.y * zoom)
        : (vh - ch * zoom) / 2;

      const updateTransform = () => {
        wrapper.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
        wrapper.style.transformOrigin = '0 0';
      };

      updateTransform();

      // Pan com Mouse (Arrastar)
      let isDragging = false;
      let startX = 0;
      let startY = 0;

      viewport.onmousedown = (e) => {
        if (e.target.closest('.hud-world-zoom-controls')) return;
        isDragging = true;
        startX = e.clientX - panX;
        startY = e.clientY - panY;
        viewport.style.cursor = 'grabbing';
      };

      window.onmousemove = (e) => {
        if (!isDragging) return;
        panX = e.clientX - startX;
        panY = e.clientY - startY;
        updateTransform();
      };

      window.onmouseup = () => {
        if (isDragging) {
          isDragging = false;
          if (viewport) viewport.style.cursor = 'grab';
        }
      };

      // Zoom com Wheel (Roda do Mouse centralizada no cursor)
      viewport.onwheel = (e) => {
        e.preventDefault();
        const rect = viewport.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const factor = e.deltaY < 0 ? 1.15 : 0.87;
        const newZoom = Math.max(0.35, Math.min(3.0, zoom * factor));
        panX = mx - (mx - panX) * (newZoom / zoom);
        panY = my - (my - panY) * (newZoom / zoom);
        zoom = newZoom;
        updateTransform();
      };

      // Touch Drag & Pinch-to-zoom (Mobile Vertical e Horizontal)
      let touchStartX = 0;
      let touchStartY = 0;
      let touchInitialDist = 0;
      let touchInitialZoom = 1;

      viewport.ontouchstart = (e) => {
        if (e.target.closest('.hud-world-zoom-controls')) return;
        if (e.touches.length === 1) {
          isDragging = true;
          touchStartX = e.touches[0].clientX - panX;
          touchStartY = e.touches[0].clientY - panY;
        } else if (e.touches.length === 2) {
          isDragging = false;
          touchInitialDist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
          touchInitialZoom = zoom;
        }
      };

      viewport.ontouchmove = (e) => {
        if (e.touches.length === 1 && isDragging) {
          panX = e.touches[0].clientX - touchStartX;
          panY = e.touches[0].clientY - touchStartY;
          updateTransform();
        } else if (e.touches.length === 2 && touchInitialDist > 0) {
          const dist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
          const factor = dist / touchInitialDist;
          zoom = Math.max(0.35, Math.min(3.0, touchInitialZoom * factor));
          updateTransform();
        }
      };

      viewport.ontouchend = () => {
        isDragging = false;
        touchInitialDist = 0;
      };

      // Botões Flutuantes de Zoom
      const btnZoomIn = modal.querySelector('#btnWorldZoomIn');
      const btnZoomOut = modal.querySelector('#btnWorldZoomOut');
      const btnZoomReset = modal.querySelector('#btnWorldZoomReset');

      if (btnZoomIn) {
        btnZoomIn.onclick = () => {
          vw = viewport.clientWidth || 600;
          vh = viewport.clientHeight || 400;
          const cx = vw / 2;
          const cy = vh / 2;
          const newZoom = Math.min(3.0, zoom * 1.25);
          panX = cx - (cx - panX) * (newZoom / zoom);
          panY = cy - (cy - panY) * (newZoom / zoom);
          zoom = newZoom;
          updateTransform();
        };
      }

      if (btnZoomOut) {
        btnZoomOut.onclick = () => {
          vw = viewport.clientWidth || 600;
          vh = viewport.clientHeight || 400;
          const cx = vw / 2;
          const cy = vh / 2;
          const newZoom = Math.max(0.35, zoom * 0.8);
          panX = cx - (cx - panX) * (newZoom / zoom);
          panY = cy - (cy - panY) * (newZoom / zoom);
          zoom = newZoom;
          updateTransform();
        };
      }

      if (btnZoomReset) {
        btnZoomReset.onclick = () => {
          vw = viewport.clientWidth || 600;
          vh = viewport.clientHeight || 400;
          zoom = Math.max(0.4, Math.min(2.5, Math.min(vw / cw, vh / ch) * 1.05 || 0.75));
          if (playerCurrentPoint) {
            panX = (vw / 2) - (playerCurrentPoint.x * zoom);
            panY = (vh / 2) - (playerCurrentPoint.y * zoom);
          } else {
            panX = (vw - cw * zoom) / 2;
            panY = (vh - ch * zoom) / 2;
          }
          updateTransform();
        };
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
