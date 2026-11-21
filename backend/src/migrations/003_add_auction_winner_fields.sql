ALTER TABLE auctions
  ADD COLUMN IF NOT EXISTS winning_bid_id UUID,
  ADD COLUMN IF NOT EXISTS winning_amount NUMERIC(12,2);

ALTER TABLE auctions
  ADD CONSTRAINT auctions_winning_bid_fk
  FOREIGN KEY (winning_bid_id)
  REFERENCES bids(id)
  ON DELETE SET NULL;

ALTER TABLE auctions
  ADD CONSTRAINT auctions_winner_consistency
  CHECK (
    (
      status = 'closed'
      AND (
        (winner_user_id IS NULL AND winning_bid_id IS NULL AND winning_amount IS NULL)
        OR
        (winner_user_id IS NOT NULL AND winning_bid_id IS NOT NULL AND winning_amount IS NOT NULL)
      )
    )
    OR
    (
      status <> 'closed'
      AND winner_user_id IS NULL
      AND winning_bid_id IS NULL
      AND winning_amount IS NULL
    )
  );

CREATE INDEX IF NOT EXISTS idx_auctions_close_expired
  ON auctions(status, ends_at)
  WHERE status <> 'closed';
