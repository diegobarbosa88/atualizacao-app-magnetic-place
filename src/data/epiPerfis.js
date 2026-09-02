// Mapa profissão → chaves de EPI (ver epiCatalogo.js), confirmado pelo Diego
// para os postos reais em uso. Correspondência EXATA com workers.profissao
// (sem normalização de maiúsculas/variantes) — uma profissão que não exista
// aqui fica sem nenhum item na checklist, de propósito: mais seguro mostrar
// "nenhum item aplicável" do que inventar uma lista de segurança errada.
// Adicionar aqui sempre que surgir uma profissão nova sem cobertura.
export const EPI_PERFIS = {
  Soldador: [
    'protecao_auricular',
    'oculos',
    'mascara_soldar',
    'mascara_protecao',
    'vestuario_trabalho',
    'avental_manguito_polainas',
    'luvas_protecao',
    'calcado_protecao',
  ],
  Serralheiro: [
    'protecao_auricular',
    'oculos',
    'viseira',
    'mascara_protecao',
    'vestuario_trabalho',
    'avental_manguito_polainas',
    'luvas_protecao',
    'calcado_protecao',
  ],
};

// Devolve os itens do catálogo aplicáveis a uma profissão — [] se a
// profissão não estiver mapeada (ver nota acima, é intencional).
export function getEpiItemsForProfissao(profissao, catalogo) {
  const keys = EPI_PERFIS[profissao] || [];
  return keys
    .map((key) => catalogo.find((item) => item.key === key))
    .filter(Boolean);
}
