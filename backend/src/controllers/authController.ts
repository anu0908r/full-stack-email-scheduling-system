import { Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/prisma';
import { config } from '../config';

const googleClient = new OAuth2Client(
  config.googleClientId,
  config.googleClientSecret,
  config.googleCallbackUrl
);

export class AuthController {
  /**
   * Returns Google OAuth URL for frontend authentication redirect
   */
  public static async getGoogleAuthUrl(req: Request, res: Response): Promise<void> {
    const url = googleClient.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
      prompt: 'consent',
    });

    res.json({ url });
  }

  /**
   * OAuth Callback handler - Exchanges code or credential for User Profile
   */
  public static async googleCallback(req: Request, res: Response): Promise<void> {
    try {
      const code = (req.query.code as string) || req.body?.code;
      const credential = (req.query.credential as string) || req.body?.credential;
      let googleId = '';
      let email = '';
      let name = '';
      let avatar = '';

      if (credential) {
        // Direct Google One Tap / ID Token flow
        const ticket = await googleClient.verifyIdToken({
          idToken: credential,
          audience: config.googleClientId,
        });
        const payload = ticket.getPayload();
        if (!payload || !payload.email) {
          res.status(400).json({ error: 'Invalid Google Token Payload' });
          return;
        }
        googleId = payload.sub;
        email = payload.email;
        name = payload.name || payload.email.split('@')[0];
        avatar = payload.picture || '';
      } else if (code) {
        // OAuth authorization code flow
        const { tokens } = await googleClient.getToken(code);
        googleClient.setCredentials(tokens);

        if (!tokens.id_token) {
          res.status(400).json({ error: 'No ID token returned from Google' });
          return;
        }

        const ticket = await googleClient.verifyIdToken({
          idToken: tokens.id_token,
          audience: config.googleClientId,
        });
        const payload = ticket.getPayload();
        if (!payload || !payload.email) {
          res.status(400).json({ error: 'Invalid Google Token' });
          return;
        }

        googleId = payload.sub;
        email = payload.email;
        name = payload.name || payload.email.split('@')[0];
        avatar = payload.picture || '';
      } else {
        res.status(400).json({ error: 'Missing code or credential in callback body' });
        return;
      }

      // Upsert user record in Database
      const user = await prisma.user.upsert({
        where: { email },
        update: { name, avatar, googleId },
        create: { googleId, email, name, avatar },
      });

      // Generate JWT Token
      const token = jwt.sign(
        { userId: user.id, email: user.email, name: user.name },
        config.jwtSecret,
        { expiresIn: '7d' }
      );

      // Redirect to frontend with token in URL
      const frontendUrl = config.frontendUrl || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/auth/callback?token=${token}&name=${encodeURIComponent(user.name)}&email=${encodeURIComponent(user.email)}&avatar=${encodeURIComponent(user.avatar || '')}`);
    } catch (err: any) {
      console.error('[Google OAuth Error]', err.message);
      res.status(500).json({ error: 'Authentication failed. Please try again.' });
    }
  }

  /**
   * Developer login endpoint — only available in development/test mode
   */
  public static async devLogin(req: Request, res: Response): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      res.status(403).json({ error: 'Dev login is disabled in production.' });
      return;
    }

    try {
      const { email = 'user@reachinbox.ai', name = 'ReachInbox User' } = req.body;
      const googleId = `dev-google-${email}`;
      const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`;

      const user = await prisma.user.upsert({
        where: { email },
        update: { name, avatar },
        create: { googleId, email, name, avatar },
      });

      // Automatically create a default Sender for this dev user if none exists
      const existingSenderCount = await prisma.sender.count({ where: { userId: user.id } });
      if (existingSenderCount === 0) {
        await prisma.sender.create({
          data: {
            userId: user.id,
            email: 'outreach@reachinbox.ai',
            displayName: 'ReachInbox Growth Sender',
            hourlyLimit: config.maxEmailsPerHourPerSender,
          },
        });
      }

      const token = jwt.sign(
        { userId: user.id, email: user.email, name: user.name },
        config.jwtSecret,
        { expiresIn: '7d' }
      );

      res.json({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * Get current authenticated user details
   */
  public static async getCurrentUser(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json({ user });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * Logout — client-side token removal; server-side is stateless JWT
   */
  public static async logout(_req: Request, res: Response): Promise<void> {
    res.json({ message: 'Logged out successfully' });
  }
}
