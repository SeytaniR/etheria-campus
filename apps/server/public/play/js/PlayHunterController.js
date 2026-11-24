/**
 * @file apps/server/public/play/js/PlayHunterController.js
 * @module @etheria/play
 * @description Interface unificada, minimalista e mobile-first da Caçadora (`HUNTER`):
 *   - 4 seções discretas no topo: Quests, Criar, Vender, Upgrade (futuro).
 *   - Sincroniza essências, pets equipados na HUD e mochilas após criação/reciclagem.
 * @rules Segue estritamente AGENTS.md (Regra #5 Mobile-First, Regra #7 < 1.000 linhas).
 */

const PlayHunterController = {
  client: null,
  activeNpc: null,
  bootstrapData: null,
  currentTab: 'CRAFT',
  selectedRaceCode: 'PLANT',
  selectedRarity: 'F',
  selectedMonsterId: null,
  customNickname: '',
  selectedSellPetId: null,

  attach(client) {
    this.client = client;
    this.injectModalDom();

    client.openHunterPetModal = async (npc = null) => {
      await this.openModal(npc);
    };
    client.closeHunterPetModal = () => {
      this.closeModal();
    };
  },

  injectModalDom() {
    if (document.getElementById('hunterPetModal')) return;

    const modalHtml = `
      <div id="hunterPetModal" class="hunter-modal-backdrop" style="display:none;" onclick="if(event.target===this) PlayHunterController.closeModal()">
        <div class="hunter-modal-box" onclick="event.stopPropagation()">
          <div class="hunter-modal-header">
            <div class="hunter-header-id">
              <img id="hunterNpcAvatarImg" class="hunter-npc-avatar" src="/play/assets/hud/menu_pets.png" alt="Caçadora" onerror="this.onerror=null; this.src='/play/assets/hud/menu_pets.png';" />
              <div style="min-width:0;">
                <h3 id="hunterModalTitle" class="hunter-modal-title">Caçadora</h3>
                <div id="hunterModalSub" class="hunter-modal-sub">Contratos de Vínculo & Companheiros</div>
              </div>
            </div>
            <button type="button" class="hunter-btn-close" onclick="PlayHunterController.closeModal()">✕</button>
          </div>

          <!-- 4 SEÇÕES DISCRETAS NO TOPO -->
          <div class="hunter-top-tabs" role="tablist">
            <button type="button" id="hunterTabBtnQuests" class="hunter-top-tab" onclick="PlayHunterController.switchTab('QUESTS')">
              <span>Quests</span>
              <span id="hunterQuestsTabDot" class="hunter-tab-badge" style="display:none;">0</span>
            </button>
            <button type="button" id="hunterTabBtnCraft" class="hunter-top-tab active" onclick="PlayHunterController.switchTab('CRAFT')">
              <span>Criar</span>
            </button>
            <button type="button" id="hunterTabBtnSell" class="hunter-top-tab" onclick="PlayHunterController.switchTab('SELL')">
              <span>Vender</span>
            </button>
            <button type="button" id="hunterTabBtnUpgrade" class="hunter-top-tab" onclick="PlayHunterController.switchTab('UPGRADE')">
              <span>Upgrade</span>
            </button>
          </div>

          <!-- ABA 1: QUESTS -->
          <div id="hunterQuestsView" class="hunter-tab-view" style="display:none;">
            <div id="hunterQuestsList" class="hunter-scroll-pad"></div>
          </div>

          <!-- ABA 2: CRIAR COMPANHEIROS -->
          <div id="hunterCraftView" class="hunter-tab-view" style="display:flex;">
            <div class="hunter-scroll-pad hunter-craft-stack">
              <div class="hunter-block">
                <div class="hunter-block-head">
                  <span>Essência da Raça</span>
                  <span id="hunterCostBalanceBadge" class="hunter-balance-pill"></span>
                </div>
                <div id="hunterRacesGrid" class="hunter-races-strip"></div>
              </div>

              <div class="hunter-block">
                <div class="hunter-block-head">
                  <span>Rank do Companheiro</span>
                  <span style="font-size:0.68rem; color:#64748b;">Custo em essências</span>
                </div>
                <div id="hunterRaritiesRow" class="hunter-rarities-row"></div>
              </div>

              <div class="hunter-block">
                <div class="hunter-block-head">
                  <span>Espécies Disponíveis</span>
                  <span id="hunterSpeciesCount" style="font-size:0.68rem; color:#94a3b8;"></span>
                </div>
                <div id="hunterPetsList" class="hunter-pets-grid"></div>
              </div>

              <div id="hunterPetPreviewBox" class="hunter-preview-card"></div>
            </div>

            <div class="hunter-modal-footer">
              <div id="hunterFooterCostSummary" class="hunter-footer-summary"></div>
              <button type="button" id="btnHunterCraft" class="hunter-btn-craft" onclick="PlayHunterController.handleCraftSubmit()">
                Criar Companheiro
              </button>
            </div>
          </div>

          <!-- ABA 3: VENDER COMPANHEIROS -->
          <div id="hunterSellView" class="hunter-tab-view" style="display:none;">
            <div class="hunter-scroll-pad hunter-craft-stack">
              <div class="hunter-block">
                <div class="hunter-block-head">
                  <span>Seus Companheiros</span>
                  <span id="hunterSellPetsCount" style="font-size:0.68rem; color:#94a3b8;"></span>
                </div>
                <div id="hunterSellPetsList" class="hunter-sell-list"></div>
              </div>
              <div id="hunterSellPreviewBox" class="hunter-preview-card" style="flex-direction:column; align-items:stretch;"></div>
            </div>

            <div class="hunter-modal-footer">
              <div id="hunterSellFooterSummary" class="hunter-footer-summary"></div>
              <button type="button" id="btnHunterSell" class="hunter-btn-sell" onclick="PlayHunterController.handleSellSubmit()">
                Confirmar Venda
              </button>
            </div>
          </div>

          <!-- ABA 4: UPGRADE (FUTURO) -->
          <div id="hunterUpgradeView" class="hunter-tab-view" style="display:none;">
            <div class="hunter-scroll-pad">
              <div class="hunter-upgrade-placeholder">
                <div style="font-size:2rem; opacity:0.85;">✨</div>
                <strong style="font-size:0.95rem; color:#f8fafc;">Upgrade de Companheiros</strong>
                <p style="font-size:0.78rem; color:#94a3b8; line-height:1.5; max-width:340px; margin:0;">
                  Em breve você poderá evoluir o Rank, aprimorar atributos e despertar potenciais especiais dos seus Companheiros de Vínculo nesta seção.
                </p>
                <span class="hunter-coming-pill">Em desenvolvimento</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- MODAL COMPACTO DE CONFIRMAÇÃO / SUCESSO -->
      <div id="hunterSuccessModal" class="hunter-modal-backdrop" style="display:none; z-index:10050;" onclick="if(event.target===this) this.style.display='none'">
        <div class="hunter-success-card" onclick="event.stopPropagation()">
          <h3 id="hunterSuccessTitle" style="font-size:1.05rem; color:#fde047; font-weight:800; margin:0 0 8px 0;">Vínculo Concluído</h3>
          <div id="hunterSuccessDetails" style="background:rgba(2,6,23,0.75); border:1px solid rgba(148,163,184,0.18); border-radius:10px; padding:12px; margin-bottom:14px;"></div>
          <button type="button" class="hunter-btn-craft" style="width:100%; justify-content:center;" onclick="document.getElementById('hunterSuccessModal').style.display='none'">
            Continuar
          </button>
        </div>
      </div>
    `;

    const style = document.createElement('style');
    style.id = 'hunterModalStyles';
    style.textContent = `
      .hunter-modal-backdrop { position:fixed; inset:0; background:rgba(2,6,23,0.78); backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px); display:flex; align-items:center; justify-content:center; z-index:10000; padding:10px; box-sizing:border-box; }
      .hunter-modal-box { background:linear-gradient(180deg, #111827 0%, #0b1120 100%); border:1px solid rgba(148,163,184,0.22); box-shadow:0 18px 46px rgba(0,0,0,0.75); border-radius:16px; width:100%; max-width:560px; max-height:90dvh; display:flex; flex-direction:column; overflow:hidden; color:#f8fafc; }
      .hunter-modal-header { display:flex; justify-content:space-between; align-items:center; gap:10px; padding:12px 14px 10px; border-bottom:1px solid rgba(148,163,184,0.12); }
      .hunter-header-id { display:flex; align-items:center; gap:10px; min-width:0; }
      .hunter-npc-avatar { width:38px; height:38px; object-fit:contain; border-radius:10px; background:#020617; border:1px solid rgba(148,163,184,0.22); flex-shrink:0; }
      .hunter-modal-title { font-size:0.96rem; font-weight:800; color:#f8fafc; margin:0; line-height:1.2; }
      .hunter-modal-sub { font-size:0.70rem; color:#94a3b8; margin-top:1px; }
      .hunter-btn-close { background:rgba(30,41,59,0.85); border:1px solid rgba(148,163,184,0.2); color:#cbd5e1; width:32px; height:32px; border-radius:9px; cursor:pointer; display:flex; align-items:center; justify-content:center; padding:0; flex-shrink:0; }
      .hunter-top-tabs { display:grid; grid-template-columns:repeat(4, 1fr); gap:4px; padding:6px 12px; background:rgba(2,6,23,0.45); border-bottom:1px solid rgba(148,163,184,0.12); }
      .hunter-top-tab { background:transparent; border:1px solid transparent; color:#94a3b8; font-size:0.76rem; font-weight:700; padding:7px 4px; border-radius:9px; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; gap:5px; transition:all 0.14s ease; }
      .hunter-top-tab.active { background:rgba(56,189,248,0.14); border-color:rgba(56,189,248,0.45); color:#f0f9ff; }
      .hunter-tab-badge { background:#ef4444; color:#fff; font-size:0.62rem; font-weight:900; min-width:16px; height:16px; padding:0 4px; border-radius:999px; display:inline-flex; align-items:center; justify-content:center; }
      .hunter-tab-view { display:flex; flex-direction:column; flex:1; min-height:0; }
      .hunter-scroll-pad { flex:1; min-height:0; overflow-y:auto; -webkit-overflow-scrolling:touch; padding:12px; display:flex; flex-direction:column; gap:10px; }
      .hunter-craft-stack { gap:10px; }
      .hunter-block { background:rgba(15,23,42,0.58); border:1px solid rgba(148,163,184,0.12); border-radius:12px; padding:10px; display:flex; flex-direction:column; gap:8px; }
      .hunter-block-head { display:flex; justify-content:space-between; align-items:center; gap:8px; font-size:0.74rem; font-weight:700; color:#cbd5e1; flex-wrap:wrap; }
      .hunter-balance-pill { font-size:0.70rem; font-weight:800; padding:2px 8px; border-radius:999px; }
      .hunter-races-strip { display:flex; gap:6px; overflow-x:auto; padding-bottom:2px; scrollbar-width:none; }
      .hunter-races-strip::-webkit-scrollbar { display:none; }
      .hunter-race-chip { flex:0 0 auto; width:68px; display:flex; flex-direction:column; align-items:center; gap:3px; background:rgba(2,6,23,0.72); border:1px solid rgba(148,163,184,0.16); border-radius:10px; padding:6px 4px; cursor:pointer; text-align:center; transition:all 0.14s ease; }
      .hunter-race-chip.active { border-color:rgba(251,191,36,0.75); background:rgba(245,158,11,0.14); }
      .hunter-race-chip img { width:26px; height:26px; object-fit:contain; }
      .hunter-race-chip-name { font-size:0.64rem; font-weight:600; color:#e2e8f0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:60px; }
      .hunter-race-chip-qty { font-size:0.62rem; font-weight:800; font-family:monospace; }
      .hunter-rarities-row { display:grid; grid-template-columns:repeat(7, minmax(0, 1fr)); gap:4px; }
      .hunter-rarity-pill { display:flex; flex-direction:column; align-items:center; padding:6px 2px; border-radius:9px; border:1px solid rgba(148,163,184,0.16); background:rgba(2,6,23,0.72); cursor:pointer; transition:all 0.14s ease; }
      .hunter-rarity-pill.active { border-color:rgba(251,191,36,0.75); background:rgba(245,158,11,0.16); }
      .hunter-rarity-pill strong { font-size:0.78rem; font-weight:900; line-height:1.1; }
      .hunter-rarity-pill span { font-size:0.60rem; color:#94a3b8; font-family:monospace; }
      .hunter-pets-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(112px, 1fr)); gap:7px; max-height:190px; overflow-y:auto; }
      .hunter-pet-card { background:rgba(2,6,23,0.72); border:1px solid rgba(148,163,184,0.16); border-radius:10px; padding:8px 6px; display:flex; flex-direction:column; align-items:center; gap:4px; cursor:pointer; text-align:center; transition:all 0.14s ease; }
      .hunter-pet-card.active { border-color:#38bdf8; background:rgba(56,189,248,0.12); }
      .hunter-pet-card img { width:46px; height:46px; object-fit:contain; }
      .hunter-pet-card-name { font-size:0.72rem; font-weight:700; color:#f1f5f9; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:102px; }
      .hunter-preview-card { background:rgba(15,23,42,0.75); border:1px solid rgba(148,163,184,0.16); border-radius:12px; padding:10px; display:flex; gap:10px; align-items:center; }
      .hunter-sell-list { display:flex; flex-direction:column; gap:6px; max-height:210px; overflow-y:auto; }
      .hunter-sell-pet-card { display:flex; align-items:center; justify-content:space-between; gap:8px; background:rgba(2,6,23,0.72); border:1px solid rgba(148,163,184,0.16); border-radius:10px; padding:8px 10px; cursor:pointer; }
      .hunter-sell-pet-card.active { border-color:#34d399; background:rgba(16,185,129,0.12); }
      .hunter-modal-footer { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:10px 12px; border-top:1px solid rgba(148,163,184,0.12); background:rgba(2,6,23,0.68); flex-wrap:wrap; }
      .hunter-footer-summary { font-size:0.76rem; color:#cbd5e1; display:flex; align-items:center; gap:6px; }
      .hunter-btn-craft { background:linear-gradient(135deg, #f59e0b, #d97706); border:1px solid rgba(251,191,36,0.7); color:#020617; font-weight:800; font-size:0.82rem; padding:9px 16px; border-radius:10px; cursor:pointer; display:inline-flex; align-items:center; gap:6px; }
      .hunter-btn-craft:disabled { background:#1e293b; border-color:#334155; color:#64748b; cursor:not-allowed; }
      .hunter-btn-sell { background:linear-gradient(135deg, #10b981, #059669); border:1px solid rgba(52,211,153,0.7); color:#fff; font-weight:800; font-size:0.82rem; padding:9px 16px; border-radius:10px; cursor:pointer; display:inline-flex; align-items:center; gap:6px; }
      .hunter-btn-sell:disabled { background:#1e293b; border-color:#334155; color:#64748b; cursor:not-allowed; }
      .hunter-upgrade-placeholder { display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; gap:10px; padding:34px 16px; background:rgba(15,23,42,0.5); border:1px dashed rgba(148,163,184,0.24); border-radius:14px; }
      .hunter-coming-pill { font-size:0.70rem; font-weight:700; color:#7dd3fc; background:rgba(56,189,248,0.12); border:1px solid rgba(56,189,248,0.3); padding:3px 10px; border-radius:999px; }
      .hunter-success-card { background:#0f172a; border:1px solid rgba(251,191,36,0.5); border-radius:14px; padding:18px; max-width:380px; width:92%; text-align:center; color:#f8fafc; box-shadow:0 20px 44px rgba(0,0,0,0.85); }
      @media (max-width: 520px) {
        .hunter-modal-box { max-height:92dvh; border-radius:14px; }
        .hunter-modal-footer { flex-direction:column; align-items:stretch; }
        .hunter-btn-craft, .hunter-btn-sell { width:100%; justify-content:center; }
      }
      @media (orientation: landscape) and (max-height: 500px) {
        .hunter-modal-box { max-width:96vw; max-height:96dvh; }
        .hunter-pets-grid { max-height:130px; }
      }
    `;
    document.head.appendChild(style);
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  },

  async openModal(npc = null) {
    if (!this.client || !this.client.activeChar) {
      alert('Selecione um personagem primeiro.');
      return;
    }

    this.activeNpc = npc || this.client.activeNpcInteraction || null;
    const modal = document.getElementById('hunterPetModal');
    if (!modal) return;

    const npcTitle = document.getElementById('hunterModalTitle');
    const npcAvatar = document.getElementById('hunterNpcAvatarImg');
    if (npcTitle) npcTitle.textContent = this.activeNpc?.namePtBr || 'Caçadora';
    if (npcAvatar && this.activeNpc?.thumbUrl) npcAvatar.src = this.activeNpc.thumbUrl;

    const qModal = document.getElementById('npcQuestModal');
    if (qModal) qModal.style.display = 'none';
    modal.style.display = 'flex';

    const questInfo = this.activeNpc && this.client.buildNpcQuestCardsHtml
      ? this.client.buildNpcQuestCardsHtml(this.activeNpc)
      : { cards: [], count: 0 };
    this.updateQuestsTabBadge(questInfo.count);

    try {
      const data = await this.client.api(
        `/api/play/characters/${this.client.activeChar.id}/hunter-bootstrap`
      );
      this.bootstrapData = data;
      if (data?.petsPayload) {
        this.client.petsPayload = data.petsPayload;
      }
      this.autoSelectFirstAvailableRace();
      this.switchTab(questInfo.count > 0 ? 'QUESTS' : 'CRAFT');
    } catch (err) {
      alert(`Erro ao abrir o Santuário do Caçador: ${err.message}`);
      this.closeModal();
    }
  },

  autoSelectFirstAvailableRace() {
    const races = this.bootstrapData?.races || [];
    if (!races.length) return;
    const currentExists = races.some((r) => r.raceCode === this.selectedRaceCode);
    if (!currentExists) {
      const withStock = races.find((r) => (r.playerQuantity || 0) > 0);
      this.selectedRaceCode = (withStock || races[0]).raceCode;
    }
  },

  updateQuestsTabBadge(count) {
    const badge = document.getElementById('hunterQuestsTabDot');
    if (!badge) return;
    if (count > 0) {
      badge.textContent = String(count);
      badge.style.display = 'inline-flex';
    } else {
      badge.style.display = 'none';
    }
  },

  closeModal() {
    const modal = document.getElementById('hunterPetModal');
    if (modal) modal.style.display = 'none';
  },

  switchTab(tab) {
    this.currentTab = tab;
    const map = {
      QUESTS: { btn: 'hunterTabBtnQuests', view: 'hunterQuestsView' },
      CRAFT: { btn: 'hunterTabBtnCraft', view: 'hunterCraftView' },
      SELL: { btn: 'hunterTabBtnSell', view: 'hunterSellView' },
      UPGRADE: { btn: 'hunterTabBtnUpgrade', view: 'hunterUpgradeView' },
    };
    Object.entries(map).forEach(([k, ids]) => {
      const b = document.getElementById(ids.btn);
      const v = document.getElementById(ids.view);
      if (b) b.classList.toggle('active', k === tab);
      if (v) v.style.display = k === tab ? 'flex' : 'none';
    });

    if (tab === 'QUESTS') this.renderQuestsTab();
    else if (tab === 'CRAFT') this.renderCraftAll();
    else if (tab === 'SELL') this.renderSell();
  },

  renderQuestsTab() {
    const box = document.getElementById('hunterQuestsList');
    if (!box) return;
    const npc = this.activeNpc || this.client?.activeNpcInteraction;
    const info = npc && this.client?.buildNpcQuestCardsHtml
      ? this.client.buildNpcQuestCardsHtml(npc)
      : { cards: [], count: 0 };
    this.updateQuestsTabBadge(info.count);

    if (!info.cards.length) {
      box.innerHTML = `
        <div class="hunter-upgrade-placeholder" style="padding:26px 14px;">
          <strong style="font-size:0.86rem; color:#cbd5e1;">Nenhuma missão ativa com ${npc?.namePtBr || 'a Caçadora'}</strong>
          <p style="font-size:0.74rem; color:#64748b; margin:0;">
            Use as abas acima para criar ou vender Companheiros de Vínculo.
          </p>
        </div>
      `;
    } else {
      box.innerHTML = info.cards.join('');
    }
  },

  renderCraftAll() {
    this.renderRaces();
    this.renderRarities();
    this.renderPets();
    this.renderPreview();
    this.renderFooter();
  },

  renderRaces() {
    const container = document.getElementById('hunterRacesGrid');
    if (!container || !this.bootstrapData) return;
    const races = this.bootstrapData.races || [];
    container.innerHTML = races
      .map((r) => {
        const isActive = r.raceCode === this.selectedRaceCode;
        const qty = r.playerQuantity || 0;
        return `
          <div class="hunter-race-chip ${isActive ? 'active' : ''}" onclick="PlayHunterController.selectRace('${r.raceCode}')">
            <img src="${r.iconUrl}" alt="${r.namePtBr}" onerror="this.onerror=null; this.src='/play/assets/hud/menu_inventory.png'" />
            <span class="hunter-race-chip-name">${r.namePtBr.replace('Essência ', '')}</span>
            <span class="hunter-race-chip-qty" style="color:${qty > 0 ? '#fde047' : '#64748b'};">${qty.toLocaleString('pt-BR')}</span>
          </div>
        `;
      })
      .join('');
  },

  selectRace(raceCode) {
    this.selectedRaceCode = raceCode;
    this.selectedMonsterId = null;
    this.renderCraftAll();
  },

  renderRarities() {
    const row = document.getElementById('hunterRaritiesRow');
    const badge = document.getElementById('hunterCostBalanceBadge');
    if (!row || !this.bootstrapData) return;

    const costRules = this.bootstrapData.costRules || { F: 30, D: 70, C: 120, B: 300, A: 700, S: 1600, SS: 3500 };
    const rarityTiers = ['F', 'D', 'C', 'B', 'A', 'S', 'SS'];
    const rarityColors = { SS: '#f8fafc', S: '#f87171', A: '#fb923c', B: '#c084fc', C: '#60a5fa', D: '#4ade80', F: '#e2e8f0' };

    row.innerHTML = rarityTiers
      .map((tier) => {
        const cost = costRules[tier] || 30;
        const isActive = tier === this.selectedRarity;
        const color = rarityColors[tier] || '#cbd5e1';
        return `
          <div class="hunter-rarity-pill ${isActive ? 'active' : ''}" onclick="PlayHunterController.selectRarity('${tier}')">
            <strong style="color:${color};">${tier}</strong>
            <span>${cost}</span>
          </div>
        `;
      })
      .join('');

    if (badge) {
      const curRace = (this.bootstrapData.races || []).find((r) => r.raceCode === this.selectedRaceCode);
      const playerQty = curRace?.playerQuantity || 0;
      const requiredCost = costRules[this.selectedRarity] || 30;
      const isEnough = playerQty >= requiredCost;
      badge.style.background = isEnough ? 'rgba(34,197,94,0.14)' : 'rgba(239,68,68,0.14)';
      badge.style.color = isEnough ? '#86efac' : '#fca5a5';
      badge.style.border = `1px solid ${isEnough ? 'rgba(74,222,128,0.4)' : 'rgba(248,113,113,0.4)'}`;
      badge.textContent = `${playerQty.toLocaleString('pt-BR')} / ${requiredCost.toLocaleString('pt-BR')} ${curRace?.namePtBr?.replace('Essência ', '') || ''}`;
    }
  },

  selectRarity(tier) {
    this.selectedRarity = tier;
    this.selectedMonsterId = null;
    this.renderRarities();
    this.renderPets();
    this.renderPreview();
    this.renderFooter();
  },

  renderPets() {
    const container = document.getElementById('hunterPetsList');
    const countEl = document.getElementById('hunterSpeciesCount');
    if (!container || !this.bootstrapData) return;

    const allPets = this.bootstrapData.tamablePets || [];
    const filtered = allPets.filter(
      (p) => p.raceCode === this.selectedRaceCode && String(p.rarityTier).toUpperCase() === this.selectedRarity.toUpperCase()
    );
    if (countEl) countEl.textContent = `${filtered.length} encontrada(s)`;

    if (filtered.length === 0) {
      this.selectedMonsterId = null;
      container.innerHTML = `
        <div style="grid-column:1/-1; color:#94a3b8; font-size:0.75rem; text-align:center; padding:18px 10px; border:1px dashed rgba(148,163,184,0.2); border-radius:10px;">
          Nenhum companheiro desta raça no Rank <strong>${this.selectedRarity}</strong>. Escolha outra raça ou rank acima.
        </div>
      `;
      return;
    }

    if (!this.selectedMonsterId || !filtered.some((p) => p.id === this.selectedMonsterId)) {
      this.selectedMonsterId = filtered[0].id;
    }

    container.innerHTML = filtered
      .map((pet) => {
        const isActive = pet.id === this.selectedMonsterId;
        return `
          <div class="hunter-pet-card ${isActive ? 'active' : ''}" onclick="PlayHunterController.selectPet(${pet.id})">
            <img src="${pet.thumbUrl}" alt="${pet.namePtBr}" onerror="this.onerror=null; this.src='/play/assets/hud/menu_pets.png'" />
            <strong class="hunter-pet-card-name">${pet.namePtBr}</strong>
            <span style="font-size:0.62rem; color:#94a3b8;">${pet.combatStyle === 'RANGED' ? 'Distância' : 'Corpo a Corpo'}</span>
          </div>
        `;
      })
      .join('');
  },

  selectPet(monsterId) {
    this.selectedMonsterId = monsterId;
    this.renderPets();
    this.renderPreview();
    this.renderFooter();
  },

  renderPreview() {
    const box = document.getElementById('hunterPetPreviewBox');
    if (!box || !this.bootstrapData) return;
    const pet = (this.bootstrapData.tamablePets || []).find((p) => p.id === this.selectedMonsterId);

    if (!pet) {
      box.innerHTML = `<span style="color:#64748b; font-size:0.75rem;">Selecione uma espécie acima para visualizar.</span>`;
      return;
    }

    box.innerHTML = `
      <img src="${pet.thumbUrl}" alt="${pet.namePtBr}" style="width:56px; height:56px; object-fit:contain; background:#020617; border:1.5px solid rgba(56,189,248,0.55); border-radius:10px; padding:3px; flex-shrink:0;" onerror="this.onerror=null; this.src='/play/assets/hud/menu_pets.png'" />
      <div style="flex:1; min-width:0; display:flex; flex-direction:column; gap:4px;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:6px;">
          <strong style="font-size:0.86rem; color:#f8fafc; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${pet.namePtBr}</strong>
          <span style="font-size:0.68rem; color:#7dd3fc; font-weight:800; background:rgba(56,189,248,0.14); padding:2px 6px; border-radius:6px; flex-shrink:0;">Rank ${pet.rarityTier}</span>
        </div>
        <div style="font-size:0.70rem; color:#94a3b8;">
          Nível 1 • Elemento aleatório • 76 pontos livres
        </div>
        <input type="text" id="hunterCustomNicknameInput" placeholder="Apelido opcional..." maxlength="24"
               value="${this.customNickname.replace(/"/g, '&quot;')}" oninput="PlayHunterController.customNickname = this.value"
               style="width:100%; padding:5px 8px; font-size:0.74rem; background:#020617; border:1px solid #334155; border-radius:7px; color:#f8fafc;" />
      </div>
    `;
  },

  renderFooter() {
    const summary = document.getElementById('hunterFooterCostSummary');
    const btn = document.getElementById('btnHunterCraft');
    if (!summary || !btn || !this.bootstrapData) return;

    const curRace = (this.bootstrapData.races || []).find((r) => r.raceCode === this.selectedRaceCode);
    const costRules = this.bootstrapData.costRules || { F: 30, D: 70, C: 120, B: 300, A: 700, S: 1600, SS: 3500 };
    const requiredCost = costRules[this.selectedRarity] || 30;
    const playerQty = curRace?.playerQuantity || 0;
    const isEnough = playerQty >= requiredCost;
    const hasPet = Boolean(this.selectedMonsterId);

    summary.innerHTML = `
      <img src="${curRace?.iconUrl || ''}" style="width:18px; height:18px; object-fit:contain;" onerror="this.style.display='none'" />
      <span>Custo: <strong style="color:#fde047;">${requiredCost.toLocaleString('pt-BR')}x</strong> ${curRace?.namePtBr || 'Essência'}</span>
    `;

    if (!hasPet) {
      btn.disabled = true;
      btn.textContent = 'Selecione uma Espécie';
    } else if (!isEnough) {
      btn.disabled = true;
      btn.textContent = `Essências Insuficientes (${playerQty}/${requiredCost})`;
    } else {
      btn.disabled = false;
      btn.textContent = `Criar Companheiro (${requiredCost})`;
    }
  },

  syncClientPetsPayload(petsPayload) {
    if (!petsPayload || !this.client) return;
    this.client.petsPayload = petsPayload;
    const deployed = (petsPayload.pets || []).filter((p) => Boolean(p.deploySlot));
    if (this.client.activeChar) {
      this.client.activeChar.equippedPets = deployed;
      this.client.activeChar.pets = petsPayload.pets || [];
    }
    if (window.PlayHudController?.updatePets) {
      window.PlayHudController.updatePets(deployed);
    }
    if (window.PlayPetsController?.renderPetsModalContent) {
      window.PlayPetsController.renderPetsModalContent(this.client);
    }
  },

  async handleCraftSubmit() {
    if (!this.client?.activeChar || !this.selectedMonsterId) return;
    const btn = document.getElementById('btnHunterCraft');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Criando...';
    }
    try {
      const nicknameInput = document.getElementById('hunterCustomNicknameInput');
      const nickname = nicknameInput ? nicknameInput.value.trim() : '';
      const res = await this.client.api(
        `/api/play/characters/${this.client.activeChar.id}/hunter-craft`,
        {
          method: 'POST',
          body: JSON.stringify({
            monsterTemplateId: this.selectedMonsterId,
            customNickname: nickname || undefined,
          }),
        }
      );

      if (res?.success) {
        this.customNickname = '';
        if (res.petsPayload) this.syncClientPetsPayload(res.petsPayload);
        if (res.updatedPlayerEssences && this.bootstrapData) {
          this.bootstrapData.playerEssences = res.updatedPlayerEssences;
          for (const r of this.bootstrapData.races || []) {
            r.playerQuantity = res.updatedPlayerEssences[r.itemCode] || 0;
          }
        }
        if (typeof this.client.loadCharacterInventory === 'function') {
          await this.client.loadCharacterInventory().catch(() => {});
        }
        this.renderCraftAll();
        this.showSuccessCard(res.createdPet);
      }
    } catch (err) {
      alert(`Falha ao criar companheiro: ${err.message}`);
      this.renderFooter();
    }
  },

  showSuccessCard(pet) {
    const modal = document.getElementById('hunterSuccessModal');
    const title = document.getElementById('hunterSuccessTitle');
    const details = document.getElementById('hunterSuccessDetails');
    if (!modal || !details) return;
    if (title) title.textContent = '✨ Companheiro Criado!';

    const elementNames = {
      FIRE: '🔥 Fogo', WATER: '💧 Água', EARTH: '🌿 Terra', AIR: '🌪️ Ar', WIND: '🌪️ Ar', NEUTRAL: '⚪ Neutro',
    };
    const elem = elementNames[pet.elementCode] || `⚪ ${pet.elementCode}`;

    details.innerHTML = `
      <strong style="font-size:0.98rem; color:#86efac; display:block; margin-bottom:6px;">${pet.nickname}</strong>
      <div style="font-size:0.78rem; color:#cbd5e1; display:flex; flex-direction:column; gap:4px;">
        <div>Elemento: <strong style="color:#fde047;">${elem}</strong></div>
        <div>Nível 1 • 76 pontos livres para distribuir</div>
        <div>${pet.deploySlot ? `Posicionado no Slot #${pet.deploySlot}` : 'Enviado para a Reserva de Pets'}</div>
      </div>
    `;
    modal.style.display = 'flex';
  },

  getEssenceMetaForRace(raceCode) {
    return (this.bootstrapData?.races || []).find((r) => r.raceCode === raceCode) || null;
  },

  renderSell() {
    const list = document.getElementById('hunterSellPetsList');
    const preview = document.getElementById('hunterSellPreviewBox');
    const countEl = document.getElementById('hunterSellPetsCount');
    const summary = document.getElementById('hunterSellFooterSummary');
    const btn = document.getElementById('btnHunterSell');
    if (!list || !preview || !btn) return;

    const allPets = this.client?.petsPayload?.pets || [];
    if (countEl) countEl.textContent = `${allPets.length} no personagem`;

    if (allPets.length === 0) {
      list.innerHTML = `
        <div style="color:#94a3b8; font-size:0.76rem; text-align:center; padding:22px 12px; border:1px dashed rgba(148,163,184,0.2); border-radius:10px;">
          Você ainda não possui companheiros para vender.
        </div>
      `;
      preview.innerHTML = `<span style="color:#64748b; font-size:0.74rem;">Selecione um companheiro para ver a recompensa.</span>`;
      if (summary) summary.innerHTML = '';
      btn.disabled = true;
      btn.textContent = 'Nenhum Companheiro';
      return;
    }

    if (!this.selectedSellPetId || !allPets.some((p) => p.id === this.selectedSellPetId)) {
      this.selectedSellPetId = allPets[0].id;
    }

    const rewardRules = this.bootstrapData?.rewardRules || { F: 15, D: 35, C: 60, B: 150, A: 350, S: 800, SS: 1750 };
    const rarityColors = { SS: '#f8fafc', S: '#f87171', A: '#fb923c', B: '#c084fc', C: '#60a5fa', D: '#4ade80', F: '#cbd5e1' };

    list.innerHTML = allPets
      .map((p) => {
        const isSelected = p.id === this.selectedSellPetId;
        const essenceMeta = this.getEssenceMetaForRace(p.raceCode);
        const rewardQty = rewardRules[p.rarityTier] || 15;
        const rColor = rarityColors[p.rarityTier] || '#cbd5e1';
        const isDeployed = Boolean(p.deploySlot);
        return `
          <div class="hunter-sell-pet-card ${isSelected ? 'active' : ''}" onclick="PlayHunterController.selectSellPet(${p.id})">
            <div style="display:flex; align-items:center; gap:8px; min-width:0;">
              <img src="${p.thumbUrl}" alt="${p.nickname}" onerror="this.onerror=null; this.src='/play/assets/hud/menu_pets.png'"
                   style="width:36px; height:36px; object-fit:contain; background:#020617; border:1.5px solid ${rColor}; border-radius:8px; flex-shrink:0;" />
              <div style="min-width:0;">
                <div style="display:flex; align-items:center; gap:5px;">
                  <strong style="font-size:0.78rem; color:#f8fafc; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.nickname}</strong>
                  <span style="font-size:0.62rem; font-weight:800; color:${rColor};">Rank ${p.rarityTier}</span>
                </div>
                <div style="font-size:0.68rem; color:#94a3b8;">
                  Nv.${p.level} • ${isDeployed ? `Slot #${p.deploySlot}` : 'Reserva'}
                </div>
              </div>
            </div>
            <div style="display:flex; align-items:center; gap:4px; background:rgba(16,185,129,0.14); border:1px solid rgba(52,211,153,0.45); border-radius:8px; padding:3px 7px; flex-shrink:0;">
              <img src="${essenceMeta?.iconUrl || ''}" style="width:15px; height:15px; object-fit:contain;" onerror="this.style.display='none'" />
              <span style="font-size:0.72rem; font-weight:800; color:#4ade80;">+${rewardQty}</span>
            </div>
          </div>
        `;
      })
      .join('');

    const selectedPet = allPets.find((p) => p.id === this.selectedSellPetId);
    if (!selectedPet) return;
    const essenceMeta = this.getEssenceMetaForRace(selectedPet.raceCode);
    const rewardQty = rewardRules[selectedPet.rarityTier] || 15;
    const eqCount = Object.keys(selectedPet.equippedItemsJson || {}).length;

    preview.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
        <div style="font-size:0.76rem; color:#cbd5e1;">
          Reciclar <strong style="color:#f8fafc;">${selectedPet.nickname}</strong> (Nv.${selectedPet.level})
        </div>
        <span style="font-size:0.74rem; color:#4ade80; font-weight:800;">+${rewardQty}x ${essenceMeta?.namePtBr || 'Essência'}</span>
      </div>
      ${eqCount > 0 ? `<div style="font-size:0.70rem; color:#fde047;">🛡️ ${eqCount} equipamento(s) serão devolvidos automaticamente à sua mochila.</div>` : ''}
    `;

    if (summary) {
      summary.innerHTML = `
        <img src="${essenceMeta?.iconUrl || ''}" style="width:18px; height:18px; object-fit:contain;" onerror="this.style.display='none'" />
        <span>Recebe: <strong style="color:#4ade80;">+${rewardQty.toLocaleString('pt-BR')}x</strong> ${essenceMeta?.namePtBr || 'Essência'}</span>
      `;
    }
    btn.disabled = false;
    btn.textContent = `Vender "${selectedPet.nickname}"`;
  },

  selectSellPet(petId) {
    this.selectedSellPetId = petId;
    this.renderSell();
  },

  async handleSellSubmit() {
    if (!this.client?.activeChar || !this.selectedSellPetId) return;
    const allPets = this.client?.petsPayload?.pets || [];
    const pet = allPets.find((p) => p.id === this.selectedSellPetId);
    if (!pet) return;

    const essenceMeta = this.getEssenceMetaForRace(pet.raceCode);
    const rewardRules = this.bootstrapData?.rewardRules || { F: 15, D: 35, C: 60, B: 150, A: 350, S: 800, SS: 1750 };
    const rewardQty = rewardRules[pet.rarityTier] || 15;
    if (!confirm(`Confirmar venda de "${pet.nickname}" (Rank ${pet.rarityTier}) por +${rewardQty}x ${essenceMeta?.namePtBr || 'Essência'}?`)) {
      return;
    }

    const btn = document.getElementById('btnHunterSell');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Vendendo...';
    }
    try {
      const res = await this.client.api(
        `/api/play/characters/${this.client.activeChar.id}/hunter-sell-pet`,
        {
          method: 'POST',
          body: JSON.stringify({ characterPetId: pet.id }),
        }
      );
      if (res?.success) {
        if (res.petsPayload) this.syncClientPetsPayload(res.petsPayload);
        if (res.updatedPlayerEssences && this.bootstrapData) {
          this.bootstrapData.playerEssences = res.updatedPlayerEssences;
          for (const r of this.bootstrapData.races || []) {
            r.playerQuantity = res.updatedPlayerEssences[r.itemCode] || 0;
          }
        }
        if (typeof this.client.loadCharacterInventory === 'function') {
          await this.client.loadCharacterInventory().catch(() => {});
        }
        this.selectedSellPetId = null;
        this.renderSell();
        const modal = document.getElementById('hunterSuccessModal');
        const title = document.getElementById('hunterSuccessTitle');
        const details = document.getElementById('hunterSuccessDetails');
        if (modal && details) {
          if (title) title.textContent = '♻️ Companheiro Vendido!';
          const r = res.reward || {};
          details.innerHTML = `
            <div style="font-size:0.80rem; color:#cbd5e1; display:flex; flex-direction:column; gap:5px;">
              <div><strong>${res.soldPet?.nickname || pet.nickname}</strong> reciclado com sucesso.</div>
              <div style="color:#4ade80; font-weight:800;">+${(r.essenceAmount || rewardQty).toLocaleString('pt-BR')}x ${r.namePtBr || essenceMeta?.namePtBr || 'Essências'}</div>
              ${res.returnedEquipmentsCount > 0 ? `<div style="color:#fde047;">📦 ${res.returnedEquipmentsCount} item(ns) devolvido(s) à mochila.</div>` : ''}
            </div>
          `;
          modal.style.display = 'flex';
        }
      }
    } catch (err) {
      alert(`Falha ao vender companheiro: ${err.message}`);
      this.renderSell();
    }
  },
};

window.PlayHunterController = PlayHunterController;
