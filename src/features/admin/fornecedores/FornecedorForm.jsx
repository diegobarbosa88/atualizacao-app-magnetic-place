import React from 'react';
import { Building2, CreditCard, FileText, Loader2, X, Save, Truck } from 'lucide-react';
import { useFornecedor } from '../contexts/FornecedorContext';

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</label>
      {children}
    </div>
  );
}

const inputCls = 'border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all w-full bg-white';

export default function FornecedorForm() {
  const { form, setForm, saving, guardar, cancelar, editingId } = useFornecedor();

  const f = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));
  const tog = (field) => () => setForm(prev => ({ ...prev, [field]: !prev[field] }));

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600">
            <Truck size={16} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {editingId ? 'Editar Fornecedor' : 'Novo Fornecedor'}
            </p>
            <p className="text-sm font-black text-slate-700">{form.nome || '—'}</p>
          </div>
        </div>
        <button onClick={cancelar} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* Secção 1 — Dados da Empresa */}
      <div className="bg-slate-50/60 p-4 rounded-2xl border border-slate-100 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Building2 size={12} className="text-slate-500" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Dados da Empresa</span>
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
      <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-100 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <CreditCard size={12} className="text-emerald-600" />
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Dados Bancários</span>
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
        <div className="flex items-center justify-between p-3 bg-violet-50 rounded-xl border border-violet-100">
          <div>
            <p className="text-xs font-black text-violet-800">Débito Automático</p>
            <p className="text-[10px] text-violet-500 mt-0.5">As faturas deste fornecedor são pagas por débito direto — excluídas da Fila de Pagamentos</p>
          </div>
          <button
            onClick={tog('debito_automatico')}
            className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ml-3 ${form.debito_automatico ? 'bg-violet-600' : 'bg-slate-200'}`}
          >
            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${form.debito_automatico ? 'left-7' : 'left-1'}`} />
          </button>
        </div>
      </div>

      {/* Secção 3 — Notas */}
      <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-100">
        <div className="flex items-center gap-2 mb-2">
          <FileText size={12} className="text-amber-600" />
          <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">Notas</span>
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
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-colors"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? 'A guardar...' : 'Guardar Fornecedor'}
        </button>
        <button
          onClick={cancelar}
          className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
