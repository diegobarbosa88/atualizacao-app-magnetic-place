-- Usada pelo agente WhatsApp para preencher o pedido de inclusão/exclusão
-- na apólice de seguro ao mediador.
create or replace function public.obter_dados_para_mediador(p_worker_id text)
returns jsonb
language sql stable as $$
  select to_jsonb(t) from (
    select name, nif, vencimento_base, subsidio_alimentacao_dia, profissao, "dataInicio"
    from workers
    where id = p_worker_id
  ) t;
$$;
