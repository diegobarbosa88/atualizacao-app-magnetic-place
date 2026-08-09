import React from 'react';
import { PROFISSOES_EMPRESA, GRUPOS_PROFISSOES } from '../data/profissoesEmpresa';

/**
 * Dropdown agrupado com as profissões da empresa.
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

  const isEmpty = !value;

  return (
    <select
      value={value || ''}
      onChange={handleChange}
      className={className}
      style={isEmpty ? { color: 'rgb(203 213 225)', fontWeight: '400' } : undefined}
    >
      <option value="">{placeholder}</option>
      {GRUPOS_PROFISSOES.map(grupo => (
        <optgroup key={grupo} label={grupo}>
          {PROFISSOES_EMPRESA
            .filter(p => p.grupo === grupo)
            .map(p => (
              <option key={p.codigoCPP} value={p.codigoCPP}>
                {p.rotulo}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  );
}
