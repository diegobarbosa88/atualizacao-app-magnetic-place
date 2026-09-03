import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Sparkles, CheckCircle2 } from 'lucide-react';
import { FT, FONT_TITLE, FONT_MONO } from './formacaoDesignTokens';

const AUTOPLAY_MS = 4200;
const TIP_WIDTH = 272;

// Elementos fixos/sticky (topbar, barra de separadores) já estão sempre no
// viewport — chamar scrollIntoView neles tentaria centrar a posição que
// teriam no fluxo normal do documento, o que na prática arrastava a página
// sem necessidade. Só os cartões em fluxo normal (hero, calendário)
// precisam de scroll.
const NO_SCROLL_TARGETS = new Set(['welcome-anchor', 'bell', 'tab-horarios', 'tab-falta', 'tab-epi', 'tab-documentos', 'tab-formacao', 'tab-perfil']);

function buildSteps({ firstName, epiEnabled, hasFalta }) {
  const nome = firstName || 'colega';
  const steps = [
    { type: 'full', icon: Sparkles, title: `Bem-vindo ao teu painel, ${nome}!`, body: 'Aqui vais registar as tuas horas, ver os teus turnos e tratar de documentos e formações. Uma volta rápida — leva menos de um minuto.', cta: 'Começar tour' },
    { type: 'spot', target: 'welcome-anchor', title: 'O teu espaço', body: 'O teu nome e função ficam sempre visíveis aqui em cima — é o teu painel, só teu.' },
    { type: 'spot', target: 'hero-stats', title: 'As tuas horas, sempre à vista', body: 'Horas de hoje, do mês, e o que falta face ao teu horário — atualizado a cada registo.' },
    { type: 'spot', target: 'calendar', title: 'Registar o teu dia', body: 'Toca num dia do calendário para registares a tua entrada, pausa e saída.' },
    { type: 'spot', target: 'tab-horarios', title: 'O teu horário', body: 'Consulta aqui o turno que te foi atribuído: dias, entrada, saída e pausa.' },
  ];
  if (hasFalta) steps.push({ type: 'spot', target: 'tab-falta', title: 'Avisar uma falta', body: 'Precisas de faltar? Este atalho avisa a empresa em poucos toques, com o motivo.' });
  if (epiEnabled) steps.push({ type: 'spot', target: 'tab-epi', title: 'Equipamento de proteção', body: 'Pede aqui o teu EPI — tamanho, quantidade e motivo, em poucos toques.' });
  steps.push(
    { type: 'spot', target: 'tab-documentos', title: 'Documentos por assinar', body: 'Sempre que houver um documento novo, aparece aqui com aviso — como aconteceu agora, no teu acesso.' },
    { type: 'spot', target: 'tab-formacao', title: 'Formações', body: 'O mesmo vale para formações: as pendentes ficam aqui, com o número por concluir.' },
    { type: 'spot', target: 'tab-perfil', title: 'O teu perfil', body: 'Os teus dados, contrato e pedidos de alteração ficam aqui — e é também onde podes rever este tour outra vez.' },
    { type: 'spot', target: 'bell', title: 'Notificações e avisos', body: 'O sino reúne os teus avisos. Ativa também os avisos no telemóvel para nunca perderes nada importante.' },
    { type: 'full', icon: CheckCircle2, title: `Pronto, ${nome}!`, body: 'Já conheces o essencial. Podes rever este tour sempre que quiseres, a partir do teu Perfil.', cta: 'Concluir' },
  );
  return steps;
}

