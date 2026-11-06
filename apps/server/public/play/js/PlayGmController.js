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
      if (drawer) drawer.classList.toggle('open');
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
      const c = this.activeChar;
      const base = c.baseAttributesJson || { VIT: 10, STR: 10, INT: 10, WIS: 10, AGI: 10, DEX: 10 };
      const dist = c.distributedStatsJson || { VIT: 0, STR: 0, INT: 0, WIS: 0, AGI: 0, DEX: 0 };
      const grow = c.growthPerLevelJson || { VIT: 2, STR: 2, INT: 2, WIS: 2, AGI: 2, DEX: 2 };
      const lvUps = Math.max(0, (c.level || 1) - 1);

      const totalBase = {};
      for (const k of ['VIT', 'STR', 'INT', 'WIS', 'AGI', 'DEX']) {
        totalBase[k] = (Number(base[k]) || 0) + (Number(grow[k]) || 0) * lvUps + (Number(dist[k]) || 0);
      }

      // Calcula Atributos de Combate via Matriz Procedural (`attribute_conversions`)
      const combatLines = this.combatAttributes.map((ca) => {
        let val = Number(ca.baseDefault) || 0;
        for (const conv of this.attributeConversions) {
          if (conv.combatAttributeCode === ca.code) {
            val += (totalBase[conv.baseAttributeCode] || 0) * Number(conv.ratioPerPoint);
          }
        }
        const formatted = ca.isPercentage ? `${val.toFixed(1)}%` : Math.round(val);
        return `<div style="display:flex; justify-content:space-between; padding:4px 8px; background:rgba(30,41,59,0.6); border-radius:6px;">
          <span>${ca.namePtBr} (<code>${ca.code}</code>)</span>
          <strong style="color:var(--accent);">${formatted}</strong>
        </div>`;
      });

      const el = this.getElementStyle(c.elementCode);
      const modalBody = document.getElementById('statsModalBody');
      if (modalBody) {
        modalBody.innerHTML = `
          <div style="padding:10px; background:rgba(56,189,248,0.1); border-radius:8px; border:1px solid var(--border);">
            <strong>${c.name}</strong> &bull; Nv.${c.level} &bull; ${c.classNamePtBr} (${c.raceCode})<br/>
            <span>Elemento: <strong style="color:${el.color};">${el.icon} ${c.elementNamePtBr}</strong></span>
          </div>
          <div>
            <strong style="color:var(--accent-amber); display:block; margin-bottom:6px;">6 Atributos Base Totais:</strong>
            <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:6px;">
              ${['VIT', 'STR', 'INT', 'WIS', 'AGI', 'DEX']
                .map(
                  (k) => `<div style="padding:6px; background:var(--bg-input); border-radius:6px; text-align:center;">
                    <div style="font-size:0.72rem; color:var(--text-muted);">${k}</div>
                    <strong style="font-size:0.95rem;">${totalBase[k]}</strong>
                  </div>`
                )
                .join('')}
            </div>
          </div>
          <div>
            <strong style="color:#86efac; display:block; margin-bottom:6px;">Atributos de Combate Derivados (Matriz Procedural):</strong>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
              ${combatLines.join('')}
            </div>
          </div>
        `;
      }
      const modal = document.getElementById('statsModal');
      if (modal) modal.style.display = 'flex';
    };
  }
}

window.PlayGmController = PlayGmController;
