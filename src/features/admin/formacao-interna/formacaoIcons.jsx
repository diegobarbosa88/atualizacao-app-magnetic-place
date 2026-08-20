// Registo de ilustrações do e-learning de Formação Interna. Em vez de
// fotografias de stock ou de ícones abstratos, cada secção de conteúdo e
// cada pergunta do questionário é ilustrada com um "boneco" (figura em
// traço, estilo pictograma, cores da marca) em ação, com um pequeno emblema
// do tema (lucide-react) — consistente, sem dependências externas e sem
// repetição visual entre formações.
import {
  BookOpen, Info, AlertTriangle, AlertOctagon, Skull, HardHat, Glasses, Footprints, Shirt, EarOff,
  Wind, Hand, CloudFog, Fan, Flame, FireExtinguisher, Siren, ShieldAlert, LifeBuoy, PhoneCall,
  HeartPulse, Cross, Bandage, Cog, Settings2, GaugeCircle, Lock, Unlock, ShieldCheck, ArrowUpDown,
  Move, PersonStanding, Weight, Cylinder, FlaskConical, Container, Thermometer, Zap, ZapOff,
  CheckCircle2, ListChecks, Notebook, BookMarked, MessageSquare, FileWarning, Flag, Ruler,
  MoveHorizontal, Clock, Eye, TimerReset, ClipboardCheck, ClipboardList, FileCheck, FileSignature,
  Warehouse, Boxes, PackageCheck, Droplets, Search, ScanSearch, Tag, Tags, CircleCheck, CircleX,
  Volume2, VolumeX, ShieldOff, Scissors, HandMetal, DoorOpen, UserCheck, ThermometerSun, Radiation,
  SprayCan, Wrench, Gauge,
} from 'lucide-react';
import { FT } from '../../worker/worker-dashboard/formacaoDesignTokens';

export const ICON_MAP = {
  BookOpen, Info, AlertTriangle, AlertOctagon, Skull, HardHat, Glasses, Footprints, Shirt, EarOff,
  Wind, Hand, CloudFog, Fan, Flame, FireExtinguisher, Siren, ShieldAlert, LifeBuoy, PhoneCall,
  HeartPulse, Cross, Bandage, Cog, Settings2, GaugeCircle, Lock, Unlock, ShieldCheck, ArrowUpDown,
  Move, PersonStanding, Weight, Cylinder, FlaskConical, Container, Thermometer, Zap, ZapOff,
  CheckCircle2, ListChecks, Notebook, BookMarked, MessageSquare, FileWarning, Flag, Ruler,
  MoveHorizontal, Clock, Eye, TimerReset, ClipboardCheck, ClipboardList, FileCheck, FileSignature,
  Warehouse, Boxes, PackageCheck, Droplets, Search, ScanSearch, Tag, Tags, CircleCheck, CircleX,
  Volume2, VolumeX, ShieldOff, Scissors, HandMetal, DoorOpen, UserCheck, ThermometerSun, Radiation,
  SprayCan, Wrench, Gauge,
};

export const ICON_NAMES = Object.keys(ICON_MAP);

// Cada ícone/tema é associado a uma pose do boneco — mantém a figura
// coerente com a ação descrita (a trabalhar, a alertar, a inspecionar, a
// comunicar) sem precisar de um desenho totalmente novo por tema.
const POSE_BY_ICON = {
  // alerta / risco / emergência a acionar
  AlertTriangle: 'alerta', AlertOctagon: 'alerta', Skull: 'alerta', ShieldAlert: 'alerta',
  FileWarning: 'alerta', CircleX: 'alerta', Siren: 'alerta', Zap: 'alerta', Flame: 'alerta',
  FireExtinguisher: 'alerta', SprayCan: 'alerta', Flag: 'alerta',
  // comunicar / reportar / socorrer
  PhoneCall: 'comunicar', MessageSquare: 'comunicar', HeartPulse: 'comunicar', LifeBuoy: 'comunicar',
  Cross: 'comunicar', Bandage: 'comunicar', UserCheck: 'comunicar',
  // inspecionar / verificar / ler
  Search: 'inspecionar', ScanSearch: 'inspecionar', ClipboardCheck: 'inspecionar', Eye: 'inspecionar',
  ClipboardList: 'inspecionar', BookOpen: 'inspecionar', Info: 'inspecionar', Notebook: 'inspecionar',
  FileCheck: 'inspecionar', FileSignature: 'inspecionar', Tag: 'inspecionar', Tags: 'inspecionar',
  CircleCheck: 'inspecionar', CheckCircle2: 'inspecionar', ListChecks: 'inspecionar', BookMarked: 'inspecionar',
  GaugeCircle: 'inspecionar', Clock: 'inspecionar', TimerReset: 'inspecionar',
};

