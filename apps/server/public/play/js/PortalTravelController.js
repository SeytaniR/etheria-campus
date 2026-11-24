/**
 * ETHERIA CAMPUS — PORTAL TRAVEL & MAP PRELOAD CONTROLLER
 * Arquivo: apps/server/public/play/js/PortalTravelController.js
 * Gerencia a navegação intuitiva de portais, confirmações táteis,
 * animação mágica de teleporte no Canvas e tela de loading com pré-carregamento total.
 * Regra #7: Estritamente < 1.000 linhas
 */

class EtheriaPortalTravelController {
  constructor() {
    this.targetedPortal = null;
    this.dismissedPortalId = null;
    this.arrivedPortalId = null;
    this.isTeleporting = false;
    this.activePortal = null;

    // Estado do VFX de teleporte no Canvas (Zero Alloc no loop)
    this.teleportVfx = {
      active: false,
      startTime: 0,
      duration: 750,
      x: 0,
      y: 0,
      particles: Array.from({ length: 14 }, (_, i) => ({
        angle: (i / 14) * Math.PI * 2,
        speed: 38 + (i % 5) * 12,
        radOffset: 12 + (i % 4) * 8,
        size: 2.2 + (i % 3) * 1.2,
      })),
    };

    // Referências DOM
    this.domModal = null;
    this.domLoading = null;
    this.domLoadingBar = null;
    this.domLoadingStatus = null;
    this.domLoadingTitle = null;

    this.ensureDomInjected();
  }

  get hasActiveVfx() {
    return this.teleportVfx.active;
  }

  ensureDomInjected() {
    if (document.getElementById('portalTravelModal')) {
      this.bindDom();
      return;
    }

    // 1. Injeta Modal de Confirmação de Teleporte
    const modalDiv = document.createElement('div');
    modalDiv.id = 'portalTravelModal';
    modalDiv.innerHTML = `
      <div class="portal-travel-card">
        <div class="portal-crest-wrap">
          <div class="portal-crest-pulse-ring"></div>
          <div class="portal-crest-core">🌀</div>
        </div>
        <div class="portal-title-tag">PORTAL DIMENSIONAL</div>
        <h2 id="portalDestTitle" class="portal-dest-title">Fenda Mágica</h2>
        <div id="portalDestBadge" class="portal-dest-badge">Destino Interdimensional</div>
        <p class="portal-desc-text">Deseja cruzar a fenda de éter e viajar para este território agora?</p>
        <div class="portal-actions-row">
          <button type="button" id="btnPortalCancel" class="btn-portal-cancel">Não, Ficar</button>
          <button type="button" id="btnPortalConfirm" class="btn-portal-confirm">✨ Sim, Viajar</button>
        </div>
      </div>
    `;
    document.body.appendChild(modalDiv);

    // 2. Injeta Tela de Carregamento de Mapa
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'mapLoadingOverlay';
    loadingDiv.innerHTML = `
      <div class="loading-bg-layer"></div>
      <div class="loading-vignette-layer"></div>
      <div class="loading-content-wrap">
        <div class="loading-rune-spinner">
          <div class="loading-rune-outer"></div>
          <div class="loading-rune-inner"></div>
          <div class="loading-rune-center-glyph">🌀</div>
        </div>
        <div class="loading-eyebrow">VIAJANDO PARA</div>
        <h1 id="loadingMapName" class="loading-map-name">Etheria</h1>
        <div class="loading-progress-container">
          <div id="loadingProgressBar" class="loading-progress-bar"></div>
        </div>
        <div id="loadingStatusText" class="loading-status-text">Sintonizando fenda dimensional...</div>
        <div class="loading-lore-hint">
          <strong>Dica Arcana:</strong> Os portais ancestrais mantêm conexões perpétuas entre os vilarejos e entrepostos de Etheria.
        </div>
      </div>
    `;
    document.body.appendChild(loadingDiv);

    this.bindDom();
  }

