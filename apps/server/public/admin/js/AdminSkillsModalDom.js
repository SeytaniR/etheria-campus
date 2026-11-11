/**
 * @file apps/server/public/admin/js/AdminSkillsModalDom.js
 * @module @etheria/server
 * @description Injeção modular do DOM das abas ⚡ Habilidades, 🧪 Buffs & Debuffs e Modal de Habilidade.
 *   Extraído de AdminSkillsAndBuffsTab.js para manter todos os arquivos abaixo de 1.000 linhas (Regra #7).
 * @dependencies AdminVfxColorPicker
 */

class AdminSkillsModalDom {
  static injectTabsAndModalsDom() {
    const navTabs = document.querySelector('.nav-tabs');
    const btnMonsters = document.getElementById('tabBtnMonsters');
    if (navTabs && !document.getElementById('tabBtnSkills')) {
      const btnSkills = document.createElement('button');
      btnSkills.id = 'tabBtnSkills';
      btnSkills.onclick = () => window.AdminApp.switchTab('skills');
      btnSkills.textContent = '⚡ Habilidades';

      const btnBuffs = document.createElement('button');
      btnBuffs.id = 'tabBtnStatusEffects';
      btnBuffs.onclick = () => window.AdminApp.switchTab('status-effects');
      btnBuffs.textContent = '🧪 Buffs & Debuffs';

      if (btnMonsters && btnMonsters.nextSibling) {
        navTabs.insertBefore(btnBuffs, btnMonsters.nextSibling);
        navTabs.insertBefore(btnSkills, btnBuffs);
      } else {
        navTabs.appendChild(btnSkills);
        navTabs.appendChild(btnBuffs);
      }
    }

    const adminAppEl = document.getElementById('adminApp');
    if (adminAppEl && !document.getElementById('tabSkills')) {
      const skillsPanel = document.createElement('div');
      skillsPanel.id = 'tabSkills';
      skillsPanel.style.cssText = 'display:none; padding:16px; max-width:1250px; margin:0 auto; width:100%; gap:16px; flex-direction:column;';
      skillsPanel.innerHTML = `
        <div class="panel">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:14px;">
            <div>
              <h3 style="margin:0; color:#38bdf8;">⚡ Tabela de Habilidades (Modo Visual No-Code)</h3>
              <p style="margin:4px 0 0; font-size:0.8rem; color:var(--text-muted);">
                Catálogo disponível de habilidades ativas e passivas com ícones e efeitos especiais (VFX) do <code>mcrework</code> e suporte a customização de cores de partículas.
              </p>
            </div>
            <button class="btn-primary" onclick="AdminApp.openSkillTemplateModal(null)">➕ Nova Habilidade Visual</button>
          </div>
          <div style="overflow-x:auto;">
            <table class="crud-table">
              <thead>
                <tr>
                  <th>ID & Código</th>
                  <th>Ícone & VFX</th>
                  <th>Nome & Descrição (PT-BR)</th>
                  <th>Tipo & Gatilho</th>
                  <th>Alcance & Custos</th>
                  <th>Blocos Visuais de Efeito</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody id="skillsTableBody"></tbody>
            </table>
          </div>
        </div>`;
      adminAppEl.appendChild(skillsPanel);

      const buffsPanel = document.createElement('div');
      buffsPanel.id = 'tabStatusEffects';
      buffsPanel.style.cssText = 'display:none; padding:16px; max-width:1250px; margin:0 auto; width:100%; gap:16px; flex-direction:column;';
      buffsPanel.innerHTML = `
        <div class="panel">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:14px;">
            <div>
              <h3 style="margin:0; color:#c084fc;">🧪 Tabela de Buffs & Debuffs (Efeitos de Status)</h3>
              <p style="margin:4px 0 0; font-size:0.8rem; color:var(--text-muted);">
                Buffs e Debuffs não se ativam sozinhos: são aplicados por Habilidades Ativas ou Passivas. Possuem <strong>Ícone próprio</strong> (exibido na cabeça do alvo durante a batalha), <strong>Efeito Especial (VFX)</strong> colorizável e <strong>Gatilhos Próprios</strong>.
              </p>
            </div>
            <button class="btn-primary" onclick="AdminApp.openStatusEffectModal(null)">➕ Novo Buff / Debuff</button>
          </div>
          <div style="overflow-x:auto;">
            <table class="crud-table">
              <thead>
                <tr>
                  <th>ID & Código</th>
                  <th>Ícone (Cabeça) & VFX</th>
                  <th>Nome & Descrição (PT-BR)</th>
                  <th>Natureza</th>
                  <th>Gatilho & Duração</th>
                  <th>Efeitos Visuais (Atributos / DoT / CC)</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody id="statusEffectsTableBody"></tbody>
            </table>
          </div>
        </div>`;
      adminAppEl.appendChild(buffsPanel);
    }

    if (!document.getElementById('skillTemplateModal')) {
      const colorControlsHtml = window.AdminVfxColorPicker
        ? window.AdminVfxColorPicker.buildControlsHtml('skill')
        : '';

      const skModal = document.createElement('div');
      skModal.id = 'skillTemplateModal';
      skModal.className = 'modal-backdrop';
      skModal.style.display = 'none';
      skModal.innerHTML = `
      <div class="modal-box" style="max-width:960px; width:96%; max-height:92vh; display:block; overflow-y:auto; padding:16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:10px; margin-bottom:12px;">
          <h3 id="skillModalTitle" style="color:#38bdf8; margin:0;">⚡ Nova Habilidade Visual</h3>
          <div style="display:flex; gap:8px;">
            <button class="btn-success" onclick="AdminApp.saveSkillTemplate()" style="padding:6px 14px; font-weight:700;">💾 Salvar Habilidade</button>
            <button class="btn-danger" onclick="AdminApp.closeModal('skillTemplateModal')" style="padding:6px 10px;">✕</button>
          </div>
        </div>
        <input type="hidden" id="skillEditIdInput" value="" />

        <div style="background:rgba(15,23,42,0.75); border:1px solid #334155; border-radius:10px; padding:12px; margin-bottom:12px;">
          <div style="font-size:0.8rem; font-weight:700; color:#fde047; margin-bottom:8px;">1️⃣ Identidade, Tipo (Ativa/Passiva), Gatilho, Alcance & Custos</div>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(165px, 1fr)); gap:10px;">
            <div class="field"><label>ID & Código</label><input type="text" id="skillCodeInput" readonly style="color:#38bdf8; font-weight:700;" /></div>
            <div class="field"><label>Nome da Habilidade (PT-BR)</label><input type="text" id="skillNameInput" placeholder="Ex: Chama Purgatorial" /></div>
            <div class="field">
              <label style="color:#38bdf8; font-weight:700;">Categoria da Skill</label>
              <select id="skillTypeSelect">
                <option value="ACTIVE">⚡ ATIVA (Usada no Combate)</option>
                <option value="PASSIVE">♾️ PASSIVA / REATIVA</option>
              </select>
            </div>
            <div class="field">
              <label style="color:#fde047; font-weight:700;">Gatilho de Ativação</label>
              <select id="skillTriggerSelect" onchange="AdminApp.onSkillTriggerChanged && AdminApp.onSkillTriggerChanged(this.value)">
                <option value="ACTIVE">🎯 Uso Manual / Tempo Real</option>
                <option value="PASSIVE_ALWAYS">♾️ Passiva Permanente</option>
                <option value="INTERVAL_TICK">⏱️ Periódico (A cada intervalo de segundos)</option>
                <option value="ON_HIT">🗡️ Ao Acertar um Golpe</option>
                <option value="ON_CRIT">💥 Ao Causar Dano Crítico</option>
                <option value="ON_DAMAGE_TAKEN">🛡️ Ao Receber Dano</option>
                <option value="ON_KILL">💀 Ao Derrotar um Inimigo</option>
                <option value="ON_DEBUFF_RECEIVED">✨ Ao Receber Debuff (Limpar Debuffs)</option>
                <option value="INTERVAL_TICK_CLEANSE">🧹 Purificação Periódica (A cada intervalo com Debuff)</option>
              </select>
            </div>
            <div class="field">
              <label>Alcance na Arena</label>
              <select id="skillTargetScopeSelect">
                <option value="MELEE_FRONTLINE">🗡️ Corpo-a-Corpo (1 Inimigo)</option>
                <option value="RANGED_ANY">🏹 Distância Livre (1 Inimigo)</option>
                <option value="ALL_ENEMIES">🌋 Área Total (Todos os Inimigos)</option>
                <option value="ROW_FRONT">📏 Fileira Frontal Inimiga</option>
                <option value="SELF">🙋 Próprio Conjurador (Self)</option>
                <option value="ALLY_SINGLE">💚 1 Aliado</option>
                <option value="ALLY_ALL">✨ Todos os Aliados</option>
              </select>
            </div>
            <div class="field"><label>Nº de Golpes (Hits)</label><input type="number" id="skillHitCountInput" value="1" min="1" max="10" /></div>
            <div class="field"><label>💧 Custo de MP</label><input type="number" id="skillMpCostInput" value="12" min="0" /></div>
            <div class="field"><label>⏳ Cooldown (Segundos)</label><input type="number" id="skillCooldownInput" value="3.0" min="0" step="0.5" /></div>
            <div class="field"><label>🎯 Alcance (Pixels)</label><input type="number" id="skillCastRangeInput" value="160" min="0" step="10" /></div>
            <div class="field"><label>💥 Raio de Área (AoE px)</label><input type="number" id="skillAoeRadiusInput" value="0" min="0" step="10" /></div>
          </div>
          <div style="display:flex; align-items:center; gap:8px; margin-top:10px; padding:6px 10px; background:rgba(2,6,23,0.8); border:1px solid #0284c7; border-radius:6px; flex-wrap:wrap;">
            <label style="display:flex; align-items:center; gap:6px; font-size:0.75rem; color:#fde047; font-weight:700; cursor:pointer; margin:0;">
              <input type="checkbox" id="skillAutoLinkOnSaveCheck" style="width:16px; height:16px; cursor:pointer;" />
              🔗 Auto-vincular ao salvar a todos os monstros do elemento:
            </label>
            <select id="skillAutoLinkOnSaveElementSelect" style="padding:3px 8px; font-size:0.74rem;">
              <option value="WATER">💧 Água (WATER)</option>
              <option value="FIRE">🔥 Fogo (FIRE)</option>
              <option value="EARTH">🪨 Terra (EARTH)</option>
              <option value="AIR">🌪️ Ar / Vento (AIR)</option>
              <option value="NEUTRAL">⚪ Neutro (NEUTRAL)</option>
              <option value="ALL">🌍 Todos os Monstros</option>
            </select>
          </div>
          <div class="field" style="margin-top:8px;">
            <label>Descrição em Português (PT-BR)</label>
            <textarea id="skillDescInput" rows="2" placeholder="Descreva os efeitos da habilidade para o jogador..."></textarea>
          </div>
        </div>

        <div style="background:rgba(15,23,42,0.75); border:1.5px solid #38bdf8; border-radius:10px; padding:12px; margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
            <span style="font-size:0.82rem; font-weight:700; color:#fde047;">2️⃣ 🧩 Blocos Visuais de Efeito da Habilidade (Modo Visual No-Code)</span>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
              <button type="button" onclick="AdminApp.addVisualSkillBlock('DAMAGE')" style="padding:4px 9px; font-size:0.74rem; background:#9f1239; color:#fff;">➕ 💥 Dano</button>
              <button type="button" onclick="AdminApp.addVisualSkillBlock('HEAL')" style="padding:4px 9px; font-size:0.74rem; background:#15803d; color:#fff;">➕ 💚 Cura</button>
              <button type="button" onclick="AdminApp.addVisualSkillBlock('STATUS')" style="padding:4px 9px; font-size:0.74rem; background:#6b21a8; color:#fff;">➕ 🧪 Aplicar Buff/Debuff</button>
              <button type="button" onclick="AdminApp.addVisualSkillBlock('SHIELD')" style="padding:4px 9px; font-size:0.74rem; background:#0369a1; color:#fff;">➕ 🛡️ Escudo</button>
              <button type="button" onclick="AdminApp.addVisualSkillBlock('CLEANSE_DISPEL')" style="padding:4px 9px; font-size:0.74rem; background:#0d9488; color:#fff;">➕ ✨ Limpar Debuffs</button>
            </div>
          </div>
          <div id="skillVisualBlocksContainer" style="display:flex; flex-direction:column; gap:8px;"></div>
        </div>

        <div style="background:rgba(15,23,42,0.75); border:1px solid #334155; border-radius:10px; padding:12px;">
          <div style="font-size:0.8rem; font-weight:700; color:#fde047; margin-bottom:8px;">3️⃣ 🏟️ Arena de Batalha 2.5D Realista (Modelos Cadastrados), Ícone da Skill & Efeito Especial (VFX)</div>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(175px, 1fr)); gap:8px; margin-bottom:8px; background:rgba(2,6,23,0.75); padding:8px; border-radius:8px; border:1px solid var(--border); align-items:end;">
            <div>
              <label style="font-size:0.7rem; color:#7dd3fc; font-weight:700;">🦸 Conjurador na Arena (Esquerda)</label>
              <select id="skillArenaCasterSelect" onchange="AdminApp.triggerArenaPreviewNow()" style="padding:5px 7px; font-size:0.76rem;"></select>
            </div>
            <div>
              <label style="font-size:0.7rem; color:#fda4af; font-weight:700;">🐉 Alvo(s) na Arena (Direita)</label>
              <select id="skillArenaTargetSelect" onchange="AdminApp.triggerArenaPreviewNow()" style="padding:5px 7px; font-size:0.76rem;"></select>
            </div>
            <div>
              <label style="font-size:0.7rem; color:#fde047; font-weight:700;">⚔️ Formação de Alvos</label>
              <select id="skillArenaFormationSelect" onchange="AdminApp.triggerArenaPreviewNow()" style="padding:5px 7px; font-size:0.76rem;">
                <option value="1">1x1 (Duelo Individual)</option>
                <option value="3" selected>1x3 (Formação de Batalha)</option>
              </select>
            </div>
            <div>
              <button type="button" class="btn-primary" onclick="AdminApp.triggerArenaPreviewNow()" style="width:100%; padding:6px 10px; font-size:0.76rem; font-weight:700;">
                ▶️ Simular Golpe Agora
              </button>
            </div>
          </div>

          <div style="display:flex; gap:12px; align-items:stretch; flex-wrap:wrap; margin-bottom:10px; background:#020617; padding:10px; border-radius:8px;">
            <div style="position:relative; width:480px; max-width:100%; height:210px; background:#020617; border:1.5px solid #38bdf8; border-radius:8px; overflow:hidden; flex-shrink:0; display:flex; justify-content:center;">
              <canvas id="skillVfxPreviewCanvas" width="480" height="210" style="width:100%; height:100%; object-fit:contain;"></canvas>
              <span style="position:absolute; bottom:4px; right:6px; font-size:0.62rem; color:#7dd3fc; background:rgba(2,6,23,0.8); padding:1px 6px; border-radius:4px;">🏟️ Arena 2.5D Ao Vivo</span>
            </div>
            <div style="flex:1; display:flex; flex-direction:column; justify-content:space-between; gap:8px; min-width:260px;">
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                <div>
                  <label style="font-size:0.72rem;">Movimento do Conjurador</label>
                  <select id="skillCastMovementSelect" onchange="AdminApp.triggerArenaPreviewNow()">
                    <option value="MELEE_ADVANCE">🏃 Correr até a frente do Alvo</option>
                    <option value="STAND_IN_PLACE">🧙 Conjurar parado no próprio Slot</option>
                  </select>
                </div>
                <div>
                  <label style="font-size:0.72rem;">Animação 2.5D do Modelo</label>
                  <select id="skillCastActionSelect" onchange="AdminApp.triggerArenaPreviewNow()">
                    <option value="3">🗡️ Golpe Físico (Action 3)</option>
                    <option value="7">🔥 Conjuração / Magia (Action 7)</option>
                    <option value="4">🛡️ Postura de Guarda (Action 4)</option>
                  </select>
                </div>
              </div>
              <div style="display:flex; align-items:center; gap:10px;">
                <img id="skillSelectedIconImg" src="" alt="Icon" style="width:42px; height:42px; border-radius:8px; border:2px solid #38bdf8; background:#0f172a; object-fit:contain;" />
                <canvas id="skillSelectedVfxThumbCanvas" width="42" height="42" title="Prévia do Efeito Especial colorido" style="width:42px; height:42px; border-radius:8px; border:2px solid #f43f5e; background:#0f172a; flex-shrink:0;"></canvas>
                <div style="font-size:0.8rem; font-weight:700; color:#fde047;">Efeito Especial Selecionado: <span id="skillSelectedVfxLabel" style="color:#38bdf8;"></span></div>
              </div>
              ${colorControlsHtml}
              <div style="display:flex; gap:6px; flex-wrap:wrap;">
                <button type="button" id="btnSkillPickIcon" class="btn-primary" onclick="AdminApp.switchSkillAssetPicker('icon')" style="padding:5px 12px; font-size:0.76rem;">🖼️ Escolher Ícone da Skill</button>
                <button type="button" id="btnSkillPickVfx" onclick="AdminApp.switchSkillAssetPicker('vfx')" style="padding:5px 12px; font-size:0.76rem;">✨ Escolher Efeito Especial (VFX)</button>
                <input type="text" id="skillAssetSearchInput" placeholder="🔍 Filtrar..." oninput="AdminApp.renderSkillAssetGallery()" style="flex:1; min-width:140px; padding:5px 8px; font-size:0.78rem;" />
              </div>
            </div>
          </div>
          <div id="skillAssetsGalleryGrid" class="gallery-grid" style="max-height:220px;"></div>
        </div>
      </div>`;
      document.body.appendChild(skModal);
    }
  }
}

window.AdminSkillsModalDom = AdminSkillsModalDom;
