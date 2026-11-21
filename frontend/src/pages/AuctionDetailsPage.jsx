import { ArrowLeft, CalendarDays, Gavel } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import {
  getAuction,
  getAuctionResult,
  getBidHistory,
  placeBid,
} from '../api/auctions';
import StatusBadge from '../components/StatusBadge';
import { formatDate, formatMoney } from '../components/AuctionCard';
import { useAuth } from '../context/AuthContext';

function createIdempotencyKey() {
  return globalThis.crypto?.randomUUID?.() ||
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
      const random = Math.random() * 16 | 0;
      const value = character === 'x' ? random : (random & 0x3) | 0x8;
      return value.toString(16);
    });
}

export default function AuctionDetailsPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [auction, setAuction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bidAmount, setBidAmount] = useState('');
  const [bidError, setBidError] = useState('');
  const [bidSuccess, setBidSuccess] = useState('');
  const [placingBid, setPlacingBid] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPagination, setHistoryPagination] = useState(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [socketConnected, setSocketConnected] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(createIdempotencyKey);
  const [idempotencyAmount, setIdempotencyAmount] = useState('');
  const [auctionResult, setAuctionResult] = useState(null);

  useEffect(() => {
    async function loadAuction() {
      try {
        const freshAuction = await getAuction(id);
        setAuction(freshAuction);
        if (
          freshAuction.status === 'closed' ||
          new Date(freshAuction.ends_at).getTime() <= Date.now()
        ) {
          const finalResult = await getAuctionResult(id);
          setAuctionResult(finalResult);
          freshAuction.status = 'closed';
        }
        setError('');
      } catch (requestError) {
        setError(requestError.response?.data?.error || 'Unable to load auction');
      } finally {
        setLoading(false);
      }
    }

    loadAuction();
  }, [id]);

  useEffect(() => {
    if (!auction) return;

    function loadHistory(page = historyPage) {
      getBidHistory(id, { page, limit: 10 })
        .then((result) => {
          setHistory(result.bids);
          setHistoryPagination(result.pagination);
        })
        .catch(() => {});
    }

    loadHistory(historyPage);

    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      setSocketConnected(true);
      socket.emit('join_auction', id);
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
    });

    socket.on('bid_updated', (payload) => {
      setAuction((current) => ({
        ...current,
        current_price: payload.current_price,
        ends_at: payload.end_time,
        bid_count: payload.bid_count,
        status:
          new Date(payload.end_time).getTime() > Date.now()
            ? current?.status === 'scheduled'
              ? 'scheduled'
              : 'active'
            : 'closed',
      }));
      loadHistory(1);
      setHistoryPage(1);
    });

    socket.on('auction_ended', (payload) => {
      setAuction((current) => ({
        ...current,
        status: 'closed',
        current_price: payload.final_price,
        ends_at: payload.end_time || current?.ends_at,
        bid_count: current?.bid_count || 0,
      }));
      setAuctionResult({
        auction_id: payload.auction_id,
        status: 'closed',
        final_price: payload.final_price,
        winning_amount: payload.winning_amount,
        end_time: payload.end_time || auction.ends_at,
        winner_status: payload.winner_status,
        winner: payload.winner,
      });
    });

    socket.io.on('reconnect', () => {
      getAuction(id).then(setAuction).catch(() => {});
      loadHistory(1);
    });

    return () => {
      socket.emit('leave_auction', id);
      socket.disconnect();
    };
  }, [id, auction?.id]);

  useEffect(() => {
    if (!auction) return;

    function updateCountdown() {
      const remaining = new Date(auction.ends_at).getTime() - Date.now();
      setRemainingSeconds(Math.max(0, Math.ceil(remaining / 1000)));

      if (remaining <= 0 && !auctionResult) {
        getAuctionResult(id)
          .then((result) => {
            setAuctionResult(result);
            setAuction((current) => ({
              ...current,
              status: result.status,
            }));
          })
          .catch(() => {});
      }
    }

    updateCountdown();
    const interval = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(interval);
  }, [auction?.ends_at, auctionResult, id]);

  useEffect(() => {
    if (!auction) return;

    const minimum = Number(auction.current_price) +
      Number(auction.minimum_increment);
    setBidAmount((current) => current || minimum.toFixed(2));
  }, [auction?.current_price, auction?.minimum_increment]);

  async function submitBid(event) {
    event.preventDefault();
    setBidError('');
    setBidSuccess('');

    const amount = Number(bidAmount);
    const minimum = Number(auction.current_price) +
      Number(auction.minimum_increment);

    if (!Number.isFinite(amount) || amount < minimum) {
      setBidError(`Enter at least ${formatMoney(minimum)}.`);
      return;
    }

    let key = idempotencyKey;
    if (idempotencyAmount !== bidAmount) {
      key = createIdempotencyKey();
      setIdempotencyKey(key);
      setIdempotencyAmount(bidAmount);
    }

    setPlacingBid(true);
    try {
      const result = await placeBid(id, {
        bid_amount: amount,
        idempotency_key: key,
      });
      setAuction((current) => ({
        ...current,
        current_price: result.auction.current_price,
        ends_at: result.auction.end_time,
        bid_count: result.auction.bid_count,
      }));
      setBidSuccess(
        result.duplicate
          ? 'Bid request was already processed.'
          : 'Bid placed successfully.',
      );
      setIdempotencyKey(createIdempotencyKey());
      setIdempotencyAmount('');
      getBidHistory(id, { page: 1, limit: 10 }).then((historyResult) => {
        setHistory(historyResult.bids);
        setHistoryPagination(historyResult.pagination);
        setHistoryPage(1);
      });
    } catch (requestError) {
      const data = requestError.response?.data;
      setBidError(
        data?.details?.map((item) => item.message).join('. ') ||
          data?.error ||
          'Unable to place bid',
      );
    } finally {
      setPlacingBid(false);
    }
  }

  function changeHistoryPage(page) {
    setHistoryPage(page);
    getBidHistory(id, { page, limit: 10 }).then((result) => {
      setHistory(result.bids);
      setHistoryPagination(result.pagination);
    });
  }

  if (loading) return <div className="page-content loading-state">Loading auction...</div>;
  if (error) return <div className="page-content"><div className="alert alert-error">{error}</div></div>;

  return (
    <div className="page-content">
      <Link className="back-link" to="/">
        <ArrowLeft size={17} />
        Back to dashboard
      </Link>

      <div className="detail-layout">
        <section className="detail-main">
          <div className="detail-heading">
            <div>
              <StatusBadge status={auction.status} />
              <h1>{auction.title}</h1>
            </div>
          </div>
          <p className="detail-description">
            {auction.description || 'No description provided.'}
          </p>

          <div className="detail-section">
            <h2>Seller</h2>
            <div className="seller-row">
              <div className="avatar">
                {auction.seller?.name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <strong>{auction.seller?.name}</strong>
                <span>{auction.seller?.email}</span>
              </div>
            </div>
          </div>

          <div className="detail-section">
            <h2>Auction schedule</h2>
            <div className="schedule-grid">
              <div>
                <CalendarDays size={18} />
                <span>Starts</span>
                <strong>{formatDate(auction.starts_at)}</strong>
              </div>
              <div>
                <CalendarDays size={18} />
                <span>Ends</span>
                <strong>{formatDate(auction.ends_at)}</strong>
              </div>
            </div>
          </div>

          <div className="detail-section bid-history-section">
            <div className="bid-history-heading">
              <h2>Bid history</h2>
              <span className={socketConnected ? 'socket-live' : 'socket-offline'}>
                {socketConnected ? 'Live' : 'Reconnecting'}
              </span>
            </div>

            {history.length === 0 ? (
              <div className="bid-history-empty">No bids placed yet.</div>
            ) : (
              <div className="bid-history-list">
                {history.map((bid) => (
                  <div className="bid-history-row" key={bid.id}>
                    <div className="bidder-avatar">
                      {bid.bidder?.name?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <strong>{bid.bidder?.name}</strong>
                      <span>{formatDate(bid.created_at)}</span>
                    </div>
                    <strong className="bid-history-amount">
                      {formatMoney(bid.amount)}
                    </strong>
                  </div>
                ))}
              </div>
            )}

            {historyPagination?.total_pages > 1 && (
              <div className="pagination bid-pagination">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={historyPage === 1}
                  onClick={() => changeHistoryPage(historyPage - 1)}
                >
                  Previous
                </button>
                <span>
                  Page {historyPage} of {historyPagination.total_pages}
                </span>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={historyPage === historyPagination.total_pages}
                  onClick={() => changeHistoryPage(historyPage + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </section>

        <aside className="detail-sidebar">
          <div className="current-price-panel">
            <span>Current price</span>
            <strong>{formatMoney(auction.current_price)}</strong>
            <small>{auction.bid_count || 0} bids placed</small>
          </div>

          <div className="countdown-panel">
            <span>Time remaining</span>
            {remainingSeconds === 0 ? (
              <strong className="ended-label">Auction Ended</strong>
            ) : (
              <strong>
                {Math.floor(remainingSeconds / 3600)}h{' '}
                {Math.floor((remainingSeconds % 3600) / 60)}m{' '}
                {remainingSeconds % 60}s
              </strong>
            )}
          </div>

          {auctionResult && (
            <div className="winner-result-panel">
              <span>Final result</span>
              {auctionResult.winner_status === 'won' && auctionResult.winner ? (
                <>
                  <strong>{auctionResult.winner.name} won</strong>
                  <small>
                    Winning bid: {formatMoney(auctionResult.winning_amount)}
                  </small>
                </>
              ) : (
                <>
                  <strong>No Winner</strong>
                  <small>No bids were placed before the auction closed.</small>
                </>
              )}
            </div>
          )}

          <dl className="detail-stats">
            <div>
              <dt>Starting price</dt>
              <dd>{formatMoney(auction.starting_price)}</dd>
            </div>
            <div>
              <dt>Minimum increment</dt>
              <dd>{formatMoney(auction.minimum_increment)}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{auction.status}</dd>
            </div>
          </dl>

          <form className="place-bid-form" onSubmit={submitBid}>
            <h2>Place a bid</h2>
            <p>
              Minimum next bid:{' '}
              {formatMoney(
                Number(auction.current_price) +
                  Number(auction.minimum_increment),
              )}
            </p>
            {bidError && <div className="alert alert-error">{bidError}</div>}
            {bidSuccess && <div className="alert alert-success">{bidSuccess}</div>}
            <label>
              Bid amount
              <input
                type="number"
                min={
                  Number(auction.current_price) +
                  Number(auction.minimum_increment)
                }
                step="0.01"
                value={bidAmount}
                onChange={(event) => setBidAmount(event.target.value)}
                disabled={
                  placingBid ||
                  auction.status !== 'active' ||
                  auction.seller?.id === user?.id ||
                  remainingSeconds === 0
                }
              />
            </label>
            <button
              type="submit"
              className="primary-button"
              disabled={
                placingBid ||
                auction.status !== 'active' ||
                auction.seller?.id === user?.id ||
                remainingSeconds === 0
              }
            >
              {placingBid ? 'Placing bid...' : 'Place bid'}
            </button>
            {auction.seller?.id === user?.id && (
              <small className="bid-disabled-note">
                Sellers cannot bid on their own auction.
              </small>
            )}
            {auction.status !== 'active' && auction.status !== 'closed' && (
              <small className="bid-disabled-note">
                This auction is not active yet.
              </small>
            )}
            {remainingSeconds === 0 && (
              <small className="bid-disabled-note">Auction ended.</small>
            )}
          </form>
        </aside>
      </div>
    </div>
  );
}
