import { useState } from 'react';
import Select from '../../components/Select.jsx';
import { ScrollText } from 'lucide-react';
import { auditActionsApi, auditLogsApi } from '../../api/dashboard.js';
import { Alert, EmptyState, PageHead, Pagination, Spinner, useAsync } from '../../components/ui.jsx';
import { formatDateTime } from '../../lib/format.js';

const pretty = (a) => a.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
const TONE = (a) => (/DENIED|LOCKOUT|REJECT|REUSE/.test(a) ? 'badge-danger' : /APPROV|VERIFIED|ENABLED|REENABLED/.test(a) ? 'badge-success' : /DELETED/.test(a) ? 'badge-warning' : '');

// IPP-F-024: every administrative / security-relevant action with timestamp and actor.
export default function AuditLog() {
  const [filters, setFilters] = useState({ action: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const { data: actions } = useAsync(auditActionsApi, []);
  const { data, loading, error } = useAsync(() => auditLogsApi({ ...filters, page, limit: 20 }), [JSON.stringify(filters), page]);
  const set = (k) => (e) => {
    setFilters((f) => ({ ...f, [k]: e.target.value }));
    setPage(1);
  };

  return (
    <>
      <PageHead title="Audit log" subtitle="A tamper-evident trail of approvals, status changes, exports and access violations." />
      <form className="card toolbar" aria-label="Audit log filters" onSubmit={(e) => e.preventDefault()}>
        <div className="field" style={{ minWidth: '14rem' }}>
          <label htmlFor="action">Action</label>
          <Select id="action" value={filters.action} onChange={set('action')}>
            <option value="">All actions</option>
            {(actions || []).map((a) => (
              <option key={a} value={a}>
                {pretty(a)}
              </option>
            ))}
          </Select>
        </div>
        <div className="field">
          <label htmlFor="from">From</label>
          <input id="from" type="date" value={filters.from} onChange={set('from')} />
        </div>
        <div className="field">
          <label htmlFor="to">To</label>
          <input id="to" type="date" value={filters.to} onChange={set('to')} />
        </div>
        {(filters.action || filters.from || filters.to) && (
          <button type="button" className="btn btn-ghost" onClick={() => { setFilters({ action: '', from: '', to: '' }); setPage(1); }}>
            Clear
          </button>
        )}
      </form>

      <div style={{ marginTop: 16 }}>
        {error && <Alert tone="danger">{error}</Alert>}
        {loading && !data && <Spinner />}
        {data &&
          (data.items.length === 0 ? (
            <EmptyState icon={ScrollText} title="No log entries match">
              Try widening the date range or clearing the action filter.
            </EmptyState>
          ) : (
            <>
              <p className="muted small" style={{ marginBottom: 8 }} aria-live="polite">
                {data.total} entries
              </p>
              <div className="table-wrap">
                <table>
                  <caption className="sr-only">Audit log entries, newest first</caption>
                  <thead>
                    <tr>
                      <th scope="col">When</th>
                      <th scope="col">Actor</th>
                      <th scope="col">Action</th>
                      <th scope="col">Target</th>
                      <th scope="col">Details</th>
                      <th scope="col">IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((l) => (
                      <tr key={l.id}>
                        <td className="small" style={{ whiteSpace: 'nowrap' }}>
                          {formatDateTime(l.createdAt)}
                        </td>
                        <td>
                          {l.actor ? (
                            <>
                              <strong>{l.actor.name}</strong>
                              <div className="muted small">
                                {l.actor.role} · {l.actor.email}
                              </div>
                            </>
                          ) : (
                            <span className="muted">Anonymous</span>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${TONE(l.action)}`}>{pretty(l.action)}</span>
                        </td>
                        <td className="small">{l.targetType || '—'}</td>
                        <td className="meta-json">{l.metadata && Object.keys(l.metadata).length ? JSON.stringify(l.metadata) : '—'}</td>
                        <td className="small muted">{l.ip || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ))}
        {data && <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />}
      </div>
    </>
  );
}
