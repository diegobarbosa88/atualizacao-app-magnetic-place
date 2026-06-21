import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const FornecedorContext = createContext();

export const INITIAL_FORNECEDOR_FORM = {
  id: null, nome: '', nif: '', email: '', telefone: '', morada: '',
  iban: '', swift: '', website: '', notas: '', status: 'ativo', debito_automatico: false,
};

export function FornecedorProvider({ children }) {
  const [fornecedores, setFornecedores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(INITIAL_FORNECEDOR_FORM);
  const [editingId, setEditingId] = useState(null);
  const [isAdding, setIsAdding] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/pagamentos?action=listar-fornecedores');
      const json = await res.json();
      setFornecedores(json.data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const guardar = useCallback(async () => {
    if (!form.nome.trim()) return alert('Nome do fornecedor é obrigatório');
    setSaving(true);
    try {
      const res = await fetch('/api/pagamentos?action=guardar-fornecedor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, id: editingId }),
      });
      const json = await res.json();
      if (json.error) { alert('Erro: ' + json.error); return; }
      await carregar();
      setForm(INITIAL_FORNECEDOR_FORM);
      setEditingId(null);
      setIsAdding(false);
    } finally {
      setSaving(false);
    }
  }, [form, editingId, carregar]);

  const apagar = useCallback(async (id) => {
    const res = await fetch('/api/pagamentos?action=apagar-fornecedor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    const json = await res.json();
    if (json.error) { alert('Erro: ' + json.error); return; }
    await carregar();
  }, [carregar]);

  const editarFornecedor = useCallback((f) => {
    setForm({ ...INITIAL_FORNECEDOR_FORM, ...f });
    setEditingId(f.id);
    setIsAdding(true);
  }, []);

  const novoFornecedor = useCallback(() => {
    setForm(INITIAL_FORNECEDOR_FORM);
    setEditingId(null);
    setIsAdding(true);
  }, []);

  const cancelar = useCallback(() => {
    setForm(INITIAL_FORNECEDOR_FORM);
    setEditingId(null);
    setIsAdding(false);
  }, []);

  return (
    <FornecedorContext.Provider value={{
      fornecedores, loading, saving, form, setForm,
      editingId, isAdding,
      carregar, guardar, apagar, editarFornecedor, novoFornecedor, cancelar,
    }}>
      {children}
    </FornecedorContext.Provider>
  );
}

export function useFornecedor() {
  const ctx = useContext(FornecedorContext);
  if (!ctx) throw new Error('useFornecedor must be used inside FornecedorProvider');
  return ctx;
}
