import 'dotenv/config';
import app from './app.js';
import { pool } from './config/database.js';
import { createServer } from 'node:http';
import { initializeSocket } from './config/socket.js';
import { closeExpiredAuctions, processExpiredAuctionsOnStartup } from './services/auction-closing.service.js';

const port = process.env.PORT || 5000;

const httpServer = createServer(app);
const server = httpServer.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

initializeSocket(httpServer);

await processExpiredAuctionsOnStartup();

const closingInterval = setInterval(() => {
  void closeExpiredAuctions();
}, Number(process.env.AUCTION_CLOSE_INTERVAL_MS || 1000));
closingInterval.unref();

async function shutdown(signal) {
  console.log(`${signal} received. Closing server.`);
  clearInterval(closingInterval);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });

  setTimeout(() => {
    void pool.end();
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
