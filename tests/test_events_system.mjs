/**
 * @file tests/test_events_system.mjs
 * @module @etheria/tests
 * @description Suíte automatizada de verificação do Sistema Modular de Eventos (`v0.69.0`):
 *   - Virada diária exata às 00:00 no Horário de Brasília (America/Sao_Paulo / UTC-3);
 *   - Progresso acumulativo por personagem sem reset ao faltar dias e sem reinício ao concluir;
 *   - Separação estrita entre Destaques do Carrossel (`isFeatured=true`) e Grid de Ícones (`isFeatured=false`);
 *   - Vigência (`startsAt`/`endsAt`), validação Regra #10 de URLs locais e bloqueio de mochila cheia sem consumir check-in;
 *   - Integridade das 4 artes locais geradas em `apps/server/public/play/assets/events/` e módulos frontend.
 * @rules Execução 100% em memória sem mutar banco ou snapshot (Cláusula 0.2).
 * @dependencies node:assert/strict, node:fs, node:path, node:url, apps/server/dist/*
 */

import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EventDateAndRewardHelper } from '../apps/server/dist/controllers/EventDateAndRewardHelper.js';
import { GameEventsService } from '../apps/server/dist/controllers/GameEventsService.js';

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

function createInMemoryEventPrisma({ bagFreeSlots = 100 } = {}) {
  const occupiedSlots = 100 - bagFreeSlots;
  const inventoryRows = Array.from({ length: occupiedSlots }, (_, idx) => ({
    id: idx + 1,
    characterId: 1,
    itemTemplateId: 101,
    slotIndex: idx,
    quantity: 999,
  }));

  const characters = new Map([
    [1, { id: 1, level: 1, experience: 0n, gold: 100n, unspentStatPoints: 0 }],
    [2, { id: 2, level: 1, experience: 0n, gold: 100n, unspentStatPoints: 0 }],
  ]);

  const items = new Map([
    [
      101,
      {
        id: 101,
        code: 'potion_small',
        nameI18nKey: 'item.potion_small.name',
        descriptionI18nKey: 'item.potion_small.desc',
        mcreworkIconKey: '/play/assets/hud/shortcut_potion_hp.png',
        itemCategory: 'CONSUMABLE',
        equipmentSlotCode: null,
        rarityTier: 'COMMON',
        isActive: true,
      },
    ],
  ]);

  const events = [
    {
      id: 1,
      code: 'daily_login_7d',
      eventType: 'DAILY_LOGIN',
      titlePtBr: 'Login Seguido — 7 Dias',
      descriptionPtBr: 'Evento em destaque no carrossel',
      bannerImageUrl: '/play/assets/events/banner_login_7d.png',
      iconImageUrl: '/play/assets/events/icon_login_7d.png',
      isFeatured: true,
      sortOrder: 10,
      isActive: true,
      startsAt: null,
      endsAt: null,
      configJson: {
        totalDays: 7,
        days: Array.from({ length: 7 }, (_, i) => ({
          day: i + 1,
          title: `Dia ${i + 1}`,
          gold: (i + 1) * 100,
          exp: 0,
          items: [{ itemTemplateId: 101, quantity: 2 }],
        })),
      },
    },
    {
      id: 2,
      code: 'daily_login_30d',
      eventType: 'DAILY_LOGIN',
      titlePtBr: 'Jornada de Login — 30 Dias',
      descriptionPtBr: 'Evento na grid de ícones',
      bannerImageUrl: '/play/assets/events/banner_login_30d.png',
      iconImageUrl: '/play/assets/events/icon_login_30d.png',
      isFeatured: false,
      sortOrder: 20,
      isActive: true,
      startsAt: null,
      endsAt: null,
      configJson: {
        totalDays: 30,
        days: Array.from({ length: 30 }, (_, i) => ({
          day: i + 1,
          title: `Dia ${i + 1}`,
          gold: (i + 1) * 50,
          exp: 0,
          items: [],
        })),
      },
    },
  ];

  const progresses = [];
  let nextProgId = 1;

  const prisma = {
    $transaction: async (fn) => fn(prisma),
    gameEventTemplate: {
      findMany: async ({ where } = {}) => {
        return events.filter((e) => {
          if (where?.isActive !== undefined && e.isActive !== where.isActive) return false;
          if (where?.code?.in && !where.code.in.includes(e.code)) return false;
          return true;
        });
      },
      findUnique: async ({ where }) => events.find((e) => e.id === where.id || e.code === where.code) || null,
    },
    characterEventProgress: {
      findMany: async ({ where }) => progresses.filter((p) => p.characterId === where.characterId),
      findUnique: async ({ where }) => {
        const key = where.characterId_eventTemplateId;
        if (!key) return null;
        return progresses.find((p) => p.characterId === key.characterId && p.eventTemplateId === key.eventTemplateId) || null;
      },
      create: async ({ data }) => {
        const row = { id: nextProgId++, ...data, updatedAt: new Date() };
        progresses.push(row);
        return row;
      },
      updateMany: async ({ where, data }) => {
        const matches = progresses.filter((p) => {
          if (where.id !== undefined && p.id !== where.id) return false;
          if (where.claimedDaysCount !== undefined && p.claimedDaysCount !== where.claimedDaysCount) return false;
          if (where.isCompleted !== undefined && p.isCompleted !== where.isCompleted) return false;
          return true;
        });
        for (const m of matches) Object.assign(m, data);
        return { count: matches.length };
      },
    },
    playerCharacter: {
      findUnique: async ({ where }) => characters.get(Number(where.id)) || null,
      update: async ({ where, data }) => {
        const pc = characters.get(Number(where.id));
        if (data.gold?.increment) pc.gold += BigInt(data.gold.increment);
        return pc;
      },
    },
    itemTemplate: {
      findMany: async ({ where } = {}) => {
        const all = Array.from(items.values());
        if (where?.id?.in) return all.filter((it) => where.id.in.includes(it.id));
        return all;
      },
      findUnique: async ({ where }) => items.get(Number(where.id)) || null,
    },
    characterInventoryItem: {
      findMany: async ({ where }) => {
        return inventoryRows.filter((r) => {
          if (where.characterId !== undefined && r.characterId !== where.characterId) return false;
          if (where.itemTemplateId !== undefined && r.itemTemplateId !== where.itemTemplateId) return false;
          if (where.slotIndex?.lt !== undefined && !(r.slotIndex < where.slotIndex.lt)) return false;
          if (where.quantity?.lt !== undefined && !(r.quantity < where.quantity.lt)) return false;
          if (where.quantity?.gt !== undefined && !(r.quantity > where.quantity.gt)) return false;
          return true;
        });
      },
      findFirst: async ({ where }) => inventoryRows.find((r) => r.characterId === where.characterId && r.slotIndex === where.slotIndex) || null,
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
      findMany: async () => [{ key: 'item.potion_small.name', value: 'Poção Pequena' }],
    },
  };

  return { prisma, characters, progresses };
}

