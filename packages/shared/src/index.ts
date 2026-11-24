/**
 * @file packages/shared/src/index.ts
 * @module @etheria/shared
 * @description Ponto de entrada público das classes Orientadas a Objetos compartilhadas entre Servidor e Cliente.
 * @rules Exporta apenas núcleo isomórfico compartilhado (@etheria/shared), mantendo ZERO duplicação entre servidor e cliente.
 * @dependencies ./MapPolygonMesh.js, ./CombatDamageCalculator.js, ./GameRulesConstants.js
 */

export * from './MapPolygonMesh.js';
export * from './CombatDamageCalculator.js';
export * from './GameRulesConstants.js';
