import React, { useEffect, useRef, useState } from 'react';
import { PlayCircle, FileText, CheckCircle2, Loader2, ChevronLeft } from 'lucide-react';
import { iniciarFormacao, responderQuestionario, getConteudoUrl, assinarMinhaFormacao } from './formacaoWorkerApi';
import { FT, FONT_TITLE, FONT_MONO } from './formacaoDesignTokens';

const STEPS = [
  { id: 'conteudo', label: 'Conteúdo' },
  { id: 'questionario', label: 'Questionário' },
  { id: 'resultado', label: 'Resultado' },
  { id: 'assinatura', label: 'Assinatura' },
];

function isExterno(url) {
  return /^https?:\/\//i.test(url || '');
}

function detectarMedia(url) {
  if (!url) return { tipo: 'pdf', src: url };
  const youtube = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  if (youtube) return { tipo: 'embed', src: `https://www.youtube.com/embed/${youtube[1]}` };
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return { tipo: 'embed', src: `https://player.vimeo.com/video/${vimeo[1]}` };
  if (/\.(mp4|webm|ogg|mov)(\?|$)/i.test(url)) return { tipo: 'video', src: url };
  return { tipo: 'pdf', src: url };
}

function SeamTrack({ activeIndex }) {
  return (
    <div className="flex items-center gap-0.5 my-5 px-0.5">
      {STEPS.map((s, i) => (
        <React.Fragment key={s.id}>
          <div className="flex-1 flex flex-col items-center gap-1.5">
            <div
              className="w-[26px] h-[26px] rounded-full border-2 flex items-center justify-center text-[11px] font-semibold transition-colors shrink-0"
              style={{
                fontFamily: FONT_MONO,
                borderColor: i < activeIndex ? FT.ok : i === activeIndex ? FT.orange : FT.slate,
                background: i < activeIndex ? FT.ok : i === activeIndex ? FT.orange : FT.panel,
                color: i <= activeIndex ? '#fff' : FT.slate,
              }}
            >
              {i + 1}
            </div>
            <div
              className="text-[9.5px] uppercase tracking-wide text-center leading-tight"
              style={{ fontFamily: FONT_MONO, color: i === activeIndex ? FT.orangeDeep : FT.inkSoft, fontWeight: i === activeIndex ? 700 : 500 }}
            >
              {s.label}
            </div>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className="flex-1 h-[3px] -mx-0.5 self-start mt-[13px]"
              style={{ backgroundImage: `repeating-linear-gradient(90deg, ${i < activeIndex ? FT.orange : FT.slate} 0 6px, transparent 6px 10px)` }}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function btnPrimaryStyle(disabled) {
  return {
    background: disabled ? '#D9D4C8' : FT.orange,
    color: disabled ? '#9A9384' : '#fff',
  };
}
const BTN_PRIMARY_CLS = 'w-full py-3 rounded-[9px] font-semibold text-[14.5px] transition-all active:scale-[0.98] disabled:cursor-not-allowed';
// Barra de ações fixa ao fundo do ecrã (dentro do scroll da modal) — em
// telemóvel o conteúdo pode ser mais alto que o ecrã e o botão de avançar
// tem de continuar acessível sem obrigar a fazer scroll até ao fim.
const STICKY_FOOTER_CLS = 'sticky bottom-0 -mx-5 px-5 pt-3 pb-4';
function stickyFooterStyle() {
  return { background: FT.panel, borderTop: `1px solid ${FT.border}`, boxShadow: '0 -6px 12px -6px rgba(20,30,45,0.08)' };
}

function SignatureCanvas({ onConfirm, busy }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const setup = () => {
      const parent = c.parentElement;
      if (!parent) return;
      const ratio = window.devicePixelRatio || 1;
      const cssW = parent.clientWidth;
      const cssH = 150;
      c.width = cssW * ratio;
      c.height = cssH * ratio;
      c.style.width = cssW + 'px';
      c.style.height = cssH + 'px';
      const ctx = c.getContext('2d');
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.strokeStyle = FT.navy;
    };
    setup();
    window.addEventListener('resize', setup);
    return () => window.removeEventListener('resize', setup);
  }, []);

  const pos = (e) => {
    const c = canvasRef.current;
    const r = c.getBoundingClientRect();
    const src = e.touches?.[0] || e;
    return { x: src.clientX - r.left, y: src.clientY - r.top };
  };
  const start = (e) => {
    e.preventDefault();
    drawing.current = true;
    const { x, y } = pos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const { x, y } = pos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasInk(true);
  };
  const stop = () => { drawing.current = false; };
  const clear = () => {
    const c = canvasRef.current;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    setHasInk(false);
  };
  const confirmar = () => {
    if (!hasInk) return;
    onConfirm(canvasRef.current.toDataURL('image/png'));
  };

  return (
    <div>
      <p className="text-[13px] mb-2" style={{ color: FT.inkSoft }}>Assina abaixo para confirmar a conclusão da formação:</p>
      <div className="mb-2.5 rounded-[10px] overflow-hidden" style={{ border: `1.5px dashed ${FT.slate}`, background: '#FBFAF7', touchAction: 'none' }}>
        <canvas
          ref={canvasRef}
          className="w-full block cursor-crosshair"
          style={{ height: 150, touchAction: 'none' }}
          onMouseDown={start} onMouseMove={move} onMouseUp={stop} onMouseLeave={stop}
          onTouchStart={start} onTouchMove={move} onTouchEnd={stop} onTouchCancel={stop}
        />
      </div>
      <div className="flex gap-2.5 mb-4">
        <button
          type="button"
          onClick={clear}
          disabled={busy}
          className="flex-1 py-2.5 px-3.5 rounded-[9px] text-[13px] font-semibold border-[1.5px] transition-all disabled:opacity-50"
          style={{ borderColor: FT.navy, color: FT.navy }}
        >
          Limpar
        </button>
      </div>
      <button onClick={confirmar} disabled={!hasInk || busy} className={BTN_PRIMARY_CLS} style={btnPrimaryStyle(!hasInk || busy)}>
        {busy ? 'A confirmar...' : 'Confirmar assinatura'}
      </button>
    </div>
  );
}

export default function FormacaoElearningFlow({ participacao, currentUser, onFinalizado, onError }) {
  const temConteudoEstruturado = Array.isArray(participacao.conteudo_estruturado?.seccoes) && participacao.conteudo_estruturado.seccoes.length > 0;
  const precisaMedia = !temConteudoEstruturado && !!participacao.conteudo_url;

  const stepInicial = participacao.estado_conclusao === 'concluido' ? 'assinatura'
    : participacao.estado_conclusao === 'reprovado' ? 'resultado'
    : 'conteudo';

  const [step, setStep] = useState(stepInicial);
  const [respostas, setRespostas] = useState(() => Array(participacao.questionario?.length || 0).fill(null));
  const [perguntaIdx, setPerguntaIdx] = useState(0);
  const [resultado, setResultado] = useState(
    participacao.estado_conclusao === 'reprovado' || participacao.estado_conclusao === 'concluido'
      ? { nota_obtida: participacao.nota_obtida, aprovado: participacao.estado_conclusao === 'concluido' }
      : null
  );
  const [busy, setBusy] = useState(false);
  const [assinado, setAssinado] = useState(false);
  const [conteudoSrc, setConteudoSrc] = useState(isExterno(participacao.conteudo_url) ? participacao.conteudo_url : null);
  const [conteudoLoading, setConteudoLoading] = useState(precisaMedia && !isExterno(participacao.conteudo_url));

  useEffect(() => {
    if (participacao.estado_conclusao === 'nao_iniciado') {
      iniciarFormacao(participacao.participante_id).catch(e => onError?.(e.message));
    }
    if (precisaMedia && !isExterno(participacao.conteudo_url)) {
      getConteudoUrl(participacao.participante_id)
        .then(({ url }) => setConteudoSrc(url))
        .catch(e => onError?.(e.message))
        .finally(() => setConteudoLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const media = precisaMedia && conteudoSrc ? detectarMedia(conteudoSrc) : null;
  const todasRespondidas = respostas.length > 0 && respostas.every(r => r !== null);
  const activeIndex = STEPS.findIndex(s => s.id === step);
  const totalPerguntas = participacao.questionario?.length || 0;
  const naUltimaPergunta = perguntaIdx === totalPerguntas - 1;
  const perguntaAtualRespondida = respostas[perguntaIdx] !== null;

  const submeterQuestionario = async () => {
    setBusy(true);
    try {
      const res = await responderQuestionario(participacao.participante_id, respostas);
      setResultado(res);
      setStep('resultado');
    } catch (e) {
      onError?.(e.message);
    }
    setBusy(false);
  };

  const tentarNovamente = () => {
    setRespostas(Array(participacao.questionario?.length || 0).fill(null));
    setPerguntaIdx(0);
    setStep('questionario');
  };

  const handleAssinar = async (assinaturaBase64) => {
    setBusy(true);
    try {
      await assinarMinhaFormacao(participacao.participante_id, assinaturaBase64);
      setAssinado(true);
      setTimeout(() => onFinalizado?.(), 1400);
    } catch (e) {
      onError?.(e.message);
    }
    setBusy(false);
  };

  return (
    <div>
      <SeamTrack activeIndex={activeIndex} />

      {step === 'conteudo' && (
        <div>
          <div className="mb-4" style={{ borderBottom: `1px dashed ${FT.border}`, paddingBottom: 16 }}>
            {participacao.conteudo_estruturado?.objetivo && (
              <div className="rounded-r-lg px-3.5 py-3 text-[13.5px] mb-3" style={{ background: '#F5F3EE', borderLeft: `3px solid ${FT.orange}` }}>
                <span className="font-bold">Objetivo: </span>{participacao.conteudo_estruturado.objetivo}
              </div>
            )}
            {temConteudoEstruturado ? (
              participacao.conteudo_estruturado.seccoes.map((sec, idx) => (
                <div key={idx} className={idx > 0 ? 'mt-5' : ''}>
                  <h3 className="text-[19px] font-bold mb-2" style={{ fontFamily: FONT_TITLE, color: FT.navyDeep }}>{sec.titulo}</h3>
                  {sec.imagem_url && (
                    <img src={sec.imagem_url} alt="" className="w-full max-h-[220px] object-cover rounded-[10px] mb-2.5" style={{ border: `1px solid ${FT.border}` }} />
                  )}
                  {sec.paragrafos?.map((p, pIdx) => (
                    <p key={pIdx} className="text-[14px] leading-relaxed mb-2" style={{ color: FT.ink }}>{p}</p>
                  ))}
                  {sec.lista && (
                    <ul className="mt-1 pl-[18px] list-disc space-y-1">
                      {sec.lista.map((item, lIdx) => (
                        <li key={lIdx} className="text-[14px] leading-relaxed" style={{ color: FT.ink }}>{item}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))
            ) : (
              <div className="rounded-2xl overflow-hidden bg-slate-900 aspect-video flex items-center justify-center">
                {conteudoLoading ? (
                  <Loader2 className="animate-spin text-white" size={28} />
                ) : media?.tipo === 'video' ? (
                  <video src={media.src} controls className="w-full h-full" />
                ) : media?.tipo === 'embed' ? (
                  <iframe src={media.src} className="w-full h-full" allow="autoplay; encrypted-media" allowFullScreen title="Conteúdo da formação" />
                ) : media?.tipo === 'pdf' ? (
                  <iframe src={`${media.src}#toolbar=0`} className="w-full h-full bg-white" title="Conteúdo da formação" />
                ) : null}
              </div>
            )}
            {!temConteudoEstruturado && (
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest mt-2" style={{ color: FT.inkSoft, fontFamily: FONT_MONO }}>
                {media?.tipo === 'pdf' ? <FileText size={12} /> : <PlayCircle size={12} />}
                {media?.tipo === 'pdf' ? 'Documento' : 'Vídeo'}
              </div>
            )}
          </div>
          <div className={STICKY_FOOTER_CLS} style={stickyFooterStyle()}>
            <button onClick={() => setStep('questionario')} disabled={conteudoLoading} className={BTN_PRIMARY_CLS} style={btnPrimaryStyle(conteudoLoading)}>
              Concluí a leitura, avançar para o questionário
            </button>
          </div>
        </div>
      )}

      {step === 'questionario' && (() => {
        const q = participacao.questionario[perguntaIdx];
        const qi = perguntaIdx;
        return (
          <div>
            <div className="flex items-center gap-1 mb-3.5">
              {participacao.questionario.map((_, i) => (
                <div
                  key={i}
                  className="flex-1 h-[4px] rounded-full transition-colors"
                  style={{ background: i < perguntaIdx ? FT.ok : i === perguntaIdx ? FT.orange : FT.border }}
                />
              ))}
            </div>
            <div className="mb-[22px]">
              <p className="text-[11px] font-semibold" style={{ fontFamily: FONT_MONO, color: FT.orangeDeep }}>
                PERGUNTA {qi + 1} / {participacao.questionario.length}
              </p>
              <p className="text-[15px] font-semibold my-1 leading-snug" style={{ color: FT.navyDeep }}>{q.pergunta}</p>
              {q.imagem_url && (
                <img src={q.imagem_url} alt="" className="w-full max-h-[180px] object-cover rounded-[10px] mb-2.5" style={{ border: `1px solid ${FT.border}` }} />
              )}
              {q.opcoes.map((op, oi) => {
                const selecionada = respostas[qi] === oi;
                return (
                  <label
                    key={oi}
                    onClick={() => setRespostas(prev => prev.map((r, i) => i === qi ? oi : r))}
                    className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-[9px] mb-2 cursor-pointer text-[13.5px] border-[1.5px] transition-colors"
                    style={{ borderColor: selecionada ? FT.orange : FT.border, background: selecionada ? '#FFF6EA' : 'transparent' }}
                  >
                    <input
                      type="radio"
                      name={`pergunta-${qi}`}
                      checked={selecionada}
                      onChange={() => setRespostas(prev => prev.map((r, i) => i === qi ? oi : r))}
                      className="w-4 h-4 shrink-0"
                      style={{ accentColor: FT.orange }}
                    />
                    <span>{op}</span>
                  </label>
                );
              })}
            </div>
            <div className={`${STICKY_FOOTER_CLS} flex gap-2.5`} style={stickyFooterStyle()}>
              {perguntaIdx > 0 && (
                <button
                  type="button"
                  onClick={() => setPerguntaIdx(i => i - 1)}
                  disabled={busy}
                  className="py-3 px-4 rounded-[9px] font-semibold text-[14.5px] border-[1.5px] transition-all disabled:opacity-50 flex items-center gap-1 shrink-0"
                  style={{ borderColor: FT.navy, color: FT.navy }}
                >
                  <ChevronLeft size={16} /> Anterior
                </button>
              )}
              {naUltimaPergunta ? (
                <button
                  onClick={submeterQuestionario}
                  disabled={!todasRespondidas || busy}
                  className={`${BTN_PRIMARY_CLS} flex-1`}
                  style={btnPrimaryStyle(!todasRespondidas || busy)}
                >
                  {busy ? 'A submeter...' : 'Submeter Respostas'}
                </button>
              ) : (
                <button
                  onClick={() => setPerguntaIdx(i => i + 1)}
                  disabled={!perguntaAtualRespondida}
                  className={`${BTN_PRIMARY_CLS} flex-1`}
                  style={btnPrimaryStyle(!perguntaAtualRespondida)}
                >
                  Seguinte
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {step === 'resultado' && (() => {
        const aprovado = resultado?.aprovado;
        const circumference = 364;
        const nota = resultado?.nota_obtida || 0;
        const offset = circumference - (circumference * nota / 100);
        return (
          <div className="text-center py-2.5">
            <div className="relative w-[132px] h-[132px] mx-auto mb-4">
              <svg width="132" height="132" viewBox="0 0 132 132" className="absolute inset-0" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="66" cy="66" r="58" fill="none" stroke="#EDEAE1" strokeWidth="10" />
                <circle
                  cx="66" cy="66" r="58" fill="none"
                  stroke={aprovado ? FT.ok : FT.bad}
                  strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                  style={{ transition: 'stroke-dashoffset .6s ease' }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[34px] font-extrabold" style={{ fontFamily: FONT_TITLE, color: FT.navyDeep }}>
                  {nota}<span className="text-[15px] font-semibold ml-0.5" style={{ color: FT.inkSoft }}>%</span>
                </span>
              </div>
            </div>
            <p className="text-[22px] font-bold mb-1.5" style={{ fontFamily: FONT_TITLE, color: aprovado ? FT.ok : FT.bad }}>
              {aprovado ? 'Aprovado' : 'Não atingiste a nota mínima'}
            </p>
            <p className="text-[13.5px] mb-6" style={{ color: FT.inkSoft }}>
              {aprovado
                ? `Nota mínima exigida: ${participacao.nota_minima_aprovacao}%. Concluído com sucesso.`
                : `Nota mínima exigida: ${participacao.nota_minima_aprovacao}%. Podes rever o conteúdo e tentar novamente.`}
            </p>
            <button
              onClick={aprovado ? () => setStep('assinatura') : tentarNovamente}
              className={BTN_PRIMARY_CLS}
              style={btnPrimaryStyle(false)}
            >
              {aprovado ? 'Avançar para Assinatura' : 'Tentar Novamente'}
            </button>
          </div>
        );
      })()}

      {step === 'assinatura' && (
        assinado ? (
          <div className="flex items-center gap-2 justify-center rounded-[10px] py-4 font-bold text-[15px]" style={{ background: FT.okBg, color: FT.ok }}>
            <CheckCircle2 size={18} /> Formação concluída e assinada
          </div>
        ) : (
          <SignatureCanvas onConfirm={handleAssinar} busy={busy} workerName={currentUser?.name} />
        )
      )}
    </div>
  );
}
