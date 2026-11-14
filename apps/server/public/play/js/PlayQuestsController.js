/**
 * @file apps/server/public/play/js/PlayQuestsController.js
 * @module @etheria/server
 * @description Submódulo de Quests e Indicadores de Cabeça de NPC no Mundo 2.5D (`/play`).
 *   Gerencia:
 *   - Ícones na cabeça dos NPCs no Canvas 2.5D:
 *     - `!` colorido em Vermelho (`#ff2e4c`): Missão disponível para aceitar no NPC
 *     - `?` colorido em Cinza (`#94a3b8`): Missão em andamento
 *     - `?` colorido em Vermelho (`#ff2e4c`): Missão concluída aguardando o jogador concluir no NPC
 *   - Modal de Diálogo e Interação de Missões com o NPC (`openNpcQuestModal`)
 *   - Diário de Missões do Jogador (`openQuestLogModal`)
 */

const PlayQuestsController = {
  attach(client) {
    client.questState = {
      quests: [],
      npcHeadIndicators: {},
    };
    client.questLogFilter = 'ACTIVE';

    this.injectQuestModalsDom();

    client.loadCharacterQuests = async function () {
      if (!this.activeChar) return;
      try {
        const mapId = this.currentMap?.id || '';
        const res = await this.api(
          `/api/play/characters/${this.activeChar.id}/quests?mapId=${encodeURIComponent(mapId)}`
        );
        this.questState = res || { quests: [], npcHeadIndicators: {} };
        this.updateQuestHudBadge();
      } catch (err) {
        console.warn('[PlayQuests] Falha ao carregar estado de quests:', err);
      }
    };

    client.updateQuestHudBadge = function () {
      const btn = document.getElementById('btnHudQuests');
      if (!btn) return;
      const quests = this.questState?.quests || [];
      const readyCount = quests.filter((q) => q.status === 'READY_TO_TURN_IN').length;
      const activeCount = quests.filter((q) => q.status === 'IN_PROGRESS').length;

      if (readyCount > 0) {
        btn.innerHTML = `📜 Missões <span style="background:#ef4444; color:#fff; padding:1px 6px; border-radius:99px; font-size:0.7rem; margin-left:4px;">? ${readyCount}</span>`;
      } else if (activeCount > 0) {
        btn.innerHTML = `📜 Missões <span style="background:#334155; color:#cbd5e1; padding:1px 6px; border-radius:99px; font-size:0.7rem; margin-left:4px;">${activeCount}</span>`;
      } else {
        btn.innerHTML = `📜 Missões`;
      }
    };

    /**
     * Desenha o indicador de Quest (`!` Vermelho, `?` Cinza ou `?` Vermelho)
     * flutuando acima da cabeça do NPC no Canvas 2.5D.
     */
    client.drawNpcQuestHeadIcon = function (ctx, npc, now) {
      const indicator = this.questState?.npcHeadIndicators?.[npc.npcTemplateId];
      if (!indicator) return;

      const isRed = indicator.color === 'RED';
      const symbol = indicator.symbol || '!';
      const bounce = Math.sin(now / 210) * 4.5;
      const x = npc.posX;
      const y = npc.posY - 88 + bounce;

      ctx.save();

      // Halo / Brilho de destaque atrás do símbolo
      const pulseRadius = isRed ? 16 + Math.sin(now / 160) * 2.5 : 14;
      ctx.beginPath();
      ctx.arc(x, y - 6, pulseRadius, 0, Math.PI * 2);
      ctx.fillStyle = isRed ? 'rgba(239, 68, 68, 0.28)' : 'rgba(148, 163, 184, 0.20)';
      ctx.fill();
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = isRed ? 'rgba(255, 46, 76, 0.85)' : 'rgba(203, 213, 225, 0.55)';
      ctx.stroke();

      // Símbolo principal (! ou ?) com contorno forte para leitura perfeita em qualquer mapa
      ctx.font = '900 28px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.lineWidth = 5;
      ctx.strokeStyle = isRed ? '#450a0a' : '#0f172a';
      ctx.strokeText(symbol, x, y - 5);

      ctx.fillStyle = isRed ? '#ff2e4c' : '#94a3b8';
      ctx.fillText(symbol, x, y - 5);

      // Brilho superior sutil
      ctx.fillStyle = isRed ? '#fecdd3' : '#e2e8f0';
      ctx.font = '900 10px sans-serif';
      ctx.restore();
    };

    client.getQuestCategoryBadge = function (category, chapterOrder, episodeOrder, metaStageInfo = null) {
      const epStr = metaStageInfo?.isMeta
        ? ` • Estágio ${metaStageInfo.currentStage}/${metaStageInfo.totalStages}`
        : (chapterOrder ? ` • Ep. ${chapterOrder}-${episodeOrder || 1}` : '');
      const map = {
        MAIN: {
          label: `🟡 Principal${epStr}`,
          bg: 'rgba(250, 204, 21, 0.16)',
          color: '#facc15',
          border: '#eab308',
        },
        SIDE: {
          label: `🔵 Secundária${epStr}`,
          bg: 'rgba(56, 189, 248, 0.16)',
          color: '#38bdf8',
          border: '#0284c7',
        },
        EPIC: {
          label: `🟣 Épica${epStr}`,
          bg: 'rgba(192, 132, 252, 0.16)',
          color: '#c084fc',
          border: '#9333ea',
        },
        PROFICIENCY: {
          label: `🟢 Proficiência${epStr}`,
          bg: 'rgba(74, 222, 128, 0.16)',
          color: '#4ade80',
          border: '#16a34a',
        },
        META: {
          label: `🟠 Meta${epStr}`,
          bg: 'rgba(249, 115, 22, 0.20)',
          color: '#fdba74',
          border: '#f97316',
        },
      };
      const st = map[category] || map.SIDE;
      return `<span style="background:${st.bg}; color:${st.color}; border:1px solid ${st.border}; padding:2px 8px; border-radius:99px; font-size:0.7rem; font-weight:700;">${st.label}</span>`;
    };

    client.renderRewardsSummaryHtml = function (rewards) {
      const r = rewards || {};
      const pills = [];
      if (r.exp > 0) {
        pills.push(`<span style="color:#86efac; font-weight:700;">✨ +${r.exp} EXP</span>`);
      }
      if (r.gold > 0) {
        pills.push(`<span style="color:#fde047; font-weight:700;">🪙 +${r.gold} Ouro</span>`);
      }
      if (r.rewardItemTemplateId && r.rewardItemNamePtBr) {
        pills.push(`<span style="color:#d8b4fe; font-weight:700;">🎒 +${Number(r.rewardItemQuantity || 1).toLocaleString('pt-BR')}x ${r.rewardItemNamePtBr}</span>`);
      }
      if (r.freePointsBonus > 0) {
        pills.push(`<span style="color:#38bdf8; font-weight:700;">📊 +${r.freePointsBonus} Pts Atributo</span>`);
      }
      if (r.triggerReborn) {
        pills.push(`<span style="color:#c084fc; font-weight:700;">👑 Despertar Reborn</span>`);
      }
      if (!pills.length) {
        return `<span style="color:#64748b; font-size:0.75rem;">Sem recompensas extras</span>`;
      }
      return `<div style="display:flex; gap:10px; flex-wrap:wrap; font-size:0.76rem; background:#020617; padding:6px 10px; border-radius:6px; border:1px solid #1e293b;">${pills.join('')}</div>`;
    };

    client.renderObjectivesListHtml = function (objectives) {
      return (objectives || [])
        .map((obj) => {
          const cur = Number(obj.currentCount || 0);
          const req = Number(obj.requiredCount || 1);
          const done = Boolean(obj.completed) || cur >= req;
          const bagHint = obj.type === 'COLLECT_ITEM'
            ? `<div style="font-size:0.68rem; color:#94a3b8; margin-top:2px;">Entregues: ${Number(obj.deliveredCount || 0).toLocaleString('pt-BR')} • Na mochila: ${Number(obj.bagCount || 0).toLocaleString('pt-BR')} / Necessário nesta etapa: ${Number(obj.neededFromBag ?? req).toLocaleString('pt-BR')}</div>`
            : '';
          return `
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; padding:5px 8px; border-radius:6px; background:${done ? 'rgba(34,197,94,0.12)' : '#0f172a'}; border:1px solid ${done ? 'rgba(34,197,94,0.4)' : '#1e293b'}; font-size:0.76rem;">
              <div style="color:${done ? '#86efac' : '#e2e8f0'};">
                <div>${done ? '✅' : '▫️'} ${obj.descriptionPtBr || obj.type}</div>
                ${bagHint}
              </div>
              <strong style="font-family:monospace; color:${done ? '#4ade80' : '#fde047'}; white-space:nowrap;">
                ${cur.toLocaleString('pt-BR')}/${req.toLocaleString('pt-BR')}
              </strong>
            </div>
          `;
        })
        .join('');
    };

    /**
     * Abre o modal de diálogo e missões do NPC quando o jogador interage com ele.
     */
    client.openNpcQuestModal = async function (npc) {
      if (!this.activeChar || !npc) return;
      this.activeNpcInteraction = npc;

      // 1. Notifica o servidor da conversa com o NPC (avança objetivos TALK_NPC automaticamente)
      try {
        const res = await this.api(`/api/play/characters/${this.activeChar.id}/quests/interact-npc`, {
          method: 'POST',
          body: JSON.stringify({
            npcTemplateId: npc.npcTemplateId,
            mapId: this.currentMap?.id || null,
          }),
        });
        if (res?.questState) {
          this.questState = res.questState;
          this.updateQuestHudBadge();
        } else {
          await this.loadCharacterQuests();
        }
      } catch {
        await this.loadCharacterQuests();
      }

      this.renderNpcQuestModalContent();
      document.getElementById('npcQuestModal').style.display = 'flex';
    };

    client.renderNpcQuestModalContent = function () {
      const npc = this.activeNpcInteraction;
      if (!npc) return;

      const headerEl = document.getElementById('npcQuestModalHeader');
      const bodyEl = document.getElementById('npcQuestModalBody');

      headerEl.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px;">
          <img src="${npc.thumbUrl}" style="width:46px; height:46px; object-fit:contain; background:#020617; border-radius:10px; border:1px solid #334155;" onerror="this.style.display='none'" />
          <div>
            <strong style="font-size:1rem; color:#86efac;">🧙 ${npc.namePtBr}</strong>
            <div style="font-size:0.73rem; color:#94a3b8;">
              📍 #${this.currentMap?.id} ${this.currentMap?.namePtBr} (Nv.${this.currentMap?.requiredLevel || 1})
            </div>
          </div>
        </div>
        <button class="btn-danger" onclick="document.getElementById('npcQuestModal').style.display='none'">Fechar</button>
      `;

      const allQuests = this.questState?.quests || [];
      const npcId = Number(npc.npcTemplateId);

      // Filtra missões relevantes para este NPC no mapa atual
      const turnInQuests = allQuests.filter(
        (q) => q.turnInNpcId === npcId && q.status === 'READY_TO_TURN_IN' && q.canTurnInOnCurrentMap
      );
      const availableQuests = allQuests.filter(
        (q) => q.giverNpcId === npcId && q.status === 'AVAILABLE' && q.canAcceptOnCurrentMap
      );
      const inProgressQuests = allQuests.filter(
        (q) =>
          (q.giverNpcId === npcId || q.turnInNpcId === npcId) &&
          (q.status === 'IN_PROGRESS' ||
            (q.status === 'READY_TO_TURN_IN' && q.turnInNpcId !== npcId))
      );

      const cards = [];

      // 1. Missões Prontas para Entregar (? Vermelho)
      for (const q of turnInQuests) {
        cards.push(`
          <div style="background:rgba(239, 68, 68, 0.10); border:1.5px solid #ef4444; border-radius:10px; padding:12px; display:flex; flex-direction:column; gap:8px;">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
              <div style="display:flex; align-items:center; gap:6px;">
                <span style="background:#ef4444; color:#fff; font-weight:900; width:22px; height:22px; display:inline-flex; align-items:center; justify-content:center; border-radius:99px; font-size:0.85rem;">?</span>
                <strong style="color:#fecdd3; font-size:0.92rem;">${q.titlePtBr}</strong>
              </div>
              ${this.getQuestCategoryBadge(q.category, q.chapterOrder, q.episodeOrder, q.metaStageInfo)}
            </div>
            <p style="font-size:0.82rem; color:#f8fafc; font-style:italic; background:#020617; padding:8px 10px; border-radius:6px; border-left:3px solid #ef4444;">
              "${q.dialogueCompletePtBr || q.descriptionPtBr}"
            </p>
            <div style="display:flex; flex-direction:column; gap:4px;">
              ${this.renderObjectivesListHtml(q.objectives)}
            </div>
            <div>
              <div style="font-size:0.72rem; color:#94a3b8; margin-bottom:4px;">🎁 Recompensas da Missão:</div>
              ${this.renderRewardsSummaryHtml(q.rewards)}
            </div>
            ${q.metaStageInfo?.nextStageRequiredCount ? `<div style="font-size:0.72rem; color:#fdba74; background:rgba(249,115,22,0.12); padding:5px 8px; border-radius:6px;">⏩ Ao entregar, avança para o <strong>Estágio ${q.metaStageInfo.currentStage + 1}/${q.metaStageInfo.totalStages}</strong> (Meta: ${Number(q.metaStageInfo.nextStageRequiredCount).toLocaleString('pt-BR')})</div>` : ''}
            <button class="btn-primary" style="background:linear-gradient(135deg, #ef4444, #dc2626); border-color:#f87171; color:#fff; padding:10px; font-size:0.86rem;" onclick="PlayApp.turnInCharacterQuest(${q.id})">
              ${q.metaStageInfo && q.metaStageInfo.currentStage < q.metaStageInfo.totalStages ? `🏆 Concluir Estágio ${q.metaStageInfo.currentStage}/${q.metaStageInfo.totalStages} & Avançar` : '🏆 Concluir Missão & Receber Recompensa'}
            </button>
          </div>
        `);
      }

      // 2. Missões Disponíveis para Aceitar (! Vermelho)
      for (const q of availableQuests) {
        cards.push(`
          <div style="background:rgba(239, 68, 68, 0.07); border:1.5px solid #f43f5e; border-radius:10px; padding:12px; display:flex; flex-direction:column; gap:8px;">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
              <div style="display:flex; align-items:center; gap:6px;">
                <span style="background:#ff2e4c; color:#fff; font-weight:900; width:22px; height:22px; display:inline-flex; align-items:center; justify-content:center; border-radius:99px; font-size:0.85rem;">!</span>
                <strong style="color:#fde047; font-size:0.92rem;">${q.titlePtBr}</strong>
              </div>
              ${this.getQuestCategoryBadge(q.category, q.chapterOrder, q.episodeOrder, q.metaStageInfo)}
            </div>
            <p style="font-size:0.82rem; color:#e2e8f0; font-style:italic; background:#020617; padding:8px 10px; border-radius:6px; border-left:3px solid #ff2e4c;">
              "${q.dialogueOfferPtBr || q.descriptionPtBr}"
            </p>
            <div style="font-size:0.76rem; color:#94a3b8;">${q.descriptionPtBr}</div>
            <div style="display:flex; flex-direction:column; gap:4px;">
              <span style="font-size:0.72rem; color:#94a3b8; font-weight:700;">🎯 Objetivos:</span>
              ${this.renderObjectivesListHtml(q.objectives)}
            </div>
            <div>
              <div style="font-size:0.72rem; color:#94a3b8; margin-bottom:4px;">🎁 Recompensas ao concluir:</div>
              ${this.renderRewardsSummaryHtml(q.rewards)}
            </div>
            <button class="btn-success" style="padding:10px; font-size:0.86rem;" onclick="PlayApp.acceptCharacterQuest(${q.id})">
              ✅ Aceitar Missão
            </button>
          </div>
        `);
      }

      // 3. Missões em Andamento (? Cinza)
      for (const q of inProgressQuests) {
        const hasBattleObjective = (q.objectives || []).some(
          (o) => (o.type === 'WIN_BATTLES' || o.type === 'KILL_MONSTER') && !o.completed
        );
        const battleBtnHtml = hasBattleObjective
          ? `
            <button class="btn-primary" style="background:linear-gradient(135deg, #7c3aed, #4f46e5); border:1.5px solid #a78bfa; color:#fff; font-weight:800; padding:10px 14px; font-size:0.86rem; border-radius:8px; display:flex; align-items:center; justify-content:center; gap:8px; cursor:pointer;" onclick="window.PlayApp.startQuestBattle(${q.id})">
              ⚔️ Entrar no Véu (Iniciar Treino / Combate)
            </button>
          `
          : '';

        cards.push(`
          <div style="background:rgba(148, 163, 184, 0.08); border:1px solid #475569; border-radius:10px; padding:12px; display:flex; flex-direction:column; gap:8px;">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
              <div style="display:flex; align-items:center; gap:6px;">
                <span style="background:#64748b; color:#f8fafc; font-weight:900; width:22px; height:22px; display:inline-flex; align-items:center; justify-content:center; border-radius:99px; font-size:0.85rem;">?</span>
                <strong style="color:#cbd5e1; font-size:0.9rem;">${q.titlePtBr} (Em Andamento)</strong>
              </div>
              ${this.getQuestCategoryBadge(q.category, q.chapterOrder, q.episodeOrder, q.metaStageInfo)}
            </div>
            <p style="font-size:0.8rem; color:#cbd5e1; font-style:italic; background:#020617; padding:8px 10px; border-radius:6px; border-left:3px solid #64748b;">
              "${q.dialogueActivePtBr || 'Continue cumprindo os objetivos da missão e retorne quando terminar.'}"
            </p>
            <div style="display:flex; flex-direction:column; gap:4px;">
              ${this.renderObjectivesListHtml(q.objectives)}
            </div>
            <div>
              ${this.renderRewardsSummaryHtml(q.rewards)}
            </div>
            ${battleBtnHtml}
          </div>
        `);
      }

      if (!cards.length) {
        bodyEl.innerHTML = `
          <div style="background:#020617; border:1px solid #1e293b; border-radius:10px; padding:14px; text-align:center; color:#94a3b8; font-size:0.84rem;">
            💬 <strong>${npc.namePtBr}:</strong> "Saudações, <strong>${this.activeChar.name}</strong>! Que os ventos de <strong>${this.currentMap?.namePtBr || 'Etheria'}</strong> guiem sua jornada."
            <div style="margin-top:8px; font-size:0.75rem; color:#64748b;">
              (Nenhuma missão pendente com este NPC neste mapa no momento)
            </div>
          </div>
        `;
      } else {
        bodyEl.innerHTML = cards.join('');
      }
    };

    client.acceptCharacterQuest = async function (questId) {
      if (!this.activeChar) return;
      try {
        const res = await this.api(`/api/play/characters/${this.activeChar.id}/quests/${questId}/accept`, {
          method: 'POST',
          body: JSON.stringify({ mapId: this.currentMap?.id || null }),
        });
        if (res?.questState) {
          this.questState = res.questState;
          this.updateQuestHudBadge();
        }
        this.renderNpcQuestModalContent();
      } catch (err) {
        alert(`Erro ao aceitar missão: ${err.message}`);
      }
    };

    client.turnInCharacterQuest = async function (questId) {
      if (!this.activeChar) return;
      try {
        const res = await this.api(`/api/play/characters/${this.activeChar.id}/quests/${questId}/turn-in`, {
          method: 'POST',
          body: JSON.stringify({ mapId: this.currentMap?.id || null }),
        });
        if (res?.questState) {
          this.questState = res.questState;
          this.updateQuestHudBadge();
        }
        if (res?.character) {
          this.activeChar.level = res.character.level;
          this.activeChar.exp = res.character.exp;
          this.activeChar.gold = res.character.gold;
          this.activeChar.freePoints = res.character.freePoints;
          if (res.character.isReborn && !this.activeChar.isReborn) {
            // Atualiza o personagem completo para refletir o visual Reborn
            await this.loadPlayBootstrap();
            const updated = this.myCharacters.find((c) => c.id === this.activeChar.id);
            if (updated) this.activeChar = updated;
          }
          this.updateHudInfo();
        }
        this.renderNpcQuestModalContent();
      } catch (err) {
        alert(`Erro ao concluir missão: ${err.message}`);
      }
    };

    /**
     * Abre o Diário de Missões do Jogador (`📜 Missões`).
     */
    client.openQuestLogModal = async function (filter) {
      if (filter) this.questLogFilter = filter;
      await this.loadCharacterQuests();

      const bodyEl = document.getElementById('questLogModalBody');
      const allQuests = this.questState?.quests || [];

      const filtered = allQuests.filter((q) => {
        if (this.questLogFilter === 'ACTIVE') {
          return q.status === 'IN_PROGRESS' || q.status === 'READY_TO_TURN_IN';
        }
        if (this.questLogFilter === 'AVAILABLE') {
          return q.status === 'AVAILABLE';
        }
        if (this.questLogFilter === 'LOCKED') {
          return q.status === 'LOCKED';
        }
        if (this.questLogFilter === 'COMPLETED') {
          return q.status === 'COMPLETED';
        }
        return true;
      });

      const tabsHtml = `
        <div style="display:flex; gap:6px; flex-wrap:wrap; border-bottom:1px solid #334155; padding-bottom:8px;">
          <button class="${this.questLogFilter === 'ACTIVE' ? 'btn-primary' : ''}" onclick="PlayApp.openQuestLogModal('ACTIVE')" style="font-size:0.76rem; padding:5px 10px;">
            ⏳ Em Andamento (${allQuests.filter((q) => q.status === 'IN_PROGRESS' || q.status === 'READY_TO_TURN_IN').length})
          </button>
          <button class="${this.questLogFilter === 'AVAILABLE' ? 'btn-primary' : ''}" onclick="PlayApp.openQuestLogModal('AVAILABLE')" style="font-size:0.76rem; padding:5px 10px;">
            ❗ Disponíveis (${allQuests.filter((q) => q.status === 'AVAILABLE').length})
          </button>
          <button class="${this.questLogFilter === 'LOCKED' ? 'btn-primary' : ''}" onclick="PlayApp.openQuestLogModal('LOCKED')" style="font-size:0.76rem; padding:5px 10px;">
            🔒 Próximos Episódios (${allQuests.filter((q) => q.status === 'LOCKED').length})
          </button>
          <button class="${this.questLogFilter === 'COMPLETED' ? 'btn-primary' : ''}" onclick="PlayApp.openQuestLogModal('COMPLETED')" style="font-size:0.76rem; padding:5px 10px;">
            ✅ Concluídas (${allQuests.filter((q) => q.status === 'COMPLETED').length})
          </button>
        </div>
      `;

      const listHtml = filtered.length
        ? filtered
            .map((q) => {
              const statusBadge =
                q.status === 'READY_TO_TURN_IN'
                  ? `<span style="background:#ef4444; color:#fff; padding:2px 8px; border-radius:99px; font-size:0.7rem; font-weight:700;">? Pronta para Entregar</span>`
                  : q.status === 'IN_PROGRESS'
                  ? `<span style="background:#475569; color:#f8fafc; padding:2px 8px; border-radius:99px; font-size:0.7rem; font-weight:700;">? Em Andamento</span>`
                  : q.status === 'AVAILABLE'
                  ? `<span style="background:#ff2e4c; color:#fff; padding:2px 8px; border-radius:99px; font-size:0.7rem; font-weight:700;">! Disponível</span>`
                  : q.status === 'LOCKED'
                  ? `<span style="background:#1e293b; color:#fde047; border:1px solid #eab308; padding:2px 8px; border-radius:99px; font-size:0.7rem; font-weight:700;">🔒 Bloqueada</span>`
                  : `<span style="background:rgba(34,197,94,0.2); color:#4ade80; padding:2px 8px; border-radius:99px; font-size:0.7rem; font-weight:700;">✅ Concluída</span>`;

              const mapHint = q.giverMapNamePtBr
                ? `📍 ${q.giverMapNamePtBr}`
                : `🌍 Qualquer mapa onde ${q.giverNpcNamePtBr} estiver`;

              return `
                <div style="background:#0f172a; border:1px solid #334155; border-radius:10px; padding:10px 12px; display:flex; flex-direction:column; gap:6px;">
                  <div style="display:flex; justify-content:space-between; align-items:center; gap:6px; flex-wrap:wrap;">
                    <strong style="color:#fde047; font-size:0.88rem;">${q.titlePtBr}</strong>
                    <div style="display:flex; gap:6px; align-items:center;">
                      ${this.getQuestCategoryBadge(q.category, q.chapterOrder, q.episodeOrder, q.metaStageInfo)}
                      ${statusBadge}
                    </div>
                  </div>
                  <div style="font-size:0.75rem; color:#94a3b8;">${q.descriptionPtBr}</div>
                  <div style="font-size:0.72rem; color:#38bdf8;">
                    🧙 NPC: <strong>${q.giverNpcNamePtBr}</strong> • ${mapHint}
                  </div>
                  <div style="font-size:0.71rem; color:#fde047;">
                    ⚡ <strong>Gatilho:</strong> ${q.triggerSummaryPtBr || 'Falar com NPC'} &nbsp;|&nbsp; 🔒 <strong>Requisito:</strong> ${q.requirementSummaryPtBr || `Nv. Mín ${q.minLevel || 1}`}
                  </div>
                  <div style="display:flex; flex-direction:column; gap:4px;">
                    ${this.renderObjectivesListHtml(q.objectives)}
                  </div>
                  ${this.renderRewardsSummaryHtml(q.rewards)}
                  ${
                    q.status === 'IN_PROGRESS' &&
                    (q.objectives || []).some((o) => (o.type === 'WIN_BATTLES' || o.type === 'KILL_MONSTER') && !o.completed)
                      ? `<button class="btn-primary" style="background:linear-gradient(135deg, #7c3aed, #4f46e5); border:1.5px solid #a78bfa; color:#fff; font-weight:800; padding:8px 12px; font-size:0.82rem; border-radius:8px; display:flex; align-items:center; justify-content:center; gap:8px; cursor:pointer; margin-top:4px;" onclick="window.PlayApp.startQuestBattle(${q.id})">
                          ⚔️ Entrar no Véu (Iniciar Treino / Combate)
                        </button>`
                      : ''
                  }
                </div>
              `;
            })
            .join('')
        : `<div style="padding:18px; text-align:center; color:#64748b; font-size:0.82rem;">Nenhuma missão nesta aba.</div>`;

      bodyEl.innerHTML = `${tabsHtml}<div style="display:flex; flex-direction:column; gap:8px; margin-top:4px;">${listHtml}</div>`;
      document.getElementById('questLogModal').style.display = 'flex';
    };

    /**
     * Inicia a Batalha no Véu associada a uma Missão (Treino ou Caça de Anomalias).
     */
    client.startQuestBattle = async function (questId) {
      if (!this.activeChar) return;
      try {
        const npcModal = document.getElementById('npcQuestModal');
        if (npcModal) npcModal.style.display = 'none';
        const logModal = document.getElementById('questLogModal');
        if (logModal) logModal.style.display = 'none';

        const battleState = await this.api(`/api/play/combat/quest-battle`, {
          method: 'POST',
          body: JSON.stringify({ characterId: this.activeChar.id, questId }),
        });

        if (!this.actionCombatArena && window.ActionCombatArena) {
          this.actionCombatArena = new ActionCombatArena(this);
          window.PlayApp.actionArena = this.actionCombatArena;
        }
        if (this.actionCombatArena) {
          this.actionCombatArena.openArena(battleState);
        } else {
          alert('Erro: ActionCombatArena não pôde ser instanciada.');
        }
      } catch (err) {
        alert(`Erro ao iniciar batalha no Véu: ${err.message}`);
      }
    };
  },

  injectQuestModalsDom() {
    if (!document.getElementById('npcQuestModal')) {
      const npcModal = document.createElement('div');
      npcModal.id = 'npcQuestModal';
      npcModal.className = 'modal-backdrop';
      npcModal.innerHTML = `
        <div class="modal-box" style="width:min(95vw, 540px);">
          <div id="npcQuestModalHeader" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #334155; padding-bottom:10px;"></div>
          <div id="npcQuestModalBody" style="display:flex; flex-direction:column; gap:10px;"></div>
        </div>
      `;
      document.body.appendChild(npcModal);
    }

    if (!document.getElementById('questLogModal')) {
      const logModal = document.createElement('div');
      logModal.id = 'questLogModal';
      logModal.className = 'modal-backdrop';
      logModal.innerHTML = `
        <div class="modal-box" style="width:min(95vw, 600px);">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #334155; padding-bottom:10px;">
            <h3 style="color:#fde047; font-size:1rem;">📜 Diário de Missões</h3>
            <button class="btn-danger" onclick="document.getElementById('questLogModal').style.display='none'">Fechar</button>
          </div>
          <div id="questLogModalBody" style="display:flex; flex-direction:column; gap:10px;"></div>
        </div>
      `;
      document.body.appendChild(logModal);
    }
  },
};

window.PlayQuestsController = PlayQuestsController;
