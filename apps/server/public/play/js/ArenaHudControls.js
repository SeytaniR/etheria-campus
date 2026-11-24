/**
 * @file apps/server/public/play/js/ArenaHudControls.js
 * @module @etheria/client/arena-hud
 * @description Submódulo da Arena de Combate (`/play`) para controle de HUD tática,
 *   botões de atalho/poções em batalha, ícones de habilidades, botão "Pronto!" e cooldown overlays.
 */

class ArenaHudControls {
  static updateCombatShortcutsHud() {
    const hud = window.PlayHudController;
    for (let i = 0; i < 2; i++) {
      const btn = document.getElementById(`btnActShortcut${i + 1}`), img = document.getElementById(`imgActShortcut${i + 1}`), qty = document.getElementById(`qtyActShortcut${i + 1}`);
      if (!btn) continue;
      const s = hud?.state?.shortcuts?.[i];
      if (s?.item) {
        btn.style.display = 'flex';
        btn.title = `${s.item.name} (${s.item.count !== undefined ? 'x' + s.item.count : 'Usar'})`;
        if (img) img.src = s.item.icon;
        if (qty) qty.textContent = s.item.count !== undefined ? String(s.item.count) : '';
        btn.style.opacity = (s.item.count !== undefined && s.item.count <= 0) ? '0.4' : '1';
      } else {
        btn.style.display = 'none';
      }
    }
  }

  static triggerCombatShortcut(arena, slotIdx) {
    if (!arena.isActive || !arena.player || !arena.player.isAlive) return;
    const hud = window.PlayHudController, slot = hud?.state?.shortcuts?.[slotIdx];
    if (!slot?.item) {
      if (arena.client?.showNotification) arena.client.showNotification(`Slot #${slotIdx + 1} vazio!`, 'info');
      return;
    }
    const it = slot.item;
    if (it.count !== undefined && it.count <= 0) {
      if (arena.client?.showNotification) arena.client.showNotification(`${it.name} esgotado!`, 'warning');
      return;
    }
    const now = performance.now(), cdKey = `shortcut${slotIdx}`;
    if (arena.skillCooldowns[cdKey] && arena.skillCooldowns[cdKey] > now) return;
    arena.skillCooldowns[cdKey] = now + 1200;

    const isMp = it.type === 'HEAL_MP' || it.name.toLowerCase().includes('mana') || it.name.toLowerCase().includes('mp');
    if (isMp) {
      const healMp = it.value || 80;
      arena.player.mp = Math.min(arena.player.maxMp, arena.player.mp + healMp);
      arena.floatingTexts.push({ x: arena.player.x, y: arena.player.y - 50, text: `+${healMp} MP`, color: '#38bdf8', life: 1.4 });
    } else {
      const healHp = it.value || 150;
      arena.player.hp = Math.min(arena.player.maxHp, arena.player.hp + healHp);
      arena.floatingTexts.push({ x: arena.player.x, y: arena.player.y - 50, text: `+${healHp} HP`, color: '#22c55e', life: 1.4 });
    }
    if (it.count !== undefined) it.count--;
    ArenaHudControls.updateCombatShortcutsHud();
    if (hud?.updateShortcutsDisplay) hud.updateShortcutsDisplay();
    arena.updateHud();
  }

  static renderSkillButtonsHud(arena) {
    const fallbackIcons = ['⚡', '🌀', '🛡️', '💥'];
    for (let i = 1; i <= 4; i++) {
      const btn = document.getElementById(`btnActSkill${i}`);
      const lbl = document.getElementById(`lblActSkill${i}`);
      const sk = (arena.classSkills || [])[i - 1];
      if (!btn || !lbl) continue;
      if (sk) {
        btn.title = `${sk.namePtBr} (${sk.mpCost || 0} MP • ${sk.cooldownSeconds ?? 0}s) [Tecla ${i}]`;
        lbl.innerHTML = sk.iconUrl ? `<img class="action-skill-icon-img" src="${sk.iconUrl}" alt="${sk.namePtBr}" />` : fallbackIcons[i - 1];
        btn.style.opacity = '1';
      } else {
        btn.title = `Slot #${i} (Sem habilidade vinculada)`;
        lbl.textContent = fallbackIcons[i - 1];
        btn.style.opacity = '0.6';
      }
    }
  }

