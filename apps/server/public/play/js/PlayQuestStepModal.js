/**
 * @file apps/server/public/play/js/PlayQuestStepModal.js
 * @module @etheria/server
 * @description Submódulo de Checklist Sequencial, Modais Interativos por Etapa de NPC e
 *   Seletor de Companheiros Iniciais Rank F na rota `/play`.
 * @rules Segue estritamente AGENTS.md (Regra #5 Responsivo, Regra #7 < 1.000 linhas, 60+ FPS).
 */

const PlayQuestStepModal = {
  _pickerState: {
    questId: null,
    stepIndex: 0,
    pickCount: 2,
    rankCode: 'F',
    candidates: [],
    selectedIds: [],
  },
  _checklistCollapsed: false,

  attach(client) {
    this.injectDomAndStyles();

    client.confirmQuestStep = async function (questId, stepIndex, extraPayload = {}) {
      if (!this.activeChar) return;
      try {
        const res = await this.api(`/api/play/characters/${this.activeChar.id}/quests/${questId}/confirm-step`, {
          method: 'POST',
          body: JSON.stringify({
            stepIndex,
            mapId: this.currentMap?.id || null,
            ...extraPayload,
          }),
        });

        if (res?.launchBattle) {
          await this.startQuestBattle(questId);
          return;
        }

        if (res?.questState) {
          this.questState = res.questState;
          this.updateQuestHudBadge();
          PlayQuestStepModal.updateQuestChecklistHud(this);
        }

        if (res?.character) {
          PlayQuestStepModal.applyCharacterProgressionUpdate(this, res.character);
        }

        if (res?.grantedItemsCount > 0) {
          this.showNotification?.(
            `🎒 ${res.grantedItemsCount} equipamento(s) entregue(s) na mochila! Equipe todas as peças para avançar.`,
            'success'
          );
          if (typeof this.loadCharacterInventory === 'function') {
            await this.loadCharacterInventory().catch(() => {});
          }
        }

        if (res?.grantedPetsCount > 0) {
          this.showNotification?.(
            `🐾 ${res.grantedPetsCount} Companheiro(s) de Vínculo firmado(s) com sucesso!`,
            'success'
          );
          if (typeof this.loadCharacterPets === 'function') {
            await this.loadCharacterPets().catch(() => {});
          } else if (window.PlayPetsController?.loadPets) {
            await window.PlayPetsController.loadPets().catch(() => {});
          }
        }

        if (res?.stepCompleted) {
          const xpTxt = res.stepExpAwarded > 0 ? ` (+${Number(res.stepExpAwarded).toLocaleString('pt-BR')} EXP)` : '';
          this.showNotification?.(`✅ Etapa concluída!${xpTxt}`, 'success');
          const npcModal = document.getElementById('npcQuestModal');
          if (npcModal) npcModal.style.display = 'none';
        } else {
          this.renderNpcQuestModalContent();
        }
      } catch (err) {
        alert(err?.message || 'Erro ao confirmar etapa da missão.');
      }
    };

    client.openStarterPetPickerModal = async function (questId, stepIndex, rankCode = 'F', pickCount = 2) {
      if (!this.activeChar) return;
      try {
        const res = await this.api(
          `/api/play/characters/${this.activeChar.id}/quests/starter-pets?rank=${encodeURIComponent(rankCode)}`
        );
        PlayQuestStepModal._pickerState = {
          questId,
          stepIndex,
          pickCount: Math.max(1, Number(pickCount) || 2),
          rankCode: String(rankCode || 'F').toUpperCase(),
          candidates: Array.isArray(res?.candidates) ? res.candidates : [],
          selectedIds: [],
        };
        const npcModal = document.getElementById('npcQuestModal');
        if (npcModal) npcModal.style.display = 'none';
        PlayQuestStepModal.renderStarterPetPicker();
        const modal = document.getElementById('starterPetPickerModal');
        if (modal) modal.style.display = 'flex';
      } catch (err) {
        alert(`Erro ao carregar companheiros Rank ${rankCode}: ${err.message}`);
      }
    };

    client.toggleStarterPetSelection = function (monsterId) {
      const st = PlayQuestStepModal._pickerState;
      const id = Number(monsterId);
      const pos = st.selectedIds.indexOf(id);
      if (pos >= 0) {
        st.selectedIds.splice(pos, 1);
      } else {
        if (st.selectedIds.length >= st.pickCount) {
          this.showNotification?.(`Você deve escolher exatamente ${st.pickCount} companheiros diferentes!`, 'warning');
          return;
        }
        st.selectedIds.push(id);
      }
      PlayQuestStepModal.renderStarterPetPicker();
    };

    client.confirmStarterPetPicker = async function () {
      const st = PlayQuestStepModal._pickerState;
      if (st.selectedIds.length !== st.pickCount) {
        alert(`Selecione exatamente ${st.pickCount} companheiros diferentes antes de confirmar.`);
        return;
      }
      const modal = document.getElementById('starterPetPickerModal');
      if (modal) modal.style.display = 'none';
      await this.confirmQuestStep(st.questId, st.stepIndex, {
        selectedMonsterIds: [...st.selectedIds],
      });
    };

    client.openBagFromQuestStep = async function () {
      const npcModal = document.getElementById('npcQuestModal');
      if (npcModal) npcModal.style.display = 'none';
      const logModal = document.getElementById('questLogModal');
      if (logModal) logModal.style.display = 'none';
      if (typeof this.openBagModal === 'function') {
        await this.openBagModal();
      } else if (window.PlayHudController?.openBag) {
        window.PlayHudController.openBag();
      }
    };

    client.handleQuestEquipSyncResult = function (questSync) {
      if (!questSync) return;
      if (questSync.questState) {
        this.questState = questSync.questState;
        this.updateQuestHudBadge();
        PlayQuestStepModal.updateQuestChecklistHud(this);
      }
      if (questSync.progression?.player) {
        const p = questSync.progression.player;
        this.activeChar.level = p.newLevel ?? this.activeChar.level;
        this.activeChar.exp = p.newExp ?? this.activeChar.exp;
        this.activeChar.experience = p.newExp ?? this.activeChar.experience;
        if (p.maxXp) this.activeChar.maxXp = p.maxXp;
        this.activeChar.freePoints = p.unspentStatPoints ?? this.activeChar.freePoints;
        this.activeChar.unspentStatPoints = p.unspentStatPoints ?? this.activeChar.unspentStatPoints;
        this.updateHudInfo?.();
        if (p.leveledUp) {
          this.showNotification?.(
            `✨ LEVEL UP! Nível ${p.newLevel}! (+${p.statPointsGained} Pontos de Atributos)`,
            'success'
          );
          if (window.LevelUpVfxController?.trigger) {
            window.LevelUpVfxController.trigger(this, p.newLevel, p.statPointsGained);
          }
        }
      }
      if (questSync.stepExpAwarded > 0) {
        this.showNotification?.(
          `✅ Etapa de equipamentos concluída! (+${Number(questSync.stepExpAwarded).toLocaleString('pt-BR')} EXP)`,
          'success'
        );
      }
    };
  },

  applyCharacterProgressionUpdate(client, charData) {
    if (!client?.activeChar || !charData) return;
    client.activeChar.level = charData.level ?? client.activeChar.level;
    client.activeChar.exp = charData.exp ?? client.activeChar.exp;
    client.activeChar.experience = charData.exp ?? client.activeChar.experience;
    if (charData.maxXp) client.activeChar.maxXp = charData.maxXp;
    if (charData.gold !== undefined) client.activeChar.gold = charData.gold;
    if (charData.freePoints !== undefined) {
      client.activeChar.freePoints = charData.freePoints;
      client.activeChar.unspentStatPoints = charData.unspentStatPoints ?? charData.freePoints;
    }
    if (charData.playerProgression?.leveledUp) {
      const p = charData.playerProgression;
      client.showNotification?.(
        `✨ LEVEL UP! Nível ${p.newLevel}! (+${p.statPointsGained} Pontos de Atributos)`,
        'success'
      );
      if (window.LevelUpVfxController?.trigger) {
        window.LevelUpVfxController.trigger(client, p.newLevel, p.statPointsGained);
      }
    }
    client.updateHudInfo?.();
  },

  formatDialogueHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br/>');
  },

  /**
   * Renderiza os cards interativos quando o jogador fala com o NPC da etapa ativa de um Checklist.
   */
  renderActiveNpcStepCards(client, npc) {
    const allQuests = client.questState?.quests || [];
    const npcId = Number(npc.npcTemplateId);
    const cards = [];

    for (const q of allQuests) {
      if (q.status !== 'IN_PROGRESS') continue;
      const objectives = Array.isArray(q.objectives) ? q.objectives : [];
      const activeObj = objectives.find(
        (o) => o.isActiveStep && !o.completed && Number(o.npcTemplateId) === npcId
      );
      if (!activeObj) continue;

      const stepNum = Number(activeObj.stepIndex ?? 0) + 1;
      const totalSteps = objectives.length + 1; // inclui retorno final ao comandante
      const actType = String(activeObj.stepActionType || 'DIALOGUE').toUpperCase();
      const dialogueHtml = this.formatDialogueHtml(
        activeObj.stepDialoguePtBr || q.dialogueActivePtBr || q.descriptionPtBr
      );
      const btnLabel = activeObj.stepButtonLabelPtBr || 'Confirmar';

      let actionButtonHtml = '';
      let extraStatusHtml = '';

      if (actType === 'GRANT_AND_EQUIP' && activeObj.itemsGranted && !activeObj.completed) {
        const eqCur = Number(activeObj.equippedCount || 0);
        const eqTot = Number(activeObj.totalRequiredEquip || 1);
        extraStatusHtml = `
          <div style="background:rgba(234,179,8,0.14); border:1px solid #eab308; border-radius:8px; padding:8px 10px; font-size:0.78rem; color:#fef08a;">
            🛡️ <strong>Peças já entregues na mochila!</strong> Equipe todas as peças recebidas para concluir esta etapa:
            <strong style="font-family:monospace; color:#fde047;">${eqCur}/${eqTot} equipadas</strong>
          </div>
        `;
        actionButtonHtml = `
          <button class="btn-primary" style="background:linear-gradient(135deg, #0284c7, #0369a1); border-color:#38bdf8; color:#fff; padding:10px; font-size:0.86rem; font-weight:800; cursor:pointer;" onclick="PlayApp.openBagFromQuestStep()">
            🎒 Abrir Mochila e Equipar Peças (${eqCur}/${eqTot})
          </button>
        `;
      } else if (actType === 'CHOOSE_PETS') {
        const rank = activeObj.stepPetRank || 'F';
        const cnt = Number(activeObj.stepPetPickCount) || 2;
        actionButtonHtml = `
          <button class="btn-success" style="background:linear-gradient(135deg, #d97706, #b45309); border-color:#fbbf24; color:#fff; padding:10px; font-size:0.88rem; font-weight:800; cursor:pointer;" onclick="PlayApp.openStarterPetPickerModal(${q.id}, ${activeObj.stepIndex}, '${rank}', ${cnt})">
            🐾 ${btnLabel}
          </button>
        `;
      } else if (actType === 'QUEST_BATTLE') {
        actionButtonHtml = `
          <button class="btn-primary" style="background:linear-gradient(135deg, #7c3aed, #4f46e5); border:1.5px solid #a78bfa; color:#fff; padding:10px; font-size:0.88rem; font-weight:800; cursor:pointer;" onclick="PlayApp.startQuestBattle(${q.id})">
            ⚔️ ${btnLabel}
          </button>
        `;
      } else {
        actionButtonHtml = `
          <button class="btn-success" style="padding:10px; font-size:0.88rem; font-weight:800; cursor:pointer;" onclick="PlayApp.confirmQuestStep(${q.id}, ${activeObj.stepIndex})">
            ✅ ${btnLabel}
          </button>
        `;
      }

      cards.push(`
        <div style="background:rgba(56, 189, 248, 0.08); border:1.5px solid #38bdf8; border-radius:10px; padding:12px; display:flex; flex-direction:column; gap:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
            <strong style="color:#fde047; font-size:0.94rem;">📜 ${q.titlePtBr}</strong>
            <span style="background:rgba(56,189,248,0.2); color:#7dd3fc; border:1px solid #38bdf8; padding:2px 8px; border-radius:99px; font-size:0.7rem; font-weight:800;">
              Etapa ${stepNum}/${totalSteps}
            </span>
          </div>
          <div style="font-size:0.84rem; color:#f8fafc; line-height:1.5; background:#020617; padding:10px 12px; border-radius:8px; border-left:3px solid #38bdf8;">
            "${dialogueHtml}"
          </div>
          ${extraStatusHtml}
          ${actionButtonHtml}
        </div>
      `);
    }

    return cards;
  },

  renderStarterPetPicker() {
    const st = this._pickerState;
    const body = document.getElementById('starterPetPickerBody');
    const title = document.getElementById('starterPetPickerTitle');
    const btnConfirm = document.getElementById('btnConfirmStarterPets');
    if (!body) return;

    if (title) {
      title.textContent = `🐾 Escolha ${st.pickCount} Companheiros Diferentes (Rank ${st.rankCode}) — ${st.selectedIds.length}/${st.pickCount}`;
    }

    const raceNames = {
      BEAST: 'Selvagem', PLANT: 'Planta', AQUATIC: 'Aquático', DEMON: 'Demônio',
      HUMAN: 'Humano', FAIRY: 'Fada', CELESTIAL: 'Celestial', DRAGON: 'Dragão',
      SPIRIT: 'Espírito', ROBOTIC: 'Robótico', REPTILIAN: 'Reptiliano',
    };

    body.innerHTML = st.candidates.length
      ? `<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(135px, 1fr)); gap:8px;">
          ${st.candidates
            .map((m) => {
              const selIdx = st.selectedIds.indexOf(m.id);
              const isSel = selIdx >= 0;
              return `
                <button type="button" onclick="PlayApp.toggleStarterPetSelection(${m.id})" style="
                  display:flex; flex-direction:column; align-items:center; gap:6px; padding:10px 8px;
                  border-radius:10px; cursor:pointer; text-align:center; transition:all 0.15s ease;
                  background:${isSel ? 'rgba(234,179,8,0.22)' : 'rgba(15,23,42,0.92)'};
                  border:2px solid ${isSel ? '#fde047' : '#334155'}; position:relative;
                ">
                  ${isSel ? `<span style="position:absolute; top:5px; right:6px; background:#fde047; color:#020617; font-weight:900; font-size:0.68rem; padding:1px 6px; border-radius:99px;">#${selIdx + 1}</span>` : ''}
                  <img src="${m.thumbUrl}" alt="${m.namePtBr}" style="width:54px; height:54px; object-fit:contain; background:#020617; border-radius:8px; border:1px solid #1e293b;" onerror="this.style.opacity='0.3'" />
                  <strong style="font-size:0.78rem; color:${isSel ? '#fde047' : '#f8fafc'}; line-height:1.2;">${m.namePtBr}</strong>
                  <span style="font-size:0.67rem; color:#94a3b8;">Rank ${m.rarityTier} • ${raceNames[m.raceCode] || m.raceCode}</span>
                  <span style="font-size:0.65rem; color:#7dd3fc;">${m.combatStyle === 'RANGED' ? '🏹 Distância' : '⚔️ Corpo a Corpo'}</span>
                </button>
              `;
            })
            .join('')}
        </div>`
      : `<div style="padding:16px; text-align:center; color:#94a3b8;">Nenhum companheiro Rank ${st.rankCode} disponível no catálogo.</div>`;

    if (btnConfirm) {
      const ready = st.selectedIds.length === st.pickCount;
      btnConfirm.disabled = !ready;
      btnConfirm.style.opacity = ready ? '1' : '0.45';
      btnConfirm.textContent = ready
        ? `✨ Firmar Vínculo com os ${st.pickCount} Companheiros`
        : `Selecione ${st.pickCount - st.selectedIds.length} companheiro(s) restante(s)`;
    }
  },

  /**
   * Widget flutuante desativado por decisão do projeto: todo o status da missão e checklist
   * fica concentrado exclusivamente dentro do Modal de Quests no menu inferior.
   */
  updateQuestChecklistHud() {
    const legacyWidget = document.getElementById('questChecklistHudWidget');
    if (legacyWidget) legacyWidget.remove();
    const legacyStyles = document.getElementById('questStepChecklistStyles');
    if (legacyStyles) legacyStyles.remove();
  },

  /**
   * Renderiza o Checklist completo de etapas da Quest Principal dentro do Modal de Quests.
   */
  renderQuestLogChecklistHtml(q) {
    const objectives = Array.isArray(q?.objectives) ? q.objectives : [];
    const completedSteps = objectives.filter((o) => Boolean(o.completed)).length;
    const isTurnIn = q.status === 'READY_TO_TURN_IN';
    const isDoneAll = q.status === 'COMPLETED';
    const totalSteps = objectives.length + 1;
    const doneSteps = isDoneAll ? totalSteps : completedSteps;
    const pct = Math.min(100, Math.round((doneSteps / Math.max(1, totalSteps)) * 100));

    const rows = objectives.map((obj, idx) => {
      const done = Boolean(obj.completed);
      const isAct = Boolean(obj.isActiveStep) && !done && q.status === 'IN_PROGRESS';
      const stepStateClass = done ? 'is-done' : isAct ? 'is-active' : '';
      const marker = done ? '[X]' : isAct ? '[▶]' : '[ ]';

      let rightBadge = `<span style="font-size:0.68rem; font-family:monospace; white-space:nowrap; opacity:0.85;">${done ? 'Concluída' : isAct ? 'Atual' : `Etapa ${idx + 1}`}</span>`;
      let inlineActionHtml = '';

      if (obj.stepActionType === 'GRANT_AND_EQUIP' && !done) {
        const eqCur = Number(obj.equippedCount || 0);
        const eqTot = Number(obj.totalRequiredEquip || obj.requiredCount || 1);
        rightBadge = `<span style="font-size:0.7rem; font-family:monospace; color:${obj.itemsGranted ? '#38bdf8' : '#fde047'}; white-space:nowrap;">${eqCur}/${eqTot} equip.</span>`;
        if (isAct && obj.itemsGranted) {
          inlineActionHtml = `
            <button type="button" class="btn-primary" style="margin-top:6px; padding:6px 10px; font-size:0.74rem; width:100%;" onclick="PlayApp.openBagFromQuestStep()">
              🎒 Abrir Mochila e Equipar Peças (${eqCur}/${eqTot})
            </button>
          `;
        }
      } else if (obj.stepActionType === 'QUEST_BATTLE' && isAct && !done) {
        inlineActionHtml = `
          <button type="button" class="btn-primary" style="margin-top:6px; padding:7px 10px; font-size:0.76rem; width:100%; background:linear-gradient(135deg, #7c3aed, #4f46e5); border-color:#a78bfa; color:#fff;" onclick="PlayApp.startQuestBattle(${q.id})">
            ⚔️ ${obj.stepButtonLabelPtBr || 'Iniciar Treino no Véu'}
          </button>
        `;
      }

      return `
        <div class="quest-checklist-step ${stepStateClass}">
          <div style="display:flex; flex-direction:column; gap:2px; flex:1; min-width:0;">
            <div style="display:flex; align-items:flex-start; gap:7px;">
              <span class="quest-checklist-marker">${marker}</span>
              <span style="${done ? 'text-decoration:line-through; opacity:0.85;' : ''}">${obj.descriptionPtBr || obj.labelPtBr || obj.type}</span>
            </div>
            ${inlineActionHtml}
          </div>
          ${rightBadge}
        </div>
      `;
    });

    const turnInName = q.turnInNpcNamePtBr || q.giverNpcNamePtBr || 'Comandante';
    rows.push(`
      <div class="quest-checklist-step ${isDoneAll ? 'is-done' : isTurnIn ? 'is-active' : ''}">
        <div style="display:flex; align-items:flex-start; gap:7px;">
          <span class="quest-checklist-marker">${isDoneAll ? '[X]' : isTurnIn ? '[▶]' : '[ ]'}</span>
          <span style="${isDoneAll ? 'text-decoration:line-through; opacity:0.85;' : ''}">Retornar à ${turnInName} para concluir</span>
        </div>
        <span style="font-size:0.68rem; font-family:monospace; white-space:nowrap;">${isDoneAll ? 'Concluída' : isTurnIn ? 'Pronto!' : 'Final'}</span>
      </div>
    `);

    return `
      <div style="display:flex; flex-direction:column; gap:6px;">
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.72rem; color:#cbd5e1;">
          <span>📋 Progresso do Checklist</span>
          <strong style="font-family:monospace; color:#fde047;">${doneSteps}/${totalSteps} (${pct}%)</strong>
        </div>
        <div class="quest-checklist-progress-bar">
          <div class="quest-checklist-progress-fill" style="width:${pct}%;"></div>
        </div>
        <div style="display:flex; flex-direction:column; gap:5px; margin-top:2px;">
          ${rows.join('')}
        </div>
      </div>
    `;
  },

  injectDomAndStyles() {
    this.updateQuestChecklistHud();

    if (!document.getElementById('starterPetPickerModal')) {
      const m = document.createElement('div');
      m.id = 'starterPetPickerModal';
      m.className = 'modal-backdrop';
      m.style.zIndex = '160';
      m.innerHTML = `
        <div class="modal-box" style="width:min(95vw, 620px); max-height:90vh; display:flex; flex-direction:column; gap:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #334155; padding-bottom:8px;">
            <h3 id="starterPetPickerTitle" style="color:#fde047; font-size:0.95rem; margin:0;">🐾 Escolher Companheiros de Vínculo</h3>
            <button class="btn-danger" onclick="document.getElementById('starterPetPickerModal').style.display='none'">Fechar</button>
          </div>
          <div style="font-size:0.78rem; color:#cbd5e1;">
            Escolha <strong>2 companheiros diferentes de Rank F</strong>. Eles lutarão ao seu lado na arena e o primeiro acompanhará você no mapa!
          </div>
          <div id="starterPetPickerBody" style="overflow-y:auto; max-height:55vh; padding-right:4px;"></div>
          <button type="button" id="btnConfirmStarterPets" class="btn-success" style="padding:11px; font-size:0.88rem; font-weight:800; cursor:pointer;" onclick="PlayApp.confirmStarterPetPicker()">
            ✨ Firmar Vínculo
          </button>
        </div>
      `;
      document.body.appendChild(m);
    }
  },
};

window.PlayQuestStepModal = PlayQuestStepModal;
