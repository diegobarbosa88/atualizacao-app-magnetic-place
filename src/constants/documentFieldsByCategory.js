import { formatDocDate } from '../utils/dateUtils';

const MESES_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const fmtDate = (value) => {
  if (!value) return null;
  const iso = value instanceof Date ? value.toISOString() : value;
  return formatDocDate(iso, false);
};

const getFileExt = (url) => {
  if (!url) return null;
  const clean = url.split('?')[0];
  const ext = clean.split('.').pop();
  return ext && ext.length <= 5 ? ext.toUpperCase() : null;
};

const row = (label, value) => ({ label, value: value || null });

/**
 * Devolve os campos do painel "Informação do Documento" específicos da categoria ACT do documento.
 * Campos não capturados pela extração automática são devolvidos com value=null,
 * para serem apresentados como "Não disponível" em vez de omitidos ou inventados.
 * @param {object} d - documento unificado (categoria, tipo, data_validade, createdAt, signedAtWorker, dados_extraidos, viewUrl, signedPdfUrl)
 * @returns {{label: string, value: string|null}[]}
 */
export function getCategoryFields(d) {
  const ex = d?.dados_extraidos || {};
  const doc = ex.documento || {};
  const trab = ex.trabalhador || {};
  const emissao = doc.data_emissao || (d?.createdAt ? d.createdAt.toISOString() : null);

  switch (d?.categoria) {
    case 'Remuneração': {
      const periodo = d?.createdAt ? `${MESES_PT[d.createdAt.getMonth()]} ${d.createdAt.getFullYear()}` : null;
      return [
        row('Período de referência', periodo),
        row('Valor bruto', null),
        row('Valor líquido', null),
        row('Data de emissão', fmtDate(emissao)),
        row('Data de assinatura', fmtDate(d?.signedAtWorker)),
      ];
    }
    case 'Identificação e Legalização': {
      return [
        row('Nº do documento', doc.numero_documento),
        row('Data de nascimento', fmtDate(trab.data_nascimento)),
        row('Data de emissão', fmtDate(emissao)),
        row('Válido até', fmtDate(d?.data_validade)),
      ];
    }
    case 'Contratual': {
      return [
        row('Tipo de contrato', null),
        row('Data de início', null),
        row('Data de fim', null),
        row('Data de assinatura', fmtDate(d?.signedAtWorker)),
      ];
    }
    case 'Saúde e Segurança no Trabalho': {
      return [
        row('Tipo de exame/certificado', d?.tipo),
        row('Data de realização', fmtDate(emissao)),
        row('Válido até', fmtDate(d?.data_validade)),
      ];
    }
    case 'Segurança Social e Fiscal': {
      return [
        row('Tipo de documento', d?.tipo),
        row('Período/ano fiscal', null),
        row('Data de emissão', fmtDate(emissao)),
      ];
    }
    case 'Formação Profissional': {
      return [
        row('Curso/certificação', d?.tipo),
        row('Entidade formadora', null),
        row('Data de conclusão', fmtDate(emissao)),
        row('Validade', fmtDate(d?.data_validade)),
      ];
    }
    case 'Tempo de Trabalho': {
      return [
        row('Período abrangido', null),
        row('Total de horas registadas', null),
      ];
    }
    default: {
      return [
        row('Data de upload', fmtDate(emissao)),
        row('Tipo de ficheiro', getFileExt(d?.viewUrl || d?.signedPdfUrl)),
      ];
    }
  }
}
