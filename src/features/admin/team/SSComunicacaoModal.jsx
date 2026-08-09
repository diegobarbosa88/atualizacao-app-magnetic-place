import React, { useState } from 'react';
import {
  X, ShieldCheck, AlertTriangle, CheckCircle2, Loader2, TestTube2
} from 'lucide-react';

// Motivos de cessação — códigos oficiais PSI (cessarVinculoTrabalhador WSDL, Agosto 2026)
// O value é o código PSI enviado directamente no campo <motivo-fim-vinculo> do SOAP.
const MOTIVOS_CESSACAO = [
  // Contratos a termo / caducidade
  { value: 'CCCT', label: 'CCCT — Caducidade do contrato a termo' },
  { value: 'CCMT', label: 'CCMT — Caducidade por impossibilidade superveniente absoluta e definitiva' },
  { value: 'CCRI', label: 'CCRI — Caducidade por reforma por invalidez' },
  { value: 'CCRV', label: 'CCRV — Caducidade por reforma por velhice' },
  { value: 'CCFM', label: 'CCFM — Caducidade do contrato de militar' },
  { value: 'CCEE', label: 'CCEE — Extinção pessoa coletiva / encerramento / morte do empregador' },
  { value: 'CCAI', label: 'CCAI — Despedimento pelo administrador de insolvência' },
  // Iniciativa do empregador
  { value: 'IEJC', label: 'IEJC — Despedimento com justa causa (facto imputável ao trabalhador)' },
  { value: 'IEDC', label: 'IEDC — Despedimento coletivo' },
  { value: 'IEEX', label: 'IEEX — Despedimento por extinção do posto de trabalho' },
  { value: 'IEIN', label: 'IEIN — Despedimento por inadaptação' },
  { value: 'IEPE', label: 'IEPE — Denúncia no período experimental (pelo empregador)' },
  { value: 'IECC', label: 'IECC — Cessação de comissão de serviço ou situação equiparada' },
  // Iniciativa do trabalhador
  { value: 'IIDD', label: 'IIDD — Denúncia / demissão por iniciativa do trabalhador (sem justa causa)' },
  { value: 'IIDE', label: 'IIDE — Denúncia no período experimental (pelo trabalhador)' },
  { value: 'IIJC', label: 'IIJC — Resolução com justa causa por iniciativa do trabalhador' },
  { value: 'IISA', label: 'IISA — Resolução com justa causa por salários em atraso' },
  { value: 'IIAT', label: 'IIAT — Abandono do trabalho' },
  // Acordos de revogação
  { value: 'RAOT', label: 'RAOT — Acordo de revogação (não previsto nos números anteriores)' },
  { value: 'RANE', label: 'RANE — Acordo de revogação — sem redução de emprego / reforço de qualificação' },
  { value: 'RADC', label: 'RADC — Acordo de revogação nos termos do art.º 10º n.º 4' },
  { value: 'RARC', label: 'RARC — Acordo de revogação — empresa em processo de recuperação' },
  { value: 'RARD', label: 'RARD — Acordo de revogação — empresa em reestruturação por despacho' },
  { value: 'RARE', label: 'RARE — Acordo de revogação — empresa em situação económica difícil' },
  { value: 'RARR', label: 'RARR — Acordo de revogação — empresa em reestruturação de setor específico' },
  // Outros
  { value: 'CDT',  label: 'CDT — Cedência definitiva de trabalhador (cessão da posição contratual)' },
  { value: 'MAPC', label: 'MAPC — Mobilidade na Administração Pública — consolidação' },
  { value: 'RETR', label: 'RETR — Reinscrição / Transição CGA' },
  { value: 'TE',   label: 'TE — Transmissão de empresa' },
];

// Motivos que exigem fundamentação quando comunicacao-desemprego=true (códigos PSI directos)
const MOTIVOS_COM_FUNDAMENTACAO = ['RARC', 'RARD', 'RARE', 'RARR'];

// Enquadramentos válidos para entidades com fins lucrativos (PSI, Agosto 2026)
const ENQUADRAMENTOS = [
  { value: 'REGE', label: 'REGE — Regime Geral' },
  { value: 'TRCD', label: 'TRCD — Contrato de muito curta duração' },
  { value: 'TCCD', label: 'TCCD — Trabalhadores da cultura — muito curta duração' },
  { value: 'TRAG', label: 'TRAG — Trabalhadores agrícolas' },
  { value: 'RGTC', label: 'RGTC — Carris — Regime Geral' },
  { value: 'RGTL', label: 'RGTL — Lanifícios — Regime Geral' },
  { value: 'RGTS', label: 'RGTS — Seguros — Regime Geral' },
  { value: 'PEIN', label: 'PEIN — Pensionistas por invalidez' },
  { value: 'PEVE', label: 'PEVE — Pensionistas de velhice' },
  { value: 'PFPI', label: 'PFPI — Pensionistas em funções públicas — invalidez' },
  { value: 'PFPV', label: 'PFPV — Pensionistas em funções públicas — velhice' },
];

