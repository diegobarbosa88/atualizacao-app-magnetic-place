// Extração do valor de ajuda de custo declarado manualmente na observação
// de uma fatura TOConline. Extraído de percentagemHistorica.js para um
// módulo neutro, sem dependências — é usado tanto por
// percentagemHistorica.js (extrairValoresDeObservacoesExistentes,
// re-exportado de lá por compatibilidade) como por valoresPorFatura.js
// (calcularValoresPorClienteMes), e um ficheiro não pode depender do outro
// sem criar um import circular.
//
// Idêntico a extrairValorObs em AjudasCalculadora.jsx — nunca duplicar esta
// regex numa terceira cópia; se precisar de mudar, muda aqui.

function _parseMonetario(s) {
  s = (s || '').replace(/\s/g, '');
  if (!s) return null;
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) {
    const dec = Math.max(lastDot, lastComma);
    s = s.slice(0, dec).replace(/[.,]/g, '') + '.' + s.slice(dec + 1);
  } else if (lastComma >= 0) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if ((s.match(/\./g) || []).length > 1) {
    // Dois ou mais pontos e nenhuma vírgula: normalmente um inteiro com
    // milhares separados por ponto (ex. "1.234.567"). Mas se o último
    // grupo tiver exatamente 2 dígitos (ex. "13.815.05"), é quase de
    // certeza um erro de digitação — ponto usado como decimal em vez de
    // vírgula — e não um valor ~100x maior; nesse caso o último ponto
    // passa a decimal, os anteriores continuam a separar milhares.
    const lastDotIdx = s.lastIndexOf('.');
    const decimais = s.slice(lastDotIdx + 1);
    if (decimais.length === 2) {
      s = s.slice(0, lastDotIdx).replace(/\./g, '') + '.' + decimais;
    } else {
      s = s.replace(/\./g, '');
    }
  }
  const v = parseFloat(s);
  return isNaN(v) || v <= 0 ? null : v;
}

// Padrão de número monetário em texto livre: separador de milhares pode ser
// ESPAÇO ou PONTO (ex. "21 248,50" / "21.248,50"), separador decimal é
// vírgula (tratado em _parseMonetario, que também aceita ponto decimal
// quando não há vírgula nenhuma, ex. "224.00"). O espaço só é absorvido
// para dentro do número quando imediatamente seguido de outro dígito
// (lookahead) — nunca consome o espaço a seguir ao valor, antes do resto
// da frase (ex. "€224,00 referentes..." não inclui esse espaço final).
// Risco aceite (sem ocorrência nos dados reais auditados): um valor logo
// seguido de outro número solto na mesma frase pode fundir-se num só.
const NUM_RE = /\d(?:[\d.,]|\s(?=\d))*\d|\d/;

// Extrai o valor monetário de um texto livre.
// Prioriza o padrão "€X.XXX,XX" (formato das notas TOConline).
export function extrairValorObs(obs) {
  if (!obs) return null;
  const str = String(obs);
  const mEuro = str.match(new RegExp('€\\s*(' + NUM_RE.source + ')'));
  if (mEuro) return _parseMonetario(mEuro[1]);
  const m = str.match(NUM_RE);
  if (!m) return null;
  return _parseMonetario(m[0]);
}
