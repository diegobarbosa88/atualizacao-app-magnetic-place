import { useState, useMemo } from 'react';
import { getAttrs, getNomeEntidade, getValorTotal, getDocNum } from '../utils/tocUtils';

export function useTableFilters({ docs, tipo }) {
  const [pesquisa, setPesquisa] = useState('');
  const [filtroMes, setFiltroMes] = useState('');
  const [filtroAno, setFiltroAno] = useState('');
  const [filtroEntidade, setFiltroEntidade] = useState('');
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [ordem, setOrdem] = useState({ campo: 'date', dir: 'desc' });

  const anosDisponiveis = useMemo(() => {
    const anos = new Set((docs || []).map(d => (getAttrs(d).date || '').slice(0, 4)).filter(a => a && a.length === 4));
    return [...anos].sort().reverse();
  }, [docs]);

  const entidadesDisponiveis = useMemo(() => {
    return [...new Set((docs || []).map(d => getNomeEntidade(getAttrs(d), tipo)).filter(Boolean))].sort();
  }, [docs, tipo]);

  const toggleOrdem = (campo) => setOrdem(prev =>
    prev.campo === campo ? { campo, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { campo, dir: 'asc' }
  );

  const docsFiltrados = useMemo(() => {
    let lista = [...(docs || [])];
    const q = pesquisa.toLowerCase().trim();
    if (q) lista = lista.filter(d => {
      const a = getAttrs(d);
      const ent = getNomeEntidade(a, tipo).toLowerCase();
      const num = getDocNum(d, a).toLowerCase();
      return ent.includes(q) || num.includes(q);
    });
    if (filtroAno) lista = lista.filter(d => (getAttrs(d).date || '').slice(0, 4) === filtroAno);
    if (filtroMes) lista = lista.filter(d => (getAttrs(d).date || '').slice(5, 7) === filtroMes);
    if (filtroEntidade) lista = lista.filter(d => getNomeEntidade(getAttrs(d), tipo) === filtroEntidade);

    lista.sort((a, b) => {
      const aa = getAttrs(a), ba = getAttrs(b);
      let va, vb;
      if (ordem.campo === 'entidade') { va = getNomeEntidade(aa, tipo); vb = getNomeEntidade(ba, tipo); }
      else if (ordem.campo === 'total') { va = getValorTotal(aa) ?? -1; vb = getValorTotal(ba) ?? -1; }
      else { va = aa.date || ''; vb = ba.date || ''; }
      if (va < vb) return ordem.dir === 'asc' ? -1 : 1;
      if (va > vb) return ordem.dir === 'asc' ? 1 : -1;
      return 0;
    });
    return lista;
  }, [docs, pesquisa, filtroAno, filtroMes, filtroEntidade, ordem, tipo]);

  const filtrosAtivos = pesquisa || filtroMes || filtroAno || filtroEntidade;
  const limparFiltros = () => { setPesquisa(''); setFiltroMes(''); setFiltroAno(''); setFiltroEntidade(''); };

  return {
    pesquisa, setPesquisa,
    filtroMes, setFiltroMes,
    filtroAno, setFiltroAno,
    filtroEntidade, setFiltroEntidade,
    mostrarFiltros, setMostrarFiltros,
    ordem, toggleOrdem,
    anosDisponiveis,
    entidadesDisponiveis,
    docsFiltrados,
    filtrosAtivos,
    limparFiltros,
  };
}
