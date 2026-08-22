-- Campos que faltavam para o "Compromisso de Início de Atividade" deixar de
-- mostrar placeholders literais ([_____], [__/__/____]) ao candidato:
--
-- 1. vencimento_base/data_inicio_prevista/local_trabalho_texto no CONVITE:
--    estes 3 valores só existiam hoje no lado do admin, preenchidos DEPOIS
--    da submissão (OnboardingPendentes.jsx, "Completar registo") — mas o
--    texto do compromisso promete-os ANTES de o candidato assinar. Passam a
--    ser decididos pelo admin ao gerar o convite (TeamManager.jsx ou via
--    Trabalhador Virtual), ficando gravados desde o início.
-- 2. documento_validade na SUBMISSÃO: o formulário público recolhe o nº do
--    documento de identificação mas nunca perguntou a validade — o texto
--    legal promete-a ("válido até [__/__/____]").
alter table worker_onboarding_invites
  add column if not exists vencimento_base numeric,
  add column if not exists data_inicio_prevista date,
  add column if not exists local_trabalho_texto text;

alter table worker_onboarding_submissions
  add column if not exists documento_validade date;
