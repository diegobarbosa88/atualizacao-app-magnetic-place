-- Agenda a comunicação de admissão à SS e/ou o pedido de inclusão no
-- seguro para o dia anterior à data de início do trabalhador, em vez de
-- executar logo na aprovação. O cron verificar-urgentes.js do Trabalhador
-- Virtual avisa nesse dia e só executa depois de autorização explícita
-- (mesmo padrão de rascunho + confirmação já usado nas outras ações
-- irreversíveis do agente).
create table if not exists worker_ativacao_agendada (
  id text primary key,
  worker_id text not null references workers(id) on delete cascade,
  worker_nome text not null,
  data_execucao date not null,
  comunicar_ss boolean not null default false,
  solicitar_seguro boolean not null default false,
  status text not null default 'pendente' check (status in ('pendente', 'concluido', 'cancelado')),
  ss_executado_em timestamptz,
  seguro_executado_em timestamptz,
  criado_em timestamptz not null default now()
);

create index if not exists idx_worker_ativacao_agendada_pendente
  on worker_ativacao_agendada (data_execucao) where status = 'pendente';

-- Junta-se ao mesmo bloco "urgente" de get_pendencias_ativas() usado pelo
-- cron verificar-urgentes.js (30 em 30 min), reaproveitando o mecanismo de
-- dedupe por chave já existente em notificacoes_proativas_log.
create or replace function public.get_pendencias_ativas()
returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'urgente', jsonb_build_object(
      'ausencias_pendentes', (
        select coalesce(jsonb_agg(jsonb_build_object('id', id, 'worker_name', worker_name, 'reason', reason, 'dates', dates)), '[]'::jsonb)
        from absence_requests where status = 'pending'
      ),
      'ss_erro', (
        select coalesce(jsonb_agg(jsonb_build_object('id', id, 'worker_id', worker_id, 'tipo', tipo, 'resposta_ss', resposta_ss)), '[]'::jsonb)
        from ss_comunicacoes where status = 'erro'
      ),
      'pagamentos_falhados', (
        select coalesce(jsonb_agg(jsonb_build_object('id', id, 'fornecedor', fornecedor_nome, 'valor', valor)), '[]'::jsonb)
        from pagamentos_fornecedores where status = 'falhado_saltedge'
      ),
      'recibos_erro', (
        select coalesce(jsonb_agg(jsonb_build_object('id', id, 'worker_name', worker_name, 'mes', mes, 'estado', estado, 'mensagem', mensagem)), '[]'::jsonb)
        from receipt_validations where estado = 'erro'
      ),
      'onboarding_submissoes_pendentes', (
        select coalesce(jsonb_agg(jsonb_build_object('id', id, 'nome', nome, 'profissao', profissao, 'submitted_at', submitted_at)), '[]'::jsonb)
        from worker_onboarding_submissions where status = 'pending'
      ),
      'ativacoes_pendentes', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', id, 'worker_id', worker_id, 'worker_nome', worker_nome,
          'data_execucao', data_execucao, 'comunicar_ss', comunicar_ss, 'solicitar_seguro', solicitar_seguro
        )), '[]'::jsonb)
        from worker_ativacao_agendada
        where status = 'pendente' and data_execucao <= current_date
      )
    ),
    'digest', jsonb_build_object(
      'onboarding_parado', (
        select coalesce(jsonb_agg(jsonb_build_object('worker_id', w.id, 'worker_nome', w.name, 'estado', st.estado)), '[]'::jsonb)
        from workers w
        cross join lateral (select public.get_onboarding_status(w.id) as estado) st
        where w.is_active = true
          and not (
            coalesce((st.estado->'ss_admissao'->>'concluido')::boolean, false)
            and coalesce((st.estado->'apolice_seguro'->>'concluido')::boolean, false)
            and coalesce((st.estado->'ficha_epi'->>'concluido')::boolean, false)
            and coalesce((st.estado->'registo_riscos'->>'concluido')::boolean, false)
          )
      ),
      'correcoes_por_rever', (
        select coalesce(jsonb_agg(jsonb_build_object('id', id, 'client_id', client_id, 'month', month, 'type', type)), '[]'::jsonb)
        from corrections where status = 'submitted'
      ),
      'documentos_a_caducar', (
        select coalesce(jsonb_agg(jsonb_build_object('worker_id', "workerId", 'tipo', tipo, 'data_validade', data_validade)), '[]'::jsonb)
        from documents where data_validade is not null and data_validade <= current_date + interval '30 days'
      ),
      'resposta_contador_pendente', (
        select coalesce(jsonb_agg(jsonb_build_object('id', id, 'tipo_resposta', tipo_resposta, 'periodo_referente', periodo_referente)), '[]'::jsonb)
        from respostas_contador_pendentes where status = 'pendente'
      ),
      'alertas_gestao', (
        select coalesce(jsonb_agg(jsonb_build_object('id', id, 'titulo', titulo, 'severidade', severidade, 'descricao', descricao)), '[]'::jsonb)
        from gestao_alertas where status = 'pendente'
      ),
      'discrepancias_apolice', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', id,
          'recebido_em', recebido_em,
          'processado_em', processado_em,
          'discrepancias', discrepancias
        )), '[]'::jsonb)
        from apolice_seguro_importacoes
        where processado_em is not null
          and (
            jsonb_array_length(coalesce(discrepancias->'na_apolice_mas_nao_no_sistema', '[]'::jsonb)) > 0
            or jsonb_array_length(coalesce(discrepancias->'no_sistema_mas_nao_na_apolice', '[]'::jsonb)) > 0
          )
      )
    )
  );
$$;

-- Tool do agente: lista o que está pendente de autorização hoje.
create or replace function public.listar_ativacoes_pendentes()
returns jsonb
language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'worker_id', worker_id, 'worker_nome', worker_nome,
    'data_execucao', data_execucao, 'comunicar_ss', comunicar_ss, 'solicitar_seguro', solicitar_seguro
  ) order by data_execucao), '[]'::jsonb)
  from worker_ativacao_agendada
  where status = 'pendente' and data_execucao <= current_date;
$$;

-- Chamada pelo agente depois de executar (ou o Diego recusar) as ações do
-- dia — marca a linha como concluída/cancelada e regista o que foi feito.
create or replace function public.concluir_ativacao_agendada(
  p_id text,
  p_ss_executado boolean default false,
  p_seguro_executado boolean default false,
  p_cancelado boolean default false
)
returns void
language sql as $$
  update worker_ativacao_agendada
    set status = case when p_cancelado then 'cancelado' else 'concluido' end,
        ss_executado_em = case when p_ss_executado then now() else ss_executado_em end,
        seguro_executado_em = case when p_seguro_executado then now() else seguro_executado_em end
    where id = p_id;
$$;
