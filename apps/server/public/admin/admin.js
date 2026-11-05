/**
 * @file apps/server/public/admin/admin.js
 * @module @etheria/server
 * @description Controlador Frontend Orientado a Objetos da Rota `/admin` (Studio Low-Code).
 *   Implementa:
 *   1. Autenticação Dual-Mode (.env somente no localhost / CRUD do PostgreSQL para acessos externos).
 *   2. CRUD completo de Contas de Usuários (`ADMIN`, `GM`, `PLAYER`).
 *   3. Painel de Ficha Técnica de Mapas + Modo Dedicado de Edição Visual em Tela Inteira (`100vw x 100dvh`):
 *      - Suporte a salvar mapas incompletos (`📝 Em Edição / Rascunho`) e retomar o trabalho a qualquer momento;
 *      - Ponto de Spawn do Mapa (`spawnX`, `spawnY`) para novatos, itens de teleporte, respawn em Cidade/Vila e Destravar Personagem;
 *      - Portais sempre em Duplas Interligadas (Entrada <-> Saída bidirecional na posição do portal par);
 *      - Trava de segurança de malhas (`🔒` por padrão) + Modo Dedicado `✏️ Editar Vértices`;
 *      - Histórico Completo de Estado (`↩️ Desfazer` e `↪️ Refazer` para criações e edições).
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
    this.mapPickerMode = 'NEW_MAP'; // 'NEW_MAP' | 'CHANGE_IMAGE'

    // Estado do Mapa atual aberto no editor
    this.currentMapId = null;
    this.spawnX = 500;
    this.spawnY = 500;
    this.collisionPolygons = [];
    this.overlapPolygons = [];
    this.portals = [];
    this.npcs = [];

    // Polígono atualmente selecionado para adicionar pontos ou editar vértices
    this.activeCollisionPolyIndex = -1;
    this.activeOverlapPolyIndex = -1;
    this.editableLayerType = 'ALL';

    // Histórico completo de ações (Undo / Redo de criações e de arrastes de vértices)
    this.undoStack = [];
    this.redoStack = [];
    this.preDragSnapshot = null;
    this.dragChanged = false;

    // Câmera, Toque Mobile e Canvas
    // Ferramentas: PAN | SPAWN | COLLISION | OVERLAP | PORTAL | NPC | EDIT
    this.tool = 'PAN';
    this.bgImage = null;
    this.camX = 20;
    this.camY = 20;
    this.zoom = 0.45;
    this.cameraInitializedForUrl = '';
    this.isPanning = false;
    this.panStartX = 0;
    this.panStartY = 0;
    this.draggingVertex = null;
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
        banner.innerHTML =
          '🟢 <strong>Acesso Localhost Detectado:</strong> Você pode entrar usando o login/senha do arquivo <code>.env</code> ou qualquer conta <code>ADMIN</code> do CRUD.';
      } else {
        banner.className = 'status-pill status-remote';
        banner.innerHTML =
          '🔒 <strong>Acesso Externo Detectado:</strong> A senha do <code>.env</code> está bloqueada por segurança. Entre com uma conta <code>ADMIN</code> cadastrada no CRUD do banco.';
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
    document.getElementById('visualMapEditorScreen').style.display = 'none';
    document.getElementById('adminApp').style.display = 'none';
    document.getElementById('loginScreen').style.display = 'flex';
    this.checkAuthContext();
  }

  async enterStudio() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminApp').style.display = 'flex';
    document.getElementById('sessionBadge').textContent = `${this.session.username} (${
      this.session.authSource === 'LOCAL_ENV' ? '.env' : 'CRUD'
    })`;

    await this.loadBootstrapData();
    await this.loadUsers();
  }

  switchTab(tab) {
    const isMaps = tab === 'maps';
    document.getElementById('tabMaps').style.display = isMaps ? 'grid' : 'none';
    document.getElementById('tabUsers').style.display = isMaps ? 'none' : 'flex';
    document.getElementById('tabBtnMaps').className = isMaps ? 'btn-primary' : '';
    document.getElementById('tabBtnUsers').className = !isMaps ? 'btn-primary' : '';
  }

  // ==========================================================================
  // ENTRAR / SAIR DO ESTÚDIO DE EDIÇÃO VISUAL DE TELA INTEIRA (100% FOCO NO MAPA)
  // ==========================================================================

  enterVisualMapEditor() {
    const imgUrl = document.getElementById('mapImagePath').value.trim();
    if (!imgUrl) {
      alert('Selecione primeiro uma imagem base do mapa clicando em "➕ Novo do mcrework" ou "🖼️ Trocar Imagem".');
      this.openMcreworkMapPicker();
      return;
    }

    document.getElementById('visualMapEditorScreen').style.display = 'flex';
    setTimeout(() => {
      this.resizeCanvas();
      if (this.cameraInitializedForUrl !== imgUrl) {
        this.cameraInitializedForUrl = imgUrl;
        this.resetCamera();
      } else {
        this.drawCanvas();
      }
    }, 40);
  }

  exitVisualMapEditor() {
    document.getElementById('visualMapEditorScreen').style.display = 'none';
    this.renderLayerLists();
  }

  toggleLayersDrawer(forceState) {
    const drawer = document.getElementById('layersDrawer');
    if (typeof forceState === 'boolean') {
      drawer.classList.toggle('open', forceState);
    } else {
      drawer.classList.toggle('open');
    }
  }

  // ==========================================================================
  // HISTÓRICO REAL DE AÇÕES (UNDO / REDO TANTO DE CRIAÇÃO QUANTO DE EDIÇÃO)
  // ==========================================================================

  captureCurrentSnapshot() {
    return JSON.stringify({
      spawnX: this.spawnX,
      spawnY: this.spawnY,
      collisionPolygons: this.collisionPolygons,
      overlapPolygons: this.overlapPolygons,
      portals: this.portals,
      npcs: this.npcs,
      activeCollisionPolyIndex: this.activeCollisionPolyIndex,
      activeOverlapPolyIndex: this.activeOverlapPolyIndex,
    });
  }

  pushHistorySnapshot() {
    const snap = this.captureCurrentSnapshot();
    if (this.undoStack.length > 0 && this.undoStack[this.undoStack.length - 1] === snap) {
      return;
    }
    this.undoStack.push(snap);
    if (this.undoStack.length > 60) {
      this.undoStack.shift();
    }
    this.redoStack = [];
    this.updateUndoRedoButtons();
  }

  applySnapshotString(snapStr) {
    const parsed = JSON.parse(snapStr);
    this.spawnX = Number(parsed.spawnX ?? 500);
    this.spawnY = Number(parsed.spawnY ?? 500);
    document.getElementById('mapSpawnX').value = String(this.spawnX);
    document.getElementById('mapSpawnY').value = String(this.spawnY);
    this.collisionPolygons = parsed.collisionPolygons || [];
    this.overlapPolygons = parsed.overlapPolygons || [];
    this.portals = parsed.portals || [];
    this.npcs = parsed.npcs || [];
    this.activeCollisionPolyIndex = parsed.activeCollisionPolyIndex ?? this.collisionPolygons.length - 1;
    this.activeOverlapPolyIndex = parsed.activeOverlapPolyIndex ?? this.overlapPolygons.length - 1;

    this.renderLayerLists();
    this.drawCanvas();
    this.updateUndoRedoButtons();
  }

  undo() {
    if (this.undoStack.length === 0) return;
    const currentSnap = this.captureCurrentSnapshot();
    this.redoStack.push(currentSnap);
    const prevSnap = this.undoStack.pop();
    this.applySnapshotString(prevSnap);
  }

  redo() {
    if (this.redoStack.length === 0) return;
    const currentSnap = this.captureCurrentSnapshot();
    this.undoStack.push(currentSnap);
    const nextSnap = this.redoStack.pop();
    this.applySnapshotString(nextSnap);
  }

  clearHistory() {
    this.undoStack = [];
    this.redoStack = [];
    this.updateUndoRedoButtons();
  }

  updateUndoRedoButtons() {
    const btnUndo = document.getElementById('btnUndo');
    const btnRedo = document.getElementById('btnRedo');
    if (btnUndo) {
      btnUndo.style.opacity = this.undoStack.length > 0 ? '1' : '0.45';
      btnUndo.textContent = `↩️ Desfazer (${this.undoStack.length})`;
    }
    if (btnRedo) {
      btnRedo.style.opacity = this.redoStack.length > 0 ? '1' : '0.45';
    }
  }

  // ==========================================================================
  // ABA 1: FICHA DE MAPAS, SPAWN, PORTAIS EM DUPLAS & POLÍGONOS TRAVÁVEIS
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
      npcSelect.innerHTML = `<option value="">Nenhum NPC (Clique em + Criar NPC)</option>`;
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
    badge.innerHTML = `${dom} &bull; ${spawn} &bull; ${pvpMap[mt.pvpRule] || mt.pvpRule}`;
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
      container.innerHTML = `<div style="font-size:0.8rem; color:var(--text-muted);">Nenhum mapa salvo no banco ainda. Clique em "➕ Novo do mcrework" para iniciar.</div>`;
      return;
    }
    container.innerHTML = this.savedMaps
      .map((m) => {
        const colCount = Array.isArray(m.collisionMeshJson) ? m.collisionMeshJson.length : 0;
        const ovlCount = Array.isArray(m.overlapMeshJson) ? m.overlapMeshJson.length : 0;
        const prtCount = Array.isArray(m.outgoingPortals) ? m.outgoingPortals.length : 0;
        const npcCount = Array.isArray(m.npcs) ? m.npcs.length : 0;
        const statusBadge = m.isActive
          ? `<span style="color:#86efac; font-size:0.7rem;">✅ Pronto</span>`
          : `<span style="color:#fde68a; font-size:0.7rem;">📝 Em Edição</span>`;

        return `
      <div class="item-row ${m.id === this.currentMapId ? 'selected' : ''}" onclick="AdminApp.selectSavedMap(${m.id})" style="cursor:pointer; flex-direction:column; align-items:stretch;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong>${m.namePtBr} <span style="color:var(--accent); font-size:0.74rem;">(Nv.${m.requiredLevel})</span></strong>
          ${statusBadge}
        </div>
        <div style="font-size:0.7rem; color:var(--text-muted);">
          ${m.code} &bull; 🛑${colCount} &bull; 🟦${ovlCount} &bull; 🌀${prtCount} &bull; 🧙${npcCount}
        </div>
      </div>`;
      })
      .join('');
  }

  newBlankMapState(mcreworkItem) {
    this.currentMapId = null;
    const nextOrder = this.savedMaps.length + 1;
    const suggestedLevel = nextOrder === 1 ? 1 : (nextOrder - 1) * 10;

    const titleBadge = document.getElementById('mapFormTitleBadge');
    if (titleBadge) {
      titleBadge.innerHTML = `<span style="color:#fde047;">🆕 CRIANDO NOVO MAPA (Será salvo como um novo registro)</span>`;
    }

    document.getElementById('mapCode').value = mcreworkItem ? mcreworkItem.folderCode : `map_${nextOrder}`;
    document.getElementById('mapNamePtBr').value = mcreworkItem ? `Mapa ${mcreworkItem.mcreworkId}` : '';
    document.getElementById('mapReqLevel').value = suggestedLevel;
    document.getElementById('mapImagePath').value = mcreworkItem ? mcreworkItem.bgImageUrl : '';
    document.getElementById('mapOverlapOpacity').value = '0.45';
    document.getElementById('mapDominatedBy').value = '';
    document.getElementById('mapIsActiveSelect').value = 'false'; // Inicia como "Em Edição / Rascunho" por padrão

    this.spawnX = mcreworkItem ? Math.round((mcreworkItem.width || 1600) / 2) : 500;
    this.spawnY = mcreworkItem ? Math.round((mcreworkItem.height || 1200) / 2) : 500;
    document.getElementById('mapSpawnX').value = String(this.spawnX);
    document.getElementById('mapSpawnY').value = String(this.spawnY);

    this.collisionPolygons = [];
    this.overlapPolygons = [];
    this.portals = [];
    this.npcs = [];
    this.activeCollisionPolyIndex = -1;
    this.activeOverlapPolyIndex = -1;
    this.cameraInitializedForUrl = '';
    this.clearHistory();

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

    const prevMapId = this.currentMapId;
    this.currentMapId = m.id;

    const titleBadge = document.getElementById('mapFormTitleBadge');
    if (titleBadge) {
      titleBadge.innerHTML = `✏️ Editando Mapa #${m.id}: <span style="color:#86efac;">${m.namePtBr}</span>`;
    }

    document.getElementById('mapCode').value = m.code;
    document.getElementById('mapNamePtBr').value = m.namePtBr;
    document.getElementById('mapReqLevel').value = m.requiredLevel;
    document.getElementById('mapImagePath').value = m.mcreworkMapImage;
    document.getElementById('mapTypeSelect').value = String(m.mapTypeId);
    document.getElementById('primaryBiomeSelect').value = String(m.primaryBiomeId);
    document.getElementById('secondaryBiomeSelect').value = String(m.secondaryBiomeId);
    document.getElementById('mapOverlapOpacity').value = String(m.overlapOpacity ?? 0.45);
    document.getElementById('mapDominatedBy').value = m.dominatedById || '';
    document.getElementById('mapIsActiveSelect').value = m.isActive ? 'true' : 'false';

    this.spawnX = Number(m.spawnX ?? 500);
    this.spawnY = Number(m.spawnY ?? 500);
    document.getElementById('mapSpawnX').value = String(this.spawnX);
    document.getElementById('mapSpawnY').value = String(this.spawnY);

    this.updateMapTypeRuleBadge();
    this.updateBiomeDesc();

    this.collisionPolygons = Array.isArray(m.collisionMeshJson) ? JSON.parse(JSON.stringify(m.collisionMeshJson)) : [];
    this.overlapPolygons = Array.isArray(m.overlapMeshJson) ? JSON.parse(JSON.stringify(m.overlapMeshJson)) : [];
    this.portals = Array.isArray(m.outgoingPortals) ? JSON.parse(JSON.stringify(m.outgoingPortals)) : [];
    this.npcs = Array.isArray(m.npcs) ? JSON.parse(JSON.stringify(m.npcs)) : [];

    this.activeCollisionPolyIndex = this.collisionPolygons.length - 1;
    this.activeOverlapPolyIndex = this.overlapPolygons.length - 1;

    if (prevMapId !== m.id) {
      this.cameraInitializedForUrl = '';
      this.clearHistory();
      this.loadMapBackgroundImage(m.mcreworkMapImage);
    }
    this.renderLayerLists();
    this.renderSavedMapsList();
  }

  onSpawnInputChanged() {
    this.pushHistorySnapshot();
    this.spawnX = Number(document.getElementById('mapSpawnX').value) || 0;
    this.spawnY = Number(document.getElementById('mapSpawnY').value) || 0;
    this.drawCanvas();
    this.renderLayerLists();
  }

  loadMapBackgroundImage(url) {
    if (!url) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      this.bgImage = img;
      const isEditorOpen = document.getElementById('visualMapEditorScreen').style.display === 'flex';
      if (isEditorOpen && this.cameraInitializedForUrl !== url) {
        this.cameraInitializedForUrl = url;
        this.resetCamera();
      } else {
        this.drawCanvas();
      }
    };
    img.src = url;
  }

  resetCamera() {
    const canvas = document.getElementById('mapCanvas');
    if (this.bgImage && canvas.width > 0 && canvas.height > 0) {
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
      SPAWN: 'toolSpawn',
      COLLISION: 'toolCollision',
      OVERLAP: 'toolOverlap',
      PORTAL: 'toolPortal',
      NPC: 'toolNpc',
      EDIT: 'toolEdit',
    };
    for (const [k, btnId] of Object.entries(mapIds)) {
      const el = document.getElementById(btnId);
      if (el) el.className = k === toolName ? 'active-tool' : '';
    }

    // Exibe barra rápida de seleção de NPC quando a ferramenta NPC está ativa
    const npcQuickBar = document.getElementById('npcQuickBar');
    if (npcQuickBar) {
      npcQuickBar.style.display = toolName === 'NPC' ? 'flex' : 'none';
    }

    if (toolName === 'COLLISION' && this.collisionPolygons.length === 0) {
      this.startNewPolygon('COLLISION');
    } else if (toolName === 'OVERLAP' && this.overlapPolygons.length === 0) {
      this.startNewPolygon('OVERLAP');
    }

    const hint = document.getElementById('canvasHint');
    const crossBtn = document.getElementById('btnPlaceAtCrosshair');
    if (toolName === 'EDIT') {
      hint.innerHTML =
        '✏️ <strong>Modo Edição Ativo:</strong> Arraste qualquer vértice amarelo, Portal, NPC ou Spawn para ajustar a posição.';
      if (crossBtn) crossBtn.textContent = '🔒 Concluir Edição (Travar Malhas)';
    } else {
      hint.innerHTML =
        '🔒 <strong>Malhas Existentes Travadas:</strong> Tocar na tela apenas adiciona novos itens da ferramenta ativa, sem risco de esbarrar nos vértices já criados!';
      if (crossBtn) crossBtn.textContent = '📍 Marcar no Alvo Central (+)';
    }

    this.renderLayerLists();
    this.drawCanvas();
  }

  enterPolygonEditMode(type, idx) {
    this.editableLayerType = type;
    if (type === 'COLLISION') {
      this.activeCollisionPolyIndex = idx;
    } else {
      this.activeOverlapPolyIndex = idx;
    }
    this.setTool('EDIT');
  }

  startNewPolygon(type) {
    this.pushHistorySnapshot();
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

  placeAtCenterCrosshair() {
    if (this.tool === 'EDIT') {
      this.setTool('PAN');
      return;
    }

    const canvas = document.getElementById('mapCanvas');
    const worldX = Math.round((canvas.width / 2 - this.camX) / this.zoom);
    const worldY = Math.round((canvas.height / 2 - this.camY) / this.zoom);

    if (this.tool === 'PAN') {
      alert(
        'Selecione primeiro uma ferramenta na barra superior (⭐ Spawn, 🛑 +Colisão, 🟦 +Sobrep., 🌀 +Portal ou 🧙 +NPC) para marcar no Alvo Central!'
      );
      return;
    }
    this.applyToolPlacementAtWorldPoint(worldX, worldY);
  }

  applyToolPlacementAtWorldPoint(x, y) {
    if (this.tool === 'PAN' || this.tool === 'EDIT') return;

    this.pushHistorySnapshot();

    if (this.tool === 'SPAWN') {
      this.spawnX = x;
      this.spawnY = y;
      document.getElementById('mapSpawnX').value = String(x);
      document.getElementById('mapSpawnY').value = String(y);
    } else if (this.tool === 'COLLISION') {
      if (this.activeCollisionPolyIndex < 0 || !this.collisionPolygons[this.activeCollisionPolyIndex]) {
        const idx = this.collisionPolygons.length + 1;
        this.collisionPolygons.push({
          id: `col_${Date.now()}_${idx}`,
          name: `Colisão #${idx}`,
          points: [],
        });
        this.activeCollisionPolyIndex = this.collisionPolygons.length - 1;
      }
      this.collisionPolygons[this.activeCollisionPolyIndex].points.push({ x, y });
    } else if (this.tool === 'OVERLAP') {
      if (this.activeOverlapPolyIndex < 0 || !this.overlapPolygons[this.activeOverlapPolyIndex]) {
        const idx = this.overlapPolygons.length + 1;
        this.overlapPolygons.push({
          id: `ovl_${Date.now()}_${idx}`,
          name: `Sobreposição #${idx}`,
          points: [],
        });
        this.activeOverlapPolyIndex = this.overlapPolygons.length - 1;
      }
      this.overlapPolygons[this.activeOverlapPolyIndex].points.push({ x, y });
    } else if (this.tool === 'PORTAL') {
      const nextNum = this.portals.length + 1;
      this.portals.push({
        id: null,
        label: `Portal #${nextNum}`,
        sourceX: x,
        sourceY: y,
        triggerRadius: 48,
        linkedPortalId: null,
        targetMapId: null,
        targetX: 500,
        targetY: 500,
      });
      // Abre a gaveta de camadas para que o usuário possa nomear ou vincular o Portal Par se desejar
      this.toggleLayersDrawer(true);
    } else if (this.tool === 'NPC') {
      const npcTemplateId = Number(document.getElementById('activeNpcTemplateSelect').value);
      if (!npcTemplateId) {
        alert('Cadastre ou selecione primeiro um Template de NPC usando o botão "➕ Criar NPC".');
        this.openNpcTemplateModal();
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
  // INTERAÇÃO DO CANVAS (MALHAS TRAVADAS POR PADRÃO + MODO EDIT + PINÇA 2 DEDOS)
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

    const findHitObjectInEditMode = (worldX, worldY, isTouch = false) => {
      const hitRadius = Math.max(14, (isTouch ? 26 : 14) / this.zoom);

      const checkPolyList = (listName, polys, activeIdx) => {
        for (let pIdx = 0; pIdx < polys.length; pIdx++) {
          if (activeIdx >= 0 && pIdx !== activeIdx && this.editableLayerType === listName) continue;
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
        checkPolyList('COLLISION', this.collisionPolygons, this.activeCollisionPolyIndex) ||
        checkPolyList('OVERLAP', this.overlapPolygons, this.activeOverlapPolyIndex);
      if (polyHit) return polyHit;

      if (Math.hypot(this.spawnX - worldX, this.spawnY - worldY) <= Math.max(hitRadius, 36)) {
        return { list: 'SPAWN', polyIdx: 0, ptIdx: 0 };
      }

      for (let i = 0; i < this.portals.length; i++) {
        if (Math.hypot(this.portals[i].sourceX - worldX, this.portals[i].sourceY - worldY) <= Math.max(hitRadius, 40)) {
          return { list: 'PORTAL', polyIdx: i, ptIdx: 0 };
        }
      }

      for (let i = 0; i < this.npcs.length; i++) {
        if (Math.hypot(this.npcs[i].posX - worldX, this.npcs[i].posY - worldY) <= Math.max(hitRadius, 30)) {
          return { list: 'NPC', polyIdx: i, ptIdx: 0 };
        }
      }

      return null;
    };

    canvas.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        this.touchMoved = false;

        if (e.touches.length === 2) {
          this.isPanning = false;
          this.draggingVertex = null;
          this.preDragSnapshot = null;
          const t1 = e.touches[0];
          const t2 = e.touches[1];
          this.lastPinchDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
          this.lastPinchMidX = (t1.clientX + t2.clientX) / 2;
          this.lastPinchMidY = (t1.clientY + t2.clientY) / 2;
          return;
        }

        if (e.touches.length === 1) {
          const t = e.touches[0];
          const { x, y } = toWorldCoords(t.clientX, t.clientY);

          if (this.tool === 'EDIT') {
            const hit = findHitObjectInEditMode(x, y, true);
            if (hit) {
              this.preDragSnapshot = this.captureCurrentSnapshot();
              this.dragChanged = false;
              this.draggingVertex = hit;
              if (hit.list === 'COLLISION') this.activeCollisionPolyIndex = hit.polyIdx;
              if (hit.list === 'OVERLAP') this.activeOverlapPolyIndex = hit.polyIdx;
              this.renderLayerLists();
              this.drawCanvas();
              return;
            }
          }

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

        if (e.touches.length === 1) {
          const t = e.touches[0];
          if (Math.hypot(t.clientX - (this.touchStartClientX || 0), t.clientY - (this.touchStartClientY || 0)) > 8) {
            this.touchMoved = true;
          }

          if (this.draggingVertex && this.tool === 'EDIT') {
            const { x, y } = toWorldCoords(t.clientX, t.clientY);
            this.dragChanged = true;
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
        if (
          !this.touchMoved &&
          !this.draggingVertex &&
          e.changedTouches.length === 1 &&
          this.tool !== 'PAN' &&
          this.tool !== 'EDIT'
        ) {
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
            if (this.dragChanged && this.preDragSnapshot) {
              this.undoStack.push(this.preDragSnapshot);
              this.redoStack = [];
              this.updateUndoRedoButtons();
            }
            this.preDragSnapshot = null;
            this.dragChanged = false;
            this.draggingVertex = null;
            this.renderLayerLists();
          }
        }
      },
      { passive: false }
    );

    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (this.tool !== 'EDIT') return;
      const { x, y } = toWorldCoords(e.clientX, e.clientY);
      const hit = findHitObjectInEditMode(x, y, false);
      if (hit && (hit.list === 'COLLISION' || hit.list === 'OVERLAP')) {
        this.pushHistorySnapshot();
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

      if (this.tool === 'EDIT') {
        const hit = findHitObjectInEditMode(x, y, false);
        if (hit) {
          this.preDragSnapshot = this.captureCurrentSnapshot();
          this.dragChanged = false;
          this.draggingVertex = hit;
          if (hit.list === 'COLLISION') this.activeCollisionPolyIndex = hit.polyIdx;
          if (hit.list === 'OVERLAP') this.activeOverlapPolyIndex = hit.polyIdx;
          this.renderLayerLists();
          this.drawCanvas();
          return;
        }
        this.isPanning = true;
        this.panStartX = e.clientX - this.camX;
        this.panStartY = e.clientY - this.camY;
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
      if (this.draggingVertex && this.tool === 'EDIT') {
        const { x, y } = toWorldCoords(e.clientX, e.clientY);
        this.dragChanged = true;
        this.moveDraggedObject(x, y);
      }
    });

    window.addEventListener('mouseup', () => {
      this.isPanning = false;
      if (this.draggingVertex) {
        if (this.dragChanged && this.preDragSnapshot) {
          this.undoStack.push(this.preDragSnapshot);
          this.redoStack = [];
          this.updateUndoRedoButtons();
        }
        this.preDragSnapshot = null;
        this.dragChanged = false;
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
    } else if (list === 'SPAWN') {
      this.spawnX = x;
      this.spawnY = y;
      document.getElementById('mapSpawnX').value = String(x);
      document.getElementById('mapSpawnY').value = String(y);
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
    canvas.width = viewport.clientWidth || window.innerWidth;
    canvas.height = viewport.clientHeight || window.innerHeight - 48;
    this.drawCanvas();
  }

  drawCanvas() {
    const canvas = document.getElementById('mapCanvas');
    if (!canvas || canvas.width === 0) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(this.camX, this.camY);
    ctx.scale(this.zoom, this.zoom);

    if (this.bgImage) {
      ctx.drawImage(this.bgImage, 0, 0);
    } else {
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, 1600, 1200);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '28px sans-serif';
      ctx.fillText('Selecione uma imagem de mapa na ficha anterior', 220, 560);
    }

    const drawPolygonLayer = (layerType, polygons, activeIdx, fillRgb, strokeHex) => {
      polygons.forEach((poly, idx) => {
        const pts = poly.points || [];
        if (pts.length === 0) return;

        const isActiveForAdding = this.tool === layerType && idx === activeIdx;
        const isUnlockedForEdit =
          this.tool === 'EDIT' &&
          (this.editableLayerType === 'ALL' || (this.editableLayerType === layerType && idx === activeIdx));

        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
        if (pts.length >= 3) {
          ctx.closePath();
          ctx.fillStyle =
            isActiveForAdding || isUnlockedForEdit ? `rgba(${fillRgb}, 0.45)` : `rgba(${fillRgb}, 0.25)`;
          ctx.fill();
        }

        ctx.lineWidth = (isActiveForAdding || isUnlockedForEdit ? 3 : 2) / this.zoom;
        ctx.strokeStyle = isUnlockedForEdit ? '#fde047' : isActiveForAdding ? '#ffffff' : strokeHex;
        ctx.stroke();

        if (isActiveForAdding || isUnlockedForEdit) {
          const r = Math.max(6, (isUnlockedForEdit ? 9 : 6) / this.zoom);
          pts.forEach((pt, vIdx) => {
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
            ctx.fillStyle = isUnlockedForEdit ? '#fde047' : vIdx === pts.length - 1 ? '#fde047' : '#ffffff';
            ctx.fill();
            ctx.lineWidth = 1.8 / this.zoom;
            ctx.strokeStyle = '#020617';
            ctx.stroke();
          });
        }
      });
    };

    drawPolygonLayer(
      'COLLISION',
      this.collisionPolygons,
      this.activeCollisionPolyIndex,
      '239, 68, 68',
      '#ef4444'
    );

    drawPolygonLayer(
      'OVERLAP',
      this.overlapPolygons,
      this.activeOverlapPolyIndex,
      '56, 189, 248',
      '#38bdf8'
    );

    // Ponto de Spawn do Mapa (⭐ SPAWN)
    ctx.beginPath();
    ctx.arc(this.spawnX, this.spawnY, 36, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(245, 158, 11, 0.35)';
    ctx.fill();
    ctx.lineWidth = 3 / this.zoom;
    ctx.strokeStyle = '#fbbf24';
    ctx.stroke();

    ctx.fillStyle = '#fef08a';
    ctx.font = `bold ${Math.max(13, Math.round(15 / this.zoom))}px sans-serif`;
    ctx.fillText(`⭐ SPAWN (${this.spawnX}, ${this.spawnY})`, this.spawnX - 55, this.spawnY - 42);

    // Portais (em Duplas Interligadas)
    this.portals.forEach((p, idx) => {
      const radius = Number(p.triggerRadius) || 48;
      const isLinked = Boolean(p.linkedPortalId);
      ctx.beginPath();
      ctx.arc(p.sourceX, p.sourceY, radius, 0, Math.PI * 2);
      ctx.fillStyle = isLinked ? 'rgba(168, 85, 247, 0.42)' : 'rgba(148, 163, 184, 0.32)';
      ctx.fill();
      ctx.lineWidth = 2.8 / this.zoom;
      ctx.strokeStyle = isLinked ? '#c084fc' : '#f87171';
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.max(12, Math.round(14 / this.zoom))}px sans-serif`;
      const title = p.label || `Portal #${idx + 1}`;
      ctx.fillText(`🌀 ${title} ${isLinked ? '🔗' : '(Sem par)'}`, p.sourceX - radius, p.sourceY - radius - 6);
    });

    // NPCs
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

    // Alvo de Precisão Central (+) fixo no centro do visor
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
    ctx.fillRect(cx + 10, cy - 26, 115, 20);
    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(`X:${worldCenterX} Y:${worldCenterY}`, cx + 15, cy - 12);
    ctx.restore();
  }

  buildPairedPortalOptionsHtml(currentPortal) {
    const selectedPartnerId = Number(currentPortal.linkedPortalId) || 0;
    const options = [`<option value="">⏳ Sem vínculo ainda (Vincular depois que criar o outro mapa)</option>`];

    for (const m of this.savedMaps) {
      if (this.currentMapId && m.id === this.currentMapId) continue;
      const mapPortals = m.outgoingPortals || [];
      for (const remoteP of mapPortals) {
        const isSel = remoteP.id === selectedPartnerId ? 'selected' : '';
        const pLabel = remoteP.label || `Portal #${remoteP.id}`;
        options.push(
          `<option value="${remoteP.id}" ${isSel}>🔗 ${m.namePtBr} ➔ ${pLabel} (Pos: ${remoteP.sourceX}, ${remoteP.sourceY})</option>`
        );
      }
    }
    return options.join('');
  }

  renderLayerLists() {
    const cLen = this.collisionPolygons.length;
    const oLen = this.overlapPolygons.length;
    const pLen = this.portals.length;
    const nLen = this.npcs.length;

    document.getElementById('countCollision').textContent = String(cLen);
    document.getElementById('countOverlap').textContent = String(oLen);
    document.getElementById('countPortals').textContent = String(pLen);
    document.getElementById('countNpcs').textContent = String(nLen);
    document.getElementById('drawerTotalBadge').textContent = String(cLen + oLen + pLen + nLen);

    // Resumo na Ficha Técnica (fora do editor de tela cheia)
    const summaryBox = document.getElementById('mapSummaryCounters');
    if (summaryBox) {
      summaryBox.innerHTML = `
        <span>⭐ <strong>Spawn:</strong> (${this.spawnX}, ${this.spawnY})</span> &bull;
        <span>🛑 <strong>Colisões:</strong> ${cLen} malha(s)</span> &bull;
        <span>🟦 <strong>Sobreposições:</strong> ${oLen} malha(s)</span> &bull;
        <span>🌀 <strong>Portais:</strong> ${pLen}</span> &bull;
        <span>🧙 <strong>NPCs:</strong> ${nLen}</span>
      `;
    }

    document.getElementById('collisionList').innerHTML = this.collisionPolygons
      .map((p, idx) => {
        const isEditingThis =
          this.tool === 'EDIT' && this.editableLayerType === 'COLLISION' && idx === this.activeCollisionPolyIndex;
        const isAddingThis = this.tool === 'COLLISION' && idx === this.activeCollisionPolyIndex;
        return `
      <div class="item-row ${isEditingThis || isAddingThis ? 'selected' : ''}">
        <div onclick="AdminApp.selectPolygon('COLLISION', ${idx})" style="cursor:pointer; flex:1;">
          <strong>${isEditingThis ? '🔓' : '🔒'} ${p.name}</strong>
          <span style="color:var(--text-muted); font-size:0.72rem;">(${p.points.length} pts)</span>
        </div>
        <button onclick="AdminApp.enterPolygonEditMode('COLLISION', ${idx})" style="padding:3px 7px; font-size:0.72rem;">
          ${isEditingThis ? '✏️ Editando' : '✏️ Editar'}
        </button>
        <button class="btn-danger" style="padding:3px 7px;" onclick="AdminApp.removePolygon('COLLISION', ${idx})">✕</button>
      </div>`;
      })
      .join('');

    document.getElementById('overlapList').innerHTML = this.overlapPolygons
      .map((p, idx) => {
        const isEditingThis =
          this.tool === 'EDIT' && this.editableLayerType === 'OVERLAP' && idx === this.activeOverlapPolyIndex;
        const isAddingThis = this.tool === 'OVERLAP' && idx === this.activeOverlapPolyIndex;
        return `
      <div class="item-row ${isEditingThis || isAddingThis ? 'selected' : ''}">
        <div onclick="AdminApp.selectPolygon('OVERLAP', ${idx})" style="cursor:pointer; flex:1;">
          <strong>${isEditingThis ? '🔓' : '🔒'} ${p.name}</strong>
          <span style="color:var(--text-muted); font-size:0.72rem;">(${p.points.length} pts)</span>
        </div>
        <button onclick="AdminApp.enterPolygonEditMode('OVERLAP', ${idx})" style="padding:3px 7px; font-size:0.72rem;">
          ${isEditingThis ? '✏️ Editando' : '✏️ Editar'}
        </button>
        <button class="btn-danger" style="padding:3px 7px;" onclick="AdminApp.removePolygon('OVERLAP', ${idx})">✕</button>
      </div>`;
      })
      .join('');

    document.getElementById('portalsList').innerHTML = this.portals
      .map((p, idx) => {
        const isLinked = Boolean(p.linkedPortalId);
        return `
      <div class="item-row" style="flex-direction:column; align-items:stretch; gap:6px;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:6px;">
          <input type="text" value="${p.label || `Portal #${idx + 1}`}" onchange="AdminApp.updatePortalLabel(${idx}, this.value)" style="font-weight:700; padding:4px 6px; flex:1;" />
          <span style="font-size:0.72rem; color:var(--text-muted);">(${p.sourceX}, ${p.sourceY})</span>
          <button class="btn-danger" style="padding:2px 6px;" onclick="AdminApp.removePortal(${idx})">✕</button>
        </div>
        <div class="field">
          <label>🔗 Portal Par Interligado (Entrada &harr; Saída):</label>
          <select onchange="AdminApp.onSelectPairedPortal(${idx}, this.value)">
            ${this.buildPairedPortalOptionsHtml(p)}
          </select>
        </div>
        <div style="font-size:0.7rem; padding:4px 6px; border-radius:4px; background:${
          isLinked ? 'rgba(34,197,94,0.14)' : 'rgba(245,158,11,0.12)'
        }; color:${isLinked ? '#86efac' : '#fde68a'};">
          ${
            isLinked
              ? `🟢 <strong>Dupla Interligada:</strong> Entrar neste portal faz sair no portal par em (${p.targetX}, ${p.targetY}) e vice-versa!`
              : `⏳ <strong>Aguardando Par:</strong> Salve este mapa e depois vincule lá no mapa de destino.`
          }
        </div>
      </div>`;
      })
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
    this.pushHistorySnapshot();
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

  updatePortalLabel(idx, value) {
    if (!this.portals[idx]) return;
    this.pushHistorySnapshot();
    this.portals[idx].label = value.trim() || `Portal #${idx + 1}`;
    this.drawCanvas();
  }

  onSelectPairedPortal(idx, partnerPortalIdStr) {
    const portal = this.portals[idx];
    if (!portal) return;
    this.pushHistorySnapshot();

    const partnerId = Number(partnerPortalIdStr) || null;
    if (!partnerId) {
      portal.linkedPortalId = null;
      portal.targetMapId = null;
      this.renderLayerLists();
      this.drawCanvas();
      return;
    }

    for (const m of this.savedMaps) {
      const found = (m.outgoingPortals || []).find((rp) => rp.id === partnerId);
      if (found) {
        portal.linkedPortalId = found.id;
        portal.targetMapId = m.id;
        portal.targetX = found.sourceX;
        portal.targetY = found.sourceY;
        break;
      }
    }

    this.renderLayerLists();
    this.drawCanvas();
  }

  removePortal(idx) {
    this.pushHistorySnapshot();
    this.portals.splice(idx, 1);
    this.renderLayerLists();
    this.drawCanvas();
  }

  removeMapNpc(idx) {
    this.pushHistorySnapshot();
    this.npcs.splice(idx, 1);
    this.renderLayerLists();
    this.drawCanvas();
  }

  async saveCurrentMap(stayInVisualEditor = false) {
    try {
      const dto = {
        code: document.getElementById('mapCode').value.trim(),
        namePtBr: document.getElementById('mapNamePtBr').value.trim() || 'Mapa em Edição',
        mcreworkMapImage: document.getElementById('mapImagePath').value.trim(),
        requiredLevel: Number(document.getElementById('mapReqLevel').value) || 1,
        mapTypeId: Number(document.getElementById('mapTypeSelect').value),
        primaryBiomeId: Number(document.getElementById('primaryBiomeSelect').value),
        secondaryBiomeId: Number(document.getElementById('secondaryBiomeSelect').value),
        spawnX: Number(document.getElementById('mapSpawnX').value) || 500,
        spawnY: Number(document.getElementById('mapSpawnY').value) || 500,
        overlapOpacity: Number(document.getElementById('mapOverlapOpacity').value) || 0.45,
        dominatedById: document.getElementById('mapDominatedBy').value.trim() || null,
        isActive: document.getElementById('mapIsActiveSelect').value === 'true',
        collisionMeshJson: this.collisionPolygons,
        overlapMeshJson: this.overlapPolygons,
        portals: this.portals,
        npcs: this.npcs,
      };

      // Preserva câmera atual se estiver salvando dentro do editor visual
      const savedCamX = this.camX;
      const savedCamY = this.camY;
      const savedZoom = this.zoom;

      const path = this.currentMapId ? `/api/admin/maps/${this.currentMapId}` : '/api/admin/maps';
      const method = this.currentMapId ? 'PUT' : 'POST';
      const res = await this.api(path, {
        method,
        body: JSON.stringify(dto),
      });

      this.currentMapId = res.id;
      await this.loadBootstrapData();
      this.selectSavedMap(res.id);

      if (stayInVisualEditor) {
        this.camX = savedCamX;
        this.camY = savedCamY;
        this.zoom = savedZoom;
        this.drawCanvas();
      }

      const timeStr = new Date().toLocaleTimeString('pt-BR');
      const badge = document.getElementById('lastSavedBadge');
      if (badge) badge.textContent = `✅ Salvo no banco às ${timeStr}`;
      alert(`✅ Progresso do mapa salvo no PostgreSQL + Snapshot JSON (${timeStr})!\nVocê pode continuar agora ou retomar depois de onde parou.`);
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

  async openMcreworkMapPicker(mode = 'NEW_MAP') {
    this.mapPickerMode = mode;
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

    if (this.mapPickerMode === 'NEW_MAP' || !this.currentMapId) {
      this.newBlankMapState(item);
    } else {
      document.getElementById('mapImagePath').value = item.bgImageUrl;
      this.cameraInitializedForUrl = '';
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
      const data = await this.api('/api/admin/maps/bootstrap');
      this.npcTemplates = data.npcTemplates || [];
      this.renderSelectOptions();
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
