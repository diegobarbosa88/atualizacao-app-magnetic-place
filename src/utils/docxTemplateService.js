import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import ImageModule from 'docxtemplater-image-module-free';
import { TEMPLATE_FIELDS, getWorkerFieldValue, getClientFieldValue } from './templateFields';
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

// O Word divide texto em vários <w:r> (runs) por motivos invisíveis ao
// utilizador (verificação ortográfica, autocorreção, colar com formatação
// diferente) — quando isso parte um "{{tag}}" a meio, o Docxtemplater falha
// com "duplicate open/close tags". Funde runs adjacentes com a mesma
// formatação (mesmo w:rPr, ou nenhum dos dois) antes do parse, recompondo
// o texto de forma segura sem tocar em formatação real distinta.
function mergeSplitRunsInXml(xmlText) {
  const xmlDoc = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (xmlDoc.getElementsByTagName('parsererror').length > 0) return xmlText;

  ['w:proofErr', 'w:bookmarkStart', 'w:bookmarkEnd'].forEach(tag => {
    Array.from(xmlDoc.getElementsByTagName(tag)).forEach(el => el.parentNode?.removeChild(el));
  });

  const serializer = new XMLSerializer();
  const isMergeableRun = (run) => {
    const children = Array.from(run.children).map(c => c.tagName);
    const tCount = children.filter(t => t === 'w:t').length;
    return tCount === 1 && children.every(t => t === 'w:rPr' || t === 'w:t');
  };
  const rprSignature = (run) => {
    const rPr = run.getElementsByTagName('w:rPr')[0];
    return rPr ? serializer.serializeToString(rPr) : '';
  };

  Array.from(xmlDoc.getElementsByTagName('w:p')).forEach((p) => {
    const runs = Array.from(p.children).filter(c => c.tagName === 'w:r');
    let i = 0;
    while (i < runs.length - 1) {
      const a = runs[i];
      const b = runs[i + 1];
      if (isMergeableRun(a) && isMergeableRun(b) && rprSignature(a) === rprSignature(b)) {
        const tA = a.getElementsByTagName('w:t')[0];
        const tB = b.getElementsByTagName('w:t')[0];
        tA.textContent = (tA.textContent || '') + (tB.textContent || '');
        tA.setAttribute('xml:space', 'preserve');
        b.parentNode.removeChild(b);
        runs.splice(i + 1, 1);
      } else {
        i++;
      }
    }
  });

  return serializer.serializeToString(xmlDoc);
}

function repairSplitTagsInZip(zip) {
  const filePattern = /^word\/(document|header\d*|footer\d*)\.xml$/;
  Object.keys(zip.files)
    .filter(p => filePattern.test(p))
    .forEach(p => {
      try {
        const merged = mergeSplitRunsInXml(zip.files[p].asText());
        zip.file(p, merged);
      } catch (err) {
        console.warn(`Fusão de runs falhou em ${p} (a continuar):`, err);
      }
    });
}

function loadDocFromBuffer(arrayBuffer) {
  let zip;
  try {
    zip = new PizZip(arrayBuffer);
  } catch (err) {
    throw new Error('Ficheiro .docx inválido ou corrompido (zip ilegível).');
  }
  repairSplitTagsInZip(zip);
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

const DEFAULT_PAGE_MARGINS_MM = { top: 20, right: 20, bottom: 20, left: 20 };
const TWIPS_PER_MM = 56.6929;

export function extractPageGeometry(arrayBuffer) {
  try {
    const zip = new PizZip(arrayBuffer);
    const docXml = zip.file('word/document.xml')?.asText();
    if (!docXml) return { ...DEFAULT_PAGE_MARGINS_MM };
    const match = docXml.match(/<w:pgMar\b([^/>]*)\/?>/);
    if (!match) return { ...DEFAULT_PAGE_MARGINS_MM };
    const attrs = match[1];
    const read = (name) => {
      const m = attrs.match(new RegExp(`w:${name}="(-?\\d+)"`));
      return m ? Number(m[1]) : null;
    };
    const top = read('top');
    const right = read('right');
    const bottom = read('bottom');
    const left = read('left');
    const toMm = (twips) => (twips == null ? null : Math.max(0, twips / TWIPS_PER_MM));
    return {
      top: toMm(top) ?? DEFAULT_PAGE_MARGINS_MM.top,
      right: toMm(right) ?? DEFAULT_PAGE_MARGINS_MM.right,
      bottom: toMm(bottom) ?? DEFAULT_PAGE_MARGINS_MM.bottom,
      left: toMm(left) ?? DEFAULT_PAGE_MARGINS_MM.left,
    };
  } catch {
    return { ...DEFAULT_PAGE_MARGINS_MM };
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

export function buildRenderData(workerData = {}, systemData = {}, clientData = null) {
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
    } else if (f.source && f.source.startsWith('clients.')) {
      data[f.name] = getClientFieldValue(clientData || {}, `{${f.name}}`) || '';
    } else {
      data[f.name] = getWorkerFieldValue(workerData || {}, `{${f.name}}`) || '';
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

  repairSplitTagsInZip(zip);

  // Retrocompatibilidade: converte {{name}} em {name} para todos os campos
  // conhecidos (templates antigos onde foram usados duplos-chavetas).
  try {
    const FIELD_NAMES = KNOWN_FIELD_NAMES.map(f => f.name);
    const filePattern = /^word\/(document|header\d*|footer\d*)\.xml$/;
    Object.keys(zip.files)
      .filter(p => filePattern.test(p))
      .forEach(p => {
        let xml = zip.files[p].asText();
        let changed = false;
        FIELD_NAMES.forEach(name => {
          const re = new RegExp(`\\{\\{${name}\\}\\}`, 'g');
          if (re.test(xml)) {
            xml = xml.replace(re, `{${name}}`);
            changed = true;
          }
        });
        if (changed) zip.file(p, xml);
      });
  } catch (err) {
    console.warn('Pre-process tag delimiters falhou (a continuar):', err);
  }

  const modules = [];
  if (imageMap) {
    modules.push(new ImageModule({
      centered: false,
      fileType: 'docx',
      getImage: (tagValue) => imageMap[tagValue] || null,
      getSize: () => [280, 100],
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
