import { RateLimiterService } from '../services/rateLimiterService';

describe('Atomic Lua Script Rate Limiter Tests', () => {
  let testSenderId = '';

  beforeEach(() => {
    testSenderId = `lua-sender-test-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  });

  it('should atomically reserve limit up to max capacity without over-incrementing', async () => {
    const limit = 2;

    // Call 1: Allowed (Count = 1)
    const res1 = await RateLimiterService.checkAndConsumeRateLimit(testSenderId, limit);
    expect(res1.allowed).toBe(true);
    expect(res1.currentCount).toBe(1);

    // Call 2: Allowed (Count = 2)
    const res2 = await RateLimiterService.checkAndConsumeRateLimit(testSenderId, limit);
    expect(res2.allowed).toBe(true);
    expect(res2.currentCount).toBe(2);

    // Call 3: Rejected (Count = 2, does NOT increment to 3)
    const res3 = await RateLimiterService.checkAndConsumeRateLimit(testSenderId, limit);
    expect(res3.allowed).toBe(false);
    expect(res3.currentCount).toBe(2);

    // Call 4: Rejected again (Count remains 2)
    const res4 = await RateLimiterService.checkAndConsumeRateLimit(testSenderId, limit);
    expect(res4.allowed).toBe(false);
    expect(res4.currentCount).toBe(2);
  });
});
