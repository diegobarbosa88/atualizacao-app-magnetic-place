-- Liga o "Compromisso de Início de Atividade" (assinado pelo candidato antes
-- de ser aprovado) ao worker que resultou da aprovação. Até agora só existia
-- invite_id, sem caminho nenhum até workers.
alter table onboarding_commitments
  add column if not exists worker_id text references workers(id) on delete set null;

create index if not exists onboarding_commitments_worker_idx
  on onboarding_commitments(worker_id);

-- aprovar_onboarding_submissao passa a gravar a ligação no mesmo bloco em
-- que já marca a submissão como aprovada — v_sub.invite_id já estava
-- disponível em memória, só nunca era usado para isto.
create or replace function public.aprovar_onboarding_submissao(p_submission_id text, p_overrides jsonb DEFAULT '{}'::jsonb)
 returns text
 language plpgsql
as $function$
declare
  v_sub worker_onboarding_submissions%rowtype;
  v_worker_id text;
  v_valor_hora numeric;
  v_default_client_id text;
  v_default_schedule_id text;
  v_data_inicio text;
  v_assigned_client_dates jsonb := '{}'::jsonb;
  v_assigned_schedule_dates jsonb := '{}'::jsonb;
begin
  select * into v_sub from worker_onboarding_submissions where id = p_submission_id and status = 'pending';
  if not found then
    raise exception 'Submissão % não encontrada ou já revista.', p_submission_id;
  end if;

  v_worker_id := 'worker_' || (extract(epoch from now()) * 1000)::bigint::text;
  v_valor_hora := (p_overrides->>'valor_hora')::numeric;
  v_default_client_id := coalesce(p_overrides->>'default_client_id', '');
  v_default_schedule_id := coalesce(p_overrides->>'default_schedule_id', '');
  v_data_inicio := p_overrides->>'data_inicio';

  -- O período de afetação (e o "desde" do valor/hora, mais abaixo) contam a
  -- partir do dia em que o trabalhador de facto começa, não do dia em que o
  -- admin aprova o registo — os dois podem ser dias diferentes.
  if v_default_client_id <> '' and v_data_inicio is not null then
    v_assigned_client_dates := jsonb_build_object(v_default_client_id, jsonb_build_object('dataInicio', v_data_inicio));
  end if;
  if v_default_schedule_id <> '' and v_data_inicio is not null then
    v_assigned_schedule_dates := jsonb_build_object(v_default_schedule_id, jsonb_build_object('dataInicio', v_data_inicio));
  end if;

  insert into workers (
    id, name, profissao, profissao_cnp, tel, email, dni, dni_tipo, address,
    tabela_irs, n_dependentes, nis, nif, iban,
    is_active, data_nascimento, estado_civil, documento_validade,
    "dataInicio", vencimento_base, "valorHora",
    tipo_contrato, regime, horas_semanais, modo_trabalho, enquadramento,
    subsidio_alimentacao_dia, subsidio_alimentacao_tipo, local_trabalho,
    "defaultClientId", "defaultScheduleId",
    "assignedClients", "assignedSchedules",
    "assignedClientDates", "assignedScheduleDates", limited_entry_mode
  ) values (
    v_worker_id,
    coalesce(p_overrides->>'nome', v_sub.nome),
    coalesce(p_overrides->>'profissao', v_sub.profissao, ''),
    coalesce(p_overrides->>'profissao_cnp', v_sub.profissao_cnp),
    coalesce(p_overrides->>'tel', v_sub.tel, ''),
    coalesce(p_overrides->>'email', v_sub.email, ''),
    coalesce(p_overrides->>'dni', v_sub.dni, ''),
    v_sub.dni_tipo,
    coalesce(p_overrides->>'address', v_sub.address, ''),
    coalesce(p_overrides->>'tabela_irs', v_sub.tabela_irs, 'tabelaI'),
    coalesce((p_overrides->>'n_dependentes')::int, v_sub.n_dependentes, 0),
    coalesce(p_overrides->>'nis', v_sub.nis, ''),
    coalesce(p_overrides->>'nif', v_sub.nif, ''),
    coalesce(p_overrides->>'iban', v_sub.iban, ''),
    true,
    v_sub.data_nascimento,
    v_sub.estado_civil,
    v_sub.documento_validade,
    v_data_inicio,
    (p_overrides->>'vencimento_base')::numeric,
    p_overrides->>'valor_hora',
    coalesce(p_overrides->>'tipo_contrato', 'sem_termo'),
    coalesce(p_overrides->>'regime', 'tempo_inteiro'),
    coalesce((p_overrides->>'horas_semanais')::numeric, 40),
    coalesce(p_overrides->>'modo_trabalho', 'presencial'),
    coalesce(p_overrides->>'enquadramento', 'REGE'),
    (p_overrides->>'subsidio_alimentacao_dia')::numeric,
    p_overrides->>'subsidio_alimentacao_tipo',
    (p_overrides->>'local_trabalho')::int,
    v_default_client_id,
    v_default_schedule_id,
    case when v_default_client_id <> '' then array[v_default_client_id] else '{}'::text[] end,
    case when v_default_schedule_id <> '' then array[v_default_schedule_id] else '{}'::text[] end,
    v_assigned_client_dates,
    v_assigned_schedule_dates,
    false
  );

  if v_valor_hora is not null then
    insert into worker_valorhora_history (id, worker_id, valor_anterior, valor_novo, data_alteracao)
    values (gen_random_uuid(), v_worker_id, null, v_valor_hora, coalesce(v_data_inicio::timestamptz, now()));
  end if;

  update worker_onboarding_submissions
    set status = 'approved', reviewed_at = now()
    where id = p_submission_id;

  if v_sub.invite_id is not null then
    update onboarding_commitments
      set worker_id = v_worker_id
      where invite_id = v_sub.invite_id;
  end if;

  return v_worker_id;
end;
$function$;

-- Backfill: só os 5 pares onde nome+NIF batem exatamente entre a submissão
-- aprovada e um único worker (dados de teste com NIF fictício repetido em
-- vários registos ficam de propósito sem ligação, por ambiguidade real).
update onboarding_commitments set worker_id = 'worker_1788427351760' where id = 'obc_1788370446295';
update onboarding_commitments set worker_id = 'worker_1788431002791' where id = 'obc_1788430976327';
update onboarding_commitments set worker_id = 'worker_1788431667223' where id = 'obc_1788431245683';
update onboarding_commitments set worker_id = 'worker_1788434972940' where id = 'obc_1788434892116';
update onboarding_commitments set worker_id = 'worker_1788472515279' where id = 'obc_1788472361424';
