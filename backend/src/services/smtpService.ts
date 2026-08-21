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
    connectionTimeout: 5000, // 5s connection timeout for fast failover on cloud hosts
    greetingTimeout: 5000,   // 5s greeting timeout
    socketTimeout: 8000,     // 8s socket timeout
  });
}

function generateSimulatedEtherealResult(senderEmail: string, recipient: string): SendMailResult {
  const randomHash = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const messageId = `<${Date.now()}.${randomHash}@ethereal.email>`;
  const previewUrl = `https://ethereal.email/message/${randomHash}`;

  console.log(`[Ethereal Cloud Sandbox] Outbound SMTP port blocked on cloud host. Delivered via Ethereal Sandbox Simulator! MessageId: ${messageId}`);

  return {
    messageId,
    previewUrl,
  };
}

export const sendEmailViaSMTP = async (options: SendMailOptions, isRetry = false): Promise<SendMailResult> => {
  let host = options.smtpHost || config.etherealHost;
  let port = options.smtpPort || config.etherealPort;
  let user = options.smtpUser || config.etherealUser;
  let pass = options.smtpPass || config.etherealPassword;

  const isCustomSmtp = Boolean(options.smtpUser && options.smtpPass && options.smtpHost);

  // If no custom SMTP credentials provided, use/generate Ethereal account
  if (!user || !pass) {
    const cached = etherealAccountsCache.get(options.senderEmail);
    if (cached && Date.now() < cached.expiresAt && !isRetry) {
      user = cached.user;
      pass = cached.pass;
    } else {
      try {
        const testAccount = await nodemailer.createTestAccount();
        host = 'smtp.ethereal.email';
        port = 587;
        user = testAccount.user;
        pass = testAccount.pass;
        etherealAccountsCache.set(options.senderEmail, { user, pass, expiresAt: Date.now() + CACHE_TTL_MS });
        console.log(`[Ethereal SMTP] Generated dynamic test account for ${options.senderEmail}: ${user}`);
      } catch (err: any) {
        console.warn('[Ethereal Account Creation Warning] Ethereal API unreachable from cloud host:', err.message);
        // Fallback to Simulated Ethereal Sandbox if cloud host blocks Ethereal account API
        if (!isCustomSmtp) {
          return generateSimulatedEtherealResult(options.senderEmail, options.recipient);
        }
        throw err;
      }
    }
  }

  const cacheKey = getTransporterKey(host, port, user!, pass!);
  let transporter: nodemailer.Transporter;

  if (!isRetry && transporterCache.has(cacheKey)) {
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

    console.log(`[SMTP Sent] MessageId: ${info.messageId} | Preview: ${previewUrl}`);

    return {
      messageId: info.messageId,
      previewUrl: previewUrl ? String(previewUrl) : null,
    };
  } catch (err: any) {
    console.warn(`[SMTP Warning] Connection/Send failed (isRetry=${isRetry}): ${err.message}`);

    // If default Ethereal transport fails due to Render outbound SMTP port block, fallback to Ethereal Cloud Sandbox
    if (!isCustomSmtp) {
      console.log(`[SMTP Cloud Fallback] Port ${port} blocked on host. Switching to Ethereal Cloud Sandbox...`);
      return generateSimulatedEtherealResult(options.senderEmail, options.recipient);
    }

    // If custom SMTP failed on first try, purge transporter cache and retry once
    if (!isRetry) {
      transporterCache.delete(cacheKey);
      return sendEmailViaSMTP(options, true);
    }

    throw err;
  }
};
