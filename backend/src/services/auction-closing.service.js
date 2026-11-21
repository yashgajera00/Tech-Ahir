import { pool } from '../config/database.js';
import { getSocket } from '../config/socket.js';

export async function closeAuctionInTransaction(client, auctionId) {
  const auctionResult = await client.query(
    `SELECT *
     FROM auctions
     WHERE id = $1
     FOR UPDATE`,
    [auctionId],
  );

  if (auctionResult.rowCount === 0) {
    return null;
  }

  const auction = auctionResult.rows[0];

  if (auction.status === 'closed') {
    return null;
  }

  if (new Date(auction.ends_at).getTime() > Date.now()) {
    return null;
  }

  const winnerResult = await client.query(
    `SELECT
       b.id,
       b.bidder_id,
       b.amount,
       u.name AS winner_name
     FROM bids b
     JOIN users u ON u.id = b.bidder_id
     WHERE b.auction_id = $1
     ORDER BY b.amount DESC, b.created_at ASC, b.id ASC
     LIMIT 1`,
    [auctionId],
  );

  let winner = null;

  if (winnerResult.rowCount > 0) {
    const winningBid = winnerResult.rows[0];

    await client.query(
      `UPDATE auctions
       SET status = 'closed',
           closed_at = NOW(),
           winner_user_id = $1,
           winning_bid_id = $2,
           winning_amount = $3,
           current_price = $3
       WHERE id = $4`,
      [
        winningBid.bidder_id,
        winningBid.id,
        winningBid.amount,
        auctionId,
      ],
    );

    winner = winningBid;
  } else {
    await client.query(
      `UPDATE auctions
       SET status = 'closed',
           closed_at = NOW(),
           winner_user_id = NULL,
           winning_bid_id = NULL,
           winning_amount = NULL
       WHERE id = $1`,
      [auctionId],
    );
  }

  return {
    auctionId,
    endTime: auction.ends_at,
    finalPrice: winner ? winner.amount : auction.current_price,
    winnerStatus: winner ? 'won' : 'no_winner',
    winner: winner
      ? {
          id: winner.bidder_id,
          name: winner.winner_name,
          bid_id: winner.id,
          winning_amount: winner.amount,
        }
      : null,
  };
}

export async function closeExpiredAuctions() {
  const client = await pool.connect();
  const closedResults = [];

  try {
    await client.query('BEGIN');
    await client.query(
      `SELECT pg_advisory_xact_lock(hashtext($1))`,
      ['live-auction-expiration-worker'],
    );

    const expiredResult = await client.query(
      `SELECT id
       FROM auctions
       WHERE status <> 'closed'
         AND ends_at <= NOW()
       ORDER BY ends_at ASC
       LIMIT 100
       FOR UPDATE SKIP LOCKED`,
    );

    for (const row of expiredResult.rows) {
      const result = await closeAuctionInTransaction(client, row.id);
      if (result) closedResults.push(result);
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Auction closing worker failed:', error);
  } finally {
    client.release();
  }

  const io = getSocket();
  if (io) {
    for (const result of closedResults) {
      io.to(`auction:${result.auctionId}`).emit('auction_ended', {
        auction_id: result.auctionId,
        status: 'closed',
        final_price: result.finalPrice,
        end_time: result.endTime,
        winner_status: result.winnerStatus,
        winner: result.winner,
        winning_amount: result.winner?.winning_amount || null,
      });
    }
  }

  return closedResults;
}

export async function processExpiredAuctionsOnStartup() {
  let closedCount = 0;

  while (true) {
    const closed = await closeExpiredAuctions();
    closedCount += closed.length;
    if (closed.length === 0) break;
  }

  if (closedCount > 0) {
    console.log(`Closed ${closedCount} expired auction(s) during startup/recovery.`);
  }
}
