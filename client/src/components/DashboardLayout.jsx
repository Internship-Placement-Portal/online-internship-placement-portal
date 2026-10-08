import { useAuth } from '../context/AuthContext.jsx';

const LABELS = { student: 'Student', recruiter: 'Recruiter', admin: 'Placement Officer / Admin' };

export default function DashboardLayout({ title, children }) {
  const { user, logout } = useAuth();
  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <strong>IPP</strong>
        <div className="topbar-right">
          <span>
            {user.name} · {LABELS[user.role]}
          </span>
          <button type="button" className="btn btn-secondary" onClick={logout}>
            Log out
          </button>
        </div>
      </header>
      <main id="main" className="content">
        <h1>{title}</h1>
        {children}
      </main>
    </div>
  );
}
