# Phase 13: Relatórios de Custo por Trabalhador/Cliente - Context

**Gathered:** 2026-05-07
**Status:** Ready for planning
**Source:** User request (phase creation)

<domain>
## Phase Boundary

Gerar relatórios de custo no Admin Dashboard:
- Custo por trabalhador: total de horas registadas × valor/hora
- Custo por cliente: total de horas aprovadas × valor/hora

</domain>

<decisions>
## Implementation Decisions

### Data Sources
- **Workers:** Campo `valorHora` existe na tabela workers
- **Clients:** Campo `valorHora` existe na tabela clients
- **Logs:** contém horas registadas por worker (para COST-01)
- **Approvals:** contém horas aprovadas por mês (para COST-02)

### Cálculos
- **Custo Trabalhador:** SUM(horas em logs) × valorHora do worker
- **Custo Cliente:** SUM(horas aprovadas em approvals) × valorHora do cliente

### UI/UX
- Accessible via Admin Dashboard
- Filtros por período (mês/ano)
- Tabs ou secções separadas para Workers vs Clientes

### the agent's Discretion
- Formato de visualização (tabela, cards, etc.)
- Se export CSV/PDF é necessário agora ou depois
- Layout específico no Admin Dashboard

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Structure
- `src/features/admin/` — componentes do admin
- `src/context/AppContext.jsx` — estado global
- `src/utils/` — funções utilitárias

### Existing Patterns
- `src/features/admin/ScheduleManager.jsx` — exemplo de filtro por período
- `src/features/admin/ClientManager.jsx` — exemplo de tabela com dados

</canonical_refs>

<specifics>
## Specific Ideas

- Usar a estrutura existente de filtros (mês/ano) como em ScheduleManager
- Seguir o pattern de tabelas do ClientManager para listagem
- Valor em euros (€) com 2 decimais
- Mostrar nome do worker/cliente + total de horas + custo total

</specifics>

<deferred>
## Deferred Ideas

- Export CSV/PDF (se não couber no scope inicial)
- Gráficos de evolução temporal (v2)

</deferred>

---

*Phase: 13-relatorios-custo*
*Context gathered: 2026-05-07*