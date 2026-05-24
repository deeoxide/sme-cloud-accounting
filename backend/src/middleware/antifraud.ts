import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { antifraudService } from '../services/antifraudService';

export const antifraudCheck = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip || '';
  const deviceId = req.headers['x-device-id'] as string | undefined;

  const riskScore = await antifraudService.assessRisk({
    ip,
    deviceId,
    userId: req.userId,
    action: `${req.method}:${req.path}`,
  });

  if (riskScore >= 80) {
    return res.status(403).json({ error: 'Request blocked due to suspicious activity' });
  }

  next();
};
