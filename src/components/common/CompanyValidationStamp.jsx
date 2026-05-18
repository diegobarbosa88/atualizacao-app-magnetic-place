import React from 'react';
// v3

const STAMP_WIDTH  = 380;
const STAMP_HEIGHT = 100;
const OVERLAY_W    = 150;
const FOOTER_H     = 15;
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
        gap: '14px',
        flexShrink: 0,
      }}>
        {/* Logo (fundo) + Assinatura (por cima) sobrepostos */}
        <div style={{
          position: 'relative',
          width: `${OVERLAY_W}px`,
          height: `${BODY_H - 10}px`,
          flexShrink: 0,
        }}>
          {/* Logo com transparência */}
          <img
            src={companyLogoUrl}
            alt="Logo"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              opacity: 0.18,
            }}
          />
          {/* Assinatura por cima */}
          {signatureDataUrl && (
            <img
              src={signatureDataUrl}
              alt="Assinatura"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                filter: INK_FILTER,
              }}
            />
          )}
        </div>

        {/* Dados do signatário */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '2px', minWidth: 0 }}>
          <div style={{
            fontSize: '13px', fontWeight: 800, color: '#0f172a', lineHeight: 1.1,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {responsibleName}
          </div>
          {responsibleRole && (
            <div style={{ fontSize: '10px', fontWeight: 600, color: '#334155', marginTop: '1px' }}>{responsibleRole}</div>
          )}
          <div style={{ marginTop: '5px', borderTop: '1px solid #e2e8f0', paddingTop: '5px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ fontFamily: MONO, fontSize: '9px', color: '#334155', fontWeight: 600 }}>{dateStr}</div>
            <div style={{ fontFamily: MONO, fontSize: '8px', color: '#64748b' }}>IP {ip}</div>
            {idStr && (
              <div style={{ fontFamily: MONO, fontSize: '8px', color: '#4f46e5', fontWeight: 700 }}>ID: {idStr}</div>
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
