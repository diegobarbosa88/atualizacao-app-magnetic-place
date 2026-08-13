-- run_id e tx_key (colunas não usadas por código nenhum hoje, herdadas do
-- schema drift já documentado em 20260822_faturacao_clientes_pagamentos_
-- transaction_cols.sql) tinham NOT NULL, bloqueando qualquer insert feito
-- pelo código atual (que nunca as preenche). Só torna nullable — sem lhes
-- tocar mais nada, sem alterar o código.
alter table faturacao_clientes_pagamentos
  alter column run_id drop not null;
alter table faturacao_clientes_pagamentos
  alter column tx_key drop not null;
