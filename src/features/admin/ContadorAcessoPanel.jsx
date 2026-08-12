import React, { useState } from 'react';
import { Link2, RefreshCw, Copy, CheckCircle2, Loader2, AlertTriangle, Lock } from 'lucide-react';
import AdminPasswordModal from './AdminPasswordModal';

async function chamarContadorAcesso(action, adminPassword) {
  const res = await fetch('/api/contador-acesso', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, admin_password: adminPassword }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro desconhecido');
  return data;
}

export default function ContadorAcessoPanel() {
  const [token, setToken] = useState(null);
  const [sessionPassword, setSessionPassword] = useState(null); // guardada só em memória, nunca persistida
  const [loading, setLoading] = useState(false);
  const [regenerando, setRegenerando] = useState(false);
  const [erro, setErro] = useState(null);
  const [copiado, setCopiado] = useState(false);

  const [modal, setModal] = useState(null); // 'obter' | 'regenerar' | null
  const [modalErro, setModalErro] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  const link = token
    ? `${import.meta.env.VITE_ACCOUNTANT_PORTAL_URL || window.location.origin}/partilha/resumo?token=${token}&mes=${new Date().toISOString().slice(0, 7)}`
    : null;

  const executarComPassword = async (action, password) => {
    setModalLoading(true); setModalErro(null);
    try {
      const d = await chamarContadorAcesso(action, password);
      setToken(d.token);
      setSessionPassword(password);
      setModal(null);
      setErro(null);
      if (action === 'regenerar') setCopiado(false);
    } catch (e) {
      setModalErro(e.message);
    } finally {
      setModalLoading(false);
      setLoading(false);
      setRegenerando(false);
    }
  };

  const verLink = () => {
    if (sessionPassword) {
      setLoading(true);
      chamarContadorAcesso('obter', sessionPassword)
        .then(d => { setToken(d.token); setErro(null); })
        .catch(e => setErro(e.message))
        .finally(() => setLoading(false));
      return;
    }
    setModal('obter'); setModalErro(null);
  };

  const regenerar = () => {
    if (!confirm('Regenerar o link do contabilista? O link atual deixa de funcionar imediatamente — só o novo link (que terás de reenviar) fica ativo.')) return;
    if (sessionPassword) {
      setRegenerando(true);
      chamarContadorAcesso('regenerar', sessionPassword)
        .then(d => { setToken(d.token); setCopiado(false); setErro(null); })
        .catch(e => setErro(e.message))
        .finally(() => setRegenerando(false));
      return;
    }
    setModal('regenerar'); setModalErro(null);
  };

  const copiar = () => {
    if (!link) return;
    navigator.clipboard.writeText(link).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    });
  };

  return (
    <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100 lg:col-span-2">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600"><Link2 size={20} /></div>
        <div>
          <h3 className="font-black text-lg text-slate-800">Acesso do Contabilista</h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Link do Resumo Mensal partilhado (/partilha/resumo)</p>
        </div>
      </div>

      {erro && (
        <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl p-3 mb-3">
          <AlertTriangle size={14} className="text-red-600 shrink-0 mt-0.5" />
          <p className="text-xs text-red-700 font-semibold">{erro}</p>
        </div>
      )}

      {!token ? (
        <button
          onClick={verLink}
          disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all disabled:opacity-50 hover:opacity-90"
          style={{ backgroundColor: '#1B3A57' }}
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <Lock size={13} />}
          Ver Link (pede password de admin)
        </button>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Link ativo (muda o mês na URL conforme necessário)</label>
            <div className="flex gap-2">
              <input readOnly value={link || ''} className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono text-slate-600 outline-none" />
              <button onClick={copiar} className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${copiado ? 'bg-emerald-50 text-emerald-700' : 'text-white hover:opacity-90'}`} style={copiado ? {} : { backgroundColor: '#1B3A57' }}>
                {copiado ? <><CheckCircle2 size={13} /> Copiado</> : <><Copy size={13} /> Copiar</>}
              </button>
            </div>
          </div>
          <button
            onClick={regenerar}
            disabled={regenerando}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-rose-50 text-rose-600 hover:bg-rose-100 transition-all disabled:opacity-50"
          >
            {regenerando ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            Regenerar Link
          </button>
          <p className="text-[10px] text-slate-400 font-medium">
            Regenerar invalida imediatamente o link atual. Terás de reenviar o novo link ao contabilista.
          </p>
        </div>
      )}

      <AdminPasswordModal
        open={!!modal}
        title={modal === 'regenerar' ? 'Confirmar regeneração do link' : 'Confirmar acesso ao link do contabilista'}
        loading={modalLoading}
        error={modalErro}
        onConfirm={(password) => executarComPassword(modal, password)}
        onClose={() => { setModal(null); setModalErro(null); }}
      />
    </div>
  );
}
