-- Último placeholder do "Compromisso de Início de Atividade" que ainda não
-- tinha substituição nem campo de recolha: [estado civil] na Cláusula 1.ª.
alter table worker_onboarding_submissions
  add column if not exists estado_civil text;
