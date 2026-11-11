# 🏛️ Arquitetura de Sistema, Motor Procedural & Combate Tático (Etheria Campus)

Este documento detalha os módulos Orientados a Objetos, o Motor de Regras Procedurais, os Sistemas de Elementos e Raças, o Cálculo Universal de Dano e o Combate em Arena de **10x10 Slots (Modo 5B)**.

---

## 1. Visão Geral dos 6 Módulos Principais (Monorepo OO)

1. **`@etheria/asset-bridge` (Conector da Galeria Bruta `mcrework`):**
   * Lê os catálogos, atlases WebP de personagens/monstros/NPCs, imagens limpas de fundo dos mapas (sem usar malhas ou colisões antigas do `mcrework`), ícones e efeitos especiais (VFX) do repositório `SeytaniR/mcrework`.
   * **Regra da Curadoria (Whitelist):** Nenhum arquivo do `mcrework` existe no jogo automaticamente. Apenas o que for selecionado e salvo nas tabelas do nosso Banco de Dados via `/admin` passa a existir no jogo.
2. **`@etheria/shared` (Núcleo OO Compartilhado, Motor Procedural & i18n):**
   * Classes de domínio (`Entity`, `Actor`, `Character`, `Pet`, `Monster`, `ArenaFormation`, `CombatCalculator`, `MapMeshGrid`), contratos de pacotes de rede e sistema de tradução `i18n` (`pt-BR`, `en-US`, `es-ES`).
3. **`@etheria/database` (Banco de Dados Low-Code):**
   * Tabelas relacionais gerenciadas via **Prisma ORM + PostgreSQL**, populadas pelo usuário através da Rota `/admin` e espelhadas automaticamente em snapshots JSON versionados.
4. **`@etheria/server` (Servidor Autoritário):**
   * Gerencia instâncias de mapas (`MapInstance`), validação de movimento contra a malha de colisão salva no banco (`collision_mesh_json`), dominação de Facções/Alianças, encontros procedurais, instâncias de arena (`BattleArenaInstance`) e anti-cheat.
5. **`@etheria/client` (Cliente WebGL Pixi.js + UI Camaleão + APK Capacitor):**
   * Renderiza mapas 2.5D e Arenas 10x10 a 60 FPS com interface 100% responsiva (PC, Tablet, Celular Horizontal e Celular Vertical).
6. **Rotas `/admin` (Studio Low-Code), `/play` (Rota dos Jogadores) & `/gm` (Game Master In-Game):**
   * **`/admin`:** Interface visual para criar e editar todas as tabelas do jogo (`maps`, `npc_templates`, `class_templates`, `user_accounts`, etc.) com auto-incremento padronizado (`map_1`, `npc_1`, `class_1`...) e exportação automática de Snapshot JSON.
   * **`/play`:** Rota dos jogadores para autenticação, criação/seleção de personagens (`player_characters` com sorteio elemental inicial `10%` `NEUTRAL` vs `20%` peso relativo para cada elemento ativo), exploração 2.5D em tempo real com sprites animados de 8 direções do `mcrework`, colisão poligonal (`collision_mesh_json`), opacidade de sobreposição (`overlap_mesh_json`), travessia de portais pareados (`Entrada <-> Saída`) e função **`🆘 Destravar Personagem`** (retorno ao `spawn_x, spawn_y` do mapa).
   * **`/gm` (Integrado em `/play`):** Painel flutuante (`⚡ Painel GM`) exclusivo para contas `ADMIN` e `GM` permitindo teleporte instantâneo em 1 clique para qualquer mapa salvo, Raio-X visual das malhas de colisão/sobreposição/portais/spawn em tempo real, modo No-Clip (atravessar paredes), multiplicador de velocidade GM e *Hot-Reload* do mapa atual direto do PostgreSQL.

---

## 2. Mundo Procedural: Tipos de Mapa, Dominação e os 40 Biomas

### 2.1. Os 5 Tipos de Mapa (Regras de Spawn, Dominação e PvP Fixadas no Tipo)
O comportamento de **Spawn de Monstros**, **Dominação Territorial** e **Regra de PvP** é determinado diretamente pelo **Tipo de Mapa (`map_types`)**:

| Código | Nome | Quem Pode Dominar? | Spawna Monstros? | Regra de PvP |
| :--- | :--- | :---: | :---: | :--- |
| **`CITY`** | **Cidade** | **Alianças** (União de Facções) | ❌ Não | 🤝 **Apenas Duelo Aceito** (Ambos jogadores/equipes devem aceitar) |
| **`VILLAGE`** | **Vila** | **Alianças** (União de Facções) | ❌ Não | 🤝 **Apenas Duelo Aceito** (Ambos jogadores/equipes devem aceitar) |
| **`SUBURB`** | **Subúrbio** | **Facções** | ✅ Sim | 🤝 **Apenas Duelo Aceito** (Sem PvP forçado) |
| **`HOSTILE_ZONE`** | **Zona Hostil** | **Facções** | ✅ Sim | ⚠️ **PvP Forçado (PK) Permitido** (Atacar quem está com PvP desativado transforma o atacante em **Criminoso**) |
| **`CONFLICT_ZONE`** | **Zona de Conflito** | **Facções** | ✅ Sim | ⚔️ **PvP Totalmente Aberto** (Combate livre a todos sem penalidade de crime) |

