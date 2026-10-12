import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, SearchX } from 'lucide-react';
import { domainsApi, searchListingsApi } from '../../api/listings.js';
import ListingCard from '../../components/ListingCard.jsx';
import { Alert, EmptyState, PageHead, Pagination, Skeletons, useAsync } from '../../components/ui.jsx';

const FILTER_KEYS = ['q', 'domain', 'location', 'minStipend', 'duration', 'sort', 'page'];

// IPP-F-007: search + filter (domain, location, stipend, duration), paginated, URL-synced so results are shareable.
export default function Internships() {
  const [params, setParams] = useSearchParams();
  const query = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) || '']));
  const [draft, setDraft] = useState(query);
  useEffect(() => setDraft(query), [params.toString()]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: domains } = useAsync(domainsApi, []);
  const { data, loading, error } = useAsync(
    () =>
      searchListingsApi({
        q: query.q,
        domain: query.domain,
        location: query.location,
        minStipend: query.minStipend,
        maxDuration: query.duration,
        sort: query.sort,
        page: query.page || 1,
        limit: 9,
      }),
    [params.toString()]
  );

  const apply = (e) => {
    e?.preventDefault();
    const next = new URLSearchParams();
    Object.entries({ ...draft, page: '' }).forEach(([k, v]) => v && next.set(k, v));
    setParams(next);
  };
  const setPage = (p) => {
    const next = new URLSearchParams(params);
    next.set('page', p);
    setParams(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }));
  const hasFilters = FILTER_KEYS.some((k) => k !== 'page' && query[k]);

  return (
    <>
      <PageHead title="Find your internship" subtitle="Search approved openings from verified recruiters." />
      <form className="card filters" onSubmit={apply} role="search" aria-label="Search internships">
        <div className="field searchbox">
          <label htmlFor="q" className="sr-only">
            Search by title, company or skill
          </label>
          <div className="input-icon">
            <Search size={17} aria-hidden="true" />
            <input id="q" type="search" placeholder="Search by role, company or skill (e.g. React, Python)…" value={draft.q} onChange={set('q')} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="domain">Domain</label>
          <select id="domain" value={draft.domain} onChange={set('domain')}>
            <option value="">All domains</option>
            {(domains || []).map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="location">Location</label>
          <input id="location" placeholder="e.g. Bengaluru" value={draft.location} onChange={set('location')} />
        </div>
        <div className="field">
          <label htmlFor="minStipend">Min. stipend</label>
          <select id="minStipend" value={draft.minStipend} onChange={set('minStipend')}>
            <option value="">Any</option>
            {[5000, 10000, 15000, 20000, 30000].map((n) => (
              <option key={n} value={n}>
                ₹{n.toLocaleString('en-IN')}+
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="duration">Duration</label>
          <select id="duration" value={draft.duration} onChange={set('duration')}>
            <option value="">Any</option>
            {[2, 3, 4, 6].map((n) => (
              <option key={n} value={n}>
                Up to {n} months
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="sort">Sort by</label>
          <select id="sort" value={draft.sort} onChange={set('sort')}>
            <option value="">{draft.q ? 'Relevance' : 'Newest'}</option>
            <option value="newest">Newest</option>
            <option value="stipend_desc">Highest stipend</option>
            <option value="deadline_asc">Closing soon</option>
          </select>
        </div>
        <div className="btn-row">
          <button type="submit" className="btn">
            Apply
          </button>
          {hasFilters && (
            <button type="button" className="btn btn-ghost" onClick={() => setParams(new URLSearchParams())}>
              Clear
            </button>
          )}
        </div>
      </form>

      {error && <Alert tone="danger">{error}</Alert>}
      {loading && !data && <Skeletons count={6} />}
      {data && (
        <>
          <p className="muted small" aria-live="polite" style={{ marginBottom: 12 }}>
            {data.total} {data.total === 1 ? 'internship' : 'internships'} found
          </p>
          {data.items.length === 0 ? (
            <EmptyState icon={SearchX} title="No internships match your search">
              Try removing a filter or searching for a broader keyword.
            </EmptyState>
          ) : (
            <div className="cards" style={{ opacity: loading ? 0.6 : 1 }}>
              {data.items.map((l) => (
                <ListingCard key={l.id} listing={l} to={`/student/internships/${l.id}`} />
              ))}
            </div>
          )}
          <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
        </>
      )}
    </>
  );
}
