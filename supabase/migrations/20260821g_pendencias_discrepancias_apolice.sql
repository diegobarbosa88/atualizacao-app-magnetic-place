-- Adiciona discrepancias_apolice ao digest de get_pendencias_ativas():
-- importações de apólice já processadas (comparar_apolice_seguros) onde
-- alguma das duas listas de discrepância não está vazia.
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
      )
    ),
    'digest', jsonb_build_object(
      'onboarding_parado', (
        select coalesce(jsonb_agg(jsonb_build_object('worker_id', w.id, 'worker_nome', w.name, 'estado', public.get_onboarding_status(w.id))), '[]'::jsonb)
        from workers w
        where w.is_active = true
          and (
            w."ss_admissao_comunicada_em" is null
            or coalesce((select status from worker_apolice_seguro a where a.worker_id = w.id), 'pendente') <> 'ativo'
            or not exists (select 1 from documents d where d."workerId" = w.id and d.tipo = 'Ficha de Entrega de EPI')
            or not exists (select 1 from documents d where d."workerId" = w.id and d.tipo = 'Registo de Riscos Laborais')
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
