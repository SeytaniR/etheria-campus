/**
 * @file apps/server/public/admin/js/AdminClassModalTemplate.js
 * @module @etheria/server
 * @description Injeção de Template HTML e Helpers para o Modal de Criação e Edição de Personagens (#classModal).
 *   Modularizado para manter integridade arquitetural e respeitar a Regra #7 (<1.000 linhas).
 */

class AdminClassModalTemplate {
  static injectModalDom() {
    if (document.getElementById('classModal')) return;

    const modalDiv = document.createElement('div');
    modalDiv.id = 'classModal';
    modalDiv.className = 'modal-backdrop';
    modalDiv.style.display = 'none';
    modalDiv.innerHTML = `
    <div class="modal-box" style="max-width:860px; max-height:94dvh; display:flex; flex-direction:column; overflow-y:auto; -webkit-overflow-scrolling:touch; gap:8px;">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:6px;">
        <h3 id="classModalTitle" style="font-size:0.95rem;">🦸 Cadastrar / Editar Personagem</h3>
        <button class="btn-danger" onclick="AdminApp.closeModal('classModal')">✕ Fechar</button>
      </div>
      <input type="hidden" id="classEditIdInput" value="" />
      <input type="hidden" id="classCodeInput" value="" />
      <input type="hidden" id="classAssetKeyInput" value="" />
      <input type="hidden" id="classRebornAssetKeyInput" value="" />

      <div style="display:grid; grid-template-columns:1.2fr 1fr 1fr 1fr 0.9fr; gap:6px;">
        <input type="text" id="classNameInput" placeholder="Nome da Classe / Personagem" style="padding:6px 8px; font-size:0.84rem;" />
        <select id="classRaceSelect" style="padding:6px 8px; font-size:0.84rem;"></select>
        <select id="classCombatStyleSelect" onchange="AdminApp.onCombatStyleChange('class')" style="padding:6px 8px; font-size:0.84rem;" title="Estilo de Combate">
          <option value="MELEE">⚔️ Melee (Corpo a Corpo)</option>
          <option value="RANGED">🏹 Ranged (À Distância)</option>
        </select>
        <select id="classDamageTypeSelect" style="padding:6px 8px; font-size:0.84rem;" title="Tipo de Dano do Ataque Básico">
          <option value="PHYSICAL">🗡️ Dano Físico</option>
          <option value="MAGICAL">🔮 Dano Mágico</option>
        </select>
        <div style="display:flex; align-items:center; gap:4px;">
          <label style="font-size:0.7rem; color:var(--text-muted); white-space:nowrap;">Alcance:</label>
          <input type="number" id="classAttackRangeInput" min="20" max="600" value="60" style="padding:6px 6px; font-size:0.84rem; width:100%;" title="Distância padrão de alcance do ataque (pixels)" />
        </div>
      </div>

      <!-- 5 ABAS DO MODAL COM DESTAQUE CLARO PARA ATRIBUTOS E HABILIDADES -->
      <div style="display:flex; gap:6px; overflow-x:auto; padding:4px 0; border-bottom:1px solid var(--border); margin-bottom:4px;">
        <button id="btnClassTabVisual" class="btn-primary" onclick="AdminApp.switchClassModalTab('visual')" style="flex:1; padding:7px 6px; font-size:0.78rem; font-weight:700; white-space:nowrap;">
          🎨 Visual & Posição 2.5D
        </button>
        <button id="btnClassTabStats" onclick="AdminApp.switchClassModalTab('stats')" style="flex:1; padding:7px 6px; font-size:0.78rem; font-weight:700; white-space:nowrap; border:1px solid #38bdf8;">
          📊 Atributos & Combate
        </button>
        <button id="btnClassTabSkills" onclick="AdminApp.switchClassModalTab('skills')" style="flex:1; padding:7px 6px; font-size:0.78rem; font-weight:700; white-space:nowrap; border:1px solid #fde047;">
          ⚡ Habilidades
        </button>
        <button id="btnClassTabReborn" onclick="AdminApp.switchClassModalTab('reborn')" style="flex:1; padding:7px 6px; font-size:0.78rem; font-weight:700; white-space:nowrap;">
          ✨ Visual Reborn
        </button>
        <button id="btnClassTabDesc" onclick="AdminApp.switchClassModalTab('desc')" style="flex:1; padding:7px 6px; font-size:0.78rem; font-weight:700; white-space:nowrap;">
          📜 Lore / i18n
        </button>
      </div>

      <!-- ABA 1: VISUAL PADRÃO COM PALCO DO MAPA #1 REAL E CALIBRAÇÃO DE SOMBRA -->
      <div id="classTabVisual" style="display:flex; flex-direction:column; gap:8px;">
        <div id="classHeroCard" style="display:flex; flex-wrap:wrap; align-items:stretch; gap:10px; background:rgba(15,23,42,0.85); border:1.5px solid var(--accent); border-radius:10px; padding:8px 10px;">
          <div style="display:flex; flex-direction:column; gap:4px; align-items:center;">
            <canvas id="classMap1PreviewCanvas" width="320" height="170" style="width:320px; height:170px; max-width:100%; border-radius:8px; border:1px solid #38bdf8; cursor:grab; background:#020617;"></canvas>
            <div style="display:flex; gap:4px; flex-wrap:wrap; justify-content:center;">
              <button type="button" id="btnClassAct0" class="btn-primary" onclick="AdminApp.setClassPreviewAction(0)" style="padding:2px 7px; font-size:0.7rem;">🧍 Parado</button>
              <button type="button" id="btnClassAct1" onclick="AdminApp.setClassPreviewAction(1)" style="padding:2px 7px; font-size:0.7rem;">🏃 Andar</button>
              <button type="button" id="btnClassAct3" onclick="AdminApp.setClassPreviewAction(3)" style="padding:2px 7px; font-size:0.7rem;">🗡️ Golpe</button>
              <button type="button" onclick="AdminApp.rotateClassPreviewDir()" style="padding:2px 7px; font-size:0.7rem;">🔄 Girar</button>
              <button type="button" onclick="AdminApp.resetClassPreviewPan()" title="Centralizar no Spawn do Mapa #1" style="padding:2px 6px; font-size:0.7rem;">🎯 Spawn</button>
            </div>
          </div>

          <div style="flex:1; min-width:230px; display:flex; flex-direction:column; justify-content:space-between; gap:5px;">
            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
              <strong id="classHeroLabel" style="font-size:0.88rem; color:#fde047;">Selecione um Modelo</strong>
              <span id="classHeroBadge" style="font-size:0.7rem; padding:1px 6px; border-radius:99px; background:rgba(56,189,248,0.2); color:var(--accent); font-weight:700;"></span>
            </div>

            <!-- Calibragem de Distância do Modelo em relação ao Chão -->
            <div style="background:rgba(2,6,23,0.65); border:1px solid var(--border); border-radius:6px; padding:5px 7px;">
              <span style="font-size:0.7rem; color:#fde047; font-weight:700; display:block; margin-bottom:3px;">📏 Posição do Modelo ao Chão (Ground Offset Y):</span>
              <div style="display:flex; align-items:center; gap:3px; flex-wrap:wrap;">
                <button type="button" onclick="AdminApp.adjustGroundOffset(-5)" style="padding:2px 6px; font-size:0.72rem;">⬆ -5</button>
                <button type="button" onclick="AdminApp.adjustGroundOffset(-1)" style="padding:2px 6px; font-size:0.72rem;">⬆ -1</button>
                <input type="number" id="classGroundOffsetYInput" value="0" min="-80" max="80" oninput="AdminApp.updateGroundOffsetPreview()" style="width:52px; text-align:center; padding:2px; font-size:0.78rem;" />
                <button type="button" onclick="AdminApp.adjustGroundOffset(1)" style="padding:2px 6px; font-size:0.72rem;">+1 ⬇</button>
                <button type="button" onclick="AdminApp.adjustGroundOffset(5)" style="padding:2px 6px; font-size:0.72rem;">+5 ⬇</button>
                <button type="button" onclick="AdminApp.resetGroundOffset()" title="Zerar" style="padding:2px 5px; font-size:0.7rem;">↩0</button>
              </div>
            </div>

            <!-- Calibragem de Posição da Sombra (X e Y) -->
            <div style="background:rgba(2,6,23,0.65); border:1px solid var(--border); border-radius:6px; padding:5px 7px; display:flex; flex-direction:column; gap:4px;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:0.7rem; color:#38bdf8; font-weight:700;">🌑 Alinhamento da Sombra (X / Y):</span>
                <button type="button" onclick="AdminApp.resetShadowOffset()" style="padding:1px 6px; font-size:0.66rem;">↩ Zerar Sombra</button>
              </div>
              <div style="display:flex; align-items:center; gap:3px; flex-wrap:wrap;">
                <span style="font-size:0.68rem; color:var(--text-muted); width:40px;">Eixo X:</span>
                <button type="button" onclick="AdminApp.adjustShadowOffset('X', -5)" style="padding:2px 5px; font-size:0.7rem;">⬅-5</button>
                <button type="button" onclick="AdminApp.adjustShadowOffset('X', -1)" style="padding:2px 5px; font-size:0.7rem;">⬅-1</button>
                <input type="number" id="classShadowOffsetXInput" value="0" min="-80" max="80" oninput="AdminApp.updateGroundOffsetPreview()" style="width:46px; text-align:center; padding:2px; font-size:0.75rem;" />
                <button type="button" onclick="AdminApp.adjustShadowOffset('X', 1)" style="padding:2px 5px; font-size:0.7rem;">+1➡</button>
                <button type="button" onclick="AdminApp.adjustShadowOffset('X', 5)" style="padding:2px 5px; font-size:0.7rem;">+5➡</button>
              </div>
              <div style="display:flex; align-items:center; gap:3px; flex-wrap:wrap;">
                <span style="font-size:0.68rem; color:var(--text-muted); width:40px;">Eixo Y:</span>
                <button type="button" onclick="AdminApp.adjustShadowOffset('Y', -5)" style="padding:2px 5px; font-size:0.7rem;">⬆-5</button>
                <button type="button" onclick="AdminApp.adjustShadowOffset('Y', -1)" style="padding:2px 5px; font-size:0.7rem;">⬆-1</button>
                <input type="number" id="classShadowOffsetYInput" value="0" min="-80" max="80" oninput="AdminApp.updateGroundOffsetPreview()" style="width:46px; text-align:center; padding:2px; font-size:0.75rem;" />
                <button type="button" onclick="AdminApp.adjustShadowOffset('Y', 1)" style="padding:2px 5px; font-size:0.7rem;">+1⬇</button>
                <button type="button" onclick="AdminApp.adjustShadowOffset('Y', 5)" style="padding:2px 5px; font-size:0.7rem;">+5⬇</button>
              </div>
            </div>

            <span id="classGroundStatusBadge" style="font-size:0.7rem; color:#86efac; font-weight:600;">🟢 Pés no solo (0px)</span>
          </div>
        </div>

        <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
          <input type="text" id="classSearchInput" placeholder="🔍 Buscar modelo padrão..." oninput="AdminApp.filterClassGallery()" style="flex:1; min-width:140px; padding:6px 8px; font-size:0.8rem;" />
          <div style="display:flex; gap:3px;">
            <button id="btnClassFilterAll" class="active-tool" onclick="AdminApp.setClassGenderFilter('ALL')" style="padding:4px 6px; font-size:0.74rem;">Todos (<span id="classCountBadge">46</span>)</button>
            <button id="btnClassFilterMale" onclick="AdminApp.setClassGenderFilter('MALE')" style="padding:4px 6px; font-size:0.74rem;">👨 Masc</button>
            <button id="btnClassFilterFemale" onclick="AdminApp.setClassGenderFilter('FEMALE')" style="padding:4px 6px; font-size:0.74rem;">👩 Fem</button>
          </div>
        </div>
        <div id="mcreworkCharsGrid" class="gallery-grid" style="max-height:42vh; min-height:200px;"></div>
      </div>

      <!-- ABA 2: VISUAL REENCARNADO COM PALCO DO MAPA #1 REAL E CALIBRAÇÃO DE SOMBRA -->
      <div id="classTabReborn" style="display:none; flex-direction:column; gap:8px;">
        <div style="display:flex; flex-wrap:wrap; align-items:stretch; gap:10px; background:rgba(15,23,42,0.85); border:1.5px solid #c084fc; border-radius:10px; padding:8px 10px;">
          <div style="display:flex; flex-direction:column; gap:4px; align-items:center;">
            <canvas id="classRebornMap1PreviewCanvas" width="320" height="170" style="width:320px; height:170px; max-width:100%; border-radius:8px; border:1px solid #c084fc; cursor:grab; background:#020617;"></canvas>
            <div style="display:flex; gap:4px; flex-wrap:wrap; justify-content:center;">
              <button type="button" onclick="AdminApp.setClassPreviewAction(0)" style="padding:2px 7px; font-size:0.7rem;">🧍 Parado</button>
              <button type="button" onclick="AdminApp.setClassPreviewAction(1)" style="padding:2px 7px; font-size:0.7rem;">🏃 Andar</button>
              <button type="button" onclick="AdminApp.setClassPreviewAction(3)" style="padding:2px 7px; font-size:0.7rem;">🗡️ Golpe</button>
              <button type="button" onclick="AdminApp.rotateClassPreviewDir()" style="padding:2px 7px; font-size:0.7rem;">🔄 Girar</button>
              <button type="button" onclick="AdminApp.resetClassPreviewPan()" style="padding:2px 6px; font-size:0.7rem;">🎯 Spawn</button>
            </div>
          </div>

          <div style="flex:1; min-width:230px; display:flex; flex-direction:column; justify-content:space-between; gap:5px;">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:4px;">
              <strong id="classRebornHeroLabel" style="font-size:0.86rem; color:#e9d5ff;">Sem Visual Reborn</strong>
              <button type="button" class="btn-danger" onclick="AdminApp.clearRebornVisual()" style="padding:2px 6px; font-size:0.7rem;">✕ Limpar</button>
            </div>
            <div id="classRebornHeroBadge" style="font-size:0.68rem; color:var(--text-muted);">Toque em um modelo abaixo para vincular</div>

            <!-- Calibragem de Distância Reborn ao Chão -->
            <div style="background:rgba(2,6,23,0.65); border:1px solid var(--border); border-radius:6px; padding:5px 7px;">
              <span style="font-size:0.7rem; color:#e9d5ff; font-weight:700; display:block; margin-bottom:3px;">📏 Posição Reborn ao Chão (Offset Y):</span>
              <div style="display:flex; align-items:center; gap:3px; flex-wrap:wrap;">
                <button type="button" onclick="AdminApp.adjustRebornGroundOffset(-5)" style="padding:2px 6px; font-size:0.72rem;">⬆ -5</button>
                <button type="button" onclick="AdminApp.adjustRebornGroundOffset(-1)" style="padding:2px 6px; font-size:0.72rem;">⬆ -1</button>
                <input type="number" id="classRebornGroundOffsetYInput" value="0" min="-80" max="80" oninput="AdminApp.updateGroundOffsetPreview()" style="width:52px; text-align:center; padding:2px; font-size:0.78rem;" />
                <button type="button" onclick="AdminApp.adjustRebornGroundOffset(1)" style="padding:2px 6px; font-size:0.72rem;">+1 ⬇</button>
                <button type="button" onclick="AdminApp.adjustRebornGroundOffset(5)" style="padding:2px 6px; font-size:0.72rem;">+5 ⬇</button>
                <button type="button" onclick="AdminApp.resetRebornGroundOffset()" title="Zerar" style="padding:2px 5px; font-size:0.7rem;">↩0</button>
              </div>
            </div>

            <!-- Calibragem de Sombra Reborn (X e Y) -->
            <div style="background:rgba(2,6,23,0.65); border:1px solid var(--border); border-radius:6px; padding:5px 7px; display:flex; flex-direction:column; gap:4px;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:0.7rem; color:#c084fc; font-weight:700;">🌑 Sombra Reborn (X / Y):</span>
                <button type="button" onclick="AdminApp.resetRebornShadowOffset()" style="padding:1px 6px; font-size:0.66rem;">↩ Zerar Sombra</button>
              </div>
              <div style="display:flex; align-items:center; gap:3px; flex-wrap:wrap;">
                <span style="font-size:0.68rem; color:var(--text-muted); width:40px;">Eixo X:</span>
                <button type="button" onclick="AdminApp.adjustRebornShadowOffset('X', -5)" style="padding:2px 5px; font-size:0.7rem;">⬅-5</button>
                <button type="button" onclick="AdminApp.adjustRebornShadowOffset('X', -1)" style="padding:2px 5px; font-size:0.7rem;">⬅-1</button>
                <input type="number" id="classRebornShadowOffsetXInput" value="0" min="-80" max="80" oninput="AdminApp.updateGroundOffsetPreview()" style="width:46px; text-align:center; padding:2px; font-size:0.75rem;" />
                <button type="button" onclick="AdminApp.adjustRebornShadowOffset('X', 1)" style="padding:2px 5px; font-size:0.7rem;">+1➡</button>
                <button type="button" onclick="AdminApp.adjustRebornShadowOffset('X', 5)" style="padding:2px 5px; font-size:0.7rem;">+5➡</button>
              </div>
              <div style="display:flex; align-items:center; gap:3px; flex-wrap:wrap;">
                <span style="font-size:0.68rem; color:var(--text-muted); width:40px;">Eixo Y:</span>
                <button type="button" onclick="AdminApp.adjustRebornShadowOffset('Y', -5)" style="padding:2px 5px; font-size:0.7rem;">⬆-5</button>
                <button type="button" onclick="AdminApp.adjustRebornShadowOffset('Y', -1)" style="padding:2px 5px; font-size:0.7rem;">⬆-1</button>
                <input type="number" id="classRebornShadowOffsetYInput" value="0" min="-80" max="80" oninput="AdminApp.updateGroundOffsetPreview()" style="width:46px; text-align:center; padding:2px; font-size:0.75rem;" />
                <button type="button" onclick="AdminApp.adjustRebornShadowOffset('Y', 1)" style="padding:2px 5px; font-size:0.7rem;">+1⬇</button>
                <button type="button" onclick="AdminApp.adjustRebornShadowOffset('Y', 5)" style="padding:2px 5px; font-size:0.7rem;">+5⬇</button>
              </div>
            </div>

            <span id="classRebornGroundStatusBadge" style="font-size:0.7rem; color:#c084fc; font-weight:600;">🟢 Pés no solo (0px)</span>
          </div>
        </div>
        <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
          <input type="text" id="classRebornSearchInput" placeholder="🔍 Buscar modelo para reencarnação..." oninput="AdminApp.filterClassRebornGallery()" style="flex:1; min-width:180px; padding:6px 10px; font-size:0.82rem;" />
        </div>
        <div id="mcreworkCharsRebornGrid" class="gallery-grid" style="max-height:42vh; min-height:200px;"></div>
      </div>

      <!-- ABA 3: DESCRIÇÃO & LORE -->
      <div id="classTabDesc" style="display:none; flex-direction:column; gap:8px;">
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.76rem;">
          <label style="color:var(--text-muted); font-weight:600;">📜 Descrição do Personagem (PT-BR):</label>
          <span id="classDescI18nDisplay" style="color:var(--accent); font-family:monospace; font-size:0.72rem;">class.class_X.description</span>
        </div>
        <textarea id="classDescriptionInput" rows="5" placeholder="Digite uma descrição ou história sobre a classe/personagem..." style="width:100%; padding:8px; font-size:0.84rem; resize:vertical;"></textarea>
      </div>

      <!-- ABA 4: CONFIGURAÇÃO DE ATRIBUTOS BASE & COMBATE DERIVADO EM TEMPO REAL -->
      <div id="classTabStats" style="display:none; flex-direction:column; gap:12px; padding:4px;">
        <!-- Bloco 1: Atributos Base Nv. 1 -->
        <div class="field" style="background:rgba(15,23,42,0.65); padding:10px; border-radius:8px; border:1px solid var(--border);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; flex-wrap:wrap; gap:4px;">
            <label style="color:#fde047; font-weight:700;">1️⃣ Atributos Base Iniciais Nv.1 (VIT / STR / INT / WIS / AGI / DEX)</label>
            <span id="classTotalBasePointsBadge" style="font-size:0.72rem; color:var(--accent); font-weight:700; background:rgba(56,189,248,0.15); padding:2px 8px; border-radius:4px; border:1px solid #38bdf8;">Total: 64 pts</span>
          </div>
          <div style="display:grid; grid-template-columns:repeat(6, 1fr); gap:6px;">
            <div><label style="font-size:0.7rem; color:var(--text-muted); font-weight:700;">VIT (Vida)</label><input type="number" id="classBaseVIT" value="12" min="1" oninput="AdminApp.updateClassCombatStatsPreview()" /></div>
            <div><label style="font-size:0.7rem; color:var(--text-muted); font-weight:700;">STR (Força)</label><input type="number" id="classBaseSTR" value="12" min="1" oninput="AdminApp.updateClassCombatStatsPreview()" /></div>
            <div><label style="font-size:0.7rem; color:var(--text-muted); font-weight:700;">INT (Intelig.)</label><input type="number" id="classBaseINT" value="10" min="1" oninput="AdminApp.updateClassCombatStatsPreview()" /></div>
            <div><label style="font-size:0.7rem; color:var(--text-muted); font-weight:700;">WIS (Sabed.)</label><input type="number" id="classBaseWIS" value="10" min="1" oninput="AdminApp.updateClassCombatStatsPreview()" /></div>
            <div><label style="font-size:0.7rem; color:var(--text-muted); font-weight:700;">AGI (Agilid.)</label><input type="number" id="classBaseAGI" value="10" min="1" oninput="AdminApp.updateClassCombatStatsPreview()" /></div>
            <div><label style="font-size:0.7rem; color:var(--text-muted); font-weight:700;">DEX (Destr.)</label><input type="number" id="classBaseDEX" value="10" min="1" oninput="AdminApp.updateClassCombatStatsPreview()" /></div>
          </div>
        </div>

        <!-- Bloco 2: Crescimento por Nível -->
        <div class="field" style="background:rgba(15,23,42,0.65); padding:10px; border-radius:8px; border:1px solid var(--border);">
          <label style="color:#86efac; font-weight:700; margin-bottom:6px;">2️⃣ Crescimento Automático Ganho a Cada Nível (+Atributo/Nv)</label>
          <div style="display:grid; grid-template-columns:repeat(6, 1fr); gap:6px;">
            <div><label style="font-size:0.7rem; color:#86efac;">+VIT/Nv</label><input type="number" id="classGrowVIT" value="2" min="0" oninput="AdminApp.updateClassCombatStatsPreview()" /></div>
            <div><label style="font-size:0.7rem; color:#86efac;">+STR/Nv</label><input type="number" id="classGrowSTR" value="2" min="0" oninput="AdminApp.updateClassCombatStatsPreview()" /></div>
            <div><label style="font-size:0.7rem; color:#86efac;">+INT/Nv</label><input type="number" id="classGrowINT" value="2" min="0" oninput="AdminApp.updateClassCombatStatsPreview()" /></div>
            <div><label style="font-size:0.7rem; color:#86efac;">+WIS/Nv</label><input type="number" id="classGrowWIS" value="2" min="0" oninput="AdminApp.updateClassCombatStatsPreview()" /></div>
            <div><label style="font-size:0.7rem; color:#86efac;">+AGI/Nv</label><input type="number" id="classGrowAGI" value="2" min="0" oninput="AdminApp.updateClassCombatStatsPreview()" /></div>
            <div><label style="font-size:0.7rem; color:#86efac;">+DEX/Nv</label><input type="number" id="classGrowDEX" value="2" min="0" oninput="AdminApp.updateClassCombatStatsPreview()" /></div>
          </div>
        </div>

        <!-- Bloco 2.5: Atributos de Combate Iniciais da Classe (Piso Não-Derivado) -->
        <div class="field" style="background:rgba(15,23,42,0.65); padding:10px; border-radius:8px; border:1px solid #38bdf8;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <label style="color:#38bdf8; font-weight:700; margin:0;">⚙️ Atributos Base de Combate da Classe (Piso Fixo Não-Derivado)</label>
            <span style="font-size:0.7rem; color:#94a3b8;">Teto máx. de velocidade em arena: +40%</span>
          </div>
          <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:6px;">
            <div><label style="font-size:0.7rem; color:#38bdf8;">🏃 Vel. Batalha (px/s)</label><input type="number" id="classBaseCombatMoveSpeed" value="180" min="100" max="300" oninput="AdminApp.updateClassCombatStatsPreview()" /></div>
            <div><label style="font-size:0.7rem; color:#38bdf8;">⚔️ Vel. Ataque (atks/s)</label><input type="number" id="classBaseCombatAttackSpeed" value="1.0" step="0.1" min="0.5" max="3.0" oninput="AdminApp.updateClassCombatStatsPreview()" /></div>
            <div><label style="font-size:0.7rem; color:#38bdf8;">🎯 Precisão Física</label><input type="number" id="classBaseCombatPhysAcc" value="100" min="0" oninput="AdminApp.updateClassCombatStatsPreview()" /></div>
            <div><label style="font-size:0.7rem; color:#38bdf8;">💨 Desvio Físico</label><input type="number" id="classBaseCombatPhysEva" value="10" min="0" oninput="AdminApp.updateClassCombatStatsPreview()" /></div>
            <div><label style="font-size:0.7rem; color:#38bdf8;">🔮 Precisão Mágica</label><input type="number" id="classBaseCombatMagAcc" value="100" min="0" oninput="AdminApp.updateClassCombatStatsPreview()" /></div>
            <div><label style="font-size:0.7rem; color:#38bdf8;">✨ Desvio Mágico</label><input type="number" id="classBaseCombatMagEva" value="10" min="0" oninput="AdminApp.updateClassCombatStatsPreview()" /></div>
            <div><label style="font-size:0.7rem; color:#38bdf8;">💥 Taxa Crítica (%)</label><input type="number" id="classBaseCombatCritRate" value="5" min="0" max="100" oninput="AdminApp.updateClassCombatStatsPreview()" /></div>
            <div><label style="font-size:0.7rem; color:#38bdf8;">⚡ Dano Crítico (%)</label><input type="number" id="classBaseCombatCritDmg" value="150" min="100" oninput="AdminApp.updateClassCombatStatsPreview()" /></div>
          </div>
        </div>

        <!-- Bloco 3: Painel de Atributos Derivados em Tempo Real -->
        <div style="background:rgba(2,6,23,0.85); border:1.5px solid #38bdf8; border-radius:10px; padding:12px; display:flex; flex-direction:column; gap:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; border-bottom:1px solid var(--border); padding-bottom:8px;">
            <div>
              <strong style="color:#38bdf8; font-size:0.9rem;">⚡ Ficha de Combate Derivada em Tempo Real</strong>
              <div style="font-size:0.72rem; color:var(--text-muted); margin-top:2px;">
                Calculada automaticamente pela Matriz Procedural conforme você altera os atributos base e o nível simulado.
              </div>
            </div>
            <!-- Seletor de Nível de Simulação -->
            <div style="display:flex; align-items:center; gap:5px; background:rgba(15,23,42,0.9); padding:4px 8px; border-radius:6px; border:1px solid var(--border);">
              <span style="font-size:0.72rem; color:var(--text-muted); font-weight:600;">Simular Nível:</span>
              <input type="number" id="classSimLevelInput" value="1" min="1" max="150" oninput="AdminApp.updateClassCombatStatsPreview()" style="width:50px; text-align:center; padding:2px 4px; font-size:0.78rem; font-weight:700; color:#fde047;" />
              <div style="display:flex; gap:2px;">
                <button type="button" onclick="AdminApp.setClassSimLevel(1)" style="padding:2px 5px; font-size:0.68rem;">Nv 1</button>
                <button type="button" onclick="AdminApp.setClassSimLevel(10)" style="padding:2px 5px; font-size:0.68rem;">Nv 10</button>
                <button type="button" onclick="AdminApp.setClassSimLevel(50)" style="padding:2px 5px; font-size:0.68rem;">Nv 50</button>
                <button type="button" onclick="AdminApp.setClassSimLevel(100)" style="padding:2px 5px; font-size:0.68rem;">Nv 100</button>
              </div>
            </div>
          </div>

          <!-- Container das 6 Famílias de Combate -->
          <div id="classCombatStatsPreviewContainer" style="display:flex; flex-direction:column; gap:10px; max-height:360px; overflow-y:auto; -webkit-overflow-scrolling:touch; padding-right:4px;"></div>
        </div>
      </div>

      <!-- ABA 5: HABILIDADES DESTE PERSONAGEM (VÍNCULO DA TABELA DE HABILIDADES) -->
      <div id="classTabSkills" style="display:none; flex-direction:column; gap:10px; padding:4px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px; background:rgba(15,23,42,0.85); padding:8px 10px; border-radius:8px; border:1px solid var(--border);">
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <strong style="font-size:0.85rem; color:#fde047;">⚡ Habilidades do Personagem:</strong>
              <span id="classSkillsSelectedCount" style="font-size:0.72rem; color:#38bdf8; font-weight:700; background:rgba(56,189,248,0.15); padding:1px 6px; border-radius:4px; border:1px solid #0284c7;">0 marcadas</span>
            </div>
            <div style="font-size:0.72rem; color:var(--text-muted); margin-top:2px;">
              Marque as habilidades que esta classe pode usar em batalha.
            </div>
          </div>
          <div style="display:flex; gap:4px; flex-wrap:wrap;">
            <button type="button" onclick="AdminApp.checkAllClassSkills(true)" style="padding:3px 8px; font-size:0.72rem;">☑️ Marcar Todas</button>
            <button type="button" onclick="AdminApp.checkAllClassSkills(false)" style="padding:3px 8px; font-size:0.72rem;">⏹️ Desmarcar</button>
            <button type="button" onclick="AdminApp.selectDefaultClassSkills()" style="padding:3px 8px; font-size:0.72rem; color:#fde047; font-weight:700;">⚡ Iniciais (1, 2, 4)</button>
          </div>
        </div>
        <div id="classSkillsChecklist" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(min(100%, 250px), 1fr)); gap:8px; max-height:300px; overflow-y:auto; overflow-x:hidden; padding:8px; background:#020617; border:1px solid var(--border); border-radius:8px; box-sizing:border-box;"></div>
      </div>

      <div style="border-top:1px solid var(--border); padding-top:8px;">
        <button class="btn-success" style="width:100%; padding:11px; font-weight:700;" onclick="AdminApp.saveClassTemplate()">
          💾 Salvar Personagem / Classe na Tabela
        </button>
      </div>
    </div>`;

    document.body.appendChild(modalDiv);
  }

