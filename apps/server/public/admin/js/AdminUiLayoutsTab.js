/**
 * @file apps/server/public/admin/js/AdminUiLayoutsTab.js
 * @description Módulo do Studio Admin (/admin) para gerenciar a posição, âncora, escala e tamanho
 *   das HUDs, Modais e Interfaces do cliente (/play) nos 3 layouts:
 *   1. Mobile Vertical (MOBILE_PORTRAIT)
 *   2. Mobile Horizontal (MOBILE_LANDSCAPE)
 *   3. Desktop (DESKTOP)
 */

class AdminUiLayoutsTab {
  static attach(app) {
    app.uiLayoutTemplates = [];
    app.editingUiLayoutId = null;
    app.activePreviewViewport = 'mp'; // 'mp' | 'ml' | 'dk'

    this.injectTabAndModalDom();

    app.loadUiLayoutTemplates = async function () {
      try {
        const list = await this.api('/api/admin/ui-layouts');
        this.uiLayoutTemplates = Array.isArray(list) ? list : [];
        this.renderUiLayoutsCrudTable();
      } catch (err) {
        console.error('Erro ao carregar layouts de UI:', err);
      }
    };

    app.filterUiLayoutsCrudTable = function () {
      this.renderUiLayoutsCrudTable();
    };

    app.formatViewportBadgeHtml = function (cfg, labelIcon, labelTitle, accentColor) {
      const c = cfg || {};
      const isVisible = c.visible !== false;
      if (!isVisible) {
        return `
          <div style="background:rgba(244,63,94,0.1); border:1px solid rgba(244,63,94,0.4); border-radius:6px; padding:6px 8px; font-size:0.72rem;">
            <div style="font-weight:700; color:#fda4af;">${labelIcon} ${labelTitle}</div>
            <div style="color:#f43f5e; font-weight:700; margin-top:2px;">🚫 Oculto neste Layout</div>
          </div>
        `;
      }

      const anchorStr =
        (c.anchorX && c.anchorX !== 'DEFAULT') || (c.anchorY && c.anchorY !== 'DEFAULT')
          ? `${c.anchorX || 'DEFAULT'} / ${c.anchorY || 'DEFAULT'}`
          : 'Padrão Nativo';
      const offsetStr = `X: ${c.offsetX > 0 ? '+' : ''}${c.offsetX || 0}px | Y: ${c.offsetY > 0 ? '+' : ''}${c.offsetY || 0}px`;
      const scaleStr = `${Number(c.scale || 1).toFixed(2)}x`;

      const sizeParts = [];
      if (c.widthPx) sizeParts.push(`W:${c.widthPx}px`);
      if (c.heightPx) sizeParts.push(`H:${c.heightPx}px`);
      if (c.maxWidthVw) sizeParts.push(`MaxW:${c.maxWidthVw}vw`);
      if (c.maxHeightVh) sizeParts.push(`MaxH:${c.maxHeightVh}vh`);
      const sizeStr = sizeParts.length > 0 ? sizeParts.join(' • ') : 'Dimensão Automática';

      return `
        <div style="background:rgba(15,23,42,0.75); border:1px solid ${accentColor}; border-radius:6px; padding:6px 8px; font-size:0.71rem; line-height:1.35;">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:4px;">
            <strong style="color:#f8fafc;">${labelIcon} ${labelTitle}</strong>
            <span style="padding:1px 5px; border-radius:4px; background:rgba(56,189,248,0.15); color:#38bdf8; font-weight:700;">${scaleStr}</span>
          </div>
          <div style="color:#cbd5e1; margin-top:2px;">📍 Âncora: <strong style="color:#fde047;">${anchorStr}</strong></div>
          <div style="color:#94a3b8; font-family:monospace;">↔️ ${offsetStr}</div>
          <div style="color:#86efac; font-size:0.68rem; margin-top:1px;">📐 ${sizeStr}${c.opacity && c.opacity < 1 ? ` • Opac: ${Math.round(c.opacity * 100)}%` : ''}</div>
        </div>
      `;
    };

    app.renderUiLayoutsCrudTable = function () {
      const container = document.getElementById('uiLayoutsTableContainer');
      const badge = document.getElementById('uiLayoutsCounterBadge');
      if (!container) return;

      const q = (document.getElementById('uiLayoutSearchInput')?.value || '').trim().toLowerCase();
      const catFilter = document.getElementById('uiLayoutCategoryFilter')?.value || 'ALL';

      const all = Array.isArray(this.uiLayoutTemplates) ? this.uiLayoutTemplates : [];
      const filtered = all.filter((item) => {
        if (catFilter !== 'ALL' && item.category !== catFilter) return false;
        if (!q) return true;
        const hay = `${item.code} ${item.namePtBr} ${item.domSelector} ${item.descriptionPtBr || ''}`.toLowerCase();
        return hay.includes(q);
      });

      if (badge) {
        badge.textContent = `${filtered.length} de ${all.length} interfaces`;
      }

      if (filtered.length === 0) {
        container.innerHTML = `<div style="padding:22px; text-align:center; color:var(--text-muted); background:#0f172a; border-radius:8px;">Nenhuma HUD, Modal ou Interface encontrada para os filtros selecionados.</div>`;
        return;
      }

      const catLabels = {
        EXPLORE_HUD: { label: '🗺️ HUD Exploração', bg: 'rgba(34,197,94,0.15)', color: '#86efac', border: '#22c55e' },
        COMBAT_HUD: { label: '⚔️ HUD Batalha', bg: 'rgba(244,63,94,0.15)', color: '#fda4af', border: '#f43f5e' },
        MODAL: { label: '🪟 Modal / Janela', bg: 'rgba(56,189,248,0.15)', color: '#7dd3fc', border: '#0ea5e9' },
        INTERFACE: { label: '🛠️ Interface Especial', bg: 'rgba(168,85,247,0.15)', color: '#d8b4fe', border: '#a855f7' },
      };

      const rowsHtml = filtered
        .map((item) => {
          const cat = catLabels[item.category] || catLabels.EXPLORE_HUD;
          return `
            <tr>
              <td>
                <strong style="color:#f8fafc;">#${item.id}</strong>
                <div style="color:#38bdf8; font-weight:700; font-size:0.75rem; font-family:monospace; margin-top:2px;">${this.escapeHtml(item.code)}</div>
                <div style="color:#94a3b8; font-size:0.69rem; font-family:monospace; background:#020617; padding:2px 5px; border-radius:4px; border:1px solid #1e293b; margin-top:4px; display:inline-block;">
                  ${this.escapeHtml(item.domSelector)}
                </div>
              </td>
              <td>
                <span style="padding:2px 8px; border-radius:99px; background:${cat.bg}; color:${cat.color}; border:1px solid ${cat.border}; font-size:0.7rem; font-weight:700; display:inline-block; margin-bottom:4px;">
                  ${cat.label}
                </span>
                <div style="font-weight:700; font-size:0.86rem; color:#f8fafc;">${this.escapeHtml(item.namePtBr)}</div>
                <div style="font-size:0.72rem; color:var(--text-muted); margin-top:2px; line-height:1.3;">
                  ${this.escapeHtml(item.descriptionPtBr || '')}
                </div>
              </td>
              <td>${this.formatViewportBadgeHtml(item.mobilePortrait, '📱', 'Mobile Vertical', 'rgba(56,189,248,0.35)')}</td>
              <td>${this.formatViewportBadgeHtml(item.mobileLandscape, '📲', 'Mobile Horizontal', 'rgba(234,179,8,0.35)')}</td>
              <td>${this.formatViewportBadgeHtml(item.desktop, '🖥️', 'Desktop (PC)', 'rgba(34,197,94,0.35)')}</td>
              <td style="text-align:center;">
                <div style="display:flex; flex-direction:column; gap:5px;">
                  <button class="btn-primary" style="padding:6px 10px; font-size:0.75rem;" onclick="AdminApp.openEditUiLayoutModal(${item.id})">
                    📐 Editar 3 Layouts
                  </button>
                  <button class="btn-danger" style="padding:4px 8px; font-size:0.72rem;" onclick="AdminApp.deleteUiLayoutTemplate(${item.id})">
                    🗑️ Excluir
                  </button>
                </div>
              </td>
            </tr>
          `;
        })
        .join('');

      container.innerHTML = `
        <div style="overflow-x:auto;">
          <table class="crud-table" style="min-width:1080px;">
            <thead>
              <tr>
                <th style="width:170px;">Código & Seletor DOM</th>
                <th style="width:230px;">HUD / Modal / Interface</th>
                <th style="width:205px;">📱 Mobile Vertical</th>
                <th style="width:205px;">📲 Mobile Horizontal</th>
                <th style="width:205px;">🖥️ Desktop</th>
                <th style="width:125px; text-align:center;">Ações</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
      `;
    };

    app.populateViewportFields = function (prefix, cfg) {
      const c = cfg || {};
      const setVal = (id, v) => {
        const el = document.getElementById(id);
        if (el) el.value = v ?? '';
      };
      setVal(`uiLayout_${prefix}_visible`, c.visible === false ? 'false' : 'true');
      setVal(`uiLayout_${prefix}_anchorX`, c.anchorX || 'DEFAULT');
      setVal(`uiLayout_${prefix}_anchorY`, c.anchorY || 'DEFAULT');
      setVal(`uiLayout_${prefix}_offsetX`, c.offsetX ?? 0);
      setVal(`uiLayout_${prefix}_offsetY`, c.offsetY ?? 0);
      setVal(`uiLayout_${prefix}_scale`, c.scale ?? 1.0);
      setVal(`uiLayout_${prefix}_widthPx`, c.widthPx ?? '');
      setVal(`uiLayout_${prefix}_heightPx`, c.heightPx ?? '');
      setVal(`uiLayout_${prefix}_maxWidthVw`, c.maxWidthVw ?? '');
      setVal(`uiLayout_${prefix}_maxHeightVh`, c.maxHeightVh ?? '');
      setVal(`uiLayout_${prefix}_opacity`, c.opacity ?? 1.0);
    };

    app.readViewportFields = function (prefix) {
      const getVal = (id) => document.getElementById(id)?.value ?? '';
      const numOrNull = (val) => (val !== '' && Number(val) > 0 ? Number(val) : null);
      return {
        visible: getVal(`uiLayout_${prefix}_visible`) !== 'false',
        anchorX: getVal(`uiLayout_${prefix}_anchorX`) || 'DEFAULT',
        anchorY: getVal(`uiLayout_${prefix}_anchorY`) || 'DEFAULT',
        offsetX: Number(getVal(`uiLayout_${prefix}_offsetX`) || 0),
        offsetY: Number(getVal(`uiLayout_${prefix}_offsetY`) || 0),
        scale: Number(getVal(`uiLayout_${prefix}_scale`) || 1.0),
        widthPx: numOrNull(getVal(`uiLayout_${prefix}_widthPx`)),
        heightPx: numOrNull(getVal(`uiLayout_${prefix}_heightPx`)),
        maxWidthVw: numOrNull(getVal(`uiLayout_${prefix}_maxWidthVw`)),
        maxHeightVh: numOrNull(getVal(`uiLayout_${prefix}_maxHeightVh`)),
        opacity: Number(getVal(`uiLayout_${prefix}_opacity`) || 1.0),
      };
    };

    app.openCreateUiLayoutModal = function () {
      this.editingUiLayoutId = null;
      document.getElementById('uiLayoutModalTitle').textContent = '➕ Nova HUD / Modal / Interface (3 Layouts)';
      document.getElementById('uiLayoutCodeInput').value = '';
      document.getElementById('uiLayoutNameInput').value = '';
      document.getElementById('uiLayoutCategorySelect').value = 'EXPLORE_HUD';
      document.getElementById('uiLayoutSelectorInput').value = '';
      document.getElementById('uiLayoutDescInput').value = '';
      document.getElementById('uiLayoutActiveSelect').value = 'true';

      const def = {
        visible: true,
        anchorX: 'DEFAULT',
        anchorY: 'DEFAULT',
        offsetX: 0,
        offsetY: 0,
        scale: 1.0,
        widthPx: null,
        heightPx: null,
        maxWidthVw: null,
        maxHeightVh: null,
        opacity: 1.0,
      };
      this.populateViewportFields('mp', def);
      this.populateViewportFields('ml', def);
      this.populateViewportFields('dk', def);
      this.updateUiLayoutVisualPreview();
      this.openModal('uiLayoutModal');
    };

    app.openEditUiLayoutModal = function (id) {
      const item = (this.uiLayoutTemplates || []).find((x) => Number(x.id) === Number(id));
      if (!item) return;
      this.editingUiLayoutId = item.id;
      document.getElementById('uiLayoutModalTitle').textContent = `📐 Editar Posição & Tamanho: ${item.namePtBr}`;
      document.getElementById('uiLayoutCodeInput').value = item.code || '';
      document.getElementById('uiLayoutNameInput').value = item.namePtBr || '';
      document.getElementById('uiLayoutCategorySelect').value = item.category || 'EXPLORE_HUD';
      document.getElementById('uiLayoutSelectorInput').value = item.domSelector || '';
      document.getElementById('uiLayoutDescInput').value = item.descriptionPtBr || '';
      document.getElementById('uiLayoutActiveSelect').value = item.isActive !== false ? 'true' : 'false';

      this.populateViewportFields('mp', item.mobilePortrait);
      this.populateViewportFields('ml', item.mobileLandscape);
      this.populateViewportFields('dk', item.desktop);
      this.updateUiLayoutVisualPreview();
      this.openModal('uiLayoutModal');
    };

    app.switchPreviewViewport = function (vp) {
      this.activePreviewViewport = vp;
      ['mp', 'ml', 'dk'].forEach((k) => {
        const btn = document.getElementById(`btnPreviewVp_${k}`);
        if (btn) btn.className = k === vp ? 'btn-primary' : '';
      });
      this.updateUiLayoutVisualPreview();
    };

    app.updateUiLayoutVisualPreview = function () {
      const box = document.getElementById('uiLayoutPreviewScreen');
      const target = document.getElementById('uiLayoutPreviewElement');
      const info = document.getElementById('uiLayoutPreviewInfo');
      if (!box || !target) return;

      const vp = this.activePreviewViewport || 'mp';
      const cfg = this.readViewportFields(vp);

      const dims = {
        mp: { w: 210, h: 380, realW: 390, realH: 844, label: '📱 Mobile Vertical (390×844)' },
        ml: { w: 380, h: 185, realW: 844, realH: 390, label: '📲 Mobile Horizontal (844×390)' },
        dk: { w: 420, h: 240, realW: 1280, realH: 720, label: '🖥️ Desktop (1280×720)' },
      }[vp];

      box.style.width = `${dims.w}px`;
      box.style.height = `${dims.h}px`;

      if (!cfg.visible) {
        target.style.display = 'none';
        if (info) info.textContent = `${dims.label} — 🚫 Elemento Oculto neste Layout`;
        return;
      }

      target.style.display = 'flex';
      target.style.opacity = String(cfg.opacity || 1);

      const ratioX = dims.w / dims.realW;
      const ratioY = dims.h / dims.realH;

      const category = document.getElementById('uiLayoutCategorySelect')?.value || 'EXPLORE_HUD';
      const baseW = cfg.widthPx
        ? cfg.widthPx * ratioX
        : cfg.maxWidthVw
        ? (dims.w * cfg.maxWidthVw) / 100
        : category === 'MODAL'
        ? dims.w * 0.72
        : dims.w * 0.34;
      const baseH = cfg.heightPx
        ? cfg.heightPx * ratioY
        : cfg.maxHeightVh
        ? (dims.h * cfg.maxHeightVh) / 100
        : category === 'MODAL'
        ? dims.h * 0.65
        : dims.h * 0.18;

      const scaledW = Math.min(dims.w, Math.max(28, baseW * (cfg.scale || 1)));
      const scaledH = Math.min(dims.h, Math.max(22, baseH * (cfg.scale || 1)));

      target.style.width = `${Math.round(scaledW)}px`;
      target.style.height = `${Math.round(scaledH)}px`;

      let leftPx = (dims.w - scaledW) / 2;
      let topPx = (dims.h - scaledH) / 2;

      if (cfg.anchorX === 'LEFT') leftPx = 8;
      else if (cfg.anchorX === 'RIGHT') leftPx = dims.w - scaledW - 8;
      else if (cfg.anchorX === 'CENTER') leftPx = (dims.w - scaledW) / 2;

      if (cfg.anchorY === 'TOP') topPx = 8;
      else if (cfg.anchorY === 'BOTTOM') topPx = dims.h - scaledH - 8;
      else if (cfg.anchorY === 'CENTER') topPx = (dims.h - scaledH) / 2;

      leftPx += (cfg.offsetX || 0) * ratioX;
      topPx += (cfg.offsetY || 0) * ratioY;

      target.style.left = `${Math.round(leftPx)}px`;
      target.style.top = `${Math.round(topPx)}px`;
      target.textContent = document.getElementById('uiLayoutNameInput')?.value || 'Elemento UI';

      if (info) {
        info.textContent = `${dims.label} • Escala ${(cfg.scale || 1).toFixed(2)}x • Offset (${cfg.offsetX}px, ${cfg.offsetY}px)`;
      }
    };

    app.saveUiLayoutTemplate = async function () {
      const payload = {
        code: document.getElementById('uiLayoutCodeInput')?.value?.trim(),
        namePtBr: document.getElementById('uiLayoutNameInput')?.value?.trim(),
        category: document.getElementById('uiLayoutCategorySelect')?.value || 'EXPLORE_HUD',
        domSelector: document.getElementById('uiLayoutSelectorInput')?.value?.trim(),
        descriptionPtBr: document.getElementById('uiLayoutDescInput')?.value?.trim() || '',
        isActive: document.getElementById('uiLayoutActiveSelect')?.value !== 'false',
        mobilePortrait: this.readViewportFields('mp'),
        mobileLandscape: this.readViewportFields('ml'),
        desktop: this.readViewportFields('dk'),
      };

      if (!payload.code || !payload.namePtBr || !payload.domSelector) {
        alert('Preencha o Código, Nome em Português e o Seletor DOM CSS.');
        return;
      }

      try {
        if (this.editingUiLayoutId) {
          await this.api(`/api/admin/ui-layouts/${this.editingUiLayoutId}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          });
        } else {
          await this.api('/api/admin/ui-layouts', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
        }
        this.closeModal('uiLayoutModal');
        await this.loadUiLayoutTemplates();
      } catch (err) {
        alert(`Erro ao salvar layout de UI: ${err.message}`);
      }
    };

    app.deleteUiLayoutTemplate = async function (id) {
      const item = (this.uiLayoutTemplates || []).find((x) => Number(x.id) === Number(id));
      if (!confirm(`Deseja realmente excluir o registro de layout "${item?.namePtBr || id}"?`)) return;
      try {
        await this.api(`/api/admin/ui-layouts/${id}`, { method: 'DELETE' });
        await this.loadUiLayoutTemplates();
      } catch (err) {
        alert(`Erro ao excluir layout: ${err.message}`);
      }
    };

    app.resetDefaultUiLayouts = async function () {
      if (
        !confirm(
          'Deseja restaurar todos os 24 elementos de HUD, Modais e Interfaces para as posições e tamanhos padrões de fábrica nos 3 layouts?'
        )
      ) {
        return;
      }
      try {
        const list = await this.api('/api/admin/ui-layouts/reset-defaults', { method: 'POST', body: '{}' });
        this.uiLayoutTemplates = Array.isArray(list) ? list : [];
        this.renderUiLayoutsCrudTable();
        alert('✅ Padrões de fábrica restaurados com sucesso nos 3 layouts!');
      } catch (err) {
        alert(`Erro ao restaurar padrões: ${err.message}`);
      }
    };
  }

  static buildViewportEditorColumnHtml(prefix, icon, title, subtitle, borderColor) {
    const chg = `oninput="AdminApp.updateUiLayoutVisualPreview()" onchange="AdminApp.updateUiLayoutVisualPreview()"`;
    return `
      <div style="background:#020617; border:1.5px solid ${borderColor}; border-radius:10px; padding:12px; display:flex; flex-direction:column; gap:8px;">
        <div style="border-bottom:1px solid #1e293b; padding-bottom:6px;">
          <div style="font-weight:800; font-size:0.9rem; color:#f8fafc;">${icon} ${title}</div>
          <div style="font-size:0.7rem; color:var(--text-muted);">${subtitle}</div>
        </div>

        <div class="field">
          <label>👁️ Visibilidade neste Layout</label>
          <select id="uiLayout_${prefix}_visible" ${chg}>
            <option value="true">✅ Visível (Exibir normalmente)</option>
            <option value="false">🚫 Oculto (Esconder neste layout)</option>
          </select>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
          <div class="field">
            <label>📍 Âncora Horizontal (X)</label>
            <select id="uiLayout_${prefix}_anchorX" ${chg}>
              <option value="DEFAULT">Padrão Nativo</option>
              <option value="LEFT">⬅️ Esquerda (LEFT)</option>
              <option value="CENTER">↔️ Centro (CENTER)</option>
              <option value="RIGHT">➡️ Direita (RIGHT)</option>
            </select>
          </div>
          <div class="field">
            <label>📍 Âncora Vertical (Y)</label>
            <select id="uiLayout_${prefix}_anchorY" ${chg}>
              <option value="DEFAULT">Padrão Nativo</option>
              <option value="TOP">⬆️ Topo (TOP)</option>
              <option value="CENTER">↕️ Centro (CENTER)</option>
              <option value="BOTTOM">⬇️ Rodapé (BOTTOM)</option>
            </select>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
          <div class="field">
            <label>↔️ Posição Offset X (px)</label>
            <input type="number" id="uiLayout_${prefix}_offsetX" step="1" value="0" ${chg} />
          </div>
          <div class="field">
            <label>↕️ Posição Offset Y (px)</label>
            <input type="number" id="uiLayout_${prefix}_offsetY" step="1" value="0" ${chg} />
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
          <div class="field">
            <label>🔍 Escala de Tamanho (0.3 a 2.5x)</label>
            <input type="number" id="uiLayout_${prefix}_scale" step="0.05" min="0.3" max="2.5" value="1" ${chg} />
          </div>
          <div class="field">
            <label>✨ Opacidade (0.1 a 1.0)</label>
            <input type="number" id="uiLayout_${prefix}_opacity" step="0.05" min="0.1" max="1" value="1" ${chg} />
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
          <div class="field">
            <label>📏 Largura Fixa (px, vazio=Auto)</label>
            <input type="number" id="uiLayout_${prefix}_widthPx" placeholder="Auto" min="20" max="1920" ${chg} />
          </div>
          <div class="field">
            <label>📐 Altura Fixa (px, vazio=Auto)</label>
            <input type="number" id="uiLayout_${prefix}_heightPx" placeholder="Auto" min="20" max="1080" ${chg} />
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
          <div class="field">
            <label>↔️ Largura Máx (% Tela vw)</label>
            <input type="number" id="uiLayout_${prefix}_maxWidthVw" placeholder="Auto" min="10" max="100" ${chg} />
          </div>
          <div class="field">
            <label>↕️ Altura Máx (% Tela vh)</label>
            <input type="number" id="uiLayout_${prefix}_maxHeightVh" placeholder="Auto" min="10" max="100" ${chg} />
          </div>
        </div>
      </div>
    `;
  }

  static injectTabAndModalDom() {
    const adminApp = document.getElementById('adminApp');
    if (adminApp && !document.getElementById('tabUiLayouts')) {
      const panel = document.createElement('div');
      panel.id = 'tabUiLayouts';
      panel.style.cssText =
        'display:none; padding:14px; max-width:1360px; margin:0 auto; width:100%; gap:14px; flex-direction:column; box-sizing:border-box;';
      panel.innerHTML = `
        <div class="panel" style="padding:14px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <div>
              <h3 style="margin:0; font-size:1.05rem; color:#38bdf8;">📐 Editor de HUDs, Modais e Interfaces do Cliente (3 Layouts)</h3>
              <p style="font-size:0.78rem; color:var(--text-muted); margin:4px 0 0;">
                Configure a posição (Âncora, Offset X/Y), Escala, Largura/Altura e Visibilidade de cada HUD, Modal e Interface em <strong>Mobile Vertical</strong>, <strong>Mobile Horizontal</strong> e <strong>Desktop</strong>.
              </p>
            </div>
            <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
              <span id="uiLayoutsCounterBadge" style="font-size:0.78rem; color:var(--text-muted); font-weight:600;"></span>
              <button class="btn-secondary" onclick="AdminApp.resetDefaultUiLayouts()" style="min-height:38px; padding:6px 12px; font-size:0.78rem;">
                🔄 Restaurar Padrões
              </button>
              <button class="btn-primary" onclick="AdminApp.openCreateUiLayoutModal()" style="min-height:38px; font-weight:700; padding:6px 14px; font-size:0.8rem;">
                ➕ Nova HUD / Interface
              </button>
            </div>
          </div>

          <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-top:12px; background:rgba(15,23,42,0.6); padding:8px 10px; border-radius:8px; border:1px solid #334155;">
            <input type="text" id="uiLayoutSearchInput" placeholder="🔍 Buscar por nome, código ou seletor CSS (#hud..., #play...)..." oninput="AdminApp.filterUiLayoutsCrudTable()" style="flex:1; min-width:220px; padding:7px 10px; font-size:0.82rem;" />
            <select id="uiLayoutCategoryFilter" onchange="AdminApp.filterUiLayoutsCrudTable()" style="width:210px; padding:7px; font-size:0.8rem;">
              <option value="ALL">Todas as Categorias (24)</option>
              <option value="EXPLORE_HUD">🗺️ HUDs de Exploração</option>
              <option value="COMBAT_HUD">⚔️ HUDs de Batalha (Véu)</option>
              <option value="MODAL">🪟 Modais e Janelas</option>
              <option value="INTERFACE">🛠️ Interfaces Especiais</option>
            </select>
          </div>

          <div id="uiLayoutsTableContainer" style="margin-top:12px;"></div>
        </div>
      `;

      const tabMonsters = document.getElementById('tabMonsters');
      if (tabMonsters && tabMonsters.nextSibling) {
        adminApp.insertBefore(panel, tabMonsters.nextSibling);
      } else {
        adminApp.appendChild(panel);
      }
    }

    if (!document.getElementById('uiLayoutModal')) {
      const modal = document.createElement('div');
      modal.id = 'uiLayoutModal';
      modal.className = 'modal-backdrop';
      modal.style.display = 'none';
      modal.innerHTML = `
        <div class="modal" style="max-width:1180px; width:96vw; max-height:92vh; overflow-y:auto;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:10px; margin-bottom:12px;">
            <h3 id="uiLayoutModalTitle" style="margin:0; color:#38bdf8;">📐 Configurar HUD / Modal / Interface nos 3 Layouts</h3>
            <button class="btn-danger" onclick="AdminApp.closeModal('uiLayoutModal')" style="padding:4px 10px;">✕</button>
          </div>

          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(190px, 1fr)); gap:10px; margin-bottom:14px;">
            <div class="field">
              <label>Código Único</label>
              <input type="text" id="uiLayoutCodeInput" placeholder="Ex: HUD_MINIMAP" />
            </div>
            <div class="field">
              <label>Nome em Português</label>
              <input type="text" id="uiLayoutNameInput" placeholder="Ex: HUD Minimapa" oninput="AdminApp.updateUiLayoutVisualPreview()" />
            </div>
            <div class="field">
              <label>Categoria</label>
              <select id="uiLayoutCategorySelect" onchange="AdminApp.updateUiLayoutVisualPreview()">
                <option value="EXPLORE_HUD">🗺️ HUD de Exploração</option>
                <option value="COMBAT_HUD">⚔️ HUD de Batalha (Véu)</option>
                <option value="MODAL">🪟 Modal / Janela</option>
                <option value="INTERFACE">🛠️ Interface Especial</option>
              </select>
            </div>
            <div class="field">
              <label>Seletor DOM CSS no /play</label>
              <input type="text" id="uiLayoutSelectorInput" placeholder="Ex: #hudMinimapSection" />
            </div>
            <div class="field">
              <label>Status da Regra</label>
              <select id="uiLayoutActiveSelect">
                <option value="true">● Ativo no Cliente (/play)</option>
                <option value="false">○ Inativo (Ignorar)</option>
              </select>
            </div>
          </div>

          <div class="field" style="margin-bottom:14px;">
            <label>Descrição Funcional</label>
            <input type="text" id="uiLayoutDescInput" placeholder="Breve descrição de onde esta interface aparece no cliente..." />
          </div>

          <!-- Colunas dos 3 Layouts -->
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(310px, 1fr)); gap:12px; margin-bottom:14px;">
            ${this.buildViewportEditorColumnHtml('mp', '📱', 'Mobile Vertical (Retrato)', 'Celulares em pé (Portrait <= 768px)', '#0ea5e9')}
            ${this.buildViewportEditorColumnHtml('ml', '📲', 'Mobile Horizontal (Paisagem)', 'Celulares deitados (Landscape)', '#eab308')}
            ${this.buildViewportEditorColumnHtml('dk', '🖥️', 'Desktop (Telas Grandes)', 'Monitores e Notebooks (> 960px)', '#22c55e')}
          </div>

          <!-- Simulador Visual Proporcional -->
          <div style="background:#020617; border:1px solid #334155; border-radius:10px; padding:12px; display:flex; flex-direction:column; align-items:center; gap:8px;">
            <div style="display:flex; justify-content:space-between; align-items:center; width:100%; flex-wrap:wrap; gap:8px;">
              <strong style="font-size:0.82rem; color:#38bdf8;">🖼️ Pré-Visualização Proporcional da Tela:</strong>
              <div style="display:flex; gap:6px;">
                <button type="button" id="btnPreviewVp_mp" class="btn-primary" onclick="AdminApp.switchPreviewViewport('mp')" style="padding:4px 10px; font-size:0.74rem;">📱 Mobile Vertical</button>
                <button type="button" id="btnPreviewVp_ml" onclick="AdminApp.switchPreviewViewport('ml')" style="padding:4px 10px; font-size:0.74rem;">📲 Mobile Horizontal</button>
                <button type="button" id="btnPreviewVp_dk" onclick="AdminApp.switchPreviewViewport('dk')" style="padding:4px 10px; font-size:0.74rem;">🖥️ Desktop</button>
              </div>
            </div>
            <div id="uiLayoutPreviewInfo" style="font-size:0.74rem; color:#94a3b8;"></div>
            <div id="uiLayoutPreviewScreen" style="position:relative; background:radial-gradient(circle at center, #1e293b 0%, #090d16 100%); border:2px solid #475569; border-radius:10px; overflow:hidden;">
              <div id="uiLayoutPreviewElement" style="position:absolute; background:rgba(56,189,248,0.28); border:2px dashed #38bdf8; color:#f8fafc; font-size:0.68rem; font-weight:700; display:flex; align-items:center; justify-content:center; text-align:center; padding:4px; border-radius:6px; box-sizing:border-box; pointer-events:none;">
                Elemento UI
              </div>
            </div>
          </div>

          <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:14px; border-top:1px solid var(--border); padding-top:12px;">
            <button class="btn-secondary" onclick="AdminApp.closeModal('uiLayoutModal')">Cancelar</button>
            <button class="btn-primary" onclick="AdminApp.saveUiLayoutTemplate()">💾 Salvar Posição e Tamanho nos 3 Layouts</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }
  }
}

window.AdminUiLayoutsTab = AdminUiLayoutsTab;
