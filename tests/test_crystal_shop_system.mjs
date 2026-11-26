/**
 * @file tests/test_crystal_shop_system.mjs
 * @module @etheria/tests
 * @description Suíte automatizada de verificação da Moeda Cristal por Conta e Loja Cristal Modular (`v0.70.0`):
 *   - Saldo inicial zero na conta (`UserAccount.crystals`) sem placeholder fictício 1.500 na HUD/Mochila;
 *   - Compartilhamento de Cristais entre personagens da mesma conta + histórico `CrystalTransaction`;
 *   - Débito atômico CAS (`debitCrystalsAtomic`) bloqueando saldo insuficiente sem negativar;
 *   - Separação Carrossel (`isFeatured=true`) vs Grid (`isFeatured=false`) e vigência opcional;
 *   - Compra autoritativa entregando itens na mochila e bloqueando mochila cheia SEM debitar Cristais;
 *   - Presença dos módulos frontend (`/play` e `/admin`).
 * @rules Execução 100% em memória sem mutar banco ou snapshot (Cláusula 0.2).
 * @dependencies node:assert/strict, node:fs, node:path, node:url, apps/server/dist/*
 */

import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CrystalCurrencyService } from '../apps/server/dist/controllers/CrystalCurrencyService.js';
import { CrystalShopService } from '../apps/server/dist/controllers/CrystalShopService.js';
import { CharacterInventoryService } from '../apps/server/dist/controllers/CharacterInventoryService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

let passed = 0;
let total = 0;
async function test(name, fn) {
  total++;
  try {
    await fn();
    passed++;
    console.log(`✅ [PASS] ${name}`);
  } catch (err) {
    console.error(`❌ [FAIL] ${name}:`, err);
    process.exitCode = 1;
  }
}

