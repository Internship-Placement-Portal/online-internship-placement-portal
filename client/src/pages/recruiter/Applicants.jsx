import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarPlus, Check, ChevronLeft, FileText, Users, X } from 'lucide-react';
import { listingApplicantsApi, openResume, scheduleInterviewApi, updateStatusApi } from '../../api/applications.js';
import { getListingApi } from '../../api/listings.js';
import { errorInfo } from '../../api/http.js';
import { Alert, EmptyState, Field, Modal, PageHead, Pagination, Spinner, StatusBadge, useAsync, useToast } from '../../components/ui.jsx';
import { formatDate, formatDateTime } from '../../lib/format.js';

const FILTERS = ['', 'Applied', 'Shortlisted', 'Selected', 'Rejected'];

// IPP-F-013: schedule / record interview details for a shortlisted candidate.
function InterviewDialog({ applicant, onClose, onSaved }) {
  const toast = useToast();
  const existing = applicant.interview;
  const [form, setForm] = useState({
    date: existing ? new Date(existing.date).toISOString().slice(0, 16) : '',
    mode: existing?.mode || 'online',
    link: existing?.link || '',
    notes: existing?.notes || '',
  });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setErrors({});
    try {
      await scheduleInterviewApi(applicant.id, {
        date: form.date ? new Date(form.date).toISOString() : '',
        mode: form.mode,
        link: form.mode === 'online' ? form.link : undefined,
        notes: form.notes,
      });
      toast('Interview saved and student notified', 'success');
      onSaved();
    } catch (err) {
      const info = errorInfo(err);
      setError(info.message);
      setErrors(Object.fromEntries(info.errors.map((x) => [x.field, x.message])));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Interview with ${applicant.student.name}`} onClose={onClose}>
      <form onSubmit={save} noValidate className="stack" style={{ gap: 14 }}>
        <Field id="date" label="Date and time" error={errors.date}>
          {(a) => <input {...a} type="datetime-local" value={form.date} onChange={set('date')} required />}
        </Field>
        <Field id="mode" label="Mode" error={errors.mode}>
          {(a) => (
            <select {...a} value={form.mode} onChange={set('mode')}>
              <option value="online">Online</option>
              <option value="in-person">In person</option>
            </select>
          )}
        </Field>
        {form.mode === 'online' && (
          <Field id="link" label="Meeting link" error={errors.link}>
            {(a) => <input {...a} type="url" placeholder="https://meet.example.com/…" value={form.link} onChange={set('link')} />}
          </Field>
        )}
        <Field id="notes" label={form.mode === 'online' ? 'Notes (optional)' : 'Venue and notes'} error={errors.notes}>
          {(a) => <textarea {...a} style={{ minHeight: '4.5rem' }} maxLength={500} value={form.notes} onChange={set('notes')} />}
        </Field>
        {error && !Object.keys(errors).length && <Alert tone="danger">{error}</Alert>}
        <div className="btn-row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn" disabled={busy}>
            {busy ? 'Saving…' : 'Save interview'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// IPP-F-011: recruiter views, filters and updates application status for one of their listings.
export default function Applicants() {
  const { id } = useParams();
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [scheduling, setScheduling] = useState(null);
  const { data: listing } = useAsync(() => getListingApi(id), [id]);
  const { data, loading, error, reload } = useAsync(() => listingApplicantsApi(id, { status, page, limit: 10 }), [id, status, page]);

  async function setApplicantStatus(a, next) {
    try {
      await updateStatusApi(a.id, next);
      toast(`${a.student.name} marked ${next}`, 'success');
      reload();
    } catch (err) {
      toast(errorInfo(err).message, 'error');
    }
  }

  return (
    <>
      <Link to="/recruiter/listings" className="breadcrumb">
        <ChevronLeft size={16} aria-hidden="true" /> My listings
      </Link>
      <PageHead title="Applicants" subtitle={listing ? `${listing.title} · ${listing.company}` : undefined} />
      <div className="tabs" role="tablist" aria-label="Filter by status">
        {FILTERS.map((s) => (
          <button key={s || 'all'} role="tab" type="button" className="tab" aria-selected={status === s} onClick={() => { setStatus(s); setPage(1); }}>
            {s || 'All'}
          </button>
        ))}
      </div>

      {error && <Alert tone="danger">{error}</Alert>}
      {loading && !data && <Spinner />}
      {data &&
        (data.items.length === 0 ? (
          <EmptyState icon={Users} title={status ? `No ${status.toLowerCase()} applicants` : 'No applicants yet'}>
            Applications appear here as soon as students apply.
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table>
              <caption className="sr-only">Applicants</caption>
              <thead>
                <tr>
                  <th scope="col">Student</th>
                  <th scope="col">College</th>
                  <th scope="col">Applied</th>
                  <th scope="col">Status</th>
                  <th scope="col">Interview</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <strong>{a.student.name}</strong>
                      <div className="muted small">{a.student.email}</div>
                    </td>
                    <td>{a.student.profile?.college || <span className="muted">—</span>}</td>
                    <td>{formatDate(a.createdAt)}</td>
                    <td>
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="small">{a.interview ? formatDateTime(a.interview.date) : <span className="muted">—</span>}</td>
                    <td>
                      <div className="btn-row" style={{ justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => openResume(a.id).catch((err) => toast(errorInfo(err).message, 'error'))}
                          aria-label={`View resume of ${a.student.name}`}
                        >
                          <FileText size={14} aria-hidden="true" /> Resume
                        </button>
                        {a.status === 'Applied' && (
                          <button type="button" className="btn btn-sm" onClick={() => setApplicantStatus(a, 'Shortlisted')}>
                            Shortlist
                          </button>
                        )}
                        {a.status === 'Shortlisted' && (
                          <>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setScheduling(a)}>
                              <CalendarPlus size={14} aria-hidden="true" /> {a.interview ? 'Reschedule' : 'Interview'}
                            </button>
                            <button type="button" className="btn btn-success btn-sm" onClick={() => setApplicantStatus(a, 'Selected')}>
                              <Check size={14} aria-hidden="true" /> Select
                            </button>
                          </>
                        )}
                        {a.status !== 'Rejected' && a.status !== 'Selected' && (
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setApplicantStatus(a, 'Rejected')} aria-label={`Reject ${a.student.name}`}>
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
      {scheduling && (
        <InterviewDialog
          applicant={scheduling}
          onClose={() => setScheduling(null)}
          onSaved={() => {
            setScheduling(null);
            reload();
          }}
        />
      )}
    </>
  );
}
