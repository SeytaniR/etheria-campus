# 🤝 Diário de Passagem de Turno entre IAs (`HANDOFF.md`)

> **INSTRUÇÃO OBRIGATÓRIA PARA A IA QUE ESTÁ ASSUMINDO O TURNO:**
> 1. Leia `AGENTS.md` e `CHANGELOG.md` antes de qualquer ação.
> 2. Confira abaixo o **Estado Atual** e a **Próxima Tarefa Exata da Fila**.
> 3. Antes de encerrar seu turno, atualize este arquivo, incremente a versão no `CHANGELOG.md` e faça `git commit` + `git push`.

---

## 📌 Status Atual do Projeto
* **Versão Atual:** `v0.8.0`
* **Última Atualização:** `2026-11-11`
* **Fase Atual:** **Arena 1300px, Colisão Física Universal & IA Tática de Equipe (`v0.8.0`) — Arena ampliada para 1300x940 px com maior separação inicial entre times, solver de colisão elíptica entre todos os modelos (zero acúmulo de sombras) e IA tática para Pets e Monstros (Tank protege Rangeds, Top DPS foca dano, Frágil ataca pelas bordas/longo alcance, Ranged abriga-se atrás de Melee e aceita luta corpo a corpo quando encurralado).**
* **Repositório Oficial:** `https://github.com/SeytaniR/etheria-campus`
* **Fonte Bruta de Assets:** `https://github.com/SeytaniR/mcrework` (`https://seytanir.github.io/mcrework/`)

---

## ✅ Decisões Consolidadas na Documentação (`v0.1.2` a `v0.4.2`)
1. **Regra de Escopo Estrito (Cláusula 0.1):** Proibido criar simuladores, mocks ou código não solicitado; dúvidas devem ser perguntadas antes de codificar.
2. **Regra da Curadoria (Whitelist):** O repositório `mcrework` é apenas galeria bruta; só entra no jogo o que estiver salvo nas tabelas do nosso banco de dados.
3. **5 Tipos de Mapa (Com Dominação, Spawn e PvP fixos no Tipo):**
   * `CITY` e `VILLAGE`: Dominadas por **Alianças**, sem spawn de monstros, PvP apenas por **Duelo Aceito**.
   * `SUBURB`: Dominado por **Facções**, spawna monstros, PvP apenas por **Duelo Aceito**.
   * `HOSTILE_ZONE`: Dominada por **Facções**, spawna monstros, permite **PvP Forçado (PK)** (quem força vira **Criminoso**).
   * `CONFLICT_ZONE`: Dominada por **Facções**, spawna monstros, **PvP Totalmente Aberto**.
4. **40 Biomas:** Função 100% dedicada ao vínculo procedural de spawn **`Mapa <-> Bioma <-> Monstro`** (zero relação com elementos ou cálculo de dano).
5. **5 Elementos Vinculados à Entidade (Sem Luz/Escuridão):**
   * Ciclo Ativo (`±25%`): `FIRE > EARTH > AIR > WATER > FIRE`.
   * `NEUTRAL` (Neutro): Penalidade de `-25%` de dano causado e `+25%` de dano sofrido contra tudo.
   * Monstros têm elemento fixo na tabela; Personagens e Pets sorteiam elemento inicial (`10%` Neutro, `20%` para cada elemento ativo), alterável no futuro via item.
6. **11 Raças (`+10%` de Vantagem):**
   * `HUMAN` tem `+10%` sobre todas as raças.
   * Ciclo das 10 raças (`+10%`): `PLANT > DRAGON > REPTILIAN > AQUATIC > ROBOTIC > CELESTIAL > DEMON > FAIRY > SPIRIT > BEAST > PLANT`.
7. **Atributos, Habilidades e Combate 5B (10x10 Slots):**
   * 6 Atributos Base (`VIT`, `STR`, `INT`, `WIS`, `AGI`, `DEX`) $\rightarrow$ Atributos de Combate.
   * Mitigação proporcional por nível: $\text{Defesa} / (\text{Defesa} + 100 + 10 \times \text{Nível})$.
   * 7 Blocos Universais de Efeito + Gatilhos para Passivas/Buffs/Debuffs.
   * Arena 10x10 Slots (Solo/Dupla = `1 Char + até 3 Pets`; 3 a 5 Jogadores = `1 Char + 1 Pet`).
8. **Sem God Objects & Limite Mandatório de 1.000 Linhas por Arquivo (Regra #7):**
   * Código estritamente modularizado por responsabilidade única.
   * Frontend de `/play` e `/admin` dividido em submódulos especializados (`ClientPolygonMesh`, `McreworkSpriteSheet`, `PlayGmController`, `AdminAuth`, `AdminUsersTab`, `AdminNpcsTab`, `AdminClassesTab`, `AdminCanvasEditor`).
   * Escala dos modelos 2.5D padronizada em 70% (`scale = 0.70`).
9. **Proibição Absoluta de Alteração de Dados no Banco sem Autorização (Cláusula 0.2):**
   * Terminantemente proibido alterar, renomear, limpar ou sobrescrever registros ou configurações nas tabelas do banco de dados (ex: alterar nome de mapas, polígonos, posições de NPCs, etc.) sem autorização prévia e expressa do usuário.
   * Scripts de teste, protótipos e verificações automatizadas NUNCA devem efetuar mutações em dados reais.
10. **Protocolo Rígido de Trabalho em Equipe entre IAs (Regra #8):**
   * **Entrada Obrigatória:** Toda IA deve executar `git pull origin main` antes de iniciar qualquer alteração.
   * **Não-Regressão e Aditividade:** Proibido reescrever, simplificar ou desmanchar regras, tabelas ou telas feitas por outra IA. O desenvolvimento é cumulativo.
   * **Dados Sagrados:** Dados criados no banco e no snapshot pertencem ao projeto e nunca devem ser apagados.
   * **Saída Obrigatória:** Testar compilação (`npm run build:packages && npm --workspace=@etheria/server run build`), atualizar `CHANGELOG.md` e `docs/HANDOFF.md`, e dar `git commit` + `git push origin main`.
11. **Ambiente de Produção 24/7 na VPS Azure (`40-65-63-193.sslip.io`):**
   * Servidor oficial rodando permanentemente na nuvem Azure (Standard B2pts_v2 ARM64, Ubuntu 24.04).
   * Caddy Web Server com SSL Let's Encrypt automático em `https://40-65-63-193.sslip.io` e HTTP em `http://40.65.63.193`.
   * Serviço gerenciado pelo systemd: `systemctl status etheria-campus`.
   * PostgreSQL 16 local na porta 5432 gerenciando os dados persistentes com snapshots sincronizados no Git.

---

## 🎯 Próxima Tarefa Exata da Fila
* **Servidor 24/7 em Produção:** Ativo e acessível publicamente via `https://40-65-63-193.sslip.io/admin` e `https://40-65-63-193.sslip.io/play`.
* **Próximos passos de desenvolvimento:** Continuar a evolução do sistema de combate, drops, inventário e missões conforme direcionado pelo usuário.