await test('EventDateAndRewardHelper calcula virada exatamente às 00:00 Horário de Brasília (BRT)', () => {
  const beforeMidnightBrt = new Date('2026-11-27T02:59:59.000Z'); // 23:59:59 BRT do dia 26
  const afterMidnightBrt = new Date('2026-11-27T03:00:01.000Z'); // 00:00:01 BRT do dia 27

  assert.equal(EventDateAndRewardHelper.getBrasiliaDateKey(beforeMidnightBrt), '2026-11-26');
  assert.equal(EventDateAndRewardHelper.getBrasiliaDateKey(afterMidnightBrt), '2026-11-27');

  const resetInfo = EventDateAndRewardHelper.getBrasiliaNextResetInfo(beforeMidnightBrt);
  assert.equal(resetInfo.dateKey, '2026-11-26');
  assert.equal(resetInfo.nextResetAtIso, '2026-11-27T03:00:00.000Z');
  assert.equal(resetInfo.secondsUntilReset, 1);
});

await test('computeDailyLoginProgressState acumula sem resetar ao faltar dias e não reinicia após o fim', () => {
  const cfg = EventDateAndRewardHelper.normalizeDailyLoginConfig({ totalDays: 7 });

  // Falhou ontem ('2026-11-24' -> hoje '2026-11-27'): não reseta claimedDaysCount=2, libera Dia 3
  const skippedDay = EventDateAndRewardHelper.computeDailyLoginProgressState(
    cfg,
    { claimedDaysCount: 2, lastClaimDateKey: '2026-11-24', isCompleted: false },
    '2026-11-27'
  );
  assert.equal(skippedDay.claimedDaysCount, 2);
  assert.equal(skippedDay.canClaimToday, true);
  assert.equal(skippedDay.nextClaimDay, 3);
  assert.equal(skippedDay.days[1].status, 'CLAIMED');
  assert.equal(skippedDay.days[2].status, 'AVAILABLE');

  // Após completar os 7 dias, mesmo em novo dia não reinicia
  const finished = EventDateAndRewardHelper.computeDailyLoginProgressState(
    cfg,
    { claimedDaysCount: 7, lastClaimDateKey: '2026-11-26', isCompleted: true },
    '2026-11-28'
  );
  assert.equal(finished.isCompleted, true);
  assert.equal(finished.canClaimToday, false);
  assert.equal(finished.nextClaimDay, null);
});

