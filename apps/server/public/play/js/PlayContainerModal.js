/**
 * @file apps/server/public/play/js/PlayContainerModal.js
 * @module @etheria/client/inventory
 * @description Submódulo visual para a experiência de abertura de Baús, Cápsulas Mágicas
 *   e Roleta da Sorte animada (/play).
 *   - Exibe animação de fita giratória para a Roleta da Sorte com desaceleração física (ease-out).
 *   - Exibe cartões de revelação com brilho e borda na cor da raridade para baús/cápsulas.
 *   - Suporta múltiplos itens obtidos, ouro bônus e atualiza a mochila em tempo real.
 */

const PlayContainerModal = {
  isSpinning: false,

  injectModalDom() {
    if (document.getElementById('itemContainerOpeningModal')) return;

    const modal = document.createElement('div');
    modal.id = 'itemContainerOpeningModal';
    modal.className = 'modal-backdrop';
    modal.style.cssText = `
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(2, 6, 23, 0.88);
      backdrop-filter: blur(6px);
      z-index: 10000;
      align-items: center;
      justify-content: center;
      padding: 14px;
    `;

    modal.innerHTML = `
      <div class="modal-box" style="max-width: 620px; width: 95%; background: linear-gradient(180deg, #0f172a 0%, #020617 100%); border: 2px solid #eab308; border-radius: 14px; box-shadow: 0 16px 40px rgba(0,0,0,0.85); padding: 18px; display: flex; flex-direction: column; gap: 14px; position: relative;">
        <!-- Cabeçalho -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(148,163,184,0.2); padding-bottom: 10px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <img id="containerOpeningIcon" src="" style="width: 42px; height: 42px; object-fit: contain; border-radius: 8px; background: #020617; border: 1.5px solid #eab308;" />
            <div>
              <div id="containerOpeningTitle" style="font-size: 1.05rem; font-weight: 800; color: #fde047;">Abertura de Baú</div>
              <div id="containerOpeningSub" style="font-size: 0.74rem; color: #94a3b8;">Revelação autoritária de recompensas</div>
            </div>
          </div>
          <button type="button" id="containerCloseBtn" onclick="PlayContainerModal.closeModal()" style="background: none; border: none; color: #94a3b8; font-size: 1.3rem; cursor: pointer; padding: 4px 8px;">✕</button>
        </div>

        <!-- Conteúdo: Roleta Animada -->
        <div id="rouletteVisualSection" style="display: none; flex-direction: column; align-items: center; gap: 10px;">
          <div style="font-size: 0.82rem; font-weight: 700; color: #fde047;">🎰 Girando a Roleta da Sorte...</div>
          
          <!-- Ponteiro da Roleta -->
          <div style="font-size: 1.4rem; line-height: 1; color: #f59e0b; text-shadow: 0 0 10px #f59e0b; z-index: 2; margin-bottom: -12px;">🔻</div>

          <!-- Janela de Visão da Fita -->
          <div id="rouletteViewport" style="width: 100%; height: 110px; background: #020617; border: 2px solid #f59e0b; border-radius: 10px; overflow: hidden; position: relative; box-shadow: inset 0 0 20px rgba(0,0,0,0.9);">
            <!-- Linha Marcadora Central -->
            <div style="position: absolute; left: 50%; top: 0; bottom: 0; width: 3px; background: #fbbf24; transform: translateX(-50%); z-index: 3; box-shadow: 0 0 8px #fbbf24;"></div>
            <!-- Fita Móvel -->
            <div id="rouletteTrack" style="display: flex; height: 100%; position: absolute; left: 0; top: 0; align-items: center; will-change: transform;"></div>
          </div>
        </div>

        <!-- Conteúdo: Revelação dos Itens (Cards de Recompensa) -->
        <div id="containerRewardsSection" style="display: flex; flex-direction: column; gap: 10px;">
          <div id="containerRewardsHeaderMsg" style="font-size: 0.84rem; font-weight: 700; color: #86efac; text-align: center;">
            🎉 Recompensas Obtidas:
          </div>

          <!-- Grade de Itens Ganhos -->
          <div id="containerRewardsGrid" style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; max-height: 280px; overflow-y: auto; padding: 4px;"></div>

          <!-- Ouro Bônus -->
          <div id="containerBonusGoldBox" style="display: none; align-items: center; justify-content: center; gap: 8px; background: rgba(234, 179, 8, 0.12); border: 1px solid #eab308; border-radius: 8px; padding: 8px 12px; font-weight: 800; color: #fde047; font-size: 0.92rem;">
            <span>🪙 Ouro Bônus Concedido:</span>
            <span id="containerBonusGoldVal">+0</span>
          </div>
        </div>

        <!-- Rodapé do Modal -->
        <div style="display: flex; justify-content: center; margin-top: 6px;">
          <button type="button" class="btn-success" id="containerCollectBtn" onclick="PlayContainerModal.closeModal()" style="min-width: 180px; padding: 10px 20px; font-weight: 800; font-size: 0.92rem; border-radius: 8px; cursor: pointer;">
            Coletar & Concluir
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  },

  getRarityColor(tier) {
    const map = {
      SS: '#fbbf24',
      S: '#c084fc',
      A: '#38bdf8',
      B: '#4ade80',
      C: '#fde047',
      D: '#cbd5e1',
      F: '#94a3b8',
      COMMON: '#94a3b8',
    };
    return map[String(tier).toUpperCase()] || '#94a3b8';
  },

  showResult(result) {
    this.injectModalDom();
    const modal = document.getElementById('itemContainerOpeningModal');
    if (!modal) return;

    modal.style.display = 'flex';
    const isRoulette = result.containerType === 'ROULETTE';

    // Configura cabeçalho
    const iconEl = document.getElementById('containerOpeningIcon');
    const titleEl = document.getElementById('containerOpeningTitle');
    const subEl = document.getElementById('containerOpeningSub');
    if (iconEl) iconEl.src = result.containerItem?.iconUrl || '';
    if (titleEl) {
      titleEl.textContent = isRoulette
        ? `🎰 Roleta: ${result.containerItem?.namePtBr || 'Roleta da Sorte'}`
        : `🎁 ${result.containerItem?.namePtBr || 'Baú de Recompensas'}`;
    }
    if (subEl) {
      subEl.textContent = isRoulette
        ? 'Sorteio da roleta concluído autoritariamente no servidor!'
        : 'Você abriu o baú e recebeu os itens abaixo na sua mochila!';
    }

    const rouletteSec = document.getElementById('rouletteVisualSection');
    const rewardsSec = document.getElementById('containerRewardsSection');
    const rewardsGrid = document.getElementById('containerRewardsGrid');
    const goldBox = document.getElementById('containerBonusGoldBox');
    const goldVal = document.getElementById('containerBonusGoldVal');
    const collectBtn = document.getElementById('containerCollectBtn');
    const closeBtn = document.getElementById('containerCloseBtn');

    // Preenche cards de recompensas
    const rewards = Array.isArray(result.rewards) ? result.rewards : [];
    if (rewardsGrid) {
      if (rewards.length === 0) {
        rewardsGrid.innerHTML = `
          <div style="color: #94a3b8; font-size: 0.82rem; padding: 16px; text-align: center;">
            Nenhum item foi sorteado nesta abertura (chances não passaram).
          </div>`;
      } else {
        rewardsGrid.innerHTML = rewards
          .map((r) => {
            const rColor = this.getRarityColor(r.rarityTier);
            return `
            <div style="background: rgba(15, 23, 42, 0.9); border: 2px solid ${rColor}; border-radius: 10px; padding: 10px 12px; display: flex; align-items: center; gap: 10px; min-width: 170px; max-width: 240px; box-shadow: 0 4px 15px rgba(0,0,0,0.5);">
              <div style="position: relative;">
                <img src="${r.iconUrl}" style="width: 44px; height: 44px; object-fit: contain; border-radius: 6px; background: #020617; border: 1px solid #334155;" onerror="this.style.display='none'" />
                <span style="position: absolute; bottom: -4px; right: -4px; background: #eab308; color: #020617; font-weight: 900; font-size: 0.72rem; padding: 1px 5px; border-radius: 4px; font-family: monospace;">
                  x${r.quantity}
                </span>
              </div>
              <div style="overflow: hidden;">
                <div style="font-size: 0.84rem; font-weight: 700; color: #f8fafc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${r.namePtBr}">
                  ${r.namePtBr}
                </div>
                <div style="font-size: 0.70rem; color: ${rColor}; font-weight: 700;">
                  Rank ${r.rarityTier || 'COMMON'}
                </div>
              </div>
            </div>`;
          })
          .join('');
      }
    }

    if (result.bonusGold && result.bonusGold > 0) {
      if (goldBox) goldBox.style.display = 'flex';
      if (goldVal) goldVal.textContent = `+${Number(result.bonusGold).toLocaleString('pt-BR')}`;
    } else {
      if (goldBox) goldBox.style.display = 'none';
    }

    if (isRoulette && result.rouletteResult?.slices?.length) {
      // 🎰 ANIMAÇÃO DA ROLETA
      if (rouletteSec) rouletteSec.style.display = 'flex';
      if (rewardsSec) rewardsSec.style.display = 'none';
      if (collectBtn) collectBtn.style.display = 'none';
      if (closeBtn) closeBtn.style.display = 'none';

      this.playRouletteAnimation(result);
    } else {
      // 📦 BAÚ DIRETO
      if (rouletteSec) rouletteSec.style.display = 'none';
      if (rewardsSec) rewardsSec.style.display = 'flex';
      if (collectBtn) collectBtn.style.display = 'block';
      if (closeBtn) closeBtn.style.display = 'block';
    }
  },

  playRouletteAnimation(result) {
    const track = document.getElementById('rouletteTrack');
    const viewport = document.getElementById('rouletteViewport');
    if (!track || !viewport) return;

    const slices = result.rouletteResult.slices || [];
    const winningIdx = Math.max(0, result.rouletteResult.winningIndex || 0);
    const CARD_WIDTH = 100; // Largura de cada card na fita em px

    // Monta a fita multiplicando as fatias para criar o efeito de esteira contínua
    const REPEATS = 6;
    const allCards = [];
    for (let r = 0; r < REPEATS; r++) {
      slices.forEach((s, idx) => {
        allCards.push({ slice: s, originalIdx: idx });
      });
    }

    track.innerHTML = allCards
      .map((c) => {
        const rColor = this.getRarityColor(c.slice.rarityTier);
        return `
        <div style="width: ${CARD_WIDTH}px; min-width: ${CARD_WIDTH}px; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; background: rgba(15,23,42,0.85); border-right: 1px solid #1e293b; padding: 6px; box-sizing: border-box;">
          <img src="${c.slice.iconUrl}" style="width: 38px; height: 38px; object-fit: contain; border-radius: 6px; background: #020617; border: 1px solid ${rColor};" />
          <div style="font-size: 0.68rem; font-weight: 700; color: #f8fafc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 86px; text-align: center;">
            ${c.slice.namePtBr}
          </div>
          <div style="font-size: 0.62rem; color: #38bdf8; font-weight: 700;">
            ${c.slice.chancePct}%
          </div>
        </div>`;
      })
      .join('');

    // Calcula a posição do card vencedor no 4º ciclo de repetição
    const targetCardIndex = slices.length * 4 + winningIdx;
    const viewportWidth = viewport.clientWidth || 580;
    // Posição final: o centro do card vencedor coincide com o centro da viewport
    const targetOffset = targetCardIndex * CARD_WIDTH + CARD_WIDTH / 2 - viewportWidth / 2;

    // Reset instantâneo
    track.style.transition = 'none';
    track.style.transform = 'translateX(0px)';

    // Inicia o giro após um pequeno delay
    setTimeout(() => {
      track.style.transition = 'transform 3.2s cubic-bezier(0.12, 0.8, 0.33, 1)';
      track.style.transform = `translateX(-${targetOffset}px)`;
    }, 50);

    // Conclusão da animação após 3.4 segundos
    setTimeout(() => {
      const rewardsSec = document.getElementById('containerRewardsSection');
      const collectBtn = document.getElementById('containerCollectBtn');
      const closeBtn = document.getElementById('containerCloseBtn');
      if (rewardsSec) rewardsSec.style.display = 'flex';
      if (collectBtn) collectBtn.style.display = 'block';
      if (closeBtn) closeBtn.style.display = 'block';
    }, 3400);
  },

  closeModal() {
    const modal = document.getElementById('itemContainerOpeningModal');
    if (modal) modal.style.display = 'none';

    // Atualiza a mochila do jogador imediatamente
    if (window.PlayApp && typeof window.PlayApp.openBagModal === 'function') {
      window.PlayApp.openBagModal();
    }
  },
};

window.PlayContainerModal = PlayContainerModal;
