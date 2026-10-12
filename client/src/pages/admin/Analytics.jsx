import { useState } from 'react';
import { Download, FileSpreadsheet, FileText, Percent, Send, UserCheck, Users } from 'lucide-react';
import { downloadExport, placementApi } from '../../api/dashboard.js';
import { errorInfo } from '../../api/http.js';
import { BarChart, ChartCard, DonutChart, LineChart, StackedBars, chartColor } from '../../components/charts.jsx';
import { Alert, PageHead, Spinner, useAsync, useToast } from '../../components/ui.jsx';

const iso = (d) => d.toISOString().slice(0, 10);
const PRESETS = [
  ['Last 12 months', () => ({ from: '', to: '' })],
  ['Last 6 months', () => {
    const n = new Date();
    return { from: iso(new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() - 5, 1))), to: '' };
  }],
  ['This year', () => ({ from: `${new Date().getUTCFullYear()}-01-01`, to: '' })],
];
const STATUS_COLORS = ['var(--chart-2)', 'var(--chart-3)', 'var(--chart-5)', 'var(--chart-4)'];

const Kpi = ({ icon: Icon, num, label, sub }) => (
  <div className="card stat">
    <span className="stat-icon">
      <Icon size={22} aria-hidden="true" />
    </span>
    <div>
      <div className="stat-num">{num}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  </div>
);

