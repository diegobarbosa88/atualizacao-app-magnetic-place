-- Fecha a lacuna encontrada hoje: quando um candidato submete o formulário
-- público de onboarding, nada avisa o Trabalhador Virtual — só um email e
-- uma notificação in-app. Acrescenta as submissões por rever
-- (worker_onboarding_submissions.status = 'pending') ao bloco "urgente" de
-- get_pendencias_ativas(), para o cron verificar-urgentes.js as apanhar e
-- disparar o aviso proativo por WhatsApp (mesmo mecanismo já usado para
-- ausências/erros SS/pagamentos falhados/recibos com erro).
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

-- Tool nova do agente: listar/rever submissões de onboarding pendentes de
-- aprovação (candidatos que já preencheram o formulário e assinaram o
-- compromisso, mas ainda não foram completados/aprovados em
-- Equipa → Pendentes).
create or replace function public.listar_onboarding_submissoes_pendentes()
returns jsonb
language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id,
    'nome', s.nome,
    'profissao', s.profissao,
    'tel', s.tel,
    'email', s.email,
    'submitted_at', s.submitted_at,
    'tem_compromisso_assinado', exists (
      select 1 from onboarding_commitments c where c.invite_id = s.invite_id
    )
  ) order by s.submitted_at), '[]'::jsonb)
  from worker_onboarding_submissions s
  where s.status = 'pending';
$$;
