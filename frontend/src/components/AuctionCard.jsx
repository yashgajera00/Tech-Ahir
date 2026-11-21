import { Gavel } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

export function formatDate(value) {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function formatMoney(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(value));
}

export default function AuctionCard({ auction }) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    function updateRemaining() {
      const remainingMs =
        new Date(auction.ends_at).getTime() - Date.now();
      setRemaining(Math.max(0, Math.ceil(remainingMs / 1000)));
    }

    updateRemaining();
    const interval = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(interval);
  }, [auction.ends_at]);

  const days = Math.floor(remaining / 86400);
  const hours = Math.floor((remaining % 86400) / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;
  const isEnded =
    auction.status === 'closed' ||
    auction.status === 'ended' ||
    remaining === 0;

  return (
    <Link
      className="auction-card"
      to={`/auctions/${auction.id}`}
      aria-label={`View ${auction.title} auction`}
    >
      <div className="auction-card-visual">
        {auction.image_url && (
          <img
            className="auction-card-image"
            src={auction.image_url}
            alt=""
          />
        )}
        <div className="auction-card-brand">
          <Gavel size={20} />
        </div>

        <span className={`auction-card-status status-${isEnded ? 'ended' : auction.status}`}>
          {isEnded ? 'Ended' : auction.status}
        </span>

        <div className="auction-card-countdown">
          {isEnded ? (
            <strong className="auction-ended-label">Auction ended</strong>
          ) : (
            <>
              <div>
                <strong>{String(days).padStart(2, '0')}</strong>
                <span>Days</span>
              </div>
              <div>
                <strong>{String(hours).padStart(2, '0')}</strong>
                <span>Hours</span>
              </div>
              <div>
                <strong>{String(minutes).padStart(2, '0')}</strong>
                <span>Minutes</span>
              </div>
              <div>
                <strong>{String(seconds).padStart(2, '0')}</strong>
                <span>Seconds</span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="auction-card-content">
        <h3>{auction.title}</h3>
        <p>
          Current bid:
          <strong>{formatMoney(auction.current_price)}</strong>
        </p>
      </div>
    </Link>
  );
}