### 2.2. Estrutura Enxuta de Cada Mapa (`maps`) & Malhas Visuais Editáveis no Banco
> **Importante:** As malhas antigas (`collision.bin` e máscaras originais) do `mcrework` foram **descartadas** por incompatibilidade. Do `mcrework` importa-se **somente a imagem limpa do mapa**.

Na tabela de mapas e no Editor Visual da Rota `/admin`, você define e salva diretamente no banco:
1. **Nome do Mapa** (`i18n`) e **Imagem Base do Mapa** (`mcrework`).
2. **Nível de Acesso** (progressão de 10 em 10: Mapa 1 = Nv. 1, Mapa 2 = Nv. 10, Mapa 3 = Nv. 20...).
3. **Tipo de Mapa** (um dos 5 acima, herdando automaticamente as regras de spawn, PvP e dominação).
4. **Dois Biomas** (`primary_biome_id` e `secondary_biome_id` escolhidos dentre os 40 biomas).
5. **Malha de Colisão (`collision_mesh_json` — Polígonos Estilo Google Earth):** Áreas desenhadas visualmente por você no `/admin` pontilhando vértices onde o polígono se fecha automaticamente a partir do 3º ponto. Define onde o personagem colide e não pode atravessar (validada via algoritmo *Point-in-Polygon + Bounding Box* pelo Servidor Autoritário e pelo Cliente).
6. **Malha de Sobreposição (`overlap_mesh_json` — Polígonos Estilo Google Earth):** Áreas poligonais desenhadas visualmente no `/admin` que ficam "acima" do personagem (ex: copas de árvores, telhados, arcos). Quando o personagem entra nessa área, o renderizador usa o polígono como máscara de recorte para diminuir a opacidade apenas da região do corpo do personagem que está coberta pela sobreposição.
7. **Pontos de Teleporte (`map_portals`):** Coordenadas $(X, Y)$ no mapa e para qual mapa/coordenada levam.
8. **NPCs (`map_npcs`):** Quais NPCs estão no mapa e suas coordenadas $(X, Y)$.

### 2.3. Função Exclusiva dos 40 Biomas: Vínculo Procedural de Spawn (`Mapa ↔ Bioma ↔ Monstro`)
* **Biomas NÃO interferem em cálculo de dano nem possuem vínculo com elementos.**
* A única função dos **40 Biomas** é gerar a *pool* procedural de monstros de cada mapa:
  * Monstros não são amarrados manualmente a mapas individuais.
  * Cada monstro é vinculado aos **Biomas** onde habita.
  * Se um mapa é Nv. 80 e possui os biomas **Bosque Temperado** e **Floresta Densa**, qualquer monstro do banco que habite *Bosque Temperado* **OU** *Floresta Densa* poderá nascer nos encontros daquele mapa, com seu nível e atributos escalados proceduralmente para $\text{Nv. } 80 \pm \text{Variação}$!

---

## 3. Sistema de Elementos e Raças (Vinculados à Entidade)

Toda entidade do jogo (Personagem, Pet ou Monstro) possui **1 Elemento** e **1 Raça**.

### 3.1. Os 5 Elementos (4 Ativos + Neutro Penalizado)
> **Nota:** Não existem elementos de Luz ou Escuridão no jogo.

* **Ciclo dos 4 Elementos Ativos (`+25%` Vantagem / `-25%` Desvantagem):**
  $$\text{🔥 Fogo (\texttt{FIRE})} > \text{🌿 Terra (\texttt{EARTH})} > \text{💨 Ar (\texttt{AIR})} > \text{🌊 Água (\texttt{WATER})} > \text{🔥 Fogo (\texttt{FIRE})}$$
* **Penalidade do Elemento Neutro (`NEUTRAL`):**
  * Entidades com elemento **Neutro** sofrem penalidade completa: **causam `-25%` de dano** contra qualquer alvo e **recebem `+25%` de dano** de qualquer elemento.
