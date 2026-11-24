/**
 * @file apps/server/public/play/js/PlayDungeonChestController.js
 * @module @etheria/client/dungeon-chest
 * @description Controlador visual e interativo dos Baús de Recompensa de Dungeon (Comum / Épico / Lendário).
 *   - Spawna o baú no local exato do último monstro eliminado na Dungeon.
 *   - Renderiza aura luminosa por raridade, partículas ascendentes, sprite calibrado (`visualScale`, `visualOffsetX`, `visualOffsetY`)
 *     e etiqueta clicável diretamente no Canvas 2.5D + botão de acesso rápido na tela.
 *   - Ao clicar no baú, reivindica as recompensas no servidor e exibe o modal de Dungeon Concluída.
 */

class PlayDungeonChestController {
  static imageCache = new Map();
  static glowTexCache = new Map();

  static getGlowTexture(glowHex) {
    const key = String(glowHex || '#fbbf24').trim();
    const cached = this.glowTexCache.get(key);
    if (cached) return cached;
    const size = 128;
    const off = document.createElement('canvas');
    off.width = size;
    off.height = size;
    const gctx = off.getContext('2d');
    if (gctx) {
      const mid = size / 2;
      const grad = gctx.createRadialGradient(mid, mid, 4, mid, mid, mid);
      grad.addColorStop(0, `${key}88`);
      grad.addColorStop(0.55, `${key}33`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      gctx.fillStyle = grad;
      gctx.fillRect(0, 0, size, size);
    }
    this.glowTexCache.set(key, off);
    return off;
  }

  static getChestImage(url) {
    if (!url) return null;
    if (!this.imageCache.has(url)) {
      const img = new Image();
      img.src = url;
      this.imageCache.set(url, img);
    }
    return this.imageCache.get(url);
  }

  static clearPromptButton() {
    const existing = document.getElementById('dungeonChestOpenPromptBtn');
    if (existing) existing.remove();
  }

  static injectPromptButton(arena, chest) {
    this.clearPromptButton();
    if (!chest || typeof document === 'undefined') return;
    const btn = document.createElement('button');
    btn.id = 'dungeonChestOpenPromptBtn';
    btn.type = 'button';
    const glow = chest.glowColorHex || '#fbbf24';
    btn.style.cssText = [
      'position:fixed', 'left:50%', 'bottom:96px', 'transform:translateX(-50%)',
      'z-index:260', 'display:inline-flex', 'align-items:center', 'gap:10px',
      'padding:10px 18px', 'border-radius:999px', 'cursor:pointer',
      'background:rgba(15,23,42,0.95)', `border:2px solid ${glow}`,
      `box-shadow:0 8px 28px ${glow}66`, 'color:#f8fafc', 'font-weight:900',
      'font-size:0.86rem', 'backdrop-filter:blur(6px)',
    ].join(';');
    btn.innerHTML = `<img src="${chest.imageUrl}" style="width:28px;height:28px;object-fit:contain;" /><span>✨ Abrir ${chest.namePtBr}</span>`;
    btn.onclick = (e) => {
      e.stopPropagation();
      void this.openChest(arena);
    };
    document.body.appendChild(btn);
  }

  static async spawnChestAtLastMonster(arena, worldX, worldY) {
    if (!arena || !arena.currentBattle || !arena.client) return;
    arena.combatState = 'CHEST_WAIT';
    const spawnX = Math.round(Number(worldX) || arena.player?.x || 500);
    const spawnY = Math.round(Number(worldY) || arena.player?.y || 500);

    try {
      const res = await arena.client.api('/api/play/dungeon/spawn-chest', {
        method: 'POST',
        body: JSON.stringify({ battleId: arena.currentBattle.battleId, x: spawnX, y: spawnY }),
      });
      const chest = res?.chest || {
        rarityCode: 'COMMON',
        namePtBr: 'Baú Comum',
        imageUrl: '/play/assets/dungeon/chest_common.png',
        visualScale: 0.36,
        visualOffsetX: 0,
        visualOffsetY: -10,
        glowColorHex: '#38bdf8',
        x: spawnX,
        y: spawnY,
      };
      this.getChestImage(chest.imageUrl);
      arena.dungeonChest = {
        ...chest,
        x: spawnX,
        y: spawnY,
        opened: false,
        opening: false,
        spawnedAt: performance.now(),
      };
      this.injectPromptButton(arena, arena.dungeonChest);
      arena.floatingTexts?.push({
        x: spawnX,
        y: spawnY - 72,
        text: `🎁 ${chest.namePtBr} apareceu!`,
        color: chest.glowColorHex || '#fde047',
        life: 2.2,
      });
      arena.client.showNotification?.(`🎁 ${chest.namePtBr} surgiu! Clique no baú para coletar as recompensas!`, 'success');
    } catch (err) {
      console.warn('[PlayDungeonChestController] Fallback de vitória direta:', err);
      await this.finalizeVictoryDirect(arena);
    }
  }

  static handleCanvasClick(arena, worldPt) {
    const chest = arena?.dungeonChest;
    if (!chest || chest.opened || chest.opening || arena.combatState !== 'CHEST_WAIT') return false;
    const cx = chest.x + (Number(chest.visualOffsetX) || 0);
    const cy = chest.y + (Number(chest.visualOffsetY) ?? -10);
    const drawSize = Math.max(48, Math.round(256 * (Number(chest.visualScale) || 0.36)));
    const hitRadius = Math.max(58, drawSize * 0.65);
    if (Math.hypot(worldPt.x - cx, worldPt.y - (cy - drawSize * 0.32)) <= hitRadius) {
      void this.openChest(arena);
      return true;
    }
    return false;
  }

  static async openChest(arena) {
    const chest = arena?.dungeonChest;
    if (!arena || !chest || chest.opened || chest.opening) return;
    chest.opening = true;
    this.clearPromptButton();
    await this.finalizeVictoryDirect(arena);
    chest.opened = true;
    chest.opening = false;
  }

  static async finalizeVictoryDirect(arena) {
    if (!arena) return;
    arena.combatState = 'RESULT';
    const expGained = arena.monsters.reduce(
      (acc, m) => acc + (Number(m.expReward) || (Number(m.level) || 1) * 28),
      0
    );
    const goldGained = arena.monsters.reduce(
      (acc, m) =>
        acc +
        (Number(m.goldReward) ||
          Math.ceil(
            (Number(m.level) || 1) *
              10 *
              ({ SS: 2.5, S: 1.8, A: 1.6, B: 1.35, C: 1.2, F: 0.8 }[m.rarityTier] || 1.0) *
              (m.variantTier === 'BOSS' ? 1.5 : m.variantTier === 'LEADER' ? 1.3 : 1.0)
          )),
      0
    );
    const res = await arena.recordBattleVictoryOnServer();
    const vData = { expGained, goldGained, ...(res || {}) };
    if (window.CombatOutcomeController) {
      window.CombatOutcomeController.showVictory(vData, arena, arena.client);
    } else {
      arena.showResult(true, `Você venceu!<br><br><strong>+${vData.expGained} EXP</strong> &bull; <strong>+${vData.goldGained} Ouro</strong>`);
    }
  }

  static renderChestOnCanvas(ctx, arena, now) {
    const chest = arena?.dungeonChest;
    if (!chest || chest.opened) return;

    const ageSec = Math.max(0, (now - (chest.spawnedAt || now)) / 1000);
    const popScale = ageSec < 0.35 ? 0.35 + 0.65 * Math.sin((ageSec / 0.35) * (Math.PI / 2)) : 1.0;
    const bobY = Math.sin(now / 380) * 3.5;

    const cx = Math.round(chest.x + (Number(chest.visualOffsetX) || 0));
    const cy = Math.round(chest.y + (Number(chest.visualOffsetY) ?? -10));
    const scale = Math.max(0.1, Number(chest.visualScale) || 0.36) * popScale;
    const drawSize = Math.round(256 * scale);
    const glow = chest.glowColorHex || '#fbbf24';

    ctx.save();
    // 1. Halo luminoso pulsante no chão (offscreen texture pré-renderizada)
    const pulse = 0.88 + 0.12 * Math.sin(now / 260);
    const rx = Math.round(drawSize * 0.56 * pulse);
    const ry = Math.round(drawSize * 0.26 * pulse);
    const glowTex = this.getGlowTexture(glow);
    const haloW = Math.max(24, Math.round(rx * 2.5));
    const haloH = Math.max(14, Math.round(ry * 2.8));
    ctx.drawImage(
      glowTex,
      Math.round(cx - haloW / 2),
      Math.round(cy + 4 - haloH / 2),
      haloW,
      haloH
    );

    // Sombra base
    ctx.fillStyle = 'rgba(0, 0, 0, 0.48)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 2, Math.round(drawSize * 0.36), Math.round(drawSize * 0.14), 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Sprite do Baú
    const img = this.getChestImage(chest.imageUrl);
    if (img && img.complete && img.naturalWidth > 0) {
      const dx = Math.round(cx - drawSize / 2);
      const dy = Math.round(cy - drawSize * 0.88 + bobY);
      ctx.drawImage(img, dx, dy, drawSize, drawSize);
    }

    // 3. Partículas sutis ascendentes
    for (let i = 0; i < 6; i++) {
      const phase = ((now / 1200) + i * 0.17) % 1;
      const px = cx + Math.sin(i * 2.1 + now / 500) * (drawSize * 0.38);
      const py = cy - phase * (drawSize * 1.05);
      const alpha = Math.sin(phase * Math.PI) * 0.85;
      ctx.fillStyle = glow;
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.beginPath();
      ctx.arc(px, py, 2.2 + (i % 2), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 4. Rótulo clicável acima do baú
    const labelY = Math.round(cy - drawSize * 0.96 + bobY);
    const labelText = `✨ ${chest.namePtBr} (Clique para Abrir)`;
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    const textW = ctx.measureText(labelText).width;
    ctx.fillStyle = 'rgba(2, 6, 23, 0.86)';
    ctx.strokeStyle = glow;
    ctx.lineWidth = 1.5;
    const pillX = cx - textW / 2 - 10;
    const pillY = labelY - 15;
    const pillW = textW + 20;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(pillX, pillY, pillW, 22, 999) : ctx.rect(pillX, pillY, pillW, 22);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fef08a';
    ctx.fillText(labelText, cx, labelY);
    ctx.restore();
  }
}

window.PlayDungeonChestController = PlayDungeonChestController;
