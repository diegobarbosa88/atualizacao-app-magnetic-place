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
