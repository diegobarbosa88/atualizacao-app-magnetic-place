/**
 * Fase 3 — Simbologia EN ISO. Cada pergunta destaca no plano o elemento a interpretar.
 * As gargantas de solda vêm da variante, por isso os números das opções mudam de prova para prova.
 */

import { LEVELS } from './levels.js';

const mm1 = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Todas as perguntas possíveis para esta variante */
export function buildPhase3Pool(p) {
  const a1 = p.weldLug;
  const a2 = p.weldGusset;
  const a3 = p.weldRing;
  return [
    {
      id: 'p3-projecao',
      topic: 'Método de projeção',
      norm: 'ISO 5456-2',
      focus: 'projection',
      prompt: 'Que método de projeção usa este plano?',
      options: [
        { id: 'a', label: 'Europeu (1.º diedro): a planta fica por baixo da vista frontal' },
        { id: 'b', label: 'Americano (3.º diedro): a planta fica por cima da vista frontal' },
        { id: 'c', label: 'Perspectiva isométrica' },
        { id: 'd', label: 'Nenhum: as vistas podem ficar em qualquer posição' },
      ],
      correctOptionId: 'a',
      rationale: 'Símbolo do 1.º diedro na legenda e planta desenhada por baixo da vista frontal.',
    },
    {
      id: 'p3-w1',
      topic: 'Filete dos dois lados',
      norm: 'EN ISO 2553',
      focus: 'w1',
      prompt: 'O símbolo de solda entre a chapa do olhal (Pos. 2) e a placa base indica:',
      options: [
        { id: 'a', label: `Solda de ângulo (filete) dos dois lados, com espessura de garganta a = ${a1} mm` },
        { id: 'b', label: `Solda de ângulo dos dois lados, com cateto (perna) de ${a1} mm` },
        { id: 'c', label: `Solda de topo em K com ${a1} mm de penetração` },
        { id: 'd', label: `Solda de ângulo só do lado da seta, com garganta a = ${a1} mm` },
      ],
      correctOptionId: 'a',
      rationale: 'Triângulos dos dois lados da linha de referência = filete nos dois lados. "a" é a garganta; o cateto seria "z".',
    },
    {
      id: 'p3-a-z',
      topic: 'Garganta × cateto',
      norm: 'EN ISO 2553',
      focus: 'w2',
      prompt: `As nervuras levam filete a${a2}. Qual é o cateto (z) aproximado que o soldador deve executar?`,
      options: [
        { id: 'a', label: `≈ ${mm1(a2 * Math.SQRT2)} mm` },
        { id: 'b', label: `${a2} mm` },
        { id: 'c', label: `≈ ${mm1(a2 / Math.SQRT2)} mm` },
        { id: 'd', label: `${a2 * 2} mm` },
      ],
      correctOptionId: 'a',
      rationale: `Filete a 45°: z = a × √2 = ${a2} × 1,41 ≈ ${mm1(a2 * Math.SQRT2)} mm. ${mm1(a2 / Math.SQRT2)} mm é o erro de dividir em vez de multiplicar.`,
    },
    {
      id: 'p3-w3',
      topic: 'Solda do anel',
      norm: 'EN ISO 2553',
      focus: 'w3',
      prompt: 'O símbolo de solda do anel de reforço (Pos. 4) indica:',
      options: [
        { id: 'a', label: `Filete a${a3} do lado da seta, em todo o contorno do anel` },
        { id: 'b', label: `Filete a${a3} do lado oposto à seta, em todo o contorno do anel` },
        { id: 'c', label: `Filete a${a3} executado na montagem em obra` },
        { id: 'd', label: `Pontos de solda a cada ${a3} mm à volta do anel` },
      ],
      correctOptionId: 'a',
      rationale:
        'Triângulo sobre a linha contínua = lado da seta; círculo no cotovelo = todo o contorno. Solda de obra seria uma bandeira.',
    },
    {
      id: 'p3-tracejada',
      topic: 'Linha tracejada',
      norm: 'EN ISO 2553 (sistema A)',
      focus: 'w3',
      prompt: 'Se o triângulo desse símbolo estivesse desenhado do lado da linha tracejada, a solda seria feita:',
      options: [
        { id: 'a', label: 'Do lado oposto à seta' },
        { id: 'b', label: 'Do lado da seta' },
        { id: 'c', label: 'Dos dois lados' },
        { id: 'd', label: 'Só depois da montagem final' },
      ],
      correctOptionId: 'a',
      rationale: 'No sistema A, símbolo na linha contínua = lado da seta; na linha tracejada = lado oposto.',
    },
    {
      id: 'p3-corte',
      topic: 'Linha de corte',
      norm: 'ISO 128',
      focus: 'cut',
      prompt: 'Na vista frontal, a linha A–A com setas indica:',
      options: [
        { id: 'a', label: 'Onde a peça foi cortada para desenhar o corte A–A e de que lado é vista' },
        { id: 'b', label: 'O eixo onde a chapa deve ser dobrada' },
        { id: 'c', label: 'A linha onde a chapa deve ser cortada a plasma' },
        { id: 'd', label: 'O lado da peça que leva solda de topo' },
      ],
      correctOptionId: 'a',
      rationale: 'Plano de corte em traço-ponto, grosso nas pontas; as setas mostram o sentido de observação do corte A–A.',
    },
    {
      id: 'p3-material',
      topic: 'Designação do aço',
      norm: 'EN 10025-2',
      focus: 'material',
      prompt: 'Na lista de peças, o material S355J2+N significa:',
      options: [
        { id: 'a', label: 'Aço estrutural com limite elástico mínimo de 355 MPa, resiliência 27 J a −20 °C, fornecido normalizado' },
        { id: 'b', label: 'Aço inoxidável com 3,55 % de níquel' },
        { id: 'c', label: 'Aço com resistência à tração de 355 MPa e 2 mm de espessura mínima' },
        { id: 'd', label: 'Aço para caldeiras, para trabalhar até 355 °C' },
      ],
      correctOptionId: 'a',
      rationale: 'S = aço estrutural; 355 = limite elástico mín. (MPa); J2 = 27 J a −20 °C; +N = normalizado.',
    },
    {
      id: 'p3-nao-medir',
      topic: 'Nota "não medir"',
      norm: 'Boa prática',
      focus: 'notes',
      prompt: 'A nota 1 diz "Não medir sobre o desenho". Você precisa de uma medida que não está cotada. O que faz?',
      options: [
        { id: 'a', label: 'Calcula a partir das cotas indicadas; se não for possível, consulta o responsável técnico' },
        { id: 'b', label: 'Mede no papel com a régua e multiplica pela escala' },
        { id: 'c', label: 'Copia a medida de uma peça parecida já fabricada' },
        { id: 'd', label: 'Estima pela proporção das vistas' },
      ],
      correctOptionId: 'a',
      rationale: 'Planos impressos ou em PDF deformam a escala. Medidas saem das cotas ou do responsável técnico.',
    },
    // ── avançadas: normas citadas nas notas ──
    {
      id: 'p3-processo',
      topic: 'Processo de soldagem',
      norm: 'EN ISO 4063',
      focus: 'note-process',
      prompt: 'A nota 3 indica o processo 135. Que processo é este?',
      options: [
        { id: 'a', label: 'MAG com fio maciço' },
        { id: 'b', label: 'MAG com fio tubular fluxado' },
        { id: 'c', label: 'TIG' },
        { id: 'd', label: 'Elétrodo revestido' },
      ],
      correctOptionId: 'a',
      rationale: '135 = MAG com fio maciço; 136 = fio fluxado; 141 = TIG; 111 = elétrodo revestido.',
    },
    {
      id: 'p3-qualidade',
      topic: 'Nível de qualidade',
      norm: 'EN ISO 5817',
      focus: 'note-quality',
      prompt: 'A nota 4 pede nível de qualidade EN ISO 5817-C para as soldas. Isto significa:',
      options: [
        { id: 'a', label: 'Nível intermediário: B é o mais exigente e D o menos exigente' },
        { id: 'b', label: 'O nível mais exigente da norma' },
        { id: 'c', label: 'Solda certificada pelo cliente (C de cliente)' },
        { id: 'd', label: 'O nível mínimo, só para soldas provisórias' },
      ],
      correctOptionId: 'a',
      rationale: 'A EN ISO 5817 define os níveis B (exigente), C (intermediário) e D (moderado) para imperfeições de solda.',
    },
    {
      id: 'p3-tolerancias',
      topic: 'Classes de tolerância',
      norm: 'EN ISO 13920',
      focus: 'note-tolerance',
      prompt: 'Na nota 5, "EN ISO 13920-BF" significa:',
      options: [
        { id: 'a', label: 'Classe B para comprimentos e ângulos; classe F para retitude, planeza e paralelismo' },
        { id: 'b', label: 'Classe B para retitude e planeza; classe F para comprimentos' },
        { id: 'c', label: 'Tolerâncias só para as soldas, não para a peça' },
        { id: 'd', label: 'Classe B para a placa base e classe F para as nervuras' },
      ],
      correctOptionId: 'a',
      rationale: 'Primeira letra (A–D): comprimentos e ângulos. Segunda letra (E–H): retitude, planeza e paralelismo.',
    },
    {
      id: 'p3-execucao',
      topic: 'Classe de execução',
      norm: 'EN 1090-2',
      focus: 'note-exc',
      prompt: 'A nota 6 indica "Classe de execução EXC2 (EN 1090-2)". O que define a classe de execução?',
      options: [
        { id: 'a', label: 'O nível de exigência de fabrico, controlo e documentação da estrutura (EXC1 a EXC4)' },
        { id: 'b', label: 'O número de passes de solda de cada junta' },
        { id: 'c', label: 'A classe de resistência do aço' },
        { id: 'd', label: 'A espessura máxima de chapa permitida' },
      ],
      correctOptionId: 'a',
      rationale:
        'A EN 1090-2 tem 4 classes de execução; quanto maior, mais exigentes os requisitos de fabrico, inspeção e rastreabilidade.',
    },
  ];
}

/** Perguntas do nível, pela ordem definida em levels.ts */
export function buildPhase3(p, level) {
  const pool = new Map(buildPhase3Pool(p).map((q) => [q.id, q]));
  return LEVELS[level].phase3.questions.map((id) => {
    const q = pool.get(id);
    if (!q) throw new Error(`Pergunta da Fase 3 desconhecida: ${id}`);
    return q;
  });
}
