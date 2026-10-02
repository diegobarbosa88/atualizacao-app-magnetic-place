import React, { useCallback, useEffect, useState } from 'react';
import { Nfc, Plus, RefreshCw, KeyRound, Power, UserPlus, X, Trash2, Ban, CheckCircle2 } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { authFetch } from '../../../utils/authFetch';

// Piloto do terminal de ponto NFC — gestão de terminais (dispositivos fixos
// na obra) e de cartões (um por trabalhador). Os dados vêm da API
// (ponto-terminais-listar), nunca da anon key: as tabelas têm RLS sem
// policies e os tokens/códigos nunca saem do servidor em claro, exceto o
// código de ativação no momento em que é gerado (mostrado uma única vez).

const ROTULO_TIPO = { entrada: 'Entrada', inicio_pausa: 'Início pausa', fim_pausa: 'Fim pausa', saida: 'Saída' };
const ROTULO_RESULTADO = {
  ok: { label: 'Registado', cls: 'text-emerald-700' },
  associado: { label: 'Cartão associado', cls: 'text-emerald-700' },
  repetido: { label: 'Repetido (ignorado)', cls: 'text-slate-500' },
  cartao_desconhecido: { label: 'Cartão desconhecido', cls: 'text-amber-700' },
  cartao_bloqueado: { label: 'Cartão bloqueado', cls: 'text-rose-700' },
  nao_afeto: { label: 'Não afeto ao cliente', cls: 'text-rose-700' },
  transicao_invalida: { label: 'Ação inválida', cls: 'text-amber-700' },
};

function tempoRelativo(iso) {
  if (!iso) return 'nunca';
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `há ${h} h`;
  return new Date(iso).toLocaleDateString('pt-PT');
}

