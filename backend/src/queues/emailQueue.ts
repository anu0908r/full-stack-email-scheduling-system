import { Queue } from 'bullmq';
import { redisConnection } from '../db/redis';

export interface EmailJobData {
  emailId: string;
}

export const EMAIL_QUEUE_NAME = 'emailQueue';

export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});

export const addEmailToQueue = async (emailId: string, delayMs: number): Promise<string> => {
  const safeDelay = Math.max(0, delayMs);
  const job = await emailQueue.add(
    'send-email',
    { emailId },
    {
      delay: safeDelay,
      jobId: emailId, // Guarantees job uniqueness in BullMQ
    }
  );
  return job.id ?? emailId;
};
