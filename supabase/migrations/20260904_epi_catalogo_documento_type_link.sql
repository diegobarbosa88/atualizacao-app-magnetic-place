-- Liga o catálogo do documento (epi_catalogo_documento, texto legal/risco
-- por profissão, usado no Termo de Responsabilidade do Gate) ao catálogo
-- de stock (epi_types, usado em Entregar EPI/Pedidos). Array, não FK única,
-- porque um item do documento pode corresponder a mais que um SKU de stock
-- por profissão (ex. "Luvas Proteção" cobre tanto "Luvas de soldador" como
-- "Luvas de serralheiro" — dois epi_types distintos, discriminados na
-- entrega pela eligibility_professions de cada um).
ALTER TABLE epi_catalogo_documento ADD COLUMN IF NOT EXISTS epi_type_ids jsonb DEFAULT '[]'::jsonb;
COMMENT ON COLUMN epi_catalogo_documento.epi_type_ids IS 'ids de epi_types correspondentes a este item do documento — resolvidos por profissão na entrega (epiHelpers.isBaseEligible).';

-- Preenchimento inicial: só correspondências de conceito inequívocas entre
-- os dois catálogos (mesmo item físico, nomes já confirmados). 6 itens do
-- documento (bata_protecao, equipamento_respiracao_autonoma,
-- mascara_filtros_quimicos, protecao_calcado, touca_protecao, viseira)
-- ficam sem ligação — não existe ainda o SKU correspondente em epi_types.
UPDATE epi_catalogo_documento SET epi_type_ids = '["avental"]'::jsonb WHERE key = 'avental_manguito_polainas';
UPDATE epi_catalogo_documento SET epi_type_ids = '["botas"]'::jsonb WHERE key = 'calcado_protecao';
UPDATE epi_catalogo_documento SET epi_type_ids = '["capacete"]'::jsonb WHERE key = 'capacete';
UPDATE epi_catalogo_documento SET epi_type_ids = '["colete"]'::jsonb WHERE key = 'colete_refletorizado';
UPDATE epi_catalogo_documento SET epi_type_ids = '["arnes"]'::jsonb WHERE key = 'equipamento_anti_queda';
UPDATE epi_catalogo_documento SET epi_type_ids = '["luvas","luvas-de-serralheiro-32028"]'::jsonb WHERE key = 'luvas_protecao';
UPDATE epi_catalogo_documento SET epi_type_ids = '["mascara"]'::jsonb WHERE key = 'mascara_protecao';
UPDATE epi_catalogo_documento SET epi_type_ids = '["mascara-de-soldar-147"]'::jsonb WHERE key = 'mascara_soldar';
UPDATE epi_catalogo_documento SET epi_type_ids = '["oculos"]'::jsonb WHERE key = 'oculos';
UPDATE epi_catalogo_documento SET epi_type_ids = '["auricular"]'::jsonb WHERE key = 'protecao_auricular';
UPDATE epi_catalogo_documento SET epi_type_ids = '["conjunto-de-uniforme-anti-chama-99714"]'::jsonb WHERE key = 'vestuario_trabalho';
