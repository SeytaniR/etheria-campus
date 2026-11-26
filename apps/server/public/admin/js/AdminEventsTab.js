/**
 * @file AdminEventsTab.js
 * @description Controlador CRUD da aba 🎉 Eventos no painel Admin: listagem de Carrossel vs Grid,
 *   upload de banners/ícones locais, vigência e edição dia-a-dia de Ouro, XP e Itens.
 */
class AdminEventsTab {
  static attach(app) {
    app.adminEventsList = [];
    app.adminEventLocalAssets = [];
    app.adminEventItemsCatalog = [];
    app.editingEventDays = [];

    window.AdminEventsModalDom?.injectTabAndModalDom();

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

    app.loadEventsTab = async function () {
      try {
        const [events, assets] = await Promise.all([
          this.api('/api/admin/events'),
          this.api('/api/admin/events/assets').catch(() => []),
        ]);
        this.adminEventsList = Array.isArray(events) ? events : [];
        this.adminEventLocalAssets = Array.isArray(assets) ? assets : [];

        if (!this.adminEventItemsCatalog || this.adminEventItemsCatalog.length === 0) {
          try {
            const items = await this.api('/api/admin/items');
            this.adminEventItemsCatalog = Array.isArray(items) ? items : [];
          } catch {
            this.adminEventItemsCatalog = [];
          }
        }

        this.populateEventAssetPresets();
        this.renderEventsCrudTable();
      } catch (err) {
        console.error('Erro ao carregar eventos no Admin:', err);
      }
    };

    app.populateEventAssetPresets = function () {
      const bSel = document.getElementById('evBannerPresetSelect');
      const iSel = document.getElementById('evIconPresetSelect');
      const assets = this.adminEventLocalAssets || [];

      if (bSel) {
        bSel.innerHTML = `<option value="">Selecionar banner local...</option>` +
          assets.map((a) => `<option value="${esc(a.url)}">${esc(a.filename)} (${a.group})</option>`).join('');
      }
      if (iSel) {
        iSel.innerHTML = `<option value="">Selecionar ícone local...</option>` +
          assets.map((a) => `<option value="${esc(a.url)}">${esc(a.filename)} (${a.group})</option>`).join('');
      }
    };

    app.refreshEventImagePreviews = function () {
      const bUrl = (document.getElementById('evBannerUrlInput')?.value || '').trim();
      const bImg = document.getElementById('evBannerPreview');
      const bTxt = document.getElementById('evBannerEmptyTxt');
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

      const iUrl = (document.getElementById('evIconUrlInput')?.value || '').trim();
      const iImg = document.getElementById('evIconPreview');
      const iTxt = document.getElementById('evIconEmptyTxt');
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

    app.renderEventsCrudTable = function () {
      const container = document.getElementById('eventsTableContainer');
      if (!container) return;

      const q = (document.getElementById('eventsSearchInput')?.value || '').toLowerCase().trim();
      const placement = document.getElementById('eventsPlacementFilter')?.value || 'ALL';
      const statusF = document.getElementById('eventsStatusFilter')?.value || 'ALL';

      const filtered = (this.adminEventsList || []).filter((ev) => {
        if (placement === 'FEATURED' && !ev.isFeatured) return false;
        if (placement === 'GRID' && ev.isFeatured) return false;
        if (statusF === 'ACTIVE' && !ev.isActive) return false;
        if (statusF === 'INACTIVE' && ev.isActive) return false;
        if (!q) return true;
        return (ev.titlePtBr || '').toLowerCase().includes(q) || (ev.code || '').toLowerCase().includes(q);
      });

      const badge = document.getElementById('eventsCounterBadge');
      if (badge) badge.textContent = `${filtered.length} de ${this.adminEventsList.length} evento(s)`;

      if (filtered.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:32px; color:var(--text-muted); background:rgba(15,23,42,0.6); border-radius:8px;">Nenhum evento encontrado com os filtros selecionados.</div>`;
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
          <table class="data-table" style="width:100%; border-collapse:collapse; font-size:0.83rem; min-width:840px;">
            <thead>
              <tr style="border-bottom:1px solid var(--border); text-align:left; color:#94a3b8;">
                <th style="padding:10px; width:130px;">Banner & Ícone</th>
                <th style="padding:10px;">Evento & Código</th>
                <th style="padding:10px; width:165px;">Exibição</th>
                <th style="padding:10px; width:110px;">Duração</th>
                <th style="padding:10px; width:170px;">Vigência</th>
                <th style="padding:10px; width:70px;">Ordem</th>
                <th style="padding:10px; text-align:right; width:175px;">Ações</th>
              </tr>
            </thead>
            <tbody>
              ${filtered
                .map((ev) => {
                  const daysCount = ev.configJson?.totalDays || ev.configJson?.days?.length || 0;
                  const startTxt = ev.startsAt ? new Date(ev.startsAt).toLocaleString('pt-BR') : 'Imediato';
                  const endTxt = ev.endsAt ? new Date(ev.endsAt).toLocaleString('pt-BR') : 'Permanente';
                  return `
                    <tr style="border-bottom:1px solid rgba(51,65,85,0.4);">
                      <td style="padding:8px 10px;">
                        <div style="display:flex; align-items:center; gap:8px;">
                          <img src="${esc(ev.iconImageUrl || '/play/assets/hud/menu_events.png')}" alt="" style="width:38px; height:38px; object-fit:cover; border-radius:8px; border:1px solid #475569; background:#020617;" />
                          <img src="${esc(ev.bannerImageUrl || ev.iconImageUrl || '/play/assets/hud/menu_events.png')}" alt="" style="width:68px; height:38px; object-fit:cover; border-radius:6px; border:1px solid #334155; background:#020617;" />
                        </div>
                      </td>
                      <td style="padding:8px 10px;">
                        <strong style="color:#f8fafc; font-size:0.9rem;">${esc(ev.titlePtBr)}</strong>
                        <div style="font-size:0.71rem; color:#38bdf8; font-family:monospace;">${esc(ev.code)} • ${esc(ev.eventType)}</div>
                        ${ev.descriptionPtBr ? `<div style="font-size:0.72rem; color:#94a3b8; max-width:300px; margin-top:2px;">${esc(ev.descriptionPtBr)}</div>` : ''}
                      </td>
                      <td style="padding:8px 10px;">
                        ${
                          ev.isFeatured
                            ? '<span style="padding:3px 8px; border-radius:99px; background:rgba(250,204,21,0.16); border:1px solid #eab308; color:#fde047; font-size:0.73rem; font-weight:700;">🌟 Carrossel</span>'
                            : '<span style="padding:3px 8px; border-radius:99px; background:rgba(56,189,248,0.15); border:1px solid #0ea5e9; color:#7dd3fc; font-size:0.73rem; font-weight:700;">💠 Grid Ícones</span>'
                        }
                      </td>
                      <td style="padding:8px 10px; font-weight:700; color:#cbd5e1;">${daysCount} dia(s)</td>
                      <td style="padding:8px 10px; font-size:0.74rem;">
                        <div>${scheduleBadge(ev.scheduleStatus)}</div>
                        <div style="color:#94a3b8; margin-top:2px;">Início: ${esc(startTxt)}</div>
                        <div style="color:#94a3b8;">Fim: ${esc(endTxt)}</div>
                      </td>
                      <td style="padding:8px 10px; color:#cbd5e1; font-family:monospace;">#${ev.sortOrder}</td>
                      <td style="padding:8px 10px; text-align:right; white-space:nowrap;">
                        <button type="button" class="btn-primary" style="padding:5px 9px; font-size:0.74rem; margin-right:4px;" onclick="AdminApp.openEditEventModal(${ev.id})">✏️ Editar</button>
                        <button type="button" style="padding:5px 8px; font-size:0.74rem; margin-right:4px; cursor:pointer;" title="Alternar Destaque Carrossel/Grid" onclick="AdminApp.toggleEventFeatured(${ev.id})">${ev.isFeatured ? '💠' : '🌟'}</button>
                        <button type="button" class="btn-danger" style="padding:5px 8px; font-size:0.74rem;" onclick="AdminApp.deleteEventTemplate(${ev.id}, '${esc(ev.titlePtBr)}')">🗑️</button>
                      </td>
                    </tr>
                  `;
                })
                .join('')}
            </tbody>
          </table>
        </div>
      `;
    };

    app.openCreateEventModal = async function () {
      await this.loadEventsTab();
      document.getElementById('evEditIdInput').value = '';
      document.getElementById('evModalTitle').textContent = '🎉 Criar Novo Evento';
      document.getElementById('evCodeInput').value = '';
      document.getElementById('evCodeInput').disabled = false;
      document.getElementById('evTypeSelect').value = 'DAILY_LOGIN';
      document.getElementById('evFeaturedSelect').value = 'false';
      document.getElementById('evSortOrderInput').value = '30';
      document.getElementById('evActiveSelect').value = 'true';
      document.getElementById('evTitleInput').value = '';
      document.getElementById('evDescInput').value = '';
      document.getElementById('evStartsAtInput').value = '';
      document.getElementById('evEndsAtInput').value = '';
      document.getElementById('evBannerUrlInput').value = '/play/assets/events/banner_login_7d.png';
      document.getElementById('evIconUrlInput').value = '/play/assets/events/icon_login_7d.png';
      document.getElementById('evTotalDaysInput').value = '7';
      this.editingEventDays = Array.from({ length: 7 }, (_, i) => ({
        day: i + 1,
        title: `Dia ${i + 1}`,
        gold: (i + 1) * 200,
        exp: (i + 1) * 300,
        items: [],
      }));
      this.refreshEventImagePreviews();
      this.renderEventDaysEditor();
      this.openModal('eventEditorModal');
    };

    app.openEditEventModal = async function (eventId) {
      if (!this.adminEventItemsCatalog || this.adminEventItemsCatalog.length === 0) {
        await this.loadEventsTab();
      }
      const ev = (this.adminEventsList || []).find((x) => x.id === Number(eventId));
      if (!ev) return;

      document.getElementById('evEditIdInput').value = String(ev.id);
      document.getElementById('evModalTitle').textContent = `✏️ Editar Evento: ${ev.titlePtBr}`;
      document.getElementById('evCodeInput').value = ev.code || '';
      document.getElementById('evCodeInput').disabled = true;
      document.getElementById('evTypeSelect').value = ev.eventType || 'DAILY_LOGIN';
      document.getElementById('evFeaturedSelect').value = ev.isFeatured ? 'true' : 'false';
      document.getElementById('evSortOrderInput').value = String(ev.sortOrder ?? 0);
      document.getElementById('evActiveSelect').value = ev.isActive ? 'true' : 'false';
      document.getElementById('evTitleInput').value = ev.titlePtBr || '';
      document.getElementById('evDescInput').value = ev.descriptionPtBr || '';
      document.getElementById('evStartsAtInput').value = toLocalDateTimeInput(ev.startsAt);
      document.getElementById('evEndsAtInput').value = toLocalDateTimeInput(ev.endsAt);
      document.getElementById('evBannerUrlInput').value = ev.bannerImageUrl || '';
      document.getElementById('evIconUrlInput').value = ev.iconImageUrl || '';

      const rawDays = Array.isArray(ev.configJson?.days) ? ev.configJson.days : [];
      const totalDays = Math.max(1, Number(ev.configJson?.totalDays || rawDays.length || 7));
      document.getElementById('evTotalDaysInput').value = String(totalDays);
      this.editingEventDays = Array.from({ length: totalDays }, (_, idx) => {
        const dNum = idx + 1;
        const found = rawDays.find((r) => Number(r.day) === dNum);
        return {
          day: dNum,
          title: found?.title || `Dia ${dNum}`,
          gold: Number(found?.gold) || 0,
          exp: Number(found?.exp) || 0,
          items: Array.isArray(found?.items) ? found.items.map((it) => ({ ...it })) : [],
        };
      });

      this.refreshEventImagePreviews();
      this.renderEventDaysEditor();
      this.openModal('eventEditorModal');
    };

    app.resizeEventDays = function (count) {
      const total = Math.min(60, Math.max(1, Math.round(Number(count) || 7)));
      document.getElementById('evTotalDaysInput').value = String(total);
      const current = this.editingEventDays || [];
      this.editingEventDays = Array.from({ length: total }, (_, idx) => {
        const dNum = idx + 1;
        return current[idx]
          ? { ...current[idx], day: dNum }
          : { day: dNum, title: `Dia ${dNum}`, gold: dNum * 150, exp: dNum * 250, items: [] };
      });
      this.renderEventDaysEditor();
    };

    app.fillDefaultEventCurve = function () {
      const total = this.editingEventDays.length || 7;
      this.editingEventDays = this.editingEventDays.map((d, idx) => ({
        ...d,
        title: (idx + 1) === total ? `Dia ${idx + 1} • Grande Prêmio` : `Dia ${idx + 1}`,
        gold: Math.round(150 + (idx + 1) * 120 + ((idx + 1) % 5 === 0 ? 500 : 0)),
        exp: Math.round(200 + (idx + 1) * 180 + ((idx + 1) % 5 === 0 ? 800 : 0)),
      }));
      this.renderEventDaysEditor();
    };

    app.updateEditingEventDayField = function (dayIdx, field, value) {
      const day = this.editingEventDays?.[dayIdx];
      if (!day) return;
      if (field === 'title') day.title = value;
      if (field === 'gold') day.gold = Math.max(0, Math.round(Number(value) || 0));
      if (field === 'exp') day.exp = Math.max(0, Math.round(Number(value) || 0));
    };

    app.addEventDayItem = function (dayIdx) {
      const day = this.editingEventDays?.[dayIdx];
      const sel = document.getElementById(`evDayAddItemSelect_${dayIdx}`);
      const qtyInput = document.getElementById(`evDayAddQtyInput_${dayIdx}`);
      const itemId = Number(sel?.value || 0);
      const qty = Math.min(999, Math.max(1, Math.round(Number(qtyInput?.value) || 1)));
      if (!day || !itemId) return;
      const existing = day.items.find((it) => Number(it.itemTemplateId) === itemId);
      if (existing) existing.quantity += qty;
      else day.items.push({ itemTemplateId: itemId, quantity: qty });
      this.renderEventDaysEditor();
    };

    app.removeEventDayItem = function (dayIdx, itemIdx) {
      const day = this.editingEventDays?.[dayIdx];
      if (!day) return;
      day.items.splice(itemIdx, 1);
      this.renderEventDaysEditor();
    };

    app.renderEventDaysEditor = function () {
      const listEl = document.getElementById('evDaysEditorList');
      if (!listEl) return;
      const catalog = this.adminEventItemsCatalog || [];
      const itemMap = new Map(catalog.map((it) => [Number(it.id), it]));
      const itemOptions = catalog.map((it) => `<option value="${it.id}">${esc(it.namePtBr)} (#${it.id})</option>`).join('');

      listEl.innerHTML = (this.editingEventDays || [])
        .map((d, idx) => {
          const itemsChips = (d.items || [])
            .map((spec, sIdx) => {
              const info = itemMap.get(Number(spec.itemTemplateId));
              const label = info ? `${info.namePtBr} x${spec.quantity}` : `Item #${spec.itemTemplateId} x${spec.quantity}`;
              return `<span style="display:inline-flex; align-items:center; gap:5px; padding:2px 7px; border-radius:99px; background:#0f172a; border:1px solid #334155; font-size:0.72rem; color:#bae6fd;">
                ${esc(label)}
                <button type="button" onclick="AdminApp.removeEventDayItem(${idx}, ${sIdx})" style="background:none; border:none; color:#f87171; cursor:pointer; font-weight:700; padding:0;">✕</button>
              </span>`;
            })
            .join(' ');

          return `
            <div style="background:#020617; border:1px solid #1e293b; border-radius:8px; padding:8px 10px; display:flex; flex-direction:column; gap:6px;">
              <div style="display:grid; grid-template-columns:70px 1fr 110px 110px; gap:8px; align-items:center;">
                <span style="font-weight:800; color:#fde047; font-size:0.8rem;">Dia ${d.day}</span>
                <input type="text" value="${esc(d.title)}" oninput="AdminApp.updateEditingEventDayField(${idx}, 'title', this.value)" placeholder="Título do dia" style="padding:5px 7px; font-size:0.78rem;" />
                <input type="number" min="0" value="${d.gold}" oninput="AdminApp.updateEditingEventDayField(${idx}, 'gold', this.value)" title="Ouro" placeholder="Ouro" style="padding:5px 7px; font-size:0.78rem;" />
                <input type="number" min="0" value="${d.exp}" oninput="AdminApp.updateEditingEventDayField(${idx}, 'exp', this.value)" title="XP" placeholder="XP" style="padding:5px 7px; font-size:0.78rem;" />
              </div>
              <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
                ${itemsChips || '<span style="font-size:0.72rem; color:#64748b;">Sem itens extras</span>'}
                <select id="evDayAddItemSelect_${idx}" style="margin-left:auto; max-width:230px; padding:4px 6px; font-size:0.74rem;">
                  <option value="">+ Adicionar item...</option>
                  ${itemOptions}
                </select>
                <input type="number" id="evDayAddQtyInput_${idx}" min="1" max="999" value="1" style="width:54px; padding:4px 6px; font-size:0.74rem;" />
                <button type="button" onclick="AdminApp.addEventDayItem(${idx})" style="padding:4px 8px; font-size:0.72rem; cursor:pointer; border-radius:4px;">➕ Item</button>
              </div>
            </div>
          `;
        })
        .join('');
    };

    app.uploadEventAssetFile = function (kind, fileInput) {
      const file = fileInput?.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const res = await this.api('/api/admin/events/upload-asset', {
            method: 'POST',
            body: JSON.stringify({
              filename: file.name,
              kind,
              dataBase64: reader.result,
            }),
          });
          if (kind === 'banner') {
            document.getElementById('evBannerUrlInput').value = res.url;
          } else {
            document.getElementById('evIconUrlInput').value = res.url;
          }
          this.refreshEventImagePreviews();
          const assets = await this.api('/api/admin/events/assets').catch(() => []);
          this.adminEventLocalAssets = Array.isArray(assets) ? assets : [];
          this.populateEventAssetPresets();
        } catch (err) {
          alert(`❌ Erro no upload: ${err.message}`);
        } finally {
          fileInput.value = '';
        }
      };
      reader.readAsDataURL(file);
    };

    app.saveEventTemplate = async function () {
      try {
        const editId = document.getElementById('evEditIdInput').value;
        const payload = {
          code: document.getElementById('evCodeInput').value.trim(),
          eventType: document.getElementById('evTypeSelect').value,
          titlePtBr: document.getElementById('evTitleInput').value.trim(),
          descriptionPtBr: document.getElementById('evDescInput').value.trim(),
          bannerImageUrl: document.getElementById('evBannerUrlInput').value.trim(),
          iconImageUrl: document.getElementById('evIconUrlInput').value.trim(),
          isFeatured: document.getElementById('evFeaturedSelect').value === 'true',
          sortOrder: Number(document.getElementById('evSortOrderInput').value) || 0,
          isActive: document.getElementById('evActiveSelect').value === 'true',
          startsAt: fromLocalDateTimeInput(document.getElementById('evStartsAtInput').value),
          endsAt: fromLocalDateTimeInput(document.getElementById('evEndsAtInput').value),
          configJson: {
            totalDays: this.editingEventDays.length,
            days: this.editingEventDays,
          },
        };

        if (editId) {
          await this.api(`/api/admin/events/${editId}`, { method: 'PUT', body: JSON.stringify(payload) });
        } else {
          await this.api('/api/admin/events', { method: 'POST', body: JSON.stringify(payload) });
        }

        this.closeModal('eventEditorModal');
        await this.loadEventsTab();
      } catch (err) {
        alert(`❌ Erro ao salvar evento: ${err.message}`);
      }
    };

    app.toggleEventFeatured = async function (eventId) {
      const ev = (this.adminEventsList || []).find((x) => x.id === Number(eventId));
      if (!ev) return;
      try {
        await this.api(`/api/admin/events/${ev.id}`, {
          method: 'PUT',
          body: JSON.stringify({ ...ev, isFeatured: !ev.isFeatured }),
        });
        await this.loadEventsTab();
      } catch (err) {
        alert(`Erro ao alternar destaque: ${err.message}`);
      }
    };

    app.deleteEventTemplate = async function (eventId, title) {
      if (!confirm(`Deseja realmente excluir o evento "${title}" (#${eventId})?`)) return;
      try {
        await this.api(`/api/admin/events/${eventId}`, { method: 'DELETE' });
        await this.loadEventsTab();
      } catch (err) {
        alert(`Erro ao excluir evento: ${err.message}`);
      }
    };
  }
}

window.AdminEventsTab = AdminEventsTab;
