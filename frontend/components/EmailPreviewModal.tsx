'use client';

import React from 'react';
import { EmailRecord } from '../services/api';
import { X, Mail, CheckCircle2, AlertTriangle, ExternalLink, Calendar, User } from 'lucide-react';

interface EmailPreviewModalProps {
  isOpen: boolean;
  email: EmailRecord | null;
  onClose: () => void;
}

export const EmailPreviewModal: React.FC<EmailPreviewModalProps> = ({
  isOpen,
  email,
  onClose,
}) => {
  if (!isOpen || !email) return null;

  const isRealEtherealUrl = email.etherealPreviewUrl && !email.etherealPreviewUrl.includes('/message/simulated-');

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content max-w-2xl p-6 md:p-8" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
              <Mail size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Sent Email Details</h2>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Message ID: {email.id}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        {/* Email Metadata Grid */}
        <div className="py-4 space-y-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
              <User size={14} />
              <span className="font-semibold">From:</span>
              <span>{email.sender?.displayName || 'ReachInbox Sender'} ({email.sender?.email || 'outreach@reachinbox.ai'})</span>
            </div>
            <div>
              {email.status === 'SENT' ? (
                <span className="badge badge-sent flex items-center gap-1">
                  <CheckCircle2 size={12} /> Delivered
                </span>
              ) : (
                <span className="badge badge-failed flex items-center gap-1">
                  <AlertTriangle size={12} /> Failed
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <Mail size={14} />
            <span className="font-semibold">To:</span>
            <span className="font-medium text-gray-900">{email.recipient}</span>
          </div>

          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <Calendar size={14} />
            <span className="font-semibold">Sent At:</span>
            <span>{email.sentAt ? new Date(email.sentAt).toLocaleString() : new Date(email.scheduledAt).toLocaleString()}</span>
          </div>
        </div>

        {/* Subject Header */}
        <div className="py-3 px-4 my-4 rounded-lg" style={{ background: 'var(--bg-hover)' }}>
          <div className="text-xs uppercase font-semibold mb-1" style={{ color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Subject</div>
          <div className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>{email.subject}</div>
        </div>

        {/* Email Body Content */}
        <div className="mb-6">
          <div className="text-xs uppercase font-semibold mb-2" style={{ color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Message Content</div>
          <div
            className="p-4 rounded-lg text-sm overflow-y-auto max-h-60 leading-relaxed font-sans"
            style={{ background: '#fff', border: '1px solid var(--border)', color: '#1f2937' }}
          >
            {email.body.split('\n').map((paragraph, index) => (
              <p key={index} className="mb-2 last:mb-0">
                {paragraph}
              </p>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2">
          {email.etherealPreviewUrl ? (
            <a
              href={email.etherealPreviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 btn-outline text-xs"
              style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}
            >
              <ExternalLink size={14} />
              Open Ethereal Mailbox Page
            </a>
          ) : (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              In-App Preview Active
            </span>
          )}

          <button onClick={onClose} className="btn-primary text-xs px-5 py-2">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
