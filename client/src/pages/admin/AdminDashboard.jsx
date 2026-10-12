import { Link } from 'react-router-dom';
import { BarChart3, Briefcase, Percent, ScrollText, Send, ShieldCheck, UserCheck } from 'lucide-react';
import { listPendingListingsApi, listRecruitersApi } from '../../api/admin.js';
import { placementApi } from '../../api/dashboard.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { DashHero, StatCard } from '../../components/fx.jsx';
import { Alert, Spinner, useAsync } from '../../components/ui.jsx';

export default function AdminDashboard() {
  const { user } = useAuth();
  const { data, loading, error } = useAsync(async () => {
    const [recruiters, listings, placement] = await Promise.all([
      listRecruitersApi({ status: 'pending', limit: 1 }),
      listPendingListingsApi({ status: 'pending_approval', limit: 1 }),
      placementApi(),
    ]);
    return { recruiters: recruiters.total, listings: listings.total, kpis: placement.kpis, monthly: placement.monthly };
  }, []);

  return (
    <>
      <DashHero eyebrow="Placement office" greeting={`Hey ${user.name.split(' ')[0]},`} title="here's what needs your attention" orbIcon={ShieldCheck}>
        <Link to="/admin/approvals" className="btn">
          Open approvals
        </Link>
        <Link to="/admin/analytics" className="btn btn-secondary">
          <BarChart3 size={16} aria-hidden="true" /> Analytics
        </Link>
        <Link to="/admin/audit" className="btn btn-secondary">
          <ScrollText size={16} aria-hidden="true" /> Audit log
        </Link>
      </DashHero>

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
            <StatCard icon={UserCheck} value={data.recruiters} label="Recruiters awaiting approval" to="/admin/approvals" />
            <StatCard icon={Briefcase} value={data.listings} label="Listings awaiting approval" to="/admin/approvals" />
          </div>
          <h2 style={{ margin: '28px 0 14px' }}>Last 12 months at a glance</h2>
          <div className="grid grid-4">
            <StatCard icon={Percent} value={data.kpis.placementRate} suffix="%" decimals={1} label="Placement rate" to="/admin/analytics" />
            <StatCard icon={Send} value={data.kpis.applications} label="Applications" spark={data.monthly.map((m) => m.applications)} to="/admin/analytics" />
            <StatCard icon={UserCheck} value={data.kpis.selections} label="Selections" spark={data.monthly.map((m) => m.selections)} to="/admin/analytics" />
            <StatCard icon={BarChart3} value={data.kpis.avgTestAccuracy} suffix="%" decimals={1} label="Avg. test accuracy" spark={data.monthly.map((m) => m.avgAccuracy || 0)} to="/admin/analytics" />
          </div>
        </>
      )}
    </>
  );
}
