/**
 * @file apps/server/public/admin/js/AdminTeleportNpcsTab.js
 * @module @etheria/server
 * @description Módulo de Gerenciamento de NPCs de Teleporte / Guias de Viagem na Edição de Mapas.
 *   Permite selecionar um NPC existente da tabela ou criar um novo no mcrework,
 *   posicioná-lo no mapa atual e configurar múltiplos destinos de viagem baseados nos mapas cadastrados.
 */

class AdminTeleportNpcsTab {
  static injectModalDom() {
    if (document.getElementById('teleportNpcModal')) return;

    const modalDiv = document.createElement('div');
    modalDiv.id = 'teleportNpcModal';
    modalDiv.className = 'modal-backdrop';
    modalDiv.style.display = 'none';
    modalDiv.innerHTML = `
      <div class="modal-box" style="max-width:860px; max-height:92dvh; display:flex; flex-direction:column; overflow-y:auto; gap:10px;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:8px;">
          <h3 id="teleportModalTitle" style="font-size:1rem; color:#38bdf8; display:flex; align-items:center; gap:6px;">
            🌀 Configurar NPC de Teleporte no Mapa
          </h3>
          <button class="btn-danger" onclick="AdminApp.closeModal('teleportNpcModal')">✕ Fechar</button>
        </div>
        <input type="hidden" id="tpModalMapNpcIndex" value="" />
        <input type="hidden" id="tpModalPlacementId" value="" />

        <!-- 1. ESCOLHA DO NPC -->
        <div style="background:rgba(15,23,42,0.85); border:1px solid var(--border); border-radius:8px; padding:10px; display:flex; flex-direction:column; gap:8px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
            <strong style="font-size:0.84rem; color:#86efac;">1. Escolher NPC (Template Oficial)</strong>
            <button type="button" class="btn-primary" onclick="AdminApp.openNpcTemplateModalFromTeleport()" style="font-size:0.75rem; padding:4px 9px;">
              ➕ Criar Novo NPC no mcrework
            </button>
          </div>
          <div style="display:flex; gap:10px; align-items:center;">
            <div id="tpNpcThumbPreview" style="width:52px; height:52px; background:#020617; border:1px solid var(--border); border-radius:6px; display:flex; align-items:center; justify-content:center; flex-shrink:0; overflow:hidden;">
              <span style="font-size:1.4rem;">🧙</span>
            </div>
            <div style="flex:1; min-width:0;">
              <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:3px;">
                Selecione um NPC cadastrado na tabela de NPCs:
              </label>
              <select id="tpNpcTemplateSelect" onchange="AdminApp.onTeleportNpcTemplateChanged()" style="width:100%; padding:7px 9px; font-size:0.82rem; background:#0f172a; border:1px solid var(--border); border-radius:6px; color:#f8fafc;"></select>
            </div>
          </div>
        </div>

        <!-- 2. POSIÇÃO E SENTIDO NO MAPA ATUAL -->
        <div style="background:rgba(15,23,42,0.85); border:1px solid var(--border); border-radius:8px; padding:10px; display:flex; flex-direction:column; gap:8px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
            <strong style="font-size:0.84rem; color:#86efac;">
              2. Posição no Mapa Atual (<span id="tpCurrentMapName" style="color:#fde047;"></span>)
            </strong>
            <button type="button" onclick="AdminApp.useCurrentMapSpawnForTeleportNpc()" style="font-size:0.72rem; padding:4px 8px;">
              🎯 Usar Ponto de Spawn deste Mapa
            </button>
          </div>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:8px;">
            <div class="field" style="margin:0;">
              <label style="font-size:0.75rem; color:var(--text-muted);">Posição X:</label>
              <input type="number" id="tpPosX" style="padding:6px 8px; font-size:0.82rem;" value="500" step="1" />
            </div>
            <div class="field" style="margin:0;">
              <label style="font-size:0.75rem; color:var(--text-muted);">Posição Y:</label>
              <input type="number" id="tpPosY" style="padding:6px 8px; font-size:0.82rem;" value="500" step="1" />
            </div>
            <div class="field" style="margin:0;">
              <label style="font-size:0.75rem; color:var(--text-muted);">Sentido Visual:</label>
              <select id="tpDirection" style="padding:6px 8px; font-size:0.82rem;">
                <option value="0">⬅️ Padrão</option>
                <option value="1">➡️ Virado ↔️</option>
              </select>
            </div>
          </div>
        </div>

        <!-- 3. LOCAIS DE DESTINO -->
        <div style="background:rgba(15,23,42,0.85); border:1px solid var(--border); border-radius:8px; padding:10px; display:flex; flex-direction:column; gap:8px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
            <div>
              <strong style="font-size:0.84rem; color:#38bdf8;">
                3. Locais de Destino deste NPC (<span id="tpDestinationsCountBadge">0</span>)
              </strong>
              <p style="font-size:0.72rem; color:var(--text-muted); margin:2px 0 0 0;">
                Defina para quais locais dos mapas disponíveis este NPC pode transportar o jogador.
              </p>
            </div>
            <button type="button" class="btn-success" onclick="AdminApp.addTeleportDestinationRow()" style="font-size:0.75rem; padding:5px 10px; font-weight:700;">
              ➕ Adicionar Destino
            </button>
          </div>
          <div id="tpDestinationsContainer" style="display:flex; flex-direction:column; gap:8px; max-height:280px; overflow-y:auto; padding-right:4px;"></div>
        </div>

        <!-- RODAPÉ -->
        <div style="display:flex; gap:10px; justify-content:flex-end; border-top:1px solid var(--border); padding-top:8px;">
          <button type="button" class="btn-danger" onclick="AdminApp.closeModal('teleportNpcModal')">✕ Cancelar</button>
          <button type="button" class="btn-success" onclick="AdminApp.saveTeleportNpcFromModal()" style="padding:8px 18px; font-weight:700;">
            💾 Salvar NPC de Teleporte
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modalDiv);
  }

  static attach(app) {
    AdminTeleportNpcsTab.injectModalDom();

    // Estado temporário dos destinos em edição no modal
    app.activeModalDestinations = [];
    app.awaitingTeleportNpcTemplateCreation = false;

    /**
     * Renderiza a Tabela de NPCs de Teleporte deste Mapa na Ficha Técnica (`tabMaps`).
     */
    app.renderMapTeleportNpcsTable = function () {
      const container = document.getElementById('mapTeleportNpcsContainer');
      if (!container) return;

      if (!this.currentMapId) {
        container.style.display = 'none';
        container.innerHTML = '';
        return;
      }
      container.style.display = 'block';

      // Identifica NPCs com destinos de teleporte
      const teleportNpcs = (this.npcs || [])
        .map((n, idx) => ({ ...n, inMemoryIndex: idx }))
        .filter((n) => Array.isArray(n.teleportDestinationsJson) && n.teleportDestinationsJson.length > 0);

      const curMap = this.savedMaps.find((m) => Number(m.id) === Number(this.currentMapId));
      const curMapName = curMap ? curMap.namePtBr : `Mapa #${this.currentMapId}`;

      let contentHtml = '';
      if (teleportNpcs.length === 0) {
        contentHtml = `
          <div style="background:rgba(15,23,42,0.65); border:1px dashed var(--border); border-radius:8px; padding:12px; text-align:center;">
            <p style="font-size:0.78rem; color:var(--text-muted); margin:0 0 8px 0;">
              Nenhum NPC de teleporte posicionado em <strong>${curMapName}</strong> ainda.
            </p>
            <button type="button" class="btn-primary" onclick="AdminApp.openTeleportNpcModal(null)" style="font-size:0.75rem; padding:5px 12px; font-weight:700;">
              ➕ Adicionar NPC de Teleporte
            </button>
          </div>
        `;
      } else {
        contentHtml = `
          <div style="overflow-x:auto;">
            <table class="crud-table" style="margin:0; font-size:0.76rem;">
              <thead>
                <tr>
                  <th style="padding:6px 8px;">NPC</th>
                  <th style="padding:6px 8px;">Posição (X, Y)</th>
                  <th style="padding:6px 8px;">Sentido</th>
                  <th style="padding:6px 8px;">Locais de Destino (${teleportNpcs.length})</th>
                  <th style="padding:6px 8px; text-align:right;">Ações</th>
                </tr>
              </thead>
              <tbody>
                ${teleportNpcs
                  .map((tn) => {
                    const tpl = this.npcTemplates.find((t) => t.id === Number(tn.npcTemplateId));
                    const isFlipped = (Number(tn.direction) || 0) > 0;
                    const thumbUrl =
                      tpl?.thumbUrl ||
                      (tpl?.mcreworkNpcKey
                        ? `https://seytanir.github.io/mcrework/assets/npcs/${tpl.mcreworkNpcKey}/thumb.png`
                        : '');
                    const destinations = Array.isArray(tn.teleportDestinationsJson) ? tn.teleportDestinationsJson : [];

                    const destinationsBadges = destinations
                      .map((d) => {
                        const targetMap = this.savedMaps.find((m) => Number(m.id) === Number(d.targetMapId));
                        const targetName = targetMap ? targetMap.namePtBr : `Mapa #${d.targetMapId}`;
                        const reqLvl = d.requiredLevel || targetMap?.requiredLevel || 1;
                        const costText = d.costGold ? ` • 🪙 ${d.costGold}g` : '';
                        const labelText = d.label ? `"${d.label}"` : targetName;
                        return `
                          <span style="display:inline-flex; align-items:center; gap:4px; background:rgba(56,189,248,0.14); border:1px solid rgba(56,189,248,0.35); color:#7dd3fc; padding:2px 6px; border-radius:4px; font-size:0.70rem; margin:1px 2px;">
                            📍 <strong>${targetName}</strong> [${labelText} • Nv.${reqLvl}+${costText}]
                          </span>
                        `;
                      })
                      .join('');

                    return `
                      <tr>
                        <td style="padding:6px 8px;">
                          <div style="display:flex; align-items:center; gap:6px;">
                            ${
                              thumbUrl
                                ? `<img src="${thumbUrl}" alt="" style="width:32px; height:32px; object-fit:contain; background:#020617; border-radius:4px; border:1px solid var(--border); transform:scaleX(${isFlipped ? -1 : 1});" />`
                                : '🧙'
                            }
                            <div>
                              <strong>${tpl ? tpl.namePtBr : `NPC #${tn.npcTemplateId}`}</strong>
                              <div style="font-size:0.68rem; color:var(--text-muted);">${tpl ? tpl.code : ''}</div>
                            </div>
                          </div>
                        </td>
                        <td style="padding:6px 8px; white-space:nowrap;">
                          X: <strong>${tn.posX}</strong>, Y: <strong>${tn.posY}</strong>
                        </td>
                        <td style="padding:6px 8px; white-space:nowrap;">
                          <button type="button" class="btn-primary" onclick="AdminApp.rotateMapNpc(${tn.inMemoryIndex})" style="padding:3px 7px; font-size:0.70rem;">
                            🔄 ${isFlipped ? '➡️ Virado' : '⬅️ Padrão'}
                          </button>
                        </td>
                        <td style="padding:6px 8px;">
                          <div style="display:flex; flex-wrap:wrap; gap:3px;">
                            ${destinationsBadges}
                          </div>
                        </td>
                        <td style="padding:6px 8px; text-align:right; white-space:nowrap;">
                          <div style="display:flex; gap:4px; justify-content:flex-end;">
                            <button type="button" class="btn-primary" onclick="AdminApp.openTeleportNpcModal(${tn.inMemoryIndex})" style="padding:3px 8px; font-size:0.72rem; font-weight:700;">
                              🌀 Destinos
                            </button>
                            <button type="button" class="btn-danger" onclick="AdminApp.removeMapNpc(${tn.inMemoryIndex})" style="padding:3px 7px; font-size:0.72rem;">
                              ✕
                            </button>
                          </div>
                        </td>
                      </tr>
                    `;
                  })
                  .join('')}
              </tbody>
            </table>
          </div>
        `;
      }

