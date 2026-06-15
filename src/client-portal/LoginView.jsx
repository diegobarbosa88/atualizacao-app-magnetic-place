import React from 'react';
import { AlertCircle } from 'lucide-react';

export default function LoginView({ t, lang, changeLang, loginNif, setLoginNif, loginEmail, setLoginEmail, loginError, handleLogin, clients, systemSettings }) {
    return (
        <div className="min-h-screen bg-white flex flex-col lg:flex-row overflow-hidden">

            {/* ── LADO ESQUERDO — Arte / Branding ── */}
            <div className="lg:w-3/5 relative flex flex-col justify-between p-8 md:p-14 overflow-hidden bg-[#0f0f1a] min-h-[45vh] lg:min-h-screen">

                <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-[#0f0f1a] to-violet-950" />
                <div className="absolute inset-0 opacity-[0.07]" style={{backgroundImage:'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize:'32px 32px'}} />
                <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-indigo-600/25 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-15%] left-[-5%] w-[450px] h-[450px] bg-violet-700/20 rounded-full blur-[100px]" />

                {/* Logo + nome */}
                <div className="relative z-10 flex items-center gap-3">
                    <img
                        src={systemSettings?.companyLogo || 'MAGNETIC (3).png'}
                        alt="Logo"
                        className="h-10 w-auto object-contain flex-shrink-0"
                        onError={e => { e.target.src = 'MAGNETIC (3).png'; }}
                    />
                    <span className="text-white/80 font-bold text-sm uppercase tracking-widest">Magnetic Place Unipessoal Lda</span>
                </div>

                {/* Título gigante */}
                <div className="relative z-10 my-auto py-10">
                    <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-2 mb-8">
                        <span className="w-2 h-2 bg-indigo-300 rounded-full animate-pulse" />
                        <span className="text-white/80 text-[11px] font-black uppercase tracking-[0.2em]">{t('restricted_area')}</span>
                    </div>
                    <h1 className="text-6xl md:text-7xl lg:text-8xl font-black uppercase leading-[0.9] tracking-tighter">
                        <span className="text-white">{t('panel_title_1')}<br /></span>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-violet-300 to-indigo-200">{t('panel_title_2').split('\n').map((line, i) => <React.Fragment key={i}>{line}{i < t('panel_title_2').split('\n').length - 1 && <br />}</React.Fragment>)}</span>
                    </h1>
                    <div className="flex items-center gap-3 mt-8">
                        <div className="h-px w-12 bg-white/20" />
                        <p className="text-white/60 text-sm font-semibold">{t('tagline')}</p>
                    </div>
                </div>

                <p className="relative z-10 text-white/30 text-[10px] font-bold uppercase tracking-widest">
                    © {new Date().getFullYear()} Magnetic Place Unipessoal Lda
                </p>
            </div>

            {/* ── LADO DIREITO — Formulário ── */}
            <div className="lg:w-2/5 flex items-center justify-center p-8 md:p-14 bg-white">
                <div className="w-full max-w-sm">
                    {/* Language switcher */}
                    <div className="flex justify-end mb-6">
                        <div className="flex rounded-xl overflow-hidden border border-slate-200 shadow-inner">
                            <button onClick={() => changeLang('pt')} title="Português" className={`flex items-center gap-1.5 px-3 py-2 transition-all ${lang === 'pt' ? 'bg-indigo-50' : 'bg-white opacity-50 hover:opacity-80'}`}>
                                <span className="inline-flex h-3.5 w-5 rounded-sm overflow-hidden flex-shrink-0 shadow-sm">
                                    <span className="w-2/5 bg-green-700" /><span className="w-3/5 bg-red-600" />
                                </span>
                                <span className="text-[9px] font-black text-slate-600">PT</span>
                            </button>
                            <button onClick={() => changeLang('es')} title="Español" className={`flex items-center gap-1.5 px-3 py-2 transition-all border-l border-slate-200 ${lang === 'es' ? 'bg-indigo-50' : 'bg-white opacity-50 hover:opacity-80'}`}>
                                <span className="inline-flex flex-col h-3.5 w-5 rounded-sm overflow-hidden flex-shrink-0 shadow-sm">
                                    <span className="flex-1 bg-red-600" /><span className="flex-[2] bg-yellow-400" /><span className="flex-1 bg-red-600" />
                                </span>
                                <span className="text-[9px] font-black text-slate-600">ES</span>
                            </button>
                        </div>
                    </div>

                    {/* Logo visível em todos os tamanhos no formulário */}
                    <div className="flex items-center gap-3 mb-8">
                        <img src={systemSettings?.companyLogo || 'MAGNETIC (3).png'} alt="Logo" className="h-10 w-auto object-contain" onError={e => e.target.style.display = 'none'} />
                        <div>
                            <p className="font-black text-slate-900 text-sm uppercase tracking-tight leading-none">Magnetic Place</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Unipessoal Lda</p>
                        </div>
                    </div>

                    <div className="mb-8">
                        <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-2">{t('welcome')}</p>
                        <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tighter leading-none">{t('sign_in_1')}<br />{t('sign_in_2')}</h2>
                        <p className="text-slate-400 text-sm font-medium mt-3 leading-relaxed">{t('sign_in_desc')}</p>
                    </div>

                    <form className="space-y-4" onSubmit={e => { e.preventDefault(); handleLogin(); }}>
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-2">Email</label>
                            <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder={t('email_placeholder')} autoComplete="email"
                                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 placeholder-slate-300 font-bold text-sm focus:outline-none focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-2">Senha (NIF)</label>
                            <input type="password" value={loginNif} onChange={e => setLoginNif(e.target.value)} placeholder="••••••••" autoComplete="current-password"
                                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 placeholder-slate-300 font-bold text-sm focus:outline-none focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all" />
                        </div>
                        {loginError && (
                            <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-rose-600 text-xs font-bold">
                                <AlertCircle size={14} className="flex-shrink-0" /> {loginError}
                            </div>
                        )}
                        <button type="submit" disabled={clients.length === 0}
                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm uppercase tracking-[0.15em] transition-all shadow-lg shadow-indigo-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                            {clients.length === 0 ? t('loading') : t('enter')}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
