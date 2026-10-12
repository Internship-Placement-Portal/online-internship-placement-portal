import { Link, useParams } from 'react-router-dom';
import { Briefcase, CalendarClock, ChevronLeft, Clock, FileSearch, Globe, GraduationCap, MapPin, Wallet } from 'lucide-react';
import { getListingApi } from '../api/listings.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Alert, EmptyState, LogoTile, Spinner, StatusBadge, useAsync } from '../components/ui.jsx';
import { daysLeft, formatDate, formatStipend } from '../lib/format.js';
import ApplyPanel from '../features/ApplyPanel.jsx';

const Fact = ({ icon: Icon, label, children }) => (
  <div className="fact">
    <Icon size={18} aria-hidden="true" />
    <dt>{label}</dt>
      <dd>{children}</dd>
  </div>
);

// IPP-F-008: full internship details (company profile, role, eligibility, stipend, duration, skills, deadline).
// Shared by students (public view) and recruiters/admins (preview of their own / any listing).
export default function ListingDetail({ backTo, backLabel }) {
  const { id } = useParams();
  const { user } = useAuth();
  const { data: listing, loading, error } = useAsync(() => getListingApi(id), [id]);

  if (loading) return <Spinner label="Loading internship…" />;
  if (error || !listing) {
    return (
      <>
        <Link to={backTo} className="breadcrumb">
          <ChevronLeft size={16} aria-hidden="true" /> {backLabel}
        </Link>
        <EmptyState icon={FileSearch} title="Internship not available">
          {error || 'This internship may have closed or been removed.'}
        </EmptyState>
      </>
    );
  }

  const profile = listing.companyProfile || {};
  return (
    <>
      <Link to={backTo} className="breadcrumb">
        <ChevronLeft size={16} aria-hidden="true" /> {backLabel}
      </Link>
      <div className="detail-hero">
        <LogoTile name={listing.company} large />
        <div>
          <h1>{listing.title}</h1>
          <p className="muted">
            {listing.company} · {listing.location}
          </p>
        </div>
        {user.role !== 'student' && (
          <span style={{ marginLeft: 'auto' }}>
            <StatusBadge status={listing.status} />
          </span>
        )}
      </div>

      {listing.status === 'rejected' && listing.rejectionReason && user.role === 'recruiter' && (
        <div style={{ marginBottom: 16 }}>
          <Alert tone="danger">Rejected by the placement officer: {listing.rejectionReason}</Alert>
        </div>
      )}

      <div className="detail-layout">
        <div className="stack">
          <section className="card" aria-labelledby="about">
            <h2 id="about">About the role</h2>
            <p className="prose" style={{ marginTop: 10 }}>
              {listing.description}
            </p>
          </section>
          <section className="card" aria-labelledby="elig">
            <h2 id="elig">Eligibility</h2>
            <p className="prose" style={{ marginTop: 10 }}>
              {listing.eligibility || 'No specific eligibility criteria were provided.'}
            </p>
          </section>
          <section className="card" aria-labelledby="skills">
            <h2 id="skills">Skills</h2>
            <div className="chips" style={{ marginTop: 10 }}>
              {listing.skills?.length ? (
                listing.skills.map((s) => (
                  <span className="chip" key={s}>
                    {s}
                  </span>
                ))
              ) : (
                <span className="muted">Not specified</span>
              )}
            </div>
          </section>
          <section className="card" aria-labelledby="company">
            <h2 id="company">About {profile.name || listing.company}</h2>
            <p className="prose" style={{ marginTop: 10 }}>
              {profile.description || 'The company has not added a profile yet.'}
            </p>
            {profile.website && (
              <p style={{ marginTop: 10 }}>
                <a href={profile.website} target="_blank" rel="noopener noreferrer">
                  <Globe size={15} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> {profile.website.replace(/^https?:\/\//, '')}
                </a>
              </p>
            )}
          </section>
        </div>

        <aside className="stack sticky" aria-label="Internship summary">
          <dl className="card facts" style={{ margin: 0 }}>
            <Fact icon={Wallet} label="Stipend">
              {formatStipend(listing.stipend)}
            </Fact>
            <Fact icon={Clock} label="Duration">
              {listing.duration} {listing.duration === 1 ? 'month' : 'months'}
            </Fact>
            <Fact icon={MapPin} label="Location">
              {listing.location}
            </Fact>
            <Fact icon={Briefcase} label="Domain">
              {listing.domain}
            </Fact>
            <Fact icon={CalendarClock} label="Apply by">
              {formatDate(listing.deadline)} <span className="muted small">· {daysLeft(listing.deadline)}</span>
            </Fact>
            <Fact icon={GraduationCap} label="Posted">
              {formatDate(listing.createdAt)}
            </Fact>
          </dl>
          {user.role === 'student' && <ApplyPanel listing={listing} />}
        </aside>
      </div>
    </>
  );
}
