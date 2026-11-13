# 📦 CHANGELOG — Etheria Campus

Todas as alterações notáveis deste projeto são documentadas neste arquivo seguindo **Semantic Versioning (`vMAJOR.MINOR.PATCH`)**.
Qualquer IA trabalhando neste repositório **DEVE** incrementar a versão e registrar suas entregas aqui antes de encerrar o turno.

---

## [v0.24.0] - 2026-11-13
### Integração dos 12 Avatares Oficiais de Personagens com Recorte de Precisão, Maximização de Enquadramento Facial e Suporte no HUD e Lobby
* **Adicionado & Integrado (`scripts/crop_character_portraits.py` & `apps/server/public/play/assets/hud/avatars/`):**
  * **Processamento dos 12 Heróis da Imagem Oficial:** Recorte de alta resolução dos 12 personagens seguindo fielmente a ordem oficial:
    1. `class_2` / `ladina.png`: Ladina (tranças espirais roxas, sorriso confiante).
    2. `class_1` / `espadachim.png`: Espadachim (cabelos prateados espetados, gola de armadura azul/rosa).
    3. `class_9` / `mago.png`: Mago (cabelos escuros, tiara dourada, manto verde cerimonial).
    4. `class_4` / `curandeira.png`: Curandeira (cabelos brancos, laço vermelho monumental com pena azul).
    5. `class_5` / `cacadora.png`: Caçadora (cabelos magenta com flor botânica tropical e olhos rubi).
    6. `class_10` / `paladino.png`: Paladino (cabelos azuis celestes, ombreira alada dourada de paladino).
    7. `class_7` / `barda.png`: Barda (chanel loiro com tiara floral, olhos violeta).
    8. `class_12` / `necromante.png`: Necromante (cabelos brancos, bandana rubi estampada e cachecol esmeralda).
    9. `class_11` / `atirador.png`: Atirador (cabelos lilás, máscara shinobi cobrindo o rosto e armadura azul marinho).
    10. `class_6` / `assassina.png`: Assassina (cabelos fúcsia com laço rosa, máscara amarela e ombreira espinhosa dourada).
    11. `class_3` / `guerreira.png`: Guerreira (coque tribal roxo com folhas, colar de ossos ancestrais e túnica verde).
    12. `class_8` / `lanceiro.png`: Lanceiro (cabelos carmesim espetados, faixa de combate e ombreira de crânio).
  * **Isolamento via BFS Flood-Fill & Anti-Halo Defringing:** Remoção de fundo branco exterior preservando 100% dos cabelos brancos (Espadachim, Curandeira, Necromante) e detalhes internos sem erosão.
  * **Maximização Concêntrica na Moldura:** Cada avatar foi enquadrado com foco na cabeça, olhos e expressão facial preenchendo 94% da área circular útil da moldura, assentado sobre um gradiente radial escuro e luxuoso (`#1f2c42` $\rightarrow$ `#070b14`).
* **Modificado & Integrado (`PlayHudController.js` & `PlayLobbyController.js` & `play_hud.css`):**
  * **HUD do Jogador:** `updatePlayer` agora carrega automaticamente a imagem oficial correspondente à classe (`/play/assets/hud/avatars/${classCode}.png`), substituindo os antigos ícones de spritesheet.
  * **Moldura de 96px com Avatar de 54px:** Diâmetro do avatar expandido para `54x54px` (`box-shadow: inset 0 2px 6px rgba(0,0,0,0.8)`), preenchendo o limite máximo da abertura sem nenhum vazamento nas asas da moldura.
  * **Lobby e Seleção de Classes:** Os cards dos personagens existentes e o grid de criação de novas classes agora exibem as ilustrações oficiais circulares com bordas douradas.
