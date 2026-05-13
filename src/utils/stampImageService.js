// Gera o PNG do "carimbo de assinatura" usando html2canvas para capturar
// o mesmo componente ValidationStamp usado no portal do cliente.
// O QR é incluído no carimbo. Após conversão para PDF, o QR também é
// aplicado em todas as páginas via pdfSigningService.applyQrToAllPages.

import html2canvas from 'html2canvas';
import React from 'react';
import { renderToString } from 'react-dom/server';
import ValidationStamp from '../components/common/ValidationStamp';

function dataUrlToBytes(dataUrl) {
  const bin = atob(dataUrl.split(',')[1]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function generateStampImageBytes({
  workerName,
  signedAt,
  signedIp,
  serialLabel,
  qrDataUrl,
  signatureDataUrl,
} = {}) {
  // Renderizar o componente ValidationStamp como HTML (sem QR - QR é aplicado em todas as páginas do PDF)
  const stampMarkup = renderToString(
    React.createElement(ValidationStamp, {
      signature: signatureDataUrl,
      datetime: signedAt,
      ip: signedIp,
      id: serialLabel,
      hideQrCode: true,
    })
  );

  // CSS para garantir fonte e estilos consistentes
  const scopeCSS = `
    .stamp-capture-container,
    .stamp-capture-container * {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
      box-sizing: border-box !important;
    }
  `;

  const container = document.createElement('div');
  container.className = 'stamp-capture-container';
  container.style.cssText = 'position:absolute;left:-10000px;top:0;background:#ffffff;padding:0;margin:0;';
  container.innerHTML = `<style>${scopeCSS}</style>${stampMarkup}`;
  document.body.appendChild(container);

  try {
    // Aguardar renderização
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    const canvas = await html2canvas(container, {
      backgroundColor: '#ffffff',
      scale: 3,
      useCORS: true,
      logging: false,
    });

    const dataUrl = canvas.toDataURL('image/png');
    return dataUrlToBytes(dataUrl);
  } finally {
    if (container.parentNode) container.parentNode.removeChild(container);
  }
}
