import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('reachinbox_jwt_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface Sender {
  id: string;
  email: string;
  displayName: string;
  hourlyLimit: number;
}

export interface EmailRecord {
  id: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: string;
  sentAt?: string | null;
  status: 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED';
  attempts: number;
  errorMessage?: string | null;
  etherealMessageId?: string | null;
  etherealPreviewUrl?: string | null;
  sender: Sender;
}

export const authService = {
  getGoogleAuthUrl: async () => {
    const res = await api.get('/auth/google/url');
    return res.data.url;
  },
  googleCallback: async (data: { code?: string; credential?: string }) => {
    const res = await api.post('/auth/google/callback', data);
    return res.data;
  },
  devLogin: async (data?: { email?: string; name?: string }) => {
    const res = await api.post('/auth/dev-login', data || {});
    return res.data;
  },
  getCurrentUser: async () => {
    const res = await api.get('/auth/me');
    return res.data.user;
  },
};

export const senderService = {
  listSenders: async (): Promise<Sender[]> => {
    const res = await api.get('/senders');
    return res.data.senders;
  },
  createSender: async (senderData: Partial<Sender>): Promise<Sender> => {
    const res = await api.post('/senders', senderData);
    return res.data.sender;
  },
};

export const emailService = {
  scheduleEmails: async (params: {
    senderId: string;
    subject: string;
    body: string;
    recipients: string[];
    startTime?: string;
    delayBetweenEmailsMs?: number;
    hourlyLimit?: number;
  }) => {
    const res = await api.post('/emails/schedule', params);
    return res.data;
  },
  getScheduledEmails: async (page = 1, limit = 50) => {
    const res = await api.get(`/emails/scheduled?page=${page}&limit=${limit}`);
    return res.data;
  },
  getSentEmails: async (page = 1, limit = 50) => {
    const res = await api.get(`/emails/sent?page=${page}&limit=${limit}`);
    return res.data;
  },
};
