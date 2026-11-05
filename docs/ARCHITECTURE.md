# 🏛️ Arquitetura de Sistema, Motor Procedural & Combate Tático (Etheria Campus)

Este documento detalha os módulos Orientados a Objetos, o Motor de Regras Procedurais, o Sistema de Combate em Arena de **10x10 Slots (Modo 5B)** e a infraestrutura de desenvolvimento e testes Mobile/PC.

---

## 1. Visão Geral dos 6 Módulos Principais (Monorepo OO)

O projeto **Etheria Campus** é estruturado como um **Monorepo em TypeScript** fortemente Orientado a Objetos:

1. **`@etheria/asset-bridge` (Módulo Conector da Galeria `mcrework`):**
   * Lê os catálogos, atlases WebP, malhas binárias de colisão (`collision.bin`), ícones e efeitos especiais (VFX) do repositório `SeytaniR/mcrework`.
   * **Regra da Curadoria (Whitelist):** O `asset-bridge` apenas fornece a galeria visual para a Rota `/admin` e carrega em tempo de execução **exclusivamente** os assets que foram vinculados a registros ativos no nosso Banco de Dados.
2. **`@etheria/shared` (Núcleo OO Compartilhado & i18n):**
   * Classes de domínio base (`Entity`, `Actor`, `Character`, `Pet`, `Monster`, `ArenaFormation`, `SkillFormula`), contratos de pacotes de rede e sistema de tradução `i18n` (`pt-BR`, `en-US`, `es-ES`).
3. **`@etheria/database` (Módulo de Banco de Dados Low-Code):**
   * Tabelas relacionais gerenciadas via **Prisma ORM + PostgreSQL**.
   * Criadas pelas IAs via *Migrations* e populadas pelo usuário através da interface Low-Code (`/admin`).
4. **`@etheria/server` (Servidor Autoritário):**
   * Gerencia instâncias de mapas (`MapInstance`), validação de movimento contra `collision.bin`, encontros de batalha, instâncias de arena (`BattleArenaInstance`), cálculo procedural de atributos e persistência.
5. **`@etheria/client` (Cliente WebGL Pixi.js + UI Camaleão + APK Capacitor):**
   * Renderiza o mundo 2.5D e as Arenas de Batalha a 60 FPS, com interface adaptativa para PC, Tablet, Celular Horizontal e Celular Vertical.
6. **Rotas Administrativas (`/admin` Studio Low-Code & `/gm` Game Master Overlay):**
   * **`/admin`:** CRUD visual completo para editar mapas, portais, NPCs, biomas, monstros, classes, skills, itens e fórmulas procedurais com *Hot-Reload*.
   * **`/gm`:** Ferramentas *in-game* para teleporte, *summon*, edição de nível/atributos ao vivo, inspeção de jogadores e moderação.

---

## 2. Sistema de Encontros & Combate Tático em Arena (10x10 Slots — Modo 5B)

### 2.1. Gatilho de Encontro (Mapas $\rightarrow$ Arena Isolada)
* **PvE (Caça e Masmorras):** Enquanto o jogador (ou grupo) caminha por um mapa que possui monstros configurados para seus biomas, o Servidor Autoritário calcula a taxa de encontro por passo/tempo (ou colisão com chefes visíveis) e instancia uma **Arena Isolada de Batalha**.
* **PvP (Zonas de Conflito / Duelos):** Em mapas classificados como `CONFLICT_ZONE`, jogadores ou grupos que atendam ao requisito de nível podem iniciar combate PvP aberto (até **5v5 jogadores**), sendo transportados para a Arena de Batalha.

### 2.2. Topologia da Arena: **10 Slots de Cada Lado (5 Vanguarda + 5 Retaguarda)**

Cada lado da arena possui exatamente **10 posições pré-definidas**, organizadas em 2 fileiras de 5 colunas:

