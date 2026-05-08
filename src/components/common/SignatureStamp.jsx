import React from 'react';
import { CheckCircle } from 'lucide-react';

const SignatureStamp = ({ signature, workerName, ip, datetime, id }) => {
  // We use inline styles with hex/rgb to avoid html2canvas failing on oklch colors (Tailwind v4 default)
  return (
    <div className="flex flex-col items-end">
      <div 
        className="rounded-2xl p-2 relative overflow-hidden shadow-sm flex items-center gap-1 border-2"
        style={{ backgroundColor: '#f8fafc', borderColor: '#e0e7ff' }}
      >
        <div className="absolute top-0 right-0 p-1 opacity-5">
          <CheckCircle size={40} />
        </div>

        <div 
          className="rounded-lg p-1.5 shadow-inner border"
          style={{ backgroundColor: '#ffffff', borderColor: '#f1f5f9' }}
        >
          {signature ? (
            <img
              src={signature}
              alt="Assinatura"
              className="h-12 w-auto mix-blend-multiply"
            />
          ) : (
            <div className="w-20 h-10 rounded animate-pulse" style={{ backgroundColor: '#f1f5f9' }} />
          )}
        </div>

        <div className="flex flex-col">
          <div 
            className="flex items-center gap-1.5 font-black text-[9px] uppercase tracking-widest mb-0.5"
            style={{ color: '#4f46e5' }}
          >
            <span 
              className="text-white p-0.5 rounded-sm"
              style={{ backgroundColor: '#4f46e5' }}
            >
              <CheckCircle size={8} />
            </span>
            VALIDAÇÃO DIGITAL
          </div>

          <div className="space-y-0">
            <p className="text-[6.5px] font-bold uppercase tracking-tight flex justify-between gap-3" style={{ color: '#64748b' }}>
              <span>Data/Hora:</span>
              <span className="font-black" style={{ color: '#1e293b' }}>
                {datetime ? new Date(datetime).toLocaleString('pt-PT') : '05/05/2026, 12:47:02'}
              </span>
            </p>
            <p className="text-[6.5px] font-bold uppercase tracking-tight flex justify-between gap-3" style={{ color: '#64748b' }}>
              <span>Endereço IP:</span>
              <span className="font-black" style={{ color: '#1e293b' }}>{ip || '85.50.224.113'}</span>
            </p>
            <p 
              className="text-[6.5px] font-bold uppercase tracking-tight flex justify-between gap-3 mt-0.5 pt-0.5 border-t"
              style={{ color: '#94a3b8', borderTopColor: '#f1f5f9' }}
            >
              <span>ID:</span>
              <span className="font-mono" style={{ color: '#94a3b8' }}>{id ? id.substring(0, 16) + '...' : 'C_APPR_C17754919...'}</span>
            </p>
          </div>
        </div>
      </div>

      <p className="text-[5px] font-bold mt-0.5 uppercase tracking-[0.2em]" style={{ color: '#94a3b8' }}>
        Documento validado eletronicamente
      </p>
    </div>
  );
};

export default SignatureStamp;