# 🏛️ Arquitetura de Sistema, Motor Procedural & Combate Action 2.5D (`v0.64.0`)

Este documento descreve a arquitetura oficial do **Etheria Campus**: monorepo Orientado a Objetos, servidor autoritativo em tempo real, motor de regras procedurais zero-hardcode, sistema de internacionalização multi-locale e modularidade estrita (`< 1.000` linhas/arquivo).

---

## 1. Visão Geral dos Módulos do Monorepo

1. **`@etheria/shared` (`packages/shared/src/`):**
   * **`CombatDamageCalculator.ts`:** Cálculo isomórfico compartilhado entre Servidor e Arena `/play` (acerto/desvio com teto `[10%..95%]`, mitigação assintótica por nível e multiplicadores elementais/raciais).
   * **`MapPolygonMesh.ts`:** Engine geométrica *Point-in-Polygon* + *AABB Pre-Culling* + grid de navegação A* compartilhada entre validação anti-cheat no servidor e colisão preditiva/opacidade no cliente.
   * **`GameRulesConstants.ts`:** Constantes canônicas únicas (`MAX_BATTLE_MOVE_SPEED = 185`, `MIN_BATTLE_MOVE_SPEED = 60`, `AUTHORITATIVE_BASE_MOVE_SPEED = 168`, `ELEVATED_ROLES`, `ACTIVE_ELEMENTS`, `VALID_CHARACTER_EQUIPMENT_SLOTS` com 16 slots e helpers). Exposto ao browser como ES Module em `/shared/GameRulesConstants.js`.
2. **`@etheria/database` (`packages/database/`):**
   * Schema Prisma PostgreSQL com **34 modelos** e **11 índices (`@@index`)**.
   * **`SnapshotManager.ts`:** Exportação e restauração atômicas (`exportInFlight` / `exportQueued` coalesce, 3 lotes `Promise.all`, escrita via `.tmp` + `rename`) em `packages/database/snapshots/lowcode.snapshot.json`.
   * **`I18nCache.ts`:** Cache TTL de 5 minutos com isolamento por requisição via `node:async_hooks` (`AsyncLocalStorage`) e fallback em camadas para `pt-BR`, `en-US` (sobrepondo chaves legadas `'en'` + `'en-US'`) e `es-ES`.
3. **`AssetMirrorService` & Regra #10 Reforçada (Independência Pós-Salvamento):**
   * `SeytaniR/mcrework` é consultado **exclusivamente** no `/admin` como galeria opcional para descoberta de **assets novos**.
   * Ao salvar qualquer entidade (Mapas, Mapas Mundiais, Classes, NPCs, Monstros, Pets, Montarias/Asas, Equipamentos, Itens, Lojas, Baús, Skills, Status Effects/VFX), `AssetMirrorService` baixa imediatamente todos os arquivos necessários (`.webp`, `.png`, `atlas.json`, `char_manifest.json`, frames `bmp_*.png`) para `apps/server/cache/mcrework/` e valida caminhos contra path traversal antes da normalização.
   * **Zero URLs Externas Pós-Salvamento:** Todas as APIs, DTOs e arquivos de `/admin`, `/gm` e `/play` servem ativos exclusivamente via mesmo domínio (`/api/assets/mcrework/*`, `/api/assets/map-image/:id`, `/assets/*` e `/play/assets/*`), alimentando o `PlayAssetDownloader.js` mesmo offline de GitHub.
4. **`@etheria/server` (`apps/server/src/`):**
   * **`index.ts` (`EtheriaServerApp`):** Servidor HTTP nativo com Security Headers, CORS restrito por allowlist, parser JSON com teto de `1 MB` (`15 MB` em uploads de mapas), compressão `gzip` + `ETag`/`304 Not Modified`, pré-aquecimento de assets no boot, escopo `I18nCache.runWithLocale(...)` e shutdown gracioso (`SIGTERM`/`SIGINT`) com descarga do cache de posições.
   * **Roteamento Modular (`routes/`):** `AdminRouter.ts`, `PlayRouter.ts`, `PlayCombatRouter.ts` e `PartyRouter.ts`.
   * **Camada de Segurança (`security/`):** `AdminAuthService` (JWT HS256 dual-mode localhost/remoto + RBAC fail-closed `NONE`/`READ`/`READ_WRITE` por tabela), `CombatAntiCheatService` (`battleNonce` único anti-replay e validação de vitória/recompensas), `RateLimiter`, `InputSanitizer` e `ChatModerationFilter` (classificação 16+ anti-Scunthorpe).
   * **Performance em RAM (`controllers/`):** `MapRuntimeCacheService` (cache de `MapPolygonMesh`/dimensões TTL 5 min + buffer de posições com dirty-flush de 3s e flush em portais/voo/respawn) e `MapPresenceService` (estado multi-jogador no mapa + TTL 5 min / cap 2.000 entradas).
