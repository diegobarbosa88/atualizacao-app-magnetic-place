import { authFetch } from '../../../utils/authFetch';

// A consulta `comunicacoes-pendentes` é um pedido SOAP (obterComunicacoes) ao
// webservice da Segurança Social e devolve sempre o mesmo conjunto global —
// todas as comunicações pendentes da empresa, sem filtro por trabalhador. Quem
// precisa de um trabalhador em concreto filtra do lado do cliente.
//
// Sem cache, cada montagem da lista de Equipa e cada ficha aberta disparavam um
// pedido próprio: 703 chamadas ao Estado num único dia. A cache é de módulo, e
// por isso vive enquanto a página estiver aberta.
const TTL_MS = 5 * 60 * 1000;

let cache = null;   // { em, dados }
let emCurso = null; // promessa partilhada — evita pedidos simultâneos

export function consultarComunicacoesPendentes() {
  if (cache && Date.now() - cache.em < TTL_MS) return Promise.resolve(cache.dados);
  if (emCurso) return emCurso;

  emCurso = authFetch('/api/seguranca-social?action=comunicacoes-pendentes')
    .then(r => r.json())
    .then(dados => {
      cache = { em: Date.now(), dados };
      return dados;
    })
    .finally(() => { emCurso = null; });

  return emCurso;
}

// Chamar depois de comunicar uma admissão/cessação: o que está pendente na SS
// acabou de mudar e a cache ficou desatualizada.
export function invalidarComunicacoesPendentes() {
  cache = null;
}
