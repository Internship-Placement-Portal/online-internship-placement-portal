import { Link } from 'react-router-dom';
import { ArrowRight, Briefcase, UserCheck } from 'lucide-react';
import { listPendingListingsApi, listRecruitersApi } from '../../api/admin.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Alert, Spinner, useAsync } from '../../components/ui.jsx';

export default function AdminDashboard() {
  const { user } = useAuth();
  const { data, loading, error } = useAsync(
    async () => {
      const [recruiters, listings] = await Promise.all([
        listRecruitersApi({ status: 'pending', limit: 1 }),
        listPendingListingsApi({ status: 'pending_approval', limit: 1 }),
      ]);
      return { recruiters: recruiters.total, listings: listings.total };
    },
    []
  );

  return (
    <>
      <section className="card hero-card" aria-labelledby="welcome">
        <div>
          <h1 id="welcome">Hello, {user.name.split(' ')[0]}</h1>
          <p className="muted" style={{ marginTop: 6 }}>
            Here is what needs your attention today.
          </p>
        </div>
        <Link to="/admin/approvals" className="btn">
          Open approvals <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </section>

      <h2 style={{ margin: '28px 0 14px' }}>Pending reviews</h2>
      {error && <Alert tone="danger">{error}</Alert>}
      {loading && <Spinner />}
      {data && (
        <div className="grid grid-2">
          <div className="card stat">
            <span className="stat-icon">
              <UserCheck size={22} aria-hidden="true" />
            </span>
            <div>
              <div className="stat-num">{data.recruiters}</div>
              <div className="stat-label">Recruiters awaiting approval</div>
            </div>
          </div>
          <div className="card stat">
            <span className="stat-icon">
              <Briefcase size={22} aria-hidden="true" />
            </span>
            <div>
              <div className="stat-num">{data.listings}</div>
              <div className="stat-label">Listings awaiting approval</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
