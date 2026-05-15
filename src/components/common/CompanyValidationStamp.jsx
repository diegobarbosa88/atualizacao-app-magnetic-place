import React from 'react';
import { tokenIdFromDate, formatStampDateTime } from '../../utils/deviceUtils';

const MONO = "'Roboto Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const INTER = "'Inter', system-ui, -apple-system, sans-serif";

const CompanyValidationStamp = ({
  responsibleName = 'Responsável Legal',
  signedAt,
  tokenId,
  device = 'Browser/OS',
  ip = '0.0.0.0',
  verified = true,
  companyLogoUrl = '/icon-512x512.png',
}) => {
  const finalToken = tokenId || tokenIdFromDate(signedAt);
  const dateLabel = formatStampDateTime(signedAt || new Date().toISOString());

  return (
    <div
      style={{
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: '1fr 2fr',
        borderRadius: '4px',
        borderLeft: '6px solid #0ea5e9',
        overflow: 'hidden',
        boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)',
        fontFamily: INTER,
        background: '#fff',
        width: '100%',
        maxWidth: '400px',
      }}
    >
      {/* Coluna esquerda — Verified Device Audit */}
      <div style={{ background: '#f8fafc', padding: '1rem' }}>
        <div
          style={{
            fontSize: '7px',
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: '#0284c7',
            marginBottom: '10px',
          }}
        >
          Verified Device Audit
        </div>

        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontSize: '7px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>
            Device
          </div>
          <div style={{ fontFamily: MONO, fontSize: '9px', color: '#475569', fontWeight: 500 }}>
            {device}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '7px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>
            Network
          </div>
          <div style={{ fontFamily: MONO, fontSize: '9px', color: '#475569', fontWeight: 500 }}>
            {ip}
          </div>
        </div>
      </div>

      {/* Coluna direita — Signatory Details */}
      <div style={{ background: '#fff', padding: '1rem', position: 'relative', overflow: 'hidden' }}>
        {/* Marca d'água — logo da empresa */}
        <img
          src={companyLogoUrl}
          alt=""
          aria-hidden="true"
          style={{
            position: 'absolute',
            right: '-12px',
            top: '50%',
            transform: 'translateY(-50%)',
            height: '95%',
            width: 'auto',
            opacity: 0.07,
            pointerEvents: 'none',
            userSelect: 'none',
            zIndex: 0,
          }}
        />
        {/* Indicador de status */}
        <div style={{ position: 'absolute', top: '10px', right: '12px', display: 'flex', gap: '5px' }}>
          <span
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: verified ? '#10b981' : '#cbd5e1',
              boxShadow: verified ? '0 0 5px rgba(16,185,129,0.6)' : 'none',
            }}
          />
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#cbd5e1' }} />
        </div>

        {/* Centro: nome + subtítulo */}
        <div style={{ marginBottom: '10px' }}>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', lineHeight: 1.1 }}>
            {responsibleName}
          </div>
          <div
            style={{
              marginTop: '3px',
              fontSize: '9px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: '#0284c7',
            }}
          >
            Assinatura Eletrónica Certificada
          </div>
        </div>

        {/* Rodapé: token + data */}
        <div
          style={{
            background: '#f8fafc',
            borderRadius: '6px',
            padding: '6px 10px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <span style={{ fontFamily: MONO, fontSize: '9px', color: '#64748b' }}>{finalToken}</span>
          <span style={{ fontFamily: INTER, fontWeight: 700, fontSize: '10px', color: '#0f172a' }}>{dateLabel}</span>
        </div>
      </div>
    </div>
  );
};

export default CompanyValidationStamp;
