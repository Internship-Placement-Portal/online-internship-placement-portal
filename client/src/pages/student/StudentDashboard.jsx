
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CalendarClock,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Target,
  Timer,
  Trophy,
  Video,
  RefreshCw,
  ExternalLink,
  Search,
} from 'lucide-react';

import { studentDashboardApi } from '../../api/dashboard.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { ChartCard, LineChart } from '../../components/charts.jsx';
import { DashHero, StatCard } from '../../components/fx.jsx';
import {
  Alert,
  EmptyState,
  Spinner,
  StatusBadge,
  useAsync,
} from '../../components/ui.jsx';
import { BarRow } from './TestResult.jsx';
import { formatDate, formatDateTime } from '../../lib/format.js';

// IPP-F-018: Student progress dashboard.
export default function StudentDashboard() {
  const { user } = useAuth();

  const {
    data: d,
    loading,
    error,
    reload,
  } = useAsync(studentDashboardApi, []);

  // Refresh dashboard whenever the student returns to the browser tab.
  useEffect(() => {
    const refreshOnReturn = () => {
      if (document.visibilityState === 'visible') {
        reload();
      }
    };

    document.addEventListener('visibilitychange', refreshOnReturn);

    return () => {
      document.removeEventListener('visibilitychange', refreshOnReturn);
    };
  }, [reload]);

  return (
    <>
      <DashHero
        eyebrow="Student dashboard"
        greeting={`Hey ${user.name.split(' ')[0]},`}
        title="here's your progress"
        search
        orbIcon={GraduationCap}
      >
        <button
          type="button"
          className="btn btn-secondary"
          onClick={reload}
          disabled={loading}
          aria-label="Refresh dashboard"
        >
          <RefreshCw size={17} aria-hidden="true" />
          Refresh
        </button>

        <Link to="/student/tests" className="btn btn-secondary">
          <Timer size={17} aria-hidden="true" />
          Practice tests
        </Link>
      </DashHero>

      <section className="quick-actions" aria-label="Quick actions">
        {[
          {
            to: '/student/internships',
            title: 'Browse internships',
            text: 'Explore fresh openings that match your interests.',
            icon: Search,
          },
          {
            to: '/student/applications',
            title: 'Track applications',
            text: 'Stay on top of offers, interviews and outcomes.',
            icon: ClipboardCheck,
          },
          {
            to: '/student/tests',
            title: 'Practice tests',
            text: 'Sharpen speed, accuracy and confidence before deadlines.',
            icon: Timer,
          },
        ].map(({ to, title, text, icon: Icon }) => (
          <Link key={title} to={to} className="quick-action-card lift">
            <span className="quick-action-icon" aria-hidden="true">
              <Icon size={18} />
            </span>
            <div>
              <strong>{title}</strong>
              <span>{text}</span>
            </div>
          </Link>
        ))}
      </section>

      {error && (
        <div style={{ marginTop: 16 }}>
          <Alert tone="danger">{error}</Alert>
        </div>
      )}

      {loading && (
        <div style={{ marginTop: 24 }}>
          <Spinner label="Loading your dashboard…" />
        </div>
      )}

      {d && (
        <>
          {/* Student progress statistics */}
          <div className="grid grid-4" style={{ marginTop: 20 }}>
            <StatCard
              icon={ClipboardCheck}
              value={d.applications.total}
              label="Applications submitted"
              sub={`${d.applications.byStatus.Selected} selected · ${d.applications.byStatus.Shortlisted} shortlisted`}
              to="/student/applications"
            />

            <StatCard
              icon={CalendarClock}
              value={d.interviews.scheduled}
              label="Interviews scheduled"
              sub={`${d.interviews.upcoming.length} upcoming`}
            />

            <StatCard
              icon={Timer}
              value={d.tests.attempts}
              label="Tests completed"
              sub={
                d.tests.attempts
                  ? `Best accuracy ${d.tests.bestAccuracy}%`
                  : 'None yet'
              }
              spark={d.tests.trend.map((t) => t.accuracy)}
              to="/student/tests"
            />

            <StatCard
              icon={Target}
              value={d.tests.avgAccuracy}
              suffix="%"
              decimals={1}
              label="Average test accuracy"
            />
          </div>

          {/* Upcoming interviews and recent applications */}
          <div
            className="grid grid-2"
            style={{ marginTop: 16, alignItems: 'start' }}
          >
            <section className="card" aria-labelledby="upcoming">
              <div className="card-header">
                <h2 id="upcoming">Upcoming interviews</h2>
              </div>

              {d.interviews.upcoming.length === 0 ? (
                <p className="muted">
                  No upcoming interviews. Shortlisted applications will show
                  their schedule here.
                </p>
              ) : (
                <ul className="plain-list">
                  {d.interviews.upcoming.map((i) => (
                    <li key={i.applicationId}>
                      <Link
                        to={`/student/applications/${i.applicationId}`}
                        className="row-link"
                      >
                        <span
                          className="stat-icon"
                          style={{
                            width: '2.5rem',
                            height: '2.5rem',
                            borderRadius: 14,
                          }}
                        >
                          {i.mode === 'online' ? (
                            <Video size={18} aria-hidden="true" />
                          ) : (
                            <CalendarClock size={18} aria-hidden="true" />
                          )}
                        </span>

                        <span className="grow">
                          <strong>{i.title}</strong>

                          <span
                            className="muted small"
                            style={{ display: 'block' }}
                          >
                            {i.company} · {formatDateTime(i.date)}
                          </span>
                        </span>

                        <ArrowRight size={16} aria-hidden="true" />
                      </Link>

                      <div style={{ marginLeft: '3.25rem', marginTop: 6 }}>
                        <p className="muted small">
                          Mode: {i.mode || 'Not specified'}
                        </p>

                        {i.notes && (
                          <p className="muted small">
                            Notes: {i.notes}
                          </p>
                        )}

                        {i.link && (
                          <a
                            href={i.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-ghost btn-sm"
                          >
                            Join interview
                            <ExternalLink size={14} aria-hidden="true" />
                          </a>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card" aria-labelledby="recent">
              <div className="card-header">
                <h2 id="recent">Recent applications</h2>

                <Link
                  to="/student/applications"
                  className="btn btn-ghost btn-sm"
                >
                  All
                </Link>
              </div>

              {d.applications.recent.length === 0 ? (
                <EmptyState icon={FileText} title="No applications yet">
                  <Link to="/student/internships">
                    Browse internships
                  </Link>{' '}
                  and apply with your resume.
                </EmptyState>
              ) : (
                <ul className="plain-list">
                  {d.applications.recent.map((a) => (
                    <li key={a.id}>
                      <Link
                        to={`/student/applications/${a.id}`}
                        className="row-link"
                      >
                        <span className="grow">
                          <strong>{a.title}</strong>

                          <span
                            className="muted small"
                            style={{ display: 'block' }}
                          >
                            {a.company} · {formatDate(a.appliedAt)}
                          </span>
                        </span>

                        <StatusBadge status={a.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Test performance and category strengths */}
          <div
            className="grid grid-2"
            style={{ marginTop: 16, alignItems: 'start' }}
          >
            <ChartCard
              title="Test accuracy trend"
              subtitle="Your last completed tests, oldest to newest"
              table={{
                head: ['Test', 'Date', 'Accuracy'],
                rows: d.tests.trend.map((t) => [
                  t.label,
                  formatDate(t.submittedAt),
                  `${t.accuracy}%`,
                ]),
              }}
            >
              {d.tests.trend.length === 0 ? (
                <EmptyState icon={Trophy} title="No tests taken yet">
                  <Link to="/student/tests">Take a practice test</Link> to
                  start tracking your progress.
                </EmptyState>
              ) : (
                <LineChart
                  data={d.tests.trend.map((t, i) => ({
                    label: `${t.label} (${formatDate(t.submittedAt)})`,
                    short: String(i + 1),
                    accuracy: t.accuracy,
                  }))}
                  series={[{ key: 'accuracy', name: 'Accuracy %' }]}
                  max={100}
                  unit="%"
                  summary={`Accuracy over your last ${d.tests.trend.length} tests, latest ${d.tests.trend[d.tests.trend.length - 1].accuracy} percent`}
                />
              )}
            </ChartCard>

            <section className="card" aria-labelledby="cats">
              <h2 id="cats" style={{ marginBottom: 14 }}>
                Strengths by category
              </h2>

              {d.tests.categoryAccuracy.length === 0 ? (
                <p className="muted">
                  Category performance appears after your first test.
                </p>
              ) : (
                <div className="stack" style={{ gap: 14 }}>
                  {d.tests.categoryAccuracy.map((c) => (
                    <BarRow
                      key={c.category}
                      label={c.category}
                      value={c.accuracy}
                      caption={`${c.accuracy}% · ${c.total} answers`}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </>
  );
}
