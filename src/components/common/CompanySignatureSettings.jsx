import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { FileSignature, PenTool, Loader2, CheckCircle } from 'lucide-react';
import ValidationStampAdmin from './ValidationStampAdmin';
import CompanyValidationStamp from './CompanyValidationStamp';
import CompanyClassicStamp from './CompanyClassicStamp';
import CompanyCorporateStamp from './CompanyCorporateStamp';
import AdminSignDrawModal from './AdminSignDrawModal';

export default function CompanySignatureSettings({ companySignature, saveCompanySignature }) {
  const { stampStyle, setStampStyle } = useApp();
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');
  const [sigDataUrl, setSigDataUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showSignaturePad, setShowSignaturePad] = useState(false);

  useEffect(() => {
    setName(companySignature?.responsibleName || '');
    setRole(companySignature?.responsibleRole || '');
    setEmail(companySignature?.responsibleEmail || '');
    setSigDataUrl(companySignature?.signatureDataUrl || '');
  }, [companySignature?.responsibleName, companySignature?.responsibleRole, companySignature?.responsibleEmail, companySignature?.signatureDataUrl]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await saveCompanySignature({
        responsibleName: name.trim(),
        responsibleRole: role.trim(),
        responsibleEmail: email.trim(),
        signatureDataUrl: sigDataUrl,
      });
      setMessage('Assinatura da empresa guardada com sucesso.');
    } catch (err) {
      setError('Erro ao guardar: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-slate-100">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600"><FileSignature size={20} /></div>
        <h3 className="font-black text-lg text-slate-800">Assinatura da Empresa</h3>
      </div>
      <p className="text-xs text-slate-500 mb-6">
        Carimbo aplicado pelo responsável da Magnetic Place quando aprova um documento assinado pelo trabalhador.
      </p>

      <div className="space-y-4">
        <div>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-1">Nome do Responsável</p>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: João Silva"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
          />
        </div>
        <div>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-1">Cargo</p>
          <input
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Ex: Diretor, Gestor de RH"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
          />
        </div>
        <div>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-1">Email do Responsável</p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@magneticplace.pt"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
          />
          <p className="text-[10px] text-slate-400 mt-1">Recebe notificações de validação (correções, assinaturas mensais).</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-1">Imagem da Assinatura</p>
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <div className="flex-1">
              <button
                onClick={() => setShowSignaturePad(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl transition-colors w-fit"
              >
                <PenTool size={16} />
                {sigDataUrl ? 'Redesenhar assinatura' : 'Desenhar assinatura'}
              </button>
              <p className="text-[11px] text-slate-400 mt-2">Desenhe a sua assinatura digital diretamente no ecrã.</p>
            </div>
            <div className="w-40 h-20 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0 bg-white">
              {sigDataUrl ? (
                <img src={sigDataUrl} alt="Assinatura" className="max-w-full max-h-full object-contain" />
              ) : (
                <span className="text-[10px] text-slate-400 font-bold uppercase text-center">Sem assinatura</span>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-lg p-2 font-bold">{error}</div>
        )}
        {message && (
          <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg p-2 font-bold">{message}</div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          Guardar
        </button>

        <div className="pt-6 mt-2 border-t border-slate-100 space-y-4">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Estilo do carimbo aplicado aos documentos
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setStampStyle('mirror')}
              className={`p-4 rounded-2xl border-2 text-left transition-all ${stampStyle === 'mirror' ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white hover:border-blue-300'}`}
            >
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-800">Espelho · Estilo Trabalhador</div>
              <div className="text-[10px] text-slate-500 mt-1">Mesmo layout do trabalhador, paleta azul, com assinatura e cargo</div>
            </button>
            <button
              type="button"
              onClick={() => setStampStyle('classic')}
              className={`p-4 rounded-2xl border-2 text-left transition-all ${stampStyle === 'classic' ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 bg-white hover:border-indigo-300'}`}
            >
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-800">Logo + Assinatura</div>
              <div className="text-[10px] text-slate-500 mt-1">Logo da empresa + assinatura desenhada azul</div>
            </button>
            <button
              type="button"
              onClick={() => setStampStyle('corporate')}
              className={`p-4 rounded-2xl border-2 text-left transition-all ${stampStyle === 'corporate' ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 bg-white hover:border-indigo-300'}`}
            >
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-800">Corporate · Multinacional</div>
              <div className="text-[10px] text-slate-500 mt-1">Marinho + dourado, selo CERTIFIED ORIGINAL, logo proeminente</div>
            </button>
            <button
              type="button"
              onClick={() => setStampStyle('tech')}
              className={`p-4 rounded-2xl border-2 text-left transition-all ${stampStyle === 'tech' ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 bg-white hover:border-indigo-300'}`}
            >
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-800">Tech Data-Grid</div>
              <div className="text-[10px] text-slate-500 mt-1">Auditoria técnica + token (sem assinatura desenhada)</div>
            </button>
          </div>

          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pt-2">
            Pré-visualização
          </p>
          {stampStyle === 'mirror' ? (
            <ValidationStampAdmin
              responsibleName={name || 'Nome do Responsável'}
              responsibleRole={role}
              signedAt={new Date().toISOString()}
              ip="192.168.x.x"
              signatureDataUrl={sigDataUrl}
              companyLogoUrl="/icon-512x512.png"
            />
          ) : stampStyle === 'classic' ? (
            <CompanyClassicStamp
              responsibleName={name || 'Nome do Responsável'}
              responsibleRole={role}
              signedAt={new Date().toISOString()}
              signatureDataUrl={sigDataUrl}
            />
          ) : stampStyle === 'corporate' ? (
            <CompanyCorporateStamp
              responsibleName={name || 'Nome do Responsável'}
              responsibleRole={role}
              signedAt={new Date().toISOString()}
              signatureDataUrl={sigDataUrl}
            />
          ) : (
            <CompanyValidationStamp
              responsibleName={name || 'Nome do Responsável'}
              responsibleRole={role}
              signedAt={new Date().toISOString()}
              ip="192.168.x.x"
              id={`prev_${Date.now().toString(16).slice(-8)}`}
              signatureDataUrl={sigDataUrl}
            />
          )}
        </div>
      </div>

      {showSignaturePad && (
        <AdminSignDrawModal
          onClose={() => setShowSignaturePad(false)}
          onSign={(dataUrl) => {
            setSigDataUrl(dataUrl);
            setShowSignaturePad(false);
            setError('');
          }}
          userName={name || 'Responsável'}
        />
      )}
    </div>
  );
}
