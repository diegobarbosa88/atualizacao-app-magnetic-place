import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageSquareText, Loader2, RefreshCw, Sparkles, CheckCircle2, XCircle,
  AlertTriangle, ChevronDown, ChevronUp, Send, ShieldAlert,
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { DEFAULT_GMAIL_CONFIG_CONTADOR, configParaQuery } from './faturasUtils';
import GmailConfigPanel from './GmailConfigPanel';

const STATUS_CFG = {
  importado:       { label: 'Importado',       bg: 'bg-slate-100',  text: 'text-slate-500' },
  rascunho_gerado: { label: 'Rascunho gerado',  bg: 'bg-blue-50',    text: 'text-blue-600' },
  aprovado:        { label: 'Aprovado',         bg: 'bg-emerald-50', text: 'text-emerald-600' },
  enviado:         { label: 'Enviado',          bg: 'bg-emerald-50', text: 'text-emerald-700' },
  rejeitado:       { label: 'Rejeitado',        bg: 'bg-rose-50',    text: 'text-rose-500' },
};

const CONTADOR_NIF = import.meta.env.VITE_CONTADOR_NIF || '';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function ContadorEmailsAdmin() {
  const { supabase, currentUser, gmailQueryConfigContador, saveGmailQueryConfigContador } = useApp();

  const [fornecedor, setFornecedor] = useState(null);
  const [fornecedorErro, setFornecedorErro] = useState(null);
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  const [cfg, setCfg] = useState(() => gmailQueryConfigContador || DEFAULT_GMAIL_CONFIG_CONTADOR);
  const [importando, setImportando] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const [gerandoId, setGerandoId] = useState(null);
  const [gerarErro, setGerarErro] = useState(null);

  const [revisao, setRevisao] = useState(null); // { emailId, resposta, texto }
  const [confirmado, setConfirmado] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [acaoErro, setAcaoErro] = useState(null);

  useEffect(() => { if (gmailQueryConfigContador) setCfg(gmailQueryConfigContador); }, [gmailQueryConfigContador]);

  useEffect(() => {
    if (!CONTADOR_NIF) {
      setFornecedorErro('VITE_CONTADOR_NIF não está configurado — não é possível identificar o fornecedor "contador".');
      setLoading(false);
      return;
    }
    supabase.from('fornecedores').select('*').eq('nif', CONTADOR_NIF).maybeSingle()
      .then(({ data, error }) => {
        if (error) { setFornecedorErro(error.message); return; }
        if (!data) { setFornecedorErro(`Nenhum fornecedor encontrado com NIF ${CONTADOR_NIF} — cria o fornecedor "contador" primeiro.`); return; }
        setFornecedor(data);
      });
  }, [supabase]);

  const carregar = useCallback(async () => {
    setLoading(true); setErro(null);
    try {
      const { data, error } = await supabase
        .from('emails_contador')
        .select('*, respostas_contador_pendentes(*)')
        .order('recebido_em', { ascending: false });
      if (error) throw error;
      setEmails(data || []);
    } catch (e) { setErro(e.message); }
    finally { setLoading(false); }
  }, [supabase]);

  useEffect(() => { carregar(); }, [carregar]);

  const handleImportar = async () => {
    if (!fornecedor) return;
    setImportando(true); setImportResult(null);
    try {
      const query = configParaQuery(cfg);
      const res = await fetch('/api/gmail/import-faturas', {
        method: 'POST',
        headers: { 'x-import-secret': import.meta.env.VITE_GMAIL_IMPORT_SECRET || '', 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'contador', query, fornecedorId: fornecedor.id }),
      });
      const data = await res.json();
      setImportResult(data);
      if (!data.error) await carregar();
    } catch (e) { setImportResult({ error: e.message }); }
    finally { setImportando(false); }
  };

  const gerarRascunho = async (emailId) => {
    setGerandoId(emailId); setGerarErro(null);
    try {
      const res = await fetch('/api/gerar-resposta-contador', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_contador_id: emailId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro desconhecido');
      await carregar();
    } catch (e) { setGerarErro({ emailId, msg: e.message }); }
    finally { setGerandoId(null); }
  };

  const abrirRevisao = (email) => {
    const resposta = email.respostas_contador_pendentes?.find(r => r.status === 'pendente');
    if (!resposta) return;
    setRevisao({ emailId: email.id, resposta, texto: resposta.rascunho });
    setConfirmado(false);
    setAcaoErro(null);
  };

  const fecharRevisao = () => { setRevisao(null); setConfirmado(false); setAcaoErro(null); };

  const confirmadoPor = currentUser?.name || currentUser?.email || currentUser?.id || 'admin';

  const executarAcao = async (action) => {
    if (!revisao) return;
    if (action === 'rejeitar' && !confirm('Rejeitar este rascunho? Esta ação fica registada e não pode ser desfeita.')) return;
    setProcessando(true); setAcaoErro(null);
    try {
      const res = await fetch('/api/aprovar-resposta-contador', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resposta_id: revisao.resposta.id,
          action,
          confirmado_por: confirmadoPor,
          rascunho_final: revisao.texto,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro desconhecido');
      fecharRevisao();
      await carregar();
    } catch (e) { setAcaoErro(e.message); }
    finally { setProcessando(false); }
  };

  const textoEditado = revisao && revisao.texto.trim() !== revisao.resposta.rascunho.trim();

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2" style={{ color: '#1B3A57' }}>
          <MessageSquareText size={22} style={{ color: '#1B3A57' }} />
          Emails do Contador
        </h2>
        <button onClick={carregar} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50 text-white hover:opacity-90"
          style={{ backgroundColor: '#1B3A57' }}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          <span className="hidden sm:inline">Atualizar</span>
        </button>
      </div>

      {fornecedorErro && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-2xl text-sm font-semibold flex items-start gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>{fornecedorErro}</span>
        </div>
      )}

      {fornecedor && (
        <GmailConfigPanel
          cfg={cfg}
          onCfgChange={setCfg}
          onSave={(novaCfg) => saveGmailQueryConfigContador(novaCfg)}
          onImport={handleImportar}
          importing={importando}
          importResult={importResult ? { processados: importResult.processados, ficheiros: importResult.ficheiros, erros: importResult.erros, error: importResult.error } : null}
        />
      )}

      {erro && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-2xl text-sm font-semibold">Erro: {erro}</div>}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-slate-300" /></div>
      ) : emails.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm font-semibold">Nenhum email do contador importado ainda.</div>
      ) : (
        <div className="space-y-3">
          {emails.map(email => {
            const resposta = email.respostas_contador_pendentes?.find(r => r.status === 'pendente')
              || [...(email.respostas_contador_pendentes || [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
            const statusCfg = STATUS_CFG[email.status] || STATUS_CFG.importado;
            const d = email.dados_extraidos || {};
            const aberto = revisao?.emailId === email.id;

            return (
              <div key={email.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-4 sm:p-5 flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${statusCfg.bg} ${statusCfg.text}`}>
                        {statusCfg.label}
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold">{formatDate(email.recebido_em)}</span>
                    </div>
                    <p className="text-sm font-bold text-slate-700 truncate">{email.assunto || '(sem assunto)'}</p>
                    <p className="text-[11px] text-slate-400 truncate">{email.remetente}</p>
                    {(d.numero_fatura || d.valor != null || d.mes_referencia) && (
                      <p className="text-[10px] text-slate-500 font-semibold mt-1.5">
                        {d.numero_fatura && <>Nº {d.numero_fatura} · </>}
                        {d.valor != null && <>{Number(d.valor).toFixed(2)} € · </>}
                        {d.mes_referencia && <>Ref. {d.mes_referencia}</>}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {email.status === 'importado' && (
                      <button
                        onClick={() => gerarRascunho(email.id)}
                        disabled={gerandoId === email.id}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 text-white hover:opacity-90"
                        style={{ backgroundColor: '#EB8D00' }}
                      >
                        {gerandoId === email.id ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                        Gerar Rascunho
                      </button>
                    )}
                    {resposta && resposta.status === 'pendente' && (
                      <button
                        onClick={() => aberto ? fecharRevisao() : abrirRevisao(email)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all hover:bg-slate-50"
                        style={{ borderColor: '#869AAF', color: '#1B3A57' }}
                      >
                        {aberto ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        {aberto ? 'Fechar' : 'Rever Rascunho'}
                      </button>
                    )}
                    {resposta && resposta.status !== 'pendente' && (
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${STATUS_CFG[resposta.status]?.bg} ${STATUS_CFG[resposta.status]?.text}`}>
                        {resposta.status === 'enviado' ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                        {STATUS_CFG[resposta.status]?.label}
                      </span>
                    )}
                  </div>
                </div>

                {gerarErro?.emailId === email.id && (
                  <div className="mx-4 sm:mx-5 mb-4 px-3 py-2 bg-red-50 text-red-700 rounded-xl text-xs font-semibold">
                    Erro ao gerar rascunho: {gerarErro.msg}
                  </div>
                )}

                {aberto && revisao && (
                  <div className="border-t border-slate-100 p-4 sm:p-5 space-y-3 bg-slate-50/50">
                    <div className="flex items-center gap-2">
                      <ShieldAlert size={13} style={{ color: '#869AAF' }} />
                      <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#869AAF' }}>
                        Revê o texto antes de aprovar — o envio só acontece depois de confirmares
                      </p>
                    </div>

                    <textarea
                      value={revisao.texto}
                      onChange={e => setRevisao(prev => ({ ...prev, texto: e.target.value }))}
                      rows={8}
                      className="w-full p-3 rounded-2xl border border-slate-200 text-sm leading-relaxed outline-none focus:border-slate-400 transition-all font-medium text-slate-700"
                    />
                    {textoEditado && (
                      <p className="text-[10px] text-amber-600 font-bold uppercase tracking-widest">Texto editado manualmente (será registado)</p>
                    )}

                    {acaoErro && (
                      <div className="px-3 py-2 bg-red-50 text-red-700 rounded-xl text-xs font-semibold">{acaoErro}</div>
                    )}

                    <label className="flex items-start gap-2.5 cursor-pointer group">
                      <div
                        onClick={() => setConfirmado(v => !v)}
                        className={`mt-0.5 w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-all ${confirmado ? '' : 'border-slate-300 group-hover:border-[#869AAF]'}`}
                        style={confirmado ? { backgroundColor: '#1B3A57', borderColor: '#1B3A57' } : {}}
                      >
                        {confirmado && <CheckCircle2 size={10} className="text-white" />}
                      </div>
                      <span className="text-xs text-slate-600 leading-relaxed font-medium">
                        Confirmo que revi este texto e autorizo o envio da resposta ao contador em nome de <strong>{confirmadoPor}</strong>.
                      </span>
                    </label>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => executarAcao('aprovar')}
                        disabled={!confirmado || processando}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all disabled:opacity-40 hover:opacity-90"
                        style={{ backgroundColor: '#1B3A57' }}
                      >
                        {processando ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                        Aprovar e Enviar
                      </button>
                      <button
                        onClick={() => executarAcao('rejeitar')}
                        disabled={processando}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest bg-rose-50 text-rose-600 hover:bg-rose-100 transition-all disabled:opacity-40"
                      >
                        <XCircle size={14} /> Rejeitar
                      </button>
                      <button onClick={fecharRevisao} disabled={processando}
                        className="px-4 py-2.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors">
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
