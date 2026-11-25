/**
 * @file tests/test_wings_and_chests.mjs
 * @module @etheria/tests
 * @description Suíte automatizada de verificação visual/lógica da v0.65.0:
 *   - Resolução automática 5→8 direções e desbloqueio de animação em caminhada/combate (`McreworkManifestSprite`);
 *   - Profundidade 2.5D nas costas (`backDepth`), espelhamento esquerdo de `visualOffsetX` e `dirOffsets` de asas;
 *   - Ancoragem fixa no chão dos Baús de Dungeon (`renderChestAt`) + Y-Sorting real em `ActionCombatArena`.
 * @rules Execução 100% em sandbox `node:vm` em memória sem mutar banco ou snapshot (Cláusula 0.2).
 * @dependencies node:assert/strict, node:fs, node:path, node:url, node:vm
 */

import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as vm from 'node:vm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

let passed = 0;
let total = 0;
function test(name, fn) {
  total++;
  try {
    fn();
    passed++;
    console.log(`✅ [PASS] ${name}`);
  } catch (err) {
    console.error(`❌ [FAIL] ${name}:`, err);
    process.exitCode = 1;
  }
}

function createFlightSandbox() {
  const code = fs.readFileSync(
    path.join(repoRoot, 'apps/server/public/play/js/PlayFlightAndWingsController.js'),
    'utf8'
  );
  const sandbox = {
    window: {},
    document: undefined,
    performance: { now: () => 1000 },
    Image: class { set src(_) {} },
    fetch: () => Promise.reject(new Error('no-network')),
  };
  sandbox.window = sandbox;
  vm.runInNewContext(code, sandbox);
  return sandbox;
}

function createChestAndArenaSandbox() {
  const chestCode = fs.readFileSync(
    path.join(repoRoot, 'apps/server/public/play/js/PlayDungeonChestController.js'),
    'utf8'
  );
  const arenaCode = fs.readFileSync(
    path.join(repoRoot, 'apps/server/public/play/js/ActionCombatArena.js'),
    'utf8'
  );

  function FakeImage() {
    this.complete = true;
    this.naturalWidth = 256;
    this.naturalHeight = 256;
    this._src = '';
  }
  Object.defineProperty(FakeImage.prototype, 'src', {
    set(v) { this._src = v; },
    get() { return this._src; },
  });

  const sandbox = {
    window: {},
    document: {
      createElement: () => ({
        width: 128,
        height: 128,
        getContext: () => ({
          createRadialGradient: () => ({ addColorStop() {} }),
          fillRect() {},
        }),
      }),
      getElementById: () => null,
    },
    performance: { now: () => 5000 },
    Image: FakeImage,
    Set,
    Map,
  };
  sandbox.window = sandbox;
  sandbox.window.addEventListener = () => {};
  vm.runInNewContext(chestCode, sandbox);
  vm.runInNewContext(arenaCode, sandbox);
  return sandbox;
}

