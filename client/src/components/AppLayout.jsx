import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { GraduationCap, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { NAV, ROLE_LABELS } from '../navConfig.js';
import NotificationBell from './NotificationBell.jsx';

export function Brand({ to = '/' }) {
  return (
    <Link className="brand" to={to} aria-label="IPP home">
      <span className="brand-mark">
        <GraduationCap size={20} aria-hidden="true" />
      </span>
      IPP
    </Link>
  );
}

// Shared chrome for every signed-in page: sticky top bar, role-based navigation, skip link.
export default function AppLayout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const links = NAV[user.role] || [];
  const initials = user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <Brand to={links[0]?.to} />
        <nav className={`nav${open ? ' open' : ''}`} aria-label="Main">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)}>
              <Icon size={17} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="topbar-right">
          {user.role === 'student' && <NotificationBell />}
          <NavLink to={`/${user.role}/profile`} className="user-chip" aria-label="Your profile">
            <span className="avatar" aria-hidden="true">
              {initials}
            </span>
            <span className="who">
              <strong>{user.name}</strong>
              <span>{ROLE_LABELS[user.role]}</span>
            </span>
          </NavLink>
          <button type="button" className="icon-btn" onClick={logout} aria-label="Log out" title="Log out">
            <LogOut size={19} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="icon-btn menu-toggle"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
          </button>
        </div>
      </header>
      <main id="main" className="content">
        <Outlet />
      </main>
    </div>
  );
}
