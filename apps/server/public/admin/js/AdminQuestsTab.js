/**
 * @file apps/server/public/admin/js/AdminQuestsTab.js
 * @module @etheria/server
 * @description Submódulo do Estúdio Visual No-Code de Quests (`quest_templates`) na Rota `/admin`.
 *   - Agrupa as missões por Capítulos e Episódios (`1-1` -> `1-2` -> `1-3` ===> `2-1` -> `2-2`) em um
 *     Quadro de Fluxo estilo Draw.io com Cards e Conectores Visuais (além da visão em Tabela tradicional).
 *   - Garante progressão linear automática para Missões Principais (`MAIN`):
 *     - O Episódio `E` só libera ao concluir o Episódio `E-1`.
 *     - O Capítulo `C` só libera ao concluir todos os episódios do Capítulo `C-1`.
 *   - Exige e configura Gatilho de Acionamento (`triggerType`) e Requisitos (`requirementsJson`) para todos os tipos de Quests.
 */

class AdminQuestsTab {
  static attach(app) {
    app.questTemplates = [];
    app.questCategoryFilter = 'ALL';
    app.questViewMode = 'DRAWIO'; // 'DRAWIO' | 'TABLE'
    app.editingQuestObjectives = [];

    if (window.AdminMetaQuestsPanel) AdminMetaQuestsPanel.attach(app);
    if (window.AdminQuestBattlePanel) AdminQuestBattlePanel.attach(app);
    AdminQuestsModalDom.injectTabAndModalDom();
    if (window.AdminQuestStepsEditor) AdminQuestStepsEditor.attach(app);
    if (window.AdminQuestsBoardView) AdminQuestsBoardView.attach(app);

    app.loadQuestTemplates = async function () {
      try {
        this.questTemplates = await this.api('/api/admin/quest-templates');
        this.renderQuestsView();
      } catch (err) {
        console.error('Falha ao carregar Quests:', err);
      }
    };

    app.setQuestViewMode = function (mode) {
      this.questViewMode = mode === 'TABLE' ? 'TABLE' : 'DRAWIO';
      const btnDraw = document.getElementById('btnQuestView_DRAWIO');
      const btnTab = document.getElementById('btnQuestView_TABLE');
      if (btnDraw) btnDraw.className = this.questViewMode === 'DRAWIO' ? 'btn-primary' : '';
      if (btnTab) btnTab.className = this.questViewMode === 'TABLE' ? 'btn-primary' : '';

      const drawWrap = document.getElementById('questsDrawIoWrapper');
      const tableWrap = document.getElementById('questsTableWrapper');
      if (drawWrap) drawWrap.style.display = this.questViewMode === 'DRAWIO' ? 'flex' : 'none';
      if (tableWrap) tableWrap.style.display = this.questViewMode === 'TABLE' ? 'block' : 'none';

      this.renderQuestsView();
    };

    app.setQuestCategoryFilter = function (cat) {
      this.questCategoryFilter = cat;
      ['ALL', 'MAIN', 'META', 'SIDE', 'EPIC', 'PROFICIENCY'].forEach((c) => {
        const btn = document.getElementById(`btnQuestFilter_${c}`);
        if (btn) btn.className = c === cat ? 'btn-primary' : '';
      });
      this.renderQuestsView();
    };

    app.renderQuestsView = function () {
      this.renderQuestsDrawIoBoard();
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

    app.onQuestEpisodeOrCategoryChanged = function () {
      const cat = document.getElementById('questCategorySelect')?.value || 'MAIN';
      const chap = Math.max(1, Number(document.getElementById('questChapterOrderInput')?.value) || 1);
      const ep = Math.max(1, Number(document.getElementById('questEpisodeOrderInput')?.value) || 1);
      const badgeEl = document.getElementById('questLiveEpisodeBadge');
      if (badgeEl) {
        badgeEl.textContent = `📌 Episódio ${chap}-${ep}`;
      }

      const hintEl = document.getElementById('questLinearRuleHint');
      if (hintEl) {
        if (cat === 'MAIN') {
          if (chap === 1 && ep === 1) {
            hintEl.innerHTML = `🟢 <strong>Episódio Inicial (1-1):</strong> Inicia a campanha principal do jogador.`;
          } else if (ep > 1) {
            hintEl.innerHTML = `🔒 <strong>Trava Linear Automática:</strong> O Episódio <strong>${chap}-${ep}</strong> só será liberado quando o jogador concluir o Episódio <strong>${chap}-${ep - 1}</strong>.`;
          } else {
            hintEl.innerHTML = `🔒 <strong>Trava de Capítulo Automática:</strong> O Capítulo <strong>${chap} (${chap}-1)</strong> só será liberado quando o jogador concluir <strong>TODOS os episódios do Capítulo ${chap - 1}</strong>.`;
          }
        } else if (cat === 'META') {
          hintEl.innerHTML = `🟠 <strong>Quest Meta Procedural:</strong> Um único registro com N estágios progressivos (ex: 10 ➔ 100 ➔ 1.000), contagem cumulativa e entrega etapa a etapa no NPC.`;
        } else {
          hintEl.innerHTML = `ℹ️ Missão <strong>${cat}</strong> agrupada visualmente no <strong>Capítulo ${chap} (Card ${chap}-${ep})</strong>. Configure abaixo o Gatilho e os Requisitos para acioná-la!`;
        }
      }
      if (typeof this.toggleMetaQuestUi === 'function') {
        this.toggleMetaQuestUi(cat === 'META');
      }
    };

    app.onQuestTriggerTypeChanged = function () {
      const tType = document.getElementById('questTriggerTypeSelect')?.value || 'NPC_INTERACT';
      const mapField = document.getElementById('questTriggerMapField');
      const mobField = document.getElementById('questTriggerMonsterField');
      if (mapField) mapField.style.display = tType === 'ENTER_MAP' ? 'block' : 'none';
      if (mobField) mobField.style.display = tType === 'KILL_MONSTER_TRIGGER' ? 'block' : 'none';
    };

    app.openQuestTemplateModal = async function (editId = null, preset = null) {
      document.getElementById('questTemplateModal').style.display = 'flex';

      const prereqSelect = document.getElementById('questPrereqSelect');
      if (prereqSelect) {
        prereqSelect.innerHTML =
          `<option value="">🔄 Automático pela Ordem do Episódio (ou Nenhuma)</option>` +
          (this.questTemplates || [])
            .filter((q) => !editId || Number(q.id) !== Number(editId))
            .map(
              (q) =>
                `<option value="${q.id}">[Ep. ${q.chapterOrder}-${q.episodeOrder || 1}] #${q.id} ${q.titlePtBr} (${q.questCategory})</option>`
            )
            .join('');
      }

      const sortedMaps = [...(this.savedMaps || [])].sort(
        (a, b) => (Number(a.requiredLevel) || 1) - (Number(b.requiredLevel) || 1) || a.id - b.id
      );
      const triggerMapSelect = document.getElementById('questTriggerMapSelect');
      if (triggerMapSelect) {
        triggerMapSelect.innerHTML =
          `<option value="">Selecione o Mapa do Gatilho...</option>` +
          sortedMaps
            .map((m) => `<option value="${m.id}">📍 #${m.id} ${m.namePtBr} (Nv.${m.requiredLevel || 1})</option>`)
            .join('');
      }

      const triggerMobSelect = document.getElementById('questTriggerMonsterSelect');
      if (triggerMobSelect) {
        triggerMobSelect.innerHTML =
          `<option value="">Qualquer Monstro</option>` +
          (this.monsterTemplates || [])
            .map((mob) => `<option value="${mob.id}">🐉 #${mob.id} ${mob.namePtBr} (Rank ${mob.rarityTier || 'F'})</option>`)
            .join('');
      }

      const reqClassSelect = document.getElementById('questReqClassSelect');
      if (reqClassSelect) {
        reqClassSelect.innerHTML =
          `<option value="">🔓 Todas as Classes</option>` +
          (this.classTemplates || [])
            .map((cl) => `<option value="${cl.id}">🦸 #${cl.id} ${cl.namePtBr}</option>`)
            .join('');
      }

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
        turnInNpcSelect.innerHTML = `<option value="">🔄 Mesmo NPC que iniciou a Missão</option>` + npcOptionsHtml;
      }
      const rewItemSel = document.getElementById('questRewardItemSelect');
      if (rewItemSel) {
        rewItemSel.innerHTML = `<option value="">— Sem item —</option>` + (this.itemTemplates || []).map((it) => `<option value="${it.id}">#${it.id} ${it.namePtBr}</option>`).join('');
      }

      const existing = editId ? (this.questTemplates || []).find((q) => Number(q.id) === Number(editId)) : null;

      if (existing) {
        document.getElementById('questModalTitle').textContent = `📜 Editar Quest #${existing.id} (Ep. ${existing.chapterOrder}-${existing.episodeOrder || 1})`;
        document.getElementById('questEditIdInput').value = String(existing.id);
        document.getElementById('questCodeInput').value = `#${existing.id} • ${existing.code}`;
        document.getElementById('questTitleInput').value = existing.titlePtBr || '';
        document.getElementById('questDescInput').value = existing.descriptionPtBr || '';
        document.getElementById('questCategorySelect').value = existing.questCategory || 'MAIN';
        document.getElementById('questChapterOrderInput').value = String(existing.chapterOrder || 1);
        document.getElementById('questEpisodeOrderInput').value = String(existing.episodeOrder || 1);
        document.getElementById('questMinLevelInput').value = String(existing.minLevel || 1);
        document.getElementById('questPrereqSelect').value = existing.prerequisiteQuestId
          ? String(existing.prerequisiteQuestId)
          : '';
        document.getElementById('questRepeatSelect').value = existing.repeatType || 'ONCE';

        // Gatilho & Requisitos
        document.getElementById('questTriggerTypeSelect').value = existing.triggerType || 'NPC_INTERACT';
        const tCfg = existing.triggerConfigJson || {};
        document.getElementById('questTriggerMapSelect').value = tCfg.triggerMapId ? String(tCfg.triggerMapId) : '';
        document.getElementById('questTriggerMonsterSelect').value = tCfg.triggerMonsterId
          ? String(tCfg.triggerMonsterId)
          : '';
        document.getElementById('questAutoAcceptSelect').value = tCfg.autoAcceptOnTrigger ? 'true' : 'false';

        const rCfg = existing.requirementsJson || {};
        document.getElementById('questReqChapterCompletedInput').value = rCfg.requiredChapterCompleted
          ? String(rCfg.requiredChapterCompleted)
          : '';
        document.getElementById('questReqClassSelect').value = rCfg.requiredClassId ? String(rCfg.requiredClassId) : '';
        document.getElementById('questReqElementSelect').value = rCfg.requiredElement || '';
        document.getElementById('questReqRebornSelect').value = rCfg.requireReborn ? 'true' : 'false';

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
        if (document.getElementById('questRewardItemSelect')) document.getElementById('questRewardItemSelect').value = rew.rewardItemTemplateId ? String(rew.rewardItemTemplateId) : '';
        if (document.getElementById('questRewardItemQtyInput')) document.getElementById('questRewardItemQtyInput').value = String(rew.rewardItemQuantity ?? 1);
        document.getElementById('questRewardRebornSelect').value = rew.triggerReborn ? 'true' : 'false';

        this.editingQuestObjectives = Array.isArray(existing.objectivesJson)
          ? JSON.parse(JSON.stringify(existing.objectivesJson))
          : [];
      } else {
        const maxId = (this.questTemplates || []).reduce((acc, q) => Math.max(acc, Number(q.id) || 0), 0);
        const nextId = maxId + 1;
        const defaultChap = preset?.chapterOrder || 1;
        const defaultEp = preset?.episodeOrder || 1;
        const defaultCat = preset?.questCategory || 'MAIN';

        document.getElementById('questModalTitle').textContent = `📜 Nova Quest #${nextId} (Ep. ${defaultChap}-${defaultEp})`;
        document.getElementById('questEditIdInput').value = '';
        document.getElementById('questCodeInput').value = `#${nextId} • quest_${nextId} (Automático)`;
        document.getElementById('questTitleInput').value = '';
        document.getElementById('questDescInput').value = '';
        document.getElementById('questCategorySelect').value = defaultCat;
        document.getElementById('questChapterOrderInput').value = String(defaultChap);
        document.getElementById('questEpisodeOrderInput').value = String(defaultEp);
        document.getElementById('questMinLevelInput').value = '1';
        document.getElementById('questPrereqSelect').value = '';
        document.getElementById('questRepeatSelect').value = 'ONCE';

        document.getElementById('questTriggerTypeSelect').value = 'NPC_INTERACT';
        document.getElementById('questTriggerMapSelect').value = '';
        document.getElementById('questTriggerMonsterSelect').value = '';
        document.getElementById('questAutoAcceptSelect').value = 'false';

        document.getElementById('questReqChapterCompletedInput').value =
          defaultCat === 'MAIN' && defaultChap > 1 ? String(defaultChap - 1) : '';
        document.getElementById('questReqClassSelect').value = '';
        document.getElementById('questReqElementSelect').value = '';
        document.getElementById('questReqRebornSelect').value = 'false';

        this.onQuestGiverNpcChanged(null);
        document.getElementById('questTurnInNpcSelect').value = '';
        this.onQuestTurnInNpcChanged(null);

        document.getElementById('questDialogueOfferInput').value =
          'Olá aventureiro! Preciso da sua ajuda para uma missão importante.';
        document.getElementById('questDialogueActiveInput').value =
          'Como está o andamento da missão? Volte quando tiver concluído os objetivos!';
        document.getElementById('questDialogueCompleteInput').value =
          'Excelente trabalho! Aqui está a sua recompensa.';

        document.getElementById('questRewardExpInput').value = '150';
        document.getElementById('questRewardGoldInput').value = '80';
        document.getElementById('questRewardStatPtsInput').value = '2';
        if (document.getElementById('questRewardItemSelect')) document.getElementById('questRewardItemSelect').value = '';
        if (document.getElementById('questRewardItemQtyInput')) document.getElementById('questRewardItemQtyInput').value = '1';
        document.getElementById('questRewardRebornSelect').value = 'false';

        this.editingQuestObjectives = [
          {
            type: 'KILL_MONSTER',
            monsterTemplateId: this.monsterTemplates?.[0]?.id || 1,
            requiredCount: 2,
          },
        ];
      }

      if (typeof this.loadMetaConfigIntoForm === 'function') this.loadMetaConfigIntoForm(existing);
      if (typeof this.loadQuestBattleConfigIntoForm === 'function') this.loadQuestBattleConfigIntoForm(existing);
      if (typeof this.loadQuestCoefficientsAndStepsIntoForm === 'function') this.loadQuestCoefficientsAndStepsIntoForm(existing);
      this.onQuestEpisodeOrCategoryChanged();
      this.onQuestTriggerTypeChanged();
      this.renderVisualQuestObjectives();
    };

    app.addVisualQuestObjective = function (type) {
      const defaultMobId = this.monsterTemplates?.[0]?.id || 1;
      if (type === 'KILL_MONSTER') {
        this.editingQuestObjectives.push({ type: 'KILL_MONSTER', variantTier: 'ANY', monsterTemplateId: defaultMobId, requiredCount: 3 });
      } else if (type === 'KILL_LEADER') {
        this.editingQuestObjectives.push({ type: 'KILL_MONSTER', variantTier: 'LEADER', monsterTemplateId: defaultMobId, requiredCount: 2 });
      } else if (type === 'KILL_BOSS') {
        this.editingQuestObjectives.push({ type: 'KILL_MONSTER', variantTier: 'BOSS', monsterTemplateId: defaultMobId, requiredCount: 1 });
      } else if (type === 'KILL_RACE') {
        this.editingQuestObjectives.push({ type: 'KILL_RACE', variantTier: 'ANY', raceCode: this.races?.[0]?.code || 'BEAST', requiredCount: 10 });
      } else if (type === 'COLLECT_ITEM') {
        this.editingQuestObjectives.push({ type: 'COLLECT_ITEM', itemTemplateId: this.itemTemplates?.[0]?.id || 1, dropSourceMode: 'ANY_MONSTER', dropChancePct: 100, requiredCount: 10 });
      } else if (type === 'TALK_NPC') {
        this.editingQuestObjectives.push({ type: 'TALK_NPC', npcTemplateId: this.npcTemplates?.[0]?.id || 1, mapId: null, requiredCount: 1 });
      } else if (type === 'VISIT_MAP') {
        this.editingQuestObjectives.push({ type: 'VISIT_MAP', mapId: this.savedMaps?.[0]?.id || 1, requiredCount: 1 });
      } else if (type === 'WIN_BATTLES') {
        this.editingQuestObjectives.push({ type: 'WIN_BATTLES', requiredCount: 3 });
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
      const tierOpts = (curTier) => {
        const t = String(curTier || 'ANY').toUpperCase();
        return [
          `<option value="ANY" ${t === 'ANY' ? 'selected' : ''}>🔓 Qualquer (Básico, Líder ou Boss)</option>`,
          `<option value="LEADER" ${t === 'LEADER' ? 'selected' : ''}>👑 Somente LÍDER (Ex: "Elimine 2 Líderes Momo")</option>`,
          `<option value="BOSS" ${t === 'BOSS' ? 'selected' : ''}>💀 Somente BOSS (Ex: "Elimine 1 Boss da Galinha Colorida")</option>`,
          `<option value="NORMAL" ${t === 'NORMAL' ? 'selected' : ''}>▫️ Somente Básico (Normal)</option>`,
        ].join('');
      };

      container.innerHTML = this.editingQuestObjectives
        .map((obj, i) => {
          if (obj.type === 'KILL_MONSTER' || obj.type === 'KILL_LEADER' || obj.type === 'KILL_BOSS') {
            const effTier = obj.type === 'KILL_BOSS' ? 'BOSS' : obj.type === 'KILL_LEADER' ? 'LEADER' : (obj.variantTier || 'ANY');
            const borderCol = effTier === 'BOSS' ? '#fb7185' : effTier === 'LEADER' ? '#38bdf8' : '#f43f5e';
            const mobOpts = `<option value="" ${!obj.monsterTemplateId ? 'selected' : ''}>🌍 Qualquer Monstro do Mapa</option>` +
              (this.monsterTemplates || []).map((m) => `<option value="${m.id}" ${Number(obj.monsterTemplateId) === Number(m.id) ? 'selected' : ''}>#${m.id} ${m.namePtBr} (Rank ${m.rarityTier || 'F'})</option>`).join('');
            return `<div style="background:#020617; border:1px solid ${borderCol}; border-radius:8px; padding:10px; display:grid; grid-template-columns:1.2fr 1.2fr 110px auto; gap:8px; align-items:end;">
              <div><label style="font-size:0.72rem; color:#fda4af; font-weight:700;">🐉 Monstro Alvo</label><select onchange="AdminApp.updateVisualQuestObjectiveField(${i}, 'monsterTemplateId', this.value, true)">${mobOpts}</select></div>
              <div><label style="font-size:0.72rem; color:#38bdf8; font-weight:700;">👑/💀 Requisito de Líder ou Boss</label><select onchange="AdminApp.editingQuestObjectives[${i}].type='KILL_MONSTER'; AdminApp.updateVisualQuestObjectiveField(${i}, 'variantTier', this.value, false)">${tierOpts(effTier)}</select></div>
              <div><label style="font-size:0.72rem;">Quantidade</label><input type="number" min="1" value="${obj.requiredCount || 1}" onchange="AdminApp.updateVisualQuestObjectiveField(${i}, 'requiredCount', this.value, true)" /></div>
              <button type="button" class="btn-danger" onclick="AdminApp.removeVisualQuestObjective(${i})" style="padding:6px 10px;">🗑️</button>
            </div>`;
          }
          if (obj.type === 'KILL_RACE') {
            const raceOpts = (this.races || []).map((r) => `<option value="${r.code}" ${String(obj.raceCode) === String(r.code) ? 'selected' : ''}>${r.namePtBr || r.code} (${r.code})</option>`).join('');
            return `<div style="background:#020617; border:1px solid #f59e0b; border-radius:8px; padding:10px; display:grid; grid-template-columns:1fr 1fr 110px auto; gap:8px; align-items:end;">
              <div><label style="font-size:0.72rem; color:#fcd34d; font-weight:700;">🐾 Objetivo: Matar Raça</label><select onchange="AdminApp.updateVisualQuestObjectiveField(${i}, 'raceCode', this.value, false)">${raceOpts}</select></div>
              <div><label style="font-size:0.72rem; color:#38bdf8; font-weight:700;">👑/💀 Requisito de Líder ou Boss</label><select onchange="AdminApp.updateVisualQuestObjectiveField(${i}, 'variantTier', this.value, false)">${tierOpts(obj.variantTier)}</select></div>
              <div><label style="font-size:0.72rem;">Qtd</label><input type="number" min="1" value="${obj.requiredCount || 10}" onchange="AdminApp.updateVisualQuestObjectiveField(${i}, 'requiredCount', this.value, true)" /></div>
              <button type="button" class="btn-danger" onclick="AdminApp.removeVisualQuestObjective(${i})" style="padding:6px 10px;">🗑️</button></div>`;
          }
          if (obj.type === 'COLLECT_ITEM') {
            const itemOpts = (this.itemTemplates || []).map((it) => `<option value="${it.id}" ${Number(obj.itemTemplateId) === Number(it.id) ? 'selected' : ''}>#${it.id} ${it.namePtBr}</option>`).join('');
            return `<div style="background:#020617; border:1px solid #14b8a6; border-radius:8px; padding:10px; display:grid; grid-template-columns:1fr 140px auto; gap:8px; align-items:end;"><div><label style="font-size:0.72rem; color:#5eead4; font-weight:700;">📦 Objetivo: Coletar & Entregar Item</label><select onchange="AdminApp.updateVisualQuestObjectiveField(${i}, 'itemTemplateId', this.value, true)">${itemOpts}</select></div><div><label style="font-size:0.72rem;">Qtd</label><input type="number" min="1" value="${obj.requiredCount || 10}" onchange="AdminApp.updateVisualQuestObjectiveField(${i}, 'requiredCount', this.value, true)" /></div><button type="button" class="btn-danger" onclick="AdminApp.removeVisualQuestObjective(${i})" style="padding:6px 10px;">🗑️</button></div>`;
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
                <select onchange="AdminApp.updateVisualQuestObjectiveField(${i}, 'npcTemplateId', this.value, true)">${npcOpts}</select>
              </div>
              <div>
                <label style="font-size:0.72rem; color:#fde047;">Filtro de Mapa (com Nível do Mapa)</label>
                <select onchange="AdminApp.updateVisualQuestObjectiveField(${i}, 'mapId', this.value, true)">${mapOpts}</select>
              </div>
              <button type="button" class="btn-danger" onclick="AdminApp.removeVisualQuestObjective(${i})" style="padding:6px 10px;">🗑️</button>
              ${typeof this.renderObjectiveStepExtraHtml === 'function' ? this.renderObjectiveStepExtraHtml(obj, i) : ''}
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
                <select onchange="AdminApp.updateVisualQuestObjectiveField(${i}, 'mapId', this.value, true)">${mapOpts}</select>
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
            ${typeof this.renderObjectiveStepExtraHtml === 'function' ? this.renderObjectiveStepExtraHtml(obj, i) : ''}
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
        const chapterOrder = Math.max(1, Number(document.getElementById('questChapterOrderInput').value) || 1);
        const episodeOrder = Math.max(1, Number(document.getElementById('questEpisodeOrderInput').value) || 1);
        const minLevel = Math.max(1, Number(document.getElementById('questMinLevelInput').value) || 1);
        const prerequisiteQuestId = document.getElementById('questPrereqSelect').value
          ? Number(document.getElementById('questPrereqSelect').value)
          : null;
        const repeatType = document.getElementById('questRepeatSelect').value || 'ONCE';

        const triggerType = document.getElementById('questTriggerTypeSelect').value || 'NPC_INTERACT';
        const triggerConfigJson = {
          triggerMapId: document.getElementById('questTriggerMapSelect').value
            ? Number(document.getElementById('questTriggerMapSelect').value)
            : null,
          triggerMonsterId: document.getElementById('questTriggerMonsterSelect').value
            ? Number(document.getElementById('questTriggerMonsterSelect').value)
            : null,
          autoAcceptOnTrigger: document.getElementById('questAutoAcceptSelect').value === 'true',
        };

        const requirementsJson = {
          minLevel,
          prerequisiteQuestId,
          requiredChapterCompleted: document.getElementById('questReqChapterCompletedInput').value
            ? Number(document.getElementById('questReqChapterCompletedInput').value)
            : null,
          requiredClassId: document.getElementById('questReqClassSelect').value
            ? Number(document.getElementById('questReqClassSelect').value)
            : null,
          requiredElement: document.getElementById('questReqElementSelect').value || null,
          requireReborn: document.getElementById('questReqRebornSelect').value === 'true',
        };

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
          episodeOrder,
          minLevel,
          prerequisiteQuestId,
          repeatType,
          triggerType,
          triggerConfigJson,
          requirementsJson,
          giverNpcId,
          giverMapId,
          turnInNpcId,
          turnInMapId,
          dialogueOfferPtBr,
          dialogueActivePtBr,
          dialogueCompletePtBr,
          objectivesJson: this.editingQuestObjectives,
          questBattleConfig: typeof this.buildQuestBattleConfigDtoFromForm === 'function' ? this.buildQuestBattleConfigDtoFromForm() : null,
          metaConfigJson: questCategory === 'META' && typeof this.buildMetaConfigDtoFromForm === 'function' ? this.buildMetaConfigDtoFromForm() : null,
          rewardsJson: {
            exp: Number(document.getElementById('questRewardExpInput').value) || 0,
            gold: Number(document.getElementById('questRewardGoldInput').value) || 0,
            statPoints: Number(document.getElementById('questRewardStatPtsInput').value) || 0,
            rewardItemTemplateId: document.getElementById('questRewardItemSelect')?.value ? Number(document.getElementById('questRewardItemSelect').value) : null,
            rewardItemQuantity: Math.max(1, Number(document.getElementById('questRewardItemQtyInput')?.value) || 1),
            triggerReborn: document.getElementById('questRewardRebornSelect').value === 'true',
          },
        };

        if (typeof this.applyCoefficientsAndStepsToDto === 'function') {
          this.applyCoefficientsAndStepsToDto(dto);
        }

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
    if (typeof window.AdminQuestsModalDom?.injectTabAndModalDom === 'function') {
      window.AdminQuestsModalDom.injectTabAndModalDom();
    }
  }
}

window.AdminQuestsTab = AdminQuestsTab;
