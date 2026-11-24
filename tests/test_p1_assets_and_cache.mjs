/**
 * @file tests/test_p1_assets_and_cache.mjs
 * @module @etheria/tests
 * @description Suíte automatizada de verificação da Onda P1 (`AssetMirrorService`, `MapRuntimeCacheService` e `MapPresenceService`).
 * @rules Executa contra os módulos compilados em `apps/server/dist/controllers/` usando mocks em memória (Cláusula 0.2 — zero mutação no banco real).
 * @dependencies node:assert/strict, apps/server/dist/controllers/*
 */

import assert from 'node:assert/strict';
import { AssetMirrorService } from '../apps/server/dist/controllers/AssetMirrorService.js';
import { MapRuntimeCacheService } from '../apps/server/dist/controllers/MapRuntimeCacheService.js';
import { MapPresenceService } from '../apps/server/dist/controllers/MapPresenceService.js';

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

// 1. AssetMirrorService — Regra #10 Reforçada & Segurança contra Path Traversal
test('AssetMirrorService.toSameOriginUrl converte URLs externas em rotas locais e preserva URLs curadas', () => {
  assert.equal(
    AssetMirrorService.toSameOriginUrl('https://seytanir.github.io/mcrework/assets/icons/items/1001.png'),
    '/api/assets/mcrework/assets/icons/items/1001.png'
  );
  assert.equal(
    AssetMirrorService.toSameOriginUrl('https://mcrework.com/assets/monsters/1/thumb.webp'),
    '/api/assets/mcrework/assets/monsters/1/thumb.webp'
  );
  assert.equal(AssetMirrorService.toSameOriginUrl('/api/assets/map-image/1'), '/api/assets/map-image/1');
  assert.equal(AssetMirrorService.toSameOriginUrl('/assets/worldmap/c1.png'), '/assets/worldmap/c1.png');
  assert.equal(AssetMirrorService.toSameOriginUrl('/play/assets/hud/x.png'), '/play/assets/hud/x.png');
  assert.equal(AssetMirrorService.toSameOriginUrl('data:image/png;base64,AAA'), 'data:image/png;base64,AAA');
});

test('AssetMirrorService.normalizeRelPath bloqueia path traversal (.. e \\) antes da normalização', () => {
  const mirror = new AssetMirrorService();
  assert.equal(mirror.normalizeRelPath('../assets/maps/1.png'), null);
  assert.equal(mirror.normalizeRelPath('../../etc/passwd'), null);
  assert.equal(mirror.normalizeRelPath('assets/../../secret'), null);
  assert.equal(mirror.normalizeRelPath('assets\\maps\\1.png'), null);
  assert.equal(
    mirror.normalizeRelPath('/api/assets/mcrework/assets/maps/1/bg.png'),
    'assets/maps/1/bg.png'
  );
});

// 2. MapRuntimeCacheService — Cache de Física de Mapa & Invalidação
test('MapRuntimeCacheService.getMapPhysics reutiliza cache em RAM e recarrega após invalidateMap', async () => {
  MapRuntimeCacheService.resetForTests();
  let mapFindCalls = 0;
  const mockPrisma = {
    gameMap: {
      async findUnique({ where }) {
        mapFindCalls += 1;
        return {
          id: Number(where.id),
          spawnX: 500,
          spawnY: 500,
          mcreworkMapImage: 'assets/maps/7/bg.png',
          collisionMeshJson: [],
        };
      },
    },
  };
  const mockMirror = {
    async getOrFetchAsset() {
      return null;
    },
  };

  try {
    const first = await MapRuntimeCacheService.getMapPhysics(mockPrisma, mockMirror, 7);
    const second = await MapRuntimeCacheService.getMapPhysics(mockPrisma, mockMirror, 7);
    assert.ok(first);
    assert.equal(second, first);
    assert.equal(mapFindCalls, 1);

    MapRuntimeCacheService.invalidateMap(7);
    const third = await MapRuntimeCacheService.getMapPhysics(mockPrisma, mockMirror, 7);
    assert.ok(third);
    assert.equal(mapFindCalls, 2);
  } finally {
    MapRuntimeCacheService.resetForTests();
  }
});

