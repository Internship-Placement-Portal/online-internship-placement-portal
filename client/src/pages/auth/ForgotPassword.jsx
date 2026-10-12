import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { forgotPasswordApi } from '../../api/auth.js';
import { errorInfo } from '../../api/http.js';
import AuthCard, { FormError } from '../../components/AuthCard.jsx';
import { Alert } from '../../components/ui.jsx';

// IPP-F-005: request a reset link (the API answers identically whether or not the email exists).
export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await forgotPasswordApi({ email: email.trim() });
      setSent(true);
    } catch (err) {
      setError(errorInfo(err).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard title="Forgot your password?" subtitle="Enter your account email and we will send you a reset link.">
      {sent ? (
        <div style={{ marginTop: 16 }}>
          <Alert tone="success">If an account exists for {email.trim()}, a reset link is on its way. It is valid for 30 minutes.</Alert>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate>
          <label htmlFor="email">Email</label>
          <div className="input-icon">
            <Mail size={17} aria-hidden="true" />
            <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <FormError error={error} />
          <button type="submit" className="btn btn-block" disabled={busy || !email}>
            {busy ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      )}
      <p className="footer-links">
        <Link to="/login">Back to log in</Link>
      </p>
    </AuthCard>
  );
}
