window.__toggleTipoLink = function(t, supabase, onSuccess) {
  if (!t.linkId) {
    console.error('[toggleTipoLink] missing linkId', t);
    return;
  }
  const novoTipo = t.type === 'Adiantamento' ? 'Liquidação' : 'Adiantamento';
  supabase.from('movimentacao_recibo_links').update({ tipo: novoTipo }).eq('id', t.linkId)
    .then(res => {
      if (res.error) {
        console.error('[toggleTipoLink] update error:', res.error);
        alert('Erro ao atualizar: ' + res.error.message);
      } else {
        onSuccess && onSuccess();
      }
    })
    .catch(err => {
      console.error('[toggleTipoLink] error:', err);
      alert('Erro ao atualizar: ' + err.message);
    });
};