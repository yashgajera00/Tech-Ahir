CREATE INDEX IF NOT EXISTS idx_bids_auction_created_bidder
  ON bids(auction_id, created_at DESC, bidder_id);
