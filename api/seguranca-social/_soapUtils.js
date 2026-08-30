// Utilitários para comunicação com a PSI (Plataforma de Serviços de Interoperabilidade)
// da Segurança Social Portuguesa.
//
// Admissão:  REST/JSON  POST .../ptss/rest/qlf/tco/vinculos/pedido  (QLF-O1051)
// Cessação:  SOAP       POST .../ws/contrato/v1/cessarVinculoTrabalhador
//
// Autenticação: HTTP Basic Auth (NISS empresa : password de login da SSD)
//
// Ambientes (conforme especificações técnicas PSI oficiais, Agosto 2026):
//   Qualidade REST:  extwww.seg-social.pt
//   Qualidade SOAP:  extservices.seg-social.pt
//   Produção (ambos): app.seg-social.pt

import { MODALIDADES_COM_MOTIVO_OBRIGATORIO, MOTIVOS_EXIGEM_SUBSTITUIDO } from '../../src/data/motivosContratoSS.js';

const isProd = () => process.env.SS_AMBIENTE === 'producao';

// Serviços de comunicação (escrita) — admissão REST e cessação SOAP
const REST_URL  = () => isProd()
  ? 'https://app.seg-social.pt/ptss/rest/qlf/tco/vinculos/pedido'
  : 'https://extwww.seg-social.pt/ptss/rest/qlf/tco/vinculos/pedido';

const SOAP_BASE = () => isProd()
  ? 'https://app.seg-social.pt/ws/contrato/v1'
  : 'https://extservices.seg-social.pt/ws/contrato/v1';

// Transferir Local de Trabalho — REST/JSON PUT, mesma família QLF da
// admissão (204 = sucesso sem corpo, erro em {code, message}).
const LOCAIS_TRABALHO_URL = () => isProd()
  ? 'https://app.seg-social.pt/ptss/rest/qlf/tco/locais-trabalho/trabalhador'
  : 'https://extwww.seg-social.pt/ptss/rest/qlf/tco/locais-trabalho/trabalhador';

// Serviços de consulta CI (informação contributiva — só leitura, testáveis em produção)
const CI_BASE   = () => isProd()
  ? 'https://app.seg-social.pt/ptss/rest/ci'
  : 'https://extwww.seg-social.pt/ptss/rest/ci';

// Situação Contributiva — REST/JSON POST síncrono, path próprio (não é filho de CI_BASE)
const SITUACAO_CONTRIBUTIVA_URL = () => isProd()
  ? 'https://app.seg-social.pt/ptss/rest/ascd/declaracao/situacao-contributiva'
  : 'https://extwww.seg-social.pt/ptss/rest/ascd/declaracao/situacao-contributiva';

// Avisos (EEAOC) — REST/JSON GET síncrono. A sigla nunca é definida no PDF
// original — não inventar o significado, tratar só como "Avisos" na UI.
// Path irmão de CI (/ptss/rest/eeaoc/...), não descende de CI_BASE().
const EEAOC_BASE = () => isProd()
  ? 'https://app.seg-social.pt/ptss/rest/eeaoc'
  : 'https://extwww.seg-social.pt/ptss/rest/eeaoc';

// Contratos — SOAP, dois passos (pesquisaContratos + getDadosContratos), mesmo
// endpoint para as duas operações. O PDF só confirma este endereço
// explicitamente para pesquisaContratos; para getDadosContratos indica um
// endereço preapp.seg-social.pt que não bate com o padrão do resto do
// projeto — é quase de certeza resíduo do ambiente interno do fornecedor.
// Usa-se o mesmo endereço para as duas operações; confirmar contra o
// ambiente de Qualidade real antes de dar como certo.
const CONTRATOS_URL = () => isProd()
  ? 'https://app.seg-social.pt/ws/contrato/v1/contratos'
  : 'https://extservices.seg-social.pt/ws/contrato/v1/contratos';

// Trabalhadores (qualificações vinculadas) — SOAP, dois passos
// (getQualificacoesTrabalhadoresVinculadosEE + getDados). Namespace e host
// diferentes de todos os outros serviços SOAP do projeto — ver comentário
// junto de buildPesquisaTrabalhadoresSoap sobre a incerteza de WS-Addressing.
const TRABALHADORES_SS_URL = () => isProd()
  ? 'https://app.seg-social.pt/ws/idq/WsIdqQualificacoesTrabalhadoresVinculadosEE_Request'
  : 'https://extservices.seg-social.pt/ws/idq/WsIdqQualificacoesTrabalhadoresVinculadosEE_Request';

// ── Consulta CI — GET genérico ───────────────────────────────────────────────

/**
 * Faz GET para uma URL completa da PSI CI (comprovativos, documentos de pagamento).
 * Devolve { httpStatus, ok, json?, semRegistos? } ou lança erro em falha de rede.
 */
export async function callSSRestGetUrl(url) {
  const token = getBearerToken();
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
  });

  if (res.status === 404) return { httpStatus: 404, ok: true, semRegistos: true, json: null };

  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* deixar null */ }

  // Lê o corpo antes de decidir 401/403 — a spec da PSI documenta mensagens
  // específicas para "Operação não permitida" (ex. NISS sem autorização para
  // um serviço em concreto), que se perdiam ao lançar o erro genérico antes
  // de ler a resposta.
  if (res.status === 401) throw new Error(json?.message || 'Token PSI inválido ou expirado (HTTP 401).');
  if (res.status === 403) throw new Error(json?.message || `Acesso negado pela Segurança Social (HTTP 403) — o NISS/token pode não estar autorizado para este serviço específico. Contacte suporte-psi@seg-social.pt indicando NISS e endpoint se persistir.`);

  if (res.ok) return { httpStatus: res.status, ok: true, json };

  // codigoResultado "4" = sem resultados em pelo menos dois serviços
  // confirmados (comprovativos, documentos de pagamento) — mas o HTTP que o
  // envolve varia (confirmado ao vivo em produção: comprovativos devolveu
  // HTTP 400, não 404 como os exemplos da spec sugeriam). Não é erro, é
  // "não há dados", mesmo critério já usado em callSSRestPostUrl.
  const cod = json?.codigoResultado;
  if (cod === 4 || cod === '4') return { httpStatus: res.status, ok: true, semRegistos: true, json };

  // Nem todos os serviços REST da PSI devolvem {message}/{erro}/{descricao} —
  // vários (ex. comprovativos, documentos de pagamento) só devolvem
  // {"codigoResultado": "N"}, sem texto nenhum. Sem isto, um erro real ficava
  // reduzido a "HTTP 400" sem pista nenhuma do que a SS quis dizer.
  const erro = json?.message || json?.erro || json?.descricao
    || (json?.codigoResultado != null ? `Código de resultado da Segurança Social: "${json.codigoResultado}" (HTTP ${res.status})` : null)
    || (text ? `HTTP ${res.status}: ${text.slice(0, 300)}` : `HTTP ${res.status}`);
  return { httpStatus: res.status, ok: false, erro, json };
}

