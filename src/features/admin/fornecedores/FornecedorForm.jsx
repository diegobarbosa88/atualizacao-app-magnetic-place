import React from 'react';
import { Building2, CreditCard, FileText, Loader2, Save } from 'lucide-react';
import { useFornecedor } from '../contexts/FornecedorContext';
import { FT } from '../../../styles/designTokens';

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-black uppercase tracking-widest text-[var(--slate-dim)]">{label}</label>
      {children}
    </div>
  );
}

const inputCls = 'border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm font-bold text-[var(--ink-mid)] outline-none focus:border-[var(--navy)] focus:ring-2 focus:ring-[#1B3A57]/10 transition-all w-full bg-white';

export default function FornecedorForm() {
  const { form, setForm, saving, guardar, cancelar } = useFornecedor();

  const f = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));
  const tog = (field) => () => setForm(prev => ({ ...prev, [field]: !prev[field] }));

  return (
    <div className="p-6 space-y-5">
      {/* Secção 1 — Dados da Empresa */}
      <div className="bg-[var(--surface)] p-4 rounded-2xl border border-[var(--border-soft)] space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Building2 size={12} className="text-[var(--slate-dim)]" />
          <span className="text-[10px] font-black tracking-widest text-[var(--slate-dim)]">Dados da empresa</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <Field label="Nome *">
              <input value={form.nome} onChange={f('nome')} className={inputCls} placeholder="Nome da empresa" />
            </Field>
          </div>
          <Field label="NIF / NIPC">
            <input value={form.nif} onChange={f('nif')} className={inputCls} placeholder="123456789" />
          </Field>
          <Field label="Email">
            <input type="email" value={form.email} onChange={f('email')} className={inputCls} placeholder="geral@empresa.pt" />
          </Field>
          <Field label="Telefone">
            <input value={form.telefone} onChange={f('telefone')} className={inputCls} placeholder="+351 200 000 000" />
          </Field>
          <Field label="Website">
            <input value={form.website} onChange={f('website')} className={inputCls} placeholder="https://empresa.pt" />
          </Field>
          <div className="md:col-span-2">
            <Field label="Morada">
              <textarea value={form.morada} onChange={f('morada')} className={inputCls + ' resize-none'} rows={2} placeholder="Rua, nº, cidade, código postal" />
            </Field>
          </div>
        </div>
      </div>

      {/* Secção 2 — Dados Bancários */}
      <div className="bg-[var(--surface)] p-4 rounded-2xl border border-[var(--border-soft)] space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <CreditCard size={12} className="text-[var(--slate-dim)]" />
          <span className="text-[10px] font-black tracking-widest text-[var(--slate-dim)]">Dados bancários</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <Field label="IBAN">
              <input
                value={form.iban}
                onChange={(e) => setForm(prev => ({ ...prev, iban: e.target.value.replace(/\s/g, '').toUpperCase() }))}
                className={inputCls + ' font-mono'}
                placeholder="PT50000000000000000000000"
              />
            </Field>
          </div>
          <Field label="SWIFT / BIC">
            <input value={form.swift} onChange={f('swift')} className={inputCls + ' font-mono'} placeholder="BPIPPTPL" />
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={f('status')} className={inputCls}>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
          </Field>
        </div>

        {/* Débito Automático toggle */}
        <div className="flex items-center justify-between p-3 bg-[var(--surface)] rounded-xl border border-[var(--border-soft)]">
          <div>
            <p className="text-xs font-black text-[var(--ink-mid)]">Débito automático</p>
            <p className="text-[10px] text-[var(--slate-dim)] mt-0.5">As faturas deste fornecedor são pagas por débito direto — excluídas da Fila de Pagamentos</p>
          </div>
          <button
            onClick={tog('debito_automatico')}
            className="relative w-12 h-6 rounded-full transition-colors shrink-0 ml-3"
            style={{ backgroundColor: form.debito_automatico ? FT.navy : '#CBD5E1' }}
          >
            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${form.debito_automatico ? 'left-7' : 'left-1'}`} />
          </button>
        </div>
      </div>

      {/* Secção 3 — Notas */}
      <div className="bg-[var(--surface)] p-4 rounded-2xl border border-[var(--border-soft)]">
        <div className="flex items-center gap-2 mb-2">
          <FileText size={12} className="text-[var(--slate-dim)]" />
          <span className="text-[10px] font-black tracking-widest text-[var(--slate-dim)]">Notas</span>
        </div>
        <textarea
          value={form.notas}
          onChange={f('notas')}
          className={inputCls + ' resize-none'}
          rows={2}
          placeholder="Observações sobre este fornecedor..."
        />
      </div>

      {/* Botões */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={guardar}
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-colors disabled:opacity-60"
          style={{ backgroundColor: FT.orange, color: FT.navy }}
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? 'A guardar...' : 'Guardar Fornecedor'}
        </button>
        <button
          onClick={cancelar}
          className="px-6 py-3 bg-[var(--surface-dim)] hover:bg-[var(--border)] text-[var(--ink-soft)] rounded-xl text-xs font-black uppercase tracking-widest transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
