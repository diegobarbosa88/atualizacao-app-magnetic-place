-- Usada pelo agente WhatsApp (Trabalhador Virtual, repo CONSELHEIRO-ESTRATEGICO)
-- para resolver nome parcial/completo -> worker_id antes de consultar
-- get_onboarding_status. Devolve todos os que correspondem (pode haver mais
-- do que um, o agente pergunta qual antes de continuar).
create or replace function public.buscar_trabalhador_por_nome(p_nome text)
returns jsonb
language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'nome', name, 'ativo', is_active)), '[]'::jsonb)
  from workers
  where name ilike '%' || p_nome || '%';
$$;