* **Regra de Atribuição de Elemento:**
  * **Entidades Inimigas (Monstros):** Elemento fixo definido na tabela pelo Admin.
  * **Entidades Controláveis (Personagens e Pets):** Ao serem criados/capturados, sorteiam um elemento inicial aleatório com a distribuição:
    * **`NEUTRAL` (Neutro):** Peso `10` (`10%` de chance — ou `11.1%` se normalizado em pesos `10:20:20:20:20`; para cravar exatos `10%` em base $100\%$, usa-se `10%` Neutro e `22.5%` para cada um dos 4 elementos ativos, configurável na tabela `global_formulas`).
    * **`FIRE`, `EARTH`, `AIR`, `WATER`:** `20%` (peso 20) para cada um.
    * *Futuro:* O jogador poderá alterar o elemento do seu Personagem ou Pet utilizando um item específico.

### 3.2. As 11 Raças (`+10%` de Vantagem Racial)
1. **Humanos (`HUMAN`):** Possuem **`+10%` de vantagem** sobre **todas** as outras raças.
2. **Ciclo das 10 Raças (`+10%` de vantagem na sequência abaixo):**
   $$\text{🌿 Plantas (\texttt{PLANT})} > \text{🐉 Dragões (\texttt{DRAGON})} > \text{🦎 Reptilianos (\texttt{REPTILIAN})} > \text{🌊 Aquáticos (\texttt{AQUATIC})} > \text{🤖 Robóticos (\texttt{ROBOTIC})} > \text{🪽 Celestiais (\texttt{CELESTIAL})} > \text{👿 Demônios (\texttt{DEMON})} > \text{🧚 Fadas (\texttt{FAIRY})} > \text{👻 Espíritos (\texttt{SPIRIT})} > \text{🐾 Selvagens (\texttt{BEAST})} > \text{🌿 Plantas (\texttt{PLANT})}$$

---

## 4. Atributos Procedurais, Habilidades e Cálculo Universal de Combate

### 4.1. Os 6 Atributos Base $\rightarrow$ Derivação para Atributos de Combate
* **Atributos Base:**
  1. `VIT` (Vitalidade) $\rightarrow$ `HP Máximo`, `Defesa Física`, `Resistência a DoT`
  2. `STR` (Força) $\rightarrow$ `Ataque Físico`, `Penetração Física`, `Dano Crítico`
  3. `INT` (Inteligência) $\rightarrow$ `Ataque Mágico`, `MP Máximo`, `Penetração Mágica`
  4. `WIS` (Sabedoria) $\rightarrow$ `Poder de Cura/Escudo`, `Defesa Mágica`, `Regen de MP`
  5. `AGI` (Agilidade) $\rightarrow$ `Velocidade (Iniciativa)`, `Esquiva`, `Ataque Físico Leve`
  6. `DEX` (Destreza) $\rightarrow$ `Chance Crítica`, `Precisão (Acerto)`, `Taxa de Aplicação de Debuff`
* **Pontos de Ação (AP):** Valores base fixos e controlados por turno (ex: 4 AP inicial, +3 AP/turno, teto de 10 AP), sem escalonamento infinito por atributo base.

### 4.2. Cálculo de Dano em 4 Passos
Toda habilidade ofensiva passa pelo mesmo pipeline no servidor:
1. **Dano Bruto:** $\text{Ataque (Físico ou Mágico)} \times \text{Multiplicador da Skill (\%)}$.
2. **Mitigação Proporcional pela Defesa (Assintótica por Nível):**
   $$\text{Redução (\%)} = \frac{\text{Defesa Efetiva}}{\text{Defesa Efetiva} + (100 + 10 \times \text{Nível do Atacante})}$$
3. **Multiplicadores de Entidade (Elemento + Raça + Buffs/Debuffs):**
   * Multiplicador de **Elemento** (`+25%` vantagem, `-25%` desvantagem ou penalidade de Neutro).
   * Multiplicador de **Raça** (`+10%` vantagem, `-10%` desvantagem).
   * Multiplicador de **Buffs/Debuffs ativos**.
4. **Crítico e Variação ($\pm 5\%$):** Se critar, multiplica pelo `Dano Crítico` da entidade.

### 4.3. Arquitetura de Efeitos Atomizados (Skills Ativas, Passivas, Buffs e Debuffs)
Todas as habilidades são compostas no banco de dados usando **7 Primitivas Universais**:
1. `DAMAGE` (Dano Físico, Mágico ou Verdadeiro)
2. `HEAL` (Cura de HP/MP)
3. `SHIELD` (Barreira absorvedora de dano)
4. `STATUS` (Buffs/Debuffs de atributo em `%`, Dano por Turno [DoT] e Controle [Stun, Silêncio, Congelamento])
5. `MOVE_SLOT` (Empurrar/Puxar alvos entre Vanguarda e Retaguarda nos 10 slots)
6. `CLEANSE_DISPEL` (Remover debuffs aliados ou buffs inimigos)
7. `RESOURCE` (Ganhar/Drenar AP ou alterar Cooldown)
* **Passivas:** Utilizam os mesmos blocos acima acionados por **Gatilhos (`Triggers`)**: `PASSIVE_ALWAYS`, `ON_TURN_START`, `ON_HIT`, `ON_CRIT`, `ON_DAMAGE_TAKEN`, `ON_KILL`.