5. **Rotas `/admin`, `/play` & `/gm` (`apps/server/public/`):**
   * **`/shared/EtheriaI18n.js`:** Motor frontend trilíngue (`pt-BR`, `en-US`, `es-ES`) compartilhado entre `/play` e `/admin`, com seletor de idioma no login, lobby e configurações (`POST /api/play/locale` para persistir preferência autenticada + header `X-Etheria-Locale`).
   * **`/play` (Cliente Action 2.5D):** Dividido em submódulos SRP (`play.js`, `PlayWorldRenderer.js`, `PlayWorldInputController.js`, `PlayHudController.js`, `PlayGmController.js`, `PlayStatsModalController.js`, `ActionCombatArena.js`, `ArenaProjectileResolver.js`, `ArenaHudControls.js`, `ArenaPhysicsSolver.js`, `ArenaUnitAiController.js`, `ActionSkillEngine.js`, `ActionMotionEngine.js`, `ActionVfxRenderer.js`, `PlayPetsController.js`, `PlayHunterController.js`, `PlayPartyController.js`, `PlayBagController.js`, `PlayQuestsController.js`, `PlayDungeonChestController.js`, `PortalTravelController.js`, `PlayFlightAndWingsController.js`).
   * **`/admin` (Studio Low-Code):** Dividido em `admin.js`, `AdminAuth.js`, `AdminMapPickerModal.js`, `AdminCanvasEditor.js`, `AdminLayersDrawer.js`, `AdminQuestsTab.js`, `AdminQuestsBoardView.js`, `AdminMonsterConfigTab.js`, `AdminDungeonChestsTab.js`, `AdminUiLayoutsTab.js`, além das abas especializadas por tabela curada.

---

## 2. Mundo Procedural: 6 Tipos de Mapa, 4 Malhas Poligonais & Spawn

### 2.1. Os 6 Tipos de Mapa (`map_types`)
| Código | Nome | Quem Domina? | Spawna Monstros? | Regra de PvP |
| :--- | :--- | :---: | :---: | :--- |
| **`CITY`** | Cidade | **Alianças** | ❌ Não | 🤝 Duelo Aceito |
| **`VILLAGE`** | Vila | **Alianças** | ❌ Não | 🤝 Duelo Aceito |
| **`SUBURB`** | Subúrbio | **Facções** | ✅ Sim | 🤝 Duelo Aceito |
| **`HOSTILE_ZONE`** | Zona Hostil | **Facções** | ✅ Sim | ⚠️ PvP Forçado / PK (Criminoso) |
| **`CONFLICT_ZONE`** | Zona de Conflito | **Facções** | ✅ Sim | ⚔️ PvP Aberto |
| **`DUNGEON`** | Dungeon | `NONE` (Instância 1x/dia) | ✅ Sim | 🤝 Duelo Aceito |

### 2.2. As 4 Malhas Editáveis de Mapa (`maps`)
1. **`collision_mesh_json`:** Polígonos bloqueantes (colisão física validada pelo servidor e cliente).
2. **`overlap_mesh_json`:** Polígonos de sobreposição visual (reduzem a opacidade conforme `overlap_opacity`, ex: copas e telhados).
3. **`building_mesh_json`:** Malha de áreas de construção (lógica preparada: se contiver construção gera colisão; vazia permite livre passeio).
4. **`plantation_mesh_json`:** Malha de áreas de plantação (lógica preparada: se contiver plantação aplica sobreposição; vazia permite passeio livre sem sobreposição).

### 2.3. Configuração Global de Monstros (`MonsterGlobalConfigService`) & Sorteio Rank-First
* Todos os multiplicadores globais (Ranks `F..SS`, Hierarquia `NORMAL`/`LEADER`/`BOSS`, variação/bônus de nível, penalidades de desnível e regras de Dungeon) são editáveis no `/admin` (`monster_global_configs`).
* **Sorteio Justo Rank-First (`MonsterCombatBuilder.pickWeightedMonsterTemplate`):** O encontro sorteia primeiro o **Rank** (`F`..`SS`) usando os pesos configurados entre os ranks presentes no mapa, e depois escolhe uniformemente um monstro dentro daquele Rank — impedindo inflação artificial de raros quando há muitos templates `A`/`S`/`SS` cadastrados no mapa.

