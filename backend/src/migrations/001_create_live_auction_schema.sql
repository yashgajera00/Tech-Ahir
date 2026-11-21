CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auctions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(160) NOT NULL,
  description TEXT,
  starting_price NUMERIC(12,2) NOT NULL CHECK (starting_price >= 0),
  current_price NUMERIC(12,2) NOT NULL CHECK (current_price >= 0),
  minimum_increment NUMERIC(12,2) NOT NULL CHECK (minimum_increment > 0),
  seller_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  winner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'active', 'closed')),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT auctions_end_after_start CHECK (ends_at > starts_at),
  CONSTRAINT auctions_closed_state
    CHECK (
      (status = 'closed' AND closed_at IS NOT NULL)
      OR
      (status <> 'closed' AND closed_at IS NULL)
    )
);

CREATE TABLE IF NOT EXISTS bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  bidder_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  idempotency_key UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT bids_unique_idempotency
    UNIQUE (auction_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_auctions_status_ends_at
  ON auctions(status, ends_at);

CREATE INDEX IF NOT EXISTS idx_auctions_seller_created
  ON auctions(seller_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auctions_starts_at
  ON auctions(starts_at);

CREATE INDEX IF NOT EXISTS idx_bids_auction_created
  ON bids(auction_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bids_bidder_created
  ON bids(bidder_id, created_at DESC);
