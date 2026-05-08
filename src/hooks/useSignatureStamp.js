import { useCallback } from 'react';
import html2canvas from 'html2canvas';

export const useSignatureStamp = () => {
  const generateStampImage = useCallback(async (containerRef, options = {}) => {
    if (!containerRef?.current) {
      console.error('Container ref not available');
      return null;
    }

    try {
      const canvas = await html2canvas(containerRef.current, {
        backgroundColor: '#f8fafc',
        scale: 2,
        useCORS: true,
        logging: false,
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