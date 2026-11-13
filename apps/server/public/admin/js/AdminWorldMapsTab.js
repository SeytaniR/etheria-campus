/**
 * @file apps/server/public/admin/js/AdminWorldMapsTab.js
 * @module @etheria/server
 * @description Submódulo da Aba `🌍 Mapas Gerais` na Rota `/admin`.
 *   - Gerenciamento completo dos Continentes / Mapas Gerais com base limpa e logotipo transparente.
 *   - Criação interativa livre de Pontos e Linhas/Ligações entre cidades e regiões.
 *   - Vínculo direto de qualquer ponto a mapas cadastrados na Tabela de Mapas (`GameMap`).
 *   - Layout 100% responsivo para Mobile Vertical (Portrait) e Desktop com controles touch-friendly.
 */

class AdminWorldMapsTab {
  static LOGO_ASPECT = 640 / 438;

  static attach(app) {
    app.worldMapsList = [];
    app.worldMapAvailableMaps = [];
    app.activeWorldMapCode = 'continent_1';
    app.activeToolMode = 'SELECT'; // SELECT | ADD_POINT | CONNECT | DELETE
    app.selectedWorldPointId = null;
    app.connectSourcePointId = null;
    app.worldMapPointsFilter = 'ALL'; // ALL | LINKED | UNLINKED | CITIES
    app.worldMapDirty = false;
    app.worldMapInteraction = null;
    app.worldMapZoom = 1.0;
    app.worldMapPan = { x: 0, y: 0 };

    AdminWorldMapsTab.injectDom();
    AdminWorldMapsTab.bindStageEvents(app);

    app.getActiveWorldMap = function () {
      return this.worldMapsList.find((w) => w.code === this.activeWorldMapCode) || this.worldMapsList[0] || null;
    };

    app.markWorldMapDirty = function (isDirty = true) {
      this.worldMapDirty = isDirty;
      const badge = document.getElementById('wmDirtyBadge');
      if (badge) {
        badge.style.display = isDirty ? 'inline-flex' : 'none';
      }
    };

    app.setWorldMapToolMode = function (mode) {
      this.activeToolMode = mode;
      if (mode !== 'CONNECT') {
        this.connectSourcePointId = null;
      }
      this.updateToolButtonsVisual();
      this.renderWorldMapSvgOverlay();
      this.updateWorldMapModeBanner();
    };

    app.updateToolButtonsVisual = function () {
      const mode = this.activeToolMode;
      document.querySelectorAll('.wm-tool-btn').forEach((btn) => {
        const btnMode = btn.getAttribute('data-tool-mode');
        btn.className = btnMode === mode ? 'btn-primary wm-tool-btn' : 'btn-secondary wm-tool-btn';
      });
    };

    app.updateWorldMapModeBanner = function () {
      const banner = document.getElementById('wmModeHintBanner');
      if (!banner) return;
      const hints = {
        SELECT: '👆 <strong>Modo Selecionar / Mover:</strong> Clique num ponto para editar ou arraste para reposicionar.',
        ADD_POINT: '➕ <strong>Modo Criar Ponto:</strong> Clique em qualquer local do mapa para criar um novo ponto.',
        CONNECT: this.connectSourcePointId
          ? '🔗 <strong>Origem selecionada:</strong> Agora clique no ponto de destino para traçar a ligação.'
          : '🔗 <strong>Modo Criar Linha:</strong> Clique no primeiro ponto e depois no segundo para ligá-los.',
        DELETE: '🗑️ <strong>Modo Excluir:</strong> Clique em qualquer ponto ou linha para remover.',
      };
      banner.innerHTML = hints[this.activeToolMode] || '';
    };

    app.loadWorldMapsData = async function () {
      try {
        const res = await this.api('/api/admin/world-maps');
        this.worldMapsList = Array.isArray(res?.worldMaps) ? res.worldMaps : [];
        this.worldMapAvailableMaps = Array.isArray(res?.availableMaps) ? res.availableMaps : [];
        if (!this.getActiveWorldMap() && this.worldMapsList.length > 0) {
          this.activeWorldMapCode = this.worldMapsList[0].code;
        }
        this.markWorldMapDirty(false);
        this.renderWorldMapsWorkspace();
      } catch (err) {
        console.error('Erro ao carregar Mapas Gerais:', err);
        alert(`Falha ao carregar Mapas Gerais: ${err.message}`);
      }
    };

    app.selectWorldMapContinent = function (code) {
      if (this.worldMapDirty && !confirm('Existem alterações não salvas neste continente. Trocar sem salvar?')) {
        return;
      }
      this.activeWorldMapCode = code;
      this.selectedWorldPointId = null;
      this.connectSourcePointId = null;
      this.markWorldMapDirty(false);
      this.renderWorldMapsWorkspace();
    };

    app.setWorldMapPointsFilter = function (filter) {
      this.worldMapPointsFilter = filter;
      this.renderWorldMapPointsQuickList();
    };

    app.toggleWorldMapLayer = function (layerKey, checked) {
      const wm = this.getActiveWorldMap();
      if (!wm) return;
      wm[layerKey] = Boolean(checked);
      this.markWorldMapDirty(true);
      this.renderWorldMapCanvasLayers();
    };

    app.updateWorldMapLogoControls = function (patch) {
      const wm = this.getActiveWorldMap();
      if (!wm) return;
      if (patch.logoWidth !== undefined) {
        const w = Math.max(60, Math.min(wm.canvasWidth || 1264, Number(patch.logoWidth) || 270));
        wm.logoWidth = Math.round(w);
        wm.logoHeight = Math.round(w / AdminWorldMapsTab.LOGO_ASPECT);
      }
      if (patch.logoX !== undefined) {
        wm.logoX = Math.round(Math.max(-40, Math.min((wm.canvasWidth || 1264) - 40, Number(patch.logoX) || 0)));
      }
      if (patch.logoY !== undefined) {
        wm.logoY = Math.round(Math.max(-40, Math.min((wm.canvasHeight || 848) - 40, Number(patch.logoY) || 0)));
      }
      if (patch.logoVisible !== undefined) {
        wm.logoVisible = Boolean(patch.logoVisible);
      }
      this.markWorldMapDirty(true);
      this.renderWorldMapLogoElement();
      this.syncWorldMapLogoInputs();
    };

    app.resetWorldMapLogoPosition = function (preset = 'TOP_LEFT') {
      const wm = this.getActiveWorldMap();
      if (!wm) return;
      const cw = wm.canvasWidth || 1264;
      if (preset === 'TOP_CENTER') {
        const w = wm.logoWidth || 270;
        this.updateWorldMapLogoControls({ logoX: Math.round((cw - w) / 2), logoY: 20, logoVisible: true });
      } else {
        this.updateWorldMapLogoControls({ logoX: 38, logoY: 28, logoWidth: 270, logoVisible: true });
      }
    };

    app.selectWorldMapPoint = function (pointId) {
      this.selectedWorldPointId = pointId;
      this.renderWorldMapSvgOverlay();
      this.renderWorldMapPointInspector();
      this.renderWorldMapPointsQuickList();
    };

    app.addNewWorldPoint = function (x, y) {
      const wm = this.getActiveWorldMap();
      if (!wm) return;
      if (!Array.isArray(wm.pointsJson)) wm.pointsJson = [];

      const nextNum = wm.pointsJson.length + 1;
      const newPt = {
        id: `pt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        refId: nextNum,
        refLabel: `Ponto #${nextNum}`,
        x: Math.round(Math.max(15, Math.min((wm.canvasWidth || 1264) - 15, x)) * 10) / 10,
        y: Math.round(Math.max(15, Math.min((wm.canvasHeight || 848) - 15, y)) * 10) / 10,
        isCity: false,
        gameMapId: null,
        customLabel: '',
      };

      wm.pointsJson.push(newPt);
      this.markWorldMapDirty(true);
      this.selectWorldMapPoint(newPt.id);
    };

    app.deleteWorldPoint = function (pointId) {
      const wm = this.getActiveWorldMap();
      if (!wm) return;
      const pt = (wm.pointsJson || []).find((p) => p.id === pointId);
      if (!pt) return;

      if (!confirm(`Excluir o ponto "${pt.customLabel || pt.refLabel}" e todas as suas ligações?`)) {
        return;
      }

      wm.pointsJson = (wm.pointsJson || []).filter((p) => p.id !== pointId);
      wm.routesJson = (wm.routesJson || []).filter((r) => r.from !== pointId && r.to !== pointId);

      if (this.selectedWorldPointId === pointId) {
        this.selectedWorldPointId = null;
      }
      if (this.connectSourcePointId === pointId) {
        this.connectSourcePointId = null;
      }

      this.markWorldMapDirty(true);
      this.renderWorldMapSvgOverlay();
      this.renderWorldMapPointInspector();
      this.renderWorldMapPointsQuickList();
    };

    app.toggleWorldRoute = function (fromId, toId) {
      const wm = this.getActiveWorldMap();
      if (!wm || !fromId || !toId || fromId === toId) return;
      if (!Array.isArray(wm.routesJson)) wm.routesJson = [];

      const existsIdx = wm.routesJson.findIndex(
        (r) => (r.from === fromId && r.to === toId) || (r.from === toId && r.to === fromId)
      );

      if (existsIdx >= 0) {
        wm.routesJson.splice(existsIdx, 1);
      } else {
        wm.routesJson.push({ from: fromId, to: toId });
      }

      this.markWorldMapDirty(true);
      this.renderWorldMapSvgOverlay();
      this.renderWorldMapPointInspector();
    };

    app.clearAllWorldPointsAndRoutes = function () {
      const wm = this.getActiveWorldMap();
      if (!wm) return;
      if (!confirm(`⚠️ Deseja realmente EXCLUIR TODOS os pontos e linhas do "${wm.namePtBr}"?\nVocê poderá criar seus próprios pontos e rotas do zero.`)) {
        return;
      }

      wm.pointsJson = [];
      wm.routesJson = [];
      this.selectedWorldPointId = null;
      this.connectSourcePointId = null;
      this.markWorldMapDirty(true);
      this.renderWorldMapsWorkspace();
    };

    app.linkSelectedMapToWorldPoint = function () {
      const wm = this.getActiveWorldMap();
      if (!wm || !this.selectedWorldPointId) return;
      const pt = (wm.pointsJson || []).find((p) => p.id === this.selectedWorldPointId);
      if (!pt) return;

      const selectEl = document.getElementById('wmAssignMapSelect');
      const customLabelEl = document.getElementById('wmPointCustomLabelInput');
      const isCityEl = document.getElementById('wmPointIsCityInput');
      const coordXEl = document.getElementById('wmPointCoordXInput');
      const coordYEl = document.getElementById('wmPointCoordYInput');

      const chosenMapId = selectEl && selectEl.value ? Number(selectEl.value) : null;
      pt.gameMapId = chosenMapId;
      pt.customLabel = customLabelEl ? customLabelEl.value.trim() : '';
      if (isCityEl) pt.isCity = Boolean(isCityEl.checked);
      if (coordXEl && coordXEl.value) pt.x = Math.max(10, Math.min((wm.canvasWidth || 1264) - 10, Number(coordXEl.value) || pt.x));
      if (coordYEl && coordYEl.value) pt.y = Math.max(10, Math.min((wm.canvasHeight || 848) - 10, Number(coordYEl.value) || pt.y));

      this.markWorldMapDirty(true);
      this.renderWorldMapSvgOverlay();
      this.renderWorldMapPointInspector();
      this.renderWorldMapPointsQuickList();
    };

    app.unlinkWorldPointMap = function () {
      const wm = this.getActiveWorldMap();
      if (!wm || !this.selectedWorldPointId) return;
      const pt = (wm.pointsJson || []).find((p) => p.id === this.selectedWorldPointId);
      if (!pt) return;
      pt.gameMapId = null;
      this.markWorldMapDirty(true);
      this.renderWorldMapSvgOverlay();
      this.renderWorldMapPointInspector();
      this.renderWorldMapPointsQuickList();
    };

    app.saveActiveWorldMap = async function () {
      const wm = this.getActiveWorldMap();
      if (!wm) return;
      try {
        const saved = await this.api('/api/admin/world-maps', {
          method: 'POST',
          body: JSON.stringify({
            id: wm.id,
            code: wm.code,
            namePtBr: wm.namePtBr,
            logoImageUrl: wm.logoImageUrl,
            logoX: wm.logoX,
            logoY: wm.logoY,
            logoWidth: wm.logoWidth,
            logoHeight: wm.logoHeight,
            logoVisible: wm.logoVisible,
            showRoutesLayer: wm.showRoutesLayer,
            showPointsLayer: wm.showPointsLayer,
            pointsJson: wm.pointsJson || [],
            routesJson: wm.routesJson || [],
          }),
        });
        const idx = this.worldMapsList.findIndex((x) => x.code === saved.code);
        if (idx >= 0) this.worldMapsList[idx] = saved;
        this.markWorldMapDirty(false);
        this.renderWorldMapsWorkspace();
        alert(`✅ ${saved.namePtBr} salvo com sucesso no PostgreSQL e Snapshot!`);
      } catch (err) {
        alert(`Erro ao salvar Mapa Geral: ${err.message}`);
      }
    };

    app.setWorldMapZoom = function (delta) {
      if (delta === 0) {
        this.worldMapZoom = 1.0;
        this.worldMapPan = { x: 0, y: 0 };
      } else {
        this.worldMapZoom = Math.max(1.0, Math.min(3.0, this.worldMapZoom + delta));
      }
      this.applyWorldMapTransform();
    };

    app.applyWorldMapTransform = function () {
      const stage = document.getElementById('wmInteractiveStage');
      if (!stage) return;
      const z = this.worldMapZoom;
      const px = this.worldMapPan.x;
      const py = this.worldMapPan.y;
      stage.style.transform = `scale(${z}) translate(${px}px, ${py}px)`;
      stage.style.transformOrigin = 'center center';
      const zoomBadge = document.getElementById('wmZoomBadge');
      if (zoomBadge) zoomBadge.textContent = `${Math.round(z * 100)}%`;
    };

    app.renderWorldMapsWorkspace = function () {
      const tabsEl = document.getElementById('wmContinentTabs');
      const wm = this.getActiveWorldMap();
      if (tabsEl) {
        tabsEl.innerHTML = this.worldMapsList
          .map((item) => {
            const active = wm && item.code === wm.code;
            const linkedCount = (item.pointsJson || []).filter((p) => p.gameMapId).length;
            const totalCount = (item.pointsJson || []).length;
            return `
              <button type="button"
                class="${active ? 'btn-primary' : 'btn-secondary'}"
                style="padding:8px 14px; font-size:0.84rem; font-weight:700; border-radius:6px; min-height:40px;"
                onclick="AdminApp.selectWorldMapContinent('${this.escapeHtml(item.code)}')">
                ${item.code === 'continent_1' ? '🗺️' : '🏝️'} ${this.escapeHtml(item.namePtBr)}
                <span style="opacity:0.85; font-weight:500;">(${linkedCount}/${totalCount})</span>
              </button>
            `;
          })
          .join('');
      }

      if (!wm) return;

      const baseImg = document.getElementById('wmBaseImage');
      if (baseImg) baseImg.src = wm.baseImageUrl;

      const chkRoutes = document.getElementById('wmToggleRoutesChk');
      const chkPoints = document.getElementById('wmTogglePointsChk');
      const chkLogo = document.getElementById('wmToggleLogoChk');
      if (chkRoutes) chkRoutes.checked = Boolean(wm.showRoutesLayer);
      if (chkPoints) chkPoints.checked = Boolean(wm.showPointsLayer);
      if (chkLogo) chkLogo.checked = Boolean(wm.logoVisible);

      this.updateToolButtonsVisual();
      this.updateWorldMapModeBanner();
      this.renderWorldMapCanvasLayers();
      this.syncWorldMapLogoInputs();
      this.renderWorldMapPointInspector();
      this.renderWorldMapPointsQuickList();
    };

    app.renderWorldMapCanvasLayers = function () {
      this.renderWorldMapSvgOverlay();
      this.renderWorldMapLogoElement();
    };

    app.renderWorldMapLogoElement = function () {
      const wm = this.getActiveWorldMap();
      const box = document.getElementById('wmLogoDraggableBox');
      const img = document.getElementById('wmLogoImg');
      if (!wm || !box || !img) return;

      const cw = wm.canvasWidth || 1264;
      const ch = wm.canvasHeight || 848;
      if (!wm.logoVisible || !wm.logoImageUrl) {
        box.style.display = 'none';
        return;
      }
      box.style.display = 'block';
      img.src = wm.logoImageUrl;
      box.style.left = `${(Number(wm.logoX || 0) / cw) * 100}%`;
      box.style.top = `${(Number(wm.logoY || 0) / ch) * 100}%`;
      box.style.width = `${(Number(wm.logoWidth || 270) / cw) * 100}%`;
    };

    app.syncWorldMapLogoInputs = function () {
      const wm = this.getActiveWorldMap();
      if (!wm) return;
      const slider = document.getElementById('wmLogoWidthSlider');
      const wInput = document.getElementById('wmLogoWidthInput');
      const xInput = document.getElementById('wmLogoXInput');
      const yInput = document.getElementById('wmLogoYInput');
      const visInput = document.getElementById('wmLogoVisibleInput');
      if (slider) slider.value = String(Math.round(wm.logoWidth || 270));
      if (wInput) wInput.value = String(Math.round(wm.logoWidth || 270));
      if (xInput) xInput.value = String(Math.round(wm.logoX || 0));
      if (yInput) yInput.value = String(Math.round(wm.logoY || 0));
      if (visInput) visInput.checked = Boolean(wm.logoVisible);
    };

    app.renderWorldMapSvgOverlay = function () {
      const wm = this.getActiveWorldMap();
      const svg = document.getElementById('wmVectorOverlaySvg');
      if (!wm || !svg) return;

      const cw = wm.canvasWidth || 1264;
      const ch = wm.canvasHeight || 848;
      svg.setAttribute('viewBox', `0 0 ${cw} ${ch}`);

      const points = Array.isArray(wm.pointsJson) ? wm.pointsJson : [];
      const routes = Array.isArray(wm.routesJson) ? wm.routesJson : [];
      const ptById = new Map(points.map((p) => [p.id, p]));
      const mapById = new Map((this.worldMapAvailableMaps || []).map((m) => [m.id, m]));

      // Renderiza as Linhas / Rotas
      const routesHtml = wm.showRoutesLayer
        ? routes
            .map((r) => {
              const a = ptById.get(r.from);
              const b = ptById.get(r.to);
              if (!a || !b) return '';
              const isDeleteMode = this.activeToolMode === 'DELETE';
              return `
                <g class="wm-route-group" data-from="${this.escapeHtml(r.from)}" data-to="${this.escapeHtml(r.to)}" style="cursor:${isDeleteMode ? 'not-allowed' : 'pointer'};">
                  <title>Linha entre ${this.escapeHtml(a.customLabel || a.refLabel)} e ${this.escapeHtml(b.customLabel || b.refLabel)} (Clique para remover no modo Excluir)</title>
                  <line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#0284c7" stroke-width="6.5" stroke-linecap="round" opacity="0.4" />
                  <line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#38bdf8" stroke-width="3.5" stroke-linecap="round" opacity="0.95" />
                  <line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#f0f9ff" stroke-width="1.2" stroke-dasharray="6 4" stroke-linecap="round" />
                </g>
              `;
            })
            .join('')
        : '';

      // Linha guia temporária durante conexão ativa
      let connectGuideHtml = '';
      if (this.activeToolMode === 'CONNECT' && this.connectSourcePointId) {
        const src = ptById.get(this.connectSourcePointId);
        if (src) {
          connectGuideHtml = `
            <circle cx="${src.x}" cy="${src.y}" r="22" fill="none" stroke="#eab308" stroke-width="3" stroke-dasharray="5 4">
              <animateTransform attributeName="transform" type="rotate" from="0 ${src.x} ${src.y}" to="360 ${src.x} ${src.y}" dur="4s" repeatCount="indefinite" />
            </circle>
          `;
        }
      }

      // Renderiza os Pontos
      const pointsHtml = wm.showPointsLayer
        ? points
            .map((pt) => {
              const isSelected = pt.id === this.selectedWorldPointId;
              const isConnectSrc = pt.id === this.connectSourcePointId;
              const linkedMap = pt.gameMapId ? mapById.get(Number(pt.gameMapId)) : null;
              const isLinked = Boolean(linkedMap);
              const labelText = pt.customLabel?.trim() || (linkedMap ? linkedMap.namePtBr : pt.refLabel);

              const outerR = pt.isCity ? 13 : 9;
              const innerR = pt.isCity ? 6.5 : 4.5;
              const ringFill = isConnectSrc ? '#fef08a' : isLinked ? '#dcfce7' : pt.isCity ? '#fef3c7' : '#ffffff';
              const ringStroke = isConnectSrc ? '#ca8a04' : isLinked ? '#15803d' : pt.isCity ? '#b45309' : '#4338ca';
              const coreFill = isConnectSrc ? '#eab308' : isLinked ? '#22c55e' : pt.isCity ? '#f59e0b' : '#6366f1';

              const selectHalo = isSelected
                ? `<circle cx="${pt.x}" cy="${pt.y}" r="${outerR + 9}" fill="none" stroke="#38bdf8" stroke-width="3.5" stroke-dasharray="4 3" />`
                : '';

              const badgeLabel = `
                <g pointer-events="none" transform="translate(${pt.x}, ${pt.y + outerR + 15})">
                  <rect x="${-Math.min(140, Math.max(50, labelText.length * 4.2 + 12))}" y="-11"
                    width="${Math.min(280, Math.max(100, labelText.length * 8.4 + 24))}" height="20" rx="6"
                    fill="rgba(15, 23, 42, 0.92)" stroke="${isSelected ? '#38bdf8' : isLinked ? '#4ade80' : '#64748b'}" stroke-width="${isSelected ? 2 : 1.2}" />
                  <text text-anchor="middle" y="4" fill="#f8fafc" font-size="12" font-weight="700" font-family="system-ui, sans-serif">
                    ${this.escapeHtml(labelText)}
                  </text>
                </g>
              `;

              return `
                <g class="wm-point-node" data-point-id="${this.escapeHtml(pt.id)}" style="cursor:pointer;">
                  <title>${this.escapeHtml(labelText)} (${Math.round(pt.x)}, ${Math.round(pt.y)})</title>
                  ${selectHalo}
                  <circle cx="${pt.x}" cy="${pt.y}" r="${outerR + 10}" fill="transparent" />
                  <circle cx="${pt.x}" cy="${pt.y}" r="${outerR}" fill="${ringFill}" stroke="${ringStroke}" stroke-width="3" />
                  <circle cx="${pt.x}" cy="${pt.y}" r="${innerR}" fill="${coreFill}" />
                  ${badgeLabel}
                </g>
              `;
            })
            .join('')
        : '';

      svg.innerHTML = `
        <defs>
          <filter id="wmGlowFilter" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g id="wmRoutesGroup" filter="url(#wmGlowFilter)">${routesHtml}</g>
        <g id="wmGuideGroup">${connectGuideHtml}</g>
        <g id="wmPointsGroup">${pointsHtml}</g>
      `;
    };

    app.renderWorldMapPointInspector = function () {
      const box = document.getElementById('wmPointInspectorBody');
      if (!box) return;
      const wm = this.getActiveWorldMap();
      if (!wm || !this.selectedWorldPointId) {
        box.innerHTML = AdminWorldMapsDom.renderEmptyInspectorHtml();
        return;
      }

      const pt = (wm.pointsJson || []).find((p) => p.id === this.selectedWorldPointId);
      if (!pt) return;

      const available = this.worldMapAvailableMaps || [];
      const linkedMap = pt.gameMapId ? available.find((m) => m.id === Number(pt.gameMapId)) : null;

      // Descobre todas as ligações deste ponto
      const connectedPointIds = new Set();
      (wm.routesJson || []).forEach((r) => {
        if (r.from === pt.id) connectedPointIds.add(r.to);
        if (r.to === pt.id) connectedPointIds.add(r.from);
      });

      const ptById = new Map((wm.pointsJson || []).map((p) => [p.id, p]));
      const connectedListHtml = Array.from(connectedPointIds)
        .map((cid) => {
          const targetPt = ptById.get(cid);
          if (!targetPt) return '';
          const targetName = targetPt.customLabel || targetPt.refLabel;
          return `
            <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(15,23,42,0.7); border:1px solid #334155; border-radius:6px; padding:4px 8px; font-size:0.75rem;">
              <span>🔗 ${this.escapeHtml(targetName)}</span>
              <button type="button" class="btn-danger" style="padding:1px 6px; font-size:0.68rem;" title="Remover ligação" onclick="AdminApp.toggleWorldRoute('${pt.id}', '${cid}')">✕</button>
            </div>
          `;
        })
        .join('');

      // Opções para conectar com outro ponto rapidamente via select
      const otherPointsOptions = (wm.pointsJson || [])
        .filter((p) => p.id !== pt.id && !connectedPointIds.has(p.id))
        .map((p) => `<option value="${p.id}">${this.escapeHtml(p.customLabel || p.refLabel)}</option>`)
        .join('');

      // Opções de GameMap
      const mapOptions = available
        .map((m) => {
          const draftTag = m.isActive ? '' : ' [Rascunho]';
          const selected = Number(pt.gameMapId) === m.id ? 'selected' : '';
          return `<option value="${m.id}" ${selected}>#${m.id} ${this.escapeHtml(m.namePtBr)} (Lv.${m.requiredLevel} • ${this.escapeHtml(m.mapTypeName)})${draftTag}</option>`;
        })
        .join('');

      box.innerHTML = AdminWorldMapsDom.renderPointInspectorHtml({
        pt,
        linkedMap,
        connectedListHtml,
        connectedCount: connectedPointIds.size,
        otherPointsOptions,
        mapOptions,
        escapeHtml: (s) => this.escapeHtml(s),
      });
    };

    app.handleQuickConnectClick = function (sourceId) {
      const sel = document.getElementById('wmQuickConnectTargetSelect');
      if (!sel || !sel.value) return;
      this.toggleWorldRoute(sourceId, sel.value);
    };

    app.filterWorldMapAssignOptions = function () {
      const q = (document.getElementById('wmMapSearchFilter')?.value || '').trim().toLowerCase();
      const sel = document.getElementById('wmAssignMapSelect');
      if (!sel) return;
      Array.from(sel.options).forEach((opt, idx) => {
        if (idx === 0) {
          opt.hidden = false;
          return;
        }
        opt.hidden = q.length > 0 && !opt.textContent.toLowerCase().includes(q);
      });
    };

    app.renderWorldMapPointsQuickList = function () {
      const listEl = document.getElementById('wmPointsQuickList');
      if (!listEl) return;
      const wm = this.getActiveWorldMap();
      if (!wm) return;

      const mapById = new Map((this.worldMapAvailableMaps || []).map((m) => [m.id, m]));
      const pts = (wm.pointsJson || []).filter((p) => {
        if (this.worldMapPointsFilter === 'LINKED') return Boolean(p.gameMapId);
        if (this.worldMapPointsFilter === 'UNLINKED') return !p.gameMapId;
        if (this.worldMapPointsFilter === 'CITIES') return Boolean(p.isCity);
        return true;
      });

      document.querySelectorAll('.wm-pt-filter-btn').forEach((btn) => {
        btn.className = btn.dataset.filter === this.worldMapPointsFilter ? 'btn-primary wm-pt-filter-btn' : 'btn-secondary wm-pt-filter-btn';
      });

      if (pts.length === 0) {
        listEl.innerHTML = `<div style="font-size:0.78rem; color:var(--text-muted); padding:10px; text-align:center;">Nenhum ponto cadastrado. Use o botão <strong>➕ Criar Ponto</strong> acima.</div>`;
        return;
      }

      listEl.innerHTML = pts
        .map((pt) => {
          const linked = pt.gameMapId ? mapById.get(Number(pt.gameMapId)) : null;
          const active = pt.id === this.selectedWorldPointId;
          const label = pt.customLabel?.trim() || (linked ? `#${linked.id} ${linked.namePtBr}` : pt.refLabel);
          return `
            <div onclick="AdminApp.selectWorldMapPoint('${this.escapeHtml(pt.id)}')"
              style="display:flex; justify-content:space-between; align-items:center; gap:6px; padding:7px 10px; border-radius:6px; cursor:pointer; font-size:0.78rem; background:${active ? 'rgba(56,189,248,0.18)' : 'rgba(15,23,42,0.7)'}; border:1px solid ${active ? '#38bdf8' : 'var(--border)'};">
              <div>
                <span style="color:${linked ? '#4ade80' : pt.isCity ? '#f59e0b' : '#38bdf8'}; font-weight:700;">${pt.isCity ? '🏰' : '📍'}</span>
                <span style="color:#f8fafc; font-weight:600;">${this.escapeHtml(label)}</span>
              </div>
              <span style="font-size:0.70rem; color:${linked ? '#86efac' : '#94a3b8'};">${linked ? 'Vinculado' : 'Sem mapa'}</span>
            </div>
          `;
        })
        .join('');
    };
  }

