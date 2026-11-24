/**
 * @file apps/server/public/admin/js/AdminQuestsBoardView.js
 * @module @etheria/server
 * @description Submódulo da Aba Quests (`/admin`) responsável pela renderização do quadro visual
 *   estilo Draw.io agrupado por Capítulos/Episódios, resumo de objetivos e tabela CRUD completa.
 */

class AdminQuestsBoardView {
  static attach(app) {
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
        const effExp = q.effectiveExp ?? rew.exp ?? 0;
        const effGold = q.effectiveGold ?? rew.gold ?? 0;
        if (effExp) rewPills.push(`✨ +${Number(effExp).toLocaleString('pt-BR')} EXP (x${q.expCoefficient ?? 1})`);
        if (effGold) rewPills.push(`🪙 +${Number(effGold).toLocaleString('pt-BR')} Ouro (x${q.goldCoefficient ?? 1})`);
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
          const effExp = q.effectiveExp ?? rew.exp ?? 0;
          const effGold = q.effectiveGold ?? rew.gold ?? 0;
          if (effExp) rewParts.push(`✨ +${Number(effExp).toLocaleString('pt-BR')} EXP (x${q.expCoefficient ?? 1})`);
          if (effGold) rewParts.push(`🪙 +${Number(effGold).toLocaleString('pt-BR')} Ouro (x${q.goldCoefficient ?? 1})`);
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
  }
}

window.AdminQuestsBoardView = AdminQuestsBoardView;
