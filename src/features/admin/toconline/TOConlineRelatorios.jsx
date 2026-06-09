import React, { useState } from 'react';
import { BarChart2, Download, Loader2, ExternalLink } from 'lucide-react';

const RELATORIOS = [
  { id: 'vendas', label: 'Resumo de Vendas', descricao: 'Totais de faturas emitidas por período', endpoint: '/api/toconline/clientes' },
  { id: 'compras', label: 'Resumo de Compras', descricao: 'Totais de faturas de compra por período', endpoint: '/api/toconline/fornecedores' },
];

export default function TOConlineRelatorios({ onDesligado }) {
  const [tipo, setTipo] = useState('vendas');
  const [dataDe, setDataDe] = useState('');
  const [dataAte, setDataAte] = useState('');
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);

  const handleGerar = async () => {
    setLoading(true);
    setErro(null);
    setDados(null);
    try {
      const params = new URLSearchParams();
      if (dataDe) params.set('data_de', dataDe);
      if (dataAte) params.set('data_ate', dataAte);
      params.set('page', '1');

      const relat = RELATORIOS.find(r => r.id === tipo);
      const res = await fetch(`${relat.endpoint}?${params}`);
      const data = await res.json();
      if (res.status === 401) { onDesligado?.(); return; }
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar dados');
      setDados(data);
    } catch (e) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  };

  const totalValor = dados?.data?.reduce((sum, item) => {
    const v = item.attributes?.total_amount ?? item.attributes?.balance ?? 0;
    return sum + Number(v);
  }, 0);

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
        <p className="text-xs font-black uppercase tracking-widest text-slate-400">Filtros</p>

        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tipo</p>
            <select value={tipo} onChange={e => setTipo(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300">
              {RELATORIOS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Data de</p>
            <input type="date" value={dataDe} onChange={e => setDataDe(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>

          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Data até</p>
            <input type="date" value={dataAte} onChange={e => setDataAte(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>

          <button onClick={handleGerar} disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all disabled:opacity-60 shadow-sm shadow-blue-100">
            {loading ? <Loader2 size={13} className="animate-spin" /> : <BarChart2 size={13} />}
            Gerar
          </button>
        </div>
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-xs text-red-600 font-semibold">{erro}</div>
      )}

      {dados && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="bg-white rounded-2xl border border-slate-100 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Registos</p>
              <p className="text-2xl font-black text-slate-800">{dados.data?.length ?? 0}</p>
            </div>
            {totalValor != null && (
              <div className="bg-white rounded-2xl border border-slate-100 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total</p>
                <p className="text-2xl font-black text-slate-800">{totalValor.toFixed(2)} €</p>
              </div>
            )}
          </div>

          {dados.data?.length > 0 && (
            <div className="overflow-x-auto rounded-2xl border border-slate-100">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Nome</th>
                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">NIF</th>
                    <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {dados.data.map((item) => {
                    const a = item.attributes || {};
                    return (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-800">{a.business_name || a.name || '—'}</td>
                        <td className="px-4 py-3 font-mono text-slate-500">{a.tax_number || '—'}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-700">
                          {a.total_amount != null ? `${Number(a.total_amount).toFixed(2)} €` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
