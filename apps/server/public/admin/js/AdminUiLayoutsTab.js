/**
 * @file apps/server/public/admin/js/AdminUiLayoutsTab.js
 * @description Studio Visual No-Code (WYSIWYG) para edição de HUDs, Modais, Chat e Interfaces
 *   do cliente (/play) nos 3 layouts: Mobile Vertical, Mobile Horizontal e Desktop.
 *   Permite:
 *   - Visualizar a interface completa exata no layout selecionado
 *   - Clicar e arrastar (Click & Drag) para mover qualquer HUD ou Modal
 *   - Arrastar alças de canto/borda para aumentar/diminuir (Escala, Largura e Altura)
 *   - Alterar cores de fundo, borda, texto, arredondamento e brilho visualmente
 *   - Trocar ícones de botões e sub-botões através de Galeria Visual ou Upload
 */

class AdminUiLayoutsTab {
  static attach(app) {
    app.uiLayoutTemplates = [];
    app.selectedStudioUiId = null;
    app.activeStudioViewport = 'MOBILE_PORTRAIT'; // 'MOBILE_PORTRAIT' | 'MOBILE_LANDSCAPE' | 'DESKTOP'
    app.activeStudioScene = 'EXPLORE_HUD'; // 'EXPLORE_HUD' | 'COMBAT_HUD' | 'MODAL'
    app.studioStageZoom = 0.78;
    app.studioSnapGrid = false;
    app.studioSyncStylesAllLayouts = true;
    app.dirtyStudioIds = new Set();
    app.showRawUiTable = false;
    app.iconPickerTarget = null; // { type: 'main'|'bg'|'sub', key: string }

    this.injectTabAndModalDom();

    app.loadUiLayoutTemplates = async function () {
      try {
        const list = await this.api('/api/admin/ui-layouts');
        this.uiLayoutTemplates = Array.isArray(list) ? list : [];
        if (!this.selectedStudioUiId && this.uiLayoutTemplates.length > 0) {
          const chatOrFirst =
            this.uiLayoutTemplates.find((t) => t.code === 'HUD_CHAT') || this.uiLayoutTemplates[0];
          this.selectedStudioUiId = chatOrFirst.id;
        }
        this.renderUiLayoutsCrudTable();
      } catch (err) {
        console.error('Erro ao carregar layouts de UI:', err);
      }
    };

    app.getSelectedStudioTemplate = function () {
      return (
        (this.uiLayoutTemplates || []).find((t) => Number(t.id) === Number(this.selectedStudioUiId)) ||
        (this.uiLayoutTemplates || [])[0] ||
        null
      );
    };

    app.getActiveViewportConfig = function (tpl) {
      if (!tpl) return {};
      if (this.activeStudioViewport === 'MOBILE_PORTRAIT') {
        if (!tpl.mobilePortrait) tpl.mobilePortrait = {};
        return tpl.mobilePortrait;
      }
      if (this.activeStudioViewport === 'MOBILE_LANDSCAPE') {
        if (!tpl.mobileLandscape) tpl.mobileLandscape = {};
        return tpl.mobileLandscape;
      }
      if (!tpl.desktop) tpl.desktop = {};
      return tpl.desktop;
    };

    app.markStudioDirty = function (id) {
      if (id) this.dirtyStudioIds.add(Number(id));
      const saveBtn = document.getElementById('btnStudioSaveAll');
      if (saveBtn) {
        const count = this.dirtyStudioIds.size;
        saveBtn.textContent =
          count > 0 ? `💾 Salvar Alterações (${count})` : '💾 Salvar Tudo no Servidor';
        saveBtn.style.background = count > 0 ? '#22c55e' : '';
      }
    };

    app.switchStudioViewport = function (mode) {
      this.activeStudioViewport = mode;
      if (mode === 'MOBILE_PORTRAIT') this.studioStageZoom = 0.78;
      else if (mode === 'MOBILE_LANDSCAPE') this.studioStageZoom = 0.85;
      else this.studioStageZoom = 0.62;
      this.renderUiStudioWorkspace();
    };

    app.switchStudioScene = function (scene) {
      this.activeStudioScene = scene;
      const current = this.getSelectedStudioTemplate();
      if (!current || (scene !== 'MODAL' && current.category !== scene)) {
        const firstInScene = (this.uiLayoutTemplates || []).find((t) =>
          scene === 'MODAL' ? t.category === 'MODAL' || t.category === 'INTERFACE' : t.category === scene
        );
        if (firstInScene) this.selectedStudioUiId = firstInScene.id;
      }
      this.renderUiStudioWorkspace();
    };

    app.setStudioZoom = function (zoomVal) {
      this.studioStageZoom = Number(zoomVal) || 0.78;
      this.applyStageLayoutsAndGizmo();
      ['0.55', '0.78', '1'].forEach((z) => {
        const b = document.getElementById(`btnStudioZoom_${z}`);
        if (b) b.className = Math.abs(this.studioStageZoom - Number(z)) < 0.05 ? 'btn-primary' : '';
      });
    };

    app.selectStudioUiElement = function (id) {
      const tpl = (this.uiLayoutTemplates || []).find((t) => Number(t.id) === Number(id));
      if (!tpl) return;
      this.selectedStudioUiId = tpl.id;

      const targetScene =
        tpl.category === 'COMBAT_HUD'
          ? 'COMBAT_HUD'
          : tpl.category === 'MODAL' || tpl.category === 'INTERFACE'
          ? 'MODAL'
          : 'EXPLORE_HUD';

      if (this.activeStudioScene !== targetScene) {
        this.activeStudioScene = targetScene;
      }
      this.renderUiStudioWorkspace();
    };

    app.toggleStudioElementVisibility = function (id, ev) {
      if (ev) ev.stopPropagation();
      const tpl = (this.uiLayoutTemplates || []).find((t) => Number(t.id) === Number(id));
      if (!tpl) return;
      const cfg = this.getActiveViewportConfig(tpl);
      cfg.visible = cfg.visible === false ? true : false;
      this.markStudioDirty(tpl.id);
      this.renderUiStudioWorkspace();
    };

    app.renderUiLayoutsCrudTable = function () {
      this.renderUiStudioWorkspace();
    };

    app.renderUiStudioWorkspace = function () {
      const root = document.getElementById('uiStudioMainContainer');
      if (!root) return;

      const selectedTpl = this.getSelectedStudioTemplate();
      const cfg = this.getActiveViewportConfig(selectedTpl);

      // Atualiza botões da barra superior
      ['MOBILE_PORTRAIT', 'MOBILE_LANDSCAPE', 'DESKTOP'].forEach((m) => {
        const b = document.getElementById(`btnStudioVp_${m}`);
        if (b) b.className = this.activeStudioViewport === m ? 'btn-primary' : '';
      });
      ['EXPLORE_HUD', 'COMBAT_HUD', 'MODAL'].forEach((s) => {
        const b = document.getElementById(`btnStudioScene_${s}`);
        if (b) b.className = this.activeStudioScene === s ? 'btn-primary' : '';
      });

      // 1. Renderiza Lista Lateral Esquerda de Camadas (HUDs / Modais)
      this.renderStudioLayersList();

      // 2. Reconstrói o Palco Visual Central com as HUDs Reais
      const stageScreen = document.getElementById('uiStudioStageScreen');
      if (stageScreen && window.AdminUiStageRenderer) {
        const dims = {
          MOBILE_PORTRAIT: { w: 390, h: 844, label: '📱 Mobile Vertical (390×844 px)' },
          MOBILE_LANDSCAPE: { w: 844, h: 390, label: '📲 Mobile Horizontal (844×390 px)' },
          DESKTOP: { w: 1280, h: 720, label: '🖥️ Desktop HD (1280×720 px)' },
        }[this.activeStudioViewport];

        stageScreen.style.width = `${dims.w}px`;
        stageScreen.style.height = `${dims.h}px`;

        const stageHeaderInfo = document.getElementById('uiStudioStageResLabel');
        if (stageHeaderInfo) {
          stageHeaderInfo.textContent = `${dims.label} • Clique em qualquer HUD para selecionar e arraste para mover ou redimensionar`;
        }

        const sceneHtml = window.AdminUiStageRenderer.buildStageSceneHtml(
          this.activeStudioScene,
          selectedTpl
        );

        stageScreen.innerHTML = `
          <!-- Guias de Alinhamento Central -->
          <div id="uiStudioGuideV" style="display:none; position:absolute; top:0; bottom:0; left:50%; width:1px; border-left:1.5px dashed #38bdf8; z-index:90; pointer-events:none;"></div>
          <div id="uiStudioGuideH" style="display:none; position:absolute; left:0; right:0; top:50%; height:1px; border-top:1.5px dashed #38bdf8; z-index:90; pointer-events:none;"></div>

          ${sceneHtml}

          <!-- Gizmo Visual de Seleção e Redimensionamento (8 Alças) -->
          <div id="uiStudioGizmoBox" style="display:none; position:absolute; border:2px solid #38bdf8; background:rgba(56,189,248,0.08); box-shadow:0 0 0 1px rgba(2,6,23,0.9), 0 0 16px rgba(56,189,248,0.45); pointer-events:none; z-index:95; border-radius:6px;">
            <div id="uiStudioGizmoBadge" style="position:absolute; top:-24px; left:0; background:#0284c7; color:#fff; font-size:0.65rem; font-weight:800; padding:2px 7px; border-radius:4px; white-space:nowrap; box-shadow:0 2px 6px rgba(0,0,0,0.8);"></div>
            <!-- 4 Cantos (Escala) -->
            <div data-gizmo-handle="nw" title="Arrastar para Escalar" style="position:absolute; top:-6px; left:-6px; width:12px; height:12px; background:#fde047; border:2px solid #020617; border-radius:50%; cursor:nwse-resize; pointer-events:auto;"></div>
            <div data-gizmo-handle="ne" title="Arrastar para Escalar" style="position:absolute; top:-6px; right:-6px; width:12px; height:12px; background:#fde047; border:2px solid #020617; border-radius:50%; cursor:nesw-resize; pointer-events:auto;"></div>
            <div data-gizmo-handle="sw" title="Arrastar para Escalar" style="position:absolute; bottom:-6px; left:-6px; width:12px; height:12px; background:#fde047; border:2px solid #020617; border-radius:50%; cursor:nesw-resize; pointer-events:auto;"></div>
            <div data-gizmo-handle="se" title="Arrastar para Escalar" style="position:absolute; bottom:-6px; right:-6px; width:12px; height:12px; background:#fde047; border:2px solid #020617; border-radius:50%; cursor:nwse-resize; pointer-events:auto;"></div>
            <!-- 4 Bordas (Largura / Altura) -->
            <div data-gizmo-handle="e" title="Arrastar Largura (px)" style="position:absolute; top:50%; right:-6px; transform:translateY(-50%); width:10px; height:22px; background:#38bdf8; border:1.5px solid #020617; border-radius:4px; cursor:ew-resize; pointer-events:auto;"></div>
            <div data-gizmo-handle="w" title="Arrastar Largura (px)" style="position:absolute; top:50%; left:-6px; transform:translateY(-50%); width:10px; height:22px; background:#38bdf8; border:1.5px solid #020617; border-radius:4px; cursor:ew-resize; pointer-events:auto;"></div>
            <div data-gizmo-handle="s" title="Arrastar Altura (px)" style="position:absolute; bottom:-6px; left:50%; transform:translateX(-50%); width:22px; height:10px; background:#38bdf8; border:1.5px solid #020617; border-radius:4px; cursor:ns-resize; pointer-events:auto;"></div>
            <div data-gizmo-handle="n" title="Arrastar Altura (px)" style="position:absolute; top:-6px; left:50%; transform:translateX(-50%); width:22px; height:10px; background:#38bdf8; border:1.5px solid #020617; border-radius:4px; cursor:ns-resize; pointer-events:auto;"></div>
          </div>
        `;

        window.AdminUiStageRenderer.attachStageInteractions(this);
      }

      // 3. Renderiza Inspetor Visual da Direita e aplica transformações no palco
      this.renderStudioInspectorPanel(selectedTpl, cfg);
      this.applyStageLayoutsAndGizmo();
    };

    app.renderStudioLayersList = function () {
      const listEl = document.getElementById('uiStudioLayersList');
      if (!listEl) return;

      const all = Array.isArray(this.uiLayoutTemplates) ? this.uiLayoutTemplates : [];
      const catGroups = [
        { key: 'EXPLORE_HUD', title: '🗺️ HUDs de Exploração & Chat', scene: 'EXPLORE_HUD' },
        { key: 'COMBAT_HUD', title: '⚔️ HUDs de Batalha (Véu)', scene: 'COMBAT_HUD' },
        { key: 'MODAL', title: '🪟 Modais & Janelas', scene: 'MODAL' },
        { key: 'INTERFACE', title: '🛠️ Interfaces Especiais', scene: 'MODAL' },
      ];

      listEl.innerHTML = catGroups
        .map((g) => {
          const items = all.filter((t) => t.category === g.key);
          if (items.length === 0) return '';
          const rows = items
            .map((t) => {
              const isSel = Number(t.id) === Number(this.selectedStudioUiId);
              const cfg = this.getActiveViewportConfig(t);
              const isVis = cfg.visible !== false;
              const isChat = t.code === 'HUD_CHAT';
              return `
                <div onclick="AdminApp.selectStudioUiElement(${t.id})" style="display:flex; align-items:center; justify-content:space-between; gap:6px; padding:7px 8px; border-radius:7px; cursor:pointer; background:${isSel ? 'rgba(56,189,248,0.22)' : 'rgba(15,23,42,0.65)'}; border:1px solid ${isSel ? '#38bdf8' : isChat ? 'rgba(234,179,8,0.5)' : '#1e293b'}; transition:0.12s;">
                  <div style="min-width:0; flex:1;">
                    <div style="font-size:0.76rem; font-weight:${isSel ? '800' : '600'}; color:${isSel ? '#fde047' : '#f8fafc'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                      ${isChat ? '💬 ' : ''}${this.escapeHtml(t.namePtBr)}
                    </div>
                    <div style="font-size:0.65rem; color:#94a3b8; font-family:monospace;">
                      ${this.escapeHtml(t.domSelector)} • ${(cfg.scale || 1).toFixed(2)}x
                    </div>
                  </div>
                  <button type="button" onclick="AdminApp.toggleStudioElementVisibility(${t.id}, event)" title="${isVis ? 'Visível neste layout (Clique p/ ocultar)' : 'Oculto neste layout (Clique p/ exibir)'}" style="padding:3px 6px; font-size:0.74rem; background:${isVis ? 'rgba(34,197,94,0.18)' : 'rgba(244,63,94,0.2)'}; border:1px solid ${isVis ? '#22c55e' : '#f43f5e'}; border-radius:6px;">
                    ${isVis ? '👁️' : '🚫'}
                  </button>
                </div>
              `;
            })
            .join('');

          return `
            <div style="margin-bottom:10px;">
              <div style="font-size:0.7rem; font-weight:800; color:#38bdf8; text-transform:uppercase; margin-bottom:5px; padding-left:2px;">
                ${g.title} (${items.length})
              </div>
              <div style="display:flex; flex-direction:column; gap:4px;">${rows}</div>
            </div>
          `;
        })
        .join('');
    };

    app.applyStageLayoutsAndGizmo = function () {
      const stageScreen = document.getElementById('uiStudioStageScreen');
      const stageWrapper = document.getElementById('uiStudioStageScaleWrapper');
      if (!stageScreen) return;

      const zoom = this.studioStageZoom || 0.78;
      const dims = {
        MOBILE_PORTRAIT: { w: 390, h: 844 },
        MOBILE_LANDSCAPE: { w: 844, h: 390 },
        DESKTOP: { w: 1280, h: 720 },
      }[this.activeStudioViewport];

      stageScreen.style.transform = `scale(${zoom})`;
      stageScreen.style.transformOrigin = 'top left';
      if (stageWrapper) {
        stageWrapper.style.width = `${Math.round(dims.w * zoom)}px`;
        stageWrapper.style.height = `${Math.round(dims.h * zoom)}px`;
      }

      if (window.PlayUiLayoutApplier) {
        window.PlayUiLayoutApplier.templates = this.uiLayoutTemplates || [];
        window.PlayUiLayoutApplier.applyAll(stageScreen, this.activeStudioViewport);
      }

      // Posiciona o Gizmo sobre o elemento selecionado
      const gizmo = document.getElementById('uiStudioGizmoBox');
      const badge = document.getElementById('uiStudioGizmoBadge');
      const selectedTpl = this.getSelectedStudioTemplate();
      if (!gizmo || !selectedTpl) return;

      const targetEl = stageScreen.querySelector(`[data-ui-code="${selectedTpl.code}"]`);
      if (!targetEl) {
        gizmo.style.display = 'none';
        return;
      }

      const stageRect = stageScreen.getBoundingClientRect();
      const elRect = targetEl.getBoundingClientRect();

      const leftPx = (elRect.left - stageRect.left) / zoom;
      const topPx = (elRect.top - stageRect.top) / zoom;
      const widthPx = elRect.width / zoom;
      const heightPx = elRect.height / zoom;

      gizmo.style.display = 'block';
      gizmo.style.left = `${Math.round(leftPx - 2)}px`;
      gizmo.style.top = `${Math.round(topPx - 2)}px`;
      gizmo.style.width = `${Math.max(24, Math.round(widthPx + 4))}px`;
      gizmo.style.height = `${Math.max(24, Math.round(heightPx + 4))}px`;

      const cfg = this.getActiveViewportConfig(selectedTpl);
      if (badge) {
        badge.textContent = `${selectedTpl.namePtBr.slice(0, 26)} (${cfg.offsetX >= 0 ? '+' : ''}${cfg.offsetX || 0}px, ${cfg.offsetY >= 0 ? '+' : ''}${cfg.offsetY || 0}px | ${(cfg.scale || 1).toFixed(2)}x)`;
      }
    };

    app.syncInspectorInputsFromConfig = function (cfg) {
      if (!cfg) return;
      const setV = (id, v) => {
        const el = document.getElementById(id);
        if (el) el.value = v ?? '';
      };
      setV('inspOffsetX', cfg.offsetX || 0);
      setV('inspOffsetXNum', cfg.offsetX || 0);
      setV('inspOffsetY', cfg.offsetY || 0);
      setV('inspOffsetYNum', cfg.offsetY || 0);
      setV('inspScale', cfg.scale || 1.0);
      setV('inspScaleNum', cfg.scale || 1.0);
      setV('inspWidthPx', cfg.widthPx || '');
      setV('inspHeightPx', cfg.heightPx || '');
      setV('inspAnchorX', cfg.anchorX || 'DEFAULT');
      setV('inspAnchorY', cfg.anchorY || 'DEFAULT');
      setV('inspOpacity', cfg.opacity ?? 1.0);
      setV('inspBorderRadius', cfg.borderRadiusPx ?? '');
    };

    app.onInspectorFieldChange = function (field, rawValue, isStyleField = false) {
      const tpl = this.getSelectedStudioTemplate();
      if (!tpl) return;

      const applyToCfg = (c) => {
        if (field === 'offsetX' || field === 'offsetY') {
          c[field] = Math.round(Number(rawValue || 0));
        } else if (field === 'scale') {
          c.scale = Math.min(2.5, Math.max(0.3, Number(Number(rawValue || 1).toFixed(2))));
        } else if (field === 'opacity') {
          c.opacity = Math.min(1, Math.max(0.1, Number(Number(rawValue || 1).toFixed(2))));
        } else if (field === 'widthPx' || field === 'heightPx' || field === 'borderRadiusPx') {
          c[field] = rawValue !== '' && Number(rawValue) >= 0 ? Math.round(Number(rawValue)) : null;
        } else if (field === 'visible') {
          c.visible = rawValue !== 'false' && rawValue !== false;
        } else {
          c[field] = rawValue || null;
        }
      };

      const activeCfg = this.getActiveViewportConfig(tpl);
      applyToCfg(activeCfg);

      if (isStyleField && this.studioSyncStylesAllLayouts) {
        ['mobilePortrait', 'mobileLandscape', 'desktop'].forEach((k) => {
          if (!tpl[k]) tpl[k] = {};
          applyToCfg(tpl[k]);
        });
      }

      this.markStudioDirty(tpl.id);
      this.syncInspectorInputsFromConfig(activeCfg);
      this.applyStageLayoutsAndGizmo();
    };

    app.quickAlignSelectedUi = function (action) {
      const tpl = this.getSelectedStudioTemplate();
      if (!tpl) return;
      const cfg = this.getActiveViewportConfig(tpl);

      if (action === 'RESET') {
        cfg.anchorX = 'DEFAULT';
        cfg.anchorY = 'DEFAULT';
        cfg.offsetX = 0;
        cfg.offsetY = 0;
        cfg.scale = 1.0;
        cfg.widthPx = null;
        cfg.heightPx = null;
      } else if (action === 'LEFT') {
        cfg.anchorX = 'LEFT';
        cfg.offsetX = 0;
      } else if (action === 'CENTER_X') {
        cfg.anchorX = 'CENTER';
        cfg.offsetX = 0;
      } else if (action === 'RIGHT') {
        cfg.anchorX = 'RIGHT';
        cfg.offsetX = 0;
      } else if (action === 'TOP') {
        cfg.anchorY = 'TOP';
        cfg.offsetY = 0;
      } else if (action === 'CENTER_Y') {
        cfg.anchorY = 'CENTER';
        cfg.offsetY = 0;
      } else if (action === 'BOTTOM') {
        cfg.anchorY = 'BOTTOM';
        cfg.offsetY = 0;
      }

      this.markStudioDirty(tpl.id);
      this.renderUiStudioWorkspace();
    };

    app.openStudioIconPicker = function (type, subKey = '') {
      this.iconPickerTarget = { type, key: subKey };
      const tpl = this.getSelectedStudioTemplate();
      const cfg = this.getActiveViewportConfig(tpl);
      let currentUrl = '';
      if (type === 'main') currentUrl = cfg.iconUrl || '';
      else if (type === 'bg') currentUrl = cfg.bgImageUrl || '';
      else if (type === 'sub' && cfg.subIcons) currentUrl = cfg.subIcons[subKey] || '';

      const urlInput = document.getElementById('uiIconPickerCustomUrl');
      if (urlInput) urlInput.value = currentUrl;

      const grid = document.getElementById('uiIconPickerGalleryGrid');
      if (grid && window.AdminUiStageRenderer) {
        const builtIn = window.AdminUiStageRenderer.getBuiltInHudAssets();
        const equipIcons = (this.equipmentTemplates || []).slice(0, 18).map((e) => ({
          label: e.namePtBr,
          url: e.iconUrl,
        }));
        const itemIcons = (this.itemTemplates || []).slice(0, 18).map((i) => ({
          label: i.namePtBr,
          url: i.iconUrl,
        }));
        const allIcons = [...builtIn, ...equipIcons, ...itemIcons].filter((x) => x.url);

        grid.innerHTML = allIcons
          .map(
            (ic) => `
            <div onclick="AdminApp.selectIconFromPicker('${this.escapeHtml(ic.url)}')" style="background:#020617; border:1px solid #334155; border-radius:8px; padding:8px; display:flex; flex-direction:column; align-items:center; gap:5px; cursor:pointer; transition:0.12s;" onmouseover="this.style.borderColor='#38bdf8'" onmouseout="this.style.borderColor='#334155'">
              <img src="${this.escapeHtml(ic.url)}" style="width:42px; height:42px; object-fit:contain;" />
              <span style="font-size:0.65rem; color:#cbd5e1; text-align:center; line-height:1.1; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${this.escapeHtml(ic.label)}</span>
            </div>
          `
          )
          .join('');
      }

      this.openModal('uiIconPickerModal');
    };

    app.selectIconFromPicker = function (url) {
      const tpl = this.getSelectedStudioTemplate();
      if (!tpl || !this.iconPickerTarget) return;

      const applyIcon = (c) => {
        if (this.iconPickerTarget.type === 'main') {
          c.iconUrl = url || null;
        } else if (this.iconPickerTarget.type === 'bg') {
          c.bgImageUrl = url || null;
        } else if (this.iconPickerTarget.type === 'sub') {
          if (!c.subIcons) c.subIcons = {};
          if (url) c.subIcons[this.iconPickerTarget.key] = url;
          else delete c.subIcons[this.iconPickerTarget.key];
        }
      };

      applyIcon(this.getActiveViewportConfig(tpl));
      if (this.studioSyncStylesAllLayouts) {
        ['mobilePortrait', 'mobileLandscape', 'desktop'].forEach((k) => {
          if (!tpl[k]) tpl[k] = {};
          applyIcon(tpl[k]);
        });
      }

      this.markStudioDirty(tpl.id);
      this.closeModal('uiIconPickerModal');
      this.renderUiStudioWorkspace();
    };

    app.handleLocalIconUpload = function (fileInput) {
      const file = fileInput?.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = String(e.target?.result || '');
        if (dataUrl) {
          this.selectIconFromPicker(dataUrl);
        }
      };
      reader.readAsDataURL(file);
    };

