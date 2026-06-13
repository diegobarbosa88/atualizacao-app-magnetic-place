import { useState } from 'react';

export function useMovUpload({ supabase, onProcessed }) {
  const [ficheiros, setFicheiros] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [erro, setErro] = useState(null);
  const [previewTransacoes, setPreviewTransacoes] = useState(null);
  const [previewFilename, setPreviewFilename] = useState('');
  const [selTransacoes, setSelTransacoes] = useState(new Set());
  const [txSearch, setTxSearch] = useState('');
  const [txTipoFiltro, setTxTipoFiltro] = useState('todos');
  const [csvMapping, setCsvMapping] = useState(null);
  const [colMap, setColMap] = useState({ dataCol: '', valorCol: '', descricaoCol: '', debitoCol: '', creditoCol: '', tipoCol: '', modo: 'valor' });

  const isActive = ficheiros.length > 0 || !!previewTransacoes || !!csvMapping;

  const adicionarFicheiros = (fileList) => {
    setErro(null);
    const validos = [];
    const invalidos = [];
    for (const f of fileList) {
      const ext = f.name.split('.').pop().toLowerCase();
      if (['csv', 'ofx', 'qfx'].includes(ext)) validos.push(f);
      else invalidos.push(f.name);
    }
    if (invalidos.length) setErro(`Formato não suportado: ${invalidos.join(', ')}. Aceites: CSV, OFX, QFX.`);
    if (validos.length) setFicheiros(prev => {
      const existentes = new Set(prev.map(f => f.name));
      return [...prev, ...validos.filter(f => !existentes.has(f.name))];
    });
  };

  const handleDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = () => setDragging(false);
  const handleDrop = (e) => { e.preventDefault(); setDragging(false); adicionarFicheiros(e.dataTransfer.files); };
  const handleFileChange = (e) => { adicionarFicheiros(e.target.files); e.target.value = ''; };

  const previsar = async () => {
    if (!ficheiros.length) return;
    setPreviewing(true);
    setErro(null);
    setCsvMapping(null);
    const allTx = [];
    for (const f of ficheiros) {
      try {
        const fp = new FormData();
        fp.append('file', f);
        const res = await fetch('/api/reconciliacao/parse', { method: 'POST', body: fp });
        const data = await res.json();
        if (!res.ok) { setErro(data.error || 'Erro ao ler ficheiro.'); continue; }
        if (data.needs_mapping) {
          setCsvMapping({ columns: data.columns, preview: data.preview });
          setColMap({ dataCol: '', valorCol: '', descricaoCol: '', debitoCol: '', creditoCol: '', tipoCol: '', modo: 'valor' });
          setPreviewFilename(data.filename || f.name);
          setPreviewing(false);
          return;
        }
        allTx.push(...data.transactions.map(tx => ({ ...tx, _source: f.name })));
      } catch (err) {
        setErro(err.message || 'Erro de rede.');
      }
    }
    if (allTx.length) {
      setPreviewTransacoes(allTx);
      setPreviewFilename(ficheiros.map(f => f.name).join(', '));
      setSelTransacoes(new Set(allTx.map((_, i) => i)));
      setTxSearch('');
      setTxTipoFiltro('todos');
    }
    setFicheiros([]);
    setPreviewing(false);
  };

  const confirmarMapeamento = async () => {
    if (!ficheiros.length) return;
    setPreviewing(true);
    setErro(null);
    try {
      const ficheiroAtual = ficheiros[0];
      const formPayload = new FormData();
      formPayload.append('file', ficheiroAtual);
      formPayload.append('column_mapping', JSON.stringify(colMap));
      const res = await fetch('/api/reconciliacao/parse', { method: 'POST', body: formPayload });
      const data = await res.json();
      if (!res.ok) { setErro(data.error || 'Erro ao ler ficheiro.'); setPreviewing(false); return; }
      const novasTx = data.transactions.map(tx => ({ ...tx, _source: ficheiroAtual.name }));
      setPreviewTransacoes(novasTx);
      setPreviewFilename(ficheiroAtual.name);
      setSelTransacoes(new Set(novasTx.map((_, i) => i)));
      setTxSearch('');
      setTxTipoFiltro('todos');
      setCsvMapping(null);
      setFicheiros(ficheiros.slice(1));
    } catch (err) {
      setErro(err.message || 'Erro de rede.');
    }
    setPreviewing(false);
  };

  const processar = async () => {
    if (!previewTransacoes) return;
    const selected = previewTransacoes.filter((_, i) => selTransacoes.has(i));
    if (!selected.length) { setErro('Seleccione pelo menos um movimento.'); return; }
    setProcessando(true);
    setErro(null);
    try {
      const res = await fetch('/api/reconciliacao/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions_json: selected, filename: previewFilename }),
      });
      const data = await res.json();
      if (!res.ok) { setErro(data.error || 'Erro ao processar.'); return; }
      setPreviewTransacoes(null);
      setFicheiros([]);
      onProcessed(data.run_id);
    } catch (err) {
      setErro(err.message || 'Erro de rede.');
    } finally {
      setProcessando(false);
    }
  };

  const cancelarFicheiros = () => setFicheiros([]);
  const cancelarPreview = () => { setPreviewTransacoes(null); setFicheiros([]); };
  const cancelarMapeamento = () => { setCsvMapping(null); setFicheiros([]); };

  return {
    isActive, dragging, ficheiros, previewing, processando, erro,
    previewTransacoes, previewFilename, selTransacoes, setSelTransacoes,
    txSearch, setTxSearch, txTipoFiltro, setTxTipoFiltro,
    csvMapping, colMap, setColMap,
    handleDragOver, handleDragLeave, handleDrop, handleFileChange,
    previsar, confirmarMapeamento, processar,
    cancelarFicheiros, cancelarPreview, cancelarMapeamento,
  };
}
