/**
 * @file apps/server/public/admin/js/AdminMonstersTab.js
 * @module @etheria/server
 * @description Submódulo da Aba Monstros / Mobs (`monster_templates`) da Rota `/admin`.
 *   Inclui Hero Preview com Palco 2.5D, solo de grama e sombra real para calibração fina de solo,
 *   busca e galeria nos centenas de assets do mcrework, CRUD completo com raça, elemento, raridade,
 *   capacidade de ser domesticado como pet, biomas de spawn e atributos base.
 */

class AdminMonstersTab {
  static attach(app) {
    app.monsterTemplates = [];
    app.mcreworkMonsters = [];
    app.selectedMcreworkMonsterKey = '';
    app.monsterSearchQuery = '';
    app.monsterModalActiveTab = 'visual';

    AdminMonstersTab.injectModalDom();

    app.loadMonsterTemplates = async function () {
      try {
        this.monsterTemplates = await this.api('/api/admin/monster-templates');
        this.renderMonstersCrudTable();
      } catch (err) {
        console.error('Falha ao carregar templates de monstros:', err);
      }
    };

    app.switchMonsterModalTab = function (tab) {
      this.monsterModalActiveTab = tab;
      const isVisual = tab === 'visual';
      const isLore = tab === 'lore';
      const isRace = tab === 'race';
      const isStats = tab === 'stats';

      const tabVisualEl = document.getElementById('monsterTabVisual');
      const tabLoreEl = document.getElementById('monsterTabLore');
      const tabRaceEl = document.getElementById('monsterTabRace');
      const tabStatsEl = document.getElementById('monsterTabStats');

      if (tabVisualEl) tabVisualEl.style.display = isVisual ? 'flex' : 'none';
      if (tabLoreEl) tabLoreEl.style.display = isLore ? 'flex' : 'none';
      if (tabRaceEl) tabRaceEl.style.display = isRace ? 'flex' : 'none';
      if (tabStatsEl) tabStatsEl.style.display = isStats ? 'flex' : 'none';

      const btnVisual = document.getElementById('btnMonsterTabVisual');
      const btnLore = document.getElementById('btnMonsterTabLore');
      const btnRace = document.getElementById('btnMonsterTabRace');
      const btnStats = document.getElementById('btnMonsterTabStats');

      if (btnVisual) btnVisual.className = isVisual ? 'btn-primary' : '';
      if (btnLore) btnLore.className = isLore ? 'btn-primary' : '';
      if (btnRace) btnRace.className = isRace ? 'btn-primary' : '';
      if (btnStats) btnStats.className = isStats ? 'btn-primary' : '';

      this.updateMonsterGroundOffsetPreview();
    };

    app.filterMonsterGallery = function () {
      const input = document.getElementById('monsterSearchInput');
      this.monsterSearchQuery = (input ? input.value : '').toLowerCase().trim();
      this.renderMonsterGallery();
    };

    app.adjustMonsterGroundOffset = function (delta) {
      const input = document.getElementById('monsterGroundOffsetYInput');
      if (!input) return;
      let val = (Number(input.value) || 0) + delta;
      val = Math.max(-60, Math.min(60, val));
      input.value = String(val);
      this.updateMonsterGroundOffsetPreview();
    };

    app.resetMonsterGroundOffset = function () {
      const input = document.getElementById('monsterGroundOffsetYInput');
      if (input) input.value = '0';
      this.updateMonsterGroundOffsetPreview();
    };

    app.updateMonsterGroundOffsetPreview = function () {
      const heroImg = document.getElementById('monsterHeroImg');
      const offsetInput = document.getElementById('monsterGroundOffsetYInput');
      const statusBadge = document.getElementById('monsterGroundStatusBadge');
      if (heroImg && offsetInput) {
        const offsetY = Number(offsetInput.value) || 0;
        heroImg.style.transform = `translateY(${offsetY}px)`;
        if (statusBadge) {
          if (offsetY === 0) {
            statusBadge.textContent = '🟢 Pés no solo (0px)';
            statusBadge.style.color = '#86efac';
          } else if (offsetY > 0) {
            statusBadge.textContent = `🔵 Afundado +${offsetY}px no chão`;
            statusBadge.style.color = '#38bdf8';
          } else {
            statusBadge.textContent = `🟡 Flutuando ${Math.abs(offsetY)}px acima do solo`;
            statusBadge.style.color = '#fde047';
          }
        }
      }
    };

    app.renderMonsterGallery = function () {
      const grid = document.getElementById('mcreworkMonstersGrid');
      if (!grid) return;

      const filtered = this.mcreworkMonsters.filter((m) => {
        if (!this.monsterSearchQuery) return true;
        const text = `${m.mcreworkMonsterKey} ${m.suggestedName}`.toLowerCase();
        return text.includes(this.monsterSearchQuery);
      });

      const countBadge = document.getElementById('monsterCountBadge');
      if (countBadge) countBadge.textContent = String(filtered.length);

      if (filtered.length === 0) {
        grid.innerHTML = `<div style="grid-column:1/-1; color:var(--text-muted); padding:20px; text-align:center;">Nenhum monstro encontrado.</div>`;
        return;
      }

      grid.innerHTML = filtered
        .map((m) => {
          const isSel = m.mcreworkMonsterKey === this.selectedMcreworkMonsterKey;
          return `
        <div class="gallery-card ${isSel ? 'selected' : ''}" onclick="AdminApp.pickMcreworkMonster('${m.mcreworkMonsterKey}')">
          <img src="${m.thumbUrl}" alt="${m.mcreworkMonsterKey}" loading="lazy" />
          <strong style="font-size:0.78rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${m.suggestedName}</strong>
          <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.68rem; color:var(--text-muted);">
            <span>${m.mcreworkMonsterKey}</span>
            <span style="color:#f43f5e; font-weight:700;">${m.isPet ? '🐾 Pet' : '👾 Mob'}</span>
          </div>
        </div>`;
        })
        .join('');
    };

    app.updateMonsterHeroCard = function (monsterKey) {
      const found = this.mcreworkMonsters.find((m) => m.mcreworkMonsterKey === monsterKey);
      const heroImg = document.getElementById('monsterHeroImg');
      const heroLabel = document.getElementById('monsterHeroLabel');
      const heroBadge = document.getElementById('monsterHeroBadge');

      if (found) {
        if (heroImg) heroImg.src = found.thumbUrl;
        if (heroLabel) heroLabel.textContent = `${found.suggestedName} (${found.mcreworkMonsterKey})`;
        if (heroBadge) heroBadge.textContent = `${found.isPet ? '🐾 Domável como Pet' : '👾 Monstro Selvagem'}`;
      } else {
        if (heroImg) heroImg.src = '';
        if (heroLabel) heroLabel.textContent = 'Selecione um Monstro na Galeria';
        if (heroBadge) heroBadge.textContent = '';
      }
      this.updateMonsterGroundOffsetPreview();
    };

    app.pickMcreworkMonster = function (monsterKey) {
      this.selectedMcreworkMonsterKey = monsterKey;
      document.getElementById('monsterAssetKeyInput').value = monsterKey;

      const item = this.mcreworkMonsters.find((m) => m.mcreworkMonsterKey === monsterKey);
      if (item) {
        const nameInput = document.getElementById('monsterNameInput');
        if (!nameInput.value.trim() && item.suggestedName) {
          nameInput.value = item.suggestedName;
        }
      }

      this.updateMonsterHeroCard(monsterKey);
      this.renderMonsterGallery();
    };

    app.openMonsterTemplateModal = async function (editMonsterId = null) {
      document.getElementById('monsterModal').style.display = 'flex';
      this.switchMonsterModalTab('visual');
      this.monsterSearchQuery = '';
      const searchInput = document.getElementById('monsterSearchInput');
      if (searchInput) searchInput.value = '';

      // Popula selects de Raças e Elementos
      const raceSelect = document.getElementById('monsterRaceSelect');
      if (raceSelect && this.races.length > 0) {
        raceSelect.innerHTML = this.races.map((r) => `<option value="${r.code}">${r.namePtBr || r.code}</option>`).join('');
      }
      const elemSelect = document.getElementById('monsterElementSelect');
      if (elemSelect && this.elements.length > 0) {
        elemSelect.innerHTML = this.elements.map((e) => `<option value="${e.code}">${e.namePtBr || e.code}</option>`).join('');
      }

      // Popula checklist de Biomas
      const biomesBox = document.getElementById('monsterBiomesChecklist');
      if (biomesBox && this.biomes.length > 0) {
        biomesBox.innerHTML = this.biomes
          .map(
            (b) => `
          <label style="display:flex; align-items:center; gap:6px; font-size:0.75rem; background:rgba(15,23,42,0.6); padding:4px 8px; border-radius:4px; border:1px solid var(--border); cursor:pointer;">
            <input type="checkbox" name="monsterBiome" value="${b.id}" />
            <span>#${b.id} ${b.namePtBr || b.code}</span>
          </label>`
          )
          .join('');
      }

      const existingMonster = editMonsterId ? this.monsterTemplates.find((m) => m.id === Number(editMonsterId)) : null;

      if (existingMonster) {
        document.getElementById('monsterModalTitle').textContent = `✏️ Editar Monstro #${existingMonster.id} (${existingMonster.code})`;
        document.getElementById('monsterEditIdInput').value = String(existingMonster.id);
        document.getElementById('monsterCodeInput').value = `#${existingMonster.id} • ${existingMonster.code}`;
        document.getElementById('monsterNameInput').value = existingMonster.namePtBr || '';
        document.getElementById('monsterRaceSelect').value = existingMonster.raceCode || 'BEAST';
        document.getElementById('monsterElementSelect').value = existingMonster.fixedElementCode || 'NEUTRAL';
        document.getElementById('monsterRaritySelect').value = String(existingMonster.defaultRarityId || 1);
        document.getElementById('monsterTamableCheckbox').checked = existingMonster.isTamableAsPet !== false;
        document.getElementById('monsterAssetKeyInput').value = existingMonster.mcreworkMonsterKey || '';
        document.getElementById('monsterDescriptionInput').value = existingMonster.descriptionPtBr || '';
        document.getElementById('monsterDescI18nDisplay').textContent = `Chave i18n: monster.${existingMonster.code}.description`;
        document.getElementById('monsterGroundOffsetYInput').value = String(existingMonster.groundOffsetY || 0);

        this.selectedMcreworkMonsterKey = existingMonster.mcreworkMonsterKey || '';

        const base = existingMonster.baseAttributesJson || {};
        document.getElementById('monsterBaseVIT').value = String(base.VIT ?? 12);
        document.getElementById('monsterBaseSTR').value = String(base.STR ?? 12);
        document.getElementById('monsterBaseINT').value = String(base.INT ?? 10);
        document.getElementById('monsterBaseWIS').value = String(base.WIS ?? 10);
        document.getElementById('monsterBaseAGI').value = String(base.AGI ?? 10);
        document.getElementById('monsterBaseDEX').value = String(base.DEX ?? 10);

        // Marca biomas vinculados
        const linkedBiomeIds = new Set((existingMonster.biomesList || []).map((b) => b.biomeId));
        document.querySelectorAll('input[name="monsterBiome"]').forEach((chk) => {
          chk.checked = linkedBiomeIds.has(Number(chk.value));
        });
      } else {
        const maxId = this.monsterTemplates.reduce((acc, m) => Math.max(acc, Number(m.id) || 0), 0);
        const nextId = maxId + 1;
        document.getElementById('monsterModalTitle').textContent = `🐉 Novo Monstro #${nextId} (monster_${nextId})`;
        document.getElementById('monsterEditIdInput').value = '';
        document.getElementById('monsterCodeInput').value = `#${nextId} • monster_${nextId} (Automático)`;
        document.getElementById('monsterNameInput').value = '';
        document.getElementById('monsterRaceSelect').value = 'BEAST';
        document.getElementById('monsterElementSelect').value = 'NEUTRAL';
        document.getElementById('monsterRaritySelect').value = '1';
        document.getElementById('monsterTamableCheckbox').checked = true;
        document.getElementById('monsterAssetKeyInput').value = '';
        document.getElementById('monsterDescriptionInput').value = '';
        document.getElementById('monsterDescI18nDisplay').textContent = `Chave i18n: monster.monster_${nextId}.description (Auto-gerada)`;
        document.getElementById('monsterGroundOffsetYInput').value = '0';

        this.selectedMcreworkMonsterKey = '';

        document.getElementById('monsterBaseVIT').value = '14';
        document.getElementById('monsterBaseSTR').value = '12';
        document.getElementById('monsterBaseINT').value = '10';
        document.getElementById('monsterBaseWIS').value = '10';
        document.getElementById('monsterBaseAGI').value = '10';
        document.getElementById('monsterBaseDEX').value = '10';

        document.querySelectorAll('input[name="monsterBiome"]').forEach((chk) => {
          chk.checked = false;
        });
      }

      const grid = document.getElementById('mcreworkMonstersGrid');
      if (this.mcreworkMonsters.length === 0) {
        grid.innerHTML = '<div>Carregando catálogo de monstros do mcrework...</div>';
        try {
          this.mcreworkMonsters = await this.api('/api/admin/mcrework/monsters');
        } catch (err) {
          grid.innerHTML = `<div style="color:#fca5a5;">${err.message}</div>`;
          return;
        }
      }

      if (!this.selectedMcreworkMonsterKey && this.mcreworkMonsters.length > 0) {
        this.selectedMcreworkMonsterKey = this.mcreworkMonsters[0].mcreworkMonsterKey;
        document.getElementById('monsterAssetKeyInput').value = this.selectedMcreworkMonsterKey;
        if (!document.getElementById('monsterNameInput').value) {
          document.getElementById('monsterNameInput').value = this.mcreworkMonsters[0].suggestedName;
        }
      }

      this.updateMonsterHeroCard(this.selectedMcreworkMonsterKey);
      this.renderMonsterGallery();
      this.updateMonsterGroundOffsetPreview();
    };

    app.saveMonsterTemplate = async function () {
      try {
        const editId = document.getElementById('monsterEditIdInput').value.trim();
        const namePtBr = document.getElementById('monsterNameInput').value.trim();
        const mcreworkMonsterKey = document.getElementById('monsterAssetKeyInput').value.trim();
        const descriptionPtBr = document.getElementById('monsterDescriptionInput').value.trim();
        const raceCode = document.getElementById('monsterRaceSelect').value || 'BEAST';
        const fixedElementCode = document.getElementById('monsterElementSelect').value || 'NEUTRAL';
        const defaultRarityId = Number(document.getElementById('monsterRaritySelect').value) || 1;
        const isTamableAsPet = document.getElementById('monsterTamableCheckbox').checked;
        const groundOffsetY = Number(document.getElementById('monsterGroundOffsetYInput').value) || 0;

        if (!mcreworkMonsterKey) {
          alert('Toque em um modelo de Monstro da galeria para selecioná-lo.');
          return;
        }

        const selectedBiomes = Array.from(document.querySelectorAll('input[name="monsterBiome"]:checked')).map((c) =>
          Number(c.value)
        );

        const dto = {
          namePtBr,
          descriptionPtBr,
          mcreworkMonsterKey,
          groundOffsetY,
          raceCode,
          fixedElementCode,
          defaultRarityId,
          isTamableAsPet,
          biomeIds: selectedBiomes,
          baseAttributesJson: {
            VIT: Number(document.getElementById('monsterBaseVIT').value) || 10,
            STR: Number(document.getElementById('monsterBaseSTR').value) || 10,
            INT: Number(document.getElementById('monsterBaseINT').value) || 10,
            WIS: Number(document.getElementById('monsterBaseWIS').value) || 10,
            AGI: Number(document.getElementById('monsterBaseAGI').value) || 10,
            DEX: Number(document.getElementById('monsterBaseDEX').value) || 10,
          },
        };

        const path = editId ? `/api/admin/monster-templates/${editId}` : '/api/admin/monster-templates';
        const method = editId ? 'PUT' : 'POST';

        await this.api(path, {
          method,
          body: JSON.stringify(dto),
        });

        this.closeModal('monsterModal');
        await this.loadMonsterTemplates();
      } catch (err) {
        alert(`Erro ao salvar Monstro: ${err.message}`);
      }
    };

    app.deleteMonsterTemplate = async function (id) {
      if (!confirm('Deseja realmente excluir este Monstro da tabela?')) return;
      try {
        await this.api(`/api/admin/monster-templates/${id}`, { method: 'DELETE' });
        await this.loadMonsterTemplates();
      } catch (err) {
        alert(`Erro ao excluir Monstro: ${err.message}`);
      }
    };

    app.renderMonstersCrudTable = function () {
      const tbody = document.getElementById('monstersTableBody');
      if (!tbody) return;

      if (!this.monsterTemplates || this.monsterTemplates.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="color:var(--text-muted); padding:16px; text-align:center;">Nenhum Monstro cadastrado ainda. Clique em <strong>"➕ Novo Monstro do mcrework"</strong> acima para criar o primeiro!</td></tr>`;
        return;
      }

      tbody.innerHTML = this.monsterTemplates
        .map((m) => {
          const b = m.baseAttributesJson || {};
          const statsStr = `VIT:${b.VIT ?? 10} | STR:${b.STR ?? 10} | INT:${b.INT ?? 10} | WIS:${b.WIS ?? 10} | AGI:${b.AGI ?? 10} | DEX:${b.DEX ?? 10}`;
          const gOffStr = m.groundOffsetY !== 0 ? ` [↧ ${m.groundOffsetY > 0 ? '+' : ''}${m.groundOffsetY}px]` : '';
          const biomesStr =
            Array.isArray(m.biomesList) && m.biomesList.length > 0
              ? m.biomesList.map((bi) => bi.namePtBr || bi.code).join(', ')
              : 'Todos os Biomas';

          return `
        <tr>
          <td><strong>#${m.id}</strong> &bull; <span style="color:#f43f5e; font-weight:700;">${m.code}</span></td>
          <td>
            <div style="display:flex; align-items:center; gap:8px;">
              <img src="${m.thumbUrl}" alt="${m.mcreworkMonsterKey}" style="width:48px; height:48px; object-fit:contain; background:#020617; border-radius:6px; border:1px solid #f43f5e;" />
              <div>
                <span style="font-size:0.75rem; color:var(--text-muted);">${m.mcreworkMonsterKey}<span style="color:#fde047; font-weight:600;">${gOffStr}</span></span>
                <div style="font-size:0.7rem; color:${m.isTamableAsPet ? '#86efac' : '#fca5a5'};">${m.isTamableAsPet ? '🐾 Pet Domável' : '⚔️ Apenas Monstro'}</div>
              </div>
            </div>
          </td>
          <td>
            <strong>${m.namePtBr}</strong>
            ${m.descriptionPtBr ? `<div style="font-size:0.72rem; color:var(--text-muted); max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${m.descriptionPtBr.replace(/"/g, '&quot;')}">📜 ${m.descriptionPtBr}</div>` : ''}
          </td>
          <td>
            <span style="padding:2px 8px; border-radius:99px; background:rgba(244,63,94,0.14); color:#fb7185; font-size:0.75rem; font-weight:600;">${m.raceNamePtBr || m.raceCode}</span>
            <span style="padding:2px 8px; border-radius:99px; background:rgba(56,189,248,0.14); color:var(--accent); font-size:0.75rem; font-weight:600;">${m.elementNamePtBr || m.fixedElementCode}</span>
          </td>
          <td>
            <span style="padding:2px 8px; border-radius:99px; background:rgba(192,132,252,0.14); color:#c084fc; font-size:0.75rem; font-weight:700;">${m.rarityNamePtBr || 'COMMON'}</span>
          </td>
          <td><span style="font-family:monospace; font-size:0.75rem;">${statsStr}</span></td>
          <td><span style="font-size:0.72rem; color:var(--text-muted);">${biomesStr}</span></td>
          <td>
            <div style="display:flex; gap:6px;">
              <button onclick="AdminApp.openMonsterTemplateModal(${m.id})">✏️ Editar</button>
              <button class="btn-danger" onclick="AdminApp.deleteMonsterTemplate(${m.id})">🗑️</button>
            </div>
          </td>
        </tr>`;
        })
        .join('');
    };
  }

  /**
   * Injeta dinamicamente a estrutura DOM do modal de criação/edição de monstros,
   * garantindo que `index.html` permaneça leve e abaixo do limite de 1.000 linhas (Regra #7).
   */
  static injectModalDom() {
    if (document.getElementById('monsterModal')) return;

    const modalDiv = document.createElement('div');
    modalDiv.id = 'monsterModal';
    modalDiv.className = 'modal-backdrop';
    modalDiv.style.display = 'none';

    modalDiv.innerHTML = `
    <div class="modal-box" style="max-width:850px; width:95%; max-height:90vh; display:flex; flex-direction:column; gap:10px; overflow-y:auto; -webkit-overflow-scrolling:touch;">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:8px;">
        <h3 id="monsterModalTitle" style="color:#f43f5e; margin:0;">🐉 Novo Monstro do mcrework</h3>
        <button class="btn-danger" onclick="AdminApp.closeModal('monsterModal')" style="padding:4px 8px;">✕</button>
      </div>
      <input type="hidden" id="monsterEditIdInput" value="" />
      <input type="hidden" id="monsterAssetKeyInput" value="" />

      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:8px;">
        <div class="field">
          <label>ID & Chave do Monstro</label>
          <input type="text" id="monsterCodeInput" readonly style="opacity:0.8; font-weight:700; color:#f43f5e;" />
        </div>
        <div class="field">
          <label>Nome do Monstro (PT-BR)</label>
          <input type="text" id="monsterNameInput" placeholder="Ex: Bang Hung da Tempestade" />
        </div>
      </div>

      <!-- 4 ABAS LIMPAS: VISUAL 2.5D, LORE/I18N, RAÇA/ELEMENTO, ATRIBUTOS -->
      <div style="display:flex; gap:4px; border-bottom:1px solid var(--border); padding-bottom:4px; overflow-x:auto;">
        <button id="btnMonsterTabVisual" class="btn-primary" onclick="AdminApp.switchMonsterModalTab('visual')" style="flex:1; padding:6px 4px; font-size:0.76rem; white-space:nowrap;">🎨 Visual & Solo</button>
        <button id="btnMonsterTabLore" onclick="AdminApp.switchMonsterModalTab('lore')" style="flex:1; padding:6px 4px; font-size:0.76rem; white-space:nowrap;">📜 Lore / i18n</button>
        <button id="btnMonsterTabRace" onclick="AdminApp.switchMonsterModalTab('race')" style="flex:1; padding:6px 4px; font-size:0.76rem; white-space:nowrap;">🧬 Raça & Elemento</button>
        <button id="btnMonsterTabStats" onclick="AdminApp.switchMonsterModalTab('stats')" style="flex:1; padding:6px 4px; font-size:0.76rem; white-space:nowrap;">📊 Atributos</button>
      </div>

      <!-- ABA 1: VISUAL COM PALCO 2.5D -->
      <div id="monsterTabVisual" style="display:flex; flex-direction:column; gap:8px;">
        <div style="display:flex; align-items:center; gap:10px; background:rgba(30,41,59,0.7); border:1.5px solid #f43f5e; border-radius:10px; padding:8px 10px;">
          <!-- Palco 2.5D com solo e sombra -->
          <div style="position:relative; width:100px; height:116px; background:radial-gradient(ellipse at center bottom, #4c0519 0%, #020617 75%); border:1px solid #f43f5e; border-radius:8px; overflow:hidden; display:flex; flex-direction:column; align-items:center; justify-content:flex-end; padding-bottom:12px; box-shadow:inset 0 0 15px rgba(0,0,0,0.7); flex-shrink:0;">
            <div style="position:absolute; bottom:0; left:0; right:0; height:16px; background:linear-gradient(to bottom, #15803d, #14532d); border-top:2px solid #86efac;"></div>
            <div style="position:absolute; bottom:15px; left:0; right:0; height:1px; background:rgba(253,224,71,0.6);" title="Nível 0 do Solo"></div>
            <div style="position:absolute; bottom:10px; width:44px; height:13px; background:rgba(0,0,0,0.55); border-radius:50%;"></div>
            <img id="monsterHeroImg" src="" alt="Monster Preview" style="position:relative; z-index:2; max-height:84px; max-width:76px; object-fit:contain; transition:transform 0.08s ease-out;" />
            <span style="position:absolute; top:3px; right:4px; font-size:0.6rem; color:#fca5a5; background:rgba(0,0,0,0.7); padding:1px 4px; border-radius:3px;">Solo 2.5D</span>
          </div>

          <div style="flex:1; display:flex; flex-direction:column; gap:4px; min-width:0;">
            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
              <strong id="monsterHeroLabel" style="font-size:0.88rem; color:#fde047; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">Selecione um Monstro</strong>
              <span id="monsterHeroBadge" style="font-size:0.7rem; padding:1px 6px; border-radius:99px; background:rgba(244,63,94,0.2); color:#fb7185; font-weight:700;"></span>
            </div>
            <span style="font-size:0.7rem; color:var(--text-muted);">Calibrar pés do monstro no chão:</span>
            <div style="display:flex; align-items:center; gap:3px; flex-wrap:wrap;">
              <button type="button" onclick="AdminApp.adjustMonsterGroundOffset(-5)" style="padding:3px 6px; font-size:0.72rem;">-5</button>
              <button type="button" onclick="AdminApp.adjustMonsterGroundOffset(-1)" style="padding:3px 6px; font-size:0.72rem;">-1</button>
              <input type="number" id="monsterGroundOffsetYInput" value="0" min="-60" max="60" oninput="AdminApp.updateMonsterGroundOffsetPreview()" style="width:48px; text-align:center; padding:3px; font-size:0.8rem;" />
              <button type="button" onclick="AdminApp.adjustMonsterGroundOffset(1)" style="padding:3px 6px; font-size:0.72rem;">+1</button>
              <button type="button" onclick="AdminApp.adjustMonsterGroundOffset(5)" style="padding:3px 6px; font-size:0.72rem;">+5</button>
              <button type="button" onclick="AdminApp.resetMonsterGroundOffset()" title="Zerar" style="padding:3px 5px; font-size:0.72rem;">↩0</button>
            </div>
            <span id="monsterGroundStatusBadge" style="font-size:0.7rem; color:#86efac; font-weight:600;">Pés no solo (0px)</span>
          </div>
        </div>

        <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
          <input type="text" id="monsterSearchInput" placeholder="🔍 Buscar monstro no catálogo do mcrework..." oninput="AdminApp.filterMonsterGallery()" style="flex:1; min-width:180px; padding:6px 10px; font-size:0.82rem;" />
          <span style="font-size:0.74rem; color:var(--text-muted);">(<span id="monsterCountBadge">0</span> disponíveis)</span>
        </div>
        <div id="mcreworkMonstersGrid" class="gallery-grid" style="max-height:48vh; min-height:220px;"></div>
      </div>

      <!-- ABA 2: LORE & I18N -->
      <div id="monsterTabLore" style="display:none; flex-direction:column; gap:8px;">
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.76rem;">
          <label style="color:var(--text-muted); font-weight:600;">📜 Descrição do Monstro / Pet (PT-BR):</label>
          <span id="monsterDescI18nDisplay" style="color:var(--accent); font-family:monospace; font-size:0.72rem;">monster.monster_X.description</span>
        </div>
        <textarea id="monsterDescriptionInput" rows="5" placeholder="História, comportamento ecológico, hábitos de caça e lendas sobre este monstro..." style="width:100%; padding:8px 10px; font-size:0.82rem; line-height:1.45; resize:vertical;"></textarea>
      </div>

      <!-- ABA 3: RAÇA, ELEMENTO & RARIDADE -->
      <div id="monsterTabRace" style="display:none; flex-direction:column; gap:10px;">
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:10px;">
          <div class="field">
            <label>Raça do Monstro</label>
            <select id="monsterRaceSelect"></select>
          </div>
          <div class="field">
            <label>Elemento Fixo Inimigo</label>
            <select id="monsterElementSelect"></select>
          </div>
          <div class="field">
            <label>Raridade Padrão</label>
            <select id="monsterRaritySelect">
              <option value="1">COMMON (Comum)</option>
              <option value="2">UNCOMMON (Incomum)</option>
              <option value="3">ELITE (Elite)</option>
              <option value="4">RARE (Raro)</option>
              <option value="5">MINIBOSS (Mini-Chefe)</option>
              <option value="6">BOSS (Chefe de Raid)</option>
            </select>
          </div>
          <div class="field" style="display:flex; align-items:center; gap:8px; padding-top:16px;">
            <input type="checkbox" id="monsterTamableCheckbox" checked style="width:18px; height:18px; cursor:pointer;" />
            <label for="monsterTamableCheckbox" style="margin:0; cursor:pointer; font-size:0.85rem; color:#86efac; font-weight:700;">🐾 Pode ser capturado / domado como Pet</label>
          </div>
        </div>
        <div class="field">
          <label>Biomas de Spawn Natural (onde este monstro aparece nos mapas)</label>
          <div id="monsterBiomesChecklist" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(140px, 1fr)); gap:6px; max-height:160px; overflow-y:auto; padding:6px; background:#020617; border:1px solid var(--border); border-radius:6px;"></div>
        </div>
      </div>

      <!-- ABA 4: ATRIBUTOS BASE -->
      <div id="monsterTabStats" style="display:none; flex-direction:column; gap:10px;">
        <div class="field">
          <label>Pesos de Atributos Base no Nível 1</label>
          <div style="display:grid; grid-template-columns:repeat(6, 1fr); gap:6px;">
            <div><label style="font-size:0.7rem; color:var(--text-muted);">VIT</label><input type="number" id="monsterBaseVIT" value="14" min="1" /></div>
            <div><label style="font-size:0.7rem; color:var(--text-muted);">STR</label><input type="number" id="monsterBaseSTR" value="12" min="1" /></div>
            <div><label style="font-size:0.7rem; color:var(--text-muted);">INT</label><input type="number" id="monsterBaseINT" value="10" min="1" /></div>
            <div><label style="font-size:0.7rem; color:var(--text-muted);">WIS</label><input type="number" id="monsterBaseWIS" value="10" min="1" /></div>
            <div><label style="font-size:0.7rem; color:var(--text-muted);">AGI</label><input type="number" id="monsterBaseAGI" value="10" min="1" /></div>
            <div><label style="font-size:0.7rem; color:var(--text-muted);">DEX</label><input type="number" id="monsterBaseDEX" value="10" min="1" /></div>
          </div>
        </div>
      </div>

      <div style="border-top:1px solid var(--border); padding-top:8px;">
        <button class="btn-success" style="width:100%; padding:11px; font-weight:700;" onclick="AdminApp.saveMonsterTemplate()">
          💾 Salvar Monstro na Tabela
        </button>
      </div>
    </div>`;

    document.body.appendChild(modalDiv);
  }
}

window.AdminMonstersTab = AdminMonstersTab;
