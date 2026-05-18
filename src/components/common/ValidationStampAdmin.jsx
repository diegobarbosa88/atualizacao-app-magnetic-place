import React from 'react';

const STAMP_WIDTH = 380;
const STAMP_HEIGHT = 84;
const SIG_BOX_WIDTH = 120;
const SIG_BOX_HEIGHT = 58;

const ValidationStampAdmin = ({ signatureDataUrl, responsibleName, responsibleRole, signedAt, ip, companyLogoUrl }) => {
  const dateStr = signedAt ? new Date(signedAt).toLocaleString('pt-PT') : '';
  const ipStr = ip || 'N/D';
  const logoSrc = companyLogoUrl || '/icon-512x512.png';

  return (
    <div style={{
      backgroundColor: '#ffffff',
      border: '2px solid #e0e7ff',
      borderRadius: '16px',
      padding: '8px 12px',
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
      {/* Caixa de assinatura — sem contorno, logo como marca de água */}
      <div style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: `${SIG_BOX_WIDTH}px`,
        height: `${SIG_BOX_HEIGHT}px`,
        boxSizing: 'border-box',
        overflow: 'hidden',
        position: 'relative',
      }}>
        {/* Logo marca de água */}
        <img
          src={logoSrc}
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            opacity: 0.08,
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        />
        {/* Assinatura por cima */}
        {signatureDataUrl ? (
          <img
            src={signatureDataUrl}
            alt="Assinatura"
            style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain', display: 'block', position: 'relative' }}
          />
        ) : (
          <span style={{ color: '#94a3b8', fontSize: '8px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', position: 'relative' }}>
            Assinatura
          </span>
        )}
      </div>

      {/* Dados */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#1d4ed8', fontWeight: 900, fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '3px' }}>
          <span style={{ backgroundColor: '#2563eb', color: '#ffffff', padding: '3px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
          APROVAÇÃO EMPRESARIAL
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          <div style={{ fontSize: '8px', fontWeight: 700, color: '#64748b', display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
            <span>Nome:</span>
            <span style={{ fontWeight: 800, color: '#0f172a' }}>{responsibleName || '—'}</span>
          </div>
          {responsibleRole && (
            <div style={{ fontSize: '8px', fontWeight: 700, color: '#64748b', display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
              <span>Cargo:</span>
              <span style={{ fontWeight: 800, color: '#0f172a' }}>{responsibleRole}</span>
            </div>
          )}
          <div style={{ fontSize: '8px', fontWeight: 700, color: '#64748b', display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
            <span>Data/Hora:</span>
            <span style={{ fontWeight: 800, fontFamily: 'monospace', color: '#0f172a' }}>{dateStr}</span>
          </div>
          <div style={{ fontSize: '8px', fontWeight: 700, color: '#64748b', display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
            <span>IP:</span>
            <span style={{ fontWeight: 800, fontFamily: 'monospace', color: '#0f172a' }}>{ipStr}</span>
          </div>
        </div>

        <div style={{ fontSize: '6px', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '3px', paddingTop: '3px', borderTop: '1px solid #e0e7ff' }}>
          DOCUMENTO APROVADO PELO REPRESENTANTE
        </div>
      </div>
    </div>
  );
};

export default ValidationStampAdmin;