test('McreworkManifestSprite espelha automaticamente manifests de 5 direções e mantém 8 direções nativas intactas', () => {
  const sb = createFlightSandbox();
  const { McreworkManifestSprite } = sb;

  // Simula equip_wing_001001 (5 direções reais: 0..4; dirs 5..7 colapsam em bmp_39.png de N)
  const wingSprite = new McreworkManifestSprite('/fake/wing/char_manifest.json', '/fake/wing/thumb.png');
  wingSprite.manifestData = {
    '0-0': [{ file: 'bmp_1.png' }, { file: 'bmp_3.png' }, { file: 'bmp_5.png' }],
    '1-0': [{ file: 'bmp_9.png' }, { file: 'bmp_11.png' }, { file: 'bmp_13.png' }],
    '2-0': [{ file: 'bmp_17.png' }, { file: 'bmp_19.png' }, { file: 'bmp_21.png' }],
    '3-0': [{ file: 'bmp_25.png' }, { file: 'bmp_27.png' }, { file: 'bmp_29.png' }],
    '4-0': [{ file: 'bmp_33.png' }, { file: 'bmp_35.png' }, { file: 'bmp_39.png' }],
    '5-0': [{ file: 'bmp_39.png' }, { file: 'bmp_39.png' }],
    '6-0': [{ file: 'bmp_39.png' }],
    '7-0': [{ file: 'bmp_39.png' }],
    // Em caminhada/ataque só existe 1 frame estático
    '1-1': [{ file: 'bmp_15.png' }],
    '6-3': [{ file: 'bmp_39.png' }],
  };
  wingSprite.buildDirResolution();

  const normRes = (d, a) => {
    const r = wingSprite.resolveSequence(d, a);
    return {
      effectiveDir: r.effectiveDir,
      flipX: r.flipX,
      files: Array.from(r.seq || []).map((e) => e.file),
    };
  };

  assert.deepEqual(normRes(1, 0), {
    effectiveDir: 1,
    flipX: false,
    files: ['bmp_9.png', 'bmp_11.png', 'bmp_13.png'],
  });
  assert.deepEqual(normRes(5, 0), {
    effectiveDir: 3,
    flipX: true,
    files: ['bmp_25.png', 'bmp_27.png', 'bmp_29.png'],
  });
  assert.deepEqual(normRes(6, 0), {
    effectiveDir: 2,
    flipX: true,
    files: ['bmp_17.png', 'bmp_19.png', 'bmp_21.png'],
  });
  assert.deepEqual(normRes(7, 0), {
    effectiveDir: 1,
    flipX: true,
    files: ['bmp_9.png', 'bmp_11.png', 'bmp_13.png'],
  });

  // Em movimento (action=1) ou ataque (action=3) não congela: cai para sequência animada de idle
  const walkEast = wingSprite.resolveSequence(2, 1);
  assert.equal(walkEast.seq.length, 3);
  assert.equal(walkEast.flipX, false);

  const atkWest = wingSprite.resolveSequence(6, 3);
  assert.equal(atkWest.effectiveDir, 2);
  assert.equal(atkWest.flipX, true);
  assert.equal(atkWest.seq.length, 3);

  // Planador nativo de 8 direções NÃO deve ser espelhado
  const gliderSprite = new McreworkManifestSprite('/fake/glider/char_manifest.json', '/fake/glider/thumb.png');
  gliderSprite.manifestData = {};
  for (let d = 0; d < 8; d++) {
    gliderSprite.manifestData[`${d}-0`] = [{ file: `g_${d}_1.png` }, { file: `g_${d}_2.png` }];
  }
  gliderSprite.buildDirResolution();
  assert.equal(gliderSprite.resolveSequence(6, 0).effectiveDir, 6);
  assert.equal(gliderSprite.resolveSequence(6, 0).flipX, false);
});

test('PlayFlightAndWingsController aplica profundidade backDepth, espelhamento esquerdo e dirOffsets em 8 direções', () => {
  const sb = createFlightSandbox();
  const { PlayFlightAndWingsController } = sb;

  const wingsObj = {
    modelId: 'equip_wing_001001',
    visualScale: 0.70,
    visualOffsetX: 4,
    visualOffsetY: -30,
    groundOffsetY: 0,
    backDepth: 10,
    dirOffsets: {
      '6': { x: -2, y: 3, layer: 'BACK' },
      '0': { layer: 'FRONT' },
    },
  };

  // Dir 2 (Leste, +X) -> costas em -X, soma +4 - 10 = -6
  const east = PlayFlightAndWingsController.computeWingTransform(wingsObj, 500, 500, 2, 0, 0.70);
  assert.equal(east.wingX, 494);
  assert.equal(east.wingY, 470);

  // Dir 6 (Oeste, -X) -> visualOffsetX espelhado (-4) + costas em +X (+10) + dirOffsetX (-2) = +4; Y = 470 + 3
  const west = PlayFlightAndWingsController.computeWingTransform(wingsObj, 500, 500, 6, 0, 0.70);
  assert.equal(west.wingX, 504);
  assert.equal(west.wingY, 473);

  // Dir 0 (Sul, +Y) -> costas para trás/cima (-Y * 0.55 = -5.5 -> Math.round(470 - 5.5) = 465)
  const south = PlayFlightAndWingsController.computeWingTransform(wingsObj, 500, 500, 0, 0, 0.70);
  assert.equal(south.wingX, 504);
  assert.equal(south.wingY, 465);

  // Camadas por direção + override
  assert.equal(PlayFlightAndWingsController.shouldDrawWingsBehind(0, wingsObj), false); // override FRONT
  assert.equal(PlayFlightAndWingsController.shouldDrawWingsBehind(2, wingsObj), true);  // AUTO
  assert.equal(PlayFlightAndWingsController.shouldDrawWingsBehind(4, wingsObj), false); // AUTO (Norte)
  assert.equal(PlayFlightAndWingsController.shouldDrawWingsBehind(6, wingsObj), true);  // override BACK
});

