import { createEmailWorker } from './workers/emailWorker';
import { RecoveryService } from './services/recoveryService';

async function startWorkerService() {
  console.log('[Worker Process] Starting BullMQ Email Processing Worker...');

  // Run startup reconciliation for persistent scheduled jobs and stuck states
  try {
    await RecoveryService.reconcileScheduledJobs();
  } catch (err: any) {
    console.error('[Worker Startup Recovery Error]', err.message);
  }

  const worker = createEmailWorker();

  console.log('[Worker Process] BullMQ Worker successfully initialized and listening for jobs.');

  process.on('SIGTERM', async () => {
    console.log('[Worker Process] Graceful shutdown initiated...');
    await worker.close();
    process.exit(0);
  });
}

if (process.env.NODE_ENV !== 'test') {
  startWorkerService();
}
