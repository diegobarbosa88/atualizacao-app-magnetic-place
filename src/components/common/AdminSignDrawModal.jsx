import React, { useState, useEffect, useRef } from 'react';
import { X, CheckCircle } from 'lucide-react';

export default function AdminSignDrawModal({ onClose, onSign, userName }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const setup = () => {
      const parent = c.parentElement;
      if (!parent) return;
      const ratio = window.devicePixelRatio || 1;
      const cssW = parent.clientWidth;
      const cssH = parent.clientHeight;
      c.width = cssW * ratio;
      c.height = cssH * ratio;
      c.style.width = cssW + 'px';
      c.style.height = cssH + 'px';
      const ctx = c.getContext('2d');
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#1e293b';
    };
    setup();
    window.addEventListener('resize', setup);
    return () => window.removeEventListener('resize', setup);
  }, []);

  const pos = (e) => {
    const c = canvasRef.current;
    const r = c.getBoundingClientRect();
    const src = e.touches?.[0] || e;
    return { x: src.clientX - r.left, y: src.clientY - r.top };
  };

  const start = (e) => {
    e.preventDefault();
    drawing.current = true;
    const { x, y } = pos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const { x, y } = pos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasInk(true);
  };
  const stop = (e) => {
    if (!drawing.current) return;
    e?.preventDefault?.();
    drawing.current = false;
    canvasRef.current?.getContext('2d')?.closePath();
  };
  const clear = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    const ratio = window.devicePixelRatio || 1;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1e293b';
    setHasInk(false);
  };
  const submit = () => {
    if (!hasInk) { setError('Por favor, assine antes de confirmar.'); return; }
    setError('');
    onSign(canvasRef.current.toDataURL('image/png'));
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[210] flex items-stretch sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-[2rem] p-4 sm:p-6 shadow-2xl flex flex-col h-full sm:h-auto sm:max-h-[90vh]">
        <div className="flex justify-between items-center mb-3 flex-shrink-0">
          <h2 className="text-lg sm:text-xl font-black text-slate-800">Assinatura da Empresa</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        {userName && (
          <p className="text-xs text-slate-500 mb-3 flex-shrink-0">
            <span className="font-bold text-slate-700">{userName}</span> — desenhe a assinatura digital abaixo.
          </p>
        )}
        <div className="mb-3 bg-white border-2 border-slate-200 rounded-2xl flex-1 sm:flex-none relative" style={{ minHeight: '200px', height: 'auto', touchAction: 'none' }}>
          <canvas ref={canvasRef} className="w-full h-full cursor-crosshair block rounded-2xl" style={{ touchAction: 'none', height: '100%' }} onMouseDown={start} onMouseMove={move} onMouseUp={stop} onMouseLeave={stop} onTouchStart={start} onTouchMove={move} onTouchEnd={stop} onTouchCancel={stop} />
          {!hasInk && <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-slate-300 font-bold text-xs uppercase tracking-widest">Assine aqui</div>}
        </div>
        {error && <div className="mb-3 p-3 bg-rose-50 text-rose-600 text-sm font-bold rounded-xl flex-shrink-0">{error}</div>}
        <div className="flex flex-col sm:flex-row sm:justify-between gap-2 flex-shrink-0">
          <button onClick={clear} className="px-4 py-3 sm:py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-sm border border-slate-200 sm:border-0 font-bold">Limpar</button>
          <div className="flex flex-col sm:flex-row gap-2">
            <button onClick={onClose} className="px-4 py-3 sm:py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold">Cancelar</button>
            <button onClick={submit} disabled={!hasInk} className="px-6 py-3 sm:py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
              <CheckCircle className="w-4 h-4" /> Confirmar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
