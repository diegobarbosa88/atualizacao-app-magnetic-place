import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FileText, Users, BarChart2, Link2, Plus, Loader2, Zap, Landmark, TrendingUp } from 'lucide-react';
import TOConlinePanel from './faturas/TOConlinePanel';
import TOConlineClientes from './toconline/TOConlineClientes';
import TOConlineRelatorios from './toconline/TOConlineRelatorios';
import TOConlineBankAccounts from './toconline/TOConlineBankAccounts';
import CriarDocumentoModal from './toconline/CriarDocumentoModal';
import FaturarClienteModal from './toconline/FaturarClienteModal';

const TABS = [
  { id: 'documentos', label: 'Documentos', icon: FileText },
  { id: 'clientes', label: 'Clientes', icon: Users },
  { id: 'relatorios', label: 'Relatórios', icon: BarChart2 },
  { id: 'contas', label: 'Contas Bancárias', icon: Landmark },
];

export default function TOConlineAdmin() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const subtab = params.get('subtab') || 'documentos';

  const [ligado, setLigado] = useState(false);
  const [verificando, setVerificando] = useState(true);
  const [mostrarCriar, setMostrarCriar] = useState(false);
  const [mostrarFaturar, setMostrarFaturar] = useState(false);
  const [saldoContas, setSaldoContas] = useState(null);
  const [saldoLoading, setSaldoLoading] = useState(false);

  const carregarSaldo = useCallback(async () => {
    setSaldoLoading(true);
    try {
      const res = await fetch('/api/toconline/bank-accounts');
      const data = await res.json();
      if (!res.ok) { setSaldoContas(null); return; }
      const lista = data.data || [];
      const total = lista.reduce((s, c) => {
        const a = c.attributes || c;
        return s + (Number(a.current_balance ?? a.initial_balance ?? a.balance ?? 0) || 0);
      }, 0);
      setSaldoContas({ total, n: lista.length });
    } catch {
      setSaldoContas(null);
    } finally {
      setSaldoLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch('/api/toconline/status')
      .then(r => r.json())
      .then(d => {
        const ok = !!d.ligado;
        setLigado(ok);
        if (ok) carregarSaldo();
      })
      .catch(() => setLigado(false))
      .finally(() => setVerificando(false));
  }, [carregarSaldo]);

  const setSubtab = (id) => navigate(`/admin/toconline?subtab=${id}`);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {verificando ? (
            <Loader2 size={14} className="text-slate-300 animate-spin" />
          ) : (
            <div className={`w-2.5 h-2.5 rounded-full ${ligado ? 'bg-emerald-500' : 'bg-slate-300'}`} />
          )}
          <div>
            <h1 className="text-lg font-black text-slate-800">TOConline</h1>
            <p className="text-xs text-slate-400">
              {verificando ? 'A verificar...' : ligado ? 'Ligado e operacional' : 'Não autenticado'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Card de saldo */}
          {ligado && (
            <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-2.5">
              {saldoLoading ? (
                <Loader2 size={13} className="text-emerald-400 animate-spin" />
              ) : (
                <TrendingUp size={14} className="text-emerald-500 shrink-0" />
              )}
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-emerald-400">Saldo Contas</p>
                <p className="text-sm font-black text-emerald-700">
                  {saldoContas != null
                    ? new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(saldoContas.total)
                    : '—'}
                </p>
              </div>
              {saldoContas && (
                <span className="text-[9px] text-emerald-400 font-semibold self-end pb-0.5">
                  {saldoContas.n} conta{saldoContas.n !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}
          {!verificando && ligado && (
            <div className="flex gap-2">
              <button onClick={() => setMostrarFaturar(true)}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-md shadow-emerald-100">
                <Zap size={14} /> Faturar Cliente
              </button>
              <button onClick={() => setMostrarCriar(true)}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-md shadow-blue-100">
                <Plus size={14} /> Criar Documento
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-1 border-b border-slate-100 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setSubtab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-black uppercase tracking-widest whitespace-nowrap border-b-2 transition-all ${
              subtab === id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      <div>
        {verificando ? (
          <div className="flex items-center justify-center py-16 text-slate-300">
            <Loader2 size={24} className="animate-spin" />
          </div>
        ) : (
          <>
            {subtab === 'documentos' && (
              <div className="space-y-4">
                <TOConlinePanel />
              </div>
            )}

            {subtab === 'clientes' && (
              ligado ? <TOConlineClientes onDesligado={() => setLigado(false)} /> : <NaoLigado />
            )}

            {subtab === 'relatorios' && (
              ligado ? <TOConlineRelatorios onDesligado={() => setLigado(false)} /> : <NaoLigado />
            )}

            {subtab === 'contas' && (
              ligado ? <TOConlineBankAccounts onDesligado={() => setLigado(false)} /> : <NaoLigado />
            )}
          </>
        )}
      </div>

      {mostrarCriar && (
        <CriarDocumentoModal
          onClose={() => setMostrarCriar(false)}
          onCriado={() => {}}
        />
      )}

      {mostrarFaturar && (
        <FaturarClienteModal
          onClose={() => setMostrarFaturar(false)}
          onFaturado={() => setMostrarFaturar(false)}
        />
      )}

    </div>
  );
}

function NaoLigado() {
  return (
    <div className="text-center py-16 space-y-3">
      <Link2 size={32} className="mx-auto text-slate-300" />
      <p className="text-sm font-black text-slate-400 uppercase tracking-widest">TOConline não ligado</p>
      <p className="text-xs text-slate-400">Vai ao separador <strong>Documentos</strong> para autenticar</p>
    </div>
  );
}
