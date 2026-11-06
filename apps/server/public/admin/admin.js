/**
 * @file apps/server/public/admin/admin.js
 * @module @etheria/server
 * @description Orquestrador Principal Frontend da Rota `/admin` (Studio Low-Code).
 *   Gerencia a Ficha Técnica de Mapas, sincronização com PostgreSQL e Snapshots JSON,
 *   e orquestra os submódulos especializados (Auth, Usuários, NPCs, Classes e Canvas Editor).
 */

class EtheriaAdminStudio {
  constructor() {
    this.token = localStorage.getItem('etheria_admin_token') || '';
    this.session = null;
    this.isStrictLocalhost = false;

    this.biomes = [];
    this.mapTypes = [];
    this.races = [];
    this.elements = [];
    this.classTemplates = [];
    this.npcTemplates = [];
    this.savedMaps = [];
    this.mcreworkMaps = [];
    this.mcreworkNpcs = [];
    this.mcreworkChars = [];
    this.mapPickerMode = 'NEW_MAP'; // 'NEW_MAP' | 'CHANGE_IMAGE'
    this.classGenderFilter = 'ALL';
    this.classSearchQuery = '';
    this.selectedMcreworkCharKey = '';
    this.npcSearchQuery = '';

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

    // Vincula submódulos especializados orientados a objetos
    if (window.AdminAuth) window.AdminAuth.attach(this);
    if (window.AdminUsersTab) window.AdminUsersTab.attach(this);
    if (window.AdminNpcsTab) window.AdminNpcsTab.attach(this);
    if (window.AdminClassesTab) window.AdminClassesTab.attach(this);
    if (window.AdminCanvasEditor) window.AdminCanvasEditor.attach(this);

    this.init();
  }

  async init() {
    if (typeof this.setupCanvasEvents === 'function') {
      this.setupCanvasEvents();
    }
    if (typeof this.checkAuthContext === 'function') {
      await this.checkAuthContext();
    }
  }

  closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  }

  // ==========================================================================
  // ABA 1: FICHA TÉCNICA DE MAPAS, BIOMAS, SPAWN & REGRAS TERRITORIAIS
  // ==========================================================================

  async loadBootstrapData() {
    const data = await this.api('/api/admin/maps/bootstrap');
    this.biomes = data.biomes || [];
    this.mapTypes = data.mapTypes || [];
    this.races = data.races || [];
    this.elements = data.elements || [];
    this.classTemplates = data.classTemplates || [];
    this.npcTemplates = data.npcTemplates || [];
    this.savedMaps = data.maps || [];

    this.renderSelectOptions();
    this.renderSavedMapsList();
    if (typeof this.renderNpcsCrudTable === 'function') this.renderNpcsCrudTable();
    if (typeof this.renderClassesCrudTable === 'function') this.renderClassesCrudTable();

    if (this.savedMaps.length > 0 && !this.currentMapId) {
      this.selectSavedMap(this.savedMaps[0].id);
    } else if (this.savedMaps.length === 0) {
      this.newBlankMapState();
    }
  }

  renderSelectOptions() {
    const mtSelect = document.getElementById('mapTypeSelect');
    if (mtSelect) {
      mtSelect.innerHTML = this.mapTypes
        .map((mt) => `<option value="${mt.id}">${mt.namePtBr} (${mt.code})</option>`)
        .join('');
      this.updateMapTypeRuleBadge();
    }

    const biomeOptions = this.biomes
      .map((b, idx) => `<option value="${b.id}">#${idx + 1} - ${b.namePtBr} [${b.category}]</option>`)
      .join('');
    const pb = document.getElementById('primaryBiomeSelect');
    const sb = document.getElementById('secondaryBiomeSelect');
    if (pb) pb.innerHTML = biomeOptions;
    if (sb) {
      sb.innerHTML = biomeOptions;
      if (this.biomes.length > 1) {
        sb.value = String(this.biomes[1].id);
      }
    }
    this.updateBiomeDesc();

    const npcSelect = document.getElementById('activeNpcTemplateSelect');
    if (npcSelect) {
      if (this.npcTemplates.length === 0) {
        npcSelect.innerHTML = `<option value="">Nenhum NPC (Clique em + Criar NPC)</option>`;
      } else {
        npcSelect.innerHTML = this.npcTemplates
          .map((n) => `<option value="${n.id}">#${n.id} &bull; ${n.namePtBr} (${n.code} / ${n.mcreworkNpcKey})</option>`)
          .join('');
      }
    }

    const raceSelect = document.getElementById('classRaceSelect');
    if (raceSelect && this.races.length > 0) {
      raceSelect.innerHTML = this.races
        .map((r) => `<option value="${r.code}" ${r.code === 'HUMAN' ? 'selected' : ''}>${r.namePtBr} (${r.code})</option>`)
        .join('');
    }
  }

  updateMapTypeRuleBadge() {
    const select = document.getElementById('mapTypeSelect');
    if (!select) return;
    const id = Number(select.value);
    const mt = this.mapTypes.find((x) => x.id === id);
    const badge = document.getElementById('mapTypeRulesBadge');
    if (!mt || !badge) return;

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
    const pb = document.getElementById('primaryBiomeSelect');
    const sb = document.getElementById('secondaryBiomeSelect');
    const box = document.getElementById('biomeDescBox');
    if (!pb || !sb || !box) return;

    const b1Id = Number(pb.value);
    const b2Id = Number(sb.value);
    const b1 = this.biomes.find((x) => x.id === b1Id);
    const b2 = this.biomes.find((x) => x.id === b2Id);
    box.innerHTML =
      (b1 ? `<strong>1. ${b1.namePtBr}:</strong> ${b1.descriptionPtBr}<br>` : '') +
      (b2 ? `<strong>2. ${b2.namePtBr}:</strong> ${b2.descriptionPtBr}` : '');
  }

  renderSavedMapsList() {
    const container = document.getElementById('savedMapsList');
    if (!container) return;
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
          <strong>#${m.id} &bull; ${m.namePtBr} <span style="color:var(--accent); font-size:0.74rem;">(Nv.${m.requiredLevel})</span></strong>
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
    const maxId = this.savedMaps.reduce((acc, m) => Math.max(acc, Number(m.id) || 0), 0);
    const nextId = maxId + 1;
    const suggestedLevel = nextId === 1 ? 1 : (nextId - 1) * 10;

    const titleBadge = document.getElementById('mapFormTitleBadge');
    if (titleBadge) {
      titleBadge.innerHTML = `<span style="color:#fde047;">🆕 CRIANDO NOVO MAPA #${nextId} (map_${nextId})</span>`;
    }

    document.getElementById('mapCode').value = `#${nextId} • map_${nextId} (Automático)`;
    document.getElementById('mapNamePtBr').value = '';
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
    if (typeof this.clearHistory === 'function') this.clearHistory();

    if (mcreworkItem?.bgImageUrl) {
      this.loadMapBackgroundImage(mcreworkItem.bgImageUrl);
    } else {
      this.bgImage = null;
      if (typeof this.drawCanvas === 'function') this.drawCanvas();
    }
    if (typeof this.renderLayerLists === 'function') this.renderLayerLists();
    this.renderSavedMapsList();
  }

  selectSavedMap(mapId) {
    const m = this.savedMaps.find((x) => x.id === mapId);
    if (!m) return;

    const prevMapId = this.currentMapId;
    this.currentMapId = m.id;

    const titleBadge = document.getElementById('mapFormTitleBadge');
    if (titleBadge) {
      titleBadge.innerHTML = `✏️ Editando Mapa #${m.id} (${m.code}): <span style="color:#86efac;">${m.namePtBr}</span>`;
    }

    document.getElementById('mapCode').value = `#${m.id} • ${m.code}`;
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
      if (typeof this.clearHistory === 'function') this.clearHistory();
      this.loadMapBackgroundImage(m.mcreworkMapImage);
    }
    if (typeof this.renderLayerLists === 'function') this.renderLayerLists();
    this.renderSavedMapsList();
  }

  onSpawnInputChanged() {
    if (typeof this.pushHistorySnapshot === 'function') this.pushHistorySnapshot();
    this.spawnX = Number(document.getElementById('mapSpawnX').value) || 0;
    this.spawnY = Number(document.getElementById('mapSpawnY').value) || 0;
    if (typeof this.drawCanvas === 'function') this.drawCanvas();
    if (typeof this.renderLayerLists === 'function') this.renderLayerLists();
  }

  loadMapBackgroundImage(url) {
    if (!url) return;
    const img = new Image();
    // Sem crossOrigin desnecessário para evitar bloqueios de CORS e falhas de cache
    const onLoaded = () => {
      this.bgImage = img;
      const isEditorOpen = document.getElementById('visualMapEditorScreen').style.display === 'flex';
      if (isEditorOpen && this.cameraInitializedForUrl !== url) {
        this.cameraInitializedForUrl = url;
        if (typeof this.resetCamera === 'function') this.resetCamera();
      } else {
        if (typeof this.drawCanvas === 'function') this.drawCanvas();
      }
    };
    img.onload = onLoaded;
    img.onerror = (err) => {
      console.warn('Falha ao carregar imagem base do mapa no editor admin:', url, err);
    };
    img.src = url;
    if (img.complete && img.naturalWidth > 0) {
      onLoaded();
    }
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
        if (typeof this.drawCanvas === 'function') this.drawCanvas();
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
}

window.AdminApp = new EtheriaAdminStudio();
