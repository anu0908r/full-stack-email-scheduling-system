'use client';

import React, { useState, useRef } from 'react';
import { Sender, emailService, ScheduleResponse } from '../services/api';
import { parseLeadFileContent } from '../utils/csvParser';
import { Upload, X, CheckCircle2, AlertTriangle, Clock, Zap, Mail, FileText } from 'lucide-react';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_RECIPIENTS = 5000;

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  senders: Sender[];
  onSuccess: (result: ScheduleResponse) => void;
}

export const ComposeModal: React.FC<ComposeModalProps> = ({
  isOpen,
  onClose,
  senders,
  onSuccess,
}) => {
  const [selectedSenderId, setSelectedSenderId] = useState<string>(senders[0]?.id || '');
  const [subject, setSubject] = useState<string>('');
  const [body, setBody] = useState<string>('');
  const [leadText, setLeadText] = useState<string>('');
  const [sendAfterSeconds, setSendAfterSeconds] = useState<number>(60);
  const [delaySeconds, setDelaySeconds] = useState<number>(2);
  const [hourlyLimit, setHourlyLimit] = useState<number>(200);

  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const rawList = leadText.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);

  const validRecipientsSet = new Set<string>();
  const invalidRecipientsSet = new Set<string>();

  rawList.forEach((raw) => {
    const clean = raw.toLowerCase();
    if (emailRegex.test(clean)) {
      validRecipientsSet.add(clean);
    } else {
      invalidRecipientsSet.add(raw);
    }
  });

  const validRecipients = Array.from(validRecipientsSet);
  const invalidRecipients = Array.from(invalidRecipientsSet);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      setErrorMsg(`File too large (${Math.round(file.size / 1024 / 1024)}MB). Maximum is 5MB.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        const parsed = parseLeadFileContent(text);
        setLeadText((prev) => {
          const combined = prev ? `${prev}\n${parsed.validEmails.join('\n')}` : parsed.validEmails.join('\n');
          return combined;
        });
        if (parsed.invalidLines.length > 0) {
          setErrorMsg(`Skipped ${parsed.invalidLines.length} invalid row(s) from file.`);
          setTimeout(() => setErrorMsg(null), 4000);
        }
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const activeSenderId = selectedSenderId || senders[0]?.id;

    if (!activeSenderId) {
      setErrorMsg('No sender account available. Create a sender first.');
      return;
    }
    if (!subject.trim()) {
      setErrorMsg('Subject line is required.');
      return;
    }
    if (!body.trim()) {
      setErrorMsg('Email body content is required.');
      return;
    }
    if (validRecipients.length === 0) {
      setErrorMsg('Please upload a valid CSV/TXT or enter at least one valid recipient email.');
      return;
    }
    if (validRecipients.length > MAX_RECIPIENTS) {
      setErrorMsg(`Too many recipients (${validRecipients.length}). Maximum is ${MAX_RECIPIENTS}.`);
      return;
    }
    if (delaySeconds < 1) {
      setErrorMsg('Minimum delay between emails is 1 second.');
      return;
    }
    if (sendAfterSeconds < 0) {
      setErrorMsg('Send after must be 0 or more seconds.');
      return;
    }
    if (hourlyLimit < 1) {
      setErrorMsg('Hourly limit must be at least 1.');
      return;
    }

    setLoading(true);

    try {
      const computedStartTime = new Date(Date.now() + sendAfterSeconds * 1000).toISOString();
      const result = await emailService.scheduleEmails({
        senderId: activeSenderId,
        subject: subject.trim(),
        body: body.trim(),
        recipients: validRecipients,
        startTime: computedStartTime,
        delayBetweenEmailsMs: delaySeconds * 1000,
        hourlyLimit,
      });

      setSuccessMsg(`Campaign scheduled: ${result.data.scheduledEmails} emails queued.`);
      setTimeout(() => {
        onSuccess(result);
        onClose();
        resetForm();
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || err.message || 'Failed to schedule campaign');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSubject('');
    setBody('');
    setLeadText('');
    setSendAfterSeconds(60);
    setDelaySeconds(2);
    setHourlyLimit(200);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  return (
    <div className="modal-backdrop" onClick={() => { resetForm(); onClose(); }}>
      <div className="modal-content p-6 md:p-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Compose & Schedule</h2>
          <button onClick={() => { resetForm(); onClose(); }} className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        {errorMsg && (
          <div className="flex items-center gap-2 p-3 rounded-lg text-sm mb-4" style={{ background: 'var(--danger-light)', color: '#991b1b' }}>
            <AlertTriangle size={16} />
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="flex items-center gap-2 p-3 rounded-lg text-sm mb-4" style={{ background: 'var(--success-light)', color: '#166534' }}>
            <CheckCircle2 size={16} />
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 stagger-children">
          <div>
            <label className="label">Sender Account</label>
            <select value={selectedSenderId} onChange={(e) => setSelectedSenderId(e.target.value)} className="input-field">
              {senders.map((s) => (
                <option key={s.id} value={s.id}>{s.displayName} ({s.email})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Send After (seconds)</label>
              <input type="number" min="0" max="86400" value={sendAfterSeconds} onChange={(e) => setSendAfterSeconds(parseInt(e.target.value, 10) || 0)} className="input-field" />
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Delay before first email is sent</p>
            </div>
            <div>
              <label className="label">Delay Between Emails (seconds)</label>
              <input type="number" min="1" max="3600" value={delaySeconds} onChange={(e) => setDelaySeconds(parseInt(e.target.value, 10) || 1)} className="input-field" />
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Spacing between each email</p>
            </div>
            <div>
              <label className="label">Hourly Limit</label>
              <input type="number" min="1" max="10000" value={hourlyLimit} onChange={(e) => setHourlyLimit(parseInt(e.target.value, 10) || 200)} className="input-field" />
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Max emails per hour per sender</p>
            </div>
          </div>

          <div>
            <label className="label">Subject</label>
            <input type="text" placeholder="e.g. Scaling your outreach pipeline" value={subject} onChange={(e) => setSubject(e.target.value)} className="input-field" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="label" style={{ marginBottom: 0 }}>Recipients (CSV/TXT)</label>
              <label className="cursor-pointer flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors" style={{ color: 'var(--accent)', border: '1px solid var(--border)' }}>
                <Upload size={14} />
                Upload file
                <input ref={fileInputRef} type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
            <textarea rows={3} placeholder="Paste emails (one per line, comma, or semicolon separated)..." value={leadText} onChange={(e) => setLeadText(e.target.value)} className="input-field" style={{ fontFamily: 'monospace', fontSize: 13 }} />

            {rawList.length > 0 && (
              <div className="flex items-center gap-4 mt-2 text-xs">
                <span style={{ color: 'var(--text-secondary)' }}>
                  Detected: <strong>{rawList.length}</strong>
                </span>
                <span style={{ color: 'var(--success)' }}>
                  Valid: <strong>{validRecipients.length}</strong>
                </span>
                {invalidRecipients.length > 0 && (
                  <span style={{ color: 'var(--danger)' }}>
                    Invalid: <strong>{invalidRecipients.length}</strong>
                  </span>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="label">Email Body</label>
            <textarea rows={4} placeholder="Hi there,&#10;&#10;We noticed your team is building..." value={body} onChange={(e) => setBody(e.target.value)} className="input-field" style={{ fontFamily: 'monospace', fontSize: 13 }} />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
            <button type="button" onClick={() => { resetForm(); onClose(); }} className="btn-outline">
              Cancel
            </button>
            <button type="submit" disabled={loading || validRecipients.length === 0} className="btn-primary flex items-center gap-2">
              {loading ? (
                <>
                  <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                  Scheduling...
                </>
              ) : (
                <>
                  <Mail size={16} />
                  Schedule {validRecipients.length} email{validRecipients.length !== 1 ? 's' : ''}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
