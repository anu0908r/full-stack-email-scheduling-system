'use client';

import React, { useState, useRef } from 'react';
import { Sender, emailService, ScheduleResponse } from '../services/api';
import { parseLeadFileContent } from '../utils/csvParser';
import { Upload, X, CheckCircle2, AlertTriangle, Clock, Zap, Mail, FileText } from 'lucide-react';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
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
  const [startTime, setStartTime] = useState<string>('');
  const [delaySeconds, setDelaySeconds] = useState<number>(2);
  const [hourlyLimit, setHourlyLimit] = useState<number>(200);

  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const rawList = leadText
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

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
      setErrorMsg('Minimum delay is 1 second.');
      return;
    }
    if (hourlyLimit < 1) {
      setErrorMsg('Hourly limit must be at least 1.');
      return;
    }

    setLoading(true);

    try {
      const result = await emailService.scheduleEmails({
        senderId: activeSenderId,
        subject: subject.trim(),
        body: body.trim(),
        recipients: validRecipients,
        startTime: startTime ? new Date(startTime).toISOString() : undefined,
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
    setStartTime('');
    setDelaySeconds(2);
    setHourlyLimit(200);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#1F2736]/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#F7F1EB] border-blueprint w-full max-w-3xl my-8 relative p-6 md:p-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b-4 border-[#1F2736] pb-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold font-serif-display text-[#1F2736]">
                COMPOSE & SCHEDULE CAMPAIGN
              </h2>
              <span className="bg-[#D63A35] text-white text-[10px] font-mono px-2 py-0.5 uppercase">
                BULLMQ DELAYED
              </span>
            </div>
            <p className="text-xs font-mono text-[#445166] mt-0.5">
              Configure batch parameters, lead lists, and per-sender throttling.
            </p>
          </div>
          <button
            onClick={() => { resetForm(); onClose(); }}
            className="p-2 bg-[#1F2736] text-white hover:bg-[#D63A35] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 bg-[#E86A65]/20 border-2 border-[#D63A35] text-[#D63A35] text-sm font-mono flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-6 p-4 bg-emerald-100 border-2 border-emerald-600 text-emerald-800 text-sm font-mono flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Sender & Start Time */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono font-bold uppercase text-[#1F2736] mb-1.5">
                SELECT SENDER ACCOUNT *
              </label>
              <select
                value={selectedSenderId}
                onChange={(e) => setSelectedSenderId(e.target.value)}
                className="w-full bg-[#F3ECE5] border-2 border-[#1F2736] p-2.5 font-mono text-sm focus:outline-none focus:border-[#D63A35]"
              >
                {senders.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.displayName} ({s.email}) — {s.hourlyLimit}/hr
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono font-bold uppercase text-[#1F2736] mb-1.5 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> START TIME (OPTIONAL)
              </label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-[#F3ECE5] border-2 border-[#1F2736] p-2 font-mono text-sm focus:outline-none focus:border-[#D63A35]"
              />
            </div>
          </div>

          {/* Throttling */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-mono font-bold uppercase text-[#1F2736] mb-1.5 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5" /> MIN DELAY (SEC)
              </label>
              <input
                type="number"
                min="1"
                max="3600"
                value={delaySeconds}
                onChange={(e) => setDelaySeconds(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-[#F3ECE5] border-2 border-[#1F2736] p-2.5 font-mono text-sm focus:outline-none focus:border-[#D63A35]"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-bold uppercase text-[#1F2736] mb-1.5">
                HOURLY LIMIT
              </label>
              <input
                type="number"
                min="1"
                max="10000"
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(parseInt(e.target.value, 10) || 200)}
                className="w-full bg-[#F3ECE5] border-2 border-[#1F2736] p-2.5 font-mono text-sm focus:outline-none focus:border-[#D63A35]"
              />
            </div>

            <div className="flex items-end">
              <div className="bg-[#E8DDD3] p-2.5 border-2 border-[#1F2736] w-full text-xs font-mono text-[#445166]">
                Per-sender. Redis-backed. Jobs rescheduled when limit hit.
              </div>
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs font-mono font-bold uppercase text-[#1F2736] mb-1.5">
              EMAIL SUBJECT *
            </label>
            <input
              type="text"
              placeholder="e.g. Scaling your outreach pipeline with AI"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full bg-[#F3ECE5] border-2 border-[#1F2736] p-2.5 font-mono text-sm focus:outline-none focus:border-[#D63A35]"
            />
          </div>

          {/* Recipients / CSV Upload */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-mono font-bold uppercase text-[#1F2736] flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-[#D63A35]" /> RECIPIENTS / LEAD FILE (CSV OR TXT)
              </label>
              <label className="cursor-pointer bg-[#1F2736] text-[#F3ECE5] hover:bg-[#D63A35] transition-colors text-xs font-mono font-bold px-3 py-1 border-blueprint-sm flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5" /> UPLOAD FILE
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            <textarea
              rows={4}
              placeholder="Paste emails here (one per line or comma-separated), or upload a CSV/TXT file above..."
              value={leadText}
              onChange={(e) => setLeadText(e.target.value)}
              className="w-full bg-[#F3ECE5] border-2 border-[#1F2736] p-3 font-mono text-sm focus:outline-none focus:border-[#D63A35]"
            />

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 p-2.5 bg-[#E8DDD3] border-2 border-[#1F2736] font-mono text-xs">
              <div className="flex items-center gap-4">
                <span className="font-bold text-[#1F2736]">
                  DETECTED: <span className="bg-[#1F2736] text-white px-1.5 py-0.5">{rawList.length}</span>
                </span>
                <span className="font-bold text-emerald-700">
                  VALID: <span className="bg-emerald-700 text-white px-1.5 py-0.5">{validRecipients.length}</span>
                </span>
                {invalidRecipients.length > 0 && (
                  <span className="font-bold text-[#D63A35]">
                    INVALID: <span className="bg-[#D63A35] text-white px-1.5 py-0.5">{invalidRecipients.length}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Body */}
          <div>
            <label className="block text-xs font-mono font-bold uppercase text-[#1F2736] mb-1.5">
              EMAIL BODY CONTENT *
            </label>
            <textarea
              rows={5}
              placeholder="Hi there,&#10;&#10;We noticed your team is building..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full bg-[#F3ECE5] border-2 border-[#1F2736] p-3 font-mono text-sm focus:outline-none focus:border-[#D63A35]"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t-2 border-[#1F2736]">
            <button
              type="button"
              onClick={() => { resetForm(); onClose(); }}
              className="px-5 py-2.5 bg-[#E8DDD3] text-[#1F2736] font-mono font-bold text-xs border-blueprint-interactive cursor-pointer"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={loading || validRecipients.length === 0}
              className="px-6 py-2.5 bg-[#D63A35] text-white font-mono font-bold text-xs border-blueprint-interactive flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin" />
                  SCHEDULING...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4" />
                  SCHEDULE {validRecipients.length} EMAIL{validRecipients.length !== 1 ? 'S' : ''}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
