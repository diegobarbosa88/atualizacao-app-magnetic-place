import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FileText, Users, BarChart2, Link2, Plus, Loader2, Zap, Landmark, TrendingUp, BookOpen } from 'lucide-react';
import TOConlinePanel from './faturas/TOConlinePanel';
import TOConlineClientes from './toconline/TOConlineClientes';
import TOConlineRelatorios from './toconline/TOConlineRelatorios';
import TOConlineBankAccounts from './toconline/TOConlineBankAccounts';
import CriarDocumentoModal from './toconline/CriarDocumentoModal';
import FaturarClienteModal from './toconline/FaturarClienteModal';
import { FT } from '../../styles/designTokens';
import { authFetch } from '../../utils/authFetch';
import SectionHeaderShell from '../../components/common/SectionHeaderShell';

const TABS = [
  { id: 'documentos', label: 'Documentos', shortLabel: 'Docs', icon: FileText },
  { id: 'clientes', label: 'Clientes', shortLabel: 'Clientes', icon: Users },
  { id: 'relatorios', label: 'Relatórios', shortLabel: 'Relat.', icon: BarChart2 },
  { id: 'contas', label: 'Contas Bancárias', shortLabel: 'Contas', icon: Landmark },
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
  const [clienteParaFaturar, setClienteParaFaturar] = useState(null);
  const [saldoContas, setSaldoContas] = useState(null);
  const [saldoLoading, setSaldoLoading] = useState(false);

  const carregarSaldo = useCallback(async () => {
    setSaldoLoading(true);
    try {
      const res = await authFetch('/api/toconline/bank-accounts?com_saldo=1');
      const data = await res.json();
      if (!res.ok) { setSaldoContas(null); return; }
      const lista = data.data || [];
      const total = lista.reduce((s, c) => s + (Number(c.saldo_atual ?? 0) || 0), 0);
      setSaldoContas({ total, n: lista.length });
    } catch {
      setSaldoContas(null);
    } finally {
      setSaldoLoading(false);
    }
  }, []);

  useEffect(() => {
    authFetch('/api/toconline/status')
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

  const statusLabel = verificando ? 'A verificar...' : ligado ? 'Ligado e operacional' : 'Não autenticado';

  return (
    <div className="p-6 space-y-5 w-full max-w-6xl mx-auto min-w-0">
      <SectionHeaderShell
        icon={verificando ? <Loader2 size={16} className="animate-spin" /> : <BookOpen size={18} />}
        title="TOConline"
        subtitle={statusLabel}
        tabs={TABS}
        activeTab={subtab}
        onTabChange={setSubtab}
        rightSlot={
          <div className="flex items-center gap-2.5 flex-wrap">
            {ligado && (
              <div className="flex items-center gap-2.5 bg-[var(--surface-dim)] rounded-xl px-3 py-1.5">
                {saldoLoading ? (
                  <Loader2 size={13} className="text-[var(--slate)] animate-spin" />
                ) : (
                  <TrendingUp size={14} className="text-[var(--slate)] shrink-0" />
                )}
                <div>
                  <p className="text-[8.5px] font-black uppercase tracking-widest text-[var(--slate-dim)]">Saldo Contas</p>
                  <p className="text-xs font-black text-[var(--navy)]">
                    {saldoContas != null
                      ? new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(saldoContas.total)
                      : '—'}
                  </p>
                </div>
                {saldoContas && (
                  <span className="text-[9px] text-[var(--slate-dim)] font-semibold self-end pb-0.5">
                    {saldoContas.n} conta{saldoContas.n !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            )}
            {!verificando && ligado && (
              <div className="flex gap-2">
                <button onClick={() => setMostrarFaturar(true)}
                  className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-black uppercase tracking-wide rounded-lg transition-all shadow-sm hover:opacity-90"
                  style={{ backgroundColor: FT.orange, color: '#12293e' }}>
                  <Zap size={12} /> Faturar
                </button>
                <button onClick={() => setMostrarCriar(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-[var(--surface-dim)] text-[var(--navy)] text-[10px] font-black uppercase tracking-wide rounded-lg transition-all hover:bg-[var(--border)]">
                  <Plus size={12} /> Criar
                </button>
              </div>
            )}
          </div>
        }
      />

      <div>
        {verificando ? (
          <div className="flex items-center justify-center py-16 text-[var(--slate-dim)]">
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
          onClienteElegivel={(clientId) => {
            // Cliente elegível para ajudas de custo + documento de receita
            // nova — fecha este modal (sem gate de ajudas) e abre o
            // FaturarClienteModal (gated), já com o cliente selecionado.
            setMostrarCriar(false);
            setClienteParaFaturar(clientId);
            setMostrarFaturar(true);
          }}
        />
      )}

      {mostrarFaturar && (
        <FaturarClienteModal
          clienteIdInicial={clienteParaFaturar || undefined}
          onClose={() => { setMostrarFaturar(false); setClienteParaFaturar(null); }}
          onFaturado={() => { setMostrarFaturar(false); setClienteParaFaturar(null); }}
        />
      )}

    </div>
  );
}

function NaoLigado() {
  return (
    <div className="text-center py-16 space-y-3">
      <Link2 size={32} className="mx-auto text-[var(--slate)]" />
      <p className="text-sm font-black text-[var(--slate-dim)] uppercase tracking-widest">TOConline não ligado</p>
      <p className="text-xs text-[var(--slate-dim)]">Vai ao separador <strong>Documentos</strong> para autenticar</p>
    </div>
  );
}
