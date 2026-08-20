'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '../components/Header';
import { ScheduledTable } from '../components/ScheduledTable';
import { SentTable } from '../components/SentTable';
import { ComposeModal } from '../components/ComposeModal';
import { SendersModal } from '../components/SendersModal';
import { authService, senderService, emailService, UserProfile, Sender, EmailRecord } from '../services/api';
import { Plus, Users, Clock, Send, Shield, Zap, Sparkles } from 'lucide-react';

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

  // Initialize auth check & dev auto-login fallback for immediate demonstration
  const checkAuth = useCallback(async () => {
    try {
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
    } catch {
      // Auto-trigger dev login so user can immediately test dashboard
      try {
        const devRes = await authService.devLogin();
        localStorage.setItem('reachinbox_jwt_token', devRes.token);
        setUser(devRes.user);
      } catch (e) {
        console.error('Auto auth error:', e);
      }
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
      // Auto-poll queue status every 4 seconds for live worker updates
      const interval = setInterval(() => {
        fetchScheduled();
        fetchSent();
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [user, refreshAllData, fetchScheduled, fetchSent]);

  const handleLogout = () => {
    localStorage.removeItem('reachinbox_jwt_token');
    setUser(null);
  };

  const handleOpenGoogleLogin = async () => {
    try {
      const url = await authService.getGoogleAuthUrl();
      window.location.href = url;
    } catch (e) {
      alert('Google OAuth requires GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET. Using Quick Dev Login.');
      handleDevLogin();
    }
  };

  const handleDevLogin = async () => {
    try {
      const res = await authService.devLogin();
      localStorage.setItem('reachinbox_jwt_token', res.token);
      setUser(res.user);
      refreshAllData();
    } catch (e: any) {
      alert(`Dev Login failed: ${e.message}`);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-drafting-grid flex items-center justify-center font-mono text-[#1F2736]">
        <div className="p-8 bg-[#F7F1EB] border-blueprint text-center">
          <div className="w-10 h-10 border-4 border-[#1F2736] border-t-transparent animate-spin mx-auto mb-4" />
          <p className="font-bold text-sm">INITIALIZING EMAIL SCHEDULING SYSTEM...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-drafting-grid text-[#1F2736]">
      {/* Top Navigation Header */}
      <Header
        user={user}
        onLogout={handleLogout}
        onOpenGoogleLogin={handleOpenGoogleLogin}
        onDevLogin={handleDevLogin}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8">
        {/* Metric Summary Cards Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-[#F7F1EB] border-blueprint p-5 flex items-center justify-between">
            <div>
              <span className="text-xs font-mono font-bold uppercase text-[#445166]">
                SCHEDULED IN QUEUE
              </span>
              <div className="text-3xl font-bold font-serif-display text-[#1F2736] mt-1">
                {scheduledEmails.length}
              </div>
            </div>
            <div className="p-3 bg-[#E8DDD3] border-blueprint-sm">
              <Clock className="w-6 h-6 text-[#1F2736]" />
            </div>
          </div>

          <div className="bg-[#F7F1EB] border-blueprint p-5 flex items-center justify-between">
            <div>
              <span className="text-xs font-mono font-bold uppercase text-[#445166]">
                COMPLETED DELIVERIES
              </span>
              <div className="text-3xl font-bold font-serif-display text-[#D63A35] mt-1">
                {sentEmails.filter((e) => e.status === 'SENT').length}
              </div>
            </div>
            <div className="p-3 bg-[#E8DDD3] border-blueprint-sm">
              <Send className="w-6 h-6 text-[#D63A35]" />
            </div>
          </div>

          <div className="bg-[#F7F1EB] border-blueprint p-5 flex items-center justify-between">
            <div>
              <span className="text-xs font-mono font-bold uppercase text-[#445166]">
                ACTIVE SENDERS
              </span>
              <div className="text-3xl font-bold font-serif-display text-[#1F2736] mt-1">
                {senders.length}
              </div>
            </div>
            <button
              onClick={() => setIsSendersOpen(true)}
              className="p-3 bg-[#E8DDD3] hover:bg-[#D63A35] hover:text-white transition-colors border-blueprint-sm cursor-pointer"
              title="Manage Senders"
            >
              <Users className="w-6 h-6" />
            </button>
          </div>

          <div className="bg-[#F7F1EB] border-blueprint p-5 flex items-center justify-between">
            <div>
              <span className="text-xs font-mono font-bold uppercase text-[#445166]">
                SCHEDULER ENGINE
              </span>
              <div className="text-sm font-bold font-mono text-emerald-800 mt-1 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-ping inline-block" />
                BULLMQ READY
              </div>
            </div>
            <div className="p-3 bg-[#E8DDD3] border-blueprint-sm">
              <Zap className="w-6 h-6 text-[#1F2736]" />
            </div>
          </div>
        </div>

        {/* Primary Action Controls Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-6">
          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 bg-[#E8DDD3] p-1.5 border-blueprint-sm">
            <button
              onClick={() => setActiveTab('scheduled')}
              className={`px-5 py-2.5 font-mono text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'scheduled'
                  ? 'bg-[#1F2736] text-[#F3ECE5] border-blueprint-sm'
                  : 'text-[#1F2736] hover:bg-[#F3ECE5]'
              }`}
            >
              SCHEDULED QUEUE ({scheduledEmails.length})
            </button>
            <button
              onClick={() => setActiveTab('sent')}
              className={`px-5 py-2.5 font-mono text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'sent'
                  ? 'bg-[#1F2736] text-[#F3ECE5] border-blueprint-sm'
                  : 'text-[#1F2736] hover:bg-[#F3ECE5]'
              }`}
            >
              SENT RECEIPTS ({sentEmails.length})
            </button>
          </div>

          {/* Primary Call to Action */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSendersOpen(true)}
              className="px-4 py-2.5 bg-[#E8DDD3] text-[#1F2736] font-mono font-bold text-xs border-blueprint-interactive flex items-center gap-2 cursor-pointer"
            >
              <Users className="w-4 h-4" />
              CONFIGURE SENDERS
            </button>

            <button
              onClick={() => setIsComposeOpen(true)}
              className="px-6 py-2.5 bg-[#D63A35] text-white font-mono font-bold text-xs border-blueprint-interactive flex items-center gap-2 cursor-pointer hover:bg-[#E86A65]"
            >
              <Plus className="w-4 h-4" />
              COMPOSE NEW EMAIL
            </button>
          </div>
        </div>

        {/* Dynamic Tab Views */}
        {activeTab === 'scheduled' ? (
          <ScheduledTable
            emails={scheduledEmails}
            loading={loadingScheduled}
            onRefresh={fetchScheduled}
          />
        ) : (
          <SentTable
            emails={sentEmails}
            loading={loadingSent}
            onRefresh={fetchSent}
          />
        )}
      </main>

      {/* Modals */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        senders={senders}
        onSuccess={refreshAllData}
      />

      <SendersModal
        isOpen={isSendersOpen}
        onClose={() => setIsSendersOpen(false)}
        senders={senders}
        onSenderCreated={refreshAllData}
      />

      {/* Footer */}
      <footer className="w-full bg-[#1F232B] text-[#F3ECE5] border-t-4 border-[#1F2736] py-6 px-8 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 font-mono text-xs">
          <div>
            <span className="font-bold text-[#D63A35]">REACHINBOX</span> // ARCHITECTURAL SCHEDULING SYSTEM
          </div>
          <div className="text-[#798392]">
            BullMQ Persistent Queues • Redis Hourly Counters • Nodemailer Ethereal SMTP
          </div>
        </div>
      </footer>
    </div>
  );
}
