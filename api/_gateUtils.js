// Lógica do Gate de Onboarding — se um trabalhador ainda tem documentos por
// assinar ou formações por concluir das marcadas em onboarding_gate_itens.
// Partilhado entre api/auth.js (login/impersonate) e api/formacao/index.js
// (ação "gate-status", para o ecrã de gate reavaliar depois de cada item
// concluído) — ficheiro utilitário, não é rota própria, mesmo padrão de
// api/_authUtils.js.

export async function getGateStatus(supabase, workerId) {
  const { data: worker } = await supabase
    .from('workers')
    .select('onboarding_gate_concluido_em')
    .eq('id', workerId)
    .single();

  if (worker?.onboarding_gate_concluido_em) return { pendente: false, itens: [] };

  const { data: gateItens } = await supabase
    .from('onboarding_gate_itens')
    .select('tipo, slug, label')
    .eq('ativo', true);

  if (!gateItens?.length) return await marcarConcluido(supabase, workerId);

  const pendentes = [];
  const itensDocumento = gateItens.filter(i => i.tipo === 'documento');
  const itensFormacao = gateItens.filter(i => i.tipo === 'formacao');

  if (itensDocumento.length) {
    const { data: templates } = await supabase
      .from('document_templates')
      .select('id, slug')
      .in('slug', itensDocumento.map(i => i.slug));

    for (const item of itensDocumento) {
      const template = templates?.find(t => t.slug === item.slug);
      if (!template) {
        pendentes.push({ tipo: 'documento', slug: item.slug, label: item.label, worker_document_id: null });
        continue;
      }
      const { data: doc } = await supabase
        .from('worker_documents')
        .select('id, signed_at')
        .eq('worker_id', workerId)
        .eq('template_id', template.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!doc?.signed_at) {
        pendentes.push({ tipo: 'documento', slug: item.slug, label: item.label, worker_document_id: doc?.id || null });
      }
    }
  }

  if (itensFormacao.length) {
    const { data: formacoes } = await supabase
      .from('formacoes_internas')
      .select('id, slug')
      .in('slug', itensFormacao.map(i => i.slug));

    for (const item of itensFormacao) {
      const formacao = formacoes?.find(f => f.slug === item.slug);
      if (!formacao) {
        pendentes.push({ tipo: 'formacao', slug: item.slug, label: item.label, formacao_id: null, participante_id: null });
        continue;
      }
      const { data: participante } = await supabase
        .from('formacao_participantes')
        .select('id, estado_conclusao')
        .eq('worker_id', workerId)
        .eq('formacao_id', formacao.id)
        .maybeSingle();
      if (participante?.estado_conclusao !== 'concluido') {
        pendentes.push({
          tipo: 'formacao', slug: item.slug, label: item.label,
          formacao_id: formacao.id, participante_id: participante?.id || null,
        });
      }
    }
  }

  if (pendentes.length === 0) return await marcarConcluido(supabase, workerId);
  return { pendente: true, itens: pendentes };
}

async function marcarConcluido(supabase, workerId) {
  await supabase.from('workers').update({ onboarding_gate_concluido_em: new Date().toISOString() }).eq('id', workerId);
  return { pendente: false, itens: [] };
}
