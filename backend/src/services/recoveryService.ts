import { prisma } from '../db/prisma';
import { emailQueue, addEmailToQueue } from '../queues/emailQueue';

export class RecoveryService {
  private static MAX_RECOVERY_ATTEMPTS = 5;

  /**
   * Reconciles orphaned and unqueued jobs on worker/server startup.
   *
   * Case A: DB=SCHEDULED, BullMQ exists → do nothing
   * Case B: DB=SCHEDULED, BullMQ missing → recreate
   * Case C: DB=PROCESSING, BullMQ exists → do not duplicate (reset to SCHEDULED, let BullMQ reprocess)
   * Case D: DB=PROCESSING, BullMQ missing → reset to SCHEDULED, recreate
   * Case E: DB=SENT → never recreate
   * Case F: DB=FAILED, attempts < MAX → reset to SCHEDULED, recreate (BullMQ may have given up)
   */
  public static async reconcileScheduledJobs(): Promise<{ resetProcessing: number; requeuedJobs: number; resetFailed: number }> {
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

    // 2. Requeue FAILED emails that haven't exceeded max recovery attempts
    const failedResult = await prisma.email.updateMany({
      where: {
        status: 'FAILED',
        attempts: { lt: this.MAX_RECOVERY_ATTEMPTS },
      },
      data: {
        status: 'SCHEDULED',
      },
    });

    if (failedResult.count > 0) {
      console.log(`[RecoveryService] Reset ${failedResult.count} FAILED emails to SCHEDULED for retry.`);
    }

    // 3. Fetch all SCHEDULED emails (fresh after reset)
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
        // Recalculate delay — if scheduled time is in the past, process immediately
        const scheduledTime = new Date(email.scheduledAt).getTime();
        const delay = Math.max(0, scheduledTime - now);

        const bullJobId = await addEmailToQueue(email.id, delay);

        await prisma.email.update({
          where: { id: email.id },
          data: { bullJobId },
        });

        requeuedCount++;
      }
    }

    console.log(`[RecoveryService] Reconciliation completed. Reset: ${stuckResult.count}, FailedReset: ${failedResult.count}, Requeued: ${requeuedCount}.`);

    return {
      resetProcessing: stuckResult.count,
      requeuedJobs: requeuedCount,
      resetFailed: failedResult.count,
    };
  }
}
