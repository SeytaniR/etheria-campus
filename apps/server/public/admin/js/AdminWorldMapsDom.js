/**
 * @file apps/server/public/admin/js/AdminWorldMapsDom.js
 * @module @etheria/server
 * @description Submódulo de Templates HTML e DOM da Aba `🌍 Mapas Gerais` no `/admin`.
 *   Fornece layout 100% responsivo para Mobile Vertical (Portrait) e Desktop.
 */

class AdminWorldMapsDom {
  static getSectionHtml() {
    return `
      <!-- CABEÇALHO RESPONSIVO: SELETOR DE CONTINENTES & SALVAR -->
      <div class="panel wm-header-panel" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; padding:12px 14px;">
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <h3 style="margin:0; font-size:1.05rem;">🌍 Mapas Gerais dos Continentes</h3>
          <div id="wmContinentTabs" style="display:flex; gap:6px; flex-wrap:wrap;"></div>
        </div>
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <span id="wmDirtyBadge" style="display:none; background:rgba(245,158,11,0.2); border:1px solid #f59e0b; color:#fde047; padding:4px 10px; border-radius:999px; font-weight:700; font-size:0.75rem;">
            ● Alterações não salvas
          </span>
          <button type="button" class="btn-success" style="padding:9px 18px; font-weight:800; font-size:0.86rem; border-radius:6px; min-height:40px;" onclick="AdminApp.saveActiveWorldMap()">
            💾 Salvar Mapa Geral
          </button>
        </div>
      </div>

      <!-- BARRA DE FERRAMENTAS TOUCH-FRIENDLY (SELEÇÃO, CRIAÇÃO DE PONTOS E LIGAÇÕES) -->
      <div class="panel" style="padding:10px 14px; display:flex; flex-direction:column; gap:8px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button type="button" class="btn-primary wm-tool-btn" data-tool-mode="SELECT" style="min-height:38px; padding:6px 14px; font-size:0.82rem; font-weight:700;" onclick="AdminApp.setWorldMapToolMode('SELECT')">
              👆 Selecionar / Mover
            </button>
            <button type="button" class="btn-secondary wm-tool-btn" data-tool-mode="ADD_POINT" style="min-height:38px; padding:6px 14px; font-size:0.82rem; font-weight:700;" onclick="AdminApp.setWorldMapToolMode('ADD_POINT')">
              ➕ Criar Ponto
            </button>
            <button type="button" class="btn-secondary wm-tool-btn" data-tool-mode="CONNECT" style="min-height:38px; padding:6px 14px; font-size:0.82rem; font-weight:700;" onclick="AdminApp.setWorldMapToolMode('CONNECT')">
              🔗 Criar Ligação
            </button>
            <button type="button" class="btn-secondary wm-tool-btn" data-tool-mode="DELETE" style="min-height:38px; padding:6px 14px; font-size:0.82rem; font-weight:700; color:#f87171;" onclick="AdminApp.setWorldMapToolMode('DELETE')">
              🗑️ Excluir
            </button>
          </div>

          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; font-size:0.78rem;">
            <label style="display:flex; align-items:center; gap:4px; cursor:pointer;">
              <input type="checkbox" id="wmToggleRoutesChk" checked onchange="AdminApp.toggleWorldMapLayer('showRoutesLayer', this.checked)" />
              <span>Linhas</span>
            </label>
            <label style="display:flex; align-items:center; gap:4px; cursor:pointer;">
              <input type="checkbox" id="wmTogglePointsChk" checked onchange="AdminApp.toggleWorldMapLayer('showPointsLayer', this.checked)" />
              <span>Pontos</span>
            </label>
            <label style="display:flex; align-items:center; gap:4px; cursor:pointer;">
              <input type="checkbox" id="wmToggleLogoChk" checked onchange="AdminApp.updateWorldMapLogoControls({ logoVisible: this.checked })" />
              <span>Logo</span>
            </label>
            <button type="button" class="btn-danger" style="padding:4px 10px; font-size:0.75rem; border-radius:4px;" onclick="AdminApp.clearAllWorldPointsAndRoutes()">
              🧹 Limpar Todos
            </button>
          </div>
        </div>

        <div id="wmModeHintBanner" style="font-size:0.76rem; color:#bae6fd; background:rgba(2,132,199,0.15); border:1px solid rgba(56,189,248,0.35); padding:6px 10px; border-radius:6px;">
          👆 <strong>Modo Selecionar:</strong> Clique num ponto para inspecionar/editar vínculo ou arraste para mover.
        </div>
      </div>

      <!-- WORKSPACE RESPONSIVO: MAPA NO TOPO / PAINÉIS ABAIXO NO MOBILE -->
      <div class="wm-workspace-grid" style="display:grid; grid-template-columns:minmax(0, 1fr) 380px; gap:14px; align-items:start;">
        
        <!-- PALCO INTERATIVO DO MAPA GERAL -->
        <div class="panel" style="padding:10px; display:flex; flex-direction:column; gap:8px;">
          <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.74rem; color:var(--text-muted); flex-wrap:wrap; gap:6px;">
            <span>Resolução Base: 1264 × 848 px</span>
            <div style="display:flex; align-items:center; gap:6px;">
              <span>Zoom: <strong id="wmZoomBadge" style="color:#38bdf8;">100%</strong></span>
              <button type="button" style="padding:2px 8px; font-size:0.72rem;" onclick="AdminApp.setWorldMapZoom(0.25)">➕</button>
              <button type="button" style="padding:2px 8px; font-size:0.72rem;" onclick="AdminApp.setWorldMapZoom(-0.25)">➖</button>
              <button type="button" style="padding:2px 8px; font-size:0.72rem;" onclick="AdminApp.setWorldMapZoom(0)">↺ 100%</button>
            </div>
          </div>

          <div class="wm-stage-container" style="position:relative; width:100%; aspect-ratio:1264 / 848; background:#080c14; border-radius:10px; overflow:hidden; border:1px solid var(--border); box-shadow:0 4px 14px rgba(0,0,0,0.4);">
            <div id="wmInteractiveStage" style="position:absolute; inset:0; width:100%; height:100%; user-select:none; touch-action:none;">
              <img id="wmBaseImage" src="" alt="Mapa Geral Base" draggable="false"
                style="position:absolute; inset:0; width:100%; height:100%; object-fit:fill; display:block; pointer-events:none;" />
              <svg id="wmVectorOverlaySvg" viewBox="0 0 1264 848"
                style="position:absolute; inset:0; width:100%; height:100%; display:block; z-index:2;"></svg>
              <div id="wmLogoDraggableBox"
                style="position:absolute; z-index:3; cursor:move; border:1.5px dashed rgba(56,189,248,0.65); border-radius:6px;"
                title="Arraste para mover o logo | Puxe o canto ↘ para redimensionar">
                <img id="wmLogoImg" src="/assets/worldmap/etheria_campus_logo.png" alt="Logo Etheria Campus" draggable="false"
                  style="width:100%; height:auto; display:block; pointer-events:none; filter:drop-shadow(0 3px 8px rgba(0,0,0,0.65));" />
                <div id="wmLogoResizeHandle"
                  title="Arraste para ajustar o tamanho do logo"
                  style="position:absolute; right:-7px; bottom:-7px; width:18px; height:18px; background:#38bdf8; border:2px solid #0f172a; border-radius:4px; cursor:nwse-resize; display:flex; align-items:center; justify-content:center; font-size:11px; color:#0f172a; font-weight:900;">
                  ↘
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- PAINÉIS LATERAIS / INFERIORES: INSPETOR DE PONTOS, LIGAÇÕES E LOGO -->
        <aside class="wm-sidebar-col" style="display:flex; flex-direction:column; gap:12px;">
          <!-- 1. Ponto Selecionado & Vínculo com Tabela de Mapas -->
          <div class="panel" style="padding:14px;">
            <h4 style="margin:0 0 8px 0; color:#38bdf8; font-size:0.92rem;">📍 Ponto Selecionado & Vínculo com Mapas</h4>
            <div id="wmPointInspectorBody"></div>
          </div>

          <!-- 2. Lista de Pontos do Continente -->
          <div class="panel" style="padding:14px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:4px;">
              <strong style="font-size:0.86rem; color:#86efac;">📋 Pontos do Continente</strong>
              <div style="display:flex; gap:3px;">
                <button type="button" class="btn-primary wm-pt-filter-btn" data-filter="ALL" style="font-size:0.68rem; padding:3px 7px;" onclick="AdminApp.setWorldMapPointsFilter('ALL')">Todos</button>
                <button type="button" class="btn-secondary wm-pt-filter-btn" data-filter="LINKED" style="font-size:0.68rem; padding:3px 7px;" onclick="AdminApp.setWorldMapPointsFilter('LINKED')">Vinculados</button>
                <button type="button" class="btn-secondary wm-pt-filter-btn" data-filter="UNLINKED" style="font-size:0.68rem; padding:3px 7px;" onclick="AdminApp.setWorldMapPointsFilter('UNLINKED')">Sem Mapa</button>
                <button type="button" class="btn-secondary wm-pt-filter-btn" data-filter="CITIES" style="font-size:0.68rem; padding:3px 7px;" onclick="AdminApp.setWorldMapPointsFilter('CITIES')">Cidades</button>
              </div>
            </div>
            <div id="wmPointsQuickList" style="display:flex; flex-direction:column; gap:6px; max-height:240px; overflow-y:auto;"></div>
          </div>

          <!-- 3. Configurações do Logotipo Etheria Campus -->
          <div class="panel" style="padding:14px;">
            <h4 style="margin:0 0 8px 0; color:#fde047; font-size:0.90rem;">🎨 Logotipo Etheria Campus</h4>
            <div style="display:flex; flex-direction:column; gap:8px; font-size:0.78rem;">
              <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                <input type="checkbox" id="wmLogoVisibleInput" checked onchange="AdminApp.updateWorldMapLogoControls({ logoVisible: this.checked })" />
                <span>Exibir logotipo neste continente</span>
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
                  <label style="font-size:0.72rem;">Posição X</label>
                  <input type="number" id="wmLogoXInput" onchange="AdminApp.updateWorldMapLogoControls({ logoX: this.value })" />
                </div>
                <div class="field" style="margin:0;">
                  <label style="font-size:0.72rem;">Posição Y</label>
                  <input type="number" id="wmLogoYInput" onchange="AdminApp.updateWorldMapLogoControls({ logoY: this.value })" />
                </div>
              </div>
              <div style="display:flex; gap:6px;">
                <button type="button" style="flex:1; font-size:0.73rem; padding:6px;" onclick="AdminApp.resetWorldMapLogoPosition('TOP_LEFT')">↖ Sup. Esquerdo</button>
                <button type="button" style="flex:1; font-size:0.73rem; padding:6px;" onclick="AdminApp.resetWorldMapLogoPosition('TOP_CENTER')">⬆️ Topo Centro</button>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <!-- ESTILOS RESPONSIVOS PARA MOBILE VERTICAL -->
      <style>
        @media (max-width: 960px) {
          .wm-workspace-grid {
            grid-template-columns: 1fr !important;
          }
          .wm-header-panel {
            flex-direction: column !important;
            align-items: stretch !important;
          }
          .wm-tool-btn {
            flex: 1 1 calc(50% - 6px);
            text-align: center;
          }
          .wm-stage-container {
            border-radius: 8px;
          }
        }
      </style>
    `;
  }

