/**
 * @file apps/server/public/admin/js/AdminArenaPreview.js
 * @module @etheria/server
 * @description Simulador de Arena de Batalha 2.5D Realista para o Modo Visual de Habilidades (`skill_templates`)
 *   e Buffs/Debuffs (`status_effect_templates`) na Rota `/admin`.
 *   Posiciona os modelos 2.5D reais cadastrados nas tabelas de Personagens (`class_templates`) e Monstros
 *   (`monster_templates`) frente a frente na Arena (1x1 ou Formação 1x3) e executa a coreografia real da
 *   habilidade: avanço físico ou conjuração à distância, animação de golpe/magia, reprodução do Efeito
 *   Especial (VFX) no(s) alvo(s) conforme o alcance, reação de dano (Hit), números flutuantes e ícone de
 *   Buff/Debuff na cabeça do alvo.
 */

class AdminArenaPreview {
  static attach(app) {
    app.arenaPreviewUnitSprites = new Map();
    app.arenaPreviewIconImages = new Map();
    app.arenaPreviewCycleStartMs = performance.now();
    app.arenaPreviewFormationCount = 1; // 1 ou 3 alvos na formação

    app.getOrCreateArenaUnitSprite = function (unitDescriptor) {
      if (!unitDescriptor || typeof window.McreworkSpriteSheet !== 'function') return null;
      const cacheKey = `${unitDescriptor.kind}_${unitDescriptor.assetKey}`;
      if (this.arenaPreviewUnitSprites.has(cacheKey)) {
        return this.arenaPreviewUnitSprites.get(cacheKey);
      }
      const sprite = new window.McreworkSpriteSheet(
        unitDescriptor.atlasJsonUrl,
        unitDescriptor.atlasWebpUrl,
        unitDescriptor.thumbUrl
      );
      sprite.load();
      this.arenaPreviewUnitSprites.set(cacheKey, sprite);
      return sprite;
    };

    app.getOrCreateArenaIconImage = function (iconUrl) {
      if (!iconUrl) return null;
      if (this.arenaPreviewIconImages.has(iconUrl)) {
        return this.arenaPreviewIconImages.get(iconUrl);
      }
      const entry = { ready: false, img: null };
      this.arenaPreviewIconImages.set(iconUrl, entry);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        entry.img = img;
        entry.ready = true;
      };
      img.src = iconUrl;
      return entry;
    };

    app.ensureArenaPreviewUnitsLoaded = async function () {
      if ((!this.monsterTemplates || this.monsterTemplates.length === 0) && typeof this.loadMonsterTemplates === 'function') {
        await this.loadMonsterTemplates();
      }
      this.populateArenaPreviewSelects();
    };

    app.buildArenaUnitOptionsHtml = function (preferMonstersFirst = false) {
      const classes = this.classTemplates || [];
      const monsters = this.monsterTemplates || [];

      const classOpts = classes
        .map((c) => `<option value="class:${c.id}">🦸 [Personagem #${c.id}] ${c.namePtBr}</option>`)
        .join('');
      const monsterOpts = monsters
        .map((m) => `<option value="monster:${m.id}">🐉 [Monstro #${m.id}] ${m.namePtBr} (Rank ${m.rarityTier || 'F'})</option>`)
        .join('');

      if (preferMonstersFirst) {
        return `
          <optgroup label="🐉 Monstros Cadastrados (${monsters.length})">${monsterOpts}</optgroup>
          <optgroup label="🦸 Personagens Cadastrados (${classes.length})">${classOpts}</optgroup>
        `;
      }
      return `
        <optgroup label="🦸 Personagens Cadastrados (${classes.length})">${classOpts}</optgroup>
        <optgroup label="🐉 Monstros Cadastrados (${monsters.length})">${monsterOpts}</optgroup>
      `;
    };

    app.populateArenaPreviewSelects = function () {
      const casterSelectIds = ['skillArenaCasterSelect', 'statusArenaCasterSelect'];
      const targetSelectIds = ['skillArenaTargetSelect', 'statusArenaTargetSelect'];

      const defaultCasterVal = this.classTemplates?.[0]
        ? `class:${this.classTemplates[0].id}`
        : this.monsterTemplates?.[0]
        ? `monster:${this.monsterTemplates[0].id}`
        : '';

      const defaultTargetVal = this.monsterTemplates?.[0]
        ? `monster:${this.monsterTemplates[0].id}`
        : this.classTemplates?.[0]
        ? `class:${this.classTemplates[0].id}`
        : '';

      for (const id of casterSelectIds) {
        const el = document.getElementById(id);
        if (!el) continue;
        const prev = el.value;
        el.innerHTML = this.buildArenaUnitOptionsHtml(false);
        el.value = prev && el.querySelector(`option[value="${prev}"]`) ? prev : defaultCasterVal;
      }

      for (const id of targetSelectIds) {
        const el = document.getElementById(id);
        if (!el) continue;
        const prev = el.value;
        el.innerHTML = this.buildArenaUnitOptionsHtml(true);
        el.value = prev && el.querySelector(`option[value="${prev}"]`) ? prev : defaultTargetVal;
      }
    };

