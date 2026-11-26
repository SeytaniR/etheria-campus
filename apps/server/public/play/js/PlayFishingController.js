/**
 * @file apps/server/public/play/js/PlayFishingController.js
 * @module @etheria/client/fishing
 * @description Controlador Frontend do Sistema de Pesca Contínua (AFK) no `/play`:
 *   - Detecta proximidade à malha de pesca (`fishingMeshJson`) e exibe o botão contextual `#hudFishingActionBtn`.
 *   - Abre o modal responsivo `#fishingSetupModal` para conferir a Vara de Pesca equipada e ordenar as iscas da mochila.
 *   - Mantém o personagem parado e virado para a água durante a pesca contínua até o jogador clicar em `🛑 Parar de Pescar`.
 *   - Desenha no Canvas 2.5D: vara animada + barra de progresso acima da cabeça do personagem, linha/boia e ondulações na água.
 *   - Integra-se totalmente com `PlayUiLayoutApplier` e `PlayClientHudEditor` para personalização no `/admin` e no client.
 */

class PlayFishingController {
  constructor() {
    this.client = null;
    this.isFishing = false;
    this.hudEditorPreview = false;
    this.nearWaterPoint = null;
    this.lastProximityCheckAt = 0;
    this.lastBlockedToastAt = 0;

    this.equippedRod = null;
    this.baitsInBag = [];
    this.orderedBaits = []; // [{ itemTemplateId, enabled, ... }]
    this.activeSession = null;
    this.cycleStartedAt = 0;
    this.cycleDurationMs = 10000;
    this.tickPending = false;
    this.floatingTexts = []; // [{ text, color, startedAt, x, y }]
    this.rodIconImgCache = new Map();
  }

  static get BAIT_ORDER_STORAGE_KEY() {
    return 'etheria_fishing_bait_order_v1';
  }

  static init(client) {
    if (!window.PlayFishingInstance) {
      window.PlayFishingInstance = new PlayFishingController();
    }
    const inst = window.PlayFishingInstance;
    inst.client = client;
    inst.injectDom();
    window.PlayFishingController = inst;
    return inst;
  }

