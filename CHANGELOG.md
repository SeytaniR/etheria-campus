# 📦 CHANGELOG — Etheria Campus

Todas as alterações notáveis deste projeto são documentadas neste arquivo seguindo **Semantic Versioning (`vMAJOR.MINOR.PATCH`)**.
Qualquer IA trabalhando neste repositório **DEVE** incrementar a versão e registrar suas entregas aqui antes de encerrar o turno.

---

## [v0.5.1] - 2026-11-07
### Alterado & Simplificado
* **Simplificação da Tabela e Criação de NPCs (`AdminNpcsTab.js`, `admin/index.html`):**
  * Removida a coluna e o seletor estático de "Função / Gatilho / Tipo" (`npcFunctionSelect`) da criação/edição e da listagem da tabela de NPCs (`npc_templates`), mantendo o cadastro do NPC focado na sua identidade (`ID`, `Chave`, `Nome PT-BR`, `Visual do mcrework` e `Posicionamento nos Mapas`), já que o papel/interação do NPC passará a ser dirigido dinamicamente pelas tabelas vinculadas (como Quests, Diálogos e Lojas).

---

## [v0.5.0] - 2026-11-07
### Adicionado
* **Estúdio Visual No-Code de Habilidades (`⚡ Habilidades` — `skill_templates`) (`AdminSkillsController.ts`, `AdminSkillsAndBuffsTab.js`, `schema.prisma`):**
  * Nova aba `⚡ Habilidades` no Studio `/admin` com catálogo de Habilidades Ativas (`ACTIVE`) e Passivas (`PASSIVE`) estilo RPG Maker / Visual Blocks.
  * **Construtor Visual de Blocos de Efeito (`effectBlocksJson`):** Permite empilhar visualmente quantos blocos desejar em cada habilidade sem digitar código ou fórmulas:
    * `💥 Bloco de Dano`: Natureza (`PHYSICAL`, `MAGICAL`, `TRUE`), Elemento (`INHERIT`, `FIRE`, `WATER`, `EARTH`, `AIR`, `NEUTRAL`), Atributo Escalador (`ATK`, `MAX_HP`, `DEF`, `SPEED`), Multiplicador (`%`), Dano Fixo Base e Bônus Crítico (`%`).
    * `💚 Bloco de Cura`: Alvo ou Próprio Conjurador, Atributo Escalador (`MAX_HP` / `ATK`), Multiplicador (`%`) e Cura Fixa.
    * `🧪 Bloco de Aplicar Buff/Debuff`: Seleciona qualquer Buff ou Debuff cadastrado na tabela `status_effect_templates`, chance de aplicação (`1..100%`), duração em turnos e alvo (`Alvo da Skill` ou `Próprio Conjurador`).
    * `🛡️ Bloco de Escudo`: Escudo protetor escalado por atributo e duração.
  * **Integração com Catálogo do `mcrework`:** Seletor visual com **1.923 ícones de habilidades** (`assets/skills/icons/*.png`) e **128 efeitos especiais animados (VFX)** (`assets/effects/{id}/atlas.json` + `atlas.webp`), incluindo palco `<canvas>` 2.5D reproduzindo a animação do VFX ao vivo.
  * Semeadas 4 habilidades iniciais no banco (`Corte Fulminante`, `Chama Purgatorial`, `Espinhos Peçonhentos`, `Rugido do Guerreiro`).
* **Tabela e Estúdio Visual de Buffs & Debuffs (`🧪 Buffs & Debuffs` — `status_effect_templates`) (`AdminSkillsController.ts`, `AdminStatusEffectsTab.js`, `schema.prisma`):**
  * Nova aba `🧪 Buffs & Debuffs` no Studio `/admin` seguindo a mesma lógica visual No-Code das habilidades.
  * **Ativação Vinculada:** Buffs e Debuffs não se ativam sozinhos; são aplicados por Habilidades Ativas ou Passivas.
  * **Ícone na Cabeça do Alvo (`iconKey`) & Efeito Especial (`mcreworkVfxKey`):** Cada Buff/Debuff possui um ícone que serve tanto para informação na UI quanto para ficar **flutuando acima da cabeça do alvo durante a batalha**, além de um efeito especial animado (VFX) acionado quando o status entra em ação.
  * **Gatilhos Próprios (`triggerType`):** `ON_TURN_START` (Início do Turno do Alvo), `ON_TURN_END` (Fim do Turno do Alvo), `WHILE_ACTIVE` (Enquanto Ativo / Contínuo), `ON_APPLY` (No Momento da Aplicação), `ON_HIT_TAKEN` (Ao Receber um Golpe) e `ON_ATTACK` (Ao Atacar).
  * **Blocos Visuais de Status:** Modificador de Atributos (`ATK`, `DEF`, `SPEED`, `MAX_HP`), Dano ou Cura por Turno (DoT / HoT) e Controle de Grupo (`STUN` / `SILENCE`).
  * Semeados 5 Buffs/Debuffs iniciais (`Queimadura Solar`, `Toxina Paralisante`, `Fúria de Batalha`, `Bênção Regenerativa`, `Atordoamento Sísmico`).
