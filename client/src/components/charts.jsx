import { useId, useState } from 'react';
import { Table2, BarChart3 } from 'lucide-react';

// Lightweight, dependency-free SVG charts (IPP-F-020). Every chart:
//  • is wrapped in a <figure> with a caption and a role="img" summary,
//  • has a "View as table" toggle so the data is available without relying on colour or sight,
//  • takes colours from the theme tokens (--chart-1…5) so light/dark/high-contrast work.
const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];
export const chartColor = (i) => COLORS[i % COLORS.length];

function niceMax(v) {
  if (v <= 0) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

export function ChartCard({ title, subtitle, table, children }) {
  const [asTable, setAsTable] = useState(false);
  const id = useId();
  return (
    <figure className="card chart-card" aria-labelledby={`${id}-t`}>
      <figcaption className="chart-head">
        <div>
          <h2 id={`${id}-t`}>{title}</h2>
          {subtitle && <p className="muted small">{subtitle}</p>}
        </div>
        {table && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}>
            {asTable ? <BarChart3 size={15} aria-hidden="true" /> : <Table2 size={15} aria-hidden="true" />} {asTable ? 'View chart' : 'View as table'}
          </button>
        )}
      </figcaption>
      {asTable && table ? (
        <div className="table-wrap">
          <table>
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr>
                {table.head.map((h) => (
                  <th scope="col" key={h}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => (
                    <td key={j}>{c ?? '—'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </figure>
  );
}

const W = 640;
const H = 280;
const M = { l: 42, r: 14, t: 14, b: 40 };

function Axes({ ticks, max, xLabels, xStep, unit = '' }) {
  const ih = H - M.t - M.b;
  return (
    <>
      {ticks.map((t) => {
        const y = M.t + ih - (t / max) * ih;
        return (
          <g key={t}>
            <line x1={M.l} x2={W - M.r} y1={y} y2={y} className="grid-line" />
            <text x={M.l - 8} y={y + 4} textAnchor="end" className="axis-text">
              {t}
              {unit}
            </text>
          </g>
        );
      })}
      {xLabels.map((l, i) =>
        i % xStep === 0 ? (
          <text key={i} x={l.x} y={H - M.b + 18} textAnchor="middle" className="axis-text">
            {l.text}
          </text>
        ) : null
      )}
    </>
  );
}

const ticksFor = (max) => [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f * 100) / 100);

// Vertical grouped bar chart. data: [{ label, a, b }], series: [{ key, name }]
export function BarChart({ data, series, summary }) {
  const max = niceMax(Math.max(0, ...data.flatMap((d) => series.map((s) => d[s.key] || 0))));
  const iw = W - M.l - M.r;
  const ih = H - M.t - M.b;
  const slot = iw / Math.max(1, data.length);
  const bw = Math.min(26, (slot * 0.7) / series.length);
  const xLabels = data.map((d, i) => ({ x: M.l + slot * i + slot / 2, text: d.short || d.label }));
  const empty = data.every((d) => series.every((s) => !d[s.key]));
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary} className="chart-svg">
        <Axes ticks={ticksFor(max)} max={max} xLabels={xLabels} xStep={data.length > 8 ? 1 : 1} />
        {data.map((d, i) =>
          series.map((s, k) => {
            const v = d[s.key] || 0;
            const h = (v / max) * ih;
            const x = M.l + slot * i + slot / 2 - (bw * series.length) / 2 + k * bw;
            return (
              <rect key={`${i}-${s.key}`} x={x} y={M.t + ih - h} width={bw - 2} height={Math.max(v ? 2 : 0, h)} rx="4" fill={chartColor(k)}>
                <title>{`${d.label} — ${s.name}: ${v}`}</title>
              </rect>
            );
          })
        )}
      </svg>
      {empty && <p className="muted small center">No data in this period.</p>}
      <Legend items={series.map((s, i) => ({ name: s.name, color: chartColor(i) }))} />
    </div>
  );
}

// Line chart where null values create visible gaps (months without data). data: [{ label, short, <key>: number|null }]
export function LineChart({ data, series, summary, max: fixedMax, unit = '' }) {
  const values = data.flatMap((d) => series.map((s) => d[s.key])).filter((v) => v != null);
  const max = fixedMax || niceMax(Math.max(0, ...values));
  const iw = W - M.l - M.r;
  const ih = H - M.t - M.b;
  const step = data.length > 1 ? iw / (data.length - 1) : 0;
  const x = (i) => M.l + (data.length > 1 ? step * i : iw / 2);
  const y = (v) => M.t + ih - (v / max) * ih;
  const xLabels = data.map((d, i) => ({ x: x(i), text: d.short || d.label }));
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary} className="chart-svg">
        <Axes ticks={ticksFor(max)} max={max} xLabels={xLabels} xStep={1} unit={unit} />
        {series.map((s, k) => {
          // Split into continuous runs so null months break the line instead of being interpolated.
          const runs = [];
          let run = [];
          data.forEach((d, i) => {
            if (d[s.key] == null) {
              if (run.length) runs.push(run);
              run = [];
            } else run.push([x(i), y(d[s.key]), i]);
          });
          if (run.length) runs.push(run);
          return (
            <g key={s.key} stroke={chartColor(k)} fill={chartColor(k)}>
              {runs.map((r, idx) => r.length > 1 && <polyline key={idx} points={r.map((p) => `${p[0]},${p[1]}`).join(' ')} fill="none" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />)}
              {runs.flat().map(([px, py, i]) => (
                <circle key={i} cx={px} cy={py} r="4" stroke="var(--surface)" strokeWidth="1.5">
                  <title>{`${data[i].label} — ${s.name}: ${data[i][s.key]}${unit}`}</title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>
      {values.length === 0 && <p className="muted small center">No data in this period.</p>}
      <Legend items={series.map((s, i) => ({ name: s.name, color: chartColor(i) }))} />
    </div>
  );
}

// Donut/pie chart with a legend that repeats the numbers (so colour is never the only channel).
export function DonutChart({ data, summary, colors }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const R = 70;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 200 200" role="img" aria-label={summary} className="donut-svg">
        <circle cx="100" cy="100" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="30" />
        {total > 0 &&
          data.map((d, i) => {
            const len = (d.value / total) * C;
            const el = (
              <circle
                key={d.label}
                cx="100"
                cy="100"
                r={R}
                fill="none"
                stroke={colors?.[i] || chartColor(i)}
                strokeWidth="30"
                strokeDasharray={`${len} ${C - len}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 100 100)"
              >
                <title>{`${d.label}: ${d.value} (${Math.round((d.value / total) * 100)}%)`}</title>
              </circle>
            );
            offset += len;
            return el;
          })}
        <text x="100" y="98" textAnchor="middle" className="donut-total">
          {total}
        </text>
        <text x="100" y="118" textAnchor="middle" className="axis-text">
          total
        </text>
      </svg>
      <ul className="legend-list">
        {data.map((d, i) => (
          <li key={d.label}>
            <i className="swatch" style={{ background: colors?.[i] || chartColor(i) }} />
            <span className="grow">{d.label}</span>
            <strong>{d.value}</strong>
            <span className="muted small">{total ? Math.round((d.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Horizontal stacked bars (HTML) for long labels, e.g. company-wise applications.
export function StackedBars({ rows, segments }) {
  const max = Math.max(1, ...rows.map((r) => r.total));
  return (
    <ul className="hbars">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="hbar-label">
            <span>{r.label}</span>
            <span className="muted small">{r.caption}</span>
          </div>
          <div className="hbar-track" role="img" aria-label={`${r.label}: ${r.caption}`}>
            {segments.map((s, i) =>
              r[s.key] ? <span key={s.key} title={`${s.name}: ${r[s.key]}`} style={{ width: `${(r[s.key] / max) * 100}%`, background: chartColor(s.color ?? i) }} /> : null
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Legend({ items }) {
  return (
    <ul className="legend-row">
      {items.map((it) => (
        <li key={it.name}>
          <i className="swatch" style={{ background: it.color }} /> {it.name}
        </li>
      ))}
    </ul>
  );
}
