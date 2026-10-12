import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { ChevronsLeft, ChevronsRight, GraduationCap, LogOut, MoreHorizontal, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { NAV, ROLE_LABELS } from '../navConfig.js';
import NotificationBell from './NotificationBell.jsx';
import ThemeToggle from './ThemeToggle.jsx';

export function Brand({ to = '/', label = true }) {
  return (
    <Link className="brand" to={to} aria-label="IPP home">
      <span className="brand-mark">
        <GraduationCap size={20} aria-hidden="true" />
      </span>
      {label && <span className="brand-name">IPP</span>}
    </Link>
  );
}

// Click-outside + Escape handling shared by the popovers.
function useDismiss(open, close) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const down = (e) => ref.current && !ref.current.contains(e.target) && close();
    const key = (e) => e.key === 'Escape' && close();
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', down);
      document.removeEventListener('keydown', key);
    };
  }, [open, close]);
  return ref;
}

function AvatarMenu({ user, logout, initials }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  return (
    <div className="avatar-menu" ref={ref}>
      <button type="button" className="user-chip" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="avatar" aria-hidden="true">
          {initials}
        </span>
        <span className="who">
          <strong>{user.name}</strong>
          <span>{ROLE_LABELS[user.role]}</span>
        </span>
      </button>
      {open && (
        <div className="popover menu" role="menu">
          <NavLink to={`/${user.role}/profile`} role="menuitem" className="menu-item" onClick={() => setOpen(false)}>
            <User size={16} aria-hidden="true" /> Profile
          </NavLink>
          <button type="button" role="menuitem" className="menu-item" onClick={logout}>
            <LogOut size={16} aria-hidden="true" /> Log out
          </button>
        </div>
      )}
    </div>
  );
}

// Shell: floating glass sidebar (desktop, collapsible), floating glass top bar, floating pill tab bar (mobile).
export default function AppLayout() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const main = useRef(null);
  const first = useRef(true);
  const [more, setMore] = useState(false);
  const moreRef = useDismiss(more, () => setMore(false));
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('ipp-sidebar') === '1';
    } catch {
      return false;
    }
  });
  const links = NAV[user.role] || [];
  const initials = user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

  // WCAG 2.4.2 / 2.4.3: descriptive title and focus on the new content after navigation.
  useEffect(() => {
    setMore(false);
    const t = setTimeout(() => {
      const h1 = main.current?.querySelector('h1');
      document.title = h1 ? `${h1.textContent} · IPP` : 'IPP — Internship & Placement Portal';
      if (!first.current) main.current?.focus({ preventScroll: true });
      first.current = false;
    }, 350);
    return () => clearTimeout(t);
  }, [pathname]);

  const toggle = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem('ipp-sidebar', c ? '0' : '1');
      } catch {
        /* ignore */
      }
      return !c;
    });

  const tabLinks = links.length > 5 ? links.slice(0, 4) : links;
  const overflow = links.length > 5 ? links.slice(4) : [];

  return (
    <div className={`app${collapsed ? ' collapsed' : ''}`}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar" aria-label="Sidebar">
        <Brand to={links[0]?.to} label={!collapsed} />
        <nav className="side-nav" aria-label="Main">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} title={collapsed ? label : undefined}>
              <Icon size={19} strokeWidth={1.75} aria-hidden="true" />
              <span className="nav-label">{label}</span>
            </NavLink>
          ))}
        </nav>
        <button type="button" className="side-toggle" onClick={toggle} aria-pressed={collapsed} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? <ChevronsRight size={18} aria-hidden="true" /> : <ChevronsLeft size={18} aria-hidden="true" />}
          <span className="nav-label">Collapse</span>
        </button>
      </aside>

      <div className="app-main">
        <header className="topbar2">
          <div className="top-brand">
            <Brand to={links[0]?.to} />
          </div>
          <div className="topbar-right">
            <ThemeToggle />
            {user.role === 'student' && <NotificationBell />}
            <AvatarMenu user={user} logout={logout} initials={initials} />
          </div>
        </header>
        <main id="main" className="content" tabIndex={-1} ref={main}>
          <div className="page-enter" key={pathname}>
            <Outlet />
          </div>
        </main>
      </div>

      <nav className="tabbar" aria-label="Main (mobile)" ref={moreRef}>
        {tabLinks.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end}>
            <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
        {overflow.length > 0 && (
          <>
            <button type="button" className={`tab-more${more ? ' on' : ''}`} aria-expanded={more} onClick={() => setMore((m) => !m)}>
              <MoreHorizontal size={20} strokeWidth={1.75} aria-hidden="true" />
              <span>More</span>
            </button>
            {more && (
              <div className="popover sheet" role="menu">
                {overflow.map(({ to, label, icon: Icon }) => (
                  <NavLink key={to} to={to} role="menuitem" className="menu-item">
                    <Icon size={16} aria-hidden="true" /> {label}
                  </NavLink>
                ))}
              </div>
            )}
          </>
        )}
      </nav>
    </div>
  );
}
