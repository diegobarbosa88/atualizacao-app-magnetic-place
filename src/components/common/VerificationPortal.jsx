import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { CheckCircle, ShieldCheck, XCircle, Globe, FileText, User, Clock, Download } from 'lucide-react';

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

const Header = () => (
  <header className="bg-white border-b border-gray-200 py-5 sticky top-0 z-50">
    <div className="max-w-5xl mx-auto px-6 flex justify-between items-center">
      <div className="flex items-center space-x-3">
        <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-200">
          <ShieldCheck className="h-6 w-6 text-white" />
        </div>
        <div>
          <span className="text-xl font-bold text-gray-900 block leading-tight">
            Magnetic Place <span className="text-blue-600 font-light">Digital</span>
          </span>
          <span className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">Autenticidade Garantida</span>
        </div>
      </div>
      <div className="hidden sm:block">
        <div className="flex items-center space-x-2 text-xs font-medium text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span>Servidor Seguro Ativo</span>
        </div>
      </div>
    </div>
  </header>
);

const Footer = () => (
  <footer className="bg-white border-t border-gray-200 py-10 mt-auto">
    <div className="max-w-4xl mx-auto px-6 text-center">
      <p className="text-xs text-gray-400 mx-auto leading-loose text-center">
        Este portal é o ponto único de verificação para documentos emitidos pela Magnetic Place. A validação é efetuada em tempo real contra as bases de dados centrais.
      </p>
      <div className="mt-6 pt-6 border-t border-gray-50 flex flex-wrap justify-center gap-x-8 gap-y-4">
        <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">Magnetic Place • Validação Digital</span>
      </div>
    </div>
  </footer>
);

