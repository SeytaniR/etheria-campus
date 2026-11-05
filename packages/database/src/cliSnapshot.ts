/**
 * @file packages/database/src/cliSnapshot.ts
 * @module @etheria/database
 * @description Utilitário de linha de comando para exportar o Snapshot JSON do banco PostgreSQL.
 * @rules Mantém o arquivo `packages/database/snapshots/lowcode.snapshot.json` sincronizado no Git.
 */

import { PrismaClient } from '@prisma/client';
import { SnapshotManager } from './SnapshotManager.js';

async function main() {
  const prisma = new PrismaClient();
  try {
    const manager = new SnapshotManager(prisma);
    const savedPath = await manager.exportToDisk();
    console.log(`✅ [SnapshotManager] Snapshot exportado com sucesso em: ${savedPath}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('❌ Erro ao exportar snapshot:', err);
  process.exit(1);
});
