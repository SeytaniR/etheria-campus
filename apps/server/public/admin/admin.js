/**
 * @file apps/server/public/admin/admin.js
 * @module @etheria/server
 * @description Controlador Frontend Orientado a Objetos da Rota `/admin` (Studio Low-Code).
 *   Implementa:
 *   1. Autenticação Dual-Mode (.env somente no localhost / CRUD do PostgreSQL para acessos externos).
 *   2. CRUD completo de Contas de Usuários (`ADMIN`, `GM`, `PLAYER`).
 *   3. Editor Visual de Mapas com suporte completo a Touch Mobile (Pinça de 2 dedos para Zoom/Pan em qualquer ferramenta,
 *      arraste de câmera e vértices com 1 dedo, Mira Central de Precisão (+), Desfazer Ponto e Tela Cheia) e Mouse Desktop.
 */

class EtheriaAdminStudio {
  constructor() {
    this.token = localStorage.getItem('etheria_admin_token') || '';
    this.session = null;
    this.isStrictLocalhost = false;

    this.biomes = [];
    this.mapTypes = [];
    this.npcTemplates = [];
    this.savedMaps = [];
    this.mcreworkMaps = [];
    this.mcreworkNpcs = [];

    // Estado do Mapa atual aberto no editor
    this.currentMapId = null;
    this.collisionPolygons = [];
    this.overlapPolygons = [];
    this.portals = [];
    this.npcs = [];

    // Polígono atualmente selecionado para pontilhar vértices
    this.activeCollisionPolyIndex = -1;
    this.activeOverlapPolyIndex = -1;

    // Câmera, Toque Mobile e Canvas
    this.tool = 'PAN'; // PAN | COLLISION | OVERLAP | PORTAL | NPC
    this.bgImage = null;
    this.camX = 20;
    this.camY = 20;
    this.zoom = 0.45;
    this.isPanning = false;
    this.panStartX = 0;
    this.panStartY = 0;
    this.draggingVertex = null; // { list: 'COLLISION'|'OVERLAP'|'PORTAL'|'NPC', polyIdx, ptIdx }
    this.lastPinchDist = 0;
    this.lastPinchMidX = 0;
    this.lastPinchMidY = 0;
    this.touchMoved = false;

    this.init();
  }

  async init() {
    this.setupCanvasEvents();
    await this.checkAuthContext();
  }

  async api(path, options = {}) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    const res = await fetch(path, Object.assign({}, options, { headers }));
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Erro HTTP ${res.status}`);
    }
    return data;
  }

  async checkAuthContext() {
    try {
      const ctx = await this.api('/api/admin/auth/context');
      this.isStrictLocalhost = ctx.isStrictLocalhost;

      const banner = document.getElementById('authContextBanner');
      if (ctx.isStrictLocalhost) {
        banner.className = 'status-pill status-local';
        banner.innerHTML = '🟢 <strong>Acesso Localhost Detectado:</strong> Você pode entrar usando o login/senha do arquivo <code>.env</code> ou qualquer conta <code>ADMIN</code> do CRUD.';
      } else {
        banner.className = 'status-pill status-remote';
        banner.innerHTML = '🔒 <strong>Acesso Externo Detectado:</strong> A senha do <code>.env</code> está bloqueada por segurança. Entre com uma conta <code>ADMIN</code> cadastrada no CRUD do banco.';
      }

      if (ctx.authenticated && ctx.session) {
        this.session = ctx.session;
        await this.enterStudio();
      }
    } catch (err) {
      console.error(err);
    }
  }

  async login() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errBox = document.getElementById('loginError');
    errBox.style.display = 'none';

    try {
      const res = await this.api('/api/admin/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      this.token = res.token;
      this.session = res.session;
      localStorage.setItem('etheria_admin_token', this.token);
      await this.enterStudio();
    } catch (err) {
      errBox.textContent = err.message;
      errBox.style.display = 'block';
    }
  }

  logout() {
    this.token = '';
    this.session = null;
    localStorage.removeItem('etheria_admin_token');
    document.getElementById('adminApp').style.display = 'none';
    document.getElementById('loginScreen').style.display = 'flex';
    this.checkAuthContext();
  }

  async enterStudio() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminApp').style.display = 'flex';
    document.getElementById('sessionBadge').textContent =
      `${this.session.username} (${this.session.authSource === 'LOCAL_ENV' ? '.env' : 'CRUD'})`;

    await this.loadBootstrapData();
    await this.loadUsers();
    this.resizeCanvas();
  }

  switchTab(tab) {
    const isMaps = tab === 'maps';
    document.getElementById('tabMaps').style.display = isMaps ? 'grid' : 'none';
    document.getElementById('tabUsers').style.display = isMaps ? 'none' : 'flex';
    document.getElementById('tabBtnMaps').className = isMaps ? 'btn-primary' : '';
    document.getElementById('tabBtnUsers').className = !isMaps ? 'btn-primary' : '';
    if (isMaps) {
      setTimeout(() => this.resizeCanvas(), 50);
    }
  }

  toggleFullscreenMap() {
    const panel = document.getElementById('canvasPanel');
    const btn = document.getElementById('btnToggleFullscreen');
    panel.classList.toggle('fullscreen-map');
    const isFull = panel.classList.contains('fullscreen-map');
    btn.textContent = isFull ? '❎ Sair Tela Cheia' : '⛶ Tela Cheia';
    setTimeout(() => this.resizeCanvas(), 60);
  }

  // ==========================================================================
  // ABA 1: EDITOR DE MAPAS & POLÍGONOS ESTILO GOOGLE EARTH
  // ==========================================================================

  async loadBootstrapData() {
    const data = await this.api('/api/admin/maps/bootstrap');
    this.biomes = data.biomes || [];
    this.mapTypes = data.mapTypes || [];
    this.npcTemplates = data.npcTemplates || [];
    this.savedMaps = data.maps || [];

    this.renderSelectOptions();
    this.renderSavedMapsList();

    if (this.savedMaps.length > 0 && !this.currentMapId) {
      this.selectSavedMap(this.savedMaps[0].id);
    } else if (this.savedMaps.length === 0) {
      this.newBlankMapState();
    }
  }

  renderSelectOptions() {
    const mtSelect = document.getElementById('mapTypeSelect');
    mtSelect.innerHTML = this.mapTypes
      .map((mt) => `<option value="${mt.id}">${mt.namePtBr} (${mt.code})</option>`)
      .join('');
    this.updateMapTypeRuleBadge();

    const biomeOptions = this.biomes
      .map((b, idx) => `<option value="${b.id}">#${idx + 1} - ${b.namePtBr} [${b.category}]</option>`)
      .join('');
    document.getElementById('primaryBiomeSelect').innerHTML = biomeOptions;
    document.getElementById('secondaryBiomeSelect').innerHTML = biomeOptions;
    if (this.biomes.length > 1) {
      document.getElementById('secondaryBiomeSelect').value = String(this.biomes[1].id);
    }
    this.updateBiomeDesc();

