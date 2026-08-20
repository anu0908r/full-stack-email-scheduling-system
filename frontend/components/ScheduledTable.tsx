'use client';

import React from 'react';
import { EmailRecord } from '../services/api';
import { Clock, RefreshCw, Calendar, AlertCircle } from 'lucide-react';

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
    <div className="bg-[#F7F1EB] border-blueprint p-6 my-6">
      {/* Table Header Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 mb-4 border-b-4 border-[#1F2736]">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold font-serif-display text-[#1F2736]">
              SCHEDULED & QUEUED EMAILS
            </h3>
            <span className="bg-[#1F2736] text-white text-xs font-mono font-bold px-2 py-0.5">
              {emails.length} TOTAL QUEUED
            </span>
          </div>
          <p className="text-xs font-mono text-[#445166] mt-0.5">
            BullMQ delayed jobs persisted in Redis and PostgreSQL.
          </p>
        </div>

        <button
          onClick={onRefresh}
          className="px-4 py-2 bg-[#E8DDD3] text-[#1F2736] font-mono text-xs font-bold border-blueprint-interactive flex items-center gap-2 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          REFRESH QUEUE
        </button>
      </div>

      {/* Table Content */}
      {loading ? (
        <div className="py-16 text-center font-mono text-sm text-[#445166] flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-4 border-[#1F2736] border-t-transparent animate-spin" />
          <span>LOADING QUEUED JOBS FROM BACKEND...</span>
        </div>
      ) : emails.length === 0 ? (
        <div className="py-16 text-center bg-[#E8DDD3]/40 border-2 border-dashed border-[#1F2736] p-8">
          <Clock className="w-10 h-10 text-[#798392] mx-auto mb-3" />
          <h4 className="text-lg font-bold font-serif-display text-[#1F2736]">
            NO SCHEDULED EMAILS IN QUEUE
          </h4>
          <p className="text-xs font-mono text-[#445166] mt-1">
            Click "Compose New Email" above to upload a lead list and schedule jobs.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs border-collapse">
            <thead>
              <tr className="bg-[#1F2736] text-[#F3ECE5] uppercase tracking-wider">
                <th className="p-3 border-r border-[#445166]">RECIPIENT</th>
                <th className="p-3 border-r border-[#445166]">SUBJECT</th>
                <th className="p-3 border-r border-[#445166]">SCHEDULED EXECUTION</th>
                <th className="p-3 border-r border-[#445166]">SENDER</th>
                <th className="p-3">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-[#1F2736]">
              {emails.map((email) => {
                const date = new Date(email.scheduledAt);
                const isPast = date.getTime() <= Date.now();

                return (
                  <tr key={email.id} className="hover:bg-[#E8DDD3]/60 transition-colors">
                    <td className="p-3 font-bold text-[#1F2736] border-r-2 border-[#1F2736]">
                      {email.recipient}
                    </td>
                    <td className="p-3 text-[#1F2736] border-r-2 border-[#1F2736] max-w-xs truncate">
                      {email.subject}
                    </td>
                    <td className="p-3 text-[#445166] border-r-2 border-[#1F2736]">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-[#D63A35]" />
                        <span>{date.toLocaleString()}</span>
                        {isPast && (
                          <span className="text-[10px] bg-amber-200 text-amber-900 px-1 font-bold">
                            DUE NOW
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-[#445166] border-r-2 border-[#1F2736]">
                      {email.sender?.displayName || email.sender?.email || 'Primary Sender'}
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border border-[#1F2736] ${
                          email.status === 'PROCESSING'
                            ? 'bg-amber-400 text-[#1F2736] animate-pulse'
                            : 'bg-blue-200 text-blue-900'
                        }`}
                      >
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
