import { useState, useEffect } from 'react';
import { Plane, MapPin, AlertTriangle, ChevronRight, Calendar } from 'lucide-react';
import { FT } from '../../styles/designTokens';

const GAP_PADRAO = 5;
const DIAS_PT = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

function parseDateLocal(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(dateStr, days) {
  const d = parseDateLocal(dateStr);
  if (!d) return null;
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDatePT(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}-${m}-${y}`;
}

function daysBetween(dateStr1, dateStr2) {
  const d1 = parseDateLocal(dateStr1), d2 = parseDateLocal(dateStr2);
  if (!d1 || !d2) return null;
  return Math.round((d2 - d1) / 86400000);
}

function diaSemana(dateStr) {
  const d = parseDateLocal(dateStr);
  return d ? DIAS_PT[d.getDay()] : '';
}

function prevMes(mesStr) {
  const [y, m] = mesStr.split('-').map(Number);
  return m === 1
    ? `${y - 1}-12`
    : `${y}-${String(m - 1).padStart(2, '0')}`;
}

function WorkerRow({ worker, isOpen, onToggle, onUsarData, onEditarManualmente }) {
  const isFerias = worker.status === 'ferias';
  const semHist  = worker.status === 'sem_historico';

  return (
    <div
      className="rounded-xl border bg-white mb-2 overflow-hidden transition-all"
      style={{ borderColor: isFerias ? FT.orange : '#E3E7EC' }}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-slate-50 transition-colors text-left"
        style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center font-black text-sm shrink-0"
            style={{ background: '#EEF1F5', color: FT.navy }}
          >
            {worker.nome.split(' ').map(w => w[0]).slice(0, 2).join('')}
          </div>
          <div className="font-bold text-sm" style={{ color: FT.navy }}>
            {worker.nome}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {semHist && (
            <span className="text-xs text-slate-400">Sem mês anterior</span>
          )}
          {isFerias && (
            <span
              className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full"
              style={{ color: FT.orange, background: '#FDF1E0' }}
            >
              <AlertTriangle size={11} strokeWidth={2.5} />
              Confirmar datas
            </span>
          )}
          {!semHist && (
            <ChevronRight
              size={15}
              className="transition-transform duration-150"
              style={{
                color: '#B4BBC6',
                transform: isOpen ? 'rotate(90deg)' : 'none',
              }}
            />
          )}
        </div>
      </button>

      {isOpen && !semHist && (
        <div className="px-4 pb-4">
          {/* Timeline */}
          <div
            className="flex items-center rounded-xl p-4 gap-2"
            style={{ background: '#F7F8FA' }}
          >
            {/* Chegada anterior */}
            <div className="flex-1">
              <div
                className="flex items-center gap-1 mb-1.5 uppercase font-bold"
                style={{ color: '#8891A0', fontSize: 11, letterSpacing: '0.04em' }}
              >
                <MapPin size={10} />
                Chegada anterior
              </div>
              <div className="font-black text-base" style={{ color: FT.navy }}>
                {worker.chegadaAnterior.data}
              </div>
              <div className="text-xs" style={{ color: '#8891A0' }}>
                {worker.chegadaAnterior.diaSemana}
              </div>
            </div>

            {/* Linha de gap com avião */}
            <div className="flex-1 text-center px-2">
              <div
                className="relative w-full"
                style={{ height: 2, background: isFerias ? FT.orange : FT.slate, marginTop: 20 }}
              >
                <Plane
                  size={15}
                  style={{
                    position: 'absolute',
                    top: -9,
                    left: '50%',
                    transform: 'translateX(-50%) rotate(90deg)',
                    color: isFerias ? FT.orange : FT.slate,
                    background: '#F7F8FA',
                  }}
                />
              </div>
              <div
                className="mt-2 text-xs font-bold"
                style={{ color: isFerias ? FT.orange : FT.navy }}
              >
                {worker.gapReal === 1 ? '1 dia de folga' : `${worker.gapReal} dias de folga`}
              </div>
              <div className="text-[10px]" style={{ color: '#8891A0' }}>
                (padrão: {worker.gapPadrao} dias)
              </div>
            </div>

            {/* Partida sugerida */}
            <div className="flex-1 text-right">
              <div
                className="flex items-center justify-end gap-1 mb-1.5 uppercase font-bold"
                style={{ color: '#8891A0', fontSize: 11, letterSpacing: '0.04em' }}
              >
                Partida sugerida
                <Calendar size={10} />
              </div>
              <div className="font-black text-base" style={{ color: FT.navy }}>
                {worker.partidaSugerida.data}
              </div>
              <div className="text-xs" style={{ color: '#8891A0' }}>
                {worker.partidaSugerida.diaSemana}
              </div>
            </div>
          </div>

          {/* Alerta férias */}
          {isFerias && (
            <div
              className="mt-2.5 flex items-start gap-2 text-xs rounded-lg px-3 py-2.5"
              style={{ color: '#7A4A00', background: '#FDF1E0' }}
            >
              <AlertTriangle size={13} className="shrink-0 mt-0.5" style={{ color: FT.orange }} />
              <span>
                O intervalo real ({worker.gapReal} dias) é superior ao habitual — pode indicar férias.
                A data sugerida não foi aplicada automaticamente; confirme manualmente.
              </span>
            </div>
          )}

          {/* Botões */}
          <div className="mt-3 flex gap-2 flex-wrap">
            <button
              onClick={() => onUsarData(worker.partidaSugerida.raw)}
              className="text-xs font-bold text-white px-3.5 py-2 rounded-lg transition-colors"
              style={{ background: FT.navy }}
              onMouseEnter={e => { e.currentTarget.style.background = '#142d45'; }}
              onMouseLeave={e => { e.currentTarget.style.background = FT.navy; }}
            >
              Usar data sugerida
            </button>
            <button
              onClick={onEditarManualmente}
              className="text-xs font-bold px-3.5 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
              style={{ color: FT.navy, background: 'transparent' }}
            >
              Editar manualmente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function HistoricoDeslocacao({ supabase, workers, mesStr, setMapa, dataInicioInputRef, selectedWorkerId }) {
  const [openIndex, setOpenIndex] = useState(0);
  const [historico, setHistorico] = useState(null); // null = a carregar

  const n1Mes = prevMes(mesStr);
  const n2Mes = prevMes(n1Mes);

  useEffect(() => {
    if (!supabase || !selectedWorkerId) {
      setHistorico({});
      return;
    }
    setHistorico(null);
    supabase
      .from('mapa_viagens_historico')
      .select('worker_id, mes, data_partida, data_chegada')
      .eq('worker_id', selectedWorkerId)
      .in('mes', [n1Mes, n2Mes])
      .then(({ data, error }) => {
        if (error) { setHistorico({}); return; }
        const byWorker = {};
        (data || []).forEach(r => {
          if (!byWorker[r.worker_id]) byWorker[r.worker_id] = {};
          if (r.mes === n1Mes) byWorker[r.worker_id].n1 = r;
          if (r.mes === n2Mes) byWorker[r.worker_id].n2 = r;
        });
        setHistorico(byWorker);
      });
  }, [supabase, selectedWorkerId, n1Mes, n2Mes]);

  const workerIds = historico ? Object.keys(historico) : [];

  if (!selectedWorkerId) return null;

  if (!historico || workerIds.length === 0) {
    return (
      <div className="mb-4 px-3.5 py-3 rounded-xl border border-dashed border-slate-200 bg-slate-50">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-0.5">
          Histórico de deslocação
        </p>
        <p className="text-xs text-slate-400 leading-relaxed">
          {historico === null
            ? 'A carregar histórico…'
            : 'Sem registos para os meses anteriores. Ao validar e concluir o processamento deste trabalhador, o histórico fica guardado automaticamente.'}
        </p>
      </div>
    );
  }

  const rows = workerIds
    .map(wid => {
      const w = workers?.find(x => x.id === wid);
      if (!w) return null;

      const n1 = historico[wid]?.n1; // mês anterior
      const n2 = historico[wid]?.n2; // dois meses atrás

      const chegadaAnterior   = n1?.data_chegada || null;
      const partidaSugeridaRaw = chegadaAnterior ? addDays(chegadaAnterior, GAP_PADRAO) : null;

      // gapReal: intervalo observado no ciclo anterior (N-2 chegada → N-1 partida)
      const gapReal = (n1 && n2) ? daysBetween(n2.data_chegada, n1.data_partida) : null;

      const status = !chegadaAnterior ? 'sem_historico'
        : (gapReal !== null && gapReal > GAP_PADRAO + 1) ? 'ferias'
        : 'normal';

      return {
        workerId: wid,
        nome: w.name,
        chegadaAnterior: chegadaAnterior ? {
          data: formatDatePT(chegadaAnterior),
          diaSemana: diaSemana(chegadaAnterior),
        } : null,
        gapPadrao: GAP_PADRAO,
        partidaSugerida: partidaSugeridaRaw ? {
          data: formatDatePT(partidaSugeridaRaw),
          diaSemana: diaSemana(partidaSugeridaRaw),
          raw: partidaSugeridaRaw,
        } : null,
        gapReal: gapReal ?? GAP_PADRAO,
        status,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));

  if (rows.length === 0) return null;

  return (
    <div className="mb-4">
      <p
        className="uppercase font-black mb-2"
        style={{ fontSize: 10, color: FT.slate, letterSpacing: '0.06em' }}
      >
        Histórico de deslocação
      </p>
      <p className="text-xs mb-3 leading-relaxed" style={{ color: '#8891A0' }}>
        Com base no mapa do mês anterior. Quando o intervalo foge do padrão, a data sugerida
        não é aplicada automaticamente.
      </p>

      {rows.map((worker, i) => (
        <WorkerRow
          key={worker.workerId}
          worker={worker}
          isOpen={openIndex === i}
          onToggle={() => setOpenIndex(openIndex === i ? -1 : i)}
          onUsarData={raw => setMapa(p => ({ ...p, dataInicio: raw }))}
          onEditarManualmente={() => {
            dataInicioInputRef?.current?.focus();
            dataInicioInputRef?.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}
        />
      ))}
    </div>
  );
}
