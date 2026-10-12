import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { resetPasswordApi } from '../../api/auth.js';
import { errorInfo } from '../../api/http.js';
import AuthCard, { FormError } from '../../components/AuthCard.jsx';
import { Alert } from '../../components/ui.jsx';

// IPP-F-005: choose a new password using the emailed single-use token.
export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await resetPasswordApi({ token, password });
      setDone(true);
      setTimeout(() => navigate('/login', { replace: true }), 2500);
    } catch (err) {
      const info = errorInfo(err);
      setError(info.errors[0]?.message || info.message);
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <AuthCard title="Reset link missing">
        <div style={{ marginTop: 16 }}>
          <Alert tone="danger">This reset link is incomplete. Request a new one.</Alert>
        </div>
        <p className="footer-links">
          <Link to="/forgot-password">Request a new link</Link>
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Choose a new password" subtitle="You will be signed out of all other devices.">
      {done ? (
        <div style={{ marginTop: 16 }}>
          <Alert tone="success">Password updated. Redirecting you to log in…</Alert>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate>
          <label htmlFor="password">New password</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            aria-describedby="pw-help"
          />
          <p id="pw-help" className="hint">
            At least 8 characters, with a letter and a digit.
          </p>
          <label htmlFor="confirm">Confirm password</label>
          <input id="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          <FormError error={error} />
          <button type="submit" className="btn btn-block" disabled={busy || !password || !confirm}>
            {busy ? 'Saving…' : 'Update password'}
          </button>
        </form>
      )}
      <p className="footer-links">
        <Link to="/login">Back to log in</Link>
      </p>
    </AuthCard>
  );
}
