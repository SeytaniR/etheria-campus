/**
 * @file tests/test_fishing_system.mjs
 * @module @etheria/tests
 * @description Suíte automatizada de verificação do Sistema de Pesca (`v0.66.0`):
 *   - Proximidade geométrica à malha de pesca (`MapPolygonMesh.findClosestPoint` + `ClientPolygonMesh.findClosestFishingPoint`);
 *   - Fila ordenada de iscas (`pickNextAvailableBait`: consome 1ª, passa para 2ª, 3ª...);
 *   - Sorteio Rank-First de peixes com redistribuição automática de pesos e bônus de raridade da isca;
 *   - Normalização de config de Vara de Pesca e registro das 3 novas UIs em `AdminUiLayoutsController.getDefaultSeeds()`.
 * @rules Execução 100% em memória sem mutar banco ou snapshot (Cláusula 0.2).
 * @dependencies node:assert/strict, node:fs, node:path, node:url, node:vm, @etheria/shared, apps/server/dist/*
 */

import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as vm from 'node:vm';
import { MapPolygonMesh } from '../packages/shared/dist/index.js';
import {
  computeEffectiveRankWeights,
  FishingService,
  pickNextAvailableBait,
  rollFishByRankFirst,
} from '../apps/server/dist/controllers/FishingService.js';
import { CharacterActivityStateService } from '../apps/server/dist/controllers/CharacterActivityStateService.js';
import { AssetMirrorService } from '../apps/server/dist/controllers/AssetMirrorService.js';
import { CharacterInventoryService } from '../apps/server/dist/controllers/CharacterInventoryService.js';
import { I18nCache } from '../packages/database/dist/I18nCache.js';
import { normalizeFishingRodConfig } from '../apps/server/dist/controllers/AdminFishingRodsController.js';
import { AdminUiLayoutsController } from '../apps/server/dist/controllers/AdminUiLayoutsController.js';
import {
  FISH_CATALOG,
  BAIT_CATALOG,
  ROD_CATALOG,
  MINHOCA_ICON_PATH,
  MINHOCA_DEFAULT_CONFIG,
} from '../scripts/seed_fishing_pack_v1.mjs';

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

await test('MapPolygonMesh.findClosestPoint calcula distância 0 dentro e projeta borda próxima dentro do limite', () => {
  const pond = [
    {
      id: 'fsh_1',
      name: 'Lago Sul',
      points: [
        { x: 100, y: 100 },
        { x: 200, y: 100 },
        { x: 200, y: 200 },
        { x: 100, y: 200 },
      ],
    },
  ];
  const mesh = new MapPolygonMesh(pond);

  const inside = mesh.findClosestPoint(150, 150, 96);
  assert.ok(inside);
  assert.equal(inside.inside, true);
  assert.equal(inside.distance, 0);

  const nearEdge = mesh.findClosestPoint(250, 150, 96);
  assert.ok(nearEdge);
  assert.equal(nearEdge.inside, false);
  assert.equal(Math.round(nearEdge.distance), 50);
  assert.deepEqual(nearEdge.point, { x: 200, y: 150 });

  const tooFar = mesh.findClosestPoint(350, 150, 96);
  assert.equal(tooFar, null);
});

await test('ClientPolygonMesh.findClosestFishingPoint mantém paridade geométrica exata com o servidor', () => {
  const code = fs.readFileSync(
    path.join(repoRoot, 'apps/server/public/play/js/ClientPolygonMesh.js'),
    'utf8'
  );
  const sandbox = { window: {} };
  sandbox.window = sandbox;
  vm.runInNewContext(code, sandbox);

  const pond = [
    {
      id: 'fsh_lake',
      name: 'Lago Norte',
      points: [
        { x: 300, y: 300 },
        { x: 420, y: 300 },
        { x: 420, y: 420 },
        { x: 300, y: 420 },
      ],
    },
  ];
  const mesh = new sandbox.ClientPolygonMesh([], [], 0.45, [], [], pond);
  const hit = mesh.findClosestFishingPoint(460, 360, 96);
  assert.ok(hit);
  assert.equal(Math.round(hit.distance), 40);
  assert.deepEqual({ x: hit.point.x, y: hit.point.y }, { x: 420, y: 360 });
  assert.equal(mesh.findClosestFishingPoint(600, 360, 96), null);
});

