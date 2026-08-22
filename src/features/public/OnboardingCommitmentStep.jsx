import React, {
  useState, useEffect, useRef, useCallback,
  forwardRef, useImperativeHandle,
} from 'react';
import { AlertCircle, Check } from 'lucide-react';

// Ao alterar este texto, incrementar LEGAL_TEXT_VERSION e atualizar o texto
// equivalente em supabase/functions/submit-onboarding-commitment/pdfGenerator.ts.
// Os dois textos devem ser IDÊNTICOS para que o hash SHA-256 seja consistente.
export const LEGAL_TEXT_VERSION = 'v1.0';
export const LEGAL_TEXT = `COMPROMISSO DE INÍCIO DE ATIVIDADE
(Contrato-Promessa de Trabalho, nos termos do artigo 103.º do Código do Trabalho)

Cláusula 1.ª (Identificação das Partes)

Entre:
Magnetic Place Unipessoal, Lda., pessoa coletiva n.º 517379740, com sede na Trofa, neste ato representada por quem tem poderes para o efeito, adiante designada por "Primeira Contraente" ou "Empregadora"; e

[Nome completo do trabalhador], [estado civil], titular do documento de identificação n.º [_____], válido até [__/__/____], contribuinte fiscal (NIF) n.º [_____] e, se aplicável, número de identificação de Segurança Social (NISS) n.º [_____], residente em [morada completa], adiante designado por "Segundo Contraente" ou "Trabalhador",

é celebrado, de boa-fé e em termos inequívocos, o presente Compromisso de Início de Atividade, que se rege pelas cláusulas seguintes e, no que nelas for omisso, pelo Código do Trabalho e pela lei civil aplicável.

Cláusula 2.ª (Objeto e compromisso assumido)

1. O Segundo Contraente promete, de forma livre e esclarecida, iniciar funções ao serviço da Primeira Contraente na categoria profissional de [soldador / mecânico / outra], no dia [__/__/____], com o local de trabalho em [___] ou nas obras/clientes a que venha a ser afeto.

2. A Primeira Contraente promete admitir o Segundo Contraente na data e categoria referidas, mediante a retribuição base ilíquida mensal de [_____] €, acrescida das demais prestações e subsídios legalmente devidos.

3. As partes declaram, em termos inequívocos, obrigar-se a celebrar o contrato de trabalho prometido na data de início acima indicada.

Cláusula 3.ª (Efeitos imediatos da aceitação e custos assumidos pela Empregadora)

O Segundo Contraente reconhece e aceita que, a partir da aceitação do presente Compromisso e com vista a assegurar o início de atividade na data acordada, a Primeira Contraente fica legalmente obrigada a, e incorre de imediato em custos e obrigações com, nomeadamente:

a) A comunicação da admissão do Trabalhador à Segurança Social, dentro do prazo legalmente exigível antes do início da produção de efeitos do contrato;
b) A inclusão do Trabalhador na apólice de seguro obrigatório de acidentes de trabalho, com o correspondente encargo de prémio;
c) Os demais atos administrativos internos de admissão e afetação do Trabalhador.

Cláusula 4.ª (Incumprimento e responsabilidade)

1. O incumprimento culposo do presente Compromisso por qualquer das partes dá lugar à responsabilidade civil do contraente faltoso pelos danos causados à contraparte, nos termos gerais, conforme o artigo 103.º, n.º 2, do Código do Trabalho.

2. Sem prejuízo da prova dos danos efetivamente sofridos, as partes reconhecem que se incluem entre os danos ressarcíveis resultantes do não início de funções por facto imputável ao Trabalhador, a título exemplificativo e não exaustivo: (a) os custos de admissão e de comunicação à Segurança Social; (b) o prémio de seguro de acidentes de trabalho suportado em razão da inclusão do Trabalhador na apólice; (c) os custos administrativos internos; e (d) os custos de substituição do Trabalhador, incluindo nova procura e recrutamento e prejuízos decorrentes do atraso na afetação a obra ou cliente.

3. As partes reconhecem expressamente que, nos termos do artigo 103.º, n.º 3, do Código do Trabalho, não é aplicável a execução específica prevista no artigo 830.º do Código Civil, não podendo qualquer das partes ser obrigada à celebração forçada do contrato prometido, restando unicamente a via indemnizatória.

Cláusula 5.ª (Boa-fé e liberdade de trabalho)

O presente Compromisso não limita, restringe ou condiciona a liberdade de trabalho do Segundo Contraente, constitucionalmente garantida, tendo por único efeito o dever de indemnizar os danos causados por incumprimento culposo, nos termos das cláusulas anteriores.

Cláusula 6.ª (Declaração de leitura, aceitação e assinatura)

O Segundo Contraente declara ter lido, compreendido e aceite integralmente todas as cláusulas do presente Compromisso, que assina de forma livre e esclarecida.`;