// 3. MapRuntimeCacheService — Coalescing de Dirty-Flush & Flush Imediato ao Alternar Voo
test('MapRuntimeCacheService.validateAndBufferPosition agrupa escritas em RAM e faz flush no flushAll e ao voar', async () => {
  MapRuntimeCacheService.resetForTests();
  const updateCalls = [];
  let charIsFlyingDb = false;

  const mockPrisma = {
    gameMap: {
      async findUnique({ where }) {
        return {
          id: Number(where.id),
          spawnX: 500,
          spawnY: 500,
          mcreworkMapImage: 'assets/maps/7/bg.png',
          collisionMeshJson: [],
        };
      },
    },
    playerCharacter: {
      async findUnique() {
        return {
          id: 42,
          userAccountId: 10,
          currentMapId: 7,
          posX: 500,
          posY: 500,
          isFlying: charIsFlyingDb,
          equippedItemsJson: { FLYING_MOUNT: 88 },
        };
      },
      async update({ data }) {
        updateCalls.push(data);
        charIsFlyingDb = Boolean(data.isFlying);
        return { id: 42, ...data };
      },
    },
    itemTemplate: {
      async findMany() {
        return [
          {
            id: 88,
            equipmentSlotCode: 'FLYING_MOUNT',
            specialEffectJson: {
              flyType: 'FLYING_MOUNT',
              mountModelId: 'mount_dragon',
              speedBonusPct: 40,
            },
          },
        ];
      },
    },
  };
  const mockMirror = {
    async getOrFetchAsset() {
      return null;
    },
  };

  try {
    const step1 = await MapRuntimeCacheService.validateAndBufferPosition(
      mockPrisma,
      mockMirror,
      10,
      'PLAYER',
      42,
      { mapId: 7, posX: 515, posY: 500, isFlying: false },
      168
    );
    const step2 = await MapRuntimeCacheService.validateAndBufferPosition(
      mockPrisma,
      mockMirror,
      10,
      'PLAYER',
      42,
      { mapId: 7, posX: 530, posY: 500, isFlying: false },
      168
    );
    const step3 = await MapRuntimeCacheService.validateAndBufferPosition(
      mockPrisma,
      mockMirror,
      10,
      'PLAYER',
      42,
      { mapId: 7, posX: 545, posY: 500, isFlying: false },
      168
    );

    assert.equal(step1.ok, true);
    assert.equal(step2.ok, true);
    assert.equal(step3.ok, true);
    assert.equal(step3.posX, 545);
    assert.equal(updateCalls.length, 0, 'Passos consecutivos dentro da janela de 3s devem permanecer em RAM');

    await MapRuntimeCacheService.flushAll(mockPrisma);
    assert.equal(updateCalls.length, 1);
    assert.equal(updateCalls[0].posX, 545);
    assert.equal(updateCalls[0].isFlying, false);

    // Alternar isFlying (chão -> voo) deve disparar flush imediato para consistência autoritária
    const takeOff = await MapRuntimeCacheService.validateAndBufferPosition(
      mockPrisma,
      mockMirror,
      10,
      'PLAYER',
      42,
      { mapId: 7, posX: 555, posY: 500, isFlying: true },
      168
    );
    assert.equal(takeOff.ok, true);
    assert.equal(takeOff.isFlying, true);
    assert.equal(updateCalls.length, 2);
    assert.equal(updateCalls[1].isFlying, true);
    assert.equal(updateCalls[1].posX, 555);
  } finally {
    MapRuntimeCacheService.resetForTests();
  }
});

// 4. MapPresenceService — Invalidação de Metadados Visuais em Cache
test('MapPresenceService.invalidateCharacterCache força recarga de metadados visuais na próxima consulta', async () => {
  MapPresenceService.invalidateCharacterCache(999);
  MapPresenceService.removePlayer(999);

  let pcFindCalls = 0;
  const mockPrisma = {
    playerCharacter: {
      async findUnique() {
        pcFindCalls += 1;
        return {
          id: 999,
          name: 'Tester999',
          level: 10 + pcFindCalls,
          classTemplateId: 1,
          classTemplate: { code: 'WARRIOR', mcreworkCharKey: '100101', groundOffsetY: 0 },
          pets: [],
          equippedItemsJson: {},
          elementCode: 'FIRE',
        };
      },
    },
    gameMap: {
      async findUnique() {
        return { id: 1, mapType: { code: 'CITY' } };
      },
    },
  };

  try {
    await MapPresenceService.updatePresence(mockPrisma, 999, { mapId: 1, posX: 500, posY: 500 });
    await MapPresenceService.updatePresence(mockPrisma, 999, { mapId: 1, posX: 505, posY: 500 });
    assert.equal(pcFindCalls, 1, 'Segunda presença no TTL de 5 min deve reutilizar cache');

    MapPresenceService.invalidateCharacterCache(999);
    await MapPresenceService.updatePresence(mockPrisma, 999, { mapId: 1, posX: 510, posY: 500 });
    assert.equal(pcFindCalls, 2, 'Após invalidateCharacterCache o serviço deve consultar novamente');
  } finally {
    MapPresenceService.invalidateCharacterCache(999);
    MapPresenceService.removePlayer(999);
  }
});

let passed = 0;
for (const { name, fn } of tests) {
  try {
    await fn();
    passed++;
    console.log(`✅ [PASS] ${name}`);
  } catch (err) {
    console.error(`❌ [FAIL] ${name}:`, err);
    process.exitCode = 1;
  }
}

console.log(`\n⚡ Onda P1 — ${passed}/${tests.length} suítes de assets e cache passaram.`);
