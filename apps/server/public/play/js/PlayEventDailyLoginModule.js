/**
 * @file apps/server/public/play/js/PlayEventDailyLoginModule.js
 * @module @etheria/client/events
 * @description Submódulo minimalista de check-in diário (Login Seguido 7d, 30d ou N dias)
 *   para o Hub de Eventos. Virada às 00:00 BRT, verificação de mochila cheia sem consumo.
 */
(function () {
  window.PlayEventModules = window.PlayEventModules || {};

  class PlayEventDailyLoginModule {
    static esc(v) {
      return String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    static formatCountdown(sec) {
      const s = Math.max(0, Math.floor(Number(sec) || 0));
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`;
    }

    static render(event, ctx) {
      const prog = event?.progress || {
        claimedDaysCount: 0,
        totalDays: 7,
        isCompleted: false,
        claimedToday: false,
        canClaimToday: false,
        nextClaimDay: null,
        days: [],
      };
      const bannerUrl = event.bannerImageUrl || '/play/assets/events/banner_login_7d.png';
      const iconUrl = event.iconImageUrl || '/play/assets/events/icon_login_7d.png';
      const feedback = ctx.feedback;

      const ctaLabel = prog.isCompleted
        ? '✓ Evento Concluído'
        : prog.canClaimToday
        ? `🎁 Resgatar Dia ${prog.nextClaimDay}`
        : `✓ Check-in de Hoje Realizado`;

      const resetHint = prog.isCompleted
        ? 'Todas as recompensas foram resgatadas.'
        : prog.claimedToday
        ? `Próximo dia libera às 00:00 BRT (${this.formatCountdown(ctx.secondsUntilReset)})`
        : 'Disponível agora • Progresso salvo sem reset';

      const cardsHtml = (prog.days || [])
        .map((d) => {
          const cls =
            d.status === 'CLAIMED'
              ? 'is-claimed'
              : d.status === 'AVAILABLE'
              ? 'is-available'
              : 'is-locked';
          const statusLabel =
            d.status === 'CLAIMED' ? '✓ Resgatado' : d.status === 'AVAILABLE' ? 'Resgatar' : `Dia ${d.day}`;

          const itemsHtml = (d.items || [])
            .map(
              (it) => `
              <div class="daily-day-item-chip" title="${this.esc(it.namePtBr)} (x${it.quantity})">
                <img src="${this.esc(it.iconUrl)}" alt="${this.esc(it.namePtBr)}" />
                <span class="daily-day-item-qty">x${it.quantity}</span>
              </div>
            `
            )
            .join('');

          return `
            <div class="daily-day-card ${cls}" ${d.status === 'AVAILABLE' ? `data-claim-day="${d.day}"` : ''}>
              <div class="daily-day-badge">Dia ${d.day}</div>
              <div class="daily-day-items">
                ${itemsHtml || '<span style="font-size:1.15rem;">🪙</span>'}
              </div>
              <div class="daily-day-currencies">
                ${d.gold > 0 ? `<span>🪙 ${Number(d.gold).toLocaleString('pt-BR')}</span>` : ''}
                ${d.exp > 0 ? `<span>✨ ${Number(d.exp).toLocaleString('pt-BR')} XP</span>` : ''}
              </div>
              <span class="daily-day-status-pill">${statusLabel}</span>
            </div>
          `;
        })
        .join('');

      return `
        <div class="daily-login-banner" style="background-image:url('${this.esc(bannerUrl)}');">
          <div class="daily-login-banner-scrim"></div>
          <div class="daily-login-banner-info">
            <img src="${this.esc(iconUrl)}" alt="${this.esc(event.titlePtBr)}" />
            <div>
              <div style="font-size:0.74rem; color:#fde047; font-weight:700;">Progresso: ${prog.claimedDaysCount} / ${prog.totalDays} dias</div>
              <div style="font-size:0.84rem; color:#e2e8f0; margin-top:2px;">${this.esc(event.descriptionPtBr || '')}</div>
              <div style="font-size:0.72rem; color:#94a3b8; margin-top:3px;">${this.esc(resetHint)}</div>
            </div>
          </div>
          <div class="daily-login-banner-cta">
            <button type="button" id="evDailyClaimBtn" class="daily-claim-main-btn" ${prog.canClaimToday && !ctx.claiming ? '' : 'disabled'}>
              ${ctx.claiming ? '⏳ Resgatando...' : ctaLabel}
            </button>
          </div>
        </div>

        ${
          feedback
            ? `<div class="daily-login-feedback ${feedback.type === 'error' ? 'is-error' : 'is-success'}">${this.esc(feedback.message)}</div>`
            : ''
        }

        <div class="daily-login-grid">
          ${cardsHtml}
        </div>
      `;
    }

    static bindEvents(container, event, handlers) {
      const claimBtn = container.querySelector('#evDailyClaimBtn');
      if (claimBtn && !claimBtn.disabled) {
        claimBtn.addEventListener('click', () => handlers.onClaim(event.id));
      }
      const availCard = container.querySelector('.daily-day-card.is-available');
      if (availCard) {
        availCard.addEventListener('click', () => handlers.onClaim(event.id));
      }
    }
  }

  window.PlayEventModules.DAILY_LOGIN = PlayEventDailyLoginModule;
})();