  bindDom() {
    this.domModal = document.getElementById('portalTravelModal');
    this.domLoading = document.getElementById('mapLoadingOverlay');
    this.domLoadingBar = document.getElementById('loadingProgressBar');
    this.domLoadingStatus = document.getElementById('loadingStatusText');
    this.domLoadingTitle = document.getElementById('loadingMapName');

    const btnConfirm = document.getElementById('btnPortalConfirm');
    if (btnConfirm) {
      btnConfirm.onclick = () => this.confirmTravel();
    }
    const btnCancel = document.getElementById('btnPortalCancel');
    if (btnCancel) {
      btnCancel.onclick = () => this.cancelTravel();
    }
  }

  /**
   * Intercepta o clique no canvas para verificar se o alvo foi um portal
   */
  handleCanvasClick(playApp, worldPt) {
    if (this.isTeleporting || !playApp.currentMap) return false;

    for (const p of playApp.currentMap.portals || []) {
      const dist = Math.hypot(worldPt.x - p.sourceX, worldPt.y - p.sourceY);
      const clickRadius = Math.max(54, (Number(p.triggerRadius) || 48) * 1.35);

      if (dist <= clickRadius) {
        // Jogador clicou no portal!
        const playerDist = Math.hypot(playApp.playerX - p.sourceX, playApp.playerY - p.sourceY);
        const triggerRadius = Number(p.triggerRadius) || 48;

        if (playerDist <= triggerRadius) {
          // Jogador já está dentro da área do portal e clicou nele de novo:
          // Limpa descarte e abre a confirmação imediatamente!
          this.dismissedPortalId = null;
          this.arrivedPortalId = null;
          this.targetedPortal = null;
          playApp.moveTargetX = null;
          playApp.moveTargetY = null;
          playApp.currentPath = null;
          playApp.isMoving = false;
          this.openConfirmation(playApp, p);
          return true;
        } else {
          // Jogador clicou no portal à distância: caminha até ele com intenção explícita
          this.dismissedPortalId = null;
          this.arrivedPortalId = null;
          this.targetedPortal = p;
          playApp.targetDestX = p.sourceX;
          playApp.targetDestY = p.sourceY;
          playApp.lastRepathTime = 0;

          if (playApp.mesh && !playApp.gmNoClip) {
            const path = playApp.mesh.findPath(playApp.playerX, playApp.playerY, p.sourceX, p.sourceY);
            if (path && path.length > 0) {
              playApp.currentPath = path;
              playApp.moveTargetX = path[0].x;
              playApp.moveTargetY = path[0].y;
            } else {
              playApp.currentPath = null;
              playApp.moveTargetX = p.sourceX;
              playApp.moveTargetY = p.sourceY;
            }
          } else {
            playApp.currentPath = null;
            playApp.moveTargetX = p.sourceX;
            playApp.moveTargetY = p.sourceY;
          }
          return true;
        }
      }
    }

    // Clique não foi em portal: se o jogador clicou no chão livre, cancela alvo de portal pendente
    this.targetedPortal = null;
    return false;
  }

  /**
   * Verificação de proximidade chamada no loop principal do jogo
   */
  update(playApp, now) {
    if (this.isTeleporting || playApp.actionCombatArena?.isActive || !playApp.currentMap) return;

    for (const p of playApp.currentMap.portals || []) {
      const dist = Math.hypot(playApp.playerX - p.sourceX, playApp.playerY - p.sourceY);
      const radius = Number(p.triggerRadius) || 48;

      // Se o jogador se afastou do portal, reseta os identificadores de bloqueio
      if (dist > radius + 26) {
        if (this.arrivedPortalId === p.id) {
          this.arrivedPortalId = null;
        }
        if (this.dismissedPortalId === p.id) {
          this.dismissedPortalId = null;
        }
      }

      // Se o jogador está na área do portal
      if (dist <= radius) {
        // Se este portal foi dispensado ("Não") ou é o portal onde acabou de chegar, NÃO dispara!
        if (this.dismissedPortalId === p.id || this.arrivedPortalId === p.id) {
          continue;
        }

        // Se o jogador clicou no portal e acabou de chegar nele:
        if (this.targetedPortal === p) {
          playApp.moveTargetX = null;
          playApp.moveTargetY = null;
          playApp.currentPath = null;
          playApp.isMoving = false;
          this.targetedPortal = null;
          this.openConfirmation(playApp, p);
          return;
        }
      }
    }
  }

