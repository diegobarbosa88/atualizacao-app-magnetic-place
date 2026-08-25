import { createClient } from '@supabase/supabase-js';
import {
  buildAdmissaoRest,
  callSSRest,
  buildCessacaoSoap,
  parseSoapResponse,
  buildObterComunicacoesSoap,
  parseObterComunicacoesResponse,
  callSS,
  callSSSoapUrl,
  callSSRestGetUrl,
  callSSRestPostUrl,
  CI_BASE,
  REMUN_URL,
  SITUACAO_CONTRIBUTIVA_URL,
  EEAOC_BASE,
  CONTRATOS_URL,
  TRABALHADORES_SS_URL,
  buildPesquisaContratosSoap,
  parsePesquisaContratosResponse,
  buildGetDadosContratosSoap,
  parseGetDadosContratosResponse,
  buildPesquisaTrabalhadoresSoap,
  parsePesquisaTrabalhadoresResponse,
  buildGetDadosTrabalhadoresSoap,
  parseGetDadosTrabalhadoresResponse,
} from './_soapUtils.js';
import { requireAuth } from '../_authUtils.js';

function supabaseAdmin() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function getAmbiente() {
  return process.env.SS_AMBIENTE === 'producao' ? 'producao' : 'teste';
}

function credenciaisConfiguradas() {
  return Boolean(process.env.SS_NISS_EMPRESA && process.env.SS_PSI_TOKEN);
}

// Bypass dedicado só para o Trabalhador Virtual (CONSELHEIRO-ESTRATEGICO),
// que não tem sessão de admin — usado exclusivamente para a comunicação de
// admissão/cessação já autorizada explicitamente pelo Diego no chat
// (worker_ativacao_agendada). Segredo próprio, nunca o SESSION_SECRET dos
// utilizadores.
function isAgenteAutorizado(req) {
  const secret = process.env.AGENTE_SERVICE_SECRET;
  return !!secret && req.headers['x-agente-secret'] === secret;
}

