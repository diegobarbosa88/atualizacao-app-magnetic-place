#!/bin/sh
# Verificações de fim de lote da migração de neutros do painel admin para os
# tokens da identidade (src/styles/designTokens.js + variáveis em index.css).
#
#   sh scripts/verificar-lote-design.sh src/features/admin/<modulo>
#
# As duas primeiras linhas dizem se o LOTE ficou completo; as duas seguintes
# são regressões globais e devem estar a zero SEMPRE, mesmo em lotes que não
# tocaram nessas zonas — foi assim que se apanhou o defeito dos botões laranja
# com texto branco, que nenhum grep dirigido ao lote teria encontrado.
#
# Correr a partir da raiz do repo.

if [ $# -eq 0 ]; then
  echo "uso: sh scripts/verificar-lote-design.sh <dir-ou-ficheiro>..." >&2
  exit 2
fi

echo "── lote: $* ──"

# slate-* que sobrou por converter dentro do alvo
printf '%-46s %s\n' "slate-* por converter no alvo:" \
  "$(grep -rhoE 'slate-[0-9]{2,3}' "$@" --include=*.jsx 2>/dev/null | wc -l)"

# `/NN` sobre var() compila para color-mix(); o fallback em browsers antigos é
# a cor a 100%, o que transforma um fundo subtil num bloco sólido.
printf '%-46s %s\n' "/NN sobre var() (color-mix):" \
  "$(grep -rhoE 'var\(--[a-z-]+\)\]/[0-9]+' "$@" --include=*.jsx 2>/dev/null | wc -l)"

echo "── regressões globais (admin inteiro) ──"

# Texto branco sobre o laranja da marca dá 2,52:1. O par correcto é navy
# sobre laranja, 4,66:1.
printf '%-46s %s\n' "laranja com texto branco:" \
  "$(grep -rn 'text-white' src/features/admin src/components/admin --include=*.jsx 2>/dev/null \
     | grep -cE 'FT\.orange|#EB8D00|var\(--orange\)')"

# Botão de acção primária ainda em indigo do template do Vite. Exclui os
# hovers e os ternários de selecção, que não são botões.
printf '%-46s %s\n' "indigo-600 em botão (não convertido):" \
  "$(grep -rn 'bg-indigo-600' src/features/admin src/components/admin --include=*.jsx 2>/dev/null \
     | grep -v 'hover:bg-indigo-600' \
     | grep -vcE "\? *'bg-indigo-600|sel *\?|selecionado *\?" || true)"

echo "── terminadores de linha ──"
# Um sed distraído converte CRLF em LF e gera um diff de ruído que esconde a
# mudança real. O que interessa é não haver ficheiros MISTOS.
for alvo in "$@"; do
  find "$alvo" -name '*.jsx' 2>/dev/null | while read -r ff; do
    cr=$(perl -ne '$c++ if /\r\n$/; END{print $c+0}' < "$ff")
    n=$(perl -ne '$c++; END{print $c+0}' < "$ff")
    # Tolera 1 linha sem CRLF: é a última, em ficheiros que não terminam em
    # newline. Isso não é terminadores misturados, e reportá-lo só gera ruído.
    if [ "$cr" -ne 0 ] && [ "$cr" -lt $((n - 1)) ]; then
      echo "  MISTO: $ff ($cr de $n linhas em CRLF)"
    fi
  done
done
echo "  (sem linhas MISTO acima = nenhum ficheiro com terminadores misturados)"

cat <<'NOTA'
── verificação de contraste (no browser, não aqui) ──
  Correr o varrimento sobre TODO o texto visível do ecrã e separar assim:
    cor em rgb()   -> token já convertido; se estiver abaixo de 4,5:1 é do lote
    cor em oklch() -> Tailwind ainda por converter; é ruído de fundo
  O Tailwind v4 serve as suas paletas em oklch() e as variáveis CSS resolvem
  para rgb(), por isso o filtro separa o trabalho do lote do que falta fazer.
NOTA
