# 🤝 Diário de Passagem de Turno entre IAs (`HANDOFF.md`)

> **INSTRUÇÃO OBRIGATÓRIA PARA A IA QUE ESTÁ ASSUMINDO O TURNO:**
> 1. Leia `AGENTS.md` e `CHANGELOG.md` antes de qualquer ação.
> 2. Confira abaixo o **Estado Atual** e a **Próxima Tarefa Exata da Fila**.
> 3. Antes de encerrar seu turno, atualize este arquivo, incremente a versão no `CHANGELOG.md` e faça `git commit` + `git push`.

---

## 📌 Status Atual do Projeto
* **Versão Atual:** `v0.61.0`
* **Última Atualização:** `2026-11-24`
* **Fase Atual:** **Onda P0 Concluída — Segurança Crítica, Regra #10 Reforçada (`mcrework`) & Deploy Seguro via Chave SSH (`v0.61.0`)** — Removidos os 17 scripts com senha hardcoded e migrado `scripts/deploy_vps.py` para autenticação via chave SSH (`~/.ssh/id_ed25519`) com backup automático pré-pull; criados `RateLimiter.ts`, `InputSanitizer.ts`, `CombatAntiCheatService.ts`, `PlayCombatRouter.ts` e `PlaySecurityUtils.js`; corrigidos combate não-autoritário (`battleNonce`), sandbox aberto a `PLAYER`, RBAC fail-closed (`NONE`) + permissões de `hunter-costs` e `dungeon-chests`, IDOR em chat/presença, race condition em `distribute-stats`, `toggle-reborn`, Stored XSS e hardening HTTP. Todos os arquivos < 1.000 linhas (Regra #7).
* **Repositório Oficial:** `https://github.com/SeytaniR/etheria-campus`
* **Fonte Bruta de Assets:** `https://github.com/SeytaniR/mcrework` (`https://seytanir.github.io/mcrework/`)

---

## ✅ Decisões Consolidadas na Documentação (`v0.1.2` a `v0.4.2`)
1. **Regra de Escopo Estrito (Cláusula 0.1):** Proibido criar simuladores, mocks ou código não solicitado; dúvidas devem ser perguntadas antes de codificar.
2. **Regra da Curadoria (Whitelist):** O repositório `mcrework` é apenas galeria bruta; só entra no jogo o que estiver salvo nas tabelas do nosso banco de dados.
3. **5 Tipos de Mapa (Com Dominação, Spawn e PvP fixos no Tipo):**
   * `CITY` e `VILLAGE`: Dominadas por **Alianças**, sem spawn de monstros, PvP apenas por **Duelo Aceito**.
   * `SUBURB`: Dominado por **Facções**, spawna monstros, PvP apenas por **Duelo Aceito**.
   * `HOSTILE_ZONE`: Dominada por **Facções**, spawna monstros, permite **PvP Forçado (PK)** (quem força vira **Criminoso**).
   * `CONFLICT_ZONE`: Dominada por **Facções**, spawna monstros, **PvP Totalmente Aberto**.
4. **40 Biomas:** Função 100% dedicada ao vínculo procedural de spawn **`Mapa <-> Bioma <-> Monstro`** (zero relação com elementos ou cálculo de dano).
5. **5 Elementos Vinculados à Entidade (Sem Luz/Escuridão):**
   * Ciclo Ativo (`±25%`): `FIRE > EARTH > AIR > WATER > FIRE`.
   * `NEUTRAL` (Neutro): Penalidade de `-25%` de dano causado e `+25%` de dano sofrido contra tudo.
   * Monstros têm elemento fixo na tabela; Personagens e Pets sorteiam elemento inicial (`10%` Neutro, `20%` para cada elemento ativo), alterável no futuro via item.
6. **11 Raças (`+10%` de Vantagem):**
   * `HUMAN` tem `+10%` sobre todas as raças.
   * Ciclo das 10 raças (`+10%`): `PLANT > DRAGON > REPTILIAN > AQUATIC > ROBOTIC > CELESTIAL > DEMON > FAIRY > SPIRIT > BEAST > PLANT`.
