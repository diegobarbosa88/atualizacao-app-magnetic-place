import React from 'react';

const STAMP_WIDTH = 333;
const STAMP_HEIGHT = 100;

const ValidationStamp = ({ signature, datetime, ip, id, qrCode, hideQrCode = false }) => {
  const dateStr = datetime ? new Date(datetime).toLocaleString('pt-PT') : '';
  const idStr = id || '';
  const ipStr = ip || 'N/D';

  return (
    <div style={{
      backgroundColor: '#f8fafc',
      border: '2px solid #e0e7ff',
      borderRadius: '16px',
      padding: '12px 14px',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'stretch',
      gap: '12px',
      width: `${STAMP_WIDTH}px`,
      minHeight: `${STAMP_HEIGHT}px`,
      boxSizing: 'border-box',
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    }}>
      {/* Assinatura */}
      <div style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '6px',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '80px',
      }}>
        {signature ? (
          <img src={signature} alt="Assinatura" style={{ height: '70px', width: 'auto', maxWidth: '80px', display: 'block', objectFit: 'contain' }} />
        ) : (
          <div style={{ width: '70px', height: '50px', border: '1px dashed #cbd5e1', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#94a3b8', fontSize: '7px', fontWeight: 800, textTransform: 'uppercase' }}>Assinatura</span>
          </div>
        )}
      </div>

      {/* Dados */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#4f46e5', fontWeight: 900, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '5px' }}>
          <span style={{ backgroundColor: '#10b981', color: '#ffffff', padding: '3px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
          VALIDAÇÃO DIGITAL
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={{ fontSize: '8px', fontWeight: 700, color: '#64748b', display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
            <span>Data/Hora:</span>
            <span style={{ fontWeight: 800, fontFamily: 'monospace', color: '#0f172a' }}>{dateStr}</span>
          </div>
          <div style={{ fontSize: '8px', fontWeight: 700, color: '#64748b', display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
            <span>IP:</span>
            <span style={{ fontWeight: 800, fontFamily: 'monospace', color: '#0f172a' }}>{ipStr}</span>
          </div>
          {idStr && (
            <div style={{ fontSize: '8px', fontWeight: 700, color: '#64748b', display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
              <span>ID:</span>
              <span style={{ fontWeight: 800, fontFamily: 'monospace', color: '#6366f1', fontSize: '7px' }}>{idStr}</span>
            </div>
          )}
        </div>

        <div style={{ fontSize: '6px', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '5px', paddingTop: '4px', borderTop: '1px solid #e2e8f0' }}>
          DOCUMENTO VALIDADO ELETRONICAMENTE
        </div>
      </div>
    </div>
  );
};

export const VALIDATION_STAMP_DIMENSIONS = { width: STAMP_WIDTH, height: STAMP_HEIGHT };

export default ValidationStamp;
