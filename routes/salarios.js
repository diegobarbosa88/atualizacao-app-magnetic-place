import { Router } from 'express';
import { gerarSepaSalariosXML } from '../services/sepaSalariosService.js';

const router = Router();

/**
 * POST /api/salarios/exportar-xml
 *
 * Body:
 *   trabalhadores  {Array}   - Lista de trabalhadores a pagar
 *   urgente        {boolean} - true = execução hoje (InstrPrty HIGH)
 *                              false (default) = execução em 2 dias úteis
 *
 * Env vars necessárias:
 *   MINHA_CONTA_IBAN  - IBAN da conta empresarial debitada
 *   MINHA_CONTA_BIC   - BIC do banco da empresa
 */
router.post('/exportar-xml', async (req, res) => {
  try {
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

    const dadosEmpresa = {
      iban: ibanEmpresa,
      bic:  bicEmpresa,
      // nome usa o valor padrão definido no serviço
    };

    const xmlString = gerarSepaSalariosXML(dadosEmpresa, trabalhadores, Boolean(urgente));

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
});

export default router;
