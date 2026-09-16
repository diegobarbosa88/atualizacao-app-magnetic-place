-- Permite cancelar um export SEPA gerado por engano (ex: valores errados,
-- trabalhador a mais/a menos) sem apagar o registo -- mantém rasto de
-- auditoria. Um export cancelado deixa de contar como "já processado" na
-- Reconciliação Salarial e deixa de ser candidato a lote SEPA para
-- transações bancárias não identificadas (ver encontrarLoteCandidato em
-- reconciliacaoSalarialEngine.js).
alter table sepa_exports
  add column if not exists cancelled_at timestamptz null,
  add column if not exists cancelled_reason text null;
