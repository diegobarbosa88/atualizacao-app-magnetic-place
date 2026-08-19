-- Backup dos valores de receipt_validations imediatamente antes de qualquer
-- reextração (ModoReextracao.jsx, Passo 2) sobrescrever os campos extraídos.
-- Guarda uma cópia completa da linha tal como estava, mais quando/porque foi
-- alterada — permite reverter manualmente se algum valor reextraído sair
-- errado. Nunca é limpa automaticamente.
create table if not exists receipt_validations_backup_pre_reextracao (
  id uuid primary key default gen_random_uuid(),
  receipt_validation_id uuid not null,
  backed_up_at timestamptz not null default now(),
  motivo text,
  worker_id text,
  worker_name text,
  mes text,
  bruto_plataforma numeric,
  abonos_extraidos numeric,
  ss_extraido numeric,
  irs_extraido numeric,
  liquido_extraido numeric,
  divergencia numeric,
  estado text,
  mensagem text,
  origem text,
  bruto_extraido numeric,
  ajudas_custo_extraidas numeric
);

create index if not exists idx_receipt_validations_backup_rv_id
  on receipt_validations_backup_pre_reextracao (receipt_validation_id);