await test('isEventWithinSchedule e validateLocalEventAssetUrl aplicam vigência e Regra #10', () => {
  const now = new Date('2026-11-26T15:00:00.000Z');
  assert.equal(
    EventDateAndRewardHelper.isEventWithinSchedule(
      { isActive: true, startsAt: '2026-11-26T14:00:00.000Z', endsAt: '2026-11-27T14:00:00.000Z' },
      now
    ),
    true
  );
  assert.equal(
    EventDateAndRewardHelper.isEventWithinSchedule(
      { isActive: true, startsAt: '2026-11-26T16:00:00.000Z', endsAt: null },
      now
    ),
    false
  );
  assert.equal(
    EventDateAndRewardHelper.validateLocalEventAssetUrl('/play/assets/events/banner_login_7d.png'),
    '/play/assets/events/banner_login_7d.png'
  );
  assert.throws(() => EventDateAndRewardHelper.validateLocalEventAssetUrl('https://evil.com/x.png'));
  assert.throws(() => EventDateAndRewardHelper.validateLocalEventAssetUrl('/play/assets/../../secret.png'));
});

await test('GameEventsService separa Carrossel vs Grid e isola progresso por Personagem', async () => {
  const { prisma, characters } = createInMemoryEventPrisma({ bagFreeSlots: 10 });
  const day1 = new Date('2026-11-26T14:00:00.000Z'); // 11:00 BRT
  const day2 = new Date('2026-11-27T03:05:00.000Z'); // 00:05 BRT do dia seguinte

  const s1Before = await GameEventsService.getPlayEventsState(prisma, 1, day1);
  assert.equal(s1Before.featuredEvents.length, 1);
  assert.equal(s1Before.gridEvents.length, 1);
  assert.equal(s1Before.featuredEvents[0].code, 'daily_login_7d');
  assert.equal(s1Before.gridEvents[0].code, 'daily_login_30d');
  assert.equal(s1Before.pendingCount, 2);

  // Char 1 faz check-in no evento 1
  const claimRes = await GameEventsService.claimEventReward(prisma, 1, 1, day1);
  assert.equal(claimRes.claimedDay, 1);
  assert.equal(Number(characters.get(1).gold), 200);
  assert.equal(claimRes.eventsState.pendingCount, 1);

  // Não permite duplo resgate no mesmo dia BRT
  await assert.rejects(() => GameEventsService.claimEventReward(prisma, 1, 1, day1), /já realizado/i);

  // Char 2 da mesma conta ainda tem ambos eventos disponíveis (progresso por personagem)
  const s2 = await GameEventsService.getPlayEventsState(prisma, 2, day1);
  assert.equal(s2.pendingCount, 2);

  // Após virar 00:00 BRT, Char 1 pode resgatar Dia 2
  const claimDay2 = await GameEventsService.claimEventReward(prisma, 1, 1, day2);
  assert.equal(claimDay2.claimedDay, 2);
});

await test('GameEventsService bloqueia check-in com mochila cheia sem consumir o dia', async () => {
  const { prisma, progresses } = createInMemoryEventPrisma({ bagFreeSlots: 0 });
  const now = new Date('2026-11-26T14:00:00.000Z');

  await assert.rejects(() => GameEventsService.claimEventReward(prisma, 1, 1, now), /Mochila cheia/i);
  assert.equal(progresses.length, 0);
});

await test('Assets PNG locais de eventos e submódulos /play existem e respeitam estrutura modular', () => {
  const expectedFiles = [
    'apps/server/public/play/assets/events/banner_login_7d.png',
    'apps/server/public/play/assets/events/icon_login_7d.png',
    'apps/server/public/play/assets/events/banner_login_30d.png',
    'apps/server/public/play/assets/events/icon_login_30d.png',
    'apps/server/public/play/css/play_events.css',
    'apps/server/public/play/js/PlayEventDailyLoginModule.js',
    'apps/server/public/play/js/PlayEventsController.js',
    'apps/server/public/admin/js/AdminEventsModalDom.js',
    'apps/server/public/admin/js/AdminEventsTab.js',
  ];
  for (const rel of expectedFiles) {
    const abs = path.join(repoRoot, rel);
    assert.ok(fs.existsSync(abs), `Arquivo esperado ausente: ${rel}`);
    assert.ok(fs.statSync(abs).size > 200, `Arquivo vazio: ${rel}`);
  }
});

console.log(`\n🎉 Eventos — ${passed}/${total} verificações aprovadas.`);
