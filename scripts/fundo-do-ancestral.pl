use strict; use warnings;
# Determina o fundo do ANCESTRAL de uma linha, usando a indentação para separar
# pai de irmão — em vez de "a linha com background mais próxima para trás", que
# se enganou três vezes (caixa de ícone irmã, <select> seguinte, <iframe> de
# outro ramo do ternário).
sub indent { my $s = shift; $s =~ s/\r?\n$//; $s =~ /^(\s*)/; return length($1) }

sub fundo_do_ancestral {
  my ($l, $i) = @_;
  my $alvo = indent($l->[$i]);
  for my $j (reverse 0 .. $i - 1) {
    my $linha = $l->[$j];
    next if $linha =~ /^\s*$/;              # vazia
    next if $linha =~ m{^\s*\{?\s*/\*};     # comentário JSX
    next if $linha =~ m{^\s*//};            # comentário JS
    my $ind = indent($linha);
    next if $ind >= $alvo;                  # irmão ou descendente
    $alvo = $ind;                           # subiu um nível: este é ancestral
    return "FT.$1 (fixo)"           if $linha =~ /back(?:ground|groundColor): *FT\.(\w+)/;
    return "$1 (fixo)"              if $linha =~ /back(?:ground|groundColor): *'(#[0-9A-Fa-f]{6})'/;
    return "bg-white (inverte)"     if $linha =~ /bg-white/;
    return "bg-slate-$1 (inverte)"  if $linha =~ /bg-slate-(\d+)/;
    return "var(--$1) (inverte)"    if $linha =~ /bg-\[var\(--([a-z-]+)\)\]/;
  }
  return "? (nenhum ancestral com fundo)";
}

# uso:  perl scripts/fundo-do-ancestral.pl <ficheiro> <linha>
#
# Responde "que fundo está por baixo desta linha?" — a pergunta que decide se
# um texto deve usar um token que inverte ou uma constante fixa.
#
# NÃO substitui a medição no browser, que é onde a cascata está resolvida de
# facto; serve para triar candidatos sem ter de renderizar o ecrã, e sobretudo
# para NÃO afirmar o que não sabe: onde não encontra ancestral com fundo,
# devolve "?" em vez de apontar o irmão mais próximo.
my ($ficheiro, $linha) = @ARGV;
die "uso: perl scripts/fundo-do-ancestral.pl <ficheiro> <linha>\n" unless $ficheiro && $linha;
open my $fh, "<:raw", $ficheiro or die "$ficheiro: $!";
my @l = <$fh>; close $fh;
die "linha $linha fora do ficheiro (tem " . scalar(@l) . ")\n" if $linha > @l;
printf "%s:%d\n  texto:  %s\n  fundo:  %s\n",
  $ficheiro, $linha, ($l[$linha-1] =~ s/^\s+|\s+$//gr), fundo_do_ancestral(\@l, $linha - 1);
