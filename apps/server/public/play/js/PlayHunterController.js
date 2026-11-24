/**
 * @file apps/server/public/play/js/PlayHunterController.js
 * @module @etheria/play
 * @description Controlador da Interface de Caçador (Geração de Pets por Essências):
 *   Oferece uma interface minimalista e intuitiva para os 3 layouts alvos:
 *   - Desktop (janela ampla com prévia visual em tempo real)
 *   - Mobile Horizontal (layout dividido lado a lado otimizado para landscape)
 *   - Mobile Vertical (layout em etapas com barra de ação fixa)
 */

const PlayHunterController = {
  client: null,
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
      <div id="hunterPetModal" class="hunter-modal-backdrop" style="display:none;">
        <div class="hunter-modal-box">
          <!-- CABEÇALHO -->
          <div class="hunter-modal-header">
            <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
              <span class="hunter-header-icon">🐾</span>
              <div>
                <h3 class="hunter-modal-title">Santuário do Caçador</h3>
                <div class="hunter-nav-tabs">
                  <button type="button" id="hunterTabBtnCraft" class="hunter-nav-btn active" onclick="PlayHunterController.switchTab('CRAFT')">
                    🐾 Invocação de Pets
                  </button>
                  <button type="button" id="hunterTabBtnSell" class="hunter-nav-btn" onclick="PlayHunterController.switchTab('SELL')">
                    ♻️ Vender / Reciclar Pets
                  </button>
                </div>
              </div>
            </div>
            <button type="button" class="hunter-btn-close" onclick="PlayApp.closeHunterPetModal()">✕</button>
          </div>

          <!-- ABA 1: CRIAÇÃO / INVOCAÇÃO DE PETS -->
          <div id="hunterCraftView" style="display:flex; flex-direction:column; flex:1; min-height:0;">
            <div class="hunter-modal-body">
              <!-- COLUNA ESQUERDA: ETAPA 1 (ESSÊNCIA/RAÇA) & ETAPA 2 (RARIDADE) -->
              <div class="hunter-col-config">
                <!-- PASSO 1: ESCOLHA DA ESSÊNCIA -->
                <div class="hunter-section">
                  <div class="hunter-step-title">
                    <span class="hunter-step-num">1</span>
                    <span>Escolha a Essência da Raça:</span>
                  </div>
                  <div id="hunterRacesGrid" class="hunter-races-grid"></div>
                </div>

                <!-- PASSO 2: ESCOLHA DA RARIDADE -->
                <div class="hunter-section">
                  <div class="hunter-step-title">
                    <span class="hunter-step-num">2</span>
                    <span>Escolha a Raridade do Pet:</span>
                  </div>
                  <div id="hunterRaritiesRow" class="hunter-rarities-row"></div>
                  <div id="hunterCostBalanceBadge" class="hunter-balance-badge"></div>
                </div>
              </div>

              <!-- COLUNA DIREITA: ETAPA 3 (ESCOLHA DO PET & PRÉVIA) -->
              <div class="hunter-col-pets">
                <div class="hunter-step-title">
                  <span class="hunter-step-num">3</span>
                  <span>Selecione a Espécie do Pet:</span>
                </div>
                <div id="hunterPetsList" class="hunter-pets-list"></div>

                <!-- PRÉVIA & APELIDO DO PET SELECIONADO -->
                <div id="hunterPetPreviewBox" class="hunter-preview-box"></div>
              </div>
            </div>

            <!-- RODAPÉ DE AÇÃO DE INVOCAÇÃO -->
            <div class="hunter-modal-footer">
              <div id="hunterFooterCostSummary" class="hunter-footer-summary"></div>
              <button type="button" id="btnHunterCraft" class="hunter-btn-craft" onclick="PlayHunterController.handleCraftSubmit()">
                <span>🐾 Invocar Novo Pet</span>
              </button>
            </div>
          </div>

          <!-- ABA 2: VENDA / RECICLAGEM DE PETS POR ESSÊNCIAS -->
          <div id="hunterSellView" style="display:none; flex-direction:column; flex:1; min-height:0;">
            <div style="background:rgba(16,185,129,0.08); border-bottom:1px solid rgba(16,185,129,0.25); padding:8px 16px; font-size:0.75rem; color:#86efac; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
              <div>
                <strong>♻️ Reciclagem de Pets:</strong> Entregue um companheiro ao Caçador para recuperar essências de sua raça correspondente.
              </div>
              <div style="color:#fde047; font-size:0.72rem; font-weight:700;">
                🛡️ Equipamentos equipados retornarão à sua mochila automaticamente!
              </div>
            </div>

            <div class="hunter-modal-body">
              <!-- COLUNA ESQUERDA: LISTA DOS MEUS PETS -->
              <div class="hunter-col-config">
                <div class="hunter-step-title" style="justify-content:space-between;">
                  <div style="display:flex; align-items:center; gap:8px;">
                    <span class="hunter-step-num" style="background:#10b981; color:#fff;">1</span>
                    <span>Seus Pets Atuais:</span>
                  </div>
                  <span id="hunterSellPetsCount" style="font-size:0.72rem; color:#94a3b8;"></span>
                </div>
                <div id="hunterSellPetsList" class="hunter-sell-pets-grid"></div>
              </div>

              <!-- COLUNA DIREITA: DETALHES DA VENDA / RECOMPENSA -->
              <div class="hunter-col-pets">
                <div class="hunter-step-title">
                  <span class="hunter-step-num" style="background:#10b981; color:#fff;">2</span>
                  <span>Recompensa & Confirmação de Venda:</span>
                </div>
                <div id="hunterSellPreviewBox" class="hunter-sell-preview-card"></div>
              </div>
            </div>

            <!-- RODAPÉ DE AÇÃO DE VENDA -->
            <div class="hunter-modal-footer">
              <div id="hunterSellFooterSummary" class="hunter-footer-summary"></div>
              <button type="button" id="btnHunterSell" class="hunter-btn-sell" onclick="PlayHunterController.handleSellSubmit()">
                <span>♻️ Confirmar Venda do Pet</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- MODAL DE CELEBRAÇÃO / SUCESSO -->
      <div id="hunterSuccessModal" class="hunter-modal-backdrop" style="display:none; z-index:10050;">
        <div class="hunter-success-card">
          <div style="font-size:3rem; margin-bottom:4px; animation:hunterBounce 0.6s ease infinite alternate;">✨ 🐾 ✨</div>
          <h2 style="font-size:1.3rem; color:#fde047; font-weight:900; margin:0;">Invocação Bem-Sucedida!</h2>
          <p style="font-size:0.82rem; color:#cbd5e1; margin:4px 0 14px 0;">Um novo vínculo sagrado foi estabelecido com este pet.</p>
          <div id="hunterSuccessDetails" style="background:#020617; border:1px solid #334155; border-radius:10px; padding:12px; margin-bottom:14px;"></div>
          <button type="button" class="btn-primary" style="background:linear-gradient(135deg, #d97706, #b45309); border:1.5px solid #fbbf24; color:#fff; font-weight:800; padding:10px 24px; border-radius:8px; font-size:0.9rem; cursor:pointer;" onclick="document.getElementById('hunterSuccessModal').style.display='none'">
            Continuar Explorando
          </button>
        </div>
      </div>
    `;

    const style = document.createElement('style');
    style.id = 'hunterModalStyles';
    style.textContent = `
      .hunter-modal-backdrop { position:fixed; inset:0; background:rgba(2,6,23,0.85); backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px); display:flex; align-items:center; justify-content:center; z-index:10000; padding:10px; box-sizing:border-box; }
      .hunter-modal-box { background:radial-gradient(circle at top, #1e293b 0%, #0f172a 100%); border:1.5px solid rgba(245,158,11,0.4); box-shadow:0 16px 40px rgba(0,0,0,0.8), 0 0 24px rgba(245,158,11,0.15); border-radius:14px; width:100%; max-width:980px; max-height:88vh; display:flex; flex-direction:column; overflow:hidden; color:#f8fafc; animation:hunterFadeIn 0.2s ease-out; }
      @keyframes hunterFadeIn { from { opacity:0; transform:scale(0.96); } to { opacity:1; transform:scale(1); } }
      @keyframes hunterBounce { from { transform:translateY(0); } to { transform:translateY(-8px); } }
      .hunter-modal-header { display:flex; justify-content:space-between; align-items:center; padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.1); background:rgba(15,23,42,0.95); }
      .hunter-header-icon { font-size:1.6rem; }
      .hunter-modal-title { font-size:1.05rem; font-weight:800; color:#fde047; margin:0; }
      .hunter-nav-tabs { display:flex; gap:6px; margin-top:4px; }
      .hunter-nav-btn { background:rgba(15,23,42,0.8); border:1px solid #334155; color:#94a3b8; font-size:0.74rem; font-weight:700; padding:4px 10px; border-radius:6px; cursor:pointer; transition:all 0.15s ease; }
      .hunter-nav-btn:hover { border-color:#f59e0b; color:#f8fafc; }
      .hunter-nav-btn.active { background:linear-gradient(135deg, rgba(245,158,11,0.25), rgba(217,119,6,0.25)); border-color:#fbbf24; color:#fde047; }
      .hunter-btn-close { background:#334155; border:none; color:#cbd5e1; font-weight:700; width:30px; height:30px; border-radius:6px; cursor:pointer; display:flex; align-items:center; justify-content:center; }
      .hunter-btn-close:hover { background:#ef4444; color:#fff; }
      .hunter-modal-body { flex:1; min-height:0; overflow-y:auto; display:grid; grid-template-columns:1.15fr 1.35fr; gap:14px; padding:14px 16px; }
      .hunter-col-config, .hunter-col-pets { display:flex; flex-direction:column; gap:12px; min-height:0; }
      .hunter-section { background:rgba(15,23,42,0.7); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:10px; display:flex; flex-direction:column; gap:8px; }
      .hunter-step-title { display:flex; align-items:center; gap:8px; font-size:0.82rem; font-weight:800; color:#f8fafc; }
      .hunter-step-num { background:#f59e0b; color:#000; width:18px; height:18px; border-radius:99px; display:inline-flex; align-items:center; justify-content:center; font-size:0.72rem; font-weight:900; }
      .hunter-races-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(95px, 1fr)); gap:6px; max-height:200px; overflow-y:auto; padding-right:2px; }
      .hunter-race-chip { display:flex; flex-direction:column; align-items:center; gap:4px; background:#020617; border:1.5px solid #334155; border-radius:8px; padding:6px 4px; cursor:pointer; transition:all 0.15s ease; text-align:center; }
      .hunter-race-chip:hover { border-color:#f59e0b; background:rgba(245,158,11,0.08); }
      .hunter-race-chip.active { border-color:#fbbf24; background:rgba(245,158,11,0.2); box-shadow:0 0 10px rgba(245,158,11,0.3); }
      .hunter-race-chip img { width:32px; height:32px; object-fit:contain; }
      .hunter-race-chip-name { font-size:0.7rem; font-weight:700; color:#f8fafc; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:85px; }
      .hunter-race-chip-qty { font-size:0.64rem; font-weight:700; color:#fde047; }
      .hunter-rarities-row { display:flex; gap:6px; overflow-x:auto; padding-bottom:4px; }
      .hunter-rarity-pill { flex:1; min-width:48px; display:flex; flex-direction:column; align-items:center; padding:6px 4px; border-radius:8px; border:1.5px solid #334155; background:#020617; cursor:pointer; transition:all 0.15s ease; }
      .hunter-rarity-pill:hover { border-color:#f59e0b; }
      .hunter-rarity-pill.active { border-color:#fbbf24; background:rgba(245,158,11,0.25); box-shadow:0 0 10px rgba(245,158,11,0.3); }
      .hunter-rarity-pill strong { font-size:0.84rem; font-weight:900; }
      .hunter-rarity-pill span { font-size:0.65rem; color:#94a3b8; }
      .hunter-balance-badge { font-size:0.74rem; font-weight:700; padding:6px 8px; border-radius:6px; display:flex; align-items:center; justify-content:space-between; }
      .hunter-pets-list { display:grid; grid-template-columns:repeat(auto-fill, minmax(130px, 1fr)); gap:8px; flex:1; max-height:250px; overflow-y:auto; padding-right:4px; }
      .hunter-pet-card { background:#020617; border:1.5px solid #334155; border-radius:8px; padding:8px; display:flex; flex-direction:column; align-items:center; gap:4px; cursor:pointer; transition:all 0.15s ease; text-align:center; }
      .hunter-pet-card:hover { border-color:#f59e0b; }
      .hunter-pet-card.active { border-color:#38bdf8; background:rgba(56,189,248,0.15); box-shadow:0 0 12px rgba(56,189,248,0.35); }
      .hunter-pet-card img { width:44px; height:44px; object-fit:contain; }
      .hunter-pet-card-name { font-size:0.75rem; font-weight:700; color:#f8fafc; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:120px; }
      .hunter-preview-box { background:rgba(15,23,42,0.85); border:1px solid rgba(255,255,255,0.1); border-radius:10px; padding:10px; display:flex; gap:12px; align-items:center; }
      .hunter-sell-pets-grid { display:flex; flex-direction:column; gap:8px; max-height:290px; overflow-y:auto; padding-right:4px; }
      .hunter-sell-pet-card { display:flex; align-items:center; justify-content:space-between; background:#020617; border:1.5px solid #334155; border-radius:8px; padding:8px 10px; cursor:pointer; transition:all 0.15s ease; gap:8px; }
      .hunter-sell-pet-card:hover { border-color:#10b981; background:rgba(16,185,129,0.05); }
      .hunter-sell-pet-card.active { border-color:#34d399; background:rgba(16,185,129,0.15); box-shadow:0 0 10px rgba(16,185,129,0.3); }
      .hunter-sell-preview-card { background:rgba(15,23,42,0.85); border:1px solid rgba(255,255,255,0.1); border-radius:10px; padding:12px; display:flex; flex-direction:column; gap:10px; flex:1; min-height:0; }
      .hunter-modal-footer { display:flex; justify-content:space-between; align-items:center; padding:10px 16px; border-top:1px solid rgba(255,255,255,0.1); background:rgba(15,23,42,0.95); gap:10px; flex-wrap:wrap; }
      .hunter-footer-summary { font-size:0.82rem; font-weight:700; color:#f8fafc; display:flex; align-items:center; gap:6px; }
      .hunter-btn-craft { background:linear-gradient(135deg, #f59e0b, #d97706); border:1.5px solid #fbbf24; color:#000; font-weight:900; font-size:0.92rem; padding:10px 24px; border-radius:8px; cursor:pointer; transition:all 0.15s ease; display:inline-flex; align-items:center; gap:6px; box-shadow:0 4px 14px rgba(245,158,11,0.35); }
      .hunter-btn-craft:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 6px 18px rgba(245,158,11,0.5); }
      .hunter-btn-craft:disabled { background:#334155; border-color:#475569; color:#94a3b8; cursor:not-allowed; box-shadow:none; }
      .hunter-btn-sell { background:linear-gradient(135deg, #10b981, #059669); border:1.5px solid #34d399; color:#fff; font-weight:900; font-size:0.88rem; padding:10px 22px; border-radius:8px; cursor:pointer; transition:all 0.15s ease; display:inline-flex; align-items:center; gap:6px; box-shadow:0 4px 14px rgba(16,185,129,0.35); }
      .hunter-btn-sell:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 6px 18px rgba(16,185,129,0.5); }
      .hunter-btn-sell:disabled { background:#334155; border-color:#475569; color:#94a3b8; cursor:not-allowed; box-shadow:none; }
      .hunter-success-card { background:radial-gradient(circle at center, #1e293b 0%, #020617 100%); border:2px solid #fbbf24; border-radius:14px; padding:24px; max-width:420px; width:90%; text-align:center; color:#f8fafc; box-shadow:0 20px 50px rgba(0,0,0,0.9), 0 0 30px rgba(245,158,11,0.3); }

      /* =========================================================================
         RESPONSIVIDADE: MOBILE HORIZONTAL & MOBILE VERTICAL
         ========================================================================= */
      @media (max-width: 768px) {
        .hunter-modal-box { max-height:94vh; width:98%; border-radius:10px; }
        .hunter-modal-body { grid-template-columns:1fr; gap:10px; padding:10px; }
        .hunter-races-grid { grid-template-columns:repeat(4, 1fr); max-height:150px; }
        .hunter-pets-list { grid-template-columns:repeat(2, 1fr); max-height:180px; }
        .hunter-btn-craft, .hunter-btn-sell { width:100%; justify-content:center; }
      }

      @media (orientation: landscape) and (max-height: 520px) {
        .hunter-modal-box { max-height:98vh; width:98%; border-radius:8px; }
        .hunter-modal-header { padding:6px 12px; }
        .hunter-modal-title { font-size:0.9rem; }
        .hunter-modal-body { grid-template-columns:1fr 1fr; gap:8px; padding:6px 10px; }
        .hunter-races-grid { grid-template-columns:repeat(4, 1fr); max-height:120px; }
        .hunter-pets-list { grid-template-columns:repeat(2, 1fr); max-height:120px; }
        .hunter-preview-box, .hunter-sell-preview-card { padding:6px; }
        .hunter-modal-footer { padding:6px 12px; }
        .hunter-btn-craft, .hunter-btn-sell { padding:6px 16px; font-size:0.82rem; }
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

    const modal = document.getElementById('hunterPetModal');
    if (!modal) return;
    modal.style.display = 'flex';

    // Fecha o modal de diálogo de quests se estiver aberto
    const qModal = document.getElementById('npcQuestModal');
    if (qModal) qModal.style.display = 'none';

    try {
      const data = await this.client.api(
        `/api/play/characters/${this.client.activeChar.id}/hunter-bootstrap`
      );
      this.bootstrapData = data;
      if (this.currentTab === 'SELL') {
        this.switchTab('SELL');
      } else {
        this.switchTab('CRAFT');
      }
    } catch (err) {
      alert(`Erro ao abrir o Santuário do Caçador: ${err.message}`);
      this.closeModal();
    }
  },

  closeModal() {
    const modal = document.getElementById('hunterPetModal');
    if (modal) modal.style.display = 'none';
  },

  renderAll() {
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
            <img src="${r.iconUrl}" alt="" onerror="this.src='/play/assets/hud/menu_shop.png'" />
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
    this.renderRaces();
    this.renderPets();
    this.renderPreview();
    this.renderFooter();
  },

  renderRarities() {
    const row = document.getElementById('hunterRaritiesRow');
    const badge = document.getElementById('hunterCostBalanceBadge');
    if (!row || !badge || !this.bootstrapData) return;

    const costRules = this.bootstrapData.costRules || { F: 30, D: 70, C: 120, B: 300, A: 700, S: 1600, SS: 3500 };
    const rarityTiers = ['F', 'D', 'C', 'B', 'A', 'S', 'SS'];
    const rarityColors = { SS: '#fbbf24', S: '#c084fc', A: '#38bdf8', B: '#4ade80', C: '#fde047', D: '#cbd5e1', F: '#94a3b8' };

    row.innerHTML = rarityTiers
      .map((tier) => {
        const cost = costRules[tier] || 30;
        const isActive = tier === this.selectedRarity;
        const color = rarityColors[tier] || '#94a3b8';
        return `
          <div class="hunter-rarity-pill ${isActive ? 'active' : ''}" onclick="PlayHunterController.selectRarity('${tier}')">
            <strong style="color:${color};">${tier}</strong>
            <span>${cost}</span>
          </div>
        `;
      })
      .join('');

    // Atualiza o indicador de balanço
    const curRace = (this.bootstrapData.races || []).find((r) => r.raceCode === this.selectedRaceCode);
    const playerQty = curRace?.playerQuantity || 0;
    const requiredCost = costRules[this.selectedRarity] || 30;
    const isEnough = playerQty >= requiredCost;

    badge.style.background = isEnough ? 'rgba(74, 222, 128, 0.15)' : 'rgba(239, 68, 68, 0.15)';
    badge.style.border = isEnough ? '1px solid #4ade80' : '1px solid #ef4444';
    badge.innerHTML = `
      <div style="display:flex; align-items:center; gap:6px;">
        <img src="${curRace?.iconUrl || ''}" style="width:20px; height:20px; object-fit:contain;" />
        <span style="color:#f8fafc;">${curRace?.namePtBr || 'Essência'}:</span>
        <strong style="color:${isEnough ? '#86efac' : '#fca5a5'};">${playerQty.toLocaleString('pt-BR')} / ${requiredCost.toLocaleString('pt-BR')}</strong>
      </div>
      <span style="color:${isEnough ? '#86efac' : '#fca5a5'};">${isEnough ? '✅ Quantia Atingida!' : `❌ Faltam ${(requiredCost - playerQty).toLocaleString('pt-BR')}`}</span>
    `;
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
    if (!container || !this.bootstrapData) return;

    const allPets = this.bootstrapData.tamablePets || [];
    const filtered = allPets.filter(
      (p) => p.raceCode === this.selectedRaceCode && String(p.rarityTier).toUpperCase() === this.selectedRarity.toUpperCase()
    );

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="grid-column:1/-1; color:var(--text-muted); font-size:0.78rem; text-align:center; padding:24px; border:1px dashed rgba(255,255,255,0.1); border-radius:8px;">
          Nenhum monstro desta raça cadastrado como Pet no Rank <strong>${this.selectedRarity}</strong>.<br>
          Selecione outro tier de raridade ou outra essência.
        </div>
      `;
      return;
    }

    // Se nenhum estiver selecionado, seleciona o primeiro por padrão
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
            <span style="font-size:0.65rem; color:#94a3b8;">${pet.combatStyle === 'RANGED' ? '🏹 Distância' : '⚔️ Físico'}</span>
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

    const allPets = this.bootstrapData.tamablePets || [];
    const pet = allPets.find((p) => p.id === this.selectedMonsterId);

    if (!pet) {
      box.innerHTML = `<span style="color:#64748b; font-size:0.75rem;">Selecione um pet acima para visualizar detalhes.</span>`;
      return;
    }

    box.innerHTML = `
      <img src="${pet.thumbUrl}" alt="${pet.namePtBr}" style="width:58px; height:58px; object-fit:contain; background:#020617; border:1.5px solid #38bdf8; border-radius:10px; padding:2px;" onerror="this.onerror=null; this.src='/play/assets/hud/menu_pets.png'" />
      <div style="flex:1; min-width:0;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong style="font-size:0.88rem; color:#f8fafc;">${pet.namePtBr}</strong>
          <span style="font-size:0.72rem; color:#38bdf8; font-weight:800; background:rgba(56,189,248,0.15); padding:2px 6px; border-radius:4px;">Rank ${pet.rarityTier}</span>
        </div>
        <div style="font-size:0.72rem; color:#cbd5e1; margin-top:2px;">
          🎲 <strong>Elemento:</strong> <span style="color:#fde047;">Aleatório (Sorteado ao invocar)</span>
        </div>
        <div style="font-size:0.72rem; color:#86efac; margin-top:1px;">
          ⭐ <strong>Nível 1</strong> &bull; <strong>76 Pontos Livres</strong> para você distribuir
        </div>
        <div style="margin-top:6px;">
          <input type="text" id="hunterCustomNicknameInput" placeholder="Apelido do pet (opcional)..." 
                 value="${this.customNickname}" oninput="PlayHunterController.customNickname = this.value"
                 style="width:100%; box-sizing:border-box; padding:4px 8px; font-size:0.74rem; background:#020617; border:1px solid #334155; border-radius:6px; color:#f8fafc;" />
        </div>
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
      <div style="display:flex; align-items:center; gap:6px;">
        <span style="color:#94a3b8;">Custo de Invocação:</span>
        <img src="${curRace?.iconUrl || ''}" style="width:22px; height:22px; object-fit:contain;" />
        <strong style="color:#fde047;">${requiredCost.toLocaleString('pt-BR')}x ${curRace?.namePtBr || 'Essência'}</strong>
      </div>
    `;

    if (!hasPet) {
      btn.disabled = true;
      btn.innerHTML = `<span>Selecione uma Espécie</span>`;
    } else if (!isEnough) {
      btn.disabled = true;
      btn.innerHTML = `<span>🔒 Essências Insuficientes (${playerQty}/${requiredCost})</span>`;
    } else {
      btn.disabled = false;
      btn.innerHTML = `<span>🐾 Invocar Pet (${requiredCost} Essências)</span>`;
    }
  },

  async handleCraftSubmit() {
    if (!this.client || !this.client.activeChar || !this.selectedMonsterId) return;

    const btn = document.getElementById('btnHunterCraft');
    if (btn) btn.disabled = true;

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
        // Atualiza os dados de pets no cliente
        if (res.petsPayload && this.client.petsPayload) {
          this.client.petsPayload = res.petsPayload;
          if (window.PlayPetsController && typeof window.PlayPetsController.renderPetsModalContent === 'function') {
            window.PlayPetsController.renderPetsModalContent(this.client);
          }
        }

        // Atualiza a quantia de essências
        if (res.updatedPlayerEssences && this.bootstrapData) {
          this.bootstrapData.playerEssences = res.updatedPlayerEssences;
          for (const r of this.bootstrapData.races || []) {
            r.playerQuantity = res.updatedPlayerEssences[r.itemCode] || 0;
          }
        }

        this.renderRaces();
        this.renderRarities();
        this.renderFooter();

        // Exibe o modal comemorativo
        this.showSuccessCard(res.createdPet);
      }
    } catch (err) {
      alert(`Falha ao invocar pet: ${err.message}`);
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  showSuccessCard(pet) {
    const modal = document.getElementById('hunterSuccessModal');
    const details = document.getElementById('hunterSuccessDetails');
    if (!modal || !details) return;

    const elementNames = {
      FIRE: '🔥 Fogo', WATER: '💧 Água', EARTH: '🌿 Terra', WIND: '🌪️ Vento',
      LIGHT: '✨ Luz', DARK: '🌑 Trevas', THUNDER: '⚡ Trovão', ICE: '❄️ Gelo',
      POISON: '☠️ Veneno', PSYCHIC: '🔮 Psíquico', NEUTRAL: '⚪ Neutro',
    };

    const elem = elementNames[pet.elementCode] || `⚪ ${pet.elementCode}`;

    details.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:center; gap:10px; margin-bottom:8px;">
        <strong style="font-size:1.1rem; color:#86efac;">${pet.nickname}</strong>
      </div>
      <div style="font-size:0.8rem; color:#cbd5e1; display:flex; flex-direction:column; gap:4px;">
        <div>🎲 <strong>Elemento Desperto:</strong> <span style="color:#fde047; font-weight:700;">${elem}</span></div>
        <div>⭐ <strong>Nível Inicial:</strong> Nv. 1 (com 76 pontos livres para distribuir)</div>
        <div>🛡️ <strong>Alocação:</strong> ${pet.deploySlot ? `Posicionado no Slot de Batalha #${pet.deploySlot}` : 'Enviado para a Reserva de Pets'}</div>
      </div>
    `;

    modal.style.display = 'flex';
  },

  switchTab(tab) {
    this.currentTab = tab;
    const craftBtn = document.getElementById('hunterTabBtnCraft');
    const sellBtn = document.getElementById('hunterTabBtnSell');
    const craftView = document.getElementById('hunterCraftView');
    const sellView = document.getElementById('hunterSellView');

    if (tab === 'SELL') {
      if (craftBtn) craftBtn.classList.remove('active');
      if (sellBtn) sellBtn.classList.add('active');
      if (craftView) craftView.style.display = 'none';
      if (sellView) {
        sellView.style.display = 'flex';
        this.renderSell();
      }
    } else {
      if (sellBtn) sellBtn.classList.remove('active');
      if (craftBtn) craftBtn.classList.add('active');
      if (sellView) sellView.style.display = 'none';
      if (craftView) {
        craftView.style.display = 'flex';
        this.renderAll();
      }
    }
  },

  getEssenceMetaForRace(raceCode) {
    if (!this.bootstrapData || !this.bootstrapData.races) return null;
    return this.bootstrapData.races.find((r) => r.raceCode === raceCode) || null;
  },

  renderSell() {
    const list = document.getElementById('hunterSellPetsList');
    const preview = document.getElementById('hunterSellPreviewBox');
    const countEl = document.getElementById('hunterSellPetsCount');
    const summary = document.getElementById('hunterSellFooterSummary');
    const btn = document.getElementById('btnHunterSell');
    if (!list || !preview || !btn) return;

    const allPets = this.client?.petsPayload?.pets || [];
    if (countEl) countEl.textContent = `${allPets.length} pet(s) no personagem`;

    if (allPets.length === 0) {
      list.innerHTML = `
        <div style="color:#94a3b8; font-size:0.78rem; text-align:center; padding:32px 16px; border:1px dashed #334155; border-radius:8px;">
          🐾 Você ainda não possui nenhum pet para vender.<br>
          <span style="font-size:0.72rem; color:#64748b; margin-top:4px; display:inline-block;">Invoque um pet usando essências na aba "Invocação de Pets".</span>
        </div>
      `;
      preview.innerHTML = `<span style="color:#64748b; font-size:0.75rem;">Nenhum pet selecionado.</span>`;
      if (summary) summary.innerHTML = '';
      btn.disabled = true;
      btn.innerHTML = `<span>Nenhum Pet Selecionado</span>`;
      return;
    }

    if (!this.selectedSellPetId || !allPets.some((p) => p.id === this.selectedSellPetId)) {
      this.selectedSellPetId = allPets[0].id;
    }

    const rewardRules = this.bootstrapData?.rewardRules || { F: 15, D: 35, C: 60, B: 150, A: 350, S: 800, SS: 1750 };
    const rarityColors = { SS: '#fbbf24', S: '#c084fc', A: '#38bdf8', B: '#4ade80', C: '#fde047', D: '#cbd5e1', F: '#94a3b8' };

    list.innerHTML = allPets
      .map((p) => {
        const isSelected = p.id === this.selectedSellPetId;
        const essenceMeta = this.getEssenceMetaForRace(p.raceCode);
        const rewardQty = rewardRules[p.rarityTier] || 15;
        const rColor = rarityColors[p.rarityTier] || '#94a3b8';
        const eqCount = Object.keys(p.equippedItemsJson || {}).length;
        const isDeployed = Boolean(p.deploySlot);

        return `
          <div class="hunter-sell-pet-card ${isSelected ? 'active' : ''}" onclick="PlayHunterController.selectSellPet(${p.id})">
            <div style="display:flex; align-items:center; gap:8px; min-width:0;">
              <img src="${p.thumbUrl}" alt="" onerror="this.src='/play/assets/placeholder_pet.png'"
                   style="width:38px; height:38px; object-fit:contain; background:#0f172a; border:1.5px solid ${rColor}; border-radius:6px; flex-shrink:0;" />
              <div style="min-width:0; overflow:hidden;">
                <div style="display:flex; align-items:center; gap:6px;">
                  <strong style="font-size:0.8rem; color:#f8fafc; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">${p.nickname}</strong>
                  <span style="font-size:0.65rem; font-weight:800; color:${rColor}; background:rgba(255,255,255,0.06); padding:1px 5px; border-radius:4px;">Rank ${p.rarityTier}</span>
                </div>
                <div style="font-size:0.7rem; color:#94a3b8; display:flex; gap:6px; align-items:center; margin-top:2px;">
                  <span>Nv. ${p.level}</span>
                  <span>&bull;</span>
                  <span>${p.elementNamePtBr || p.elementCode}</span>
                  ${isDeployed ? `<span style="color:#38bdf8; font-weight:700;">🛡️ Slot #${p.deploySlot}</span>` : '<span style="color:#64748b;">🎒 Reserva</span>'}
                  ${eqCount > 0 ? `<span style="color:#fbbf24; font-weight:700;">⚔️ ${eqCount} eqp</span>` : ''}
                </div>
              </div>
            </div>
            <div style="display:flex; flex-direction:column; align-items:flex-end; gap:2px; flex-shrink:0;">
              <div style="display:flex; align-items:center; gap:4px; background:rgba(16,185,129,0.15); border:1px solid #10b981; border-radius:6px; padding:3px 6px;">
                <img src="${essenceMeta?.iconUrl || ''}" style="width:16px; height:16px; object-fit:contain;" onerror="this.style.display='none'" />
                <span style="font-size:0.72rem; font-weight:800; color:#4ade80;">+${rewardQty.toLocaleString('pt-BR')}</span>
              </div>
              <span style="font-size:0.62rem; color:#86efac;">${essenceMeta?.namePtBr?.replace('Essência ', '') || 'Essência'}</span>
            </div>
          </div>
        `;
      })
      .join('');

    const selectedPet = allPets.find((p) => p.id === this.selectedSellPetId);
    if (!selectedPet) {
      preview.innerHTML = `<span style="color:#64748b; font-size:0.75rem;">Selecione um pet da lista ao lado.</span>`;
      btn.disabled = true;
      return;
    }

    const essenceMeta = this.getEssenceMetaForRace(selectedPet.raceCode);
    const rewardQty = rewardRules[selectedPet.rarityTier] || 15;
    const rColor = rarityColors[selectedPet.rarityTier] || '#94a3b8';
    const eqKeys = Object.keys(selectedPet.equippedItemsJson || {});
    const eqCount = eqKeys.length;

    preview.innerHTML = `
      <div style="display:flex; gap:12px; align-items:center; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:10px;">
        <img src="${selectedPet.thumbUrl}" alt=""
             style="width:58px; height:58px; object-fit:contain; background:#020617; border:2px solid ${rColor}; border-radius:10px; padding:2px;" />
        <div style="flex:1; min-width:0;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong style="font-size:0.95rem; color:#f8fafc;">${selectedPet.nickname}</strong>
            <span style="font-size:0.72rem; color:${rColor}; font-weight:800; background:rgba(255,255,255,0.08); padding:2px 8px; border-radius:4px;">Rank ${selectedPet.rarityTier}</span>
          </div>
          <div style="font-size:0.72rem; color:#94a3b8; margin-top:2px;">
            Espécie: <strong style="color:#e2e8f0;">${selectedPet.speciesNamePtBr}</strong> &bull; Nível <strong>${selectedPet.level}</strong>
          </div>
          <div style="font-size:0.72rem; color:#cbd5e1; margin-top:1px;">
            🎲 Elemento: <strong style="color:#fde047;">${selectedPet.elementNamePtBr || selectedPet.elementCode}</strong>
          </div>
        </div>
      </div>

      <!-- RECOMPENSA DE VENDA -->
      <div style="background:rgba(16,185,129,0.1); border:1px solid #10b981; border-radius:8px; padding:10px; display:flex; align-items:center; justify-content:space-between;">
        <div style="display:flex; align-items:center; gap:8px;">
          <img src="${essenceMeta?.iconUrl || ''}" style="width:28px; height:28px; object-fit:contain;" />
          <div>
            <div style="font-size:0.72rem; color:#86efac; font-weight:700;">Recompensa de Reciclagem:</div>
            <div style="font-size:0.9rem; color:#4ade80; font-weight:900;">+${rewardQty.toLocaleString('pt-BR')}x ${essenceMeta?.namePtBr || 'Essência'}</div>
          </div>
        </div>
        <span style="font-size:0.7rem; color:#86efac; background:rgba(16,185,129,0.2); padding:3px 8px; border-radius:6px; font-weight:800;">Raça ${selectedPet.raceNamePtBr || selectedPet.raceCode}</span>
      </div>

      <!-- AVISO DE EQUIPAMENTOS -->
      ${eqCount > 0 ? `
        <div style="background:rgba(245,158,11,0.1); border:1px solid #f59e0b; border-radius:8px; padding:10px; font-size:0.74rem; color:#fde68a; line-height:1.4;">
          <strong>🛡️ Devolução de Equipamentos:</strong><br>
          Este pet possui <strong>${eqCount} equipamento(s)</strong> vinculados. Ao vendê-lo, todos os itens serão removidos dos slots e adicionados de volta à sua mochila automaticamente.
        </div>
      ` : `
        <div style="background:rgba(15,23,42,0.6); border:1px solid #334155; border-radius:8px; padding:8px 10px; font-size:0.72rem; color:#94a3b8;">
          ✅ Nenhum equipamento equipado neste pet.
        </div>
      `}

      <!-- STATUS DE BATALHA -->
      ${selectedPet.deploySlot ? `
        <div style="background:rgba(56,189,248,0.1); border:1px solid #38bdf8; border-radius:8px; padding:8px 10px; font-size:0.72rem; color:#bae6fd;">
          ⚠️ <strong>Atenção:</strong> Este pet está atualmente alocado no <strong>Slot de Batalha #${selectedPet.deploySlot}</strong>. Ao vendê-lo, ele será desequipado da equipe.
        </div>
      ` : ''}
    `;

    if (summary) {
      summary.innerHTML = `
        <div style="display:flex; align-items:center; gap:6px;">
          <span style="color:#94a3b8;">Você receberá:</span>
          <img src="${essenceMeta?.iconUrl || ''}" style="width:22px; height:22px; object-fit:contain;" />
          <strong style="color:#4ade80;">+${rewardQty.toLocaleString('pt-BR')}x ${essenceMeta?.namePtBr || 'Essência'}</strong>
        </div>
      `;
    }

    btn.disabled = false;
    btn.innerHTML = `<span>♻️ Vender "${selectedPet.nickname}" (+${rewardQty} Essências)</span>`;
  },

  selectSellPet(petId) {
    this.selectedSellPetId = petId;
    this.renderSell();
  },

  async handleSellSubmit() {
    if (!this.client || !this.client.activeChar || !this.selectedSellPetId) return;

    const allPets = this.client?.petsPayload?.pets || [];
    const pet = allPets.find((p) => p.id === this.selectedSellPetId);
    if (!pet) {
      alert('Pet selecionado inválido.');
      return;
    }

    const essenceMeta = this.getEssenceMetaForRace(pet.raceCode);
    const rewardRules = this.bootstrapData?.rewardRules || { F: 15, D: 35, C: 60, B: 150, A: 350, S: 800, SS: 1750 };
    const rewardQty = rewardRules[pet.rarityTier] || 15;
    const eqCount = Object.keys(pet.equippedItemsJson || {}).length;

    const confirmMsg = `Deseja realmente vender o pet "${pet.nickname}" (Rank ${pet.rarityTier})?\n\n` +
      `🎁 Você receberá: +${rewardQty}x ${essenceMeta?.namePtBr || 'Essência'}\n` +
      (eqCount > 0 ? `📦 ${eqCount} equipamento(s) serão devolvidos à sua mochila.\n` : '') +
      `\nEsta ação não poderá ser desfeita.`;

    if (!confirm(confirmMsg)) return;

    const btn = document.getElementById('btnHunterSell');
    if (btn) btn.disabled = true;

    try {
      const res = await this.client.api(
        `/api/play/characters/${this.client.activeChar.id}/hunter-sell-pet`,
        {
          method: 'POST',
          body: JSON.stringify({ characterPetId: pet.id }),
        }
      );

      if (res?.success) {
        // Atualiza os dados de pets no cliente
        if (res.petsPayload && this.client.petsPayload) {
          this.client.petsPayload = res.petsPayload;
          if (window.PlayPetsController && typeof window.PlayPetsController.renderPetsModalContent === 'function') {
            window.PlayPetsController.renderPetsModalContent(this.client);
          }
        }

        // Atualiza a quantia de essências no bootstrap local
        if (res.updatedPlayerEssences && this.bootstrapData) {
          this.bootstrapData.playerEssences = res.updatedPlayerEssences;
          for (const r of this.bootstrapData.races || []) {
            r.playerQuantity = res.updatedPlayerEssences[r.itemCode] || 0;
          }
        }

        this.selectedSellPetId = null;
        this.renderRaces();
        this.renderRarities();
        this.renderSell();

        // Se a mochila estiver aberta, atualiza ela
        if (window.PlayInventoryController && typeof window.PlayInventoryController.refreshBag === 'function') {
          window.PlayInventoryController.refreshBag();
        }

        this.showSellSuccessCard(res);
      }
    } catch (err) {
      alert(`Falha ao vender pet: ${err.message}`);
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  showSellSuccessCard(data) {
    const modal = document.getElementById('hunterSuccessModal');
    const details = document.getElementById('hunterSuccessDetails');
    if (!modal || !details) return;

    const r = data.reward || {};
    details.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:center; gap:8px; margin-bottom:8px;">
        <span style="font-size:1.4rem;">♻️</span>
        <strong style="font-size:1.1rem; color:#4ade80;">Pet Reciclado com Sucesso!</strong>
      </div>
      <div style="font-size:0.8rem; color:#cbd5e1; display:flex; flex-direction:column; gap:6px;">
        <div>🐾 <strong>Pet Entregue:</strong> <span style="color:#f8fafc; font-weight:700;">${data.soldPet?.nickname || 'Pet'}</span> (Rank ${data.soldPet?.rarityTier})</div>
        <div style="color:#86efac; font-weight:800;">🎁 <strong>Recompensa Recebida:</strong> +${(r.essenceAmount || 0).toLocaleString('pt-BR')}x ${r.namePtBr || 'Essências'}</div>
        ${data.returnedEquipmentsCount > 0 ? `<div style="color:#fbbf24;">📦 <strong>Equipamentos Devolvidos:</strong> ${data.returnedEquipmentsCount} item(ns) enviados para a sua mochila!</div>` : ''}
      </div>
    `;

    modal.style.display = 'flex';
  },
};

window.PlayHunterController = PlayHunterController;
