import { CircleDollarSign, CalendarClock, Gavel, Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getAuctions } from '../api/auctions';
import AuctionCard from '../components/AuctionCard';

export default function DashboardPage() {
  const [auctions, setAuctions] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [summary, setSummary] = useState({
    total: 0,
    active: 0,
    scheduled: 0,
    ended: 0,
  });
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadSummary() {
      try {
        const [total, active, scheduled, ended] = await Promise.all([
          getAuctions({ page: 1, limit: 1 }),
          getAuctions({ page: 1, limit: 1, status: 'active' }),
          getAuctions({ page: 1, limit: 1, status: 'scheduled' }),
          getAuctions({ page: 1, limit: 1, status: 'ended' }),
        ]);
        setSummary({
          total: total.pagination.total,
          active: active.pagination.total,
          scheduled: scheduled.pagination.total,
          ended: ended.pagination.total,
        });
      } catch {
        setError('Unable to load auction summary');
      }
    }

    loadSummary();
  }, []);

  useEffect(() => {
    async function loadAuctions() {
      setLoading(true);
      setError('');
      try {
        const result = await getAuctions({
          page,
          limit: 9,
          status: status || undefined,
          search: search || undefined,
        });
        setAuctions(result.auctions);
        setPagination(result.pagination);
      } catch {
        setError('Unable to load auctions');
      } finally {
        setLoading(false);
      }
    }

    loadAuctions();
  }, [status, search, page]);

  const cards = [
    { label: 'Total Auctions', value: summary.total, icon: Gavel, tone: 'blue' },
    { label: 'Active Auctions', value: summary.active, icon: CircleDollarSign, tone: 'green' },
    { label: 'Scheduled Auctions', value: summary.scheduled, icon: CalendarClock, tone: 'orange' },
    { label: 'Ended Auctions', value: summary.ended, icon: Trophy, tone: 'purple' },
  ];

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <p className="eyebrow">Overview</p>
          <h1>Auction dashboard</h1>
        </div>
        <button
          type="button"
          className="primary-button"
          onClick={() => window.dispatchEvent(new Event('open-create-auction'))}
        >
          + Create auction
        </button>
      </div>

      <section className="summary-grid">
        {cards.map((card) => (
          <article className="summary-card" key={card.label}>
            <div className={`summary-icon tone-${card.tone}`}>
              <card.icon size={20} />
            </div>
            <div>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
            </div>
          </article>
        ))}
      </section>

      <section className="section-panel auction-list-panel">
        <div className="section-toolbar">
          <div className="filters">
            <input
              type="search"
              placeholder="Search auctions"
              value={search}
              onChange={(event) => {
                setPage(1);
                setSearch(event.target.value);
              }}
            />
            <select
              value={status}
              onChange={(event) => {
                setPage(1);
                setStatus(event.target.value);
              }}
            >
              <option value="">All status</option>
              <option value="active">Active</option>
              <option value="scheduled">Scheduled</option>
              <option value="ended">Ended</option>
            </select>
          </div>
        </div>

        {loading && <div className="loading-state">Loading auctions...</div>}
        {!loading && error && <div className="alert alert-error">{error}</div>}
        {!loading && !error && auctions.length === 0 && (
          <div className="empty-state">
            <Gavel size={28} />
            <h3>No auctions found</h3>
            <p>Create an auction or adjust your search filters.</p>
            <button
              type="button"
              className="primary-button"
              onClick={() => window.dispatchEvent(new Event('open-create-auction'))}
            >
              Create auction
            </button>
          </div>
        )}
        {!loading && !error && auctions.length > 0 && (
          <>
            <div className="auction-grid">
              {auctions.map((auction) => (
                <AuctionCard auction={auction} key={auction.id} />
              ))}
            </div>
            {pagination?.total_pages > 1 && (
              <div className="pagination">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={page === 1}
                  onClick={() => setPage((current) => current - 1)}
                >
                  Previous
                </button>
                <span>Page {page} of {pagination.total_pages}</span>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={page === pagination.total_pages}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
