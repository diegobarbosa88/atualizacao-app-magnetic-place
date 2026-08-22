import React, { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Camadas de sobreposição da app.
 *
 * Os modais feitos à mão espalharam-se por z-50, z-[60], z-[100], z-[150],
 * z-[160], z-[200], z-[210], z-[9998], z-[9999] e z-[10000] — sem nenhuma
 * regra, e por isso com casos de um modal a abrir por baixo de outro.
 * Quem precisar de empilhar usa estes valores em vez de inventar mais um.
 */
export const Z = {
  dropdown: 40,   // menus de contexto ancorados a um botão
  modal: 100,     // modal normal
  nested: 200,    // modal aberto a partir de outro modal
  viewer: 300,    // pré-visualização de documento em ecrã quase inteiro
  toast: 400,     // avisos transitórios, sempre por cima de tudo
};

/**
 * Três variantes, não sete.
 *
 * Havia indigo, orange, rose, slate, navy, navyOrange e navyGradient — sendo
 * que `orange` nunca chegou a ser usado e navy/navyOrange/navyGradient eram
 * quase indistinguíveis. O que um modal precisa de dizer é só: sou neutro,
 * sou a ação principal, ou vou destruir alguma coisa.
 */
const ACCENT = {
  default: { iconBg: 'bg-slate-100',           iconColor: 'text-slate-600'  },
  brand:   { iconBg: 'bg-[#1B3A57]/[0.08]',    iconColor: 'text-[#1B3A57]'  },
  danger:  { iconBg: 'bg-rose-50',             iconColor: 'text-rose-600'   },
};

// Nomes antigos → novos. Mantidos para nenhum call site partir durante a
// migração dos 76 modais feitos à mão; podem sair quando ela terminar.
const ACCENT_ALIAS = {
  indigo: 'default', orange: 'default', slate: 'default',
  rose: 'danger',
  navy: 'brand', navyOrange: 'brand', navyGradient: 'brand',
};

const SIZE_MAP = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-xl',
  '2xl': 'sm:max-w-2xl',
  '3xl': 'sm:max-w-3xl',
  '4xl': 'sm:max-w-4xl',
  '5xl': 'sm:max-w-5xl',
  '6xl': 'sm:max-w-6xl',
  clientWide: 'sm:max-w-[1180px]',
  // Para pré-visualizar documentos: ocupa quase o ecrã todo. Era isto que
  // levava o DocxPreviewModal e os overlays de relatório a não usarem o shell.
  viewer: 'sm:max-w-[92vw]',
};

export default function ModalShell({
  isOpen,
  onClose,
  title,
  // Sobrescrito por cima do título, em maiúsculas — serve para CATEGORIA
  // ("Cliente · Ficha"), não para dados do registo.
  subtitle,
  // Por baixo do título, em caixa normal — para o contexto do registo
  // ("FT 2026/114 · Ferrocal · 1.240,50 €"). Pôr isto no `subtitle` deixava
  // um número de fatura e um valor em maiúsculas com tracking largo.
  meta,
  icon,
  accent = 'default',
  size = 'lg',
  layer = 'modal',
  footer,
  closeOnOverlay = true,
  // Enquanto houver uma operação em curso (a gravar, a enviar, a importar),
  // o modal não pode ser fechado por Esc, por clique fora nem pelo X.
  //
  // Existe porque o Esc foi acrescentado a todos os modais de uma vez: antes
  // da migração nenhum destes o tinha, e sem esta guarda passava a ser
  // possível desmontar o modal com um POST em voo — o utilizador nunca via a
  // confirmação e ficava sem saber se a operação passou.
  busy = false,
  children,
}) {
  useEffect(() => {
    if (!isOpen || busy) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, busy, onClose]);

  if (!isOpen) return null;

  const sizeClass = SIZE_MAP[size] || SIZE_MAP.lg;
  const resolvedAccent = ACCENT_ALIAS[accent] || accent;
  const a = ACCENT[resolvedAccent] || ACCENT.default;
  const isBrand = resolvedAccent === 'brand';
  const isViewer = size === 'viewer';

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex flex-col justify-end sm:items-center sm:justify-center p-0 sm:p-4"
      style={{ zIndex: Z[layer] ?? Z.modal }}
      onMouseDown={closeOnOverlay && !busy ? (e) => { if (e.target === e.currentTarget) onClose?.(); } : undefined}
    >
      <div
        className={`bg-white rounded-t-3xl sm:rounded-[2rem] shadow-2xl w-full ${sizeClass} flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300`}
        style={{ maxHeight: isViewer ? 'min(94dvh, 94vh)' : 'min(92dvh, 92vh)', height: isViewer ? '94vh' : undefined }}
      >
        <div className="shrink-0">
          <div className={`flex items-center gap-3.5 px-6 py-4 bg-white ${isBrand ? '' : 'border-b border-slate-100'}`}>
            {/* Ícone opcional: os modais financeiros feitos à mão não têm
                nenhum, e obrigá-los a inventar um era metade da razão para
                não usarem o shell. */}
            {icon && (
              <div className={`w-11 h-11 rounded-[14px] ${a.iconBg} ${a.iconColor} flex items-center justify-center shrink-0`}>
                {icon}
              </div>
            )}
            <div className="flex-1 min-w-0">
              {subtitle && (
                <p
                  style={{ fontFamily: 'var(--mono)' }}
                  className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 truncate mb-0.5"
                >
                  {subtitle}
                </p>
              )}
              <h2 className="text-2xl font-bold leading-[1.05] tracking-[0.01em] text-[#1B3A57] truncate">{title}</h2>
              {meta && <p className="text-[12px] font-semibold text-slate-500 truncate mt-0.5">{meta}</p>}
            </div>
            <button
              onClick={onClose}
              disabled={busy}
              aria-label="Fechar"
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all shrink-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              <X size={18} />
            </button>
          </div>
          {/* O filete da marca só nos modais de ação principal (ficha de
              cliente, colaborador, horário). Num "Eliminar registo?" seria
              peso sem função. */}
          {isBrand && <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #EB8D00, #ffb444)' }} />}
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain min-h-0">
          {children}
        </div>

        {/* Fixo, nunca a rolar com o conteúdo — é a diferença mais visível
            face aos modais à mão, que deixam os botões a fugir para baixo. */}
        {footer && <div className="shrink-0 border-t border-slate-100">{footer}</div>}
      </div>
    </div>
  );
}
