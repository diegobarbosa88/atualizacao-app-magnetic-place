import React from 'react';
import { isKnownField } from '../../../utils/docxTemplateService';

export default function FieldBadge({ name }) {
  const known = isKnownField(name);
  return (
    <span
      className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold tracking-tight ${
        known
          ? 'bg-slate-100 text-[#1B3A57] border border-slate-200'
          : 'bg-amber-50 text-amber-700 border border-amber-100'
      }`}
      title={known ? 'Variável reconhecida' : 'Variável não reconhecida — não será preenchida automaticamente'}
    >
      {name}
    </span>
  );
}
