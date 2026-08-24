import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  CheckCircle, ChevronLeft, ChevronRight, Loader2, AlertCircle, Check,
  User, Briefcase, Phone, Mail, CreditCard, MapPin, FileText, Users,
  Building2, Shield, Lock, Calendar, PenLine,
} from 'lucide-react';
import { sendOnboardingNotifAdmin } from '../../utils/emailUtils';
import { formatPersonName } from '../../utils/textUtils';
import { notifyEvent, TARGET } from '../../utils/notifyEvent';
import SelectProfissaoEmpresa from '../../components/SelectProfissaoEmpresa';
import OnboardingCommitmentStep from './OnboardingCommitmentStep';
import { SCALE } from '../../styles/designTokens';

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const TABELA_IRS_OPTIONS = [
  { value: 'tabelaI',   label: 'Tabela I — Não casado / Casado, dois titulares' },
  { value: 'tabelaII',  label: 'Tabela II — Não casado, com dependentes' },
  { value: 'tabelaIII', label: 'Tabela III — Casado, único titular' },
];

const STEPS = [
  { label: 'Dados Pessoais',    icon: User },
  { label: 'Situação Fiscal',   icon: FileText },
  { label: 'Dados Financeiros', icon: CreditCard },
  { label: 'Revisão',           icon: CheckCircle },
  { label: 'Compromisso',       icon: PenLine },
];

function validarNIF(nif) {
  if (!/^\d{9}$/.test(nif)) return false;
  const d = nif.split('').map(Number);
  let sum = 0;
  for (let i = 0; i < 8; i++) sum += d[i] * (9 - i);
  const rem = sum % 11;
  return d[8] === (rem < 2 ? 0 : 11 - rem);
}

function validarIBAN(raw) {
  const iban = raw.replace(/\s/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/.test(iban)) return false;
  const num = (iban.slice(4) + iban.slice(0, 4)).split('').map(c => isNaN(c) ? c.charCodeAt(0) - 55 : c).join('');
  let rem = 0;
  for (const c of num) rem = (rem * 10 + parseInt(c)) % 97;
  return rem === 1;
}

function validarNIS(nis) {
  return /^\d{11}$/.test(nis);
}

const ESTADO_CIVIL_OPTIONS = [
  { value: 'solteiro',       label: 'Solteiro(a)' },
  { value: 'casado',         label: 'Casado(a)' },
  { value: 'uniao_de_facto', label: 'União de facto' },
  { value: 'divorciado',     label: 'Divorciado(a)' },
  { value: 'viuvo',          label: 'Viúvo(a)' },
];

const EMPTY_FORM = {
  nome: '', profissao: '', profissao_cnp: '', data_nascimento: '', tel: '', email: '', dni: '', documento_validade: '', estado_civil: '', address: '',
  tabela_irs: 'tabelaI', n_dependentes: 0,
  nis: '', nif: '', iban: '',
};

// ─── Primitivos de UI ────────────────────────────────────────────

function InputField({ label, error, icon: Icon, children }) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-widest text-slate-700">
        {Icon && <Icon size={12} className="text-indigo-500" />}
        {label}
      </label>
      {children}
      {error && (
        <p className={`flex items-center gap-1 ${SCALE.text.body} text-rose-500`}>
          <AlertCircle size={11} /> {error}
        </p>
      )}
    </div>
  );
}

function Inp({ error, ...props }) {
  return (
    <input
      className={`w-full rounded-xl border px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition-all placeholder:text-slate-300 placeholder:font-normal normal-case
        ${error
          ? 'border-rose-300 bg-rose-50 focus:border-rose-400 focus:ring-2 focus:ring-rose-100'
          : 'border-slate-200 bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50'
        }`}
      {...props}
    />
  );
}

function Sel({ children, ...props }) {
  return (
    <select
      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 appearance-none normal-case"
      {...props}
    >
      {children}
    </select>
  );
}