// 27 modalidades de contrato PSI (código → rótulo)
const MODALIDADE_CONTRATO = [
  { value: 'A',  label: 'A — Sem termo, tempo completo' },
  { value: 'B',  label: 'B — Sem termo, tempo parcial' },
  { value: 'C',  label: 'C — Sem termo, t. completo, intermitente/descontínuo' },
  { value: 'D',  label: 'D — Sem termo, t. parcial, intermitente/descontínuo' },
  { value: 'AA', label: 'AA — Sem termo, t. completo, comissão de serviço' },
  { value: 'AB', label: 'AB — Sem termo, t. completo, teletrabalho' },
  { value: 'BA', label: 'BA — Sem termo, t. parcial, comissão de serviço' },
  { value: 'BB', label: 'BB — Sem termo, t. parcial, teletrabalho' },
  { value: 'S',  label: 'S — Sem termo, t. completo, trabalho temporário' },
  { value: 'R',  label: 'R — Sem termo, t. parcial, trabalho temporário' },
  { value: 'E',  label: 'E — A termo certo, tempo completo' },
  { value: 'EA', label: 'EA — A termo certo, t. completo, comissão de serviço' },
  { value: 'EB', label: 'EB — A termo certo, t. completo, teletrabalho' },
  { value: 'O',  label: 'O — A termo certo, t. completo, trabalho temporário' },
  { value: 'F',  label: 'F — A termo certo, tempo parcial' },
  { value: 'FA', label: 'FA — A termo certo, t. parcial, comissão de serviço' },
  { value: 'FB', label: 'FB — A termo certo, t. parcial, teletrabalho' },
  { value: 'N',  label: 'N — A termo certo, t. parcial, trabalho temporário' },
  { value: 'G',  label: 'G — A termo incerto, tempo completo' },
  { value: 'GA', label: 'GA — A termo incerto, t. completo, comissão de serviço' },
  { value: 'GB', label: 'GB — A termo incerto, t. completo, teletrabalho' },
  { value: 'Q',  label: 'Q — A termo incerto, t. completo, trabalho temporário' },
  { value: 'H',  label: 'H — A termo incerto, tempo parcial' },
  { value: 'HA', label: 'HA — A termo incerto, t. parcial, comissão de serviço' },
  { value: 'HB', label: 'HB — A termo incerto, t. parcial, teletrabalho' },
  { value: 'P',  label: 'P — A termo incerto, t. parcial, trabalho temporário' },
  { value: 'I',  label: 'I — Muito curta duração' },
];

// Calcula modalidade-contrato a partir dos campos simplificados da ficha
function computeModalidade(worker) {
  const map = {
    'sem_termo+tempo_inteiro':           'A',
    'sem_termo+tempo_parcial':           'B',
    'termo_certo+tempo_inteiro':         'E',
    'termo_certo+tempo_parcial':         'F',
    'termo_incerto+tempo_inteiro':       'G',
    'termo_incerto+tempo_parcial':       'H',
    'muito_curta_duracao+tempo_inteiro': 'I',
    'muito_curta_duracao+tempo_parcial': 'I',
  };
  return map[`${worker.tipo_contrato || 'sem_termo'}+${worker.regime || 'tempo_inteiro'}`] || 'A';
}

function fmtDate(iso) {
  if (!iso) return '—';
  const p = iso.split('T')[0].split('-');
  return `${p[2]}/${p[1]}/${p[0]}`;
}

function validarPrazoAdmissao(dataInicio) {
  if (!dataInicio) return null;
  const inicio = new Date(dataInicio.split('T')[0]);
  const hoje   = new Date(); hoje.setHours(0, 0, 0, 0);
  if (inicio < hoje) {
    return `A data de início (${fmtDate(dataInicio)}) já passou — esta comunicação pode estar em incumprimento. O prazo legal é até ao início da execução do contrato (DL n.º 127/2025, em vigor desde 1/1/2026).`;
  }
  return null;
}

