-- RLS para a tabela ajudas_faturadas_clientes
ALTER TABLE ajudas_faturadas_clientes ENABLE ROW LEVEL SECURITY;

-- Utilizadores autenticados podem ler, inserir e atualizar
CREATE POLICY "auth_select" ON ajudas_faturadas_clientes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth_insert" ON ajudas_faturadas_clientes
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "auth_update" ON ajudas_faturadas_clientes
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
