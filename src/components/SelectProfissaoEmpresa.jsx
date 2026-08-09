import React from 'react';
import { PROFISSOES_EMPRESA } from '../data/profissoesEmpresa';

/**
 * Dropdown simples com as profissões da empresa.
 *
 * Props:
 *   value      — codigoCPP actualmente seleccionado (string)
 *   onChange   — (codigoCPP: string, rotulo: string) => void
 *   className  — classe CSS do <select>
 *   placeholder — texto da opção vazia (por omissão "— Selecionar profissão —")
 */
export default function SelectProfissaoEmpresa({
  value,
  onChange,
  className,
  placeholder = '— Selecionar profissão —',
}) {
  const handleChange = (e) => {
    const codigo = e.target.value;
    const found  = PROFISSOES_EMPRESA.find(p => p.codigoCPP === codigo);
    onChange(found ? found.codigoCPP : '', found ? found.rotulo : '');
  };

  return (
    <select value={value || ''} onChange={handleChange} className={className}>
      <option value="">{placeholder}</option>
      {PROFISSOES_EMPRESA.map(p => (
        <option key={p.codigoCPP} value={p.codigoCPP}>
          {p.rotulo}
        </option>
      ))}
    </select>
  );
}
