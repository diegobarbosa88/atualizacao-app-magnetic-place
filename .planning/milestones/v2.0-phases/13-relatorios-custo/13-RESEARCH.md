# Phase 13: Relatórios de Custo - Research

**Phase:** 13-relatorios-custo
**Goal:** Gerar relatório com valor total em euros de cada trabalhador (horas × valor/hora) e cliente

## Technical Context

### Data Model
- **workers**: Campo `valorHora` (decimal)
- **clients**: Campo `valorHora` (decimal)
- **logs**: Horas registadas por worker (workerId, date, hours)
- **approvals**: Horas aprovadas por mês (clientId, month, year, approvedHours)

### Calculations Required
1. **Custo por Trabalhador:**
   - Query: `logs` filtrado por período (mês/ano)
   - Agregação: SUM(hours) GROUP BY workerId
   - Cálculo: SUM(hours) × workers.valorHora

2. **Custo por Cliente:**
   - Query: `approvals` filtrado por período (mês/ano)
   - Agregação: SUM(approvedHours) GROUP BY clientId
   - Cálculo: SUM(approvedHours) × clients.valorHora

## Implementation Approach

### Option 1: Backend Query (Supabase)
- Criar função/supabase query que agrega horas
- Vantagem: mais eficiente para grandes volumes
- Desvantagem: requer setup adicional

### Option 2: Frontend Aggregation
- Usar dados existentes do AppContext
- Filtrar e agregar no cliente
- Vantagem: reuse de código existente, simples
- Desvantagem: pode ser lento com muitos dados

### Recommended: Option 2
Visto que o AppContext já tem `logs` e `approvals`, usar agregação no frontend seguindo padrões existentes:
- Padrão: similar a `adminStats` em app.jsx
- UI: usar estrutura de tabela como em ClientManager/TeamManager
- Filtros: reutilizar componente de seleção de mês/ano existente

## Dependencies
- `src/context/AppContext.jsx` — dados de logs e approvals
- `src/utils/formatUtils.js` — formatação de euros
- `src/features/admin/ClientManager.jsx` — padrão de tabela

## Risks
- **Performance:** Agregação em memória pode ser lenta com muitos registos
  - Mitigação: usar useMemo para caching
- **Data freshness:** AppContext pode ter dados desatualizados
  - Mitigação: usar dados do contexto (já é o padrão do projeto)

## Validation Architecture
- Verificar que o cálculo está correto com dados de teste
- Testar edge cases: worker sem horas, cliente sem aprovações

---

*Research completed: 2026-05-07*