/**
 * @file apps/server/public/admin/js/AdminQuestBattlePanel.js
 * @module @etheria/server
 * @description Submódulo Visual No-Code para configurar a função "Entrar em Luta" (`questBattleConfig`)
 *   dentro do Estúdio de Missões (`/admin` -> `📜 Quests`).
 *   Permite compartilhar/puxar qualquer monstro da tabela `monster_templates` para a luta exclusiva da missão
 *   e customizar livremente: quantidade a spawnar, patamar (Básico/Líder/Boss), nível, nome, elemento,
 *   raça, rank, estilo, alcance, atributos base, overrides de combate e habilidades apenas para essa luta.
 */

class AdminQuestBattlePanel {
  static getBuilderSectionHtml() {
    return `
      <!-- BLOCO 4.5: LUTA EXCLUSIVA DA MISSÃO ("ENTRAR EM LUTA" COM MONSTROS CUSTOMIZADOS) -->
      <div id="questBattleConfigSection" style="background:rgba(15,23,42,0.85); border:1.5px solid #f43f5e; border-radius:10px; padding:12px; margin-bottom:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
          <div>
            <div style="font-size:0.82rem; font-weight:800; color:#fda4af;">
              ⚔️ 4.5 Batalha Exclusiva da Missão — Configurar Função "Entrar em Luta"
            </div>
            <div style="font-size:0.72rem; color:#94a3b8;">
              Compartilhe qual monstro será enviado para a luta com o jogador e personalize quantidade, nome, elemento, rank, atributos e habilidades especificamente para esta missão.
            </div>
          </div>
          <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
            <select id="questBattleEnabledSelect" onchange="AdminApp.onQuestBattleEnabledChanged()" style="background:#020617; color:#f8fafc; border:1px solid #f43f5e; border-radius:6px; padding:5px 10px; font-weight:700; font-size:0.75rem;">
              <option value="false">⚪ Padrão Automático (Usa Monstro do Objetivo)</option>
              <option value="true">⚔️ Ativar Luta Customizada desta Missão</option>
            </select>
          </div>
        </div>

        <div id="questBattleCustomBody" style="display:none; flex-direction:column; gap:10px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-end; flex-wrap:wrap; gap:10px; background:#020617; border:1px solid #334155; border-radius:8px; padding:10px;">
            <div class="field" style="flex:1; min-width:240px; margin:0;">
              <label style="color:#fda4af; font-weight:700; font-size:0.74rem;">🔘 Texto do Botão de Entrar em Luta (Opcional)</label>
              <input type="text" id="questBattleButtonLabelInput" placeholder="Ex: ⚔️ Entrar no Véu (Iniciar Luta da Missão)" />
            </div>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
              <button type="button" onclick="AdminApp.importQuestBattleFromObjectives()" style="padding:6px 11px; font-size:0.74rem; background:#0284c7; color:#fff; border:1px solid #38bdf8; border-radius:6px; font-weight:700; cursor:pointer;">
                📥 Puxar Monstro(s) dos Objetivos da Quest
              </button>
              <button type="button" onclick="AdminApp.addQuestBattleMonsterSlot()" style="padding:6px 11px; font-size:0.74rem; background:#be123c; color:#fff; border:1px solid #fb7185; border-radius:6px; font-weight:700; cursor:pointer;">
                ➕ 🐉 Adicionar Monstro à Luta
              </button>
            </div>
          </div>

          <div id="questBattleMonstersContainer" style="display:flex; flex-direction:column; gap:10px;"></div>
        </div>
      </div>
    `;
  }

