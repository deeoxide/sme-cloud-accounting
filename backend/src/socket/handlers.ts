import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

export const setupSocketHandlers = (io: Server) => {
  // Authenticate every socket connection via JWT
  io.use((socket, next) => {
    const token = socket.handshake.auth.token as string | undefined;
    if (!token) return next(new Error('Authentication required'));

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
      (socket as any).userId = payload.userId;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = (socket as any).userId as string;

    // Personal room for direct notifications
    socket.join(`user:${userId}`);

    // Subscribe to real-time event updates (attendee joined, queue called)
    socket.on('event:subscribe', (eventId: string) => {
      socket.join(`event:${eventId}`);
    });

    socket.on('event:unsubscribe', (eventId: string) => {
      socket.leave(`event:${eventId}`);
    });

    // Subscribe to venue queue updates
    socket.on('venue:subscribe', (venueId: string) => {
      socket.join(`venue:${venueId}`);
    });

    socket.on('venue:unsubscribe', (venueId: string) => {
      socket.leave(`venue:${venueId}`);
    });

    socket.on('disconnect', () => {
      socket.leave(`user:${userId}`);
    });
  });
};
