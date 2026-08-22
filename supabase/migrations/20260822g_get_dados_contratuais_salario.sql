-- get_dados_contratuais passa a incluir vencimento_base e subsídio de
-- alimentação — necessário para o agente WhatsApp mostrar "valor atual →
-- novo valor" no rascunho antes de editar_contrato_trabalhador (nova tool
-- de escrita para tipo_contrato/regime/horas_semanais/profissao/salário).
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
    'cliente_atual_nome', c.name,
    'vencimento_base', w.vencimento_base,
    'subsidio_alimentacao_dia', w.subsidio_alimentacao_dia,
    'subsidio_alimentacao_tipo', w.subsidio_alimentacao_tipo
  )
  from workers w
  left join clients c on c.id = w."defaultClientId"
  where w.id = p_worker_id;
$$;
