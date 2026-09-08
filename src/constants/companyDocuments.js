// Documentos da EMPRESA (Magnetic Place como entidade, não de um
// trabalhador) que clientes por vezes exigem — pedido real de um cliente,
// 2026-09-08. Vive em company_documents, bucket "documentos-empresa".
export const TIPOS_DOCUMENTOS_EMPRESA = [
  'Certidão de Situação Fiscal Regularizada',
  'Certidão de Situação Contributiva Regularizada',
  'RLC — Recibo de Liquidação de Cotizações',
  'RNT — Relação Nominal de Trabalhadores',
  'TC2',
  'Certificado do Serviço de Prevenção Alheio',
  'Normas de Meio Ambiente',
  'Normas de Segurança e Higiene',
];

// RLC/RNT/TC2 são documentos mensais (um por mês de cotizações) — mantêm
// histórico completo, "pronto" é sempre o do período mais recente
// disponível, não um único ficheiro substituído. Os restantes só guardam
// o mais recente por tipo.
export const TIPOS_DOCUMENTOS_EMPRESA_MENSAIS = [
  'RLC — Recibo de Liquidação de Cotizações',
  'RNT — Relação Nominal de Trabalhadores',
  'TC2',
];