  openConfirmation(playApp, portal) {
    this.activePortal = portal;
    this.currentPlayApp = playApp;

    const destTitle = document.getElementById('portalDestTitle');
    const destBadge = document.getElementById('portalDestBadge');

    const destName = portal.targetMapNamePtBr || portal.label || 'Reino Misterioso';
    if (destTitle) destTitle.textContent = destName;
    if (destBadge) destBadge.textContent = `Origem: ${playApp.currentMap.namePtBr || 'Mapa Atual'} ➔ Destino`;

    if (this.domModal) {
      this.domModal.classList.add('is-open');
    }
  }

  cancelTravel() {
    if (this.domModal) {
      this.domModal.classList.remove('is-open');
    }
    if (this.activePortal) {
      // Jogador disse NÃO: ele pode ficar no portal sem sofrer gatilhos automáticos
      this.dismissedPortalId = this.activePortal.id;
    }
    this.targetedPortal = null;
    this.activePortal = null;
  }

  confirmTravel() {
    if (!this.activePortal || this.isTeleporting || !this.currentPlayApp) return;

    const portal = this.activePortal;
    if (this.domModal) {
      this.domModal.classList.remove('is-open');
    }

    const playApp = this.currentPlayApp;
    this.isTeleporting = true;
    playApp.isTraversingPortal = true;
    playApp.isMoving = false;
    playApp.moveTargetX = null;
    playApp.moveTargetY = null;
    playApp.currentPath = null;

    // Dispara animação mágica de teleporte no Canvas
    this.startTeleportVfx(playApp.playerX, playApp.playerY);

    // Aguarda ~650ms de ápice da animação mágica antes de entrar no Loading Screen
    setTimeout(() => {
      void this.traverseAndLoad(playApp, portal);
    }, 650);
  }

  startTeleportVfx(x, y) {
    this.teleportVfx.active = true;
    this.teleportVfx.startTime = performance.now();
    this.teleportVfx.x = x;
    this.teleportVfx.y = y;
  }

  setLoadingProgress(pct, statusText) {
    if (this.domLoadingBar) {
      this.domLoadingBar.style.width = `${Math.min(100, Math.max(0, pct))}%`;
    }
    if (this.domLoadingStatus && statusText) {
      this.domLoadingStatus.textContent = statusText;
    }
  }

