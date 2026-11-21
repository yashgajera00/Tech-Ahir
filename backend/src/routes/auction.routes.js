import express from 'express';
import {
  create,
  detail,
  list,
  my,
  result,
} from '../controllers/auction.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import {
  auctionListSchema,
  createAuctionSchema,
} from '../validation/auction.validation.js';
import { z } from 'zod';
import { placeBid, history } from '../controllers/bid.controller.js';
import {
  bidHistorySchema,
  placeBidSchema,
} from '../validation/bid.validation.js';

const router = express.Router();

function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: result.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    req.validatedQuery = result.data;
    return next();
  };
}

router.post(
  '/',
  authenticate,
  validateBody(createAuctionSchema),
  create,
);

router.get('/', validateQuery(auctionListSchema), list);
router.get('/my', authenticate, validateQuery(auctionListSchema), my);

router.post(
  '/:id/bids',
  authenticate,
  validateBody(placeBidSchema),
  placeBid,
);

router.get(
  '/:id/bids',
  validateQuery(bidHistorySchema),
  history,
);

router.get('/:id/result', async (req, res, next) => {
  const validId = z.string().uuid().safeParse(req.params.id);

  if (!validId.success) {
    return res.status(400).json({ error: 'Invalid auction ID' });
  }

  return next();
}, result);

router.get('/:id', async (req, res, next) => {
  const result = z.string().uuid().safeParse(req.params.id);

  if (!result.success) {
    return res.status(400).json({
      error: 'Invalid auction ID',
    });
  }

  return next();
}, detail);

export default router;
