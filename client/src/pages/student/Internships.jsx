import { useEffect, useState } from 'react';
import Select from '../../components/Select.jsx';
import { useSearchParams } from 'react-router-dom';
import { Search, SearchX, SlidersHorizontal } from 'lucide-react';
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

  const apply = (e, override) => {
    e?.preventDefault();
    const next = new URLSearchParams();
    Object.entries({ ...draft, ...override, page: '' }).forEach(([k, v]) => v && next.set(k, v));
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
      <div className="browse">
        <form className="card filter-panel" onSubmit={apply} role="search" aria-label="Search internships">
          <h2 style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <SlidersHorizontal size={17} aria-hidden="true" /> Filters
          </h2>
          <div className="field">
            <label htmlFor="q">Search</label>
            <div className="input-icon">
              <Search size={17} aria-hidden="true" />
              <input id="q" type="search" placeholder="Role, company or skill" value={draft.q} onChange={set('q')} />
            </div>
          </div>
          <div className="field">
            <span className="label" id="dom-l" style={{ margin: '0 0 0.3rem', fontSize: '0.78rem', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--muted)' }}>
              Domain
            </span>
            <div className="pill-group" role="group" aria-labelledby="dom-l">
              <button type="button" className="pill-btn" aria-pressed={!draft.domain} onClick={() => apply(null, { domain: '' })}>
                All
              </button>
              {(domains || []).map((d) => (
                <button key={d} type="button" className="pill-btn" aria-pressed={draft.domain === d} onClick={() => apply(null, { domain: d })}>
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label htmlFor="location">Location</label>
            <input id="location" placeholder="e.g. Bengaluru" value={draft.location} onChange={set('location')} />
          </div>
          <div className="field">
            <label htmlFor="minStipend">Min. stipend</label>
            <Select id="minStipend" value={draft.minStipend} onChange={set('minStipend')}>
              <option value="">Any</option>
              {[5000, 10000, 15000, 20000, 30000].map((n) => (
                <option key={n} value={n}>
                  ₹{n.toLocaleString('en-IN')}+
                </option>
              ))}
            </Select>
          </div>
          <div className="field">
            <label htmlFor="duration">Duration</label>
            <Select id="duration" value={draft.duration} onChange={set('duration')}>
              <option value="">Any</option>
              {[2, 3, 4, 6].map((n) => (
                <option key={n} value={n}>
                  Up to {n} months
                </option>
              ))}
            </Select>
          </div>
          <div className="field">
            <label htmlFor="sort">Sort by</label>
            <Select id="sort" value={draft.sort} onChange={set('sort')}>
              <option value="">{draft.q ? 'Relevance' : 'Newest'}</option>
              <option value="newest">Newest</option>
              <option value="stipend_desc">Highest stipend</option>
              <option value="deadline_asc">Closing soon</option>
            </Select>
          </div>
          <div className="btn-row">
            <button type="submit" className="btn">
              Apply filters
            </button>
            {hasFilters && (
              <button type="button" className="btn btn-ghost" onClick={() => setParams(new URLSearchParams())}>
                Clear
              </button>
            )}
          </div>
        </form>

        <div>
          {error && <Alert tone="danger">{error}</Alert>}
          {loading && !data && <Skeletons count={6} />}
          {data && (
            <>
              <p className="muted small" aria-live="polite" style={{ margin: '0.4rem 0.4rem 0.9rem' }}>
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
        </div>
      </div>
    </>
  );
}
