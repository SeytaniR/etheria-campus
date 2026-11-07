/**
 * @file apps/server/public/admin/js/AdminClassModalTemplate.js
 * @module @etheria/server
 * @description Injeção de Template HTML para o Modal de Criação e Edição de Personagens (#classModal).
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

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
        <input type="text" id="classNameInput" placeholder="Nome da Classe / Personagem" style="padding:6px 8px; font-size:0.84rem;" />
        <select id="classRaceSelect" style="padding:6px 8px; font-size:0.84rem;"></select>
      </div>

      <!-- 5 ABAS DO MODAL (Incluindo ⚡ Habilidades e 📊 Atributos) -->
      <div style="display:flex; gap:4px; overflow-x:auto;">
        <button id="btnClassTabVisual" class="btn-primary" onclick="AdminApp.switchClassModalTab('visual')" style="flex:1; padding:6px 4px; font-size:0.75rem; white-space:nowrap;">
          🎨 Padrão (<span id="classCountBadge">46</span>)
        </button>
        <button id="btnClassTabReborn" onclick="AdminApp.switchClassModalTab('reborn')" style="flex:1; padding:6px 4px; font-size:0.75rem; white-space:nowrap;">
          ✨ Reborn
        </button>
        <button id="btnClassTabDesc" onclick="AdminApp.switchClassModalTab('desc')" style="flex:1; padding:6px 4px; font-size:0.75rem; white-space:nowrap;">
          📜 Lore / i18n
        </button>
        <button id="btnClassTabStats" onclick="AdminApp.switchClassModalTab('stats')" style="flex:1; padding:6px 4px; font-size:0.75rem; white-space:nowrap;">
          📊 Atributos & Combate
        </button>
        <button id="btnClassTabSkills" onclick="AdminApp.switchClassModalTab('skills')" style="flex:1; padding:6px 4px; font-size:0.75rem; white-space:nowrap;">
          ⚡ Habilidades
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
            <button id="btnClassFilterAll" class="active-tool" onclick="AdminApp.setClassGenderFilter('ALL')" style="padding:4px 6px; font-size:0.74rem;">Todos (46)</button>
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
        <div style="font-size:0.78rem; color:#fde047; font-weight:700;">
          ⚡ Selecione quais Habilidades da Tabela de Habilidades este Personagem possui:
        </div>
        <div id="classSkillsChecklist" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(210px, 1fr)); gap:6px; max-height:280px; overflow-y:auto; padding:8px; background:#020617; border:1px solid var(--border); border-radius:8px;"></div>
      </div>

      <div style="border-top:1px solid var(--border); padding-top:8px;">
        <button class="btn-success" style="width:100%; padding:11px; font-weight:700;" onclick="AdminApp.saveClassTemplate()">
          💾 Salvar Personagem / Classe na Tabela
        </button>
      </div>
    </div>`;

    document.body.appendChild(modalDiv);
  }
}

window.AdminClassModalTemplate = AdminClassModalTemplate;
