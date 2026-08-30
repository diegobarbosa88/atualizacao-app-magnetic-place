alter table worker_onboarding_invites add column if not exists nome text;
comment on column worker_onboarding_invites.nome is 'Nome do convidado -- usado para personalizar o template de WhatsApp "empresa escreve primeiro" (mp_convite_onboarding).';
