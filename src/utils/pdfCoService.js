// Serviço para conversão DOCX → PDF usando PDF.co API
// Substitui o CloudConvert

const API_BASE_URL = 'https://api.pdf.co/v1';

function getApiKey() {
  const raw = import.meta.env.VITE_PDFCO_API_KEY;
  const apiKey = typeof raw === 'string' ? raw.trim().replace(/^['"]|['"]$/g, '') : '';
  if (!apiKey) {
    throw new Error(
      'PDF.co API key em falta. Define VITE_PDFCO_API_KEY no .env e reinicia o dev server.'
    );
  }
  return apiKey;
}

function keyFingerprint(apiKey) {
  if (!apiKey) return '(vazia)';
  return `len=${apiKey.length}, prefix="${apiKey.slice(0, 8)}...", suffix="...${apiKey.slice(-4)}"`;
}

async function apiFetch(endpoint, init = {}) {
  const apiKey = getApiKey();
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  
  const res = await fetch(url, {
    ...init,
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

  const data = await res.json().catch(() => ({}));
  
  if (!res.ok || data.error) {
    if (res.status === 401) {
      throw new Error(
        `PDF.co 401 Unauthenticated. A chave foi rejeitada pelo servidor. ` +
        `Verifica que reiniciaste o dev server e que a chave em .env está correta. ` +
        `Chave carregada: ${keyFingerprint(apiKey)}.`
      );
    }
    throw new Error(`PDF.co erro: ${data.message || data.error || res.statusText}`);
  }
  
  return data;
}

/**
 * Faz upload de um ficheiro para o PDF.co e retorna a URL temporária
 */
async function uploadFile(blob, filename = 'document.docx') {
  const apiKey = getApiKey();
  
  // 1. Obter URL de upload presigned
  const presignedRes = await apiFetch('/file/upload/get-presigned-url', {
    method: 'GET',
  });
  
  if (!presignedRes.presignedUrl || !presignedRes.url) {
    throw new Error('PDF.co: Falha a obter URL de upload.');
  }
  
  // 2. Upload do ficheiro para a URL presigned
  const uploadRes = await fetch(presignedRes.presignedUrl, {
    method: 'PUT',
    body: blob,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    },
  });
  
  if (!uploadRes.ok) {
    throw new Error(`PDF.co upload falhou (${uploadRes.status}).`);
  }
  
  return presignedRes.url;
}

/**
 * Converte um Blob DOCX para PDF usando PDF.co
 * @param {Blob} docxBlob - O ficheiro Word como Blob
 * @param {Object} options - Opções
 * @param {Function} options.onProgress - Callback de progresso
 * @returns {Promise<Blob>} - O PDF convertido como Blob
 */
export async function convertDocxToPdf(docxBlob, { onProgress } = {}) {
  if (!docxBlob) throw new Error('docxBlob obrigatório');
  
  onProgress?.('A enviar ficheiro Word para PDF.co...');
  const fileUrl = await uploadFile(docxBlob);
  
  onProgress?.('A converter Word → PDF...');
  const conversionResult = await apiFetch('/pdf/convert/from/doc', {
    method: 'POST',
    body: JSON.stringify({
      url: fileUrl,
      name: 'documento.pdf',
      async: false,
    }),
  });
  
  if (!conversionResult.url) {
    throw new Error('PDF.co: Conversão falhou - URL do PDF não disponível.');
  }
  
  onProgress?.('A descarregar PDF convertido...');
  const pdfRes = await fetch(conversionResult.url);
  if (!pdfRes.ok) {
    throw new Error(`PDF.co download falhou (${pdfRes.status}).`);
  }
  
  return pdfRes.blob();
}

/**
 * Testa a autenticação com a API do PDF.co
 */
export async function testPdfCoAuth() {
  return apiFetch('/account/credit/balance', { method: 'GET' });
}

/**
 * Verifica se o PDF.co está configurado
 */
export function isPdfCoConfigured() {
  return !!import.meta.env.VITE_PDFCO_API_KEY;
}
