'use client';

import React, { useState } from 'react';
import { Sender, senderService } from '../services/api';
import { X, Plus, Users, Shield, Check } from 'lucide-react';

interface SendersModalProps {
  isOpen: boolean;
  onClose: () => void;
  senders: Sender[];
  onSenderCreated: () => void;
}

export const SendersModal: React.FC<SendersModalProps> = ({
  isOpen,
  onClose,
  senders,
  onSenderCreated,
}) => {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [hourlyLimit, setHourlyLimit] = useState(200);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddSender = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !displayName) {
      setError('Email and Display Name are required.');
      return;
    }

    setLoading(true);
    try {
      await senderService.createSender({
        email,
        displayName,
        hourlyLimit,
      });
      setEmail('');
      setDisplayName('');
      onSenderCreated();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#1F2736]/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#F7F1EB] border-blueprint w-full max-w-2xl relative p-6 md:p-8">
        <div className="flex items-center justify-between border-b-4 border-[#1F2736] pb-4 mb-6">
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-[#D63A35]" />
            <h2 className="text-2xl font-bold font-serif-display text-[#1F2736]">
              MANAGE SENDER ACCOUNTS
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-[#1F2736] text-white hover:bg-[#D63A35] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border-2 border-red-600 text-red-800 text-xs font-mono">
            {error}
          </div>
        )}

        {/* Existing Senders List */}
        <div className="mb-6">
          <h4 className="text-xs font-mono font-bold uppercase text-[#1F2736] mb-2">
            ACTIVE SENDERS ({senders.length})
          </h4>
          <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
            {senders.map((s) => (
              <div
                key={s.id}
                className="p-3 bg-[#E8DDD3] border-2 border-[#1F2736] flex items-center justify-between font-mono text-xs"
              >
                <div>
                  <span className="font-bold text-[#1F2736]">{s.displayName}</span>
                  <span className="text-[#445166] ml-2">({s.email})</span>
                </div>
                <span className="bg-[#1F2736] text-[#F3ECE5] px-2 py-0.5 text-[10px] font-bold">
                  LIMIT: {s.hourlyLimit}/HR
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Add Sender Form */}
        <form onSubmit={handleAddSender} className="border-t-2 border-[#1F2736] pt-4 space-y-4">
          <h4 className="text-xs font-mono font-bold uppercase text-[#1F2736] flex items-center gap-1">
            <Plus className="w-4 h-4 text-[#D63A35]" /> ADD NEW SENDER IDENTITY
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-mono font-bold uppercase text-[#1F2736] mb-1">
                DISPLAY NAME
              </label>
              <input
                type="text"
                placeholder="e.g. Outreach Team Alpha"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-[#F3ECE5] border-2 border-[#1F2736] p-2 font-mono text-xs focus:outline-none focus:border-[#D63A35]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono font-bold uppercase text-[#1F2736] mb-1">
                SENDER EMAIL
              </label>
              <input
                type="email"
                placeholder="e.g. alpha@reachinbox.ai"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#F3ECE5] border-2 border-[#1F2736] p-2 font-mono text-xs focus:outline-none focus:border-[#D63A35]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono font-bold uppercase text-[#1F2736] mb-1">
              HOURLY LIMIT
            </label>
            <input
              type="number"
              value={hourlyLimit}
              onChange={(e) => setHourlyLimit(parseInt(e.target.value, 10) || 200)}
              className="w-full bg-[#F3ECE5] border-2 border-[#1F2736] p-2 font-mono text-xs focus:outline-none focus:border-[#D63A35]"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#E8DDD3] text-[#1F2736] font-mono text-xs font-bold border-blueprint-interactive cursor-pointer"
            >
              CLOSE
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-[#D63A35] text-white font-mono text-xs font-bold border-blueprint-interactive flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4" /> ADD SENDER
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