/**
 * Faz POST (body JSON) para uma URL completa da PSI QLF (remunerações permanentes).
 */
export async function callSSRestPostUrl(url, body) {
  const token = getBearerToken();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type':  'application/json',
      'Accept':        'application/json',
    },
    body: JSON.stringify(body),
  });

  if (res.status === 401) throw new Error('Token PSI inválido ou expirado (HTTP 401).');
  if (res.status === 403) throw new Error('Acesso negado pela Segurança Social (HTTP 403).');
  if (res.status === 404) return { httpStatus: 404, ok: true, semRegistos: true, json: null };

  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* deixar null */ }

  // codigoResultado=4 → sem resultados (não é erro)
  const cod = json?.codigoResultado ?? json?.['codigo-resultado'];
  if (cod === 4 || cod === '4') return { httpStatus: res.status, ok: true, semRegistos: true, json };

  if (res.ok) return { httpStatus: res.status, ok: true, json };

  const erro = json?.message || json?.erro || json?.descricao || `HTTP ${res.status}`;
  return { httpStatus: res.status, ok: false, erro, json };
}

/**
 * Faz PUT (sem body) para uma URL completa da PSI CI — usado só pelo
 * cancelamento de documento de pagamento, onde o identificador vai no path
 * da URL, não no corpo do pedido (confirmado no OpenAPI oficial).
 */
export async function callSSRestPutUrl(url, body) {
  const token = getBearerToken();
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (res.status === 401) throw new Error('Token PSI inválido ou expirado (HTTP 401).');
  if (res.status === 403) throw new Error('Acesso negado pela Segurança Social (HTTP 403).');

  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* deixar null */ }

  // Sem interpretação de sucesso/erro aqui — o mesmo codigoResultado "17"
  // significa coisas diferentes consoante o HTTP status (ver caller em
  // index.js), por isso devolve-se o par bruto e quem chama decide.
  return { httpStatus: res.status, ok: res.ok, json };
}

export { CI_BASE, SITUACAO_CONTRIBUTIVA_URL, EEAOC_BASE, CONTRATOS_URL, TRABALHADORES_SS_URL, LOCAIS_TRABALHO_URL };

// ── Mapeamentos ──────────────────────────────────────────────────────────────

// tipo_contrato (UI) + regime (UI) → código PSI modalidade-contrato
const MODALIDADE_MAP = {
  'sem_termo+tempo_inteiro':           'A',
  'sem_termo+tempo_parcial':           'B',
  'termo_certo+tempo_inteiro':         'E',
  'termo_certo+tempo_parcial':         'F',
  'termo_incerto+tempo_inteiro':       'G',
  'termo_incerto+tempo_parcial':       'H',
  'muito_curta_duracao+tempo_inteiro': 'I',
  'muito_curta_duracao+tempo_parcial': 'I',
};

// modo_trabalho (UI) → código PSI prestacao-trabalho (P/T/A)
const PRESTACAO_MAP = {
  'presencial': 'P',  // Presencial
  'remoto':     'T',  // Teletrabalho total
  'hibrido':    'A',  // Teletrabalho parcial (alternado)
};

// Modalidades a termo CERTO — data de fim é conhecida e obrigatória.
const MODALIDADES_TERMO_CERTO = new Set(['E','EA','EB','O','F','FA','FB','N','I']);

// Modalidades a termo INCERTO — por definição não têm data de fim
// conhecida (o contrato cessa com a verificação de um evento, não numa
// data calendário); não enviar fim-contrato para estas, ou a PSI rejeita
// com "DATA FIM CONTRATO COM FORMATO INVÁLIDO" ao receber string vazia.
const MODALIDADES_TERMO_INCERTO = new Set(['G','GA','GB','Q','H','HA','HB','P']);

// Modalidades tempo parcial que exigem percentagem-trabalho, horas-trabalho, dias-trabalho
const MODALIDADES_PARCIAL = new Set(['B','D','BA','BB','R','F','FA','FB','N','H','HA','HB','P']);

// ── Utilitários internos ─────────────────────────────────────────────────────

function escapeXml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Formata para YYYY-MM-DD (formato exigido pela PSI em ambos os serviços)
function fmtDate(val) {
  if (!val) return '';
  return String(val).split('T')[0];
}

// Formata para YYYY-MM-DDTHH:MM:SSZ (datetime ISO, exigido pelo serviço de
// Trabalhadores/qualificações — usa meia-noite ou fim-do-dia consoante o papel).
function fmtDateTime(val, endOfDay = false) {
  if (!val) return '';
  const datePart = String(val).split('T')[0];
  return endOfDay ? `${datePart}T23:59:59Z` : `${datePart}T00:00:00Z`;
}

function getBearerToken() {
  const token = process.env.SS_PSI_TOKEN;
  if (!token) {
    throw new Error('Token PSI não configurado. Defina SS_PSI_TOKEN nas variáveis de ambiente (Segurança Social Direta → Gestão de autenticação → Tokens de acesso).');
  }
  return token;
}

// ── Admissão — REST/JSON (QLF-O1051) ────────────────────────────────────────

/**
 * Constrói o body JSON para POST /ptss/rest/qlf/tco/vinculos/pedido.
 * Datas: formato YYYY-MM-DD (spec PSI, não datetime apesar da anotação OpenAPI).
 */
