import cors from 'cors';
import express from 'express';
import { pool } from './config/database.js';
import authRoutes from './routes/auth.routes.js';
import auctionRoutes from './routes/auction.routes.js';

const app = express();

app.disable('x-powered-by');
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  }),
);
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', async (_req, res) => {
  try {
    const result = await pool.query('SELECT NOW() AS current_time');
    res.json({
      status: 'ok',
      database: 'connected',
      timestamp: result.rows[0].current_time,
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      database: 'disconnected',
      error: 'Database health check failed',
    });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/auctions', auctionRoutes);

app.use((_req, res) => {
  res.status(404).json({
    error: 'Not found',
  });
});

app.use((error, _req, res, _next) => {
  console.error(error);

  if (error.status) {
    return res.status(error.status).json({
      error: error.message,
    });
  }

  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'Invalid JSON request body',
    });
  }

  return res.status(500).json({
    error: 'Internal server error',
  });
});

export default app;
