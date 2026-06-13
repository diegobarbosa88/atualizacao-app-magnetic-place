-- Adicionar campos de rastreamento de origem aos registos de ponto
alter table logs
  add column if not exists source        text default null,
  add column if not exists edited_at     timestamptz default null,
  add column if not exists edited_source text default null;

comment on column logs.source        is 'Como o registo foi criado: gps_auto, manual_admin, manual_worker, batch, request, correction, client_portal';
comment on column logs.edited_at     is 'Timestamp da última edição (null = nunca editado após criação)';
comment on column logs.edited_source is 'Quem/o quê fez a última edição: mesmos valores de source';
