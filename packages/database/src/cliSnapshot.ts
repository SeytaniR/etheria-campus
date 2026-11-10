/**
 * @file packages/database/src/cliSnapshot.ts
 * @module @etheria/database
 * @description Utilitário de linha de comando para exportar ou restaurar o Snapshot JSON do banco PostgreSQL.
 * @rules Mantém o arquivo `packages/database/snapshots/lowcode.snapshot.json` sincronizado no Git.
 */

import { PrismaClient } from '@prisma/client';
import { SnapshotManager } from './SnapshotManager.js';

async function main() {
  const action = process.argv[2] || 'export';
  const prisma = new PrismaClient();
  try {
    const manager = new SnapshotManager(prisma);
    if (action === 'restore') {
      await manager.restoreFromDisk();
      console.log(`✅ [SnapshotManager] Restauração concluída com sucesso!`);
    } else {
      const savedPath = await manager.exportToDisk();
      console.log(`✅ [SnapshotManager] Snapshot exportado com sucesso em: ${savedPath}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('❌ Erro no Snapshot CLI:', err);
  process.exit(1);
});