    app.renderStudioInspectorPanel = function (tpl, cfg) {
      const box = document.getElementById('uiStudioInspectorBody');
      if (!box) return;
      if (!tpl) {
        box.innerHTML = `<div style="color:var(--text-muted); padding:16px; text-align:center;">Selecione uma HUD ou Modal no palco ou na lista à esquerda.</div>`;
        return;
      }

      const subDefs = window.AdminUiStageRenderer
        ? window.AdminUiStageRenderer.getSubIconsDefinition(tpl.code)
        : [];
      const subIconsMap = cfg.subIcons || {};

      const subButtonsHtml =
        subDefs.length > 0
          ? `
            <div style="margin-top:8px; display:flex; flex-direction:column; gap:6px;">
              <div style="font-size:0.7rem; color:#fde047; font-weight:700;">🔘 Ícones Individuais dos Botões desta HUD:</div>
              ${subDefs
                .map((sd) => {
                  const curSrc = subIconsMap[sd.key] || sd.def;
                  return `
                    <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; background:#020617; border:1px solid #1e293b; border-radius:7px; padding:5px 8px;">
                      <div style="display:flex; align-items:center; gap:7px; min-width:0;">
                        <img src="${this.escapeHtml(curSrc)}" style="width:28px; height:28px; object-fit:contain; background:#0f172a; border-radius:5px; padding:2px; border:1px solid #334155;" />
                        <span style="font-size:0.72rem; color:#e2e8f0; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${sd.label}</span>
                      </div>
                      <button type="button" class="btn-primary" style="padding:4px 8px; font-size:0.68rem;" onclick="AdminApp.openStudioIconPicker('sub', '${sd.key}')">🖼️ Trocar</button>
                    </div>
                  `;
                })
                .join('')}
            </div>
          `
          : '';

      box.innerHTML = `
        <div style="background:rgba(56,189,248,0.1); border:1px solid rgba(56,189,248,0.35); border-radius:8px; padding:8px 10px;">
          <div style="font-size:0.84rem; font-weight:800; color:#f8fafc;">${this.escapeHtml(tpl.namePtBr)}</div>
          <div style="font-size:0.68rem; color:#38bdf8; font-family:monospace; margin-top:2px;">${this.escapeHtml(tpl.code)} • ${this.escapeHtml(tpl.domSelector)}</div>
        </div>

        <!-- 1. Alinhamento Rápido e Reset -->
        <div>
          <label style="font-size:0.7rem; color:#94a3b8; font-weight:700; display:block; margin-bottom:4px;">⚡ Alinhamento Rápido na Tela:</label>
          <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:4px;">
            <button type="button" onclick="AdminApp.quickAlignSelectedUi('LEFT')" style="padding:5px; font-size:0.7rem;" title="Colar na Esquerda">⬅️ Esq</button>
            <button type="button" onclick="AdminApp.quickAlignSelectedUi('CENTER_X')" style="padding:5px; font-size:0.7rem;" title="Centralizar Horizontal">↔️ Meio</button>
            <button type="button" onclick="AdminApp.quickAlignSelectedUi('RIGHT')" style="padding:5px; font-size:0.7rem;" title="Colar na Direita">➡️ Dir</button>
            <button type="button" onclick="AdminApp.quickAlignSelectedUi('RESET')" class="btn-danger" style="padding:5px; font-size:0.7rem;" title="Resetar Posição e Tamanho">⟲ Reset</button>
          </div>
        </div>

        <!-- 2. Sliders de Posição (Click & Drag ou Ajuste Fino) -->
        <div style="background:#020617; border:1px solid #1e293b; border-radius:8px; padding:9px; display:flex; flex-direction:column; gap:8px;">
          <div style="font-size:0.72rem; font-weight:800; color:#38bdf8;">📐 Posição & Escala (${this.activeStudioViewport})</div>

          <div>
            <div style="display:flex; justify-content:space-between; font-size:0.7rem; color:#cbd5e1;">
              <span>↔️ Posição X (px)</span>
              <input type="number" id="inspOffsetXNum" value="${cfg.offsetX || 0}" oninput="AdminApp.onInspectorFieldChange('offsetX', this.value)" style="width:68px; padding:2px 5px; font-size:0.72rem; text-align:right;" />
            </div>
            <input type="range" id="inspOffsetX" min="-600" max="600" step="1" value="${cfg.offsetX || 0}" oninput="AdminApp.onInspectorFieldChange('offsetX', this.value)" style="width:100%; accent-color:#38bdf8;" />
          </div>

          <div>
            <div style="display:flex; justify-content:space-between; font-size:0.7rem; color:#cbd5e1;">
              <span>↕️ Posição Y (px)</span>
              <input type="number" id="inspOffsetYNum" value="${cfg.offsetY || 0}" oninput="AdminApp.onInspectorFieldChange('offsetY', this.value)" style="width:68px; padding:2px 5px; font-size:0.72rem; text-align:right;" />
            </div>
            <input type="range" id="inspOffsetY" min="-600" max="600" step="1" value="${cfg.offsetY || 0}" oninput="AdminApp.onInspectorFieldChange('offsetY', this.value)" style="width:100%; accent-color:#38bdf8;" />
          </div>

          <div>
            <div style="display:flex; justify-content:space-between; font-size:0.7rem; color:#fde047;">
              <span>🔍 Tamanho / Escala (0.3x a 2.5x)</span>
              <input type="number" id="inspScaleNum" step="0.05" min="0.3" max="2.5" value="${cfg.scale || 1.0}" oninput="AdminApp.onInspectorFieldChange('scale', this.value)" style="width:68px; padding:2px 5px; font-size:0.72rem; text-align:right;" />
            </div>
            <input type="range" id="inspScale" min="0.3" max="2.5" step="0.02" value="${cfg.scale || 1.0}" oninput="AdminApp.onInspectorFieldChange('scale', this.value)" style="width:100%; accent-color:#eab308;" />
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
            <div class="field">
              <label style="font-size:0.68rem;">📏 Largura (px, vazio=Auto)</label>
              <input type="number" id="inspWidthPx" placeholder="Auto" value="${cfg.widthPx || ''}" oninput="AdminApp.onInspectorFieldChange('widthPx', this.value)" style="padding:4px 6px; font-size:0.74rem;" />
            </div>
            <div class="field">
              <label style="font-size:0.68rem;">📐 Altura (px, vazio=Auto)</label>
              <input type="number" id="inspHeightPx" placeholder="Auto" value="${cfg.heightPx || ''}" oninput="AdminApp.onInspectorFieldChange('heightPx', this.value)" style="padding:4px 6px; font-size:0.74rem;" />
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px;">
            <div class="field">
              <label style="font-size:0.66rem;">Âncora X</label>
              <select id="inspAnchorX" onchange="AdminApp.onInspectorFieldChange('anchorX', this.value)" style="padding:4px; font-size:0.7rem;">
                <option value="DEFAULT" ${(cfg.anchorX || 'DEFAULT') === 'DEFAULT' ? 'selected' : ''}>Padrão</option>
                <option value="LEFT" ${cfg.anchorX === 'LEFT' ? 'selected' : ''}>Esquerda</option>
                <option value="CENTER" ${cfg.anchorX === 'CENTER' ? 'selected' : ''}>Centro</option>
                <option value="RIGHT" ${cfg.anchorX === 'RIGHT' ? 'selected' : ''}>Direita</option>
              </select>
            </div>
            <div class="field">
              <label style="font-size:0.66rem;">Âncora Y</label>
              <select id="inspAnchorY" onchange="AdminApp.onInspectorFieldChange('anchorY', this.value)" style="padding:4px; font-size:0.7rem;">
                <option value="DEFAULT" ${(cfg.anchorY || 'DEFAULT') === 'DEFAULT' ? 'selected' : ''}>Padrão</option>
                <option value="TOP" ${cfg.anchorY === 'TOP' ? 'selected' : ''}>Topo</option>
                <option value="CENTER" ${cfg.anchorY === 'CENTER' ? 'selected' : ''}>Centro</option>
                <option value="BOTTOM" ${cfg.anchorY === 'BOTTOM' ? 'selected' : ''}>Base</option>
              </select>
            </div>
            <div class="field">
              <label style="font-size:0.66rem;">Opacidade</label>
              <input type="number" id="inspOpacity" min="0.1" max="1" step="0.05" value="${cfg.opacity ?? 1}" oninput="AdminApp.onInspectorFieldChange('opacity', this.value)" style="padding:4px; font-size:0.72rem;" />
            </div>
          </div>
        </div>

        <!-- 3. Cores, Bordas e Estilo Visual -->
        <div style="background:#020617; border:1px solid #1e293b; border-radius:8px; padding:9px; display:flex; flex-direction:column; gap:7px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:0.72rem; font-weight:800; color:#c084fc;">🎨 Cores, Fundo & Bordas</span>
            <label style="font-size:0.65rem; color:#94a3b8; display:flex; align-items:center; gap:4px; cursor:pointer;">
              <input type="checkbox" ${this.studioSyncStylesAllLayouts ? 'checked' : ''} onchange="AdminApp.studioSyncStylesAllLayouts = this.checked" />
              Aplicar nos 3 Layouts
            </label>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
            <div style="background:#0f172a; padding:5px 7px; border-radius:6px; border:1px solid #334155; display:flex; align-items:center; justify-content:space-between;">
              <span style="font-size:0.68rem; color:#cbd5e1;">Fundo</span>
              <div style="display:flex; align-items:center; gap:4px;">
                <input type="color" value="${cfg.bgColor && cfg.bgColor.startsWith('#') ? cfg.bgColor : '#0f172a'}" oninput="AdminApp.onInspectorFieldChange('bgColor', this.value, true)" style="width:26px; height:22px; border:none; background:none; cursor:pointer;" />
                <button type="button" onclick="AdminApp.onInspectorFieldChange('bgColor', null, true); AdminApp.renderUiStudioWorkspace();" style="padding:1px 4px; font-size:0.6rem;" title="Restaurar Cor Original">✕</button>
              </div>
            </div>
            <div style="background:#0f172a; padding:5px 7px; border-radius:6px; border:1px solid #334155; display:flex; align-items:center; justify-content:space-between;">
              <span style="font-size:0.68rem; color:#cbd5e1;">Borda</span>
              <div style="display:flex; align-items:center; gap:4px;">
                <input type="color" value="${cfg.borderColor && cfg.borderColor.startsWith('#') ? cfg.borderColor : '#eab308'}" oninput="AdminApp.onInspectorFieldChange('borderColor', this.value, true)" style="width:26px; height:22px; border:none; background:none; cursor:pointer;" />
                <button type="button" onclick="AdminApp.onInspectorFieldChange('borderColor', null, true); AdminApp.renderUiStudioWorkspace();" style="padding:1px 4px; font-size:0.6rem;" title="Restaurar Borda Original">✕</button>
              </div>
            </div>
            <div style="background:#0f172a; padding:5px 7px; border-radius:6px; border:1px solid #334155; display:flex; align-items:center; justify-content:space-between;">
              <span style="font-size:0.68rem; color:#cbd5e1;">Texto</span>
              <div style="display:flex; align-items:center; gap:4px;">
                <input type="color" value="${cfg.textColor && cfg.textColor.startsWith('#') ? cfg.textColor : '#f8fafc'}" oninput="AdminApp.onInspectorFieldChange('textColor', this.value, true)" style="width:26px; height:22px; border:none; background:none; cursor:pointer;" />
                <button type="button" onclick="AdminApp.onInspectorFieldChange('textColor', null, true); AdminApp.renderUiStudioWorkspace();" style="padding:1px 4px; font-size:0.6rem;">✕</button>
              </div>
            </div>
            <div style="background:#0f172a; padding:5px 7px; border-radius:6px; border:1px solid #334155; display:flex; align-items:center; justify-content:space-between;">
              <span style="font-size:0.68rem; color:#cbd5e1;">Brilho</span>
              <div style="display:flex; align-items:center; gap:4px;">
                <input type="color" value="${cfg.accentColor && cfg.accentColor.startsWith('#') ? cfg.accentColor : '#38bdf8'}" oninput="AdminApp.onInspectorFieldChange('accentColor', this.value, true)" style="width:26px; height:22px; border:none; background:none; cursor:pointer;" />
                <button type="button" onclick="AdminApp.onInspectorFieldChange('accentColor', null, true); AdminApp.renderUiStudioWorkspace();" style="padding:1px 4px; font-size:0.6rem;">✕</button>
              </div>
            </div>
          </div>

          <div class="field">
            <label style="font-size:0.68rem;">⭕ Arredondamento da Borda (px, vazio=Padrão)</label>
            <input type="number" id="inspBorderRadius" placeholder="Padrão" min="0" max="60" value="${cfg.borderRadiusPx ?? ''}" oninput="AdminApp.onInspectorFieldChange('borderRadiusPx', this.value, true)" style="padding:4px 6px; font-size:0.74rem;" />
          </div>
        </div>

        <!-- 4. Troca Visual de Ícones e Imagens -->
        <div style="background:#020617; border:1px solid #1e293b; border-radius:8px; padding:9px; display:flex; flex-direction:column; gap:7px;">
          <div style="font-size:0.72rem; font-weight:800; color:#86efac;">🖼️ Ícones de Botões & Texturas</div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
            <button type="button" class="btn-primary" style="padding:6px; font-size:0.71rem;" onclick="AdminApp.openStudioIconPicker('main')">
              🖼️ Trocar Ícone Principal
            </button>
            <button type="button" style="padding:6px; font-size:0.71rem;" onclick="AdminApp.openStudioIconPicker('bg')">
              🌄 Textura de Fundo
            </button>
          </div>
          ${subButtonsHtml}
        </div>
      `;
    };

