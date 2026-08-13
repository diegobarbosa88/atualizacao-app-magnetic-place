-- guardarValidacao() fazia sempre INSERT, nunca verificando se já existia
-- um registo para o mesmo trabalhador+mês — reprocessar o mesmo lote
-- (ex: Burst + "Guardar" outra vez) criava duplicados silenciosos, e como
-- as leituras (SalariosTab.jsx/ReconciliacaoSalarialAdmin.jsx) nunca tinham
-- .order(), qual dos duplicados a UI mostrava não era garantido.
--
-- Confirmado antes de criar esta constraint que não há duplicados reais
-- entre linhas com worker_id preenchido (0 grupos) — os únicos grupos
-- worker_id+mes repetidos são todos com worker_id NULL (trabalhador não
-- reconhecido automaticamente), e o Postgres trata NULL como distinto de
-- si próprio em índices únicos, por isso essas linhas não são bloqueadas
-- por este índice nem são indevidamente fundidas entre si.
create unique index if not exists idx_receipt_validations_worker_mes_unique
  on receipt_validations (worker_id, mes);