function InfoBox({ color, children }) {
  const s = {
    blue:   'bg-blue-50 border-blue-100 text-blue-700',
    amber:  'bg-amber-50 border-amber-100 text-amber-700',
    slate:  'bg-slate-50 border-slate-200 text-slate-600',
  }[color] || 'bg-slate-50 border-slate-200 text-slate-600';
  return (
    <div className={`rounded-xl border px-4 py-3 text-xs font-medium leading-relaxed normal-case ${s}`}>
      {children}
    </div>
  );
}

// ─── Painel de marca (esquerda / topo) ───────────────────────────

function MobileHeader({ step }) {
  return (
    <div style={{ background: 'linear-gradient(160deg, #0F1F3D 0%, #1a3460 100%)' }}>
      <div className="px-5 pt-5 pb-5 space-y-4">
        {/* Linha 1: logo + marca */}
        <div className="flex items-center gap-3">
          <img
            src="/MAGNETIC (3).png"
            alt="Logo"
            className="h-14 w-14 object-contain"
            onError={e => { e.target.src = 'https://ui-avatars.com/api/?name=MP&background=4f46e5&color=fff'; }}
          />
          <div>
            <p className="text-white font-black text-2xl tracking-tight leading-none">MAGNETIC PLACE</p>
            <p className="text-slate-400 text-sm font-medium normal-case mt-1">Unipessoal, Lda</p>
          </div>
        </div>
        {/* Separador */}
        <div className="h-px bg-white/10" />
        {/* Linha 2: passo atual + dots */}
        <div className="flex items-end justify-between">
          <div>
            <p className={`text-slate-500 ${SCALE.text.badge} mb-1`}>
              Passo {step + 1} de {STEPS.length}
            </p>
            <p className="text-white text-base font-extrabold normal-case leading-none">
              {STEPS[step].label}
            </p>
          </div>
          <div className="flex items-center gap-1.5 pb-0.5">
            {STEPS.map((_, i) => (
              <div key={i} className={`rounded-full transition-all duration-300 ${
                i < step  ? 'w-2 h-2 bg-emerald-400' :
                i === step ? 'w-5 h-2 bg-indigo-400' :
                              'w-2 h-2 bg-white/15'
              }`} />
            ))}
          </div>
        </div>
      </div>
      {/* Linha âmbar de separação */}
      <div className="h-[3px] bg-amber-400/80" />
    </div>
  );
}

