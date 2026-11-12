const W = 380;
const H = 300;
const CX = W / 2;
const CY = H / 2;
const R_MAX = 100;
const LEVELS = [25, 50, 75, 100];

/** Gráfico radar em SVG puro (imprime bem, sem dependências) */
export function RadarChart({ data, className }) {
  const angle = (i) => -Math.PI / 2 + (2 * Math.PI * i) / data.length;
  const point = (i, value) => [CX + Math.cos(angle(i)) * R_MAX * (value / 100), CY + Math.sin(angle(i)) * R_MAX * (value / 100)];
  const toPoints = (values) => values.map((v, i) => point(i, v).join(',')).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} role="img" aria-label={data.map((d) => `${d.label}: ${d.value}`).join(', ')}>
      {LEVELS.map((level) => (
        <polygon
          key={level}
          points={toPoints(data.map(() => level))}
          fill={level === 100 ? '#f8fafc' : 'none'}
          stroke="#cbd5e1"
          strokeWidth={level === 100 ? 1.4 : 1}
          strokeDasharray={level === 100 ? undefined : '3 3'}
        />
      ))}
      {data.map((_, i) => {
        const [x, y] = point(i, 100);
        return <line key={i} x1={CX} y1={CY} x2={x} y2={y} stroke="#cbd5e1" />;
      })}
      <text x={CX + 4} y={CY - R_MAX * 0.5 - 3} fontSize={9} fill="#94a3b8">
        50
      </text>

      <polygon
        points={toPoints(data.map((d) => d.value))}
        fill="#1b3a57"
        fillOpacity={0.2}
        stroke="#1b3a57"
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      {data.map((d, i) => {
        const [x, y] = point(i, d.value);
        return <circle key={d.label} cx={x} cy={y} r={4.5} fill="#ffffff" stroke="#1b3a57" strokeWidth={2.5} />;
      })}

      {data.map((d, i) => {
        const cos = Math.cos(angle(i));
        const sin = Math.sin(angle(i));
        const [x, y] = point(i, 116);
        const anchor = cos > 0.3 ? 'start' : cos < -0.3 ? 'end' : 'middle';
        const labelY = sin < -0.3 ? y - 14 : sin > 0.3 ? y + 6 : y - 4;
        return (
          <g key={d.label} textAnchor={anchor}>
            <text x={x} y={labelY} fontSize={13} fontWeight={700} fill="#0f172a">
              {d.label}
            </text>
            <text x={x} y={labelY + 15} fontSize={13} fontWeight={700} fill="#1b3a57" fontFamily="var(--mono)">
              {d.value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
