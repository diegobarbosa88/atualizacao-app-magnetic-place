import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, LayoutList, BarChart2, LayoutGrid, RefreshCw, AlertTriangle, FileDown } from 'lucide-react';
import { MESES_PT } from '../../../lib/payroll/reciboCalculations.js';
import { useMapaSalarios } from './useMapaSalarios.js';
import MapaFolhaObra from './MapaFolhaObra.jsx';
import MapaPainelExecutivo from './MapaPainelExecutivo.jsx';
import MapaCartoes from './MapaCartoes.jsx';

const NAVY   = '#1B3A57';
const SLATE  = '#869AAF';
const ORANGE = '#EB8D00';
const BORDER = '#E2E7EC';

const LAYOUTS = [
  { id: 'folha',   label: 'Folha de Obra',   Icon: LayoutList },
  { id: 'painel',  label: 'Painel Executivo', Icon: BarChart2  },
  { id: 'cartoes', label: 'Cartões',          Icon: LayoutGrid },
];

function ArrowBtn({ onClick, children, title }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 28, height: 28, border: 'none', borderRadius: 7,
        background: hov ? '#fff' : 'transparent',
        color: hov ? ORANGE : SLATE,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', flexShrink: 0, transition: 'background .12s, color .12s',
      }}
    >
      {children}
    </button>
  );
}