test('PlayDungeonChestController fixa sombra no solo e elimina flutuação após pouso inicial', () => {
  const sb = createChestAndArenaSandbox();
  const { PlayDungeonChestController } = sb;

  const calls = [];
  const fakeCtx = {
    save() {},
    restore() {},
    beginPath() {},
    ellipse(x, y, rx, ry) { calls.push({ type: 'ellipse', x, y, rx, ry }); },
    fill() {},
    stroke() {},
    arc() {},
    rect() {},
    roundRect() {},
    drawImage(img, dx, dy, dw, dh) { calls.push({ type: 'image', dx, dy, dw, dh }); },
    measureText: () => ({ width: 100 }),
    fillText() {},
    set fillStyle(_) {},
    set strokeStyle(_) {},
    set lineWidth(_) {},
    set globalAlpha(_) {},
    set font(_) {},
    set textAlign(_) {},
  };

  const chest = {
    namePtBr: 'Baú Comum',
    imageUrl: '/play/assets/dungeon/chest_common.png',
    visualScale: 0.50,
    visualOffsetX: 6,
    visualOffsetY: -12,
    glowColorHex: '#38bdf8',
    spawnedAt: 1000,
  };

  // Renders em momentos distintos após 0.32s devem gerar exatamente a mesma coordenada Y (zero bobbing)
  PlayDungeonChestController.renderChestAt(fakeCtx, chest, 400, 600, 2000, {});
  const firstShadow = calls.find((c) => c.type === 'ellipse');
  const firstSprite = calls.filter((c) => c.type === 'image')[1];

  calls.length = 0;
  PlayDungeonChestController.renderChestAt(fakeCtx, chest, 400, 600, 2350, {});
  const secondShadow = calls.find((c) => c.type === 'ellipse');
  const secondSprite = calls.filter((c) => c.type === 'image')[1];

  assert.equal(firstShadow.x, 406);
  assert.equal(firstShadow.y, 600); // sombra permanece presa em groundY = 600 apesar de visualOffsetY = -12
  assert.equal(secondShadow.y, 600);
  assert.equal(firstSprite.dy, secondSprite.dy); // zero flutuação contínua
});

test('ActionCombatArena ordena o Baú de Dungeon na fila de profundidade Y-Sorting e não redesenha por cima', () => {
  const sb = createChestAndArenaSandbox();
  const { ActionCombatArena } = sb;

  const arena = new ActionCombatArena(null);
  arena.isActive = true;
  arena.player = { y: 520, isAlive: true };
  arena.dungeonChest = { x: 400, y: 500, opened: false };

  const queue = [];
  arena.populateRenderQueue(queue, 5000);
  queue.sort((a, b) => a.y - b.y);

  assert.equal(queue.length, 2);
  assert.equal(queue[0].type, 'DUNGEON_CHEST');
  assert.equal(queue[1].type, 'COMBAT_PLAYER');

  // Quando jogador está atrás (y = 470 < 500), jogador desenha antes do baú
  arena.player.y = 470;
  const queueBehind = [];
  arena.populateRenderQueue(queueBehind, 5000);
  queueBehind.sort((a, b) => a.y - b.y);
  assert.equal(queueBehind[0].type, 'COMBAT_PLAYER');
  assert.equal(queueBehind[1].type, 'DUNGEON_CHEST');

  // renderActiveVfx não deve chamar PlayDungeonChestController.renderChestOnCanvas por cima
  let chestDrawnInVfx = false;
  sb.PlayDungeonChestController.renderChestOnCanvas = () => { chestDrawnInVfx = true; };
  arena.vfxRenderer = { drawActiveBursts() {} };
  arena.renderActiveVfx({}, 5000);
  assert.equal(chestDrawnInVfx, false);
});

console.log(`\n🎁 Asas & Baús — ${passed}/${total} suítes aprovadas.`);
if (passed !== total) {
  process.exit(1);
}