  injectDom() {
    const worldScreen = document.getElementById('worldScreen');
    if (!worldScreen) return;

    if (!document.getElementById('hudFishingActionBtn')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'hudFishingActionBtn';
      btn.className = 'hud-fishing-action-btn';
      btn.setAttribute('data-ui-code', 'HUD_FISHING_ACTION_BTN');
      btn.innerHTML = `<span class="fishing-btn-icon">🎣</span><span data-i18n="play.fishing.btnFish">Pescar</span>`;
      btn.onclick = () => this.openSetupModal();
      worldScreen.appendChild(btn);
    }

    if (!document.getElementById('hudFishingStatusBar')) {
      const bar = document.createElement('div');
      bar.id = 'hudFishingStatusBar';
      bar.className = 'hud-fishing-status-bar';
      bar.setAttribute('data-ui-code', 'HUD_FISHING_STATUS_BAR');
      bar.innerHTML = `
        <div class="fishing-status-top">
          <span id="fishingStatusTitle">🎣 Pescando...</span>
          <span id="fishingStatusTimer" style="color:#67e8f9; font-family:monospace; font-weight:800;">0.0s</span>
        </div>
        <div class="fishing-progress-track">
          <div id="fishingStatusProgressFill" class="fishing-progress-fill"></div>
        </div>
        <div class="fishing-status-bottom">
          <span id="fishingStatusBaitLabel">🪱 Sem isca</span>
          <button type="button" class="fishing-stop-btn" onclick="window.PlayFishingController.stopFishing()" data-i18n="play.fishing.btnStop">🛑 Parar de Pescar</button>
        </div>
      `;
      worldScreen.appendChild(bar);
    }

    if (!document.getElementById('fishingSetupModal')) {
      const modal = document.createElement('div');
      modal.id = 'fishingSetupModal';
      modal.onclick = (e) => {
        if (e.target === modal) this.closeSetupModal();
      };
      modal.innerHTML = `
        <div class="fishing-setup-dialog" data-ui-code="MODAL_FISHING_SETUP" onclick="event.stopPropagation()">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #1e293b; padding-bottom:8px;">
            <strong style="color:#67e8f9; font-size:1rem;" data-i18n="play.fishing.setupTitle">🎣 Preparar Pesca Contínua</strong>
            <button type="button" class="btn-danger" style="padding:4px 10px;" onclick="window.PlayFishingController.closeSetupModal()">✕</button>
          </div>
          <div id="fishingSetupBody" style="display:flex; flex-direction:column; gap:10px; overflow-y:auto;"></div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    window.PlayUiLayoutApplier?.applyAll();
  }

  isCombatBlocking() {
    if (typeof this.client?.isInCombatState === 'function') {
      return Boolean(this.client.isInCombatState());
    }
    return Boolean(
      this.client?.actionCombatArena?.isActive ||
      this.client?.actionCombatArena?.isTransitioning ||
      this.client?.isEncounterLoading ||
      (typeof window !== 'undefined' && window.BattleTransitionController?.isActive) ||
      (typeof document !== 'undefined' && document.body?.classList?.contains?.('is-in-combat'))
    );
  }

  onEnterCombat() {
    this.closeSetupModal();
    this.hudEditorPreview = false;
    this.nearWaterPoint = null;
    if (this.isFishing || this.activeSession) {
      this.forceStopLocal(true);
    } else {
      this.syncHudVisibility();
    }
  }

  onExitCombat() {
    this.lastProximityCheckAt = 0;
    this.syncHudVisibility();
  }

  setHudEditorPreview(enabled) {
    const allowed = Boolean(enabled) && !this.isCombatBlocking();
    this.hudEditorPreview = allowed;
    const btn = document.getElementById('hudFishingActionBtn');
    const bar = document.getElementById('hudFishingStatusBar');
    if (btn) {
      btn.dataset.fishingEditorPreview = this.hudEditorPreview ? 'true' : 'false';
      if (this.hudEditorPreview) btn.style.display = 'flex';
    }
    if (bar) {
      bar.dataset.fishingEditorPreview = this.hudEditorPreview ? 'true' : 'false';
      if (this.hudEditorPreview) {
        bar.style.display = 'flex';
        const fill = document.getElementById('fishingStatusProgressFill');
        if (fill && !this.isFishing) fill.style.width = '58%';
      }
    }
    window.PlayUiLayoutApplier?.applyAll();
    this.syncHudVisibility();
  }

  syncHudVisibility() {
    const btn = document.getElementById('hudFishingActionBtn');
    const bar = document.getElementById('hudFishingStatusBar');
    const inCombat = this.isCombatBlocking();
    const allowPreview = Boolean(this.hudEditorPreview) && !inCombat;

    if (inCombat) {
      this.closeSetupModal();
    }
    if (typeof document !== 'undefined') {
      document.body?.classList?.toggle?.('is-fishing', !inCombat && Boolean(this.isFishing));
    }

    if (btn) {
      if (!allowPreview && btn.dataset) btn.dataset.fishingEditorPreview = 'false';
      const showBtn = allowPreview || (!inCombat && !this.isFishing && !this.client?.isFlying && Boolean(this.nearWaterPoint));
      if (btn.dataset) btn.dataset.fishingVisible = showBtn ? 'true' : 'false';
      btn.style.display = showBtn ? 'flex' : 'none';
    }
    if (bar) {
      if (!allowPreview && bar.dataset) bar.dataset.fishingEditorPreview = 'false';
      const showBar = allowPreview || (!inCombat && this.isFishing);
      if (bar.dataset) bar.dataset.fishingVisible = showBar ? 'true' : 'false';
      bar.style.display = showBar ? 'flex' : 'none';
    }
  }

  notifyMoveBlocked() {
    const now = performance.now();
    if (now - this.lastBlockedToastAt < 1800) return;
    this.lastBlockedToastAt = now;
    this.client?.showNotification?.('🎣 Clique em "Parar de Pescar" para voltar a se mover.', 'info');
  }

  loadSavedBaitOrder() {
    try {
      const raw = localStorage.getItem(PlayFishingController.BAIT_ORDER_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  saveBaitOrder() {
    try {
      const compact = this.orderedBaits.map((b) => ({ id: b.itemTemplateId, enabled: b.enabled !== false }));
      localStorage.setItem(PlayFishingController.BAIT_ORDER_STORAGE_KEY, JSON.stringify(compact));
    } catch {
      // ignore storage failure
    }
  }

  mergeBaitsWithSavedOrder(baitsInBag) {
    const saved = this.loadSavedBaitOrder();
    const byId = new Map((baitsInBag || []).map((b) => [Number(b.itemTemplateId), b]));
    const result = [];
    const seen = new Set();

    for (const entry of saved) {
      const id = Number(entry?.id ?? entry);
      if (!byId.has(id) || seen.has(id)) continue;
      seen.add(id);
      result.push({ ...byId.get(id), enabled: entry?.enabled !== false });
    }
    for (const b of baitsInBag || []) {
      const id = Number(b.itemTemplateId);
      if (seen.has(id)) continue;
      seen.add(id);
      result.push({ ...b, enabled: true });
    }
    this.orderedBaits = result;
  }

  async openSetupModal() {
    if (!this.client?.activeChar) return;
    if (this.isCombatBlocking()) {
      this.closeSetupModal();
      this.syncHudVisibility();
      this.client.showNotification?.('⚔️ Não é possível pescar durante uma batalha.', 'warning');
      return;
    }
    if (this.isFishing) return;
    if (this.client.isFlying) {
      this.client.showNotification?.('🦅 Pouse no chão antes de pescar.', 'warning');
      return;
    }
    if (!this.nearWaterPoint) {
      this.client.showNotification?.('🌊 Aproxime-se de uma área de pesca na água primeiro.', 'warning');
      return;
    }

    try {
      const status = await this.client.api(`/api/play/fishing/status?characterId=${this.client.activeChar.id}`);
      if (this.isCombatBlocking() || status?.inCombat || status?.activityState === 'COMBAT') {
        this.closeSetupModal();
        this.syncHudVisibility();
        this.client.showNotification?.('⚔️ Não é possível pescar durante uma batalha.', 'warning');
        return;
      }
      this.equippedRod = status.equippedRod || null;
      this.baitsInBag = status.baitsInBag || [];
      this.mergeBaitsWithSavedOrder(this.baitsInBag);
      this.renderSetupModalBody(status.fishPoolCount || 0);
      const modal = document.getElementById('fishingSetupModal');
      if (modal) modal.style.display = 'flex';
      window.PlayUiLayoutApplier?.applyAll();
    } catch (err) {
      this.client.showNotification?.(`Erro ao abrir pesca: ${err.message}`, 'danger');
    }
  }

  closeSetupModal() {
    const modal = document.getElementById('fishingSetupModal');
    if (modal) modal.style.display = 'none';
  }

  moveBaitOrder(index, delta) {
    const target = index + delta;
    if (target < 0 || target >= this.orderedBaits.length) return;
    const tmp = this.orderedBaits[index];
    this.orderedBaits[index] = this.orderedBaits[target];
    this.orderedBaits[target] = tmp;
    this.saveBaitOrder();
    this.renderSetupModalBody(1);
  }

  toggleBaitEnabled(index, checked) {
    if (!this.orderedBaits[index]) return;
    this.orderedBaits[index].enabled = Boolean(checked);
    this.saveBaitOrder();
    this.renderSetupModalBody(1);
  }

  formatBaitBonusText(cfg) {
    const parts = [];
    if ((cfg?.catchChanceBonusPct || 0) > 0) parts.push(`+${cfg.catchChanceBonusPct}% fisgada`);
    const rw = cfg?.rankBonusWeights || {};
    const rankStr = ['F', 'D', 'C', 'B', 'A', 'S', 'SS'].filter((r) => Number(rw[r]) > 0).map((r) => `+${rw[r]} ${r}`).join(', ');
    if (rankStr) parts.push(rankStr);
    return parts.join(' • ') || 'Isca comum';
  }

  renderSetupModalBody(fishPoolCount) {
    const body = document.getElementById('fishingSetupBody');
    if (!body) return;

    if (!this.equippedRod) {
      body.innerHTML = `
        <div style="background:rgba(245,158,11,0.14); border:1px solid #f59e0b; border-radius:10px; padding:12px; text-align:center; color:#fde68a; font-size:0.84rem;">
          🎣 <strong>Nenhuma Vara de Pesca equipada!</strong><br/>
          <span style="color:#cbd5e1; font-size:0.76rem;">Equipe uma Vara de Pesca (Nv. 50+) na sua Mochila para começar a pescar.</span>
        </div>
        <button type="button" class="btn-primary" onclick="window.PlayFishingController.closeSetupModal(); window.PlayApp.openBagModal();" style="padding:10px; font-weight:800;">🎒 Abrir Mochila</button>
      `;
      return;
    }

    const rod = this.equippedRod;
    const cfg = rod.fishingRodConfig || {};
    const rw = cfg.rankWeights || {};
    const rankPills = ['F', 'D', 'C', 'B', 'A', 'S', 'SS']
      .filter((r) => Number(rw[r]) > 0)
      .map((r) => `<span style="background:#020617; border:1px solid #164e63; padding:1px 6px; border-radius:4px; font-size:0.68rem; color:#bae6fd;">${r}: ${rw[r]}</span>`)
      .join(' ');

    const baitsHtml =
      this.orderedBaits.length === 0
        ? `<div style="background:rgba(15,23,42,0.85); border:1px dashed #334155; border-radius:8px; padding:10px; font-size:0.76rem; color:#94a3b8; text-align:center;">
             🪱 Nenhuma isca na mochila — você pode pescar usando apenas as chances da sua vara.
           </div>`
        : this.orderedBaits
            .map(
              (b, idx) => `
          <div class="fishing-bait-row ${b.enabled ? 'is-enabled' : ''}">
            <div style="display:flex; align-items:center; gap:8px; min-width:0; flex:1;">
              <input type="checkbox" ${b.enabled ? 'checked' : ''} onchange="window.PlayFishingController.toggleBaitEnabled(${idx}, this.checked)" />
              <span style="font-size:0.74rem; font-weight:900; color:${b.enabled ? '#5eead4' : '#64748b'}; min-width:20px;">#${idx + 1}</span>
              <img src="${b.iconUrl}" alt="" style="width:30px; height:30px; object-fit:contain; border-radius:6px; background:#020617;" />
              <div style="min-width:0;">
                <div style="font-size:0.78rem; font-weight:700; color:#f8fafc; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${b.namePtBr} <span style="color:#fde047;">x${b.quantity}</span></div>
                <div style="font-size:0.66rem; color:#99f6e4;">${this.formatBaitBonusText(b.fishingBaitConfig)}</div>
              </div>
            </div>
            <div class="fishing-bait-controls">
              <button type="button" class="fishing-order-btn" ${idx === 0 ? 'disabled' : ''} onclick="window.PlayFishingController.moveBaitOrder(${idx}, -1)">▲</button>
              <button type="button" class="fishing-order-btn" ${idx === this.orderedBaits.length - 1 ? 'disabled' : ''} onclick="window.PlayFishingController.moveBaitOrder(${idx}, 1)">▼</button>
            </div>
          </div>`
            )
            .join('');

    body.innerHTML = `
      <div class="fishing-rod-summary-card">
        <img src="${rod.iconUrl}" alt="" style="width:44px; height:44px; object-fit:contain; border-radius:8px; background:#020617; border:1px solid #22d3ee;" />
        <div style="flex:1; min-width:0;">
          <div style="font-size:0.86rem; font-weight:800; color:#67e8f9;">${rod.namePtBr}</div>
          <div style="font-size:0.73rem; color:#cbd5e1;">⏱️ Ciclo: <strong>${cfg.castIntervalSec ?? 10}s</strong> &bull; 🎯 Fisgada: <strong>${cfg.catchChancePct ?? 65}%</strong></div>
          <div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:4px;">${rankPills}</div>
        </div>
      </div>

      <div>
        <div style="font-size:0.78rem; font-weight:700; color:#5eead4; margin-bottom:4px;">
          🪱 Ordem de Uso das Iscas (Consome 1 por tentativa até acabar e passa para a próxima):
        </div>
        <div class="fishing-bait-list">${baitsHtml}</div>
      </div>

      ${fishPoolCount === 0 ? `<div style="font-size:0.75rem; color:#fca5a5;">⚠️ Nenhum peixe cadastrado no catálogo ainda.</div>` : ''}

      <button type="button" class="fishing-start-btn" onclick="window.PlayFishingController.startFishing()" ${fishPoolCount === 0 ? 'disabled' : ''}>
        🎣 Iniciar Pesca AFK (Fica pescando até clicar em Parar)
      </button>
    `;
  }

  async startFishing() {
    if (!this.client?.activeChar) return;
    if (this.isCombatBlocking()) {
      this.closeSetupModal();
      this.syncHudVisibility();
      this.client.showNotification?.('⚔️ Não é possível pescar durante uma batalha.', 'warning');
      return;
    }
    if (this.client.isFlying) {
      this.client.showNotification?.('🦅 Pouse no chão antes de pescar.', 'warning');
      return;
    }
    if (this.isFishing) return;
    const baitQueue = this.orderedBaits.filter((b) => b.enabled !== false).map((b) => Number(b.itemTemplateId));
    this.saveBaitOrder();

    try {
      const res = await this.client.api('/api/play/fishing/start', {
        method: 'POST',
        body: JSON.stringify({
          characterId: this.client.activeChar.id,
          baitQueue,
          posX: Math.round(this.client.playerX),
          posY: Math.round(this.client.playerY),
        }),
      });

      if (this.isCombatBlocking()) {
        this.closeSetupModal();
        this.isFishing = true;
        this.forceStopLocal(true);
        return;
      }

      this.closeSetupModal();
      this.activeSession = res.session;
      this.baitsInBag = res.baitsInBag || this.baitsInBag;
      this.isFishing = true;
      this.cycleDurationMs = Math.max(2000, Number(this.activeSession?.castIntervalSec || 10) * 1000);
      this.cycleStartedAt = performance.now();
      this.tickPending = false;

      // Trava movimento local e vira o herói exatamente na direção da água
      this.client.currentPath = null;
      this.client.moveTargetX = null;
      this.client.moveTargetY = null;
      this.client.targetDestX = null;
      this.client.targetDestY = null;
      this.client.isMoving = false;
      this.client.dpadDx = 0;
      this.client.dpadDy = 0;
      this.client.keysDown?.clear();

      const wp = this.activeSession?.waterPoint || this.nearWaterPoint?.point;
      if (wp && typeof this.client.calculateDirection8 === 'function') {
        const dx = wp.x - this.client.playerX;
        const dy = wp.y - this.client.playerY;
        if (Math.hypot(dx, dy) > 2) {
          this.client.playerDir = this.client.calculateDirection8(dx, dy);
        }
      }

      this.syncHudVisibility();
      this.updateStatusBarUi(0);
    } catch (err) {
      this.client.showNotification?.(`🎣 ${err.message}`, 'warning');
    }
  }

  async stopFishing() {
    if (!this.isFishing && !this.activeSession) return;
    const charId = this.client?.activeChar?.id;
    this.forceStopLocal(false);
    if (charId && this.client?.token) {
      await this.client.api('/api/play/fishing/stop', {
        method: 'POST',
        body: JSON.stringify({ characterId: charId }),
      }).catch(() => {});
    }
  }

  forceStopLocal(notifyServer = false) {
    const charId = this.client?.activeChar?.id;
    const wasFishing = this.isFishing;
    this.isFishing = false;
    this.activeSession = null;
    this.tickPending = false;
    this.syncHudVisibility();
    if (notifyServer && wasFishing && charId && this.client?.token) {
      void this.client.api('/api/play/fishing/stop', {
        method: 'POST',
        body: JSON.stringify({ characterId: charId }),
      }).catch(() => {});
    }
  }

  async runTick() {
    if (!this.isFishing || this.tickPending || !this.client?.activeChar) return;
    if (this.isCombatBlocking()) {
      this.forceStopLocal(true);
      return;
    }
    this.tickPending = true;
    try {
      const res = await this.client.api('/api/play/fishing/tick', {
        method: 'POST',
        body: JSON.stringify({ characterId: this.client.activeChar.id }),
      });

      if (this.isCombatBlocking()) {
        this.forceStopLocal(true);
        return;
      }

      if (!res.active) {
        this.forceStopLocal(false);
        this.client.showNotification?.(res.message || '🎣 Pesca encerrada.', res.bagFull ? 'warning' : 'info');
        return;
      }

      if (res.ready === false && Number(res.remainingMs) > 0) {
        this.cycleStartedAt = performance.now() - Math.max(0, this.cycleDurationMs - Number(res.remainingMs));
        return;
      }

      this.activeSession = res.session || this.activeSession;
      this.baitsInBag = res.remainingBaits || [];
      this.mergeBaitsWithSavedOrder(this.baitsInBag);
      this.cycleDurationMs = Number(res.nextCycleMs) || this.cycleDurationMs;
      this.cycleStartedAt = performance.now();

      const now = performance.now();
      if (res.caught && res.fish) {
        this.floatingTexts.push({
          text: `🎣 +1 ${res.fish.namePtBr} [${res.fish.rarityTier}]`,
          color: '#4ade80',
          startedAt: now,
          x: this.client.playerX,
          y: this.client.playerY - 82,
        });
        this.client.showNotification?.(`🐟 Você pescou ${res.fish.namePtBr} (Rank ${res.fish.rarityTier})!`, 'success');
        if (document.getElementById('bagModal')?.style.display === 'flex' && window.PlayBagController?.loadBag) {
          void window.PlayBagController.loadBag();
        }
      } else {
        this.floatingTexts.push({
          text: '💧 O peixe escapou...',
          color: '#7dd3fc',
          startedAt: now,
          x: this.client.playerX,
          y: this.client.playerY - 82,
        });
      }
      this.updateStatusBarUi(0);
    } catch (err) {
      this.forceStopLocal(false);
      this.client?.showNotification?.(`Erro na pesca: ${err.message}`, 'danger');
    } finally {
      this.tickPending = false;
    }
  }

  update(client, now) {
    this.client = client;
    if (this.isCombatBlocking() || client.isFlying) {
      this.closeSetupModal();
      if (this.isFishing) this.forceStopLocal(true);
      this.nearWaterPoint = null;
      this.syncHudVisibility();
      return;
    }

    if (now - this.lastProximityCheckAt >= 120) {
      this.lastProximityCheckAt = now;
      this.nearWaterPoint = client.mesh?.findClosestFishingPoint?.(client.playerX, client.playerY, 96) || null;
      this.syncHudVisibility();
    }

    if (this.isFishing && this.activeSession) {
      const elapsed = now - this.cycleStartedAt;
      const pct = Math.max(0, Math.min(1, elapsed / this.cycleDurationMs));
      this.updateStatusBarUi(pct);
      if (elapsed >= this.cycleDurationMs && !this.tickPending) {
        void this.runTick();
      }
    }
  }

  updateStatusBarUi(progressRatio) {
    const titleEl = document.getElementById('fishingStatusTitle');
    const timerEl = document.getElementById('fishingStatusTimer');
    const fillEl = document.getElementById('fishingStatusProgressFill');
    const baitEl = document.getElementById('fishingStatusBaitLabel');
    if (!this.activeSession) return;

    if (titleEl) {
      titleEl.innerHTML = `🎣 <strong>${this.activeSession.rodNamePtBr}</strong> &bull; 🐟 ${this.activeSession.caughtCount || 0}`;
    }
    const remSec = Math.max(0, ((1 - progressRatio) * this.cycleDurationMs) / 1000);
    if (timerEl) timerEl.textContent = `${remSec.toFixed(1)}s`;
    if (fillEl) fillEl.style.width = `${Math.round(progressRatio * 100)}%`;

    if (baitEl) {
      const byId = new Map((this.baitsInBag || []).map((b) => [Number(b.itemTemplateId), b]));
      let activeBait = null;
      for (const id of this.activeSession.baitQueue || []) {
        const b = byId.get(Number(id));
        if (b && b.quantity > 0) { activeBait = b; break; }
      }
      baitEl.textContent = activeBait ? `🪱 ${activeBait.namePtBr} (x${activeBait.quantity})` : '🪱 Sem isca ativa (taxa da vara)';
    }
  }

  drawWorldFishingEffects(client, ctx, now) {
    if (this.isCombatBlocking() || !this.isFishing || !this.activeSession) return;
    const wp = this.activeSession.waterPoint || this.nearWaterPoint?.point;
    if (!wp) return;

    const bobY = wp.y + Math.sin(now / 260) * 2.5;
    const handX = client.playerX + Math.sign(wp.x - client.playerX) * 12;
    const handY = client.playerY - 28;

    ctx.save();
    // Ondulações concêntricas na água (zero shadowBlur)
    for (let i = 0; i < 2; i++) {
      const phase = ((now / 1200) + i * 0.5) % 1;
      ctx.beginPath();
      ctx.ellipse(wp.x, wp.y, 7 + phase * 18, 4 + phase * 10, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(56, 189, 248, ${(1 - phase) * 0.7})`;
      ctx.lineWidth = 1.6 / (client.zoom || 1);
      ctx.stroke();
    }

    // Linha arqueada da vara até a boia
    ctx.beginPath();
    ctx.moveTo(handX, handY);
    ctx.quadraticCurveTo((handX + wp.x) / 2, Math.min(handY, bobY) - 18, wp.x, bobY);
    ctx.strokeStyle = 'rgba(224, 242, 254, 0.85)';
    ctx.lineWidth = 1.3 / (client.zoom || 1);
    ctx.stroke();

    // Boia vermelha & branca
    ctx.beginPath();
    ctx.arc(wp.x, bobY - 2, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ef4444';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(wp.x, bobY + 1, 3.2, 0, Math.PI);
    ctx.fillStyle = '#f8fafc';
    ctx.fill();
    ctx.restore();
  }

  drawPlayerFishingOverhead(client, ctx, playerX, nameY, now) {
    // Textos flutuantes de captura/escape
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      const age = now - ft.startedAt;
      if (age > 2100) {
        this.floatingTexts.splice(i, 1);
        continue;
      }
      const p = age / 2100;
      ctx.save();
      ctx.globalAlpha = 1 - p * p;
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(2, 6, 23, 0.9)';
      ctx.lineWidth = 3;
      ctx.strokeText(ft.text, ft.x, ft.y - p * 34);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y - p * 34);
      ctx.restore();
    }

    if (this.isCombatBlocking() || !this.isFishing || !this.activeSession) return;
    const progress = Math.max(0, Math.min(1, (now - this.cycleStartedAt) / this.cycleDurationMs));
    const iconY = nameY - 34;

    ctx.save();
    // Ícone de vara animado acima da cabeça
    ctx.translate(playerX, iconY);
    ctx.rotate(Math.sin(now / 280) * 0.16);
    const url = this.activeSession.rodIconUrl;
    let img = url ? this.rodIconImgCache.get(url) : null;
    if (url && !img) {
      img = new Image();
      img.src = url;
      this.rodIconImgCache.set(url, img);
    }
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, -12, -12, 24, 24);
    } else {
      ctx.font = '18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🎣', 0, 0);
    }
    ctx.restore();

    // Barra de progresso acima da cabeça
    const bw = 58;
    const bh = 5;
    const bx = playerX - bw / 2;
    const by = nameY - 17;
    ctx.save();
    ctx.fillStyle = 'rgba(2, 6, 23, 0.88)';
    ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
    ctx.fillStyle = '#06b6d4';
    ctx.fillRect(bx, by, Math.round(bw * progress), bh);
    ctx.restore();
  }
}

window.PlayFishingController = PlayFishingController;
