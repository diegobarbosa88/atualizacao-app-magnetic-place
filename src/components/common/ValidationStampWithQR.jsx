import React, { useState, useEffect } from 'react';
import ValidationStamp from './ValidationStamp';
import { generateQRCodeDataURL } from '../../hooks/useSignatureStamp';

// Wrapper que carrega o QR code async e renderiza o ValidationStamp com ele já preenchido.
// Usado em sítios onde o stamp é renderizado como JSX vivo (cliente).
const ValidationStampWithQR = ({ signature, datetime, ip, id }) => {
  const [qrCode, setQrCode] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (id) {
      generateQRCodeDataURL(id).then(url => {
        if (!cancelled) setQrCode(url);
      });
    } else {
      setQrCode('');
    }
    return () => { cancelled = true; };
  }, [id]);

  return (
    <ValidationStamp
      signature={signature}
      datetime={datetime}
      ip={ip}
      id={id}
      qrCode={qrCode}
    />
  );
};

export default ValidationStampWithQR;
