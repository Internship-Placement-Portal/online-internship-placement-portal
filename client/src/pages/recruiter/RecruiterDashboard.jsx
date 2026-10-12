import { Link } from 'react-router-dom';
import { Briefcase, CheckCircle2, Clock, FilePenLine, Plus } from 'lucide-react';
import { myListingsApi } from '../../api/listings.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Alert, Spinner, useAsync } from '../../components/ui.jsx';

const Stat = ({ icon: Icon, num, label }) => (
  <div className="card stat">
    <span className="stat-icon">
      <Icon size={22} aria-hidden="true" />
    </span>
    <div>
      <div className="stat-num">{num}</div>
      <div className="stat-label">{label}</div>
    </div>
  </div>
);

export default function RecruiterDashboard() {
  const { user } = useAuth();
  const { data, loading, error } = useAsync(() => myListingsApi({ limit: 50 }), []);
  const count = (s) => data?.items.filter((l) => l.status === s).length ?? 0;

  return (
    <>
      <section className="card hero-card" aria-labelledby="welcome">
        <div>
          <h1 id="welcome">Hello, {user.name.split(' ')[0]}</h1>
          <p className="muted" style={{ marginTop: 6 }}>
            {user.profile?.companyName || 'Manage your internship openings and applicants.'}
          </p>
        </div>
        <Link to="/recruiter/listings/new" className="btn">
          <Plus size={17} aria-hidden="true" /> New listing
        </Link>
      </section>

      {user.approvalStatus !== 'approved' && (
        <div style={{ marginTop: 16 }}>
          <Alert tone="warning">
            {user.approvalStatus === 'pending'
              ? 'Your account is awaiting approval from a placement officer. You will be able to publish listings once approved.'
              : 'Your recruiter registration was not approved. Contact the placement office for details.'}
          </Alert>
        </div>
      )}

      <h2 style={{ margin: '28px 0 14px' }}>Your listings</h2>
      {error && <Alert tone="danger">{error}</Alert>}
      {loading && <Spinner />}
      {data && (
        <div className="grid grid-4">
          <Stat icon={CheckCircle2} num={count('approved')} label="Live" />
          <Stat icon={Clock} num={count('pending_approval')} label="Awaiting approval" />
          <Stat icon={FilePenLine} num={count('draft')} label="Drafts" />
          <Stat icon={Briefcase} num={data.total} label="Total" />
        </div>
      )}
    </>
  );
}
