import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { CheckCircle, ShieldCheck, Loader2, XCircle, Calendar, Globe, FileText, User } from 'lucide-react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ccvxnrnlbipsojbbrzaw.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_Ze9r5vColmrZGfhxMwDURg_i4EHktEJ';
const supabase = createClient(supabaseUrl, supabaseKey);

const formatDateTime = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-PT', { dateStyle: 'long', timeStyle: 'medium' });
  } catch {
    return iso;
  }
};

const VerificationPortal = ({ signatureId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [source, setSource] = useState(null); // 'client' | 'worker'

  useEffect(() => {
    let cancelled = false;
    const fetchSignature = async () => {
      if (!signatureId) {
        setError('ID de assinatura não fornecido.');
        setLoading(false);
        return;
      }

      try {
        // Tentar primeiro client_approvals (assinatura de cliente)
        const { data: clientData } = await supabase
          .from('client_approvals')
          .select('*')
          .eq('id', signatureId)
          .maybeSingle();

        if (!cancelled && clientData) {
          setData(clientData);
          setSource('client');
          setLoading(false);
          return;
        }

        // Senão, tentar worker_documents (assinatura de documento por trabalhador)
        const { data: workerData } = await supabase
          .from('worker_documents')
          .select('*')
          .eq('id', signatureId)
          .maybeSingle();

        if (!cancelled && workerData) {
          setData(workerData);
          setSource('worker');
          setLoading(false);
          return;
        }

        if (!cancelled) {
          setError('Assinatura não encontrada. O ID pode estar inválido ou a assinatura foi removida.');
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError('Erro ao consultar a assinatura: ' + (err.message || 'desconhecido'));
          setLoading(false);
        }
      }
    };

    fetchSignature();
    return () => { cancelled = true; };
  }, [signatureId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center">
          <Loader2 size={40} className="animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">A verificar assinatura…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-xl border border-rose-100 p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <XCircle size={32} className="text-rose-600" />
          </div>
          <h1 className="text-xl font-black text-slate-800 mb-2">Não verificado</h1>
          <p className="text-sm text-slate-500">{error}</p>
          <p className="text-[10px] text-slate-400 mt-4 font-mono">ID: {signatureId}</p>
        </div>
      </div>
    );
  }

  const signature = data.signature_base64 || data.signature_data;
  const datetime = data.created_at || data.signed_at;
  const ip = data.client_ip || data.signed_ip;
  const id = data.id;

  return (
    <div className="min-h-screen bg-slate-50 p-6 flex items-center justify-center">
      <div className="bg-white rounded-3xl shadow-2xl border border-emerald-100 p-8 max-w-2xl w-full">
        {/* Header com badge verde */}
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-100">
          <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
            <ShieldCheck size={32} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800">Assinatura Verificada</h1>
            <p className="text-sm font-bold text-emerald-600 flex items-center gap-1.5 mt-0.5">
              <CheckCircle size={14} /> Documento autenticado eletronicamente
            </p>
          </div>
        </div>

        {/* Imagem da assinatura */}
        {signature && (
          <div className="mb-6">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Assinatura</p>
            <div className="bg-slate-50 border-2 border-slate-100 rounded-2xl p-6 flex items-center justify-center">
              <img src={signature} alt="Assinatura" className="max-h-32 object-contain" />
            </div>
          </div>
        )}

        {/* Detalhes */}
        <div className="space-y-3">
          <div className="flex items-start gap-3 bg-slate-50 rounded-xl p-4">
            <Calendar size={18} className="text-indigo-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Data e Hora</p>
              <p className="text-sm font-bold text-slate-800 mt-0.5">{formatDateTime(datetime)}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-slate-50 rounded-xl p-4">
            <Globe size={18} className="text-indigo-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Endereço IP</p>
              <p className="text-sm font-bold text-slate-800 mt-0.5">{ip || '—'}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-slate-50 rounded-xl p-4">
            <FileText size={18} className="text-indigo-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ID da Assinatura</p>
              <p className="text-xs font-mono font-bold text-slate-800 mt-0.5 break-all">{id}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-slate-50 rounded-xl p-4">
            <User size={18} className="text-indigo-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo</p>
              <p className="text-sm font-bold text-slate-800 mt-0.5">
                {source === 'client' ? 'Aprovação de cliente (relatório de horas)' : 'Assinatura de trabalhador (documento)'}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Magnetic Place • Validação Digital
          </p>
        </div>
      </div>
    </div>
  );
};

export default VerificationPortal;
