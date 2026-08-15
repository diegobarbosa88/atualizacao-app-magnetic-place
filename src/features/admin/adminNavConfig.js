import {
  LayoutGrid, Trophy, Building2, Clock, FileText, BarChart3,
  Wallet, Settings, Users, CalendarX, ShieldCheck,
  AlertTriangle, Send, FolderOpen, Mail, ReceiptText, Coins, Receipt,
  FileSignature, BarChart2, BookOpen, ArrowRightLeft, Landmark, ListChecks,
  Truck, Shield, Table2, ShieldAlert, MessageSquareText,
} from 'lucide-react';

export const ADMIN_SECTIONS = [
  { id: 'overview', label: 'Geral', icon: LayoutGrid, badgeType: null },
  {
    id: 'team', label: 'Equipa', icon: Trophy, badgeType: 'team',
    subtabs: [
      { id: 'workers',   label: 'Colaboradores', icon: Users,        path: '/admin/team?subtab=workers' },
      { id: 'absences',  label: 'Faltas',        icon: CalendarX,    path: '/admin/team?subtab=absences',  badgeType: 'absences' },
      { id: 'validacao', label: 'Validação',     icon: ShieldCheck,  path: '/admin/team?subtab=validacao' },
      { id: 'correcoes', label: 'Correções',     icon: AlertTriangle, path: '/admin/team?subtab=correcoes',  badgeType: 'workerCorrections' },
      { id: 'onboarding', label: 'Pendentes',    icon: Clock,        path: '/admin/team?subtab=onboarding' },
    ],
  },
  {
    id: 'clients', label: 'Clientes', icon: Building2, badgeType: 'clients',
    subtabs: [
      { id: 'list',      label: 'Clientes',        icon: Building2,    path: '/admin/clients?subtab=list' },
      { id: 'envios',    label: 'Envios',           icon: Send,         path: '/admin/clients?subtab=envios' },
      { id: 'correcoes', label: 'Correções',        icon: AlertTriangle, path: '/admin/clients?subtab=correcoes', badgeType: 'clientCorrections' },
      { id: 'auditoria', label: 'Auditoria Portal', icon: Shield,       path: '/admin/clients?subtab=auditoria' },
    ],
  },
  {
    id: 'fornecedores', label: 'Fornecedores', icon: Truck, badgeType: null,
    subtabs: [
      { id: 'forn-list', label: 'Fornecedores', icon: Truck, path: '/admin/fornecedores?subtab=list' },
    ],
  },
  { id: 'schedules', label: 'Horários', icon: Clock, badgeType: null },
  {
    id: 'documentos', label: 'Documentos', icon: FolderOpen, badgeType: null,
    subtabs: [
      { id: 'documentos', label: 'Documentos', icon: FileText,        path: '/admin/documentos/documentos' },
      { id: 'templates',  label: 'Templates',  icon: FileSignature,  path: '/admin/documentos/templates' },
    ],
  },
  {
    id: 'faturacao', label: 'Faturação', icon: Receipt, badgeType: null,
    subtabs: [
      { id: 'importar',     label: 'Importar',     icon: Mail,      path: '/admin/faturacao/importar' },
      { id: 'fornecedores', label: 'Fornecedores', icon: Building2, path: '/admin/faturacao/fornecedores' },
      { id: 'contador',     label: 'Contador',     icon: MessageSquareText, path: '/admin/faturacao/contador' },
    ],
  },
  {
    id: 'reconciliacao', label: 'Reconciliação', icon: BarChart2, badgeType: null,
    subtabs: [
      { id: 'recibos',  label: 'Recibos',  icon: ReceiptText, path: '/admin/reconciliacao/recibos' },
      { id: 'salarios', label: 'Salários', icon: Coins,       path: '/admin/reconciliacao/salarios' },
      { id: 'bancaria', label: 'Bancária', icon: Landmark,    path: '/admin/reconciliacao/bancaria' },
    ],
  },
  {
    id: 'pagamentos', label: 'Pagamentos', icon: ArrowRightLeft, badgeType: null,
    subtabs: [
      { id: 'fornecedores', label: 'Fornecedores', icon: ArrowRightLeft, path: '/admin/pagamentos/fornecedores' },
      { id: 'fila',         label: 'Fila de Pag.', icon: ListChecks,     path: '/admin/pagamentos/fila' },
    ],
  },
  { id: 'reports',       label: 'Folhas',          icon: BarChart3, badgeType: null },
  { id: 'costs',         label: 'Custos',          icon: Wallet,    badgeType: null },
  { id: 'contabilidade', label: 'Contabilidade',   icon: FileText,  badgeType: null },
  { id: 'ajudas-custo',  label: 'Ajudas de Custo', icon: Coins,     badgeType: null },
  { id: 'recibos',       label: 'Calc. Recibos',   icon: Receipt,   badgeType: null },
  { id: 'mapa-salarios', label: 'Mapa Salários',   icon: Table2,    badgeType: null },
  {
    id: 'toconline', label: 'TOConline', icon: BookOpen, badgeType: null,
    subtabs: [
      { id: 'toc-documentos', label: 'Documentos', icon: FileText,   path: '/admin/toconline?subtab=documentos' },
      { id: 'toc-clientes',   label: 'Clientes',   icon: Users,      path: '/admin/toconline?subtab=clientes' },
      { id: 'toc-artigos',    label: 'Artigos',    icon: Receipt,    path: '/admin/toconline?subtab=artigos' },
      { id: 'toc-relatorios', label: 'Relatórios', icon: BarChart2,  path: '/admin/toconline?subtab=relatorios' },
    ],
  },
  { id: 'alertas', label: 'Gestão de Alertas', icon: ShieldAlert, badgeType: null },
  { id: 'settings', label: 'Configurações', icon: Settings, badgeType: null },
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