    const npcSelect = document.getElementById('activeNpcTemplateSelect');
    if (this.npcTemplates.length === 0) {
      npcSelect.innerHTML = `<option value="">Nenhum NPC cadastrado (Clique em + Criar NPC)</option>`;
    } else {
      npcSelect.innerHTML = this.npcTemplates
        .map((n) => `<option value="${n.id}">${n.namePtBr} (${n.mcreworkNpcKey})</option>`)
        .join('');
    }
  }

  updateMapTypeRuleBadge() {
    const id = Number(document.getElementById('mapTypeSelect').value);
    const mt = this.mapTypes.find((x) => x.id === id);
    const badge = document.getElementById('mapTypeRulesBadge');
    if (!mt) return;

    const dom = mt.dominationTarget === 'ALLIANCE' ? '🏰 Dominado por Alianças' : '🚩 Dominado por Facções';
    const spawn = mt.allowMonsterSpawn ? '👹 Spawna Monstros' : '🕊️ Sem Monstros';
    const pvpMap = {
      DUEL_ONLY: '🤝 PvP: Apenas Duelo Aceito',
      FORCED_PK: '⚠️ PvP: Permite Forçar PK (Vira Criminoso)',
      OPEN_PVP: '⚔️ PvP: Totalmente Aberto',
    };
    badge.innerHTML = `${dom} &bull; ${spawn}<br>${pvpMap[mt.pvpRule] || mt.pvpRule}`;
  }

  updateBiomeDesc() {
    const b1Id = Number(document.getElementById('primaryBiomeSelect').value);
    const b2Id = Number(document.getElementById('secondaryBiomeSelect').value);
    const b1 = this.biomes.find((x) => x.id === b1Id);
    const b2 = this.biomes.find((x) => x.id === b2Id);
    const box = document.getElementById('biomeDescBox');
    box.innerHTML =
      (b1 ? `<strong>1. ${b1.namePtBr}:</strong> ${b1.descriptionPtBr}<br>` : '') +
      (b2 ? `<strong>2. ${b2.namePtBr}:</strong> ${b2.descriptionPtBr}` : '');
  }

  renderSavedMapsList() {
    const container = document.getElementById('savedMapsList');
    if (this.savedMaps.length === 0) {
      container.innerHTML = `<div style="font-size:0.78rem; color:var(--text-muted);">Nenhum mapa salvo no banco ainda. Clique em "➕ Novo do mcrework".</div>`;
      return;
    }
    container.innerHTML = this.savedMaps
      .map(
        (m) => `
      <div class="item-row ${m.id === this.currentMapId ? 'selected' : ''}" onclick="AdminApp.selectSavedMap(${m.id})" style="cursor:pointer;">
        <div>
          <strong>${m.namePtBr}</strong> <span style="color:var(--accent); font-size:0.72rem;">(Nv.${m.requiredLevel})</span>
          <div style="font-size:0.68rem; color:var(--text-muted);">${m.code} &bull; ${m.mapType?.code || ''}</div>
        </div>
      </div>`
      )
      .join('');
  }

  newBlankMapState(mcreworkItem) {
    this.currentMapId = null;
    const nextOrder = this.savedMaps.length + 1;
    const suggestedLevel = nextOrder === 1 ? 1 : (nextOrder - 1) * 10;

    document.getElementById('mapCode').value = mcreworkItem ? mcreworkItem.folderCode : `map_${nextOrder}`;
    document.getElementById('mapNamePtBr').value = mcreworkItem ? `Mapa ${mcreworkItem.mcreworkId}` : '';
    document.getElementById('mapReqLevel').value = suggestedLevel;
    document.getElementById('mapImagePath').value = mcreworkItem ? mcreworkItem.bgImageUrl : '';
    document.getElementById('mapOverlapOpacity').value = '0.45';
    document.getElementById('mapDominatedBy').value = '';

    this.collisionPolygons = [];
    this.overlapPolygons = [];
    this.portals = [];
    this.npcs = [];
    this.activeCollisionPolyIndex = -1;
    this.activeOverlapPolyIndex = -1;

    if (mcreworkItem?.bgImageUrl) {
      this.loadMapBackgroundImage(mcreworkItem.bgImageUrl);
    } else {
      this.bgImage = null;
      this.drawCanvas();
    }
    this.renderLayerLists();
    this.renderSavedMapsList();
  }

  selectSavedMap(mapId) {
    const m = this.savedMaps.find((x) => x.id === mapId);
    if (!m) return;

    this.currentMapId = m.id;
    document.getElementById('mapCode').value = m.code;
    document.getElementById('mapNamePtBr').value = m.namePtBr;
    document.getElementById('mapReqLevel').value = m.requiredLevel;
    document.getElementById('mapImagePath').value = m.mcreworkMapImage;
    document.getElementById('mapTypeSelect').value = String(m.mapTypeId);
    document.getElementById('primaryBiomeSelect').value = String(m.primaryBiomeId);
    document.getElementById('secondaryBiomeSelect').value = String(m.secondaryBiomeId);
    document.getElementById('mapOverlapOpacity').value = String(m.overlapOpacity ?? 0.45);
    document.getElementById('mapDominatedBy').value = m.dominatedById || '';

    this.updateMapTypeRuleBadge();
    this.updateBiomeDesc();

    this.collisionPolygons = Array.isArray(m.collisionMeshJson) ? JSON.parse(JSON.stringify(m.collisionMeshJson)) : [];
    this.overlapPolygons = Array.isArray(m.overlapMeshJson) ? JSON.parse(JSON.stringify(m.overlapMeshJson)) : [];
    this.portals = Array.isArray(m.outgoingPortals) ? JSON.parse(JSON.stringify(m.outgoingPortals)) : [];
    this.npcs = Array.isArray(m.npcs) ? JSON.parse(JSON.stringify(m.npcs)) : [];

    this.activeCollisionPolyIndex = this.collisionPolygons.length - 1;
    this.activeOverlapPolyIndex = this.overlapPolygons.length - 1;

    this.loadMapBackgroundImage(m.mcreworkMapImage);
    this.renderLayerLists();
    this.renderSavedMapsList();
  }

  loadMapBackgroundImage(url) {
    if (!url) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      this.bgImage = img;
      this.resetCamera();
    };
    img.src = url;
  }

  resetCamera() {
    const canvas = document.getElementById('mapCanvas');
    if (this.bgImage) {
      const scaleX = (canvas.width - 24) / this.bgImage.width;
      const scaleY = (canvas.height - 24) / this.bgImage.height;
      this.zoom = Math.max(0.12, Math.min(1.2, Math.min(scaleX, scaleY)));
      this.camX = (canvas.width - this.bgImage.width * this.zoom) / 2;
      this.camY = (canvas.height - this.bgImage.height * this.zoom) / 2;
    } else {
      this.zoom = 0.5;
      this.camX = 20;
      this.camY = 20;
    }
    this.drawCanvas();
  }

  /**
   * Dá zoom mantendo o centro do canvas (Alvo Central +) fixo no mesmo ponto do mapa.
   */
  zoomByStep(factor) {
    const canvas = document.getElementById('mapCanvas');
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const newZoom = Math.max(0.1, Math.min(4.0, this.zoom * factor));
    this.camX = cx - ((cx - this.camX) / this.zoom) * newZoom;
    this.camY = cy - ((cy - this.camY) / this.zoom) * newZoom;
    this.zoom = newZoom;
    this.drawCanvas();
  }

  setTool(toolName) {
    this.tool = toolName;
    const mapIds = {
      PAN: 'toolPan',
      COLLISION: 'toolCollision',
      OVERLAP: 'toolOverlap',
      PORTAL: 'toolPortal',
      NPC: 'toolNpc',
    };
    for (const [k, btnId] of Object.entries(mapIds)) {
      document.getElementById(btnId).className = k === toolName ? 'active-tool' : '';
    }

    if (toolName === 'COLLISION' && this.collisionPolygons.length === 0) {
      this.startNewPolygon('COLLISION');
    } else if (toolName === 'OVERLAP' && this.overlapPolygons.length === 0) {
      this.startNewPolygon('OVERLAP');
    }
    this.drawCanvas();
  }

  startNewPolygon(type) {
    if (type === 'COLLISION') {
      const idx = this.collisionPolygons.length + 1;
      this.collisionPolygons.push({
        id: `col_${Date.now()}_${idx}`,
        name: `Colisão #${idx}`,
        points: [],
      });
      this.activeCollisionPolyIndex = this.collisionPolygons.length - 1;
      this.setTool('COLLISION');
    } else {
      const idx = this.overlapPolygons.length + 1;
      this.overlapPolygons.push({
        id: `ovl_${Date.now()}_${idx}`,
        name: `Sobreposição #${idx}`,
        points: [],
      });
      this.activeOverlapPolyIndex = this.overlapPolygons.length - 1;
      this.setTool('OVERLAP');
    }
    this.renderLayerLists();
    this.drawCanvas();
  }

  /**
   * Remove o último ponto adicionado ao polígono ativo (ideal para uso rápido no celular).
   */
  undoLastPoint() {
    if (this.tool === 'OVERLAP') {
      const poly = this.overlapPolygons[this.activeOverlapPolyIndex];
      if (poly && poly.points.length > 0) {
        poly.points.pop();
      }
    } else {
      const poly = this.collisionPolygons[this.activeCollisionPolyIndex];
      if (poly && poly.points.length > 0) {
        poly.points.pop();
      }
    }
    this.renderLayerLists();
    this.drawCanvas();
  }

  /**
   * Marca um ponto/portal/NPC exatamente na coordenada sob a Mira Central (+) da tela!
   * Resolve 100% da precisão no celular (onde o dedo poderia cobrir o ponto exato).
   */
  placeAtCenterCrosshair() {
    const canvas = document.getElementById('mapCanvas');
    const worldX = Math.round((canvas.width / 2 - this.camX) / this.zoom);
    const worldY = Math.round((canvas.height / 2 - this.camY) / this.zoom);

    if (this.tool === 'PAN') {
      // Se estava em PAN, adiciona na camada de colisão por padrão ou avisa
      this.setTool('COLLISION');
    }
    this.applyToolPlacementAtWorldPoint(worldX, worldY);
  }

  applyToolPlacementAtWorldPoint(x, y) {
    if (this.tool === 'COLLISION') {
      if (this.activeCollisionPolyIndex < 0 || !this.collisionPolygons[this.activeCollisionPolyIndex]) {
        this.startNewPolygon('COLLISION');
      }
      this.collisionPolygons[this.activeCollisionPolyIndex].points.push({ x, y });
    } else if (this.tool === 'OVERLAP') {
      if (this.activeOverlapPolyIndex < 0 || !this.overlapPolygons[this.activeOverlapPolyIndex]) {
        this.startNewPolygon('OVERLAP');
      }
      this.overlapPolygons[this.activeOverlapPolyIndex].points.push({ x, y });
    } else if (this.tool === 'PORTAL') {
      const defaultTargetMapId = this.savedMaps[0]?.id || this.currentMapId || 1;
      this.portals.push({
        sourceX: x,
        sourceY: y,
        triggerRadius: 48,
        targetMapId: defaultTargetMapId,
        targetX: 500,
        targetY: 500,
      });
    } else if (this.tool === 'NPC') {
      const npcTemplateId = Number(document.getElementById('activeNpcTemplateSelect').value);
      if (!npcTemplateId) {
        alert('Cadastre ou selecione primeiro um Template de NPC usando o botão "➕ Criar NPC".');
        return;
      }
      this.npcs.push({
        npcTemplateId,
        posX: x,
        posY: y,
        direction: 0,
      });
    }
    this.renderLayerLists();
    this.drawCanvas();
  }

  // ==========================================================================
  // INTERAÇÃO DO CANVAS (SUPORTE COMPLETO A TOUCH MOBILE + PINÇA 2 DEDOS + MOUSE)
  // ==========================================================================

  setupCanvasEvents() {
    const viewport = document.getElementById('canvasViewport');
    const canvas = document.getElementById('mapCanvas');

    window.addEventListener('resize', () => this.resizeCanvas());

    const toWorldCoords = (clientX, clientY) => {
      const rect = canvas.getBoundingClientRect();
      const sx = clientX - rect.left;
      const sy = clientY - rect.top;
      return {
        x: Math.round((sx - this.camX) / this.zoom),
        y: Math.round((sy - this.camY) / this.zoom),
      };
    };

    const findHitObject = (worldX, worldY, isTouch = false) => {
      const hitRadius = Math.max(14, (isTouch ? 24 : 12) / this.zoom);

      // 1. Verifica vértices de polígonos
      const checkPolyList = (listName, polys) => {
        for (let pIdx = 0; pIdx < polys.length; pIdx++) {
          const pts = polys[pIdx].points || [];
          for (let vIdx = 0; vIdx < pts.length; vIdx++) {
            if (Math.hypot(pts[vIdx].x - worldX, pts[vIdx].y - worldY) <= hitRadius) {
              return { list: listName, polyIdx: pIdx, ptIdx: vIdx };
            }
          }
        }
        return null;
      };

      const polyHit =
        checkPolyList('COLLISION', this.collisionPolygons) ||
        checkPolyList('OVERLAP', this.overlapPolygons);
      if (polyHit) return polyHit;

      // 2. Verifica Portais para arrastar
      for (let i = 0; i < this.portals.length; i++) {
        if (Math.hypot(this.portals[i].sourceX - worldX, this.portals[i].sourceY - worldY) <= Math.max(hitRadius, 40)) {
          return { list: 'PORTAL', polyIdx: i, ptIdx: 0 };
        }
      }

      // 3. Verifica NPCs para arrastar
      for (let i = 0; i < this.npcs.length; i++) {
        if (Math.hypot(this.npcs[i].posX - worldX, this.npcs[i].posY - worldY) <= Math.max(hitRadius, 30)) {
          return { list: 'NPC', polyIdx: i, ptIdx: 0 };
        }
      }

      return null;
    };

    // --- EVENTOS TOUCH PARA CELULAR (1 DEDO PAN/ARRASTE/PONTO + 2 DEDOS PINÇA ZOOM/PAN) ---
    canvas.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        this.touchMoved = false;

        // 2 Dedos = Pinça de Zoom + Mover simultâneo em QUALQUER ferramenta!
        if (e.touches.length === 2) {
          this.isPanning = false;
          this.draggingVertex = null;
          const t1 = e.touches[0];
          const t2 = e.touches[1];
          this.lastPinchDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
          this.lastPinchMidX = (t1.clientX + t2.clientX) / 2;
          this.lastPinchMidY = (t1.clientY + t2.clientY) / 2;
          return;
        }

        // 1 Dedo
        if (e.touches.length === 1) {
          const t = e.touches[0];
          const { x, y } = toWorldCoords(t.clientX, t.clientY);

          // Se clicou em cima de um vértice, portal ou NPC existente, permite arrastar com o dedo!
          const hit = findHitObject(x, y, true);
          if (hit && this.tool !== 'PAN') {
            this.draggingVertex = hit;
            if (hit.list === 'COLLISION') this.activeCollisionPolyIndex = hit.polyIdx;
            if (hit.list === 'OVERLAP') this.activeOverlapPolyIndex = hit.polyIdx;
            this.renderLayerLists();
            this.drawCanvas();
            return;
          }

          // Na ferramenta PAN, 1 dedo move o mapa
          this.isPanning = true;
          this.panStartX = t.clientX - this.camX;
          this.panStartY = t.clientY - this.camY;
          this.touchStartClientX = t.clientX;
          this.touchStartClientY = t.clientY;
        }
      },
      { passive: false }
    );

    canvas.addEventListener(
      'touchmove',
      (e) => {
        e.preventDefault();

        // 2 Dedos: Pinça Zoom + Pan
        if (e.touches.length === 2) {
          this.touchMoved = true;
          const t1 = e.touches[0];
          const t2 = e.touches[1];
          const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
          const midX = (t1.clientX + t2.clientX) / 2;
          const midY = (t1.clientY + t2.clientY) / 2;

          if (this.lastPinchDist > 0) {
            const rect = canvas.getBoundingClientRect();
            const localMidX = midX - rect.left;
            const localMidY = midY - rect.top;

            const factor = dist / this.lastPinchDist;
            const newZoom = Math.max(0.1, Math.min(4.0, this.zoom * factor));

            // Ajusta câmera pelo zoom na pinça + deslocamento dos 2 dedos
            this.camX = localMidX - ((localMidX - this.camX) / this.zoom) * newZoom + (midX - this.lastPinchMidX);
            this.camY = localMidY - ((localMidY - this.camY) / this.zoom) * newZoom + (midY - this.lastPinchMidY);
            this.zoom = newZoom;
            this.drawCanvas();
          }

          this.lastPinchDist = dist;
          this.lastPinchMidX = midX;
          this.lastPinchMidY = midY;
          return;
        }

        // 1 Dedo
        if (e.touches.length === 1) {
          const t = e.touches[0];
          if (Math.hypot(t.clientX - (this.touchStartClientX || 0), t.clientY - (this.touchStartClientY || 0)) > 8) {
            this.touchMoved = true;
          }

          if (this.draggingVertex) {
            const { x, y } = toWorldCoords(t.clientX, t.clientY);
            this.moveDraggedObject(x, y);
            return;
          }

          if (this.isPanning) {
            this.camX = t.clientX - this.panStartX;
            this.camY = t.clientY - this.panStartY;
            this.drawCanvas();
          }
        }
      },
      { passive: false }
    );

    canvas.addEventListener(
      'touchend',
      (e) => {
        e.preventDefault();
        // Se foi um toque rápido (tap sem arrastar a tela) numa ferramenta de desenho, adiciona o ponto!
        if (!this.touchMoved && !this.draggingVertex && e.changedTouches.length === 1 && this.tool !== 'PAN') {
          const t = e.changedTouches[0];
          const { x, y } = toWorldCoords(t.clientX, t.clientY);
          this.applyToolPlacementAtWorldPoint(x, y);
        }
        if (e.touches.length < 2) {
          this.lastPinchDist = 0;
        }
        if (e.touches.length === 0) {
          this.isPanning = false;
          if (this.draggingVertex) {
            this.draggingVertex = null;
            this.renderLayerLists();
          }
        }
      },
      { passive: false }
    );

    // --- EVENTOS DE MOUSE (DESKTOP) ---
    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const { x, y } = toWorldCoords(e.clientX, e.clientY);
      const hit = findHitObject(x, y, false);
      if (hit && (hit.list === 'COLLISION' || hit.list === 'OVERLAP')) {
        const targetList = hit.list === 'COLLISION' ? this.collisionPolygons : this.overlapPolygons;
        targetList[hit.polyIdx].points.splice(hit.ptIdx, 1);
        this.renderLayerLists();
        this.drawCanvas();
      }
    });

    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 2) return;
      const { x, y } = toWorldCoords(e.clientX, e.clientY);

      if (e.button === 1 || this.tool === 'PAN') {
        this.isPanning = true;
        this.panStartX = e.clientX - this.camX;
        this.panStartY = e.clientY - this.camY;
        return;
      }

      const hit = findHitObject(x, y, false);
      if (hit) {
        this.draggingVertex = hit;
        if (hit.list === 'COLLISION') this.activeCollisionPolyIndex = hit.polyIdx;
        if (hit.list === 'OVERLAP') this.activeOverlapPolyIndex = hit.polyIdx;
        this.renderLayerLists();
        this.drawCanvas();
        return;
      }

      this.applyToolPlacementAtWorldPoint(x, y);
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isPanning) {
        this.camX = e.clientX - this.panStartX;
        this.camY = e.clientY - this.panStartY;
        this.drawCanvas();
        return;
      }
      if (this.draggingVertex) {
        const { x, y } = toWorldCoords(e.clientX, e.clientY);
        this.moveDraggedObject(x, y);
      }
    });

    window.addEventListener('mouseup', () => {
      this.isPanning = false;
      if (this.draggingVertex) {
        this.draggingVertex = null;
        this.renderLayerLists();
      }
    });

    viewport.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.14 : 0.88;
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        const newZoom = Math.max(0.1, Math.min(4.0, this.zoom * factor));
        this.camX = mx - ((mx - this.camX) / this.zoom) * newZoom;
        this.camY = my - ((my - this.camY) / this.zoom) * newZoom;
        this.zoom = newZoom;
        this.drawCanvas();
      },
      { passive: false }
    );
  }

  moveDraggedObject(x, y) {
    if (!this.draggingVertex) return;
    const { list, polyIdx, ptIdx } = this.draggingVertex;
    if (list === 'COLLISION' && this.collisionPolygons[polyIdx]?.points[ptIdx]) {
      this.collisionPolygons[polyIdx].points[ptIdx] = { x, y };
    } else if (list === 'OVERLAP' && this.overlapPolygons[polyIdx]?.points[ptIdx]) {
      this.overlapPolygons[polyIdx].points[ptIdx] = { x, y };
    } else if (list === 'PORTAL' && this.portals[polyIdx]) {
      this.portals[polyIdx].sourceX = x;
      this.portals[polyIdx].sourceY = y;
    } else if (list === 'NPC' && this.npcs[polyIdx]) {
      this.npcs[polyIdx].posX = x;
      this.npcs[polyIdx].posY = y;
    }
    this.drawCanvas();
  }

  resizeCanvas() {
    const viewport = document.getElementById('canvasViewport');
    const canvas = document.getElementById('mapCanvas');
    if (!viewport || !canvas) return;
    canvas.width = viewport.clientWidth || 800;
    canvas.height = viewport.clientHeight || 550;
    this.drawCanvas();
  }

  drawCanvas() {
    const canvas = document.getElementById('mapCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(this.camX, this.camY);
    ctx.scale(this.zoom, this.zoom);

    // 1. Imagem Limpa do Mapa
    if (this.bgImage) {
      ctx.drawImage(this.bgImage, 0, 0);
    } else {
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, 1600, 1200);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '28px sans-serif';
      ctx.fillText('Toque em "➕ Novo do mcrework" para abrir um mapa', 220, 560);
    }

    // 2 & 3. Polígonos Estilo Google Earth (Colisão e Sobreposição)
    const drawPolygonLayer = (polygons, activeIdx, fillRgb, strokeHex) => {
      polygons.forEach((poly, idx) => {
        const pts = poly.points || [];
        if (pts.length === 0) return;

        const isSelected = idx === activeIdx;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
        if (pts.length >= 3) {
          ctx.closePath();
          ctx.fillStyle = isSelected ? `rgba(${fillRgb}, 0.44)` : `rgba(${fillRgb}, 0.28)`;
          ctx.fill();
        }

        ctx.lineWidth = (isSelected ? 3 : 2) / this.zoom;
        ctx.strokeStyle = isSelected ? '#fde047' : strokeHex;
        ctx.stroke();

        const r = Math.max(6, 8 / this.zoom);
        pts.forEach((pt, vIdx) => {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
          ctx.fillStyle = vIdx === pts.length - 1 ? '#fde047' : '#ffffff';
          ctx.fill();
          ctx.lineWidth = 1.8 / this.zoom;
          ctx.strokeStyle = '#020617';
          ctx.stroke();
        });
      });
    };

    drawPolygonLayer(
      this.collisionPolygons,
      this.tool === 'COLLISION' ? this.activeCollisionPolyIndex : -1,
      '239, 68, 68',
      '#ef4444'
    );

    drawPolygonLayer(
      this.overlapPolygons,
      this.tool === 'OVERLAP' ? this.activeOverlapPolyIndex : -1,
      '56, 189, 248',
      '#38bdf8'
    );

    // 4. Portais
    this.portals.forEach((p, idx) => {
      const radius = Number(p.triggerRadius) || 48;
      ctx.beginPath();
      ctx.arc(p.sourceX, p.sourceY, radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(168, 85, 247, 0.35)';
      ctx.fill();
      ctx.lineWidth = 2.5 / this.zoom;
      ctx.strokeStyle = '#c084fc';
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.max(12, Math.round(14 / this.zoom))}px sans-serif`;
      ctx.fillText(`🌀 Portal #${idx + 1}`, p.sourceX - radius, p.sourceY - radius - 6);
    });

    // 5. NPCs
    this.npcs.forEach((n) => {
      const tpl = this.npcTemplates.find((t) => t.id === Number(n.npcTemplateId));
      const label = tpl ? tpl.namePtBr : `NPC #${n.npcTemplateId}`;
      ctx.beginPath();
      ctx.arc(n.posX, n.posY, 24, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(34, 197, 94, 0.45)';
      ctx.fill();
      ctx.lineWidth = 2.5 / this.zoom;
      ctx.strokeStyle = '#4ade80';
      ctx.stroke();

      ctx.fillStyle = '#bbf7d0';
      ctx.font = `bold ${Math.max(12, Math.round(14 / this.zoom))}px sans-serif`;
      ctx.fillText(`🧙 ${label}`, n.posX - 28, n.posY - 28);
    });

    ctx.restore();

    // 6. Desenha o Alvo de Precisão Central (+) fixo no centro do visor para uso milimétrico no celular!
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const worldCenterX = Math.round((cx - this.camX) / this.zoom);
    const worldCenterY = Math.round((cy - this.camY) / this.zoom);

    ctx.save();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 14, cy);
    ctx.lineTo(cx + 14, cy);
    ctx.moveTo(cx, cy - 14);
    ctx.lineTo(cx, cy + 14);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(cx + 10, cy - 26, 110, 20);
    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(`X:${worldCenterX} Y:${worldCenterY}`, cx + 15, cy - 12);
    ctx.restore();
  }

  renderLayerLists() {
    document.getElementById('countCollision').textContent = String(this.collisionPolygons.length);
    document.getElementById('countOverlap').textContent = String(this.overlapPolygons.length);
    document.getElementById('countPortals').textContent = String(this.portals.length);
    document.getElementById('countNpcs').textContent = String(this.npcs.length);

    document.getElementById('collisionList').innerHTML = this.collisionPolygons
      .map(
        (p, idx) => `
      <div class="item-row ${idx === this.activeCollisionPolyIndex && this.tool === 'COLLISION' ? 'selected' : ''}">
        <div onclick="AdminApp.selectPolygon('COLLISION', ${idx})" style="cursor:pointer; flex:1;">
          <strong>${p.name}</strong> <span style="color:var(--text-muted);">(${p.points.length} pts)</span>
        </div>
        <button class="btn-danger" style="padding:3px 7px;" onclick="AdminApp.removePolygon('COLLISION', ${idx})">✕</button>
      </div>`
      )
      .join('');

    document.getElementById('overlapList').innerHTML = this.overlapPolygons
      .map(
        (p, idx) => `
      <div class="item-row ${idx === this.activeOverlapPolyIndex && this.tool === 'OVERLAP' ? 'selected' : ''}">
        <div onclick="AdminApp.selectPolygon('OVERLAP', ${idx})" style="cursor:pointer; flex:1;">
          <strong>${p.name}</strong> <span style="color:var(--text-muted);">(${p.points.length} pts)</span>
        </div>
        <button class="btn-danger" style="padding:3px 7px;" onclick="AdminApp.removePolygon('OVERLAP', ${idx})">✕</button>
      </div>`
      )
      .join('');

    const targetMapOptions = (selectedId) =>
      this.savedMaps
        .map(
          (m) =>
            `<option value="${m.id}" ${Number(selectedId) === m.id ? 'selected' : ''}>${m.namePtBr} (ID:${m.id})</option>`
        )
        .join('');

    document.getElementById('portalsList').innerHTML = this.portals
      .map(
        (p, idx) => `
      <div class="item-row" style="flex-direction:column; align-items:stretch; gap:6px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong>🌀 Portal #${idx + 1} (${p.sourceX}, ${p.sourceY})</strong>
          <button class="btn-danger" style="padding:2px 6px;" onclick="AdminApp.removePortal(${idx})">✕</button>
        </div>
        <div class="field">
          <label>Leva para o Mapa:</label>
          <select onchange="AdminApp.updatePortalField(${idx}, 'targetMapId', this.value)">
            ${targetMapOptions(p.targetMapId)}
          </select>
        </div>
        <div class="row-2">
          <div class="field">
            <label>Destino X</label>
            <input type="number" value="${p.targetX}" onchange="AdminApp.updatePortalField(${idx}, 'targetX', this.value)" />
          </div>
          <div class="field">
            <label>Destino Y</label>
            <input type="number" value="${p.targetY}" onchange="AdminApp.updatePortalField(${idx}, 'targetY', this.value)" />
          </div>
        </div>
      </div>`
      )
      .join('');

    document.getElementById('npcsList').innerHTML = this.npcs
      .map((n, idx) => {
        const tpl = this.npcTemplates.find((t) => t.id === Number(n.npcTemplateId));
        return `
      <div class="item-row">
        <div>
          <strong>🧙 ${tpl ? tpl.namePtBr : `NPC #${n.npcTemplateId}`}</strong>
          <div style="font-size:0.7rem; color:var(--text-muted);">Pos: (${n.posX}, ${n.posY})</div>
        </div>
        <button class="btn-danger" style="padding:3px 7px;" onclick="AdminApp.removeMapNpc(${idx})">✕</button>
      </div>`;
      })
      .join('');
  }

  selectPolygon(type, idx) {
    if (type === 'COLLISION') {
      this.activeCollisionPolyIndex = idx;
      this.setTool('COLLISION');
    } else {
      this.activeOverlapPolyIndex = idx;
      this.setTool('OVERLAP');
    }
    this.renderLayerLists();
    this.drawCanvas();
  }

  removePolygon(type, idx) {
    if (type === 'COLLISION') {
      this.collisionPolygons.splice(idx, 1);
      this.activeCollisionPolyIndex = this.collisionPolygons.length - 1;
    } else {
      this.overlapPolygons.splice(idx, 1);
      this.activeOverlapPolyIndex = this.overlapPolygons.length - 1;
    }
    this.renderLayerLists();
    this.drawCanvas();
  }

  updatePortalField(idx, field, value) {
    if (!this.portals[idx]) return;
    this.portals[idx][field] = Number(value);
    this.drawCanvas();
  }

  removePortal(idx) {
    this.portals.splice(idx, 1);
    this.renderLayerLists();
    this.drawCanvas();
  }

  removeMapNpc(idx) {
    this.npcs.splice(idx, 1);
    this.renderLayerLists();
    this.drawCanvas();
  }

  async saveCurrentMap() {
    try {
      const dto = {
        code: document.getElementById('mapCode').value.trim(),
        namePtBr: document.getElementById('mapNamePtBr').value.trim(),
        mcreworkMapImage: document.getElementById('mapImagePath').value.trim(),
        requiredLevel: Number(document.getElementById('mapReqLevel').value) || 1,
        mapTypeId: Number(document.getElementById('mapTypeSelect').value),
        primaryBiomeId: Number(document.getElementById('primaryBiomeSelect').value),
        secondaryBiomeId: Number(document.getElementById('secondaryBiomeSelect').value),
        overlapOpacity: Number(document.getElementById('mapOverlapOpacity').value) || 0.45,
        dominatedById: document.getElementById('mapDominatedBy').value.trim() || null,
        collisionMeshJson: this.collisionPolygons,
        overlapMeshJson: this.overlapPolygons,
        portals: this.portals,
        npcs: this.npcs,
      };

      const path = this.currentMapId ? `/api/admin/maps/${this.currentMapId}` : '/api/admin/maps';
      const method = this.currentMapId ? 'PUT' : 'POST';
      const res = await this.api(path, {
        method,
        body: JSON.stringify(dto),
      });

      this.currentMapId = res.id;
      await this.loadBootstrapData();
      this.selectSavedMap(res.id);
      alert('✅ Mapa salvo no PostgreSQL e Snapshot JSON atualizado com sucesso!');
    } catch (err) {
      alert(`Erro ao salvar mapa: ${err.message}`);
    }
  }

  async deleteCurrentMap() {
    if (!this.currentMapId) return;
    if (!confirm('Tem certeza que deseja excluir este mapa do banco de dados?')) return;
    try {
      await this.api(`/api/admin/maps/${this.currentMapId}`, { method: 'DELETE' });
      this.currentMapId = null;
      await this.loadBootstrapData();
    } catch (err) {
      alert(`Erro ao excluir mapa: ${err.message}`);
    }
  }

  // ==========================================================================
  // MODAIS DE GALERIA DO MCREWORK (MAPAS LIMPOS E NPCS)
  // ==========================================================================

  async openMcreworkMapPicker() {
    document.getElementById('mapPickerModal').style.display = 'flex';
    const grid = document.getElementById('mcreworkMapsGrid');
    if (this.mcreworkMaps.length === 0) {
      grid.innerHTML = '<div>Carregando as 76 imagens de mapas do mcrework...</div>';
      try {
        this.mcreworkMaps = await this.api('/api/admin/mcrework/maps');
      } catch (err) {
        grid.innerHTML = `<div style="color:#fca5a5;">${err.message}</div>`;
        return;
      }
    }

    grid.innerHTML = this.mcreworkMaps
      .map(
        (m, idx) => `
      <div class="gallery-card" onclick="AdminApp.pickMcreworkMap(${idx})">
        <img src="${m.thumbUrl}" alt="${m.folderCode}" loading="lazy" />
        <strong>${m.folderCode}</strong>
        <span style="font-size:0.72rem; color:var(--text-muted);">${m.width}x${m.height} px</span>
      </div>`
      )
      .join('');
  }

  pickMcreworkMap(idx) {
    const item = this.mcreworkMaps[idx];
    if (!item) return;
    this.closeModal('mapPickerModal');

    if (!this.currentMapId && !document.getElementById('mapNamePtBr').value.trim()) {
      this.newBlankMapState(item);
    } else {
      document.getElementById('mapImagePath').value = item.bgImageUrl;
      this.loadMapBackgroundImage(item.bgImageUrl);
    }
  }

  async openNpcTemplateModal() {
    document.getElementById('npcModal').style.display = 'flex';
    const grid = document.getElementById('mcreworkNpcsGrid');
    if (this.mcreworkNpcs.length === 0) {
      grid.innerHTML = '<div>Carregando os 365 NPCs do mcrework...</div>';
      try {
        this.mcreworkNpcs = await this.api('/api/admin/mcrework/npcs');
      } catch (err) {
        grid.innerHTML = `<div style="color:#fca5a5;">${err.message}</div>`;
        return;
      }
    }

    grid.innerHTML = this.mcreworkNpcs
      .map(
        (n) => `
      <div class="gallery-card" onclick="document.getElementById('npcAssetKeyInput').value='${n.mcreworkNpcKey}'; document.getElementById('npcCodeInput').value='${n.mcreworkNpcKey}';">
        <img src="${n.thumbUrl}" alt="${n.mcreworkNpcKey}" loading="lazy" style="object-fit:contain;" />
        <strong>${n.mcreworkNpcKey}</strong>
      </div>`
      )
      .join('');
  }

  async saveNewNpcTemplate() {
    try {
      const code = document.getElementById('npcCodeInput').value.trim();
      const namePtBr = document.getElementById('npcNameInput').value.trim();
      const mcreworkNpcKey = document.getElementById('npcAssetKeyInput').value.trim();
      const fn = document.getElementById('npcFunctionSelect').value;

      if (!code || !namePtBr || !mcreworkNpcKey) {
        alert('Preencha o Código, Nome e selecione um visual de NPC da galeria.');
        return;
      }

      const created = await this.api('/api/admin/npc-templates', {
        method: 'POST',
        body: JSON.stringify({
          code,
          namePtBr,
          mcreworkNpcKey,
          isDecorationOnly: fn === 'DECORATION',
          triggersJson: fn === 'DECORATION' ? [] : [{ type: fn }],
        }),
      });

      this.closeModal('npcModal');
      await this.loadBootstrapData();
      document.getElementById('activeNpcTemplateSelect').value = String(created.id);
      this.setTool('NPC');
    } catch (err) {
      alert(`Erro ao salvar NPC: ${err.message}`);
    }
  }

  closeModal(id) {
    document.getElementById(id).style.display = 'none';
  }

  // ==========================================================================
  // ABA 2: CRUD DE CONTAS DE USUÁRIOS (ACESSO EXTERNO AO /ADMIN)
  // ==========================================================================

  async loadUsers() {
    const users = await this.api('/api/admin/users');
    const tbody = document.getElementById('usersTableBody');
    if (users.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="color:var(--text-muted);">Nenhuma conta cadastrada no banco ainda. Crie uma conta ADMIN acima para poder acessar fora do localhost!</td></tr>`;
      return;
    }

    tbody.innerHTML = users
      .map(
        (u) => `
      <tr>
        <td>#${u.id}</td>
        <td><strong>${u.username}</strong></td>
        <td>${u.email}</td>
        <td><span style="padding:2px 8px; border-radius:99px; background:rgba(56,189,248,0.15); color:var(--accent); font-weight:700;">${u.role}</span></td>
        <td>${new Date(u.createdAt).toLocaleString('pt-BR')}</td>
        <td style="display:flex; gap:6px;">
          <button onclick="AdminApp.populateUserForm(${u.id}, '${u.username}', '${u.email}', '${u.role}')">✏️ Editar</button>
          <button class="btn-danger" onclick="AdminApp.deleteUserAccount(${u.id})">🗑️</button>
        </td>
      </tr>`
      )
      .join('');
  }

  populateUserForm(id, username, email, role) {
    document.getElementById('editUserId').value = String(id);
    document.getElementById('userUsername').value = username;
    document.getElementById('userEmail').value = email;
    document.getElementById('userRole').value = role;
    document.getElementById('userPassword').value = '';
    document.getElementById('userPassword').placeholder = 'Deixe em branco para manter a senha atual';
  }

  clearUserForm() {
    document.getElementById('editUserId').value = '';
    document.getElementById('userUsername').value = '';
    document.getElementById('userEmail').value = '';
    document.getElementById('userPassword').value = '';
    document.getElementById('userPassword').placeholder = 'Senha de acesso';
    document.getElementById('userRole').value = 'ADMIN';
  }

  async saveUserAccount() {
    try {
      const editId = document.getElementById('editUserId').value;
      const dto = {
        username: document.getElementById('userUsername').value.trim(),
        email: document.getElementById('userEmail').value.trim(),
        password: document.getElementById('userPassword').value,
        role: document.getElementById('userRole').value,
      };

      if (editId) {
        await this.api(`/api/admin/users/${editId}`, {
          method: 'PUT',
          body: JSON.stringify(dto),
        });
      } else {
        await this.api('/api/admin/users', {
          method: 'POST',
          body: JSON.stringify(dto),
        });
      }

      this.clearUserForm();
      await this.loadUsers();
      alert('✅ Conta de usuário salva no PostgreSQL com sucesso!');
    } catch (err) {
      alert(`Erro ao salvar usuário: ${err.message}`);
    }
  }

  async deleteUserAccount(id) {
    if (!confirm('Deseja realmente excluir esta conta de usuário?')) return;
    try {
      await this.api(`/api/admin/users/${id}`, { method: 'DELETE' });
      await this.loadUsers();
    } catch (err) {
      alert(`Erro ao remover conta: ${err.message}`);
    }
  }
}

window.AdminApp = new EtheriaAdminStudio();
