import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { NAVY, ORANGE, SLATE_A, BORDER, VAL_NEUT, MONO, n2 } from './mapaUtils.js';

const INK      = '#152232';
const INK_SOFT = '#69798B';

function ProgressBar({ mapa, ajudasCusto, segSocial, irs }) {
  const total = mapa + ajudasCusto + segSocial + irs;
  if (total <= 0) return <div style={{ height: 9, borderRadius: 5, background: BORDER }} />;
  const pM = (mapa        / total * 100).toFixed(2);
  const pA = (ajudasCusto / total * 100).toFixed(2);
  const pD = Math.max(0, 100 - parseFloat(pM) - parseFloat(pA)).toFixed(2);
  return (
    <div style={{ display: 'flex', height: 9, borderRadius: 5, overflow: 'hidden', width: '100%', background: BORDER }}>
      {parseFloat(pM) > 0 && <div style={{ width: `${pM}%`, background: SLATE_A }} />}
      {parseFloat(pA) > 0 && <div style={{ width: `${pA}%`, background: ORANGE }} />}
      {parseFloat(pD) > 0 && <div style={{ width: `${pD}%`, background: '#DDE3E9' }} />}
    </div>
  );
}

function StatBlock({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 500, color: INK_SOFT, fontFamily: 'Inter, sans-serif', lineHeight: 1.3, marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: color || INK, fontVariantNumeric: 'tabular-nums', fontFamily: MONO }}>
        {value}€
      </div>
    </div>
  );
}