```text
================================================================================
                🏟️ ARENA DE COMBATE ETHERIA CAMPUS (10 vs 10 SLOTS)
================================================================================

   LADO A (EQUIPE ALIADA)                         LADO B (INIMIGOS / PVP)
 [Retaguarda]   [Vanguarda]                     [Vanguarda]   [Retaguarda]
  (Slots 6-10)   (Slots 1-5)                     (Slots 1-5)   (Slots 6-10)

   [Slot 06]      [Slot 01]       <--Topo-->      [Slot 01]      [Slot 06]
   [Slot 07]      [Slot 02]      <--Médio-S-->    [Slot 02]      [Slot 07]
   [Slot 08]      [Slot 03]       <--Centro-->    [Slot 03]      [Slot 08]
   [Slot 09]      [Slot 04]      <--Médio-I-->    [Slot 04]      [Slot 09]
   [Slot 10]      [Slot 05]       <--Base-->      [Slot 05]      [Slot 10]
================================================================================
```

### 2.3. Regra Escalonada de Pets e Limite de Unidades por Equipe
> **REGRA DE OURO:** Não existe vantagem de classe que altere o limite de pets em combate. A quantidade máxima de pets instanciados por jogador depende exclusivamente do **tamanho do grupo (Party)**:

| Tamanho da Equipe | Unidades Permitidas por Jogador | Máximo Total da Equipe nos 10 Slots | Quem Define a Formação nos 10 Slots? |
| :--- | :--- | :---: | :--- |
| **Solo (1 Jogador)** | **1 Personagem + até 3 Pets** (4 unidades) | **Até 4 unidades** | O próprio Jogador |
| **Dupla (2 Jogadores)** | **1 Personagem + até 3 Pets** por jogador | **Até 8 unidades** | O Capitão do Grupo |
| **Trio (3 Jogadores)** | **1 Personagem + 1 Pet** por jogador | **Até 6 unidades** | O Capitão do Grupo |
| **Quarteto (4 Jogadores)** | **1 Personagem + 1 Pet** por jogador | **Até 8 unidades** | O Capitão do Grupo |
| **Grupo Cheio (5 Jogadores / 5v5)** | **1 Personagem + 1 Pet** por jogador | **Até 10 unidades** (100% dos slots) | O Capitão do Grupo |
| **Horda Inimiga (PvE)** | Gerado pelo `ProceduralSpawner` | **De 1 a 10 Monstros** (Caçada em Massa) | Motor Procedural do Mapa |

### 2.4. Dinâmica de Turno: **Opção 5B (Pontos de Ação [AP] + Posições com Alcance + Planejamento Simultâneo "We-Go")**
1. **Regra de Alcance e Bloqueio de Vanguarda:**
   * Unidades na **Vanguarda (Slots 1 a 5)** protegem as unidades na **Retaguarda (Slots 6 a 10)**.
   * Habilidades de **Curto Alcance (Melee)** só podem alvejar a Retaguarda inimiga se a Vanguarda correspondente estiver vazia/derrotada.
   * Habilidades de **Longo Alcance, Magias e Áreas (Linha, Coluna, Cruz, 3x3, Todos)** possuem regras próprias de mira configuradas na tabela de `skills`.
2. **Fase de Planejamento Simultâneo ("We-Go" com AP):**
   * No início da rodada, todas as unidades recebem seus **Pontos de Ação (AP)** do turno.
   * Ambos os lados possuem uma janela de tempo simultânea (ex: 20 segundos) para alocar as habilidades e combos de AP das suas unidades.
   * *(Assistente de Conforto para Pets):* Para facilitar quando o jogador estiver Solo/Dupla com 3 Pets, cada Pet pode ter uma "Skill Padrão Favorita" pré-selecionada caso o jogador queira focar o tempo do turno apenas em mudar o combo do seu Personagem principal.
3. **Fase de Resolução por Iniciativa (Velocidade):**
   * Encerrado o planejamento (ou quando todos confirmam *"Pronto"*), o Servidor Autoritário ordena todas as unidades da arena pela **Velocidade/Iniciativa de Combate** e executa as sequências de ações, calculando danos, curas, escudos, mortes e transmitindo o pacote de eventos de animação para os clientes.

