import { Link, useParams } from 'react-router-dom';
import { CalendarClock, Check, ChevronLeft, ExternalLink, FileText, MapPin, Video } from 'lucide-react';
import { getApplicationApi, openResume } from '../../api/applications.js';
import { Alert, EmptyState, Spinner, StatusBadge, useAsync, useToast } from '../../components/ui.jsx';
import { errorInfo } from '../../api/http.js';
import { formatDateTime } from '../../lib/format.js';

const FLOW = ['Applied', 'Shortlisted', 'Selected'];

// Application detail page: status timeline, interview details (IPP-F-013) and the submitted resume.
export default function ApplicationDetail() {
  const { id } = useParams();
  const toast = useToast();
  const { data: a, loading, error } = useAsync(() => getApplicationApi(id), [id]);

  if (loading) return <Spinner label="Loading application…" />;
  if (error || !a) {
    return (
      <>
        <Link to="/student/applications" className="breadcrumb">
          <ChevronLeft size={16} aria-hidden="true" /> My applications
        </Link>
        <EmptyState icon={FileText} title="Application not found">
          {error}
        </EmptyState>
      </>
    );
  }

  const rejected = a.status === 'Rejected';
  const reached = FLOW.indexOf(a.status);
  const iv = a.interview;
  return (
    <>
      <Link to="/student/applications" className="breadcrumb">
        <ChevronLeft size={16} aria-hidden="true" /> My applications
      </Link>
      <div className="page-head">
        <div>
          <h1>{a.listing?.title}</h1>
          <p>
            {a.listing?.company} · {a.listing?.location}
          </p>
        </div>
        <StatusBadge status={a.status} />
      </div>

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <section className="card" aria-labelledby="progress">
          <h2 id="progress">Progress</h2>
          <ol className="timeline" aria-label="Application progress">
            {FLOW.map((step, i) => {
              const done = !rejected && reached >= i;
              return (
                <li key={step} className={done ? 'done' : ''} aria-current={!rejected && reached === i ? 'step' : undefined}>
                  <span className="dot">{done ? <Check size={14} aria-hidden="true" /> : i + 1}</span>
                  <div>
                    <strong>{step}</strong>
                  </div>
                </li>
              );
            })}
            {rejected && (
              <li className="rejected">
                <span className="dot">!</span>
                <strong>Rejected</strong>
              </li>
            )}
          </ol>
          {a.statusHistory?.length > 0 && (
            <ul className="history muted small">
              {[...a.statusHistory].reverse().map((h, i) => (
                <li key={i}>
                  {h.status} · {formatDateTime(h.at)}
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="stack">
          <section className="card" aria-labelledby="interview">
            <h2 id="interview">Interview</h2>
            {iv ? (
              <dl className="facts" style={{ marginTop: 12 }}>
                <div className="fact">
                  <CalendarClock size={18} aria-hidden="true" />
                  <dt>When</dt>
                    <dd>{formatDateTime(iv.date)}</dd>
                </div>
                <div className="fact">
                  {iv.mode === 'online' ? <Video size={18} aria-hidden="true" /> : <MapPin size={18} aria-hidden="true" />}
                  <dt>Mode</dt>
                    <dd style={{ textTransform: 'capitalize' }}>{iv.mode}</dd>
                </div>
                {iv.link && (
                  <div className="fact">
                    <ExternalLink size={18} aria-hidden="true" />
                    <dt>Meeting link</dt>
                      <dd>
                        <a href={iv.link} target="_blank" rel="noopener noreferrer">
                          {iv.link}
                        </a>
                      </dd>
                  </div>
                )}
                {iv.notes && (
                  <div className="fact">
                    <FileText size={18} aria-hidden="true" />
                    <dt>Notes</dt>
                      <dd className="prose">{iv.notes}</dd>
                  </div>
                )}
              </dl>
            ) : (
              <p className="muted" style={{ marginTop: 8 }}>
                {a.status === 'Shortlisted' ? 'You are shortlisted. The recruiter will schedule an interview soon.' : 'No interview scheduled yet.'}
              </p>
            )}
          </section>

          <section className="card" aria-labelledby="resume">
            <h2 id="resume">Your resume</h2>
            <p className="muted small" style={{ margin: '6px 0 12px' }}>
              {a.resumeOriginalName}
            </p>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => openResume(a.id).catch((err) => toast(errorInfo(err).message, 'error'))}
            >
              <FileText size={16} aria-hidden="true" /> View PDF
            </button>
          </section>
          {a.listing?.id && (
            <Link to={`/student/internships/${a.listing.id}`} className="btn btn-ghost">
              View internship
            </Link>
          )}
        </div>
      </div>
      {a.status === 'Selected' && (
        <div style={{ marginTop: 16 }}>
          <Alert tone="success">Congratulations! You have been selected for this internship.</Alert>
        </div>
      )}
    </>
  );
}
