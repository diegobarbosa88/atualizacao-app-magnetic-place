import React from 'react';
import { CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { NAVY, ORANGE, SLATE_A, BORDER, VAL_NEUT, MONO, n2 } from './mapaUtils.js';

const INK      = '#152232';
const INK_SOFT = '#647587';
const SLATE_SOFT = '#E7ECF1';

/* Icon badge for KPI cards */
function IconBadge({ bg, color, children }) {
  return (
    <div style={{ width: 30, height: 30, borderRadius: 8, background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
      {children}
    </div>
  );
}

function KpiCard({ label, value, sub, accent, iconBg, iconColor, iconChar }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, padding: '18px 20px', flex: 1, minWidth: 160, boxShadow: '0 1px 2px rgba(21,34,50,.04)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <span className="text-natural" style={{ fontSize: 12, fontWeight: 500, color: INK_SOFT }}>{label}</span>
        {iconChar && <IconBadge bg={iconBg} color={iconColor}>{iconChar}</IconBadge>}
      </div>
      <div className="text-natural" style={{ fontSize: 25, fontWeight: 700, color: accent || NAVY, fontVariantNumeric: 'tabular-nums', fontFamily: 'Poppins, Inter, sans-serif' }}>
        {value}
      </div>
      {sub && <div className="text-natural" style={{ fontSize: 11.5, color: INK_SOFT, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

/* Reconciliation / alert banner matching mockup .recon style */
function ReconBanner({ divWorkers, semNIS }) {
  const total = divWorkers.length + semNIS.length;
  if (!total) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #F3D9AE', borderLeft: `5px solid ${ORANGE}`, borderRadius: 12, padding: '18px 22px', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 16, alignItems: 'start' }}>
      <div style={{ background: ORANGE, color: '#fff', borderRadius: 10, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, flexShrink: 0, fontFamily: 'Poppins, sans-serif' }}>!</div>
      <div>
        <h3 className="text-natural" style={{ margin: '0 0 6px', fontSize: 15, color: '#8a5800', fontWeight: 700, fontFamily: 'Poppins, Inter, sans-serif' }}>
          Divergências entre Mapa e Recibos individuais
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          {divWorkers.map(w => (
            <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FFF8EE', borderRadius: 8, padding: '9px 14px', fontSize: 13 }}>
              <div>
                <div className="text-natural" style={{ fontWeight: 600, color: INK }}>{w.nome} · mec. {parseInt(w.mecNum, 10)}</div>
                <div className="text-natural" style={{ color: INK_SOFT, fontSize: 12.5 }}>
                  Mapa indica {n2(w.totalRecibo)}€, recibo mostra {n2(w.totalRecibo - w.divergencia)}€
                </div>
              </div>
              <div style={{ fontFamily: MONO, fontWeight: 600, color: '#8a5800', marginLeft: 16, flexShrink: 0 }}>Δ {n2(Math.abs(w.divergencia))}€</div>
            </div>
          ))}
          {semNIS.map(w => (
            <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FFF8EE', borderRadius: 8, padding: '9px 14px', fontSize: 13 }}>
              <div>
                <div className="text-natural" style={{ fontWeight: 600, color: INK }}>{w.nome} · mec. {parseInt(w.mecNum, 10)}</div>
                <div className="text-natural" style={{ color: INK_SOFT, fontSize: 12.5 }}>Sem NIS registado</div>
              </div>
              <div style={{ fontFamily: MONO, fontWeight: 600, color: '#8a5800', marginLeft: 16, flexShrink: 0 }}>a validar</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LinhaTrabalhador({ row }) {
  const isFlag = row.divergencia != null;
  const extra = row.categoriaLinha !== 'ativo';
  const bg = extra ? (row.categoriaLinha === 'orfao' ? '#FDF2F2' : '#F5F6F8') : isFlag ? '#FFFAF1' : '#fff';
  return (
    <tr style={{ background: bg }}>
      <td style={{ padding: '11px 14px', fontSize: 12, color: SLATE_A, fontWeight: 600, fontFamily: 'Inter, sans-serif' }}>{row.mecNum}</td>
      <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 600, color: isFlag ? '#8a5800' : INK, fontFamily: 'Inter, sans-serif', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {isFlag && <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: ORANGE, marginRight: 8, flexShrink: 0, verticalAlign: 'middle' }} />}
        {row.nome}
        {row.categoriaLinha === 'inativo' && (
          <span title="Trabalhador inativo — dados reais do recibo processado" style={{ marginLeft: 8, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: '#5B6660', background: '#E3E6E9', borderRadius: 4, padding: '2px 6px' }}>Inativo</span>
        )}
        {row.categoriaLinha === 'orfao' && (
          <span title="Sem registo de trabalhador correspondente na app — nome tal como está no recibo TOConline" style={{ marginLeft: 8, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: '#9F1239', background: '#FCE4E9', borderRadius: 4, padding: '2px 6px' }}>Órfão</span>
        )}
      </td>
      <td style={{ padding: '11px 14px', fontSize: 12.5, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: INK, fontFamily: MONO }}>{n2(row.receber)}</td>
      <td style={{ padding: '11px 14px', fontSize: 12.5, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#1E8E5A', fontWeight: 600, fontFamily: MONO }}>{n2(row.ajudasCusto)}</td>
      <td style={{ padding: '11px 14px', fontSize: 12.5, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: INK, fontWeight: 700, fontFamily: MONO }}>{n2(row.totalRecibo)}</td>
      <td style={{ padding: '11px 14px', fontSize: 12.5, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: VAL_NEUT, fontFamily: MONO }}>{n2(row.segSocial)}</td>
      <td style={{ padding: '11px 14px', fontSize: 12.5, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: VAL_NEUT, fontFamily: MONO }}>{n2(row.irs)}</td>
      <td style={{ padding: '11px 14px', fontSize: 12.5, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: NAVY, fontFamily: MONO }}>{n2(row.liquido)}</td>
      <td style={{ padding: '11px 14px', textAlign: 'center' }} title={
        row.fonte === 'ambigua' ? 'Correspondência ambígua com o recibo (nome duplicado/semelhante) — revisão manual necessária'
        : row.fonte === 'recibo-nome' ? 'Dados do recibo já processado — correspondência por nome, confirmar'
        : row.fonte === 'recibo-id' ? 'Dados do recibo já processado (sem registo de horário no mês)'
        : row.fonte === 'sem-dados' ? 'Sem registo de horário nem recibo processado para este mês'
        : undefined
      }>
        {row.fonte === 'ambigua'
          ? <AlertTriangle size={14} color="#DC2626" />
          : row.fonte === 'recibo-nome'
            ? <AlertTriangle size={14} color="#D97706" />
            : row.fonte === 'recibo-id'
              ? <Info size={14} color="#2563EB" />
              : row.isCompleto
                ? <CheckCircle size={14} color="#1E8E5A" />
                : row.divergencia != null
                  ? <AlertTriangle size={14} color="#D3572B" />
                  : <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: BORDER }} />
        }
      </td>
    </tr>
  );
}

export default function MapaPainelExecutivo({ rows, totals }) {
  const linhasAtivas = rows.filter(r => r.categoriaLinha === 'ativo');
  const linhasExtra  = rows.filter(r => r.categoriaLinha !== 'ativo');
  const divWorkers   = linhasAtivas.filter(r => r.divergencia != null);
  const semNIS       = linhasAtivas.filter(r => r.semNIS);

  if (!rows.length) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 24px', color: SLATE_A }}>
        <Info size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
        <p style={{ fontSize: 14, fontWeight: 700 }}>Sem trabalhadores activos com vencimento configurado</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* KPI cards — 4 cards como no mockup */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <KpiCard
          label="Total pago (recibos)"
          value={`€ ${n2(totals.totalRecibo)}`}
          sub={`${totals.nWorkers} trabalhadores`}
          iconBg="#E9F0F7" iconColor={NAVY} iconChar="€"
        />
        <KpiCard
          label="Ajudas de custo"
          value={`€ ${n2(totals.ajudasCusto)}`}
          sub="Não tributado"
          accent="#1E8E5A"
          iconBg="#E7F5EC" iconColor="#1E8E5A" iconChar="AC"
        />
        <KpiCard
          label="Seg. Social + IRS"
          value={`€ ${n2(totals.segSocial + totals.irs)}`}
          sub="Retenções do mês"
          accent={VAL_NEUT}
          iconBg={SLATE_SOFT} iconColor={SLATE_A} iconChar="SS"
        />
        <KpiCard
          label="Alertas de reconciliação"
          value={totals.nDivergencias + totals.nSemNIS}
          sub="Ver painel abaixo"
          accent={(totals.nDivergencias + totals.nSemNIS) > 0 ? '#8a5800' : NAVY}
          iconBg="#FFF1DC" iconColor="#8a5800" iconChar="!"
        />
      </div>

      {/* Banner de reconciliação */}
      <ReconBanner divWorkers={divWorkers} semNIS={semNIS} />

      {/* Painel tabela */}
      <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="text-natural" style={{ margin: 0, fontSize: 16, fontWeight: 700, color: NAVY, fontFamily: 'Poppins, Inter, sans-serif' }}>Detalhe por trabalhador</h2>
          <span className="text-natural" style={{ fontSize: 12, color: INK_SOFT }}>Fonte: Mapa de Controlo TOConline</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 760 }}>
            <thead>
              <tr>
                {[
                  { h: '#',            left: true },
                  { h: 'Nome',         left: true },
                  { h: 'Ord. Bruto' },
                  { h: 'Ajudas C.' },
                  { h: 'Total Recibo' },
                  { h: 'Seg. Social' },
                  { h: 'IRS' },
                  { h: 'Líquido' },
                  { h: 'Estado' },
                ].map(({ h, left }) => (
                  <th key={h} style={{
                    background: SLATE_SOFT, color: INK_SOFT,
                    fontSize: 11, fontWeight: 600,
                    textTransform: 'uppercase', letterSpacing: '0.4px',
                    padding: '10px 14px', textAlign: left ? 'left' : 'right',
                    borderBottom: `2px solid ${BORDER}`, whiteSpace: 'nowrap',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhasAtivas.map(row => <LinhaTrabalhador key={row.id} row={row} />)}
              {linhasExtra.length > 0 && (
                <tr>
                  <td colSpan={9} style={{ padding: '8px 14px', background: '#EDEAE0', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: '#5B6660' }}>
                    Recibos processados sem correspondência no efetivo ativo ({linhasExtra.length})
                  </td>
                </tr>
              )}
              {linhasExtra.map(row => <LinhaTrabalhador key={row.id} row={row} />)}
            </tbody>
            <tfoot>
              <tr style={{ background: NAVY }}>
                <td style={{ padding: '14px', fontFamily: MONO, fontWeight: 700, color: '#fff' }}>—</td>
                <td className="text-natural" style={{ padding: '14px', fontFamily: 'Poppins, Inter, sans-serif', fontWeight: 700, color: '#fff', textAlign: 'left' }}>TOTAIS</td>
                <td style={{ padding: '14px', textAlign: 'right', fontFamily: MONO, fontWeight: 700, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{n2(totals.receber)}</td>
                <td style={{ padding: '14px', textAlign: 'right', fontFamily: MONO, fontWeight: 700, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{n2(totals.ajudasCusto)}</td>
                <td style={{ padding: '14px', textAlign: 'right', fontFamily: MONO, fontWeight: 700, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{n2(totals.totalRecibo)}</td>
                <td style={{ padding: '14px', textAlign: 'right', fontFamily: MONO, fontWeight: 700, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{n2(totals.segSocial)}</td>
                <td style={{ padding: '14px', textAlign: 'right', fontFamily: MONO, fontWeight: 700, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{n2(totals.irs)}</td>
                <td style={{ padding: '14px', textAlign: 'right', fontFamily: MONO, fontWeight: 700, color: ORANGE, fontVariantNumeric: 'tabular-nums' }}>{n2(totals.liquido)}</td>
                <td style={{ padding: '14px', textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>{totals.nCompletos}/{totals.nWorkers}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