export function buildAdmissaoRest(dados) {
  const {
    nissEmpresa,
    nisTrabalhador,
    dataNascimento,
    tipoContrato,
    regime,
    modalidadeContrato,   // override; se vazio calcula de tipoContrato+regime
    modoTrabalho,
    prestacaoTrabalho,    // override; se vazio calcula de modoTrabalho
    dataInicioContrato,
    profissaoCnp,         // código CPP a 5 dígitos sem ponto (ex: "93130")
    remuneracaoBase,
    enquadramento,
    localTrabalho,
    // opcionais/condicionais
    dataFimContrato,
    horasTrabalho,
    diasTrabalho,
    percentagemTrabalho,
    motivoContrato,
    nissTrabalhadorSubstituir,
  } = dados;

  const modalidade = modalidadeContrato
    || MODALIDADE_MAP[`${tipoContrato}+${regime}`]
    || 'A';

  const prestacao = prestacaoTrabalho
    || PRESTACAO_MAP[modoTrabalho]
    || 'P';

  const cnp = String(profissaoCnp || '').replace(/\D/g, '').substring(0, 5);

  const body = {
    'niss-entidade-empregadora': Number(nissEmpresa),
    'niss-trabalhador':          Number(nisTrabalhador),
    'data-nascimento':           fmtDate(dataNascimento),
    'modalidade-contrato':       modalidade,
    'prestacao-trabalho':        prestacao,
    'inicio-contrato':           fmtDate(dataInicioContrato),
    'profissao':                 cnp,
    'remuneracao-base':          parseFloat(remuneracaoBase) || 0,
    'enquadramento':             enquadramento || 'REGE',
    'local-trabalho':            parseInt(localTrabalho, 10) || 1,
  };

  // fim-contrato só é enviado quando há mesmo uma data conhecida — nos
  // termos incertos (G/H/Q/P) fica de fora mesmo que a modalidade seja "a
  // termo", precisamente porque a data de fim não é conhecida.
  if (dataFimContrato) {
    body['fim-contrato'] = fmtDate(dataFimContrato);
  } else if (MODALIDADES_TERMO_CERTO.has(modalidade)) {
    throw new Error(`Contrato modalidade "${modalidade}" é a termo certo e exige uma data de fim de contrato — nenhuma foi fornecida.`);
  }

  // campos tempo parcial
  if (percentagemTrabalho || MODALIDADES_PARCIAL.has(modalidade)) {
    if (percentagemTrabalho) body['percentagem-trabalho'] = parseFloat(percentagemTrabalho);
    if (horasTrabalho)       body['horas-trabalho']       = parseFloat(horasTrabalho);
    if (diasTrabalho)        body['dias-trabalho']        = parseFloat(diasTrabalho);
  }

  // motivo-contrato obrigatório para as modalidades a termo (certo e
  // incerto) — exceto "I" (muito curta duração), que não consta da lista
  // da PSI que exige este campo.
  if (MODALIDADES_COM_MOTIVO_OBRIGATORIO.has(modalidade)) {
    if (!motivoContrato) {
      throw new Error(`Contrato modalidade "${modalidade}" exige um motivo de contrato — nenhum foi indicado.`);
    }
    body['motivo-contrato'] = motivoContrato;
  } else if (motivoContrato) {
    body['motivo-contrato'] = motivoContrato;
  }

  if (nissTrabalhadorSubstituir) body['niss-trabalhador-substituir'] = Number(nissTrabalhadorSubstituir);

  return body;
}

export async function callSSRest(jsonBody) {
  const token = getBearerToken();

  const res = await fetch(REST_URL(), {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(jsonBody),
  });

  if (res.status === 401) throw new Error('Token PSI inválido ou expirado (HTTP 401). Verifique se o token SS_PSI_TOKEN ainda é válido na SSD → Gestão de autenticação → Tokens de acesso.');
  if (res.status === 403) throw new Error('Acesso negado pela Segurança Social (HTTP 403). Verifique se aderiu à PSI e se o serviço está autorizado.');

  // 204 = sucesso sem corpo (operação efetuada com sucesso)
  if (res.status === 204) return { httpStatus: 204, sucesso: true, numRegisto: null };

  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = null; }

  if (res.ok) {
    return { httpStatus: res.status, sucesso: true, numRegisto: null, json };
  }

  // Erro: PSI devolve {"code": 400, "message": "..."}
  const erro = json?.message || json?.erro || json?.descricao || `HTTP ${res.status}`;
  return { httpStatus: res.status, sucesso: false, erro, json };
}

// ── Cessação — SOAP ──────────────────────────────────────────────────────────
//
// Campos SOAP (per WSDL oficial cessarVinculoTrabalhador, Agosto 2026):
//   <niss-trabalhador>       — obrigatório (sem o NISS da empresa — auth é no header HTTP)
//   <data-fim-vinculo>       — data YYYY-MM-DD
//   <motivo-fim-vinculo>     — código VARCHAR2(4), ex: CCCT, RAOT, RARC…
//   <comunicacao-desemprego> — NUMBER(1): "1" = Sim / "0" = Não
//   <fundamentacao>          — opcional (obrigatório se motivo ∈ RARC/RARD/RARE/RARR e desemprego=1)
//
// Namespace: xmlns:vo="http://vo.webservice.contrato.segsocial.pt"
// Operação:  <vo:cessarVinculo>  (não cessarVinculoTrabalhadorRequest)

export function buildCessacaoSoap(dados) {
  const { nisTrabalhador, dataCessacao, motivoCessacao, fundamentacao, comunicacaoDesemprego } = dados;

  const desemprego = comunicacaoDesemprego ? '1' : '0';
  const fundamentacaoXml = fundamentacao
    ? `\n      <fundamentacao>${escapeXml(fundamentacao)}</fundamentacao>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope
  xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:vo="http://vo.webservice.contrato.segsocial.pt">
  <soapenv:Header/>
  <soapenv:Body>
    <vo:cessarVinculo>
      <niss-trabalhador>${escapeXml(nisTrabalhador)}</niss-trabalhador>
      <data-fim-vinculo>${fmtDate(dataCessacao)}</data-fim-vinculo>
      <motivo-fim-vinculo>${escapeXml(motivoCessacao)}</motivo-fim-vinculo>
      <comunicacao-desemprego>${desemprego}</comunicacao-desemprego>${fundamentacaoXml}
    </vo:cessarVinculo>
  </soapenv:Body>
</soapenv:Envelope>`;
}

