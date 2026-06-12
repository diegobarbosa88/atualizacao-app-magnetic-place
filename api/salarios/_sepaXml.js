import { create } from 'xmlbuilder2';

const NOME_EMPRESA = 'MAGNETIC PLACE UNIPESSOAL LDA';
const LIMITE_REGISTOS_NOVOBANCO = 2000;

/**
 * Calcula a data de execução: hoje + 2 dias úteis (ignora sábados e domingos).
 * O novobanco exige que o ficheiro seja submetido com pelo menos 2 dias úteis
 * de antecedência para garantir o débito na data pretendida.
 */
function calcularDataExecucao() {
  const data = new Date();
  let diasUteis = 0;

  while (diasUteis < 2) {
    data.setDate(data.getDate() + 1);
    const diaSemana = data.getDay();
    if (diaSemana !== 0 && diaSemana !== 6) diasUteis++;
  }

  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function calcularDataHoje() {
  const data = new Date();
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

/**
 * Gera um identificador único baseado em timestamp + índice para evitar colisões
 * em lotes com múltiplas transações no mesmo milissegundo.
 */
function gerarId(prefixo = 'MSG', indice = '') {
  const ts = Date.now();
  return `${prefixo}-${ts}${indice !== '' ? `-${indice}` : ''}`;
}

/**
 * Gera o XML SEPA pain.001.001.03 (Customer Credit Transfer Initiation)
 * para pagamento de salários no novobanco.
 *
 * @param {Array<{nome: string, iban: string, salario: number, mes: string, ano: string}>} trabalhadores
 * @returns {string} XML UTF-8 pronto a descarregar
 */
export function gerarSEPAXml(trabalhadores, { instant = false } = {}) {
  const ibanEmpresa = process.env.MINHA_CONTA_IBAN;
  const bicEmpresa = process.env.MINHA_CONTA_BIC;

  if (!ibanEmpresa || !bicEmpresa) {
    throw new Error('Variáveis de ambiente MINHA_CONTA_IBAN e MINHA_CONTA_BIC são obrigatórias.');
  }

  if (trabalhadores.length > LIMITE_REGISTOS_NOVOBANCO) {
    console.warn(
      `[SEPA] AVISO: O lote contém ${trabalhadores.length} registos, acima do limite de ` +
      `${LIMITE_REGISTOS_NOVOBANCO} do novobanco. O portal pode não gerar comprovativos individuais.`
    );
  }

  const totalTransacoes = trabalhadores.length;
  const somaTotal = trabalhadores.reduce((acc, t) => acc + Number(t.salario), 0);
  const dataExecucao = instant ? calcularDataHoje() : calcularDataExecucao();
  const agora = new Date().toISOString().slice(0, 19); // YYYY-MM-DDTHH:MM:SS
  const msgId = gerarId('MAGN');
  const pmtInfId = gerarId('PMT');

  const root = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('Document', {
      xmlns: 'urn:iso:std:iso:20022:tech:xsd:pain.001.001.03',
      'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
      'xsi:schemaLocation':
        'urn:iso:std:iso:20022:tech:xsd:pain.001.001.03 pain.001.001.03.xsd',
    })
      .ele('CstmrCdtTrfInitn')

        // --- Group Header ---
        .ele('GrpHdr')
          .ele('MsgId').txt(msgId).up()
          .ele('CreDtTm').txt(agora).up()
          .ele('NbOfTxs').txt(String(totalTransacoes)).up()
          .ele('CtrlSum').txt(somaTotal.toFixed(2)).up()
          .ele('InitgPty')
            .ele('Nm').txt(NOME_EMPRESA).up()
          .up()
        .up()

        // --- Payment Information ---
        .ele('PmtInf')
          .ele('PmtInfId').txt(pmtInfId).up()
          .ele('PmtMtd').txt('TRF').up()
          .ele('NbOfTxs').txt(String(totalTransacoes)).up()
          .ele('CtrlSum').txt(somaTotal.toFixed(2)).up();

  // Tipo de pagamento: SEPA (+ INST para transferência imediata SCT Inst)
  // A tag SALA é obrigatória para isenção de taxas e privacidade no novobanco
  const pmtTpInf = root.ele('PmtTpInf');
  pmtTpInf.ele('SvcLvl').ele('Cd').txt('SEPA').up().up();
  if (instant) {
    pmtTpInf.ele('LclInstrm').ele('Cd').txt('INST').up().up();
  }
  pmtTpInf.ele('CtgyPurp').ele('Cd').txt('SALA').up().up();

  const doc = root
          .ele('ReqdExctnDt').txt(dataExecucao).up()

          // Ordenante (empresa debitada)
          .ele('Dbtr')
            .ele('Nm').txt(NOME_EMPRESA).up()
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

  // --- Transações individuais (um bloco por trabalhador) ---
  trabalhadores.forEach((trabalhador, i) => {
    const endToEndId = gerarId('E2E', i + 1);
    const valorFormatado = Number(trabalhador.salario).toFixed(2);
    const descritivo = `Vencimento ${trabalhador.mes}/${trabalhador.ano}`;

    doc
      .ele('CdtTrfTxInf')
        .ele('PmtId')
          .ele('EndToEndId').txt(endToEndId).up()
        .up()
        .ele('Amt')
          .ele('InstdAmt', { Ccy: 'EUR' }).txt(valorFormatado).up()
        .up()
        .ele('Cdtr')
          .ele('Nm').txt(trabalhador.nome).up()
        .up()
        .ele('CdtrAcct')
          .ele('Id')
            .ele('IBAN').txt(trabalhador.iban).up()
          .up()
        .up()
        .ele('RmtInf')
          .ele('Ustrd').txt(descritivo).up()
        .up()
      .up();
  });

  return doc.end({ prettyPrint: true });
}
