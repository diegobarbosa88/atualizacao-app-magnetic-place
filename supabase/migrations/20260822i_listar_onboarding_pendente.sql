-- Visão agregada e legível de quem tem onboarding pós-contratação por
-- terminar (as 4 etapas bloqueantes de get_onboarding_status), para o
-- agente WhatsApp resumir sem ter de processar o JSON aninhado de
-- get_pendencias_ativas().digest.onboarding_parado.
create or replace function public.listar_onboarding_pendente()
returns jsonb
language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'worker_id', w.id,
    'worker_nome', w.name,
    'falta_ss', not coalesce((st.estado->'ss_admissao'->>'concluido')::boolean, false),
    'falta_apolice', not coalesce((st.estado->'apolice_seguro'->>'concluido')::boolean, false),
    'falta_epi', not coalesce((st.estado->'ficha_epi'->>'concluido')::boolean, false),
    'falta_riscos', not coalesce((st.estado->'registo_riscos'->>'concluido')::boolean, false)
  ) order by w.name), '[]'::jsonb)
  from workers w
  cross join lateral (select public.get_onboarding_status(w.id) as estado) st
  where w.is_active = true
    and not (
      coalesce((st.estado->'ss_admissao'->>'concluido')::boolean, false)
      and coalesce((st.estado->'apolice_seguro'->>'concluido')::boolean, false)
      and coalesce((st.estado->'ficha_epi'->>'concluido')::boolean, false)
      and coalesce((st.estado->'registo_riscos'->>'concluido')::boolean, false)
    );
$$;
