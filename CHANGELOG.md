# 📦 CHANGELOG — Etheria Campus

Todas as alterações notáveis deste projeto são documentadas neste arquivo seguindo **Semantic Versioning (`vMAJOR.MINOR.PATCH`)**.
Qualquer IA trabalhando neste repositório **DEVE** incrementar a versão e registrar suas entregas aqui antes de encerrar o turno.

---

## [v0.4.4] - 2026-11-06
### Adicionado
* **Proxy Reverso de Cenários no Servidor (`apps/server/src/index.ts`):**
  * Implementado endpoint de alta performance `GET /api/assets/map-image/:id` (com suporte a `HEAD`), permitindo que clientes web e mobile carreguem as imagens dos mapas diretamente via **same-origin** multiplexado sobre o túnel Cloudflare (`trycloudflare.com`), sem dependência de DNS externo ou conexões diretas a CDNs externas em redes celulares.
  * Adicionado cache de buffers em memória RAM (`mapImageCache`) com cabeçalhos HTTP estendidos (`Cache-Control: public, max-age=604800, stale-while-revalidate=86400`) e suporte instantâneo a sub-milissegundos.

### Corrigido
* **Resolução do Bloqueio de Carregamento do Mapa em Dispositivos Móveis (`play.js` & `admin.js`):**
  * Removido o atributo `img.crossOrigin = 'anonymous'` que estava disparando falhas de CORS (`Access-Control-Allow-Origin`) e bloqueios de cache no Chrome Android ao transitar por túneis e proxies móveis.
  * O Canvas 2D (`ctx.drawImage`) renderiza nativamente imagens externas sem necessidade de modo CORS.
  * Implementada cadeia resiliente de carregamento (`loadMapBackground`): tenta primariamente o proxy local da mesma origem e, em caso de erro, comuta transparentemente para o GitHub Pages direto (e vice-versa), garantindo que o mapa nunca fique travado em tela escura.
* **Feedback Visual Tátil de Carregamento (`apps/server/public/play/play.js`):**
  * Substituído o fundo escuro vazio por uma grade isométrica sutil (`step = 64px`) com indicador visual centralizado (`🗺️ Carregando imagem do mapa...`), fornecendo feedback de posicionamento espacial 2.5D imediato enquanto o cenário é decodificado.

---

## [v0.4.3] - 2026-11-06
### Alterado
* **Servidor Autoritário: Redução de 20% na Velocidade Base de Movimentação (`GamePlayController.ts` & `play.js`):**
  * Reduzida a velocidade base de movimento de 210 px/s para **168 px/s** (`baseMoveSpeed: 168`), proporcionando ritmo de exploração cadenciado e proporcional à nova escala corporal de 70%.
  * Implementada validação autoritária de velocidade máxima com tolerância anti-jitter no endpoint `/api/play/characters/:id/sync-position`, limitando fisicamente posições enviadas que ultrapassem a velocidade autorizada (`speedClamped: true`).
* **Recorte Anatômico de Sobreposição 2.5D (`apps/server/public/play/js/McreworkSpriteSheet.js` & `ClientPolygonMesh.js`):**
  * Implementado o algoritmo de recorte com máscara geométrica via Canvas 2D (`renderSpriteWithOverlapClipping`):
    1. **Região Fora da Cobertura:** Desenhada com `ctx.clip('evenodd')` subtraindo os polígonos de sobreposição da área do sprite com `globalAlpha = 1.0` (cabeça e membros expostos permanecem 100% nítidos e opacos).
    2. **Região Sob a Cobertura:** Desenhada com `ctx.clip()` restrito aos polígonos de telhado/árvore com `globalAlpha = overlapAlpha`, aplicando a transparência estritamente na parte do corpo oculta.
  * Adicionado método `getIntersectingOverlapPolygons` com pre-culling AABB para filtragem ultra-rápida no loop de 60 FPS.

---

