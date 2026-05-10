import React from 'react';

const ValidationStamp = ({ signature, datetime, ip, id }) => {
  const dateStr = datetime ? new Date(datetime).toLocaleString('pt-PT') : '';
  const idStr = id ? String(id).substring(0, 16) + '...' : '';
  const ipStr = ip || 'N/D';
  const rowStyle = { fontSize: '6.5px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', justifyContent: 'space-between', gap: '12px', margin: 0 };
  const valueStyle = { color: '#0f172a', fontWeight: 900 };

  return (
    <div style={{
      backgroundColor: '#f8fafc',
      border: '2px solid #e0e7ff',
      borderRadius: '14px',
      padding: '10px 14px',
      position: 'relative',
      overflow: 'hidden',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '14px',
      boxSizing: 'border-box',
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
    }}>
      <div style={{ position: 'absolute', top: 0, right: 0, padding: '4px', opacity: 0.05 }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      </div>

      <div style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        width: '130px',
        height: '52px',
        padding: '4px',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        {signature ? (
          <img src={signature} alt="Assinatura" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
        ) : (
          <span style={{ color: '#94a3b8', fontSize: '7px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Aguardando</span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#4f46e5', fontWeight: 900, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>
          <span style={{ backgroundColor: '#4f46e5', color: '#ffffff', padding: '2px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '12px', height: '12px', boxSizing: 'border-box' }}>
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', height: '12px', lineHeight: 1 }}>VALIDAÇÃO DIGITAL</span>
        </div>

        <p style={rowStyle}>
          <span>Data/Hora:</span>
          <span style={valueStyle}>{dateStr}</span>
        </p>
        <p style={{ ...rowStyle, marginTop: '3px' }}>
          <span>Endereço IP:</span>
          <span style={valueStyle}>{ipStr}</span>
        </p>
        <p style={{ ...rowStyle, marginTop: '4px', paddingTop: '3px', borderTop: '1px solid #f1f5f9', color: '#94a3b8' }}>
          <span>ID:</span>
          <span style={{ fontFamily: 'monospace', color: '#94a3b8' }}>{idStr}</span>
        </p>
        <p style={{ fontSize: '5px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.2em', margin: '4px 0 0 0' }}>
          DOCUMENTO VALIDADO ELETRONICAMENTE
        </p>
      </div>
    </div>
  );
};

export default ValidationStamp;
