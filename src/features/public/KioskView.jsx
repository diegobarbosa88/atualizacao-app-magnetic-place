import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { QrCode, WifiOff } from 'lucide-react';

// Ecrã fullscreen para um tablet fixo no estaleiro — mostra um QR que roda
// a cada TTL do token (ver api/ponto/index.js) para o trabalhador ler no
// telemóvel dele (PicarPontoModal.jsx) e picar o ponto. Sem login: o id do
// cliente na URL (/kiosk/:clientId) é a "capacidade" de acesso, mesmo
// espírito de /onboarding/:token — montado SEM AppProvider/BrowserRouter
// (ver src/main.jsx), para nunca pagar o custo do fetch de dados da app
// inteira num tablet que fica ligado 24/7.
export default function KioskView({ clientId }) {
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [clientName, setClientName] = useState('');
  const [ttlSeconds, setTtlSeconds] = useState(20);
  const [erro, setErro] = useState(null);
  const wakeLockRef = useRef(null);

  useEffect(() => {
    let cancelado = false;
    let timeoutId;

    async function buscarToken() {
      try {
        const resp = await fetch(`/api/ponto/token?clientId=${encodeURIComponent(clientId)}`);
        const data = await resp.json();
        if (cancelado) return;
        if (!resp.ok) {
          setErro(data.error || 'Kiosk não configurado.');
          setQrDataUrl(null);
          return;
        }
        setErro(null);
        setClientName(data.clientName || '');
        setTtlSeconds(data.ttlSeconds || 20);
        const dataUrl = await QRCode.toDataURL(data.token, {
          errorCorrectionLevel: 'M',
          margin: 1,
          width: 420,
          color: { dark: '#1B3A57', light: '#ffffff' },
        });
        if (!cancelado) setQrDataUrl(dataUrl);
      } catch {
        if (!cancelado) {
          setErro('Sem ligação — a tentar novamente...');
          setQrDataUrl(null);
        }
      } finally {
        if (!cancelado) {
          // Renova a 75% do TTL, para nunca ficar sem QR válido no ar.
          timeoutId = setTimeout(buscarToken, Math.max(5000, (ttlSeconds || 20) * 750));
        }
      }
    }

    buscarToken();
    return () => { cancelado = true; clearTimeout(timeoutId); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  useEffect(() => {
    async function pedirWakeLock() {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
        }
      } catch {
        // Sem suporte ou permissão negada — o ecrã pode apagar, sem impacto
        // funcional no fluxo de picagem em si.
      }
    }
    pedirWakeLock();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') pedirWakeLock();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      wakeLockRef.current?.release?.().catch(() => {});
    };
  }, []);

  return (
    <div style={{
      minHeight: '100vh', width: '100vw', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', background: '#122741',
      fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif", padding: 24,
      position: 'fixed', inset: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
        <QrCode size={28} color="#EB8D00" />
        <div style={{ color: '#fff', fontSize: 26, fontWeight: 700, letterSpacing: '0.02em' }}>
          {clientName || 'Registo de Ponto'}
        </div>
      </div>

      {erro ? (
        <div style={{
          width: 320, height: 320, borderRadius: 24, background: 'rgba(199,0,54,0.12)',
          border: '2px solid #c70036', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, textAlign: 'center',
        }}>
          <WifiOff size={40} color="#e08872" />
          <div style={{ color: '#e08872', fontFamily: "'IBM Plex Mono', monospace", fontSize: 14 }}>{erro}</div>
        </div>
      ) : qrDataUrl ? (
        <div style={{ background: '#fff', borderRadius: 24, padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}>
          <img src={qrDataUrl} alt="QR de registo de ponto" width={420} height={420} />
        </div>
      ) : (
        <div style={{ width: 320, height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A9B8C7', fontFamily: "'IBM Plex Mono', monospace" }}>
          A carregar...
        </div>
      )}

      <div style={{ marginTop: 24, color: '#A9B8C7', fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, letterSpacing: '0.04em' }}>
        Aponta a câmara do teu telemóvel a este código
      </div>
    </div>
  );
}
