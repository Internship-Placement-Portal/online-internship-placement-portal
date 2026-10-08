import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerApi } from '../../api/auth.js';
import { errorInfo } from '../../api/http.js';
import AuthCard, { FormError } from '../../components/AuthCard.jsx';

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student' });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setBusy(true);
    try {
      const res = await registerApi({ ...form, name: form.name.trim(), email: form.email.trim() });
      navigate('/verify-email', { state: { userId: res.userId, email: form.email.trim() } });
    } catch (err) {
      const info = errorInfo(err);
      setError(info.message);
      setFieldErrors(Object.fromEntries(info.errors.map((x) => [x.field, x.message])));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard title="Create your account" subtitle="Students and recruiters can register here.">
      <form onSubmit={onSubmit} noValidate>
        <label htmlFor="name">Full name</label>
        <input id="name" autoComplete="name" value={form.name} onChange={set('name')} required aria-invalid={!!fieldErrors.name} />
        {fieldErrors.name && <p className="field-error">{fieldErrors.name}</p>}

        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={set('email')}
          required
          aria-invalid={!!fieldErrors.email}
        />
        {fieldErrors.email && <p className="field-error">{fieldErrors.email}</p>}

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          value={form.password}
          onChange={set('password')}
          required
          aria-describedby="pw-help"
          aria-invalid={!!fieldErrors.password}
        />
        <p id="pw-help" className="muted small">
          At least 8 characters, with a letter and a digit.
        </p>
        {fieldErrors.password && <p className="field-error">{fieldErrors.password}</p>}

        <label htmlFor="role">I am a</label>
        <select id="role" value={form.role} onChange={set('role')}>
          <option value="student">Student</option>
          <option value="recruiter">Recruiter / Company</option>
        </select>
        {form.role === 'recruiter' && (
          <p className="muted small">Recruiter accounts need approval from a placement officer before you can post listings.</p>
        )}

        <FormError error={error && !Object.keys(fieldErrors).length ? error : ''} />
        <button type="submit" className="btn" disabled={busy}>
          {busy ? 'Creating account…' : 'Register'}
        </button>
      </form>
      <p className="muted">
        Already registered? <Link to="/login">Log in</Link>
      </p>
    </AuthCard>
  );
}
