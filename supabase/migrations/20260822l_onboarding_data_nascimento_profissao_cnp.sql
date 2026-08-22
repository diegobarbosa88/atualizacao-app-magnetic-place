-- Bug pré-existente (não relacionado com as migrações anteriores desta
-- série): OnboardingForm.jsx sempre recolheu data_nascimento e
-- profissao_cnp e enviou-os no insert (`...form`), mas a tabela nunca teve
-- estas colunas — toda a submissão do formulário público falhava com
-- "Could not find the 'data_nascimento' column ... in the schema cache".
alter table worker_onboarding_submissions
  add column if not exists data_nascimento date,
  add column if not exists profissao_cnp text;

notify pgrst, 'reload schema';
