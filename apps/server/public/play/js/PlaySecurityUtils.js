/**
 * @file apps/server/public/play/js/PlaySecurityUtils.js
 * @module @etheria/play/security
 * @description Utilitários leves de sanitização HTML no cliente `/play` para mitigação contra Stored XSS.
 * @rules
 *   - Deve ser aplicado a qualquer identificador ou texto dinâmico originado de usuários antes de interpolar em `innerHTML`.
 * @dependencies Nenhuma dependência externa.
 */

window.EtheriaSanitizer = {
  escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },
};
