/**
 * @file apps/server/public/admin/js/AdminSkillsAutoLink.js
 * @module @etheria/server
 * @description Módulo de Apoio para Habilidades:
 *   - Auto-vínculo de habilidades aos monstros por elemento (💧 Água, 🔥 Fogo, 🪨 Terra, 🌪️ Ar, ⚪ Neutro).
 *   - Helpers de detecção de elemento, badges e escopo.
 *   - Filtros dinâmicos e controle visual do HUD de seleção de habilidades para Monstros e Classes.
 */

class AdminSkillsAutoLink {
  static attach(app) {
    app.autoLinkTargetSkillId = null;

    app.getSkillDetectedElement = function (sk) {
      if (!sk) return 'NEUTRAL';
      if (Array.isArray(sk.effectBlocksJson)) {
        for (const b of sk.effectBlocksJson) {
          if (b.elementCode && b.elementCode !== 'INHERIT') return b.elementCode;
        }
      }
      const text = `${sk.namePtBr || ''} ${sk.code || ''}`.toLowerCase();
      if (text.includes('água') || text.includes('agua') || text.includes('water') || text.includes('mar') || text.includes('oceano')) return 'WATER';
      if (text.includes('fogo') || text.includes('fire') || text.includes('chama') || text.includes('purgat')) return 'FIRE';
      if (text.includes('terra') || text.includes('earth') || text.includes('pedra') || text.includes('rocha')) return 'EARTH';
      if (text.includes('ar') || text.includes('vento') || text.includes('wind') || text.includes('trovão') || text.includes('raio') || text.includes('thunder')) return 'AIR';
      return 'NEUTRAL';
    };

    app.getElementBadge = function (elemCode) {
      switch (elemCode) {
        case 'FIRE': return { label: 'Fogo', icon: '🔥', bg: 'rgba(239,68,68,0.2)', text: '#fca5a5', border: '#ef4444' };
        case 'WATER': return { label: 'Água', icon: '💧', bg: 'rgba(6,182,212,0.2)', text: '#67e8f9', border: '#06b6d4' };
        case 'EARTH': return { label: 'Terra', icon: '🪨', bg: 'rgba(234,179,8,0.2)', text: '#fde047', border: '#eab308' };
        case 'AIR': return { label: 'Ar / Vento', icon: '🌪️', bg: 'rgba(168,85,247,0.2)', text: '#d8b4fe', border: '#a855f7' };
        default: return { label: 'Neutro', icon: '⚪', bg: 'rgba(148,163,184,0.2)', text: '#cbd5e1', border: '#64748b' };
      }
    };

    app.getScopeLabel = function (scope) {
      switch (scope) {
        case 'TARGET_PRIMARY':
        case 'MELEE_FRONTLINE': return '🗡️ Alvo Único';
        case 'RANGED_ANY': return '🏹 Alvo à Distância';
        case 'CONE_FRONTAL': return '📐 Cone Frontal';
        case 'LINE_PIERCE': return '📏 Linha Perfurante';
        case 'AOE_SELF_AROUND': return '💥 AoE ao Redor';
        case 'AOE_CIRCLE': return '⭕ AoE no Alvo';
        case 'GROUND_ZONE': return '🔥 Zona no Solo (Contínua)';
        case 'ALL_ENEMIES': return '🌋 Área Total';
        case 'ROW_FRONT': return '📏 Linha Frente';
        case 'SELF': return '🙋 Conjurador';
        case 'ALLY_SINGLE': return '💚 1 Aliado';
        case 'ALLY_LOWEST_HP_PCT': return '🩹 Aliado Menor % HP';
        case 'ALLY_ALL': return '✨ Todos Aliados';
        default: return scope || '🎯 Alvo';
      }
    };

    app.getSkillTriggerLabel = function (triggerType) {
      switch (triggerType) {
        case 'ACTIVE': return '🎯 Uso Manual / Combate Livre';
        case 'PASSIVE_ALWAYS': return '♾️ Passiva Permanente';
        case 'INTERVAL_TICK':
        case 'ON_TURN_START': return '⏱️ Periódico (A cada intervalo de segundos)';
        case 'ON_HIT': return '🗡️ Ao Acertar um Golpe';
        case 'ON_CRIT': return '💥 Ao Causar Dano Crítico';
        case 'ON_DAMAGE_TAKEN': return '🛡️ Ao Receber Dano';
        case 'ON_KILL': return '💀 Ao Derrotar um Inimigo';
        case 'ON_DEBUFF_RECEIVED': return '✨ Ao Receber Debuff (Limpar Debuffs)';
        case 'INTERVAL_TICK_CLEANSE':
        case 'ON_TURN_START_CLEANSE': return '🧹 Purificação Periódica (A cada intervalo com Debuff)';
        default: return triggerType || '🎯 Uso Manual';
      }
    };

    app.onSkillTriggerChanged = function (triggerVal) {
      if (triggerVal === 'ON_DEBUFF_RECEIVED' || triggerVal === 'INTERVAL_TICK_CLEANSE' || triggerVal === 'ON_TURN_START_CLEANSE') {
        const typeSel = document.getElementById('skillTypeSelect');
        if (typeSel && triggerVal !== 'ACTIVE') {
          typeSel.value = 'PASSIVE';
        }
        const hasCleanse = (this.editingSkillBlocks || []).some(
          (b) => b.blockType === 'CLEANSE_DISPEL' || b.blockType === 'CLEANSE'
        );
        if (!hasCleanse && typeof this.addVisualSkillBlock === 'function') {
          this.addVisualSkillBlock('CLEANSE_DISPEL');
        }
      }
      if (typeof this.triggerArenaPreviewNow === 'function') {
        this.triggerArenaPreviewNow();
      }
    };

    app.renderCleanseSkillBlockCard = function (blk, i) {
      const targetMode = blk.cleanseTarget || (blk.targetSelf === false ? 'TARGET' : 'SELF');
      const filterMode = blk.cleanseFilter || 'ALL';
      const maxDebuffs = Number(blk.maxDebuffs) || 0;
      const chancePct = blk.cleanseChancePct ?? 100;
      const healPct = Number(blk.healPerDebuffPct) || 0;
      const targetDesc =
        targetMode === 'ALL_ALLIES'
          ? 'Todos os Aliados'
          : targetMode === 'ALLY_LOWEST_HP_PCT'
          ? 'Aliado c/ Menor % HP'
          : targetMode === 'TARGET'
          ? 'Alvo da Habilidade'
          : 'Próprio Conjurador';

      return `
      <div style="background:#020617; border:1px solid #14b8a6; border-radius:8px; padding:10px; display:flex; flex-direction:column; gap:8px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong style="color:#2dd4bf; font-size:0.82rem;">✨ Bloco #${i + 1}: Limpar Debuffs / Purificar (CLEANSE_DISPEL)</strong>
          <button type="button" class="btn-danger" onclick="AdminApp.removeVisualSkillBlock(${i})" style="padding:2px 8px; font-size:0.72rem;">🗑️ Remover</button>
        </div>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(145px, 1fr)); gap:8px;">
          <div>
            <label style="font-size:0.7rem;">Quem Tem os Debuffs Limpos?</label>
            <select onchange="AdminApp.updateVisualSkillBlockField(${i}, 'cleanseTarget', this.value); AdminApp.updateVisualSkillBlockField(${i}, 'targetSelf', this.value === 'SELF', false, true);">
              <option value="SELF" ${targetMode === 'SELF' ? 'selected' : ''}>🙋 Próprio Conjurador</option>
              <option value="TARGET" ${targetMode === 'TARGET' ? 'selected' : ''}>🎯 Alvo da Habilidade</option>
              <option value="ALLY_LOWEST_HP_PCT" ${targetMode === 'ALLY_LOWEST_HP_PCT' ? 'selected' : ''}>🩹 Aliado Menor % HP</option>
              <option value="ALL_ALLIES" ${targetMode === 'ALL_ALLIES' ? 'selected' : ''}>✨ Todos os Aliados</option>
            </select>
          </div>
          <div>
            <label style="font-size:0.7rem;">Filtro de Família</label>
            <select onchange="AdminApp.updateVisualSkillBlockField(${i}, 'cleanseFilter', this.value)">
              <option value="ALL" ${filterMode === 'ALL' ? 'selected' : ''}>🧹 Todos os Debuffs</option>
              <option value="HARD_CC_AND_DOT" ${filterMode === 'HARD_CC_AND_DOT' ? 'selected' : ''}>💎 N Hard CC + N DoT (Ex: 1+1)</option>
              <option value="HARD_CC" ${filterMode === 'HARD_CC' ? 'selected' : ''}>⚡ Apenas Hard CC (CONTROL_HIT)</option>
              <option value="ANOMALY_DOT" ${filterMode === 'ANOMALY_DOT' ? 'selected' : ''}>☣️ Apenas DoT/Anomalia (ANOMALY_HIT)</option>
              <option value="SLOW" ${filterMode === 'SLOW' ? 'selected' : ''}>🕸️ Apenas Lentidões (SLOW)</option>
            </select>
          </div>
          <div>
            <label style="font-size:0.7rem;">Qtd. por Categoria/Total</label>
            <select onchange="AdminApp.updateVisualSkillBlockField(${i}, 'maxDebuffs', this.value, true)">
              <option value="0" ${maxDebuffs === 0 ? 'selected' : ''}>🧹 Todos os Ativos</option>
              <option value="1" ${maxDebuffs === 1 ? 'selected' : ''}>1</option>
              <option value="2" ${maxDebuffs === 2 ? 'selected' : ''}>Até 2</option>
              <option value="3" ${maxDebuffs === 3 ? 'selected' : ''}>Até 3</option>
            </select>
          </div>
          <div>
            <label style="font-size:0.7rem;">Chance de Limpar (%)</label>
            <input type="number" min="1" max="100" value="${chancePct}" onchange="AdminApp.updateVisualSkillBlockField(${i}, 'cleanseChancePct', this.value, true)" />
          </div>
          <div>
            <label style="font-size:0.7rem;">💚 Cura Bônus / Debuff (% HP)</label>
            <input type="number" min="0" max="100" value="${healPct}" onchange="AdminApp.updateVisualSkillBlockField(${i}, 'healPerDebuffPct', this.value, true)" />
          </div>
        </div>
        <div style="font-size:0.74rem; color:#5eead4; background:rgba(20,184,166,0.1); padding:4px 8px; border-radius:4px;">
          📐 <strong>Resumo Visual:</strong> Remove <strong>${maxDebuffs > 0 ? `até ${maxDebuffs} debuff(s)` : 'TODOS os debuffs ativos'}</strong> (${chancePct}% de chance) em <strong>${targetDesc}</strong>${healPct > 0 ? ` + restaura <strong>${healPct}% MAX_HP</strong> por debuff removido` : ''}
        </div>
      </div>`;
    };

    app.filterEntitySkillsChecklist = function (containerId, query) {
      const q = (query || '').toLowerCase().trim();
      const box = document.getElementById(containerId);
      if (!box) return;
      box.querySelectorAll('.entity-skill-card').forEach((card) => {
        const text = (card.getAttribute('data-skill-search') || '').toLowerCase();
        const matchesQuery = !q || text.includes(q);
        const matchesElem = card.getAttribute('data-hidden-by-elem') !== 'true';
        card.style.display = matchesQuery && matchesElem ? 'flex' : 'none';
      });
    };

    app.filterEntitySkillsByElement = function (containerId, elemCode, btnEl) {
      const box = document.getElementById(containerId);
      if (!box) return;

      const parentHeader = btnEl?.closest('.skill-filter-chips-container') || box.previousElementSibling;
      if (parentHeader) {
        parentHeader.querySelectorAll('.skill-filter-chip').forEach((b) => b.classList.remove('btn-primary'));
        if (btnEl) btnEl.classList.add('btn-primary');
      }

      box.querySelectorAll('.entity-skill-card').forEach((card) => {
        const cardElem = card.getAttribute('data-skill-element') || 'NEUTRAL';
        const matchesElem = elemCode === 'ALL' || cardElem === elemCode;
        card.setAttribute('data-hidden-by-elem', matchesElem ? 'false' : 'true');

        const input = document.getElementById('monsterSkillFilterInput');
        const q = (input?.value || '').toLowerCase().trim();
        const text = (card.getAttribute('data-skill-search') || '').toLowerCase();
        const matchesQuery = !q || text.includes(q);

        card.style.display = matchesElem && matchesQuery ? 'flex' : 'none';
      });
    };

    app.clearEntitySkills = function (containerId) {
      const box = document.getElementById(containerId);
      if (!box) return;
      box.querySelectorAll('input.entity-skill-checkbox').forEach((c) => {
        c.checked = false;
      });
      this.onEntitySkillToggle(containerId);
    };

    app.onEntitySkillToggle = function (containerId) {
      const box = document.getElementById(containerId);
      if (!box) return;
      const checkedBoxes = box.querySelectorAll('input.entity-skill-checkbox:checked');
      const count = checkedBoxes.length;

      const badgeId = containerId === 'monsterSkillsChecklist' ? 'monsterSkillsSelectedCount' : 'classSkillsSelectedCount';
      const badge = document.getElementById(badgeId);
      if (badge) {
        badge.textContent = `${count} marcada(s)`;
      }

      box.querySelectorAll('.entity-skill-card').forEach((card) => {
        const chk = card.querySelector('input.entity-skill-checkbox');
        const title = card.querySelector('.skill-card-title');
        if (chk && chk.checked) {
          card.style.background = 'rgba(56,189,248,0.16)';
          card.style.borderColor = '#38bdf8';
          if (title) title.style.color = '#38bdf8';
        } else {
          card.style.background = 'rgba(15,23,42,0.85)';
          card.style.borderColor = 'var(--border)';
          if (title) title.style.color = '#f8fafc';
        }
      });
    };

    app.openAutoLinkModal = function (skillId) {
      const sk = (this.skillTemplates || []).find((s) => s.id === Number(skillId));
      if (!sk) {
        alert('Habilidade não encontrada.');
        return;
      }
      this.autoLinkTargetSkillId = sk.id;
      const modal = document.getElementById('skillAutoLinkModal');
      if (!modal) return;

      document.getElementById('autoLinkSkillTitle').textContent = `#${sk.id} ${sk.namePtBr}`;
      const detElem = this.getSkillDetectedElement(sk);
      const sel = document.getElementById('autoLinkElementSelect');
      if (sel) {
        sel.value = detElem || 'WATER';
      }

      this.updateAutoLinkElementPreview();
      modal.style.display = 'flex';
    };

    app.closeAutoLinkModal = function () {
      const modal = document.getElementById('skillAutoLinkModal');
      if (modal) modal.style.display = 'none';
      this.autoLinkTargetSkillId = null;
    };

    app.updateAutoLinkElementPreview = function () {
      const sel = document.getElementById('autoLinkElementSelect');
      const previewBox = document.getElementById('autoLinkMonstersPreview');
      if (!sel || !previewBox) return;

      const elem = sel.value;
      const monsters = Array.isArray(this.monsters) ? this.monsters : [];
      const matching = elem === 'ALL'
        ? monsters
        : monsters.filter((m) => (m.fixedElementCode || 'NEUTRAL') === elem);

      if (matching.length === 0) {
        previewBox.innerHTML = `<span style="color:#f87171;">Nenhum monstro encontrado com o elemento <strong>${elem}</strong>.</span>`;
        return;
      }

      const names = matching.map((m) => `<strong>${m.namePtBr}</strong> (${m.code})`).join(', ');
      previewBox.innerHTML = `
        <div style="color:#86efac; font-weight:700; margin-bottom:4px;">
          🎯 ${matching.length} monstro(s) receberão esta habilidade:
        </div>
        <div style="color:#cbd5e1; font-size:0.75rem; line-height:1.35; max-height:80px; overflow-y:auto;">
          ${names}
        </div>`;
    };

    app.submitAutoLinkSkill = async function () {
      if (!this.autoLinkTargetSkillId) return;
      const sel = document.getElementById('autoLinkElementSelect');
      const elementCode = sel ? sel.value : 'ALL';

      try {
        const res = await this.api(`/api/admin/skill-templates/${this.autoLinkTargetSkillId}/auto-link-monsters`, {
          method: 'POST',
          body: JSON.stringify({ elementCode }),
        });

        if (res.linkedCount > 0) {
          alert(`✅ Sucesso! Habilidade "${res.skillName}" vinculada a ${res.linkedCount} monstros do elemento ${res.elementCode}!\n\nMonstros atualizados: ${res.monsterNames.join(', ')}`);
        } else {
          alert(`ℹ️ Todos os ${res.totalMonstersFound} monstros do elemento ${res.elementCode} já possuem esta habilidade vinculada.`);
        }

        this.closeAutoLinkModal();
        if (typeof this.loadMonstersData === 'function') {
          await this.loadMonstersData();
        }
      } catch (err) {
        console.error('Erro ao auto-vincular habilidade:', err);
        alert(`❌ Falha ao vincular habilidade: ${err?.message || err}`);
      }
    };

    AdminSkillsAutoLink.injectModalDom();
  }

