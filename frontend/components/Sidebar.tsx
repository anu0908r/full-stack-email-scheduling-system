'use client';

import React from 'react';
import { UserProfile } from '../services/api';
import { Mail, PenSquare, Users, Clock, Send, LogOut } from 'lucide-react';

interface SidebarProps {
  user: UserProfile;
  activeTab: 'scheduled' | 'sent';
  scheduledCount: number;
  sentCount: number;
  onTabChange: (tab: 'scheduled' | 'sent') => void;
  onCompose: () => void;
  onSenders: () => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  user,
  activeTab,
  scheduledCount,
  sentCount,
  onTabChange,
  onCompose,
  onSenders,
  onLogout,
}) => {
  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-3" style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <Mail size={20} style={{ color: 'var(--accent)' }} />
          <span style={{ fontWeight: 700, fontSize: 16 }}>ReachInbox</span>
        </div>
        <button onClick={onLogout} style={{ color: 'var(--text-muted)' }}>
          <LogOut size={18} />
        </button>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-64 flex-col z-20" style={{ background: 'var(--bg-card)', borderRight: '1px solid var(--border)' }}>
        {/* Logo */}
        <div className="px-5 py-5 flex items-center gap-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent)' }}>
            <Mail size={16} color="white" />
          </div>
          <span style={{ fontWeight: 700, fontSize: 17, color: 'var(--text-primary)' }}>ReachInbox</span>
        </div>

        {/* User info */}
        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3">
            {user.avatar ? (
              <img src={user.avatar} alt={user.name} className="w-9 h-9 rounded-full object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold" style={{ background: 'var(--accent)' }}>
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }} className="truncate">{user.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }} className="truncate">{user.email}</div>
            </div>
          </div>
        </div>

        {/* Compose button */}
        <div className="px-5 py-4">
          <button
            onClick={onCompose}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-semibold text-sm transition-colors"
            style={{ background: 'transparent', color: 'var(--accent)', border: `1.5px solid var(--accent)` }}
          >
            <PenSquare size={16} />
            Compose
          </button>
        </div>

        {/* Navigation */}
        <nav className="px-3 flex-1">
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '8px 12px' }}>
            Core
          </div>

          <button
            onClick={() => onTabChange('scheduled')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: activeTab === 'scheduled' ? 'var(--accent-light)' : 'transparent',
              color: activeTab === 'scheduled' ? 'var(--accent)' : 'var(--text-secondary)',
            }}
          >
            <Clock size={18} />
            <span className="flex-1 text-left">Scheduled</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: activeTab === 'scheduled' ? 'var(--accent)' : 'var(--bg-hover)', color: activeTab === 'scheduled' ? 'white' : 'var(--text-muted)' }}>
              {scheduledCount}
            </span>
          </button>

          <button
            onClick={() => onTabChange('sent')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: activeTab === 'sent' ? 'var(--accent-light)' : 'transparent',
              color: activeTab === 'sent' ? 'var(--accent)' : 'var(--text-secondary)',
            }}
          >
            <Send size={18} />
            <span className="flex-1 text-left">Sent</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: activeTab === 'sent' ? 'var(--accent)' : 'var(--bg-hover)', color: activeTab === 'sent' ? 'white' : 'var(--text-muted)' }}>
              {sentCount}
            </span>
          </button>
        </nav>

        {/* Bottom actions */}
        <div className="px-3 py-4" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            onClick={onSenders}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >
            <Users size={18} />
            Senders
          </button>

          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
};
