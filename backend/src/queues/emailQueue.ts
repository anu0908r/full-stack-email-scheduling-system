import { Queue } from 'bullmq';
import { redisQueue } from '../db/redis';

export interface EmailJobData {
  emailId: string;
}

export const EMAIL_QUEUE_NAME = 'emailQueue';

export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
  connection: redisQueue,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: { age: 3600 },    // Remove completed jobs after 1 hour
    removeOnFail: { age: 86400 },       // Remove failed jobs after 24 hours
  },
});

export const addEmailToQueue = async (emailId: string, delayMs: number, uniqueId?: string): Promise<string> => {
  const safeDelay = Math.max(0, delayMs);
  const job = await emailQueue.add(
    'send-email',
    { emailId },
    {
      delay: safeDelay,
      jobId: uniqueId ?? emailId,
    }
  );
  return job.id ?? emailId;
};
