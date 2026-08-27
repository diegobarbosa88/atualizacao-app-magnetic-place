import React, { useState, useRef, useEffect } from 'react';
import {
  X, AlertTriangle, CheckCircle2, Loader2, TestTube2, ShieldAlert, Send, Info
} from 'lucide-react';
import { authFetch } from '../../../utils/authFetch';
import { formatReferencia } from './ssDocumentoPagamentoUtils';

// Enum fechado — só estes 10 valores são aceites pela PSI (confirmado no
// OpenAPI oficial). Não inventar outros.
const AMBITOS = [
  { value: 11, label: '11 — Contribuições - Entidade Empregadora' },
  { value: 12, label: '12 — Contribuições - Trabalhador Independente' },
  { value: 13, label: '13 — Contribuições - Seguro Social Voluntário' },
  { value: 14, label: '14 — Contribuições - Produtor Agrícola dos Açores' },
  { value: 15, label: '15 — Contribuições - Serviço Doméstico' },
  { value: 16, label: '16 — Contribuições - Entidade Contratante' },
  { value: 17, label: '17 — Contraordenações' },
  { value: 18, label: '18 — Acordos e planos prestacionais' },
  { value: 19, label: '19 — Outros Valores' },
  { value: 20, label: '20 — Contribuições - Entidade Beneficiária' },
];

const MAX_TENTATIVAS = 8;
const POLL_MS = 2000;

