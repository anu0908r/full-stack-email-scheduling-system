'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ScheduledTable } from '../components/ScheduledTable';
import { SentTable } from '../components/SentTable';
import { ComposeModal } from '../components/ComposeModal';
import { SendersModal } from '../components/SendersModal';
import { Sidebar } from '../components/Sidebar';
import { authService, senderService, emailService, UserProfile, Sender, EmailRecord, ScheduleResponse } from '../services/api';

export default function DashboardPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [senders, setSenders] = useState<Sender[]>([]);
  const [scheduledEmails, setScheduledEmails] = useState<EmailRecord[]>([]);
  const [sentEmails, setSentEmails] = useState<EmailRecord[]>([]);

  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [isComposeOpen, setIsComposeOpen] = useState<boolean>(false);
  const [isSendersOpen, setIsSendersOpen] = useState<boolean>(false);

  const [loadingScheduled, setLoadingScheduled] = useState<boolean>(false);
  const [loadingSent, setLoadingSent] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const checkAuth = useCallback(async () => {
    try {
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
    } catch {
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const fetchSenders = useCallback(async () => {
    try {
      const data = await senderService.listSenders();
      setSenders(data);
    } catch (e) {
      console.error('Error fetching senders:', e);
    }
  }, []);

  const fetchScheduled = useCallback(async () => {
    setLoadingScheduled(true);
    try {
      const res = await emailService.getScheduledEmails();
      setScheduledEmails(res.emails || []);
    } catch (e) {
      console.error('Error fetching scheduled emails:', e);
    } finally {
      setLoadingScheduled(false);
    }
  }, []);

  const fetchSent = useCallback(async () => {
    setLoadingSent(true);
    try {
      const res = await emailService.getSentEmails();
      setSentEmails(res.emails || []);
    } catch (e) {
      console.error('Error fetching sent emails:', e);
    } finally {
      setLoadingSent(false);
    }
  }, []);

  const refreshAllData = useCallback(() => {
    fetchSenders();
    fetchScheduled();
    fetchSent();
  }, [fetchSenders, fetchScheduled, fetchSent]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (user) {
      refreshAllData();
      const interval = setInterval(() => {
        fetchScheduled();
        fetchSent();
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [user, refreshAllData, fetchScheduled, fetchSent]);

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch {
      // Ignore
    }
    localStorage.removeItem('reachinbox_jwt_token');
    setUser(null);
  };

  const handleDevLogin = async () => {
    try {
      const res = await authService.devLogin();
      localStorage.setItem('reachinbox_jwt_token', res.token);
      setUser(res.user);
      refreshAllData();
      showToast('success', 'Signed in successfully.');
    } catch (e: any) {
      showToast('error', e.response?.data?.error || e.message || 'Dev login failed.');
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const url = await authService.getGoogleAuthUrl();
      window.location.href = url;
    } catch {
      showToast('error', 'Google OAuth unavailable. Check GOOGLE_CLIENT_ID in .env');
    }
  };

  const handleScheduleSuccess = (result: ScheduleResponse) => {
    refreshAllData();
    const msg = result.data.invalidCount > 0
      ? `Scheduled ${result.data.scheduledEmails} emails (${result.data.invalidCount} invalid recipients skipped).`
      : `Scheduled ${result.data.scheduledEmails} emails successfully.`;
    showToast('success', msg);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="text-center">
          <div className="spinner mx-auto mb-4" style={{ width: 32, height: 32, borderWidth: 3 }} />
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg-primary)' }}>
        <div className="card p-8 w-full max-w-md" style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)' }}>
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
            <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--text-primary)' }}>ReachInbox</span>
          </div>

          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Welcome back</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 32 }}>Sign in to schedule your campaigns.</p>

          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-lg font-semibold text-sm transition-colors"
            style={{ background: 'var(--accent-light)', color: 'var(--accent)', border: '1px solid var(--border)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Login with Google
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>or</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          <button
            onClick={handleDevLogin}
            className="btn-primary"
            style={{ width: '100%', padding: '14px 20px', fontSize: 16 }}
          >
            Sign In
          </button>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 16 }}>
            Quick sign-in without Google
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar
        user={user}
        activeTab={activeTab}
        scheduledCount={scheduledEmails.length}
        sentCount={sentEmails.filter(e => e.status === 'SENT').length}
        onTabChange={setActiveTab}
        onCompose={() => setIsComposeOpen(true)}
        onSenders={() => setIsSendersOpen(true)}
        onLogout={handleLogout}
      />

      <main className="flex-1 ml-0 md:ml-64 p-4 md:p-8 animate-fade-in">
        <div className="max-w-6xl mx-auto">
          {activeTab === 'scheduled' ? (
            <ScheduledTable emails={scheduledEmails} loading={loadingScheduled} onRefresh={fetchScheduled} />
          ) : (
            <SentTable emails={sentEmails} loading={loadingSent} onRefresh={fetchSent} />
          )}
        </div>
      </main>

      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        senders={senders}
        onSuccess={handleScheduleSuccess}
      />

      <SendersModal
        isOpen={isSendersOpen}
        onClose={() => setIsSendersOpen(false)}
        senders={senders}
        onSenderCreated={refreshAllData}
      />

      {toast && (
        <div
          className="toast fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg"
          style={{
            background: toast.type === 'success' ? 'var(--success-light)' : 'var(--danger-light)',
            color: toast.type === 'success' ? '#166534' : '#991b1b',
            border: `1px solid ${toast.type === 'success' ? 'var(--success)' : 'var(--danger)'}`,
          }}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
