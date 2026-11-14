/**
 * @file apps/server/public/admin/js/AdminMonsterModalDom.js
 * @module @etheria/server
 * @description Injeção modular do DOM do Modal de Criação e Edição de Monstros / Mobs (`monster_templates`).
 *   Contém todos os campos organizados em blocos fluidos e adaptativos:
 *   - Identidade, Raça, Elemento, Raridade e Pet Domável
 *   - Lore / Descrição em Português com i18n
 *   - Atributos Base no Nível 1 (VIT, STR, INT, WIS, AGI, DEX)
 *   - Atributos Base de Combate Não-Derivados (Velocidade de Movimento em Batalha, Vel. Ataque, Crítico, Precisão e Esquiva)
 *   - Habilidades vinculadas com filtro em tempo real
 *   - Drops de Itens com validação de itens cadastrados
 *   - Palco 2.5D animado com testes de ações e calibração de solo
 *   - Catálogo dos 532 monstros do mcrework
 *   Layout 100% responsivo para Mobile Vertical (Portrait) e Desktop.
 */

class AdminMonsterModalDom {
  static injectModalDom() {
    if (document.getElementById('monsterModal')) return;

    const modalDiv = document.createElement('div');
    modalDiv.id = 'monsterModal';
    modalDiv.className = 'modal-backdrop';
    modalDiv.style.display = 'none';

    modalDiv.innerHTML = `
    <div class="modal-box monster-modal-box" style="max-width:960px; width:96%; max-height:92vh; display:block; overflow-y:auto; -webkit-overflow-scrolling:touch; padding:14px; box-sizing:border-box;">
      <!-- Cabeçalho Fixo Responsivo -->
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:10px; margin-bottom:12px; gap:8px; flex-wrap:wrap;">
        <div style="display:flex; align-items:center; gap:8px;">
          <h3 id="monsterModalTitle" style="color:#f43f5e; margin:0; font-size:1.05rem;">🐉 Editar / Criar Monstro</h3>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <button class="btn-success" onclick="AdminApp.saveMonsterTemplate()" style="padding:7px 16px; font-weight:800; min-height:38px; border-radius:6px;">💾 Salvar</button>
          <button class="btn-danger" onclick="AdminApp.closeModal('monsterModal')" style="padding:7px 12px; min-height:38px; border-radius:6px;">✕</button>
        </div>
      </div>

      <input type="hidden" id="monsterEditIdInput" value="" />
      <input type="hidden" id="monsterAssetKeyInput" value="" />

      <!-- BLOCO 1: IDENTIDADE, RAÇA, ELEMENTO, RARIDADE & CLASSIFICAÇÃO -->
      <div style="background:rgba(15,23,42,0.85); border:1px solid #334155; border-radius:10px; padding:12px; margin-bottom:12px;">
        <div style="font-size:0.82rem; font-weight:700; color:#fde047; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
          <span>1️⃣ Identidade, Raça, Elemento & Classificação</span>
        </div>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 170px), 1fr)); gap:10px;">
          <div class="field">
            <label>ID & Chave do Monstro</label>
            <input type="text" id="monsterCodeInput" readonly style="opacity:0.85; font-weight:700; color:#f43f5e;" />
          </div>
          <div class="field">
            <label>Nome do Monstro (PT-BR)</label>
            <input type="text" id="monsterNameInput" placeholder="Ex: Sa Tặc da Areia" />
          </div>
          <div class="field">
            <label style="color:#fb7185; font-weight:700;">🧬 Raça do Monstro</label>
            <select id="monsterRaceSelect"></select>
          </div>
          <div class="field">
            <label style="color:#38bdf8; font-weight:700;">🔥 Elemento Fixo</label>
            <select id="monsterElementSelect"></select>
          </div>
          <div class="field">
            <label style="color:#c084fc; font-weight:700;">💎 Raridade Padrão</label>
            <select id="monsterRaritySelect"></select>
          </div>
          <div class="field">
            <label style="color:#fde047; font-weight:700;">⚔️ Estilo de Combate</label>
            <select id="monsterCombatStyleSelect" onchange="AdminApp.onCombatStyleChange('monster')" title="Estilo de Combate do Monstro">
              <option value="MELEE">⚔️ Melee (Corpo a Corpo)</option>
              <option value="RANGED">🏹 Ranged (À Distância)</option>
            </select>
          </div>
          <div class="field">
            <label style="color:#c084fc; font-weight:700;">✨ Tipo de Dano</label>
            <select id="monsterDamageTypeSelect" title="Tipo de Dano do Ataque Básico">
              <option value="PHYSICAL">🗡️ Dano Físico</option>
              <option value="MAGICAL">🔮 Dano Mágico</option>
            </select>
          </div>
          <div class="field">
            <label style="color:#fde047; font-weight:700;">🎯 Alcance Padrão (px)</label>
            <input type="number" id="monsterAttackRangeInput" min="20" max="600" value="60" title="Distância padrão de alcance do ataque em pixels" />
          </div>
          <div class="field">
            <label style="color:#86efac; font-weight:700;">🐾 Disponível como Pet no Jogo?</label>
            <select id="monsterTamableSelect" title="Se marcado como Sim, este monstro também fica disponível como Pet no jogo com os mesmos atributos base/combate, habilidades, elemento, raridade e rank">
              <option value="true">🐾 Sim — Monstro e Pet Disponível</option>
              <option value="false">⚔️ Não — Apenas Monstro Inimigo</option>
            </select>
          </div>
          <div class="field">
            <label>Status do Monstro</label>
            <select id="monsterActiveSelect">
              <option value="true">🟢 Ativo no Jogo</option>
              <option value="false">⚪ Inativo / Oculto</option>
            </select>
          </div>
        </div>
      </div>

      <!-- BLOCO 2: DESCRIÇÃO EM PT-BR & CHAVE I18N AUTOMÁTICA -->
      <div style="background:rgba(15,23,42,0.85); border:1px solid #334155; border-radius:10px; padding:12px; margin-bottom:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px; margin-bottom:6px;">
          <span style="font-size:0.82rem; font-weight:700; color:#fde047;">2️⃣ 📜 Descrição / Lore em Português (PT-BR)</span>
          <span id="monsterDescI18nDisplay" style="color:var(--accent); font-family:monospace; font-size:0.72rem; background:#020617; padding:2px 8px; border-radius:4px; border:1px solid var(--border);">monster.monster_X.description</span>
        </div>
        <textarea id="monsterDescriptionInput" rows="2" placeholder="Digite a descrição em português deste monstro (história, habitat, comportamento e curiosidades)..." style="width:100%; padding:8px 10px; font-size:0.84rem; line-height:1.4; resize:vertical; box-sizing:border-box;"></textarea>
      </div>

      <!-- BLOCO 3: ATRIBUTOS BASE NO NÍVEL 1 (ESCALADOS POR NÍVEL E RARIDADE) -->
      <div style="background:rgba(15,23,42,0.85); border:1px solid #334155; border-radius:10px; padding:12px; margin-bottom:12px;">
        <div style="font-size:0.82rem; font-weight:700; color:#fde047; margin-bottom:4px;">
          3️⃣ 📊 Atributos Base no Nível 1 (Pesos que alimentam Vida, Mana, Ataque e Defesa)
        </div>
        <p style="font-size:0.72rem; color:var(--text-muted); margin:0 0 8px 0;">
          Estes 6 atributos e o Rank de Raridade (F até SS) aplicam-se de forma idêntica tanto quando atua como Monstro quanto quando está marcado como Pet disponível.
        </p>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 110px), 1fr)); gap:8px;">
          <div class="field"><label style="font-size:0.72rem; color:#86efac; font-weight:700;">❤️ VIT (Vida/Def)</label><input type="number" id="monsterBaseVIT" value="14" min="1" /></div>
          <div class="field"><label style="font-size:0.72rem; color:#f87171; font-weight:700;">🗡️ STR (Ataque)</label><input type="number" id="monsterBaseSTR" value="12" min="1" /></div>
          <div class="field"><label style="font-size:0.72rem; color:#38bdf8; font-weight:700;">🔮 INT (Magia/MP)</label><input type="number" id="monsterBaseINT" value="10" min="1" /></div>
          <div class="field"><label style="font-size:0.72rem; color:#c084fc; font-weight:700;">✨ WIS (Sabedoria)</label><input type="number" id="monsterBaseWIS" value="10" min="1" /></div>
          <div class="field"><label style="font-size:0.72rem; color:#fde047; font-weight:700;">⚡ AGI (Velocidade)</label><input type="number" id="monsterBaseAGI" value="10" min="1" /></div>
          <div class="field"><label style="font-size:0.72rem; color:#fb923c; font-weight:700;">🎯 DEX (Precisão)</label><input type="number" id="monsterBaseDEX" value="10" min="1" /></div>
        </div>
      </div>

      <!-- BLOCO 3.5: ATRIBUTOS BASE DE COMBATE NÃO-DERIVADOS (VELOCIDADE DE MOVIMENTO, VEL. ATAQUE, CRÍTICO, PRECISÃO E ESQUIVA) -->
      <div style="background:rgba(15,23,42,0.85); border:1.5px solid #38bdf8; border-radius:10px; padding:12px; margin-bottom:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px; margin-bottom:4px;">
          <span style="font-size:0.82rem; font-weight:700; color:#38bdf8;">
            ⚙️ Atributos Base de Combate do Monstro (Piso Fixo Não-Derivado)
          </span>
          <span style="font-size:0.72rem; color:#86efac; background:rgba(34,197,94,0.15); padding:2px 8px; border-radius:6px; border:1px solid #16a34a; font-weight:600;">
            🔥 Aplicados Diretamente na Batalha
          </span>
        </div>
        <p style="font-size:0.72rem; color:#94a3b8; margin:0 0 10px 0; line-height:1.4;">
          Configure aqui os parâmetros de ação em tempo real deste monstro: velocidade em pixels por segundo no mapa de batalha, taxa de golpes por segundo, chance e multiplicador de crítico, além de precisão e esquiva.
        </p>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 140px), 1fr)); gap:10px;">
          <div class="field">
            <label style="font-size:0.72rem; color:#38bdf8; font-weight:700;">🏃 Vel. Movimento (px/s)</label>
            <input type="number" id="monsterBaseCombatMoveSpeed" value="160" min="80" max="400" step="5" title="Velocidade em pixels por segundo em batalha (padrão: 160 px/s)" />
            <span style="font-size:0.66rem; color:var(--text-muted);">Padrão: 160 px/s</span>
          </div>
          <div class="field">
            <label style="font-size:0.72rem; color:#fde047; font-weight:700;">⚔️ Vel. de Ataque (atks/s)</label>
            <input type="number" id="monsterBaseCombatAttackSpeed" value="1.0" min="0.2" max="3.5" step="0.1" title="Ataques por segundo (padrão: 1.0 atks/s)" />
            <span style="font-size:0.66rem; color:var(--text-muted);">Padrão: 1.0 atks/s</span>
          </div>
          <div class="field">
            <label style="font-size:0.72rem; color:#f43f5e; font-weight:700;">💥 Taxa Crítica (%)</label>
            <input type="number" id="monsterBaseCombatCritRate" value="5" min="0" max="80" step="1" title="Taxa base de acerto crítico (0 a 80%)" />
            <span style="font-size:0.66rem; color:var(--text-muted);">Teto: 80%</span>
          </div>
          <div class="field">
            <label style="font-size:0.72rem; color:#fb7185; font-weight:700;">⚡ Dano Crítico (%)</label>
            <input type="number" id="monsterBaseCombatCritDmg" value="150" min="100" max="300" step="5" title="Multiplicador de dano crítico (100 a 300%)" />
            <span style="font-size:0.66rem; color:var(--text-muted);">Padrão: 150%</span>
          </div>
          <div class="field">
            <label style="font-size:0.72rem; color:#4ade80; font-weight:700;">🎯 Precisão Física (%)</label>
            <input type="number" id="monsterBaseCombatPhysAcc" value="95" min="20" max="125" step="1" title="Precisão de acerto físico (20 a 125%)" />
            <span style="font-size:0.66rem; color:var(--text-muted);">Padrão: 95%</span>
          </div>
          <div class="field">
            <label style="font-size:0.72rem; color:#a3e635; font-weight:700;">💨 Esquiva Física (%)</label>
            <input type="number" id="monsterBaseCombatPhysEva" value="5" min="0" max="75" step="1" title="Chance de esquiva física (0 a 75%)" />
            <span style="font-size:0.66rem; color:var(--text-muted);">Teto: 75%</span>
          </div>
          <div class="field">
            <label style="font-size:0.72rem; color:#c084fc; font-weight:700;">🔮 Precisão Mágica (%)</label>
            <input type="number" id="monsterBaseCombatMagAcc" value="95" min="20" max="125" step="1" title="Precisão de magia (20 a 125%)" />
            <span style="font-size:0.66rem; color:var(--text-muted);">Padrão: 95%</span>
          </div>
          <div class="field">
            <label style="font-size:0.72rem; color:#e879f9; font-weight:700;">✨ Esquiva Mágica (%)</label>
            <input type="number" id="monsterBaseCombatMagEva" value="5" min="0" max="75" step="1" title="Chance de esquiva mágica (0 a 75%)" />
            <span style="font-size:0.66rem; color:var(--text-muted);">Teto: 75%</span>
          </div>
        </div>
      </div>

      <!-- BLOCO 4: HABILIDADES VINCULADAS -->
      <div style="background:rgba(15,23,42,0.85); border:1.5px solid #0284c7; border-radius:10px; padding:12px; margin-bottom:12px; box-sizing:border-box;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:8px;">
          <div style="display:flex; align-items:center; flex-wrap:wrap; gap:8px;">
            <span style="font-size:0.82rem; font-weight:700; color:#fde047;">4️⃣ ⚡ Habilidades deste Monstro</span>
            <span id="monsterSkillsSelectedCount" style="font-size:0.72rem; color:#38bdf8; font-weight:700; background:rgba(56,189,248,0.15); padding:2px 8px; border-radius:6px; border:1px solid #0284c7;">0 marcadas</span>
          </div>
          <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap; flex:1; justify-content:flex-end;">
            <input type="text" id="monsterSkillFilterInput" placeholder="🔍 Filtrar habilidade..." oninput="AdminApp.filterEntitySkillsChecklist('monsterSkillsChecklist', this.value)" style="padding:5px 8px; font-size:0.75rem; min-width:130px; flex:1; max-width:240px;" />
            <button type="button" onclick="AdminApp.clearEntitySkills('monsterSkillsChecklist')" style="padding:5px 8px; font-size:0.72rem; white-space:nowrap;">⬜ Desmarcar Todas</button>
          </div>
        </div>
        <!-- Filtros rápidos por elemento -->
        <div class="skill-filter-chips-container" style="display:flex; gap:4px; flex-wrap:wrap; margin-bottom:8px;">
          <button type="button" class="skill-filter-chip btn-primary" onclick="AdminApp.filterEntitySkillsByElement('monsterSkillsChecklist', 'ALL', this)" style="padding:3px 8px; font-size:0.70rem;">Todos</button>
          <button type="button" class="skill-filter-chip" onclick="AdminApp.filterEntitySkillsByElement('monsterSkillsChecklist', 'WATER', this)" style="padding:3px 8px; font-size:0.70rem; color:#67e8f9;">💧 Água</button>
          <button type="button" class="skill-filter-chip" onclick="AdminApp.filterEntitySkillsByElement('monsterSkillsChecklist', 'FIRE', this)" style="padding:3px 8px; font-size:0.70rem; color:#fca5a5;">🔥 Fogo</button>
          <button type="button" class="skill-filter-chip" onclick="AdminApp.filterEntitySkillsByElement('monsterSkillsChecklist', 'EARTH', this)" style="padding:3px 8px; font-size:0.70rem; color:#fde047;">🪨 Terra</button>
          <button type="button" class="skill-filter-chip" onclick="AdminApp.filterEntitySkillsByElement('monsterSkillsChecklist', 'AIR', this)" style="padding:3px 8px; font-size:0.70rem; color:#d8b4fe;">🌪️ Ar</button>
          <button type="button" class="skill-filter-chip" onclick="AdminApp.filterEntitySkillsByElement('monsterSkillsChecklist', 'NEUTRAL', this)" style="padding:3px 8px; font-size:0.70rem; color:#cbd5e1;">⚪ Neutro</button>
        </div>
        <div id="monsterSkillsChecklist" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(min(100%, 250px), 1fr)); gap:8px; max-height:220px; overflow-y:auto; overflow-x:hidden; padding:8px; background:#020617; border:1px solid var(--border); border-radius:8px; box-sizing:border-box;"></div>
      </div>

      <!-- BLOCO 4.5: TABELA DE DROPS DO MONSTRO -->
      <div style="background:rgba(15,23,42,0.85); border:1.5px solid #22c55e; border-radius:10px; padding:12px; margin-bottom:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:8px;">
          <div>
            <span style="font-size:0.82rem; font-weight:700; color:#86efac;">🎁 Drops ao Derrotar este Monstro</span>
            <div style="font-size:0.70rem; color:#94a3b8; margin-top:2px;">🔒 Selecione apenas itens cadastrados na tabela de Itens.</div>
          </div>
          <span id="monsterDropsCountBadge" style="font-size:0.72rem; color:#86efac; font-weight:700; background:rgba(34,197,94,0.15); padding:2px 8px; border-radius:6px; border:1px solid #16a34a;">0 drop(s)</span>
        </div>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 140px), 1fr)) auto; gap:8px; align-items:end; background:#020617; border:1px solid #334155; border-radius:8px; padding:8px; margin-bottom:8px;">
          <div class="field" style="grid-column: 1 / -2;">
            <label>📦 Item cadastrado no banco</label>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
              <input type="text" id="monsterDropItemFilterInput" placeholder="🔍 Filtrar item..." oninput="AdminApp.populateMonsterDropsItemSelect(this.value)" style="max-width:140px; font-size:0.75rem; padding:6px 8px;" />
              <select id="monsterDropAddItemSelect" style="flex:1; min-width:140px;"></select>
            </div>
          </div>
          <div class="field"><label>Qtd Mín</label><input type="number" id="monsterDropAddMinQty" value="1" min="1" /></div>
          <div class="field"><label>Qtd Máx</label><input type="number" id="monsterDropAddMaxQty" value="1" min="1" /></div>
          <div class="field"><label>Chance (%)</label><input type="number" id="monsterDropAddChance" value="25" min="0.01" max="100" step="0.1" /></div>
          <button type="button" id="monsterDropAddBtn" class="btn-success" onclick="AdminApp.addMonsterDropEntry()" style="padding:8px 12px; font-weight:700; white-space:nowrap; min-height:38px;">➕ Adicionar</button>
        </div>
        <div id="monsterDropsListContainer" style="display:flex; flex-direction:column; gap:6px; max-height:180px; overflow-y:auto;"></div>
      </div>

      <!-- BLOCO 5: PALCO 2.5D ANIMADO & CATÁLOGO DO MCREWORK -->
      <div style="background:rgba(15,23,42,0.85); border:1.5px solid #f43f5e; border-radius:10px; padding:12px; margin-bottom:12px;">
        <div style="font-size:0.82rem; font-weight:700; color:#fde047; margin-bottom:8px;">
          5️⃣ 🎨 Modelo 2.5D Animado, Calibração de Solo & Catálogo do mcrework
        </div>

        <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap; background:rgba(2,6,23,0.75); border:1px solid #334155; border-radius:10px; padding:10px; margin-bottom:10px;">
          <!-- Canvas 2.5D Real Animado -->
          <div style="position:relative; width:140px; height:140px; background:radial-gradient(ellipse at center bottom, #4c0519 0%, #020617 75%); border:1.5px solid #f43f5e; border-radius:8px; overflow:hidden; flex-shrink:0; margin:0 auto;">
            <canvas id="monsterPreviewCanvas" width="140" height="140" style="width:140px; height:140px; display:block;"></canvas>
            <span id="monsterPreviewDirBadge" style="position:absolute; top:4px; left:5px; font-size:0.62rem; color:#fde047; background:rgba(0,0,0,0.7); padding:1px 5px; border-radius:4px;">Dir: 0</span>
            <span style="position:absolute; top:4px; right:5px; font-size:0.62rem; color:#fca5a5; background:rgba(0,0,0,0.7); padding:1px 5px; border-radius:4px;">2.5D Live</span>
          </div>

          <div style="flex:1; display:flex; flex-direction:column; gap:6px; min-width:200px;">
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <strong id="monsterHeroLabel" style="font-size:0.92rem; color:#fde047;">Selecione um Monstro</strong>
              <span id="monsterHeroBadge" style="font-size:0.72rem; padding:2px 8px; border-radius:99px; background:rgba(244,63,94,0.2); color:#fb7185; font-weight:700;"></span>
            </div>

            <!-- Botões de Teste das Animações 2.5D -->
            <div style="display:flex; gap:4px; flex-wrap:wrap; align-items:center;">
              <span style="font-size:0.7rem; color:var(--text-muted); margin-right:2px;">Ação:</span>
              <button type="button" class="monster-anim-btn btn-primary" data-action="0" onclick="AdminApp.setMonsterPreviewAction(0)" style="padding:4px 8px; font-size:0.7rem;">🧍 Idle</button>
              <button type="button" class="monster-anim-btn" data-action="1" onclick="AdminApp.setMonsterPreviewAction(1)" style="padding:4px 8px; font-size:0.7rem;">🏃 Andar</button>
              <button type="button" class="monster-anim-btn" data-action="3" onclick="AdminApp.setMonsterPreviewAction(3)" style="padding:4px 8px; font-size:0.7rem;">🗡️ Ataque</button>
              <button type="button" class="monster-anim-btn" data-action="5" onclick="AdminApp.setMonsterPreviewAction(5)" style="padding:4px 8px; font-size:0.7rem;">💥 Dano</button>
              <button type="button" class="monster-anim-btn" data-action="6" onclick="AdminApp.setMonsterPreviewAction(6)" style="padding:4px 8px; font-size:0.7rem;">💀 Morte</button>
              <button type="button" class="monster-anim-btn" data-action="7" onclick="AdminApp.setMonsterPreviewAction(7)" style="padding:4px 8px; font-size:0.7rem;">🔥 Skill</button>
              <button type="button" onclick="AdminApp.rotateMonsterPreviewDir()" style="padding:4px 8px; font-size:0.7rem; background:#334155;">↻ Girar</button>
            </div>

            <!-- Calibragem de Distância ao Solo -->
            <div style="display:flex; align-items:center; gap:4px; flex-wrap:wrap;">
              <span style="font-size:0.72rem; color:var(--text-muted);">Solo (Y):</span>
              <button type="button" onclick="AdminApp.adjustMonsterGroundOffset(-5)" style="padding:4px 8px; font-size:0.72rem;">-5</button>
              <button type="button" onclick="AdminApp.adjustMonsterGroundOffset(-1)" style="padding:4px 8px; font-size:0.72rem;">-1</button>
              <input type="number" id="monsterGroundOffsetYInput" value="0" min="-60" max="60" oninput="AdminApp.updateMonsterGroundOffsetPreview()" style="width:50px; text-align:center; padding:3px; font-size:0.8rem;" />
              <button type="button" onclick="AdminApp.adjustMonsterGroundOffset(1)" style="padding:4px 8px; font-size:0.72rem;">+1</button>
              <button type="button" onclick="AdminApp.adjustMonsterGroundOffset(5)" style="padding:4px 8px; font-size:0.72rem;">+5</button>
              <button type="button" onclick="AdminApp.resetMonsterGroundOffset()" title="Zerar" style="padding:4px 7px; font-size:0.72rem;">↩0</button>
              <span id="monsterGroundStatusBadge" style="font-size:0.72rem; color:#86efac; font-weight:600; margin-left:4px;">🟢 Pés no solo (0px)</span>
            </div>
          </div>
        </div>

        <!-- Filtro e Grade de Modelos do mcrework -->
        <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-bottom:8px;">
          <input type="text" id="monsterSearchInput" placeholder="🔍 Buscar modelo (ex: creature_000015)..." oninput="AdminApp.filterMonsterGallery()" style="flex:1; min-width:160px; padding:6px 10px; font-size:0.82rem;" />
          <select id="monsterCategoryFilterSelect" onchange="AdminApp.filterMonsterGallery()" style="width:140px; padding:6px; font-size:0.8rem;">
            <option value="all">Todos os Modelos</option>
            <option value="pet">🐾 Modelos de Pets</option>
            <option value="mob">👾 Selvagens (Mobs)</option>
          </select>
          <span style="font-size:0.75rem; color:var(--text-muted);">(<span id="monsterCountBadge">0</span> disponíveis)</span>
        </div>
        <div id="mcreworkMonstersGrid" class="gallery-grid" style="max-height:280px; min-height:160px;"></div>
      </div>

      <!-- Botão de Salvar no Rodapé -->
      <div style="border-top:1px solid var(--border); padding-top:10px;">
        <button class="btn-success" style="width:100%; padding:12px; font-weight:800; font-size:0.95rem; border-radius:8px; min-height:44px;" onclick="AdminApp.saveMonsterTemplate()">
          💾 Salvar Monstro Completo na Tabela
        </button>
      </div>
    </div>`;

    document.body.appendChild(modalDiv);
  }
}

window.AdminMonsterModalDom = AdminMonsterModalDom;
