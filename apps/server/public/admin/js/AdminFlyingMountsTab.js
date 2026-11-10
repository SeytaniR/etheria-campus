/**
 * @file apps/server/public/admin/js/AdminFlyingMountsTab.js
 * @module @etheria/server
 * @description Submódulo da Aba Tabela de Cadastro de Montarias Voadoras (`flying_mount_templates`) da Rota `/admin`.
 *   - CRUD completo de Montarias Voadoras, Divinas e Planadores com filtros por Tipo, Tier e Raridade.
 *   - Calibração de Altitude de Voo (px), Bônus de Velocidade (%), Fôlego/Stamina e Offsets 2.5D (Solo e Montador).
 *   - Atributos Base (VIT, STR, INT, WIS, AGI, DEX) e Atributos de Combate da Arena (Vel. Mov Batalha px/s, Aspd, Precisão, Desvio, Defesas).
 *   - Palco de Teste 2.5D Canvas ao Vivo com rotação direcional (8 direções), simulação de voo e indicador de acoplamento do cavaleiro.
 *   - Galeria oficial de 20 montarias com spritesheets 2.5D do repositório mcrework.
 */

class AdminFlyingMountsTab {
  static attach(app) {
    app.flyingMountTemplates = [];
    app.mcreworkMounts = [];
    app.selectedMcreworkMountKey = '';
    app.mountSearchQuery = '';
    app.mountTypeFilter = 'ALL';
    app.mountTierFilter = 'ALL';
    app.mountRarityFilter = 'ALL';
    app.mountGallerySearchQuery = '';
    app.mountPreviewSheet = null;
    app.mountPreviewAction = 0;
    app.mountPreviewDir = 0;
    app.mountPreviewAnimFrame = null;

    if (!window.McreworkSpriteSheet) {
      const script = document.createElement('script');
      script.src = '/play/js/McreworkSpriteSheet.js';
      document.head.appendChild(script);
    }

    AdminFlyingMountsTab.injectTabAndModalDom();

    app.loadFlyingMountTemplates = async function () {
      try {
        this.flyingMountTemplates = await this.api('/api/admin/flying-mounts');
        this.renderFlyingMountsCrudTable();
      } catch (err) {
        console.error('Falha ao carregar templates de montarias voadoras:', err);
      }
    };

    app.loadMcreworkMounts = async function () {
      if (this.mcreworkMounts && this.mcreworkMounts.length > 0) return;
      try {
        this.mcreworkMounts = await this.api('/api/admin/mcrework/mounts');
      } catch (err) {
        console.error('Falha ao carregar catálogo mcrework de montarias:', err);
      }
    };

    app.filterFlyingMountsCrudTable = function () {
      const input = document.getElementById('mountSearchInput');
      this.mountSearchQuery = (input ? input.value : '').toLowerCase().trim();
      this.mountTypeFilter = document.getElementById('mountTypeFilterSelect')?.value || 'ALL';
      this.mountTierFilter = document.getElementById('mountTierFilterSelect')?.value || 'ALL';
      this.mountRarityFilter = document.getElementById('mountRarityFilterSelect')?.value || 'ALL';
      this.renderFlyingMountsCrudTable();
    };

    app.filterMountGallery = function () {
      const input = document.getElementById('mountGallerySearchInput');
      this.mountGallerySearchQuery = (input ? input.value : '').toLowerCase().trim();
      this.renderMountGallery();
    };

    app.openCreateFlyingMountModal = async function () {
      await this.loadMcreworkMounts();
      document.getElementById('mountEditIdInput').value = '';
      document.getElementById('mountModalTitle').textContent = '🦅 Cadastrar Nova Montaria Voadora';
      document.getElementById('mountNameInput').value = '';
      document.getElementById('mountCodeInput').value = '';
      document.getElementById('mountDescriptionInput').value = '';
      document.getElementById('mountTypeSelect').value = 'FLYING';
      document.getElementById('mountTierSelect').value = '1';
      document.getElementById('mountRaritySelect').value = 'COMMON';
      document.getElementById('mountSpeedBonusInput').value = '30';
      document.getElementById('mountFlightAltitudeInput').value = '50';
      document.getElementById('mountStaminaMaxInput').value = '200';
      document.getElementById('mountGroundOffsetYInput').value = '0';
      document.getElementById('mountRiderOffsetYInput').value = '-45';
      document.getElementById('mountReqLevelInput').value = '1';
      document.getElementById('mountPriceInput').value = '500';
      document.getElementById('mountActiveSelect').value = 'true';

      ['VIT', 'STR', 'INT', 'WIS', 'AGI', 'DEX'].forEach((attr) => {
        const inp = document.getElementById(`mountBase${attr}Input`);
        if (inp) inp.value = '5';
      });

      document.getElementById('mountCombatMoveSpeedInput').value = '20';
      document.getElementById('mountCombatAttackSpeedInput').value = '0.05';
      document.getElementById('mountCombatPhysAccInput').value = '5';
      document.getElementById('mountCombatPhysEvaInput').value = '5';
      document.getElementById('mountCombatMagAccInput').value = '5';
      document.getElementById('mountCombatMagEvaInput').value = '5';
      document.getElementById('mountCombatPdefInput').value = '25';
      document.getElementById('mountCombatMdefInput').value = '25';

      this.updateMountOffsetsPreview();

      const defaultMount = this.mcreworkMounts[0];
      this.selectMcreworkMount(defaultMount ? defaultMount.mcreworkMountKey : 'mount_000003');

      this.renderMountGallery();
      document.getElementById('flyingMountModal').style.display = 'flex';
    };

    app.openEditFlyingMountModal = async function (id) {
      await this.loadMcreworkMounts();
      const mount = this.flyingMountTemplates.find((m) => m.id === Number(id));
      if (!mount) return;

      document.getElementById('mountEditIdInput').value = String(mount.id);
      document.getElementById('mountModalTitle').textContent = `🦅 Editar Montaria: ${mount.namePtBr} (#${mount.id})`;
      document.getElementById('mountNameInput').value = mount.namePtBr || '';
      document.getElementById('mountCodeInput').value = mount.code || '';
      document.getElementById('mountDescriptionInput').value = mount.descriptionPtBr || '';
      document.getElementById('mountTypeSelect').value = mount.mountType || 'FLYING';
      document.getElementById('mountTierSelect').value = String(mount.tier || 1);
      document.getElementById('mountRaritySelect').value = mount.rarityTier || 'COMMON';
      document.getElementById('mountSpeedBonusInput').value = String(mount.speedBonusPct ?? 30);
      document.getElementById('mountFlightAltitudeInput').value = String(mount.flightAltitude ?? 50);
      document.getElementById('mountStaminaMaxInput').value = String(mount.staminaMax ?? 200);
      document.getElementById('mountGroundOffsetYInput').value = String(mount.groundOffsetY || 0);
      document.getElementById('mountRiderOffsetYInput').value = String(mount.riderOffsetY ?? -45);
      document.getElementById('mountReqLevelInput').value = String(mount.requiredLevel || 1);
      document.getElementById('mountPriceInput').value = String(mount.priceGold || 0);
      document.getElementById('mountActiveSelect').value = mount.isActive ? 'true' : 'false';

      const b = mount.baseAttributesJson || {};
      ['VIT', 'STR', 'INT', 'WIS', 'AGI', 'DEX'].forEach((attr) => {
        const inp = document.getElementById(`mountBase${attr}Input`);
        if (inp) inp.value = String(b[attr] ?? 0);
      });

      const cb = mount.combatAttributesJson || {};
      document.getElementById('mountCombatMoveSpeedInput').value = String(cb.BATTLE_MOVE_SPEED ?? 20);
      document.getElementById('mountCombatAttackSpeedInput').value = String(cb.ATTACK_SPEED ?? 0.05);
      document.getElementById('mountCombatPhysAccInput').value = String(cb.PHYS_ACCURACY ?? 5);
      document.getElementById('mountCombatPhysEvaInput').value = String(cb.PHYS_EVASION ?? 5);
      document.getElementById('mountCombatMagAccInput').value = String(cb.MAG_ACCURACY ?? 5);
      document.getElementById('mountCombatMagEvaInput').value = String(cb.MAG_EVASION ?? 5);
      document.getElementById('mountCombatPdefInput').value = String(cb.PDEF ?? 25);
      document.getElementById('mountCombatMdefInput').value = String(cb.MDEF ?? 25);

      this.updateMountOffsetsPreview();
      this.selectMcreworkMount(mount.mcreworkMountKey || 'mount_000003');
      this.renderMountGallery();
      document.getElementById('flyingMountModal').style.display = 'flex';
    };

    app.selectMcreworkMount = function (key) {
      this.selectedMcreworkMountKey = key;
      const keyInp = document.getElementById('mountAssetKeyInput');
      if (keyInp) keyInp.value = key;

      const meta = this.mcreworkMounts.find((m) => m.mcreworkMountKey === key);
      const nameInp = document.getElementById('mountNameInput');
      if (nameInp && !nameInp.value.trim() && meta?.suggestedName) {
        nameInp.value = meta.suggestedName;
      }
      const tierSelect = document.getElementById('mountTierSelect');
      if (tierSelect && meta?.tier && !document.getElementById('mountEditIdInput').value) {
        tierSelect.value = String(meta.tier);
      }

      this.initMountCanvasPreview(key);
      this.renderMountGallery();
    };

    app.adjustMountGroundOffset = function (delta) {
      const inp = document.getElementById('mountGroundOffsetYInput');
      if (!inp) return;
      let val = (Number(inp.value) || 0) + delta;
      val = Math.max(-100, Math.min(100, val));
      inp.value = String(val);
      this.updateMountOffsetsPreview();
    };

    app.adjustMountRiderOffset = function (delta) {
      const inp = document.getElementById('mountRiderOffsetYInput');
      if (!inp) return;
      let val = (Number(inp.value) || 0) + delta;
      val = Math.max(-160, Math.min(20, val));
      inp.value = String(val);
      this.updateMountOffsetsPreview();
    };

    app.updateMountOffsetsPreview = function () {
      const gVal = Number(document.getElementById('mountGroundOffsetYInput')?.value) || 0;
      const rVal = Number(document.getElementById('mountRiderOffsetYInput')?.value) || 0;
      const gBadge = document.getElementById('mountGroundOffsetBadge');
      const rBadge = document.getElementById('mountRiderOffsetBadge');
      if (gBadge) gBadge.textContent = `${gVal >= 0 ? '+' : ''}${gVal}px`;
      if (rBadge) rBadge.textContent = `${rVal >= 0 ? '+' : ''}${rVal}px`;
    };

    app.rotateMountPreviewDir = function (delta) {
      this.mountPreviewDir = (this.mountPreviewDir + delta + 8) % 8;
      const dirLabels = ['Sul (S)', 'Sudoeste (SW)', 'Oeste (W)', 'Noroeste (NW)', 'Norte (N)', 'Nordeste (NE)', 'Leste (E)', 'Sudeste (SE)'];
      const lbl = document.getElementById('mountPreviewDirLabel');
      if (lbl) lbl.textContent = dirLabels[this.mountPreviewDir];
    };

    app.setMountPreviewAction = function (act) {
      this.mountPreviewAction = act;
      const b0 = document.getElementById('btnMountActIdle');
      const b1 = document.getElementById('btnMountActMove');
      if (b0) b0.className = act === 0 ? 'btn-primary' : '';
      if (b1) b1.className = act === 1 ? 'btn-primary' : '';
    };

    app.initMountCanvasPreview = function (key) {
      if (this.mountPreviewAnimFrame) cancelAnimationFrame(this.mountPreviewAnimFrame);

      const canvas = document.getElementById('mountPreviewCanvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const meta = this.mcreworkMounts.find((m) => m.mcreworkMountKey === key);
      if (!meta) return;

      if (window.McreworkSpriteSheet) {
        this.mountPreviewSheet = new window.McreworkSpriteSheet(meta.atlasJsonUrl, meta.atlasWebpUrl, meta.thumbUrl);
        this.mountPreviewSheet.load();
      }

      const animate = (now) => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const cx = canvas.width / 2;
        const cy = canvas.height * 0.76;

        const alt = Number(document.getElementById('mountFlightAltitudeInput')?.value) || 50;
        const gOffsetY = Number(document.getElementById('mountGroundOffsetYInput')?.value) || 0;
        const rOffsetY = Number(document.getElementById('mountRiderOffsetYInput')?.value) || -45;

        // 1. Sombra projetada no chão
        ctx.beginPath();
        const shadowScale = Math.max(16, 42 - alt * 0.12);
        ctx.ellipse(cx, cy, shadowScale, shadowScale * 0.38, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
        ctx.fill();

        // 2. Linha guia vertical de altitude
        ctx.beginPath();
        ctx.setLineDash([3, 3]);
        ctx.moveTo(cx, cy);
        const mountY = cy - alt * 0.65 + gOffsetY;
        ctx.lineTo(cx, mountY);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
        ctx.stroke();
        ctx.setLineDash([]);

        // 3. Renderiza Sprite 2.5D da Montaria
        if (this.mountPreviewSheet) {
          this.mountPreviewSheet.draw(ctx, cx, mountY, this.mountPreviewAction, this.mountPreviewDir, now, null, 0, 0.65);
        }

        // 4. Indicador visual da âncora do Cavaleiro (Rider Mount Point)
        const riderY = mountY + rOffsetY * 0.65;
        ctx.beginPath();
        ctx.arc(cx, riderY, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = '#38bdf8';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.font = '10px sans-serif';
        ctx.fillStyle = '#bae6fd';
        ctx.textAlign = 'center';
        ctx.fillText('👤 Cavaleiro', cx, riderY - 8);

        this.mountPreviewAnimFrame = requestAnimationFrame(animate);
      };

      this.mountPreviewAnimFrame = requestAnimationFrame(animate);
    };

    app.stopMountCanvasPreview = function () {
      if (this.mountPreviewAnimFrame) {
        cancelAnimationFrame(this.mountPreviewAnimFrame);
        this.mountPreviewAnimFrame = null;
      }
    };

    app.renderMountGallery = function () {
      const grid = document.getElementById('mcreworkMountsGrid');
      if (!grid) return;

      const q = (this.mountGallerySearchQuery || '').toLowerCase();
      const filtered = (this.mcreworkMounts || []).filter((m) => {
        if (!q) return true;
        return (m.name && m.name.toLowerCase().includes(q)) ||
               (m.mcreworkMountKey && m.mcreworkMountKey.toLowerCase().includes(q));
      });

      grid.innerHTML = filtered.map((m) => {
        const isSelected = m.mcreworkMountKey === this.selectedMcreworkMountKey;
        return `
          <div onclick="AdminApp.selectMcreworkMount('${m.mcreworkMountKey}')"
               style="border:2px solid ${isSelected ? '#38bdf8' : '#334155'}; background:${isSelected ? 'rgba(56,189,248,0.15)' : 'rgba(15,23,42,0.85)'};
                      border-radius:8px; padding:6px; cursor:pointer; text-align:center; transition:all 0.15s ease;">
            <img src="${m.thumbUrl}" alt="${m.name}" style="width:58px; height:58px; object-fit:contain; border-radius:6px; background:#0f172a; margin-bottom:4px;" onerror="this.src='/play/assets/placeholder_pet.png'" />
            <div style="font-weight:700; font-size:0.75rem; color:#f8fafc; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${m.name}</div>
            <div style="font-size:0.68rem; color:#94a3b8;">${m.mcreworkMountKey}</div>
            <span style="display:inline-block; margin-top:2px; font-size:0.65rem; background:#1e293b; color:#fbbf24; padding:1px 5px; border-radius:4px;">Tier ${m.tier || 1}</span>
          </div>
        `;
      }).join('');
    };

    app.saveFlyingMountTemplate = async function () {
      const editId = document.getElementById('mountEditIdInput').value;
      const namePtBr = document.getElementById('mountNameInput').value.trim();
      const code = document.getElementById('mountCodeInput').value.trim();
      const descriptionPtBr = document.getElementById('mountDescriptionInput').value.trim();
      const mountType = document.getElementById('mountTypeSelect').value;
      const tier = parseInt(document.getElementById('mountTierSelect').value, 10) || 1;
      const rarityTier = document.getElementById('mountRaritySelect').value;
      const speedBonusPct = parseFloat(document.getElementById('mountSpeedBonusInput').value) || 30;
      const flightAltitude = parseInt(document.getElementById('mountFlightAltitudeInput').value, 10) || 50;
      const staminaMax = parseInt(document.getElementById('mountStaminaMaxInput').value, 10) || 200;
      const groundOffsetY = parseInt(document.getElementById('mountGroundOffsetYInput').value, 10) || 0;
      const riderOffsetY = parseInt(document.getElementById('mountRiderOffsetYInput').value, 10) || -45;
      const requiredLevel = parseInt(document.getElementById('mountReqLevelInput').value, 10) || 1;
      const priceGold = parseInt(document.getElementById('mountPriceInput').value, 10) || 0;
      const isActive = document.getElementById('mountActiveSelect').value === 'true';
      const mcreworkMountKey = document.getElementById('mountAssetKeyInput').value.trim();

      if (!namePtBr) {
        alert('Por favor, informe o nome da montaria voadora em português.');
        return;
      }

      const baseAttributesJson = {};
      ['VIT', 'STR', 'INT', 'WIS', 'AGI', 'DEX'].forEach((attr) => {
        baseAttributesJson[attr] = parseInt(document.getElementById(`mountBase${attr}Input`).value, 10) || 0;
      });

      const combatAttributesJson = {
        BATTLE_MOVE_SPEED: parseFloat(document.getElementById('mountCombatMoveSpeedInput').value) || 20,
        ATTACK_SPEED: parseFloat(document.getElementById('mountCombatAttackSpeedInput').value) || 0.05,
        PHYS_ACCURACY: parseFloat(document.getElementById('mountCombatPhysAccInput').value) || 5,
        PHYS_EVASION: parseFloat(document.getElementById('mountCombatPhysEvaInput').value) || 5,
        MAG_ACCURACY: parseFloat(document.getElementById('mountCombatMagAccInput').value) || 5,
        MAG_EVASION: parseFloat(document.getElementById('mountCombatMagEvaInput').value) || 5,
        PDEF: parseFloat(document.getElementById('mountCombatPdefInput').value) || 25,
        MDEF: parseFloat(document.getElementById('mountCombatMdefInput').value) || 25,
      };

      const payload = {
        code: code || undefined,
        namePtBr,
        descriptionPtBr,
        mcreworkMountKey,
        mountType,
        tier,
        rarityTier,
        speedBonusPct,
        flightAltitude,
        staminaMax,
        groundOffsetY,
        riderOffsetY,
        requiredLevel,
        priceGold,
        isActive,
        baseAttributesJson,
        combatAttributesJson,
      };

      try {
        if (editId) {
          await this.api(`/api/admin/flying-mounts/${editId}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          });
        } else {
          await this.api('/api/admin/flying-mounts', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
        }
        this.stopMountCanvasPreview();
        document.getElementById('flyingMountModal').style.display = 'none';
        await this.loadFlyingMountTemplates();
      } catch (err) {
        alert(`Erro ao salvar Montaria Voadora: ${err.message}`);
      }
    };

    app.deleteFlyingMountTemplate = async function (id, name) {
      if (!confirm(`Deseja realmente excluir a montaria "${name}" (#${id})?`)) return;
      try {
        await this.api(`/api/admin/flying-mounts/${id}`, { method: 'DELETE' });
        await this.loadFlyingMountTemplates();
      } catch (err) {
        alert(`Erro ao excluir Montaria Voadora: ${err.message}`);
      }
    };

    app.renderFlyingMountsCrudTable = function () {
      const container = document.getElementById('mountsTableContainer');
      if (!container) return;

      const q = (this.mountSearchQuery || '').toLowerCase();
      const tF = this.mountTypeFilter || 'ALL';
      const trF = this.mountTierFilter || 'ALL';
      const rF = this.mountRarityFilter || 'ALL';

      const filtered = (this.flyingMountTemplates || []).filter((m) => {
        if (tF !== 'ALL' && m.mountType !== tF) return false;
        if (trF !== 'ALL' && String(m.tier) !== trF) return false;
        if (rF !== 'ALL' && m.rarityTier !== rF) return false;
        if (!q) return true;
        return (m.namePtBr && m.namePtBr.toLowerCase().includes(q)) ||
               (m.code && m.code.toLowerCase().includes(q)) ||
               (m.mcreworkMountKey && m.mcreworkMountKey.toLowerCase().includes(q));
      });

      const countBadge = document.getElementById('mountsCounterBadge');
      if (countBadge) countBadge.textContent = `${filtered.length} de ${this.flyingMountTemplates.length} montarias cadastradas`;

      if (filtered.length === 0) {
        container.innerHTML = `
          <div style="text-align:center; padding:36px 12px; color:var(--text-muted);">
            🦅 Nenhuma montaria encontrada com os filtros atuais. Clique em <strong>➕ Nova Montaria Voadora</strong> para cadastrar!
          </div>
        `;
        return;
      }

      const rarityColors = { SS: '#fbbf24', S: '#c084fc', A: '#38bdf8', B: '#4ade80', C: '#fde047', D: '#cbd5e1', F: '#94a3b8', COMMON: '#94a3b8' };
      const typeLabels = {
        FLYING: '<span style="background:#0284c7; color:#fff; padding:2px 8px; border-radius:4px; font-size:0.75rem;">🦅 Voadora</span>',
        DIVINE: '<span style="background:#eab308; color:#0f172a; font-weight:700; padding:2px 8px; border-radius:4px; font-size:0.75rem;">👑 Divina</span>',
        MYTHIC: '<span style="background:#9333ea; color:#fff; padding:2px 8px; border-radius:4px; font-size:0.75rem;">🐉 Mítica</span>',
        GLIDER: '<span style="background:#14b8a6; color:#fff; padding:2px 8px; border-radius:4px; font-size:0.75rem;">🪂 Planador</span>',
      };

      container.innerHTML = `
        <table class="data-table" style="width:100%; border-collapse:collapse; font-size:0.83rem;">
          <thead>
            <tr style="border-bottom:1px solid var(--border); text-align:left; color:#94a3b8;">
              <th style="padding:10px;">Miniatura</th>
              <th style="padding:10px;">Nome & Código</th>
              <th style="padding:10px;">Tipo & Tier</th>
              <th style="padding:10px;">Raridade</th>
              <th style="padding:10px;">Desempenho Voo</th>
              <th style="padding:10px;">Offsets 2.5D</th>
              <th style="padding:10px;">Nível / Preço</th>
              <th style="padding:10px;">Bônus Atributos</th>
              <th style="padding:10px;">Status</th>
              <th style="padding:10px; text-align:right;">Ações</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map((mount) => {
              const rColor = rarityColors[mount.rarityTier] || '#94a3b8';
              const b = mount.baseAttributesJson || {};
              const cb = mount.combatAttributesJson || {};
              return `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.05); transition:background 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background='transparent'">
                  <td style="padding:8px 10px;">
                    <div style="position:relative; width:48px; height:48px; display:inline-block;">
                      <img src="${mount.thumbUrl}" alt="${mount.namePtBr}" style="width:48px; height:48px; object-fit:contain; border-radius:8px; background:#0f172a; border:1px solid #334155;" onerror="this.src='/play/assets/placeholder_pet.png'" />
                      <span style="position:absolute; bottom:-4px; right:-4px; font-size:0.65rem; background:rgba(2,132,199,0.9); color:#fff; padding:1px 4px; border-radius:3px;">✈️ ${mount.flightAltitude}px</span>
                    </div>
                  </td>
                  <td style="padding:8px 10px;">
                    <strong style="color:#f8fafc; font-size:0.88rem;">${mount.namePtBr}</strong>
                    <div style="color:#64748b; font-size:0.75rem;">${mount.code}</div>
                    <div style="color:#38bdf8; font-size:0.72rem;">${mount.mcreworkMountKey || '-'}</div>
                  </td>
                  <td style="padding:8px 10px;">
                    <div>${typeLabels[mount.mountType] || mount.mountType}</div>
                    <div style="color:#fbbf24; font-size:0.75rem; margin-top:2px;">⭐ Tier ${mount.tier}</div>
                  </td>
                  <td style="padding:8px 10px;">
                    <span style="color:${rColor}; font-weight:700; border:1px solid ${rColor}; padding:2px 6px; border-radius:4px; font-size:0.75rem; background:rgba(255,255,255,0.04);">${mount.rarityTier}</span>
                  </td>
                  <td style="padding:8px 10px; font-size:0.78rem;">
                    <div style="color:#4ade80;">🚀 +${mount.speedBonusPct}% Vel. Mapa</div>
                    <div style="color:#38bdf8;">☁️ ${mount.flightAltitude}px Altitude</div>
                    <div style="color:#fbbf24;">⚡ ${mount.staminaMax} Stamina</div>
                  </td>
                  <td style="padding:8px 10px; font-size:0.75rem; color:#94a3b8;">
                    <div>Solo: <strong style="color:#cbd5e1;">${mount.groundOffsetY >= 0 ? '+' : ''}${mount.groundOffsetY}px</strong></div>
                    <div>Montador: <strong style="color:#38bdf8;">${mount.riderOffsetY}px</strong></div>
                  </td>
                  <td style="padding:8px 10px; font-size:0.78rem;">
                    <div>Nível <strong>${mount.requiredLevel}</strong></div>
                    <div style="color:#fbbf24;">🪙 ${mount.priceGold.toLocaleString('pt-BR')} Ouro</div>
                  </td>
                  <td style="padding:8px 10px; font-size:0.74rem; color:#cbd5e1; max-width:180px;">
                    <div>VIT+${b.VIT || 0} STR+${b.STR || 0} AGI+${b.AGI || 0}</div>
                    <div style="color:#38bdf8;">MovBatalha +${cb.BATTLE_MOVE_SPEED || 0}px/s | Aspd +${cb.ATTACK_SPEED || 0}</div>
                  </td>
                  <td style="padding:8px 10px;">
                    <span style="background:${mount.isActive ? '#16a34a' : '#dc2626'}; color:#fff; padding:2px 8px; border-radius:4px; font-size:0.75rem;">
                      ${mount.isActive ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td style="padding:8px 10px; text-align:right;">
                    <button class="btn-primary" style="padding:4px 8px; font-size:0.75rem; margin-right:4px;" onclick="AdminApp.openEditFlyingMountModal(${mount.id})">✏️ Editar</button>
                    <button class="btn-danger" style="padding:4px 8px; font-size:0.75rem;" onclick="AdminApp.deleteFlyingMountTemplate(${mount.id}, '${mount.namePtBr.replace(/'/g, "\\'")}')">🗑️</button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
    };
  }

  static injectTabAndModalDom() {
    // 1. Injeta Botão da Aba na Barra de Navegação (#tabBtnFlyingMounts) após tabBtnItems
    const navTabs = document.querySelector('.nav-tabs');
    if (navTabs && !document.getElementById('tabBtnFlyingMounts')) {
      const btn = document.createElement('button');
      btn.id = 'tabBtnFlyingMounts';
      btn.textContent = '🦅 Montarias Voadoras';
      btn.onclick = () => AdminApp.switchTab('mounts');

      const btnItems = document.getElementById('tabBtnItems');
      if (btnItems && btnItems.nextSibling) {
        navTabs.insertBefore(btn, btnItems.nextSibling);
      } else {
        navTabs.appendChild(btn);
      }
    }

    // 2. Injeta Painel da Aba (#tabFlyingMounts) dentro de #adminApp
    const adminApp = document.getElementById('adminApp');
    if (adminApp && !document.getElementById('tabFlyingMounts')) {
      const panel = document.createElement('div');
      panel.id = 'tabFlyingMounts';
      panel.style.display = 'none';
      panel.style.flexDirection = 'column';
      panel.style.gap = '14px';

      panel.innerHTML = `
        <div class="panel">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
            <div>
              <h3 style="margin:0; color:#38bdf8;">🦅 Catálogo de Montarias Voadoras & Criaturas Aéreas</h3>
              <p style="font-size:0.8rem; color:var(--text-muted); margin:4px 0 0;">
                Gerencie montarias voadoras, divinas e planadores com bônus de velocidade de voo, altitude, fôlego/stamina e bônus de atributos.
              </p>
            </div>
            <div style="display:flex; gap:8px; align-items:center;">
              <span id="mountsCounterBadge" style="font-size:0.8rem; color:var(--text-muted);"></span>
              <button class="btn-primary" onclick="AdminApp.openCreateFlyingMountModal()">➕ Nova Montaria Voadora</button>
            </div>
          </div>
          <!-- Filtros e Busca -->
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:10px; margin-top:14px; padding-bottom:12px; border-bottom:1px solid var(--border);">
            <div class="field">
              <label>🔍 Buscar por Nome/Código/Key</label>
              <input type="text" id="mountSearchInput" placeholder="Ex: Dragão, Leão, mount_..." oninput="AdminApp.filterFlyingMountsCrudTable()" />
            </div>
            <div class="field">
              <label>Tipo de Montaria</label>
              <select id="mountTypeFilterSelect" onchange="AdminApp.filterFlyingMountsCrudTable()">
                <option value="ALL">Todos os Tipos</option>
                <option value="FLYING">🦅 Voadora (Pássaros, Grifos)</option>
                <option value="DIVINE">👑 Divina (Leões Alados, Anjos)</option>
                <option value="MYTHIC">🐉 Mítica (Dragões Ancestrais)</option>
                <option value="GLIDER">🪂 Planador (Asas, Máquinas)</option>
              </select>
            </div>
            <div class="field">
              <label>Tier da Montaria</label>
              <select id="mountTierFilterSelect" onchange="AdminApp.filterFlyingMountsCrudTable()">
                <option value="ALL">Todos os Tiers</option>
                ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((t) => `<option value="${t}">Tier ${t}</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label>Raridade</label>
              <select id="mountRarityFilterSelect" onchange="AdminApp.filterFlyingMountsCrudTable()">
                <option value="ALL">Todas as Raridades</option>
                <option value="SS">SS (Mítico)</option>
                <option value="S">S (Lendário)</option>
                <option value="A">A (Épico)</option>
                <option value="B">B (Raro)</option>
                <option value="C">C (Incomum)</option>
                <option value="COMMON">COMMON (Comum)</option>
              </select>
            </div>
          </div>
          <div id="mountsTableContainer" style="overflow-x:auto; margin-top:12px;"></div>
        </div>
      `;
      const tabItems = document.getElementById('tabItems');
      if (tabItems && tabItems.nextSibling) {
        adminApp.insertBefore(panel, tabItems.nextSibling);
      } else {
        adminApp.appendChild(panel);
      }
    }

    // 3. Injeta Modal (#flyingMountModal) no body
    if (document.getElementById('flyingMountModal')) return;

    const modal = document.createElement('div');
    modal.id = 'flyingMountModal';
    modal.className = 'modal-backdrop';
    modal.style.display = 'none';

    modal.innerHTML = `
      <div class="modal-box" style="max-width:1150px; width:96%; max-height:94vh; display:block; overflow-y:auto; -webkit-overflow-scrolling:touch; padding:16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:10px; margin-bottom:12px;">
          <h3 id="mountModalTitle" style="color:#38bdf8; margin:0; font-size:1.05rem;">🦅 Cadastrar / Editar Montaria Voadora</h3>
          <div style="display:flex; gap:8px;">
            <button class="btn-success" onclick="AdminApp.saveFlyingMountTemplate()" style="padding:6px 14px; font-weight:700;">💾 Salvar</button>
            <button class="btn-danger" onclick="AdminApp.stopMountCanvasPreview(); AdminApp.closeModal('flyingMountModal')" style="padding:6px 10px;">✕</button>
          </div>
        </div>

        <input type="hidden" id="mountEditIdInput" value="" />
        <input type="hidden" id="mountAssetKeyInput" value="" />

        <div style="display:grid; grid-template-columns:1fr 340px; gap:16px; align-items:start;">
          <!-- COLUNA ESQUERDA: FORMULÁRIO -->
          <div>
            <!-- BLOCO 1: IDENTIFICAÇÃO & TIPO -->
            <div style="background:rgba(15,23,42,0.75); border:1px solid #334155; border-radius:10px; padding:12px; margin-bottom:12px;">
              <div style="font-size:0.80rem; font-weight:700; color:#38bdf8; margin-bottom:8px;">1️⃣ Identidade & Tipo de Montaria</div>
              <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(170px, 1fr)); gap:10px;">
                <div class="field">
                  <label>Nome da Montaria (PT-BR) *</label>
                  <input type="text" id="mountNameInput" placeholder="Ex: Dragão Sagrado Soberano" />
                </div>
                <div class="field">
                  <label>Código Único (opcional)</label>
                  <input type="text" id="mountCodeInput" placeholder="Auto-gerado se vazio" />
                </div>
                <div class="field">
                  <label>Tipo de Montaria *</label>
                  <select id="mountTypeSelect">
                    <option value="FLYING">🦅 Voadora (Pássaros, Grifos)</option>
                    <option value="DIVINE">👑 Divina (Leões Dragão, Sagrados)</option>
                    <option value="MYTHIC">🐉 Mítica (Dragões Ancestrais)</option>
                    <option value="GLIDER">🪂 Planador (Mecânico, Asas)</option>
                  </select>
                </div>
                <div class="field">
                  <label>Tier (Evolução 1 a 10) *</label>
                  <select id="mountTierSelect">
                    ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((t) => `<option value="${t}">Tier ${t}</option>`).join('')}
                  </select>
                </div>
                <div class="field">
                  <label>Raridade *</label>
                  <select id="mountRaritySelect">
                    <option value="COMMON">COMMON (Comum)</option>
                    <option value="C">C (Incomum)</option>
                    <option value="B">B (Raro)</option>
                    <option value="A">A (Épico)</option>
                    <option value="S">S (Lendário)</option>
                    <option value="SS">SS (Mítico)</option>
                  </select>
                </div>
                <div class="field">
                  <label>Status de Publicação</label>
                  <select id="mountActiveSelect">
                    <option value="true">✅ Ativo no Jogo</option>
                    <option value="false">❌ Inativo / Oculto</option>
                  </select>
                </div>
              </div>
              <div class="field" style="margin-top:8px;">
                <label>Descrição e Lore (PT-BR)</label>
                <input type="text" id="mountDescriptionInput" placeholder="Ex: Criatura majestosa que corta os céus de Etheria com asas flamejantes..." />
              </div>
            </div>

            <!-- BLOCO 2: PARÂMETROS DE VOO & CALIBRAÇÃO 2.5D -->
            <div style="background:rgba(15,23,42,0.75); border:1px solid #334155; border-radius:10px; padding:12px; margin-bottom:12px;">
              <div style="font-size:0.80rem; font-weight:700; color:#38bdf8; margin-bottom:8px;">2️⃣ Parâmetros de Voo & Calibração Espacial 2.5D</div>
              <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:10px;">
                <div class="field">
                  <label>Bônus Vel. Mapa (%)</label>
                  <input type="number" id="mountSpeedBonusInput" min="0" max="250" value="30" />
                </div>
                <div class="field">
                  <label>Altitude de Voo (px)</label>
                  <input type="number" id="mountFlightAltitudeInput" min="10" max="150" value="50" oninput="AdminApp.initMountCanvasPreview(AdminApp.selectedMcreworkMountKey)" />
                </div>
                <div class="field">
                  <label>Fôlego / Stamina Máx</label>
                  <input type="number" id="mountStaminaMaxInput" min="50" max="2000" value="200" />
                </div>
                <div class="field">
                  <label>Nível Requerido</label>
                  <input type="number" id="mountReqLevelInput" min="1" max="100" value="1" />
                </div>
                <div class="field">
                  <label>Preço em Ouro (🪙)</label>
                  <input type="number" id="mountPriceInput" min="0" value="500" />
                </div>
              </div>
              <!-- Calibração de Offsets com botões de ajuste fino -->
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.08);">
                <div class="field">
                  <label style="display:flex; justify-content:space-between;">
                    <span>Calibração Solo (groundOffsetY)</span>
                    <span id="mountGroundOffsetBadge" style="color:#38bdf8; font-weight:700;">0px</span>
                  </label>
                  <div style="display:flex; gap:4px; align-items:center;">
                    <button type="button" onclick="AdminApp.adjustMountGroundOffset(-5)" style="padding:4px 8px;">-5</button>
                    <input type="number" id="mountGroundOffsetYInput" value="0" style="text-align:center;" oninput="AdminApp.updateMountOffsetsPreview()" />
                    <button type="button" onclick="AdminApp.adjustMountGroundOffset(5)" style="padding:4px 8px;">+5</button>
                  </div>
                </div>
                <div class="field">
                  <label style="display:flex; justify-content:space-between;">
                    <span>Ponto Montador (riderOffsetY)</span>
                    <span id="mountRiderOffsetBadge" style="color:#38bdf8; font-weight:700;">-45px</span>
                  </label>
                  <div style="display:flex; gap:4px; align-items:center;">
                    <button type="button" onclick="AdminApp.adjustMountRiderOffset(-5)" style="padding:4px 8px;">-5</button>
                    <input type="number" id="mountRiderOffsetYInput" value="-45" style="text-align:center;" oninput="AdminApp.updateMountOffsetsPreview()" />
                    <button type="button" onclick="AdminApp.adjustMountRiderOffset(5)" style="padding:4px 8px;">+5</button>
                  </div>
                </div>
              </div>
            </div>

            <!-- BLOCO 3: ATRIBUTOS BASE & COMBATE -->
            <div style="background:rgba(15,23,42,0.75); border:1px solid #334155; border-radius:10px; padding:12px; margin-bottom:12px;">
              <div style="font-size:0.80rem; font-weight:700; color:#38bdf8; margin-bottom:8px;">3️⃣ Bônus de Atributos Base & Combate da Arena</div>
              <div style="display:grid; grid-template-columns:repeat(6, 1fr); gap:6px; margin-bottom:10px;">
                ${['VIT', 'STR', 'INT', 'WIS', 'AGI', 'DEX'].map((attr) => `
                  <div class="field" style="margin:0;">
                    <label style="font-size:0.72rem; text-align:center;">${attr}</label>
                    <input type="number" id="mountBase${attr}Input" value="5" style="text-align:center; padding:4px;" />
                  </div>
                `).join('')}
              </div>
              <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:8px;">
                <div class="field"><label>Vel. Mov. Batalha (px/s)</label><input type="number" id="mountCombatMoveSpeedInput" value="20" /></div>
                <div class="field"><label>Vel. Ataque (Aspd)</label><input type="number" step="0.01" id="mountCombatAttackSpeedInput" value="0.05" /></div>
                <div class="field"><label>Precisão Física (%)</label><input type="number" id="mountCombatPhysAccInput" value="5" /></div>
                <div class="field"><label>Desvio Físico (%)</label><input type="number" id="mountCombatPhysEvaInput" value="5" /></div>
                <div class="field"><label>Precisão Mágica (%)</label><input type="number" id="mountCombatMagAccInput" value="5" /></div>
                <div class="field"><label>Desvio Mágico (%)</label><input type="number" id="mountCombatMagEvaInput" value="5" /></div>
                <div class="field"><label>Defesa Física (PDEF)</label><input type="number" id="mountCombatPdefInput" value="25" /></div>
                <div class="field"><label>Defesa Mágica (MDEF)</label><input type="number" id="mountCombatMdefInput" value="25" /></div>
              </div>
            </div>
          </div>

          <!-- COLUNA DIREITA: PALCO 2.5D & GALERIA MCREWORK -->
          <div>
            <!-- PALCO CANVAS 2.5D AO VIVO -->
            <div style="background:rgba(15,23,42,0.9); border:1px solid #38bdf8; border-radius:10px; padding:10px; margin-bottom:12px; text-align:center;">
              <div style="font-size:0.75rem; font-weight:700; color:#38bdf8; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
                <span>🎮 Palco de Teste 2.5D</span>
                <span id="mountPreviewDirLabel" style="color:#94a3b8; font-size:0.70rem;">Sul (S)</span>
              </div>
              <canvas id="mountPreviewCanvas" width="310" height="220" style="background:#0b1120; border-radius:8px; border:1px solid #1e293b; width:100%; max-width:310px; display:block; margin:0 auto;"></canvas>
              <!-- Controles Direcionais e Ação -->
              <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; gap:6px;">
                <button type="button" onclick="AdminApp.rotateMountPreviewDir(-1)" style="flex:1; font-size:0.75rem; padding:4px;">◀ Girar</button>
                <div style="display:flex; gap:4px;">
                  <button type="button" id="btnMountActIdle" class="btn-primary" onclick="AdminApp.setMountPreviewAction(0)" style="font-size:0.72rem; padding:4px 8px;">Parado</button>
                  <button type="button" id="btnMountActMove" onclick="AdminApp.setMountPreviewAction(1)" style="font-size:0.72rem; padding:4px 8px;">Voar</button>
                </div>
                <button type="button" onclick="AdminApp.rotateMountPreviewDir(1)" style="flex:1; font-size:0.75rem; padding:4px;">Girar ▶</button>
              </div>
            </div>

            <!-- GALERIA MCREWORK (20 MONTARIAS OFICIAIS) -->
            <div style="background:rgba(15,23,42,0.75); border:1px solid #334155; border-radius:10px; padding:10px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <span style="font-size:0.75rem; font-weight:700; color:#cbd5e1;">🦅 Galeria mcrework (20)</span>
              </div>
              <input type="text" id="mountGallerySearchInput" placeholder="🔍 Filtrar montaria..." oninput="AdminApp.filterMountGallery()" style="width:100%; font-size:0.75rem; padding:4px 8px; margin-bottom:8px;" />
              <div id="mcreworkMountsGrid" style="display:grid; grid-template-columns:repeat(2, 1fr); gap:6px; max-height:260px; overflow-y:auto; -webkit-overflow-scrolling:touch; padding-right:2px;"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  }
}

window.AdminFlyingMountsTab = AdminFlyingMountsTab;
