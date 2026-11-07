/**
 * @file apps/server/public/admin/js/AdminCanvasEditor.js
 * @module @etheria/server
 * @description Estúdio Visual de Tela Inteira (`100vw x 100dvh`), Câmera 2D, Malhas de Colisão/Sobreposição,
 *   Portais Pareados, Posicionamento de Spawn/NPCs, Histórico Real (Undo/Redo) e Gaveta de Camadas.
 */

class AdminCanvasEditor {
  static attach(app) {
    app.npcEditorSpriteCache = new Map();
    app.selectedMapNpcIndex = -1;

    window.onMcreworkSpriteLoaded = () => {
      const editorScreen = document.getElementById('visualMapEditorScreen');
      if (editorScreen && editorScreen.style.display !== 'none') {
        app.drawCanvas();
      }
    };

    app.getOrCreateMapNpcSprite = function (tpl) {
      if (!tpl || !tpl.mcreworkNpcKey || typeof window.McreworkSpriteSheet !== 'function') return null;
      const key = tpl.mcreworkNpcKey;
      if (this.npcEditorSpriteCache.has(key)) {
        return this.npcEditorSpriteCache.get(key);
      }
      const baseUrl = 'https://seytanir.github.io/mcrework';
      const jsonUrl = tpl.atlasJsonUrl || `${baseUrl}/assets/npcs/${key}/atlas.json`;
      const webpUrl = tpl.atlasWebpUrl || `${baseUrl}/assets/npcs/${key}/atlas.webp`;
      const thumbUrl = tpl.thumbUrl || `${baseUrl}/assets/npcs/${key}/thumb.png`;
      const sprite = new window.McreworkSpriteSheet(jsonUrl, webpUrl, thumbUrl);
      sprite.load();
      this.npcEditorSpriteCache.set(key, sprite);
      return sprite;
    };

    app.updateSelectedMapNpcQuickBar = function () {
      const btn = document.getElementById('btnRotateSelectedMapNpc');
      if (!btn) return;
      if (!this.npcs || this.npcs.length === 0) {
        btn.textContent = '🔄 Girar NPC Posicionado';
        btn.style.opacity = '0.55';
        return;
      }
      btn.style.opacity = '1';
      const idx =
        this.selectedMapNpcIndex >= 0 && this.npcs[this.selectedMapNpcIndex]
          ? this.selectedMapNpcIndex
          : this.npcs.length - 1;
      const n = this.npcs[idx];
      const tpl = this.npcTemplates.find((t) => t.id === Number(n.npcTemplateId));
      const name = tpl ? tpl.namePtBr : `NPC #${n.npcTemplateId}`;
      const isFlipped = (Number(n.direction) || 0) > 0;
      btn.textContent = `🔄 Girar #${idx + 1} ${name} (${isFlipped ? '➡️ Virado' : '⬅️ Padrão'})`;
    };

    app.rotateMapNpc = async function (idx) {
      if (!this.npcs[idx]) return;
      this.selectedMapNpcIndex = idx;
      this.pushHistorySnapshot();
      const cur = Number(this.npcs[idx].direction) || 0;
      const nextDir = cur === 0 ? 1 : 0;
      this.npcs[idx].direction = nextDir;

      this.updateSelectedMapNpcQuickBar();
      this.renderLayerLists();
      this.drawCanvas();

      // Se este posicionamento já estiver salvo na tabela map_npcs do banco, persiste o giro imediatamente!
      const placementId = Number(this.npcs[idx].id);
      if (placementId > 0) {
        try {
          await this.api(`/api/admin/map-npcs/${placementId}/rotate`, { method: 'POST' });
          const data = await this.api('/api/admin/maps/bootstrap');
          this.npcTemplates = data.npcTemplates || [];
          this.savedMaps = data.maps || [];
          if (typeof this.renderNpcsCrudTable === 'function') {
            this.renderNpcsCrudTable();
          }
        } catch (err) {
          console.warn('Falha ao sincronizar giro imediato do NPC:', err);
        }
      }
    };

    app.rotateSelectedOrLastMapNpc = function () {
      if (!this.npcs || this.npcs.length === 0) {
        alert('Posicione primeiro um NPC no mapa (tocando no mapa) e depois clique em Girar!');
        return;
      }
      const idx =
        this.selectedMapNpcIndex >= 0 && this.npcs[this.selectedMapNpcIndex]
          ? this.selectedMapNpcIndex
          : this.npcs.length - 1;
      this.rotateMapNpc(idx);
    };

    app.enterVisualMapEditor = function () {
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
    };

    app.exitVisualMapEditor = function () {
      document.getElementById('visualMapEditorScreen').style.display = 'none';
      this.renderLayerLists();
    };

    app.toggleLayersDrawer = function (forceState) {
      const drawer = document.getElementById('layersDrawer');
      if (!drawer) return;
      if (typeof forceState === 'boolean') {
        drawer.classList.toggle('open', forceState);
      } else {
        drawer.classList.toggle('open');
      }
    };

    app.captureCurrentSnapshot = function () {
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
    };

    app.pushHistorySnapshot = function () {
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
    };

    app.applySnapshotString = function (snapStr) {
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
    };

    app.undo = function () {
      if (this.undoStack.length === 0) return;
      const currentSnap = this.captureCurrentSnapshot();
      this.redoStack.push(currentSnap);
      const prevSnap = this.undoStack.pop();
      this.applySnapshotString(prevSnap);
    };

    app.redo = function () {
      if (this.redoStack.length === 0) return;
      const currentSnap = this.captureCurrentSnapshot();
      this.undoStack.push(currentSnap);
      const nextSnap = this.redoStack.pop();
      this.applySnapshotString(nextSnap);
    };

    app.clearHistory = function () {
      this.undoStack = [];
      this.redoStack = [];
      this.updateUndoRedoButtons();
    };

    app.updateUndoRedoButtons = function () {
      const btnUndo = document.getElementById('btnUndo');
      const btnRedo = document.getElementById('btnRedo');
      if (btnUndo) {
        btnUndo.style.opacity = this.undoStack.length > 0 ? '1' : '0.45';
        btnUndo.textContent = `↩️ Desfazer (${this.undoStack.length})`;
      }
      if (btnRedo) {
        btnRedo.style.opacity = this.redoStack.length > 0 ? '1' : '0.45';
      }
    };

    app.resetCamera = function () {
      const canvas = document.getElementById('mapCanvas');
      if (this.bgImage && canvas.width > 0 && canvas.height > 0) {
        const scaleX = (canvas.width * 0.92) / this.bgImage.width;
        const scaleY = (canvas.height * 0.92) / this.bgImage.height;
        this.zoom = Math.max(0.12, Math.min(1.2, Math.min(scaleX, scaleY)));
        this.camX = (canvas.width - this.bgImage.width * this.zoom) / 2;
        this.camY = (canvas.height - this.bgImage.height * this.zoom) / 2;
      } else {
        this.zoom = 0.5;
        this.camX = 20;
        this.camY = 20;
      }
      this.drawCanvas();
    };

    app.zoomByStep = function (factor) {
      const canvas = document.getElementById('mapCanvas');
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const newZoom = Math.max(0.1, Math.min(4.0, this.zoom * factor));
      this.camX = cx - ((cx - this.camX) / this.zoom) * newZoom;
      this.camY = cy - ((cy - this.camY) / this.zoom) * newZoom;
      this.zoom = newZoom;
      this.drawCanvas();
    };

    app.setTool = function (toolName) {
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

      const npcQuickBar = document.getElementById('npcQuickBar');
      if (npcQuickBar) {
        npcQuickBar.style.display = toolName === 'NPC' || (toolName === 'EDIT' && this.npcs.length > 0) ? 'flex' : 'none';
      }
      this.updateSelectedMapNpcQuickBar();

      if (toolName === 'COLLISION' && this.collisionPolygons.length === 0) {
        this.startNewPolygon('COLLISION');
      } else if (toolName === 'OVERLAP' && this.overlapPolygons.length === 0) {
        this.startNewPolygon('OVERLAP');
      }

      const hint = document.getElementById('canvasHint');
      const crossBtn = document.getElementById('btnPlaceAtCrosshair');
      if (toolName === 'EDIT') {
        if (hint) {
          hint.innerHTML =
            '✏️ <strong>Modo Edição Ativo:</strong> Arraste qualquer vértice amarelo, Portal, NPC ou Spawn para ajustar a posição.';
        }
        if (crossBtn) crossBtn.textContent = '🔒 Concluir Edição (Travar Malhas)';
      } else {
        if (hint) {
          hint.innerHTML =
            '🔒 <strong>Malhas Existentes Travadas:</strong> Tocar na tela apenas adiciona novos itens da ferramenta ativa, sem risco de esbarrar nos vértices já criados!';
        }
        if (crossBtn) crossBtn.textContent = '📍 Marcar no Alvo Central (+)';
      }

      this.renderLayerLists();
      this.drawCanvas();
    };

    app.enterPolygonEditMode = function (type, idx) {
      this.editableLayerType = type;
      if (type === 'COLLISION') {
        this.activeCollisionPolyIndex = idx;
      } else {
        this.activeOverlapPolyIndex = idx;
      }
      this.setTool('EDIT');
    };

    app.startNewPolygon = function (type) {
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
    };

    app.placeAtCenterCrosshair = function () {
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
    };

    app.applyToolPlacementAtWorldPoint = function (x, y) {
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
        this.toggleLayersDrawer(true);
      } else if (this.tool === 'NPC') {
        // Se tocar em cima de um NPC já posicionado (no pé ou no corpo do modelo 2.5D), gira ele no próprio lugar!
        const existingIdx = this.npcs.findIndex((n) => {
          const hitFoot = Math.hypot(n.posX - x, n.posY - y) <= Math.max(32, 32 / this.zoom);
          const hitBody = Math.abs(n.posX - x) <= 28 && y >= n.posY - 68 && y <= n.posY + 14;
          return hitFoot || hitBody;
        });
        if (existingIdx >= 0) {
          this.undoStack.pop(); // rotateMapNpc já grava seu próprio snapshot
          this.rotateMapNpc(existingIdx);
          return;
        }

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
        this.selectedMapNpcIndex = this.npcs.length - 1;
        this.updateSelectedMapNpcQuickBar();
      }
      this.renderLayerLists();
      this.drawCanvas();
    };

