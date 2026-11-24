---
trigger: always_on
description: Interrompe o processamento e alerta o usuário caso um pedido não tenha relação com o chat atual
---
# Regra de Verificação de Contexto do Chat

Sempre que o usuário solicitar algo que **não tenha relação com o contexto deste chat**:
1. **Pare imediatamente o processamento:** Não execute comandos, não edite arquivos e não processe a tarefa fora de contexto.
2. **Avise o usuário imediatamente** perguntando:
   > **"vc tem certeza que etá no chat correto?"**
3. Aguarde a confirmação explícita do usuário antes de tomar qualquer ação.