// ── Alterar Contrato — SOAP ──────────────────────────────────────────────────
//
// Campos (WSDL alterarContratoTrabalho, Agosto 2026), 13 no total, ordem livre:
//   niss-trabalhador            — obrigatório, 11 dígitos
//   modalidade-contrato         — obrigatório, mesmos 26 códigos da Admissão + "I"
//   prestacao-trabalho          — opcional no XSD (default "P"), mas enviado
//                                  sempre explicitamente para não depender do
//                                  default do servidor
//   inicio-contrato              — obrigatório
//   fim-contrato                 — obrigatório só para termo certo, SEM "I"
//                                  (ver ALTERAR_TERMO_CERTO — diferente do
//                                  conjunto MODALIDADES_TERMO_CERTO da Admissão)
//   profissao                    — obrigatório, código CPP 5 dígitos
//   remuneracao-base             — obrigatório, >0
//   diuturnidades                — opcional, se preenchido >0
//   percentagem/horas/dias-trabalho — obrigatórios para tempo parcial
//   motivo-contrato               — obrigatório para termo certo e incerto
//   niss-trabalhador-substituir   — obrigatório para motivos STAJ/STAT/STLR/STTC
//
// Namespace: xmlns:vo="http://vo.webservice.contrato.segsocial.pt" (igual ao
// resto dos serviços SOAP de contrato). Operação: <vo:alterarContratoTrabalho>.
// SOAPAction: http://interfaces.webservice.contrato.segsocial.pt#alterarContratoTrabalho.
//
// Não há limiar exato documentado para "contratos de muito curta duração" —
// não replicar essa regra aqui, deixar a própria PSI rejeitar (código 3).

const ALTERAR_TERMO_CERTO = new Set(['E', 'EA', 'EB', 'O', 'F', 'FA', 'FB', 'N']);

