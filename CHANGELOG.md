# 📦 CHANGELOG — Etheria Campus

Todas as alterações notáveis deste projeto são documentadas neste arquivo seguindo **Semantic Versioning (`vMAJOR.MINOR.PATCH`)**.
Qualquer IA trabalhando neste repositório **DEVE** incrementar a versão e registrar suas entregas aqui antes de encerrar o turno.

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
