# ⚔️ Etheria Campus — Modern Tactical 2.5D MMORPG

Bem-vindo ao repositório oficial do **Etheria Campus**, um MMORPG 2.5D tático construído do zero com arquitetura **Orientada a Objetos**, **Motor de Regras Procedurais**, **Servidor Autoritário**, **Studio Low-Code (`/admin`)**, **Painel Game Master (`/gm`)** e **Cliente Multiplataforma (WebGL / Android APK)** utilizando o acervo visual convertido no repositório [`SeytaniR/mcrework`](https://github.com/SeytaniR/mcrework).

---

## 📚 Documentação Mestra (Leitura Obrigatória para IAs Desenvolvedoras)

> ⚠️ **REGRA PARA IAs (CONTA 1 E CONTA 2):** Antes de executar qualquer tarefa neste repositório, leia obrigatoriamente os documentos abaixo na ordem indicada:

1. 🛡️ **[`AGENTS.md`](./AGENTS.md)** — Constituição Rígida das IAs, Cláusula 0 ("Regra Anti-Vibe-Coder"), Regra da Curadoria (Whitelist no Banco), Padrão de Comentários para Contexto de IA e Regras de Versionamento.
2. 🤝 **[`docs/HANDOFF.md`](./docs/HANDOFF.md)** — Diário de Passagem de Turno entre as duas contas de IA (Estado Atual e Próximo Passo da Fila).
3. 📦 **[`CHANGELOG.md`](./CHANGELOG.md)** — Histórico de versões incrementais (`SemVer`).
4. 🏛️ **[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)** — Arquitetura dos 6 Módulos OO, Arena 10x10 Slots (Modo 5B), Regra de Pets e Solução Mobile Anti-CGNAT.
5. 🗄️ **[`docs/DATABASE_SCHEMA.md`](./docs/DATABASE_SCHEMA.md)** — Modelagem completa das tabelas Low-Code e Procedurais.

---

## 🎮 Pilares do Game Design & Engenharia

* **Curadoria Estrita no Banco de Dados:** O repositório `mcrework` atua exclusivamente como uma galeria bruta de arquivos. **Somente o que for cadastrado nas tabelas do nosso banco de dados através da rota `/admin` passa a existir no jogo.**
* **Mundo Procedural por Tabelas Low-Code:**
  * **Progressão de Nível (10 em 10):** Mapa 1 = Nv. 1, Mapa 2 = Nv. 10, Mapa 3 = Nv. 20...
  * **Duplo Bioma & 6 Tipos de Mapa:** Cidade, Vila, Subúrbio, Masmorra, Zona Hostil e Zona de Conflito (PvP Aberto).
  * **Derivação Procedural de Atributos:** Atributos Base (`VIT`, `STR`, `INT`, `AGI`, `DEX`, `WIL`) convertem-se matematicamente em Atributos de Combate (`HP`, `MP`, `Ataque`, `Defesa`, `Velocidade`, `Crítico`, `Esquiva`, `AP`) tanto para Jogadores quanto para Monstros escalados por Nível e Raridade.
* **Combate em Arena Isolada 10x10 Slots (Modo 5B):**
  * Encontros ao caminhar em mapas de monstros ou desafios PvP instanciam uma arena com **10 Slots de cada lado** (5 na Vanguarda + 5 na Retaguarda), permitindo caçadas em massa e **PvP 5v5**.
  * **Regra de Pets por Tamanho da Equipe (Sem vantagem de classe):**
    * **Solo (1 Jogador) ou Dupla (2 Jogadores):** `1 Personagem + até 3 Pets` por jogador.
    * **Grupo de 3 a 5 Jogadores:** `1 Personagem + 1 Pet` por jogador.
    * O **Capitão/Solo** define a formação da equipe nos 10 slots.
  * **Execução 5B:** Pontos de Turno (AP) + Posições Pré-Definidas com bloqueio de alcance na Vanguarda + Planejamento Simultâneo ("We-Go") resolvido por Velocidade.
* **Layout Camaleão 100% Responsivo & `i18n`:** Adaptável automaticamente para PC, Tablet, Celular Horizontal e Celular Vertical, com suporte nativo a múltiplos idiomas.

---

## 📱 Acesso Rápido (GitHub Pages)

* 🌐 **Portal Web / Mobile:** [https://seytanir.github.io/etheria-campus/](https://seytanir.github.io/etheria-campus/)
