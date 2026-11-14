/**
 * @file apps/server/public/admin/js/AdminItemContainerPanel.js
 * @module @etheria/server
 * @description Submódulo visual para a configuração de Itens Baús/Cápsulas (`OPEN_CHEST`)
 *   e Roleta da Sorte (`ROULETTE`) no Estúdio de Itens (`/admin` -> `📦 Tabela de Itens`).
 *   - Permite adicionar múltiplos itens (consumíveis ou equipamentos de novato/geral) ao baú/roleta.
 *   - Configura porcentagem individual por item (Baú: independente 0.01% a 100%; Roleta: fatias somando até 100%).
 *   - Configura quantidade mínima e máxima (ou fixa) de cada item sorteado.
 *   - Oferece barra de progresso visual em tempo real de 100% para Roletas com botões de auto-balanceamento.
 *   - Fornece botão de simulação/teste instantâneo do sorteio dentro do modal para pré-visualização.
 */

class AdminItemContainerPanel {
  static getContainerBuilderHtml() {
    return `
      <!-- BLOCO 2.5: CONFIGURADOR DE CONTEÚDO DE BAÚ / CÁPSULA / ROLETA -->
      <div id="itemContainerConfigSection" style="display:none; background:rgba(15,23,42,0.85); border:1.5px solid #eab308; border-radius:10px; padding:12px; margin-bottom:12px;">
        <!-- Cabeçalho Dinâmico -->
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; border-bottom:1px solid #334155; padding-bottom:8px; margin-bottom:10px;">
          <div>
            <div id="containerSectionTitle" style="font-size:0.84rem; font-weight:800; color:#fde047;">
              🎁 2.5 Configuração de Recompensas do Baú / Cápsula
            </div>
            <div id="containerSectionDesc" style="font-size:0.72rem; color:#94a3b8;">
              Configure os itens entregues ao abrir, com chance percentual e quantidade (mínima e máxima) de cada um.
            </div>
          </div>
          <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
            <button type="button" class="btn-primary" onclick="AdminApp.simulateContainerRoll()" style="padding:4px 10px; font-size:0.74rem; background:#0284c7; color:#fff; border:1px solid #38bdf8; border-radius:6px; cursor:pointer;">
              🎲 Testar Sorteio (Simulação)
            </button>
            <button type="button" class="btn-success" onclick="AdminApp.addContainerEntry()" style="padding:4px 10px; font-size:0.74rem; font-weight:700;">
              ➕ Adicionar Item
            </button>
          </div>
        </div>

        <!-- Parâmetros Globais do Container -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:10px; background:#020617; border:1px solid #1e293b; border-radius:8px; padding:10px; margin-bottom:10px;">
          <div class="field" id="containerSubtypeField">
            <label style="color:#fde047; font-weight:700; font-size:0.72rem;">🏷️ Estilo Visual do Contêiner</label>
            <select id="containerSubtypeSelect" onchange="AdminApp.onContainerSubtypeChanged()">
              <option value="CHEST">📦 Baú de Tesouro</option>
              <option value="CAPSULE">💊 Cápsula Mágica</option>
            </select>
          </div>

          <div class="field" id="containerRollCountField" style="display:none;">
            <label style="color:#38bdf8; font-weight:700; font-size:0.72rem;">🎰 Nº de Prêmios / Giros por Uso</label>
            <input type="number" id="containerRollCountInput" value="1" min="1" max="10" />
          </div>

          <div class="field">
            <label style="color:#fde047; font-size:0.72rem;">🪙 Ouro Bônus Mínimo (Opcional)</label>
            <input type="number" id="containerGoldMinInput" value="0" min="0" />
          </div>

          <div class="field">
            <label style="color:#fde047; font-size:0.72rem;">🪙 Ouro Bônus Máximo (Opcional)</label>
            <input type="number" id="containerGoldMaxInput" value="0" min="0" />
          </div>
        </div>

        <!-- Barra de Progresso de 100% (Exclusiva para Roleta) -->
        <div id="rouletteChanceProgressBarWrapper" style="display:none; background:#020617; border:1px solid #334155; border-radius:8px; padding:10px; margin-bottom:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px; margin-bottom:6px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:0.74rem; font-weight:700; color:#cbd5e1;">📊 Soma das Fatias da Roleta:</span>
              <strong id="rouletteChanceTotalBadge" style="font-size:0.86rem; font-family:monospace; color:#4ade80;">100.0%</strong>
              <span id="rouletteStatusBadge" style="font-size:0.70rem; padding:2px 8px; border-radius:99px; background:#16a34a; color:#fff; font-weight:700;">✅ Válido (100%)</span>
            </div>
            <div style="display:flex; gap:6px;">
              <button type="button" onclick="AdminApp.distributeRouletteEqually()" style="padding:3px 8px; font-size:0.70rem; background:#1e293b; color:#38bdf8; border:1px solid #38bdf8; border-radius:4px; cursor:pointer;">
                ⚖️ Distribuir Igualmente
              </button>
              <button type="button" onclick="AdminApp.normalizeRouletteTo100()" style="padding:3px 8px; font-size:0.70rem; background:#1e293b; color:#4ade80; border:1px solid #4ade80; border-radius:4px; cursor:pointer;">
                🔄 Normalizar para 100%
              </button>
            </div>
          </div>
          <div style="width:100%; height:10px; background:#1e293b; border-radius:99px; overflow:hidden; border:1px solid #334155;">
            <div id="rouletteChanceProgressBar" style="width:100%; height:100%; background:#22c55e; transition:all 0.2s ease;"></div>
          </div>
        </div>

        <!-- Grade com os Itens do Baú / Roleta -->
        <div id="containerEntriesList" style="display:flex; flex-direction:column; gap:8px;"></div>

        <!-- Caixa de Resultado da Simulação -->
        <div id="containerSimulationResultBox" style="display:none; margin-top:10px; background:#020617; border:1px dashed #38bdf8; border-radius:8px; padding:10px;"></div>
      </div>
    `;
  }

