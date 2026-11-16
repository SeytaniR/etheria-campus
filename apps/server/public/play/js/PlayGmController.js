/**
 * @file apps/server/public/play/js/PlayGmController.js
 * @module @etheria/server
 * @description Submódulo do Painel GM Integrado (`/gm`) e Ficha Procedural de Atributos do Jogador.
 *   Contém teleporte 1-clique, modo Raio-X, No-Clip, seletor de velocidade e cálculo da matriz procedural de combate.
 */

class PlayGmController {
  /**
   * Vincula os métodos do Painel GM e Ficha Procedural à instância principal do cliente de jogo.
   * @param {any} client Instância de EtheriaPlayClient
   */
  static attach(client) {
    client.unstuckCharacter = async function () {
      if (!this.activeChar) return;
      try {
        const res = await this.api(`/api/play/characters/${this.activeChar.id}/unstuck`, {
          method: 'POST',
        });
        this.playerX = res.posX;
        this.playerY = res.posY;
        this.moveTargetX = null;
        this.moveTargetY = null;
        this.updateHudInfo();
      } catch (err) {
        alert(`Erro ao destravar personagem: ${err.message}`);
      }
    };

    client.toggleGmDrawer = function () {
      const drawer = document.getElementById('gmDrawer');
      if (drawer) {
        drawer.classList.toggle('open');
        if (typeof this.updateGmGroundDisplay === 'function') {
          this.updateGmGroundDisplay();
        }
        if (drawer.classList.contains('open')) {
          if (typeof this.loadGmBattleMonsters === 'function') {
            this.loadGmBattleMonsters();
          }
          if (typeof this.syncBattleOptionsDisplay === 'function') {
            this.syncBattleOptionsDisplay();
          }
        }
      }
    };

    client.updateGmGroundDisplay = function () {
      const disp = document.getElementById('gmGroundOffsetDisplay');
      if (disp && this.activeChar) {
        const off = this.activeChar.groundOffsetY || 0;
        disp.textContent = `${off > 0 ? '+' : ''}${off} px`;
      }
    };

    client.adjustGmGroundOffset = function (delta) {
      if (!this.activeChar) return;
      if (delta === 0) {
        this.activeChar.groundOffsetY = 0;
      } else {
        const cur = Number(this.activeChar.groundOffsetY) || 0;
        this.activeChar.groundOffsetY = Math.max(-60, Math.min(60, cur + delta));
      }
      this.updateGmGroundDisplay();
    };

    client.saveGmGroundOffset = async function () {
      if (!this.activeChar) return;
      try {
        const offset = Number(this.activeChar.groundOffsetY) || 0;
        const updated = await this.api(`/api/play/characters/${this.activeChar.id}/ground-offset`, {
          method: 'POST',
          body: JSON.stringify({ offset }),
        });
        this.activeChar = updated;
        this.updateGmGroundDisplay();
        const mode = updated.isReborn ? '✨ Reborn' : 'Padrão';
        alert(`✅ Altura do chão (${offset}px) salva com sucesso no banco para o visual ${mode} da classe ${updated.classNamePtBr}!`);
      } catch (err) {
        alert(`Erro ao salvar altura dos pés: ${err.message}`);
      }
    };

    client.renderGmTeleportList = function () {
      const container = document.getElementById('gmMapsTeleportList');
      if (!container) return;

      container.innerHTML = this.mapsList
        .map(
          (m) => `
        <button onclick="PlayApp.gmTeleportToMap(${m.id})" style="display:flex; justify-content:space-between; align-items:center; text-align:left; padding:7px 10px;">
          <span><strong>#${m.id} ${m.namePtBr}</strong> <span style="font-size:0.72rem; color:var(--text-muted);">(${m.code})</span></span>
          <span style="font-size:0.72rem; color:var(--accent);">Spawn (${m.spawnX}, ${m.spawnY}) 🚀</span>
        </button>`
        )
        .join('');
    };

    client.gmTeleportToMap = async function (targetMapId) {
      if (!this.activeChar) return;
      try {
        const res = await this.api(`/api/play/characters/${this.activeChar.id}/gm-teleport`, {
          method: 'POST',
          body: JSON.stringify({ targetMapId }),
        });
        this.activeChar.currentMapId = res.currentMapId;
        this.activeChar.posX = res.posX;
        this.activeChar.posY = res.posY;
        await this.loadMapIntoWorld(res.currentMapId, res.posX, res.posY);
      } catch (err) {
        alert(`Erro no Teleporte GM: ${err.message}`);
      }
    };

    client.toggleGmXray = function () {
      this.gmXray = !this.gmXray;
      const btn = document.getElementById('btnGmXray');
      if (btn) {
        btn.textContent = `👁️ Raio-X de Malhas/Portais: ${this.gmXray ? 'LIGADO ✅' : 'DESLIGADO'}`;
        btn.className = this.gmXray ? 'btn-amber' : '';
      }
    };

    client.toggleGmNoClip = function () {
      this.gmNoClip = !this.gmNoClip;
      const btn = document.getElementById('btnGmNoClip');
      if (btn) {
        btn.textContent = `👻 Atravessar Paredes (No-Clip): ${this.gmNoClip ? 'LIGADO ✅' : 'DESLIGADO'}`;
        btn.className = this.gmNoClip ? 'btn-amber' : '';
      }
    };

    client.setGmSpeed = function (mult) {
      this.gmSpeedMultiplier = Number(mult) || 1;
    };

    client.hotReloadCurrentMap = async function () {
      if (!this.currentMap) return;
      await this.loadPlayBootstrap();
      await this.loadMapIntoWorld(this.currentMap.id, this.playerX, this.playerY);
      alert(`🔄 Mapa #${this.currentMap.id} (${this.currentMap.namePtBr}) recarregado em tempo real do PostgreSQL!`);
    };

    client.openStatsModal = function () {
      if (!this.activeChar) return;
      this._statsModalState = {
        pendingAllocations: { VIT: 0, STR: 0, INT: 0, WIS: 0, AGI: 0, DEX: 0 },
        isConfirmingSave: false,
        isSaving: false,
      };
      this.renderStatsModalView();
      const modal = document.getElementById('statsModal');
      if (modal) modal.style.display = 'flex';
    };

    client.closeStatsModal = function () {
      const modal = document.getElementById('statsModal');
      if (modal) modal.style.display = 'none';
      this._statsModalState = null;
    };

    client.renderStatsModalView = function () {
      if (!this.activeChar) return;
      const c = this.activeChar;
      const base = c.baseAttributesJson || { VIT: 10, STR: 10, INT: 10, WIS: 10, AGI: 10, DEX: 10 };
      const dist = (c.distributedStatsJson && typeof c.distributedStatsJson === 'object')
        ? c.distributedStatsJson
        : { VIT: 0, STR: 0, INT: 0, WIS: 0, AGI: 0, DEX: 0 };
      const grow = c.growthPerLevelJson || { VIT: 2, STR: 2, INT: 2, WIS: 2, AGI: 2, DEX: 2 };
      const lvUps = Math.max(0, (c.level || 1) - 1);

      const state = this._statsModalState || {
        pendingAllocations: { VIT: 0, STR: 0, INT: 0, WIS: 0, AGI: 0, DEX: 0 },
        isConfirmingSave: false,
        isSaving: false,
      };
      const pending = state.pendingAllocations;
      const totalPending = Object.values(pending).reduce((sum, p) => sum + (Number(p) || 0), 0);
      const remainingUnspent = Math.max(0, (Number(c.unspentStatPoints) || 0) - totalPending);

      const ATTR_METAS = {
        VIT: { label: 'VIT • Vitalidade', desc: 'Aumenta HP Máximo e Defesa' },
        STR: { label: 'STR • Força', desc: 'Aumenta Dano Físico e Carga' },
        INT: { label: 'INT • Inteligência', desc: 'Aumenta Dano Mágico' },
        WIS: { label: 'WIS • Sabedoria', desc: 'Aumenta MP Máximo e Def. Mágica' },
        AGI: { label: 'AGI • Agilidade', desc: 'Aumenta Vel. Ataque e Evasão' },
        DEX: { label: 'DEX • Destreza', desc: 'Aumenta Precisão e Crítico' },
      };

      const baseTotals = {};
      const previewTotals = {};
      for (const k of ['VIT', 'STR', 'INT', 'WIS', 'AGI', 'DEX']) {
        const permanentBase = (Number(base[k]) || 0) + (Number(grow[k]) || 0) * lvUps + (Number(dist[k]) || 0);
        baseTotals[k] = permanentBase;
        previewTotals[k] = permanentBase + (Number(pending[k]) || 0);
      }

      // Calcula Atributos de Combate Atuais e Preview via Matriz Procedural
      const combatRows = (this.combatAttributes || []).map((ca) => {
        let baseVal = Number(ca.baseDefault) || 0;
        let previewVal = Number(ca.baseDefault) || 0;
        for (const conv of (this.attributeConversions || [])) {
          if (conv.combatAttributeCode === ca.code) {
            baseVal += (baseTotals[conv.baseAttributeCode] || 0) * Number(conv.ratioPerPoint);
            previewVal += (previewTotals[conv.baseAttributeCode] || 0) * Number(conv.ratioPerPoint);
          }
        }
        const diff = previewVal - baseVal;
        const curFormatted = ca.isPercentage ? `${baseVal.toFixed(1)}%` : Math.round(baseVal);
        const prevFormatted = ca.isPercentage ? `${previewVal.toFixed(1)}%` : Math.round(previewVal);
        const hasDiff = Math.abs(diff) > 0.001;

        return `
          <div class="stats-combat-row">
            <div>
              <span class="stats-combat-name">${ca.namePtBr || ca.code}</span>
              <span class="stats-combat-code">${ca.code}</span>
            </div>
            <div style="display:flex; align-items:center;">
              <span class="stats-combat-val">${hasDiff ? prevFormatted : curFormatted}</span>
              ${hasDiff ? `<span class="stats-combat-preview">(+${ca.isPercentage ? diff.toFixed(1) + '%' : Math.round(diff)})</span>` : ''}
            </div>
          </div>
        `;
      });

      const el = this.getElementStyle(c.elementCode);
      const modalBody = document.getElementById('statsModalBody');
      if (!modalBody) return;

      modalBody.innerHTML = `
        <!-- Banner do Herói -->
        <div class="stats-hero-banner">
          <div class="stats-hero-profile">
            <img class="stats-hero-thumb" src="${c.thumbUrl || '/play/assets/hud/menu_character.png'}" alt="${c.name}" />
            <div>
              <div class="stats-hero-name">${c.name} (Nv. ${c.level})</div>
              <div class="stats-hero-meta">${c.classNamePtBr || 'Classe'} &bull; ${c.raceCode || 'HUMAN'} &bull; <span style="color:${el.color}; font-weight:700;">${el.icon} ${c.elementNamePtBr || c.elementCode}</span></div>
            </div>
          </div>
          <div class="stats-points-badge ${remainingUnspent > 0 ? 'has-points' : 'zero-points'}">
            ★ ${remainingUnspent} Pts Livres
          </div>
        </div>

        <!-- Grid Principal em 2 Colunas -->
        <div class="stats-main-grid">
          <!-- Coluna 1: 6 Atributos Base & Distribuição Não-Bloqueante -->
          <div class="stats-section-box">
            <div class="stats-section-header">
              <h4 class="stats-section-title">⚡ 6 Atributos Base</h4>
              <span style="font-size:0.68rem; color:#94a3b8;">${totalPending > 0 ? `<strong style="color:#4ade80;">+${totalPending} pts alocados</strong>` : 'Clique em + para alocar'}</span>
            </div>

            <div class="stats-base-list">
              ${['VIT', 'STR', 'INT', 'WIS', 'AGI', 'DEX'].map((k) => {
                const meta = ATTR_METAS[k];
                const curVal = previewTotals[k];
                const pts = Number(pending[k]) || 0;
                return `
                  <div class="stats-base-row ${pts > 0 ? 'is-allocated' : ''}">
                    <div class="stats-attr-info">
                      <span class="stats-attr-label">${meta.label}</span>
                      <span class="stats-attr-desc">${meta.desc}</span>
                    </div>
                    <div class="stats-attr-controls">
                      <div class="stats-val-display">
                        ${curVal}
                        ${pts > 0 ? `<span class="stats-pending-pill">(+${pts})</span>` : ''}
                      </div>
                      <button type="button" class="stats-btn-ctrl stats-btn-minus" onclick="PlayApp.removePendingStatPoint('${k}')" ${pts <= 0 ? 'disabled' : ''} title="Remover ponto de ${k}">-</button>
                      <button type="button" class="stats-btn-ctrl stats-btn-plus" onclick="PlayApp.addPendingStatPoint('${k}')" ${remainingUnspent <= 0 ? 'disabled' : ''} title="Adicionar ponto em ${k}">+</button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>

            <!-- Painel de Confirmação ou Barra de Ações -->
            ${state.isConfirmingSave ? `
              <div class="stats-confirm-box">
                <div class="stats-confirm-title">⚠️ Confirmar Distribuição de Pontos?</div>
                <div class="stats-confirm-text">
                  Você está alocando <strong>${totalPending} ponto(s)</strong>:
                  ${Object.entries(pending).filter(([, p]) => p > 0).map(([k, p]) => `<strong>+${p} ${k}</strong>`).join(', ')}.
                  <br/><span style="color:#fbbf24;">Esta ação consumirá seus pontos livres permanentemente.</span>
                </div>
                <div class="stats-confirm-actions">
                  <button type="button" class="stats-btn-confirm" onclick="PlayApp.confirmSaveStats()" ${state.isSaving ? 'disabled' : ''}>
                    ${state.isSaving ? '⏳ Salvando...' : '✓ Sim, Confirmar e Salvar'}
                  </button>
                  <button type="button" class="stats-btn-cancel" onclick="PlayApp.cancelSaveStatsPrompt()" ${state.isSaving ? 'disabled' : ''}>
                    ✕ Cancelar
                  </button>
                </div>
              </div>
            ` : `
              <div class="stats-actions-bar">
                <button type="button" class="stats-btn-save" onclick="PlayApp.promptSaveStats()" ${totalPending <= 0 ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''}>
                  💾 Salvar Atributos ${totalPending > 0 ? `(+${totalPending} pts)` : ''}
                </button>
                ${totalPending > 0 ? `
                  <button type="button" class="stats-btn-reset" onclick="PlayApp.resetPendingStats()" title="Limpar pontos não salvos">
                    ↺ Redefinir
                  </button>
                ` : ''}
              </div>
            `}
          </div>

          <!-- Coluna 2: Atributos de Combate Derivados (Matriz Procedural) -->
          <div class="stats-section-box">
            <div class="stats-section-header">
              <h4 class="stats-section-title">⚔️ Atributos de Combate</h4>
              <span style="font-size:0.68rem; color:#86efac; font-weight:700;">Matriz Procedural</span>
            </div>
            <div class="stats-combat-grid">
              ${combatRows.join('')}
            </div>
          </div>
        </div>
      `;
    };

    client.addPendingStatPoint = function (attr) {
      if (!this._statsModalState || !this.activeChar) return;
      const pending = this._statsModalState.pendingAllocations;
      const totalPending = Object.values(pending).reduce((sum, p) => sum + (Number(p) || 0), 0);
      const remainingUnspent = (Number(this.activeChar.unspentStatPoints) || 0) - totalPending;
      if (remainingUnspent <= 0) return;

      pending[attr] = (Number(pending[attr]) || 0) + 1;
      this._statsModalState.isConfirmingSave = false;
      this.renderStatsModalView();
    };

    client.removePendingStatPoint = function (attr) {
      if (!this._statsModalState) return;
      const pending = this._statsModalState.pendingAllocations;
      if ((Number(pending[attr]) || 0) <= 0) return;

      pending[attr] = Math.max(0, (Number(pending[attr]) || 0) - 1);
      this._statsModalState.isConfirmingSave = false;
      this.renderStatsModalView();
    };

    client.resetPendingStats = function () {
      if (!this._statsModalState) return;
      this._statsModalState.pendingAllocations = { VIT: 0, STR: 0, INT: 0, WIS: 0, AGI: 0, DEX: 0 };
      this._statsModalState.isConfirmingSave = false;
      this.renderStatsModalView();
    };

    client.promptSaveStats = function () {
      if (!this._statsModalState) return;
      const totalPending = Object.values(this._statsModalState.pendingAllocations).reduce((sum, p) => sum + (Number(p) || 0), 0);
      if (totalPending <= 0) return;
      this._statsModalState.isConfirmingSave = true;
      this.renderStatsModalView();
    };

    client.cancelSaveStatsPrompt = function () {
      if (!this._statsModalState) return;
      this._statsModalState.isConfirmingSave = false;
      this.renderStatsModalView();
    };

    client.confirmSaveStats = async function () {
      if (!this._statsModalState || !this.activeChar) return;
      const totalPending = Object.values(this._statsModalState.pendingAllocations).reduce((sum, p) => sum + (Number(p) || 0), 0);
      if (totalPending <= 0) return;

      this._statsModalState.isSaving = true;
      this.renderStatsModalView();

      try {
        const res = await this.api(`/api/play/characters/${this.activeChar.id}/distribute-stats`, {
          method: 'POST',
          body: JSON.stringify({ allocations: this._statsModalState.pendingAllocations }),
        });

        if (res && res.success) {
          this.activeChar.unspentStatPoints = res.unspentStatPoints;
          this.activeChar.distributedStatsJson = res.distributedStatsJson;
          this._statsModalState.pendingAllocations = { VIT: 0, STR: 0, INT: 0, WIS: 0, AGI: 0, DEX: 0 };
          this._statsModalState.isConfirmingSave = false;
          this._statsModalState.isSaving = false;
          this.updateHudInfo?.();
          this.showNotification?.('✓ Pontos de atributos distribuídos e salvos com sucesso!', 'success');
          this.renderStatsModalView();
        }
      } catch (err) {
        this._statsModalState.isSaving = false;
        alert(`Erro ao salvar pontos: ${err.message}`);
        this.renderStatsModalView();
      }
    };

    client.toggleCharacterReborn = async function () {
      if (!this.activeChar) return;
      try {
        const updated = await this.api(`/api/play/characters/${this.activeChar.id}/toggle-reborn`, {
          method: 'POST',
        });
        this.activeChar = updated;
        this.getOrCreateSprite(
          `char_${this.activeChar.mcreworkCharKey}`,
          this.activeChar.atlasJsonUrl,
          this.activeChar.atlasWebpUrl,
          this.activeChar.thumbUrl
        ).load();
        this.updateHudInfo();
        this.updateGmGroundDisplay();
        const status = updated.isReborn ? '✨ Reencarnado (Reborn)' : '👤 Normal / Padrão';
        alert(`Visual alternado para: ${status}\nOffset do Chão ativo: ${updated.groundOffsetY}px`);
      } catch (err) {
        alert(`Erro ao alternar forma reencarnada: ${err.message}`);
      }
    };

    client.gmBattleQty = 1;
    client.availableMonsters = [];

    client.setGmBattleQty = function (qty) {
      this.gmBattleQty = Math.max(1, Math.min(5, Number(qty) || 1));
      [1, 2, 3, 5].forEach((n) => {
        const btn = document.getElementById(`btnGmBattleQty_${n}`);
        if (btn) btn.className = n === this.gmBattleQty ? 'btn-primary' : '';
      });
    };

    client.loadGmBattleMonsters = async function () {
      const select = document.getElementById('gmBattleMonsterSelect');
      if (!select) return;
      try {
        this.availableMonsters = await this.api('/api/play/temporary-combat/monsters');
        if (this.availableMonsters.length === 0) {
          select.innerHTML = '<option value="">Nenhum monstro cadastrado</option>';
          return;
        }
        select.innerHTML = this.availableMonsters
          .map(
            (m) =>
              `<option value="${m.id}">#${m.id} [Rank ${m.rarityTier || 'F'}] ${m.namePtBr} (${m.raceCode} • ${m.elementCode})</option>`
          )
          .join('');
      } catch (err) {
        console.error('Falha ao carregar monstros para GM:', err);
      }
    };

    client.startGmBattle = async function () {
      if (!this.activeChar) {
        alert('Selecione primeiro um personagem.');
        return;
      }
      const select = document.getElementById('gmBattleMonsterSelect');
      const mobId = select ? select.value : '';
      if (!mobId) {
        alert('Nenhum monstro selecionado.');
        return;
      }
      const lvlInput = document.getElementById('gmBattleMobLevel');
      const mobLvl = lvlInput ? Number(lvlInput.value) || 1 : 1;

      try {
        const battleState = await this.api('/api/play/temporary-combat/start', {
          method: 'POST',
          body: JSON.stringify({
            characterId: this.activeChar.id,
            monsterTemplateId: Number(mobId),
            quantity: this.gmBattleQty || 1,
            monsterLevel: mobLvl,
          }),
        });

        if (!this.actionCombatArena && window.ActionCombatArena) {
          this.actionCombatArena = new ActionCombatArena(this);
          window.PlayApp.actionArena = this.actionCombatArena;
        }
        if (this.actionCombatArena) {
          this.actionCombatArena.openArena(battleState);
        } else {
          alert('Erro: ActionCombatArena não pôde ser instanciada.');
        }
      } catch (err) {
        alert(`Erro ao iniciar batalha GM: ${err.message}`);
      }
    };

    client.syncBattleOptionsDisplay = function () {
      const sfxBtn = document.getElementById('btnGmToggleSfx');
      if (sfxBtn && window.BattleTransitionController) {
        const on = window.BattleTransitionController.sfxEnabled;
        sfxBtn.textContent = on ? '🔊 Ligado' : '🔇 Desligado';
        sfxBtn.className = on ? '' : 'btn-danger';
      }
      const veilBtn = document.getElementById('btnGmToggleVeil');
      if (veilBtn) {
        const on = this.actionCombatArena?.vfxRenderer
          ? this.actionCombatArena.vfxRenderer.veilEffectsEnabled
          : localStorage.getItem('etheria_veil_effects') !== 'false';
        veilBtn.textContent = on ? '🌫️ Ligado' : '🌫️ Desligado';
        veilBtn.className = on ? '' : 'btn-danger';
      }
    };

    client.toggleBattleSfx = function () {
      if (window.BattleTransitionController) {
        const next = !window.BattleTransitionController.sfxEnabled;
        window.BattleTransitionController.sfxEnabled = next;
        try { localStorage.setItem('etheria_battle_sfx', next ? 'true' : 'false'); } catch {}
        this.syncBattleOptionsDisplay();
      }
    };

    client.toggleVeilEffects = function () {
      if (this.actionCombatArena?.vfxRenderer) {
        this.actionCombatArena.vfxRenderer.toggleVeilEffects();
      } else {
        const cur = localStorage.getItem('etheria_veil_effects') !== 'false';
        try { localStorage.setItem('etheria_veil_effects', (!cur) ? 'true' : 'false'); } catch {}
      }
      this.syncBattleOptionsDisplay();
    };
  }
}

window.PlayGmController = PlayGmController;