  static toggleReady(arena) {
    if (!arena.isActive || arena.combatState !== 'PREPARATION') return;
    arena.isLocalPlayerReady = !arena.isLocalPlayerReady;
    const localId = arena.client?.activeChar?.id || 'p1', btnReady = document.getElementById('btnActReady'), statusEl = document.getElementById('actPrepStatusText');
    if (arena.isLocalPlayerReady) {
      arena.readyPlayerIds.add(localId);
      if (btnReady) { btnReady.classList.add('ready'); btnReady.textContent = '✔️ VOCÊ ESTÁ PRONTO'; }
    } else {
      arena.readyPlayerIds.delete(localId);
      if (btnReady) { btnReady.classList.remove('ready'); btnReady.textContent = '⚡ PRONTO!'; }
    }
    if (arena.readyPlayerIds.size >= arena.totalRealPlayers) arena.startFightNow();
    else if (statusEl) statusEl.textContent = `Aguardando: ${arena.readyPlayerIds.size}/${arena.totalRealPlayers} jogadores prontos...`;
  }

  static startFightNow(arena) {
    if (!arena.isActive || arena.combatState !== 'PREPARATION') return;
    arena.combatState = 'FIGHTING';
    const prepBanner = document.getElementById('actionPrepBanner'); if (prepBanner) prepBanner.style.display = 'none';
    const px = arena.player ? arena.player.x : arena.arenaCenterX, py = (arena.player ? arena.player.y : arena.arenaCenterY) - 70;
    arena.floatingTexts.push({ x: px, y: py, text: 'COMBATE INICIADO', color: '#fde047', life: 1.8 });
  }

  static updateHud(arena) {
    if (!arena.player) return;
    const hpPct = Math.max(0, Math.min(100, (arena.player.hp / arena.player.maxHp) * 100));
    const mpPct = Math.max(0, Math.min(100, (arena.player.mp / arena.player.maxMp) * 100));
    const hpBar = document.getElementById('actHudPlayerHpBar'); if (hpBar) hpBar.style.width = `${hpPct}%`;
    const mpBar = document.getElementById('actHudPlayerMpBar'); if (mpBar) mpBar.style.width = `${mpPct}%`;
    const hpText = document.getElementById('actHudPlayerHpText'); if (hpText) hpText.textContent = `${Math.ceil(arena.player.hp)} / ${arena.player.maxHp}`;
    const pName = document.getElementById('actHudPlayerName'); if (pName) pName.textContent = arena.player.name;
    const aliveCount = arena.monsters.filter((m) => m.isAlive).length;
    const mobCountElem = document.getElementById('actHudMonstersAlive'); if (mobCountElem) mobCountElem.textContent = String(aliveCount);
    const now = performance.now();
    ArenaHudControls.updateCooldownOverlay('cdOverlaySkill1', arena.skillCooldowns.skill1, now);
    ArenaHudControls.updateCooldownOverlay('cdOverlaySkill2', arena.skillCooldowns.skill2, now);
    ArenaHudControls.updateCooldownOverlay('cdOverlaySkill3', arena.skillCooldowns.skill3, now);
    ArenaHudControls.updateCooldownOverlay('cdOverlaySkill4', arena.skillCooldowns.skill4, now);
  }

  static updateCooldownOverlay(elemId, expireTime, now) {
    const el = document.getElementById(elemId); if (!el) return;
    if (expireTime > now) { el.textContent = `${((expireTime - now) / 1000).toFixed(1)}s`; el.style.display = 'flex'; }
    else el.style.display = 'none';
  }
}

window.ArenaHudControls = ArenaHudControls;
