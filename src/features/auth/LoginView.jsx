import React, { useState, useEffect } from 'react';
import { UserCircle, Lock, Download, AlertCircle, ExternalLink, X } from 'lucide-react';
import CompanyLogo from '../../components/common/CompanyLogo';
import './LoginView.css';

const PAGE_BG = { background: 'linear-gradient(160deg, #0F1F3D 0%, #1a3460 100%)' };
const CARD_STYLE = {
  backgroundColor: '#152843',
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow: '0 32px 64px rgba(0,0,0,0.5)',
};
const INPUT_STYLE = {
  backgroundColor: 'rgba(255,255,255,0.07)',
  border: '1.5px solid rgba(255,255,255,0.10)',
  color: 'white',
};
const INPUT_FOCUS_CLASS = 'outline-none transition-all focus:border-[#EB8D00]';

const LoginView = ({ onLogin }) => {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pendingAdminWorker, setPendingAdminWorker] = useState(null);
  const [pendingToken, setPendingToken] = useState(null);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showIosInstructions, setShowIosInstructions] = useState(false);

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      const newState = !showIosInstructions;
      setShowIosInstructions(newState);
      if (newState) {
        setTimeout(() => {
          document.getElementById('ios-instructions')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
      }
      return;
    }
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setDeferredPrompt(null);
    } else {
      setShowIosInstructions(prev => !prev);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    setSubmitting(true);
    try {
      const isAdminUsername = user.trim().toLowerCase() === 'admin';
      const body = isAdminUsername
        ? { role: 'admin', password: pass.trim() }
        : { role: 'worker', username: user.toLowerCase().trim(), nif: pass.trim() };

      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || 'Não foi possível iniciar sessão. Tenta novamente.');
        return;
      }

      const found = data.user;
      if (isAdminUsername) {
        onLogin('admin', found, data.token);
      } else if (found.isAdmin) {
        setPendingAdminWorker(found);
        setPendingToken(data.token);
      } else {
        onLogin('worker', found, data.token);
      }
    } catch {
      setError('Erro de ligação. Tenta novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const showInstallButton = !isStandalone;

  if (pendingAdminWorker) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 font-sans" style={PAGE_BG}>
        <div className="max-w-md w-full rounded-[2rem] sm:rounded-[3rem] p-8 sm:p-12 text-center" style={CARD_STYLE}>
          <div className="flex justify-center mb-5">
            <CompanyLogo className="h-16 w-16 object-contain drop-shadow-xl" />
          </div>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '4px' }}>Bem-vindo</p>
          <h2 className="text-xl font-black mb-8" style={{ color: 'white' }}>{pendingAdminWorker.name}</h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', fontWeight: 700, marginBottom: '20px' }}>Como quer entrar?</p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => onLogin('admin', { ...pendingAdminWorker, role: 'admin' }, pendingToken)}
              className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest active:scale-95 transition-all text-white"
              style={{ background: '#EB8D00', boxShadow: '0 4px 16px rgba(235,141,0,0.3)' }}
            >
              Painel Admin
            </button>
            <button
              onClick={() => onLogin('worker', pendingAdminWorker, pendingToken)}
              className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest active:scale-95 transition-all text-white"
              style={{ backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              Meu Painel
            </button>
            <button onClick={() => setPendingAdminWorker(null)} className="text-xs text-slate-400 hover:text-slate-200 mt-2 transition-colors">
              Voltar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 font-sans" style={PAGE_BG}>
      <div className="max-w-md w-full rounded-[2rem] sm:rounded-[3rem] p-8 sm:p-12" style={CARD_STYLE}>

        {/* Cabeçalho de marca */}
        <div className="text-center mb-10">
          <div className="flex justify-center mb-5">
            <CompanyLogo className="h-20 w-20 object-contain drop-shadow-xl" />
          </div>
          <p className="text-white font-black text-2xl tracking-tight leading-none">MAGNETIC PLACE</p>
          <p className="text-slate-400 text-sm font-medium mt-1">Unipessoal, Lda</p>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: '12px' }}>Acesso ao Sistema</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Utilizador</label>
            <div className="relative">
              <UserCircle className="absolute left-4 top-4 text-slate-400" size={20} />
              <input
                type="text"
                value={user}
                onChange={e => { setUser(e.target.value.toLowerCase().replace(/\s/g, '')); setError(''); }}
                className={`w-full rounded-2xl p-4 pl-12 text-sm ${INPUT_FOCUS_CLASS} placeholder:text-slate-500 lowercase`}
                style={INPUT_STYLE}
                placeholder="ex: joaosilva"
                autoCapitalize="none"
                autoCorrect="off"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Senha</label>
            <div className="relative">
              <Lock className="absolute left-4 top-4 text-slate-400" size={20} />
              <input
                type="password"
                value={pass}
                onChange={e => { setPass(e.target.value.replace(/\s/g, '')); setError(''); }}
                className={`w-full rounded-2xl p-4 pl-12 text-sm ${INPUT_FOCUS_CLASS} placeholder:text-slate-500`}
                style={INPUT_STYLE}
                placeholder="O seu NIF"
                required
              />
            </div>
          </div>

          {error && (
            <div className="p-4 rounded-2xl flex items-center gap-3 text-xs font-bold" style={{ backgroundColor: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} /> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-5 rounded-2xl font-black text-sm uppercase tracking-widest active:scale-95 transition-all text-white disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#1B3A57', border: '1px solid rgba(255,255,255,0.15)' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#234d74'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#1B3A57'}
          >
            {submitting ? 'A entrar…' : 'Entrar'}
          </button>

          <div className="pt-4 flex flex-col gap-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            {showInstallButton && (
              <button
                type="button"
                onClick={handleInstallClick}
                className="w-full py-5 rounded-2xl font-black text-sm uppercase tracking-widest hover:opacity-90 flex justify-center items-center gap-3 animate-bounce-subtle transition-all transform active:scale-95 text-white"
                style={{ background: 'linear-gradient(to right, #4f46e5, #4338ca)', boxShadow: '0 4px 20px rgba(79,70,229,0.25)' }}
              >
                <div className="bg-white/20 p-1.5 rounded-lg"><Download size={20} /></div>
                Instalar no Telemóvel
              </button>
            )}

            {!isIOS && !deferredPrompt && showIosInstructions && (
              <div className="rounded-2xl p-5 animate-in zoom-in-95 duration-300" style={{ backgroundColor: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)' }}>
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Como instalar</h4>
                  <button onClick={() => setShowIosInstructions(false)} className="text-indigo-400 hover:text-indigo-200"><X size={16} /></button>
                </div>
                <ul className="space-y-2">
                  <li className="flex items-center gap-3 text-[10px] font-medium text-indigo-200 p-2.5 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                    <span className="w-5 h-5 flex items-center justify-center rounded-full font-black text-[9px]" style={{ backgroundColor: 'rgba(99,102,241,0.4)', color: '#c7d2fe' }}>1</span>
                    Abra o menu do browser (⋮ ou ···)
                  </li>
                  <li className="flex items-center gap-3 text-[10px] font-medium text-indigo-200 p-2.5 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                    <span className="w-5 h-5 flex items-center justify-center rounded-full font-black text-[9px]" style={{ backgroundColor: 'rgba(99,102,241,0.4)', color: '#c7d2fe' }}>2</span>
                    Escolha <span className="font-black mx-1">"Instalar aplicação"</span> ou <span className="font-black mx-1">"Adicionar ao ecrã inicial"</span>
                  </li>
                </ul>
              </div>
            )}

            {isIOS && showIosInstructions && (
              <div id="ios-instructions" className="rounded-2xl p-5 animate-in zoom-in-95 duration-300" style={{ backgroundColor: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.25)' }}>
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    <ExternalLink size={18} className="text-amber-400" />
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-300">Guia Visual iPhone</h4>
                  </div>
                  <button onClick={() => setShowIosInstructions(false)} className="text-amber-400 p-1 hover:text-amber-200"><X size={16} /></button>
                </div>

                <div className="mb-4 rounded-xl overflow-hidden" style={{ border: '1px solid rgba(245,158,11,0.2)' }}>
                  <img src="ios-guide.png" alt="Guia de Instalação iOS" className="w-full h-auto object-cover" />
                </div>

                <div className="space-y-3">
                  <p className="text-[11px] font-bold text-amber-300 leading-relaxed">Mais fácil do que parece:</p>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-3 text-[10px] font-medium text-amber-200 p-2.5 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                      <span className="w-5 h-5 flex items-center justify-center rounded-full font-black text-[9px]" style={{ backgroundColor: 'rgba(245,158,11,0.3)', color: '#fcd34d' }}>1</span>
                      Toque no ícone de <span className="font-black mx-1">Partilhar</span> em baixo.
                    </li>
                    <li className="flex items-center gap-3 text-[10px] font-medium text-amber-200 p-2.5 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                      <span className="w-5 h-5 flex items-center justify-center rounded-full font-black text-[9px]" style={{ backgroundColor: 'rgba(245,158,11,0.3)', color: '#fcd34d' }}>2</span>
                      Escolha <span className="font-black mx-1">"Ecrã de Início"</span>.
                    </li>
                  </ul>
                  <button
                    onClick={() => setShowIosInstructions(false)}
                    className="w-full py-2 text-white rounded-xl text-[9px] font-black uppercase tracking-widest mt-2 transition-colors"
                    style={{ backgroundColor: 'rgba(245,158,11,0.6)' }}
                  >
                    Entendido
                  </button>
                </div>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginView;
