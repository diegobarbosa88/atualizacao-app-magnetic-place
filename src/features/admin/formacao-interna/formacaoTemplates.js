// Categorias de formação interna e respetivos tipos sugeridos. O admin
// pode sempre escrever um tipo_formacao livre — estas listas só alimentam
// o datalist de sugestões. Quando o tipo escolhido corresponde exatamente
// a uma entrada de CAMPOS_POR_TIPO, o formulário preenche automaticamente
// todos os campos exceto as datas (data_inicio, data_fim, data_validade).

export const CATEGORIAS = [
  { id: 'soldadura',            label: 'Soldadura' },
  { id: 'caldeiraria',          label: 'Caldeiraria' },
  { id: 'certificacao_formal',  label: 'Certificação Formal' },
  { id: 'hst',                  label: 'HST — Higiene e Segurança' },
  { id: 'equipamentos',         label: 'Equipamentos' },
  { id: 'gwo',                  label: 'GWO — Global Wind Organisation' },
  { id: 'onboarding',           label: 'Onboarding' },
];

// Categorias em que a formação é sempre dada por entidade externa
// certificadora — formador_id fica desabilitado e entidade_externa
// é obrigatório.
export const CATEGORIAS_ENTIDADE_EXTERNA = ['certificacao_formal', 'gwo'];

// Categorias em que a data_validade por participante é obrigatória.
export const CATEGORIAS_EXIGEM_VALIDADE = ['certificacao_formal', 'gwo'];

// Validade padrão sugerida (meses) quando o admin não indica uma data —
// só aplicável à categoria GWO (BST renova de 24 em 24 meses).
export const VALIDADE_PADRAO_MESES = { gwo: 24 };

export const TIPOS_POR_CATEGORIA = {
  soldadura: [
    'MIG/MAG (135/136)',
    'TIG (141)',
    'Elétrodo Revestido (111)',
    'Arco Submerso (121)',
    'Leitura de Desenho Técnico',
    'Preparação de Bordos',
    'Inspeção Visual de Soldadura',
  ],
  caldeiraria: [
    'Corte e Conformação de Chapa',
    'Quinagem/Calandragem',
    'Traçagem',
    'Montagem de Estruturas',
    'Tubagem Industrial',
    'Reservatórios',
  ],
  certificacao_formal: [
    'ISO 9606-1',
    'WPS (Welding Procedure Specification)',
    'WPQR (Welding Procedure Qualification Record)',
  ],
  hst: [
    'Segurança em Trabalhos de Soldadura',
    'Segurança em Trabalhos de Caldeiraria',
    'EPI para Soldadura',
    'Ventilação e Extração de Fumos',
    'Trabalhos a Quente',
    'Manuseamento de Gases Industriais',
  ],
  equipamentos: [
    'Ponte Rolante',
    'Plataforma Elevatória',
  ],
  gwo: [
    'BST Trabalhos em Altura',
    'BST Primeiros Socorros',
    'BST Combate a Incêndio',
    'BST Movimentação Manual',
    'BST Sobrevivência no Mar',
  ],
  onboarding: [
    'Compromisso de Início de Atividade',
    'Procedimentos Internos',
    'Regras do Cliente/Estaleiro',
  ],
};

