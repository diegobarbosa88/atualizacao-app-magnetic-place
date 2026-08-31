-- concluir_ativacao_agendada marcava sempre status='concluido' (exceto
-- p_cancelado), mesmo quando a comunicação à SS e/ou o pedido ao mediador
-- de seguros pedidos (comunicar_ss/solicitar_seguro) tinham falhado nessa
-- execução -- a linha desaparecia de listar_ativacoes_pendentes() e do
-- bloco urgente de get_pendencias_ativas() sem retry nenhum, mesmo com
-- ss_executado_em/seguro_executado_em a ficarem null (sinal de falha).
-- Corrige: só marca 'concluido' quando cada ação pedida já foi mesmo
-- executada (agora, nesta chamada, ou numa execução anterior parcial).
create or replace function public.concluir_ativacao_agendada(
  p_id text,
  p_ss_executado boolean default false,
  p_seguro_executado boolean default false,
  p_cancelado boolean default false
)
returns void
language sql as $$
  update worker_ativacao_agendada
    set ss_executado_em = case when p_ss_executado then now() else ss_executado_em end,
        seguro_executado_em = case when p_seguro_executado then now() else seguro_executado_em end,
        status = case
          when p_cancelado then 'cancelado'
          when (not comunicar_ss or p_ss_executado or ss_executado_em is not null)
           and (not solicitar_seguro or p_seguro_executado or seguro_executado_em is not null)
            then 'concluido'
          else 'pendente'
        end
    where id = p_id;
$$;
