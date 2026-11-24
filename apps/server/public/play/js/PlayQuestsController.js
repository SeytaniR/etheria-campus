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
    if (window.PlayQuestStepModal) window.PlayQuestStepModal.attach(client);

    client.loadCharacterQuests = async function () {
      if (!this.activeChar) return;
      try {
        const mapId = this.currentMap?.id || '';
        const res = await this.api(
          `/api/play/characters/${this.activeChar.id}/quests?mapId=${encodeURIComponent(mapId)}`
        );
        this.questState = res || { quests: [], npcHeadIndicators: {} };
        this.updateQuestHudBadge();
        window.PlayQuestStepModal?.updateQuestChecklistHud(this);
      } catch (err) {
        console.warn('[PlayQuests] Falha ao carregar estado de quests:', err);
      }
    };

    client.updateQuestHudBadge = function () {
      const quests = this.questState?.quests || [];
      const readyCount = quests.filter((q) => q.status === 'READY_TO_TURN_IN').length;
      const activeCount = quests.filter((q) => q.status === 'IN_PROGRESS').length;

      const bottomBadge = document.getElementById('hudBottomQuestsBadge');
      if (bottomBadge) {
        if (readyCount > 0) {
          bottomBadge.textContent = readyCount > 99 ? '99+' : String(readyCount);
          bottomBadge.style.display = 'inline-flex';
        } else {
          bottomBadge.style.display = 'none';
        }
      }

      const btn = document.getElementById('btnHudQuests');
      if (!btn) return;
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

    client.getRewardRarityBorder = function (rarityTier) {
      const r = String(rarityTier || 'COMMON').toUpperCase();
      if (r === 'D' || r === 'UNCOMMON') return '#22c55e';
      if (r === 'C' || r === 'RARE') return '#3b82f6';
      if (r === 'B' || r === 'EPIC') return '#a855f7';
      if (r === 'A' || r === 'LEGENDARY') return '#f97316';
      if (r === 'S' || r === 'MYTHIC') return '#ef4444';
      if (r === 'SS' || r === 'COSMIC') return '#111827';
      return '#cbd5e1';
    };

    client.renderRewardsSummaryHtml = function (rewards) {
      const r = rewards || {};
      const pills = [];
      if (r.exp > 0) {
        pills.push(
          `<span style="display:inline-flex; align-items:center; gap:4px; color:#86efac; font-weight:800; background:rgba(34,197,94,0.10); border:1px solid rgba(74,222,128,0.28); padding:3px 8px; border-radius:7px;">⚡ +${Number(r.exp).toLocaleString('pt-BR')} EXP</span>`
        );
      }
      if (r.gold > 0) {
        pills.push(
          `<span style="display:inline-flex; align-items:center; gap:4px; color:#fde047; font-weight:800; background:rgba(234,179,8,0.10); border:1px solid rgba(250,204,21,0.28); padding:3px 8px; border-radius:7px;"><img src="/play/assets/hud/gold_coin_icon.png" alt="Ouro" style="width:16px; height:16px; object-fit:contain;" /> +${Number(r.gold).toLocaleString('pt-BR')} Ouro</span>`
        );
      }

      const previewItems = Array.isArray(r.rewardItemsPreview) && r.rewardItemsPreview.length > 0
        ? r.rewardItemsPreview
        : (r.rewardItemTemplateId && r.rewardItemNamePtBr
            ? [{
                itemTemplateId: r.rewardItemTemplateId,
                namePtBr: r.rewardItemNamePtBr,
                iconUrl: r.rewardItemIconUrl || '/api/assets/mcrework/assets/items/icons/item_normal_060009.png',
                rarityTier: 'COMMON',
                quantity: Number(r.rewardItemQuantity || 1),
              }]
            : []);

      for (const it of previewItems) {
        const borderCol = this.getRewardRarityBorder(it.rarityTier);
        const qtyTxt = Number(it.quantity || 1).toLocaleString('pt-BR');
        pills.push(`
          <span title="${it.namePtBr}" style="display:inline-flex; align-items:center; gap:6px; color:#f1f5f9; font-weight:700; background:rgba(15,23,42,0.92); border:1.5px solid ${borderCol}; padding:3px 8px 3px 4px; border-radius:8px;">
            <span style="position:relative; width:26px; height:26px; display:inline-flex; align-items:center; justify-content:center; background:#020617; border-radius:6px; border:1px solid ${borderCol}; flex-shrink:0;">
              <img src="${it.iconUrl}" alt="${it.namePtBr}" style="width:22px; height:22px; object-fit:contain;" onerror="this.onerror=null; this.src='/play/assets/hud/menu_inventory.png';" />
              <span style="position:absolute; right:-3px; bottom:-3px; background:#020617; color:#fde047; font-size:0.56rem; font-weight:900; padding:0 3px; border-radius:4px; border:1px solid #334155; font-family:monospace;">${qtyTxt}</span>
            </span>
            <span style="font-size:0.74rem; line-height:1.15;">${it.namePtBr}</span>
          </span>
        `);
      }

      if (r.freePointsBonus > 0) {
        pills.push(
          `<span style="display:inline-flex; align-items:center; gap:4px; color:#38bdf8; font-weight:800; background:rgba(56,189,248,0.10); border:1px solid rgba(56,189,248,0.28); padding:3px 8px; border-radius:7px;">★ +${Number(r.freePointsBonus).toLocaleString('pt-BR')} Pts Atributo</span>`
        );
      }
      if (r.triggerReborn) {
        pills.push(
          `<span style="display:inline-flex; align-items:center; gap:4px; color:#c084fc; font-weight:800; background:rgba(168,85,247,0.12); border:1px solid rgba(192,132,252,0.35); padding:3px 8px; border-radius:7px;">👑 Despertar Reborn</span>`
        );
      }
      if (!pills.length) {
        return `<span style="color:#64748b; font-size:0.75rem;">Sem recompensas extras</span>`;
      }
      return `<div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center; font-size:0.76rem; background:#020617; padding:7px 9px; border-radius:8px; border:1px solid #1e293b;">${pills.join('')}</div>`;
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

      // 0. Etapas Ativas de Checklist Sequencial neste NPC (Fala e Botão Customizados)
      if (window.PlayQuestStepModal) {
        cards.push(...window.PlayQuestStepModal.renderActiveNpcStepCards(this, npc));
      }

      const fmtTxt = (s) => (window.PlayQuestStepModal ? window.PlayQuestStepModal.formatDialogueHtml(s) : String(s || ''));

      // 1. Missões Prontas para Entregar (? Vermelho)
      for (const q of turnInQuests) {
        const turnBtnText = q.metaStageInfo && q.metaStageInfo.currentStage < q.metaStageInfo.totalStages
          ? `🏆 Concluir Estágio ${q.metaStageInfo.currentStage}/${q.metaStageInfo.totalStages} & Avançar`
          : (q.turnInButtonLabelPtBr || '🏆 Concluir Missão & Receber Recompensa');
        cards.push(`
          <div style="background:rgba(239, 68, 68, 0.10); border:1.5px solid #ef4444; border-radius:10px; padding:12px; display:flex; flex-direction:column; gap:8px;">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
              <div style="display:flex; align-items:center; gap:6px;">
                <span style="background:#ef4444; color:#fff; font-weight:900; width:22px; height:22px; display:inline-flex; align-items:center; justify-content:center; border-radius:99px; font-size:0.85rem;">?</span>
                <strong style="color:#fecdd3; font-size:0.92rem;">${q.titlePtBr}</strong>
              </div>
              ${this.getQuestCategoryBadge(q.category, q.chapterOrder, q.episodeOrder, q.metaStageInfo)}
            </div>
            <p style="font-size:0.82rem; color:#f8fafc; font-style:italic; background:#020617; padding:8px 10px; border-radius:6px; border-left:3px solid #ef4444; line-height:1.45;">
              "${fmtTxt(q.dialogueCompletePtBr || q.descriptionPtBr)}"
            </p>
            <div style="display:flex; flex-direction:column; gap:4px;">
              ${this.renderObjectivesListHtml(q.objectives)}
            </div>
            <div>
              <div style="font-size:0.72rem; color:#94a3b8; margin-bottom:4px;">🎁 Recompensas da Missão:</div>
              ${this.renderRewardsSummaryHtml(q.rewards)}
            </div>
            ${q.metaStageInfo?.nextStageRequiredCount ? `<div style="font-size:0.72rem; color:#fdba74; background:rgba(249,115,22,0.12); padding:5px 8px; border-radius:6px;">⏩ Ao entregar, avança para o <strong>Estágio ${q.metaStageInfo.currentStage + 1}/${q.metaStageInfo.totalStages}</strong> (Meta: ${Number(q.metaStageInfo.nextStageRequiredCount).toLocaleString('pt-BR')})</div>` : ''}
            <button class="btn-primary" style="background:linear-gradient(135deg, #ef4444, #dc2626); border-color:#f87171; color:#fff; padding:10px; font-size:0.86rem; font-weight:800; cursor:pointer;" onclick="PlayApp.turnInCharacterQuest(${q.id})">
              ${turnBtnText}
            </button>
          </div>
        `);
      }

      // 2. Missões Disponíveis para Aceitar (! Vermelho)
      for (const q of availableQuests) {
        const acceptBtnText = q.acceptButtonLabelPtBr || '✅ Aceitar Missão';
        cards.push(`
          <div style="background:rgba(239, 68, 68, 0.07); border:1.5px solid #f43f5e; border-radius:10px; padding:12px; display:flex; flex-direction:column; gap:8px;">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
              <div style="display:flex; align-items:center; gap:6px;">
                <span style="background:#ff2e4c; color:#fff; font-weight:900; width:22px; height:22px; display:inline-flex; align-items:center; justify-content:center; border-radius:99px; font-size:0.85rem;">!</span>
                <strong style="color:#fde047; font-size:0.92rem;">${q.titlePtBr}</strong>
              </div>
              ${this.getQuestCategoryBadge(q.category, q.chapterOrder, q.episodeOrder, q.metaStageInfo)}
            </div>
            <p style="font-size:0.82rem; color:#e2e8f0; font-style:italic; background:#020617; padding:8px 10px; border-radius:6px; border-left:3px solid #ff2e4c; line-height:1.45;">
              "${fmtTxt(q.dialogueOfferPtBr || q.descriptionPtBr)}"
            </p>
            <div style="font-size:0.76rem; color:#94a3b8;">${q.descriptionPtBr}</div>
            <div style="display:flex; flex-direction:column; gap:4px;">
              <span style="font-size:0.72rem; color:#94a3b8; font-weight:700;">🎯 Checklist / Objetivos:</span>
              ${this.renderObjectivesListHtml(q.objectives)}
            </div>
            <div>
              <div style="font-size:0.72rem; color:#94a3b8; margin-bottom:4px;">🎁 Recompensas ao concluir:</div>
              ${this.renderRewardsSummaryHtml(q.rewards)}
            </div>
            <button class="btn-success" style="padding:10px; font-size:0.86rem; font-weight:800; cursor:pointer;" onclick="PlayApp.acceptCharacterQuest(${q.id})">
              ${acceptBtnText}
            </button>
          </div>
        `);
      }

      // 3. Missões em Andamento (? Cinza)
      for (const q of inProgressQuests) {
        const hasBattleObjective =
          !q.sequentialObjectives &&
          (Boolean(q.questBattleConfig?.enabled) ||
            (q.objectives || []).some(
              (o) => ['WIN_BATTLES', 'KILL_MONSTER', 'KILL_LEADER', 'KILL_BOSS'].includes(o.type) && !o.completed
            ));
        const battleBtnLabel = q.questBattleConfig?.buttonLabelPtBr || '⚔️ Entrar no Véu (Iniciar Treino / Combate)';
        const battleBtnHtml = hasBattleObjective
          ? `
            <button class="btn-primary" style="background:linear-gradient(135deg, #7c3aed, #4f46e5); border:1.5px solid #a78bfa; color:#fff; font-weight:800; padding:10px 14px; font-size:0.86rem; border-radius:8px; display:flex; align-items:center; justify-content:center; gap:8px; cursor:pointer;" onclick="window.PlayApp.startQuestBattle(${q.id})">
              ${battleBtnLabel}
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

      const roles = Array.isArray(npc.rolesJson) ? npc.rolesJson : [];
      let roleBannersHtml = '';
      if (roles.includes('HUNTER')) {
        roleBannersHtml += `
          <div style="background:linear-gradient(135deg, rgba(217,119,6,0.22), rgba(180,83,9,0.12)); border:1.5px solid #f59e0b; border-radius:10px; padding:12px; display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:10px; flex-wrap:wrap;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:1.6rem;">🐾</span>
              <div>
                <strong style="font-size:0.92rem; color:#fde047;">Santuário do Caçador (Criação de Pets)</strong>
                <div style="font-size:0.75rem; color:#cbd5e1;">Canalize essências dos monstros derrotados para criar novos companheiros.</div>
              </div>
            </div>
            <button type="button" class="btn-primary" style="background:linear-gradient(135deg, #d97706, #b45309); border:1.5px solid #fbbf24; color:#fff; font-weight:800; padding:8px 16px; font-size:0.86rem; border-radius:8px; cursor:pointer;" onclick="if (typeof PlayApp.openHunterPetModal === 'function') PlayApp.openHunterPetModal(PlayApp.activeNpcInteraction);">
              🐾 Criar Novo Pet
            </button>
          </div>
        `;
      }

      if (!cards.length) {
        bodyEl.innerHTML = roleBannersHtml + `
          <div style="background:#020617; border:1px solid #1e293b; border-radius:10px; padding:14px; text-align:center; color:#94a3b8; font-size:0.84rem;">
            💬 <strong>${npc.namePtBr}:</strong> "Saudações, <strong>${this.activeChar.name}</strong>! Que os ventos de <strong>${this.currentMap?.namePtBr || 'Etheria'}</strong> guiem sua jornada."
            <div style="margin-top:8px; font-size:0.75rem; color:#64748b;">
              (Nenhuma missão pendente com este NPC neste mapa no momento)
            </div>
          </div>
        `;
      } else {
        bodyEl.innerHTML = roleBannersHtml + cards.join('');
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
          window.PlayQuestStepModal?.updateQuestChecklistHud(this);
        }
        const acceptedQ = (this.questState?.quests || []).find((q) => Number(q.id) === Number(questId));
        if (acceptedQ?.sequentialObjectives) {
          const modal = document.getElementById('npcQuestModal');
          if (modal) modal.style.display = 'none';
          this.showNotification?.(`📜 Missão iniciada: ${acceptedQ.titlePtBr}! Abra Quests no menu inferior para acompanhar o checklist.`, 'success');
        } else {
          this.renderNpcQuestModalContent();
        }
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
          window.PlayQuestStepModal?.updateQuestChecklistHud(this);
        }
        if (res?.character) {
          this.activeChar.level = res.character.level;
          this.activeChar.exp = res.character.exp;
          this.activeChar.experience = res.character.exp;
          this.activeChar.gold = res.character.gold;
          this.activeChar.freePoints = res.character.freePoints;
          this.activeChar.unspentStatPoints = res.character.unspentStatPoints ?? res.character.freePoints;
          if (res.character.maxXp) this.activeChar.maxXp = res.character.maxXp;

          if (res.character.playerProgression?.leveledUp) {
            const p = res.character.playerProgression;
            this.showNotification?.(`🎉 LEVEL UP! Nível ${p.newLevel}! (+${p.statPointsGained} Pontos de Atributos)`, 'success');
            if (window.LevelUpVfxController?.trigger) {
              window.LevelUpVfxController.trigger(this, p.newLevel, p.statPointsGained);
            }
          }

          if (Array.isArray(res.character.petsProgression)) {
            for (const petProg of res.character.petsProgression) {
              const matchedPet = (this.activeChar?.equippedPets || []).find((p) => p.id === petProg.petId);
              if (matchedPet) { matchedPet.level = petProg.newLevel; matchedPet.experience = petProg.newExp; }
              if (petProg.leveledUp) {
                this.showNotification?.(`🐾 Pet ${petProg.nickname} subiu para Nível ${petProg.newLevel}!`, 'info');
              }
            }
            if (window.PlayHudController && this.activeChar?.equippedPets) window.PlayHudController.updatePets(this.activeChar.equippedPets);
          }

          if (res.character.isReborn && !this.activeChar.isReborn) {
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
      else if (!this.questLogFilter) this.questLogFilter = 'ACTIVE';
      await this.loadCharacterQuests();

      const bodyEl = document.getElementById('questLogModalBody');
      const allQuests = this.questState?.quests || [];

      const filtered = allQuests.filter((q) => {
        if (this.questLogFilter === 'META') {
          return q.category === 'META';
        }
        if (q.category === 'META') return false;
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

      if (this.questLogFilter === 'META') {
        const metaPriority = (q) => {
          if (q.status === 'READY_TO_TURN_IN') return 0;
          if (q.status === 'IN_PROGRESS') return 1;
          if (q.status === 'AVAILABLE' || q.status === 'LOCKED') return 2;
          return 3; // COMPLETED (maestria total)
        };
        const metaPct = (q) => {
          const o = (q.objectives || [])[0] || {};
          return Math.min(1, Number(o.currentCount || 0) / Math.max(1, Number(o.requiredCount || 1)));
        };
        filtered.sort((a, b) => {
          const pa = metaPriority(a);
          const pb = metaPriority(b);
          if (pa !== pb) return pa - pb;
          const pctDiff = metaPct(b) - metaPct(a);
          if (Math.abs(pctDiff) > 0.0001) return pctDiff;
          return Number(a.id || 0) - Number(b.id || 0);
        });
      }

      const metaQuestsCount = allQuests.filter((q) => q.category === 'META').length;
      const metaReadyCount = allQuests.filter((q) => q.category === 'META' && q.status === 'READY_TO_TURN_IN').length;
      const activeNonMetaCount = allQuests.filter((q) => q.category !== 'META' && (q.status === 'IN_PROGRESS' || q.status === 'READY_TO_TURN_IN')).length;

      const tabsHtml = `
        <div class="quest-log-tabs">
          <button class="quest-log-tab-btn ${this.questLogFilter === 'ACTIVE' ? 'is-active' : ''}" onclick="PlayApp.openQuestLogModal('ACTIVE')">
            ⏳ Em Andamento (${activeNonMetaCount})
          </button>
          <button class="quest-log-tab-btn is-meta ${this.questLogFilter === 'META' ? 'is-active' : ''}" onclick="PlayApp.openQuestLogModal('META')">
            🎯 Metas de Caça (${metaQuestsCount}) ${metaReadyCount > 0 ? `<span class="quest-tab-ready-pill">★ ${metaReadyCount}</span>` : ''}
          </button>
          <button class="quest-log-tab-btn ${this.questLogFilter === 'AVAILABLE' ? 'is-active' : ''}" onclick="PlayApp.openQuestLogModal('AVAILABLE')">
            ❗ Disponíveis (${allQuests.filter((q) => q.category !== 'META' && q.status === 'AVAILABLE').length})
          </button>
          <button class="quest-log-tab-btn ${this.questLogFilter === 'LOCKED' ? 'is-active' : ''}" onclick="PlayApp.openQuestLogModal('LOCKED')">
            🔒 Próximos (${allQuests.filter((q) => q.category !== 'META' && q.status === 'LOCKED').length})
          </button>
          <button class="quest-log-tab-btn ${this.questLogFilter === 'COMPLETED' ? 'is-active' : ''}" onclick="PlayApp.openQuestLogModal('COMPLETED')">
            ✅ Concluídas (${allQuests.filter((q) => q.category !== 'META' && q.status === 'COMPLETED').length})
          </button>
        </div>
      `;

      const metaToolbarHtml =
        this.questLogFilter === 'META'
          ? `
            <div class="quest-meta-toolbar ${metaReadyCount > 0 ? 'has-ready' : ''}">
              <div style="display:flex; flex-direction:column; gap:2px;">
                <strong style="font-size:0.80rem; color:${metaReadyCount > 0 ? '#86efac' : '#cbd5e1'};">
                  ${metaReadyCount > 0 ? `🎁 ${metaReadyCount} Meta(s) concluída(s) no topo!` : '🎯 Metas de Caça'}
                </strong>
                <span style="font-size:0.70rem; color:#94a3b8;">
                  ${metaReadyCount > 0 ? 'Recolha todas as recompensas de uma só vez.' : 'Conclua metas para resgatar recompensas aqui.'}
                </span>
              </div>
              <button type="button" id="btnClaimAllMetaQuests" class="quest-claim-all-btn" ${metaReadyCount === 0 ? 'disabled' : ''} onclick="PlayApp.claimAllMetaQuests()">
                🎁 Recolher Tudo${metaReadyCount > 0 ? ` (${metaReadyCount})` : ''}
              </button>
            </div>
          `
          : '';

      const listHtml = filtered.length
        ? filtered
            .map((q) => {
              const isMeta = q.category === 'META';
              const statusBadge =
                q.status === 'READY_TO_TURN_IN'
                  ? `<span style="background:#22c55e; color:#020617; padding:2px 8px; border-radius:99px; font-size:0.7rem; font-weight:800; box-shadow:0 0 8px rgba(34,197,94,0.5);">🎁 Concluída (Recolher)</span>`
                  : q.status === 'IN_PROGRESS'
                  ? `<span style="background:#475569; color:#f8fafc; padding:2px 8px; border-radius:99px; font-size:0.7rem; font-weight:700;">⏳ Em Andamento</span>`
                  : q.status === 'AVAILABLE'
                  ? `<span style="background:#ff2e4c; color:#fff; padding:2px 8px; border-radius:99px; font-size:0.7rem; font-weight:700;">! Disponível</span>`
                  : q.status === 'LOCKED'
                  ? `<span style="background:#1e293b; color:#fde047; border:1px solid #eab308; padding:2px 8px; border-radius:99px; font-size:0.7rem; font-weight:700;">🔒 Bloqueada</span>`
                  : `<span style="background:rgba(34,197,94,0.2); color:#4ade80; padding:2px 8px; border-radius:99px; font-size:0.7rem; font-weight:700;">✅ Concluída</span>`;

              const mapHint = q.giverMapNamePtBr
                ? `📍 ${q.giverMapNamePtBr}`
                : `🌍 Qualquer mapa onde ${q.giverNpcNamePtBr} estiver`;

              // Renderização Especial para Quests Meta Procedurais
              if (isMeta) {
                const curStage = q.metaStageInfo?.currentStage || 1;
                const totStages = q.metaStageInfo?.totalStages || 5;
                const obj = (q.objectives || [])[0] || {};
                const curKills = Number(obj.currentCount || 0);
                const reqKills = Number(obj.requiredCount || 10);
                const pct = Math.min(100, Math.max(0, Math.round((curKills / Math.max(1, reqKills)) * 100)));

                return `
                  <div style="background:#0b1329; border:1.5px solid ${q.status === 'READY_TO_TURN_IN' ? '#22c55e' : '#1e3a5f'}; border-radius:10px; padding:12px; display:flex; flex-direction:column; gap:8px; box-shadow:0 4px 14px rgba(0,0,0,0.4);">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:6px; flex-wrap:wrap;">
                      <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-size:1.3rem;">🎯</span>
                        <div>
                          <strong style="color:#fde047; font-size:0.92rem;">${q.titlePtBr}</strong>
                          <div style="font-size:0.68rem; color:#38bdf8; font-weight:700;">Estágio ${curStage} de ${totStages} &bull; Meta: ${reqKills.toLocaleString('pt-BR')} abates</div>
                        </div>
                      </div>
                      ${statusBadge}
                    </div>

                    <div style="font-size:0.74rem; color:#cbd5e1; line-height:1.4;">${q.descriptionPtBr}</div>

                    <!-- Barra de Progresso de Abates -->
                    <div style="background:#070d1c; border:1px solid #1e293b; border-radius:8px; padding:8px 10px; display:flex; flex-direction:column; gap:4px;">
                      <div style="display:flex; justify-content:space-between; font-size:0.72rem; font-weight:800;">
                        <span style="color:#94a3b8;">Progresso Acumulado:</span>
                        <span style="color:${pct >= 100 ? '#4ade80' : '#38bdf8'}; font-family:monospace;">${curKills.toLocaleString('pt-BR')} / ${reqKills.toLocaleString('pt-BR')} (${pct}%)</span>
                      </div>
                      <div style="background:#1e293b; border-radius:99px; height:8px; overflow:hidden;">
                        <div style="background:linear-gradient(90deg, #0284c7 0%, #22c55e 100%); width:${pct}%; height:100%; transition:width 0.3s ease;"></div>
                      </div>
                    </div>

                    <!-- Resumo das Recompensas do Estágio Atual -->
                    <div style="background:rgba(15,23,42,0.8); border:1px solid rgba(255,255,255,0.06); border-radius:8px; padding:6px 10px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:6px;">
                      <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; font-size:0.72rem; font-weight:800;">
                        <span style="color:#fde047; display:inline-flex; align-items:center; gap:3px;">
                          <img src="/play/assets/hud/gold_coin_icon.png" style="width:15px; height:15px; object-fit:contain;" alt="Ouro" />
                          +${(q.rewards?.gold || 0).toLocaleString('pt-BR')} Ouro
                        </span>
                        <span style="color:#38bdf8;">⚡ +${(q.rewards?.exp || 0).toLocaleString('pt-BR')} XP</span>
                        ${
                          Array.isArray(q.rewards?.rewardItemsPreview) && q.rewards.rewardItemsPreview.length > 0
                            ? q.rewards.rewardItemsPreview
                                .map((it) => `
                                  <span style="color:#f472b6; display:inline-flex; align-items:center; gap:4px; background:rgba(2,6,23,0.75); border:1px solid ${this.getRewardRarityBorder(it.rarityTier)}; border-radius:6px; padding:2px 6px 2px 3px;">
                                    <img src="${it.iconUrl}" style="width:18px; height:18px; object-fit:contain;" alt="${it.namePtBr}" onerror="this.onerror=null; this.src='/play/assets/hud/menu_inventory.png';" />
                                    ${Number(it.quantity || 1).toLocaleString('pt-BR')}x ${it.namePtBr}
                                  </span>
                                `)
                                .join('')
                            : `<span style="color:#f472b6; display:inline-flex; align-items:center; gap:3px;">
                                <img src="/play/assets/hud/item_hunter_medal.png" style="width:16px; height:16px; object-fit:contain;" alt="Medalha" />
                                1x Medalha de Caçador
                              </span>`
                        }
                      </div>

                      ${
                        q.status === 'READY_TO_TURN_IN'
                          ? `<button class="btn-primary" style="background:linear-gradient(135deg, #16a34a, #15803d); border:1.5px solid #4ade80; color:#fff; font-weight:900; padding:6px 14px; font-size:0.80rem; border-radius:6px; cursor:pointer; box-shadow:0 0 10px rgba(34,197,94,0.4);" onclick="PlayApp.claimMetaQuest(${q.id})">
                              🎁 Resgatar Recompensa
                            </button>`
                          : q.status === 'COMPLETED'
                          ? `<span style="color:#4ade80; font-weight:800; font-size:0.76rem;">👑 Maestria Completa!</span>`
                          : `<span style="color:#64748b; font-size:0.72rem;">Em Progresso...</span>`
                      }
                    </div>
                  </div>
                `;
              }

              const useSequentialChecklist =
                Boolean(q.sequentialObjectives) && window.PlayQuestStepModal?.renderQuestLogChecklistHtml;

              if (useSequentialChecklist) {
                return `
                  <div class="quest-checklist-card">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:6px; flex-wrap:wrap;">
                      <strong style="color:#fde047; font-size:0.92rem;">📜 ${q.titlePtBr}</strong>
                      <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
                        ${this.getQuestCategoryBadge(q.category, q.chapterOrder, q.episodeOrder, q.metaStageInfo)}
                        ${statusBadge}
                      </div>
                    </div>
                    <div style="font-size:0.75rem; color:#94a3b8; line-height:1.4;">${q.descriptionPtBr}</div>
                    <div style="font-size:0.72rem; color:#38bdf8;">
                      🧙 Comandante: <strong>${q.giverNpcNamePtBr}</strong> • ${mapHint}
                    </div>
                    ${window.PlayQuestStepModal.renderQuestLogChecklistHtml(q)}
                    <div>
                      <div style="font-size:0.70rem; color:#94a3b8; margin-bottom:4px;">🎁 Recompensas finais ao concluir:</div>
                      ${this.renderRewardsSummaryHtml(q.rewards)}
                    </div>
                  </div>
                `;
              }

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
                    (Boolean(q.questBattleConfig?.enabled) ||
                      (q.objectives || []).some(
                        (o) => ['WIN_BATTLES', 'KILL_MONSTER', 'KILL_LEADER', 'KILL_BOSS'].includes(o.type) && !o.completed
                      ))
                      ? `<button class="btn-primary" style="background:linear-gradient(135deg, #7c3aed, #4f46e5); border:1.5px solid #a78bfa; color:#fff; font-weight:800; padding:8px 12px; font-size:0.82rem; border-radius:8px; display:flex; align-items:center; justify-content:center; gap:8px; cursor:pointer; margin-top:4px;" onclick="window.PlayApp.startQuestBattle(${q.id})">
                          ${q.questBattleConfig?.buttonLabelPtBr || '⚔️ Entrar no Véu (Iniciar Treino / Combate)'}
                        </button>`
                      : ''
                  }
                </div>
              `;
            })
            .join('')
        : `<div style="padding:18px; text-align:center; color:#64748b; font-size:0.82rem;">Nenhuma missão nesta aba.</div>`;

      bodyEl.innerHTML = `${tabsHtml}${metaToolbarHtml}<div style="display:flex; flex-direction:column; gap:8px; margin-top:4px;">${listHtml}</div>`;
      document.getElementById('questLogModal').style.display = 'flex';
    };

    /**
     * Resgata instantaneamente a recompensa de uma Quest Meta sem necessidade de NPC.
     */
    client.claimMetaQuest = async function (questId) {
      if (!this.activeChar) return;
      try {
        const result = await this.api(`/api/play/characters/${this.activeChar.id}/quests/${questId}/claim-meta`, {
          method: 'POST',
          body: JSON.stringify({ mapId: null }),
        });
        if (result?.questState) {
          this.questState = result.questState;
          this.updateQuestHudBadge();
        }
        if (result && result.character) {
          window.PlayQuestStepModal?.applyCharacterProgressionUpdate(this, result.character);
          if (typeof this.renderStatsModalView === 'function') this.renderStatsModalView();
          if (window.PlayHudController && typeof window.PlayHudController.updatePlayerVitals === 'function') {
            window.PlayHudController.updatePlayerVitals();
          }
        }
        this.showNotification?.('🎉 Meta de Caça Resgatada! Recompensas entregues!', 'success');
        await this.openQuestLogModal('META');
      } catch (err) {
        alert(`Erro ao resgatar meta de caça: ${err.message}`);
      }
    };

    /**
     * Recolhe em lote TODAS as Quests Meta concluídas de uma só vez.
     */
    client.claimAllMetaQuests = async function () {
      if (!this.activeChar) return;
      const btn = document.getElementById('btnClaimAllMetaQuests');
      if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ Recolhendo...';
      }
      try {
        const result = await this.api(`/api/play/characters/${this.activeChar.id}/quests/claim-all-meta`, {
          method: 'POST',
          body: JSON.stringify({ mapId: this.currentMap?.id || null }),
        });
        if (result?.questState) {
          this.questState = result.questState;
          this.updateQuestHudBadge();
        }
        if (result?.character) {
          window.PlayQuestStepModal?.applyCharacterProgressionUpdate(this, result.character);
          if (typeof this.renderStatsModalView === 'function') this.renderStatsModalView();
          if (window.PlayHudController && typeof window.PlayHudController.updatePlayerVitals === 'function') {
            window.PlayHudController.updatePlayerVitals();
          }
        }
        if (result?.claimedCount > 0) {
          const xpStr = result.totalExp > 0 ? ` +${Number(result.totalExp).toLocaleString('pt-BR')} XP` : '';
          const goldStr = result.totalGold > 0 ? ` • +${Number(result.totalGold).toLocaleString('pt-BR')} Ouro` : '';
          this.showNotification?.(
            `🎉 ${result.claimedCount} Meta(s) recolhida(s)!${xpStr}${goldStr}`,
            'success'
          );
          if (typeof this.loadCharacterInventory === 'function') {
            await this.loadCharacterInventory().catch(() => {});
          }
        } else {
          this.showNotification?.('Nenhuma Meta de Caça concluída para recolher no momento.', 'info');
        }
        if (result?.stoppedReason) {
          this.showNotification?.(`⚠️ ${result.stoppedReason}`, 'warning');
        }
        await this.openQuestLogModal('META');
      } catch (err) {
        alert(`Erro ao recolher metas concluídas: ${err.message}`);
        await this.openQuestLogModal('META');
      }
    };

    /**
     * Inicia a Batalha no Véu associada a uma Missão (Treino ou Caça de Anomalias).
     */
    client.startQuestBattle = async function (questId) {
      if (!this.activeChar) return;
      if (window.PlayFlightAndWingsController && !window.PlayFlightAndWingsController.assertGroundedForCombat(this, 'iniciar uma luta')) {
        return;
      }
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
        if (String(err?.message || '').includes('no chão')) this.showNotification?.(`🦅 ${err.message}`, 'warning');
        else alert(`Erro ao iniciar batalha no Véu: ${err.message}`);
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
