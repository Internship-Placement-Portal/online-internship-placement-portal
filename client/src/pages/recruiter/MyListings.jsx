import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, Pencil, Plus, Users, XCircle } from 'lucide-react';
import { closeListingApi, myListingsApi, updateListingApi } from '../../api/listings.js';
import { errorInfo } from '../../api/http.js';
import { useAuth } from '../../context/AuthContext.jsx';
import ListingCard from '../../components/ListingCard.jsx';
import { Alert, EmptyState, PageHead, Pagination, Skeletons, useAsync, useToast } from '../../components/ui.jsx';

const FILTERS = [
  ['', 'All'],
  ['draft', 'Drafts'],
  ['pending_approval', 'Pending'],
  ['approved', 'Live'],
  ['rejected', 'Rejected'],
  ['closed', 'Closed'],
];

// IPP-F-006: recruiter's own listings with edit / submit-for-approval / close actions.
export default function MyListings() {
  const { user } = useAuth();
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useAsync(() => myListingsApi({ status, page, limit: 9 }), [status, page]);
  const canPublish = user.approvalStatus === 'approved';

  async function act(fn, success) {
    try {
      await fn();
      toast(success, 'success');
      reload();
    } catch (err) {
      toast(errorInfo(err).message, 'error');
    }
  }

  return (
    <>
      <PageHead
        title="My listings"
        subtitle="Create internships and submit them for placement officer approval."
        actions={
          <Link to="/recruiter/listings/new" className={`btn${canPublish ? '' : ' btn-secondary'}`}>
            <Plus size={17} aria-hidden="true" /> New listing
          </Link>
        }
      />
      {!canPublish && (
        <div style={{ marginBottom: 16 }}>
          <Alert tone="warning">
            Your recruiter account is <strong>{user.approvalStatus}</strong>. You can browse here, but listings can only be created once a placement officer approves you.
          </Alert>
        </div>
      )}
      <div className="tabs" role="tablist" aria-label="Filter by status">
        {FILTERS.map(([value, label]) => (
          <button
            key={label}
            role="tab"
            type="button"
            className="tab"
            aria-selected={status === value}
            onClick={() => {
              setStatus(value);
              setPage(1);
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <Alert tone="danger">{error}</Alert>}
      {loading && !data && <Skeletons count={3} />}
      {data &&
        (data.items.length === 0 ? (
          <EmptyState icon={Briefcase} title="No listings here yet">
            {canPublish ? 'Create your first internship listing to start receiving applications.' : 'Listings you create will appear here.'}
          </EmptyState>
        ) : (
          <div className="cards">
            {data.items.map((l) => (
              <div key={l.id} className="stack" style={{ gap: 8 }}>
                <ListingCard listing={l} to={`/recruiter/listings/${l.id}`} showStatus />
                {l.status === 'rejected' && l.rejectionReason && <Alert tone="danger">Reason: {l.rejectionReason}</Alert>}
                <div className="btn-row">
                  {['approved', 'closed'].includes(l.status) && (
                    <Link to={`/recruiter/listings/${l.id}/applicants`} className="btn btn-sm">
                      <Users size={14} aria-hidden="true" /> Applicants
                    </Link>
                  )}
                  {l.status !== 'closed' && (
                    <Link to={`/recruiter/listings/${l.id}/edit`} className="btn btn-secondary btn-sm">
                      <Pencil size={14} aria-hidden="true" /> Edit
                    </Link>
                  )}
                  {l.status === 'draft' && (
                    <button type="button" className="btn btn-sm" onClick={() => act(() => updateListingApi(l.id, { publish: true }), 'Submitted for approval')}>
                      Submit for approval
                    </button>
                  )}
                  {(l.status === 'approved' || l.status === 'pending_approval') && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => act(() => closeListingApi(l.id), 'Listing closed')}>
                      <XCircle size={14} aria-hidden="true" /> Close
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
      {data && <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />}
    </>
  );
}
