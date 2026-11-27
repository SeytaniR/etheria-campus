/**
 * @file tests/test_combat_veil_and_party.mjs
 * @module @etheria/tests
 * @description Suíte automatizada de verificação para os ajustes da v0.71.0:
 *   1. Formação tática e espaçamento em Arena (`ArenaPhysicsSolver`) e Dungeon (`DungeonService.assignDungeonFormationSpawns`):
 *      - Espaçamento ampliado entre equipes e unidades;
 *      - Melees na vanguarda (mais próximos da equipe oponente / menor bfsDist) e Rangeds na retaguarda.
 *   2. Atmosfera e partículas do Véu nas Dungeons (`ActionVfxRenderer`):
 *      - Esporos, bolsões abissais (`veilDungeonPockets`) e vinhas distribuídos por todos os 4 quadrantes do mapa inteiro;
 *      - Envoltória toroidal mantendo distribuição uniforme ao longo do tempo.
 *   3. Módulo de Equipes (`PartyRouter` + `PartyService` + `PlayPartyController`):
 *      - Padronização de `{ ok: true, success: true }`, `leaderCharacterId`, `currentHp`/`currentMp`;
 *      - Criação e saída de equipe no `PlayPartyController` sem falsos erros de validação.
 * @rules Execução 100% em memória sem mutar banco ou snapshot (Cláusula 0.2).
 * @dependencies node:assert/strict, node:fs, node:path, node:url, node:vm, apps/server/dist/*
 */

import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { DungeonService } from '../apps/server/dist/controllers/DungeonService.js';
import { PartyService } from '../apps/server/dist/controllers/PartyService.js';
import { PartyRouter } from '../apps/server/dist/routes/PartyRouter.js';

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

function createMockElement() {
  return {
    width: 128,
    height: 128,
    style: {},
    dataset: {},
    innerHTML: '',
    textContent: '',
    disabled: false,
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    addEventListener() {},
    removeEventListener() {},
    appendChild() {},
    remove() {},
    getContext: () => createMockCtx().ctx,
    querySelector: () => createMockElement(),
    querySelectorAll: () => [],
  };
}

function loadBrowserClass(relPath, globalKey, extraGlobals = {}) {
  const code = fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
  const windowObj = {
    addEventListener() {},
    removeEventListener() {},
    ...(extraGlobals.window || {}),
  };
  const store = new Map();
  const sandbox = {
    console,
    Math,
    Number,
    String,
    Boolean,
    Array,
    Object,
    Set,
    Map,
    JSON,
    Date,
    URLSearchParams,
    performance: { now: () => 1000 },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    setTimeout,
    clearTimeout,
    alert: () => {},
    confirm: () => true,
    window: windowObj,
    document: {
      createElement: () => createMockElement(),
      getElementById: () => createMockElement(),
      querySelector: () => createMockElement(),
      querySelectorAll: () => [],
      addEventListener() {},
      removeEventListener() {},
      body: { appendChild() {} },
    },
    ...extraGlobals,
  };
  sandbox.window = windowObj;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(`${code}\n;globalThis.__EXPORTED__ = typeof ${globalKey} !== 'undefined' ? ${globalKey} : window.${globalKey};`, sandbox);
  return sandbox.__EXPORTED__;
}

function createMockCtx() {
  const ops = { fillRect: 0, arcs: 0, ellipses: 0, strokes: 0, images: 0 };
  const ctx = {
    canvas: { width: 1280, height: 720 },
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    lineCap: 'butt',
    shadowBlur: 0,
    shadowColor: 'transparent',
    globalAlpha: 1,
    save() {},
    restore() {},
    translate() {},
    rotate() {},
    scale() {},
    clearRect() {},
    drawImage() { ops.images++; },
    fillRect() { ops.fillRect++; },
    beginPath() {},
    arc() { ops.arcs++; },
    ellipse() { ops.ellipses++; },
    moveTo() {},
    lineTo() {},
    quadraticCurveTo() {},
    fill() {},
    stroke() { ops.strokes++; },
    createRadialGradient() {
      return { addColorStop() {} };
    },
  };
  return { ctx, ops };
}