const DetailRow = ({ icon: Icon, label, value, mono }) => (
  <div className="flex items-start gap-3 bg-slate-50 rounded-xl p-4">
    <Icon size={18} className="text-indigo-600 mt-0.5 flex-shrink-0" />
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      <p className={`text-sm font-bold text-slate-800 mt-0.5 break-all ${mono ? 'font-mono text-xs' : ''}`}>{value}</p>
    </div>
  </div>
);

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
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Header />
        <main className="flex-grow flex flex-col items-center justify-center py-24">
          <div className="relative w-20 h-20 mb-6">
            <div className="absolute inset-0 border-4 border-blue-100 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <h3 className="text-lg font-semibold text-gray-800">Processando Pedido</h3>
          <p className="text-gray-500 text-sm mt-2">A validar integridade dos metadados...</p>
        </main>
        <Footer />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Header />
        <main className="flex-grow flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl shadow-xl border border-rose-100 overflow-hidden max-w-md w-full">
            <div className="py-8 px-6 text-center text-white" style={{ background: 'linear-gradient(135deg, #e11d48 0%, #f43f5e 100%)' }}>
              <div className="inline-flex items-center justify-center w-16 h-16 bg-white bg-opacity-20 rounded-full mb-3 border border-white border-opacity-30">
                <XCircle size={32} className="text-white" />
              </div>
              <h1 className="text-xl font-black">Não Verificado</h1>
              <p className="text-rose-100 text-sm mt-1">Assinatura inválida ou não encontrada</p>
            </div>
            <div className="p-6 text-center">
              <p className="text-sm text-slate-500">{error}</p>
              <p className="text-[10px] text-slate-400 mt-3 font-mono">ID: {signatureId}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-5 text-xs font-bold text-blue-600 hover:text-blue-700 uppercase tracking-widest"
              >
                Tentar novamente
              </button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const signature = data.signature_base64 || data.signature_data;
  const datetime = data.created_at || data.signed_at;
  const ip = data.client_ip || data.signed_ip;
  const id = data.id;
  const titular = data.worker_name || data.client_name || data.signer_name || null;
  const docType = source === 'client' ? 'Aprovação de Cliente' : 'Documento de Trabalhador';

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />

      <main className="flex-grow container mx-auto px-4 py-12 max-w-2xl space-y-6">

        {/* Card principal — Status */}
        <div className="bg-white rounded-[2rem] shadow-2xl shadow-blue-100 overflow-hidden border border-gray-100">
          <div
            className="py-10 px-6 text-center text-white"
            style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', boxShadow: '0 10px 15px -3px rgba(16,185,129,0.2)' }}
          >
            <div className="flex items-center justify-center w-20 h-20 rounded-full mb-4 bg-emerald-500 shadow-lg shadow-emerald-200 border-4 border-white">
              <CheckCircle size={40} className="text-white" strokeWidth={2.5} />
            </div>
            <h1 className="text-3xl font-extrabold mb-2 tracking-tight">Assinatura Verificada</h1>
            <p className="text-emerald-50 font-medium">Documento autenticado eletronicamente com validade plena.</p>
          </div>

          <div className="p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em]">Detalhes da Emissão</h2>
              <span className="px-2 py-1 bg-blue-50 text-blue-700 text-[10px] font-bold rounded uppercase">Original</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-12">
              <div>
                <p className="text-[11px] text-gray-400 font-bold uppercase mb-1">Tipo de Documento</p>
                <p className="text-gray-800 font-semibold">{docType}</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400 font-bold uppercase mb-1">ID de Verificação</p>
                <p className="font-mono text-gray-800 font-semibold text-xs break-all">{id}</p>
              </div>
              {titular && (
                <div>
                  <p className="text-[11px] text-gray-400 font-bold uppercase mb-1">Titular</p>
                  <p className="text-gray-800 font-semibold uppercase">{titular}</p>
                </div>
              )}
              <div>
                <p className="text-[11px] text-gray-400 font-bold uppercase mb-1">Data de Emissão</p>
                <p className="text-gray-800 font-semibold">{formatDateTime(datetime)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Card — Certificação Digital */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
          <div className="flex items-center space-x-2 mb-6">
            <div className="h-1 w-8 bg-blue-600 rounded-full"></div>
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Certificação Digital</h2>
          </div>

          <div className="space-y-4">
            <DetailRow icon={ShieldCheck} label="Autoridade de Verificação" value="Magnetic Place (Certificado Digital)" />
            <DetailRow icon={Clock} label="Selagem Temporal" value={formatDateTime(datetime)} />
            {ip && <DetailRow icon={Globe} label="Endereço IP de Origem" value={ip} mono />}
            {titular && <DetailRow icon={User} label="Titular" value={titular} />}
            <DetailRow icon={FileText} label="Tipo de Registo" value={docType} />
          </div>

          {/* Assinatura visual */}
          {signature && (
            <div className="mt-6 pt-5 border-t border-gray-50">
              <p className="text-[9px] font-bold text-gray-400 uppercase mb-2">Assinatura Manuscrita</p>
              <div className="bg-gray-50 rounded-lg p-4 flex items-center justify-center border border-gray-100">
                <img src={signature} alt="Assinatura" className="max-h-28 object-contain" />
              </div>
            </div>
          )}

          {/* Hash de referência */}
          <div className="mt-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-[9px] font-bold text-gray-400 uppercase mb-2">Referência de Integridade (ID)</p>
              <p className="text-[10px] font-mono text-gray-500 break-all leading-relaxed">
                {id}...[VERIFIED]
              </p>
            </div>
          </div>
        </div>

        {/* Botões de ação */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {source === 'worker' && data.signed_pdf_url ? (
            <a
              href={data.signed_pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold py-4 px-6 rounded-2xl transition duration-200 shadow-lg shadow-blue-100"
            >
              <FileText size={20} />
              <span>Ver Documento Original (PDF)</span>
            </a>
          ) : source === 'client' ? (
            <div className="flex items-center justify-center space-x-2 bg-gray-100 text-gray-400 font-bold py-4 px-6 rounded-2xl">
              <FileText size={20} />
              <span>Documento gerado via impressão</span>
            </div>
          ) : signature ? (
            <a
              href={signature}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold py-4 px-6 rounded-2xl transition duration-200 shadow-lg shadow-blue-100"
            >
              <Download size={20} />
              <span>Ver Assinatura</span>
            </a>
          ) : (
            <button
              disabled
              className="flex items-center justify-center space-x-2 bg-gray-100 text-gray-400 font-bold py-4 px-6 rounded-2xl cursor-not-allowed"
            >
              <FileText size={20} />
              <span>Documento indisponível</span>
            </button>
          )}
          <button
            onClick={() => window.location.reload()}
            className="flex items-center justify-center space-x-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-600 font-bold py-4 px-6 rounded-2xl transition duration-200 shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Nova Verificação</span>
          </button>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default VerificationPortal;
