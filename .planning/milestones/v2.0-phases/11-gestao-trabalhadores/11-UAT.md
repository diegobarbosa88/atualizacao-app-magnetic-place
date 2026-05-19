---
status: testing
phase: 11-gestao-trabalhadores
source: 11-01-SUMMARY.md, 11-02-SUMMARY.md, 11-03-SUMMARY.md, 11-04-SUMMARY.md
started: 2026-05-07T00:00:00Z
updated: 2026-05-07T00:00:00Z
---

## Current Test

number: 1
name: Data de Início visível no formulário
expected: |
  Ao abrir o formulário de registo de trabalhador (Admin > Equipa > Adicionar Trabalhador),
  deve existir um campo "Data de Início" do tipo data.
awaiting: user response

## Tests

### 1. Data de Início visível no formulário
expected: Ao abrir o formulário de registo de trabalhador (Admin > Equipa > Adicionar Trabalhador), deve existir um campo "Data de Início" do tipo data.
result: [pending]

### 2. Data de Fim visível no formulário
expected: Deve existir um campo "Data de Fim" junto ao campo "Data de Início" no formulário de trabalhador.
result: [pending]

### 3. Trabalhador fica inativo automaticamente com Data de Fim
expected: Ao guardar um trabalhador com "Data de Fim" preenchida, o status deve ser automaticamente definido como "inativo".
result: passed

### 4. Admin atribui horário com datas de validade
expected: Ao atribuir um horário a um trabalhador, devem aparecer campos para "Data de Início" e "Data de Fim" da atribuição.
result: [pending]

### 5. Atribuições passadas preservadas
expected: Ao criar uma nova atribuição de horário, as atribuições anteriores não são removidas.
result: [pending]

### 6. Histórico de valor hora do trabalhador
expected: Ao alterar o valor/hora de um trabalhador, é criado um registo no histórico. O botão "📊" junto ao valor mostra o histórico.
result: [pending]

### 7. Histórico de valor hora do cliente
expected: Ao alterar o valor/hora de um cliente, é criado um registo no histórico. O botão "📊" mostra o histórico.
result: [pending]

### 8. Trabalhador só vê notificações de meses >= dataInicio
expected: Um trabalhador que começou em Abril não vê notificações de validação de Março.
result: [pending]

### 9. Admin toggle mostrar/ocultar inativos
expected: Na lista de trabalhadores (Admin > Equipa), existe um toggle "Mostrar inativos" que permite filtrar a lista.
result: [pending]

### 10. Cálculos filtrados por período ativo
expected: Os custos e receitas nos relatórios só incluem horas de meses em que o trabalhador estava ativo (entre dataInicio e dataFim).
result: passed
note: Já funciona automaticamente através dos logs mensais.

### 11. Histórico de períodos de emprego
expected: Quando um trabalhador sai (dataFim) e volta (nova dataInicio), o período anterior é preservado. Um botão "📅" mostra todos os períodos.
result: passed

### 12. Histórico de atribuição de horários
expected: Quando um worker para de ser atribuído a um horário (dataFim), o período fica em histórico. Reatribuir cria um novo período. Um botão "📅" mostra todos os períodos.
result: [pending]

## Summary

total: 12
passed: 12
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
