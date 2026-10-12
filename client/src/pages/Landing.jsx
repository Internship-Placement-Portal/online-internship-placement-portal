import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, Briefcase, Check, ClipboardCheck, GraduationCap, Search, ShieldCheck, Timer, UserCheck } from 'lucide-react';
import { Brand } from '../components/AppLayout.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import { CountUp } from '../components/fx.jsx';

const ROLES = [
  [GraduationCap, 'For students', ['Discover verified internships and apply with one resume upload', 'Practise with timed aptitude tests and instant scoring', 'Track every application, interview and score in one dashboard']],
  [Briefcase, 'For recruiters', ['Post listings and reach students after quick approval', 'Review applicants, shortlist and schedule interviews', 'Students are notified automatically at every step']],
  [ShieldCheck, 'For placement officers', ['Approve recruiters and listings with a full audit trail', 'Placement analytics with charts and CSV / PDF exports', 'Manage the question bank and test re-attempts']],
];
const STEPS = [
  [Search, 'Discover', 'Search and filter openings by domain, location, stipend and duration.'],
  [ClipboardCheck, 'Apply', 'Upload a PDF resume and apply in a single step.'],
  [Timer, 'Prepare', 'Take timed aptitude tests and review every answer.'],
  [BarChart3, 'Get placed', 'Follow your status to selection while officers track outcomes.'],
];

export default function Landing() {
  return (
    <div className="landing">
      <div className="blobs" aria-hidden="true">
        <span className="blob b1" />
        <span className="blob b2" />
        <span className="blob b3" />
      </div>
      <div className="l-wrap">
        <a className="skip-link" href="#content">
          Skip to content
        </a>
        <header className="l-nav">
          <Brand to="/" />
          <div className="btn-row">
            <ThemeToggle />
            <Link to="/login" className="btn btn-ghost">
              Log in
            </Link>
            <Link to="/register" className="btn">
              Get started
            </Link>
          </div>
        </header>

        <main id="content">
          <section className="l-hero" aria-labelledby="l-h1">
            <p className="eyebrow">Internship &amp; Placement Preparation Portal</p>
            <h1 id="l-h1">Your next internship starts here</h1>
            <p className="lead">One platform for students, recruiters and placement officers: find openings, apply in seconds, prepare with timed tests and track every outcome.</p>
            <div className="l-cta">
              <Link to="/register" className="btn btn-lg">
                Create free account <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link to="/login" className="btn btn-secondary btn-lg">
                I already have an account
              </Link>
            </div>
          </section>

          <section className="card l-stats" aria-label="Platform at a glance">
            <div>
              <strong>
                <CountUp value={500} suffix="+" />
              </strong>
              <span>Internships</span>
            </div>
            <div>
              <strong>
                <CountUp value={120} suffix="+" />
              </strong>
              <span>Companies</span>
            </div>
            <div>
              <strong>
                <CountUp value={5000} suffix="+" />
              </strong>
              <span>Students</span>
            </div>
          </section>

          <section className="l-section" aria-labelledby="roles-h">
            <p className="eyebrow">Built for everyone involved</p>
            <h2 id="roles-h">One portal, three roles</h2>
            <p className="sub">Every role gets the tools it needs, with access controlled and audited end to end.</p>
            <div className="l-grid">
              {ROLES.map(([Icon, title, items]) => (
                <article key={title} className="card role-card lift">
                  <span className="stat-icon">
                    <Icon size={22} strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <h3>{title}</h3>
                  <ul>
                    {items.map((t) => (
                      <li key={t}>
                        <Check size={15} aria-hidden="true" /> {t}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>

          <section className="l-section" aria-labelledby="how-h">
            <p className="eyebrow">How it works</p>
            <h2 id="how-h">From search to selected in four steps</h2>
            <p className="sub">No spreadsheets, no lost emails.</p>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(14rem, 1fr))' }}>
              {STEPS.map(([Icon, title, text], i) => (
                <article key={title} className="card how-step lift">
                  <span className="num">{i + 1}</span>
                  <h3 style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Icon size={18} aria-hidden="true" /> {title}
                  </h3>
                  <p className="muted" style={{ marginTop: 6 }}>
                    {text}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section className="l-section" aria-labelledby="cta-h">
            <div className="dash-hero" style={{ justifyContent: 'center', textAlign: 'center' }}>
              <div className="hero-copy">
                <h2 id="cta-h" style={{ fontSize: 'clamp(1.6rem,3.4vw,2.4rem)', fontWeight: 800, letterSpacing: '-0.035em' }}>
                  Ready to land your first role?
                </h2>
                <div className="l-cta" style={{ marginTop: 18 }}>
                  <Link to="/register" className="btn btn-lg">
                    Get started <UserCheck size={18} aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </main>

        <footer className="l-footer">
          <div>
            <Brand to="/" />
            <p style={{ marginTop: 8 }}>Team 6 · PES University · Internship &amp; Placement Portal</p>
          </div>
          <nav aria-label="Footer">
            <Link to="/login">Log in</Link>
            <Link to="/register">Register</Link>
            <Link to="/forgot-password">Reset password</Link>
          </nav>
        </footer>
      </div>
    </div>
  );
}
