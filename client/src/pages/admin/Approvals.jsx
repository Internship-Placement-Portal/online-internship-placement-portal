import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, Check, ShieldCheck, UserCheck, X } from 'lucide-react';
import { decideListingApi, decideRecruiterApi, listPendingListingsApi, listRecruitersApi } from '../../api/admin.js';
import { errorInfo } from '../../api/http.js';
import { Alert, EmptyState, LogoTile, Modal, PageHead, Pagination, Spinner, StatusBadge, useAsync, useToast } from '../../components/ui.jsx';
import { formatDate, formatStipend } from '../../lib/format.js';

// IPP-F-022 (+ IPP-F-006 listing review): placement officer approves or rejects recruiters and their listings.
function RejectDialog({ title, onConfirm, onClose }) {
  const [reason, setReason] = useState('');
  return (
    <Modal title={title} onClose={onClose}>
      <label htmlFor="reason" style={{ marginTop: 0 }}>
        Reason (shared with the recruiter)
      </label>
      <textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} style={{ minHeight: '5rem' }} />
      <div className="btn-row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="btn btn-danger" onClick={() => onConfirm(reason)}>
          Reject
        </button>
      </div>
    </Modal>
  );
}

function RecruiterQueue() {
  const toast = useToast();
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [rejecting, setRejecting] = useState(null);
  const { data, loading, error, reload } = useAsync(() => listRecruitersApi({ status, page, limit: 10 }), [status, page]);

  async function decide(r, decision, reason) {
    try {
      await decideRecruiterApi(r.id, { decision, reason });
      toast(`${r.name} ${decision}`, 'success');
      setRejecting(null);
      reload();
    } catch (err) {
      toast(errorInfo(err).message, 'error');
    }
  }

  return (
    <>
      <div className="tabs" role="tablist" aria-label="Recruiter status">
        {['pending', 'approved', 'rejected'].map((s) => (
          <button key={s} role="tab" type="button" className="tab" aria-selected={status === s} onClick={() => { setStatus(s); setPage(1); }}>
            {s[0].toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      {loading && !data && <Spinner />}
      {data &&
        (data.items.length === 0 ? (
          <EmptyState icon={UserCheck} title={status === 'pending' ? 'No recruiters waiting' : `No ${status} recruiters`}>
            {status === 'pending' ? 'You are all caught up.' : 'Nothing to show here.'}
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table>
              <caption className="sr-only">Recruiter registrations</caption>
              <thead>
                <tr>
                  <th scope="col">Recruiter</th>
                  <th scope="col">Company</th>
                  <th scope="col">Registered</th>
                  <th scope="col">Status</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.name}</strong>
                      <div className="muted small">{r.email}</div>
                    </td>
                    <td>{r.profile.companyName || <span className="muted">Not provided</span>}</td>
                    <td>{formatDate(r.createdAt)}</td>
                    <td>
                      <StatusBadge status={r.approvalStatus} />
                    </td>
                    <td>
                      <div className="btn-row" style={{ justifyContent: 'flex-end' }}>
                        {r.approvalStatus !== 'approved' && (
                          <button type="button" className="btn btn-success btn-sm" onClick={() => decide(r, 'approved')} aria-label={`Approve ${r.name}`}>
                            <Check size={14} aria-hidden="true" /> Approve
                          </button>
                        )}
                        {r.approvalStatus !== 'rejected' && (
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRejecting(r)} aria-label={`Reject ${r.name}`}>
                            <X size={14} aria-hidden="true" /> Reject
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      {data && <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />}
      {rejecting && <RejectDialog title={`Reject ${rejecting.name}?`} onClose={() => setRejecting(null)} onConfirm={(reason) => decide(rejecting, 'rejected', reason)} />}
    </>
  );
}

function ListingQueue() {
  const toast = useToast();
  const [status, setStatus] = useState('pending_approval');
  const [page, setPage] = useState(1);
  const [rejecting, setRejecting] = useState(null);
  const { data, loading, error, reload } = useAsync(() => listPendingListingsApi({ status, page, limit: 10 }), [status, page]);

  async function decide(l, decision, reason) {
    try {
      await decideListingApi(l.id, { decision, reason });
      toast(`"${l.title}" ${decision}`, 'success');
      setRejecting(null);
      reload();
    } catch (err) {
      toast(errorInfo(err).message, 'error');
    }
  }

  return (
    <>
      <div className="tabs" role="tablist" aria-label="Listing status">
        {[['pending_approval', 'Awaiting review'], ['approved', 'Approved'], ['rejected', 'Rejected']].map(([s, label]) => (
          <button key={s} role="tab" type="button" className="tab" aria-selected={status === s} onClick={() => { setStatus(s); setPage(1); }}>
            {label}
          </button>
        ))}
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      {loading && !data && <Spinner />}
      {data &&
        (data.items.length === 0 ? (
          <EmptyState icon={Briefcase} title="No listings here">
            {status === 'pending_approval' ? 'No listings are waiting for review.' : 'Nothing to show.'}
          </EmptyState>
        ) : (
          <div className="stack">
            {data.items.map((l) => (
              <article key={l.id} className="card" style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                <LogoTile name={l.company} />
                <div style={{ flex: '1 1 16rem', minWidth: 0 }}>
                  <h3>{l.title}</h3>
                  <p className="muted small">
                    {l.company} · {l.domain} · {l.location} · {formatStipend(l.stipend)} · {l.duration} mo · closes {formatDate(l.deadline)}
                  </p>
                  <p className="muted small">Posted by {l.recruiterInfo?.name}</p>
                </div>
                <StatusBadge status={l.status} />
                <div className="btn-row">
                  <Link to={`/admin/listings/${l.id}`} className="btn btn-ghost btn-sm">
                    View
                  </Link>
                  {l.status === 'pending_approval' && (
                    <>
                      <button type="button" className="btn btn-success btn-sm" onClick={() => decide(l, 'approved')}>
                        <Check size={14} aria-hidden="true" /> Approve
                      </button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRejecting(l)}>
                        <X size={14} aria-hidden="true" /> Reject
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        ))}
      {data && <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />}
      {rejecting && <RejectDialog title={`Reject "${rejecting.title}"?`} onClose={() => setRejecting(null)} onConfirm={(reason) => decide(rejecting, 'rejected', reason)} />}
    </>
  );
}

export default function Approvals() {
  const [tab, setTab] = useState('recruiters');
  return (
    <>
      <PageHead title="Approvals" subtitle="Review recruiter registrations and internship listings before they go live." />
      <div className="btn-row" role="tablist" aria-label="Approval type" style={{ marginBottom: 18 }}>
        <button role="tab" type="button" className="btn btn-sm" style={tab === 'recruiters' ? undefined : { background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border-strong)', boxShadow: 'none' }} aria-selected={tab === 'recruiters'} onClick={() => setTab('recruiters')}>
          <UserCheck size={15} aria-hidden="true" /> Recruiters
        </button>
        <button role="tab" type="button" className="btn btn-sm" style={tab === 'listings' ? undefined : { background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border-strong)', boxShadow: 'none' }} aria-selected={tab === 'listings'} onClick={() => setTab('listings')}>
          <ShieldCheck size={15} aria-hidden="true" /> Listings
        </button>
      </div>
      {tab === 'recruiters' ? <RecruiterQueue /> : <ListingQueue />}
    </>
  );
}
