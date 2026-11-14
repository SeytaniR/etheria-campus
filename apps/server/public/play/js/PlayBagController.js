/**
 * @file apps/server/public/play/js/PlayBagController.js
 * @module @etheria/client/inventory
 * @description Submódulo de Carteira de Ouro, Mochila & Equipamentos do Personagem (/play).
 *   Implementa o Paperdoll de 12 Slots de Equipamento (HEAD, SHOULDER, CHEST, BELT, LEGS, FEET,
 *   WEAPON_1, WEAPON_2, NECKLACE, RING, ORNAMENT_1, ORNAMENT_2) com suporte a Equipar e Desequipar.
 */

const PlayBagController = {
  SLOT_DEFINITIONS: [
    // Lado Esquerdo: Armadura e Defesa
    { code: 'HEAD', label: 'Elmo', icon: '🧢', col: 'left' },
    { code: 'SHOULDER', label: 'Ombros', icon: '🛡️', col: 'left' },
    { code: 'CHEST', label: 'Peitoral', icon: '🥋', col: 'left' },
    { code: 'BELT', label: 'Cinto', icon: '🎗️', col: 'left' },
    { code: 'LEGS', label: 'Calças', icon: '👖', col: 'left' },
    { code: 'FEET', label: 'Botas', icon: '👢', col: 'left' },

    // Lado Direito: Armas e Acessórios
    { code: 'WEAPON_1', label: 'Arma 1', icon: '⚔️', col: 'right' },
    { code: 'WEAPON_2', label: 'Arma 2', icon: '📖', col: 'right' },
    { code: 'NECKLACE', label: 'Colar', icon: '📿', col: 'right' },
    { code: 'RING', label: 'Anel', icon: '💍', col: 'right' },
    { code: 'ORNAMENT_1', label: 'Amuleto', icon: '🔮', col: 'right' },
    { code: 'ORNAMENT_2', label: 'Talismã', icon: '🧿', col: 'right' },
  ],

  attach(client) {
    this.injectBagModalDom();
    this.injectCharacterModalDom();

    // 1. Abertura da Mochila / Carteira
    client.openBagModal = async function () {
      if (!this.activeChar) return;
      const bodyEl = document.getElementById('bagModalBody');
      if (!bodyEl) return;

      bodyEl.innerHTML = `<div style="padding:16px; text-align:center; color:#94a3b8;">⏳ Carregando carteira e mochila...</div>`;
      document.getElementById('bagModal').style.display = 'flex';

      try {
        const res = await this.api(`/api/play/characters/${this.activeChar.id}/inventory`);
        const gold = Number(res?.gold ?? this.activeChar.gold ?? 0);
        this.activeChar.gold = gold;
        if (typeof this.updateHudInfo === 'function') this.updateHudInfo();

        const items = Array.isArray(res?.items) ? res.items : [];
        const itemsHtml = items.length
          ? items
              .map((it) => {
                const isEquip = it.itemCategory === 'CHARACTER_EQUIPMENT';
                return `
              <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; background:#0f172a; border:1px solid #334155; border-radius:8px; padding:8px 10px;">
                <div style="display:flex; align-items:center; gap:8px;">
                  <img src="${it.iconUrl}" style="width:38px; height:38px; object-fit:contain; background:#020617; border-radius:6px; border:1px solid #1e293b;" onerror="this.style.display='none'" />
                  <div>
                    <div style="font-size:0.84rem; font-weight:700; color:#f8fafc;">${it.namePtBr}</div>
                    <div style="font-size:0.7rem; color:#94a3b8;">
                      ${isEquip ? `<span style="color:#38bdf8; font-weight:700;">Slot: ${it.equipmentSlotCode || 'Geral'}</span> &bull; ` : ''}Rank ${it.rarityTier || 'COMMON'}
                    </div>
                  </div>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                  <strong style="font-family:monospace; font-size:0.92rem; color:#fde047;">x${Number(it.quantity).toLocaleString('pt-BR')}</strong>
                  ${
                    isEquip
                      ? `<button type="button" class="btn-primary" style="padding:5px 10px; font-size:0.75rem; border-radius:6px; white-space:nowrap;" onclick="window.PlayApp.equipInventoryItem(${it.itemTemplateId}, '${it.equipmentSlotCode || ''}')">⚔️ Equipar</button>`
                      : ''
                  }
                </div>
              </div>`;
              })
              .join('')
          : `<div style="padding:18px; text-align:center; color:#64748b; font-size:0.82rem;">Nenhum item na mochila ainda.</div>`;

        bodyEl.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; background:#020617; border:1px solid #eab308; border-radius:8px; padding:10px 12px;">
            <span style="color:#cbd5e1; font-size:0.84rem; font-weight:700;">🪙 Ouro Acumulado</span>
            <strong style="color:#fde047; font-size:1.05rem; font-family:monospace;">${gold.toLocaleString('pt-BR')}</strong>
          </div>
          <div style="display:flex; flex-direction:column; gap:6px; max-height:360px; overflow-y:auto; padding-right:2px;">
            ${itemsHtml}
          </div>`;
      } catch (err) {
        bodyEl.innerHTML = `<div style="color:#fca5a5; padding:12px;">Erro ao carregar mochila: ${err.message}</div>`;
      }
    };

    // 2. Ação de Equipar Item da Mochila
    client.equipInventoryItem = async function (itemTemplateId, slotCode) {
      if (!this.activeChar) return;
      try {
        await this.api(`/api/play/characters/${this.activeChar.id}/equipment/equip`, {
          method: 'POST',
          body: JSON.stringify({ itemTemplateId: Number(itemTemplateId), slotCode: slotCode || undefined }),
        });
        if (typeof this.showNotification === 'function') {
          this.showNotification('⚔️ Equipamento vestido com sucesso!', 'success');
        } else {
          alert('⚔️ Equipamento vestido com sucesso!');
        }
        await this.openBagModal();
        if (document.getElementById('characterModal')?.style.display === 'flex') {
          await this.openCharacterModal();
        }
      } catch (err) {
        alert(`Erro ao equipar: ${err.message}`);
      }
    };

    // 3. Ação de Desequipar Item
    client.unequipCharacterSlot = async function (slotCode) {
      if (!this.activeChar) return;
      try {
        await this.api(`/api/play/characters/${this.activeChar.id}/equipment/unequip`, {
          method: 'POST',
          body: JSON.stringify({ slotCode }),
        });
        if (typeof this.showNotification === 'function') {
          this.showNotification(`Desequipou item do slot ${slotCode}.`, 'info');
        } else {
          alert(`Desequipou item do slot ${slotCode}.`);
        }
        await this.openCharacterModal();
      } catch (err) {
        alert(`Erro ao desequipar: ${err.message}`);
      }
    };

    // 4. Modal Completo de Personagem & Equipamentos (Paperdoll)
    client.openCharacterModal = async function () {
      if (!this.activeChar) return;
      const c = this.activeChar;
      const bodyEl = document.getElementById('characterModalBody');
      if (!bodyEl) return;

      bodyEl.innerHTML = `<div style="padding:20px; text-align:center; color:#94a3b8;">⏳ Carregando equipamentos e ficha do herói...</div>`;
      document.getElementById('characterModal').style.display = 'flex';

      try {
        const res = await this.api(`/api/play/characters/${c.id}/equipment`);
        const slotsData = Array.isArray(res?.slots) ? res.slots : [];
        const bonuses = res?.consolidatedBonuses || {};

        const slotMap = new Map();
        slotsData.forEach((s) => slotMap.set(s.slotCode, s.item));

        const avatarImg = `/play/assets/hud/avatars/class_${c.classTemplateId || 1}.png`;
        const el = typeof this.getElementStyle === 'function' ? this.getElementStyle(c.elementCode) : { icon: '⚡', color: '#38bdf8' };

        const leftSlots = PlayBagController.SLOT_DEFINITIONS.filter((s) => s.col === 'left');
        const rightSlots = PlayBagController.SLOT_DEFINITIONS.filter((s) => s.col === 'right');

        const renderSlotHtml = (s) => {
          const it = slotMap.get(s.code);
          const hasItem = Boolean(it);
          const itemJson = hasItem ? encodeURIComponent(JSON.stringify(it)) : '';
          return `
            <div class="equip-slot-box" data-slot="${s.code}" data-item="${itemJson}" onclick="PlayBagController.onSlotClick('${s.code}')" style="position:relative; width:46px; height:46px; border-radius:8px; border:1.5px solid ${hasItem ? '#f59e0b' : 'rgba(148,163,184,0.2)'}; background:${hasItem ? 'rgba(30,41,59,0.92)' : 'rgba(15,23,42,0.6)'}; display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:pointer; box-shadow:0 2px 8px rgba(0,0,0,0.5); transition:transform 0.1s ease;" title="${hasItem ? `${it.namePtBr} (Toque para gerenciar)` : `Slot ${s.label} (Vazio)`}">
              ${hasItem ? `<img src="${it.iconUrl}" style="width:34px; height:34px; object-fit:contain; border-radius:4px;" />` : `<span style="font-size:1.15rem; opacity:0.35;">${s.icon}</span>`}
              <span style="position:absolute; bottom:1px; font-size:0.48rem; font-weight:800; color:${hasItem ? '#fde047' : '#64748b'}; text-transform:uppercase;">${s.label}</span>
            </div>
          `;
        };

        const bonusesHtml = Object.keys(bonuses).length
          ? Object.entries(bonuses)
              .map(([k, v]) => `<span style="padding:2px 8px; border-radius:99px; background:rgba(34,197,94,0.15); border:1px solid rgba(34,197,94,0.4); font-size:0.72rem; color:#86efac; font-weight:700;">${k}: +${v}</span>`)
              .join(' ')
          : '<span style="color:#64748b; font-size:0.74rem;">Nenhum bônus de equipamento ativo.</span>';

        bodyEl.innerHTML = `
          <!-- Paperdoll Grid com Modelo Central e 12 Slots Laterais -->
          <div style="display:grid; grid-template-columns:48px 1fr 48px; gap:8px; align-items:center; background:rgba(15,23,42,0.85); border:1px solid #334155; border-radius:12px; padding:10px;">
            <!-- Coluna Esquerda: Defesa (6 slots) -->
            <div style="display:flex; flex-direction:column; gap:5px; align-items:center;">
              ${leftSlots.map(renderSlotHtml).join('')}
            </div>

            <!-- Centro: Cartão do Personagem -->
            <div style="display:flex; flex-direction:column; align-items:center; text-align:center; gap:6px; padding:4px;">
              <div style="position:relative; width:84px; height:84px; border-radius:50%; background:radial-gradient(circle, #1e293b, #020617); border:2px solid #eab308; display:flex; align-items:center; justify-content:center; box-shadow:0 0 16px rgba(234,179,8,0.35);">
                <img src="${avatarImg}" style="width:72px; height:72px; object-fit:contain; border-radius:50%;" onerror="this.src='/play/assets/hud/avatars/class_1.png'" />
                <span style="position:absolute; bottom:-4px; background:#020617; border:1px solid #eab308; color:#fde047; font-size:0.68rem; font-weight:800; padding:1px 6px; border-radius:99px;">Nv. ${c.level || 1}</span>
              </div>
              <strong style="color:#f8fafc; font-size:0.95rem;">${c.name}</strong>
              <div style="font-size:0.74rem; color:#94a3b8;">${c.classNamePtBr || 'Guerreiro'} &bull; ${c.raceCode || 'HUMAN'}</div>
              <div style="font-size:0.72rem; padding:2px 8px; border-radius:99px; background:rgba(56,189,248,0.15); color:${el.color}; font-weight:700;">
                ${el.icon} ${c.elementNamePtBr || 'Neutro'}
              </div>
            </div>

            <!-- Coluna Direita: Armas & Acessórios (6 slots) -->
            <div style="display:flex; flex-direction:column; gap:5px; align-items:center;">
              ${rightSlots.map(renderSlotHtml).join('')}
            </div>
          </div>

          <!-- Painel Interativo de Detalhes do Slot Selecionado -->
          <div id="characterSlotDetailPanel" style="display:none; background:#0f172a; border:1px solid #f59e0b; border-radius:8px; padding:10px;"></div>

          <!-- Bônus de Combate dos Equipamentos -->
          <div style="background:rgba(2,6,23,0.7); border:1px solid #334155; border-radius:8px; padding:8px 10px;">
            <div style="font-size:0.74rem; font-weight:700; color:#cbd5e1; margin-bottom:5px;">⚔️ Bônus Consolidados dos Equipamentos:</div>
            <div style="display:flex; flex-wrap:wrap; gap:4px;">${bonusesHtml}</div>
          </div>
        `;
      } catch (err) {
        bodyEl.innerHTML = `<div style="color:#fca5a5; padding:12px;">Erro ao carregar personagem: ${err.message}</div>`;
      }
    };

    // Alias: openStatsModal agora abre a tela completa de Personagem
    client.openStatsModal = client.openCharacterModal;
  },

  onSlotClick(slotCode) {
    const slotBox = document.querySelector(`.equip-slot-box[data-slot="${slotCode}"]`);
    const panel = document.getElementById('characterSlotDetailPanel');
    if (!slotBox || !panel) return;

    const rawItem = slotBox.getAttribute('data-item');
    if (!rawItem) {
      panel.style.display = 'block';
      panel.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="color:#94a3b8; font-size:0.78rem;">Slot <strong>${slotCode}</strong> está vazio.</span>
          <button class="btn-primary" style="padding:4px 8px; font-size:0.72rem;" onclick="window.PlayApp.openBagModal()">🎒 Abrir Mochila</button>
        </div>
      `;
      return;
    }

    try {
      const it = JSON.parse(decodeURIComponent(rawItem));
      const stats = it.combatStatBonuses || {};
      const statsList = Object.entries(stats)
        .map(([k, v]) => `<code>${k}: +${v}</code>`)
        .join(', ');

      panel.style.display = 'block';
      panel.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <img src="${it.iconUrl}" style="width:34px; height:34px; object-fit:contain; border-radius:6px; background:#020617; border:1px solid #334155;" />
            <div>
              <div style="font-size:0.84rem; font-weight:800; color:#fde047;">${it.namePtBr}</div>
              <div style="font-size:0.7rem; color:#94a3b8;">${it.equipmentSlotCode} &bull; Rank ${it.rarityTier || 'COMMON'}</div>
            </div>
          </div>
          <button class="btn-danger" style="padding:5px 12px; font-size:0.74rem; font-weight:700; white-space:nowrap; border-radius:6px;" onclick="window.PlayApp.unequipCharacterSlot('${slotCode}')">
            Desequipar
          </button>
        </div>
        ${statsList ? `<div style="font-size:0.72rem; color:#86efac; margin-top:6px;">Bônus: ${statsList}</div>` : ''}
      `;
    } catch {
      panel.style.display = 'none';
    }
  },

  injectBagModalDom() {
    if (document.getElementById('bagModal')) return;
    const modal = document.createElement('div');
    modal.id = 'bagModal';
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal-box" style="width:min(95vw, 480px);">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #334155; padding-bottom:8px;">
          <h3 style="color:#fde047; font-size:0.95rem;">🎒 Mochila & Carteira</h3>
          <button class="btn-danger" style="padding:4px 10px;" onclick="document.getElementById('bagModal').style.display='none'">✕</button>
        </div>
        <div id="bagModalBody" style="display:flex; flex-direction:column; gap:10px;"></div>
      </div>`;
    document.body.appendChild(modal);
  },

  injectCharacterModalDom() {
    if (document.getElementById('characterModal')) return;
    const modal = document.createElement('div');
    modal.id = 'characterModal';
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal-box" style="width:min(96vw, 440px); max-height:92dvh; overflow-y:auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #334155; padding-bottom:8px;">
          <h3 style="color:#fde047; font-size:0.95rem;">👤 Personagem & Equipamentos</h3>
          <button class="btn-danger" style="padding:4px 10px;" onclick="document.getElementById('characterModal').style.display='none'">✕</button>
        </div>
        <div id="characterModalBody" style="display:flex; flex-direction:column; gap:10px;"></div>
      </div>`;
    document.body.appendChild(modal);
  },
};

window.PlayBagController = PlayBagController;
