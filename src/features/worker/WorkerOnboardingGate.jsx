import React, { useEffect, useState } from 'react';
import { FileText, GraduationCap, Loader2, LogOut, ShieldCheck, ChevronRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import ModalShell from '../../components/common/ModalShell';
import CompanyLogo from '../../components/common/CompanyLogo';
import { DocumentViewer } from '../../components/worker/DocumentViewer';
import { HtmlDocumentViewer } from '../../components/worker/HtmlDocumentViewer';
import FormacaoElearningFlow from './worker-dashboard/FormacaoElearningFlow';
import { listMinhasFormacoes, gateStatus } from './worker-dashboard/formacaoWorkerApi';
import { FT, FONT_TITLE, FONT_MONO } from '../../styles/designTokens';

// FT.warn/FT.warnBg mede só 2,44:1 (falha AA) — mesma correção já aplicada
// em vários pontos da app (WorkerValidationPanel.jsx, WorkerScheduleTab.jsx)
// para este par exato: escurecer o texto, manter o fundo.
const PENDING_INK = '#8a4a00';
// Idem para o "concluído" — FT.ok/FT.okBg dá 4,42:1, abaixo da margem de
// segurança já adotada no resto da migração para este badge.
const DONE_INK = '#1f6b47';

// Bloqueia o dashboard normal na primeira vez que o trabalhador acede, até
// assinar os documentos e concluir as formações marcadas como obrigatórias
// em onboarding_gate_itens (ver api/_gateUtils.js). Reaproveita os fluxos
// já existentes de assinatura (DocumentViewer) e e-learning
// (FormacaoElearningFlow) — este componente é só a casca que os agrupa.
export default function WorkerOnboardingGate({ itensIniciais, currentUser, onCompleto, onLogout }) {
  const { supabase } = useApp();
  const [itens, setItens] = useState(itensIniciais || []);
  // Chave composta (tipo+slug) em vez de índice — sobrevive a reordenação
  // ao separar os itens em duas secções (documentos/formações) sem perder
  // qual estava aberto.
  const [abertoKey, setAbertoKey] = useState(
    itensIniciais?.[0] ? `${itensIniciais[0].tipo}-${itensIniciais[0].slug}` : null
  );
  const [documentoAtivo, setDocumentoAtivo] = useState(null);
  const [formacaoAtiva, setFormacaoAtiva] = useState(null);
  const [carregandoItem, setCarregandoItem] = useState(null);
  const [erro, setErro] = useState('');
  const [reavaliando, setReavaliando] = useState(false);
  // gate-status só devolve os itens ainda pendentes — o total (para a barra
  // de progresso e para o "N/M" de cada secção) é o tamanho/composição da
  // lista na última vez que foi avaliada.
  const [totalInicial, setTotalInicial] = useState((itensIniciais || []).length);
  const [totalPorTipo, setTotalPorTipo] = useState(() => ({
    documento: (itensIniciais || []).filter(i => i.tipo === 'documento').length,
    formacao: (itensIniciais || []).filter(i => i.tipo !== 'documento').length,
  }));

  const total = totalInicial;
  const concluidos = total - itens.length;
  const primeiroNome = currentUser?.name?.split(' ')[0] || '';

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
      if (recontarTotal) {
        setTotalInicial(status.itens.length);
        setTotalPorTipo({
          documento: status.itens.filter(i => i.tipo === 'documento').length,
          formacao: status.itens.filter(i => i.tipo !== 'documento').length,
        });
      }
      setAbertoKey(status.itens[0] ? `${status.itens[0].tipo}-${status.itens[0].slug}` : null);
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

  const documentos = itens.filter(i => i.tipo === 'documento');
  const formacoes = itens.filter(i => i.tipo !== 'documento');

  const renderGrupo = (label, lista, totalTipo) => {
    if (!lista.length) return null;
    const concluidosTipo = totalTipo - lista.length;
    return (
      <div>
        <div className="flex items-baseline justify-between px-1 mb-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ fontFamily: FONT_MONO, color: FT.slateDim }}>
            {label}
          </span>
          <span className="text-[11px] font-semibold" style={{ fontFamily: FONT_MONO, color: FT.slate }}>
            {concluidosTipo}/{totalTipo}
          </span>
        </div>
        <div className="flex flex-col gap-2.5">
          {lista.map((item) => {
            const key = `${item.tipo}-${item.slug}`;
            const isOpen = key === abertoKey;
            const isBusy = carregandoItem === item.slug;
            const isDoc = item.tipo === 'documento';
            return (
              <div
                key={key}
                className="rounded-2xl border overflow-hidden transition-colors"
                style={{ background: FT.panel, borderColor: isOpen ? FT.border : FT.borderSoft }}
              >
                <button
                  type="button"
                  onClick={() => setAbertoKey(isOpen ? null : key)}
                  className="w-full flex items-center gap-3.5 p-4 text-left"
                >
                  <span
                    className="w-[38px] h-[38px] rounded-xl flex items-center justify-center shrink-0"
                    style={isDoc
                      ? { background: 'var(--navy-soft)', color: FT.navy }
                      : { background: 'rgba(235,141,0,0.12)', color: FT.orangeDeep }}
                  >
                    {isDoc ? <FileText size={17} /> : <GraduationCap size={17} />}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[9.5px] font-bold uppercase tracking-widest mb-0.5" style={{ fontFamily: FONT_MONO, color: FT.slate }}>
                      {isDoc ? 'Documento' : 'Formação e-learning'}
                    </span>
                    <span className="block text-[15.5px] font-semibold truncate" style={{ fontFamily: FONT_TITLE, color: FT.ink }}>
                      {item.label}
                    </span>
                  </span>
                  <span
                    className="shrink-0 text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full"
                    style={{ fontFamily: FONT_MONO, background: FT.warnBg, color: PENDING_INK }}
                  >
                    Pendente
                  </span>
                  <ChevronRight size={16} className="shrink-0 transition-transform" style={{ color: FT.slate, transform: isOpen ? 'rotate(90deg)' : 'none' }} />
                </button>
                {isOpen && (
                  <div className="px-4 pb-4" style={{ paddingLeft: 67 }}>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => abrirItem(item)}
                      className="inline-flex items-center gap-2 text-[13px] font-bold rounded-xl px-[18px] py-2.5 disabled:opacity-60 shadow-sm"
                      style={{ color: FT.navy, background: FT.orange, boxShadow: `0 4px 10px -2px var(--orange-shadow)` }}
                    >
                      {isBusy ? <Loader2 size={14} className="animate-spin" /> : (isDoc ? <FileText size={14} /> : <GraduationCap size={14} />)}
                      {isDoc ? 'Assinar documento' : 'Iniciar formação'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-5" style={{ background: FT.bg }}>
      <div className="w-full max-w-xl flex flex-col gap-[18px]">

        <div className="relative overflow-hidden rounded-[24px] p-7" style={{ background: `linear-gradient(135deg, ${FT.navy} 0%, ${FT.navyDeep} 100%)` }}>
          <div
            className="absolute rounded-full pointer-events-none"
            style={{ top: -60, right: -60, width: 220, height: 220, background: 'radial-gradient(circle, rgba(235,141,0,0.16) 0%, transparent 70%)' }}
          />

          <div className="flex items-center gap-3.5 mb-6">
            <div className="w-[52px] h-[52px] rounded-full overflow-hidden shrink-0" style={{ background: FT.orange }}>
              <CompanyLogo className="w-full h-full object-cover" />
            </div>
            <div>
              <p className="font-extrabold text-xl uppercase leading-tight" style={{ fontFamily: FONT_TITLE, color: '#FFFFFF', letterSpacing: '0.01em' }}>
                Magnetic Place
              </p>
              <p className="text-[13px] font-medium mt-0.5" style={{ color: 'var(--on-navy)' }}>Unipessoal, Lda</p>
            </div>
          </div>

          {/* --orange-hover (#F59B1C) — não existe em FT.*, só como CSS var; sobre o navy é o laranja com mais contraste dos dois. */}
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest mb-2.5" style={{ fontFamily: FONT_MONO, color: 'var(--orange-hover)' }}>
            <ShieldCheck size={13} /> Acesso condicionado
          </p>
          <h1 className="font-bold text-[2.15rem] leading-[1.05] mb-2.5" style={{ fontFamily: FONT_TITLE, color: '#FFFFFF' }}>
            Bem-vindo, <span style={{ color: 'var(--orange-hover)', fontWeight: 800 }}>{primeiroNome}</span>.
          </h1>
          <p className="text-sm leading-relaxed max-w-[46ch]" style={{ color: 'var(--on-navy)' }}>
            Antes de aceder ao teu painel, precisamos que assines os documentos e concluas as formações abaixo — é rápido e só aparece uma vez.
          </p>

          <div className="flex items-center gap-3.5 mt-6">
            <div className="flex-1 flex gap-[5px]">
              {Array.from({ length: total }).map((_, i) => (
                <span
                  key={i}
                  className="h-1.5 flex-1 rounded-full"
                  style={i < concluidos
                    ? { background: `linear-gradient(90deg, ${FT.orangeDeep}, ${FT.orange})` }
                    : { background: 'rgba(255,255,255,0.14)' }}
                />
              ))}
            </div>
            <span className="text-[12.5px] font-semibold whitespace-nowrap" style={{ fontFamily: FONT_MONO, color: '#FFFFFF' }}>
              {concluidos} de {total}
            </span>
          </div>
        </div>

        {erro && (
          <div className="p-3 rounded-xl text-xs font-bold" style={{ background: FT.badBg, color: FT.bad }}>{erro}</div>
        )}

        {renderGrupo('Documentos', documentos, totalPorTipo.documento)}
        {renderGrupo('Formações e-learning', formacoes, totalPorTipo.formacao)}

        <div className="rounded-2xl border p-4 flex items-center justify-between gap-3" style={{ background: FT.panel, borderColor: FT.borderSoft }}>
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
