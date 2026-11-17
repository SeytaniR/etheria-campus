/**
 * @file apps/server/public/play/js/CombatOutcomeController.js
 * @module @etheria/play
 * @description Orquestrador Cinemático de Vitória, Derrota e Transições de Desfecho.
 * Gerencia a apresentação fluida de recompensas (EXP, Ouro, Drops), brasões
 * de alta fidelidade sem emojis, transição suave de dissolução do Véu, teleporte
 * para o santuário ao morrer e disparo encadeado do efeito de Level Up no mapa.
 *
 * Segue estritamente AGENTS.md (Regra #7: < 1.000 linhas) e PERFORMANCE_STANDARDS.md.
 */

class CombatOutcomeController {
  constructor() {
    this.modalEl = null;
    this.cardEl = null;
    this.crestImg = null;
    this.titleEl = null;
    this.subtitleEl = null;
    this.rewardsGrid = null;
    this.actionBtn = null;
    this.timerBar = null;

    this.currentOutcome = null; // 'VICTORY' | 'DEFEAT' | 'FLED'
    this.currentArena = null;
    this.client = null;
    this.pendingLevelUp = null;
    this.timerInterval = null;
    this.autoCloseTimeout = null;

    this.initDom();
  }

  initDom() {
    this.modalEl = document.getElementById('combatOutcomeModal');
    if (!this.modalEl) return;

    this.cardEl = this.modalEl.querySelector('.outcome-card');
    this.crestImg = document.getElementById('outcomeCrestImg');
    this.titleEl = document.getElementById('outcomeTitle');
    this.subtitleEl = document.getElementById('outcomeSubtitle');
    this.rewardsGrid = document.getElementById('outcomeRewardsGrid');
    this.actionBtn = document.getElementById('btnOutcomeAction');
    this.timerBar = document.getElementById('outcomeTimerBar');

    if (this.actionBtn) {
      this.actionBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.confirmAndClose();
      });
    }
  }

  /**
   * Exibe a tela cinematográfica de Vitória com contadores de EXP/Ouro e drops.
   */
  showVictory(victoryData, arena, client) {
    this.currentOutcome = 'VICTORY';
    this.currentArena = arena;
    this.client = client || window.PlayApp;

    const expGained = victoryData?.expGained || 0;
    const goldGained = victoryData?.goldGained || 0;
    const drops = victoryData?.droppedItems || [];
    const pProg = victoryData?.playerProgression;

    // Guarda o Level Up para disparar apenas no mapa de exploração após fechar a tela!
    if (pProg && pProg.leveledUp) {
      this.pendingLevelUp = {
        newLevel: pProg.newLevel,
        statPointsGained: pProg.statPointsGained || 5,
      };
    } else {
      this.pendingLevelUp = null;
    }

    if (this.cardEl) {
      this.cardEl.className = 'outcome-card is-victory';
    }
    if (this.crestImg) {
      this.crestImg.src = '/play/assets/hud/victory_crest.png';
      this.crestImg.alt = 'Vitória Gloriosa';
    }
    if (this.titleEl) {
      this.titleEl.textContent = 'VITÓRIA GLORIOSA';
    }
    if (this.subtitleEl) {
      this.subtitleEl.textContent = 'A fenda dimensional foi expurgada e o equilíbrio do mundo foi restaurado.';
    }

    // Monta o grid de recompensas sem emojis e com ícones dedicados
    if (this.rewardsGrid) {
      const curExp = this.client?.activeChar?.experience || 0;
      const maxXp = this.client?.activeChar?.maxXp || 200;
      const expPct = Math.min(100, Math.round((curExp / Math.max(1, maxXp)) * 100));

      let dropsHtml = '';
      if (drops.length > 0) {
        dropsHtml = `
          <div class="outcome-reward-row" style="flex-direction:column; align-items:flex-start; gap:6px;">
            <div class="reward-label">Tesouros Obtidos</div>
            <div class="outcome-drops-container">
              ${drops.map((d) => `<span class="outcome-drop-pill">✦ ${d.quantity}x ${d.namePtBr}</span>`).join('')}
            </div>
          </div>
        `;
      }

      this.rewardsGrid.innerHTML = `
        <div class="outcome-reward-row">
          <div class="reward-left-group">
            <img src="/play/assets/hud/crystal_gem_icon.png" class="reward-icon-img" alt="EXP" />
            <div>
              <div class="reward-label">Experiência</div>
              <div class="outcome-exp-bar-wrap">
                <div class="outcome-exp-bar-fill" id="outcomeExpBarFill"></div>
              </div>
            </div>
          </div>
          <div class="reward-value">+${expGained} EXP</div>
        </div>

        <div class="outcome-reward-row">
          <div class="reward-left-group">
            <img src="/play/assets/hud/gold_coin_icon.png" class="reward-icon-img" alt="Ouro" />
            <div class="reward-label">Ouro Obtido</div>
          </div>
          <div class="reward-value is-gold">+${goldGained} Ouro</div>
        </div>

        ${dropsHtml}
      `;

      // Anima a barra de EXP após um breve delay
      setTimeout(() => {
        const bar = document.getElementById('outcomeExpBarFill');
        if (bar) bar.style.width = `${expPct}%`;
      }, 100);
    }

    if (this.actionBtn) {
      this.actionBtn.textContent = 'Continuar Jornada';
    }

    this.openModal(7000);
  }

  /**
   * Exibe a tela cinematográfica de Derrota e prepara o teleporte ao santuário.
   */
  showDefeat(arena, client) {
    this.currentOutcome = 'DEFEAT';
    this.currentArena = arena;
    this.client = client || window.PlayApp;
    this.pendingLevelUp = null;

    if (this.cardEl) {
      this.cardEl.className = 'outcome-card is-defeat';
    }
    if (this.crestImg) {
      this.crestImg.src = '/play/assets/hud/defeat_crest.png';
      this.crestImg.alt = 'Derrota Abissal';
    }
    if (this.titleEl) {
      this.titleEl.textContent = 'ESSÊNCIA DISSOLVIDA';
    }
    if (this.subtitleEl) {
      this.subtitleEl.textContent = 'Suas forças sucumbiram às profundezas do Véu. Os espíritos guardiões estão resgatando seu corpo para o santuário da cidade mais próxima.';
    }

    if (this.rewardsGrid) {
      this.rewardsGrid.innerHTML = `
        <div class="outcome-reward-row" style="justify-content:center; padding:12px; border-color:rgba(225,29,72,0.35);">
          <span style="font-size:0.82rem; color:#fca5a5; font-weight:600;">
            Sua essência foi preservada e você não perdeu seus itens.
          </span>
        </div>
      `;
    }

    if (this.actionBtn) {
      this.actionBtn.textContent = 'Renascer no Santuário';
    }

    this.openModal(0); // Sem auto-close forçado na derrota para o jogador ler com calma
  }

  /**
   * Exibe aviso de Fuga bem-sucedida.
   */
  showFled(arena, client) {
    this.currentOutcome = 'FLED';
    this.currentArena = arena;
    this.client = client || window.PlayApp;
    this.pendingLevelUp = null;

    if (this.cardEl) {
      this.cardEl.className = 'outcome-card is-victory';
    }
    if (this.crestImg) {
      this.crestImg.src = '/play/assets/hud/victory_crest.png';
    }
    if (this.titleEl) {
      this.titleEl.textContent = 'RECUO TÁTICO';
    }
    if (this.subtitleEl) {
      this.subtitleEl.textContent = 'Você rompeu o cerco e recuou com segurança de volta ao mapa de exploração.';
    }
    if (this.rewardsGrid) {
      this.rewardsGrid.innerHTML = '';
    }
    if (this.actionBtn) {
      this.actionBtn.textContent = 'Retornar ao Mapa';
    }

    this.openModal(4000);
  }

  openModal(autoCloseMs = 0) {
    if (!this.modalEl) return;
    this.clearTimers();

    this.modalEl.style.display = 'flex';
    // Força reflow para transição suave de opacidade e escala
    void this.modalEl.offsetWidth;
    this.modalEl.classList.add('active');

    if (autoCloseMs > 0 && this.timerBar) {
      this.timerBar.style.transition = 'none';
      this.timerBar.style.width = '100%';
      void this.timerBar.offsetWidth;
      this.timerBar.style.transition = `width ${autoCloseMs}ms linear`;
      this.timerBar.style.width = '0%';

      this.autoCloseTimeout = setTimeout(() => {
        this.confirmAndClose();
      }, autoCloseMs);
    } else if (this.timerBar) {
      this.timerBar.style.display = 'none';
    }
  }

  clearTimers() {
    if (this.autoCloseTimeout) {
      clearTimeout(this.autoCloseTimeout);
      this.autoCloseTimeout = null;
    }
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  /**
   * Fecha o resultado com transição cinematográfica e executa o pós-batalha (Level Up ou Respawn).
   */
  confirmAndClose() {
    this.clearTimers();
    if (!this.modalEl) return;

    this.modalEl.classList.remove('active');

    setTimeout(() => {
      this.modalEl.style.display = 'none';

      if (this.currentOutcome === 'DEFEAT') {
        this.executeRespawnTransition();
      } else {
        this.executeVictoryTransition();
      }
    }, 350);
  }

  /**
   * Transição suave de Vitória: desfaz o Véu e aciona o Level Up no mapa se pendente.
   */
  executeVictoryTransition() {
    const arena = this.currentArena;
    const client = this.client || window.PlayApp;

    // Dissolve suavemente a arena
    if (arena) {
      arena.closeArena();
    }

    // Se houve Level Up, dispara o efeito exuberante no mapa ao redor do herói!
    if (this.pendingLevelUp && client && client.activeChar) {
      const pLevel = this.pendingLevelUp.newLevel;
      const pStats = this.pendingLevelUp.statPointsGained;
      this.pendingLevelUp = null;

      setTimeout(() => {
        if (window.LevelUpVfxController) {
          window.LevelUpVfxController.trigger(client.playerX, client.playerY, pLevel, pStats);
        }
      }, 300);
    }
  }

  /**
   * Transição suave de Derrota: fade escuro, chamada ao backend `/respawn` e renascimento no santuário.
   */
  executeRespawnTransition() {
    const arena = this.currentArena;
    const client = this.client || window.PlayApp;
    const charId = client?.activeChar?.id;
    const fadeEl = document.getElementById('respawnFadeOverlay');

    // 1. Escurece a tela suavemente
    if (fadeEl) fadeEl.classList.add('active');

    // 2. Fecha a arena de combate
    if (arena) arena.closeArena();

    if (!charId || !client) {
      if (fadeEl) setTimeout(() => fadeEl.classList.remove('active'), 600);
      return;
    }

    // 3. Comunica com o backend para teleporte ao santuário
    client.api(`/api/play/characters/${charId}/respawn`, { method: 'POST' })
      .then((res) => {
        if (res?.mapId) {
          client.loadMapIntoWorld(res.mapId, res.spawnX, res.spawnY);
        }
        setTimeout(() => {
          // 4. Dissolve a escuridão e materializa no santuário
          if (fadeEl) fadeEl.classList.remove('active');
          if (window.LevelUpVfxController) {
            // Efeito sagrado de renascimento (luz celestial suave no santuário, sem level-up)
            if (typeof window.LevelUpVfxController.triggerRespawn === 'function') {
              window.LevelUpVfxController.triggerRespawn(client.playerX, client.playerY);
            }
          }
          client.showNotification?.('Sua essência foi restaurada no santuário sagrado.', 'info');
        }, 500);
      })
      .catch(() => {
        if (fadeEl) fadeEl.classList.remove('active');
      });
  }
}

window.CombatOutcomeController = new CombatOutcomeController();