  static attachHelpers(app) {
    app.setClassSimLevel = function (lvl) {
      const input = document.getElementById('classSimLevelInput');
      if (input) {
        input.value = String(lvl);
        this.updateClassCombatStatsPreview();
      }
    };

    /**
     * Calcula e renderiza os Atributos de Combate Derivados em Tempo Real
     * na aba 📊 Atributos & Combate do modal de Personagens.
     */
    app.updateClassCombatStatsPreview = function () {
      const container = document.getElementById('classCombatStatsPreviewContainer');
      if (!container) return;

      const baseVIT = Number(document.getElementById('classBaseVIT')?.value) || 0;
      const baseSTR = Number(document.getElementById('classBaseSTR')?.value) || 0;
      const baseINT = Number(document.getElementById('classBaseINT')?.value) || 0;
      const baseWIS = Number(document.getElementById('classBaseWIS')?.value) || 0;
      const baseAGI = Number(document.getElementById('classBaseAGI')?.value) || 0;
      const baseDEX = Number(document.getElementById('classBaseDEX')?.value) || 0;

      const growVIT = Number(document.getElementById('classGrowVIT')?.value) || 0;
      const growSTR = Number(document.getElementById('classGrowSTR')?.value) || 0;
      const growINT = Number(document.getElementById('classGrowINT')?.value) || 0;
      const growWIS = Number(document.getElementById('classGrowWIS')?.value) || 0;
      const growAGI = Number(document.getElementById('classGrowAGI')?.value) || 0;
      const growDEX = Number(document.getElementById('classGrowDEX')?.value) || 0;

      const simLevel = Math.max(1, Number(document.getElementById('classSimLevelInput')?.value) || 1);
      const levelMult = simLevel - 1;

      const effAttrs = {
        VIT: baseVIT + levelMult * growVIT,
        STR: baseSTR + levelMult * growSTR,
        INT: baseINT + levelMult * growINT,
        WIS: baseWIS + levelMult * growWIS,
        AGI: baseAGI + levelMult * growAGI,
        DEX: baseDEX + levelMult * growDEX,
      };

      const totalBaseLv1 = baseVIT + baseSTR + baseINT + baseWIS + baseAGI + baseDEX;
      const totalEff = effAttrs.VIT + effAttrs.STR + effAttrs.INT + effAttrs.WIS + effAttrs.AGI + effAttrs.DEX;
      const pointsBadge = document.getElementById('classTotalBasePointsBadge');
      if (pointsBadge) {
        pointsBadge.innerHTML = `Nv.1: <strong>${totalBaseLv1} pts</strong> ${simLevel > 1 ? `➔ Nv.${simLevel}: <strong>${totalEff} pts</strong>` : ''}`;
      }

      const customCombatBases = {
        BATTLE_MOVE_SPEED: Number(document.getElementById('classBaseCombatMoveSpeed')?.value) || 180,
        ATTACK_SPEED: Number(document.getElementById('classBaseCombatAttackSpeed')?.value) || 1.0,
        PHYS_ACCURACY: Number(document.getElementById('classBaseCombatPhysAcc')?.value) || 100,
        PHYS_EVASION: Number(document.getElementById('classBaseCombatPhysEva')?.value) || 10,
        MAG_ACCURACY: Number(document.getElementById('classBaseCombatMagAcc')?.value) || 100,
        MAG_EVASION: Number(document.getElementById('classBaseCombatMagEva')?.value) || 10,
        CRIT_RATE: (Number(document.getElementById('classBaseCombatCritRate')?.value) || 5) / 100,
        CRIT_DMG: (Number(document.getElementById('classBaseCombatCritDmg')?.value) || 150) / 100,
      };

      const combatMap = typeof this.calculateCombatAttributes === 'function'
        ? this.calculateCombatAttributes(effAttrs, customCombatBases)
        : {};

      const families = [
        { id: 'vitais', title: '💚 Recursos Vitais & Suporte', borderColor: '#22c55e', bgColor: 'rgba(34,197,94,0.06)', stats: ['MAX_HP', 'MAX_MP', 'HEAL_POWER', 'MP_REGEN'] },
        { id: 'combate', title: '🗡️ Poder Físico & Mágico', borderColor: '#ef4444', bgColor: 'rgba(239,68,68,0.06)', stats: ['PHYS_ATK', 'MAG_ATK', 'PHYS_DEF', 'MAG_DEF', 'PHYS_PEN', 'MAG_PEN'] },
        { id: 'iniciativa', title: '⚡ Velocidade & Crítico Action', borderColor: '#f59e0b', bgColor: 'rgba(245,158,11,0.06)', stats: ['BATTLE_MOVE_SPEED', 'ATTACK_SPEED', 'CRIT_RATE', 'CRIT_DMG'] },
        { id: 'acerto_desvio', title: '🎯 Acerto & Desvio Convencional', borderColor: '#38bdf8', bgColor: 'rgba(56,189,248,0.06)', stats: ['PHYS_ACCURACY', 'PHYS_EVASION', 'MAG_ACCURACY', 'MAG_EVASION'] },
        { id: 'controle', title: '💫 Família de Controle (Hard CC)', subtitle: 'Paralisia, Sono, Confusão, Silêncio, Congelamento', borderColor: '#c084fc', bgColor: 'rgba(192,132,252,0.08)', stats: ['CONTROL_HIT', 'CONTROL_RESIST'] },
        { id: 'anomalias', title: '🧪 Família de Anomalias & DoT', subtitle: 'Veneno, Queimadura, Sangramento, Cegueira', borderColor: '#f43f5e', bgColor: 'rgba(244,63,94,0.08)', stats: ['ANOMALY_HIT', 'ANOMALY_RESIST'] },
      ];

      container.innerHTML = families
        .map((fam) => {
          const statsCards = fam.stats
            .map((code) => {
              const item = combatMap[code];
              if (!item) return '';

              const isPct = Boolean(item.isPercentage);
              const valFormatted = isPct
                ? `${(item.value * 100).toFixed(1)}%`
                : `${Math.round(item.value * 10) / 10}`;

              const baseFormatted = isPct
                ? `${(item.baseDefault * 100).toFixed(1)}%`
                : `${item.baseDefault}`;

              const bonusFormatted = isPct
                ? `+${(item.bonusFromAttrs * 100).toFixed(2)}%`
                : `+${Math.round(item.bonusFromAttrs * 10) / 10}`;

              return `
              <div style="background:rgba(15,23,42,0.9); border:1px solid var(--border); border-radius:6px; padding:6px 8px; display:flex; flex-direction:column; justify-content:space-between; gap:2px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <span style="font-size:0.73rem; color:#f1f5f9; font-weight:600;">${item.namePtBr}</span>
                  <code style="font-size:0.65rem; color:var(--text-muted);">${item.code}</code>
                </div>
                <div style="display:flex; align-items:baseline; justify-content:space-between; margin-top:2px;">
                  <span style="font-size:0.95rem; font-weight:800; color:#fde047;">${valFormatted}</span>
                  <span style="font-size:0.67rem; color:var(--text-muted);" title="Base padrão + bônus derivado dos atributos base">
                    Base: ${baseFormatted} <span style="color:#86efac; font-weight:700;">(${bonusFormatted})</span>
                  </span>
                </div>
              </div>`;
            })
            .join('');

          return `
          <div style="background:${fam.bgColor}; border:1px solid ${fam.borderColor}; border-radius:8px; padding:8px 10px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <span style="font-size:0.78rem; font-weight:700; color:#f8fafc;">${fam.title}</span>
              ${fam.subtitle ? `<span style="font-size:0.68rem; color:var(--text-muted);">${fam.subtitle}</span>` : ''}
            </div>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:6px;">
              ${statsCards}
            </div>
          </div>`;
        })
        .join('');
    };

    app.checkAllClassSkills = function (check) {
      const box = document.getElementById('classSkillsChecklist');
      if (!box) return;
      box.querySelectorAll('input.entity-skill-checkbox').forEach((cb) => {
        cb.checked = Boolean(check);
      });
    };

    app.selectDefaultClassSkills = function () {
      const box = document.getElementById('classSkillsChecklist');
      if (!box) return;
      const defaultSet = new Set([1, 2, 4]);
      box.querySelectorAll('input.entity-skill-checkbox').forEach((cb) => {
        cb.checked = defaultSet.has(Number(cb.value));
      });
    };

    app.onCombatStyleChange = function (prefix) {
      const styleSelect = document.getElementById(`${prefix}CombatStyleSelect`);
      const rangeInput = document.getElementById(`${prefix}AttackRangeInput`);
      if (!styleSelect || !rangeInput) return;
      const isRanged = styleSelect.value === 'RANGED';
      const cur = Number(rangeInput.value) || 0;
      if (isRanged && (cur === 60 || cur === 52 || cur === 55 || cur === 0)) {
        rangeInput.value = '220';
      } else if (!isRanged && cur === 220) {
        rangeInput.value = '60';
      }
    };
  }
}

window.AdminClassModalTemplate = AdminClassModalTemplate;