await test('pickNextAvailableBait respeita estritamente a ordem 1 -> 2 -> 3 e avança quando a isca zera', () => {
  const queue = [101, 102, 103];
  const inv = new Map([
    [101, 2],
    [102, 5],
    [103, 1],
  ]);

  assert.equal(pickNextAvailableBait(queue, inv), 101);
  inv.set(101, 0);
  assert.equal(pickNextAvailableBait(queue, inv), 102);
  inv.set(102, 0);
  assert.equal(pickNextAvailableBait(queue, inv), 103);
  inv.set(103, 0);
  assert.equal(pickNextAvailableBait(queue, inv), null);
});

await test('rollFishByRankFirst redistribui pesos entre ranks disponíveis e aplica bônus de isca para raridades altas', () => {
  const rodWeights = { F: 50, D: 25, C: 15, B: 6, A: 3, S: 1, SS: 0 };
  const baitBonus = { F: 0, D: 0, C: 0, B: 10, A: 15, S: 10, SS: 5 };
  const effective = computeEffectiveRankWeights(rodWeights, baitBonus);

  assert.equal(effective.B, 16);
  assert.equal(effective.SS, 5);

  const fishByRank = new Map([
    ['F', [{ id: 1, code: 'fish_1', namePtBr: 'Lambari', rarityTier: 'F', iconUrl: '' }]],
    ['D', []],
    ['C', []],
    ['B', []],
    ['A', [{ id: 2, code: 'fish_2', namePtBr: 'Salmão Dourado', rarityTier: 'A', iconUrl: '' }]],
    ['S', [{ id: 3, code: 'fish_3', namePtBr: 'Tubarão Arcano', rarityTier: 'S', iconUrl: '' }]],
    ['SS', [{ id: 4, code: 'fish_4', namePtBr: 'Dragão Abissal', rarityTier: 'SS', iconUrl: '' }]],
  ]);

  // Apenas ranks com peixes entram: F (50), A (18), S (11), SS (5) => total = 84
  // Com rng near 0.99, deve escolher SS
  const mythFish = rollFishByRankFirst(effective, fishByRank, () => 0.99);
  assert.ok(mythFish);
  assert.equal(mythFish.rarityTier, 'SS');

  // Com rng = 0.01, escolhe F
  const commonFish = rollFishByRankFirst(effective, fishByRank, () => 0.01);
  assert.ok(commonFish);
  assert.equal(commonFish.rarityTier, 'F');

  // Banco sem peixes retorna null com segurança
  assert.equal(rollFishByRankFirst(effective, new Map()), null);
});

await test('normalizeFishingRodConfig aplica limites e defaults seguros', () => {
  const def = normalizeFishingRodConfig({});
  assert.equal(def.castIntervalSec, 10);
  assert.equal(def.catchChancePct, 65);

  const clamped = normalizeFishingRodConfig({ castIntervalSec: 0, catchChancePct: 500, rankWeights: { F: -5, SS: 20 } });
  assert.equal(clamped.castIntervalSec, 2);
  assert.equal(clamped.catchChancePct, 100);
  assert.equal(clamped.rankWeights.SS, 20);
});

await test('AdminUiLayoutsController registra as 3 novas interfaces de pesca para /admin e HUD pessoal', () => {
  const seeds = AdminUiLayoutsController.getDefaultSeeds();
  const codes = new Set(seeds.map((s) => s.code));
  assert.ok(codes.has('HUD_FISHING_ACTION_BTN'));
  assert.ok(codes.has('HUD_FISHING_STATUS_BAR'));
  assert.ok(codes.has('MODAL_FISHING_SETUP'));

  for (const code of ['HUD_FISHING_ACTION_BTN', 'HUD_FISHING_STATUS_BAR', 'MODAL_FISHING_SETUP']) {
    const entry = seeds.find((s) => s.code === code);
    assert.ok(entry.mobilePortrait && entry.mobileLandscape && entry.desktop);
  }
});

