import { useState } from 'react';
import { Save } from 'lucide-react';
import { updateProfileApi } from '../api/users.js';
import { errorInfo } from '../api/http.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Alert, Field, PageHead, useToast } from '../components/ui.jsx';

// Students keep a short academic profile; recruiters keep the company profile shown on listing pages (IPP-F-008).
export default function Profile() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const p = user.profile || {};
  const [form, setForm] = useState({
    name: user.name,
    phone: p.phone || '',
    college: p.college || '',
    branch: p.branch || '',
    graduationYear: p.graduationYear || '',
    skills: (p.skills || []).join(', '),
    companyName: p.companyName || '',
    companyDescription: p.companyDescription || '',
    website: p.website || '',
  });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setErrors({});
    setBusy(true);
    const profile =
      user.role === 'recruiter'
        ? { phone: form.phone, companyName: form.companyName, companyDescription: form.companyDescription, website: form.website }
        : {
            phone: form.phone,
            college: form.college,
            branch: form.branch,
            graduationYear: form.graduationYear ? Number(form.graduationYear) : null,
            skills: form.skills.split(',').map((s) => s.trim()).filter(Boolean),
          };
    try {
      setUser(await updateProfileApi({ name: form.name, profile }));
      toast('Profile saved', 'success');
    } catch (err) {
      const info = errorInfo(err);
      setError(info.message);
      setErrors(Object.fromEntries(info.errors.map((x) => [x.field.replace('profile.', ''), x.message])));
    } finally {
      setBusy(false);
    }
  }

  const isRecruiter = user.role === 'recruiter';
  return (
    <>
      <PageHead title="Your profile" subtitle={user.email} />
      {isRecruiter && user.approvalStatus !== 'approved' && (
        <div style={{ marginBottom: 16 }}>
          <Alert tone="warning">
            Your recruiter account is <strong>{user.approvalStatus}</strong>. A placement officer must approve it before you can publish listings.
          </Alert>
        </div>
      )}
      <form className="card" onSubmit={onSubmit} noValidate style={{ maxWidth: '44rem' }}>
        <div className="form-grid">
          <Field id="name" label="Full name" error={errors.name} className="span-2">
            {(a) => <input {...a} value={form.name} onChange={set('name')} required />}
          </Field>
          <Field id="phone" label="Phone" error={errors.phone}>
            {(a) => <input {...a} type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} />}
          </Field>
          {isRecruiter ? (
            <>
              <Field id="companyName" label="Company name" error={errors.companyName}>
                {(a) => <input {...a} value={form.companyName} onChange={set('companyName')} />}
              </Field>
              <Field id="website" label="Website" error={errors.website} hint="Include https://" className="span-2">
                {(a) => <input {...a} type="url" value={form.website} onChange={set('website')} />}
              </Field>
              <Field id="companyDescription" label="About the company" error={errors.companyDescription} className="span-2" hint="Shown to students on your listings.">
                {(a) => <textarea {...a} value={form.companyDescription} onChange={set('companyDescription')} maxLength={1000} />}
              </Field>
            </>
          ) : (
            <>
              <Field id="college" label="College" error={errors.college}>
                {(a) => <input {...a} value={form.college} onChange={set('college')} />}
              </Field>
              <Field id="branch" label="Branch" error={errors.branch}>
                {(a) => <input {...a} value={form.branch} onChange={set('branch')} />}
              </Field>
              <Field id="graduationYear" label="Graduation year" error={errors.graduationYear}>
                {(a) => <input {...a} type="number" min="2000" max="2100" value={form.graduationYear} onChange={set('graduationYear')} />}
              </Field>
              <Field id="skills" label="Skills" error={errors.skills} hint="Comma separated, e.g. Python, React, SQL" className="span-2">
                {(a) => <input {...a} value={form.skills} onChange={set('skills')} />}
              </Field>
            </>
          )}
        </div>
        {error && !Object.keys(errors).length && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="btn-row" style={{ marginTop: 20 }}>
          <button type="submit" className="btn" disabled={busy}>
            <Save size={16} aria-hidden="true" /> {busy ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </>
  );
}
