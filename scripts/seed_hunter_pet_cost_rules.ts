import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const defaultRules = [
  { id: 1, rarityTier: 'F', essenceCost: 30, goldCost: 0 },
  { id: 2, rarityTier: 'D', essenceCost: 70, goldCost: 0 },
  { id: 3, rarityTier: 'C', essenceCost: 120, goldCost: 0 },
  { id: 4, rarityTier: 'B', essenceCost: 300, goldCost: 0 },
  { id: 5, rarityTier: 'A', essenceCost: 700, goldCost: 0 },
  { id: 6, rarityTier: 'S', essenceCost: 1600, goldCost: 0 },
  { id: 7, rarityTier: 'SS', essenceCost: 3500, goldCost: 0 },
];

async function main() {
  for (const r of defaultRules) {
    await (prisma as any).hunterPetCostRule.upsert({
      where: { rarityTier: r.rarityTier },
      update: { essenceCost: r.essenceCost, goldCost: r.goldCost },
      create: { id: r.id, rarityTier: r.rarityTier, essenceCost: r.essenceCost, goldCost: r.goldCost },
    });
  }

  await prisma.npcTemplate.updateMany({
    where: { id: { in: [8, 15] } },
    data: { rolesJson: ['HUNTER'] as any },
  });
  await prisma.npcTemplate.updateMany({
    where: { id: 3 },
    data: { rolesJson: ['ARMORER'] as any },
  });
  await prisma.npcTemplate.updateMany({
    where: { id: 7 },
    data: { rolesJson: ['ALCHEMIST'] as any },
  });

  console.log('✅ Hunter Pet Cost Rules and NPC roles seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
