import Redis from 'ioredis';
import { config } from '../config';

export const redisConnection = new Redis(config.redisUrl, {
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
  lazyConnect: false,
  reconnectOnError: () => true,
});

redisConnection.on('error', (err) => {
  if (err.message.includes('Connection is closed')) return;
  console.error('[Redis Error]', err.message);
});

redisConnection.on('connect', () => {
  console.log('[Redis] Connected');
});
