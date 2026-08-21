-- Novas RPCs para o agente WhatsApp "Trabalhador Virtual" (repo CONSELHEIRO-ESTRATEGICO).
-- Mesmo padrão das RPCs já existentes (buscar_trabalhador_por_nome,
-- obter_dados_para_mediador, get_pendencias_ativas): funções SQL puras,
-- language sql stable, parâmetros com prefixo p_ (exigido pelo PostgREST),
-- devolvem jsonb. Só leitura — nenhuma destas escreve em tabelas de produção.

-- 1. Dados contratuais do trabalhador.
create or replace function public.get_dados_contratuais(p_worker_id text)
returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'worker_id', w.id,
    'nome', w.name,
    'tipo_contrato', w.tipo_contrato,
    'regime', w.regime,
    'data_admissao', w."dataInicio",
    'data_fim', w."dataFim",
    'categoria_profissional', w.profissao,
    'profissao_cnp', w.profissao_cnp,
    'enquadramento', w.enquadramento,
    'horas_semanais', w.horas_semanais,
    'modo_trabalho', w.modo_trabalho,
    'ss_admissao_comunicada_em', w.ss_admissao_comunicada_em,
    'ss_admissao_num_registo', w.ss_admissao_num_registo,
    'cliente_atual_id', w."defaultClientId",
    'cliente_atual_nome', c.name
  )
  from workers w
  left join clients c on c.id = w."defaultClientId"
  where w.id = p_worker_id;
$$;

-- 2. Estado do trabalhador na apólice de seguro. "Última reconciliação" aqui
-- refere-se ao último processamento de importação da apólice (email da
-- Allianz) registado em apolice_seguro_importacoes, que é um log global
-- (não por trabalhador) — não existe uma reconciliação individual por
-- trabalhador na estrutura atual.
create or replace function public.get_apolice_trabalhador(p_worker_id text)
returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'worker_id', w.id,
    'nome', w.name,
    'status', a.status,
    'solicitado_em', a.solicitado_em,
    'ativo_em', a.ativo_em,
    'excluido_em', a.excluido_em,
    'tipo_ultimo_pedido', a.tipo_ultimo_pedido,
    'pedido_enviado_em', a.pedido_enviado_em,
    'notas', a.notas,
    'ultima_importacao_apolice_em', (select max(processado_em) from apolice_seguro_importacoes),
    'ultima_importacao_apolice_status', (
      select status from apolice_seguro_importacoes order by processado_em desc nulls last limit 1
    )
  )
  from workers w
  left join worker_apolice_seguro a on a.worker_id = w.id
  where w.id = p_worker_id;
$$;

-- 3. Resumo de ajudas de custo do trabalhador. Não existe uma tabela de
-- "saldo por trabalhador" — o saldo/reconciliação (ajudas_reconciliacao_mensal)
-- é agregado à empresa toda, não por trabalhador. Por isso devolve:
-- os dados mensais do próprio trabalhador (contabilidade_mensal), a
-- percentagem de alocação ativa (system-wide, ajudas_percentagem_historica)
-- e a última fatura calculada para o cliente atual do trabalhador.
create or replace function public.get_ajudas_custo_resumo(p_worker_id text, p_mes text default null)
returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'worker_id', p_worker_id,
    'mes_consultado', coalesce(p_mes, (
      select mes from contabilidade_mensal where worker_id = p_worker_id order by mes desc limit 1
    )),
    'contabilidade_mes', (
      select jsonb_build_object(
        'mes', cm.mes,
        'dias_trabalhados', cm.dias_trabalhados,
        'ajudas_custo_outros', cm.ajudas_custo_outros,
        'observacoes', cm.observacoes
      )
      from contabilidade_mensal cm
      where cm.worker_id = p_worker_id
        and cm.mes = coalesce(p_mes, (
          select mes from contabilidade_mensal where worker_id = p_worker_id order by mes desc limit 1
        ))
    ),
    'percentagem_alocada_ativa', (
      select percentagem from ajudas_percentagem_historica where ativo = true order by calculado_em desc limit 1
    ),
    'ultima_fatura_cliente_atual', (
      select jsonb_build_object(
        'client_id', f.client_id,
        'mes', f.mes,
        'valor_final', f.valor_final,
        'valor_fatura', f.valor_fatura,
        'status', f.status,
        'confirmado_em', f.confirmado_em
      )
      from ajudas_estimativas_fatura f
      where f.client_id = (select "defaultClientId" from workers where id = p_worker_id)
      order by f.mes desc
      limit 1
    )
  );
$$;

-- 4. Visão executiva global de faturação/reconciliação pendente (sem
-- worker_id). "Pendente" assume: ajudas_estimativas_fatura ainda sem
-- confirmado_em preenchido; ajudas_reconciliacao_mensal ainda sem
-- aplicado_em; toconline_pagamentos_pendentes cujo estado não seja
-- 'concluido'. Estas duas últimas tabelas estavam vazias à data da
-- auditoria — a função já fica pronta para quando tiverem dados.
create or replace function public.get_faturacao_pendente()
returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'ajudas_por_confirmar', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id, 'mes', mes, 'client_id', client_id, 'valor_final', valor_final,
        'status', status, 'origem', origem, 'motivo_bloqueio', motivo_bloqueio
      ) order by mes)
      from ajudas_estimativas_fatura
      where confirmado_em is null
    ), '[]'::jsonb),
    'reconciliacoes_pendentes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id, 'mes', mes, 'total_real', total_real, 'total_estimado', total_estimado,
        'residuo', residuo, 'status', status
      ) order by mes)
      from ajudas_reconciliacao_mensal
      where aplicado_em is null
    ), '[]'::jsonb),
    'pagamentos_toconline_pendentes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id, 'salt_edge_payment_id', salt_edge_payment_id,
        'toconline_doc_id', toconline_doc_id, 'estado', estado
      ))
      from toconline_pagamentos_pendentes
      where estado is distinct from 'concluido'
    ), '[]'::jsonb)
  );
$$;

-- 5. Escala/turnos do trabalhador numa semana (default: semana atual,
-- segunda a domingo). p_semana pode ser qualquer dia dentro da semana
-- pretendida.
create or replace function public.get_escala_trabalhador(p_worker_id text, p_semana date default current_date)
returns jsonb
language sql stable as $$
  with semana as (
    select date_trunc('week', p_semana)::date as inicio,
           (date_trunc('week', p_semana) + interval '6 days')::date as fim
  )
  select jsonb_build_object(
    'worker_id', p_worker_id,
    'semana_inicio', (select inicio from semana),
    'semana_fim', (select fim from semana),
    'turnos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'shift_id', s.id,
        'nome', s.nome,
        'client_id', s.client_id,
        'cliente_nome', c.name,
        'schedule_id', s.schedule_id,
        'data_inicio', s.data_inicio,
        'data_fim', s.data_fim
      ) order by s.data_inicio)
      from worker_shifts s
      left join clients c on c.id = s.client_id
      cross join semana
      where s.worker_id = p_worker_id
        and s.data_inicio <= semana.fim
        and s.data_fim >= semana.inicio
    ), '[]'::jsonb)
  );
$$;

-- 6. Lista de documentos do trabalhador (metadados + link), nunca o
-- conteúdo (generated_html não é exposto).
create or replace function public.get_documentos_trabalhador(p_worker_id text)
returns jsonb
language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'titulo', title,
    'categoria', categoria,
    'status', status,
    'link_pdf', signed_pdf_url,
    'assinado_em', signed_at,
    'criado_em', created_at
  ) order by created_at desc), '[]'::jsonb)
  from worker_documents
  where worker_id = p_worker_id;
$$;
