/**
 * @file apps/server/public/play/js/PlayUiLayoutApplier.js
 * @description Motor de aplicação dinâmica de Layouts de UI do Cliente (/play)
 *   para os 3 formatos: Mobile Vertical (MOBILE_PORTRAIT), Mobile Horizontal (MOBILE_LANDSCAPE)
 *   e Desktop (DESKTOP), sincronizado com a tabela `client_ui_layout_templates` do /admin.
 */

class PlayUiLayoutApplier {
  constructor() {
    this.templates = [];
    this.currentMode = this.detectViewportMode();
    this.rafPending = false;
    this.observer = null;
    this.initialized = false;
  }

  detectViewportMode() {
    const w = window.innerWidth || 1280;
    const h = window.innerHeight || 720;
    const isPortrait = h >= w;
    if (w <= 768 && isPortrait) {
      return 'MOBILE_PORTRAIT';
    }
    if (w <= 960 && !isPortrait) {
      return 'MOBILE_LANDSCAPE';
    }
    return 'DESKTOP';
  }

  parseViewportConfig(raw) {
    if (!raw) return null;
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
    return typeof raw === 'object' ? raw : null;
  }

  init(uiLayoutTemplates) {
    this.templates = (Array.isArray(uiLayoutTemplates) ? uiLayoutTemplates : []).map((t) => ({
      ...t,
      mobilePortrait: this.parseViewportConfig(t.mobilePortrait || t.mobilePortraitJson) || {},
      mobileLandscape: this.parseViewportConfig(t.mobileLandscape || t.mobileLandscapeJson) || {},
      desktop: this.parseViewportConfig(t.desktop || t.desktopJson) || {},
    }));

    this.applyAll();

    if (!this.initialized) {
      this.initialized = true;
      window.addEventListener('resize', () => this.scheduleApply());
      window.addEventListener('orientationchange', () => this.scheduleApply());

      if (typeof MutationObserver !== 'undefined' && document.body) {
        this.observer = new MutationObserver(() => this.scheduleApply());
        this.observer.observe(document.body, {
          childList: true,
          subtree: true,
        });
      }
    }
  }

  scheduleApply() {
    if (this.rafPending) return;
    this.rafPending = true;
    requestAnimationFrame(() => {
      this.rafPending = false;
      this.applyAll();
    });
  }

  getActiveConfigForTemplate(tpl, mode) {
    if (mode === 'MOBILE_PORTRAIT') return tpl.mobilePortrait || {};
    if (mode === 'MOBILE_LANDSCAPE') return tpl.mobileLandscape || {};
    return tpl.desktop || {};
  }

  applyAll() {
    this.currentMode = this.detectViewportMode();
    if (!Array.isArray(this.templates) || this.templates.length === 0) return;

    for (const tpl of this.templates) {
      if (tpl.isActive === false || !tpl.domSelector) continue;
      let elements;
      try {
        elements = document.querySelectorAll(tpl.domSelector);
      } catch {
        continue;
      }
      if (!elements || elements.length === 0) continue;

      const cfg = this.getActiveConfigForTemplate(tpl, this.currentMode);
      elements.forEach((el) => this.applyConfigToElement(el, cfg));
    }
  }

