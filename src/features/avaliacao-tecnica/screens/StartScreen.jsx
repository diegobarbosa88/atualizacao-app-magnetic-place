import { useState } from 'react';
import { Briefcase, Clock, Mail, MapPin, Phone, Play, ShieldCheck, TriangleAlert, User } from 'lucide-react';
import { Button } from '../components/ui/Button.jsx';
import { Card } from '../components/ui/Card.jsx';
import { PrepCountdown } from '../components/ui/PrepCountdown.jsx';
import { EXPERIENCIA_OPCOES, LEVEL_LABELS, TIMING } from '../config.js';
import { LEVELS, maxDurationSec } from '../data/levels.js';
import { DRAWING } from '../data/plan.js';
import { getPhaseMeta } from '../data/phases.js';
import { cn } from '../lib/cn.js';
import { sfx } from '../lib/sound.js';
import { useAssessmentStore } from '../store/useAssessmentStore.js';

const inputClass = (invalid, withIcon = true) =>
  cn(
    'h-14 w-full rounded-xl border-2 bg-white pr-4 text-lg outline-none transition',
    withIcon ? 'pl-12' : 'pl-4',
    'placeholder:text-slate-400 focus:border-mp-navy-500 focus:ring-4 focus:ring-mp-navy-100',
    invalid ? 'border-red-400' : 'border-slate-300',
  );

/**
 * Tela inicial do candidato que abriu o link enviado pelo recrutador.
 * O nível já vem do convite (escolhido pelo admin). Ao confirmar, `onStart` regista
 * os dados no servidor e devolve a variante do plano; só então a prova começa.
 */
