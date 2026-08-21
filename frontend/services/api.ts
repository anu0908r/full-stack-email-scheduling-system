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

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const hadToken = localStorage.getItem('reachinbox_jwt_token');
      localStorage.removeItem('reachinbox_jwt_token');
      if (hadToken) {
        window.location.reload();
      }
    }
    return Promise.reject(error);
  }
);

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
  smtpHost?: string | null;
  smtpPort?: number | null;
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
  campaign?: { id: string; subject: string };
}

export interface ScheduleResponse {
  message: string;
  data: {
    campaign: { id: string; subject: string; status: string };
    recipientCount: number;
    invalidCount: number;
    invalidRecipients: string[];
    scheduledEmails: number;
  };
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
  logout: async () => {
    const res = await api.post('/auth/logout');
    return res.data;
  },
};

export const senderService = {
  listSenders: async (): Promise<Sender[]> => {
    const res = await api.get('/senders');
    return res.data.senders;
  },
  createSender: async (senderData: Partial<Sender> & { smtpUser?: string; smtpPass?: string }): Promise<Sender> => {
    const res = await api.post('/senders', senderData);
    return res.data.sender;
  },
  deleteSender: async (id: string): Promise<void> => {
    await api.delete(`/senders/${id}`);
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
  }): Promise<ScheduleResponse> => {
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
  getEmailById: async (id: string) => {
    const res = await api.get(`/emails/${id}`);
    return res.data.email;
  },
};
