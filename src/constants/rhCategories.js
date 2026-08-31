import { FileText, Coins, ShieldCheck, Heart, GraduationCap, Clock, FolderOpen } from 'lucide-react';

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

// Sentinela do filtro "Sem categoria / a rever" — agrupa tanto documentos
// sem categoria (null) como os com um valor de categoria que já não existe
// na lista oficial (ex.: "Segurança Social", resíduo de antes da categoria
// ter passado a "Segurança Social e Fiscal"). Sem isto esses documentos
// ficam invisíveis em qualquer item da rail, só aparecendo em "Todas".
export const SEM_CATEGORIA = '__sem_categoria__';

export const isUncategorized = (categoria) =>
  !categoria || !CATEGORIAS_RH_ACT.includes(categoria);

export const MAPA_SCANNER_ACT = {
  "Identificação e Legalização":  "Identificação e Legalização",
  "Fiscal e Segurança Social":    "Segurança Social e Fiscal",
  "Saúde e Segurança no Trabalho":"Saúde e Segurança no Trabalho",
  "Contratual e Habilitações":    "Contratual",
  "Remuneração":                  "Remuneração",
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

/**
 * Retorna um rótulo de tempo relativo até à expiração (ex.: "expira em 12 dias",
 * "expira em 1 ano e 4 meses", "expirado há 3 dias") e a cor associada à urgência.
 * @param {string|null} dataValidade
 * @returns {{label: string, colorClass: string}|null}
 */
export const getExpiryRelativeLabel = (dataValidade) => {
  const status = getValidadeStatus(dataValidade);
  if (!status) return null;
  const dias = getDiasRestantes(dataValidade);
  const colorClass = status === 'expirado' ? 'text-red-600' : status === 'ok' ? 'text-emerald-600' : 'text-orange-600';

  if (dias < 0) {
    const diasPassados = Math.abs(dias);
    return { label: `expirado há ${diasPassados} dia${diasPassados !== 1 ? 's' : ''}`, colorClass };
  }
  if (dias <= 45) {
    return { label: `expira em ${dias} dia${dias !== 1 ? 's' : ''}`, colorClass };
  }
  const anos = Math.floor(dias / 365);
  const mesesResto = Math.round((dias % 365) / 30);
  const anosFinal = mesesResto === 12 ? anos + 1 : anos;
  const mesesFinal = mesesResto === 12 ? 0 : mesesResto;
  const parts = [];
  if (anosFinal > 0) parts.push(`${anosFinal} ano${anosFinal !== 1 ? 's' : ''}`);
  if (mesesFinal > 0) parts.push(`${mesesFinal} ${mesesFinal !== 1 ? 'meses' : 'mês'}`);
  if (parts.length === 0) {
    const mesesTotais = Math.round(dias / 30);
    parts.push(`${mesesTotais} ${mesesTotais !== 1 ? 'meses' : 'mês'}`);
  }
  return { label: `expira em ${parts.join(' e ')}`, colorClass };
};

// Configuração visual (ícone + cor) de cada categoria ACT — fonte única partilhada
// entre a vista Pastas e a vista Lista de documentos.
export const CATEGORIA_CONFIG = {
  "Contratual":                    { icon: FileText,       color: 'amberCustom' },
  "Remuneração":                   { icon: Coins,          color: 'emerald' },
  "Identificação e Legalização":   { icon: ShieldCheck,    color: 'sky' },
  "Saúde e Segurança no Trabalho": { icon: Heart,          color: 'rose' },
  "Segurança Social e Fiscal":     { icon: ShieldCheck,    color: 'teal' },
  "Formação Profissional":         { icon: GraduationCap,  color: 'amber' },
  "Tempo de Trabalho":             { icon: Clock,          color: 'orange' },
  "Outros":                        { icon: FolderOpen,     color: 'slate' },
};

export const CATEGORIA_COLOR_MAP = {
  indigo:  { bg: 'bg-indigo-50',  text: 'text-indigo-600',  border: 'border-indigo-100' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100' },
  sky:     { bg: 'bg-sky-50',     text: 'text-sky-600',     border: 'border-sky-100' },
  rose:    { bg: 'bg-rose-50',    text: 'text-rose-600',    border: 'border-rose-100' },
  violet:  { bg: 'bg-violet-50',  text: 'text-violet-600',  border: 'border-violet-100' },
  teal:    { bg: 'bg-teal-50',    text: 'text-teal-600',    border: 'border-teal-100' },
  amber:   { bg: 'bg-amber-50',   text: 'text-amber-600',   border: 'border-amber-100' },
  amberCustom: { bg: 'bg-[rgba(235,141,0,0.15)]', text: 'text-[#854F0B]', border: 'border-[rgba(235,141,0,0.35)]' },
  orange:  { bg: 'bg-orange-50',  text: 'text-orange-600',  border: 'border-orange-100' },
  slate:   { bg: 'bg-slate-100',  text: 'text-slate-500',   border: 'border-slate-200' },
};
