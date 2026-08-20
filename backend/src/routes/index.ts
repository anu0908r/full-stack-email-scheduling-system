import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { EmailController } from '../controllers/emailController';
import { SenderController } from '../controllers/senderController';
import { authenticateJwt } from '../middleware/authMiddleware';

const router = Router();

// Health Check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Authentication Routes
router.get('/auth/google/url', AuthController.getGoogleAuthUrl);
router.post('/auth/google/callback', AuthController.googleCallback);
router.post('/auth/dev-login', AuthController.devLogin);
router.get('/auth/me', authenticateJwt, AuthController.getCurrentUser);
router.post('/auth/logout', authenticateJwt, AuthController.logout);

// Senders Routes
router.get('/senders', authenticateJwt, SenderController.listSenders);
router.post('/senders', authenticateJwt, SenderController.createSender);
router.delete('/senders/:id', authenticateJwt, SenderController.deleteSender);

// Email Scheduling Routes
router.post('/emails/schedule', authenticateJwt, EmailController.scheduleEmails);
router.get('/emails/scheduled', authenticateJwt, EmailController.getScheduledEmails);
router.get('/emails/sent', authenticateJwt, EmailController.getSentEmails);
router.get('/emails/:id', authenticateJwt, EmailController.getEmailById);

export default router;
