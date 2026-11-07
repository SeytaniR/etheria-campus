/**
 * @file apps/server/public/play/js/TemporaryCombatArena.js
 * @module @etheria/server
 * @description MÓDULO TEMPORÁRIO DE ARENA E COMBATE SIMULADO GM.
 *   AVISO: Módulo estruturado de forma 100% independente, modular e facilmente substituível/descartável
 *   quando a arena tática definitiva e o sistema de combate final forem construídos.
 */

class TemporaryCombatArena {
  constructor(client) {
    this.client = client;
    this.currentBattle = null;
    this.selectedTargetIndex = 0;
    this.isResolving = false;

    this.injectStyles();
    this.injectModalDom();
  }

  injectStyles() {
    if (document.getElementById('temporaryCombatStyles')) return;
    const style = document.createElement('style');
    style.id = 'temporaryCombatStyles';
    style.textContent = `
      .arena-backdrop {
        position: fixed;
        inset: 0;
        z-index: 99999;
        background: rgba(2, 6, 23, 0.94);
        backdrop-filter: blur(8px);
        display: none;
        flex-direction: column;
        justify-content: space-between;
        padding: 12px;
        box-sizing: border-box;
        user-select: none;
        font-family: system-ui, -apple-system, sans-serif;
      }
      .arena-battlefield {
        flex: 1;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        position: relative;
        overflow: hidden;
        background: radial-gradient(ellipse at center bottom, #1e1b4b 0%, #030712 85%);
        border: 1.5px solid #4338ca;
        border-radius: 12px;
        padding: 16px;
        box-shadow: inset 0 0 30px rgba(0,0,0,0.8);
      }
      .arena-unit-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        position: relative;
        transition: transform 0.15s ease, border-color 0.15s ease;
      }
      .arena-unit-card.selected-target {
        transform: scale(1.05);
      }
      .arena-unit-card.selected-target .mob-avatar-box {
        border-color: #fde047 !important;
        box-shadow: 0 0 16px rgba(253, 224, 71, 0.7);
      }
      .arena-unit-card.shake {
        animation: arenaShake 0.35s cubic-bezier(.36,.07,.19,.97) both;
      }
      @keyframes arenaShake {
        10%, 90% { transform: translate3d(-3px, 0, 0); }
        20%, 80% { transform: translate3d(5px, 0, 0); }
        30%, 50%, 70% { transform: translate3d(-6px, 0, 0); }
        40%, 60% { transform: translate3d(6px, 0, 0); }
      }
      .floating-text {
        position: absolute;
        top: -10px;
        left: 50%;
        transform: translateX(-50%);
        font-weight: 900;
        pointer-events: none;
        z-index: 100;
        animation: floatUpAndFade 1.2s forwards ease-out;
        white-space: nowrap;
        text-shadow: 0 2px 4px rgba(0,0,0,0.9);
      }
      @keyframes floatUpAndFade {
        0% { opacity: 0; transform: translate(-50%, 10px) scale(0.8); }
        20% { opacity: 1; transform: translate(-50%, -15px) scale(1.25); }
        80% { opacity: 0.9; transform: translate(-50%, -35px) scale(1); }
        100% { opacity: 0; transform: translate(-50%, -55px) scale(0.9); }
      }
      .health-bar-container {
        width: 100%;
        height: 10px;
        background: #0f172a;
        border: 1px solid #334155;
        border-radius: 99px;
        overflow: hidden;
        position: relative;
        margin-top: 4px;
      }
      .health-bar-fill {
        height: 100%;
        background: linear-gradient(90deg, #ef4444, #22c55e);
        transition: width 0.3s ease;
      }
      .mana-bar-fill {
        height: 100%;
        background: linear-gradient(90deg, #3b82f6, #38bdf8);
        transition: width 0.3s ease;
      }
    `;
    document.head.appendChild(style);
  }

