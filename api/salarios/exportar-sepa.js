import { gerarSepaSalariosXML } from '../../services/sepaSalariosService.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  const { trabalhadores, urgente = false } = req.body || {};

  if (!Array.isArray(trabalhadores) || trabalhadores.length === 0) {
    return res.status(400).json({
      error: 'O campo "trabalhadores" é obrigatório e deve ser um array não vazio.',
    });
  }

  const ibanEmpresa = process.env.MINHA_CONTA_IBAN;
  const bicEmpresa  = process.env.MINHA_CONTA_BIC;

  if (!ibanEmpresa || !bicEmpresa) {
    return res.status(500).json({
      error: 'Configuração em falta: defina MINHA_CONTA_IBAN e MINHA_CONTA_BIC nas variáveis de ambiente.',
    });
  }

  try {
    const xmlString = gerarSepaSalariosXML(
      { iban: ibanEmpresa, bic: bicEmpresa },
      trabalhadores,
      Boolean(urgente),
    );

    const nomeArquivo = urgente
      ? 'salarios_URGENTE_MESMO_DIA.xml'
      : 'salarios_AGENDADO_NORMAL.xml';

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);

    return res.status(200).send(xmlString);
  } catch (erro) {
    console.error('[SEPA] Erro ao gerar ficheiro XML:', erro.message);
    return res.status(500).json({ error: erro.message });
  }
}
