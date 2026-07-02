// Helper partilhado para emitir documentos (faturas) via API TOConline.
// Concentra o POST e o tratamento de erro que estava duplicado nos modais
// FaturarClienteModal e CriarDocumentoModal.
//
// @param {object} payload - corpo aceite por /api/toconline/create-fatura
//   ({ cliente, linhas, tipo_documento, data, serie, observacoes, ... }).
// @returns {Promise<object>} JSON da resposta ({ doc_id, documento, warning? }).
// @throws {Error} com a mensagem de erro da API quando a resposta não é ok.
export async function emitirDocumento(payload) {
  const res = await fetch('/api/toconline/create-fatura', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erro ao emitir documento');
  return data;
}
