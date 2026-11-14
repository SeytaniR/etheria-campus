/**
 * @file apps/server/public/admin/js/AdminMonstersTab.js
 * @module @etheria/server
 * @description Submódulo da Aba Monstros / Mobs (`monster_templates`) da Rota `/admin`.
 *   - Gerenciamento completo de monstros e pets com atributos base e atributos base de combate
 *     (velocidade de movimento em batalha, velocidade de ataque, crítico, precisão, esquiva).
 *   - Layout 100% responsivo e adaptativo tanto para Mobile Vertical quanto Desktop.
 *   - Modal desacoplado em AdminMonsterModalDom.js para estrita aderência ao limite de 1.000 linhas (Regra #7).
 */

class AdminMonstersTab {
  static attach(app) {
    app.monsterTemplates = [];
    app.editingMonsterDrops = [];
    app.mcreworkMonsters = [];
    app.selectedMcreworkMonsterKey = '';
    app.monsterSearchQuery = '';
    app.monsterCategoryFilter = 'all';
    app.monsterPreviewSheet = null;
    app.monsterPreviewAction = 0;
    app.monsterPreviewDir = 0;
    app.monsterPreviewAnimFrame = null;
    app.monsterCrudSearchQuery = '';
    app.monsterCrudRankFilter = 'ALL';
    app.monsterCrudElementFilter = 'ALL';
    app.monsterCrudPetFilter = 'ALL';

    // Carrega McreworkSpriteSheet dinamicamente no /admin caso ainda não esteja presente
    if (!window.McreworkSpriteSheet) {
      const script = document.createElement('script');
      script.src = '/play/js/McreworkSpriteSheet.js';
      document.head.appendChild(script);
    }

    // Injeta o DOM desacoplado do modal
    if (window.AdminMonsterModalDom && typeof window.AdminMonsterModalDom.injectModalDom === 'function') {
      window.AdminMonsterModalDom.injectModalDom();
    }

    app.loadMonsterTemplates = async function () {
      try {
        this.monsterTemplates = await this.api('/api/admin/monster-templates');
        this.renderMonstersCrudTable();
      } catch (err) {
        console.error('Falha ao carregar templates de monstros:', err);
      }
    };

    app.filterMonstersCrudTable = function () {
      const searchInput = document.getElementById('monsterCrudSearchInput');
      const rankSelect = document.getElementById('monsterCrudRankFilterSelect');
      const elemSelect = document.getElementById('monsterCrudElementFilterSelect');
      const petSelect = document.getElementById('monsterCrudPetFilterSelect');

      this.monsterCrudSearchQuery = (searchInput ? searchInput.value : '').toLowerCase().trim();
      this.monsterCrudRankFilter = rankSelect ? rankSelect.value : 'ALL';
      this.monsterCrudElementFilter = elemSelect ? elemSelect.value : 'ALL';
      this.monsterCrudPetFilter = petSelect ? petSelect.value : 'ALL';

      this.renderMonstersCrudTable();
    };

    app.toggleMonsterPetAvailable = async function (id, isAvailable) {
      try {
        const existing = (this.monsterTemplates || []).find((m) => Number(m.id) === Number(id));
        if (!existing) return;
        await this.api(`/api/admin/monster-templates/${id}`, {
          method: 'PUT',
          body: JSON.stringify({
            namePtBr: existing.namePtBr,
            descriptionPtBr: existing.descriptionPtBr,
            mcreworkMonsterKey: existing.mcreworkMonsterKey,
            groundOffsetY: existing.groundOffsetY,
            raceCode: existing.raceCode,
            fixedElementCode: existing.fixedElementCode,
            rarityTier: existing.rarityTier,
            combatStyle: existing.combatStyle,
            attackRange: existing.attackRange,
            damageType: existing.damageType,
            isTamableAsPet: !!isAvailable,
            isActive: existing.isActive,
            skillIdsJson: existing.skillIdsJson,
            lootTableJson: existing.lootTableJson,
            baseAttributesJson: existing.baseAttributesJson,
            baseCombatAttributesJson: existing.baseCombatAttributesJson,
          }),
        });
        await this.loadMonsterTemplates();
      } catch (err) {
        alert(`Erro ao atualizar disponibilidade como Pet: ${err.message}`);
        this.renderMonstersCrudTable();
      }
    };

    app.filterMonsterGallery = function () {
      const input = document.getElementById('monsterSearchInput');
      this.monsterSearchQuery = (input ? input.value : '').toLowerCase().trim();
      const catSel = document.getElementById('monsterCategoryFilterSelect');
      this.monsterCategoryFilter = catSel ? catSel.value : 'all';
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
          ctx.clearRect(0, w, h);

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

    app.populateMonsterDropdowns = function () {
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

      this.populateMonsterDropdowns();
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
        const mStyle = existingMonster.combatStyle || 'MELEE';
        const sEl = document.getElementById('monsterCombatStyleSelect'); if (sEl) sEl.value = mStyle;
        const rEl = document.getElementById('monsterAttackRangeInput'); if (rEl) rEl.value = String(existingMonster.attackRange || (mStyle === 'RANGED' ? 220 : 60));
        const dtEl = document.getElementById('monsterDamageTypeSelect'); if (dtEl) dtEl.value = existingMonster.damageType || 'PHYSICAL';

        this.selectedMcreworkMonsterKey = existingMonster.mcreworkMonsterKey || '';

        // Atributos Base
        const base = existingMonster.baseAttributesJson || {};
        document.getElementById('monsterBaseVIT').value = String(base.VIT ?? 14);
        document.getElementById('monsterBaseSTR').value = String(base.STR ?? 12);
        document.getElementById('monsterBaseINT').value = String(base.INT ?? 10);
        document.getElementById('monsterBaseWIS').value = String(base.WIS ?? 10);
        document.getElementById('monsterBaseAGI').value = String(base.AGI ?? 10);
        document.getElementById('monsterBaseDEX').value = String(base.DEX ?? 10);

        // Atributos Base de Combate
        const cb = existingMonster.baseCombatAttributesJson || {};
        const msEl = document.getElementById('monsterBaseCombatMoveSpeed');
        if (msEl) msEl.value = String(cb.BATTLE_MOVE_SPEED ?? 160);
        const asEl = document.getElementById('monsterBaseCombatAttackSpeed');
        if (asEl) asEl.value = String(cb.ATTACK_SPEED ?? 1.0);
        const crEl = document.getElementById('monsterBaseCombatCritRate');
        if (crEl) crEl.value = String(cb.CRIT_RATE ?? 5);
        const cdEl = document.getElementById('monsterBaseCombatCritDmg');
        if (cdEl) cdEl.value = String(cb.CRIT_DMG ?? 150);
        const paEl = document.getElementById('monsterBaseCombatPhysAcc');
        if (paEl) paEl.value = String(cb.PHYS_ACCURACY ?? 95);
        const peEl = document.getElementById('monsterBaseCombatPhysEva');
        if (peEl) peEl.value = String(cb.PHYS_EVASION ?? 5);
        const maEl = document.getElementById('monsterBaseCombatMagAcc');
        if (maEl) maEl.value = String(cb.MAG_ACCURACY ?? 95);
        const meEl = document.getElementById('monsterBaseCombatMagEva');
        if (meEl) meEl.value = String(cb.MAG_EVASION ?? 5);
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
        const sEl = document.getElementById('monsterCombatStyleSelect'); if (sEl) sEl.value = 'MELEE';
        const rEl = document.getElementById('monsterAttackRangeInput'); if (rEl) rEl.value = '60';
        const dtEl = document.getElementById('monsterDamageTypeSelect'); if (dtEl) dtEl.value = 'PHYSICAL';

        this.selectedMcreworkMonsterKey = '';

        // Atributos Base Defaults
        document.getElementById('monsterBaseVIT').value = '14';
        document.getElementById('monsterBaseSTR').value = '12';
        document.getElementById('monsterBaseINT').value = '10';
        document.getElementById('monsterBaseWIS').value = '10';
        document.getElementById('monsterBaseAGI').value = '10';
        document.getElementById('monsterBaseDEX').value = '10';

        // Atributos Base de Combate Defaults
        const msEl = document.getElementById('monsterBaseCombatMoveSpeed'); if (msEl) msEl.value = '160';
        const asEl = document.getElementById('monsterBaseCombatAttackSpeed'); if (asEl) asEl.value = '1.0';
        const crEl = document.getElementById('monsterBaseCombatCritRate'); if (crEl) crEl.value = '5';
        const cdEl = document.getElementById('monsterBaseCombatCritDmg'); if (cdEl) cdEl.value = '150';
        const paEl = document.getElementById('monsterBaseCombatPhysAcc'); if (paEl) paEl.value = '95';
        const peEl = document.getElementById('monsterBaseCombatPhysEva'); if (peEl) peEl.value = '5';
        const maEl = document.getElementById('monsterBaseCombatMagAcc'); if (maEl) maEl.value = '95';
        const meEl = document.getElementById('monsterBaseCombatMagEva'); if (meEl) meEl.value = '5';
      }

      if ((!this.skillTemplates || this.skillTemplates.length === 0) && typeof this.loadSkillsAndBuffsData === 'function') {
        await this.loadSkillsAndBuffsData();
      }
      if (typeof this.loadItemTemplates === 'function') {
        await this.loadItemTemplates();
      }
      const dropFilterEl = document.getElementById('monsterDropItemFilterInput');
      if (dropFilterEl) dropFilterEl.value = '';
      if (typeof this.renderEntitySkillsChecklist === 'function') {
        const currentSkills =
          existingMonster && Array.isArray(existingMonster.skillIdsJson) && existingMonster.skillIdsJson.length > 0
            ? existingMonster.skillIdsJson
            : [1];
        this.renderEntitySkillsChecklist('monsterSkillsChecklist', currentSkills);
      }
      this.populateMonsterDropsItemSelect();
      this.editingMonsterDrops = Array.isArray(existingMonster?.lootTableJson)
        ? JSON.parse(JSON.stringify(existingMonster.lootTableJson))
        : [];
      this.renderMonsterDropsList();

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
        const combatStyle = document.getElementById('monsterCombatStyleSelect')?.value || 'MELEE';
        const attackRange = Number(document.getElementById('monsterAttackRangeInput')?.value) || (combatStyle === 'RANGED' ? 220 : 60);
        const damageType = document.getElementById('monsterDamageTypeSelect')?.value || 'PHYSICAL';
        const isTamableAsPet = document.getElementById('monsterTamableSelect').value === 'true';
        const isActive = document.getElementById('monsterActiveSelect').value === 'true';
        const groundOffsetY = Number(document.getElementById('monsterGroundOffsetYInput').value) || 0;

        if (!mcreworkMonsterKey) {
          alert('Toque em um modelo de Monstro da galeria para selecioná-lo.');
          return;
        }

        const skillIdsJson =
          typeof this.getSelectedEntitySkillIds === 'function'
            ? this.getSelectedEntitySkillIds('monsterSkillsChecklist')
            : [1];

        const registeredItemIds = new Set((this.itemTemplates || []).map((it) => Number(it.id)));
        const invalidDrops = (this.editingMonsterDrops || []).filter((d) => !registeredItemIds.has(Number(d.itemTemplateId)));
        if (invalidDrops.length > 0) {
          alert('Existem drops na lista cujo item não está cadastrado no banco de dados. Selecione um item válido ou remova a linha inválida.');
          return;
        }

        const dto = {
          namePtBr,
          descriptionPtBr,
          mcreworkMonsterKey,
          groundOffsetY,
          raceCode,
          fixedElementCode,
          rarityTier,
          combatStyle,
          attackRange,
          damageType,
          isTamableAsPet,
          isActive,
          skillIdsJson,
          lootTableJson: this.editingMonsterDrops || [],
          baseAttributesJson: {
            VIT: Number(document.getElementById('monsterBaseVIT')?.value) || 14,
            STR: Number(document.getElementById('monsterBaseSTR')?.value) || 12,
            INT: Number(document.getElementById('monsterBaseINT')?.value) || 10,
            WIS: Number(document.getElementById('monsterBaseWIS')?.value) || 10,
            AGI: Number(document.getElementById('monsterBaseAGI')?.value) || 10,
            DEX: Number(document.getElementById('monsterBaseDEX')?.value) || 10,
          },
          baseCombatAttributesJson: {
            BATTLE_MOVE_SPEED: Number(document.getElementById('monsterBaseCombatMoveSpeed')?.value) || 160,
            ATTACK_SPEED: Number(document.getElementById('monsterBaseCombatAttackSpeed')?.value) || 1.0,
            CRIT_RATE: Number(document.getElementById('monsterBaseCombatCritRate')?.value) || 5,
            CRIT_DMG: Number(document.getElementById('monsterBaseCombatCritDmg')?.value) || 150,
            PHYS_ACCURACY: Number(document.getElementById('monsterBaseCombatPhysAcc')?.value) || 95,
            PHYS_EVASION: Number(document.getElementById('monsterBaseCombatPhysEva')?.value) || 5,
            MAG_ACCURACY: Number(document.getElementById('monsterBaseCombatMagAcc')?.value) || 95,
            MAG_EVASION: Number(document.getElementById('monsterBaseCombatMagEva')?.value) || 5,
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

    app.populateMonsterDropsItemSelect = function (filterQuery = '') {
      const sel = document.getElementById('monsterDropAddItemSelect');
      const addBtn = document.getElementById('monsterDropAddBtn');
      if (!sel) return;
      const allItems = this.itemTemplates || [];
      const q = String(filterQuery || '').trim().toLowerCase();
      const filtered = q
        ? allItems.filter((it) => `#${it.id} ${it.namePtBr || ''} ${it.code || ''} ${it.itemCategory || ''}`.toLowerCase().includes(q))
        : allItems;
      if (allItems.length === 0) {
        sel.innerHTML = `<option value="">Nenhum item cadastrado no banco — cadastre na aba Itens primeiro</option>`;
        if (addBtn) addBtn.disabled = true;
        return;
      }
      if (filtered.length === 0) {
        sel.innerHTML = `<option value="">Nenhum item do banco encontrado para o filtro</option>`;
        if (addBtn) addBtn.disabled = true;
        return;
      }
      sel.innerHTML = filtered
        .map((it) => `<option value="${it.id}">#${it.id} ${it.namePtBr} (${it.itemCategory} • ${it.rarityTier || 'COMMON'})</option>`)
        .join('');
      if (addBtn) addBtn.disabled = false;
    };

    app.addMonsterDropEntry = function () {
      const itemId = Number(document.getElementById('monsterDropAddItemSelect')?.value) || 0;
      const registeredItem = (this.itemTemplates || []).find((it) => Number(it.id) === itemId);
      if (!itemId || !registeredItem) {
        alert('Só é possível adicionar itens já cadastrados no banco de dados (aba Itens).');
        return;
      }
      const minQty = Math.max(1, Math.round(Number(document.getElementById('monsterDropAddMinQty')?.value) || 1));
      const maxQty = Math.max(minQty, Math.round(Number(document.getElementById('monsterDropAddMaxQty')?.value) || minQty));
      const chancePct = Math.max(0.01, Math.min(100, Number(document.getElementById('monsterDropAddChance')?.value) || 25));
      this.editingMonsterDrops.push({ itemTemplateId: registeredItem.id, minQty, maxQty, chancePct });
      this.renderMonsterDropsList();
    };

    app.updateMonsterDropEntry = function (idx, field, val) {
      const entry = this.editingMonsterDrops[idx];
      if (!entry) return;
      if (field === 'itemTemplateId') entry.itemTemplateId = Number(val) || entry.itemTemplateId;
      else if (field === 'minQty') { entry.minQty = Math.max(1, Math.round(Number(val) || 1)); if (entry.maxQty < entry.minQty) entry.maxQty = entry.minQty; }
      else if (field === 'maxQty') entry.maxQty = Math.max(entry.minQty || 1, Math.round(Number(val) || 1));
      else if (field === 'chancePct') entry.chancePct = Math.max(0.01, Math.min(100, Number(val) || 0.01));
      this.renderMonsterDropsList();
    };

    app.removeMonsterDropEntry = function (idx) {
      this.editingMonsterDrops.splice(idx, 1);
      this.renderMonsterDropsList();
    };

    app.renderMonsterDropsList = function () {
      const listEl = document.getElementById('monsterDropsListContainer');
      const badgeEl = document.getElementById('monsterDropsCountBadge');
      if (badgeEl) badgeEl.textContent = `${(this.editingMonsterDrops || []).length} drop(s)`;
      if (!listEl) return;
      if (!this.editingMonsterDrops || this.editingMonsterDrops.length === 0) {
        listEl.innerHTML = `<div style="color:#64748b; font-size:0.76rem; padding:10px; text-align:center;">Nenhum drop configurado ainda. Selecione um item acima para adicionar.</div>`;
        return;
      }
      const dbItems = this.itemTemplates || [];
      const registeredIds = new Set(dbItems.map((it) => Number(it.id)));
      const itemOpts = (selId) => {
        const hasValid = registeredIds.has(Number(selId));
        const missingOpt = hasValid ? '' : `<option value="" selected>⚠️ Item #${selId} não cadastrado — escolha outro</option>`;
        return missingOpt + dbItems.map((it) => `<option value="${it.id}" ${Number(selId) === Number(it.id) ? 'selected' : ''}>#${it.id} ${it.namePtBr}</option>`).join('');
      };
      listEl.innerHTML = this.editingMonsterDrops.map((d, i) => {
        const isMissing = !registeredIds.has(Number(d.itemTemplateId));
        return `
        <div style="display:grid; grid-template-columns:1fr 78px 78px 92px auto; gap:6px; align-items:center; background:#0f172a; border:1px solid ${isMissing ? '#ef4444' : '#334155'}; border-radius:6px; padding:6px 8px;">
          <select onchange="AdminApp.updateMonsterDropEntry(${i}, 'itemTemplateId', this.value)" style="font-size:0.75rem; padding:4px 6px;">${itemOpts(d.itemTemplateId)}</select>
          <input type="number" min="1" value="${d.minQty}" title="Qtd Mínima" onchange="AdminApp.updateMonsterDropEntry(${i}, 'minQty', this.value)" style="font-size:0.76rem; padding:4px 6px;" />
          <input type="number" min="1" value="${d.maxQty}" title="Qtd Máxima" onchange="AdminApp.updateMonsterDropEntry(${i}, 'maxQty', this.value)" style="font-size:0.76rem; padding:4px 6px;" />
          <div style="display:flex; align-items:center; gap:3px;">
            <input type="number" min="0.01" max="100" step="0.1" value="${d.chancePct}" title="Chance (%)" onchange="AdminApp.updateMonsterDropEntry(${i}, 'chancePct', this.value)" style="font-size:0.76rem; padding:4px 6px;" />
            <span style="font-size:0.74rem; color:#fde047;">%</span>
          </div>
          <button type="button" class="btn-danger" onclick="AdminApp.removeMonsterDropEntry(${i})" style="padding:4px 8px; font-size:0.74rem;">🗑️</button>
        </div>`;
      }).join('');
    };

    app.formatMonsterDropsCellHtml = function (m) {
      const drops = Array.isArray(m.lootTableResolved) && m.lootTableResolved.length ? m.lootTableResolved : (Array.isArray(m.lootTableJson) ? m.lootTableJson : []);
      if (!drops.length) return `<span style="font-size:0.72rem; color:#64748b;">— Sem drops</span>`;
      return `<div style="display:flex; flex-direction:column; gap:3px;">${drops.map((d) => {
        const itName = d.itemNamePtBr || (this.itemTemplates || []).find((x) => Number(x.id) === Number(d.itemTemplateId))?.namePtBr || `Item #${d.itemTemplateId}`;
        const qtyStr = d.minQty === d.maxQty ? `${d.minQty}x` : `${d.minQty}–${d.maxQty}x`;
        return `<span style="display:inline-flex; align-items:center; gap:4px; padding:2px 6px; border-radius:6px; background:rgba(34,197,94,0.14); border:1px solid rgba(34,197,94,0.4); font-size:0.71rem; color:#86efac; white-space:nowrap;">🎁 <strong>${qtyStr}</strong> ${itName} <strong style="color:#fde047;">(${d.chancePct}%)</strong></span>`;
      }).join('')}</div>`;
    };

    app.renderMonstersCrudTable = function () {
      const tbody = document.getElementById('monstersTableBody');
      const cardsContainer = document.getElementById('monstersCardsContainer');
      const countBadge = document.getElementById('monsterCrudCountBadge');

      const all = Array.isArray(this.monsterTemplates) ? this.monsterTemplates : [];

      // Filtros da barra superior
      const q = (this.monsterCrudSearchQuery || '').toLowerCase().trim();
      const rFilter = this.monsterCrudRankFilter || 'ALL';
      const eFilter = this.monsterCrudElementFilter || 'ALL';
      const pFilter = this.monsterCrudPetFilter || 'ALL';

      const filtered = all.filter((m) => {
        if (rFilter !== 'ALL' && (m.rarityTier || 'F') !== rFilter) return false;
        if (eFilter !== 'ALL' && (m.fixedElementCode || 'NEUTRAL') !== eFilter) return false;
        if (pFilter === 'PET_AVAILABLE' && m.isTamableAsPet === false) return false;
        if (pFilter === 'MONSTER_ONLY' && m.isTamableAsPet !== false) return false;
        if (!q) return true;
        const text = `${m.id} ${m.code} ${m.namePtBr || ''} ${m.mcreworkMonsterKey || ''} ${m.raceCode || ''} ${m.descriptionPtBr || ''}`.toLowerCase();
        return text.includes(q);
      });

      if (countBadge) countBadge.textContent = String(filtered.length);

      const tierColors = {
        SS: { bg: 'rgba(244,63,94,0.22)', text: '#fda4af', border: '#f43f5e' },
        S: { bg: 'rgba(234,179,8,0.22)', text: '#fde047', border: '#eab308' },
        A: { bg: 'rgba(192,132,252,0.22)', text: '#d8b4fe', border: '#a855f7' },
        B: { bg: 'rgba(56,189,248,0.22)', text: '#7dd3fc', border: '#0ea5e9' },
        C: { bg: 'rgba(34,197,94,0.22)', text: '#86efac', border: '#22c55e' },
        D: { bg: 'rgba(251,146,60,0.20)', text: '#fdba74', border: '#f97316' },
        F: { bg: 'rgba(148,163,184,0.18)', text: '#cbd5e1', border: '#64748b' },
      };

      // 1. RENDERIZAÇÃO DA VISÃO DESKTOP (Tabela)
      if (tbody) {
        if (filtered.length === 0) {
          tbody.innerHTML = `<tr><td colspan="9" style="color:var(--text-muted); padding:18px; text-align:center;">Nenhum Monstro encontrado com os filtros selecionados.</td></tr>`;
        } else {
          tbody.innerHTML = filtered
            .map((m) => {
              const b = m.baseAttributesJson || {};
              const cb = m.baseCombatAttributesJson || {};
              const gOffStr = m.groundOffsetY !== 0 ? ` [↧ ${m.groundOffsetY > 0 ? '+' : ''}${m.groundOffsetY}px]` : '';
              const tier = m.rarityTier || 'F';
              const tc = tierColors[tier] || tierColors.F;

              const monsterSkillIds = Array.isArray(m.skillIdsJson) ? m.skillIdsJson : [];
              const skillsHtml = monsterSkillIds.map((sid) => {
                const sk = (this.skillTemplates || []).find((s) => Number(s.id) === Number(sid));
                return sk
                  ? `<span style="padding:1px 5px; border-radius:4px; background:rgba(56,189,248,0.12); border:1px solid #38bdf8; font-size:0.67rem; color:#7dd3fc;">⚡ ${sk.namePtBr}</span>`
                  : `<span style="font-size:0.67rem; color:#94a3b8;">⚡ #${sid}</span>`;
              }).join(' ');

