/**
 * @file apps/server/public/admin/js/AdminPetsTab.js
 * @module @etheria/server
 * @description Submódulo da Aba Tabela de Cadastro de Pets (`pet_templates`) da Rota `/admin`.
 *   - CRUD completo de Pets com busca por nome/asset e filtros por Raridade, Raça, Elemento e Função.
 *   - Modal de criação/edição com Identidade, Raça, Elemento, Raridade, Função (Role) e Taxa de Captura.
 *   - Configuração de Atributos Base (VIT, STR, INT, WIS, AGI, DEX) e Atributos de Combate da Arena.
 *   - Palco de Teste 2.5D Canvas ao Vivo com animações (Parado, Andar, Ataque, Cast, Dano, Morte).
 *   - Galeria seletora de criaturas e pets do repositório mcrework com filtro de pets oficiais.
 */

class AdminPetsTab {
  static attach(app) {
    app.petTemplates = [];
    app.mcreworkPets = [];
    app.selectedMcreworkPetKey = '';
    app.petSearchQuery = '';
    app.petRarityFilter = 'all';
    app.petRaceFilter = 'all';
    app.petElementFilter = 'all';
    app.petRoleFilter = 'all';
    app.petGalleryFilter = 'official';
    app.petPreviewSheet = null;
    app.petPreviewAction = 0;
    app.petPreviewDir = 0;
    app.petPreviewAnimFrame = null;

    if (!window.McreworkSpriteSheet) {
      const script = document.createElement('script');
      script.src = '/play/js/McreworkSpriteSheet.js';
      document.head.appendChild(script);
    }

    AdminPetsTab.injectModalDom();

    app.loadPetTemplates = async function () {
      try {
        this.petTemplates = await this.api('/api/admin/pet-templates');
        this.renderPetsCrudTable();
      } catch (err) {
        console.error('Falha ao carregar templates de pets:', err);
      }
    };

    app.loadMcreworkPets = async function () {
      if (this.mcreworkPets && this.mcreworkPets.length > 0) return;
      try {
        this.mcreworkPets = await this.api('/api/admin/mcrework/pets');
      } catch (err) {
        console.error('Falha ao carregar catálogo mcrework de pets:', err);
      }
    };

    app.filterPetsCrudTable = function () {
      const input = document.getElementById('petSearchInput');
      this.petSearchQuery = (input ? input.value : '').toLowerCase().trim();
      this.petRarityFilter = document.getElementById('petRarityFilterSelect')?.value || 'all';
      this.petRaceFilter = document.getElementById('petRaceFilterSelect')?.value || 'all';
      this.petElementFilter = document.getElementById('petElementFilterSelect')?.value || 'all';
      this.petRoleFilter = document.getElementById('petRoleFilterSelect')?.value || 'all';
      this.renderPetsCrudTable();
    };

    app.filterPetGallery = function () {
      const input = document.getElementById('petGallerySearchInput');
      this.petGallerySearchQuery = (input ? input.value : '').toLowerCase().trim();
      this.renderPetGallery();
    };

    app.setPetGalleryFilter = function (filter) {
      this.petGalleryFilter = filter;
      const btnOff = document.getElementById('btnPetGalOfficial');
      const btnAll = document.getElementById('btnPetGalAll');
      if (btnOff) btnOff.className = filter === 'official' ? 'btn-primary' : '';
      if (btnAll) btnAll.className = filter === 'all' ? 'btn-primary' : '';
      this.renderPetGallery();
    };

    app.openCreatePetModal = async function () {
      await this.loadMcreworkPets();
      document.getElementById('petEditIdInput').value = '';
      document.getElementById('petModalTitle').textContent = '🐾 Cadastrar Novo Pet Companheiro';
      document.getElementById('petNameInput').value = '';
      document.getElementById('petDescriptionInput').value = '';
      document.getElementById('petRaceSelect').value = 'BEAST';
      document.getElementById('petElementSelect').value = 'NEUTRAL';
      document.getElementById('petRaritySelect').value = 'COMMON';
      document.getElementById('petRoleSelect').value = 'BALANCED';
      document.getElementById('petCatchRateInput').value = '25.0';
      document.getElementById('petActiveSelect').value = 'true';
      document.getElementById('petGroundOffsetYInput').value = '0';

      ['VIT', 'STR', 'INT', 'WIS', 'AGI', 'DEX'].forEach((attr) => {
        const inp = document.getElementById(`petBase${attr}Input`);
        if (inp) inp.value = '10';
      });

      document.getElementById('petCombatMoveSpeedInput').value = '180';
      document.getElementById('petCombatAttackSpeedInput').value = '1.0';
      document.getElementById('petCombatPhysAccInput').value = '95';
      document.getElementById('petCombatPhysEvaInput').value = '10';
      document.getElementById('petCombatMagAccInput').value = '95';
      document.getElementById('petCombatMagEvaInput').value = '10';
      document.getElementById('petCombatCritRateInput').value = '5';
      document.getElementById('petCombatCritDmgInput').value = '150';

      const firstPet = this.mcreworkPets.find((p) => p.isOfficialPet) || this.mcreworkPets[0];
      this.selectMcreworkPet(firstPet ? firstPet.mcreworkPetKey : 'creature_000001');

      this.renderPetGallery();
      this.openModal('petModal');
    };

    app.openEditPetModal = async function (id) {
      await this.loadMcreworkPets();
      const pet = this.petTemplates.find((p) => p.id === Number(id));
      if (!pet) return;

      document.getElementById('petEditIdInput').value = String(pet.id);
      document.getElementById('petModalTitle').textContent = `🐾 Editar Pet: ${pet.namePtBr} (#${pet.id})`;
      document.getElementById('petNameInput').value = pet.namePtBr || '';
      document.getElementById('petDescriptionInput').value = pet.descriptionPtBr || '';
      document.getElementById('petRaceSelect').value = pet.raceCode || 'BEAST';
      document.getElementById('petElementSelect').value = pet.recommendedElementCode || 'NEUTRAL';
      document.getElementById('petRaritySelect').value = pet.rarityTier || 'COMMON';
      document.getElementById('petRoleSelect').value = pet.role || 'BALANCED';
      document.getElementById('petCatchRateInput').value = String(pet.catchRatePct ?? 25.0);
      document.getElementById('petActiveSelect').value = pet.isActive ? 'true' : 'false';
      document.getElementById('petGroundOffsetYInput').value = String(pet.groundOffsetY || 0);

      const b = pet.baseAttributesJson || {};
      ['VIT', 'STR', 'INT', 'WIS', 'AGI', 'DEX'].forEach((attr) => {
        const inp = document.getElementById(`petBase${attr}Input`);
        if (inp) inp.value = String(b[attr] ?? 10);
      });

      const cb = pet.baseCombatAttributesJson || {};
      document.getElementById('petCombatMoveSpeedInput').value = String(cb.BATTLE_MOVE_SPEED ?? 180);
      document.getElementById('petCombatAttackSpeedInput').value = String(cb.ATTACK_SPEED ?? 1.0);
      document.getElementById('petCombatPhysAccInput').value = String(cb.PHYS_ACCURACY ?? 95);
      document.getElementById('petCombatPhysEvaInput').value = String(cb.PHYS_EVASION ?? 10);
      document.getElementById('petCombatMagAccInput').value = String(cb.MAG_ACCURACY ?? 95);
      document.getElementById('petCombatMagEvaInput').value = String(cb.MAG_EVASION ?? 10);
      document.getElementById('petCombatCritRateInput').value = String(cb.CRIT_RATE ?? 5);
      document.getElementById('petCombatCritDmgInput').value = String(cb.CRIT_DMG ?? 150);

      this.selectMcreworkPet(pet.mcreworkPetKey);
      this.renderPetGallery();
      this.openModal('petModal');
    };

    app.selectMcreworkPet = function (key) {
      this.selectedMcreworkPetKey = key;
      document.getElementById('petAssetKeyInput').value = key;
      const petMeta = this.mcreworkPets.find((p) => p.mcreworkPetKey === key);

      const nameInp = document.getElementById('petNameInput');
      if (nameInp && !nameInp.value.trim() && petMeta?.suggestedName) {
        nameInp.value = petMeta.suggestedName;
      }

      this.initPetCanvasPreview(key);
      this.renderPetGallery();
    };

    app.adjustPetGroundOffset = function (delta) {
      const input = document.getElementById('petGroundOffsetYInput');
      if (!input) return;
      let val = (Number(input.value) || 0) + delta;
      val = Math.max(-60, Math.min(60, val));
      input.value = String(val);
      this.updatePetGroundOffsetPreview();
    };

    app.resetPetGroundOffset = function () {
      const input = document.getElementById('petGroundOffsetYInput');
      if (input) input.value = '0';
      this.updatePetGroundOffsetPreview();
    };

    app.updatePetGroundOffsetPreview = function () {
      const val = Number(document.getElementById('petGroundOffsetYInput')?.value) || 0;
      const badge = document.getElementById('petGroundOffsetBadge');
      if (badge) badge.textContent = `${val >= 0 ? '+' : ''}${val}px`;
    };

    app.initPetCanvasPreview = function (key) {
      if (this.petPreviewAnimFrame) cancelAnimationFrame(this.petPreviewAnimFrame);

      const canvas = document.getElementById('petPreviewCanvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const petMeta = this.mcreworkPets.find((p) => p.mcreworkPetKey === key);
      if (!petMeta) return;

      if (window.McreworkSpriteSheet) {
        this.petPreviewSheet = new window.McreworkSpriteSheet(petMeta.atlasJsonUrl, petMeta.atlasWebpUrl, petMeta.thumbUrl);
        this.petPreviewSheet.load();
      }

      const animate = (now) => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const cx = canvas.width / 2;
        const cy = canvas.height * 0.72;

        ctx.beginPath();
        ctx.ellipse(cx, cy, 32, 12, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.40)';
        ctx.fill();

        ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        const gOffsetY = Number(document.getElementById('petGroundOffsetYInput')?.value) || 0;
        if (this.petPreviewSheet) {
          this.petPreviewSheet.draw(ctx, cx, cy, this.petPreviewAction, this.petPreviewDir, now, null, gOffsetY, 0.70);
        }

        this.petPreviewAnimFrame = requestAnimationFrame(animate);
      };
      this.petPreviewAnimFrame = requestAnimationFrame(animate);
    };

    app.setPetPreviewAction = function (action) {
      this.petPreviewAction = Number(action) || 0;
      document.querySelectorAll('.pet-anim-btn').forEach((b) => {
        b.className = Number(b.getAttribute('data-action')) === this.petPreviewAction ? 'pet-anim-btn active' : 'pet-anim-btn';
      });
    };

    app.rotatePetPreviewDir = function (delta) {
      this.petPreviewDir = ((this.petPreviewDir + delta) % 8 + 8) % 8;
      const badge = document.getElementById('petPreviewDirBadge');
      const dirs = ['Sul ↓', 'Sudoeste ↙', 'Oeste ←', 'Noroeste ↖', 'Norte ↑', 'Nordeste ↗', 'Leste →', 'Sudeste ↘'];
      if (badge) badge.textContent = dirs[this.petPreviewDir] || `${this.petPreviewDir}`;
    };

    app.renderPetGallery = function () {
      const grid = document.getElementById('petGalleryGrid');
      if (!grid) return;

      const q = (this.petGallerySearchQuery || '').toLowerCase();
      const filtered = this.mcreworkPets.filter((p) => {
        if (this.petGalleryFilter === 'official' && !p.isOfficialPet) return false;
        if (!q) return true;
        return (p.mcreworkPetKey && p.mcreworkPetKey.toLowerCase().includes(q)) ||
               (p.suggestedName && p.suggestedName.toLowerCase().includes(q));
      });

      grid.innerHTML = filtered.map((p) => {
        const isSel = p.mcreworkPetKey === this.selectedMcreworkPetKey;
        return `
          <div onclick="AdminApp.selectMcreworkPet('${p.mcreworkPetKey}')"
               style="cursor:pointer; border:2px solid ${isSel ? '#38bdf8' : 'var(--border)'};
                      border-radius:8px; padding:6px; background:${isSel ? 'rgba(56,189,248,0.18)' : 'rgba(15,23,42,0.85)'};
                      display:flex; flex-direction:column; align-items:center; text-align:center; transition:all 0.15s ease;">
            <img src="${p.thumbUrl}" alt="${p.suggestedName}" loading="lazy" style="width:52px; height:52px; object-fit:contain; border-radius:4px;" />
            <span style="font-size:0.70rem; font-weight:700; color:#f8fafc; margin-top:4px; max-width:85px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
              ${p.suggestedName}
            </span>
            <span style="font-size:0.62rem; color:var(--text-muted); font-family:monospace;">${p.mcreworkPetKey}</span>
            ${p.isOfficialPet ? '<span style="font-size:0.58rem; background:#0284c7; color:#fff; padding:1px 4px; border-radius:3px; margin-top:2px;">PET OFICIAL</span>' : ''}
          </div>
        `;
      }).join('');
    };

    app.savePetTemplate = async function () {
      try {
        const editId = document.getElementById('petEditIdInput').value.trim();
        const namePtBr = document.getElementById('petNameInput').value.trim();
        const mcreworkPetKey = document.getElementById('petAssetKeyInput').value.trim();
        const descriptionPtBr = document.getElementById('petDescriptionInput').value.trim();
        const raceCode = document.getElementById('petRaceSelect').value || 'BEAST';
        const recommendedElementCode = document.getElementById('petElementSelect').value || 'NEUTRAL';
        const rarityTier = document.getElementById('petRaritySelect').value || 'COMMON';
        const role = document.getElementById('petRoleSelect').value || 'BALANCED';
        const catchRatePct = Number(document.getElementById('petCatchRateInput').value) || 25.0;
        const isActive = document.getElementById('petActiveSelect').value === 'true';
        const groundOffsetY = Number(document.getElementById('petGroundOffsetYInput').value) || 0;

        if (!namePtBr) { alert('Informe o nome do pet em português.'); return; }
        if (!mcreworkPetKey) { alert('Selecione uma criatura do catálogo mcrework.'); return; }

        const baseAttributesJson = {
          VIT: Number(document.getElementById('petBaseVITInput')?.value) || 10,
          STR: Number(document.getElementById('petBaseSTRInput')?.value) || 10,
          INT: Number(document.getElementById('petBaseINTInput')?.value) || 10,
          WIS: Number(document.getElementById('petBaseWISInput')?.value) || 10,
          AGI: Number(document.getElementById('petBaseAGIInput')?.value) || 10,
          DEX: Number(document.getElementById('petBaseDEXInput')?.value) || 10,
        };

        const baseCombatAttributesJson = {
          BATTLE_MOVE_SPEED: Number(document.getElementById('petCombatMoveSpeedInput')?.value) || 180,
          ATTACK_SPEED: Number(document.getElementById('petCombatAttackSpeedInput')?.value) || 1.0,
          PHYS_ACCURACY: Number(document.getElementById('petCombatPhysAccInput')?.value) || 95,
          PHYS_EVASION: Number(document.getElementById('petCombatPhysEvaInput')?.value) || 10,
          MAG_ACCURACY: Number(document.getElementById('petCombatMagAccInput')?.value) || 95,
          MAG_EVASION: Number(document.getElementById('petCombatMagEvaInput')?.value) || 10,
          CRIT_RATE: Number(document.getElementById('petCombatCritRateInput')?.value) || 5,
          CRIT_DMG: Number(document.getElementById('petCombatCritDmgInput')?.value) || 150,
        };

        const dto = {
          namePtBr,
          descriptionPtBr,
          mcreworkPetKey,
          raceCode,
          recommendedElementCode,
          rarityTier,
          role,
          catchRatePct,
          isActive,
          groundOffsetY,
          baseAttributesJson,
          baseCombatAttributesJson,
        };

        if (editId) {
          await this.api(`/api/admin/pet-templates/${editId}`, { method: 'PUT', body: JSON.stringify(dto) });
        } else {
          await this.api('/api/admin/pet-templates', { method: 'POST', body: JSON.stringify(dto) });
        }

        this.closeModal('petModal');
        await this.loadPetTemplates();
      } catch (err) {
        alert(`Erro ao salvar Pet: ${err.message}`);
      }
    };

    app.deletePetTemplate = async function (id, name) {
      if (!confirm(`Deseja realmente excluir o pet "${name}" (#${id}) da tabela?`)) return;
      try {
        await this.api(`/api/admin/pet-templates/${id}`, { method: 'DELETE' });
        await this.loadPetTemplates();
      } catch (err) {
        alert(`Erro ao excluir Pet: ${err.message}`);
      }
    };

    app.renderPetsCrudTable = function () {
      const container = document.getElementById('petsTableContainer');
      if (!container) return;

      const q = (this.petSearchQuery || '').toLowerCase();
      const rF = this.petRarityFilter || 'all';
      const rcF = this.petRaceFilter || 'all';
      const eF = this.petElementFilter || 'all';
      const rlF = this.petRoleFilter || 'all';

      const filtered = (this.petTemplates || []).filter((p) => {
        if (rF !== 'all' && p.rarityTier !== rF) return false;
        if (rcF !== 'all' && p.raceCode !== rcF) return false;
        if (eF !== 'all' && p.recommendedElementCode !== eF) return false;
        if (rlF !== 'all' && p.role !== rlF) return false;
        if (!q) return true;
        return (p.namePtBr && p.namePtBr.toLowerCase().includes(q)) ||
               (p.code && p.code.toLowerCase().includes(q)) ||
               (p.mcreworkPetKey && p.mcreworkPetKey.toLowerCase().includes(q));
      });

      const countBadge = document.getElementById('petsCounterBadge');
      if (countBadge) countBadge.textContent = `${filtered.length} de ${this.petTemplates.length} pets cadastrados`;

      if (filtered.length === 0) {
        container.innerHTML = `
          <div style="text-align:center; padding:36px 12px; color:var(--text-muted);">
            🐾 Nenhum pet encontrado com os filtros atuais. Clique em <strong>➕ Novo Pet</strong> para cadastrar!
          </div>
        `;
        return;
      }

      const roleBadges = {
        TANK: '<span style="background:#0284c7; color:#fff; padding:2px 6px; border-radius:4px; font-size:0.75rem;">🛡️ Tanque</span>',
        PHYS_DPS: '<span style="background:#e11d48; color:#fff; padding:2px 6px; border-radius:4px; font-size:0.75rem;">⚔️ DPS Físico</span>',
        MAG_DPS: '<span style="background:#9333ea; color:#fff; padding:2px 6px; border-radius:4px; font-size:0.75rem;">🔮 DPS Mágico</span>',
        HEALER: '<span style="background:#16a34a; color:#fff; padding:2px 6px; border-radius:4px; font-size:0.75rem;">💚 Curandeiro</span>',
        SUPPORT: '<span style="background:#0d9488; color:#fff; padding:2px 6px; border-radius:4px; font-size:0.75rem;">🌀 Suporte</span>',
        BALANCED: '<span style="background:#d97706; color:#fff; padding:2px 6px; border-radius:4px; font-size:0.75rem;">⚖️ Equilibrado</span>',
      };

      const elemIcons = { FIRE: '🔥', WATER: '🌊', EARTH: '🌿', AIR: '💨', NEUTRAL: '⚪' };
      const rarityColors = { SS: '#fbbf24', S: '#c084fc', A: '#38bdf8', B: '#4ade80', C: '#fde047', D: '#cbd5e1', F: '#94a3b8', COMMON: '#94a3b8' };

      container.innerHTML = `
        <table class="data-table" style="width:100%; border-collapse:collapse; font-size:0.83rem;">
          <thead>
            <tr style="border-bottom:1px solid var(--border); text-align:left; color:#94a3b8;">
              <th style="padding:10px;">Visual</th>
              <th style="padding:10px;">Nome & Chave</th>
              <th style="padding:10px;">Raça / Elemento</th>
              <th style="padding:10px;">Raridade</th>
              <th style="padding:10px;">Função (Role)</th>
              <th style="padding:10px;">Atributos Base</th>
              <th style="padding:10px;">Combate (Vel/Aspd/Acc)</th>
              <th style="padding:10px;">Captura</th>
              <th style="padding:10px;">Status</th>
              <th style="padding:10px; text-align:right;">Ações</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map((p) => {
              const b = p.baseAttributesJson || {};
              const cb = p.baseCombatAttributesJson || {};
              const rColor = rarityColors[p.rarityTier] || '#94a3b8';
              const eIcon = elemIcons[p.recommendedElementCode] || '⚪';

              return `
                <tr style="border-bottom:1px solid rgba(51,65,85,0.4);">
                  <td style="padding:8px 10px;">
                    <img src="${p.thumbUrl}" alt="${p.namePtBr}" style="width:40px; height:40px; object-fit:contain; border-radius:6px; background:rgba(15,23,42,0.6);" />
                  </td>
                  <td style="padding:8px 10px;">
                    <strong style="color:#f8fafc; font-size:0.90rem;">${p.namePtBr}</strong>
                    <div style="font-size:0.72rem; color:var(--text-muted); font-family:monospace;">${p.mcreworkPetKey} (${p.code})</div>
                  </td>
                  <td style="padding:8px 10px;">
                    <span style="color:#bae6fd; font-weight:600;">${p.raceNamePtBr || p.raceCode}</span>
                    <div style="font-size:0.74rem; color:#cbd5e1;">${eIcon} ${p.recommendedElementNamePtBr || p.recommendedElementCode}</div>
                  </td>
                  <td style="padding:8px 10px;">
                    <span style="font-weight:700; color:${rColor}; border:1px solid ${rColor}; padding:2px 8px; border-radius:4px; font-size:0.75rem;">
                      ${p.rarityTier}
                    </span>
                  </td>
                  <td style="padding:8px 10px;">
                    ${roleBadges[p.role] || roleBadges.BALANCED}
                  </td>
                  <td style="padding:8px 10px; font-size:0.75rem; color:#cbd5e1; font-family:monospace;">
                    VIT:${b.VIT ?? 10} STR:${b.STR ?? 10} INT:${b.INT ?? 10}<br/>WIS:${b.WIS ?? 10} AGI:${b.AGI ?? 10} DEX:${b.DEX ?? 10}
                  </td>
                  <td style="padding:8px 10px; font-size:0.75rem; color:#38bdf8; font-family:monospace;">
                    🏃 ${cb.BATTLE_MOVE_SPEED ?? 180} px/s &bull; ⚔️ ${cb.ATTACK_SPEED ?? 1.0}x<br/>
                    🎯 Prec:${cb.PHYS_ACCURACY ?? 95} &bull; 💨 Desv:${cb.PHYS_EVASION ?? 10}
                  </td>
                  <td style="padding:8px 10px; font-weight:700; color:#4ade80;">
                    ${p.catchRatePct ?? 25}%
                  </td>
                  <td style="padding:8px 10px;">
                    ${p.isActive ? '<span style="color:#4ade80; font-weight:700;">🟢 Ativo</span>' : '<span style="color:#f87171;">🔴 Inativo</span>'}
                  </td>
                  <td style="padding:8px 10px; text-align:right; white-space:nowrap;">
                    <button class="btn-primary" style="padding:4px 8px; font-size:0.75rem; margin-right:4px;" onclick="AdminApp.openEditPetModal(${p.id})">✏️ Editar</button>
                    <button class="btn-danger" style="padding:4px 8px; font-size:0.75rem;" onclick="AdminApp.deletePetTemplate(${p.id}, '${p.namePtBr}')">🗑️</button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
    };
  }

