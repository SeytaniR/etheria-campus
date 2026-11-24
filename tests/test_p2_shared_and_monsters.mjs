/**
 * @file tests/test_p2_shared_and_monsters.mjs
 * @module @etheria/tests
 * @description Suíte automatizada da Onda P2 validando `@etheria/shared` (`GameRulesConstants`,
 *   `CombatDamageCalculator`, `MapPolygonMesh`) e `MonsterCombatBuilder` (sorteio justo Rank-First,
 *   penalidade de nível por mapa e progressão de XP/Ouro).
 * @rules Cláusula 0.2: Executa puramente em memória contra módulos compilados sem tocar no PostgreSQL.
 * @dependencies node:assert/strict, @etheria/shared, apps/server/dist/controllers/MonsterCombatBuilder.js
 */

import assert from 'node:assert/strict';
import {
  GameRulesConstants,
  CombatDamageCalculator,
  MapPolygonMesh,
} from '../packages/shared/dist/index.js';
import { MonsterCombatBuilder } from '../apps/server/dist/controllers/MonsterCombatBuilder.js';

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

// 1. GameRulesConstants (@etheria/shared)
test('GameRulesConstants impõe teto 185 px/s, piso 60 px/s, 4 elementos ativos e validação de roles', () => {
  assert.equal(GameRulesConstants.MAX_BATTLE_MOVE_SPEED, 185);
  assert.equal(GameRulesConstants.MIN_BATTLE_MOVE_SPEED, 60);
  assert.equal(GameRulesConstants.clampBattleMoveSpeed(232), 185);
  assert.equal(GameRulesConstants.clampBattleMoveSpeed(20), 60);
  assert.equal(GameRulesConstants.clampBattleMoveSpeed(172), 172);
  assert.equal(GameRulesConstants.isElevatedRole('GM'), true);
  assert.equal(GameRulesConstants.isElevatedRole('ADMIN'), true);
  assert.equal(GameRulesConstants.isElevatedRole('PLAYER'), false);
  assert.deepEqual([...GameRulesConstants.ACTIVE_ELEMENTS], ['FIRE', 'EARTH', 'AIR', 'WATER']);
  assert.equal(GameRulesConstants.VALID_CHARACTER_EQUIPMENT_SLOTS.length, 16);
});

// 2. CombatDamageCalculator (@etheria/shared)
test('CombatDamageCalculator calcula acerto, ciclo elemental (NEUTRAL ±25%) e mitigação por defesa', () => {
  assert.equal(CombatDamageCalculator.calculateEffectiveHitRate(125, 100), 50);
  assert.equal(CombatDamageCalculator.calculateEffectiveHitRate(20, 75), 10);
  assert.equal(CombatDamageCalculator.calculateEffectiveHitRate(125, 0), 95);

  assert.equal(CombatDamageCalculator.resolveElementMultiplier('FIRE', 'EARTH'), 1.25);
  assert.equal(CombatDamageCalculator.resolveElementMultiplier('EARTH', 'FIRE'), 0.75);
  assert.equal(CombatDamageCalculator.resolveElementMultiplier('NEUTRAL', 'FIRE'), 0.75);
  assert.equal(CombatDamageCalculator.resolveElementMultiplier('FIRE', 'NEUTRAL'), 1.25);

  const hitAdvantage = CombatDamageCalculator.calculateHitDamage({
    attackerAtk: 100,
    attackerLevel: 10,
    attackerElementCode: 'FIRE',
    defenderDef: 200,
    defenderElementCode: 'EARTH',
    forceHit: true,
    forceCrit: false,
    varianceMin: 1.0,
    varianceMax: 1.0,
  });
  // baseline = 100 + 10*10 = 200 => defMult = 200 / (200 + 200) = 0.5; elemMult = 1.25 => 100 * 0.5 * 1.25 = 62.5 -> 63
  assert.equal(hitAdvantage.isHit, true);
  assert.equal(hitAdvantage.isCrit, false);
  assert.equal(hitAdvantage.defenseMultiplier, 0.5);
  assert.equal(hitAdvantage.elementMultiplier, 1.25);
  assert.equal(hitAdvantage.finalDamage, 63);
});

