create table if not exists impostos_pagamentos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  tipo text not null,
  periodo text,
  valor numeric(12,2) not null,
  data_vencimento date,
  referencia text,
  iban_destino text not null,
  descricao text,
  status text not null default 'pendente',
  storage_path text,
  url text,
  notas_rejeicao text,
  sepa_msg_id text
);

alter table impostos_pagamentos
  add constraint if not exists chk_impostos_valor check (valor > 0);

alter table impostos_pagamentos
  add constraint if not exists chk_impostos_status check (status in ('pendente', 'rejeitado', 'exportado'));
