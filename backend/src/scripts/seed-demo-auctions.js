import 'dotenv/config';
import { pool } from '../config/database.js';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not configured.');
  process.exit(1);
}

const client = await pool.connect();

try {
  await client.query('BEGIN');

  await client.query('DELETE FROM auctions');
  await client.query('DELETE FROM bids');

  const userResult = await client.query(
    'SELECT id FROM users ORDER BY created_at ASC LIMIT 1',
  );

  if (userResult.rowCount === 0) {
    throw new Error('At least one user is required to seed demo auctions');
  }

  const sellerId = userResult.rows[0].id;

  const auctions = [
    {
      title: 'Ford Shelby White Car',
      description: 'Classic white Ford Shelby with racing stripes.',
      starting: 10000,
      increment: 500,
      image: 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&w=1200&q=80',
      startOffset: -86400,
      endOffset: 18339000,
    },
    {
      title: 'Vintage Motorcycle',
      description: 'Restored vintage motorcycle in excellent condition.',
      starting: 5200,
      increment: 250,
      image: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=1200&q=80',
      startOffset: -3600,
      endOffset: 86400,
    },
    {
      title: 'Luxury Wristwatch',
      description: 'Premium automatic wristwatch with leather strap.',
      starting: 2400,
      increment: 100,
      image: 'https://images.unsplash.com/photo-1524592094714-0f0654e20314?auto=format&fit=crop&w=1200&q=80',
      startOffset: -7200,
      endOffset: 172800,
    },
    {
      title: 'Modern Designer Camera',
      description: 'Professional mirrorless camera with premium lens.',
      starting: 1800,
      increment: 100,
      image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1200&q=80',
      startOffset: 86400,
      endOffset: 259200,
    },
    {
      title: 'Classic Wooden Guitar',
      description: 'Acoustic guitar with a warm, vintage finish.',
      starting: 950,
      increment: 50,
      image: 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?auto=format&fit=crop&w=1200&q=80',
      startOffset: 172800,
      endOffset: 345600,
    },
    {
      title: 'Limited Edition Headphones',
      description: 'High-end wireless headphones in a premium finish.',
      starting: 700,
      increment: 25,
      image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1200&q=80',
      startOffset: -172800,
      endOffset: 259200,
    },
  ];

  for (const auction of auctions) {
    const now = Date.now();
    const startsAt = new Date(now + auction.startOffset * 1000);
    const endsAt = new Date(now + auction.endOffset * 1000);
    const status =
      startsAt <= now && endsAt > now ? 'active' : 'scheduled';

    await client.query(
      `INSERT INTO auctions (
         title,
         description,
         starting_price,
         current_price,
         minimum_increment,
         image_url,
         seller_id,
         starts_at,
         ends_at,
         status,
           closed_at,
           winner_user_id,
           winning_bid_id,
           winning_amount
       )
       VALUES (
         $1, $2, $3, $3, $4, $5, $6,
           $7,
           $8,
           $9,
           $10,
           NULL,
           NULL,
           NULL
       )`,
      [
        auction.title,
        auction.description,
        auction.starting,
        auction.increment,
        auction.image,
        sellerId,
        startsAt,
        endsAt,
        status,
        null,
      ],
    );
  }

  await client.query('COMMIT');
  console.log(`Removed existing auction/bid data and seeded ${auctions.length} demo auctions.`);
} catch (error) {
  await client.query('ROLLBACK');
  console.error('Demo auction seed failed:', error.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
