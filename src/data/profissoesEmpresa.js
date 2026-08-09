// Profissões reais da empresa, mapeadas para os códigos CPP 2010.
// Para adicionar novas funções basta acrescentar entradas a este array —
// nenhum componente precisa de ser alterado.

export const PROFISSOES_EMPRESA = [
  { rotulo: 'Soldador',    codigoCPP: '72121', designacaoModal: 'Soldador / Oxicortador' },
  { rotulo: 'Serralheiro', codigoCPP: '72141', designacaoModal: 'Serralheiro Civil / Montador de Estruturas Metálicas' },
  { rotulo: 'Tubista',     codigoCPP: '71262', designacaoModal: 'Montador de Tubagens' },
  // Exemplos de funções a adicionar futuramente:
  // { rotulo: 'Caldeireiro',         codigoCPP: '72111', designacaoModal: 'Caldeireiro / Serralheiro Industrial' },
  // { rotulo: 'Montador Mecânico',   codigoCPP: '72201', designacaoModal: 'Mecânico de Máquinas Industriais / Montador' },
  // { rotulo: 'Pintor Industrial',   codigoCPP: '71411', designacaoModal: 'Pintor de Construção Civil / Industrial' },
  // { rotulo: 'Eletricista',         codigoCPP: '72411', designacaoModal: 'Eletricista de Instalações' },
  // { rotulo: 'Encarregado',         codigoCPP: '31231', designacaoModal: 'Técnico de Engenharia Mecânica / Encarregado' },
];

/** Devolve a entrada completa a partir do código CPP, ou null se não encontrar. */
export function findProfissaoByCodigo(codigoCPP) {
  if (!codigoCPP) return null;
  return PROFISSOES_EMPRESA.find(p => p.codigoCPP === codigoCPP) || null;
}
