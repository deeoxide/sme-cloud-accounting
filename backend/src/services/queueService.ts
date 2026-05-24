import redis from '../config/redis';
import prisma from '../config/database';
import { io } from '../app';

export const queueService = {
  async addToQueue(
    bookingId: string,
    venueId: string
  ): Promise<{ queueNumber: number; estimatedWait: number }> {
    const venue = await prisma.venue.findUnique({ where: { id: venueId } });
    if (!venue) throw new Error('Venue not found');

    // Atomic queue number assignment via Redis INCR
    const queueKey = `queue:counter:${venueId}`;
    const queueNumber = await redis.incr(queueKey);
    // Counter resets daily — set expiry if new
    if (queueNumber === 1) await redis.expire(queueKey, 86400);

    const waitingCount = await prisma.queueSlot.count({
      where: { venueId, status: 'WAITING' },
    });
    const estimatedWait = (waitingCount + 1) * venue.avgWaitTime;

    await prisma.queueSlot.create({
      data: { venueId, bookingId, queueNumber, estimatedWait, status: 'WAITING' },
    });

    await redis.hset(`queue:venue:${venueId}`, bookingId, JSON.stringify({ queueNumber, estimatedWait }));

    io.to(`venue:${venueId}`).emit('queue:updated', {
      venueId,
      totalWaiting: waitingCount + 1,
      latestQueue: queueNumber,
    });

    return { queueNumber, estimatedWait };
  },

  async callNext(venueId: string): Promise<void> {
    const nextSlot = await prisma.queueSlot.findFirst({
      where: { venueId, status: 'WAITING' },
      orderBy: { queueNumber: 'asc' },
      include: { booking: { include: { event: true } } },
    });

    if (!nextSlot) return;

    await prisma.queueSlot.update({
      where: { id: nextSlot.id },
      data: { status: 'CALLED', notifiedAt: new Date() },
    });

    await redis.hdel(`queue:venue:${venueId}`, nextSlot.bookingId);

    const eventId = nextSlot.booking.event?.id;
    const targetRoom = eventId ? `event:${eventId}` : `booking:${nextSlot.bookingId}`;
    io.to(targetRoom).emit('queue:called', {
      queueNumber: nextSlot.queueNumber,
      message: 'Your table is ready! Please come to the host stand.',
    });

    // Auto-expire if not seated within 15 minutes
    setTimeout(async () => {
      const slot = await prisma.queueSlot.findUnique({ where: { id: nextSlot.id } });
      if (slot?.status === 'CALLED') {
        await prisma.queueSlot.update({
          where: { id: nextSlot.id },
          data: { status: 'EXPIRED' },
        });
        io.to(`venue:${venueId}`).emit('queue:expired', { queueNumber: nextSlot.queueNumber });
      }
    }, 15 * 60 * 1000);
  },

  async getStatus(venueId: string) {
    const cached = await redis.hgetall(`queue:venue:${venueId}`);
    const waitingCount = await prisma.queueSlot.count({ where: { venueId, status: 'WAITING' } });
    return { waitingCount, entries: cached };
  },
};