## [v0.4.2] - 2026-11-06
### Alterado
* **Redução de 30% no Tamanho dos Modelos 2.5D (`scale = 0.70`) (`apps/server/public/play/js/McreworkSpriteSheet.js` & `play.js`):**
  * Calibrada a escala visual de renderização de todos os modelos de personagens e NPCs para `70%` do tamanho original (`scale = 0.70`), garantindo proporções anatômicas realistas e harmônicas com as construções, portas, caminhos e elementos dos mapas do jogo.
  * Sombra elíptica projetada aos pés dos modelos reescalada proporcionalmente (`13 x 6 px`).
  * Altura dos textos flutuantes de identificação sobre a cabeça das entidades rebaixada em sintonia com a nova escala (`-66px` para o jogador, `-62px` para NPCs).
* **Refatoração Completa Frontend — Princípio da Responsabilidade Única (SRP) e Zero God Objects:**
  * **Eliminação de God Objects no Cliente de Jogo (`/play`):**
    * Decomposto o antigo `play.js` (1.047 linhas) em 4 submódulos independentes e focados:
      1. `apps/server/public/play/js/ClientPolygonMesh.js` (85 linhas): Malha poligonal de colisão e sobreposição 2.5D com Pre-Culling AABB + Ray-Casting.
      2. `apps/server/public/play/js/McreworkSpriteSheet.js` (145 linhas): Motor de animação 8-direções e desenho com escala calibrada `scale = 0.70`.
      3. `apps/server/public/play/js/PlayGmController.js` (175 linhas): Painel GM integrado (teleporte, raio-x, no-clip, velocidade, hot-reload) e Ficha Procedural.
      4. `apps/server/public/play/play.js` (757 linhas): Orquestrador do loop 60 FPS, física, Y-sorting e sincronização autoritária com o servidor.
  * **Eliminação de God Objects no Studio Low-Code (`/admin`):**
    * Decomposto o antigo `admin.js` (1.843 linhas) em 6 submódulos especializados:
      1. `apps/server/public/admin/js/AdminAuth.js` (125 linhas): Autenticação Dual-Mode e gerenciamento de sessão segura.
      2. `apps/server/public/admin/js/AdminUsersTab.js` (85 linhas): CRUD completo de contas de usuários (`ADMIN`, `GM`, `PLAYER`).
      3. `apps/server/public/admin/js/AdminNpcsTab.js` (200 linhas): Catálogo dos 365 NPCs do mcrework com busca em tempo real e tabela de posicionamento.
      4. `apps/server/public/admin/js/AdminClassesTab.js` (280 linhas): Hero Preview 72px, galeria de classes com filtro de gênero e configuração de atributos procedurais.
      5. `apps/server/public/admin/js/AdminCanvasEditor.js` (905 linhas): Câmera, estúdio visual tela cheia, desenho de malhas, histórico real Undo/Redo e gaveta de camadas.
      6. `apps/server/public/admin/admin.js` (440 linhas): Ficha técnica de mapas, biomas, spawn e orquestrador principal da aplicação.
* **Servidor HTTP com Suporte a Arquivos Estáticos Modulares (`apps/server/src/index.ts`):**
  * Implementado `tryServeStatic` com sanitização contra path traversal e tabela completa de MIME Types (`.js`, `.html`, `.css`, `.json`, `.webp`, `.png`, etc.), servindo modularmente qualquer submódulo de `public/`.

### Adicionado
* **Nova Regra Mandatória de Engenharia #7: Sem God Objects e Limite Máximo de 1.000 Linhas por Arquivo (`AGENTS.md`, `docs/ARCHITECTURE.md`):**
  * Formalizada como regra mandatória de projeto a proibição de God Objects e a imposição estrita de que nenhum arquivo do repositório pode exceder **1.000 linhas de código**.
  * Verificado via scanner de código: **100% dos arquivos do repositório possuem <= 1.000 linhas de código**.

---

