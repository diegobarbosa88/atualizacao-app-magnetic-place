export const ADMIN_SECTIONS = [
  { id: 'overview',      label: 'Geral',          badgeType: null },
  {
    id: 'team', label: 'Equipa', badgeType: 'team',
    subtabs: [
      { id: 'workers',   label: 'Colaboradores', path: '/admin/team?subtab=workers' },
      { id: 'absences',  label: 'Faltas',        path: '/admin/team?subtab=absences',  badgeType: 'absences' },
      { id: 'validacao', label: 'Validação',     path: '/admin/team?subtab=validacao' },
      { id: 'correcoes',  label: 'Correções',  path: '/admin/team?subtab=correcoes',  badgeType: 'workerCorrections' },
      { id: 'onboarding', label: 'Pendentes',  path: '/admin/team?subtab=onboarding' },
    ],
  },
  {
    id: 'clients', label: 'Clientes', badgeType: 'clients',
    subtabs: [
      { id: 'list',      label: 'Clientes',        path: '/admin/clients?subtab=list' },
      { id: 'envios',    label: 'Envios',           path: '/admin/clients?subtab=envios' },
      { id: 'correcoes', label: 'Correções',        path: '/admin/clients?subtab=correcoes', badgeType: 'clientCorrections' },
      { id: 'auditoria', label: 'Auditoria Portal', path: '/admin/clients?subtab=auditoria' },
    ],
  },
  { id: 'fornecedores',  label: 'Fornecedores',    badgeType: null },
  { id: 'schedules',     label: 'Horários',        badgeType: null },
  {
    id: 'documentos', label: 'Documentos', badgeType: null,
    subtabs: [
      { id: 'doc-docs',         label: 'Documentos',     path: '/admin/documentos/documentos' },
      { id: 'doc-templates',    label: 'Templates',      path: '/admin/documentos/templates' },
      { id: 'fat-importar',     label: 'Importar Fat.',  path: '/admin/documentos/faturas/importar' },
      { id: 'fat-fornec',       label: 'Fat. Fornec.',   path: '/admin/documentos/faturas/fornecedores' },
      { id: 'rec-recibos',      label: 'Recibos',        path: '/admin/documentos/reconciliacao/recibos' },
      { id: 'rec-salarios',     label: 'Salários',       path: '/admin/documentos/reconciliacao/salarios' },
      { id: 'rec-bancaria',     label: 'Bancária',       path: '/admin/documentos/reconciliacao/bancaria' },
      { id: 'pag-fornecedores', label: 'Pagamentos',     path: '/admin/documentos/pagamentos/pagamentos-fornecedores' },
      { id: 'pag-fila',         label: 'Fila de Pag.',   path: '/admin/documentos/pagamentos/fila' },
      { id: 'banco-movs',       label: 'Conta Bancária', path: '/admin/documentos/banco/movimentacoes' },
    ],
  },
  { id: 'reports',       label: 'Folhas',          badgeType: null },
  { id: 'costs',         label: 'Custos',          badgeType: null },
  { id: 'contabilidade', label: 'Contabilidade',   badgeType: null },
  { id: 'recibos',       label: 'Calc. Recibos',   badgeType: null },
  {
    id: 'toconline', label: 'TOConline', badgeType: null,
    subtabs: [
      { id: 'toc-documentos', label: 'Documentos', path: '/admin/toconline?subtab=documentos' },
      { id: 'toc-clientes',   label: 'Clientes',   path: '/admin/toconline?subtab=clientes' },
      { id: 'toc-artigos',    label: 'Artigos',    path: '/admin/toconline?subtab=artigos' },
      { id: 'toc-relatorios', label: 'Relatórios', path: '/admin/toconline?subtab=relatorios' },
    ],
  },
  { id: 'settings',      label: 'Configurações',   badgeType: null },
];

export const SECTION_LABELS = Object.fromEntries([
  ...ADMIN_SECTIONS.map(s => [s.id, s.label]),
  ['notificacoes', 'Notificações'],
]);

export function resolveBadge(badgeType, counts) {
  if (!badgeType || !counts) return 0;
  if (badgeType === 'team') return (counts.absences || 0) + (counts.workerCorrections || 0);
  if (badgeType === 'clients') return counts.clientCorrections || 0;
  return counts[badgeType] || 0;
}
