import React, { useState } from 'react';
import {
  X, ShieldCheck, AlertTriangle, CheckCircle2, Loader2, TestTube2, ShieldAlert
} from 'lucide-react';
import { findProfissaoByCodigo } from '../../../data/profissoesEmpresa';
import { authFetch } from '../../../utils/authFetch';
import { MOTIVOS_CONTRATO_CERTO, MOTIVOS_CONTRATO_INCERTO, MODALIDADES_TERMO_INCERTO, MODALIDADES_COM_MOTIVO_OBRIGATORIO, MOTIVOS_EXIGEM_SUBSTITUIDO } from '../../../data/motivosContratoSS.js';
import { validarNiss, isRegistoFicticio, computeModalidade, MODALIDADE_CONTRATO } from './SSComunicacaoModal';

// Modalidades a termo CERTO que exigem fim-contrato no Alterar Contrato — o
// PDF desta spec lista E,EA,EB,O,F,FA,FB,N, SEM "I" (ao contrário da
// Admissão, onde "I" também é termo certo). Conjunto próprio, não reutiliza
// MODALIDADES_TERMO_CERTO da Admissão para não confundir os dois domínios.
const MODALIDADES_TERMO_CERTO_ALTERAR = new Set(['E', 'EA', 'EB', 'O', 'F', 'FA', 'FB', 'N']);

// Modalidades tempo parcial — mesmo conjunto usado na Admissão (_soapUtils.js).
const MODALIDADES_PARCIAL = new Set(['B', 'D', 'BA', 'BB', 'R', 'F', 'FA', 'FB', 'N', 'H', 'HA', 'HB', 'P']);

function fmtDate(iso) {
  if (!iso) return '—';
  const p = iso.split('T')[0].split('-');
  return `${p[2]}/${p[1]}/${p[0]}`;
}

// Limite RÍGIDO imposto pela própria PSI (não consta um limiar exato para
// "muito curta duração" — esse fica para a SS rejeitar). Este, ao contrário,
// está explícito no PDF: início do contrato não pode exceder em 30 dias a
// data atual. Bloqueia o envio, como validarLimitesDataCessacao faz para a
// Cessação em SSComunicacaoModal.jsx — não é um aviso informativo.
function validarLimiteInicioAlteracao(dataInicio) {
  if (!dataInicio) return 'Data de início do contrato';
  const inicio = new Date(dataInicio.split('T')[0]);
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const limite = new Date(hoje); limite.setDate(limite.getDate() + 30);
  if (inicio > limite) {
    return `Data de início (${fmtDate(dataInicio)}) excede em mais de 30 dias a data atual — a Segurança Social rejeita este pedido.`;
  }
  return null;
}