* **Auditoria de Linhas (Regra #7):**
  * `PlayHudController.js`: 852 linhas (estritamente < 1.000 linhas).
  * `PlayLobbyController.js`: 157 linhas (estritamente < 1.000 linhas).
  * `play.js`: 919 linhas.

---

## [v0.23.0] - 2026-11-13
### Moldura e Perfil do Jogador Ampliados, Botões Discretos de Recolhimento dos Docks e Joystick de Alto Contraste com Affordance de Movimento e Ação
* **Modificado & Ampliado (Perfil e Moldura do Jogador no Topo Esquerdo):**
  * **Moldura Dourada Alada Ampliada:** Redimensionada de 76x76px para `96x96px` (`.hud-avatar-wrapper`), elevando o destaque heroico do personagem na interface mobile.
  * **Foto de Perfil Real em 50x50px:** Ajustada concêntrica e precisamente na abertura óptica circular da moldura (`margin-top: -2px`), sem arestas vazadas.
  * **Conexão com as Barras de Status:** Placa integrada (`.hud-player-bars-col`) ajustada com `margin-left: -20px` para emergir debaixo da asa da moldura com tracks de HP/MP/XP em `130x14.5px` e badge de nível reposicionada na base da gema inferior.
* **Adicionado & Integrado (Botões Discretos de Recolhimento dos Menus e Atalhos):**
  * **Recolhimento dos Atalhos Esquerdos (`#hudCollapseShortcutsBtn`):** Mini aba vertical dourada (`17x42px`) anexada à direita da barra de atalhos. Ao tocar, aplica transição suave recolhendo a doca para a margem esquerda (`transform: translateX(-58px); opacity: 0; pointer-events: none;`) e alternando o glifo de `◀` para `▶`. Ao expandir, desliza de volta para a tela.
  * **Recolhimento do Menu Inferior (`#hudCollapseBottomMenuBtn`):** Mini aba horizontal dourada (`44x16px`) centralizada sobre o dock inferior. Ao tocar, recolhe os 6 botões para fora da tela (`transform: translateY(70px); opacity: 0; pointer-events: none;`) e alterna o glifo de `▼` para `▲`. Permite ao jogador desobstruir 100% da parte inferior da tela para combate e navegação.
* **Adicionado, Otimizado & Integrado (Joystick Virtual de Alto Contraste com Affordance de Ação):**
  * **Novos Assets Gráficos em Supersampling:**
    * `joystick_outer_ring.png` (256x256): Disco de fundo escuro, anel concêntrico dourado gravado e 8 chevrons direcionais luminescentes de alta visibilidade sobre grama, areia, masmorras ou água.
    * `joystick_center_interact.png` (180x180): Botão 3D dourado/âmbar com anel recartilhado de pegada, 4 setas internas e balão de fala/interação `💬` em alto relevo.
  * **Halo de Contraste e Badge Informativa:**
    * Adicionado `.hud-joystick-glow-halo` com gradiente radial escuro e halo dourado para contraste absoluto em qualquer terreno.
    * Adicionada badge flutuante `.hud-joystick-hint-badge` com o texto `● MOVER | AÇÃO 💬` informando com clareza imediata que o controle serve tanto para movimentação direcional quanto para interação.
    * Dial ampliado para `154x154px` e botão central para `74x74px` com animação sutil de pulso `joystickPulse`.
  * **Diferenciação Robusta Arraste vs. Clique:** Inserida trava de arraste (`this.joystickDragged`) para assegurar que movimentar o joystick nunca dispare ações acidentais de interação no momento em que o dedo é liberado.
* **Auditoria de Linhas (Regra #7):**
  * `PlayHudController.js`: 847 linhas (estritamente < 1.000 linhas).
  * `PlayMapModalController.js`: 402 linhas.
  * `play.js`: 919 linhas.

---

## [v0.22.0] - 2026-11-13
### Refinamento da HUD Mobile: Dock Inferior Unificado com Ícones Homogêneos, Atalhos Elegantes sem Mocks, Cabeçalho Integrado, Minimapa Ampliado e Modais de Mapa Local/Mundo
* **Adicionado & Integrado (`PlayMapModalController.js` - 402 linhas):**
  * **Mapa Local Expandido com NPCs:** Toque no mini mapa abre o modal `#hudExpandedMapModal` exibindo o mapa atual em alta resolução com o pino pulsante do jogador (`🟢 Você`), todos os NPCs do mapa plotados com pin de diálogo `💬` e coordenadas, portais com `🌀` e gaveta inferior de chips de NPCs com scroll suave até o alvo.
  * **Mapa Mundo Geral dos Continentes:** Botão `🗺️ Mapa Mundo` abre o modal `#hudWorldMapModal` consumindo o novo endpoint `/api/play/world-maps`. Renderiza abas dos continentes (ex: Continente 1 e Continente 2), imagem base limpa, logotipo Etheria Campus, linhas de rotas em SVG e nós de pontos com destaque em beacon dourado (`📍 VOCÊ ESTÁ AQUI`) para o setor onde o jogador está. Botão de retorno rápido ao mapa local.
* **Modificado & Otimizado (Menu Inferior & Atalhos):**
  * **Dock Inferior Unificado (`.hud-bottom-dock`):** Eliminado o espaçamento transparente desconexo entre os ícones. Os 6 botões de menu agora ficam abrigados em uma barra console com moldura dourada e fundo escuro refinado.
  * **Tamanho 100% Homogêneo:** Removida a disparidade de tamanho entre a mochila e os demais ícones; todos os 6 botões foram padronizados rigorosamente em `46x46px`.
  * **Dock de Atalhos Rápidos da Esquerda (`.hud-shortcuts-dock`):** Removidas as poções fictícias. Os 6 slots agora iniciam vazios e numerados (`1` a `6`), com gravação ornamental `❖` e molduras com relevo radial, sem gaps flutuantes transparentes.
* **Modificado & Posicionado (Cabeçalho & Minimapa):**
  * **Perfil e Barras Colados Harmoniosamente:** O avatar alado agora se conecta diretamente à placa das barras de HP/MP/XP (`margin-left: -14px`), com as barras emergindo suavemente por trás da asa dourada da moldura. Seção encolhida à esquerda (`left: 6px; top: 8px;`).
  * **Minimapa Ampliado:** Redimensionado de 106px para `126x126px` (canvas de `78x78px` com resolução interna de 160x160 para nitidez em telas retina), botão de engrenagem de 34px e coordenadas centralizadas.
* **Endpoint de Servidor (`PlayRouter.ts`):**
  * Adicionado `GET /api/play/world-maps` com autenticação de sessão do jogador para entrega dos dados de continentes, rotas e pontos cadastrados em `world_map_templates`.
* **Auditoria de Linhas (Regra #7):**
  * `PlayHudController.js`: 806 linhas.
  * `PlayMapModalController.js`: 402 linhas.
  * `play.js`: 919 linhas.
  * `PlayRouter.ts`: 410 linhas.

---

## [v0.21.0] - 2026-11-13
### Integração dos Assets Gráficos Oficiais da HUD do Jogador com Recorte de Precisão, Transparência RGBA e Aberturas Ópticas
* **Adicionado & Integrado (`scripts/crop_hud_assets.py` & `apps/server/public/play/assets/hud/`):**
  * **Recorte Computacional de Precisão Subpixel:** Processamento das 2 imagens oficiais enviadas pelo usuário (`media_1794587354286_e7e3e630.jpg` e `media_1794587355904_97ef9782.jpg`) utilizando Pillow e NumPy.
  * **Matte Alpha e Defringing:** Remoção de fundo branco exterior através de BFS flood-fill conectado (preservando brancos e reflexos internos nos metais, pergaminhos e listras da barraca), com unmultiplication para eliminação completa de halos brancos sobre qualquer superfície.
  * **Abertura Central (Aperture) nas Molduras:**
    * `minimap_frame.png`: Abertura circular no centro da bússola com antialiasing para exibição transparente e contínua do canvas do mini mapa/radar dinâmico.
    * `player_avatar_frame.png`: Abertura circular no centro do brasão alado para enquadramento perfeito da foto real do personagem/classe.
  * **9 Assets Oficiais Exportados e Integrados:**
    1. `menu_shop.png` (Banca de mercado com baú de moedas de ouro).
    2. `menu_pets.png` (Medalhão de ouro com pata e gemas coloridas).
    3. `menu_character.png` (Elmo de cavaleiro alado sobre brasão azul).
    4. `menu_inventory.png` (Mochila de aventureiro em couro com fivelas).
    5. `menu_quests.png` (Pergaminho de missões com selo de cera vermelho e fitas).
    6. `menu_events.png` (Caixa de presente festiva com laço dourado e partículas de confete).
    7. `settings_gear_icon.png` (Engrenagem dourada com gema azul central para configurações).
    8. `minimap_frame.png` (Moldura circular ornamental de bússola dourada com asas e gemas).
    9. `player_avatar_frame.png` (Moldura circular alada com topo rubi e gema inferior).
* **Modificado & Ajustado (`play_hud.css` & `PlayHudController.js`):**
  * `.hud-avatar-wrapper` e `.hud-avatar-img`: Redimensionamento concêntrico (78x78px / 40x40px) para que a foto do jogador fique perfeitamente selada dentro da janela da moldura alada, sem arestas vazadas.
  * `.hud-minimap-wrapper` e `#hudMinimapCanvas`: Redimensionamento proporcional (106x106px / 64x64px) com canvas centralizado sob a bússola dourada e botão da engrenagem alinhado no canto superior.
  * `.hud-bottom-menu-section`: Ícones com transparência pura, drop-shadow dinâmico e mochila destacada ao centro em layout mobile vertical.
  * `PlayHudController.js`: Fallback inicial do avatar atualizado de `player_avatar_frame.png` para `menu_character.png`.
* **Deploy & Validação Live no VPS Azure (`40.65.63.193`):**
  * Sincronizado via Git e deploy automatizado no VPS com serviço `etheria-campus.service` ativo (`HTTP 200`).
  * Inspeção e captura de viewport em mobile portrait (390x844px) realizadas com sucesso no Chrome DevTools MCP.

---

## [v0.20.1] - 2026-11-13
### Refinamento do Combate: Priorização de Ataque sobre Joystick, Perseguição Automática (Estilo LoL) & Retículo Visual de Alvo
* **Modificado & Otimizado (Prioridade de Ataque sobre Joystick):**
  * Corrigido o cancelamento prematuro de ataque durante a locomoção com o joystick virtual. O toque em ataque ou habilidade agora assume **prioridade total** sobre o movimento contínuo: o personagem planta os pés durante o Windup (~0.18s), executa o disparo no Cast Point e retoma automaticamente a locomoção na direção do joystick no Backswing (Kiting tátil e responsivo).
* **Adicionado (Modo de Perseguição Automática ao Alvo fora de Alcance - Estilo LoL):**
  * Ao solicitar um auto-ataque ou habilidade em um alvo que esteja além do alcance máximo, o jogo não exibe mais "FORA DE ALCANCE". Em vez disso, o motor ativa o modo `startApproach`, direcionando o personagem suavemente até o alvo e disparando o ataque no exato milissegundo em que entrar na distância válida.
* **Adicionado & Renderizado (Identificação Visual Completa do Alvo Travado):**
  * **Retículo Dinâmico no Solo:** Desenhado sob os pés do monstro focado com anel pulsante carmesim (`rgba(239, 68, 68, 0.90)`), sombra âmbar e 4 pips de mira em cruz giratória.
  * **Indicador Aéreo de Foco:** Chevron tridimensional `▼` com animação vertical flutuante sobre a cabeça do alvo.
  * **Barra de Vida Destacada:** Contorno dourado brilhante (`#f59e0b`), barra amarela de foco e prefixo `🎯 [Nome]` no topo da criatura.
  * **Anel de Alcance do Jogador:** Anel circular tracejado sutil (`rgba(56, 189, 248, 0.20)`) indicando com precisão o raio de ação ofensiva do personagem.
  * **Toque Direto em Monstros:** Área de toque ampliada na tela para seleção tátil de alvos na arena mobile.
* **Auditoria de Linhas (Regra #7):**
  * `ActionMotionEngine.js`: 534 linhas.
  * `ActionCombatArena.js`: 965 linhas.
  * `ActionSkillEngine.js`: 683 linhas.
  * `ActionVfxRenderer.js`: 371 linhas.
  * `play.js`: 920 linhas.
  * `ArenaPhysicsSolver.js`: 471 linhas.

---

## [v0.20.0] - 2026-11-13
### Motor de Combate Fluido (Action MOBA Engine): 5 Fases de Fluidez, Ciclo de Ataque Tríplice (Windup, Cast Point, Backswing Cancel / Kiting), Desacoplamento de Mira, Input Buffering, Cinemática com Deslize Vetorial e Auto-Attack Resets
* **Adicionado & Integrado (`ActionMotionEngine.js` - 478 linhas):**
  * **Fase 1: Ciclo de Ataque Tríplice:** Divisão do ataque em **Windup** (preparação pré-ataque proporcional a `attackSpeed`), **Cast Point** (momento exato onde o projétil/dano nasce) e **Backswing** (recuperação pós-disparo). Projéteis nunca mais nascem no frame zero.
  * **Fase 1: Orb-Walking & Kiting:** Cancelamento imediato do backswing por qualquer ordem de movimento ou habilidade assim que o Cast Point é atingido, permitindo que o jogador se mova livremente enquanto o projétil viaja pelo ar sem perder cadência de dano.
  * **Fase 2: Desacoplamento de Mira e Facing Lock:** O personagem trava a rotação e postura de frente para o alvo durante o Windup e Cast Point (`facingDir`), impedindo terminantemente que o loop de física sobrescreva a direção com o vetor de corrida (`vx, vy`). Adeus tiros de costas!
  * **Fase 3: Input Buffering (Janela de Tolerância de 160ms):** Cliques de auto-ataque, skills (1 a 4) e dash realizados em micro-intervalos de cooldown ou recuperação são enfileirados em buffer e executados no primeiro frame livre, eliminando cliques perdidos e engasgos de comando.
  * **Fase 4: Cinemática Suave e Deslize Vetorial Contínuo (`ArenaPhysicsSolver.moveWithContinuousSlide`):**
    * Adicionada aceleração progressiva (`ACCELERATION_RATE = 24.0`) e desaceleração suave (`DECELERATION_RATE = 28.0`) via lerp responsivo.
    * Substituído o bloqueio axial seco por **projeção tangencial de velocidade na normal da elipse da arena e em obstáculos** (`v_tangent = v - (v · normal) * normal`), permitindo deslize fluido ao longo de bordas sem prender o personagem.
  * **Fase 5: Auto-Attack Resets e Combos Mecânicos:** Dash e habilidades instantâneas agora reiniciam o temporizador de auto-ataque e cancelam o backswing, habilitando combos fluidos de alto teto de habilidade motora (`Auto-Ataque -> Cast Point -> Dash -> Auto-Ataque Imediato`).
* **Modularização & Arquitetura (Regra #7):**
  * `ActionMotionEngine.js`: 478 linhas.
  * `ActionCombatArena.js`: 961 linhas (refatorado e mantido estritamente abaixo de 1.000 linhas).
  * `ActionSkillEngine.js`: 683 linhas.
  * `ArenaPhysicsSolver.js`: 471 linhas.
* **Testes & Validação:**
  * Teste unitário completo em `tests/test_action_motion_engine.mjs` cobrindo as 5 fases com 100% de sucesso.

---

## [v0.19.0] - 2026-11-13
### Revisão da Tabela de Equipamentos e Armas: Atributos Exclusivos de Combate, Remoção de Preço em Ouro & Layout Adaptativo
* **Modificado & Refinado (Atributos Exclusivos de Combate na Arena Action):**
  * Equipamentos e armas configurados para conceder **exclusivamente bônus diretos de combate** (`combatStatBonusesJson`), sem bônus de atributos base (`baseStatBonusesJson: {}`).
  * Modal reformulado com 16 atributos de combate divididos em 4 famílias intuitivas:
    * ⚔️ **Poder Ofensivo & Alcance:** Ataque Físico (`PHYS_ATK`), Ataque Mágico (`MAG_ATK`), Poder de Cura (`HEAL_POWER`), Alcance do Ataque (`ATTACK_RANGE`).
    * 🛡️ **Sobrevivência & Sustentação:** Vida Máxima (`MAX_HP`), Mana Máxima (`MAX_MP`), Defesa Física (`PHYS_DEF`), Defesa Mágica (`MAG_DEF`).
    * ⚡ **Velocidade & Crítico:** Vel. Batalha (`BATTLE_MOVE_SPEED`), Vel. Ataque (`ATTACK_SPEED`), Taxa Crítica (`CRIT_RATE`), Dano Crítico (`CRIT_DMG`).
    * 🎯 **Precisão & Esquiva:** Precisão Física (`PHYS_ACCURACY`), Esquiva Física (`PHYS_EVASION`), Precisão Mágica (`MAG_ACCURACY`), Esquiva Mágica (`MAG_EVASION`).
* **Removido (Valor em Moedas de Ouro):**
  * Campo de preço em ouro (`priceGold`) removido do formulário de cadastro/edição, da tabela desktop e dos cards móveis (equipamentos não serão comercializados pelo jogo).
* **Adicionado & Aprimorado (Layout Adaptativo Mobile Vertical e Desktop):**
  * **Visão Desktop:** Tabela ampla e limpa sem colunas obsoletas de ouro ou atributos base, com coluna dedicada destacando todos os bônus de combate ativos em tags coloridas.
  * **Visão Mobile Vertical:** Grid adaptativo de cards touch-friendly (`.equipment-mobile-card`) otimizado para celulares em modo retrato (`@media (max-width: 860px)`), com botões com área de toque mínima de 42px, tags estilizadas de slot e bônus de combate em destaque.
  * Barra de busca rápida em tempo real por nome/código/lore e filtros instantâneos por **Slot de Equipamento**, **Categoria** (Personagem / Pet) e **Raridade**.
* **Arquitetura Modular (Regra #7):**
  * Modal desacoplado no submódulo [`AdminEquipmentModalDom.js`](file:///C:/Users/Dell/.gemini/antigravity/scratch/etheria-campus/apps/server/public/admin/js/AdminEquipmentModalDom.js) (238 linhas) e lógica central em [`AdminEquipmentsTab.js`](file:///C:/Users/Dell/.gemini/antigravity/scratch/etheria-campus/apps/server/public/admin/js/AdminEquipmentsTab.js) (637 linhas), mantendo ambos estritamente abaixo do limite de 1.000 linhas.

## [v0.18.0] - 2026-11-13
### Revisão Profunda da Tabela de Monstros: Atributos Base de Combate & Layout Adaptativo Mobile Vertical e Desktop
* **Adicionado & Integrado no Banco de Dados (Schema & Snapshot):**
  * Campo `baseCombatAttributesJson Json? @default("{}") @map("base_combat_attributes_json")` adicionado ao model `MonsterTemplate` em `packages/database/prisma/schema.prisma`.
  * Sincronização em `packages/database/src/SnapshotManager.ts` garantindo preservação de atributos de combate na exportação/importação de snapshots JSON para o Git.
* **Adicionado (Edição Completa de Atributos Base de Combate de Monstros):**
  * Novos campos de configuração no modal de Monstros (`AdminMonsterModalDom.js`):
    * 🏃 **Velocidade de Movimento em Batalha (`BATTLE_MOVE_SPEED`):** padrão 160 px/s (80 a 400 px/s).
    * ⚔️ **Velocidade de Ataque (`ATTACK_SPEED`):** padrão 1.0 atks/s (0.2 a 3.5 atks/s).
    * 💥 **Taxa de Crítico (`CRIT_RATE`):** padrão 5% (0 a 80%).
    * ⚡ **Dano Crítico (`CRIT_DMG`):** padrão 150% (100 a 300%).
    * 🎯 **Precisão Física (`PHYS_ACCURACY`):** padrão 95% (20 a 125%).
    * 💨 **Esquiva Física (`PHYS_EVASION`):** padrão 5% (0 a 75%).
    * 🔮 **Precisão Mágica (`MAG_ACCURACY`):** padrão 95% (20 a 125%).
    * ✨ **Esquiva Mágica (`MAG_EVASION`):** padrão 5% (0 a 75%).
  * Backend (`MonsterCombatBuilder.ts` e `AdminMonstersController.ts`) integrado para aplicar `BATTLE_MOVE_SPEED` como piso não-derivado antes do escalonamento de AGI e ler `ATTACK_SPEED`, precisões e esquivas diretamente nas batalhas in-game e simuladas.
* **Adicionado & Aprimorado (Layout Adaptativo Mobile Vertical e Desktop):**
  * **Visão Desktop:** Tabela ampla e elegante com coluna dedicada de **Atributos de Combate** exibindo Velocidade de Movimento, Velocidade de Ataque, Crítico, Precisão e Desvio ao lado dos Atributos Base e Drops.
  * **Visão Mobile Vertical:** Grid adaptativo de cards touch-friendly (`.monster-mobile-card`) otimizado para celulares em modo retrato (`@media (max-width: 860px)`), com botões de toque generosos (`min-height: 42px`), chips de raça, elemento, estilo e estatísticas em destaque.
  * Barra de busca rápida em tempo real por nome/código/lore e filtros instantâneos por **Rank de Raridade** (SS a F) e **Elemento**.
* **Arquitetura Modular (Regra #7):**
  * Modal desacoplado no submódulo [`AdminMonsterModalDom.js`](file:///C:/Users/Dell/.gemini/antigravity/scratch/etheria-campus/apps/server/public/admin/js/AdminMonsterModalDom.js) (307 linhas) e lógica central em [`AdminMonstersTab.js`](file:///C:/Users/Dell/.gemini/antigravity/scratch/etheria-campus/apps/server/public/admin/js/AdminMonstersTab.js) (842 linhas), mantendo ambos rigorosamente abaixo do limite mandatório de 1.000 linhas.

## [v0.17.0] - 2026-11-12
### Mapas Gerais: Criação Livre de Pontos e Linhas, Vínculo com Mapas & Layout Mobile Vertical
* **Modificado & Limpo (Pontos e Linhas Anteriores Excluídos):**
  * Pontos e rotas prévios excluídos em ambos os continentes no PostgreSQL e no snapshot oficial (`lowcode.snapshot.json`).
  * `AdminWorldMapsSeeds.ts` atualizado com arrays vazios (`pointsJson: []`, `routesJson: []`), deixando a tela limpa para o administrador desenhar seu próprio mundo.
* **Adicionado (Sistema Interativo Livre de Criação & Edição de Pontos e Ligações):**
  * **Modo Selecionar / Mover (`SELECT`):** Clicar em qualquer ponto para inspecionar, editar ou arrastar livremente pelo mapa em tempo real com atualização contínua de coordenadas e linhas conectadas.
  * **Modo Criar Ponto (`ADD_POINT`):** Clique direto em qualquer coordenada do mapa para criar instantaneamente um novo ponto com auto-incremento de ID, seleção imediata e foco no formulário de nome e vínculo de mapa.
  * **Modo Criar Ligação (`CONNECT`):** Clique no ponto de origem e em seguida no ponto de destino para traçar a rota vetorial entre eles com suporte a encadeamento sequencial e linha guia de orientação.
  * **Modo Excluir (`DELETE`):** Exclusão com um clique diretamente no ponto (removendo também todas as linhas associadas) ou exclusão de rotas individuais clicando nas linhas do mapa.
  * **Botão "Limpar Todos":** Permite resetar todos os pontos e rotas do continente selecionado com diálogo de confirmação.
* **Adicionado (Inspetor de Ponto & Vínculo com GameMap):**
  * Edição de nome/rótulo customizado no mapa.
  * Destacar ponto como Cidade/Vila Principal (`isCity = true`, com halo dourado e proporções maiores) ou Campo/Região de Passagem.
  * Vínculo a mapas existentes da Tabela de Mapas com busca e filtro em tempo real por nome/ID.
  * Lista de ligações ativas do ponto com botão de remoção rápida `✕` para cada rota conectada.
* **Adicionado & Aprimorado (Layout Mobile Vertical & Modularização):**
  * Layout responsivo em coluna única (`@media (max-width: 960px)`) com botões de toque generosos (`min-height: 38px`), mantendo o mapa no topo e painéis empilhados verticalmente no mobile.
  * Controles de Zoom in/out e Reset (`100%`) no mapa para edição cirúrgica em telas móveis verticais.
  * Divisão estrita em responsabilidade única com o submódulo [`AdminWorldMapsDom.js`](file:///C:/Users/Dell/.gemini/antigravity/scratch/etheria-campus/apps/server/public/admin/js/AdminWorldMapsDom.js) e [`AdminWorldMapsTab.js`](file:///C:/Users/Dell/.gemini/antigravity/scratch/etheria-campus/apps/server/public/admin/js/AdminWorldMapsTab.js), mantendo ambos rigorosamente abaixo do limite de 1.000 linhas da Regra #7.

## [v0.16.0] - 2026-11-12
### Interface Principal do Jogador Mobile Portrait (HUD Fiel à Referência & Modular)
* **Adicionado (Assets Gráficos em `apps/server/public/play/assets/hud/`):**
  * Moldura ornamental circular do avatar do personagem (`player_avatar_frame.png`).
  * Moldura ornamental de bússola para o minimapa (`minimap_frame.png`).
  * Ícone discreto de engrenagem para configurações (`settings_gear_icon.png`).
  * Moedas de Ouro (`gold_coin_icon.png`) e Cristais mágicos facetados (`crystal_gem_icon.png`).
  * Botão de interação central com balão de fala (`joystick_center_interact.png`) e anel de bússola (`joystick_outer_ring.png`).
  * Moldura de avatar dos pets (`pet_avatar_frame.png`) e slots de atalho (`shortcut_slot_bg.png`).
  * 6 Ícones dos botões de menu inferior sem texto (`menu_shop.png`, `menu_pets.png`, `menu_character.png`, `menu_inventory.png`, `menu_quests.png`, `menu_events.png`).
  * 6 Ícones de itens de atalho (`shortcut_potion_hp.png`, `shortcut_potion_mp.png`, `shortcut_food_bread.png`, `shortcut_scroll_teleport.png`, `shortcut_potion_antidote.png`, `shortcut_potion_buff.png`).
* **Adicionado & Integrado (`PlayHudController.js` & `play_hud.css`):**
  * **Controlador Modular:** Arquitetura orientada a objetos gerenciando posição, visibilidade, estado dos pets e binding de dados reativo.
  * **Topo-Esquerdo:** Avatar do jogador (recorte circular da thumb do personagem + moldura dourada), Nível, barras estilizadas de HP/MP/XP com gradiente e contadores de Ouro e Cristal.
  * **Topo-Direito:** Mini Mapa dinâmico em tempo real exibindo a fatia do mapa centrada no jogador com marcador ciano direcional, coordenadas dinâmicas e engrenagem de configurações.
  * **Lateral Esquerda:** Coluna vertical com 6 slots de atalho rápido para uso de poções e itens.
  * **Lateral Direita:** HUD de pets equipados com regra estrita: exibida SOMENTE quando houver pet equipado (0 oculto, 1, 2 ou 3).
  * **Canto Inferior Direito:** Joystick virtual analógico com dial bússola e botão de interação central para NPCs, portais e ações.
  * **Barra Inferior:** 6 botões de menu sem texto com ícones destacados e feedback tátil.
* **Integrado no Backend (`GamePlayController.ts` & `AssetMirrorService.ts`):**
  * Inclusão e serialização de `pets` no bootstrap do jogador e inclusão dos 21 assets da HUD no manifesto de download local (`/api/play/assets-manifest`).

---

## [v0.15.0] - 2026-11-12
### Arquitetura Sagrada de Assets: Isolamento Estrito Client-Servidor & Espelhamento Automático no Salvar
* **Arquitetura & Governança de Assets (`AGENTS.md` Cláusula 10, `docs/ARCHITECTURE.md`, `docs/HANDOFF.md`):**
  * **Papel Estrito do GitHub (`mcrework`):** O repositório remoto no GitHub funciona exclusivamente como catálogo/galeria de autoria para a rota `/admin` durante a navegação, seleção e edição de entidades.
  * **Instalação Imediata no Servidor ao Salvar:** No momento em que o admin salva qualquer registro nas tabelas do banco de dados, o servidor imediatamente baixa e instala os assets vinculados no disco local da VPS (`apps/server/cache/mcrework/`), caso ainda não estejam em cache.
  * **Isolamento Total do Client (`/play`):** O cliente do jogo comunica-se estrita e exclusivamente com o servidor do jogo (`/api/assets/*`, `/api/play/*`), com zero tráfego direto para o GitHub.
  * **Comunicação do Admin (`/admin`):** O `/admin` comunica-se com o servidor para persistência e dados, consultando o GitHub apenas para listar as miniaturas das galerias de escolha.
* **Implementado (Gatilhos Automáticos de Espelhamento em todos os Controladores Admin):**
  * **`AssetMirrorService.ts`:** Novos métodos de espelhamento dedicados: `mirrorMapImage`, `mirrorClassAssets`, `mirrorNpcAssets`, `mirrorMonsterAssets`, `mirrorPetAssets`, `mirrorMountAssets`, `mirrorItemIcon` e `mirrorSkillOrEffectAssets`.
  * **Gatilhos em Controladores:** `AdminMapsController` (mapas, classes, NPCs), `AdminMonstersController`, `AdminPetsController`, `AdminFlyingMountsController`, `AdminEquipmentsController`, `AdminItemsController` e `AdminSkillsController` disparam o espelhamento de disco local imediatamente ao criar ou atualizar entidades.
  * **Injeção de Dependências:** Instância singleton de `AssetMirrorService` injetada nos controladores em `apps/server/src/index.ts`.

---

## [v0.14.0] - 2026-11-12
### Limite Estrito de Bordas do Mapa e Câmera (Zero Área Preta), Imunidade Anti-Loop de Portais & Download Local de Assets
* **Corrigido & Aprimorado (Câmera & Bordas do Mapa em `/play`):**
  * **Trava de Câmera nas Bordas (`play.js`):** `camX` e `camY` passam a ser estritamente limitados à área da imagem (`[canvas.width - mapW * zoom, 0]` e `[canvas.height - mapH * zoom, 0]`), ou perfeitamente centralizados caso o mapa renderizado seja menor que a janela do navegador. Eliminação completa de faixas pretas ou visão do vazio ao redor dos mapas.
  * **Trava de Movimento nas Bordas (`play.js` & `ClientPolygonMesh.js`):** O personagem e o destino do clique agora são travados dentro dos limites reais da imagem (`[18, mapWidth - 18]` e `[20, mapHeight - 18]`), e `ClientPolygonMesh.isPointBlocked(x, y)` bloqueia ativamente qualquer coordenada externa, impedindo que o jogador caminhe no vazio fora da imagem.
* **Corrigido (Travessia de Portais & Eliminação de Bouncing/Loop):**
  * **Ponto Seguro de Aterrissagem (`GamePlayController.traversePortal`):** Ao atravessar um portal, o personagem não mais nasce exatamente em cima do portal de destino; o servidor projeta um ponto seguro afastado da área de ativação (na direção do spawn/centro do mapa) fora de colisões e retorna `arrivedAtPortalId`.
  * **Imunidade de Chegada & Exigência de Afastamento (`play.js`):** O portal de aterrissagem fica imune e desabilitado para o jogador recém-chegado até que ele dê passos e saia fisicamente de seu raio (`arrivedAtPortalId = null`), somado a um cooldown inicial de 5.000ms após o mapa carregar. Rejeição de updates desatualizados de `syncPosition` durante a transição.
* **Adicionado (Cache Persistente na VPS & Download no Client):**
  * **`AssetMirrorService.ts` (`apps/server/src/controllers/AssetMirrorService.ts`):** Servidor agora espelha e grava todos os assets curados em disco local permanente (`apps/server/cache/mcrework/`), servindo mapas (`/api/assets/map-image/:id`), sprites, VFX e ícones (`/api/assets/mcrework/assets/...`) com latência de 0ms e cabeçalhos `Cache-Control: public, max-age=31536000, immutable`.
  * **Download Manager no Client (`PlayAssetDownloader.js`):** Endpoint `/api/play/assets-manifest` e gerenciador com barra de progresso no Lobby do jogo (`#lobbyScreen`) utilizando a `CacheStorage` API do navegador (`caches.open('etheria-campus-assets-v1')`), permitindo baixar todos os arquivos para o dispositivo do jogador, eliminando dependência do GitHub, falhas de rede e mapas pretos.

---

## [v0.13.0] - 2026-11-12
### Mapas Gerais dos Continentes (Tabela Mundo `/admin`), Pontos Vinculáveis a Mapas & Logo Transparente Ajustável
* **Adicionado (Banco de Dados & Assets):**
  * **`WorldMapTemplate` (`schema.prisma`, `SnapshotManager.ts`):** Nova tabela `world_map_templates` com backup/restauração automática no `SnapshotManager`, armazenando imagem limpa do continente, camada separada de pontos/rotas (`pointsJson`, `routesJson`), visibilidade das camadas e geometria configurável do logo (`logoX`, `logoY`, `logoWidth`, `logoHeight`, `logoVisible`).
  * **Assets Limpos (`apps/server/public/assets/worldmap/`):** Instalados `world_map_1_base.png` (`1264x848`), `world_map_2_base.png` (`1264x848`) sem textos/logos/linhas originais e `etheria_campus_logo.png` (`640x438`) com fundo branco removido em transparência RGBA limpa.
* **Adicionado (API & Estúdio `/admin`):**
  * **`AdminWorldMapsController.ts`, `AdminWorldMapsSeeds.ts`, `AdminRouter.ts`:** Rotas `GET/POST /api/admin/world-maps` protegidas pela permissão `MAPS`, inicializando os 2 continentes com 44 + 8 pontos e 49 + 3 rotas calibradas e retornando os `GameMap` reais cadastrados para vínculo.
  * **`AdminWorldMapsTab.js`, `AdminAuth.js`, `admin/index.html`:** Nova aba **`🌍 Mapas Gerais`** no `/admin` com visualização interativa dos 2 continentes, camadas independentes (Base, Linhas SVG, Pontos e Logo), seleção de qualquer ponto para vincular/desvincular mapas existentes da Tabela de Mapas (com rótulo opcional e filtro rápido), e manipulação direta do logotipo `Etheria Campus` (arrastar, redimensionar pelo canto `↘`, slider e coordenadas exatas X/Y).

---

## [v0.12.0] - 2026-11-12
### Arsenal Completo No-Code de Habilidades Action (12 Classes / 48 Skills), Buffs/Debuffs & Arena 4 Slots
* **Adicionado & Expandido (Schema + Backend + Calculadora Compartilhada):**
  * **`CombatDamageCalculator` (`packages/shared/src/CombatDamageCalculator.ts`):** Adicionados `armorPenPct` (`PHYS_PEN` / `MAG_PEN`), `ignoreEvasion` (disparo inesquivável), `flatCritRateBonus` e `bonusDamageMultiplier`.
  * **`SkillTemplate` & `StatusEffectTemplate` (`schema.prisma`, `AdminSkillsController.ts`):** Novos campos `coneAngleDeg`, `lineWidthPx`, `groundZoneDurationSec`, `groundZoneTickSec`, `ignoreEvasion`, `statusCategory` (`BUFF`, `HARD_CC`, `ANOMALY`, `SLOW`) e `breakOnDamage`.
  * **`TemporaryCombatController.ts` & `MonsterCombatBuilder.ts`:** Unidades carregam `physAtk`, `magAtk`, `healPower`, `classSkills` (Slots `#1..#4`), `skillCatalog` e `statusCatalog` para o motor Action.
* **Adicionado (Estúdio `/admin` Low/No-Code):**
  * **`AdminSkillBlocksEditor.js` & `AdminSkillsModalDom.js` & `AdminSkillsAndBuffsTab.js`:** Suporte completo para movimentos Action (`DASH_LINEAR`, `LEAP_AOE`, `TELEPORT_BACKSTAB`), geometrias (`CONE_FRONTAL`, `LINE_PIERCE`, `AOE_SELF_AROUND`, `AOE_CIRCLE`, `GROUND_ZONE`, `ALLY_LOWEST_HP_PCT`), fórmulas compostas (2º escalador opcional com `PHYS_ATK`, `MAG_ATK`, `HEAL_POWER`, `PHYS_DEF`, `MAG_DEF`, `MAX_HP`, `MAX_MP`), editor completo de `SHIELD`, bloco `RESOURCE_COOLDOWN`, `armorPenPct`, `lifestealPct`, bônus por anomalia no alvo, execução por `% HP`, redução de CD no crítico, cura por inimigo atingido e `Cleanse` tipado (`HARD_CC_AND_DOT`, `SLOW`, `HARD_CC`, `ANOMALY_DOT`).
  * **`AdminStatusEffectsTab.js` & `AdminArenaPreview.js`:** Construtor dinâmico de 23 modificadores de atributos (`ATTACK_SPEED_PCT`, `BATTLE_MOVE_SPEED_PCT`, `PHYS/MAG_EVASION_PCT`, `PHYS/MAG_ACCURACY_PCT`, `CRIT_RATE/DMG_PCT`, `PHYS/MAG_PEN_PCT`, `ATTACK_RANGE_FLAT`, `CONTROL_RESIST_PCT`, `HEAL_RECEIVED_PCT`, `REFLECT_MELEE_PCT`, `EXTRA_MP_COST_PCT`, etc.), 9 Controles de Grupo (`STUN`, `PARALYSIS`, `SILENCE`, `FREEZE`, `CONFUSION`, `SLEEP`, `TAUNT`, `SLOW`, `BLIND`), DoT/HoT multi-escalador e contra-efeito reativo (`ON_HIT_TAKEN`).
* **Adicionado (Combate Action `/play`):**
  * **`ActionSkillEngine.js`, `ActionVfxRenderer.js`, `ActionCombatArena.js`, `ArenaUnitAiController.js` e `play/index.html`:** Barra/teclas de **4 Slots de Habilidade da Classe (`1–4`)**, execução em tempo real de todas as geometrias/movimentos Action, zonas persistentes no solo, escudos absorventes, VFX animados do `mcrework` recolorizados (`VfxColorProcessor`) e ícones de Buffs/Debuffs com stacks acima das unidades.

---

## [v0.11.0] - 2026-11-12
### Correção de Bugs na Tabela de Itens, Duplicação de Item, Itens Não Comercializáveis, Passivos & Stack Padrão 999
* **Corrigido (`AdminItemsTab.js` & `AdminItemsController.ts`):**
  * **Blindagem contra sobrescritas na edição de itens:** Removido comportamento em que clicar num ícone da galeria `mcrework` sobrescrevia `categoria`, `efeito`, `alvo`, `maxStack` e `priceGold` durante a edição/criação, bem como o fallback forçado de `effectType || 'HEAL_HP'` em itens passivos.
  * **Ordenação estável & proteção de `i18n`:** Listagem de itens ordenada de forma determinística por `id ASC` (evitando embaralhamento de linhas ao alterar `requiredLevel`), validação prévia de unicidade de `code` antes do `upsert` de traduções `i18n` (impedindo colisão cruzada entre itens), trava anti-duplo clique em `saveItemTemplate`, índice seguro na galeria (`selectMcreworkItemByIndex`) e remoção do teto artificial `max="100"` em `requiredLevel`.
* **Adicionado:**
  * **Duplicar Item (`openDuplicateItemModal`):** Botão `📋 Duplicar` por linha na tabela de itens abrindo o modal pré-preenchido como novo cadastro (`Nome (Cópia)`, código inédito auto-gerado) sem afetar o item original.
  * **Itens Não Comercializáveis (`ItemTemplate.isTradable` em `schema.prisma`):** Opção `Comercializável?` no modal de itens que desabilita e zera o preço em ouro quando marcado como `Não Comercializável`, exibindo `🚫 Não comercializável` na tabela.
  * **Modo Passivo / Recurso / Crafting:** Efeito `NONE` (`Sem Efeito Ativo`) e `MATERIAL`/`QUEST_ITEM` desabilitam automaticamente valor numérico, tempo de recarga e alvo (`0` / `NONE`).
  * **Stack Padrão `999`:** `maxStack` padronizado em `999` no `schema.prisma`, `AdminItemsController.ts` e `AdminItemsTab.js`.

---

## [v0.10.1] - 2026-11-11
### Spawn Proporcional de Monstros por Combatentes Aliados & Textos Flutuantes Discretos sem Emoji
* **Adicionado / Modificado (`TemporaryCombatController.ts`):**
  * **Nova Regra Matematica de Spawn em Batalha:**
    * **Jogador Solo sem Pet (1 aliado):** Gera de `1 a 7` monstros.
    * **Jogador + 1 Pet (2 aliados):** Gera de `3 a 10` monstros.
    * **Combatentes Adicionais (Party / Pets extras alem da base de 2):** Soma `+1 a 3` monstros por modelo extra (+1 no minimo, +2 no maximo). Exemplo pratico do usuario (3 pets + 2 jogadores = 5 aliados, 3 extras): `3 + 3*1 = 6` a `10 + 3*2 = 16` monstros sorteados.
    * **Remocao de Pets Ficticios:** Removido o fallback forcado que injetava `pet_comp_0`/`pet_comp_1` quando o jogador nao possuia pets, viabilizando combate 100% solo real.
    * **Teto Expandido:** Suporte ampliado para ate 25 monstros simultaneos em combate com distribuicao espacial eliptica e colisao fisica.
* **Refatorado / Visual (`ActionCombatArena.js`):**
  * **Textos Flutuantes Limpos sem Emojis:**
    * Desvio/Miss: `DESVIO` (azul celeste `#38bdf8`).
    * Fora de Alcance: `FORA DE ALCANCE` (amarelo `#fde047`).
    * Dano Critico: `CRÍTICO -{dano}` (amarelo/ouro `#fde047`).
    * Dano Normal: `-{dano}` (laranja `#fb923c` em vantagem elemental, vermelho `#f87171` em dano sofrido por aliados, branco `#ffffff` padrao).
    * Purificacao: `PURIFICADO (-{qtd})` (verde-agua `#2dd4bf`).
    * Banners e Notificacoes: `PREPARE-SE PARA A BATALHA`, `COMBATE INICIADO`, `VITÓRIA!`, `VOCÊ FOI DERROTADO!`, `Fuga da Batalha`.
    * Tipografia refinada `13px system-ui, -apple-system, sans-serif` com renderizacao discreta e alto contraste.

---

## [v0.10.0] - 2026-11-11
### Tabela de Drops em Monstros (`loot_table_json`) & Rolagem de Loot em Combate
* **Adicionado:**
  * **Construtor de Drops no Modal de Monstros (`/admin`, `AdminMonstersTab.js`):** Permite adicionar, editar e remover itens que o monstro dropa ao morrer, definindo `Item`, `Qtd Mín`, `Qtd Máx` e `Chance (%)` (`0.01%–100%`), com exibição resumida em pílulas na tabela CRUD de Monstros.
  * **Persistência & Enriquecimento (`AdminMonstersController.ts`):** Normaliza e salva `lootTableJson` no banco PostgreSQL (espelhado automaticamente no Snapshot JSON) e entrega `lootTableResolved` com os nomes dos itens em PT-BR.
  * **Rolagem de Drops na Vitória (`CharacterInventoryService.rollMonsterLootDrops` & `QuestProgressService.ts`):** Ao derrotar monstros em batalha real (`/play`) ou GM (`/gm`), cada monstro morto rola sua `lootTableJson`, credita os itens ganhos na mochila básica (`character_inventory_items`) e exibe os itens ganhos no banner de vitória.

---

## [v0.9.2] - 2026-11-11
### Combate Unificado (GM = Real), Remoção de Redutores, Balanceamento de Nível/Raridade & Dano Elemental Global
* **Adicionado:**
  * **Calculadora Global Compartilhada (`packages/shared/src/CombatDamageCalculator.ts`):** Exposta em `/shared/CombatDamageCalculator.js` para uso idêntico no Servidor e na Arena 2.5D (`/play`), aplicando tetos de acerto/desvio (`[10%..95%]`), mitigação defensiva proporcional por nível (`(100 + 10*Nível) / (Def + 100 + 10*Nível)`) e multiplicadores reais de `element_matchups` (`FIRE > EARTH > AIR > WATER > FIRE ±25%`, `NEUTRAL -25%` causado / `+25%` sofrido).
  * **Construtor Único de Monstros (`apps/server/src/controllers/MonsterCombatBuilder.ts`):** Centraliza o cálculo de monstros para **ambas** as rotas (`startBattle` do GM e `startEncounterByMap` dos encontros reais).
* **Alterado (`TemporaryCombatController.ts`, `ActionCombatArena.js`, `ArenaPhysicsSolver.js`, `GamePlayController.ts`):**
  * **100% Realidade entre GM e In-Game:** Batalhas invocadas pelo Painel `/gm` e encontros reais no mapa usam o mesmo construtor de monstros e a mesma fórmula global de dano.
  * **Zero Redutores em Monstros:** Removidos os redutores `0.80/0.70/0.82/0.78/0.72/0.90/0.70` sobre `attribute_conversions`; monstros agora usam `100% (1.0x)` das conversões do banco (incluindo `INT -> MAG_ATK` para monstros mágicos e `DEX/AGI/STR` em secundários).
  * **Escalonamento Balanceado por Nível de Mapa:** Crescimento proporcional contínuo por nível (`1 + (mobLvl - 1) * 0.12`) antes das conversões e trava proporcional da variação positiva em mapas iniciais (ex: Nv 1 limitado a `1..3`).
  * **Buff nas Raridades A, S e SS (com proteção também em MAG_DEF):** `A` (`1.50x HP / 1.35x ATK / 1.25x DEF`), `S` (`2.15x / 1.60x / 1.45x`), `SS` (`3.20x / 1.95x / 1.70x`); `B/C/D/F` mantidos.

---

## [v0.9.1] - 2026-11-11
### Governança: Regra Obrigatória de Git + Deploy Contínuo na VPS (`Regra #9`)
* **Adicionado (`AGENTS.md` & `docs/HANDOFF.md`):**
  * Formalizada a **Regra #9**: toda entrega validada deve executar obrigatoriamente `git commit` + `git push origin main` e manter a VPS Azure (`/home/azureuser/etheria-campus`) 100% atualizada com backup preventivo de snapshot/banco antes do deploy para rollback seguro.

---

## [v0.9.0] - 2026-11-11
### Quests Meta Procedurais (`META`), Contagem por Raça/Coleta & Base Inicial de Mochila/Ouro (Incompleta)
* **Adicionado:**
  * **Quests Meta Procedurais (`MetaQuestProceduralEngine.ts` & `AdminMetaQuestsPanel.js`):**
    * Nova categoria `🟠 META` na tabela de missões (`/admin`), com filtro exclusivo, card visual no Quadro Draw.io/Tabela e construtor procedural em estágios (1 único registro com `currentStage` `1..N`).
    * Suporte a alvos de **Matar Monstro específico** (`KILL_MONSTER`), **Matar Raça/Tipo** (`KILL_RACE`, ex: Selvagens, Demônios) e **Coletar & Entregar Item** (`COLLECT_ITEM`), com progressão multiplicativa configurável (padrão `x10`: `10 ➔ 100 ➔ 1.000 ➔ 10.000 ➔ 100.000...`).
    * Escalada de recompensas selecionável e independente do `x10` (EXP, Ouro, Pontos de Atributo e Item nos modos `MULTIPLIER`, `LINEAR_PCT` ou `ADDITIVE`) gerando **grade editável por estágio** no modal antes de salvar.
  * **Runtime Multi-Estágio & Combate (`QuestProgressService.ts`, `CombatUtilityHelper.ts` & `PlayRouter.ts`):**
    * Novo endpoint autoritativo `POST /api/play/combat/victory` que contabiliza todos os monstros e raças mistas derrotadas na Arena 2.5D de forma idempotente.
    * Progressão cumulativa entre estágios (`10` preservados para `100`, etc.) e entrega etapa a etapa diretamente na conversa com o NPC.
  * **⚠️ Base Inicial Incompleta de Carteira & Mochila (`CharacterInventoryService.ts`, `PlayBagController.js`, `schema.prisma`):**
    * Adicionados `PlayerCharacter.gold` (`BigInt`), tabela `CharacterInventoryItem`, rota `GET /api/play/characters/:id/inventory`, indicador `🪙` + botão `🎒 Mochila` no `/play` e drop provisório vinculado a missões `COLLECT_ITEM`. Documentado explicitamente em `ARCHITECTURE.md`, `DATABASE_SCHEMA.md` e `HANDOFF.md` como base parcial aguardando módulo futuro de Economia, Lojas e Tabela Global de Drops.
* **Corrigido & Modularizado:**
  * Corrigida incompatibilidade de rota em `PlayRouter.ts` que impedia `acceptQuest` (`/quests/:id/accept`) e `turnInQuest` (`/quests/:id/turn-in`) vindos de `PlayQuestsController.js`.
  * `AdminQuestsController.ts` decomposto com `QuestProgressService.ts` (reduzido de 832 para ~435 linhas, respeitando Regra #7).
  * **Aviso de Deploy VPS:** Requer `npx prisma db push --schema=packages/database/prisma/schema.prisma` ao atualizar produção.

---

## [v0.8.1] - 2026-11-11
### Blindagem Autoritativa de Spawn de Monstros por Mapa (`MapSpawnResolver` & Regras de Zona Segura)
* **Corrigido:**
  * **Cidades e Vilas não spawnam mais monstros:** Mapas seguros (`MapType.allowMonsterSpawn === false`, como `CITY` e `VILLAGE`) que possuíam `encounterRatePct > 0` legado (ex.: `map_4`, `map_5`, `map_7`, `map_8`) agora têm spawn bloqueado no servidor e no cliente com taxa efetiva `0%`.
  * **Removido Fallback Global de Monstros:** Removida a busca de todos os monstros ativos do banco em `TemporaryCombatController.startEncounterByMap` quando um mapa não possui raças nem monstros individuais configurados (o que fazia mapas seguros vazios e mapas sem monstros compatíveis spawnarem qualquer monstro).
  * **Padrão de Criação/Edição no `/admin` (`AdminMapsController.ts` & `admin.js`):** Corrigido o fallback que aplicava `encounterRatePct = 8.0` em Cidades nível > 1 e Vilas ao salvar sem taxa explícita; agora tipos de mapa seguros travam `#mapEncounterRatePct` em `0` na UI e no servidor.
* **Adicionado:**
  * **Resolvedor Compartilhado (`apps/server/src/controllers/MapSpawnResolver.ts`):** Centraliza `parseAllowedRaces`, `parseAllowedMonsterIds`, `resolveEffectiveEncounterRate`, `canMapSpawnMonsters` e `findEligibleMonstersForMap`, garantindo que apenas monstros ativos pertencentes às raças permitidas (`allowedMonsterRacesJson`) **ou** listados individualmente (`allowedMonsterTemplateIdsJson`, mesmo fora das raças selecionadas) possam nascer em mapas onde `allowMonsterSpawn === true`.
* **Alterado:**
  * `GamePlayController.ts` passa a expor `allowMonsterSpawn` no bootstrap, normalizar `encounterRatePct` para `0` em zonas seguras e enviar `canSpawnMonsters` em `getMapStateForPlay`.
  * `apps/server/public/play/play.js` valida `allowMonsterSpawn` e `canSpawnMonsters` antes de disparar encontros aleatórios ou interromper o movimento do jogador.

---

## [v0.8.0] - 2026-11-11
### Arena 1300px, Colisão Física Universal entre Modelos & Inteligência Artificial Tática de Equipe
* **Adicionado:**
  * **Motor Físico de Colisão & Formação (`apps/server/public/play/js/ArenaPhysicsSolver.js`):**
    * **Colisão entre Todos os Modelos:** Solver elíptico iterativo (`resolveAllUnitCollisions`, até 12 passes com saída antecipada) aplicado a cada frame sobre Jogador, Pets e Monstros, impedindo que as entidades se acumulem em uma única sombra.
    * **Formação Inicial Vanguarda / Retaguarda (`buildTeamFormationPositions`):** Separa unidades Melee à frente e Ranged atrás com espaçamento amplo (`72 px` lateral, `68 px` entre fileiras) e detecção de pontos livres.
    * **Flanqueamento e Slots ao Redor de Alvos (`computeSurroundAttackSlot`):** Distribui atacantes em anel sem empilhamento e direciona unidades frágeis para as bordas opostas ao centro de ameaça.
  * **Inteligência Artificial Tática (`apps/server/public/play/js/ArenaUnitAiController.js`):**
    * **Cálculo Geral por Time (`evaluateTeamTactics`):** Avalia proceduralmente atributos reais (`HP`, `DEF`, `MAG_DEF`, `ATK`, `ATTACK_SPEED`, `CRIT`) designando **Tank Protector** (intercepta ameaças contra aliados Ranged), **Top Dano** (prioriza maximizar dano) e **Mais Frágil** (ataca à distância ou pelas bordas sem se expor).
    * **Regras Melee:** Persegue o inimigo mais próximo (ou intercepta atacantes dos Rangeds quando Tank) com prevenção contra perseguição infinita (`avoidTargetUntil`).
    * **Regras Ranged + Anti-Kite Infinito:** Ataca o inimigo mais próximo dentro do alcance, move-se quando necessário para buscar alvos, recua posicionando-se atrás de um aliado Melee quando ameaçado e **aceita luta corpo a corpo** (`standAndFightTimer`) ao ser encurralado ou após kiting prolongado.
* **Alterado (`ActionCombatArena.js`, `TemporaryCombatController.ts`, `play/index.html`):**
  * **Arena Ampliada para 1300 px:** `arenaRadiusX` aumentado de `468` (`936 px`) para **`650` (`1300 px`)** e `arenaRadiusY` ampliado proporcionalmente de `338` para **`470` (`940 px`)**.
  * **Maior Afastamento Inicial entre Equipes:** Candidatos de separação em `findFairSpawnPositions` expandidos até **`840 px`** (antes máx `364 px`).
  * Monstros agora podem atacar e disparar projéteis teleguiados tanto no Jogador quanto nos Pets aliados (permitindo que Pets Tank realmente protejam aliados Ranged); `TemporaryCombatController.ts` passa a enviar também `magDef`, `critRate`, `critDmg`, `attackSpeed` e estatísticas de `petTemplate`.

---

## [v0.7.0] - 2026-11-11
### Personalização de Cor de Partículas VFX Transparentes (`vfxColorHex` & `vfxColorIntensity`)
* **Adicionado:**
  * **Processador Compartilhado de Partículas VFX (`apps/server/public/play/js/VfxColorProcessor.js`):**
    * Engine OO de recolorização para spritesheets `atlas.webp` e miniaturas `thumb.png` com fundo transparente (RGBA8888), pré-assado em Canvas Offscreen com cache em `WeakMap` (custo zero por frame em 60 FPS e remoção FIFO para evitar vazamento de memória).
    * Preserva 100% dos pixels transparentes (`alpha === 0`) e halos translúcidos, combinando luminância ponderada (`0.65 * peak + 0.35 * lum`) para tingir perfeitamente tanto partículas brancas/cinzas quanto efeitos coloridos, com fallback seguro para `source-atop` em cenários sem CORS.
  * **Persistência no Banco (`packages/database/prisma/schema.prisma` & `AdminSkillsController.ts`):**
    * Adicionados `vfxColorHex` (`String?`, `null` = cor original) e `vfxColorIntensity` (`Int` padrão `100`, intervalo `0..100`) em `SkillTemplate` (`skill_templates`) e `StatusEffectTemplate` (`status_effect_templates`) com sanitização estrita `#RRGGBB` no servidor e espelhamento no Snapshot JSON.
  * **Controles Visuais no Estúdio `/admin` (`AdminVfxColorPicker.js`):**
    * Novo seletor de cor nativo + campo Hex (`#RRGGBB`), slider de **Intensidade (`0%–100%`)**, paleta rápida de 10 cores elementais/mágicas e botão **🔄 Restaurar Original** compartilhado entre Habilidades e Buffs/Debuffs.
    * Preview ao vivo em tempo real na Arena 2.5D (`AdminArenaPreview.js`) e miniaturas coloridas diretamente nas tabelas CRUD (`AdminSkillsAndBuffsTab.js` & `AdminStatusEffectsTab.js`).
* **Alterado / Modularizado (Regra #7 — Limite de 1.000 Linhas):**
  * Extraído `AdminSkillsModalDom.js` de `AdminSkillsAndBuffsTab.js` (que caiu para 767 linhas) e extraído `admin.css` de `admin/index.html` (que caiu de 998 para 589 linhas).
  * Módulo `VfxColorProcessor.js` também acoplado em `play/index.html` pronto para o combate em tempo real.

---

## [v0.6.9] - 2026-11-11
### Auditoria Completa, Segurança Reforçada, Modularização & Otimizações de Desempenho (v0.6.9)
* **Bloco 1: Segurança & Integridade de Acesso:**
  * **Mitigação VULN-01 (Elevação Silenciosa para ADMIN em Tokens Inválidos):** Em `/api/play/*`, removido o fallback perigoso que atribuía a sessão ao primeiro ADMIN do banco quando o `sub` do token fosse inválido. Agora tokens corrompidos ou adulterados recebem imediatamente HTTP 401 Unauthorized.
  * **Mitigação VULN-02 (BOLA / IDOR em Missões e Combate):** Implementada validação rigorosa de posse de personagem (`verifyCharacterOwnership`) em `PlayRouter.ts`. Endpoints de quests (`/quests`, `/quests/accept`, `/quests/interact-npc`, `/quests/turn-in`) e de combate (`/combat/encounter`, `/temporary-combat/start`, `/temporary-combat/action`, `/temporary-combat/auto-resolve`) agora validam se o `characterId` pertence ao `userAccountId` autenticado antes de executar ou registrar progresso (jogadores `ADMIN` e `GM` mantêm permissão especial).
  * **Proteção em `updateClassGroundOffset`:** Restrita a alteração do offset vertical global de classes exclusivamente para `ADMIN` e `GM`. Jogadores comuns com `role === 'PLAYER'` recebem erro de autorização.
  * **Proteção contra Sobrescrita Destrutiva em `AdminQuestsInitialSeeds.ts`:** Removido o comando `await prisma.questTemplate.deleteMany({})` que destruía as missões customizadas do usuário caso houvesse 5 ou menos cadastradas. Agora as sementes iniciais só são criadas se a tabela estiver absolutamente vazia (`existing.length === 0`).
  * **Sanitização contra XSS Armazenado em `admin.js`:** Adicionada a função utilitária `escapeHtml(str)` e aplicada na renderização dinâmica de títulos e descrições personalizadas na UI administrativa.
* **Bloco 2: Arquitetura & Governança (Regra #7 - Limite Mandatório de 1.000 Linhas):**
  * **Decomposição Modular de `apps/server/src/index.ts`:** O arquivo monolithic de 1.028 linhas foi reduzido para 412 linhas, delegando suas responsabilidades para submódulos dedicados:
    * `apps/server/src/routes/AdminRouter.ts` (604 linhas): Gerencia todos os endpoints `/api/admin/*`, login admin, contexto e controle de permissões por tabela (RBAC).
    * `apps/server/src/routes/PlayRouter.ts` (351 linhas): Gerencia todos os endpoints `/api/play/*`, autenticação de jogadores, exploração, teleporte, missões e instâncias de combate autoritárias.
  * **Conformidade de Linhas:** Varredura global executada no monorepo confirmando **zero arquivos** acima do limite de 1.000 linhas (`Files > 1000 lines: []`).
* **Bloco 4: Desempenho, Cache & Gestão de Recursos (ARM64 VPS):**
  * **`I18nCache` com Invalidação Automatizada:** Criado módulo `@etheria/database/I18nCache` com cache em memória RAM e TTL de 5 minutos, eliminando dezenas de consultas repetitivas a `i18nTranslation.findMany` em todos os controladores (`GamePlayController`, `TemporaryCombatController`, `AdminMapsController`, `AdminQuestsController`). Invalidação acoplada automaticamente ao `SnapshotManager.exportToDisk()`.
  * **Método `importFromDisk()` no `SnapshotManager`:** Adicionado suporte nativo para importar o snapshot JSON de volta ao banco de dados PostgreSQL com `upsert`, permitindo restauração sem perda de dados.
  * **Eliminação de Vazamento de Memória (Memory Leak) no Combate:** Substituído o `setTimeout` de 1 hora individual por instância de batalha por um sweep periódico global de 5 minutos não bloqueante (`interval.unref()`) em `TemporaryCombatController.ts`, liberando memória de batalhas abandonadas.
  * **Controle de Memória para Cache de Mapas no Servidor:** O pré-aquecimento de imagens de mapas (`prewarmMapImages`) foi delimitado aos 5 primeiros mapas e o proxy reverso em memória RAM foi limitado a no máximo 12 imagens simultâneas com política de expulsão FIFO, evitando sobrecarga ou estouro de memória (OOM) na VPS Azure ARM64.
  * **Serialização Resiliente de BigInt em `sendJson`:** Implementado replacer seguro `JSON.stringify(data, (_, v) => typeof v === 'bigint' ? v.toString() : v)` evitando erros `TypeError: Do not know how to serialize a BigInt`.
* **Bloco 3 (Gameplay & Economia):** Preservado intacto sem alterações a pedido explícito do usuário.

---

## [v0.6.8] - 2026-11-11
### Combate Autoritário & Painel Admin — Revisão Profunda e Tetos Matemáticos de Acerto e Desvio (Ninguém Inalvejável & Zero Precisão Perfeita)
* **Revisão Matemática das Taxas de Acerto e Desvio:**
  * **Causa Raiz Identificada:** Na rota `/admin` e no motor de combate, os atributos `PHYS_ACCURACY`, `MAG_ACCURACY`, `PHYS_EVASION` e `MAG_EVASION` não possuíam tetos rígidos e sofriam inconsistências de representação entre decimais (`0.05` = 5%) e inteiros (`95` = 95%). Sem travas, valores podiam ultrapassar 100%, gerando situações em que unidades podiam se tornar inalvejáveis (evasão >= 100%) ou ter acerto garantido infalível (precisão de 100% que nunca erra).
  * **Novo Modelo Matemático Unificado & Tetos de Balanceamento:**
    * **Teto Máximo de Evasão / Desvio: 75% (`0.75`):** Nenhuma entidade (jogador, monstro ou pet), build ou equipamento pode acumular mais de 75% de esquiva. **Ninguém é inalvejável**.
    * **Teto Máximo de Precisão em Atributos: 125% (`1.25`):** Permite que classes focadas em Destreza (`DEX`) e precisão contrabalanceiem oponentes altamente esquivos.
    * **Teto Máximo de Acerto em Combate: 95% (`0.95`):** **Zero precisão perfeita**. Nenhum ataque básico ou habilidade de dano pode ter 100% de garantia; sempre há no mínimo 5% de margem natural de desvio, erro ou esquiva.
    * **Piso Mínimo de Acerto em Combate: 10% (`0.10`):** Mesmo contra um defensor no teto máximo de evasão (75%), o atacante retém sempre pelo menos 10% de chance de conectar o golpe.
    * **Fórmula Autoritária Linear:**
      ChanceAcerto = clamp(PrecisãoAtacante - DesvioDefensor, 10%, 95%)
      Garante escalabilidade idêntica e balanceada desde os estágios iniciais (Nível 1) até as progressões avançadas (Nível 100).
* **Painel Admin Studio Low-Code (`AdminAttributesController.ts`, `AdminAttributesTab.js`, `AdminClassModalTemplate.js`, `AdminClassesTab.js`, `AdminPetsTab.js`):**
  * **Backend Clamping:** Clamps estritos no `AdminAttributesController.ts` ao salvar atributos de combate (Evasão `[0, 0.75]`, Precisão `[0.20, 1.25]`, Taxa Crítica `[0.01, 0.80]`, Dano Crítico `[1.00, 3.00]`).
  * **Normalização Visual na Aba de Atributos:** Tabela com indicadores explícitos de decimais (`0.05 = 5% • Teto Máx: 0.75 = 75%`) e auto-clamp preventivo com feedback visual caso o usuário digite valores fora dos limites.
  * **Modais de Classes e Pets:** Inputs numéricos com limites estritos (`min`/`max`), badge de alerta `[Teto Máx: XX%]` ao alcançar o limite, conversão automática de inteiros para decimais na persistência e nota explicativa de balanceamento no card da família `acerto_desvio`.
* **Motor de Combate em Tempo Real & Turnos (`ActionCombatArena.js` & `TemporaryCombatController.ts`):**
  * **`ActionCombatArena.js`:** Método autoritário `calculateHitRate(attackerAcc, defenderEva)` implementado com os tetos de 75% de evasão, 125% de precisão, 95% de acerto máx e 10% mín. Aplicado nos ataques do jogador, projéteis teleguiados de pets e ataques de monstros na arena em tempo real.
  * **`TemporaryCombatController.ts`:** Método `calculateEffectiveHitRate` implementado e acoplado ao fluxo de turnos em `executeAction`. Ataques normais (`ATTACK`), habilidades com dano (`SKILL`) e retaliação de monstros realizam o teste de acerto vs evasão, gerando eventos `MISS` (`💨 DESVIO!`) no combat log e nos floating combat texts quando o golpe é esquivado.
* **Documentação Oficial Atualizada (`docs/combat_math_guide.html`):**
  * Seção 4.1 revisada detalhando a fórmula autoritária de acerto e evasão, explicitando as regras de governança contra entidades inalvejáveis e precisão absoluta. Incrementada versão do guia para `v0.6.8`.

---

## [v0.6.7] - 2026-11-11
### Admin Studio Low-Code — Correção de Layout e Sincronização do Alcance de Ataque (`attackRange`) no Modal de Personagens
* **Correção de Overflow e Visibilidade do Alcance de Personagens:**
  * **Causa Raiz Identificada:** No modal de cadastro e edição de personagens (`AdminClassModalTemplate.js`), o cabeçalho forçava 5 campos em uma única linha rígida (`grid-template-columns: 1.2fr 1fr 1fr 1fr 0.9fr;`). Como os `<select>` possuem largura mínima intrínseca ditada pelas opções textuais e o `.modal-box` possui `overflow: hidden`, o 5º elemento (`Alcance: [ 60 ]`) era empurrado para fora da tela ou espremido a zero pixels em resoluções inferiores a 1100px.
  * **Header Modular e 100% Responsivo:**
    * O cabeçalho foi reorganizado em dois blocos fluidos e bem espaçados com `repeat(auto-fit, minmax(180px, 1fr))`:
      * **Linha 1:** `🏷️ Nome da Classe / Personagem` e `🧬 Raça do Personagem`.
      * **Linha 2 (Mecânicas de Combate Básico):** `⚔️ Estilo de Combate` (Melee/Ranged), `✨ Tipo de Dano` (Físico/Mágico) e `🎯 Alcance do Ataque (px)`.
    * Cada campo possui rótulo próprio, cores de destaque e input numérico centralizado, sem transbordamentos ou cortes visuais em qualquer tamanho de janela.
  * **Espelhamento na Aba de Atributos & Combate (`classTabStats`):**
    * Inserido o campo `🎯 Alcance Ataque (px)` no Bloco 2.5 ("Atributos Base de Combate da Classe"), permitindo configurar o alcance diretamente ao calibrar velocidade de batalha, precisão e crítico.
    * Criada a função `AdminApp.syncClassAttackRange` que sincroniza em tempo real qualquer alteração feita tanto no cabeçalho quanto na aba de combate.
    * Sincronização automática preservada em `AdminApp.onCombatStyleChange` ao alternar entre Melee e Ranged.

---

## [v0.6.6] - 2026-11-10
### Combate & Criação Low-Code — Tipo de Dano Físico vs Mágico (`damageType`) para Classes, Monstros e Pets
* **Dano Físico vs Dano Mágico em Classes, Monstros e Pets:**
  * **Banco de Dados & Prisma (`packages/database/prisma/schema.prisma`):**
    * Adicionada a coluna `damageType String @default("PHYSICAL") @map("damage_type")` nas models `ClassTemplate`, `MonsterTemplate` e `PetTemplate`.
    * Garantida 100% de compatibilidade retroativa e integridade de registros existentes (`@default("PHYSICAL")`).
  * **Controllers Backend (`AdminMapsController.ts`, `AdminMonstersController.ts`, `AdminPetsController.ts`):**
    * Adicionado `damageType?: string;` nos DTOs `ClassTemplateDto`, `MonsterTemplateDto` e `PetTemplateDto`.
    * Mapeamento, validação e persistência de `damageType` (`PHYSICAL` ou `MAGICAL`) nos métodos de criação e atualização.
  * **Transmissão de Estado & Inicialização de Batalha (`GamePlayController.ts` & `TemporaryCombatController.ts`):**
    * `formatCharacterPayload` agora envia autoritativamente `damageType` do personagem/classe para o cliente.
    * Adicionado `damageType?: 'PHYSICAL' | 'MAGICAL'` ao tipo `CombatUnit`.
    * Inicialização de jogadores (`playerUnit`), pets aliados (`petUnits`) e monstros (`monsterUnits`) atribui corretamente o `damageType` configurado no banco de dados.
  * **Painel Admin Studio Low-Code (`AdminClassModalTemplate.js`, `AdminClassesTab.js`, `AdminMonstersTab.js`, `AdminPetsTab.js`):**
    * Adicionado campo seletor `<select>` para **Tipo de Dano** (`🗡️ Dano Físico` ou `🔮 Dano Mágico`) nos modais de criação e edição de Personagens/Classes, Monstros e Pets.
    * Carregamento do valor existente e salvamento do DTO integrados.
    * Inseridos badges visuais (`🔮 Mágico` e `🗡️ Físico`) nas listagens de cards e tabelas das três entidades.
  * **Arena de Combate em Tempo Real (`ActionCombatArena.js`):**
    * O ataque básico do jogador agora verifica o `damageType`:
      * `PHYSICAL`: mitigado por `target.def` (Defesa Física), projétil `⚔️` (Melee) ou `🏹` (Ranged), cor dourada `#fde047`.
      * `MAGICAL`: mitigado por `target.magDef` (Defesa Mágica), projétil `✨` (Melee Mágico) ou `🔮` (Ranged Mágico), cor púrpura arcana `#c084fc`.
    * Ataque de Monstros: calcula rolagem de acerto e evasão (`magAccuracy` vs `magEvasion` ou `physAccuracy` vs `physEvasion`), mitigação pela defesa correspondente do jogador (`magDef` vs `def`) e exibe indicador visual contextual (`🔮 -Dano` vs `💔 -Dano`).
    * Ataque de Pets: projétil e rolagem adaptados automaticamente para físico (`🐾` / `#38bdf8`) ou mágico (`✨` / `#c084fc`).

---

## [v0.6.5] - 2026-11-10
### Combate Action & Arena — Correção da Velocidade de Movimento em Batalha (`BATTLE_MOVE_SPEED`)
* **Correção Autoritária de Movimentação em Arena de Combate:**
  * **Causa Raiz Identificada:** Em `ActionCombatArena.js`, a velocidade em batalha estava tentando ler apenas a chave `baseCombatAttributesJson.BATTLE_MOVE_SPEED` da classe (que vinha vazia `{}` como padrão), ignorando a tabela global `combat_attributes.baseDefault` onde o admin altera o valor na aba *Atributos & Fórmulas*. Além disso, aplicava um teto rígido hardcoded (`Math.min(baseSpeed * 1.40)`) e fixava a velocidade de monstros (`110 + idx * 10`) e pets (`teto de 175`).
  * **Cálculo Autoritário no Backend (`TemporaryCombatController.ts`):**
    * Adicionado `battleMoveSpeed` ao DTO `CombatUnit`.
    * O backend consulta autoritativamente o valor de `BATTLE_MOVE_SPEED` da tabela `combat_attributes` (ou sobrescrita da classe em `class_templates`) e soma a taxa de conversão cadastrada em `attribute_conversions` para o atributo `AGI`.
    * Passa `battleMoveSpeed` calculado tanto para o jogador (`playerUnit`), quanto para pets e monstros sorteados.
  * **Aplicação no Cliente (`ActionCombatArena.js`):**
    * `this.player.speed` agora lê prioritariamente `pState.battleMoveSpeed` enviado pelo servidor, com fallback para o valor global de `combat_attributes` e conversão de `AGI`.
    * Removido o teto artificial de 1.40x.
    * Monstros e pets passam a adotar suas velocidades reais calculadas pelo banco (`m.battleMoveSpeed` e `p.battleMoveSpeed`), permitindo que qualquer alteração de velocidade de batalha surta efeito imediato.

---

## [v0.6.4] - 2026-11-10
### Governança & Arquitetura — Resposta Dinâmica Total a Atributos e Banco de Dados
* **Sincronização 100% Autoritária do Banco com o Jogo (Zero Hardcode):**
  * **Atributos de Personagens (`PlayerCharacter` & `ClassTemplate`):**
    * O cálculo de combate agora combina em tempo real os atributos base da classe (`ClassTemplate.baseAttributesJson`), a progressão de nível (`ClassTemplate.growthPerLevelJson * (level - 1)`) e os pontos distribuídos pelo jogador ou admin (`PlayerCharacter.distributedStatsJson`).
    * Qualquer alteração direta no PostgreSQL ou no painel Admin (buff/nerf em atributos base, nível ou pontos alocados) altera imediatamente a vida, dano, defesa e velocidade do personagem in-game.
  * **Matriz Procedural de Conversões (`attribute_conversions`):**
    * `TemporaryCombatController` agora lê dinamicamente as taxas de conversão de atributos do banco (`this.prisma.attributeConversion.findMany()`). Se o admin alterar a taxa de conversão (ex: de `STR -> PHYS_ATK` de 3.2 para outro valor), todo o dano do jogo responde imediatamente.
  * **Estilo de Combate Melee vs Ranged e Alcance no Cliente (`GamePlayController.ts` & `ActionCombatArena.js`):**
    * `GamePlayController.formatCharacterPayload` passa oficialmente `combatStyle` e `attackRange` para o cliente.
    * `ActionCombatArena.triggerAttack` valida a distância física do ataque com base no `attackRange` do personagem/classe, exibindo `📏 Fora de Alcance!` caso tente atacar além do alcance configurado no banco de dados.

---

## [v0.6.3] - 2026-11-10
### Combate em Tempo Real — Migração de Resquícios de Turno para Cooldowns e Segundos
* **Transição Completa para Mecânica de Ação em Tempo Real:**
  * Removidos e atualizados todos os resquícios conceituais e estruturais de batalha por turnos em habilidades, status, tabelas e visualizadores.
  * **Habilidades com Cooldown em Segundos (`cooldownSeconds`, `cooldownMs`):**
    * Tabela `skill_templates`: adicionadas as colunas `cooldown_seconds` (Float, padrão `0.0s`), `cast_range` (Int, alcance em pixels, padrão `160px`) e `aoe_radius` (Int, raio de área em pixels, padrão `0px`).
    * As colunas legadas `cooldown_turns` foram preservadas com fallback automático para assegurar 100% de compatibilidade retroativa (Cláusula 0.2).
    * Gatilhos atualizados para tempo real: `ACTIVE` (Uso Manual / Tempo Real), `INTERVAL_TICK` (Periódico a cada intervalo de segundos), `INTERVAL_TICK_CLEANSE` (Purificação periódica com debuff ativo).
  * **Buffs e Debuffs com Duração e Intervalo em Segundos (`durationSeconds`, `tickIntervalSeconds`):**
    * Tabela `status_effect_templates`: adicionadas as colunas `duration_seconds` (Float, padrão `5.0s`) e `tick_interval_seconds` (Float, padrão `1.0s` para pulsos de dano/cura DoT e HoT).
    * Gatilhos de status ajustados para execução contínua: `CONTINUOUS_TICK` (Ticks Periódicos em Segundos), `WHILE_ACTIVE` (Enquanto Ativo), `ON_APPLY` (No Momento do Impacto), `ON_HIT_TAKEN` (Ao Receber Dano), `ON_ATTACK` (Ao Desferir Golpe), `ON_EXPIRE` (Ao Expirar a Duração).
  * **Admin Studio Low-Code (`AdminSkillsAndBuffsTab.js`, `AdminStatusEffectsTab.js`, `AdminSkillsAutoLink.js`):**
    * Todos os badges, resumos e formulários de criação/edição agora operam em segundos (`⏱️ 6.0s (Tick: 1.0s)`, `⏳ CD: 3.0s`, `Duração (Segundos)` com `step="0.5"`).
    * Adicionados campos de Alcance (`skillCastRangeInput`) e Raio AoE (`skillAoeRadiusInput`) no modal de criação/edição de habilidades.
  * **Motor de Combate e Controladores (`AdminSkillsController.ts`, `TemporaryCombatController.ts`, `ActionCombatArena.js`):**
    * `ActiveStatusInstance` atualizado com contagem regressiva em segundos (`durationSeconds` e `remainingSeconds`) e ticks contínuos (`CONTINUOUS_TICK`).
    * Dicionário de sementes (`seedData.ts`): redefinido o atributo `AGI` e `SPEED` como "Velocidade de Ataque / Ação" (redução de intervalo entre ataques) em substituição a "iniciativa no turno".
  * **Documentação Oficial de Atributos & Matilhas de Combate:**
    * Atualizado `docs/combat_math_guide.html` e recompilado o PDF `apps/server/public/docs/Etheria_Campus_Atributos_e_Matematicas_de_Combate.pdf`.

---

## [v0.6.2] - 2026-11-10
### Habilidades & Combate — Gatilho e Bloco Visual de Limpeza de Debuffs (`CLEANSE_DISPEL`)
* **Gatilho de Limpeza de Debuffs para Habilidades (`AdminSkillsAndBuffsTab.js`, `AdminSkillsAutoLink.js`):**
  * Adicionados ao seletor de gatilhos (`#skillTriggerSelect`) os gatilhos dedicados:
    * `ON_DEBUFF_RECEIVED` (*"✨ Ao Receber Debuff (Limpar Debuffs)"*)
    * `ON_TURN_START_CLEANSE` (*"🧹 No Início do Turno com Debuff (Limpar Debuffs)"*)
  * Quando o usuário seleciona um gatilho de limpeza de debuffs, o modo da habilidade ajusta-se para Passiva/Reativa e adiciona automaticamente o bloco visual `CLEANSE_DISPEL` caso ainda não exista na lista.
  * Exibição de rótulos amigáveis em português (`getSkillTriggerLabel`) na tabela administrativa de habilidades.
* **Bloco Visual No-Code `CLEANSE_DISPEL` (Limpar Debuffs / Purificar):**
  * Adicionado botão **`➕ ✨ Limpar Debuffs`** no Construtor Visual de Blocos de Habilidade (`#skillVisualBlocksContainer`).
  * Configuração parametrizada sem hardcode:
    * **Alvo da Limpeza (`cleanseTarget`):** Próprio Conjurador (`SELF`), Alvo da Habilidade (`TARGET`) ou Todos os Aliados (`ALL_ALLIES`).
    * **Quantidade de Debuffs Removidos (`maxDebuffs`):** Todos os debuffs ativos (`0`) ou até `1`, `2` ou `3` debuffs.
    * **Chance de Limpar (`cleanseChancePct`):** `1%` a `100%`.
    * **Cura Bônus por Debuff Limpo (`healPerDebuffPct`):** Percentual opcional de `MAX_HP` restaurado por cada debuff removido.
* **Simulador de Arena 2.5D (`AdminArenaPreview.js`) & Motor de Combate (`TemporaryCombatController.ts`, `ActionCombatArena.js`):**
  * Na Arena 2.5D ao vivo do `/admin`, habilidades com gatilho/bloco de limpeza de debuffs exibem o ícone de debuff acima da cabeça da unidade antes do impacto e demonstram a remoção visual no momento do disparo com texto flutuante `✨ Purificado`.
  * Implementado `cleanseUnitDebuffs` em `TemporaryCombatController.ts` e `ActionCombatArena.js` para remover efeitos negativos (`isBuff === false`) e aplicar cura proporcional por debuff purificado.
  * **Conformidade Estrita com a Cláusula 0.2 e Regra #7:** Zero registros alterados nas tabelas do banco de dados ou no snapshot; todos os arquivos mantidos estritamente abaixo do limite de 1.000 linhas.

---

## [v0.6.1] - 2026-11-10
### Infraestrutura, Nuvem 24/7 & Governança de Equipe Multi-IA
* **Deploy em Produção na VPS Azure (Independente do PC Local):**
  * Servidor Etheria Campus totalmente configurado e rodando permanentemente na VM Azure (`40.65.63.193` - Standard B2pts_v2 ARM64, Ubuntu 24.04).
  * **Acesso Público com SSL Automático (HTTPS):** Configurado no Caddy Web Server com proxy reverso na porta 4000:
    * **HTTPS Oficial:** `https://40-65-63-193.sslip.io/admin` e `https://40-65-63-193.sslip.io/play`.
    * **HTTP Alternativo:** `http://40.65.63.193/admin` e `http://40.65.63.193/play`.
  * **Serviço Contínuo (`systemd`):** Criado e ativado `etheria-campus.service` com inicialização automática no boot do sistema operacional e reinicialização imediata em caso de falha.
  * **Banco PostgreSQL 16 em Produção:** Migrado com 100% dos dados originais (todos os 10 mapas, 20 portais, 34 NPCs, 14 monstros curados, classes, pets, montarias e 670 traduções).
* **Protocolo Rígido de Colaboração e Trabalho em Equipe entre IAs (Regra #8):**
  * Incluído no [`AGENTS.md`](AGENTS.md) e [`docs/HANDOFF.md`](docs/HANDOFF.md) o protocolo de não-regressão, aditividade de código, obrigatoriedade de `git pull origin main` no início de cada turno e atualização estrita de documentação antes de comitar.

---

## [v0.6.0] - 2026-11-10
### Combate, Criação & Customização (Personagens, Pets e Monstros)
* **Estilo de Combate Melee vs Ranged e Distância de Alcance Configurável:**
  * **Schema Prisma (`schema.prisma`):**
    * Adicionados os campos `combatStyle` (string default `"MELEE"`, mapeado para `combat_style`) e `attackRange` (int default `60`, mapeado para `attack_range`) nos modelos `ClassTemplate`, `PetTemplate` e `MonsterTemplate`.
    * Migração aplicada com sucesso no PostgreSQL via `prisma db push` e cliente regenerado.
  * **Controllers & APIs Autoritárias:**
    * Atualizados `AdminMapsController` (classes/personagens), `AdminPetsController` (pets) e `AdminMonstersController` (monstros) para receber, validar e persistir `combatStyle` (`MELEE` ou `RANGED`) e `attackRange`.
  * **Interface Admin (Studio Low-Code):**
    * Adicionado seletor de estilo de combate (`⚔️ Corpo a Corpo (Melee)` / `🏹 Longo Alcance (Ranged)`) e campo de distância de alcance (px) nas telas de criação e edição de:
      * **Classes / Personagens:** `AdminClassModalTemplate.js` e `AdminClassesTab.js`.
      * **Monstros:** `AdminMonstersTab.js`.
      * **Pets:** `AdminPetsTab.js`.
    * **Alternância Automática Inteligente (`AdminApp.onCombatStyleChange`):** Ao alternar entre Melee e Ranged no seletor, o campo de distância sugere automaticamente os padrões do sistema (`60px` para Melee, `220px` para Ranged), permitindo customização livre caso o admin queira definir valores diferentes.
    * **Badges Visuais:** Exibição clara nas tabelas administrativas com indicação de estilo e alcance (`⚔️ Melee (60px)` ou `🏹 Ranged (220px)`).
  * **Engine de Combate & Arena Action (`TemporaryCombatController.ts`, `ActionCombatArena.js`):**
    * Propagação das propriedades `combatStyle` e `attackRange` para jogadores, pets e monstros gerados nas batalhas.
    * Arena action respeita o raio de aproximação e renderiza projéteis de longo alcance teleguiados (`🏹`) para rangeds ou golpes diretos (`⚔️`) para melees.

---

## [v0.5.9] - 2026-11-10
### Segurança & Governança de IA
* **Nova Regra Mandatória para Agentes de IA — Cláusula 0.2 (`AGENTS.md`, `.gemini/rules/AGENTS.md`, `docs/HANDOFF.md`):**
  * **Proibição Absoluta de Alteração de Dados no Banco de Dados sem Autorização:** Fica terminantemente vedado a qualquer IA efetuar mutações, alterações de nome, edições ou exclusões em registros do banco de dados (ex: alterar nome de mapa, polígonos, NPCs, templates) sem autorização expressa e prévia do usuário.
  * **Proteção contra Testes com Mutações:** Scripts de teste, protótipos e verificações automatizadas nunca devem sobrescrever ou mutar registros reais das tabelas de configuração do usuário.
* **Restauração Completa do Mapa 4 ("Espaço Zen"):**
  * Revertidos com 100% de integridade todos os dados do Mapa 4 a partir do snapshot oficial do commit `de6bab8` (nome original "Espaço Zen", 23 polígonos de colisão, 34 polígonos de sobreposição, portais bidirecionais vinculados ao Mapa 2 e os 4 NPCs posicionados).
  * Atualização e exportação do snapshot JSON em `packages/database/snapshots/lowcode.snapshot.json`.

---

## [v0.5.8] - 2026-11-07
### Corrigido & Aprimorado
* **Restauração e Acesso Direto à Edição de Atributos e Habilidades na Tabela de Personagens (`AdminClassesTab.js`, `AdminClassModalTemplate.js`):**
  * **Botões de Ação Direta nas Colunas da Tabela:**
    * Na coluna **`Nome da Classe / Personagem`**: Adicionado o botão **`⚡ Editar Habilidades`** logo abaixo dos badges de skills do personagem, permitindo abrir o modal diretamente na checklist de habilidades vinculadas.
    * Na coluna **`Atributos Base Nv.1 (VIT/STR/INT/WIS/AGI/DEX)`**: Adicionado o botão **`📊 Editar Atributos & Combate`** e clique direto na célula, permitindo abrir o modal diretamente nos 6 atributos base, crescimento e projeções de combate.
    * Na coluna **`Ações`**: Substituído o botão genérico por ações granulares rápidas: **`🎨 Visual 2.5D`**, **`📊 Atributos`**, **`⚡ Habilidades`** e **`🗑️ Excluir`**.
  * **Destaque Visual das Abas no Modal de Personagens (`AdminClassModalTemplate.js`):**
    * As abas no topo do `#classModal` agora possuem bordas destacadas e títulos informativos claros: **`🎨 Visual & Posição 2.5D`**, **`📊 Atributos & Combate`** (em ciano), **`⚡ Habilidades`** (em amarelo), **`✨ Visual Reborn`** e **`📜 Lore / i18n`**, eliminando a sensação de que as funções haviam sumido da interface.
    * Abertura contextual direta: `AdminApp.openClassTemplateModal(classId, 'stats')` ou `('skills')` foca diretamente na aba solicitada sem forçar a tela de modelo visual.
  * **Melhorias de Produtividade na Aba de Habilidades do Personagem:**
    * Adicionados botões de atalho rápido no topo da checklist: **`☑️ Marcar Todas`**, **`⏹️ Desmarcar`** e **`⚡ Iniciais (1, 2, 4)`**.
    * Proteção contra perda acidental: ao salvar um personagem a partir de outras abas (visual ou atributos), o sistema preserva as habilidades pré-existentes caso o container de checkboxes ainda não tenha sido expandido.
  * **Modularização e Conformidade com a Regra #7:**
    * Transferência dos métodos de cálculo e preview derivado para `AdminClassModalTemplate.js` (417 linhas), mantendo `AdminClassesTab.js` em 899 linhas (estritamente abaixo de 1.000 linhas).

---

## [v0.5.7] - 2026-11-07
### Adicionado & Aprimorado
* **Hierarquia Master DEV acima de ADMIN (`AdminAuthService.ts`, `AdminUsersController.ts`, `schema.prisma`, `index.ts`):**
  * Criação do novo nível hierárquico `DEV` com poderes totais e irrestritos sobre todo o ecossistema `/admin` e o banco PostgreSQL.
  * Migração da conta do usuário `dev` (`id: 1`) para a role `DEV`.
  * Os usuários comuns permanecem como `ADMIN` (`gilbert`, `joao`, `bruno`).
  * Admins ficam estritamente abaixo do DEV: só podem visualizar e editar os dados da sua própria conta (nome de usuário, e-mail e senha), sem permissão para criar novas contas, deletar usuários ou alterar seus próprios cargos e permissões.
* **Matriz Granular de Permissões por Tabela (`tablePermissionsJson`, `AdminUsersTab.js`, `AdminAuth.js`, `AdminUsersController.ts`):**
  * Adição do campo `tablePermissionsJson` no modelo `UserAccount` e geração do Prisma Client.
  * O desenvolvedor (`DEV`) agora controla exatamente o que cada `ADMIN` pode fazer em cada tabela/módulo do estúdio:
    * `NONE` (Bloqueado): A aba desaparece do menu do admin e qualquer rota de API correspondente é bloqueada com HTTP 403.
    * `READ` (Apenas Leitura): O admin pode consultar dados e visualizar o conteúdo da tabela, mas qualquer tentativa de mutação (`POST`, `PUT`, `DELETE`) é barrada com HTTP 403 e aviso claro. Na interface, um banner de "Modo Somente Leitura" é exibido.
    * `READ_WRITE` (Acesso Total): Permissão irrestrita de consulta e edição para aquela tabela específica.
  * Cobertura completa das 9 tabelas gerenciadas: `MAPS`, `NPCS`, `CLASSES`, `MONSTERS`, `ATTRIBUTES`, `SKILLS`, `STATUS_EFFECTS`, `QUESTS` e `USERS`.
* **Painel Visual de Permissões no `/admin` (`AdminUsersTab.js`, `AdminAuth.js`, `index.html`):**
  * O DEV dispõe de um formulário interativo de permissões por tabela ao criar ou editar administradores, com botões de atalho rápido (**"Liberar Tudo (Read/Write)"**, **"Apenas Leitura (Read)"** e **"Bloquear Tudo (None)"**).
  * Admins visualizam a aba renomeada para **"🛡️ Minha Conta"**, onde podem alterar seus próprios dados de login e consultar um cartão visual com o status de cada permissão liberada pelo DEV.
  * Top bar com badge dinâmico diferenciando claramente `👑 DEV: dev` de `🛡️ ADMIN: username`.
* **Proteção e Conformidade Arquitetural:**
  * Trava de segurança no backend impedindo a exclusão acidental do último usuário `DEV`.
  * Validações centralizadas via `enforceTablePermission` em todas as rotas da API `/api/admin/*`.
  * Bateria de testes automatizados via Node Fetch validando autenticação, isolamento de contas de admin, bloqueio 403 em tentativas de criação de usuário por admins, travas de elevação de privilégio e controle de permissões `NONE` / `READ` / `READ_WRITE`.
  * Rigoroso respeito à Regra #7 (< 1.000 linhas por arquivo).

---

## [v0.5.6] - 2026-11-07
### Adicionado & Aprimorado
* **Atributos de Combate Derivados por Famílias — Acerto/Desvio, Hard CC e Anomalias/DoT (`seedData.ts`, `seed.ts`, `AdminAttributesController.ts`, `AdminAttributesTab.js`):**
  * Implementação da **Opção 1 (Por Famílias)** para o balanceamento de acerto e resistência a feitiços e efeitos de controle:
    * 🎯 **Acerto & Desvio Convencional:** `PHYS_ACCURACY` (Precisão Física) vs. `PHYS_EVASION` (Esquiva Física) e `MAG_ACCURACY` (Precisão Mágica) vs. `MAG_EVASION` (Desvio Mágico).
    * 💫 **Família de Controle (Hard CC):** `CONTROL_HIT` (Acerto de Controle) vs. `CONTROL_RESIST` (Resistência a Controle), cobrindo efeitos incapacitantes como Paralisia, Sono, Confusão, Silêncio e Congelamento.
    * 🧪 **Família de Anomalias & DoT:** `ANOMALY_HIT` (Acerto de Anomalias) vs. `ANOMALY_RESIST` (Resistência a Anomalias), cobrindo efeitos graduais e debuffs como Veneno, Queimadura, Sangramento e Cegueira.
    * 💚 **Recursos Vitais:** `MAX_HP`, `MAX_MP`, `HEAL_POWER`, `MP_REGEN`.
    * 🗡️ **Combate Físico & Mágico:** `PHYS_ATK`, `MAG_ATK`, `PHYS_DEF`, `MAG_DEF`, `PHYS_PEN`, `MAG_PEN`.
    * ⚡ **Iniciativa & Crítico:** `SPEED`, `CRIT_RATE`, `CRIT_DMG`.
* **Nova Aba `📊 Atributos & Conversões` no Estúdio Low-Code `/admin` (`AdminAttributesTab.js`, `AdminAttributesController.ts`):**
  * Nova tela dedicada no `/admin` para visualização e edição interativa dos **6 Atributos Base**, dos **21 Atributos de Combate** e da **Matriz Procedural de Conversões** (`attribute_conversions`).
  * Suporte a adição, remoção e edição de taxas de conversão (`ratioPerPoint`) com persistência no PostgreSQL e exportação automática de snapshot JSON para o Git.
* **Ficha de Combate Derivada em Tempo Real na Criação e Edição de Personagens (`AdminClassesTab.js`, `AdminClassModalTemplate.js`):**
  * Na aba **`📊 Atributos & Combate`** do modal `#classModal`, a ficha de combate derivada é calculada dinamicamente via `AdminApp.calculateCombatAttributes(baseAttrs)` à medida que o usuário edita `VIT`, `STR`, `INT`, `WIS`, `AGI` ou `DEX`.
  * Exibição detalhada de cada atributo com valor total e detalhamento da contribuição (`Base Padrão + Bônus`).
  * Ferramenta de **Simulação de Níveis (`Nv 1`, `Nv 10`, `Nv 50`, `Nv 100`)** que projeta o crescimento por nível (`+Atributo/Nv`) para facilitar o balanceamento das 12 classes jogáveis.
* **Visualização da Ficha de Combate na Tabela de Personagens (`AdminClassesTab.js`):**
  * A tabela de Personagens agora exibe diretamente na linha de cada classe um resumo visual com badges coloridos de seus atributos derivados de nível 1 (HP/MP, ATK/M.ATK, Precisão/Desvio, Hard CC Hit/Resist, DoT Hit/Resist).
* **Modularização Arquitetural e Conformidade com a Regra #7:**
  * Criação do módulo `AdminClassModalTemplate.js` (276 linhas), reduzindo `AdminClassesTab.js` para 968 linhas (mantendo-o estritamente abaixo do limite de 1.000 linhas).

---

## [v0.5.5] - 2026-11-07
### Corrigido & Aprimorado
* **Giro / Espelhamento Horizontal Real de NPCs Já Posicionados e Direto nas Tabelas sem Recriar (`McreworkSpriteSheet.js`, `AdminMapsController.ts`, `AdminNpcsTab.js`, `AdminCanvasEditor.js`, `AdminLayersDrawer.js`):**
  * **Espelhamento 2.5D Real no Sprite (`McreworkSpriteSheet.js`):** Como os sprites de NPCs no `mcrework` possuem 1 ângulo base desenhado no `atlas.json`, o motor `McreworkSpriteSheet.prototype.draw` agora aplica espelhamento horizontal exato no eixo dos pés (`flipX` quando `direction = 1`), fazendo o modelo 2.5D do NPC virar de lado visualmente a cada clique em **`🔄 Girar`**, tanto no `/admin` quanto no `/play`.
  * **Posicionar Primeiro e Girar Depois no Mapa (`AdminCanvasEditor.js`):** Removido o seletor prévio de 8 direções; agora você posiciona o NPC normalmente no mapa e gira ele **já posicionado** (tocando em cima do próprio NPC no mapa, clicando em **`🔄 Girar #X Nome`** na barra superior ou na Gaveta Lateral `🗂️ Camadas`).
  * **Edição/Giro Direto dos NPCs Já Registrados nas Tabelas sem Apagar (`AdminNpcsTab.js`, `AdminLayersDrawer.js`, `POST /api/admin/map-npcs/:id/rotate`):**
    * Na aba **`🧙 Tabela de NPCs`** (e dentro do modal **`✏️ Editar NPC`**), cada mapa onde o NPC já está registrado exibe um botão **`🔄 Girar`** ao lado da miniatura que gira e salva diretamente no PostgreSQL (`map_npcs`) com 1 clique, sem precisar apagar e criar novamente.
    * Na **Ficha Técnica do Mapa** (aba **`🗺️ Mapas`**), adicionada a faixa **🧙 NPCs Posicionados neste Mapa** com botão **`🔄 Girar`** direto para cada NPC já registrado no mapa.

---

## [v0.5.4] - 2026-11-07
### Adicionado & Aprimorado
* **Calibração Realista de Personagens no Mapa #1 + Alinhamento de Sombra (`AdminClassesTab.js`, `AdminMapsController.ts`, `GamePlayController.ts`, `McreworkSpriteSheet.js`, `play.js`):**
  * Substituído o preview genérico do modal de Personagens (`#classModal`) por um **Palco `<canvas>` 2.5D renderizando o Mapa #1 real (`/api/assets/map-image/1`)** (com suporte a arrastar o piso do Mapa #1, alternar ações `🧍 Parado`, `🏃 Andar`, `🗡️ Golpe` e girar as 8 direções) tanto para o visual **🎨 Padrão** quanto para o visual **✨ Reborn**.
  * Adicionados os campos `shadowOffsetX`, `shadowOffsetY`, `rebornShadowOffsetX` e `rebornShadowOffsetY` na tabela `class_templates` (`schema.prisma`), com controles finos de alinhamento horizontal (Eixo X) e vertical (Eixo Y) da sombra elíptica embaixo do personagem no `/admin` e refletidos em tempo real no `/play`.
* **Renderização do Modelo Original 2.5D do NPC + Rotação de Direção no Editor de Mapas (`AdminCanvasEditor.js`, `AdminLayersDrawer.js`, `admin/index.html`):**
  * Substituído o círculo placeholder verde dos NPCs no `<canvas>` do Editor Visual de Mapas pela renderização do **modelo 2.5D original do NPC (`McreworkSpriteSheet`)** na sua direção exata (`0..7`).
  * Adicionado seletor de **8 Direções Isométricas (`0: ⬇ Sul` a `7: ↘ Sudeste`)** e botão **`🔄 Girar`** tanto na barra flutuante `#npcQuickBar` quanto na lista de NPCs posicionados na gaveta lateral (`#npcsList`), além de permitir girar um NPC tocando diretamente nele com a ferramenta `🧙 +NPC` ativa.
* **Arena de Batalha 2.5D Realista com Modelos Cadastrados no Preview de Habilidades e Buffs/Debuffs (`AdminArenaPreview.js`, `AdminSkillsAndBuffsTab.js`, `AdminStatusEffectsTab.js`):**
  * Novo módulo dedicado `AdminArenaPreview.js` que substitui a silhueta estática por um **Palco de Arena de Batalha 2.5D (`480x210`)** posicionando os modelos 2.5D reais já cadastrados nas tabelas de **Personagens (`class_templates`)** e **Monstros (`monster_templates`)** alinhados em batalha (`1x1 Duelo` ou `1x3 Formação de Batalha`).
  * Simula em tempo real (e sob demanda via botão **`▶️ Simular Golpe / Testar Efeito Agora`**) a coreografia completa da habilidade: corrida até o alvo (`MELEE_ADVANCE`) ou conjuração no lugar (`STAND_IN_PLACE`), animação de ataque/magia do conjurador, disparo do **Efeito Especial (VFX)** no(s) alvo(s) conforme o alcance (`SELF`, `MELEE_FRONTLINE`, `ALL_ENEMIES`), animação de reação de dano (`Hit`), números flutuantes e **ícone de Buff/Debuff flutuando na cabeça do alvo**.

---

## [v0.5.3] - 2026-11-07
### Adicionado & Aprimorado
* **Progressão Linear por Capítulos e Episódios (`1-1` ➔ `1-2` ➔ `1-3` ===> `2-1` ➔ `2-2`) (`schema.prisma`, `AdminQuestsController.ts`, `AdminQuestsTab.js`):**
  * Adicionado o campo `episodeOrder` em `QuestTemplate` (`quest_templates`), compondo os códigos de Episódio (`1-1`, `1-2`, `1-3`, `2-1`, `2-2`...).
  * **Trava Linear Automática para Missões Principais (`MAIN`):**
    * O Episódio `E` de um capítulo (`1-2`, `1-3`...) só é desbloqueado quando o Episódio `E-1` (`1-1`, `1-2`...) do mesmo capítulo foi concluído (`TURNED_IN`).
    * O Capítulo `C` (`2-1`, `3-1`...) só é desbloqueado quando **todos os episódios do Capítulo `C-1`** foram concluídos.
* **Quadro Visual de Fluxo Estilo Draw.io Agrupado por Capítulos (`AdminQuestsTab.js`):**
  * Nova visão padrão **`🗺️ Quadro Draw.io (Capítulos)`** na aba `📜 Quests` do `/admin` (com alternância rápida para `📋 Visão em Tabela`).
  * Agrupa visualmente os cards de missões dentro de containers de **Capítulos (`📘 CAPÍTULO 1`, `📘 CAPÍTULO 2`...)** sobre um canvas estilo Draw.io:
    * Os Episódios Principais (`1-1`, `1-2`, `1-3`) ficam encadeados horizontalmente com setas conectoras **`🔒 Libera 1-2 ───▶`** e portões visuais entre capítulos (**`🔒 PORTÃO DE CAPÍTULO: Concluir todos os episódios do Capítulo 1 libera o Capítulo 2 ▼`**).
    * Botões rápidos dentro de cada container de capítulo para criar o próximo episódio (`➕ Novo Episódio Principal (1-4)`) ou criar um novo capítulo (`📘 ➕ Criar Novo Capítulo`).
* **Gatilho de Acionamento (`triggerType`) e Requisitos (`requirementsJson`) Obrigatórios em Todos os Tipos de Quests (`AdminQuestsController.ts`, `AdminQuestsTab.js`, `PlayQuestsController.js`):**
  * Adicionado suporte No-Code a **Gatilhos de Acionamento** em todas as categorias (`MAIN`, `SIDE`, `EPIC`, `PROFICIENCY`):
    * `💬 Interagir / Falar com o NPC de Início` (`NPC_INTERACT`)
    * `⚡ Automático ao Concluir Episódio Anterior` (`AUTO_ON_PREV_QUEST`, com opção de auto-aceitar imediatamente)
    * `🗺️ Ao Entrar em um Mapa Específico` (`ENTER_MAP`)
    * `⭐ Ao Atingir o Nível Mínimo` (`REACH_LEVEL`)
    * `🐉 Ao Derrotar um Monstro Específico` (`KILL_MONSTER_TRIGGER`)
  * Adicionado bloco completo de **Requisitos de Desbloqueio**: Nível Mínimo, Episódio/Quest Pré-Requisito, Exigência de Capítulo Completo, Classe, Elemento e Estado `Reborn`.

---

## [v0.5.2] - 2026-11-07
### Adicionado
* **Estúdio Visual No-Code de Quests (`📜 Quests` — `quest_templates`) (`AdminQuestsController.ts`, `AdminQuestsTab.js`, `schema.prisma`):**
  * Nova aba `📜 Quests` no Studio `/admin` com suporte às 4 categorias de missão:
    * `🟡 Principal (MAIN)`: Linear, acompanhando o progresso do jogador com Ordem do Capítulo (`chapterOrder`) e encadeamento automático de Quest Pré-requisito (`prerequisiteQuestId`).
    * `🔵 Secundária (SIDE)`: Missões paralelas e regionais.
    * `🟣 Épica (EPIC)`: Grandes marcos da jornada (incluindo gatilho opcional de Despertar `Reborn`).
    * `🟢 Proficiência (PROFICIENCY)`: Categoria única de Proficiência (estilo secundárias).
  * **Seletor Inteligente de NPC + Restrição de Mapa com Nível Recomendado (`giverMapId` / `turnInMapId`):**
    * Como um mesmo NPC pode estar posicionado em mais de um mapa (ex.: *Izumo* e *Dong Xuen*), o Admin pode escolher se o jogador pega ou entrega a missão **em qualquer mapa onde esse NPC estiver (`null`)** ou **somente em um mapa específico**.
    * Todos os seletores de mapas na criação/edição da Quest exibem o **Nível Recomendado do Mapa (`Nv. X`)** e destacam visualmente em quais mapas o NPC selecionado está posicionado (`📍 #1 Vila Izumo (Nv.1) — ⭐ [NPC posicionado neste mapa]`).
  * **Construtor Visual de Objetivos (`objectivesJson`) & Recompensas (`rewardsJson`):**
    * Blocos visuais para `👹 Derrotar Monstro Específico`, `⚔️ Vencer Batalhas (Qualquer Monstro)`, `💬 Conversar com NPC` e `🗺️ Visitar Mapa`, cada um com filtro opcional de mapa exibindo o nível do mapa.
    * Recompensas configuráveis de EXP, Ouro, Pontos de Atributo Livres e Despertar `Reborn`.
  * Semeadas 5 Quests iniciais cobrindo `MAIN` (Cap. 1 e Cap. 2 encadeados), `SIDE`, `PROFICIENCY` e `EPIC`.
* **Indicadores Visuais de Missão na Cabeça dos NPCs e Diário de Quests no `/play` (`PlayQuestsController.js`, `play.js`, `TemporaryCombatArena.js`):**
  * Renderização em tempo real no `<canvas>` 2.5D dos indicadores acima da cabeça dos NPCs conforme o estado do jogador no mapa atual:
    * **`!` colorido em Vermelho (`#ff2e4c`)**: Para missões disponíveis para o jogador aceitar naquele NPC.
    * **`?` colorido em Cinza (`#94a3b8`)**: Para missões em andamento.
    * **`?` colorido em Vermelho (`#ff2e4c`)**: Para missões concluídas aguardando o jogador concluir/entregar no NPC.
  * Modal interativo de Diálogo e Missões ao interagir/tocar no NPC (`openNpcQuestModal`), avançando automaticamente objetivos de conversa (`TALK_NPC`) e permitindo aceitar ou concluir missões com entrega imediata de EXP, Ouro, Level-Up e Reborn.
  * Integração automática com a Arena 2.5D (`recordBattleVictoryProgress`) para contabilizar abates de monstros nas missões ativas do personagem.

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