  static renderEmptyInspectorHtml() {
    return `
      <div style="font-size:0.80rem; color:var(--text-muted); background:rgba(15,23,42,0.65); border:1px dashed #334155; padding:16px; border-radius:8px; text-align:center;">
        👆 <strong>Nenhum ponto selecionado.</strong><br>
        Clique em um ponto no mapa ou use a ferramenta <strong>➕ Criar Ponto</strong> para adicionar um novo local.
      </div>
    `;
  }

  static renderPointInspectorHtml({
    pt,
    linkedMap,
    connectedListHtml,
    connectedCount,
    otherPointsOptions,
    mapOptions,
    escapeHtml,
  }) {
    return `
      <div style="display:flex; flex-direction:column; gap:10px;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:6px; flex-wrap:wrap;">
          <strong style="color:#38bdf8; font-size:0.92rem;">${escapeHtml(pt.customLabel || pt.refLabel)}</strong>
          <button type="button" class="btn-danger" style="padding:3px 8px; font-size:0.72rem;" onclick="AdminApp.deleteWorldPoint('${pt.id}')">
            🗑️ Excluir Ponto
          </button>
        </div>

        <div style="font-size:0.78rem; padding:8px 10px; border-radius:6px; background:${linkedMap ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)'}; border:1px solid ${linkedMap ? '#22c55e' : '#f59e0b'}; color:${linkedMap ? '#86efac' : '#fde68a'};">
          ${
            linkedMap
              ? `✅ Vinculado ao Mapa <strong>#${linkedMap.id} ${escapeHtml(linkedMap.namePtBr)}</strong>`
              : '⚠️ Ponto ainda sem mapa da tabela vinculado'
          }
        </div>

