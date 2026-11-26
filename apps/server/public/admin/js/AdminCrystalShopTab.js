/**
 * @file AdminCrystalShopTab.js
 * @description Controlador CRUD da aba 💎 Loja Cristal no painel Admin:
 *   permite criar/editar ofertas em Cristais, escolher Carrossel vs Grid, vigência,
 *   quantidade do pacote e upload/substituição de banner e ícone local.
 */
class AdminCrystalShopTab {
  static attach(app) {
    app.adminCrystalShopOffers = [];
    app.adminCrystalShopAssets = [];
    app.adminCrystalShopCatalogItems = [];

    window.AdminCrystalShopModalDom?.injectTabAndModalDom();

    const esc = (v) =>
      window.AdminEscapeHtml
        ? window.AdminEscapeHtml(v)
        : String(v ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');

    const toLocalDateTimeInput = (isoStr) => {
      if (!isoStr) return '';
      const d = new Date(isoStr);
      if (Number.isNaN(d.getTime())) return '';
      const pad = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    const fromLocalDateTimeInput = (val) => {
      const s = String(val || '').trim();
      if (!s) return null;
      const d = new Date(s);
      return Number.isNaN(d.getTime()) ? null : d.toISOString();
    };

    app.ensureCrystalShopCatalogItems = async function () {
      if (this.adminCrystalShopCatalogItems && this.adminCrystalShopCatalogItems.length > 0) return;
      const [items, equips] = await Promise.all([
        this.api('/api/admin/items').catch(() => []),
        this.api('/api/admin/equipments').catch(() => []),
      ]);
      const merged = new Map();
      for (const it of [...(Array.isArray(items) ? items : []), ...(Array.isArray(equips) ? equips : [])]) {
        if (it?.id && !merged.has(Number(it.id))) {
          merged.set(Number(it.id), it);
        }
      }
      this.adminCrystalShopCatalogItems = Array.from(merged.values()).sort((a, b) => Number(a.id) - Number(b.id));
    };

    app.loadCrystalShopTab = async function () {
      try {
        const [offers, assets] = await Promise.all([
          this.api('/api/admin/crystal-shop'),
          this.api('/api/admin/crystal-shop/assets').catch(() => []),
        ]);
        this.adminCrystalShopOffers = Array.isArray(offers) ? offers : [];
        this.adminCrystalShopAssets = Array.isArray(assets) ? assets : [];
        await this.ensureCrystalShopCatalogItems();
        this.populateCrystalShopAssetPresets();
        this.renderCrystalShopTable();
      } catch (err) {
        console.error('Erro ao carregar Loja Cristal no Admin:', err);
      }
    };

    app.populateCrystalShopAssetPresets = function () {
      const bSel = document.getElementById('cshopBannerPresetSelect');
      const iSel = document.getElementById('cshopIconPresetSelect');
      const assets = this.adminCrystalShopAssets || [];
      if (bSel) {
        bSel.innerHTML = `<option value="">Selecionar banner local...</option>` +
          assets.map((a) => `<option value="${esc(a.url)}">${esc(a.filename)} (${a.group})</option>`).join('');
      }
      if (iSel) {
        iSel.innerHTML = `<option value="">Selecionar ícone local...</option>` +
          assets.map((a) => `<option value="${esc(a.url)}">${esc(a.filename)} (${a.group})</option>`).join('');
      }
    };

    app.filterCrystalShopItemSelect = function (selectedId = null) {
      const sel = document.getElementById('cshopItemTemplateSelect');
      if (!sel) return;
      const q = (document.getElementById('cshopItemSearchInput')?.value || '').toLowerCase().trim();
      const targetId = selectedId !== null ? Number(selectedId) : Number(sel.value || 0);
      const list = (this.adminCrystalShopCatalogItems || []).filter((it) => {
        if (!q) return true;
        return (it.namePtBr || '').toLowerCase().includes(q) || (it.code || '').toLowerCase().includes(q) || String(it.id) === q;
      });
      sel.innerHTML = list
        .map((it) => `<option value="${it.id}" ${Number(it.id) === targetId ? 'selected' : ''}>#${it.id} • ${esc(it.namePtBr)} [${esc(it.rarityTier || 'COMMON')}] (${esc(it.equipmentSlotCode || it.itemCategory)})</option>`)
        .join('');
      this.onCrystalShopItemChanged();
    };

    app.onCrystalShopItemChanged = function () {
      const id = Number(document.getElementById('cshopItemTemplateSelect')?.value || 0);
      const it = (this.adminCrystalShopCatalogItems || []).find((x) => Number(x.id) === id);
      const iconEl = document.getElementById('cshopSelectedItemIcon');
      const metaEl = document.getElementById('cshopSelectedItemMeta');
      if (iconEl) iconEl.src = it?.iconUrl || '/play/assets/hud/menu_shop.png';
      if (metaEl) {
        metaEl.textContent = it
          ? `Código: ${it.code} • Nível Mín.: ${it.requiredLevel || 1} • Raridade: ${it.rarityTier || 'COMMON'}${it.descriptionPtBr ? ` • ${it.descriptionPtBr}` : ''}`
          : '';
      }
    };

    app.refreshCrystalShopPreviews = function () {
      const bUrl = (document.getElementById('cshopBannerUrlInput')?.value || '').trim();
      const bImg = document.getElementById('cshopBannerPreview');
      const bTxt = document.getElementById('cshopBannerEmptyTxt');
      if (bImg && bTxt) {
        if (bUrl) {
          bImg.src = bUrl;
          bImg.style.display = 'block';
          bTxt.style.display = 'none';
        } else {
          bImg.style.display = 'none';
          bTxt.style.display = 'block';
        }
      }

      const iUrl = (document.getElementById('cshopIconUrlInput')?.value || '').trim();
      const iImg = document.getElementById('cshopIconPreview');
      const iTxt = document.getElementById('cshopIconEmptyTxt');
      if (iImg && iTxt) {
        if (iUrl) {
          iImg.src = iUrl;
          iImg.style.display = 'block';
          iTxt.style.display = 'none';
        } else {
          iImg.style.display = 'none';
          iTxt.style.display = 'block';
        }
      }
    };

    app.renderCrystalShopTable = function () {
      const container = document.getElementById('crystalShopTableContainer');
      if (!container) return;

      const q = (document.getElementById('cshopSearchInput')?.value || '').toLowerCase().trim();
      const placement = document.getElementById('cshopPlacementFilter')?.value || 'ALL';
      const statusF = document.getElementById('cshopStatusFilter')?.value || 'ALL';

      const filtered = (this.adminCrystalShopOffers || []).filter((o) => {
        if (placement === 'FEATURED' && !o.isFeatured) return false;
        if (placement === 'GRID' && o.isFeatured) return false;
        if (statusF === 'ACTIVE' && !o.isActive) return false;
        if (statusF === 'INACTIVE' && o.isActive) return false;
        if (!q) return true;
        return (
          (o.titlePtBr || '').toLowerCase().includes(q) ||
          (o.itemNamePtBr || '').toLowerCase().includes(q) ||
          (o.code || '').toLowerCase().includes(q)
        );
      });

      const badge = document.getElementById('cshopCounterBadge');
      if (badge) badge.textContent = `${filtered.length} de ${this.adminCrystalShopOffers.length} oferta(s)`;

      if (filtered.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:32px; color:var(--text-muted); background:rgba(15,23,42,0.6); border-radius:8px;">Nenhuma oferta cadastrada na Loja Cristal ainda. Clique em <strong>➕ Nova Oferta Cristal</strong>!</div>`;
        return;
      }

      const scheduleBadge = (st) => {
        if (st === 'ACTIVE') return '<span style="color:#86efac; font-weight:700;">● Vigente</span>';
        if (st === 'SCHEDULED') return '<span style="color:#7dd3fc; font-weight:700;">⏳ Agendado</span>';
        if (st === 'EXPIRED') return '<span style="color:#fca5a5; font-weight:700;">⌛ Expirado</span>';
        return '<span style="color:#94a3b8;">○ Inativo</span>';
      };

      container.innerHTML = `
        <div style="overflow-x:auto;">
          <table class="data-table" style="width:100%; border-collapse:collapse; font-size:0.83rem; min-width:860px;">
            <thead>
              <tr style="border-bottom:1px solid var(--border); text-align:left; color:#94a3b8;">
                <th style="padding:10px; width:125px;">Ícone & Banner</th>
                <th style="padding:10px;">Oferta & Item</th>
                <th style="padding:10px; width:90px;">Qtd</th>
                <th style="padding:10px; width:125px; color:#38bdf8;">💎 Preço</th>
                <th style="padding:10px; width:155px;">Exibição</th>
                <th style="padding:10px; width:165px;">Vigência</th>
                <th style="padding:10px; width:65px;">Ordem</th>
                <th style="padding:10px; text-align:right; width:165px;">Ações</th>
              </tr>
            </thead>
            <tbody>
              ${filtered
                .map((o) => `
                  <tr style="border-bottom:1px solid rgba(51,65,85,0.4);">
                    <td style="padding:8px 10px;">
                      <div style="display:flex; align-items:center; gap:8px;">
                        <img src="${esc(o.iconUrl)}" alt="" style="width:38px; height:38px; object-fit:contain; border-radius:8px; border:1px solid #475569; background:#020617;" />
                        ${
                          o.bannerImageUrl
                            ? `<img src="${esc(o.bannerImageUrl)}" alt="" style="width:62px; height:38px; object-fit:cover; border-radius:6px; border:1px solid #334155;" />`
                            : '<span style="font-size:0.68rem; color:#64748b;">—</span>'
                        }
                      </div>
                    </td>
                    <td style="padding:8px 10px;">
                      <strong style="color:#f8fafc;">${esc(o.titlePtBr)}</strong>
                      <div style="font-size:0.71rem; color:#38bdf8; font-family:monospace;">${esc(o.code)} • ${esc(o.rarityTier)} (Nv.${o.requiredLevel})</div>
                      ${o.descriptionPtBr ? `<div style="font-size:0.72rem; color:#94a3b8; max-width:280px; margin-top:2px;">${esc(o.descriptionPtBr)}</div>` : ''}
                    </td>
                    <td style="padding:8px 10px; font-weight:700; color:#e2e8f0;">x${o.quantity}</td>
                    <td style="padding:8px 10px; font-weight:800; color:#7dd3fc;">💎 ${Number(o.priceCrystals).toLocaleString('pt-BR')}</td>
                    <td style="padding:8px 10px;">
                      ${
                        o.isFeatured
                          ? '<span style="padding:3px 8px; border-radius:99px; background:rgba(250,204,21,0.16); border:1px solid #eab308; color:#fde047; font-size:0.73rem; font-weight:700;">🌟 Carrossel</span>'
                          : '<span style="padding:3px 8px; border-radius:99px; background:rgba(56,189,248,0.15); border:1px solid #0ea5e9; color:#7dd3fc; font-size:0.73rem; font-weight:700;">💠 Grid Loja</span>'
                      }
                    </td>
                    <td style="padding:8px 10px; font-size:0.74rem;">${scheduleBadge(o.scheduleStatus)}</td>
                    <td style="padding:8px 10px; color:#cbd5e1; font-family:monospace;">#${o.sortOrder}</td>
                    <td style="padding:8px 10px; text-align:right; white-space:nowrap;">
                      <button type="button" class="btn-primary" style="padding:5px 9px; font-size:0.74rem; margin-right:4px;" onclick="AdminApp.openEditCrystalOfferModal(${o.id})">✏️ Editar</button>
                      <button type="button" style="padding:5px 8px; font-size:0.74rem; margin-right:4px; cursor:pointer;" title="Alternar Destaque" onclick="AdminApp.toggleCrystalOfferFeatured(${o.id})">${o.isFeatured ? '💠' : '🌟'}</button>
                      <button type="button" class="btn-danger" style="padding:5px 8px; font-size:0.74rem;" onclick="AdminApp.deleteCrystalOffer(${o.id}, '${esc(o.titlePtBr)}')">🗑️</button>
                    </td>
                  </tr>
                `)
                .join('')}
            </tbody>
          </table>
        </div>
      `;
    };

    app.openCreateCrystalOfferModal = async function () {
      await this.loadCrystalShopTab();
      document.getElementById('cshopEditIdInput').value = '';
      document.getElementById('cshopModalTitle').textContent = '💎 Nova Oferta da Loja Cristal';
      document.getElementById('cshopCodeInput').value = '';
      document.getElementById('cshopCodeInput').disabled = false;
      document.getElementById('cshopItemSearchInput').value = '';
      document.getElementById('cshopQuantityInput').value = '1';
      document.getElementById('cshopPriceInput').value = '100';
      document.getElementById('cshopFeaturedSelect').value = 'false';
      document.getElementById('cshopSortOrderInput').value = '10';
      document.getElementById('cshopActiveSelect').value = 'true';
      document.getElementById('cshopTitleInput').value = '';
      document.getElementById('cshopDescInput').value = '';
      document.getElementById('cshopStartsAtInput').value = '';
      document.getElementById('cshopEndsAtInput').value = '';
      document.getElementById('cshopBannerUrlInput').value = '';
      document.getElementById('cshopIconUrlInput').value = '';
      this.filterCrystalShopItemSelect();
      this.refreshCrystalShopPreviews();
      this.openModal('crystalShopOfferModal');
    };

    app.openEditCrystalOfferModal = async function (offerId) {
      await this.ensureCrystalShopCatalogItems();
      const o = (this.adminCrystalShopOffers || []).find((x) => Number(x.id) === Number(offerId));
      if (!o) return;
      document.getElementById('cshopEditIdInput').value = String(o.id);
      document.getElementById('cshopModalTitle').textContent = `✏️ Editar Oferta: ${o.titlePtBr}`;
      document.getElementById('cshopCodeInput').value = o.code || '';
      document.getElementById('cshopCodeInput').disabled = true;
      document.getElementById('cshopItemSearchInput').value = '';
      document.getElementById('cshopQuantityInput').value = String(o.quantity || 1);
      document.getElementById('cshopPriceInput').value = String(o.priceCrystals || 100);
      document.getElementById('cshopFeaturedSelect').value = o.isFeatured ? 'true' : 'false';
      document.getElementById('cshopSortOrderInput').value = String(o.sortOrder ?? 0);
      document.getElementById('cshopActiveSelect').value = o.isActive ? 'true' : 'false';
      document.getElementById('cshopTitleInput').value = o.rawTitlePtBr || '';
      document.getElementById('cshopDescInput').value = o.rawDescriptionPtBr || '';
      document.getElementById('cshopStartsAtInput').value = toLocalDateTimeInput(o.startsAt);
      document.getElementById('cshopEndsAtInput').value = toLocalDateTimeInput(o.endsAt);
      document.getElementById('cshopBannerUrlInput').value = o.bannerImageUrl || '';
      document.getElementById('cshopIconUrlInput').value = o.rawIconImageUrl || '';
      this.filterCrystalShopItemSelect(o.itemTemplateId);
      this.refreshCrystalShopPreviews();
      this.openModal('crystalShopOfferModal');
    };

    app.uploadCrystalShopAsset = function (kind, fileInput) {
      const file = fileInput?.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const res = await this.api('/api/admin/crystal-shop/upload-asset', {
            method: 'POST',
            body: JSON.stringify({ filename: file.name, kind, dataBase64: reader.result }),
          });
          if (kind === 'banner') document.getElementById('cshopBannerUrlInput').value = res.url;
          else document.getElementById('cshopIconUrlInput').value = res.url;
          this.refreshCrystalShopPreviews();
          const assets = await this.api('/api/admin/crystal-shop/assets').catch(() => []);
          this.adminCrystalShopAssets = Array.isArray(assets) ? assets : [];
          this.populateCrystalShopAssetPresets();
        } catch (err) {
          alert(`❌ Erro no upload: ${err.message}`);
        } finally {
          fileInput.value = '';
        }
      };
      reader.readAsDataURL(file);
    };

    app.saveCrystalShopOffer = async function () {
      try {
        const editId = document.getElementById('cshopEditIdInput').value;
        const payload = {
          code: document.getElementById('cshopCodeInput').value.trim(),
          itemTemplateId: Number(document.getElementById('cshopItemTemplateSelect').value),
          quantity: Number(document.getElementById('cshopQuantityInput').value) || 1,
          priceCrystals: Number(document.getElementById('cshopPriceInput').value) || 1,
          isFeatured: document.getElementById('cshopFeaturedSelect').value === 'true',
          sortOrder: Number(document.getElementById('cshopSortOrderInput').value) || 0,
          isActive: document.getElementById('cshopActiveSelect').value === 'true',
          titlePtBr: document.getElementById('cshopTitleInput').value.trim(),
          descriptionPtBr: document.getElementById('cshopDescInput').value.trim(),
          startsAt: fromLocalDateTimeInput(document.getElementById('cshopStartsAtInput').value),
          endsAt: fromLocalDateTimeInput(document.getElementById('cshopEndsAtInput').value),
          bannerImageUrl: document.getElementById('cshopBannerUrlInput').value.trim(),
          iconImageUrl: document.getElementById('cshopIconUrlInput').value.trim(),
        };

        if (editId) {
          await this.api(`/api/admin/crystal-shop/${editId}`, { method: 'PUT', body: JSON.stringify(payload) });
        } else {
          await this.api('/api/admin/crystal-shop', { method: 'POST', body: JSON.stringify(payload) });
        }
        this.closeModal('crystalShopOfferModal');
        await this.loadCrystalShopTab();
      } catch (err) {
        alert(`❌ Erro ao salvar oferta: ${err.message}`);
      }
    };

    app.toggleCrystalOfferFeatured = async function (offerId) {
      const o = (this.adminCrystalShopOffers || []).find((x) => Number(x.id) === Number(offerId));
      if (!o) return;
      try {
        await this.api(`/api/admin/crystal-shop/${o.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            code: o.code,
            itemTemplateId: o.itemTemplateId,
            quantity: o.quantity,
            priceCrystals: o.priceCrystals,
            titlePtBr: o.rawTitlePtBr,
            descriptionPtBr: o.rawDescriptionPtBr,
            bannerImageUrl: o.bannerImageUrl,
            iconImageUrl: o.rawIconImageUrl,
            isFeatured: !o.isFeatured,
            sortOrder: o.sortOrder,
            isActive: o.isActive,
            startsAt: o.startsAt,
            endsAt: o.endsAt,
          }),
        });
        await this.loadCrystalShopTab();
      } catch (err) {
        alert(`Erro ao alternar destaque: ${err.message}`);
      }
    };

    app.deleteCrystalOffer = async function (offerId, title) {
      if (!confirm(`Excluir a oferta "${title}" (#${offerId}) da Loja Cristal?`)) return;
      try {
        await this.api(`/api/admin/crystal-shop/${offerId}`, { method: 'DELETE' });
        await this.loadCrystalShopTab();
      } catch (err) {
        alert(`Erro ao excluir oferta: ${err.message}`);
      }
    };
  }
}

window.AdminCrystalShopTab = AdminCrystalShopTab;
