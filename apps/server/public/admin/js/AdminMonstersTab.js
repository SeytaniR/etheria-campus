/**
 * @file apps/server/public/admin/js/AdminMonstersTab.js
 * @module @etheria/server
 * @description Submódulo da Aba Monstros / Mobs (`monster_templates`) da Rota `/admin`.
 *   Exibe todos os campos de edição diretamente visíveis no modal (Nome, Raça, Elemento, Raridade,
 *   Pet Domável, Status Ativo, Descrição PT-BR com i18n automático, Biomas de Spawn, Atributos Base,
 *   Palco 2.5D Animado em Canvas com teste de animações de batalha e Galeria dos 532 monstros do mcrework).
 */

class AdminMonstersTab {
  static attach(app) {
    app.monsterTemplates = [];
    app.mcreworkMonsters = [];
    app.selectedMcreworkMonsterKey = '';
    app.monsterSearchQuery = '';
    app.monsterCategoryFilter = 'all';
    app.monsterPreviewSheet = null;
    app.monsterPreviewAction = 0;
    app.monsterPreviewDir = 0;
    app.monsterPreviewAnimFrame = null;

    // Carrega McreworkSpriteSheet dinamicamente no /admin caso ainda não esteja presente
    if (!window.McreworkSpriteSheet) {
      const script = document.createElement('script');
      script.src = '/play/js/McreworkSpriteSheet.js';
      document.head.appendChild(script);
    }

    AdminMonstersTab.injectModalDom();

    app.loadMonsterTemplates = async function () {
      try {
        this.monsterTemplates = await this.api('/api/admin/monster-templates');
        this.renderMonstersCrudTable();
      } catch (err) {
        console.error('Falha ao carregar templates de monstros:', err);
      }
    };

    app.filterMonsterGallery = function () {
      const input = document.getElementById('monsterSearchInput');
      this.monsterSearchQuery = (input ? input.value : '').toLowerCase().trim();
      const catSel = document.getElementById('monsterCategoryFilterSelect');
      this.monsterCategoryFilter = catSel ? catSel.value : 'all';
      this.renderMonsterGallery();
    };

    app.filterMonsterBiomesChecklist = function () {
      const q = (document.getElementById('monsterBiomeFilterInput')?.value || '').toLowerCase().trim();
      document.querySelectorAll('.monster-biome-item').forEach((el) => {
        const text = (el.getAttribute('data-biome-name') || '').toLowerCase();
        el.style.display = !q || text.includes(q) ? 'flex' : 'none';
      });
    };

    app.toggleAllMonsterBiomes = function (checked) {
      document.querySelectorAll('input[name="monsterBiome"]').forEach((chk) => {
        if (chk.closest('.monster-biome-item')?.style.display !== 'none') {
          chk.checked = checked;
        }
      });
      this.updateMonsterBiomesCounter();
    };

    app.updateMonsterBiomesCounter = function () {
      const count = document.querySelectorAll('input[name="monsterBiome"]:checked').length;
      const badge = document.getElementById('monsterBiomesSelectedCount');
      if (badge) {
        badge.textContent = count === 0 ? '0 marcados (Todos os Biomas por padrão)' : `${count} bioma(s) selecionado(s)`;
      }
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

    app.setMonsterPreviewAction = function (action) {
      this.monsterPreviewAction = Number(action) || 0;
      document.querySelectorAll('.monster-anim-btn').forEach((btn) => {
        const isAct = Number(btn.getAttribute('data-action')) === this.monsterPreviewAction;
        btn.className = isAct ? 'monster-anim-btn btn-primary' : 'monster-anim-btn';
      });
    };

    app.rotateMonsterPreviewDir = function () {
      this.monsterPreviewDir = (this.monsterPreviewDir + 1) % 8;
      const dirBadge = document.getElementById('monsterPreviewDirBadge');
      if (dirBadge) dirBadge.textContent = `Dir: ${this.monsterPreviewDir}`;
    };

    app.updateMonsterGroundOffsetPreview = function () {
      const heroImg = document.getElementById('monsterHeroImg');
      const offsetInput = document.getElementById('monsterGroundOffsetYInput');
      const statusBadge = document.getElementById('monsterGroundStatusBadge');
      if (offsetInput) {
        const offsetY = Number(offsetInput.value) || 0;
        if (heroImg) {
          heroImg.style.transform = `translateY(${offsetY}px)`;
        }
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

    app.startMonsterPreviewLoop = function () {
      if (this.monsterPreviewAnimFrame) {
        cancelAnimationFrame(this.monsterPreviewAnimFrame);
      }
      const startTime = performance.now();
      const renderStep = (now) => {
        const modal = document.getElementById('monsterModal');
        if (!modal || modal.style.display === 'none') {
          this.monsterPreviewAnimFrame = null;
          return;
        }
        const canvas = document.getElementById('monsterPreviewCanvas');
        if (canvas && this.monsterPreviewSheet) {
          const ctx = canvas.getContext('2d');
          const w = canvas.width;
          const h = canvas.height;
          ctx.clearRect(0, 0, w, h);

          // Desenha piso isométrico 2.5D e linha de referência do solo
          const groundY = h - 26;
          ctx.fillStyle = '#14532d';
          ctx.fillRect(0, groundY, w, h - groundY);
          ctx.strokeStyle = '#86efac';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(0, groundY);
          ctx.lineTo(w, groundY);
          ctx.stroke();

          const offsetY = Number(document.getElementById('monsterGroundOffsetYInput')?.value) || 0;
          const elapsed = now - startTime;
          this.monsterPreviewSheet.draw(
            ctx,
            Math.round(w / 2),
            groundY + 4,
            this.monsterPreviewAction,
            this.monsterPreviewDir,
            elapsed,
            1.0,
            offsetY,
            0.85,
            false
          );
        }
        this.monsterPreviewAnimFrame = requestAnimationFrame(renderStep);
      };
      this.monsterPreviewAnimFrame = requestAnimationFrame(renderStep);
    };

    app.renderMonsterGallery = function () {
      const grid = document.getElementById('mcreworkMonstersGrid');
      if (!grid) return;

      const filtered = this.mcreworkMonsters.filter((m) => {
        if (this.monsterCategoryFilter === 'pet' && !m.isPet) return false;
        if (this.monsterCategoryFilter === 'mob' && m.isPet) return false;
        if (!this.monsterSearchQuery) return true;
        const text = `${m.mcreworkMonsterKey} ${m.suggestedName}`.toLowerCase();
        return text.includes(this.monsterSearchQuery);
      });

      const countBadge = document.getElementById('monsterCountBadge');
      if (countBadge) countBadge.textContent = String(filtered.length);

      if (filtered.length === 0) {
        grid.innerHTML = `<div style="grid-column:1/-1; color:var(--text-muted); padding:20px; text-align:center;">Nenhum monstro encontrado para este filtro.</div>`;
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
      const heroLabel = document.getElementById('monsterHeroLabel');
      const heroBadge = document.getElementById('monsterHeroBadge');

      if (found) {
        if (heroLabel) heroLabel.textContent = `${found.suggestedName} (${found.mcreworkMonsterKey})`;
        if (heroBadge) heroBadge.textContent = `${found.isPet ? '🐾 Domável como Pet' : '👾 Monstro Selvagem'}`;

        if (window.McreworkSpriteSheet) {
          const atlasJson = found.atlasJsonUrl || `https://seytanir.github.io/mcrework/assets/monsters/${found.mcreworkMonsterKey}/atlas.json`;
          const atlasWebp = found.atlasWebpUrl || `https://seytanir.github.io/mcrework/assets/monsters/${found.mcreworkMonsterKey}/atlas.webp`;
          this.monsterPreviewSheet = new window.McreworkSpriteSheet(atlasJson, atlasWebp, found.thumbUrl);
          this.monsterPreviewSheet.load();
          this.startMonsterPreviewLoop();
        }
      } else {
        if (heroLabel) heroLabel.textContent = 'Selecione um Monstro na Galeria';
        if (heroBadge) heroBadge.textContent = '';
        this.monsterPreviewSheet = null;
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

    app.populateMonsterDropdownsAndBiomes = function () {
      const fallbackRaces = [
        { code: 'BEAST', namePtBr: 'Besta / Fera' },
        { code: 'PLANT', namePtBr: 'Planta / Flora' },
        { code: 'AQUATIC', namePtBr: 'Aquático / Anfíbio' },
        { code: 'INSECT', namePtBr: 'Inseto / Aracnídeo' },
        { code: 'DRAGON', namePtBr: 'Dragão / Dracônico' },
        { code: 'UNDEAD', namePtBr: 'Morto-Vivo / Espectro' },
        { code: 'DEMON', namePtBr: 'Demônio / Abissal' },
        { code: 'ELEMENTAL', namePtBr: 'Elemental Puro' },
        { code: 'GOLEM', namePtBr: 'Golem / Constructo' },
        { code: 'HUMANOID', namePtBr: 'Humanoide / Guerreiro' },
        { code: 'CELESTIAL', namePtBr: 'Celestial / Místico' },
      ];
      const racesList = Array.isArray(this.races) && this.races.length > 0 ? this.races : fallbackRaces;
      const raceSelect = document.getElementById('monsterRaceSelect');
      if (raceSelect) {
        raceSelect.innerHTML = racesList
          .map((r) => `<option value="${r.code}">${r.namePtBr || r.code} (${r.code})</option>`)
          .join('');
      }

      const fallbackElements = [
        { code: 'NEUTRAL', namePtBr: '⚪ Neutro' },
        { code: 'FIRE', namePtBr: '🔥 Fogo' },
        { code: 'WATER', namePtBr: '💧 Água' },
        { code: 'EARTH', namePtBr: '🪨 Terra' },
        { code: 'AIR', namePtBr: '🌪️ Ar / Vento' },
      ];
      const elemsList = Array.isArray(this.elements) && this.elements.length > 0 ? this.elements : fallbackElements;
      const elemSelect = document.getElementById('monsterElementSelect');
      if (elemSelect) {
        elemSelect.innerHTML = elemsList
          .map((e) => `<option value="${e.code}">${e.namePtBr || e.code} (${e.code})</option>`)
          .join('');
      }

      const rarityTiers = [
        { code: 'SS', label: '👑 Rank SS (Mítico)' },
        { code: 'S', label: '🌟 Rank S (Lendário)' },
        { code: 'A', label: '💎 Rank A (Épico)' },
        { code: 'B', label: '🔷 Rank B (Superior)' },
        { code: 'C', label: '🟢 Rank C (Intermediário)' },
        { code: 'D', label: '🟡 Rank D (Básico)' },
        { code: 'F', label: '⚪ Rank F (Iniciante)' },
      ];
      const raritySelect = document.getElementById('monsterRaritySelect');
      if (raritySelect) {
        raritySelect.innerHTML = rarityTiers
          .map((rt) => `<option value="${rt.code}">${rt.label}</option>`)
          .join('');
      }

      const biomesBox = document.getElementById('monsterBiomesChecklist');
      if (biomesBox) {
        const biomesList = Array.isArray(this.biomes) ? this.biomes : [];
        if (biomesList.length === 0) {
          biomesBox.innerHTML = `<div style="color:var(--text-muted); font-size:0.75rem; padding:6px;">Carregando biomas do banco...</div>`;
        } else {
          biomesBox.innerHTML = biomesList
            .map((b) => {
              const label = `#${b.id} ${b.namePtBr || b.code}`;
              return `
              <label class="monster-biome-item" data-biome-name="${label.replace(/"/g, '&quot;')}" style="display:flex; align-items:center; gap:6px; font-size:0.75rem; background:rgba(15,23,42,0.75); padding:5px 8px; border-radius:6px; border:1px solid var(--border); cursor:pointer;">
                <input type="checkbox" name="monsterBiome" value="${b.id}" onchange="AdminApp.updateMonsterBiomesCounter()" />
                <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${label}</span>
              </label>`;
            })
            .join('');
        }
      }
    };

    app.openMonsterTemplateModal = async function (editMonsterId = null) {
      document.getElementById('monsterModal').style.display = 'flex';
      this.monsterSearchQuery = '';
      this.monsterCategoryFilter = 'all';
      this.monsterPreviewAction = 0;
      this.monsterPreviewDir = 0;

      const searchInput = document.getElementById('monsterSearchInput');
      if (searchInput) searchInput.value = '';
      const catSel = document.getElementById('monsterCategoryFilterSelect');
      if (catSel) catSel.value = 'all';
      const biomeFilter = document.getElementById('monsterBiomeFilterInput');
      if (biomeFilter) biomeFilter.value = '';

      this.populateMonsterDropdownsAndBiomes();
      this.setMonsterPreviewAction(0);

      const existingMonster = editMonsterId
        ? this.monsterTemplates.find((m) => m.id === Number(editMonsterId))
        : null;

      if (existingMonster) {
        document.getElementById('monsterModalTitle').textContent = `✏️ Editar Monstro #${existingMonster.id} (${existingMonster.code})`;
        document.getElementById('monsterEditIdInput').value = String(existingMonster.id);
        document.getElementById('monsterCodeInput').value = `#${existingMonster.id} • ${existingMonster.code}`;
        document.getElementById('monsterNameInput').value = existingMonster.namePtBr || '';
        document.getElementById('monsterRaceSelect').value = existingMonster.raceCode || 'BEAST';
        document.getElementById('monsterElementSelect').value = existingMonster.fixedElementCode || 'NEUTRAL';
        document.getElementById('monsterRaritySelect').value = existingMonster.rarityTier || 'F';
        document.getElementById('monsterTamableSelect').value = existingMonster.isTamableAsPet !== false ? 'true' : 'false';
        document.getElementById('monsterActiveSelect').value = existingMonster.isActive !== false ? 'true' : 'false';
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

        const linkedBiomeIds = new Set((existingMonster.biomesList || []).map((b) => Number(b.biomeId)));
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
        document.getElementById('monsterRaritySelect').value = 'F';
        document.getElementById('monsterTamableSelect').value = 'true';
        document.getElementById('monsterActiveSelect').value = 'true';
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

      this.updateMonsterBiomesCounter();

      const grid = document.getElementById('mcreworkMonstersGrid');
      if (this.mcreworkMonsters.length === 0) {
        grid.innerHTML = '<div style="padding:12px;">Carregando catálogo de monstros do mcrework...</div>';
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
        const rarityTier = document.getElementById('monsterRaritySelect').value || 'F';
        const isTamableAsPet = document.getElementById('monsterTamableSelect').value === 'true';
        const isActive = document.getElementById('monsterActiveSelect').value === 'true';
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
          rarityTier,
          isTamableAsPet,
          isActive,
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
              ? m.biomesList.map((bi) => `#${bi.biomeId} ${bi.namePtBr || bi.code}`).join(', ')
              : '🌍 Todos os Biomas';

          const tier = m.rarityTier || 'F';
          const tierColors = {
            SS: { bg: 'rgba(244,63,94,0.22)', text: '#fda4af', border: '#f43f5e' },
            S: { bg: 'rgba(234,179,8,0.22)', text: '#fde047', border: '#eab308' },
            A: { bg: 'rgba(192,132,252,0.22)', text: '#d8b4fe', border: '#a855f7' },
            B: { bg: 'rgba(56,189,248,0.22)', text: '#7dd3fc', border: '#0ea5e9' },
            C: { bg: 'rgba(34,197,94,0.22)', text: '#86efac', border: '#22c55e' },
            D: { bg: 'rgba(251,146,60,0.20)', text: '#fdba74', border: '#f97316' },
            F: { bg: 'rgba(148,163,184,0.18)', text: '#cbd5e1', border: '#64748b' },
          };
          const tc = tierColors[tier] || tierColors.F;

          return `
        <tr>
          <td>
            <strong>#${m.id}</strong> &bull; <span style="color:#f43f5e; font-weight:700;">${m.code}</span>
            <div style="font-size:0.68rem; color:${m.isActive !== false ? '#86efac' : '#94a3b8'};">${m.isActive !== false ? '● Ativo' : '○ Inativo'}</div>
          </td>
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
            <div style="font-size:0.72rem; color:${m.descriptionPtBr ? 'var(--text-muted)' : '#64748b'}; max-width:260px; white-space:normal; line-height:1.3; margin-top:2px;">
              📜 ${m.descriptionPtBr || '<em>Sem descrição (clique em Editar)</em>'}
            </div>
          </td>
          <td>
            <div style="display:flex; flex-direction:column; gap:4px; align-items:flex-start;">
              <span style="padding:2px 8px; border-radius:99px; background:rgba(244,63,94,0.16); color:#fb7185; font-size:0.74rem; font-weight:700;">🧬 ${m.raceNamePtBr || m.raceCode}</span>
              <span style="padding:2px 8px; border-radius:99px; background:rgba(56,189,248,0.16); color:var(--accent); font-size:0.74rem; font-weight:700;">🔥 ${m.elementNamePtBr || m.fixedElementCode}</span>
            </div>
          </td>
          <td>
            <span style="padding:3px 10px; border-radius:99px; background:${tc.bg}; color:${tc.text}; border:1px solid ${tc.border}; font-size:0.78rem; font-weight:800;">Rank ${tier}</span>
          </td>
          <td><span style="font-family:monospace; font-size:0.75rem;">${statsStr}</span></td>
          <td><div style="font-size:0.72rem; color:var(--text-muted); max-width:200px; white-space:normal;">${biomesStr}</div></td>
          <td>
            <div style="display:flex; gap:6px;">
              <button class="btn-primary" onclick="AdminApp.openMonsterTemplateModal(${m.id})">✏️ Editar</button>
              <button class="btn-danger" onclick="AdminApp.deleteMonsterTemplate(${m.id})">🗑️</button>
            </div>
          </td>
        </tr>`;
        })
        .join('');
    };
  }

  /**
   * Injeta dinamicamente o modal completo de criação/edição de monstros.
   * TODOS os campos (Nome, Raça, Elemento, Raridade, Pet, Descrição PT-BR, Biomas,
   * Atributos Base, Palco 2.5D Animado e Galeria do mcrework) ficam visíveis diretamente
   * na tela com rolagem fluida, sem abas escondidas que pudessem ocultar campos.
   */
  static injectModalDom() {
    if (document.getElementById('monsterModal')) return;

    const modalDiv = document.createElement('div');
    modalDiv.id = 'monsterModal';
    modalDiv.className = 'modal-backdrop';
    modalDiv.style.display = 'none';

    modalDiv.innerHTML = `
    <div class="modal-box" style="max-width:920px; width:96%; max-height:92vh; display:block; overflow-y:auto; -webkit-overflow-scrolling:touch; padding:16px;">
      <!-- Cabeçalho Fixo -->
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:10px; margin-bottom:12px;">
        <h3 id="monsterModalTitle" style="color:#f43f5e; margin:0; font-size:1.05rem;">🐉 Editar / Criar Monstro</h3>
        <div style="display:flex; gap:8px;">
          <button class="btn-success" onclick="AdminApp.saveMonsterTemplate()" style="padding:6px 14px; font-weight:700;">💾 Salvar</button>
          <button class="btn-danger" onclick="AdminApp.closeModal('monsterModal')" style="padding:6px 10px;">✕</button>
        </div>
      </div>

      <input type="hidden" id="monsterEditIdInput" value="" />
      <input type="hidden" id="monsterAssetKeyInput" value="" />

      <!-- BLOCO 1: IDENTIDADE, RAÇA, ELEMENTO, RARIDADE & PET (SEMPRE VISÍVEL) -->
      <div style="background:rgba(15,23,42,0.75); border:1px solid #334155; border-radius:10px; padding:12px; margin-bottom:12px;">
        <div style="font-size:0.8rem; font-weight:700; color:#fde047; margin-bottom:8px;">
          1️⃣ Identidade, Raça, Elemento & Classificação
        </div>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(175px, 1fr)); gap:10px;">
          <div class="field">
            <label>ID & Chave do Monstro</label>
            <input type="text" id="monsterCodeInput" readonly style="opacity:0.85; font-weight:700; color:#f43f5e;" />
          </div>
          <div class="field">
            <label>Nome do Monstro (PT-BR)</label>
            <input type="text" id="monsterNameInput" placeholder="Ex: Sa Tặc da Areia" />
          </div>
          <div class="field">
            <label style="color:#fb7185; font-weight:700;">🧬 Raça do Monstro</label>
            <select id="monsterRaceSelect"></select>
          </div>
          <div class="field">
            <label style="color:#38bdf8; font-weight:700;">🔥 Elemento Fixo</label>
            <select id="monsterElementSelect"></select>
          </div>
          <div class="field">
            <label style="color:#c084fc; font-weight:700;">💎 Raridade Padrão</label>
            <select id="monsterRaritySelect"></select>
          </div>
          <div class="field">
            <label style="color:#86efac; font-weight:700;">🐾 Domável como Pet?</label>
            <select id="monsterTamableSelect">
              <option value="true">🐾 Sim — Pode ser capturado/Pet</option>
              <option value="false">⚔️ Não — Apenas Inimigo</option>
            </select>
          </div>
          <div class="field">
            <label>Status do Monstro</label>
            <select id="monsterActiveSelect">
              <option value="true">🟢 Ativo no Jogo</option>
              <option value="false">⚪ Inativo / Oculto</option>
            </select>
          </div>
        </div>
      </div>

      <!-- BLOCO 2: DESCRIÇÃO EM PT-BR & CHAVE I18N AUTOMÁTICA (SEMPRE VISÍVEL) -->
      <div style="background:rgba(15,23,42,0.75); border:1px solid #334155; border-radius:10px; padding:12px; margin-bottom:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px; margin-bottom:6px;">
          <span style="font-size:0.8rem; font-weight:700; color:#fde047;">2️⃣ 📜 Descrição / Lore em Português (PT-BR)</span>
          <span id="monsterDescI18nDisplay" style="color:var(--accent); font-family:monospace; font-size:0.72rem; background:#020617; padding:2px 8px; border-radius:4px; border:1px solid var(--border);">monster.monster_X.description</span>
        </div>
        <textarea id="monsterDescriptionInput" rows="3" placeholder="Digite a descrição em português deste monstro (história, habitat, comportamento e curiosidades)..." style="width:100%; padding:8px 10px; font-size:0.84rem; line-height:1.4; resize:vertical; box-sizing:border-box;"></textarea>
      </div>

      <!-- BLOCO 3: ATRIBUTOS BASE NO NÍVEL 1 (SEMPRE VISÍVEL) -->
      <div style="background:rgba(15,23,42,0.75); border:1px solid #334155; border-radius:10px; padding:12px; margin-bottom:12px;">
        <div style="font-size:0.8rem; font-weight:700; color:#fde047; margin-bottom:8px;">
          3️⃣ 📊 Atributos Base no Nível 1 (Escalados por Nível e Raridade em Combate)
        </div>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(95px, 1fr)); gap:8px;">
          <div><label style="font-size:0.72rem; color:#86efac; font-weight:700;">❤️ VIT (Vida/Def)</label><input type="number" id="monsterBaseVIT" value="14" min="1" /></div>
          <div><label style="font-size:0.72rem; color:#f87171; font-weight:700;">🗡️ STR (Ataque)</label><input type="number" id="monsterBaseSTR" value="12" min="1" /></div>
          <div><label style="font-size:0.72rem; color:#38bdf8; font-weight:700;">🔮 INT (Magia/MP)</label><input type="number" id="monsterBaseINT" value="10" min="1" /></div>
          <div><label style="font-size:0.72rem; color:#c084fc; font-weight:700;">✨ WIS (Sabedoria)</label><input type="number" id="monsterBaseWIS" value="10" min="1" /></div>
          <div><label style="font-size:0.72rem; color:#fde047; font-weight:700;">⚡ AGI (Velocidade)</label><input type="number" id="monsterBaseAGI" value="10" min="1" /></div>
          <div><label style="font-size:0.72rem; color:#fb923c; font-weight:700;">🎯 DEX (Precisão)</label><input type="number" id="monsterBaseDEX" value="10" min="1" /></div>
        </div>
      </div>

      <!-- BLOCO 4: BIOMAS DE SPAWN NATURAL (SEMPRE VISÍVEL) -->
      <div style="background:rgba(15,23,42,0.75); border:1px solid #334155; border-radius:10px; padding:12px; margin-bottom:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:8px;">
          <div>
            <span style="font-size:0.8rem; font-weight:700; color:#fde047;">4️⃣ 🌍 Biomas de Spawn Natural</span>
            <span id="monsterBiomesSelectedCount" style="font-size:0.72rem; color:#86efac; margin-left:8px; font-weight:600;">0 marcados</span>
          </div>
          <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
            <input type="text" id="monsterBiomeFilterInput" placeholder="🔍 Filtrar bioma..." oninput="AdminApp.filterMonsterBiomesChecklist()" style="padding:4px 8px; font-size:0.75rem; width:150px;" />
            <button type="button" onclick="AdminApp.toggleAllMonsterBiomes(true)" style="padding:4px 8px; font-size:0.72rem;">✅ Todos</button>
            <button type="button" onclick="AdminApp.toggleAllMonsterBiomes(false)" style="padding:4px 8px; font-size:0.72rem;">⬜ Limpar</button>
          </div>
        </div>
        <div id="monsterBiomesChecklist" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(165px, 1fr)); gap:6px; max-height:155px; overflow-y:auto; padding:8px; background:#020617; border:1px solid var(--border); border-radius:8px;"></div>
      </div>

      <!-- BLOCO 5: PALCO 2.5D ANIMADO & GALERIA DE MODELOS DO MCREWORK -->
      <div style="background:rgba(15,23,42,0.75); border:1.5px solid #f43f5e; border-radius:10px; padding:12px; margin-bottom:12px;">
        <div style="font-size:0.8rem; font-weight:700; color:#fde047; margin-bottom:8px;">
          5️⃣ 🎨 Modelo 2.5D Animado, Calibração de Solo & Catálogo do mcrework
        </div>

        <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap; background:rgba(2,6,23,0.75); border:1px solid #334155; border-radius:10px; padding:10px; margin-bottom:10px;">
          <!-- Canvas 2.5D Real Animado -->
          <div style="position:relative; width:140px; height:140px; background:radial-gradient(ellipse at center bottom, #4c0519 0%, #020617 75%); border:1.5px solid #f43f5e; border-radius:8px; overflow:hidden; flex-shrink:0;">
            <canvas id="monsterPreviewCanvas" width="140" height="140" style="width:140px; height:140px; display:block;"></canvas>
            <span id="monsterPreviewDirBadge" style="position:absolute; top:4px; left:5px; font-size:0.62rem; color:#fde047; background:rgba(0,0,0,0.7); padding:1px 5px; border-radius:4px;">Dir: 0</span>
            <span style="position:absolute; top:4px; right:5px; font-size:0.62rem; color:#fca5a5; background:rgba(0,0,0,0.7); padding:1px 5px; border-radius:4px;">2.5D Live</span>
          </div>

          <div style="flex:1; display:flex; flex-direction:column; gap:6px; min-width:220px;">
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <strong id="monsterHeroLabel" style="font-size:0.92rem; color:#fde047;">Selecione um Monstro</strong>
              <span id="monsterHeroBadge" style="font-size:0.72rem; padding:2px 8px; border-radius:99px; background:rgba(244,63,94,0.2); color:#fb7185; font-weight:700;"></span>
            </div>

            <!-- Botões de Teste das Animações 2.5D do Atlas -->
            <div style="display:flex; gap:4px; flex-wrap:wrap; align-items:center;">
              <span style="font-size:0.7rem; color:var(--text-muted); margin-right:2px;">Animação:</span>
              <button type="button" class="monster-anim-btn btn-primary" data-action="0" onclick="AdminApp.setMonsterPreviewAction(0)" style="padding:3px 7px; font-size:0.7rem;">🧍 Idle</button>
              <button type="button" class="monster-anim-btn" data-action="1" onclick="AdminApp.setMonsterPreviewAction(1)" style="padding:3px 7px; font-size:0.7rem;">🏃 Andar</button>
              <button type="button" class="monster-anim-btn" data-action="3" onclick="AdminApp.setMonsterPreviewAction(3)" style="padding:3px 7px; font-size:0.7rem;">🗡️ Ataque</button>
              <button type="button" class="monster-anim-btn" data-action="5" onclick="AdminApp.setMonsterPreviewAction(5)" style="padding:3px 7px; font-size:0.7rem;">💥 Dano</button>
              <button type="button" class="monster-anim-btn" data-action="6" onclick="AdminApp.setMonsterPreviewAction(6)" style="padding:3px 7px; font-size:0.7rem;">💀 Morte</button>
              <button type="button" class="monster-anim-btn" data-action="7" onclick="AdminApp.setMonsterPreviewAction(7)" style="padding:3px 7px; font-size:0.7rem;">🔥 Skill</button>
              <button type="button" onclick="AdminApp.rotateMonsterPreviewDir()" style="padding:3px 7px; font-size:0.7rem; background:#334155;">↻ Girar</button>
            </div>

            <!-- Calibragem de Distância ao Solo -->
            <div style="display:flex; align-items:center; gap:4px; flex-wrap:wrap;">
              <span style="font-size:0.72rem; color:var(--text-muted);">Distância ao solo:</span>
              <button type="button" onclick="AdminApp.adjustMonsterGroundOffset(-5)" style="padding:3px 7px; font-size:0.72rem;">-5</button>
              <button type="button" onclick="AdminApp.adjustMonsterGroundOffset(-1)" style="padding:3px 7px; font-size:0.72rem;">-1</button>
              <input type="number" id="monsterGroundOffsetYInput" value="0" min="-60" max="60" oninput="AdminApp.updateMonsterGroundOffsetPreview()" style="width:52px; text-align:center; padding:3px; font-size:0.8rem;" />
              <button type="button" onclick="AdminApp.adjustMonsterGroundOffset(1)" style="padding:3px 7px; font-size:0.72rem;">+1</button>
              <button type="button" onclick="AdminApp.adjustMonsterGroundOffset(5)" style="padding:3px 7px; font-size:0.72rem;">+5</button>
              <button type="button" onclick="AdminApp.resetMonsterGroundOffset()" title="Zerar" style="padding:3px 6px; font-size:0.72rem;">↩0</button>
              <span id="monsterGroundStatusBadge" style="font-size:0.72rem; color:#86efac; font-weight:600; margin-left:4px;">🟢 Pés no solo (0px)</span>
            </div>
          </div>
        </div>

        <!-- Filtro e Grade de Modelos do mcrework -->
        <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-bottom:8px;">
          <input type="text" id="monsterSearchInput" placeholder="🔍 Buscar modelo por nome ou código (ex: creature_000015)..." oninput="AdminApp.filterMonsterGallery()" style="flex:1; min-width:180px; padding:6px 10px; font-size:0.82rem;" />
          <select id="monsterCategoryFilterSelect" onchange="AdminApp.filterMonsterGallery()" style="width:150px; padding:6px; font-size:0.8rem;">
            <option value="all">Todos os Modelos</option>
            <option value="pet">🐾 Domáveis (Pets)</option>
            <option value="mob">👾 Selvagens (Mobs)</option>
          </select>
          <span style="font-size:0.75rem; color:var(--text-muted);">(<span id="monsterCountBadge">0</span> disponíveis)</span>
        </div>
        <div id="mcreworkMonstersGrid" class="gallery-grid" style="max-height:300px; min-height:180px;"></div>
      </div>

      <!-- Botão de Salvar no Rodapé -->
      <div style="border-top:1px solid var(--border); padding-top:10px;">
        <button class="btn-success" style="width:100%; padding:12px; font-weight:700; font-size:0.95rem;" onclick="AdminApp.saveMonsterTemplate()">
          💾 Salvar Monstro Completo na Tabela
        </button>
      </div>
    </div>`;

    document.body.appendChild(modalDiv);
  }
}

window.AdminMonstersTab = AdminMonstersTab;