              return `
            <tr>
              <td>
                <strong>#${m.id}</strong><br/>
                <span style="color:#f43f5e; font-weight:700; font-size:0.75rem;">${m.code}</span>
                <div style="font-size:0.68rem; color:${m.isActive !== false ? '#86efac' : '#94a3b8'}; margin-top:2px;">
                  ${m.isActive !== false ? '● Ativo' : '○ Inativo'}
                </div>
              </td>
              <td>
                <div style="display:flex; flex-direction:column; align-items:center; gap:2px;">
                  <img src="${m.thumbUrl}" alt="${m.mcreworkMonsterKey}" style="width:48px; height:48px; object-fit:contain; background:#020617; border-radius:6px; border:1px solid #f43f5e;" />
                  <span style="font-size:0.65rem; color:var(--text-muted); text-align:center;">${m.mcreworkMonsterKey}${gOffStr}</span>
                </div>
              </td>
              <td>
                <strong style="font-size:0.86rem; color:#f8fafc;">${m.namePtBr}</strong>
                <div style="font-size:0.72rem; color:${m.descriptionPtBr ? 'var(--text-muted)' : '#64748b'}; max-width:240px; white-space:normal; line-height:1.3; margin-top:2px;">
                  📜 ${m.descriptionPtBr || '<em>Sem descrição</em>'}
                </div>
                ${skillsHtml ? `<div style="display:flex; flex-wrap:wrap; gap:3px; margin-top:4px;">${skillsHtml}</div>` : ''}
              </td>
              <td>
                <div style="display:flex; flex-direction:column; gap:4px; align-items:flex-start;">
                  <span style="padding:2px 7px; border-radius:99px; background:rgba(244,63,94,0.15); color:#fb7185; font-size:0.72rem; font-weight:700;">🧬 ${m.raceNamePtBr || m.raceCode}</span>
                  <span style="padding:2px 7px; border-radius:99px; background:rgba(56,189,248,0.15); color:var(--accent); font-size:0.72rem; font-weight:700;">🔥 ${m.elementNamePtBr || m.fixedElementCode}</span>
                </div>
              </td>
              <td>
                <span style="padding:2px 8px; border-radius:99px; background:${tc.bg}; color:${tc.text}; border:1px solid ${tc.border}; font-size:0.75rem; font-weight:800;">Rank ${tier}</span>
                <div style="margin-top:4px; font-size:0.70rem;">
                  ${m.combatStyle === 'RANGED' ? `<span style="color:#38bdf8; font-weight:700;">🏹 Ranged (${m.attackRange || 220}px)</span>` : `<span style="color:#fbbf24; font-weight:700;">⚔️ Melee (${m.attackRange || 60}px)</span>`}
                  <br/>
                  ${m.damageType === 'MAGICAL' ? `<span style="color:#c084fc; font-weight:700;">🔮 Mágico</span>` : `<span style="color:#f59e0b; font-weight:700;">🗡️ Físico</span>`}
                </div>
                <label style="display:inline-flex; align-items:center; gap:5px; font-size:0.70rem; color:${m.isTamableAsPet !== false ? '#86efac' : '#94a3b8'}; margin-top:4px; cursor:pointer; background:rgba(15,23,42,0.8); padding:2px 6px; border-radius:4px; border:1px solid ${m.isTamableAsPet !== false ? '#22c55e' : '#334155'};">
                  <input type="checkbox" ${m.isTamableAsPet !== false ? 'checked' : ''} onchange="AdminApp.toggleMonsterPetAvailable(${m.id}, this.checked)" style="cursor:pointer; accent-color:#22c55e;" />
                  <span>${m.isTamableAsPet !== false ? '🐾 Pet Disponível' : '⚔️ Só Monstro'}</span>
                </label>
              </td>
              <td>
                <div style="font-family:monospace; font-size:0.73rem; line-height:1.4; background:#020617; padding:4px 6px; border-radius:4px; border:1px solid #1e293b;">
                  <div>VIT: <strong style="color:#86efac;">${b.VIT ?? 14}</strong> | STR: <strong style="color:#f87171;">${b.STR ?? 12}</strong></div>
                  <div>INT: <strong style="color:#38bdf8;">${b.INT ?? 10}</strong> | WIS: <strong style="color:#c084fc;">${b.WIS ?? 10}</strong></div>
                  <div>AGI: <strong style="color:#fde047;">${b.AGI ?? 10}</strong> | DEX: <strong style="color:#fb923c;">${b.DEX ?? 10}</strong></div>
                </div>
              </td>
              <td>
                <div style="font-family:monospace; font-size:0.72rem; line-height:1.4; background:rgba(56,189,248,0.06); padding:4px 6px; border-radius:4px; border:1px solid rgba(56,189,248,0.3);">
                  <div style="color:#38bdf8;">🏃 Vel. Mov: <strong>${cb.BATTLE_MOVE_SPEED ?? 160}</strong> px/s</div>
                  <div style="color:#fde047;">⚔️ Vel. Atk: <strong>${Number(cb.ATTACK_SPEED ?? 1.0).toFixed(1)}</strong> atks/s</div>
                  <div style="color:#f43f5e;">💥 Crítico: <strong>${cb.CRIT_RATE ?? 5}%</strong> (${cb.CRIT_DMG ?? 150}%)</div>
                  <div style="color:#86efac;">🎯 Prec: <strong>${cb.PHYS_ACCURACY ?? 95}%</strong> / Desv: <strong>${cb.PHYS_EVASION ?? 5}%</strong></div>
                </div>
              </td>
              <td>${this.formatMonsterDropsCellHtml(m)}</td>
              <td>
                <div style="display:flex; flex-direction:column; gap:4px; align-items:center;">
                  <button class="btn-primary" style="padding:4px 10px; font-size:0.75rem; width:100%;" onclick="AdminApp.openMonsterTemplateModal(${m.id})">✏️ Editar</button>
                  <button class="btn-danger" style="padding:4px 8px; font-size:0.72rem; width:100%;" onclick="AdminApp.deleteMonsterTemplate(${m.id})">🗑️</button>
                </div>
              </td>
            </tr>`;
            })
            .join('');
        }
      }

      // 2. RENDERIZAÇÃO DA VISÃO MOBILE VERTICAL (Cards Adaptativos)
      if (cardsContainer) {
        if (filtered.length === 0) {
          cardsContainer.innerHTML = `<div style="color:var(--text-muted); padding:20px; text-align:center; background:#0f172a; border-radius:8px;">Nenhum Monstro encontrado com os filtros.</div>`;
        } else {
          cardsContainer.innerHTML = filtered
            .map((m) => {
              const b = m.baseAttributesJson || {};
              const cb = m.baseCombatAttributesJson || {};
              const tier = m.rarityTier || 'F';
              const tc = tierColors[tier] || tierColors.F;

              return `
            <div class="monster-mobile-card">
              <!-- Topo do Card Mobile -->
              <div class="monster-mobile-card-header">
                <img src="${m.thumbUrl}" alt="${m.mcreworkMonsterKey}" class="monster-mobile-card-thumb" />
                <div class="monster-mobile-card-title">
                  <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:6px;">
                    <strong style="font-size:0.95rem; color:#f8fafc;">${m.namePtBr}</strong>
                    <span style="padding:2px 8px; border-radius:99px; background:${tc.bg}; color:${tc.text}; border:1px solid ${tc.border}; font-size:0.72rem; font-weight:800; white-space:nowrap;">Rank ${tier}</span>
                  </div>
                  <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap; font-size:0.72rem; color:var(--text-muted); margin-top:2px;">
                    <span style="color:#f43f5e; font-weight:700;">#${m.id} • ${m.code}</span>
                    <span style="color:${m.isActive !== false ? '#86efac' : '#94a3b8'};">${m.isActive !== false ? '● Ativo' : '○ Inativo'}</span>
                  </div>
                </div>
              </div>

              <!-- Badges de Classificação Mobile -->
              <div style="display:flex; flex-wrap:wrap; gap:4px;">
                <span style="padding:2px 7px; border-radius:99px; background:rgba(244,63,94,0.15); color:#fb7185; font-size:0.70rem; font-weight:700;">🧬 ${m.raceNamePtBr || m.raceCode}</span>
                <span style="padding:2px 7px; border-radius:99px; background:rgba(56,189,248,0.15); color:var(--accent); font-size:0.70rem; font-weight:700;">🔥 ${m.elementNamePtBr || m.fixedElementCode}</span>
                <span style="padding:2px 7px; border-radius:99px; background:rgba(234,179,8,0.15); color:#fde047; font-size:0.70rem; font-weight:700;">${m.combatStyle === 'RANGED' ? `🏹 Ranged (${m.attackRange || 220}px)` : `⚔️ Melee (${m.attackRange || 60}px)`}</span>
                <span style="padding:2px 7px; border-radius:99px; background:rgba(192,132,252,0.15); color:#d8b4fe; font-size:0.70rem; font-weight:700;">${m.damageType === 'MAGICAL' ? '🔮 Mágico' : '🗡️ Físico'}</span>
                <label style="display:inline-flex; align-items:center; gap:4px; padding:2px 7px; border-radius:99px; background:rgba(34,197,94,0.15); color:${m.isTamableAsPet !== false ? '#86efac' : '#94a3b8'}; font-size:0.70rem; font-weight:700; cursor:pointer;">
                  <input type="checkbox" ${m.isTamableAsPet !== false ? 'checked' : ''} onchange="AdminApp.toggleMonsterPetAvailable(${m.id}, this.checked)" style="cursor:pointer; accent-color:#22c55e;" />
                  <span>${m.isTamableAsPet !== false ? '🐾 Pet Disponível' : '⚔️ Só Monstro'}</span>
                </label>
              </div>

              ${m.descriptionPtBr ? `<div style="font-size:0.74rem; color:var(--text-muted); line-height:1.3; background:#020617; padding:6px 8px; border-radius:6px; border:1px solid #1e293b;">📜 ${m.descriptionPtBr}</div>` : ''}

              <!-- Grid de Atributos Base e Combate Mobile -->
              <div class="monster-mobile-card-stats-grid">
                <div>
                  <div style="color:#94a3b8; font-size:0.68rem; font-weight:700; margin-bottom:2px;">📊 ATRIBUTOS BASE</div>
                  <div>VIT: <strong style="color:#86efac;">${b.VIT ?? 14}</strong> | STR: <strong style="color:#f87171;">${b.STR ?? 12}</strong></div>
                  <div>INT: <strong style="color:#38bdf8;">${b.INT ?? 10}</strong> | WIS: <strong style="color:#c084fc;">${b.WIS ?? 10}</strong></div>
                  <div>AGI: <strong style="color:#fde047;">${b.AGI ?? 10}</strong> | DEX: <strong style="color:#fb923c;">${b.DEX ?? 10}</strong></div>
                </div>
                <div>
                  <div style="color:#38bdf8; font-size:0.68rem; font-weight:700; margin-bottom:2px;">⚔️ COMBATE BASE</div>
                  <div style="color:#38bdf8;">🏃 Vel. Mov: <strong>${cb.BATTLE_MOVE_SPEED ?? 160}</strong> px/s</div>
                  <div style="color:#fde047;">⚔️ Vel. Atk: <strong>${Number(cb.ATTACK_SPEED ?? 1.0).toFixed(1)}</strong> atks/s</div>
                  <div style="color:#f43f5e;">💥 Crit: <strong>${cb.CRIT_RATE ?? 5}%</strong> (${cb.CRIT_DMG ?? 150}%)</div>
                </div>
              </div>

              <!-- Drops Mobile -->
              <div>
                <div style="font-size:0.68rem; color:#86efac; font-weight:700; margin-bottom:2px;">🎁 DROPS DO MONSTRO:</div>
                ${this.formatMonsterDropsCellHtml(m)}
              </div>

              <!-- Ações Mobile Touch-Friendly -->
              <div class="monster-mobile-card-actions">
                <button type="button" class="btn-primary" onclick="AdminApp.openMonsterTemplateModal(${m.id})">
                  ✏️ Editar Monstro
                </button>
                <button type="button" class="btn-danger" style="padding:0 14px;" onclick="AdminApp.deleteMonsterTemplate(${m.id})">
                  🗑️
                </button>
              </div>
            </div>`;
            })
            .join('');
        }
      }
    };
  }
}

window.AdminMonstersTab = AdminMonstersTab;
