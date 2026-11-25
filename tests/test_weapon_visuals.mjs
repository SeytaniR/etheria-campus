/**
 * @file tests/test_weapon_visuals.mjs
 * @module @etheria/tests
 * @description Suíte automatizada de verificação do Sistema de Armas 2.5D na Mão do Personagem (`v0.67.0`):
 *   - Pivô adaptativo `McreworkManifestSprite.computeWeaponAnchorY` (canvases compactos vs expandidos) + `clampLastFrame`;
 *   - Resolução automática masculino/feminino (`equip_mc*` vs `equip_fc*`) incluindo classes Reborn;
 *   - `computeWeaponTransform` independente de `char.groundOffsetY`, espelhamento esquerdo e `dirOffsets`;
 *   - Ordem de camadas em `drawPlayerWithCosmetics` (chão Sul/Norte, override BACK e voo) + relógio `opts.now` vs `wingNow`;
 *   - `CharacterEquipmentService.resolveVisualAppearance` no backend com URLs 100% same-origin (Regra #10).
 * @rules Execução 100% em sandbox `node:vm` + módulo compilado sem mutar banco ou snapshot (Cláusula 0.2).
 * @dependencies node:assert/strict, node:fs, node:path, node:url, node:vm, ../apps/server/dist/controllers/CharacterEquipmentService.js
 */

import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as vm from 'node:vm';
import { CharacterEquipmentService } from '../apps/server/dist/controllers/CharacterEquipmentService.js';

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
    Image: class {
      constructor() {
        this.complete = true;
        this.naturalWidth = 200;
        this.naturalHeight = 150;
      }
      set src(_) {}
    },
    fetch: () => Promise.reject(new Error('no-network')),
    Map,
    Set,
  };
  sandbox.window = sandbox;
  vm.runInNewContext(code, sandbox);
  return sandbox;
}

function createDrawCtxSpy() {
  const draws = [];
  const ctx = {
    save() {},
    restore() {},
    beginPath() {},
    ellipse() {},
    fill() {},
    translate() {},
    scale() {},
    drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh) {
      draws.push({ file: img._tag || img.src || 'unknown', dx, dy, dw, dh });
    },
    set fillStyle(_) {},
  };
  return { ctx, draws };
}

test('McreworkManifestSprite.computeWeaponAnchorY adapta corretamente canvases compactos e expandidos', () => {
  const sb = createFlightSandbox();
  const { McreworkManifestSprite } = sb;

  for (const h of [150, 188, 143, 165, 169, 173]) {
    assert.ok(Math.abs(McreworkManifestSprite.computeWeaponAnchorY(h) - 110 / 150) < 1e-6);
  }
  for (const h of [240, 256, 300, 460]) {
    const expected = (h / 2 + 46) / h;
    assert.ok(Math.abs(McreworkManifestSprite.computeWeaponAnchorY(h) - expected) < 1e-6);
  }
});

test('McreworkManifestSprite.drawFrame aplica clampLastFrame e anchorY=WEAPON_AUTO', () => {
  const sb = createFlightSandbox();
  const { McreworkManifestSprite } = sb;

  const sprite = new McreworkManifestSprite('/api/assets/mcrework/assets/weapons/equip_mc4_000000/char_manifest.json', null);
  sprite.loading = true;
  sprite.ready = true;
  sprite.manifestData = {
    '0-6': [
      { file: 'assets/weapons/equip_mc4_000000/bmp_1.png', width: 320, height: 256 },
      { file: 'assets/weapons/equip_mc4_000000/bmp_2.png', width: 320, height: 256 },
      { file: 'assets/weapons/equip_mc4_000000/bmp_3.png', width: 320, height: 256 },
    ],
  };
  sprite.buildDirResolution();
  for (const f of ['bmp_1.png', 'bmp_2.png', 'bmp_3.png']) {
    const rel = `assets/weapons/equip_mc4_000000/${f}`;
    sprite.frameImages.set(rel, { complete: true, naturalWidth: 320, naturalHeight: 256, _tag: f });
  }

  const { ctx, draws } = createDrawCtxSpy();
  // elapsedMs = 8000 => rawFrameIdx = 100, clampLastFrame = true deve travar em bmp_3.png (último frame)
  const ok = sprite.drawFrame(ctx, 500, 400, 0, 6, 8000, null, 0.70, 0.5, 'WEAPON_AUTO', true);
  assert.equal(ok, true);
  assert.equal(draws.length, 1);
  assert.equal(draws[0].file, 'bmp_3.png');
  // 256 * 0.70 = 179.2 -> dw = 224, dh = 179; anchorY = (128 + 46) / 256 = 174 / 256
  const expectedAnchorY = (256 / 2 + 46) / 256;
  const expectedDy = Math.round(400 - Math.round(256 * 0.70) * expectedAnchorY);
  assert.equal(draws[0].dy, expectedDy);

  // clampLastFrame = false gira circularmente (100 % 3 = 1 -> bmp_2.png)
  draws.length = 0;
  sprite.drawFrame(ctx, 500, 400, 0, 6, 8000, null, 0.70, 0.5, 'WEAPON_AUTO', false);
  assert.equal(draws[0].file, 'bmp_2.png');
});

