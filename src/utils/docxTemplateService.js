import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import ImageModule from 'docxtemplater-image-module-free';
import { TEMPLATE_FIELDS, getWorkerFieldValue } from './templateFields';

export const TEMPLATES_BUCKET = 'document_templates';

export const STAMP_TAG = 'signature_stamp';

export const KNOWN_FIELD_NAMES = [
  ...TEMPLATE_FIELDS.map(f => ({
    name: f.tag.replace(/[{}]/g, ''),
    label: f.label,
    source: f.source,
  })),
  { name: STAMP_TAG, label: 'Carimbo de Assinatura Digital', source: 'image' },
];

const KNOWN_FIELD_LOOKUP = Object.fromEntries(
  KNOWN_FIELD_NAMES.map(f => [f.name.toLowerCase(), f])
);

export function isKnownField(name) {
  return !!KNOWN_FIELD_LOOKUP[(name || '').toLowerCase()];
}

export async function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Falha a ler ficheiro'));
    reader.readAsArrayBuffer(file);
  });
}

function loadDocFromBuffer(arrayBuffer) {
  let zip;
  try {
    zip = new PizZip(arrayBuffer);
  } catch (err) {
    throw new Error('Ficheiro .docx inválido ou corrompido (zip ilegível).');
  }
  try {
    return new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });
  } catch (err) {
    const detail = err?.properties?.errors?.map(e => e?.properties?.explanation).filter(Boolean).join('; ');
    throw new Error('Template .docx inválido' + (detail ? `: ${detail}` : '.'));
  }
}

export function extractTags(arrayBuffer) {
  const doc = loadDocFromBuffer(arrayBuffer);
  const fullText = doc.getFullText() || '';
  const tags = new Set();
  const re = /\{%?([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
  let m;
  while ((m = re.exec(fullText)) !== null) {
    tags.add(m[1]);
  }
  return Array.from(tags);
}

export async function uploadTemplateFile(supabase, file) {
  const path = `templates/${crypto.randomUUID()}.docx`;
  const { error } = await supabase.storage
    .from(TEMPLATES_BUCKET)
    .upload(path, file, {
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      upsert: false,
    });
  if (error) throw error;
  return path;
}

export async function downloadTemplateBytes(supabase, path) {
  const { data, error } = await supabase.storage
    .from(TEMPLATES_BUCKET)
    .download(path);
  if (error) throw error;
  return await data.arrayBuffer();
}

export async function deleteTemplateFile(supabase, path) {
  if (!path) return;
  await supabase.storage.from(TEMPLATES_BUCKET).remove([path]);
}

export function buildRenderData(workerData = {}, systemData = {}) {
  const data = {};
  for (const f of KNOWN_FIELD_NAMES) {
    if (f.source === 'system') {
      switch (f.name) {
        case 'current_date':
          data[f.name] = new Date().toLocaleDateString('pt-PT');
          break;
        case 'current_datetime':
          data[f.name] = new Date().toLocaleString('pt-PT');
          break;
        case 'company_name':
          data[f.name] = systemData?.companyName || 'Magnetic Place';
          break;
        case 'company_address':
          data[f.name] = systemData?.companyAddress || '';
          break;
        case 'company_nif':
          data[f.name] = systemData?.companyNif || '';
          break;
        default:
          data[f.name] = '';
      }
    } else {
      data[f.name] = getWorkerFieldValue(workerData || {}, `{{${f.name}}}`) || '';
    }
  }
  return data;
}

export function renderDocx(arrayBuffer, renderData, { imageMap = null } = {}) {
  let zip;
  try {
    zip = new PizZip(arrayBuffer);
  } catch (err) {
    throw new Error('Ficheiro .docx inválido ou corrompido (zip ilegível).');
  }

  const modules = [];
  if (imageMap) {
    modules.push(new ImageModule({
      centered: false,
      getImage: (tagValue) => imageMap[tagValue] || null,
      // Tamanho do carimbo de assinatura em pontos (1 pt = 1/72 polegadas)
      // 280x140 pt = ~99x49mm - ajustar no Word via tamanho da célula/container se necessário
      getSize: () => [280, 140],
    }));
  }

  let doc;
  try {
    doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      modules,
      nullGetter: () => '',
    });
  } catch (err) {
    const detail = err?.properties?.errors?.map(e => e?.properties?.explanation).filter(Boolean).join('; ');
    throw new Error('Template .docx inválido' + (detail ? `: ${detail}` : '.'));
  }

  const data = { ...renderData };
  if (imageMap) {
    for (const key of Object.keys(imageMap)) data[key] = key;
  } else {
    data[STAMP_TAG] = '';
  }

  try {
    doc.render(data);
  } catch (err) {
    const details = err?.properties?.errors?.map(e => e?.properties?.explanation).filter(Boolean).join('; ');
    throw new Error('Falha ao preencher o template' + (details ? `: ${details}` : '.'));
  }

  return doc.getZip().generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    compression: 'DEFLATE',
  });
}

export function triggerDocxDownload(blob, filename = 'documento.docx') {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.docx') ? filename : `${filename}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