## [v0.4.1] - 2026-11-06
### Corrigido
* **Carregamento da Imagem de Fundo dos Mapas no `/play` (`apps/server/src/controllers/GamePlayController.ts` & `apps/server/public/play/play.js`):**
  * Corrigida a resolução da URL da imagem base do mapa (`bgImageUrl`), que estava concatenando a base do GitHub Pages em cima de URLs já completas gravadas no banco (`https://seytanir.github.io/mcrework/...`), gerando URLs duplicadas e erro HTTP 404.
  * O servidor e o cliente agora tratam de forma resiliente tanto caminhos relativos quanto URLs completas, garantindo que o mapa carregue imediatamente.
* **Correção das Animações 8-Direções de Personagens e NPCs (`apps/server/public/play/play.js`):**
  * Corrigida a chave de animação no `atlas.json` do `mcrework`: o padrão oficial é **`${dir}-${action}`** (e não `${action}-${dir}`). A inversão anterior fazia com que o personagem tocasse animações de golpe/cast/morte ao andar ou ficar parado em certas direções.
  * Implementada a fórmula matemática oficial de 8 direções do `mcrework` (`calculateDirection8(dx, dy) = Math.round((90 - angle) / 45) % 8`), alinhando com perfeição o ângulo de movimento à direção do sprite (0 = Sul, 1 = Sudeste, 2 = Leste, 3 = Nordeste, 4 = Norte, 5 = Noroeste, 6 = Oeste, 7 = Sudoeste).
  * Calibrada a cadência de animação para 80ms por frame (~12.5 FPS), respeitando o timing de repetição dos frames do spritesheet original.
* **Layout Responsivo do HUD no `/play` em Smartphones (`apps/server/public/play/index.html`):**
  * Reestruturado o topo do jogo com a barra responsiva `.world-top-nav` para que em telas verticais de celular os botões de ação (`Atributos`, `Destravar`, `Painel GM`, etc.) fiquem organizados em linha rolável sem se sobrepor sobre o card de status do jogador.

### Adicionado
* **Novo Editor Visual de Personagens com Hero Preview, Busca e Filtros (`apps/server/public/admin/index.html` & `admin.js`):**
  * Adicionado Hero Preview em destaque no topo do modal (`#classHeroCard`) exibindo o sprite ampliado (72x72px), chave do modelo, gênero, tier e campos de edição rápida.
  * Adicionadas abas internas no modal (`[🎨 Visual do Personagem]` e `[📊 Atributos Iniciais & Crescimento]`), liberando mais de 50% de espaço vertical útil no celular para a escolha do visual.
  * Campo de busca instantânea por nome (`Guerreiro`, `Mago`, `Sacerdote`...) e botões de filtro por gênero (`Todos`, `👨 Masc`, `👩 Fem`).
  * Grade da galeria (`#mcreworkCharsGrid`) com rolagem suave touch (`-webkit-overflow-scrolling: touch`), cards com imagem nítida (`object-fit: contain; background: #020617`), sem cortes e com seleção destacada em dourado.
  * Adicionado também campo de busca instantânea no `#npcModal` para localização imediata entre os 365 visuais de NPCs do `mcrework`.

---

## [v0.4.0] - 2026-11-06
### Adicionado
* **Aba `🦸 Personagens` (`class_templates`) na Rota `/admin` com Auto-Incremento `class_1`, `class_2`... (`apps/server/src/controllers/AdminMapsController.ts` & `apps/server/public/admin/`):**
  * Integração com o catálogo oficial de 46 modelos de personagens jogáveis do `mcrework` (`assets/characters/catalog.json` com sprites animados em 8 direções).
  * Criação e edição de Classes/Personagens com `id` e chave `code` (`class_1`, `class_2`...) auto-incrementados automaticamente em sincronia, escolha de Raça (padrão `HUMAN`) e configuração dos 6 Atributos Base iniciais (`VIT`, `STR`, `INT`, `WIS`, `AGI`, `DEX`) e Crescimento por Nível.
