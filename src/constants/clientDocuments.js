// Os 4 documentos que compõem o "pacote" enviado ao cliente por
// trabalhador — usado por WorkerDocsFolderView.jsx (secção "Documentos
// para Cliente") e por api/documentos-cliente/enviar.js para validar que
// estão prontos antes de gerar/enviar. Comparação exata com
// unifyDocuments(...).tipo — ver nota em WorkerDocsFolderView.jsx sobre a
// fonte de cada um.
export const TIPOS_DOCUMENTOS_CLIENTE = [
  'Registo de Formação Interna',
  'Termo de Responsabilidade — EPI',
  'Registo de Informações sobre Riscos no Local de Trabalho',
  'Certificado de Aptidão Médica',
];

// O Certificado de Aptidão Médica nunca passa por assinatura digital — é um
// exame feito fora do sistema, o admin só anexa o PDF/scan já emitido.
// "Pronto" para ele significa apenas existir, não isSigned(status), ao
// contrário dos outros 3 (pedido do Diego, 2026-09-08).
export const TIPOS_DOCUMENTOS_CLIENTE_SEM_ASSINATURA = [
  'Certificado de Aptidão Médica',
];
