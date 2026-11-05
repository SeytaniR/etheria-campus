# 🤝 Diário de Passagem de Turno entre IAs (`HANDOFF.md`)

> **INSTRUÇÃO OBRIGATÓRIA PARA A IA QUE ESTÁ ASSUMINDO O TURNO:**
> 1. Leia `AGENTS.md` e `CHANGELOG.md` antes de qualquer ação.
> 2. Confira abaixo o **Estado Atual** e a **Próxima Tarefa Exata da Fila**.
> 3. Antes de encerrar seu turno, atualize este arquivo, incremente a versão no `CHANGELOG.md` e faça `git commit` + `git push`.

---

## 📌 Status Atual do Projeto
* **Versão Atual:** `v0.1.0`
* **Última Atualização:** `2026-11-05`
* **Fase Atual:** **Fase 1 concluída (Fundação, Governança de IA, Documentação Mestra & GitHub Pages) $\rightarrow$ Iniciando Fase 2 (Tabelas do Banco de Dados & Conector Low-Code `/admin`)**
* **Repositório Oficial:** `https://github.com/SeytaniR/etheria-campus`
* **Fonte Bruta de Assets:** `https://github.com/SeytaniR/mcrework` (`https://seytanir.github.io/mcrework/`)

---

## ✅ Resumo do Último Turno Concluído (Turno #001)
1. Criação do repositório público **`SeytaniR/etheria-campus`** com pipeline automático para **GitHub Pages**.
2. Definição e gravação da **Constituição Rígida das IAs (`AGENTS.md` e `.gemini/rules/AGENTS.md`)** incluindo:
   * **Cláusula 0 (Regra Anti-Vibe-Coder):** Obrigação da IA de questionar qualquer pedido que viole Segurança (Servidor Autoritário), Performance, Orientação a Objetos, Motor Procedural ou Coerência Lógica.
   * **Regra da Curadoria (Whitelist no Banco):** O repositório `mcrework` é apenas uma galeria bruta; só entra no jogo o que for cadastrado nas tabelas do nosso banco de dados.
   * **Regra de Código Comentado para IAs:** Cabeçalhos `@file`, `@module`, `@description`, `@rules` e TSDoc em todas as classes/métodos.
   * **Regra de Versionamento Incremental:** Atualização obrigatória do `CHANGELOG.md`.
3. Documentação completa da **Arquitetura e Combate 5B em Arena 10x10 (`docs/ARCHITECTURE.md`)**:
   * **10 Slots de cada lado** (5 Vanguarda + 5 Retaguarda) para caçadas em massa e PvP 5v5.
   * **Regra de Pets por Tamanho do Grupo (sem vantagem de classe):**
     * **Solo (1 Jogador) ou Dupla (2 Jogadores):** `1 Personagem + até 3 Pets` por jogador.
     * **Grupo de 3 a 5 Jogadores:** `1 Personagem + 1 Pet` por jogador.
     * **Capitão/Solo** escolhe a formação de batalha nos 10 slots.
   * **Modo 5B:** Pontos de Turno (AP) + Posições Pré-Definidas com Alcance + Planejamento Simultâneo ("We-Go").
4. Documentação da **Modelagem de Tabelas Procedurais e Low-Code (`docs/DATABASE_SCHEMA.md`)**.

---

## 🎯 Próxima Tarefa Exata da Fila (Para o Próximo Turno)
* **Objetivo (Fase 2 - Passo 1):**
  1. Inicializar a estrutura de pacotes do Monorepo TypeScript (`package.json`, `tsconfig.base.json`, `packages/shared`, `packages/database`, `packages/asset-bridge`, `apps/server`, `apps/client`).
  2. Criar o `schema.prisma` (ou migrações SQL/TypeScript equivalentes) implementando exatamente as tabelas documentadas em `docs/DATABASE_SCHEMA.md` (Biomas, Tipos de Mapa, Mapas com progressão de 10 em 10, Portais, NPCs, Atributos Base, Atributos de Combate, Matriz de Conversão, Classes, Raridades, Monstros, Formações de 10 Slots, Skills, Itens e `i18n`).
  3. Criar as classes Orientadas a Objetos do Motor Procedural em `@etheria/shared` (`StatCalculator`, `MapRuleResolver`, `ArenaFormationValidator` com a regra de 10 slots e limite de pets Solo/Dupla vs 3+ jogadores).
