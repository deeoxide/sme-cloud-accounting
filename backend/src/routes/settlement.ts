import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

const batchSchema = z.object({
  venueId: z.string().uuid(),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
});

/**
 * POST /api/settlement/batch
 * Generate a settlement batch for a venue's used vouchers in a period.
 *
 * Flow:
 * 1. Collect all USED vouchers not yet settled for the venue + period
 * 2. Compute: totalDiscount, platformFee (15% default), venuePayable
 * 3. Create SettlementBatch + link vouchers to it
 * 4. Venue receives invoice for venuePayable
 */
router.post('/batch', authenticate, async (req: AuthRequest, res) => {
  const result = batchSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: result.error.flatten() });

  const { venueId, periodStart, periodEnd } = result.data;

  try {
    const redemptions = await prisma.voucherRedemption.findMany({
      where: {
        venueId,
        status: 'USED',
        usedAt: { gte: new Date(periodStart), lte: new Date(periodEnd) },
        settlementBatchId: null,
      },
    });

    if (redemptions.length === 0) {
      return res.json({ message: 'No redemptions to settle in this period' });
    }

    const campaign = await prisma.partnerCampaign.findFirst({
      where: { venueId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    const platformFeeRate = campaign?.platformFeeRate.toNumber() ?? 0.15;
    const totalDiscount = redemptions.reduce((sum, r) => sum + r.discountValue.toNumber(), 0);
    const platformFee = parseFloat((totalDiscount * platformFeeRate).toFixed(2));
    const venuePayable = parseFloat((totalDiscount - platformFee).toFixed(2));

    const batch = await prisma.settlementBatch.create({
      data: {
        venueId,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        totalRedemptions: redemptions.length,
        totalDiscount,
        platformFee,
        venuePayable,
        status: 'PENDING',
      },
    });

    await prisma.voucherRedemption.updateMany({
      where: { id: { in: redemptions.map((r) => r.id) } },
      data: { settlementBatchId: batch.id, settledAt: new Date() },
    });

    res.status(201).json({ batch });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/batches/:venueId', authenticate, async (req: AuthRequest, res) => {
  try {
    const batches = await prisma.settlementBatch.findMany({
      where: { venueId: req.params.venueId },
      include: { _count: { select: { redemptions: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ batches });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
