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

        const roles = Array.isArray(existingNpc.rolesJson) ? existingNpc.rolesJson : [];
        const roleSet = new Set(roles.map((r) => String(r).toUpperCase()));
        document.querySelectorAll('input[name="npcRoleCheckbox"]').forEach((chk) => {
          chk.checked = roleSet.has(chk.value.toUpperCase());
        });
        if (typeof this.populateNpcShopDropdown === 'function') {
          this.populateNpcShopDropdown(existingNpc.shopTemplateId || null);
        }
      } else {
        const maxNpcId = this.npcTemplates.reduce((acc, n) => Math.max(acc, Number(n.id) || 0), 0);
        const nextNpcId = maxNpcId + 1;
        document.getElementById('npcModalTitle').textContent = `🧙 Novo NPC #${nextNpcId} (npc_${nextNpcId})`;
        document.getElementById('npcEditIdInput').value = '';
        document.getElementById('npcCodeInput').value = `#${nextNpcId} • npc_${nextNpcId} (Automático)`;
        document.getElementById('npcNameInput').value = '';
        document.getElementById('npcAssetKeyInput').value = '';
        this.renderNpcModalPlacements(null);

        document.querySelectorAll('input[name="npcRoleCheckbox"]').forEach((chk) => {
          chk.checked = false;
        });
        if (typeof this.populateNpcShopDropdown === 'function') {
          this.populateNpcShopDropdown(null);
        }
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

        const checkedRoles = Array.from(document.querySelectorAll('input[name="npcRoleCheckbox"]:checked')).map((c) => c.value);
        const shopVal = document.getElementById('npcShopTemplateSelect')?.value || '';
        const shopTemplateId = shopVal ? Number(shopVal) : null;
        if (shopTemplateId && !checkedRoles.includes('SHOP')) {
          checkedRoles.push('SHOP');
        }

        const saved = await this.api(path, {
          method,
          body: JSON.stringify({
            namePtBr,
            mcreworkNpcKey,
            isDecorationOnly: false,
            rolesJson: checkedRoles,
            shopTemplateId,
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
        tbody.innerHTML = `<tr><td colspan="6" style="color:var(--text-muted); padding:14px;">Nenhum NPC cadastrado ainda. Crie um NPC pelo botão <strong>"➕ Novo NPC do mcrework"</strong> acima ou direto dentro do Editor Visual do Mapa na ferramenta <strong>"🧙 +NPC"</strong>!</td></tr>`;
        return;
      }

      tbody.innerHTML = this.npcTemplates
        .map((n) => {
          const thumbUrl = n.thumbUrl || `https://seytanir.github.io/mcrework/assets/npcs/${n.mcreworkNpcKey}/thumb.png`;

          const rawRoles = Array.isArray(n.rolesJson) ? n.rolesJson : [];
          const roleBadgeConfigs = {
            TELEPORT: { label: '🌀 Teletransporte', bg: '#2563eb', color: '#fff' },
            SHOP: { label: n.shopNamePtBr ? `🏪 Loja (${n.shopNamePtBr})` : '🏪 Loja', bg: '#059669', color: '#fff' },
            ARMORER: { label: '🛡️ Armeiro', bg: '#6366f1', color: '#fff' },
            HUNTER: { label: '🐾 Caçador', bg: '#d97706', color: '#fff' },
            ALCHEMIST: { label: '⚗️ Alquimista', bg: '#7c3aed', color: '#fff' },
            CHEF: { label: '🍲 Cozinheiro', bg: '#db2777', color: '#fff' },
            MINER: { label: '⛏️ Minerador', bg: '#57534e', color: '#fff' },
          };

          const rolesBadges =
            rawRoles.length > 0
              ? rawRoles
                  .map((r) => {
                    const cfg = roleBadgeConfigs[r] || { label: r, bg: '#475569', color: '#fff' };
                    return `<span style="background:${cfg.bg}; color:${cfg.color}; font-size:0.67rem; font-weight:700; padding:2px 6px; border-radius:4px; display:inline-block; white-space:nowrap;">${cfg.label}</span>`;
                  })
                  .join(' ')
              : `<span style="color:var(--text-muted); font-size:0.72rem; font-style:italic;">Sem funções</span>`;

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
          <td>
            <div style="display:flex; flex-wrap:wrap; gap:4px; max-width:200px;">
              ${rolesBadges}
            </div>
          </td>
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

    app.openHunterCostRulesModal = async function () {
      let modal = document.getElementById('hunterCostRulesModal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'hunterCostRulesModal';
        modal.className = 'modal-backdrop';
        modal.innerHTML = `
          <div class="modal-box" style="max-width:540px; max-height:90dvh; display:flex; flex-direction:column; overflow:hidden;">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:8px;">
              <h3 style="margin:0; display:flex; align-items:center; gap:8px;">
                <span>🐾</span> <span>Tabela de Custos do Caçador (Criação de Pets)</span>
              </h3>
              <button class="btn-danger" type="button" onclick="document.getElementById('hunterCostRulesModal').style.display='none'">✕ Fechar</button>
            </div>
            <p style="font-size:0.78rem; color:var(--text-muted); margin:10px 0 6px 0;">
              Defina a quantidade de <strong>Essências de Monstros</strong> exigida para invocar um pet de cada raridade. Qualquer alteração aqui é sincronizada em tempo real com a rota <code>/play</code> e salva no snapshot do projeto.
            </p>
            <div id="hunterCostRulesList" style="flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:8px; margin:8px 0; padding-right:4px;">
              <div style="color:var(--text-muted); font-size:0.85rem; padding:12px; text-align:center;">Carregando regras...</div>
            </div>
            <div style="display:flex; justify-content:flex-end; gap:8px; border-top:1px solid var(--border); padding-top:10px; margin-top:6px;">
              <button type="button" class="btn-secondary" onclick="document.getElementById('hunterCostRulesModal').style.display='none'">Cancelar</button>
              <button type="button" class="btn-primary" onclick="AdminApp.saveHunterCostRules()" style="background:#10b981; border-color:#059669;">💾 Salvar Tabela de Custos</button>
            </div>
          </div>
        `;
        document.body.appendChild(modal);
      }

      modal.style.display = 'flex';
      const container = document.getElementById('hunterCostRulesList');
      container.innerHTML = '<div style="color:var(--text-muted); font-size:0.85rem; padding:12px; text-align:center;">Carregando regras...</div>';

      try {
        const rules = await this.api('/api/admin/hunter/costs');
        const rarityColors = {
          F: { bg: 'rgba(148, 163, 184, 0.2)', border: '#94a3b8', text: '#cbd5e1' },
          D: { bg: 'rgba(96, 165, 250, 0.2)', border: '#60a5fa', text: '#93c5fd' },
          C: { bg: 'rgba(74, 222, 128, 0.2)', border: '#4ade80', text: '#86efac' },
          B: { bg: 'rgba(168, 85, 247, 0.2)', border: '#a855f7', text: '#d8b4fe' },
          A: { bg: 'rgba(245, 158, 11, 0.2)', border: '#f59e0b', text: '#fde68a' },
          S: { bg: 'rgba(239, 68, 68, 0.2)', border: '#ef4444', text: '#fca5a5' },
          SS: { bg: 'rgba(236, 72, 153, 0.2)', border: '#ec4899', text: '#fbcfe8' },
        };

        const tiers = ['F', 'D', 'C', 'B', 'A', 'S', 'SS'];
        container.innerHTML = tiers.map((tier) => {
          const rule = (Array.isArray(rules) ? rules : []).find((r) => r.rarityTier === tier) || {
            rarityTier: tier,
            essenceCost: tier === 'F' ? 30 : tier === 'D' ? 70 : tier === 'C' ? 120 : tier === 'B' ? 300 : tier === 'A' ? 700 : tier === 'S' ? 1600 : 3500,
            goldCost: 0,
          };
          const colors = rarityColors[tier] || { bg: '#334155', border: '#64748b', text: '#fff' };
          return `
            <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; background:#0f172a; border:1px solid var(--border); padding:8px 12px; border-radius:8px;">
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-weight:900; font-size:0.85rem; padding:3px 10px; border-radius:6px; background:${colors.bg}; border:1px solid ${colors.border}; color:${colors.text};">
                  Rank ${tier}
                </span>
                <span style="font-size:0.75rem; color:var(--text-muted);">Criação de Pet</span>
              </div>
              <div style="display:flex; align-items:center; gap:6px;">
                <label style="font-size:0.72rem; color:var(--text-muted); margin:0;">Essências:</label>
                <input type="number" id="hunterCost_${tier}" value="${rule.essenceCost}" min="1" max="99999" step="1"
                       style="width:90px; padding:4px 8px; font-weight:700; color:#38bdf8; background:#020617; border:1px solid var(--border); border-radius:6px; text-align:right;" />
              </div>
            </div>
          `;
        }).join('');
      } catch (err) {
        container.innerHTML = `<div style="color:#f87171; padding:12px; text-align:center;">Erro ao carregar regras: ${err.message}</div>`;
      }
    };

    app.saveHunterCostRules = async function () {
      const tiers = ['F', 'D', 'C', 'B', 'A', 'S', 'SS'];
      const payload = [];

      for (const tier of tiers) {
        const inp = document.getElementById(`hunterCost_${tier}`);
        const val = inp ? Number(inp.value) : 0;
        if (!val || val <= 0) {
          alert(`O custo de essências para o Rank ${tier} deve ser no mínimo 1.`);
          return;
        }
        payload.push({ rarityTier: tier, essenceCost: val, goldCost: 0 });
      }

      try {
        await this.api('/api/admin/hunter/costs', {
          method: 'PUT',
          body: JSON.stringify({ rules: payload }),
        });
        alert('✅ Tabela de Custos do Caçador atualizada e sincronizada com sucesso!');
        document.getElementById('hunterCostRulesModal').style.display = 'none';
      } catch (err) {
        alert(`Erro ao salvar regras de custo: ${err.message}`);
      }
    };
  }
}

window.AdminNpcsTab = AdminNpcsTab;
