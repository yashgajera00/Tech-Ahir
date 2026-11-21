import { query } from '../config/database.js';

export async function createAuction({
  title,
  description,
  imageUrl,
  startingPrice,
  minimumIncrement,
  sellerId,
  startsAt,
  endsAt,
}) {
  const result = await query(
    `INSERT INTO auctions (
       title,
         description,
         image_url,
         starting_price,
         current_price,
         minimum_increment,
         seller_id,
         starts_at,
         ends_at,
         status
     )
     VALUES (
       $1, $2, $3, $4, $4, $5, $6, $7, $8,
         CASE WHEN $7 <= NOW() AND $8 > NOW() THEN 'active'
              ELSE 'scheduled'
         END
     )
     RETURNING *`,
    [
      title,
      description,
      imageUrl || null,
      startingPrice,
      minimumIncrement,
      sellerId,
      startsAt,
      endsAt,
    ],
  );

  return result.rows[0];
}

export async function findAuctionById(id) {
  const result = await query(
    `SELECT
       a.*,
       json_build_object(
         'id', u.id,
         'name', u.name,
         'email', u.email
       ) AS seller,
       (SELECT COUNT(*)::int FROM bids b WHERE b.auction_id = a.id) AS bid_count
     FROM auctions a
     JOIN users u ON u.id = a.seller_id
     WHERE a.id = $1`,
    [id],
  );

  return result.rows[0] || null;
}

function buildStatusCondition(status) {
  if (status === 'scheduled') {
    return `a.status = 'scheduled' AND a.starts_at > NOW()`;
  }

  if (status === 'active') {
    return `a.status <> 'closed' AND a.starts_at <= NOW() AND a.ends_at > NOW()`;
  }

  if (status === 'ended') {
    return `(a.status = 'closed' OR a.ends_at <= NOW())`;
  }

  return null;
}

export async function listAuctions({ status, search, page, limit }) {
  const offset = (page - 1) * limit;
  const conditions = [];
  const params = [];

  const statusCondition = buildStatusCondition(status);
  if (statusCondition) {
    conditions.push(statusCondition);
  }

  if (search) {
    params.push(`%${search}%`);
    conditions.push(
      `(a.title ILIKE $${params.length} OR a.description ILIKE $${params.length})`,
    );
  }

  const where = conditions.length
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  const countResult = await query(
    `SELECT COUNT(*)::int AS total
     FROM auctions a
     ${where}`,
    params,
  );

  params.push(limit);
  const limitParam = `$${params.length}`;
  params.push(offset);
  const offsetParam = `$${params.length}`;

  const result = await query(
    `SELECT
       a.*,
       json_build_object(
         'id', u.id,
         'name', u.name,
         'email', u.email
       ) AS seller,
       (SELECT COUNT(*)::int FROM bids b WHERE b.auction_id = a.id) AS bid_count
     FROM auctions a
     JOIN users u ON u.id = a.seller_id
     ${where}
     ORDER BY a.created_at DESC
     LIMIT ${limitParam} OFFSET ${offsetParam}`,
    params,
  );

  return {
    auctions: result.rows,
    pagination: {
      page,
      limit,
      total: countResult.rows[0].total,
      total_pages: Math.ceil(countResult.rows[0].total / limit),
    },
  };
}

export async function listMyAuctions({ sellerId, status, page, limit }) {
  const offset = (page - 1) * limit;
  const conditions = ['a.seller_id = $1'];
  const params = [sellerId];

  const statusCondition = buildStatusCondition(status);
  if (statusCondition) {
    conditions.push(statusCondition);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const countResult = await query(
    `SELECT COUNT(*)::int AS total
     FROM auctions a
     ${where}`,
    params,
  );

  params.push(limit);
  const limitParam = `$${params.length}`;
  params.push(offset);
  const offsetParam = `$${params.length}`;

  const result = await query(
    `SELECT
       a.*,
       (SELECT COUNT(*)::int FROM bids b WHERE b.auction_id = a.id) AS bid_count
     FROM auctions a
     ${where}
     ORDER BY a.created_at DESC
     LIMIT ${limitParam} OFFSET ${offsetParam}`,
    params,
  );

  return {
    auctions: result.rows,
    pagination: {
      page,
      limit,
      total: countResult.rows[0].total,
      total_pages: Math.ceil(countResult.rows[0].total / limit),
    },
  };
}
