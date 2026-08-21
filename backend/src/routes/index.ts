import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { EmailController } from '../controllers/emailController';
import { SenderController } from '../controllers/senderController';
import { authenticateJwt } from '../middleware/authMiddleware';
import { authRateLimit } from '../middleware/rateLimit';
import { prisma } from '../db/prisma';
import { redisConnection } from '../db/redis';

const router = Router();

// Health Check — verifies DB and Redis connectivity
router.get('/health', async (_req, res) => {
  const checks: { status: string; latencyMs?: number }[] = [];
  let overallStatus = 'ok';

  // DB check
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.push({ status: 'ok', latencyMs: Date.now() - dbStart });
  } catch {
    checks.push({ status: 'error' });
    overallStatus = 'degraded';
  }

  // Redis check
  const redisStart = Date.now();
  try {
    await redisConnection.ping();
    checks.push({ status: 'ok', latencyMs: Date.now() - redisStart });
  } catch {
    checks.push({ status: 'error' });
    overallStatus = 'degraded';
  }

  res.status(overallStatus === 'ok' ? 200 : 503).json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    checks: { db: checks[0], redis: checks[1] },
  });
});

// Authentication Routes (rate limited)
router.get('/auth/google/url', authRateLimit, AuthController.getGoogleAuthUrl);
router.get('/auth/google/callback', authRateLimit, AuthController.googleCallback);
router.post('/auth/dev-login', authRateLimit, AuthController.devLogin);
router.get('/auth/me', authenticateJwt, AuthController.getCurrentUser);
router.post('/auth/logout', authenticateJwt, AuthController.logout);

// Senders Routes
router.get('/senders', authenticateJwt, SenderController.listSenders);
router.post('/senders', authenticateJwt, SenderController.createSender);
router.delete('/senders/:id', authenticateJwt, SenderController.deleteSender);

// Email Scheduling Routes
router.post('/emails/schedule', authenticateJwt, EmailController.scheduleEmails);
router.get('/emails/scheduled', authenticateJwt, EmailController.getScheduledEmails);
router.get('/emails/sent', authenticateJwt, EmailController.getSentEmails);
router.get('/emails/:id', authenticateJwt, EmailController.getEmailById);

export default router;
