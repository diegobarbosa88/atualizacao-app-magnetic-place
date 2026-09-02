// Catálogo de EPIs (equipamentos de proteção individual) — texto de risco e
// manutenção transcrito fielmente do modelo de checklist partilhado pelo
// Diego (formulário "F-108_012", baseado na metodologia da Quirón Prevención,
// já em uso real com os trabalhadores). Nunca inventar ou reformular este
// texto — é informação de segurança, tem de bater com o modelo real.
//
// `key` é o identificador estável usado em src/data/epiPerfis.js para dizer
// que itens se aplicam a cada profissão.
export const EPI_CATALOGO = [
  {
    key: 'capacete',
    nome: 'Capacete',
    risco: 'Ferimentos na cabeça provocados pela queda e/ou choque em/de objetos e/ou pancadas.',
    manutencao: 'Limpeza diária; Armazenar em local protegido; Substituir sempre que se encontra danificado; Marcar a data de receção no interior do casco; Verificação das condições de utilização antes de utilizar.',
  },
  {
    key: 'touca_protecao',
    nome: 'Touca Proteção',
    risco: 'Proteção biológica.',
    manutencao: 'Guardar em local adequado; limpar diariamente após utilização; substituir sempre que danificado.',
  },
  {
    key: 'protecao_auricular',
    nome: 'Proteção Auricular',
    risco: 'Redução da capacidade auditiva por ação de ruídos com pressões elevadas ou por ruídos contínuos.',
    manutencao: 'Limpeza após utilização; guardar em local adequado, protegendo de poeiras; substituir sempre que danificado.',
  },
  {
    key: 'oculos',
    nome: 'Óculos',
    risco: 'Ferimentos nos olhos devido à existência ou projeção de partículas.',
    manutencao: 'Limpeza diária; Armazenar em local protegido; Substituir sempre que se encontra danificado / riscado; Verificação das condições de utilização antes de utilizar; Substituir os vidros de proteção das máscaras de soldar sempre que necessário; Limpar viseiras com água e sabão.',
  },
  {
    key: 'viseira',
    nome: 'Viseira',
    risco: 'Ferimentos na face e olhos, devido à projeção de partículas e líquidos, exposição a vapores, gases, temperaturas e radiações.',
    manutencao: 'Limpeza diária; Armazenar em local protegido; Substituir sempre que se encontra danificado / riscado; Verificação das condições de utilização antes de utilizar; Substituir os vidros de proteção das máscaras de soldar sempre que necessário; Limpar viseiras com água e sabão.',
  },
  {
    key: 'mascara_soldar',
    nome: 'Máscara Soldar',
    risco: 'Ferimentos nos olhos e face devido ao encadeamento, projeção de partículas.',
    manutencao: 'Limpeza diária; Armazenar em local protegido; Substituir sempre que se encontra danificado / riscado; Verificação das condições de utilização antes de utilizar; Substituir os vidros de proteção das máscaras de soldar sempre que necessário; Limpar viseiras com água e sabão.',
  },
  {
    key: 'mascara_protecao',
    nome: 'Máscara Proteção',
    risco: 'Inalação de poeiras, fibras, fumos, aerossóis, etc.',
    manutencao: 'Limpeza após utilização; Armazenar em local protegido; Substituir sempre que se encontra danificado; Verificação das condições de utilização antes de utilizar; Lavar com água e sabão; substituir as cassetes (filtros) de acordo com a utilização e instruções do fabricante/fornecedor.',
  },
  {
    key: 'mascara_filtros_quimicos',
    nome: 'Máscara Filtros Químicos',
    risco: 'Inalação de gases e vapores.',
    manutencao: 'Limpeza após utilização; Armazenar em local protegido; Substituir sempre que se encontra danificado; Verificação das condições de utilização antes de utilizar; Lavar com água e sabão; substituir as cassetes (filtros) de acordo com a utilização e instruções do fabricante/fornecedor.',
  },
  {
    key: 'equipamento_respiracao_autonoma',
    nome: 'Equipamento Respiração Autónoma',
    risco: 'Asfixia.',
    manutencao: 'Guardar em local adequado; inspecionar diariamente antes da sua utilização; substituir assim que detetadas anomalias; seguir as instruções do fabricante.',
  },
  {
    key: 'bata_protecao',
    nome: 'Bata de Proteção',
    risco: 'Salpicos de produtos biológicos, exposição a agentes químicos (poeiras, líquidos, etc.).',
    manutencao: 'Guardar em local próprio e separado de outros equipamentos e vestuários; limpeza sempre que necessário; de acordo com o tipo de exposição, eliminar o mesmo após utilização.',
  },
  {
    key: 'vestuario_trabalho',
    nome: 'Vestuário de Trabalho',
    risco: 'Proteção de corpo inteiro contra agentes diversos (temperatura, humidade, químicos, mecânicos, etc.).',
    manutencao: "Guardar em local próprio e separado de outros EPI's e vestuário; limpeza semanal ou diária consoante a sua utilização e sujidade; substituir sempre que danificado.",
  },
  {
    key: 'colete_refletorizado',
    nome: 'Colete Refletorizado',
    risco: 'Atropelamento, esmagamento, entalamento, pancada, embate provocado por equipamentos móveis dirigíveis ou pela movimentação de cargas por esses equipamentos externos.',
    manutencao: 'Arrumar em local próprio; substituir quando danificado; não lavar em máquina (bandas refletoras ficam danificadas).',
  },
  {
    key: 'avental_manguito_polainas',
    nome: 'Avental, Manguito, Polainas de couro',
    risco: 'Queimaduras e cortes provocados pela projeção de partículas incandescentes.',
    manutencao: 'Arrumar em local adequado; proceder à sua limpeza sempre que necessário; substituir sempre que necessário.',
  },
  {
    key: 'luvas_protecao',
    nome: 'Luvas Proteção',
    risco: 'Entalamento, queimaduras, queimaduras químicas, projeção de partículas e eletrização nas mãos.',
    manutencao: "Limpeza sempre que necessário; arrumar em local adequado e em separado de outros EPI's; substituir sempre que danificadas.",
  },
  {
    key: 'calcado_protecao',
    nome: 'Calçado Proteção',
    risco: 'Entalamento, esmagamento, pancada, embate, queimaduras nos pés, lesões músculo-esqueléticas e no sistema imunitário provocado pelo calçado.',
    manutencao: 'Limpeza diária após utilização; recomenda-se a exposição solar durante 2-3h de forma a eliminar bactérias no interior; substituir sempre que danificadas.',
  },
  {
    key: 'protecao_calcado',
    nome: 'Proteção Calçado',
    risco: 'Contaminações involuntárias.',
    manutencao: 'Guardar em local próprio e separado de outros equipamentos e vestuários; limpeza após utilização; de acordo com o tipo de exposição, eliminar o mesmo após utilização.',
  },
  {
    key: 'equipamento_anti_queda',
    nome: 'Equipamento Anti-queda (arnês)',
    risco: 'Queda em altura.',
    manutencao: 'Guardar em local adequado; proceder à sua limpeza com água e sabão; verificar as instruções do fabricante referente à sua limpeza; verificar a marcação CE e validade do mesmo; proceder diariamente à sua inspeção visual; substituir sempre que danificado.',
  },
];