export default async function handler(req, res) {
  if (!isAgenteAutorizado(req) && !requireAuth(req, res, ['admin'])) return;

  const action = req.method === 'GET'
    ? req.query?.action
    : req.body?.action;

  // ── GET status: estado das variáveis de ambiente ──
  if (req.method === 'GET' && action === 'status') {
    return res.status(200).json({
      configurado: credenciaisConfiguradas(),
      ambiente:    getAmbiente(),
      nissEmpresa: process.env.SS_NISS_EMPRESA
        ? process.env.SS_NISS_EMPRESA.slice(0, 4) + '*'.repeat(7)
        : null,
    });
  }

  // ── GET ping: testar ligação à PSI REST ──
  if (req.method === 'GET' && action === 'ping') {
    if (!credenciaisConfiguradas()) {
      return res.status(400).json({ ok: false, erro: 'Token PSI não configurado. Defina SS_NISS_EMPRESA e SS_PSI_TOKEN nas variáveis de ambiente.' });
    }
    try {
      const token = process.env.SS_PSI_TOKEN;
      // qualidade: extwww.seg-social.pt; produção: app.seg-social.pt
      const host = process.env.SS_AMBIENTE === 'producao' ? 'app.seg-social.pt' : 'extwww.seg-social.pt';
      const url  = `https://${host}/ptss/rest/qlf/tco/vinculos/pedido`;

      // Enviar corpo vazio — esperamos 400 (payload inválido com auth válida), não 401/403
      const r = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body:    JSON.stringify({}),
      });

      if (r.status === 401) return res.status(200).json({ ok: false, erro: 'Token inválido ou expirado (HTTP 401). Verifique se o SS_PSI_TOKEN ainda é válido em SSD → Gestão de autenticação → Tokens de acesso. Se expirou, revogue e crie um novo.' });
      if (r.status === 403) return res.status(200).json({ ok: false, erro: 'Acesso negado (HTTP 403) — verifique a adesão à PSI e se o serviço de comunicação de vínculos está autorizado.' });

      // 400/422/500 com corpo de erro PSI = ligação OK, apenas payload inválido (esperado)
      return res.status(200).json({ ok: true, ambiente: getAmbiente() });
    } catch (e) {
      return res.status(200).json({ ok: false, erro: e.message });
    }
  }

  // ── GET consultas PSI (só leitura) ──────────────────────────────────────────
  // Estas consultas NÃO gravam em ss_comunicacoes. Essa tabela é a prova do que
  // foi comunicado ao Estado — só lá entra escrita (admissão/cessação). Quando
  // as leituras também lá entravam, 1083 das 1087 linhas eram consultas e
  // afogavam os 4 registos que a tabela existe para guardar.

  if (req.method === 'GET' && action === 'comprovativos') {
    if (!credenciaisConfiguradas()) return res.status(400).json({ erro: 'Token PSI não configurado.' });
    const ano = req.query?.ano || new Date().getFullYear();
    // Sem parâmetro de identificação da própria empresa — a identidade vem do
    // token Bearer. `niss-representado` só serve para consultar em nome de
    // terceiro (não usado aqui). Confirmado no OpenAPI oficial da PSI
    // (obterComprovativosPagamento: GET /ci/comprovativos-pagamento/{ano-pagamento}).
    const url = `${CI_BASE()}/comprovativos-pagamento/${ano}`;
    try {
      const r = await callSSRestGetUrl(url);
      if (r.semRegistos) return res.status(200).json({ semRegistos: true, dados: [] });
      if (!r.ok) return res.status(422).json({ erro: r.erro });
      const dados = Array.isArray(r.json) ? r.json : (r.json?.comprovativos || r.json?.resultado || []);
      return res.status(200).json({ semRegistos: dados.length === 0, dados, ambiente: getAmbiente() });
    } catch (e) { return res.status(502).json({ erro: e.message }); }
  }

  if (req.method === 'GET' && action === 'documentos-pagamento') {
    if (!credenciaisConfiguradas()) return res.status(400).json({ erro: 'Token PSI não configurado.' });
    // Idem: sem parâmetro de identificação da própria empresa (OpenAPI oficial
    // da PSI: GET /ci/documento-pagamento/consulta, só aceita
    // ?niss-representado= opcional, para representação de terceiro).
    const url = `${CI_BASE()}/documento-pagamento/consulta`;
    try {
      const r = await callSSRestGetUrl(url);
      if (r.semRegistos) return res.status(200).json({ semRegistos: true, dados: [] });
      if (!r.ok) return res.status(422).json({ erro: r.erro });
      const dados = Array.isArray(r.json) ? r.json : (r.json?.documentos || r.json?.resultado || []);
      return res.status(200).json({ semRegistos: dados.length === 0, dados, ambiente: getAmbiente() });
    } catch (e) { return res.status(502).json({ erro: e.message }); }
  }

  if (req.method === 'GET' && action === 'avisos') {
    if (!credenciaisConfiguradas()) return res.status(400).json({ erro: 'Token PSI não configurado.' });
    // GET /ptss/rest/eeaoc/avisos/{niss-ee} — niss da entidade empregadora no
    // path, não em query. Sigla EEAOC nunca é definida no PDF original.
    const nissEmpresa = process.env.SS_NISS_EMPRESA;
    const url = `${EEAOC_BASE()}/avisos/${nissEmpresa}`;
    try {
      const r = await callSSRestGetUrl(url);
      if (r.semRegistos) return res.status(200).json({ semAvisos: true, avisos: [], ambiente: getAmbiente() });
      if (!r.ok) return res.status(422).json({ erro: r.erro });
      const avisos = Array.isArray(r.json) ? r.json : (r.json?.resultado || []);
      return res.status(200).json({ avisos, semAvisos: avisos.length === 0, ambiente: getAmbiente() });
    } catch (e) { return res.status(502).json({ erro: e.message }); }
  }

  if (req.method === 'GET' && action === 'comunicacoes-pendentes') {
    if (!credenciaisConfiguradas()) return res.status(400).json({ erro: 'Token PSI não configurado.' });
    const nissParam = req.query?.niss;
    const nissList = nissParam
      ? String(nissParam).split(',').map(s => s.trim()).filter(Boolean)
      : [];
    const soapBody = buildObterComunicacoesSoap(nissList);
    try {
      const { xmlResposta } = await callSS(
        'obterComunicacoes',
        soapBody,
        'http://interfaces.webservice.contrato.segsocial.pt#ObterComunicacoes',
      );
      const resultado = parseObterComunicacoesResponse(xmlResposta);
      if (!resultado.sucesso) return res.status(422).json({ erro: resultado.mensagemErro });

      return res.status(200).json({
        comunicacoes: resultado.comunicacoes,
        aProcessar: resultado.comunicacoes.filter(c => c.tipoComunicacao === '0'),
        naoAceites: resultado.comunicacoes.filter(c => c.tipoComunicacao === '1'),
        ambiente: getAmbiente(),
      });
    } catch (e) { return res.status(502).json({ erro: e.message }); }
  }

  // ── POST: comunicar admissão/cessação ou consultar remunerações ──────────────
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido. Use POST.' });
  }

  // Remunerações (POST de consulta, sem efeitos colaterais)
  if (action === 'remuneracoes') {
    if (!credenciaisConfiguradas()) return res.status(400).json({ erro: 'Token PSI não configurado.' });
    const { nissTrabalhadores = [], dataInicio, dataFim } = req.body || {};
    const nissEmpresa = process.env.SS_NISS_EMPRESA;
    const bodyPSI = {
      'niss-entidade-empregadora': Number(nissEmpresa),
      ...(nissTrabalhadores.length ? { 'niss-trabalhadores': nissTrabalhadores.map(Number) } : {}),
      ...(dataInicio ? { 'data-inicio': dataInicio } : {}),
      ...(dataFim    ? { 'data-fim':    dataFim    } : {}),
    };
    try {
      const r = await callSSRestPostUrl(REMUN_URL(), bodyPSI);
      if (r.semRegistos) return res.status(200).json({ semRegistos: true, dados: [] });
      if (!r.ok) return res.status(422).json({ erro: r.erro });
      const dados = Array.isArray(r.json) ? r.json : (r.json?.remuneracoes || r.json?.resultado || []);
      return res.status(200).json({ semRegistos: dados.length === 0, dados, ambiente: getAmbiente() });
    } catch (e) { return res.status(502).json({ erro: e.message }); }
  }

  // Situação Contributiva (POST síncrono, sem efeitos colaterais)
  if (action === 'situacao-contributiva') {
    if (!credenciaisConfiguradas()) return res.status(400).json({ erro: 'Token PSI não configurado.' });
    const nissEmpresa = process.env.SS_NISS_EMPRESA;
    const { nissSolicitante, nissSolicitado } = req.body || {};
    const bodyPSI = {
      'nissSolicitante': Number(nissSolicitante || nissEmpresa),
      'nissSolicitado':  Number(nissSolicitado  || nissEmpresa),
    };
    try {
      const r = await callSSRestPostUrl(SITUACAO_CONTRIBUTIVA_URL(), bodyPSI);
      if (!r.ok) return res.status(422).json({ erro: r.erro });
      return res.status(200).json({
        caminho: r.json?.caminho ?? null,
        situacaoContributivaRegularizada: r.json?.situacaoContributivaRegularizada ?? null,
        ambiente: getAmbiente(),
      });
    } catch (e) { return res.status(502).json({ erro: e.message }); }
  }

  // Contratos — passo 1: pesquisar (devolve chave para consultar depois)
  if (action === 'pesquisar-contratos') {
    if (!credenciaisConfiguradas()) return res.status(400).json({ erro: 'Token PSI não configurado.' });
    const { dataInicio, dataFim, nissTrabalhadores = [] } = req.body || {};
    if (!dataInicio || !dataFim) return res.status(400).json({ erro: 'Campos "dataInicio" e "dataFim" obrigatórios.' });
    const soapBody = buildPesquisaContratosSoap({ dataInicio, dataFim, nissTrabalhadores });
    try {
      const { xmlResposta } = await callSSSoapUrl(
        CONTRATOS_URL(),
        soapBody,
        // Inferido por analogia com cessarVinculo/ObterComunicacoes — não consta explicitamente no PDF.
        'http://interfaces.webservice.contrato.segsocial.pt#pesquisaContratos',
      );
      const resultado = parsePesquisaContratosResponse(xmlResposta);
      if (!resultado.sucesso) return res.status(422).json({ erro: resultado.mensagemErro });
      return res.status(200).json({ chave: resultado.chave, ambiente: getAmbiente() });
    } catch (e) { return res.status(502).json({ erro: e.message }); }
  }

  // Contratos — passo 2: consultar por chave (polling)
  if (action === 'consultar-contratos') {
    if (!credenciaisConfiguradas()) return res.status(400).json({ erro: 'Token PSI não configurado.' });
    const { chave } = req.body || {};
    if (!chave) return res.status(400).json({ erro: 'Campo "chave" obrigatório.' });
    const soapBody = buildGetDadosContratosSoap({ chave });
    try {
      const { xmlResposta } = await callSSSoapUrl(
        CONTRATOS_URL(),
        soapBody,
        // Inferido por analogia — não consta explicitamente no PDF.
        'http://interfaces.webservice.contrato.segsocial.pt#getDadosContratos',
      );
      const resultado = parseGetDadosContratosResponse(xmlResposta);
      if (resultado.estado === 'erro' || resultado.estado === 'expirado') {
        return res.status(422).json({ estado: resultado.estado, erro: resultado.erro });
      }
      return res.status(200).json({ estado: resultado.estado, contratos: resultado.contratos || [], ambiente: getAmbiente() });
    } catch (e) { return res.status(502).json({ erro: e.message }); }
  }

  // Trabalhadores (qualificações vinculadas) — passo 1: pesquisar
  if (action === 'pesquisar-trabalhadores-ss') {
    if (!credenciaisConfiguradas()) return res.status(400).json({ erro: 'Token PSI não configurado.' });
    const { dataInicio, dataFim, niss } = req.body || {};
    if (!dataInicio || !dataFim) return res.status(400).json({ erro: 'Campos "dataInicio" e "dataFim" obrigatórios.' });
    // Validação barata do lado da app: janela máxima de 90 dias (a PSI rejeitaria de qualquer forma).
    const dias = (new Date(dataFim) - new Date(dataInicio)) / 86400000;
    if (dias < 0) return res.status(400).json({ erro: 'A data fim não pode ser anterior à data início.' });
    if (dias > 90) return res.status(400).json({ erro: 'O intervalo entre data início e data fim não pode exceder 90 dias.' });
    const soapBody = buildPesquisaTrabalhadoresSoap({ dataInicio, dataFim, niss });
    try {
      const { xmlResposta } = await callSSSoapUrl(
        TRABALHADORES_SS_URL(),
        soapBody,
        // SOAPAction não consta do documento. WSDL exige WS-Addressing
        // (wsaw:UsingAddressing required="true") — enviamos SOAPAction vazio
        // sem cabeçalhos wsa:*; ver aviso completo em _soapUtils.js. Confirmar
        // contra o ambiente de Qualidade antes de confiar neste serviço.
        '',
      );
      const resultado = parsePesquisaTrabalhadoresResponse(xmlResposta);
      if (!resultado.sucesso) return res.status(422).json({ erro: resultado.mensagemErro });
      return res.status(200).json({ chave: resultado.chave, ambiente: getAmbiente() });
    } catch (e) { return res.status(502).json({ erro: e.message }); }
  }

  // Trabalhadores (qualificações vinculadas) — passo 2: consultar por chave (polling)
  if (action === 'consultar-trabalhadores-ss') {
    if (!credenciaisConfiguradas()) return res.status(400).json({ erro: 'Token PSI não configurado.' });
    const { chave } = req.body || {};
    if (!chave) return res.status(400).json({ erro: 'Campo "chave" obrigatório.' });
    const soapBody = buildGetDadosTrabalhadoresSoap({ chave });
    try {
      const { xmlResposta } = await callSSSoapUrl(TRABALHADORES_SS_URL(), soapBody, '');
      const resultado = parseGetDadosTrabalhadoresResponse(xmlResposta);
      if (resultado.estado === 'erro' || resultado.estado === 'expirado') {
        return res.status(422).json({ estado: resultado.estado, erro: resultado.erro });
      }
      return res.status(200).json({ estado: resultado.estado, trabalhadores: resultado.trabalhadores || [], ambiente: getAmbiente() });
    } catch (e) { return res.status(502).json({ erro: e.message }); }
  }

  const { workerId, dadosExtra = {}, confirmadoPor } = req.body || {};

  if (!action || !['admissao', 'cessacao'].includes(action)) {
    return res.status(400).json({ erro: 'Campo "action" obrigatório: "admissao" ou "cessacao".' });
  }
  if (!workerId) {
    return res.status(400).json({ erro: 'Campo "workerId" obrigatório.' });
  }
  if (!credenciaisConfiguradas()) {
    return res.status(500).json({ erro: 'Token PSI não configurado. Defina SS_NISS_EMPRESA e SS_PSI_TOKEN nas variáveis de ambiente do Vercel.' });
  }

  const db       = supabaseAdmin();
  const ambiente = getAmbiente();
  const nissEmpresa = process.env.SS_NISS_EMPRESA;

  // Carregar dados do trabalhador — inclui todos os campos necessários para a PSI
  const { data: worker, error: workerErr } = await db
    .from('workers')
    .select([
      'id', 'name', 'nis', 'nif', 'dataInicio', 'dataFim',
      'profissao', 'profissao_cnp',
      'tipo_contrato', 'regime', 'horas_semanais', 'modo_trabalho',
      'vencimento_base',
      'data_nascimento', 'enquadramento', 'local_trabalho',
      'ss_admissao_comunicada_em', 'ss_cessacao_comunicada_em',
    ].join(', '))
    .eq('id', workerId)
    .maybeSingle();

  if (workerErr || !worker) {
    return res.status(404).json({ erro: 'Trabalhador não encontrado.' });
  }

  // ── Validações de segurança (dupla — UI já validou, aqui é a camada definitiva) ──

  // 1. NISS: exatamente 11 dígitos numéricos
  const nissDigits = String(worker.nis || '').replace(/\D/g, '');
  if (nissDigits.length !== 11) {
    return res.status(422).json({
      erro: `NISS inválido: deve ter exatamente 11 dígitos numéricos (o trabalhador "${worker.name}" tem NISS "${worker.nis || '(vazio)'}" com ${nissDigits.length} dígitos). Corrija na ficha antes de comunicar.`,
    });
  }

  // 2. Registos fictícios: bloquear pelo nome
  if (/\bteste\b|\btest\b|\bficticio\b|\bfictício\b|\bdummy\b|\bexemplo\b|\bamostra\b/i.test(worker.name || '')) {
    return res.status(422).json({
      erro: `Registo de teste bloqueado: o trabalhador "${worker.name}" parece ser fictício. Remova-o da lista de Equipa antes de usar em produção.`,
    });
  }

  // ── Validações de dados obrigatórios ──
  if (action === 'admissao') {
    if (!worker.nis)            return res.status(422).json({ erro: 'O trabalhador não tem NISS preenchido.' });
    if (!worker.nif)            return res.status(422).json({ erro: 'O trabalhador não tem NIF preenchido.' });
    if (!worker.dataInicio)     return res.status(422).json({ erro: 'O trabalhador não tem Data de Início preenchida.' });

    const dataNasc = dadosExtra.dataNascimento || worker.data_nascimento;
    if (!dataNasc) return res.status(422).json({ erro: 'Data de nascimento obrigatória para comunicar admissão à PSI. Preencha na ficha do trabalhador.' });

    const cnp = dadosExtra.profissaoCnp || worker.profissao_cnp;
    if (!cnp || String(cnp).replace(/\D/g, '').length < 5) {
      return res.status(422).json({ erro: 'Código CNP de profissão obrigatório (5 dígitos). Preencha na ficha do trabalhador.' });
    }
  }

  if (action === 'cessacao') {
    if (!worker.nis) return res.status(422).json({ erro: 'O trabalhador não tem NISS preenchido.' });
    const dataCessacao = dadosExtra.dataCessacao || worker.dataFim;
    if (!dataCessacao)           return res.status(422).json({ erro: 'Data de cessação não definida.' });
    if (!dadosExtra.motivoCessacao) return res.status(422).json({ erro: 'Motivo de cessação obrigatório.' });
  }

  // ── Construir e enviar ──
  let resultado, payloadStr;

  if (action === 'admissao') {
    let jsonBody;
    try {
      jsonBody = buildAdmissaoRest({
        nissEmpresa,
        nisTrabalhador:    worker.nis,
        dataNascimento:    dadosExtra.dataNascimento    || worker.data_nascimento,
        tipoContrato:      dadosExtra.tipoContrato      || worker.tipo_contrato   || 'sem_termo',
        regime:            dadosExtra.regime            || worker.regime           || 'tempo_inteiro',
        modalidadeContrato: dadosExtra.modalidadeContrato,
        modoTrabalho:      dadosExtra.modoTrabalho      || worker.modo_trabalho   || 'presencial',
        prestacaoTrabalho: dadosExtra.prestacaoTrabalho,
        dataInicioContrato: dadosExtra.dataInicio       || worker.dataInicio,
        profissaoCnp:      dadosExtra.profissaoCnp      || worker.profissao_cnp,
        remuneracaoBase:   dadosExtra.remuneracaoBase   || worker.vencimento_base || 0,
        enquadramento:     dadosExtra.enquadramento     || worker.enquadramento   || 'REGE',
        localTrabalho:     dadosExtra.localTrabalho     || worker.local_trabalho  || 1,
        dataFimContrato:   worker.dataFim || undefined,
        horasTrabalho:     dadosExtra.horasSemanais     || worker.horas_semanais  || undefined,
        motivoContrato:    dadosExtra.motivoContrato    || undefined,
        nissTrabalhadorSubstituir: dadosExtra.nissTrabalhadorSubstituir || undefined,
      });
    } catch (e) {
      return res.status(400).json({ sucesso: false, erro: e.message });
    }

    payloadStr = JSON.stringify(jsonBody);

    try {
      resultado = await callSSRest(jsonBody);
    } catch (e) {
      await db.from('ss_comunicacoes').insert({
        worker_id: workerId, tipo: 'admissao', status: 'erro',
        payload_xml: payloadStr, resposta_ss: e.message,
        confirmado_por: confirmadoPor || null, ambiente,
      });
      return res.status(502).json({ sucesso: false, erro: e.message });
    }

    // Gravar auditoria
    await db.from('ss_comunicacoes').insert({
      worker_id:    workerId,
      tipo:         'admissao',
      status:       resultado.sucesso ? 'sucesso' : 'erro',
      payload_xml:  payloadStr,
      resposta_ss:  resultado.sucesso ? JSON.stringify(resultado.json) : resultado.erro,
      num_registo:  resultado.numRegisto || null,
      confirmado_por: confirmadoPor || null,
      ambiente,
    });

    if (resultado.sucesso) {
      const agora = new Date().toISOString();
      await db.from('workers').update({
        ss_admissao_comunicada_em: agora,
        ss_admissao_num_registo:   resultado.numRegisto || null,
      }).eq('id', workerId);

      return res.status(200).json({
        sucesso:    true,
        numRegisto: resultado.numRegisto,
        dataHora:   agora,
        ambiente,
      });
    }

    return res.status(422).json({
      sucesso: false,
      erro:    resultado.erro || 'Erro devolvido pela Segurança Social.',
    });
  }

  // ── Cessação via SOAP ──
  const soapBody = buildCessacaoSoap({
    nissEmpresa,
    nisTrabalhador:        worker.nis,
    dataCessacao:          dadosExtra.dataCessacao || worker.dataFim,
    motivoCessacao:        dadosExtra.motivoCessacao,
    fundamentacao:         dadosExtra.fundamentacao,
    comunicacaoDesemprego: dadosExtra.comunicacaoDesemprego ?? false,
  });

  payloadStr = soapBody;

  let httpStatus, xmlResposta;
  try {
    ({ httpStatus, xmlResposta } = await callSS(
      'cessarVinculoTrabalhador',
      soapBody,
      'http://interfaces.webservice.contrato.segsocial.pt#cessarVinculo',
    ));
  } catch (e) {
    await db.from('ss_comunicacoes').insert({
      worker_id: workerId, tipo: 'cessacao', status: 'erro',
      payload_xml: soapBody, resposta_ss: e.message,
      motivo_cessacao: dadosExtra.motivoCessacao || null,
      confirmado_por: confirmadoPor || null, ambiente,
    });
    return res.status(502).json({ sucesso: false, erro: e.message });
  }

  resultado = parseSoapResponse(xmlResposta);

  await db.from('ss_comunicacoes').insert({
    worker_id:      workerId,
    tipo:           'cessacao',
    status:         resultado.sucesso ? 'sucesso' : 'erro',
    payload_xml:    soapBody,
    resposta_ss:    xmlResposta,
    num_registo:    resultado.numRegisto || null,
    motivo_cessacao: dadosExtra.motivoCessacao || null,
    confirmado_por: confirmadoPor || null,
    ambiente,
  });

  if (resultado.sucesso) {
    const agora = new Date().toISOString();
    await db.from('workers').update({
      ss_cessacao_comunicada_em: agora,
      ss_cessacao_num_registo:   resultado.numRegisto || null,
    }).eq('id', workerId);

    return res.status(200).json({
      sucesso:    true,
      numRegisto: resultado.numRegisto,
      dataHora:   agora,
      ambiente,
    });
  }

  return res.status(422).json({
    sucesso:     false,
    erro:        resultado.mensagemErro,
    codigoErro:  resultado.codigoErro || null,
  });
}