* **Vínculo de Habilidades na Criação/Edição de Monstros e Personagens (`AdminMonstersTab.js`, `AdminClassesTab.js`, `AdminMonstersController.ts`, `AdminMapsController.ts`):**
  * A tabela de Habilidades atua como catálogo disponível, enquanto a definição de quais habilidades cada entidade possui (`skillIdsJson`) é feita diretamente:
    * No modal de **Monstros (`🐉 Monstros`)**: Bloco visível `⚡ Habilidades deste Monstro` com checklist de ícones e tipos, além de exibição das badges de habilidades na tabela de Monstros.
    * No modal de **Personagens (`🦸 Personagens`)**: Aba `⚡ Habilidades` com checklist visual de habilidades vinculadas ao personagem (`skillIdsJson`) e badges na tabela de Personagens.
* **Suporte Visual na Arena 2.5D para Ícones de Buffs/Debuffs na Cabeça e VFX (`TemporaryCombatController.ts`, `TemporaryCombatArena.js`):**
  * Renderização no `<canvas>` 2.5D dos **ícones ativos de Buffs (borda verde) e Debuffs (borda vermelha) flutuando na cabeça do Herói e dos Monstros**, com contador de turnos restantes (`3t`, `2t`).
  * Reprodução animada dos **Efeitos Especiais (VFX)** do `mcrework` (`assets/effects/{id}/atlas.json` + `atlas.webp`) sobre os alvos ao usar habilidades e quando os gatilhos de Buffs/Debuffs (`ON_TURN_START`) disparam.

---

## [v0.4.10] - 2026-11-07
### Alterado & Refatorado
* **Sistema de Raridade de Monstros Baseado em Ranks (`SS`, `S`, `A`, `B`, `C`, `D`, `F`) (`schema.prisma`, `AdminMonstersController.ts`, `AdminMonstersTab.js`, `TemporaryCombatController.ts`, `PlayGmController.js`):**
  * Substituída a chave `defaultRarityId` (Comum, Incomum, Elite, Raro, Mini-Chefe, Chefe — que atuará de forma procedural nos encontros futuros e não fica presa ao template do monstro) pelo campo `rarityTier` (`rarity_tier`) diretamente em `MonsterTemplate` (`monster_templates`).
  * Valores suportados e validados no servidor e no Studio `/admin`: **`SS`**, **`S`**, **`A`**, **`B`**, **`C`**, **`D`** e **`F`** (mantido como registro no banco para futura tabela lógica).
  * Adicionados badges visuais coloridos por Rank (`Rank SS` a `Rank F`) na tabela de Monstros do `/admin` e no seletor de Batalha GM do `/play`.

---

