import { gerarSEPAXml } from './_sepaXml.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  const { trabalhadores, instant = false } = req.body || {};

  if (!Array.isArray(trabalhadores) || trabalhadores.length === 0) {
    return res.status(400).json({
      error: 'O campo "trabalhadores" é obrigatório e deve ser um array não vazio.',
    });
  }

  // Validação mínima de cada registo
  for (let i = 0; i < trabalhadores.length; i++) {
    const t = trabalhadores[i];
    if (!t.nome || !t.iban || t.salario == null || !t.mes || !t.ano) {
      return res.status(400).json({
        error: `Registo ${i + 1} incompleto. Campos obrigatórios: nome, iban, salario, mes, ano.`,
      });
    }
  }

  try {
    const xmlString = gerarSEPAXml(trabalhadores, { instant });

    const filename = instant
      ? 'transferencias_imediatas_magnetic_place.xml'
      : 'salarios_magnetic_place.xml';

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    return res.status(200).send(xmlString);
  } catch (erro) {
    console.error('[SEPA] Erro ao gerar ficheiro XML:', erro.message);
    return res.status(500).json({ error: erro.message });
  }
}
