/**
 * @file scripts/sanitize_mounts_and_sets_stats.ts
 * @module @etheria/scripts
 * @description Sanitização oficial de Montarias Voadoras (`flying_mount_templates`, itens `FLYING_MOUNT`)
 *   e Conjuntos de Equipamentos (`equipment_sets`) para que interfiram EXCLUSIVAMENTE nos 6 atributos
 *   permitidos: MAX_HP, MAX_MP, PHYS_ATK, MAG_ATK, PHYS_DEF e MAG_DEF.
 *   Remove quaisquer bônus de outros atributos (base ou combate) e sincroniza o `lowcode.snapshot.json`.
 */

import { PrismaClient } from '@prisma/client';
import { SnapshotManager } from '@etheria/database';

const ALLOWED = new Set(['MAX_HP', 'MAX_MP', 'PHYS_ATK', 'MAG_ATK', 'PHYS_DEF', 'MAG_DEF']);

function sanitizeStats(raw: any): { cleaned: Record<string, number>; removedKeys: string[] } {
  const cleaned: Record<string, number> = {};
  const removedKeys: string[] = [];
  if (!raw || typeof raw !== 'object') return { cleaned, removedKeys };
  for (const [rawKey, rawVal] of Object.entries(raw)) {
    const key = rawKey === 'PDEF' ? 'PHYS_DEF' : rawKey === 'MDEF' ? 'MAG_DEF' : rawKey;
    const num = Number(rawVal);
    if (ALLOWED.has(key)) {
      if (Number.isFinite(num) && num !== 0) cleaned[key] = num;
    } else {
      removedKeys.push(rawKey);
    }
  }
  return { cleaned, removedKeys };
}

async function main() {
  const prisma = new PrismaClient();
  let mountsUpdated = 0;
  let mountItemsUpdated = 0;
  let setsUpdated = 0;

  try {
    // 1. FlyingMountTemplate: limpa baseAttributesJson -> {} e restringe combatAttributesJson aos 6 permitidos
    const mounts = await prisma.flyingMountTemplate.findMany({ orderBy: { id: 'asc' } });
    for (const m of mounts) {
      const baseKeys = m.baseAttributesJson && typeof m.baseAttributesJson === 'object'
        ? Object.keys(m.baseAttributesJson as Record<string, any>)
        : [];
      const { cleaned, removedKeys } = sanitizeStats(m.combatAttributesJson);
      const changed =
        baseKeys.length > 0 ||
        removedKeys.length > 0 ||
        JSON.stringify(cleaned) !== JSON.stringify(m.combatAttributesJson || {});
      if (changed) {
        await prisma.flyingMountTemplate.update({
          where: { id: m.id },
          data: {
            baseAttributesJson: {},
            combatAttributesJson: cleaned,
          },
        });
        mountsUpdated++;
      }
    }

    // 2. ItemTemplate com slot FLYING_MOUNT: limpa baseStatBonusesJson -> {} e restringe combatStatBonusesJson aos 6 permitidos
    const mountItems = await prisma.itemTemplate.findMany({
      where: { equipmentSlotCode: 'FLYING_MOUNT' },
      orderBy: { id: 'asc' },
    });
    for (const it of mountItems) {
      const baseKeys = it.baseStatBonusesJson && typeof it.baseStatBonusesJson === 'object'
        ? Object.keys(it.baseStatBonusesJson as Record<string, any>)
        : [];
      const { cleaned, removedKeys } = sanitizeStats(it.combatStatBonusesJson);
      const changed =
        baseKeys.length > 0 ||
        removedKeys.length > 0 ||
        JSON.stringify(cleaned) !== JSON.stringify(it.combatStatBonusesJson || {});
      if (changed) {
        await prisma.itemTemplate.update({
          where: { id: it.id },
          data: {
            baseStatBonusesJson: {},
            combatStatBonusesJson: cleaned,
          },
        });
        mountItemsUpdated++;
      }
    }

    // 3. EquipmentSet: restringe bonusCombatStatsJson aos 6 permitidos
    const sets = await prisma.equipmentSet.findMany({ orderBy: { id: 'asc' } });
    for (const s of sets) {
      const { cleaned, removedKeys } = sanitizeStats(s.bonusCombatStatsJson);
      const changed =
        removedKeys.length > 0 ||
        JSON.stringify(cleaned) !== JSON.stringify(s.bonusCombatStatsJson || {});
      if (changed) {
        await prisma.equipmentSet.update({
          where: { id: s.id },
          data: {
            bonusCombatStatsJson: cleaned,
          },
        });
        setsUpdated++;
      }
    }

    if (mountsUpdated > 0 || mountItemsUpdated > 0 || setsUpdated > 0) {
      const snapshotManager = new SnapshotManager(prisma);
      await snapshotManager.exportToDisk();
    }

    console.log(
      `✅ [sanitize_mounts_and_sets_stats] Montarias atualizadas: ${mountsUpdated}/${mounts.length} | Itens FLYING_MOUNT atualizados: ${mountItemsUpdated}/${mountItems.length} | Conjuntos atualizados: ${setsUpdated}/${sets.length}`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('❌ Erro em sanitize_mounts_and_sets_stats:', err);
  process.exit(1);
});