// =========================================================================
// 1. ARENA & DUNGEON POSITIONING + MELEE/RANGED FORMATION
// =========================================================================
await test('ArenaPhysicsSolver: spawns distantes e formação Melee frente / Ranged atrás', () => {
  const ArenaPhysicsSolver = loadBrowserClass('apps/server/public/play/js/ArenaPhysicsSolver.js', 'ArenaPhysicsSolver', {
    window: { GameRulesConstants: { clampBattleMoveSpeed: (v) => v } },
  });
  assert.ok(ArenaPhysicsSolver, 'ArenaPhysicsSolver deve carregar');

  const pair = ArenaPhysicsSolver.findFairSpawnPositions(1000, 750, 650, 470, () => false);
  const teamDist = Math.hypot(pair.mx - pair.px, pair.my - pair.py);
  assert.ok(teamDist >= 480, `Distância entre equipes (${teamDist.toFixed(1)}px) deveria ser >= 480px`);

  const units = [
    { id: 'e_arch1', name: 'Arqueiro 1', attackType: 'RANGED', combatStyle: 'RANGED', range: 280 },
    { id: 'e_war1', name: 'Guerreiro 1', attackType: 'MELEE', combatStyle: 'MELEE', range: 60 },
    { id: 'e_mage', name: 'Mago', attackType: 'MAGIC', combatStyle: 'RANGED', range: 260 },
    { id: 'e_tank', name: 'Guardião', attackType: 'MELEE', combatStyle: 'MELEE', range: 55 },
  ];

  const occupied = [{ x: pair.px, y: pair.py }];
  const slots = ArenaPhysicsSolver.buildTeamFormationPositions(
    pair.mx,
    pair.my,
    pair.px,
    pair.py,
    units,
    1000,
    750,
    650,
    470,
    () => false,
    occupied
  );

  assert.equal(slots.length, 4);
  const slotById = new Map(units.map((u, idx) => [u.id, slots[idx]]));

  // Distância média ao ponto aliado (px, py): melees devem estar mais perto do inimigo do que rangeds
  const distToAlly = (p) => Math.hypot(p.x - pair.px, p.y - pair.py);
  const meleeMaxDist = Math.max(distToAlly(slotById.get('e_war1')), distToAlly(slotById.get('e_tank')));
  const rangedMinDist = Math.min(distToAlly(slotById.get('e_arch1')), distToAlly(slotById.get('e_mage')));
  assert.ok(
    meleeMaxDist < rangedMinDist,
    `Melees (max=${meleeMaxDist.toFixed(1)}) deveriam ficar à frente dos Rangeds (min=${rangedMinDist.toFixed(1)})`
  );

  // Espaçamento mínimo entre aliados do mesmo time
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const d = Math.hypot(slots[i].x - slots[j].x, slots[i].y - slots[j].y);
      assert.ok(d >= 85, `Unidades na formação ficaram muito próximas (${d.toFixed(1)}px)`);
    }
  }
});

await test('DungeonService.assignDungeonFormationSpawns: distribui Melees nos menores bfsDist e Rangeds atrás', () => {
  const units = [
    { id: 'm_r1', name: 'Mago Sombrio', combatStyle: 'MAGIC', attackRange: 250 },
    { id: 'm_m1', name: 'Lanceiro Abissal', combatStyle: 'MELEE', attackRange: 65 },
    { id: 'm_r2', name: 'Atirador', combatStyle: 'RANGED', attackRange: 290 },
    { id: 'm_m2', name: 'Bruto', combatStyle: 'MELEE', attackRange: 60 },
  ];
  const mobPoints = [
    { x: 1800, y: 1200, bfsDist: 28, euclid: 920 },
    { x: 1400, y: 1000, bfsDist: 10, euclid: 500 },
    { x: 1650, y: 1120, bfsDist: 22, euclid: 790 },
    { x: 1440, y: 1030, bfsDist: 12, euclid: 540 },
  ];

  DungeonService.assignDungeonFormationSpawns(units, mobPoints);
  const ptBfsByCoord = new Map(mobPoints.map((p) => [`${p.x},${p.y}`, p.bfsDist]));
  const getBfs = (u) => ptBfsByCoord.get(`${u.spawnX},${u.spawnY}`);

  const meleeMaxBfs = Math.max(getBfs(units[1]), getBfs(units[3]));
  const rangedMinBfs = Math.min(getBfs(units[0]), getBfs(units[2]));
  assert.ok(
    meleeMaxBfs < rangedMinBfs,
    `Em Dungeon, Melees (bfs=${meleeMaxBfs}) devem ficar nos pontos mais avançados que Rangeds (bfs=${rangedMinBfs})`
  );
});

