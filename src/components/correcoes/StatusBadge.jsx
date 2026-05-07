import React from 'react';

const StatusBadge = ({ type, status }) => {
  const getColors = () => {
    switch (type) {
      case 'quick':
        return { bg: 'bg-indigo-100', text: 'text-indigo-600', border: 'border-indigo-200', label: 'Rápido' };
      case 'precision':
        return { bg: 'bg-amber-100', text: 'text-amber-600', border: 'border-amber-200', label: 'Precisão' };
      default:
        return { bg: 'bg-slate-100', text: 'text-slate-500', border: 'border-slate-200', label: type };
    }
  };

  const colors = getColors();

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${colors.bg} ${colors.text} ${colors.border} border`}>
      {colors.label}
    </span>
  );
};

export default StatusBadge;