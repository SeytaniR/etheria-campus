/**
 * @file apps/server/public/admin/js/AdminQuestsTab.js
 * @module @etheria/server
 * @description Submódulo do Estúdio Visual No-Code de Quests (`quest_templates`) na Rota `/admin`.
 *   - Suporta as 4 categorias: Principal Linear (`MAIN`), Secundária (`SIDE`), Épica (`EPIC`) e Proficiência (`PROFICIENCY`).
 *   - Permite vincular o NPC de início (`!` vermelho) e o NPC de conclusão (`?` cinza / `?` vermelho),
 *     escolhendo se a missão pode ser pega/entregue em TODOS os mapas com aquele NPC ou em um MAPA ESPECÍFICO
 *     (exibindo o Nível Recomendado de cada mapa na lista para orientar a progressão).
 */

class AdminQuestsTab {
  static attach(app) {
    app.questTemplates = [];
    app.questCategoryFilter = 'ALL';
    app.editingQuestObjectives = [];

    AdminQuestsTab.injectTabAndModalDom();

    app.loadQuestTemplates = async function () {
      try {
        this.questTemplates = await this.api('/api/admin/quest-templates');
        this.renderQuestsCrudTable();
      } catch (err) {
        console.error('Falha ao carregar Quests:', err);
      }
    };

    app.setQuestCategoryFilter = function (cat) {
      this.questCategoryFilter = cat;
      ['ALL', 'MAIN', 'SIDE', 'EPIC', 'PROFICIENCY'].forEach((c) => {
        const btn = document.getElementById(`btnQuestFilter_${c}`);
        if (btn) btn.className = c === cat ? 'btn-primary' : '';
      });
      this.renderQuestsCrudTable();
    };

    app.buildMapSelectOptionsForNpc = function (npcTemplateId, selectedMapId = null) {
      const npc = (this.npcTemplates || []).find((n) => Number(n.id) === Number(npcTemplateId));
      const placedMapIds = new Set(
        Array.isArray(npc?.placements) ? npc.placements.map((pl) => Number(pl.mapId)) : []
      );

      const options = [
        `<option value="" ${!selectedMapId ? 'selected' : ''}>🌍 Em qualquer mapa onde este NPC estiver (Todos os Mapas)</option>`,
      ];

      const sortedMaps = [...(this.savedMaps || [])].sort(
        (a, b) => (Number(a.requiredLevel) || 1) - (Number(b.requiredLevel) || 1) || a.id - b.id
      );

      for (const m of sortedMaps) {
        const isSel = Number(selectedMapId) === Number(m.id) ? 'selected' : '';
        const hasNpcHere = placedMapIds.has(Number(m.id));
        const npcBadge = hasNpcHere ? ' — ⭐ [NPC posicionado neste mapa]' : '';
        options.push(
          `<option value="${m.id}" ${isSel}>📍 #${m.id} ${m.namePtBr} (Nv.${m.requiredLevel || 1})${npcBadge}</option>`
        );
      }

      return options.join('');
    };

    app.onQuestGiverNpcChanged = function (preserveMapId = null) {
      const giverNpcId = Number(document.getElementById('questGiverNpcSelect')?.value) || 0;
      const giverMapSelect = document.getElementById('questGiverMapSelect');
      if (giverMapSelect) {
        giverMapSelect.innerHTML = this.buildMapSelectOptionsForNpc(giverNpcId, preserveMapId);
      }
      // Se o NPC de conclusão estiver como "Mesmo NPC de Início", atualiza também a lista de mapas de conclusão
      const turnInVal = document.getElementById('questTurnInNpcSelect')?.value;
      if (!turnInVal) {
        this.onQuestTurnInNpcChanged(document.getElementById('questTurnInMapSelect')?.value || null);
      }
    };

    app.onQuestTurnInNpcChanged = function (preserveMapId = null) {
      const rawTurnIn = document.getElementById('questTurnInNpcSelect')?.value;
      const effectiveNpcId = rawTurnIn
        ? Number(rawTurnIn)
        : Number(document.getElementById('questGiverNpcSelect')?.value) || 0;
      const turnInMapSelect = document.getElementById('questTurnInMapSelect');
      if (turnInMapSelect) {
        turnInMapSelect.innerHTML = this.buildMapSelectOptionsForNpc(effectiveNpcId, preserveMapId);
      }
    };

    app.formatQuestObjectivesSummary = function (objectives) {
      if (!Array.isArray(objectives) || objectives.length === 0) return '<em>Sem objetivos</em>';
      return objectives
        .map((obj) => {
          if (obj.type === 'KILL_MONSTER') {
            const mob = (this.monsterTemplates || []).find((m) => Number(m.id) === Number(obj.monsterTemplateId));
            return `🐉 Matar <strong>${obj.requiredCount || 1}x ${mob ? mob.namePtBr : `Monstro #${obj.monsterTemplateId}`}</strong>`;
          }
          if (obj.type === 'TALK_NPC') {
            const npc = (this.npcTemplates || []).find((n) => Number(n.id) === Number(obj.npcTemplateId));
            const map = obj.mapId ? (this.savedMaps || []).find((m) => Number(m.id) === Number(obj.mapId)) : null;
            const mapStr = map ? ` em #${map.id} ${map.namePtBr} (Nv.${map.requiredLevel || 1})` : '';
            return `💬 Falar com <strong>${npc ? npc.namePtBr : `NPC #${obj.npcTemplateId}`}</strong>${mapStr}`;
          }
          if (obj.type === 'VISIT_MAP') {
            const map = (this.savedMaps || []).find((m) => Number(m.id) === Number(obj.mapId));
            return `🗺️ Ir até <strong>${map ? `#${map.id} ${map.namePtBr} (Nv.${map.requiredLevel || 1})` : `Mapa #${obj.mapId}`}</strong>`;
          }
          if (obj.type === 'TAME_PET') {
            const mob = (this.monsterTemplates || []).find((m) => Number(m.id) === Number(obj.monsterTemplateId));
            return `🐾 Domar <strong>${obj.requiredCount || 1}x ${mob ? mob.namePtBr : 'Qualquer Pet'}</strong>`;
          }
          if (obj.type === 'WIN_BATTLES') {
            return `⚔️ Vencer <strong>${obj.requiredCount || 1} Batalha(s)</strong>`;
          }
          return obj.labelPtBr || obj.type;
        })
        .join('<br/>');
    };

    app.renderQuestsCrudTable = function () {
      const tbody = document.getElementById('questsTableBody');
      if (!tbody) return;

      const filtered = (this.questTemplates || []).filter((q) => {
        if (this.questCategoryFilter === 'ALL') return true;
        return q.questCategory === this.questCategoryFilter;
      });

      if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="color:var(--text-muted); padding:16px; text-align:center;">Nenhuma Quest encontrada para este filtro. Clique em <strong>"➕ Nova Quest No-Code"</strong> acima!</td></tr>`;
        return;
      }

      const catBadges = {
        MAIN: { label: '🟡 Principal', bg: 'rgba(234,179,8,0.2)', color: '#fde047', border: '#eab308' },
        SIDE: { label: '🔵 Secundária', bg: 'rgba(56,189,248,0.2)', color: '#7dd3fc', border: '#0ea5e9' },
        EPIC: { label: '🟣 Épica', bg: 'rgba(192,132,252,0.2)', color: '#d8b4fe', border: '#a855f7' },
        PROFICIENCY: { label: '🟢 Proficiência', bg: 'rgba(34,197,94,0.2)', color: '#86efac', border: '#22c55e' },
      };

      tbody.innerHTML = filtered
        .map((q) => {
          const cb = catBadges[q.questCategory] || catBadges.MAIN;
          const prereqQuest = q.prerequisiteQuestId
            ? (this.questTemplates || []).find((x) => Number(x.id) === Number(q.prerequisiteQuestId))
            : null;
          const prereqHtml = prereqQuest
            ? `<div style="font-size:0.7rem; color:#fde047;">🔗 Após: #${prereqQuest.id} ${prereqQuest.titlePtBr}</div>`
            : `<div style="font-size:0.7rem; color:var(--text-muted);">🔓 Sem quest prévia</div>`;

          const rew = q.rewardsJson || {};
          const rewParts = [];
          if (rew.exp) rewParts.push(`✨ +${rew.exp} EXP`);
          if (rew.gold) rewParts.push(`🪙 +${rew.gold} Ouro`);
          if (rew.statPoints) rewParts.push(`📊 +${rew.statPoints} Pts`);
          if (rew.triggerReborn) rewParts.push(`👑 Ativa Reborn`);

          return `
          <tr>
            <td>
              <strong>#${q.id}</strong> &bull; <span style="color:#fde047; font-weight:700;">${q.code}</span>
              <div style="font-size:0.68rem; color:#94a3b8;">Nv. Mín: <strong>${q.minLevel || 1}</strong></div>
            </td>
            <td>
              <span style="padding:3px 9px; border-radius:99px; background:${cb.bg}; color:${cb.color}; border:1px solid ${cb.border}; font-size:0.74rem; font-weight:800;">
                ${cb.label}
              </span>
              <div style="font-size:0.7rem; color:var(--text-muted); margin-top:4px;">Cap./Ordem: #${q.chapterOrder || 1} (${q.repeatType || 'ONCE'})</div>
            </td>
            <td>
              <strong>${q.titlePtBr}</strong>
              <div style="font-size:0.72rem; color:var(--text-muted); max-width:230px; white-space:normal;">📜 ${q.descriptionPtBr || ''}</div>
              ${prereqHtml}
            </td>
            <td>
              <div style="font-weight:700; color:#f87171;">❗ ${q.giverNpcNamePtBr}</div>
              <div style="font-size:0.71rem; color:#86efac;">${q.giverMapNamePtBr}</div>
            </td>
            <td>
              <div style="font-weight:700; color:#fde047;">❓ ${q.turnInNpcNamePtBr}</div>
              <div style="font-size:0.71rem; color:#7dd3fc;">${q.turnInMapNamePtBr}</div>
            </td>
            <td>
              <div style="font-size:0.73rem; line-height:1.35;">${this.formatQuestObjectivesSummary(q.objectivesJson)}</div>
            </td>
            <td>
              <div style="font-size:0.73rem; color:#86efac; font-weight:600;">${rewParts.join('<br/>') || '—'}</div>
            </td>
            <td>
              <div style="display:flex; gap:6px;">
                <button class="btn-primary" onclick="AdminApp.openQuestTemplateModal(${q.id})">✏️ Editar</button>
                <button class="btn-danger" onclick="AdminApp.deleteQuestTemplate(${q.id})">🗑️</button>
              </div>
            </td>
          </tr>`;
        })
        .join('');
    };

    app.openQuestTemplateModal = async function (editId = null) {
      document.getElementById('questTemplateModal').style.display = 'flex';

      // Popula lista de Quests Pré-Requisito
      const prereqSelect = document.getElementById('questPrereqSelect');
      if (prereqSelect) {
        prereqSelect.innerHTML =
          `<option value="">🔓 Nenhuma (Disponível assim que atingir o Nível Mínimo)</option>` +
          (this.questTemplates || [])
            .filter((q) => !editId || Number(q.id) !== Number(editId))
            .map((q) => `<option value="${q.id}">#${q.id} [${q.questCategory}] ${q.titlePtBr} (Nv.${q.minLevel || 1})</option>`)
            .join('');
      }

      // Popula lista de NPCs (mostrando em quais mapas cada NPC está posicionado)
      const npcOptionsHtml = (this.npcTemplates || [])
        .map((n) => {
          const mapsStr =
            Array.isArray(n.placements) && n.placements.length > 0
              ? n.placements.map((p) => p.mapNamePtBr).join(', ')
              : 'Sem mapa';
          return `<option value="${n.id}">🧙 #${n.id} ${n.namePtBr} (${n.code}) — [${mapsStr}]</option>`;
        })
        .join('');

      const giverNpcSelect = document.getElementById('questGiverNpcSelect');
      if (giverNpcSelect) {
        giverNpcSelect.innerHTML = npcOptionsHtml || `<option value="">Cadastre um NPC primeiro</option>`;
      }

      const turnInNpcSelect = document.getElementById('questTurnInNpcSelect');
      if (turnInNpcSelect) {
        turnInNpcSelect.innerHTML =
          `<option value="">🔄 Mesmo NPC que iniciou a Missão</option>` + npcOptionsHtml;
      }

      const existing = editId ? (this.questTemplates || []).find((q) => Number(q.id) === Number(editId)) : null;

      if (existing) {
        document.getElementById('questModalTitle').textContent = `📜 Editar Quest #${existing.id} (${existing.code})`;
        document.getElementById('questEditIdInput').value = String(existing.id);
        document.getElementById('questCodeInput').value = `#${existing.id} • ${existing.code}`;
        document.getElementById('questTitleInput').value = existing.titlePtBr || '';
        document.getElementById('questDescInput').value = existing.descriptionPtBr || '';
        document.getElementById('questCategorySelect').value = existing.questCategory || 'MAIN';
        document.getElementById('questChapterOrderInput').value = String(existing.chapterOrder || 1);
        document.getElementById('questMinLevelInput').value = String(existing.minLevel || 1);
        document.getElementById('questPrereqSelect').value = existing.prerequisiteQuestId ? String(existing.prerequisiteQuestId) : '';
        document.getElementById('questRepeatSelect').value = existing.repeatType || 'ONCE';

        if (existing.giverNpcId) {
          document.getElementById('questGiverNpcSelect').value = String(existing.giverNpcId);
        }
        this.onQuestGiverNpcChanged(existing.giverMapId || null);

        document.getElementById('questTurnInNpcSelect').value =
          existing.turnInNpcId && existing.turnInNpcId !== existing.giverNpcId ? String(existing.turnInNpcId) : '';
        this.onQuestTurnInNpcChanged(existing.turnInMapId || null);

        document.getElementById('questDialogueOfferInput').value = existing.dialogueOfferPtBr || '';
        document.getElementById('questDialogueActiveInput').value = existing.dialogueActivePtBr || '';
        document.getElementById('questDialogueCompleteInput').value = existing.dialogueCompletePtBr || '';

        const rew = existing.rewardsJson || {};
        document.getElementById('questRewardExpInput').value = String(rew.exp ?? 150);
        document.getElementById('questRewardGoldInput').value = String(rew.gold ?? 80);
        document.getElementById('questRewardStatPtsInput').value = String(rew.statPoints ?? 2);
        document.getElementById('questRewardRebornSelect').value = rew.triggerReborn ? 'true' : 'false';

        this.editingQuestObjectives = Array.isArray(existing.objectivesJson)
          ? JSON.parse(JSON.stringify(existing.objectivesJson))
          : [];
      } else {
        const maxId = (this.questTemplates || []).reduce((acc, q) => Math.max(acc, Number(q.id) || 0), 0);
        const nextId = maxId + 1;
        document.getElementById('questModalTitle').textContent = `📜 Nova Quest #${nextId} (quest_${nextId})`;
        document.getElementById('questEditIdInput').value = '';
        document.getElementById('questCodeInput').value = `#${nextId} • quest_${nextId} (Automático)`;
        document.getElementById('questTitleInput').value = '';
        document.getElementById('questDescInput').value = '';
        document.getElementById('questCategorySelect').value = 'MAIN';
        document.getElementById('questChapterOrderInput').value = String(nextId);
        document.getElementById('questMinLevelInput').value = '1';
        document.getElementById('questPrereqSelect').value = '';
        document.getElementById('questRepeatSelect').value = 'ONCE';

        this.onQuestGiverNpcChanged(null);
        document.getElementById('questTurnInNpcSelect').value = '';
        this.onQuestTurnInNpcChanged(null);

        document.getElementById('questDialogueOfferInput').value = 'Olá aventureiro! Preciso da sua ajuda para uma missão importante.';
        document.getElementById('questDialogueActiveInput').value = 'Como está o andamento da missão? Volte quando tiver concluído os objetivos!';
        document.getElementById('questDialogueCompleteInput').value = 'Excelente trabalho! Aqui está a sua recompensa.';

        document.getElementById('questRewardExpInput').value = '150';
        document.getElementById('questRewardGoldInput').value = '80';
        document.getElementById('questRewardStatPtsInput').value = '2';
        document.getElementById('questRewardRebornSelect').value = 'false';

        this.editingQuestObjectives = [
          {
            type: 'KILL_MONSTER',
            monsterTemplateId: this.monsterTemplates?.[0]?.id || 1,
            requiredCount: 2,
          },
        ];
      }

      this.renderVisualQuestObjectives();
    };

    app.addVisualQuestObjective = function (type) {
      if (type === 'KILL_MONSTER') {
        this.editingQuestObjectives.push({
          type: 'KILL_MONSTER',
          monsterTemplateId: this.monsterTemplates?.[0]?.id || 1,
          requiredCount: 3,
        });
      } else if (type === 'TALK_NPC') {
        this.editingQuestObjectives.push({
          type: 'TALK_NPC',
          npcTemplateId: this.npcTemplates?.[0]?.id || 1,
          mapId: null,
          requiredCount: 1,
        });
      } else if (type === 'VISIT_MAP') {
        this.editingQuestObjectives.push({
          type: 'VISIT_MAP',
          mapId: this.savedMaps?.[0]?.id || 1,
          requiredCount: 1,
        });
      } else if (type === 'WIN_BATTLES') {
        this.editingQuestObjectives.push({
          type: 'WIN_BATTLES',
          requiredCount: 3,
        });
      } else if (type === 'TAME_PET') {
        this.editingQuestObjectives.push({
          type: 'TAME_PET',
          monsterTemplateId: this.monsterTemplates?.[0]?.id || 1,
          requiredCount: 1,
        });
      }
      this.renderVisualQuestObjectives();
    };

    app.removeVisualQuestObjective = function (idx) {
      this.editingQuestObjectives.splice(idx, 1);
      this.renderVisualQuestObjectives();
    };

    app.updateVisualQuestObjectiveField = function (idx, field, val, isNum = false) {
      const obj = this.editingQuestObjectives[idx];
      if (!obj) return;
      if (isNum) {
        obj[field] = val === '' || val === null ? null : Number(val);
      } else {
        obj[field] = val;
      }
      this.renderVisualQuestObjectives();
    };

    app.renderVisualQuestObjectives = function () {
      const container = document.getElementById('questVisualObjectivesContainer');
      if (!container) return;

      if (this.editingQuestObjectives.length === 0) {
        container.innerHTML = `<div style="color:var(--text-muted); padding:10px; text-align:center; border:1px dashed var(--border); border-radius:8px;">Nenhum objetivo adicionado. Use os botões acima para adicionar!</div>`;
        return;
      }

      const sortedMaps = [...(this.savedMaps || [])].sort(
        (a, b) => (Number(a.requiredLevel) || 1) - (Number(b.requiredLevel) || 1) || a.id - b.id
      );

      container.innerHTML = this.editingQuestObjectives
        .map((obj, i) => {
          if (obj.type === 'KILL_MONSTER' || obj.type === 'TAME_PET') {
            const isTame = obj.type === 'TAME_PET';
            const mobOpts = (this.monsterTemplates || [])
              .map(
                (m) =>
                  `<option value="${m.id}" ${Number(obj.monsterTemplateId) === Number(m.id) ? 'selected' : ''}>#${m.id} ${m.namePtBr} (Rank ${m.rarityTier || 'F'})</option>`
              )
              .join('');

            return `
            <div style="background:#020617; border:1px solid ${isTame ? '#22c55e' : '#f43f5e'}; border-radius:8px; padding:10px; display:grid; grid-template-columns:1fr 140px auto; gap:8px; align-items:end;">
              <div>
                <label style="font-size:0.72rem; color:${isTame ? '#86efac' : '#fda4af'}; font-weight:700;">
                  ${isTame ? '🐾 Objetivo: Domar / Capturar Pet' : '🐉 Objetivo: Derrotar Monstro em Batalha'}
                </label>
                <select onchange="AdminApp.updateVisualQuestObjectiveField(${i}, 'monsterTemplateId', this.value, true)">
                  ${mobOpts}
                </select>
              </div>
              <div>
                <label style="font-size:0.72rem;">Quantidade</label>
                <input type="number" min="1" value="${obj.requiredCount || 1}" onchange="AdminApp.updateVisualQuestObjectiveField(${i}, 'requiredCount', this.value, true)" />
              </div>
              <button type="button" class="btn-danger" onclick="AdminApp.removeVisualQuestObjective(${i})" style="padding:6px 10px;">🗑️</button>
            </div>`;
          }

          if (obj.type === 'TALK_NPC') {
            const npcOpts = (this.npcTemplates || [])
              .map(
                (n) =>
                  `<option value="${n.id}" ${Number(obj.npcTemplateId) === Number(n.id) ? 'selected' : ''}>🧙 #${n.id} ${n.namePtBr} (${n.code})</option>`
              )
              .join('');
            const mapOpts =
              `<option value="" ${!obj.mapId ? 'selected' : ''}>🌍 Em qualquer mapa onde este NPC estiver</option>` +
              sortedMaps
                .map(
                  (m) =>
                    `<option value="${m.id}" ${Number(obj.mapId) === Number(m.id) ? 'selected' : ''}>📍 Somente em #${m.id} ${m.namePtBr} (Nv.${m.requiredLevel || 1})</option>`
                )
                .join('');

            return `
            <div style="background:#020617; border:1px solid #38bdf8; border-radius:8px; padding:10px; display:grid; grid-template-columns:1fr 1fr auto; gap:8px; align-items:end;">
              <div>
                <label style="font-size:0.72rem; color:#7dd3fc; font-weight:700;">💬 Objetivo: Conversar com NPC</label>
                <select onchange="AdminApp.updateVisualQuestObjectiveField(${i}, 'npcTemplateId', this.value, true)">
                  ${npcOpts}
                </select>
              </div>
              <div>
                <label style="font-size:0.72rem; color:#fde047;">Filtro de Mapa (com Nível do Mapa)</label>
                <select onchange="AdminApp.updateVisualQuestObjectiveField(${i}, 'mapId', this.value, true)">
                  ${mapOpts}
                </select>
              </div>
              <button type="button" class="btn-danger" onclick="AdminApp.removeVisualQuestObjective(${i})" style="padding:6px 10px;">🗑️</button>
            </div>`;
          }

          if (obj.type === 'VISIT_MAP') {
            const mapOpts = sortedMaps
              .map(
                (m) =>
                  `<option value="${m.id}" ${Number(obj.mapId) === Number(m.id) ? 'selected' : ''}>📍 #${m.id} ${m.namePtBr} (Nv.${m.requiredLevel || 1})</option>`
              )
              .join('');

            return `
            <div style="background:#020617; border:1px solid #eab308; border-radius:8px; padding:10px; display:grid; grid-template-columns:1fr auto; gap:8px; align-items:end;">
              <div>
                <label style="font-size:0.72rem; color:#fde047; font-weight:700;">🗺️ Objetivo: Explorar / Chegar ao Mapa</label>
                <select onchange="AdminApp.updateVisualQuestObjectiveField(${i}, 'mapId', this.value, true)">
                  ${mapOpts}
                </select>
              </div>
              <button type="button" class="btn-danger" onclick="AdminApp.removeVisualQuestObjective(${i})" style="padding:6px 10px;">🗑️</button>
            </div>`;
          }

          return `
          <div style="background:#020617; border:1px solid #c084fc; border-radius:8px; padding:10px; display:grid; grid-template-columns:1fr 160px auto; gap:8px; align-items:end;">
            <div>
              <strong style="color:#d8b4fe; font-size:0.82rem;">⚔️ Objetivo: Vencer Batalhas (Qualquer Monstro)</strong>
              <div style="font-size:0.72rem; color:var(--text-muted);">Ideal para Missões de Proficiência e Provas Épicas</div>
            </div>
            <div>
              <label style="font-size:0.72rem;">Nº de Vitórias</label>
              <input type="number" min="1" value="${obj.requiredCount || 1}" onchange="AdminApp.updateVisualQuestObjectiveField(${i}, 'requiredCount', this.value, true)" />
            </div>
            <button type="button" class="btn-danger" onclick="AdminApp.removeVisualQuestObjective(${i})" style="padding:6px 10px;">🗑️</button>
          </div>`;
        })
        .join('');
    };

    app.saveQuestTemplate = async function () {
      try {
        const editId = document.getElementById('questEditIdInput').value.trim();
        const titlePtBr = document.getElementById('questTitleInput').value.trim();
        const descriptionPtBr = document.getElementById('questDescInput').value.trim();
        const questCategory = document.getElementById('questCategorySelect').value || 'MAIN';
        const chapterOrder = Number(document.getElementById('questChapterOrderInput').value) || 1;
        const minLevel = Number(document.getElementById('questMinLevelInput').value) || 1;
        const prerequisiteQuestId = document.getElementById('questPrereqSelect').value
          ? Number(document.getElementById('questPrereqSelect').value)
          : null;
        const repeatType = document.getElementById('questRepeatSelect').value || 'ONCE';

        const giverNpcId = Number(document.getElementById('questGiverNpcSelect').value) || null;
        const giverMapId = document.getElementById('questGiverMapSelect').value
          ? Number(document.getElementById('questGiverMapSelect').value)
          : null;
        const turnInNpcId = document.getElementById('questTurnInNpcSelect').value
          ? Number(document.getElementById('questTurnInNpcSelect').value)
          : giverNpcId;
        const turnInMapId = document.getElementById('questTurnInMapSelect').value
          ? Number(document.getElementById('questTurnInMapSelect').value)
          : null;

        const dialogueOfferPtBr = document.getElementById('questDialogueOfferInput').value.trim();
        const dialogueActivePtBr = document.getElementById('questDialogueActiveInput').value.trim();
        const dialogueCompletePtBr = document.getElementById('questDialogueCompleteInput').value.trim();

        if (!titlePtBr) {
          alert('Informe um título em português para a Quest.');
          return;
        }

        const dto = {
          titlePtBr,
          descriptionPtBr,
          questCategory,
          chapterOrder,
          minLevel,
          prerequisiteQuestId,
          repeatType,
          giverNpcId,
          giverMapId,
          turnInNpcId,
          turnInMapId,
          dialogueOfferPtBr,
          dialogueActivePtBr,
          dialogueCompletePtBr,
          objectivesJson: this.editingQuestObjectives,
          rewardsJson: {
            exp: Number(document.getElementById('questRewardExpInput').value) || 0,
            gold: Number(document.getElementById('questRewardGoldInput').value) || 0,
            statPoints: Number(document.getElementById('questRewardStatPtsInput').value) || 0,
            triggerReborn: document.getElementById('questRewardRebornSelect').value === 'true',
          },
        };

        const path = editId ? `/api/admin/quest-templates/${editId}` : '/api/admin/quest-templates';
        const method = editId ? 'PUT' : 'POST';
        await this.api(path, { method, body: JSON.stringify(dto) });

        this.closeModal('questTemplateModal');
        await this.loadQuestTemplates();
      } catch (err) {
        alert(`Erro ao salvar Quest: ${err.message}`);
      }
    };

    app.deleteQuestTemplate = async function (id) {
      if (!confirm('Deseja realmente excluir esta Quest da tabela?')) return;
      try {
        await this.api(`/api/admin/quest-templates/${id}`, { method: 'DELETE' });
        await this.loadQuestTemplates();
      } catch (err) {
        alert(`Erro ao excluir Quest: ${err.message}`);
      }
    };
  }

  static injectTabAndModalDom() {
    const navTabs = document.querySelector('.nav-tabs');
    const btnNpcs = document.getElementById('tabBtnNpcs');
    if (navTabs && !document.getElementById('tabBtnQuests')) {
      const btnQuests = document.createElement('button');
      btnQuests.id = 'tabBtnQuests';
      btnQuests.onclick = () => window.AdminApp.switchTab('quests');
      btnQuests.textContent = '📜 Quests';
      if (btnNpcs && btnNpcs.nextSibling) {
        navTabs.insertBefore(btnQuests, btnNpcs.nextSibling);
      } else {
        navTabs.appendChild(btnQuests);
      }
    }

    const adminAppEl = document.getElementById('adminApp');
    if (adminAppEl && !document.getElementById('tabQuests')) {
      const questsPanel = document.createElement('div');
      questsPanel.id = 'tabQuests';
      questsPanel.style.cssText = 'display:none; padding:16px; max-width:1280px; margin:0 auto; width:100%; gap:16px; flex-direction:column;';
      questsPanel.innerHTML = `
        <div class="panel">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:12px;">
            <div>
              <h3 style="margin:0; color:#fde047;">📜 Tabela de Quests / Missões (Modo Visual No-Code)</h3>
              <p style="margin:4px 0 0; font-size:0.8rem; color:var(--text-muted);">
                Crie missões <strong>🟡 Principais (Lineares)</strong>, <strong>🔵 Secundárias</strong>, <strong>🟣 Épicas</strong> e de <strong>🟢 Proficiência</strong>. Escolha o NPC e se a missão pode ser pega/concluída em <strong>Todos os Mapas</strong> com aquele NPC ou em um <strong>Mapa Específico</strong> (com nível visível). No jogo (<code>/play</code>), os NPCs exibem automaticamente <strong>❗ Vermelho</strong> (disponível), <strong>❓ Cinza</strong> (em andamento) e <strong>❓ Vermelho</strong> (pronta para concluir).
              </p>
            </div>
            <button class="btn-primary" onclick="AdminApp.openQuestTemplateModal(null)">➕ Nova Quest No-Code</button>
          </div>
          <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:12px;">
            <button id="btnQuestFilter_ALL" class="btn-primary" onclick="AdminApp.setQuestCategoryFilter('ALL')" style="padding:5px 12px; font-size:0.76rem;">📋 Todas</button>
            <button id="btnQuestFilter_MAIN" onclick="AdminApp.setQuestCategoryFilter('MAIN')" style="padding:5px 12px; font-size:0.76rem;">🟡 Principal (Linear)</button>
            <button id="btnQuestFilter_SIDE" onclick="AdminApp.setQuestCategoryFilter('SIDE')" style="padding:5px 12px; font-size:0.76rem;">🔵 Secundária</button>
            <button id="btnQuestFilter_EPIC" onclick="AdminApp.setQuestCategoryFilter('EPIC')" style="padding:5px 12px; font-size:0.76rem;">🟣 Épica</button>
            <button id="btnQuestFilter_PROFICIENCY" onclick="AdminApp.setQuestCategoryFilter('PROFICIENCY')" style="padding:5px 12px; font-size:0.76rem;">🟢 Proficiência</button>
          </div>
          <div style="overflow-x:auto;">
            <table class="crud-table">
              <thead>
                <tr>
                  <th>ID & Código</th>
                  <th>Categoria</th>
                  <th>Título & Pré-Requisito</th>
                  <th>NPC de Início (❗ Vermelho) & Mapa</th>
                  <th>NPC de Entrega (❓) & Mapa</th>
                  <th>Objetivos Visuais</th>
                  <th>Recompensas</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody id="questsTableBody"></tbody>
            </table>
          </div>
        </div>`;
      adminAppEl.appendChild(questsPanel);
    }

    if (!document.getElementById('questTemplateModal')) {
      const modal = document.createElement('div');
      modal.id = 'questTemplateModal';
      modal.className = 'modal-backdrop';
      modal.style.display = 'none';
      modal.innerHTML = `
      <div class="modal-box" style="max-width:940px; width:96%; max-height:92vh; display:block; overflow-y:auto; padding:16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:10px; margin-bottom:12px;">
          <h3 id="questModalTitle" style="color:#fde047; margin:0;">📜 Nova Quest Visual</h3>
          <div style="display:flex; gap:8px;">
            <button class="btn-success" onclick="AdminApp.saveQuestTemplate()" style="padding:6px 14px; font-weight:700;">💾 Salvar Quest</button>
            <button class="btn-danger" onclick="AdminApp.closeModal('questTemplateModal')" style="padding:6px 10px;">✕</button>
          </div>
        </div>
        <input type="hidden" id="questEditIdInput" value="" />

        <!-- BLOCO 1: IDENTIDADE, CATEGORIA E PRÉ-REQUISITO LINEAR -->
        <div style="background:rgba(15,23,42,0.75); border:1px solid #334155; border-radius:10px; padding:12px; margin-bottom:12px;">
          <div style="font-size:0.8rem; font-weight:700; color:#fde047; margin-bottom:8px;">1️⃣ Identidade, Categoria (Principal, Secundária, Épica, Proficiência) & Progresso Linear</div>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(175px, 1fr)); gap:10px;">
            <div class="field"><label>ID & Código</label><input type="text" id="questCodeInput" readonly style="color:#fde047; font-weight:700;" /></div>
            <div class="field"><label>Título da Missão (PT-BR)</label><input type="text" id="questTitleInput" placeholder="Ex: Cap. 1: O Chamado de Izumo" /></div>
            <div class="field">
              <label style="color:#fde047; font-weight:700;">Categoria da Quest</label>
              <select id="questCategorySelect">
                <option value="MAIN">🟡 Principal (Linear — Segue o Progresso)</option>
                <option value="SIDE">🔵 Secundária (Paralela)</option>
                <option value="EPIC">🟣 Épica (Marco / Reencarnação)</option>
                <option value="PROFICIENCY">🟢 Proficiência</option>
              </select>
            </div>
            <div class="field"><label>Capítulo / Ordem Linear</label><input type="number" id="questChapterOrderInput" value="1" min="1" /></div>
            <div class="field"><label>Nível Mínimo do Jogador</label><input type="number" id="questMinLevelInput" value="1" min="1" /></div>
            <div class="field">
              <label>Repetição</label>
              <select id="questRepeatSelect">
                <option value="ONCE">1️⃣ Única Vez (ONCE)</option>
                <option value="REPEATABLE">♾️ Repetível Livre</option>
                <option value="DAILY">📅 Diária</option>
              </select>
            </div>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:8px;">
            <div class="field">
              <label style="color:#38bdf8; font-weight:700;">🔗 Quest Pré-Requisito (Encadeamento Linear)</label>
              <select id="questPrereqSelect"></select>
            </div>
            <div class="field">
              <label>Descrição Resumida no Diário de Missões (PT-BR)</label>
              <input type="text" id="questDescInput" placeholder="Resumo objetivo para o diário do jogador..." />
            </div>
          </div>
        </div>

        <!-- BLOCO 2: VÍNCULO DE NPCS E MAPAS (TODOS OS MAPAS OU MAPA ESPECÍFICO COM NÍVEL) -->
        <div style="background:rgba(15,23,42,0.75); border:1.5px solid #f43f5e; border-radius:10px; padding:12px; margin-bottom:12px;">
          <div style="font-size:0.8rem; font-weight:700; color:#fde047; margin-bottom:8px;">
            2️⃣ 🧙 Vínculo de NPCs & Seleção de Mapa (Todos os Mapas com o NPC ou Mapa Específico com Nível)
          </div>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:12px;">
            <div style="background:#020617; padding:10px; border-radius:8px; border:1px solid #f43f5e;">
              <label style="font-size:0.76rem; color:#f87171; font-weight:800; display:block; margin-bottom:6px;">
                ❗ NPC onde o Jogador PEGA a Missão (Ícone ! Vermelho na cabeça)
              </label>
              <select id="questGiverNpcSelect" onchange="AdminApp.onQuestGiverNpcChanged()" style="width:100%; margin-bottom:8px;"></select>
              <label style="font-size:0.72rem; color:#86efac; font-weight:700; display:block; margin-bottom:4px;">
                🗺️ Em qual Mapa este NPC entrega a missão? (Mostra Nível do Mapa)
              </label>
              <select id="questGiverMapSelect" style="width:100%;"></select>
            </div>

            <div style="background:#020617; padding:10px; border-radius:8px; border:1px solid #eab308;">
              <label style="font-size:0.76rem; color:#fde047; font-weight:800; display:block; margin-bottom:6px;">
                ❓ NPC onde o Jogador CONCLUI a Missão (? Cinza andamento / ? Vermelho pronta)
              </label>
              <select id="questTurnInNpcSelect" onchange="AdminApp.onQuestTurnInNpcChanged()" style="width:100%; margin-bottom:8px;"></select>
              <label style="font-size:0.72rem; color:#7dd3fc; font-weight:700; display:block; margin-bottom:4px;">
                🗺️ Em qual Mapa este NPC conclui a missão? (Mostra Nível do Mapa)
              </label>
              <select id="questTurnInMapSelect" style="width:100%;"></select>
            </div>
          </div>
        </div>

        <!-- BLOCO 3: OBJETIVOS VISUAIS NO-CODE -->
        <div style="background:rgba(15,23,42,0.75); border:1.5px solid #38bdf8; border-radius:10px; padding:12px; margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
            <span style="font-size:0.8rem; font-weight:700; color:#fde047;">3️⃣ 🎯 Blocos Visuais de Objetivos da Missão</span>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
              <button type="button" onclick="AdminApp.addVisualQuestObjective('KILL_MONSTER')" style="padding:4px 9px; font-size:0.74rem; background:#9f1239; color:#fff;">➕ 🐉 Matar Monstro</button>
              <button type="button" onclick="AdminApp.addVisualQuestObjective('TALK_NPC')" style="padding:4px 9px; font-size:0.74rem; background:#0369a1; color:#fff;">➕ 💬 Falar com NPC</button>
              <button type="button" onclick="AdminApp.addVisualQuestObjective('VISIT_MAP')" style="padding:4px 9px; font-size:0.74rem; background:#854d0e; color:#fff;">➕ 🗺️ Explorar Mapa</button>
              <button type="button" onclick="AdminApp.addVisualQuestObjective('WIN_BATTLES')" style="padding:4px 9px; font-size:0.74rem; background:#6b21a8; color:#fff;">➕ ⚔️ Vencer Batalhas</button>
              <button type="button" onclick="AdminApp.addVisualQuestObjective('TAME_PET')" style="padding:4px 9px; font-size:0.74rem; background:#15803d; color:#fff;">➕ 🐾 Domar Pet</button>
            </div>
          </div>
          <div id="questVisualObjectivesContainer" style="display:flex; flex-direction:column; gap:8px;"></div>
        </div>

        <!-- BLOCO 4: DIÁLOGOS DO NPC EM CADA ESTÁGIO -->
        <div style="background:rgba(15,23,42,0.75); border:1px solid #334155; border-radius:10px; padding:12px; margin-bottom:12px;">
          <div style="font-size:0.8rem; font-weight:700; color:#fde047; margin-bottom:8px;">4️⃣ 💬 Falas do NPC em Português (i18n Automático)</div>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:8px;">
            <div class="field">
              <label style="color:#f87171;">❗ Fala ao Oferecer a Missão (! Vermelho)</label>
              <textarea id="questDialogueOfferInput" rows="2"></textarea>
            </div>
            <div class="field">
              <label style="color:#94a3b8;">❓ Fala com Missão em Andamento (? Cinza)</label>
              <textarea id="questDialogueActiveInput" rows="2"></textarea>
            </div>
            <div class="field">
              <label style="color:#86efac;">❓ Fala ao Entregar / Concluir (? Vermelho)</label>
              <textarea id="questDialogueCompleteInput" rows="2"></textarea>
            </div>
          </div>
        </div>

        <!-- BLOCO 5: RECOMPENSAS AO ENTREGAR NO NPC -->
        <div style="background:rgba(15,23,42,0.75); border:1px solid #22c55e; border-radius:10px; padding:12px;">
          <div style="font-size:0.8rem; font-weight:700; color:#86efac; margin-bottom:8px;">5️⃣ 🎁 Recompensas ao Concluir a Missão</div>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(170px, 1fr)); gap:10px;">
            <div class="field"><label>✨ Experiência (EXP)</label><input type="number" id="questRewardExpInput" value="150" min="0" /></div>
            <div class="field"><label>🪙 Ouro</label><input type="number" id="questRewardGoldInput" value="80" min="0" /></div>
            <div class="field"><label>📊 Pontos de Atributo Extras</label><input type="number" id="questRewardStatPtsInput" value="2" min="0" /></div>
            <div class="field">
              <label style="color:#c084fc; font-weight:700;">👑 Despertar Reborn? (Épica)</label>
              <select id="questRewardRebornSelect">
                <option value="false">Não</option>
                <option value="true">✨ Sim — Reencarnar Personagem!</option>
              </select>
            </div>
          </div>
        </div>
      </div>`;
      document.body.appendChild(modal);
    }
  }
}

window.AdminQuestsTab = AdminQuestsTab;
