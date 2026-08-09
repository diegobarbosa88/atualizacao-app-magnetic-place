// Profissões reais da empresa, mapeadas para os códigos CPP 2010.
// Para adicionar novas funções basta acrescentar entradas a este array —
// nenhum componente precisa de ser alterado.
// O campo `grupo` é usado pelo SelectProfissaoEmpresa para agrupar as opções.

export const PROFISSOES_EMPRESA = [
  // --- Produção / Obra ---
  { rotulo: 'Soldador',                        codigoCPP: '72121', designacaoModal: 'Soldador / Oxicortador',                                                     grupo: 'Produção / Obra' },
  { rotulo: 'Serralheiro',                     codigoCPP: '72141', designacaoModal: 'Serralheiro Civil / Montador de Estruturas Metálicas',                       grupo: 'Produção / Obra' },
  { rotulo: 'Montador de Estruturas Metálicas',codigoCPP: '72142', designacaoModal: 'Outro Preparador e Montador de Estruturas Metálicas',                        grupo: 'Produção / Obra' },
  { rotulo: 'Tubista',                         codigoCPP: '71262', designacaoModal: 'Montador de Tubagens',                                                       grupo: 'Produção / Obra' },
  { rotulo: 'Caldeireiro',                     codigoCPP: '72132', designacaoModal: 'Funileiro e Caldeireiro',                                                    grupo: 'Produção / Obra' },
  { rotulo: 'Montador de Andaimes',            codigoCPP: '71191', designacaoModal: 'Montador de Andaimes',                                                       grupo: 'Produção / Obra' },
  { rotulo: 'Mecânico Industrial',             codigoCPP: '72330', designacaoModal: 'Mecânico e Reparador de Máquinas Agrícolas e Industriais',                   grupo: 'Produção / Obra' },
  { rotulo: 'Pintor Industrial',               codigoCPP: '71321', designacaoModal: 'Pintor à Pistola de Superfícies',                                            grupo: 'Produção / Obra' },
  { rotulo: 'Eletricista Industrial',          codigoCPP: '74124', designacaoModal: 'Eletromecânico, Eletricista e Outros Instaladores de Máquinas e Equipamentos Elétricos', grupo: 'Produção / Obra' },

  // --- Administrativo / Gestão ---
  { rotulo: 'Gerente / Diretor Geral',         codigoCPP: '11200', designacaoModal: 'Diretor Geral e Gestor Executivo, de Empresas',                              grupo: 'Administrativo / Gestão' },
  { rotulo: 'Técnico de Recursos Humanos',     codigoCPP: '24230', designacaoModal: 'Especialista em Recursos Humanos',                                           grupo: 'Administrativo / Gestão' },
  { rotulo: 'Contabilista',                    codigoCPP: '24110', designacaoModal: 'Contabilista, Auditor, Revisor Oficial de Contas e Similares',               grupo: 'Administrativo / Gestão' },
  { rotulo: 'Assistente Administrativo',       codigoCPP: '41100', designacaoModal: 'Empregado de Escritório em Geral',                                           grupo: 'Administrativo / Gestão' },
  { rotulo: 'Secretário Administrativo',       codigoCPP: '33430', designacaoModal: 'Secretário Administrativo e Executivo',                                      grupo: 'Administrativo / Gestão' },
  { rotulo: 'Encarregado de Armazém',          codigoCPP: '43212', designacaoModal: 'Empregado de Armazém',                                                       grupo: 'Administrativo / Gestão' },
];

/** Devolve a entrada completa a partir do código CPP, ou null se não encontrar. */
export function findProfissaoByCodigo(codigoCPP) {
  if (!codigoCPP) return null;
  return PROFISSOES_EMPRESA.find(p => p.codigoCPP === codigoCPP) || null;
}

/** Grupos únicos, pela ordem em que aparecem na lista. */
export const GRUPOS_PROFISSOES = [...new Set(PROFISSOES_EMPRESA.map(p => p.grupo))];