* **Rota dos Jogadores (`/play`) e Motor de Exploração 2.5D (`apps/server/src/controllers/GamePlayController.ts` & `apps/server/public/play/`):**
  * Tela de Login e Lobby de Seleção/Criação de Personagens (`player_characters`), reutilizando automaticamente a sessão ativa se o usuário vier do `/admin`.
  * **Sorteio Elemental Inicial Oficial (`rollInitialElement`):** Sorteia `10%` `NEUTRAL` vs `20%` peso relativo para cada elemento ativo (`FIRE`, `EARTH`, `AIR`, `WATER`) ao criar o personagem, posicionando-o no Ponto de Spawn oficial (`spawnX, spawnY`) do Mapa #1.
  * **Renderizador 2.5D com Atlas de Sprites 8-Direções (`McreworkSpriteSheet`):** Carrega e anima em tempo real os arquivos `atlas.json` + `atlas.webp` do `mcrework` tanto para o Personagem do Jogador (`Idle` e `Walk` em 8 direções) quanto para os NPCs posicionados no mapa, com *Y-Sorting* de profundidade.
  * **Física Poligonal e Portais Pareados em Tempo Real:** Colisão contra `collisionMeshJson` com deslizamento suave pelas paredes, redução de opacidade do personagem ao passar sob áreas de `overlapMeshJson` (`overlapOpacity`), travessia de portais pareados (`Entrada <-> Saída`), Ficha de Atributos Procedurais (`📊 Atributos`) e botão **`🆘 Destravar (Spawn)`**.
* **Painel `/gm` Integrado (`⚡ Painel GM` dentro de `/play` e rota `/gm`):**
  * Exclusivo para contas `ADMIN` e `GM`: Teleporte instantâneo em 1 clique para qualquer mapa cadastrado no banco, **Modo Raio-X (`👁️`)** para inspecionar malhas de colisão/sobreposição/portais/spawn enquanto caminha pelo mapa, **Modo No-Clip (`👻 Atravessar Paredes`)**, multiplicador de velocidade GM (`1x`, `2x`, `3.5x`, `6x`) e botão de **Hot-Reload (`🔄`)** do mapa atual direto do PostgreSQL.
* **Atualização de Documentação e Regras (`AGENTS.md`, `.gemini/rules/AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE_SCHEMA.md`):**
  * Consolidada a Regra #6 de Auto-Incremento Padronizado (`map_N`, `npc_N`, `class_N`) e a arquitetura das rotas `/play` e `/gm`.

---

## [v0.3.7] - 2026-11-05
### Adicionado
* **Aba Dedicada `🧙 Tabela de NPCs` e Auto-Incremento `npc_1`, `npc_2`... (`apps/server/src/controllers/AdminMapsController.ts` & `apps/server/public/admin/`):**
  * Adicionada a aba **`🧙 Tabela de NPCs`** na barra principal da Rota `/admin`, exibindo todos os NPCs salvos no banco (`npc_templates`), sua miniatura visual do `mcrework`, função/gatilho (`Enfeite`, `Quest`, `Loja`, `Luta Boss/Treinador`, `Evento`, `Diálogo`) e **em quais mapas e coordenadas `(X, Y)` cada NPC está posicionado** (`map_npcs`).
  * Implementado auto-incremento automático de `id` e chave `code` (`npc_1`, `npc_2`, `npc_3`...) para NPCs, integrado diretamente com a ferramenta **`🧙 +NPC`** do Editor Visual de Mapas.

---