  injectModalDom() {
    if (document.getElementById('temporaryCombatModal')) return;

    const modal = document.createElement('div');
    modal.id = 'temporaryCombatModal';
    modal.className = 'arena-backdrop';
    modal.innerHTML = `
      <!-- Cabeçalho da Arena -->
      <div style="display:flex; justify-content:space-between; align-items:center; background:#0f172a; border:1px solid #334155; padding:8px 14px; border-radius:8px;">
        <div style="display:flex; align-items:center; gap:10px;">
          <span style="font-size:1.1rem;">⚔️</span>
          <div>
            <strong style="color:#f43f5e; font-size:0.95rem;">Arena de Combate Temporária</strong>
            <span style="font-size:0.75rem; color:var(--text-muted); margin-left:6px;">(Módulo GM Simulador)</span>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:12px;">
          <span id="arenaRoundBadge" style="background:#1e1b4b; color:#c084fc; font-weight:700; padding:3px 10px; border-radius:99px; font-size:0.8rem; border:1px solid #c084fc;">
            Rodada 1
          </span>
          <button class="btn-danger" onclick="PlayApp.combatArena.closeArena()" style="padding:4px 10px; font-size:0.8rem;">
            ✕ Encerrar
          </button>
        </div>
      </div>

      <!-- Campo de Batalha (Lado Esquerdo = Jogador | Lado Direito = Monstros) -->
      <div class="arena-battlefield">
        <!-- Lado do Jogador -->
        <div id="arenaPlayerCard" class="arena-unit-card" style="width:160px;">
          <div style="position:relative; width:90px; height:105px; display:flex; flex-direction:column; align-items:center; justify-content:flex-end;">
            <div style="position:absolute; bottom:6px; width:52px; height:15px; background:rgba(0,0,0,0.6); border-radius:50%;"></div>
            <img id="arenaPlayerImg" src="" alt="Player" style="position:relative; z-index:2; max-height:85px; max-width:80px; object-fit:contain;" />
          </div>
          <strong id="arenaPlayerName" style="color:#fde047; font-size:0.88rem; margin-top:4px; text-align:center;">Herói</strong>
          <span id="arenaPlayerClass" style="font-size:0.72rem; color:var(--text-muted);">Nv.1</span>
          <!-- Barra de HP do Jogador -->
          <div class="health-bar-container" style="width:140px; height:12px;">
            <div id="arenaPlayerHpFill" class="health-bar-fill" style="width:100%;"></div>
          </div>
          <span id="arenaPlayerHpText" style="font-size:0.7rem; color:#86efac; font-family:monospace; margin-top:2px;">1000 / 1000</span>
          <!-- Barra de MP do Jogador -->
          <div class="health-bar-container" style="width:140px; height:8px; margin-top:2px;">
            <div id="arenaPlayerMpFill" class="mana-bar-fill" style="width:100%;"></div>
          </div>
          <span id="arenaPlayerMpText" style="font-size:0.68rem; color:#7dd3fc; font-family:monospace; margin-top:1px;">300 / 300</span>
        </div>

        <!-- Centro: Efeitos & Indicador de Confronto -->
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px;">
          <span style="font-size:1.6rem; opacity:0.8;">⚡ VS ⚡</span>
          <span id="arenaTurnIndicator" style="font-size:0.76rem; color:#fde047; background:rgba(0,0,0,0.6); padding:3px 8px; border-radius:6px; border:1px solid #fde047;">
            Sua Vez de Agir!
          </span>
        </div>

        <!-- Lado dos Monstros (1 a 5) -->
        <div id="arenaMonstersContainer" style="display:flex; gap:12px; align-items:center; justify-content:center; flex-wrap:wrap; max-width:65%;"></div>
      </div>

      <!-- Barra de Ações & Log de Combate -->
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; height:130px;">
        <!-- Ações do Jogador -->
        <div style="display:flex; flex-direction:column; gap:6px; background:#0f172a; border:1px solid #334155; padding:8px 10px; border-radius:8px;">
          <strong style="font-size:0.78rem; color:var(--text-muted);">Comandos Táticos:</strong>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; flex:1;">
            <button class="btn-primary" onclick="PlayApp.combatArena.performAction('ATTACK')" style="display:flex; align-items:center; justify-content:center; gap:4px; font-weight:700; font-size:0.82rem;">
              🗡️ Ataque Físico
            </button>
            <button onclick="PlayApp.combatArena.performAction('SKILL')" style="display:flex; align-items:center; justify-content:center; gap:4px; font-weight:700; font-size:0.82rem; background:linear-gradient(135deg, #7c3aed, #9333ea); border-color:#a855f7; color:#fff;">
              🔥 Golpe Especial (15 MP)
            </button>
            <button onclick="PlayApp.combatArena.performAction('DEFEND')" style="display:flex; align-items:center; justify-content:center; gap:4px; font-weight:700; font-size:0.82rem; background:#334155;">
              🛡️ Defender (+Cura)
            </button>
            <button onclick="PlayApp.combatArena.autoResolveBattle()" style="display:flex; align-items:center; justify-content:center; gap:4px; font-weight:700; font-size:0.82rem; background:linear-gradient(135deg, #059669, #10b981); border-color:#34d399; color:#fff;">
              ⏩ Auto-Batalha
            </button>
          </div>
        </div>

        <!-- Log Tático Rolável -->
        <div style="display:flex; flex-direction:column; background:#020617; border:1px solid #1e293b; padding:8px 10px; border-radius:8px; overflow:hidden;">
          <strong style="font-size:0.75rem; color:#94a3b8; margin-bottom:4px;">📜 Registro de Combate:</strong>
          <div id="arenaCombatLog" style="flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:3px; font-size:0.72rem; line-height:1.35; color:#cbd5e1; font-family:monospace;"></div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  }

  openArena(battleState) {
    this.currentBattle = battleState;
    this.selectedTargetIndex = 0;
    this.isResolving = false;
    document.getElementById('temporaryCombatModal').style.display = 'flex';
    this.renderBattle();
  }

  closeArena() {
    document.getElementById('temporaryCombatModal').style.display = 'none';
    this.currentBattle = null;
  }

  renderBattle() {
    if (!this.currentBattle) return;
    const b = this.currentBattle;

    // Atualiza cabeçalho
    const roundEl = document.getElementById('arenaRoundBadge');
    if (roundEl) roundEl.textContent = `Rodada ${b.round}`;

    // Atualiza Jogador
    const p = b.player;
    document.getElementById('arenaPlayerImg').src = p.thumbUrl;
    document.getElementById('arenaPlayerName').textContent = p.name;
    document.getElementById('arenaPlayerClass').textContent = `Nível ${p.level}`;

    const pHpPct = Math.max(0, Math.min(100, (p.hp / p.maxHp) * 100));
    const pMpPct = Math.max(0, Math.min(100, (p.mp / p.maxMp) * 100));
    document.getElementById('arenaPlayerHpFill').style.width = `${pHpPct}%`;
    document.getElementById('arenaPlayerHpText').textContent = `${p.hp} / ${p.maxHp} HP`;
    document.getElementById('arenaPlayerMpFill').style.width = `${pMpPct}%`;
    document.getElementById('arenaPlayerMpText').textContent = `${p.mp} / ${p.maxMp} MP`;

    // Renderiza Monstros Inimigos
    const mobsContainer = document.getElementById('arenaMonstersContainer');
    if (mobsContainer) {
      mobsContainer.innerHTML = b.monsters
        .map((m) => {
          const isSelected = m.index === this.selectedTargetIndex;
          const hpPct = Math.max(0, Math.min(100, (m.hp / m.maxHp) * 100));
          const opacity = m.isAlive ? '1' : '0.35';
          return `
          <div id="mobUnitCard_${m.index}" class="arena-unit-card ${isSelected && m.isAlive ? 'selected-target' : ''}" style="width:115px; cursor:pointer; opacity:${opacity};" onclick="PlayApp.combatArena.selectTarget(${m.index})">
            <div class="mob-avatar-box" style="position:relative; width:80px; height:95px; display:flex; flex-direction:column; align-items:center; justify-content:flex-end; border:1.5px solid ${isSelected && m.isAlive ? '#fde047' : '#334155'}; border-radius:8px; padding-bottom:6px; background:rgba(15,23,42,0.6);">
              <div style="position:absolute; bottom:4px; width:44px; height:12px; background:rgba(0,0,0,0.5); border-radius:50%;"></div>
              <img src="${m.thumbUrl}" alt="${m.name}" style="position:relative; z-index:2; max-height:75px; max-width:70px; object-fit:contain;" />
              ${isSelected && m.isAlive ? '<span style="position:absolute; top:-8px; background:#fde047; color:#020617; font-size:0.62rem; font-weight:800; padding:1px 5px; border-radius:4px;">🎯 ALVO</span>' : ''}
              ${!m.isAlive ? '<span style="position:absolute; top:25%; background:#ef4444; color:#fff; font-size:0.65rem; font-weight:800; padding:2px 6px; border-radius:4px;">💀 DERROTADO</span>' : ''}
            </div>
            <strong style="color:#f8fafc; font-size:0.75rem; margin-top:4px; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:110px;">${m.name}</strong>
            <span style="font-size:0.68rem; color:#f43f5e;">Nv.${m.level}</span>
            <div class="health-bar-container" style="width:95px; height:8px;">
              <div class="health-bar-fill" style="width:${hpPct}%;"></div>
            </div>
            <span style="font-size:0.65rem; color:#86efac; font-family:monospace;">${m.hp} / ${m.maxHp}</span>
          </div>`;
        })
        .join('');
    }

    // Renderiza Log de Combate
    const logContainer = document.getElementById('arenaCombatLog');
    if (logContainer) {
      logContainer.innerHTML = b.combatLog
        .map((line) => `<div style="padding:2px 0; border-bottom:1px solid rgba(255,255,255,0.05);">${line}</div>`)
        .join('');
    }

    // Checagem de Fim de Combate
    if (b.isFinished) {
      this.showBattleResult(b);
    }
  }

  selectTarget(index) {
    const mob = this.currentBattle?.monsters.find((m) => m.index === index && m.isAlive);
    if (mob) {
      this.selectedTargetIndex = index;
      this.renderBattle();
    }
  }

  async performAction(actionType) {
    if (!this.currentBattle || this.currentBattle.isFinished || this.isResolving) return;

    try {
      this.isResolving = true;
      const res = await this.client.api('/api/play/temporary-combat/action', {
        method: 'POST',
        body: JSON.stringify({
          battleId: this.currentBattle.battleId,
          actionType,
          targetMonsterIndex: this.selectedTargetIndex,
        }),
      });

      this.currentBattle = res;
      this.renderBattle();
      this.triggerFloatingEffects(res.lastEvents || []);

      // Auto-seleciona próximo monstro vivo se o atual morreu
      const curTarget = res.monsters.find((m) => m.index === this.selectedTargetIndex && m.isAlive);
      if (!curTarget) {
        const nextAlive = res.monsters.find((m) => m.isAlive);
        if (nextAlive) this.selectedTargetIndex = nextAlive.index;
      }
    } catch (err) {
      alert(`Erro no turno de combate: ${err.message}`);
    } finally {
      this.isResolving = false;
    }
  }

  async autoResolveBattle() {
    if (!this.currentBattle || this.currentBattle.isFinished || this.isResolving) return;
    try {
      this.isResolving = true;
      const res = await this.client.api('/api/play/temporary-combat/auto-resolve', {
        method: 'POST',
        body: JSON.stringify({ battleId: this.currentBattle.battleId }),
      });
      this.currentBattle = res;
      this.renderBattle();
      this.triggerFloatingEffects(res.lastEvents || []);
    } catch (err) {
      alert(`Erro ao auto-resolver combate: ${err.message}`);
    } finally {
      this.isResolving = false;
    }
  }

  triggerFloatingEffects(events) {
    for (const ev of events) {
      let targetEl = null;
      if (ev.targetType === 'player') {
        targetEl = document.getElementById('arenaPlayerCard');
      } else if (ev.targetType === 'monster') {
        targetEl = document.getElementById(`mobUnitCard_${ev.targetIndex}`);
      }

      if (targetEl) {
        targetEl.classList.remove('shake');
        void targetEl.offsetWidth; // Força reflow
        targetEl.classList.add('shake');

        const floatSpan = document.createElement('span');
        floatSpan.className = 'floating-text';
        if (ev.type === 'CRIT') {
          floatSpan.innerHTML = `💥 CRÍTICO! -${ev.amount}`;
          floatSpan.style.color = '#fde047';
          floatSpan.style.fontSize = '1.25rem';
        } else if (ev.type === 'HEAL') {
          floatSpan.innerHTML = `💚 +${ev.amount}`;
          floatSpan.style.color = '#86efac';
          floatSpan.style.fontSize = '1.1rem';
        } else {
          floatSpan.innerHTML = `-${ev.amount}`;
          floatSpan.style.color = '#f87171';
          floatSpan.style.fontSize = '1.1rem';
        }

        targetEl.appendChild(floatSpan);
        setTimeout(() => floatSpan.remove(), 1200);
      }
    }
  }

  showBattleResult(b) {
    const isWin = b.winner === 'PLAYER';
    const rewardExp = b.rewards?.exp || 0;
    const rewardGold = b.rewards?.gold || 0;

    const banner = document.createElement('div');
    banner.style.cssText = `
      position: absolute;
      inset: 0;
      z-index: 200;
      background: rgba(2, 6, 23, 0.88);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      padding: 20px;
      text-align: center;
      animation: fadeIn 0.4s ease-out;
    `;

    banner.innerHTML = `
      <div style="font-size:3.5rem;">${isWin ? '🏆' : '💀'}</div>
      <h2 style="color:${isWin ? '#fde047' : '#ef4444'}; margin:0; font-size:1.8rem; text-shadow:0 0 20px ${isWin ? 'rgba(253,224,71,0.5)' : 'rgba(239,68,68,0.5)'};">
        ${isWin ? 'VITÓRIA NA BATALHA!' : 'DERROTA NO COMBATE!'}
      </h2>
      <p style="color:var(--text-muted); max-width:400px; margin:0; font-size:0.88rem;">
        ${isWin ? `Você derrotou todos os inimigos em ${b.round} rodadas!` : 'Seu personagem foi derrotado pelas criaturas selvagens.'}
      </p>
      ${
        isWin
          ? `<div style="display:flex; gap:16px; background:#0f172a; padding:10px 20px; border-radius:8px; border:1px solid #334155;">
               <span style="color:#86efac; font-weight:700;">✨ +${rewardExp} EXP</span>
               <span style="color:#fde047; font-weight:700;">🪙 +${rewardGold} Ouro</span>
             </div>`
          : ''
      }
      <button class="btn-primary" onclick="this.parentElement.remove(); PlayApp.combatArena.closeArena();" style="padding:10px 24px; font-weight:700; font-size:0.92rem; border-radius:999px;">
        ✅ Voltar ao Mapa
      </button>
    `;

    document.getElementById('temporaryCombatModal').appendChild(banner);
  }
}

window.TemporaryCombatArena = TemporaryCombatArena;