// Preenchimento automático por tipo_formacao — tudo exceto datas
// (data_inicio, data_fim e data_validade continuam sempre manuais).
export const CAMPOS_POR_TIPO = {
  // Soldadura
  'MIG/MAG (135/136)': {
    duracao_horas: 8,
    objetivos: 'Capacitar o soldador na técnica MIG/MAG para juntas em aço carbono e inoxidável.',
    conteudo_programatico: 'Parâmetros de soldadura (tensão, velocidade de fio, gás de proteção); posições de soldadura; defeitos comuns e correção.',
    justificativa_afinidade: 'Técnica de soldadura diretamente utilizada nas funções de soldador da empresa.',
    metodo_avaliacao: 'Avaliação prática de execução de cordão de soldadura',
  },
  'TIG (141)': {
    duracao_horas: 8,
    objetivos: 'Capacitar o soldador na técnica TIG para trabalhos de precisão em inox e alumínio.',
    conteudo_programatico: 'Regulação de amperagem; escolha de elétrodo de tungsténio; gás de proteção; técnica de enchimento manual.',
    justificativa_afinidade: 'Técnica de soldadura diretamente utilizada nas funções de soldador da empresa.',
    metodo_avaliacao: 'Avaliação prática de execução de cordão de soldadura',
  },
  'Elétrodo Revestido (111)': {
    duracao_horas: 6,
    objetivos: 'Capacitar o soldador na técnica de elétrodo revestido para trabalhos estruturais.',
    conteudo_programatico: 'Escolha de elétrodo; regulação de corrente; posições de soldadura; inspeção visual do cordão.',
    justificativa_afinidade: 'Técnica de soldadura diretamente utilizada nas funções de soldador da empresa.',
    metodo_avaliacao: 'Avaliação prática de execução de cordão de soldadura',
  },
  'Arco Submerso (121)': {
    duracao_horas: 6,
    objetivos: 'Capacitar o soldador na técnica de arco submerso para grandes espessuras.',
    conteudo_programatico: 'Preparação de fluxo; regulação de parâmetros; controlo de penetração; inspeção do cordão.',
    justificativa_afinidade: 'Técnica de soldadura diretamente utilizada nas funções de soldador da empresa.',
    metodo_avaliacao: 'Avaliação prática de execução de cordão de soldadura',
  },
  'Leitura de Desenho Técnico': {
    duracao_horas: 4,
    objetivos: 'Capacitar o colaborador para interpretar desenhos técnicos e simbologia de soldadura.',
    conteudo_programatico: 'Simbologia de soldadura ISO 2553; cotagem; tolerâncias; interpretação de vistas e cortes.',
    justificativa_afinidade: 'Competência transversal necessária à execução correta de trabalhos de soldadura e caldeiraria.',
    metodo_avaliacao: 'Exercício prático de interpretação de desenho',
  },
  'Preparação de Bordos': {
    duracao_horas: 4,
    objetivos: 'Capacitar o colaborador na preparação correta de bordos antes da soldadura.',
    conteudo_programatico: 'Tipos de chanfro; ângulos e folgas; métodos de corte e esmerilagem; controlo dimensional.',
    justificativa_afinidade: 'Etapa preparatória diretamente relacionada com as funções de soldador/caldeireiro.',
    metodo_avaliacao: 'Avaliação prática de preparação de junta',
  },
  'Inspeção Visual de Soldadura': {
    duracao_horas: 4,
    objetivos: 'Capacitar o colaborador na deteção de defeitos de soldadura por inspeção visual.',
    conteudo_programatico: 'Critérios de aceitação (ISO 5817); defeitos típicos (poros, fissuras, mordeduras); registo de não conformidades.',
    justificativa_afinidade: 'Competência de controlo de qualidade diretamente relacionada com a função de soldador.',
    metodo_avaliacao: 'Avaliação prática de inspeção de amostras',
  },

  // Caldeiraria
  'Corte e Conformação de Chapa': {
    duracao_horas: 6,
    objetivos: 'Capacitar o colaborador nas técnicas de corte e conformação de chapa metálica.',
    conteudo_programatico: 'Corte por oxicorte, plasma e mecânico; conformação a frio; controlo dimensional.',
    justificativa_afinidade: 'Diretamente relacionada com as funções de caldeireiro da empresa.',
    metodo_avaliacao: 'Avaliação prática de execução de peça',
  },
  'Quinagem/Calandragem': {
    duracao_horas: 6,
    objetivos: 'Capacitar o colaborador na operação de quinadoras e calandras para conformação de chapa.',
    conteudo_programatico: 'Regulação de ferramentas; cálculo de dobras; operação segura do equipamento; controlo de raio/curvatura.',
    justificativa_afinidade: 'Diretamente relacionada com as funções de caldeireiro da empresa.',
    metodo_avaliacao: 'Avaliação prática de operação do equipamento',
  },
  'Traçagem': {
    duracao_horas: 4,
    objetivos: 'Capacitar o colaborador nas técnicas de traçagem para corte e montagem de estruturas.',
    conteudo_programatico: 'Instrumentos de traçagem; desenvolvimento de peças; marcação de furos e cortes.',
    justificativa_afinidade: 'Diretamente relacionada com as funções de caldeireiro da empresa.',
    metodo_avaliacao: 'Avaliação prática de traçagem de peça',
  },
  'Montagem de Estruturas': {
    duracao_horas: 8,
    objetivos: 'Capacitar o colaborador na montagem e alinhamento de estruturas metálicas.',
    conteudo_programatico: 'Leitura de plano de montagem; pontos de fixação provisória; verificação de esquadria e nível; segurança na montagem.',
    justificativa_afinidade: 'Diretamente relacionada com as funções de caldeireiro da empresa.',
    metodo_avaliacao: 'Avaliação prática em montagem simulada',
  },
  'Tubagem Industrial': {
    duracao_horas: 8,
    objetivos: 'Capacitar o colaborador na montagem e soldadura de tubagem industrial.',
    conteudo_programatico: 'Corte e biselagem de tubo; alinhamento; suportes e flanges; testes de estanquicidade.',
    justificativa_afinidade: 'Diretamente relacionada com as funções de caldeireiro da empresa.',
    metodo_avaliacao: 'Avaliação prática de montagem de troço de tubagem',
  },
  'Reservatórios': {
    duracao_horas: 8,
    objetivos: 'Capacitar o colaborador na construção e reparação de reservatórios metálicos.',
    conteudo_programatico: 'Sequência de montagem; controlo de estanquicidade; inspeção de soldaduras; normas aplicáveis.',
    justificativa_afinidade: 'Diretamente relacionada com as funções de caldeireiro da empresa.',
    metodo_avaliacao: 'Avaliação prática e inspeção final',
  },

  // Certificação formal
  'ISO 9606-1': {
    duracao_horas: 16,
    objetivos: 'Qualificar o soldador segundo a norma ISO 9606-1 para os processos e materiais aplicáveis à função.',
    conteudo_programatico: 'Ensaio de qualificação prático; radiografia/END conforme aplicável; emissão de certificado.',
    justificativa_afinidade: 'Certificação exigida para a execução de trabalhos de soldadura certificada nos projetos da empresa.',
    metodo_avaliacao: 'Ensaio de qualificação segundo a norma (END/exame visual)',
  },
  'WPS (Welding Procedure Specification)': {
    duracao_horas: 8,
    objetivos: 'Qualificar o procedimento de soldadura (WPS) a utilizar em obra, conforme especificação técnica.',
    conteudo_programatico: 'Definição de parâmetros de soldadura; ensaio de procedimento; validação por entidade certificadora.',
    justificativa_afinidade: 'Necessário para garantir conformidade técnica dos trabalhos de soldadura executados.',
    metodo_avaliacao: 'Ensaio de qualificação de procedimento',
  },
  'WPQR (Welding Procedure Qualification Record)': {
    duracao_horas: 8,
    objetivos: 'Obter o registo de qualificação de procedimento de soldadura (WPQR) correspondente ao WPS aplicado.',
    conteudo_programatico: 'Execução do provete; ensaios mecânicos e não destrutivos; emissão do registo de qualificação.',
    justificativa_afinidade: 'Necessário para garantir conformidade técnica dos trabalhos de soldadura executados.',
    metodo_avaliacao: 'Ensaios mecânicos e não destrutivos ao provete',
  },

  // HST
  'Segurança em Trabalhos de Soldadura': {
    duracao_horas: 0.5,
    objetivos: 'No final, o formando deve ser capaz de identificar os principais riscos da soldadura e aplicar as medidas de proteção corretas no seu posto de trabalho.',
    conteudo_programatico: '1. Introdução — importância da segurança em soldadura. 2. Riscos principais — radiação (UV/IV), fumos e gases de soldadura, choque elétrico, queimaduras térmicas e projeções de faísca, ruído. 3. EPI — máscara de soldar com filtro adequado ao processo (MIG/MAG/TIG/elétrodo), luvas de proteção térmica, roupa ignífuga/avental de couro, proteção respiratória (espaços confinados/materiais especiais) e auditiva quando aplicável. 4. Ventilação e extração de fumos — ventilação geral vs. extração localizada, sinais de exposição excessiva, boas práticas de posicionamento face ao fluxo de ar. 5. Prevenção de incêndio — distância de segurança a inflamáveis, procedimento de trabalho a quente, localização e uso de extintores. 6. Procedimento de emergência — atuação em queimadura, choque elétrico ou início de incêndio, e a quem reportar incidentes/quase-acidentes. 7. Resumo e pontos-chave.',
    justificativa_afinidade: 'Diretamente relacionada com os riscos específicos da função de soldador — radiação, fumos, choque elétrico e risco de incêndio inerentes à atividade de soldadura.',
    metodo_avaliacao: 'Questionário de verificação de conhecimentos (8-10 perguntas — EPI por processo, atuação em exposição a fumos, distância de segurança a inflamáveis, a quem reportar quase-acidentes)',
  },
  'Segurança em Trabalhos de Caldeiraria': {
    duracao_horas: 0.5,
    objetivos: 'No final, o formando deve ser capaz de identificar os riscos específicos do trabalho de corte, conformação e montagem de estruturas metálicas, e aplicar as medidas de proteção corretas.',
    conteudo_programatico: '1. Introdução — riscos específicos da caldeiraria (e sobreposição parcial com os da soldadura). 2. Riscos principais — manuseamento manual de cargas pesadas (chapa, perfis), corte de chapa (guilhotina, oxicorte, plasma), quinagem e calandragem, arestas cortantes e rebarbas, ruído de máquinas (prensas, guilhotinas). 3. EPI — luvas anticorte, calçado de proteção com biqueira de aço, óculos/viseira contra projeções, proteção auditiva junto de equipamento pesado. 4. Segurança em máquinas e equipamentos — resguardos e dispositivos de segurança (nunca remover/desativar), distância de segurança durante operação de guilhotina/prensa, verificação pré-utilização, bloqueio/etiquetagem (LOTO) durante manutenção. 5. Movimentação de cargas — técnicas corretas de levantamento manual, uso de ajuda mecânica (ponte rolante, empilhador), sinalização e comunicação durante movimentação de peças pesadas. 6. Procedimento de emergência — atuação em corte grave, esmagamento ou lesão músculo-esquelética aguda, e a quem reportar. 7. Resumo e pontos-chave.',
    justificativa_afinidade: 'Diretamente relacionada com os riscos específicos da função de caldeireiro — corte, conformação, montagem e movimentação de estruturas metálicas.',
    metodo_avaliacao: 'Questionário de verificação de conhecimentos (8-10 perguntas — EPI ao operar guilhotina, uso de resguardos, bloqueio/etiquetagem LOTO, procedimento em lesão músculo-esquelética)',
  },
  'EPI para Soldadura': {
    duracao_horas: 1,
    objetivos: 'Garantir que os soldadores conhecem e utilizam corretamente o EPI específico da função.',
    conteudo_programatico: 'Máscara e viseira de soldadura; luvas e avental de proteção; proteção respiratória; regras de uso e manutenção.',
    justificativa_afinidade: 'Diretamente relacionada com os riscos específicos da função de soldador.',
    metodo_avaliacao: 'Avaliação prática de colocação e uso do equipamento',
  },
  'Ventilação e Extração de Fumos': {
    duracao_horas: 1,
    objetivos: 'Sensibilizar para os riscos de exposição a fumos de soldadura e o uso correto dos sistemas de extração.',
    conteudo_programatico: 'Riscos para a saúde respiratória; sistemas de extração localizada; boas práticas em espaços confinados.',
    justificativa_afinidade: 'Diretamente relacionada com os riscos específicos da função de soldador/caldeireiro.',
    metodo_avaliacao: 'Questionário de verificação de conhecimentos',
  },
  'Trabalhos a Quente': {
    duracao_horas: 2,
    objetivos: 'Capacitar os colaboradores para a execução segura de trabalhos a quente (soldadura, corte, esmerilagem).',
    conteudo_programatico: 'Permissão de trabalho a quente; controlo de fontes de ignição; meios de extinção; vigilância pós-trabalho.',
    justificativa_afinidade: 'Formação obrigatória para colaboradores que executam trabalhos a quente.',
    metodo_avaliacao: 'Questionário de verificação de conhecimentos',
  },
  'Manuseamento de Gases Industriais': {
    duracao_horas: 2,
    objetivos: 'Capacitar os colaboradores no manuseamento seguro de garrafas e gases industriais utilizados na soldadura.',
    conteudo_programatico: 'Identificação de garrafas; transporte e armazenamento; deteção de fugas; procedimento em emergência.',
    justificativa_afinidade: 'Diretamente relacionada com os riscos específicos da função de soldador.',
    metodo_avaliacao: 'Questionário de verificação de conhecimentos',
  },

  // Equipamentos
  'Ponte Rolante': {
    duracao_horas: 4,
    objetivos: 'Capacitar o colaborador para a operação segura de ponte rolante.',
    conteudo_programatico: 'Verificações antes da operação; sinalização de manobras; limites de carga; procedimentos de emergência.',
    justificativa_afinidade: 'Diretamente relacionada com funções que exigem a operação deste equipamento.',
    metodo_avaliacao: 'Avaliação prática de operação do equipamento',
  },
  'Plataforma Elevatória': {
    duracao_horas: 4,
    objetivos: 'Capacitar o colaborador para a operação segura de plataformas elevatórias.',
    conteudo_programatico: 'Verificações antes da operação; estabilização; limites de carga e altura; procedimentos de emergência.',
    justificativa_afinidade: 'Diretamente relacionada com funções que exigem a operação deste equipamento.',
    metodo_avaliacao: 'Avaliação prática de operação do equipamento',
  },

  // GWO
  'BST Trabalhos em Altura': {
    duracao_horas: 8,
    objetivos: 'Certificar o colaborador nos procedimentos de segurança para trabalhos em altura em parques eólicos.',
    conteudo_programatico: 'Uso de EPI anti-queda; técnicas de ascensão e resgate; inspeção de equipamento.',
    justificativa_afinidade: 'Certificação exigida para acesso a estaleiros/parques eólicos com trabalhos em altura.',
    metodo_avaliacao: 'Avaliação prática segundo o standard GWO',
  },
  'BST Primeiros Socorros': {
    duracao_horas: 8,
    objetivos: 'Certificar o colaborador em primeiros socorros no contexto da indústria eólica.',
    conteudo_programatico: 'Suporte básico de vida; atuação em altura; transporte de vítima; ativação da emergência.',
    justificativa_afinidade: 'Certificação exigida para acesso a estaleiros/parques eólicos.',
    metodo_avaliacao: 'Avaliação prática segundo o standard GWO',
  },
  'BST Combate a Incêndio': {
    duracao_horas: 4,
    objetivos: 'Certificar o colaborador no combate a incêndio em contexto industrial/offshore.',
    conteudo_programatico: 'Classes de fogo; uso de extintores; procedimento de evacuação em torre eólica.',
    justificativa_afinidade: 'Certificação exigida para acesso a estaleiros/parques eólicos.',
    metodo_avaliacao: 'Avaliação prática segundo o standard GWO',
  },
  'BST Movimentação Manual': {
    duracao_horas: 4,
    objetivos: 'Certificar o colaborador em técnicas seguras de movimentação manual de cargas.',
    conteudo_programatico: 'Técnicas de elevação; uso de equipamento de içamento; prevenção de lesões músculo-esqueléticas.',
    justificativa_afinidade: 'Certificação exigida para acesso a estaleiros/parques eólicos.',
    metodo_avaliacao: 'Avaliação prática segundo o standard GWO',
  },
  'BST Sobrevivência no Mar': {
    duracao_horas: 8,
    objetivos: 'Certificar o colaborador em técnicas de sobrevivência no mar para trabalhos offshore.',
    conteudo_programatico: 'Uso de equipamento de flutuação; abandono de embarcação; sobrevivência em água fria; resgate por helicóptero.',
    justificativa_afinidade: 'Certificação exigida para acesso a parques eólicos offshore.',
    metodo_avaliacao: 'Avaliação prática segundo o standard GWO',
  },

  // Onboarding
  'Compromisso de Início de Atividade': {
    duracao_horas: 1,
    objetivos: 'Formalizar o compromisso do colaborador com as regras e responsabilidades no início de atividade.',
    conteudo_programatico: 'Direitos e deveres; regras de conduta; confidencialidade; assinatura do compromisso.',
    justificativa_afinidade: 'Aplica-se a todos os novos colaboradores independentemente da função.',
    metodo_avaliacao: 'Assinatura do compromisso',
  },
  'Procedimentos Internos': {
    duracao_horas: 2,
    objetivos: 'Dar a conhecer os procedimentos internos da empresa aos novos colaboradores.',
    conteudo_programatico: 'Estrutura organizacional; políticas internas; procedimentos de segurança e qualidade; canais de comunicação.',
    justificativa_afinidade: 'Aplica-se a todos os novos colaboradores independentemente da função.',
    metodo_avaliacao: 'Avaliação de participação e esclarecimento de dúvidas',
  },
  'Regras do Cliente/Estaleiro': {
    duracao_horas: 2,
    objetivos: 'Garantir o conhecimento das regras específicas do cliente/estaleiro onde o colaborador vai prestar serviço.',
    conteudo_programatico: 'Regras de acesso e segurança do estaleiro; EPI exigido pelo cliente; contactos de emergência locais.',
    justificativa_afinidade: 'Diretamente relacionada com a colocação do colaborador no cliente/estaleiro em causa.',
    metodo_avaliacao: 'Questionário de verificação de conhecimentos',
  },
};
