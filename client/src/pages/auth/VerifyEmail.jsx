import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { resendOtpApi, verifyEmailApi } from '../../api/auth.js';
import { errorInfo } from '../../api/http.js';
import AuthCard, { FormError } from '../../components/AuthCard.jsx';

export default function VerifyEmail() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  if (!state?.userId) return <Navigate to="/register" replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await verifyEmailApi({ userId: state.userId, otp });
      navigate('/login', { replace: true });
    } catch (err) {
      setError(errorInfo(err).message);
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setError('');
    setNotice('');
    try {
      await resendOtpApi({ email: state.email });
      setNotice('A new code has been sent.');
    } catch (err) {
      setError(errorInfo(err).message);
    }
  }

  return (
    <AuthCard title="Verify your email" subtitle={`Enter the 6-digit code we sent to ${state.email || 'your email'}.`}>
      <form onSubmit={onSubmit} noValidate>
        <label htmlFor="otp">Verification code</label>
        <input
          id="otp"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          pattern="\d{6}"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
          required
        />
        <FormError error={error} />
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
        <button type="submit" className="btn" disabled={busy || otp.length !== 6}>
          {busy ? 'Verifying…' : 'Verify'}
        </button>
      </form>
      <p className="muted">
        Didn't get a code?{' '}
        <button type="button" className="link-button" onClick={resend}>
          Resend
        </button>{' '}
        · <Link to="/login">Back to login</Link>
      </p>
    </AuthCard>
  );
}
