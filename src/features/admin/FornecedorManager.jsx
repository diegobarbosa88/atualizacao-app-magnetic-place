import React from 'react';
import { Truck, Plus, RefreshCw } from 'lucide-react';
import { FornecedorProvider, useFornecedor } from './contexts/FornecedorContext';
import FornecedorForm from './fornecedores/FornecedorForm';
import FornecedorList from './fornecedores/FornecedorList';
import ModalShell from '../../components/common/ModalShell';
import SectionHeaderShell from '../../components/common/SectionHeaderShell';

function FornecedorManagerContent() {
  const { fornecedores, loading, isAdding, editingId, novoFornecedor, cancelar, carregar } = useFornecedor();

  const ativos = fornecedores.filter(f => f.status === 'ativo').length;

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <SectionHeaderShell
        icon={<Truck size={18} />}
        title="Fornecedores"
        subtitle={loading ? 'A carregar...' : `${fornecedores.length} registado${fornecedores.length !== 1 ? 's' : ''} • ${ativos} ativo${ativos !== 1 ? 's' : ''}`}
        rightSlot={(
          <div className="flex items-center gap-2">
            <button
              onClick={carregar}
              disabled={loading}
              className="p-2 text-slate-400 hover:text-[#1B3A57] hover:bg-slate-100 rounded-lg transition-colors"
              title="Actualizar"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={novoFornecedor}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-wide transition-colors shadow-sm"
              style={{ backgroundColor: '#EB8D00', color: '#12293e' }}
            >
              <Plus size={13} />
              Novo Fornecedor
            </button>
          </div>
        )}
      />

      <ModalShell
        isOpen={isAdding}
        onClose={cancelar}
        title={editingId ? 'Editar Fornecedor' : 'Novo Fornecedor'}
        icon={<Truck size={16} />}
        accent="default"
        size="xl"
      >
        <FornecedorForm />
      </ModalShell>

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
