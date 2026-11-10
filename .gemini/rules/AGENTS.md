# 🛡️ Regras Globais do Repositório Etheria Campus

Sempre leia o arquivo `AGENTS.md` na raiz do repositório, `docs/HANDOFF.md` e `CHANGELOG.md` no início de cada interação.
Aplique rigorosamente:
1. **Cláusula 0 (Regra Anti-Vibe-Coder):** Questione qualquer pedido que viole Segurança (Servidor Autoritário), Performance, Orientação a Objetos, Motor Procedural (Zero Hardcode) ou Coerência Lógica.
2. **Regra da Curadoria (Whitelist no Banco):** Nada do repositório `mcrework` entra no jogo sem estar cadastrado nas tabelas do nosso banco de dados.
3. **Código Comentado para IA:** Todo arquivo deve ter cabeçalho `@file`, `@module`, `@description`, `@rules` e comentários TSDoc em classes e métodos.
4. **Versionamento Incremental:** Atualize sempre o `CHANGELOG.md` (ex: `v0.1.1`, `v0.2.0`) e o `docs/HANDOFF.md` ao concluir mudanças.
5. **Proibição de Código Não Solicitado / Escopo Estrito:** NUNCA crie simuladores, testes, páginas de demonstração ou funcionalidades extras sem o usuário pedir explicitamente. Se o pedido for vago ou faltar informações, PARE E PERGUNTE antes de escrever código para não gerar sujeira no projeto.
6. **Padrão de Auto-Incremento (`id` e `code`):** Tabelas curadas pelo usuário (`maps`, `npc_templates`, `class_templates`, `monster_templates`, etc.) auto-incrementam automaticamente o `id` e a chave `code` (`map_1`, `npc_1`, `class_1`...) em sincronia no servidor.
7. **Proibição Absoluta de Alteração de Dados no Banco sem Autorização:** NUNCA efetuar alterações, mutações, renomeações, sobrescritas ou exclusões nos registros e dados salvos nas tabelas do banco de dados (exemplo: alterar o nome de um mapa, polígonos, posições de NPCs, atributos, etc.) sem a expressa e prévia autorização do usuário. Scripts de teste NUNCA devem alterar dados reais.
8. **Sem God Objects & Limite de 1.000 Linhas:** Nenhum arquivo de código pode exceder 1.000 linhas de código. Modele o código orientado a objetos modularizados.


