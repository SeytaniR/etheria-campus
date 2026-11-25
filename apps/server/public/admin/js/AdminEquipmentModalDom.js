/**
 * @file apps/server/public/admin/js/AdminEquipmentModalDom.js
 * @module @etheria/server
 * @description Injeção modular do DOM do Modal de Cadastro e Edição de Equipamentos e Armas (`item_templates`).
 *   - Layout 100% responsivo para Mobile Vertical (Portrait) e Desktop.
 *   - Equipamentos e armas concedem EXCLUSIVAMENTE bônus de combate na arena action (sem atributos base).
 *   - Remoção completa de valor em ouro (itens não comercializáveis pelo jogo).
 *   - 1.865 ícones e modelos da galeria mcrework com preenchimento em 1 clique.
 */

class AdminEquipmentModalDom {
  static injectModalDom() {
    if (document.getElementById('equipmentModal')) return;

    const modal = document.createElement('div');
    modal.id = 'equipmentModal';
    modal.className = 'modal-backdrop';
    modal.style.display = 'none';

    modal.innerHTML = `
      <div class="modal-box equip-modal-box" style="max-width:980px; width:96%; max-height:92vh; display:block; overflow-y:auto; -webkit-overflow-scrolling:touch; padding:14px; box-sizing:border-box;">
        <!-- Cabeçalho Fixo Responsivo -->
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:10px; margin-bottom:12px; gap:8px; flex-wrap:wrap;">
          <h3 id="equipModalTitle" style="color:#38bdf8; margin:0; font-size:1.05rem;">🛡️ Cadastrar / Editar Equipamento</h3>
          <div style="display:flex; gap:8px; align-items:center;">
            <button class="btn-success" onclick="AdminApp.saveEquipmentTemplate()" style="padding:7px 16px; font-weight:800; min-height:38px; border-radius:6px;">💾 Salvar</button>
            <button class="btn-danger" onclick="window.AdminEquipmentVisualPreview?.stop(); AdminApp.closeModal('equipmentModal')" style="padding:7px 12px; min-height:38px; border-radius:6px;">✕</button>
          </div>
        </div>

        <input type="hidden" id="equipEditIdInput" value="" />
        <input type="hidden" id="equipIconKeyInput" value="" />

        <!-- BLOCO 1: IDENTIDADE, SLOT & CLASSIFICAÇÃO -->
        <div style="background:rgba(15,23,42,0.85); border:1px solid #334155; border-radius:10px; padding:12px; margin-bottom:12px;">
          <div style="font-size:0.82rem; font-weight:700; color:#38bdf8; margin-bottom:8px;">
            1️⃣ Identidade, Slot de Equipamento & Classificação
          </div>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 170px), 1fr)); gap:10px;">
            <div class="field">
              <label>Nome do Equipamento (PT-BR) *</label>
              <input type="text" id="equipNameInput" placeholder="Ex: Espada Longa de Aço" />
            </div>
            <div class="field">
              <label>Código Único (opcional)</label>
              <input type="text" id="equipCodeInput" placeholder="Auto-gerado se vazio" />
            </div>
            <div class="field">
              <label>Categoria de Equipamento</label>
              <select id="equipCategorySelect">
                <option value="CHARACTER_EQUIPMENT">👤 Personagem (16 Slots)</option>
                <option value="PET_EQUIPMENT">🐾 Pet (6 Slots)</option>
              </select>
            </div>
            <div class="field">
              <label>Slot de Equipamento *</label>
              <select id="equipSlotSelect" onchange="AdminApp.onEquipmentSlotChange()"></select>
            </div>
            <div class="field">
              <label>Conjunto de Equipamentos</label>
              <select id="equipSetSelect">
                <option value="">Nenhum Conjunto</option>
              </select>
            </div>
            <div class="field">
              <label>Raridade</label>
              <select id="equipRaritySelect">
                <option value="SS">Rank SS (Mítico)</option>
                <option value="S">Rank S (Lendário)</option>
                <option value="A">Rank A (Épico)</option>
                <option value="B">Rank B (Raro)</option>
                <option value="C">Rank C (Incomum)</option>
                <option value="D">Rank D (Regular)</option>
                <option value="F">Rank F (Básico)</option>
              </select>
            </div>
            <div class="field">
              <label>Nível Mínimo Requerido</label>
              <input type="number" id="equipReqLevelInput" value="1" min="1" max="100" />
            </div>
            <div class="field">
              <label>Status</label>
              <select id="equipActiveSelect">
                <option value="true">🟢 Ativo (Visível no Jogo)</option>
                <option value="false">🔴 Inativo (Oculto)</option>
              </select>
            </div>
            <div class="field" style="grid-column: 1 / -1;">
              <label>Descrição / Lore em Português</label>
              <input type="text" id="equipDescriptionInput" placeholder="Ex: Forjada com ligas de ferro temperado em chamas de dragão..." />
            </div>
          </div>
        </div>

        <!-- BLOCO 1.5: VÍNCULO 2.5D ANIMADO & PALCO DE CALIBRAÇÃO (ASAS E MONTARIAS VOADORAS) -->
        <div id="equipVisual25dBox" style="display:none; background:rgba(14,116,144,0.14); border:1.5px solid #22d3ee; border-radius:12px; padding:12px; margin-bottom:12px;">
          <div style="font-size:0.84rem; font-weight:800; color:#22d3ee; margin-bottom:8px;">
            🪽 / 🦅 Vínculo, Tamanho & Calibração 2.5D (Asas & Montarias Voadoras)
          </div>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 300px), 1fr)); gap:12px; align-items:start;">
            <!-- Palco Canvas 2.5D (primeiro no mobile para feedback imediato ao tocar nos controles) -->
            <div style="background:rgba(2,6,23,0.92); border:1px solid #38bdf8; border-radius:10px; padding:8px; display:flex; flex-direction:column; gap:7px;">
              <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.74rem; color:#38bdf8; font-weight:700;">
                <span>🎮 Palco 2.5D ao Vivo</span>
                <span id="equipPreviewDirLabel" style="color:#fde047;">Sul (S)</span>
              </div>
              <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:4px;">
                <select id="equipPreviewMapSelect" onchange="window.AdminEquipmentVisualPreview?.syncMapImage(AdminApp)" style="font-size:0.70rem; padding:5px 4px; min-height:34px;"></select>
                <select id="equipPreviewClassSelect" onchange="window.AdminEquipmentVisualPreview?.renderNow(AdminApp)" style="font-size:0.70rem; padding:5px 4px; min-height:34px;"></select>
                <select id="equipPreviewPetSelect" onchange="window.AdminEquipmentVisualPreview?.renderNow(AdminApp)" style="font-size:0.70rem; padding:5px 4px; min-height:34px;"><option value="">🐾 Sem Pet</option></select>
              </div>
              <canvas id="equipVisualPreviewCanvas" width="380" height="240" style="width:100%; border-radius:8px; border:1px solid #1e293b; background:#0b1120; display:block;"></canvas>
              <div style="display:grid; grid-template-columns:1fr auto auto auto 1fr; gap:4px;">
                <button type="button" onclick="window.AdminEquipmentVisualPreview?.rotateDir(-1)" style="font-size:0.72rem; padding:6px 4px; min-height:34px;">◀ Girar</button>
                <button type="button" id="btnEquipPrevAct0" class="btn-primary" onclick="window.AdminEquipmentVisualPreview?.setAction(0)" style="font-size:0.70rem; padding:6px 7px; min-height:34px;">Parado</button>
                <button type="button" id="btnEquipPrevAct1" onclick="window.AdminEquipmentVisualPreview?.setAction(1)" style="font-size:0.70rem; padding:6px 7px; min-height:34px;">Andar</button>
                <button type="button" id="btnEquipPrevAct3" onclick="window.AdminEquipmentVisualPreview?.setAction(3)" style="font-size:0.70rem; padding:6px 7px; min-height:34px;">Atacar</button>
                <button type="button" onclick="window.AdminEquipmentVisualPreview?.rotateDir(1)" style="font-size:0.72rem; padding:6px 4px; min-height:34px;">Girar ▶</button>
              </div>
              <div style="display:grid; grid-template-columns:repeat(9, 1fr); gap:3px;">
                <button type="button" class="equip-dir-btn btn-primary" data-dir="0" onclick="window.AdminEquipmentVisualPreview?.setDir(0)" style="font-size:0.66rem; padding:4px 2px;">S</button>
                <button type="button" class="equip-dir-btn" data-dir="1" onclick="window.AdminEquipmentVisualPreview?.setDir(1)" style="font-size:0.66rem; padding:4px 2px;">SE</button>
                <button type="button" class="equip-dir-btn" data-dir="2" onclick="window.AdminEquipmentVisualPreview?.setDir(2)" style="font-size:0.66rem; padding:4px 2px;">L</button>
                <button type="button" class="equip-dir-btn" data-dir="3" onclick="window.AdminEquipmentVisualPreview?.setDir(3)" style="font-size:0.66rem; padding:4px 2px;">NE</button>
                <button type="button" class="equip-dir-btn" data-dir="4" onclick="window.AdminEquipmentVisualPreview?.setDir(4)" style="font-size:0.66rem; padding:4px 2px;">N</button>
                <button type="button" class="equip-dir-btn" data-dir="5" onclick="window.AdminEquipmentVisualPreview?.setDir(5)" style="font-size:0.66rem; padding:4px 2px;">NO</button>
                <button type="button" class="equip-dir-btn" data-dir="6" onclick="window.AdminEquipmentVisualPreview?.setDir(6)" style="font-size:0.66rem; padding:4px 2px;">O</button>
                <button type="button" class="equip-dir-btn" data-dir="7" onclick="window.AdminEquipmentVisualPreview?.setDir(7)" style="font-size:0.66rem; padding:4px 2px;">SO</button>
                <button type="button" id="btnEquipPrevAutoRot" onclick="window.AdminEquipmentVisualPreview?.toggleAutoRotate()" title="Giro 360° automático" style="font-size:0.66rem; padding:4px 2px;">🔄</button>
              </div>
            </div>

            <!-- Controles Mobile-Friendly de Modelo, Distância ao Chão (Z), Escala e Offsets -->
            <div style="display:flex; flex-direction:column; gap:8px;">
              <div class="field" style="margin:0;">
                <label>Modelo 2.5D Animado (mcrework)</label>
                <select id="equipVisualModelSelect" onchange="AdminApp.onVisualModelSelectChange()" style="min-height:38px;">
                  <option value="">Sem modelo 2.5D vinculado</option>
                </select>
              </div>

              <!-- Distância do Modelo em relação ao Chão (Z / groundOffsetY) -->
              <div style="background:rgba(2,6,23,0.72); border:1px solid rgba(250,204,21,0.35); border-radius:9px; padding:8px; display:flex; flex-direction:column; gap:5px;">
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.72rem;">
                  <strong style="color:#fde047;">📏 Distância ao Chão (Z / Ground Offset)</strong>
                  <span id="equipGroundZStatusBadge" style="font-family:monospace; font-weight:800; color:#86efac;">0px (Solo)</span>
                </div>
                <input type="range" id="equipGroundOffsetYRange" min="-120" max="120" step="1" value="0" oninput="window.AdminEquipmentVisualPreview?.setInputValue('equipGroundOffsetYInput', this.value, false)" style="width:100%;" />
                <div style="display:grid; grid-template-columns:repeat(2, auto) 1fr repeat(3, auto); gap:4px; align-items:center;">
                  <button type="button" onclick="window.AdminEquipmentVisualPreview?.nudgeInput('equipGroundOffsetYInput', -5, false, -120, 120)" style="padding:6px 8px; min-height:34px; font-size:0.72rem;">⬆ -5</button>
                  <button type="button" onclick="window.AdminEquipmentVisualPreview?.nudgeInput('equipGroundOffsetYInput', -1, false, -120, 120)" style="padding:6px 8px; min-height:34px; font-size:0.72rem;">-1</button>
                  <input type="number" id="equipGroundOffsetYInput" value="0" min="-120" max="120" oninput="window.AdminEquipmentVisualPreview?.syncSliders()" style="text-align:center; min-height:34px; padding:4px;" />
                  <button type="button" onclick="window.AdminEquipmentVisualPreview?.nudgeInput('equipGroundOffsetYInput', 1, false, -120, 120)" style="padding:6px 8px; min-height:34px; font-size:0.72rem;">+1</button>
                  <button type="button" onclick="window.AdminEquipmentVisualPreview?.nudgeInput('equipGroundOffsetYInput', 5, false, -120, 120)" style="padding:6px 8px; min-height:34px; font-size:0.72rem;">+5 ⬇</button>
                  <button type="button" onclick="window.AdminEquipmentVisualPreview?.setInputValue('equipGroundOffsetYInput', 0, false)" title="Zerar Z" style="padding:6px 7px; min-height:34px; font-size:0.72rem;">↩0</button>
                </div>
              </div>

              <!-- Tamanho / Escala -->
              <div style="background:rgba(2,6,23,0.65); border:1px solid #334155; border-radius:9px; padding:8px; display:flex; flex-direction:column; gap:5px;">
                <label style="font-size:0.72rem; color:#7dd3fc; font-weight:700;">🔍 Tamanho / Escala (0.20–2.00)</label>
                <input type="range" id="equipVisualScaleRange" min="0.20" max="2.00" step="0.05" value="0.70" oninput="window.AdminEquipmentVisualPreview?.setInputValue('equipVisualScaleInput', this.value, true)" style="width:100%;" />
                <div style="display:grid; grid-template-columns:auto 1fr auto; gap:5px; align-items:center;">
                  <button type="button" onclick="window.AdminEquipmentVisualPreview?.nudgeInput('equipVisualScaleInput', -0.05, true, 0.2, 2.0)" style="padding:6px 12px; min-height:34px;">-0.05</button>
                  <input type="number" id="equipVisualScaleInput" value="0.70" min="0.20" max="2.00" step="0.05" oninput="window.AdminEquipmentVisualPreview?.syncSliders()" style="text-align:center; min-height:34px;" />
                  <button type="button" onclick="window.AdminEquipmentVisualPreview?.nudgeInput('equipVisualScaleInput', 0.05, true, 0.2, 2.0)" style="padding:6px 12px; min-height:34px;">+0.05</button>
                </div>
              </div>

              <!-- Posição X e Y -->
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                <div class="field" style="margin:0;">
                  <label>↔️ Posição X (px)</label>
                  <div style="display:grid; grid-template-columns:auto 1fr auto; gap:3px;">
                    <button type="button" onclick="window.AdminEquipmentVisualPreview?.nudgeInput('equipVisualOffsetXInput', -2)" style="padding:6px 8px; min-height:34px;">-2</button>
                    <input type="number" id="equipVisualOffsetXInput" value="0" min="-150" max="150" style="text-align:center; min-height:34px;" />
                    <button type="button" onclick="window.AdminEquipmentVisualPreview?.nudgeInput('equipVisualOffsetXInput', 2)" style="padding:6px 8px; min-height:34px;">+2</button>
                  </div>
                </div>
                <div class="field" style="margin:0;">
                  <label>↕️ Posição Y (px)</label>
                  <div style="display:grid; grid-template-columns:auto 1fr auto; gap:3px;">
                    <button type="button" onclick="window.AdminEquipmentVisualPreview?.nudgeInput('equipVisualOffsetYInput', -2)" style="padding:6px 8px; min-height:34px;">-2</button>
                    <input type="number" id="equipVisualOffsetYInput" value="-30" min="-150" max="150" style="text-align:center; min-height:34px;" />
                    <button type="button" onclick="window.AdminEquipmentVisualPreview?.nudgeInput('equipVisualOffsetYInput', 2)" style="padding:6px 8px; min-height:34px;">+2</button>
                  </div>
                </div>
              </div>

              <!-- Parâmetros Exclusivos de Profundidade & Direções de Asas -->
              <div id="equipWingDepthBox" style="display:none; background:rgba(168,85,247,0.12); border:1px solid #a855f7; border-radius:9px; padding:8px; flex-direction:column; gap:6px;">
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.72rem;">
                  <strong style="color:#e9d5ff;">📐 Profundidade 2.5D nas Costas (Todas 8 Dirs)</strong>
                  <span style="font-size:0.66rem; color:#c4b5fd;">+ afasta das costas • - encaixa</span>
                </div>
                <input type="range" id="equipWingBackDepthRange" min="-50" max="50" step="1" value="0" oninput="window.AdminEquipmentVisualPreview?.setInputValue('equipWingBackDepthInput', this.value, false)" style="width:100%;" />
                <div style="display:grid; grid-template-columns:repeat(2, auto) 1fr repeat(3, auto); gap:4px; align-items:center;">
                  <button type="button" onclick="window.AdminEquipmentVisualPreview?.nudgeInput('equipWingBackDepthInput', -5, false, -50, 50)" style="padding:5px 7px; font-size:0.70rem;">-5</button>
                  <button type="button" onclick="window.AdminEquipmentVisualPreview?.nudgeInput('equipWingBackDepthInput', -1, false, -50, 50)" style="padding:5px 7px; font-size:0.70rem;">-1</button>
                  <input type="number" id="equipWingBackDepthInput" value="0" min="-50" max="50" oninput="window.AdminEquipmentVisualPreview?.syncSliders()" style="text-align:center; min-height:32px; padding:3px;" />
                  <button type="button" onclick="window.AdminEquipmentVisualPreview?.nudgeInput('equipWingBackDepthInput', 1, false, -50, 50)" style="padding:5px 7px; font-size:0.70rem;">+1</button>
                  <button type="button" onclick="window.AdminEquipmentVisualPreview?.nudgeInput('equipWingBackDepthInput', 5, false, -50, 50)" style="padding:5px 7px; font-size:0.70rem;">+5</button>
                  <button type="button" onclick="window.AdminEquipmentVisualPreview?.setInputValue('equipWingBackDepthInput', 0, false)" style="padding:5px 7px; font-size:0.70rem;" title="Zerar Profundidade">↩0</button>
                </div>
                <div style="border-top:1px dashed rgba(168,85,247,0.35); padding-top:6px; display:flex; flex-direction:column; gap:5px;">
                  <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.70rem;">
                    <strong style="color:#fde047;">🎯 Ajuste Fino (<span id="equipWingCurDirLabel">Sul (S)</span>)</strong>
                    <button type="button" onclick="window.AdminEquipmentVisualPreview?.resetAllDirOffsets()" style="padding:2px 6px; font-size:0.65rem;">🧹 Resetar 8 Dirs</button>
                  </div>
                  <div style="display:grid; grid-template-columns:1fr 1fr 1.2fr; gap:5px;">
                    <div>
                      <span style="font-size:0.64rem; color:#94a3b8;">Dir X (px)</span>
                      <div style="display:grid; grid-template-columns:auto 1fr auto; gap:2px;">
                        <button type="button" onclick="window.AdminEquipmentVisualPreview?.nudgeDirOffset('x', -1)" style="padding:4px 6px; font-size:0.68rem;">-</button>
                        <input type="number" id="equipWingDirOffXInput" value="0" min="-80" max="80" oninput="window.AdminEquipmentVisualPreview?.updateCurrentDirOffset('x', this.value)" style="text-align:center; padding:3px; min-height:30px; font-size:0.72rem;" />
                        <button type="button" onclick="window.AdminEquipmentVisualPreview?.nudgeDirOffset('x', 1)" style="padding:4px 6px; font-size:0.68rem;">+</button>
                      </div>
                    </div>
                    <div>
                      <span style="font-size:0.64rem; color:#94a3b8;">Dir Y (px)</span>
                      <div style="display:grid; grid-template-columns:auto 1fr auto; gap:2px;">
                        <button type="button" onclick="window.AdminEquipmentVisualPreview?.nudgeDirOffset('y', -1)" style="padding:4px 6px; font-size:0.68rem;">-</button>
                        <input type="number" id="equipWingDirOffYInput" value="0" min="-80" max="80" oninput="window.AdminEquipmentVisualPreview?.updateCurrentDirOffset('y', this.value)" style="text-align:center; padding:3px; min-height:30px; font-size:0.72rem;" />
                        <button type="button" onclick="window.AdminEquipmentVisualPreview?.nudgeDirOffset('y', 1)" style="padding:4px 6px; font-size:0.68rem;">+</button>
                      </div>
                    </div>
                    <div>
                      <span style="font-size:0.64rem; color:#94a3b8;">Camada</span>
                      <select id="equipWingDirLayerSelect" onchange="window.AdminEquipmentVisualPreview?.updateCurrentDirOffset('layer', this.value)" style="width:100%; padding:3px; min-height:30px; font-size:0.70rem;">
                        <option value="AUTO">AUTO (Padrão)</option>
                        <option value="BACK">Atrás do Herói</option>
                        <option value="FRONT">Frente do Herói</option>
                      </select>
                    </div>
                  </div>
                  <label style="display:flex; align-items:center; gap:5px; font-size:0.66rem; color:#cbd5e1; cursor:pointer;">
                    <input type="checkbox" id="equipWingMirrorPairChk" checked /> 🪞 Espelhar par simétrico (SE↔SO, L↔O, NE↔NO)
                  </label>
                </div>
              </div>

              <!-- Parâmetros Exclusivos de Montaria Voadora -->
              <div id="equipMountCalibrationRow" style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                <div class="field" id="equipMountAltitudeField" style="margin:0; grid-column:1 / -1;">
                  <label>🛫 Altitude de Voo (px)</label>
                  <input type="range" id="equipMountAltitudeRange" min="15" max="160" step="1" value="72" oninput="window.AdminEquipmentVisualPreview?.setInputValue('equipMountAltitudeInput', this.value, false)" style="width:100%;" />
                  <div style="display:grid; grid-template-columns:auto 1fr auto; gap:4px;">
                    <button type="button" onclick="window.AdminEquipmentVisualPreview?.nudgeInput('equipMountAltitudeInput', -5, false, 15, 160)" style="padding:6px 10px; min-height:34px;">-5</button>
                    <input type="number" id="equipMountAltitudeInput" value="72" min="15" max="160" oninput="window.AdminEquipmentVisualPreview?.syncSliders()" style="text-align:center; min-height:34px;" />
                    <button type="button" onclick="window.AdminEquipmentVisualPreview?.nudgeInput('equipMountAltitudeInput', 5, false, 15, 160)" style="padding:6px 10px; min-height:34px;">+5</button>
                  </div>
                </div>
                <div class="field" id="equipMountRiderOffsetXField" style="margin:0;">
                  <label>👤 Cavaleiro X (px)</label>
                  <div style="display:grid; grid-template-columns:auto 1fr auto; gap:3px;">
                    <button type="button" onclick="window.AdminEquipmentVisualPreview?.nudgeInput('equipMountRiderOffsetXInput', -2, false, -100, 100)" style="padding:6px 8px; min-height:34px;">-2</button>
                    <input type="number" id="equipMountRiderOffsetXInput" value="0" min="-100" max="100" style="text-align:center; min-height:34px;" />
                    <button type="button" onclick="window.AdminEquipmentVisualPreview?.nudgeInput('equipMountRiderOffsetXInput', 2, false, -100, 100)" style="padding:6px 8px; min-height:34px;">+2</button>
                  </div>
                </div>
                <div class="field" id="equipMountRiderOffsetField" style="margin:0;">
                  <label>👤 Cavaleiro Y (px)</label>
                  <div style="display:grid; grid-template-columns:auto 1fr auto; gap:3px;">
                    <button type="button" onclick="window.AdminEquipmentVisualPreview?.nudgeInput('equipMountRiderOffsetInput', -2, false, -120, 40)" style="padding:6px 8px; min-height:34px;">-2</button>
                    <input type="number" id="equipMountRiderOffsetInput" value="-22" min="-120" max="40" style="text-align:center; min-height:34px;" />
                    <button type="button" onclick="window.AdminEquipmentVisualPreview?.nudgeInput('equipMountRiderOffsetInput', 2, false, -120, 40)" style="padding:6px 8px; min-height:34px;">+2</button>
                  </div>
                </div>
                <div class="field" id="equipMountSpeedBonusField" style="margin:0; grid-column:1 / -1;">
                  <label>⚡ Bônus Velocidade Voo (%)</label>
                  <input type="number" id="equipMountSpeedBonusInput" value="25" min="0" max="200" style="min-height:34px;" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- BLOCO 2: BÔNUS EXCLUSIVOS DE COMBATE DA ARENA ACTION -->
        <div style="background:rgba(15,23,42,0.85); border:1.5px solid #38bdf8; border-radius:10px; padding:12px; margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px; margin-bottom:4px;">
            <span style="font-size:0.82rem; font-weight:700; color:#38bdf8;">
              2️⃣ ⚔️ Bônus Exclusivos de Atributos de Combate da Arena Action
            </span>
            <span style="font-size:0.72rem; color:#86efac; background:rgba(34,197,94,0.15); padding:2px 8px; border-radius:6px; border:1px solid #16a34a; font-weight:600;">
              🛡️ Sem Bônus de Atributos Base
            </span>
          </div>
          <p style="font-size:0.72rem; color:#94a3b8; margin:0 0 10px 0; line-height:1.4;">
            Equipamentos e armas concedem exclusivamente atributos diretos de combate aplicados na arena em tempo real. Configure apenas os bônus aplicáveis a esta peça.
          </p>

          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap:12px;">
            <!-- FAMÍLIA 1: PODER OFENSIVO & ALCANCE -->
            <div style="background:#020617; border:1px solid #334155; border-radius:8px; padding:10px;">
              <div style="font-size:0.76rem; font-weight:700; color:#f87171; margin-bottom:8px;">⚔️ Poder Ofensivo & Alcance</div>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                <div class="field">
                  <label style="font-size:0.70rem; color:#f87171;">Ataque Físico (+ATK)</label>
                  <input type="number" id="equipCombatPHYS_ATKInput" value="0" />
                </div>
                <div class="field">
                  <label style="font-size:0.70rem; color:#c084fc;">Ataque Mágico (+MATK)</label>
                  <input type="number" id="equipCombatMAG_ATKInput" value="0" />
                </div>
                <div class="field">
                  <label style="font-size:0.70rem; color:#86efac;">Poder de Cura (+Cura)</label>
                  <input type="number" id="equipCombatHEAL_POWERInput" value="0" />
                </div>
                <div class="field">
                  <label style="font-size:0.70rem; color:#fde047;">Alcance Ataque (+px)</label>
                  <input type="number" id="equipCombatATTACK_RANGEInput" value="0" placeholder="Ex: 60" />
                </div>
              </div>
            </div>

            <!-- FAMÍLIA 2: SOBREVIVÊNCIA & SUSTENTAÇÃO -->
            <div style="background:#020617; border:1px solid #334155; border-radius:8px; padding:10px;">
              <div style="font-size:0.76rem; font-weight:700; color:#60a5fa; margin-bottom:8px;">🛡️ Sobrevivência & Sustentação</div>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                <div class="field">
                  <label style="font-size:0.70rem; color:#86efac;">Vida Máxima (+HP)</label>
                  <input type="number" id="equipCombatMAX_HPInput" value="0" />
                </div>
                <div class="field">
                  <label style="font-size:0.70rem; color:#38bdf8;">Mana Máxima (+MP)</label>
                  <input type="number" id="equipCombatMAX_MPInput" value="0" />
                </div>
                <div class="field">
                  <label style="font-size:0.70rem; color:#60a5fa;">Defesa Física (+DEF)</label>
                  <input type="number" id="equipCombatPHYS_DEFInput" value="0" />
                </div>
                <div class="field">
                  <label style="font-size:0.70rem; color:#a78bfa;">Defesa Mágica (+MDEF)</label>
                  <input type="number" id="equipCombatMAG_DEFInput" value="0" />
                </div>
              </div>
            </div>

            <!-- FAMÍLIA 3: VELOCIDADE & CRÍTICO -->
            <div style="background:#020617; border:1px solid #334155; border-radius:8px; padding:10px;">
              <div style="font-size:0.76rem; font-weight:700; color:#fde047; margin-bottom:8px;">⚡ Velocidade & Ação</div>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                <div class="field">
                  <label style="font-size:0.70rem; color:#38bdf8;">Vel. Batalha (+px/s)</label>
                  <input type="number" id="equipCombatBATTLE_MOVE_SPEEDInput" value="0" />
                </div>
                <div class="field">
                  <label style="font-size:0.70rem; color:#fde047;">Vel. Ataque (+atks/s)</label>
                  <input type="number" id="equipCombatATTACK_SPEEDInput" value="0" step="0.05" />
                </div>
                <div class="field">
                  <label style="font-size:0.70rem; color:#f43f5e;">Taxa Crítica (+%)</label>
                  <input type="number" id="equipCombatCRIT_RATEInput" value="0" min="0" max="80" />
                </div>
                <div class="field">
                  <label style="font-size:0.70rem; color:#fb7185;">Dano Crítico (+%)</label>
                  <input type="number" id="equipCombatCRIT_DMGInput" value="0" min="0" max="300" />
                </div>
              </div>
            </div>

            <!-- FAMÍLIA 4: PRECISÃO & ESQUIVA -->
            <div style="background:#020617; border:1px solid #334155; border-radius:8px; padding:10px;">
              <div style="font-size:0.76rem; font-weight:700; color:#4ade80; margin-bottom:8px;">🎯 Precisão & Esquiva</div>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                <div class="field">
                  <label style="font-size:0.70rem; color:#4ade80;">Precisão Física (+%)</label>
                  <input type="number" id="equipCombatPHYS_ACCURACYInput" value="0" />
                </div>
                <div class="field">
                  <label style="font-size:0.70rem; color:#a3e635;">Desvio Físico (+%)</label>
                  <input type="number" id="equipCombatPHYS_EVASIONInput" value="0" />
                </div>
                <div class="field">
                  <label style="font-size:0.70rem; color:#c084fc;">Precisão Mágica (+%)</label>
                  <input type="number" id="equipCombatMAG_ACCURACYInput" value="0" />
                </div>
                <div class="field">
                  <label style="font-size:0.70rem; color:#e879f9;">Desvio Mágico (+%)</label>
                  <input type="number" id="equipCombatMAG_EVASIONInput" value="0" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- BLOCO 3: GALERIA DE 1.865 ÍCONES DO MCREWORK & PRÉ-VISUALIZAÇÃO -->
        <div style="background:rgba(15,23,42,0.85); border:1px solid #334155; border-radius:10px; padding:12px; margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:8px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <img id="equipActiveIconImg" src="" style="width:42px; height:42px; object-fit:contain; border-radius:6px; background:#020617; border:1px solid #38bdf8;" />
              <div>
                <strong style="color:#c084fc; font-size:0.82rem;">3️⃣ Galeria Oficial de Ícones & Equipamentos (mcrework)</strong>
                <div id="equipActiveIconBadge" style="font-size:0.68rem; color:var(--text-muted); font-family:monospace;"></div>
              </div>
            </div>
            <span id="equipGalleryCountBadge" style="font-size:0.75rem; color:#bae6fd;"></span>
          </div>

          <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px;">
            <button class="btn-primary equip-gal-btn" data-group="ALL" onclick="AdminApp.setEquipmentGalleryGroup('ALL')">🌐 Todos</button>
            <button class="equip-gal-btn" data-group="weapons" onclick="AdminApp.setEquipmentGalleryGroup('weapons')">⚔️ Armas</button>
            <button class="equip-gal-btn" data-group="armor" onclick="AdminApp.setEquipmentGalleryGroup('armor')">🥋 Armaduras</button>
            <button class="equip-gal-btn" data-group="offhand" onclick="AdminApp.setEquipmentGalleryGroup('offhand')">🛡️ Escudos</button>
            <button class="equip-gal-btn" data-group="jewelry" onclick="AdminApp.setEquipmentGalleryGroup('jewelry')">💍 Joias</button>
            <button class="equip-gal-btn" data-group="wings_costumes" onclick="AdminApp.setEquipmentGalleryGroup('wings_costumes')">🪽 Asas & Trajes</button>
            <button class="equip-gal-btn" data-group="pet" onclick="AdminApp.setEquipmentGalleryGroup('pet')">🐾 Pets</button>
          </div>

          <input type="text" id="equipGallerySearchInput" placeholder="🔎 Filtrar ícone por nome, posição ou tipo..." oninput="AdminApp.filterEquipmentGallery()" style="margin-bottom:8px; width:100%; padding:6px 10px; font-size:0.82rem;" />
          <div id="equipGalleryGrid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(88px, 1fr)); gap:8px; max-height:220px; overflow-y:auto; padding:4px;"></div>
        </div>

        <div style="border-top:1px solid var(--border); padding-top:10px;">
          <button class="btn-success" style="width:100%; padding:12px; font-weight:800; font-size:0.95rem; border-radius:8px; min-height:44px;" onclick="AdminApp.saveEquipmentTemplate()">
            💾 Salvar Equipamento Completo na Tabela
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  }
}

window.AdminEquipmentModalDom = AdminEquipmentModalDom;
