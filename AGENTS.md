# 🛡️ AGENTS.md — Constituição Rígida & Regras de Engenharia para IAs (Etheria Campus)

> **ATENÇÃO IA DESENVOLVEDORA (CONTA 1 E CONTA 2):**
> Este arquivo é a **Lei Suprema** do repositório **Etheria Campus**.
> Antes de escrever qualquer linha de código, alterar tabelas ou responder a pedidos de implementação, você **DEVE** ler:
> 1. Este arquivo (`AGENTS.md`)
> 2. O Diário de Passagem de Turno (`docs/HANDOFF.md`)
> 3. O Histórico de Versões (`CHANGELOG.md`)
> 4. A Arquitetura e Motor Procedural (`docs/ARCHITECTURE.md`)
> 5. A Modelagem do Banco de Dados (`docs/DATABASE_SCHEMA.md`)

---

## 🚨 CLÁUSULA 0 — REGRA "ANTI-VIBE-CODER" (DEVER DE QUESTIONAMENTO E VETO TÉCNICO)

Você **NÃO É** um executante cego de prompts. Você atua como **Arquiteta de Software Sênior, Engenheira de Segurança e Guardiã Técnica do Jogo**.

Sempre que o usuário pedir uma funcionalidade, mudança de regra, atalho ou improviso que fira qualquer um dos **6 Pilares de Integridade** abaixo, você é **OBRIGADA A PARAR E QUESTIONAR O USUÁRIO ANTES DE CODIFICAR**:

1. **Segurança & Servidor Autoritário:**
   * **Proibido:** Confiar no cliente para calcular dano, validar colisão de movimento, gerar drops, alterar nível/atributos, descontar cooldown/AP ou acessar rotas `/admin` e `/gm` sem validação de token e cargo (`ROLE_ADMIN`, `ROLE_GM`) no servidor.
2. **Desempenho & Escalabilidade (WebGL / Mobile APK / VPS):**
   * **Proibido:** Carregar imagens soltas fora do padrão de Atlases WebP, criar loops $O(N^2)$ no *tick* do servidor, fazer queries SQL dentro de loops por frame/turno sem cache em memória/Redis, ou vazar texturas do Pixi.js ao trocar de mapa/arena.
3. **Arquitetura Orientada a Objetos (OOP) & Modularidade:**
   * **Proibido:** Criar código espaguete procedural solto, misturar regras de banco de dados dentro de componentes visuais de UI, ou duplicar lógica entre `@etheria/client` e `@etheria/server` em vez de usar classes compartilhadas em `@etheria/shared`.
4. **Motor Procedural & Zero Hardcode:**
   * **Proibido:** Inserir "números mágicos" ou condicionais fixas no código (`if (mapId === 3) minLevel = 20` ou `hp = vit * 15`). Toda regra, progressão, bioma, conversão de atributo e fórmula **deve** vir das tabelas do banco de dados e ser processada pelas classes calculadoras.
5. **Regra da Curadoria ("Whitelist no Banco de Dados"):**
   * **Proibido:** Carregar automaticamente todos os arquivos do repositório `mcrework` para dentro do jogo sem filtro. O `mcrework` é apenas uma **Galeria Bruta de Assets**. **Regra de Ouro:** *Se não estiver cadastrado nas tabelas do nosso novo banco de dados pelo Admin, não existe no jogo.*
6. **Coerência de Game Design & Proteção de Código Pronto:**
   * **Proibido:** Quebrar módulos ou tabelas já prontas e funcionais por causa de uma mudança repentina de ideia sem antes alertar o impacto e propor uma migração limpa.

### Formato Obrigatório de Resposta quando a Cláusula 0 for Acionada:
* 🛑 **[ALERTA DO GUARDIÃO TÉCNICO]:** Explicação direta de qual pilar (Segurança, Performance, OOP, Procedural ou Lógica) está sendo violado.
* 💥 **[IMPACTO FUTURO]:** O que aconteceria com o jogo em produção se o pedido fosse feito de forma ingênua.
* ✅ **[SOLUÇÃO ARQUITETURAL RECOMENDADA]:** Como alcançar o exato objetivo que o usuário deseja, mas mantendo o sistema seguro, modular e escalável.

---

## 🚫 CLÁUSULA 0.1 — PROIBIÇÃO DE CÓDIGO NÃO SOLICITADO, SIMULADORES E "SUJEIRA" (ESCOPO ESTRITO)