7. **Atributos, Habilidades e Combate 5B (10x10 Slots):**
   * 6 Atributos Base (`VIT`, `STR`, `INT`, `WIS`, `AGI`, `DEX`) $\rightarrow$ Atributos de Combate.
   * Mitigação proporcional por nível: $\text{Defesa} / (\text{Defesa} + 100 + 10 \times \text{Nível})$.
   * 7 Blocos Universais de Efeito + Gatilhos para Passivas/Buffs/Debuffs.
   * Arena 10x10 Slots (Solo/Dupla = `1 Char + até 3 Pets`; 3 a 5 Jogadores = `1 Char + 1 Pet`).
8. **Sem God Objects & Limite Mandatório de 1.000 Linhas por Arquivo (Regra #7):**
   * Código estritamente modularizado por responsabilidade única.
   * Frontend de `/play` e `/admin` dividido em submódulos especializados (`ClientPolygonMesh`, `McreworkSpriteSheet`, `PlayGmController`, `AdminAuth`, `AdminUsersTab`, `AdminNpcsTab`, `AdminClassesTab`, `AdminCanvasEditor`).
   * Escala dos modelos 2.5D padronizada em 70% (`scale = 0.70`).
9. **Proibição Absoluta de Alteração de Dados no Banco sem Autorização (Cláusula 0.2):**
   * Terminantemente proibido alterar, renomear, limpar ou sobrescrever registros ou configurações nas tabelas do banco de dados (ex: alterar nome de mapas, polígonos, posições de NPCs, etc.) sem autorização prévia e expressa do usuário.
   * Scripts de teste, protótipos e verificações automatizadas NUNCA devem efetuar mutações em dados reais.
10. **Protocolo Rígido de Trabalho em Equipe entre IAs (Regra #8):**
   * **Entrada Obrigatória:** Toda IA deve executar `git pull origin main` antes de iniciar qualquer alteração.
   * **Não-Regressão e Aditividade:** Proibido reescrever, simplificar ou desmanchar regras, tabelas ou telas feitas por outra IA. O desenvolvimento é cumulativo.
   * **Dados Sagrados:** Dados criados no banco e no snapshot pertencem ao projeto e nunca devem ser apagados.
   * **Saída Obrigatória:** Testar compilação (`npm run build:packages && npm --workspace=@etheria/server run build`), atualizar `CHANGELOG.md` e `docs/HANDOFF.md`, e dar `git commit` + `git push origin main`.
11. **Ambiente de Produção 24/7 na VPS Azure (`40-65-63-193.sslip.io`):**
   * Servidor oficial rodando permanentemente na nuvem Azure (Standard B2pts_v2 ARM64, Ubuntu 24.04).
   * Caddy Web Server com SSL Let's Encrypt automático em `https://40-65-63-193.sslip.io` e HTTP em `http://40.65.63.193`.
   * Serviço gerenciado pelo systemd: `systemctl status etheria-campus`.
   * PostgreSQL 16 local na porta 5432 gerenciando os dados persistentes com snapshots sincronizados no Git.
12. **Git + VPS 100% Atualizada + Segurança por Backups (`AGENTS.md` Regra #9):**
   * Sempre versionar no Git (`commit` + `push`) e atualizar imediatamente a VPS (`git pull`, `prisma db push` se houver mudança de schema, `build` e `systemctl restart etheria-campus`), preservando backup preventivo do snapshot/banco para rollback.
13. **Arquitetura Sagrada de Assets — Independência Total Pós-Salvamento (`AGENTS.md` Regra #10 Reforçada):**
    * O repositório `mcrework` é consultado **exclusivamente** no `/admin` para descoberta/listagem de **assets novos** ainda não salvos.
    * Ao salvar qualquer entidade no banco (Mapas, Classes, NPCs, Monstros, Pets, Montarias, Asas, Equipamentos, Itens, Lojas, Baús, Skills, Status/VFX, Ícones), o servidor baixa e instala imediatamente os arquivos no diretório local do projeto (`apps/server/cache/mcrework/`).
    * Nenhuma entidade já salva pode apontar para `github.io`, `githubusercontent.com` ou domínios externos em **nenhuma rota** (`/admin`, `/gm`, `/play` ou backend) — tudo já salvo é servido exclusivamente por `/api/assets/mcrework/*` e `/api/assets/map-image/:id`. Caso o `mcrework` seja deletado um dia, apenas assets novos deixarão de aparecer nas galerias do `/admin`, mantendo 100% do jogo e dos registros salvos intactos.

14. **Uso Estrito do Navegador em Segundo Plano / Modo Oculto (Headless / Zero Pop-up):**
    * Sempre que qualquer IA ou ferramenta utilizar o navegador (Chrome DevTools MCP, Puppeteer, Playwright ou subagentes), deve operar obrigatoriamente de forma oculta/em segundo plano (`headless: true`, abas abertas em `background: true`).
    * Proibido abrir janelas visíveis ou abas que saltem na tela do usuário sem solicitação explícita.

15. **Padrões e Diretrizes de Alta Performance (60+ FPS Estáveis - `docs/PERFORMANCE_STANDARDS.md`):**
    * Proibição estrita de `ctx.shadowBlur` e `ctx.filter` em loops de renderização contínuos do Canvas 2D.
    * Partículas e esporos desenhados com texturas 32x32px pré-renderizadas em Canvas Offscreen (`ctx.drawImage`) com custo computacional desprezível.
    * Overlays fullscreen (vinhetas sombrias) delegados ao compositor GPU nativo do Android via HTML/CSS (`#veilVignetteOverlay`).
    * Trava de 60 FPS no `gameLoop` (`if (elapsed < 15.5) return;`) para evitar consumo desnecessário de bateria e throttling térmico em telas 90Hz/120Hz (como no Xiaomi Redmi Note 14 Pro).
    * Alocação zero (Zero-Alloc) na ordenação de profundidade 2.5D com reciclagem estática de objetos (`_renderPool`), evitando micro-travamentos de Garbage Collection.
    * Cache geométrico de gradientes radiais na arena de combate.

16. **Guarda de Contexto do Chat (Regra #12):**
    * Sempre que o usuário pedir algo que não tenha relação com este chat/projeto, a IA deve parar imediatamente o processamento e avisar: *"vc tem certeza que etá no chat correto?"*.

---

## 📋 Plano Mestre de Correção & Progresso das 4 Ondas (P0 → P3)

### 🔴 Onda P0 — Segurança Crítica & Proteção de Produção (✅ CONCLUÍDA em `v0.61.0`)
* **Backups Preventivos Pré-P0:**
  * Local: `.backups/pre-p0-20261124-141915/` (`lowcode.snapshot.json` + `git-head.txt`)
  * VPS Azure: `/home/azureuser/backups/pre-p0-20261124-141915/` (`lowcode.snapshot.json` 4.8M + `etheria_db.sql.gz` 345K)
* **Entregas Verificadas:** Remoção de credenciais SSH expostas + migração para chave `~/.ssh/id_ed25519` + `scripts/deploy_vps.py` seguro (Regra #9.2/#9.3); trava de combate autoritário (`battleNonce` + `CombatAntiCheatService`) e extração de `PlayCombatRouter`; bloqueio `/temporary-combat/*` só `GM`/`ADMIN`/`DEV`; rate limiter em login/chat; `distribute-stats` atômico via `$transaction`; `toggle-reborn` restrito a `GM`/`ADMIN`/`DEV`; correção de IDOR em chat/presença; RBAC fail-closed (`NONE`) + proteção de `hunter-costs` e `dungeon-chests`; Stored XSS (`escapeHtml` + `InputSanitizer`); hardening HTTP (headers, limite JSON 1 MB padrão / 15 MB mapas, path traversal com `path.sep`, remoção de CORS `*` wildcard). Testes `test_p0_security.mjs` e `test_action_motion_engine.mjs` aprovados 100%.

### 🟠 Onda P1 — Independência Total Pós-Salvamento `mcrework`, Bugs & Performance (PRÓXIMA DA FILA — Iniciar com Backup Preventivo)
* **Regra #10 Reforçada (Independência Total Pós-Salvamento em `/admin`, `/gm`, `/play` e Backend):**
  * Eliminar todos os ponteiros residuais para `seytanir.github.io/mcrework` e `https://mcrework.com` em entidades salvas retornadas por `AdminMapsController`, `AdminMonstersController`, `AdminEquipmentsController`, `AdminItemsController`, `AdminSkillsController`, `AdminShopsController`, `play.js` (L227), `PortalTravelController.js` (L323), `GamePlayController.ts` (L236) e `TemporaryCombatController.ts` (L586), roteando 100% para `/api/assets/mcrework/*`. Garantir espelhamento automático de registros já salvos no disco local (`apps/server/cache/mcrework/`), deixando o GitHub `mcrework` estritamente para descoberta de assets novos no `/admin`.
* **Bugs & Persistência:** `SnapshotManager` atômico (`temp` + `rename`) com mutex/debounce + `Promise.all` + inclusão de `dungeonChestConfigs` e `dungeon_runs`; TTL/eviction em `MapPresenceService.metadataCache`.
* **Performance Backend/Banco:** Cache de `MapPolygonMesh` + dimensões + metadados de mapa + dirty-flush em `syncPosition`; `@@index` aditivos em `schema.prisma`; `ETag` + `gzip` para estáticos.
* **Performance Canvas 2D (`PERFORMANCE_STANDARDS.md`):** Zerar `ctx.shadowBlur` em `ActionVfxRenderer.js` (L302, L340, L364, L402, L414) e `BattleTransitionController.js` (L534, L680, L724); cachear/pré-renderizar `createRadialGradient` de `ActionVfxRenderer.js` (L544), `PlayDungeonChestController.js` (L169) e `PlayHudController.js` (L885).

### 🟡 Onda P2 — Modularização Real (`< 650` linhas), Limpeza de Código Morto & Testes
* Fatiar módulos no teto da Regra #7 (`PlayGmController.js`, `play.js`, `GamePlayController.ts`, `AdminMapsController.ts`, `admin.js`, `play/index.html`, `ActionCombatArena.js`, `AdminQuestsTab.js`).
* Mover regras compartilhadas para `@etheria/shared`; remover `web/index.html`, `scratch/`, constantes legadas mortas em `MonsterCombatBuilder.ts` e avaliar migração de modelos/colunas legados (`ArenaFormation`, `MonsterRarity`, `apCost`, `cooldownTurns`) mediante autorização.
* Expandir suíte de testes automatizados (`npm test`).

### 🔵 Onda P3 — Conformidade 100% `i18n` (Regra #4) & Documentação Atualizada
* Implementar motor `i18n` unificado (`pt-BR`, `en-US`, `es-ES`) no `/play`, `/admin` e API (eliminando os 137 `'pt-BR'` hardcoded no backend), além de normalização `'en'` → `'en-US'` e preenchimento `'es-ES'` no banco mediante autorização explícita (Cláusula 0.2).
* Atualizar `README.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE_SCHEMA.md`, `AGENTS.md` e cabeçalhos JSDoc faltantes da Regra #1.

---

## 🎯 Próxima Tarefa Exata da Fila
* Realizar **backup preventivo pré-P1** (local + VPS) e executar a **Onda P1**, priorizando a **Independência Total Pós-Salvamento `mcrework`** em `/admin`, `/gm`, `/play` e backend (Regra #10 reforçada), seguida das correções de `SnapshotManager`, otimizações Backend/Banco e remoção de `ctx.shadowBlur` / gradientes por frame.