test('PlayFlightAndWingsController.resolveWeaponModelForChar alterna equip_mc* vs equip_fc* e faz fallback seguro', () => {
  const sb = createFlightSandbox();
  const { PlayFlightAndWingsController } = sb;

  const weaponObj = {
    itemId: 10,
    modelId: 'equip_mc4_000000',
    maleModelId: 'equip_mc4_000000',
    femaleModelId: 'equip_fc4_000000',
    manifestUrl: '/api/assets/mcrework/assets/weapons/equip_mc4_000000/char_manifest.json',
    maleManifestUrl: '/api/assets/mcrework/assets/weapons/equip_mc4_000000/char_manifest.json',
    femaleManifestUrl: '/api/assets/mcrework/assets/weapons/equip_fc4_000000/char_manifest.json',
  };

  assert.deepEqual(
    { ...PlayFlightAndWingsController.resolveWeaponModelForChar(weaponObj, 'PC_MALE_000004') },
    {
      modelId: 'equip_mc4_000000',
      manifestUrl: '/api/assets/mcrework/assets/weapons/equip_mc4_000000/char_manifest.json',
    }
  );
  assert.deepEqual(
    { ...PlayFlightAndWingsController.resolveWeaponModelForChar(weaponObj, 'PC_FEMALE_000014') },
    {
      modelId: 'equip_fc4_000000',
      manifestUrl: '/api/assets/mcrework/assets/weapons/equip_fc4_000000/char_manifest.json',
    }
  );

  // Sem femaleModelId cai para masculino
  const maleOnly = { ...weaponObj, femaleModelId: null, femaleManifestUrl: null };
  assert.equal(
    PlayFlightAndWingsController.resolveWeaponModelForChar(maleOnly, 'PC_FEMALE_000001')?.modelId,
    'equip_mc4_000000'
  );
  assert.equal(PlayFlightAndWingsController.resolveWeaponModelForChar(null, 'PC_MALE_000001'), null);
});

test('PlayFlightAndWingsController.computeWeaponTransform ignora char.groundOffsetY, preserva sinal assimétrico de X e aplica femaleOffset/dirOffsets', () => {
  const sb = createFlightSandbox();
  const { PlayFlightAndWingsController } = sb;

  const weaponObj = {
    modelId: 'equip_mc1_000001',
    visualScale: 0.70,
    visualOffsetX: 6,
    visualOffsetY: -10,
    femaleOffsetX: -4,
    femaleOffsetY: 5,
    groundOffsetY: -5,
    dirOffsets: {
      '6': { x: 3, y: 4, layer: 'BACK' },
    },
  };

  // feetBaseY = Math.round(4 * 1) = 4; weapon gOffY = Math.round(-5 * 0.70) = -3; baseOffY = -10 => Y = 400 + 4 - 3 - 10 = 391
  const east = PlayFlightAndWingsController.computeWeaponTransform(weaponObj, 500, 400, 2, 0.70, 'PC_MALE_000001');
  assert.equal(east.weaponX, 506);
  assert.equal(east.weaponY, 391);
  assert.equal(east.weaponScale, 0.70);

  // Direção esquerda (6 - Oeste) NÃO deve inverter visualOffsetX: +6 + 3 = +9 -> 509; Y = 391 + 4 = 395
  const westMale = PlayFlightAndWingsController.computeWeaponTransform(weaponObj, 500, 400, 6, 0.70, 'PC_MALE_000001');
  assert.equal(westMale.weaponX, 509);
  assert.equal(westMale.weaponY, 395);

  // Para classe feminina, aplica femaleOffsetX (-4) e femaleOffsetY (+5) além do ajuste global/direcional
  const westFemale = PlayFlightAndWingsController.computeWeaponTransform(weaponObj, 500, 400, 6, 0.70, 'PC_FEMALE_000001');
  assert.equal(westFemale.weaponX, 505);
  assert.equal(westFemale.weaponY, 400);
});