export default function MapaSalarios() {
  const today = new Date();
  const [searchParams, setSearchParams] = useSearchParams();
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const mes    = Number(searchParams.get('mes')    || today.getMonth() + 1);
  const ano    = Number(searchParams.get('ano')    || today.getFullYear());
  const layout = searchParams.get('layout') || 'folha';

  const { rows, totals, loading, error, mesLabel } = useMapaSalarios(mes, ano);

  function navMes(delta) {
    let m = mes + delta;
    let a = ano;
    if (m < 1)  { m = 12; a--; }
    if (m > 12) { m = 1;  a++; }
    setSearchParams({ mes: String(m), ano: String(a), layout });
  }

  function setLayout(l) {
    setSearchParams({ mes: String(mes), ano: String(ano), layout: l });
  }

  async function handleDownloadPdf() {
    const el = document.getElementById('mapa-print-content');
    if (!el || generatingPdf) return;

    setGeneratingPdf(true);
    await new Promise(r => setTimeout(r, 80));

    try {
      const html2canvas = (await import('html2canvas-pro')).default;
      const { jsPDF } = await import('jspdf');

      if (document.fonts?.ready) await document.fonts.ready;

      const isLandscape = layout === 'folha' || layout === 'painel';
      const pdf = new jsPDF({ orientation: isLandscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();
      const MARGIN = 10;

      // Capture at the element's natural scroll width (handles wide tables correctly)
      const captureW = Math.max(el.scrollWidth, isLandscape ? 1060 : 794);

      const clone = el.cloneNode(true);
      const wrapper = document.createElement('div');
      wrapper.style.cssText = `position:fixed;left:-9999px;top:0;width:${captureW}px;background:white;z-index:-1;overflow:visible;`;
      wrapper.appendChild(clone);
      document.body.appendChild(wrapper);
      await new Promise(r => setTimeout(r, 200));

      const captureH = clone.scrollHeight;
      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: captureW,
        width: captureW,
        height: captureH,
      });

      document.body.removeChild(wrapper);

      // Scale image to fill usable page width; slice into pages
      const usableW = pdfW - 2 * MARGIN;
      const ratio   = canvas.width / usableW;  // px per mm
      const pageHpx = (pdfH - 2 * MARGIN) * ratio;

      let yOffset = 0;
      let firstPage = true;

      while (yOffset < canvas.height) {
        if (!firstPage) pdf.addPage();
        firstPage = false;

        const sliceHpx = Math.min(pageHpx, canvas.height - yOffset);
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width  = canvas.width;
        sliceCanvas.height = Math.round(sliceHpx);
        const ctx = sliceCanvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
        ctx.drawImage(canvas, 0, Math.round(yOffset), canvas.width, Math.round(sliceHpx), 0, 0, canvas.width, Math.round(sliceHpx));

        const sliceHmm = sliceCanvas.height / ratio;
        pdf.addImage(sliceCanvas.toDataURL('image/jpeg', 0.93), 'JPEG', MARGIN, MARGIN, usableW, sliceHmm);
        yOffset += pageHpx;
      }

      const safeName = mesLabel.replace(/\s+/g, '-');
      pdf.save(`Mapa-Salarios-${safeName}-${layout}.pdf`);
    } catch (err) {
      console.error('PDF generation failed:', err);
    } finally {
      setGeneratingPdf(false);
    }
  }

  const ActiveLayout = layout === 'painel' ? MapaPainelExecutivo : layout === 'cartoes' ? MapaCartoes : MapaFolhaObra;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, height: '100%' }}>

      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap',
        gap: 12, padding: '10px 20px',
        background: '#fff', borderBottom: `1px solid ${BORDER}`,
        position: 'sticky', top: 0, zIndex: 10,
      }}>

        {/* Esquerda: pill de mês + chips de estado */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>

          {/* Pill de navegação de mês */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 2,
            background: '#F5F7F9', border: `1px solid ${BORDER}`,
            borderRadius: 10, padding: 4,
          }}>
            <ArrowBtn onClick={() => navMes(-1)} title="Mês anterior">
              <ChevronLeft size={15} />
            </ArrowBtn>
            <div className="text-natural" style={{
              fontFamily: 'Poppins, Inter, sans-serif', fontWeight: 700,
              fontSize: 15, color: NAVY,
              padding: '0 10px', whiteSpace: 'nowrap',
            }}>
              {mesLabel}
            </div>
            <ArrowBtn onClick={() => navMes(+1)} title="Próximo mês">
              <ChevronRight size={15} />
            </ArrowBtn>
          </div>

          {/* Chips de estado */}
          {!loading && !error && rows.length > 0 && (
            <>
              <div className="text-natural" style={{
                display: 'flex', alignItems: 'center', gap: 6,
                borderRadius: 8, padding: '6px 12px',
                fontSize: 12, fontWeight: 600,
                border: `1px solid ${BORDER}`, color: '#69798B', background: '#fff',
              }}>
                <b style={{ fontFamily: "'Roboto Mono', monospace", color: NAVY, fontWeight: 600 }}>{totals.nWorkers}</b>
                trabalhadores
              </div>

              {totals.nCompletos > 0 && totals.nCompletos === totals.nWorkers && (
                <div className="text-natural" style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600,
                  border: '1px solid #86efac', color: '#16a34a', background: '#f0fdf4',
                }}>
                  {totals.nCompletos} completos
                </div>
              )}

              {totals.nDivergencias > 0 && (
                <div className="text-natural" style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600,
                  border: '1px solid #F0C077', background: '#FFF8EE', color: '#8a5800',
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: ORANGE, flexShrink: 0 }} />
                  <b style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700 }}>{totals.nDivergencias}</b>
                  divergência{totals.nDivergencias > 1 ? 's' : ''} a validar
                </div>
              )}

              {totals.nSemNIS > 0 && (
                <div className="text-natural" style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600,
                  border: '1px solid #fcd34d', background: '#fffbeb', color: '#d97706',
                }}>
                  {totals.nSemNIS} sem NIS
                </div>
              )}
            </>
          )}
        </div>

        {/* Direita: botão PDF + toggle de vista */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>

          {/* Botão PDF */}
          <button
            onClick={handleDownloadPdf}
            disabled={generatingPdf || loading || !rows.length}
            title={`Descarregar PDF (${layout === 'folha' || layout === 'painel' ? 'paisagem' : 'retrato'} A4)`}
            style={{
              border: `1px solid ${BORDER}`, borderRadius: 9, padding: '7px 14px',
              background: generatingPdf ? '#F5F7F9' : '#fff',
              color: generatingPdf ? SLATE : NAVY,
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 13, fontWeight: 600,
              cursor: (generatingPdf || loading || !rows.length) ? 'not-allowed' : 'pointer',
              opacity: (!rows.length || loading) ? 0.4 : 1,
              transition: 'background .12s',
            }}
          >
            {generatingPdf
              ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
              : <FileDown size={14} />
            }
            PDF
          </button>

          {/* Toggle de vista */}
          <div style={{ display: 'flex', background: '#F0F2F5', borderRadius: 10, padding: 3, gap: 2 }}>
            {LAYOUTS.map(({ id, label, Icon }) => {
              const isActive = layout === id;
              return (
                <button
                  key={id}
                  onClick={() => setLayout(id)}
                  title={label}
                  style={{
                    border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                    fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
                    background: isActive ? NAVY : 'transparent',
                    color: isActive ? '#fff' : '#69798B',
                    boxShadow: isActive ? '0 1px 3px rgba(27,58,87,.3)' : 'none',
                    transition: 'background .15s, color .15s',
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#E6E9EC'; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                >
                  <Icon size={14} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Conteúdo — id usado pelo gerador de PDF */}
      <div id="mapa-print-content" style={{ flex: 1, padding: '20px 24px', overflowY: 'auto' }}>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '60px 24px', color: '#8891A0' }}>
            <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: 13, fontWeight: 700 }}>A calcular {mesLabel}…</span>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        )}

        {!loading && error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '16px 20px', color: '#dc2626', fontSize: 13, fontWeight: 700 }}>
            <AlertTriangle size={14} style={{ display: 'inline', marginRight: 6 }} />
            Erro ao carregar dados: {error}
          </div>
        )}

        {!loading && !error && (
          <ActiveLayout rows={rows} totals={totals} mesLabel={mesLabel} />
        )}
      </div>
    </div>
  );
}
