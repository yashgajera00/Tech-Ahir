import {
  createAuction,
  findAuctionById,
  listAuctions,
  listMyAuctions,
} from '../models/auction.model.js';

function withCalculatedStatus(auction) {
  if (!auction) return null;

  let status = auction.status;

  if (status !== 'closed') {
    if (new Date(auction.ends_at).getTime() <= Date.now()) {
      status = 'closed';
    } else if (new Date(auction.starts_at).getTime() <= Date.now()) {
      status = 'active';
    } else {
      status = 'scheduled';
    }
  }

  return {
    ...auction,
    status,
  };
}

export async function create(req, res, next) {
  try {
    const {
      title,
      description,
      image_url,
      starting_price,
      min_bid_increment,
      start_time,
      end_time,
    } = req.body;

    const auction = await createAuction({
      title,
      description,
      imageUrl: image_url,
      startingPrice: starting_price,
      minimumIncrement: min_bid_increment,
      sellerId: req.user.id,
      startsAt: start_time,
      endsAt: end_time,
    });

    return res.status(201).json({
      message: 'Auction created successfully',
      auction: withCalculatedStatus(auction),
    });
  } catch (error) {
    return next(error);
  }
}

export async function list(req, res, next) {
  try {
    const result = await listAuctions(req.validatedQuery);

    return res.status(200).json({
      ...result,
      auctions: result.auctions.map(withCalculatedStatus),
    });
  } catch (error) {
    return next(error);
  }
}

export async function detail(req, res, next) {
  try {
    const auction = await findAuctionById(req.params.id);

    if (!auction) {
      return res.status(404).json({
        error: 'Auction not found',
      });
    }

    return res.status(200).json({
      auction: withCalculatedStatus(auction),
    });
  } catch (error) {
    return next(error);
  }
}

export async function my(req, res, next) {
  try {
    const result = await listMyAuctions({
      sellerId: req.user.id,
      status: req.validatedQuery.status,
      page: req.validatedQuery.page,
      limit: req.validatedQuery.limit,
    });

    return res.status(200).json({
      ...result,
      auctions: result.auctions.map(withCalculatedStatus),
    });
  } catch (error) {
    return next(error);
  }
}

export async function result(req, res, next) {
  try {
    const auction = await findAuctionById(req.params.id);

    if (!auction) {
      return res.status(404).json({
        error: 'Auction not found',
      });
    }

    if (
      auction.status !== 'closed' ||
      new Date(auction.ends_at).getTime() > Date.now()
    ) {
      return res.status(200).json({
        auction_id: auction.id,
        status: withCalculatedStatus(auction).status,
        final_price: auction.current_price,
        winning_amount: null,
        end_time: auction.ends_at,
        winner_status: 'pending',
        winner: null,
      });
    }

    let winner = null;

    if (auction.winner_user_id) {
      const { query } = await import('../config/database.js');
      const winnerResult = await query(
        `SELECT id, name
         FROM users
         WHERE id = $1`,
        [auction.winner_user_id],
      );

      winner = winnerResult.rows[0]
        ? {
            id: winnerResult.rows[0].id,
            name: winnerResult.rows[0].name,
            bid_id: auction.winning_bid_id,
            winning_amount: auction.winning_amount,
          }
        : null;
    }

    return res.status(200).json({
      auction_id: auction.id,
      status: 'closed',
      final_price: auction.current_price,
      winning_amount: auction.winning_amount,
      end_time: auction.ends_at,
      winner_status: winner ? 'won' : 'no_winner',
      winner,
    });
  } catch (error) {
    return next(error);
  }
}
