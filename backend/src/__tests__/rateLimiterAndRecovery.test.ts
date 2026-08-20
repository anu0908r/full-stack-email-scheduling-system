import { RateLimiterService } from '../services/rateLimiterService';
import { RecoveryService } from '../services/recoveryService';
import { prisma } from '../db/prisma';

describe('Rate Limiter & Recovery Service Unit Tests', () => {
  const testSenderId = `test-sender-recovery-${Date.now()}`;

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should enforce hourly rate limits', async () => {
    const hourlyLimit = 3;

    // Call 1: Allowed
    const res1 = await RateLimiterService.checkAndConsumeRateLimit(testSenderId, hourlyLimit);
    expect(res1.allowed).toBe(true);

    // Call 2: Allowed
    const res2 = await RateLimiterService.checkAndConsumeRateLimit(testSenderId, hourlyLimit);
    expect(res2.allowed).toBe(true);

    // Call 3: Allowed (reaches limit)
    const res3 = await RateLimiterService.checkAndConsumeRateLimit(testSenderId, hourlyLimit);
    expect(res3.allowed).toBe(true);

    // Call 4: Exceeded! Should return allowed = false
    const res4 = await RateLimiterService.checkAndConsumeRateLimit(testSenderId, hourlyLimit);
    expect(res4.allowed).toBe(false);
    expect(res4.nextWindowStart).toBeInstanceOf(Date);
  });

  it('should handle recovery reconciliation safely', async () => {
    const result = await RecoveryService.reconcileScheduledJobs();
    expect(typeof result.resetProcessing).toBe('number');
    expect(typeof result.requeuedJobs).toBe('number');
  });
});