        <div class="field" style="margin:0;">
          <label style="font-size:0.78rem; font-weight:700;">Nome / Rótulo no Mapa Geral</label>
          <input type="text" id="wmPointCustomLabelInput" value="${escapeHtml(pt.customLabel || '')}" placeholder="Ex: Cidade Central, Porto Real..." style="font-size:0.82rem; padding:7px;" />
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
          <div class="field" style="margin:0;">
            <label style="font-size:0.72rem;">Coord X</label>
            <input type="number" id="wmPointCoordXInput" value="${Math.round(pt.x)}" style="font-size:0.80rem; padding:6px;" />
          </div>
          <div class="field" style="margin:0;">
            <label style="font-size:0.72rem;">Coord Y</label>
            <input type="number" id="wmPointCoordYInput" value="${Math.round(pt.y)}" style="font-size:0.80rem; padding:6px;" />
          </div>
        </div>

        <label style="display:flex; align-items:center; gap:8px; font-size:0.78rem; cursor:pointer;">
          <input type="checkbox" id="wmPointIsCityInput" ${pt.isCity ? 'checked' : ''} />
          <span>🏰 Destacar como Cidade / Tribo Principal</span>
        </label>

        <div class="field" style="margin:0;">
          <label style="font-size:0.78rem; font-weight:700;">Vincular Mapa da Tabela de Mapas</label>
          <input type="text" id="wmMapSearchFilter" placeholder="🔍 Filtrar mapas..." oninput="AdminApp.filterWorldMapAssignOptions()" style="font-size:0.78rem; margin-bottom:5px; padding:6px;" />
          <select id="wmAssignMapSelect" style="font-size:0.80rem; padding:6px;">
            <option value="">— Nenhum mapa vinculado —</option>
            ${mapOptions}
          </select>
        </div>

