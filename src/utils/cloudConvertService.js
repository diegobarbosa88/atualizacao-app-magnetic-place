const DEFAULT_BASE_URL = 'https://api.cloudconvert.com/v2';

function getConfig() {
  const raw = import.meta.env.VITE_CLOUDCONVERT_API_KEY;
  const apiKey = typeof raw === 'string' ? raw.trim().replace(/^['"]|['"]$/g, '') : '';
  const baseUrl = (import.meta.env.VITE_CLOUDCONVERT_BASE_URL || DEFAULT_BASE_URL).trim();
  if (!apiKey) {
    throw new Error(
      'CloudConvert API key em falta. Define VITE_CLOUDCONVERT_API_KEY no .env e reinicia o dev server.'
    );
  }
  return { apiKey, baseUrl };
}

function keyFingerprint(apiKey) {
  if (!apiKey) return '(vazia)';
  return `len=${apiKey.length}, prefix="${apiKey.slice(0, 12)}...", suffix="...${apiKey.slice(-6)}"`;
}

async function apiFetch(path, init = {}, apiKey) {
  const res = await fetch(path, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    if (res.status === 401) {
      throw new Error(
        `CloudConvert 401 Unauthenticated. A chave foi rejeitada pelo servidor. ` +
        `Verifica que reiniciaste o dev server (Ctrl+C → npm run dev) e que a chave em .env é a mesma que geraste em cloudconvert.com/dashboard/api/v2/keys. ` +
        `Chave carregada: ${keyFingerprint(apiKey)}.`
      );
    }
    throw new Error(`CloudConvert ${res.status}: ${body.slice(0, 200) || res.statusText}`);
  }
  return res.json();
}

export async function testCloudConvertAuth() {
  const { apiKey, baseUrl } = getConfig();
  const res = await fetch(`${baseUrl}/users/me`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Auth test falhou (${res.status}): ${body.slice(0, 200)}. Chave: ${keyFingerprint(apiKey)}`);
  }
  return res.json();
}

async function createJob(baseUrl, apiKey) {
  return apiFetch(`${baseUrl}/jobs`, {
    method: 'POST',
    body: JSON.stringify({
      tasks: {
        'import-docx': { operation: 'import/upload' },
        'convert-pdf': {
          operation: 'convert',
          input: 'import-docx',
          input_format: 'docx',
          output_format: 'pdf',
          engine: 'libreoffice',
        },
        'export-pdf': {
          operation: 'export/url',
          input: 'convert-pdf',
        },
      },
    }),
  }, apiKey);
}

async function uploadFile(uploadForm, blob) {
  const formData = new FormData();
  Object.entries(uploadForm.parameters || {}).forEach(([k, v]) => formData.append(k, v));
  formData.append('file', blob, 'document.docx');
  const res = await fetch(uploadForm.url, { method: 'POST', body: formData });
  if (!res.ok && res.status !== 201) {
    const body = await res.text().catch(() => '');
    throw new Error(`CloudConvert upload falhou (${res.status}): ${body.slice(0, 200)}`);
  }
}

async function waitForJob(baseUrl, jobId, apiKey, { timeoutMs = 90000, intervalMs = 1500 } = {}) {
  const started = Date.now();
  while (true) {
    if (Date.now() - started > timeoutMs) {
      throw new Error('CloudConvert demorou demasiado a converter (timeout 90s).');
    }
    await new Promise((r) => setTimeout(r, intervalMs));
    const { data } = await apiFetch(`${baseUrl}/jobs/${jobId}`, {}, apiKey);
    if (data.status === 'finished') return data;
    if (data.status === 'error') {
      const failed = data.tasks?.find((t) => t.status === 'error');
      throw new Error(`CloudConvert erro: ${failed?.message || 'tarefa falhou'}`);
    }
  }
}

export async function convertDocxToPdf(docxBlob, { onProgress } = {}) {
  if (!docxBlob) throw new Error('docxBlob obrigatório');
  const { apiKey, baseUrl } = getConfig();

  onProgress?.('A criar tarefa de conversão...');
  const job = await createJob(baseUrl, apiKey);

  const importTask = job.data.tasks.find((t) => t.name === 'import-docx');
  if (!importTask?.result?.form) {
    throw new Error('CloudConvert: import task não devolveu formulário de upload.');
  }

  onProgress?.('A enviar ficheiro Word...');
  await uploadFile(importTask.result.form, docxBlob);

  onProgress?.('A processar conversão Word → PDF...');
  const finished = await waitForJob(baseUrl, job.data.id, apiKey);

  const exportTask = finished.tasks.find((t) => t.name === 'export-pdf');
  const fileUrl = exportTask?.result?.files?.[0]?.url;
  if (!fileUrl) throw new Error('CloudConvert: ficheiro PDF não disponível após conversão.');

  onProgress?.('A descarregar PDF convertido...');
  const pdfRes = await fetch(fileUrl);
  if (!pdfRes.ok) throw new Error(`CloudConvert download falhou (${pdfRes.status}).`);
  return pdfRes.blob();
}

export function isCloudConvertConfigured() {
  return !!import.meta.env.VITE_CLOUDCONVERT_API_KEY;
}