function validarPrazoCessacao(dataFim) {
  if (!dataFim) return null;
  const cessacao           = new Date(dataFim.split('T')[0]);
  const hoje               = new Date();
  const dia10MesSeguinte   = new Date(cessacao.getFullYear(), cessacao.getMonth() + 1, 10);
  if (hoje > dia10MesSeguinte) {
    return `O prazo legal de comunicação (dia 10 de ${dia10MesSeguinte.toLocaleString('pt-PT', { month: 'long', year: 'numeric' })}) já passou — esta comunicação pode ter contraordenação associada (até €24.000).`;
  }
  return null;
}

export default function SSComunicacaoModal({ worker, tipo, ambiente, onClose, onSuccess }) {
  const isAdmissao = tipo === 'admissao';
  const modoTeste  = ambiente !== 'producao';

  const [form, setForm] = useState({
    // admissão
    dataInicio:         worker.dataInicio || '',
    dataNascimento:     worker.data_nascimento || '',
    tipoContrato:       worker.tipo_contrato || 'sem_termo',
    regime:             worker.regime || 'tempo_inteiro',
    modalidadeContrato: computeModalidade(worker),
    horasSemanais:      worker.horas_semanais || 40,
    modoTrabalho:       worker.modo_trabalho || 'presencial',
    profissaoCnp:       worker.profissao_cnp || '',
    enquadramento:      worker.enquadramento || 'REGE',
    localTrabalho:      worker.local_trabalho || '',
    // cessação
    dataCessacao:          worker.dataFim || '',
    motivoCessacao:        '',
    comunicacaoDesemprego: false,
    fundamentacao:         '',
  });

  const [confirmado, setConfirmado] = useState(false);
  const [enviando,   setEnviando]   = useState(false);
  const [erro,       setErro]       = useState(null);
  const [sucesso,    setSucesso]    = useState(null);

  const avisoAdmissao = isAdmissao ? validarPrazoAdmissao(form.dataInicio) : null;
  const avisoCessacao = !isAdmissao ? validarPrazoCessacao(form.dataCessacao) : null;
  const aviso = avisoAdmissao || avisoCessacao;

  // Fundamentação obrigatória só quando: motivo ∈ {RARC/RARD/RARE/RARR} E comunicacaoDesemprego=true
  const precisaFundamentacao = MOTIVOS_COM_FUNDAMENTACAO.includes(form.motivoCessacao) && form.comunicacaoDesemprego;

  // Campos obrigatórios para admissão que podem estar em falta
  const camposFaltando = isAdmissao ? [
    !form.dataNascimento      && 'Data de nascimento',
    !form.profissaoCnp        && 'Código CNP profissão (5 dígitos)',
    !form.localTrabalho       && 'Código do local de trabalho',
  ].filter(Boolean) : [];

  const podaEnviar = confirmado
    && !enviando
    && camposFaltando.length === 0
    && (!isAdmissao ? !!form.motivoCessacao : true)
    && (!precisaFundamentacao || !!form.fundamentacao.trim());

  async function handleEnviar() {
    setEnviando(true);
    setErro(null);
    try {
      const body = {
        action:    tipo,
        workerId:  worker.id,
        confirmadoPor: 'admin',
        dadosExtra: isAdmissao
          ? {
              dataInicio:         form.dataInicio,
              dataNascimento:     form.dataNascimento,
              tipoContrato:       form.tipoContrato,
              regime:             form.regime,
              modalidadeContrato: form.modalidadeContrato,
              horasSemanais:      form.horasSemanais,
              modoTrabalho:       form.modoTrabalho,
              profissaoCnp:       form.profissaoCnp,
              enquadramento:      form.enquadramento,
              localTrabalho:      form.localTrabalho,
            }
          : {
              dataCessacao:          form.dataCessacao,
              motivoCessacao:        form.motivoCessacao,
              comunicacaoDesemprego: form.comunicacaoDesemprego,
              fundamentacao:         form.fundamentacao || undefined,
            },
      };

      const r    = await fetch('/api/seguranca-social', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      const data = await r.json();

      if (data.sucesso) {
        setSucesso(data);
        onSuccess?.(data);
      } else {
        setErro(data.erro || 'Erro desconhecido na Segurança Social.');
      }
    } catch (e) {
      setErro(`Erro de ligação: ${e.message}`);
    } finally {
      setEnviando(false);
    }
  }

  const inp = 'w-full bg-white border border-slate-200 rounded-lg py-1.5 px-2.5 text-sm font-semibold outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all';
  const lbl = 'block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        {/* Banner modo teste */}
        {modoTeste && (
          <div className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2.5 text-xs font-black uppercase tracking-wide rounded-t-2xl">
            <TestTube2 size={14} />
            MODO DE TESTE — não é uma comunicação real para a Segurança Social
          </div>
        )}

        {/* Cabeçalho */}
        <div className={`flex items-center justify-between px-5 py-4 border-b border-slate-100 ${!modoTeste ? 'rounded-t-2xl' : ''}`}>
          <div className="flex items-center gap-2.5">
            <ShieldCheck size={18} className="text-blue-600" />
            <div>
              <h2 className="text-sm font-black text-slate-800">
                Comunicar {isAdmissao ? 'Admissão' : 'Cessação'} à Segurança Social
              </h2>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                {worker.name} · NISS: {worker.nis || '—'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <X size={16} className="text-slate-400" />
          </button>
        </div>

        <div className="p-5 space-y-4">

          {/* Aviso de prazo legal */}
          {aviso && (
            <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 font-medium leading-relaxed">{aviso}</p>
            </div>
          )}

          {/* Campos em falta (admissão) */}
          {isAdmissao && camposFaltando.length > 0 && (
            <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 font-medium leading-relaxed">
                Campos obrigatórios em falta: <strong>{camposFaltando.join(', ')}</strong>. Preencha abaixo antes de enviar.
              </p>
            </div>
          )}

          {/* Dados a enviar */}
          <div className="space-y-3">
            {/* Identificação */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Nome</label>
                <p className="text-sm font-semibold text-slate-700 py-1.5">{worker.name}</p>
              </div>
              <div>
                <label className={lbl}>NISS</label>
                <p className="text-sm font-mono font-semibold text-slate-700 py-1.5">{worker.nis || '—'}</p>
              </div>
              {isAdmissao && (
                <div>
                  <label className={lbl}>NIF</label>
                  <p className="text-sm font-mono font-semibold text-slate-700 py-1.5">{worker.nif || '—'}</p>
                </div>
              )}
            </div>

            {/* Admissão: campos editáveis */}
            {isAdmissao && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Data de Início</label>
                    <input type="date" value={form.dataInicio} onChange={e => setForm(p => ({ ...p, dataInicio: e.target.value }))} className={inp} />
                  </div>
                  <div>
                    <label className={lbl}>Data de Nascimento <span className="text-red-500">*</span></label>
                    <input
                      type="date"
                      value={form.dataNascimento}
                      onChange={e => setForm(p => ({ ...p, dataNascimento: e.target.value }))}
                      className={inp + (!form.dataNascimento ? ' border-amber-400' : '')}
                    />
                  </div>

                  <div className="col-span-2">
                    <label className={lbl}>Modalidade de Contrato PSI <span className="text-red-500">*</span></label>
                    <select value={form.modalidadeContrato} onChange={e => setForm(p => ({ ...p, modalidadeContrato: e.target.value }))} className={inp}>
                      {MODALIDADE_CONTRATO.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-400 mt-0.5">Calculado automaticamente; corrija se o contrato tiver condições especiais.</p>
                  </div>

                  <div>
                    <label className={lbl}>Horas / Semana</label>
                    <input type="number" min="1" max="48" step="0.5" value={form.horasSemanais} onChange={e => setForm(p => ({ ...p, horasSemanais: parseFloat(e.target.value) || 40 }))} className={inp} />
                  </div>
                  <div>
                    <label className={lbl}>Modo de Trabalho</label>
                    <select value={form.modoTrabalho} onChange={e => setForm(p => ({ ...p, modoTrabalho: e.target.value }))} className={inp}>
                      <option value="presencial">Presencial (P)</option>
                      <option value="remoto">Teletrabalho total (T)</option>
                      <option value="hibrido">Teletrabalho parcial (A)</option>
                    </select>
                  </div>

                  <div>
                    <label className={lbl}>Código CNP Profissão <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      maxLength={5}
                      value={form.profissaoCnp}
                      onChange={e => setForm(p => ({ ...p, profissaoCnp: e.target.value.replace(/\D/g, '').substring(0, 5) }))}
                      placeholder="ex: 93130"
                      className={inp + (!form.profissaoCnp ? ' border-amber-400' : '')}
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">5 dígitos · Classificação Portuguesa de Profissões</p>
                  </div>
                  <div>
                    <label className={lbl}>Enquadramento</label>
                    <select value={form.enquadramento} onChange={e => setForm(p => ({ ...p, enquadramento: e.target.value }))} className={inp}>
                      {ENQUADRAMENTOS.map(e => (
                        <option key={e.value} value={e.value}>{e.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label className={lbl}>Código Local de Trabalho <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      min="1"
                      value={form.localTrabalho}
                      onChange={e => setForm(p => ({ ...p, localTrabalho: e.target.value }))}
                      placeholder="ex: 1"
                      className={inp + (!form.localTrabalho ? ' border-amber-400' : '')}
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">Código PSI do estabelecimento de trabalho (obtido na Segurança Social Direta)</p>
                  </div>
                </div>
              </>
            )}

            {/* Cessação: campos editáveis */}
            {!isAdmissao && (
              <div className="space-y-3">
                <div>
                  <label className={lbl}>Data de Cessação</label>
                  <input type="date" value={form.dataCessacao} onChange={e => setForm(p => ({ ...p, dataCessacao: e.target.value }))} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Motivo de Cessação <span className="text-red-500">*</span></label>
                  <select value={form.motivoCessacao} onChange={e => setForm(p => ({ ...p, motivoCessacao: e.target.value }))} className={inp}>
                    <option value="">— Selecionar motivo —</option>
                    {MOTIVOS_CESSACAO.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>

                {/* Comunicação ao subsistema de desemprego */}
                <label className="flex items-start gap-2.5 cursor-pointer group">
                  <div
                    onClick={() => setForm(p => ({ ...p, comunicacaoDesemprego: !p.comunicacaoDesemprego }))}
                    className={`mt-0.5 w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-all ${form.comunicacaoDesemprego ? 'bg-blue-600 border-blue-600' : 'border-slate-300 group-hover:border-blue-400'}`}
                  >
                    {form.comunicacaoDesemprego && <CheckCircle2 size={10} className="text-white" />}
                  </div>
                  <span className="text-xs text-slate-600 font-medium leading-relaxed">
                    Comunicar para efeitos de prestações de desemprego
                    <span className="block text-slate-400 text-[10px] mt-0.5">Marque se o trabalhador pretende requerer subsídio de desemprego</span>
                  </span>
                </label>

                {precisaFundamentacao && (
                  <div>
                    <label className={lbl}>Fundamentação <span className="text-red-500">*</span></label>
                    <textarea
                      value={form.fundamentacao}
                      onChange={e => setForm(p => ({ ...p, fundamentacao: e.target.value }))}
                      rows={3}
                      className={inp + ' resize-none'}
                      placeholder="Descreva o fundamento legal da cessação (obrigatório para este motivo com comunicação de desemprego)…"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Erro do webservice */}
          {erro && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl p-3">
              <AlertTriangle size={14} className="text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-black text-red-700 mb-0.5">Erro devolvido pela Segurança Social</p>
                <p className="text-xs text-red-600 leading-relaxed">{erro}</p>
              </div>
            </div>
          )}

          {/* Sucesso */}
          {sucesso && (
            <div className="flex items-start gap-2.5 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
              <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-black text-emerald-700 mb-0.5">{isAdmissao ? 'Admissão' : 'Cessação'} registada com sucesso</p>
                {sucesso.numRegisto && (
                  <p className="text-xs text-emerald-600">Nº de registo: <span className="font-mono font-black">{sucesso.numRegisto}</span></p>
                )}
                <p className="text-xs text-emerald-500 mt-0.5">
                  {sucesso.ambiente === 'teste'
                    ? '(ambiente de teste — não é uma comunicação real)'
                    : `Data/hora: ${new Date(sucesso.dataHora).toLocaleString('pt-PT')}`}
                </p>
              </div>
            </div>
          )}

          {/* Checkbox de confirmação */}
          {!sucesso && (
            <label className="flex items-start gap-2.5 cursor-pointer group">
              <div
                onClick={() => setConfirmado(v => !v)}
                className={`mt-0.5 w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-all ${confirmado ? 'bg-blue-600 border-blue-600' : 'border-slate-300 group-hover:border-blue-400'}`}
              >
                {confirmado && <CheckCircle2 size={10} className="text-white" />}
              </div>
              <span className="text-xs text-slate-600 leading-relaxed font-medium">
                Confirmo que estes dados estão corretos e autorizo o envio para a Segurança Social.
                {modoTeste && <span className="text-orange-600 font-bold"> (MODO DE TESTE)</span>}
              </span>
            </label>
          )}

          {/* Botões */}
          <div className="flex gap-2 pt-1">
            {sucesso ? (
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black transition-colors">
                Fechar
              </button>
            ) : (
              <>
                <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm font-bold transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={handleEnviar}
                  disabled={!podaEnviar}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-black transition-colors ${podaEnviar ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                >
                  {enviando && <Loader2 size={14} className="animate-spin" />}
                  {enviando ? 'A enviar…' : 'Enviar para a Segurança Social'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