function createInMemoryCrystalPrisma({ initialCrystals = 0n, bagFreeSlots = 100 } = {}) {
  const accounts = new Map([
    [1, { id: 1, crystals: initialCrystals }],
  ]);
  const characters = new Map([
    [1, { id: 1, userAccountId: 1, gold: 50n }],
    [2, { id: 2, userAccountId: 1, gold: 80n }],
  ]);
  const transactions = [];

  const occupiedSlots = 100 - bagFreeSlots;
  const inventoryRows = Array.from({ length: occupiedSlots }, (_, idx) => ({
    id: idx + 1,
    characterId: 1,
    itemTemplateId: 999,
    slotIndex: idx,
    quantity: 1,
  }));

  const potionItem = {
    id: 201,
    code: 'elixir_crystal_sup',
    nameI18nKey: 'item.elixir.name',
    descriptionI18nKey: 'item.elixir.desc',
    mcreworkIconKey: '/play/assets/hud/shortcut_potion_hp.png',
    itemCategory: 'CONSUMABLE',
    equipmentSlotCode: null,
    equipmentSetId: null,
    equipmentSlot: null,
    equipmentSet: null,
    rarityTier: 'A',
    requiredLevel: 5,
    combatStatBonusesJson: {},
    effectType: 'HEAL_HP',
    specialEffectJson: {},
    isActive: true,
  };

  const swordItem = {
    id: 202,
    code: 'espada_safira',
    nameI18nKey: 'item.sword.name',
    descriptionI18nKey: 'item.sword.desc',
    mcreworkIconKey: '/play/assets/hud/menu_shop.png',
    itemCategory: 'CHARACTER_EQUIPMENT',
    equipmentSlotCode: 'WEAPON_1',
    equipmentSetId: null,
    equipmentSlot: { code: 'WEAPON_1', nameI18nKey: 'slot.weapon1.name' },
    equipmentSet: null,
    rarityTier: 'S',
    requiredLevel: 20,
    combatStatBonusesJson: { PHYS_ATK: 120, CRIT_CHANCE_PCT: 8 },
    effectType: null,
    specialEffectJson: {},
    isActive: true,
  };

  const itemsMap = new Map([
    [201, potionItem],
    [202, swordItem],
  ]);

  const offers = [
    {
      id: 1,
      code: 'offer_sword_featured',
      itemTemplateId: 202,
      quantity: 1,
      priceCrystals: 300,
      titlePtBr: 'Espada Safira Destaque',
      descriptionPtBr: 'Arma lendária exclusiva da Loja Cristal.',
      bannerImageUrl: '/play/assets/events/banner_login_30d.png',
      iconImageUrl: '',
      isFeatured: true,
      sortOrder: 10,
      isActive: true,
      startsAt: null,
      endsAt: null,
      itemTemplate: swordItem,
    },
    {
      id: 2,
      code: 'offer_elixir_grid',
      itemTemplateId: 201,
      quantity: 5,
      priceCrystals: 50,
      titlePtBr: null,
      descriptionPtBr: null,
      bannerImageUrl: '',
      iconImageUrl: '',
      isFeatured: false,
      sortOrder: 20,
      isActive: true,
      startsAt: null,
      endsAt: null,
      itemTemplate: potionItem,
    },
    {
      id: 3,
      code: 'offer_expired',
      itemTemplateId: 201,
      quantity: 10,
      priceCrystals: 10,
      titlePtBr: 'Oferta Expirada',
      descriptionPtBr: '',
      bannerImageUrl: '',
      iconImageUrl: '',
      isFeatured: false,
      sortOrder: 30,
      isActive: true,
      startsAt: new Date('2025-01-01T00:00:00.000Z'),
      endsAt: new Date('2025-01-02T00:00:00.000Z'),
      itemTemplate: potionItem,
    },
  ];

  const prisma = {
    $transaction: async (fn) => fn(prisma),
    userAccount: {
      findUnique: async ({ where }) => accounts.get(Number(where.id)) || null,
      update: async ({ where, data }) => {
        const acc = accounts.get(Number(where.id));
        if (data.crystals?.increment !== undefined) acc.crystals += BigInt(data.crystals.increment);
        return acc;
      },
      updateMany: async ({ where, data }) => {
        const acc = accounts.get(Number(where.id));
        if (!acc) return { count: 0 };
        if (where.crystals?.gte !== undefined && acc.crystals < BigInt(where.crystals.gte)) {
          return { count: 0 };
        }
        if (data.crystals?.decrement !== undefined) {
          acc.crystals -= BigInt(data.crystals.decrement);
        }
        return { count: 1 };
      },
    },
    crystalTransaction: {
      create: async ({ data }) => {
        const tx = { id: transactions.length + 1, ...data, createdAt: new Date() };
        transactions.push(tx);
        return tx;
      },
    },
    playerCharacter: {
      findUnique: async ({ where }) => {
        const pc = characters.get(Number(where.id));
        if (!pc) return null;
        return { ...pc, userAccount: accounts.get(pc.userAccountId) };
      },
    },
    crystalShopOffer: {
      findMany: async ({ where } = {}) => offers.filter((o) => (where?.isActive !== undefined ? o.isActive === where.isActive : true)),
      findUnique: async ({ where }) => offers.find((o) => o.id === Number(where.id) || o.code === where.code) || null,
    },
    itemTemplate: {
      findMany: async ({ where } = {}) => {
        const all = Array.from(itemsMap.values());
        if (where?.id?.in) return all.filter((it) => where.id.in.includes(it.id));
        return all;
      },
      findUnique: async ({ where }) => itemsMap.get(Number(where.id)) || null,
    },
    characterInventoryItem: {
      count: async ({ where }) =>
        inventoryRows.filter(
          (r) =>
            r.characterId === where.characterId &&
            r.slotIndex < (where.slotIndex?.lt ?? 9999) &&
            r.quantity > (where.quantity?.gt ?? -1)
        ).length,
      findMany: async ({ where }) =>
        inventoryRows.filter((r) => {
          if (where.characterId !== undefined && r.characterId !== where.characterId) return false;
          if (where.itemTemplateId !== undefined && r.itemTemplateId !== where.itemTemplateId) return false;
          if (where.slotIndex?.lt !== undefined && !(r.slotIndex < where.slotIndex.lt)) return false;
          if (where.quantity?.lt !== undefined && !(r.quantity < where.quantity.lt)) return false;
          if (where.quantity?.gt !== undefined && !(r.quantity > where.quantity.gt)) return false;
          return true;
        }),
      findFirst: async ({ where }) =>
        inventoryRows.find((r) => r.characterId === where.characterId && r.slotIndex === where.slotIndex) || null,
      create: async ({ data }) => {
        const row = { id: inventoryRows.length + 1, ...data };
        inventoryRows.push(row);
        return row;
      },
      update: async ({ where, data }) => {
        const r = inventoryRows.find((x) => x.id === where.id);
        if (r) Object.assign(r, data);
        return r;
      },
    },
    i18nTranslation: {
      findMany: async () => [
        { locale: 'pt-BR', key: 'item.elixir.name', text: 'Elixir Supremo' },
        { locale: 'pt-BR', key: 'item.elixir.desc', text: 'Recupera HP rapidamente.' },
        { locale: 'pt-BR', key: 'slot.weapon1.name', text: 'Arma Principal' },
      ],
    },
  };

  return { prisma, accounts, transactions, inventoryRows };
}

