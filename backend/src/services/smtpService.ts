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
const etherealAccountsCache = new Map<string, { user: string; pass: string }>();

// Cache SMTP transporters per sender config to avoid recreating per email
const transporterCache = new Map<string, nodemailer.Transporter>();

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

export const sendEmailViaSMTP = async (options: SendMailOptions): Promise<SendMailResult> => {
  let host = options.smtpHost || config.etherealHost;
  let port = options.smtpPort || config.etherealPort;
  let user = options.smtpUser || config.etherealUser;
  let pass = options.smtpPass || config.etherealPassword;

  // If no user/pass configured in environment or sender record, generate Ethereal test account dynamically
  if (!user || !pass) {
    if (etherealAccountsCache.has(options.senderEmail)) {
      const cached = etherealAccountsCache.get(options.senderEmail)!;
      user = cached.user;
      pass = cached.pass;
    } else {
      const testAccount = await nodemailer.createTestAccount();
      host = 'smtp.ethereal.email';
      port = 587;
      user = testAccount.user;
      pass = testAccount.pass;
      etherealAccountsCache.set(options.senderEmail, { user, pass });
      console.log(`[Ethereal SMTP] Created dynamic test account for ${options.senderEmail}: ${user}`);
    }
  }

  const cacheKey = getTransporterKey(host, port, user!, pass!);
  let transporter = transporterCache.get(cacheKey);
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
    transporterCache.set(cacheKey, transporter);
  }

  // HTML-escape body to prevent injection, then convert newlines to <br/>
  const safeHtml = escapeHtml(options.body).replace(/\n/g, '<br/>');

  const mailOptions = {
    from: `"${options.senderName}" <${options.senderEmail}>`,
    to: options.recipient,
    subject: options.subject,
    html: safeHtml,
    text: options.body,
  };

  const info = await transporter.sendMail(mailOptions);
  const previewUrl = nodemailer.getTestMessageUrl(info) || null;

  console.log(`[SMTP Sent] MessageId: ${info.messageId} | Preview: ${previewUrl}`);

  return {
    messageId: info.messageId,
    previewUrl: previewUrl ? String(previewUrl) : null,
  };
};
