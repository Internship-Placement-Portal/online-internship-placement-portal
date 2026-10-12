import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, Briefcase, Percent, ScrollText, Send, UserCheck } from 'lucide-react';
import { listPendingListingsApi, listRecruitersApi } from '../../api/admin.js';
import { placementApi } from '../../api/dashboard.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Alert, Spinner, useAsync } from '../../components/ui.jsx';

const Stat = ({ icon: Icon, num, label, to }) => {
  const body = (
    <>
      <span className="stat-icon">
        <Icon size={22} aria-hidden="true" />
      </span>
      <div>
        <div className="stat-num">{num}</div>
        <div className="stat-label">{label}</div>
      </div>
    </>
  );
  return to ? (
    <Link to={to} className="card stat row-link" style={{ padding: '1.4rem' }}>
      {body}
    </Link>
  ) : (
    <div className="card stat">{body}</div>
  );
};

export default function AdminDashboard() {
  const { user } = useAuth();
  const { data, loading, error } = useAsync(async () => {
    const [recruiters, listings, placement] = await Promise.all([
      listRecruitersApi({ status: 'pending', limit: 1 }),
      listPendingListingsApi({ status: 'pending_approval', limit: 1 }),
      placementApi(),
    ]);
    return { recruiters: recruiters.total, listings: listings.total, kpis: placement.kpis };
  }, []);

  return (
    <>
      <section className="card hero-card" aria-labelledby="welcome">
        <div>
          <h1 id="welcome">Hello, {user.name.split(' ')[0]}</h1>
          <p className="muted" style={{ marginTop: 6 }}>
            Here is what needs your attention today.
          </p>
        </div>
        <div className="btn-row">
          <Link to="/admin/approvals" className="btn">
            Open approvals <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link to="/admin/analytics" className="btn btn-secondary">
            <BarChart3 size={16} aria-hidden="true" /> Analytics
          </Link>
          <Link to="/admin/audit" className="btn btn-secondary">
            <ScrollText size={16} aria-hidden="true" /> Audit log
          </Link>
        </div>
      </section>

      {error && (
        <div style={{ marginTop: 16 }}>
          <Alert tone="danger">{error}</Alert>
        </div>
      )}
      {loading && (
        <div style={{ marginTop: 24 }}>
          <Spinner />
        </div>
      )}
      {data && (
        <>
          <h2 style={{ margin: '28px 0 14px' }}>Pending reviews</h2>
          <div className="grid grid-2">
            <Stat icon={UserCheck} num={data.recruiters} label="Recruiters awaiting approval" to="/admin/approvals" />
            <Stat icon={Briefcase} num={data.listings} label="Listings awaiting approval" to="/admin/approvals" />
          </div>
          <h2 style={{ margin: '28px 0 14px' }}>Last 12 months at a glance</h2>
          <div className="grid grid-4">
            <Stat icon={Percent} num={`${data.kpis.placementRate}%`} label="Placement rate" to="/admin/analytics" />
            <Stat icon={Send} num={data.kpis.applications} label="Applications" to="/admin/analytics" />
            <Stat icon={UserCheck} num={data.kpis.selections} label="Selections" to="/admin/analytics" />
            <Stat icon={BarChart3} num={`${data.kpis.avgTestAccuracy}%`} label="Avg. test accuracy" to="/admin/analytics" />
          </div>
        </>
      )}
    </>
  );
}
