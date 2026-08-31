import React, { useEffect, useState } from 'react';
import {
  ChevronLeft, Flame, Box, Award, ShieldCheck, Wrench, Wind, UserPlus, GraduationCap,
  Zap, CircleDot, Layers, PenTool, Ruler, Eye, Scissors, Compass, Building2, Cylinder, Database,
  FileCheck, ClipboardCheck, Shield, HardHat, Container, ArrowUpDown, ChevronsUp,
  TowerControl, HeartPulse, Siren, Move, Anchor, ClipboardList, FileText, MapPin,
} from 'lucide-react';
import SignDrawModal from '../../../components/worker/SignDrawModal';
import ModalShell from '../../../components/common/ModalShell';
import FormacaoElearningFlow from './FormacaoElearningFlow';
import { listMinhasFormacoes, assinarMinhaFormacao } from './formacaoWorkerApi';
import { CATEGORIAS } from '../../admin/formacao-interna/formacaoTemplates';
import { FT, FONT_TITLE, FONT_MONO, SCALE } from './formacaoDesignTokens';

const CATEGORIA_LABEL = Object.fromEntries(CATEGORIAS.map(c => [c.id, c.label]));

// Ícone por categoria — usado como recurso de reserva quando o tipo_formacao
// não tem ícone dedicado (ex: tipo escrito livremente pelo admin).
const CATEGORIA_ICON = {
  soldadura: Flame,
  caldeiraria: Box,
  certificacao_formal: Award,
  hst: ShieldCheck,
  equipamentos: Wrench,
  gwo: Wind,
  onboarding: UserPlus,
};