    app.saveAllStudioUiLayouts = async function () {
      try {
        const items = (this.uiLayoutTemplates || []).map((t) => ({
          id: t.id,
          mobilePortrait: t.mobilePortrait,
          mobileLandscape: t.mobileLandscape,
          desktop: t.desktop,
          isActive: t.isActive !== false,
        }));
        const updated = await this.api('/api/admin/ui-layouts/bulk', {
          method: 'PUT',
          body: JSON.stringify({ items }),
        });
        this.uiLayoutTemplates = Array.isArray(updated) ? updated : [];
        this.dirtyStudioIds.clear();
        this.markStudioDirty(null);
        this.renderUiStudioWorkspace();
        alert('✅ Todas as posições, escalas, cores e ícones foram salvos com sucesso no servidor!');
      } catch (err) {
        alert(`Erro ao salvar alterações: ${err.message}`);
      }
    };

    app.copyCurrentLayoutToOthers = function () {
      const tpl = this.getSelectedStudioTemplate();
      if (!tpl) return;
      const srcCfg = JSON.parse(JSON.stringify(this.getActiveViewportConfig(tpl)));
      if (
        !confirm(
          `Copiar a posição, tamanho, cores e ícones de "${tpl.namePtBr}" do layout atual (${this.activeStudioViewport}) para os outros 2 layouts?`
        )
      ) {
        return;
      }
      tpl.mobilePortrait = JSON.parse(JSON.stringify(srcCfg));
      tpl.mobileLandscape = JSON.parse(JSON.stringify(srcCfg));
      tpl.desktop = JSON.parse(JSON.stringify(srcCfg));
      this.markStudioDirty(tpl.id);
      this.renderUiStudioWorkspace();
    };

