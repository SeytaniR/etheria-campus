/**
 * @file apps/server/public/admin/js/AdminClassesTab.js
 * @module @etheria/server
 * @description Submódulo da Aba Personagens / Classes (`class_templates`) da Rota `/admin`.
 *   Inclui Palco 2.5D interativo renderizando o Mapa #1 real (`/api/assets/map-image/1`) com o modelo
 *   animado (`McreworkSpriteSheet`), permitindo calibrar tanto a distância dos pés em relação ao chão
 *   (`groundOffsetY` / `rebornGroundOffsetY`) quanto a posição horizontal/vertical da sombra
 *   (`shadowOffsetX`, `shadowOffsetY` / `rebornShadowOffsetX`, `rebornShadowOffsetY`) em tempo real.
 */

class AdminClassesTab {
  static attach(app) {
    app.classModalActiveTab = 'visual';
    app.classRebornSearchQuery = '';
    app.classPreviewAction = 0; // 0 = Parado, 1 = Andando, 3 = Ataque
    app.classPreviewDirection = 0; // 0..7
    app.classPreviewPanX = 0;
    app.classPreviewPanY = 0;
    app.classPreviewMapImg = null;
    app.classPreviewMapSpawn = { x: 1000, y: 750 };
    app.classPreviewSpriteCache = new Map();
    app.classPreviewAnimFrameId = null;

    AdminClassesTab.injectModalDom();

    app.ensureClassPreviewMapLoaded = function () {
      const map1 = (this.mapsList || []).find((m) => Number(m.id) === 1) || (this.mapsList || [])[0];
      if (map1) {
        this.classPreviewMapSpawn = {
          x: Number(map1.spawnX) || 1000,
          y: Number(map1.spawnY) || 750,
        };
      }
      if (!this.classPreviewMapImg) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        const mapId = map1 ? map1.id : 1;
        img.src = `/api/assets/map-image/${mapId}`;
        this.classPreviewMapImg = img;
      }
    };

    app.getOrCreateClassPreviewSprite = function (charKey) {
      if (!charKey || typeof window.McreworkSpriteSheet !== 'function') return null;
      if (this.classPreviewSpriteCache.has(charKey)) {
        return this.classPreviewSpriteCache.get(charKey);
      }
      const found = (this.mcreworkChars || []).find((c) => c.mcreworkCharKey === charKey);
      const baseUrl = 'https://seytanir.github.io/mcrework';
      const jsonUrl = found?.atlasJsonUrl || `${baseUrl}/assets/characters/${charKey}/atlas.json`;
      const webpUrl = found?.atlasWebpUrl || `${baseUrl}/assets/characters/${charKey}/atlas.webp`;
      const thumbUrl = found?.thumbUrl || `${baseUrl}/assets/characters/${charKey}/thumb.webp`;
      const sprite = new window.McreworkSpriteSheet(jsonUrl, webpUrl, thumbUrl);
      sprite.load();
      this.classPreviewSpriteCache.set(charKey, sprite);
      return sprite;
    };

    app.setClassPreviewAction = function (actionId) {
      this.classPreviewAction = Number(actionId) || 0;
      const b0 = document.getElementById('btnClassAct0');
      const b1 = document.getElementById('btnClassAct1');
      const b3 = document.getElementById('btnClassAct3');
      if (b0) b0.className = this.classPreviewAction === 0 ? 'btn-primary' : '';
      if (b1) b1.className = this.classPreviewAction === 1 ? 'btn-primary' : '';
      if (b3) b3.className = this.classPreviewAction === 3 ? 'btn-primary' : '';
    };

    app.rotateClassPreviewDir = function () {
      this.classPreviewDirection = ((this.classPreviewDirection || 0) + 1) % 8;
    };

    app.resetClassPreviewPan = function () {
      this.classPreviewPanX = 0;
      this.classPreviewPanY = 0;
    };

