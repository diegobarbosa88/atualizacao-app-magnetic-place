import React from 'react';
import { Truck, Plus, RefreshCw } from 'lucide-react';
import { FornecedorProvider, useFornecedor } from './contexts/FornecedorContext';
import FornecedorForm from './fornecedores/FornecedorForm';
import FornecedorList from './fornecedores/FornecedorList';

function FornecedorManagerContent() {
  const { fornecedores, loading, isAdding, novoFornecedor, carregar } = useFornecedor();

  const ativos = fornecedores.filter(f => f.status === 'ativo').length;

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-50 p-2.5 rounded-xl text-indigo-600">
            <Truck size={20} />
          </div>
          <div>
            <h2 className="font-black text-lg text-slate-800 uppercase tracking-tight">Fornecedores</h2>
            <p className="text-[10px] text-slate-400">
              {loading ? 'A carregar...' : `${fornecedores.length} registado${fornecedores.length !== 1 ? 's' : ''} • ${ativos} ativo${ativos !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={carregar}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            title="Actualizar"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          {!isAdding && (
            <button
              onClick={novoFornecedor}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-colors"
            >
              <Plus size={14} />
              Novo Fornecedor
            </button>
          )}
        </div>
      </div>

      {/* Form (collapsa quando não está em edição) */}
      {isAdding && <FornecedorForm />}

      {/* Lista */}
      <FornecedorList />
    </div>
  );
}

export default function FornecedorManager() {
  return (
    <FornecedorProvider>
      <FornecedorManagerContent />
    </FornecedorProvider>
  );
}
