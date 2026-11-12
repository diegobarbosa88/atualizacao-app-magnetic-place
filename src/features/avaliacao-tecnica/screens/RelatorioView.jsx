import { CircleCheck, CircleAlert, CircleX, Hourglass, Printer, ShieldCheck, SkipForward, TriangleAlert } from 'lucide-react';
import { RadarChart } from '../components/charts/RadarChart.jsx';
import { Button } from '../components/ui/Button.jsx';
import {
  CLASSIFICATION_LABELS,
  LEVEL_LABELS,
  LOGO_SRC,
  MIN_CORE_PILLAR_FOR_APTO,
  ORG_NAME,
  PILLAR_LABELS,
  PILLAR_SHORT_LABELS,
  PILLAR_WEIGHTS,
  TEST_SUBTITLE,
  TEST_TITLE,
  TEST_VERSION,
} from '../config.js';
import { LEVELS } from '../data/levels.js';
import { getPhase1Items } from '../data/phase1.js';
import { buildPhase2 } from '../data/phase2.js';
import { buildPhase3 } from '../data/phase3.js';
import { DIM_WHERE, DRAWING, dimText } from '../data/plan.js';
import { cn } from '../lib/cn.js';
import { formatDateTime, formatDuration, formatMm, formatSeconds } from '../lib/format.js';
import { findCredit } from '../lib/scoring.js';

const CLASS_STYLE = {
  apto: { color: '#10b981', badge: 'bg-emerald-50 text-emerald-800 ring-emerald-300', Icon: ShieldCheck },
  'em-avaliacao': { color: '#f0ad00', badge: 'bg-amber-50 text-amber-800 ring-amber-300', Icon: CircleAlert },
  'nao-recomendado': { color: '#ef4444', badge: 'bg-red-50 text-red-800 ring-red-300', Icon: CircleX },
};

const PILLAR_ORDER = ['localizacao', 'calculo', 'simbologia', 'agilidade'];

const barColor = (v) => (v >= 70 ? 'bg-emerald-500' : v >= 40 ? 'bg-mp-orange-400' : 'bg-red-500');

const fmtMm = (v) => formatMm(v, Number.isInteger(v) ? 0 : 1);

/**
 * Relatório do recrutador, a partir do resultado gravado (ver lib/grading.js →
 * reportFromRecord). `contacto` são os dados que o candidato preencheu no link.
 */
