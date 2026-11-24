/**
 * @file packages/database/src/index.ts
 * @module @etheria/database
 * @description Ponto de entrada público do pacote de banco de dados do Etheria Campus.
 *   Exporta o cliente Prisma, o gerenciador de Snapshots JSON, cache i18n multi-locale e sementes iniciais.
 * @rules Centraliza exports públicos do pacote `@etheria/database` com isolamento estrito de dados (Cláusula 0.2).
 * @dependencies @prisma/client, ./SnapshotManager.js, ./I18nCache.js, ./seedData.js
 */

export { PrismaClient } from '@prisma/client';
export * from './SnapshotManager.js';
export * from './I18nCache.js';
export * from './seedData.js';
