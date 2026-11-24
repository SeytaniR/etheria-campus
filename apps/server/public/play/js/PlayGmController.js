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
      window.PlayGmSandboxPanel?.init(this);
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
        await this.loadMapIntoWorld(res.currentMapId, res.posX, res.posY, null, { keepFlight: true });
      } catch (err) {
        if (String(err?.message || '').includes('no chão')) this.showNotification?.(`🦅 ${err.message}`, 'warning');
        else alert(`Erro no Teleporte GM: ${err.message}`);
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

    const CHARACTER_EQUIP_SLOTS = [
      { code: 'HEAD', label: 'Elmo', icon: '🧢', col: 'left' },
      { code: 'SHOULDER', label: 'Ombros', icon: '🛡️', col: 'left' },
      { code: 'CHEST', label: 'Peitoral', icon: '🥋', col: 'left' },
      { code: 'BELT', label: 'Cinto', icon: '🎗️', col: 'left' },
      { code: 'LEGS', label: 'Calças', icon: '👖', col: 'left' },
      { code: 'FEET', label: 'Botas', icon: '👢', col: 'left' },
      { code: 'WEAPON_1', label: 'Arma 1', icon: '⚔️', col: 'right' },
      { code: 'WEAPON_2', label: 'Arma 2', icon: '📖', col: 'right' },
      { code: 'NECKLACE', label: 'Colar', icon: '📿', col: 'right' },
      { code: 'RING', label: 'Anel', icon: '💍', col: 'right' },
      { code: 'ORNAMENT_1', label: 'Amuleto', icon: '🔮', col: 'right' },
      { code: 'ORNAMENT_2', label: 'Talismã', icon: '🧿', col: 'right' },
      { code: 'WINGS', label: 'Asas', icon: '🪽', col: 'center' },
      { code: 'FLYING_MOUNT', label: 'Montaria', icon: '🦅', col: 'center' },
    ];

    client.openStatsModal = async function (initialTab) {
      if (!this.activeChar) return;
      if (initialTab) this._statsModalTab = initialTab;
      else if (!this._statsModalTab) this._statsModalTab = 'equip';

      this._statsModalState = this._statsModalState || {
        pendingAllocations: { VIT: 0, STR: 0, INT: 0, WIS: 0, AGI: 0, DEX: 0 },
        isConfirmingSave: false,
        isSaving: false,
      };

      try {
        this._equippedDetails = await this.api(`/api/play/characters/${this.activeChar.id}/equipment`);
      } catch (err) {
        console.warn('Erro ao carregar equipamentos:', err);
      }

      this.renderStatsModalView();
      const modal = document.getElementById('statsModal');
      if (modal) modal.style.display = 'flex';
    };

    client.closeStatsModal = function () {
      const modal = document.getElementById('statsModal');
      if (modal) modal.style.display = 'none';
      this._statsModalState = null;
    };

    client.switchStatsModalTab = function (tabName) {
      this._statsModalTab = tabName;
      this.renderStatsModalView();
    };

    client.selectEquipSlot = function (slotCode) {
      this._selectedEquipSlot = (this._selectedEquipSlot === slotCode ? null : slotCode);
      this.renderStatsModalView();
    };

    client.selectSkill = function (skillId) {
      this._selectedSkillId = Number(skillId);
      this.renderStatsModalView();
    };

    client._executeUnequipSlot = async function (slotCode) {
      if (!this.activeChar) return;
      try {
        const res = await this.api(`/api/play/characters/${this.activeChar.id}/equipment/unequip`, {
          method: 'POST',
          body: JSON.stringify({ slotCode }),
        });
        if (res?.visualAppearance) {
          window.PlayFlightAndWingsController?.syncVisualAppearance(this, res.visualAppearance);
        }
        this.showNotification?.(`Item do slot ${slotCode} desequipado!`, 'info');
        this._equippedDetails = await this.api(`/api/play/characters/${this.activeChar.id}/equipment`);
        this._selectedEquipSlot = null;
        this.renderStatsModalView();
        if (document.getElementById('bagModal')?.style.display === 'flex') {
          await PlayBagController.loadBag();
        }
      } catch (err) {
        alert(`Erro ao desequipar: ${err.message}`);
      }
    };

    client.unequipCharacterSlot = async function (slotCode) {
      if (!this.activeChar) return;
      if (slotCode === 'FLYING_MOUNT' && (this.isFlying || (this.flightAltitudeCurrent || 0) > 0.5)) {
        this.showNotification?.('🦅 Você precisa pousar no chão antes de desequipar sua Montaria Voadora!', 'warning');
        return;
      }
      await this._executeUnequipSlot(slotCode);
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

      const activeTab = this._statsModalTab || 'equip';
      const equippedSlots = this._equippedDetails?.slots || [];
      const equipMap = {};
      for (const s of equippedSlots) {
        if (s.item) equipMap[s.slotCode] = s.item;
      }
      const equippedCount = Object.keys(equipMap).length;

      const el = this.getElementStyle(c.elementCode);
      const modalBody = document.getElementById('statsModalBody');
      if (!modalBody) return;

      const allSkills = Array.isArray(this.skillTemplates) ? this.skillTemplates : [];
      const charSkillIds = Array.isArray(c.skillIdsJson) ? c.skillIdsJson.map(Number) : [];
      let charSkills = allSkills.filter((sk) => charSkillIds.includes(Number(sk.id)));
      if (charSkills.length === 0 && allSkills.length > 0) {
        charSkills = allSkills.slice(0, 4);
      }
      if (!this._selectedSkillId && charSkills.length > 0) {
        this._selectedSkillId = charSkills[0].id;
      }

      // 1. Renderizador da Aba de Equipamentos (Paperdoll de 14 Slots)
      const renderEquipTabContent = () => {
        const leftDefs = CHARACTER_EQUIP_SLOTS.filter((s) => s.col === 'left');
        const rightDefs = CHARACTER_EQUIP_SLOTS.filter((s) => s.col === 'right');
        const centerDefs = CHARACTER_EQUIP_SLOTS.filter((s) => s.col === 'center');
        const rarityMap = window.PlayBagController?.RARITY_MAP || {};

        const renderSlotBox = (s) => {
          const it = equipMap[s.code];
          const hasItem = Boolean(it);
          const isSelected = this._selectedEquipSlot === s.code;
          const rar = it ? (rarityMap[String(it.rarityTier || '').toUpperCase()] || rarityMap.F || {}) : null;
          const borderStyle = rar ? (rar.isCosmic ? 'border:1.5px solid #000; box-shadow:0 0 8px #000;' : `border:1.5px solid ${rar.border}; box-shadow:0 0 6px ${rar.glow};`) : 'border:1px dashed #334155;';
          const badgeTxt = s.code === 'FLYING_MOUNT' ? 'VOO' : (s.code === 'WINGS' ? 'ASA' : s.code.slice(0, 3));

          return `
            <div class="stats-slot-box ${isSelected ? 'selected' : ''}" onclick="PlayApp.selectEquipSlot('${s.code}')" style="${borderStyle}" title="${s.label} (${s.code}): ${hasItem ? it.namePtBr : 'Vazio'}">
              ${hasItem ? `<img src="${it.iconUrl || ''}" style="width:82%; height:82%; object-fit:contain;" />` : `<span style="font-size:1.1rem; opacity:0.35;">${s.icon}</span>`}
              <span class="stats-slot-code">${badgeTxt}</span>
            </div>
          `;
        };

        const selectedSlot = this._selectedEquipSlot ? CHARACTER_EQUIP_SLOTS.find((s) => s.code === this._selectedEquipSlot) : null;
        const selectedItem = selectedSlot ? equipMap[selectedSlot.code] : null;
        const selectedCombatStats = selectedItem ? (selectedItem.combatStatBonuses || selectedItem.baseCombatAttributesJson || {}) : {};
        const selectedBaseStats = selectedItem ? (selectedItem.baseAttributesJson || {}) : {};

        const activeSets = this._equippedDetails?.activeSetBonuses || [];

        return `
          <!-- Grid em 2 Colunas para Equipamentos -->
          <div class="stats-main-grid">
            <!-- Coluna 1: Paperdoll dos 14 Slots -->
            <div class="stats-section-box">
              <div class="stats-section-header">
                <h4 class="stats-section-title">🛡️ Paperdoll 14 Slots</h4>
                <span style="font-size:0.68rem; color:#86efac; font-weight:700;">${equippedCount}/14 Vestidos</span>
              </div>
              <div class="stats-paperdoll-container">
                <div class="stats-paperdoll-col">
                  ${leftDefs.map(renderSlotBox).join('')}
                </div>
                <div class="stats-paperdoll-center">
                  <img class="stats-paperdoll-avatar" src="${c.thumbUrl || '/play/assets/hud/menu_character.png'}" alt="${window.EtheriaSanitizer?.escapeHtml(c.name) || ''}" />
                  <span style="font-size:0.68rem; color:#fde047; font-weight:800; margin-top:4px;">${window.EtheriaSanitizer?.escapeHtml(c.name) || ''}</span>
                  <span style="font-size:0.60rem; color:#94a3b8;">${c.classNamePtBr || 'Herói'}</span>
                  <div class="stats-paperdoll-special-row">
                    ${centerDefs.map(renderSlotBox).join('')}
                  </div>
                </div>
                <div class="stats-paperdoll-col">
                  ${rightDefs.map(renderSlotBox).join('')}
                </div>
              </div>
            </div>

            <!-- Coluna 2: Inspeção do Slot & Bônus de Conjunto -->
            <div class="stats-section-box">
              <div class="stats-section-header">
                <h4 class="stats-section-title">🔍 Inspeção & Ações</h4>
                <span style="font-size:0.68rem; color:#38bdf8;">${selectedSlot ? `${selectedSlot.label} (${selectedSlot.code})` : 'Selecione um slot'}</span>
              </div>

              ${selectedSlot ? `
                <div class="stats-slot-detail-card">
                  ${selectedItem ? `
                    <div class="stats-slot-detail-header">
                      <div class="stats-slot-detail-info">
                        <img class="stats-slot-detail-icon" src="${selectedItem.iconUrl || ''}" alt="${selectedItem.namePtBr}" />
                        <div>
                          <div class="stats-slot-detail-name">${selectedItem.namePtBr}</div>
                          <div class="stats-slot-detail-sub">${selectedSlot.label} &bull; Rank ${selectedItem.rarityTier || 'F'}${selectedItem.equipmentSetNamePtBr ? ` &bull; <strong style="color:#fde047;">👑 ${selectedItem.equipmentSetNamePtBr}</strong>` : ''}</div>
                        </div>
                      </div>
                    </div>

                    ${(Object.keys(selectedBaseStats).length > 0 || Object.keys(selectedCombatStats).length > 0) ? `
                      <div class="stats-slot-detail-stats">
                        ${Object.entries(selectedBaseStats).map(([k, v]) => `<span class="stats-stat-badge">+${v} ${k}</span>`).join('')}
                        ${Object.entries(selectedCombatStats).map(([k, v]) => `<span class="stats-stat-badge" style="color:#38bdf8;">+${v} ${k}</span>`).join('')}
                      </div>
                    ` : ''}

                    <div style="display:flex; gap:6px; flex-wrap:wrap;">
                      ${selectedSlot.code === 'FLYING_MOUNT' ? `
                        <button type="button" class="btn-primary" style="flex:1; padding:6px 10px; font-size:0.74rem; font-weight:800; border-radius:6px; background:#0284c7;" onclick="PlayApp.closeStatsModal(); window.PlayFlightAndWingsController?.toggleFlight(PlayApp)">
                          ${this.isFlying ? '🪂 Pousar Montaria' : '🦅 Voar na Montaria'}
                        </button>
                      ` : ''}
                      <button type="button" class="stats-btn-unequip" style="flex:1;" onclick="PlayApp.unequipCharacterSlot('${selectedSlot.code}')">
                        Desequipar Item
                      </button>
                    </div>
                  ` : `
                    <div style="text-align:center; padding:12px; color:#94a3b8; font-size:0.75rem;">
                      O slot <strong>${selectedSlot.label} (${selectedSlot.code})</strong> está vazio.<br/>
                      <button type="button" class="btn-primary" style="margin-top:8px; padding:4px 10px; font-size:0.72rem;" onclick="PlayApp.openBagModal()">🎒 Abrir Mochila</button>
                    </div>
                  `}
                </div>
              ` : `
                <div style="text-align:center; padding:16px 10px; color:#64748b; font-size:0.74rem;">
                  💡 Toque em qualquer um dos 14 slots ao lado (incluindo Asas e Montaria Voadora) para inspecionar atributos ou desequipar.
                </div>
              `}

              <!-- Lista de Bônus de Conjuntos Ativos -->
              <div style="margin-top:4px;">
                <div style="font-size:0.74rem; font-weight:800; color:#fde047; margin-bottom:4px; display:flex; justify-content:space-between; align-items:center;">
                  <span>👑 Conjuntos Ativos (${activeSets.length})</span>
                  <span style="font-size:0.65rem; color:#86efac;">Arena Action</span>
                </div>
                ${activeSets.length > 0 ? `
                  <div class="stats-sets-list">
                    ${activeSets.map((sb) => {
                      const statsStr = Object.entries(sb.appliedStats || {}).map(([k, v]) => `+${v} ${k}`).join(', ');
                      return `
                        <div class="stats-set-item">
                          <div style="display:flex; justify-content:space-between; align-items:center;">
                            <strong style="color:#fde047;">${sb.namePtBr} (${sb.piecesEquipped}/${sb.totalPieces} Peças)</strong>
                            <span style="color:#4ade80; font-weight:800;">${sb.activationTier === 'FULL' ? '★ Full (100%)' : '★ Half (50%)'}</span>
                          </div>
                          <div style="color:#94a3b8; margin-top:2px; font-family:monospace; font-size:0.68rem;">${statsStr}</div>
                        </div>
                      `;
                    }).join('')}
                  </div>
                ` : `
                  <div style="font-size:0.68rem; color:#64748b; padding:6px; background:#070d1c; border-radius:6px; border:1px dashed #1e293b;">
                    Equipe peças do mesmo conjunto para desbloquear bônus de combate na Arena!
                  </div>
                `}
              </div>
            </div>
          </div>
        `;
      };

      // 2. Renderizador da Aba de Atributos & Matriz Procedural
      const renderStatsTabContent = () => {
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

        const classCb = c.baseCombatAttributesJson || {};
        const eqCons = this._equippedDetails?.consolidatedBonuses || {};
        const combatRows = (this.combatAttributes || []).map((ca) => {
          let baseVal = Number(ca.baseDefault) || 0;
          let previewVal = Number(ca.baseDefault) || 0;
          let cappedTag = '';
          if (ca.code === 'BATTLE_MOVE_SPEED') {
            const clsBase = Number(classCb.BATTLE_MOVE_SPEED) || baseVal || 160;
            const agiConv = (this.attributeConversions || []).find((x) => x.baseAttributeCode === 'AGI' && x.combatAttributeCode === 'BATTLE_MOVE_SPEED');
            const agiRatio = agiConv ? Number(agiConv.ratioPerPoint) : 0.5;
            const eqBms = Number(eqCons.BATTLE_MOVE_SPEED) || 0;
            const rawBase = Math.round(clsBase + (baseTotals.AGI || 0) * agiRatio + eqBms);
            const rawPrev = Math.round(clsBase + (previewTotals.AGI || 0) * agiRatio + eqBms);
            if (rawBase > 185 || rawPrev > 185) cappedTag = ' <span style="font-size:0.62rem; color:#f59e0b; font-weight:700;">(Máx. 185)</span>';
            baseVal = Math.max(60, Math.min(185, rawBase));
            previewVal = Math.max(60, Math.min(185, rawPrev));
          } else {
            for (const conv of (this.attributeConversions || [])) {
              if (conv.combatAttributeCode === ca.code) {
                baseVal += (baseTotals[conv.baseAttributeCode] || 0) * Number(conv.ratioPerPoint);
                previewVal += (previewTotals[conv.baseAttributeCode] || 0) * Number(conv.ratioPerPoint);
              }
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
                <span class="stats-combat-val">${hasDiff ? prevFormatted : curFormatted}${cappedTag}</span>
                ${hasDiff ? `<span class="stats-combat-preview">(+${ca.isPercentage ? diff.toFixed(1) + '%' : Math.round(diff)})</span>` : ''}
              </div>
            </div>
          `;
        });

        return `
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

      // 3. Renderizador da Aba de Habilidades da Classe
      const renderSkillsTabContent = () => {
        if (charSkills.length === 0) {
          return `
            <div style="text-align:center; padding:35px 20px; color:#94a3b8; font-size:0.84rem; background:rgba(15,23,42,0.6); border-radius:10px; border:1px solid #1e293b;">
              <span style="font-size:1.8rem; display:block; margin-bottom:8px;">🔮</span>
              Nenhuma habilidade cadastrada para esta classe no momento.
            </div>
          `;
        }

        const selectedSkill = charSkills.find((sk) => sk.id === this._selectedSkillId) || charSkills[0];

        const skillListHtml = charSkills.map((sk) => {
          const isSelected = selectedSkill && selectedSkill.id === sk.id;
          const isPassive = sk.skillType === 'PASSIVE';
          const iconUrl = sk.iconUrl || '/play/assets/hud/action_skill_icon.png';
          return `
            <div class="stats-skill-item ${isSelected ? 'selected' : ''}" onclick="PlayApp.selectSkill(${sk.id})">
              <img class="stats-skill-icon-thumb" src="${iconUrl}" alt="${sk.namePtBr}" onerror="this.src='/play/assets/hud/action_skill_icon.png'" />
              <div class="stats-skill-meta">
                <span class="stats-skill-name">${sk.namePtBr}</span>
                <div class="stats-skill-tags-row">
                  <span class="stats-skill-badge ${isPassive ? 'passive-type' : 'active-type'}">
                    ${isPassive ? '🛡️ Passiva' : '🔮 Ativa'}
                  </span>
                  ${sk.mpCost > 0 ? `<span class="stats-skill-badge cost">💧 ${sk.mpCost} MP</span>` : ''}
                  ${sk.cooldownSeconds > 0 ? `<span class="stats-skill-badge cost">⏱️ ${sk.cooldownSeconds}s</span>` : ''}
                </div>
              </div>
            </div>
          `;
        }).join('');

        const targetLabels = {
          ENEMY_SINGLE: 'Inimigo Único',
          ENEMY_AOE: 'Área Inimiga',
          ALLY_SINGLE: 'Aliado Único',
          SELF: 'Apenas Si Mesmo',
          ALL_ALLIES: 'Todos os Aliados',
          ALL: 'Todos na Arena',
        };
        const targetLabel = targetLabels[selectedSkill?.targetType] || selectedSkill?.targetType || 'Inimigo';

        const triggerLabels = {
          MANUAL: 'Disparo Manual',
          MANUAL_AP: 'Disparo Manual (Stamina)',
          ACTIVE: 'Ativa em Combate',
          PASSIVE_ALWAYS: 'Passiva Permanente',
          ON_HIT: 'Ao Golpear',
          ON_CRIT: 'Ao Acertar Crítico',
          ON_DAMAGE_TAKEN: 'Ao Receber Dano',
          ON_KILL: 'Ao Abater Inimigo',
          INTERVAL_TICK: 'A Cada Intervalo de Tempo',
        };
        const triggerLabel = triggerLabels[selectedSkill?.triggerType] || selectedSkill?.triggerType || 'Manual';

        let effectProps = '';
        if (selectedSkill?.damageMultiplier && selectedSkill.damageMultiplier > 0) {
          effectProps += `
            <div class="stats-skill-prop-item">
              <span class="stats-skill-prop-label">Potência de Dano</span>
              <span class="stats-skill-prop-value" style="color:#f87171;">💥 ${Math.round(selectedSkill.damageMultiplier * 100)}%</span>
            </div>
          `;
        }
        if (selectedSkill?.fixedDamage && selectedSkill.fixedDamage > 0) {
          effectProps += `
            <div class="stats-skill-prop-item">
              <span class="stats-skill-prop-label">Dano Fixo Bônus</span>
              <span class="stats-skill-prop-value" style="color:#fca5a5;">+${selectedSkill.fixedDamage}</span>
            </div>
          `;
        }
        if (selectedSkill?.healingMultiplier && selectedSkill.healingMultiplier > 0) {
          effectProps += `
            <div class="stats-skill-prop-item">
              <span class="stats-skill-prop-label">Potência de Cura</span>
              <span class="stats-skill-prop-value" style="color:#4ade80;">💚 ${Math.round(selectedSkill.healingMultiplier * 100)}%</span>
            </div>
          `;
        }
        if (selectedSkill?.fixedHealing && selectedSkill.fixedHealing > 0) {
          effectProps += `
            <div class="stats-skill-prop-item">
              <span class="stats-skill-prop-label">Cura Fixa Bônus</span>
              <span class="stats-skill-prop-value" style="color:#86efac;">+${selectedSkill.fixedHealing} HP</span>
            </div>
          `;
        }

        const detailsHtml = selectedSkill ? `
          <div class="stats-skill-details-card">
            <div class="stats-skill-details-header">
              <img class="stats-skill-details-icon" src="${selectedSkill.iconUrl || '/play/assets/hud/action_skill_icon.png'}" alt="${selectedSkill.namePtBr}" />
              <div class="stats-skill-details-title-box">
                <span class="stats-skill-details-title">${selectedSkill.namePtBr}</span>
                <div class="stats-skill-tags-row">
                  <span class="stats-skill-badge ${selectedSkill.skillType === 'PASSIVE' ? 'passive-type' : 'active-type'}">
                    ${selectedSkill.skillType === 'PASSIVE' ? '🛡️ Habilidade Passiva' : '🔮 Habilidade Ativa'}
                  </span>
                  ${selectedSkill.elementCode ? `<span class="stats-skill-badge cost" style="color:#38bdf8;">🌟 Elemento: ${selectedSkill.elementCode}</span>` : ''}
                </div>
              </div>
            </div>

            <div class="stats-skill-details-desc">
              ${selectedSkill.descriptionPtBr || 'Nenhuma descrição detalhada disponível.'}
            </div>

            <div class="stats-skill-props-grid">
              <div class="stats-skill-prop-item">
                <span class="stats-skill-prop-label">Custo de Mana (MP)</span>
                <span class="stats-skill-prop-value" style="color:#38bdf8;">💧 ${selectedSkill.mpCost > 0 ? selectedSkill.mpCost + ' MP' : 'Sem Custo'}</span>
              </div>
              <div class="stats-skill-prop-item">
                <span class="stats-skill-prop-label">Tempo de Recarga</span>
                <span class="stats-skill-prop-value" style="color:#fde047;">⏱️ ${selectedSkill.cooldownSeconds > 0 ? selectedSkill.cooldownSeconds + 's' : 'Instantâneo'}</span>
              </div>
              <div class="stats-skill-prop-item">
                <span class="stats-skill-prop-label">Gatilho de Ativação</span>
                <span class="stats-skill-prop-value">${triggerLabel}</span>
              </div>
              <div class="stats-skill-prop-item">
                <span class="stats-skill-prop-label">Seleção de Alvo</span>
                <span class="stats-skill-prop-value">${targetLabel}</span>
              </div>
              <div class="stats-skill-prop-item">
                <span class="stats-skill-prop-label">Alcance de Disparo</span>
                <span class="stats-skill-prop-value">🏹 ${selectedSkill.castRange} px</span>
              </div>
              <div class="stats-skill-prop-item">
                <span class="stats-skill-prop-label">Área de Efeito (AoE)</span>
                <span class="stats-skill-prop-value">💥 ${selectedSkill.aoeRadius > 0 ? selectedSkill.aoeRadius + ' px' : 'Alvo Único'}</span>
              </div>
              ${effectProps}
            </div>
          </div>
        ` : '';

        return `
          <div class="stats-skills-container">
            <div class="stats-skills-list">
              <div style="font-size:0.72rem; font-weight:800; color:#38bdf8; padding:4px 2px; border-bottom:1px solid rgba(255,255,255,0.06); margin-bottom:4px;">
                📜 Habilidades de ${c.classNamePtBr || 'Classe'} (${charSkills.length})
              </div>
              ${skillListHtml}
            </div>
            ${detailsHtml}
          </div>
        `;
      };

      // 4. Renderizador da Aba Constelação (Placeholder Futuro)
      const renderConstellationTabContent = () => `
        <div class="stats-placeholder-card constellation-theme">
          <div class="stats-placeholder-glow"></div>
          <img class="stats-placeholder-icon" src="/play/assets/hud/tab_constellation.png" alt="Constelação" />
          <div class="stats-placeholder-title">🌌 Sistema de Constelações Astrais</div>
          <p class="stats-placeholder-desc">
            Desperte as estrelas ancestrais de Etheria. Em breve você poderá conectar nodos estelares, alinhar signos astrais e desbloquear bênçãos passivas de grande poder para seu personagem.
          </p>
          <div class="stats-placeholder-badge">⏳ Em Desenvolvimento</div>
        </div>
      `;

      // 5. Renderizador da Aba Arma Celestial (Placeholder Futuro)
      const renderCelestialWeaponTabContent = () => `
        <div class="stats-placeholder-card celestial-theme">
          <div class="stats-placeholder-glow"></div>
          <img class="stats-placeholder-icon" src="/play/assets/hud/tab_celestial_weapon.png" alt="Arma Celestial" />
          <div class="stats-placeholder-title">⚔️ Armamento Celestial Divino</div>
          <p class="stats-placeholder-desc">
            Forje relíquias divinas imbuídas com a essência pura dos éteres. Em breve você poderá empunhar, evoluir e ascender armas celestiais exclusivas com habilidades únicas de transcendência.
          </p>
          <div class="stats-placeholder-badge">⏳ Em Desenvolvimento</div>
        </div>
      `;

      modalBody.innerHTML = `
        <!-- Barra de Abas do Modal (Apenas Ícones Customizados Oficiais) -->
        <div class="stats-modal-tabs">
          <button type="button" class="stats-tab-btn ${activeTab === 'equip' ? 'active' : ''}" onclick="PlayApp.switchStatsModalTab('equip')" title="Equipamentos (${equippedCount}/12)">
            <img class="stats-tab-icon" src="/play/assets/hud/tab_equip.png" alt="Equipamentos" />
          </button>
          <button type="button" class="stats-tab-btn ${activeTab === 'stats' ? 'active' : ''}" onclick="PlayApp.switchStatsModalTab('stats')" title="Atributos & Matriz de Combate">
            <img class="stats-tab-icon" src="/play/assets/hud/tab_stats.png" alt="Atributos" />
            ${remainingUnspent > 0 ? `<span class="stats-tab-points-pill">★${remainingUnspent}</span>` : ''}
          </button>
          <button type="button" class="stats-tab-btn ${activeTab === 'skills' ? 'active' : ''}" onclick="PlayApp.switchStatsModalTab('skills')" title="Habilidades da Classe (${charSkills.length})">
            <img class="stats-tab-icon" src="/play/assets/hud/tab_skills.png" alt="Habilidades" />
          </button>
          <button type="button" class="stats-tab-btn ${activeTab === 'constellation' ? 'active' : ''}" onclick="PlayApp.switchStatsModalTab('constellation')" title="Constelação (Em Breve)">
            <img class="stats-tab-icon" src="/play/assets/hud/tab_constellation.png" alt="Constelação" />
            <span class="stats-tab-soon-pill">Breve</span>
          </button>
          <button type="button" class="stats-tab-btn ${activeTab === 'celestial_weapon' ? 'active' : ''}" onclick="PlayApp.switchStatsModalTab('celestial_weapon')" title="Arma Celestial (Em Breve)">
            <img class="stats-tab-icon" src="/play/assets/hud/tab_celestial_weapon.png" alt="Arma Celestial" />
            <span class="stats-tab-soon-pill">Breve</span>
          </button>
        </div>

        <!-- Banner do Herói -->
        <div class="stats-hero-banner">
          <div class="stats-hero-profile">
            <img class="stats-hero-thumb" src="${c.thumbUrl || '/play/assets/hud/menu_character.png'}" alt="${window.EtheriaSanitizer?.escapeHtml(c.name) || ''}" />
            <div>
              <div class="stats-hero-name">${window.EtheriaSanitizer?.escapeHtml(c.name) || ''} (Nv. ${c.level})</div>
              <div class="stats-hero-meta">${c.classNamePtBr || 'Classe'} &bull; ${c.raceCode || 'HUMAN'} &bull; <span style="color:${el.color}; font-weight:700;">${el.icon} ${c.elementNamePtBr || c.elementCode}</span></div>
            </div>
          </div>
          <div class="stats-points-badge ${remainingUnspent > 0 ? 'has-points' : 'zero-points'}">
            ★ ${remainingUnspent} Pts Livres
          </div>
        </div>

        <!-- Conteúdo da Aba Ativa -->
        ${
          activeTab === 'equip'
            ? renderEquipTabContent()
            : activeTab === 'skills'
            ? renderSkillsTabContent()
            : activeTab === 'constellation'
            ? renderConstellationTabContent()
            : activeTab === 'celestial_weapon'
            ? renderCelestialWeaponTabContent()
            : renderStatsTabContent()
        }
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
      if (window.PlayFlightAndWingsController && !window.PlayFlightAndWingsController.assertGroundedForCombat(this, 'iniciar uma luta')) {
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
