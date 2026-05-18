import React from 'react';

const INTER = "'Inter', system-ui, -apple-system, sans-serif";
const MONO  = "'Roboto Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const INK_FILTER = 'brightness(0.3) sepia(1) hue-rotate(190deg) saturate(4)';

const CompanyValidationStamp = ({
  responsibleName = 'Responsável Legal',
  responsibleRole = '',
  signedAt,
  ip = 'N/D',
  signatureDataUrl,
  companyLogoUrl = '/icon-512x512.png',
}) => {
  const dateStr = signedAt ? new Date(signedAt).toLocaleString('pt-PT') : '';

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e2e8f0',
      borderRadius: '8px',
      fontFamily: INTER,
      width: '100%',
      maxWidth: '420px',
      overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '7px 12px',
        borderBottom: '1px solid #f1f5f9',
      }}>
        <img src={companyLogoUrl} alt="Logo" style={{ width: '22px', height: '22px', objectFit: 'contain' }} />
        <span style={{
          fontSize: '7px', fontWeight: 800, color: '#94a3b8',
          textTransform: 'uppercase', letterSpacing: '0.2em',
        }}>
          Assinatura Eletrónica
        </span>
      </div>

      {/* Corpo: caixa de assinatura + dados */}
      <div style={{ display: 'flex', alignItems: 'stretch', padding: '10px 12px', gap: '12px' }}>
        {/* Caixa da assinatura */}
        <div style={{
          flex: '0 0 auto',
          width: '120px',
          height: '60px',
          border: '1px solid #e2e8f0',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#fafafa',
          overflow: 'hidden',
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
            <div style={{ fontSize: '9px', fontStyle: 'italic', color: '#64748b' }}>{responsibleRole}</div>
          )}
          <div style={{ marginTop: '5px', borderTop: '1px solid #f1f5f9', paddingTop: '4px' }}>
            <div style={{ fontFamily: MONO, fontSize: '8px', color: '#475569' }}>{dateStr}</div>
            <div style={{ fontFamily: MONO, fontSize: '8px', color: '#94a3b8', marginTop: '2px' }}>IP {ip}</div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        padding: '5px 12px',
        borderTop: '1px solid #f1f5f9',
        background: '#fafafa',
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
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
