/**
 * @file apps/server/public/play/js/PlayClientHudEditor.js
 * @description Editor Visual No-Code de HUDs exclusivo do Cliente (/play), acessível pelo
 *   botão de Engrenagem (Configurações).
 *   Permite ao jogador:
 *   - Clicar e arrastar (Click & Drag) qualquer HUD na própria tela do jogo para mover
 *   - Arrastar as 4 alças de canto (Escala) ou 4 alças de borda (Largura/Altura)
 *   - Ajustar Opacidade, Visibilidade e Cores (Fundo, Borda, Texto, Arredondamento)
 *   - NÃO permite trocar imagens ou ícones (mantém a identidade visual oficial do servidor)
 *   - Salva APENAS localmente no navegador/dispositivo do próprio jogador (localStorage)
 */

class PlayClientHudEditor {
  constructor() {
    this.isActive = false;
    this.selectedCode = 'HUD_CHAT';
    this.workingOverrides = {};
    this.backupOverrides = {};
    this.panelPosition = 'top'; // 'top' | 'bottom'
    this.panelCollapsed = false;
    this.dragState = null;
  }

  getEditableTemplates() {
    const all = window.PlayUiLayoutApplier?.templates || window.PlayApp?.uiLayoutTemplates || [];
    const isCombat = Boolean(window.PlayApp?.actionArena?.isActive);
    const filtered = all.filter((t) =>
      isCombat
        ? t.category === 'COMBAT_HUD' || t.code === 'HUD_SETTINGS_BTN'
        : t.category === 'EXPLORE_HUD'
    );
    return filtered.length > 0 ? filtered : all.filter((t) => t.category === 'EXPLORE_HUD');
  }

  getActiveMode() {
    return window.PlayUiLayoutApplier
      ? window.PlayUiLayoutApplier.detectViewportMode()
      : 'MOBILE_PORTRAIT';
  }

  getEffectiveConfig(code) {
    const mode = this.getActiveMode();
    const tpl = (window.PlayUiLayoutApplier?.templates || []).find((t) => t.code === code);
    const base = tpl
      ? mode === 'MOBILE_PORTRAIT'
        ? tpl.mobilePortrait || {}
        : mode === 'MOBILE_LANDSCAPE'
        ? tpl.mobileLandscape || {}
        : tpl.desktop || {}
      : {};
    const local = this.workingOverrides?.[code]?.[mode] || {};
    return {
      anchorX: local.anchorX !== undefined ? local.anchorX : base.anchorX || 'DEFAULT',
      anchorY: local.anchorY !== undefined ? local.anchorY : base.anchorY || 'DEFAULT',
      offsetX: Number(local.offsetX !== undefined ? local.offsetX : base.offsetX || 0),
      offsetY: Number(local.offsetY !== undefined ? local.offsetY : base.offsetY || 0),
      scale: Number(local.scale !== undefined ? local.scale : base.scale || 1.0),
      widthPx: local.widthPx !== undefined ? local.widthPx : base.widthPx || null,
      heightPx: local.heightPx !== undefined ? local.heightPx : base.heightPx || null,
      opacity: Number(local.opacity !== undefined ? local.opacity : base.opacity ?? 1.0),
      visible: local.visible !== undefined ? local.visible : base.visible !== false,
      bgColor: local.bgColor !== undefined ? local.bgColor : base.bgColor || null,
      borderColor: local.borderColor !== undefined ? local.borderColor : base.borderColor || null,
      textColor: local.textColor !== undefined ? local.textColor : base.textColor || null,
      borderRadiusPx:
        local.borderRadiusPx !== undefined ? local.borderRadiusPx : base.borderRadiusPx ?? null,
    };
  }

  setOverrideField(code, field, value) {
    const mode = this.getActiveMode();
    if (!this.workingOverrides[code]) this.workingOverrides[code] = {};
    if (!this.workingOverrides[code][mode]) {
      this.workingOverrides[code][mode] = { ...this.getEffectiveConfig(code) };
    }
    this.workingOverrides[code][mode][field] = value;

    if (window.PlayUiLayoutApplier) {
      window.PlayUiLayoutApplier.clientOverrides = this.workingOverrides;
      window.PlayUiLayoutApplier.applyAll();
    }
    this.updateGizmoAndControls();
  }

