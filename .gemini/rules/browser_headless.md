---
trigger: always_on
description: Regra de operação estrita de navegador em modo oculto/headless e segundo plano
---
# Regra de Operação de Navegador em Modo Oculto (Headless / Background)

Sempre que a IA ou qualquer ferramenta/subagente utilizar automação de navegador (Chrome DevTools MCP, Puppeteer, Playwright, Selenium, browser subagent ou scripts web):
1. **Obrigatório Modo Oculto / Headless:**
   * Utilizar sempre parâmetros de background/headless (`headless: true`, abas abertas com `background: true`).
2. **Proibido Abrir Janelas Visíveis na Tela:**
   * É terminantemente proibido abrir janelas de navegador visíveis ou abas que saltem na tela do usuário "do nada" sem solicitação explícita.
3. **Execução Silenciosa:**
   * Toda inspeção de rotas (`/admin`, `/play`), execução de scripts ou testes visuais deve ocorrer em segundo plano, sem roubar o foco da tela do usuário.
