import { Link } from 'react-router-dom';
import { Briefcase, CheckCircle2, Clock, FilePenLine, Plus, Rocket } from 'lucide-react';
import { myListingsApi } from '../../api/listings.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { DashHero, StatCard } from '../../components/fx.jsx';
import { Alert, Spinner, useAsync } from '../../components/ui.jsx';

export default function RecruiterDashboard() {
  const { user } = useAuth();
  const { data, loading, error } = useAsync(() => myListingsApi({ limit: 50 }), []);
  const count = (s) => data?.items.filter((l) => l.status === s).length ?? 0;

  return (
    <>
      <DashHero eyebrow={user.profile?.companyName || 'Recruiter dashboard'} greeting={`Hey ${user.name.split(' ')[0]},`} title="here's your hiring progress" orbIcon={Rocket}>
        <Link to="/recruiter/listings/new" className="btn">
          <Plus size={17} aria-hidden="true" /> New listing
        </Link>
        <Link to="/recruiter/listings" className="btn btn-secondary">
          My listings
        </Link>
      </DashHero>

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
          <StatCard icon={CheckCircle2} value={count('approved')} label="Live" to="/recruiter/listings" />
          <StatCard icon={Clock} value={count('pending_approval')} label="Awaiting approval" />
          <StatCard icon={FilePenLine} value={count('draft')} label="Drafts" />
          <StatCard icon={Briefcase} value={data.total} label="Total" />
        </div>
      )}
    </>
  );
}