await test('CrystalCurrencyService credita, debita atomicamente e registra ledger sem permitir saldo negativo', async () => {
  const { prisma, transactions } = createInMemoryCrystalPrisma({ initialCrystals: 0n });
  assert.equal(await CrystalCurrencyService.getAccountCrystals(prisma, 1), 0);

  const cr = await CrystalCurrencyService.creditCrystals(prisma, 1, 200, 'ADMIN_GRANT');
  assert.equal(cr.balanceAfter, 200);

  const deb = await CrystalCurrencyService.debitCrystalsAtomic(prisma, 1, 75, 'CRYSTAL_SHOP_PURCHASE', { characterId: 1 });
  assert.equal(deb.balanceAfter, 125);

  await assert.rejects(
    () => CrystalCurrencyService.debitCrystalsAtomic(prisma, 1, 500, 'CRYSTAL_SHOP_PURCHASE'),
    /Cristais insuficientes/i
  );
  assert.equal(await CrystalCurrencyService.getAccountCrystals(prisma, 1), 125);
  assert.equal(transactions.length, 2);
});

await test('CrystalShopService separa Carrossel vs Grid, aplica vigência e compartilha saldo da conta entre personagens', async () => {
  const { prisma } = createInMemoryCrystalPrisma({ initialCrystals: 400n });
  const now = new Date('2026-11-26T20:00:00.000Z');

  const s1 = await CrystalShopService.getPlayShopState(prisma, 1, now);
  const s2 = await CrystalShopService.getPlayShopState(prisma, 2, now);
  assert.equal(s1.crystals, 400);
  assert.equal(s2.crystals, 400);
  assert.equal(s1.featuredOffers.length, 1);
  assert.equal(s1.gridOffers.length, 1);
  assert.equal(s1.featuredOffers[0].code, 'offer_sword_featured');
  assert.equal(s1.gridOffers[0].titlePtBr, 'Elixir Supremo');
  assert.equal(s1.gridOffers[0].quantity, 5);
});

await test('CrystalShopService compra em Cristais entregando itens e atualizando saldo compartilhado', async () => {
  const { prisma, inventoryRows } = createInMemoryCrystalPrisma({ initialCrystals: 400n, bagFreeSlots: 10 });
  const now = new Date('2026-11-26T20:00:00.000Z');

  const res = await CrystalShopService.purchaseOffer(prisma, 1, 2, now);
  assert.equal(res.ok, true);
  assert.equal(res.crystals, 350);
  assert.equal(res.quantity, 5);
  assert.ok(inventoryRows.some((r) => r.characterId === 1 && r.itemTemplateId === 201 && r.quantity === 5));

  // Personagem 2 da mesma conta já enxerga os 350 Cristais atualizados
  const s2 = await CrystalShopService.getPlayShopState(prisma, 2, now);
  assert.equal(s2.crystals, 350);
});

await test('CrystalShopService bloqueia mochila cheia e saldo insuficiente SEM debitar Cristais', async () => {
  const { prisma } = createInMemoryCrystalPrisma({ initialCrystals: 500n, bagFreeSlots: 0 });
  const now = new Date('2026-11-26T20:00:00.000Z');

  await assert.rejects(() => CrystalShopService.purchaseOffer(prisma, 1, 1, now), /Mochila cheia/i);
  assert.equal(await CrystalCurrencyService.getAccountCrystals(prisma, 1), 500);

  const lowCrystals = createInMemoryCrystalPrisma({ initialCrystals: 10n, bagFreeSlots: 10 });
  await assert.rejects(() => CrystalShopService.purchaseOffer(lowCrystals.prisma, 1, 2, now), /Cristais insuficientes/i);
  assert.equal(lowCrystals.inventoryRows.length, 90);
});

await test('CharacterInventoryService e PlayHudController não usam mais valor fictício 1500 para Cristais', async () => {
  const { prisma } = createInMemoryCrystalPrisma({ initialCrystals: 0n });
  const bag = await CharacterInventoryService.getWalletAndBag(prisma, 1);
  assert.equal(bag.crystals, 0);
  assert.equal(bag.diamonds, 0);

  const hudSrc = fs.readFileSync(path.join(repoRoot, 'apps/server/public/play/js/PlayHudController.js'), 'utf-8');
  assert.ok(!hudSrc.includes('diamonds: 1500'), 'PlayHudController.js não pode manter diamonds: 1500');
  assert.ok(!hudSrc.includes('1,500'), 'PlayHudController.js não pode manter 1,500 hardcoded');
});

await test('Arquivos da Loja Cristal no /play e /admin existem e estão íntegros', () => {
  const files = [
    'apps/server/public/play/css/play_crystal_shop.css',
    'apps/server/public/play/js/PlayCrystalShopItemModule.js',
    'apps/server/public/play/js/PlayCrystalShopController.js',
    'apps/server/public/admin/js/AdminCrystalShopModalDom.js',
    'apps/server/public/admin/js/AdminCrystalShopTab.js',
  ];
  for (const rel of files) {
    const abs = path.join(repoRoot, rel);
    assert.ok(fs.existsSync(abs), `Arquivo ausente: ${rel}`);
    assert.ok(fs.statSync(abs).size > 200, `Arquivo vazio: ${rel}`);
  }
});

console.log(`\n💎 Loja Cristal — ${passed}/${total} verificações aprovadas.`);