// Substitui os placeholders do template pelos dados já recolhidos do
// candidato/convite — usado APENAS para exibição (ecrã e PDF). O hash
// SHA-256 é sempre calculado sobre o LEGAL_TEXT original, nunca sobre este
// texto personalizado, para preservar a integridade do versionamento.
// Mantém IDÊNTICA à função personalizarTexto() em
// supabase/functions/submit-onboarding-commitment/pdfGenerator.ts.
export function personalizarTexto(template, dados = {}) {
  const fmtData = (iso) => {
    if (!iso) return null;
    const [y, m, d] = iso.split('-');
    return (y && m && d) ? `${d}/${m}/${y}` : iso;
  };
  const fmtMoeda = (v) => (v === null || v === undefined || v === '') ? null : Number(v).toFixed(2);

  const subs = [
    [/\[Nome completo do trabalhador\]/g, dados.nome],
    [/\[estado civil\]/g, dados.estado_civil],
    [/titular do documento de identificação n\.º \[_____\]/g, dados.documento ? `titular do documento de identificação n.º ${dados.documento}` : null],
    [/válido até \[__\/__\/____\]/g, fmtData(dados.documento_validade) ? `válido até ${fmtData(dados.documento_validade)}` : null],
    [/contribuinte fiscal \(NIF\) n\.º \[_____\]/g, dados.nif ? `contribuinte fiscal (NIF) n.º ${dados.nif}` : null],
    [/número de identificação de Segurança Social \(NISS\) n\.º \[_____\]/g, dados.nis ? `número de identificação de Segurança Social (NISS) n.º ${dados.nis}` : null],
    [/residente em \[morada completa\]/g, dados.morada ? `residente em ${dados.morada}` : null],
    [/na categoria profissional de \[soldador \/ mecânico \/ outra\]/g, dados.profissao ? `na categoria profissional de ${dados.profissao}` : null],
    [/no dia \[__\/__\/____\]/g, fmtData(dados.data_inicio) ? `no dia ${fmtData(dados.data_inicio)}` : null],
    [/com o local de trabalho em \[___\]/g, dados.local_trabalho ? `com o local de trabalho em ${dados.local_trabalho}` : null],
    [/retribuição base ilíquida mensal de \[_____\] €/g, fmtMoeda(dados.vencimento_base) ? `retribuição base ilíquida mensal de ${fmtMoeda(dados.vencimento_base)} €` : null],
  ];

  let out = template;
  for (const [pattern, replacement] of subs) {
    if (replacement) out = out.replace(pattern, replacement);
  }
  return out;
}

// Calcula SHA-256 do texto legal (para versionamento e auditoria)
async function sha256hex(text) {
  const encoded = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Trim do canvas para remover espaço vazio em redor da assinatura
function getTrimmedDataURL(canvas) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  let minX = width, minY = height, maxX = 0, maxY = 0;
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      if (data[(row * width + col) * 4 + 3] > 0) {
        if (col < minX) minX = col;
        if (col > maxX) maxX = col;
        if (row < minY) minY = row;
        if (row > maxY) maxY = row;
      }
    }
  }
  if (minX > maxX || minY > maxY) return canvas.toDataURL('image/png');
  const pad = Math.round(10 * (window.devicePixelRatio || 1));
  const cx = Math.max(0, minX - pad), cy = Math.max(0, minY - pad);
  const cw = Math.min(width, maxX + pad) - cx;
  const ch = Math.min(height, maxY + pad) - cy;
  const tmp = document.createElement('canvas');
  tmp.width = cw; tmp.height = ch;
  tmp.getContext('2d').drawImage(canvas, cx, cy, cw, ch, 0, 0, cw, ch);
  return tmp.toDataURL('image/png');
}

