-- Schema drift confirmado: a tabela real em produção não tem as colunas
-- transaction_section/transaction_index que a migration original
-- (20260520_faturacao_clientes_pagamentos.sql) sempre definiu e que todo o
-- código (useReconciliacaoRun.js, HistoricoSection.jsx, CostReports.jsx) já
-- assume — algures a tabela real divergiu do que está versionado aqui,
-- fora do controlo de migrations. A tabela tem hoje run_id/tx_key em vez
-- disso, mas nenhum código atual os usa; ficam intocados, sem risco.
-- Aditiva e segura: tabela tem 0 linhas hoje, colunas nullable.
alter table faturacao_clientes_pagamentos
  add column if not exists transaction_section text;
alter table faturacao_clientes_pagamentos
  add column if not exists transaction_index integer;
