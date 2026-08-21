import nodemailer from 'nodemailer';
import { config } from '../config';

export interface SendMailOptions {
  senderEmail: string;
  senderName: string;
  recipient: string;
  subject: string;
  body: string;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpUser?: string | null;
  smtpPass?: string | null;
}

export interface SendMailResult {
  messageId: string;
  previewUrl: string | null;
}

// Memory cache for auto-generated Ethereal accounts per sender email
const etherealAccountsCache = new Map<string, { user: string; pass: string; expiresAt: number }>();
const transporterCache = new Map<string, { transporter: nodemailer.Transporter; expiresAt: number }>();

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function getTransporterKey(host: string, port: number, user: string, pass: string): string {
  return `${host}:${port}:${user}:${pass}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function createTransporterInstance(host: string, port: number, user: string, pass: string): nodemailer.Transporter {
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 20000, // 20s timeout to allow cloud TLS handshakes to complete
    greetingTimeout: 20000,   // 20s greeting timeout
    socketTimeout: 20000,     // 20s socket timeout
  });
}

export const sendEmailViaSMTP = async (options: SendMailOptions, retryAttempt = 0): Promise<SendMailResult> => {
  let host = options.smtpHost || config.etherealHost;
  let port = options.smtpPort || config.etherealPort;
  let user = options.smtpUser || config.etherealUser;
  let pass = options.smtpPass || config.etherealPassword;

  const isCustomSmtp = Boolean(options.smtpUser && options.smtpPass && options.smtpHost);

  // If fallback attempts for default Ethereal, try alternate ports (587 -> 2525 -> 465)
  if (!isCustomSmtp && retryAttempt > 0) {
    if (retryAttempt === 1) port = 2525;
    else if (retryAttempt === 2) port = 465;
  }

  // Generate or retrieve cached Ethereal test account
  if (!user || !pass) {
    const cached = etherealAccountsCache.get(options.senderEmail);
    if (cached && Date.now() < cached.expiresAt && retryAttempt === 0) {
      user = cached.user;
      pass = cached.pass;
    } else {
      try {
        const testAccount = await nodemailer.createTestAccount();
        host = 'smtp.ethereal.email';
        user = testAccount.user;
        pass = testAccount.pass;
        etherealAccountsCache.set(options.senderEmail, { user, pass, expiresAt: Date.now() + CACHE_TTL_MS });
        console.log(`[Ethereal SMTP] Generated dynamic test account for ${options.senderEmail}: ${user}`);
      } catch (err: any) {
        console.error('[Ethereal Account Creation Error]', err.message);
        throw new Error(`Failed to create Ethereal SMTP test account: ${err.message}`);
      }
    }
  }

  const cacheKey = getTransporterKey(host, port, user!, pass!);
  let transporter: nodemailer.Transporter;

  if (retryAttempt === 0 && transporterCache.has(cacheKey)) {
    const cachedObj = transporterCache.get(cacheKey)!;
    if (Date.now() < cachedObj.expiresAt) {
      transporter = cachedObj.transporter;
    } else {
      transporter = createTransporterInstance(host, port, user!, pass!);
      transporterCache.set(cacheKey, { transporter, expiresAt: Date.now() + CACHE_TTL_MS });
    }
  } else {
    transporter = createTransporterInstance(host, port, user!, pass!);
    transporterCache.set(cacheKey, { transporter, expiresAt: Date.now() + CACHE_TTL_MS });
  }

  const safeHtml = escapeHtml(options.body).replace(/\n/g, '<br/>');

  const mailOptions = {
    from: `"${options.senderName}" <${options.senderEmail}>`,
    to: options.recipient,
    subject: options.subject,
    html: safeHtml,
    text: options.body,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    const previewUrl = nodemailer.getTestMessageUrl(info) || null;

    console.log(`[SMTP Sent] MessageId: ${info.messageId} | Live Ethereal Preview: ${previewUrl}`);

    return {
      messageId: info.messageId,
      previewUrl: previewUrl ? String(previewUrl) : null,
    };
  } catch (err: any) {
    console.warn(`[SMTP Warning] Connection/Send failed on port ${port} (retryAttempt=${retryAttempt}): ${err.message}`);

    // If default Ethereal transport failed, purge cache and try alternate ports (up to 3 attempts)
    if (!isCustomSmtp && retryAttempt < 2) {
      console.log(`[SMTP Port Failover] Retrying Ethereal send on alternate port...`);
      etherealAccountsCache.delete(options.senderEmail);
      transporterCache.delete(cacheKey);
      return sendEmailViaSMTP(options, retryAttempt + 1);
    }

    if (isCustomSmtp && retryAttempt === 0) {
      transporterCache.delete(cacheKey);
      return sendEmailViaSMTP(options, 1);
    }

    throw err;
  }
};
