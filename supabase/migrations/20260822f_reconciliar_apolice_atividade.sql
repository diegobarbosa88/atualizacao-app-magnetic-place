-- Usada pelo agente WhatsApp (Trabalhador Virtual) para cruzar o estado da
-- apólice (worker_apolice_seguro) com o estado de atividade do trabalhador
-- (workers.is_active) — distinto de comparar_apolice_seguros, que compara
-- contra o PDF real da Allianz. Esta cruza dados só do próprio sistema:
--   - precisam_inclusao: ativos na app mas sem apólice ativa (pendente,
--     sem registo, ou nunca marcados) — precisam de pedido de inclusão.
--   - precisam_exclusao: inativos na app mas ainda com apólice marcada
--     ativa — precisam de pedido de exclusão.
create or replace function public.reconciliar_apolice_atividade()
returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'precisam_inclusao', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'worker_id', w.id, 'worker_name', w.name, 'apolice_status', coalesce(a.status, 'sem_registo')
      ) order by w.name), '[]'::jsonb)
      from workers w
      left join worker_apolice_seguro a on a.worker_id = w.id
      where w.is_active = true
        and coalesce(a.status, 'pendente') <> 'ativo'
    ),
    'precisam_exclusao', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'worker_id', w.id, 'worker_name', w.name, 'apolice_status', a.status
      ) order by w.name), '[]'::jsonb)
      from workers w
      join worker_apolice_seguro a on a.worker_id = w.id
      where w.is_active = false
        and a.status = 'ativo'
    )
  );
$$;
