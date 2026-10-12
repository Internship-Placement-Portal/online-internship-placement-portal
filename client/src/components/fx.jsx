import { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Search } from 'lucide-react';

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Animated number: counts up once when it scrolls into view. Falls back to the final value for reduced motion.
export function CountUp({ value, suffix = '', decimals = 0, duration = 900 }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(reduced() ? value : 0);
  useEffect(() => {
    if (reduced()) {
      setShown(value);
      return undefined;
    }
    let raf;
    const run = () => {
      const t0 = performance.now();
      const tick = (t) => {
        const p = Math.min(1, (t - t0) / duration);
        setShown(value * (1 - (1 - p) ** 3));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    const el = ref.current;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        run();
        io.disconnect();
      }
    });
    if (el) io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, duration]);
  const n = Number(shown);
  return (
    <span ref={ref}>
      {decimals ? n.toFixed(decimals) : Math.round(n).toLocaleString('en-IN')}
      {suffix}
    </span>
  );
}

// Tiny trend line with a gradient area, drawn from real series values.
export function Sparkline({ values, label }) {
  const id = useId();
  if (!values || values.length < 2) return null;
  const w = 120;
  const h = 36;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const x = (i) => (i / (values.length - 1)) * w;
  const y = (v) => h - 4 - ((v - min) / (max - min || 1)) * (h - 8);
  const line = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label || 'Trend'} preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--accent)" stopOpacity="0.35" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${w},${h} L0,${h} Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// Glowing orb with soft concentric rings (decorative).
export function Orb({ icon: Icon, size = 108 }) {
  return (
    <div className="orb-wrap" style={{ '--orb-size': `${size}px` }} aria-hidden="true">
      <span className="ring r3" />
      <span className="ring r2" />
      <span className="ring r1" />
      <span className="orb">{Icon && <Icon size={size * 0.34} strokeWidth={1.6} />}</span>
    </div>
  );
}

// Stat tile: icon, count-up number, label and optional sparkline.
export function StatCard({ icon: Icon, value, suffix, decimals, label, sub, spark, to }) {
  const body = (
    <>
      <div className="stat-top">
        <span className="stat-icon">
          <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
        </span>
        {spark && <Sparkline values={spark} label={`${label} trend`} />}
      </div>
      <div className="stat-num">
        <CountUp value={Number(value) || 0} suffix={suffix} decimals={decimals} />
      </div>
      <div className="stat-label">{label}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </>
  );
  return to ? (
    <Link className="card stat-card lift" to={to}>
      {body}
    </Link>
  ) : (
    <div className="card stat-card">{body}</div>
  );
}

// Greeting hero used at the top of every dashboard. `search` adds a pill search bar that routes to /student/internships.
export function DashHero({ eyebrow, greeting, title, children, search, orbIcon }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  return (
    <section className="dash-hero" aria-labelledby="hero-h">
      <div className="hero-copy">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <p className="hero-greeting">{greeting}</p>
        <h1 id="hero-h">{title}</h1>
        {children && <div className="btn-row" style={{ marginTop: 18 }}>{children}</div>}
        {search && (
          <form
            className="hero-search"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              navigate(`/student/internships${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`);
            }}
          >
            <Search size={18} aria-hidden="true" />
            <label htmlFor="hero-q" className="sr-only">
              Search internships
            </label>
            <input id="hero-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search roles, companies or skills…" />
            <button type="submit" className="btn btn-sm">
              Search
            </button>
          </form>
        )}
      </div>
      <Orb icon={orbIcon} />
    </section>
  );
}

// Horizontal application stepper: Applied → Shortlisted → Interview → Selected / Rejected.
export function Stepper({ status, interview }) {
  const rejected = status === 'Rejected';
  const rank = { Applied: 0, Shortlisted: 1, Selected: 3, Rejected: 3 }[status] ?? 0;
  const steps = [
    ['Applied', rank >= 0],
    ['Shortlisted', rank >= 1],
    ['Interview', Boolean(interview) || rank >= 3],
    [rejected ? 'Rejected' : 'Selected', rank >= 3],
  ];
  return (
    <ol className="stepper" aria-label="Application progress">
      {steps.map(([name, done], i) => (
        <li key={name} className={`${done ? 'done' : ''}${rejected && i === 3 ? ' bad' : ''}`} aria-current={done && !steps[i + 1]?.[1] ? 'step' : undefined}>
          <span className="dot">{done ? <Check size={12} strokeWidth={3} aria-hidden="true" /> : i + 1}</span>
          <span className="step-name">{name}</span>
        </li>
      ))}
    </ol>
  );
}

// Inline SVG illustration for empty states (theme-aware through CSS variables).
export function EmptyArt() {
  return (
    <svg className="empty-art" viewBox="0 0 160 120" aria-hidden="true">
      <ellipse cx="80" cy="104" rx="52" ry="8" fill="var(--accent)" opacity="0.12" />
      <circle cx="80" cy="54" r="40" fill="var(--accent)" opacity="0.1" />
      <circle cx="80" cy="54" r="28" fill="var(--accent)" opacity="0.14" />
      <rect x="52" y="34" width="56" height="44" rx="10" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2" />
      <path d="M62 50h36M62 60h24" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
      <circle cx="108" cy="74" r="12" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2" />
      <path d="m117 83 8 8" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
