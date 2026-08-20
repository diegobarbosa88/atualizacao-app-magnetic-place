import React, { useEffect, useState } from 'react';
import {
  X, ChevronLeft, Flame, Box, Award, ShieldCheck, Wrench, Wind, UserPlus, GraduationCap,
  Zap, CircleDot, Layers, PenTool, Ruler, Eye, Scissors, Compass, Building2, Cylinder, Database,
  FileCheck, ClipboardCheck, Shield, HardHat, Container, ArrowUpDown, ChevronsUp,
  TowerControl, HeartPulse, Siren, Move, Anchor, ClipboardList, FileText, MapPin,
} from 'lucide-react';
import SignDrawModal from '../../../components/worker/SignDrawModal';
import FormacaoElearningFlow from './FormacaoElearningFlow';
import { listMinhasFormacoes, assinarMinhaFormacao } from './formacaoWorkerApi';
import { CATEGORIAS } from '../../admin/formacao-interna/formacaoTemplates';
import { FT, FONT_TITLE, FONT_MONO } from './formacaoDesignTokens';

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

const STATUS_LABEL = {
  nao_iniciado: 'Por iniciar',
  em_progresso: 'Em progresso',
  reprovado: 'Reprovado',
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex flex-col sm:items-center sm:justify-center">
      <button className="flex-shrink-0 h-16 sm:hidden" onClick={onClose} aria-label="Fechar" />
      <div className="flex-1 sm:flex-none rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col sm:w-full sm:max-w-2xl sm:max-h-[85vh]" style={{ background: FT.bg }}>
        <div className="flex items-center gap-3 px-5 py-4 shrink-0 text-white" style={{ background: FT.navyDeep }}>
          {elearningAlvo ? (
            <button onClick={() => setElearningAlvo(null)} className="p-2 -ml-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-all shrink-0">
              <ChevronLeft size={18} />
            </button>
          ) : (
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: FT.orange }}>
              <GraduationCap size={16} className="text-white" />
            </div>
          )}
          <h2 className="flex-1 font-bold uppercase tracking-wide text-sm truncate" style={{ fontFamily: FONT_TITLE, color: '#fff' }}>
            {elearningAlvo ? elearningAlvo.tipo_formacao : 'As tuas formações'}
          </h2>
          <button onClick={onClose} className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-all">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-4 py-4">
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
                const statusLabel = concluidoTotal
                  ? 'Concluído'
                  : p.formato === 'e-learning'
                    ? (STATUS_LABEL[p.estado_conclusao] || 'Por iniciar')
                    : 'Por assinar';
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
                      <p className="text-[11px] uppercase tracking-wide" style={{ fontFamily: FONT_MONO, color: FT.slate }}>
                        {CATEGORIA_LABEL[p.categoria] || p.categoria} · {p.duracao_horas}h · {p.formato === 'e-learning' ? 'e-learning' : 'presencial'}
                      </p>
                      {p.estado_conclusao === 'reprovado' && !concluidoTotal && (
                        <p className="text-[10px] font-bold mt-1" style={{ color: FT.bad }}>Última tentativa: {p.nota_obtida}% (mínimo {p.nota_minima_aprovacao}%)</p>
                      )}
                      {p.data_validade && (
                        <p className="text-[10px] font-bold mt-1" style={{ color: FT.slate }}>Válido até {new Date(p.data_validade).toLocaleDateString('pt-PT')}</p>
                      )}
                    </div>
                    <span
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0 whitespace-nowrap"
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
      </div>

      {signAlvo && (
        <SignDrawModal
          workerName={currentUser?.name}
          working={signBusy}
          onClose={() => !signBusy && setSignAlvo(null)}
          onSign={handleAssinarPresencial}
        />
      )}
    </div>
  );
}
