import React, { useState } from 'react';
import {
  X, MapPin, AlertTriangle, CheckCircle2, Loader2, TestTube2, ShieldAlert
} from 'lucide-react';
import { authFetch } from '../../../utils/authFetch';
import { validarNiss, isRegistoFicticio } from './SSComunicacaoModal';

export default function TransferirLocalTrabalhoModal({ worker, ambiente, onClose, onSuccess }) {
  const modoTeste = ambiente !== 'producao';

  const erroNiss  = validarNiss(worker.nis);
  const ficticio  = isRegistoFicticio(worker);
  const bloqueado = !!(erroNiss || ficticio);

  const [form, setForm] = useState({
    dataInicio:          '',
    dataFim:              '',
    codigoLocalTrabalho:  worker.local_trabalho || '',
  });

  const [confirmado, setConfirmado] = useState(false);
  const [enviando,   setEnviando]   = useState(false);
  const [erro,       setErro]       = useState(null);
  const [sucesso,    setSucesso]    = useState(null);

  const camposFaltando = [
    !form.dataInicio && 'Data de início',
    (form.codigoLocalTrabalho === '' || form.codigoLocalTrabalho == null) && 'Código do local de trabalho',
  ].filter(Boolean);

  const podeEnviar = !bloqueado && confirmado && !enviando && camposFaltando.length === 0;

  async function handleEnviar() {
    setEnviando(true);
    setErro(null);
    try {
      const body = {
        action:    'transferir-local-trabalho',
        workerId:  worker.id,
        confirmadoPor: 'admin',
        dadosExtra: {
          dataInicio:          form.dataInicio,
          dataFim:             form.dataFim || undefined,
          codigoLocalTrabalho: form.codigoLocalTrabalho,
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
            <MapPin size={18} className="text-[#1B3A57]" />
            <div>
              <h2 className="text-sm font-black text-slate-800">Transferir Local de Trabalho</h2>
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

          {/* ── Campos em falta (bloqueiam o envio) ── */}
          {!bloqueado && camposFaltando.length > 0 && (
            <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 font-medium leading-relaxed">
                Campos obrigatórios em falta: <strong>{camposFaltando.join(', ')}</strong>. Preencha abaixo antes de enviar.
              </p>
            </div>
          )}

          {/* ── Formulário (só visível se não bloqueado) ── */}
          {!bloqueado && !sucesso && (
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

                <div>
                  <label className={lbl}>Data de Início <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={form.dataInicio}
                    onChange={e => setForm(p => ({ ...p, dataInicio: e.target.value }))}
                    className={inp + (!form.dataInicio ? ' border-amber-400' : '')}
                  />
                </div>
                <div>
                  <label className={lbl}>Data de Fim</label>
                  <input
                    type="date"
                    value={form.dataFim}
                    onChange={e => setForm(p => ({ ...p, dataFim: e.target.value }))}
                    placeholder="opcional"
                    className={inp}
                  />
                </div>

                <div className="col-span-2">
                  <label className={lbl}>Código do Local de Trabalho <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.codigoLocalTrabalho}
                    onChange={e => setForm(p => ({ ...p, codigoLocalTrabalho: e.target.value }))}
                    placeholder="Código PSI do estabelecimento de trabalho"
                    className={inp + (form.codigoLocalTrabalho === '' ? ' border-amber-400' : '')}
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Código PSI do estabelecimento (obtido na Segurança Social Direta).</p>
                </div>
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
              </div>
            </div>
          )}

          {/* Sucesso */}
          {sucesso && (
            <div className="flex items-start gap-2.5 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
              <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-black text-emerald-700 mb-0.5">Local de trabalho transferido com sucesso</p>
                <p className="text-xs text-emerald-500 mt-0.5">
                  {sucesso.ambiente === 'teste'
                    ? '(ambiente de teste — não é uma comunicação real)'
                    : `Data/hora: ${new Date(sucesso.dataHora).toLocaleString('pt-PT')}`}
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
                  {enviando ? 'A enviar…' : 'Enviar Transferência para a Segurança Social'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
