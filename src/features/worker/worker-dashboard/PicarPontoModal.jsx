import React, { useState, useEffect, useRef } from 'react';
import { QrCode, CheckCircle2, XCircle, LogIn, Coffee, LogOut, RotateCcw } from 'lucide-react';
import ModalShell from '../../../components/common/ModalShell';
import { SCALE, FONT_MONO } from '../../../styles/designTokens';
import { authFetch } from '../../../utils/authFetch';
import { getCurrentPosition } from '../../../utils/geoUtils';

// Modal "Picar Ponto" — abre a câmara, lê o QR do kiosk (KioskView.jsx) e
// regista a picagem via api/ponto (action=registar). O servidor é quem
// decide se a ação escolhida é válida (máquina de estados a partir do log
// de hoje) — esta modal não tenta adivinhar, mostra sempre as 4 opções e
// deixa o erro do servidor guiar o trabalhador quando escolhe mal.
const TIPOS = [
  { id: 'entrada', label: 'Entrada', icon: LogIn },
  { id: 'inicio_pausa', label: 'Início de Pausa', icon: Coffee },
  { id: 'fim_pausa', label: 'Fim de Pausa', icon: Coffee },
  { id: 'saida', label: 'Saída', icon: LogOut },
];

export default function PicarPontoModal({ isOpen, onClose }) {
  const [step, setStep] = useState('scanning'); // scanning | confirm | success | error
  const [qrToken, setQrToken] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState(null);
  const videoRef = useRef(null);
  const scannerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    setStep('scanning');
    setQrToken(null);
    setResultado(null);
    setErro(null);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || step !== 'scanning') return;
    let cancelado = false;

    async function iniciarScanner() {
      try {
        const { default: QrScanner } = await import('qr-scanner');
        if (cancelado || !videoRef.current) return;
        scannerRef.current = new QrScanner(
          videoRef.current,
          (result) => {
            const texto = typeof result === 'string' ? result : result?.data;
            if (texto) {
              scannerRef.current?.stop();
              setQrToken(texto);
              setStep('confirm');
            }
          },
          { preferredCamera: 'environment', highlightScanRegion: true, highlightCodeOutline: true }
        );
        await scannerRef.current.start();
      } catch {
        if (!cancelado) setErro('Não foi possível aceder à câmara. Verifica as permissões do telemóvel.');
      }
    }
    iniciarScanner();

    return () => {
      cancelado = true;
      scannerRef.current?.stop();
      scannerRef.current?.destroy?.();
      scannerRef.current = null;
    };
  }, [isOpen, step]);

  const handleConfirmar = async (tipo) => {
    if (enviando) return;
    setEnviando(true);
    setErro(null);
    let geo = null;
    try {
      geo = await getCurrentPosition();
    } catch {
      // Sem geolocalização — segue sem, o registo não depende disto.
    }
    try {
      const resp = await authFetch('/api/ponto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'registar', token: qrToken, tipo, lat: geo?.lat, lng: geo?.lng }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setErro(data.error || 'Não foi possível registar o ponto.');
        setEnviando(false);
        return;
      }
      setResultado(data);
      setStep('success');
    } catch {
      setErro('Sem ligação — tenta novamente.');
    } finally {
      setEnviando(false);
    }
  };

  const tentarNovamente = () => {
    setErro(null);
    setQrToken(null);
    setStep('scanning');
  };

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} title="Picar Ponto" subtitle="Aponta a câmara ao QR do kiosk" icon={<QrCode size={16} />} accent="brand">
      <div className="px-4 py-4 space-y-4">
        {step === 'scanning' && (
          <div className="space-y-3">
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-square">
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
            </div>
            {erro && <p className={`${SCALE.text.meta} text-rose-600 text-center`}>{erro}</p>}
          </div>
        )}

        {step === 'confirm' && (
          <div className="space-y-3">
            <p className={`${SCALE.text.statLabel} text-slate-500`}>O que queres registar?</p>
            <div className="grid grid-cols-2 gap-2">
              {TIPOS.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => handleConfirmar(t.id)}
                    disabled={enviando}
                    className="flex flex-col items-center gap-1.5 py-4 rounded-xl border border-slate-200 bg-slate-50 hover:border-orange-300 hover:bg-orange-50 transition-all disabled:opacity-40"
                  >
                    <Icon size={20} className="text-slate-600" />
                    <span className="text-xs font-bold text-slate-700">{t.label}</span>
                  </button>
                );
              })}
            </div>
            {enviando && <p className={`${SCALE.text.meta} text-slate-400 text-center`}>A registar...</p>}
            {erro && (
              <div className="space-y-2">
                <p className={`${SCALE.text.meta} text-rose-600 text-center`}>{erro}</p>
                <button
                  onClick={tentarNovamente}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-black"
                >
                  <RotateCcw size={13} /> Ler o QR outra vez
                </button>
              </div>
            )}
          </div>
        )}

        {step === 'success' && resultado && (
          <div className="py-6 flex flex-col items-center gap-3 text-center">
            <CheckCircle2 size={40} className="text-emerald-600" />
            <div>
              <p className="text-base font-bold text-slate-800">
                {TIPOS.find((t) => t.id === resultado.tipo)?.label || resultado.tipo} registada
              </p>
              <p className={`${SCALE.text.meta} text-slate-400 mt-1`} style={{ fontFamily: FONT_MONO }}>
                {resultado.hora} · {resultado.data}
              </p>
            </div>
            <button
              onClick={onClose}
              className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[var(--navy-solid)] text-white text-xs font-black"
            >
              Fechar
            </button>
          </div>
        )}
      </div>
    </ModalShell>
  );
}
