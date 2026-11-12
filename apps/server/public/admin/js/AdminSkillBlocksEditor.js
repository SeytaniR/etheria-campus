/**
 * @file apps/server/public/admin/js/AdminSkillBlocksEditor.js
 * @module @etheria/server
 * @description Submódulo No-Code para criação e edição visual de todos os Blocos de Efeito de Habilidades
 *   (`DAMAGE`, `HEAL`, `SHIELD`, `STATUS`, `CLEANSE_DISPEL`, `RESOURCE_COOLDOWN`) na Rota `/admin`.
 * @rules Extraído para manter todos os arquivos abaixo de 1.000 linhas (Regra #7) e zero lógica duplicada.
 * @dependencies AdminSkillsAndBuffsTab
 */

class AdminSkillBlocksEditor {
  static attach(app) {
    const SCALE_STATS = [
      { code: 'PHYS_ATK', label: '🗡️ Ataque Físico (PHYS_ATK)' },
      { code: 'MAG_ATK', label: '🔮 Ataque Mágico (MAG_ATK)' },
      { code: 'HEAL_POWER', label: '💚 Poder de Cura (HEAL_POWER)' },
      { code: 'MAX_HP', label: '❤️ Vida Máxima (MAX_HP)' },
      { code: 'MAX_MP', label: '💧 Mana Máxima (MAX_MP)' },
      { code: 'PHYS_DEF', label: '🛡️ Defesa Física (PHYS_DEF)' },
      { code: 'MAG_DEF', label: '✨ Defesa Mágica (MAG_DEF)' },
      { code: 'ATK', label: '⚔️ Ataque Geral (ATK)' },
      { code: 'SPEED', label: '⚡ Velocidade (SPEED)' },
    ];

    const buildStatOptions = (selected, includeNone = false) => {
      const noneOpt = includeNone
        ? `<option value="NONE" ${!selected || selected === 'NONE' ? 'selected' : ''}>— Nenhum (Apenas 1 escalador) —</option>`
        : '';
      return noneOpt + SCALE_STATS.map((s) => `<option value="${s.code}" ${selected === s.code ? 'selected' : ''}>${s.label}</option>`).join('');
    };

    const opt = (val, label, cur) => `<option value="${val}" ${cur === val ? 'selected' : ''}>${label}</option>`;

    app.buildDefaultSkillBlock = function (blockType) {
      switch (blockType) {
        case 'DAMAGE':
          return {
            blockType: 'DAMAGE',
            damageType: 'PHYSICAL',
            elementCode: 'INHERIT',
            scaleStat: 'PHYS_ATK',
            scalePct: 140,
            secondaryScaleStat: 'NONE',
            secondaryScalePct: 0,
            flatAmount: 0,
            armorPenPct: 0,
            lifestealPct: 0,
            critBonusPct: 0,
            bonusPerAnomalyPct: 0,
            executeHpBelowPct: 0,
            executeBonusDmgPct: 0,
            healCasterMaxHpPerHitPct: 0,
            cdReduceOnCritSec: 0,
          };
        case 'HEAL':
          return {
            blockType: 'HEAL',
            targetMode: 'ALLY_SINGLE',
            targetSelf: false,
            scaleSource: 'CASTER',
            scaleStat: 'HEAL_POWER',
            scalePct: 150,
            secondaryScaleStat: 'NONE',
            secondaryScalePct: 0,
            flatAmount: 0,
          };
        case 'SHIELD':
          return {
            blockType: 'SHIELD',
            targetMode: 'SELF',
            targetSelf: true,
            scaleSource: 'CASTER',
            scaleStat: 'MAX_HP',
            scalePct: 20,
            secondaryScaleStat: 'NONE',
            secondaryScalePct: 0,
            flatAmount: 0,
            durationSeconds: 6.0,
            durationTurns: 6,
          };
        case 'STATUS': {
          const firstStatusId = this.statusEffectTemplates?.[0]?.id || 1;
          return {
            blockType: 'STATUS',
            statusEffectId: firstStatusId,
            targetMode: 'TARGET',
            targetSelf: false,
            applyChancePct: 100,
            durationSeconds: 4.0,
            durationTurns: 4,
            firstTickOnly: false,
          };
        }
        case 'CLEANSE_DISPEL':
          return {
            blockType: 'CLEANSE_DISPEL',
            cleanseTarget: 'SELF',
            cleanseFilter: 'ALL',
            targetSelf: true,
            maxDebuffs: 1,
            cleanseChancePct: 100,
            healPerDebuffPct: 0,
          };
        case 'RESOURCE_COOLDOWN':
          return {
            blockType: 'RESOURCE_COOLDOWN',
            resourceAction: 'RESTORE_MP_PCT',
            resourceTarget: 'ALLY_ALL',
            amount: 15,
          };
        default:
          return { blockType };
      }
    };

    app.formatSkillBlocksSummary = function (blocks) {
      if (!Array.isArray(blocks) || blocks.length === 0) return '<em>Sem blocos</em>';
      return blocks
        .map((b) => {
          const secStr = b.secondaryScaleStat && b.secondaryScaleStat !== 'NONE' && Number(b.secondaryScalePct) > 0
            ? ` + ${b.secondaryScalePct}% ${b.secondaryScaleStat}` : '';
          const flatStr = Number(b.flatAmount) > 0 ? ` + ${b.flatAmount}` : '';
          if (b.blockType === 'DAMAGE') {
            const extras = [];
            if (Number(b.armorPenPct) > 0) extras.push(`PEN ${b.armorPenPct}%`);
            if (Number(b.lifestealPct) > 0) extras.push(`Dreno ${b.lifestealPct}%`);
            if (Number(b.bonusPerAnomalyPct) > 0) extras.push(`+${b.bonusPerAnomalyPct}%/anomalia`);
            if (Number(b.executeHpBelowPct) > 0) extras.push(`Exec.<${b.executeHpBelowPct}%:+${b.executeBonusDmgPct || 0}%`);
            if (Number(b.cdReduceOnCritSec) > 0) extras.push(`Crit -${b.cdReduceOnCritSec}s CD`);
            if (Number(b.healCasterMaxHpPerHitPct) > 0) extras.push(`+${b.healCasterMaxHpPerHitPct}%HP/alvo`);
            const exTxt = extras.length ? ` [${extras.join(', ')}]` : '';
            return `💥 Dano (${b.damageType || 'PHYSICAL'}): ${b.scalePct || 100}% ${b.scaleStat || 'ATK'}${secStr}${flatStr}${exTxt}`;
          }
          if (b.blockType === 'HEAL') {
            const tgt = b.targetMode || (b.targetSelf ? 'SELF' : 'TARGET');
            return `💚 Cura (${tgt}): ${b.scalePct || 100}% ${b.scaleStat || 'HEAL_POWER'}${secStr}${flatStr}`;
          }
          if (b.blockType === 'SHIELD') {
            const tgt = b.targetMode || 'SELF';
            const dur = b.durationSeconds ?? b.durationTurns ?? 5;
            return `🛡️ Escudo (${tgt}): ${b.scalePct || 20}% ${b.scaleStat || 'MAX_HP'}${secStr}${flatStr} (${dur}s)`;
          }
          if (b.blockType === 'STATUS') {
            const st = (this.statusEffectTemplates || []).find((s) => Number(s.id) === Number(b.statusEffectId));
            const dur = b.durationSeconds ?? b.durationTurns ?? (st?.durationSeconds ?? 5);
            const tMode = b.targetMode || (b.targetSelf ? 'SELF' : 'TARGET');
            return `🧪 [${st ? st.namePtBr : `Status #${b.statusEffectId}`}] (${tMode}, ${b.applyChancePct ?? 100}%, ${dur}s${b.firstTickOnly ? ', 1º tick' : ''})`;
          }
          if (b.blockType === 'CLEANSE_DISPEL' || b.blockType === 'CLEANSE') {
            const qtyTxt = Number(b.maxDebuffs) > 0 ? `até ${b.maxDebuffs}` : 'Todos';
            const fTxt = b.cleanseFilter && b.cleanseFilter !== 'ALL' ? ` [${b.cleanseFilter}]` : '';
            return `✨ Purificar${fTxt} (${qtyTxt}, ${b.cleanseChancePct ?? 100}%)`;
          }
          if (b.blockType === 'RESOURCE_COOLDOWN') {
            const unit = b.resourceAction === 'RESTORE_MP_PCT' ? '% MAX_MP' : (b.resourceAction === 'REDUCE_OTHER_CDS_SEC' ? 's CD' : ' MP');
            return `⚡ Recurso (${b.resourceTarget || 'SELF'}): +${b.amount || 0}${unit}`;
          }
          return b.blockType;
        })
        .join('<br/>');
    };

    app.renderSingleSkillBlockCard = function (blk, i) {
      const upd = (f, expr = 'this.value', isNum = false, isBool = false) =>
        `AdminApp.updateVisualSkillBlockField(${i}, '${f}', ${expr}, ${isNum}, ${isBool})`;

      if (blk.blockType === 'DAMAGE') {
        const secStat = blk.secondaryScaleStat || 'NONE';
        return `
        <div style="background:#020617; border:1px solid #f43f5e; border-radius:8px; padding:10px; display:flex; flex-direction:column; gap:8px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong style="color:#fb7185; font-size:0.82rem;">💥 Bloco #${i + 1}: Causar Dano (Action & Composto)</strong>
            <button type="button" class="btn-danger" onclick="AdminApp.removeVisualSkillBlock(${i})" style="padding:2px 8px; font-size:0.72rem;">🗑️ Remover</button>
          </div>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(135px, 1fr)); gap:8px;">
            <div><label style="font-size:0.7rem;">Natureza do Dano</label>
              <select onchange="${upd('damageType')}">${opt('PHYSICAL', '🗡️ Físico', blk.damageType)}${opt('MAGICAL', '🔮 Mágico', blk.damageType)}${opt('TRUE', '⚡ Verdadeiro (Ignora Def)', blk.damageType)}</select>
            </div>
            <div><label style="font-size:0.7rem;">Elemento</label>
              <select onchange="${upd('elementCode')}">${opt('INHERIT', '🔄 Herdar do Conjurador', blk.elementCode)}${opt('FIRE', '🔥 Fogo', blk.elementCode)}${opt('WATER', '💧 Água', blk.elementCode)}${opt('EARTH', '🪨 Terra', blk.elementCode)}${opt('AIR', '🌪️ Ar', blk.elementCode)}${opt('NEUTRAL', '⚪ Neutro', blk.elementCode)}</select>
            </div>
            <div><label style="font-size:0.7rem;">Escalador Principal</label>
              <select onchange="${upd('scaleStat')}">${buildStatOptions(blk.scaleStat || 'PHYS_ATK')}</select>
            </div>
            <div><label style="font-size:0.7rem;">Mult. Principal (%)</label>
              <input type="number" value="${blk.scalePct ?? 140}" onchange="${upd('scalePct', 'this.value', true)}" />
            </div>
            <div><label style="font-size:0.7rem;">2º Escalador (Opcional)</label>
              <select onchange="${upd('secondaryScaleStat')}">${buildStatOptions(secStat, true)}</select>
            </div>
            <div><label style="font-size:0.7rem;">Mult. 2º Escalador (%)</label>
              <input type="number" value="${blk.secondaryScalePct ?? 0}" onchange="${upd('secondaryScalePct', 'this.value', true)}" />
            </div>
            <div><label style="font-size:0.7rem;">+ Dano Fixo Base</label>
              <input type="number" value="${blk.flatAmount ?? 0}" onchange="${upd('flatAmount', 'this.value', true)}" />
            </div>
            <div><label style="font-size:0.7rem;">Perfuração Def (% PEN)</label>
              <input type="number" min="0" max="100" value="${blk.armorPenPct ?? 0}" onchange="${upd('armorPenPct', 'this.value', true)}" />
            </div>
            <div><label style="font-size:0.7rem;">Bônus Crítico (%)</label>
              <input type="number" value="${blk.critBonusPct ?? 0}" onchange="${upd('critBonusPct', 'this.value', true)}" />
            </div>
            <div><label style="font-size:0.7rem;">Dreno Vida (% Dano)</label>
              <input type="number" min="0" max="100" value="${blk.lifestealPct ?? 0}" onchange="${upd('lifestealPct', 'this.value', true)}" />
            </div>
            <div><label style="font-size:0.7rem;">+% Dano / Anomalia Alvo</label>
              <input type="number" min="0" max="300" value="${blk.bonusPerAnomalyPct ?? 0}" onchange="${upd('bonusPerAnomalyPct', 'this.value', true)}" />
            </div>
            <div><label style="font-size:0.7rem;">Execução: Alvo HP &lt; (%)</label>
              <input type="number" min="0" max="99" value="${blk.executeHpBelowPct ?? 0}" onchange="${upd('executeHpBelowPct', 'this.value', true)}" />
            </div>
            <div><label style="font-size:0.7rem;">Execução: +% Dano Extra</label>
              <input type="number" min="0" max="500" value="${blk.executeBonusDmgPct ?? 0}" onchange="${upd('executeBonusDmgPct', 'this.value', true)}" />
            </div>
            <div><label style="font-size:0.7rem;">Cura +% MAX_HP / Inimigo</label>
              <input type="number" min="0" max="100" value="${blk.healCasterMaxHpPerHitPct ?? 0}" onchange="${upd('healCasterMaxHpPerHitPct', 'this.value', true)}" />
            </div>
            <div><label style="font-size:0.7rem;">Crítico: -CD Outras (s)</label>
              <input type="number" min="0" max="30" step="0.5" value="${blk.cdReduceOnCritSec ?? 0}" onchange="${upd('cdReduceOnCritSec', 'this.value', true)}" />
            </div>
          </div>
          <div style="font-size:0.74rem; color:#fde047; background:rgba(253,224,71,0.08); padding:4px 8px; border-radius:4px;">
            📐 <strong>Fórmula:</strong> ${blk.scalePct ?? 140}% ${blk.scaleStat || 'PHYS_ATK'}${secStat !== 'NONE' && Number(blk.secondaryScalePct) > 0 ? ` + ${blk.secondaryScalePct}% ${secStat}` : ''}${Number(blk.flatAmount) > 0 ? ` + ${blk.flatAmount}` : ''} (${blk.damageType || 'PHYSICAL'})
          </div>
        </div>`;
      }

      if (blk.blockType === 'HEAL') {
        const tgtMode = blk.targetMode || (blk.targetSelf ? 'SELF' : 'ALLY_SINGLE');
        const src = blk.scaleSource || 'CASTER';
        const secStat = blk.secondaryScaleStat || 'NONE';
        return `
        <div style="background:#020617; border:1px solid #22c55e; border-radius:8px; padding:10px; display:flex; flex-direction:column; gap:8px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong style="color:#86efac; font-size:0.82rem;">💚 Bloco #${i + 1}: Restaurar Vida (Cura Simples ou Composta)</strong>
            <button type="button" class="btn-danger" onclick="AdminApp.removeVisualSkillBlock(${i})" style="padding:2px 8px; font-size:0.72rem;">🗑️ Remover</button>
          </div>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:8px;">
            <div><label style="font-size:0.7rem;">Quem Recebe a Cura?</label>
              <select onchange="${upd('targetMode')}; AdminApp.updateVisualSkillBlockField(${i}, 'targetSelf', this.value === 'SELF', false, true);">
                ${opt('TARGET', '🎯 Alvo da Habilidade', tgtMode)}
                ${opt('SELF', '🙋 Próprio Conjurador', tgtMode)}
                ${opt('ALLY_SINGLE', '💚 1 Aliado', tgtMode)}
                ${opt('ALLY_LOWEST_HP_PCT', '🩹 Aliado com Menor % HP', tgtMode)}
                ${opt('ALLY_ALL', '✨ Todos Aliados na Área', tgtMode)}
              </select>
            </div>
            <div><label style="font-size:0.7rem;">Base do Atributo</label>
              <select onchange="${upd('scaleSource')}">${opt('CASTER', '🧙 Do Conjurador', src)}${opt('TARGET', '🎯 Do Alvo Curado', src)}</select>
            </div>
            <div><label style="font-size:0.7rem;">Escalador Principal</label>
              <select onchange="${upd('scaleStat')}">${buildStatOptions(blk.scaleStat || 'HEAL_POWER')}</select>
            </div>
            <div><label style="font-size:0.7rem;">Mult. Principal (%)</label>
              <input type="number" value="${blk.scalePct ?? 150}" onchange="${upd('scalePct', 'this.value', true)}" />
            </div>
            <div><label style="font-size:0.7rem;">2º Escalador (Opcional)</label>
              <select onchange="${upd('secondaryScaleStat')}">${buildStatOptions(secStat, true)}</select>
            </div>
            <div><label style="font-size:0.7rem;">Mult. 2º Escalador (%)</label>
              <input type="number" value="${blk.secondaryScalePct ?? 0}" onchange="${upd('secondaryScalePct', 'this.value', true)}" />
            </div>
            <div><label style="font-size:0.7rem;">+ Cura Fixa Base</label>
              <input type="number" value="${blk.flatAmount ?? 0}" onchange="${upd('flatAmount', 'this.value', true)}" />
            </div>
          </div>
        </div>`;
      }

      if (blk.blockType === 'SHIELD') {
        const tgtMode = blk.targetMode || (blk.targetSelf === false ? 'ALLY_ALL' : 'SELF');
        const src = blk.scaleSource || 'CASTER';
        const secStat = blk.secondaryScaleStat || 'NONE';
        return `
        <div style="background:#020617; border:1px solid #38bdf8; border-radius:8px; padding:10px; display:flex; flex-direction:column; gap:8px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong style="color:#7dd3fc; font-size:0.82rem;">🛡️ Bloco #${i + 1}: Escudo Protetor / Barreira de Absorção</strong>
            <button type="button" class="btn-danger" onclick="AdminApp.removeVisualSkillBlock(${i})" style="padding:2px 8px; font-size:0.72rem;">🗑️ Remover</button>
          </div>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(135px, 1fr)); gap:8px;">
            <div><label style="font-size:0.7rem;">Quem Recebe o Escudo?</label>
              <select onchange="${upd('targetMode')}; AdminApp.updateVisualSkillBlockField(${i}, 'targetSelf', this.value === 'SELF', false, true);">
                ${opt('SELF', '🙋 Próprio Conjurador (Self)', tgtMode)}
                ${opt('ALLY_SINGLE', '🛡️ 1 Aliado Alvo', tgtMode)}
                ${opt('ALLY_ALL', '✨ Aliados na Área / Grupo', tgtMode)}
              </select>
            </div>
            <div><label style="font-size:0.7rem;">Base do Atributo</label>
              <select onchange="${upd('scaleSource')}">${opt('CASTER', '🧙 Do Conjurador', src)}${opt('TARGET', '🎯 Do Alvo Protegido', src)}</select>
            </div>
            <div><label style="font-size:0.7rem;">Escalador Principal</label>
              <select onchange="${upd('scaleStat')}">${buildStatOptions(blk.scaleStat || 'MAX_HP')}</select>
            </div>
            <div><label style="font-size:0.7rem;">Mult. Principal (%)</label>
              <input type="number" value="${blk.scalePct ?? 20}" onchange="${upd('scalePct', 'this.value', true)}" />
            </div>
            <div><label style="font-size:0.7rem;">2º Escalador (Opcional)</label>
              <select onchange="${upd('secondaryScaleStat')}">${buildStatOptions(secStat, true)}</select>
            </div>
            <div><label style="font-size:0.7rem;">Mult. 2º Escalador (%)</label>
              <input type="number" value="${blk.secondaryScalePct ?? 0}" onchange="${upd('secondaryScalePct', 'this.value', true)}" />
            </div>
            <div><label style="font-size:0.7rem;">+ Escudo Fixo Base</label>
              <input type="number" value="${blk.flatAmount ?? 0}" onchange="${upd('flatAmount', 'this.value', true)}" />
            </div>
            <div><label style="font-size:0.7rem;">Duração (Segundos)</label>
              <input type="number" min="0.5" max="60" step="0.5" value="${blk.durationSeconds ?? blk.durationTurns ?? 6}" onchange="${upd('durationSeconds', 'this.value', true)}" />
            </div>
          </div>
        </div>`;
      }

      if (blk.blockType === 'STATUS') {
        const statusOptionsHtml = (this.statusEffectTemplates || [])
          .map((st) => `<option value="${st.id}" ${Number(blk.statusEffectId) === Number(st.id) ? 'selected' : ''}>#${st.id} ${st.isBuff ? '🟢 [BUFF]' : '🔴 [DEBUFF]'} ${st.namePtBr}</option>`)
          .join('');
        const tMode = blk.targetMode || (blk.targetSelf ? 'SELF' : 'TARGET');
        return `
        <div style="background:#020617; border:1px solid #c084fc; border-radius:8px; padding:10px; display:flex; flex-direction:column; gap:8px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong style="color:#d8b4fe; font-size:0.82rem;">🧪 Bloco #${i + 1}: Aplicar Buff ou Debuff da Tabela</strong>
            <button type="button" class="btn-danger" onclick="AdminApp.removeVisualSkillBlock(${i})" style="padding:2px 8px; font-size:0.72rem;">🗑️ Remover</button>
          </div>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:8px;">
            <div><label style="font-size:0.7rem;">Buff / Debuff a Aplicar</label>
              <select onchange="${upd('statusEffectId', 'this.value', true)}">${statusOptionsHtml}</select>
            </div>
            <div><label style="font-size:0.7rem;">Aplicar em Quem?</label>
              <select onchange="${upd('targetMode')}; AdminApp.updateVisualSkillBlockField(${i}, 'targetSelf', this.value === 'SELF', false, true);">
                ${opt('TARGET', '🎯 No(s) Alvo(s) da Skill', tMode)}
                ${opt('SELF', '🙋 No Próprio Conjurador', tMode)}
                ${opt('ALLY_ALL', '✨ Nos Aliados na Área', tMode)}
              </select>
            </div>
            <div><label style="font-size:0.7rem;">Chance de Aplicar (%)</label>
              <input type="number" min="1" max="100" value="${blk.applyChancePct ?? 100}" onchange="${upd('applyChancePct', 'this.value', true)}" />
            </div>
            <div><label style="font-size:0.7rem;">Duração (Segundos)</label>
              <input type="number" min="0.5" max="60" step="0.5" value="${blk.durationSeconds ?? blk.durationTurns ?? 5}" onchange="${upd('durationSeconds', 'this.value', true)}" />
            </div>
            <div style="display:flex; align-items:flex-end; padding-bottom:4px;">
              <label style="display:flex; align-items:center; gap:5px; font-size:0.71rem; cursor:pointer; color:#fde047;">
                <input type="checkbox" ${blk.firstTickOnly ? 'checked' : ''} onchange="${upd('firstTickOnly', 'this.checked', false, true)}" />
                Somente 1º pulso (Zona AoE)
              </label>
            </div>
          </div>
        </div>`;
      }

      if (blk.blockType === 'CLEANSE_DISPEL' || blk.blockType === 'CLEANSE') {
        return typeof this.renderCleanseSkillBlockCard === 'function' ? this.renderCleanseSkillBlockCard(blk, i) : '';
      }

      if (blk.blockType === 'RESOURCE_COOLDOWN') {
        return `
        <div style="background:#020617; border:1px solid #f59e0b; border-radius:8px; padding:10px; display:flex; flex-direction:column; gap:8px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong style="color:#fbbf24; font-size:0.82rem;">⚡ Bloco #${i + 1}: Recurso (MP) / Redução de Recarga</strong>
            <button type="button" class="btn-danger" onclick="AdminApp.removeVisualSkillBlock(${i})" style="padding:2px 8px; font-size:0.72rem;">🗑️ Remover</button>
          </div>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:8px;">
            <div><label style="font-size:0.7rem;">Ação de Recurso / CD</label>
              <select onchange="${upd('resourceAction')}">
                ${opt('RESTORE_MP_PCT', '💧 Regenerar % do MAX_MP', blk.resourceAction)}
                ${opt('RESTORE_MP_FLAT', '💧 Regenerar MP Fixo', blk.resourceAction)}
                ${opt('REDUCE_OTHER_CDS_SEC', '⏳ Reduzir CD Outras Skills (s)', blk.resourceAction)}
              </select>
            </div>
            <div><label style="font-size:0.7rem;">Quem Recebe?</label>
              <select onchange="${upd('resourceTarget')}">
                ${opt('SELF', '🙋 Próprio Conjurador', blk.resourceTarget)}
                ${opt('ALLY_ALL', '✨ Todos Aliados / Área', blk.resourceTarget)}
                ${opt('TARGET', '🎯 Alvo da Skill', blk.resourceTarget)}
              </select>
            </div>
            <div><label style="font-size:0.7rem;">Valor (% ou segundos ou MP)</label>
              <input type="number" min="0" step="0.5" value="${blk.amount ?? 15}" onchange="${upd('amount', 'this.value', true)}" />
            </div>
          </div>
        </div>`;
      }

      return '';
    };
  }
}

window.AdminSkillBlocksEditor = AdminSkillBlocksEditor;
