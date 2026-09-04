// Os 3 documentos que compõem o "pacote" enviado ao cliente por
// trabalhador — usado por WorkerDocsFolderView.jsx (secção "Documentos
// para Cliente") e por api/documentos-cliente/enviar.js para validar que
// os 3 estão assinados antes de gerar/enviar. Comparação exata com
// unifyDocuments(...).tipo — ver nota em WorkerDocsFolderView.jsx sobre a
// fonte de cada um.
export const TIPOS_DOCUMENTOS_CLIENTE = [
  'Registo de Formação Interna',
  'Termo de Responsabilidade — EPI',
  'Registo de Informações sobre Riscos no Local de Trabalho',
];
