/**
 * @file apps/server/public/play/js/PlayWorldRenderer.js
 * @module @etheria/client/world-renderer
 * @description Submódulo de renderização Canvas 2.5D do mundo aberto (`/play`):
 *   câmera travada nos limites do mapa, camadas de raio-X GM, portais, ordenação Y-Sorting
 *   Zero-Alloc (NPCs, jogadores remotos, pets seguidores, jogador local e entidades de combate) e VFX.
 */

class PlayWorldRenderer {
  static renderWorld(client, now) {
    client.zoom = window.PlayFlightAndWingsController?.computeEffectiveZoom(client, client.baseZoom || 1.0) ?? (client.baseZoom || 1.0);
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const focusX = client.actionCombatArena?.isActive ? client.actionCombatArena.getCamFocusX() : client.playerX;
    const focusY = client.actionCombatArena?.isActive ? client.actionCombatArena.getCamFocusY() : client.playerY;
    const bounds = client.getMapBounds();
    const mapW = bounds.width;
    const mapH = bounds.height;
    let camX = Math.round(canvas.width / 2 - focusX * client.zoom);
    let camY = Math.round(canvas.height / 2 - focusY * client.zoom);
    // LIMITA A CÂMERA À BORDA DO MAPA (Sem jamais mostrar área preta vazia)
    const totalRenderedW = mapW * client.zoom;
    const totalRenderedH = mapH * client.zoom;
    if (totalRenderedW <= canvas.width) {
      camX = Math.round((canvas.width - totalRenderedW) / 2);
    } else {
      const minCamX = Math.round(canvas.width - totalRenderedW);
      camX = Math.max(minCamX, Math.min(0, camX));
    }
    if (totalRenderedH <= canvas.height) {
      camY = Math.round((canvas.height - totalRenderedH) / 2);
    } else {
      const minCamY = Math.round(canvas.height - totalRenderedH);
      camY = Math.max(minCamY, Math.min(0, camY));
    }
    client.camX = camX;
    client.camY = camY;
    ctx.save();
    ctx.translate(camX, camY);
    ctx.scale(client.zoom, client.zoom);
    // 1. Imagem de Fundo Limpa do Mapa (`mcreworkMapImage`)
    if (client.mapBgImage) {
      ctx.drawImage(client.mapBgImage, 0, 0);
    } else {
      ctx.fillStyle = '#0b1120'; ctx.fillRect(0, 0, 2000, 1500);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)'; ctx.lineWidth = 1 / client.zoom;
      for (let x = 0; x <= 2000; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 1500); ctx.stroke(); }
      for (let y = 0; y <= 1500; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(2000, y); ctx.stroke(); }
      ctx.fillStyle = '#38bdf8'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('🗺️ Carregando imagem do mapa...', client.playerX, client.playerY - 40);
    }
    // 1.1 Barreira Rúnica da Arena no Chão do Mapa Real
    if (client.actionCombatArena?.isActive) {
      client.actionCombatArena.drawArenaRingOnFloor(ctx, now, client.zoom);
    }
    // 2. Se o Modo Raio-X GM estiver ligado, desenha Malhas de Colisão, Sobreposição e Spawn
    if (client.gmXray && client.currentMap) {
      const drawPolyMesh = (list, fill, stroke) => {
        for (const poly of list || []) {
          const pts = poly.points || [];
          if (pts.length < 3) continue;
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
          ctx.closePath();
          ctx.fillStyle = fill;
          ctx.fill();
          ctx.lineWidth = 2 / client.zoom;
          ctx.strokeStyle = stroke;
          ctx.stroke();
        }
      };
      drawPolyMesh(client.currentMap.collisionMeshJson, 'rgba(239, 68, 68, 0.30)', '#ef4444');
      drawPolyMesh(client.currentMap.overlapMeshJson, 'rgba(56, 189, 248, 0.28)', '#38bdf8');
      drawPolyMesh(client.currentMap.buildingMeshJson, 'rgba(245, 158, 11, 0.26)', '#f59e0b');
      drawPolyMesh(client.currentMap.plantationMeshJson, 'rgba(34, 197, 94, 0.26)', '#22c55e');
      drawPolyMesh(client.currentMap.fishingMeshJson, 'rgba(6, 182, 212, 0.28)', '#06b6d4');
      ctx.beginPath();
      ctx.arc(client.currentMap.spawnX, client.currentMap.spawnY, 32, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(245, 158, 11, 0.35)'; ctx.fill();
      ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2.5 / client.zoom; ctx.stroke();
      ctx.fillStyle = '#fef08a'; ctx.font = 'bold 13px sans-serif';
      ctx.fillText(`⭐ SPAWN (${client.currentMap.spawnX}, ${client.currentMap.spawnY})`, client.currentMap.spawnX - 50, client.currentMap.spawnY - 38);
    }
    // 3. Desenha Portais Pareados (`map_portals`) com anel energético pulsante (ocultos na arena de combate)
    if (!client.actionCombatArena?.isActive) {
      const pulse = 0.85 + 0.15 * Math.sin(now / 220);
      for (const p of client.currentMap.portals || []) {
        const r = (Number(p.triggerRadius) || 48) * pulse;
        const isLinked = Boolean(p.targetMapId);
        ctx.beginPath();
        ctx.ellipse(p.sourceX, p.sourceY, r, r * 0.65, 0, 0, Math.PI * 2);
        ctx.fillStyle = isLinked ? 'rgba(168, 85, 247, 0.32)' : 'rgba(148, 163, 184, 0.25)'; ctx.fill();
        ctx.lineWidth = 3 / client.zoom; ctx.strokeStyle = isLinked ? '#c084fc' : '#94a3b8'; ctx.stroke();
        ctx.fillStyle = '#f3e8ff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(`🌀 ${p.label}${p.targetMapNamePtBr ? ` ➔ ${p.targetMapNamePtBr}` : ''}`, p.sourceX, p.sourceY - r * 0.65 - 8);
      }
    }
    // 4. Indicador de destino do clique no chão
    const destX = client.targetDestX !== null ? client.targetDestX : ((client.currentPath && client.currentPath.length > 0) ? client.currentPath[client.currentPath.length - 1].x : client.moveTargetX);
    const destY = client.targetDestY !== null ? client.targetDestY : ((client.currentPath && client.currentPath.length > 0) ? client.currentPath[client.currentPath.length - 1].y : client.moveTargetY);
    if (destX !== null && destY !== null) {
      ctx.beginPath(); ctx.arc(destX, destY, 10, 0, Math.PI * 2);
      ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2.5 / client.zoom; ctx.stroke();
    }
    // 4.5. Halo Rúnico no Piso de Level Up (desenhado sob os pés do personagem)
    if (client.levelUpVfx) client.levelUpVfx.renderWorldFloor(ctx, now, client.zoom);
    // 4.6. Linha, boia e ondulações de pesca na água
    if (!client.actionCombatArena?.isActive) window.PlayFishingController?.drawWorldFishingEffects(client, ctx, now);
    // 5. Ordenação de Profundidade 2.5D (Y-Sorting com Pooling Zero-Alloc)
    for (let i = 0; i < client._renderQueue.length; i++) client._renderPool.push(client._renderQueue[i]);
    client._renderQueue.length = 0;
    if (client.actionCombatArena?.isActive) {
      client.actionCombatArena.populateRenderQueue(client._renderQueue, now);
    } else {
      for (const npc of client.currentMap.npcs || []) client.pushRenderItem('NPC', npc.posY, npc);
      if (window.PlayMapPresenceController) window.PlayMapPresenceController.populateRenderQueue(client._renderQueue, now);
      if (window.PlayPetsController) window.PlayPetsController.populateRenderQueue(client, client._renderQueue);
      if (client.activeChar) client.pushRenderItem('PLAYER', (client.isFlying || (client.flightAltitudeCurrent || 0) > 2) ? (client.playerY + 100000) : client.playerY, client.activeChar);
    }
    client._renderQueue.sort((a, b) => a.y - b.y);
    for (const item of client._renderQueue) {
      if (item.type === 'NPC') {
        const npc = item.data;
        const sprite = client.getOrCreateSprite(`npc_${npc.mcreworkNpcKey}`, npc.atlasJsonUrl, npc.atlasWebpUrl, npc.thumbUrl);
        sprite.draw(ctx, npc.posX, npc.posY, 0, npc.direction || 0, now, client.mesh);
        ctx.fillStyle = '#86efac'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(npc.namePtBr, npc.posX, npc.posY - 62);
        if (typeof client.drawNpcQuestHeadIcon === 'function') client.drawNpcQuestHeadIcon(ctx, npc, now);
      } else if (item.type === 'PET_FOLLOWER') {
        if (window.PlayPetsController) window.PlayPetsController.drawFollowerPet(client, ctx, item.data, now);
      } else if (item.type === 'PLAYER') {
        const char = item.data;
        const sprite = client.getOrCreateSprite(`char_${char.mcreworkCharKey}`, char.atlasJsonUrl, char.atlasWebpUrl, char.thumbUrl);
        const groundOffsetY = char.groundOffsetY || 0;
        let nameY = client.playerY - 66 + Math.round(groundOffsetY * 0.70);
        if (window.PlayFlightAndWingsController) {
          nameY = window.PlayFlightAndWingsController.drawPlayerWithCosmetics(ctx, {
            client: client, charSprite: sprite, worldX: client.playerX, worldY: client.playerY,
            action: client.isMoving ? 1 : 0, dir: client.playerDir, now, mesh: client.mesh,
            groundOffsetY, shadowOffsetX: char.shadowOffsetX || 0, shadowOffsetY: char.shadowOffsetY || 0,
            wingsObj: char.visualAppearance?.equippedWings || null, mountObj: char.visualAppearance?.equippedMount || null,
            followerPet: window.PlayPetsController?.getPrimaryFollowerPet?.() || null,
            isFlying: Boolean(client.isFlying), flightAltitude: Number(client.flightAltitudeCurrent) || 0, customScale: window.PlayFlightAndWingsController?.getFlyingPlayerScale?.(client, 0.70) || 0.70,
          });
        } else {
          sprite.draw(ctx, client.playerX, client.playerY, client.isMoving ? 1 : 0, client.playerDir, now, client.mesh, groundOffsetY, 0.70, false, char.shadowOffsetX || 0, char.shadowOffsetY || 0);
        }
        ctx.textAlign = 'center';
        if (window.PlayPartyController?.isLeader()) { ctx.font = '14px sans-serif'; ctx.fillText('👑', client.playerX, nameY - 14); }
        if (window.PlayPartyController?.hasParty()) { ctx.font = 'bold 9px sans-serif'; ctx.fillStyle = '#38bdf8'; ctx.fillText('[Equipe]', client.playerX, nameY - 3); }
        ctx.fillStyle = '#fde047'; ctx.font = 'bold 13px sans-serif';
        ctx.fillText(`${char.name}${char.isReborn ? ' ✨' : ''}${client.gmNoClip ? ' [NO-CLIP]' : ''}`, client.playerX, nameY);
        window.PlayFishingController?.drawPlayerFishingOverhead(client, ctx, client.playerX, nameY, now);
      } else if (item.type === 'OTHER_PLAYER') {
        window.PlayMapPresenceController?.drawOtherPlayer(ctx, item.data, now, client.mesh, client.zoom);
      } else if (item.type === 'COMBAT_PLAYER') {
        const p = item.data;
        const isTransient = (p.action === 3 || p.action === 5 || p.action === 6 || p.action === 7);
        const elapsed = (isTransient && p.actionStartTime) ? (now - p.actionStartTime) : now;
        if (window.PlayFlightAndWingsController && p.sprite) {
          window.PlayFlightAndWingsController.drawPlayerWithCosmetics(ctx, {
            client: client, charSprite: p.sprite, worldX: p.x, worldY: p.y,
            action: p.action, dir: p.dir, now: elapsed, wingNow: now, mesh: client.mesh,
            groundOffsetY: p.groundOffsetY || 0, shadowOffsetX: p.shadowOffsetX || 0, shadowOffsetY: p.shadowOffsetY || 0,
            wingsObj: p.equippedWings || null, mountObj: null, isFlying: false, flightAltitude: 0, customScale: 0.70,
          });
        } else if (p.sprite) {
          p.sprite.draw(ctx, p.x, p.y, p.action, p.dir, elapsed, client.mesh, p.groundOffsetY || 0, 0.70, false, p.shadowOffsetX || 0, p.shadowOffsetY || 0);
        }
        if (p.isAlive) {
          const bw = 54, bh = 5, bx = p.x - bw / 2, by = p.y - 62 + Math.round((p.groundOffsetY || 0) * 0.70);
          ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
          ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
          const hpRatio = Math.max(0, Math.min(1, p.hp / (p.maxHp || 1)));
          ctx.fillStyle = (hpRatio < 0.35) ? '#ef4444' : '#22c55e';
          ctx.fillRect(bx, by, Math.round(bw * hpRatio), bh);
          const mpy = by + bh + 1;
          ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
          ctx.fillRect(bx - 1, mpy - 1, bw + 2, 5);
          const mpRatio = Math.max(0, Math.min(1, (p.mp || 0) / (p.maxMp || 1)));
          ctx.fillStyle = '#38bdf8';
          ctx.fillRect(bx, mpy, Math.round(bw * mpRatio), 3.5);
          ctx.fillStyle = '#fde047'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
          ctx.fillText(p.name, p.x, by - 4);
          client.actionCombatArena?.vfxRenderer?.drawUnitOverlays(ctx, p, by - 14, now);
        }
      } else if (item.type === 'COMBAT_MONSTER' || item.type === 'COMBAT_PET') {
        const ent = item.data;
        const isPet = item.type === 'COMBAT_PET';
        const vTier = !isPet ? (ent.variantTier || 'NORMAL') : 'NORMAL';
        const mScale = !isPet ? (Number(ent.modelScale) || 1.0) : 1.0;
        ctx.save();
        ctx.globalAlpha = ent.fadeAlpha;
        if (!isPet && ent.isAlive && (vTier === 'LEADER' || vTier === 'BOSS')) {
          const auraR = Math.round(24 * mScale * (0.92 + 0.08 * Math.sin(now / 180)));
          ctx.save();
          ctx.beginPath();
          ctx.ellipse(ent.x, ent.y, auraR, Math.round(auraR * 0.52), 0, 0, Math.PI * 2);
          ctx.fillStyle = vTier === 'BOSS' ? 'rgba(244, 63, 94, 0.28)' : 'rgba(56, 189, 248, 0.22)';
          ctx.fill();
          ctx.strokeStyle = vTier === 'BOSS' ? '#fb7185' : '#38bdf8';
          ctx.lineWidth = vTier === 'BOSS' ? 2.4 : 1.8;
          ctx.stroke();
          ctx.restore();
        }
        if (ent.sprite) {
          const isTransient = (ent.action === 3 || ent.action === 5 || ent.action === 6 || ent.action === 7);
          const elapsed = (isTransient && ent.actionStartTime) ? (now - ent.actionStartTime) : now;
          ent.sprite.draw(ctx, ent.x, ent.y, ent.action, ent.dir, elapsed, client.mesh, ent.groundOffsetY || 0, (isPet ? 0.62 : 0.70) * mScale, ent.action === 6, ent.shadowOffsetX || 0, ent.shadowOffsetY || 0);
        }
        if (ent.isAlive) {
          const isTarget = !isPet && (client.actionCombatArena?.selectedTargetMob === ent);
          const bw = isPet ? 46 : (vTier === 'BOSS' ? 76 : vTier === 'LEADER' ? 62 : (isTarget ? 58 : 50));
          const bh = vTier === 'BOSS' ? 7 : (isTarget || vTier === 'LEADER' ? 6 : 5);
          const bx = ent.x - bw / 2, by = ent.y - Math.round((isPet ? 60 : 68) * mScale);
          ctx.fillStyle = 'rgba(2, 6, 23, 0.85)'; ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
          if (isTarget || vTier === 'BOSS' || vTier === 'LEADER') {
            ctx.strokeStyle = isTarget ? '#f59e0b' : (vTier === 'BOSS' ? '#fb7185' : '#38bdf8');
            ctx.lineWidth = 1.8; ctx.strokeRect(bx - 1, by - 1, bw + 2, bh + 2);
          }
          const hpRatio = Math.max(0, Math.min(1, ent.hp / ent.maxHp));
          ctx.fillStyle = isPet ? (hpRatio < 0.35 ? '#ef4444' : '#22c55e') : (vTier === 'BOSS' ? '#e11d48' : vTier === 'LEADER' ? '#0ea5e9' : (isTarget ? '#fbbf24' : '#ef4444'));
          ctx.fillRect(bx, by, bw * hpRatio, bh);
          if (isPet) {
            const mpy = by + bh + 1;
            const mpRatio = Math.max(0, Math.min(1, (ent.mp || 0) / (ent.maxMp || 200)));
            ctx.fillStyle = 'rgba(2, 6, 23, 0.85)'; ctx.fillRect(bx - 1, mpy - 1, bw + 2, 4.5);
            ctx.fillStyle = '#38bdf8'; ctx.fillRect(bx, mpy, bw * mpRatio, 3);
          }
          ctx.font = vTier === 'BOSS' ? 'bold 13px sans-serif' : (isTarget || vTier === 'LEADER' ? 'bold 12px sans-serif' : 'bold 11px sans-serif');
          ctx.textAlign = 'center';
          ctx.fillStyle = isPet ? '#bae6fd' : (vTier !== 'NORMAL' ? (ent.nameColorHex || '#38bdf8') : (isTarget ? '#fde047' : '#f8fafc'));
          ctx.fillText(isTarget ? `🎯 ${ent.name} (Nv.${ent.level})` : (isPet ? `🐾 ${ent.name}` : `${ent.name} (Nv.${ent.level})`), ent.x, by - 5);
          if (isTarget) client.actionCombatArena?.vfxRenderer?.drawMonsterTargetOverlays(ctx, ent, by, now);
          client.actionCombatArena?.vfxRenderer?.drawUnitOverlays(ctx, ent, by - 14, now);
        }
        ctx.restore();
      } else if (item.type === 'DUNGEON_CHEST') {
        window.PlayDungeonChestController?.renderChestOnCanvas(ctx, client.actionCombatArena, now, client.mesh);
      }
    }
    // 6. VFX Animados & Textos Flutuantes da Arena de Combate
    if (client.actionCombatArena?.isActive) {
      client.actionCombatArena.renderActiveVfx(ctx, now);
      client.actionCombatArena.renderFloatingTexts(ctx);
    }
    window.PlayFlightAndWingsController?.drawWorldMistParticles(ctx);
    if (client.levelUpVfx) client.levelUpVfx.renderWorldAir(ctx, now, client.zoom);
    if (window.PortalTravelController?.hasActiveVfx) window.PortalTravelController.renderWorldVfx(ctx, now, client.zoom);
    ctx.restore();
    if (window.BattleTransitionController?.isActive) window.BattleTransitionController.render(ctx, now, canvas);
    if (window.PlayHudController && (!client._lastMinimapUpdate || now - client._lastMinimapUpdate > 90)) {
      client._lastMinimapUpdate = now;
      window.PlayHudController.updateMinimap(client.currentMap, client.mapBgImage, client.playerX, client.playerY, client.playerDir);
    }
  }
}

window.PlayWorldRenderer = PlayWorldRenderer;
