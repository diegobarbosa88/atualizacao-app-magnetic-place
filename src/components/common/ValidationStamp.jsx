import React from 'react';

const STAMP_WIDTH = 280;
const STAMP_HEIGHT = 100;

const ValidationStamp = ({ signature, datetime, ip, id }) => {
  const dateStr = datetime ? new Date(datetime).toLocaleString('pt-PT') : '';
  const idStr = id ? String(id).substring(0, 16) + '...' : '';
  const ipStr = ip || 'N/D';

  return (
    <div style={{
      backgroundColor: '#f8fafc',
      border: '2px solid #e0e7ff',
      borderRadius: '16px',
      padding: '16px',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      width: `${STAMP_WIDTH}px`,
      minHeight: `${STAMP_HEIGHT}px`,
      boxSizing: 'border-box',
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    }}>
      <div style={{ position: 'absolute', top: 0, right: 0, padding: '4px', opacity: 0.08 }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      </div>

      <div style={{
        backgroundColor: '#ffffff',
        border: '1px solid #f1f5f9',
        borderRadius: '8px',
        padding: '6px',
        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.06)',
        flexShrink: 0,
      }}>
        {signature ? (
          <img src={signature} alt="Assinatura" style={{ height: '48px', width: 'auto', display: 'block', mixBlendMode: 'multiply' }} />
        ) : (
          <div style={{ width: '80px', height: '48px', border: '1px dashed #cbd5e1', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#94a3b8', fontSize: '7px', fontWeight: 800, textTransform: 'uppercase' }}>Aguardando</span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#4f46e5', fontWeight: 900, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>
          <span style={{ backgroundColor: '#4f46e5', color: '#ffffff', padding: '2px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
          VALIDAÇÃO DIGITAL
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={{ fontSize: '6.5px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', justifyContent: 'space-between', gap: '8px', paddingBottom: '2px', borderBottom: '1px solid #f1f5f9' }}>
            <span>Data/Hora:</span>
            <span style={{ fontWeight: 800, fontFamily: 'monospace', color: '#0f172a' }}>{dateStr}</span>
          </div>
          <div style={{ fontSize: '6.5px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', justifyContent: 'space-between', gap: '8px', paddingBottom: '2px', borderBottom: '1px solid #f1f5f9' }}>
            <span>Endereço IP:</span>
            <span style={{ fontWeight: 800, fontFamily: 'monospace', color: '#0f172a' }}>{ipStr}</span>
          </div>
          <div style={{ fontSize: '6.5px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', justifyContent: 'space-between', gap: '8px', paddingTop: '2px', borderTop: '1px solid #f1f5f9' }}>
            <span>ID:</span>
            <span style={{ fontWeight: 800, fontFamily: 'monospace', color: '#94a3b8' }}>{idStr}</span>
          </div>
          <div style={{ fontSize: '5px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '6px', paddingTop: '4px', borderTop: '1px solid #f1f5f9' }}>
            DOCUMENTO VALIDADO ELETRONICAMENTE
          </div>
        </div>
      </div>
    </div>
  );
};

export const VALIDATION_STAMP_DIMENSIONS = { width: STAMP_WIDTH, height: STAMP_HEIGHT };

export default ValidationStamp;
