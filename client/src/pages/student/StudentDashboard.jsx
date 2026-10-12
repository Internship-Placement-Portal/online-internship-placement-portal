import { Link } from 'react-router-dom';
import { ArrowRight, Search } from 'lucide-react';
import { searchListingsApi } from '../../api/listings.js';
import { useAuth } from '../../context/AuthContext.jsx';
import ListingCard from '../../components/ListingCard.jsx';
import { Alert, EmptyState, Skeletons, useAsync } from '../../components/ui.jsx';

export default function StudentDashboard() {
  const { user } = useAuth();
  const { data, loading, error } = useAsync(() => searchListingsApi({ limit: 3 }), []);

  return (
    <>
      <section className="card hero-card" aria-labelledby="welcome">
        <div>
          <h1 id="welcome">Welcome back, {user.name.split(' ')[0]} 👋</h1>
          <p className="muted" style={{ marginTop: 6 }}>
            Browse fresh internships, apply with your resume and practise for placements.
          </p>
        </div>
        <Link to="/student/internships" className="btn">
          <Search size={17} aria-hidden="true" /> Find internships
        </Link>
      </section>

      <div className="card-header" style={{ marginTop: 28 }}>
        <h2>Latest internships</h2>
        <Link to="/student/internships" className="btn btn-ghost btn-sm">
          View all <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      {loading && <Skeletons count={3} />}
      {data &&
        (data.items.length === 0 ? (
          <EmptyState icon={Search} title="No openings right now">
            New internships appear here as soon as recruiters publish them.
          </EmptyState>
        ) : (
          <div className="cards">
            {data.items.map((l) => (
              <ListingCard key={l.id} listing={l} to={`/student/internships/${l.id}`} />
            ))}
          </div>
        ))}
    </>
  );
}
