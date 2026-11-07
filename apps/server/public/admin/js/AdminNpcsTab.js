/**
 * @file apps/server/public/admin/js/AdminNpcsTab.js
 * @module @etheria/server
 * @description Submódulo da Aba NPCs / Templates (`npc_templates`) da Rota `/admin`.
 *   Inclui busca em tempo real nos 365 assets do mcrework, CRUD de funções interativas e tabela de posicionamentos.
 */

class AdminNpcsTab {
  static attach(app) {
    app.openNpcTemplateModal = async function (editNpcId = null) {
      document.getElementById('npcModal').style.display = 'flex';
      const existingNpc = editNpcId ? this.npcTemplates.find((n) => n.id === Number(editNpcId)) : null;

      if (existingNpc) {
        document.getElementById('npcModalTitle').textContent = `✏️ Editar NPC #${existingNpc.id} (${existingNpc.code})`;
        document.getElementById('npcEditIdInput').value = String(existingNpc.id);
        document.getElementById('npcCodeInput').value = `#${existingNpc.id} • ${existingNpc.code}`;
        document.getElementById('npcNameInput').value = existingNpc.namePtBr || '';
        document.getElementById('npcAssetKeyInput').value = existingNpc.mcreworkNpcKey || '';
      } else {
        const maxNpcId = this.npcTemplates.reduce((acc, n) => Math.max(acc, Number(n.id) || 0), 0);
        const nextNpcId = maxNpcId + 1;
        document.getElementById('npcModalTitle').textContent = `🧙 Novo NPC #${nextNpcId} (npc_${nextNpcId})`;
        document.getElementById('npcEditIdInput').value = '';
        document.getElementById('npcCodeInput').value = `#${nextNpcId} • npc_${nextNpcId} (Automático)`;
        document.getElementById('npcNameInput').value = '';
        document.getElementById('npcAssetKeyInput').value = '';
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
        if (document.getElementById('visualMapEditorScreen').style.display === 'flex') {
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
              : placements
                  .map(
                    (pl) =>
                      `<div style="font-size:0.76rem; color:#86efac;">📍 <strong>${pl.mapNamePtBr}</strong> (X:${pl.posX}, Y:${pl.posY})</div>`
                  )
                  .join('');

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