async function post(acao, body) {
  const resp = await authFetch(`/api/ponto/${acao}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || 'Erro inesperado.');
  return data;
}

export default function TerminaisNfcPanel() {
  const { clients, workers } = useApp();
  const [dados, setDados] = useState({ terminais: [], cartoes: [], picagens: [] });
  const [aCarregar, setACarregar] = useState(true);
  const [erro, setErro] = useState(null);
  const [novo, setNovo] = useState({ clientId: '', nome: '' });
  const [codigoMostrado, setCodigoMostrado] = useState(null); // { terminalNome, codigo }
  const [associarSel, setAssociarSel] = useState({}); // terminalId -> workerId

  const nomeWorker = (id) => workers.find((w) => String(w.id) === String(id))?.name || id || '—';
  const nomeCliente = (id) => clients.find((c) => String(c.id) === String(id))?.name || id;

  const carregar = useCallback(async () => {
    try {
      const resp = await authFetch('/api/ponto/terminais-listar');
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || 'Erro ao carregar terminais.');
      setDados(data);
      setErro(null);
    } catch (e) {
      setErro(e.message);
    } finally {
      setACarregar(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  // Enquanto houver uma associação de cartão pendente, atualiza mais vezes
  // para mostrar logo o cartão novo quando for lido no terminal.
  const haAssociacao = dados.terminais.some((t) => t.associar_worker_id && new Date(t.associar_expira_em) > new Date());
  useEffect(() => {
    const t = setInterval(carregar, haAssociacao ? 3000 : 30000);
    return () => clearInterval(t);
  }, [carregar, haAssociacao]);

  const acao = async (fn) => {
    try {
      setErro(null);
      await fn();
      await carregar();
    } catch (e) {
      setErro(e.message);
    }
  };

  const criarTerminal = () => acao(async () => {
    if (!novo.clientId || !novo.nome.trim()) throw new Error('Escolhe o cliente e dá um nome ao terminal.');
    const r = await post('terminal-criar', novo);
    setCodigoMostrado({ terminalNome: novo.nome.trim(), codigo: r.codigo });
    setNovo({ clientId: '', nome: '' });
  });

  const novoCodigo = (t) => acao(async () => {
    if (t.ativado && !window.confirm(`Gerar um código novo desliga o dispositivo atual de "${t.nome}" até ser ativado de novo. Continuar?`)) return;
    const r = await post('terminal-codigo', { terminalId: t.id });
    setCodigoMostrado({ terminalNome: t.nome, codigo: r.codigo });
  });

  const urlTerminal = `${window.location.origin}/kiosk/terminal`;

  return (
    <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden mb-6">
      <div className="px-4 py-3 border-b border-slate-50 flex items-center justify-between gap-2">
        <p className="text-xs font-black uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
          <Nfc size={14} /> Terminais NFC <span className="font-bold text-amber-700">(piloto)</span>
        </p>
        <button onClick={carregar} className="p-1.5 rounded-lg hover:bg-slate-50 text-slate-500" aria-label="Atualizar">
          <RefreshCw size={14} className={aCarregar ? 'animate-spin' : ''} />
        </button>
      </div>

      {erro && <p className="mx-4 mt-3 px-3 py-2 rounded-lg bg-rose-50 text-rose-700 text-xs font-bold">{erro}</p>}

      {codigoMostrado && (
        <div className="mx-4 mt-3 p-3 rounded-xl border border-amber-300 bg-amber-50">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs text-amber-800 font-bold">Código de ativação — {codigoMostrado.terminalNome}</p>
              <p className="text-3xl font-mono font-black tracking-widest text-slate-800 my-1">{codigoMostrado.codigo}</p>
              <p className="text-xs text-amber-800">
                Válido 10 minutos e só é mostrado agora. No dispositivo, abre <span className="font-mono font-bold">{urlTerminal}</span> no Chrome e introduz o código.
              </p>
            </div>
            <button onClick={() => setCodigoMostrado(null)} className="p-1 text-amber-800" aria-label="Fechar"><X size={16} /></button>
          </div>
        </div>
      )}

      <div className="px-4 py-3 flex flex-wrap items-center gap-2 border-b border-slate-50">
        <select
          value={novo.clientId}
          onChange={(e) => setNovo((n) => ({ ...n, clientId: e.target.value }))}
          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white"
        >
          <option value="">Cliente…</option>
          {(clients || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input
          value={novo.nome}
          onChange={(e) => setNovo((n) => ({ ...n, nome: e.target.value }))}
          placeholder="Nome do terminal (ex.: Portão norte)"
          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 flex-1 min-w-[180px]"
        />
        <button onClick={criarTerminal} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--navy-solid)] text-white text-xs font-bold">
          <Plus size={13} /> Novo terminal
        </button>
      </div>

      <div className="divide-y divide-slate-50">
        {dados.terminais.length === 0 && !aCarregar && (
          <p className="px-4 py-5 text-sm text-slate-400 text-center">Ainda não há terminais. Cria o primeiro acima.</p>
        )}
        {dados.terminais.map((t) => {
          const associacaoAtiva = t.associar_worker_id && new Date(t.associar_expira_em) > new Date();
          const estadoLabel = !t.ativo ? 'Desativado' : t.ativado ? `Ativo · último contacto ${tempoRelativo(t.ultimo_contacto)}` : t.codigoPendente ? 'À espera de ativação' : 'Por ativar — gera um código';
          return (
            <div key={t.id} className="px-4 py-3 space-y-2">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-bold text-slate-700">{t.nome} <span className="text-slate-400 font-normal">· {nomeCliente(t.client_id)}</span></p>
                  <p className={`text-xs ${!t.ativo ? 'text-rose-600' : t.ativado ? 'text-emerald-700' : 'text-amber-700'}`}>{estadoLabel}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => novoCodigo(t)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 text-slate-600 text-xs font-bold hover:bg-slate-100">
                    <KeyRound size={13} /> {t.ativado ? 'Reativar' : 'Gerar código'}
                  </button>
                  <button
                    onClick={() => acao(() => post('terminal-ativo', { terminalId: t.id, ativo: !t.ativo }))}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${t.ativo ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-700'}`}
                  >
                    <Power size={13} /> {t.ativo ? 'Desativar' : 'Ativar'}
                  </button>
                </div>
              </div>

              {t.ativo && t.ativado && (
                associacaoAtiva ? (
                  <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-amber-50 text-amber-800 text-xs">
                    <span>A aguardar o cartão de <b>{nomeWorker(t.associar_worker_id)}</b> neste terminal (2 min)…</span>
                    <button onClick={() => acao(() => post('cartao-associar', { terminalId: t.id, workerId: null }))} className="font-bold underline">Cancelar</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <select
                      value={associarSel[t.id] || ''}
                      onChange={(e) => setAssociarSel((s) => ({ ...s, [t.id]: e.target.value }))}
                      className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white"
                    >
                      <option value="">Associar cartão a…</option>
                      {(workers || []).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                    <button
                      disabled={!associarSel[t.id]}
                      onClick={() => acao(() => post('cartao-associar', { terminalId: t.id, workerId: associarSel[t.id] }))}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--navy-solid)] text-white text-xs font-bold disabled:opacity-40"
                    >
                      <UserPlus size={13} /> Ler cartão no terminal
                    </button>
                  </div>
                )
              )}
            </div>
          );
        })}
      </div>

      <div className="px-4 py-3 border-t border-slate-100">
        <p className="text-xs font-black uppercase tracking-wide text-slate-500 mb-2">Cartões ({dados.cartoes.length})</p>
        {dados.cartoes.length === 0 ? (
          <p className="text-xs text-slate-400">Sem cartões. Usa "Associar cartão a…" num terminal ativo e passa o cartão novo nele.</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {dados.cartoes.map((c) => (
              <div key={c.uid} className="py-2 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-slate-700">{nomeWorker(c.worker_id)}</p>
                  <p className="text-xs text-slate-400 font-mono">…{c.uid.slice(-6)} · {c.ativo ? 'ativo' : 'bloqueado'}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => acao(() => post('cartao-atualizar', { uid: c.uid, ativo: !c.ativo }))}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold ${c.ativo ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}
                  >
                    {c.ativo ? <><Ban size={12} /> Bloquear</> : <><CheckCircle2 size={12} /> Desbloquear</>}
                  </button>
                  <button
                    onClick={() => window.confirm(`Remover o cartão de ${nomeWorker(c.worker_id)}?`) && acao(() => post('cartao-atualizar', { uid: c.uid, remover: true }))}
                    className="p-1.5 rounded-lg bg-rose-50 text-rose-600"
                    aria-label="Remover cartão"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t border-slate-100">
        <p className="text-xs font-black uppercase tracking-wide text-slate-500 mb-2">Últimos toques nos terminais</p>
        {dados.picagens.length === 0 ? (
          <p className="text-xs text-slate-400">Ainda sem toques.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-400 uppercase text-[10px] tracking-wide">
                  <th className="py-1.5 pr-3">Quando</th>
                  <th className="py-1.5 pr-3">Terminal</th>
                  <th className="py-1.5 pr-3">Trabalhador</th>
                  <th className="py-1.5 pr-3">Ação</th>
                  <th className="py-1.5">Resultado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {dados.picagens.map((p) => {
                  const r = ROTULO_RESULTADO[p.resultado] || { label: p.resultado, cls: 'text-slate-500' };
                  return (
                    <tr key={p.id}>
                      <td className="py-1.5 pr-3 text-slate-500 whitespace-nowrap">{new Date(p.criado_em).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="py-1.5 pr-3 text-slate-500">{dados.terminais.find((t) => t.id === p.terminal_id)?.nome || '—'}</td>
                      <td className="py-1.5 pr-3 font-bold text-slate-700">{p.worker_id ? nomeWorker(p.worker_id) : <span className="font-mono font-normal text-slate-400">…{p.uid.slice(-6)}</span>}</td>
                      <td className="py-1.5 pr-3 text-slate-500">{ROTULO_TIPO[p.tipo] || '—'}</td>
                      <td className={`py-1.5 font-bold ${r.cls}`}>{r.label}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
