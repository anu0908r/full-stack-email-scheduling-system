import express from 'express';
import cors from 'cors';
import { config } from './config';
import routes from './routes';
import { errorHandler } from './middleware/errorHandler';
import { prisma } from './db/prisma';
import { redisConnection } from './db/redis';

const app = express();

app.use(cors({
  origin: [config.frontendUrl, 'http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/api', routes);

app.use(errorHandler);

const PORT = config.port;

if (process.env.NODE_ENV !== 'test') {
  const server = app.listen(PORT, () => {
    console.log(`[Express API Server] Running on http://localhost:${PORT}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`[API Server] ${signal} received. Shutting down gracefully...`);
    server.close(async () => {
      await prisma.$disconnect();
      redisConnection.disconnect();
      process.exit(0);
    });
    // Force exit after 10s
    setTimeout(() => process.exit(1), 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

export default app;
