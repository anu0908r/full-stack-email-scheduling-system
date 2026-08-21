import { Request, Response, NextFunction } from 'express';

// Simple in-memory rate limiter for auth endpoints
const authAttempts = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 20;

export const authRateLimit = (req: Request, res: Response, next: NextFunction): void => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const record = authAttempts.get(ip);

  if (!record || now > record.resetAt) {
    authAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    next();
    return;
  }

  record.count++;
  if (record.count > MAX_ATTEMPTS) {
    res.status(429).json({ error: 'Too many authentication attempts. Please try again later.' });
    return;
  }

  next();
};

// Periodic cleanup (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of authAttempts.entries()) {
    if (now > val.resetAt) authAttempts.delete(key);
  }
}, 5 * 60 * 1000);