  openEditor() {
    if (this.isActive) return;
    this.isActive = true;

    const currentSaved = window.PlayUiLayoutApplier
      ? window.PlayUiLayoutApplier.loadClientOverrides()
      : {};
    this.backupOverrides = JSON.parse(JSON.stringify(currentSaved || {}));
    this.workingOverrides = JSON.parse(JSON.stringify(currentSaved || {}));

    const list = this.getEditableTemplates();
    if (list.length > 0 && !list.some((t) => t.code === this.selectedCode)) {
      this.selectedCode = list[0].code;
    }

    this.injectEditorOverlayDom();
    this.bindStagePointerEvents();
    this.updateGizmoAndControls();
  }

  closeEditor(saveChanges = false) {
    this.isActive = false;
    if (saveChanges) {
      if (window.PlayUiLayoutApplier) {
        window.PlayUiLayoutApplier.saveClientOverrides(this.workingOverrides);
      }
      if (window.PlayApp?.showNotification) {
        window.PlayApp.showNotification(
          '✅ Layout personalizado das HUDs salvo neste dispositivo!',
          'success'
        );
      }
    } else {
      if (window.PlayUiLayoutApplier) {
        window.PlayUiLayoutApplier.clientOverrides = JSON.parse(
          JSON.stringify(this.backupOverrides || {})
        );
        window.PlayUiLayoutApplier.applyAll();
      }
    }

    const overlay = document.getElementById('clientHudEditorRoot');
    if (overlay) overlay.remove();
  }

  resetSelectedHud() {
    const mode = this.getActiveMode();
    if (this.workingOverrides?.[this.selectedCode]?.[mode]) {
      delete this.workingOverrides[this.selectedCode][mode];
    }
    if (window.PlayUiLayoutApplier) {
      window.PlayUiLayoutApplier.clientOverrides = this.workingOverrides;
      window.PlayUiLayoutApplier.applyAll();
    }
    this.renderInspectorContent();
    this.updateGizmoAndControls();
  }

  resetAllClientHuds() {
    if (!confirm('Deseja restaurar todas as HUDs para a posição e cores originais do jogo?')) {
      return;
    }
    this.workingOverrides = {};
    if (window.PlayUiLayoutApplier) {
      window.PlayUiLayoutApplier.clearClientOverrides();
    }
    this.renderInspectorContent();
    this.updateGizmoAndControls();
  }

  toggleDockPosition() {
    this.panelPosition = this.panelPosition === 'top' ? 'bottom' : 'top';
    const panel = document.getElementById('clientHudInspectorPanel');
    if (panel) {
      panel.style.top = this.panelPosition === 'top' ? '8px' : 'auto';
      panel.style.bottom = this.panelPosition === 'bottom' ? '8px' : 'auto';
    }
  }

  toggleDockCollapse() {
    this.panelCollapsed = !this.panelCollapsed;
    const body = document.getElementById('clientHudInspectorBody');
    const btn = document.getElementById('btnClientHudCollapse');
    if (body) body.style.display = this.panelCollapsed ? 'none' : 'flex';
    if (btn) btn.textContent = this.panelCollapsed ? '▼ Expandir' : '▲ Minimizar';
  }

  selectHudByCode(code) {
    this.selectedCode = code;
    this.renderInspectorContent();
    this.updateGizmoAndControls();
  }