## [v0.3.6] - 2026-11-05
### Adicionado
* **Auto-Incremento Automático de ID e Chave do Mapa (`map_1`, `map_2`, `map_3`...):**
  * Em [`AdminMapsController.saveMap`](file:///C:/Users/Dani/.gemini/antigravity/scratch/etheria-campus/apps/server/src/controllers/AdminMapsController.ts#L230-L295) e na interface da Rota `/admin`, tanto o `id` quanto a chave `code` (`map_1`, `map_2`, `map_3`...) agora são gerados e auto-incrementados automaticamente em sincronia, exigindo que o usuário digite apenas o **Nome do Mapa**.
  * Padronizado o Mapa #2 (`Pantanal das Nuvens`) para `id = 2` e `code = 'map_2'`.
* **Pré-Compilação de Bounding Box (AABB) em `MapPolygonMesh` (`packages/shared/src/MapPolygonMesh.ts`):**
  * Os limites `minX, maxX, minY, maxY` de cada polígono agora são pré-calculados no construtor em memória, descartando malhas distantes em $O(1)$ com apenas 4 comparações de float.

---

## [v0.3.5] - 2026-11-05
### Corrigido
* **Correção Crítica do Botão `➕ Novo do mcrework` (`apps/server/public/admin/admin.js` & `index.html`):**
  * Separado explicitamente o modo `NEW_MAP` (botão `➕ Novo do mcrework`, que zera `currentMapId = null` e inicia um novo registro em branco sem jamais sobrescrever o mapa anterior) do modo `CHANGE_IMAGE` (botão `🖼️ Trocar Imagem`).
  * Adicionado indicador visual claro no cabeçalho da ficha (`🆕 CRIANDO NOVO MAPA` vs `✏️ Editando Mapa #ID: Nome`).
* **Recuperação Forense Completa via MVCC do PostgreSQL (`packages/database/snapshots/lowcode.snapshot.json`):**
  * Recuperado 100% do Mapa 1 (**`Vila Izumo`** — `map_1`, com suas 4 malhas de colisão, 13 malhas de sobreposição, Spawn `(167, 1231)` e 2 portais) diretamente das páginas de heap/TOAST do PostgreSQL, mantendo também 100% do Mapa 2 (**`Pantanal das Nuvens`** — `map_3`, com suas 7 malhas de colisão, 7 de sobreposição, Spawn `(1360, 1135)` e 2 portais).
* **Utilitário CLI `cliSnapshot.ts` (`packages/database/src/cliSnapshot.ts`):**
  * Adicionado script CLI para exportação direta do snapshot JSON (`npm run db:snapshot:export`).

---

## [v0.3.4] - 2026-11-05
### Adicionado
* **Modo Dedicado de Edição Visual de Mapas em Tela Inteira (`apps/server/public/admin/index.html` & `apps/server/public/admin/admin.js`):**
  * Removido o canvas espremido em miniatura da ficha; agora a Ficha Técnica do Mapa possui o botão **`🎯 ENTRAR NA EDIÇÃO VISUAL DO MAPA (TELA INTEIRA)`**.
  * Ao entrar na edição visual, toda a interface administrativa muda para o **Estúdio Visual em Tela Cheia (`100vw x 100dvh`)**, focado 100% no mapa e nas ferramentas visuais (`🖐️ Mover`, `⭐ Spawn`, `🛑 +Colisão`, `🟦 +Sobrep.`, `🌀 +Portal`, `🧙 +NPC`, `✏️ Editar Vértices`).
  * Adicionada **Gaveta Lateral Recolhível (`🗂️ Camadas`)** que só abre quando solicitada, mantendo 100% da área útil livre para o mapa tanto no Celular quanto no PC.
  * Adicionado suporte explícito para **Salvar Mapas Incompletos (`📝 Em Edição / Rascunho`) e Retomar Depois**, incluindo botão **`💾 Salvar Progresso`** direto na barra superior do Editor Visual sem perder a posição da câmera ou o zoom.

---

## [v0.3.3] - 2026-11-05
### Adicionado
* **Ponto de Spawn Padrão do Mapa (`spawn_x`, `spawn_y` em `maps`):**
  * Adicionados campos `spawnX` e `spawnY` no schema PostgreSQL (`packages/database/prisma/schema.prisma`), `AdminMapsController` e interface visual da Rota `/admin` (ferramenta **`⭐ Ponto Spawn`**).
  * Serve como coordenada oficial para nascimento de novatos no Mapa 1, uso de itens de teleporte direto sem passar por portais, renascimento após morte na Cidade/Vila mais próxima e função "Destravar Personagem".
* **Portais Sempre em Duplas Interligadas (`Entrada <-> Saída` em `map_portals`):**
  * Adicionados `label` e `linked_portal_id` em `map_portals`, permitindo cadastrar portais de saída já no Mapa 1 e vinculá-los em dupla bidirecional com o portal par do Mapa de Destino.
  * Ao vincular dois portais no `/admin`, o servidor sincroniza automaticamente `targetMapId`, `targetX` e `targetY` nos dois lados para que entrar em um portal obrigue o jogador a sair na posição exata do portal par do outro lado.
* **Trava de Malhas (`🔒`) e Modo Dedicado de Edição (`✏️ Editar/Arrastar Vértices`):**
  * Polígonos de colisão/sobreposição, Portais, NPCs e Spawn ficam **100% travados contra esbarrões** enquanto o usuário está nas ferramentas de criação (`+Colisão`, `+Sobreposição`, `+Portal`, `+NPC`, `⭐ Spawn`).
  * Criado o modo dedicado **`✏️ Editar/Arrastar Vértices`** (na barra superior e em cada polígono da lista lateral) para destravar e mover vértices existentes apenas quando desejado.
* **Histórico Completo de Estado (`↩️ Desfazer` e `↪️ Refazer`):**
  * Substituído o desfazer simples por uma pilha de snapshots completos (`undoStack` e `redoStack` de até 60 passos) que desfaz tanto criações quanto edições/arrastes acidentais de vértices.

---

## [v0.3.2] - 2026-11-05
### Adicionado
* **Suporte Completo a Mobile Touch, Pinça e Mira de Precisão no Editor de Mapas (`apps/server/public/admin/index.html` & `apps/server/public/admin/admin.js`):**
  * Eventos nativos `touchstart`, `touchmove` e `touchend` no Canvas de mapas.
  * **Pinça com 2 dedos (Pinch-to-Zoom + Pan Simultâneo):** Permite dar zoom e arrastar o mapa com dois dedos a qualquer momento, mesmo quando uma ferramenta de Polígono, Portal ou NPC está selecionada.
  * **Arraste com 1 dedo:** Move o mapa suavemente na ferramenta `🖐️ Mover/Zoom` ou arrasta vértices existentes de colisão/sobreposição, portais e NPCs com raio de captura ampliado para telas touch.
  * **Alvo Central de Precisão (`+`) e Botão `📍 Marcar no Alvo Central (+)`:** Mira fixa no centro da tela com coordenadas `X,Y` em tempo real que permite posicionar o mapa com zoom e cravar vértices, portais ou NPCs com precisão cirúrgica de 1 pixel (sem o dedo tampar a visão).
  * **Controles Flutuantes & Modo Tela Cheia:** Botões `🔍 ➕`, `🔍 ➖`, `🎯 Centro`, `↩️ Desfazer Ponto` e `⛶ Tela Cheia` para edição confortável no celular.

---

## [v0.3.1] - 2026-11-05
### Adicionado
* **Suporte a Acesso Remoto via Cloudflare Tunnel (`package.json` & `apps/server/src/index.ts`):**
  * Configurado túnel HTTPS externo apontando para a Rota `/admin` (bloqueando automaticamente o login `.env` fora do `localhost` e autenticando via CRUD do PostgreSQL).
  * Adicionado keep-alive automático da VM WSL2 no [`EtheriaServerApp.start`](file:///C:/Users/Dani/.gemini/antigravity/scratch/etheria-campus/apps/server/src/index.ts#L246-L255) para garantir que o banco PostgreSQL nunca entre em hibernação enquanto o servidor estiver rodando.

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
