/**
 * @file apps/server/public/admin/js/AdminClassesTab.js
 * @module @etheria/server
 * @description Submódulo da Aba Personagens / Classes (`class_templates`) da Rota `/admin`.
 *   Inclui Hero Preview 72px com linha de chão, abas de Visual Padrão, Visual Reencarnado (Reborn),
 *   calibração de distância dos pés ao solo (Ground Offset Y em pixels), descrição em PT-BR com i18n
 *   auto-incremental, galeria com filtro/busca e edição completa de atributos base/crescimento.
 */

class AdminClassesTab {
  static attach(app) {
    app.classModalActiveTab = 'visual';
    app.classRebornSearchQuery = '';

    app.switchClassModalTab = function (tab) {
      this.classModalActiveTab = tab;
      const isVisual = tab === 'visual';
      const isReborn = tab === 'reborn';
      const isDesc = tab === 'desc';
      const isStats = tab === 'stats';

      const tabVisualEl = document.getElementById('classTabVisual');
      const tabRebornEl = document.getElementById('classTabReborn');
      const tabDescEl = document.getElementById('classTabDesc');
      const tabStatsEl = document.getElementById('classTabStats');

      if (tabVisualEl) tabVisualEl.style.display = isVisual ? 'flex' : 'none';
      if (tabRebornEl) tabRebornEl.style.display = isReborn ? 'flex' : 'none';
      if (tabDescEl) tabDescEl.style.display = isDesc ? 'flex' : 'none';
      if (tabStatsEl) tabStatsEl.style.display = isStats ? 'flex' : 'none';

      const btnVisual = document.getElementById('btnClassTabVisual');
      const btnReborn = document.getElementById('btnClassTabReborn');
      const btnDesc = document.getElementById('btnClassTabDesc');
      const btnStats = document.getElementById('btnClassTabStats');

      if (btnVisual) btnVisual.className = isVisual ? 'btn-primary' : '';
      if (btnReborn) btnReborn.className = isReborn ? 'btn-primary' : '';
      if (btnDesc) btnDesc.className = isDesc ? 'btn-primary' : '';
      if (btnStats) btnStats.className = isStats ? 'btn-primary' : '';

      this.updateGroundOffsetPreview();
    };

    app.setClassGenderFilter = function (filter) {
      this.classGenderFilter = filter;
      document.getElementById('btnClassFilterAll').className = filter === 'ALL' ? 'active-tool' : '';
      document.getElementById('btnClassFilterMale').className = filter === 'MALE' ? 'active-tool' : '';
      document.getElementById('btnClassFilterFemale').className = filter === 'FEMALE' ? 'active-tool' : '';
      this.renderClassGallery();
    };

    app.filterClassGallery = function () {
      const input = document.getElementById('classSearchInput');
      this.classSearchQuery = (input ? input.value : '').toLowerCase().trim();
      this.renderClassGallery();
    };

    app.filterClassRebornGallery = function () {
      const input = document.getElementById('classRebornSearchInput');
      this.classRebornSearchQuery = (input ? input.value : '').toLowerCase().trim();
      this.renderClassRebornGallery();
    };

    app.adjustGroundOffset = function (delta) {
      const input = document.getElementById('classGroundOffsetYInput');
      if (!input) return;
      let val = (Number(input.value) || 0) + delta;
      val = Math.max(-60, Math.min(60, val));
      input.value = String(val);
      this.updateGroundOffsetPreview();
    };

    app.resetGroundOffset = function () {
      const input = document.getElementById('classGroundOffsetYInput');
      if (input) input.value = '0';
      this.updateGroundOffsetPreview();
    };

    app.adjustRebornGroundOffset = function (delta) {
      const input = document.getElementById('classRebornGroundOffsetYInput');
      if (!input) return;
      let val = (Number(input.value) || 0) + delta;
      val = Math.max(-60, Math.min(60, val));
      input.value = String(val);
      this.updateGroundOffsetPreview();
    };

    app.resetRebornGroundOffset = function () {
      const input = document.getElementById('classRebornGroundOffsetYInput');
      if (input) input.value = '0';
      this.updateGroundOffsetPreview();
    };

    app.updateGroundOffsetPreview = function () {
      const heroImg = document.getElementById('classHeroImg');
      const offsetInput = document.getElementById('classGroundOffsetYInput');
      const statusBadge = document.getElementById('classGroundStatusBadge');
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

      const rebornHeroImg = document.getElementById('classRebornHeroImg');
      const rebornOffsetInput = document.getElementById('classRebornGroundOffsetYInput');
      const rebornStatusBadge = document.getElementById('classRebornGroundStatusBadge');
      if (rebornHeroImg && rebornOffsetInput) {
        const rOffsetY = Number(rebornOffsetInput.value) || 0;
        rebornHeroImg.style.transform = `translateY(${rOffsetY}px)`;
        if (rebornStatusBadge) {
          if (rOffsetY === 0) {
            rebornStatusBadge.textContent = '🟢 Pés no solo (0px)';
            rebornStatusBadge.style.color = '#86efac';
          } else if (rOffsetY > 0) {
            rebornStatusBadge.textContent = `🔵 Afundado +${rOffsetY}px no chão`;
            rebornStatusBadge.style.color = '#38bdf8';
          } else {
            rebornStatusBadge.textContent = `✨ Flutuando ${Math.abs(rOffsetY)}px acima do solo`;
            rebornStatusBadge.style.color = '#c084fc';
          }
        }
      }
    };

    app.renderClassGallery = function () {
      const grid = document.getElementById('mcreworkCharsGrid');
      if (!grid) return;

      const filtered = this.mcreworkChars.filter((c) => {
        if (this.classGenderFilter === 'MALE' && c.gender !== 'MALE') return false;
        if (this.classGenderFilter === 'FEMALE' && c.gender !== 'FEMALE') return false;
        if (!this.classSearchQuery) return true;
        const text = `${c.mcreworkCharKey} ${c.suggestedName}`.toLowerCase();
        return text.includes(this.classSearchQuery);
      });

      const countBadge = document.getElementById('classCountBadge');
      if (countBadge) countBadge.textContent = String(filtered.length);

      if (filtered.length === 0) {
        grid.innerHTML = `<div style="grid-column:1/-1; color:var(--text-muted); padding:20px; text-align:center;">Nenhum modelo encontrado para o filtro atual.</div>`;
        return;
      }

      grid.innerHTML = filtered
        .map((c) => {
          const isSel = c.mcreworkCharKey === this.selectedMcreworkCharKey;
          const genderBadge = c.gender === 'FEMALE' ? '👩 Fem' : '👨 Masc';
          return `
        <div class="gallery-card ${isSel ? 'selected' : ''}" onclick="AdminApp.pickMcreworkChar('${c.mcreworkCharKey}')">
          <img src="${c.thumbUrl}" alt="${c.mcreworkCharKey}" loading="lazy" />
          <strong style="font-size:0.8rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${c.suggestedName}</strong>
          <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.7rem; color:var(--text-muted);">
            <span>${genderBadge}</span>
            <span style="color:var(--accent); font-weight:700;">Tier ${c.tier}</span>
          </div>
        </div>`;
        })
        .join('');
    };

    app.renderClassRebornGallery = function () {
      const grid = document.getElementById('mcreworkCharsRebornGrid');
      if (!grid) return;

      const filtered = this.mcreworkChars.filter((c) => {
        if (!this.classRebornSearchQuery) return true;
        const text = `${c.mcreworkCharKey} ${c.suggestedName}`.toLowerCase();
        return text.includes(this.classRebornSearchQuery);
      });

      if (filtered.length === 0) {
        grid.innerHTML = `<div style="grid-column:1/-1; color:var(--text-muted); padding:16px; text-align:center;">Nenhum modelo encontrado.</div>`;
        return;
      }

      grid.innerHTML = filtered
        .map((c) => {
          const isSel = c.mcreworkCharKey === this.selectedMcreworkRebornCharKey;
          const genderBadge = c.gender === 'FEMALE' ? '👩 Fem' : '👨 Masc';
          return `
        <div class="gallery-card ${isSel ? 'selected' : ''}" onclick="AdminApp.pickMcreworkRebornChar('${c.mcreworkCharKey}')">
          <img src="${c.thumbUrl}" alt="${c.mcreworkCharKey}" loading="lazy" />
          <strong style="font-size:0.78rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${c.suggestedName}</strong>
          <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.68rem; color:var(--text-muted);">
            <span>${genderBadge}</span>
            <span style="color:#c084fc; font-weight:700;">Tier ${c.tier}</span>
          </div>
        </div>`;
        })
        .join('');
    };

    app.updateClassHeroCard = function (charKey) {
      const found = this.mcreworkChars.find((c) => c.mcreworkCharKey === charKey);
      const heroImg = document.getElementById('classHeroImg');
      const heroLabel = document.getElementById('classHeroLabel');
      const heroBadge = document.getElementById('classHeroBadge');

      if (found) {
        if (heroImg) heroImg.src = found.thumbUrl;
        if (heroLabel) heroLabel.textContent = `${found.suggestedName} (${found.mcreworkCharKey})`;
        if (heroBadge) heroBadge.textContent = `${found.gender === 'FEMALE' ? '👩 Feminino' : '👨 Masculino'} • Tier ${found.tier}`;
      } else {
        if (heroImg) heroImg.src = '';
        if (heroLabel) heroLabel.textContent = 'Selecione um Modelo na Galeria';
        if (heroBadge) heroBadge.textContent = '';
      }
      this.updateGroundOffsetPreview();
    };

    app.updateClassRebornHeroCard = function (charKey) {
      const found = this.mcreworkChars.find((c) => c.mcreworkCharKey === charKey);
      const heroImg = document.getElementById('classRebornHeroImg');
      const heroLabel = document.getElementById('classRebornHeroLabel');
      const heroBadge = document.getElementById('classRebornHeroBadge');

      if (found) {
        if (heroImg) {
          heroImg.src = found.thumbUrl;
          heroImg.style.display = 'block';
        }
        if (heroLabel) heroLabel.textContent = `${found.suggestedName} (${found.mcreworkCharKey})`;
        if (heroBadge) heroBadge.textContent = `Visual Reencarnado Ativo • ${found.gender === 'FEMALE' ? 'Feminino' : 'Masculino'} (Tier ${found.tier})`;
      } else {
        if (heroImg) {
          heroImg.src = '';
          heroImg.style.display = 'none';
        }
        if (heroLabel) heroLabel.textContent = 'Sem Visual Reencarnado';
        if (heroBadge) heroBadge.textContent = 'Toque em um modelo abaixo para vincular o visual Reborn';
      }
      this.updateGroundOffsetPreview();
    };

    app.openClassTemplateModal = async function (editClassId = null) {
      document.getElementById('classModal').style.display = 'flex';
      this.switchClassModalTab('visual');
      this.classGenderFilter = 'ALL';
      this.classSearchQuery = '';
      this.classRebornSearchQuery = '';
      const searchInput = document.getElementById('classSearchInput');
      if (searchInput) searchInput.value = '';
      const rebornSearchInput = document.getElementById('classRebornSearchInput');
      if (rebornSearchInput) rebornSearchInput.value = '';

      const existingClass = editClassId
        ? this.classTemplates.find((c) => c.id === Number(editClassId))
        : null;

      if (existingClass) {
        document.getElementById('classModalTitle').textContent = `✏️ Editar Personagem / Classe #${existingClass.id} (${existingClass.code})`;
        document.getElementById('classEditIdInput').value = String(existingClass.id);
        document.getElementById('classCodeInput').value = `#${existingClass.id} • ${existingClass.code}`;
        document.getElementById('classNameInput').value = existingClass.namePtBr || '';
        document.getElementById('classRaceSelect').value = existingClass.raceCode || 'HUMAN';
        document.getElementById('classAssetKeyInput').value = existingClass.mcreworkCharKey || '';
        document.getElementById('classRebornAssetKeyInput').value = existingClass.rebornMcreworkCharKey || '';
        document.getElementById('classDescriptionInput').value = existingClass.descriptionPtBr || '';
        document.getElementById('classDescI18nDisplay').textContent = `Chave i18n: class.${existingClass.code}.description`;

        document.getElementById('classGroundOffsetYInput').value = String(existingClass.groundOffsetY || 0);
        document.getElementById('classRebornGroundOffsetYInput').value = String(existingClass.rebornGroundOffsetY || 0);

        this.selectedMcreworkCharKey = existingClass.mcreworkCharKey || '';
        this.selectedMcreworkRebornCharKey = existingClass.rebornMcreworkCharKey || '';

        const base = existingClass.baseAttributesJson || {};
        document.getElementById('classBaseVIT').value = String(base.VIT ?? 12);
        document.getElementById('classBaseSTR').value = String(base.STR ?? 12);
        document.getElementById('classBaseINT').value = String(base.INT ?? 10);
        document.getElementById('classBaseWIS').value = String(base.WIS ?? 10);
        document.getElementById('classBaseAGI').value = String(base.AGI ?? 10);
        document.getElementById('classBaseDEX').value = String(base.DEX ?? 10);

        const grow = existingClass.growthPerLevelJson || {};
        document.getElementById('classGrowVIT').value = String(grow.VIT ?? 2);
        document.getElementById('classGrowSTR').value = String(grow.STR ?? 2);
        document.getElementById('classGrowINT').value = String(grow.INT ?? 2);
        document.getElementById('classGrowWIS').value = String(grow.WIS ?? 2);
        document.getElementById('classGrowAGI').value = String(grow.AGI ?? 2);
        document.getElementById('classGrowDEX').value = String(grow.DEX ?? 2);
      } else {
        const maxClassId = this.classTemplates.reduce((acc, c) => Math.max(acc, Number(c.id) || 0), 0);
        const nextClassId = maxClassId + 1;
        document.getElementById('classModalTitle').textContent = `🦸 Novo Personagem / Classe #${nextClassId} (class_${nextClassId})`;
        document.getElementById('classEditIdInput').value = '';
        document.getElementById('classCodeInput').value = `#${nextClassId} • class_${nextClassId} (Automático)`;
        document.getElementById('classNameInput').value = '';
        document.getElementById('classRaceSelect').value = 'HUMAN';
        document.getElementById('classAssetKeyInput').value = '';
        document.getElementById('classRebornAssetKeyInput').value = '';
        document.getElementById('classDescriptionInput').value = '';
        document.getElementById('classDescI18nDisplay').textContent = `Chave i18n: class.class_${nextClassId}.description (Auto-gerada)`;

        document.getElementById('classGroundOffsetYInput').value = '0';
        document.getElementById('classRebornGroundOffsetYInput').value = '0';

        this.selectedMcreworkCharKey = '';
        this.selectedMcreworkRebornCharKey = '';

        document.getElementById('classBaseVIT').value = '12';
        document.getElementById('classBaseSTR').value = '12';
        document.getElementById('classBaseINT').value = '10';
        document.getElementById('classBaseWIS').value = '10';
        document.getElementById('classBaseAGI').value = '10';
        document.getElementById('classBaseDEX').value = '10';

        document.getElementById('classGrowVIT').value = '2';
        document.getElementById('classGrowSTR').value = '2';
        document.getElementById('classGrowINT').value = '2';
        document.getElementById('classGrowWIS').value = '2';
        document.getElementById('classGrowAGI').value = '2';
        document.getElementById('classGrowDEX').value = '2';
      }

      const grid = document.getElementById('mcreworkCharsGrid');
      if (this.mcreworkChars.length === 0) {
        grid.innerHTML = '<div>Carregando os 46 modelos de personagens do mcrework...</div>';
        try {
          this.mcreworkChars = await this.api('/api/admin/mcrework/characters');
        } catch (err) {
          grid.innerHTML = `<div style="color:#fca5a5;">${err.message}</div>`;
          return;
        }
      }

      if (!this.selectedMcreworkCharKey && this.mcreworkChars.length > 0) {
        this.selectedMcreworkCharKey = this.mcreworkChars[0].mcreworkCharKey;
        document.getElementById('classAssetKeyInput').value = this.selectedMcreworkCharKey;
        if (!document.getElementById('classNameInput').value) {
          document.getElementById('classNameInput').value = this.mcreworkChars[0].suggestedName;
        }
      }

      this.updateClassHeroCard(this.selectedMcreworkCharKey);
      this.updateClassRebornHeroCard(this.selectedMcreworkRebornCharKey);
      this.renderClassGallery();
      this.renderClassRebornGallery();
      this.updateGroundOffsetPreview();
    };

    app.pickMcreworkChar = function (charKey) {
      this.selectedMcreworkCharKey = charKey;
      document.getElementById('classAssetKeyInput').value = charKey;

      const item = this.mcreworkChars.find((c) => c.mcreworkCharKey === charKey);
      if (item) {
        const nameInput = document.getElementById('classNameInput');
        if (!nameInput.value.trim() && item.suggestedName) {
          nameInput.value = item.suggestedName;
        }
      }

      this.updateClassHeroCard(charKey);
      this.renderClassGallery();
    };

    app.pickMcreworkRebornChar = function (charKey) {
      this.selectedMcreworkRebornCharKey = charKey;
      document.getElementById('classRebornAssetKeyInput').value = charKey;

      this.updateClassRebornHeroCard(charKey);
      this.renderClassRebornGallery();
    };

    app.clearRebornVisual = function () {
      this.selectedMcreworkRebornCharKey = '';
      document.getElementById('classRebornAssetKeyInput').value = '';
      this.updateClassRebornHeroCard('');
      this.renderClassRebornGallery();
    };

    app.saveClassTemplate = async function () {
      try {
        const editId = document.getElementById('classEditIdInput').value.trim();
        const namePtBr = document.getElementById('classNameInput').value.trim();
        const raceCode = document.getElementById('classRaceSelect').value || 'HUMAN';
        const mcreworkCharKey = document.getElementById('classAssetKeyInput').value.trim();
        const rebornMcreworkCharKey = document.getElementById('classRebornAssetKeyInput').value.trim() || null;
        const descriptionPtBr = document.getElementById('classDescriptionInput').value.trim();
        const groundOffsetY = Number(document.getElementById('classGroundOffsetYInput').value) || 0;
        const rebornGroundOffsetY = Number(document.getElementById('classRebornGroundOffsetYInput').value) || 0;

        if (!mcreworkCharKey) {
          alert('Toque em um modelo de Personagem da galeria abaixo para selecioná-lo.');
          return;
        }

        const dto = {
          namePtBr,
          raceCode,
          mcreworkCharKey,
          rebornMcreworkCharKey,
          descriptionPtBr,
          groundOffsetY,
          rebornGroundOffsetY,
          baseAttributesJson: {
            VIT: Number(document.getElementById('classBaseVIT').value) || 10,
            STR: Number(document.getElementById('classBaseSTR').value) || 10,
            INT: Number(document.getElementById('classBaseINT').value) || 10,
            WIS: Number(document.getElementById('classBaseWIS').value) || 10,
            AGI: Number(document.getElementById('classBaseAGI').value) || 10,
            DEX: Number(document.getElementById('classBaseDEX').value) || 10,
          },
          growthPerLevelJson: {
            VIT: Number(document.getElementById('classGrowVIT').value) || 0,
            STR: Number(document.getElementById('classGrowSTR').value) || 0,
            INT: Number(document.getElementById('classGrowINT').value) || 0,
            WIS: Number(document.getElementById('classGrowWIS').value) || 0,
            AGI: Number(document.getElementById('classGrowAGI').value) || 0,
            DEX: Number(document.getElementById('classGrowDEX').value) || 0,
          },
        };

        const path = editId ? `/api/admin/class-templates/${editId}` : '/api/admin/class-templates';
        const method = editId ? 'PUT' : 'POST';

        await this.api(path, {
          method,
          body: JSON.stringify(dto),
        });

        this.closeModal('classModal');
        await this.loadBootstrapData();
        this.renderClassesCrudTable();
      } catch (err) {
        alert(`Erro ao salvar Personagem / Classe: ${err.message}`);
      }
    };

    app.renderClassesCrudTable = function () {
      const tbody = document.getElementById('classesTableBody');
      if (!tbody) return;

      if (this.classTemplates.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="color:var(--text-muted); padding:14px;">Nenhum Personagem / Classe cadastrado ainda. Clique em <strong>"➕ Novo Personagem do mcrework"</strong> acima para criar o primeiro modelo jogável!</td></tr>`;
        return;
      }

      tbody.innerHTML = this.classTemplates
        .map((ct) => {
          const b = ct.baseAttributesJson || {};
          const g = ct.growthPerLevelJson || {};
          const baseStr = `VIT:${b.VIT ?? 10} | STR:${b.STR ?? 10} | INT:${b.INT ?? 10} | WIS:${b.WIS ?? 10} | AGI:${b.AGI ?? 10} | DEX:${b.DEX ?? 10}`;
          const growStr = `+${g.VIT ?? 2} / +${g.STR ?? 2} / +${g.INT ?? 2} / +${g.WIS ?? 2} / +${g.AGI ?? 2} / +${g.DEX ?? 2}`;
          const gOffYStr = ct.groundOffsetY !== 0 ? ` [↧ ${ct.groundOffsetY > 0 ? '+' : ''}${ct.groundOffsetY}px]` : '';

          const rebornHtml = ct.rebornThumbUrl
            ? `<div style="display:flex; align-items:center; gap:6px; margin-top:4px;">
                 <img src="${ct.rebornThumbUrl}" alt="${ct.rebornMcreworkCharKey}" style="width:28px; height:28px; object-fit:contain; background:#1e1b4b; border-radius:4px; border:1px solid #c084fc;" title="Visual Reborn" />
                 <span style="font-size:0.7rem; color:#e9d5ff;">✨ Reborn (${ct.rebornMcreworkCharKey}${ct.rebornGroundOffsetY ? ` ${ct.rebornGroundOffsetY > 0 ? '+' : ''}${ct.rebornGroundOffsetY}px` : ''})</span>
               </div>`
            : '';

          const descSnippet = ct.descriptionPtBr
            ? `<div style="font-size:0.72rem; color:var(--text-muted); margin-top:2px; max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${ct.descriptionPtBr.replace(/"/g, '&quot;')}">📜 ${ct.descriptionPtBr}</div>`
            : '';

          return `
        <tr>
          <td><strong>#${ct.id}</strong> &bull; <span style="color:var(--accent);">${ct.code}</span></td>
          <td>
            <div style="display:flex; flex-direction:column;">
              <div style="display:flex; align-items:center; gap:8px;">
                <img src="${ct.thumbUrl}" alt="${ct.mcreworkCharKey}" style="width:48px; height:48px; object-fit:contain; background:#020617; border-radius:6px; border:1px solid var(--border);" />
                <span style="font-size:0.75rem; color:var(--text-muted);">${ct.mcreworkCharKey}<span style="color:#fde047; font-weight:600;">${gOffYStr}</span></span>
              </div>
              ${rebornHtml}
            </div>
          </td>
          <td>
            <strong>${ct.namePtBr}</strong>
            ${descSnippet}
          </td>
          <td><span style="padding:2px 8px; border-radius:99px; background:rgba(56,189,248,0.14); color:var(--accent); font-size:0.75rem;">${ct.raceNamePtBr || ct.raceCode}</span></td>
          <td><span style="font-family:monospace; font-size:0.76rem;">${baseStr}</span></td>
          <td><span style="font-family:monospace; font-size:0.75rem; color:#86efac;">${growStr}</span></td>
          <td><strong>${ct.characterCount ?? 0}</strong> char(s)</td>
          <td>
            <div style="display:flex; gap:6px;">
              <button onclick="AdminApp.openClassTemplateModal(${ct.id})">✏️ Editar</button>
              <button class="btn-danger" onclick="AdminApp.deleteClassTemplate(${ct.id})">🗑️</button>
            </div>
          </td>
        </tr>`;
        })
        .join('');
    };

    app.deleteClassTemplate = async function (id) {
      if (!confirm('Deseja realmente excluir este Personagem / Classe da tabela?')) return;
      try {
        await this.api(`/api/admin/class-templates/${id}`, { method: 'DELETE' });
        await this.loadBootstrapData();
      } catch (err) {
        alert(`Erro ao excluir Classe: ${err.message}`);
      }
    };
  }
}

window.AdminClassesTab = AdminClassesTab;
