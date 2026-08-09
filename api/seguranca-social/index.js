import { createClient } from '@supabase/supabase-js';
import {
  buildAdmissaoRest,
  callSSRest,
  buildCessacaoSoap,
  parseSoapResponse,
  callSS,
} from './_soapUtils.js';

function supabaseAdmin() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function getAmbiente() {
  return process.env.SS_AMBIENTE === 'producao' ? 'producao' : 'teste';
}

function credenciaisConfiguradas() {
  return Boolean(process.env.SS_NISS_EMPRESA && process.env.SS_PSI_TOKEN);
}

export default async function handler(req, res) {
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

  // ── POST: comunicar admissão ou cessação ──
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido. Use POST.' });
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

  // ── Validações ──
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
    const jsonBody = buildAdmissaoRest({
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
    });

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
