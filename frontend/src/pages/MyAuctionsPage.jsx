import { Gavel } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getMyAuctions } from '../api/auctions';
import AuctionCard from '../components/AuctionCard';

export default function MyAuctionsPage() {
  const [auctions, setAuctions] = useState([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    getMyAuctions({ page: 1, limit: 100, status: status || undefined })
      .then((result) => setAuctions(result.auctions))
      .catch(() => setError('Unable to load your auctions'))
      .finally(() => setLoading(false));
  }, [status]);

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <p className="eyebrow">Seller workspace</p>
          <h1>My auctions</h1>
        </div>
        <button
          type="button"
          className="primary-button"
          onClick={() => window.dispatchEvent(new Event('open-create-auction'))}
        >
          + Create auction
        </button>
      </div>

      <section className="section-panel auction-list-panel">
        <div className="section-toolbar">
          <h2>Your listings</h2>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="single-filter"
          >
            <option value="">All status</option>
            <option value="active">Active</option>
            <option value="scheduled">Scheduled</option>
            <option value="ended">Ended</option>
          </select>
        </div>

        {loading && <div className="loading-state">Loading your auctions...</div>}
        {!loading && error && <div className="alert alert-error">{error}</div>}
        {!loading && !error && auctions.length === 0 && (
          <div className="empty-state">
            <Gavel size={28} />
            <h3>You have no auctions</h3>
            <p>Create your first listing to start receiving bids.</p>
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
          <div className="auction-grid">
            {auctions.map((auction) => (
              <AuctionCard auction={auction} key={auction.id} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