await test('CharacterActivityStateService e FishingService impõem estado único mutuamente exclusivo (EXPLORING / COMBAT / FISHING)', async () => {
  CharacterActivityStateService.clearAllForTests();
  I18nCache.invalidate();
  const charId = 777;
  const mockPrisma = {
    i18nTranslation: { findMany: async () => [] },
    playerCharacter: {
      findUnique: async ({ where }) => ({
        id: where.id,
        level: 60,
        currentMapId: 1,
        posX: 150,
        posY: 150,
        isFlying: false,
        equippedItemsJson: { FISHING_ROD: 901 },
      }),
    },
    itemTemplate: {
      count: async () => 1,
      findUnique: async ({ where }) =>
        where.id === 901
          ? {
              id: 901,
              code: 'rod_1',
              nameI18nKey: 'item.rod_1',
              itemCategory: 'FISHING_ROD',
              equipmentSlotCode: 'FISHING_ROD',
              isActive: true,
              requiredLevel: 50,
              rarityTier: 'F',
              mcreworkIconKey: 'assets/equipment/icons/equip_normal_600001.png',
              specialEffectJson: {
                fishingRodConfig: { castIntervalSec: 10, catchChancePct: 65, rankWeights: { F: 100 } },
              },
            }
          : null,
    },
    gameMap: {
      findUnique: async () => ({
        id: 1,
        fishingMeshJson: [
          {
            id: 'pond_test',
            name: 'Lago Teste',
            points: [
              { x: 100, y: 100 },
              { x: 200, y: 100 },
              { x: 200, y: 200 },
              { x: 100, y: 200 },
            ],
          },
        ],
      }),
    },
    characterInventoryItem: { findMany: async () => [] },
  };

  assert.equal(CharacterActivityStateService.getState(charId), 'EXPLORING');

  // EXPLORING -> COMBAT bloqueia pesca
  assert.deepEqual(CharacterActivityStateService.enterCombat(charId, 'battle_1'), { ok: true });
  assert.equal(CharacterActivityStateService.getState(charId), 'COMBAT');
  const blockedFish = CharacterActivityStateService.enterFishing(charId);
  assert.equal(blockedFish.ok, false);
  await assert.rejects(
    FishingService.startFishing(mockPrisma, 'PLAYER', charId, { posX: 150, posY: 150 }),
    /combate/i
  );

  // COMBAT -> EXPLORING libera pesca
  CharacterActivityStateService.exitCombat(charId, 'battle_1');
  assert.equal(CharacterActivityStateService.getState(charId), 'EXPLORING');

  // EXPLORING -> FISHING bloqueia combate direto até parar
  const started = await FishingService.startFishing(mockPrisma, 'PLAYER', charId, { posX: 150, posY: 150 });
  assert.equal(started.active, true);
  assert.equal(CharacterActivityStateService.getState(charId), 'FISHING');
  assert.equal(FishingService.hasActiveSession(charId), true);
  const blockedCombat = CharacterActivityStateService.enterCombat(charId, 'battle_2');
  assert.equal(blockedCombat.ok, false);

  // tickFishing interrompe imediatamente caso combate seja ativado
  CharacterActivityStateService.forceEnterCombat(charId, 'battle_force');
  const tickRes = await FishingService.tickFishing(mockPrisma, charId);
  assert.equal(tickRes.active, false);
  assert.equal(tickRes.stoppedReason, 'IN_COMBAT');
  assert.equal(FishingService.hasActiveSession(charId), false);
  CharacterActivityStateService.exitCombat(charId, 'battle_force');
  assert.equal(CharacterActivityStateService.getState(charId), 'EXPLORING');

  // stopSession devolve FISHING -> EXPLORING
  await FishingService.startFishing(mockPrisma, 'PLAYER', charId, { posX: 150, posY: 150 });
  assert.equal(CharacterActivityStateService.getState(charId), 'FISHING');
  FishingService.stopSession(charId);
  assert.equal(CharacterActivityStateService.getState(charId), 'EXPLORING');

  CharacterActivityStateService.clearAllForTests();
  I18nCache.invalidate();
});

