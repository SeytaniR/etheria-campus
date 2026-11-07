/**
 * @file apps/server/public/admin/js/AdminLayersDrawer.js
 * @module @etheria/server
 * @description Submódulo da Gaveta e Listas de Camadas (Layers Drawer) do Editor de Mapas (`/admin`).
 *   Gerencia a listagem e remoção de polígonos de Colisão, Sobreposição, Portais interligados e NPCs no mapa.
 */

class AdminLayersDrawer {
  static attach(app) {
    app.buildPairedPortalOptionsHtml = function (currentPortal) {
      const selectedPartnerId = Number(currentPortal.linkedPortalId) || 0;
      const options = [`<option value="">⏳ Sem vínculo ainda (Vincular depois que criar o outro mapa)</option>`];

      for (const m of this.savedMaps) {
        if (this.currentMapId && m.id === this.currentMapId) continue;
        const mapPortals = m.outgoingPortals || [];
        for (const remoteP of mapPortals) {
          const isSel = remoteP.id === selectedPartnerId ? 'selected' : '';
          const pLabel = remoteP.label || `Portal #${remoteP.id}`;
          options.push(
            `<option value="${remoteP.id}" ${isSel}>🔗 ${m.namePtBr} ➔ ${pLabel} (Pos: ${remoteP.sourceX}, ${remoteP.sourceY})</option>`
          );
        }
      }
      return options.join('');
    };

    app.renderLayerLists = function () {
      const cLen = this.collisionPolygons.length;
      const oLen = this.overlapPolygons.length;
      const pLen = this.portals.length;
      const nLen = this.npcs.length;

      const cc = document.getElementById('countCollision');
      if (cc) cc.textContent = String(cLen);
      const co = document.getElementById('countOverlap');
      if (co) co.textContent = String(oLen);
      const cp = document.getElementById('countPortals');
      if (cp) cp.textContent = String(pLen);
      const cn = document.getElementById('countNpcs');
      if (cn) cn.textContent = String(nLen);
      const dt = document.getElementById('drawerTotalBadge');
      if (dt) dt.textContent = String(cLen + oLen + pLen + nLen);

      const summaryBox = document.getElementById('mapSummaryCounters');
      if (summaryBox) {
        summaryBox.innerHTML = `
          <span>⭐ <strong>Spawn:</strong> (${this.spawnX}, ${this.spawnY})</span> &bull;
          <span>🛑 <strong>Colisões:</strong> ${cLen} malha(s)</span> &bull;
          <span>🟦 <strong>Sobreposições:</strong> ${oLen} malha(s)</span> &bull;
          <span>🌀 <strong>Portais:</strong> ${pLen}</span> &bull;
          <span>🧙 <strong>NPCs:</strong> ${nLen}</span>
        `;
      }

      const colList = document.getElementById('collisionList');
      if (colList) {
        colList.innerHTML = this.collisionPolygons
          .map((p, idx) => {
            const isEditingThis =
              this.tool === 'EDIT' && this.editableLayerType === 'COLLISION' && idx === this.activeCollisionPolyIndex;
            const isAddingThis = this.tool === 'COLLISION' && idx === this.activeCollisionPolyIndex;
            return `
          <div class="item-row ${isEditingThis || isAddingThis ? 'selected' : ''}">
            <div onclick="AdminApp.selectPolygon('COLLISION', ${idx})" style="cursor:pointer; flex:1;">
              <strong>${isEditingThis ? '🔓' : '🔒'} ${p.name}</strong>
              <span style="color:var(--text-muted); font-size:0.72rem;">(${p.points.length} pts)</span>
            </div>
            <button onclick="AdminApp.enterPolygonEditMode('COLLISION', ${idx})" style="padding:3px 7px; font-size:0.72rem;">
              ${isEditingThis ? '✏️ Editando' : '✏️ Editar'}
            </button>
            <button class="btn-danger" style="padding:3px 7px;" onclick="AdminApp.removePolygon('COLLISION', ${idx})">✕</button>
          </div>`;
          })
          .join('');
      }

      const ovlList = document.getElementById('overlapList');
      if (ovlList) {
        ovlList.innerHTML = this.overlapPolygons
          .map((p, idx) => {
            const isEditingThis =
              this.tool === 'EDIT' && this.editableLayerType === 'OVERLAP' && idx === this.activeOverlapPolyIndex;
            const isAddingThis = this.tool === 'OVERLAP' && idx === this.activeOverlapPolyIndex;
            return `
          <div class="item-row ${isEditingThis || isAddingThis ? 'selected' : ''}">
            <div onclick="AdminApp.selectPolygon('OVERLAP', ${idx})" style="cursor:pointer; flex:1;">
              <strong>${isEditingThis ? '🔓' : '🔒'} ${p.name}</strong>
              <span style="color:var(--text-muted); font-size:0.72rem;">(${p.points.length} pts)</span>
            </div>
            <button onclick="AdminApp.enterPolygonEditMode('OVERLAP', ${idx})" style="padding:3px 7px; font-size:0.72rem;">
              ${isEditingThis ? '✏️ Editando' : '✏️ Editar'}
            </button>
            <button class="btn-danger" style="padding:3px 7px;" onclick="AdminApp.removePolygon('OVERLAP', ${idx})">✕</button>
          </div>`;
          })
          .join('');
      }

      const pList = document.getElementById('portalsList');
      if (pList) {
        pList.innerHTML = this.portals
          .map((p, idx) => {
            const isLinked = Boolean(p.linkedPortalId);
            return `
          <div class="item-row" style="flex-direction:column; align-items:stretch; gap:6px;">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:6px;">
              <input type="text" value="${p.label || `Portal #${idx + 1}`}" onchange="AdminApp.updatePortalLabel(${idx}, this.value)" style="font-weight:700; padding:4px 6px; flex:1;" />
              <span style="font-size:0.72rem; color:var(--text-muted);">(${p.sourceX}, ${p.sourceY})</span>
              <button class="btn-danger" style="padding:2px 6px;" onclick="AdminApp.removePortal(${idx})">✕</button>
            </div>
            <div class="field">
              <label>🔗 Portal Par Interligado (Entrada &harr; Saída):</label>
              <select onchange="AdminApp.onSelectPairedPortal(${idx}, this.value)">
                ${this.buildPairedPortalOptionsHtml(p)}
              </select>
            </div>
            <div style="font-size:0.7rem; padding:4px 6px; border-radius:4px; background:${
              isLinked ? 'rgba(34,197,94,0.14)' : 'rgba(245,158,11,0.12)'
            }; color:${isLinked ? '#86efac' : '#fde68a'};">
              ${
                isLinked
                  ? `🟢 <strong>Dupla Interligada:</strong> Entrar neste portal faz sair no portal par em (${p.targetX}, ${p.targetY}) e vice-versa!`
                  : `⏳ <strong>Aguardando Par:</strong> Salve este mapa e depois vincule lá no mapa de destino.`
              }
            </div>
          </div>`;
          })
          .join('');
      }

      const nList = document.getElementById('npcsList');
      if (nList) {
        nList.innerHTML = this.npcs
          .map((n, idx) => {
            const tpl = this.npcTemplates.find((t) => t.id === Number(n.npcTemplateId));
            const isFlipped = (Number(n.direction) || 0) > 0;
            const thumbHtml = tpl?.thumbUrl
              ? `<img src="${tpl.thumbUrl}" alt="" style="width:34px; height:34px; object-fit:contain; background:#020617; border-radius:4px; border:1px solid var(--border); flex-shrink:0; transform:scaleX(${isFlipped ? -1 : 1}); transition:transform 0.15s ease;" />`
              : '';
            return `
          <div class="item-row ${idx === this.selectedMapNpcIndex ? 'selected' : ''}" style="justify-content:space-between; align-items:center; gap:6px;">
            <div style="display:flex; align-items:center; gap:6px; min-width:0;">
              ${thumbHtml}
              <div style="min-width:0;">
                <strong style="font-size:0.8rem;">🧙 #${idx + 1} ${tpl ? tpl.namePtBr : `NPC #${n.npcTemplateId}`}</strong>
                <div style="font-size:0.68rem; color:var(--text-muted);">
                  Pos: (${n.posX}, ${n.posY}) &bull; <span style="color:#fde047; font-weight:700;">${isFlipped ? '➡️ Virado ↔️' : '⬅️ Padrão'}</span>
                </div>
              </div>
            </div>
            <div style="display:flex; align-items:center; gap:5px;">
              <button type="button" class="btn-primary" onclick="AdminApp.rotateMapNpc(${idx})" style="padding:4px 8px; font-size:0.74rem; font-weight:700;">
                🔄 Girar
              </button>
              <button class="btn-danger" style="padding:3px 7px;" onclick="AdminApp.removeMapNpc(${idx})">✕</button>
            </div>
          </div>`;
          })
          .join('');
      }

      const sheetNpcsBox = document.getElementById('mapSheetNpcsQuickList');
      if (sheetNpcsBox) {
        if (!this.npcs || this.npcs.length === 0) {
          sheetNpcsBox.style.display = 'none';
          sheetNpcsBox.innerHTML = '';
        } else {
          sheetNpcsBox.style.display = 'flex';
          sheetNpcsBox.innerHTML = `
            <div style="font-size:0.75rem; font-weight:700; color:#86efac;">
              🧙 NPCs Posicionados neste Mapa (Gire o sentido direto por aqui sem precisar apagar):
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:8px;">
              ${this.npcs
                .map((n, idx) => {
                  const tpl = this.npcTemplates.find((t) => t.id === Number(n.npcTemplateId));
                  const isFlipped = (Number(n.direction) || 0) > 0;
                  const thumbUrl =
                    tpl?.thumbUrl ||
                    (tpl?.mcreworkNpcKey
                      ? `https://seytanir.github.io/mcrework/assets/npcs/${tpl.mcreworkNpcKey}/thumb.png`
                      : '');
                  return `
                  <div style="display:flex; align-items:center; gap:8px; background:#020617; border:1px solid var(--border); padding:5px 8px; border-radius:8px;">
                    ${
                      thumbUrl
                        ? `<img src="${thumbUrl}" alt="" style="width:32px; height:32px; object-fit:contain; transform:scaleX(${isFlipped ? -1 : 1}); transition:transform 0.15s ease;" />`
                        : ''
                    }
                    <div style="font-size:0.74rem;">
                      <strong>#${idx + 1} ${tpl ? tpl.namePtBr : `NPC #${n.npcTemplateId}`}</strong>
                      <div style="font-size:0.68rem; color:var(--text-muted);">Pos: (${n.posX}, ${n.posY}) &bull; <span style="color:#fde047;">${isFlipped ? '➡️ Virado ↔️' : '⬅️ Padrão'}</span></div>
                    </div>
                    <button type="button" class="btn-primary" onclick="AdminApp.rotateMapNpc(${idx})" style="padding:4px 8px; font-size:0.72rem; font-weight:700;">
                      🔄 Girar
                    </button>
                  </div>`;
                })
                .join('')}
            </div>
          `;
        }
      }
    };

    app.selectPolygon = function (type, idx) {
      if (type === 'COLLISION') {
        this.activeCollisionPolyIndex = idx;
        this.setTool('COLLISION');
      } else {
        this.activeOverlapPolyIndex = idx;
        this.setTool('OVERLAP');
      }
      this.renderLayerLists();
      this.drawCanvas();
    };

    app.removePolygon = function (type, idx) {
      this.pushHistorySnapshot();
      if (type === 'COLLISION') {
        this.collisionPolygons.splice(idx, 1);
        this.activeCollisionPolyIndex = this.collisionPolygons.length - 1;
      } else {
        this.overlapPolygons.splice(idx, 1);
        this.activeOverlapPolyIndex = this.overlapPolygons.length - 1;
      }
      this.renderLayerLists();
      this.drawCanvas();
    };

    app.updatePortalLabel = function (idx, value) {
      if (!this.portals[idx]) return;
      this.pushHistorySnapshot();
      this.portals[idx].label = value.trim() || `Portal #${idx + 1}`;
      this.drawCanvas();
    };

    app.onSelectPairedPortal = function (idx, partnerPortalIdStr) {
      const portal = this.portals[idx];
      if (!portal) return;
      this.pushHistorySnapshot();

      const partnerId = Number(partnerPortalIdStr) || null;
      if (!partnerId) {
        portal.linkedPortalId = null;
        portal.targetMapId = null;
        this.renderLayerLists();
        this.drawCanvas();
        return;
      }

      for (const m of this.savedMaps) {
        const found = (m.outgoingPortals || []).find((rp) => rp.id === partnerId);
        if (found) {
          portal.linkedPortalId = found.id;
          portal.targetMapId = m.id;
          portal.targetX = found.sourceX;
          portal.targetY = found.sourceY;
          break;
        }
      }

      this.renderLayerLists();
      this.drawCanvas();
    };

    app.removePortal = function (idx) {
      this.pushHistorySnapshot();
      this.portals.splice(idx, 1);
      this.renderLayerLists();
      this.drawCanvas();
    };

    app.removeMapNpc = function (idx) {
      this.pushHistorySnapshot();
      this.npcs.splice(idx, 1);
      this.renderLayerLists();
      this.drawCanvas();
    };
  }
}

window.AdminLayersDrawer = AdminLayersDrawer;
