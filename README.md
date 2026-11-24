# ⚔️ Etheria Campus — Modern Action 2.5D MMORPG (`v0.64.0`)

Bem-vindo ao repositório oficial do **Etheria Campus**, um MMORPG 2.5D Action em tempo real construído com arquitetura **Orientada a Objetos**, **Motor Procedural Zero-Hardcode**, **Servidor Autoritário em Node.js/TypeScript**, **Studio Low-Code (`/admin`)**, **Painel Game Master (`/gm`)**, suporte nativo **Multi-Locale (`pt-BR`, `en-US`, `es-ES`)** e **Cliente Multiplataforma (Canvas 2D / Android APK)**.

> **Regra de Independência Pós-Salvamento (Regra #10):** O repositório [`SeytaniR/mcrework`](https://github.com/SeytaniR/mcrework) é utilizado apenas como galeria opcional de descoberta de assets novos na rota `/admin`. No momento do salvamento, todos os sprites, mapas, ícones e VFX são baixados localmente (`apps/server/cache/mcrework/`) e servidos pelo próprio servidor (`/api/assets/mcrework/*` e `/api/assets/map-image/:id`) em `/admin`, `/gm`, `/play` e backend.

---

## 📚 Documentação Mestra (Leitura Obrigatória para IAs Desenvolvedoras)

> ⚠️ **REGRA PARA IAs:** Antes de executar qualquer tarefa neste repositório, leia obrigatoriamente os documentos abaixo na ordem indicada:

1. 🛡️ **[`AGENTS.md`](./AGENTS.md)** — Constituição Rígida das IAs, Cláusula 0 ("Anti-Vibe-Coder"), Cláusula 0.1 (Escopo Estrito), Cláusula 0.2 (Proteção de Dados do Banco), Regra #7 (< 1.000 linhas/arquivo), Regra #9 (Git + Deploy VPS), Regra #10 (Independência `mcrework`), Regra #11 (Headless) e Regra #12.
2. 🤝 **[`docs/HANDOFF.md`](./docs/HANDOFF.md)** — Estado atual do projeto, registro de backups e fila de continuidade entre turnos.
3. 📦 **[`CHANGELOG.md`](./CHANGELOG.md)** — Histórico incremental versionado (`SemVer`).
4. 🏛️ **[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)** — Arquitetura modular de servidor/cliente, Combate Action 2.5D autoritativo, 4 malhas poligonais, motor procedural, cache em RAM e sistema `i18n`.
5. 🗄️ **[`docs/DATABASE_SCHEMA.md`](./docs/DATABASE_SCHEMA.md)** — Modelagem completa das **34 tabelas** Prisma PostgreSQL, índices de performance e Snapshots JSON atômicos.
6. ⚡ **[`docs/PERFORMANCE_STANDARDS.md`](./docs/PERFORMANCE_STANDARDS.md)** — Diretrizes de 60+ FPS no Canvas 2D (zero `shadowBlur`/`filter`, texturas Offscreen, Zero-Alloc Y-Sorting).

---

## 🏗️ Estrutura do Monorepo

* **`packages/shared` (`@etheria/shared`):** Núcleo isomórfico compartilhado entre servidor e browser (`CombatDamageCalculator`, `MapPolygonMesh`, `GameRulesConstants`), servido também em `/shared/*.js`.
* **`packages/database` (`@etheria/database`):** Schema Prisma PostgreSQL (`34` modelos), `SnapshotManager` atômico (`packages/database/snapshots/lowcode.snapshot.json`) e `I18nCache` com `AsyncLocalStorage` multi-locale.
* **`apps/server` (`@etheria/server`):** Servidor HTTP autoritativo (`EtheriaServerApp`, `ETag`/`304`/`gzip`, shutdown gracioso), roteadores modulares (`AdminRouter`, `PlayRouter`, `PlayCombatRouter`, `PartyRouter`), controladores de domínio em `src/controllers/`, segurança (`AdminAuthService`, `CombatAntiCheatService`, `RateLimiter`, `InputSanitizer`, `ChatModerationFilter`) e clientes estáticos em `public/` (`/admin`, `/play`, `/gm`, `/shared`).
* **`tests/`:** Suíte automatizada não-destrutiva unificada via `npm test` (`tests/run_all_tests.mjs`).
* **`scripts/deploy_vps.py`:** Rotina automatizada e segura de deploy para a VPS Azure (`https://40-65-63-193.sslip.io`) via chave SSH, com backup preventivo e healthcheck HTTP.

---

## 🛠️ Comandos Úteis de Desenvolvimento

```bash
# Compilar pacotes compartilhados e de banco
npm run build:packages

# Compilar servidor HTTP / TypeScript
npm --workspace=@etheria/server run build

# Checagem estrita de tipos em todos os workspaces
npm run typecheck

# Executar suíte unificada de testes (P0 Segurança, P1 Assets/Cache, P2 Shared/Monstros, P3 i18n, ActionMotion)
npm test

# Iniciar servidor em desenvolvimento
npm run dev:server

# Exportar / restaurar snapshot JSON do PostgreSQL
npm run db:snapshot:export
npm run db:snapshot:restore

# Deploy seguro na VPS Azure via chave SSH (~/.ssh/id_ed25519)
python scripts/deploy_vps.py
```

---

## 🎮 Pilares Consolidados (`v0.64.0`)

* **Curadoria Estrita & Independência de Assets:** Somente registros cadastrados via `/admin` existem no jogo; após o salvamento, todos os binários são espelhados em `apps/server/cache/mcrework/` e servidos via `/api/assets/*`.
* **6 Tipos de Mapa (`CITY`, `VILLAGE`, `SUBURB`, `HOSTILE_ZONE`, `CONFLICT_ZONE`, `DUNGEON`):** Dominação territorial (`ALLIANCE` / `FACTION` / `NONE`), regras de spawn e PvP determinadas pelo tipo de mapa, além de instâncias diárias de Dungeon com Baús de recompensa (`COMMON` / `EPIC` / `LEGENDARY`).
* **4 Malhas Poligonais Editáveis por Mapa (`/admin` Editor Visual):** `collisionMeshJson`, `overlapMeshJson`, `buildingMeshJson` (colisão se ocupado) e `plantationMeshJson` (sobreposição se ocupado), validadas pelo algoritmo compartilhado `MapPolygonMesh`.
* **40 Biomas, 5 Elementos & 11 Raças:** Vínculo procedural de spawn, ciclo elemental `FIRE > EARTH > AIR > WATER > FIRE` (`±25%`, `NEUTRAL` penalizado `-25%/+25%`) e vantagem racial (`HUMAN` `+10%` sobre todas + ciclo das 10 raças `+10%`).
* **Combate Action 2.5D em Tempo Real (`ActionCombatArena`):** Movimentação contínua, colisão em arena, habilidades por blocos visuais (7 primitivas), projéteis/AoE/zonas de solo, trava autoritativa anti-cheat (`battleNonce` + `CombatAntiCheatService`), modo Grupo (Parties até 3 jogadores), Pets em formação e `MonsterGlobalConfigService` (sorteio Rank-First justo e variantes `NORMAL`/`LEADER`/`BOSS`).
* **Economia, Progressão & Multi-Locale (`i18n`):** Inventário em grade de 300 slots, 16 slots de personagem (incl. Asas e Montarias Voadoras em `equipments`) + 6 slots de Pet, Conjuntos (`50%`/`100%`), Lojas NPC, Caçador de Pets por Essências, Quests Lineares/Meta (`MAIN`, `SIDE`, `EPIC`, `PROFICIENCY`, `META`), e suporte trilíngue (`pt-BR`, `en-US`, `es-ES`) via `I18nCache` + `EtheriaI18n.js`.
