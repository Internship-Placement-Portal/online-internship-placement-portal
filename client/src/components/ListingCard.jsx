import { Link } from 'react-router-dom';
import { CalendarClock, Clock, MapPin, Wallet } from 'lucide-react';
import { daysLeft, formatStipend } from '../lib/format.js';
import { LogoTile, StatusBadge } from './ui.jsx';

export default function ListingCard({ listing, to, showStatus }) {
  const body = (
    <>
      <div className="company">
        <LogoTile name={listing.company} />
        <span>{listing.company}</span>
        {showStatus && (
          <span style={{ marginLeft: 'auto' }}>
            <StatusBadge status={listing.status} />
          </span>
        )}
      </div>
      <div>
        <h3>{listing.title}</h3>
        <span className="badge" style={{ marginTop: 8 }}>
          {listing.domain}
        </span>
      </div>
      <div className="meta">
        <span>
          <MapPin size={15} aria-hidden="true" /> {listing.location}
        </span>
        <span>
          <Clock size={15} aria-hidden="true" /> {listing.duration} {listing.duration === 1 ? 'month' : 'months'}
        </span>
      </div>
      <div className="foot">
        <span className="price">
          <Wallet size={15} aria-hidden="true" style={{ verticalAlign: '-2px', marginRight: 4 }} />
          {formatStipend(listing.stipend)}
        </span>
        <span className="muted">
          <CalendarClock size={15} aria-hidden="true" style={{ verticalAlign: '-2px', marginRight: 4 }} />
          {daysLeft(listing.deadline)}
        </span>
      </div>
    </>
  );
  return to ? (
    <Link to={to} className="card listing-card">
      {body}
    </Link>
  ) : (
    <article className="card listing-card">{body}</article>
  );
}
