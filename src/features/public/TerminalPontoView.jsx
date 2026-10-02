import React, { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { CheckCircle2, Coffee, IdCard, LogIn, LogOut, Nfc, WifiOff, XCircle, UserPlus } from 'lucide-react';

// Terminal de picagem NFC (piloto) — dispositivo Android fixo na obra, rota
// /kiosk/terminal. Cada trabalhador tem o SEU cartão; o terminal lê-o com
// Web NFC (só Chrome em Android) e regista a picagem em nome dele via
// api/formacao (ponto-terminal-*). Mesmo espírito do KioskView.jsx: montado
// sem AppProvider/BrowserRouter (ver src/main.jsx), fica ligado 24/7.
//
// Credencial: token longo guardado em localStorage, obtido UMA vez com o
// código de ativação gerado no admin (Ponto › Terminais). Se o admin
// revogar/desativar o terminal, a API devolve 401 e o ecrã volta à ativação.

const NAVY = '#122741';
const NAVY_CARD = '#1B3A57';
const ORANGE = '#EB8D00';
const MUTED = '#A9B8C7';
const OK = '#1f6b47';
const BAD = '#c70036';
const FONT = "'Barlow Condensed', 'Arial Narrow', sans-serif";
const MONO = "'IBM Plex Mono', monospace";
const TOKEN_KEY = 'ponto_terminal_token';

// TEMPORÁRIO (piloto): com ?teste=1 no URL, qualquer leitura NFC conta como o
// mesmo cartão fixo. Serve para testar com um telemóvel Android, que gera um
// UID aleatório a cada toque. Remover quando chegarem os cartões NTAG213.
const UID_TESTE = new URLSearchParams(window.location?.search || '').get('teste') === '1'
  ? '7E57000000000001'
  : null;

const TIPOS = {
  entrada: { label: 'Entrada', icon: LogIn },
  inicio_pausa: { label: 'Início de pausa', icon: Coffee },
  fim_pausa: { label: 'Fim de pausa', icon: Coffee },
  saida: { label: 'Saída', icon: LogOut },
};

const AUTO_CONFIRMAR_S = 3;
const VOLTAR_AO_INICIO_MS = { identificado: 15000, sucesso: 4000, erro: 5000, associado: 5000, concluido: 5000 };

function lerToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
function gravarToken(t) {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Sem storage (modo privado) — o terminal funciona até ser recarregado.
  }
}

