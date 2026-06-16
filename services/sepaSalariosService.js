import { create } from 'xmlbuilder2';

const NOME_EMPRESA_PADRAO = 'MAGNETIC PLACE UNIPESSOAL LDA';

/**
 * Avança N dias úteis a partir de uma data, ignorando sábados (6) e domingos (0).
 * @param {Date} dataBase
 * @param {number} dias
 * @returns {Date}
 */
function adicionarDiasUteis(dataBase, dias) {
  const resultado = new Date(dataBase);
  let adicionados = 0;
  while (adicionados < dias) {
    resultado.setDate(resultado.getDate() + 1);
    const diaSemana = resultado.getDay();
    if (diaSemana !== 0 && diaSemana !== 6) adicionados++;
  }
  return resultado;
}

function formatarData(data) {
  return data.toISOString().slice(0, 10); // YYYY-MM-DD
}

function gerarId(prefixo, sufixo = '') {
  return `${prefixo}-${Date.now()}${sufixo ? `-${sufixo}` : ''}`;
}

/**
 * Gera o XML SEPA pain.001.001.03 (Customer Credit Transfer Initiation)
 * para pagamento de salários no novobanco (Portugal).
 *
 * @param {Object}  dadosEmpresa
 * @param {string}  dadosEmpresa.iban              - IBAN da conta debitada
 * @param {string}  dadosEmpresa.bic               - BIC do banco da empresa
 * @param {string}  [dadosEmpresa.nome]             - Nome da empresa (opcional)
 * @param {Array}   listaTrabalhadores              - Lista de trabalhadores a pagar
 * @param {string}  listaTrabalhadores[].nome       - Nome completo do trabalhador
 * @param {string}  listaTrabalhadores[].iban       - IBAN do trabalhador
 * @param {number}  listaTrabalhadores[].salario    - Valor a transferir (€)
 * @param {string}  listaTrabalhadores[].mes        - Mês de referência (ex: "06")
 * @param {string}  listaTrabalhadores[].ano        - Ano de referência (ex: "2026")
 * @param {boolean} [urgente=false]                 - true = execução hoje com InstrPrty HIGH
 * @returns {string} XML UTF-8 pronto a descarregar
 */
export function gerarSepaSalariosXML(dadosEmpresa, listaTrabalhadores, urgente = false) {
  const nomeEmpresa = dadosEmpresa?.nome?.trim() || NOME_EMPRESA_PADRAO;
  const ibanEmpresa = dadosEmpresa?.iban?.replace(/\s/g, '');
  const bicEmpresa  = dadosEmpresa?.bic?.replace(/\s/g, '');

  if (!ibanEmpresa || !bicEmpresa) {
    throw new Error('dadosEmpresa deve incluir "iban" e "bic".');
  }
  if (!Array.isArray(listaTrabalhadores) || listaTrabalhadores.length === 0) {
    throw new Error('"listaTrabalhadores" deve ser um array não vazio.');
  }

  for (let i = 0; i < listaTrabalhadores.length; i++) {
    const t = listaTrabalhadores[i];
    if (!t.nome || !t.iban || t.salario == null || !t.mes || !t.ano) {
      throw new Error(`Trabalhador #${i + 1} incompleto. Campos obrigatórios: nome, iban, salario, mes, ano.`);
    }
  }

  const hoje = new Date();
  const dataExecucao = urgente
    ? formatarData(hoje)
    : formatarData(adicionarDiasUteis(hoje, 2));

  const agora     = hoje.toISOString().slice(0, 19); // YYYY-MM-DDTHH:MM:SS
  const totalTxs  = listaTrabalhadores.length;
  const somaTotal = listaTrabalhadores.reduce((acc, t) => acc + Number(t.salario), 0);
  const msgId     = gerarId('MAGN');
  const pmtInfId  = gerarId('PMT');

  // ── Construção do documento XML ─────────────────────────────────────────────

  const pmtInf = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('Document', {
      xmlns: 'urn:iso:std:iso:20022:tech:xsd:pain.001.001.03',
      'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
      'xsi:schemaLocation': 'urn:iso:std:iso:20022:tech:xsd:pain.001.001.03 pain.001.001.03.xsd',
    })
    .ele('CstmrCdtTrfInitn')

    // ── Group Header ──────────────────────────────────────────────────────────
    .ele('GrpHdr')
      .ele('MsgId').txt(msgId).up()
      .ele('CreDtTm').txt(agora).up()
      .ele('NbOfTxs').txt(String(totalTxs)).up()
      .ele('CtrlSum').txt(somaTotal.toFixed(2)).up()
      .ele('InitgPty')
        .ele('Nm').txt(nomeEmpresa).up()
      .up()
    .up()

    // ── Payment Information ───────────────────────────────────────────────────
    .ele('PmtInf')
      .ele('PmtInfId').txt(pmtInfId).up()
      .ele('PmtMtd').txt('TRF').up()
      .ele('NbOfTxs').txt(String(totalTxs)).up()
      .ele('CtrlSum').txt(somaTotal.toFixed(2)).up();

  // ── PmtTpInf ─────────────────────────────────────────────────────────────
  // urgente = true  → SCT Inst: LclInstrm INST + data hoje (liquidação em segundos)
  // urgente = false → SEPA normal: data execução em 2 dias úteis
  const pmtTpInf = pmtInf.ele('PmtTpInf');
  pmtTpInf.ele('SvcLvl').ele('Cd').txt('SEPA').up().up();
  if (urgente) {
    pmtTpInf.ele('LclInstrm').ele('Cd').txt('INST').up().up();
  }
  pmtTpInf.ele('CtgyPurp').ele('Cd').txt('SALA').up().up();

  // ── Conta ordenante e agente ──────────────────────────────────────────────
  pmtInf
    .ele('ReqdExctnDt').txt(dataExecucao).up()
    .ele('Dbtr')
      .ele('Nm').txt(nomeEmpresa).up()
    .up()
    .ele('DbtrAcct')
      .ele('Id')
        .ele('IBAN').txt(ibanEmpresa).up()
      .up()
    .up()
    .ele('DbtrAgt')
      .ele('FinInstnId')
        .ele('BIC').txt(bicEmpresa).up()
      .up()
    .up();

  // ── Transações individuais ────────────────────────────────────────────────
  listaTrabalhadores.forEach((t, i) => {
    const endToEndId = gerarId('E2E', i + 1);
    pmtInf
      .ele('CdtTrfTxInf')
        .ele('PmtId')
          .ele('EndToEndId').txt(endToEndId).up()
        .up()
        .ele('Amt')
          .ele('InstdAmt', { Ccy: 'EUR' }).txt(Number(t.salario).toFixed(2)).up()
        .up()
        .ele('Cdtr')
          .ele('Nm').txt(t.nome).up()
        .up()
        .ele('CdtrAcct')
          .ele('Id')
            .ele('IBAN').txt(t.iban.replace(/\s/g, '')).up()
          .up()
        .up()
        .ele('RmtInf')
          .ele('Ustrd').txt(`Vencimento ${t.mes}/${t.ano}`).up()
        .up()
      .up();
  });

  return pmtInf.end({ prettyPrint: true });
}
