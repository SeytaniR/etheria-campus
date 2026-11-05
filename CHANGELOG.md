# 📦 CHANGELOG — Etheria Campus

Todas as alterações notáveis deste projeto são documentadas neste arquivo seguindo **Semantic Versioning (`vMAJOR.MINOR.PATCH`)**.
Qualquer IA trabalhando neste repositório **DEVE** incrementar a versão e registrar suas entregas aqui antes de encerrar o turno.

---

## [v0.3.0] - 2026-11-05
### Adicionado
* **Proteção Dual-Mode da Rota `/admin` (`apps/server/src/security/AdminAuthService.ts`):**
  * Autenticação via variáveis do `.env` (`ADMIN_LOCAL_USERNAME` e `ADMIN_LOCAL_PASSWORD`) permitida **exclusivamente** quando a requisição parte diretamente do `localhost` (loopback `127.0.0.1` / `::1`, sem cabeçalhos de proxy/túnel e `Host` local).
  * Bloqueio automático da senha do `.env` em acessos externos (LAN, Celular, Túnel, VPS), exigindo conta cadastrada no CRUD do PostgreSQL com cargo `ADMIN` e verificação criptográfica `scrypt` + `timingSafeEqual`.
* **CRUD de Contas de Usuários e Permissões (`apps/server/src/controllers/AdminUsersController.ts`):**
  * Criação, edição de cargo (`ADMIN`, `GM`, `PLAYER`), troca de senha e exclusão de contas no banco PostgreSQL através da aba **"🔐 Contas & Acesso Admin"** na rota `/admin`.
* **Editor Visual de Mapas na Rota `/admin` (`apps/server/src/controllers/AdminMapsController.ts` & `apps/server/public/admin/`):**
  * Importação exclusiva da imagem limpa dos 76 mapas do `mcrework` (ignorando malhas/colisões antigas).
  * Ferramenta de desenho de **Polígonos Estilo Google Earth** (fechamento automático da área conforme pontilha os vértices, arraste de vértices e remoção com clique direito) para **Áreas de Colisão (`collision_mesh_json`)** e **Áreas de Sobreposição/Opacidade (`overlap_mesh_json`)**.
  * Posicionamento visual de **Pontos de Teleporte (`map_portals`)** e **NPCs (`map_npcs`)** com seletor dos 365 visuais de NPCs do `mcrework`.
  * Seleção dos 40 Biomas (primário e secundário), 5 Tipos de Mapa e Nível de Acesso, com gravação direta no PostgreSQL e exportação automática de Snapshot JSON.
* **Classe Geométrica Compartilhada `MapPolygonMesh` (`packages/shared/src/MapPolygonMesh.ts`):**
  * Algoritmo *Ray-Casting Point-in-Polygon* com pré-filtro *Bounding Box* para validação de colisão e sobreposição.

---

## [v0.2.1] - 2026-11-05
### Alterado
* **Especificação do Editor de Colisão e Sobreposição (`docs/ARCHITECTURE.md` e `docs/DATABASE_SCHEMA.md`):** Definido o padrão de desenho por **Polígonos Estilo Google Earth** (fechamento automático da área conforme o usuário pontilha os vértices) para `collision_mesh_json` e `overlap_mesh_json`.

---

## [v0.2.0] - 2026-11-05
### Adicionado
* **Pacote `@etheria/database` & Schema Oficial PostgreSQL (`packages/database/prisma/schema.prisma`):**
  * Criação completa das 22 tabelas relacionais do jogo em PostgreSQL.
  * Inclusão dos campos de edição manual de mapas (`collision_mesh_json`, `overlap_mesh_json`, `overlap_opacity`), descartando os arquivos `collision.bin` originais do `mcrework` e importando apenas a imagem base do mapa.
  * Inclusão do 16º slot de equipamento do Personagem (`BELT` - Cinto) na tabela `equipment_slots` (totalizando 16 slots de Personagem + 6 slots de Pet).
  * Criação das sementes oficiais (`packages/database/src/seedData.ts` e `packages/database/src/seed.ts`) com os 40 Biomas, 5 Tipos de Mapa, 5 Elementos + Matriz 5x5, 11 Raças + Matriz 11x11, 6 Atributos Base, 16 Atributos de Combate + Conversões, 22 Slots de Equipamento e 6 Raridades.
  * Criação da classe Orientada a Objetos `SnapshotManager` (`packages/database/src/SnapshotManager.ts`) para espelhamento automático das tabelas Low-Code em JSON versionado no Git.
* **Infraestrutura Docker PostgreSQL & Redis (`docker-compose.yml` & `.env.example`):**
  * Configurado PostgreSQL 16 + Redis 7 com paridade total entre Ubuntu WSL local e VPS Ubuntu de produção.

---

