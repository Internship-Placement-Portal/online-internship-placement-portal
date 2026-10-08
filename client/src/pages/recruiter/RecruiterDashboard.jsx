import DashboardLayout from '../../components/DashboardLayout.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

export default function RecruiterDashboard() {
  const { user } = useAuth();
  return (
    <DashboardLayout title="Recruiter Dashboard">
      {user.approvalStatus !== 'approved' && (
        <p className="notice" role="status">
          {user.approvalStatus === 'rejected'
            ? 'Your recruiter registration was rejected by the placement office.'
            : 'Your account is awaiting approval from a placement officer. You can post listings once it is approved.'}
        </p>
      )}
      <p className="muted">Nothing here yet. Listings and applicant review arrive in later milestones.</p>
    </DashboardLayout>
  );
}
