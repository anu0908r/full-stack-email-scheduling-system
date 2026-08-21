'use client';

import React from 'react';
import { EmailRecord } from '../services/api';
import { Clock, RefreshCw, Calendar } from 'lucide-react';

interface ScheduledTableProps {
  emails: EmailRecord[];
  loading: boolean;
  onRefresh: () => void;
}

export const ScheduledTable: React.FC<ScheduledTableProps> = ({
  emails,
  loading,
  onRefresh,
}) => {
  return (
    <div className="card overflow-hidden">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5" style={{ borderBottom: '1px solid var(--border)' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Scheduled Emails</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{emails.length} emails in queue</p>
        </div>
        <button onClick={onRefresh} className="btn-outline flex items-center gap-2 text-sm" style={{ padding: '8px 14px' }}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="py-16 text-center" style={{ color: 'var(--text-muted)' }}>
          <div className="spinner mx-auto mb-3" />
          <p className="text-sm">Loading scheduled emails...</p>
        </div>
      ) : emails.length === 0 ? (
        <div className="py-16 text-center px-4">
          <Clock size={40} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>No scheduled emails</h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Click "Compose" to schedule your first campaign.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left" style={{ fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-hover)' }}>
                <th className="px-5 py-3 font-semibold" style={{ color: 'var(--text-secondary)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recipient</th>
                <th className="px-5 py-3 font-semibold" style={{ color: 'var(--text-secondary)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Subject</th>
                <th className="px-5 py-3 font-semibold" style={{ color: 'var(--text-secondary)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Scheduled</th>
                <th className="px-5 py-3 font-semibold" style={{ color: 'var(--text-secondary)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {emails.map((email) => {
                const date = new Date(email.scheduledAt);
                const isPast = date.getTime() <= Date.now();

                return (
                  <tr key={email.id} className="transition-colors" style={{ borderTop: '1px solid var(--border)' }}>
                    <td className="px-5 py-3.5 font-medium" style={{ color: 'var(--text-primary)' }}>{email.recipient}</td>
                    <td className="px-5 py-3.5 truncate max-w-xs" style={{ color: 'var(--text-secondary)' }}>{email.subject}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                        <Calendar size={14} />
                        <span>{date.toLocaleString()}</span>
                        {isPast && (
                          <span className="badge badge-processing" style={{ marginLeft: 4 }}>Due now</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`badge ${email.status === 'PROCESSING' ? 'badge-processing' : 'badge-scheduled'}`}>
                        {email.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
