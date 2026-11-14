/**
 * @file apps/server/public/admin/js/AdminQuestsModalDom.js
 * @module @etheria/server
 * @description Gerador de DOM e templates HTML para a aba de Quests e o Modal No-Code (incluindo Meta Quests Procedurais) no painel `/admin`.
 */

class AdminQuestsModalDom {
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
      questsPanel.style.cssText = 'display:none; padding:16px; max-width:1360px; margin:0 auto; width:100%; gap:16px; flex-direction:column;';
      questsPanel.innerHTML = `
        <div class="panel">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:12px;">
            <div>
              <h3 style="margin:0; color:#fde047;">📜 Arquitetura de Quests por Capítulos, Episódios & Metas Procedurais</h3>
              <p style="margin:4px 0 0; font-size:0.8rem; color:var(--text-muted);">
                As missões <strong>🟡 Principais</strong> seguem ordem linear estrita (<strong>1-1 ➔ 1-2</strong>). As <strong>🟠 Quests Meta</strong> procedem automaticamente por N estágios (<code>x10</code> ou fator configurável) com escalada própria de recompensas.
              </p>
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <button id="btnQuestView_DRAWIO" class="btn-primary" onclick="AdminApp.setQuestViewMode('DRAWIO')">🗺️ Quadro Draw.io (Capítulos)</button>
              <button id="btnQuestView_TABLE" onclick="AdminApp.setQuestViewMode('TABLE')">📋 Visão em Tabela</button>
              <button class="btn-success" onclick="AdminApp.openQuestTemplateModal(null)">➕ Nova Quest No-Code</button>
            </div>
          </div>

          <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:14px;">
            <button id="btnQuestFilter_ALL" class="btn-primary" onclick="AdminApp.setQuestCategoryFilter('ALL')" style="padding:5px 12px; font-size:0.76rem;">📋 Todas</button>
            <button id="btnQuestFilter_MAIN" onclick="AdminApp.setQuestCategoryFilter('MAIN')" style="padding:5px 12px; font-size:0.76rem;">🟡 Principal</button>
            <button id="btnQuestFilter_META" onclick="AdminApp.setQuestCategoryFilter('META')" style="padding:5px 12px; font-size:0.76rem;">🟠 Meta Procedural</button>
            <button id="btnQuestFilter_SIDE" onclick="AdminApp.setQuestCategoryFilter('SIDE')" style="padding:5px 12px; font-size:0.76rem;">🔵 Secundária</button>
            <button id="btnQuestFilter_EPIC" onclick="AdminApp.setQuestCategoryFilter('EPIC')" style="padding:5px 12px; font-size:0.76rem;">🟣 Épica</button>
            <button id="btnQuestFilter_PROFICIENCY" onclick="AdminApp.setQuestCategoryFilter('PROFICIENCY')" style="padding:5px 12px; font-size:0.76rem;">🟢 Proficiência</button>
          </div>

          <div id="questsDrawIoWrapper" style="display:flex; flex-direction:column; gap:12px; padding:16px; border-radius:12px; border:1px solid #334155; background-color:#060911; background-image:radial-gradient(#1e293b 1.25px, transparent 1.25px); background-size:20px 20px;"></div>

          <div id="questsTableWrapper" style="display:none; overflow-x:auto;">
            <table class="crud-table">
              <thead>
                <tr>
                  <th>Episódio & Código</th>
                  <th>Categoria</th>
                  <th>Título & Descrição</th>
                  <th>⚡ Gatilho & 🔒 Requisito</th>
                  <th>NPC Início (❗) & Mapa</th>
                  <th>NPC Entrega (❓) & Mapa</th>
                  <th>Objetivos / Meta</th>
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
      const metaBuilderHtml =
        typeof window.AdminMetaQuestsPanel?.getBuilderSectionHtml === 'function'
          ? window.AdminMetaQuestsPanel.getBuilderSectionHtml()
          : '';
      const questBattleBuilderHtml =
        typeof window.AdminQuestBattlePanel?.getBuilderSectionHtml === 'function'
          ? window.AdminQuestBattlePanel.getBuilderSectionHtml()
          : '';

      const modal = document.createElement('div');
      modal.id = 'questTemplateModal';
      modal.className = 'modal-backdrop';
      modal.style.display = 'none';
      modal.innerHTML = `
      <div class="modal-box" style="max-width:1040px; width:96%; max-height:92vh; display:block; overflow-y:auto; padding:16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:10px; margin-bottom:12px;">
          <div style="display:flex; align-items:center; gap:10px;">
            <h3 id="questModalTitle" style="color:#fde047; margin:0;">📜 Configurar Quest</h3>
            <span id="questLiveEpisodeBadge" style="background:#eab308; color:#020617; font-weight:900; padding:3px 10px; border-radius:6px; font-size:0.8rem;">📌 Episódio 1-1</span>
          </div>
          <div style="display:flex; gap:8px;">
            <button class="btn-success" onclick="AdminApp.saveQuestTemplate()" style="padding:6px 14px; font-weight:700;">💾 Salvar Quest</button>
            <button class="btn-danger" onclick="AdminApp.closeModal('questTemplateModal')" style="padding:6px 10px;">✕</button>
          </div>
        </div>
        <input type="hidden" id="questEditIdInput" value="" />

