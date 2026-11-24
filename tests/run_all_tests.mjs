/**
 * @file tests/run_all_tests.mjs
 * @module @etheria/tests
 * @description Runner unificado de testes automatizados (`npm test`) do Etheria Campus.
 *   Executa sequencialmente todas as suítes P0, P1, P2 e Motor de Combate em processo isolado,
 *   garantindo saída zero antes de commits e deploys em produção.
 * @rules Execução 100% não-destrutiva contra módulos compilados e mocks em memória (Cláusula 0.2).
 * @dependencies node:child_process, node:path, node:url
 */

import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const suites = [
  'tests/test_p0_security.mjs',
  'tests/test_p1_assets_and_cache.mjs',
  'tests/test_p2_shared_and_monsters.mjs',
  'tests/test_action_motion_engine.mjs',
];

let failed = 0;
for (const suite of suites) {
  console.log(`\n▶ Executando ${suite}...`);
  const res = spawnSync(process.execPath, [path.join(repoRoot, suite)], {
    cwd: repoRoot,
    stdio: 'inherit',
  });
  if (res.status !== 0) {
    failed++;
    console.error(`❌ Suíte falhou (${suite}, exit=${res.status})`);
  }
}

console.log(`\n======================================================`);
if (failed > 0) {
  console.error(`❌ FALHA: ${failed}/${suites.length} suíte(s) falharam.`);
  process.exit(1);
}
console.log(`✅ SUCESSO TOTAL: Todas as ${suites.length} suítes de teste passaram!`);