    app.setupCanvasEvents = function () {
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
          const n = this.npcs[i];
          const hitFoot = Math.hypot(n.posX - worldX, n.posY - worldY) <= Math.max(hitRadius, 32);
          const hitBody = Math.abs(n.posX - worldX) <= 28 && worldY >= n.posY - 68 && worldY <= n.posY + 14;
          if (hitFoot || hitBody) {
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
                if (hit.list === 'NPC') {
                  this.selectedMapNpcIndex = hit.polyIdx;
                  this.updateSelectedMapNpcQuickBar();
                }
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

      if (viewport) {
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
    };

    app.moveDraggedObject = function (x, y) {
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
    };

    app.resizeCanvas = function () {
      const viewport = document.getElementById('canvasViewport');
      const canvas = document.getElementById('mapCanvas');
      if (!viewport || !canvas) return;
      canvas.width = viewport.clientWidth || window.innerWidth;
      canvas.height = viewport.clientHeight || window.innerHeight - 48;
      this.drawCanvas();
    };

    app.drawCanvas = function () {
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

      // NPCs (Renderiza o Modelo Original 2.5D do NPC com Espelhamento Horizontal ao Girar)
      this.npcs.forEach((n, idx) => {
        const tpl = this.npcTemplates.find((t) => t.id === Number(n.npcTemplateId));
        const label = tpl ? tpl.namePtBr : `NPC #${n.npcTemplateId}`;
        const dir = (Number(n.direction) || 0) > 0 ? 1 : 0;
        const dirText = dir > 0 ? '➡️ Virado ↔️' : '⬅️ Padrão';
        const isSelected = idx === this.selectedMapNpcIndex;

        // Anel discreto nos pés do NPC (Dourado quando selecionado para girar/mover, Verde nos demais)
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(n.posX, n.posY, isSelected ? 25 : 21, isSelected ? 13 : 11, 0, 0, Math.PI * 2);
        ctx.strokeStyle = isSelected ? '#fde047' : '#4ade80';
        ctx.lineWidth = (isSelected ? 2.8 : 2) / this.zoom;
        ctx.stroke();
        ctx.restore();

        // Modelo original 2.5D do NPC (vira/espelha horizontalmente quando dir === 1)
        const sprite = this.getOrCreateMapNpcSprite(tpl);
        if (sprite) {
          sprite.draw(ctx, n.posX, n.posY, 0, dir, 0, null, 0, 0.70);
        } else {
          ctx.beginPath();
          ctx.arc(n.posX, n.posY, 20, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(34, 197, 94, 0.45)';
          ctx.fill();
        }

        // Etiqueta com nome e sentido acima da cabeça do NPC
        ctx.save();
        ctx.font = `bold ${Math.max(11, Math.round(13 / this.zoom))}px sans-serif`;
        ctx.textAlign = 'center';
        const fullTag = `🧙 #${idx + 1} ${label} [${dirText}]`;
        ctx.lineWidth = 3 / this.zoom;
        ctx.strokeStyle = 'rgba(2, 6, 23, 0.9)';
        ctx.strokeText(fullTag, n.posX, n.posY - 64);
        ctx.fillStyle = isSelected ? '#fde047' : '#86efac';
        ctx.fillText(fullTag, n.posX, n.posY - 64);
        ctx.restore();
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
      ctx.lineTo(cx + 14, cy);
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
    };
  }
}

window.AdminCanvasEditor = AdminCanvasEditor;
