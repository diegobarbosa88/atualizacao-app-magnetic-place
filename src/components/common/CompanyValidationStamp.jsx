import React from 'react';

const STAMP_WIDTH  = 380;
const STAMP_HEIGHT = 100;
const SIG_BOX_W    = 140;
const SIG_BOX_H    = 70;
const LOGO_SIZE    = 32;
const FOOTER_H     = 14;
const BODY_H       = STAMP_HEIGHT - FOOTER_H;

const INTER = "'Inter', system-ui, -apple-system, sans-serif";
const MONO  = "'Roboto Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const INK_FILTER = 'brightness(0.3) sepia(1) hue-rotate(190deg) saturate(4)';

const CompanyValidationStamp = ({
  responsibleName = 'Responsável Legal',
  responsibleRole = '',
  signedAt,
  ip = 'N/D',
  id,
  signatureDataUrl,
  companyLogoUrl = '/icon-512x512.png',
}) => {
  const dateStr = signedAt ? new Date(signedAt).toLocaleString('pt-PT') : '';
  const idStr = id || '';
  const idStr = id || '';

  return (
    <div style={{
      width: `${STAMP_WIDTH}px`,
      height: `${STAMP_HEIGHT}px`,
      background: '#fff',
      border: '1px solid #e2e8f0',
      borderRadius: '16px',
      fontFamily: INTER,
      overflow: 'hidden',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Corpo */}
      <div style={{
        height: `${BODY_H}px`,
        display: 'flex',
        alignItems: 'center',
        padding: '0 14px',
        gap: '12px',
        flexShrink: 0,
      }}>
        {/* Logo */}
        <img
          src={companyLogoUrl}
          alt="Logo"
          style={{ width: `${LOGO_SIZE}px`, height: `${LOGO_SIZE}px`, objectFit: 'contain', flexShrink: 0 }}
        />

        {/* Caixa da assinatura */}
        <div style={{
          width: `${SIG_BOX_W}px`,
          height: `${SIG_BOX_H}px`,
          flexShrink: 0,
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          background: '#fafafa',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          padding: '4px',
          boxSizing: 'border-box',
        }}>
          {signatureDataUrl ? (
            <img
              src={signatureDataUrl}
              alt="Assinatura"
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', filter: INK_FILTER }}
            />
          ) : (
            <span style={{ fontSize: '8px', color: '#cbd5e1', fontStyle: 'italic' }}>Assinatura</span>
          )}
        </div>

        {/* Dados do signatário */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '2px', minWidth: 0 }}>
          <div style={{
            fontSize: '12px', fontWeight: 700, color: '#0f172a', lineHeight: 1.1,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {responsibleName}
          </div>
          {responsibleRole && (
            <div style={{ fontSize: '9px', fontStyle: 'italic', color: '#64748b', marginTop: '1px' }}>{responsibleRole}</div>
          )}
          <div style={{ marginTop: '5px', borderTop: '1px solid #f1f5f9', paddingTop: '4px' }}>
            <div style={{ fontFamily: MONO, fontSize: '8px', color: '#475569' }}>{dateStr}</div>
            <div style={{ fontFamily: MONO, fontSize: '8px', color: '#94a3b8', marginTop: '2px' }}>IP {ip}</div>
            {idStr && (
              <div style={{ fontFamily: MONO, fontSize: '7px', color: '#6366f1', marginTop: '2px' }}>ID: {idStr}</div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        height: `${FOOTER_H}px`,
        borderTop: '1px solid #f1f5f9',
        background: '#fafafa',
        display: 'flex',
        alignItems: 'center',
        padding: '0 14px',
        gap: '5px',
        flexShrink: 0,
      }}>
        <span style={{
          display: 'inline-block', width: '6px', height: '6px',
          borderRadius: '50%', background: '#10b981', flexShrink: 0,
        }} />
        <span style={{
          fontSize: '6px', fontWeight: 700, color: '#10b981',
          textTransform: 'uppercase', letterSpacing: '0.15em',
        }}>
          Documento autenticado eletronicamente
        </span>
      </div>
    </div>
  );
};

export default CompanyValidationStamp;
