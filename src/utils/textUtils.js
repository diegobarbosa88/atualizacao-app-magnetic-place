/**
 * Converte uma string para sentence case (só a primeira letra maiúscula).
 * @param {string} str
 * @returns {string}
 */
export const toSentenceCase = (str) => {
  if (!str) return str;
  const lower = str.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
};

/**
 * Converte o nome-base de um ficheiro para sentence case, mantendo a extensão inalterada.
 * @param {string} name
 * @returns {string}
 */
export const toSentenceCaseFilename = (name) => {
  if (!name) return name;
  const m = name.match(/^(.*)(\.[a-zA-Z0-9]+)$/);
  const base = m ? m[1] : name;
  const ext = m ? m[2] : '';
  return toSentenceCase(base) + ext;
};

// Partículas que ficam em minúscula no meio de um nome português/espanhol
// ("Adriel de Jesus dos Santos"). Nunca se aplicam à primeira palavra.
const PARTICULAS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'del', 'della', 'di', 'du',
  'e', 'y', 'la', 'las', 'le', 'les', 'los', 'van', 'von', 'der', 'den', 'bin', 'ibn',
]);

// Siglas e formas jurídicas que têm de manter a caixa própria em nomes de
// empresa — um title case ingénuo transformaria "AYG" em "Ayg".
const SIGLAS = new Set([
  'SA', 'S.A.', 'SL', 'S.L.', 'SLU', 'LDA', 'LTDA', 'SARL', 'SAS', 'SPA', 'GMBH',
  'BV', 'NV', 'PLC', 'INC', 'LLC', 'AG', 'KG', 'OY', 'AB', 'AS', 'IT', 'TI',
]);

const capitalizarToken = (token) => {
  // Preserva separadores internos: "ana-maria" → "Ana-Maria", "d'almeida" → "D'Almeida"
  return token.replace(/[^\s\-'’.]+/g, (parte) =>
    parte.charAt(0).toLocaleUpperCase('pt') + parte.slice(1)
  );
};

/**
 * Normaliza a caixa de um nome de pessoa, respeitando as partículas
 * portuguesas. Trata apenas de CAIXA e espaços — nunca altera as letras em si,
 * por isso não inventa acentos nem cedilhas em falta (ex.: "GONcALVES"
 * continua "Goncalves", para ser corrigido à mão por quem sabe o nome real).
 *
 * @param {string} nome
 * @returns {string}
 * @example formatPersonName('ADRIEL DE JESUS DOS SANTOS') // 'Adriel de Jesus dos Santos'
 * @example formatPersonName('josE fRANCISCO gONÇALVES')   // 'José Francisco Gonçalves'
 */
export const formatPersonName = (nome) => {
  if (!nome || typeof nome !== 'string') return nome;
  const limpo = nome.trim().replace(/\s+/g, ' ');
  if (!limpo) return limpo;

  return limpo
    .toLocaleLowerCase('pt')
    .split(' ')
    .map((palavra, i) =>
      i > 0 && PARTICULAS.has(palavra) ? palavra : capitalizarToken(palavra)
    )
    .join(' ');
};

/**
 * Igual ao formatPersonName, mas preserva siglas e formas jurídicas
 * ("A&G Steel Building S.L.", "AYG"). Uma palavra que venha toda em maiúsculas
 * e não tenha vogais minúsculas possíveis — ou que esteja na lista de siglas —
 * mantém-se como está.
 *
 * @param {string} nome
 * @returns {string}
 * @example formatOrgName('GRANDES MECANIZADOS DEL NORTE,S .A.') // 'Grandes Mecanizados del Norte, S.A.'
 */
export const formatOrgName = (nome) => {
  if (!nome || typeof nome !== 'string') return nome;
  const limpo = nome
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s+\./g, '.'); // "S .A." → "S.A."
  if (!limpo) return limpo;

  return limpo
    .split(' ')
    .map((palavra, i) => {
      const semPontuacao = palavra.replace(/[.,]/g, '');
      const minuscula = palavra.toLocaleLowerCase('pt');

      // Partícula antes da heurística de siglas, senão o "y"/"e" de
      // "Calcosa Caldereria y Construccion" seria lido como sigla.
      if (i > 0 && PARTICULAS.has(semPontuacao.toLocaleLowerCase('pt'))) return minuscula;

      // Sigla conhecida, ou token curto sem vogais depois da inicial ("AYG", "A&G", "JCB")
      if (SIGLAS.has(semPontuacao.toUpperCase())) return palavra.toUpperCase();
      if (palavra.length <= 4 && !/[AEIOU]/i.test(semPontuacao.replace(/[^A-Za-z]/g, '').slice(1))) {
        return palavra.toUpperCase();
      }

      return capitalizarToken(minuscula);
    })
    .join(' ');
};

/**
 * Devolve as iniciais (até 2 letras) de um nome, para avatares circulares.
 * @param {string} name
 * @returns {string}
 */
export const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.length === 1
    ? parts[0][0].toUpperCase()
    : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};