    app.resolveArenaUnitDescriptor = function (selectValue, fallbackIsMonster = false) {
      const baseUrl = 'https://seytanir.github.io/mcrework';
      if (selectValue && selectValue.startsWith('monster:')) {
        const id = Number(selectValue.split(':')[1]);
        const m = (this.monsterTemplates || []).find((x) => Number(x.id) === id) || this.monsterTemplates?.[0];
        if (m) {
          return {
            kind: 'monster',
            id: m.id,
            namePtBr: m.namePtBr || m.code,
            assetKey: m.mcreworkMonsterKey,
            atlasJsonUrl: m.atlasJsonUrl || `${baseUrl}/assets/monsters/${m.mcreworkMonsterKey}/atlas.json`,
            atlasWebpUrl: m.atlasWebpUrl || `${baseUrl}/assets/monsters/${m.mcreworkMonsterKey}/atlas.webp`,
            thumbUrl: m.thumbUrl || `${baseUrl}/assets/monsters/${m.mcreworkMonsterKey}/thumb.webp`,
            groundOffsetY: Number(m.groundOffsetY) || 0,
            shadowOffsetX: 0,
            shadowOffsetY: 0,
          };
        }
      }

      if (selectValue && selectValue.startsWith('class:')) {
        const id = Number(selectValue.split(':')[1]);
        const c = (this.classTemplates || []).find((x) => Number(x.id) === id) || this.classTemplates?.[0];
        if (c) {
          return {
            kind: 'class',
            id: c.id,
            namePtBr: c.namePtBr || c.code,
            assetKey: c.mcreworkCharKey,
            atlasJsonUrl: c.atlasJsonUrl || `${baseUrl}/assets/characters/${c.mcreworkCharKey}/atlas.json`,
            atlasWebpUrl: c.atlasWebpUrl || `${baseUrl}/assets/characters/${c.mcreworkCharKey}/atlas.webp`,
            thumbUrl: c.thumbUrl || `${baseUrl}/assets/characters/${c.mcreworkCharKey}/thumb.webp`,
            groundOffsetY: Number(c.groundOffsetY) || 0,
            shadowOffsetX: Number(c.shadowOffsetX) || 0,
            shadowOffsetY: Number(c.shadowOffsetY) || 0,
          };
        }
      }

      if (fallbackIsMonster && this.monsterTemplates?.length > 0) {
        const m = this.monsterTemplates[0];
        return {
          kind: 'monster',
          id: m.id,
          namePtBr: m.namePtBr,
          assetKey: m.mcreworkMonsterKey,
          atlasJsonUrl: m.atlasJsonUrl,
          atlasWebpUrl: m.atlasWebpUrl,
          thumbUrl: m.thumbUrl,
          groundOffsetY: Number(m.groundOffsetY) || 0,
          shadowOffsetX: 0,
          shadowOffsetY: 0,
        };
      }

      if (this.classTemplates?.length > 0) {
        const c = this.classTemplates[0];
        return {
          kind: 'class',
          id: c.id,
          namePtBr: c.namePtBr,
          assetKey: c.mcreworkCharKey,
          atlasJsonUrl: c.atlasJsonUrl || `${baseUrl}/assets/characters/${c.mcreworkCharKey}/atlas.json`,
          atlasWebpUrl: c.atlasWebpUrl || `${baseUrl}/assets/characters/${c.mcreworkCharKey}/atlas.webp`,
          thumbUrl: c.thumbUrl,
          groundOffsetY: Number(c.groundOffsetY) || 0,
          shadowOffsetX: Number(c.shadowOffsetX) || 0,
          shadowOffsetY: Number(c.shadowOffsetY) || 0,
        };
      }

      return null;
    };

    app.triggerArenaPreviewNow = function () {
      this.arenaPreviewCycleStartMs = performance.now();
    };

