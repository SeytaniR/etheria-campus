# ⚔️ Etheria Campus — Modern Tactical 2.5D MMORPG

Bem-vindo ao repositório oficial do **Etheria Campus**, um MMORPG 2.5D tático construído do zero com arquitetura **Orientada a Objetos**, **Motor de Regras Procedurais**, **Servidor Autoritário**, **Studio Low-Code (`/admin`)**, **Painel Game Master (`/gm`)** e **Cliente Multiplataforma (WebGL / Android APK)** utilizando o acervo visual do repositório [`SeytaniR/mcrework`](https://github.com/SeytaniR/mcrework).

---

## 📚 Documentação Mestra (Leitura Obrigatória para IAs Desenvolvedoras)

> ⚠️ **REGRA PARA IAs (CONTA 1 E CONTA 2):** Antes de executar qualquer tarefa neste repositório, leia obrigatoriamente os documentos abaixo na ordem indicada:

1. 🛡️ **[`AGENTS.md`](./AGENTS.md)** — Constituição Rígida das IAs, Cláusula 0 ("Regra Anti-Vibe-Coder"), Cláusula 0.1 (Proibição de Código Não Solicitado / Escopo Estrito), Regra da Curadoria (Whitelist no Banco), Padrão de Comentários para Contexto de IA e Versionamento.
2. 🤝 **[`docs/HANDOFF.md`](./docs/HANDOFF.md)** — Diário de Passagem de Turno entre as duas contas de IA (Estado Atual e Próximo Passo da Fila).
3. 📦 **[`CHANGELOG.md`](./CHANGELOG.md)** — Histórico de versões incrementais (`SemVer`).
4. 🏛️ **[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)** — Arquitetura dos 6 Módulos OO, 5 Tipos de Mapa com Dominação, 40 Biomas, 5 Elementos, 11 Raças, Cálculo de Dano e Arena 10x10 Slots (Modo 5B).
5. 🗄️ **[`docs/DATABASE_SCHEMA.md`](./docs/DATABASE_SCHEMA.md)** — Modelagem completa das tabelas Low-Code e Procedurais.

---

## 🎮 Pilares Consolidados do Jogo (`v0.1.2`)

* **Curadoria Estrita no Banco de Dados (Whitelist):** O repositório `mcrework` é apenas uma galeria bruta de arquivos. **Somente o que for cadastrado nas tabelas do nosso banco de dados através da rota `/admin` passa a existir no jogo.**
* **5 Tipos de Mapa (Com Dominação, Spawn e PvP Fixos no Tipo):**
  * **Cidade (`CITY`) e Vila (`VILLAGE`):** Dominadas por **Alianças**, sem spawn de monstros, PvP apenas por **Duelo Aceito**.
  * **Subúrbio (`SUBURB`):** Dominado por **Facções**, spawna monstros, PvP apenas por **Duelo Aceito**.
  * **Zona Hostil (`HOSTILE_ZONE`):** Dominada por **Facções**, spawna monstros, permite **PvP Forçado (PK)** (quem força torna-se **Criminoso**).
  * **Zona de Conflito (`CONFLICT_ZONE`):** Dominada por **Facções**, spawna monstros, **PvP Totalmente Aberto**.
* **40 Biomas (`Mapa ↔ Bioma ↔ Monstro`):** Função 100% dedicada ao cruzamento procedural de spawn de monstros nos mapas (sem vínculo com elementos ou dano).
* **5 Elementos na Entidade (`±25%`):**
  * Ciclo Ativo: 🔥 **Fogo > 🌿 Terra > 💨 Ar > 🌊 Água > 🔥 Fogo**.
  * **Neutro (`NEUTRAL`):** Penalidade de `-25%` de dano causado e `+25%` de dano recebido.
  * Monstros têm elemento fixo na tabela; Personagens e Pets sorteiam elemento inicial (`10%` Neutro, `20%` para cada elemento ativo), alterável no futuro via item.
* **11 Raças (`+10%` de Vantagem):**
  * **Humanos (`HUMAN`):** `+10%` sobre todas as raças.
  * **Ciclo das 10 Raças (`+10%`):** `Plantas > Dragões > Reptilianos > Aquáticos > Robóticos > Celestiais > Demônios > Fadas > Espíritos > Selvagens > Plantas`.
* **Combate em Arena Isolada 10x10 Slots (Modo 5B):**
  * **10 Slots de cada lado** (5 Vanguarda + 5 Retaguarda) para caçadas em massa e **PvP 5v5**.
  * **Solo ou Dupla:** `1 Personagem + até 3 Pets` por jogador.
  * **Grupo de 3 a 5 Jogadores:** `1 Personagem + 1 Pet` por jogador (sem vantagem de classe).
  * **Execução 5B:** Pontos de Turno (AP) + Posições com Alcance + Planejamento Simultâneo ("We-Go").