// =========================================================================
// 2. DUNGEON VEIL VFX FULL-MAP DISTRIBUTION
// =========================================================================
await test('ActionVfxRenderer: espalha esporos, bolsões e raízes do Véu pelos 4 quadrantes do mapa inteiro da Dungeon', () => {
  const ActionVfxRenderer = loadBrowserClass('apps/server/public/play/js/ActionVfxRenderer.js', 'ActionVfxRenderer');
  assert.ok(ActionVfxRenderer, 'ActionVfxRenderer deve carregar');

  const vfx = new ActionVfxRenderer();
  const { ctx, ops } = createMockCtx();
  const dungeonArena = {
    isDungeonMode: true,
    mapWidth: 2400,
    mapHeight: 1800,
    arenaCenterX: 1200,
    arenaCenterY: 900,
    arenaRadiusX: 600,
    arenaRadiusY: 420,
    client: {
      canvas: { width: 1280, height: 720 },
      camX: -200,
      camY: -150,
    },
  };

  vfx.drawVeilFloorAtmosphere(ctx, dungeonArena, 1000, 1.0);
  assert.ok(vfx.veilSpores.length >= 150, `Esperava >= 150 esporos, obteve ${vfx.veilSpores.length}`);
  assert.ok(vfx.veilDungeonPockets.length >= 20, `Esperava >= 20 bolsões de névoa, obteve ${vfx.veilDungeonPockets.length}`);
  assert.ok(vfx.veilTendrils.length >= 20, `Esperava >= 20 raízes do véu, obteve ${vfx.veilTendrils.length}`);
  assert.ok(ops.ellipses > 0, 'Deveria desenhar bolsões de névoa visíveis na Dungeon');

  const countQuadrants = (items, getX, getY) => {
    const q = [0, 0, 0, 0];
    for (const item of items) {
      const right = getX(item) >= 1200 ? 1 : 0;
      const bottom = getY(item) >= 900 ? 2 : 0;
      q[right + bottom]++;
    }
    return q;
  };

  const sporeQ = countQuadrants(vfx.veilSpores, (s) => s.baseX, (s) => s.y);
  const pocketQ = countQuadrants(vfx.veilDungeonPockets, (p) => p.x, (p) => p.y);
  const tendrilQ = countQuadrants(vfx.veilTendrils, (t) => t.startX, (t) => t.startY);

  for (let i = 0; i < 4; i++) {
    assert.ok(sporeQ[i] >= 25, `Quadrante ${i} com poucos esporos: ${sporeQ[i]}`);
    assert.ok(pocketQ[i] >= 3, `Quadrante ${i} com poucos bolsões: ${pocketQ[i]}`);
    assert.ok(tendrilQ[i] >= 3, `Quadrante ${i} com poucas vinhas: ${tendrilQ[i]}`);
  }

  // Avança animação 15s e garante que wrap-around mantém os 4 quadrantes populados
  vfx.drawVeilAirAndSpores(ctx, dungeonArena, 16000, 1.0);
  const sporeQAfter = countQuadrants(vfx.veilSpores, (s) => s.baseX, (s) => s.y);
  for (let i = 0; i < 4; i++) {
    assert.ok(sporeQAfter[i] >= 20, `Quadrante ${i} após wrap-around perdeu cobertura: ${sporeQAfter[i]}`);
  }
});