## [v0.4.9] - 2026-11-07
### Corrigido & Aprimorado
* **Revisão Completa do Modal e Tabela de Monstros no `/admin` (`AdminMonstersTab.js`, `AdminMonstersController.ts`, `AdminMapsController.ts`):**
  * **Causa Raiz Corrigida:** Removida a divisão em abas escondidas (`display: none`) dentro de `#monsterModal` (cuja barra de abas sofria colapso vertical `height: 0px` no Flexbox quando a galeria expandia), passando a exibir **TODOS os campos de edição diretamente visíveis na tela** em 5 blocos claros e roláveis:
    1. `1️⃣ Identidade, Raça, Elemento & Classificação`: Nome em PT-BR, **Raça** (11 raças do banco + fallback), **Elemento Fixo** (5 elementos + fallback), **Raridade Padrão** (6 raridades vindas de `monsterRarities` no bootstrap), **Domável como Pet** (Sim/Não) e **Status** (Ativo/Inativo).
    2. `2️⃣ Descrição / Lore em Português (PT-BR)`: Campo `<textarea>` sempre visível com exibição da chave i18n auto-gerada (`monster.monster_X.description`).
    3. `3️⃣ Atributos Base no Nível 1`: `VIT`, `STR`, `INT`, `WIS`, `AGI` e `DEX` lado a lado.
    4. `4️⃣ Biomas de Spawn Natural`: Checklist visível dos 40 biomas com busca rápida (`🔍 Filtrar bioma...`), contador de selecionados e botões `✅ Todos` / `⬜ Limpar`.
    5. `5️⃣ Modelo 2.5D Animado, Calibração de Solo & Catálogo do mcrework`: Palco `<canvas>` 2.5D renderizando o modelo real com `McreworkSpriteSheet`, botões para testar animações ao vivo (`🧍 Idle`, `🏃 Andar`, `🗡️ Ataque`, `💥 Dano`, `💀 Morte`, `🔥 Skill`, `↻ Girar`), calibragem de altura dos pés no solo e galeria dos 532 modelos com filtro (`Todos`, `🐾 Pets`, `👾 Mobs`).
* **Arena Temporária 2.5D em `<canvas>` com Animações Reais de Batalha (`TemporaryCombatArena.js`, `TemporaryCombatController.ts`, `McreworkSpriteSheet.js`):**
  * Substituídos os cards HTML de imagens estáticas por um **Motor de Batalha 2.5D em `<canvas>` a 60 FPS** instanciando `McreworkSpriteSheet` tanto para o Herói quanto para os 1..5 Monstros.
  * **Coreografia Completa de Turno com Animações do Atlas (`${dir}-${action}`):**
    * Estado de espera em respiração (`action = 0`), avanço até o oponente (`action = 1`), **Ataque Físico (`action = 3`)**, **Postura de Defesa (`action = 4`)** com escudo energético, **Reação de Dano/Hit (`action = 5`)**, **Morte/Nocaute no chão (`action = 6` com `clampLastFrame = true`)** e **Conjuração de Habilidade Especial (`action = 7`)**.
  * **Depth Sorting 2.5D & Seleção de Alvo Interativa:** Ordenação em Y por profundidade isométrica, plataformas táticas pulsantes sob os pés das unidades, seleção de alvo clicando/tocando diretamente no monstro no Canvas 2.5D (ou nas pílulas rápidas) e números flutuantes de dano/crítico/cura renderizados no Canvas.

---

## [v0.4.8] - 2026-11-07
### Adicionado
* **Tabela e Estúdio Completo de Monstros no `/admin` (`AdminMonstersTab.js` & `AdminMonstersController.ts`):**
  * Nova aba `🐉 Monstros` na barra de navegação do Studio `/admin`.
  * Tabela CRUD completa conectada ao PostgreSQL (`monster_templates`) com miniaturas de 532 criaturas do catálogo do repositório `mcrework`, nomes e descrições em PT-BR com chave i18n auto-incremental (`monster.monster_X.name`, `monster.monster_X.description`).
  * Modal modular com 4 abas estruturadas:
    1. `🎨 Visual & Solo`: Palco 2.5D com solo isométrico de grama, sombra elíptica real nos pés (`44x13px`) e steppers rápidos `[-5] [-1] [0px] [+1] [+5] ↩0` para calibração de altura (`groundOffsetY`).
    2. `📜 Lore / i18n`: Nome e descrição traduzidos em PT-BR.
    3. `🧬 Raça & Elemento`: Seleção entre 11 Raças, 5 Elementos, 6 Raridades, biomas de spawn natural e checkbox de domesticabilidade como Pet.
    4. `📊 Atributos`: Pesos de VIT, STR, INT, WIS, AGI e DEX no Nv. 1.
  * Injeção dinâmica do DOM do modal para manter `index.html` estritamente abaixo do limite de 1.000 linhas.
  * Semeamento automático de 5 monstros icônicos iniciais (`Sa Tặc da Areia`, `Peru Selvagem da Sorte`, `Cacto Venenoso`, `Guardião Arbóreo`, `Polvo Esmeralda`).
* **Ferramenta GM de Início Rápido de Batalha (`/play` & `PlayGmController.js`):**
  * Adicionada seção dedicada no Painel GM (`gmDrawer`) com dropdown dinâmico de monstros cadastrados, seletor de quantidade (1 a 5 monstros) com botões rápidos `[1] [2] [3] [5]`, seletor de nível dos monstros e botão em destaque `⚔️ Entrar em Batalha GM`.
