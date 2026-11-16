# Padrões e Diretrizes de Alta Performance (60+ FPS) - Etheria: Campus

Este documento estabelece as regras de arquitetura, otimização gráfica e gestão de memória do client de exploração e combate (`/play`). O cumprimento rigoroso destas diretrizes é obrigatório para qualquer novo desenvolvimento, efeito visual (VFX) ou módulo adicionado ao jogo, garantindo **60+ FPS cravados e estáveis** mesmo em smartphones intermediários com telas de alta resolução e taxa de atualização elevada.

---

## 1. Dispositivo e Hardware Alvo de Referência

- **Dispositivo de Homologação:** Xiaomi Redmi Note 14 Pro
- **Processador / SoC:** MediaTek Dimensity 7300-Ultra (4nm)
- **GPU:** ARM Mali-G615 MC2 (Arquitetura TBDR - Tile-Based Deferred Rendering)
- **Tela:** AMOLED 1.5K (2712 x 1220 pixels, ~446 ppi) @ **120Hz**
- **Ambiente de Execução:** Chromium Mobile / Android WebView
- **Critério de Aceite:** Framerate estável de **60 FPS** tanto em exploração quanto na Arena de Batalha com efeitos do Véu ativos, sem quedas abaixo de 58 FPS, sem picos de Garbage Collector e sem aquecimento térmico (thermal throttling).

---

## 2. As 5 Diretrizes de Ouro de Performance do Client

### 🛑 Diretriz 1: Proibição Estrita de `ctx.shadowBlur` e `ctx.filter` em Loops Contínuos

> [!CAUTION]
> **NUNCA** utilize `ctx.shadowBlur > 0` ou `ctx.filter = '...'` dentro de funções chamadas a cada frame (`gameLoop`, partículas, raios, sprites, auras contínuas).

- **O Problema Técnico:**
  GPUs mobile modernas (Mali e Adreno) utilizam rasterização em blocos (*tiles*). Propriedades como `shadowBlur` e `filter` forçam a engine Canvas 2D a:
  1. Alocar uma textura intermediária offscreen.
  2. Renderizar o elemento na textura.
  3. Aplicar múltiplos passes de convolução gaussiana na GPU.
  4. Recompor a textura no framebuffer principal.
  Com apenas 20 partículas ou um boss na tela, isso pode consumir mais de **15ms por frame**, tornando 60 FPS matematicamente impossíveis.

- **O Padrão Obrigatório:**
  1. **Para Partículas e Esporos:** Pré-renderizar uma única vez texturas de halo bioluminescente em canvas offscreen (ex: 32x32px) no construtor do renderer (`ActionVfxRenderer.createParticleGlowTexture()`) e desenhá-las em tempo real com `ctx.drawImage(tex, x, y, w, h)` com `ctx.globalAlpha`. O blit de textura consome menos de **0.002ms** por partícula.
  2. **Para Pontas de Tentáculos e Relâmpagos:** Utilizar desenho concêntrico de duas camadas:
     - Camada externa: traço ou círculo mais largo com cor primária translúcida (`rgba(..., 0.3)`).
     - Camada interna: traço ou círculo fino com núcleo incandescente (`rgba(255, 255, 255, 0.9)`).
  3. **Para Auras de Boss/Leader:** Utilizar elipses vetoriais concêntricas preenchidas e contornadas no chão da arena, sem filtros no sprite do monstro.

---

### 🖥️ Diretriz 2: Delegação de Efeitos Fullscreen ao Compositor CSS da GPU

> [!IMPORTANT]
> Gradientes de tela cheia, vinhetas cinematográficas e sobreposições atmosféricas estáticas **NÃO** devem ser renderizados via `ctx.createRadialGradient()` e `ctx.fillRect()` no Canvas 2D a cada frame.

- **O Problema Técnico:**
  Em telas 1.5K (2712x1220), um `fillRect` com gradiente radial em tela cheia força o processamento de mais de **3,3 milhões de fragmentos por frame** diretamente na thread do Canvas.

