# 🤝 Diário de Passagem de Turno entre IAs (`HANDOFF.md`)

> **INSTRUÇÃO OBRIGATÓRIA PARA A IA QUE ESTÁ ASSUMINDO O TURNO:**
> 1. Leia `AGENTS.md` e `CHANGELOG.md` antes de qualquer ação.
> 2. Confira abaixo o **Estado Atual** e a **Próxima Tarefa Exata da Fila**.
> 3. Antes de encerrar seu turno, atualize este arquivo, incremente a versão no `CHANGELOG.md` e faça `git commit` + `git push`.

---

## 📌 Status Atual do Projeto
* **Versão Atual:** `v0.19.0`
* **Última Atualização:** `2026-11-13`
* **Fase Atual:** **Revisão da Tabela de Equipamentos e Armas: Atributos Exclusivos de Combate, Remoção de Ouro & Layout Adaptativo (`v0.19.0`)** — Equipamentos e armas agora concedem exclusivamente bônus diretos de combate na arena action (sem bônus de atributos base); remoção do campo de preço em ouro; layout adaptativo com visão desktop em tabela e mobile vertical em cards touch-friendly (`min-height: 42px`); modal desacoplado em `AdminEquipmentModalDom.js`.** — Atributos base de combate (velocidade de movimento em batalha, velocidade de ataque, taxa e dano crítico, precisão física/mágica e esquiva física/mágica) adicionados ao `MonsterTemplate` no Prisma PostgreSQL, persistência em snapshot e controle dinâmico em `MonsterCombatBuilder.ts`. Interface totalmente adaptativa com visão em tabela completa no Desktop e visão em cards touch-friendly no Mobile Vertical portrait (`min-height: 42px`), com filtros por nome, rank e elemento. Arquitetura modular mantida abaixo de 1.000 linhas via `AdminMonsterModalDom.js`.** — Excluídos todos os pontos e linhas legados em ambos os continentes (banco e snapshot); criado sistema interativo completo de criação de pontos (`ADD_POINT`), arrasto/reposicionamento (`SELECT`), traçado de rotas/ligações (`CONNECT`), exclusão pontual (`DELETE`) e limpeza global; vínculo de qualquer ponto a mapas existentes da Tabela de Mapas com rótulo customizado; layout responsivo adaptado para mobile vertical com zoom/pan e botões touch-friendly; arquitetura modular dividida entre `AdminWorldMapsDom.js` e `AdminWorldMapsTab.js` (ambos sob o limite de 1.000 linhas).
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
13. **Arquitetura Sagrada de Assets: Isolamento Estrito Client-Servidor & Espelhamento Automático no Salvar (`v0.15.0`):**
    * O repositório de assets no GitHub serve exclusivamente para alimentar as galerias e previews visuais da rota `/admin` durante criação e edição.
    * No momento em que o admin salva qualquer registro no banco (Mapas, Personagens/Classes, NPCs, Monstros, Pets, Montarias, Equipamentos, Itens, Habilidades, Buffs/Debuffs), o servidor imediatamente baixa e instala todos os assets referenciados em disco local permanente (`apps/server/cache/mcrework/`).
    * O cliente do jogo (`/play`) comunica-se estrita e exclusivamente com o servidor do jogo (`/api/assets/*`, `/api/play/*`), nunca fazendo requisições ao GitHub.
    * A rota `/admin` comunica-se com o servidor do jogo para persistência e regras, e com o GitHub apenas para exibir galerias disponíveis para escolha.

---

## ⚠️ Pendências Documentadas & Base Incompleta (Economia/Inventário)
* **Carteira (`player_characters.gold`) e Mochila (`character_inventory_items`) criadas na `v0.9.0` são INCOMPLETAS por decisão explícita:** suportam acúmulo/consumo em Quests Meta (`COLLECT_ITEM`), recompensas de ouro/itens e drop provisório vinculado à missão. Ao implementar o módulo completo de **Inventário, Loja, Equipamentos nos 16 Slots e Drops Globais**, estenda essas tabelas existentes sem resetar dados.
* **Status do Deploy `v0.9.0` na VPS:** `prisma db push`, compilação e reinício do `etheria-campus.service` **já aplicados e validados** em `40.65.63.193` (`HTTP 200` em `/admin` e `/play`).

## 🎯 Próxima Tarefa Exata da Fila
* **Servidor 24/7 em Produção:** Ativo e acessível publicamente via `https://40-65-63-193.sslip.io/admin` e `https://40-65-63-193.sslip.io/play`.
* **Próximos passos de desenvolvimento:** Expandir sistema completo de Economia, Drops Globais, Inventário completo e uso de itens conforme direcionamento do usuário.