  applyConfigToElement(el, cfg) {
    if (!el || !el.style) return;

    // 1. Visibilidade explícita
    if (cfg.visible === false) {
      if (el.dataset.uiLayoutHidden !== 'true') {
        el.dataset.uiLayoutPrevDisplay = el.style.display || '';
        el.dataset.uiLayoutHidden = 'true';
      }
      el.style.setProperty('display', 'none', 'important');
      return;
    } else if (el.dataset.uiLayoutHidden === 'true') {
      el.style.display = el.dataset.uiLayoutPrevDisplay || '';
      delete el.dataset.uiLayoutHidden;
    }

    // 2. Opacidade
    const opacity = Number(cfg.opacity ?? 1);
    if (Number.isFinite(opacity) && opacity > 0 && opacity < 1) {
      el.style.opacity = String(opacity);
      el.dataset.uiLayoutCustomOpacity = 'true';
    } else if (el.dataset.uiLayoutCustomOpacity === 'true') {
      el.style.opacity = '';
      delete el.dataset.uiLayoutCustomOpacity;
    }

    // 3. Dimensões (widthPx, heightPx, maxWidthVw, maxHeightVh)
    if (cfg.widthPx && Number(cfg.widthPx) > 0) {
      el.style.setProperty('width', `${Number(cfg.widthPx)}px`, 'important');
      el.dataset.uiLayoutCustomW = 'true';
    } else if (el.dataset.uiLayoutCustomW === 'true') {
      el.style.removeProperty('width');
      delete el.dataset.uiLayoutCustomW;
    }

    if (cfg.heightPx && Number(cfg.heightPx) > 0) {
      el.style.setProperty('height', `${Number(cfg.heightPx)}px`, 'important');
      el.dataset.uiLayoutCustomH = 'true';
    } else if (el.dataset.uiLayoutCustomH === 'true') {
      el.style.removeProperty('height');
      delete el.dataset.uiLayoutCustomH;
    }

    if (cfg.maxWidthVw && Number(cfg.maxWidthVw) > 0) {
      el.style.setProperty('max-width', `${Number(cfg.maxWidthVw)}vw`, 'important');
      el.dataset.uiLayoutCustomMW = 'true';
    } else if (el.dataset.uiLayoutCustomMW === 'true') {
      el.style.removeProperty('max-width');
      delete el.dataset.uiLayoutCustomMW;
    }

    if (cfg.maxHeightVh && Number(cfg.maxHeightVh) > 0) {
      el.style.setProperty('max-height', `${Number(cfg.maxHeightVh)}vh`, 'important');
      el.dataset.uiLayoutCustomMH = 'true';
    } else if (el.dataset.uiLayoutCustomMH === 'true') {
      el.style.removeProperty('max-height');
      delete el.dataset.uiLayoutCustomMH;
    }

    // 4. Âncora customizada (LEFT/CENTER/RIGHT e TOP/CENTER/BOTTOM) + Offset X/Y + Escala
    const anchorX = cfg.anchorX || 'DEFAULT';
    const anchorY = cfg.anchorY || 'DEFAULT';
    const offsetX = Number(cfg.offsetX || 0);
    const offsetY = Number(cfg.offsetY || 0);
    const scale = Number(cfg.scale || 1);

    const hasCustomAnchor = anchorX !== 'DEFAULT' || anchorY !== 'DEFAULT';
    const hasCustomTransform = offsetX !== 0 || offsetY !== 0 || (Number.isFinite(scale) && Math.abs(scale - 1) > 0.01);

    if (hasCustomAnchor) {
      el.style.setProperty('position', 'fixed', 'important');
      el.dataset.uiLayoutCustomPos = 'true';

      let tx = `${offsetX}px`;
      let ty = `${offsetY}px`;

      if (anchorX === 'LEFT') {
        el.style.setProperty('left', `${12 + offsetX}px`, 'important');
        el.style.setProperty('right', 'auto', 'important');
        tx = '0px';
      } else if (anchorX === 'RIGHT') {
        el.style.setProperty('right', `${12 - offsetX}px`, 'important');
        el.style.setProperty('left', 'auto', 'important');
        tx = '0px';
      } else if (anchorX === 'CENTER') {
        el.style.setProperty('left', '50%', 'important');
        el.style.setProperty('right', 'auto', 'important');
        tx = `calc(-50% + ${offsetX}px)`;
      }

      if (anchorY === 'TOP') {
        el.style.setProperty('top', `${12 + offsetY}px`, 'important');
        el.style.setProperty('bottom', 'auto', 'important');
        ty = '0px';
      } else if (anchorY === 'BOTTOM') {
        el.style.setProperty('bottom', `${12 - offsetY}px`, 'important');
        el.style.setProperty('top', 'auto', 'important');
        ty = '0px';
      } else if (anchorY === 'CENTER') {
        el.style.setProperty('top', '50%', 'important');
        el.style.setProperty('bottom', 'auto', 'important');
        ty = `calc(-50% + ${offsetY}px)`;
      }

      el.style.setProperty('transform', `translate(${tx}, ${ty}) scale(${scale})`, 'important');
      el.dataset.uiLayoutCustomTransform = 'true';
    } else {
      if (el.dataset.uiLayoutCustomPos === 'true') {
        el.style.removeProperty('position');
        el.style.removeProperty('left');
        el.style.removeProperty('right');
        el.style.removeProperty('top');
        el.style.removeProperty('bottom');
        delete el.dataset.uiLayoutCustomPos;
      }

      if (hasCustomTransform) {
        el.style.setProperty('transform', `translate(${offsetX}px, ${offsetY}px) scale(${scale})`, 'important');
        el.dataset.uiLayoutCustomTransform = 'true';
      } else if (el.dataset.uiLayoutCustomTransform === 'true') {
        el.style.removeProperty('transform');
        delete el.dataset.uiLayoutCustomTransform;
      }
    }
  }
}

window.PlayUiLayoutApplier = new PlayUiLayoutApplier();
