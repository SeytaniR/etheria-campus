/**
 * @file apps/server/public/play/js/PlayCrystalShopController.js
 * @module @etheria/client/shop
 * @description Orquestrador do Hub da Loja Cristal (/play -> Loja):
 *   - Carrossel de Destaques no topo (swipe touch/mouse + bolinhas clicáveis).
 *   - Grid limpa abaixo com ícone + quantidade (xN) + preço discreto em Cristais.
 *   - Abertura da ficha completa do item via PlayCrystalShopItemModule com botão "← Voltar" e compra autoritativa.
 */
class PlayCrystalShopController {
  constructor() {
    this.client = null;
    this.modalEl = null;
    this.shopState = null;
    this.view = 'HUB'; // 'HUB' | 'DETAIL'
    this.activeOfferId = null;
    this.carouselIndex = 0;
    this.buying = false;
    this.feedback = null;
  }

  esc(v) {
    return String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  async openModal(client) {
    const app = client || this.client || window.PlayApp;
    if (!app?.activeChar?.id) return;
    this.client = app;
    this.view = 'HUB';
    this.activeOfferId = null;
    this.feedback = null;
    this.carouselIndex = 0;

    this.ensureModalDom();
    this.modalEl.style.display = 'flex';
    this.renderBody();
    await this.loadShop(app);
  }

  closeModal() {
    if (this.modalEl) {
      this.modalEl.style.display = 'none';
    }
    this.feedback = null;
  }

  syncAccountCrystalsUi(newCrystals) {
    const app = this.client || window.PlayApp;
    const val = Math.max(0, Number(newCrystals) || 0);
    if (app?.activeChar) {
      app.activeChar.crystals = val;
      app.activeChar.diamonds = val;
    }
    if (Array.isArray(app?.myCharacters)) {
      for (const ch of app.myCharacters) {
        ch.crystals = val;
        ch.diamonds = val;
      }
    }
    window.PlayHudController?.updateCurrencies?.(app?.activeChar?.gold ?? 0, val);
    const pillVal = this.modalEl?.querySelector('#cshopWalletValue');
    if (pillVal) pillVal.textContent = val.toLocaleString('pt-BR');
  }

  async loadShop(client) {
    const app = client || this.client;
    const charId = app?.activeChar?.id;
    if (!app || !charId) return;
    try {
      const state = await app.api(`/api/play/characters/${charId}/crystal-shop`);
      this.shopState = state;
      if (state?.crystals !== undefined) {
        this.syncAccountCrystalsUi(state.crystals);
      }
      const featLen = state?.featuredOffers?.length || 0;
      if (featLen > 0 && this.carouselIndex >= featLen) {
        this.carouselIndex = 0;
      }
      this.renderBody();
    } catch (err) {
      this.feedback = { type: 'error', message: err.message || 'Erro ao carregar Loja Cristal.' };
      this.renderBody();
    }
  }

  ensureModalDom() {
    if (this.modalEl) return;
    const backdrop = document.createElement('div');
    backdrop.id = 'playCrystalShopModal';
    backdrop.className = 'cshop-modal-backdrop';
    backdrop.style.display = 'none';
    backdrop.innerHTML = `
      <div class="cshop-modal-shell" role="dialog" aria-modal="true" aria-label="Loja Cristal">
        <div class="cshop-modal-header">
          <div class="cshop-header-left">
            <button type="button" id="cshopModalBackBtn" class="cshop-back-btn" style="display:none;">← Voltar</button>
            <h3 id="cshopModalHeaderTitle" class="cshop-header-title">💎 Loja Cristal</h3>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="cshop-wallet-pill" title="Cristais da Conta">
              <img src="/play/assets/hud/crystal_gem_icon.png" alt="Cristais" />
              <span id="cshopWalletValue">0</span>
            </span>
            <button type="button" id="cshopModalCloseBtn" class="cshop-close-btn">✕</button>
          </div>
        </div>
        <div id="cshopModalBody" class="cshop-modal-body"></div>
      </div>
    `;
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) this.closeModal();
    });
    backdrop.querySelector('#cshopModalCloseBtn').addEventListener('click', () => this.closeModal());
    backdrop.querySelector('#cshopModalBackBtn').addEventListener('click', () => {
      this.view = 'HUB';
      this.activeOfferId = null;
      this.feedback = null;
      this.renderBody();
    });

    document.body.appendChild(backdrop);
    this.modalEl = backdrop;
  }

  findOfferById(id) {
    if (!this.shopState) return null;
    const all = [...(this.shopState.featuredOffers || []), ...(this.shopState.gridOffers || [])];
    return all.find((o) => Number(o.id) === Number(id)) || null;
  }

  openOfferDetail(offerId) {
    const offer = this.findOfferById(offerId);
    if (!offer) return;
    this.view = 'DETAIL';
    this.activeOfferId = offer.id;
    this.feedback = null;
    this.renderBody();
  }

  setCarouselSlide(idx) {
    const total = this.shopState?.featuredOffers?.length || 0;
    if (total === 0) return;
    this.carouselIndex = ((idx % total) + total) % total;
    const track = this.modalEl?.querySelector('#cshopCarouselTrack');
    if (track) {
      track.style.transform = `translateX(-${this.carouselIndex * 100}%)`;
    }
    this.modalEl?.querySelectorAll('.cshop-carousel-dot').forEach((dot, i) => {
      dot.classList.toggle('is-active', i === this.carouselIndex);
    });
  }

  async handleBuy(offerId) {
    const app = this.client || window.PlayApp;
    const charId = app?.activeChar?.id;
    if (!app || !charId || this.buying) return;

    this.buying = true;
    this.feedback = null;
    this.renderBody();

    try {
      const res = await app.api(`/api/play/characters/${charId}/crystal-shop/${offerId}/buy`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (res?.shopState) {
        this.shopState = res.shopState;
      }
      if (res?.crystals !== undefined) {
        this.syncAccountCrystalsUi(res.crystals);
      }
      if (
        typeof window.PlayBagController?.loadBag === 'function' &&
        document.getElementById('bagModalBackdrop')?.style.display === 'flex'
      ) {
        window.PlayBagController.loadBag();
      }
      const msg = `💎 Compra concluída: ${res.itemName} (x${res.quantity})!`;
      this.feedback = { type: 'success', message: msg };
      app.showToast?.(msg);
    } catch (err) {
      const msg = err.message || 'Não foi possível concluir a compra.';
      this.feedback = { type: 'error', message: msg };
      app.showToast?.(msg);
    } finally {
      this.buying = false;
      this.renderBody();
    }
  }

  renderBody() {
    if (!this.modalEl) return;
    const backBtn = this.modalEl.querySelector('#cshopModalBackBtn');
    const titleEl = this.modalEl.querySelector('#cshopModalHeaderTitle');
    const bodyEl = this.modalEl.querySelector('#cshopModalBody');
    const walletVal = this.modalEl.querySelector('#cshopWalletValue');

    const currentCrystals =
      this.shopState?.crystals !== undefined
        ? Number(this.shopState.crystals)
        : Number(this.client?.activeChar?.crystals ?? this.client?.activeChar?.diamonds ?? 0);
    if (walletVal) walletVal.textContent = currentCrystals.toLocaleString('pt-BR');

    if (!this.shopState) {
      backBtn.style.display = 'none';
      titleEl.textContent = '💎 Loja Cristal';
      bodyEl.innerHTML = this.feedback
        ? `<div class="cshop-feedback is-error">${this.esc(this.feedback.message)}</div>`
        : `<div style="text-align:center; padding:40px 16px; color:#94a3b8;">Carregando ofertas...</div>`;
      return;
    }

    if (this.view === 'DETAIL' && this.activeOfferId) {
      const offer = this.findOfferById(this.activeOfferId);
      if (offer && window.PlayCrystalShopItemModule) {
        backBtn.style.display = 'inline-flex';
        titleEl.textContent = offer.titlePtBr || 'Item';
        bodyEl.innerHTML = window.PlayCrystalShopItemModule.render(offer, {
          crystals: currentCrystals,
          buying: this.buying,
          feedback: this.feedback,
        });
        window.PlayCrystalShopItemModule.bindEvents(bodyEl, offer, {
          onBuy: (id) => this.handleBuy(id),
        });
        return;
      }
      this.view = 'HUB';
      this.activeOfferId = null;
    }

    backBtn.style.display = 'none';
    titleEl.textContent = '💎 Loja Cristal';

    const featured = this.shopState.featuredOffers || [];
    const grid = this.shopState.gridOffers || [];

    if (featured.length === 0 && grid.length === 0) {
      bodyEl.innerHTML = `<div style="text-align:center; padding:40px 16px; color:#94a3b8;">Nenhum item disponível na Loja Cristal no momento.</div>`;
      return;
    }

    const carouselHtml =
      featured.length > 0
        ? `
          <section class="cshop-carousel-section">
            <div class="cshop-carousel-viewport" id="cshopCarouselViewport">
              <div class="cshop-carousel-track" id="cshopCarouselTrack" style="transform:translateX(-${this.carouselIndex * 100}%);">
                ${featured
                  .map((o) => {
                    const bgStyle = o.bannerImageUrl ? `background-image:url('${this.esc(o.bannerImageUrl)}');` : '';
                    return `
                      <div class="cshop-slide-card" data-offer-id="${o.id}" style="${bgStyle}">
                        <div class="cshop-slide-scrim"></div>
                        <div class="cshop-slide-content">
                          <div class="cshop-slide-icon-wrap">
                            <img src="${this.esc(o.iconUrl)}" alt="${this.esc(o.titlePtBr)}" />
                            <span class="cshop-qty-tag">x${o.quantity}</span>
                          </div>
                          <div class="cshop-slide-text">
                            <span class="cshop-price-pill">
                              <img src="/play/assets/hud/crystal_gem_icon.png" alt="Cristal" />
                              ${Number(o.priceCrystals).toLocaleString('pt-BR')} Cristais
                            </span>
                            <h4 class="cshop-slide-title">${this.esc(o.titlePtBr)}</h4>
                            <p class="cshop-slide-desc">${this.esc(o.descriptionPtBr || '')}</p>
                          </div>
                        </div>
                      </div>
                    `;
                  })
                  .join('')}
              </div>
              ${
                featured.length > 1
                  ? `<button type="button" class="cshop-carousel-arrow prev" id="cshopCarouselPrev" aria-label="Anterior">‹</button>
                     <button type="button" class="cshop-carousel-arrow next" id="cshopCarouselNext" aria-label="Próximo">›</button>`
                  : ''
              }
            </div>
            ${
              featured.length > 1
                ? `<div class="cshop-carousel-dots">
                    ${featured
                      .map(
                        (_, i) =>
                          `<button type="button" class="cshop-carousel-dot ${i === this.carouselIndex ? 'is-active' : ''}" data-dot-idx="${i}" aria-label="Destaque ${i + 1}"></button>`
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
          <section class="cshop-grid-section">
            <div class="cshop-grid-heading">Itens</div>
            <div class="cshop-icon-grid">
              ${grid
                .map(
                  (o) => `
                  <button type="button" class="cshop-grid-tile" data-offer-id="${o.id}" title="${this.esc(o.titlePtBr)} (x${o.quantity}) — ${o.priceCrystals} Cristais">
                    <div class="cshop-tile-icon-box">
                      <img src="${this.esc(o.iconUrl)}" alt="${this.esc(o.titlePtBr)}" />
                      <span class="cshop-tile-qty">x${o.quantity}</span>
                    </div>
                    <span class="cshop-tile-price">
                      <img src="/play/assets/hud/crystal_gem_icon.png" alt="" />
                      ${Number(o.priceCrystals).toLocaleString('pt-BR')}
                    </span>
                  </button>
                `
                )
                .join('')}
            </div>
          </section>
        `
        : '';

    bodyEl.innerHTML = carouselHtml + gridHtml;
    this.bindHubInteractions(bodyEl);
  }

  bindHubInteractions(bodyEl) {
    const viewport = bodyEl.querySelector('#cshopCarouselViewport');
    let pointerStartX = null;
    let pointerMovedX = 0;

    if (viewport) {
      viewport.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.cshop-carousel-arrow')) return;
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

      bodyEl.querySelector('#cshopCarouselPrev')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.setCarouselSlide(this.carouselIndex - 1);
      });
      bodyEl.querySelector('#cshopCarouselNext')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.setCarouselSlide(this.carouselIndex + 1);
      });
      bodyEl.querySelectorAll('.cshop-carousel-dot').forEach((dot) => {
        dot.addEventListener('click', () => this.setCarouselSlide(Number(dot.getAttribute('data-dot-idx'))));
      });
    }

    bodyEl.querySelectorAll('.cshop-slide-card').forEach((card) => {
      card.addEventListener('click', () => {
        if (Math.abs(pointerMovedX) >= 12) return;
        this.openOfferDetail(Number(card.getAttribute('data-offer-id')));
      });
    });

    bodyEl.querySelectorAll('.cshop-grid-tile').forEach((tile) => {
      tile.addEventListener('click', () => {
        this.openOfferDetail(Number(tile.getAttribute('data-offer-id')));
      });
    });
  }
}

window.PlayCrystalShopController = new PlayCrystalShopController();
