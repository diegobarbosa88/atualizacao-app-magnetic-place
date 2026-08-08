import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { CheckCircle, ChevronLeft, ChevronRight, Loader2, AlertCircle, Copy, Check } from 'lucide-react';
import CompanyLogo from '../../components/common/CompanyLogo';
import { sendOnboardingNotifAdmin } from '../../utils/emailUtils';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const TABELA_IRS_OPTIONS = [
  { value: 'tabelaI',   label: 'Tabela I — Trabalho dependente (geral)' },
  { value: 'tabelaII',  label: 'Tabela II — Pensões' },
  { value: 'tabelaIII', label: 'Tabela III — Trabalho dependente (não casado, 2 titulares)' },
];

const STEPS = ['Dados Pessoais', 'Situação Fiscal', 'Dados Financeiros', 'Revisão'];

function validarNIF(nif) {
  if (!/^\d{9}$/.test(nif)) return false;
  const d = nif.split('').map(Number);
  let sum = 0;
  for (let i = 0; i < 8; i++) sum += d[i] * (9 - i);
  const rem = sum % 11;
  const expected = rem < 2 ? 0 : 11 - rem;
  return d[8] === expected;
}

function validarIBAN(raw) {
  const iban = raw.replace(/\s/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numeric = rearranged.split('').map(c => isNaN(c) ? c.charCodeAt(0) - 55 : c).join('');
  let rem = 0;
  for (const c of numeric) rem = (rem * 10 + parseInt(c)) % 97;
  return rem === 1;
}

function validarNIS(nis) {
  if (!/^\d{11}$/.test(nis)) return false;
  const d = nis.split('').map(Number);
  const w = [29, 23, 19, 17, 13, 11, 7, 5, 3, 2];
  const sum = d.slice(0, 10).reduce((acc, v, i) => acc + v * w[i], 0);
  return d[10] === (9 - ((sum - 1) % 10)) % 10;
}

const inputCls = 'w-full bg-white border border-slate-200 rounded-lg py-2 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all placeholder:font-normal placeholder:text-slate-400';
const inputErrCls = 'w-full bg-white border border-rose-400 rounded-lg py-2 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-50 transition-all placeholder:font-normal placeholder:text-slate-400';
const labelCls = 'block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1';

function Field({ label, error, children }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
      {error && <p className="text-[11px] text-rose-500 font-bold mt-1">{error}</p>}
    </div>
  );
}

const EMPTY_FORM = {
  nome: '', profissao: '', tel: '', email: '', dni: '', address: '',
  tabela_irs: 'tabelaI', n_dependentes: 0,
  nis: '', nif: '', iban: '',
};