await test('Frontend PlayFishingController e CSS ocultam UI de pesca e bloqueiam ações durante combate', async () => {
  const code = fs.readFileSync(
    path.join(repoRoot, 'apps/server/public/play/js/PlayFishingController.js'),
    'utf8'
  );
  const chatCss = fs.readFileSync(
    path.join(repoRoot, 'apps/server/public/play/css/play_chat_and_modals.css'),
    'utf8'
  );
  const fishCss = fs.readFileSync(
    path.join(repoRoot, 'apps/server/public/play/css/play_fishing.css'),
    'utf8'
  );

  assert.match(chatCss, /body\.is-in-combat\s+#hudFishingActionBtn[\s\S]*display:\s*none\s*!important/i);
  assert.match(fishCss, /body\.is-in-combat\s+#hudFishingActionBtn[\s\S]*display:\s*none\s*!important/i);

  const elements = new Map();
  const makeEl = (id) => ({
    id,
    className: '',
    innerHTML: '',
    dataset: {},
    style: { display: 'none' },
    children: [],
    setAttribute() {},
    appendChild(child) { this.children.push(child); },
  });
  elements.set('worldScreen', makeEl('worldScreen'));

  const bodyClasses = new Set();
  const sandbox = {
    performance,
    localStorage: { getItem: () => null, setItem() {} },
    document: {
      body: {
        children: [],
        classList: {
          add: (...cls) => cls.forEach((c) => bodyClasses.add(c)),
          remove: (...cls) => cls.forEach((c) => bodyClasses.delete(c)),
          contains: (c) => bodyClasses.has(c),
          toggle: (c, force) => {
            const on = force === undefined ? !bodyClasses.has(c) : Boolean(force);
            if (on) bodyClasses.add(c);
            else bodyClasses.delete(c);
            return on;
          },
        },
        appendChild(el) { this.children.push(el); },
      },
      getElementById: (id) => elements.get(id) || null,
      createElement: () => {
        let currentId = '';
        const el = makeEl('');
        return new Proxy(el, {
          set(target, prop, value) {
            target[prop] = value;
            if (prop === 'id') {
              currentId = value;
              elements.set(currentId, target);
            }
            return true;
          },
        });
      },
    },
    window: null,
  };
  sandbox.window = sandbox;
  vm.runInNewContext(code, sandbox);

  let apiCalls = 0;
  const mockClient = {
    activeChar: { id: 10 },
    token: 'tok',
    playerX: 150,
    playerY: 150,
    isFlying: false,
    isEncounterLoading: false,
    actionCombatArena: { isActive: false, isTransitioning: false },
    showNotification() {},
    api: async (url) => {
      apiCalls++;
      return { ok: true, url };
    },
  };

  const ctrl = sandbox.PlayFishingController.init(mockClient);
  const btn = elements.get('hudFishingActionBtn');
  const bar = elements.get('hudFishingStatusBar');
  const modal = elements.get('fishingSetupModal');

  // Em EXPLORING perto da água -> botão visível
  ctrl.nearWaterPoint = { point: { x: 160, y: 150 } };
  ctrl.syncHudVisibility();
  assert.equal(btn.style.display, 'flex');

  // Simula pesca ativa e entrada abrupta em combate
  ctrl.isFishing = true;
  ctrl.activeSession = { rodNamePtBr: 'Vara Teste', baitQueue: [] };
  modal.style.display = 'flex';
  ctrl.syncHudVisibility();
  assert.equal(bar.style.display, 'flex');
  assert.equal(btn.style.display, 'none');

  mockClient.actionCombatArena.isActive = true;
  bodyClasses.add('is-in-combat');
  ctrl.onEnterCombat();

  assert.equal(ctrl.isFishing, false);
  assert.equal(btn.style.display, 'none');
  assert.equal(bar.style.display, 'none');
  assert.equal(modal.style.display, 'none');

  const callsBeforeCombatGuards = apiCalls;
  await ctrl.openSetupModal();
  await ctrl.startFishing();
  assert.equal(apiCalls, callsBeforeCombatGuards);

  ctrl.setHudEditorPreview(true);
  assert.equal(ctrl.hudEditorPreview, false);
  assert.equal(btn.style.display, 'none');
  assert.equal(bar.style.display, 'none');
});

await test('Pacote de Pesca v0.68.0 possui 60 PNGs RGBA 160x160 transparentes, URLs preservadas e catálogo F..SS íntegro', () => {
  assert.equal(FISH_CATALOG.length, 36);
  assert.equal(BAIT_CATALOG.length, 11);
  assert.equal(ROD_CATALOG.length, 12);
  assert.ok(MINHOCA_DEFAULT_CONFIG.catchChanceBonusPct > 0);

  // Todos os 7 ranks presentes no catálogo de peixes
  const fishRanks = new Set(FISH_CATALOG.map((f) => f.rarityTier));
  for (const r of ['F', 'D', 'C', 'B', 'A', 'S', 'SS']) {
    assert.ok(fishRanks.has(r), `Rank ${r} ausente em FISH_CATALOG`);
  }

  // Todos os 60 arquivos PNG existem, têm 160x160 e canal alpha (colorType = 6)
  const expectedIconPaths = [
    ...FISH_CATALOG.map((f) => f.iconPath),
    MINHOCA_ICON_PATH,
    ...BAIT_CATALOG.map((b) => b.iconPath),
    ...ROD_CATALOG.map((r) => r.iconPath),
  ];
  assert.equal(expectedIconPaths.length, 60);
  assert.equal(new Set(expectedIconPaths).size, 60, 'Os 60 caminhos de ícones devem ser únicos');

  const pngSig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  for (const webPath of expectedIconPaths) {
    assert.ok(webPath.startsWith('/play/assets/fishing/'));
    assert.equal(AssetMirrorService.toSameOriginUrl(webPath), webPath);
    assert.equal(CharacterInventoryService.resolveIconUrl(webPath), webPath);

    const diskPath = path.join(repoRoot, 'apps/server/public', webPath.replace(/^\/+/, ''));
    assert.ok(fs.existsSync(diskPath), `PNG ausente em disco: ${diskPath}`);
    const buf = fs.readFileSync(diskPath);
    assert.ok(buf.subarray(0, 8).equals(pngSig), `Assinatura PNG inválida: ${webPath}`);
    assert.equal(buf.readUInt32BE(16), 160, `Largura != 160 em ${webPath}`);
    assert.equal(buf.readUInt32BE(20), 160, `Altura != 160 em ${webPath}`);
    assert.equal(buf[24], 8, `Bit depth != 8 em ${webPath}`);
    assert.equal(buf[25], 6, `ColorType != 6 (RGBA transparente) em ${webPath}`);
  }

  // Varas novas rod_7..rod_18: pesos somam 100%, nível >= 50 e trilíngue pt-BR/en-US/es-ES
  const allEntries = [...FISH_CATALOG, ...BAIT_CATALOG, ...ROD_CATALOG];
  assert.equal(new Set(allEntries.map((e) => e.code)).size, 59);
  for (const entry of allEntries) {
    for (const loc of ['pt-BR', 'en-US', 'es-ES']) {
      assert.ok(entry.names?.[loc]?.trim().length >= 2, `Nome ${loc} inválido em ${entry.code}`);
      assert.ok(entry.descs?.[loc]?.trim().length >= 10, `Descrição ${loc} inválida em ${entry.code}`);
    }
  }
  for (const rod of ROD_CATALOG) {
    assert.ok(rod.requiredLevel >= 50, `${rod.code} deve exigir nível >= 50`);
    const sum = Object.values(rod.fishingRodConfig.rankWeights).reduce((acc, v) => acc + Number(v), 0);
    assert.ok(Math.abs(sum - 100) < 0.001, `${rod.code} soma de pesos = ${sum} (esperado 100)`);
  }
});

console.log(`\nResumo Sistema de Pesca: ${passed}/${total} testes aprovados.`);
if (passed !== total) process.exit(1);
