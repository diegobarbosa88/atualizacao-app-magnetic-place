#!/bin/sh
# Testes do próprio verificador (scripts/verificar-lote-design.sh).
#
# Existe porque, ao longo desta migração, o INSTRUMENTO enganou três vezes —
# mais do que o código enganou. Cada caso abaixo corresponde a um erro real:
#
#   1-2  `/NN` sobre var() é color-mix e conta; sobre classe Tailwind é
#        legítimo e não conta. O conversor deixou `/NN` órfãos em dois lotes.
#   3-4  tinta usada como fundo conta; `--slate` como fundo NÃO conta, porque
#        é o único da escala que não inverte (deu falso positivo na v1).
#   5-6  laranja+branco tem de ser apanhado mesmo com o `backgroundColor` numa
#        LINHA DIFERENTE do `text-white` — a v1 procurava na mesma linha e
#        dizia 0 quando havia 34.
#   7    laranja+navy é o par correcto e não pode ser acusado.
#
# Correr a partir da raiz do repo:  sh scripts/testar-verificador.sh

set -e
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/src/features/admin" "$TMP/src/components/admin"
ALVO="$TMP/src/features/admin/Caso.jsx"

falhas=0
verifica() {
  nome="$1"; esperado="$2"; obtido="$3"
  if [ "$esperado" = "$obtido" ]; then
    printf '  ok    %-52s %s\n' "$nome" "$obtido"
  else
    printf '  FALHA %-52s esperado=%s obtido=%s\n' "$nome" "$esperado" "$obtido"
    falhas=$((falhas + 1))
  fi
}

conta() {   # conta(<rótulo do printf no script>)
  sh scripts/verificar-lote-design.sh "$TMP/src/features/admin" 2>/dev/null \
    | grep -F "$1" | sed 's/.* //'
}

# ── 1 e 2: opacidade
printf '<div className="bg-[var(--surface)]/60" />\n' > "$ALVO"
verifica "/NN sobre var() é acusado"            1 "$(conta '/NN sobre var()')"
printf '<div className="bg-slate-50/60" />\n' > "$ALVO"
verifica "/NN sobre classe Tailwind não acusa"  0 "$(conta '/NN sobre var()')"

# ── 3 e 4: tinta como fundo (a verificação corre sempre sobre o repo real,
#    por isso aqui só se confirma que o alvo do teste não a dispara)
printf '<div className="bg-[var(--ink)]" />\n' > "$ALVO"
tinta_antes=$(sh scripts/verificar-lote-design.sh src/features/admin 2>/dev/null | grep -F 'tinta usada como fundo' | sed 's/.* //')
verifica "tinta como fundo: repo real está a zero" 0 "$tinta_antes"
printf '<div className="hover:bg-[var(--slate)]" />\n' > "$ALVO"
verifica "--slate como fundo não é falso positivo" 0 "$(conta 'tinta usada como fundo')"

# ── 5, 6 e 7: laranja com texto branco.
#    Estas correm sobre src/features/admin real (a verificação é global), por
#    isso comparam-se DELTAS: escreve-se o caso num ficheiro dentro do repo,
#    mede-se, e apaga-se.
base=$(sh scripts/verificar-lote-design.sh src/features/admin 2>/dev/null | grep -F 'laranja com texto branco' | sed 's/.* //')
CASO=src/features/admin/__teste_verificador__.jsx

printf '<button className="text-white" style={{ backgroundColor: FT.orange }} />\n' > "$CASO"
d=$(sh scripts/verificar-lote-design.sh src/features/admin 2>/dev/null | grep -F 'laranja com texto branco' | sed 's/.* //')
verifica "laranja+branco na MESMA linha" $((base + 1)) "$d"

printf '<button\n  className="px-3 text-white"\n  style={{ backgroundColor: FT.orange }}\n/>\n' > "$CASO"
d=$(sh scripts/verificar-lote-design.sh src/features/admin 2>/dev/null | grep -F 'laranja com texto branco' | sed 's/.* //')
verifica "laranja+branco em linhas SEPARADAS" $((base + 1)) "$d"

printf '<button\n  className="px-3 text-[var(--navy-solid)]"\n  style={{ backgroundColor: FT.orange }}\n/>\n' > "$CASO"
d=$(sh scripts/verificar-lote-design.sh src/features/admin 2>/dev/null | grep -F 'laranja com texto branco' | sed 's/.* //')
verifica "laranja+navy (par correcto) não acusa" "$base" "$d"

rm -f "$CASO"

echo
if [ "$falhas" -eq 0 ]; then
  echo "  todos os casos passaram"
else
  echo "  $falhas caso(s) a falhar — o verificador não é de confiança até isto estar a zero"
  exit 1
fi