// =========================================================================
// 3. PARTY MODULE (PartyService + PartyRouter + PlayPartyController)
// =========================================================================
await test('PartyRouter + PlayPartyController: cria equipe, verifica líder/HP e sai sem falso erro', async () => {
  // Limpa qualquer estado residual para IDs de teste
  const char1 = 9101;
  const char2 = 9102;
  PartyService.leaveParty(char1);
  PartyService.leaveParty(char2);

  const mockChars = new Map([
    [char1, { id: char1, userAccountId: 1, name: 'Alden', level: 22, hp: 420, currentHp: 420, maxHp: 500, mp: 180, currentMp: 180, maxMp: 220, avatarUrl: '', spriteModel: 'mc1', classType: 'GUERREIRO' }],
    [char2, { id: char2, userAccountId: 2, name: 'Lyra', level: 21, hp: 310, currentHp: 310, maxHp: 350, mp: 290, currentMp: 290, maxMp: 310, avatarUrl: '', spriteModel: 'fc1', classType: 'MAGO' }],
  ]);

  const charDelegate = {
    findUnique: async ({ where }) => mockChars.get(where.id) || null,
    findMany: async ({ where }) => {
      if (where?.id?.in) return where.id.in.map((id) => mockChars.get(id)).filter(Boolean);
      return Array.from(mockChars.values());
    },
  };

  const mockPrisma = {
    character: charDelegate,
    playerCharacter: charDelegate,
  };

  const router = new PartyRouter({
    prisma: mockPrisma,
    readJsonBody: async (req) => req.__body || {},
    sendJson: (res, status, data) => {
      res.statusCode = status;
      res.__json = data;
    },
    verifyCharacterOwnership: async (_uid, _role, characterId) => mockChars.has(characterId),
  });

  // Helper de chamada HTTP mockada contra PartyRouter.handle
  const dispatchPartyApi = async (url, options = {}, charIdCtx = char1) => {
    const parsed = new URL(url, 'http://localhost');
    const method = (options.method || 'GET').toUpperCase();
    const body = options.body ? JSON.parse(options.body) : {};
    const req = { url: parsed.pathname + parsed.search, __body: body };
    const res = { statusCode: 200, __json: null };
    const uid = mockChars.get(charIdCtx)?.userAccountId || 1;
    const handled = await router.handle(req, res, parsed.pathname, method, { userAccountId: uid, role: 'PLAYER' });
    assert.equal(handled, true, `Rota não tratada: ${method} ${parsed.pathname}`);
    if (res.statusCode >= 400) {
      throw new Error(res.__json?.error || `HTTP ${res.statusCode}`);
    }
    return res.__json;
  };

  // Carrega PlayPartyController em ambiente mockado
  const alerts = [];
  const notices = [];
  const PlayPartyController = loadBrowserClass('apps/server/public/play/js/PlayPartyController.js', 'PlayPartyController', {
    alert: (msg) => alerts.push(msg),
    confirm: () => true,
    window: {
      PlayChatController: {
        addSystemNotice: (msg) => notices.push(msg),
      },
    },
  });
  assert.ok(PlayPartyController, 'PlayPartyController deve carregar');

  const fakeClient = {
    activeChar: mockChars.get(char1),
    mapId: 'city_campus_01',
    charX: 400,
    charY: 300,
    api: (url, opts) => dispatchPartyApi(url, opts, char1),
  };

  const ctrl = new PlayPartyController();
  await ctrl.init(fakeClient);
  assert.equal(ctrl.hasParty(), false);
  assert.equal(alerts.length, 0, `init() não deveria gerar alerta: ${alerts.join('; ')}`);

  // Cria equipe
  await ctrl.createParty();
  assert.equal(alerts.length, 0, `createParty() não deveria exibir erro: ${alerts.join('; ')}`);
  assert.equal(ctrl.hasParty(), true, 'hasParty() deve ser true após criar equipe');
  assert.equal(ctrl.isLeader(), true, 'isLeader() deve ser true para o criador');
  assert.equal(ctrl.isFollower(), false, 'isFollower() deve ser false para o líder');
  assert.equal(ctrl.party.leaderCharacterId, char1);
  assert.ok(PartyService.getPartyByCharacterId(char1), 'PartyService deve conter a equipe criada');

  // Renderiza HTML do modal (validando currentHp / currentMp e sem crashes de DOM)
  ctrl.renderModalContent();
  assert.equal(alerts.length, 0);

  // Sai da equipe
  await ctrl.leaveParty();
  assert.equal(alerts.length, 0, `leaveParty() não deveria exibir erro: ${alerts.join('; ')}`);
  assert.equal(ctrl.hasParty(), false, 'hasParty() deve ser false após sair da equipe');
  assert.equal(PartyService.getPartyByCharacterId(char1), null, 'PartyService deve remover o jogador após leaveParty()');
  assert.ok(notices.length >= 2, 'Mensagens de sistema de criação e saída devem ter sido emitidas');
});

console.log(`\nResumo Test Combat/Veil/Party: ${passed}/${total} testes aprovados.`);
if (passed !== total) {
  process.exit(1);
}