  async traverseAndLoad(playApp, portal) {
    const destName = portal.targetMapNamePtBr || 'Novo Território';
    if (this.domLoadingTitle) {
      this.domLoadingTitle.textContent = destName;
    }

    // Exibe tela de carregamento suave
    if (this.domLoading) {
      this.domLoading.classList.add('is-visible');
    }
    this.setLoadingProgress(15, 'Sintonizando Fenda de Éter...');

    try {
      // 1. Requisição de travessia para o backend
      const res = await playApp.api(`/api/play/characters/${playApp.activeChar.id}/traverse-portal`, {
        method: 'POST',
        body: JSON.stringify({ portalId: portal.id }),
      });

      this.setLoadingProgress(35, 'Carregando Malha e Atributos do Mapa...');

      // 2. Busca dados completos do mapa de destino
      const mapData = await playApp.api(`/api/play/map/${res.currentMapId}`);
      if (this.domLoadingTitle && mapData.namePtBr) {
        this.domLoadingTitle.textContent = mapData.namePtBr;
      }

      this.setLoadingProgress(60, 'Baixando Cenário em Alta Fidelidade...');

      // 3. Pré-carregamento 100% garantido da imagem do mapa (Zero pop-in / Zero tela preta)
      let rawBg = (mapData.bgImageUrl || mapData.mcreworkMapImage || '').trim();
      let finalBgUrl = rawBg;
      if (!finalBgUrl.startsWith('http://') && !finalBgUrl.startsWith('https://') && !finalBgUrl.startsWith('/')) {
        finalBgUrl = `/api/assets/mcrework/${finalBgUrl.replace(/^\/+/, '')}`;
      }
      const localProxyUrl = `/api/assets/map-image/${mapData.id}`;

      const loadedMapImg = await this.preloadImageWithFallback(localProxyUrl, finalBgUrl);

      this.setLoadingProgress(80, 'Sincronizando Entidades e NPCs...');

      // 4. Pré-aquece sprites essenciais dos NPCs
      const npcPreloads = (mapData.npcs || []).map((npc) => {
        return new Promise((resolve) => {
          const sprite = playApp.getOrCreateSprite(
            `npc_${npc.mcreworkNpcKey}`,
            npc.atlasJsonUrl,
            npc.atlasWebpUrl,
            npc.thumbUrl
          );
          sprite.load();
          resolve();
        });
      });
      await Promise.allSettled(npcPreloads);

      this.setLoadingProgress(95, 'Configurando Malha de Navegação...');

      // 5. Instancia malha e posiciona o jogador
      playApp.currentMap = mapData;
      playApp.mapBgImage = loadedMapImg;
      playApp.mesh = new ClientPolygonMesh(
        mapData.collisionMeshJson,
        mapData.overlapMeshJson,
        mapData.overlapOpacity,
        mapData.buildingMeshJson,
        mapData.plantationMeshJson
      );

      if (loadedMapImg && loadedMapImg.naturalWidth > 0) {
        playApp.mesh?.initNavGrid(loadedMapImg.naturalWidth, loadedMapImg.naturalHeight);
      } else if (mapData.width && mapData.height) {
        playApp.mesh?.initNavGrid(mapData.width, mapData.height);
      }

      playApp.playerX = Number(res.posX);
      playApp.playerY = Number(res.posY);
      playApp.activeChar.currentMapId = res.currentMapId;
      playApp.activeChar.posX = res.posX;
      playApp.activeChar.posY = res.posY;
      playApp.moveTargetX = null;
      playApp.moveTargetY = null;
      playApp.currentPath = null;
      playApp.isMoving = false;
      playApp.camX = undefined;
      playApp.camY = undefined;

      // 6. Configura proteções de chegada (NÃO dispara gatilho automático no destino!)
      this.arrivedPortalId = res.arrivedAtPortalId ?? null;
      this.dismissedPortalId = res.arrivedAtPortalId ?? null;
      this.targetedPortal = null;
      this.activePortal = null;

      // Atualiza HUD, missões e lista GM
      playApp.updateHudInfo();
      if (typeof playApp.renderGmTeleportList === 'function') {
        playApp.renderGmTeleportList();
      }
      if (typeof playApp.loadCharacterQuests === 'function') {
        void playApp.loadCharacterQuests();
      }

      this.setLoadingProgress(100, 'Território Sintonizado com Sucesso!');

      // Pequena pausa estética de 180ms para o navegador renderizar o canvas no fundo
      await new Promise((r) => setTimeout(r, 180));

      // 7. Fade-out elegante da tela de loading
      if (this.domLoading) {
        this.domLoading.classList.remove('is-visible');
      }

      // Libera ações após o encerramento do fade
      setTimeout(() => {
        this.isTeleporting = false;
        playApp.isTraversingPortal = false;
        this.teleportVfx.active = false;
        if ((mapData.isDungeon || mapData.mapType?.code === 'DUNGEON') && typeof playApp.checkAndStartDungeon === 'function') {
          void playApp.checkAndStartDungeon(mapData);
        }
      }, 350);

    } catch (err) {
      console.error('[PortalTravel] Erro na travessia:', err);
      if (String(err?.message || '').includes('no chão')) {
        playApp.showNotification?.(`🦅 ${err.message}`, 'warning');
      } else {
        alert(`🌀 Falha ao cruzar portal: ${err.message}`);
      }
      if (this.domLoading) {
        this.domLoading.classList.remove('is-visible');
      }
      this.isTeleporting = false;
      playApp.isTraversingPortal = false;
      this.teleportVfx.active = false;
    }
  }

