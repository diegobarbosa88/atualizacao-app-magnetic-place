-- Corrige get_escala_trabalhador (a versão em 20260822b usava worker_shifts,
-- uma tabela que existe na BD mas não é usada em lado nenhum do frontend —
-- confirmado por grep ao código fonte. O modelo real de escala é:
-- workers.assignedSchedules/assignedClients (arrays de ids) +
-- workers.assignedScheduleDates/assignedClientDates (jsonb com janelas de
-- validade por id) + defaultScheduleId/defaultClientId, conforme usado em
-- ScheduleContext.jsx e WorkerScheduleTab.jsx. Substitui a função anterior
-- (mesma assinatura, so CREATE OR REPLACE).
create or replace function public.get_escala_trabalhador(p_worker_id text, p_semana date default current_date)
returns jsonb
language plpgsql stable as $$
declare
  v_inicio date := date_trunc('week', p_semana)::date;
  v_fim date := (date_trunc('week', p_semana) + interval '6 days')::date;
  v_worker workers%rowtype;
begin
  select * into v_worker from workers where id = p_worker_id;
  if not found then
    return jsonb_build_object('erro', 'Trabalhador não encontrado.');
  end if;

  return jsonb_build_object(
    'worker_id', p_worker_id,
    'nome', v_worker.name,
    'semana_inicio', v_inicio,
    'semana_fim', v_fim,
    'cliente_padrao_id', v_worker."defaultClientId",
    'cliente_padrao_nome', (select name from clients where id = v_worker."defaultClientId"),
    'clientes_ativos_na_semana', coalesce((
      select jsonb_agg(jsonb_build_object(
        'client_id', cid,
        'cliente_nome', c.name,
        'data_inicio', v_worker."assignedClientDates" -> cid ->> 'dataInicio',
        'data_fim', v_worker."assignedClientDates" -> cid ->> 'dataFim'
      ))
      from unnest(coalesce(v_worker."assignedClients", '{}'::text[])) as cid
      left join clients c on c.id = cid
      where (v_worker."assignedClientDates" -> cid ->> 'dataInicio' is null
             or (v_worker."assignedClientDates" -> cid ->> 'dataInicio')::date <= v_fim)
        and (v_worker."assignedClientDates" -> cid ->> 'dataFim' is null
             or (v_worker."assignedClientDates" -> cid ->> 'dataFim')::date >= v_inicio)
    ), '[]'::jsonb),
    'turnos_ativos_na_semana', coalesce((
      select jsonb_agg(jsonb_build_object(
        'schedule_id', sid,
        'nome', s.name,
        'horario_inicio', s."startTime",
        'horario_fim', s."endTime",
        'avancado', s."isAdvanced",
        'dias_semana', s.weekdays,
        'daily_configs', case when s."isAdvanced" then s."dailyConfigs" else null end,
        'is_default', (sid = v_worker."defaultScheduleId"),
        'data_inicio', v_worker."assignedScheduleDates" -> sid ->> 'dataInicio',
        'data_fim', v_worker."assignedScheduleDates" -> sid ->> 'dataFim'
      ))
      from unnest(coalesce(v_worker."assignedSchedules", '{}'::text[])) as sid
      left join schedules s on s.id = sid
      where (v_worker."assignedScheduleDates" -> sid ->> 'dataInicio' is null
             or (v_worker."assignedScheduleDates" -> sid ->> 'dataInicio')::date <= v_fim)
        and (v_worker."assignedScheduleDates" -> sid ->> 'dataFim' is null
             or (v_worker."assignedScheduleDates" -> sid ->> 'dataFim')::date >= v_inicio)
    ), '[]'::jsonb)
  );
end;
$$;

-- Resumo financeiro estimado (faturação a clientes menos custos), por mês
-- ("YYYY-MM", default mês atual). Não existe um módulo de P&L/margens já
-- calculado na app — esta função aproxima a partir das tabelas existentes:
-- faturacao_clientes_pagamentos (faturado), pagamentos_fornecedores (custos
-- a fornecedores), contabilidade_mensal (ajudas de custo do mês) e o
-- vencimento_base do quadro de pessoal ATIVO HOJE (não há histórico salarial
-- mensal). Por isso é uma estimativa, não substitui a contabilidade oficial.
create or replace function public.get_resumo_financeiro(p_mes text default null)
returns jsonb
language sql stable as $$
  with mes as (
    select coalesce(p_mes, to_char(current_date, 'YYYY-MM')) as valor
  )
  select jsonb_build_object(
    'mes', (select valor from mes),
    'faturado_clientes', coalesce((
      select sum(valor_faturado) from faturacao_clientes_pagamentos
      where period = (select valor from mes)
    ), 0),
    'custos_fornecedores_pagos', coalesce((
      select sum(valor) from pagamentos_fornecedores
      where to_char(data_pagamento, 'YYYY-MM') = (select valor from mes)
    ), 0),
    'custos_ajudas_custo', coalesce((
      select sum(ajudas_custo_outros) from contabilidade_mensal
      where mes = (select valor from mes)
    ), 0),
    'custo_salarial_estimado_atual', coalesce((
      select sum(vencimento_base) from workers where is_active = true
    ), 0),
    'margem_estimada',
      coalesce((select sum(valor_faturado) from faturacao_clientes_pagamentos where period = (select valor from mes)), 0)
      - coalesce((select sum(valor) from pagamentos_fornecedores where to_char(data_pagamento, 'YYYY-MM') = (select valor from mes)), 0)
      - coalesce((select sum(ajudas_custo_outros) from contabilidade_mensal where mes = (select valor from mes)), 0)
      - coalesce((select sum(vencimento_base) from workers where is_active = true), 0),
    'aviso', 'Estimativa aproximada, não é a contabilidade oficial: custo_salarial_estimado_atual usa o quadro de pessoal ativo HOJE (não o histórico salarial desse mês específico), e não inclui subsídios, impostos ou encargos da Segurança Social. Para valores definitivos, confirmar com o TOConline/contador.'
  );
$$;
