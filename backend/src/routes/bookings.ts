import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { antifraudCheck } from '../middleware/antifraud';
import { bookingLimiter } from '../middleware/rateLimiter';
import { queueService } from '../services/queueService';

const router = Router();

const createBookingSchema = z.object({
  venueId: z.string().uuid(),
  partySize: z.number().int().min(1).max(20),
  bookingType: z.enum(['WALK_IN_QUEUE', 'ADVANCE_RESERVATION']),
  scheduledAt: z.string().datetime().optional(),
  notes: z.string().max(200).optional(),
});

router.post('/', authenticate, bookingLimiter, antifraudCheck, async (req: AuthRequest, res) => {
  const result = createBookingSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: result.error.flatten() });

  const { venueId, partySize, bookingType, scheduledAt, notes } = result.data;

  try {
    const venue = await prisma.venue.findUnique({ where: { id: venueId, isActive: true } });
    if (!venue) return res.status(404).json({ error: 'Venue not found' });

    // Prevent double-booking at same venue
    const existing = await prisma.booking.findFirst({
      where: {
        userId: req.userId,
        venueId,
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
    });
    if (existing) {
      return res.status(409).json({ error: 'You already have an active booking at this venue' });
    }

    const booking = await prisma.booking.create({
      data: {
        userId: req.userId!,
        venueId,
        partySize,
        bookingType,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        notes,
        status: 'CONFIRMED',
      },
      include: { venue: true },
    });

    let queueInfo = null;
    if (bookingType === 'WALK_IN_QUEUE') {
      queueInfo = await queueService.addToQueue(booking.id, venueId);
    }

    res.status(201).json({ booking, queueInfo });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const booking = await prisma.booking.findFirst({
      where: { id: req.params.id, userId: req.userId },
      include: {
        venue: true,
        event: {
          include: {
            attendees: {
              include: { user: { select: { id: true, name: true, avatarUrl: true } } },
            },
          },
        },
        queueSlot: true,
      },
    });

    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    res.json({ booking });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const booking = await prisma.booking.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.status === 'CHECKED_IN') {
      return res.status(400).json({ error: 'Cannot cancel an active check-in' });
    }

    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'CANCELLED' },
    });

    if (booking.status === 'CONFIRMED') {
      await prisma.queueSlot.updateMany({
        where: { bookingId: booking.id },
        data: { status: 'CANCELLED' },
      });
    }

    res.json({ message: 'Booking cancelled' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