  preloadImageWithFallback(localUrl, remoteUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      let resolved = false;

      const finish = () => {
        if (!resolved) {
          resolved = true;
          resolve(img.naturalWidth > 0 ? img : null);
        }
      };

      img.onload = () => {
        if (typeof img.decode === 'function') {
          img.decode().then(finish).catch(finish);
        } else {
          finish();
        }
      };

      img.onerror = () => {
        if (remoteUrl && img.src !== remoteUrl) {
          const fallbackImg = new Image();
          fallbackImg.onload = () => {
            if (typeof fallbackImg.decode === 'function') {
              fallbackImg.decode().then(() => resolve(fallbackImg)).catch(() => resolve(fallbackImg));
            } else {
              resolve(fallbackImg);
            }
          };
          fallbackImg.onerror = () => resolve(null);
          fallbackImg.src = remoteUrl;
        } else {
          finish();
        }
      };

      img.src = localUrl;
      if (img.complete && img.naturalWidth > 0) {
        finish();
      }

      // Timeout de segurança de 4s para nunca travar a tela em redes lentas
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve(img.naturalWidth > 0 ? img : null);
        }
      }, 4000);
    });
  }

  /**
   * Renderiza os efeitos mágicos de teleporte no Canvas (Zero Alloc, 60+ FPS)
   */
  renderWorldVfx(ctx, now, zoom) {
    if (!this.teleportVfx.active) return;

    const vfx = this.teleportVfx;
    const elapsed = now - vfx.startTime;
    const t = Math.min(1, Math.max(0, elapsed / vfx.duration));

    ctx.save();

    // 1. Pilar de Luz Vertical Ascendente
    const beamAlpha = (1 - t) * 0.75;
    const beamW = 44 + Math.sin(t * Math.PI) * 18;
    const beamH = 140;

    const grad = ctx.createLinearGradient(vfx.x, vfx.y, vfx.x, vfx.y - beamH);
    grad.addColorStop(0, `rgba(56, 189, 248, ${beamAlpha})`);
    grad.addColorStop(0.35, `rgba(168, 85, 247, ${beamAlpha * 0.8})`);
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(vfx.x - beamW / 2, vfx.y - beamH, beamW, beamH);

    // 2. Anéis Rúnicos no Piso
    const ringRadius = 26 + t * 24;
    ctx.beginPath();
    ctx.ellipse(vfx.x, vfx.y, ringRadius, ringRadius * 0.52, 0, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(192, 132, 252, ${(1 - t) * 0.9})`;
    ctx.lineWidth = 2.5 / zoom;
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(vfx.x, vfx.y, ringRadius * 0.65, ringRadius * 0.35, 0, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(56, 189, 248, ${(1 - t) * 0.85})`;
    ctx.lineWidth = 1.8 / zoom;
    ctx.stroke();

    // 3. Partículas Ascendentes Espirais
    for (let i = 0; i < vfx.particles.length; i++) {
      const p = vfx.particles[i];
      const partProgress = (t * 1.5 + i * 0.07) % 1;
      const partY = vfx.y - partProgress * beamH;
      const partX = vfx.x + Math.cos(p.angle + t * 6) * (p.radOffset + t * 14);
      const partAlpha = Math.sin(partProgress * Math.PI) * (1 - t);

      ctx.fillStyle = i % 2 === 0 ? `rgba(254, 240, 138, ${partAlpha})` : `rgba(56, 189, 248, ${partAlpha})`;
      ctx.beginPath();
      ctx.arc(partX, partY, p.size / zoom, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

// Instância singleton global
window.PortalTravelController = new EtheriaPortalTravelController();
