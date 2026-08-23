import React from 'react';
import { CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { NAVY, ORANGE, SLATE_A, BORDER, VAL_NEUT, n2 } from './mapaUtils.js';
import { FT } from '../../../styles/designTokens';

const MONO = "'Roboto Mono', 'Courier New', monospace";
const INK  = '#1F2420';

// g1 — cabeçalho de grupo (NAVY)
const GRP_HDR = {
  background: NAVY, color: '#fff',
  fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '.6px',
  textAlign: 'center', padding: '7px 8px', whiteSpace: 'nowrap',
};

// g2 — cabeçalho de coluna
const COL_HDR = {
  background: '#EDEAE0', color: '#5B6660',
  fontSize: 10.5, fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '.6px',
  textAlign: 'right', padding: '7px 8px', whiteSpace: 'nowrap',
  borderBottom: `2px solid ${BORDER}`,
};
const COL_HDR_L = { ...COL_HDR, textAlign: 'left' };

// Célula numérica base — Roboto Mono, 12.5px, 8px padding
const CELL = {
  fontSize: 12.5, fontWeight: 500, textAlign: 'right',
  padding: '8px', fontVariantNumeric: 'tabular-nums',
  fontFamily: MONO, color: NAVY, whiteSpace: 'nowrap',
};
// Colunas não calculadas (TOConline) — valor 0, tom apagado
const CELL_ZERO = { ...CELL, color: '#C4CBD4' };
// SS e IRS — neutro
const CELL_DISC = { ...CELL, color: VAL_NEUT };
// Linha de totais — fundo NAVY
const TOTL = { ...CELL, background: NAVY, color: '#fff', fontWeight: 700 };
const TOTL_L = { ...TOTL, textAlign: 'left', fontFamily: 'Inter, sans-serif' };

function StatusCell({ row }) {
  if (row.fonte === 'ambigua') {
    return (
      <span title="Correspondência ambígua com o recibo (nome duplicado/semelhante) — revisão manual necessária"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: '#fee2e2', color: '#dc2626', borderRadius: 6, padding: '2px 7px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>
        <AlertTriangle size={9} />Ambíguo
      </span>
    );
  }
  if (row.fonte === 'recibo-nome') {
    return (
      <span title="Dados do recibo já processado — correspondência por nome, confirmar"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: '#fef3c7', color: '#d97706', borderRadius: 6, padding: '2px 7px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>
        <AlertTriangle size={9} />Recibo (nome)
      </span>
    );
  }
  if (row.fonte === 'recibo-id') {
    return (
      <span title="Dados do recibo já processado (sem registo de horário no mês)"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: '#dbeafe', color: '#2563eb', borderRadius: 6, padding: '2px 7px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>
        <Info size={9} />Recibo
      </span>
    );
  }
  if (row.fonte === 'sem-dados') {
    return (
      <span title="Sem registo de horário nem recibo processado para este mês"
        style={{ fontSize: 8, background: '#F1F3F5', color: FT.slateDim, borderRadius: 5, padding: '2px 6px', fontWeight: 700, textTransform: 'uppercase' }}>
        Sem dados
      </span>
    );
  }
  if (row.isCompleto && row.divergencia == null) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: '#dcfce7', color: '#16a34a', borderRadius: 6, padding: '2px 7px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>
        <CheckCircle size={9} />OK
      </span>
    );
  }
  if (row.divergencia != null) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: '#fee2e2', color: '#dc2626', borderRadius: 6, padding: '2px 7px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>
          <AlertTriangle size={9} />Div.
        </span>
        <span style={{ fontSize: 9, color: '#dc2626', fontWeight: 600, fontFamily: MONO }}>
          {row.divergencia > 0 ? '+' : ''}{n2(row.divergencia)}
        </span>
      </div>
    );
  }
  if (row.semNIS) {
    return (
      <span style={{ fontSize: 8, background: '#fef3c7', color: '#d97706', borderRadius: 5, padding: '2px 6px', fontWeight: 700, textTransform: 'uppercase' }}>
        Sem NIS
      </span>
    );
  }
  return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#E3E7EC' }} />;
}