    app.startClassMap1PreviewLoop = function () {
      if (this.classPreviewAnimFrameId) {
        cancelAnimationFrame(this.classPreviewAnimFrameId);
      }
      this.ensureClassPreviewMapLoaded();

      const setupDragOnCanvas = (canvasId) => {
        const cvs = document.getElementById(canvasId);
        if (!cvs || cvs._hasDragBound) return;
        cvs._hasDragBound = true;
        let dragging = false;
        let lastX = 0;
        let lastY = 0;
        cvs.addEventListener('pointerdown', (e) => {
          dragging = true;
          lastX = e.clientX;
          lastY = e.clientY;
          cvs.setPointerCapture(e.pointerId);
        });
        cvs.addEventListener('pointermove', (e) => {
          if (!dragging) return;
          this.classPreviewPanX += e.clientX - lastX;
          this.classPreviewPanY += e.clientY - lastY;
          lastX = e.clientX;
          lastY = e.clientY;
        });
        cvs.addEventListener('pointerup', () => {
          dragging = false;
        });
      };

      setupDragOnCanvas('classMap1PreviewCanvas');
      setupDragOnCanvas('classRebornMap1PreviewCanvas');

      const renderSingleCanvas = (canvasId, charKey, gOffsetY, sOffsetX, sOffsetY, isRebornCanvas) => {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        const footX = Math.round(w / 2);
        const footY = Math.round(h * 0.76);

        // 1. Desenha o recorte real do Mapa #1 ao redor do ponto de Spawn (permitindo arrastar o piso)
        const mapImg = this.classPreviewMapImg;
        if (mapImg && mapImg.complete && mapImg.naturalWidth > 0) {
          const worldCenterX = this.classPreviewMapSpawn.x - this.classPreviewPanX;
          const worldCenterY = this.classPreviewMapSpawn.y - this.classPreviewPanY;
          const sx = Math.max(0, Math.min(mapImg.naturalWidth - w, worldCenterX - footX));
          const sy = Math.max(0, Math.min(mapImg.naturalHeight - h, worldCenterY - footY));
          ctx.drawImage(mapImg, sx, sy, w, h, 0, 0, w, h);
        } else {
          const grad = ctx.createRadialGradient(footX, footY, 10, footX, footY, 180);
          grad.addColorStop(0, '#1e293b');
          grad.addColorStop(1, '#020617');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, w, h);
        }

        // 2. Mira de referência exata do piso (Nível 0 dos pés)
        ctx.save();
        ctx.strokeStyle = isRebornCanvas ? 'rgba(192, 132, 252, 0.75)' : 'rgba(253, 224, 71, 0.75)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(footX - 48, footY);
        ctx.lineTo(footX + 48, footY);
        ctx.moveTo(footX, footY - 18);
        ctx.lineTo(footX, footY + 18);
        ctx.stroke();
        ctx.restore();

        // 3. Modelo 2.5D animado do personagem + Sombra ajustável
        if (charKey) {
          const sprite = this.getOrCreateClassPreviewSprite(charKey);
          if (sprite) {
            sprite.draw(
              ctx,
              footX,
              footY,
              this.classPreviewAction || 0,
              this.classPreviewDirection || 0,
              performance.now(),
              null,
              gOffsetY,
              0.70,
              false,
              sOffsetX,
              sOffsetY
            );
          }
        } else {
          ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
          ctx.fillRect(footX - 95, footY - 50, 190, 28);
          ctx.fillStyle = '#e2e8f0';
          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('Selecione um modelo abaixo', footX, footY - 32);
        }

        // 4. Legenda superior do Mapa #1
        const map1 = (this.mapsList || []).find((m) => Number(m.id) === 1) || (this.mapsList || [])[0];
        const mapLabel = map1 ? `🗺️ Mapa #${map1.id}: ${map1.namePtBr}` : '🗺️ Mapa #1 (Preview Real)';
        ctx.fillStyle = 'rgba(2, 6, 23, 0.78)';
        ctx.fillRect(6, 6, 210, 20);
        ctx.fillStyle = '#86efac';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${mapLabel} (Arraste o chão)`, 11, 19);

        const dirLabels = ['⬇ Sul', '↙ SO', '⬅ Oeste', '↖ NO', '⬆ Norte', '↗ NE', '➡ Leste', '↘ SE'];
        const dirText = dirLabels[this.classPreviewDirection || 0] || '⬇ Sul';
        ctx.fillStyle = 'rgba(2, 6, 23, 0.78)';
        ctx.fillRect(w - 68, 6, 62, 20);
        ctx.fillStyle = '#fde047';
        ctx.textAlign = 'center';
        ctx.fillText(dirText, w - 37, 19);
      };

      const step = () => {
        const modal = document.getElementById('classModal');
        if (!modal || modal.style.display === 'none') {
          this.classPreviewAnimFrameId = null;
          return;
        }

        const gOff = Number(document.getElementById('classGroundOffsetYInput')?.value) || 0;
        const sOffX = Number(document.getElementById('classShadowOffsetXInput')?.value) || 0;
        const sOffY = Number(document.getElementById('classShadowOffsetYInput')?.value) || 0;

        const rgOff = Number(document.getElementById('classRebornGroundOffsetYInput')?.value) || 0;
        const rsOffX = Number(document.getElementById('classRebornShadowOffsetXInput')?.value) || 0;
        const rsOffY = Number(document.getElementById('classRebornShadowOffsetYInput')?.value) || 0;

        if (this.classModalActiveTab === 'visual') {
          renderSingleCanvas('classMap1PreviewCanvas', this.selectedMcreworkCharKey, gOff, sOffX, sOffY, false);
        } else if (this.classModalActiveTab === 'reborn') {
          renderSingleCanvas('classRebornMap1PreviewCanvas', this.selectedMcreworkRebornCharKey, rgOff, rsOffX, rsOffY, true);
        }

        this.classPreviewAnimFrameId = requestAnimationFrame(step);
      };

      this.classPreviewAnimFrameId = requestAnimationFrame(step);
    };

    app.switchClassModalTab = function (tab) {
      this.classModalActiveTab = tab;
      const isVisual = tab === 'visual';
      const isReborn = tab === 'reborn';
      const isDesc = tab === 'desc';
      const isStats = tab === 'stats';
      const isSkills = tab === 'skills';

      const tabVisualEl = document.getElementById('classTabVisual');
      const tabRebornEl = document.getElementById('classTabReborn');
      const tabDescEl = document.getElementById('classTabDesc');
      const tabStatsEl = document.getElementById('classTabStats');
      const tabSkillsEl = document.getElementById('classTabSkills');

      if (tabVisualEl) tabVisualEl.style.display = isVisual ? 'flex' : 'none';
      if (tabRebornEl) tabRebornEl.style.display = isReborn ? 'flex' : 'none';
      if (tabDescEl) tabDescEl.style.display = isDesc ? 'flex' : 'none';
      if (tabStatsEl) tabStatsEl.style.display = isStats ? 'flex' : 'none';
      if (tabSkillsEl) tabSkillsEl.style.display = isSkills ? 'flex' : 'none';

      const btnVisual = document.getElementById('btnClassTabVisual');
      const btnReborn = document.getElementById('btnClassTabReborn');
      const btnDesc = document.getElementById('btnClassTabDesc');
      const btnStats = document.getElementById('btnClassTabStats');
      const btnSkills = document.getElementById('btnClassTabSkills');

      if (btnVisual) btnVisual.className = isVisual ? 'btn-primary' : '';
      if (btnReborn) btnReborn.className = isReborn ? 'btn-primary' : '';
      if (btnDesc) btnDesc.className = isDesc ? 'btn-primary' : '';
      if (btnStats) btnStats.className = isStats ? 'btn-primary' : '';
      if (btnSkills) btnSkills.className = isSkills ? 'btn-primary' : '';

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
      val = Math.max(-80, Math.min(80, val));
      input.value = String(val);
      this.updateGroundOffsetPreview();
    };

    app.resetGroundOffset = function () {
      const input = document.getElementById('classGroundOffsetYInput');
      if (input) input.value = '0';
      this.updateGroundOffsetPreview();
    };

    app.adjustShadowOffset = function (axis, delta) {
      const id = axis === 'X' ? 'classShadowOffsetXInput' : 'classShadowOffsetYInput';
      const input = document.getElementById(id);
      if (!input) return;
      let val = (Number(input.value) || 0) + delta;
      val = Math.max(-80, Math.min(80, val));
      input.value = String(val);
      this.updateGroundOffsetPreview();
    };

    app.resetShadowOffset = function () {
      const xIn = document.getElementById('classShadowOffsetXInput');
      const yIn = document.getElementById('classShadowOffsetYInput');
      if (xIn) xIn.value = '0';
      if (yIn) yIn.value = '0';
      this.updateGroundOffsetPreview();
    };

    app.adjustRebornGroundOffset = function (delta) {
      const input = document.getElementById('classRebornGroundOffsetYInput');
      if (!input) return;
      let val = (Number(input.value) || 0) + delta;
      val = Math.max(-80, Math.min(80, val));
      input.value = String(val);
      this.updateGroundOffsetPreview();
    };

    app.resetRebornGroundOffset = function () {
      const input = document.getElementById('classRebornGroundOffsetYInput');
      if (input) input.value = '0';
      this.updateGroundOffsetPreview();
    };

    app.adjustRebornShadowOffset = function (axis, delta) {
      const id = axis === 'X' ? 'classRebornShadowOffsetXInput' : 'classRebornShadowOffsetYInput';
      const input = document.getElementById(id);
      if (!input) return;
      let val = (Number(input.value) || 0) + delta;
      val = Math.max(-80, Math.min(80, val));
      input.value = String(val);
      this.updateGroundOffsetPreview();
    };

    app.resetRebornShadowOffset = function () {
      const xIn = document.getElementById('classRebornShadowOffsetXInput');
      const yIn = document.getElementById('classRebornShadowOffsetYInput');
      if (xIn) xIn.value = '0';
      if (yIn) yIn.value = '0';
      this.updateGroundOffsetPreview();
    };

    app.updateGroundOffsetPreview = function () {
      const offsetInput = document.getElementById('classGroundOffsetYInput');
      const sXInput = document.getElementById('classShadowOffsetXInput');
      const sYInput = document.getElementById('classShadowOffsetYInput');
      const statusBadge = document.getElementById('classGroundStatusBadge');
      if (offsetInput && statusBadge) {
        const offsetY = Number(offsetInput.value) || 0;
        const sx = Number(sXInput?.value) || 0;
        const sy = Number(sYInput?.value) || 0;
        const shadowText = sx !== 0 || sy !== 0 ? ` | 🌑 Sombra (${sx > 0 ? '+' : ''}${sx}, ${sy > 0 ? '+' : ''}${sy})` : '';
        if (offsetY === 0) {
          statusBadge.textContent = `🟢 Pés no solo (0px)${shadowText}`;
          statusBadge.style.color = '#86efac';
        } else if (offsetY > 0) {
          statusBadge.textContent = `🔵 Abaixo +${offsetY}px no chão${shadowText}`;
          statusBadge.style.color = '#38bdf8';
        } else {
          statusBadge.textContent = `🟡 Elevado ${Math.abs(offsetY)}px acima do solo${shadowText}`;
          statusBadge.style.color = '#fde047';
        }
      }

      const rebornOffsetInput = document.getElementById('classRebornGroundOffsetYInput');
      const rsXInput = document.getElementById('classRebornShadowOffsetXInput');
      const rsYInput = document.getElementById('classRebornShadowOffsetYInput');
      const rebornStatusBadge = document.getElementById('classRebornGroundStatusBadge');
      if (rebornOffsetInput && rebornStatusBadge) {
        const rOffsetY = Number(rebornOffsetInput.value) || 0;
        const rsx = Number(rsXInput?.value) || 0;
        const rsy = Number(rsYInput?.value) || 0;
        const rShadowText = rsx !== 0 || rsy !== 0 ? ` | 🌑 Sombra (${rsx > 0 ? '+' : ''}${rsx}, ${rsy > 0 ? '+' : ''}${rsy})` : '';
        if (rOffsetY === 0) {
          rebornStatusBadge.textContent = `🟢 Pés no solo (0px)${rShadowText}`;
          rebornStatusBadge.style.color = '#86efac';
        } else if (rOffsetY > 0) {
          rebornStatusBadge.textContent = `🔵 Abaixo +${rOffsetY}px no chão${rShadowText}`;
          rebornStatusBadge.style.color = '#38bdf8';
        } else {
          rebornStatusBadge.textContent = `✨ Elevado ${Math.abs(rOffsetY)}px acima do solo${rShadowText}`;
          rebornStatusBadge.style.color = '#c084fc';
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
      const heroLabel = document.getElementById('classHeroLabel');
      const heroBadge = document.getElementById('classHeroBadge');

      if (found) {
        if (heroLabel) heroLabel.textContent = `${found.suggestedName} (${found.mcreworkCharKey})`;
        if (heroBadge) heroBadge.textContent = `${found.gender === 'FEMALE' ? '👩 Feminino' : '👨 Masculino'} • Tier ${found.tier}`;
        this.getOrCreateClassPreviewSprite(charKey);
      } else {
        if (heroLabel) heroLabel.textContent = 'Selecione um Modelo na Galeria';
        if (heroBadge) heroBadge.textContent = '';
      }
      this.updateGroundOffsetPreview();
    };

    app.updateClassRebornHeroCard = function (charKey) {
      const found = this.mcreworkChars.find((c) => c.mcreworkCharKey === charKey);
      const heroLabel = document.getElementById('classRebornHeroLabel');
      const heroBadge = document.getElementById('classRebornHeroBadge');

      if (found) {
        if (heroLabel) heroLabel.textContent = `${found.suggestedName} (${found.mcreworkCharKey})`;
        if (heroBadge) heroBadge.textContent = `Visual Reencarnado Ativo • ${found.gender === 'FEMALE' ? 'Feminino' : 'Masculino'} (Tier ${found.tier})`;
        this.getOrCreateClassPreviewSprite(charKey);
      } else {
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
      this.classPreviewAction = 0;
      this.classPreviewDirection = 0;
      this.classPreviewPanX = 0;
      this.classPreviewPanY = 0;
      this.setClassPreviewAction(0);

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
        document.getElementById('classShadowOffsetXInput').value = String(existingClass.shadowOffsetX || 0);
        document.getElementById('classShadowOffsetYInput').value = String(existingClass.shadowOffsetY || 0);

        document.getElementById('classRebornGroundOffsetYInput').value = String(existingClass.rebornGroundOffsetY || 0);
        document.getElementById('classRebornShadowOffsetXInput').value = String(existingClass.rebornShadowOffsetX || 0);
        document.getElementById('classRebornShadowOffsetYInput').value = String(existingClass.rebornShadowOffsetY || 0);

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
        document.getElementById('classShadowOffsetXInput').value = '0';
        document.getElementById('classShadowOffsetYInput').value = '0';

        document.getElementById('classRebornGroundOffsetYInput').value = '0';
        document.getElementById('classRebornShadowOffsetXInput').value = '0';
        document.getElementById('classRebornShadowOffsetYInput').value = '0';

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

      if ((!this.skillTemplates || this.skillTemplates.length === 0) && typeof this.loadSkillsAndBuffsData === 'function') {
        await this.loadSkillsAndBuffsData();
      }
      if (typeof this.renderEntitySkillsChecklist === 'function') {
        const currentSkillIds =
          existingClass && Array.isArray(existingClass.skillIdsJson) && existingClass.skillIdsJson.length > 0
            ? existingClass.skillIdsJson
            : [1, 2, 4];
        this.renderEntitySkillsChecklist('classSkillsChecklist', currentSkillIds);
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
      this.startClassMap1PreviewLoop();
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
        const shadowOffsetX = Number(document.getElementById('classShadowOffsetXInput').value) || 0;
        const shadowOffsetY = Number(document.getElementById('classShadowOffsetYInput').value) || 0;

        const rebornGroundOffsetY = Number(document.getElementById('classRebornGroundOffsetYInput').value) || 0;
        const rebornShadowOffsetX = Number(document.getElementById('classRebornShadowOffsetXInput').value) || 0;
        const rebornShadowOffsetY = Number(document.getElementById('classRebornShadowOffsetYInput').value) || 0;

        if (!mcreworkCharKey) {
          alert('Toque em um modelo de Personagem da galeria abaixo para selecioná-lo.');
          return;
        }

        const skillIdsJson =
          typeof this.getSelectedEntitySkillIds === 'function'
            ? this.getSelectedEntitySkillIds('classSkillsChecklist')
            : [1, 2, 4];

        const dto = {
          namePtBr,
          raceCode,
          mcreworkCharKey,
          rebornMcreworkCharKey,
          descriptionPtBr,
          groundOffsetY,
          shadowOffsetX,
          shadowOffsetY,
          rebornGroundOffsetY,
          rebornShadowOffsetX,
          rebornShadowOffsetY,
          skillIdsJson,
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
          const gOffYStr = ct.groundOffsetY ? ` [↧ ${ct.groundOffsetY > 0 ? '+' : ''}${ct.groundOffsetY}px]` : '';
          const sOffStr =
            ct.shadowOffsetX || ct.shadowOffsetY
              ? ` [🌑 ${ct.shadowOffsetX || 0},${ct.shadowOffsetY || 0}]`
              : '';

          const rebornHtml = ct.rebornThumbUrl
            ? `<div style="display:flex; align-items:center; gap:6px; margin-top:4px;">
                 <img src="${ct.rebornThumbUrl}" alt="${ct.rebornMcreworkCharKey}" style="width:28px; height:28px; object-fit:contain; background:#1e1b4b; border-radius:4px; border:1px solid #c084fc;" title="Visual Reborn" />
                 <span style="font-size:0.7rem; color:#e9d5ff;">✨ Reborn (${ct.rebornMcreworkCharKey}${ct.rebornGroundOffsetY ? ` ${ct.rebornGroundOffsetY > 0 ? '+' : ''}${ct.rebornGroundOffsetY}px` : ''})</span>
               </div>`
            : '';

          const descSnippet = ct.descriptionPtBr
            ? `<div style="font-size:0.72rem; color:var(--text-muted); margin-top:2px; max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${ct.descriptionPtBr.replace(/"/g, '&quot;')}">📜 ${ct.descriptionPtBr}</div>`
            : '';

          const classSkillIds = Array.isArray(ct.skillIdsJson) ? ct.skillIdsJson : [];
          const classSkillsBadges = classSkillIds
            .map((sid) => {
              const sk = (this.skillTemplates || []).find((s) => Number(s.id) === Number(sid));
              return sk
                ? `<span style="display:inline-flex; align-items:center; gap:3px; padding:1px 6px; border-radius:4px; background:rgba(56,189,248,0.15); border:1px solid #38bdf8; font-size:0.68rem; color:#7dd3fc;">⚡ ${sk.namePtBr}</span>`
                : `<span style="font-size:0.68rem; color:#94a3b8;">⚡ Skill #${sid}</span>`;
            })
            .join(' ');

          return `
        <tr>
          <td><strong>#${ct.id}</strong> &bull; <span style="color:var(--accent);">${ct.code}</span></td>
          <td>
            <div style="display:flex; flex-direction:column;">
              <div style="display:flex; align-items:center; gap:8px;">
                <img src="${ct.thumbUrl}" alt="${ct.mcreworkCharKey}" style="width:48px; height:48px; object-fit:contain; background:#020617; border-radius:6px; border:1px solid var(--border);" />
                <span style="font-size:0.75rem; color:var(--text-muted);">${ct.mcreworkCharKey}<span style="color:#fde047; font-weight:600;">${gOffYStr}${sOffStr}</span></span>
              </div>
              ${rebornHtml}
            </div>
          </td>
          <td>
            <strong>${ct.namePtBr}</strong>
            ${descSnippet}
            ${classSkillsBadges ? `<div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:4px;">${classSkillsBadges}</div>` : ''}
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

  static injectModalDom() {
    if (document.getElementById('classModal')) return;

    const modalDiv = document.createElement('div');
    modalDiv.id = 'classModal';
    modalDiv.className = 'modal-backdrop';
    modalDiv.style.display = 'none';
    modalDiv.innerHTML = `
    <div class="modal-box" style="max-width:860px; max-height:94dvh; display:flex; flex-direction:column; overflow-y:auto; -webkit-overflow-scrolling:touch; gap:8px;">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:6px;">
        <h3 id="classModalTitle" style="font-size:0.95rem;">🦸 Cadastrar / Editar Personagem</h3>
        <button class="btn-danger" onclick="AdminApp.closeModal('classModal')">✕ Fechar</button>
      </div>
      <input type="hidden" id="classEditIdInput" value="" />
      <input type="hidden" id="classCodeInput" value="" />
      <input type="hidden" id="classAssetKeyInput" value="" />
      <input type="hidden" id="classRebornAssetKeyInput" value="" />

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
        <input type="text" id="classNameInput" placeholder="Nome da Classe / Personagem" style="padding:6px 8px; font-size:0.84rem;" />
        <select id="classRaceSelect" style="padding:6px 8px; font-size:0.84rem;"></select>
      </div>

      <!-- 5 ABAS DO MODAL (Incluindo ⚡ Habilidades) -->
      <div style="display:flex; gap:4px; overflow-x:auto;">
        <button id="btnClassTabVisual" class="btn-primary" onclick="AdminApp.switchClassModalTab('visual')" style="flex:1; padding:6px 4px; font-size:0.75rem; white-space:nowrap;">
          🎨 Padrão (<span id="classCountBadge">46</span>)
        </button>
        <button id="btnClassTabReborn" onclick="AdminApp.switchClassModalTab('reborn')" style="flex:1; padding:6px 4px; font-size:0.75rem; white-space:nowrap;">
          ✨ Reborn
        </button>
        <button id="btnClassTabDesc" onclick="AdminApp.switchClassModalTab('desc')" style="flex:1; padding:6px 4px; font-size:0.75rem; white-space:nowrap;">
          📜 Lore / i18n
        </button>
        <button id="btnClassTabStats" onclick="AdminApp.switchClassModalTab('stats')" style="flex:1; padding:6px 4px; font-size:0.75rem; white-space:nowrap;">
          📊 Atributos
        </button>
        <button id="btnClassTabSkills" onclick="AdminApp.switchClassModalTab('skills')" style="flex:1; padding:6px 4px; font-size:0.75rem; white-space:nowrap;">
          ⚡ Habilidades
        </button>
      </div>

      <!-- ABA 1: VISUAL PADRÃO COM PALCO DO MAPA #1 REAL E CALIBRAÇÃO DE SOMBRA -->
      <div id="classTabVisual" style="display:flex; flex-direction:column; gap:8px;">
        <div id="classHeroCard" style="display:flex; flex-wrap:wrap; align-items:stretch; gap:10px; background:rgba(15,23,42,0.85); border:1.5px solid var(--accent); border-radius:10px; padding:8px 10px;">
          <div style="display:flex; flex-direction:column; gap:4px; align-items:center;">
            <canvas id="classMap1PreviewCanvas" width="320" height="170" style="width:320px; height:170px; max-width:100%; border-radius:8px; border:1px solid #38bdf8; cursor:grab; background:#020617;"></canvas>
            <div style="display:flex; gap:4px; flex-wrap:wrap; justify-content:center;">
              <button type="button" id="btnClassAct0" class="btn-primary" onclick="AdminApp.setClassPreviewAction(0)" style="padding:2px 7px; font-size:0.7rem;">🧍 Parado</button>
              <button type="button" id="btnClassAct1" onclick="AdminApp.setClassPreviewAction(1)" style="padding:2px 7px; font-size:0.7rem;">🏃 Andar</button>
              <button type="button" id="btnClassAct3" onclick="AdminApp.setClassPreviewAction(3)" style="padding:2px 7px; font-size:0.7rem;">🗡️ Golpe</button>
              <button type="button" onclick="AdminApp.rotateClassPreviewDir()" style="padding:2px 7px; font-size:0.7rem;">🔄 Girar</button>
              <button type="button" onclick="AdminApp.resetClassPreviewPan()" title="Centralizar no Spawn do Mapa #1" style="padding:2px 6px; font-size:0.7rem;">🎯 Spawn</button>
            </div>
          </div>

          <div style="flex:1; min-width:230px; display:flex; flex-direction:column; justify-content:space-between; gap:5px;">
            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
              <strong id="classHeroLabel" style="font-size:0.88rem; color:#fde047;">Selecione um Modelo</strong>
              <span id="classHeroBadge" style="font-size:0.7rem; padding:1px 6px; border-radius:99px; background:rgba(56,189,248,0.2); color:var(--accent); font-weight:700;"></span>
            </div>

            <!-- Calibragem de Distância do Modelo em relação ao Chão -->
            <div style="background:rgba(2,6,23,0.65); border:1px solid var(--border); border-radius:6px; padding:5px 7px;">
              <span style="font-size:0.7rem; color:#fde047; font-weight:700; display:block; margin-bottom:3px;">📏 Posição do Modelo ao Chão (Ground Offset Y):</span>
              <div style="display:flex; align-items:center; gap:3px; flex-wrap:wrap;">
                <button type="button" onclick="AdminApp.adjustGroundOffset(-5)" style="padding:2px 6px; font-size:0.72rem;">⬆ -5</button>
                <button type="button" onclick="AdminApp.adjustGroundOffset(-1)" style="padding:2px 6px; font-size:0.72rem;">⬆ -1</button>
                <input type="number" id="classGroundOffsetYInput" value="0" min="-80" max="80" oninput="AdminApp.updateGroundOffsetPreview()" style="width:52px; text-align:center; padding:2px; font-size:0.78rem;" />
                <button type="button" onclick="AdminApp.adjustGroundOffset(1)" style="padding:2px 6px; font-size:0.72rem;">+1 ⬇</button>
                <button type="button" onclick="AdminApp.adjustGroundOffset(5)" style="padding:2px 6px; font-size:0.72rem;">+5 ⬇</button>
                <button type="button" onclick="AdminApp.resetGroundOffset()" title="Zerar" style="padding:2px 5px; font-size:0.7rem;">↩0</button>
              </div>
            </div>

            <!-- Calibragem de Posição da Sombra (X e Y) -->
            <div style="background:rgba(2,6,23,0.65); border:1px solid var(--border); border-radius:6px; padding:5px 7px; display:flex; flex-direction:column; gap:4px;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:0.7rem; color:#38bdf8; font-weight:700;">🌑 Alinhamento da Sombra (X / Y):</span>
                <button type="button" onclick="AdminApp.resetShadowOffset()" style="padding:1px 6px; font-size:0.66rem;">↩ Zerar Sombra</button>
              </div>
              <div style="display:flex; align-items:center; gap:3px; flex-wrap:wrap;">
                <span style="font-size:0.68rem; color:var(--text-muted); width:40px;">Eixo X:</span>
                <button type="button" onclick="AdminApp.adjustShadowOffset('X', -5)" style="padding:2px 5px; font-size:0.7rem;">⬅-5</button>
                <button type="button" onclick="AdminApp.adjustShadowOffset('X', -1)" style="padding:2px 5px; font-size:0.7rem;">⬅-1</button>
                <input type="number" id="classShadowOffsetXInput" value="0" min="-80" max="80" oninput="AdminApp.updateGroundOffsetPreview()" style="width:46px; text-align:center; padding:2px; font-size:0.75rem;" />
                <button type="button" onclick="AdminApp.adjustShadowOffset('X', 1)" style="padding:2px 5px; font-size:0.7rem;">+1➡</button>
                <button type="button" onclick="AdminApp.adjustShadowOffset('X', 5)" style="padding:2px 5px; font-size:0.7rem;">+5➡</button>
              </div>
              <div style="display:flex; align-items:center; gap:3px; flex-wrap:wrap;">
                <span style="font-size:0.68rem; color:var(--text-muted); width:40px;">Eixo Y:</span>
                <button type="button" onclick="AdminApp.adjustShadowOffset('Y', -5)" style="padding:2px 5px; font-size:0.7rem;">⬆-5</button>
                <button type="button" onclick="AdminApp.adjustShadowOffset('Y', -1)" style="padding:2px 5px; font-size:0.7rem;">⬆-1</button>
                <input type="number" id="classShadowOffsetYInput" value="0" min="-80" max="80" oninput="AdminApp.updateGroundOffsetPreview()" style="width:46px; text-align:center; padding:2px; font-size:0.75rem;" />
                <button type="button" onclick="AdminApp.adjustShadowOffset('Y', 1)" style="padding:2px 5px; font-size:0.7rem;">+1⬇</button>
                <button type="button" onclick="AdminApp.adjustShadowOffset('Y', 5)" style="padding:2px 5px; font-size:0.7rem;">+5⬇</button>
              </div>
            </div>

            <span id="classGroundStatusBadge" style="font-size:0.7rem; color:#86efac; font-weight:600;">🟢 Pés no solo (0px)</span>
          </div>
        </div>

        <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
          <input type="text" id="classSearchInput" placeholder="🔍 Buscar modelo padrão..." oninput="AdminApp.filterClassGallery()" style="flex:1; min-width:140px; padding:6px 8px; font-size:0.8rem;" />
          <div style="display:flex; gap:3px;">
            <button id="btnClassFilterAll" class="active-tool" onclick="AdminApp.setClassGenderFilter('ALL')" style="padding:4px 6px; font-size:0.74rem;">Todos (46)</button>
            <button id="btnClassFilterMale" onclick="AdminApp.setClassGenderFilter('MALE')" style="padding:4px 6px; font-size:0.74rem;">👨 Masc</button>
            <button id="btnClassFilterFemale" onclick="AdminApp.setClassGenderFilter('FEMALE')" style="padding:4px 6px; font-size:0.74rem;">👩 Fem</button>
          </div>
        </div>
        <div id="mcreworkCharsGrid" class="gallery-grid" style="max-height:42vh; min-height:200px;"></div>
      </div>

      <!-- ABA 2: VISUAL REENCARNADO COM PALCO DO MAPA #1 REAL E CALIBRAÇÃO DE SOMBRA -->
      <div id="classTabReborn" style="display:none; flex-direction:column; gap:8px;">
        <div style="display:flex; flex-wrap:wrap; align-items:stretch; gap:10px; background:rgba(15,23,42,0.85); border:1.5px solid #c084fc; border-radius:10px; padding:8px 10px;">
          <div style="display:flex; flex-direction:column; gap:4px; align-items:center;">
            <canvas id="classRebornMap1PreviewCanvas" width="320" height="170" style="width:320px; height:170px; max-width:100%; border-radius:8px; border:1px solid #c084fc; cursor:grab; background:#020617;"></canvas>
            <div style="display:flex; gap:4px; flex-wrap:wrap; justify-content:center;">
              <button type="button" onclick="AdminApp.setClassPreviewAction(0)" style="padding:2px 7px; font-size:0.7rem;">🧍 Parado</button>
              <button type="button" onclick="AdminApp.setClassPreviewAction(1)" style="padding:2px 7px; font-size:0.7rem;">🏃 Andar</button>
              <button type="button" onclick="AdminApp.setClassPreviewAction(3)" style="padding:2px 7px; font-size:0.7rem;">🗡️ Golpe</button>
              <button type="button" onclick="AdminApp.rotateClassPreviewDir()" style="padding:2px 7px; font-size:0.7rem;">🔄 Girar</button>
              <button type="button" onclick="AdminApp.resetClassPreviewPan()" style="padding:2px 6px; font-size:0.7rem;">🎯 Spawn</button>
            </div>
          </div>

          <div style="flex:1; min-width:230px; display:flex; flex-direction:column; justify-content:space-between; gap:5px;">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:4px;">
              <strong id="classRebornHeroLabel" style="font-size:0.86rem; color:#e9d5ff;">Sem Visual Reborn</strong>
              <button type="button" class="btn-danger" onclick="AdminApp.clearRebornVisual()" style="padding:2px 6px; font-size:0.7rem;">✕ Limpar</button>
            </div>
            <div id="classRebornHeroBadge" style="font-size:0.68rem; color:var(--text-muted);">Toque em um modelo abaixo para vincular</div>

            <!-- Calibragem de Distância Reborn ao Chão -->
            <div style="background:rgba(2,6,23,0.65); border:1px solid var(--border); border-radius:6px; padding:5px 7px;">
              <span style="font-size:0.7rem; color:#e9d5ff; font-weight:700; display:block; margin-bottom:3px;">📏 Posição Reborn ao Chão (Offset Y):</span>
              <div style="display:flex; align-items:center; gap:3px; flex-wrap:wrap;">
                <button type="button" onclick="AdminApp.adjustRebornGroundOffset(-5)" style="padding:2px 6px; font-size:0.72rem;">⬆ -5</button>
                <button type="button" onclick="AdminApp.adjustRebornGroundOffset(-1)" style="padding:2px 6px; font-size:0.72rem;">⬆ -1</button>
                <input type="number" id="classRebornGroundOffsetYInput" value="0" min="-80" max="80" oninput="AdminApp.updateGroundOffsetPreview()" style="width:52px; text-align:center; padding:2px; font-size:0.78rem;" />
                <button type="button" onclick="AdminApp.adjustRebornGroundOffset(1)" style="padding:2px 6px; font-size:0.72rem;">+1 ⬇</button>
                <button type="button" onclick="AdminApp.adjustRebornGroundOffset(5)" style="padding:2px 6px; font-size:0.72rem;">+5 ⬇</button>
                <button type="button" onclick="AdminApp.resetRebornGroundOffset()" title="Zerar" style="padding:2px 5px; font-size:0.7rem;">↩0</button>
              </div>
            </div>

            <!-- Calibragem de Sombra Reborn (X e Y) -->
            <div style="background:rgba(2,6,23,0.65); border:1px solid var(--border); border-radius:6px; padding:5px 7px; display:flex; flex-direction:column; gap:4px;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:0.7rem; color:#c084fc; font-weight:700;">🌑 Sombra Reborn (X / Y):</span>
                <button type="button" onclick="AdminApp.resetRebornShadowOffset()" style="padding:1px 6px; font-size:0.66rem;">↩ Zerar Sombra</button>
              </div>
              <div style="display:flex; align-items:center; gap:3px; flex-wrap:wrap;">
                <span style="font-size:0.68rem; color:var(--text-muted); width:40px;">Eixo X:</span>
                <button type="button" onclick="AdminApp.adjustRebornShadowOffset('X', -5)" style="padding:2px 5px; font-size:0.7rem;">⬅-5</button>
                <button type="button" onclick="AdminApp.adjustRebornShadowOffset('X', -1)" style="padding:2px 5px; font-size:0.7rem;">⬅-1</button>
                <input type="number" id="classRebornShadowOffsetXInput" value="0" min="-80" max="80" oninput="AdminApp.updateGroundOffsetPreview()" style="width:46px; text-align:center; padding:2px; font-size:0.75rem;" />
                <button type="button" onclick="AdminApp.adjustRebornShadowOffset('X', 1)" style="padding:2px 5px; font-size:0.7rem;">+1➡</button>
                <button type="button" onclick="AdminApp.adjustRebornShadowOffset('X', 5)" style="padding:2px 5px; font-size:0.7rem;">+5➡</button>
              </div>
              <div style="display:flex; align-items:center; gap:3px; flex-wrap:wrap;">
                <span style="font-size:0.68rem; color:var(--text-muted); width:40px;">Eixo Y:</span>
                <button type="button" onclick="AdminApp.adjustRebornShadowOffset('Y', -5)" style="padding:2px 5px; font-size:0.7rem;">⬆-5</button>
                <button type="button" onclick="AdminApp.adjustRebornShadowOffset('Y', -1)" style="padding:2px 5px; font-size:0.7rem;">⬆-1</button>
                <input type="number" id="classRebornShadowOffsetYInput" value="0" min="-80" max="80" oninput="AdminApp.updateGroundOffsetPreview()" style="width:46px; text-align:center; padding:2px; font-size:0.75rem;" />
                <button type="button" onclick="AdminApp.adjustRebornShadowOffset('Y', 1)" style="padding:2px 5px; font-size:0.7rem;">+1⬇</button>
                <button type="button" onclick="AdminApp.adjustRebornShadowOffset('Y', 5)" style="padding:2px 5px; font-size:0.7rem;">+5⬇</button>
              </div>
            </div>

            <span id="classRebornGroundStatusBadge" style="font-size:0.7rem; color:#c084fc; font-weight:600;">🟢 Pés no solo (0px)</span>
          </div>
        </div>
        <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
          <input type="text" id="classRebornSearchInput" placeholder="🔍 Buscar modelo para reencarnação..." oninput="AdminApp.filterClassRebornGallery()" style="flex:1; min-width:180px; padding:6px 10px; font-size:0.82rem;" />
        </div>
        <div id="mcreworkCharsRebornGrid" class="gallery-grid" style="max-height:42vh; min-height:200px;"></div>
      </div>

      <!-- ABA 3: DESCRIÇÃO & LORE -->
      <div id="classTabDesc" style="display:none; flex-direction:column; gap:8px;">
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.76rem;">
          <label style="color:var(--text-muted); font-weight:600;">📜 Descrição do Personagem (PT-BR):</label>
          <span id="classDescI18nDisplay" style="color:var(--accent); font-family:monospace; font-size:0.72rem;">class.class_X.description</span>
        </div>
        <textarea id="classDescriptionInput" rows="5" placeholder="Digite uma descrição ou história sobre a classe/personagem..." style="width:100%; padding:8px; font-size:0.84rem; resize:vertical;"></textarea>
      </div>

      <!-- ABA 4: CONFIGURAÇÃO DE ATRIBUTOS -->
      <div id="classTabStats" style="display:none; flex-direction:column; gap:10px; padding:4px;">
        <div class="field">
          <label>Atributos Base Iniciais Nv.1 (VIT / STR / INT / WIS / AGI / DEX)</label>
          <div style="display:grid; grid-template-columns:repeat(6, 1fr); gap:6px;">
            <div><label style="font-size:0.7rem; color:var(--text-muted);">VIT</label><input type="number" id="classBaseVIT" value="12" min="1" /></div>
            <div><label style="font-size:0.7rem; color:var(--text-muted);">STR</label><input type="number" id="classBaseSTR" value="12" min="1" /></div>
            <div><label style="font-size:0.7rem; color:var(--text-muted);">INT</label><input type="number" id="classBaseINT" value="10" min="1" /></div>
            <div><label style="font-size:0.7rem; color:var(--text-muted);">WIS</label><input type="number" id="classBaseWIS" value="10" min="1" /></div>
            <div><label style="font-size:0.7rem; color:var(--text-muted);">AGI</label><input type="number" id="classBaseAGI" value="10" min="1" /></div>
            <div><label style="font-size:0.7rem; color:var(--text-muted);">DEX</label><input type="number" id="classBaseDEX" value="10" min="1" /></div>
          </div>
        </div>
        <div class="field">
          <label>Crescimento Automático Concedido a Cada Nível Ganho</label>
          <div style="display:grid; grid-template-columns:repeat(6, 1fr); gap:6px;">
            <div><label style="font-size:0.7rem; color:#86efac;">+VIT/Nv</label><input type="number" id="classGrowVIT" value="2" min="0" /></div>
            <div><label style="font-size:0.7rem; color:#86efac;">+STR/Nv</label><input type="number" id="classGrowSTR" value="2" min="0" /></div>
            <div><label style="font-size:0.7rem; color:#86efac;">+INT/Nv</label><input type="number" id="classGrowINT" value="2" min="0" /></div>
            <div><label style="font-size:0.7rem; color:#86efac;">+WIS/Nv</label><input type="number" id="classGrowWIS" value="2" min="0" /></div>
            <div><label style="font-size:0.7rem; color:#86efac;">+AGI/Nv</label><input type="number" id="classGrowAGI" value="2" min="0" /></div>
            <div><label style="font-size:0.7rem; color:#86efac;">+DEX/Nv</label><input type="number" id="classGrowDEX" value="2" min="0" /></div>
          </div>
        </div>
      </div>

      <!-- ABA 5: HABILIDADES DESTE PERSONAGEM (VÍNCULO DA TABELA DE HABILIDADES) -->
      <div id="classTabSkills" style="display:none; flex-direction:column; gap:10px; padding:4px;">
        <div style="font-size:0.78rem; color:#fde047; font-weight:700;">
          ⚡ Selecione quais Habilidades da Tabela de Habilidades este Personagem possui:
        </div>
        <div id="classSkillsChecklist" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(210px, 1fr)); gap:6px; max-height:280px; overflow-y:auto; padding:8px; background:#020617; border:1px solid var(--border); border-radius:8px;"></div>
      </div>

      <div style="border-top:1px solid var(--border); padding-top:8px;">
        <button class="btn-success" style="width:100%; padding:11px; font-weight:700;" onclick="AdminApp.saveClassTemplate()">
          💾 Salvar Personagem / Classe na Tabela
        </button>
      </div>
    </div>`;

    document.body.appendChild(modalDiv);
  }
}

window.AdminClassesTab = AdminClassesTab;
