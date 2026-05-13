import React, { useState, useRef, useEffect } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown, Type, AlignLeft, FileSignature, Code, X, ChevronRight } from 'lucide-react';
import { TEMPLATE_FIELDS } from '../../utils/templateFields';

const BLOCK_TYPES_CONFIG = [
  { type: 'title', label: 'Título', icon: Type, color: 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-100', shortLabel: '+ Título' },
  { type: 'subtitle', label: 'Subtítulo', icon: Type, color: 'bg-violet-50 text-violet-600 border-violet-100 hover:bg-violet-100', shortLabel: '+ Subtítulo' },
  { type: 'paragraph', label: 'Parágrafo', icon: AlignLeft, color: 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100', shortLabel: '+ Parágrafo' },
  { type: 'signature', label: 'Assinatura', icon: FileSignature, color: 'bg-amber-50 text-amber-600 border-amber-100 hover:bg-amber-100', shortLabel: '+ Assinatura' }
];

export function BlockEditor({ blocks, onChange, readOnly = false }) {
  const [expandedId, setExpandedId] = useState(null);
  const [showVariables, setShowVariables] = useState(true);
  const [searchVar, setSearchVar] = useState('');
  const blockRefs = useRef({});

  const updateBlock = (id, field, value) => {
    onChange(blocks.map(b => b.id === id ? { ...b, [field]: value } : b));
  };

  const addBlock = (type, afterIndex = -1) => {
    const newBlock = {
      id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      content: '',
      order: afterIndex >= 0 ? afterIndex + 1 : blocks.length
    };
    let newBlocks;
    if (afterIndex >= 0) {
      newBlocks = [...blocks];
      newBlocks.splice(afterIndex + 1, 0, newBlock);
      newBlocks = newBlocks.map((b, i) => ({ ...b, order: i }));
    } else {
      newBlocks = [...blocks, newBlock];
    }
    onChange(newBlocks);
    setExpandedId(newBlock.id);
    setTimeout(() => {
      if (blockRefs.current[newBlock.id]) {
        blockRefs.current[newBlock.id].focus();
      }
    }, 50);
  };

  const removeBlock = (id) => {
    onChange(blocks.filter(b => b.id !== id).map((b, i) => ({ ...b, order: i })));
    if (expandedId === id) setExpandedId(null);
  };

  const moveBlock = (id, direction) => {
    const index = blocks.findIndex(b => b.id === id);
    if (index === 0 && direction === -1) return;
    if (index === blocks.length - 1 && direction === 1) return;
    const newBlocks = [...blocks];
    const swapIndex = index + direction;
    [newBlocks[index], newBlocks[swapIndex]] = [newBlocks[swapIndex], newBlocks[index]];
    onChange(newBlocks.map((b, i) => ({ ...b, order: i })));
  };

  const insertVariable = (blockId, variable) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;
    const textarea = blockRefs.current[blockId];
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent = block.content.substring(0, start) + variable + block.content.substring(end);
      updateBlock(blockId, 'content', newContent);
      setTimeout(() => {
        const pos = start + variable.length;
        textarea.selectionStart = pos;
        textarea.selectionEnd = pos;
        textarea.focus();
      }, 0);
    } else {
      updateBlock(blockId, 'content', block.content + variable);
    }
  };

  const filteredVariables = TEMPLATE_FIELDS.filter(f =>
    f.label.toLowerCase().includes(searchVar.toLowerCase()) ||
    f.tag.toLowerCase().includes(searchVar.toLowerCase())
  );

  const getBlockIcon = (type) => {
    const config = BLOCK_TYPES_CONFIG.find(c => c.type === type);
    const Icon = config?.icon || AlignLeft;
    return <Icon size={14} />;
  };

  const getBlockColor = (type) => {
    const config = BLOCK_TYPES_CONFIG.find(c => c.type === type);
    return config?.color || 'bg-slate-50 text-slate-600';
  };

  return (
    <div className="flex h-full gap-0">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-2">Adicionar bloco:</span>
          {BLOCK_TYPES_CONFIG.map(config => {
            const Icon = config.icon;
            return (
              <button
                key={config.type}
                onClick={() => addBlock(config.type)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${config.color}`}
                disabled={readOnly}
              >
                <Icon size={12} />
                {config.shortLabel}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto pr-2">
          {blocks.length === 0 ? (
            <div className="text-center py-16 px-6 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <AlignLeft size={24} className="text-slate-400" />
              </div>
              <p className="text-sm font-bold text-slate-500 mb-1">Documento vazio</p>
              <p className="text-xs text-slate-400 mb-4">Clique nos botões acima para adicionar blocos</p>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {BLOCK_TYPES_CONFIG.map(config => {
                  const Icon = config.icon;
                  return (
                    <button
                      key={config.type}
                      onClick={() => addBlock(config.type)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${config.color}`}
                    >
                      <Icon size={12} />
                      {config.shortLabel}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {blocks.map((block, index) => (
                <div
                  key={block.id}
                  className={`group relative rounded-xl border transition-all ${
                    expandedId === block.id
                      ? 'border-indigo-200 bg-white shadow-md'
                      : 'border-transparent hover:border-slate-200 hover:bg-white'
                  }`}
                >
                  <div className="flex items-center gap-1 p-2">
                    {!readOnly && (
                      <button
                        onClick={() => moveBlock(block.id, -1)}
                        disabled={index === 0}
                        className="p-1 text-slate-300 hover:text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Mover para cima"
                      >
                        <ChevronUp size={14} />
                      </button>
                    )}

                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${getBlockColor(block.type)}`}>
                      {getBlockIcon(block.type)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        {BLOCK_TYPES_CONFIG.find(c => c.type === block.type)?.label || block.type}
                      </span>
                    </div>

                    {!readOnly && (
                      <>
                        <button
                          onClick={() => setExpandedId(expandedId === block.id ? null : block.id)}
                          className="px-2 py-1 text-[10px] font-bold text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                        >
                          {expandedId === block.id ? 'Fechar' : 'Editar'}
                        </button>

                        <button
                          onClick={() => moveBlock(block.id, 1)}
                          disabled={index === blocks.length - 1}
                          className="p-1 text-slate-300 hover:text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Mover para baixo"
                        >
                          <ChevronDown size={14} />
                        </button>

                        <button
                          onClick={() => removeBlock(block.id)}
                          className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          title="Remover"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>

                  {expandedId === block.id && !readOnly && (
                    <div className="px-3 pb-3 pt-1 border-t border-slate-100">
                      <textarea
                        ref={el => blockRefs.current[block.id] = el}
                        value={block.content}
                        onChange={(e) => updateBlock(block.id, 'content', e.target.value)}
                        placeholder={
                          block.type === 'title' ? 'Digite o título do documento...' :
                          block.type === 'subtitle' ? 'Digite o subtítulo...' :
                          block.type === 'paragraph' ? 'Digite o texto do parágrafo... Use {{variável}} para inserir dados do trabalhador.' :
                          block.type === 'signature' ? '' : ''
                        }
                        className={`w-full p-3 border border-slate-200 rounded-xl text-sm resize-none outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                          block.type === 'signature' ? 'h-24 bg-slate-50 cursor-not-allowed' : 'min-h-[100px]'
                        }`}
                        readOnly={block.type === 'signature'}
                      />
                      {block.type === 'paragraph' && (
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            onClick={() => setShowVariables(!showVariables)}
                            className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-all"
                          >
                            <Code size={12} />
                            Inserir Variável
                            <ChevronRight size={12} className={`transition-transform ${showVariables ? 'rotate-90' : ''}`} />
                          </button>
                          <span className="text-[10px] text-slate-400">
                            Variáveis disponíveis: {TEMPLATE_FIELDS.length}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {!readOnly && blocks.length > 0 && (
                <div className="flex items-center justify-center gap-2 py-4 mt-2">
                  {BLOCK_TYPES_CONFIG.map(config => {
                    const Icon = config.icon;
                    return (
                      <button
                        key={config.type}
                        onClick={() => addBlock(config.type)}
                        className={`flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${config.color}`}
                      >
                        <Icon size={12} />
                        {config.shortLabel}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showVariables && (
        <div className="w-64 border-l border-slate-200 pl-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-black text-slate-500 uppercase tracking-wider">Variáveis</span>
            <button
              onClick={() => setShowVariables(false)}
              className="p-1 text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          </div>

          <div className="mb-2">
            <input
              type="text"
              placeholder="Pesquisar..."
              value={searchVar}
              onChange={(e) => setSearchVar(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-1">
            {filteredVariables.map(field => (
              <button
                key={field.tag}
                onClick={() => expandedId && insertVariable(expandedId, field.tag)}
                className={`w-full text-left p-2 rounded-lg border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50 transition-all ${
                  expandedId ? 'cursor-pointer' : 'cursor-default opacity-50'
                }`}
                disabled={!expandedId}
                title={expandedId ? `Inserir ${field.label}` : 'Selecione um parágrafo primeiro'}
              >
                <p className="text-[10px] font-mono font-bold text-indigo-600">{field.tag}</p>
                <p className="text-[9px] text-slate-500 mt-0.5">{field.label}</p>
              </button>
            ))}
          </div>

          {!expandedId && (
            <div className="mt-2 p-2 bg-amber-50 rounded-lg border border-amber-100">
              <p className="text-[9px] font-bold text-amber-700">
                Clique num parágrafo para inserir variáveis
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
