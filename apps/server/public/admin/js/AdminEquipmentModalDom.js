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
            <button class="btn-danger" onclick="AdminApp.closeModal('equipmentModal')" style="padding:7px 12px; min-height:38px; border-radius:6px;">✕</button>
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
              <select id="equipSlotSelect"></select>
            </div>
            <div class="field">
              <label>Raridade</label>
              <select id="equipRaritySelect">
                <option value="COMMON">COMMON (Comum)</option>
                <option value="F">Rank F (Básico)</option>
                <option value="D">Rank D (Regular)</option>
                <option value="C">Rank C (Incomum)</option>
                <option value="B">Rank B (Raro)</option>
                <option value="A">Rank A (Épico)</option>
                <option value="S">Rank S (Lendário)</option>
                <option value="SS">Rank SS (Mítico)</option>
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
