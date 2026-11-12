/**
 * @file apps/server/public/admin/js/AdminWorldMapsTab.js
 * @module @etheria/server
 * @description Submódulo da Aba `🌍 Mapas Gerais` na Rota `/admin`.
 *   - Exibe os dois Continentes com base limpa (`world_map_1_base.png` / `world_map_2_base.png`),
 *     camada vetorial separada de linhas e pontos, e o logotipo transparente `Etheria Campus`.
 *   - Permite clicar em qualquer ponto no mapa para vincular um mapa já cadastrado na Tabela de Mapas (`GameMap`).
 *   - Permite arrastar e redimensionar livremente o logotipo `Etheria Campus` sobre cada mapa geral.
 */

class AdminWorldMapsTab {
  static LOGO_ASPECT = 640 / 438;

  static attach(app) {
    app.worldMapsList = [];
    app.worldMapAvailableMaps = [];
    app.activeWorldMapCode = 'continent_1';
    app.selectedWorldPointId = null;
    app.worldMapPointsFilter = 'ALL'; // ALL | LINKED | UNLINKED
    app.worldMapAllowPointDrag = false;
    app.worldMapDirty = false;
    app.worldMapInteraction = null;

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

    app.linkSelectedMapToWorldPoint = function () {
      const wm = this.getActiveWorldMap();
      if (!wm || !this.selectedWorldPointId) return;
      const pt = (wm.pointsJson || []).find((p) => p.id === this.selectedWorldPointId);
      if (!pt) return;

      const selectEl = document.getElementById('wmAssignMapSelect');
      const customLabelEl = document.getElementById('wmPointCustomLabelInput');
      const isCityEl = document.getElementById('wmPointIsCityInput');

      const chosenMapId = selectEl && selectEl.value ? Number(selectEl.value) : null;
      pt.gameMapId = chosenMapId;
      pt.customLabel = customLabelEl ? customLabelEl.value.trim() : '';
      if (isCityEl) pt.isCity = Boolean(isCityEl.checked);

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
      pt.customLabel = '';
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
            pointsJson: wm.pointsJson,
            routesJson: wm.routesJson,
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
                class="${active ? 'btn-primary' : ''}"
                style="padding:7px 14px; font-size:0.82rem; font-weight:700;"
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

      const routesHtml = wm.showRoutesLayer
        ? routes
            .map((r) => {
              const a = ptById.get(r.from);
              const b = ptById.get(r.to);
              if (!a || !b) return '';
              return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#7dd3fc" stroke-width="3.2" stroke-linecap="round" opacity="0.9" />`;
            })
            .join('')
        : '';

      const pointsHtml = wm.showPointsLayer
        ? points
            .map((pt) => {
              const isSelected = pt.id === this.selectedWorldPointId;
              const linkedMap = pt.gameMapId ? mapById.get(Number(pt.gameMapId)) : null;
              const isLinked = Boolean(linkedMap);
              const labelText = pt.customLabel?.trim() || (linkedMap ? linkedMap.namePtBr : '');

              const outerR = pt.isCity ? 9.5 : 7.5;
              const innerR = pt.isCity ? 4.5 : 3.4;
              const ringFill = isLinked ? '#dcfce7' : pt.isCity ? '#fef08a' : '#ffffff';
              const ringStroke = isLinked ? '#15803d' : pt.isCity ? '#92400e' : '#581c87';
              const coreFill = isLinked ? '#22c55e' : pt.isCity ? '#f59e0b' : '#d946ef';

              const selectHalo = isSelected
                ? `<circle cx="${pt.x}" cy="${pt.y}" r="${outerR + 7}" fill="none" stroke="#38bdf8" stroke-width="3" stroke-dasharray="4 3" />`
                : '';

              const badgeLabel = labelText
                ? `
                  <g pointer-events="none" transform="translate(${pt.x}, ${pt.y + outerR + 14})">
                    <rect x="${-Math.min(120, Math.max(46, labelText.length * 3.8 + 10))}" y="-10"
                      width="${Math.min(240, Math.max(92, labelText.length * 7.6 + 20))}" height="18" rx="5"
                      fill="rgba(15, 23, 42, 0.88)" stroke="${isSelected ? '#38bdf8' : '#4ade80'}" stroke-width="1.2" />
                    <text text-anchor="middle" y="3" fill="#f8fafc" font-size="11.5" font-weight="700" font-family="system-ui, sans-serif">
                      ${this.escapeHtml(labelText)}
                    </text>
                  </g>
                `
                : '';

              const tooltip = linkedMap
                ? `${pt.refLabel} → #${linkedMap.id} ${linkedMap.namePtBr}`
                : `${pt.refLabel} (Clique para vincular um mapa)`;

              return `
                <g class="wm-point-node" data-point-id="${this.escapeHtml(pt.id)}" style="cursor:pointer;">
                  <title>${this.escapeHtml(tooltip)}</title>
                  ${selectHalo}
                  <circle cx="${pt.x}" cy="${pt.y}" r="${outerR + 5}" fill="transparent" />
                  <circle cx="${pt.x}" cy="${pt.y}" r="${outerR}" fill="${ringFill}" stroke="${ringStroke}" stroke-width="2.2" />
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
        <g id="wmPointsGroup">${pointsHtml}</g>
      `;
    };

    app.renderWorldMapPointInspector = function () {
      const box = document.getElementById('wmPointInspectorBody');
      if (!box) return;
      const wm = this.getActiveWorldMap();
      if (!wm || !this.selectedWorldPointId) {
        box.innerHTML = `
          <div style="font-size:0.78rem; color:var(--text-muted); background:rgba(15,23,42,0.65); border:1px dashed #334155; padding:12px; border-radius:8px;">
            👆 Clique diretamente em qualquer <strong>ponto colorido</strong> no mapa ao lado (ou escolha na lista abaixo) para vincular um mapa já existente da <strong>Tabela de Mapas</strong>.
          </div>
        `;
        return;
      }

      const pt = (wm.pointsJson || []).find((p) => p.id === this.selectedWorldPointId);
      if (!pt) return;

      const available = this.worldMapAvailableMaps || [];
      const linkedMap = pt.gameMapId ? available.find((m) => m.id === Number(pt.gameMapId)) : null;

      // Verifica em quais pontos cada GameMap já foi usado neste continente
      const usedInPoints = new Map();
      for (const p of wm.pointsJson || []) {
        if (p.gameMapId) usedInPoints.set(Number(p.gameMapId), p.id);
      }

      const mapOptions = available
        .map((m) => {
          const usedBy = usedInPoints.get(m.id);
          const usedTag = usedBy && usedBy !== pt.id ? ' [Já vinculado]' : '';
          const draftTag = m.isActive ? '' : ' [Rascunho]';
          const selected = Number(pt.gameMapId) === m.id ? 'selected' : '';
          return `<option value="${m.id}" ${selected}>#${m.id} ${this.escapeHtml(m.namePtBr)} (Lv.${m.requiredLevel} • ${this.escapeHtml(m.mapTypeName)})${draftTag}${usedTag}</option>`;
        })
        .join('');

      box.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:8px;">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:6px; flex-wrap:wrap;">
            <strong style="color:#38bdf8; font-size:0.84rem;">${this.escapeHtml(pt.refLabel || pt.id)}</strong>
            <span style="font-size:0.70rem; color:var(--text-muted);">Coord: (${Math.round(pt.x)}, ${Math.round(pt.y)})</span>
          </div>
          <div style="font-size:0.75rem; padding:6px 8px; border-radius:6px; background:${linkedMap ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)'}; border:1px solid ${linkedMap ? '#22c55e' : '#f59e0b'}; color:${linkedMap ? '#86efac' : '#fde68a'};">
            ${
              linkedMap
                ? `✅ Vinculado ao Mapa <strong>#${linkedMap.id} ${this.escapeHtml(linkedMap.namePtBr)}</strong>`
                : '⚠️ Ponto ainda sem mapa vinculado'
            }
          </div>
          <div class="field" style="margin:0;">
            <label>Filtrar Mapas Existentes</label>
            <input type="text" id="wmMapSearchFilter" placeholder="🔍 Digite nome ou ID do mapa..." oninput="AdminApp.filterWorldMapAssignOptions()" style="font-size:0.78rem;" />
          </div>
          <div class="field" style="margin:0;">
            <label>Mapa da Tabela de Mapas *</label>
            <select id="wmAssignMapSelect" style="font-size:0.78rem;">
              <option value="">— Nenhum mapa vinculado —</option>
              ${mapOptions}
            </select>
          </div>
          <div class="field" style="margin:0;">
            <label>Rótulo no Mapa Geral (opcional — vazio usa o nome do mapa)</label>
            <input type="text" id="wmPointCustomLabelInput" value="${this.escapeHtml(pt.customLabel || '')}" placeholder="${linkedMap ? this.escapeHtml(linkedMap.namePtBr) : 'Ex: Cidade Inicial'}" style="font-size:0.78rem;" />
          </div>
          <label style="display:flex; align-items:center; gap:6px; font-size:0.76rem; cursor:pointer;">
            <input type="checkbox" id="wmPointIsCityInput" ${pt.isCity ? 'checked' : ''} />
            <span>🏰 Destacar pino como Cidade / Vila Principal</span>
          </label>
          <label style="display:flex; align-items:center; gap:6px; font-size:0.76rem; cursor:pointer; color:#fde047;">
            <input type="checkbox" ${this.worldMapAllowPointDrag ? 'checked' : ''} onchange="AdminApp.worldMapAllowPointDrag = this.checked;" />
            <span>✋ Permitir arrastar este pino livremente no mapa</span>
          </label>
          <div style="display:flex; gap:6px; margin-top:4px;">
            <button type="button" class="btn-success" style="flex:1; font-size:0.78rem; font-weight:700;" onclick="AdminApp.linkSelectedMapToWorldPoint()">
              🔗 Aplicar Vínculo
            </button>
            ${
              linkedMap
                ? `<button type="button" class="btn-danger" style="font-size:0.78rem;" onclick="AdminApp.unlinkWorldPointMap()">✂️ Desvincular</button>`
                : ''
            }
          </div>
        </div>
      `;
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
        return true;
      });

      document.querySelectorAll('.wm-pt-filter-btn').forEach((btn) => {
        btn.className = btn.dataset.filter === this.worldMapPointsFilter ? 'btn-primary wm-pt-filter-btn' : 'wm-pt-filter-btn';
      });

      if (pts.length === 0) {
        listEl.innerHTML = `<div style="font-size:0.75rem; color:var(--text-muted); padding:8px;">Nenhum ponto nesta categoria.</div>`;
        return;
      }

      listEl.innerHTML = pts
        .map((pt) => {
          const linked = pt.gameMapId ? mapById.get(Number(pt.gameMapId)) : null;
          const active = pt.id === this.selectedWorldPointId;
          const label = pt.customLabel?.trim() || (linked ? `#${linked.id} ${linked.namePtBr}` : 'Sem vínculo');
          return `
            <div onclick="AdminApp.selectWorldMapPoint('${this.escapeHtml(pt.id)}')"
              style="display:flex; justify-content:space-between; align-items:center; gap:6px; padding:6px 8px; border-radius:6px; cursor:pointer; font-size:0.75rem; background:${active ? 'rgba(56,189,248,0.18)' : 'rgba(15,23,42,0.7)'}; border:1px solid ${active ? '#38bdf8' : 'var(--border)'};">
              <div>
                <span style="color:${linked ? '#4ade80' : '#fbbf24'}; font-weight:700;">${pt.isCity ? '🏰' : '📍'} #${pt.refId}</span>
                <span style="color:#f8fafc;">${this.escapeHtml(label)}</span>
              </div>
              <span style="font-size:0.68rem; color:${linked ? '#86efac' : '#94a3b8'};">${linked ? 'Vinculado' : 'Livre'}</span>
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
      return {
        x: ((evt.clientX - rect.left) / Math.max(1, rect.width)) * cw,
        y: ((evt.clientY - rect.top) / Math.max(1, rect.height)) * ch,
        cw,
        ch,
      };
    };

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

    logoBox.addEventListener('pointerdown', (e) => {
      if (e.target === resizeHandle) return;
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

    svg.addEventListener('pointerdown', (e) => {
      const node = e.target.closest?.('.wm-point-node');
      if (!node) return;
      const ptId = node.getAttribute('data-point-id');
      if (!ptId) return;
      app.selectWorldMapPoint(ptId);
      if (app.worldMapAllowPointDrag) {
        const wm = app.getActiveWorldMap();
        const pt = (wm?.pointsJson || []).find((p) => p.id === ptId);
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
          svg.setPointerCapture?.(e.pointerId);
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
    section.style.padding = '14px';

    section.innerHTML = `
      <div class="panel" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; padding:12px 16px;">
        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
          <h3 style="margin:0;">🌍 Mapas Gerais dos Continentes</h3>
          <div id="wmContinentTabs" style="display:flex; gap:6px; flex-wrap:wrap;"></div>
        </div>
        <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap; font-size:0.78rem;">
          <label style="display:flex; align-items:center; gap:5px; cursor:pointer;">
            <input type="checkbox" id="wmToggleRoutesChk" checked onchange="AdminApp.toggleWorldMapLayer('showRoutesLayer', this.checked)" />
            <span>Camada: Linhas</span>
          </label>
          <label style="display:flex; align-items:center; gap:5px; cursor:pointer;">
            <input type="checkbox" id="wmTogglePointsChk" checked onchange="AdminApp.toggleWorldMapLayer('showPointsLayer', this.checked)" />
            <span>Camada: Pontos</span>
          </label>
          <label style="display:flex; align-items:center; gap:5px; cursor:pointer;">
            <input type="checkbox" id="wmToggleLogoChk" checked onchange="AdminApp.updateWorldMapLogoControls({ logoVisible: this.checked })" />
            <span>Camada: Logo</span>
          </label>
          <span id="wmDirtyBadge" style="display:none; background:rgba(245,158,11,0.2); border:1px solid #f59e0b; color:#fde047; padding:3px 8px; border-radius:999px; font-weight:700;">
            ● Alterações pendentes
          </span>
          <button type="button" class="btn-success" style="padding:8px 16px; font-weight:700;" onclick="AdminApp.saveActiveWorldMap()">
            💾 Salvar Mapa Geral
          </button>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:minmax(0, 1fr) 370px; gap:14px; align-items:start;">
        <!-- PALCO DO MAPA GERAL COM CAMADAS SEPARADAS + LOGO ARRASTÁVEL/REDIMENSIONÁVEL -->
        <div class="panel" style="padding:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; font-size:0.75rem; color:var(--text-muted); flex-wrap:wrap; gap:6px;">
            <span>🖱️ Clique em qualquer <strong>ponto</strong> para vincular a um mapa existente. Arraste o <strong>Logo Etheria Campus</strong> ou puxe o canto ↘ para ajustar o tamanho.</span>
            <span>Resolução base: 1264×848</span>
          </div>
          <div id="wmInteractiveStage" style="position:relative; width:100%; aspect-ratio:1264 / 848; background:#090d16; border-radius:10px; overflow:hidden; border:1px solid var(--border); user-select:none; touch-action:none;">
            <img id="wmBaseImage" src="" alt="Mapa Geral Base" draggable="false"
              style="position:absolute; inset:0; width:100%; height:100%; object-fit:fill; display:block; pointer-events:none;" />
            <svg id="wmVectorOverlaySvg" viewBox="0 0 1264 848"
              style="position:absolute; inset:0; width:100%; height:100%; display:block; z-index:2;"></svg>
            <div id="wmLogoDraggableBox"
              style="position:absolute; z-index:3; cursor:move; border:1.5px dashed rgba(56,189,248,0.65); border-radius:6px; transition:border-color 0.15s;"
              title="Arraste para mover o logo | Puxe o canto inferior direito para redimensionar">
              <img id="wmLogoImg" src="/assets/worldmap/etheria_campus_logo.png" alt="Logo Etheria Campus" draggable="false"
                style="width:100%; height:auto; display:block; pointer-events:none; filter:drop-shadow(0 3px 8px rgba(0,0,0,0.65));" />
              <div id="wmLogoResizeHandle"
                title="Arraste para ajustar o tamanho do logo"
                style="position:absolute; right:-7px; bottom:-7px; width:16px; height:16px; background:#38bdf8; border:2px solid #0f172a; border-radius:4px; cursor:nwse-resize; display:flex; align-items:center; justify-content:center; font-size:10px; color:#0f172a; font-weight:900;">
                ↘
              </div>
            </div>
          </div>
        </div>

        <!-- PAINEL LATERAL: AJUSTE DO LOGO + VÍNCULO DE MAPA NO PONTO SELECIONADO -->
        <aside style="display:flex; flex-direction:column; gap:12px;">
          <div class="panel" style="padding:12px;">
            <h4 style="margin:0 0 8px 0; color:#fde047; font-size:0.9rem;">🎨 Logo Etheria Campus (Fundo Transparente)</h4>
            <div style="display:flex; flex-direction:column; gap:8px; font-size:0.78rem;">
              <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                <input type="checkbox" id="wmLogoVisibleInput" checked onchange="AdminApp.updateWorldMapLogoControls({ logoVisible: this.checked })" />
                <span>Exibir logo neste Continente</span>
              </label>
              <div>
                <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                  <span>Tamanho (Largura px):</span>
                  <input type="number" id="wmLogoWidthInput" min="60" max="720" style="width:76px; padding:2px 6px; font-size:0.76rem;"
                    onchange="AdminApp.updateWorldMapLogoControls({ logoWidth: this.value })" />
                </div>
                <input type="range" id="wmLogoWidthSlider" min="80" max="620" value="270" style="width:100%;"
                  oninput="AdminApp.updateWorldMapLogoControls({ logoWidth: this.value })" />
              </div>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                <div class="field" style="margin:0;">
                  <label>Posição X (px)</label>
                  <input type="number" id="wmLogoXInput" onchange="AdminApp.updateWorldMapLogoControls({ logoX: this.value })" />
                </div>
                <div class="field" style="margin:0;">
                  <label>Posição Y (px)</label>
                  <input type="number" id="wmLogoYInput" onchange="AdminApp.updateWorldMapLogoControls({ logoY: this.value })" />
                </div>
              </div>
              <div style="display:flex; gap:6px;">
                <button type="button" style="flex:1; font-size:0.73rem;" onclick="AdminApp.resetWorldMapLogoPosition('TOP_LEFT')">↖ Sup. Esquerdo</button>
                <button type="button" style="flex:1; font-size:0.73rem;" onclick="AdminApp.resetWorldMapLogoPosition('TOP_CENTER')">⬆️ Topo Centro</button>
              </div>
            </div>
          </div>

          <div class="panel" style="padding:12px;">
            <h4 style="margin:0 0 8px 0; color:#38bdf8; font-size:0.9rem;">📍 Ponto Selecionado & Vínculo de Mapa</h4>
            <div id="wmPointInspectorBody"></div>
          </div>

          <div class="panel" style="padding:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <strong style="font-size:0.84rem; color:#86efac;">📋 Pontos do Continente</strong>
              <div style="display:flex; gap:4px;">
                <button type="button" class="btn-primary wm-pt-filter-btn" data-filter="ALL" style="font-size:0.68rem; padding:2px 6px;" onclick="AdminApp.setWorldMapPointsFilter('ALL')">Todos</button>
                <button type="button" class="wm-pt-filter-btn" data-filter="LINKED" style="font-size:0.68rem; padding:2px 6px;" onclick="AdminApp.setWorldMapPointsFilter('LINKED')">Vinculados</button>
                <button type="button" class="wm-pt-filter-btn" data-filter="UNLINKED" style="font-size:0.68rem; padding:2px 6px;" onclick="AdminApp.setWorldMapPointsFilter('UNLINKED')">Livres</button>
              </div>
            </div>
            <div id="wmPointsQuickList" style="display:flex; flex-direction:column; gap:5px; max-height:260px; overflow-y:auto;"></div>
          </div>
        </aside>
      </div>
    `;

    adminApp.appendChild(section);
  }
}

window.AdminWorldMapsTab = AdminWorldMapsTab;