test('PlayFlightAndWingsController.drawPlayerWithCosmetics respeita Z-order, relógio now vs wingNow, char.groundOffsetY neutro na arma e voo', () => {
  const sb = createFlightSandbox();
  const { PlayFlightAndWingsController } = sb;

  const events = [];
  PlayFlightAndWingsController.drawWingForUnit = (_ctx, _w, x, y, dir, action, wingClock) => {
    events.push({ kind: 'WING', x, y, dir, action, clock: wingClock });
    return true;
  };
  PlayFlightAndWingsController.drawWeaponForUnit = (_ctx, _wpn, x, y, dir, action, wpnClock, _mesh, scale, charKey) => {
    events.push({ kind: 'WEAPON', x, y, dir, action, clock: wpnClock, scale, charKey });
    return true;
  };
  const charSprite = {
    draw(_ctx, x, y, action, dir, charClock, _mesh, groundOffsetY) {
      events.push({ kind: 'CHAR', x, y, dir, action, clock: charClock, groundOffsetY });
    },
  };

  const wingsObj = { modelId: 'equip_wing_001001', manifestUrl: '/w.json', thumbUrl: '/t.png' };
  const weaponObj = {
    modelId: 'equip_mc4_000000',
    maleModelId: 'equip_mc4_000000',
    femaleModelId: 'equip_fc4_000000',
    dirOffsets: {},
  };

  // 1. Chão Sul (dir = 0): WING -> CHAR -> WEAPON; relógio da arma = now (160), asas = wingNow (2400)
  events.length = 0;
  PlayFlightAndWingsController.drawPlayerWithCosmetics({}, {
    client: {}, charSprite, worldX: 300, worldY: 500, action: 3, dir: 0, now: 160, wingNow: 2400,
    mesh: null, groundOffsetY: 40, wingsObj, weaponObj, charKey: 'PC_FEMALE_000004',
  });
  assert.deepEqual(events.map((e) => e.kind), ['WING', 'CHAR', 'WEAPON']);
  assert.equal(events[0].clock, 2400);
  assert.equal(events[1].clock, 160);
  assert.equal(events[1].groundOffsetY, 40);
  assert.equal(events[2].clock, 160);
  assert.equal(events[2].y, 500); // char.groundOffsetY (40) não é repassado como y da arma

  // Mesmo y com char.groundOffsetY = 5 (prova invariância em relação ao offset do corpo)
  events.length = 0;
  PlayFlightAndWingsController.drawPlayerWithCosmetics({}, {
    client: {}, charSprite, worldX: 300, worldY: 500, action: 3, dir: 0, now: 160, wingNow: 2400,
    mesh: null, groundOffsetY: 5, wingsObj, weaponObj, charKey: 'PC_MALE_000004',
  });
  assert.equal(events[2].y, 500);

  // 2. Chão Norte (dir = 4): CHAR -> WEAPON -> WING
  events.length = 0;
  PlayFlightAndWingsController.drawPlayerWithCosmetics({}, {
    client: {}, charSprite, worldX: 300, worldY: 500, action: 1, dir: 4, now: 320, wingNow: 2560,
    mesh: null, groundOffsetY: 20, wingsObj, weaponObj, charKey: 'PC_MALE_000001',
  });
  assert.deepEqual(events.map((e) => e.kind), ['CHAR', 'WEAPON', 'WING']);

  // 3. Override BACK em dir = 4: WEAPON -> CHAR -> WING
  events.length = 0;
  const backWeapon = { ...weaponObj, dirOffsets: { '4': { layer: 'BACK' } } };
  PlayFlightAndWingsController.drawPlayerWithCosmetics({}, {
    client: {}, charSprite, worldX: 300, worldY: 500, action: 1, dir: 4, now: 320, wingNow: 2560,
    mesh: null, groundOffsetY: 20, wingsObj, weaponObj: backWeapon, charKey: 'PC_MALE_000001',
  });
  assert.deepEqual(events.map((e) => e.kind), ['WEAPON', 'CHAR', 'WING']);

  // 4. Voo (isFlying = true, alt = 72): WEAPON acompanha (riderX, riderY) em action = 0
  events.length = 0;
  PlayFlightAndWingsController.drawMistHaloUnderMount = () => {};
  PlayFlightAndWingsController.getOrCreateAtlasSprite = () => ({ draw() {} });
  const fakeCtx = { save() {}, restore() {}, beginPath() {}, ellipse() {}, fill() {}, set fillStyle(_) {} };
  const mountObj = {
    modelId: 'mount_001',
    visualFormat: 'ATLAS',
    atlasJsonUrl: '/m.json',
    atlasWebpUrl: '/m.webp',
    thumbUrl: '/mt.webp',
    riderOffsetX: 4,
    riderOffsetY: -22,
  };
  PlayFlightAndWingsController.drawPlayerWithCosmetics(fakeCtx, {
    client: {}, charSprite, worldX: 300, worldY: 500, action: 1, dir: 2, now: 480, wingNow: 2000,
    mesh: null, groundOffsetY: 25, wingsObj, mountObj, weaponObj, charKey: 'PC_MALE_000001',
    isFlying: true, flightAltitude: 72,
  });
  assert.deepEqual(events.map((e) => e.kind), ['WING', 'CHAR', 'WEAPON']);
  assert.equal(events[1].x, events[2].x);
  assert.equal(events[1].y, events[2].y);
  assert.equal(events[2].action, 0);
});

