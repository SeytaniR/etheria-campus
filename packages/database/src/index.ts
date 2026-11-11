/**
 * @file packages/database/src/index.ts
 * @module @etheria/database
 * @description Ponto de entrada público do pacote de banco de dados do Etheria Campus.
 *   Exporta o cliente Prisma, o gerenciador de Snapshots JSON e as sementes iniciais.
 */

export { PrismaClient } from '@prisma/client';
export * from './SnapshotManager.js';
export * from './I18nCache.js';
export * from './seedData.js';