---

## 3. Elementos (5), Raças (11), Atributos & Cálculo de Dano

* **5 Elementos:** `FIRE > EARTH > AIR > WATER > FIRE` (`+25%` / `-25%`); `NEUTRAL` causa `-25%` (`0.75x`) contra tudo e recebe `+25%` (`1.25x`) de tudo. Personagens e pets novos sorteiam `10%` `NEUTRAL` e `20%` peso relativo para cada elemento ativo.
* **11 Raças (`+10%`):** `HUMAN` tem `+10%` sobre todas; ciclo fechado `PLANT > DRAGON > REPTILIAN > AQUATIC > ROBOTIC > CELESTIAL > DEMON > FAIRY > SPIRIT > BEAST > PLANT`.
* **Atributos & Mitigação Defensiva:** 6 Atributos Base (`VIT`, `STR`, `INT`, `WIS`, `AGI`, `DEX`) derivados dinamicamente via `attribute_conversions` para 16+ Atributos de Combate. Redução de defesa assintótica por nível:
  $$\text{Redução (\%)} = \frac{\text{Defesa Efetiva}}{\text{Defesa Efetiva} + (100 + 10 \times \text{Nível do Atacante})}$$

---

## 4. Combate Action 2.5D em Tempo Real & Habilidades por Blocos

* **Arena em Tempo Real (`ActionCombatArena`):** Substituiu integralmente o antigo protótipo de turnos 5B por combate Action 2.5D fluido em espaço contínuo com colisão, projéteis direcionais (`ArenaProjectileResolver`), IA tática (`ArenaUnitAiController`), física (`ArenaPhysicsSolver`), movimentação de conjuração (`MELEE_ADVANCE`, `STAND_IN_PLACE`, `DASH_LINEAR`, `LEAP_AOE`, `TELEPORT_BACKSTAB`) e HUD configurável por dispositivo (`client_ui_layout_templates`).
* **Grupo & Pets:**
  * Solo ou dupla no mapa/party: `1 Personagem + até 3 Pets` (slots `1..3` ativos).
  * Grupo completo de 3 jogadores (`PartyService`): `1 Personagem + 1 Pet` principal (`deploySlot = 1`) por jogador, com `+30%` de bônus cooperativo dividido igualmente.
* **7 Primitivas de Efeito em Skills/Passivas:** `DAMAGE`, `HEAL`, `SHIELD`, `STATUS`, `MOVE_SLOT`, `CLEANSE_DISPEL`, `RESOURCE` (`MANUAL`, `PASSIVE_ALWAYS`, `ON_HIT`, `ON_CRIT`, `ON_DAMAGE_TAKEN`, `ON_KILL`, `INTERVAL_TICK`).
* **Anti-Cheat Autoritativo (`CombatAntiCheatService`):** Toda batalha exige `battleId` + `battleNonce` emitidos pelo servidor; finalizações (`victory`/`defeat`/`flee`) validam posse, prevenção contra replay e coerência antes de creditar XP/Ouro/Drops/Pets/Quests.

---

## 5. Modularidade, Regra de 1.000 Linhas & Qualidade Automatizada

* **Regra #7 Estrita:** Nenhum arquivo de código (`.ts`, `.js`, `.html`, `.css`) em `apps/` ou `packages/` ultrapassa **1.000 linhas**. Módulos extensos são fatiados por responsabilidade única.
* **Regra #1 Estrita:** Todo módulo TypeScript no núcleo ativo possui cabeçalho JSDoc completo (`@file`, `@module`, `@description`, `@rules`, `@dependencies`).
* **Regra #4 Multi-Locale (`i18n`):** Contexto isolado por requisição no servidor via `I18nCache.runWithLocale(...)` (suportando `?locale=`, `X-Etheria-Locale` e `Accept-Language`) integrado ao `EtheriaI18n.js` no frontend em `pt-BR`, `en-US` e `es-ES`.
* **Suíte de Testes (`npm test`):** Executa `test_p0_security.mjs`, `test_p1_assets_and_cache.mjs`, `test_p2_shared_and_monsters.mjs`, `test_p3_i18n.mjs` e `test_action_motion_engine.mjs` sem mutar dados persistidos (Cláusula 0.2).
