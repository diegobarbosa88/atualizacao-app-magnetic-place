export const TEMPLATE_FIELDS = [
  { tag: '{{worker_name}}', label: 'Nome do Trabalhador', source: 'workers.name' },
  { tag: '{{worker_email}}', label: 'Email do Trabalhador', source: 'workers.email' },
  { tag: '{{worker_phone}}', label: 'Telemóvel', source: 'workers.tel' },
  { tag: '{{worker_nif}}', label: 'NIF', source: 'workers.nif' },
  { tag: '{{worker_address}}', label: 'Morada', source: 'workers.address' },
  { tag: '{{worker_postal_code}}', label: 'Código Postal', source: 'workers.postalCode' },
  { tag: '{{worker_city}}', label: 'Cidade', source: 'workers.city' },
  { tag: '{{worker_cc_number}}', label: 'Nº CC', source: 'workers.ccNumber' },
  { tag: '{{worker_cc_validity}}', label: 'Validade CC', source: 'workers.ccValidity' },
  { tag: '{{worker_niss}}', label: 'NISS', source: 'workers.nis' },
  { tag: '{{worker_nacionality}}', label: 'Nacionalidade', source: 'workers.nacionality' },
  { tag: '{{worker_birth_date}}', label: 'Data de Nascimento', source: 'workers.birthDate' },
  { tag: '{{worker_birth_place}}', label: 'Local de Nascimento', source: 'workers.birthPlace' },
  { tag: '{{worker_start_date}}', label: 'Data de Início', source: 'workers.dataInicio' },
  { tag: '{{worker_role}}', label: 'Função/Cargo', source: 'workers.profissao' },
  { tag: '{{worker_valor_hora}}', label: 'Valor/Hora', source: 'workers.valorHora' },
  { tag: '{{worker_iban}}', label: 'IBAN', source: 'workers.iban' },
  { tag: '{{worker_emergency_contact}}', label: 'Contacto de Emergência', source: 'workers.emergencyContact' },
  { tag: '{{worker_emergency_phone}}', label: 'Tel. Emergência', source: 'workers.emergencyPhone' },
  { tag: '{{client_name}}', label: 'Nome do Cliente', source: 'clients.name' },
  { tag: '{{client_nif}}', label: 'NIF do Cliente', source: 'clients.nif' },
  { tag: '{{client_address}}', label: 'Morada do Cliente', source: 'clients.morada' },
  { tag: '{{client_email}}', label: 'Email do Cliente', source: 'clients.email' },
  { tag: '{{client_valor_hora}}', label: 'Valor/Hora Cliente', source: 'clients.valorHora' },
  { tag: '{{current_date}}', label: 'Data Atual', source: 'system' },
  { tag: '{{current_datetime}}', label: 'Data/Hora Atual', source: 'system' },
  { tag: '{{company_name}}', label: 'Nome da Empresa', source: 'system' },
  { tag: '{{company_address}}', label: 'Morada da Empresa', source: 'system' },
  { tag: '{{company_nif}}', label: 'NIF da Empresa', source: 'system' },
];

export const SYSTEM_FIELDS = TEMPLATE_FIELDS.filter(f => f.source === 'system');

export function replaceTemplateFields(html, workerData, systemData = {}, clientData = null) {
  let result = html;

  TEMPLATE_FIELDS.forEach(field => {
    const value = getFieldValue(field.tag, workerData, systemData, clientData);
    result = result.split(field.tag).join(value || '');
  });

  return result;
}

function getFieldValue(tag, workerData, systemData, clientData) {
  const field = TEMPLATE_FIELDS.find(f => f.tag === tag);
  if (!field) return '';

  if (field.source === 'system') {
    switch (tag) {
      case '{{current_date}}':
        return new Date().toLocaleDateString('pt-PT');
      case '{{current_datetime}}':
        return new Date().toLocaleString('pt-PT');
      case '{{company_name}}':
        return systemData.companyName || 'Magnetic Place';
      case '{{company_address}}':
        return systemData.companyAddress || '';
      case '{{company_nif}}':
        return systemData.companyNif || '';
      default:
        return '';
    }
  }

  if (field.source.startsWith('clients.')) {
    const sourceField = field.source.replace('clients.', '');
    return clientData?.[sourceField] != null ? String(clientData[sourceField]) : '';
  }

  const sourceField = field.source.replace('workers.', '');
  return workerData?.[sourceField] || '';
}

export function getWorkerFieldValue(worker, tag) {
  return getFieldValue(tag, worker, {}, null);
}

export function getClientFieldValue(client, tag) {
  return getFieldValue(tag, null, {}, client);
}
