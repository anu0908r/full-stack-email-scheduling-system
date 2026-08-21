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

// Global persistent Ethereal account instance (reused across process lifetime)
let persistentEtherealAccount: { user: string; pass: string } | null = null;
let globalTransporter: nodemailer.Transporter | null = null;

async function getOrCreatePersistentEtherealAccount(): Promise<{ user: string; pass: string }> {
  if (config.etherealUser && config.etherealPassword) {
    return { user: config.etherealUser, pass: config.etherealPassword };
  }

  if (persistentEtherealAccount) {
    return persistentEtherealAccount;
  }

  try {
    const testAccount = await nodemailer.createTestAccount();
    persistentEtherealAccount = { user: testAccount.user, pass: testAccount.pass };
    console.log(`[Ethereal SMTP] Provisioned global persistent Ethereal mailbox: ${testAccount.user}`);
    return persistentEtherealAccount;
  } catch (err: any) {
    console.error('[Ethereal Account Provisioning Error]', err.message);
    throw new Error(`Failed to provision Ethereal test account: ${err.message}`);
  }
}

function createTransporter(host: string, port: number, user: string, pass: string): nodemailer.Transporter {
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 20000,
    greetingTimeout: 20000,
    socketTimeout: 20000,
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export const sendEmailViaSMTP = async (options: SendMailOptions, isRetry = false): Promise<SendMailResult> => {
  let host = options.smtpHost || config.etherealHost || 'smtp.ethereal.email';
  let port = options.smtpPort || config.etherealPort || 587;
  let user = options.smtpUser || config.etherealUser;
  let pass = options.smtpPass || config.etherealPassword;

  const isCustomSmtp = Boolean(options.smtpUser && options.smtpPass && options.smtpHost);

  // If no custom SMTP credentials provided, obtain global persistent Ethereal account
  if (!user || !pass) {
    const account = await getOrCreatePersistentEtherealAccount();
    user = account.user;
    pass = account.pass;
    host = 'smtp.ethereal.email';
    port = 587;
  }

  // Create or reuse transporter instance
  let transporter: nodemailer.Transporter;
  if (!isCustomSmtp) {
    if (!globalTransporter || isRetry) {
      globalTransporter = createTransporter(host, port, user, pass);
    }
    transporter = globalTransporter;
  } else {
    transporter = createTransporter(host, port, user, pass);
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

    console.log(`[SMTP Sent] MessageId: ${info.messageId} | Live Ethereal URL: ${previewUrl}`);

    return {
      messageId: info.messageId,
      previewUrl: previewUrl ? String(previewUrl) : null,
    };
  } catch (err: any) {
    console.warn(`[SMTP Warning] Connection/Send failed (isRetry=${isRetry}): ${err.message}`);

    // If first attempt failed and we used default Ethereal, reset account & transporter and retry once
    if (!isRetry) {
      if (!isCustomSmtp) {
        console.log(`[SMTP Retry] Re-provisioning global Ethereal transport and retrying...`);
        persistentEtherealAccount = null;
        globalTransporter = null;
      }
      return sendEmailViaSMTP(options, true);
    }

    throw err;
  }
};
