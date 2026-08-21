'use client';

import React from 'react';
import { EmailRecord } from '../services/api';
import { ExternalLink, CheckCircle2, AlertTriangle, RefreshCw, Mail, Trash2 } from 'lucide-react';

interface SentTableProps {
  emails: EmailRecord[];
  loading: boolean;
  onRefresh: () => void;
  onDeleteEmail?: (id: string) => void;
  onClearAll?: () => void;
}

export const SentTable: React.FC<SentTableProps> = ({
  emails,
  loading,
  onRefresh,
  onDeleteEmail,
  onClearAll,
}) => {
  return (
    <div className="card overflow-hidden">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5" style={{ borderBottom: '1px solid var(--border)' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Sent Emails</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{emails.filter(e => e.status === 'SENT').length} delivered</p>
        </div>
        <div className="flex items-center gap-2">
          {emails.length > 0 && onClearAll && (
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to clear all sent/failed email history?')) {
                  onClearAll();
                }
              }}
              className="btn-outline flex items-center gap-1.5 text-xs text-red-600 hover:bg-red-50"
              style={{ padding: '8px 12px', borderColor: 'rgba(239, 68, 68, 0.3)' }}
            >
              <Trash2 size={14} />
              Clear History
            </button>
          )}
          <button onClick={onRefresh} className="btn-outline flex items-center gap-2 text-sm" style={{ padding: '8px 14px' }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center" style={{ color: 'var(--text-muted)' }}>
          <div className="spinner mx-auto mb-3" />
          <p className="text-sm">Loading sent emails...</p>
        </div>
      ) : emails.length === 0 ? (
        <div className="py-16 text-center px-4">
          <Mail size={40} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>No emails sent yet</h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Scheduled emails will appear here once processed by BullMQ workers.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left" style={{ fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-hover)' }}>
                <th className="px-5 py-3 font-semibold" style={{ color: 'var(--text-secondary)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recipient</th>
                <th className="px-5 py-3 font-semibold" style={{ color: 'var(--text-secondary)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Subject</th>
                <th className="px-5 py-3 font-semibold" style={{ color: 'var(--text-secondary)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sent At</th>
                <th className="px-5 py-3 font-semibold" style={{ color: 'var(--text-secondary)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                <th className="px-5 py-3 font-semibold" style={{ color: 'var(--text-secondary)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Preview</th>
                <th className="px-5 py-3 font-semibold text-right" style={{ color: 'var(--text-secondary)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actions</th>
              </tr>
            </thead>
            <tbody className="stagger-children">
              {emails.map((email) => (
                <tr key={email.id} className="transition-colors" style={{ borderTop: '1px solid var(--border)' }}>
                  <td className="px-5 py-3.5 font-medium" style={{ color: 'var(--text-primary)' }}>{email.recipient}</td>
                  <td className="px-5 py-3.5 truncate max-w-xs" style={{ color: 'var(--text-secondary)' }}>{email.subject}</td>
                  <td className="px-5 py-3.5" style={{ color: 'var(--text-secondary)' }}>
                    {email.sentAt ? new Date(email.sentAt).toLocaleString() : 'N/A'}
                  </td>
                  <td className="px-5 py-3.5">
                    {email.status === 'SENT' ? (
                      <span className="badge badge-sent flex items-center gap-1">
                        <CheckCircle2 size={12} /> Sent
                      </span>
                    ) : (
                      <span className="badge badge-failed flex items-center gap-1">
                        <AlertTriangle size={12} /> Failed
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    {email.etherealPreviewUrl ? (
                      <a
                        href={email.etherealPreviewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                        style={{ color: 'var(--accent)', border: '1px solid var(--border)' }}
                      >
                        View email
                        <ExternalLink size={12} />
                      </a>
                    ) : email.errorMessage ? (
                      <span className="text-xs truncate max-w-xs block" style={{ color: 'var(--danger)' }} title={email.errorMessage}>
                        {email.errorMessage}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {onDeleteEmail && (
                      <button
                        onClick={() => {
                          if (window.confirm(`Delete record for ${email.recipient}?`)) {
                            onDeleteEmail(email.id);
                          }
                        }}
                        className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                        title="Delete email"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