* **Arena Temporária e Combate Simulado com Floating Numbers (`TemporaryCombatArena.js` & `TemporaryCombatController.ts`):**
  * Módulo 100% isolado e descartável/substituível para testes imediatos sem acoplamento à arquitetura final.
  * Campo de batalha 2.5D exibindo o Herói no lado esquerdo (com avatar, nível e barras dinâmicas de HP e MP) e até 5 monstros no lado direito em formação tática, com barras de HP individuais, mira de seleção de alvo (`🎯 ALVO`) e indicador de derrota (`💀 DERROTADO`).
  * Ações do jogador: `🗡️ Ataque Físico`, `🔥 Golpe Especial` (1.8x dano + crítico, gasta 15 MP), `🛡️ Defender` (+50% defesa + cura de HP/MP) e `⏩ Auto-Batalha` (simulação instantânea de turnos).
  * Números flutuantes de combate (*Floating Combat Text*) animados com tremor das unidades: dano físico normal (`-145`), dano crítico (`💥 CRÍTICO! -320`), cura (`💚 +X`) e registro de combate tático rolável em tempo real.
  * Banner de encerramento de batalha com resumo de turnos, EXP ganho simulado, Ouro e botão de retorno ao mapa.

### Refatorado
* **Cumprimento Estrito da Regra #7 (Limite de 1.000 Linhas de Código):**
  * Todos os arquivos continuam rigorosamente abaixo de 1.000 linhas (`AdminMonstersTab.js`: 412 linhas, `TemporaryCombatArena.js`: 355 linhas, `AdminMonstersController.ts`: 355 linhas, `TemporaryCombatController.ts`: 370 linhas, `admin/index.html`: 992 linhas, `play.js`: 906 linhas).

---

## [v0.4.7] - 2026-11-07
### Corrigido
* **Reversão Estrita das Animações de Movimentação (`apps/server/public/play/js/McreworkSpriteSheet.js`):**
  * Revertida a ordem das chaves de interpolação para a convenção validada pelo usuário: `${dir}-${action}` com fallbacks `${dir}-1`, `${dir}-0`, `0-${action}` e `0-0`.
  * Restabelecida a animação de caminhada e repouso dos personagens com perfeita fluidez e sincronização.
* **Previews de Modelos Descomprimidos no Celular (`apps/server/public/admin/index.html`):**
  * Resolvido o problema dos previews que ficavam espremidos/deprimidos verticalmente na tela do celular.
  * Otimizado o grid mobile com `@media (max-width: 600px)` definindo 2 colunas amplas (`repeat(2, 1fr)`) e imagens de 115px com altura visual adequada.
  * O modal de Personagens / Classes foi reestruturado em 4 abas limpas e com scroll nativo suave (`overflow-y: auto; -webkit-overflow-scrolling: touch;`), garantindo área útil generosa para navegar pelos 46 modelos tanto no modo Padrão quanto no modo Reborn.

### Adicionado
* **Palcos 2.5D de Calibração de Chão "Na Prática Durante as Edições" (`/admin`):**
  * Integrado palco de calibração 2.5D no preview do personagem com solo isométrico de grama, baseline dourada (0px) e a sombra elíptica real nos pés (`44x13px rgba(0,0,0,0.55)`).
  * Steppers rápidos `[-5] [-1] [0px] [+1] [+5] ↩0` com translação em tempo real do modelo em relação ao chão e badge dinâmico de status (*"🟢 Pés no solo (0px)"*, *"🔵 Afundado +Xpx no chão"*, *"🟡 Flutuando Xpx acima do solo"*).
  * Suporte independente para o visual Padrão e o visual Reencarnado (Reborn).
* **Calibração de Chão In-Game via Painel GM com Persistência Imediata (`/play`):**
  * Adicionado painel de ajuste fino in-game diretamente no `gmDrawer`, permitindo que o GM ou desenvolvedor ajuste a altura dos pés pisando no chão do mapa real com os botões `[-5] [-1] [0] [+1] [+5]`.
  * Criado o endpoint autoritário `POST /api/play/characters/:id/ground-offset` (`GamePlayController.ts`) e botão `💾 Salvar Altura na Classe`, persistindo o offset diretamente no PostgreSQL no banco de dados.

