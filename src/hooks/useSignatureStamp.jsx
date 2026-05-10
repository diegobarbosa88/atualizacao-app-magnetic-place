import { useCallback } from 'react';
import { renderToString } from 'react-dom/server';
import html2canvas from 'html2canvas';
import ValidationStamp from '../components/common/ValidationStamp';

function stripOklch(cssText) {
  if (!cssText) return cssText;
  return cssText.replace(/oklch\([^)]+\)/g, '#ffffff');
}

export const getStampHTML = ({ signatureDataURL, datetime, ip, id }) => {
  const stampMarkup = renderToString(
    <ValidationStamp signature={signatureDataURL} datetime={datetime} ip={ip} id={id} />
  );
  const scopeCSS = `
    .magnetic-validation-stamp,
    .magnetic-validation-stamp * {
      line-height: 1.2 !important;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
      text-indent: 0 !important;
      text-align: left !important;
      white-space: normal !important;
      font-style: normal !important;
      font-variant: normal !important;
      text-decoration: none !important;
    }
  `;
  return `<style>${scopeCSS}</style><div class="magnetic-validation-stamp" style="margin-top:32px;padding-top:24px;border-top:1px solid #e2e8f0;page-break-inside:avoid;break-inside:avoid;display:flex;flex-direction:column;align-items:flex-end;">${stampMarkup}</div>`;
};

export const useSignatureStamp = () => {
  const generateStampImage = useCallback(async (containerRef, options = {}) => {
    if (!containerRef?.current) {
      console.error('Container ref not available');
      return null;
    }

    try {
      const canvas = await html2canvas(containerRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
        onclone: (clonedDoc) => {
          const all = clonedDoc.querySelectorAll('*');
          all.forEach(el => {
            el.style.cssText = stripOklch(el.style.cssText);
          });
          clonedDoc.querySelectorAll('style').forEach(style => {
            style.textContent = style.textContent.replace(/oklch\([^)]+\)/g, '#ffffff');
          });
        },
        ...options
      });

      return canvas.toDataURL('image/png');
    } catch (error) {
      console.error('Error generating stamp image:', error);
      return null;
    }
  }, []);

  const getStampDimensions = useCallback(() => ({
    width: 280,
    height: 80
  }), []);

  return {
    generateStampImage,
    getStampDimensions
  };
};

export default useSignatureStamp;