function iniciais(nome) {
  const partes = (nome || '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  return ((partes[0][0] || '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
}

export default function TerminalPontoView() {
  const [token, setToken] = useState(() => lerToken());
  const [estado, setEstado] = useState(null); // { terminal, client, associacao }
  const [ecra, setEcra] = useState({ tipo: 'idle' });
  const [nfc, setNfc] = useState('a_iniciar'); // a_iniciar | ativo | precisa_toque | sem_suporte
  const [online, setOnline] = useState(true);
  const [agora, setAgora] = useState(() => new Date());
  const ecraRef = useRef(ecra);
  const tokenRef = useRef(token);
  useEffect(() => { ecraRef.current = ecra; }, [ecra]);
  useEffect(() => { tokenRef.current = token; }, [token]);
  const associacaoPendente = !!estado?.associacao;

  const terminarSessao = useCallback(() => {
    gravarToken(null);
    setToken(null);
    setEstado(null);
  }, []);

  // Chamada autenticada ao backend do terminal. 401 → volta à ativação.
  const api = useCallback(async (acao, body) => {
    const resp = await fetch(`/api/ponto/${acao}`, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', 'x-terminal-token': tokenRef.current || '' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await resp.json().catch(() => ({}));
    if (resp.status === 401) terminarSessao();
    return { ok: resp.ok, status: resp.status, data };
  }, [terminarSessao]);

  // Relógio do ecrã (só visual — a hora gravada é sempre a do servidor).
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 15000);
    return () => clearInterval(t);
  }, []);

  // Estado do terminal + heartbeat (ultimo_contacto) + associação pendente.
  useEffect(() => {
    if (!token) return undefined;
    let cancelado = false;
    async function buscar() {
      try {
        const r = await api('terminal-estado');
        if (cancelado) return;
        setOnline(true);
        if (r.ok) setEstado(r.data);
      } catch {
        if (!cancelado) setOnline(false);
      }
    }
    buscar();
    // Durante uma associação pendente, consulta mais vezes para o banner
    // desaparecer logo que o admin a cancela ou expira.
    const t = setInterval(buscar, associacaoPendente ? 3000 : 30000);
    return () => { cancelado = true; clearInterval(t); };
  }, [token, api, associacaoPendente]);

  // Manter o ecrã ligado (mesmo padrão do KioskView).
  useEffect(() => {
    let lock = null;
    async function pedir() {
      try { if ('wakeLock' in navigator) lock = await navigator.wakeLock.request('screen'); } catch { /* sem suporte */ }
    }
    pedir();
    const onVis = () => { if (document.visibilityState === 'visible') pedir(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { document.removeEventListener('visibilitychange', onVis); lock?.release?.().catch(() => {}); };
  }, []);

  // Voltar sozinho ao ecrã inicial depois de cada estado transitório.
  useEffect(() => {
    const ms = VOLTAR_AO_INICIO_MS[ecra.tipo];
    if (!ms) return undefined;
    const t = setTimeout(() => setEcra({ tipo: 'idle' }), ms);
    return () => clearTimeout(t);
  }, [ecra]);

  const registar = useCallback(async (uid, tipo) => {
    setEcra((e) => ({ ...e, tipo: 'a_registar' }));
    try {
      const r = await api('terminal-registar', { uid, tipo });
      setOnline(true);
      if (r.ok) setEcra({ tipo: 'sucesso', registo: r.data });
      else setEcra({ tipo: 'erro', mensagem: r.data.error || 'Não foi possível registar.' });
    } catch {
      setOnline(false);
      setEcra({ tipo: 'erro', mensagem: 'Sem ligação — a picagem NÃO foi registada. Tenta de novo.' });
    }
  }, [api]);

  const aoLerCartao = useCallback(async (serialNumber) => {
    // Ignora leituras enquanto um cartão ainda está a ser tratado.
    if (!['idle', 'erro', 'sucesso', 'concluido', 'associado'].includes(ecraRef.current.tipo)) return;
    if (!serialNumber) {
      setEcra({ tipo: 'erro', mensagem: 'Não consegui ler o cartão. Encosta-o de novo, sem pressa.' });
      return;
    }
    setEcra({ tipo: 'a_ler' });
    try {
      const r = await api('terminal-identificar', { uid: serialNumber });
      setOnline(true);
      if (!r.ok) {
        setEcra({ tipo: 'erro', mensagem: r.data.error || 'Cartão não aceite.', nome: r.data.workerName });
        return;
      }
      if (r.data.resultado === 'associado') {
        setEcra({ tipo: 'associado', nome: r.data.worker?.name });
        setEstado((e) => (e ? { ...e, associacao: null } : e));
        return;
      }
      if (r.data.resultado === 'concluido') {
        setEcra({ tipo: 'concluido', nome: r.data.worker?.name, hoje: r.data.hoje });
        return;
      }
      setEcra({ tipo: 'identificado', uid: serialNumber, ...r.data });
    } catch {
      setOnline(false);
      setEcra({ tipo: 'erro', mensagem: 'Sem ligação à internet. Tenta de novo daqui a pouco.' });
    }
  }, [api]);

  const aoLerRef = useRef(aoLerCartao);
  useEffect(() => { aoLerRef.current = aoLerCartao; }, [aoLerCartao]);

  const iniciarNfc = useCallback(async () => {
    if (!('NDEFReader' in window)) { setNfc('sem_suporte'); return; }
    try {
      const reader = new window.NDEFReader();
      await reader.scan();
      reader.onreading = (ev) => aoLerRef.current(UID_TESTE || ev.serialNumber);
      reader.onreadingerror = () => aoLerRef.current(null);
      setNfc('ativo');
    } catch {
      // Primeira vez precisa de um toque no ecrã para conceder a permissão.
      setNfc('precisa_toque');
    }
  }, []);

  useEffect(() => {
    if (token) iniciarNfc();
  }, [token, iniciarNfc]);

  if (!token) {
    return <EcraAtivacao onAtivado={(t) => { gravarToken(t); setToken(t); }} />;
  }

  const hora = agora.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });

  return (
    <div style={{ position: 'fixed', inset: 0, background: NAVY, color: '#fff', fontFamily: FONT, display: 'flex', flexDirection: 'column', padding: 20, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: MUTED, fontFamily: MONO, fontSize: 13 }}>
        <span>
          {estado?.client?.name || '—'} · {estado?.terminal?.nome || ''}
          {UID_TESTE && <span style={{ color: ORANGE, fontWeight: 700 }}> · MODO TESTE (cartão fixo)</span>}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!online && <WifiOff size={16} color="#e08872" />}
          {hora}
        </span>
      </div>

      {estado?.associacao && (
        <div style={{ marginTop: 14, background: 'rgba(235,141,0,0.15)', border: `1px solid ${ORANGE}`, borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 18 }}>
          <UserPlus size={20} color={ORANGE} />
          <span>Modo associação: o próximo cartão <b>novo</b> fica de <b>{estado.associacao.workerName}</b></span>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 8 }}>
        <Conteudo ecra={ecra} nfc={nfc} onIniciarNfc={iniciarNfc} onRegistar={registar} onCancelar={() => setEcra({ tipo: 'idle' })} />
      </div>

      {ecra.tipo === 'idle' && estado?.client?.pontoQrAtivo && <QrFallback clientId={estado.client.id} />}
    </div>
  );
}

