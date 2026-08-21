import Redis from 'ioredis';
import { config } from '../config';

function createRedis(name: string): Redis {
  const conn = new Redis(config.redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: false,
    reconnectOnError: () => true,
  });

  conn.on('error', (err) => {
    if (err.message.includes('Connection is closed')) return;
    console.error(`[Redis ${name} Error]`, err.message);
  });

  conn.on('connect', () => {
    console.log(`[Redis ${name}] Connected`);
  });

  return conn;
}

export const redisConnection = createRedis('Main');
export const redisQueue = createRedis('Queue');
export const redisWorker = createRedis('Worker');
