import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { prisma } from '../db/prisma';
import { config } from '../config';

export class SenderController {
  public static async listSenders(req: AuthRequest, res: Response): Promise<void> {
    try {
      let senders = await prisma.sender.findMany({
        orderBy: { createdAt: 'desc' },
      });

      // If no sender exists yet, auto-provision default sender
      if (senders.length === 0) {
        const defaultSender = await prisma.sender.create({
          data: {
            email: 'outreach@reachinbox.ai',
            displayName: 'ReachInbox Primary Sender',
            hourlyLimit: config.maxEmailsPerHourPerSender,
          },
        });
        senders = [defaultSender];
      }

      res.json({ senders });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  public static async createSender(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { email, displayName, hourlyLimit, smtpHost, smtpPort, smtpUser, smtpPass } = req.body;

      if (!email || !displayName) {
        res.status(400).json({ error: 'Email and displayName are required fields.' });
        return;
      }

      const sender = await prisma.sender.create({
        data: {
          email: email.trim().toLowerCase(),
          displayName,
          hourlyLimit: hourlyLimit ? parseInt(hourlyLimit, 10) : config.maxEmailsPerHourPerSender,
          smtpHost: smtpHost || null,
          smtpPort: smtpPort ? parseInt(smtpPort, 10) : null,
          smtpUser: smtpUser || null,
          smtpPass: smtpPass || null,
        },
      });

      res.status(201).json({ sender });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
}