  static injectModalDom() {
    if (document.getElementById('skillAutoLinkModal')) return;

    const modal = document.createElement('div');
    modal.id = 'skillAutoLinkModal';
    modal.className = 'modal-backdrop';
    modal.style.display = 'none';

    modal.innerHTML = `
    <div class="modal-box" style="max-width:540px; width:95%; padding:16px;">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:8px; margin-bottom:12px;">
        <h3 style="color:#38bdf8; margin:0; font-size:1.0rem;">🔗 Auto-Vincular Habilidade a Monstros</h3>
        <button class="btn-danger" onclick="AdminApp.closeAutoLinkModal()" style="padding:4px 8px;">✕</button>
      </div>

      <div style="background:rgba(15,23,42,0.85); border:1px solid #0284c7; border-radius:8px; padding:10px 12px; margin-bottom:12px;">
        <span style="font-size:0.75rem; color:#94a3b8;">Habilidade Selecionada:</span>
        <div id="autoLinkSkillTitle" style="font-size:0.95rem; font-weight:800; color:#fde047; margin-top:2px;"></div>
      </div>

      <div class="field" style="margin-bottom:12px;">
        <label style="font-size:0.78rem; font-weight:700; color:#38bdf8;">🔥 Escolha o Elemento dos Monstros Alvo:</label>
        <select id="autoLinkElementSelect" onchange="AdminApp.updateAutoLinkElementPreview()" style="padding:8px 10px; font-size:0.84rem;">
          <option value="WATER">💧 Elemento Água (WATER)</option>
          <option value="FIRE">🔥 Elemento Fogo (FIRE)</option>
          <option value="EARTH">🪨 Elemento Terra (EARTH)</option>
          <option value="AIR">🌪️ Elemento Ar / Vento (AIR)</option>
          <option value="NEUTRAL">⚪ Elemento Neutro (NEUTRAL)</option>
          <option value="ALL">🌍 Todos os Monstros (Qualquer Elemento)</option>
        </select>
        <div style="font-size:0.72rem; color:#94a3b8; margin-top:4px;">
          Todos os monstros que possuírem este elemento receberão esta habilidade na sua lista de combate.
        </div>
      </div>

      <div id="autoLinkMonstersPreview" style="background:#020617; border:1px solid var(--border); border-radius:8px; padding:10px; margin-bottom:14px; min-height:55px;"></div>

      <div style="display:flex; justify-content:flex-end; gap:8px;">
        <button type="button" class="btn-danger" onclick="AdminApp.closeAutoLinkModal()" style="padding:8px 14px;">Cancelar</button>
        <button type="button" class="btn-success" onclick="AdminApp.submitAutoLinkSkill()" style="padding:8px 18px; font-weight:700; background:#0284c7; border-color:#38bdf8;">
          ⚡ Confirmar Auto-Vínculo
        </button>
      </div>
    </div>`;

    document.body.appendChild(modal);
  }
}

window.AdminSkillsAutoLink = AdminSkillsAutoLink;
