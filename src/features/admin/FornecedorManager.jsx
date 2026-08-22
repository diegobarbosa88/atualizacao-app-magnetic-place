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
              className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
              title="Actualizar"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={novoFornecedor}
              className="flex items-center gap-2 px-4 py-2.5 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-colors" style={{ backgroundColor: '#EB8D00' }}
            >
              <Plus size={14} />
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
        accent="slate"
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
