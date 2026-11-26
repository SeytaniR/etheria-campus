/**
 * @file apps/server/public/play/js/PlayCrystalShopItemModule.js
 * @module @etheria/client/shop
 * @description Submódulo de exibição detalhada e compra do item na Loja Cristal (/play).
 */
(function () {
  const RARITY_STYLES = {
    SS: { color: '#fbbf24', border: '#f59e0b', label: 'Rank SS' },
    S: { color: '#c084fc', border: '#a855f7', label: 'Rank S' },
    A: { color: '#38bdf8', border: '#0ea5e9', label: 'Rank A' },
    B: { color: '#4ade80', border: '#22c55e', label: 'Rank B' },
    C: { color: '#fde047', border: '#eab308', label: 'Rank C' },
    D: { color: '#fdba74', border: '#f97316', label: 'Rank D' },
    F: { color: '#cbd5e1', border: '#64748b', label: 'Rank F' },
    COMMON: { color: '#cbd5e1', border: '#64748b', label: 'Comum' },
    RARE: { color: '#4ade80', border: '#22c55e', label: 'Raro' },
    EPIC: { color: '#38bdf8', border: '#0ea5e9', label: 'Épico' },
    LEGENDARY: { color: '#c084fc', border: '#a855f7', label: 'Lendário' },
    MYTHIC: { color: '#fbbf24', border: '#f59e0b', label: 'Mítico' },
  };

  const STAT_LABELS = {
    PHYS_ATK: '⚔️ ATK Físico',
    MAG_ATK: '🔮 ATK Mágico',
    HEAL_POWER: '✨ Poder de Cura',
    ATTACK_RANGE: '🎯 Alcance',
    MAX_HP: '❤️ HP Máx.',
    MAX_MP: '💧 MP Máx.',
    PHYS_DEF: '🛡️ DEF Física',
    MAG_DEF: '🔮 DEF Mágica',
    BATTLE_MOVE_SPEED: '🏃 Vel. Arena',
    ATTACK_SPEED: '⚡ Vel. Ataque',
    CRIT_RATE: '💥 Taxa Crít.%',
    CRIT_CHANCE_PCT: '💥 Taxa Crít.%',
    CRIT_DMG: '⚡ Dano Crít.%',
    CRIT_DAMAGE_PCT: '⚡ Dano Crít.%',
    PHYS_ACCURACY: '🎯 Precisão Fís.%',
    PHYS_EVASION: '💨 Esquiva Fís.%',
    MAG_ACCURACY: '🔮 Precisão Mág.%',
    MAG_EVASION: '✨ Esquiva Mág.%',
  };

  class PlayCrystalShopItemModule {
    static esc(v) {
      return String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    static render(offer, ctx) {
      const rStyle = RARITY_STYLES[offer.rarityTier] || RARITY_STYLES.COMMON;
      const crystals = Math.max(0, Number(ctx.crystals) || 0);
      const canAfford = crystals >= offer.priceCrystals;
      const heroBg = offer.bannerImageUrl ? `background-image:url('${this.esc(offer.bannerImageUrl)}');` : '';

      const statsEntries = Object.entries(offer.combatStatBonuses || {}).filter(([, val]) => Number(val) !== 0);
      const statsHtml =
        statsEntries.length > 0
          ? `
            <div class="cshop-stats-grid">
              ${statsEntries
                .map(([k, val]) => {
                  const n = Number(val);
                  const sign = n > 0 ? '+' : '';
                  return `<span class="cshop-stat-chip">${this.esc(STAT_LABELS[k] || k)}: ${sign}${n}</span>`;
                })
                .join('')}
            </div>
          `
          : '';

      const endStr = offer.endsAt ? `Disponível até ${new Date(offer.endsAt).toLocaleString('pt-BR')}` : '';

      return `
        <div class="cshop-detail-card">
          <div class="cshop-detail-hero" style="${heroBg}">
            <div class="cshop-detail-hero-scrim"></div>
            <div class="cshop-detail-icon-frame" style="border-color:${rStyle.border};">
              <img src="${this.esc(offer.iconUrl)}" alt="${this.esc(offer.titlePtBr)}" />
            </div>
            <div class="cshop-detail-meta">
              <h4 style="margin:0; font-size:1.14rem; color:#ffffff;">${this.esc(offer.titlePtBr)}</h4>
              ${
                offer.itemNamePtBr && offer.itemNamePtBr !== offer.titlePtBr
                  ? `<div style="font-size:0.78rem; color:#94a3b8;">Item incluso: ${this.esc(offer.itemNamePtBr)}</div>`
                  : ''
              }
              <div class="cshop-detail-badges">
                <span class="cshop-badge" style="color:${rStyle.color}; border-color:${rStyle.border};">${this.esc(rStyle.label)}</span>
                <span class="cshop-badge">📦 Qtd: x${offer.quantity}</span>
                <span class="cshop-badge">⭐ Nv. Mín. ${offer.requiredLevel}</span>
                <span class="cshop-badge">${this.esc(offer.slotNamePtBr || offer.itemCategory)}</span>
                ${offer.equipmentSetNamePtBr ? `<span class="cshop-badge" style="color:#fde047;">👑 ${this.esc(offer.equipmentSetNamePtBr)}</span>` : ''}
              </div>
              ${endStr ? `<div style="font-size:0.72rem; color:#7dd3fc;">⏳ ${this.esc(endStr)}</div>` : ''}
            </div>
          </div>

          <div class="cshop-detail-desc-box">
            ${this.esc(offer.descriptionPtBr || 'Sem descrição adicional.')}
          </div>

          ${statsHtml}

          ${
            ctx.feedback
              ? `<div class="cshop-feedback ${ctx.feedback.type === 'error' ? 'is-error' : 'is-success'}">${this.esc(ctx.feedback.message)}</div>`
              : ''
          }

          <div class="cshop-buy-footer">
            <div style="font-size:0.8rem; color:${canAfford ? '#94a3b8' : '#fca5a5'};">
              ${
                canAfford
                  ? `Seu saldo: <strong style="color:#7dd3fc;">💎 ${crystals.toLocaleString('pt-BR')}</strong>`
                  : `Cristais insuficientes (seu saldo: <strong>💎 ${crystals.toLocaleString('pt-BR')}</strong>)`
              }
            </div>
            <button type="button" id="cshopBuyNowBtn" class="cshop-buy-btn" ${ctx.buying || !canAfford ? 'disabled' : ''}>
              <img src="/play/assets/hud/crystal_gem_icon.png" alt="" />
              <span>${ctx.buying ? 'Comprando...' : `Comprar por ${Number(offer.priceCrystals).toLocaleString('pt-BR')} Cristais`}</span>
            </button>
          </div>
        </div>
      `;
    }

    static bindEvents(container, offer, handlers) {
      const btn = container.querySelector('#cshopBuyNowBtn');
      if (btn && !btn.disabled) {
        btn.addEventListener('click', () => handlers.onBuy(offer.id));
      }
    }
  }

  window.PlayCrystalShopItemModule = PlayCrystalShopItemModule;
})();
