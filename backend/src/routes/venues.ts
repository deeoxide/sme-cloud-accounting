import { Router } from 'express';
import prisma from '../config/database';

const router = Router();

router.get('/', async (req, res) => {
  const { category, search } = req.query;

  try {
    const venues = await prisma.venue.findMany({
      where: {
        isActive: true,
        ...(category && category !== 'ALL' ? { category: category as any } : {}),
        ...(search
          ? { name: { contains: search as string, mode: 'insensitive' } }
          : {}),
      },
      include: {
        _count: { select: { queueSlots: { where: { status: 'WAITING' } } } },
      },
      take: 30,
      orderBy: { name: 'asc' },
    });

    res.json({ venues });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const venue = await prisma.venue.findUnique({
      where: { id: req.params.id },
      include: {
        tables: { orderBy: { tableNumber: 'asc' } },
        queueSlots: {
          where: { status: 'WAITING' },
          orderBy: { queueNumber: 'asc' },
          take: 5,
        },
        _count: { select: { queueSlots: { where: { status: 'WAITING' } } } },
      },
    });

    if (!venue) return res.status(404).json({ error: 'Venue not found' });
    res.json({ venue });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
