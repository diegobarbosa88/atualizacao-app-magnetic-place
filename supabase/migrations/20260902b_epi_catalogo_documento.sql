-- Catálogo de EPI usado na geração de documentos (checklist "Termo de
-- Responsabilidade — EPI" e similares), editável pelo admin — substitui os
-- ficheiros estáticos src/data/epiCatalogo.js + epiPerfis.js + epiIcones.js
-- como fonte de verdade da atribuição por profissão.
--
-- Texto de risco/manutenção transcrito verbatim do modelo oficial
-- (F-108_012) — não inventado nesta migração, só copiado dos ficheiros já
-- existentes. `profissoes` preserva exatamente a atribuição atual
-- (EPI_PERFIS: só Soldador/Serralheiro) — as outras 13 profissões reais
-- ficam de propósito sem nenhum EPI atribuído, a preencher pelo Diego no
-- admin (decisão explícita: mais seguro vazio do que inventado).
CREATE TABLE IF NOT EXISTS epi_catalogo_documento (
  key TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  risco TEXT NOT NULL,
  manutencao TEXT NOT NULL,
  icon_svg TEXT NOT NULL DEFAULT '',
  profissoes JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO epi_catalogo_documento (key, nome, risco, manutencao, icon_svg, profissoes) VALUES
('capacete', 'Capacete',
 'Ferimentos na cabeça provocados pela queda e/ou choque em/de objetos e/ou pancadas.',
 'Limpeza diária; Armazenar em local protegido; Substituir sempre que se encontra danificado; Marcar a data de receção no interior do casco; Verificação das condições de utilização antes de utilizar.',
 '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1B3A57" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16h16a8 8 0 0 0-16 0Z"/><path d="M2 16h20"/><path d="M12 4v4"/></svg>',
 '[]'::jsonb),

('touca_protecao', 'Touca Proteção',
 'Proteção biológica.',
 'Guardar em local adequado; limpar diariamente após utilização; substituir sempre que danificado.',
 '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1B3A57" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14a8 8 0 0 1 16 0"/><path d="M3 14h18v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/></svg>',
 '[]'::jsonb),

('protecao_auricular', 'Proteção Auricular',
 'Redução da capacidade auditiva por ação de ruídos com pressões elevadas ou por ruídos contínuos.',
 'Limpeza após utilização; guardar em local adequado, protegendo de poeiras; substituir sempre que danificado.',
 '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1B3A57" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 13a8 8 0 0 1 16 0"/><rect x="2.5" y="12" width="4" height="6" rx="1.5"/><rect x="17.5" y="12" width="4" height="6" rx="1.5"/></svg>',
 '["Soldador","Serralheiro"]'::jsonb),

('oculos', 'Óculos',
 'Ferimentos nos olhos devido à existência ou projeção de partículas.',
 'Limpeza diária; Armazenar em local protegido; Substituir sempre que se encontra danificado / riscado; Verificação das condições de utilização antes de utilizar; Substituir os vidros de proteção das máscaras de soldar sempre que necessário; Limpar viseiras com água e sabão.',
 '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1B3A57" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="9" width="7" height="6" rx="2"/><rect x="14.5" y="9" width="7" height="6" rx="2"/><path d="M9.5 12h5"/><path d="M2.5 11 1 10"/><path d="M21.5 11 23 10"/></svg>',
 '["Soldador","Serralheiro"]'::jsonb),

('viseira', 'Viseira',
 'Ferimentos na face e olhos, devido à projeção de partículas e líquidos, exposição a vapores, gases, temperaturas e radiações.',
 'Limpeza diária; Armazenar em local protegido; Substituir sempre que se encontra danificado / riscado; Verificação das condições de utilização antes de utilizar; Substituir os vidros de proteção das máscaras de soldar sempre que necessário; Limpar viseiras com água e sabão.',
 '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1B3A57" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8a9 9 0 0 1 18 0"/><path d="M3 8c0 5 3 9 9 9s9-4 9-9"/><path d="M3 8h18"/></svg>',
 '["Serralheiro"]'::jsonb),

('mascara_soldar', 'Máscara Soldar',
 'Ferimentos nos olhos e face devido ao encadeamento, projeção de partículas.',
 'Limpeza diária; Armazenar em local protegido; Substituir sempre que se encontra danificado / riscado; Verificação das condições de utilização antes de utilizar; Substituir os vidros de proteção das máscaras de soldar sempre que necessário; Limpar viseiras com água e sabão.',
 '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1B3A57" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12l1 8a7 7 0 0 1-14 0Z"/><rect x="8.5" y="8" width="7" height="4" rx="1"/></svg>',
 '["Soldador"]'::jsonb),

('mascara_protecao', 'Máscara Proteção',
 'Inalação de poeiras, fibras, fumos, aerossóis, etc.',
 'Limpeza após utilização; Armazenar em local protegido; Substituir sempre que se encontra danificado; Verificação das condições de utilização antes de utilizar; Lavar com água e sabão; substituir as cassetes (filtros) de acordo com a utilização e instruções do fabricante/fornecedor.',
 '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1B3A57" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12c0-3 3.5-5 8-5s8 2 8 5-3.5 6-8 6-8-3-8-6Z"/><path d="M4 12h16"/></svg>',
 '["Soldador","Serralheiro"]'::jsonb),

('mascara_filtros_quimicos', 'Máscara Filtros Químicos',
 'Inalação de gases e vapores.',
 'Limpeza após utilização; Armazenar em local protegido; Substituir sempre que se encontra danificado; Verificação das condições de utilização antes de utilizar; Lavar com água e sabão; substituir as cassetes (filtros) de acordo com a utilização e instruções do fabricante/fornecedor.',
 '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1B3A57" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 11c0-2.5 2.7-4 6-4s6 1.5 6 4-2.7 5-6 5-6-2.5-6-5Z"/><circle cx="7" cy="15" r="2"/><circle cx="17" cy="15" r="2"/></svg>',
 '[]'::jsonb),

('equipamento_respiracao_autonoma', 'Equipamento Respiração Autónoma',
 'Asfixia.',
 'Guardar em local adequado; inspecionar diariamente antes da sua utilização; substituir assim que detetadas anomalias; seguir as instruções do fabricante.',
 '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1B3A57" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="11" rx="2.5"/><path d="M12 13v3"/><path d="M7 20c0-2.8 2.2-5 5-5s5 2.2 5 5"/></svg>',
 '[]'::jsonb),

('bata_protecao', 'Bata de Proteção',
 'Salpicos de produtos biológicos, exposição a agentes químicos (poeiras, líquidos, etc.).',
 'Guardar em local próprio e separado de outros equipamentos e vestuários; limpeza sempre que necessário; de acordo com o tipo de exposição, eliminar o mesmo após utilização.',
 '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1B3A57" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6l1 3-1 1v12a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V7l-1-1Z"/><path d="M9 7 4 9v6"/><path d="M15 7l5 2v6"/></svg>',
 '[]'::jsonb),

('vestuario_trabalho', 'Vestuário de Trabalho',
 'Proteção de corpo inteiro contra agentes diversos (temperatura, humidade, químicos, mecânicos, etc.).',
 'Guardar em local próprio e separado de outros EPI''s e vestuário; limpeza semanal ou diária consoante a sua utilização e sujidade; substituir sempre que danificado.',
 '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1B3A57" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3 5 6v4l2-1v10a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V9l2 1V6l-3-3-2 2H10Z"/></svg>',
 '["Soldador","Serralheiro"]'::jsonb),

('colete_refletorizado', 'Colete Refletorizado',
 'Atropelamento, esmagamento, entalamento, pancada, embate provocado por equipamentos móveis dirigíveis ou pela movimentação de cargas por esses equipamentos externos.',
 'Arrumar em local próprio; substituir quando danificado; não lavar em máquina (bandas refletoras ficam danificadas).',
 '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1B3A57" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3 6 6v14a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6l-2-3-3 2h-2Z"/><path d="M7 10h10"/><path d="M7 14h10"/></svg>',
 '[]'::jsonb),

('avental_manguito_polainas', 'Avental, Manguito, Polainas de couro',
 'Queimaduras e cortes provocados pela projeção de partículas incandescentes.',
 'Arrumar em local adequado; proceder à sua limpeza sempre que necessário; substituir sempre que necessário.',
 '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1B3A57" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2h6v3l2 2v14a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V7l2-2Z"/><path d="M9 12h6"/></svg>',
 '["Soldador","Serralheiro"]'::jsonb),

('luvas_protecao', 'Luvas Proteção',
 'Entalamento, queimaduras, queimaduras químicas, projeção de partículas e eletrização nas mãos.',
 'Limpeza sempre que necessário; arrumar em local adequado e em separado de outros EPI''s; substituir sempre que danificadas.',
 '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1B3A57" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 21v-9a3 3 0 0 1 3-3h1a3 3 0 0 1 3 3v1a3 3 0 0 1 3 3v5a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2Z"/></svg>',
 '["Soldador","Serralheiro"]'::jsonb),

('calcado_protecao', 'Calçado Proteção',
 'Entalamento, esmagamento, pancada, embate, queimaduras nos pés, lesões músculo-esqueléticas e no sistema imunitário provocado pelo calçado.',
 'Limpeza diária após utilização; recomenda-se a exposição solar durante 2-3h de forma a eliminar bactérias no interior; substituir sempre que danificadas.',
 '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1B3A57" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3v9l-3 3v3a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1c0-2-2-3-5-4l-4-1.5V3Z"/></svg>',
 '["Soldador","Serralheiro"]'::jsonb),

('protecao_calcado', 'Proteção Calçado',
 'Contaminações involuntárias.',
 'Guardar em local próprio e separado de outros equipamentos e vestuários; limpeza após utilização; de acordo com o tipo de exposição, eliminar o mesmo após utilização.',
 '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1B3A57" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 10c0-3 2-6 5-6h2v9l6 2a2 2 0 0 1 1 1.8V19a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1Z"/></svg>',
 '[]'::jsonb),

('equipamento_anti_queda', 'Equipamento Anti-queda (arnês)',
 'Queda em altura.',
 'Guardar em local adequado; proceder à sua limpeza com água e sabão; verificar as instruções do fabricante referente à sua limpeza; verificar a marcação CE e validade do mesmo; proceder diariamente à sua inspeção visual; substituir sempre que danificado.',
 '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1B3A57" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="2.2"/><path d="M12 7v14"/><path d="M6 11h12"/><path d="M8 9l4 2 4-2"/><path d="M8 21l4-8 4 8"/></svg>',
 '[]'::jsonb)
ON CONFLICT (key) DO NOTHING;