// Ícone específico por tipo_formacao, para diferenciar visualmente cada
// formação na lista do trabalhador, mesmo dentro da mesma categoria.
const TIPO_ICON = {
  // Soldadura
  'MIG/MAG (135/136)': Zap,
  'TIG (141)': Flame,
  'Elétrodo Revestido (111)': CircleDot,
  'Arco Submerso (121)': Layers,
  'Leitura de Desenho Técnico': PenTool,
  'Preparação de Bordos': Ruler,
  'Inspeção Visual de Soldadura': Eye,
  // Caldeiraria
  'Corte e Conformação de Chapa': Scissors,
  'Quinagem/Calandragem': Box,
  'Traçagem': Compass,
  'Montagem de Estruturas': Building2,
  'Tubagem Industrial': Cylinder,
  'Reservatórios': Database,
  // Certificação formal
  'ISO 9606-1': Award,
  'WPS (Welding Procedure Specification)': FileCheck,
  'WPQR (Welding Procedure Qualification Record)': ClipboardCheck,
  // HST
  'Segurança em Trabalhos de Soldadura': ShieldCheck,
  'Segurança em Trabalhos de Caldeiraria': Shield,
  'EPI para Soldadura': HardHat,
  'Ventilação e Extração de Fumos': Wind,
  'Trabalhos a Quente': Flame,
  'Manuseamento de Gases Industriais': Container,
  // Equipamentos
  'Ponte Rolante': ArrowUpDown,
  'Plataforma Elevatória': ChevronsUp,
  // GWO
  'BST Trabalhos em Altura': TowerControl,
  'BST Primeiros Socorros': HeartPulse,
  'BST Combate a Incêndio': Siren,
  'BST Movimentação Manual': Move,
  'BST Sobrevivência no Mar': Anchor,
  // Onboarding
  'Compromisso de Início de Atividade': ClipboardList,
  'Procedimentos Internos': FileText,
  'Regras do Cliente/Estaleiro': MapPin,
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

  const handleAssinarPresencial = async (assinaturaBase64) => {
    if (!signAlvo) return;
    setSignBusy(true);
    try {
      await assinarMinhaFormacao(signAlvo.participante_id, assinaturaBase64);
      setSignAlvo(null);
      await fetchParticipacoes();
      onChanged?.();
    } catch (e) {
      setError(e.message);
    }
    setSignBusy(false);
  };

  const handleElearningFinalizado = async () => {
    setElearningAlvo(null);
    await fetchParticipacoes();
    onChanged?.();
  };

  const abrirParticipacao = (p) => {
    setError('');
    if (p.formato === 'e-learning') {
      setElearningAlvo(p);
    } else {
      setSignAlvo(p);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <ModalShell
        isOpen
        onClose={onClose}
        busy={signBusy}
        closeOnOverlay={false}
        subtitle={elearningAlvo ? (CATEGORIA_LABEL[elearningAlvo.categoria] || elearningAlvo.categoria) : undefined}
        title={elearningAlvo ? elearningAlvo.tipo_formacao : 'As tuas formações'}
        icon={elearningAlvo ? (
          <button
            onClick={() => setElearningAlvo(null)}
            aria-label="Voltar"
            className="w-full h-full flex items-center justify-center rounded-[14px] transition-all"
          >
            <ChevronLeft size={20} />
          </button>
        ) : (
          <GraduationCap size={20} />
        )}
        accent="brand"
        size="2xl"
      >
        <div className="px-4 py-4 min-h-full" style={{ background: FT.bg }}>
          {error && <div className="mb-4 p-3 rounded-xl text-xs font-bold" style={{ background: FT.badBg, color: FT.bad }}>{error}</div>}

          {elearningAlvo ? (
            <div className="rounded-[14px] p-5" style={{ background: FT.panel, border: `1px solid ${FT.border}` }}>
              <FormacaoElearningFlow
                participacao={elearningAlvo}
                currentUser={currentUser}
                onFinalizado={handleElearningFinalizado}
                onError={setError}
              />
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-16" style={{ color: FT.slate }}>
              <span className="animate-pulse text-xs font-bold" style={{ fontFamily: FONT_MONO }}>A CARREGAR...</span>
            </div>
          ) : participacoes.length === 0 ? (
            <p className="text-center py-10 text-xs font-bold" style={{ color: FT.slate }}>Ainda não tens formações registadas.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {participacoes.map(p => {
                const concluidoTotal = !!p.assinado_em;
                const Icone = TIPO_ICON[p.tipo_formacao] || CATEGORIA_ICON[p.categoria] || GraduationCap;
                // Rótulo como verbo de ação, não de estado — "Por iniciar"/
                // "Em progresso" descreviam a situação mas não diziam o que
                // o toque na linha faz. e-learning: só "nao_iniciado" abre a
                // primeira etapa; qualquer outro estado por concluir
                // (em progresso, reprovado a repetir, ou já aprovado no
                // questionário mas por assinar) retoma a seguir, logo
                // "Terminar". Presencial não tem duas fases — a única ação
                // é a assinatura em si. (Feedback do Diego, 2026-08-31.)
                const statusLabel = concluidoTotal
                  ? 'Concluído'
                  : p.formato === 'e-learning'
                    ? (p.estado_conclusao === 'nao_iniciado' ? 'Iniciar' : 'Terminar')
                    : 'Assinar';
                return (
                  <div
                    key={p.participante_id}
                    onClick={() => !concluidoTotal && abrirParticipacao(p)}
                    className="relative overflow-hidden rounded-[14px] flex gap-3.5 items-start p-4 transition-transform"
                    style={{
                      background: FT.panel,
                      border: `1px solid ${FT.border}`,
                      cursor: concluidoTotal ? 'default' : 'pointer',
                    }}
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-[5px]" style={{ background: concluidoTotal ? FT.ok : FT.navy }} />
                    <div className="w-[42px] h-[42px] rounded-[10px] flex items-center justify-center shrink-0" style={{ background: FT.navy }}>
                      <Icone size={20} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[16px] leading-tight mb-0.5" style={{ fontFamily: FONT_TITLE, color: FT.navyDeep }}>{p.tipo_formacao}</p>
                      <p className={`${SCALE.text.body} uppercase tracking-wide`} style={{ fontFamily: FONT_MONO, color: FT.slate }}>
                        {CATEGORIA_LABEL[p.categoria] || p.categoria} · {p.duracao_horas}h · {p.formato === 'e-learning' ? 'e-learning' : 'presencial'}
                      </p>
                      {p.estado_conclusao === 'reprovado' && !concluidoTotal && (
                        <p className={`${SCALE.text.meta} mt-1`} style={{ color: FT.bad }}>Última tentativa: {p.nota_obtida}% (mínimo {p.nota_minima_aprovacao}%)</p>
                      )}
                      {p.data_validade && (
                        <p className={`${SCALE.text.meta} mt-1`} style={{ color: FT.slate }}>Válido até {new Date(p.data_validade).toLocaleDateString('pt-PT')}</p>
                      )}
                    </div>
                    <span
                      className={`${SCALE.text.body} px-2.5 py-1 rounded-full shrink-0 whitespace-nowrap`}
                      style={concluidoTotal ? { background: FT.okBg, color: FT.ok } : { background: '#F0EEE7', color: FT.inkSoft }}
                    >
                      {statusLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </ModalShell>

      {signAlvo && (
        <SignDrawModal
          workerName={currentUser?.name}
          working={signBusy}
          onClose={() => !signBusy && setSignAlvo(null)}
          onSign={handleAssinarPresencial}
        />
      )}
    </>
  );
}