function poseFor(nome) {
  return POSE_BY_ICON[nome] || 'trabalhar';
}

// Escolhe uma de 3 silhuetas de boneco a partir do nome do tema — determinístico
// (o mesmo tema mostra sempre o mesmo boneco), mas varia entre temas diferentes
// para o e-learning não parecer sempre a mesma figura repetida.
function varianteFor(nome) {
  if (!nome) return 0;
  let soma = 0;
  for (let i = 0; i < nome.length; i++) soma += nome.charCodeAt(i);
  return soma % 3;
}

// Braço em forma de cápsula, rodado a partir do ombro.
function Braco({ ombroX, ombroY, angulo, cor, comprimento = 30 }) {
  return (
    <g transform={`rotate(${angulo} ${ombroX} ${ombroY})`}>
      <rect x={ombroX - 4} y={ombroY} width={8} height={comprimento} rx={4} fill={cor} />
      <circle cx={ombroX} cy={ombroY + comprimento} r={5} fill={FT.orange} />
    </g>
  );
}

// Cenário de oficina/estaleiro em traço simples, atrás do boneco — bancada
// de trabalho, prateleira de ferramentas na parede e linha de chão, para o
// boneco parecer "no ambiente de trabalho" e não a flutuar num fundo vazio.
function Ambiente() {
  const linha = FT.slate;
  return (
    <g opacity="0.55">
      {/* linha de chão */}
      <line x1="2" y1="109" x2="98" y2="109" stroke={linha} strokeWidth="1.6" />
      {/* bancada de trabalho, à esquerda (canto oposto ao emblema) */}
      <line x1="3" y1="94" x2="28" y2="94" stroke={linha} strokeWidth="2.2" strokeLinecap="round" />
      <line x1="6" y1="94" x2="6" y2="109" stroke={linha} strokeWidth="1.6" />
      <line x1="25" y1="94" x2="25" y2="109" stroke={linha} strokeWidth="1.6" />
      {/* caixa de ferramentas em cima da bancada */}
      <rect x="10" y="86" width="11" height="7" rx="1.2" fill="none" stroke={linha} strokeWidth="1.4" />
      <line x1="13.5" y1="86" x2="13.5" y2="83.5" stroke={linha} strokeWidth="1.4" />
      <line x1="17.5" y1="86" x2="17.5" y2="83.5" stroke={linha} strokeWidth="1.4" />
      {/* prateleira de ferramentas na parede, no topo */}
      <line x1="70" y1="14" x2="96" y2="14" stroke={linha} strokeWidth="1.8" strokeLinecap="round" />
      <line x1="76" y1="14" x2="76" y2="24" stroke={linha} strokeWidth="1.3" />
      <circle cx="76" cy="26.5" r="2.4" fill="none" stroke={linha} strokeWidth="1.3" />
      <line x1="88" y1="14" x2="88" y2="22" stroke={linha} strokeWidth="1.3" />
      <rect x="84.5" y="22" width="7" height="3" rx="1" fill="none" stroke={linha} strokeWidth="1.3" />
    </g>
  );
}

