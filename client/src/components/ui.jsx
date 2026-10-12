import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { errorInfo } from '../api/http.js';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Info, Loader2, XCircle } from 'lucide-react';

const ALERT_ICONS = { info: Info, success: CheckCircle2, warning: AlertTriangle, danger: XCircle };

export function Alert({ tone = 'info', children, role }) {
  const Icon = ALERT_ICONS[tone];
  return (
    <div className={`alert alert-${tone}`} role={role || (tone === 'danger' ? 'alert' : 'status')}>
      <Icon size={18} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

export function Spinner({ label = 'Loading…' }) {
  return (
    <span role="status" className="muted" style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
      <Loader2 size={18} className="spin" aria-hidden="true" /> {label}
    </span>
  );
}

export function Skeletons({ count = 6 }) {
  return (
    <div className="cards" role="status" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton" />
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="empty">
      {Icon && (
        <span className="empty-icon">
          <Icon size={24} aria-hidden="true" />
        </span>
      )}
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function PageHead({ title, subtitle, actions }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="btn-row">{actions}</div>}
    </div>
  );
}

export function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Pagination">
      <button type="button" className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        <ChevronLeft size={16} aria-hidden="true" /> Previous
      </button>
      <span className="muted small" aria-live="polite">
        Page {page} of {totalPages}
      </span>
      <button type="button" className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        Next <ChevronRight size={16} aria-hidden="true" />
      </button>
    </nav>
  );
}

// Labelled form field with inline error wiring (aria-describedby / aria-invalid).
export function Field({ id, label, error, hint, className = '', children }) {
  const describedBy = [error && `${id}-err`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined;
  return (
    <div className={`field ${className}`}>
      <label htmlFor={id}>{label}</label>
      {typeof children === 'function' ? children({ id, 'aria-invalid': !!error, 'aria-describedby': describedBy }) : children}
      {hint && (
        <p id={`${id}-hint`} className="hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-err`} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}

const TONES = {
  draft: ['neutral', 'Draft'],
  pending_approval: ['warning', 'Pending approval'],
  pending: ['warning', 'Pending'],
  approved: ['success', 'Approved'],
  rejected: ['danger', 'Rejected'],
  closed: ['neutral', 'Closed'],
  Applied: ['info', 'Applied'],
  Shortlisted: ['warning', 'Shortlisted'],
  Rejected: ['danger', 'Rejected'],
  Selected: ['success', 'Selected'],
  in_progress: ['info', 'In progress'],
  submitted: ['success', 'Submitted'],
  auto_submitted: ['warning', 'Auto-submitted'],
};
export function StatusBadge({ status }) {
  const [tone, label] = TONES[status] || ['neutral', status];
  return <span className={`badge badge-${tone}`}>{label}</span>;
}

const TILE_COLORS = [
  ['#6366f1', '#8b5cf6'],
  ['#0891b2', '#0ea5e9'],
  ['#d97706', '#f59e0b'],
  ['#be185d', '#ec4899'],
  ['#15803d', '#22c55e'],
  ['#7c3aed', '#c026d3'],
];
export function LogoTile({ name = '?', large }) {
  const code = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  const [a, b] = TILE_COLORS[code % TILE_COLORS.length];
  return (
    <span className={`logo-tile${large ? ' lg' : ''}`} style={{ '--tile-a': a, '--tile-b': b }} aria-hidden="true">
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

export function Modal({ title, onClose, children, wide }) {
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    ref.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? " modal-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

const ToastContext = createContext(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, tone = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);
  const value = useMemo(() => push, [push]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast${t.tone === 'error' ? ' toast-error' : ''}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// Tiny data-loading hook: { data, loading, error, reload }.
export function useAsync(fn, deps) {
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let active = true;
    setState((s) => ({ ...s, loading: true, error: '' }));
    fn()
      .then((data) => active && setState({ data, loading: false, error: '' }))
      .catch((err) => active && setState({ data: null, loading: false, error: errorInfo(err).message }));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { ...state, reload: () => setTick((t) => t + 1) };
}
