import React from 'react';

const StatusBadge = ({ type, status }) => {
  const getColors = () => {
    switch (type) {
      case 'quick':
        return { bg: 'rgba(129, 140, 248, 0.2)', text: '#a5b4fc', border: 'rgba(129, 140, 248, 0.4)', label: 'Rápido' };
      case 'precision':
        return { bg: 'rgba(34, 211, 238, 0.2)', text: '#67e8f9', border: 'rgba(34, 211, 238, 0.4)', label: 'Precisão' };
      default:
        return { bg: 'rgba(148, 163, 184, 0.1)', text: '#94a3b8', border: 'rgba(148, 163, 184, 0.2)', label: type };
    }
  };

  const colors = getColors();

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '4px 10px',
      borderRadius: '20px',
      fontSize: '11px',
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      backgroundColor: colors.bg,
      color: colors.text,
      border: `1px solid ${colors.border}`,
      boxShadow: `0 0 10px ${colors.bg}`
    }}>
      {colors.label}
    </span>
  );
};

export default StatusBadge;
