import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Search, Send, MessageSquareText } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { authFetch } from '../../utils/authFetch';

// Aba de WhatsApp dentro do admin — mesmo número "Trabalhador Virtual" já
// usado pelo agente (repo conselheiro), para o Diego falar diretamente com
// trabalhadores individuais. Ver
// supabase/migrations/20260829_worker_whatsapp_messages.sql para o desenho
// completo (as respostas dos trabalhadores chegam por um 3º ramo em
// conselheiro/api/whatsapp/webhook.js, não por este ecrã).
//
// Aparência deliberadamente distinta do resto do admin (cores/tipografia
// do próprio WhatsApp, não os tokens FT/SCALE) — pedido explícito do Diego:
// "aba com aparência do próprio WhatsApp".
const CONTATO_BOT = { worker_id: '__bot__', nome: 'Trabalhador Virtual', tel: null };

function formatarHora(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
}

function iniciais(nome) {
  return (nome || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase()).join('');
}

// Corta a pré-visualização da última mensagem para caber numa linha —
// mensagens longas (ex. o menu do bot) não devem esticar a lista.
function resumirTexto(texto, max = 42) {
  if (!texto) return '';
  const plano = texto.replace(/\s+/g, ' ').trim();
  return plano.length > max ? `${plano.slice(0, max - 1)}…` : plano;
}

