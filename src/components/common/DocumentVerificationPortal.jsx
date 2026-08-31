import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ShieldCheck, XCircle, FileText, User, Clock } from 'lucide-react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const formatDateTime = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-PT', { dateStyle: 'long', timeStyle: 'short' });
  } catch {
    return iso;
  }
};

// Página pública de verificação para os documentos assinados via Fluxo 3
// (HTML→PDF.co, ver CLAUDE.md). Deliberadamente distinta de
// VerificationPortal.jsx (Fluxo 2): consulta a função RPC
// get_document_verification, que devolve só 4 colunas — nunca IP, nunca a
// imagem da assinatura, nunca um link direto para o PDF (decisão do Diego).
export default function DocumentVerificationPortal({ code }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!code || !supabase) { setLoading(false); return; }
      const { data: rows } = await supabase.rpc('get_document_verification', { p_code: code });
      if (!cancelled) {
        setData(rows?.[0] || null);
        setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [code]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#F5F3EE', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
      <header style={{ background: '#1B3A57', padding: '20px 24px' }}>
        <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: '#EB8D00', borderRadius: 10, padding: 8, display: 'flex' }}>
            <ShieldCheck size={22} color="#fff" />
          </div>
          <div>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: 15 }}>Magnetic Place</div>
            <div style={{ color: '#A9B8C7', fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Verificação de Documento</div>
          </div>
        </div>
      </header>

      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px' }}>
        <div style={{ width: '100%', maxWidth: 420, background: '#fff', borderRadius: 20, boxShadow: '0 10px 30px rgba(27,58,87,0.12)', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#5C7086' }}>A verificar...</div>
          ) : data ? (
            <>
              <div style={{ background: '#EFF7F1', padding: '32px 24px', textAlign: 'center' }}>
                <div style={{ display: 'inline-flex', width: 56, height: 56, borderRadius: '50%', background: '#1f6b47', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <ShieldCheck size={28} color="#fff" />
                </div>
                <div style={{ fontWeight: 800, fontSize: 18, color: '#1A1D21' }}>Documento autêntico</div>
                <div style={{ color: '#1f6b47', fontSize: 13, marginTop: 2 }}>Assinado eletronicamente pela Magnetic Place</div>
              </div>
              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <Row icon={FileText} label="Tipo de documento" value={data.document_title} />
                <Row icon={User} label="Trabalhador" value={data.worker_name} />
                <Row icon={Clock} label="Assinado em" value={formatDateTime(data.signed_at)} />
                <Row icon={ShieldCheck} label="Aprovado em" value={formatDateTime(data.admin_signed_at)} />
              </div>
            </>
          ) : (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ display: 'inline-flex', width: 56, height: 56, borderRadius: '50%', background: '#c70036', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <XCircle size={28} color="#fff" />
              </div>
              <div style={{ fontWeight: 800, fontSize: 16, color: '#1A1D21' }}>Código não encontrado</div>
              <div style={{ color: '#5C7086', fontSize: 13, marginTop: 4 }}>Verifique se o código foi introduzido corretamente.</div>
            </div>
          )}
        </div>
      </main>

      <footer style={{ textAlign: 'center', padding: '16px', color: '#5C7086', fontSize: 11 }}>
        Magnetic Place, Unipessoal, Lda — Validação Digital
      </footer>
    </div>
  );
}

function Row({ icon: Icon, label, value }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <Icon size={16} color="#EB8D00" style={{ marginTop: 2, flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5C7086' }}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1D21' }}>{value || '—'}</div>
      </div>
    </div>
  );
}
