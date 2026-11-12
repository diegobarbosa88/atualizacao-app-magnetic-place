/**
 * Avaliador de expressões da calculadora da prova (sem eval).
 * Suporta: + − × ÷ ( ) √ ² π, vírgula ou ponto decimal e multiplicação implícita (2π, 2(3+1)).
 */

function tokenize(src) {
  const tokens = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === ' ') {
      i++;
      continue;
    }
    if (/[\d.,]/.test(c)) {
      let j = i;
      while (j < src.length && /[\d.,]/.test(src[j])) j++;
      const text = src.slice(i, j).replace(',', '.');
      if ((text.match(/\./g) ?? []).length > 1 || text === '.') return null;
      tokens.push({ t: 'num', v: Number(text) });
      i = j;
      continue;
    }
    if (c === '+') tokens.push({ t: 'op', v: '+' });
    else if (c === '-' || c === '−') tokens.push({ t: 'op', v: '-' });
    else if (c === '*' || c === '×') tokens.push({ t: 'op', v: '*' });
    else if (c === '/' || c === '÷') tokens.push({ t: 'op', v: '/' });
    else if (c === '(') tokens.push({ t: 'lp' });
    else if (c === ')') tokens.push({ t: 'rp' });
    else if (c === '√') tokens.push({ t: 'sqrt' });
    else if (c === '²') tokens.push({ t: 'sq' });
    else if (c === 'π') tokens.push({ t: 'pi' });
    else return null;
    i++;
  }
  return tokens;
}

export function evaluateExpression(src) {
  const parsed = tokenize(src);
  if (!parsed || parsed.length === 0) return null;
  const tokens = parsed;
  let pos = 0;

  const peek = () => tokens[pos];
  const startsPrimary = (tk) => !!tk && (tk.t === 'num' || tk.t === 'pi' || tk.t === 'lp' || tk.t === 'sqrt');

  function expr() {
    let v = term();
    for (let tk = peek(); tk && tk.t === 'op' && (tk.v === '+' || tk.v === '-'); tk = peek()) {
      pos++;
      v = tk.v === '+' ? v + term() : v - term();
    }
    return v;
  }

  function term() {
    let v = unary();
    for (;;) {
      const tk = peek();
      if (tk && tk.t === 'op' && (tk.v === '*' || tk.v === '/')) {
        pos++;
        v = tk.v === '*' ? v * unary() : v / unary();
      } else if (startsPrimary(tk)) {
        v *= unary(); // multiplicação implícita
      } else return v;
    }
  }

  function unary() {
    const tk = peek();
    if (tk && tk.t === 'op' && tk.v === '-') {
      pos++;
      return -unary();
    }
    if (tk && tk.t === 'op' && tk.v === '+') {
      pos++;
      return unary();
    }
    let v = primary();
    while (peek()?.t === 'sq') {
      pos++;
      v *= v;
    }
    return v;
  }

  function primary() {
    const tk = tokens[pos++];
    if (!tk) throw new Error('fim inesperado');
    if (tk.t === 'num') return tk.v;
    if (tk.t === 'pi') return Math.PI;
    if (tk.t === 'sqrt') {
      const v = unary();
      if (v < 0) throw new Error('raiz negativa');
      return Math.sqrt(v);
    }
    if (tk.t === 'lp') {
      const v = expr();
      if (tokens[pos]?.t === 'rp') pos++; // tolera parêntese final em falta
      return v;
    }
    throw new Error('token inesperado');
  }

  try {
    const value = expr();
    if (pos !== tokens.length) return null;
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}