    app.resetDefaultUiLayouts = async function () {
      if (
        !confirm(
          'Deseja restaurar todas as 25 HUDs, Chat, Modais e Interfaces para as posições, cores e ícones originais de fábrica nos 3 layouts?'
        )
      ) {
        return;
      }
      try {
        const list = await this.api('/api/admin/ui-layouts/reset-defaults', { method: 'POST', body: '{}' });
        this.uiLayoutTemplates = Array.isArray(list) ? list : [];
        this.dirtyStudioIds.clear();
        this.markStudioDirty(null);
        this.renderUiStudioWorkspace();
      } catch (err) {
        alert(`Erro ao restaurar padrões: ${err.message}`);
      }
    };
  }

  static injectTabAndModalDom() {
    const adminApp = document.getElementById('adminApp');
    if (adminApp && !document.getElementById('tabUiLayouts')) {
      const panel = document.createElement('div');
      panel.id = 'tabUiLayouts';
      panel.style.cssText =
        'display:none; padding:10px 14px; max-width:1680px; margin:0 auto; width:100%; gap:10px; flex-direction:column; box-sizing:border-box;';
      panel.innerHTML = `
        <!-- Barra Superior do Studio Visual No-Code -->
        <div class="panel" style="padding:10px 14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <strong style="color:#38bdf8; font-size:0.95rem;">🎨 Studio Visual No-Code:</strong>
            <div style="display:flex; gap:4px; background:#020617; padding:3px; border-radius:8px; border:1px solid #334155;">
              <button type="button" id="btnStudioVp_MOBILE_PORTRAIT" class="btn-primary" onclick="AdminApp.switchStudioViewport('MOBILE_PORTRAIT')" style="padding:5px 10px; font-size:0.75rem;">📱 Mobile Vertical</button>
              <button type="button" id="btnStudioVp_MOBILE_LANDSCAPE" onclick="AdminApp.switchStudioViewport('MOBILE_LANDSCAPE')" style="padding:5px 10px; font-size:0.75rem;">📲 Mobile Horizontal</button>
              <button type="button" id="btnStudioVp_DESKTOP" onclick="AdminApp.switchStudioViewport('DESKTOP')" style="padding:5px 10px; font-size:0.75rem;">🖥️ Desktop</button>
            </div>

            <div style="display:flex; gap:4px; background:#020617; padding:3px; border-radius:8px; border:1px solid #334155;">
              <button type="button" id="btnStudioScene_EXPLORE_HUD" class="btn-primary" onclick="AdminApp.switchStudioScene('EXPLORE_HUD')" style="padding:5px 10px; font-size:0.75rem;">🗺️ Exploração + Chat</button>
              <button type="button" id="btnStudioScene_COMBAT_HUD" onclick="AdminApp.switchStudioScene('COMBAT_HUD')" style="padding:5px 10px; font-size:0.75rem;">⚔️ Batalha no Véu</button>
              <button type="button" id="btnStudioScene_MODAL" onclick="AdminApp.switchStudioScene('MODAL')" style="padding:5px 10px; font-size:0.75rem;">🪟 Modais & Janelas</button>
            </div>
          </div>

          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
            <label style="font-size:0.72rem; color:#cbd5e1; display:flex; align-items:center; gap:4px; cursor:pointer; background:#020617; padding:5px 8px; border-radius:6px; border:1px solid #334155;">
              <input type="checkbox" onchange="AdminApp.studioSnapGrid = this.checked" />
              🧲 Grade 5px
            </label>
            <button type="button" onclick="AdminApp.copyCurrentLayoutToOthers()" style="padding:6px 10px; font-size:0.74rem;" title="Copiar posição/estilo do elemento atual para os outros 2 layouts">
              📋 Copiar p/ 3 Layouts
            </button>
            <button type="button" onclick="AdminApp.resetDefaultUiLayouts()" style="padding:6px 10px; font-size:0.74rem;">
              🔄 Restaurar Padrões
            </button>
            <button type="button" id="btnStudioSaveAll" class="btn-primary" onclick="AdminApp.saveAllStudioUiLayouts()" style="padding:7px 14px; font-size:0.8rem; font-weight:800;">
              💾 Salvar Tudo no Servidor
            </button>
          </div>
        </div>

        <!-- Área Principal 3 Colunas: Camadas (Esq) | Palco Interativo WYSIWYG (Centro) | Inspetor Visual (Dir) -->
        <div id="uiStudioMainContainer" style="display:grid; grid-template-columns:270px 1fr 330px; gap:12px; align-items:start;">
          <!-- 1. Lista de Camadas / Elementos -->
          <div class="panel" style="padding:10px; max-height:78vh; overflow-y:auto;">
            <div style="font-size:0.8rem; font-weight:800; color:#f8fafc; margin-bottom:8px; border-bottom:1px solid #334155; padding-bottom:6px;">
              📑 Camadas da Interface (25)
            </div>
            <div id="uiStudioLayersList"></div>
          </div>

          <!-- 2. Palco Visual Interativo (Click & Drag + Resize Handles) -->
          <div class="panel" style="padding:10px; display:flex; flex-direction:column; align-items:center; gap:8px; min-height:78vh; justify-content:flex-start; overflow:auto; background:#050811;">
            <div style="display:flex; justify-content:space-between; align-items:center; width:100%; flex-wrap:wrap; gap:8px;">
              <span id="uiStudioStageResLabel" style="font-size:0.74rem; color:#94a3b8; font-weight:600;"></span>
              <div style="display:flex; gap:4px; align-items:center;">
                <span style="font-size:0.7rem; color:#64748b;">Zoom do Palco:</span>
                <button type="button" id="btnStudioZoom_0.55" onclick="AdminApp.setStudioZoom(0.55)" style="padding:2px 7px; font-size:0.68rem;">55%</button>
                <button type="button" id="btnStudioZoom_0.78" class="btn-primary" onclick="AdminApp.setStudioZoom(0.78)" style="padding:2px 7px; font-size:0.68rem;">78%</button>
                <button type="button" id="btnStudioZoom_1" onclick="AdminApp.setStudioZoom(1.0)" style="padding:2px 7px; font-size:0.68rem;">100%</button>
              </div>
            </div>

            <div id="uiStudioStageScaleWrapper" style="position:relative; margin:4px auto;">
              <div id="uiStudioStageScreen" class="play-mobile-hud" style="position:relative; pointer-events:auto; background:radial-gradient(circle at 50% 35%, #1e293b 0%, #09101d 60%, #04070e 100%); border:3px solid #eab308; border-radius:16px; box-shadow:0 18px 50px rgba(0,0,0,0.9); overflow:hidden; user-select:none; touch-action:none;"></div>
            </div>
          </div>

          <!-- 3. Inspetor Visual de Propriedades, Cores e Ícones -->
          <div class="panel" style="padding:10px; max-height:78vh; overflow-y:auto;">
            <div style="font-size:0.8rem; font-weight:800; color:#fde047; margin-bottom:8px; border-bottom:1px solid #334155; padding-bottom:6px;">
              🛠️ Inspetor Visual & Estilo
            </div>
            <div id="uiStudioInspectorBody" style="display:flex; flex-direction:column; gap:10px;"></div>
          </div>
        </div>
      `;

      const tabMonsters = document.getElementById('tabMonsters');
      if (tabMonsters && tabMonsters.nextSibling) {
        adminApp.insertBefore(panel, tabMonsters.nextSibling);
      } else {
        adminApp.appendChild(panel);
      }
    }

    // Modal da Galeria Visual de Ícones e Upload
    if (!document.getElementById('uiIconPickerModal')) {
      const modal = document.createElement('div');
      modal.id = 'uiIconPickerModal';
      modal.className = 'modal-backdrop';
      modal.style.display = 'none';
      modal.innerHTML = `
        <div class="modal" style="max-width:760px; width:94vw; max-height:88vh; overflow-y:auto;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:10px; margin-bottom:12px;">
            <h3 style="margin:0; color:#38bdf8;">🖼️ Selecionar Ícone ou Imagem Visual</h3>
            <button class="btn-danger" onclick="AdminApp.closeModal('uiIconPickerModal')" style="padding:4px 10px;">✕</button>
          </div>

          <div style="display:grid; grid-template-columns:1fr auto auto; gap:8px; align-items:end; margin-bottom:12px; background:#020617; padding:10px; border-radius:8px; border:1px solid #334155;">
            <div class="field" style="margin:0;">
              <label>🔗 URL de Imagem ou Caminho de Asset</label>
              <input type="text" id="uiIconPickerCustomUrl" placeholder="/play/assets/hud/menu_shop.png ou https://..." />
            </div>
            <button type="button" class="btn-primary" onclick="AdminApp.selectIconFromPicker(document.getElementById('uiIconPickerCustomUrl').value.trim())" style="height:36px;">
              ✅ Aplicar URL
            </button>
            <button type="button" class="btn-danger" onclick="AdminApp.selectIconFromPicker('')" style="height:36px;">
              🗑️ Restaurar Original
            </button>
          </div>

          <div style="margin-bottom:12px; background:rgba(56,189,248,0.08); border:1px dashed #38bdf8; border-radius:8px; padding:8px 12px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
            <span style="font-size:0.76rem; color:#7dd3fc; font-weight:700;">📂 Enviar Imagem do Computador (PNG, WebP, SVG):</span>
            <input type="file" accept="image/*" onchange="AdminApp.handleLocalIconUpload(this)" style="font-size:0.74rem; color:#cbd5e1;" />
          </div>

          <div style="font-size:0.75rem; font-weight:800; color:#fde047; margin-bottom:8px;">✨ Galeria Rápida de Ícones de HUD, Equipamentos e Itens:</div>
          <div id="uiIconPickerGalleryGrid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(92px, 1fr)); gap:8px;"></div>
        </div>
      `;
      document.body.appendChild(modal);
    }
  }
}

window.AdminUiLayoutsTab = AdminUiLayoutsTab;
