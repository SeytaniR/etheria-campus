/**
 * @file tests/test_p0_security.mjs
 * @module @etheria/tests
 * @description Suíte automatizada de verificação da Onda P0 de Segurança (InputSanitizer, RateLimiter, CombatAntiCheatService e RBAC Fail-Closed).
 * @rules Executa contra os módulos compilados em `apps/server/dist/security/` sem alterar registros do PostgreSQL.
 * @dependencies node:assert/strict, apps/server/dist/security/*
 */

import assert from 'node:assert/strict';
import { InputSanitizer } from '../apps/server/dist/security/InputSanitizer.js';
import { RateLimiter } from '../apps/server/dist/security/RateLimiter.js';
import { CombatAntiCheatService } from '../apps/server/dist/security/CombatAntiCheatService.js';
import { AdminAuthService } from '../apps/server/dist/security/AdminAuthService.js';

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

// 1. InputSanitizer — Stored XSS e Sanitização de Erros Prisma
test('InputSanitizer rejeita payloads XSS em nome de personagem', () => {
  assert.throws(() => InputSanitizer.validateCharacterName('<img src=x onerror=1>'));
  assert.throws(() => InputSanitizer.validateCharacterName('"><svg/onload=1>'));
  assert.throws(() => InputSanitizer.validateCharacterName("A' OR 1=1"));
  assert.equal(InputSanitizer.validateCharacterName('  Lira_Vento  '), 'Lira_Vento');
  assert.equal(InputSanitizer.validateCharacterName('Kael-01 Silva'), 'Kael-01 Silva');
});

test('InputSanitizer valida username e oculta detalhes internos de Prisma/SQL', () => {
  assert.throws(() => InputSanitizer.validateUsername('<admin>'));
  assert.equal(InputSanitizer.validateUsername('bruno.gm-01'), 'bruno.gm-01');

  const safePrisma = InputSanitizer.sanitizeHttpError({
    name: 'PrismaClientKnownRequestError',
    code: 'P2002',
    message: 'Unique constraint failed on public.user_accounts',
  });
  assert.equal(safePrisma.statusCode, 500);
  assert.equal(safePrisma.message.includes('user_accounts'), false);
});

// 2. RateLimiter — Limite e Janela
test('RateLimiter permite até o limite e bloqueia o excedente', () => {
  const rl = new RateLimiter();
  assert.equal(rl.consume('ip:1.2.3.4', 3, 10_000).allowed, true);
  assert.equal(rl.consume('ip:1.2.3.4', 3, 10_000).allowed, true);
  const third = rl.consume('ip:1.2.3.4', 3, 10_000);
  assert.equal(third.allowed, true);
  assert.equal(third.remaining, 0);

  const fourth = rl.consume('ip:1.2.3.4', 3, 10_000);
  assert.equal(fourth.allowed, false);
  assert.equal(fourth.retryAfterSec >= 1, true);
});

// 3. CombatAntiCheatService — Battle Nonce, Dano e Duração
test('CombatAntiCheatService bloqueia vitória instantânea/sem dano/nonce inválido para PLAYER', () => {
  const mockBattle = {
    battleId: 'b-1',
    battleNonce: 'secret-nonce-123',
    createdAt: Date.now() - 50,
    round: 1,
    isFinished: false,
    winner: null,
    combatLog: [],
    player: {
      id: 'p1', index: 0, name: 'Hero', level: 1,
      hp: 200, maxHp: 200, mp: 50, maxMp: 50,
      atk: 30, physAtk: 30, magAtk: 10, def: 10, speed: 10,
      spriteKey: '100101', atlasJsonUrl: '', atlasWebpUrl: '', groundOffsetY: 0, thumbUrl: '',
      isAlive: true,
    },
    pets: [],
    monsters: [
      {
        id: 'm1', index: 0, name: 'Slime', level: 1,
        hp: 300, maxHp: 300, mp: 10, maxMp: 10,
        atk: 15, def: 5, speed: 8,
        spriteKey: '1', atlasJsonUrl: '', atlasWebpUrl: '', groundOffsetY: 0, thumbUrl: '',
        isAlive: true,
      },
    ],
  };

  // Sem nonce válido
  assert.equal(
    CombatAntiCheatService.validateVictoryClaim(mockBattle, 'PLAYER', {
      battleNonce: 'wrong',
      totalDamageDealt: 300,
      hitsCount: 3,
    }).ok,
    false
  );

  // Dano zerado
  assert.equal(
    CombatAntiCheatService.validateVictoryClaim(mockBattle, 'PLAYER', {
      battleNonce: 'secret-nonce-123',
      totalDamageDealt: 0,
      hitsCount: 0,
    }).ok,
    false
  );

  // Vitória em 50ms (< 800ms mínimo)
  assert.equal(
    CombatAntiCheatService.validateVictoryClaim(mockBattle, 'PLAYER', {
      battleNonce: 'secret-nonce-123',
      totalDamageDealt: 300,
      hitsCount: 3,
    }).ok,
    false
  );

  // Vitória legítima após 2.000ms
  const legitBattle = { ...mockBattle, createdAt: Date.now() - 2000 };
  assert.equal(
    CombatAntiCheatService.validateVictoryClaim(legitBattle, 'PLAYER', {
      battleNonce: 'secret-nonce-123',
      totalDamageDealt: 300,
      hitsCount: 4,
    }).ok,
    true
  );

  // GM mantém agilidade de testes mesmo sem telemetria
  assert.equal(
    CombatAntiCheatService.validateVictoryClaim(mockBattle, 'GM', {}).ok,
    true
  );
});

// 4. AdminAuthService — RBAC Fail-Closed
test('AdminAuthService.canAccessTable aplica modo fail-closed (NONE) para chaves ausentes de ADMIN', () => {
  const auth = new AdminAuthService(null);
  const adminPayload = {
    sub: '4',
    username: 'bruno',
    role: 'ADMIN',
    tablePermissions: { MAPS: 'READ_WRITE', ATTRIBUTES: 'READ' },
    authSource: 'DATABASE_CRUD',
    exp: Date.now() + 60_000,
  };
  const devPayload = {
    sub: '1',
    username: 'dev',
    role: 'DEV',
    tablePermissions: {},
    authSource: 'DATABASE_CRUD',
    exp: Date.now() + 60_000,
  };

  assert.equal(auth.canAccessTable(adminPayload, 'MAPS', 'READ_WRITE'), true);
  assert.equal(auth.canAccessTable(adminPayload, 'ATTRIBUTES', 'READ'), true);
  assert.equal(auth.canAccessTable(adminPayload, 'ATTRIBUTES', 'READ_WRITE'), false);
  assert.equal(auth.canAccessTable(adminPayload, 'SHOPS', 'READ'), false);
  assert.equal(auth.canAccessTable(adminPayload, 'USERS', 'READ'), false);
  assert.equal(auth.canAccessTable(devPayload, 'USERS', 'READ_WRITE'), true);
  assert.equal(auth.canAccessTable(devPayload, 'SHOPS', 'READ_WRITE'), true);
});

console.log(`\n🛡️ Onda P0 — ${passed}/${total} suítes de segurança passaram.`);
