import { Router } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { antifraudCheck } from '../middleware/antifraud';
import { io } from '../app';
import { loyaltyService } from '../services/loyaltyService';
import { antifraudService } from '../services/antifraudService';

const router = Router();

const createEventSchema = z.object({
  bookingId: z.string().uuid(),
  title: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  maxAttendees: z.number().int().min(1).max(20),
});

/**
 * POST /api/events
 * Create a social event from an existing booking.
 * Returns the event object and a shareable invite link.
 */
router.post('/', authenticate, antifraudCheck, async (req: AuthRequest, res) => {
  const result = createEventSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: result.error.flatten() });

  const { bookingId, title, description, maxAttendees } = result.data;

  try {
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, userId: req.userId! },
      include: { venue: true },
    });

    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.status === 'CANCELLED') {
      return res.status(400).json({ error: 'Cannot create event for cancelled booking' });
    }

    const existing = await prisma.event.findUnique({ where: { bookingId } });
    if (existing) return res.status(409).json({ error: 'Event already exists for this booking' });

    const event = await prisma.event.create({
      data: {
        bookingId,
        hostId: req.userId!,
        title,
        description,
        maxAttendees,
        inviteToken: uuidv4(),
        status: 'ACTIVE',
      },
      include: {
        booking: { include: { venue: true, queueSlot: true } },
        host: { select: { id: true, name: true, avatarUrl: true } },
        attendees: true,
      },
    });

    const inviteLink = `${process.env.FRONTEND_URL}/invite/${event.inviteToken}`;

    res.status(201).json({ event, inviteLink });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/events/invite/:token
 * Public endpoint — returns event info from an invite link token.
 */
router.get('/invite/:token', async (req, res) => {
  try {
    const event = await prisma.event.findUnique({
      where: { inviteToken: req.params.token },
      include: {
        booking: {
          include: {
            venue: { select: { id: true, name: true, address: true, imageUrls: true } },
            queueSlot: true,
          },
        },
        host: { select: { id: true, name: true, avatarUrl: true } },
        attendees: {
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        },
      },
    });

    if (!event || event.status === 'CANCELLED') {
      return res.status(404).json({ error: 'Event not found or has been cancelled' });
    }

    res.json({ event });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/events/invite/:token/join
 * Authenticated friend joins the event via invite link.
 */
router.post('/invite/:token/join', authenticate, async (req: AuthRequest, res) => {
  try {
    const event = await prisma.event.findUnique({
      where: { inviteToken: req.params.token },
      include: { attendees: true },
    });

    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (event.status !== 'ACTIVE') return res.status(400).json({ error: 'Event is no longer active' });
    if (event.hostId === req.userId) return res.status(400).json({ error: 'Host cannot join as attendee' });

    // Anti-fraud: detect if host and attendee share a device
    const sharedDevice = await antifraudService.detectSelfInvite(event.hostId, req.userId!);
    if (sharedDevice) {
      return res.status(403).json({ error: 'Suspicious activity detected' });
    }

    const acceptedCount = event.attendees.filter((a) => a.status === 'ACCEPTED').length;
    if (acceptedCount >= event.maxAttendees) {
      return res.status(400).json({ error: 'Event is full' });
    }

    const attendee = await prisma.eventAttendee.upsert({
      where: { eventId_userId: { eventId: event.id, userId: req.userId! } },
      create: {
        eventId: event.id,
        userId: req.userId!,
        status: 'ACCEPTED',
        joinedAt: new Date(),
      },
      update: { status: 'ACCEPTED', joinedAt: new Date() },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    });

    io.to(`event:${event.id}`).emit('attendee:joined', { eventId: event.id, attendee });

    res.json({ attendee, event: { id: event.id, title: event.title } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/events/:id
 * Get full event details (host or attendee only).
 */
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const event = await prisma.event.findFirst({
      where: {
        id: req.params.id,
        OR: [
          { hostId: req.userId },
          { attendees: { some: { userId: req.userId } } },
        ],
      },
      include: {
        booking: { include: { venue: true, queueSlot: true } },
        host: { select: { id: true, name: true, avatarUrl: true } },
        attendees: {
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        },
      },
    });

    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json({ event });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/events/:id/checkin
 * Host marks check-in at the venue. Triggers loyalty evaluation.
 */
router.post('/:id/checkin', authenticate, async (req: AuthRequest, res) => {
  try {
    const event = await prisma.event.findFirst({
      where: { id: req.params.id, hostId: req.userId },
      include: { attendees: true, booking: true },
    });

    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (event.status !== 'ACTIVE') return res.status(400).json({ error: 'Event already completed or cancelled' });

    await prisma.booking.update({
      where: { id: event.bookingId },
      data: { checkInAt: new Date(), status: 'CHECKED_IN' },
    });

    io.to(`event:${event.id}`).emit('event:checkin', { eventId: event.id });

    // Evaluate loyalty async (non-blocking)
    loyaltyService.processEventCompletion(event.id).catch(console.error);

    res.json({ message: 'Checked in successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
