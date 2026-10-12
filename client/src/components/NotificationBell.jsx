import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { markAllNotificationsReadApi, markNotificationReadApi, notificationsApi } from '../api/applications.js';
import { formatDateTime } from '../lib/format.js';

const POLL_MS = 30_000;

// IPP-F-012: in-app notifications. Polled every 30 s, well inside the "within 1 minute" acceptance criterion.
export default function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ items: [], unread: 0 });
  const [failed, setFailed] = useState(false);
  const box = useRef(null);

  const load = useCallback(() => {
    notificationsApi({ limit: 10 })
      .then((d) => {
        setData(d);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => box.current && !box.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function openItem(n) {
    setOpen(false);
    if (!n.read) {
      await markNotificationReadApi(n.id).catch(() => {});
      load();
    }
    if (n.link) navigate(n.link);
  }

  async function readAll() {
    await markAllNotificationsReadApi().catch(() => {});
    load();
  }

  return (
    <div className="bell" ref={box}>
      <button
        type="button"
        className="icon-btn"
        aria-label={`Notifications${data.unread ? `, ${data.unread} unread` : ''}`}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => {
          setOpen((o) => !o);
          load();
        }}
      >
        <Bell size={19} aria-hidden="true" />
        {data.unread > 0 && <span className="bell-count">{data.unread > 9 ? '9+' : data.unread}</span>}
      </button>
      {open && (
        <div className="popover" role="region" aria-label="Notifications">
          <div className="popover-head">
            <strong>Notifications</strong>
            {data.unread > 0 && (
              <button type="button" className="link-button small" onClick={readAll}>
                <CheckCheck size={14} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> Mark all read
              </button>
            )}
          </div>
          {failed && <p className="muted small" style={{ padding: 16 }}>Could not load notifications.</p>}
          {!failed && data.items.length === 0 && <p className="muted small" style={{ padding: 16 }}>You are all caught up.</p>}
          <ul className="notif-list">
            {data.items.map((n) => (
              <li key={n.id}>
                <button type="button" className={`notif${n.read ? '' : ' unread'}`} onClick={() => openItem(n)}>
                  <span>{n.message}</span>
                  <small className="muted">{formatDateTime(n.createdAt)}</small>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
