import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { prisma } from '../db/prisma';
import { config } from '../config';
import { createSenderSchema } from './emailController';

export class SenderController {
  public static async listSenders(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'User unauthorized' });
        return;
      }

      const senders = await prisma.sender.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      res.json({ senders });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  public static async createSender(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'User unauthorized' });
        return;
      }

      const parsed = createSenderSchema.safeParse(req.body);
      if (!parsed.success) {
        const errors = parsed.error.issues.map((i) => i.message).join('; ');
        res.status(400).json({ error: `Validation failed: ${errors}` });
        return;
      }

      const { email, displayName, hourlyLimit, smtpHost, smtpPort, smtpUser, smtpPass } = parsed.data;

      const cleanEmail = email.trim().toLowerCase();

      // Check if sender with same email already exists for this user
      const existing = await prisma.sender.findFirst({
        where: { userId, email: cleanEmail },
      });

      if (existing) {
        res.status(400).json({ error: `Sender with email '${cleanEmail}' already exists.` });
        return;
      }

      const sender = await prisma.sender.create({
        data: {
          userId,
          email: cleanEmail,
          displayName,
          hourlyLimit: hourlyLimit ?? config.maxEmailsPerHourPerSender,
          smtpHost: smtpHost || null,
          smtpPort: smtpPort ?? null,
          smtpUser: smtpUser || null,
          smtpPass: smtpPass || null,
        },
      });

      res.status(201).json({ sender });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  public static async deleteSender(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'User unauthorized' });
        return;
      }

      const { id } = req.params;

      const sender = await prisma.sender.findUnique({ where: { id } });
      if (!sender) {
        res.status(404).json({ error: 'Sender not found.' });
        return;
      }

      if (sender.userId !== userId) {
        res.status(403).json({ error: 'Access denied.' });
        return;
      }

      const activeEmails = await prisma.email.count({
        where: { senderId: id, status: { in: ['SCHEDULED', 'PROCESSING'] } },
      });

      if (activeEmails > 0) {
        res.status(400).json({ error: `Cannot delete sender with ${activeEmails} active scheduled email(s). Delete or clear scheduled emails first.` });
        return;
      }

      await prisma.sender.delete({ where: { id } });
      res.json({ message: 'Sender deleted successfully' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
}
