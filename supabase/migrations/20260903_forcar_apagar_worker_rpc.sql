-- forcar_apagar_worker: apaga um colaborador e os registos associados sem
-- CASCADE (de propósito, ver comentário em handleDelete/AppContext.jsx),
-- só quando o admin confirma explicitamente que quer apagar tudo. SECURITY
-- DEFINER porque formacao_participantes tem RLS ativo sem nenhuma policy —
-- um DELETE normal do cliente (anon/authenticated) nunca afeta linhas nessa
-- tabela (0 rows, sem erro, silenciosamente ignorado), o que fazia o
-- "apagar mesmo assim" no cliente falhar sempre na mesma constraint mesmo
-- depois de "confirmado". formacoes_internas tem o mesmo problema de RLS
-- para nullificar formador_id.
create or replace function forcar_apagar_worker(p_worker_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from formacao_participantes where worker_id = p_worker_id;
  update formacoes_internas set formador_id = null where formador_id = p_worker_id;
  delete from worker_apolice_seguro where worker_id = p_worker_id;
  delete from worker_whatsapp_messages where worker_id = p_worker_id;
  delete from workers where id = p_worker_id;
end;
$$;

revoke all on function forcar_apagar_worker(text) from public;
grant execute on function forcar_apagar_worker(text) to anon, authenticated;