// IPP-F-019 (placement analytics), IPP-F-020 (bar / line / pie charts over 12 months), IPP-F-021 (CSV / PDF export).
export default function Analytics() {
  const toast = useToast();
  const [filters, setFilters] = useState({ from: '', to: '', company: '' });
  const [draft, setDraft] = useState(filters);
  const [exporting, setExporting] = useState('');
  const { data: d, loading, error } = useAsync(() => placementApi(filters), [JSON.stringify(filters)]);
  const set = (k) => (e) => setDraft((f) => ({ ...f, [k]: e.target.value }));

  async function doExport(format) {
    setExporting(format);
    try {
      await downloadExport(format, filters);
      toast(`${format.toUpperCase()} report downloaded`, 'success');
    } catch (err) {
      // Blob error bodies are not JSON-parsed by axios, so show a generic message for those.
      toast(err.response?.data instanceof Blob ? 'Could not generate the report.' : errorInfo(err).message, 'error');
    } finally {
      setExporting('');
    }
  }

  return (
    <>
      <PageHead
        title="Placement analytics"
        subtitle="Placement rate, company-wise applications and performance trends."
        actions={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => doExport('csv')} disabled={Boolean(exporting)}>
              <FileSpreadsheet size={16} aria-hidden="true" /> {exporting === 'csv' ? 'Preparing…' : 'Export CSV'}
            </button>
            <button type="button" className="btn" onClick={() => doExport('pdf')} disabled={Boolean(exporting)}>
              <Download size={16} aria-hidden="true" /> {exporting === 'pdf' ? 'Preparing…' : 'Export PDF'}
            </button>
          </>
        }
      />

      <form
        className="card toolbar"
        role="search"
        aria-label="Analytics filters"
        onSubmit={(e) => {
          e.preventDefault();
          setFilters(draft);
        }}
      >
        <div className="field">
          <label htmlFor="from">From</label>
          <input id="from" type="date" value={draft.from} max={draft.to || undefined} onChange={set('from')} />
        </div>
        <div className="field">
          <label htmlFor="to">To</label>
          <input id="to" type="date" value={draft.to} min={draft.from || undefined} onChange={set('to')} />
        </div>
        <div className="field">
          <label htmlFor="company">Company</label>
          <select id="company" value={draft.company} onChange={set('company')}>
            <option value="">All companies</option>
            {(d?.filters.companies || []).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn">
          Apply
        </button>
        <div className="btn-row">
          {PRESETS.map(([label, fn]) => (
            <button
              key={label}
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                const next = { ...draft, ...fn() };
                setDraft(next);
                setFilters(next);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </form>

      {error && (
        <div style={{ marginTop: 16 }}>
          <Alert tone="danger">{error}</Alert>
        </div>
      )}
      {loading && !d && (
        <div style={{ marginTop: 20 }}>
          <Spinner label="Crunching the numbers…" />
        </div>
      )}

      {d && (
        <div style={{ opacity: loading ? 0.6 : 1, transition: 'opacity .15s' }}>
          <p className="muted small" style={{ margin: '16px 0 10px' }} aria-live="polite">
            Showing {d.filters.from} to {d.filters.to}
            {d.filters.company ? ` · ${d.filters.company}` : ' · all companies'}
          </p>
          <div className="grid grid-4">
            <Kpi icon={Percent} num={`${d.kpis.placementRate}%`} label="Placement rate" sub={`${d.kpis.placedStudents} of ${d.kpis.totalStudents} students placed`} />
            <Kpi icon={Send} num={d.kpis.applications} label="Applications" sub={`${d.kpis.conversionRate}% selected · ${d.kpis.shortlisted} shortlisted`} />
            <Kpi icon={UserCheck} num={d.kpis.selections} label="Selections" sub={`${d.kpis.activeListings} active listings · ${d.kpis.recruiters} recruiters`} />
            <Kpi icon={Users} num={`${d.kpis.avgTestAccuracy}%`} label="Avg. test accuracy" sub={`${d.kpis.testAttempts} attempts`} />
          </div>

          <div className="stack" style={{ marginTop: 16 }}>
            <ChartCard
              title="Applications and selections per month"
              subtitle="Months without activity show as zero"
              table={{ head: ['Month', 'Applications', 'Selections'], rows: d.monthly.map((m) => [m.label, m.applications, m.selections]) }}
            >
              <BarChart
                data={d.monthly.map((m) => ({ label: m.label, short: m.label.slice(0, 3), applications: m.applications, selections: m.selections }))}
                series={[{ key: 'applications', name: 'Applications' }, { key: 'selections', name: 'Selections' }]}
                summary={`Bar chart of monthly applications and selections from ${d.monthly[0]?.label} to ${d.monthly[d.monthly.length - 1]?.label}. ${d.kpis.applications} applications and ${d.kpis.selections} selections in total.`}
              />
            </ChartCard>

            <div className="grid grid-2" style={{ alignItems: 'start' }}>
              <ChartCard
                title="Application outcomes"
                table={{ head: ['Status', 'Applications'], rows: d.statusBreakdown.map((s) => [s.status, s.count]) }}
              >
                <DonutChart
                  data={d.statusBreakdown.map((s) => ({ label: s.status, value: s.count }))}
                  colors={STATUS_COLORS}
                  summary={`Pie chart of application statuses: ${d.statusBreakdown.map((s) => `${s.status} ${s.count}`).join(', ')}`}
                />
              </ChartCard>
              <ChartCard
                title="Applications by domain"
                table={{ head: ['Domain', 'Applications'], rows: d.domainBreakdown.map((x) => [x.domain, x.count]) }}
              >
                {d.domainBreakdown.length === 0 ? (
                  <p className="muted">No applications in this period.</p>
                ) : (
                  <DonutChart data={d.domainBreakdown.slice(0, 5).map((x) => ({ label: x.domain, value: x.count }))} summary={`Pie chart of applications by domain, top ${Math.min(5, d.domainBreakdown.length)} domains`} />
                )}
              </ChartCard>
            </div>

            <ChartCard
              title="Company-wise applications"
              subtitle="Top 10 companies"
              table={{ head: ['Company', 'Applications', 'Shortlisted', 'Selected'], rows: d.companyWise.map((c) => [c.company, c.applications, c.shortlisted, c.selected]) }}
            >
              {d.companyWise.length === 0 ? (
                <p className="muted">No applications in this period.</p>
              ) : (
                <>
                  <StackedBars
                    segments={[
                      { key: 'selected', name: 'Selected', color: 4 },
                      { key: 'shortlisted', name: 'Shortlisted', color: 2 },
                      { key: 'other', name: 'Other', color: 0 },
                    ]}
                    rows={d.companyWise.map((c) => ({
                      label: c.company,
                      total: c.applications,
                      selected: c.selected,
                      shortlisted: c.shortlisted,
                      other: c.applications - c.selected - c.shortlisted,
                      caption: `${c.applications} applications · ${c.selected} selected`,
                    }))}
                  />
                  <ul className="legend-row">
                    {[['Selected', 4], ['Shortlisted', 2], ['Other', 0]].map(([n, c]) => (
                      <li key={n}>
                        <i className="swatch" style={{ background: chartColor(c) }} /> {n}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </ChartCard>

            <ChartCard
              title="Student performance trend"
              subtitle="Average test accuracy per month — gaps mean no tests were taken"
              table={{ head: ['Month', 'Test attempts', 'Avg. accuracy'], rows: d.monthly.map((m) => [m.label, m.testAttempts, m.avgAccuracy == null ? null : `${m.avgAccuracy}%`]) }}
            >
              <LineChart
                data={d.monthly.map((m) => ({ label: m.label, short: m.label.slice(0, 3), accuracy: m.avgAccuracy }))}
                series={[{ key: 'accuracy', name: 'Avg. accuracy %' }]}
                max={100}
                unit="%"
                summary={`Line chart of average monthly test accuracy. Overall ${d.kpis.avgTestAccuracy} percent across ${d.kpis.testAttempts} attempts.`}
              />
            </ChartCard>
          </div>
        </div>
      )}
    </>
  );
}
