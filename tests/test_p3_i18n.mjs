/**
 * @file tests/test_p3_i18n.mjs
 * @module @etheria/tests
 * @description Suíte automatizada de verificação da Onda P3 (Motor Multi-Locale I18nCache com AsyncLocalStorage,
 *   fallback em camadas sem mutação no banco, EtheriaI18n.js e wiring HTTP de locale).
 * @rules Execução 100% em memória/sandbox sem alterações em PostgreSQL (Cláusula 0.2).
 * @dependencies node:assert/strict, node:fs, node:path, node:url, node:vm, packages/database/dist/I18nCache.js
 */

import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as vm from 'node:vm';
import { I18nCache, SUPPORTED_LOCALES, DEFAULT_LOCALE } from '../packages/database/dist/I18nCache.js';

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

await test('I18nCache.normalizeLocale, isSupportedLocaleInput e parseAcceptLanguage', () => {
  assert.deepEqual([...SUPPORTED_LOCALES], ['pt-BR', 'en-US', 'es-ES']);
  assert.equal(DEFAULT_LOCALE, 'pt-BR');

  assert.equal(I18nCache.normalizeLocale('pt-BR'), 'pt-BR');
  assert.equal(I18nCache.normalizeLocale('pt'), 'pt-BR');
  assert.equal(I18nCache.normalizeLocale('en'), 'en-US');
  assert.equal(I18nCache.normalizeLocale('en-US'), 'en-US');
  assert.equal(I18nCache.normalizeLocale('en_GB'), 'en-US');
  assert.equal(I18nCache.normalizeLocale('es'), 'es-ES');
  assert.equal(I18nCache.normalizeLocale('es-MX'), 'es-ES');
  assert.equal(I18nCache.normalizeLocale('fr-FR'), 'pt-BR');

  assert.equal(I18nCache.isSupportedLocaleInput('en-US'), true);
  assert.equal(I18nCache.isSupportedLocaleInput('es'), true);
  assert.equal(I18nCache.isSupportedLocaleInput('pt_BR'), true);
  assert.equal(I18nCache.isSupportedLocaleInput('fr-FR'), false);
  assert.equal(I18nCache.isSupportedLocaleInput(''), false);

  assert.equal(I18nCache.parseAcceptLanguage('es-ES,es;q=0.9,en;q=0.8'), 'es-ES');
  assert.equal(I18nCache.parseAcceptLanguage('fr-CH,en-GB;q=0.8,pt-BR;q=0.5'), 'en-US');
  assert.equal(I18nCache.parseAcceptLanguage('de-DE;q=0.9'), 'pt-BR');
});

await test('I18nCache.runWithLocale mantém isolamento entre Promises concorrentes', async () => {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const results = await Promise.all([
    I18nCache.runWithLocale('pt-BR', async () => {
      await sleep(20);
      return I18nCache.getCurrentLocale();
    }),
    I18nCache.runWithLocale('en-US', async () => {
      await sleep(5);
      return I18nCache.getCurrentLocale();
    }),
    I18nCache.runWithLocale('es-ES', async () => {
      await sleep(12);
      return I18nCache.getCurrentLocale();
    }),
  ]);
  assert.deepEqual(results, ['pt-BR', 'en-US', 'es-ES']);
  assert.equal(I18nCache.getCurrentLocale(), 'pt-BR');
});

await test('I18nCache.getTranslations aplica fallback em camadas em 1 única query e invalidação em cascata', async () => {
  I18nCache.invalidate();
  let queryCount = 0;
  const mockRows = [
    { key: 'map.1.name', locale: 'pt-BR', text: 'Vila Izumo' },
    { key: 'map.2.name', locale: 'pt-BR', text: 'Floresta Antiga' },
    { key: 'mob.1.name', locale: 'pt-BR', text: 'Slime' },
    { key: 'map.1.name', locale: 'en', text: 'Izumo Legacy EN' },
    { key: 'map.2.name', locale: 'en', text: 'Ancient Forest' },
    { key: 'map.1.name', locale: 'en-US', text: 'Izumo Village' },
    { key: 'map.1.name', locale: 'es-ES', text: 'Aldea Izumo' },
  ];

  const mockPrisma = {
    i18nTranslation: {
      findMany: async ({ where }) => {
        queryCount++;
        const allowed = new Set(where.locale.in);
        return mockRows.filter((r) => allowed.has(r.locale));
      },
    },
  };

  // en-US sobrepõe pt-BR < en legado < en-US explícito
  const enMap = await I18nCache.runWithLocale('en-US', () => I18nCache.getTranslations(mockPrisma));
  assert.equal(queryCount, 1);
  assert.equal(enMap.get('map.1.name'), 'Izumo Village');
  assert.equal(enMap.get('map.2.name'), 'Ancient Forest');
  assert.equal(enMap.get('mob.1.name'), 'Slime');

  // Cache hit não refaz query
  await I18nCache.runWithLocale('en-US', () => I18nCache.getTranslations(mockPrisma));
  assert.equal(queryCount, 1);

  // es-ES sobrepõe pt-BR < es-ES
  const esMap = await I18nCache.runWithLocale('es-ES', () => I18nCache.getTranslations(mockPrisma));
  assert.equal(queryCount, 2);
  assert.equal(esMap.get('map.1.name'), 'Aldea Izumo');
  assert.equal(esMap.get('map.2.name'), 'Floresta Antiga');

  // Invalidar pt-BR também limpa cache de en-US e es-ES (pois herdam fallback de pt-BR)
  I18nCache.invalidate('pt-BR');
  await I18nCache.runWithLocale('es-ES', () => I18nCache.getTranslations(mockPrisma));
  assert.equal(queryCount, 3);
  I18nCache.invalidate();
});

