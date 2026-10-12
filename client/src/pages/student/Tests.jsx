import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Award, Clock, ListChecks, Lock, Play, RotateCcw, Timer } from 'lucide-react';
import { listTestsApi, myAttemptsApi, startTestApi } from '../../api/tests.js';
import { errorInfo } from '../../api/http.js';
import { Alert, EmptyState, PageHead, Pagination, Skeletons, StatusBadge, useAsync, useToast } from '../../components/ui.jsx';
import { formatDateTime } from '../../lib/format.js';

const mmss = (s) => (s == null ? '—' : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`);

// IPP-F-014 / IPP-F-016: available tests, one attempt each unless an administrator re-enables it.
export default function Tests() {
  const navigate = useNavigate();
  const toast = useToast();
  const [starting, setStarting] = useState('');
  const [page, setPage] = useState(1);
  const { data: tests, loading, error, reload } = useAsync(listTestsApi, []);
  const { data: history } = useAsync(() => myAttemptsApi({ page, limit: 5 }), [page]);

  async function start(t) {
    setStarting(t.id);
    try {
      const attempt = await startTestApi(t.id);
      navigate(`/student/tests/attempt/${attempt.id}`);
    } catch (err) {
      toast(errorInfo(err).message, 'error');
      reload();
    } finally {
      setStarting('');
    }
  }

  return (
    <>
      <PageHead title="Aptitude tests" subtitle="Timed practice tests, scored instantly. Each test can be taken once unless an administrator re-enables it." />
      {error && <Alert tone="danger">{error}</Alert>}
      {loading && !tests && <Skeletons count={3} />}
      {tests &&
        (tests.length === 0 ? (
          <EmptyState icon={ListChecks} title="No tests available">
            Tests created by the placement office will show up here.
          </EmptyState>
        ) : (
          <div className="cards">
            {tests.map((t) => (
              <article key={t.id} className="card stack" style={{ alignContent: 'start' }}>
                <div>
                  <h3>{t.title}</h3>
                  <p className="muted small" style={{ marginTop: 4 }}>
                    {t.description}
                  </p>
                </div>
                <div className="meta">
                  <span>
                    <Clock size={15} aria-hidden="true" /> {t.durationMinutes} min
                  </span>
                  <span>
                    <ListChecks size={15} aria-hidden="true" /> {t.questionCount} questions
                  </span>
                </div>
                {t.lastResult && t.state === 'completed' && (
                  <p className="small" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Award size={16} aria-hidden="true" style={{ color: 'var(--primary)' }} />
                    Last score: <strong>{t.lastResult.score}/{t.lastResult.maxScore}</strong> · {t.lastResult.accuracy}% accuracy
                  </p>
                )}
                {t.reenabled && (
                  <Alert tone="success">An administrator re-enabled this test. You can attempt it again.</Alert>
                )}
                <div className="btn-row" style={{ marginTop: 'auto' }}>
                  {t.state === 'in_progress' && (
                    <button type="button" className="btn" onClick={() => start(t)} disabled={starting === t.id}>
                      <Timer size={16} aria-hidden="true" /> Resume test
                    </button>
                  )}
                  {t.state === 'available' && (
                    <button type="button" className="btn" onClick={() => start(t)} disabled={starting === t.id}>
                      {t.reenabled ? <RotateCcw size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}{' '}
                      {starting === t.id ? 'Starting…' : 'Start test'}
                    </button>
                  )}
                  {t.state === 'completed' && (
                    <>
                      <Link to={`/student/tests/result/${t.attemptId}`} className="btn btn-secondary">
                        View result
                      </Link>
                      <span className="muted small" style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                        <Lock size={14} aria-hidden="true" /> Completed
                      </span>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        ))}

      {history && history.items.length > 0 && (
        <section style={{ marginTop: 36 }} aria-labelledby="history">
          <h2 id="history" style={{ marginBottom: 12 }}>
            Your results
          </h2>
          <div className="table-wrap">
            <table>
              <caption className="sr-only">Completed test attempts</caption>
              <thead>
                <tr>
                  <th scope="col">Test</th>
                  <th scope="col">Date</th>
                  <th scope="col">Score</th>
                  <th scope="col">Accuracy</th>
                  <th scope="col">Time</th>
                  <th scope="col">Status</th>
                  <th scope="col">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {history.items.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <strong>{a.test.title}</strong>
                      {a.attemptNo > 1 && <span className="muted small"> · attempt {a.attemptNo}</span>}
                    </td>
                    <td>{formatDateTime(a.submittedAt)}</td>
                    <td>
                      {a.score}/{a.maxScore}
                    </td>
                    <td>{a.accuracy}%</td>
                    <td>{mmss(a.timeTakenSec)}</td>
                    <td>
                      <StatusBadge status={a.status} />
                    </td>
                    <td>
                      <Link to={`/student/tests/result/${a.id}`} className="btn btn-ghost btn-sm">
                        Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={history.page} totalPages={history.totalPages} onChange={setPage} />
        </section>
      )}
    </>
  );
}
