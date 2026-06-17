import { useState, useCallback, useEffect } from 'react';

export function useTocPaginatedList({ endpoint, onDesligado }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [pesquisa, setPesquisa] = useState('');
  const [pagina, setPagina] = useState(1);
  const [meta, setMeta] = useState({});

  const carregar = useCallback(async (q = pesquisa, pg = pagina) => {
    setLoading(true);
    setErro(null);
    try {
      const params = new URLSearchParams({ page: pg });
      if (q) params.set('q', q);
      const res = await fetch(`${endpoint}?${params}`);
      const data = await res.json();
      if (res.status === 401) { onDesligado?.(); return; }
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
      setItems(data.data || []);
      setMeta(data.meta || {});
    } catch (e) {
      setErro(e.message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [endpoint, pesquisa, pagina, onDesligado]);

  useEffect(() => { carregar(); }, []);

  const handlePesquisa = (v) => {
    setPesquisa(v);
    setPagina(1);
    carregar(v, 1);
  };

  const prependItem = (item) => setItems(prev => [item, ...prev]);

  return {
    items, loading, erro, meta,
    pesquisa, handlePesquisa,
    pagina, setPagina,
    carregar, prependItem,
  };
}
