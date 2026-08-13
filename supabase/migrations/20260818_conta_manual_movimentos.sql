-- Registo de movimentos presumidos da conta bancária sem ligação PSD2 (ex:
-- Novobanco Poupança) — inferidos a partir de transferências internas
-- unilaterais detetadas nas contas ligadas (ver detectInternalTransfers em
-- api/reconciliacao/_matchingEngine.js). Valor guardado do ponto de vista
-- desta conta manual (sinal invertido face à transação observada na conta
-- ligada): uma saída da conta corrente vira entrada aqui, e vice-versa.
create table if not exists conta_manual_movimentos (
  id uuid primary key default gen_random_uuid(),
  nome_conta text not null default 'Novobanco Poupança',
  valor numeric(12,2) not null,
  data date not null,
  reconciliation_run_id uuid references reconciliation_runs(id) on delete cascade,
  transaction_index integer not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_conta_manual_movimentos_run
  on conta_manual_movimentos (reconciliation_run_id);

-- RLS ativo, sem policies — só acessível via service role (api/reconciliacao,
-- já atrás de requireAuth(['admin'])), nunca diretamente do frontend.
alter table conta_manual_movimentos enable row level security;