function WorkerCard({ row }) {
  const mecNum = row.categoriaLinha === 'ativo' ? String(parseInt(row.mecNum, 10)).padStart(5, '0') : null;
  const hasVerificar = row.divergencia != null;
  const toconlineVal = row.totalRecibo - (row.divergencia ?? 0);
  const [hovered, setHovered] = useState(false);

  const cardBorder = row.categoriaLinha === 'orfao' ? '1px solid #F3C6D0'
    : row.categoriaLinha === 'inativo' ? '1px solid #D7DCE2'
    : hasVerificar ? '1px solid #F0C077' : `1px solid ${BORDER}`;
  const cardBg = row.categoriaLinha === 'orfao' ? '#FDF2F2'
    : row.categoriaLinha === 'inativo' ? '#F5F6F8'
    : hasVerificar ? '#FFFCF6' : '#fff';
  const cardShadow   = hovered ? '0 6px 18px -8px rgba(21,34,50,.18)' : 'none';

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: cardBg,
        border: cardBorder,
        borderRadius: 14,
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        boxShadow: cardShadow,
        transition: 'box-shadow .15s',
      }}>

      {/* Card-top: nome+mec à esquerda, badge à direita */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: INK, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {row.nome}
          </div>
          <div className="text-natural" style={{ fontSize: 11, color: SLATE_A, marginTop: 2, fontFamily: MONO }}>
            {mecNum ? `Mec. ${mecNum}` : 'Sem número de mecanográfico'}
          </div>
        </div>
        {row.categoriaLinha === 'inativo' && (
          <span title="Trabalhador inativo — dados reais do recibo processado"
            style={{ flexShrink: 0, background: '#5B6660', color: '#fff', borderRadius: 5, padding: '3px 7px', fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.3px' }}>
            Inativo
          </span>
        )}
        {row.categoriaLinha === 'orfao' && (
          <span title="Sem registo de trabalhador correspondente na app"
            style={{ flexShrink: 0, background: '#9F1239', color: '#fff', borderRadius: 5, padding: '3px 7px', fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.3px' }}>
            Órfão
          </span>
        )}
        {hasVerificar && (
          <span style={{ flexShrink: 0, background: ORANGE, color: '#fff', borderRadius: 5, padding: '3px 7px', fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.3px' }}>
            Verificar
          </span>
        )}
        {row.fonte === 'ambigua' && (
          <span title="Correspondência ambígua com o recibo (nome duplicado/semelhante) — revisão manual necessária"
            style={{ flexShrink: 0, background: '#dc2626', color: '#fff', borderRadius: 5, padding: '3px 7px', fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.3px' }}>
            Ambíguo
          </span>
        )}
        {row.fonte === 'recibo-nome' && (
          <span title="Dados do recibo já processado — correspondência por nome, confirmar"
            style={{ flexShrink: 0, background: '#fef3c7', color: '#d97706', borderRadius: 5, padding: '3px 7px', fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.3px' }}>
            Recibo (nome)
          </span>
        )}
        {row.fonte === 'recibo-id' && (
          <span title="Dados do recibo já processado (sem registo de horário no mês)"
            style={{ flexShrink: 0, background: '#dbeafe', color: '#2563eb', borderRadius: 5, padding: '3px 7px', fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.3px' }}>
            Recibo
          </span>
        )}
        {row.fonte === 'sem-dados' && (
          <span title="Sem registo de horário nem recibo processado para este mês"
            style={{ flexShrink: 0, background: '#F1F3F5', color: '#869AAF', borderRadius: 5, padding: '3px 7px', fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.3px' }}>
            Sem dados
          </span>
        )}
        {row.semNIS && !hasVerificar && (
          <span style={{ flexShrink: 0, background: '#fef3c7', color: '#d97706', borderRadius: 5, padding: '3px 7px', fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.3px' }}>
            Sem NIS
          </span>
        )}
      </div>

      {/* Valor principal */}
      <div className="text-natural" style={{ fontSize: 28, fontWeight: 700, color: NAVY, fontFamily: 'Poppins, Inter, sans-serif', lineHeight: 1, marginBottom: 2, fontVariantNumeric: 'tabular-nums' }}>
        {n2(row.totalRecibo)}€
      </div>
      <div className="text-natural" style={{ fontSize: 11, color: INK_SOFT, marginBottom: 12 }}>
        Total a receber (recibo)
      </div>

      {/* Barra de progresso */}
      <div style={{ marginBottom: 10 }}>
        <ProgressBar mapa={row.mapa} ajudasCusto={row.ajudasCusto} segSocial={row.segSocial} irs={row.irs} />
      </div>

      {/* Grid 2×2 de estatísticas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px' }}>
        <StatBlock label="Base tributável"  value={n2(row.mapa)} />
        <StatBlock label="Ajudas de custo"  value={n2(row.ajudasCusto)} />
        <StatBlock label="Seg. Social"      value={n2(row.segSocial)} color={VAL_NEUT} />
        <StatBlock label="IRS"              value={n2(row.irs)}      color={VAL_NEUT} />
      </div>

      {/* Aviso de divergência — visível apenas no hover */}
      {hasVerificar && (
        <div className="text-natural" style={{
          marginTop: hovered ? 12 : 0,
          paddingTop: hovered ? 10 : 0,
          borderTop: hovered ? `1px dashed ${BORDER}` : 'none',
          fontSize: 11.5,
          color: '#8a5800',
          opacity: hovered ? 1 : 0,
          visibility: hovered ? 'visible' : 'hidden',
          transition: 'opacity 0.15s ease',
          overflow: 'hidden',
          maxHeight: hovered ? 60 : 0,
        }}>
          ⚠ Mapa indica {n2(row.totalRecibo)}€, recibo mostra {n2(toconlineVal)}€ (Δ {n2(Math.abs(row.divergencia))}€)
        </div>
      )}
    </div>
  );
}

export default function MapaCartoes({ rows, totals, mesLabel }) {
  const nAlerts = totals.nDivergencias + totals.nSemNIS;

  if (!rows.length) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 24px', color: SLATE_A }}>
        <p style={{ fontSize: 14, fontWeight: 700 }}>Sem trabalhadores activos com vencimento configurado</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>

      {/* Cabeçalho dark navy com gradiente laranja */}
      <div style={{
        background: NAVY,
        borderRadius: '12px 12px 0 0',
        padding: '34px 28px 40px',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        gap: 24, flexWrap: 'wrap',
      }}>
        <div>
          {/* Eyebrow com quadrado laranja */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, letterSpacing: '1.2px', color: '#B9C6D4', marginBottom: 8 }}>
            <span style={{ width: 8, height: 8, background: ORANGE, borderRadius: 2, display: 'inline-block', flexShrink: 0 }} />
            Magnetic Place · Folha de Salários
          </div>
          <div className="text-natural" style={{ fontSize: 30, fontWeight: 700, color: '#fff', lineHeight: 1.1, marginBottom: 6, fontFamily: 'Poppins, Inter, sans-serif' }}>
            Mapa Resumo — {mesLabel}
          </div>
          <div className="text-natural" style={{ fontSize: 14, color: '#C9D5E0' }}>
            Vista por trabalhador · sectores eólico, naval e metalomecânico
          </div>
        </div>
        <div style={{ display: 'flex', gap: 26, alignItems: 'flex-end' }}>
          {[
            { v: totals.nWorkers,                  l: 'Trabalhadores' },
            { v: `${n2(totals.totalRecibo)}€`,     l: 'Total Pago'    },
            { v: nAlerts,                           l: 'Alertas'       },
          ].map(({ v, l }) => (
            <div key={l} className="text-natural" style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: ORANGE, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, fontFamily: 'Poppins, Inter, sans-serif' }}>{v}</div>
              <div style={{ fontSize: 11, color: '#B9C6D4', letterSpacing: '0.4px', marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* KPI summary bar */}
      <div style={{
        background: '#fff',
        borderRadius: 14,
        border: `1px solid ${BORDER}`,
        display: 'flex', flexWrap: 'wrap',
        boxShadow: '0 8px 24px -12px rgba(21,34,50,.18)',
        overflowX: 'auto',
        margin: '-20px 0 0',
        position: 'relative', zIndex: 1,
      }}>
        {[
          { l: 'Total folha (recibos)',          v: `${n2(totals.totalRecibo)}€`,  warn: false },
          { l: 'Ajudas de custo (não tributado)', v: `${n2(totals.ajudasCusto)}€`, warn: false },
          { l: 'Segurança Social',               v: `${n2(totals.segSocial)}€`,   warn: false },
          { l: 'IRS retido',                     v: `${n2(totals.irs)}€`,          warn: false },
          { l: 'Divergências a validar',         v: totals.nDivergencias,          warn: totals.nDivergencias > 0 },
        ].map(({ l, v, warn }, i, arr) => (
          <div key={l} style={{
            flex: 1, minWidth: 140, padding: '14px 20px',
            borderRight: i < arr.length - 1 ? `1px solid ${BORDER}` : 'none',
          }}>
            <div style={{ fontSize: 11, color: INK_SOFT, letterSpacing: '0.4px', textTransform: 'uppercase', marginBottom: 4 }}>{l}</div>
            <div className="text-natural" style={{ fontSize: 19, fontWeight: 700, color: warn ? '#8a5800' : NAVY, fontVariantNumeric: 'tabular-nums', fontFamily: 'Poppins, Inter, sans-serif' }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Legenda */}
      <div className="text-natural" style={{ display: 'flex', gap: 18, flexWrap: 'wrap', margin: '22px 0 8px', fontSize: 12, color: INK_SOFT }}>
        {[
          { color: SLATE_A,    label: 'Vencimento + subsídios' },
          { color: ORANGE,     label: 'Ajudas de custo' },
          { color: '#DDE3E9',  label: 'Descontos (SS + IRS)' },
        ].map(({ color, label }) => (
          <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <i style={{ width: 10, height: 10, borderRadius: 3, display: 'inline-block', background: color, flexShrink: 0 }} />
            {label}
          </span>
        ))}
      </div>

      {/* Grelha de cartões — trabalhadores ativos */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 14,
      }}>
        {rows.filter(r => r.categoriaLinha === 'ativo').map(row => <WorkerCard key={row.id} row={row} />)}
      </div>

      {/* Recibos processados sem correspondência no efetivo ativo (inativos/órfãos) */}
      {rows.some(r => r.categoriaLinha !== 'ativo') && (
        <>
          <div className="text-natural" style={{
            margin: '22px 0 10px', padding: '8px 14px', background: '#EDEAE0',
            borderRadius: 8, fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '.5px', color: '#5B6660',
          }}>
            Recibos processados sem correspondência no efetivo ativo
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 14,
          }}>
            {rows.filter(r => r.categoriaLinha !== 'ativo').map(row => <WorkerCard key={row.id} row={row} />)}
          </div>
        </>
      )}

    </div>
  );
}