test('CharacterEquipmentService.resolveVisualAppearance resolve equippedWeapon same-origin por gênero e null quando ausente', () => {
  const itemsById = new Map([
    [
      101,
      {
        id: 101,
        specialEffectJson: {
          weaponModelId: 'equip_mc4_000000',
          weaponFemaleModelId: 'equip_fc4_000000',
          visualScale: 0.72,
          visualOffsetX: 2,
          visualOffsetY: -3,
          femaleOffsetX: -4,
          femaleOffsetY: 6,
          groundOffsetY: 1,
          dirOffsets: { '4': { layer: 'BACK', x: 1 } },
        },
      },
    ],
  ]);

  const maleVis = CharacterEquipmentService.resolveVisualAppearance({ WEAPON_1: 101 }, itemsById, 'PC_MALE_000004');
  assert.ok(maleVis.equippedWeapon);
  assert.equal(maleVis.equippedWeapon.modelId, 'equip_mc4_000000');
  assert.equal(maleVis.equippedWeapon.maleModelId, 'equip_mc4_000000');
  assert.equal(maleVis.equippedWeapon.femaleModelId, 'equip_fc4_000000');
  assert.equal(maleVis.equippedWeapon.femaleOffsetX, -4);
  assert.equal(maleVis.equippedWeapon.femaleOffsetY, 6);
  assert.equal(maleVis.equippedWeapon.manifestUrl, '/api/assets/mcrework/assets/weapons/equip_mc4_000000/char_manifest.json');
  assert.equal(maleVis.equippedWeapon.femaleManifestUrl, '/api/assets/mcrework/assets/weapons/equip_fc4_000000/char_manifest.json');
  assert.ok(!maleVis.equippedWeapon.manifestUrl.startsWith('http'));

  const femaleVis = CharacterEquipmentService.resolveVisualAppearance({ WEAPON_1: 101 }, itemsById, 'PC_FEMALE_000004');
  assert.equal(femaleVis.equippedWeapon?.modelId, 'equip_fc4_000000');
  assert.equal(femaleVis.equippedWeapon?.manifestUrl, '/api/assets/mcrework/assets/weapons/equip_fc4_000000/char_manifest.json');

  const emptyVis = CharacterEquipmentService.resolveVisualAppearance({}, itemsById, 'PC_MALE_000004');
  assert.equal(emptyVis.equippedWeapon, null);
});

console.log(`\n⚔️ Armas 2.5D — ${passed}/${total} verificações aprovadas.`);
if (passed !== total) {
  process.exit(1);
}