## [v0.1.2] - 2026-11-05
### Adicionado
* **Catálogo Oficial dos 40 Biomas (`docs/DATABASE_SCHEMA.md`):** Nomes e descrições detalhadas dos 40 biomas dedicados exclusivamente ao vínculo procedural de spawn `Mapa <-> Bioma <-> Monstro`.
* **Sistema de 5 Elementos na Entidade (`docs/ARCHITECTURE.md` e `docs/DATABASE_SCHEMA.md`):**
  * Ciclo `FIRE > EARTH > AIR > WATER > FIRE` (`±25%`) e `NEUTRAL` penalizado (`-25%` dano causado / `+25%` dano recebido).
  * Regra de sorteio inicial para Personagens e Pets (`10%` Neutro, `20%` para cada elemento ativo) e elemento fixo para Monstros.
* **Sistema das 11 Raças (`+10%` de Vantagem):**
  * `HUMAN` com `+10%` sobre todas as raças e ciclo fechado de 10 raças (`PLANT > DRAGON > REPTILIAN > AQUATIC > ROBOTIC > CELESTIAL > DEMON > FAIRY > SPIRIT > BEAST > PLANT`).
* **Regras de Dominação Territorial e PvP nos 5 Tipos de Mapa:**
  * `CITY` e `VILLAGE` (Alianças, sem monstros, duelo aceito), `SUBURB` (Facções, monstros, duelo aceito), `HOSTILE_ZONE` (Facções, monstros, PK forçado gera status Criminoso) e `CONFLICT_ZONE` (Facções, monstros, PvP aberto).
* **Arquitetura de 6 Atributos Base, Fórmula Universal de Mitigação e 7 Blocos de Efeito para Skills/Passivas/Buffs.**

### Removido
* Descartadas ideias antigas de elementos Luz/Escuridão, vínculo de biomas no cálculo de dano e arenas de 6 slots em toda a documentação.

---

## [v0.1.1] - 2026-11-05
### Adicionado
* **Cláusula 0.1 em `AGENTS.md` e `.gemini/rules/AGENTS.md` (Proibição de Código Não Solicitado / Escopo Estrito):**
  * Proibição estrita de criar simuladores, páginas de demonstração, testes improvisados ou código não solicitado pelo usuário.
  * Obrigatoriedade de perguntar ao usuário antes de codificar sempre que um pedido for vago ou faltar definições, evitando retrabalho e sujeira no repositório.

### Removido
* Removido o simulador não solicitado de `web/index.html`, mantendo apenas o ponto de entrada mínimo limpo.

---

## [v0.1.0] - 2026-11-05
### Adicionado
* **Constituição Rígida de IA (`AGENTS.md` e `.gemini/rules/AGENTS.md`):**
  * **Cláusula 0 (Regra Anti-Vibe-Coder):** Dever obrigatório de veto/questionamento técnico em casos de risco à Segurança (Servidor Autoritário), Performance, Orientação a Objetos, Motor Procedural ou Coerência Lógica.
  * **Regra da Curadoria (Whitelist no Banco):** Definição do repositório `mcrework` exclusivamente como galeria bruta de assets; somente registros salvos no banco de dados entram no jogo.
  * **Padrão de Comentários para Contexto de IA:** Exigência de cabeçalhos estruturados e TSDoc em todos os arquivos de código.
  * **Protocolo de Revezamento Multi-Conta (`docs/HANDOFF.md`):** Sistema de passagem de bastão entre turnos de IAs.
* **Arquitetura Oficial & Regras de Combate (`docs/ARCHITECTURE.md`):**
  * Definição dos 6 módulos Orientados a Objetos (`@etheria/asset-bridge`, `@etheria/shared`, `@etheria/database`, `@etheria/server`, `@etheria/client`, Rotas `/admin` e `/gm`).
  * Especificação da **Arena Tática 10x10 Slots** (5 Vanguarda + 5 Retaguarda de cada lado) para caçadas em massa e PvP 5v5.
  * Especificação da **Regra Escalonada de Pets:** Solo/Dupla permite `1 Personagem + até 3 Pets` por jogador; Grupos de 3 a 5 jogadores permitem `1 Personagem + 1 Pet` por jogador (sem vantagem de classe), com formação definida pelo Capitão/Solo.
  * Especificação do **Combate Modo 5B:** Pontos de Turno (AP) + Posições Pré-Definidas com Alcance + Planejamento Simultâneo ("We-Go").
  * Estratégia de testes Mobile anti-CGNAT (GitHub Pages + Rede Local Wi-Fi + Cloudflare Tunnel).
* **Modelagem do Banco de Dados Procedural & Low-Code (`docs/DATABASE_SCHEMA.md`):**
  * Especificação das tabelas de Mapas (progressão de nível de 10 em 10, Duplo Bioma, 6 Tipos de Mapa), Monstros (Raridades, Biomas, Escalonamento), Atributos Base $\rightarrow$ Matriz de Conversão $\rightarrow$ Atributos de Combate, Skills, Equipamentos e Traduções `i18n`.
* **Infraestrutura GitHub Pages (`.github/workflows/pages.yml` & `web/index.html`):**
  * Deploy contínuo configurado para testes mobile em `https://seytanir.github.io/etheria-campus/` com painel de diagnóstico de conexão ao servidor.
