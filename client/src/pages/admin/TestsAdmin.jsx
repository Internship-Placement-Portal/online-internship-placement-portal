import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BarChart3, ChevronLeft, ClipboardList, Clock, ListChecks, Pencil, Plus, RotateCcw } from 'lucide-react';
import { adminCreateTestApi, adminListTestsApi, adminTestAttemptsApi, adminUpdateTestApi, questionCategoriesApi, reenableAttemptApi } from '../../api/tests.js';
import { errorInfo } from '../../api/http.js';
import { Alert, EmptyState, Field, Modal, PageHead, Pagination, Skeletons, Spinner, StatusBadge, useAsync, useToast } from '../../components/ui.jsx';
import { formatDateTime } from '../../lib/format.js';
import { BarRow } from '../student/TestResult.jsx';

function TestForm({ test, categories, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    title: test?.title || '',
    description: test?.description || '',
    durationMinutes: test?.durationMinutes || 30,
    questionCount: test?.questionCount || 10,
    categories: test?.categories || [],
    isActive: test?.isActive ?? true,
  });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggleCat = (c) => setForm((f) => ({ ...f, categories: f.categories.includes(c) ? f.categories.filter((x) => x !== c) : [...f.categories, c] }));

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setErrors({});
    const body = { ...form, durationMinutes: Number(form.durationMinutes), questionCount: Number(form.questionCount) };
    try {
      if (test) await adminUpdateTestApi(test.id, body);
      else await adminCreateTestApi(body);
      toast(test ? 'Test updated' : 'Test created', 'success');
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
    <Modal title={test ? 'Edit test' : 'New test'} onClose={onClose} wide>
      <form onSubmit={save} noValidate className="stack" style={{ gap: 14 }}>
        <Field id="title" label="Title" error={errors.title}>
          {(a) => <input {...a} value={form.title} onChange={set('title')} required maxLength={120} />}
        </Field>
        <Field id="description" label="Description" error={errors.description}>
          {(a) => <input {...a} value={form.description} onChange={set('description')} maxLength={500} />}
        </Field>
        <div className="form-grid">
          <Field id="durationMinutes" label="Duration (minutes)" error={errors.durationMinutes}>
            {(a) => <input {...a} type="number" min="1" max="180" value={form.durationMinutes} onChange={set('durationMinutes')} />}
          </Field>
          <Field id="questionCount" label="Questions per attempt" error={errors.questionCount}>
            {(a) => <input {...a} type="number" min="1" max="100" value={form.questionCount} onChange={set('questionCount')} />}
          </Field>
        </div>
        <fieldset className="options" style={{ gap: 6 }}>
          <legend className="label" style={{ marginTop: 0 }}>
            Question categories <span className="muted small">(none selected = whole bank)</span>
          </legend>
          <div className="chips">
            {(categories || []).map((c) => (
              <label key={c} className={`chip chip-check${form.categories.includes(c) ? ' on' : ''}`} style={{ margin: 0 }}>
                <input type="checkbox" checked={form.categories.includes(c)} onChange={() => toggleCat(c)} />
                {c}
              </label>
            ))}
          </div>
        </fieldset>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', margin: 0 }}>
          <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
          Visible to students
        </label>
        {error && !Object.keys(errors).length && <Alert tone="danger">{error}</Alert>}
        <div className="btn-row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn" disabled={busy}>
            {busy ? 'Saving…' : 'Save test'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// IPP-F-014 configuration: durations, question counts, categories.
export function TestsAdmin() {
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const { data: categories } = useAsync(questionCategoriesApi, []);
  const { data, loading, error, reload } = useAsync(() => adminListTestsApi({ page, limit: 12 }), [page]);

  return (
    <>
      <PageHead
        title="Tests"
        subtitle="Configure aptitude tests and review how students performed."
        actions={
          <button type="button" className="btn" onClick={() => setEditing('new')}>
            <Plus size={17} aria-hidden="true" /> New test
          </button>
        }
      />
      {error && <Alert tone="danger">{error}</Alert>}
      {loading && !data && <Skeletons count={3} />}
      {data &&
        (data.items.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No tests yet">
            Create a test and choose which question categories it draws from.
          </EmptyState>
        ) : (
          <div className="cards">
            {data.items.map((t) => (
              <article key={t.id} className="card stack" style={{ alignContent: 'start' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <h3>{t.title}</h3>
                  <span className={`badge ${t.isActive ? 'badge-success' : 'badge-neutral'}`}>{t.isActive ? 'Active' : 'Hidden'}</span>
                </div>
                <p className="muted small">{t.description || 'No description'}</p>
                <div className="meta">
                  <span>
                    <Clock size={15} aria-hidden="true" /> {t.durationMinutes} min
                  </span>
                  <span>
                    <ListChecks size={15} aria-hidden="true" /> {t.questionCount} questions
                  </span>
                </div>
                <div className="chips">
                  {t.categories.length ? t.categories.map((c) => <span className="chip" key={c}>{c}</span>) : <span className="chip">All categories</span>}
                </div>
                <div className="btn-row" style={{ marginTop: 'auto' }}>
                  <Link to={`/admin/tests/${t.id}/attempts`} className="btn btn-secondary btn-sm">
                    <BarChart3 size={14} aria-hidden="true" /> Results
                  </Link>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(t)}>
                    <Pencil size={14} aria-hidden="true" /> Edit
                  </button>
                </div>
              </article>
            ))}
          </div>
        ))}
      {data && <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />}
      {editing && (
        <TestForm
          test={editing === 'new' ? null : editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </>
  );
}

const mmss = (s) => (s == null ? '—' : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`);

// IPP-F-017 (per-test analytics) + IPP-F-016 (admin override to allow a reattempt).
export function TestAttempts() {
  const { id } = useParams();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useAsync(() => adminTestAttemptsApi(id, { page, limit: 10 }), [id, page]);

  async function reenable(a) {
    try {
      await reenableAttemptApi(a.id);
      toast(`Test re-enabled for ${a.student.name}`, 'success');
      reload();
    } catch (err) {
      toast(errorInfo(err).message, 'error');
    }
  }

  if (loading && !data) return <Spinner />;
  if (error) return <Alert tone="danger">{error}</Alert>;
  const { summary, test } = data;

  return (
    <>
      <Link to="/admin/tests" className="breadcrumb">
        <ChevronLeft size={16} aria-hidden="true" /> Tests
      </Link>
      <PageHead title={test.title} subtitle="Attempts and performance analytics" />
      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        {[
          ['Attempts', summary.attempts],
          ['Students', summary.students],
          ['Avg. accuracy', `${summary.avgAccuracy}%`],
          ['Avg. score', `${summary.avgScore}/${summary.avgMaxScore}`],
        ].map(([label, num]) => (
          <div className="card stat" key={label}>
            <div>
              <div className="stat-num">{num}</div>
              <div className="stat-label">{label}</div>
            </div>
          </div>
        ))}
      </div>
      {summary.categoryAccuracy.length > 0 && (
        <section className="card" style={{ marginBottom: 16 }} aria-labelledby="cat">
          <h2 id="cat" style={{ marginBottom: 12 }}>
            Category-wise accuracy
          </h2>
          <div className="stack" style={{ gap: 14 }}>
            {summary.categoryAccuracy.map((c) => (
              <BarRow key={c.category} label={c.category} value={c.accuracy} caption={`${c.accuracy}% · ${c.total} answers`} />
            ))}
          </div>
        </section>
      )}

      {data.items.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No attempts yet">
          Results appear here once students take this test.
        </EmptyState>
      ) : (
        <div className="table-wrap">
          <table>
            <caption className="sr-only">Attempts</caption>
            <thead>
              <tr>
                <th scope="col">Student</th>
                <th scope="col">Attempt</th>
                <th scope="col">Status</th>
                <th scope="col">Score</th>
                <th scope="col">Accuracy</th>
                <th scope="col">Time</th>
                <th scope="col">Finished</th>
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
                  <td>#{a.attemptNo}</td>
                  <td>{a.status === 'reenabled' ? <span className="badge badge-info">Re-enabled</span> : <StatusBadge status={a.status} />}</td>
                  <td>{a.score != null ? `${a.score}/${a.maxScore}` : '—'}</td>
                  <td>{a.accuracy != null ? `${a.accuracy}%` : '—'}</td>
                  <td>{mmss(a.timeTakenSec)}</td>
                  <td className="small">{formatDateTime(a.submittedAt)}</td>
                  <td>
                    {['submitted', 'auto_submitted'].includes(a.status) && (
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => reenable(a)} aria-label={`Allow reattempt for ${a.student.name}`}>
                        <RotateCcw size={14} aria-hidden="true" /> Allow reattempt
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
    </>
  );
}
