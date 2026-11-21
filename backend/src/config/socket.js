import { Server } from 'socket.io';

let io;

export function initializeSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    socket.on('join_auction', (auctionId) => {
      if (typeof auctionId === 'string') {
        socket.join(`auction:${auctionId}`);
      }
    });

    socket.on('leave_auction', (auctionId) => {
      if (typeof auctionId === 'string') {
        socket.leave(`auction:${auctionId}`);
      }
    });
  });

  return io;
}

export function getSocket() {
  return io;
}
