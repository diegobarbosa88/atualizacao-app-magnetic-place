window.__toggleTipoLink = function(t, supabase, onSuccess) {
  if (!t.linkId) return;
  const novoTipo = t.type === 'Adiantamento' ? 'Liquidação' : 'Adiantamento';
  supabase.from('movimentacao_recibo_links').update({ tipo: novoTipo }).eq('id', t.linkId)
    .then(res => {
      if (res.error) {
        alert('Erro ao atualizar: ' + res.error.message);
      } else {
        onSuccess && onSuccess();
      }
    });
};