import { pool, query } from '../config/database.js';

export async function createBid({
  auctionId,
  bidderId,
  amount,
  idempotencyKey,
}) {
  const result = await query(
    `INSERT INTO bids (
       auction_id,
       bidder_id,
       amount,
       idempotency_key
     )
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [auctionId, bidderId, amount, idempotencyKey],
  );

  return result.rows[0];
}

export async function findBidByIdempotencyKey(auctionId, idempotencyKey) {
  const result = await query(
    `SELECT *
     FROM bids
     WHERE auction_id = $1 AND idempotency_key = $2`,
    [auctionId, idempotencyKey],
  );

  return result.rows[0] || null;
}

export async function listBidsByAuction(auctionId) {
  const result = await query(
    `SELECT
       b.id,
       b.amount,
       b.created_at,
       json_build_object(
         'id', u.id,
         'name', u.name
       ) AS bidder
     FROM bids b
     JOIN users u ON u.id = b.bidder_id
     WHERE b.auction_id = $1
     ORDER BY b.created_at DESC`,
    [auctionId],
  );

  return result.rows;
}

export async function listBidHistory({ auctionId, page, limit }) {
  const offset = (page - 1) * limit;

  const countResult = await query(
    `SELECT COUNT(*)::int AS total
     FROM bids
     WHERE auction_id = $1`,
    [auctionId],
  );

  const result = await query(
    `SELECT
       b.id,
       b.amount,
       b.created_at,
       json_build_object(
         'id', u.id,
         'name', u.name
       ) AS bidder
     FROM bids b
     JOIN users u ON u.id = b.bidder_id
     WHERE b.auction_id = $1
     ORDER BY b.created_at DESC
     LIMIT $2 OFFSET $3`,
    [auctionId, limit, offset],
  );

  return {
    bids: result.rows,
    pagination: {
      page,
      limit,
      total: countResult.rows[0].total,
      total_pages: Math.ceil(countResult.rows[0].total / limit),
    },
  };
}

export async function placeBidTransaction({
  auctionId,
  bidderId,
  bidAmount,
  idempotencyKey,
}) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const auctionResult = await client.query(
      `SELECT *
       FROM auctions
       WHERE id = $1
       FOR UPDATE`,
      [auctionId],
    );

    if (auctionResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return { outcome: 'not_found' };
    }

    const auction = auctionResult.rows[0];

    if (auction.seller_id === bidderId) {
      await client.query('ROLLBACK');
      return { outcome: 'seller' };
    }

    const now = new Date();
    const startsAt = new Date(auction.starts_at);
    const endsAt = new Date(auction.ends_at);

    if (auction.status === 'closed' || endsAt <= now) {
      await client.query('ROLLBACK');
      return { outcome: 'ended', auction };
    }

    if (auction.status === 'scheduled' || startsAt > now) {
      await client.query('ROLLBACK');
      return { outcome: 'scheduled', auction };
    }

    const existingResult = await client.query(
      `SELECT b.*
       FROM bids b
       WHERE b.auction_id = $1 AND b.idempotency_key = $2
       FOR SHARE`,
      [auctionId, idempotencyKey],
    );

    if (existingResult.rowCount > 0) {
      const existing = existingResult.rows[0];

      if (Number(existing.amount) !== Number(bidAmount)) {
        await client.query('ROLLBACK');
        return {
          outcome: 'idempotency_conflict',
          existingAmount: existing.amount,
        };
      }

      await client.query('COMMIT');
      return {
        outcome: 'duplicate',
        auction,
        bid: existing,
      };
    }

    const minimum = Number(auction.current_price) +
      Number(auction.minimum_increment);

    if (Number(bidAmount) < minimum) {
      await client.query('ROLLBACK');
      return {
        outcome: 'below_minimum',
        minimum,
        auction,
      };
    }

    let extendedEndsAt = auction.ends_at;

    if (endsAt.getTime() - now.getTime() <= 30000) {
      const extended = new Date(
        endsAt.getTime() + 30000,
      ).toISOString();
      extendedEndsAt = extended;
    }

    const bidResult = await client.query(
      `INSERT INTO bids (
         auction_id,
         bidder_id,
         amount,
         idempotency_key
       )
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [auctionId, bidderId, bidAmount, idempotencyKey],
    );

    const auctionUpdate = await client.query(
      `UPDATE auctions
       SET current_price = $1,
           ends_at = $2
       WHERE id = $3
       RETURNING *`,
      [bidAmount, extendedEndsAt, auctionId],
    );

    await client.query('COMMIT');

    const bid = bidResult.rows[0];
    const updatedAuction = auctionUpdate.rows[0];

    return {
      outcome: 'accepted',
      auction: updatedAuction,
      bid,
    };
  } catch (error) {
    await client.query('ROLLBACK');

    if (error.code === '23505') {
      const existingResult = await client.query(
        `SELECT b.*, u.name AS bidder_name
         FROM bids b
         JOIN users u ON u.id = b.bidder_id
         WHERE b.auction_id = $1 AND b.idempotency_key = $2`,
        [auctionId, idempotencyKey],
      );

      if (
        existingResult.rowCount > 0 &&
        Number(existingResult.rows[0].amount) === Number(bidAmount)
      ) {
        const auctionResult = await client.query(
          `SELECT * FROM auctions WHERE id = $1`,
          [auctionId],
        );

        return {
          outcome: 'duplicate',
          auction: auctionResult.rows[0],
          bid: existingResult.rows[0],
        };
      }

      if (existingResult.rowCount > 0) {
        return {
          outcome: 'idempotency_conflict',
          existingAmount: existingResult.rows[0].amount,
        };
      }
    }

    throw error;
  } finally {
    client.release();
  }
}