  static attach(app) {
    app.editingQuestBattleMonsters = [];

    app.createSlotFromMonsterTemplate = function (mobId, overrides = {}) {
      const mob =
        (this.monsterTemplates || []).find((m) => Number(m.id) === Number(mobId)) ||
        (this.monsterTemplates || [])[0] ||
        null;
      const baseAttrs =
        mob && mob.baseAttributes && typeof mob.baseAttributes === 'object'
          ? { ...mob.baseAttributes }
          : { VIT: 10, STR: 10, INT: 10, WIS: 10, AGI: 10, DEX: 10 };
      const skills = Array.isArray(mob?.skillIds) ? [...mob.skillIds.map((id) => Number(id))] : [];

      return {
        monsterTemplateId: mob ? Number(mob.id) : Number(mobId) || 1,
        quantity: Math.max(1, Number(overrides.quantity) || 1),
        variantTier: overrides.variantTier || 'NORMAL',
        levelMode: overrides.levelMode || 'FIXED',
        level: Math.max(1, Number(overrides.level ?? document.getElementById('questMinLevelInput')?.value) || 1),
        customNamePtBr: overrides.customNamePtBr ?? (mob ? mob.namePtBr || mob.code : ''),
        elementCode: overrides.elementCode ?? (mob?.elementCode || 'NEUTRAL'),
        raceCode: overrides.raceCode ?? (mob?.raceCode || 'BEAST'),
        rarityTier: overrides.rarityTier ?? (mob?.rarityTier || 'F'),
        combatStyle: overrides.combatStyle ?? (mob?.combatStyle || 'MELEE'),
        attackRange: Number(overrides.attackRange ?? mob?.attackRange ?? 36) || 36,
        damageType: overrides.damageType ?? (mob?.damageType || 'PHYSICAL'),
        baseAttributes: {
          VIT: Number(overrides.baseAttributes?.VIT ?? baseAttrs.VIT ?? 10),
          STR: Number(overrides.baseAttributes?.STR ?? baseAttrs.STR ?? 10),
          INT: Number(overrides.baseAttributes?.INT ?? baseAttrs.INT ?? 10),
          WIS: Number(overrides.baseAttributes?.WIS ?? baseAttrs.WIS ?? 10),
          AGI: Number(overrides.baseAttributes?.AGI ?? baseAttrs.AGI ?? 10),
          DEX: Number(overrides.baseAttributes?.DEX ?? baseAttrs.DEX ?? 10),
        },
        combatOverrides: overrides.combatOverrides ? { ...overrides.combatOverrides } : {},
        skillIds: Array.isArray(overrides.skillIds)
          ? overrides.skillIds.map((id) => Number(id)).filter((id) => id > 0)
          : skills,
      };
    };

    app.onQuestBattleEnabledChanged = function () {
      const enabled = document.getElementById('questBattleEnabledSelect')?.value === 'true';
      const body = document.getElementById('questBattleCustomBody');
      if (body) {
        body.style.display = enabled ? 'flex' : 'none';
      }
      if (enabled && (!this.editingQuestBattleMonsters || this.editingQuestBattleMonsters.length === 0)) {
        this.importQuestBattleFromObjectives();
        if (this.editingQuestBattleMonsters.length === 0) {
          this.addQuestBattleMonsterSlot();
        }
      }
    };

    app.addQuestBattleMonsterSlot = function (mobId = null, overrides = {}) {
      const defaultMobId = mobId || this.monsterTemplates?.[0]?.id || 1;
      const slot = this.createSlotFromMonsterTemplate(defaultMobId, overrides);
      this.editingQuestBattleMonsters.push(slot);
      this.renderQuestBattleMonsters();
    };

    app.importQuestBattleFromObjectives = function () {
      const objs = Array.isArray(this.editingQuestObjectives) ? this.editingQuestObjectives : [];
      const mobObjs = objs.filter(
        (o) =>
          (o.type === 'KILL_MONSTER' || o.type === 'KILL_LEADER' || o.type === 'KILL_BOSS') &&
          Number(o.monsterTemplateId) > 0
      );
      if (mobObjs.length === 0) {
        if (this.editingQuestBattleMonsters.length === 0) {
          this.addQuestBattleMonsterSlot();
        }
        return;
      }
      this.editingQuestBattleMonsters = mobObjs.map((o) => {
        const vTier =
          o.type === 'KILL_BOSS'
            ? 'BOSS'
            : o.type === 'KILL_LEADER'
            ? 'LEADER'
            : ['LEADER', 'BOSS', 'NORMAL'].includes(String(o.variantTier || '').toUpperCase())
            ? String(o.variantTier).toUpperCase()
            : 'NORMAL';
        return this.createSlotFromMonsterTemplate(Number(o.monsterTemplateId), {
          quantity: Math.max(1, Math.min(25, Number(o.requiredCount) || 1)),
          variantTier: vTier,
        });
      });
      const sel = document.getElementById('questBattleEnabledSelect');
      if (sel) sel.value = 'true';
      const body = document.getElementById('questBattleCustomBody');
      if (body) body.style.display = 'flex';
      this.renderQuestBattleMonsters();
    };

    app.removeQuestBattleMonsterSlot = function (idx) {
      this.editingQuestBattleMonsters.splice(idx, 1);
      this.renderQuestBattleMonsters();
    };

    app.onQuestBattleMonsterTemplateChanged = function (idx, newMobIdStr) {
      const slot = this.editingQuestBattleMonsters[idx];
      if (!slot) return;
      const newMobId = Number(newMobIdStr) || 1;
      const refreshed = this.createSlotFromMonsterTemplate(newMobId, {
        quantity: slot.quantity,
        variantTier: slot.variantTier,
        levelMode: slot.levelMode,
        level: slot.level,
      });
      this.editingQuestBattleMonsters[idx] = refreshed;
      this.renderQuestBattleMonsters();
    };

    app.resetQuestBattleSlotFromTemplate = function (idx) {
      const slot = this.editingQuestBattleMonsters[idx];
      if (!slot) return;
      this.editingQuestBattleMonsters[idx] = this.createSlotFromMonsterTemplate(slot.monsterTemplateId, {
        quantity: slot.quantity,
        variantTier: slot.variantTier,
        levelMode: slot.levelMode,
        level: slot.level,
      });
      this.renderQuestBattleMonsters();
    };

    app.updateQuestBattleSlotField = function (idx, field, val, isNum = false) {
      const slot = this.editingQuestBattleMonsters[idx];
      if (!slot) return;
      slot[field] = isNum ? Number(val) : val;
      if (field === 'levelMode' || field === 'combatStyle') {
        if (field === 'combatStyle') {
          slot.attackRange = val === 'RANGED' ? Math.max(80, Number(slot.attackRange) || 140) : 36;
        }
        this.renderQuestBattleMonsters();
      }
    };

    app.updateQuestBattleSlotBaseAttr = function (idx, attrKey, val) {
      const slot = this.editingQuestBattleMonsters[idx];
      if (!slot) return;
      if (!slot.baseAttributes) slot.baseAttributes = { VIT: 10, STR: 10, INT: 10, WIS: 10, AGI: 10, DEX: 10 };
      slot.baseAttributes[attrKey] = Math.max(0, Number(val) || 0);
    };

    app.updateQuestBattleSlotCombatOverride = function (idx, statKey, val) {
      const slot = this.editingQuestBattleMonsters[idx];
      if (!slot) return;
      if (!slot.combatOverrides) slot.combatOverrides = {};
      const trimmed = String(val ?? '').trim();
      if (trimmed === '') {
        delete slot.combatOverrides[statKey];
      } else {
        const num = Number(trimmed);
        if (Number.isFinite(num) && num >= 0) {
          slot.combatOverrides[statKey] = num;
        }
      }
    };

    app.toggleQuestBattleSlotSkill = function (idx, skillId, checked) {
      const slot = this.editingQuestBattleMonsters[idx];
      if (!slot) return;
      const sId = Number(skillId);
      const set = new Set(Array.isArray(slot.skillIds) ? slot.skillIds.map((x) => Number(x)) : []);
      if (checked) set.add(sId);
      else set.delete(sId);
      slot.skillIds = Array.from(set);
    };

    app.renderQuestBattleMonsters = function () {
      const container = document.getElementById('questBattleMonstersContainer');
      if (!container) return;

      if (!Array.isArray(this.editingQuestBattleMonsters) || this.editingQuestBattleMonsters.length === 0) {
        container.innerHTML = `
          <div style="padding:14px; text-align:center; color:#94a3b8; border:1px dashed #475569; border-radius:8px; font-size:0.76rem;">
            Nenhum monstro adicionado à luta exclusiva. Clique em <strong>"➕ 🐉 Adicionar Monstro à Luta"</strong> acima.
          </div>`;
        return;
      }

      const elements = [
        { code: 'NEUTRAL', label: '⚪ Neutro' },
        { code: 'FIRE', label: '🔥 Fogo' },
        { code: 'WATER', label: '💧 Água' },
        { code: 'EARTH', label: '🪨 Terra' },
        { code: 'AIR', label: '🌪️ Ar' },
        { code: 'LIGHT', label: '✨ Luz' },
        { code: 'DARK', label: '🌑 Trevas' },
      ];
      const ranks = ['F', 'D', 'C', 'B', 'A', 'S', 'SS'];
      const baseAttrKeys = ['VIT', 'STR', 'INT', 'WIS', 'AGI', 'DEX'];
      const overrideFields = [
        { key: 'maxHp', label: '❤️ HP Máx Fixo' },
        { key: 'maxMp', label: '💧 MP Máx Fixo' },
        { key: 'physAtk', label: '⚔️ Atq Físico Fixo' },
        { key: 'magAtk', label: '🔮 Atq Mágico Fixo' },
        { key: 'def', label: '🛡️ Def Física Fixa' },
        { key: 'magDef', label: '🔰 Def Mágica Fixa' },
        { key: 'critRatePct', label: '🎯 Crítico %' },
        { key: 'critDmgPct', label: '💥 Dano Crít %' },
        { key: 'physAccuracy', label: '👁️ Prec. Física' },
        { key: 'magAccuracy', label: '🔮 Prec. Mágica' },
        { key: 'physEvasion', label: '💨 Esq. Física' },
        { key: 'magEvasion', label: '✨ Esq. Mágica' },
      ];

      container.innerHTML = this.editingQuestBattleMonsters
        .map((slot, idx) => {
          const mobOpts = (this.monsterTemplates || [])
            .map(
              (m) =>
                `<option value="${m.id}" ${Number(slot.monsterTemplateId) === Number(m.id) ? 'selected' : ''}>🐉 #${m.id} ${m.namePtBr} (${m.code} • Rank ${m.rarityTier || 'F'})</option>`
            )
            .join('');

          const raceOpts = (this.races || [])
            .map(
              (r) =>
                `<option value="${r.code}" ${String(slot.raceCode).toUpperCase() === String(r.code).toUpperCase() ? 'selected' : ''}>🐾 ${r.namePtBr || r.code}</option>`
            )
            .join('');

          const elemOpts = elements
            .map(
              (el) =>
                `<option value="${el.code}" ${String(slot.elementCode).toUpperCase() === el.code ? 'selected' : ''}>${el.label}</option>`
            )
            .join('');

          const rankOpts = ranks
            .map(
              (rk) =>
                `<option value="${rk}" ${String(slot.rarityTier).toUpperCase() === rk ? 'selected' : ''}>Rank ${rk}</option>`
            )
            .join('');

          const baseAttrsHtml = baseAttrKeys
            .map(
              (k) => `
              <div>
                <label style="font-size:0.68rem; color:#fde047; font-weight:700;">${k}</label>
                <input type="number" min="0" value="${Number(slot.baseAttributes?.[k] ?? 10)}"
                  onchange="AdminApp.updateQuestBattleSlotBaseAttr(${idx}, '${k}', this.value)"
                  style="padding:4px 6px; font-size:0.75rem;" />
              </div>`
            )
            .join('');

          const overridesHtml = overrideFields
            .map((of) => {
              const val = slot.combatOverrides?.[of.key];
              return `
              <div>
                <label style="font-size:0.66rem; color:#94a3b8;">${of.label}</label>
                <input type="number" min="0" placeholder="Auto" value="${val !== undefined && val !== null ? val : ''}"
                  onchange="AdminApp.updateQuestBattleSlotCombatOverride(${idx}, '${of.key}', this.value)"
                  style="padding:4px 6px; font-size:0.73rem;" />
              </div>`;
            })
            .join('');

          const selectedSkills = new Set(Array.isArray(slot.skillIds) ? slot.skillIds.map((x) => Number(x)) : []);
          const skillsHtml = (this.skillTemplates || [])
            .map((sk) => {
              const checked = selectedSkills.has(Number(sk.id)) ? 'checked' : '';
              return `
                <label style="display:inline-flex; align-items:center; gap:5px; background:#0f172a; border:1px solid ${checked ? '#38bdf8' : '#334155'}; border-radius:6px; padding:3px 8px; font-size:0.7rem; color:#e2e8f0; cursor:pointer;">
                  <input type="checkbox" style="width:auto; margin:0;" ${checked}
                    onchange="AdminApp.toggleQuestBattleSlotSkill(${idx}, ${sk.id}, this.checked)" />
                  <span>#${sk.id} ${sk.namePtBr || sk.code}</span>
                </label>`;
            })
            .join('');

          return `
            <div style="background:#020617; border:1.5px solid #f43f5e; border-radius:10px; padding:12px; display:flex; flex-direction:column; gap:10px;">
              <!-- Cabeçalho do Slot -->
              <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; border-bottom:1px solid #1e293b; padding-bottom:8px;">
                <span style="font-size:0.78rem; font-weight:800; color:#fda4af;">
                  🐉 Grupo de Monstro #${idx + 1} da Luta Exclusiva
                </span>
                <div style="display:flex; gap:6px; align-items:center;">
                  <button type="button" onclick="AdminApp.resetQuestBattleSlotFromTemplate(${idx})" style="padding:4px 9px; font-size:0.7rem; background:#1e293b; color:#38bdf8; border:1px solid #38bdf8; border-radius:6px; cursor:pointer;">
                    🔄 Restaurar Atributos Originais do Monstro
                  </button>
                  <button type="button" class="btn-danger" onclick="AdminApp.removeQuestBattleMonsterSlot(${idx})" style="padding:4px 9px; font-size:0.72rem;">
                    🗑️ Remover
                  </button>
                </div>
              </div>

              <!-- Linha 1: Monstro Base, Quantidade, Patamar, Modo Nível, Nível, Nome Customizado -->
              <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(155px, 1fr)); gap:8px;">
                <div style="grid-column: span 2; min-width:220px;">
                  <label style="font-size:0.7rem; color:#fda4af; font-weight:700;">🐉 Monstro Base (Compartilhado de Monstros)</label>
                  <select onchange="AdminApp.onQuestBattleMonsterTemplateChanged(${idx}, this.value)">${mobOpts}</select>
                </div>
                <div>
                  <label style="font-size:0.7rem; color:#86efac; font-weight:700;">🔢 Quantidade a Spawnar</label>
                  <input type="number" min="1" max="25" value="${slot.quantity || 1}"
                    onchange="AdminApp.updateQuestBattleSlotField(${idx}, 'quantity', this.value, true)" />
                </div>
                <div>
                  <label style="font-size:0.7rem; color:#38bdf8; font-weight:700;">👑/💀 Patamar na Luta</label>
                  <select onchange="AdminApp.updateQuestBattleSlotField(${idx}, 'variantTier', this.value)">
                    <option value="NORMAL" ${slot.variantTier === 'NORMAL' ? 'selected' : ''}>▫️ Básico (1x)</option>
                    <option value="LEADER" ${slot.variantTier === 'LEADER' ? 'selected' : ''}>👑 LÍDER (2x Status/Rec.)</option>
                    <option value="BOSS" ${slot.variantTier === 'BOSS' ? 'selected' : ''}>💀 BOSS (4x Status/Rec.)</option>
                  </select>
                </div>
                <div>
                  <label style="font-size:0.7rem; color:#fde047; font-weight:700;">📈 Modo de Nível</label>
                  <select onchange="AdminApp.updateQuestBattleSlotField(${idx}, 'levelMode', this.value)">
                    <option value="FIXED" ${slot.levelMode !== 'PLAYER_LEVEL' ? 'selected' : ''}>📌 Nível Fixo</option>
                    <option value="PLAYER_LEVEL" ${slot.levelMode === 'PLAYER_LEVEL' ? 'selected' : ''}>⚖️ Nível do Jogador</option>
                  </select>
                </div>
                ${
                  slot.levelMode !== 'PLAYER_LEVEL'
                    ? `<div>
                        <label style="font-size:0.7rem; color:#fde047; font-weight:700;">⭐ Nível do Monstro</label>
                        <input type="number" min="1" max="999" value="${slot.level || 1}"
                          onchange="AdminApp.updateQuestBattleSlotField(${idx}, 'level', this.value, true)" />
                      </div>`
                    : ''
                }
                <div style="grid-column: span 2; min-width:200px;">
                  <label style="font-size:0.7rem; color:#f8fafc; font-weight:700;">🏷️ Nome Customizado na Luta (Opcional)</label>
                  <input type="text" value="${(slot.customNamePtBr || '').replace(/"/g, '&quot;')}"
                    placeholder="Deixe igual ou personalize para esta missão"
                    onchange="AdminApp.updateQuestBattleSlotField(${idx}, 'customNamePtBr', this.value)" />
                </div>
              </div>

              <!-- Linha 2: Elemento, Raça, Rank, Estilo, Alcance, Tipo de Dano -->
              <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(135px, 1fr)); gap:8px; background:rgba(15,23,42,0.65); padding:8px; border-radius:8px; border:1px solid #1e293b;">
                <div>
                  <label style="font-size:0.68rem; color:#7dd3fc;">🔥 Elemento</label>
                  <select onchange="AdminApp.updateQuestBattleSlotField(${idx}, 'elementCode', this.value)">${elemOpts}</select>
                </div>
                <div>
                  <label style="font-size:0.68rem; color:#7dd3fc;">🐾 Raça</label>
                  <select onchange="AdminApp.updateQuestBattleSlotField(${idx}, 'raceCode', this.value)">${raceOpts}</select>
                </div>
                <div>
                  <label style="font-size:0.68rem; color:#fde047;">🏅 Rank (F..SS)</label>
                  <select onchange="AdminApp.updateQuestBattleSlotField(${idx}, 'rarityTier', this.value)">${rankOpts}</select>
                </div>
                <div>
                  <label style="font-size:0.68rem; color:#c084fc;">🏹 Estilo de Combate</label>
                  <select onchange="AdminApp.updateQuestBattleSlotField(${idx}, 'combatStyle', this.value)">
                    <option value="MELEE" ${slot.combatStyle !== 'RANGED' ? 'selected' : ''}>🗡️ Corpo a Corpo (MELEE)</option>
                    <option value="RANGED" ${slot.combatStyle === 'RANGED' ? 'selected' : ''}>🏹 À Distância (RANGED)</option>
                  </select>
                </div>
                <div>
                  <label style="font-size:0.68rem; color:#c084fc;">📏 Alcance (px)</label>
                  <input type="number" min="25" max="420" value="${slot.attackRange || 36}"
                    onchange="AdminApp.updateQuestBattleSlotField(${idx}, 'attackRange', this.value, true)" />
                </div>
                <div>
                  <label style="font-size:0.68rem; color:#fda4af;">💥 Natureza do Dano</label>
                  <select onchange="AdminApp.updateQuestBattleSlotField(${idx}, 'damageType', this.value)">
                    <option value="PHYSICAL" ${slot.damageType !== 'MAGICAL' ? 'selected' : ''}>⚔️ Físico (PHYSICAL)</option>
                    <option value="MAGICAL" ${slot.damageType === 'MAGICAL' ? 'selected' : ''}>🔮 Mágico (MAGICAL)</option>
                  </select>
                </div>
              </div>

              <!-- Linha 3: Atributos Base -->
              <div style="background:rgba(15,23,42,0.65); padding:8px; border-radius:8px; border:1px solid #1e293b;">
                <div style="font-size:0.7rem; font-weight:700; color:#fde047; margin-bottom:6px;">
                  📊 Atributos Base do Monstro nesta Luta (Escalados automaticamente por Nível +20%/nv, Rank e Patamar)
                </div>
                <div style="display:grid; grid-template-columns:repeat(6, minmax(70px, 1fr)); gap:8px;">
                  ${baseAttrsHtml}
                </div>
              </div>

              <!-- Linha 4: Overrides Diretos de Status de Combate (Opcional) -->
              <details style="background:rgba(15,23,42,0.5); padding:8px; border-radius:8px; border:1px dashed #334155;">
                <summary style="font-size:0.72rem; font-weight:700; color:#38bdf8; cursor:pointer;">
                  ⚙️ Overrides Diretos de Status Finais de Combate (Opcional — Preencha apenas se quiser forçar um valor exato de HP/Ataque/Defesa)
                </summary>
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(115px, 1fr)); gap:8px; margin-top:8px;">
                  ${overridesHtml}
                </div>
              </details>

              <!-- Linha 5: Habilidades do Monstro nesta Luta -->
              <div style="background:rgba(15,23,42,0.65); padding:8px; border-radius:8px; border:1px solid #1e293b;">
                <div style="font-size:0.7rem; font-weight:700; color:#86efac; margin-bottom:6px;">
                  ⚡ Habilidades (` +
            '`skillIds`' +
            `) Equipadas pelo Monstro nesta Luta (${selectedSkills.size} selecionada(s))
                </div>
                <div style="display:flex; flex-wrap:wrap; gap:6px; max-height:110px; overflow-y:auto;">
                  ${skillsHtml || '<span style="font-size:0.7rem; color:#64748b;">Nenhuma skill cadastrada.</span>'}
                </div>
              </div>
            </div>`;
        })
        .join('');
    };

    app.loadQuestBattleConfigIntoForm = function (quest) {
      const cfg = quest?.questBattleConfig || quest?.triggerConfigJson?.questBattleConfig || null;
      const enabled = Boolean(cfg && cfg.enabled && Array.isArray(cfg.monsters) && cfg.monsters.length > 0);
      const sel = document.getElementById('questBattleEnabledSelect');
      if (sel) sel.value = enabled ? 'true' : 'false';
      const btnLabelInput = document.getElementById('questBattleButtonLabelInput');
      if (btnLabelInput) btnLabelInput.value = cfg?.buttonLabelPtBr || '';
      const body = document.getElementById('questBattleCustomBody');
      if (body) body.style.display = enabled ? 'flex' : 'none';

      if (enabled) {
        this.editingQuestBattleMonsters = cfg.monsters.map((m) =>
          this.createSlotFromMonsterTemplate(m.monsterTemplateId, m)
        );
      } else {
        this.editingQuestBattleMonsters = [];
      }
      this.renderQuestBattleMonsters();
    };

    app.buildQuestBattleConfigDtoFromForm = function () {
      const enabled = document.getElementById('questBattleEnabledSelect')?.value === 'true';
      const buttonLabelPtBr = (document.getElementById('questBattleButtonLabelInput')?.value || '').trim() || null;
      if (!enabled) {
        return {
          enabled: false,
          buttonLabelPtBr,
          monsters: [],
        };
      }
      return {
        enabled: true,
        buttonLabelPtBr,
        monsters: (this.editingQuestBattleMonsters || []).map((slot) => ({
          monsterTemplateId: Number(slot.monsterTemplateId) || 1,
          quantity: Math.max(1, Math.min(25, Number(slot.quantity) || 1)),
          variantTier: ['NORMAL', 'LEADER', 'BOSS'].includes(String(slot.variantTier || '').toUpperCase())
            ? String(slot.variantTier).toUpperCase()
            : 'NORMAL',
          levelMode: slot.levelMode === 'PLAYER_LEVEL' ? 'PLAYER_LEVEL' : 'FIXED',
          level: Math.max(1, Number(slot.level) || 1),
          customNamePtBr: slot.customNamePtBr ? String(slot.customNamePtBr).trim() : null,
          elementCode: slot.elementCode || 'NEUTRAL',
          raceCode: slot.raceCode || 'BEAST',
          rarityTier: slot.rarityTier || 'F',
          combatStyle: slot.combatStyle === 'RANGED' ? 'RANGED' : 'MELEE',
          attackRange: Number(slot.attackRange) || (slot.combatStyle === 'RANGED' ? 140 : 36),
          damageType: slot.damageType === 'MAGICAL' ? 'MAGICAL' : 'PHYSICAL',
          baseAttributes: {
            VIT: Number(slot.baseAttributes?.VIT ?? 10),
            STR: Number(slot.baseAttributes?.STR ?? 10),
            INT: Number(slot.baseAttributes?.INT ?? 10),
            WIS: Number(slot.baseAttributes?.WIS ?? 10),
            AGI: Number(slot.baseAttributes?.AGI ?? 10),
            DEX: Number(slot.baseAttributes?.DEX ?? 10),
          },
          combatOverrides: slot.combatOverrides && Object.keys(slot.combatOverrides).length > 0 ? slot.combatOverrides : null,
          skillIds: Array.isArray(slot.skillIds) ? slot.skillIds.map((id) => Number(id)).filter((id) => id > 0) : [],
        })),
      };
    };
  }
}

window.AdminQuestBattlePanel = AdminQuestBattlePanel;