---

## 5. Combate em Arena Isolada 10x10 Slots (Modo 5B)

* **10 Slots de cada lado:** 5 na Vanguarda (`Slots 1..5`) + 5 na Retaguarda (`Slots 6..10`), permitindo caçadas em massa (até 10 monstros) e **PvP 5v5**.
* **Regra Escalonada de Pets por Tamanho da Equipe (Sem vantagem de classe):**
  * **Solo (1 Jogador) ou Dupla (2 Jogadores):** `1 Personagem + até 3 Pets` por jogador (Solo = até 4 unidades; Dupla = até 8 unidades).
  * **Grupo de 3 a 5 Jogadores:** `1 Personagem + 1 Pet` por jogador (3 jogadores = 6 unidades; 4 = 8 unidades; 5 = 10 unidades).
  * O **Capitão/Solo** escolhe a formação de batalha da equipe nos 10 slots.
* **Execução 5B:** Pontos de Turno (AP) + Bloqueio de curto alcance pela Vanguarda + Planejamento Simultâneo ("We-Go") resolvido pela ordem de Velocidade.

---

## 6. Arquitetura Modular Frontend, Sem God Objects & Limite de 1.000 Linhas

Para manter manutenibilidade de longo prazo, legibilidade por múltiplas IAs e escalabilidade:

### 6.1. Princípio da Responsabilidade Única (SRP) e Proibição de God Objects
Nenhum arquivo ou classe deve acumular responsabilidades de múltiplos domínios. A divisão é estrita:
* **Rota `/play` (Cliente de Jogo & GM):**
  * `ClientPolygonMesh.js`: Algoritmos de colisão poligonal (Point-in-Polygon + AABB Pre-Culling) e cálculo de opacidade de sobreposição.
  * `McreworkSpriteSheet.js`: Carregamento assíncrono de Sprite Atlases, animação 8-direções e renderização calibrada com **redução de 30% (`scale = 0.70`)** nos modelos e sombras.
  * `PlayGmController.js`: Painel flutuante GM (teleporte, raio-x, no-clip, velocidade, hot-reload) e Ficha Procedural de Atributos de Combate.
  * `play.js`: Orquestrador de exploração 2.5D, sincronização com servidor e loop de renderização 60 FPS com ordenação Y-Sorting.
* **Rota `/admin` (Studio Low-Code):**
  * `AdminAuth.js`: Autenticação Dual-Mode (.env vs CRUD) e navegação.
  * `AdminUsersTab.js`: CRUD completo de contas de usuários (`ADMIN`, `GM`, `PLAYER`).
  * `AdminNpcsTab.js`: CRUD e catálogo de NPCs curados.
  * `AdminClassesTab.js`: CRUD e galeria de classes/personagens com Hero Preview, filtro por gênero e atributos procedurais.
  * `AdminCanvasEditor.js`: Estúdio visual em tela cheia, câmera, histórico real Undo/Redo e gaveta de camadas.
  * `admin.js`: Ficha técnica de mapas e orquestrador principal da aplicação.

### 6.2. Limite Mandatório de 1.000 Linhas por Arquivo
* Nenhum arquivo de código no repositório pode exceder **1.000 linhas**. Todo módulo que atingir proporções elevadas deve ser decomposto imediatamente.

---

## 7. Engine de Quests Meta Procedurais & Base Inicial de Inventário (`v0.9.0`)

* **Módulos Backend OOP Adicionados:**
  * `MetaQuestProceduralEngine.ts`: gera estágios procedurais (`initial * multiplier^(stage-1)`) e escaladas independentes de recompensas (`MULTIPLIER`, `LINEAR_PCT`, `ADDITIVE`), preservando ajustes manuais por linha feitos no Studio `/admin`.
  * `QuestProgressService.ts`: executa o ciclo em tempo real `/play` (`KILL_MONSTER`, `KILL_RACE`, `COLLECT_ITEM` cumulativo por estágio com entrega e avanço de estágio no NPC).
  * `CharacterInventoryService.ts` (**Base Inicial Incompleta**): gerencia carteira (`gold`), pilha de itens (`CharacterInventoryItem`) e hook provisório de drop para quests `COLLECT_ITEM` até a construção do módulo dedicado de Economia & Drops.
  * `CombatUtilityHelper.ts`: agrupa monstros e raças derrotadas em encontros mistos para registro autoritativo via `POST /api/play/combat/victory`.
* **Módulos Frontend Adicionados:**
  * `/admin`: `AdminMetaQuestsPanel.js` (construtor visual + grade editável de estágios).
  * `/play`: `PlayBagController.js` (inspetor leve de Carteira & Mochila Básica marcado como incompleto).
