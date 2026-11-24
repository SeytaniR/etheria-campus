/**
 * @file apps/server/public/admin/js/AdminMonsterConfigTab.js
 * @module @etheria/server
 * @description Aba "Configuração de Monstros" (`monster_global_configs`) na Rota `/admin`.
 *   Permite editar todos os modificadores globais de monstros no jogo e em Dungeons:
 *   - Ranks (F..SS): HP/MP (x), ATQ/Cura (x), DEF (x), Crítico (+%), Precisão (+), Peso Spawn, Chance (%) ao vivo, XP (x) e Ouro (x).
 *   - Hierarquia (Comum / Líder / Boss): atributos base (x), escala (x), drops, XP/Ouro (x), chances de spawn e limites.
 *   - Nível, Encontros e Penalidades de Mapa Acima/Abaixo.
 *   - Modificadores de Dungeons do Véu (Monstros Comuns e Boss).
 * @rules Segue estritamente AGENTS.md (Limite < 1.000 linhas, SRP, UI responsiva).
 */

class AdminMonsterConfigTab {
  static attach(app) {
    app.monsterGlobalConfig = null;
    app.monsterGlobalConfigDefaults = null;

    AdminMonsterConfigTab.injectTabDom();

    app.loadMonsterGlobalConfig = async function () {
      try {
        const res = await this.api('/api/admin/monster-config');
        this.monsterGlobalConfig = res?.config || null;
        this.monsterGlobalConfigDefaults = res?.defaults || null;
        this.renderMonsterConfigTab();
      } catch (err) {
        console.error('Erro ao carregar Configuração Global de Monstros:', err);
        const container = document.getElementById('monsterConfigContainer');
        if (container) {
          container.innerHTML = `<div style="padding:16px; color:#fca5a5;">Erro ao carregar configurações: ${this.escapeHtml(err.message)}</div>`;
        }
      }
    };

    app.renderMonsterConfigTab = function () {
      const container = document.getElementById('monsterConfigContainer');
      const cfg = this.monsterGlobalConfig;
      if (!container || !cfg) return;

      const ranks = ['F', 'D', 'C', 'B', 'A', 'S', 'SS'];
      const rankColors = { F: '#cbd5e1', D: '#fdba74', C: '#fde047', B: '#4ade80', A: '#38bdf8', S: '#c084fc', SS: '#fbbf24' };
      const variants = [
        { key: 'NORMAL', label: 'Comum (NORMAL)', color: '#cbd5e1' },
        { key: 'LEADER', label: '👑 Líder (LEADER)', color: '#38bdf8' },
        { key: 'BOSS', label: '💀 Boss (BOSS)', color: '#fb7185' },
      ];

      container.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:14px;">
          <!-- 1. RANKS F..SS -->
          <div style="background:rgba(15,23,42,0.8); border:1px solid #334155; border-radius:10px; padding:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:8px;">
              <div>
                <h4 style="margin:0; color:#fbbf24; font-size:0.95rem;">1️⃣ Multiplicadores & Chances de Spawn por Rank (F a SS)</h4>
                <div style="font-size:0.74rem; color:#94a3b8; margin-top:2px;">
                  Sorteio Justo Rank-First ativo: o jogo sorteia primeiro o Rank pelo Peso abaixo (e depois um monstro aleatório daquele Rank), então adicionar mais monstros raros no mapa <strong>NÃO aumenta</strong> a chance do Rank nascer.
                </div>
              </div>
              <span id="mcfgTotalWeightBadge" style="font-size:0.74rem; font-weight:700; color:#fde047; background:rgba(234,179,8,0.12); border:1px solid rgba(234,179,8,0.35); padding:4px 10px; border-radius:6px;"></span>
            </div>
            <div style="overflow-x:auto;">
              <table class="crud-table" style="width:100%; border-collapse:collapse; font-size:0.78rem;">
                <thead>
                  <tr style="background:#020617; border-bottom:2px solid #334155; text-align:left;">
                    <th style="padding:7px 8px;">Rank</th>
                    <th style="padding:7px 6px;">HP/MP (&times;)</th>
                    <th style="padding:7px 6px;">ATQ/Cura (&times;)</th>
                    <th style="padding:7px 6px;">DEF/MDEF (&times;)</th>
                    <th style="padding:7px 6px;">Crítico (+%)</th>
                    <th style="padding:7px 6px;">Precisão (+)</th>
                    <th style="padding:7px 6px;">Peso Spawn</th>
                    <th style="padding:7px 6px;">Chance (%)</th>
                    <th style="padding:7px 6px;">XP (&times;)</th>
                    <th style="padding:7px 6px;">Ouro (&times;)</th>
                  </tr>
                </thead>
                <tbody>
                  ${ranks.map((r) => {
                    const rc = cfg.rankConfigsJson?.[r] || {};
                    const col = rankColors[r] || '#e2e8f0';
                    return `
                      <tr style="border-bottom:1px solid #1e293b;">
                        <td style="padding:6px 8px; font-weight:800; color:${col};">Rank ${r}</td>
                        <td style="padding:4px;"><input type="number" step="0.05" min="0.1" id="mcfgRank_${r}_hpMult" value="${rc.hpMult ?? 1}" style="width:68px; padding:4px;" /></td>
                        <td style="padding:4px;"><input type="number" step="0.05" min="0.1" id="mcfgRank_${r}_atkMult" value="${rc.atkMult ?? 1}" style="width:68px; padding:4px;" /></td>
                        <td style="padding:4px;"><input type="number" step="0.05" min="0.1" id="mcfgRank_${r}_defMult" value="${rc.defMult ?? 1}" style="width:68px; padding:4px;" /></td>
                        <td style="padding:4px;"><input type="number" step="0.5" id="mcfgRank_${r}_critBonusPct" value="${rc.critBonusPct ?? 0}" style="width:64px; padding:4px;" /></td>
                        <td style="padding:4px;"><input type="number" step="1" id="mcfgRank_${r}_accBonus" value="${rc.accBonus ?? 0}" style="width:64px; padding:4px;" /></td>
                        <td style="padding:4px;"><input type="number" step="1" min="0" id="mcfgRank_${r}_spawnWeight" value="${rc.spawnWeight ?? 0}" oninput="AdminApp.updateMonsterRankChancesPreview()" style="width:74px; padding:4px; border-color:#f59e0b;" /></td>
                        <td style="padding:6px; font-weight:800; color:#4ade80; font-family:monospace;" id="mcfgRank_${r}_chancePct">—</td>
                        <td style="padding:4px;"><input type="number" step="0.05" min="0.01" id="mcfgRank_${r}_xpMult" value="${rc.xpMult ?? 1}" style="width:72px; padding:4px;" /></td>
                        <td style="padding:4px;"><input type="number" step="0.05" min="0" id="mcfgRank_${r}_goldMult" value="${rc.goldMult ?? 1}" style="width:72px; padding:4px;" /></td>
                      </tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <!-- 2. HIERARQUIA COMUM / LÍDER / BOSS -->
          <div style="background:rgba(15,23,42,0.8); border:1px solid #334155; border-radius:10px; padding:12px;">
            <h4 style="margin:0 0 8px 0; color:#38bdf8; font-size:0.95rem;">2️⃣ Hierarquia de Encontros: Comum, Líder & Boss</h4>
            <div style="overflow-x:auto;">
              <table class="crud-table" style="width:100%; border-collapse:collapse; font-size:0.78rem;">
                <thead>
                  <tr style="background:#020617; border-bottom:2px solid #334155; text-align:left;">
                    <th style="padding:7px 8px;">Patamar</th>
                    <th style="padding:7px 6px;">Atributos Base (&times;)</th>
                    <th style="padding:7px 6px;">Escala Visual (&times;)</th>
                    <th style="padding:7px 6px;">Rolagens Drop</th>
                    <th style="padding:7px 6px;">XP (&times;)</th>
                    <th style="padding:7px 6px;">Ouro (&times;)</th>
                    <th style="padding:7px 6px;">Chance Spawn (%)</th>
                    <th style="padding:7px 6px;">Regras Especiais</th>
                  </tr>
                </thead>
                <tbody>
                  ${variants.map((v) => {
                    const vc = cfg.variantConfigsJson?.[v.key] || {};
                    const extraHtml = v.key === 'LEADER'
                      ? `<label style="font-size:0.72rem; color:#cbd5e1;">Máx/Encontro: <input type="number" min="0" max="25" id="mcfgVar_LEADER_maxPerEncounter" value="${vc.maxPerEncounter ?? 2}" style="width:54px; padding:3px;" /></label>`
                      : v.key === 'BOSS'
                      ? `<label style="display:flex; align-items:center; gap:5px; font-size:0.72rem; color:#fca5a5; cursor:pointer;"><input type="checkbox" id="mcfgVar_BOSS_blocksLeaders" ${vc.blocksLeaders !== false ? 'checked' : ''} /> Bloqueia Líderes se nascer</label>`
                      : '<span style="color:#64748b; font-size:0.72rem;">Preenchimento padrão</span>';
                    return `
                      <tr style="border-bottom:1px solid #1e293b;">
                        <td style="padding:6px 8px; font-weight:800; color:${v.color};">${v.label}</td>
                        <td style="padding:4px;"><input type="number" step="0.1" min="0.1" id="mcfgVar_${v.key}_statMult" value="${vc.statMult ?? 1}" style="width:72px; padding:4px;" /></td>
                        <td style="padding:4px;"><input type="number" step="0.05" min="0.3" id="mcfgVar_${v.key}_scaleMult" value="${vc.scaleMult ?? 1}" style="width:72px; padding:4px;" /></td>
                        <td style="padding:4px;"><input type="number" step="1" min="1" id="mcfgVar_${v.key}_lootRolls" value="${vc.lootRolls ?? 1}" style="width:68px; padding:4px;" /></td>
                        <td style="padding:4px;"><input type="number" step="0.05" min="0.01" id="mcfgVar_${v.key}_xpMult" value="${vc.xpMult ?? 1}" style="width:78px; padding:4px;" /></td>
                        <td style="padding:4px;"><input type="number" step="0.05" min="0" id="mcfgVar_${v.key}_goldMult" value="${vc.goldMult ?? 1}" style="width:74px; padding:4px;" /></td>
                        <td style="padding:4px;">${v.key === 'NORMAL' ? '<span style="color:#64748b;">Restante</span>' : `<input type="number" step="0.5" min="0" max="100" id="mcfgVar_${v.key}_spawnChancePct" value="${vc.spawnChancePct ?? 0}" style="width:74px; padding:4px; border-color:${v.color};" />`}</td>
                        <td style="padding:4px 6px;">${extraHtml}</td>
                      </tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <!-- 3. NÍVEL, ENCONTROS & PENALIDADES -->
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(290px, 1fr)); gap:12px;">
            <div style="background:rgba(15,23,42,0.8); border:1px solid #334155; border-radius:10px; padding:12px;">
              <h4 style="margin:0 0 10px 0; color:#4ade80; font-size:0.9rem;">3️⃣ Nível, Escalonamento & Recompensa Base</h4>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                <div class="field"><label>Variação Nível Mín.</label><input type="number" id="mcfg_levelVarianceMin" value="${cfg.levelVarianceMin ?? -10}" /></div>
                <div class="field"><label>Variação Nível Máx.</label><input type="number" id="mcfg_levelVarianceMax" value="${cfg.levelVarianceMax ?? 10}" /></div>
                <div class="field"><label>Bônus Atributos/Nível (%)</label><input type="number" step="0.5" min="0" id="mcfg_levelStatBonusPct" value="${cfg.levelStatBonusPct ?? 20}" /></div>
                <div class="field"><label>Teto Máx. por Encontro</label><input type="number" min="1" max="50" id="mcfg_encounterMaxTotalCap" value="${cfg.encounterMaxTotalCap ?? 25}" /></div>
                <div class="field"><label>XP Base / Nível</label><input type="number" step="0.5" min="0.1" id="mcfg_baseUnitXpPerLevel" value="${cfg.baseUnitXpPerLevel ?? 28}" /></div>
                <div class="field"><label>Ouro Base / Nível</label><input type="number" step="0.5" min="0" id="mcfg_baseUnitGoldPerLevel" value="${cfg.baseUnitGoldPerLevel ?? 10}" /></div>
              </div>
            </div>

            <div style="background:rgba(15,23,42,0.8); border:1px solid #334155; border-radius:10px; padding:12px;">
              <h4 style="margin:0 0 10px 0; color:#fde047; font-size:0.9rem;">4️⃣ Quantidade por Encontro & Penalidade de Nível</h4>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                <div class="field"><label>Solo Mín. Monstros</label><input type="number" min="1" max="25" id="mcfg_encounterMinMonsters" value="${cfg.encounterMinMonsters ?? 2}" /></div>
                <div class="field"><label>Solo Máx. Monstros</label><input type="number" min="1" max="25" id="mcfg_encounterMaxMonsters" value="${cfg.encounterMaxMonsters ?? 6}" /></div>
                <div class="field"><label>Extra/Aliado Mín.</label><input type="number" min="0" max="10" id="mcfg_encounterExtraPerAllyMin" value="${cfg.encounterExtraPerAllyMin ?? 1}" /></div>
                <div class="field"><label>Extra/Aliado Máx.</label><input type="number" min="0" max="10" id="mcfg_encounterExtraPerAllyMax" value="${cfg.encounterExtraPerAllyMax ?? 2}" /></div>
                <div class="field"><label>Mapa Acima (+Níveis)</label><input type="number" min="1" id="mcfg_overlevelDiffThreshold" value="${cfg.overlevelDiffThreshold ?? 10}" /></div>
                <div class="field"><label>Redução Acima (%)</label><input type="number" step="1" min="0" max="100" id="mcfg_overlevelPenaltyPct" value="${cfg.overlevelPenaltyPct ?? 95}" /></div>
                <div class="field"><label>Mapa Abaixo (-Níveis)</label><input type="number" min="1" id="mcfg_underlevelDiffThreshold" value="${cfg.underlevelDiffThreshold ?? 30}" /></div>
                <div class="field"><label>Redução Abaixo (%)</label><input type="number" step="1" min="0" max="100" id="mcfg_underlevelPenaltyPct" value="${cfg.underlevelPenaltyPct ?? 50}" /></div>
              </div>
            </div>

            <div style="background:rgba(15,23,42,0.8); border:1px solid #7e22ce; border-radius:10px; padding:12px;">
              <h4 style="margin:0 0 10px 0; color:#e9d5ff; font-size:0.9rem;">5️⃣ Modificadores de Dungeons (Véu)</h4>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                <div class="field"><label>Comum HP (&times;)</label><input type="number" step="0.1" min="0.1" id="mcfg_dungeonNormalHpMult" value="${cfg.dungeonNormalHpMult ?? 2.0}" /></div>
                <div class="field"><label>Comum Dano Causado (&times;)</label><input type="number" step="0.05" min="0.05" id="mcfg_dungeonNormalDamageDealtMult" value="${cfg.dungeonNormalDamageDealtMult ?? 0.7}" /></div>
                <div class="field"><label>Comum Aggro (px)</label><input type="number" step="10" min="40" id="mcfg_dungeonNormalAggroRadius" value="${cfg.dungeonNormalAggroRadius ?? 210}" /></div>
                <div class="field"><label>Boss HP Extra (&times;)</label><input type="number" step="0.1" min="0.1" id="mcfg_dungeonBossHpMult" value="${cfg.dungeonBossHpMult ?? 3.0}" /></div>
                <div class="field"><label>Boss Dano Causado (&times;)</label><input type="number" step="0.05" min="0.05" id="mcfg_dungeonBossDamageDealtMult" value="${cfg.dungeonBossDamageDealtMult ?? 0.7}" /></div>
                <div class="field"><label>Boss Aggro (px)</label><input type="number" step="10" min="40" id="mcfg_dungeonBossAggroRadius" value="${cfg.dungeonBossAggroRadius ?? 250}" /></div>
              </div>
            </div>
          </div>
        </div>
      `;

      this.updateMonsterRankChancesPreview();
    };

    app.updateMonsterRankChancesPreview = function () {
      const ranks = ['F', 'D', 'C', 'B', 'A', 'S', 'SS'];
      const weights = ranks.map((r) => Math.max(0, Number(document.getElementById(`mcfgRank_${r}_spawnWeight`)?.value) || 0));
      const total = weights.reduce((a, b) => a + b, 0);
      const badge = document.getElementById('mcfgTotalWeightBadge');
      if (badge) badge.textContent = `Soma dos Pesos: ${total}`;
      ranks.forEach((r, idx) => {
        const cell = document.getElementById(`mcfgRank_${r}_chancePct`);
        if (cell) {
          const pct = total > 0 ? (weights[idx] / total) * 100 : (100 / ranks.length);
          cell.textContent = `${pct.toFixed(2)}%`;
        }
      });
    };

    app.saveMonsterGlobalConfig = async function () {
      const valNum = (id, fb) => {
        const v = Number(document.getElementById(id)?.value);
        return Number.isFinite(v) ? v : fb;
      };
      const ranks = ['F', 'D', 'C', 'B', 'A', 'S', 'SS'];
      const rankConfigsJson = {};
      for (const r of ranks) {
        rankConfigsJson[r] = {
          hpMult: valNum(`mcfgRank_${r}_hpMult`, 1),
          atkMult: valNum(`mcfgRank_${r}_atkMult`, 1),
          defMult: valNum(`mcfgRank_${r}_defMult`, 1),
          critBonusPct: valNum(`mcfgRank_${r}_critBonusPct`, 0),
          accBonus: valNum(`mcfgRank_${r}_accBonus`, 0),
          spawnWeight: valNum(`mcfgRank_${r}_spawnWeight`, 0),
          xpMult: valNum(`mcfgRank_${r}_xpMult`, 1),
          goldMult: valNum(`mcfgRank_${r}_goldMult`, 1),
        };
      }
      const payload = {
        levelVarianceMin: valNum('mcfg_levelVarianceMin', -10),
        levelVarianceMax: valNum('mcfg_levelVarianceMax', 10),
        levelStatBonusPct: valNum('mcfg_levelStatBonusPct', 20),
        baseUnitXpPerLevel: valNum('mcfg_baseUnitXpPerLevel', 28),
        baseUnitGoldPerLevel: valNum('mcfg_baseUnitGoldPerLevel', 10),
        encounterMinMonsters: valNum('mcfg_encounterMinMonsters', 2),
        encounterMaxMonsters: valNum('mcfg_encounterMaxMonsters', 6),
        encounterExtraPerAllyMin: valNum('mcfg_encounterExtraPerAllyMin', 1),
        encounterExtraPerAllyMax: valNum('mcfg_encounterExtraPerAllyMax', 2),
        encounterMaxTotalCap: valNum('mcfg_encounterMaxTotalCap', 25),
        overlevelDiffThreshold: valNum('mcfg_overlevelDiffThreshold', 10),
        overlevelPenaltyPct: valNum('mcfg_overlevelPenaltyPct', 95),
        underlevelDiffThreshold: valNum('mcfg_underlevelDiffThreshold', 30),
        underlevelPenaltyPct: valNum('mcfg_underlevelPenaltyPct', 50),
        dungeonNormalHpMult: valNum('mcfg_dungeonNormalHpMult', 2.0),
        dungeonNormalDamageDealtMult: valNum('mcfg_dungeonNormalDamageDealtMult', 0.7),
        dungeonNormalAggroRadius: valNum('mcfg_dungeonNormalAggroRadius', 210),
        dungeonBossHpMult: valNum('mcfg_dungeonBossHpMult', 3.0),
        dungeonBossDamageDealtMult: valNum('mcfg_dungeonBossDamageDealtMult', 0.7),
        dungeonBossAggroRadius: valNum('mcfg_dungeonBossAggroRadius', 250),
        variantConfigsJson: {
          NORMAL: {
            statMult: valNum('mcfgVar_NORMAL_statMult', 1),
            scaleMult: valNum('mcfgVar_NORMAL_scaleMult', 1),
            lootRolls: valNum('mcfgVar_NORMAL_lootRolls', 1),
            xpMult: valNum('mcfgVar_NORMAL_xpMult', 1),
            goldMult: valNum('mcfgVar_NORMAL_goldMult', 1),
          },
          LEADER: {
            statMult: valNum('mcfgVar_LEADER_statMult', 2),
            scaleMult: valNum('mcfgVar_LEADER_scaleMult', 1.28),
            lootRolls: valNum('mcfgVar_LEADER_lootRolls', 2),
            xpMult: valNum('mcfgVar_LEADER_xpMult', 1.1765),
            goldMult: valNum('mcfgVar_LEADER_goldMult', 1.3),
            spawnChancePct: valNum('mcfgVar_LEADER_spawnChancePct', 30),
            maxPerEncounter: valNum('mcfgVar_LEADER_maxPerEncounter', 2),
          },
          BOSS: {
            statMult: valNum('mcfgVar_BOSS_statMult', 4),
            scaleMult: valNum('mcfgVar_BOSS_scaleMult', 1.65),
            lootRolls: valNum('mcfgVar_BOSS_lootRolls', 4),
            xpMult: valNum('mcfgVar_BOSS_xpMult', 1.4286),
            goldMult: valNum('mcfgVar_BOSS_goldMult', 1.5),
            spawnChancePct: valNum('mcfgVar_BOSS_spawnChancePct', 5),
            blocksLeaders: Boolean(document.getElementById('mcfgVar_BOSS_blocksLeaders')?.checked),
          },
        },
        rankConfigsJson,
      };

      try {
        const res = await this.api('/api/admin/monster-config', { method: 'PUT', body: JSON.stringify(payload) });
        this.monsterGlobalConfig = res.config;
        this.renderMonsterConfigTab();
        alert('✅ Configuração Global de Monstros salva no banco + snapshot e aplicada imediatamente!');
      } catch (err) {
        alert(`Erro ao salvar Configuração de Monstros: ${err.message}`);
      }
    };

    app.resetMonsterGlobalConfig = async function () {
      if (!confirm('Restaurar todos os parâmetros de Configuração de Monstros para os valores padrão originais?')) return;
      try {
        const res = await this.api('/api/admin/monster-config/reset', { method: 'POST' });
        this.monsterGlobalConfig = res.config;
        this.renderMonsterConfigTab();
        alert('↺ Configuração Global de Monstros restaurada aos padrões!');
      } catch (err) {
        alert(`Erro ao restaurar padrões: ${err.message}`);
      }
    };
  }

  static injectTabDom() {
    const adminApp = document.getElementById('adminApp');
    if (!adminApp || document.getElementById('tabMonsterConfig')) return;

    const panel = document.createElement('div');
    panel.id = 'tabMonsterConfig';
    panel.style.cssText = 'display:none; padding:14px; max-width:1320px; margin:0 auto; width:100%; gap:14px; flex-direction:column; box-sizing:border-box;';
    panel.innerHTML = `
      <div class="panel" style="padding:14px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; border-bottom:1px solid #334155; padding-bottom:10px; margin-bottom:12px;">
          <div>
            <h3 style="margin:0; font-size:1.08rem; color:#f97316;">⚙️ Configuração de Monstros (<code>monster_global_configs</code>)</h3>
            <p style="font-size:0.78rem; color:var(--text-muted); margin:4px 0 0;">
              Controle centralizado de modificadores por Rank (F..SS), Hierarquia (Comum/Líder/Boss), escalonamento de nível, encontros e Dungeons.
            </p>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button type="button" onclick="AdminApp.resetMonsterGlobalConfig()" style="padding:8px 14px; font-weight:700; border-color:#64748b;">↺ Restaurar Padrões</button>
            <button type="button" class="btn-success" onclick="AdminApp.saveMonsterGlobalConfig()" style="padding:8px 18px; font-weight:800;">💾 Salvar Configuração de Monstros</button>
          </div>
        </div>
        <div id="monsterConfigContainer">
          <div style="padding:20px; text-align:center; color:#94a3b8;">⏳ Carregando configuração global de monstros...</div>
        </div>
      </div>
    `;
    adminApp.appendChild(panel);
  }
}

window.AdminMonsterConfigTab = AdminMonsterConfigTab;