export default function EmitirDocumentoPagamentoModal({ ambiente, onClose }) {
  const modoTeste = ambiente !== 'producao';

  const [ambito, setAmbito] = useState('');
  const [confirmado, setConfirmado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);
  const [pedido, setPedido] = useState(null); // { codigoResultado, mensagem, chave }
  const [consulta, setConsulta] = useState(null); // { loading, msg? } | { estado, resultado?, mensagem?, erro? }
  const pollRef = useRef(null);

  useEffect(() => () => clearTimeout(pollRef.current), []);

  async function pollConsultar(chave, tentativa = 1) {
    try {
      const r = await authFetch('/api/seguranca-social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'consultar-emissao-documento-pagamento', chave }),
      });
      const json = await r.json();
      if (!r.ok) { setConsulta({ estado: 'erro', erro: json.erro || `HTTP ${r.status}` }); return; }

      if (json.estado === 'processando') {
        if (tentativa >= MAX_TENTATIVAS) {
          setConsulta({ estado: 'erro', erro: 'Ainda em processamento — tente consultar novamente mais tarde.' });
          return;
        }
        setConsulta({ loading: true, msg: 'A processar…' });
        pollRef.current = setTimeout(() => pollConsultar(chave, tentativa + 1), POLL_MS);
        return;
      }

      setConsulta(json);
    } catch (e) {
      setConsulta({ estado: 'erro', erro: e.message });
    }
  }

  async function handleEmitir() {
    setEnviando(true);
    setErro(null);
    try {
      const r = await authFetch('/api/seguranca-social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'emitir-documento-pagamento', ambito: Number(ambito), confirmadoPor: 'admin' }),
      });
      const json = await r.json();
      if (!json.sucesso) {
        setErro(json.erro || 'Erro desconhecido na Segurança Social.');
        return;
      }
      setPedido(json);
      if (json.chave) {
        setConsulta({ loading: true, msg: 'A processar…' });
        pollConsultar(json.chave);
      }
    } catch (e) {
      setErro(`Erro de ligação: ${e.message}`);
    } finally {
      setEnviando(false);
    }
  }

  function reiniciar() {
    clearTimeout(pollRef.current);
    setPedido(null);
    setConsulta(null);
    setErro(null);
    setConfirmado(false);
  }

  const podeEnviar = !!ambito && confirmado && !enviando && !pedido;

  const inp = 'w-full bg-white border border-slate-200 rounded-lg py-1.5 px-2.5 text-sm font-semibold outline-none focus:border-[#1B3A57] focus:ring-2 focus:ring-[#1B3A57]/10 transition-all';
  const lbl = 'block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        {/* ── Banner de ambiente — PRODUÇÃO (vermelho) ou TESTE (laranja) ── */}
        {!modoTeste ? (
          <div className="flex items-center gap-2.5 bg-red-600 text-white px-4 py-3 text-xs font-black uppercase tracking-wide rounded-t-2xl">
            <ShieldAlert size={16} className="shrink-0" />
            <span>⚠️ AMBIENTE REAL — QUALQUER PEDIDO AQUI CRIA UM DOCUMENTO DE PAGAMENTO OFICIAL</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2.5 text-xs font-black uppercase tracking-wide rounded-t-2xl">
            <TestTube2 size={14} />
            MODO DE TESTE — não é um pedido real para a Segurança Social
          </div>
        )}

        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <Send size={18} className="text-[#1B3A57]" />
            <h2 className="text-sm font-black text-slate-800">Emitir Documento de Pagamento</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <X size={16} className="text-slate-400" />
          </button>
        </div>

        <div className="p-5 space-y-4">

          {/* ── Avisos bem visíveis, sempre presentes ── */}
          <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1">
            <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
            <ul className="text-xs text-amber-800 font-medium leading-relaxed list-disc pl-4 space-y-1">
              <li>Não existe operação de cancelamento/anulação de um pedido de emissão já aceite.</li>
              <li>A proteção contra duplicação (entidade + âmbito) <strong>não protege contra emitir com o âmbito errado</strong> — confirme o âmbito com atenção antes de enviar.</li>
              <li>Pagamento por débito direto pode desencadear cobrança bancária automática agendada, sem confirmação adicional depois da emissão.</li>
              <li>Multibanco tem teto de 99.999,99 € — acima disso a referência simplesmente não é gerada (outras modalidades continuam disponíveis).</li>
            </ul>
          </div>

          {!pedido && (
            <div>
              <label className={lbl}>Âmbito <span className="text-red-500">*</span></label>
              <select value={ambito} onChange={e => setAmbito(e.target.value)} className={inp}>
                <option value="">— Selecionar âmbito —</option>
                {AMBITOS.map(a => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Erro do pedido */}
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

          {/* Pedido aceite — mensagem consoante codigoResultado 1 / 10 / 11 */}
          {pedido && (
            <div className="flex items-start gap-2.5 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
              <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-emerald-700 font-medium leading-relaxed">
                  {pedido.codigoResultado === '10'
                    ? 'Já existe um pedido em processamento para este âmbito — a consultar o resultado desse pedido.'
                    : pedido.codigoResultado === '11'
                    ? 'Já existe uma resposta na validade para este âmbito — a obter os documentos já emitidos.'
                    : 'Pedido de emissão aceite — processamento assíncrono, a consultar o resultado.'}
                </p>
                <p className="text-[10px] text-emerald-400 mt-1 pt-1 border-t border-emerald-100">
                  Este pedido fica guardado em Definições → Segurança Social PSI → Consultas → Histórico de Comunicações.
                </p>
              </div>
            </div>
          )}

          {/* Estado da consulta (polling) */}
          {consulta?.loading && (
            <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
              <Loader2 size={13} className="animate-spin" /> {consulta.msg || 'A processar…'}
            </div>
          )}

          {consulta?.estado === 'expirado' && (
            <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-amber-800 font-medium leading-relaxed">{consulta.erro || 'Pedido expirado.'}</p>
                <button onClick={reiniciar} className="mt-2 text-xs font-bold underline text-amber-700">Repetir pedido</button>
              </div>
            </div>
          )}

          {consulta?.estado === 'sem_valores' && (
            <div className="flex items-start gap-2.5 bg-slate-50 border border-slate-200 rounded-xl p-3">
              <Info size={14} className="text-slate-500 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-600 font-medium leading-relaxed">{consulta.mensagem || 'Processado, mas sem valores a pagar no momento.'}</p>
            </div>
          )}

          {consulta?.estado === 'erro' && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl p-3">
              <AlertTriangle size={14} className="text-red-600 shrink-0 mt-0.5" />
              <p className="text-xs text-red-600 leading-relaxed">{consulta.erro}</p>
            </div>
          )}

          {consulta?.estado === 'sucesso' && (
            <div className="space-y-2">
              <p className="text-xs font-black text-slate-700">Documentos emitidos — validade não é quantificada pela SS, mostra-se apenas "na validade"/"expirado" tal como devolvido.</p>
              {(consulta.resultado || []).length === 0 ? (
                <p className="text-xs text-slate-500">Sem documentos no resultado.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-50 text-gray-600">
                        {['Tipo', 'Subtipo', 'Nº Documento', 'Validade', 'Valor (€)', 'Referência'].map(h => (
                          <th key={h} className="px-2 py-1.5 text-left border border-gray-200">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {consulta.resultado.map((row, i) => (
                        <tr key={i} className="odd:bg-white even:bg-gray-50">
                          <td className="px-2 py-1 border border-gray-200">{row.tipo ?? '—'}</td>
                          <td className="px-2 py-1 border border-gray-200">{row.subtipo ?? '—'}</td>
                          <td className="px-2 py-1 border border-gray-200 font-mono">{row.numeroDocumentoPagamento ?? '—'}</td>
                          <td className="px-2 py-1 border border-gray-200">{row.dataValidade ?? '—'}</td>
                          <td className="px-2 py-1 border border-gray-200 text-right">{row.valor != null ? Number(row.valor).toFixed(2) : '—'}</td>
                          <td className="px-2 py-1 border border-gray-200 font-mono">{formatReferencia(row.referenciaDocumentoPagamento)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Checkbox de confirmação */}
          {!pedido && (
            <label className="flex items-start gap-2.5 cursor-pointer group">
              <div
                onClick={() => setConfirmado(v => !v)}
                className={`mt-0.5 w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-all ${confirmado ? '' : 'border-slate-300 group-hover:border-[#869AAF]'}`}
                style={confirmado ? { backgroundColor: '#1B3A57', borderColor: '#1B3A57' } : {}}
              >
                {confirmado && <CheckCircle2 size={10} className="text-white" />}
              </div>
              <span className="text-xs text-slate-600 leading-relaxed font-medium">
                Confirmo o âmbito selecionado e autorizo o pedido de emissão à Segurança Social. Não há forma de cancelar um pedido já aceite.
                {modoTeste
                  ? <span className="text-orange-600 font-bold"> (MODO DE TESTE)</span>
                  : <span className="text-red-600 font-black"> (AMBIENTE REAL)</span>
                }
              </span>
            </label>
          )}

          {/* Botões */}
          <div className="flex gap-2 pt-1">
            {pedido ? (
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black transition-colors">
                Fechar
              </button>
            ) : (
              <>
                <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm font-bold transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={handleEmitir}
                  disabled={!podeEnviar}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-black transition-colors ${podeEnviar ? (modoTeste ? 'text-white hover:opacity-90' : 'bg-red-600 hover:bg-red-700 text-white') : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                  style={podeEnviar && modoTeste ? { backgroundColor: '#1B3A57' } : {}}
                >
                  {enviando && <Loader2 size={14} className="animate-spin" />}
                  {enviando ? 'A enviar…' : 'Pedir Emissão'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