export default function AlterarContratoModal({ worker, ambiente, onClose, onSuccess }) {
  const modoTeste = ambiente !== 'producao';

  const erroNiss  = validarNiss(worker.nis);
  const ficticio  = isRegistoFicticio(worker);
  const bloqueado = !!(erroNiss || ficticio);

  const [form, setForm] = useState({
    modalidadeContrato:  computeModalidade(worker),
    prestacaoTrabalho:   'P',
    dataInicio:           worker.dataInicio || '',
    dataFim:               worker.dataFim || '',
    profissaoCnp:          worker.profissao_cnp || '',
    remuneracaoBase:       worker.vencimento_base || '',
    diuturnidades:         '',
    percentagemTrabalho:   '',
    horasTrabalho:         worker.horas_semanais || '',
    diasTrabalho:          '',
    // EOPA pré-selecionado por defeito, mesma convenção do modal de Admissão.
    motivoContrato:            'EOPA',
    nissTrabalhadorSubstituir: '',
  });

  const [confirmado, setConfirmado] = useState(false);
  const [enviando,   setEnviando]   = useState(false);
  const [erro,       setErro]       = useState(null);
  const [sucesso,    setSucesso]    = useState(null);

  const profissaoDefinida = findProfissaoByCodigo(form.profissaoCnp);

  const isTermoCerto   = MODALIDADES_TERMO_CERTO_ALTERAR.has(form.modalidadeContrato);
  const isTermoIncerto = MODALIDADES_TERMO_INCERTO.has(form.modalidadeContrato);
  const isParcial       = MODALIDADES_PARCIAL.has(form.modalidadeContrato);
  const precisaMotivoContrato = MODALIDADES_COM_MOTIVO_OBRIGATORIO.has(form.modalidadeContrato);
  const motivosDisponiveis = isTermoIncerto ? MOTIVOS_CONTRATO_INCERTO : MOTIVOS_CONTRATO_CERTO;
  const precisaSubstituido = MOTIVOS_EXIGEM_SUBSTITUIDO.has(form.motivoContrato);

  const erroLimiteInicio = validarLimiteInicioAlteracao(form.dataInicio);

  const camposFaltando = [
    erroLimiteInicio,
    !profissaoDefinida && 'Profissão (definir no perfil do trabalhador)',
    (!form.remuneracaoBase || parseFloat(form.remuneracaoBase) <= 0) && 'Remuneração base (> 0)',
    (isTermoCerto && !form.dataFim) && 'Data de fim do contrato (obrigatória para modalidade a termo certo)',
    (isParcial && (!form.percentagemTrabalho || !form.horasTrabalho || !form.diasTrabalho)) && 'Percentagem / Horas / Dias de trabalho (modalidade a tempo parcial)',
    (precisaMotivoContrato && !form.motivoContrato) && 'Motivo do contrato',
    (precisaSubstituido && !form.nissTrabalhadorSubstituir) && 'NISS do trabalhador substituído',
  ].filter(Boolean);

  const podeEnviar = !bloqueado && confirmado && !enviando && camposFaltando.length === 0;

  async function handleEnviar() {
    setEnviando(true);
    setErro(null);
    try {
      const body = {
        action:    'alterar-contrato',
        workerId:  worker.id,
        confirmadoPor: 'admin',
        dadosExtra: {
          modalidadeContrato:  form.modalidadeContrato,
          prestacaoTrabalho:   form.prestacaoTrabalho,
          dataInicioContrato:  form.dataInicio,
          dataFimContrato:     isTermoCerto ? form.dataFim : undefined,
          profissaoCnp:        form.profissaoCnp,
          remuneracaoBase:     form.remuneracaoBase,
          diuturnidades:       form.diuturnidades || undefined,
          percentagemTrabalho: isParcial ? form.percentagemTrabalho : undefined,
          horasTrabalho:       isParcial ? form.horasTrabalho : undefined,
          diasTrabalho:        isParcial ? form.diasTrabalho : undefined,
          motivoContrato:            form.motivoContrato || undefined,
          nissTrabalhadorSubstituir: form.nissTrabalhadorSubstituir || undefined,
        },
      };

      const r    = await authFetch('/api/seguranca-social', {
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

  const inp = 'w-full bg-white border border-slate-200 rounded-lg py-1.5 px-2.5 text-sm font-semibold outline-none focus:border-[#1B3A57] focus:ring-2 focus:ring-[#1B3A57]/10 transition-all';
  const lbl = 'block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        {/* ── Banner de ambiente — PRODUÇÃO (vermelho) ou TESTE (laranja) ── */}
        {!modoTeste ? (
          <div className="flex items-center gap-2.5 bg-red-600 text-white px-4 py-3 text-xs font-black uppercase tracking-wide rounded-t-2xl">
            <ShieldAlert size={16} className="shrink-0" />
            <span>
              ⚠️ AMBIENTE REAL — QUALQUER ENVIO AQUI ALTERA UM REGISTO OFICIAL NA SEGURANÇA SOCIAL
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2.5 text-xs font-black uppercase tracking-wide rounded-t-2xl">
            <TestTube2 size={14} />
            MODO DE TESTE — não é uma comunicação real para a Segurança Social
          </div>
        )}

        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <ShieldCheck size={18} className="text-[#1B3A57]" />
            <div>
              <h2 className="text-sm font-black text-slate-800">Alterar Contrato de Trabalho</h2>
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

          {/* ── BLOQUEIO: registo fictício ── */}
          {ficticio && (
            <div className="flex items-start gap-2.5 bg-red-50 border-2 border-red-500 rounded-xl p-3.5">
              <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-black text-red-700 mb-1">Envio bloqueado — registo de teste detetado</p>
                <p className="text-xs text-red-600 leading-relaxed">
                  O nome <strong>"{worker.name}"</strong> sugere ser um registo fictício. Este registo deve ser removido da lista de Equipa antes de qualquer uso em produção.
                </p>
              </div>
            </div>
          )}

          {/* ── BLOQUEIO: NISS inválido ── */}
          {erroNiss && (
            <div className="flex items-start gap-2.5 bg-red-50 border-2 border-red-500 rounded-xl p-3.5">
              <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-black text-red-700 mb-1">Envio bloqueado — NISS inválido</p>
                <p className="text-xs text-red-600 leading-relaxed">{erroNiss}</p>
                <p className="text-xs text-red-500 mt-1.5 font-medium">Corrija o NISS na ficha do trabalhador e reabra este ecrã.</p>
              </div>
            </div>
          )}

          {/* ── Aviso informativo (amarelo — não bloqueia) ── */}
          {!bloqueado && (
            <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 font-medium leading-relaxed">
                Não é possível alterar contratos de muito curta duração — a própria Segurança Social rejeita o pedido nesse caso, não há validação local para isso.
              </p>
            </div>
          )}

          {/* ── Campos em falta / valores inválidos (bloqueiam o envio) ── */}
          {!bloqueado && camposFaltando.length > 0 && (
            <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 font-medium leading-relaxed">
                Campos obrigatórios em falta ou inválidos: <strong>{camposFaltando.join(', ')}</strong>. Preencha abaixo antes de enviar.
              </p>
            </div>
          )}

          {/* ── Formulário (só visível se não bloqueado) ── */}
          {!bloqueado && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Nome</label>
                  <p className="text-sm font-semibold text-slate-700 py-1.5">{worker.name}</p>
                </div>
                <div>
                  <label className={lbl}>NISS</label>
                  <p className="text-sm font-mono font-semibold text-slate-700 py-1.5">{worker.nis || '—'}</p>
                </div>

                <div className="col-span-2">
                  <label className={lbl}>Modalidade de Contrato PSI <span className="text-red-500">*</span></label>
                  <select value={form.modalidadeContrato} onChange={e => setForm(p => ({ ...p, modalidadeContrato: e.target.value, motivoContrato: 'EOPA' }))} className={inp}>
                    {MODALIDADE_CONTRATO.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={lbl}>Data de Início <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={form.dataInicio}
                    onChange={e => setForm(p => ({ ...p, dataInicio: e.target.value }))}
                    className={inp + (erroLimiteInicio ? ' border-amber-400' : '')}
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Não pode exceder 30 dias a partir de hoje (limite rígido da PSI).</p>
                </div>
                {isTermoCerto && (
                  <div>
                    <label className={lbl}>Data de Fim <span className="text-red-500">*</span></label>
                    <input
                      type="date"
                      value={form.dataFim}
                      onChange={e => setForm(p => ({ ...p, dataFim: e.target.value }))}
                      className={inp + (!form.dataFim ? ' border-amber-400' : '')}
                    />
                  </div>
                )}

                <div>
                  <label className={lbl}>Prestação de Trabalho</label>
                  <select value={form.prestacaoTrabalho} onChange={e => setForm(p => ({ ...p, prestacaoTrabalho: e.target.value }))} className={inp}>
                    <option value="P">Presencial (P)</option>
                    <option value="T">Teletrabalho total (T)</option>
                    <option value="A">Teletrabalho parcial (A)</option>
                  </select>
                </div>
                <div>
                  <label className={lbl}>Profissão CPP <span className="text-red-500">*</span></label>
                  {profissaoDefinida ? (
                    <p className="text-sm font-mono font-semibold text-slate-800 py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg truncate">
                      {profissaoDefinida.codigoCPP} — {profissaoDefinida.designacaoModal}
                    </p>
                  ) : (
                    <div className="flex items-start gap-2 bg-amber-50 border border-amber-300 rounded-lg px-2.5 py-2">
                      <AlertTriangle size={13} className="text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-800 font-medium leading-snug">
                        Profissão não definida — aceda ao perfil do trabalhador antes de continuar.
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <label className={lbl}>Remuneração Base (€) <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.remuneracaoBase}
                    onChange={e => setForm(p => ({ ...p, remuneracaoBase: e.target.value }))}
                    className={inp + ((!form.remuneracaoBase || parseFloat(form.remuneracaoBase) <= 0) ? ' border-amber-400' : '')}
                  />
                </div>
                <div>
                  <label className={lbl}>Diuturnidades (€)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.diuturnidades}
                    onChange={e => setForm(p => ({ ...p, diuturnidades: e.target.value }))}
                    placeholder="opcional"
                    className={inp}
                  />
                </div>

                {isParcial && (
                  <>
                    <div>
                      <label className={lbl}>% Trabalho <span className="text-red-500">*</span></label>
                      <input type="number" min="0" max="100" step="0.01" value={form.percentagemTrabalho} onChange={e => setForm(p => ({ ...p, percentagemTrabalho: e.target.value }))} className={inp + (!form.percentagemTrabalho ? ' border-amber-400' : '')} />
                    </div>
                    <div>
                      <label className={lbl}>Horas Trabalho <span className="text-red-500">*</span></label>
                      <input type="number" min="0" step="0.01" value={form.horasTrabalho} onChange={e => setForm(p => ({ ...p, horasTrabalho: e.target.value }))} className={inp + (!form.horasTrabalho ? ' border-amber-400' : '')} />
                    </div>
                    <div>
                      <label className={lbl}>Dias Trabalho <span className="text-red-500">*</span></label>
                      <input type="number" min="0" step="0.01" value={form.diasTrabalho} onChange={e => setForm(p => ({ ...p, diasTrabalho: e.target.value }))} className={inp + (!form.diasTrabalho ? ' border-amber-400' : '')} />
                    </div>
                  </>
                )}

                {precisaMotivoContrato && (
                  <div className="col-span-2">
                    <label className={lbl}>Motivo do Contrato <span className="text-red-500">*</span></label>
                    <select
                      value={form.motivoContrato}
                      onChange={e => setForm(p => ({ ...p, motivoContrato: e.target.value }))}
                      className={inp + (!form.motivoContrato ? ' border-amber-400' : '')}
                    >
                      <option value="">— Selecionar motivo —</option>
                      {motivosDisponiveis.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Obrigatório para contratos a termo — lista de motivos {isTermoIncerto ? 'a termo incerto' : 'a termo certo'} da PSI.
                    </p>
                  </div>
                )}
                {precisaSubstituido && (
                  <div className="col-span-2">
                    <label className={lbl}>NISS do Trabalhador Substituído <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={form.nissTrabalhadorSubstituir}
                      onChange={e => setForm(p => ({ ...p, nissTrabalhadorSubstituir: e.target.value.replace(/\D/g, '') }))}
                      placeholder="11 dígitos"
                      className={inp + (!form.nissTrabalhadorSubstituir ? ' border-amber-400' : '')}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Erro do webservice */}
          {erro && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl p-3">
              <AlertTriangle size={14} className="text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-black text-red-700 mb-0.5">Erro devolvido pela Segurança Social</p>
                <p className="text-xs text-red-600 leading-relaxed">{erro}</p>
                <p className="text-[10px] text-red-400 mt-1">Esta tentativa fica registada em Definições → Segurança Social PSI → Consultas → Histórico de Comunicações.</p>
              </div>
            </div>
          )}

          {/* Sucesso */}
          {sucesso && (
            <div className="flex items-start gap-2.5 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
              <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-black text-emerald-700 mb-0.5">Contrato alterado com sucesso</p>
                <p className="text-xs text-emerald-500 mt-0.5">
                  {sucesso.ambiente === 'teste'
                    ? '(ambiente de teste — não é uma comunicação real)'
                    : `Data/hora: ${new Date(sucesso.dataHora).toLocaleString('pt-PT')}`}
                </p>
                <p className="text-[10px] text-emerald-400 mt-1 pt-1 border-t border-emerald-100">
                  Este registo fica guardado em Definições → Segurança Social PSI → Consultas → Histórico de Comunicações.
                </p>
              </div>
            </div>
          )}

          {/* Checkbox de confirmação (só se não bloqueado e não houve sucesso) */}
          {!bloqueado && !sucesso && (
            <label className="flex items-start gap-2.5 cursor-pointer group">
              <div
                onClick={() => setConfirmado(v => !v)}
                className={`mt-0.5 w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-all ${confirmado ? '' : 'border-slate-300 group-hover:border-[#869AAF]'}`}
                style={confirmado ? { backgroundColor: '#1B3A57', borderColor: '#1B3A57' } : {}}
              >
                {confirmado && <CheckCircle2 size={10} className="text-white" />}
              </div>
              <span className="text-xs text-slate-600 leading-relaxed font-medium">
                Confirmo que estes dados estão corretos e autorizo o envio para a Segurança Social. Não existe undo para esta ação.
                {modoTeste
                  ? <span className="text-orange-600 font-bold"> (MODO DE TESTE)</span>
                  : <span className="text-red-600 font-black"> (AMBIENTE REAL — REGISTO OFICIAL)</span>
                }
              </span>
            </label>
          )}

          {/* Botões */}
          <div className="flex gap-2 pt-1">
            {sucesso ? (
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black transition-colors">
                Fechar
              </button>
            ) : bloqueado ? (
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-black transition-colors">
                Fechar (corrigir dados primeiro)
              </button>
            ) : (
              <>
                <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm font-bold transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={handleEnviar}
                  disabled={!podeEnviar}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-black transition-colors ${podeEnviar ? (modoTeste ? 'text-white hover:opacity-90' : 'bg-red-600 hover:bg-red-700 text-white') : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                  style={podeEnviar && modoTeste ? { backgroundColor: '#1B3A57' } : {}}
                >
                  {enviando && <Loader2 size={14} className="animate-spin" />}
                  {enviando ? 'A enviar…' : 'Enviar Alteração para a Segurança Social'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
