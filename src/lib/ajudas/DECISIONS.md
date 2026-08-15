# Decisões de desenho — Calculadora de Ajudas de Custo

## `ajudas_estimativas_fatura.status` — mantém `'confirmado'` como estado intermédio explícito

A tabela `ajudas_estimativas_fatura` (a criar na Fase 2, não nesta sessão) vai usar o fluxo:

```
calculado → bloqueado                          (fail-closed, motor não conseguiu calcular)
calculado → confirmado → faturado              (fluxo normal)
calculado → confirmado → (falha na API TOConline, fica em 'confirmado')
```

`'confirmado'` é escrito no momento em que o admin clica "Confirmar e Emitir" no modal de faturação, **antes** da chamada à API do TOConline. `'faturado'` só é escrito depois do sucesso dessa chamada.

**Justificação**: sem o estado intermédio, uma falha da API do TOConline depois da confirmação humana deixa a linha em `'calculado'` — indistinguível de uma fatura em que ninguém ainda decidiu nada. Isso obrigaria o admin a rever a evidência outra vez do zero para perceber que já tinha confirmado aquele valor. Com `'confirmado'` como estado próprio, fica registado que houve intenção humana explícita antes da falha técnica — o retry (manual, nesta v1) sabe que só precisa de repetir a chamada à API, não de pedir confirmação outra vez. Isto também está alinhado com os campos `confirmado_por`/`confirmado_em` já desenhados na tabela, que existem precisamente para capturar esse momento.

`reconciliacao.js` (Fase 3) lê `total_estimado` como soma de linhas com `status IN ('faturado', 'confirmado')` — inclui `'confirmado'` porque uma fatura confirmada pelo admin mas ainda sem resposta da API já reflete um valor que a empresa se comprometeu a faturar; excluir essas linhas da reconciliação subestimaria o total estimado real do mês.

Esta decisão só entra em vigor quando `ajudas_estimativas_fatura` for criada (Fase 2) — não há nenhuma tabela nem código a alterar nesta sessão. Fica registada aqui para não ser preciso revisitar a ambiguidade nessa altura.
