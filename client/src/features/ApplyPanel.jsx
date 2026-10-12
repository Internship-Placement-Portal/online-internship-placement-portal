import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, FileText, Send, Upload, X } from 'lucide-react';
import { applyApi } from '../api/applications.js';
import { errorInfo } from '../api/http.js';
import { Alert, StatusBadge, useToast } from '../components/ui.jsx';

const MAX = 5 * 1024 * 1024;

// IPP-F-010: upload a PDF resume (max 5 MB) and apply in a single action. Checks mirror the server's (SR-005).
export default function ApplyPanel({ listing }) {
  const toast = useToast();
  const input = useRef(null);
  const [file, setFile] = useState(null);
  const [application, setApplication] = useState(listing.application);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  function pick(f) {
    setError('');
    if (!f) return setFile(null);
    if (f.type !== 'application/pdf' || !/\.pdf$/i.test(f.name)) return setError('Only PDF files are accepted.');
    if (f.size > MAX) return setError('Resume must be 5 MB or smaller.');
    setFile(f);
  }

  async function submit(e) {
    e.preventDefault();
    if (!file) return setError('Choose your PDF resume first.');
    setBusy(true);
    setError('');
    try {
      const created = await applyApi(listing.id, file);
      setApplication({ id: created.id, status: created.status });
      toast('Application submitted', 'success');
    } catch (err) {
      const info = errorInfo(err);
      if (info.code === 'ALREADY_APPLIED') setApplication({ status: 'Applied' });
      setError(info.message);
    } finally {
      setBusy(false);
    }
  }

  if (application) {
    return (
      <section className="card stack" aria-labelledby="applied-h">
        <h2 id="applied-h" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle2 size={20} aria-hidden="true" style={{ color: 'var(--success)' }} /> You applied
        </h2>
        <p className="muted small">
          Current status: <StatusBadge status={application.status} />
        </p>
        {application.id && (
          <Link to={`/student/applications/${application.id}`} className="btn btn-secondary">
            View application
          </Link>
        )}
      </section>
    );
  }

  return (
    <form className="card" onSubmit={submit} noValidate aria-labelledby="apply-h">
      <h2 id="apply-h">Apply now</h2>
      <p className="muted small" style={{ marginTop: 4 }}>
        Upload your resume (PDF, up to 5 MB) and submit in one step.
      </p>

      <input ref={input} id="resume" type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
      {file ? (
        <div className="file-chip" style={{ marginTop: 14 }}>
          <FileText size={18} aria-hidden="true" />
          <span className="file-name">{file.name}</span>
          <span className="muted small">{(file.size / 1024).toFixed(0)} KB</span>
          <button type="button" className="icon-btn" aria-label="Remove file" onClick={() => { setFile(null); if (input.current) input.current.value = ''; }}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <label
          htmlFor="resume"
          className={`dropzone${dragging ? ' drag' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            pick(e.dataTransfer.files?.[0]);
          }}
        >
          <Upload size={22} aria-hidden="true" />
          <strong>Choose a PDF</strong>
          <span className="muted small">or drag and drop it here</span>
        </label>
      )}

      {error && (
        <div style={{ marginTop: 12 }}>
          <Alert tone="danger">{error}</Alert>
        </div>
      )}
      <button type="submit" className="btn btn-block" disabled={busy || !file}>
        <Send size={16} aria-hidden="true" /> {busy ? 'Submitting…' : 'Submit application'}
      </button>
    </form>
  );
}
