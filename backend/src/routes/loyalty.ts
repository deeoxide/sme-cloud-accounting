import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { loyaltyService } from '../services/loyaltyService';

const router = Router();

/**
 * GET /api/loyalty/account
 * Returns the current user's loyalty account, recent transactions, and next milestone.
 */
router.get('/account', authenticate, async (req: AuthRequest, res) => {
  try {
    let account = await prisma.loyaltyAccount.findUnique({
      where: { userId: req.userId },
      include: {
        transactions: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });

    if (!account) {
      account = await prisma.loyaltyAccount.create({
        data: { userId: req.userId! },
        include: { transactions: true },
      });
    }

    const nextMilestone = loyaltyService.getNextMilestone(account.successfulTrips);

    res.json({ account, nextMilestone });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/loyalty/rewards
 * Lists all active rewards from the catalog alongside available points.
 */
router.get('/rewards', authenticate, async (req: AuthRequest, res) => {
  try {
    const [account, rewards] = await Promise.all([
      prisma.loyaltyAccount.findUnique({ where: { userId: req.userId } }),
      prisma.rewardCatalog.findMany({
        where: { isActive: true },
        orderBy: { pointsCost: 'asc' },
      }),
    ]);

    res.json({ rewards, availablePoints: account?.availablePoints || 0 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/loyalty/redeem
 * Redeem points for a reward voucher.
 */
const redeemSchema = z.object({
  rewardId: z.string().uuid(),
  venueId: z.string().uuid().optional(),
});

router.post('/redeem', authenticate, async (req: AuthRequest, res) => {
  const result = redeemSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: result.error.flatten() });

  try {
    const voucher = await loyaltyService.redeemPoints(
      req.userId!,
      result.data.rewardId,
      result.data.venueId
    );
    res.status(201).json({ voucher });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/loyalty/vouchers
 * Lists all vouchers issued to the current user.
 */
router.get('/vouchers', authenticate, async (req: AuthRequest, res) => {
  try {
    const vouchers = await prisma.voucherRedemption.findMany({
      where: { userId: req.userId },
      include: { reward: true },
      orderBy: { issuedAt: 'desc' },
    });
    res.json({ vouchers });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/loyalty/vouchers/:code/use
 * Venue staff marks a voucher as used (called at point of sale).
 */
router.post('/vouchers/:code/use', authenticate, async (req: AuthRequest, res) => {
  try {
    const voucher = await prisma.voucherRedemption.findUnique({
      where: { voucherCode: req.params.code },
    });

    if (!voucher) return res.status(404).json({ error: 'Voucher not found' });
    if (voucher.status === 'USED') return res.status(400).json({ error: 'Voucher already used' });
    if (voucher.status === 'EXPIRED') return res.status(400).json({ error: 'Voucher has expired' });
    if (voucher.expiresAt < new Date()) {
      await prisma.voucherRedemption.update({
        where: { id: voucher.id },
        data: { status: 'EXPIRED' },
      });
      return res.status(400).json({ error: 'Voucher has expired' });
    }

    const updated = await prisma.voucherRedemption.update({
      where: { id: voucher.id },
      data: { status: 'USED', usedAt: new Date() },
      include: { reward: true },
    });

    res.json({ voucher: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
