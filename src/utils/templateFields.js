import Handlebars from 'handlebars';
import { EPI_CATALOGO } from '../data/epiCatalogo';
import { getEpiItemsForProfissao } from '../data/epiPerfis';

export const TEMPLATE_FIELDS = [
  { tag: '{worker_name}', label: 'Nome do Trabalhador', source: 'workers.name' },
  { tag: '{worker_email}', label: 'Email do Trabalhador', source: 'workers.email' },
  { tag: '{worker_phone}', label: 'Telemóvel', source: 'workers.tel' },
  { tag: '{worker_nif}', label: 'NIF', source: 'workers.nif' },
  { tag: '{worker_address}', label: 'Morada', source: 'workers.address' },
  { tag: '{worker_postal_code}', label: 'Código Postal', source: 'workers.postalCode' },
  { tag: '{worker_city}', label: 'Cidade', source: 'workers.city' },
  { tag: '{worker_cc_number}', label: 'Nº CC / DNI', source: 'workers.dni' },
  { tag: '{worker_cc_validity}', label: 'Validade CC', source: 'workers.ccValidity' },
  { tag: '{worker_niss}', label: 'NISS', source: 'workers.nis' },
  { tag: '{worker_nacionality}', label: 'Nacionalidade', source: 'workers.nacionality' },
  { tag: '{worker_birth_date}', label: 'Data de Nascimento', source: 'workers.birthDate' },
  { tag: '{worker_birth_place}', label: 'Local de Nascimento', source: 'workers.birthPlace' },
  { tag: '{worker_start_date}', label: 'Data de Início', source: 'workers.dataInicio' },
  { tag: '{worker_role}', label: 'Função/Cargo', source: 'workers.profissao' },
  { tag: '{worker_valor_hora}', label: 'Valor/Hora', source: 'workers.valorHora' },
  { tag: '{worker_iban}', label: 'IBAN', source: 'workers.iban' },
  { tag: '{worker_emergency_contact}', label: 'Contacto de Emergência', source: 'workers.emergencyContact' },
  { tag: '{worker_emergency_phone}', label: 'Tel. Emergência', source: 'workers.emergencyPhone' },
  { tag: '{client_name}', label: 'Nome do Cliente', source: 'clients.name' },
  { tag: '{client_nif}', label: 'NIF do Cliente', source: 'clients.nif' },
  { tag: '{client_address}', label: 'Morada do Cliente', source: 'clients.morada' },
  { tag: '{client_email}', label: 'Email do Cliente', source: 'clients.email' },
  { tag: '{client_valor_hora}', label: 'Valor/Hora Cliente', source: 'clients.valorHora' },
  { tag: '{current_date}', label: 'Data Atual', source: 'system' },
  { tag: '{current_datetime}', label: 'Data/Hora Atual', source: 'system' },
  { tag: '{company_name}', label: 'Nome da Empresa', source: 'system' },
  { tag: '{company_address}', label: 'Morada da Empresa', source: 'system' },
  { tag: '{company_nif}', label: 'NIF da Empresa', source: 'system' },
];

export const SYSTEM_FIELDS = TEMPLATE_FIELDS.filter(f => f.source === 'system');

const MONTHS_PT = [
  'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO',
];
function formatDateLongPT(d = new Date()) {
  return `${d.getDate()} DE ${MONTHS_PT[d.getMonth()]} DE ${d.getFullYear()}`;
}
function formatDateShortPT(value) {
  if (!value || typeof value !== 'string') return value || '';
  const datePart = value.split('T')[0];
  const match = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

export function replaceTemplateFields(html, workerData, systemData = {}, clientData = null) {
  const data = {};
  TEMPLATE_FIELDS.forEach(field => {
    const key = field.tag.slice(1, -1); // '{worker_name}' -> 'worker_name'
    data[key] = getFieldValue(field.tag, workerData, systemData, clientData);
  });
  // Só a checklist de EPI (formato='html') usa {{#each epiItems}} — passar
  // sempre este array, mesmo para os outros templates, é inofensivo (o
  // Handlebars ignora chaves de dados que o template não referencia) e
  // evita ter de detetar "que template é este" antes de resolver campos.
  data.epiItems = getEpiItemsForProfissao(workerData?.profissao, EPI_CATALOGO);

  const template = Handlebars.compile(html, { noEscape: true });
  return template(data);
}

function getFieldValue(tag, workerData, systemData, clientData) {
  const field = TEMPLATE_FIELDS.find(f => f.tag === tag);
  if (!field) return '';

  if (field.source === 'system') {
    switch (tag) {
      case '{current_date}':
        return formatDateLongPT(new Date());
      case '{current_datetime}': {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        return `${formatDateLongPT(now)} ${hh}:${mm}`;
      }
      case '{company_name}':
        return systemData.companyName || 'Magnetic Place';
      case '{company_address}':
        return systemData.companyAddress || '';
      case '{company_nif}':
        return systemData.companyNif || '';
      default:
        return '';
    }
  }

  if (field.source.startsWith('clients.')) {
    const sourceField = field.source.replace('clients.', '');
    return clientData?.[sourceField] != null ? String(clientData[sourceField]) : '';
  }

  const DATE_FIELDS = ['birthDate', 'ccValidity', 'dataInicio'];
  const sourceField = field.source.replace('workers.', '');
  const direct = workerData?.[sourceField];
  if (direct != null && direct !== '') {
    return DATE_FIELDS.includes(sourceField) ? formatDateShortPT(direct) : String(direct);
  }
  // Fallback: tag {worker_cc_number} → workers.dni, mas se algum worker antigo
  // tiver ccNumber preenchido, usar esse valor.
  if (sourceField === 'dni' && workerData?.ccNumber) return String(workerData.ccNumber);
  return '';
}

export function getWorkerFieldValue(worker, tag) {
  return getFieldValue(tag, worker, {}, null);
}

export function getClientFieldValue(client, tag) {
  return getFieldValue(tag, null, {}, client);
}