export function StartScreen({ level, inicial, onStart }) {
  const startAssessment = useAssessmentStore((s) => s.startAssessment);
  const phases = getPhaseMeta(level);
  const spec = LEVELS[level];
  const [form, setForm] = useState({
    nome: inicial?.nome ?? '',
    telefone: inicial?.telefone ?? '',
    email: '',
    experiencia: '',
    localidade: '',
    rgpd: false,
  });
  const [touched, setTouched] = useState(false);
  const [sending, setSending] = useState(false);
  const [serverError, setServerError] = useState('');
  const [started, setStarted] = useState(null);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const errors = {
    nome: form.nome.trim().split(/\s+/).filter(Boolean).length < 2 ? 'Informe nome e sobrenome.' : null,
    telefone: form.telefone.replace(/\D/g, '').length < 9 ? 'Informe um telefone com DDI ou com 9 dígitos.' : null,
    email: form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) ? 'E-mail inválido.' : null,
    experiencia: form.experiencia ? null : 'Selecione o tempo de experiência.',
    rgpd: form.rgpd ? null : 'É preciso autorizar o tratamento dos dados para fazer a prova.',
  };
  const valid = Object.values(errors).every((e) => !e);
  const showError = (key) => touched && errors[key];

  const handleSubmit = async (event) => {
    event.preventDefault();
    setTouched(true);
    sfx.unlock();
    if (!valid) {
      sfx.wrong();
      return;
    }
    setSending(true);
    setServerError('');
    try {
      const dados = {
        nome: form.nome.trim().replace(/\s+/g, ' '),
        telefone: form.telefone.trim(),
        email: form.email.trim(),
        experiencia: form.experiencia,
        localidade: form.localidade.trim(),
        rgpd: true,
      };
      const { seed, internalId } = await onStart(dados);
      setStarted({ seed, internalId, fullName: dados.nome });
    } catch (e) {
      setServerError(e.message || 'Não foi possível iniciar a prova. Verifique a internet e tente de novo.');
      sfx.wrong();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto grid max-w-7xl gap-6 pb-6 pt-2 lg:grid-cols-5">
      <Card className="overflow-hidden lg:col-span-3">
        <div className="bg-mp-navy-800 px-6 py-7 text-white sm:px-8">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-mp-orange-400">Seus dados</p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Interpretação de plano</h1>
          <p className="mt-2 text-mp-navy-100">
            Plano {DRAWING.number} — {DRAWING.title.toLowerCase()}, normas EN ISO. Preencha os dados abaixo: a prova começa logo em seguida
            e não pode ser pausada.
          </p>
        </div>
        <div className="faixa-marca h-[3px]" />

        <form onSubmit={handleSubmit} noValidate className="space-y-5 p-6 sm:p-8">
          <Field id="nome" label="Nome completo" error={showError('nome')}>
            <User className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
            <input
              id="nome"
              value={form.nome}
              onChange={set('nome')}
              autoComplete="name"
              autoCapitalize="words"
              placeholder="Ex.: João Carlos Pereira"
              className={inputClass(showError('nome'))}
              aria-invalid={!!showError('nome')}
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="telefone" label="Telefone (WhatsApp)" error={showError('telefone')}>
              <Phone className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
              <input
                id="telefone"
                type="tel"
                value={form.telefone}
                onChange={set('telefone')}
                autoComplete="tel"
                placeholder="+351 912 345 678"
                className={inputClass(showError('telefone'))}
                aria-invalid={!!showError('telefone')}
              />
            </Field>
            <Field id="email" label="E-mail (opcional)" error={showError('email')}>
              <Mail className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
              <input
                id="email"
                type="email"
                value={form.email}
                onChange={set('email')}
                autoComplete="email"
                placeholder="nome@email.com"
                className={inputClass(showError('email'))}
                aria-invalid={!!showError('email')}
              />
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="experiencia" label="Experiência como caldeireiro" error={showError('experiencia')}>
              <Briefcase className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
              <select
                id="experiencia"
                value={form.experiencia}
                onChange={set('experiencia')}
                className={cn(inputClass(showError('experiencia')), !form.experiencia && 'text-slate-400')}
                aria-invalid={!!showError('experiencia')}
              >
                <option value="">Selecione…</option>
                {EXPERIENCIA_OPCOES.map((o) => (
                  <option key={o} value={o} className="text-slate-900">
                    {o}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="localidade" label="Cidade onde mora (opcional)">
              <MapPin className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
              <input
                id="localidade"
                value={form.localidade}
                onChange={set('localidade')}
                autoComplete="address-level2"
                placeholder="Ex.: Porto"
                className={inputClass(false)}
              />
            </Field>
          </div>

          <div>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-slate-200 p-4 text-sm leading-snug text-slate-700">
              <input type="checkbox" checked={form.rgpd} onChange={set('rgpd')} className="mt-0.5 size-5 shrink-0 accent-mp-navy-600" />
              <span>
                Autorizo a Magnetic Place a tratar os meus dados e o resultado desta prova para fins de recrutamento, nos termos do RGPD.
                Posso pedir a eliminação dos dados a qualquer momento.
              </span>
            </label>
            {showError('rgpd') && <p className="mt-1.5 text-sm font-medium text-red-600">{errors.rgpd}</p>}
          </div>

          {serverError && (
            <p className="flex gap-2 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-800 ring-1 ring-red-200">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              {serverError}
            </p>
          )}

          <Button type="submit" size="xl" block disabled={sending || !!started} icon={<Play className="size-6" />}>
            {sending ? 'Iniciando…' : 'Iniciar prova'}
          </Button>
        </form>
      </Card>

      <div className="space-y-4 lg:col-span-2">
        <Card className="p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Como funciona</h2>
              <p className="text-sm font-semibold text-slate-500">
                {LEVEL_LABELS[level]} · prova {spec.difficulty.toLowerCase()}
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-mp-creme px-3 py-1 text-sm font-semibold text-slate-700">
              <Clock className="size-4" /> até ~{Math.ceil(maxDurationSec(level) / 60)} min
            </span>
          </div>
          <p className="mb-4 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200">{spec.summary}</p>
          <ol className="space-y-3">
            {[1, 2, 3].map((n) => {
              const meta = phases[n];
              const Icon = meta.icon;
              return (
                <li key={n} className="flex gap-3 rounded-xl border border-slate-200 p-3">
                  <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-mp-navy-800 text-mp-orange-400">
                    <Icon className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="font-bold">
                        {n}. {meta.title}
                      </p>
                      <span className="shrink-0 font-mono text-xs font-semibold text-slate-500">{meta.durationLabel}</span>
                    </div>
                    <p className="text-sm text-slate-600">{meta.objective}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>

        <Card className="border-l-4 border-mp-orange-400 p-5 sm:p-6">
          <h2 className="mb-3 flex items-center gap-2 font-bold">
            <ShieldCheck className="size-5 text-mp-navy-600" /> Regras da prova
          </h2>
          <ul className="space-y-2 text-sm text-slate-700">
            <li>• Faça a prova num tablet ou computador. No celular, deite o aparelho (tela na horizontal).</li>
            <li>• Cada cota ou pergunta tem cronômetro; ao zerar, a resposta atual é registrada.</li>
            <li>• Respostas são definitivas — não é possível voltar.</li>
            <li>• As contas são feitas na calculadora da prova.</li>
            <li>• O link é pessoal e só pode ser usado uma vez.</li>
            <li className="flex gap-1.5 font-medium text-red-700">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              Sair da tela fica registrado. Recarregar ou fechar a página encerra a prova.
            </li>
          </ul>
        </Card>
      </div>

      {started && (
        <PrepCountdown
          seconds={TIMING.prepCountdownSec}
          title={`Fase 1 · ${phases[1].title}`}
          onDone={() => startAssessment({ fullName: started.fullName, internalId: started.internalId, level }, started.seed)}
        />
      )}
    </div>
  );
}

function Field({ id, label, error, children }) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block font-semibold">
        {label}
      </label>
      <div className="relative">{children}</div>
      {error && <p className="mt-1.5 text-sm font-medium text-red-600">{error}</p>}
    </div>
  );
}
