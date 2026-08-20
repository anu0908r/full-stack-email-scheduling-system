'use client';

import React, { useState } from 'react';
import { Sender, emailService } from '../services/api';
import { Upload, X, CheckCircle2, AlertTriangle, Clock, Zap, Mail, FileText } from 'lucide-react';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  senders: Sender[];
  onSuccess: () => void;
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

  if (!isOpen) return null;

  // Real-time recipient detection and validation
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

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setLeadText((prev) => (prev ? `${prev}\n${text}` : text));
      }
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const activeSenderId = selectedSenderId || senders[0]?.id;

    if (!activeSenderId) {
      setErrorMsg('No sender account selected.');
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
      setErrorMsg('Please upload a valid CSV or enter at least one valid recipient email.');
      return;
    }

    setLoading(true);

    try {
      await emailService.scheduleEmails({
        senderId: activeSenderId,
        subject: subject.trim(),
        body: body.trim(),
        recipients: validRecipients,
        startTime: startTime ? new Date(startTime).toISOString() : undefined,
        delayBetweenEmailsMs: delaySeconds * 1000,
        hourlyLimit,
      });

      setSuccessMsg(`Successfully scheduled campaign with ${validRecipients.length} recipients!`);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || err.message || 'Failed to schedule campaign');
    } finally {
      setLoading(false);
    }
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
            onClick={onClose}
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
          {/* Sender & Start Time Grid */}
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
                    {s.displayName} ({s.email}) — Limit: {s.hourlyLimit}/hr
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono font-bold uppercase text-[#1F2736] mb-1.5 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> START TIME (OPTIONAL — DEFAULT IMMEDIATE)
              </label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-[#F3ECE5] border-2 border-[#1F2736] p-2 font-mono text-sm focus:outline-none focus:border-[#D63A35]"
              />
            </div>
          </div>

          {/* Subject & Throttling Parameters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
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

            <div className="md:col-span-1">
              <label className="block text-xs font-mono font-bold uppercase text-[#1F2736] mb-1.5">
                HOURLY LIMIT (MAX / HR)
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

            <div className="md:col-span-1 flex items-end">
              <div className="bg-[#E8DDD3] p-2.5 border-2 border-[#1F2736] w-full text-xs font-mono text-[#445166]">
                Per-Sender Rate Limiting backed by Redis INCR.
              </div>
            </div>
          </div>

          {/* Email Subject */}
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

          {/* Lead List File Upload & Recipient Parsing */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-mono font-bold uppercase text-[#1F2736] flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-[#D63A35]" /> RECIPIENTS / LEAD FILE (CSV OR TEXT)
              </label>

              <label className="cursor-pointer bg-[#1F2736] text-[#F3ECE5] hover:bg-[#D63A35] transition-colors text-xs font-mono font-bold px-3 py-1 border-blueprint-sm flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5" /> UPLOAD CSV / TXT
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            <textarea
              rows={4}
              placeholder="Paste email addresses here (one per line or comma separated), or upload a CSV file above..."
              value={leadText}
              onChange={(e) => setLeadText(e.target.value)}
              className="w-full bg-[#F3ECE5] border-2 border-[#1F2736] p-3 font-mono text-sm focus:outline-none focus:border-[#D63A35]"
            />

            {/* Recipient Validation Breakdown Pill */}
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 p-2.5 bg-[#E8DDD3] border-2 border-[#1F2736] font-mono text-xs">
              <div className="flex items-center gap-4">
                <span className="font-bold text-[#1F2736]">
                  TOTAL DETECTED: <span className="bg-[#1F2736] text-white px-1.5 py-0.5">{rawList.length}</span>
                </span>
                <span className="font-bold text-emerald-700">
                  VALID UNIQUE: <span className="bg-emerald-700 text-white px-1.5 py-0.5">{validRecipients.length}</span>
                </span>
                {invalidRecipients.length > 0 && (
                  <span className="font-bold text-[#D63A35]">
                    INVALID ROWS: <span className="bg-[#D63A35] text-white px-1.5 py-0.5">{invalidRecipients.length}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Email Body */}
          <div>
            <label className="block text-xs font-mono font-bold uppercase text-[#1F2736] mb-1.5">
              EMAIL BODY CONTENT *
            </label>
            <textarea
              rows={5}
              placeholder="Hi {{name}},\n\nWe noticed your team is building email infrastructure..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full bg-[#F3ECE5] border-2 border-[#1F2736] p-3 font-mono text-sm focus:outline-none focus:border-[#D63A35]"
            />
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t-2 border-[#1F2736]">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-[#E8DDD3] text-[#1F2736] font-mono font-bold text-xs border-blueprint-interactive cursor-pointer"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-[#D63A35] text-white font-mono font-bold text-xs border-blueprint-interactive flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin" />
                  SCHEDULING JOBS...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4" />
                  SCHEDULE {validRecipients.length} EMAILS
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
