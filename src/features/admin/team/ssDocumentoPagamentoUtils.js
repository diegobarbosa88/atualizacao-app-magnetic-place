// Utilitário partilhado entre SSConsultasPanel.jsx (consulta) e
// EmitirDocumentoPagamentoModal.jsx (emissão — usa a mesma estrutura
// ObterDocumentoPagamento devolvida pela PSI) — extraído para ficheiro
// próprio para evitar import circular entre os dois componentes.

// Reduz o objeto aninhado `referenciaDocumentoPagamento` (multibanco / tesouraria /
// transferência bancária / débito direto) a uma única linha legível — prioriza o
// meio de pagamento mais informativo disponível.
export function formatReferencia(ref) {
  if (!ref) return '—';
  const mb = ref.pagamentoMultibanco;
  if (mb?.referenciaMultibanco) return `MB ${mb.entidadeMultibanco ?? ''} ${mb.referenciaMultibanco}`.trim();
  const tb = ref.pagamentoTransferenciaBancaria;
  if (tb?.Iban) return `IBAN ${tb.Iban}`;
  if (ref.pagamentoTesouraria === 'S') return 'Tesouraria';
  const dd = ref.pagamentoDebitoDireto;
  if (dd?.numeroAutorizacao) return `Débito Direto (ADC ${dd.numeroAutorizacao})`;
  return '—';
}