// Cabeça + proteção — 3 silhuetas distintas para dar variedade aos bonecos
// sem depender de fotografias: capacete de obra, óculos de proteção com
// cabelo preso, e gorro/proteção auricular.
function Cabeca({ variante }) {
  const navy = FT.navy;
  const orange = FT.orange;

  if (variante === 1) {
    // Óculos de proteção + cabelo preso num carrapito, sem capacete.
    return (
      <>
        <circle cx="50" cy="26" r="13" fill={navy} />
        <circle cx="50" cy="14.5" r="4.5" fill={navy} />
        <rect x="39" y="23" width="9" height="6" rx="2.5" fill="none" stroke={orange} strokeWidth="2" />
        <rect x="52" y="23" width="9" height="6" rx="2.5" fill="none" stroke={orange} strokeWidth="2" />
        <line x1="48" y1="26" x2="52" y2="26" stroke={orange} strokeWidth="2" />
      </>
    );
  }

  if (variante === 2) {
    // Gorro/touca justa + proteção auricular (earmuffs).
    return (
      <>
        <circle cx="50" cy="26" r="13" fill={navy} />
        <path d="M36.5 22 A13.5 13.5 0 0 1 63.5 22 L63.5 24 L36.5 24 Z" fill={FT.orangeDeep} />
        <circle cx="37" cy="27" r="5" fill={orange} />
        <circle cx="63" cy="27" r="5" fill={orange} />
        <line x1="41" y1="15" x2="59" y2="15" stroke={FT.orangeDeep} strokeWidth="2.4" strokeLinecap="round" />
      </>
    );
  }

  // Variante 0 — capacete de obra (silhueta original).
  return (
    <>
      <circle cx="50" cy="26" r="13" fill={navy} />
      <path d="M37 24 A13 13 0 0 1 63 24 L63 27 L37 27 Z" fill={orange} />
      <rect x="35" y="25" width="30" height="4" rx="2" fill={FT.orangeDeep} />
    </>
  );
}

// Figura humana em traço simples (estilo pictograma), com poses e silhuetas
// de cabeça distintas — usada em todos os "tiles" de ilustração do e-learning.
function Boneco({ pose = 'trabalhar', variante = 0 }) {
  const navy = FT.navy;
  const orange = FT.orange;
  let leftArm = { angulo: 12 };
  let rightArm = { angulo: -12 };
  let inclinacao = 0;

  if (pose === 'trabalhar') {
    leftArm = { angulo: 45 };
    rightArm = { angulo: -100 };
  } else if (pose === 'alerta') {
    leftArm = { angulo: 10 };
    rightArm = { angulo: -165 };
  } else if (pose === 'comunicar') {
    leftArm = { angulo: 8 };
    rightArm = { angulo: -175 };
  } else if (pose === 'inspecionar') {
    leftArm = { angulo: 95 };
    rightArm = { angulo: -95 };
    inclinacao = 10;
  }

  return (
    <g transform={`rotate(${inclinacao} 50 60)`}>
      <ellipse cx="50" cy="112" rx="22" ry="4" fill={navy} opacity="0.1" />
      {/* pernas */}
      <rect x="40" y="78" width="8" height="28" rx="4" fill={navy} />
      <rect x="52" y="78" width="8" height="28" rx="4" fill={navy} />
      <rect x="38" y="102" width="12" height="7" rx="3" fill={orange} />
      <rect x="50" y="102" width="12" height="7" rx="3" fill={orange} />
      {/* braços (atrás do tronco) */}
      <Braco ombroX={34} ombroY={50} angulo={leftArm.angulo} cor={navy} />
      <Braco ombroX={66} ombroY={50} angulo={rightArm.angulo} cor={navy} />
      {/* tronco */}
      <rect x="34" y="44" width="32" height="34" rx="12" fill={navy} />
      <rect x="34" y="66" width="32" height="6" fill={orange} />
      {/* cabeça + proteção (varia por tema) */}
      <Cabeca variante={variante} />
    </g>
  );
}

// Tile de ilustração — usado tanto no fluxo do trabalhador como na pré-
// visualização do admin. `height` em px controla o tamanho do tile.
export function IlustracaoTile({ nome, height = 150, className = '' }) {
  const Cmp = ICON_MAP[nome] || Info;
  const badge = Math.round(height * 0.34);
  return (
    <div
      className={`w-full relative flex items-center justify-center rounded-[10px] overflow-hidden ${className}`}
      style={{ height, background: `linear-gradient(135deg, ${FT.bg} 0%, #E5E1D6 100%)`, border: `1px solid ${FT.border}` }}
    >
      <svg viewBox="0 0 100 120" width={Math.round(height * 0.62)} height={height} style={{ overflow: 'visible' }}>
        <Ambiente />
        <Boneco pose={poseFor(nome)} variante={varianteFor(nome)} />
      </svg>
      <div
        className="absolute flex items-center justify-center rounded-full"
        style={{
          width: badge, height: badge, right: Math.round(height * 0.08), bottom: Math.round(height * 0.08),
          background: FT.panel, border: `1.5px solid ${FT.orange}`,
        }}
      >
        <Cmp size={Math.round(badge * 0.56)} color={FT.orangeDeep} strokeWidth={2} />
      </div>
    </div>
  );
}
