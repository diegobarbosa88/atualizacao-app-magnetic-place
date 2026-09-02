import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { HardHat, ListChecks, Boxes, Users } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import SectionHeaderShell from '../../../components/common/SectionHeaderShell';
import EpiRequestsTab from './EpiRequestsTab';
import EpiCatalogTab from './EpiCatalogTab';
import EpiWorkerSettingsTab from './EpiWorkerSettingsTab';
import { lowStockEntries } from '../../../utils/epiHelpers';

// Secção nova, lançada oculta do lado do trabalhador (só workers.epi_enabled
// = true veem "Solicitar EPI" no próprio dashboard — ver WorkerDashboard.jsx
// e a migração 20260902_epi_solicitacao.sql). O admin vê sempre esta secção,
// mesmo sem nenhum trabalhador ainda habilitado — precisa de poder preparar
// o catálogo/elegibilidade antes de ligar o acesso a mais gente.
export default function EpiAdmin() {
  const { supabase, workers, clients, currentUser } = useApp();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(() => searchParams.get('subtab') || 'pedidos');

  useEffect(() => {
    const t = searchParams.get('subtab');
    if (t) setTab(t);
  }, [searchParams]);

  const [types, setTypes] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!supabase) return;
    const [{ data: typesData, error: typesErr }, { data: reqData, error: reqErr }] = await Promise.all([
      supabase.from('epi_types').select('*').order('created_at'),
      supabase.from('epi_requests').select('*').order('created_at', { ascending: false }),
    ]);
    if (typesErr) console.error('Erro ao carregar epi_types:', typesErr);
    if (reqErr) console.error('Erro ao carregar epi_requests:', reqErr);
    setTypes(typesData || []);
    setRequests(reqData || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { reload(); }, [reload]);

  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const lowStock = lowStockEntries(types);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      {lowStock.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap bg-rose-50 text-rose-700 border border-rose-100 rounded-xl px-4 py-2.5 text-xs font-semibold mb-4">
          <span className="font-black">⚠ Stock baixo:</span>
          {lowStock.map((e) => `${e.label} (${e.stock})`).join(' · ')}
        </div>
      )}
      <SectionHeaderShell
        icon={<HardHat size={18} />}
        title="EPI"
        subtitle="Solicitação de equipamento de proteção individual"
        tabs={[
          { id: 'pedidos', label: 'Pedidos', icon: ListChecks, badge: pendingCount || null },
          { id: 'catalogo', label: 'Catálogo', icon: Boxes },
          { id: 'trabalhadores', label: 'Por Trabalhador', icon: Users },
        ]}
        activeTab={tab}
        onTabChange={setTab}
      />

      {tab === 'pedidos' && (
        <EpiRequestsTab
          requests={requests}
          types={types}
          workers={workers}
          clients={clients}
          currentUser={currentUser}
          supabase={supabase}
          onChange={reload}
          loading={loading}
        />
      )}
      {tab === 'catalogo' && (
        <EpiCatalogTab types={types} requests={requests} supabase={supabase} onChange={reload} />
      )}
      {tab === 'trabalhadores' && (
        <EpiWorkerSettingsTab types={types} workers={workers} supabase={supabase} />
      )}
    </div>
  );
}
