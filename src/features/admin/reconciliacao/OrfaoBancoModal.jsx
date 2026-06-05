import React, { useState } from 'react';
import { Tag, Plus, X, CheckCircle, Loader2 } from 'lucide-react';

const COR_MAP = {
  violet:  { bg: 'bg-violet-100',  text: 'text-violet-700',  ring: 'ring-violet-400',  dot: 'bg-violet-500'  },
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-700', ring: 'ring-emerald-400', dot: 'bg-emerald-500' },
  blue:    { bg: 'bg-blue-100',    text: 'text-blue-700',    ring: 'ring-blue-400',    dot: 'bg-blue-500'    },
  orange:  { bg: 'bg-orange-100',  text: 'text-orange-700',  ring: 'ring-orange-400',  dot: 'bg-orange-500'  },
  slate:   { bg: 'bg-slate-100',   text: 'text-slate-600',   ring: 'ring-slate-400',   dot: 'bg-slate-500'   },
  rose:    { bg: 'bg-rose-100',    text: 'text-rose-700',    ring: 'ring-rose-400',    dot: 'bg-rose-500'    },
  amber:   { bg: 'bg-amber-100',   text: 'text-amber-700',   ring: 'ring-amber-400',   dot: 'bg-amber-500'   },
  indigo:  { bg: 'bg-indigo-100',  text: 'text-indigo-700',  ring: 'ring-indigo-400',  dot: 'bg-indigo-500'  },
  cyan:    { bg: 'bg-cyan-100',    text: 'text-cyan-700',    ring: 'ring-cyan-400',    dot: 'bg-cyan-500'    },
  gray:    { bg: 'bg-gray-100',    text: 'text-gray-600',    ring: 'ring-gray-400',    dot: 'bg-gray-400'    },
};
const CORES_DISPONIVEIS = ['indigo', 'violet', 'emerald', 'blue', 'cyan', 'orange', 'amber', 'rose', 'slate', 'gray'];

export default function OrfaoBancoModal({ indices, tags: initialTags, onCreateTag, onClose, onSave }) {
  const [tags, setTags] = useState(initialTags);
  const [selectedTag, setSelectedTag] = useState(null);
  const [orphanObs, setOrphanObs] = useState('');
  const [showNovaTag, setShowNovaTag] = useState(false);
  const [novaTagNome, setNovaTagNome] = useState('');
  const [novaTagCor, setNovaTagCor] = useState('indigo');
  const [savingTag, setSavingTag] = useState(false);

  const criarTag = async () => {
    if (!novaTagNome.trim()) return;
    setSavingTag(true);
    try {
      const newTag = await onCreateTag(novaTagNome.trim(), novaTagCor);
      if (newTag) {
        setTags(prev => [...prev, newTag]);
        setSelectedTag(newTag);
      }
      setShowNovaTag(false);
      setNovaTagNome('');
      setNovaTagCor('indigo');
    } finally {
      setSavingTag(false);
    }
  };

  const handleConfirmar = () => {
    onSave({ tag: selectedTag, obs: orphanObs });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
        <div>
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            Confirmar Movimento
            {indices.length > 1 && ` (${indices.length} movimentos)`}
          </h3>
          <p className="text-sm text-slate-500 mt-1">Classifique e/ou adicione uma observação para este movimento.</p>
        </div>

        {/* Classificação */}
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
            <Tag size={10} /> Classificação
          </label>
          <div className="flex flex-wrap gap-2">
            {tags.map(tag => {
              const c = COR_MAP[tag.cor] || COR_MAP.gray;
              const isSelected = selectedTag?.id === tag.id;
              return (
                <button
                  key={tag.id}
                  onClick={() => setSelectedTag(isSelected ? null : tag)}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ring-2 transition-all ${
                    isSelected
                      ? `${c.bg} ${c.text} ${c.ring}`
                      : 'bg-slate-100 text-slate-500 ring-transparent hover:ring-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {tag.nome}
                </button>
              );
            })}

            {/* Criar nova tag */}
            {showNovaTag ? (
              <div className="flex items-center gap-2 w-full mt-1 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <input
                  autoFocus
                  value={novaTagNome}
                  onChange={e => setNovaTagNome(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') criarTag();
                    if (e.key === 'Escape') { setShowNovaTag(false); setNovaTagNome(''); }
                  }}
                  placeholder="Nome da classificação..."
                  className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
                <div className="flex items-center gap-1">
                  {CORES_DISPONIVEIS.map(cor => (
                    <button
                      key={cor}
                      onClick={() => setNovaTagCor(cor)}
                      title={cor}
                      className={`w-5 h-5 rounded-full ${COR_MAP[cor].dot} transition-all ${
                        novaTagCor === cor ? 'ring-2 ring-offset-1 ring-slate-500 scale-110' : 'opacity-60 hover:opacity-100'
                      }`}
                    />
                  ))}
                </div>
                <button
                  onClick={criarTag}
                  disabled={!novaTagNome.trim() || savingTag}
                  className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40 hover:bg-indigo-700 transition-all"
                >
                  {savingTag ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle size={10} />} Criar
                </button>
                <button onClick={() => { setShowNovaTag(false); setNovaTagNome(''); }} className="text-slate-400 hover:text-slate-600">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowNovaTag(true)}
                className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-dashed border-slate-300 text-slate-400 hover:border-indigo-400 hover:text-indigo-600 transition-all flex items-center gap-1"
              >
                <Plus size={10} /> Nova
              </button>
            )}
          </div>
        </div>

        {/* Observação */}
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Observação {!selectedTag && <span className="text-rose-400">*</span>}
          </label>
          <textarea
            value={orphanObs}
            onChange={e => setOrphanObs(e.target.value)}
            placeholder="Ex: Pagamento de fornecedor por transferência direta, fatura pendente de envio..."
            rows={3}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          {!selectedTag && !orphanObs.trim() && (
            <p className="text-[10px] text-slate-400">Seleccione uma classificação ou escreva uma observação.</p>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={handleConfirmar}
            disabled={!selectedTag && !orphanObs.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all text-[10px] font-black uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <CheckCircle size={12} /> Confirmar
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-500 hover:text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
