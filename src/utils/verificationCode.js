// Código curto de verificação (ex. "FWD-7K2M"), gravado em
// worker_documents.verification_code no momento da aprovação do admin (ver
// useDocumentTemplates.js handleApproveDocument) — nunca um UUID reaproveitado.
const SAFE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O, 1/I

function randomSuffix(len = 4) {
  return Array.from({ length: len }, () => SAFE_CHARS[Math.floor(Math.random() * SAFE_CHARS.length)]).join('');
}

function initials(name) {
  const letters = (name || '').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 3).toUpperCase();
  return letters || 'DOC';
}

export async function generateUniqueVerificationCode(workerName, supabase, maxAttempts = 5) {
  for (let i = 0; i < maxAttempts; i++) {
    const code = `${initials(workerName)}-${randomSuffix()}`;
    const { data } = await supabase
      .from('worker_documents')
      .select('id')
      .eq('verification_code', code)
      .maybeSingle();
    if (!data) return code;
  }
  throw new Error('Não foi possível gerar um código de verificação único.');
}
