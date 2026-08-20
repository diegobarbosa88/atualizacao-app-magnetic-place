import React, { useEffect, useState } from 'react';
import { PlayCircle, FileText, CheckCircle2, XCircle, Loader2, ArrowRight, RotateCcw } from 'lucide-react';
import { iniciarFormacao, responderQuestionario } from './formacaoWorkerApi';

function detectarMedia(url) {
  if (!url) return { tipo: 'pdf', src: url };
  const youtube = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  if (youtube) return { tipo: 'embed', src: `https://www.youtube.com/embed/${youtube[1]}` };
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return { tipo: 'embed', src: `https://player.vimeo.com/video/${vimeo[1]}` };
  if (/\.(mp4|webm|ogg|mov)(\?|$)/i.test(url)) return { tipo: 'video', src: url };
  return { tipo: 'pdf', src: url };
}

export default function FormacaoElearningFlow({ participacao, onConcluido, onError }) {
  const [step, setStep] = useState(participacao.estado_conclusao === 'reprovado' ? 'resultado' : 'conteudo');
  const [respostas, setRespostas] = useState(() => Array(participacao.questionario?.length || 0).fill(null));
  const [resultado, setResultado] = useState(
    participacao.estado_conclusao === 'reprovado'
      ? { nota_obtida: participacao.nota_obtida, aprovado: false }
      : null
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (participacao.estado_conclusao === 'nao_iniciado') {
      iniciarFormacao(participacao.participante_id).catch(e => onError?.(e.message));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const media = detectarMedia(participacao.conteudo_url);
  const todasRespondidas = respostas.length > 0 && respostas.every(r => r !== null);

  const submeter = async () => {
    setBusy(true);
    try {
      const res = await responderQuestionario(participacao.participante_id, respostas);
      setResultado(res);
      setStep('resultado');
      if (res.aprovado) onConcluido?.();
    } catch (e) {
      onError?.(e.message);
    }
    setBusy(false);
  };

  const tentarNovamente = () => {
    setRespostas(Array(participacao.questionario?.length || 0).fill(null));
    setStep('questionario');
  };

  if (step === 'conteudo') {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl overflow-hidden bg-slate-900 aspect-video">
          {media.tipo === 'video' && (
            <video src={media.src} controls className="w-full h-full" />
          )}
          {media.tipo === 'embed' && (
            <iframe src={media.src} className="w-full h-full" allow="autoplay; encrypted-media" allowFullScreen title="Conteúdo da formação" />
          )}
          {media.tipo === 'pdf' && (
            <iframe src={`${media.src}#toolbar=0`} className="w-full h-full bg-white" title="Conteúdo da formação" />
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          {media.tipo === 'pdf' ? <FileText size={12} /> : <PlayCircle size={12} />}
          {media.tipo === 'pdf' ? 'Documento' : 'Vídeo'}
        </div>
        <button
          onClick={() => setStep('questionario')}
          className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-900 transition-all shadow-sm active:scale-95"
        >
          Concluí a visualização, avançar para o questionário <ArrowRight size={13} />
        </button>
      </div>
    );
  }

  if (step === 'questionario') {
    return (
      <div className="space-y-4">
        {(participacao.questionario || []).map((q, idx) => (
          <div key={idx} className="p-3 rounded-2xl bg-slate-50/70 border border-slate-100">
            <p className="text-xs font-black text-slate-700 mb-2">{idx + 1}. {q.pergunta}</p>
            <div className="space-y-1.5">
              {q.opcoes.map((op, oIdx) => (
                <label key={oIdx} className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="radio"
                    name={`pergunta-${idx}`}
                    checked={respostas[idx] === oIdx}
                    onChange={() => setRespostas(prev => prev.map((r, i) => i === idx ? oIdx : r))}
                  />
                  {op}
                </label>
              ))}
            </div>
          </div>
        ))}
        <button
          onClick={submeter}
          disabled={!todasRespondidas || busy}
          className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-900 transition-all shadow-sm active:scale-95 disabled:opacity-50"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Submeter Respostas
        </button>
      </div>
    );
  }

  // step === 'resultado'
  const aprovado = resultado?.aprovado;
  return (
    <div className="space-y-4 text-center py-4">
      <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${aprovado ? 'bg-emerald-50' : 'bg-rose-50'}`}>
        {aprovado ? <CheckCircle2 size={28} className="text-emerald-600" /> : <XCircle size={28} className="text-rose-600" />}
      </div>
      <div>
        <p className="text-2xl font-black text-slate-800">{resultado?.nota_obtida}%</p>
        <p className="text-xs font-bold text-slate-500 mt-1">
          {aprovado
            ? 'Aprovado! Concluíste esta formação com sucesso.'
            : `Não atingiste a nota mínima de ${participacao.nota_minima_aprovacao}% — tenta novamente.`}
        </p>
      </div>
      {aprovado ? (
        <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Falta só assinar para concluir</p>
      ) : (
        <button
          onClick={tentarNovamente}
          className="w-full flex items-center justify-center gap-2 py-3 bg-slate-800 text-white rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-900 transition-all shadow-sm active:scale-95"
        >
          <RotateCcw size={13} /> Tentar Novamente
        </button>
      )}
    </div>
  );
}
