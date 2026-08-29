-- Onboarding via WhatsApp — rascunho preenchido no Flow, assinatura na web.
--
-- O Flow do WhatsApp recolhe os passos 1-3 do formulário (dados pessoais,
-- situação fiscal, dados financeiros) mas NÃO consegue recolher a assinatura
-- desenhada do compromisso (art. 103.º CT) — os Flows da Meta não têm canvas.
--
-- Por isso o Flow grava aqui, no próprio convite, e não em
-- worker_onboarding_submissions: assim nunca existe uma submissão sem
-- assinatura à espera de aprovação no painel. A página web lê este rascunho,
-- hidrata o formulário e salta para a Revisão (passo 3, onde se aceita o RGPD
-- e se corrigem erros), e a cadeia legal (assinatura -> hash -> PDF -> submissão
-- -> convite usado) corre exatamente como corre hoje para quem preenche tudo no
-- browser.
--
-- tel: número de WhatsApp do trabalhador, para a via em que a empresa escreve
-- primeiro (message template aprovado pela Meta). Nulo na via em que é o
-- trabalhador a escrever primeiro pelo link wa.me.

alter table worker_onboarding_invites
  add column if not exists draft_data jsonb,
  add column if not exists tel text;

comment on column worker_onboarding_invites.draft_data is
  'Rascunho dos passos 1-3 preenchido via WhatsApp Flow. A submissão só nasce quando o trabalhador assina na web.';
comment on column worker_onboarding_invites.tel is
  'Número WhatsApp do trabalhador (E.164, só dígitos), para envio do template Meta.';

notify pgrst, 'reload schema';