export default function MapaFolhaObra({ rows, totals }) {
  if (!rows.length) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 24px', color: SLATE_A }}>
        <Info size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
        <p style={{ fontSize: 14, fontWeight: 700 }}>Sem trabalhadores activos com vencimento configurado</p>
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto', borderRadius: 12, border: `1px solid ${BORDER}`, background: '#fff' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1380 }}>
        <thead>
          {/* g1 — linha de grupos */}
          <tr>
            <th colSpan={2} style={{ ...COL_HDR_L, background: '#EDEAE0', borderRight: `2px solid ${BORDER}` }} />
            <th colSpan={5} style={{ ...GRP_HDR, borderRight: '1px solid rgba(255,255,255,0.2)' }}>Vencimentos a Pagar</th>
            <th colSpan={3} style={{ ...GRP_HDR, background: '#2a4f6e', borderRight: '1px solid rgba(255,255,255,0.2)' }}>Recibo</th>
            <th colSpan={6} style={{ ...GRP_HDR, background: '#1f3f5e', borderRight: `2px solid ${BORDER}` }}>Descontos</th>
            <th colSpan={2} style={{ ...COL_HDR, background: '#EDEAE0', textAlign: 'center' }} />
          </tr>
          {/* g2 — linha de colunas */}
          <tr>
            <th style={{ ...COL_HDR_L, width: 36,  position: 'sticky', left: 0,  zIndex: 2 }}>#</th>
            <th style={{ ...COL_HDR_L, width: 190, position: 'sticky', left: 36, zIndex: 2, borderRight: `2px solid ${BORDER}` }}>Nome</th>
            <th style={{ ...COL_HDR, width: 95 }}>Receber</th>
            <th style={{ ...COL_HDR, width: 78, color: '#C4CBD4' }}>Acréscimos</th>
            <th style={{ ...COL_HDR, width: 78, color: '#C4CBD4' }}>Retenção</th>
            <th style={{ ...COL_HDR, width: 78, color: '#C4CBD4' }}>Subsd./Prém.</th>
            <th style={{ ...COL_HDR, width: 95, borderRight: `1px solid ${BORDER}` }}>Total</th>
            <th style={{ ...COL_HDR, width: 95 }}>Mapa</th>
            <th style={{ ...COL_HDR, width: 100 }}>Ajudas Custo</th>
            <th style={{ ...COL_HDR, width: 95, borderRight: `1px solid ${BORDER}` }}>Total Recibo</th>
            <th style={{ ...COL_HDR, width: 82 }}>Seg. Social</th>
            <th style={{ ...COL_HDR, width: 78 }}>IRS</th>
            <th style={{ ...COL_HDR, width: 54, color: '#C4CBD4' }}>FCT</th>
            <th style={{ ...COL_HDR, width: 60, color: '#C4CBD4' }}>Penhora</th>
            <th style={{ ...COL_HDR, width: 60, color: '#C4CBD4' }}>Ac. Desc.</th>
            <th style={{ ...COL_HDR, width: 72, color: '#C4CBD4', borderRight: `2px solid ${BORDER}` }}>Ret. Final</th>
            <th style={{ ...COL_HDR, width: 95, color: NAVY, fontWeight: 700 }}>Líquido</th>
            <th style={{ ...COL_HDR, width: 82, textAlign: 'center' }}>Estado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const isFlag = row.divergencia != null;
            const extra = row.categoriaLinha !== 'ativo';
            const bg = extra ? (row.categoriaLinha === 'orfao' ? '#FDF2F2' : '#F5F6F8') : isFlag ? '#FFF6EC' : i % 2 === 0 ? '#fff' : '#FAFBFC';
            const nameColor = isFlag ? '#8a5800' : INK;
            const primeiroExtra = extra && (i === 0 || rows[i - 1].categoriaLinha === 'ativo');
            return (
              <React.Fragment key={row.id}>
                {primeiroExtra && (
                  <tr>
                    <td colSpan={18} style={{ padding: '8px 14px', background: '#EDEAE0', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: '#5B6660' }}>
                      Recibos processados sem correspondência no efetivo ativo
                    </td>
                  </tr>
                )}
                <tr style={{ background: bg }}>
                {/* Mec — SLATE_A, 11px, Inter 600 */}
                <td style={{ ...CELL, fontSize: 11, fontWeight: 600, textAlign: 'left', fontFamily: 'Inter, sans-serif', color: SLATE_A, position: 'sticky', left: 0, background: bg, zIndex: 1 }}>{row.mecNum}</td>
                {/* Nome — Inter 600, INK / #8a5800 para flag */}
                <td style={{ fontSize: 12.5, fontWeight: 600, textAlign: 'left', padding: '8px', fontFamily: 'Inter, sans-serif', color: nameColor, position: 'sticky', left: 36, background: bg, zIndex: 1, borderRight: `2px solid ${BORDER}`, maxWidth: 190, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {isFlag && <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: ORANGE, marginRight: 7, verticalAlign: 'middle', flexShrink: 0 }} />}
                  {row.nome}
                  {row.categoriaLinha === 'inativo' && (
                    <span title="Trabalhador inativo — dados reais do recibo processado" style={{ marginLeft: 6, fontSize: 8, fontWeight: 700, textTransform: 'uppercase', color: '#5B6660', background: '#E3E6E9', borderRadius: 4, padding: '1px 5px' }}>Inativo</span>
                  )}
                  {row.categoriaLinha === 'orfao' && (
                    <span title="Sem registo de trabalhador correspondente na app" style={{ marginLeft: 6, fontSize: 8, fontWeight: 700, textTransform: 'uppercase', color: '#9F1239', background: '#FCE4E9', borderRadius: 4, padding: '1px 5px' }}>Órfão</span>
                  )}
                </td>
                <td style={CELL}>{n2(row.receber)}</td>
                <td style={CELL_ZERO}>{n2(row.acrescimos)}</td>
                <td style={CELL_ZERO}>{n2(row.retencao)}</td>
                <td style={CELL_ZERO}>{n2(row.subPrem)}</td>
                <td style={{ ...CELL, fontWeight: 700, borderRight: `1px solid ${BORDER}` }}>{n2(row.totalVenc)}</td>
                <td style={CELL}>{n2(row.mapa)}</td>
                <td style={CELL}>{n2(row.ajudasCusto)}</td>
                <td style={{ ...CELL, fontWeight: 700, borderRight: `1px solid ${BORDER}` }}>{n2(row.totalRecibo)}</td>
                <td style={CELL_DISC}>{n2(row.segSocial)}</td>
                <td style={CELL_DISC}>{n2(row.irs)}</td>
                <td style={CELL_ZERO}>{n2(row.fct)}</td>
                <td style={CELL_ZERO}>{n2(row.penhora)}</td>
                <td style={CELL_ZERO}>{n2(row.acDesconto)}</td>
                <td style={{ ...CELL_ZERO, borderRight: `2px solid ${BORDER}` }}>{n2(row.retencaoFinal)}</td>
                <td style={{ ...CELL, fontWeight: 700, color: NAVY }}>{n2(row.liquido)}</td>
                <td style={{ ...CELL, textAlign: 'center', fontFamily: 'inherit' }}>
                  <StatusCell row={row} />
                </td>
                </tr>
              </React.Fragment>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: `3px solid ${ORANGE}` }}>
            <td colSpan={2} style={{ ...TOTL_L, position: 'sticky', left: 0, zIndex: 1, borderRight: '2px solid rgba(255,255,255,0.15)' }}>
              TOTAIS ({totals.nWorkers} trab.)
            </td>
            <td style={TOTL}>{n2(totals.receber)}</td>
            <td style={{ ...TOTL, color: 'rgba(255,255,255,0.35)' }}>—</td>
            <td style={{ ...TOTL, color: 'rgba(255,255,255,0.35)' }}>—</td>
            <td style={{ ...TOTL, color: 'rgba(255,255,255,0.35)' }}>—</td>
            <td style={{ ...TOTL, borderRight: '1px solid rgba(255,255,255,0.15)' }}>{n2(totals.receber)}</td>
            <td style={TOTL}>{n2(totals.mapa)}</td>
            <td style={TOTL}>{n2(totals.ajudasCusto)}</td>
            <td style={{ ...TOTL, borderRight: '1px solid rgba(255,255,255,0.15)' }}>{n2(totals.totalRecibo)}</td>
            <td style={TOTL}>{n2(totals.segSocial)}</td>
            <td style={TOTL}>{n2(totals.irs)}</td>
            <td style={{ ...TOTL, color: 'rgba(255,255,255,0.35)' }}>—</td>
            <td style={{ ...TOTL, color: 'rgba(255,255,255,0.35)' }}>—</td>
            <td style={{ ...TOTL, color: 'rgba(255,255,255,0.35)' }}>—</td>
            <td style={{ ...TOTL, color: 'rgba(255,255,255,0.35)', borderRight: '2px solid rgba(255,255,255,0.15)' }}>—</td>
            <td style={{ ...TOTL, color: ORANGE }}>{n2(totals.liquido)}</td>
            <td style={{ ...TOTL, textAlign: 'center', fontSize: 10 }}>{totals.nCompletos}/{totals.nWorkers}</td>
          </tr>
        </tfoot>
      </table>

      {(totals.nDivergencias > 0 || totals.nSemNIS > 0) && (
        <div style={{ padding: '8px 16px', borderTop: `1px solid ${BORDER}`, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          {totals.nDivergencias > 0 && (
            <span style={{ fontSize: 10, color: '#dc2626', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
              <AlertTriangle size={11} />{totals.nDivergencias} divergência{totals.nDivergencias > 1 ? 's' : ''}
            </span>
          )}
          {totals.nSemNIS > 0 && (
            <span style={{ fontSize: 10, color: '#d97706', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
              <AlertTriangle size={11} />{totals.nSemNIS} sem NIS
            </span>
          )}
          <span className="text-natural" style={{ fontSize: 10, color: SLATE_A }}>
            Colunas a cinzento aguardam mapeamento TOConline (Acréscimos, Retenção, FCT…)
          </span>
        </div>
      )}
    </div>
  );
}
