// Lógica do Gate de Onboarding — se um trabalhador ainda tem documentos por
// assinar ou formações por concluir das marcadas em onboarding_gate_itens.
// Partilhado entre api/auth.js (login/impersonate) e api/formacao/index.js
// (ação "gate-status", para o ecrã de gate reavaliar depois de cada item
// concluído) — ficheiro utilitário, não é rota própria, mesmo padrão de
// api/_authUtils.js.
//
// Autocura (2026-09-04): a atribuição automática de documentos/formações
// na aprovação de onboarding (OnboardingPendentes.jsx) é "fire-and-forget"
// — uma falha aí (transitória ou não) nunca bloqueia a aprovação, mas
// também nunca mais se corrige sozinha, deixando o trabalhador preso no
// Gate com "contacta o administrador" para sempre (aconteceu 2x já — Maria
// Joanna Galtieri Barbosa em 2026-09-02, Kaian Martino Redondo em
// 2026-09-04, ambos reparados manualmente via SQL). Em vez de só reparar o
// caso a caso, getGateStatus() passa a criar aqui o worker_documents/
// formacao_participantes em falta sempre que os deteta — cada vez que o
// Gate carrega (login, ou "reavaliar" depois de cada item), não só na
// aprovação — por isso um gap nunca fica permanente, independentemente da
// causa da falha original.
import { inferirCategoria } from '../src/constants/rhCategories.js';

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
      .select('id, slug, name')
      .in('slug', itensDocumento.map(i => i.slug));

    for (const item of itensDocumento) {
      const template = templates?.find(t => t.slug === item.slug);
      if (!template) {
        pendentes.push({ tipo: 'documento', slug: item.slug, label: item.label, worker_document_id: null });
        continue;
      }
      let { data: doc } = await supabase
        .from('worker_documents')
        .select('id, signed_at')
        .eq('worker_id', workerId)
        .eq('template_id', template.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!doc) {
        // Autocura — ver nota no topo do ficheiro. Mesmo insert que
        // autoGerarDocumentosGate.js já faz na criação normal do worker.
        const { data: novoDoc } = await supabase
          .from('worker_documents')
          .insert({
            template_id: template.id, worker_id: workerId, title: template.name,
            status: 'pending', created_at: new Date().toISOString(),
            categoria: inferirCategoria(template.name) || null,
          })
          .select('id, signed_at')
          .single();
        doc = novoDoc;
      }
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
      let { data: participante } = await supabase
        .from('formacao_participantes')
        .select('id, estado_conclusao')
        .eq('worker_id', workerId)
        .eq('formacao_id', formacao.id)
        .maybeSingle();
      if (!participante) {
        // Autocura — ver nota no topo do ficheiro. data_validade fica null
        // (correto para as categorias hoje usadas no Gate — nenhuma exige
        // validade; ver CATEGORIAS_EXIGEM_VALIDADE em api/formacao/index.js).
        // Se um dia um item do Gate for de categoria com validade
        // obrigatória, isto não a calcula — precisaria de replicar essa
        // lógica aqui.
        const { data: novoParticipante } = await supabase
          .from('formacao_participantes')
          .insert({ formacao_id: formacao.id, worker_id: workerId, data_validade: null })
          .select('id, estado_conclusao')
          .single();
        participante = novoParticipante;
      }
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