function BrandPanel({ step }) {
  return (
    <div
      className="flex flex-col justify-between h-full p-10"
      style={{ background: 'linear-gradient(160deg, #0F1F3D 0%, #1a3460 100%)' }}
    >
      {/* Logo + nome */}
      <div>
        <div className="flex items-center gap-3 mb-10">
          <img
            src="/MAGNETIC (3).png"
            alt="Logo"
            className="h-10 w-10 object-contain"
            onError={e => { e.target.src = 'https://ui-avatars.com/api/?name=MP&background=4f46e5&color=fff'; }}
          />
          <div>
            <p className="text-white font-black text-base tracking-tight leading-none" style={{ fontFamily: "'Big Shoulders Display', sans-serif" }}>
              MAGNETIC PLACE
            </p>
            <p className={`text-slate-400 ${SCALE.text.meta} mt-0.5`}>Unipessoal, Lda</p>
          </div>
        </div>

        <p className="text-white font-black text-xl leading-snug mb-3 normal-case">
          Ficha de Colaborador
        </p>
        <p className="text-slate-400 text-sm leading-relaxed normal-case">
          Preencha os seus dados para concluir o processo de registo.
          A informação é tratada de forma confidencial.
        </p>
      </div>

      {/* Passos */}
      <div className="space-y-3">
        {STEPS.map((s, i) => {
          const done = i < step;
          const active = i === step;
          const Icon = s.icon;
          return (
            <div key={i} className={`flex items-center gap-3 transition-all ${active ? 'opacity-100' : done ? 'opacity-60' : 'opacity-30'}`}>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all
                ${done ? 'bg-emerald-500' : active ? 'bg-indigo-500' : 'bg-white/10'}`}>
                {done ? <Check size={14} className="text-white" /> : <Icon size={14} className={active ? 'text-white' : 'text-slate-400'} />}
              </div>
              <span className={`text-sm font-bold normal-case ${active ? 'text-white' : 'text-slate-400'}`}>{s.label}</span>
              {active && <div className="flex-1 h-px bg-indigo-500/40" />}
            </div>
          );
        })}
      </div>

      {/* Rodapé */}
      <div className="pt-6 border-t border-white/10">
        <div className="flex items-center gap-2 text-slate-500">
          <Lock size={12} />
          <span className={`${SCALE.text.meta} normal-case`}>Dados protegidos — RGPD</span>
        </div>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────

export default function OnboardingForm({ token }) {
  const [pageState, setPageState] = useState('loading');
  const [invite, setInvite] = useState(null);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [rgpd, setRgpd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [commitmentReady, setCommitmentReady] = useState(false);
  const commitmentStepRef = useRef(null);

  useEffect(() => {
    if (!token) { setPageState('invalid'); return; }
    supabase
      .from('worker_onboarding_invites')
      .select('*')
      .eq('token', token)
      .maybeSingle()
      .then(({ data }) => {
        if (!data || data.status !== 'pending' || new Date(data.expires_at) < new Date()) {
          setPageState('invalid');
        } else {
          setInvite(data);
          setPageState('form');
        }
      });
  }, [token]);

  const set = (key, val) => {
    setForm(prev => ({ ...prev, [key]: val }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
  };

  function validateStep(s) {
    const errs = {};
    if (s === 0) {
      if (!form.nome.trim()) errs.nome = 'Nome é obrigatório.';
      if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Email inválido.';
    }
    if (s === 2) {
      if (form.nif && !validarNIF(form.nif)) errs.nif = 'NIF inválido — verifique os 9 dígitos e o dígito de controlo.';
      if (form.nis && !validarNIS(form.nis)) errs.nis = 'NIS inválido — deve ter exatamente 11 dígitos.';
      if (form.iban && !validarIBAN(form.iban)) errs.iban = 'IBAN inválido — verifique o formato e o checksum.';
    }
    if (s === 3) {
      if (!rgpd) errs.rgpd = 'É necessário aceitar os termos para continuar.';
    }
    return errs;
  }

  const goNext = () => {
    const errs = validateStep(step);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setStep(s => s + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goBack = () => {
    setStep(s => s - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async () => {
    // Obter dados do compromisso do componente filho via ref
    const commitment = commitmentStepRef.current?.getSignature();
    if (!commitment) {
      setErrors({ _submit: 'Complete todos os campos do compromisso antes de finalizar.' });
      return;
    }

    setSubmitting(true);
    setErrors({});
    try {
      // 1. Chamar edge function — grava compromisso, gera PDF e envia email
      const commitRes = await fetch(
        `${SUPABASE_URL}/functions/v1/submit-onboarding-commitment`,
        {
          method:  'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'apikey': SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            invite_id:          invite.id,
            nome:               form.nome,
            documento:          form.dni,
            documento_validade: form.documento_validade || undefined,
            estado_civil:       ESTADO_CIVIL_OPTIONS.find(o => o.value === form.estado_civil)?.label,
            nif:                form.nif || undefined,
            nis:                form.nis || undefined,
            morada:             form.address || undefined,
            profissao:          form.profissao || undefined,
            assinatura_base64: commitment.signature,
            texto_hash:       commitment.hash,
            texto_versao:     commitment.version,
            user_agent:       navigator.userAgent,
            email:            form.email || undefined,
          }),
        },
      );

      if (!commitRes.ok) {
        const errData = await commitRes.json().catch(() => ({}));
        throw new Error(errData.error || 'Erro ao processar o compromisso.');
      }
      const { commitment_id } = await commitRes.json();

      // 2. Inserir dados do formulário
      const submId = 'onb_sub_' + Date.now();
      const { error: insertErr } = await supabase.from('worker_onboarding_submissions').insert({
        id: submId, invite_id: invite.id, ...form,
        // O trabalhador escreve o nome à mão e cada um usa uma convenção —
        // normaliza aqui para o registo criado na aprovação já nascer coerente
        // com o resto da equipa.
        nome: formatPersonName(form.nome),
        n_dependentes: Number(form.n_dependentes) || 0,
        submitted_at: new Date().toISOString(), status: 'pending',
      });
      if (insertErr) throw insertErr;

      // 3. Ligar submission ao compromisso
      if (commitment_id) {
        await supabase.from('onboarding_commitments')
          .update({ submission_id: submId })
          .eq('id', commitment_id);
      }

      // 4. Marcar convite como usado
      await supabase.from('worker_onboarding_invites')
        .update({ status: 'used', used_at: new Date().toISOString() })
        .eq('id', invite.id);

      // 5. Notificação para o admin
      await notifyEvent(supabase, {
        idPrefix: 'notif_onb',
        title: 'Novo formulário de onboarding',
        message: `${form.nome} submeteu os dados e assinou o compromisso. Reveja em Equipa → Pendentes.`,
        type: 'info',
        target: TARGET.ADMIN,
        payload: { kind: 'onboarding' },
      });

      sendOnboardingNotifAdmin({ nome: form.nome, profissao: form.profissao })
        .catch(e => console.error('[onboarding] Email admin falhou:', e));

      setPageState('success');
    } catch (e) {
      console.error('[onboarding] Erro na submissão:', e);
      setErrors({ _submit: e.message || 'Ocorreu um erro ao enviar. Por favor tente novamente.' });
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Estados de ecrã inteiros ──────────────────────────────────

  if (pageState === 'loading') return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0F1F3D' }}>
      <div className="text-center space-y-4">
        <Loader2 className="text-indigo-400 animate-spin mx-auto" size={36} />
        <p className="text-slate-400 text-sm font-medium normal-case">A verificar o convite…</p>
      </div>
    </div>
  );

  if (pageState === 'invalid') return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#0F1F3D' }}>
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <img src="/MAGNETIC (3).png" alt="Logo" className="h-12 w-12 mx-auto mb-4 object-contain"
            onError={e => { e.target.src = 'https://ui-avatars.com/api/?name=MP&background=4f46e5&color=fff'; }} />
          <p className="text-slate-400 text-sm font-medium normal-case">Magnetic Place Unipessoal, Lda</p>
        </div>
        <div className="bg-white rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-14 h-14 bg-rose-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <AlertCircle className="text-rose-500" size={28} />
          </div>
          <p className="font-black text-slate-800 text-xl mb-3 normal-case">
            Link inválido ou expirado
          </p>
          <p className="text-slate-500 text-sm leading-relaxed normal-case">
            Este link já foi utilizado ou expirou. Contacte a empresa para receber um novo convite.
          </p>
        </div>
      </div>
    </div>
  );

  if (pageState === 'success') return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#0F1F3D' }}>
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <img src="/MAGNETIC (3).png" alt="Logo" className="h-12 w-12 mx-auto mb-4 object-contain"
            onError={e => { e.target.src = 'https://ui-avatars.com/api/?name=MP&background=4f46e5&color=fff'; }} />
        </div>
        <div className="bg-white rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="text-emerald-500" size={32} />
          </div>
          <p className="font-black text-slate-800 text-2xl mb-3 normal-case">
            Enviado com sucesso!
          </p>
          <p className="text-slate-500 text-sm leading-relaxed mb-6 normal-case">
            Os seus dados foram recebidos e serão revistos pela equipa da Magnetic Place.
            Após aprovação, receberá as informações de acesso.
          </p>
          <div className="bg-slate-50 rounded-xl px-4 py-3">
            <p className="text-slate-400 text-xs font-medium normal-case">Pode fechar esta janela.</p>
          </div>
        </div>
      </div>
    </div>
  );

  // ─── Formulário ────────────────────────────────────────────────

  const tabelaLabel = TABELA_IRS_OPTIONS.find(o => o.value === form.tabela_irs)?.label || '';

  const progressPct = ((step) / (STEPS.length - 1)) * 100;

  return (
    <div className="min-h-screen lg:flex" style={{ background: '#0F1F3D' }}>

      {/* Mobile: barra compacta no topo */}
      <div className="lg:hidden">
        <MobileHeader step={step} />
      </div>

      {/* Desktop: painel lateral fixo */}
      <div className="hidden lg:block lg:w-80 lg:min-h-screen lg:sticky lg:top-0 lg:self-start">
        <BrandPanel step={step} />
      </div>

      {/* Painel do formulário */}
      <div className="flex-1 bg-slate-50 lg:min-h-screen flex flex-col">

        {/* Barra de progresso — só desktop (mobile já tem no cabeçalho) */}
        <div className="hidden lg:block bg-white border-b border-slate-100 px-6 lg:px-10 py-4">
          <div className="max-w-xl mx-auto lg:mx-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-extrabold text-slate-700 uppercase tracking-widest">
                {STEPS[step].label}
              </span>
              <span className="text-xs font-bold text-slate-500">{step + 1} / {STEPS.length}</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${step === 0 ? 10 : progressPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 px-6 lg:px-10 py-8">
          <div className="max-w-xl mx-auto lg:mx-0 space-y-5">

            {/* Passo 0 — Dados Pessoais */}
            {step === 0 && (<>
              <InputField label="Nome completo" icon={User} error={errors.nome}>
                <Inp error={errors.nome} value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Nome e apelido completos" />
              </InputField>
              <InputField label="Profissão / Cargo" icon={Briefcase}>
                <SelectProfissaoEmpresa
                  value={form.profissao_cnp}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 appearance-none normal-case"
                  onChange={(codigo, rotulo) => {
                    set('profissao_cnp', codigo);
                    set('profissao', rotulo);
                  }}
                />
              </InputField>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField label="Data de Nascimento" icon={Calendar}>
                  <Inp
                    type="date"
                    value={form.data_nascimento}
                    onChange={e => set('data_nascimento', e.target.value)}
                  />
                </InputField>
                <InputField label="Estado civil" icon={User}>
                  <div className="relative">
                    <Sel value={form.estado_civil} onChange={e => set('estado_civil', e.target.value)}>
                      <option value="">Selecionar…</option>
                      {ESTADO_CIVIL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </Sel>
                    <ChevronRight size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 rotate-90 pointer-events-none" />
                  </div>
                </InputField>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField label="Telemóvel" icon={Phone} error={errors.tel}>
                  <Inp inputMode="tel" value={form.tel} onChange={e => set('tel', e.target.value)} placeholder="+351 9XX XXX XXX" />
                </InputField>
                <InputField label="Email" icon={Mail} error={errors.email}>
                  <Inp error={errors.email} type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@exemplo.pt" />
                </InputField>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField label="Documento de identificação" icon={CreditCard}>
                  <Inp value={form.dni} onChange={e => set('dni', e.target.value)} placeholder="Nº CC / DNI / Passaporte" />
                </InputField>
                <InputField label="Válido até" icon={Calendar}>
                  <Inp type="date" value={form.documento_validade} onChange={e => set('documento_validade', e.target.value)} />
                </InputField>
              </div>
              <InputField label="Morada completa" icon={MapPin}>
                <Inp value={form.address} onChange={e => set('address', e.target.value)} placeholder="Rua, nº, localidade, código postal" />
              </InputField>
            </>)}

            {/* Passo 1 — Situação Fiscal */}
            {step === 1 && (<>
              <InputField label="Tabela de retenção IRS" icon={FileText}>
                <div className="relative">
                  <Sel value={form.tabela_irs} onChange={e => set('tabela_irs', e.target.value)}>
                    {TABELA_IRS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </Sel>
                  <ChevronRight size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 rotate-90 pointer-events-none" />
                </div>
              </InputField>
              <InputField label="Número de dependentes" icon={Users}>
                <Inp type="number" inputMode="numeric" min="0" max="20"
                  value={form.n_dependentes}
                  onChange={e => set('n_dependentes', e.target.value)} />
              </InputField>
              <InfoBox color="blue">
                A tabela de retenção IRS é determinada pela sua situação familiar e número de dependentes.
                Em caso de dúvida, consulte o modelo 3 do seu último IRS ou o Portal das Finanças.
              </InfoBox>
            </>)}

            {/* Passo 2 — Dados Financeiros */}
            {step === 2 && (<>
              <InputField label="NIF — Número de Identificação Fiscal" error={errors.nif}>
                <Inp error={errors.nif} inputMode="numeric" maxLength={9}
                  value={form.nif}
                  onChange={e => set('nif', e.target.value.replace(/\D/g, '').slice(0, 9))}
                  placeholder="9 dígitos" />
              </InputField>
              <InputField label="NIS — Número de Identificação na Segurança Social" error={errors.nis}>
                <Inp error={errors.nis} inputMode="numeric" maxLength={11}
                  value={form.nis}
                  onChange={e => set('nis', e.target.value.replace(/\D/g, '').slice(0, 11))}
                  placeholder="11 dígitos" />
              </InputField>
              <InputField label="IBAN" error={errors.iban}>
                <Inp error={errors.iban}
                  value={form.iban}
                  onChange={e => set('iban', e.target.value.toUpperCase().replace(/[^A-Z0-9\s]/g, ''))}
                  placeholder="PT50 0000 0000 0000 0000 0000 0" />
              </InputField>
              <InfoBox color="amber">
                <div className="flex gap-2">
                  <Shield size={14} className="shrink-0 mt-0.5 text-amber-500" />
                  <span>Estes dados são necessários exclusivamente para processamento salarial e cumprimento das obrigações legais. Nunca são partilhados com terceiros.</span>
                </div>
              </InfoBox>
            </>)}

            {/* Passo 3 — Revisão */}
            {step === 3 && (<>
              <div className="space-y-4">
                <ReviewBlock title="Dados Pessoais" accent="indigo">
                  <RRow label="Nome" value={form.nome} />
                  <RRow label="Estado civil" value={ESTADO_CIVIL_OPTIONS.find(o => o.value === form.estado_civil)?.label} />
                  <RRow label="Profissão" value={form.profissao} />
                  <RRow label="Telemóvel" value={form.tel} />
                  <RRow label="Email" value={form.email} />
                  <RRow label="Documento" value={form.dni} />
                  <RRow label="Válido até" value={form.documento_validade} />
                  <RRow label="Morada" value={form.address} />
                </ReviewBlock>
                <ReviewBlock title="Situação Fiscal" accent="violet">
                  <RRow label="Tabela IRS" value={tabelaLabel.split(' — ')[0]} />
                  <RRow label="Dependentes" value={String(form.n_dependentes)} />
                </ReviewBlock>
                <ReviewBlock title="Dados Financeiros" accent="amber">
                  <RRow label="NIF" value={form.nif} />
                  <RRow label="NIS" value={form.nis} />
                  <RRow label="IBAN" value={form.iban ? form.iban.replace(/(.{4})/g, '$1 ').trim() : ''} mono />
                </ReviewBlock>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <label className="flex items-start gap-4 cursor-pointer">
                  <div className="mt-0.5">
                    <input
                      type="checkbox"
                      checked={rgpd}
                      onChange={e => setRgpd(e.target.checked)}
                      className="w-5 h-5 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </div>
                  <span className="text-xs text-slate-600 leading-relaxed normal-case">
                    Autorizo a <strong className="text-slate-800">Magnetic Place Unipessoal, Lda</strong> a tratar os meus dados pessoais
                    para fins de processamento salarial e cumprimento de obrigações legais, nos termos do Regulamento Geral de Proteção de Dados (RGPD).
                  </span>
                </label>
              </div>

              {errors.rgpd && (
                <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
                  <AlertCircle size={14} className="text-rose-500 shrink-0" />
                  <p className="text-xs text-rose-600 font-semibold">{errors.rgpd}</p>
                </div>
              )}
            </>)}

            {/* Passo 4 — Compromisso */}
            {step === 4 && (
              <OnboardingCommitmentStep
                ref={commitmentStepRef}
                nome={form.nome}
                dados={{
                  nome: form.nome,
                  estado_civil: ESTADO_CIVIL_OPTIONS.find(o => o.value === form.estado_civil)?.label,
                  documento: form.dni,
                  documento_validade: form.documento_validade,
                  nif: form.nif,
                  nis: form.nis,
                  morada: form.address,
                  profissao: form.profissao,
                  data_inicio: invite?.data_inicio_prevista,
                  local_trabalho: invite?.local_trabalho_texto,
                  vencimento_base: invite?.vencimento_base,
                }}
                onReadyChange={setCommitmentReady}
                submitting={submitting}
              />
            )}

            {/* Erro global de submissão (passo 4) */}
            {step === 4 && errors._submit && (
              <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
                <AlertCircle size={14} className="text-rose-500 shrink-0" />
                <p className="text-xs text-rose-600 font-semibold">{errors._submit}</p>
              </div>
            )}
          </div>
        </div>

        {/* Navegação fixa no fundo */}
        <div className="sticky bottom-0 bg-white border-t border-slate-100 shadow-lg px-6 lg:px-10 py-4">
          <div className="max-w-xl mx-auto lg:mx-0 flex items-center justify-between gap-3">
            {step > 0 ? (
              <button
                onClick={goBack}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-slate-500 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all"
              >
                <ChevronLeft size={16} /> Anterior
              </button>
            ) : <span />}

            {step < STEPS.length - 1 ? (
              <button
                onClick={goNext}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] shadow-md shadow-indigo-200 transition-all ml-auto"
              >
                Seguinte <ChevronRight size={16} />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!commitmentReady || submitting}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] shadow-md shadow-emerald-200 transition-all ml-auto disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <PenLine size={16} />}
                {submitting ? 'A submeter…' : 'Confirmar Compromisso'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Componentes de revisão ────────────────────────────────────────

function ReviewBlock({ title, accent, children }) {
  const accents = {
    indigo: { dot: 'bg-indigo-500', label: 'text-indigo-600 bg-indigo-50' },
    violet: { dot: 'bg-violet-500', label: 'text-violet-600 bg-violet-50' },
    amber:  { dot: 'bg-amber-400',  label: 'text-amber-600 bg-amber-50'  },
  };
  const a = accents[accent] || accents.indigo;
  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-50">
        <div className={`w-2 h-2 rounded-full ${a.dot}`} />
        <span className={`${SCALE.text.badge} px-2 py-0.5 rounded-md ${a.label}`}>{title}</span>
      </div>
      <div className="px-5 py-2 divide-y divide-slate-50">{children}</div>
    </div>
  );
}

function RRow({ label, value, mono }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span className={`${SCALE.text.statLabel} text-slate-400 w-20 shrink-0 pt-0.5`}>{label}</span>
      <span className={`text-sm text-slate-700 break-all normal-case ${mono ? 'font-mono font-medium' : 'font-semibold'}`}>{value}</span>
    </div>
  );
}
