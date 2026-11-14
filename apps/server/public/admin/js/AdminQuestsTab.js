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

    app.formatQuestObjectivesSummary = function (objectives) {
      if (!Array.isArray(objectives) || objectives.length === 0) return '<em>Sem objetivos</em>';
      return objectives
        .map((obj) => {
          const effTier = obj.type === 'KILL_BOSS' ? 'BOSS' : obj.type === 'KILL_LEADER' ? 'LEADER' : String(obj.variantTier || 'ANY').toUpperCase();
          const tierBadge = effTier === 'BOSS' ? '💀 Boss de ' : effTier === 'LEADER' ? '👑 Líder de ' : '';
          if (obj.type === 'KILL_MONSTER' || obj.type === 'KILL_LEADER' || obj.type === 'KILL_BOSS') {
            const mob = (this.monsterTemplates || []).find((m) => Number(m.id) === Number(obj.monsterTemplateId));
            const mName = mob ? mob.namePtBr : (obj.monsterTemplateId ? `Monstro #${obj.monsterTemplateId}` : 'Qualquer Monstro');
            return `${effTier === 'BOSS' ? '💀' : effTier === 'LEADER' ? '👑' : '🐉'} Eliminar <strong>${Number(obj.requiredCount || 1).toLocaleString('pt-BR')}x ${tierBadge}${mName}</strong>`;
          }
          if (obj.type === 'KILL_RACE') {
            const race = (this.races || []).find((r) => String(r.code).toUpperCase() === String(obj.raceCode || '').toUpperCase());
            return `🐾 Eliminar <strong>${Number(obj.requiredCount || 1).toLocaleString('pt-BR')}x ${tierBadge}Raça ${race?.namePtBr || obj.raceCode || '?'}</strong>`;
          }
          if (obj.type === 'COLLECT_ITEM') {
            const item = (this.itemTemplates || []).find((it) => Number(it.id) === Number(obj.itemTemplateId));
            return `📦 Coletar e Entregar <strong>${Number(obj.requiredCount || 1).toLocaleString('pt-BR')}x ${item ? item.namePtBr : `Item #${obj.itemTemplateId}`}</strong>`;
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
          if (obj.type === 'WIN_BATTLES') {
            return `⚔️ Vencer <strong>${obj.requiredCount || 1} Batalha(s)</strong>`;
          }
          return obj.labelPtBr || obj.type;
        })
        .join('<br/>');
    };

    /**
     * Renderiza o Quadro de Fluxo estilo Draw.io agrupado por Capítulos e Episódios (`1-1` -> `1-2` -> `1-3`).
     */
    app.renderQuestsDrawIoBoard = function () {
      const board = document.getElementById('questsDrawIoWrapper');
      if (!board) return;

      const filtered = (this.questTemplates || []).filter((q) => {
        if (this.questCategoryFilter === 'ALL') return true;
        return q.questCategory === this.questCategoryFilter;
      });

      if (filtered.length === 0) {
        board.innerHTML = `
          <div style="padding:32px; text-align:center; color:var(--text-muted); border:1px dashed var(--border); border-radius:12px; width:100%;">
            Nenhuma Quest encontrada para este filtro. Clique em <strong>"➕ Nova Quest No-Code"</strong> acima!
          </div>`;
        return;
      }

      // Agrupa por chapterOrder (1, 2, 3...)
      const chapterGroups = new Map();
      for (const q of filtered) {
        const chap = Math.max(1, Number(q.chapterOrder) || 1);
        if (!chapterGroups.has(chap)) {
          chapterGroups.set(chap, []);
        }
        chapterGroups.get(chap).push(q);
      }

      const sortedChapters = [...chapterGroups.keys()].sort((a, b) => a - b);
      const maxChapter = sortedChapters.length > 0 ? sortedChapters[sortedChapters.length - 1] : 1;

      const catStyles = {
        MAIN: { label: '🟡 Principal', bg: 'rgba(234,179,8,0.18)', color: '#fde047', border: '#eab308', cardBg: 'linear-gradient(180deg, rgba(30,41,59,0.96), rgba(15,23,42,0.98))' },
        SIDE: { label: '🔵 Secundária', bg: 'rgba(56,189,248,0.18)', color: '#7dd3fc', border: '#0ea5e9', cardBg: 'linear-gradient(180deg, rgba(15,23,42,0.96), rgba(9,13,22,0.98))' },
        EPIC: { label: '🟣 Épica', bg: 'rgba(192,132,252,0.18)', color: '#d8b4fe', border: '#a855f7', cardBg: 'linear-gradient(180deg, rgba(30,27,75,0.94), rgba(15,23,42,0.98))' },
        PROFICIENCY: { label: '🟢 Proficiência', bg: 'rgba(34,197,94,0.18)', color: '#86efac', border: '#22c55e', cardBg: 'linear-gradient(180deg, rgba(6,46,34,0.88), rgba(15,23,42,0.98))' },
        META: { label: '🟠 Meta Procedural', bg: 'rgba(249,115,22,0.22)', color: '#fdba74', border: '#f97316', cardBg: 'linear-gradient(180deg, rgba(67,20,7,0.9), rgba(15,23,42,0.98))' },
      };

      const renderQuestCard = (q, nextMainInChapter = null) => {
        const st = catStyles[q.questCategory] || catStyles.MAIN;
        const rew = q.rewardsJson || {};
        const rewPills = [];
        if (rew.exp) rewPills.push(`✨ +${rew.exp} EXP`);
        if (rew.gold) rewPills.push(`🪙 +${rew.gold} Ouro`);
        if (rew.statPoints) rewPills.push(`📊 +${rew.statPoints} Pts`);
        if (rew.rewardItemTemplateId) rewPills.push(`🎒 +${rew.rewardItemQuantity || 1}x ${q.rewardItemNamePtBr || `#${rew.rewardItemTemplateId}`}`);
        if (rew.triggerReborn) rewPills.push(`👑 Reborn`);

        return `
          <div style="display:flex; align-items:center; gap:0;">
            <!-- CARD DRAW.IO DA QUEST / EPISÓDIO -->
            <div style="width:305px; min-width:305px; background:${st.cardBg}; border:2px solid ${st.border}; border-radius:12px; padding:12px; box-shadow:0 10px 25px rgba(0,0,0,0.55); display:flex; flex-direction:column; gap:8px; position:relative;">
              <!-- Cabeçalho do Card: Episódio (1-1, 1-2) + Categoria + Código -->
              <div style="display:flex; justify-content:space-between; align-items:center; gap:6px; border-bottom:1px solid rgba(148,163,184,0.2); padding-bottom:6px;">
                <span style="background:${st.border}; color:#020617; font-weight:900; font-size:0.78rem; padding:2px 9px; border-radius:6px; letter-spacing:0.3px;">
                  📌 Ep. ${q.episodeCode || `${q.chapterOrder}-${q.episodeOrder || 1}`}
                </span>
                <span style="background:${st.bg}; color:${st.color}; border:1px solid ${st.border}; padding:2px 8px; border-radius:99px; font-size:0.68rem; font-weight:800;">
                  ${st.label}
                </span>
                <span style="font-size:0.68rem; color:#94a3b8; font-family:monospace;">#${q.id} • ${q.code}</span>
              </div>

              <!-- Título e Descrição -->
              <div>
                <div style="font-weight:800; font-size:0.92rem; color:#f8fafc; line-height:1.25;">${q.titlePtBr}</div>
                <div style="font-size:0.72rem; color:#94a3b8; margin-top:3px; line-height:1.3;">${q.descriptionPtBr || 'Sem descrição'}</div>
              </div>

              <!-- Gatilho & Requisito (Obrigatórios em todas as Quests) -->
              <div style="background:rgba(2,6,23,0.85); border:1px solid #334155; border-radius:8px; padding:7px 9px; display:flex; flex-direction:column; gap:4px; font-size:0.71rem;">
                <div style="color:#38bdf8;">
                  <strong style="color:#7dd3fc;">⚡ Gatilho:</strong> ${q.triggerSummaryPtBr || '💬 Falar com NPC'}
                </div>
                <div style="color:#fde047;">
                  <strong style="color:#fef08a;">🔒 Requisito:</strong> ${q.requirementSummaryPtBr || `Nv. Mín ${q.minLevel || 1}`}
                </div>
              </div>

              <!-- Vínculo de NPCs & Mapas -->
              <div style="background:rgba(2,6,23,0.65); border:1px dashed #334155; border-radius:8px; padding:6px 8px; font-size:0.7rem; display:flex; flex-direction:column; gap:3px;">
                <div><strong style="color:#f87171;">❗ Início:</strong> ${q.giverNpcNamePtBr} <span style="color:#86efac;">(${q.giverMapNamePtBr})</span></div>
                <div><strong style="color:#fde047;">❓ Entrega:</strong> ${q.turnInNpcNamePtBr} <span style="color:#7dd3fc;">(${q.turnInMapNamePtBr})</span></div>
              </div>

              <!-- Objetivos -->
              <div style="background:rgba(15,23,42,0.8); border-left:3px solid ${st.border}; padding:5px 8px; font-size:0.72rem; line-height:1.35;">
                ${q.metaSummaryPtBr ? `<div style="color:#fdba74; font-weight:700; margin-bottom:2px;">${q.metaSummaryPtBr}</div>` : ''}
                ${q.questBattleSummaryPtBr ? `<div style="color:#fda4af; font-weight:700; margin-bottom:2px;">${q.questBattleSummaryPtBr}</div>` : ''}
                ${this.formatQuestObjectivesSummary(q.objectivesJson)}
              </div>

              <!-- Recompensas & Ações do Card -->
              <div style="display:flex; justify-content:space-between; align-items:center; gap:6px; padding-top:4px; border-top:1px solid rgba(148,163,184,0.15); margin-top:auto;">
                <div style="font-size:0.68rem; color:#86efac; font-weight:700;">
                  ${rewPills.join(' • ') || 'Sem recompensa'}
                </div>
                <div style="display:flex; gap:4px;">
                  <button class="btn-primary" style="padding:4px 8px; font-size:0.72rem;" onclick="AdminApp.openQuestTemplateModal(${q.id})" title="Editar este Episódio/Quest">✏️ Editar</button>
                  <button class="btn-danger" style="padding:4px 7px; font-size:0.72rem;" onclick="AdminApp.deleteQuestTemplate(${q.id})" title="Excluir Quest">🗑️</button>
                </div>
              </div>
            </div>

            ${
              nextMainInChapter
                ? `
                <!-- CONECTOR DRAW.IO ENTRE EPISÓDIOS (Ex: 1-1 ➔ 1-2) -->
                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; min-width:74px; padding:0 4px; color:#fde047;">
                  <span style="font-size:0.63rem; background:#020617; border:1px solid #eab308; color:#fef08a; padding:2px 6px; border-radius:99px; font-weight:700; white-space:nowrap; margin-bottom:3px;">
                    🔒 Libera ${nextMainInChapter.chapterOrder}-${nextMainInChapter.episodeOrder}
                  </span>
                  <div style="display:flex; align-items:center; width:100%;">
                    <div style="flex:1; height:3px; background:linear-gradient(90deg, #eab308, #fde047);"></div>
                    <span style="font-size:1.05rem; line-height:1; color:#fde047; margin-left:-3px;">▶</span>
                  </div>
                </div>`
                : ''
            }
          </div>
        `;
      };

      const chaptersHtml = sortedChapters
        .map((chapNum, cIdx) => {
          const questsInChap = chapterGroups.get(chapNum) || [];
          const mainEpisodes = questsInChap
            .filter((q) => q.questCategory === 'MAIN')
            .sort((a, b) => (a.episodeOrder || 1) - (b.episodeOrder || 1) || a.id - b.id);
          const parallelQuests = questsInChap
            .filter((q) => q.questCategory !== 'MAIN')
            .sort((a, b) => (a.episodeOrder || 1) - (b.episodeOrder || 1) || a.id - b.id);

          const nextMainEpNum =
            mainEpisodes.length > 0
              ? Math.max(...mainEpisodes.map((m) => Number(m.episodeOrder) || 1)) + 1
              : 1;

          const mainFlowHtml =
            mainEpisodes.length > 0
              ? mainEpisodes
                  .map((q, idx) => renderQuestCard(q, mainEpisodes[idx + 1] || null))
                  .join('')
              : `<div style="padding:14px; color:var(--text-muted); font-size:0.78rem; border:1px dashed #334155; border-radius:8px;">Nenhum Episódio Principal neste capítulo ainda.</div>`;

          const parallelFlowHtml =
            parallelQuests.length > 0
              ? `
                <div style="margin-top:12px; padding-top:12px; border-top:1px dashed #334155;">
                  <div style="font-size:0.75rem; font-weight:700; color:#94a3b8; margin-bottom:8px;">
                    🌿 Missões Secundárias, Épicas e de Proficiência vinculadas ao Capítulo ${chapNum}:
                  </div>
                  <div style="display:flex; flex-wrap:wrap; gap:14px; align-items:stretch;">
                    ${parallelQuests.map((q) => renderQuestCard(q, null)).join('')}
                  </div>
                </div>`
              : '';

          const nextChapterNum = sortedChapters[cIdx + 1] || null;
          const epCodesSummary = mainEpisodes.map((m) => `${m.chapterOrder}-${m.episodeOrder}`).join(', ');

          return `
            <!-- CONTAINER DO CAPÍTULO (ESTILO AGRUPAMENTO DRAW.IO) -->
            <div style="background:rgba(9, 13, 22, 0.92); border:2px solid #475569; border-radius:14px; padding:16px; position:relative; box-shadow:0 12px 32px rgba(0,0,0,0.6);">
              <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; border-bottom:1px solid #334155; padding-bottom:10px; margin-bottom:14px;">
                <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                  <span style="background:linear-gradient(135deg, #eab308, #ca8a04); color:#020617; font-weight:900; font-size:0.88rem; padding:4px 12px; border-radius:8px;">
                    📘 CAPÍTULO ${chapNum}
                  </span>
                  <span style="font-size:0.78rem; color:#fde047; font-weight:700;">
                    ${mainEpisodes.length} Episódio(s) Principal(is) ${epCodesSummary ? `(${epCodesSummary})` : ''}
                  </span>
                  ${
                    parallelQuests.length > 0
                      ? `<span style="font-size:0.75rem; color:#7dd3fc;">• +${parallelQuests.length} Missão(ões) Paralela(s)</span>`
                      : ''
                  }
                </div>
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                  <button class="btn-primary" style="padding:5px 11px; font-size:0.75rem;" onclick="AdminApp.openNewQuestInChapter(${chapNum}, ${nextMainEpNum}, 'MAIN')">
                    ➕ Novo Episódio Principal (${chapNum}-${nextMainEpNum})
                  </button>
                  <button style="padding:5px 11px; font-size:0.75rem; border-color:#38bdf8; color:#7dd3fc;" onclick="AdminApp.openNewQuestInChapter(${chapNum}, 1, 'SIDE')">
                    ➕ Secundária / Épica / Proficiência no Cap. ${chapNum}
                  </button>
                </div>
              </div>

              <!-- RAIA LINEAR DE EPISÓDIOS PRINCIPAIS (1-1 -> 1-2 -> 1-3) -->
              <div style="display:flex; align-items:center; gap:0; overflow-x:auto; padding-bottom:6px;">
                ${mainFlowHtml}
              </div>

              ${parallelFlowHtml}
            </div>

            ${
              nextChapterNum
                ? `
                <!-- CONECTOR DE TRANSIÇÃO ENTRE CAPÍTULOS (CAP. C ===> CAP. C+1) -->
                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; margin:4px 0;">
                  <div style="width:4px; height:18px; background:#eab308;"></div>
                  <div style="background:#020617; border:1.5px solid #eab308; color:#fde047; padding:4px 14px; border-radius:99px; font-size:0.74rem; font-weight:800; box-shadow:0 0 15px rgba(234,179,8,0.25);">
                    🔒 PORTÃO DE CAPÍTULO: Concluir todos os episódios do Capítulo ${chapNum} (${epCodesSummary || `Cap. ${chapNum}`}) libera o Capítulo ${nextChapterNum} ▼
                  </div>
                  <div style="width:4px; height:18px; background:#eab308;"></div>
                </div>`
                : ''
            }
          `;
        })
        .join('');

      board.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:8px; width:100%;">
          ${chaptersHtml}
          <div style="display:flex; justify-content:center; margin-top:10px;">
            <button class="btn-success" style="padding:10px 20px; font-size:0.84rem;" onclick="AdminApp.openNewQuestInChapter(${maxChapter + 1}, 1, 'MAIN')">
              📘 ➕ Criar Novo Capítulo (Capítulo ${maxChapter + 1} • Episódio ${maxChapter + 1}-1)
            </button>
          </div>
        </div>
      `;
    };

    app.openNewQuestInChapter = function (chapterNum, episodeNum, category = 'MAIN') {
      this.openQuestTemplateModal(null, {
        chapterOrder: chapterNum,
        episodeOrder: episodeNum,
        questCategory: category,
      });
    };

    app.renderQuestsCrudTable = function () {
      const tbody = document.getElementById('questsTableBody');
      if (!tbody) return;

      const filtered = (this.questTemplates || []).filter((q) => {
        if (this.questCategoryFilter === 'ALL') return true;
        return q.questCategory === this.questCategoryFilter;
      });

      if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="color:var(--text-muted); padding:16px; text-align:center;">Nenhuma Quest encontrada para este filtro.</td></tr>`;
        return;
      }

      const catBadges = {
        MAIN: { label: '🟡 Principal', bg: 'rgba(234,179,8,0.2)', color: '#fde047', border: '#eab308' },
        SIDE: { label: '🔵 Secundária', bg: 'rgba(56,189,248,0.2)', color: '#7dd3fc', border: '#0ea5e9' },
        EPIC: { label: '🟣 Épica', bg: 'rgba(192,132,252,0.2)', color: '#d8b4fe', border: '#a855f7' },
        PROFICIENCY: { label: '🟢 Proficiência', bg: 'rgba(34,197,94,0.2)', color: '#86efac', border: '#22c55e' },
        META: { label: '🟠 Meta Procedural', bg: 'rgba(249,115,22,0.2)', color: '#fdba74', border: '#f97316' },
      };

      tbody.innerHTML = filtered
        .map((q) => {
          const cb = catBadges[q.questCategory] || catBadges.MAIN;
          const rew = q.rewardsJson || {};
          const rewParts = [];
          if (rew.exp) rewParts.push(`✨ +${rew.exp} EXP`);
          if (rew.gold) rewParts.push(`🪙 +${rew.gold} Ouro`);
          if (rew.statPoints) rewParts.push(`📊 +${rew.statPoints} Pts`);
          if (rew.rewardItemTemplateId) rewParts.push(`🎒 +${rew.rewardItemQuantity || 1}x ${q.rewardItemNamePtBr || `#${rew.rewardItemTemplateId}`}`);
          if (rew.triggerReborn) rewParts.push(`👑 Ativa Reborn`);

          return `
          <tr>
            <td>
              <span style="background:#eab308; color:#020617; font-weight:900; padding:2px 7px; border-radius:6px; font-size:0.75rem;">
                Ep. ${q.episodeCode || `${q.chapterOrder}-${q.episodeOrder || 1}`}
              </span>
              <div style="font-size:0.7rem; color:#94a3b8; margin-top:3px;"><strong>#${q.id}</strong> • ${q.code}</div>
            </td>
            <td>
              <span style="padding:3px 9px; border-radius:99px; background:${cb.bg}; color:${cb.color}; border:1px solid ${cb.border}; font-size:0.72rem; font-weight:800;">
                ${cb.label}
              </span>
              <div style="font-size:0.68rem; color:var(--text-muted); margin-top:4px;">Cap. ${q.chapterOrder || 1} • Ep. ${q.episodeOrder || 1}</div>
            </td>
            <td>
              <strong>${q.titlePtBr}</strong>
              <div style="font-size:0.71rem; color:var(--text-muted); max-width:220px; white-space:normal;">📜 ${q.descriptionPtBr || ''}</div>
            </td>
            <td>
              <div style="font-size:0.72rem; color:#38bdf8; font-weight:700;">${q.triggerSummaryPtBr || '💬 Falar com NPC'}</div>
              <div style="font-size:0.69rem; color:#fde047; margin-top:3px;">🔒 ${q.requirementSummaryPtBr || `Nv. Mín ${q.minLevel || 1}`}</div>
            </td>
            <td>
              <div style="font-weight:700; color:#f87171;">❗ ${q.giverNpcNamePtBr}</div>
              <div style="font-size:0.7rem; color:#86efac;">${q.giverMapNamePtBr}</div>
            </td>
            <td>
              <div style="font-weight:700; color:#fde047;">❓ ${q.turnInNpcNamePtBr}</div>
              <div style="font-size:0.7rem; color:#7dd3fc;">${q.turnInMapNamePtBr}</div>
            </td>
            <td>
              <div style="font-size:0.72rem; line-height:1.35;">${q.metaSummaryPtBr ? `<div style="color:#fdba74; font-weight:700;">${q.metaSummaryPtBr}</div>` : ''}${this.formatQuestObjectivesSummary(q.objectivesJson)}</div>
            </td>
            <td>
              <div style="font-size:0.72rem; color:#86efac; font-weight:600;">${rewParts.join('<br/>') || '—'}</div>
            </td>
            <td>
              <div style="display:flex; gap:6px;">
                <button class="btn-primary" onclick="AdminApp.openQuestTemplateModal(${q.id})">✏️</button>
                <button class="btn-danger" onclick="AdminApp.deleteQuestTemplate(${q.id})">🗑️</button>
              </div>
            </td>
          </tr>`;
        })
        .join('');
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

      if (typeof this.loadMetaConfigIntoForm === 'function') {
        this.loadMetaConfigIntoForm(existing);
      }
      if (typeof this.loadQuestBattleConfigIntoForm === 'function') {
        this.loadQuestBattleConfigIntoForm(existing);
      }
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
