import { Link } from 'react-router-dom';
import { ArrowUpRight, CalendarClock, Clock, MapPin } from 'lucide-react';
import { daysLeft, formatStipend } from '../lib/format.js';
import { LogoTile, StatusBadge } from './ui.jsx';

// Rich listing card: company initial, title, stipend pill, duration, skill chips, deadline countdown and an Apply cue.
export default function ListingCard({ listing, to, showStatus }) {
  const skills = (listing.skills || []).slice(0, 3);
  const body = (
    <>
      <div className="company">
        <LogoTile name={listing.company} />
        <span className="grow">{listing.company}</span>
        {showStatus && <StatusBadge status={listing.status} />}
      </div>
      <div>
        <h3>{listing.title}</h3>
        <div className="meta" style={{ marginTop: 8 }}>
          <span>
            <MapPin size={15} aria-hidden="true" /> {listing.location}
          </span>
          <span>
            <Clock size={15} aria-hidden="true" /> {listing.duration} {listing.duration === 1 ? 'month' : 'months'}
          </span>
        </div>
      </div>
      <div className="skills">
        <span className="badge">{listing.domain}</span>
        {skills.map((s) => (
          <span className="chip" key={s}>
            {s}
          </span>
        ))}
      </div>
      <div className="foot">
        <span className="price-pill">{formatStipend(listing.stipend)}</span>
        <span className="countdown">
          <CalendarClock size={14} aria-hidden="true" style={{ verticalAlign: '-2px', marginRight: 4 }} />
          {daysLeft(listing.deadline)}
        </span>
        {to && (
          <span className="btn btn-sm" aria-hidden="true">
            Apply <ArrowUpRight size={14} />
          </span>
        )}
      </div>
    </>
  );
  return to ? (
    <Link to={to} className="card listing-card lift">
      {body}
    </Link>
  ) : (
    <article className="card listing-card">{body}</article>
  );
}
