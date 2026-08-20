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

// Imagens ilustrativas de stock (Wikimedia Commons, uso livre) para os
// módulos de e-learning. Reutilizadas por tema entre secções/perguntas
// de diferentes formações — não são fotos reais da oficina Magnetic.
const WC = 'https://commons.wikimedia.org/wiki/Special:FilePath/';
const IMG = {
  solda: `${WC}Manual_Metal_Arc_welding_(MMAW)_(4791859149).jpg`,
  mascara: `${WC}Welding_helmet.jpg`,
  epi: `${WC}Occupational_Safety_Equipment.jpg`,
  extintor: `${WC}Fire_extinguisher.jpg`,
  gasCilindros: `${WC}Compressed_gas_cylinders.mapp_and_oxygen.triddle.jpg`,
  gasArmazenamento: `${WC}Compressed_gas_storage.jpg`,
  primeirosSocorros: `${WC}A-first-aid-kit.jpg`,
  guilhotina: `${WC}Gasparini_sheet_metal_hydraulic_guillotine_power_shear.jpg`,
  ponteRolante: `${WC}Common_Overhead_Crane.jpg`,
  oculos: `${WC}Safety_Goggles.jpg`,
  oficina: `${WC}Mechanical_Workshop_Practice.jpg`,
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
    conteudo_estruturado: {
      objetivo: 'Identificar os principais riscos da soldadura e aplicar as medidas de proteção corretas no posto de trabalho.',
      seccoes: [
        {
          titulo: 'Introdução',
          imagem_url: IMG.solda,
          paragrafos: [
            'A soldadura está entre as atividades com maior exposição a riscos combinados no setor metalomecânico e naval: radiação, fumos, eletricidade, calor e fogo coexistem no mesmo posto de trabalho.',
            'Este módulo cobre os riscos principais, o equipamento de proteção correto e os procedimentos de emergência.',
          ],
        },
        {
          titulo: 'Riscos Principais',
          imagem_url: IMG.mascara,
          lista: [
            'Radiação (UV/IV): queimaduras oculares ("vista de arco") e cutâneas, mesmo sem contacto direto com o arco.',
            'Fumos e gases de soldadura: inalação de partículas metálicas e gases, com efeitos respiratórios a curto e longo prazo.',
            'Choque elétrico: equipamento de soldadura opera com correntes elevadas — cabos e ligações danificadas são risco direto.',
            'Queimaduras térmicas e projeções de faísca: contacto direto e risco de incêndio em materiais próximos.',
            'Ruído: exposição contínua em ambientes fechados ou com múltiplos postos de soldadura.',
          ],
        },
        {
          titulo: 'Equipamento de Proteção Individual (EPI)',
          imagem_url: IMG.epi,
          lista: [
            'Máscara de soldar com filtro adequado ao processo utilizado (MIG/MAG, TIG, elétrodo revestido).',
            'Luvas de proteção térmica, resistentes a calor e projeções.',
            'Roupa ignífuga ou avental de couro.',
            'Proteção respiratória adicional em espaços confinados ou ao soldar materiais especiais (galvanizados, inox).',
            'Proteção auditiva quando o nível de ruído do posto o justificar.',
          ],
        },
        {
          titulo: 'Ventilação e Extração de Fumos',
          imagem_url: IMG.oficina,
          paragrafos: [
            'A ventilação geral do espaço não substitui a extração localizada junto do ponto de soldadura. Sinais de exposição excessiva incluem tonturas, irritação nas vias respiratórias e dores de cabeça — qualquer um destes sintomas deve ser reportado de imediato.',
          ],
          lista: [
            'Posicionar-se de forma a que o fluxo de ar afaste o fumo da zona respiratória, não o contrário.',
            'Confirmar que o sistema de extração está ligado e a funcionar antes de iniciar o trabalho.',
          ],
        },
        {
          titulo: 'Prevenção de Incêndio',
          imagem_url: IMG.extintor,
          lista: [
            'Manter distância de segurança de materiais inflamáveis (mínimo recomendado: 10 metros, ou conforme procedimento do cliente).',
            'Seguir o procedimento de trabalho a quente (permit-to-work) sempre que aplicável no local do cliente.',
            'Confirmar a localização e validade dos extintores mais próximos antes de iniciar o trabalho.',
          ],
        },
        {
          titulo: 'Procedimento de Emergência',
          imagem_url: IMG.primeirosSocorros,
          lista: [
            'Queimadura: arrefecer imediatamente com água corrente e procurar assistência médica.',
            'Choque elétrico: desligar a fonte de energia antes de tocar na vítima; nunca tocar diretamente enquanto o circuito estiver ativo.',
            'Início de incêndio: usar o extintor adequado ao tipo de fogo e acionar o alarme/evacuação se não for controlável de imediato.',
            'Reportar sempre ao responsável direto, mesmo em caso de quase-acidente sem ferimentos.',
          ],
        },
        {
          titulo: 'Resumo',
          paragrafos: [
            'A segurança em soldadura assenta em três pilares: EPI adequado ao processo, ventilação/extração eficaz, e prevenção ativa de incêndio. Reportar sempre incidentes e quase-acidentes.',
          ],
        },
      ],
    },
    formato: 'e-learning',
    nota_minima_aprovacao: 70,
    questionario: [
      { pergunta: 'Qual o EPI obrigatório para soldadura TIG em espaço fechado?', opcoes: ['Apenas luvas de proteção térmica', 'Máscara de soldar, luvas térmicas e proteção respiratória adicional', 'Apenas óculos de sol', 'Nenhum EPI adicional é necessário'], resposta_correta: 1, imagem_url: IMG.mascara },
      { pergunta: 'O que fazer em caso de exposição prolongada a fumos de soldadura?', opcoes: ['Continuar o trabalho normalmente', 'Reportar sintomas e afastar-se para zona ventilada', 'Ignorar, é normal', 'Aumentar o ritmo de trabalho para terminar mais depressa'], resposta_correta: 1, imagem_url: IMG.oficina },
      { pergunta: 'Qual a distância mínima recomendada de materiais inflamáveis durante trabalho a quente?', opcoes: ['1 metro', '3 metros', '10 metros (ou conforme procedimento do cliente)', 'Não há distância mínima'], resposta_correta: 2, imagem_url: IMG.extintor },
      { pergunta: 'A máscara de soldar protege também contra a inalação de fumos?', opcoes: ['Verdadeiro', 'Falso'], resposta_correta: 1, imagem_url: IMG.mascara },
      { pergunta: 'A quem se deve reportar um quase-acidente?', opcoes: ['A ninguém, não houve ferimentos', 'Ao responsável direto, sempre', 'Só se houver testemunhas', 'Apenas em reunião mensal'], resposta_correta: 1, imagem_url: IMG.primeirosSocorros },
    ],
  },
  'Segurança em Trabalhos de Caldeiraria': {
    duracao_horas: 0.5,
    objetivos: 'No final, o formando deve ser capaz de identificar os riscos específicos do trabalho de corte, conformação e montagem de estruturas metálicas, e aplicar as medidas de proteção corretas.',
    conteudo_programatico: '1. Introdução — riscos específicos da caldeiraria (e sobreposição parcial com os da soldadura). 2. Riscos principais — manuseamento manual de cargas pesadas (chapa, perfis), corte de chapa (guilhotina, oxicorte, plasma), quinagem e calandragem, arestas cortantes e rebarbas, ruído de máquinas (prensas, guilhotinas). 3. EPI — luvas anticorte, calçado de proteção com biqueira de aço, óculos/viseira contra projeções, proteção auditiva junto de equipamento pesado. 4. Segurança em máquinas e equipamentos — resguardos e dispositivos de segurança (nunca remover/desativar), distância de segurança durante operação de guilhotina/prensa, verificação pré-utilização, bloqueio/etiquetagem (LOTO) durante manutenção. 5. Movimentação de cargas — técnicas corretas de levantamento manual, uso de ajuda mecânica (ponte rolante, empilhador), sinalização e comunicação durante movimentação de peças pesadas. 6. Procedimento de emergência — atuação em corte grave, esmagamento ou lesão músculo-esquelética aguda, e a quem reportar. 7. Resumo e pontos-chave.',
    justificativa_afinidade: 'Diretamente relacionada com os riscos específicos da função de caldeireiro — corte, conformação, montagem e movimentação de estruturas metálicas.',
    metodo_avaliacao: 'Questionário de verificação de conhecimentos (8-10 perguntas — EPI ao operar guilhotina, uso de resguardos, bloqueio/etiquetagem LOTO, procedimento em lesão músculo-esquelética)',
    conteudo_estruturado: {
      objetivo: 'Identificar os riscos específicos do trabalho de corte, conformação e montagem de estruturas metálicas, e aplicar as medidas de proteção corretas.',
      seccoes: [
        {
          titulo: 'Introdução',
          imagem_url: IMG.oficina,
          paragrafos: [
            'A caldeiraria envolve manuseamento de cargas pesadas, máquinas de corte e conformação, e arestas cortantes — riscos distintos dos da soldadura, ainda que os dois trabalhos muitas vezes se sobreponham no mesmo posto.',
          ],
        },
        {
          titulo: 'Riscos Principais',
          imagem_url: IMG.guilhotina,
          lista: [
            'Manuseamento manual de cargas pesadas: chapa e perfis metálicos, risco de lesões músculo-esqueléticas.',
            'Corte de chapa (guilhotina, oxicorte, plasma): risco de amputação e projeção de material.',
            'Quinagem e calandragem: risco de esmagamento e entalamento de membros.',
            'Arestas cortantes e rebarbas: cortes durante manuseamento e montagem.',
            'Ruído de máquinas (prensas, guilhotinas): exposição contínua em ambiente fabril.',
          ],
        },
        {
          titulo: 'Equipamento de Proteção Individual (EPI)',
          imagem_url: IMG.epi,
          lista: [
            'Luvas anticorte, adequadas ao tipo de manuseamento.',
            'Calçado de proteção com biqueira de aço.',
            'Óculos ou viseira de proteção contra projeções.',
            'Proteção auditiva junto de equipamento pesado (prensas, guilhotinas).',
          ],
        },
        {
          titulo: 'Segurança em Máquinas e Equipamentos',
          imagem_url: IMG.guilhotina,
          lista: [
            'Nunca remover ou desativar resguardos e dispositivos de segurança das máquinas.',
            'Manter distância de segurança durante a operação de guilhotina ou prensa.',
            'Verificar o equipamento antes de cada utilização (estado dos resguardos, sistemas de paragem de emergência).',
            'Aplicar bloqueio/etiquetagem (LOTO) sempre que houver intervenção de manutenção, mesmo breve.',
          ],
        },
        {
          titulo: 'Movimentação de Cargas',
          imagem_url: IMG.ponteRolante,
          lista: [
            'Usar técnica correta de levantamento manual: dobrar os joelhos, manter as costas direitas, carga próxima do corpo.',
            'Recorrer a ajuda mecânica (ponte rolante, empilhador) sempre que o peso ou dimensão da peça o justifique — não confiar apenas na força manual.',
            'Sinalizar claramente durante a movimentação de peças pesadas, garantindo que todos os presentes estão avisados.',
          ],
        },
        {
          titulo: 'Procedimento de Emergência',
          imagem_url: IMG.primeirosSocorros,
          lista: [
            'Corte grave: aplicar pressão direta para controlar hemorragia e procurar assistência médica imediata.',
            'Esmagamento/entalamento: não tentar libertar a pessoa sozinho se envolver máquina em funcionamento — desligar primeiro.',
            'Lesão músculo-esquelética aguda: não forçar movimento, imobilizar e procurar assistência médica.',
            'Reportar sempre ao responsável direto, mesmo em caso de quase-acidente sem ferimentos.',
          ],
        },
        {
          titulo: 'Resumo',
          paragrafos: [
            'A segurança em caldeiraria assenta em três pilares: nunca contornar dispositivos de segurança das máquinas, usar sempre ajuda mecânica para cargas pesadas, e EPI adequado ao risco de corte e projeção. Reportar sempre incidentes e quase-acidentes.',
          ],
        },
      ],
    },
    formato: 'e-learning',
    nota_minima_aprovacao: 70,
    questionario: [
      { pergunta: 'Qual o EPI obrigatório ao operar uma guilhotina?', opcoes: ['Apenas luvas', 'Luvas anticorte, calçado de proteção e óculos/viseira', 'Nenhum, a máquina já é segura', 'Apenas proteção auditiva'], resposta_correta: 1, imagem_url: IMG.guilhotina },
      { pergunta: 'Porque é que nunca se deve remover um resguardo de segurança de uma máquina?', opcoes: ['Porque é proibido por regulamento interno apenas', 'Porque expõe diretamente o trabalhador ao risco de esmagamento/entalamento', 'Não há problema em removê-lo temporariamente', 'Só é relevante em máquinas antigas'], resposta_correta: 1, imagem_url: IMG.guilhotina },
      { pergunta: 'Quando se deve usar ajuda mecânica em vez de levantamento manual?', opcoes: ['Nunca, é sempre mais rápido à mão', 'Sempre que o peso ou dimensão da peça o justificar', 'Só se houver ponte rolante disponível na hora', 'Apenas para peças acima de 100 kg, nunca abaixo'], resposta_correta: 1, imagem_url: IMG.ponteRolante },
      { pergunta: 'O bloqueio/etiquetagem (LOTO) só é necessário para reparações grandes?', opcoes: ['Verdadeiro', 'Falso — aplica-se a qualquer intervenção, mesmo breve'], resposta_correta: 1, imagem_url: IMG.epi },
      { pergunta: 'Qual o procedimento em caso de lesão músculo-esquelética aguda no posto de trabalho?', opcoes: ['Forçar o movimento para "desentortar"', 'Não forçar, imobilizar e procurar assistência médica', 'Continuar a trabalhar até ao fim do turno', 'Aplicar apenas gelo e ignorar'], resposta_correta: 1, imagem_url: IMG.primeirosSocorros },
    ],
  },
  'EPI para Soldadura': {
    duracao_horas: 1,
    objetivos: 'Garantir que os soldadores conhecem e utilizam corretamente o EPI específico da função.',
    conteudo_programatico: 'Máscara e viseira de soldadura; luvas e avental de proteção; proteção respiratória; regras de uso e manutenção.',
    justificativa_afinidade: 'Diretamente relacionada com os riscos específicos da função de soldador.',
    metodo_avaliacao: 'Avaliação prática de colocação e uso do equipamento',
    formato: 'e-learning',
    nota_minima_aprovacao: 70,
    conteudo_estruturado: {
      objetivo: 'Garantir que os soldadores conhecem e utilizam corretamente o EPI específico da função.',
      seccoes: [
        { titulo: 'Introdução', imagem_url: IMG.epi, paragrafos: ['O EPI é a última linha de defesa contra os riscos da soldadura — radiação, calor, projeções e fumos. Tem de ser adequado ao processo utilizado e usado sempre, sem exceções.'] },
        { titulo: 'Máscara e Viseira', imagem_url: IMG.mascara, lista: [
          'Filtro adequado ao processo utilizado (MIG/MAG, TIG, elétrodo revestido).',
          'Verificar o estado do vidro de proteção antes de cada utilização.',
          'Substituir sempre que estiver riscado, fissurado ou danificado.',
        ]},
        { titulo: 'Luvas e Vestuário', imagem_url: IMG.epi, lista: [
          'Luvas de proteção térmica, resistentes a calor e projeções.',
          'Avental de couro ou roupa ignífuga.',
          'Roupa de manga comprida, sem partes soltas ou inflamáveis.',
        ]},
        { titulo: 'Proteção Respiratória e Auditiva', imagem_url: IMG.oculos, lista: [
          'Proteção respiratória adicional em espaços confinados ou ao soldar materiais especiais (galvanizados, inox).',
          'Proteção auditiva quando o nível de ruído do posto o justificar.',
        ]},
        { titulo: 'Regras de Uso e Manutenção', imagem_url: IMG.epi, lista: [
          'Inspecionar todo o EPI antes de cada utilização.',
          'Substituir de imediato qualquer peça danificada.',
          'Guardar o EPI em local limpo e seco quando não está a ser usado.',
        ]},
        { titulo: 'Resumo', paragrafos: ['O EPI só protege se estiver em bom estado, for o adequado ao processo, e for usado sempre. Reporta qualquer dano ou desgaste ao responsável.'] },
      ],
    },
    questionario: [
      { pergunta: 'Quando deve ser substituído o vidro de proteção da máscara de soldar?', opcoes: ['Nunca precisa de substituição', 'Quando estiver riscado ou danificado', 'Só uma vez por ano, independentemente do estado', 'Só se partir completamente'], resposta_correta: 1, imagem_url: IMG.mascara },
      { pergunta: 'Que tipo de luvas é obrigatório usar na soldadura?', opcoes: ['Luvas de látex finas', 'Luvas de proteção térmica', 'Luvas de jardinagem', 'Não é obrigatório usar luvas'], resposta_correta: 1, imagem_url: IMG.epi },
      { pergunta: 'Quando é necessária proteção respiratória adicional?', opcoes: ['Nunca é necessária', 'Em espaços confinados ou ao soldar materiais especiais (galvanizados/inox)', 'Só se o soldador quiser', 'Só em dias de chuva'], resposta_correta: 1, imagem_url: IMG.oculos },
      { pergunta: 'O EPI deve ser inspecionado antes de cada utilização?', opcoes: ['Verdadeiro', 'Falso'], resposta_correta: 0, imagem_url: IMG.epi },
      { pergunta: 'Onde deve ser guardado o EPI quando não está a ser usado?', opcoes: ['Em qualquer lugar', 'Em local limpo e seco', 'No chão da oficina', 'Não importa'], resposta_correta: 1, imagem_url: IMG.oficina },
    ],
  },
  'Ventilação e Extração de Fumos': {
    duracao_horas: 1,
    objetivos: 'Sensibilizar para os riscos de exposição a fumos de soldadura e o uso correto dos sistemas de extração.',
    conteudo_programatico: 'Riscos para a saúde respiratória; sistemas de extração localizada; boas práticas em espaços confinados.',
    justificativa_afinidade: 'Diretamente relacionada com os riscos específicos da função de soldador/caldeireiro.',
    metodo_avaliacao: 'Questionário de verificação de conhecimentos',
    formato: 'e-learning',
    nota_minima_aprovacao: 70,
    conteudo_estruturado: {
      objetivo: 'Sensibilizar para os riscos de exposição a fumos de soldadura e o uso correto dos sistemas de extração.',
      seccoes: [
        { titulo: 'Introdução', imagem_url: IMG.oficina, paragrafos: ['Os fumos de soldadura contêm partículas metálicas e gases nocivos. A exposição prolongada tem efeitos respiratórios a curto e longo prazo, mesmo quando não há sintomas imediatos.'] },
        { titulo: 'Ventilação Geral vs. Extração Localizada', imagem_url: IMG.oficina, lista: [
          'A ventilação geral do espaço não substitui a extração localizada junto do ponto de soldadura.',
          'A extração localizada capta o fumo diretamente na fonte, antes de se espalhar.',
          'Posicionar-se sempre de forma a que o fluxo de ar afaste o fumo da zona respiratória, nunca o contrário.',
        ]},
        { titulo: 'Sinais de Exposição Excessiva', imagem_url: IMG.primeirosSocorros, lista: [
          'Tonturas.',
          'Irritação nas vias respiratórias.',
          'Dores de cabeça.',
          'Tosse persistente.',
        ]},
        { titulo: 'Boas Práticas', imagem_url: IMG.solda, lista: [
          'Confirmar que o sistema de extração está ligado e a funcionar antes de iniciar o trabalho.',
          'Reportar avarias no sistema de extração de imediato ao responsável.',
          'Usar proteção respiratória adicional em espaços confinados.',
        ]},
        { titulo: 'Resumo', paragrafos: ['Extração eficaz + boa postura face ao fluxo de ar + reporte imediato de avarias — os três pilares para reduzir a exposição a fumos de soldadura.'] },
      ],
    },
    questionario: [
      { pergunta: 'A ventilação geral do espaço é suficiente sozinha para proteger contra fumos de soldadura?', opcoes: ['Verdadeiro', 'Falso — precisa de extração localizada'], resposta_correta: 1, imagem_url: IMG.oficina },
      { pergunta: 'Qual destes é um sinal de exposição excessiva a fumos de soldadura?', opcoes: ['Sensação de fome', 'Tonturas e dores de cabeça', 'Sono profundo à noite', 'Nenhum sintoma existe'], resposta_correta: 1, imagem_url: IMG.primeirosSocorros },
      { pergunta: 'Como te deves posicionar em relação ao fluxo de ar de extração?', opcoes: ['De forma a que o fumo vá para a tua zona respiratória', 'De forma a que o fluxo afaste o fumo da tua zona respiratória', 'Não importa a posição', 'De costas para a peça, sempre'], resposta_correta: 1, imagem_url: IMG.solda },
      { pergunta: 'Deve confirmar-se que o sistema de extração está ligado antes de iniciar o trabalho?', opcoes: ['Verdadeiro', 'Falso'], resposta_correta: 0, imagem_url: IMG.oficina },
      { pergunta: 'O que fazer se detetares uma avaria no sistema de extração?', opcoes: ['Ignorar e continuar a trabalhar', 'Reportar de imediato ao responsável', 'Desligar tudo e não dizer a ninguém', 'Tentar reparar sozinho sem formação'], resposta_correta: 1, imagem_url: IMG.epi },
    ],
  },
  'Trabalhos a Quente': {
    duracao_horas: 2,
    objetivos: 'Capacitar os colaboradores para a execução segura de trabalhos a quente (soldadura, corte, esmerilagem).',
    conteudo_programatico: 'Permissão de trabalho a quente; controlo de fontes de ignição; meios de extinção; vigilância pós-trabalho.',
    justificativa_afinidade: 'Formação obrigatória para colaboradores que executam trabalhos a quente.',
    metodo_avaliacao: 'Questionário de verificação de conhecimentos',
    formato: 'e-learning',
    nota_minima_aprovacao: 70,
    conteudo_estruturado: {
      objetivo: 'Capacitar os colaboradores para a execução segura de trabalhos a quente (soldadura, corte, esmerilagem).',
      seccoes: [
        { titulo: 'Introdução', imagem_url: IMG.solda, paragrafos: ['Trabalhos a quente — soldadura, corte, esmerilagem — geram faíscas e calor que podem iniciar um incêndio, especialmente em locais com materiais inflamáveis próximos ou fora da vista imediata.'] },
        { titulo: 'Permissão de Trabalho (Permit-to-Work)', imagem_url: IMG.oficina, lista: [
          'Obter autorização antes de iniciar, sempre que aplicável no local do cliente/estaleiro.',
          'Identificar os riscos específicos do local antes de começar.',
          'Comunicar ao responsável do cliente/estaleiro antes de iniciar o trabalho.',
        ]},
        { titulo: 'Controlo de Fontes de Ignição', imagem_url: IMG.extintor, lista: [
          'Afastar materiais inflamáveis para uma distância de segurança (mínimo 10 metros, ou conforme procedimento do cliente).',
          'Cobrir ou proteger superfícies e materiais próximos que não possam ser removidos.',
          'Confirmar a ausência de vapores ou gases inflamáveis na zona de trabalho.',
        ]},
        { titulo: 'Meios de Extinção', imagem_url: IMG.extintor, lista: [
          'Confirmar a localização e validade do extintor mais próximo antes de iniciar.',
          'Conhecer o tipo de extintor adequado ao risco específico do local.',
        ]},
        { titulo: 'Vigilância Pós-Trabalho', imagem_url: IMG.primeirosSocorros, lista: [
          'Manter vigilância do local depois de concluído o trabalho, durante um período mínimo (ex: 30 minutos).',
          'Um foco de incêndio pode surgir com atraso — nunca abandonar o local de imediato.',
        ]},
        { titulo: 'Resumo', paragrafos: ['Autorização prévia, controlo de fontes de ignição, extintor à mão, e vigilância depois de terminar — os quatro passos que evitam que um trabalho a quente se transforme num incêndio.'] },
      ],
    },
    questionario: [
      { pergunta: 'O que é obrigatório obter antes de iniciar um trabalho a quente num estaleiro?', opcoes: ['Nada, é só começar', 'Uma permissão de trabalho (permit-to-work)', 'Só avisar um colega informalmente', 'Nada em particular'], resposta_correta: 1, imagem_url: IMG.oficina },
      { pergunta: 'Depois de terminar o trabalho a quente, deve-se:', opcoes: ['Ir embora imediatamente', 'Manter vigilância do local durante um período mínimo (ex: 30 min)', 'Deixar tudo ligado e sair', 'Ignorar o local'], resposta_correta: 1, imagem_url: IMG.extintor },
      { pergunta: 'O que fazer antes de iniciar, em relação a materiais inflamáveis próximos?', opcoes: ['Nada, não é preciso', 'Afastá-los ou protegê-los a uma distância de segurança', 'Aproximá-los para facilitar o trabalho', 'Cobri-los com papel'], resposta_correta: 1, imagem_url: IMG.extintor },
      { pergunta: 'É necessário confirmar a localização do extintor antes de iniciar um trabalho a quente?', opcoes: ['Verdadeiro', 'Falso'], resposta_correta: 0, imagem_url: IMG.extintor },
      { pergunta: 'Um foco de incêndio pode surgir com atraso depois do trabalho terminar?', opcoes: ['Verdadeiro — por isso se mantém vigilância pós-trabalho', 'Falso — o risco desaparece assim que se para de soldar'], resposta_correta: 0, imagem_url: IMG.solda },
    ],
  },
  'Manuseamento de Gases Industriais': {
    duracao_horas: 2,
    objetivos: 'Capacitar os colaboradores no manuseamento seguro de garrafas e gases industriais utilizados na soldadura.',
    conteudo_programatico: 'Identificação de garrafas; transporte e armazenamento; deteção de fugas; procedimento em emergência.',
    justificativa_afinidade: 'Diretamente relacionada com os riscos específicos da função de soldador.',
    metodo_avaliacao: 'Questionário de verificação de conhecimentos',
    formato: 'e-learning',
    nota_minima_aprovacao: 70,
    conteudo_estruturado: {
      objetivo: 'Capacitar os colaboradores no manuseamento seguro de garrafas e gases industriais utilizados na soldadura.',
      seccoes: [
        { titulo: 'Introdução', imagem_url: IMG.gasCilindros, paragrafos: ['Gases como oxigénio, acetileno e árgon são essenciais ao trabalho de soldadura, mas perigosos se mal manuseados — risco de explosão, asfixia e queimaduras.'] },
        { titulo: 'Identificação de Garrafas', imagem_url: IMG.gasCilindros, lista: [
          'Cada gás tem uma cor/código de identificação próprio.',
          'Nunca remover ou trocar etiquetas de identificação.',
          'Confirmar sempre o gás antes de ligar ao equipamento.',
        ]},
        { titulo: 'Transporte e Armazenamento', imagem_url: IMG.gasArmazenamento, lista: [
          'Transportar sempre na vertical e presas/fixas — nunca arrastar ou fazer rolar.',
          'Armazenar em local ventilado, afastado de fontes de calor.',
          'Separar gases incompatíveis (ex: oxigénio afastado de gases combustíveis).',
        ]},
        { titulo: 'Deteção de Fugas', imagem_url: IMG.gasCilindros, lista: [
          'Usar água com sabão para detetar fugas — nunca uma chama.',
          'Sinais de fuga: cheiro característico, som sibilante, formação de gelo na válvula.',
          'Fechar a válvula principal de imediato se detetar uma fuga.',
        ]},
        { titulo: 'Procedimento em Emergência', imagem_url: IMG.primeirosSocorros, lista: [
          'Afastar-te e isolar a área.',
          'Nunca tentar reparar uma fuga sozinho.',
          'Acionar o responsável/emergência de imediato.',
        ]},
        { titulo: 'Resumo', paragrafos: ['Identificar corretamente, transportar na vertical, armazenar separado por incompatibilidade, e nunca usar chama para detetar fugas — regras que previnem os acidentes mais graves com gases industriais.'] },
      ],
    },
    questionario: [
      { pergunta: 'Como se deve transportar uma garrafa de gás?', opcoes: ['Rolando pelo chão', 'Na vertical e presa/fixa', 'Deitada e solta no camião', 'Não importa como'], resposta_correta: 1, imagem_url: IMG.gasArmazenamento },
      { pergunta: 'Como se deteta uma fuga de gás numa garrafa?', opcoes: ['Aproximando uma chama', 'Com água e sabão, procurando bolhas', 'Cheirando muito perto e com força', 'Não é possível detetar'], resposta_correta: 1, imagem_url: IMG.gasCilindros },
      { pergunta: 'Onde devem ser armazenadas as garrafas de oxigénio?', opcoes: ['Junto de garrafas de gases combustíveis', 'Em local ventilado, afastadas de fontes de calor e de gases incompatíveis', 'Dentro do escritório', 'Não importa onde'], resposta_correta: 1, imagem_url: IMG.gasArmazenamento },
      { pergunta: 'Nunca se deve remover ou trocar as etiquetas de identificação das garrafas?', opcoes: ['Verdadeiro', 'Falso'], resposta_correta: 0, imagem_url: IMG.gasCilindros },
      { pergunta: 'Se detetares uma fuga, o que deves fazer primeiro?', opcoes: ['Tentar reparar sozinho', 'Afastar-te, isolar a área e acionar o responsável', 'Continuar a trabalhar normalmente', 'Ignorar se for pequena'], resposta_correta: 1, imagem_url: IMG.primeirosSocorros },
    ],
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