await test('EtheriaI18n.js possui paridade 100% de chaves entre pt-BR, en-US e es-ES e interpolação', () => {
  const i18nJsPath = path.join(repoRoot, 'apps/server/public/shared/EtheriaI18n.js');
  const code = fs.readFileSync(i18nJsPath, 'utf8');
  const storageMap = new Map();
  const sandbox = {
    globalThis: {},
    localStorage: {
      getItem: (k) => (storageMap.has(k) ? storageMap.get(k) : null),
      setItem: (k, v) => storageMap.set(k, String(v)),
    },
    navigator: { language: 'pt-BR' },
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(code, sandbox);

  const engine = sandbox.EtheriaI18n;
  assert.ok(engine, 'EtheriaI18n deve ser exportado no escopo global');
  assert.deepEqual(Array.from(engine.SUPPORTED_LOCALES), ['pt-BR', 'en-US', 'es-ES']);

  const ptKeys = Object.keys(engine.DICTIONARIES['pt-BR']).sort();
  const enKeys = Object.keys(engine.DICTIONARIES['en-US']).sort();
  const esKeys = Object.keys(engine.DICTIONARIES['es-ES']).sort();
  assert.ok(ptKeys.length >= 40, 'Deve conter ao menos 40 chaves de interface');
  assert.deepEqual(enKeys, ptKeys, 'en-US deve ter exata paridade de chaves com pt-BR');
  assert.deepEqual(esKeys, ptKeys, 'es-ES deve ter exata paridade de chaves com pt-BR');

  for (const loc of ['pt-BR', 'en-US', 'es-ES']) {
    for (const k of ptKeys) {
      assert.equal(typeof engine.DICTIONARIES[loc][k], 'string');
      assert.ok(engine.DICTIONARIES[loc][k].trim().length > 0, `${loc}.${k} não pode ser vazio`);
    }
  }

  engine.DICTIONARIES['pt-BR']['test.greet'] = 'Olá, {name}!';
  engine.DICTIONARIES['en-US']['test.greet'] = 'Hello, {name}!';
  engine.DICTIONARIES['es-ES']['test.greet'] = '¡Hola, {name}!';

  assert.equal(engine.setLocale('en-US'), 'en-US');
  assert.equal(engine.getLocale(), 'en-US');
  assert.equal(engine.t('test.greet', { name: 'Kael' }), 'Hello, Kael!');
  assert.equal(engine.t('admin.tabs.maps'), '🗺️ Maps');

  assert.equal(engine.setLocale('es-ES'), 'es-ES');
  assert.equal(engine.t('test.greet', { name: 'Kael' }), '¡Hola, Kael!');
  assert.equal(engine.t('admin.tabs.shops'), '🏪 Tiendas');
});

await test('Servidor HTTP e PlayRouter expõem endpoints e propagação automática de locale', () => {
  const indexSrc = fs.readFileSync(path.join(repoRoot, 'apps/server/src/index.ts'), 'utf8');
  const playRouterSrc = fs.readFileSync(path.join(repoRoot, 'apps/server/src/routes/PlayRouter.ts'), 'utf8');

  assert.ok(indexSrc.includes('I18nCache.runWithLocale('), 'index.ts deve isolar locale com runWithLocale');
  assert.ok(indexSrc.includes("'/api/i18n/meta'"), 'index.ts deve expor GET /api/i18n/meta');
  assert.ok(playRouterSrc.includes("'/api/play/locale'"), 'PlayRouter deve expor POST /api/play/locale');
});

console.log(`\nResumo P3 (i18n Multi-Locale): ${passed}/${total} testes aprovados.`);
if (passed !== total) {
  process.exit(1);
}
