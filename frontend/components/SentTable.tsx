'use client';

import React from 'react';
import { EmailRecord } from '../services/api';
import { ExternalLink, CheckCircle2, AlertTriangle, RefreshCw, Mail } from 'lucide-react';

interface SentTableProps {
  emails: EmailRecord[];
  loading: boolean;
  onRefresh: () => void;
}

export const SentTable: React.FC<SentTableProps> = ({
  emails,
  loading,
  onRefresh,
}) => {
  return (
    <div className="bg-[#F7F1EB] border-blueprint p-6 my-6">
      {/* Table Header Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 mb-4 border-b-4 border-[#1F2736]">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold font-serif-display text-[#1F2736]">
              SENT & PROCESSED EMAILS
            </h3>
            <span className="bg-[#D63A35] text-white text-xs font-mono font-bold px-2 py-0.5">
              {emails.length} COMPLETED
            </span>
          </div>
          <p className="text-xs font-mono text-[#445166] mt-0.5">
            Verified Nodemailer Ethereal SMTP delivery receipts.
          </p>
        </div>

        <button
          onClick={onRefresh}
          className="px-4 py-2 bg-[#E8DDD3] text-[#1F2736] font-mono text-xs font-bold border-blueprint-interactive flex items-center gap-2 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          REFRESH HISTORY
        </button>
      </div>

      {/* Table Content */}
      {loading ? (
        <div className="py-16 text-center font-mono text-sm text-[#445166] flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-4 border-[#1F2736] border-t-transparent animate-spin" />
          <span>FETCHING DELIVERED LOGS...</span>
        </div>
      ) : emails.length === 0 ? (
        <div className="py-16 text-center bg-[#E8DDD3]/40 border-2 border-dashed border-[#1F2736] p-8">
          <Mail className="w-10 h-10 text-[#798392] mx-auto mb-3" />
          <h4 className="text-lg font-bold font-serif-display text-[#1F2736]">
            NO EMAILS DELIVERED YET
          </h4>
          <p className="text-xs font-mono text-[#445166] mt-1">
            Once BullMQ workers process scheduled jobs, live send receipts and Ethereal preview links will appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs border-collapse">
            <thead>
              <tr className="bg-[#1F2736] text-[#F3ECE5] uppercase tracking-wider">
                <th className="p-3 border-r border-[#445166]">RECIPIENT</th>
                <th className="p-3 border-r border-[#445166]">SUBJECT</th>
                <th className="p-3 border-r border-[#445166]">SENT TIMESTAMP</th>
                <th className="p-3 border-r border-[#445166]">STATUS</th>
                <th className="p-3">ETHEREAL SMTP RECEIPT</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-[#1F2736]">
              {emails.map((email) => (
                <tr key={email.id} className="hover:bg-[#E8DDD3]/60 transition-colors">
                  <td className="p-3 font-bold text-[#1F2736] border-r-2 border-[#1F2736]">
                    {email.recipient}
                  </td>
                  <td className="p-3 text-[#1F2736] border-r-2 border-[#1F2736] max-w-xs truncate">
                    {email.subject}
                  </td>
                  <td className="p-3 text-[#445166] border-r-2 border-[#1F2736]">
                    {email.sentAt ? new Date(email.sentAt).toLocaleString() : 'N/A'}
                  </td>
                  <td className="p-3 border-r-2 border-[#1F2736]">
                    {email.status === 'SENT' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase bg-emerald-200 text-emerald-900 border border-emerald-700">
                        <CheckCircle2 className="w-3 h-3" /> SENT
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase bg-red-200 text-red-900 border border-red-700">
                        <AlertTriangle className="w-3 h-3" /> FAILED
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    {email.etherealPreviewUrl ? (
                      <a
                        href={email.etherealPreviewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#1F2736] text-[#F3ECE5] hover:bg-[#D63A35] transition-colors font-bold text-[11px] border-blueprint-sm"
                      >
                        <span>VIEW ETHEREAL INBOX</span>
                        <ExternalLink className="w-3.5 h-3.5 text-[#D63A35] hover:text-white" />
                      </a>
                    ) : email.errorMessage ? (
                      <span className="text-red-700 font-mono text-[11px] truncate max-w-xs block" title={email.errorMessage}>
                        Err: {email.errorMessage}
                      </span>
                    ) : (
                      <span className="text-[#798392]">No link captured</span>
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
