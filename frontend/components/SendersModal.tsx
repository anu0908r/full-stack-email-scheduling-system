'use client';

import React, { useState } from 'react';
import { Sender, senderService } from '../services/api';
import { X, Plus, Users, Trash2 } from 'lucide-react';

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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddSender = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!email || !displayName) {
      setError('Email and Display Name are required.');
      return;
    }

    setLoading(true);
    try {
      await senderService.createSender({ email, displayName, hourlyLimit });
      setEmail('');
      setDisplayName('');
      setHourlyLimit(200);
      setSuccess('Sender created successfully.');
      onSenderCreated();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSender = async (id: string, name: string) => {
    if (!confirm(`Delete sender "${name}"? This cannot be undone.`)) return;
    setDeletingId(id);
    setError(null);
    setSuccess(null);
    try {
      await senderService.deleteSender(id);
      setSuccess('Sender deleted.');
      onSenderCreated();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content p-6 md:p-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Users size={20} style={{ color: 'var(--accent)' }} />
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Manage Senders</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg text-sm mb-4" style={{ background: 'var(--danger-light)', color: '#991b1b' }}>
            {error}
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 p-3 rounded-lg text-sm mb-4" style={{ background: 'var(--success-light)', color: '#166534' }}>
            {success}
          </div>
        )}

        {senders.length > 0 ? (
          <div className="mb-6">
            <h4 className="label">Active Senders ({senders.length})</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {senders.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--bg-hover)' }}>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium" style={{ color: 'var(--text-primary)', fontSize: 13 }}>{s.displayName}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 12, marginLeft: 8 }}>{s.email}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                      {s.hourlyLimit}/hr
                    </span>
                    <button
                      onClick={() => handleDeleteSender(s.id, s.displayName)}
                      disabled={deletingId === s.id}
                      className="p-1.5 rounded-lg transition-colors"
                      style={{ color: 'var(--danger)' }}
                      title="Delete sender"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mb-6 p-4 text-center rounded-lg border border-dashed" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', fontSize: 13 }}>
            No senders configured yet. Add your sender account details below.
          </div>
        )}

        <form onSubmit={handleAddSender} className="space-y-4" style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <h4 className="label">Add New Sender</h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Display Name</label>
              <input type="text" placeholder="e.g. Outreach Team" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" placeholder="e.g. outreach@company.com" value={email} onChange={(e) => setEmail(e.target.value)} className="input-field" />
            </div>
          </div>

          <div>
            <label className="label">Hourly Limit</label>
            <input type="number" min="1" max="10000" value={hourlyLimit} onChange={(e) => setHourlyLimit(parseInt(e.target.value, 10) || 200)} className="input-field" />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-outline">Close</button>
            <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2">
              {loading ? <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <Plus size={14} />}
              Add Sender
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
