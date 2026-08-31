-- onboarding_gate_itens ficou com RLS ativa e zero policies — bloqueava
-- silenciosamente o toggle "obrigatório no gate" de document_templates, que
-- escreve diretamente do browser do admin (mesmo padrão já usado por essa
-- tabela, ver policy "admin_access" nela). O lado das formações não sofria
-- disto porque passa sempre pela API com a service role key (que ignora
-- RLS), mas o lado dos documentos precisa mesmo de acesso direto.
CREATE POLICY admin_access ON onboarding_gate_itens FOR ALL USING (true);
