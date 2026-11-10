/**
 * @file apps/server/public/admin/js/AdminExperienceTab.js
 * @module @etheria/server
 * @description Submódulo da Aba Tabela de Níveis e Experiência (`level_experience_templates`) da Rota `/admin`.
 *   - Permite geração procedural global com base numérica (Base XP, Exponente, Incremento Linear, Bônus).
 *   - Permite edições em lote de 10 em 10 níveis (Grupos / Brackets: 1-10, 11-20, etc.) com multiplicadores e recompensas.
 *   - Permite ajuste fino individual de cada nível com recálculo automático da curva acumulada total.
 *   - Gráfico 2D Canvas interativo em tempo real com faixas coloridas para cada bracket de 10 níveis.
 */

class AdminExperienceTab {
  static attach(app) {
    app.levelExperienceTemplates = [];
    app.experienceBracketFilter = 'ALL';
    app.xpCurveHoverIndex = -1;

    AdminExperienceTab.injectTabAndModalDom();

    app.loadLevelExperienceTemplates = async function (bracket) {
      try {
        const query = typeof bracket === 'number' && bracket > 0 ? `?bracket=${bracket}` : '';
        this.levelExperienceTemplates = await this.api(`/api/admin/experience${query}`);
        this.renderExperienceCrudTable();
        this.renderXpCurveCanvas();
      } catch (err) {
        console.error('Falha ao carregar tabela de níveis e experiência:', err);
      }
    };

    app.setExperienceBracketFilter = function (bracket) {
      this.experienceBracketFilter = bracket;
      const chips = document.querySelectorAll('.xp-bracket-chip');
      chips.forEach((c) => {
        c.className = c.dataset.bracket === String(bracket) ? 'btn-primary xp-bracket-chip' : 'xp-bracket-chip';
      });
      this.renderExperienceCrudTable();
      this.renderXpCurveCanvas();
    };

    app.openProceduralCurveModal = function () {
      const modal = document.getElementById('xpProceduralModal');
      if (modal) modal.style.display = 'flex';
    };

    app.applyProceduralCurve = async function () {
      const baseExperience = Number(document.getElementById('procBaseXpInput')?.value) || 100;
      const growthExponent = Number(document.getElementById('procExponentInput')?.value) || 1.48;
      const flatIncrement = Number(document.getElementById('procFlatIncInput')?.value) || 60;
      const maxLevel = Number(document.getElementById('procMaxLevelInput')?.value) || 100;
      const statPointsReward = Number(document.getElementById('procStatPtsInput')?.value) ?? 5;
      const skillPointsReward = Number(document.getElementById('procSkillPtsInput')?.value) ?? 1;
      const hpBonus = Number(document.getElementById('procHpBonusInput')?.value) ?? 25;
      const mpBonus = Number(document.getElementById('procMpBonusInput')?.value) ?? 10;

      if (!confirm(`Deseja recalcular e regenerar proceduralmente toda a curva para ${maxLevel} níveis com Base XP = ${baseExperience} e Exponente = ${growthExponent}?`)) {
        return;
      }

      try {
        const res = await this.api('/api/admin/experience/procedural', {
          method: 'POST',
          body: JSON.stringify({
            baseExperience,
            growthExponent,
            flatIncrement,
            maxLevel,
            statPointsReward,
            skillPointsReward,
            hpBonus,
            mpBonus,
          }),
        });

        document.getElementById('xpProceduralModal').style.display = 'none';
        alert(res.message || 'Curva procedural gerada com sucesso!');
        await this.loadLevelExperienceTemplates();
      } catch (err) {
        alert(`Erro ao gerar curva procedural: ${err.message}`);
      }
    };

    app.openBracketEditModal = function (bracketTier) {
      const tier = Number(bracketTier) || 1;
      const minL = (tier - 1) * 10 + 1;
      const maxL = tier * 10;

      document.getElementById('bracketEditTierInput').value = String(tier);
      document.getElementById('bracketModalTitle').textContent = `⚙️ Ajustar Grupo ${tier} (Níveis ${minL} a ${maxL})`;
      document.getElementById('bracketMultiplierInput').value = '1.0';
      document.getElementById('bracketFlatOffsetInput').value = '0';
      document.getElementById('bracketStatPtsInput').value = '';
      document.getElementById('bracketSkillPtsInput').value = '';
      document.getElementById('bracketHpBonusInput').value = '';
      document.getElementById('bracketMpBonusInput').value = '';

      document.getElementById('bracketEditModal').style.display = 'flex';
    };

    app.applyBracketUpdate = async function () {
      const tier = Number(document.getElementById('bracketEditTierInput')?.value) || 1;
      const multiplier = parseFloat(document.getElementById('bracketMultiplierInput')?.value) || 1.0;
      const flatOffset = parseFloat(document.getElementById('bracketFlatOffsetInput')?.value) || 0;

      const rawStat = document.getElementById('bracketStatPtsInput')?.value;
      const rawSkill = document.getElementById('bracketSkillPtsInput')?.value;
      const rawHp = document.getElementById('bracketHpBonusInput')?.value;
      const rawMp = document.getElementById('bracketMpBonusInput')?.value;

      const payload = {
        multiplier,
        flatOffset,
      };

      if (rawStat !== '') payload.statPointsReward = Number(rawStat);
      if (rawSkill !== '') payload.skillPointsReward = Number(rawSkill);
      if (rawHp !== '') payload.hpBonus = Number(rawHp);
      if (rawMp !== '') payload.mpBonus = Number(rawMp);

      try {
        const res = await this.api(`/api/admin/experience/bracket/${tier}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });

        document.getElementById('bracketEditModal').style.display = 'none';
        alert(res.message || `Grupo ${tier} atualizado com sucesso!`);
        await this.loadLevelExperienceTemplates();
      } catch (err) {
        alert(`Erro ao atualizar Grupo ${tier}: ${err.message}`);
      }
    };

    app.openEditLevelModal = function (lvlNum) {
      const item = this.levelExperienceTemplates.find((l) => l.level === Number(lvlNum));
      if (!item) return;

      document.getElementById('levelEditNumInput').value = String(item.level);
      document.getElementById('levelModalTitle').textContent = `📈 Editar Nível ${item.level} (Grupo ${item.bracketTier})`;
      document.getElementById('levelEditExpInput').value = String(item.experienceToNext);
      document.getElementById('levelEditStatPtsInput').value = String(item.statPointsReward);
      document.getElementById('levelEditSkillPtsInput').value = String(item.skillPointsReward);
      document.getElementById('levelEditHpBonusInput').value = String(item.hpBonus);
      document.getElementById('levelEditMpBonusInput').value = String(item.mpBonus);

      document.getElementById('levelEditModal').style.display = 'flex';
    };

    app.saveSingleLevelModal = async function () {
      const lvl = Number(document.getElementById('levelEditNumInput')?.value);
      if (!lvl) return;

      const experienceToNext = Number(document.getElementById('levelEditExpInput')?.value) || 0;
      const statPointsReward = Number(document.getElementById('levelEditStatPtsInput')?.value) ?? 5;
      const skillPointsReward = Number(document.getElementById('levelEditSkillPtsInput')?.value) ?? 1;
      const hpBonus = Number(document.getElementById('levelEditHpBonusInput')?.value) ?? 20;
      const mpBonus = Number(document.getElementById('levelEditMpBonusInput')?.value) ?? 10;

      try {
        await this.api(`/api/admin/experience/${lvl}`, {
          method: 'PUT',
          body: JSON.stringify({
            experienceToNext,
            statPointsReward,
            skillPointsReward,
            hpBonus,
            mpBonus,
          }),
        });

        document.getElementById('levelEditModal').style.display = 'none';
        await this.loadLevelExperienceTemplates();
      } catch (err) {
        alert(`Erro ao salvar nível ${lvl}: ${err.message}`);
      }
    };

    app.saveInlineLevelExp = async function (lvl) {
      const input = document.getElementById(`inlineExp_${lvl}`);
      if (!input) return;
      const experienceToNext = Number(input.value) || 0;

      try {
        await this.api(`/api/admin/experience/${lvl}`, {
          method: 'PUT',
          body: JSON.stringify({ experienceToNext }),
        });
        await this.loadLevelExperienceTemplates();
      } catch (err) {
        alert(`Erro ao salvar nível ${lvl}: ${err.message}`);
      }
    };

    app.renderExperienceCrudTable = function () {
      const container = document.getElementById('experienceTableContainer');
      if (!container) return;

      const bF = this.experienceBracketFilter;
      const filtered = (this.levelExperienceTemplates || []).filter((l) => {
        if (bF === 'ALL') return true;
        return l.bracketTier === Number(bF);
      });

      const maxLevel = this.levelExperienceTemplates.length > 0 ? this.levelExperienceTemplates[this.levelExperienceTemplates.length - 1] : null;
      const countBadge = document.getElementById('experienceCounterBadge');
      if (countBadge) {
        const totalXpStr = maxLevel ? maxLevel.totalExperience.toLocaleString('pt-BR') : '0';
        countBadge.textContent = `${this.levelExperienceTemplates.length} Níveis | XP Total no Nível Máx: ${totalXpStr}`;
      }

      const bracketColors = {
        1: '#38bdf8', 2: '#4ade80', 3: '#fbbf24', 4: '#fb923c', 5: '#f43f5e',
        6: '#c084fc', 7: '#a855f7', 8: '#06b6d4', 9: '#eab308', 10: '#ec4899',
      };

      container.innerHTML = `
        <table class="data-table" style="width:100%; border-collapse:collapse; font-size:0.83rem;">
          <thead>
            <tr style="border-bottom:1px solid var(--border); text-align:left; color:#94a3b8;">
              <th style="padding:10px; width:80px;">Nível</th>
              <th style="padding:10px; width:130px;">Grupo / Faixa</th>
              <th style="padding:10px;">XP p/ Próximo Nível (Editar)</th>
              <th style="padding:10px;">XP Total Acumulada</th>
              <th style="padding:10px; width:120px;">Pontos Status</th>
              <th style="padding:10px; width:110px;">Pontos Skill</th>
              <th style="padding:10px; width:130px;">Bônus HP / MP</th>
              <th style="padding:10px; text-align:right; width:110px;">Ações</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map((item) => {
              const bColor = bracketColors[item.bracketTier] || '#38bdf8';
              const isMax = item.level === this.levelExperienceTemplates.length;
              return `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.05); transition:background 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background='transparent'">
                  <td style="padding:8px 10px;">
                    <span style="background:${bColor}22; color:${bColor}; border:1px solid ${bColor}55; font-weight:800; padding:2px 8px; border-radius:6px; font-size:0.85rem;">
                      Lv. ${item.level}
                    </span>
                  </td>
                  <td style="padding:8px 10px;">
                    <span style="color:${bColor}; font-weight:600; font-size:0.78rem;">
                      📁 Grupo ${item.bracketTier} (${(item.bracketTier - 1) * 10 + 1}-${item.bracketTier * 10})
                    </span>
                  </td>
                  <td style="padding:8px 10px;">
                    ${isMax ? '<span style="color:#64748b; font-style:italic;">👑 Nível Máximo (0 XP)</span>' : `
                      <div style="display:flex; gap:6px; align-items:center;">
                        <input type="number" id="inlineExp_${item.level}" value="${item.experienceToNext}"
                               style="width:130px; font-size:0.80rem; font-weight:700; color:#38bdf8; background:rgba(15,23,42,0.8); border:1px solid #334155; border-radius:4px; padding:3px 6px;" />
                        <button type="button" onclick="AdminApp.saveInlineLevelExp(${item.level})" style="font-size:0.70rem; padding:3px 7px;" title="Salvar e recalcular curva">💾</button>
                      </div>
                    `}
                  </td>
                  <td style="padding:8px 10px; font-weight:600; color:#cbd5e1;">
                    ${item.totalExperience.toLocaleString('pt-BR')} XP
                  </td>
                  <td style="padding:8px 10px; color:#4ade80; font-weight:700;">
                    +${item.statPointsReward} Pontos
                  </td>
                  <td style="padding:8px 10px; color:#fbbf24; font-weight:700;">
                    +${item.skillPointsReward} Ponto
                  </td>
                  <td style="padding:8px 10px; font-size:0.78rem; color:#94a3b8;">
                    <span style="color:#4ade80;">+${item.hpBonus} HP</span> | <span style="color:#38bdf8;">+${item.mpBonus} MP</span>
                  </td>
                  <td style="padding:8px 10px; text-align:right;">
                    <button class="btn-primary" style="padding:4px 8px; font-size:0.75rem;" onclick="AdminApp.openEditLevelModal(${item.level})">✏️ Detalhes</button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
    };

    app.renderXpCurveCanvas = function () {
      const canvas = document.getElementById('xpCurveCanvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      const list = this.levelExperienceTemplates;
      if (!list || list.length === 0) {
        ctx.fillStyle = '#64748b';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Nenhum dado de nível disponível.', w / 2, h / 2);
        return;
      }

      const paddingLeft = 60;
      const paddingRight = 20;
      const paddingTop = 25;
      const paddingBottom = 35;
      const plotW = w - paddingLeft - paddingRight;
      const plotH = h - paddingTop - paddingBottom;

      // Encontra máximos para escala
      const maxXp = Math.max(...list.map((l) => l.experienceToNext), 100);
      const maxTotal = list[list.length - 1]?.totalExperience || 100;
      const totalLevels = list.length;

      // 1. Faixas de fundo coloridas para cada bracket de 10 níveis
      const bracketColors = ['#38bdf8', '#4ade80', '#fbbf24', '#fb923c', '#f43f5e', '#c084fc', '#a855f7', '#06b6d4', '#eab308', '#ec4899'];
      const totalBrackets = Math.ceil(totalLevels / 10);
      for (let b = 0; b < totalBrackets; b++) {
        const x1 = paddingLeft + (b * 10 / totalLevels) * plotW;
        const x2 = paddingLeft + (Math.min(totalLevels, (b + 1) * 10) / totalLevels) * plotW;
        ctx.fillStyle = (b % 2 === 0) ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)';
        ctx.fillRect(x1, paddingTop, x2 - x1, plotH);

        // Divisor vertical
        ctx.beginPath();
        ctx.setLineDash([2, 4]);
        ctx.strokeStyle = `${bracketColors[b % bracketColors.length]}44`;
        ctx.moveTo(x2, paddingTop);
        ctx.lineTo(x2, paddingTop + plotH);
        ctx.stroke();
        ctx.setLineDash([]);

        // Rótulo do Bracket no topo
        ctx.fillStyle = `${bracketColors[b % bracketColors.length]}aa`;
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`G${b + 1}`, (x1 + x2) / 2, paddingTop - 8);
      }

      // 2. Eixos
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(paddingLeft, paddingTop);
      ctx.lineTo(paddingLeft, paddingTop + plotH);
      ctx.lineTo(paddingLeft + plotW, paddingTop + plotH);
      ctx.stroke();

      // Rótulos do eixo Y
      ctx.fillStyle = '#64748b';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${(maxXp / 1000).toFixed(0)}k`, paddingLeft - 8, paddingTop + 10);
      ctx.fillText(`${(maxXp / 2000).toFixed(0)}k`, paddingLeft - 8, paddingTop + plotH / 2);
      ctx.fillText('0', paddingLeft - 8, paddingTop + plotH);

      // Rótulos do eixo X
      ctx.textAlign = 'center';
      for (let lvl = 10; lvl <= totalLevels; lvl += 20) {
        const x = paddingLeft + ((lvl - 1) / (totalLevels - 1)) * plotW;
        ctx.fillText(`Lv.${lvl}`, x, paddingTop + plotH + 18);
      }

      // 3. Traçado da Curva de XP p/ Próximo Nível (Ciano / Azul Brilhante)
      ctx.beginPath();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;

      list.forEach((l, idx) => {
        const x = paddingLeft + (idx / (totalLevels - 1)) * plotW;
        const y = paddingTop + plotH - (l.experienceToNext / maxXp) * plotH;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // 4. Preenchimento gradiente suave sob a curva
      ctx.lineTo(paddingLeft + plotW, paddingTop + plotH);
      ctx.lineTo(paddingLeft, paddingTop + plotH);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, paddingTop, 0, paddingTop + plotH);
      grad.addColorStop(0, 'rgba(56, 189, 248, 0.25)');
      grad.addColorStop(1, 'rgba(56, 189, 248, 0.00)');
      ctx.fillStyle = grad;
      ctx.fill();

      // Legenda
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('━ XP p/ Próximo Nível', paddingLeft + 10, paddingTop + 14);
    };
  }

  static injectTabAndModalDom() {
    // 1. Injeta Botão da Aba (#tabBtnExperience) na barra de navegação após tabBtnFlyingMounts
    const navTabs = document.querySelector('.nav-tabs');
    if (navTabs && !document.getElementById('tabBtnExperience')) {
      const btn = document.createElement('button');
      btn.id = 'tabBtnExperience';
      btn.textContent = '📈 Níveis & XP';
      btn.onclick = () => AdminApp.switchTab('experience');

      const btnMounts = document.getElementById('tabBtnFlyingMounts');
      if (btnMounts && btnMounts.nextSibling) {
        navTabs.insertBefore(btn, btnMounts.nextSibling);
      } else {
        navTabs.appendChild(btn);
      }
    }

    // 2. Injeta Painel da Aba (#tabExperience) dentro de #adminApp
    const adminApp = document.getElementById('adminApp');
    if (adminApp && !document.getElementById('tabExperience')) {
      const panel = document.createElement('div');
      panel.id = 'tabExperience';
      panel.style.display = 'none';
      panel.style.flexDirection = 'column';
      panel.style.gap = '14px';

      panel.innerHTML = `
        <div class="panel">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
            <div>
              <h3 style="margin:0; color:#38bdf8;">📈 Tabela de Níveis, Experiência (XP) & Progressão</h3>
              <p style="font-size:0.8rem; color:var(--text-muted); margin:4px 0 0;">
                Calibre a curva de progressão de 1 a 100 de forma procedural matemática, edite em lote por grupos de 10 níveis ou ajuste nível a nível.
              </p>
            </div>
            <div style="display:flex; gap:8px; align-items:center;">
              <span id="experienceCounterBadge" style="font-size:0.8rem; color:var(--text-muted);"></span>
              <button class="btn-primary" onclick="AdminApp.openProceduralCurveModal()" style="font-weight:700;">⚡ Gerador Procedural</button>
            </div>
          </div>

          <!-- GRÁFICO 2D INTERATIVO DA CURVA DE XP COM FAIXAS DE 10 EM 10 NÍVEIS -->
          <div style="background:rgba(15,23,42,0.85); border:1px solid #334155; border-radius:10px; padding:12px; margin-top:14px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <span style="font-size:0.80rem; font-weight:700; color:#cbd5e1;">📊 Curva de Progressão & Faixas de 10 em 10 Níveis (G1 a G10)</span>
              <span style="font-size:0.75rem; color:#94a3b8;">Curva Exponencial + Linear</span>
            </div>
            <canvas id="xpCurveCanvas" width="900" height="180" style="width:100%; height:180px; display:block; background:#0b1120; border-radius:8px; border:1px solid #1e293b;"></canvas>
          </div>

          <!-- BARRA DE SELEÇÃO E AÇÕES RÁPIDAS DE GRUPOS (10 EM 10 NÍVEIS) -->
          <div style="margin-top:14px; background:rgba(15,23,42,0.65); border:1px solid #334155; border-radius:10px; padding:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
              <span style="font-size:0.80rem; font-weight:700; color:#38bdf8;">📁 Filtrar e Ajustar Grupos (De 10 em 10 Níveis):</span>
              <div style="display:flex; gap:6px;">
                <button type="button" class="btn-success" onclick="AdminApp.openBracketEditModal(AdminApp.experienceBracketFilter === 'ALL' ? 1 : AdminApp.experienceBracketFilter)" style="font-size:0.78rem; padding:4px 10px;">
                  ⚙️ Ajustar Grupo Selecionado em Lote
                </button>
              </div>
            </div>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
              <button type="button" class="btn-primary xp-bracket-chip" data-bracket="ALL" onclick="AdminApp.setExperienceBracketFilter('ALL')" style="font-size:0.75rem; padding:4px 10px;">Todos (1-100)</button>
              ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((t) => `
                <button type="button" class="xp-bracket-chip" data-bracket="${t}" onclick="AdminApp.setExperienceBracketFilter(${t})" style="font-size:0.75rem; padding:4px 10px;">
                  G${t} (${(t - 1) * 10 + 1}-${t * 10})
                </button>
              `).join('')}
            </div>
          </div>

          <div id="experienceTableContainer" style="overflow-x:auto; margin-top:12px;"></div>
        </div>
      `;

      const tabMounts = document.getElementById('tabFlyingMounts');
      if (tabMounts && tabMounts.nextSibling) {
        adminApp.insertBefore(panel, tabMounts.nextSibling);
      } else {
        adminApp.appendChild(panel);
      }
    }

    // 3. Injeta Modal de Geração Procedural (#xpProceduralModal)
    if (!document.getElementById('xpProceduralModal')) {
      const pModal = document.createElement('div');
      pModal.id = 'xpProceduralModal';
      pModal.className = 'modal-backdrop';
      pModal.style.display = 'none';

      pModal.innerHTML = `
        <div class="modal-box" style="max-width:680px; width:95%; padding:18px;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:10px; margin-bottom:14px;">
            <h3 style="color:#38bdf8; margin:0; font-size:1.05rem;">⚡ Gerador Procedural Global de Níveis & XP</h3>
            <button class="btn-danger" onclick="document.getElementById('xpProceduralModal').style.display='none'" style="padding:4px 10px;">✕</button>
          </div>
          <p style="font-size:0.80rem; color:var(--text-muted); margin-bottom:14px;">
            Altere a base matemática para recalcular a curva de progressão inteira. A fórmula utiliza:
            <code style="color:#38bdf8;">XP(L) = BaseXP × L^Exponente + (L - 1) × IncrementoLinear</code>.
          </p>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px;">
            <div class="field">
              <label>Número Base de XP (Nível 1) *</label>
              <input type="number" id="procBaseXpInput" value="100" min="10" />
            </div>
            <div class="field">
              <label>Exponente de Crescimento (1.0 a 3.0) *</label>
              <input type="number" step="0.01" id="procExponentInput" value="1.48" min="1.0" max="3.0" />
            </div>
            <div class="field">
              <label>Incremento Linear por Nível</label>
              <input type="number" id="procFlatIncInput" value="60" min="0" />
            </div>
            <div class="field">
              <label>Nível Máximo da Curva</label>
              <input type="number" id="procMaxLevelInput" value="100" min="10" max="200" />
            </div>
            <div class="field">
              <label>Pontos de Status por Nível</label>
              <input type="number" id="procStatPtsInput" value="5" min="0" />
            </div>
            <div class="field">
              <label>Pontos de Habilidade por Nível</label>
              <input type="number" id="procSkillPtsInput" value="1" min="0" />
            </div>
            <div class="field">
              <label>Bônus Base de HP por Nível</label>
              <input type="number" id="procHpBonusInput" value="25" min="0" />
            </div>
            <div class="field">
              <label>Bônus Base de MP por Nível</label>
              <input type="number" id="procMpBonusInput" value="10" min="0" />
            </div>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:8px;">
            <button class="btn-danger" onclick="document.getElementById('xpProceduralModal').style.display='none'">Cancelar</button>
            <button class="btn-success" onclick="AdminApp.applyProceduralCurve()" style="font-weight:700;">⚡ Gerar & Recalcular Tudo</button>
          </div>
        </div>
      `;
      document.body.appendChild(pModal);
    }

    // 4. Injeta Modal de Edição de Grupo de 10 Níveis (#bracketEditModal)
    if (!document.getElementById('bracketEditModal')) {
      const bModal = document.createElement('div');
      bModal.id = 'bracketEditModal';
      bModal.className = 'modal-backdrop';
      bModal.style.display = 'none';

      bModal.innerHTML = `
        <div class="modal-box" style="max-width:620px; width:95%; padding:18px;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:10px; margin-bottom:14px;">
            <h3 id="bracketModalTitle" style="color:#38bdf8; margin:0; font-size:1.05rem;">⚙️ Ajustar Grupo de 10 Níveis</h3>
            <button class="btn-danger" onclick="document.getElementById('bracketEditModal').style.display='none'" style="padding:4px 10px;">✕</button>
          </div>
          <input type="hidden" id="bracketEditTierInput" value="1" />
          <p style="font-size:0.80rem; color:var(--text-muted); margin-bottom:14px;">
            Ajuste todos os 10 níveis deste grupo de uma só vez. A experiência total acumulada será recalculada automaticamente para todo o jogo.
          </p>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px;">
            <div class="field">
              <label>Multiplicador de XP (ex: 1.15 = +15%, 0.9 = -10%)</label>
              <input type="number" step="0.05" id="bracketMultiplierInput" value="1.0" min="0.1" />
            </div>
            <div class="field">
              <label>Soma / Subtração Fixa de XP (+/-)</label>
              <input type="number" id="bracketFlatOffsetInput" value="0" />
            </div>
            <div class="field">
              <label>Pontos de Status (deixe vazio p/ manter)</label>
              <input type="number" id="bracketStatPtsInput" placeholder="Manter atual" />
            </div>
            <div class="field">
              <label>Pontos de Skill (deixe vazio p/ manter)</label>
              <input type="number" id="bracketSkillPtsInput" placeholder="Manter atual" />
            </div>
            <div class="field">
              <label>Bônus HP (deixe vazio p/ manter)</label>
              <input type="number" id="bracketHpBonusInput" placeholder="Manter atual" />
            </div>
            <div class="field">
              <label>Bônus MP (deixe vazio p/ manter)</label>
              <input type="number" id="bracketMpBonusInput" placeholder="Manter atual" />
            </div>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:8px;">
            <button class="btn-danger" onclick="document.getElementById('bracketEditModal').style.display='none'">Cancelar</button>
            <button class="btn-success" onclick="AdminApp.applyBracketUpdate()" style="font-weight:700;">💾 Aplicar nos 10 Níveis</button>
          </div>
        </div>
      `;
      document.body.appendChild(bModal);
    }

    // 5. Injeta Modal de Edição Individual de Nível (#levelEditModal)
    if (!document.getElementById('levelEditModal')) {
      const lModal = document.createElement('div');
      lModal.id = 'levelEditModal';
      lModal.className = 'modal-backdrop';
      lModal.style.display = 'none';

      lModal.innerHTML = `
        <div class="modal-box" style="max-width:540px; width:95%; padding:18px;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:10px; margin-bottom:14px;">
            <h3 id="levelModalTitle" style="color:#38bdf8; margin:0; font-size:1.05rem;">📈 Editar Nível Individual</h3>
            <button class="btn-danger" onclick="document.getElementById('levelEditModal').style.display='none'" style="padding:4px 10px;">✕</button>
          </div>
          <input type="hidden" id="levelEditNumInput" value="1" />
          <div style="display:grid; grid-template-columns:1fr; gap:10px; margin-bottom:14px;">
            <div class="field">
              <label>XP Necessária para o Próximo Nível *</label>
              <input type="number" id="levelEditExpInput" min="0" />
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
              <div class="field">
                <label>Pontos de Status</label>
                <input type="number" id="levelEditStatPtsInput" min="0" />
              </div>
              <div class="field">
                <label>Pontos de Habilidade</label>
                <input type="number" id="levelEditSkillPtsInput" min="0" />
              </div>
              <div class="field">
                <label>Bônus de HP</label>
                <input type="number" id="levelEditHpBonusInput" min="0" />
              </div>
              <div class="field">
                <label>Bônus de MP</label>
                <input type="number" id="levelEditMpBonusInput" min="0" />
              </div>
            </div>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:8px;">
            <button class="btn-danger" onclick="document.getElementById('levelEditModal').style.display='none'">Cancelar</button>
            <button class="btn-success" onclick="AdminApp.saveSingleLevelModal()" style="font-weight:700;">💾 Salvar Nível</button>
          </div>
        </div>
      `;
      document.body.appendChild(lModal);
    }
  }
}

window.AdminExperienceTab = AdminExperienceTab;
