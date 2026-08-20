import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '../_authUtils.js';

const META_HORAS_ANO = 40;

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAuth(req, res, ['admin'])) return;

  const ano = req.query.ano || String(new Date().getFullYear());
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // Categorias com exige_entidade_externa (certificação formal, GWO) seguem
  // lógica de validade própria — não entram no cômputo anual das 40h.
  const { data, error } = await supabase
    .from('formacao_participantes')
    .select('worker_id, workers(name), formacoes_internas!inner(duracao_horas, data_inicio, exige_entidade_externa)')
    .eq('formacoes_internas.exige_entidade_externa', false)
    .gte('formacoes_internas.data_inicio', `${ano}-01-01`)
    .lte('formacoes_internas.data_inicio', `${ano}-12-31`);

  if (error) return res.status(500).json({ error: error.message });

  const porTrabalhador = new Map();
  for (const row of data || []) {
    const atual = porTrabalhador.get(row.worker_id) || { worker_id: row.worker_id, nome: row.workers?.name || row.worker_id, horas: 0 };
    atual.horas += Number(row.formacoes_internas?.duracao_horas || 0);
    porTrabalhador.set(row.worker_id, atual);
  }

  const resultado = [...porTrabalhador.values()]
    .map(w => ({ ...w, meta: META_HORAS_ANO, cumprido: w.horas >= META_HORAS_ANO }))
    .sort((a, b) => a.nome.localeCompare(b.nome));

  return res.status(200).json({ ano, meta: META_HORAS_ANO, trabalhadores: resultado });
}