function getVisibleTarget(name) {
  const els = document.querySelectorAll(`[data-tour="${name}"]`);
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

// Coachmark tour disparado uma vez a seguir ao Gate de onboarding (ver
// app.jsx, prop autoStartTour) e reaberto manualmente a partir do Perfil
// (WorkerProfile.jsx, "Rever tour do painel"). Aponta sempre para os
// elementos REAIS do dashboard (via atributo data-tour, presente tanto na
// versão desktop como na barra inferior mobile — getVisibleTarget escolhe
// a que estiver de facto visível no viewport atual).
export default function WorkerDashboardTour({ isOpen, onClose, firstName, epiEnabled, hasFalta }) {
  const steps = useMemo(() => buildSteps({ firstName, epiEnabled, hasFalta }), [firstName, epiEnabled, hasFalta]);
  const [current, setCurrent] = useState(0);
  const [spotRect, setSpotRect] = useState(null);
  const [tipPos, setTipPos] = useState(null);
  const [tipVisible, setTipVisible] = useState(false);
  const tipRef = useRef(null);
  const scrollTimerRef = useRef(null);
  const autoTimerRef = useRef(null);

  useEffect(() => {
    if (isOpen) setCurrent(0);
  }, [isOpen]);

  const step = steps[current];

  // Medição + posicionamento do passo ativo.
  useEffect(() => {
    if (!isOpen || !step) return undefined;
    clearTimeout(scrollTimerRef.current);
    setTipVisible(false);

    if (step.type === 'full') {
      setSpotRect(null);
      requestAnimationFrame(() => setTipVisible(true));
      return undefined;
    }

    const measure = () => {
      const el = getVisibleTarget(step.target);
      if (!el) {
        // Elemento condicional ausente nesta configuração de trabalhador
        // (ex.: EPI desativado) — avança sem bloquear o tour.
        setCurrent((c) => Math.min(c + 1, steps.length - 1));
        return;
      }
      const pad = 8;
      const r = el.getBoundingClientRect();
      const rect = { left: r.left - pad, top: r.top - pad, width: r.width + pad * 2, height: r.height + pad * 2 };
      const cs = window.getComputedStyle(el);
      const br = parseFloat(cs.borderRadius);
      rect.radius = br > 0 ? cs.borderRadius : '16px';
      setSpotRect(rect);
      requestAnimationFrame(() => {
        const th = tipRef.current?.offsetHeight || 150;
        const belowSpace = window.innerHeight - (rect.top + rect.height);
        let top = belowSpace > th + 24 ? rect.top + rect.height + 12 : rect.top - th - 12;
        top = Math.max(10, Math.min(top, window.innerHeight - th - 10));
        let left = rect.left + rect.width / 2 - TIP_WIDTH / 2;
        left = Math.max(10, Math.min(left, window.innerWidth - TIP_WIDTH - 10));
        setTipPos({ left, top });
        setTipVisible(true);
      });
    };

    const el = getVisibleTarget(step.target);
    if (el && !NO_SCROLL_TARGETS.has(step.target)) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      scrollTimerRef.current = setTimeout(measure, 380);
    } else {
      measure();
    }
    return () => clearTimeout(scrollTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, isOpen]);

  // Reposiciona ao rolar/redimensionar, sem repetir o scrollIntoView.
  useEffect(() => {
    if (!isOpen || !step || step.type !== 'spot') return undefined;
    let raf;
    const reflow = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = getVisibleTarget(step.target);
        if (!el) return;
        const pad = 8;
        const r = el.getBoundingClientRect();
        setSpotRect((prev) => (prev ? { ...prev, left: r.left - pad, top: r.top - pad, width: r.width + pad * 2, height: r.height + pad * 2 } : prev));
      });
    };
    window.addEventListener('scroll', reflow, { passive: true });
    window.addEventListener('resize', reflow);
    return () => {
      window.removeEventListener('scroll', reflow);
      window.removeEventListener('resize', reflow);
      cancelAnimationFrame(raf);
    };
  }, [current, isOpen, step]);

  // Avanço automático — só nos passos com alvo real, nunca no ecrã de
  // boas-vindas/fecho (esses pedem confirmação do trabalhador).
  useEffect(() => {
    clearTimeout(autoTimerRef.current);
    if (!isOpen || !step || step.type !== 'spot') return undefined;
    autoTimerRef.current = setTimeout(() => goNext(), AUTOPLAY_MS);
    return () => clearTimeout(autoTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, isOpen]);

  if (!isOpen || !step) return null;

  const goNext = () => {
    if (current >= steps.length - 1) { onClose(); return; }
    setCurrent((c) => c + 1);
  };
  const goBack = () => setCurrent((c) => Math.max(0, c - 1));

  const spotIndices = steps.map((s, i) => (s.type === 'spot' ? i : -1)).filter((i) => i >= 0);
  const spotPos = spotIndices.indexOf(current);
  const Icon = step.icon;
  const isFull = step.type === 'full';

  return (
    <div className="fixed inset-0 z-[500]" style={{ pointerEvents: 'none' }}>
      <div
        className="absolute transition-all duration-[380ms] ease-out"
        style={spotRect
          ? { left: spotRect.left, top: spotRect.top, width: spotRect.width, height: spotRect.height, borderRadius: spotRect.radius, boxShadow: '0 0 0 2000px rgba(8,14,20,.72)' }
          : { left: '50vw', top: '50vh', width: 0, height: 0, boxShadow: '0 0 0 2000px rgba(8,14,20,.72)' }}
      />

      <div
        ref={tipRef}
        className={`absolute bg-white rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 ${tipVisible ? 'opacity-100' : 'opacity-0 translate-y-1.5'}`}
        style={isFull
          ? { left: '50%', top: '50%', width: 288, transform: `translate(-50%, -50%) ${tipVisible ? 'scale(1)' : 'scale(.97)'}`, pointerEvents: 'auto' }
          : { left: tipPos?.left ?? -9999, top: tipPos?.top ?? -9999, width: TIP_WIDTH, pointerEvents: 'auto' }}
      >
        <div className="h-[3px] bg-slate-100 overflow-hidden">
          {step.type === 'spot' && (
            <div key={current} className="h-full bg-[var(--orange)]" style={{ animation: `magnetic-tour-bar ${AUTOPLAY_MS}ms linear forwards` }} />
          )}
        </div>

        {current < steps.length - 1 && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-black/[0.06] text-slate-500 flex items-center justify-center hover:bg-black/10 transition-colors"
          >
            <X size={13} />
          </button>
        )}

        <div className={isFull ? 'px-6 pt-7 pb-5 text-center' : 'px-4 pt-4 pb-3.5'}>
          {isFull && (
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: FT.okBg, color: FT.ok }}>
              <Icon size={22} />
            </div>
          )}
          {!isFull && (
            <p className="text-[9.5px] font-bold uppercase tracking-widest mb-1.5" style={{ fontFamily: FONT_MONO, color: FT.orangeDeep }}>
              Passo {spotPos + 1} de {spotIndices.length}
            </p>
          )}
          <h3 className={isFull ? 'text-xl font-extrabold mb-1.5' : 'text-[17px] font-extrabold mb-1'} style={{ fontFamily: FONT_TITLE, color: FT.navy, lineHeight: 1.15 }}>
            {step.title}
          </h3>
          <p className={isFull ? 'text-[13.5px] leading-relaxed' : 'text-[12.5px] leading-snug'} style={{ color: FT.inkSoft }}>
            {step.body}
          </p>
        </div>

        <div className={`flex items-center px-4 pb-3.5 ${isFull ? 'justify-center' : 'justify-between'}`}>
          {!isFull && (
            <div className="flex items-center gap-[5px]">
              {spotIndices.map((si) => (
                <span
                  key={si}
                  className="h-1.5 rounded-full transition-all"
                  style={{
                    width: si === current ? 16 : 6,
                    background: si < current ? FT.orangeDeep : si === current ? FT.orange : '#DCE3EA',
                  }}
                />
              ))}
            </div>
          )}
          <div className="flex items-center gap-1.5">
            {!isFull && current > 1 && (
              <button type="button" onClick={goBack} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-50 transition-colors">
                <ChevronLeft size={15} />
              </button>
            )}
            <button
              type="button"
              onClick={goNext}
              className={`flex items-center gap-1.5 font-bold rounded-xl text-white transition-transform active:scale-95 ${isFull ? 'text-[13px] px-6 py-2.5' : 'text-xs px-3.5 py-2'}`}
              style={{ background: FT.navy }}
            >
              {isFull ? step.cta : 'Seguinte'} <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      <style>{'@keyframes magnetic-tour-bar { from { width: 0%; } to { width: 100%; } }'}</style>
    </div>
  );
}
