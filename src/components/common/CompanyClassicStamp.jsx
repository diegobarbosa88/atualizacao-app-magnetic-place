import React from 'react';
import { formatStampDateTime } from '../../utils/deviceUtils';

const INK_BLUE = '#0f3f87';
const INTER = "'Inter', system-ui, -apple-system, sans-serif";
const MONO = "'Roboto Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

// Filtro CSS para recolorir uma imagem em escala de cinza para azul-tinta.
// Aproximado (não perfeito como o canvas recolor do PDF, mas suficiente para preview).
const INK_FILTER = 'brightness(0.4) sepia(1) hue-rotate(190deg) saturate(5)';

const CompanyClassicStamp = ({
  responsibleName = 'Responsável Legal',
  responsibleRole = '',
  signedAt,
  signatureDataUrl,
  companyLogoUrl = '/icon-512x512.png',
}) => {
  const dateLabel = formatStampDateTime(signedAt || new Date().toISOString());

  return (
    <div
      style={{
        position: 'relative',
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '6px',
        boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)',
        fontFamily: INTER,
        width: '100%',
        maxWidth: '400px',
        overflow: 'hidden',
      }}
    >
      {/* Barra superior azul */}
      <div style={{ height: '4px', background: INK_BLUE }} />

      {/* Header: logo + label */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #f1f5f9' }}>
        <img
          src={companyLogoUrl}
          alt="Logo"
          style={{ width: '32px', height: '32px', objectFit: 'contain' }}
        />
        <span
          style={{
            fontSize: '8px',
            fontWeight: 800,
            color: '#64748b',
            textTransform: 'uppercase',
            letterSpacing: '0.2em',
          }}
        >
          Assinatura Qualificada
        </span>
      </div>

      {/* Assinatura desenhada (centro) + marca d'água */}
      <div
        style={{
          position: 'relative',
          height: '90px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '6px 14px',
          background: '#fff',
          overflow: 'hidden',
        }}
      >
        <img
          src={companyLogoUrl}
          alt=""
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            height: '110%',
            width: 'auto',
            opacity: 0.06,
            pointerEvents: 'none',
            userSelect: 'none',
            zIndex: 0,
          }}
        />
        {signatureDataUrl ? (
          <img
            src={signatureDataUrl}
            alt="Assinatura"
            style={{
              position: 'relative',
              zIndex: 1,
              maxHeight: '80px',
              maxWidth: '100%',
              objectFit: 'contain',
              filter: INK_FILTER,
            }}
          />
        ) : (
          <span style={{ color: '#94a3b8', fontSize: '10px', fontStyle: 'italic' }}>
            (Desenhe a assinatura nas Definições)
          </span>
        )}
      </div>

      {/* Rodapé: nome + cargo + data */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          padding: '8px 14px 12px',
          borderTop: '1px solid #f1f5f9',
          background: '#f8fafc',
          gap: '10px',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', lineHeight: 1.1 }}>
            {responsibleName}
          </div>
          {responsibleRole && (
            <div style={{ fontSize: '9px', fontStyle: 'italic', color: '#64748b', marginTop: '2px' }}>
              {responsibleRole}
            </div>
          )}
        </div>
        <div style={{ fontFamily: MONO, fontSize: '9px', color: '#475569', whiteSpace: 'nowrap' }}>
          {dateLabel}
        </div>
      </div>
    </div>
  );
};

export default CompanyClassicStamp;
