import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, ChevronLeft, ChevronRight, CloudOff, Loader2, Send, Timer } from 'lucide-react';
import { getAttemptApi, saveAnswersApi, submitAttemptApi } from '../../api/tests.js';
import { errorInfo } from '../../api/http.js';
import { Alert, Modal, Spinner, useToast } from '../../components/ui.jsx';

const AUTOSAVE_DEBOUNCE_MS = 1200;
const AUTOSAVE_INTERVAL_MS = 15000;
const storeKey = (id) => `ipp-attempt-${id}`;

const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
const announceAt = { 300: '5 minutes remaining', 60: '1 minute remaining', 30: '30 seconds remaining', 10: '10 seconds remaining' };

// IPP-F-014: the timed test. The server owns the clock; this screen counts down locally, re-syncs on every save,
// saves progress automatically (also while offline, via localStorage) and submits by itself at zero.
export default function TestRunner() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [attempt, setAttempt] = useState(null);
  const [error, setError] = useState('');
  const [answers, setAnswers] = useState({}); // questionId -> { selectedIndex?, codeAnswer? }
  const [current, setCurrent] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [saveState, setSaveState] = useState('saved'); // saved | saving | offline
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [announce, setAnnounce] = useState('');

  const endAt = useRef(0);
  const dirty = useRef(new Map()); // questionId -> version (changed since last successful save)
  const spent = useRef({}); // questionId -> seconds on question
  const answersRef = useRef({});
  const currentQid = useRef(null);
  const finished = useRef(false);
  const saveTimer = useRef(null);
  const flushing = useRef(false);

  answersRef.current = answers;

  const persistLocal = useCallback(() => {
    try {
      if (dirty.current.size === 0) localStorage.removeItem(storeKey(id));
      else {
        const pending = {};
        dirty.current.forEach((_, qid) => {
          pending[qid] = { ...answersRef.current[qid], timeSpentSec: spent.current[qid] || 0 };
        });
        localStorage.setItem(storeKey(id), JSON.stringify(pending));
      }
    } catch {
      /* storage unavailable: autosave to the server still works */
    }
  }, [id]);

  const goToResult = useCallback(() => {
    finished.current = true;
    try {
      localStorage.removeItem(storeKey(id));
    } catch {
      /* ignore */
    }
    navigate(`/student/tests/result/${id}`, { replace: true });
  }, [id, navigate]);

  const buildPayload = useCallback(
    (qids) =>
      qids.map((qid) => {
        const a = answersRef.current[qid] || {};
        const item = { questionId: qid, timeSpentSec: Math.round(spent.current[qid] || 0) };
        if ('selectedIndex' in a) item.selectedIndex = a.selectedIndex;
        if ('codeAnswer' in a) item.codeAnswer = a.codeAnswer;
        return item;
      }),
    []
  );

  // Sends everything that changed since the last successful save. Failures keep the changes queued.
  const flush = useCallback(async () => {
    if (finished.current || flushing.current || dirty.current.size === 0) return;
    flushing.current = true;
    const snapshot = new Map(dirty.current);
    setSaveState('saving');
    try {
      const res = await saveAnswersApi(id, buildPayload([...snapshot.keys()]));
      snapshot.forEach((version, qid) => {
        if (dirty.current.get(qid) === version) dirty.current.delete(qid);
      });
      endAt.current = Date.now() + res.remainingSeconds * 1000; // re-sync with the server clock
      setSaveState(dirty.current.size ? 'saving' : 'saved');
      persistLocal();
    } catch (err) {
      const code = errorInfo(err).code;
      if (code === 'ATTEMPT_EXPIRED' || code === 'ATTEMPT_CLOSED') goToResult();
      else setSaveState('offline');
    } finally {
      flushing.current = false;
    }
  }, [id, buildPayload, goToResult, persistLocal]);

  const markDirty = useCallback(
    (qid) => {
      dirty.current.set(qid, (dirty.current.get(qid) || 0) + 1);
      persistLocal();
      setSaveState('saving');
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(flush, AUTOSAVE_DEBOUNCE_MS);
    },
    [flush, persistLocal]
  );

  // Final submit with the complete answer set; retries while offline when the timer forced it.
  const finish = useCallback(
    async ({ auto }) => {
      if (finished.current || submitting) return;
      setSubmitting(true);
      clearTimeout(saveTimer.current);
      const qids = attempt.questions.map((q) => q.id);
      for (let tries = 0; tries < (auto ? 20 : 1); tries += 1) {
        try {
          await submitAttemptApi(id, buildPayload(qids));
          goToResult();
          return;
        } catch (err) {
          const code = errorInfo(err).code;
          if (code === 'ATTEMPT_CLOSED' || code === 'ATTEMPT_EXPIRED') return goToResult();
          if (!auto) {
            toast(errorInfo(err).message, 'error');
            break;
          }
          await new Promise((r) => setTimeout(r, 3000)); // keep trying: the server also auto-submits on its own
        }
      }
      setSubmitting(false);
      return undefined;
    },
    [attempt, id, buildPayload, goToResult, submitting, toast]
  );

  // Load the attempt (and merge answers that could not be saved earlier).
  useEffect(() => {
    let active = true;
    getAttemptApi(id)
      .then((a) => {
        if (!active) return;
        if (a.status !== 'in_progress') return goToResult();
        const initial = {};
        a.answers.forEach((x) => {
          initial[x.questionId] = {};
          if (x.selectedIndex !== null && x.selectedIndex !== undefined) initial[x.questionId].selectedIndex = x.selectedIndex;
          if (x.codeAnswer) initial[x.questionId].codeAnswer = x.codeAnswer;
          spent.current[x.questionId] = x.timeSpentSec || 0;
        });
        try {
          const pending = JSON.parse(localStorage.getItem(storeKey(id)) || '{}');
          Object.entries(pending).forEach(([qid, v]) => {
            const { timeSpentSec, ...rest } = v;
            initial[qid] = { ...initial[qid], ...rest };
            spent.current[qid] = Math.max(spent.current[qid] || 0, timeSpentSec || 0);
            dirty.current.set(qid, 1);
          });
        } catch {
          /* ignore corrupt local copy */
        }
        endAt.current = Date.now() + a.remainingSeconds * 1000;
        setAnswers(initial);
        setRemaining(a.remainingSeconds);
        setAttempt(a);
        if (dirty.current.size) flush();
        return undefined;
      })
      .catch((err) => active && setError(errorInfo(err).message));
    return () => {
      active = false;
    };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Countdown + per-question time tracking + periodic save.
  useEffect(() => {
    if (!attempt) return undefined;
    const tick = setInterval(() => {
      const left = Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000));
      setRemaining(left);
      if (announceAt[left]) setAnnounce(announceAt[left]);
      const qid = currentQid.current;
      if (qid && !finished.current) {
        spent.current[qid] = (spent.current[qid] || 0) + 1;
        if (!dirty.current.has(qid)) dirty.current.set(qid, 1);
      }
      if (left === 0) finish({ auto: true });
    }, 1000);
    const save = setInterval(flush, AUTOSAVE_INTERVAL_MS);
    const retryOnline = () => flush();
    window.addEventListener('online', retryOnline);
    return () => {
      clearInterval(tick);
      clearInterval(save);
      window.removeEventListener('online', retryOnline);
    };
  }, [attempt, flush, finish]);

  // Warn before leaving mid-test.
  useEffect(() => {
    const warn = (e) => {
      if (!finished.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  if (error) {
    return (
      <>
        <Alert tone="danger">{error}</Alert>
      </>
    );
  }
  if (!attempt) return <Spinner label="Loading your test…" />;

  const questions = attempt.questions;
  const q = questions[current];
  currentQid.current = q.id;
  const isAnswered = (x) => {
    const a = answers[x.id];
    return x.type === 'mcq' ? Number.isInteger(a?.selectedIndex) : Boolean(a?.codeAnswer?.trim());
  };
  const answeredCount = questions.filter(isAnswered).length;

  function setAnswer(qid, patch) {
    setAnswers((prev) => {
      const next = { ...prev, [qid]: { ...prev[qid], ...patch } };
      answersRef.current = next;
      return next;
    });
    markDirty(qid);
  }

  const low = remaining <= 60;
  return (
    <>
      <div className="runner-head card">
        <div className="grow">
          <h1 style={{ fontSize: '1.25rem' }}>{attempt.test.title}</h1>
          <p className="muted small">
            {answeredCount} of {questions.length} answered
          </p>
          <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={questions.length} aria-valuenow={answeredCount} aria-label="Answered questions">
            <span style={{ width: `${(answeredCount / questions.length) * 100}%` }} />
          </div>
        </div>
        <div className="save-state muted small" aria-live="polite">
          {saveState === 'saved' && (
            <>
              <CheckCircle2 size={15} aria-hidden="true" /> Saved
            </>
          )}
          {saveState === 'saving' && (
            <>
              <Loader2 size={15} className="spin" aria-hidden="true" /> Saving…
            </>
          )}
          {saveState === 'offline' && (
            <span style={{ color: 'var(--danger)', display: 'inline-flex', gap: 4, alignItems: 'center' }}>
              <CloudOff size={15} aria-hidden="true" /> Offline — will retry
            </span>
          )}
        </div>
        <div className={`timer-ring${low ? ' low' : ''}`} role="timer" aria-label="Time remaining">
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle className="track" cx="50" cy="50" r="44" fill="none" strokeWidth="7" />
            <circle
              className="prog"
              cx="50"
              cy="50"
              r="44"
              fill="none"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 44}
              strokeDashoffset={2 * Math.PI * 44 * (1 - Math.max(0, Math.min(1, remaining / (attempt.test.durationMinutes * 60))))}
              transform="rotate(-90 50 50)"
            />
          </svg>
          <span className="time">{fmt(remaining)}</span>
        </div>
      </div>
      <p className="sr-only" aria-live="assertive">
        {announce}
      </p>

      <div className="runner">
        <section className="card" aria-labelledby="qtext">
          <div className="q-meta">
            <span className="badge">{q.category}</span>
            <span className="muted small">
              Question {current + 1} of {questions.length} · {q.marks} {q.marks === 1 ? 'mark' : 'marks'}
            </span>
          </div>
          <h2 id="qtext" className="q-text">
            {q.text}
          </h2>

          {q.type === 'mcq' ? (
            <fieldset className="options">
              <legend className="sr-only">Choose one answer</legend>
              {q.options.map((opt, i) => (
                <label key={i} className={`option${answers[q.id]?.selectedIndex === i ? ' selected' : ''}`}>
                  <input type="radio" name={`q-${q.id}`} checked={answers[q.id]?.selectedIndex === i} onChange={() => setAnswer(q.id, { selectedIndex: i })} />
                  <span className="letter" aria-hidden="true">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span>{opt}</span>
                </label>
              ))}
            </fieldset>
          ) : (
            <div>
              <label htmlFor={`code-${q.id}`} className="sr-only">
                Your answer
              </label>
              <textarea
                id={`code-${q.id}`}
                className="code-input"
                spellCheck={false}
                placeholder="Write your solution here…"
                value={answers[q.id]?.codeAnswer || ''}
                maxLength={5000}
                onChange={(e) => setAnswer(q.id, { codeAnswer: e.target.value })}
              />
              <p className="hint">Coding answers are saved and reviewed by the placement office; they are not auto-scored.</p>
            </div>
          )}

          <div className="btn-row runner-actions">
            <button type="button" className="btn btn-secondary" disabled={current === 0} onClick={() => setCurrent((c) => c - 1)}>
              <ChevronLeft size={16} aria-hidden="true" /> Previous
            </button>
            {q.type === 'mcq' && Number.isInteger(answers[q.id]?.selectedIndex) && (
              <button type="button" className="btn btn-ghost" onClick={() => setAnswer(q.id, { selectedIndex: null })}>
                Clear answer
              </button>
            )}
            <span style={{ flex: 1 }} />
            {current < questions.length - 1 ? (
              <button type="button" className="btn" onClick={() => setCurrent((c) => c + 1)}>
                Next <ChevronRight size={16} aria-hidden="true" />
              </button>
            ) : (
              <button type="button" className="btn" onClick={() => setConfirming(true)}>
                <Send size={16} aria-hidden="true" /> Finish test
              </button>
            )}
          </div>
        </section>

        <aside className="card" aria-label="Question navigator">
          <h2 style={{ fontSize: '1rem', marginBottom: 12 }}>Questions</h2>
          <div className="q-nav">
            {questions.map((x, i) => (
              <button
                key={x.id}
                type="button"
                className={`q-dot${i === current ? ' current' : ''}${isAnswered(x) ? ' answered' : ''}`}
                aria-label={`Question ${i + 1}, ${isAnswered(x) ? 'answered' : 'not answered'}`}
                aria-current={i === current ? 'step' : undefined}
                onClick={() => setCurrent(i)}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <div className="legend small muted">
            <span>
              <i className="q-dot answered" /> Answered
            </span>
            <span>
              <i className="q-dot" /> Not answered
            </span>
          </div>
          <button type="button" className="btn btn-block" onClick={() => setConfirming(true)}>
            <Send size={16} aria-hidden="true" /> Submit test
          </button>
        </aside>
      </div>

      {confirming && (
        <Modal title="Submit your test?" onClose={() => !submitting && setConfirming(false)}>
          <p>
            You answered <strong>{answeredCount}</strong> of <strong>{questions.length}</strong> questions.
            {answeredCount < questions.length && ' Unanswered questions will score zero.'} You cannot reattempt this test unless an administrator re-enables it.
          </p>
          <div className="btn-row" style={{ marginTop: 18, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setConfirming(false)} disabled={submitting}>
              Keep working
            </button>
            <button type="button" className="btn" onClick={() => finish({ auto: false })} disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit now'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
