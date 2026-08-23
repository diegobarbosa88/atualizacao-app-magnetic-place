use strict; use warnings;
# Conversor de neutros Tailwind -> tokens FT/CSS vars.
#
#   perl scripts/converter-neutros.pl <ficheiro> [linhas-icone] [linhas-ink-soft]
#
# As duas listas sao numeros de linha separados por virgula, decididos A MAO
# depois de classificar cada ocorrencia (ver CLAUDE.md, "Durante"):
#   icone    -> --slate      (decorativo; o tom claro serve os dois modos)
#   ink-soft -> --ink-soft   (texto sobre --surface-dim, onde o slate-dim falha)
# Tudo o resto segue o %mapa.
#
# NAO trata o `/NN` que fica orfao a seguir a uma cor convertida — isso e
# `color-mix` e tem de ser limpo a mao; o scripts/verificar-lote-design.sh
# apanha-o. Correr SEMPRE o verificador depois deste.
my ($file, $icones, $inksoft) = @ARGV;
my %ic = map { $_ => 1 } grep { length } split /,/, ($icones // "");
my %is = map { $_ => 1 } grep { length } split /,/, ($inksoft // "");
my %mapa = (
  'text-800'=>'ink', 'text-900'=>'ink', 'text-700'=>'ink-mid', 'text-600'=>'ink-soft', 'text-500'=>'slate-dim',
  'bg-50'=>'surface', 'bg-100'=>'surface-dim', 'bg-200'=>'border', 'bg-300'=>'border',
  # fundo escuro e SUPERFICIE, nunca escala de tinta (ver CLAUDE.md)
  'bg-600'=>'navy-solid', 'bg-700'=>'navy-solid', 'bg-800'=>'navy-solid', 'bg-900'=>'navy-solid',
  'ring-300'=>'border', 'ring-400'=>'slate', 'ring-500'=>'slate', 'border-400'=>'slate',
  'border-50'=>'border-soft', 'border-100'=>'border-soft', 'border-200'=>'border', 'border-300'=>'border',
  'placeholder-300'=>'slate', 'placeholder-400'=>'slate-dim', 'placeholder-500'=>'slate-dim',
  'divide-50'=>'border-soft', 'divide-100'=>'border-soft', 'divide-200'=>'border',
);
open my $in, "<:raw", $file or die "$file: $!";
my @l = <$in>; close $in;
my ($n, $nIc, $nIs) = (0,0,0);
for my $i (0..$#l) {
  my $ln = $i+1;
  $l[$i] =~ s{
    ((?:hover|focus|group-hover|disabled|placeholder|active):)?
    (bg|text|border|divide|ring|placeholder)-slate-(\d{2,3})
  }{
    my ($pfx, $prop, $tom) = ($1 // '', $2, $3);
    my $tok;
    if ($prop eq 'text' && ($tom == 400 || $tom == 300)) {
      if    ($ic{$ln}) { $tok = 'slate';     $nIc++ }
      elsif ($is{$ln}) { $tok = 'ink-soft';  $nIs++ }
      else             { $tok = 'slate-dim' }
    } else { $tok = $mapa{"$prop-$tom"} }
    if (defined $tok) { $n++; "$pfx$prop-[var(--$tok)]" } else { "$pfx$prop-slate-$tom" }
  }gex;
}
open my $out, ">:raw", $file or die; print $out @l; close $out;
printf "  %-28s %3d convertidas  (%d icone, %d ink-soft)\n", ($file =~ s{.*/}{}r), $n, $nIc, $nIs;