  static injectModalDom() {
    if (document.getElementById('petModal')) return;

    const modal = document.createElement('div');
    modal.id = 'petModal';
    modal.className = 'modal-backdrop';
    modal.style.display = 'none';

    modal.innerHTML = `
      <div class="modal-box" style="max-width:960px; width:96%; max-height:92vh; display:block; overflow-y:auto; -webkit-overflow-scrolling:touch; padding:16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:10px; margin-bottom:12px;">
          <h3 id="petModalTitle" style="color:#38bdf8; margin:0; font-size:1.05rem;">🐾 Cadastrar / Editar Pet</h3>
          <div style="display:flex; gap:8px;">
            <button class="btn-success" onclick="AdminApp.savePetTemplate()" style="padding:6px 14px; font-weight:700;">💾 Salvar</button>
            <button class="btn-danger" onclick="AdminApp.closeModal('petModal')" style="padding:6px 10px;">✕</button>
          </div>
        </div>

        <input type="hidden" id="petEditIdInput" value="" />
        <input type="hidden" id="petAssetKeyInput" value="" />

        <!-- BLOCO 1: IDENTIDADE DO PET -->
        <div style="background:rgba(15,23,42,0.75); border:1px solid #334155; border-radius:10px; padding:12px; margin-bottom:12px;">
          <div style="font-size:0.80rem; font-weight:700; color:#38bdf8; margin-bottom:8px;">1️⃣ Identidade, Raça, Raridade & Função</div>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:10px;">
            <div class="field">
              <label>Nome do Pet (PT-BR) *</label>
              <input type="text" id="petNameInput" placeholder="Ex: Lobo Guardião" />
            </div>
            <div class="field">
              <label>Raça *</label>
              <select id="petRaceSelect">
                <option value="BEAST">Selvagem (BEAST)</option>
                <option value="CELESTIAL">Celestial (CELESTIAL)</option>
                <option value="SPIRIT">Espírito (SPIRIT)</option>
                <option value="DRAGON">Dragão (DRAGON)</option>
                <option value="PLANT">Planta (PLANT)</option>
                <option value="AQUATIC">Aquático (AQUATIC)</option>
                <option value="REPTILIAN">Reptiliano (REPTILIAN)</option>
                <option value="ROBOTIC">Robótico (ROBOTIC)</option>
                <option value="DEMON">Demônio (DEMON)</option>
                <option value="FAIRY">Fada (FAIRY)</option>
                <option value="HUMAN">Humano (HUMAN)</option>
              </select>
            </div>
            <div class="field">
              <label>Elemento Recomendado</label>
              <select id="petElementSelect">
                <option value="NEUTRAL">⚪ Neutro</option>
                <option value="FIRE">🔥 Fogo</option>
                <option value="WATER">🌊 Água</option>
                <option value="EARTH">🌿 Terra</option>
                <option value="AIR">💨 Ar</option>
              </select>
            </div>
            <div class="field">
              <label>Raridade</label>
              <select id="petRaritySelect">
                <option value="COMMON">COMMON (Comum)</option>
                <option value="F">F (Básico)</option>
                <option value="D">D (Regular)</option>
                <option value="C">C (Incomum)</option>
                <option value="B">B (Raro)</option>
                <option value="A">A (Épico)</option>
                <option value="S">S (Lendário)</option>
                <option value="SS">SS (Mítico)</option>
              </select>
            </div>
            <div class="field">
              <label>Função Tática (Role)</label>
              <select id="petRoleSelect">
                <option value="BALANCED">⚖️ Equilibrado</option>
                <option value="TANK">🛡️ Tanque / Guardião</option>
                <option value="PHYS_DPS">⚔️ Atacante Físico (DPS)</option>
                <option value="MAG_DPS">🔮 Conjurador Mágico (DPS)</option>
                <option value="HEALER">💚 Curandeiro / Suporte</option>
                <option value="SUPPORT">🌀 Suporte / Controle</option>
              </select>
            </div>
            <div class="field">
              <label>Taxa de Captura (%)</label>
              <input type="number" id="petCatchRateInput" value="25.0" step="1" min="1" max="100" />
            </div>
            <div class="field">
              <label>Status Ativo</label>
              <select id="petActiveSelect">
                <option value="true">🟢 Ativo (Disponível no Jogo)</option>
                <option value="false">🔴 Inativo (Oculto)</option>
              </select>
            </div>
            <div class="field" style="grid-column: 1 / -1;">
              <label>Descrição em Português</label>
              <input type="text" id="petDescriptionInput" placeholder="Ex: Companheiro leal que desfere golpes velozes..." />
            </div>
          </div>
        </div>

        <!-- BLOCO 2 & 3: ATRIBUTOS BASE & COMBATE -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
          <!-- Atributos Base -->
          <div style="background:rgba(15,23,42,0.75); border:1px solid #334155; border-radius:10px; padding:12px;">
            <div style="font-size:0.80rem; font-weight:700; color:#fde047; margin-bottom:8px;">2️⃣ Atributos Base (VIT, STR, INT, WIS, AGI, DEX)</div>
            <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px;">
              <div class="field"><label>VIT</label><input type="number" id="petBaseVITInput" value="10" min="1" /></div>
              <div class="field"><label>STR</label><input type="number" id="petBaseSTRInput" value="10" min="1" /></div>
              <div class="field"><label>INT</label><input type="number" id="petBaseINTInput" value="10" min="1" /></div>
              <div class="field"><label>WIS</label><input type="number" id="petBaseWISInput" value="10" min="1" /></div>
              <div class="field"><label>AGI</label><input type="number" id="petBaseAGIInput" value="10" min="1" /></div>
              <div class="field"><label>DEX</label><input type="number" id="petBaseDEXInput" value="10" min="1" /></div>
            </div>
          </div>

          <!-- Atributos de Combate em Batalha -->
          <div style="background:rgba(15,23,42,0.75); border:1px solid #334155; border-radius:10px; padding:12px;">
            <div style="font-size:0.80rem; font-weight:700; color:#38bdf8; margin-bottom:8px;">3️⃣ Atributos de Combate na Arena (Piso Não-Derivado)</div>
            <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:8px;">
              <div class="field"><label>Vel. Movimento (px/s)</label><input type="number" id="petCombatMoveSpeedInput" value="180" min="100" max="250" /></div>
              <div class="field"><label>Vel. Ataque (Aspd)</label><input type="number" id="petCombatAttackSpeedInput" value="1.0" step="0.05" min="0.5" max="2.5" /></div>
              <div class="field"><label>Precisão Física</label><input type="number" id="petCombatPhysAccInput" value="95" min="50" max="200" /></div>
              <div class="field"><label>Desvio Físico</label><input type="number" id="petCombatPhysEvaInput" value="10" min="0" max="100" /></div>
              <div class="field"><label>Precisão Mágica</label><input type="number" id="petCombatMagAccInput" value="95" min="50" max="200" /></div>
              <div class="field"><label>Desvio Mágico</label><input type="number" id="petCombatMagEvaInput" value="10" min="0" max="100" /></div>
              <div class="field"><label>Taxa Crítica (%)</label><input type="number" id="petCombatCritRateInput" value="5" min="0" max="100" /></div>
              <div class="field"><label>Dano Crítico (%)</label><input type="number" id="petCombatCritDmgInput" value="150" min="100" max="400" /></div>
            </div>
          </div>
        </div>

        <!-- BLOCO 4: PALCO DE TESTE 2.5D CANVAS & OFFSET DO CHÃO -->
        <div style="background:rgba(15,23,42,0.75); border:1px solid #334155; border-radius:10px; padding:12px; margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <div style="font-size:0.80rem; font-weight:700; color:#4ade80;">4️⃣ Palco 2.5D ao Vivo & Calibração do Ponto do Solo</div>
            <div style="display:flex; gap:6px; align-items:center;">
              <span style="font-size:0.75rem; color:var(--text-muted);">Offset Solo:</span>
              <span id="petGroundOffsetBadge" style="font-size:0.78rem; font-weight:700; color:#38bdf8;">0px</span>
              <button class="btn-primary" style="padding:2px 8px; font-size:0.72rem;" onclick="AdminApp.adjustPetGroundOffset(-3)">↧ -3px</button>
              <button class="btn-primary" style="padding:2px 8px; font-size:0.72rem;" onclick="AdminApp.adjustPetGroundOffset(3)">↥ +3px</button>
              <button style="padding:2px 8px; font-size:0.72rem;" onclick="AdminApp.resetPetGroundOffset()">Reset</button>
              <input type="hidden" id="petGroundOffsetYInput" value="0" />
            </div>
          </div>
          <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
            <canvas id="petPreviewCanvas" width="220" height="150" style="background:#020617; border:1px solid var(--border); border-radius:8px;"></canvas>
            <div style="display:flex; flex-direction:column; gap:6px;">
              <span style="font-size:0.72rem; color:var(--text-muted);">Testar Ação de Combate:</span>
              <div style="display:flex; gap:4px; flex-wrap:wrap;">
                <button class="pet-anim-btn active" data-action="0" onclick="AdminApp.setPetPreviewAction(0)">Parado (0)</button>
                <button class="pet-anim-btn" data-action="1" onclick="AdminApp.setPetPreviewAction(1)">Andar (1)</button>
                <button class="pet-anim-btn" data-action="3" onclick="AdminApp.setPetPreviewAction(3)">Ataque (3)</button>
                <button class="pet-anim-btn" data-action="7" onclick="AdminApp.setPetPreviewAction(7)">Habilidade (7)</button>
                <button class="pet-anim-btn" data-action="5" onclick="AdminApp.setPetPreviewAction(5)">Dano (5)</button>
                <button class="pet-anim-btn" data-action="6" onclick="AdminApp.setPetPreviewAction(6)">Morte (6)</button>
              </div>
              <div style="display:flex; gap:8px; align-items:center; margin-top:4px;">
                <span style="font-size:0.72rem; color:var(--text-muted);">Girar:</span>
                <button class="btn-primary" style="padding:2px 8px; font-size:0.72rem;" onclick="AdminApp.rotatePetPreviewDir(-1)">⟲ Girar</button>
                <button class="btn-primary" style="padding:2px 8px; font-size:0.72rem;" onclick="AdminApp.rotatePetPreviewDir(1)">Girar ⟳</button>
                <span id="petPreviewDirBadge" style="font-size:0.72rem; color:#bae6fd;">Sul ↓</span>
              </div>
            </div>
          </div>
        </div>

        <!-- BLOCO 5: GALERIA DE CRIATURAS DO MCREWORK -->
        <div style="background:rgba(15,23,42,0.75); border:1px solid #334155; border-radius:10px; padding:12px; margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:8px;">
            <div style="font-size:0.80rem; font-weight:700; color:#c084fc;">5️⃣ Galeria de Modelos de Criaturas (mcrework)</div>
            <div style="display:flex; gap:6px;">
              <button id="btnPetGalOfficial" class="btn-primary" style="padding:4px 10px; font-size:0.74rem;" onclick="AdminApp.setPetGalleryFilter('official')">🐾 Pets Oficiais (106)</button>
              <button id="btnPetGalAll" style="padding:4px 10px; font-size:0.74rem;" onclick="AdminApp.setPetGalleryFilter('all')">🌐 Todas as 543 Criaturas</button>
            </div>
          </div>
          <input type="text" id="petGallerySearchInput" placeholder="🔎 Filtrar na galeria por nome ou ID..." oninput="AdminApp.filterPetGallery()" style="margin-bottom:8px; width:100%;" />
          <div id="petGalleryGrid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(90px, 1fr)); gap:8px; max-height:240px; overflow-y:auto; padding:4px;"></div>
        </div>

        <div style="border-top:1px solid var(--border); padding-top:10px;">
          <button class="btn-success" style="width:100%; padding:12px; font-weight:700; font-size:0.95rem;" onclick="AdminApp.savePetTemplate()">
            💾 Salvar Pet Completo na Tabela
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  }
}

window.AdminPetsTab = AdminPetsTab;