  static bindStageEvents(app) {
    const stage = document.getElementById('wmInteractiveStage');
    const logoBox = document.getElementById('wmLogoDraggableBox');
    const resizeHandle = document.getElementById('wmLogoResizeHandle');
    const svg = document.getElementById('wmVectorOverlaySvg');
    if (!stage || !logoBox || !resizeHandle || !svg) return;

    const getCanvasCoords = (evt) => {
      const wm = app.getActiveWorldMap();
      const rect = stage.getBoundingClientRect();
      const cw = wm?.canvasWidth || 1264;
      const ch = wm?.canvasHeight || 848;
      const clientX = evt.clientX !== undefined ? evt.clientX : evt.touches?.[0]?.clientX || 0;
      const clientY = evt.clientY !== undefined ? evt.clientY : evt.touches?.[0]?.clientY || 0;
      return {
        x: ((clientX - rect.left) / Math.max(1, rect.width)) * cw,
        y: ((clientY - rect.top) / Math.max(1, rect.height)) * ch,
        cw,
        ch,
      };
    };

    // Redimensionamento do Logo
    resizeHandle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const wm = app.getActiveWorldMap();
      if (!wm) return;
      const pos = getCanvasCoords(e);
      app.worldMapInteraction = {
        mode: 'RESIZE_LOGO',
        startX: pos.x,
        origWidth: Number(wm.logoWidth || 270),
      };
      resizeHandle.setPointerCapture?.(e.pointerId);
    });

    // Arraste do Logo
    logoBox.addEventListener('pointerdown', (e) => {
      if (e.target === resizeHandle) return;
      if (app.activeToolMode !== 'SELECT') return;
      e.preventDefault();
      e.stopPropagation();
      const wm = app.getActiveWorldMap();
      if (!wm) return;
      const pos = getCanvasCoords(e);
      app.worldMapInteraction = {
        mode: 'DRAG_LOGO',
        startX: pos.x,
        startY: pos.y,
        origLogoX: Number(wm.logoX || 0),
        origLogoY: Number(wm.logoY || 0),
      };
      logoBox.setPointerCapture?.(e.pointerId);
    });

    // Clique e Interação no Palco do Mapa
    stage.addEventListener('pointerdown', (e) => {
      if (e.target === resizeHandle || (e.target.closest && e.target.closest('#wmLogoDraggableBox') && app.activeToolMode === 'SELECT')) {
        return;
      }

      const wm = app.getActiveWorldMap();
      if (!wm) return;

      const pointNode = e.target.closest?.('.wm-point-node');
      const ptId = pointNode?.getAttribute('data-point-id');

      const routeGroup = e.target.closest?.('.wm-route-group');
      const routeFrom = routeGroup?.getAttribute('data-from');
      const routeTo = routeGroup?.getAttribute('data-to');

      // 1. MODO ADICIONAR PONTO
      if (app.activeToolMode === 'ADD_POINT') {
        e.preventDefault();
        const pos = getCanvasCoords(e);
        app.addNewWorldPoint(pos.x, pos.y);
        return;
      }

      // 2. MODO EXCLUIR
      if (app.activeToolMode === 'DELETE') {
        e.preventDefault();
        if (ptId) {
          app.deleteWorldPoint(ptId);
          return;
        }
        if (routeFrom && routeTo) {
          app.toggleWorldRoute(routeFrom, routeTo);
          return;
        }
        return;
      }

      // 3. MODO CRIAR LIGAÇÃO (CONECTAR)
      if (app.activeToolMode === 'CONNECT') {
        e.preventDefault();
        if (ptId) {
          if (!app.connectSourcePointId) {
            app.connectSourcePointId = ptId;
            app.updateWorldMapModeBanner();
            app.renderWorldMapSvgOverlay();
          } else if (app.connectSourcePointId === ptId) {
            app.connectSourcePointId = null;
            app.updateWorldMapModeBanner();
            app.renderWorldMapSvgOverlay();
          } else {
            app.toggleWorldRoute(app.connectSourcePointId, ptId);
            app.connectSourcePointId = ptId; // Permite encadear conexões!
            app.updateWorldMapModeBanner();
          }
        }
        return;
      }

      // 4. MODO SELECIONAR / MOVER
      if (app.activeToolMode === 'SELECT') {
        if (ptId) {
          e.preventDefault();
          app.selectWorldMapPoint(ptId);
          const pt = (wm.pointsJson || []).find((p) => p.id === ptId);
          if (pt) {
            const pos = getCanvasCoords(e);
            app.worldMapInteraction = {
              mode: 'DRAG_POINT',
              pointId: ptId,
              startX: pos.x,
              startY: pos.y,
              origX: Number(pt.x),
              origY: Number(pt.y),
            };
            stage.setPointerCapture?.(e.pointerId);
          }
        }
      }
    });

    window.addEventListener('pointermove', (e) => {
      const st = app.worldMapInteraction;
      if (!st) return;
      const wm = app.getActiveWorldMap();
      if (!wm) return;
      const pos = getCanvasCoords(e);

      if (st.mode === 'DRAG_LOGO') {
        const nx = Math.round(st.origLogoX + (pos.x - st.startX));
        const ny = Math.round(st.origLogoY + (pos.y - st.startY));
        app.updateWorldMapLogoControls({ logoX: nx, logoY: ny });
      } else if (st.mode === 'RESIZE_LOGO') {
        const nw = Math.round(Math.max(70, Math.min(720, st.origWidth + (pos.x - st.startX))));
        app.updateWorldMapLogoControls({ logoWidth: nw });
      } else if (st.mode === 'DRAG_POINT') {
        const pt = (wm.pointsJson || []).find((p) => p.id === st.pointId);
        if (pt) {
          pt.x = Math.round(Math.max(10, Math.min(pos.cw - 10, st.origX + (pos.x - st.startX))) * 10) / 10;
          pt.y = Math.round(Math.max(10, Math.min(pos.ch - 10, st.origY + (pos.y - st.startY))) * 10) / 10;
          app.markWorldMapDirty(true);
          app.renderWorldMapSvgOverlay();
        }
      }
    });

    window.addEventListener('pointerup', () => {
      if (app.worldMapInteraction) {
        if (app.worldMapInteraction.mode === 'DRAG_POINT') {
          app.renderWorldMapPointInspector();
        }
        app.worldMapInteraction = null;
      }
    });
  }

  static injectDom() {
    const navTabs = document.querySelector('.nav-tabs');
    if (navTabs && !document.getElementById('tabBtnWorldMaps')) {
      const btn = document.createElement('button');
      btn.id = 'tabBtnWorldMaps';
      btn.textContent = '🌍 Mapas Gerais';
      btn.onclick = () => window.AdminApp.switchTab('world-maps');

      const mapsBtn = document.getElementById('tabBtnMaps');
      if (mapsBtn && mapsBtn.nextSibling) {
        navTabs.insertBefore(btn, mapsBtn.nextSibling);
      } else {
        navTabs.appendChild(btn);
      }
    }

    const adminApp = document.getElementById('adminApp');
    if (!adminApp || document.getElementById('tabWorldMaps')) return;

    const section = document.createElement('section');
    section.id = 'tabWorldMaps';
    section.style.display = 'none';
    section.style.flexDirection = 'column';
    section.style.gap = '12px';
    section.style.padding = '12px';

    section.innerHTML = AdminWorldMapsDom.getSectionHtml();
    adminApp.appendChild(section);
  }
}

window.AdminWorldMapsTab = AdminWorldMapsTab;
