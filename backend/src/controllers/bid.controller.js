import { z } from 'zod';
import { getSocket } from '../config/socket.js';
import {
  listBidHistory,
  placeBidTransaction,
} from '../models/bid.model.js';
import { findAuctionById } from '../models/auction.model.js';

export async function placeBid(req, res, next) {
  try {
    const auctionIdResult = z.string().uuid().safeParse(req.params.id);
    if (!auctionIdResult.success) {
      return res.status(400).json({ error: 'Invalid auction ID' });
    }

    const result = await placeBidTransaction({
      auctionId: req.params.id,
      bidderId: req.user.id,
      bidAmount: req.body.bid_amount,
      idempotencyKey: req.body.idempotency_key,
    });

    if (result.outcome === 'not_found') {
      return res.status(404).json({ error: 'Auction not found' });
    }

    if (result.outcome === 'seller') {
      return res.status(403).json({
        error: 'The auction seller cannot place a bid',
      });
    }

    if (result.outcome === 'scheduled') {
      return res.status(409).json({
        error: 'Auction has not started',
      });
    }

    if (result.outcome === 'ended') {
      return res.status(409).json({
        error: 'Auction has ended',
      });
    }

    if (result.outcome === 'below_minimum') {
      return res.status(400).json({
        error: 'Bid is below the minimum acceptable amount',
        minimum_bid: result.minimum,
      });
    }

    if (result.outcome === 'idempotency_conflict') {
      return res.status(409).json({
        error: 'Idempotency key was already used with a different bid amount',
        existing_amount: result.existingAmount,
      });
    }

    const auction = await findAuctionById(req.params.id);
    const bidPayload = {
      id: result.bid.id,
      amount: result.bid.amount,
      created_at: result.bid.created_at,
      bidder: {
        id: req.user.id,
        name: result.bid.bidder_name || req.user.name,
      },
    };

    const socketPayload = {
      auction_id: req.params.id,
      current_price: auction.current_price,
      end_time: auction.ends_at,
      bid_count: auction.bid_count,
      latest_bid: bidPayload,
      duplicate: result.outcome === 'duplicate',
    };

    const io = getSocket();
    if (io) {
      io.to(`auction:${req.params.id}`).emit('bid_updated', socketPayload);
    }

    return res.status(result.outcome === 'duplicate' ? 200 : 201).json({
      message:
        result.outcome === 'duplicate'
          ? 'Duplicate bid request returned'
          : 'Bid placed successfully',
      duplicate: result.outcome === 'duplicate',
      bid: bidPayload,
      auction: {
        id: auction.id,
        current_price: auction.current_price,
        end_time: auction.ends_at,
        bid_count: auction.bid_count,
        status: auction.status,
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function history(req, res, next) {
  try {
    const result = z.string().uuid().safeParse(req.params.id);

    if (!result.success) {
      return res.status(400).json({ error: 'Invalid auction ID' });
    }

    const auction = await findAuctionById(req.params.id);
    if (!auction) {
      return res.status(404).json({ error: 'Auction not found' });
    }

    const history = await listBidHistory({
      auctionId: req.params.id,
      page: req.validatedQuery.page,
      limit: req.validatedQuery.limit,
    });

    return res.status(200).json(history);
  } catch (error) {
    return next(error);
  }
}