        <div style="display:flex; gap:6px;">
          <button type="button" class="btn-success" style="flex:1; font-size:0.80rem; font-weight:700; padding:8px;" onclick="AdminApp.linkSelectedMapToWorldPoint()">
            💾 Atualizar Ponto
          </button>
          ${
            linkedMap
              ? `<button type="button" class="btn-secondary" style="font-size:0.78rem; padding:8px;" onclick="AdminApp.unlinkWorldPointMap()">✂️ Desvincular</button>`
              : ''
          }
        </div>

        <!-- LIGAÇÕES DESTE PONTO -->
        <div style="border-top:1px solid #334155; padding-top:8px; margin-top:2px;">
          <strong style="font-size:0.78rem; color:#fde047; display:block; margin-bottom:6px;">🔗 Ligações deste Ponto (${connectedCount}):</strong>
          <div style="display:flex; flex-direction:column; gap:4px; max-height:110px; overflow-y:auto; margin-bottom:6px;">
            ${connectedListHtml || '<div style="font-size:0.72rem; color:var(--text-muted);">Nenhuma ligação traçada ainda.</div>'}
          </div>
          ${
            otherPointsOptions
              ? `
            <div style="display:flex; gap:6px;">
              <select id="wmQuickConnectTargetSelect" style="flex:1; font-size:0.75rem; padding:4px;">
                <option value="">Ligar a outro ponto...</option>
                ${otherPointsOptions}
              </select>
              <button type="button" class="btn-secondary" style="font-size:0.75rem; padding:4px 10px;" onclick="AdminApp.handleQuickConnectClick('${pt.id}')">Conectar</button>
            </div>
          `
              : ''
          }
        </div>
      </div>
    `;
  }
}

window.AdminWorldMapsDom = AdminWorldMapsDom;