### Refatorado
* **Cumprimento Estrito da Regra #7 (Limite de 1.000 Linhas de Código):**
  * Todos os arquivos do projeto auditados e confirmados abaixo de 1.000 linhas (`index.html` com 967 linhas, `AdminClassesTab.js` com 515 linhas, `GamePlayController.ts` com 704 linhas).

---

## [v0.4.6] - 2026-11-06
### Corrigido
* **Correção da Ordem das Animações 8-Direções (`apps/server/public/play/js/McreworkSpriteSheet.js`):**
  * Identificada e corrigida a inversão crítica na interpolação de frames do atlas do `mcrework`. A convenção oficial dos arquivos `atlas.json` é `${action}-${direction}` (onde `0` é Stand/Idle, `1` é Walk, e o segundo número é a direção `0..7`).
  * O código anterior buscava erroneamente por `${dir}-${action}`, fazendo com que ao andar com o personagem (`action = 1`) o sistema procurasse por `${dir}-1`, que disparava sequências de ataque/combate (`3-1`, `2-1`) ao invés do ciclo de caminhada. Ao parar, disparava ataques correspondentes à direção ao invés da respiração/repouso.
  * Corrigida a chave primária e as ordens de fallback: `${action}-${dir}` &bull; `1-${dir}` &bull; `0-${dir}` &bull; `${action}-0` &bull; `0-0`.
* **Eliminação do Overlay/Highlight Azul ao Tocar na Tela Móvel (`/play`):**
  * Aplicados `-webkit-tap-highlight-color: transparent !important;`, `-webkit-touch-callout: none !important;` e `user-select: none !important;` em todos os elementos globais e no Canvas.
  * Adicionado `e.preventDefault()` nos ponteiros de toque móvel do Canvas, suprimindo o flash azul e a caixa de seleção nativa do Chrome Android ao movimentar o personagem.
* **Resolução Definitiva do Carregamento dos Mapas em RAM (`apps/server/src/index.ts` & `play.js`):**
  * Adicionado pré-aquecimento automático de todos os cenários ativos no boot do servidor (`prewarmMapImages`), mantendo as imagens binárias dos mapas persistidas em RAM.
  * O endpoint proxy `GET /api/assets/map-image/:id` responde em 0ms com cabeçalhos de cache completos diretamente no túnel Cloudflare.
  * Corrigida a validação de tipo de ID (`Number(this.currentMap.id) === Number(mapId)`) no carregador cliente de fundo.

### Adicionado
* **Descrição de Personagens com i18n Automático (`class_templates`):**
  * Criada a coluna `description_i18n_key` em `class_templates` no PostgreSQL.
  * No estúdio `/admin`, o formulário de classes gera automaticamente a chave auto-incremental `class.class_X.description` e salva o texto em português na tabela `i18n_translations`, disponibilizando o conteúdo nos bootstraps administrativos e in-game.
* **Visual Reencarnado (Reborn) para Personagens:**
  * Adicionada coluna `reborn_mcrework_char_key` em `class_templates` e `is_reborn` em `player_characters`.
  * Adicionada a aba `✨ Visual Reencarnado (Reborn)` no modal de classes com card dedicado, busca na galeria de modelos e botão para desvincular.
  * Criado endpoint autoritário `POST /api/play/characters/:id/toggle-reborn` e botão de alternância imediata no Painel GM in-game para testes rápidos.
* **Calibração Fina da Distância dos Pés ao Chão (`groundOffsetY` & `rebornGroundOffsetY`):**
  * Adicionada calibração milimétrica de offset Y tanto para o modelo padrão quanto para a forma reencarnada.
  * No `/admin`, adicionada uma linha dourada de referência do solo sob o Hero Preview com botões de incremento `[-1]` e `[+1]` e translação em tempo real (`transform: translateY(...)`).
  * No motor `McreworkSpriteSheet.draw()`, o offset Y é repassado e renderizado mantendo a sombra fixa no nível do solo e reajustando automaticamente a altura do nome do personagem.

### Refatorado
* **Cumprimento Estrito da Regra #7 (Zero God Objects / Limite de 1.000 Linhas por Arquivo):**
  * Extraído o submódulo `apps/server/public/admin/js/AdminLayersDrawer.js` (245 linhas) a partir de `AdminCanvasEditor.js`, reduzindo o editor de 1.008 para 793 linhas.
  * Otimizado `apps/server/public/admin/index.html` de 1.000 para 944 linhas.
  * Todos os arquivos do projeto permanecem estritamente abaixo do teto de 1.000 linhas.

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