    app.startVfxPreviewCanvasLoop = function (canvasId, getVfxKeyFn, getOverheadIconUrlFn) {
      if (this.vfxPreviewAnimFrame) {
        cancelAnimationFrame(this.vfxPreviewAnimFrame);
      }
      this.ensureArenaPreviewUnitsLoaded();
      if (typeof this.ensureClassPreviewMapLoaded === 'function') {
        this.ensureClassPreviewMapLoaded();
      }
      this.arenaPreviewCycleStartMs = performance.now();

      const isSkillModal = canvasId === 'skillVfxPreviewCanvas';
      const casterSelectId = isSkillModal ? 'skillArenaCasterSelect' : 'statusArenaCasterSelect';
      const targetSelectId = isSkillModal ? 'skillArenaTargetSelect' : 'statusArenaTargetSelect';
      const formationSelectId = isSkillModal ? 'skillArenaFormationSelect' : 'statusArenaFormationSelect';

      const drawSlotPlatform = (ctx, x, y, isAlly, isHighlighted) => {
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(x, y, 30, 12, 0, 0, Math.PI * 2);
        ctx.fillStyle = isAlly ? 'rgba(14, 165, 233, 0.22)' : 'rgba(244, 63, 94, 0.22)';
        ctx.fill();
        ctx.lineWidth = isHighlighted ? 2.2 : 1.4;
        ctx.strokeStyle = isAlly
          ? isHighlighted
            ? '#38bdf8'
            : 'rgba(56, 189, 248, 0.55)'
          : isHighlighted
          ? '#fb7185'
          : 'rgba(251, 113, 133, 0.55)';
        ctx.stroke();
        ctx.restore();
      };

      const drawUnitHudAndStatus = (ctx, x, y, name, isAlly, hpRatio, statusIconsList, now) => {
        const headY = y - 64;
        const barW = 54;
        const barH = 5;

        // Barra de HP da unidade na Arena
        ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
        ctx.fillRect(x - barW / 2 - 1, headY - 1, barW + 2, barH + 2);
        ctx.fillStyle = isAlly ? '#22c55e' : '#ef4444';
        ctx.fillRect(x - barW / 2, headY, Math.max(4, Math.round(barW * hpRatio)), barH);

        // Nome da unidade
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = isAlly ? '#7dd3fc' : '#fda4af';
        ctx.fillText(name, x, headY - 4);

        // Ícones de Buff / Debuff flutuando acima da cabeça da unidade
        if (Array.isArray(statusIconsList) && statusIconsList.length > 0) {
          const iconSize = 22;
          const totalW = statusIconsList.length * (iconSize + 4) - 4;
          let startX = x - totalW / 2;
          const bounce = Math.sin(now / 170) * 2.5;
          const iconY = Math.round(headY - 38 + bounce);

          for (const stItem of statusIconsList) {
            const icEntry = this.getOrCreateArenaIconImage(stItem.iconUrl);
            ctx.fillStyle = 'rgba(2, 6, 23, 0.92)';
            ctx.fillRect(startX - 1, iconY - 1, iconSize + 2, iconSize + 2);
            ctx.strokeStyle = stItem.isBuff ? '#4ade80' : '#f43f5e';
            ctx.lineWidth = 1.6;
            ctx.strokeRect(startX - 1, iconY - 1, iconSize + 2, iconSize + 2);
            if (icEntry && icEntry.ready && icEntry.img) {
              ctx.drawImage(icEntry.img, startX, iconY, iconSize, iconSize);
            }
            startX += iconSize + 4;
          }
        }
      };

      const step = (now) => {
        const canvas = document.getElementById(canvasId);
        if (!canvas || canvas.offsetParent === null) {
          this.vfxPreviewAnimFrame = null;
          return;
        }
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        // 1. Cenário de Fundo da Arena (Mapa #1 com vinheta tática de batalha)
        const mapImg = this.classPreviewMapImg;
        if (mapImg && mapImg.complete && mapImg.naturalWidth > 0) {
          const sx = Math.max(0, Math.min(mapImg.naturalWidth - w, (this.classPreviewMapSpawn?.x || 1000) - w / 2));
          const sy = Math.max(0, Math.min(mapImg.naturalHeight - h, (this.classPreviewMapSpawn?.y || 750) - h / 2));
          ctx.drawImage(mapImg, sx, sy, w, h, 0, 0, w, h);
          ctx.fillStyle = 'rgba(2, 6, 23, 0.45)';
          ctx.fillRect(0, 0, w, h);
        } else {
          const grad = ctx.createRadialGradient(w / 2, h * 0.65, 20, w / 2, h * 0.65, w * 0.65);
          grad.addColorStop(0, '#1e1b4b');
          grad.addColorStop(1, '#020617');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, w, h);
        }

        // 2. Resolver Conjurador (Esquerda) e Alvo(s) (Direita)
        const casterVal = document.getElementById(casterSelectId)?.value || '';
        const targetVal = document.getElementById(targetSelectId)?.value || '';
        const formationCount = Number(document.getElementById(formationSelectId)?.value) || 1;

        const casterUnit = this.resolveArenaUnitDescriptor(casterVal, false);
        const targetUnit = this.resolveArenaUnitDescriptor(targetVal, true);

        const casterSlot = { x: 105, y: 152 };
        const enemySlots =
          formationCount === 3
            ? [
                { x: 385, y: 122, labelSuffix: ' #2' },
                { x: 332, y: 152, labelSuffix: ' #1' },
                { x: 392, y: 180, labelSuffix: ' #3' },
              ]
            : [{ x: 355, y: 152, labelSuffix: '' }];

        // 3. Ler configurações atuais do modal (Skill ou Buff/Debuff)
        const cycleDuration = 2800;
        const cycleElapsed = (now - this.arenaPreviewCycleStartMs) % cycleDuration;
        const vfxKey = getVfxKeyFn ? getVfxKeyFn() : '';
        const mainIconUrl = getOverheadIconUrlFn ? getOverheadIconUrlFn() : '';

        let castMovement = 'STAND_IN_PLACE';
        let castActionId = 7;
        let targetScope = 'RANGED_ANY';
        let bannerTitle = '';
        let isSelfTarget = false;
        let isAoETarget = false;
        let appliedStatusIcons = [];
        let floatingTexts = [];

        if (isSkillModal) {
          castMovement = document.getElementById('skillCastMovementSelect')?.value || 'MELEE_ADVANCE';
          castActionId = Number(document.getElementById('skillCastActionSelect')?.value) || 3;
          targetScope = document.getElementById('skillTargetScopeSelect')?.value || 'MELEE_FRONTLINE';
          bannerTitle = document.getElementById('skillNameInput')?.value.trim() || 'Habilidade em Teste';
          isSelfTarget = targetScope === 'SELF' || targetScope === 'ALLY_SINGLE' || targetScope === 'ALLY_ALL';
          isAoETarget = targetScope === 'ALL_ENEMIES' || targetScope === 'ROW_FRONT';

          for (const blk of this.editingSkillBlocks || []) {
            if (blk.blockType === 'DAMAGE') {
              const dmgEst = Math.round((Number(blk.scalePct) || 100) * 1.2 + (Number(blk.flatAmount) || 0));
              floatingTexts.push({ text: `💥 -${dmgEst}`, color: '#fb7185', onSelf: false });
            } else if (blk.blockType === 'HEAL') {
              const healEst = Math.round((Number(blk.scalePct) || 20) * 1.5 + (Number(blk.flatAmount) || 0));
              floatingTexts.push({ text: `💚 +${healEst}`, color: '#4ade80', onSelf: Boolean(blk.targetSelf || isSelfTarget) });
            } else if (blk.blockType === 'SHIELD') {
              floatingTexts.push({ text: `🛡️ +Escudo`, color: '#38bdf8', onSelf: true });
            } else if (blk.blockType === 'STATUS') {
              const st = (this.statusEffectTemplates || []).find((s) => Number(s.id) === Number(blk.statusEffectId));
              if (st) {
                appliedStatusIcons.push({
                  iconUrl: st.iconUrl,
                  isBuff: Boolean(st.isBuff),
                  onSelf: Boolean(blk.targetSelf || isSelfTarget),
                  namePtBr: st.namePtBr,
                });
                floatingTexts.push({
                  text: `🧪 +${st.namePtBr}`,
                  color: st.isBuff ? '#86efac' : '#c084fc',
                  onSelf: Boolean(blk.targetSelf || isSelfTarget),
                });
              }
            }
          }
          if (floatingTexts.length === 0) {
            floatingTexts.push({ text: '⚡ Ativado!', color: '#fde047', onSelf: isSelfTarget });
          }
        } else {
          // Modal de Buff & Debuff
          const isBuff = document.getElementById('statusIsBuffSelect')?.value === 'true';
          bannerTitle = document.getElementById('statusNameInput')?.value.trim() || (isBuff ? 'Buff em Teste' : 'Debuff em Teste');
          const dotMode = document.getElementById('statusDotModeSelect')?.value || 'NONE';
          const dotPct = Number(document.getElementById('statusDotScalePctInput')?.value) || 10;
          const dotFlat = Number(document.getElementById('statusDotFlatInput')?.value) || 10;

          appliedStatusIcons.push({
            iconUrl: mainIconUrl,
            isBuff,
            onSelf: false,
            namePtBr: bannerTitle,
          });

          if (dotMode === 'DAMAGE') {
            floatingTexts.push({ text: `💥 -${dotPct * 8 + dotFlat} (DoT)`, color: '#fb7185', onSelf: false });
          } else if (dotMode === 'HEAL') {
            floatingTexts.push({ text: `💚 +${dotPct * 8 + dotFlat} (HoT)`, color: '#4ade80', onSelf: false });
          } else {
            const atkMod = Number(document.getElementById('statusModAtkPct')?.value) || 0;
            const defMod = Number(document.getElementById('statusModDefPct')?.value) || 0;
            const spdMod = Number(document.getElementById('statusModSpeedPct')?.value) || 0;
            const parts = [];
            if (atkMod) parts.push(`${atkMod > 0 ? '+' : ''}${atkMod}% ATK`);
            if (defMod) parts.push(`${defMod > 0 ? '+' : ''}${defMod}% DEF`);
            if (spdMod) parts.push(`${spdMod > 0 ? '+' : ''}${spdMod}% SPD`);
            floatingTexts.push({
              text: parts.length > 0 ? `🧪 ${parts.join(' ')}` : `🧪 ${bannerTitle}`,
              color: isBuff ? '#4ade80' : '#c084fc',
              onSelf: false,
            });
          }
        }

        // 4. Calcular posição e ação atual do Conjurador e dos Alvos na linha do tempo do ciclo
        const primaryEnemySlot = enemySlots[formationCount === 3 ? 1 : 0];
        let casterX = casterSlot.x;
        let casterY = casterSlot.y;
        let casterAction = 0;

        const isMeleeAdvance = isSkillModal && castMovement === 'MELEE_ADVANCE' && !isSelfTarget;
        const strikeFrontX = primaryEnemySlot.x - 56;
        const strikeFrontY = primaryEnemySlot.y;

        if (cycleElapsed < 500) {
          if (isMeleeAdvance) {
            const t = cycleElapsed / 500;
            casterX = Math.round(casterSlot.x + (strikeFrontX - casterSlot.x) * t);
            casterY = Math.round(casterSlot.y + (strikeFrontY - casterSlot.y) * t);
            casterAction = 1; // Correndo até o alvo
          } else {
            casterAction = 0;
          }
        } else if (cycleElapsed < 1450) {
          if (isMeleeAdvance) {
            casterX = strikeFrontX;
            casterY = strikeFrontY;
          }
          casterAction = castActionId; // Golpe (3), Magia (7) ou Guarda (4)
        } else if (cycleElapsed < 1900) {
          if (isMeleeAdvance) {
            const t = (cycleElapsed - 1450) / 450;
            casterX = Math.round(strikeFrontX + (casterSlot.x - strikeFrontX) * t);
            casterY = Math.round(strikeFrontY + (casterSlot.y - strikeFrontY) * t);
            casterAction = 1; // Retornando ao slot
          } else {
            casterAction = 0;
          }
        } else {
          casterAction = 0;
        }

        const isImpactWindow = cycleElapsed >= 600 && cycleElapsed <= 1550;
        const isPostImpactWindow = cycleElapsed >= 650 && cycleElapsed <= 2450;

        // 5. Desenhar Plataformas Táticas no Chão
        drawSlotPlatform(ctx, casterSlot.x, casterSlot.y, true, isSelfTarget && isImpactWindow);
        enemySlots.forEach((slot, idx) => {
          const isTargeted = !isSelfTarget && (isAoETarget || idx === (formationCount === 3 ? 1 : 0));
          drawSlotPlatform(ctx, slot.x, slot.y, false, isTargeted && isImpactWindow);
        });

        // 6. Desenhar Unidades ordenadas por Profundidade (Y-Sorting)
        const renderUnits = [];

        if (casterUnit) {
          renderUnits.push({
            role: 'CASTER',
            x: casterX,
            y: casterY,
            dir: 6, // 6 = Leste / Direita (olhando para os inimigos)
            action: casterAction,
            unit: casterUnit,
            isTargeted: isSelfTarget,
            label: casterUnit.namePtBr,
          });
        }

        if (targetUnit) {
          enemySlots.forEach((slot, idx) => {
            const isPrimary = idx === (formationCount === 3 ? 1 : 0);
            const isHit = !isSelfTarget && (isAoETarget || isPrimary);
            const hasDamage = floatingTexts.some((f) => !f.onSelf && f.text.includes('-'));
            const enemyAction = isHit && isImpactWindow && hasDamage ? 5 : 0; // 5 = Recebendo Dano (Hit)
            renderUnits.push({
              role: 'TARGET',
              x: slot.x,
              y: slot.y,
              dir: 2, // 2 = Oeste / Esquerda (olhando para o conjurador)
              action: enemyAction,
              unit: targetUnit,
              isTargeted: isHit,
              label: `${targetUnit.namePtBr}${slot.labelSuffix}`,
            });
          });
        }

        renderUnits.sort((a, b) => a.y - b.y);

        for (const u of renderUnits) {
          const sprite = this.getOrCreateArenaUnitSprite(u.unit);
          if (sprite) {
            sprite.draw(
              ctx,
              u.x,
              u.y,
              u.action,
              u.dir,
              now - this.arenaPreviewCycleStartMs,
              null,
              u.unit.groundOffsetY || 0,
              0.68,
              false,
              u.unit.shadowOffsetX || 0,
              u.unit.shadowOffsetY || 0
            );
          }

          // Efeito Especial (VFX) sobre a unidade atingida durante a janela de impacto
          if (isImpactWindow && u.isTargeted && vfxKey) {
            this.drawVfxOnCanvas(ctx, vfxKey, u.x, u.y - 28, cycleElapsed - 600, 0.82);
          }

          // HUD de HP + Ícone de Buff/Debuff na cabeça da unidade
          const unitStatuses = !isSkillModal
            ? u.role === 'TARGET' && u.isTargeted
              ? appliedStatusIcons
              : []
            : isPostImpactWindow
            ? appliedStatusIcons.filter((st) => (u.role === 'CASTER' ? st.onSelf : !st.onSelf && u.isTargeted))
            : [];

          const hpRatio =
            u.role === 'TARGET' && u.isTargeted && isPostImpactWindow && floatingTexts.some((f) => f.text.includes('-'))
              ? 0.68
              : 1.0;

          drawUnitHudAndStatus(ctx, u.x, u.y, u.label, u.role === 'CASTER', hpRatio, unitStatuses, now);
        }

        // 7. Números de Dano / Cura / Status Flutuantes após o impacto
        if (cycleElapsed >= 720 && cycleElapsed <= 2150) {
          const progress = (cycleElapsed - 720) / 1430;
          const floatOffsetY = Math.round(progress * 28);
          ctx.save();
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'center';

          for (const u of renderUnits) {
            const relevantTexts = floatingTexts.filter((f) =>
              u.role === 'CASTER' ? f.onSelf : !f.onSelf && u.isTargeted
            );
            relevantTexts.forEach((ft, idx) => {
              const ty = u.y - 78 - floatOffsetY - idx * 15;
              ctx.lineWidth = 3;
              ctx.strokeStyle = 'rgba(2, 6, 23, 0.92)';
              ctx.strokeText(ft.text, u.x, ty);
              ctx.fillStyle = ft.color;
              ctx.fillText(ft.text, u.x, ty);
            });
          }
          ctx.restore();
        }

        // 8. Banner Superior de Execução da Habilidade / Buff na Arena
        if (cycleElapsed >= 350 && cycleElapsed <= 1750) {
          ctx.save();
          const bw = 230;
          const bh = 26;
          const bx = Math.round((w - bw) / 2);
          const by = 6;
          ctx.fillStyle = 'rgba(2, 6, 23, 0.88)';
          ctx.fillRect(bx, by, bw, bh);
          ctx.strokeStyle = isSkillModal ? '#38bdf8' : '#c084fc';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(bx, by, bw, bh);

          const icEntry = this.getOrCreateArenaIconImage(mainIconUrl);
          if (icEntry && icEntry.ready && icEntry.img) {
            ctx.drawImage(icEntry.img, bx + 5, by + 3, 20, 20);
          }
          ctx.fillStyle = '#fde047';
          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(bannerTitle.slice(0, 26), bx + 30, by + 17);
          ctx.restore();
        }

        this.vfxPreviewAnimFrame = requestAnimationFrame(step);
      };

      this.vfxPreviewAnimFrame = requestAnimationFrame(step);
    };
  }
}

window.AdminArenaPreview = AdminArenaPreview;