function StatusDot({ done, label }) {
  return (
    <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${
      done ? 'text-emerald-600' : 'text-slate-300'
    }`}>
      <div className={`w-2 h-2 rounded-full transition-all ${done ? 'bg-emerald-500' : 'bg-slate-200'}`} />
      {label}
    </div>
  );
}

// Expõe getSignature() via ref para o pai chamar no momento do submit
const OnboardingCommitmentStep = forwardRef(function OnboardingCommitmentStep(
  { nome, dados, onReadyChange, submitting },
  ref,
) {
  const scrollRef  = useRef(null);
  const canvasRef  = useRef(null);
  const drawing    = useRef(false);

  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [accepted, setAccepted]                 = useState(false);
  const [hasInk,   setHasInk]                   = useState(false);
  const [legalHash, setLegalHash]               = useState('');

  // Calcular hash uma vez no mount
  useEffect(() => { sha256hex(LEGAL_TEXT).then(setLegalHash); }, []);

  const textoExibido = personalizarTexto(LEGAL_TEXT, dados);

  const isReady = scrolledToBottom && accepted && hasInk && !!legalHash;

  // Notificar pai quando o estado de prontidão muda
  useEffect(() => { onReadyChange(isReady); }, [isReady, onReadyChange]);

  // Expor getSignature() ao pai via ref
  useImperativeHandle(ref, () => ({
    getSignature: () => {
      if (!isReady || !canvasRef.current) return null;
      return {
        signature: getTrimmedDataURL(canvasRef.current),
        hash:      legalHash,
        version:   LEGAL_TEXT_VERSION,
      };
    },
  }), [isReady, legalHash]);

  // Setup do canvas
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const setup = () => {
      const parent = c.parentElement;
      if (!parent) return;
      const ratio  = window.devicePixelRatio || 1;
      const cssW   = parent.clientWidth;
      const cssH   = 180;
      c.width  = cssW * ratio;
      c.height = cssH * ratio;
      c.style.width  = cssW + 'px';
      c.style.height = cssH + 'px';
      const ctx = c.getContext('2d');
      ctx.scale(ratio, ratio);
      ctx.lineWidth   = 2.5;
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';
      ctx.strokeStyle = '#1B3A57';
    };
    setup();
    window.addEventListener('resize', setup);
    return () => window.removeEventListener('resize', setup);
  }, []);

  // Detecção de scroll até ao fundo (margem de 5px)
  const handleScroll = useCallback((e) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop <= el.clientHeight + 5) {
      setScrolledToBottom(true);
    }
  }, []);

  // Eventos de desenho no canvas
  const getPos = (e) => {
    const c = canvasRef.current;
    const r = c.getBoundingClientRect();
    const src = e.touches?.[0] ?? e;
    return { x: src.clientX - r.left, y: src.clientY - r.top };
  };

  const startDraw = (e) => {
    if (!accepted || submitting) return;
    e.preventDefault();
    drawing.current = true;
    const { x, y } = getPos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const draw = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const { x, y } = getPos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasInk(true);
  };
  const endDraw = (e) => {
    if (!drawing.current) return;
    e?.preventDefault?.();
    drawing.current = false;
    canvasRef.current?.getContext('2d')?.closePath();
  };

  const clearSignature = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    const ratio = window.devicePixelRatio || 1;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1B3A57';
    setHasInk(false);
  };

  return (
    <div className="space-y-5">

      {/* Cabeçalho do passo */}
      <div>
        <h2 className="font-black text-slate-800 text-xl normal-case leading-snug">
          Compromisso de Início de Atividade
        </h2>
        <p className="text-xs text-slate-500 normal-case mt-1">
          Leia o documento na íntegra, aceite os termos e aponte a sua assinatura.
        </p>
      </div>

      {/* Bloco scrollable com texto legal */}
      <div className="relative">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="bg-white border border-slate-200 rounded-2xl p-5 overflow-y-auto text-[11.5px] text-slate-700 leading-relaxed font-medium normal-case"
          style={{ height: 340 }}
        >
          <p className="font-black text-slate-800 text-xs mb-3 pb-3 border-b border-slate-100 uppercase tracking-widest">
            Documento legal — leia antes de assinar
          </p>
          <pre className="whitespace-pre-wrap font-sans">{textoExibido}</pre>
        </div>

        {/* Gradiente + indicador de scroll */}
        {!scrolledToBottom && (
          <div
            className="absolute bottom-0 left-0 right-0 h-16 rounded-b-2xl pointer-events-none flex flex-col items-center justify-end pb-2"
            style={{ background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.97))' }}
          >
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest animate-bounce">
              ↓ Role até ao fim para continuar
            </p>
          </div>
        )}
        {scrolledToBottom && (
          <div className="absolute bottom-3 right-4 flex items-center gap-1 text-[10px] text-emerald-600 font-bold">
            <Check size={11} /> Documento lido
          </div>
        )}
      </div>

      {/* Checkbox de aceitação */}
      <div className={`bg-white rounded-2xl border transition-all ${
        scrolledToBottom ? 'border-slate-200' : 'border-slate-100 opacity-50'
      } p-4`}>
        <label className={`flex items-start gap-3 ${scrolledToBottom ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
          <input
            type="checkbox"
            checked={accepted}
            disabled={!scrolledToBottom}
            onChange={e => setAccepted(e.target.checked)}
            className="mt-0.5 w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:cursor-not-allowed"
          />
          <span className="text-xs text-slate-600 leading-relaxed normal-case">
            Li o documento na íntegra e aceito os termos do{' '}
            <strong className="text-slate-800">Compromisso de Início de Atividade</strong>{' '}
            apresentado acima.
          </span>
        </label>
        {!scrolledToBottom && (
          <p className="mt-2 ml-8 text-[10px] text-slate-400 font-bold">
            Role o documento até ao fim para ativar esta opção.
          </p>
        )}
      </div>

      {/* Canvas de assinatura */}
      <div className={`bg-white rounded-2xl border border-slate-200 overflow-hidden transition-opacity ${
        !accepted ? 'opacity-40' : 'opacity-100'
      }`}>
        {/* Cabeçalho do canvas */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div>
            <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest">
              Assinatura Digital
            </p>
            {nome && (
              <p className="text-[10px] text-slate-400 normal-case mt-0.5">{nome}</p>
            )}
          </div>
          {hasInk && (
            <button
              type="button"
              onClick={clearSignature}
              disabled={!accepted || submitting}
              className="text-[10px] text-slate-400 hover:text-rose-500 font-bold uppercase tracking-widest transition-colors disabled:opacity-40"
            >
              Limpar
            </button>
          )}
        </div>

        {/* Área de desenho */}
        <div
          className="relative bg-slate-50/50"
          style={{ height: 180, touchAction: 'none' }}
        >
          <canvas
            ref={canvasRef}
            className={`w-full h-full block ${accepted ? 'cursor-crosshair' : 'cursor-not-allowed'}`}
            style={{ touchAction: 'none', height: '100%' }}
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={endDraw}
            onMouseLeave={endDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={endDraw}
            onTouchCancel={endDraw}
          />
          {!hasInk && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <p className="text-slate-300 text-xs font-bold uppercase tracking-widest">
                {accepted ? 'Desenha a tua assinatura aqui' : 'Aceita os termos primeiro'}
              </p>
            </div>
          )}
        </div>

        {/* Linha de assinatura */}
        <div className="px-5 pb-3 pt-2">
          <div className="border-t border-slate-300 mt-1" />
          <p className="text-[9px] text-slate-400 mt-1.5 text-center font-medium uppercase tracking-widest">
            Assinatura do/a Trabalhador/a
          </p>
        </div>
      </div>

      {/* Indicadores de progresso do passo */}
      <div className="flex flex-wrap gap-4">
        <StatusDot done={scrolledToBottom} label="Documento lido" />
        <StatusDot done={accepted}         label="Termos aceites" />
        <StatusDot done={hasInk}           label="Assinatura aposta" />
      </div>

      {/* Nota de segurança */}
      {isReady && (
        <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
          <Check size={14} className="text-emerald-600 mt-0.5 shrink-0" />
          <p className="text-xs text-emerald-700 font-medium leading-relaxed normal-case">
            Tudo preenchido. Clica em <strong>Confirmar Compromisso</strong> para finalizar o processo.
          </p>
        </div>
      )}
    </div>
  );
});

export default OnboardingCommitmentStep;
