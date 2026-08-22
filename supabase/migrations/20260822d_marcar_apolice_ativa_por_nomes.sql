-- Usada pelo agente WhatsApp (Trabalhador Virtual) para marcar como
-- 'ativo' em worker_apolice_seguro os trabalhadores que a apólice da
-- Allianz já cobre mas que o sistema ainda não tem registados como
-- ativos — mesmo critério de correspondência de nome (unaccent/upper/trim)
-- já usado em comparar_apolice_seguros, para nunca divergir do que a
-- comparação reportou. Só marca quem já existe em workers (correspondência
-- por nome); nomes sem match ficam reportados como "encontrado: false"
-- para revisão humana (podem ser trabalhadores ainda não cadastrados).
create or replace function public.marcar_apolice_ativa_por_nomes(p_nomes text[])
returns jsonb
language plpgsql as $$
declare
  v_nome text;
  v_worker record;
  v_resultado jsonb := '[]'::jsonb;
begin
  foreach v_nome in array p_nomes loop
    select id, name into v_worker
    from workers
    where unaccent(upper(trim(name))) = v_nome
    limit 1;

    if v_worker.id is not null then
      insert into worker_apolice_seguro (worker_id, status, ativo_em, atualizado_por, updated_at)
      values (v_worker.id, 'ativo', now(), 'trabalhador_virtual', now())
      on conflict (worker_id) do update set
        status = 'ativo',
        ativo_em = now(),
        atualizado_por = 'trabalhador_virtual',
        updated_at = now();

      v_resultado := v_resultado || jsonb_build_object(
        'nome_apolice', v_nome, 'encontrado', true,
        'worker_id', v_worker.id, 'worker_name', v_worker.name
      );
    else
      v_resultado := v_resultado || jsonb_build_object(
        'nome_apolice', v_nome, 'encontrado', false
      );
    end if;
  end loop;

  return v_resultado;
end;
$$;
