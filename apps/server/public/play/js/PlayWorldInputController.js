/**
 * @file apps/server/public/play/js/PlayWorldInputController.js
 * @module @etheria/client/world-input
 * @description Submódulo de entrada de usuário do mundo (`/play`): teclado (WASD/Setas/V),
 *   clique/toque no canvas (pathfinding, portais, NPCs e arena) e zoom por scroll/pinça.
 */

class PlayWorldInputController {
  static setupWorldEvents(client) {
    window.addEventListener('resize', () => client.resizeCanvas());
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        if (window.PlayFishingController?.isFishing) {
          window.PlayFishingController.notifyMoveBlocked();
          return;
        }
        if (window.PlayPartyController?.isFollower() || (client.isLandingFlight && client.flightLandingTarget)) return;
        client.keysDown.add(k);
        client.currentPath = null; client.moveTargetX = null; client.moveTargetY = null; client.targetDestX = null; client.targetDestY = null;
      } else if (k === 'v') {
        window.PlayFlightAndWingsController?.toggleFlight(client);
      }
    });
    window.addEventListener('keyup', (e) => { client.keysDown.delete(e.key.toLowerCase()); });
    const canvas = document.getElementById('gameCanvas');
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (window.BattleTransitionController?.isActive) {
        window.BattleTransitionController.skip();
        return;
      }
      if (!client.activeChar || !client.currentMap) return;
      if (window.PlayPartyController?.isFollower() && !client.actionCombatArena?.isActive) return;
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const worldPt = client.screenToWorld(sx, sy);
      const bounds = client.getMapBounds();
      worldPt.x = Math.max(18, Math.min(bounds.width - 18, worldPt.x));
      worldPt.y = Math.max(20, Math.min(bounds.height - 18, worldPt.y));
      // Em batalha na arena: clique esquerdo abre baú da dungeon, seleciona alvo/ataca ou move pelo chão
      if (client.actionCombatArena?.isActive) {
        if (window.PlayDungeonChestController?.handleCanvasClick(client.actionCombatArena, worldPt)) return;
        if (window.PlayNativeAppController?.handleArenaPointer(client, worldPt)) return;
      }
      // Se o clique foi em um portal, PortalTravelController conduz o herói e abre confirmação
      if (window.PortalTravelController?.handleCanvasClick(client, worldPt)) {
        return;
      }
      // Se o jogador tocar diretamente sobre um NPC e já estiver próximo, abre o modal de Quest/Diálogo
      for (const npc of client.currentMap.npcs || []) {
        const clickDist = Math.hypot(worldPt.x - npc.posX, worldPt.y - (npc.posY - 28));
        const playerDist = Math.hypot(client.playerX - npc.posX, client.playerY - npc.posY);
        if (clickDist <= 42 && playerDist <= 95 && typeof client.openNpcQuestModal === 'function') {
          void client.openNpcQuestModal(npc);
        }
      }
      if (client.isLandingFlight) return;
      if (window.PlayFishingController?.isFishing) {
        window.PlayFishingController.notifyMoveBlocked();
        return;
      }
      client.targetDestX = worldPt.x; client.targetDestY = worldPt.y; client.lastRepathTime = 0;
      if (client.mesh && !client.gmNoClip && !client.isFlying) {
        const path = client.mesh.findPath(client.playerX, client.playerY, worldPt.x, worldPt.y);
        if (path && path.length > 0) {
          client.currentPath = path;
          client.moveTargetX = path[0].x;
          client.moveTargetY = path[0].y;
        } else {
          client.currentPath = null;
          client.moveTargetX = worldPt.x;
          client.moveTargetY = worldPt.y;
        }
      } else {
        client.currentPath = null;
        client.moveTargetX = worldPt.x;
        client.moveTargetY = worldPt.y;
      }
    });
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        client.changeZoom(e.deltaY < 0 ? 1.12 : 0.89);
      },
      { passive: false }
    );
    canvas.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length === 2) {
          client.lastPinchDist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
        }
      },
      { passive: true }
    );
    canvas.addEventListener(
      'touchmove',
      (e) => {
        if (e.touches.length === 2 && client.lastPinchDist > 0) {
          const dist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
          const ratio = dist / client.lastPinchDist;
          client.baseZoom = Math.min(2.6, Math.max(0.3, (client.baseZoom || 1.0) * ratio));
          client.zoom = window.PlayFlightAndWingsController?.computeEffectiveZoom(client, client.baseZoom) ?? client.baseZoom;
          client.lastPinchDist = dist;
        }
      },
      { passive: true }
    );
  }
}

window.PlayWorldInputController = PlayWorldInputController;
