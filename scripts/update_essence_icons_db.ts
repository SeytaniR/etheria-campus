import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const updates = [
  { code: 'item_essencia_humana_l30fi', icon: '/play/assets/items/essences/item_essence_humana.png' },
  { code: 'item_essencia_de_selvagem_ghj3x', icon: '/play/assets/items/essences/item_essence_selvagem.png' },
  { code: 'item_essencia_demoniaca_oaod7', icon: '/play/assets/items/essences/item_essence_demoniaca.png' },
  { code: 'item_essencia_de_planta_i8e6j', icon: '/play/assets/items/essences/item_essence_botanica.png' },
  { code: 'item_essencia_robotica_ukpuv', icon: '/play/assets/items/essences/item_essence_robotica.png' },
];

async function main() {
  for (const u of updates) {
    const res = await prisma.itemTemplate.updateMany({
      where: { code: u.code },
      data: { mcreworkIconKey: u.icon },
    });
    console.log(`Updated ${u.code}: ${res.count} rows updated to ${u.icon}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
