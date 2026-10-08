import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ROLE_HOME, useAuth } from '../../context/AuthContext.jsx';
import { errorInfo } from '../../api/http.js';
import AuthCard, { FormError } from '../../components/AuthCard.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const user = await login(email.trim(), password);
      const from = location.state?.from;
      // Only honour the return path if it belongs to this user's role area.
      navigate(from && from.startsWith(ROLE_HOME[user.role]) ? from : ROLE_HOME[user.role], { replace: true });
    } catch (err) {
      const info = errorInfo(err);
      if (info.code === 'EMAIL_NOT_VERIFIED') {
        navigate('/verify-email', { state: { userId: info.errors[0]?.message, email: email.trim() } });
        return;
      }
      setError(info.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard title="Log in" subtitle="Online Internship & Placement Preparation Portal">
      <form onSubmit={onSubmit} noValidate>
        <label htmlFor="email">Email</label>
        <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <FormError error={error} />
        <button type="submit" className="btn" disabled={busy || !email || !password}>
          {busy ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <p className="muted">
        New here? <Link to="/register">Create an account</Link>
      </p>
    </AuthCard>
  );
}
