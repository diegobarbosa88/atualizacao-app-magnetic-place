export const CATEGORIAS_RH_ACT = [
  "Contratual",
  "Remuneração",
  "Identificação e Legalização",
  "Saúde e Segurança no Trabalho",
  "Segurança Social e Fiscal",
  "Formação Profissional",
  "Tempo de Trabalho",
  "Outros",
];

export const MAPA_SCANNER_ACT = {
  "Identificação e Legalização":  "Identificação e Legalização",
  "Fiscal e Segurança Social":    "Segurança Social e Fiscal",
  "Saúde e Segurança no Trabalho":"Saúde e Segurança no Trabalho",
  "Contratual e Habilitações":    "Contratual",
  "Outros":                       "Outros",
};

// Mantido para compatibilidade com o UploadManualModal (auto-fill de categoria ao mudar tipo)
export const AUTO_CATEGORIA_TIPO = {
  "Recibo de Vencimento": "Remuneração",
  "Mapa de Deslocamento": "Remuneração",
  "Contrato de Trabalho": "Contratual",
};

/**
 * Infere a categoria ACT a partir do texto do campo `tipo`, usando substring case-insensitive.
 * Usar em vez de AUTO_CATEGORIA_TIPO quando o valor exato pode variar.
 * @param {string|null} tipo
 * @returns {string|null}
 */
export const inferirCategoria = (tipo) => {
  if (!tipo) return null;
  const t = tipo.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (t.includes('contrato') || t.includes('adenda') || t.includes('renovacao')) return 'Contratual';
  if (t.includes('recibo') || t.includes('vencimento') || t.includes('deslocamento') || t.includes('salario')) return 'Remuneração';
  if (t.includes('cidadao') || t.includes('residencia') || t.includes('passaporte') || t.includes('identificacao') || t.includes('carta de conducao')) return 'Identificação e Legalização';
  if (t.includes('aptidao') || t.includes('sst') || t.includes('medica') || t.includes('saude') || t.includes('baixa medica') || t.includes('clinica')) return 'Saúde e Segurança no Trabalho';
  if (t.includes('nif') || t.includes('niss') || t.includes('iban') || t.includes('fiscal') || t.includes('seguranca social') || t.includes('inicio de atividade')) return 'Segurança Social e Fiscal';
  if (t.includes('formacao') || t.includes('certificado') || t.includes('diploma') || t.includes('habilitacoes')) return 'Formação Profissional';
  return null;
};

// Categorias cujos documentos têm data de validade típica
export const CATEGORIAS_COM_VALIDADE = [
  "Identificação e Legalização",
  "Saúde e Segurança no Trabalho",
  "Contratual",
];

/**
 * Retorna o estado de validade de um documento.
 * @param {string|null} dataValidade - Data de validade em formato ISO (YYYY-MM-DD) ou null
 * @returns {'expirado'|'urgente'|'aviso'|'ok'|null}
 */
export const getValidadeStatus = (dataValidade) => {
  if (!dataValidade) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const validade = new Date(dataValidade);
  const diasRestantes = Math.ceil((validade - hoje) / (1000 * 60 * 60 * 24));
  if (diasRestantes < 0) return 'expirado';
  if (diasRestantes <= 30) return 'urgente';
  if (diasRestantes <= 90) return 'aviso';
  return 'ok';
};

/**
 * Retorna os dias restantes até à validade.
 * @param {string|null} dataValidade
 * @returns {number|null}
 */
export const getDiasRestantes = (dataValidade) => {
  if (!dataValidade) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const validade = new Date(dataValidade);
  return Math.ceil((validade - hoje) / (1000 * 60 * 60 * 24));
};
