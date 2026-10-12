import { Link, useParams } from 'react-router-dom';
import { Check, ChevronLeft, Clock, Code2, Target, X } from 'lucide-react';
import { attemptResultApi } from '../../api/tests.js';
import { Alert, Spinner, StatusBadge, useAsync } from '../../components/ui.jsx';
import { formatDateTime } from '../../lib/format.js';

const mmss = (s) => (s == null ? '—' : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`);

export function ScoreRing({ value, label }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="ring" role="img" aria-label={`${label}: ${value}%`}>
      <svg viewBox="0 0 130 130" width="130" height="130" aria-hidden="true">
        <circle cx="65" cy="65" r={r} fill="none" stroke="var(--border)" strokeWidth="12" />
        <circle
          cx="65"
          cy="65"
          r={r}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(100, value) / 100)}
          transform="rotate(-90 65 65)"
        />
      </svg>
      <div className="ring-label">
        <strong>{Math.round(value)}%</strong>
        <span className="muted small">{label}</span>
      </div>
    </div>
  );
}

export function BarRow({ label, value, caption }) {
  return (
    <div className="bar-row">
      <div className="bar-label">
        <span>{label}</span>
        <span className="muted small">{caption ?? `${value}%`}</span>
      </div>
      <div className="bar-track" role="img" aria-label={`${label}: ${value}%`}>
        <span style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  );
}

// IPP-F-015 (immediate score) + IPP-F-017 (accuracy, time per question, category-wise performance).
export default function TestResult() {
  const { id } = useParams();
  const { data: r, loading, error } = useAsync(() => attemptResultApi(id), [id]);

  if (loading) return <Spinner label="Loading your result…" />;
  if (error || !r) {
    return (
      <>
        <Link to="/student/tests" className="breadcrumb">
          <ChevronLeft size={16} aria-hidden="true" /> Tests
        </Link>
        <Alert tone="danger">{error || 'Result not available.'}</Alert>
      </>
    );
  }

  return (
    <>
      <Link to="/student/tests" className="breadcrumb">
        <ChevronLeft size={16} aria-hidden="true" /> Tests
      </Link>
      <div className="page-head">
        <div>
          <h1>{r.test.title}</h1>
          <p>
            Attempt {r.attemptNo} · {formatDateTime(r.submittedAt)}
          </p>
        </div>
        <StatusBadge status={r.status} />
      </div>
      {r.status === 'auto_submitted' && (
        <div style={{ marginBottom: 16 }}>
          <Alert tone="warning">Time ran out, so your test was submitted automatically with the answers saved so far.</Alert>
        </div>
      )}

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <section className="card result-hero" aria-labelledby="score-h">
          <ScoreRing value={r.accuracy} label="accuracy" />
          <div>
            <h2 id="score-h">Your score</h2>
            <p className="big-score">
              {r.score}
              <span className="muted"> / {r.maxScore}</span>
            </p>
            <p className="muted small">
              {r.correctCount} correct of {r.review.filter((x) => x.type === 'mcq').length} multiple-choice questions
            </p>
          </div>
        </section>

        <section className="card" aria-labelledby="stats-h">
          <h2 id="stats-h">Summary</h2>
          <dl className="facts" style={{ marginTop: 12 }}>
            <div className="fact">
              <Target size={18} aria-hidden="true" />
              <dt>Answered</dt>
                <dd>
                  {r.answeredCount} of {r.totalQuestions}
                </dd>
            </div>
            <div className="fact">
              <Clock size={18} aria-hidden="true" />
              <dt>Time taken</dt>
                <dd>
                  {mmss(r.timeTakenSec)} <span className="muted small">· avg {r.avgTimePerQuestionSec}s per question</span>
                </dd>
            </div>
            {r.codingPending > 0 && (
              <div className="fact">
                <Code2 size={18} aria-hidden="true" />
                <dt>Coding answers</dt>
                  <dd>{r.codingPending} awaiting review</dd>
              </div>
            )}
          </dl>
        </section>
      </div>

      {r.categoryBreakdown.length > 0 && (
        <section className="card" style={{ marginTop: 16 }} aria-labelledby="cat-h">
          <h2 id="cat-h" style={{ marginBottom: 12 }}>
            Performance by category
          </h2>
          <div className="stack" style={{ gap: 14 }}>
            {r.categoryBreakdown
              .filter((c) => c.total > 0)
              .map((c) => (
                <BarRow key={c.category} label={c.category} value={c.accuracy} caption={`${c.correct}/${c.total} correct · ${c.accuracy}%`} />
              ))}
          </div>
        </section>
      )}

      <h2 style={{ margin: '28px 0 12px' }}>Review your answers</h2>
      <div className="stack" style={{ gap: 10 }}>
        {r.review.map((x) => (
          <details key={x.questionId} className="card review">
            <summary>
              <span className={`mark ${x.correct === true ? 'ok' : x.correct === false ? 'bad' : 'neutral'}`} aria-hidden="true">
                {x.correct === true ? <Check size={14} /> : x.correct === false ? <X size={14} /> : <Code2 size={14} />}
              </span>
              <span className="grow">
                <span className="sr-only">{x.correct === true ? 'Correct. ' : x.correct === false ? 'Incorrect. ' : 'Coding answer. '}</span>
                {x.order}. {x.text}
              </span>
              <span className="muted small">{x.timeSpentSec}s</span>
            </summary>
            {x.type === 'mcq' ? (
              <ul className="review-options">
                {x.options.map((o, i) => (
                  <li key={i} className={`${i === x.correctIndex ? 'right' : ''} ${i === x.selectedIndex && i !== x.correctIndex ? 'wrong' : ''}`}>
                    <span className="letter">{String.fromCharCode(65 + i)}</span> {o}
                    {i === x.correctIndex && <em> — correct answer</em>}
                    {i === x.selectedIndex && i !== x.correctIndex && <em> — your answer</em>}
                    {i === x.selectedIndex && i === x.correctIndex && <em> — your answer</em>}
                  </li>
                ))}
                {x.selectedIndex === null && <li className="muted">You did not answer this question.</li>}
              </ul>
            ) : (
              <pre className="code-review">{x.codeAnswer || 'No answer submitted.'}</pre>
            )}
          </details>
        ))}
      </div>
    </>
  );
}
