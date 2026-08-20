// Registo de ícones-ilustração usados no e-learning de Formação Interna.
// Em vez de fotografias de stock, cada secção de conteúdo e cada pergunta
// do questionário é ilustrada com um ícone de traço (lucide-react) dentro
// de um "tile" com as cores da marca — consistente, sem dependências
// externas e sem repetição visual entre formações.
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

// Tile de ilustração — usado tanto no fluxo do trabalhador como na pré-
// visualização do admin. `height` em px controla o tamanho do tile.
export function IlustracaoTile({ nome, height = 150, className = '' }) {
  const Cmp = ICON_MAP[nome];
  if (!Cmp) return null;
  return (
    <div
      className={`w-full flex items-center justify-center rounded-[10px] ${className}`}
      style={{ height, background: `linear-gradient(135deg, ${FT.bg} 0%, #E5E1D6 100%)`, border: `1px solid ${FT.border}` }}
    >
      <div
        className="rounded-full flex items-center justify-center"
        style={{ width: Math.round(height * 0.46), height: Math.round(height * 0.46), background: 'rgba(235,141,0,0.14)' }}
      >
        <Cmp size={Math.round(height * 0.24)} color={FT.navy} strokeWidth={1.6} />
      </div>
    </div>
  );
}
