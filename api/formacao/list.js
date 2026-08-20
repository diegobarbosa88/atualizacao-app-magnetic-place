import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '../_authUtils.js';

const DIAS_A_EXPIRAR = 60;

function calcularEstado(dataValidade) {
  if (!dataValidade) return null;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const validade = new Date(dataValidade);
  const diffDias = Math.floor((validade - hoje) / 86400000);
  if (diffDias < 0) return 'expirado';
  if (diffDias <= DIAS_A_EXPIRAR) return 'a_expirar';
  return 'valido';
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAuth(req, res, ['admin'])) return;

  const { worker_id, ano, categoria, estado } = req.query;
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  let query = supabase
    .from('formacoes_internas')
    .select('*, formador:formador_id(name), formacao_participantes(id, worker_id, assinatura_url, assinado_em, data_validade, iniciado_em, concluido_em, nota_obtida, estado_conclusao, workers(name))')
    .order('data_inicio', { ascending: false });

  if (ano) {
    query = query.gte('data_inicio', `${ano}-01-01`).lte('data_inicio', `${ano}-12-31`);
  }
  if (categoria) {
    query = query.eq('categoria', categoria);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  let formacoes = data || [];

  for (const f of formacoes) {
    for (const p of f.formacao_participantes) {
      p.estado = calcularEstado(p.data_validade);
      if (p.assinatura_url) {
        const { data: signed } = await supabase.storage
          .from('formacao-interna')
          .createSignedUrl(p.assinatura_url, 3600);
        p.assinatura_signed_url = signed?.signedUrl || null;
      }
    }
  }

  if (worker_id) {
    formacoes = formacoes.filter(f => f.formacao_participantes.some(p => p.worker_id === worker_id));
  }
  if (estado) {
    formacoes = formacoes.filter(f => f.formacao_participantes.some(p => p.estado === estado));
  }

  return res.status(200).json({ formacoes });
}
