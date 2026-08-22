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

import { MODALIDADES_COM_MOTIVO_OBRIGATORIO } from '../../src/data/motivosContratoSS.js';

const isProd = () => process.env.SS_AMBIENTE === 'producao';

// Serviços de comunicação (escrita) — admissão REST e cessação SOAP
const REST_URL  = () => isProd()
  ? 'https://app.seg-social.pt/ptss/rest/qlf/tco/vinculos/pedido'
  : 'https://extwww.seg-social.pt/ptss/rest/qlf/tco/vinculos/pedido';

const SOAP_BASE = () => isProd()
  ? 'https://app.seg-social.pt/ws/contrato/v1'
  : 'https://extservices.seg-social.pt/ws/contrato/v1';

// Serviços de consulta CI (informação contributiva — só leitura, testáveis em produção)
const CI_BASE   = () => isProd()
  ? 'https://app.seg-social.pt/ptss/rest/ci'
  : 'https://extwww.seg-social.pt/ptss/rest/ci';

// Remunerações permanentes (QLF, mesmo host admissão, mas path diferente)
const REMUN_URL = () => isProd()
  ? 'https://app.seg-social.pt/ptss/rest/qlf/tco/remuneracoes/permanentes/trabalhadores'
  : 'https://extwww.seg-social.pt/ptss/rest/qlf/tco/remuneracoes/permanentes/trabalhadores';

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

  if (res.status === 401) throw new Error('Token PSI inválido ou expirado (HTTP 401).');
  if (res.status === 403) throw new Error('Acesso negado pela Segurança Social (HTTP 403).');
  if (res.status === 404) return { httpStatus: 404, ok: true, semRegistos: true, json: null };

  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* deixar null */ }

  if (res.ok) return { httpStatus: res.status, ok: true, json };

  const erro = json?.message || json?.erro || json?.descricao || `HTTP ${res.status}`;
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

export { CI_BASE, REMUN_URL };

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

// Parseia resposta SOAP.
// codigo-resultado: 1=sucesso, 0=erro servidor, 2=falta params, 3=validação falhou, 4=sem resultados
export function parseSoapResponse(xmlStr) {
  if (!xmlStr) return { sucesso: false, mensagemErro: 'Resposta vazia da Segurança Social.' };

  const codigoMatch = xmlStr.match(/<(?:[^:>]+:)?codigo-resultado[^>]*>([^<]+)<\/(?:[^:>]+:)?codigo-resultado>/i)
    || xmlStr.match(/<(?:[^:>]+:)?codigoResultado[^>]*>([^<]+)<\/(?:[^:>]+:)?codigoResultado>/i);
  const mensagemMatch = xmlStr.match(/<(?:[^:>]+:)?mensagens-erro[^>]*>([^<]*)<\/(?:[^:>]+:)?mensagens-erro>/i)
    || xmlStr.match(/<(?:[^:>]+:)?mensagensErro[^>]*>([^<]*)<\/(?:[^:>]+:)?mensagensErro>/i)
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
