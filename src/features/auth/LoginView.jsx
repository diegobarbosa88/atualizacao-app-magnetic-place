import React, { useState, useEffect } from 'react';
import { UserCircle, Lock, Download, AlertCircle, ExternalLink, X } from 'lucide-react';
import CompanyLogo from '../../components/common/CompanyLogo';

const LoginView = ({ workers, onLogin, systemSettings, setSystemSettings }) => {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showIosInstructions, setShowIosInstructions] = useState(false);

  // Detecção de iOS e se já está instalado
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
        // Pequeno atraso para garantir que o elemento foi renderizado no DOM após o estado mudar
        setTimeout(() => {
          const el = document.getElementById('ios-instructions');
          if (el) {
            el.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
              inline: 'nearest'
            });
          }
        }, 300);
      }
      return;
    }
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };



  const handleSubmit = (e) => {
    e.preventDefault();
    if (user === 'admin' && pass === systemSettings.adminPassword) {
      onLogin('admin');
      return;
    }

    // Procura o trabalhador pelo primeiro e último nome juntos em minúsculas
    const found = workers.find(w => {
      if (!w.name) return false;
      const parts = w.name.trim().split(/\s+/);
      const first = parts[0].toLowerCase();
      const last = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
      const workerLogin = first + last;
      return workerLogin === user.toLowerCase().trim();
    });

    if (found) {
      const validPass = (found.nif || "").toString().trim();
      if (validPass === pass.trim()) {
        if (found.status === 'inativo') {
          setError('A sua conta está inativa. Contacte a administração.');
          return;
        }
        onLogin('worker', found);
      } else {
        setError('Senha incorreta (utilize o seu NIF)');
      }
    } else {
      setError('Utilizador não encontrado (use o seu primeiro e último nome juntos, ex: joaosilva)');
    }
  };

  const showInstallButton = (deferredPrompt || (isIOS && !isStandalone));

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 sm:p-6 font-sans text-slate-900">
      <div className="max-w-md w-full bg-white rounded-[2rem] sm:rounded-[3rem] shadow-2xl p-8 sm:p-12 border border-slate-200">
        <div className="text-center mb-10">
          <div className="flex justify-center mb-6">
            <CompanyLogo className="h-32 w-32 object-contain drop-shadow-xl" />
          </div>
          <h1 className="text-2xl font-black tracking-tighter uppercase">{systemSettings.companyName}</h1>
          <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.3em] mt-2">Acesso ao Sistema</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Utilizador</label>
            <div className="relative"><UserCircle className="absolute left-4 top-4 text-slate-300" size={20} /><input type="text" value={user} onChange={e => setUser(e.target.value)} className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl p-4 pl-12 text-sm outline-none transition-all shadow-inner text-slate-900" placeholder="ex: joaosilva" required /></div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Senha</label>
            <div className="relative"><Lock className="absolute left-4 top-4 text-slate-300" size={20} /><input type="password" value={pass} onChange={e => setPass(e.target.value)} className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl p-4 pl-12 text-sm outline-none transition-all shadow-inner text-slate-900" placeholder="O seu NIF" required /></div>
          </div>
          {error && <div className="p-4 bg-red-50 text-red-500 text-xs font-bold rounded-2xl flex items-center gap-3 animate-pulse"><AlertCircle size={16} /> {error}</div>}
          <button type="submit" className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl hover:bg-slate-800 active:scale-95 transition-all">Entrar</button>

          <div className="pt-4 border-t border-slate-100 flex flex-col gap-4">
            {/* Botão de Instalação Unificado */}
            {showInstallButton && (
              <button
                type="button"
                onClick={handleInstallClick}
                className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 text-white py-5 rounded-2xl font-black text-sm uppercase tracking-widest hover:from-indigo-700 hover:to-indigo-800 shadow-xl shadow-indigo-100 flex justify-center items-center gap-3 animate-bounce-subtle transition-all transform active:scale-95"
              >
                <div className="bg-white/20 p-1.5 rounded-lg"><Download size={20} /></div>
                Instalar no Telemóvel
              </button>
            )}

            {/* Instruções para iPhone (iOS) - Mostra apenas após clique */}
            {isIOS && showIosInstructions && (
              <div id="ios-instructions" className="bg-amber-50 rounded-2xl p-5 border border-amber-200 animate-in zoom-in-95 duration-300 ring-2 ring-amber-100">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    <ExternalLink size={18} className="text-amber-600" />
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-900">Guia Visual iPhone</h4>
                  </div>
                  <button onClick={() => setShowIosInstructions(false)} className="text-amber-400 p-1 hover:text-amber-600"><X size={16} /></button>
                </div>

                <div className="mb-4 rounded-xl overflow-hidden border border-amber-100 shadow-sm">
                  <img src="ios-guide.png" alt="Guia de Instalação iOS" className="w-full h-auto object-cover" />
                </div>

                <div className="space-y-3">
                  <p className="text-[11px] font-bold text-amber-800 leading-relaxed">Mais fácil do que parece:</p>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-3 text-[10px] font-medium text-amber-700 bg-white/70 p-2.5 rounded-xl border border-amber-100">
                      <span className="bg-amber-200 text-amber-900 w-5 h-5 flex items-center justify-center rounded-full font-black text-[9px]">1</span>
                      Toque no ícone de <span className="font-black mx-1">Partilhar</span> em baixo.
                    </li>
                    <li className="flex items-center gap-3 text-[10px] font-medium text-amber-700 bg-white/70 p-2.5 rounded-xl border border-amber-100">
                      <span className="bg-amber-200 text-amber-900 w-5 h-5 flex items-center justify-center rounded-full font-black text-[9px]">2</span>
                      Escolha <span className="font-black mx-1">"Ecrã de Início"</span>.
                    </li>
                  </ul>
                  <button onClick={() => setShowIosInstructions(false)} className="w-full py-2 bg-amber-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest mt-2 hover:bg-amber-700 transition-colors">Entendido</button>
                </div>
              </div>
            )}
          </div>
        </form>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes bounce-subtle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .animate-bounce-subtle {
          animation: bounce-subtle 3s infinite ease-in-out;
        }
      `}} />
    </div>
  );
};

export default LoginView;
