import { useState, useCallback } from 'react';

export function useTocRelatorios({ onDesligado } = {}) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [temMais, setTemMais] = useState(false);

  const carregar = useCallback(async ({ tipo, dataDe, dataAte }) => {
    setLoading(true);
    setErro(null);
    setDocs([]);
    setTemMais(false);
    try {
      const params = new URLSearchParams({ tipo, page: '1' });
      if (dataDe) params.set('data_de', dataDe);
      if (dataAte) params.set('data_ate', dataAte);
      const res = await fetch(`/api/toconline/relatorio?${params}`);
      const data = await res.json();
      if (res.status === 401) { onDesligado?.(); return; }
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar dados');
      const lista = data.data || [];
      setDocs(lista);
      setTemMais(lista.length === 50);
    } catch (e) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }, [onDesligado]);

  return { docs, loading, erro, temMais, carregar };
}
