/**
 * @file apps/server/public/admin/js/AdminNpcsTab.js
 * @module @etheria/server
 * @description Submódulo da Aba NPCs / Templates (`npc_templates`) da Rota `/admin`.
 *   Inclui busca em tempo real nos 365 assets do mcrework, CRUD e rotação direta (`0 ↔ 1`) de NPCs
 *   já posicionados nos mapas sem precisar apagá-los ou recriá-los.
 */

class AdminNpcsTab {
  static attach(app) {
    app.renderNpcModalPlacements = function (npcId) {
      const box = document.getElementById('npcModalPlacementsContainer');
      if (!box) return;
      const existingNpc = npcId ? this.npcTemplates.find((n) => n.id === Number(npcId)) : null;
      const placements = existingNpc && Array.isArray(existingNpc.placements) ? existingNpc.placements : [];

      if (!existingNpc || placements.length === 0) {
        box.style.display = 'none';
        box.innerHTML = '';
        return;
      }

      const thumbUrl =
        existingNpc.thumbUrl || `https://seytanir.github.io/mcrework/assets/npcs/${existingNpc.mcreworkNpcKey}/thumb.png`;

      box.style.display = 'flex';
      box.innerHTML = `
        <div style="font-size:0.76rem; font-weight:700; color:#86efac;">
          📍 Mapas onde este NPC já está posicionado (Gire o sentido sem precisar apagar):
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:8px;">
          ${placements
            .map((pl) => {
              const isFlipped = (Number(pl.direction) || 0) > 0;
              return `
              <div style="display:flex; align-items:center; gap:8px; background:#020617; border:1px solid var(--border); padding:5px 8px; border-radius:8px;">
                <img src="${thumbUrl}" alt="" style="width:32px; height:32px; object-fit:contain; transform:scaleX(${isFlipped ? -1 : 1}); transition:transform 0.15s ease;" />
                <div style="font-size:0.74rem;">
                  <strong>📍 ${pl.mapNamePtBr}</strong>
                  <div style="font-size:0.68rem; color:var(--text-muted);">Pos: (${pl.posX}, ${pl.posY}) &bull; <span style="color:#fde047;">${isFlipped ? '➡️ Virado ↔️' : '⬅️ Padrão'}</span></div>
                </div>
                <button type="button" class="btn-primary" onclick="AdminApp.rotateRegisteredMapNpc(${pl.id})" style="padding:4px 8px; font-size:0.72rem;">
                  🔄 Girar
                </button>
              </div>`;
            })
            .join('')}
        </div>
      `;
    };

    app.rotateRegisteredMapNpc = async function (placementId) {
      try {
        const updated = await this.api(`/api/admin/map-npcs/${placementId}/rotate`, {
          method: 'POST',
        });

        const data = await this.api('/api/admin/maps/bootstrap');
        this.npcTemplates = data.npcTemplates || [];
        this.savedMaps = data.maps || [];

        // Se o mapa deste posicionamento estiver aberto no editor atual, sincroniza em memória
        if (this.currentMapId && Number(this.currentMapId) === Number(updated.mapId)) {
          const currentMapObj = this.savedMaps.find((m) => Number(m.id) === Number(this.currentMapId));
          if (currentMapObj && Array.isArray(currentMapObj.npcs)) {
            this.npcs = JSON.parse(JSON.stringify(currentMapObj.npcs));
          } else {
            const targetInMem = (this.npcs || []).find(
              (n) =>
                Number(n.id) === Number(placementId) ||
                (Number(n.npcTemplateId) === Number(updated.npcTemplateId) &&
                  Number(n.posX) === Number(updated.posX) &&
                  Number(n.posY) === Number(updated.posY))
            );
            if (targetInMem) {
              targetInMem.direction = updated.direction;
            }
          }
        }

        this.renderNpcsCrudTable();
        this.renderLayerLists();
        this.drawCanvas();

        const openEditNpcId = document.getElementById('npcEditIdInput')?.value;
        if (openEditNpcId) {
          this.renderNpcModalPlacements(Number(openEditNpcId));
        }
      } catch (err) {
        alert(`Erro ao girar NPC registrado: ${err.message}`);
      }
    };

    app.openNpcTemplateModal = async function (editNpcId = null) {
      document.getElementById('npcModal').style.display = 'flex';
      const existingNpc = editNpcId ? this.npcTemplates.find((n) => n.id === Number(editNpcId)) : null;

      if (existingNpc) {
        document.getElementById('npcModalTitle').textContent = `✏️ Editar NPC #${existingNpc.id} (${existingNpc.code})`;
        document.getElementById('npcEditIdInput').value = String(existingNpc.id);
        document.getElementById('npcCodeInput').value = `#${existingNpc.id} • ${existingNpc.code}`;
        document.getElementById('npcNameInput').value = existingNpc.namePtBr || '';
        document.getElementById('npcAssetKeyInput').value = existingNpc.mcreworkNpcKey || '';
        this.renderNpcModalPlacements(existingNpc.id);
      } else {
        const maxNpcId = this.npcTemplates.reduce((acc, n) => Math.max(acc, Number(n.id) || 0), 0);
        const nextNpcId = maxNpcId + 1;
        document.getElementById('npcModalTitle').textContent = `🧙 Novo NPC #${nextNpcId} (npc_${nextNpcId})`;
        document.getElementById('npcEditIdInput').value = '';
        document.getElementById('npcCodeInput').value = `#${nextNpcId} • npc_${nextNpcId} (Automático)`;
        document.getElementById('npcNameInput').value = '';
        document.getElementById('npcAssetKeyInput').value = '';
        this.renderNpcModalPlacements(null);
      }

      const grid = document.getElementById('mcreworkNpcsGrid');
      if (this.mcreworkNpcs.length === 0) {
        grid.innerHTML = '<div>Carregando os 365 NPCs do mcrework...</div>';
        try {
          this.mcreworkNpcs = await this.api('/api/admin/mcrework/npcs');
        } catch (err) {
          grid.innerHTML = `<div style="color:#fca5a5;">${err.message}</div>`;
          return;
        }
      }

      this.npcSearchQuery = '';
      const searchInput = document.getElementById('npcSearchInput');
      if (searchInput) searchInput.value = '';
      this.renderNpcGallery();
    };

    app.filterNpcGallery = function () {
      const input = document.getElementById('npcSearchInput');
      this.npcSearchQuery = (input ? input.value : '').toLowerCase().trim();
      this.renderNpcGallery();
    };

    app.renderNpcGallery = function () {
      const grid = document.getElementById('mcreworkNpcsGrid');
      if (!grid) return;
      const currentSelected = (document.getElementById('npcAssetKeyInput').value || '').trim();

      const filtered = this.mcreworkNpcs.filter((n) => {
        if (!this.npcSearchQuery) return true;
        return n.mcreworkNpcKey.toLowerCase().includes(this.npcSearchQuery);
      });

      if (filtered.length === 0) {
        grid.innerHTML = `<div style="grid-column:1/-1; color:var(--text-muted); padding:16px; text-align:center;">Nenhum NPC encontrado para "${this.npcSearchQuery}".</div>`;
        return;
      }

      grid.innerHTML = filtered
        .map(
          (n) => `
        <div class="gallery-card ${n.mcreworkNpcKey === currentSelected ? 'selected' : ''}" onclick="AdminApp.pickNpcAsset('${n.mcreworkNpcKey}')">
          <img src="${n.thumbUrl}" alt="${n.mcreworkNpcKey}" loading="lazy" style="object-fit:contain;" />
          <strong style="font-size:0.75rem;">${n.mcreworkNpcKey}</strong>
        </div>`
        )
        .join('');
    };

    app.pickNpcAsset = function (npcKey) {
      document.getElementById('npcAssetKeyInput').value = npcKey;
      this.renderNpcGallery();
    };

    app.saveNewNpcTemplate = async function () {
      try {
        const editId = document.getElementById('npcEditIdInput').value.trim();
        const namePtBr = document.getElementById('npcNameInput').value.trim();
        const mcreworkNpcKey = document.getElementById('npcAssetKeyInput').value.trim();

        if (!mcreworkNpcKey) {
          alert('Toque em um visual de NPC da galeria abaixo para selecioná-lo.');
          return;
        }

        const path = editId ? `/api/admin/npc-templates/${editId}` : '/api/admin/npc-templates';
        const method = editId ? 'PUT' : 'POST';

        const saved = await this.api(path, {
          method,
          body: JSON.stringify({
            namePtBr,
            mcreworkNpcKey,
            isDecorationOnly: false,
            triggersJson: [],
          }),
        });

        this.closeModal('npcModal');
        const data = await this.api('/api/admin/maps/bootstrap');
        this.npcTemplates = data.npcTemplates || [];
        this.renderSelectOptions();
        this.renderNpcsCrudTable();
        this.renderLayerLists();
        this.drawCanvas();
        document.getElementById('activeNpcTemplateSelect').value = String(saved.id);
        if (this.awaitingTeleportNpcTemplateCreation) {
          this.awaitingTeleportNpcTemplateCreation = false;
          if (typeof this.openTeleportNpcModal === 'function') {
            this.openTeleportNpcModal(null, saved.id);
          }
        } else if (document.getElementById('visualMapEditorScreen').style.display === 'flex') {
          this.setTool('NPC');
        }
      } catch (err) {
        alert(`Erro ao salvar NPC: ${err.message}`);
      }
    };

    app.renderNpcsCrudTable = function () {
      const tbody = document.getElementById('npcsTableBody');
      if (!tbody) return;

      if (this.npcTemplates.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="color:var(--text-muted); padding:14px;">Nenhum NPC cadastrado ainda. Crie um NPC pelo botão <strong>"➕ Novo NPC do mcrework"</strong> acima ou direto dentro do Editor Visual do Mapa na ferramenta <strong>"🧙 +NPC"</strong>!</td></tr>`;
        return;
      }

      tbody.innerHTML = this.npcTemplates
        .map((n) => {
          const thumbUrl = n.thumbUrl || `https://seytanir.github.io/mcrework/assets/npcs/${n.mcreworkNpcKey}/thumb.png`;

          const placements = Array.isArray(n.placements) ? n.placements : [];
          const placementsHtml =
            placements.length === 0
              ? `<span style="color:var(--text-muted); font-size:0.75rem;">Ainda não posicionado em mapas</span>`
              : `<div style="display:flex; flex-direction:column; gap:6px;">
                  ${placements
                    .map((pl) => {
                      const isFlipped = (Number(pl.direction) || 0) > 0;
                      return `
                      <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; background:rgba(15,23,42,0.75); border:1px solid var(--border); padding:4px 8px; border-radius:6px;">
                        <div style="display:flex; align-items:center; gap:6px;">
                          <img src="${thumbUrl}" alt="" style="width:28px; height:28px; object-fit:contain; background:#020617; border-radius:4px; transform:scaleX(${isFlipped ? -1 : 1}); transition:transform 0.15s ease;" title="${isFlipped ? 'Virado / Espelhado' : 'Sentido Padrão'}" />
                          <span style="font-size:0.75rem; color:#86efac;">
                            📍 <strong>${pl.mapNamePtBr}</strong> (X:${pl.posX}, Y:${pl.posY})
                            <span style="color:#fde047; font-size:0.7rem; margin-left:4px;">[${isFlipped ? '➡️ Virado ↔️' : '⬅️ Padrão'}]</span>
                          </span>
                        </div>
                        <button type="button" class="btn-primary" onclick="AdminApp.rotateRegisteredMapNpc(${pl.id})" style="padding:3px 8px; font-size:0.72rem; white-space:nowrap;" title="Girar este NPC diretamente no mapa sem precisar apagar">
                          🔄 Girar
                        </button>
                      </div>`;
                    })
                    .join('')}
                </div>`;

          return `
        <tr>
          <td><strong>#${n.id}</strong> &bull; <span style="color:var(--accent);">${n.code}</span></td>
          <td>
            <div style="display:flex; align-items:center; gap:8px;">
              <img src="${thumbUrl}" alt="${n.mcreworkNpcKey}" style="width:44px; height:44px; object-fit:contain; background:#020617; border-radius:6px; border:1px solid var(--border);" />
              <span style="font-size:0.75rem; color:var(--text-muted);">${n.mcreworkNpcKey}</span>
            </div>
          </td>
          <td><strong>${n.namePtBr}</strong></td>
          <td>${placementsHtml}</td>
          <td>
            <div style="display:flex; gap:6px;">
              <button onclick="AdminApp.openNpcTemplateModal(${n.id})">✏️ Editar</button>
              <button class="btn-danger" onclick="AdminApp.deleteNpcTemplate(${n.id})">🗑️</button>
            </div>
          </td>
        </tr>`;
        })
        .join('');
    };

    app.deleteNpcTemplate = async function (id) {
      if (!confirm('Deseja realmente excluir este NPC da tabela (e removê-lo dos mapas onde estiver posicionado)?')) return;
      try {
        await this.api(`/api/admin/npc-templates/${id}`, { method: 'DELETE' });
        this.npcs = this.npcs.filter((x) => Number(x.npcTemplateId) !== Number(id));
        await this.loadBootstrapData();
        this.renderLayerLists();
        this.drawCanvas();
      } catch (err) {
        alert(`Erro ao excluir NPC: ${err.message}`);
      }
    };
  }
}

window.AdminNpcsTab = AdminNpcsTab;
