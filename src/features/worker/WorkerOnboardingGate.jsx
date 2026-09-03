import React, { useEffect, useState } from 'react';
import { FileText, GraduationCap, Check, Loader2, LogOut, ShieldCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import ModalShell from '../../components/common/ModalShell';
import { DocumentViewer } from '../../components/worker/DocumentViewer';
import { HtmlDocumentViewer } from '../../components/worker/HtmlDocumentViewer';
import FormacaoElearningFlow from './worker-dashboard/FormacaoElearningFlow';
import { listMinhasFormacoes, gateStatus } from './worker-dashboard/formacaoWorkerApi';
import { FT, FONT_TITLE, FONT_MONO } from '../../styles/designTokens';

// Bloqueia o dashboard normal na primeira vez que o trabalhador acede, até
// assinar os documentos e concluir as formações marcadas como obrigatórias
// em onboarding_gate_itens (ver api/_gateUtils.js). Reaproveita os fluxos
// já existentes de assinatura (DocumentViewer) e e-learning
// (FormacaoElearningFlow) — este componente é só a casca que os agrupa.
export default function WorkerOnboardingGate({ itensIniciais, currentUser, onCompleto, onLogout }) {
  const { supabase } = useApp();
  const [itens, setItens] = useState(itensIniciais || []);
  const [abertoIdx, setAbertoIdx] = useState(0);
  const [documentoAtivo, setDocumentoAtivo] = useState(null);
  const [formacaoAtiva, setFormacaoAtiva] = useState(null);
  const [carregandoItem, setCarregandoItem] = useState(null);
  const [erro, setErro] = useState('');
  const [reavaliando, setReavaliando] = useState(false);
  // gate-status só devolve os itens ainda pendentes — o total (para a barra
  // de progresso) é o tamanho da lista na última vez que foi avaliada.
  const [totalInicial, setTotalInicial] = useState((itensIniciais || []).length);

  const total = totalInicial;
  const concluidos = total - itens.length;

  const reavaliar = async ({ recontarTotal = false } = {}) => {
    setReavaliando(true);
    setErro('');
    try {
      const status = await gateStatus();
      if (!status.pendente) {
        onCompleto();
        return;
      }
      setItens(status.itens);
      if (recontarTotal) setTotalInicial(status.itens.length);
      setAbertoIdx(0);
    } catch (e) {
      setErro(e.message);
    }
    setReavaliando(false);
  };

  // O snapshot do login pode estar desatualizado (ex.: recarregar a página
  // depois de já ter concluído algo noutra aba) — confirma sempre o estado
  // real ao montar, em vez de confiar cegamente em itensIniciais.
  useEffect(() => {
    reavaliar({ recontarTotal: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const abrirDocumento = async (item) => {
    if (!item.worker_document_id) {
      setErro('Este documento ainda não foi gerado — contacta o administrador.');
      return;
    }
    setCarregandoItem(item.slug);
    setErro('');
    try {
      const { data, error } = await supabase
        .from('worker_documents')
        .select('*, document_templates(formato)')
        .eq('id', item.worker_document_id)
        .single();
      if (error) throw error;
      setDocumentoAtivo({ ...data, _formato: data.document_templates?.formato || 'docx' });
    } catch (e) {
      setErro(e.message);
    }
    setCarregandoItem(null);
  };

  const abrirFormacao = async (item) => {
    if (!item.participante_id) {
      setErro('Esta formação ainda não foi atribuída — contacta o administrador.');
      return;
    }
    setCarregandoItem(item.slug);
    setErro('');
    try {
      const { participacoes } = await listMinhasFormacoes();
      const participacao = participacoes?.find(p => p.participante_id === item.participante_id);
      if (!participacao) throw new Error('Formação não encontrada.');
      setFormacaoAtiva(participacao);
    } catch (e) {
      setErro(e.message);
    }
    setCarregandoItem(null);
  };

  const abrirItem = (item) => {
    if (item.tipo === 'documento') abrirDocumento(item);
    else abrirFormacao(item);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-5" style={{ background: FT.bg }}>
      <div className="w-full max-w-xl flex flex-col gap-4">

        <div className="relative overflow-hidden rounded-[20px] p-7 text-white" style={{ background: `linear-gradient(135deg, ${FT.navy} 0%, ${FT.navyDeep} 100%)` }}>
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest mb-2.5" style={{ fontFamily: FONT_MONO, color: FT.orange }}>
            <ShieldCheck size={13} /> Acesso condicionado
          </p>
          <h1 className="font-extrabold text-3xl leading-tight mb-2" style={{ fontFamily: FONT_TITLE, color: '#FFFFFF' }}>
            Bem-vindo à Magnetic Place, {currentUser?.name?.split(' ')[0] || ''}
          </h1>
          <p className="text-sm leading-relaxed max-w-[46ch]" style={{ color: 'rgba(255,255,255,0.78)' }}>
            Antes de aceder ao teu painel, precisamos que assines os documentos e concluas as formações abaixo — é rápido e só aparece uma vez.
          </p>
          <div className="flex items-center gap-3 mt-5">
            <div className="flex-1 h-[7px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.16)' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${total ? (concluidos / total) * 100 : 0}%`, background: `linear-gradient(90deg, ${FT.orangeDeep}, ${FT.orange})` }} />
            </div>
            <span className="text-[13px] font-semibold whitespace-nowrap" style={{ fontFamily: FONT_MONO }}>{concluidos} de {total}</span>
          </div>
        </div>

        {erro && (
          <div className="p-3 rounded-xl text-xs font-bold" style={{ background: FT.badBg, color: FT.bad }}>{erro}</div>
        )}

        <div className="flex flex-col gap-2.5">
          {itens.map((item, idx) => {
            const isOpen = idx === abertoIdx;
            const isBusy = carregandoItem === item.slug;
            return (
              <div key={`${item.tipo}-${item.slug}`} className="rounded-2xl border overflow-hidden" style={{ background: FT.panel, borderColor: FT.border }}>
                <button
                  type="button"
                  onClick={() => setAbertoIdx(isOpen ? -1 : idx)}
                  className="w-full flex items-center gap-3.5 p-4 text-left"
                >
                  <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: FT.warnBg, color: FT.warn }}>
                    {item.tipo === 'documento' ? <FileText size={18} /> : <GraduationCap size={18} />}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[9.5px] font-semibold uppercase tracking-widest mb-0.5" style={{ fontFamily: FONT_MONO, color: FT.slateDim }}>
                      {item.tipo === 'documento' ? 'Documento' : 'Formação e-learning'}
                    </span>
                    <span className="block text-[15px] font-bold truncate" style={{ color: FT.ink }}>{item.label}</span>
                  </span>
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 pl-[68px]">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => abrirItem(item)}
                      className="inline-flex items-center gap-2 text-[13px] font-bold rounded-[10px] px-4 py-2.5 disabled:opacity-60"
                      style={{ color: FT.navy, background: FT.orange }}
                    >
                      {isBusy ? <Loader2 size={14} className="animate-spin" /> : (item.tipo === 'documento' ? <FileText size={14} /> : <GraduationCap size={14} />)}
                      {item.tipo === 'documento' ? 'Assinar documento' : 'Iniciar formação'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl border p-4 flex items-center justify-between gap-3" style={{ background: FT.panel, borderColor: FT.border }}>
          <p className="text-xs leading-snug" style={{ color: FT.inkSoft }}>
            {itens.length === 1 ? 'Falta 1 passo' : `Faltam ${itens.length} passos`} para desbloquear o teu painel.
          </p>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-2 text-xs font-bold shrink-0"
            style={{ color: FT.slateDim }}
          >
            <LogOut size={13} /> Sair
          </button>
        </div>
      </div>

      {documentoAtivo && (
        // HtmlDocumentViewer/DocumentViewer já são modais completos e
        // auto-suficientes (cabeçalho, X, tamanho fixo) — o mesmo padrão de
        // backdrop simples usado em WorkerDocuments.jsx. Envolvê-los também
        // num ModalShell (como estava antes) empilhava dois modais um
        // dentro do outro, cada um com o seu próprio scroll — daí as 3
        // barras de rolagem reportadas.
        <div className="fixed inset-0 z-[150] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
          {documentoAtivo._formato === 'html' ? (
            <HtmlDocumentViewer
              document={documentoAtivo}
              onBack={() => { setDocumentoAtivo(null); reavaliar(); }}
              onSigned={() => { setDocumentoAtivo(null); reavaliar(); }}
            />
          ) : (
            <DocumentViewer
              document={documentoAtivo}
              onBack={() => { setDocumentoAtivo(null); reavaliar(); }}
              onSigned={() => { setDocumentoAtivo(null); reavaliar(); }}
            />
          )}
        </div>
      )}

      {formacaoAtiva && (
        <ModalShell isOpen title={formacaoAtiva.tipo_formacao} onClose={() => { setFormacaoAtiva(null); reavaliar(); }} size="lg">
          <FormacaoElearningFlow
            participacao={formacaoAtiva}
            currentUser={currentUser}
            onFinalizado={() => { setFormacaoAtiva(null); reavaliar(); }}
            onError={(msg) => setErro(msg)}
          />
        </ModalShell>
      )}

      {reavaliando && (
        <div className="fixed inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.2)' }}>
          <Loader2 className="animate-spin text-white" size={28} />
        </div>
      )}
    </div>
  );
}
