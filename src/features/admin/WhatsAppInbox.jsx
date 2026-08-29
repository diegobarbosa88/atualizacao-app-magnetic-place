import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Search, Send, MessageSquareText, Users, X, Check, Paperclip } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { authFetch } from '../../utils/authFetch';

// Mesmo limite do backend (api/salarios/exportar-sepa.js) -- verificado
// aqui também para dar feedback imediato sem gastar um pedido.
const LIMITE_ANEXO_BYTES = 3 * 1024 * 1024;

// Mensagens curtas para inserir no campo de texto com um toque, em vez de
// escrever sempre do zero as perguntas mais comuns. Só sugestões — o Diego
// pode editar antes de enviar, nunca envia sozinho.
const TEMPLATES_RAPIDOS = [
  'Podes confirmar a tua disponibilidade para amanhã?',
  'Falta um documento teu — envia assim que puderes, obrigado.',
  'Recebido, obrigado!',
  'Vemo-nos amanhã às 08:00.',
];

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
  const [enviandoAnexo, setEnviandoAnexo] = useState(false);
  const [erro, setErro] = useState('');
  // Última mensagem de cada trabalhador, para a pré-visualização na lista
  // de contactos — worker_id -> { texto, direcao, criado_em, nao_lidas }.
  const [resumos, setResumos] = useState({});
  // Envio em massa — modo de seleção múltipla na lista de contactos.
  const [modoSelecao, setModoSelecao] = useState(false);
  const [selecionados, setSelecionados] = useState(new Set());
  const [textoLote, setTextoLote] = useState('');
  const [confirmandoLote, setConfirmandoLote] = useState(false);
  const [enviandoLote, setEnviandoLote] = useState(false);
  const [resultadoLote, setResultadoLote] = useState('');
  const fimRef = useRef(null);
  const anexoInputRef = useRef(null);
  // O canal Realtime dos resumos só é criado uma vez (depende só de
  // `supabase`) — usa um ref para saber qual é o contacto ativo NO
  // MOMENTO de cada evento, sem recriar o canal a cada troca de contacto.
  const contatoAtivoRef = useRef(contatoAtivo);
  useEffect(() => { contatoAtivoRef.current = contatoAtivo; }, [contatoAtivo]);

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
          mapa[c.worker_id] = { texto: c.ultima_mensagem, direcao: c.ultima_direcao, criado_em: c.ultima_em, nao_lidas: c.nao_lidas || 0 };
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
  // Mensagens recebidas somam ao contador de não lidas, a não ser que a
  // conversa desse trabalhador já esteja aberta neste preciso momento.
  useEffect(() => {
    if (!supabase) return;
    const canal = supabase
      .channel('whatsapp-resumos')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'worker_whatsapp_messages' }, (payload) => {
        const m = payload.new;
        setResumos(prev => {
          const jaAberta = contatoAtivoRef.current?.worker_id === m.worker_id;
          const anterior = prev[m.worker_id];
          const naoLidas = m.direcao === 'recebida' && !jaAberta ? (anterior?.nao_lidas || 0) + 1 : (anterior?.nao_lidas || 0);
          return { ...prev, [m.worker_id]: { texto: m.texto, direcao: m.direcao, criado_em: m.criado_em, nao_lidas: naoLidas } };
        });
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

          // Marca como lida ao abrir a conversa -- some o indicador de não
          // lidas dessa conversa na lista de contactos.
          setResumos(prev => (prev[contatoAtivo.worker_id]?.nao_lidas
            ? { ...prev, [contatoAtivo.worker_id]: { ...prev[contatoAtivo.worker_id], nao_lidas: 0 } }
            : prev));
          authFetch('/api/whatsapp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'marcar-lida', worker_id: contatoAtivo.worker_id }),
          }).catch(() => {});
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

  function lerFicheiroComoBase64(ficheiro) {
    return new Promise((resolve, reject) => {
      const leitor = new FileReader();
      leitor.onload = () => {
        // FileReader.readAsDataURL devolve "data:<mime>;base64,<dados>" --
        // só a parte depois da vírgula interessa ao backend.
        const base64 = String(leitor.result).split(',')[1] || '';
        resolve(base64);
      };
      leitor.onerror = () => reject(new Error('Não consegui ler o ficheiro.'));
      leitor.readAsDataURL(ficheiro);
    });
  }

  async function enviarAnexo(ficheiro) {
    if (!ficheiro || enviandoAnexo || contatoAtivo.worker_id === '__bot__') return;
    if (ficheiro.size > LIMITE_ANEXO_BYTES) {
      setErro(`"${ficheiro.name}" é maior que 3MB — não dá para enviar.`);
      return;
    }
    setEnviandoAnexo(true);
    setErro('');
    try {
      const dataBase64 = await lerFicheiroComoBase64(ficheiro);
      const r = await authFetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'enviar-anexo',
          worker_id: contatoAtivo.worker_id,
          filename: ficheiro.name,
          mimetype: ficheiro.type || 'application/octet-stream',
          data_base64: dataBase64,
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || `HTTP ${r.status}`);
      // Idem enviar() -- o Realtime trata de mostrar a mensagem.
    } catch (e) {
      setErro(e.message);
    } finally {
      setEnviandoAnexo(false);
    }
  }

  function alternarSelecionado(workerId) {
    setSelecionados(prev => {
      const novo = new Set(prev);
      if (novo.has(workerId)) novo.delete(workerId); else novo.add(workerId);
      return novo;
    });
  }

  function sairDoModoSelecao() {
    setModoSelecao(false);
    setSelecionados(new Set());
    setTextoLote('');
    setConfirmandoLote(false);
    setResultadoLote('');
  }

  async function enviarLote() {
    const corpo = textoLote.trim();
    if (!corpo || selecionados.size === 0 || enviandoLote) return;
    setEnviandoLote(true);
    setResultadoLote('');
    try {
      const r = await authFetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'enviar-lote', worker_ids: [...selecionados], texto: corpo }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || `HTTP ${r.status}`);
      setResultadoLote(json.mensagem);
      setConfirmandoLote(false);
      setTextoLote('');
      setSelecionados(new Set());
    } catch (e) {
      setResultadoLote(`Erro: ${e.message}`);
    } finally {
      setEnviandoLote(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-140px)] rounded-2xl overflow-hidden border border-black/10 shadow-sm">
      {/* Lista de contactos */}
      <div className="w-[320px] shrink-0 flex flex-col" style={{ backgroundColor: '#ffffff', borderRight: '1px solid #e9edef' }}>
        <div className="px-4 py-4 flex items-center justify-between gap-2" style={{ backgroundColor: '#f0f2f5' }}>
          <p className="font-bold text-[15px]" style={{ color: '#111b21' }}>WhatsApp — Trabalhador Virtual</p>
          <button
            onClick={() => (modoSelecao ? sairDoModoSelecao() : setModoSelecao(true))}
            title="Enviar a vários trabalhadores"
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors"
            style={{ backgroundColor: modoSelecao ? '#00a884' : 'transparent', color: modoSelecao ? '#ffffff' : '#54656f' }}
          >
            {modoSelecao ? <X size={16} /> : <Users size={16} />}
          </button>
        </div>
        {!modoSelecao && (
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
        )}
        {modoSelecao && (
          <p className="px-4 py-2 text-xs" style={{ backgroundColor: '#ffffff', color: '#667781' }}>
            Toca nos trabalhadores para escolher a quem mandar a mesma mensagem.
          </p>
        )}
        <div className="flex-1 overflow-y-auto">
          {contatos.map(c => {
            const ativo = c.worker_id === contatoAtivo.worker_id;
            const isBot = c.worker_id === '__bot__';
            const naoLidas = c.resumo?.nao_lidas || 0;
            const selecionado = selecionados.has(c.worker_id);
            if (modoSelecao && isBot) return null;
            return (
              <button
                key={c.worker_id}
                onClick={() => (modoSelecao ? alternarSelecionado(c.worker_id) : setContatoAtivo(c))}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                style={{ backgroundColor: selecionado ? '#e7f8f3' : ativo ? '#f0f2f5' : 'transparent' }}
              >
                {modoSelecao && (
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 border-2"
                    style={{ borderColor: selecionado ? '#00a884' : '#c4c9cd', backgroundColor: selecionado ? '#00a884' : 'transparent' }}
                  >
                    {selecionado && <Check size={12} color="#ffffff" />}
                  </div>
                )}
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
                      <span className="text-[11px] shrink-0" style={{ color: naoLidas > 0 ? '#00a884' : '#667781', fontWeight: naoLidas > 0 ? 700 : 400 }}>
                        {formatarHora(c.resumo.criado_em)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    {isBot ? (
                      <p className="text-xs truncate" style={{ color: '#667781' }}>Conversa com o Diego</p>
                    ) : c.resumo ? (
                      <p className="text-xs truncate" style={{ color: naoLidas > 0 ? '#111b21' : '#667781', fontWeight: naoLidas > 0 ? 600 : 400 }}>
                        {c.resumo.direcao === 'enviada' && <span style={{ color: '#00a884' }}>Tu: </span>}
                        {resumirTexto(c.resumo.texto)}
                      </p>
                    ) : (
                      <p className="text-xs truncate" style={{ color: '#8696a0' }}>Sem mensagens ainda</p>
                    )}
                    {naoLidas > 0 && (
                      <span
                        className="text-[11px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center shrink-0"
                        style={{ backgroundColor: '#00a884', color: '#ffffff' }}
                      >
                        {naoLidas}
                      </span>
                    )}
                  </div>
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

        {modoSelecao && (
          <div className="p-3 space-y-2" style={{ backgroundColor: '#f0f2f5', borderTop: '1px solid #e9edef' }}>
            {resultadoLote && (
              <p className="text-xs rounded-lg px-3 py-2" style={{ backgroundColor: '#ffffff', color: '#111b21' }}>{resultadoLote}</p>
            )}
            {!confirmandoLote ? (
              <>
                <textarea
                  value={textoLote}
                  onChange={e => setTextoLote(e.target.value)}
                  placeholder="Mensagem para todos os selecionados…"
                  rows={2}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
                  style={{ backgroundColor: '#ffffff', color: '#111b21' }}
                />
                <button
                  onClick={() => setConfirmandoLote(true)}
                  disabled={selecionados.size === 0 || !textoLote.trim()}
                  className="w-full py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40 transition-opacity"
                  style={{ backgroundColor: '#00a884' }}
                >
                  {selecionados.size === 0 ? 'Escolhe pelo menos 1 trabalhador' : `Continuar (${selecionados.size} selecionados)`}
                </button>
              </>
            ) : (
              <>
                <p className="text-xs" style={{ color: '#111b21' }}>
                  Vais enviar a <strong>{selecionados.size} trabalhadores</strong>:
                  <br />
                  {[...selecionados].map(id => contatos.find(c => c.worker_id === id)?.nome).filter(Boolean).join(', ')}
                </p>
                <p className="text-xs rounded-lg px-3 py-2 whitespace-pre-wrap" style={{ backgroundColor: '#ffffff', color: '#111b21' }}>{textoLote}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmandoLote(false)}
                    disabled={enviandoLote}
                    className="flex-1 py-2 rounded-lg text-sm font-semibold disabled:opacity-40"
                    style={{ backgroundColor: '#ffffff', color: '#111b21' }}
                  >
                    Voltar
                  </button>
                  <button
                    onClick={enviarLote}
                    disabled={enviandoLote}
                    className="flex-1 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40"
                    style={{ backgroundColor: '#00a884' }}
                  >
                    {enviandoLote ? 'A enviar…' : 'Confirmar envio'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
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
          <div style={{ backgroundColor: '#f0f2f5' }}>
            <div className="flex gap-2 px-4 pt-2.5 overflow-x-auto">
              {TEMPLATES_RAPIDOS.map(t => (
                <button
                  key={t}
                  onClick={() => setTexto(t)}
                  className="shrink-0 text-xs rounded-full px-3 py-1.5 whitespace-nowrap transition-colors"
                  style={{ backgroundColor: '#ffffff', color: '#00a884', border: '1px solid #00a884' }}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 px-4 py-3">
            <input
              ref={anexoInputRef}
              type="file"
              accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) enviarAnexo(f); }}
            />
            <button
              onClick={() => anexoInputRef.current?.click()}
              disabled={enviandoAnexo}
              title="Anexar ficheiro (imagem ou documento, máx. 3MB)"
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 disabled:opacity-40 transition-opacity"
              style={{ color: '#54656f' }}
            >
              <Paperclip size={19} />
            </button>
            <input
              value={texto}
              onChange={e => setTexto(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }}
              placeholder={enviandoAnexo ? 'A enviar anexo…' : 'Escreve uma mensagem'}
              className="flex-1 rounded-lg px-4 py-2.5 text-sm outline-none"
              style={{ backgroundColor: '#ffffff', color: '#111b21' }}
              disabled={enviando || enviandoAnexo}
            />
            <button
              onClick={enviar}
              disabled={enviando || enviandoAnexo || !texto.trim()}
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 disabled:opacity-40 transition-opacity"
              style={{ backgroundColor: '#00a884' }}
            >
              <Send size={17} color="#ffffff" />
            </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
