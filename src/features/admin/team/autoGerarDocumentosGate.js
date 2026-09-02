import { inferirCategoria } from '../../../constants/rhCategories';

// Documentos obrigatórios do Gate de Onboarding (onboarding_gate_itens,
// tipo='documento') — mesmo insert que handleGenerateDocuments faz quando o
// admin clica "Gerar" manualmente (src/hooks/useDocumentTemplates.js), só
// que disparado automaticamente na criação do trabalhador. Gerar aqui é só
// criar o registo 'pending' — o preenchimento do .docx acontece depois, ao
// assinar/descarregar, não há nada pesado a replicar.
//
// Chamada a partir de dois sítios — criação manual (TeamContext.jsx) e
// aprovação de onboarding (OnboardingPendentes.jsx) — extraída para aqui
// para os dois caminhos de criar um trabalhador novo não divergirem.
export async function autoGerarDocumentosGate(workerId) {
  const supabase = window.supabaseInstance;
  if (!supabase) return;

  const { data: itens } = await supabase
    .from('onboarding_gate_itens')
    .select('slug')
    .eq('tipo', 'documento')
    .eq('ativo', true);
  if (!itens?.length) return;

  const { data: templates } = await supabase
    .from('document_templates')
    .select('id, name, slug')
    .in('slug', itens.map(i => i.slug));
  if (!templates?.length) return;

  await supabase.from('worker_documents').insert(
    templates.map(t => ({
      template_id: t.id,
      worker_id: workerId,
      title: t.name,
      status: 'pending',
      created_at: new Date().toISOString(),
      categoria: inferirCategoria(t.name) || null,
    }))
  );
}