export function RelatorioView({ snapshot, summary, contacto = [] }) {
  const { candidate, integrity, plan } = snapshot;
  const levelSpec = LEVELS[candidate.level];
  const phase1Items = getPhase1Items(candidate.level);
  const phase2Questions = buildPhase2(plan, candidate.level);
  const phase3Questions = buildPhase3(plan, candidate.level);
  const hintsUsed = snapshot.phase1.filter((r) => r.hintShown).length;
  const style = CLASS_STYLE[summary.classification];
  const ClassIcon = style.Icon;

  return (
    <div className="avaliacao-scope mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-bold">Relatório do Recrutador</h1>
          <p className="text-sm text-slate-500">Corrigido no servidor a partir das respostas do candidato.</p>
        </div>
        <Button size="md" icon={<Printer className="size-4" />} onClick={() => window.print()}>
          Imprimir / PDF
        </Button>
      </div>

      <article className="space-y-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8 print:space-y-4 print:rounded-none print:p-0 print:shadow-none print:ring-0">
        <header className="flex items-start justify-between gap-4 border-b-4 border-mp-navy-800 pb-4">
          <div className="flex min-w-0 items-start gap-3 sm:gap-4">
            <img src={LOGO_SRC} alt="" className="size-14 shrink-0 object-contain sm:size-16" />
            <div className="min-w-0">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-mp-orange-700">{ORG_NAME}</p>
              <h2 className="text-xl font-bold text-mp-navy-800 sm:text-2xl">{TEST_TITLE}</h2>
              <p className="text-sm text-slate-500">
                {TEST_SUBTITLE} · Plano {DRAWING.number} rev. {DRAWING.rev}, variante {plan.code} — uso interno do RH
              </p>
            </div>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold">{formatDateTime(snapshot.finishedAt)}</p>
            <p className="font-mono text-xs text-slate-500">{TEST_VERSION}</p>
            <p className="font-mono text-xs text-slate-400">#{snapshot.sessionId.slice(0, 8)}</p>
          </div>
        </header>

        {integrity.abandoned && (
          <div className="flex items-start gap-3 rounded-xl border-2 border-red-300 bg-red-50 p-4 text-red-800">
            <TriangleAlert className="mt-0.5 size-5 shrink-0" />
            <p>
              <strong>Prova encerrada antes da conclusão.</strong> As perguntas não respondidas valem 0 pontos.
            </p>
          </div>
        )}

        <section className="grid gap-5 sm:grid-cols-[1fr_auto] sm:items-center print:grid-cols-[1fr_auto] print:break-inside-avoid">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Info label="Candidato" value={candidate.fullName} wide />
            <Info label="Código / ID" value={<span className="font-mono">{candidate.internalId}</span>} />
            <Info label="Nível pretendido" value={`${LEVEL_LABELS[candidate.level]} · prova ${levelSpec.difficulty.toLowerCase()}`} />
            <Info label="Início" value={formatDateTime(snapshot.startedAt)} />
            <Info label="Duração total" value={formatDuration(summary.wallTimeMs)} />
            <Info label="Tempo de resposta" value={formatDuration(summary.activeTimeMs)} />
            {contacto
              .filter((c) => c.value)
              .map((c) => (
                <Info key={c.label} label={c.label} value={c.value} />
              ))}
            <Info
              label="Integridade"
              value={
                integrity.focusLosses + integrity.exitAttempts === 0
                  ? 'Sem ocorrências'
                  : `${integrity.focusLosses + integrity.exitAttempts} ocorrência(s)`
              }
            />
          </dl>

          <div className="flex items-center gap-4 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
            <ScoreRing value={summary.overall} color={style.color} />
            <div className="max-w-52">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Classificação sugerida</p>
              <p className={cn('mt-1.5 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-bold ring-1', style.badge)}>
                <ClassIcon className="size-5 shrink-0" />
                {CLASSIFICATION_LABELS[summary.classification]}
              </p>
              <p className="mt-2 text-xs leading-snug text-slate-500">
                {LEVEL_LABELS[candidate.level]}: apto ≥ {summary.thresholds.apto} · em avaliação ≥ {summary.thresholds.avaliacao}
              </p>
            </div>
          </div>
        </section>

        {summary.gateFailed && (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
            A nota geral atingiria “Apto”, mas há pilar técnico abaixo de {MIN_CORE_PILLAR_FOR_APTO} pontos — classificação rebaixada para
            avaliação.
          </p>
        )}

        <section className="grid items-center gap-6 sm:grid-cols-2 print:grid-cols-2 print:break-inside-avoid">
          <RadarChart
            className="mx-auto h-auto w-full max-w-sm"
            data={PILLAR_ORDER.map((k) => ({ label: PILLAR_SHORT_LABELS[k], value: summary.pillars[k] }))}
          />
          <div className="space-y-4">
            {PILLAR_ORDER.map((k) => {
              const v = summary.pillars[k];
              return (
                <div key={k}>
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="font-semibold">{PILLAR_LABELS[k]}</span>
                    <span className="font-mono text-lg font-bold">{v}</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                    <div className={cn('h-full rounded-full', barColor(v))} style={{ width: `${v}%` }} />
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">Peso {Math.round(PILLAR_WEIGHTS[k] * 100)}% na nota geral</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Fase 1 */}
        <Section
          title="Fase 1 · Localização de cotas"
          score={summary.pillars.localizacao}
          note={`${summary.wrongTapsTotal} toque(s) em cotas erradas · ${levelSpec.phase1.maxAttempts} tentativas por cota (100 % à 1.ª, 60 % à 2.ª${levelSpec.phase1.maxAttempts > 2 ? ', 30 % à 3.ª' : ''})${levelSpec.phase1.hintAfterMiss ? ` · dica usada em ${hintsUsed} cota(s)` : ''}`}
        >
          <Table head={['Cota procurada', 'Onde está', 'Resultado', 'Toques errados', 'Tempo']}>
            {phase1Items.map((item) => {
              const r = snapshot.phase1.find((x) => x.itemId === item.id);
              const where = Array.from(new Set(item.targets.map((t) => DIM_WHERE[t]))).join(' ou ');
              return (
                <tr key={item.id} className="align-top">
                  <td className="py-2.5 pr-3">
                    <span className="font-semibold">{item.prompt}</span>
                    <span className="block font-mono text-xs text-slate-500">{dimText(plan, item.targets[0])}</span>
                  </td>
                  <td className="py-2.5 pr-3 text-slate-600">{where}</td>
                  <td className="py-2.5 pr-3">
                    {!r ? (
                      <Status kind="missing" />
                    ) : r.found ? (
                      <Status
                        kind="ok"
                        okText={
                          r.attemptsUsed === 1 ? '1.ª tentativa' : `${r.attemptsUsed}.ª tentativa (${Math.round(findCredit(r) * 100)} %)`
                        }
                      />
                    ) : r.timedOut ? (
                      <Status kind="timeout" />
                    ) : (
                      <Status kind="bad" badText="Não encontrou" />
                    )}
                  </td>
                  <td className="py-2.5 pr-3 font-mono text-xs">
                    {r && r.wrongTaps.length ? r.wrongTaps.map((d) => dimText(plan, d)).join(' · ') : '—'}
                  </td>
                  <td className="py-2.5 text-right font-mono">{r ? formatSeconds(r.timeMs) : '—'}</td>
                </tr>
              );
            })}
          </Table>
        </Section>

        {/* Fase 2 */}
        <Section title="Fase 2 · Cotas não indicadas" score={summary.pillars.calculo}>
          <Table head={['Medida pedida', 'Resposta', 'Correto', 'Como se obtém', 'Resultado', 'Tempo']}>
            {phase2Questions.map((q) => {
              const a = snapshot.phase2.find((x) => x.questionId === q.id);
              return (
                <tr key={q.id} className="align-top">
                  <td className="py-2.5 pr-3 font-semibold">{q.topic}</td>
                  <td className="py-2.5 pr-3 font-mono">
                    {!a ? '—' : a.skipped ? 'pulou' : a.value === null ? `“${a.rawInput || '—'}”` : fmtMm(a.value)}
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-3 font-mono">{fmtMm(Math.round(q.expected * 10) / 10)}</td>
                  <td className="py-2.5 pr-3 font-mono text-xs text-slate-600">{q.how}</td>
                  <td className="py-2.5 pr-3">
                    {!a ? (
                      <Status kind="missing" />
                    ) : a.skipped ? (
                      <Status kind="skip" />
                    ) : a.correct ? (
                      <Status kind="ok" />
                    ) : a.timedOut ? (
                      <Status kind="timeout" />
                    ) : (
                      <Status kind="bad" />
                    )}
                  </td>
                  <td className="py-2.5 text-right font-mono">{a ? formatSeconds(a.timeMs) : '—'}</td>
                </tr>
              );
            })}
          </Table>
        </Section>

        {/* Fase 3 */}
        <Section title="Fase 3 · Simbologia e normas EN ISO" score={summary.pillars.simbologia}>
          <Table head={['Tema', 'Resposta', 'Gabarito', 'Resultado', 'Tempo']}>
            {phase3Questions.map((q) => {
              const a = snapshot.phase3.find((x) => x.questionId === q.id);
              const chosen = q.options.find((o) => o.id === a?.selectedOptionId);
              const right = q.options.find((o) => o.id === q.correctOptionId);
              return (
                <tr key={q.id} className="align-top">
                  <td className="py-2.5 pr-3">
                    <span className="font-semibold">{q.topic}</span>
                    <span className="block font-mono text-xs text-slate-500">{q.norm}</span>
                  </td>
                  <td className="py-2.5 pr-3">{chosen?.label ?? '—'}</td>
                  <td className="py-2.5 pr-3 text-slate-600">
                    {right?.label}
                    <span className="mt-0.5 block text-xs text-slate-500">{q.rationale}</span>
                  </td>
                  <td className="py-2.5 pr-3">
                    <Status kind={!a ? 'missing' : a.timedOut ? 'timeout' : a.correct ? 'ok' : 'bad'} />
                  </td>
                  <td className="py-2.5 text-right font-mono">{a ? formatSeconds(a.timeMs) : '—'}</td>
                </tr>
              );
            })}
          </Table>
        </Section>

        <Section title="Integridade da prova">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3 print:grid-cols-3">
            <Info label="Saídas da tela" value={<span className="font-mono">{integrity.focusLosses}</span>} />
            <Info label="Tentativas de sair" value={<span className="font-mono">{integrity.exitAttempts}</span>} />
            <Info label="Prova concluída" value={integrity.abandoned ? 'Não — encerrada antes do fim' : 'Sim'} />
          </dl>
        </Section>

        <section className="break-inside-avoid space-y-6 border-t border-slate-200 pt-5">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Observações do avaliador</p>
            <div className="space-y-6">
              {[0, 1, 2].map((i) => (
                <div key={i} className="border-b border-dashed border-slate-300" />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-8 pt-6 text-sm text-slate-500">
            <div className="border-t border-slate-400 pt-1.5">Avaliador(a)</div>
            <div className="border-t border-slate-400 pt-1.5">Data</div>
          </div>
        </section>
      </article>
    </div>
  );
}

function Info({ label, value, wide }) {
  return (
    <div className={cn(wide && 'col-span-2')}>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

function Section({ title, score, note, children }) {
  return (
    <section className="border-t border-slate-200 pt-5">
      <div className="mb-3 flex items-center justify-between gap-3 break-after-avoid">
        <div>
          <h3 className="text-lg font-bold">{title}</h3>
          {note && <p className="text-xs text-slate-500">{note}</p>}
        </div>
        {score !== undefined && (
          <span
            className={cn(
              'shrink-0 rounded-lg px-2.5 py-1 font-mono text-sm font-bold',
              barColor(score),
              score >= 40 && score < 70 ? 'text-slate-900' : 'text-white',
            )}
          >
            {score}/100
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function Table({ head, children }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <thead className="border-b-2 border-slate-200 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {head.map((h, i) => (
              <th key={h} className={cn('py-2 pr-3', i === head.length - 1 && 'pr-0 text-right')}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}

function Status({ kind, okText = 'Correta', badText = 'Incorreta' }) {
  const map = {
    ok: { text: okText, cls: 'bg-emerald-100 text-emerald-800', Icon: CircleCheck },
    bad: { text: badText, cls: 'bg-red-100 text-red-800', Icon: CircleX },
    timeout: { text: 'Tempo esgotado', cls: 'bg-amber-100 text-amber-800', Icon: Hourglass },
    missing: { text: 'Não respondida', cls: 'bg-slate-100 text-slate-600', Icon: CircleAlert },
    skip: { text: 'Pulou', cls: 'bg-slate-100 text-slate-600', Icon: SkipForward },
  };
  const { text, cls, Icon } = map[kind];
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-bold', cls)}>
      <Icon className="size-3.5" />
      {text}
    </span>
  );
}

function ScoreRing({ value, color }) {
  const r = 52;
  const circumference = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 128 128" className="size-32 shrink-0" role="img" aria-label={`Nota geral ${value} de 100`}>
      <circle cx="64" cy="64" r={r} fill="none" stroke="#e2e8f0" strokeWidth="12" />
      <circle
        cx="64"
        cy="64"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - value / 100)}
        transform="rotate(-90 64 64)"
      />
      <text x="64" y="66" textAnchor="middle" fontSize="36" fontWeight="800" fill="#122741" fontFamily="var(--mono)">
        {value}
      </text>
      <text x="64" y="86" textAnchor="middle" fontSize="11" fill="#64748b">
        de 100
      </text>
    </svg>
  );
}
