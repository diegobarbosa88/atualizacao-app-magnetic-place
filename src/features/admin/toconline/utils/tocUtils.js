// Constantes partilhadas
export const MESES = [
  { val: '01', label: 'Janeiro' }, { val: '02', label: 'Fevereiro' },
  { val: '03', label: 'Março' }, { val: '04', label: 'Abril' },
  { val: '05', label: 'Maio' }, { val: '06', label: 'Junho' },
  { val: '07', label: 'Julho' }, { val: '08', label: 'Agosto' },
  { val: '09', label: 'Setembro' }, { val: '10', label: 'Outubro' },
  { val: '11', label: 'Novembro' }, { val: '12', label: 'Dezembro' },
];

export const VALOR_KEYS = ['total_amount', 'gross_total', 'total_tax_amount', 'net_amount', 'received_value', 'total_value'];

export const FIELD_LABELS_TOC = {
  document_number: 'Nº Documento', document_no: 'Nº Documento',
  date: 'Data', due_date: 'Data Vencimento',
  customer_name: 'Cliente', customer_business_name: 'Empresa Cliente',
  customer_tax_number: 'NIF Cliente',
  supplier_name: 'Fornecedor', supplier_business_name: 'Empresa Fornecedor',
  supplier_tax_number: 'NIF Fornecedor',
  total_amount: 'Total (€)', gross_total: 'Total Bruto (€)',
  total_tax_amount: 'IVA (€)', total_value: 'Total (€)',
  net_amount: 'Líquido (€)', received_value: 'Valor Recebido (€)',
  document_type_name: 'Tipo', status: 'Estado',
  notes: 'Notas', series: 'Série',
  payment_method: 'Forma de Pagamento', payment_status: 'Estado Pagamento',
  currency: 'Moeda', description: 'Descrição',
  discount: 'Desconto', tax_country_region: 'Região Fiscal',
};

// Normaliza item JSON:API ou flat
export function getAttrs(item) {
  return item?.attributes || item || {};
}

// Extrai nome de entidade (cliente ou fornecedor)
export function getNomeEntidade(attrs, tipo) {
  if (tipo === 'compras') {
    return attrs.supplier_business_name || attrs.supplier_name || attrs.entity_name || '';
  }
  return attrs.customer_business_name || attrs.customer_name || attrs.entity_name || '';
}

// Extrai valor total do documento
export function getValorTotal(attrs) {
  return attrs.gross_total ?? attrs.total_amount ?? attrs.net_amount ?? attrs.total_value ?? attrs.received_value ?? null;
}

// Extrai valor de IVA
export function getIva(attrs) {
  return attrs.tax_payable ?? attrs.total_tax_amount ?? attrs.tax_total ?? attrs.total_tax ?? null;
}

// Extrai número do documento
export function getDocNum(item, attrs) {
  return attrs.document_number || attrs.document_no || attrs.number || attrs.doc_number || attrs.reference || (item?.id ? `#${item.id}` : '—');
}

// Extrai observação/notas
export function getObservacao(attrs) {
  return attrs.notes || attrs.observations || attrs.observation || attrs.remarks || attrs.memo || attrs.description || null;
}

// Formata valor monetário ou genérico para display no modal de detalhe
export function formatValToc(k, v) {
  if (VALOR_KEYS.includes(k)) {
    const n = parseFloat(v);
    return isNaN(n) ? String(v) : n.toFixed(2) + ' €';
  }
  return String(v);
}

// Label legível do tipo de documento
export function tipoDocLabel(tipo) {
  if (tipo === 'compras') return 'Documento de Compra';
  if (tipo === 'recibos') return 'Recibo';
  return 'Documento de Venda';
}
