/**
 * @file AdminEventsModalDom.js
 * @description Injeta o botão da aba 🎉 Eventos, o painel CRUD (#tabEvents) e o modal de configuração
 *   (#eventEditorModal) com seleção/upload local de banner e ícone, datas de vigência e editor dia-a-dia.
 */
class AdminEventsModalDom {
  static injectTabAndModalDom() {
    // 1. Injeta botão na barra superior (.nav-tabs)
    const navTabs = document.querySelector('.nav-tabs');
    const btnQuests = document.getElementById('tabBtnQuests');
    if (navTabs && !document.getElementById('tabBtnEvents')) {
      const btn = document.createElement('button');
      btn.id = 'tabBtnEvents';
      btn.onclick = () => window.AdminApp.switchTab('events');
      btn.textContent = '🎉 Eventos';
      if (btnQuests && btnQuests.nextSibling) {
        navTabs.insertBefore(btn, btnQuests.nextSibling);
      } else {
        navTabs.appendChild(btn);
      }
    }

    // 2. Injeta painel #tabEvents dentro de #adminApp
    const adminApp = document.getElementById('adminApp');
    if (adminApp && !document.getElementById('tabEvents')) {
      const panel = document.createElement('div');
      panel.id = 'tabEvents';
      panel.style.cssText = 'display:none; padding:14px; max-width:1300px; margin:0 auto; width:100%; gap:14px; flex-direction:column; box-sizing:border-box;';
      panel.innerHTML = `
        <div class="panel" style="padding:14px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <div>
              <h3 style="margin:0; font-size:1.05rem; color:#fde047;">🎉 Gestão de Eventos, Carrossel de Destaques & Grid</h3>
              <p style="font-size:0.78rem; color:var(--text-muted); margin:4px 0 0;">
                Configure os eventos do carrossel superior (Em Destaque), os ícones da grade inferior, imagens locais, vigência e recompensas diárias (virada 00:00 BRT).
              </p>
            </div>
            <div style="display:flex; gap:8px; align-items:center;">
              <span id="eventsCounterBadge" style="font-size:0.78rem; color:var(--text-muted); font-weight:600;"></span>
              <button class="btn-primary" onclick="AdminApp.openCreateEventModal()" style="min-height:40px; font-weight:700; padding:8px 16px; border-radius:6px;">
                ➕ Novo Evento
              </button>
            </div>
          </div>

          <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-top:12px; background:rgba(15,23,42,0.6); padding:8px 10px; border-radius:8px; border:1px solid #334155;">
            <input type="text" id="eventsSearchInput" placeholder="🔍 Buscar por título ou código..." oninput="AdminApp.renderEventsCrudTable()" style="flex:1; min-width:180px; padding:7px 10px; font-size:0.82rem;" />
            <select id="eventsPlacementFilter" onchange="AdminApp.renderEventsCrudTable()" style="width:190px; padding:7px; font-size:0.8rem;">
              <option value="ALL">Todas Posições</option>
              <option value="FEATURED">🌟 Carrossel de Destaques</option>
              <option value="GRID">💠 Grid de Ícones</option>
            </select>
            <select id="eventsStatusFilter" onchange="AdminApp.renderEventsCrudTable()" style="width:160px; padding:7px; font-size:0.8rem;">
              <option value="ALL">Todos Status</option>
              <option value="ACTIVE">🟢 Ativos</option>
              <option value="INACTIVE">⚪ Inativos</option>
            </select>
          </div>

          <div id="eventsTableContainer" style="margin-top:12px;"></div>
        </div>
      `;
      const tabQuests = document.getElementById('tabQuests');
      if (tabQuests && tabQuests.nextSibling) {
        adminApp.insertBefore(panel, tabQuests.nextSibling);
      } else {
        adminApp.appendChild(panel);
      }
    }

    // 3. Injeta modal #eventEditorModal
    if (!document.getElementById('eventEditorModal')) {
      const modal = document.createElement('div');
      modal.id = 'eventEditorModal';
      modal.className = 'modal-backdrop';
      modal.style.cssText = 'display:none; position:fixed; inset:0; background:rgba(2,6,23,0.85); z-index:9999; align-items:center; justify-content:center; padding:12px; overflow-y:auto;';
      modal.innerHTML = `
        <div style="background:#0f172a; border:1px solid #334155; border-radius:12px; width:100%; max-width:960px; max-height:92vh; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 24px 60px rgba(0,0,0,0.75);">
          <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; border-bottom:1px solid #1e293b; background:#0b1222;">
            <h3 id="evModalTitle" style="margin:0; font-size:1rem; color:#fde047;">🎉 Configurar Evento</h3>
            <button type="button" onclick="AdminApp.closeModal('eventEditorModal')" style="background:transparent; border:1px solid #475569; color:#cbd5e1; border-radius:6px; padding:4px 10px; cursor:pointer;">✕</button>
          </div>

          <div style="padding:14px 16px; overflow-y:auto; display:flex; flex-direction:column; gap:12px;">
            <input type="hidden" id="evEditIdInput" value="" />

            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:10px;">
              <div>
                <label style="font-size:0.75rem; color:#94a3b8; display:block; margin-bottom:4px;">Código Único *</label>
                <input type="text" id="evCodeInput" placeholder="ex: daily_login_carnaval" style="width:100%; padding:7px 9px; font-size:0.82rem; box-sizing:border-box;" />
              </div>
              <div>
                <label style="font-size:0.75rem; color:#94a3b8; display:block; margin-bottom:4px;">Tipo de Módulo</label>
                <select id="evTypeSelect" style="width:100%; padding:7px 9px; font-size:0.82rem; box-sizing:border-box;">
                  <option value="DAILY_LOGIN">DAILY_LOGIN (Check-in Diário)</option>
                </select>
              </div>
              <div>
                <label style="font-size:0.75rem; color:#94a3b8; display:block; margin-bottom:4px;">Exibição no Hub</label>
                <select id="evFeaturedSelect" style="width:100%; padding:7px 9px; font-size:0.82rem; box-sizing:border-box;">
                  <option value="true">🌟 Carrossel de Destaques (Topo)</option>
                  <option value="false">💠 Grid de Ícones (Abaixo)</option>
                </select>
              </div>
              <div>
                <label style="font-size:0.75rem; color:#94a3b8; display:block; margin-bottom:4px;">Ordem</label>
                <input type="number" id="evSortOrderInput" value="10" style="width:100%; padding:7px 9px; font-size:0.82rem; box-sizing:border-box;" />
              </div>
              <div>
                <label style="font-size:0.75rem; color:#94a3b8; display:block; margin-bottom:4px;">Status</label>
                <select id="evActiveSelect" style="width:100%; padding:7px 9px; font-size:0.82rem; box-sizing:border-box;">
                  <option value="true">🟢 Ativo</option>
                  <option value="false">⚪ Inativo</option>
                </select>
              </div>
            </div>

            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:10px;">
              <div>
                <label style="font-size:0.75rem; color:#94a3b8; display:block; margin-bottom:4px;">Título do Evento *</label>
                <input type="text" id="evTitleInput" placeholder="Ex: Login Seguido — 7 Dias" style="width:100%; padding:7px 9px; font-size:0.84rem; box-sizing:border-box;" />
              </div>
              <div>
                <label style="font-size:0.75rem; color:#94a3b8; display:block; margin-bottom:4px;">Início da Vigência (Opcional)</label>
                <input type="datetime-local" id="evStartsAtInput" style="width:100%; padding:7px 9px; font-size:0.82rem; box-sizing:border-box;" />
              </div>
              <div>
                <label style="font-size:0.75rem; color:#94a3b8; display:block; margin-bottom:4px;">Término da Vigência (Opcional)</label>
                <input type="datetime-local" id="evEndsAtInput" style="width:100%; padding:7px 9px; font-size:0.82rem; box-sizing:border-box;" />
              </div>
            </div>

            <div>
              <label style="font-size:0.75rem; color:#94a3b8; display:block; margin-bottom:4px;">Descrição (exibida no banner em destaque e cabeçalho do evento)</label>
              <textarea id="evDescInput" rows="2" placeholder="Descrição curta e limpa..." style="width:100%; padding:7px 9px; font-size:0.82rem; box-sizing:border-box; resize:vertical;"></textarea>
            </div>

            <!-- Imagens Locais: Banner e Ícone -->
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:12px;">
              <div style="background:rgba(15,23,42,0.7); border:1px solid #1e293b; border-radius:8px; padding:10px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                  <strong style="font-size:0.8rem; color:#7dd3fc;">🖼️ Imagem de Fundo (Banner)</strong>
                  <label class="btn-primary" style="font-size:0.72rem; padding:4px 8px; border-radius:5px; cursor:pointer;">
                    📤 Enviar Arquivo
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" style="display:none;" onchange="AdminApp.uploadEventAssetFile('banner', this)" />
                  </label>
                </div>
                <input type="text" id="evBannerUrlInput" placeholder="/play/assets/events/banner_login_7d.png" oninput="AdminApp.refreshEventImagePreviews()" style="width:100%; padding:6px 8px; font-size:0.78rem; box-sizing:border-box; margin-bottom:6px;" />
                <select id="evBannerPresetSelect" onchange="if(this.value){document.getElementById('evBannerUrlInput').value=this.value; AdminApp.refreshEventImagePreviews();}" style="width:100%; padding:5px 8px; font-size:0.75rem; margin-bottom:8px;">
                  <option value="">Selecionar asset local existente...</option>
                </select>
                <div style="height:86px; border-radius:6px; border:1px dashed #334155; background:#020617; display:flex; align-items:center; justify-content:center; overflow:hidden;">
                  <img id="evBannerPreview" alt="Preview Banner" style="width:100%; height:100%; object-fit:cover; display:none;" />
                  <span id="evBannerEmptyTxt" style="font-size:0.74rem; color:#64748b;">Sem banner</span>
                </div>
              </div>

              <div style="background:rgba(15,23,42,0.7); border:1px solid #1e293b; border-radius:8px; padding:10px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                  <strong style="font-size:0.8rem; color:#fde047;">💠 Ícone do Evento</strong>
                  <label class="btn-primary" style="font-size:0.72rem; padding:4px 8px; border-radius:5px; cursor:pointer;">
                    📤 Enviar Arquivo
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" style="display:none;" onchange="AdminApp.uploadEventAssetFile('icon', this)" />
                  </label>
                </div>
                <input type="text" id="evIconUrlInput" placeholder="/play/assets/events/icon_login_7d.png" oninput="AdminApp.refreshEventImagePreviews()" style="width:100%; padding:6px 8px; font-size:0.78rem; box-sizing:border-box; margin-bottom:6px;" />
                <select id="evIconPresetSelect" onchange="if(this.value){document.getElementById('evIconUrlInput').value=this.value; AdminApp.refreshEventImagePreviews();}" style="width:100%; padding:5px 8px; font-size:0.75rem; margin-bottom:8px;">
                  <option value="">Selecionar ícone local existente...</option>
                </select>
                <div style="height:86px; border-radius:6px; border:1px dashed #334155; background:#020617; display:flex; align-items:center; justify-content:center; overflow:hidden;">
                  <img id="evIconPreview" alt="Preview Ícone" style="width:68px; height:68px; object-fit:contain; border-radius:8px; display:none;" />
                  <span id="evIconEmptyTxt" style="font-size:0.74rem; color:#64748b;">Sem ícone</span>
                </div>
              </div>
            </div>

            <!-- Editor dos Dias e Recompensas (DAILY_LOGIN) -->
            <div style="background:rgba(15,23,42,0.65); border:1px solid #1e293b; border-radius:8px; padding:10px;">
              <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:8px;">
                <strong style="font-size:0.86rem; color:#86efac;">📅 Calendário de Recompensas Diárias (Check-in Manual 00:00 BRT)</strong>
                <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
                  <label style="font-size:0.75rem; color:#94a3b8;">Dias:</label>
                  <input type="number" id="evTotalDaysInput" min="1" max="60" value="7" onchange="AdminApp.resizeEventDays(this.value)" style="width:68px; padding:5px 7px; font-size:0.8rem;" />
                  <button type="button" onclick="AdminApp.resizeEventDays(7)" style="padding:4px 8px; font-size:0.72rem; cursor:pointer;">7 Dias</button>
                  <button type="button" onclick="AdminApp.resizeEventDays(30)" style="padding:4px 8px; font-size:0.72rem; cursor:pointer;">30 Dias</button>
                  <button type="button" onclick="AdminApp.fillDefaultEventCurve()" style="padding:4px 8px; font-size:0.72rem; cursor:pointer; background:#1e293b; border:1px solid #334155; color:#cbd5e1; border-radius:4px;">⚡ Curva Sugerida</button>
                </div>
              </div>
              <div id="evDaysEditorList" style="display:flex; flex-direction:column; gap:8px; max-height:290px; overflow-y:auto; padding-right:4px;"></div>
            </div>
          </div>

          <div style="display:flex; justify-content:flex-end; gap:8px; padding:12px 16px; border-top:1px solid #1e293b; background:#0b1222;">
            <button type="button" onclick="AdminApp.closeModal('eventEditorModal')" style="padding:8px 14px; border-radius:6px; cursor:pointer;">Cancelar</button>
            <button type="button" class="btn-primary" onclick="AdminApp.saveEventTemplate()" style="padding:8px 18px; border-radius:6px; font-weight:700;">💾 Salvar Evento</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }
  }
}

window.AdminEventsModalDom = AdminEventsModalDom;