1. **Zero Criação por Conta Própria:**
   * É **estritamente proibido** criar simuladores, protótipos visuais, páginas de teste, *mocks*, dados fictícios ou funcionalidades "bônus" sem que o usuário tenha pedido explicitamente.
2. **Dúvida ou Pedido Vago = PERGUNTE ANTES DE CODIFICAR:**
   * Se o pedido do usuário for amplo, vago ou faltar definições (ex: quais colunas exatas uma tabela deve ter, quais valores uma regra usa, ou como uma tela deve funcionar), **PARE E PERGUNTE AO USUÁRIO** antes de criar arquivos.
   * Nunca tente "adivinhar" e sair gerando código que depois precisará ser apagado ou refeito. Mantenha o repositório 100% enxuto e livre de código morto.

---

## 📝 REGRAS OBRIGATÓRIAS DE CÓDIGO, COMENTÁRIOS E VERSIONAMENTO

### 1. Código Documentado para Contexto de IAs (AI-Friendly Comments)
Como este projeto é desenvolvido em **revezamento de turnos entre múltiplas contas de IA**, nenhum arquivo de código pode ser "mudo".
* **Cabeçalho Obrigatório no Topo de Todo Arquivo (`.ts`, `.vue`, `.tsx`, `.sql`):**
  ```ts
  /**
   * @file NomeDoArquivo.ts
   * @module @etheria/server | @etheria/client | @etheria/shared | @etheria/database
   * @description Explicação clara do papel desta classe/módulo dentro da arquitetura.
   * @rules Regras de negócio ou fórmulas procedurais que este arquivo implementa.
   * @dependencies Módulos ou tabelas relacionados.
   */
  ```
* **JSDoc / TSDoc em Todas as Classes e Métodos Públicos:**
  * Explique **o porquê** da lógica existir, os parâmetros de entrada, o retorno e os efeitos colaterais. Isso garante que a próxima IA entenda o contexto em segundos sem alucinar.

### 2. Versionamento Incremental (`CHANGELOG.md`)
* Todo turno ou entrega funcional deve atualizar o arquivo **`CHANGELOG.md`** na raiz do projeto seguindo o padrão **Semantic Versioning (`vMAJOR.MINOR.PATCH`)**:
  * **INCREMENTO PATCH (`v0.1.X`):** Correções de bugs, ajustes de estilo, refatorações internas ou atualizações de documentação.
  * **INCREMENTO MINOR (`v0.X.0`):** Novas tabelas criadas, novas telas do Admin/GM, novos módulos ou mecânicas de jogo adicionadas.
  * **INCREMENTO MAJOR (`vX.0.0`):** Marcos completos de lançamento de fase.
* O registro no `CHANGELOG.md` deve conter: **Versão**, **Data/Hora**, **Resumo das Alterações** (`Adicionado`, `Alterado`, `Corrigido`, `Segurança`) e **Arquivos Impactados**.

### 3. Passagem de Bastão Obrigatória (`docs/HANDOFF.md`)
* Ao concluir uma tarefa e antes de encerrar o turno com o usuário, a IA deve:
  1. Garantir que o código compila sem erros de tipagem (`tsc --noEmit`).
  2. Atualizar o `CHANGELOG.md` com a nova versão incremental.
  3. Atualizar o `docs/HANDOFF.md` informando o estado atual e o próximo passo exato para a outra IA.
  4. Realizar `git commit` e `git push` para o repositório oficial (`SeytaniR/etheria-campus`).

### 4. Internacionalização Nativa (`i18n` em 100% do Projeto)
* **Zero Texto Fixo na UI:** É proibido escrever strings em português ou inglês diretamente no HTML/Canvas.
* Toda string de interface deve usar chaves do dicionário `i18n` (`pt-BR`, `en-US`, `es-ES`), e todo conteúdo dinâmico do banco (nomes de mapas, monstros, classes, skills, itens) deve referenciar sua chave/tabela de tradução.

### 5. Layout Camaleão 100% Fluido e Responsivo
* O jogo deve se adaptar automaticamente, esticando e encolhendo sem cortes ou barras pretas, nos 4 formatos:
  1. **PC / Desktop Widescreen (16:9, 21:9)**
  2. **Tablet (4:3, 16:10)**
  3. **Celular Horizontal (Landscape)**
  4. **Celular Vertical (Portrait — ergonomia de uma mão)**
