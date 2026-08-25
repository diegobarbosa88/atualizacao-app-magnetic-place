// Códigos oficiais PSI de motivo-contrato — diferem entre termo certo e
// termo incerto. Fonte: especificação PSI "Comunicar vínculo do
// trabalhador com indicação do enquadramento" (Instituto de Informática /
// MTSSS), secção 2.1.2.1.1.2. Ficheiro partilhado entre o frontend
// (SSComunicacaoModal.jsx) e o backend (api/seguranca-social/_soapUtils.js)
// para não duplicar/divergir a lista.
export const MOTIVOS_CONTRATO_CERTO = [
  { value: 'AEAT', label: 'AEAT — Acréscimo excecional de atividade' },
  { value: 'ATSA', label: 'ATSA — Atividade sazonal' },
  { value: 'CTSD', label: 'CTSD — Contratação trabalhador em situação de desemprego de muito longa duração' },
  { value: 'EOPA', label: 'EOPA — Execução de obra, projeto ou atividade definida e temporária' },
  { value: 'ESTA', label: 'ESTA — Outro motivo — Estágio' },
  { value: 'EXTO', label: 'EXTO — Execução de tarefa ocasional' },
  { value: 'IFEE', label: 'IFEE — Início de funcionamento de empresa/estabelecimento (<250 trabalhadores, 2 anos)' },
  { value: 'LNAT', label: 'LNAT — Lançamento de nova atividade de duração incerta (<250 trabalhadores, 2 anos)' },
  { value: 'NIMO', label: 'NIMO — Necessidade intermitente de mão-de-obra por flutuação de atividade' },
  { value: 'NIPA', label: 'NIPA — Necessidade intermitente de apoio familiar direto, natureza social' },
  { value: 'RAPT', label: 'RAPT — Realização de projeto temporário, instalação, reestruturação ou reparação industrial' },
  { value: 'STAJ', label: 'STAJ — Substituição de trabalhador com ação judicial de despedimento' },
  { value: 'STAT', label: 'STAT — Substituição de trabalhador ausente ou temporariamente impedido' },
  { value: 'STLR', label: 'STLR — Substituição de trabalhador com licença sem retribuição' },
  { value: 'STPS', label: 'STPS — Substituição de trabalhador abrangido por outro sistema de proteção social' },
  { value: 'STTC', label: 'STTC — Substituição trabalhador tempo completo por tempo parcial, período determinado' },
  { value: 'STTT', label: 'STTT — Substituição de trabalhador temporário' },
  { value: 'S2MT', label: 'S2MT — Substituição de dois ou mais trabalhadores' },
  { value: 'VAPT', label: 'VAPT — Vacatura de posto de trabalho com processo de recrutamento em curso' },
  // Encontrado só na spec de Alterar Contrato (Agosto 2026) — ausente da spec
  // original de Admissão que gerou esta lista. Mesmo domínio de negócio
  // (motivo de contrato a termo certo), por isso adicionado aqui em vez de
  // criar uma lista paralela só para Alterar Contrato.
  { value: 'RVEL', label: 'RVEL — Outro motivo — Conversão em contrato a termo após reforma por velhice ou idade de 70 anos' },
];

export const MOTIVOS_CONTRATO_INCERTO = [
  { value: 'AEAT', label: 'AEAT — Acréscimo excecional de atividade' },
  { value: 'ATSA', label: 'ATSA — Atividade sazonal' },
  { value: 'EOPA', label: 'EOPA — Execução de obra, projeto ou atividade definida e temporária' },
  { value: 'EXTO', label: 'EXTO — Execução de tarefa ocasional' },
  { value: 'NIMO', label: 'NIMO — Necessidade intermitente de mão-de-obra por flutuação de atividade' },
  { value: 'NIPA', label: 'NIPA — Necessidade intermitente de apoio familiar direto, natureza social' },
  { value: 'OMAP', label: 'OMAP — Outro motivo — Designação/Nomeação na Administração Pública' },
  { value: 'OMCS', label: 'OMCS — Outro motivo — Comissão de serviço' },
  { value: 'OMEL', label: 'OMEL — Outro motivo — Eleitos locais' },
  { value: 'OSIN', label: 'OSIN — Outro motivo — Dirigentes/Delegados de Sindicatos/Associações Sindicais' },
  { value: 'RAPT', label: 'RAPT — Realização de projeto temporário, instalação, reestruturação ou reparação industrial' },
  { value: 'STAJ', label: 'STAJ — Substituição de trabalhador com ação judicial de despedimento' },
  { value: 'STAT', label: 'STAT — Substituição de trabalhador ausente ou temporariamente impedido' },
  { value: 'STLR', label: 'STLR — Substituição de trabalhador com licença sem retribuição' },
  { value: 'STPS', label: 'STPS — Substituição de trabalhador abrangido por outro sistema de proteção social' },
  { value: 'STTT', label: 'STTT — Substituição de trabalhador temporário' },
  { value: 'S2MT', label: 'S2MT — Substituição de dois ou mais trabalhadores' },
  { value: 'VAPT', label: 'VAPT — Vacatura de posto de trabalho com processo de recrutamento em curso' },
];

// Modalidades PSI (ver MODALIDADE_CONTRATO em SSComunicacaoModal.jsx) que
// exigem motivo-contrato: termo certo (exceto "I", muito curta duração) e
// termo incerto.
export const MODALIDADES_COM_MOTIVO_OBRIGATORIO = new Set([
  'E', 'EA', 'EB', 'O', 'F', 'FA', 'FB', 'N',
  'G', 'GA', 'GB', 'Q', 'H', 'HA', 'HB', 'P',
]);

export const MODALIDADES_TERMO_INCERTO = new Set(['G', 'GA', 'GB', 'Q', 'H', 'HA', 'HB', 'P']);

// Motivos que exigem niss-trabalhador-substituir (o trabalhador concreto
// que está a ser substituído).
export const MOTIVOS_EXIGEM_SUBSTITUIDO = new Set(['STAJ', 'STAT', 'STLR', 'STTC']);