  static attach(app) {
    app.editingContainerEntries = [];

    /**
     * Retorna lista unificada de todos os itens cadastrados no jogo (itens comuns + equipamentos).
     */
    app.getAllCandidateRewardItems = function () {
      const items = (this.itemTemplates || []).map((i) => ({
        id: Number(i.id),
        namePtBr: i.namePtBr || i.code,
        code: i.code,
        category: i.itemCategory || 'CONSUMABLE',
        rarityTier: i.rarityTier || 'COMMON',
        iconUrl: i.iconUrl || `https://seytanir.github.io/mcrework/${(i.mcreworkIconKey || '').replace(/^\/+/, '')}`,
        isEquip: false,
      }));

      const equips = (this.equipmentTemplates || []).map((e) => ({
        id: Number(e.id),
        namePtBr: e.namePtBr || e.code,
        code: e.code,
        category: `EQUIP (${e.equipmentSlotCode || 'GERAL'})`,
        rarityTier: e.rarityTier || 'COMMON',
        iconUrl: e.iconUrl || `https://seytanir.github.io/mcrework/${(e.mcreworkIconKey || '').replace(/^\/+/, '')}`,
        isEquip: true,
      }));

      return [...items, ...equips].sort((a, b) => a.id - b.id);
    };

    /**
     * Alterna a visibilidade do bloco configurador quando o tipo de efeito é Baú ou Roleta.
     */
    app.onContainerEffectTypeChanged = function () {
      const eff = document.getElementById('itemEffectSelect')?.value || 'NONE';
      const sec = document.getElementById('itemContainerConfigSection');
      if (!sec) return;

      const isContainer = eff === 'OPEN_CHEST' || eff === 'ROULETTE';
      sec.style.display = isContainer ? 'block' : 'none';

      if (!isContainer) return;

      const isRoulette = eff === 'ROULETTE';
      const titleEl = document.getElementById('containerSectionTitle');
      const descEl = document.getElementById('containerSectionDesc');
      const subtypeField = document.getElementById('containerSubtypeField');
      const rollCountField = document.getElementById('containerRollCountField');
      const progWrapper = document.getElementById('rouletteChanceProgressBarWrapper');

      if (isRoulette) {
        if (titleEl) titleEl.textContent = '🎰 2.5 Configuração da Roleta da Sorte (Sorteio Ponderado)';
        if (descEl) descEl.textContent = 'Cada item representa uma fatia da roleta. O total das chances deve somar até 100%.';
        if (subtypeField) subtypeField.style.display = 'none';
        if (rollCountField) rollCountField.style.display = 'block';
        if (progWrapper) progWrapper.style.display = 'block';
      } else {
        if (titleEl) titleEl.textContent = '🎁 2.5 Configuração de Recompensas do Baú / Cápsula';
        if (descEl) descEl.textContent = 'Cada item configurado possui sua chance percentual independente de sair (ex: 50% de 1 a 3 gemas, 100% de 1 arma).';
        if (subtypeField) subtypeField.style.display = 'block';
        if (rollCountField) rollCountField.style.display = 'none';
        if (progWrapper) progWrapper.style.display = 'none';
      }

      if (this.editingContainerEntries.length === 0) {
        this.addContainerEntry();
      } else {
        this.renderContainerEntries();
      }
    };

    app.onContainerSubtypeChanged = function () {
      const st = document.getElementById('containerSubtypeSelect')?.value || 'CHEST';
      const titleEl = document.getElementById('containerSectionTitle');
      if (titleEl && document.getElementById('itemEffectSelect')?.value === 'OPEN_CHEST') {
        titleEl.textContent = st === 'CAPSULE'
          ? '💊 2.5 Configuração de Recompensas da Cápsula Mágica'
          : '🎁 2.5 Configuração de Recompensas do Baú de Tesouro';
      }
    };

    /**
     * Adiciona um novo item de recompensa ao baú / roleta.
     */
    app.addContainerEntry = function (itemTemplateId = null, chancePct = 100, minQty = 1, maxQty = 1) {
      const allItems = this.getAllCandidateRewardItems();
      const defaultId = itemTemplateId || allItems[0]?.id || 1;
      const isRoulette = document.getElementById('itemEffectSelect')?.value === 'ROULETTE';

      let initialChance = chancePct;
      if (isRoulette && (!chancePct || chancePct === 100)) {
        const currentSum = (this.editingContainerEntries || []).reduce((acc, e) => acc + (Number(e.chancePct) || 0), 0);
        const rem = Math.max(0, 100 - currentSum);
        initialChance = rem > 0 ? Number(rem.toFixed(2)) : 10;
      }

      this.editingContainerEntries.push({
        itemTemplateId: Number(defaultId),
        chancePct: Math.max(0.01, Math.min(100, Number(initialChance) || 10)),
        minQty: Math.max(1, Math.round(Number(minQty) || 1)),
        maxQty: Math.max(Math.max(1, Math.round(Number(minQty) || 1)), Math.round(Number(maxQty) || 1)),
      });

      this.renderContainerEntries();
    };

    app.removeContainerEntry = function (idx) {
      this.editingContainerEntries.splice(idx, 1);
      this.renderContainerEntries();
    };

    app.updateContainerEntryField = function (idx, field, val, isNum = false) {
      const entry = this.editingContainerEntries[idx];
      if (!entry) return;
      if (isNum) {
        entry[field] = Math.max(0, Number(val) || 0);
        if (field === 'minQty' && entry.maxQty < entry.minQty) {
          entry.maxQty = entry.minQty;
        }
        if (field === 'maxQty' && entry.maxQty < entry.minQty) {
          entry.minQty = entry.maxQty;
        }
      } else {
        entry[field] = val;
      }
      this.updateRouletteProgressState();
    };

    /**
     * Distribui 100% igualmente entre todos os itens da roleta.
     */
    app.distributeRouletteEqually = function () {
      const len = this.editingContainerEntries.length;
      if (len <= 0) return;
      const share = Number((100 / len).toFixed(2));
      let sum = 0;
      this.editingContainerEntries.forEach((e, idx) => {
        if (idx === len - 1) {
          e.chancePct = Number((100 - sum).toFixed(2));
        } else {
          e.chancePct = share;
          sum += share;
        }
      });
      this.renderContainerEntries();
    };

    /**
     * Normaliza as chances proporcionalmente para somar exatamente 100%.
     */
    app.normalizeRouletteTo100 = function () {
      const len = this.editingContainerEntries.length;
      if (len <= 0) return;
      const currentSum = this.editingContainerEntries.reduce((acc, e) => acc + (Number(e.chancePct) || 0), 0);
      if (currentSum <= 0) {
        this.distributeRouletteEqually();
        return;
      }
      let acc = 0;
      this.editingContainerEntries.forEach((e, idx) => {
        if (idx === len - 1) {
          e.chancePct = Math.max(0.01, Number((100 - acc).toFixed(2)));
        } else {
          const normalized = Number(((e.chancePct / currentSum) * 100).toFixed(2));
          e.chancePct = normalized;
          acc += normalized;
        }
      });
      this.renderContainerEntries();
    };

    /**
     * Atualiza a barra de status e badge da Roleta.
     */
    app.updateRouletteProgressState = function () {
      const eff = document.getElementById('itemEffectSelect')?.value || 'NONE';
      if (eff !== 'ROULETTE') return;

      const sum = (this.editingContainerEntries || []).reduce((acc, e) => acc + (Number(e.chancePct) || 0), 0);
      const rounded = Number(sum.toFixed(2));

      const badge = document.getElementById('rouletteChanceTotalBadge');
      const stBadge = document.getElementById('rouletteStatusBadge');
      const bar = document.getElementById('rouletteChanceProgressBar');

      if (badge) badge.textContent = `${rounded}%`;
      if (bar) {
        bar.style.width = `${Math.min(100, rounded)}%`;
        if (rounded === 100) {
          bar.style.background = '#22c55e';
        } else if (rounded < 100) {
          bar.style.background = '#eab308';
        } else {
          bar.style.background = '#ef4444';
        }
      }

      if (stBadge) {
        if (rounded === 100) {
          stBadge.style.background = '#16a34a';
          stBadge.style.color = '#fff';
          stBadge.textContent = '✅ Válido (100% Exato)';
        } else if (rounded < 100) {
          stBadge.style.background = '#ca8a04';
          stBadge.style.color = '#fff';
          stBadge.textContent = `⚠️ Falta ${(100 - rounded).toFixed(2)}% para completar 100%`;
        } else {
          stBadge.style.background = '#dc2626';
          stBadge.style.color = '#fff';
          stBadge.textContent = `🚫 Excedeu 100% (+${(rounded - 100).toFixed(2)}%)`;
        }
      }
    };

    /**
     * Renderiza a lista de itens configurados no baú / roleta.
     */
    app.renderContainerEntries = function () {
      const listEl = document.getElementById('containerEntriesList');
      if (!listEl) return;

      const eff = document.getElementById('itemEffectSelect')?.value || 'NONE';
      const isRoulette = eff === 'ROULETTE';
      const allItems = this.getAllCandidateRewardItems();

      if (!this.editingContainerEntries || this.editingContainerEntries.length === 0) {
        listEl.innerHTML = `
          <div style="padding:16px; text-align:center; color:#94a3b8; border:1px dashed #334155; border-radius:8px; font-size:0.75rem;">
            Nenhum item configurado no contêiner. Clique em <strong>➕ Adicionar Item</strong> acima!
          </div>`;
        this.updateRouletteProgressState();
        return;
      }

      listEl.innerHTML = this.editingContainerEntries
        .map((entry, idx) => {
          const itemOpts = allItems
            .map((it) => {
              const sel = Number(it.id) === Number(entry.itemTemplateId) ? 'selected' : '';
              return `<option value="${it.id}" ${sel}>${it.isEquip ? '⚔️' : '📦'} #${it.id} ${it.namePtBr} (${it.rarityTier} • ${it.category})</option>`;
            })
            .join('');

          const selectedItem = allItems.find((it) => Number(it.id) === Number(entry.itemTemplateId)) || allItems[0];
          const iconUrl = selectedItem?.iconUrl || '';

          return `
            <div style="background:#020617; border:1px solid #334155; border-radius:8px; padding:10px; display:grid; grid-template-columns:auto 1.8fr 1fr 1fr 1fr auto; gap:8px; align-items:end;">
              <div>
                <img src="${iconUrl}" style="width:34px; height:34px; object-fit:contain; border-radius:6px; background:#0f172a; border:1px solid #1e293b;" />
              </div>
              <div>
                <label style="font-size:0.70rem; color:#7dd3fc; font-weight:700;">🎁 Item da Recompensa</label>
                <select onchange="AdminApp.updateContainerEntryField(${idx}, 'itemTemplateId', this.value, true); AdminApp.renderContainerEntries();" style="width:100%; font-size:0.75rem;">
                  ${itemOpts}
                </select>
              </div>
              <div>
                <label style="font-size:0.70rem; color:${isRoulette ? '#c084fc' : '#86efac'}; font-weight:700;">
                  ${isRoulette ? '🎰 Fatia (%)' : '🎯 Chance (%)'}
                </label>
                <input type="number" min="0.01" max="100" step="0.5" value="${entry.chancePct}"
                  oninput="AdminApp.updateContainerEntryField(${idx}, 'chancePct', this.value, true)"
                  style="width:100%; font-size:0.75rem;" />
              </div>
              <div>
                <label style="font-size:0.70rem; color:#fde047;">Qtd Mínima</label>
                <input type="number" min="1" max="9999" value="${entry.minQty || 1}"
                  oninput="AdminApp.updateContainerEntryField(${idx}, 'minQty', this.value, true)"
                  style="width:100%; font-size:0.75rem;" />
              </div>
              <div>
                <label style="font-size:0.70rem; color:#fde047;">Qtd Máxima</label>
                <input type="number" min="1" max="9999" value="${entry.maxQty || entry.minQty || 1}"
                  oninput="AdminApp.updateContainerEntryField(${idx}, 'maxQty', this.value, true)"
                  style="width:100%; font-size:0.75rem;" />
              </div>
              <div>
                <button type="button" class="btn-danger" onclick="AdminApp.removeContainerEntry(${idx})" style="padding:6px 10px; font-size:0.75rem;" title="Remover item">
                  🗑️
                </button>
              </div>
            </div>`;
        })
        .join('');

      this.updateRouletteProgressState();
    };

    /**
     * Simula o sorteio instantâneo do contêiner para o admin testar e validar o balanceamento.
     */
    app.simulateContainerRoll = function () {
      const resBox = document.getElementById('containerSimulationResultBox');
      if (!resBox) return;

      const eff = document.getElementById('itemEffectSelect')?.value || 'NONE';
      const isRoulette = eff === 'ROULETTE';
      const allItems = this.getAllCandidateRewardItems();
      const entries = this.editingContainerEntries || [];

      if (entries.length === 0) {
        alert('Adicione pelo menos 1 item antes de testar a simulação.');
        return;
      }

      const results = [];
      if (isRoulette) {
        const rollCount = Math.max(1, Math.min(10, Math.round(Number(document.getElementById('containerRollCountInput')?.value) || 1)));
        const totalChance = entries.reduce((acc, e) => acc + (Number(e.chancePct) || 0), 0);

        for (let r = 0; r < rollCount; r++) {
          const rng = Math.random() * (totalChance > 0 ? totalChance : 100);
          let cumulative = 0;
          let picked = entries[0];
          for (const e of entries) {
            cumulative += Number(e.chancePct) || 0;
            if (rng <= cumulative) {
              picked = e;
              break;
            }
          }
          const minQ = Math.max(1, Number(picked.minQty) || 1);
          const maxQ = Math.max(minQ, Number(picked.maxQty) || minQ);
          const qty = minQ + Math.floor(Math.random() * (maxQ - minQ + 1));
          const it = allItems.find((i) => Number(i.id) === Number(picked.itemTemplateId));
          results.push({ item: it, qty, chancePct: picked.chancePct, type: 'ROULETTE' });
        }
      } else {
        for (const e of entries) {
          const roll = Math.random() * 100;
          if (e.chancePct >= 100 || roll <= e.chancePct) {
            const minQ = Math.max(1, Number(e.minQty) || 1);
            const maxQ = Math.max(minQ, Number(e.maxQty) || minQ);
            const qty = minQ + Math.floor(Math.random() * (maxQ - minQ + 1));
            const it = allItems.find((i) => Number(i.id) === Number(e.itemTemplateId));
            results.push({ item: it, qty, chancePct: e.chancePct, type: 'CHEST' });
          }
        }
      }

      const goldMin = Math.max(0, Number(document.getElementById('containerGoldMinInput')?.value) || 0);
      const goldMax = Math.max(goldMin, Number(document.getElementById('containerGoldMaxInput')?.value) || goldMin);
      let rolledGold = 0;
      if (goldMax > 0) {
        rolledGold = goldMin + Math.floor(Math.random() * (goldMax - goldMin + 1));
      }

      resBox.style.display = 'block';
      resBox.innerHTML = `
        <div style="font-size:0.75rem; font-weight:800; color:#38bdf8; margin-bottom:6px;">
          🎲 Resultado da Simulação do Sorteio (${results.length} itens ganhos):
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:8px;">
          ${
            results.length
              ? results
                  .map(
                    (res) => `
                <div style="display:flex; align-items:center; gap:6px; background:#0f172a; border:1px solid #38bdf8; border-radius:6px; padding:4px 8px; font-size:0.75rem;">
                  <img src="${res.item?.iconUrl || ''}" style="width:24px; height:24px; object-fit:contain;" />
                  <strong style="color:#fde047;">x${res.qty}</strong>
                  <span style="color:#f8fafc;">${res.item?.namePtBr || 'Item'}</span>
                  <span style="color:#94a3b8; font-size:0.68rem;">(${res.chancePct}%)</span>
                </div>`
                  )
                  .join('')
              : '<span style="color:#f87171; font-size:0.75rem;">Nenhum item saiu nesta simulação (chances baixas não passaram).</span>'
          }
          ${
            rolledGold > 0
              ? `<div style="display:flex; align-items:center; gap:6px; background:#0f172a; border:1px solid #eab308; border-radius:6px; padding:4px 8px; font-size:0.75rem;">
                  <strong style="color:#fde047;">🪙 +${rolledGold.toLocaleString('pt-BR')} Ouro</strong>
                </div>`
              : ''
          }
        </div>
      `;
    };

    /**
     * Carrega a configuração do contêiner de um ItemTemplate para o formulário.
     */
    app.loadContainerConfigIntoForm = function (item) {
      const eff = item?.effectType || 'NONE';
      const spec = (item?.specialEffectJson || {}) as any;

      if (document.getElementById('containerSubtypeSelect')) {
        document.getElementById('containerSubtypeSelect').value = spec.containerType === 'CAPSULE' ? 'CAPSULE' : 'CHEST';
      }
      if (document.getElementById('containerRollCountInput')) {
        document.getElementById('containerRollCountInput').value = String(spec.rollCount || 1);
      }
      if (document.getElementById('containerGoldMinInput')) {
        document.getElementById('containerGoldMinInput').value = String(spec.bonusGoldMin || 0);
      }
      if (document.getElementById('containerGoldMaxInput')) {
        document.getElementById('containerGoldMaxInput').value = String(spec.bonusGoldMax || 0);
      }

      const rawEntries = Array.isArray(spec.entries) ? spec.entries : [];
      this.editingContainerEntries = rawEntries.map((e) => ({
        itemTemplateId: Number(e.itemTemplateId) || 1,
        chancePct: Math.max(0.01, Math.min(100, Number(e.chancePct) || 100)),
        minQty: Math.max(1, Math.round(Number(e.minQty ?? e.quantity ?? 1) || 1)),
        maxQty: Math.max(
          Math.max(1, Math.round(Number(e.minQty ?? e.quantity ?? 1) || 1)),
          Math.round(Number(e.maxQty ?? e.quantity ?? 1) || 1)
        ),
      }));

      const resBox = document.getElementById('containerSimulationResultBox');
      if (resBox) resBox.style.display = 'none';

      this.onContainerEffectTypeChanged();
    };

    /**
     * Monta o DTO de specialEffectJson para salvar no PostgreSQL.
     */
    app.buildContainerConfigDtoFromForm = function () {
      const eff = document.getElementById('itemEffectSelect')?.value || 'NONE';
      if (eff !== 'OPEN_CHEST' && eff !== 'ROULETTE') {
        return {};
      }

      const isRoulette = eff === 'ROULETTE';
      const containerType = isRoulette
        ? 'ROULETTE'
        : document.getElementById('containerSubtypeSelect')?.value === 'CAPSULE'
        ? 'CAPSULE'
        : 'CHEST';

      const rollCount = isRoulette
        ? Math.max(1, Math.min(10, Math.round(Number(document.getElementById('containerRollCountInput')?.value) || 1)))
        : 1;

      const bonusGoldMin = Math.max(0, Math.round(Number(document.getElementById('containerGoldMinInput')?.value) || 0));
      const bonusGoldMax = Math.max(
        bonusGoldMin,
        Math.round(Number(document.getElementById('containerGoldMaxInput')?.value) || bonusGoldMin)
      );

      const cleanEntries = (this.editingContainerEntries || [])
        .map((e) => ({
          itemTemplateId: Number(e.itemTemplateId) || 1,
          chancePct: Math.max(0.01, Math.min(100, Number(e.chancePct) || 0)),
          minQty: Math.max(1, Math.round(Number(e.minQty) || 1)),
          maxQty: Math.max(
            Math.max(1, Math.round(Number(e.minQty) || 1)),
            Math.round(Number(e.maxQty) || 1)
          ),
        }))
        .filter((e) => e.itemTemplateId > 0 && e.chancePct > 0);

      if (isRoulette) {
        const total = cleanEntries.reduce((acc, e) => acc + e.chancePct, 0);
        if (total > 100.01) {
          throw new Error(`A soma das porcentagens da roleta não pode ultrapassar 100% (atual: ${total.toFixed(2)}%). Por favor, reduza ou clique em "⚖️ Distribuir Igualmente".`);
        }
      }

      return {
        containerType,
        rollCount,
        bonusGoldMin,
        bonusGoldMax,
        entries: cleanEntries,
      };
    };

    /**
     * Rótulo descritivo na tabela de itens.
     */
    app.formatContainerLabel = function (item) {
      if (item.effectType === 'ROULETTE') {
        const spec = (item.specialEffectJson || {}) as any;
        const entries = Array.isArray(spec.entries) ? spec.entries : [];
        const total = entries.reduce((acc: number, e: any) => acc + (Number(e.chancePct) || 0), 0);
        return `🎰 Roleta (${entries.length} fatias • ${total.toFixed(1)}% total)`;
      }
      if (item.effectType === 'OPEN_CHEST') {
        const spec = (item.specialEffectJson || {}) as any;
        const entries = Array.isArray(spec.entries) ? spec.entries : [];
        const label = spec.containerType === 'CAPSULE' ? '💊 Cápsula' : '🎁 Baú';
        return `${label} (${entries.length} itens configurados)`;
      }
      return null;
    };
  }
}

window.AdminItemContainerPanel = AdminItemContainerPanel;