// 3. MapPolygonMesh (@etheria/shared)
test('MapPolygonMesh detecta corretamente pontos dentro e fora do polígono', () => {
  const mesh = new MapPolygonMesh([
    {
      id: 'poly-1',
      name: 'Quadra Teste',
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ],
    },
  ]);

  assert.equal(mesh.containsPoint(50, 50), true);
  assert.equal(mesh.containsPoint(150, 50), false);
});

// 4. MonsterCombatBuilder — Sorteio Justo Rank-First (não escalona raridade por quantidade de templates)
test('MonsterCombatBuilder.pickWeightedMonsterTemplate mantém proporção Rank-First mesmo com 20x monstros Rank S', () => {
  const poolA = [
    { id: 1, rarityTier: 'F' },
    { id: 2, rarityTier: 'S' },
  ];
  const poolB = [
    { id: 1, rarityTier: 'F' },
    ...Array.from({ length: 20 }, (_, i) => ({ id: 100 + i, rarityTier: 'S' })),
  ];

  const draws = 2000;
  let countSA = 0;
  let countSB = 0;
  for (let i = 0; i < draws; i++) {
    if (MonsterCombatBuilder.pickWeightedMonsterTemplate(poolA).rarityTier === 'S') countSA++;
    if (MonsterCombatBuilder.pickWeightedMonsterTemplate(poolB).rarityTier === 'S') countSB++;
  }

  const rateA = countSA / draws;
  const rateB = countSB / draws;
  // Peso teórico: S=4 vs F=140 -> 4/144 (~2.78%), jamais ~95% no poolB
  assert.equal(rateA < 0.10, true, `Pool A teve taxa inesperada de Rank S: ${rateA}`);
  assert.equal(rateB < 0.10, true, `Pool B teve taxa inflada de Rank S: ${rateB}`);
});

// 5. MonsterCombatBuilder — Penalidades de Nível & Recompensas
test('MonsterCombatBuilder aplica penalidades de Overlevel/Underlevel e escalona XP/Ouro por Rank e Variante', () => {
  const over = MonsterCombatBuilder.applyMapLevelingPenalty(1000, 500, 10, 20);
  assert.equal(over.penaltyReason, 'MAP_OVERLEVEL_95');
  assert.equal(over.exp, 50);

  const under = MonsterCombatBuilder.applyMapLevelingPenalty(1000, 500, 50, 20);
  assert.equal(under.penaltyReason, 'MAP_UNDERLEVEL_50');
  assert.equal(under.exp, 500);

  const normal = MonsterCombatBuilder.applyMapLevelingPenalty(1000, 500, 20, 20);
  assert.equal(normal.penaltyReason, null);
  assert.equal(normal.penaltyMultiplier, 1.0);

  const expF = MonsterCombatBuilder.calculateMonsterExpReward(10, 'F', 'NORMAL');
  const expS = MonsterCombatBuilder.calculateMonsterExpReward(10, 'S', 'NORMAL');
  const expSBoss = MonsterCombatBuilder.calculateMonsterExpReward(10, 'S', 'BOSS');
  assert.equal(expS > expF, true);
  assert.equal(expSBoss > expS, true);

  const goldNormal = MonsterCombatBuilder.calculateMonsterGoldReward(10, 'D', 'NORMAL');
  const goldLeader = MonsterCombatBuilder.calculateMonsterGoldReward(10, 'D', 'LEADER');
  const goldBoss = MonsterCombatBuilder.calculateMonsterGoldReward(10, 'D', 'BOSS');
  assert.equal(goldLeader > goldNormal, true);
  assert.equal(goldBoss > goldLeader, true);
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

console.log(`\n🧬 Onda P2 — ${passed}/${tests.length} suítes shared & monstros passaram.`);
