import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Search, Send, MessageSquareText, Users, X, Check, CheckCheck, Paperclip, MapPin, Contact, ListPlus, Reply, Smile, ArrowLeft, Plus, FileText, CornerUpLeft } from 'lucide-react';
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

// Espelha CONTATOS_UTEIS do backend (api/salarios/exportar-sepa.js) só para
// dar nome a mostrar -- o telefone real fica só do lado do servidor.
const CONTATOS_UTEIS_FRONT = [
  { id: 'mediador', nome: 'Mediador de Seguros' },
];

const EMOJIS_REACAO = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

// Legendas automáticas postas pelo backend (mensagemTrabalhador.js, no
// conselheiro) quando o trabalhador manda um anexo sem legenda -- não faz
// sentido repetir por baixo do próprio anexo já mostrado.
const LEGENDAS_AUTOMATICAS_ANEXO = new Set(['🖼️ Imagem', '🎤 Áudio', '🎥 Vídeo', '📎 Documento']);

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
  // Composer alternativo (barra de baixo) -- 'texto' é o normal, os outros
  // substituem a linha de texto por um mini-formulário próprio.
  const [modoComposer, setModoComposer] = useState('texto');
  const [enviandoExtra, setEnviandoExtra] = useState(false);
  const [respondendoA, setRespondendoA] = useState(null); // { id, texto, wamid }
  const [mostrarReacaoPara, setMostrarReacaoPara] = useState(null); // id da mensagem
  const [localNome, setLocalNome] = useState('');
  const [localEndereco, setLocalEndereco] = useState('');
  const [botoesCorpo, setBotoesCorpo] = useState('');
  const [botoesLista, setBotoesLista] = useState(['', '', '']);
  // Em ecrãs estreitos só cabe um painel de cada vez -- lista OU conversa,
  // nunca os dois lado a lado como no desktop. Começa na lista (como o
  // WhatsApp a sério); tocar num contacto passa para a conversa, o botão
  // de voltar regressa à lista. Em desktop (md:) esta flag é ignorada, os
  // dois painéis ficam sempre visíveis lado a lado.
  const [verConversaMobile, setVerConversaMobile] = useState(false);
  // Menu "+" (localização/contacto/botões) do compositor -- substitui a
  // fiada de ícones + a linha de texto extra que ficava apertada em ecrãs
  // estreitos por um único botão que abre um popup, como no WhatsApp real.
  const [mostrarMenuExtra, setMostrarMenuExtra] = useState(false);
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
    setModoComposer('texto');
    setRespondendoA(null);
    setMostrarReacaoPara(null);
    setMostrarMenuExtra(false);

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
        body: JSON.stringify({ action: 'enviar', worker_id: contatoAtivo.worker_id, texto: corpo, reply_to: respondendoA?.wamid || undefined }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || `HTTP ${r.status}`);
      // Não adiciona localmente aqui — o Realtime (INSERT em
      // worker_whatsapp_messages) já trata disso com o id real da BD.
      // Adicionar os dois causava duplicado (ids diferentes, o dedupe do
      // Realtime não reconhecia como a mesma mensagem).
      setTexto('');
      setRespondendoA(null);
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

  function enviarLocalizacao() {
    if (!navigator.geolocation) {
      setErro('Este navegador não suporta partilha de localização.');
      return;
    }
    setEnviandoExtra(true);
    setErro('');
    navigator.geolocation.getCurrentPosition(
      async (posicao) => {
        try {
          const r = await authFetch('/api/whatsapp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'enviar-localizacao',
              worker_id: contatoAtivo.worker_id,
              latitude: posicao.coords.latitude,
              longitude: posicao.coords.longitude,
              nome: localNome.trim() || undefined,
              endereco: localEndereco.trim() || undefined,
            }),
          });
          const json = await r.json();
          if (!r.ok) throw new Error(json.error || `HTTP ${r.status}`);
          setModoComposer('texto');
          setLocalNome('');
          setLocalEndereco('');
        } catch (e) {
          setErro(e.message);
        } finally {
          setEnviandoExtra(false);
        }
      },
      (erroGeo) => {
        setErro(`Não consegui obter a localização: ${erroGeo.message}`);
        setEnviandoExtra(false);
      },
    );
  }

  async function enviarContacto(contatoId) {
    if (enviandoExtra) return;
    setEnviandoExtra(true);
    setErro('');
    try {
      const r = await authFetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'enviar-contacto', worker_id: contatoAtivo.worker_id, contato_id: contatoId }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || `HTTP ${r.status}`);
      setModoComposer('texto');
    } catch (e) {
      setErro(e.message);
    } finally {
      setEnviandoExtra(false);
    }
  }

  async function enviarBotoesCompostos() {
    const corpo = botoesCorpo.trim();
    const lista = botoesLista.map(b => b.trim()).filter(Boolean).slice(0, 3);
    if (!corpo || lista.length === 0 || enviandoExtra) return;
    setEnviandoExtra(true);
    setErro('');
    try {
      const r = await authFetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'enviar-botoes',
          worker_id: contatoAtivo.worker_id,
          corpo,
          botoes: lista.map((title, i) => ({ id: `btn_${i}`, title })),
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || `HTTP ${r.status}`);
      setModoComposer('texto');
      setBotoesCorpo('');
      setBotoesLista(['', '', '']);
    } catch (e) {
      setErro(e.message);
    } finally {
      setEnviandoExtra(false);
    }
  }

  // Reação é um extra -- falha silenciosa (não vale a pena bloquear a UI
  // por um emoji que não chegou).
  async function reagir(mensagem, emoji) {
    setMostrarReacaoPara(null);
    if (!mensagem.wamid || !contatoAtivo.tel) return;
    try {
      await authFetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'enviar-reacao', wamid: mensagem.wamid, to: contatoAtivo.tel, emoji }),
      });
    } catch {
      // silencioso, ver comentário acima
    }
  }

  return (
    <div className="flex h-[calc(100vh-140px)] rounded-2xl overflow-hidden border border-black/10 shadow-sm">
      {/* Lista de contactos -- em mobile só aparece quando não há conversa
          aberta; em desktop (md:) aparece sempre, lado a lado com a conversa. */}
      <div
        className={`${verConversaMobile ? 'hidden' : 'flex'} md:flex w-full md:w-[320px] shrink-0 flex-col min-w-0`}
        style={{ backgroundColor: '#ffffff', borderRight: '1px solid #e9edef' }}
      >
        <div className="px-3 sm:px-4 py-4 flex items-center justify-between gap-2" style={{ backgroundColor: '#f0f2f5' }}>
          <p className="font-bold text-[15px] truncate" style={{ color: '#111b21' }}>WhatsApp</p>
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
        <div className="flex-1 overflow-y-auto scroll-oculto">
          {contatos.map(c => {
            const ativo = c.worker_id === contatoAtivo.worker_id;
            const isBot = c.worker_id === '__bot__';
            const naoLidas = c.resumo?.nao_lidas || 0;
            const selecionado = selecionados.has(c.worker_id);
            if (modoSelecao && isBot) return null;
            return (
              <button
                key={c.worker_id}
                onClick={() => {
                  if (modoSelecao) { alternarSelecionado(c.worker_id); return; }
                  setContatoAtivo(c);
                  setVerConversaMobile(true);
                }}
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

      {/* Conversa -- em mobile só aparece depois de tocar num contacto. */}
      <div className={`${verConversaMobile ? 'flex' : 'hidden'} md:flex flex-1 flex-col min-w-0`} style={{ backgroundColor: '#efeae2' }}>
        <div className="flex items-center gap-3 px-3 sm:px-5 py-3" style={{ backgroundColor: '#f0f2f5', borderBottom: '1px solid #e9edef' }}>
          <button
            onClick={() => setVerConversaMobile(false)}
            className="md:hidden w-8 h-8 rounded-full flex items-center justify-center shrink-0 -ml-1"
            style={{ color: '#54656f' }}
          >
            <ArrowLeft size={20} />
          </button>
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
            style={{ backgroundColor: contatoAtivo.worker_id === '__bot__' ? '#00a884' : '#8696a0' }}
          >
            {contatoAtivo.worker_id === '__bot__' ? <Bot size={18} /> : iniciais(contatoAtivo.nome)}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-[15px] truncate" style={{ color: '#111b21' }}>{contatoAtivo.nome}</p>
            {contatoAtivo.tel && <p className="text-xs" style={{ color: '#667781' }}>{contatoAtivo.tel}</p>}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scroll-oculto relative z-0 px-3 sm:px-6 py-4 space-y-1.5">
          {/* Textura de fundo ao estilo do papel de parede do WhatsApp real
              (padrão repetido) -- com o logótipo e o carimbo da Magnetic em
              vez dos ícones do WhatsApp. Duas imagens, tamanhos de
              quadrícula diferentes (160px vs 130px) e desalinhadas de
              propósito (posições de início diferentes) para os dois
              padrões derivarem um do outro em vez de ficarem sobrepostos
              numa grelha única e óbvia -- mais parecido com a disposição
              orgânica dos ícones do WhatsApp. Preto e branco + opacidade
              baixa para ler como marca de água, não como imagem a competir
              com as mensagens. Atrás de tudo (z-index negativo) e sem
              interceptar cliques -- precisa que ESTE contentor tenha o seu
              próprio z-index (não só position:relative) para criar um novo
              contexto de empilhamento, senão o -1 escapa para trás de
              ancestrais muito mais acima (ex.: o cartão branco da página)
              e fica invisível. */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: 'url(/logo-magnetic.png)',
              backgroundSize: '160px 160px',
              backgroundRepeat: 'repeat',
              opacity: 0.05,
              filter: 'grayscale(1) contrast(1.3) brightness(0.55)',
              zIndex: -2,
            }}
          />
          {/* Duas camadas SEPARADAS (não duas imagens no mesmo
              background-image) de propósito -- com uma só camada, a
              primeira imagem (opaca onde não é transparente) tapava a
              segunda por trás sempre que os quadrados se sobrepunham.
              Como elemento próprio, cada uma continua semi-transparente
              mesmo por cima da outra. */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: 'url(/carimbo-magnetic-place.png)',
              backgroundSize: '130px 72px',
              backgroundPosition: '65px 40px',
              backgroundRepeat: 'repeat',
              opacity: 0.05,
              filter: 'grayscale(1) contrast(1.3) brightness(0.55)',
              zIndex: -1,
            }}
          />
          {carregando && <p className="text-center text-sm" style={{ color: '#667781' }}>A carregar…</p>}
          {erro && <p className="text-center text-sm text-rose-600 bg-rose-50 rounded-lg py-2 px-3 break-words">{erro}</p>}
          {!carregando && !erro && mensagens.length === 0 && (
            <div className="h-full flex items-center justify-center">
              <p className="text-sm" style={{ color: '#667781' }}>Sem mensagens ainda.</p>
            </div>
          )}
          {mensagens.map(m => {
            const enviada = m.direcao === 'enviada';
            // Responder/reagir só fazem sentido numa conversa com trabalhador
            // (a do bot é só leitura) e só a mensagens que já têm wamid (as
            // antigas, de antes desta funcionalidade, não têm).
            const podeAgir = contatoAtivo.worker_id !== '__bot__' && !!m.wamid;
            return (
              <div key={m.id} className={`flex items-center gap-1 group ${enviada ? 'justify-end' : 'justify-start'}`}>
                {!enviada && podeAgir && (
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setRespondendoA({ id: m.id, texto: m.texto, wamid: m.wamid })} title="Responder" className="w-6 h-6 rounded-full flex items-center justify-center" style={{ color: '#54656f' }}>
                      <Reply size={13} />
                    </button>
                    <button onClick={() => setMostrarReacaoPara(mostrarReacaoPara === m.id ? null : m.id)} title="Reagir" className="w-6 h-6 rounded-full flex items-center justify-center" style={{ color: '#54656f' }}>
                      <Smile size={13} />
                    </button>
                  </div>
                )}
                <div
                  className="max-w-[85%] sm:max-w-[65%] rounded-lg px-3 py-2 shadow-sm relative"
                  style={{ backgroundColor: enviada ? '#d9fdd3' : '#ffffff' }}
                >
                  {mostrarReacaoPara === m.id && (
                    <div
                      className="absolute -top-10 left-0 flex gap-1 rounded-full px-2 py-1.5 shadow-md z-10"
                      style={{ backgroundColor: '#ffffff', border: '1px solid #e9edef' }}
                    >
                      {EMOJIS_REACAO.map(e => (
                        <button key={e} onClick={() => reagir(m, e)} className="text-base leading-none hover:scale-125 transition-transform">
                          {e}
                        </button>
                      ))}
                    </div>
                  )}
                  {m.resposta_a_texto && (
                    <div
                      className="rounded mb-1 pl-2 pr-2 py-1 overflow-hidden"
                      style={{ backgroundColor: enviada ? '#c7f3bd' : '#f0f2f5', borderLeft: '3px solid #00a884' }}
                    >
                      <p className="text-xs truncate" style={{ color: '#00a884' }}>{resumirTexto(m.resposta_a_texto, 70)}</p>
                    </div>
                  )}
                  {m.anexo_url && m.anexo_tipo === 'image' && (
                    <a href={m.anexo_url} target="_blank" rel="noreferrer">
                      <img src={m.anexo_url} alt={m.anexo_nome || 'Imagem'} className="rounded-lg mb-1 max-w-full max-h-64 object-cover" />
                    </a>
                  )}
                  {m.anexo_url && m.anexo_tipo === 'video' && (
                    <video src={m.anexo_url} controls className="rounded-lg mb-1 max-w-full max-h-64" />
                  )}
                  {m.anexo_url && m.anexo_tipo === 'audio' && (
                    <audio src={m.anexo_url} controls className="mb-1 max-w-full" />
                  )}
                  {m.anexo_url && m.anexo_tipo === 'document' && (
                    <a
                      href={m.anexo_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 mb-1 rounded-lg px-2.5 py-2"
                      style={{ backgroundColor: '#f0f2f5' }}
                    >
                      <FileText size={18} color="#54656f" />
                      <span className="text-xs truncate" style={{ color: '#111b21' }}>{m.anexo_nome || 'Documento'}</span>
                    </a>
                  )}
                  {m.texto && !(m.anexo_url && LEGENDAS_AUTOMATICAS_ANEXO.has(m.texto)) && (
                    <p className="text-[14.5px] whitespace-pre-wrap break-words" style={{ color: '#111b21' }}>{m.texto}</p>
                  )}
                  <p className="flex items-center justify-end gap-1 text-[11px] mt-0.5" style={{ color: '#667781' }}>
                    {formatarHora(m.criado_em)}
                    {enviada && <CheckCheck size={14} color="#53bdeb" />}
                  </p>
                  {Array.isArray(m.botoes) && m.botoes.length > 0 && (
                    <div className="-mx-3 mt-1.5">
                      {m.botoes.map(b => (
                        <div
                          key={b.id}
                          className="flex items-center justify-center gap-2 px-3 py-2.5"
                          style={{ borderTop: '1px solid #e9edef', color: '#00a884' }}
                        >
                          <CornerUpLeft size={15} />
                          <span className="text-sm font-medium">{b.title}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {enviada && podeAgir && (
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setRespondendoA({ id: m.id, texto: m.texto, wamid: m.wamid })} title="Responder" className="w-6 h-6 rounded-full flex items-center justify-center" style={{ color: '#54656f' }}>
                      <Reply size={13} />
                    </button>
                  </div>
                )}
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
            {modoComposer === 'texto' && (
              <>
                <div className="flex gap-2 px-2 sm:px-4 pt-2.5 overflow-x-auto scroll-oculto">
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

                {respondendoA && (
                  <div className="flex items-center justify-between gap-2 mx-2 sm:mx-4 mt-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#ffffff', borderLeft: '3px solid #00a884' }}>
                    <p className="text-xs truncate" style={{ color: '#667781' }}>A responder: {resumirTexto(respondendoA.texto, 60)}</p>
                    <button onClick={() => setRespondendoA(null)} className="shrink-0">
                      <X size={14} color="#667781" />
                    </button>
                  </div>
                )}

                <div className="relative px-1.5 sm:px-4">
                  {mostrarMenuExtra && (
                    <div
                      className="absolute bottom-full left-1.5 sm:left-4 mb-2 rounded-xl shadow-lg overflow-hidden z-10"
                      style={{ backgroundColor: '#ffffff', border: '1px solid #e9edef', minWidth: 200 }}
                    >
                      <button
                        onClick={() => { setMostrarMenuExtra(false); setModoComposer('localizacao'); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors hover:bg-black/[0.03]"
                        style={{ color: '#111b21' }}
                      >
                        <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#eef7f4', color: '#00a884' }}><MapPin size={16} /></span>
                        Localização
                      </button>
                      <button
                        onClick={() => { setMostrarMenuExtra(false); setModoComposer('contacto'); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors hover:bg-black/[0.03]"
                        style={{ color: '#111b21' }}
                      >
                        <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#eef7f4', color: '#00a884' }}><Contact size={16} /></span>
                        Contacto
                      </button>
                      <button
                        onClick={() => { setMostrarMenuExtra(false); setModoComposer('botoes'); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors hover:bg-black/[0.03]"
                        style={{ color: '#111b21' }}
                      >
                        <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#eef7f4', color: '#00a884' }}><ListPlus size={16} /></span>
                        Botões de resposta
                      </button>
                    </div>
                  )}
                  <div className="flex items-end gap-2 py-3">
                    <input
                      ref={anexoInputRef}
                      type="file"
                      accept="image/*,audio/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx"
                      className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) enviarAnexo(f); }}
                    />
                    {/* Pill única, ao estilo do WhatsApp real -- "+" e agrafo
                        vivem DENTRO do campo, não como botões soltos ao lado. */}
                    <div className="flex-1 min-w-0 flex items-center rounded-full pl-1 pr-1" style={{ backgroundColor: '#ffffff' }}>
                      <button
                        onClick={() => setMostrarMenuExtra(v => !v)}
                        title="Mais opções (localização, contacto, botões)"
                        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors"
                        style={{ backgroundColor: mostrarMenuExtra ? '#e7f8f3' : 'transparent', color: mostrarMenuExtra ? '#00a884' : '#54656f' }}
                      >
                        <Plus size={19} />
                      </button>
                      <input
                        value={texto}
                        onChange={e => setTexto(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }}
                        placeholder={enviandoAnexo ? 'A enviar anexo…' : 'Escreve uma mensagem'}
                        className="flex-1 min-w-0 bg-transparent outline-none text-sm py-2.5 px-1"
                        style={{ color: '#111b21' }}
                        disabled={enviando || enviandoAnexo}
                      />
                      <button
                        onClick={() => anexoInputRef.current?.click()}
                        disabled={enviandoAnexo}
                        title="Anexar ficheiro (imagem, áudio, vídeo ou documento, máx. 3MB)"
                        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 disabled:opacity-40 transition-opacity"
                        style={{ color: '#54656f' }}
                      >
                        <Paperclip size={18} />
                      </button>
                    </div>
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
              </>
            )}

            {modoComposer === 'localizacao' && (
              <div className="mx-2 sm:mx-4 my-3 p-3 rounded-lg space-y-2" style={{ backgroundColor: '#ffffff' }}>
                <p className="text-sm font-semibold" style={{ color: '#111b21' }}>Enviar localização atual</p>
                <input
                  value={localNome}
                  onChange={e => setLocalNome(e.target.value)}
                  placeholder="Nome do local (opcional)"
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ backgroundColor: '#f0f2f5', color: '#111b21' }}
                />
                <input
                  value={localEndereco}
                  onChange={e => setLocalEndereco(e.target.value)}
                  placeholder="Morada (opcional)"
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ backgroundColor: '#f0f2f5', color: '#111b21' }}
                />
                <div className="flex gap-2">
                  <button onClick={() => setModoComposer('texto')} disabled={enviandoExtra} className="flex-1 py-2 rounded-lg text-sm font-semibold disabled:opacity-40" style={{ backgroundColor: '#f0f2f5', color: '#111b21' }}>
                    Cancelar
                  </button>
                  <button onClick={enviarLocalizacao} disabled={enviandoExtra} className="flex-1 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40" style={{ backgroundColor: '#00a884' }}>
                    {enviandoExtra ? 'A obter localização…' : 'Usar localização atual'}
                  </button>
                </div>
              </div>
            )}

            {modoComposer === 'contacto' && (
              <div className="mx-2 sm:mx-4 my-3 p-3 rounded-lg space-y-2" style={{ backgroundColor: '#ffffff' }}>
                <p className="text-sm font-semibold" style={{ color: '#111b21' }}>Enviar cartão de contacto</p>
                {CONTATOS_UTEIS_FRONT.map(c => (
                  <button
                    key={c.id}
                    onClick={() => enviarContacto(c.id)}
                    disabled={enviandoExtra}
                    className="w-full text-left py-2 px-3 rounded-lg text-sm disabled:opacity-40"
                    style={{ backgroundColor: '#f0f2f5', color: '#111b21' }}
                  >
                    {c.nome}
                  </button>
                ))}
                <button onClick={() => setModoComposer('texto')} disabled={enviandoExtra} className="w-full py-2 rounded-lg text-sm font-semibold disabled:opacity-40" style={{ backgroundColor: '#f0f2f5', color: '#111b21' }}>
                  Cancelar
                </button>
              </div>
            )}

            {modoComposer === 'botoes' && (
              <div className="mx-2 sm:mx-4 my-3 p-3 rounded-lg space-y-2" style={{ backgroundColor: '#ffffff' }}>
                <p className="text-sm font-semibold" style={{ color: '#111b21' }}>Enviar pergunta com botões</p>
                <textarea
                  value={botoesCorpo}
                  onChange={e => setBotoesCorpo(e.target.value)}
                  placeholder="Pergunta…"
                  rows={2}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
                  style={{ backgroundColor: '#f0f2f5', color: '#111b21' }}
                />
                {botoesLista.map((valor, i) => (
                  <input
                    key={i}
                    value={valor}
                    onChange={e => setBotoesLista(prev => prev.map((v, idx) => (idx === i ? e.target.value : v)))}
                    placeholder={`Botão ${i + 1}${i === 0 ? '' : ' (opcional)'}`}
                    maxLength={20}
                    className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                    style={{ backgroundColor: '#f0f2f5', color: '#111b21' }}
                  />
                ))}
                <div className="flex gap-2">
                  <button onClick={() => setModoComposer('texto')} disabled={enviandoExtra} className="flex-1 py-2 rounded-lg text-sm font-semibold disabled:opacity-40" style={{ backgroundColor: '#f0f2f5', color: '#111b21' }}>
                    Cancelar
                  </button>
                  <button
                    onClick={enviarBotoesCompostos}
                    disabled={enviandoExtra || !botoesCorpo.trim() || !botoesLista[0].trim()}
                    className="flex-1 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40"
                    style={{ backgroundColor: '#00a884' }}
                  >
                    {enviandoExtra ? 'A enviar…' : 'Enviar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
