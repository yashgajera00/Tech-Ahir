import jwt from 'jsonwebtoken';
import { findUserById } from '../models/user.model.js';

export async function authenticate(req, res, next) {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Authentication required',
    });
  }

  const token = authorization.slice('Bearer '.length).trim();

  if (!token) {
    return res.status(401).json({
      error: 'Authentication required',
    });
  }

  try {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not configured');
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await findUserById(payload.userId);

    if (!user) {
      return res.status(401).json({
        error: 'Invalid or expired authentication token',
      });
    }

    req.user = user;
    return next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Invalid or expired authentication token',
      });
    }

    if (error.message === 'JWT_SECRET is not configured') {
      console.error(error.message);
      return res.status(500).json({
        error: 'Authentication is not configured',
      });
    }

    console.error('Authentication middleware error:', error);
    return res.status(500).json({
      error: 'Internal server error',
    });
  }
}
