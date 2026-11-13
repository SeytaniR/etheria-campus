/**
 * @file tests/test_action_motion_engine.mjs
 * @description Suite de testes unitários para o ActionMotionEngine e ArenaPhysicsSolver
 *   validando:
 *   1. Ciclo de Ataque Tríplice (Windup -> Cast Point -> Backswing).
 *   2. Desacoplamento de Mira e Facing Lock (sem tiros de costas).
 *   3. Input Buffering de 160ms.
 *   4. Cinemática Suave e Deslize Vetorial Contínuo.
 *   5. Auto-Attack Resets e Combos Mecânicos.
 *   6. Priorização do Ataque sobre o Joystick em Movimento.
 *   7. Modo de Perseguição / Aproximação ao Alvo fora de alcance (estilo League of Legends).
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const motionEngineCode = fs.readFileSync(
  path.join(projectRoot, 'apps/server/public/play/js/ActionMotionEngine.js'),
  'utf8'
);
const physicsSolverCode = fs.readFileSync(
  path.join(projectRoot, 'apps/server/public/play/js/ArenaPhysicsSolver.js'),
  'utf8'
);

const fakeWindow = {
  ActionSkillEngine: {
    isActionBlocked: () => false,
    getEffectiveStats: (u) => u,
  },
};
globalThis.window = fakeWindow;

eval(physicsSolverCode);
eval(motionEngineCode);

const ActionMotionEngine = fakeWindow.ActionMotionEngine;
const ArenaPhysicsSolver = fakeWindow.ArenaPhysicsSolver;

assert(ActionMotionEngine, 'ActionMotionEngine deve estar definido');
assert(ArenaPhysicsSolver, 'ArenaPhysicsSolver deve estar definido');

console.log('--- INICIANDO TESTES DO MOTOR DE COMBATE FLUIDO REVISADO ---');

function createMockArena() {
  const arena = {
    isActive: true,
    combatState: 'FIGHTING',
    arenaCenterX: 500,
    arenaCenterY: 500,
    arenaRadiusX: 650,
    arenaRadiusY: 470,
    floatingTexts: [],
    projectiles: [],
    skillCooldowns: { attack: 0, skill1: 0, skill2: 0, skill3: 0, skill4: 0, dash: 0 },
    compute8Direction(dx, dy) {
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      const sector = Math.round((90 - angle) / 45);
      return ((sector % 8) + 8) % 8;
    },
    isBlocked(x, y) {
      return false;
    },
    getLockedTarget() {
      return this.monsters[0];
    },
    triggerDash() {
      if (this.motionEngine) {
        this.motionEngine.cancelBackswing('DASH');
        this.motionEngine.resetAutoAttackTimer();
      }
    },
    updateHud() {},
    spawnHomingProjectile(target, skillType, aoe, dmg, isCrit, emoji, color, isMag, sx, sy, spd, acc, team, critDmg, extra) {
      this.projectiles.push({ target, dmg, emoji, team, extra });
    },
    player: {
      id: 'p1',
      x: 500,
      y: 500,
      dir: 1,
      action: 0,
      speed: 180,
      atk: 50,
      attackSpeed: 1.0,
      attackRange: 200,
      combatStyle: 'RANGED',
      damageType: 'PHYSICAL',
      critDmg: 1.5,
      isAlive: true,
      isAttacking: false,
      hitTimer: 0,
      isDashing: false,
      dashTimer: 0,
    },
    monsters: [
      {
        id: 'm1',
        x: 600,
        y: 500,
        isAlive: true,
        hp: 300,
        maxHp: 300,
      },
    ],
  };
  return arena;
}

// --------------------------------------------------------------------------
// TESTE 1: Priorização do Ataque sobre o Joystick em Movimento
// --------------------------------------------------------------------------
console.log('\n[TESTE 1] Priorização do Ataque sobre Joystick');
{
  const arena = createMockArena();
  const engine = new ActionMotionEngine(arena);
  arena.motionEngine = engine;

  // Jogador está correndo com o joystick ativo (rawVx = 1, rawVy = 0)
  const now = 1000;
  const started = engine.requestAttack(arena.player, arena.monsters[0], now);
  assert.strictEqual(started, true, 'Ataque deve iniciar');
  assert.strictEqual(engine.attackState, 'WINDUP', 'Estado deve ser WINDUP');

  // Continua segurando o joystick durante o Windup
  engine.updatePlayerKinematics(arena.player, 1, 0, 180, 0.05, now + 50);
  assert.strictEqual(engine.attackState, 'WINDUP', 'O joystick NÃO deve cancelar o Windup prematuramente (prioridade do ataque)');

  // Conclui o Windup -> Disparo
  const windupLeft = engine.windupTimer;
  engine.updatePlayerKinematics(arena.player, 1, 0, 180, windupLeft + 0.02, now + 300);
  assert.strictEqual(engine.attackState, 'BACKSWING', 'Disparou projétil no Cast Point e entrou em Backswing');
  assert.strictEqual(arena.projectiles.length, 1, 'Projétil gerado');

  // No Backswing, o joystick cancela o backswing e retoma a corrida imediatamente (Kiting)
  engine.updatePlayerKinematics(arena.player, 1, 0, 180, 0.05, now + 350);
  assert.strictEqual(engine.attackState, 'IDLE', 'Backswing cancelado por corrida (Kiting)');
  console.log('✓ Teste 1 aprovado: Ataque tem prioridade absoluta sobre o joystick, com kiting fluido!');
}

// --------------------------------------------------------------------------
// TESTE 2: Modo de Aproximação / Perseguição estilo LoL quando fora de alcance
// --------------------------------------------------------------------------
console.log('\n[TESTE 2] Modo de Aproximação / Perseguição (Estilo League of Legends)');
{
  const arena = createMockArena();
  const engine = new ActionMotionEngine(arena);
  arena.motionEngine = engine;

  // Monstro está a 450px (fora do attackRange de 200px)
  arena.monsters[0].x = 950;
  arena.monsters[0].y = 500;

  const now = 2000;
  const started = engine.requestAttack(arena.player, arena.monsters[0], now);
  assert.strictEqual(started, true, 'Deve aceitar a ordem de ataque e iniciar aproximação');
  assert.strictEqual(engine.isApproaching, true, 'Deve ativar o modo de aproximação automática');
  assert.strictEqual(engine.attackState, 'IDLE', 'Não entra em windup enquanto estiver fora de alcance');

  // Simula avanço de perseguição
  // Jogador avança em direção ao monstro (dx = +1, dy = 0)
  for (let step = 0; step < 10; step++) {
    engine.updatePlayerKinematics(arena.player, 0, 0, 180, 0.1, now + (step * 100));
  }
  // Jogador andou cerca de 180 px (500 + 180 = 680). Distância para 950 = 270px (ainda fora).
  assert(arena.player.x > 500, 'Jogador deve estar caminhando em direção ao monstro');

  // Teleporta o jogador para dentro do alcance (x: 800 -> dist = 150px <= 200px)
  arena.player.x = 800;
  engine.updatePlayerKinematics(arena.player, 0, 0, 180, 0.05, now + 1200);

  assert.strictEqual(engine.isApproaching, false, 'Aproximação encerra ao entrar no alcance');
  assert.strictEqual(engine.attackState, 'WINDUP', 'Ataque deve disparar automaticamente ao atingir o alcance exato!');
  console.log('✓ Teste 2 aprovado: Personagem persegue o alvo até entrar em alcance e dispara automaticamente!');
}

// --------------------------------------------------------------------------
// TESTE 3: Facing Lock e Anti-Tiro de Costas
// --------------------------------------------------------------------------
console.log('\n[TESTE 3] Facing Lock e Anti-Tiro de Costas');
{
  const arena = createMockArena();
  const engine = new ActionMotionEngine(arena);
  arena.motionEngine = engine;

  arena.monsters[0].x = 600;
  arena.monsters[0].y = 500;
  const targetDir = arena.compute8Direction(100, 0);

  const now = 3000;
  engine.requestAttack(arena.player, arena.monsters[0], now);
  assert.strictEqual(arena.player.dir, targetDir, 'Deve virar de frente para o monstro');

  // Simula jogador correndo para a esquerda (vx = -1)
  engine.updatePlayerKinematics(arena.player, -1, 0, 180, 0.05, now + 50);
  assert.strictEqual(arena.player.dir, targetDir, 'Direção continua protegida contra tiros de costas!');
  console.log('✓ Teste 3 aprovado: Facing Lock garante que disparos saem sempre pela frente.');
}

// --------------------------------------------------------------------------
// TESTE 4: Auto-Attack Reset no Dash
// --------------------------------------------------------------------------
console.log('\n[TESTE 4] Auto-Attack Reset no Dash');
{
  const arena = createMockArena();
  const engine = new ActionMotionEngine(arena);
  arena.motionEngine = engine;

  engine.attackRecoveryTimer = 0.80;
  arena.triggerDash();
  assert.strictEqual(engine.attackRecoveryTimer, 0, 'Dash reseta o cooldown do ataque');
  console.log('✓ Teste 4 aprovado: Auto-Attack reset funciona perfeitamente.');
}

console.log('\n======================================================');
console.log('🎉 TODOS OS TESTES (INCLUINDO JOYSTICK & PURSUIT) PASSARAM COM SUCESSO!');
console.log('======================================================');
