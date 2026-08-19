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

## Mudança de metodologia do numerador da % histórica — de atribuição por horas (`distribuicaoHoras.js`) para valor declarado + rateio de resíduo (`valoresPorFatura.js`)

**Decisão**: o numerador de `calcularPercentagemHistorica` (`total_ajudas_real`) deixou de vir de uma atribuição por horas em `logs` (`distribuicaoHoras.js`, usado por `consolidarTotalReal` até esta mudança) e passa a vir de `calcularValoresPorClienteMes` (`valoresPorFatura.js`): o valor de ajuda de custo declarado na própria observação de cada fatura, quando existe; um rateio proporcional (por `valor_fatura`) do resíduo real dos recibos do mês, quando não existe. Ativado em 2026-08-19/20, substituindo o método antigo (41,0068%, período 2025-12 a 2026-07) pelo novo (~50,19%, ver `ajudas_percentagem_historica.notas` do registo ativo para o número exato e o texto completo da metodologia).

**Motivo**: o método antigo dependia de decompor cada ajuda de custo (um número por trabalhador/mês, de `receipt_validations`) proporcionalmente pelas horas desse trabalhador em `logs` nesse mês — uma atribuição frágil sempre que faltavam logs, havia mudança de cliente a meio do histórico, ou o trabalhador não tinha nenhuma hora lançada (pago por duodécimos, etc.), gerando vários grupos "fora do total" (`semLogs`, `semWorkerId`, `naoElegivel`) que exigiam regras de fallback cada vez mais elaboradas (ver comentários antigos em `percentagemHistorica.js`, git blame). O método novo é mais fiel à fonte primária real: quando a fatura já declara o valor de ajuda de custo (o caso mais comum, confirmado com dados reais do TOConline), usa-se esse valor diretamente — não há nada a "atribuir", o documento fiscal já diz. Só quando a fatura não declara nada é que entra o rateio, e mesmo esse rateio é agora pelo valor da própria fatura (um proxy direto e auditável), não por uma reconstrução indireta via horas de terceiros.

**Descoberta associada, validada com dados reais (não hipótese)**: tanto as faturas como os `receipt_validations` reportam, pela sua data/mês de processamento, o trabalho do mês ANTERIOR — uma fatura datada de agosto declara o trabalho de julho; um `receipt_validations` com `mes='2026-08'` reporta o trabalho de julho. Confirmado (a) fatura a fatura, comparando `valor_fatura` contra horas×tarifa reais de `logs` (correspondência quase exata com o mês anterior, ex. Grandes Mecanizados, Ferrocal); (b) por estabilidade do rácio ajuda/hora em 9/9 trabalhadores testados, sempre mais estável com o desvio do que sem. `calcularValoresPorClienteMes({mes})` busca por isso faturas e `receipt_validations` de `mes+1`, gravando sempre `mes` (o mês de referência do trabalho) nas linhas — nunca o mês da fatura. O gate de completude (`mesesIncluidos`/`mesesExcluidos` em `consolidarTotalReal`) usa a mesma convenção.

**Resíduo cumulativo**: o resíduo de um mês (`total_real_recibos − total_declarado`, ambos já desviados) não é forçado a zero mês a mês — soma-se a um `saldoAcumulado` que persiste entre meses (ordem cronológica), só distribuído quando positivo e há faturas sem declaração nesse mês para o receber. Um resíduo negativo isolado não é uma anomalia; só um saldo negativo no FIM do período é. Ver `notas` do registo ativo para o valor exato do saldo residual não fechado e a investigação que o explica (~82% por backlog de validação de recibos já conhecido, independente desta calculadora).

**`distribuicaoHoras.js` e `elegibilidade.js` NÃO foram removidos.** `elegibilidade.js` continua ativo — alimenta a decisão manual de `clients.elegivel_ajudas_custo` no ecrã "Elegibilidade de Clientes", que continua essencial (é o gate fail-closed de toda a calculadora, Fases 1 e 2b). `distribuicaoHoras.js` fica sem nenhum chamador dentro da calculadora depois desta mudança — não apagar; pode voltar a ser relevante (ex. se o método de valor declarado se revelar insuficiente nalgum caso futuro, ou para comparação/auditoria).