      container.innerHTML = `
        <div style="background:rgba(15,23,42,0.85); border:1px solid var(--border); border-radius:8px; padding:12px; display:flex; flex-direction:column; gap:8px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <h4 style="margin:0; font-size:0.88rem; color:#38bdf8; display:flex; align-items:center; gap:6px;">
                🌀 Tabela de NPCs de Teleporte deste Mapa
              </h4>
              <span style="font-size:0.72rem; background:rgba(56,189,248,0.2); color:#7dd3fc; padding:2px 8px; border-radius:12px; font-weight:700;">
                ${teleportNpcs.length} Teleportador(es)
              </span>
            </div>
            <button type="button" class="btn-primary" onclick="AdminApp.openTeleportNpcModal(null)" style="font-size:0.74rem; padding:4px 10px; font-weight:700;">
              ➕ Adicionar NPC de Teleporte
            </button>
          </div>
          <p style="font-size:0.73rem; color:var(--text-muted); margin:0;">
            NPCs que funcionam como Guias de Viagem neste mapa, permitindo que os jogadores se desloquem para outras cidades e regiões de Etheria.
          </p>
          ${contentHtml}
        </div>
      `;
    };

    /**
     * Abre o modal de configuração de NPC de Teleporte (novo ou existente).
     */
    app.openTeleportNpcModal = function (mapNpcIndex = null, initialNpcTemplateId = null) {
      if (!this.currentMapId) {
        alert('Selecione primeiro um mapa para adicionar um NPC de teleporte.');
        return;
      }
      AdminTeleportNpcsTab.injectModalDom();

      const curMap = this.savedMaps.find((m) => Number(m.id) === Number(this.currentMapId));
      const curMapName = curMap ? curMap.namePtBr : `Mapa #${this.currentMapId}`;
      const nameElem = document.getElementById('tpCurrentMapName');
      if (nameElem) nameElem.textContent = curMapName;

      // Popula select de NPC Templates
      const npcSelect = document.getElementById('tpNpcTemplateSelect');
      if (npcSelect) {
        if (!this.npcTemplates || this.npcTemplates.length === 0) {
          npcSelect.innerHTML = `<option value="">Nenhum NPC cadastrado. Clique em "➕ Criar Novo NPC" ao lado.</option>`;
        } else {
          npcSelect.innerHTML = this.npcTemplates
            .map((t) => `<option value="${t.id}">#${t.id} • ${t.namePtBr} (${t.code})</option>`)
            .join('');
        }
      }

      const isEditing = mapNpcIndex !== null && this.npcs && this.npcs[mapNpcIndex];
      const targetNpc = isEditing ? this.npcs[mapNpcIndex] : null;

      document.getElementById('tpModalMapNpcIndex').value = isEditing ? String(mapNpcIndex) : '';
      document.getElementById('tpModalPlacementId').value = targetNpc?.id ? String(targetNpc.id) : '';

      const titleElem = document.getElementById('teleportModalTitle');
      if (titleElem) {
        titleElem.innerHTML = isEditing
          ? `🌀 Editar NPC de Teleporte #${mapNpcIndex + 1} em <span style="color:#fde047;">${curMapName}</span>`
          : `🌀 Novo NPC de Teleporte em <span style="color:#fde047;">${curMapName}</span>`;
      }

      if (targetNpc) {
        if (npcSelect) npcSelect.value = String(targetNpc.npcTemplateId);
        document.getElementById('tpPosX').value = String(targetNpc.posX);
        document.getElementById('tpPosY').value = String(targetNpc.posY);
        document.getElementById('tpDirection').value = String(Number(targetNpc.direction) || 0);
        this.activeModalDestinations = Array.isArray(targetNpc.teleportDestinationsJson)
          ? JSON.parse(JSON.stringify(targetNpc.teleportDestinationsJson))
          : [];
      } else {
        if (initialNpcTemplateId && npcSelect) {
          npcSelect.value = String(initialNpcTemplateId);
        } else if (npcSelect && this.npcTemplates.length > 0) {
          npcSelect.value = String(this.npcTemplates[0].id);
        }
        document.getElementById('tpPosX').value = String(this.spawnX || 500);
        document.getElementById('tpPosY').value = String(this.spawnY || 500);
        document.getElementById('tpDirection').value = '0';

        // Destino inicial padrão: primeiro mapa salvo que não seja o atual
        const otherMap = this.savedMaps.find((m) => Number(m.id) !== Number(this.currentMapId)) || this.savedMaps[0];
        if (otherMap) {
          this.activeModalDestinations = [
            {
              label: otherMap.namePtBr,
              targetMapId: otherMap.id,
              targetX: otherMap.spawnX ?? 500,
              targetY: otherMap.spawnY ?? 500,
              requiredLevel: otherMap.requiredLevel ?? 1,
              costGold: 0,
            },
          ];
        } else {
          this.activeModalDestinations = [];
        }
      }

      this.onTeleportNpcTemplateChanged();
      this.renderTeleportDestinationsInModal();

      document.getElementById('teleportNpcModal').style.display = 'flex';
    };

    /**
     * Atualiza a prévia visual e informações do NPC selecionado no modal.
     */
    app.onTeleportNpcTemplateChanged = function () {
      const select = document.getElementById('tpNpcTemplateSelect');
      const preview = document.getElementById('tpNpcThumbPreview');
      if (!select || !preview) return;

      const tplId = Number(select.value);
      const tpl = this.npcTemplates.find((t) => t.id === tplId);
      if (tpl) {
        const thumbUrl =
          tpl.thumbUrl || `https://seytanir.github.io/mcrework/assets/npcs/${tpl.mcreworkNpcKey}/thumb.png`;
        preview.innerHTML = `<img src="${thumbUrl}" alt="" style="width:100%; height:100%; object-fit:contain;" />`;
      } else {
        preview.innerHTML = `<span style="font-size:1.4rem;">🧙</span>`;
      }
    };

    /**
     * Atalho para usar o spawn do mapa atual no formulário de posicionamento.
     */
    app.useCurrentMapSpawnForTeleportNpc = function () {
      const curMap = this.savedMaps.find((m) => Number(m.id) === Number(this.currentMapId));
      const sx = curMap ? (curMap.spawnX ?? 500) : (this.spawnX ?? 500);
      const sy = curMap ? (curMap.spawnY ?? 500) : (this.spawnY ?? 500);
      document.getElementById('tpPosX').value = String(sx);
      document.getElementById('tpPosY').value = String(sy);
    };

    /**
     * Atalho para criar um novo NPC template a partir do modal de teleporte.
     */
    app.openNpcTemplateModalFromTeleport = function () {
      this.awaitingTeleportNpcTemplateCreation = true;
      this.openNpcTemplateModal(null);
    };

    /**
     * Renderiza as linhas de destinos configurados dentro do modal.
     */
    app.renderTeleportDestinationsInModal = function () {
      const container = document.getElementById('tpDestinationsContainer');
      const badge = document.getElementById('tpDestinationsCountBadge');
      if (!container) return;

      if (badge) badge.textContent = String(this.activeModalDestinations.length);

      if (this.activeModalDestinations.length === 0) {
        container.innerHTML = `
          <div style="color:var(--text-muted); font-size:0.75rem; padding:10px; text-align:center; background:#020617; border-radius:6px; border:1px dashed var(--border);">
            Nenhum destino adicionado ainda. Clique em <strong>"➕ Adicionar Destino"</strong> acima para escolher para onde este NPC leva o jogador.
          </div>
        `;
        return;
      }

      container.innerHTML = this.activeModalDestinations
        .map((dest, idx) => {
          const mapOptions = (this.savedMaps || [])
            .map((m) => {
              const isSelected = Number(m.id) === Number(dest.targetMapId);
              return `<option value="${m.id}" ${isSelected ? 'selected' : ''}>[#${m.id}] ${m.namePtBr} (Nível ${m.requiredLevel}+)</option>`;
            })
            .join('');

          return `
            <div style="background:#020617; border:1px solid var(--border); border-radius:6px; padding:8px; display:flex; flex-direction:column; gap:6px;">
              <div style="display:flex; justify-content:space-between; align-items:center; gap:6px;">
                <span style="font-size:0.74rem; font-weight:700; color:#38bdf8;">
                  📍 Destino #${idx + 1}
                </span>
                <button type="button" class="btn-danger" onclick="AdminApp.removeTeleportDestinationRow(${idx})" style="padding:2px 6px; font-size:0.68rem;">
                  ✕ Remover
                </button>
              </div>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
                <div>
                  <label style="font-size:0.70rem; color:var(--text-muted); display:block;">Mapa Alvo:</label>
                  <select onchange="AdminApp.onTeleportTargetMapChanged(${idx}, this.value)" style="width:100%; padding:5px 6px; font-size:0.76rem; background:#0f172a; border:1px solid var(--border); border-radius:4px; color:#f8fafc;">
                    ${mapOptions}
                  </select>
                </div>
                <div>
                  <label style="font-size:0.70rem; color:var(--text-muted); display:block;">Nome / Rótulo do Local:</label>
                  <input type="text" value="${dest.label || ''}" placeholder="Ex: Praça Central, Porto..." oninput="AdminApp.activeModalDestinations[${idx}].label = this.value" style="width:100%; padding:5px 6px; font-size:0.76rem;" />
                </div>
              </div>
              <div style="display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:6px; align-items:flex-end;">
                <div>
                  <label style="font-size:0.70rem; color:var(--text-muted); display:block;">Chegada X:</label>
                  <input type="number" value="${dest.targetX ?? 500}" oninput="AdminApp.activeModalDestinations[${idx}].targetX = Number(this.value)" style="width:100%; padding:4px 6px; font-size:0.76rem;" />
                </div>
                <div>
                  <label style="font-size:0.70rem; color:var(--text-muted); display:block;">Chegada Y:</label>
                  <input type="number" value="${dest.targetY ?? 500}" oninput="AdminApp.activeModalDestinations[${idx}].targetY = Number(this.value)" style="width:100%; padding:4px 6px; font-size:0.76rem;" />
                </div>
                <div>
                  <label style="font-size:0.70rem; color:var(--text-muted); display:block;">Nível Mín:</label>
                  <input type="number" min="1" value="${dest.requiredLevel ?? 1}" oninput="AdminApp.activeModalDestinations[${idx}].requiredLevel = Number(this.value)" style="width:100%; padding:4px 6px; font-size:0.76rem;" />
                </div>
                <div>
                  <label style="font-size:0.70rem; color:var(--text-muted); display:block;">Custo (Gold):</label>
                  <input type="number" min="0" value="${dest.costGold ?? 0}" oninput="AdminApp.activeModalDestinations[${idx}].costGold = Number(this.value)" style="width:100%; padding:4px 6px; font-size:0.76rem;" />
                </div>
              </div>
            </div>
          `;
        })
        .join('');
    };

    /**
     * Reage à troca de mapa alvo de um destino, preenchendo automaticamente
     * o rótulo com o nome do mapa, as coordenadas com o spawn padrão e o nível requerido.
     */
    app.onTeleportTargetMapChanged = function (destIdx, targetMapIdStr) {
      const targetMapId = Number(targetMapIdStr);
      const targetMap = this.savedMaps.find((m) => Number(m.id) === targetMapId);
      if (!targetMap || !this.activeModalDestinations[destIdx]) return;

      this.activeModalDestinations[destIdx].targetMapId = targetMapId;
      this.activeModalDestinations[destIdx].label = targetMap.namePtBr;
      this.activeModalDestinations[destIdx].targetX = targetMap.spawnX ?? 500;
      this.activeModalDestinations[destIdx].targetY = targetMap.spawnY ?? 500;
      this.activeModalDestinations[destIdx].requiredLevel = targetMap.requiredLevel ?? 1;

      this.renderTeleportDestinationsInModal();
    };

    /**
     * Adiciona um novo destino à lista do modal.
     */
    app.addTeleportDestinationRow = function () {
      const otherMap = this.savedMaps.find((m) => Number(m.id) !== Number(this.currentMapId)) || this.savedMaps[0];
      const targetMapId = otherMap ? otherMap.id : 1;
      const targetName = otherMap ? otherMap.namePtBr : 'Novo Local';

      this.activeModalDestinations.push({
        label: targetName,
        targetMapId,
        targetX: otherMap ? (otherMap.spawnX ?? 500) : 500,
        targetY: otherMap ? (otherMap.spawnY ?? 500) : 500,
        requiredLevel: otherMap ? (otherMap.requiredLevel ?? 1) : 1,
        costGold: 0,
      });

      this.renderTeleportDestinationsInModal();
    };

    /**
     * Remove uma linha de destino da lista do modal.
     */
    app.removeTeleportDestinationRow = function (destIdx) {
      this.activeModalDestinations.splice(destIdx, 1);
      this.renderTeleportDestinationsInModal();
    };

    /**
     * Salva as configurações do NPC de Teleporte e seus destinos no mapa.
     */
    app.saveTeleportNpcFromModal = async function () {
      try {
        const npcTemplateId = Number(document.getElementById('tpNpcTemplateSelect').value);
        if (!npcTemplateId) {
          alert('Selecione um NPC da lista ou crie um novo antes de salvar.');
          return;
        }

        const posX = Number(document.getElementById('tpPosX').value) || 0;
        const posY = Number(document.getElementById('tpPosY').value) || 0;
        const direction = Number(document.getElementById('tpDirection').value) || 0;

        if (this.activeModalDestinations.length === 0) {
          if (!confirm('Nenhum destino foi adicionado para este NPC. Deseja salvá-lo mesmo sem destinos de teleporte configurados?')) {
            return;
          }
        }

        const cleanDestinations = this.activeModalDestinations.map((d) => ({
          label: (d.label || '').trim(),
          targetMapId: Number(d.targetMapId),
          targetX: Number(d.targetX ?? 500),
          targetY: Number(d.targetY ?? 500),
          requiredLevel: Number(d.requiredLevel ?? 1),
          costGold: Number(d.costGold ?? 0),
        }));

        const rawIndexStr = document.getElementById('tpModalMapNpcIndex').value;
        const placementIdStr = document.getElementById('tpModalPlacementId').value;
        const isEditing = rawIndexStr !== '' && this.npcs && this.npcs[Number(rawIndexStr)];
        const editIdx = isEditing ? Number(rawIndexStr) : null;
        const placementId = placementIdStr ? Number(placementIdStr) : (isEditing ? this.npcs[editIdx].id : null);

        // Se já possui placementId salvo no banco, salva direto pela API dedicada
        if (placementId) {
          await this.api(`/api/admin/map-npcs/${placementId}/teleport`, {
            method: 'PUT',
            body: JSON.stringify({
              npcTemplateId,
              posX,
              posY,
              direction,
              teleportDestinationsJson: cleanDestinations,
            }),
          });
        }

        // Atualiza o estado em memória do mapa atual
        if (isEditing) {
          this.npcs[editIdx].npcTemplateId = npcTemplateId;
          this.npcs[editIdx].posX = posX;
          this.npcs[editIdx].posY = posY;
          this.npcs[editIdx].direction = direction;
          this.npcs[editIdx].teleportDestinationsJson = cleanDestinations;
        } else {
          this.npcs.push({
            id: null,
            npcTemplateId,
            posX,
            posY,
            direction,
            teleportDestinationsJson: cleanDestinations,
          });
          this.selectedMapNpcIndex = this.npcs.length - 1;
        }

        this.closeModal('teleportNpcModal');

        // Se o mapa já está salvo no banco, dispara salvamento global em background para sincronizar
        if (this.currentMapId) {
          await this.saveCurrentMap(document.getElementById('visualMapEditorScreen')?.style.display === 'flex');
        }

        this.renderMapTeleportNpcsTable();
        this.renderLayerLists();
        this.drawCanvas();

        const tpl = this.npcTemplates.find((t) => t.id === npcTemplateId);
        const name = tpl ? tpl.namePtBr : `NPC #${npcTemplateId}`;
        alert(`✅ NPC de Teleporte "${name}" com ${cleanDestinations.length} destino(s) configurado com sucesso!`);
      } catch (err) {
        alert(`Erro ao salvar NPC de teleporte: ${err.message}`);
      }
    };
  }
}

window.AdminTeleportNpcsTab = AdminTeleportNpcsTab;
