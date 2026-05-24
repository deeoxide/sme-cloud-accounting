import prisma from '../config/database';
import { LoyaltyTier } from '@prisma/client';

const POINTS_PER_TRIP = 100;

const MILESTONES = [
  { trips: 1,  points: 50,   description: 'First trip bonus!' },
  { trips: 5,  points: 250,  description: '5 trips milestone' },
  { trips: 10, points: 1000, description: '10 trips milestone — GOLD unlocked!' },
  { trips: 25, points: 3000, description: '25 trips milestone — PLATINUM unlocked!' },
];

const TIER_THRESHOLDS: Record<number, LoyaltyTier> = {
  0:  'BRONZE',
  5:  'SILVER',
  10: 'GOLD',
  25: 'PLATINUM',
};

export const loyaltyService = {
  /**
   * Called after host checks in. Validates success criteria then awards points.
   */
  async processEventCompletion(eventId: string): Promise<void> {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: { attendees: true, booking: true },
    });

    if (!event || event.status !== 'ACTIVE') return;

    const accepted = event.attendees.filter((a) => a.status === 'ACCEPTED' || a.status === 'CHECKED_IN');
    const checkedIn = event.attendees.filter((a) => a.status === 'CHECKED_IN');
    const successRate = accepted.length === 0 ? 1 : checkedIn.length / accepted.length;

    if (successRate < 0.8 && accepted.length > 0) return;

    await prisma.event.update({
      where: { id: eventId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    await prisma.booking.update({
      where: { id: event.bookingId },
      data: { status: 'COMPLETED', checkOutAt: new Date() },
    });

    await this.awardTripPoints(event.hostId, eventId);
  },

  async awardTripPoints(userId: string, eventId: string): Promise<void> {
    let account = await prisma.loyaltyAccount.findUnique({ where: { userId } });
    if (!account) {
      account = await prisma.loyaltyAccount.create({ data: { userId } });
    }

    const newTripCount = account.successfulTrips + 1;
    const milestone = MILESTONES.find((m) => m.trips === newTripCount);
    const totalEarned = POINTS_PER_TRIP + (milestone?.points ?? 0);
    const newTier = this.calculateTier(newTripCount);

    await prisma.$transaction([
      prisma.loyaltyAccount.update({
        where: { userId },
        data: {
          successfulTrips: newTripCount,
          totalPoints:     { increment: totalEarned },
          availablePoints: { increment: totalEarned },
          lifetimePoints:  { increment: totalEarned },
          tier:            newTier,
        },
      }),
      prisma.loyaltyTransaction.create({
        data: {
          accountId:     account.id,
          eventId,
          type:          milestone ? 'EARN_MILESTONE_BONUS' : 'EARN_TRIP_COMPLETE',
          points:        totalEarned,
          balanceBefore: account.availablePoints,
          balanceAfter:  account.availablePoints + totalEarned,
          description:   milestone
            ? `Trip #${newTripCount} + ${milestone.description}`
            : `Trip #${newTripCount} completed`,
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        },
      }),
    ]);
  },

  calculateTier(trips: number): LoyaltyTier {
    const thresholds = Object.entries(TIER_THRESHOLDS)
      .map(([t, tier]) => ({ t: parseInt(t), tier }))
      .sort((a, b) => b.t - a.t);
    return thresholds.find(({ t }) => trips >= t)?.tier ?? 'BRONZE';
  },

  getNextMilestone(currentTrips: number) {
    const next = MILESTONES.find((m) => m.trips > currentTrips);
    if (!next) return null;
    return {
      ...next,
      tripsRemaining: next.trips - currentTrips,
      progress: Math.round((currentTrips / next.trips) * 100),
    };
  },

  async redeemPoints(userId: string, rewardId: string, venueId?: string) {
    const [account, reward] = await Promise.all([
      prisma.loyaltyAccount.findUnique({ where: { userId } }),
      prisma.rewardCatalog.findUnique({ where: { id: rewardId } }),
    ]);

    if (!account) throw new Error('Loyalty account not found');
    if (!reward || !reward.isActive) throw new Error('Reward not available');
    if (account.availablePoints < reward.pointsCost) throw new Error('Insufficient points');
    if (reward.stock !== null && reward.redemptionCount >= reward.stock) {
      throw new Error('Reward is out of stock');
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + reward.validityDays);

    const [voucher] = await prisma.$transaction([
      prisma.voucherRedemption.create({
        data: { userId, rewardId, venueId, pointsUsed: reward.pointsCost, discountValue: reward.discountValue, status: 'ISSUED', expiresAt },
        include: { reward: true },
      }),
      prisma.loyaltyAccount.update({
        where: { userId },
        data: { availablePoints: { decrement: reward.pointsCost } },
      }),
      prisma.rewardCatalog.update({
        where: { id: rewardId },
        data: { redemptionCount: { increment: 1 } },
      }),
      prisma.loyaltyTransaction.create({
        data: {
          accountId:     account.id,
          type:          'REDEEM_VOUCHER',
          points:        -reward.pointsCost,
          balanceBefore: account.availablePoints,
          balanceAfter:  account.availablePoints - reward.pointsCost,
          description:   `Redeemed: ${reward.title}`,
        },
      }),
    ]);

    return voucher;
  },
};
