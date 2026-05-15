import React from 'react';
import { formatStampDateTime } from '../../utils/deviceUtils';

// Estilo "Corporate" — passa imagem de multinacional, com logo proeminente,
// header escuro com nome da empresa, accent dourado, monograma watermark,
// rodapé com endereço/escritório e selo "CERTIFIED ORIGINAL".
const NAVY = '#0b1d3a';        // azul-marinho corporativo
const NAVY_SOFT = '#142a52';
const GOLD = '#c9a24b';        // acento dourado
const GOLD_DEEP = '#a07e2c';
const INK = '#0f172a';
const SLATE = '#475569';
const SLATE_SOFT = '#94a3b8';
const PAPER = '#fafaf7';
const SERIF = "'Playfair Display', Georgia, 'Times New Roman', serif";
const SANS = "'Inter', system-ui, -apple-system, sans-serif";
const MONO = "'Roboto Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

// Filtro para recolorir a assinatura para azul-marinho (sem perder traço).
const INK_FILTER = 'brightness(0.25) sepia(1) hue-rotate(195deg) saturate(6)';

const CompanyCorporateStamp = ({
  responsibleName = 'Responsável Legal',
  responsibleRole = '',
  signedAt,
  signatureDataUrl,
  companyName = 'MAGNETIC PLACE',
  companyTagline = 'GLOBAL WORKFORCE SOLUTIONS',
  companyOffice = 'Lisboa · Porto · Madrid',
  companyLogoUrl = '/icon-512x512.png',
}) => {
  const dateLabel = formatStampDateTime(signedAt || new Date().toISOString());
  const serial = (signedAt || new Date().toISOString())
    .replace(/[^0-9]/g, '')
    .slice(0, 14);

  return (
    <div
      style={{
        position: 'relative',
        background: PAPER,
        border: `1px solid ${NAVY_SOFT}`,
        borderRadius: '4px',
        boxShadow: '0 4px 14px rgba(11, 29, 58, 0.18), 0 1px 3px rgba(11, 29, 58, 0.12)',
        fontFamily: SANS,
        width: '100%',
        maxWidth: '440px',
        overflow: 'hidden',
      }}
    >
      {/* Header escuro corporativo com logo + nome */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 16px',
          background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY_SOFT} 100%)`,
          color: '#fff',
          position: 'relative',
        }}
      >
        <div
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '2px',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4px',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.2)',
          }}
        >
          <img
            src={companyLogoUrl}
            alt="Logo"
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: SERIF,
              fontSize: '15px',
              fontWeight: 700,
              letterSpacing: '0.12em',
              lineHeight: 1.1,
              color: '#fff',
            }}
          >
            {companyName}
          </div>
          <div
            style={{
              fontSize: '7px',
              fontWeight: 600,
              letterSpacing: '0.3em',
              color: GOLD,
              marginTop: '3px',
              textTransform: 'uppercase',
            }}
          >
            {companyTagline}
          </div>
        </div>
        {/* Selo circular CERTIFIED */}
        <div
          style={{
            width: '46px',
            height: '46px',
            borderRadius: '50%',
            border: `1.5px solid ${GOLD}`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: GOLD,
            fontFamily: SERIF,
            lineHeight: 1,
            transform: 'rotate(-8deg)',
            background: 'rgba(255,255,255,0.04)',
          }}
        >
          <span style={{ fontSize: '6px', fontWeight: 700, letterSpacing: '0.15em' }}>CERTIFIED</span>
          <span style={{ fontSize: '10px', fontWeight: 700, marginTop: '2px' }}>★</span>
          <span style={{ fontSize: '5px', fontWeight: 600, letterSpacing: '0.2em', marginTop: '2px' }}>ORIGINAL</span>
        </div>
      </div>

      {/* Linha dourada de separação */}
      <div style={{ height: '2px', background: `linear-gradient(90deg, ${GOLD_DEEP}, ${GOLD}, ${GOLD_DEEP})` }} />

      {/* Corpo: brasão + caixa de assinatura 2:1 + watermark */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 16px',
          background: PAPER,
          overflow: 'hidden',
        }}
      >
        {/* Watermark grande do logo */}
        <img
          src={companyLogoUrl}
          alt=""
          aria-hidden="true"
          style={{
            position: 'absolute',
            right: '-20px',
            top: '50%',
            transform: 'translateY(-50%)',
            height: '140%',
            width: 'auto',
            opacity: 0.05,
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        />
        {/* Brasão monogram à esquerda */}
        <div
          style={{
            flex: '0 0 auto',
            width: '52px',
            height: '52px',
            borderRadius: '50%',
            border: `1px solid ${NAVY_SOFT}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#fff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            opacity: 0.85,
            zIndex: 1,
          }}
        >
          <img
            src={companyLogoUrl}
            alt=""
            style={{ width: '34px', height: '34px', objectFit: 'contain' }}
          />
        </div>

        {/* Caixa rectangular 2:1 para a assinatura */}
        <div
          style={{
            flex: '1 1 auto',
            position: 'relative',
            zIndex: 1,
            aspectRatio: '2 / 1',
            maxHeight: '100px',
            background: '#fff',
            border: `1px solid ${NAVY_SOFT}`,
            borderRadius: '2px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            padding: '4px',
          }}
        >
          {signatureDataUrl ? (
            <img
              src={signatureDataUrl}
              alt="Assinatura"
              style={{
                maxHeight: '100%',
                maxWidth: '100%',
                objectFit: 'contain',
                filter: INK_FILTER,
              }}
            />
          ) : (
            <span style={{ color: SLATE_SOFT, fontSize: '10px', fontStyle: 'italic' }}>
              (Assinatura)
            </span>
          )}
        </div>
      </div>

      {/* Footer: nome / cargo / data / serial */}
      <div
        style={{
          padding: '10px 16px 12px',
          borderTop: `1px solid ${NAVY_SOFT}`,
          background: '#fff',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontFamily: SERIF,
                fontSize: '13px',
                fontWeight: 700,
                color: INK,
                lineHeight: 1.1,
              }}
            >
              {responsibleName}
            </div>
            {responsibleRole && (
              <div
                style={{
                  fontSize: '9px',
                  fontWeight: 600,
                  letterSpacing: '0.12em',
                  color: SLATE,
                  marginTop: '3px',
                  textTransform: 'uppercase',
                }}
              >
                {responsibleRole}
              </div>
            )}
            <div
              style={{
                fontSize: '8px',
                color: SLATE_SOFT,
                marginTop: '4px',
                letterSpacing: '0.08em',
              }}
            >
              {companyOffice}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontSize: '7px',
                fontWeight: 700,
                color: GOLD_DEEP,
                letterSpacing: '0.25em',
                textTransform: 'uppercase',
              }}
            >
              Authenticated
            </div>
            <div style={{ fontFamily: MONO, fontSize: '9px', color: SLATE, marginTop: '3px' }}>
              {dateLabel}
            </div>
            <div style={{ fontFamily: MONO, fontSize: '7px', color: SLATE_SOFT, marginTop: '2px' }}>
              SN · {serial}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompanyCorporateStamp;
