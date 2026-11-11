/**
 * @file apps/server/public/play/js/PlayBagController.js
 * @module @etheria/server
 * @description Submódulo de Carteira de Ouro & Mochila Básica (`/play`).
 *   AVISO DE ESTADO INCOMPLETO: Base inicial criada para exibir Ouro e itens coletados/recebidos
 *   em Quests (especialmente Quests Meta de Coletar & Entregar Itens). Economia completa,
 *   loja, equipamentos e tabela global de drops serão expandidos em etapas futuras.
 */

const PlayBagController = {
  attach(client) {
    this.injectBagModalDom();

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
        this.updateHudInfo();

        const items = Array.isArray(res?.items) ? res.items : [];
        const itemsHtml = items.length
          ? items
              .map(
                (it) => `
              <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; background:#0f172a; border:1px solid #334155; border-radius:8px; padding:8px 10px;">
                <div style="display:flex; align-items:center; gap:8px;">
                  <img src="${it.iconUrl}" style="width:36px; height:36px; object-fit:contain; background:#020617; border-radius:6px; border:1px solid #1e293b;" onerror="this.style.display='none'" />
                  <div>
                    <div style="font-size:0.84rem; font-weight:700; color:#f8fafc;">${it.namePtBr}</div>
                    <div style="font-size:0.7rem; color:#94a3b8;">${it.itemCategory} • Rank ${it.rarityTier || 'COMMON'}</div>
                  </div>
                </div>
                <strong style="font-family:monospace; font-size:0.92rem; color:#fde047;">x${Number(it.quantity).toLocaleString('pt-BR')}</strong>
              </div>`
              )
              .join('')
          : `<div style="padding:18px; text-align:center; color:#64748b; font-size:0.82rem;">Nenhum item na mochila ainda.</div>`;

        bodyEl.innerHTML = `
          <div style="background:rgba(245,158,11,0.1); border:1px dashed #f59e0b; border-radius:8px; padding:8px 10px; font-size:0.74rem; color:#fde68a;">
            ⚠️ <strong>Base Inicial Incompleta:</strong> ${res?.incompleteNoticePtBr || 'Mochila e carteira provisórias ativas para quests.'}
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; background:#020617; border:1px solid #eab308; border-radius:8px; padding:10px 12px;">
            <span style="color:#cbd5e1; font-size:0.84rem; font-weight:700;">🪙 Ouro Acumulado</span>
            <strong style="color:#fde047; font-size:1.05rem; font-family:monospace;">${gold.toLocaleString('pt-BR')}</strong>
          </div>
          <div style="display:flex; flex-direction:column; gap:6px; max-height:360px; overflow-y:auto;">
            ${itemsHtml}
          </div>`;
      } catch (err) {
        bodyEl.innerHTML = `<div style="color:#fca5a5; padding:12px;">Erro ao carregar mochila: ${err.message}</div>`;
      }
    };
  },

  injectBagModalDom() {
    if (document.getElementById('bagModal')) return;
    const modal = document.createElement('div');
    modal.id = 'bagModal';
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal-box" style="width:min(95vw, 520px);">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #334155; padding-bottom:10px;">
          <h3 style="color:#fde047; font-size:1rem;">🎒 Mochila & Carteira (Base Inicial)</h3>
          <button class="btn-danger" onclick="document.getElementById('bagModal').style.display='none'">Fechar</button>
        </div>
        <div id="bagModalBody" style="display:flex; flex-direction:column; gap:10px;"></div>
      </div>`;
    document.body.appendChild(modal);
  },
};

window.PlayBagController = PlayBagController;
