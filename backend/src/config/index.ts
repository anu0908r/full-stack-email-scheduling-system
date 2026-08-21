import dotenv from 'dotenv';
import path from 'path';

// Load root .env or backend .env
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5001', 10),
  databaseUrl: process.env.DATABASE_URL || 'postgresql://vishwaksen@localhost:5432/email_scheduler?schema=public',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  googleClientId: process.env.GOOGLE_CLIENT_ID || 'mock-google-client-id',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || 'mock-google-client-secret',
  googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5001/api/auth/google/callback',
  etherealHost: process.env.ETHEREAL_HOST || 'smtp.ethereal.email',
  etherealPort: parseInt(process.env.ETHEREAL_PORT || '587', 10),
  etherealUser: process.env.ETHEREAL_USER || '',
  etherealPassword: process.env.ETHEREAL_PASSWORD || '',
  workerConcurrency: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
  minEmailDelayMs: parseInt(process.env.MIN_EMAIL_DELAY_MS || '2000', 10),
  maxEmailsPerHourPerSender: parseInt(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER || '200', 10),
  jwtSecret: process.env.JWT_SECRET || 'reachinbox-jwt-secret-key',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
};