export default function WhatsAppInbox() {
  const { workers, supabase } = useApp();
  const [contatoAtivo, setContatoAtivo] = useState(CONTATO_BOT);
  const [busca, setBusca] = useState('');
  const [mensagens, setMensagens] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  // Última mensagem de cada trabalhador, para a pré-visualização na lista
  // de contactos — worker_id -> { texto, direcao, criado_em }.
  const [resumos, setResumos] = useState({});
  const fimRef = useRef(null);

  // Carrega os resumos uma vez ao abrir a aba.
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const r = await authFetch('/api/whatsapp?action=listar-conversas');
        const json = await r.json();
        if (!r.ok || cancelado) return;
        const mapa = {};
        for (const c of json.conversas || []) {
          mapa[c.worker_id] = { texto: c.ultima_mensagem, direcao: c.ultima_direcao, criado_em: c.ultima_em };
        }
        setResumos(mapa);
      } catch {
        // silencioso -- a lista só fica sem pré-visualização, não é crítico
      }
    })();
    return () => { cancelado = true; };
  }, []);

  // Mantém os resumos atualizados para QUALQUER trabalhador (não só a
  // conversa aberta), para a lista de contactos nunca ficar desatualizada.
  useEffect(() => {
    if (!supabase) return;
    const canal = supabase
      .channel('whatsapp-resumos')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'worker_whatsapp_messages' }, (payload) => {
        const m = payload.new;
        setResumos(prev => ({ ...prev, [m.worker_id]: { texto: m.texto, direcao: m.direcao, criado_em: m.criado_em } }));
      })
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [supabase]);

  const contatos = useMemo(() => {
    const trabalhadores = (workers || [])
      .filter(w => w.is_active && w.tel)
      .map(w => ({ worker_id: w.id, nome: w.name, tel: w.tel, resumo: resumos[w.id] || null }))
      .sort((a, b) => {
        // Quem tem conversa mais recente sobe ao topo; sem conversa nenhuma
        // fica por ordem alfabética no fim.
        if (a.resumo && b.resumo) return new Date(b.resumo.criado_em) - new Date(a.resumo.criado_em);
        if (a.resumo) return -1;
        if (b.resumo) return 1;
        return a.nome.localeCompare(b.nome);
      });
    const filtrados = busca.trim()
      ? trabalhadores.filter(t => t.nome.toLowerCase().includes(busca.trim().toLowerCase()))
      : trabalhadores;
    return [CONTATO_BOT, ...filtrados];
  }, [workers, busca, resumos]);

  // Carrega o histórico ao trocar de contacto.
  useEffect(() => {
    let cancelado = false;
    setErro('');
    setMensagens([]);
    setCarregando(true);

    (async () => {
      try {
        if (contatoAtivo.worker_id === '__bot__') {
          const r = await authFetch('/api/whatsapp?action=historico-bot');
          const json = await r.json();
          if (!r.ok) throw new Error(json.error || `HTTP ${r.status}`);
          if (!cancelado) setMensagens(json.mensagens || []);
        } else {
          const r = await authFetch(`/api/whatsapp?action=historico&worker_id=${encodeURIComponent(contatoAtivo.worker_id)}`);
          const json = await r.json();
          if (!r.ok) throw new Error(json.error || `HTTP ${r.status}`);
          if (!cancelado) setMensagens(json.mensagens || []);
        }
      } catch (e) {
        if (!cancelado) setErro(e.message);
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();

    return () => { cancelado = true; };
  }, [contatoAtivo]);

  // Realtime — só faz sentido para conversas com trabalhadores (a do bot
  // não é gravada nesta BD, é lida diretamente do conselheiro).
  useEffect(() => {
    if (!supabase || contatoAtivo.worker_id === '__bot__') return;
    const canal = supabase
      .channel(`whatsapp-worker-${contatoAtivo.worker_id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'worker_whatsapp_messages',
        filter: `worker_id=eq.${contatoAtivo.worker_id}`,
      }, (payload) => {
        setMensagens(prev => prev.some(m => m.id === payload.new.id) ? prev : [...prev, payload.new]);
      })
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [supabase, contatoAtivo]);

  // A conversa do bot vive na BD do conselheiro (projeto Supabase
  // separado) -- sem ligação Realtime direta do browser a esse projeto,
  // por isso faz polling enquanto este contacto estiver ativo, em vez de
  // só carregar uma vez ao entrar (que fazia parecer "não recebo nada").
  useEffect(() => {
    if (contatoAtivo.worker_id !== '__bot__') return;
    const intervalo = setInterval(async () => {
      try {
        const r = await authFetch('/api/whatsapp?action=historico-bot');
        const json = await r.json();
        if (r.ok) setMensagens(json.mensagens || []);
      } catch {
        // silencioso -- o proximo ciclo tenta de novo, nao vale a pena
        // mostrar erro por uma falha isolada de polling
      }
    }, 4000);
    return () => clearInterval(intervalo);
  }, [contatoAtivo]);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens]);

  async function enviar() {
    const corpo = texto.trim();
    if (!corpo || enviando || contatoAtivo.worker_id === '__bot__') return;
    setEnviando(true);
    setErro('');
    try {
      const r = await authFetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'enviar', worker_id: contatoAtivo.worker_id, texto: corpo }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || `HTTP ${r.status}`);
      // Não adiciona localmente aqui — o Realtime (INSERT em
      // worker_whatsapp_messages) já trata disso com o id real da BD.
      // Adicionar os dois causava duplicado (ids diferentes, o dedupe do
      // Realtime não reconhecia como a mesma mensagem).
      setTexto('');
    } catch (e) {
      setErro(e.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-140px)] rounded-2xl overflow-hidden border border-black/10 shadow-sm">
      {/* Lista de contactos */}
      <div className="w-[320px] shrink-0 flex flex-col" style={{ backgroundColor: '#ffffff', borderRight: '1px solid #e9edef' }}>
        <div className="px-4 py-4" style={{ backgroundColor: '#f0f2f5' }}>
          <p className="font-bold text-[15px]" style={{ color: '#111b21' }}>WhatsApp — Trabalhador Virtual</p>
        </div>
        <div className="p-2" style={{ backgroundColor: '#ffffff' }}>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#f0f2f5' }}>
            <Search size={16} color="#54656f" />
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Procurar trabalhador"
              className="bg-transparent outline-none text-sm flex-1"
              style={{ color: '#111b21' }}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {contatos.map(c => {
            const ativo = c.worker_id === contatoAtivo.worker_id;
            const isBot = c.worker_id === '__bot__';
            return (
              <button
                key={c.worker_id}
                onClick={() => setContatoAtivo(c)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                style={{ backgroundColor: ativo ? '#f0f2f5' : 'transparent' }}
              >
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-white font-bold text-sm"
                  style={{ backgroundColor: isBot ? '#00a884' : '#8696a0' }}
                >
                  {isBot ? <Bot size={20} /> : iniciais(c.nome)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[15px] truncate" style={{ color: '#111b21' }}>{c.nome}</p>
                    {c.resumo?.criado_em && (
                      <span className="text-[11px] shrink-0" style={{ color: '#667781' }}>{formatarHora(c.resumo.criado_em)}</span>
                    )}
                  </div>
                  {isBot ? (
                    <p className="text-xs truncate" style={{ color: '#667781' }}>Conversa com o Diego</p>
                  ) : c.resumo ? (
                    <p className="text-xs truncate" style={{ color: '#667781' }}>
                      {c.resumo.direcao === 'enviada' && <span style={{ color: '#00a884' }}>Tu: </span>}
                      {resumirTexto(c.resumo.texto)}
                    </p>
                  ) : (
                    <p className="text-xs truncate" style={{ color: '#8696a0' }}>Sem mensagens ainda</p>
                  )}
                </div>
              </button>
            );
          })}
          {contatos.length === 1 && (
            <p className="px-4 py-6 text-sm text-center" style={{ color: '#667781' }}>
              Nenhum trabalhador ativo com telemóvel registado.
            </p>
          )}
        </div>
      </div>

      {/* Conversa */}
      <div className="flex-1 flex flex-col" style={{ backgroundColor: '#efeae2' }}>
        <div className="flex items-center gap-3 px-5 py-3" style={{ backgroundColor: '#f0f2f5', borderBottom: '1px solid #e9edef' }}>
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
            style={{ backgroundColor: contatoAtivo.worker_id === '__bot__' ? '#00a884' : '#8696a0' }}
          >
            {contatoAtivo.worker_id === '__bot__' ? <Bot size={18} /> : iniciais(contatoAtivo.nome)}
          </div>
          <div>
            <p className="font-semibold text-[15px]" style={{ color: '#111b21' }}>{contatoAtivo.nome}</p>
            {contatoAtivo.tel && <p className="text-xs" style={{ color: '#667781' }}>{contatoAtivo.tel}</p>}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-1.5">
          {carregando && <p className="text-center text-sm" style={{ color: '#667781' }}>A carregar…</p>}
          {erro && <p className="text-center text-sm text-rose-600 bg-rose-50 rounded-lg py-2 px-3">{erro}</p>}
          {!carregando && !erro && mensagens.length === 0 && (
            <div className="h-full flex items-center justify-center">
              <p className="text-sm" style={{ color: '#667781' }}>Sem mensagens ainda.</p>
            </div>
          )}
          {mensagens.map(m => {
            const enviada = m.direcao === 'enviada';
            return (
              <div key={m.id} className={`flex ${enviada ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="max-w-[65%] rounded-lg px-3 py-2 shadow-sm"
                  style={{ backgroundColor: enviada ? '#d9fdd3' : '#ffffff' }}
                >
                  <p className="text-[14.5px] whitespace-pre-wrap break-words" style={{ color: '#111b21' }}>{m.texto}</p>
                  <p className="text-right text-[11px] mt-0.5" style={{ color: '#667781' }}>{formatarHora(m.criado_em)}</p>
                </div>
              </div>
            );
          })}
          <div ref={fimRef} />
        </div>

        {contatoAtivo.worker_id === '__bot__' ? (
          <div className="px-5 py-3 text-center text-xs" style={{ backgroundColor: '#f0f2f5', color: '#667781' }}>
            <MessageSquareText size={14} className="inline mr-1.5 -mt-0.5" />
            Só leitura — falas com o Trabalhador Virtual no teu próprio WhatsApp.
          </div>
        ) : (
          <div className="flex items-center gap-2 px-4 py-3" style={{ backgroundColor: '#f0f2f5' }}>
            <input
              value={texto}
              onChange={e => setTexto(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }}
              placeholder="Escreve uma mensagem"
              className="flex-1 rounded-lg px-4 py-2.5 text-sm outline-none"
              style={{ backgroundColor: '#ffffff', color: '#111b21' }}
              disabled={enviando}
            />
            <button
              onClick={enviar}
              disabled={enviando || !texto.trim()}
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 disabled:opacity-40 transition-opacity"
              style={{ backgroundColor: '#00a884' }}
            >
              <Send size={17} color="#ffffff" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