        <!-- BLOCO 1: CAPÍTULO, CATEGORIA E IDENTIDADE -->
        <div style="background:rgba(15,23,42,0.75); border:1.5px solid #eab308; border-radius:10px; padding:12px; margin-bottom:12px;">
          <div style="font-size:0.8rem; font-weight:700; color:#fde047; margin-bottom:6px;">
            1️⃣ Categoria, Capítulo/Episódio & Identidade da Missão
          </div>
          <div id="questLinearRuleHint" style="font-size:0.75rem; color:#fef08a; background:rgba(234,179,8,0.12); border:1px solid rgba(234,179,8,0.35); padding:6px 10px; border-radius:6px; margin-bottom:10px;"></div>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:10px;">
            <div class="field"><label>ID & Código</label><input type="text" id="questCodeInput" readonly style="color:#fde047; font-weight:700;" /></div>
            <div class="field">
              <label style="color:#fde047; font-weight:700;">Categoria da Quest</label>
              <select id="questCategorySelect" onchange="AdminApp.onQuestEpisodeOrCategoryChanged()">
                <option value="MAIN">🟡 Principal (Linear por Episódios)</option>
                <option value="META">🟠 Meta Procedural (Estágios 10 ➔ 100 ➔ 1000...)</option>
                <option value="SIDE">🔵 Secundária (Paralela)</option>
                <option value="EPIC">🟣 Épica (Marco / Reborn)</option>
                <option value="PROFICIENCY">🟢 Proficiência</option>
              </select>
            </div>
            <div class="field">
              <label style="color:#fde047; font-weight:700;">📘 Capítulo (1, 2, 3...)</label>
              <input type="number" id="questChapterOrderInput" value="1" min="1" oninput="AdminApp.onQuestEpisodeOrCategoryChanged()" />
            </div>
            <div class="field">
              <label style="color:#fde047; font-weight:700;">📌 Episódio (1, 2, 3...)</label>
              <input type="number" id="questEpisodeOrderInput" value="1" min="1" oninput="AdminApp.onQuestEpisodeOrCategoryChanged()" />
            </div>
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
            <div class="field"><label>Título da Missão (PT-BR)</label><input type="text" id="questTitleInput" placeholder="Ex: Caçada aos Polvos" /></div>
            <div class="field"><label>Descrição Resumida no Diário (PT-BR)</label><input type="text" id="questDescInput" placeholder="Resumo objetivo para o diário do jogador..." /></div>
          </div>
        </div>