---

## 3. Motor Procedural de Mapas e Atributos

### 3.1. Regras Procedurais de Mapas
* **Progressão de Nível (10 em 10):**
  * Mapa Ordem 1 = Nv. 1 | Mapa Ordem 2 = Nv. 10 | Mapa Ordem 3 = Nv. 20 | Mapa Ordem $N$ = $(N - 1) \times 10$.
  * O servidor bloqueia a entrada nos portais se $\text{Nível do Jogador} < \text{Nível Mínimo do Mapa}$.
* **Duplo Bioma por Mapa:**
  * Cada mapa possui `primary_biome_id` e `secondary_biome_id` (ex: `SELVA` + `BOSQUE`).
* **6 Tipos de Mapa:**
  * `CITY` (Cidade), `VILLAGE` (Vila), `SUBURB` (Subúrbio), `DUNGEON` (Masmorra), `HOSTILE_ZONE` (Zona Hostil), `CONFLICT_ZONE` (Zona de Conflito — PvP Aberto).
* **Spawn e Encontros Procedurais:**
  * Um mapa **Nv. 80 [Bosque / Floresta] [Zona de Conflito]** só aceita jogadores **Nv. 80+**, habilita **PvP Aberto**, e sorteia encontros de 1 a 10 monstros cadastrados nos biomas **Bosque ou Floresta**, escalando o nível deles para $\text{Nv. } 80 \pm \text{Variação}$!

### 3.2. Derivação Procedural de Atributos (Base $\rightarrow$ Combate)
* **Atributos Base (Primários):** `VIT`, `STR`, `INT`, `AGI`, `DEX`, `WIL` (configuráveis no banco).
* **Atributos de Combate (Secundários):** `MAX_HP`, `MAX_MP`, `PHYS_ATK`, `MAG_ATK`, `PHYS_DEF`, `MAG_DEF`, `SPEED`, `CRIT_RATE`, `CRIT_DMG`, `EVASION`, `ACCURACY`, `MAX_AP`.
* **Como escalam:**
  * **Jogadores:** Distribuem pontos de nível + somam equipamentos/armas/conjuntos $\rightarrow$ multiplicam pela Matriz de Conversão (`attribute_conversions`).
  * **Monstros e Pets:** Usam os atributos base da sua tabela $\times$ Fórmula de Nível/Variação $\times$ Multiplicador de Raridade (`Comum`, `Incomum`, `Elite`, `Raro`, `Chefe`) $\rightarrow$ multiplicam pela mesma Matriz de Conversão.

---

## 4. Solução para Testes no Celular (Mesmo com Provedor em CGNAT)

Como a internet residencial passa por **CGNAT** (que impede abrir portas diretas no roteador para a internet externa), utilizaremos uma arquitetura em **3 Níveis de Acesso Mobile**:

1. **GitHub Pages Automático (`https://seytanir.github.io/etheria-campus/`):**
   * O repositório público compila e publica automaticamente a interface do Cliente e do Studio a cada `git push`. Você pode abrir o link no navegador do celular de qualquer lugar (4G/5G ou Wi-Fi).
2. **Rede Local Wi-Fi (LAN Direta sem passar pelo CGNAT):**
   * Quando o seu celular estiver conectado no mesmo Wi-Fi do seu PC, o CGNAT da operadora não interfere! O celular acessa o servidor e o banco diretamente pelo IP local do PC (`http://192.168.X.X:3000`).
3. **Túnel HTTPS Gratuito Anti-CGNAT (Cloudflare Tunnel / `cloudflared`):**
   * Para testar no celular pelo 4G/5G ou permitir que amigos testem o seu servidor rodando no seu PC mesmo atrás de CGNAT, deixaremos um script pronto com `cloudflared tunnel`. Ele gera uma URL `https://xxxx.trycloudflare.com` (com WSS seguro compatível com o GitHub Pages!) sem precisar abrir nenhuma porta no roteador!
