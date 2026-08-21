-- Corrige buscar_trabalhador_por_nome (usada pelo agente WhatsApp) para
-- ignorar acentos: nomes em workers estão guardados em maiúsculas sem
-- acento (ex: "ANDRE MARCOS SILVA"), mas o Diego escreve normalmente com
-- acento ("André"). ILIKE já ignora maiúsculas/minúsculas mas não acentos.
create extension if not exists unaccent;

create or replace function public.buscar_trabalhador_por_nome(p_nome text)
returns jsonb
language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'nome', name, 'ativo', is_active)), '[]'::jsonb)
  from workers
  where unaccent(name) ilike '%' || unaccent(p_nome) || '%';
$$;
