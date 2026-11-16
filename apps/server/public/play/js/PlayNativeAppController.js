/**
 * @file apps/server/public/play/js/PlayNativeAppController.js
 * @module @etheria/server
 * @description Controlador de Modo Janela Nativa de Jogo (Standalone Desktop/Mobile App Mode).
 *   Desativa menus de contexto (clique direito), seleção acidental de texto, salvamento de imagens,
 *   arraste de links e atalhos de navegador (Ctrl+S, Ctrl+P, Ctrl+F, etc.), tratando o client como
 *   um jogo nativo sem romper os controles mobile de joystick e botões.
 * @rules Segue estritamente AGENTS.md (Regra #7 < 1.000 linhas).
 */

class PlayNativeAppController {
  static init() {
    // 1. Desativa menu de contexto (botão direito) em toda a aplicação
    window.addEventListener(
      'contextmenu',
      (e) => {
        e.preventDefault();
        return false;
      },
      { capture: true }
    );

    // 2. Desativa arrastar nativo de imagens, links e outros elementos
    window.addEventListener(
      'dragstart',
      (e) => {
        e.preventDefault();
        return false;
      },
      { capture: true }
    );

    // 3. Desativa drop de arquivos para evitar que a aba navegue para fora do jogo
    window.addEventListener(
      'dragover',
      (e) => {
        e.preventDefault();
      },
      { capture: true }
    );
    window.addEventListener(
      'drop',
      (e) => {
        e.preventDefault();
      },
      { capture: true }
    );

    // 4. Desativa seleção de texto nativa fora de inputs/textareas
    document.addEventListener(
      'selectstart',
      (e) => {
        const tag = e.target?.tagName?.toUpperCase();
        if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) {
          return true;
        }
        e.preventDefault();
        return false;
      },
      { capture: true }
    );

    // 5. Desativa atalhos de navegador que interrompem o gameplay
    window.addEventListener(
      'keydown',
      (e) => {
        const isInput = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
        if (isInput) return;

        const key = e.key.toLowerCase();
        // Bloqueia Ctrl+S (Salvar), Ctrl+P (Imprimir), Ctrl+U (Fonte), Ctrl+F (Localizar), Ctrl+G (Próximo)
        if ((e.ctrlKey || e.metaKey) && ['s', 'p', 'u', 'f', 'g'].includes(key)) {
          e.preventDefault();
        }
        // Bloqueia F3 (Buscar) e F1 (Ajuda nativa do browser)
        if (e.key === 'F3' || e.key === 'F1') {
          e.preventDefault();
        }
      },
      { capture: true }
    );

    // 6. Aplica estilos CSS dinâmicos para prevenir seleção, callout e arrasto de assets
    const style = document.createElement('style');
    style.id = 'play-native-app-styles';
    style.textContent = `
      *, *::before, *::after {
        -webkit-user-select: none !important;
        -moz-user-select: none !important;
        -ms-user-select: none !important;
        user-select: none !important;
        -webkit-user-drag: none !important;
        -webkit-touch-callout: none !important;
      }
      input, textarea, [contenteditable="true"] {
        -webkit-user-select: text !important;
        -moz-user-select: text !important;
        -ms-user-select: text !important;
        user-select: text !important;
      }
      img, a, button {
        -webkit-user-drag: none !important;
      }
      #gameCanvas {
        cursor: crosshair;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Trata o clique esquerdo do mouse / toque na arena de combate.
   * - Clique sobre monstro: seleciona o monstro como alvo e desfere o ataque básico.
   * - Clique no chão: cancela perseguição e movimenta o personagem pelo chão da arena.
   */
  static handleArenaPointer(client, worldPt) {
    const arena = client?.actionCombatArena;
    if (!arena || !arena.isActive) return false;

    // 1. Clique sobre monstro vivo dentro do raio de seleção
    const mob = (arena.monsters || []).find(
      (m) => m.isAlive && Math.hypot(m.x - worldPt.x, m.y - 20 - worldPt.y) <= 45
    );
    if (mob) {
      arena.selectedTargetMob = mob;
      arena.triggerAttack();
      return true;
    }

    // 2. Clique no chão: cancela perseguição anterior e conduz o personagem
    if (arena.motionEngine) {
      arena.motionEngine.isApproaching = false;
      arena.motionEngine.approachTarget = null;
    }
    const acx = arena.arenaCenterX, acy = arena.arenaCenterY;
    const arx = arena.arenaRadiusX, ary = arena.arenaRadiusY;
    const adx = worldPt.x - acx, ady = worldPt.y - acy;
    const normDist = (adx * adx) / (arx * arx) + (ady * ary) / (ary * ary);
    if (normDist > 1) {
      const factor = 1 / Math.sqrt(normDist);
      worldPt.x = acx + adx * factor * 0.96;
      worldPt.y = acy + ady * factor * 0.96;
    }
    client.currentPath = null;
    client.moveTargetX = worldPt.x;
    client.moveTargetY = worldPt.y;
    return true;
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => PlayNativeAppController.init());
  } else {
    PlayNativeAppController.init();
  }
}

window.PlayNativeAppController = PlayNativeAppController;
