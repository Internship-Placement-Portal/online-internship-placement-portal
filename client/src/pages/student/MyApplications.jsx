import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, ClipboardList, Video } from 'lucide-react';
import { myApplicationsApi } from '../../api/applications.js';
import { Alert, EmptyState, LogoTile, PageHead, Pagination, Skeletons, StatusBadge, useAsync } from '../../components/ui.jsx';
import { formatDate, formatDateTime } from '../../lib/format.js';

// IPP-F-011 (student view): status changes made by recruiters show up here; interview details are linked from IPP-F-013.
export default function MyApplications() {
  const [page, setPage] = useState(1);
  const { data, loading, error } = useAsync(() => myApplicationsApi({ page, limit: 10 }), [page]);

  return (
    <>
      <PageHead title="My applications" subtitle="Track every internship you have applied to." />
      {error && <Alert tone="danger">{error}</Alert>}
      {loading && !data && <Skeletons count={3} />}
      {data &&
        (data.items.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No applications yet"
            action={
              <Link to="/student/internships" className="btn">
                Browse internships
              </Link>
            }
          >
            Apply to an internship and it will show up here.
          </EmptyState>
        ) : (
          <div className="stack">
            {data.items.map((a) => (
              <Link key={a.id} to={`/student/applications/${a.id}`} className="card app-row">
                <LogoTile name={a.listing?.company || '?'} />
                <div className="grow">
                  <h3>{a.listing?.title || 'Internship'}</h3>
                  <p className="muted small">
                    {a.listing?.company} · Applied {formatDate(a.createdAt)}
                  </p>
                  {a.interview && (
                    <p className="small" style={{ marginTop: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
                      {a.interview.mode === 'online' ? <Video size={14} aria-hidden="true" /> : <CalendarClock size={14} aria-hidden="true" />}
                      Interview: {formatDateTime(a.interview.date)}
                    </p>
                  )}
                </div>
                <StatusBadge status={a.status} />
              </Link>
            ))}
          </div>
        ))}
      {data && <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />}
    </>
  );
}
