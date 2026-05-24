import redis from '../config/redis';
import prisma from '../config/database';

interface RiskParams {
  ip: string;
  deviceId?: string;
  userId?: string;
  action: string;
}

export const antifraudService = {
  async assessRisk(params: RiskParams): Promise<number> {
    let score = 0;
    const { ip, deviceId, userId, action } = params;

    // --- IP rate check ---
    const ipKey = `fraud:ip:${ip}:${action}`;
    const ipCount = await redis.incr(ipKey);
    if (ipCount === 1) await redis.expire(ipKey, 3600);

    if (ipCount > 20) score += 40;
    else if (ipCount > 10) score += 20;

    const ipFlagged = await redis.get(`fraud:flagged:ip:${ip}`);
    if (ipFlagged) score += 50;

    // --- Device fingerprint check ---
    if (deviceId) {
      const devKey = `fraud:device:req:${deviceId}`;
      const devCount = await redis.incr(devKey);
      if (devCount === 1) await redis.expire(devKey, 86400);
      if (devCount > 10) score += 30;

      if (userId) {
        await redis.sadd(`fraud:device:users:${deviceId}`, userId);
        await redis.expire(`fraud:device:users:${deviceId}`, 86400 * 7);
      }
      const deviceUsers = await redis.scard(`fraud:device:users:${deviceId}`);
      if (deviceUsers > 3) score += 40;
    }

    // --- Account age + verification ---
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { createdAt: true, fraudScore: true, isVerified: true },
      });
      if (user) {
        const ageHours = (Date.now() - user.createdAt.getTime()) / 3_600_000;
        if (ageHours < 1) score += 30;
        else if (ageHours < 24) score += 15;
        if (!user.isVerified) score += 10;
        score += user.fraudScore;
      }
    }

    const finalScore = Math.min(score, 100);

    if (finalScore >= 40) {
      prisma.fraudLog
        .create({
          data: { userId, ipAddress: ip, deviceId, action, riskScore: finalScore, details: { ipCount } },
        })
        .catch(console.error);
    }

    return finalScore;
  },

  async detectSelfInvite(hostId: string, attendeeId: string): Promise<boolean> {
    const hostDevices  = await redis.smembers(`fraud:user:devices:${hostId}`);
    const guestDevices = await redis.smembers(`fraud:user:devices:${attendeeId}`);
    return hostDevices.some((d) => guestDevices.includes(d));
  },

  async flagIP(ip: string, reason: string): Promise<void> {
    await redis.set(`fraud:flagged:ip:${ip}`, reason, 'EX', 86400 * 7);
  },

  async banUser(userId: string): Promise<void> {
    await Promise.all([
      prisma.user.update({ where: { id: userId }, data: { isBanned: true, fraudScore: 100 } }),
      redis.set(`fraud:banned:user:${userId}`, '1'),
    ]);
  },

  async validateEventCompletion(eventId: string): Promise<{ isValid: boolean; reason?: string }> {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        attendees: true,
        host: { select: { createdAt: true, fraudScore: true } },
      },
    });
    if (!event) return { isValid: false, reason: 'Event not found' };

    const ageDays = (Date.now() - event.host.createdAt.getTime()) / 86_400_000;
    if (ageDays < 7) return { isValid: false, reason: 'Host account too new' };
    if (event.host.fraudScore > 60) return { isValid: false, reason: 'Host flagged' };

    return { isValid: true };
  },
};
