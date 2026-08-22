-- Consolida a criação do trabalhador a partir de uma submissão de onboarding
-- numa única RPC, reutilizada por OnboardingPendentes.jsx (app) e pelas
-- novas tools do Trabalhador Virtual (aprovar/rejeitar pelo WhatsApp) — evita
-- duas implementações divergentes da mesma lógica de criação.
--
-- Também fecha a lacuna encontrada: handleAprovar() só preenchia
-- nome/profissão/contacto/fiscais + data_inicio/vencimento_base/valorHora,
-- nunca os campos de contrato (tipo_contrato, regime, horas_semanais,
-- modo_trabalho, enquadramento, profissao_cnp, subsídio de alimentação,
-- cliente/horário, código de local de trabalho para a SS) que
-- WorkerForm.jsx sempre recolhe num trabalhador criado normalmente. Aceita
-- overrides em jsonb; quando não indicados, usa os mesmos defaults do
-- WorkerForm.jsx.
create or replace function public.aprovar_onboarding_submissao(
  p_submission_id text,
  p_overrides jsonb default '{}'::jsonb
)
returns text
language plpgsql as $$
declare
  v_sub worker_onboarding_submissions%rowtype;
  v_worker_id text;
begin
  select * into v_sub from worker_onboarding_submissions where id = p_submission_id and status = 'pending';
  if not found then
    raise exception 'Submissão % não encontrada ou já revista.', p_submission_id;
  end if;

  v_worker_id := 'worker_' || (extract(epoch from now()) * 1000)::bigint::text;

  insert into workers (
    id, name, profissao, profissao_cnp, tel, email, dni, address,
    tabela_irs, n_dependentes, nis, nif, iban,
    is_active,
    "dataInicio", vencimento_base, "valorHora",
    tipo_contrato, regime, horas_semanais, modo_trabalho, enquadramento,
    subsidio_alimentacao_dia, subsidio_alimentacao_tipo, local_trabalho,
    "defaultClientId", "defaultScheduleId",
    "assignedClients", "assignedSchedules", limited_entry_mode
  ) values (
    v_worker_id,
    coalesce(p_overrides->>'nome', v_sub.nome),
    coalesce(p_overrides->>'profissao', v_sub.profissao, ''),
    coalesce(p_overrides->>'profissao_cnp', v_sub.profissao_cnp),
    coalesce(p_overrides->>'tel', v_sub.tel, ''),
    coalesce(p_overrides->>'email', v_sub.email, ''),
    coalesce(p_overrides->>'dni', v_sub.dni, ''),
    coalesce(p_overrides->>'address', v_sub.address, ''),
    coalesce(p_overrides->>'tabela_irs', v_sub.tabela_irs, 'tabelaI'),
    coalesce((p_overrides->>'n_dependentes')::int, v_sub.n_dependentes, 0),
    coalesce(p_overrides->>'nis', v_sub.nis, ''),
    coalesce(p_overrides->>'nif', v_sub.nif, ''),
    coalesce(p_overrides->>'iban', v_sub.iban, ''),
    true,
    p_overrides->>'data_inicio',
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
    coalesce(p_overrides->>'default_client_id', ''),
    coalesce(p_overrides->>'default_schedule_id', ''),
    '{}'::text[], '{}'::text[], false
  );

  update worker_onboarding_submissions
    set status = 'approved', reviewed_at = now()
    where id = p_submission_id;

  return v_worker_id;
end;
$$;

create or replace function public.rejeitar_onboarding_submissao(
  p_submission_id text,
  p_motivo text default null
)
returns void
language sql as $$
  update worker_onboarding_submissions
    set status = 'rejected', rejection_reason = p_motivo, reviewed_at = now()
    where id = p_submission_id and status = 'pending';
$$;