export default function OnboardingForm({ token }) {
  const [pageState, setPageState] = useState('loading'); // loading | invalid | form | success
  const [invite, setInvite] = useState(null);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [rgpd, setRgpd] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
      if (form.nis && !validarNIS(form.nis)) errs.nis = 'NIS inválido — deve ter 11 dígitos com dígito de controlo correto.';
      if (form.iban && !validarIBAN(form.iban)) errs.iban = 'IBAN inválido — verifique o formato e o checksum.';
    }
    return errs;
  }

  const goNext = () => {
    const errs = validateStep(step);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setStep(s => s + 1);
  };

  const goBack = () => setStep(s => s - 1);

  const handleSubmit = async () => {
    const errs = validateStep(2);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSubmitting(true);
    try {
      const submId = 'onb_sub_' + Date.now();
      const { error: insertErr } = await supabase.from('worker_onboarding_submissions').insert({
        id: submId,
        invite_id: invite.id,
        ...form,
        n_dependentes: Number(form.n_dependentes) || 0,
        submitted_at: new Date().toISOString(),
        status: 'pending',
      });
      if (insertErr) throw insertErr;

      await supabase
        .from('worker_onboarding_invites')
        .update({ status: 'used', used_at: new Date().toISOString() })
        .eq('id', invite.id);

      await supabase.from('app_notifications').insert({
        id: 'notif_onb_' + Date.now(),
        title: 'Novo formulário de onboarding',
        message: `${form.nome} submeteu os seus dados. Reveja em Equipa → Pendentes.`,
        type: 'info',
        target_type: 'admin',
        is_dismissible: true,
        is_active: true,
        created_at: new Date().toISOString(),
        dismissed_by_ids: [],
        viewed_by_ids: [],
      });

      sendOnboardingNotifAdmin({ nome: form.nome, profissao: form.profissao }).catch(e =>
        console.error('[onboarding] Email admin falhou:', e)
      );

      setPageState('success');
    } catch (e) {
      console.error('[onboarding] Erro na submissão:', e);
      setErrors({ _submit: 'Ocorreu um erro ao enviar. Por favor tente novamente.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (pageState === 'loading') return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0F1F3D' }}>
      <Loader2 className="text-white animate-spin" size={32} />
    </div>
  );

  if (pageState === 'invalid') return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#0F1F3D' }}>
      <div className="max-w-sm w-full text-center">
        <CompanyLogo className="h-12 w-12 mx-auto mb-6" />
        <div className="bg-white/10 backdrop-blur rounded-2xl p-8">
          <AlertCircle className="text-rose-400 mx-auto mb-4" size={40} />
          <h1 className="text-white font-bold text-xl mb-2" style={{ fontFamily: "'Big Shoulders Display', sans-serif" }}>
            Link inválido ou expirado
          </h1>
          <p className="text-slate-300 text-sm">
            Este link já foi utilizado ou expirou. Contacte a empresa para receber um novo convite.
          </p>
        </div>
      </div>
    </div>
  );

  if (pageState === 'success') return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#0F1F3D' }}>
      <div className="max-w-sm w-full text-center">
        <CompanyLogo className="h-12 w-12 mx-auto mb-6" />
        <div className="bg-white/10 backdrop-blur rounded-2xl p-8">
          <CheckCircle className="text-emerald-400 mx-auto mb-4" size={40} />
          <h1 className="text-white font-bold text-2xl mb-3" style={{ fontFamily: "'Big Shoulders Display', sans-serif" }}>
            Dados enviados com sucesso!
          </h1>
          <p className="text-slate-300 text-sm leading-relaxed">
            Os seus dados foram recebidos e serão revistos pela equipa da Magnetic Place.
            Após aprovação, receberá as informações de acesso ao portal.
          </p>
          <p className="text-slate-400 text-xs mt-4">Pode fechar esta janela.</p>
        </div>
      </div>
    </div>
  );

  const tabelaLabel = TABELA_IRS_OPTIONS.find(o => o.value === form.tabela_irs)?.label || form.tabela_irs;

  return (
    <div className="min-h-screen py-10 px-4" style={{ background: '#0F1F3D' }}>
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <CompanyLogo className="h-10 w-10" />
          <div>
            <h1 className="text-white font-black text-2xl leading-tight" style={{ fontFamily: "'Big Shoulders Display', sans-serif" }}>
              Ficha de Colaborador
            </h1>
            <p className="text-slate-400 text-xs">Magnetic Place Unipessoal, Lda</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex items-center gap-1 mb-3">
            {STEPS.map((s, i) => (
              <React.Fragment key={i}>
                <div className={`flex items-center gap-1.5 ${i <= step ? 'opacity-100' : 'opacity-40'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black transition-all
                    ${i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-indigo-500 text-white' : 'bg-white/20 text-white'}`}>
                    {i < step ? <Check size={12} /> : i + 1}
                  </div>
                  <span className="text-[10px] font-bold text-white hidden sm:block">{s}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 rounded-full transition-all ${i < step ? 'bg-emerald-500' : 'bg-white/20'}`} />
                )}
              </React.Fragment>
            ))}
          </div>
          <p className="text-white/60 text-xs">Passo {step + 1} de {STEPS.length} — {STEPS[step]}</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-indigo-600 px-6 py-4">
            <h2 className="text-white font-black text-lg" style={{ fontFamily: "'Big Shoulders Display', sans-serif" }}>
              {STEPS[step]}
            </h2>
          </div>

          <div className="p-6 space-y-4">

            {/* Passo 0: Dados Pessoais */}
            {step === 0 && (<>
              <Field label="Nome completo *" error={errors.nome}>
                <input className={errors.nome ? inputErrCls : inputCls} value={form.nome}
                  onChange={e => set('nome', e.target.value)} placeholder="Nome e apelido" />
              </Field>
              <Field label="Profissão / Cargo" error={errors.profissao}>
                <input className={inputCls} value={form.profissao}
                  onChange={e => set('profissao', e.target.value)} placeholder="Ex: Técnico de Manutenção" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Telemóvel" error={errors.tel}>
                  <input className={inputCls} value={form.tel} inputMode="tel"
                    onChange={e => set('tel', e.target.value)} placeholder="+351 9XX XXX XXX" />
                </Field>
                <Field label="Email" error={errors.email}>
                  <input className={errors.email ? inputErrCls : inputCls} value={form.email}
                    type="email" onChange={e => set('email', e.target.value)} placeholder="email@exemplo.pt" />
                </Field>
              </div>
              <Field label="Nº Documento de Identificação (CC / DNI / Passaporte)" error={errors.dni}>
                <input className={inputCls} value={form.dni}
                  onChange={e => set('dni', e.target.value)} placeholder="Ex: 12345678 9 ZY3" />
              </Field>
              <Field label="Morada completa" error={errors.address}>
                <input className={inputCls} value={form.address}
                  onChange={e => set('address', e.target.value)} placeholder="Rua, nº, localidade, código postal" />
              </Field>
            </>)}

            {/* Passo 1: Situação Fiscal */}
            {step === 1 && (<>
              <Field label="Tabela de Retenção IRS" error={errors.tabela_irs}>
                <select className={inputCls} value={form.tabela_irs} onChange={e => set('tabela_irs', e.target.value)}>
                  {TABELA_IRS_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Número de dependentes" error={errors.n_dependentes}>
                <input className={inputCls} value={form.n_dependentes} inputMode="numeric"
                  type="number" min="0" max="20"
                  onChange={e => set('n_dependentes', e.target.value)} />
              </Field>
              <div className="bg-indigo-50 rounded-xl p-4 mt-2">
                <p className="text-[11px] text-indigo-700 font-bold leading-relaxed">
                  A tabela de retenção IRS é definida pela sua situação fiscal (casado/a, solteiro/a, nº de dependentes).
                  Se tiver dúvidas, consulte o seu modelo 3 de IRS ou contacte a Autoridade Tributária.
                </p>
              </div>
            </>)}

            {/* Passo 2: Dados Financeiros */}
            {step === 2 && (<>
              <Field label="NIF (Número de Identificação Fiscal)" error={errors.nif}>
                <input className={errors.nif ? inputErrCls : inputCls} value={form.nif}
                  inputMode="numeric" maxLength={9}
                  onChange={e => set('nif', e.target.value.replace(/\D/g, '').slice(0, 9))}
                  placeholder="9 dígitos" />
              </Field>
              <Field label="NIS (Número de Identificação na Segurança Social)" error={errors.nis}>
                <input className={errors.nis ? inputErrCls : inputCls} value={form.nis}
                  inputMode="numeric" maxLength={11}
                  onChange={e => set('nis', e.target.value.replace(/\D/g, '').slice(0, 11))}
                  placeholder="11 dígitos" />
              </Field>
              <Field label="IBAN" error={errors.iban}>
                <input className={errors.iban ? inputErrCls : inputCls} value={form.iban}
                  onChange={e => set('iban', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  placeholder="PT50 0000 0000 0000 0000 0000 0" />
              </Field>
              <div className="bg-amber-50 rounded-xl p-4">
                <p className="text-[11px] text-amber-700 font-bold leading-relaxed">
                  Estes dados são necessários para processamento salarial e cumprimento de obrigações legais.
                  São transmitidos de forma segura e só acessíveis à equipa administrativa.
                </p>
              </div>
            </>)}

            {/* Passo 3: Revisão */}
            {step === 3 && (<>
              <div className="space-y-4">
                <ReviewSection title="Dados Pessoais" color="indigo">
                  <ReviewRow label="Nome" value={form.nome} />
                  <ReviewRow label="Profissão" value={form.profissao} />
                  <ReviewRow label="Telemóvel" value={form.tel} />
                  <ReviewRow label="Email" value={form.email} />
                  <ReviewRow label="Documento" value={form.dni} />
                  <ReviewRow label="Morada" value={form.address} />
                </ReviewSection>
                <ReviewSection title="Situação Fiscal" color="violet">
                  <ReviewRow label="Tabela IRS" value={tabelaLabel.split(' — ')[0]} />
                  <ReviewRow label="Dependentes" value={String(form.n_dependentes)} />
                </ReviewSection>
                <ReviewSection title="Dados Financeiros" color="amber">
                  <ReviewRow label="NIF" value={form.nif || '—'} />
                  <ReviewRow label="NIS" value={form.nis || '—'} />
                  <ReviewRow label="IBAN" value={form.iban ? form.iban.replace(/(.{4})/g, '$1 ').trim() : '—'} />
                </ReviewSection>
              </div>

              <div className="mt-5 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rgpd}
                    onChange={e => setRgpd(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-[11px] text-slate-600 leading-relaxed font-medium">
                    Autorizo a <strong>Magnetic Place Unipessoal, Lda</strong> a tratar os meus dados pessoais
                    para fins de processamento salarial e cumprimento de obrigações legais, nos termos do RGPD.
                  </span>
                </label>
              </div>

              {errors._submit && (
                <p className="text-[11px] text-rose-600 font-bold bg-rose-50 rounded-lg px-3 py-2">{errors._submit}</p>
              )}
            </>)}
          </div>

          {/* Footer nav */}
          <div className="px-6 pb-6 flex items-center justify-between gap-3">
            {step > 0 ? (
              <button onClick={goBack} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase text-slate-500 border border-slate-200 hover:bg-slate-50 transition-all">
                <ChevronLeft size={14} /> Anterior
              </button>
            ) : <span />}

            {step < STEPS.length - 1 ? (
              <button onClick={goNext} className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-black uppercase bg-indigo-600 text-white hover:bg-indigo-700 shadow transition-all ml-auto">
                Seguinte <ChevronRight size={14} />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!rgpd || submitting}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black uppercase bg-emerald-600 text-white hover:bg-emerald-700 shadow transition-all ml-auto disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                Enviar dados
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-slate-500 text-[10px] mt-6">
          Os seus dados são tratados com segurança, apenas para fins de gestão laboral.
        </p>
      </div>
    </div>
  );
}

function ReviewSection({ title, color, children }) {
  const colors = {
    indigo: 'bg-indigo-600',
    violet: 'bg-violet-600',
    amber:  'bg-amber-500',
  };
  return (
    <div className="rounded-xl overflow-hidden border border-slate-100">
      <div className={`${colors[color] || 'bg-slate-600'} px-4 py-2`}>
        <p className="text-white text-[10px] font-black uppercase tracking-widest">{title}</p>
      </div>
      <div className="bg-slate-50 divide-y divide-slate-100">
        {children}
      </div>
    </div>
  );
}

function ReviewRow({ label, value }) {
  if (!value || value === '—') return null;
  return (
    <div className="flex items-start gap-2 px-4 py-2">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide w-24 shrink-0 mt-0.5">{label}</span>
      <span className="text-sm font-semibold text-slate-800 break-all">{value}</span>
    </div>
  );
}
