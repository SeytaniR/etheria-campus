/**
 * @file apps/server/public/admin/js/AdminExperienceTab.js
 * @module @etheria/server
 * @description Submódulo da Aba Tabela de Níveis e Experiência (`level_experience_templates`) da Rota `/admin`.
 *   - Controle por Número Único Mestre (`baseKillTarget`, padrão 1500 abates Rank F Comum por nível).
 *   - Simulador em tempo real auto-ajustável para todos os Ranks (F, D, C, B, A, S, SS) e Tipos (Comum, Líder -15%, Boss -30%).
 *   - Nível Máximo configurável pelo administrador com teto oficial de até 1.000 níveis.
 *   - Edições em lote de 10 em 10 níveis (Brackets dinâmicos G1..G100) e ajuste individual por nível.
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
        this.syncMasterInputsFromTable();
        this.renderBracketFilterChips();
        this.renderExperienceCrudTable();
        this.renderXpCurveCanvas();
      } catch (err) {
        console.error('Falha ao carregar tabela de níveis e experiência:', err);
      }
    };

    app.syncMasterInputsFromTable = function () {
      const list = this.levelExperienceTemplates || [];
      if (list.length === 0) return;

      const lvl1 = list.find((l) => l.level === 1) || list[0];
      const maxLvl = list[list.length - 1]?.level || list.length;
      const inferredKillTarget = lvl1 && lvl1.experienceToNext > 0
        ? Math.max(1, Math.round(lvl1.experienceToNext / 28))
        : 1500;

      const masterKillInput = document.getElementById('xpMasterKillTargetInput');
      if (masterKillInput) masterKillInput.value = String(inferredKillTarget);

      const masterMaxLvlInput = document.getElementById('xpMasterMaxLevelInput');
      if (masterMaxLvlInput) masterMaxLvlInput.value = String(maxLvl);

      const procKillInput = document.getElementById('procKillTargetInput');
      if (procKillInput) procKillInput.value = String(inferredKillTarget);

      const procBaseXpInput = document.getElementById('procBaseXpInput');
      if (procBaseXpInput) procBaseXpInput.value = String(inferredKillTarget * 28);

      const procMaxLvlInput = document.getElementById('procMaxLevelInput');
      if (procMaxLvlInput) procMaxLvlInput.value = String(maxLvl);

      this.updateMasterKillSimulationPreview();
    };

    app.updateMasterKillSimulationPreview = function () {
      const killInput = document.getElementById('xpMasterKillTargetInput');
      const simContainer = document.getElementById('xpMasterKillSimTable');
      const baseXpBadge = document.getElementById('xpMasterBaseXpPreviewBadge');
      if (!killInput || !simContainer) return;

      const baseKills = Math.max(1, Math.round(Number(killInput.value) || 1500));
      const baseXpLvl1 = baseKills * 28;
      if (baseXpBadge) {
        baseXpBadge.textContent = `Base Nv.1: ${baseXpLvl1.toLocaleString('pt-BR')} XP (Fórmula: ${baseXpLvl1.toLocaleString('pt-BR')} × Nível)`;
      }

      const ranks = [
        { code: 'F', color: '#94a3b8', weight: 1.0, xpLvl1: 28 },
        { code: 'D', color: '#fde047', weight: 1.25, xpLvl1: 35 },
        { code: 'C', color: '#4ade80', weight: 1.5, xpLvl1: 42 },
        { code: 'B', color: '#38bdf8', weight: 15 / 7, xpLvl1: 60 },
        { code: 'A', color: '#c084fc', weight: 5.0, xpLvl1: 140 },
        { code: 'S', color: '#fb923c', weight: 10.0, xpLvl1: 280 },
        { code: 'SS', color: '#f43f5e', weight: 15.0, xpLvl1: 420 },
      ];

      simContainer.innerHTML = ranks
        .map((r) => {
          const commonKills = Math.max(1, Math.round(baseKills / r.weight));
          const leaderKills = Math.max(1, Math.round(commonKills * 0.85));
          const bossKills = Math.max(1, Math.round(commonKills * 0.70));
          return `
            <div style="background:rgba(2,6,23,0.75); border:1px solid ${r.color}55; border-radius:8px; padding:8px 10px; display:flex; flex-direction:column; gap:3px;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-weight:800; font-size:0.82rem; color:${r.color};">Rank ${r.code}</span>
                <span style="font-size:0.68rem; color:#64748b;">${r.xpLvl1}×Nv XP</span>
              </div>
              <div style="font-size:0.78rem; color:#f8fafc;">
                👾 Comum: <strong style="color:#38bdf8;">${commonKills.toLocaleString('pt-BR')}</strong>
              </div>
              <div style="font-size:0.73rem; color:#cbd5e1;">
                💠 Líder (-15%): <strong style="color:#4ade80;">${leaderKills.toLocaleString('pt-BR')}</strong>
              </div>
              <div style="font-size:0.73rem; color:#cbd5e1;">
                👑 Boss (-30%): <strong style="color:#fb7185;">${bossKills.toLocaleString('pt-BR')}</strong>
              </div>
            </div>
          `;
        })
        .join('');
    };

    app.applyMasterSingleNumberCurve = async function () {
      const baseKillTarget = Math.max(1, Math.round(Number(document.getElementById('xpMasterKillTargetInput')?.value) || 1500));
      const rawMaxLvl = Number(document.getElementById('xpMasterMaxLevelInput')?.value) || 200;
      const maxLevel = Math.max(2, Math.min(1000, Math.round(rawMaxLvl)));

      if (rawMaxLvl > 1000) {
        alert('O limite máximo absoluto do sistema é Nível 1.000. O valor foi ajustado para 1.000.');
        document.getElementById('xpMasterMaxLevelInput').value = '1000';
      }

      if (!confirm(`Aplicar Número Único = ${baseKillTarget} abates (Rank F Comum) e Nível Máximo = ${maxLevel}?\n\nToda a tabela de níveis (1 até ${maxLevel}) será auto-ajustada proporcionalmente.`)) {
        return;
      }

      try {
        const res = await this.api('/api/admin/experience/procedural', {
          method: 'POST',
          body: JSON.stringify({
            baseKillTarget,
            growthExponent: 1.0,
            flatIncrement: 0,
            maxLevel,
            statPointsReward: 5,
            skillPointsReward: 1,
            hpBonus: 0,
            mpBonus: 0,
          }),
        });

        if (this.experienceBracketFilter !== 'ALL' && Number(this.experienceBracketFilter) > Math.ceil(maxLevel / 10)) {
          this.experienceBracketFilter = 'ALL';
        }
        alert(res.message || 'Tabela de XP atualizada com sucesso!');
        await this.loadLevelExperienceTemplates();
      } catch (err) {
        alert(`Erro ao aplicar configuração: ${err.message}`);
      }
    };

    app.renderBracketFilterChips = function () {
      const container = document.getElementById('xpBracketChipsContainer');
      if (!container) return;

      const totalLevels = (this.levelExperienceTemplates || []).length || 200;
      const totalBrackets = Math.ceil(totalLevels / 10);
      const currentFilter = String(this.experienceBracketFilter);

      let html = `
        <button type="button" class="${currentFilter === 'ALL' ? 'btn-primary ' : ''}xp-bracket-chip" data-bracket="ALL" onclick="AdminApp.setExperienceBracketFilter('ALL')" style="font-size:0.75rem; padding:4px 10px;">
          Todos (1-${totalLevels})
        </button>
      `;

      for (let t = 1; t <= totalBrackets; t++) {
        const minL = (t - 1) * 10 + 1;
        const maxL = Math.min(totalLevels, t * 10);
        const isSel = currentFilter === String(t);
        html += `
          <button type="button" class="${isSel ? 'btn-primary ' : ''}xp-bracket-chip" data-bracket="${t}" onclick="AdminApp.setExperienceBracketFilter(${t})" style="font-size:0.75rem; padding:4px 10px;">
            G${t} (${minL}-${maxL})
          </button>
        `;
      }

      container.innerHTML = html;
    };

    app.setExperienceBracketFilter = function (bracket) {
      this.experienceBracketFilter = bracket;
      this.renderBracketFilterChips();
      this.renderExperienceCrudTable();
      this.renderXpCurveCanvas();
    };

    app.openProceduralCurveModal = function () {
      this.syncMasterInputsFromTable();
      const modal = document.getElementById('xpProceduralModal');
      if (modal) modal.style.display = 'flex';
    };

    app.onProcKillTargetInputChange = function () {
      const k = Math.max(1, Math.round(Number(document.getElementById('procKillTargetInput')?.value) || 1500));
      const baseInput = document.getElementById('procBaseXpInput');
      if (baseInput) baseInput.value = String(k * 28);
    };

    app.applyProceduralCurve = async function () {
      const baseKillTarget = Number(document.getElementById('procKillTargetInput')?.value) || undefined;
      const baseExperience = Number(document.getElementById('procBaseXpInput')?.value) || 42000;
      const growthExponent = Number(document.getElementById('procExponentInput')?.value) || 1.0;
      const flatIncrement = Number(document.getElementById('procFlatIncInput')?.value) || 0;
      const rawMaxLevel = Number(document.getElementById('procMaxLevelInput')?.value) || 200;
      const maxLevel = Math.max(2, Math.min(1000, Math.round(rawMaxLevel)));
      const statPointsReward = Number(document.getElementById('procStatPtsInput')?.value) ?? 5;
      const skillPointsReward = Number(document.getElementById('procSkillPtsInput')?.value) ?? 1;
      const hpBonus = Number(document.getElementById('procHpBonusInput')?.value) ?? 0;
      const mpBonus = Number(document.getElementById('procMpBonusInput')?.value) ?? 0;

      if (!confirm(`Deseja recalcular e regenerar proceduralmente toda a curva para ${maxLevel} níveis (limite máx 1.000)?`)) {
        return;
      }

      try {
        const res = await this.api('/api/admin/experience/procedural', {
          method: 'POST',
          body: JSON.stringify({
            baseKillTarget,
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

      const payload = { multiplier, flatOffset };
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
      const hpBonus = Number(document.getElementById('levelEditHpBonusInput')?.value) ?? 0;
      const mpBonus = Number(document.getElementById('levelEditMpBonusInput')?.value) ?? 0;

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

      const maxLevel = this.levelExperienceTemplates.length > 0
        ? this.levelExperienceTemplates[this.levelExperienceTemplates.length - 1]
        : null;
      const countBadge = document.getElementById('experienceCounterBadge');
      if (countBadge) {
        const totalXpStr = maxLevel ? maxLevel.totalExperience.toLocaleString('pt-BR') : '0';
        countBadge.textContent = `👑 Nível Máx Atual: ${this.levelExperienceTemplates.length} (Limite: 1.000) | XP Acumulada até o Topo: ${totalXpStr}`;
      }

      const bracketColors = [
        '#38bdf8', '#4ade80', '#fbbf24', '#fb923c', '#f43f5e',
        '#c084fc', '#a855f7', '#06b6d4', '#eab308', '#ec4899',
      ];

      container.innerHTML = `
        <table class="data-table" style="width:100%; border-collapse:collapse; font-size:0.83rem;">
          <thead>
            <tr style="border-bottom:1px solid var(--border); text-align:left; color:#94a3b8;">
              <th style="padding:10px; width:80px;">Nível</th>
              <th style="padding:10px; width:130px;">Grupo / Faixa</th>
              <th style="padding:10px;">XP p/ Próximo Nível (Editar)</th>
              <th style="padding:10px;">Abates Rank F / SS (Comum)</th>
              <th style="padding:10px;">XP Total Acumulada</th>
              <th style="padding:10px; width:115px;">Pontos Status</th>
              <th style="padding:10px; width:105px;">Pontos Skill</th>
              <th style="padding:10px; text-align:right; width:105px;">Ações</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map((item) => {
              const bColor = bracketColors[(item.bracketTier - 1) % bracketColors.length] || '#38bdf8';
              const isMax = item.level === this.levelExperienceTemplates.length;
              const fKills = isMax ? 0 : Math.max(1, Math.round(item.experienceToNext / (28 * item.level)));
              const ssKills = isMax ? 0 : Math.max(1, Math.round(item.experienceToNext / (420 * item.level)));
              return `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.05); transition:background 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background='transparent'">
                  <td style="padding:8px 10px;">
                    <span style="background:${bColor}22; color:${bColor}; border:1px solid ${bColor}55; font-weight:800; padding:2px 8px; border-radius:6px; font-size:0.85rem;">
                      Lv. ${item.level}
                    </span>
                  </td>
                  <td style="padding:8px 10px;">
                    <span style="color:${bColor}; font-weight:600; font-size:0.78rem;">
                      📁 G${item.bracketTier} (${(item.bracketTier - 1) * 10 + 1}-${item.bracketTier * 10})
                    </span>
                  </td>
                  <td style="padding:8px 10px;">
                    ${isMax ? '<span style="color:#fde047; font-weight:700;">👑 Nível Máximo Atingível (0 XP)</span>' : `
                      <div style="display:flex; gap:6px; align-items:center;">
                        <input type="number" id="inlineExp_${item.level}" value="${item.experienceToNext}"
                               style="width:135px; font-size:0.80rem; font-weight:700; color:#38bdf8; background:rgba(15,23,42,0.8); border:1px solid #334155; border-radius:4px; padding:3px 6px;" />
                        <button type="button" onclick="AdminApp.saveInlineLevelExp(${item.level})" style="font-size:0.70rem; padding:3px 7px;" title="Salvar e recalcular curva">💾</button>
                      </div>
                    `}
                  </td>
                  <td style="padding:8px 10px; font-size:0.76rem; color:#94a3b8;">
                    ${isMax ? '—' : `<span style="color:#cbd5e1;">${fKills.toLocaleString('pt-BR')} F</span> / <span style="color:#f43f5e; font-weight:700;">${ssKills.toLocaleString('pt-BR')} SS</span>`}
                  </td>
                  <td style="padding:8px 10px; font-weight:600; color:#cbd5e1;">
                    ${item.totalExperience.toLocaleString('pt-BR')} XP
                  </td>
                  <td style="padding:8px 10px; color:#4ade80; font-weight:700;">
                    +${item.statPointsReward} Pts
                  </td>
                  <td style="padding:8px 10px; color:#fbbf24; font-weight:700;">
                    +${item.skillPointsReward} Pt
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

      const paddingLeft = 65;
      const paddingRight = 20;
      const paddingTop = 25;
      const paddingBottom = 35;
      const plotW = w - paddingLeft - paddingRight;
      const plotH = h - paddingTop - paddingBottom;

      const maxXp = Math.max(...list.map((l) => l.experienceToNext), 100);
      const totalLevels = list.length;

      const bracketColors = ['#38bdf8', '#4ade80', '#fbbf24', '#fb923c', '#f43f5e', '#c084fc', '#a855f7', '#06b6d4', '#eab308', '#ec4899'];
      const totalBrackets = Math.ceil(totalLevels / 10);
      const labelStep = Math.max(1, Math.ceil(totalBrackets / 20));

      for (let b = 0; b < totalBrackets; b++) {
        const x1 = paddingLeft + (b * 10 / totalLevels) * plotW;
        const x2 = paddingLeft + (Math.min(totalLevels, (b + 1) * 10) / totalLevels) * plotW;
        ctx.fillStyle = (b % 2 === 0) ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)';
        ctx.fillRect(x1, paddingTop, x2 - x1, plotH);

        if (b % labelStep === 0) {
          ctx.fillStyle = `${bracketColors[b % bracketColors.length]}aa`;
          ctx.font = '9px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`G${b + 1}`, (x1 + x2) / 2, paddingTop - 8);
        }
      }

      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(paddingLeft, paddingTop);
      ctx.lineTo(paddingLeft, paddingTop + plotH);
      ctx.lineTo(paddingLeft + plotW, paddingTop + plotH);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${(maxXp / 1000).toFixed(0)}k`, paddingLeft - 8, paddingTop + 10);
      ctx.fillText(`${(maxXp / 2000).toFixed(0)}k`, paddingLeft - 8, paddingTop + plotH / 2);
      ctx.fillText('0', paddingLeft - 8, paddingTop + plotH);

      ctx.textAlign = 'center';
      const xStep = Math.max(10, Math.round(totalLevels / 10));
      for (let lvl = xStep; lvl <= totalLevels; lvl += xStep) {
        const x = paddingLeft + ((lvl - 1) / Math.max(1, totalLevels - 1)) * plotW;
        ctx.fillText(`Lv.${lvl}`, x, paddingTop + plotH + 18);
      }

      ctx.beginPath();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;

      list.forEach((l, idx) => {
        const x = paddingLeft + (idx / Math.max(1, totalLevels - 1)) * plotW;
        const y = paddingTop + plotH - (l.experienceToNext / maxXp) * plotH;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      ctx.lineTo(paddingLeft + plotW, paddingTop + plotH);
      ctx.lineTo(paddingLeft, paddingTop + plotH);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, paddingTop, 0, paddingTop + plotH);
      grad.addColorStop(0, 'rgba(56, 189, 248, 0.25)');
      grad.addColorStop(1, 'rgba(56, 189, 248, 0.00)');
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('━ XP p/ Próximo Nível', paddingLeft + 10, paddingTop + 14);
    };
  }

  static injectTabAndModalDom() {
    const navTabs = document.querySelector('.nav-tabs');
    if (navTabs && !document.getElementById('tabBtnExperience')) {
      const btn = document.createElement('button');
      btn.id = 'tabBtnExperience';
      btn.textContent = '📈 Níveis & XP';
      btn.onclick = () => AdminApp.switchTab('experience');

      const btnItems = document.getElementById('tabBtnItems');
      if (btnItems && btnItems.nextSibling) {
        navTabs.insertBefore(btn, btnItems.nextSibling);
      } else {
        navTabs.appendChild(btn);
      }
    }

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
              <h3 style="margin:0; color:#38bdf8;">📈 Tabela de Níveis, Experiência (XP) & Escalonamento por Número Único</h3>
              <p style="font-size:0.8rem; color:var(--text-muted); margin:4px 0 0;">
                Controle o ritmo de progressão de todos os mapas, raridades (F a SS) e variantes (Comum, Líder -15%, Boss -30%) ajustando apenas 1 número, e defina o Nível Máximo atingível (até 1.000).
              </p>
            </div>
            <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
              <span id="experienceCounterBadge" style="font-size:0.8rem; color:#fde047; font-weight:700;"></span>
              <button class="btn-primary" onclick="AdminApp.openProceduralCurveModal()" style="font-weight:700;">⚙️ Opções Avançadas da Curva</button>
            </div>
          </div>

          <!-- PAINEL DE CONTROLE MESTRE: NÚMERO ÚNICO DE ESCALONAMENTO + NÍVEL MÁXIMO ATÉ 1.000 -->
          <div style="background:linear-gradient(135deg, rgba(15,23,42,0.95), rgba(30,41,59,0.9)); border:1.5px solid #38bdf8; border-radius:10px; padding:14px; margin-top:14px;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:12px;">
              <div>
                <span style="font-size:0.9rem; font-weight:800; color:#fde047;">🎯 Controle Mestre por Número Único & Limite de Nível (Máx 1.000)</span>
                <div style="font-size:0.74rem; color:#94a3b8; margin-top:2px;">
                  Altere o número de abates base (Rank F Comum) para auto-ajustar proporcionalmente todos os Ranks e Tipos em todos os níveis.
                </div>
              </div>
              <span id="xpMasterBaseXpPreviewBadge" style="font-size:0.76rem; color:#38bdf8; background:rgba(56,189,248,0.12); border:1px solid rgba(56,189,248,0.35); padding:4px 10px; border-radius:6px; font-weight:700;">
                Base Nv.1: 42.000 XP
              </span>
            </div>

            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px; align-items:end; margin-bottom:12px;">
              <div class="field">
                <label style="color:#38bdf8; font-weight:700;">🔢 Número Único: Abates Rank F Comum p/ Upar 1 Nível *</label>
                <input type="number" id="xpMasterKillTargetInput" value="1500" min="1" max="100000" step="50"
                       oninput="AdminApp.updateMasterKillSimulationPreview()"
                       style="font-size:1rem; font-weight:800; color:#fde047; border:1.5px solid #38bdf8;" />
              </div>
              <div class="field">
                <label style="color:#4ade80; font-weight:700;">👑 Nível Máximo Atingível pelo Jogador (Limite: 1.000) *</label>
                <input type="number" id="xpMasterMaxLevelInput" value="200" min="2" max="1000" step="10"
                       style="font-size:1rem; font-weight:800; color:#4ade80; border:1.5px solid #22c55e;" />
              </div>
              <div>
                <button type="button" class="btn-success" onclick="AdminApp.applyMasterSingleNumberCurve()"
                        style="width:100%; padding:10px 14px; font-weight:800; font-size:0.88rem; min-height:42px;">
                  ⚡ Aplicar Número Único & Nível Máximo
                </button>
              </div>
            </div>

            <div style="font-size:0.74rem; color:#cbd5e1; font-weight:700; margin-bottom:6px;">
              📊 Quantidade Exata de Monstros de Mesmo Nível p/ Subir 1 Nível (Auto-Ajustada):
            </div>
            <div id="xpMasterKillSimTable" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(125px, 1fr)); gap:8px;"></div>
          </div>

          <!-- GRÁFICO 2D INTERATIVO DA CURVA DE XP -->
          <div style="background:rgba(15,23,42,0.85); border:1px solid #334155; border-radius:10px; padding:12px; margin-top:14px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <span style="font-size:0.80rem; font-weight:700; color:#cbd5e1;">📊 Curva de Progressão de XP por Nível</span>
              <span style="font-size:0.75rem; color:#94a3b8;">Escalonamento Proporcional Constante por Nível</span>
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
            <div id="xpBracketChipsContainer" style="display:flex; gap:6px; flex-wrap:wrap; max-height:115px; overflow-y:auto;"></div>
          </div>

          <div id="experienceTableContainer" style="overflow-x:auto; margin-top:12px;"></div>
        </div>
      `;

      const tabItems = document.getElementById('tabItems');
      if (tabItems && tabItems.nextSibling) {
        adminApp.insertBefore(panel, tabItems.nextSibling);
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
            <h3 style="color:#38bdf8; margin:0; font-size:1.05rem;">⚙️ Gerador Procedural Global de Níveis & XP</h3>
            <button class="btn-danger" onclick="document.getElementById('xpProceduralModal').style.display='none'" style="padding:4px 10px;">✕</button>
          </div>
          <p style="font-size:0.80rem; color:var(--text-muted); margin-bottom:14px;">
            Configure o Número Único de Abates (Rank F Comum) e o Nível Máximo da Curva (até 1.000 níveis).
            Fórmula: <code style="color:#38bdf8;">XP(L) = (AbatesBase × 28) × L^Exponente + (L - 1) × IncrementoLinear</code>.
          </p>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px;">
            <div class="field">
              <label style="color:#fde047; font-weight:700;">Número Único: Abates Rank F Comum *</label>
              <input type="number" id="procKillTargetInput" value="1500" min="1" oninput="AdminApp.onProcKillTargetInputChange()" />
            </div>
            <div class="field">
              <label style="color:#4ade80; font-weight:700;">Nível Máximo Atingível (2 a 1.000) *</label>
              <input type="number" id="procMaxLevelInput" value="200" min="2" max="1000" />
            </div>
            <div class="field">
              <label>Número Base de XP (Nível 1 = Abates × 28)</label>
              <input type="number" id="procBaseXpInput" value="42000" min="10" />
            </div>
            <div class="field">
              <label>Exponente de Crescimento (1.0 = Constante por Nível)</label>
              <input type="number" step="0.01" id="procExponentInput" value="1.00" min="1.0" max="3.5" />
            </div>
            <div class="field">
              <label>Incremento Linear por Nível</label>
              <input type="number" id="procFlatIncInput" value="0" min="0" />
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
              <label>Bônus Base de HP / MP por Nível</label>
              <div style="display:flex; gap:6px;">
                <input type="number" id="procHpBonusInput" value="0" min="0" placeholder="HP" />
                <input type="number" id="procMpBonusInput" value="0" min="0" placeholder="MP" />
              </div>
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
