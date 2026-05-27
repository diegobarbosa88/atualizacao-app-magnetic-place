window.__toggleTipoLink = function(t, supabase) {
  if (!t.linkId) {
    console.error('[toggleTipoLink] missing linkId', t);
    return;
  }
  const novoTipo = t.type === 'Adiantamento' ? 'Liquidação' : 'Adiantamento';
  console.log('[toggleTipoLink] updating linkId:', t.linkId, 'to', novoTipo);
  supabase.from('movimentacao_recibo_links').update({ tipo: novoTipo }).eq('id', t.linkId)
    .then(res => {
      console.log('[toggleTipoLink] result:', res);
      window.location.reload();
    })
    .catch(err => {
      console.error('[toggleTipoLink] error:', err);
      alert('Erro ao atualizar: ' + err.message);
    });
};