function Conteudo({ ecra, nfc, onIniciarNfc, onRegistar, onCancelar }) {
  if (nfc === 'sem_suporte') {
    return (
      <>
        <XCircle size={64} color="#e08872" />
        <div style={{ fontSize: 26, fontWeight: 700 }}>NFC indisponível</div>
        <div style={{ color: MUTED, fontSize: 18, maxWidth: 420 }}>Abre esta página no Chrome de um telemóvel Android com NFC ligado (Definições › Ligações › NFC).</div>
      </>
    );
  }
  if (nfc === 'precisa_toque' && ecra.tipo === 'idle') {
    return (
      <button onClick={onIniciarNfc} style={{ background: ORANGE, color: NAVY, border: 0, borderRadius: 16, padding: '22px 28px', fontFamily: FONT, fontSize: 24, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Nfc size={28} /> Ativar leitura de cartões
      </button>
    );
  }

  switch (ecra.tipo) {
    case 'a_ler':
    case 'a_registar':
      return <div style={{ color: MUTED, fontSize: 22, fontFamily: MONO }}>{ecra.tipo === 'a_ler' ? 'A ler cartão…' : 'A registar…'}</div>;

    case 'identificado':
      return <Identificado ecra={ecra} onRegistar={onRegistar} onCancelar={onCancelar} />;

    case 'sucesso': {
      const t = TIPOS[ecra.registo.tipo];
      return (
        <>
          <div style={{ width: 120, height: 120, borderRadius: '50%', background: OK, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={68} color="#fff" />
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, marginTop: 10 }}>{t?.label} registada</div>
          <div style={{ fontSize: 22, color: MUTED }}>{ecra.registo.worker?.name} · {ecra.registo.hora}</div>
        </>
      );
    }

    case 'concluido':
      return (
        <>
          <CheckCircle2 size={64} color={MUTED} />
          <div style={{ fontSize: 26, fontWeight: 700 }}>{ecra.nome}</div>
          <div style={{ fontSize: 20, color: MUTED }}>O registo de hoje já está concluído ({ecra.hoje?.startTime}–{ecra.hoje?.endTime}).</div>
        </>
      );

    case 'associado':
      return (
        <>
          <div style={{ width: 120, height: 120, borderRadius: '50%', background: OK, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <UserPlus size={60} color="#fff" />
          </div>
          <div style={{ fontSize: 30, fontWeight: 700, marginTop: 10 }}>Cartão associado</div>
          <div style={{ fontSize: 22, color: MUTED }}>{ecra.nome}</div>
        </>
      );

    case 'erro':
      return (
        <>
          <div style={{ width: 110, height: 110, borderRadius: '50%', background: BAD, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <XCircle size={60} color="#fff" />
          </div>
          {ecra.nome && <div style={{ fontSize: 24, fontWeight: 700, marginTop: 10 }}>{ecra.nome}</div>}
          <div style={{ fontSize: 22, maxWidth: 460, marginTop: ecra.nome ? 0 : 10 }}>{ecra.mensagem}</div>
        </>
      );

    default:
      return (
        <>
          <div style={{ width: 150, height: 150, borderRadius: '50%', border: `3px dashed ${ORANGE}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
            <IdCard size={72} color={ORANGE} />
          </div>
          <div style={{ fontSize: 34, fontWeight: 700 }}>Aproxima o cartão</div>
          <div style={{ fontSize: 18, color: MUTED }}>Registo de ponto</div>
        </>
      );
  }
}

// Uma só ação válida → confirma sozinha ao fim de AUTO_CONFIRMAR_S (dá
// tempo de cancelar). Com escolha (pausa OU saída) nunca adivinha: espera
// que o trabalhador toque na ação certa.
function Identificado({ ecra, onRegistar, onCancelar }) {
  const unica = ecra.validas.length === 1 ? ecra.validas[0] : null;
  const [restam, setRestam] = useState(AUTO_CONFIRMAR_S);

  useEffect(() => {
    if (!unica) return undefined;
    if (restam <= 0) { onRegistar(ecra.uid, unica); return undefined; }
    const t = setTimeout(() => setRestam((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [restam, unica, ecra.uid, onRegistar]);

  return (
    <div style={{ width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 96, height: 96, borderRadius: '50%', background: ORANGE, color: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38, fontWeight: 700 }}>
        {iniciais(ecra.worker?.name)}
      </div>
      <div style={{ fontSize: 30, fontWeight: 700, marginTop: 6 }}>{ecra.worker?.name}</div>
      <div style={{ fontSize: 16, color: MUTED, fontFamily: MONO, marginBottom: 14 }}>
        {ecra.hoje?.startTime ? `Entrada às ${ecra.hoje.startTime}` : 'Ainda sem registo hoje'} · agora {ecra.hora}
      </div>

      {ecra.validas.map((tipo) => {
        const { label, icon: Icon } = TIPOS[tipo];
        return (
          <button
            key={tipo}
            onClick={() => onRegistar(ecra.uid, tipo)}
            style={{ width: '100%', background: ORANGE, color: NAVY, border: 0, borderRadius: 16, padding: '20px 16px', fontFamily: FONT, fontSize: 28, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 10 }}
          >
            <Icon size={30} /> {label}
          </button>
        );
      })}
      {unica && <div style={{ color: MUTED, fontSize: 16 }}>Confirma automaticamente em {restam}s</div>}

      <button onClick={onCancelar} style={{ marginTop: 8, background: 'transparent', color: MUTED, border: `1px solid ${NAVY_CARD}`, borderRadius: 12, padding: '12px 24px', fontFamily: FONT, fontSize: 20 }}>
        Cancelar
      </button>
    </div>
  );
}

// QR dinâmico do kiosk existente, pequeno no canto — para quem se esquecer
// do cartão picar pelo telemóvel (PicarPontoModal). Só aparece se o cliente
// tiver o ponto por QR ativo (ponto_qr_ativo).
function QrFallback({ clientId }) {
  const [qr, setQr] = useState(null);
  useEffect(() => {
    let cancelado = false;
    let t;
    async function buscar() {
      let ttl = 20;
      try {
        const resp = await fetch(`/api/ponto/token?clientId=${encodeURIComponent(clientId)}`);
        const data = await resp.json();
        if (!cancelado && resp.ok) {
          ttl = data.ttlSeconds || 20;
          const url = await QRCode.toDataURL(data.token, { errorCorrectionLevel: 'M', margin: 1, width: 180, color: { dark: '#1B3A57', light: '#ffffff' } });
          if (!cancelado) setQr(url);
        }
      } catch {
        if (!cancelado) setQr(null);
      } finally {
        if (!cancelado) t = setTimeout(buscar, Math.max(5000, ttl * 750));
      }
    }
    buscar();
    return () => { cancelado = true; clearTimeout(t); };
  }, [clientId]);

  if (!qr) return null;
  return (
    <div style={{ position: 'absolute', right: 16, bottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ color: MUTED, fontSize: 14, textAlign: 'right', lineHeight: 1.2, fontFamily: MONO }}>Sem cartão?<br />Lê com o telemóvel</span>
      <img src={qr} alt="QR de registo de ponto" width={90} height={90} style={{ background: '#fff', borderRadius: 8, padding: 4 }} />
    </div>
  );
}

function EcraAtivacao({ onAtivado }) {
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState(null);
  const [aEnviar, setAEnviar] = useState(false);

  const ativar = async (e) => {
    e.preventDefault();
    if (codigo.replace(/[^a-zA-Z0-9]/g, '').length !== 8) { setErro('O código tem 8 caracteres.'); return; }
    setAEnviar(true);
    setErro(null);
    try {
      const resp = await fetch('/api/ponto/terminal-ativar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo }),
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok && data.token) onAtivado(data.token);
      else setErro(data.error || 'Não foi possível ativar.');
    } catch {
      setErro('Sem ligação à internet.');
    } finally {
      setAEnviar(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: NAVY, color: '#fff', fontFamily: FONT, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <form onSubmit={ativar} style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'center' }}>
        <Nfc size={48} color={ORANGE} style={{ alignSelf: 'center' }} />
        <div style={{ fontSize: 30, fontWeight: 700 }}>Ativar terminal de ponto</div>
        <div style={{ color: MUTED, fontSize: 17 }}>Introduz o código gerado no admin em Ponto › Terminais. É válido 10 minutos.</div>
        <input
          value={codigo}
          onChange={(e) => { setCodigo(e.target.value.toUpperCase()); setErro(null); }}
          placeholder="ABCD-EFGH"
          autoCapitalize="characters"
          autoComplete="off"
          maxLength={9}
          style={{ textAlign: 'center', fontFamily: MONO, fontSize: 30, letterSpacing: '0.15em', padding: '14px 10px', borderRadius: 12, border: `2px solid ${erro ? '#e08872' : NAVY_CARD}`, background: '#fff', color: NAVY }}
        />
        {erro && <div style={{ color: '#e08872', fontSize: 16 }}>{erro}</div>}
        <button type="submit" disabled={aEnviar} style={{ background: ORANGE, color: NAVY, border: 0, borderRadius: 12, padding: '16px', fontFamily: FONT, fontSize: 22, fontWeight: 700, opacity: aEnviar ? 0.6 : 1 }}>
          {aEnviar ? 'A ativar…' : 'Ativar'}
        </button>
      </form>
    </div>
  );
}