  injectEditorOverlayDom() {
    const existing = document.getElementById('clientHudEditorRoot');
    if (existing) existing.remove();

    const root = document.createElement('div');
    root.id = 'clientHudEditorRoot';
    root.style.cssText =
      'position:fixed; inset:0; z-index:9900; pointer-events:auto; background:rgba(2,6,23,0.18); user-select:none; touch-action:none;';

    root.innerHTML = `
      <!-- Guias de Centro -->
      <div id="clientHudGuideV" style="display:none; position:fixed; top:0; bottom:0; left:50%; width:1px; border-left:1.5px dashed #38bdf8; z-index:9905; pointer-events:none;"></div>
      <div id="clientHudGuideH" style="display:none; position:fixed; left:0; right:0; top:50%; height:1px; border-top:1.5px dashed #38bdf8; z-index:9905; pointer-events:none;"></div>

      <!-- Gizmo Interativo sobre a HUD selecionada -->
      <div id="clientHudGizmoBox" style="display:none; position:fixed; border:2.5px solid #38bdf8; background:rgba(56,189,248,0.12); box-shadow:0 0 0 1px rgba(2,6,23,0.9), 0 0 18px rgba(56,189,248,0.55); border-radius:8px; z-index:9910; cursor:move;">
        <div id="clientHudGizmoBadge" style="position:absolute; top:-24px; left:0; background:#0284c7; color:#fff; font-size:0.66rem; font-weight:800; padding:2px 8px; border-radius:4px; white-space:nowrap; box-shadow:0 2px 6px rgba(0,0,0,0.85); pointer-events:none;"></div>
        <!-- 4 Cantos (Escala) -->
        <div data-client-handle="nw" style="position:absolute; top:-7px; left:-7px; width:14px; height:14px; background:#fde047; border:2px solid #020617; border-radius:50%; cursor:nwse-resize;"></div>
        <div data-client-handle="ne" style="position:absolute; top:-7px; right:-7px; width:14px; height:14px; background:#fde047; border:2px solid #020617; border-radius:50%; cursor:nesw-resize;"></div>
        <div data-client-handle="sw" style="position:absolute; bottom:-7px; left:-7px; width:14px; height:14px; background:#fde047; border:2px solid #020617; border-radius:50%; cursor:nesw-resize;"></div>
        <div data-client-handle="se" style="position:absolute; bottom:-7px; right:-7px; width:14px; height:14px; background:#fde047; border:2px solid #020617; border-radius:50%; cursor:nwse-resize;"></div>
        <!-- 4 Bordas (Largura/Altura) -->
        <div data-client-handle="e" style="position:absolute; top:50%; right:-6px; transform:translateY(-50%); width:10px; height:22px; background:#38bdf8; border:1.5px solid #020617; border-radius:4px; cursor:ew-resize;"></div>
        <div data-client-handle="w" style="position:absolute; top:50%; left:-6px; transform:translateY(-50%); width:10px; height:22px; background:#38bdf8; border:1.5px solid #020617; border-radius:4px; cursor:ew-resize;"></div>
        <div data-client-handle="s" style="position:absolute; bottom:-6px; left:50%; transform:translateX(-50%); width:22px; height:10px; background:#38bdf8; border:1.5px solid #020617; border-radius:4px; cursor:ns-resize;"></div>
        <div data-client-handle="n" style="position:absolute; top:-6px; left:50%; transform:translateX(-50%); width:22px; height:10px; background:#38bdf8; border:1.5px solid #020617; border-radius:4px; cursor:ns-resize;"></div>
      </div>

      <!-- Painel Flutuante de Controle do Jogador -->
      <div id="clientHudInspectorPanel" style="position:fixed; top:8px; left:50%; transform:translateX(-50%); width:min(95vw, 480px); background:rgba(15,23,42,0.96); border:2px solid #38bdf8; border-radius:14px; box-shadow:0 12px 34px rgba(0,0,0,0.9); padding:10px 12px; z-index:9920; color:#f8fafc; font-family:system-ui,sans-serif;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:6px; border-bottom:1px solid #334155; padding-bottom:6px;">
          <strong style="font-size:0.84rem; color:#fde047;">🎨 Personalizar Minhas HUDs</strong>
          <div style="display:flex; gap:4px;">
            <button type="button" onclick="window.PlayClientHudEditor.toggleDockPosition()" style="padding:3px 7px; font-size:0.68rem;">⇅ Topo/Base</button>
            <button type="button" id="btnClientHudCollapse" onclick="window.PlayClientHudEditor.toggleDockCollapse()" style="padding:3px 7px; font-size:0.68rem;">▲ Minimizar</button>
          </div>
        </div>

        <div id="clientHudInspectorBody" style="display:flex; flex-direction:column; gap:8px; margin-top:8px;"></div>

        <div style="display:flex; justify-content:space-between; align-items:center; gap:6px; margin-top:8px; padding-top:8px; border-top:1px solid #334155;">
          <button type="button" onclick="window.PlayClientHudEditor.resetAllClientHuds()" style="padding:5px 9px; font-size:0.72rem; background:rgba(244,63,94,0.18); color:#fda4af; border:1px solid #f43f5e;">
            🔄 Padrão Original
          </button>
          <div style="display:flex; gap:6px;">
            <button type="button" onclick="window.PlayClientHudEditor.closeEditor(false)" style="padding:5px 10px; font-size:0.74rem;">
              ✕ Cancelar
            </button>
            <button type="button" class="btn-primary" onclick="window.PlayClientHudEditor.closeEditor(true)" style="padding:5px 12px; font-size:0.76rem; font-weight:800;">
              💾 Salvar no Meu Client
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(root);
    this.renderInspectorContent();
  }

  renderInspectorContent() {
    const body = document.getElementById('clientHudInspectorBody');
    if (!body) return;

    const list = this.getEditableTemplates();
    const cfg = this.getEffectiveConfig(this.selectedCode);

    const optionsHtml = list
      .map(
        (t) =>
          `<option value="${t.code}" ${t.code === this.selectedCode ? 'selected' : ''}>${t.namePtBr}</option>`
      )
      .join('');

    body.innerHTML = `
      <div style="font-size:0.68rem; color:#94a3b8;">
        💡 Toque direto em qualquer HUD na tela e <strong>arraste para mover</strong>, ou puxe as <strong>bolinhas amarelas dos cantos</strong> para aumentar/diminuir.
      </div>

      <div style="display:grid; grid-template-columns:1fr auto auto; gap:6px; align-items:center;">
        <select onchange="window.PlayClientHudEditor.selectHudByCode(this.value)" style="padding:5px 8px; font-size:0.76rem; background:#020617; color:#f8fafc; border:1px solid #334155; border-radius:6px;">
          ${optionsHtml}
        </select>
        <button type="button" onclick="window.PlayClientHudEditor.setOverrideField('${this.selectedCode}', 'visible', ${cfg.visible === false ? 'true' : 'false'}); window.PlayClientHudEditor.renderInspectorContent();" style="padding:5px 8px; font-size:0.72rem; background:${cfg.visible !== false ? 'rgba(34,197,94,0.2)' : 'rgba(244,63,94,0.2)'}; border:1px solid ${cfg.visible !== false ? '#22c55e' : '#f43f5e'};">
          ${cfg.visible !== false ? '👁️ Visível' : '🚫 Oculto'}
        </button>
        <button type="button" onclick="window.PlayClientHudEditor.resetSelectedHud()" style="padding:5px 8px; font-size:0.72rem;" title="Resetar apenas esta HUD">
          ⟲ Resetar
        </button>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; background:#020617; padding:7px 9px; border-radius:8px; border:1px solid #1e293b;">
        <div>
          <div style="display:flex; justify-content:space-between; font-size:0.68rem; color:#fde047;">
            <span>🔍 Tamanho / Escala</span>
            <strong id="lblClientHudScale">${Number(cfg.scale || 1).toFixed(2)}x</strong>
          </div>
          <input type="range" min="0.4" max="2.2" step="0.02" value="${cfg.scale || 1}" oninput="document.getElementById('lblClientHudScale').textContent = Number(this.value).toFixed(2) + 'x'; window.PlayClientHudEditor.setOverrideField('${this.selectedCode}', 'scale', Number(this.value));" style="width:100%; accent-color:#eab308;" />
        </div>
        <div>
          <div style="display:flex; justify-content:space-between; font-size:0.68rem; color:#7dd3fc;">
            <span>✨ Transparência</span>
            <strong id="lblClientHudOpacity">${Math.round((cfg.opacity ?? 1) * 100)}%</strong>
          </div>
          <input type="range" min="0.15" max="1" step="0.05" value="${cfg.opacity ?? 1}" oninput="document.getElementById('lblClientHudOpacity').textContent = Math.round(Number(this.value)*100) + '%'; window.PlayClientHudEditor.setOverrideField('${this.selectedCode}', 'opacity', Number(this.value));" style="width:100%; accent-color:#38bdf8;" />
        </div>
      </div>

      <!-- Cores Pessoais (Sem troca de imagens) -->
      <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:6px; background:#020617; padding:7px 9px; border-radius:8px; border:1px solid #1e293b; align-items:center;">
        <div style="display:flex; flex-direction:column; align-items:center; gap:2px;">
          <span style="font-size:0.64rem; color:#cbd5e1;">🎨 Fundo</span>
          <input type="color" value="${cfg.bgColor && cfg.bgColor.startsWith('#') ? cfg.bgColor : '#0f172a'}" oninput="window.PlayClientHudEditor.setOverrideField('${this.selectedCode}', 'bgColor', this.value)" style="width:32px; height:24px; border:none; background:none; cursor:pointer;" />
        </div>
        <div style="display:flex; flex-direction:column; align-items:center; gap:2px;">
          <span style="font-size:0.64rem; color:#cbd5e1;">🖼️ Borda</span>
          <input type="color" value="${cfg.borderColor && cfg.borderColor.startsWith('#') ? cfg.borderColor : '#eab308'}" oninput="window.PlayClientHudEditor.setOverrideField('${this.selectedCode}', 'borderColor', this.value)" style="width:32px; height:24px; border:none; background:none; cursor:pointer;" />
        </div>
        <div style="display:flex; flex-direction:column; align-items:center; gap:2px;">
          <span style="font-size:0.64rem; color:#cbd5e1;">🔤 Texto</span>
          <input type="color" value="${cfg.textColor && cfg.textColor.startsWith('#') ? cfg.textColor : '#f8fafc'}" oninput="window.PlayClientHudEditor.setOverrideField('${this.selectedCode}', 'textColor', this.value)" style="width:32px; height:24px; border:none; background:none; cursor:pointer;" />
        </div>
        <div style="display:flex; flex-direction:column; align-items:center; gap:2px;">
          <span style="font-size:0.64rem; color:#cbd5e1;">⭕ Canto (px)</span>
          <input type="number" min="0" max="50" placeholder="Auto" value="${cfg.borderRadiusPx ?? ''}" oninput="window.PlayClientHudEditor.setOverrideField('${this.selectedCode}', 'borderRadiusPx', this.value !== '' ? Number(this.value) : null)" style="width:52px; padding:2px 4px; font-size:0.7rem; background:#0f172a; color:#fff; border:1px solid #334155; border-radius:4px; text-align:center;" />
        </div>
      </div>
    `;
  }

  findDomElementForCode(code) {
    const tpl = (window.PlayUiLayoutApplier?.templates || []).find((t) => t.code === code);
    if (!tpl || !tpl.domSelector) return null;
    try {
      return document.querySelector(tpl.domSelector);
    } catch {
      return null;
    }
  }

  updateGizmoAndControls() {
    const gizmo = document.getElementById('clientHudGizmoBox');
    const badge = document.getElementById('clientHudGizmoBadge');
    if (!gizmo) return;

    const targetEl = this.findDomElementForCode(this.selectedCode);
    if (!targetEl) {
      gizmo.style.display = 'none';
      return;
    }

    const rect = targetEl.getBoundingClientRect();
    gizmo.style.display = 'block';
    gizmo.style.left = `${Math.round(rect.left - 2)}px`;
    gizmo.style.top = `${Math.round(rect.top - 2)}px`;
    gizmo.style.width = `${Math.max(28, Math.round(rect.width + 4))}px`;
    gizmo.style.height = `${Math.max(28, Math.round(rect.height + 4))}px`;

    const cfg = this.getEffectiveConfig(this.selectedCode);
    const tpl = (window.PlayUiLayoutApplier?.templates || []).find(
      (t) => t.code === this.selectedCode
    );
    if (badge) {
      badge.textContent = `${(tpl?.namePtBr || this.selectedCode).slice(0, 24)} (${cfg.offsetX >= 0 ? '+' : ''}${cfg.offsetX}px, ${cfg.offsetY >= 0 ? '+' : ''}${cfg.offsetY}px | ${Number(cfg.scale || 1).toFixed(2)}x)`;
    }
  }

  bindStagePointerEvents() {
    const root = document.getElementById('clientHudEditorRoot');
    if (!root) return;

    root.addEventListener('pointerdown', (ev) => {
      if (ev.target.closest('#clientHudInspectorPanel')) return;

      const handleEl = ev.target.closest('[data-client-handle]');
      const gizmoBox = ev.target.closest('#clientHudGizmoBox');

      if (!handleEl && !gizmoBox) {
        // Verifica se o jogador clicou sobre alguma HUD da tela (hit-test por bounding box)
        const list = this.getEditableTemplates();
        for (const tpl of list) {
          const dom = this.findDomElementForCode(tpl.code);
          if (!dom) continue;
          const r = dom.getBoundingClientRect();
          if (
            r.width > 0 &&
            r.height > 0 &&
            ev.clientX >= r.left &&
            ev.clientX <= r.right &&
            ev.clientY >= r.top &&
            ev.clientY <= r.bottom
          ) {
            this.selectHudByCode(tpl.code);
            break;
          }
        }
      }

      const targetDom = this.findDomElementForCode(this.selectedCode);
      if (!targetDom) return;

      ev.preventDefault();
      const cfg = this.getEffectiveConfig(this.selectedCode);
      const rect = targetDom.getBoundingClientRect();

      this.dragState = {
        mode: handleEl ? handleEl.getAttribute('data-client-handle') : 'move',
        startX: ev.clientX,
        startY: ev.clientY,
        startOffsetX: Number(cfg.offsetX || 0),
        startOffsetY: Number(cfg.offsetY || 0),
        startScale: Number(cfg.scale || 1.0),
        startWidth: Number(cfg.widthPx || Math.round(rect.width)),
        startHeight: Number(cfg.heightPx || Math.round(rect.height)),
      };

      root.setPointerCapture(ev.pointerId);
    });

    root.addEventListener('pointermove', (ev) => {
      if (!this.dragState) return;
      const dx = ev.clientX - this.dragState.startX;
      const dy = ev.clientY - this.dragState.startY;

      const guideV = document.getElementById('clientHudGuideV');
      const guideH = document.getElementById('clientHudGuideH');

      if (this.dragState.mode === 'move') {
        let nx = Math.round(this.dragState.startOffsetX + dx);
        let ny = Math.round(this.dragState.startOffsetY + dy);

        if (Math.abs(nx) <= 4) {
          nx = 0;
          if (guideV) guideV.style.display = 'block';
        } else if (guideV) {
          guideV.style.display = 'none';
        }

        if (Math.abs(ny) <= 4) {
          ny = 0;
          if (guideH) guideH.style.display = 'block';
        } else if (guideH) {
          guideH.style.display = 'none';
        }

        this.setOverrideField(this.selectedCode, 'offsetX', nx);
        this.setOverrideField(this.selectedCode, 'offsetY', ny);
      } else if (['se', 'sw', 'ne', 'nw'].includes(this.dragState.mode)) {
        const sign =
          this.dragState.mode.includes('e') || this.dragState.mode.includes('s') ? 1 : -1;
        const delta = (dx * sign + dy * sign) / 220;
        const newScale = Math.min(
          2.2,
          Math.max(0.4, Number((this.dragState.startScale + delta).toFixed(2)))
        );
        this.setOverrideField(this.selectedCode, 'scale', newScale);
        const lbl = document.getElementById('lblClientHudScale');
        if (lbl) lbl.textContent = `${newScale.toFixed(2)}x`;
      } else if (this.dragState.mode === 'e' || this.dragState.mode === 'w') {
        const sign = this.dragState.mode === 'e' ? 1 : -1;
        this.setOverrideField(
          this.selectedCode,
          'widthPx',
          Math.max(50, Math.round(this.dragState.startWidth + dx * sign))
        );
      } else if (this.dragState.mode === 's' || this.dragState.mode === 'n') {
        const sign = this.dragState.mode === 's' ? 1 : -1;
        this.setOverrideField(
          this.selectedCode,
          'heightPx',
          Math.max(32, Math.round(this.dragState.startHeight + dy * sign))
        );
      }
    });

    const endDrag = () => {
      if (!this.dragState) return;
      this.dragState = null;
      const guideV = document.getElementById('clientHudGuideV');
      const guideH = document.getElementById('clientHudGuideH');
      if (guideV) guideV.style.display = 'none';
      if (guideH) guideH.style.display = 'none';
    };

    root.addEventListener('pointerup', endDrag);
    root.addEventListener('pointercancel', endDrag);
  }
}

window.PlayClientHudEditor = new PlayClientHudEditor();
