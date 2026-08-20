import { redisConnection } from '../db/redis';

export class RateLimiterService {
  /**
   * Helper to format current hour window timestamp key, e.g. "email-rate:senderId:2026-08-20-22"
   */
  private static getHourWindowKey(senderId: string, timestampMs: number = Date.now()): { key: string; windowStart: Date; nextWindowStart: Date } {
    const date = new Date(timestampMs);
    // Floor to the top of the current UTC hour for consistent key generation
    const windowStartMs = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), 0, 0, 0);
    const nextWindowStartMs = windowStartMs + 60 * 60 * 1000;

    const formattedHour = `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}-${date.getUTCHours()}`;
    const key = `email-rate:${senderId}:${formattedHour}`;

    return {
      key,
      windowStart: new Date(windowStartMs),
      nextWindowStart: new Date(nextWindowStartMs),
    };
  }

  /**
   * Atomic Lua Script execution to check capacity and reserve rate limit increment without over-incrementing.
   */
  public static async checkAndConsumeRateLimit(
    senderId: string,
    hourlyLimit: number
  ): Promise<{ allowed: boolean; currentCount: number; nextWindowStart: Date }> {
    const { key, nextWindowStart } = this.getHourWindowKey(senderId);

    const luaScript = `
      local key = KEYS[1]
      local limit = tonumber(ARGV[1])
      local expireSec = 3600

      local current = tonumber(redis.call('GET', key) or "0")
      if current >= limit then
          return {0, current}
      end

      local newCount = redis.call('INCR', key)
      if newCount == 1 then
          redis.call('EXPIRE', key, expireSec)
      end

      return {1, newCount}
    `;

    try {
      const rawResult = await redisConnection.eval(luaScript, 1, key, hourlyLimit.toString());
      const result = rawResult as [number, number];
      const isAllowed = result[0] === 1;
      const count = Number(result[1]);

      return {
        allowed: isAllowed,
        currentCount: count,
        nextWindowStart,
      };
    } catch (err: any) {
      console.error('[RateLimiter Lua Catch]', err.message);
      const currentVal = parseInt((await redisConnection.get(key)) || '0', 10);
      if (currentVal >= hourlyLimit) {
        return { allowed: false, currentCount: currentVal, nextWindowStart };
      }
      const count = await redisConnection.incr(key);
      if (count === 1) await redisConnection.expire(key, 3600);
      return { allowed: true, currentCount: count, nextWindowStart };
    }
  }

  /**
   * Enforce per-sender minimum delay between consecutive emails.
   */
  public static async checkAndSetSenderDelayLock(
    senderId: string,
    minDelayMs: number
  ): Promise<{ allowed: boolean; retryAfterMs: number }> {
    const lockKey = `email-throttle:${senderId}`;
    const now = Date.now();

    const acquired = await redisConnection.set(lockKey, now.toString(), 'PX', minDelayMs, 'NX');

    if (acquired === 'OK') {
      return { allowed: true, retryAfterMs: 0 };
    }

    const ttl = await redisConnection.pttl(lockKey);
    const delay = ttl > 0 ? ttl : minDelayMs;

    return { allowed: false, retryAfterMs: delay };
  }
}