        <!-- BLOCO 2: GATILHO E REQUISITOS -->
        <div style="background:rgba(15,23,42,0.75); border:1.5px solid #a855f7; border-radius:10px; padding:12px; margin-bottom:12px;">
          <div style="font-size:0.8rem; font-weight:700; color:#d8b4fe; margin-bottom:8px;">
            2️⃣ ⚡ Gatilho de Acionamento & 🔒 Requisitos para Liberar a Quest
          </div>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(210px, 1fr)); gap:10px;">
            <div class="field">
              <label style="color:#7dd3fc; font-weight:700;">⚡ Gatilho de Acionamento (Trigger)</label>
              <select id="questTriggerTypeSelect" onchange="AdminApp.onQuestTriggerTypeChanged()">
                <option value="NPC_INTERACT">💬 Interagir / Falar com o NPC de Início</option>
                <option value="AUTO_ON_PREV_QUEST">⚡ Automático ao Concluir Episódio Anterior</option>
                <option value="ENTER_MAP">🗺️ Ao Entrar em um Mapa Específico</option>
                <option value="REACH_LEVEL">⭐ Ao Atingir o Nível Mínimo</option>
                <option value="KILL_MONSTER_TRIGGER">🐉 Ao Derrotar um Monstro Específico</option>
              </select>
            </div>
            <div class="field" id="questTriggerMapField" style="display:none;">
              <label style="color:#7dd3fc;">🗺️ Mapa do Gatilho</label>
              <select id="questTriggerMapSelect"></select>
            </div>
            <div class="field" id="questTriggerMonsterField" style="display:none;">
              <label style="color:#7dd3fc;">🐉 Monstro do Gatilho</label>
              <select id="questTriggerMonsterSelect"></select>
            </div>
            <div class="field">
              <label>Auto-Aceitar quando o Gatilho Disparar?</label>
              <select id="questAutoAcceptSelect">
                <option value="false">Não (Exibe ! Vermelho para o jogador aceitar)</option>
                <option value="true">⚡ Sim (Inicia automaticamente no Diário)</option>
              </select>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(165px, 1fr)); gap:10px; margin-top:10px; padding-top:10px; border-top:1px dashed #334155;">
            <div class="field"><label style="color:#fde047; font-weight:700;">🔒 Nível Mínimo</label><input type="number" id="questMinLevelInput" value="1" min="1" /></div>
            <div class="field"><label style="color:#fde047; font-weight:700;">🔗 Quest Pré-Requisito</label><select id="questPrereqSelect"></select></div>
            <div class="field"><label style="color:#fde047;">📘 Exigir Capítulo Completo?</label><input type="number" id="questReqChapterCompletedInput" placeholder="Ex: 1 (Opcional)" min="1" /></div>
            <div class="field"><label>🦸 Classe</label><select id="questReqClassSelect"></select></div>
            <div class="field">
              <label>🔥 Elemento</label>
              <select id="questReqElementSelect">
                <option value="">🔓 Todos</option><option value="FIRE">🔥 Fogo</option><option value="WATER">💧 Água</option>
                <option value="EARTH">🪨 Terra</option><option value="AIR">🌪️ Ar</option><option value="NEUTRAL">⚪ Neutro</option>
              </select>
            </div>
            <div class="field">
              <label>✨ Exigir Reborn?</label>
              <select id="questReqRebornSelect"><option value="false">🔓 Não</option><option value="true">👑 Sim (Reborn)</option></select>
            </div>
          </div>
        </div>

        <!-- BLOCO 3: VÍNCULO DE NPCS E MAPAS -->
        <div style="background:rgba(15,23,42,0.75); border:1.5px solid #f43f5e; border-radius:10px; padding:12px; margin-bottom:12px;">
          <div style="font-size:0.8rem; font-weight:700; color:#fde047; margin-bottom:8px;">
            3️⃣ 🧙 Vínculo de NPCs & Seleção de Mapa (Comunicação com NPC para pegar/entregar metas ou etapas)
          </div>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:12px;">
            <div style="background:#020617; padding:10px; border-radius:8px; border:1px solid #f43f5e;">
              <label style="font-size:0.76rem; color:#f87171; font-weight:800; display:block; margin-bottom:6px;">❗ NPC que OFERECE (! Vermelho)</label>
              <select id="questGiverNpcSelect" onchange="AdminApp.onQuestGiverNpcChanged()" style="width:100%; margin-bottom:8px;"></select>
              <label style="font-size:0.72rem; color:#86efac; font-weight:700; display:block; margin-bottom:4px;">🗺️ Mapa de Início</label>
              <select id="questGiverMapSelect" style="width:100%;"></select>
            </div>
            <div style="background:#020617; padding:10px; border-radius:8px; border:1px solid #eab308;">
              <label style="font-size:0.76rem; color:#fde047; font-weight:800; display:block; margin-bottom:6px;">❓ NPC que RECEBE / AVANÇA ESTÁGIOS (? Vermelho)</label>
              <select id="questTurnInNpcSelect" onchange="AdminApp.onQuestTurnInNpcChanged()" style="width:100%; margin-bottom:8px;"></select>
              <label style="font-size:0.72rem; color:#7dd3fc; font-weight:700; display:block; margin-bottom:4px;">🗺️ Mapa de Conclusão / Entrega</label>
              <select id="questTurnInMapSelect" style="width:100%;"></select>
            </div>
          </div>
        </div>

        ${metaBuilderHtml}

        <!-- BLOCO 4: OBJETIVOS VISUAIS NO-CODE (Quests Normais) -->
        <div id="questNormalObjectivesSection" style="background:rgba(15,23,42,0.75); border:1.5px solid #38bdf8; border-radius:10px; padding:12px; margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
            <span style="font-size:0.8rem; font-weight:700; color:#fde047;">4️⃣ 🎯 Blocos Visuais de Objetivos da Missão</span>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
              <button type="button" onclick="AdminApp.addVisualQuestObjective('KILL_MONSTER')" style="padding:4px 9px; font-size:0.74rem; background:#9f1239; color:#fff;">➕ 🐉 Matar Monstro</button>
              <button type="button" onclick="AdminApp.addVisualQuestObjective('KILL_LEADER')" style="padding:4px 9px; font-size:0.74rem; background:#0284c7; color:#fff; border:1px solid #38bdf8;">➕ 👑 Matar Líder</button>
              <button type="button" onclick="AdminApp.addVisualQuestObjective('KILL_BOSS')" style="padding:4px 9px; font-size:0.74rem; background:#be123c; color:#fff; border:1px solid #fb7185;">➕ 💀 Matar Boss</button>
              <button type="button" onclick="AdminApp.addVisualQuestObjective('KILL_RACE')" style="padding:4px 9px; font-size:0.74rem; background:#b45309; color:#fff;">➕ 🐾 Matar Raça</button>
              <button type="button" onclick="AdminApp.addVisualQuestObjective('COLLECT_ITEM')" style="padding:4px 9px; font-size:0.74rem; background:#0f766e; color:#fff;">➕ 📦 Coletar Item</button>
              <button type="button" onclick="AdminApp.addVisualQuestObjective('TALK_NPC')" style="padding:4px 9px; font-size:0.74rem; background:#0369a1; color:#fff;">➕ 💬 Falar com NPC</button>
              <button type="button" onclick="AdminApp.addVisualQuestObjective('VISIT_MAP')" style="padding:4px 9px; font-size:0.74rem; background:#854d0e; color:#fff;">➕ 🗺️ Explorar Mapa</button>
              <button type="button" onclick="AdminApp.addVisualQuestObjective('WIN_BATTLES')" style="padding:4px 9px; font-size:0.74rem; background:#6b21a8; color:#fff;">➕ ⚔️ Vencer Batalhas</button>
            </div>
          </div>
          <div id="questVisualObjectivesContainer" style="display:flex; flex-direction:column; gap:8px;"></div>
        </div>

        ${questBattleBuilderHtml}

        <!-- BLOCO 5: DIÁLOGOS -->
        <div style="background:rgba(15,23,42,0.75); border:1px solid #334155; border-radius:10px; padding:12px; margin-bottom:12px;">
          <div style="font-size:0.8rem; font-weight:700; color:#fde047; margin-bottom:8px;">5️⃣ 💬 Falas do NPC em Português (i18n Automático)</div>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:8px;">
            <div class="field"><label style="color:#f87171;">❗ Fala ao Oferecer (! Vermelho)</label><textarea id="questDialogueOfferInput" rows="2"></textarea></div>
            <div class="field"><label style="color:#94a3b8;">❓ Fala em Andamento (? Cinza)</label><textarea id="questDialogueActiveInput" rows="2"></textarea></div>
            <div class="field"><label style="color:#86efac;">❓ Fala ao Concluir (? Vermelho)</label><textarea id="questDialogueCompleteInput" rows="2"></textarea></div>
          </div>
        </div>

        <!-- BLOCO 6: RECOMPENSAS (Quests Normais) -->
        <div id="questNormalRewardsSection" style="background:rgba(15,23,42,0.75); border:1px solid #22c55e; border-radius:10px; padding:12px;">
          <div style="font-size:0.8rem; font-weight:700; color:#86efac; margin-bottom:8px;">6️⃣ 🎁 Recompensas ao Concluir a Missão</div>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:10px;">
            <div class="field"><label>✨ Experiência (EXP)</label><input type="number" id="questRewardExpInput" value="150" min="0" /></div>
            <div class="field"><label>🪙 Ouro</label><input type="number" id="questRewardGoldInput" value="80" min="0" /></div>
            <div class="field"><label>📊 Pontos Atributo</label><input type="number" id="questRewardStatPtsInput" value="2" min="0" /></div>
            <div class="field"><label>🎒 Item Recompensa</label><select id="questRewardItemSelect"></select></div>
            <div class="field"><label>Qtd Item</label><input type="number" id="questRewardItemQtyInput" value="1" min="1" /></div>
            <div class="field">
              <label style="color:#c084fc; font-weight:700;">👑 Despertar Reborn?</label>
              <select id="questRewardRebornSelect"><option value="false">Não</option><option value="true">✨ Sim — Reencarnar!</option></select>
            </div>
          </div>
        </div>
      </div>`;
      document.body.appendChild(modal);
    }
  }
}

window.AdminQuestsModalDom = AdminQuestsModalDom;
