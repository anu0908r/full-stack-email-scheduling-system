import { prisma } from '../db/prisma';
import { emailQueue, addEmailToQueue } from '../queues/emailQueue';

export class RecoveryService {
  /**
   * Reconciles orphaned and unqueued jobs on worker/server startup.
   */
  public static async reconcileScheduledJobs(): Promise<{ resetProcessing: number; requeuedJobs: number }> {
    console.log('[RecoveryService] Running startup reconciliation check...');

    // 1. Reset any emails stuck in PROCESSING back to SCHEDULED
    const stuckResult = await prisma.email.updateMany({
      where: {
        status: 'PROCESSING',
      },
      data: {
        status: 'SCHEDULED',
      },
    });

    if (stuckResult.count > 0) {
      console.log(`[RecoveryService] Reset ${stuckResult.count} stuck PROCESSING emails to SCHEDULED.`);
    }

    // 2. Fetch all SCHEDULED emails
    const scheduledEmails = await prisma.email.findMany({
      where: {
        status: 'SCHEDULED',
      },
    });

    let requeuedCount = 0;
    const now = Date.now();

    for (const email of scheduledEmails) {
      // Check if job exists in BullMQ
      const existingJob = email.bullJobId ? await emailQueue.getJob(email.bullJobId) : null;

      if (!existingJob) {
        // Re-enqueue job in BullMQ
        const delay = Math.max(0, new Date(email.scheduledAt).getTime() - now);
        const bullJobId = await addEmailToQueue(email.id, delay);

        await prisma.email.update({
          where: { id: email.id },
          data: { bullJobId },
        });

        requeuedCount++;
      }
    }

    console.log(`[RecoveryService] Reconciliation completed. Reset: ${stuckResult.count}, Requeued: ${requeuedCount}.`);

    return {
      resetProcessing: stuckResult.count,
      requeuedJobs: requeuedCount,
    };
  }
}