- **O Padrão Obrigatório:**
  - Crie um elemento overlay no DOM (ex: `#veilVignetteOverlay`) com posicionamento fixo (`inset: 0`), `pointer-events: none` e aceleração por hardware nativa (`transform: translateZ(0)`).
  - Controle a visibilidade adicionando/removendo a classe `.active`.
  - O navegador delega esse efeito diretamente ao Compositor nativo do sistema operacional (SurfaceFlinger no Android), executando em uma camada de hardware independente com custo computacional **ZERO** na thread do Canvas.

---

### ⏱️ Diretriz 3: Trava Estrita de 60 FPS em Telas Mobile de Alta Frequência (90Hz / 120Hz)

> [!TIP]
> Telas modernas de smartphones operam em 120Hz por padrão. Rodar o loop a 120 FPS em resolução 1.5K esgota a bateria e aciona o thermal throttling do SoC em minutos.

- **O Padrão Obrigatório:**
  No início do `gameLoop(now)` em `play.js`:
  ```javascript
  const elapsed = now - this.lastFrameTime;
  if (elapsed < 15.5) {
    requestAnimationFrame((t) => this.gameLoop(t));
    return;
  }
  const dt = Math.min(0.05, elapsed / 1000);
  this.lastFrameTime = now;
  ```
  - Isso garante um intervalo mínimo de ~16.0ms (~60-62.5 FPS).
  - O orçamento de frame sobe de 8.3ms para 16.6ms (100% a mais de folga para a GPU).
  - O dispositivo se mantém frio, estável e livre de engasgos durante sessões longas de jogo.

---

### ♻️ Diretriz 4: Alocação Zero (Zero-Alloc) e Object Pooling na Fila de Renderização

> [!WARNING]
> Nunca instancie arrays ou novos objetos literais dentro do `renderWorld` ou métodos chamados 60 vezes por segundo.

- **O Problema Técnico:**
  Fazer `const renderQueue = []` e empurrar dezenas de `{ type: '...', y: ..., data: ... }` todo frame gera de 1.800 a 10.000 novos objetos descartados por segundo. A engine V8 do Chrome é forçada a executar ciclos frequentes de Scavenge Garbage Collection (pausas de 10 a 30ms), causando os infames "micro-stutters".

- **O Padrão Obrigatório:**
  Utilizar pooling estático permanente:
  ```javascript
  // No construtor:
  this._renderQueue = [];
  this._renderPool = [];
  this._renderQueue.pushItem = (t, y, d) => this.pushRenderItem(t, y, d);

  // Método de reciclagem:
  pushRenderItem(type, y, data) {
    let item = this._renderPool.pop();
    if (!item) item = { type, y, data };
    else { item.type = type; item.y = y; item.data = data; }
    this._renderQueue.push(item);
  }

  // No renderWorld:
  for (let i = 0; i < this._renderQueue.length; i++) {
    this._renderPool.push(this._renderQueue[i]);
  }
  this._renderQueue.length = 0;
  ```

---

### 💾 Diretriz 5: Cache Inteligente de Gradientes Geométricos

- Criar instâncias de `CanvasGradient` repetidamente no chão da arena invalida o cache interno do Skia/Chromium.
- Armazene o gradiente em cache (`this.floorGradCache`) e somente o recrie quando as dimensões ou o centro da arena forem modificados (`gradKey !== this.lastFloorGradKey`).

---

## 3. Checklist Obrigatório para Novos Efeitos e Telas

Antes de aprovar qualquer PR ou commit contendo novos efeitos gráficos ou mecânicas no client `/play`:

1. [ ] Nenhum `ctx.shadowBlur` ou `ctx.filter` presente em loops contínuos.
2. [ ] Partículas novas utilizam texturas offscreen pré-renderizadas (`drawImage`).
3. [ ] Overlays de tela cheia utilizam elementos HTML/CSS acelerados por hardware.
4. [ ] O `gameLoop` preserva a trava de 60 FPS (`elapsed < 15.5`).
5. [ ] A fila de renderização (`renderQueue`) utiliza reciclagem via `pushItem` sem alocar objetos `{}` na heap.
6. [ ] Todos os arquivos de código permanecem estritamente abaixo do limite de 1.000 linhas (**Regra de Arquitetura #7**).
7. [ ] Homologação realizada com simulação de viewport mobile e GPU throttling em 60 FPS estáveis.