export function buildAlterarContratoSoap(dados) {
  const {
    nissTrabalhador,
    modalidadeContrato,
    prestacaoTrabalho,
    dataInicioContrato,
    dataFimContrato,
    profissaoCnp,
    remuneracaoBase,
    diuturnidades,
    percentagemTrabalho,
    horasTrabalho,
    diasTrabalho,
    motivoContrato,
    nissTrabalhadorSubstituir,
  } = dados;

  if (!nissTrabalhador) throw new Error('NISS do trabalhador obrigatório.');
  if (!modalidadeContrato) throw new Error('Modalidade de contrato obrigatória.');
  if (!dataInicioContrato) throw new Error('Data de início do contrato obrigatória.');

  const cnp = String(profissaoCnp || '').replace(/\D/g, '').substring(0, 5);
  if (cnp.length !== 5) throw new Error('Código de profissão (CPP) obrigatório — 5 dígitos.');

  const remun = parseFloat(remuneracaoBase);
  if (!remun || remun <= 0) throw new Error('Remuneração base obrigatória e deve ser superior a 0.');

  const prestacao = prestacaoTrabalho || 'P';

  let camposXml = `
      <niss-trabalhador>${escapeXml(nissTrabalhador)}</niss-trabalhador>
      <modalidade-contrato>${escapeXml(modalidadeContrato)}</modalidade-contrato>
      <prestacao-trabalho>${escapeXml(prestacao)}</prestacao-trabalho>
      <inicio-contrato>${fmtDate(dataInicioContrato)}</inicio-contrato>`;

  if (ALTERAR_TERMO_CERTO.has(modalidadeContrato)) {
    if (!dataFimContrato) throw new Error(`Modalidade "${modalidadeContrato}" é a termo certo e exige uma data de fim de contrato — nenhuma foi fornecida.`);
    camposXml += `\n      <fim-contrato>${fmtDate(dataFimContrato)}</fim-contrato>`;
  }
  // termo incerto/sem termo: fim-contrato fica de fora mesmo que dataFimContrato
  // venha preenchida — enviá-lo dá "DATA FIM CONTRATO COM FORMATO INVÁLIDO".

  camposXml += `\n      <profissao>${cnp}</profissao>
      <remuneracao-base>${remun}</remuneracao-base>`;

  if (diuturnidades) {
    const d = parseFloat(diuturnidades);
    if (d > 0) camposXml += `\n      <diuturnidades>${d}</diuturnidades>`;
  }

  if (MODALIDADES_PARCIAL.has(modalidadeContrato)) {
    if (percentagemTrabalho === undefined || percentagemTrabalho === null || percentagemTrabalho === ''
      || horasTrabalho === undefined || horasTrabalho === null || horasTrabalho === ''
      || diasTrabalho === undefined || diasTrabalho === null || diasTrabalho === '') {
      throw new Error(`Modalidade "${modalidadeContrato}" é a tempo parcial e exige percentagem-trabalho, horas-trabalho e dias-trabalho.`);
    }
    camposXml += `\n      <percentagem-trabalho>${parseFloat(percentagemTrabalho)}</percentagem-trabalho>
      <horas-trabalho>${parseFloat(horasTrabalho)}</horas-trabalho>
      <dias-trabalho>${parseFloat(diasTrabalho)}</dias-trabalho>`;
  }

  if (MODALIDADES_COM_MOTIVO_OBRIGATORIO.has(modalidadeContrato)) {
    if (!motivoContrato) throw new Error(`Modalidade "${modalidadeContrato}" exige um motivo de contrato — nenhum foi indicado.`);
    camposXml += `\n      <motivo-contrato>${escapeXml(motivoContrato)}</motivo-contrato>`;
  } else if (motivoContrato) {
    camposXml += `\n      <motivo-contrato>${escapeXml(motivoContrato)}</motivo-contrato>`;
  }

  if (MOTIVOS_EXIGEM_SUBSTITUIDO.has(motivoContrato)) {
    if (!nissTrabalhadorSubstituir) throw new Error(`Motivo "${motivoContrato}" exige o NISS do trabalhador substituído.`);
    camposXml += `\n      <niss-trabalhador-substituir>${escapeXml(nissTrabalhadorSubstituir)}</niss-trabalhador-substituir>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope
  xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:vo="http://vo.webservice.contrato.segsocial.pt">
  <soapenv:Header/>
  <soapenv:Body>
    <vo:alterarContratoTrabalho>${camposXml}
    </vo:alterarContratoTrabalho>
  </soapenv:Body>
</soapenv:Envelope>`;
}

// Parseia resposta SOAP.
// codigo-resultado: 1=sucesso, 0=erro servidor, 2=falta params, 3=validação falhou, 4=sem resultados
export function parseSoapResponse(xmlStr) {
  if (!xmlStr) return { sucesso: false, mensagemErro: 'Resposta vazia da Segurança Social.' };

  const codigoMatch = xmlStr.match(/<(?:[^:>]+:)?codigo-resultado[^>]*>([^<]+)<\/(?:[^:>]+:)?codigo-resultado>/i)
    || xmlStr.match(/<(?:[^:>]+:)?codigoResultado[^>]*>([^<]+)<\/(?:[^:>]+:)?codigoResultado>/i);
  // <soapenv:Fault><detail><...Exception><mensagens><erro>...</erro></mensagens> —
  // formato visto num timeout real (codigo-resultado 408, "Request Timeout").
  // Mais específico que o <faultstring> genérico ("Erro comunicação servidor
  // ptss"), por isso tentado antes.
  const mensagemMatch = xmlStr.match(/<(?:[^:>]+:)?mensagens-erro[^>]*>([^<]*)<\/(?:[^:>]+:)?mensagens-erro>/i)
    || xmlStr.match(/<(?:[^:>]+:)?mensagensErro[^>]*>([^<]*)<\/(?:[^:>]+:)?mensagensErro>/i)
    || xmlStr.match(/<mensagens>\s*<erro>([^<]*)<\/erro>\s*<\/mensagens>/i)
    || xmlStr.match(/<faultstring[^>]*>([^<]+)<\/faultstring>/i);

  const codigo   = codigoMatch   ? codigoMatch[1].trim()   : null;
  const mensagem = mensagemMatch  ? mensagemMatch[1].trim()  : null;

  // Código 1 = sucesso; código 4 = sem resultados (obterComunicacoes) — ambos OK
  if (codigo === '1' || codigo === '4') return { sucesso: true, numRegisto: null };

  const mensagemErro = (mensagem && mensagem.length > 0)
    ? mensagem
    : (codigo ? `Código de resultado: ${codigo}` : 'Erro desconhecido na Segurança Social.');

  return { sucesso: false, codigoErro: codigo, mensagemErro };
}

// ── Consultar comunicações — SOAP (obterComunicacoes) ───────────────────────
//
// Devolve comunicações de vínculo "a processar" (ainda não confirmadas) ou
// "não aceites" (rejeitadas) — NUNCA as já aceites/processadas com sucesso,
// que não aparecem aqui. Serve para apanhar casos raros em que uma admissão/
// cessação ficou presa ou foi recusada depois do envio síncrono ter parecido
// OK. niss opcional: sem lista, devolve tudo; com lista, filtra por esses NISS.
// WSDL oficial (Agosto 2026): list-niss-trabalhador é minOccurs="0".
export function buildObterComunicacoesSoap(nissList = []) {
  const nissXml = nissList.length
    ? `\n      <list-niss-trabalhador>\n${nissList.map(n => `        <niss-trabalhador>${escapeXml(n)}</niss-trabalhador>`).join('\n')}\n      </list-niss-trabalhador>`
    : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope
  xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:vo="http://vo.webservice.contrato.segsocial.pt">
  <soapenv:Header/>
  <soapenv:Body>
    <vo:obterComunicacoes>${nissXml}
    </vo:obterComunicacoes>
  </soapenv:Body>
</soapenv:Envelope>`;
}

// Extrai a lista de <comunicacao> da resposta de obterComunicacoes.
// tipoComunicacao: 0 = a processar, 1 = não aceite (rejeitada).
export function parseObterComunicacoesResponse(xmlStr) {
  if (!xmlStr) return { sucesso: false, mensagemErro: 'Resposta vazia da Segurança Social.', comunicacoes: [] };

  const codigoMatch = xmlStr.match(/<(?:[^:>]+:)?codigo-resultado[^>]*>([^<]+)<\/(?:[^:>]+:)?codigo-resultado>/i);
  const mensagemMatch = xmlStr.match(/<(?:[^:>]+:)?mensagens-erro[^>]*>([^<]*)<\/(?:[^:>]+:)?mensagens-erro>/i);
  const codigo = codigoMatch ? codigoMatch[1].trim() : null;
  const mensagem = mensagemMatch ? mensagemMatch[1].trim() : null;

  if (codigo === '4') return { sucesso: true, comunicacoes: [] }; // pesquisa sem resultados
  if (codigo !== '1') {
    return { sucesso: false, mensagemErro: mensagem || `Código de resultado: ${codigo ?? 'desconhecido'}`, comunicacoes: [] };
  }

  const campo = (bloco, nome) => {
    const m = bloco.match(new RegExp(`<(?:[^:>]+:)?${nome}[^>]*>([^<]*)<\\/(?:[^:>]+:)?${nome}>`, 'i'));
    return m ? m[1].trim() : null;
  };

  const comunicacoes = [];
  const blocoRegex = /<(?:[^:>]+:)?comunicacao>([\s\S]*?)<\/(?:[^:>]+:)?comunicacao>/gi;
  let match;
  while ((match = blocoRegex.exec(xmlStr))) {
    const bloco = match[1];
    comunicacoes.push({
      tipoComunicacao: campo(bloco, 'tipoComunicacao'),
      nissTrabalhador: campo(bloco, 'nissTrabalhador'),
      nomeTrabalhador: campo(bloco, 'nomeTrabalhador'),
      dataNascimento: campo(bloco, 'dataNascimento'),
      dataComunicacao: campo(bloco, 'dataComunicacao'),
      inicioContrato: campo(bloco, 'inicioContrato'),
      motivo: campo(bloco, 'motivo'),
      localTrabalho: campo(bloco, 'localTrabalho'),
      dataProcessamento: campo(bloco, 'dataProcessamento'),
      taxa: campo(bloco, 'taxa'),
    });
  }

  return { sucesso: true, comunicacoes };
}

// ── Consultar Contratos — SOAP, dois passos (pesquisaContratos + getDadosContratos) ──
//
// Passo 1: submete o pedido (período + trabalhadores opcional), devolve uma
// <chave> para consultar depois. Passo 2: consulta o resultado por chave —
// pode ainda estar "a processar" (repetir), ter expirado (repetir passo 1),
// ou vir pronto. Mesmo endpoint para as duas operações (ver CONTRATOS_URL).
// Namespace: xmlns:vo="http://vo.webservice.contrato.segsocial.pt" (igual ao
// de cessarVinculo/obterComunicacoes).

/**
 * Constrói o envelope SOAP de pesquisaContratos.
 * data-inicio/data-fim obrigatórios (data-fim >= data-inicio); nissTrabalhadores
 * opcional — sem ele, a PSI devolve contratos de todos os trabalhadores da
 * empresa no período (inferido do exemplo do PDF, não afirmado em texto).
 */
export function buildPesquisaContratosSoap({ dataInicio, dataFim, nissTrabalhadores = [] }) {
  const trabalhadoresXml = nissTrabalhadores.length
    ? `\n      <trabalhadores>\n${nissTrabalhadores.map(n => `        <niss-trabalhador>${escapeXml(n)}</niss-trabalhador>`).join('\n')}\n      </trabalhadores>`
    : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope
  xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:vo="http://vo.webservice.contrato.segsocial.pt">
  <soapenv:Header/>
  <soapenv:Body>
    <vo:pesquisaContratos>
      <data-inicio>${fmtDate(dataInicio)}</data-inicio>
      <data-fim>${fmtDate(dataFim)}</data-fim>${trabalhadoresXml}
    </vo:pesquisaContratos>
  </soapenv:Body>
</soapenv:Envelope>`;
}

// Extrai a <chave> da resposta de pesquisaContratos.
export function parsePesquisaContratosResponse(xmlStr) {
  if (!xmlStr) return { sucesso: false, mensagemErro: 'Resposta vazia da Segurança Social.' };

  const chaveMatch = xmlStr.match(/<(?:[^:>]+:)?chave[^>]*>([^<]+)<\/(?:[^:>]+:)?chave>/i);
  if (chaveMatch) return { sucesso: true, chave: chaveMatch[1].trim() };

  const mensagemMatch = xmlStr.match(/<(?:[^:>]+:)?mensagens-erro[^>]*>([^<]*)<\/(?:[^:>]+:)?mensagens-erro>/i)
    || xmlStr.match(/<faultstring[^>]*>([^<]+)<\/faultstring>/i);
  return { sucesso: false, mensagemErro: mensagemMatch ? mensagemMatch[1].trim() : 'Pedido de pesquisa de contratos falhou (sem detalhe da Segurança Social).' };
}

/** Constrói o envelope SOAP de getDadosContratos (passo 2, por chave). */
export function buildGetDadosContratosSoap({ chave }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope
  xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:vo="http://vo.webservice.contrato.segsocial.pt">
  <soapenv:Header/>
  <soapenv:Body>
    <vo:getDadosContratos>
      <chave>${escapeXml(chave)}</chave>
    </vo:getDadosContratos>
  </soapenv:Body>
</soapenv:Envelope>`;
}

// codigo-resultado: 1=sucesso, 2=falta parâmetros, 3=falha validação, 4=sem
// resultados, 0=erro — mas 0 cobre três situações distintas (chave
// desconhecida / ainda a processar / pedido expirado) sem código próprio
// para cada uma; distinguem-se só pelo texto de mensagens-erro (conforme o
// PDF). >=500 contratos vêm como ficheiro binário MTOM/XOP (ZIP) em vez de
// <contratos> inline — não implementado (caso raro, ~28 trabalhadores na
// empresa), devolve-se erro amigável em vez de tentar fazer parsing.
export function parseGetDadosContratosResponse(xmlStr) {
  if (!xmlStr) return { estado: 'erro', erro: 'Resposta vazia da Segurança Social.' };

  const codigoMatch = xmlStr.match(/<(?:[^:>]+:)?codigo-resultado[^>]*>([^<]+)<\/(?:[^:>]+:)?codigo-resultado>/i);
  const mensagemMatch = xmlStr.match(/<(?:[^:>]+:)?mensagens-erro[^>]*>([^<]*)<\/(?:[^:>]+:)?mensagens-erro>/i);
  const codigo = codigoMatch ? codigoMatch[1].trim() : null;
  const mensagem = mensagemMatch ? mensagemMatch[1].trim() : '';

  if (codigo === '4') return { estado: 'sem_resultados', contratos: [] };
  if (codigo === '2' || codigo === '3') return { estado: 'erro', erro: mensagem || `Código de resultado: ${codigo}` };

  if (codigo === '0') {
    if (/n.o foi processado|tenta mais tarde/i.test(mensagem)) return { estado: 'processando' };
    if (/expir/i.test(mensagem)) return { estado: 'expirado', erro: mensagem || 'Pedido expirado — repita a pesquisa.' };
    return { estado: 'erro', erro: mensagem || 'Chave não encontrada ou erro desconhecido.' };
  }

  if (codigo !== '1') return { estado: 'erro', erro: mensagem || `Código de resultado desconhecido: ${codigo ?? 'nenhum'}` };

  // codigo === '1' → sucesso, mas pode vir como ficheiro (≥500 contratos)
  if (/<(?:[^:>]+:)?ficheiro-dados[^>]*>/i.test(xmlStr)) {
    return { estado: 'erro', erro: 'Resultado demasiado grande para mostrar aqui (≥500 contratos) — contacte o suporte técnico.' };
  }

  const campo = (bloco, nome) => {
    const m = bloco.match(new RegExp(`<(?:[^:>]+:)?${nome}[^>]*>([^<]*)<\\/(?:[^:>]+:)?${nome}>`, 'i'));
    return m ? m[1].trim() : null;
  };

  const contratos = [];
  const blocoRegex = /<(?:[^:>]+:)?contrato>([\s\S]*?)<\/(?:[^:>]+:)?contrato>/gi;
  let match;
  while ((match = blocoRegex.exec(xmlStr))) {
    const bloco = match[1];
    contratos.push({
      nissTrabalhador: campo(bloco, 'niss-trabalhador'),
      nomeTrabalhador: campo(bloco, 'nome-trabalhador'), // vem mascarado pela PSI
      modalidadeContrato: campo(bloco, 'modalidade-contrato'),
      prestacaoTrabalho: campo(bloco, 'prestacao-trabalho'),
      inicioContrato: campo(bloco, 'inicio-contrato'),
      fimContrato: campo(bloco, 'fim-contrato'),
      inicioInformacaoContrato: campo(bloco, 'inicio-informacao-contrato'),
      fimInformacaoContrato: campo(bloco, 'fim-informacao-contrato'),
      profissao: campo(bloco, 'profissao'),
      remuneracaoBase: campo(bloco, 'remuneracao-base'),
      diuturnidades: campo(bloco, 'diuturnidades'),
      percentagemTrabalho: campo(bloco, 'percentagem-trabalho'),
      horasTrabalho: campo(bloco, 'horas-trabalho'),
      diasTrabalho: campo(bloco, 'dias-trabalho'),
      motivoContrato: campo(bloco, 'motivo-contrato'),
      nissTrabalhadorSubstituir: campo(bloco, 'niss-trabalhador-substituir'),
      nomeTrabalhadorSubstituir: campo(bloco, 'nome-trabalhador-substituir'),
    });
  }

  return { estado: 'sucesso', contratos };
}

// ── Consultar Trabalhadores — SOAP, dois passos (getQualificacoesTrabalhadoresVinculadosEE + getDados) ──
//
// ⚠ MENOR CONFIANÇA que o resto deste ficheiro — testar em Qualidade antes de
// confiar cegamente. Namespace DIFERENTE de todos os outros serviços SOAP do
// projeto: "http://vo.webservice.wsidq.segsocial.pt" (os outros usam
// .../vo.webservice.contrato.segsocial.pt). O WSDL exige
// wsaw:UsingAddressing required="true" (WS-Addressing) — enviamos o envelope
// SOAP normal com SOAPAction vazio, mas isto pode não bastar: pode ser
// preciso adicionar cabeçalhos wsa:Action/wsa:To/wsa:MessageID que NÃO estão
// implementados aqui. Confirmar/ajustar contra o ambiente de Qualidade real
// antes de dar este serviço como fiável.

/**
 * Constrói o envelope SOAP de getQualificacoesTrabalhadoresVinculadosEE.
 * dataInicioPesquisa/dataFimPesquisa obrigatórias, janela máxima de 90 dias
 * (validado do lado da app antes de chamar, ver index.js — barato de
 * verificar e evita deixar a PSI rejeitar). niss opcional — sem ele, devolve
 * todos os trabalhadores da empresa (inferido, não afirmado no PDF).
 */
export function buildPesquisaTrabalhadoresSoap({ dataInicio, dataFim, niss }) {
  const nissXml = niss
    ? `<nissPS>${escapeXml(niss)}</nissPS>`
    : `<nissPS xsi:nil="true"/>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope
  xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:vo="http://vo.webservice.wsidq.segsocial.pt">
  <soapenv:Header/>
  <soapenv:Body>
    <vo:getQualificacoesTrabalhadoresVinculadosEE>
      <TrabalhadorVinculoEEPesquisaSimplesPTVO_1>
        <dataFimPesquisa>${fmtDateTime(dataFim, true)}</dataFimPesquisa>
        <dataInicioPesquisa>${fmtDateTime(dataInicio, false)}</dataInicioPesquisa>
        ${nissXml}
      </TrabalhadorVinculoEEPesquisaSimplesPTVO_1>
    </vo:getQualificacoesTrabalhadoresVinculadosEE>
  </soapenv:Body>
</soapenv:Envelope>`;
}

// Extrai a <chave> da resposta de getQualificacoesTrabalhadoresVinculadosEE.
export function parsePesquisaTrabalhadoresResponse(xmlStr) {
  if (!xmlStr) return { sucesso: false, mensagemErro: 'Resposta vazia da Segurança Social.' };

  const chaveMatch = xmlStr.match(/<(?:[^:>]+:)?chave[^>]*>([^<]+)<\/(?:[^:>]+:)?chave>/i);
  if (chaveMatch) return { sucesso: true, chave: chaveMatch[1].trim() };

  const mensagemMatch = xmlStr.match(/<(?:[^:>]+:)?mensagemEstado[^>]*>([^<]*)<\/(?:[^:>]+:)?mensagemEstado>/i)
    || xmlStr.match(/<faultstring[^>]*>([^<]+)<\/faultstring>/i);
  return { sucesso: false, mensagemErro: mensagemMatch ? mensagemMatch[1].trim() : 'Pedido de pesquisa de trabalhadores falhou (sem detalhe da Segurança Social).' };
}

/** Constrói o envelope SOAP de getDados (passo 2, por chave). */
export function buildGetDadosTrabalhadoresSoap({ chave }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope
  xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:vo="http://vo.webservice.wsidq.segsocial.pt">
  <soapenv:Header/>
  <soapenv:Body>
    <vo:getDados>
      <chave>${escapeXml(chave)}</chave>
    </vo:getDados>
  </soapenv:Body>
</soapenv:Envelope>`;
}

// codigoEstado: 0=sucesso OU "ainda não processado" OU "sem dados" (distinguir
// só pelo texto de mensagemEstado, sem código próprio para cada — conforme o
// PDF); 1=sucesso via ficheiro MTOM/XOP (não implementado, mesma decisão do
// serviço de Contratos); 2=erro de negócio (mensagem em mensagemEstado).
export function parseGetDadosTrabalhadoresResponse(xmlStr) {
  if (!xmlStr) return { estado: 'erro', erro: 'Resposta vazia da Segurança Social.' };

  const codigoMatch = xmlStr.match(/<(?:[^:>]+:)?codigoEstado[^>]*>([^<]+)<\/(?:[^:>]+:)?codigoEstado>/i);
  const mensagemMatch = xmlStr.match(/<(?:[^:>]+:)?mensagemEstado[^>]*>([^<]*)<\/(?:[^:>]+:)?mensagemEstado>/i);
  const codigo = codigoMatch ? codigoMatch[1].trim() : null;
  const mensagem = mensagemMatch ? mensagemMatch[1].trim() : '';

  if (codigo === '1') {
    return { estado: 'erro', erro: 'Resultado demasiado grande para mostrar aqui (via ficheiro) — contacte o suporte técnico.' };
  }
  if (codigo === '2') {
    return { estado: 'erro', erro: mensagem || 'Erro de negócio devolvido pela Segurança Social.' };
  }
  if (codigo !== '0') {
    return { estado: 'erro', erro: mensagem || `Código de estado desconhecido: ${codigo ?? 'nenhum'}` };
  }

  // codigo === '0' — distinguir só pelo texto de mensagemEstado (sem código próprio, ver PDF)
  if (/ainda n.o foi processado/i.test(mensagem)) return { estado: 'processando' };
  if (/sem dados de retorno/i.test(mensagem)) return { estado: 'sem_resultados', trabalhadores: [] };
  if (/expirou/i.test(mensagem)) return { estado: 'expirado', erro: mensagem };
  if (mensagem) return { estado: 'erro', erro: mensagem };

  // mensagem vazia → sucesso, dados no array trabalhadoresQualificacoes
  const campo = (bloco, nome) => {
    const m = bloco.match(new RegExp(`<(?:[^:>]+:)?${nome}[^>]*>([^<]*)<\\/(?:[^:>]+:)?${nome}>`, 'i'));
    return m ? m[1].trim() : null;
  };

  const trabalhadores = [];
  const blocoRegex = /<(?:[^:>]+:)?trabalhadoresQualificacoes>([\s\S]*?)<\/(?:[^:>]+:)?trabalhadoresQualificacoes>/gi;
  let match;
  while ((match = blocoRegex.exec(xmlStr))) {
    const bloco = match[1];

    const periodosTaxa = [];
    const periodoRegex = /<(?:[^:>]+:)?periodosTaxa>([\s\S]*?)<\/(?:[^:>]+:)?periodosTaxa>/gi;
    let pm;
    while ((pm = periodoRegex.exec(bloco))) {
      const pBloco = pm[1];
      periodosTaxa.push({
        dataInicio: campo(pBloco, 'dataInicio'),
        dataFim: campo(pBloco, 'dataFim'),
        taxaTotal: campo(pBloco, 'taxaTotal'),
      });
    }

    const estabelecimentos = [];
    const estabRegex = /<(?:[^:>]+:)?estabelecimentosTrabalhador>([\s\S]*?)<\/(?:[^:>]+:)?estabelecimentosTrabalhador>/gi;
    let em;
    while ((em = estabRegex.exec(bloco))) {
      const eBloco = em[1];
      estabelecimentos.push({
        codigoEstabelecimento: campo(eBloco, 'codigoEstabelecimento'),
        moradaEstabelecimento: campo(eBloco, 'moradaEstabelecimento'), // vem mascarada
        designacaoDistrito: campo(eBloco, 'designacaoDistrito'),
        designacaoPais: campo(eBloco, 'designacaoPais'),
        dataInicio: campo(eBloco, 'dataInicio'),
        dataFim: campo(eBloco, 'dataFim'),
      });
    }

    trabalhadores.push({
      nissEE: campo(bloco, 'nissEE'),
      nissPS: campo(bloco, 'nissPS'),
      nomePS: campo(bloco, 'nomePS'), // vem mascarado
      dataNascimentoTrabalhador: campo(bloco, 'dataNascimentoTrabalhador'),
      tipoQlf: campo(bloco, 'tipoQlf'),
      dataEntradaRegistoEE: campo(bloco, 'dataEntradaRegistoEE'),
      dataInicioQlf: campo(bloco, 'dataInicioQlf'),
      dataFimQlf: campo(bloco, 'dataFimQlf'),
      periodosTaxa,
      estabelecimentos,
    });
  }

  return { estado: 'sucesso', trabalhadores };
}

// Envia um envelope SOAP para uma URL completa (usado pelos serviços com
// endpoint fixo partilhado entre duas operações — Contratos, Trabalhadores —
// onde a URL não é `${SOAP_BASE()}/${operacao}` como no callSS abaixo).
export async function callSSSoapUrl(url, soapBody, soapAction) {
  const token = getBearerToken();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type':  'text/xml; charset=utf-8',
      'Authorization': `Bearer ${token}`,
      'SOAPAction':    soapAction ? `"${soapAction}"` : '""',
    },
    body: soapBody,
  });

  const texto = await res.text();

  if (res.status === 401) throw new Error('Token PSI inválido ou expirado (HTTP 401). Verifique se o token SS_PSI_TOKEN ainda é válido na SSD → Gestão de autenticação → Tokens de acesso.');
  if (res.status === 403) throw new Error('Acesso negado pela Segurança Social (HTTP 403). Verifique se aderiu à PSI e se o serviço está autorizado.');

  return { httpStatus: res.status, xmlResposta: texto };
}

// Envia um envelope SOAP para a PSI.
// soapAction: URI completo, ex: "http://interfaces.webservice.contrato.segsocial.pt#cessarVinculo"
export async function callSS(operacao, soapBody, soapAction) {
  const token   = getBearerToken();
  const url     = `${SOAP_BASE()}/${operacao}`;
  const action  = soapAction
    || `http://interfaces.webservice.contrato.segsocial.pt#${operacao}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type':  'text/xml; charset=utf-8',
      'Authorization': `Bearer ${token}`,
      'SOAPAction':    `"${action}"`,
    },
    body: soapBody,
  });

  const texto = await res.text();

  if (res.status === 401) throw new Error('Token PSI inválido ou expirado (HTTP 401). Verifique se o token SS_PSI_TOKEN ainda é válido na SSD → Gestão de autenticação → Tokens de acesso.');
  if (res.status === 403) throw new Error('Acesso negado pela Segurança Social (HTTP 403). Verifique se aderiu à PSI e se o serviço está autorizado.');

  return { httpStatus: res.status, xmlResposta: texto };
}

export { MODALIDADE_MAP, PRESTACAO_MAP };
