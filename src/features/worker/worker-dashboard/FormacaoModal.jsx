import React, { useEffect, useState } from 'react';
import { GraduationCap, X, PenLine, Loader2, Clock, MapPin, ChevronLeft, BookOpen } from 'lucide-react';
import SignDrawModal from '../../../components/worker/SignDrawModal';
import FormacaoElearningFlow from './FormacaoElearningFlow';
import { listMinhasFormacoes, assinarMinhaFormacao } from './formacaoWorkerApi';
import { CATEGORIAS } from '../../admin/formacao-interna/formacaoTemplates';

const CATEGORIA_LABEL = Object.fromEntries(CATEGORIAS.map(c => [c.id, c.label]));

const ELEARNING_BOTAO_LABEL = {
  nao_iniciado: 'Iniciar Formação',
  em_progresso: 'Continuar Formação',
  reprovado: 'Tentar Novamente',
};

export default function FormacaoModal({ isOpen, onClose, currentUser, onChanged }) {
  const [participacoes, setParticipacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [signAlvo, setSignAlvo] = useState(null);
  const [signBusy, setSignBusy] = useState(false);
  const [elearningAlvo, setElearningAlvo] = useState(null);

  const fetchParticipacoes = async () => {
    setLoading(true);
    setError('');
    try {
      const { participacoes } = await listMinhasFormacoes();
      setParticipacoes(participacoes);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  useEffect(() => { if (isOpen) fetchParticipacoes(); }, [isOpen]);

  const handleAssinar = async (assinaturaBase64) => {
    if (!signAlvo) return;
    setSignBusy(true);
    try {
      await assinarMinhaFormacao(signAlvo.participante_id, assinaturaBase64);
      setSignAlvo(null);
      setElearningAlvo(null);
      await fetchParticipacoes();
      onChanged?.();
    } catch (e) {
      setError(e.message);
    }
    setSignBusy(false);
  };

  const abrirParticipacao = (p) => {
    setError('');
    if (p.formato === 'e-learning' && p.estado_conclusao !== 'concluido') {
      setElearningAlvo(p);
    } else {
      setSignAlvo(p);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex flex-col sm:items-center sm:justify-center">
      <button className="flex-shrink-0 h-16 sm:hidden" onClick={onClose} aria-label="Fechar" />
      <div className="flex-1 sm:flex-none bg-white rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col sm:w-full sm:max-w-2xl sm:max-h-[85vh]">
        <div className="flex items-center gap-3 bg-slate-50 border-b border-slate-100 px-5 py-4 shrink-0">
          {elearningAlvo ? (
            <button onClick={() => setElearningAlvo(null)} className="p-2 -ml-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all shrink-0">
              <ChevronLeft size={18} />
            </button>
          ) : (
            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
              <GraduationCap size={16} className="text-slate-600" />
            </div>
          )}
          <h2 className="flex-1 font-black text-slate-800 uppercase tracking-tight text-sm truncate">
            {elearningAlvo ? elearningAlvo.tipo_formacao : 'Minhas Formações'}
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-4 py-4">
          {error && <div className="mb-4 p-3 bg-rose-50 text-rose-600 text-xs font-bold rounded-xl">{error}</div>}

          {elearningAlvo ? (
            <FormacaoElearningFlow
              participacao={elearningAlvo}
              onConcluido={() => setSignAlvo(elearningAlvo)}
              onError={setError}
            />
          ) : loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <Loader2 className="animate-spin" size={24} />
            </div>
          ) : participacoes.length === 0 ? (
            <p className="text-center py-10 text-slate-400 text-xs font-bold">Ainda não tens formações registadas.</p>
          ) : (
            <div className="space-y-3">
              {participacoes.map(p => {
                const isElearningPendente = p.formato === 'e-learning' && p.estado_conclusao !== 'concluido';
                return (
                  <div key={p.participante_id} className="rounded-2xl border border-slate-100 bg-white shadow-sm p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500">
                            {CATEGORIA_LABEL[p.categoria] || p.categoria}
                          </span>
                          {p.formato === 'e-learning' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-600">
                              <BookOpen size={10} /> E-learning
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-black text-slate-800">{p.tipo_formacao}</p>
                        <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          <span className="inline-flex items-center gap-1"><Clock size={11} /> {p.duracao_horas}h</span>
                          {p.local && <span className="inline-flex items-center gap-1"><MapPin size={11} /> {p.local}</span>}
                          <span>{new Date(p.data_inicio).toLocaleDateString('pt-PT')} a {new Date(p.data_fim).toLocaleDateString('pt-PT')}</span>
                        </div>
                        {p.data_validade && (
                          <p className="text-[10px] font-bold text-slate-400 mt-1">Válido até {new Date(p.data_validade).toLocaleDateString('pt-PT')}</p>
                        )}
                        {p.estado_conclusao === 'reprovado' && (
                          <p className="text-[10px] font-bold text-rose-500 mt-1">Última tentativa: {p.nota_obtida}% (mínimo {p.nota_minima_aprovacao}%)</p>
                        )}
                      </div>
                    </div>
                    <div className="mt-3">
                      {p.assinado_em ? (
                        <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-lg">
                          Assinado em {new Date(p.assinado_em).toLocaleDateString('pt-PT')}
                        </span>
                      ) : (
                        <button
                          onClick={() => abrirParticipacao(p)}
                          className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-900 transition-all shadow-sm active:scale-95"
                        >
                          {isElearningPendente
                            ? (<><BookOpen size={13} /> {ELEARNING_BOTAO_LABEL[p.estado_conclusao] || 'Iniciar Formação'}</>)
                            : (<><PenLine size={13} /> Assinar Agora</>)}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {signAlvo && (
        <SignDrawModal
          workerName={currentUser?.name}
          working={signBusy}
          onClose={() => !signBusy && setSignAlvo(null)}
          onSign={handleAssinar}
        />
      )}
    </div>
  );
}
