/**
 * @file AdminCrystalShopModalDom.js
 * @description Injeta o botão da aba 💎 Loja Cristal, o painel CRUD (#tabCrystalShop)
 *   e o modal de configuração (#crystalShopOfferModal) no painel Admin.
 */
class AdminCrystalShopModalDom {
  static injectTabAndModalDom() {
    const navTabs = document.querySelector('.nav-tabs');
    const btnShops = document.getElementById('tabBtnShops');
    if (navTabs && !document.getElementById('tabBtnCrystalShop')) {
      const btn = document.createElement('button');
      btn.id = 'tabBtnCrystalShop';
      btn.onclick = () => window.AdminApp.switchTab('crystal-shop');
      btn.textContent = '💎 Loja Cristal';
      if (btnShops && btnShops.nextSibling) {
        navTabs.insertBefore(btn, btnShops.nextSibling);
      } else {
        navTabs.appendChild(btn);
      }
    }

    const adminApp = document.getElementById('adminApp');
    if (adminApp && !document.getElementById('tabCrystalShop')) {
      const panel = document.createElement('div');
      panel.id = 'tabCrystalShop';
      panel.style.cssText = 'display:none; padding:14px; max-width:1300px; margin:0 auto; width:100%; gap:14px; flex-direction:column; box-sizing:border-box;';
      panel.innerHTML = `
        <div class="panel" style="padding:14px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <div>
              <h3 style="margin:0; font-size:1.05rem; color:#38bdf8;">💎 Loja Cristal (Carrossel de Destaques & Grid em Cristais)</h3>
              <p style="font-size:0.78rem; color:var(--text-muted); margin:4px 0 0;">
                Configure os pacotes e itens comercializados exclusivamente em Cristais (moeda premium da conta) no menu Loja do jogador.
              </p>
            </div>
            <div style="display:flex; gap:8px; align-items:center;">
              <span id="cshopCounterBadge" style="font-size:0.78rem; color:var(--text-muted); font-weight:600;"></span>
              <button class="btn-primary" onclick="AdminApp.openCreateCrystalOfferModal()" style="min-height:40px; font-weight:700; padding:8px 16px; border-radius:6px;">
                ➕ Nova Oferta Cristal
              </button>
            </div>
          </div>

          <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-top:12px; background:rgba(15,23,42,0.6); padding:8px 10px; border-radius:8px; border:1px solid #334155;">
            <input type="text" id="cshopSearchInput" placeholder="🔍 Buscar oferta ou item..." oninput="AdminApp.renderCrystalShopTable()" style="flex:1; min-width:180px; padding:7px 10px; font-size:0.82rem;" />
            <select id="cshopPlacementFilter" onchange="AdminApp.renderCrystalShopTable()" style="width:190px; padding:7px; font-size:0.8rem;">
              <option value="ALL">Todas Posições</option>
              <option value="FEATURED">🌟 Carrossel de Destaques</option>
              <option value="GRID">💠 Grid da Loja</option>
            </select>
            <select id="cshopStatusFilter" onchange="AdminApp.renderCrystalShopTable()" style="width:160px; padding:7px; font-size:0.8rem;">
              <option value="ALL">Todos Status</option>
              <option value="ACTIVE">🟢 Ativos</option>
              <option value="INACTIVE">⚪ Inativos</option>
            </select>
          </div>

          <div id="crystalShopTableContainer" style="margin-top:12px;"></div>
        </div>
      `;
      const tabShops = document.getElementById('tabShops');
      if (tabShops && tabShops.nextSibling) {
        adminApp.insertBefore(panel, tabShops.nextSibling);
      } else {
        adminApp.appendChild(panel);
      }
    }

    if (!document.getElementById('crystalShopOfferModal')) {
      const modal = document.createElement('div');
      modal.id = 'crystalShopOfferModal';
      modal.className = 'modal-backdrop';
      modal.style.cssText = 'display:none; position:fixed; inset:0; background:rgba(2,6,23,0.85); z-index:9999; align-items:center; justify-content:center; padding:12px; overflow-y:auto;';
      modal.innerHTML = `
        <div style="background:#0f172a; border:1px solid #334155; border-radius:12px; width:100%; max-width:920px; max-height:92vh; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 24px 60px rgba(0,0,0,0.75);">
          <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; border-bottom:1px solid #1e293b; background:#0b1222;">
            <h3 id="cshopModalTitle" style="margin:0; font-size:1rem; color:#38bdf8;">💎 Configurar Oferta na Loja Cristal</h3>
            <button type="button" onclick="AdminApp.closeModal('crystalShopOfferModal')" style="background:transparent; border:1px solid #475569; color:#cbd5e1; border-radius:6px; padding:4px 10px; cursor:pointer;">✕</button>
          </div>

          <div style="padding:14px 16px; overflow-y:auto; display:flex; flex-direction:column; gap:12px;">
            <input type="hidden" id="cshopEditIdInput" value="" />

            <div style="background:rgba(15,23,42,0.7); border:1px solid #1e293b; border-radius:8px; padding:10px; display:flex; flex-direction:column; gap:8px;">
              <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
                <strong style="font-size:0.82rem; color:#7dd3fc;">📦 Item / Equipamento à Venda *</strong>
                <input type="text" id="cshopItemSearchInput" placeholder="Filtrar catálogo por nome/código..." oninput="AdminApp.filterCrystalShopItemSelect()" style="width:240px; max-width:100%; padding:5px 8px; font-size:0.78rem;" />
              </div>
              <div style="display:flex; gap:10px; align-items:center;">
                <img id="cshopSelectedItemIcon" src="/play/assets/hud/menu_shop.png" alt="" style="width:42px; height:42px; object-fit:contain; border-radius:8px; background:#020617; border:1px solid #334155; flex-shrink:0;" />
                <select id="cshopItemTemplateSelect" onchange="AdminApp.onCrystalShopItemChanged()" style="flex:1; padding:7px 9px; font-size:0.82rem;"></select>
              </div>
              <div id="cshopSelectedItemMeta" style="font-size:0.74rem; color:#94a3b8;"></div>
            </div>

            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:10px;">
              <div>
                <label style="font-size:0.75rem; color:#94a3b8; display:block; margin-bottom:4px;">Código Único *</label>
                <input type="text" id="cshopCodeInput" placeholder="ex: pack_asa_celestial" style="width:100%; padding:7px 9px; font-size:0.82rem; box-sizing:border-box;" />
              </div>
              <div>
                <label style="font-size:0.75rem; color:#94a3b8; display:block; margin-bottom:4px;">Quantidade (xN) *</label>
                <input type="number" id="cshopQuantityInput" min="1" max="999" value="1" style="width:100%; padding:7px 9px; font-size:0.82rem; box-sizing:border-box;" />
              </div>
              <div>
                <label style="font-size:0.75rem; color:#38bdf8; display:block; margin-bottom:4px;">Preço em Cristais (💎) *</label>
                <input type="number" id="cshopPriceInput" min="1" value="100" style="width:100%; padding:7px 9px; font-size:0.82rem; box-sizing:border-box;" />
              </div>
              <div>
                <label style="font-size:0.75rem; color:#94a3b8; display:block; margin-bottom:4px;">Posição na Loja</label>
                <select id="cshopFeaturedSelect" style="width:100%; padding:7px 9px; font-size:0.82rem; box-sizing:border-box;">
                  <option value="true">🌟 Carrossel de Destaques (Topo)</option>
                  <option value="false">💠 Grid da Loja (Abaixo)</option>
                </select>
              </div>
              <div>
                <label style="font-size:0.75rem; color:#94a3b8; display:block; margin-bottom:4px;">Ordem</label>
                <input type="number" id="cshopSortOrderInput" value="10" style="width:100%; padding:7px 9px; font-size:0.82rem; box-sizing:border-box;" />
              </div>
              <div>
                <label style="font-size:0.75rem; color:#94a3b8; display:block; margin-bottom:4px;">Status</label>
                <select id="cshopActiveSelect" style="width:100%; padding:7px 9px; font-size:0.82rem; box-sizing:border-box;">
                  <option value="true">🟢 Ativa</option>
                  <option value="false">⚪ Inativa</option>
                </select>
              </div>
            </div>

            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:10px;">
              <div>
                <label style="font-size:0.75rem; color:#94a3b8; display:block; margin-bottom:4px;">Título Customizado (vazio = nome do item)</label>
                <input type="text" id="cshopTitleInput" placeholder="Opcional" style="width:100%; padding:7px 9px; font-size:0.82rem; box-sizing:border-box;" />
              </div>
              <div>
                <label style="font-size:0.75rem; color:#94a3b8; display:block; margin-bottom:4px;">Início Vigência (Opcional)</label>
                <input type="datetime-local" id="cshopStartsAtInput" style="width:100%; padding:7px 9px; font-size:0.82rem; box-sizing:border-box;" />
              </div>
              <div>
                <label style="font-size:0.75rem; color:#94a3b8; display:block; margin-bottom:4px;">Término Vigência (Opcional)</label>
                <input type="datetime-local" id="cshopEndsAtInput" style="width:100%; padding:7px 9px; font-size:0.82rem; box-sizing:border-box;" />
              </div>
            </div>

            <div>
              <label style="font-size:0.75rem; color:#94a3b8; display:block; margin-bottom:4px;">Descrição Customizada (vazio = descrição original do item)</label>
              <textarea id="cshopDescInput" rows="2" placeholder="Opcional" style="width:100%; padding:7px 9px; font-size:0.82rem; box-sizing:border-box; resize:vertical;"></textarea>
            </div>

            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:12px;">
              <div style="background:rgba(15,23,42,0.7); border:1px solid #1e293b; border-radius:8px; padding:10px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                  <strong style="font-size:0.8rem; color:#7dd3fc;">🖼️ Banner de Fundo (Carrossel)</strong>
                  <label class="btn-primary" style="font-size:0.72rem; padding:4px 8px; border-radius:5px; cursor:pointer;">
                    📤 Enviar Arquivo
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" style="display:none;" onchange="AdminApp.uploadCrystalShopAsset('banner', this)" />
                  </label>
                </div>
                <input type="text" id="cshopBannerUrlInput" placeholder="/play/assets/shop/uploaded/..." oninput="AdminApp.refreshCrystalShopPreviews()" style="width:100%; padding:6px 8px; font-size:0.78rem; box-sizing:border-box; margin-bottom:6px;" />
                <select id="cshopBannerPresetSelect" onchange="if(this.value){document.getElementById('cshopBannerUrlInput').value=this.value; AdminApp.refreshCrystalShopPreviews();}" style="width:100%; padding:5px 8px; font-size:0.75rem; margin-bottom:8px;">
                  <option value="">Selecionar banner local...</option>
                </select>
                <div style="height:80px; border-radius:6px; border:1px dashed #334155; background:#020617; display:flex; align-items:center; justify-content:center; overflow:hidden;">
                  <img id="cshopBannerPreview" alt="" style="width:100%; height:100%; object-fit:cover; display:none;" />
                  <span id="cshopBannerEmptyTxt" style="font-size:0.73rem; color:#64748b;">Sem banner (usa fundo padrão clean)</span>
                </div>
              </div>

              <div style="background:rgba(15,23,42,0.7); border:1px solid #1e293b; border-radius:8px; padding:10px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                  <strong style="font-size:0.8rem; color:#fde047;">💠 Ícone Customizado (vazio = ícone do item)</strong>
                  <label class="btn-primary" style="font-size:0.72rem; padding:4px 8px; border-radius:5px; cursor:pointer;">
                    📤 Enviar Arquivo
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" style="display:none;" onchange="AdminApp.uploadCrystalShopAsset('icon', this)" />
                  </label>
                </div>
                <input type="text" id="cshopIconUrlInput" placeholder="Opcional (/play/assets/...)" oninput="AdminApp.refreshCrystalShopPreviews()" style="width:100%; padding:6px 8px; font-size:0.78rem; box-sizing:border-box; margin-bottom:6px;" />
                <select id="cshopIconPresetSelect" onchange="if(this.value){document.getElementById('cshopIconUrlInput').value=this.value; AdminApp.refreshCrystalShopPreviews();}" style="width:100%; padding:5px 8px; font-size:0.75rem; margin-bottom:8px;">
                  <option value="">Selecionar ícone local...</option>
                </select>
                <div style="height:80px; border-radius:6px; border:1px dashed #334155; background:#020617; display:flex; align-items:center; justify-content:center; overflow:hidden;">
                  <img id="cshopIconPreview" alt="" style="width:62px; height:62px; object-fit:contain; border-radius:8px; display:none;" />
                  <span id="cshopIconEmptyTxt" style="font-size:0.73rem; color:#64748b;">Usa ícone padrão do item</span>
                </div>
              </div>
            </div>
          </div>

          <div style="display:flex; justify-content:flex-end; gap:8px; padding:12px 16px; border-top:1px solid #1e293b; background:#0b1222;">
            <button type="button" onclick="AdminApp.closeModal('crystalShopOfferModal')" style="padding:8px 14px; border-radius:6px; cursor:pointer;">Cancelar</button>
            <button type="button" class="btn-primary" onclick="AdminApp.saveCrystalShopOffer()" style="padding:8px 18px; border-radius:6px; font-weight:700;">💾 Salvar Oferta</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }
  }
}

window.AdminCrystalShopModalDom = AdminCrystalShopModalDom;
