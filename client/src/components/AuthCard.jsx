import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import ThemeToggle from './ThemeToggle.jsx';
import { Orb } from './fx.jsx';
import { BarChart3, FileCheck2, GraduationCap, Search, Timer } from 'lucide-react';

const POINTS = [
  [Search, 'Discover verified internships that match your skills'],
  [FileCheck2, 'Apply in one click and track every application'],
  [Timer, 'Practise with timed aptitude tests and instant scoring'],
  [BarChart3, 'See your progress and placement insights in one place'],
];

// Split layout used by every pre-login page: brand panel + form card.
export default function AuthCard({ title, subtitle, children }) {
  useEffect(() => {
    document.title = `${title} · IPP`;
  }, [title]);
  return (
    <div className="auth-shell">
      <aside className="auth-hero" aria-hidden="false">
        <Link to="/" className="brand" aria-label="IPP home">
          <span className="brand-mark">
            <GraduationCap size={20} aria-hidden="true" />
          </span>
          IPP
        </Link>
        <div>
          <Orb icon={GraduationCap} size={84} />
          <h2>Your next internship starts here.</h2>
          <p>The Internship &amp; Placement Preparation Portal connects students, recruiters and placement officers on one platform.</p>
        </div>
        <ul className="hero-points">
          {POINTS.map(([Icon, text]) => (
            <li key={text}>
              <span className="dot">
                <Icon size={17} aria-hidden="true" />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </aside>
      <main className="auth-main">
        <section className="auth-card" aria-labelledby="auth-title">
          <h1 id="auth-title">{title}</h1>
          {subtitle && <p className="muted">{subtitle}</p>}
          {children}
        </section>
        <div className="auth-theme">
          <ThemeToggle />
        </div>
      </main>
    </div>
  );
}

export function FormError({ error }) {
  return (
    <div role="alert" aria-live="assertive">
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
