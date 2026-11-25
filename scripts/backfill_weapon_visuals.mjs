/**
 * @file scripts/backfill_weapon_visuals.mjs
 * @module @etheria/scripts
 * @description Script idempotente e não-destrutivo de backfill dos modelos 2.5D (`equip_mc*` / `equip_fc*`)
 *   para todas as armas `WEAPON_1` já cadastradas em `item_templates`, preservando 100% dos atributos,
 *   nomes, ícones e configurações existentes e espelhando os sprites localmente em `apps/server/cache/mcrework/` (Regra #10).
 * @dependencies @prisma/client, ../apps/server/dist/controllers/AssetMirrorService.js, ../apps/server/dist/controllers/AdminEquipmentsController.js
 */

import { PrismaClient } from '@prisma/client';
import { AssetMirrorService } from '../apps/server/dist/controllers/AssetMirrorService.js';
import { AdminEquipmentsController } from '../apps/server/dist/controllers/AdminEquipmentsController.js';

async function main() {
  const prisma = new PrismaClient();
  const assetMirrorService = new AssetMirrorService();
  const equipmentsController = new AdminEquipmentsController(prisma, assetMirrorService);

  try {
    console.log('⚔️ Executando backfill automático dos visuais 2.5D das armas (WEAPON_1)...');
    const summary = await equipmentsController.backfillMissingWeaponVisuals({ awaitMirror: true });
    console.log(
      `✅ Concluído: linked=${summary.linked}, skipped=${summary.skipped}, unmatched=${summary.unmatched}`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('❌ Falha no backfill de visuais 2.5D de armas:', err);
  process.exit(1);
});
