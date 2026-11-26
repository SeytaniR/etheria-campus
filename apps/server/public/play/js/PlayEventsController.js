/**
 * @file apps/server/public/play/js/PlayEventsController.js
 * @module @etheria/client/events
 * @description Orquestrador do Hub Modular de Eventos no /play:
 *   - Badge no botão Eventos do menu inferior (#hudBottomEventsBadge) com pendências do personagem.
 *   - Hub responsivo com Carrossel de Destaques no topo (swipe/arraste + bolinhas) e Grid limpa de ícones abaixo.
 *   - Navegação interna por submódulo (window.PlayEventModules[eventType]) com botão "← Voltar".
 */
class PlayEventsController {
  constructor() {
    this.client = null;
    this.modalEl = null;
    this.eventsState = null;
    this.view = 'HUB'; // 'HUB' | 'DETAIL'
    this.activeEventId = null;
    this.carouselIndex = 0;
    this.claiming = false;
    this.feedback = null;
    this._resetTimer = null;
  }

  esc(v) {
    return String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  applyBadgeCount(count) {
    const badge = document.getElementById('hudBottomEventsBadge');
    if (!badge) return;
    const n = Math.max(0, Number(count) || 0);
    if (n > 0) {
      badge.textContent = n > 99 ? '99+' : String(n);
      badge.style.display = 'flex';
    } else {
      badge.textContent = '0';
      badge.style.display = 'none';
    }
  }

  scheduleMidnightRefresh(client, secondsUntilReset) {
    if (this._resetTimer) {
      clearTimeout(this._resetTimer);
      this._resetTimer = null;
    }
    const sec = Number(secondsUntilReset);
    if (!Number.isFinite(sec) || sec <= 0 || sec > 90000) return;
    this._resetTimer = setTimeout(() => {
      this.refreshBadge(client);
      if (this.modalEl && this.modalEl.style.display !== 'none') {
        this.loadEvents(client);
      }
    }, (sec + 2) * 1000);
  }

  async refreshBadge(client) {
    const app = client || this.client || window.PlayApp;
    const charId = app?.activeChar?.id;
    if (!app?.api || !charId) {
      this.applyBadgeCount(0);
      return null;
    }
    this.client = app;
    try {
      const state = await app.api(`/api/play/characters/${charId}/events`);
      this.eventsState = state;
      this.applyBadgeCount(state?.pendingCount || 0);
      this.scheduleMidnightRefresh(app, state?.secondsUntilReset);
      return state;
    } catch {
      return null;
    }
  }

  async openModal(client) {
    const app = client || this.client || window.PlayApp;
    if (!app?.activeChar?.id) return;
    this.client = app;
    this.view = 'HUB';
    this.activeEventId = null;
    this.feedback = null;
    this.carouselIndex = 0;

    this.ensureModalDom();
    this.modalEl.style.display = 'flex';
    this.renderBody();
    await this.loadEvents(app);
  }

  closeModal() {
    if (this.modalEl) {
      this.modalEl.style.display = 'none';
    }
    this.feedback = null;
  }

  async loadEvents(client) {
    const app = client || this.client;
    const charId = app?.activeChar?.id;
    if (!app || !charId) return;
    try {
      const state = await app.api(`/api/play/characters/${charId}/events`);
      this.eventsState = state;
      this.applyBadgeCount(state?.pendingCount || 0);
      this.scheduleMidnightRefresh(app, state?.secondsUntilReset);
      const featLen = state?.featuredEvents?.length || 0;
      if (featLen > 0 && this.carouselIndex >= featLen) {
        this.carouselIndex = 0;
      }
      this.renderBody();
    } catch (err) {
      this.feedback = { type: 'error', message: err.message || 'Erro ao carregar eventos.' };
      this.renderBody();
    }
  }

  ensureModalDom() {
    if (this.modalEl) return;
    const backdrop = document.createElement('div');
    backdrop.id = 'playEventsModal';
    backdrop.className = 'events-modal-backdrop';
    backdrop.style.display = 'none';
    backdrop.innerHTML = `
      <div class="events-modal-shell" role="dialog" aria-modal="true" aria-label="Eventos">
        <div class="events-modal-header">
          <div class="events-header-left">
            <button type="button" id="evModalBackBtn" class="events-back-btn" style="display:none;">← Voltar</button>
            <h3 id="evModalHeaderTitle" class="events-header-title">🎉 Eventos</h3>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span id="evModalResetMeta" class="events-header-meta"></span>
            <button type="button" id="evModalCloseBtn" class="events-close-btn">✕</button>
          </div>
        </div>
        <div id="evModalBody" class="events-modal-body"></div>
      </div>
    `;
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) this.closeModal();
    });
    backdrop.querySelector('#evModalCloseBtn').addEventListener('click', () => this.closeModal());
    backdrop.querySelector('#evModalBackBtn').addEventListener('click', () => {
      this.view = 'HUB';
      this.activeEventId = null;
      this.feedback = null;
      this.renderBody();
    });

    document.body.appendChild(backdrop);
    this.modalEl = backdrop;
  }

  findEventById(id) {
    if (!this.eventsState) return null;
    const all = [...(this.eventsState.featuredEvents || []), ...(this.eventsState.gridEvents || [])];
    return all.find((e) => Number(e.id) === Number(id)) || null;
  }

  openEventDetail(eventId) {
    const ev = this.findEventById(eventId);
    if (!ev) return;
    this.view = 'DETAIL';
    this.activeEventId = ev.id;
    this.feedback = null;
    this.renderBody();
  }

  setCarouselSlide(idx) {
    const total = this.eventsState?.featuredEvents?.length || 0;
    if (total === 0) return;
    this.carouselIndex = ((idx % total) + total) % total;
    const track = this.modalEl?.querySelector('#evCarouselTrack');
    if (track) {
      track.style.transform = `translateX(-${this.carouselIndex * 100}%)`;
    }
    const dots = this.modalEl?.querySelectorAll('.events-carousel-dot') || [];
    dots.forEach((dot, i) => {
      dot.classList.toggle('is-active', i === this.carouselIndex);
    });
  }

  async handleClaim(eventId) {
    const app = this.client || window.PlayApp;
    const charId = app?.activeChar?.id;
    if (!app || !charId || this.claiming) return;

    this.claiming = true;
    this.feedback = null;
    this.renderBody();

    try {
      const res = await app.api(`/api/play/characters/${charId}/events/${eventId}/claim`, {
        method: 'POST',
        body: JSON.stringify({}),
      });

      if (res?.eventsState) {
        this.eventsState = res.eventsState;
        this.applyBadgeCount(res.eventsState.pendingCount || 0);
      }

      if (res?.gold !== undefined && app.activeChar) {
        app.activeChar.gold = Number(res.gold);
      }
      if (res?.progression?.player && app.activeChar) {
        app.activeChar.level = res.progression.player.newLevel;
        app.activeChar.experience = res.progression.player.newExp;
        if (res.progression.player.unspentStatPoints !== undefined) {
          app.activeChar.unspentStatPoints = res.progression.player.unspentStatPoints;
        }
      }
      window.PlayHudController?.updatePlayer?.(app.activeChar);
      if (typeof window.PlayBagController?.loadBag === 'function' && document.getElementById('bagModalBackdrop')?.style.display === 'flex') {
        window.PlayBagController.loadBag();
      }

      const parts = [];
      if (res?.rewards?.gold > 0) parts.push(`+${res.rewards.gold} Ouro`);
      if (res?.rewards?.exp > 0) parts.push(`+${res.rewards.exp} XP`);
      if (Array.isArray(res?.rewards?.items) && res.rewards.items.length > 0) {
        parts.push(res.rewards.items.map((it) => `${it.namePtBr} x${it.quantity}`).join(', '));
      }
      const msg = `🎉 Dia ${res?.claimedDay || ''} resgatado! ${parts.join(' • ')}`;
      this.feedback = { type: 'success', message: msg };
      app.showToast?.(msg);
    } catch (err) {
      const msg = err.message || 'Não foi possível resgatar a recompensa.';
      this.feedback = { type: 'error', message: msg };
      app.showToast?.(msg);
    } finally {
      this.claiming = false;
      this.renderBody();
    }
  }

  renderBody() {
    if (!this.modalEl) return;
    const backBtn = this.modalEl.querySelector('#evModalBackBtn');
    const titleEl = this.modalEl.querySelector('#evModalHeaderTitle');
    const resetMetaEl = this.modalEl.querySelector('#evModalResetMeta');
    const bodyEl = this.modalEl.querySelector('#evModalBody');

    if (!this.eventsState) {
      backBtn.style.display = 'none';
      titleEl.textContent = '🎉 Eventos';
      bodyEl.innerHTML = `<div style="text-align:center; padding:40px 16px; color:#94a3b8;">Carregando eventos...</div>`;
      return;
    }

    if (resetMetaEl) {
      resetMetaEl.textContent = `Virada diária 00:00 BRT`;
    }

    if (this.view === 'DETAIL' && this.activeEventId) {
      const ev = this.findEventById(this.activeEventId);
      if (ev) {
        backBtn.style.display = 'inline-flex';
        titleEl.textContent = ev.titlePtBr || 'Evento';
        const mod = window.PlayEventModules?.[ev.eventType];
        if (mod) {
          bodyEl.innerHTML = mod.render(ev, {
            claiming: this.claiming,
            feedback: this.feedback,
            secondsUntilReset: this.eventsState.secondsUntilReset,
          });
          mod.bindEvents(bodyEl, ev, { onClaim: (id) => this.handleClaim(id) });
        } else {
          bodyEl.innerHTML = `<div style="padding:24px; text-align:center; color:#94a3b8;">Módulo "${this.esc(ev.eventType)}" em breve.</div>`;
        }
        return;
      }
      this.view = 'HUB';
      this.activeEventId = null;
    }

    backBtn.style.display = 'none';
    titleEl.textContent = '🎉 Eventos';

    const featured = this.eventsState.featuredEvents || [];
    const grid = this.eventsState.gridEvents || [];

    if (featured.length === 0 && grid.length === 0) {
      bodyEl.innerHTML = `<div style="text-align:center; padding:40px 16px; color:#94a3b8;">Nenhum evento ativo no momento.</div>`;
      return;
    }

    const carouselHtml =
      featured.length > 0
        ? `
          <section class="events-carousel-section">
            <div class="events-carousel-viewport" id="evCarouselViewport">
              <div class="events-carousel-track" id="evCarouselTrack" style="transform:translateX(-${this.carouselIndex * 100}%);">
                ${featured
                  .map((ev) => {
                    const bg = ev.bannerImageUrl || '/play/assets/events/banner_login_7d.png';
                    const icon = ev.iconImageUrl || '/play/assets/hud/menu_events.png';
                    const badge = ev.hasPendingReward
                      ? '<span class="events-pill-pending">🎁 Check-in disponível</span>'
                      : ev.progress?.isCompleted
                      ? '<span class="events-pill-done">✓ Concluído</span>'
                      : '';
                    return `
                      <div class="events-slide-card" data-event-id="${ev.id}" style="background-image:url('${this.esc(bg)}');">
                        <div class="events-slide-scrim"></div>
                        <div class="events-slide-content">
                          <img class="events-slide-icon" src="${this.esc(icon)}" alt="${this.esc(ev.titlePtBr)}" />
                          <div class="events-slide-text">
                            <div class="events-slide-top-badges">${badge}</div>
                            <h4 class="events-slide-title">${this.esc(ev.titlePtBr)}</h4>
                            <p class="events-slide-desc">${this.esc(ev.descriptionPtBr || '')}</p>
                          </div>
                        </div>
                      </div>
                    `;
                  })
                  .join('')}
              </div>
              ${
                featured.length > 1
                  ? `<button type="button" class="events-carousel-arrow prev" id="evCarouselPrev" aria-label="Anterior">‹</button>
                     <button type="button" class="events-carousel-arrow next" id="evCarouselNext" aria-label="Próximo">›</button>`
                  : ''
              }
            </div>
            ${
              featured.length > 1
                ? `<div class="events-carousel-dots">
                    ${featured
                      .map(
                        (_, i) =>
                          `<button type="button" class="events-carousel-dot ${i === this.carouselIndex ? 'is-active' : ''}" data-dot-idx="${i}" aria-label="Destaque ${i + 1}"></button>`
                      )
                      .join('')}
                   </div>`
                : ''
            }
          </section>
        `
        : '';

    const gridHtml =
      grid.length > 0
        ? `
          <section class="events-grid-section">
            <div class="events-grid-heading">Eventos</div>
            <div class="events-icon-grid">
              ${grid
                .map((ev) => {
                  const icon = ev.iconImageUrl || '/play/assets/hud/menu_events.png';
                  return `
                    <button type="button" class="events-grid-tile" data-event-id="${ev.id}" title="${this.esc(ev.titlePtBr)}">
                      <img src="${this.esc(icon)}" alt="${this.esc(ev.titlePtBr)}" />
                      ${ev.hasPendingReward ? '<span class="events-tile-pending-dot" title="Recompensa disponível"></span>' : ''}
                    </button>
                  `;
                })
                .join('')}
            </div>
          </section>
        `
        : '';

    bodyEl.innerHTML = carouselHtml + gridHtml;
    this.bindHubInteractions(bodyEl);
  }

  bindHubInteractions(bodyEl) {
    const viewport = bodyEl.querySelector('#evCarouselViewport');
    let pointerStartX = null;
    let pointerMovedX = 0;

    if (viewport) {
      viewport.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.events-carousel-arrow')) return;
        pointerStartX = e.clientX;
        pointerMovedX = 0;
      });
      viewport.addEventListener('pointermove', (e) => {
        if (pointerStartX === null) return;
        pointerMovedX = e.clientX - pointerStartX;
      });
      const endSwipe = () => {
        if (pointerStartX === null) return;
        if (Math.abs(pointerMovedX) >= 40) {
          this.setCarouselSlide(this.carouselIndex + (pointerMovedX < 0 ? 1 : -1));
        }
        pointerStartX = null;
        setTimeout(() => { pointerMovedX = 0; }, 50);
      };
      viewport.addEventListener('pointerup', endSwipe);
      viewport.addEventListener('pointercancel', endSwipe);

      bodyEl.querySelector('#evCarouselPrev')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.setCarouselSlide(this.carouselIndex - 1);
      });
      bodyEl.querySelector('#evCarouselNext')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.setCarouselSlide(this.carouselIndex + 1);
      });
      bodyEl.querySelectorAll('.events-carousel-dot').forEach((dot) => {
        dot.addEventListener('click', () => this.setCarouselSlide(Number(dot.getAttribute('data-dot-idx'))));
      });
    }

    bodyEl.querySelectorAll('.events-slide-card').forEach((card) => {
      card.addEventListener('click', () => {
        if (Math.abs(pointerMovedX) >= 12) return;
        this.openEventDetail(Number(card.getAttribute('data-event-id')));
      });
    });

    bodyEl.querySelectorAll('.events-grid-tile').forEach((tile) => {
      tile.addEventListener('click', () => {
        this.openEventDetail(Number(tile.getAttribute('data-event-id')));
      });
    });
  }
}

window.PlayEventsController = new PlayEventsController();
