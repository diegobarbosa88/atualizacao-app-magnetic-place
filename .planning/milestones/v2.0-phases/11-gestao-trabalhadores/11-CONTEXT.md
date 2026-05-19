# Phase 11: Gestão de Ciclo de Vida do Trabalhador - Context

**Gathered:** 2026-05-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Adicionar gestão de ciclo de vida ao registo de trabalhadores: datas de início/fim, atribuição temporal de horários, e histórico de evolução dos valores hora cobrados ao cliente e pagos ao trabalhador.
</domain>

<decisions>
## Implementation Decisions

### Datas no Registo de Trabalhador
- **D-01:** O formulário de registo de trabalhador DEVE incluir campo "Data de Início" (dataInicio) — data em que o trabalhador iniciou atividade.
- **D-02:** O formulário DEVE incluir campo "Data de Fim" (dataFim) — data em que o trabalhador terminou atividade.
- **D-03:** Quando "Data de Fim" for preenchida, o sistema DEVE automaticamente definir o status da conta como "inativo".

### Atribuição de Horários com Datas
- **D-04:** A atribuição de horários a trabalhadores DEVE incluir "Data de Início" e "Data de Fim" de validade dessa atribuição.
- **D-05:** As atribuições passadas DEVEM ser preservadas — um novo horário atribuído não substitui os anteriores, apenas adiciona um novo registo com datas.

### Histórico de Valores Hora
- **D-06:** Alterações ao "Valor Hora" do trabalhador DEVEM criar um histórico com: valor anterior, novo valor, data de alteração.
- **D-07:** Alterações ao "Valor Hora" do cliente DEVEM criar um histórico com: valor anterior, novo valor, data de alteração.
- **D-08:** O histórico DEVE ser consultável — UI deve mostrar a evolução dos valores por período.

### the agent's Discretion
- Formato de存储 do histórico (tabela separada ou campo JSON na tabela principal)
- UI específica para visualização do histórico de valores
- Validação de datas (dataFim não pode ser anterior a dataInicio)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — Project vision, constraints, stack
- `.planning/ROADMAP.md` — Phase 11 goal and success criteria

### Existing Code (for reference)
- `src/features/admin/TeamManager.jsx` — Worker form (lines 58-72) — need to add date fields
- `src/features/admin/contexts/TeamContext.jsx` — Worker form state (lines 7-9) — need to add dataInicio, dataFim
- `src/features/admin/ScheduleManager.jsx` — Schedule assignment (lines 97-110) — need to add date validity
- `src/features/admin/ClientManager.jsx` — Client form with valorHora (line 47)
- `src/features/admin/contexts/ClientContext.jsx` — Client form state with valorHora (line 7)

### Data Model Insights
- Workers table: currently has `valorHora`, `status` (ativo/inativo), no dates
- Clients table: currently has `valorHora`, no history
- No worker_schedule_assignments table currently — may need to create

</canonical_refs>

<code_context>
## Existing Code Insights

### Worker Form Current State (TeamManager.jsx)
```javascript
const [workerForm, setWorkerForm] = useState({
  id: null, name: '', assignedClients: [], assignedSchedules: [],
  defaultClientId: '', defaultScheduleId: '', tel: '',
  valorHora: '', profissao: '', nis: '', nif: '', iban: '', status: 'ativo'
});
```

### Client Form Current State (ClientManager.jsx)
```javascript
const [clientForm, setClientForm] = useState({
  id: null, name: '', morada: '', nif: '', valorHora: '', email: ''
});
```

### Established Patterns
- Data storage via Supabase `saveToDb(table, id, data)` function
- Status change triggers account access control (LoginView.jsx line 74 checks status)
- valorHora is stored as string/number, used in calculations with `Number(w?.valorHora) || 0`

</code_context>

<specifics>
## Specific Ideas

- Adicionar campos `dataInicio` (date) e `dataFim` (date) ao workerForm
- Na função de save do trabalhador, se dataFim estiver preenchida → setar status = 'inativo'
- Criar tabela `worker_valorhora_history` para histórico de alterações do valor do trabalhador
- Criar tabela `client_valorhora_history` para histórico de alterações do valor do cliente
- Na atribuição de horários, criar registos com `workerId`, `scheduleId`, `dataInicio`, `dataFim`

</specifics>

<deferred>
## Deferred Ideas

None — all features are in scope for this phase

</deferred>

---

*Phase: 11-Gestão de Ciclo de Vida do Trabalhador*
*Context gathered: 2026-05-07*