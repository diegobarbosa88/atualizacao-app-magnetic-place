import { createClient } from '@supabase/supabase-js';

// Gestão do token de acesso do contabilista (obter / regenerar). Protegido
// validando a password de admin server-side, contra system_settings.admin_password
// — a mesma password usada para o login do admin, mas verificada aqui sem nunca
// ser exposta ao browser (ao contrário do login normal da app, que a lê via
// anon key). NÃO usar um secret VITE_*: qualquer valor com esse prefixo fica
// embutido no bundle JS público, anulando a proteção.

function supabaseAdmin() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

async function passwordValida(supabase, adminPassword) {
  if (!adminPassword) return false;
  const { data } = await supabase.from('system_settings').select('admin_password').eq('id', 1).maybeSingle();
  const senhaAtual = data?.admin_password;
  return !!senhaAtual && adminPassword === senhaAtual;
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'Configuração do servidor em falta' });
    }

    const supabase = supabaseAdmin();
    const { action, admin_password } = req.body || {};

    if (!(await passwordValida(supabase, admin_password))) {
      return res.status(401).json({ error: 'Password de admin incorreta.' });
    }

    if (action === 'regenerar') {
      const { error: revokeError } = await supabase
        .from('contador_acesso')
        .update({ ativo: false, revoked_at: new Date().toISOString() })
        .eq('ativo', true);
      if (revokeError) return res.status(500).json({ error: `Erro ao revogar token atual: ${revokeError.message}` });

      const { data: novo, error: insertError } = await supabase
        .from('contador_acesso')
        .insert({ descricao: 'Acesso resumo mensal - contabilista' })
        .select('token, created_at')
        .single();
      if (insertError) return res.status(500).json({ error: `Erro ao criar novo token: ${insertError.message}` });

      return res.status(200).json({ token: novo.token, created_at: novo.created_at });
    }

    // action 'obter' (default) — devolve o token ativo atual
    const { data: atual, error: fetchError } = await supabase
      .from('contador_acesso')
      .select('token, created_at')
      .eq('ativo', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) return res.status(500).json({ error: fetchError.message });
    if (!atual) return res.status(404).json({ error: 'Nenhum token ativo — regenera um novo.' });

    return res.status(200).json({ token: atual.token, created_at: atual.created_at });
  } catch (e) {
    return res.status(500).json({ error: e.message, stack: e.stack });
  }
}
