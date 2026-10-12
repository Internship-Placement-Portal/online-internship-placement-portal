import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Send } from 'lucide-react';
import { createListingApi, domainsApi, getListingApi, updateListingApi } from '../../api/listings.js';
import { errorInfo } from '../../api/http.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Alert, Field, PageHead, Spinner, useAsync, useToast } from '../../components/ui.jsx';
import { toDateInput } from '../../lib/format.js';

const EMPTY = {
  title: '',
  company: '',
  description: '',
  domain: '',
  location: '',
  stipend: '',
  duration: '',
  skills: '',
  eligibility: '',
  deadline: '',
};
const today = () => new Date().toISOString().slice(0, 10);

// IPP-F-006: create / edit a listing. "Save draft" keeps it private; "Submit for approval" sends it to the placement officer.
export default function ListingForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const { data: domains } = useAsync(domainsApi, []);
  const [form, setForm] = useState({ ...EMPTY, company: user.profile?.companyName || '' });
  const [loaded, setLoaded] = useState(!editing);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('draft');

  useEffect(() => {
    if (!editing) return;
    getListingApi(id)
      .then((l) => {
        setStatus(l.status);
        setForm({
          title: l.title,
          company: l.company,
          description: l.description,
          domain: l.domain,
          location: l.location,
          stipend: l.stipend,
          duration: l.duration,
          skills: (l.skills || []).join(', '),
          eligibility: l.eligibility || '',
          deadline: toDateInput(l.deadline),
        });
        setLoaded(true);
      })
      .catch((err) => setError(errorInfo(err).message));
  }, [id, editing]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(publish) {
    setError('');
    setErrors({});
    setBusy(true);
    const body = {
      title: form.title,
      company: form.company || undefined,
      description: form.description,
      domain: form.domain,
      location: form.location,
      stipend: form.stipend === '' ? undefined : Number(form.stipend),
      duration: form.duration === '' ? undefined : Number(form.duration),
      skills: form.skills.split(',').map((s) => s.trim()).filter(Boolean),
      eligibility: form.eligibility,
      deadline: form.deadline,
      publish,
    };
    try {
      if (editing) await updateListingApi(id, body);
      else await createListingApi(body);
      toast(publish ? 'Submitted for approval' : 'Draft saved', 'success');
      navigate('/recruiter/listings');
    } catch (err) {
      const info = errorInfo(err);
      setError(info.message);
      setErrors(Object.fromEntries(info.errors.map((x) => [x.field, x.message])));
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return error ? <Alert tone="danger">{error}</Alert> : <Spinner />;
  const willResubmit = editing && ['approved', 'pending_approval'].includes(status);

  return (
    <>
      <Link to="/recruiter/listings" className="breadcrumb">
        <ChevronLeft size={16} aria-hidden="true" /> My listings
      </Link>
      <PageHead title={editing ? 'Edit listing' : 'New internship listing'} subtitle="Students see this only after a placement officer approves it." />
      {willResubmit && (
        <div style={{ marginBottom: 16 }}>
          <Alert tone="warning">Saving changes sends this listing back for approval and hides it from students until it is re-approved.</Alert>
        </div>
      )}
      <form
        className="card"
        style={{ maxWidth: '48rem' }}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit(true);
        }}
      >
        <div className="form-grid">
          <Field id="title" label="Role title" error={errors.title} className="span-2">
            {(a) => <input {...a} value={form.title} onChange={set('title')} required maxLength={120} placeholder="e.g. Backend Engineering Intern" />}
          </Field>
          <Field id="company" label="Company" error={errors.company} hint="Defaults to your company profile name.">
            {(a) => <input {...a} value={form.company} onChange={set('company')} maxLength={120} />}
          </Field>
          <Field id="domain" label="Domain" error={errors.domain}>
            {(a) => (
              <select {...a} value={form.domain} onChange={set('domain')} required>
                <option value="">Select a domain</option>
                {(domains || []).map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            )}
          </Field>
          <Field id="location" label="Location" error={errors.location}>
            {(a) => <input {...a} value={form.location} onChange={set('location')} required placeholder="City or Remote" />}
          </Field>
          <Field id="deadline" label="Application deadline" error={errors.deadline}>
            {(a) => <input {...a} type="date" min={today()} value={form.deadline} onChange={set('deadline')} required />}
          </Field>
          <Field id="stipend" label="Stipend (₹ per month)" error={errors.stipend} hint="Enter 0 for unpaid.">
            {(a) => <input {...a} type="number" min="0" step="500" value={form.stipend} onChange={set('stipend')} required />}
          </Field>
          <Field id="duration" label="Duration (months)" error={errors.duration}>
            {(a) => <input {...a} type="number" min="1" max="24" value={form.duration} onChange={set('duration')} required />}
          </Field>
          <Field id="skills" label="Skills" error={errors.skills} hint="Comma separated, e.g. React, Node.js, SQL" className="span-2">
            {(a) => <input {...a} value={form.skills} onChange={set('skills')} />}
          </Field>
          <Field id="description" label="Description" error={errors.description} className="span-2" hint="At least 20 characters.">
            {(a) => <textarea {...a} value={form.description} onChange={set('description')} required maxLength={5000} />}
          </Field>
          <Field id="eligibility" label="Eligibility" error={errors.eligibility} className="span-2">
            {(a) => <textarea {...a} value={form.eligibility} onChange={set('eligibility')} maxLength={1000} style={{ minHeight: '5rem' }} placeholder="Year, branch, CGPA cut-off…" />}
          </Field>
        </div>
        {error && !Object.keys(errors).length && (
          <div style={{ marginTop: 16 }}>
            <Alert tone="danger">{error}</Alert>
          </div>
        )}
        <div className="btn-row" style={{ marginTop: 22 }}>
          <button type="submit" className="btn" disabled={busy || user.approvalStatus !== 'approved'}>
            <Send size={16} aria-hidden="true" /> {busy ? 'Saving…' : 'Submit for approval'}
          </button>
          {(!editing || status === 'draft' || status === 'rejected') && (
            <button type="button" className="btn btn-secondary" disabled={busy || user.approvalStatus !== 'approved'} onClick={() => submit(false)}>
              Save as draft
            </button>
          )}
        </div>
      </form>
    </>
  );
}
