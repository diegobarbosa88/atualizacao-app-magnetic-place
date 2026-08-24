import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Building2, CheckCircle, Loader2 } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { SCALE } from '../../../styles/designTokens';

export default function FaturaConfigPanel() {
  const { systemSettings, setSystemSettings, saveSystemSettings } = useApp();
  const [aberto, setAberto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  const [form, setForm] = useState({
    companyName: systemSettings?.companyName || '',
    companyNif: systemSettings?.companyNif || '',
    companyAddress: systemSettings?.companyAddress || '',
    companyEmail: systemSettings?.companyEmail || '',
    companyPhone: systemSettings?.companyPhone || '',
  });

  const handleAbrir = () => {
    if (!aberto) {
      setForm({
        companyName: systemSettings?.companyName || '',
        companyNif: systemSettings?.companyNif || '',
        companyAddress: systemSettings?.companyAddress || '',
        companyEmail: systemSettings?.companyEmail || '',
        companyPhone: systemSettings?.companyPhone || '',
      });
    }
    setAberto(v => !v);
    setGuardado(false);
  };

  const handleGuardar = async () => {
    setGuardando(true);
    try {
      const novas = { ...systemSettings, ...form };
      setSystemSettings(novas);
      await saveSystemSettings(novas);
      setGuardado(true);
      setTimeout(() => setGuardado(false), 2500);
    } finally {
      setGuardando(false);
    }
  };

  const temAlteracao =
    form.companyName !== (systemSettings?.companyName || '') ||
    form.companyNif !== (systemSettings?.companyNif || '') ||
    form.companyAddress !== (systemSettings?.companyAddress || '') ||
    form.companyEmail !== (systemSettings?.companyEmail || '') ||
    form.companyPhone !== (systemSettings?.companyPhone || '');

  const Field = ({ label, field, placeholder, type = 'text' }) => (
    <div className="space-y-1">
      <p className={`${SCALE.text.statLabel} text-[var(--slate-dim)]`}>{label}</p>
      <input
        type={type}
        value={form[field]}
        onChange={e => setForm(prev => ({ ...prev, [field]: e.target.value }))}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--ink-mid)] focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
      />
    </div>
  );

  return (
    <div className="bg-white rounded-[2rem] border border-[var(--border-soft)] shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 size={16} className="text-indigo-500" />
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-[var(--slate-dim)] mb-0.5">Dados da Empresa</p>
            <p className="text-xs text-[var(--slate-dim)]">
              {systemSettings?.companyName || 'Nome não definido'}
              {systemSettings?.companyNif ? <span className="ml-2 text-[var(--slate-dim)]">· NIF {systemSettings.companyNif}</span> : null}
            </p>
          </div>
        </div>
        <button
          onClick={handleAbrir}
          className="flex items-center gap-1 px-3 py-2 text-xs font-black uppercase tracking-widest text-[var(--slate-dim)] hover:text-indigo-600 transition-colors"
        >
          {aberto ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Configurar
        </button>
      </div>

      {aberto && (
        <div className="border-t border-[var(--border-soft)] pt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nome da Empresa" field="companyName" placeholder="Magnetic Place, Lda." />
            <Field label="NIF" field="companyNif" placeholder="500 000 000" />
            <div className="sm:col-span-2">
              <Field label="Morada" field="companyAddress" placeholder="Rua Exemplo, nº 1, 1000-001 Lisboa" />
            </div>
            <Field label="Email" field="companyEmail" placeholder="geral@empresa.pt" type="email" />
            <Field label="Telefone" field="companyPhone" placeholder="+351 210 000 000" />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleGuardar}
              disabled={guardando || !temAlteracao}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-[var(--orange)] text-[var(--navy-solid)] rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[var(--orange-hover)] transition-all disabled:opacity-50"
            >
              {guardando ? <Loader2 size={13} className="animate-spin" /> : guardado ? <CheckCircle size={13} /> : null}
              {guardado ? 'Guardado' : 'Guardar'}
            </button>
            {guardado && <span className="text-xs text-emerald-600 font-semibold">Dados atualizados</span>}
          </div>
        </div>
      )}
    </div>
  );
}
