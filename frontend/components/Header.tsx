'use client';

import React from 'react';
import { UserProfile } from '../services/api';
import { LogOut, User as UserIcon, Shield, Mail, Sparkles } from 'lucide-react';

interface HeaderProps {
  user: UserProfile | null;
  onLogout: () => void;
  onOpenGoogleLogin: () => void;
  onDevLogin: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onLogout,
  onOpenGoogleLogin,
  onDevLogin,
}) => {
  return (
    <header className="w-full bg-[#F7F1EB] border-b-4 border-[#1F2736] px-6 py-4 sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand & System Identifier */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#D63A35] text-white flex items-center justify-center font-bold text-xl border-blueprint-sm">
            R
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold font-serif-display tracking-tight text-[#1F2736]">
                REACHINBOX
              </h1>
              <span className="bg-[#1F2736] text-[#F3ECE5] text-[10px] font-mono font-bold px-2 py-0.5 uppercase tracking-wider">
                v2.6 // PROD
              </span>
            </div>
            <p className="text-xs font-mono text-[#445166] uppercase tracking-widest">
              Distributed Email Scheduling & SMTP Engine
            </p>
          </div>
        </div>

        {/* User Identity & Auth State */}
        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3 bg-[#E8DDD3] p-1.5 pl-3 border-blueprint-sm rounded-none">
              <div className="flex flex-col text-right">
                <span className="text-sm font-bold font-mono text-[#1F2736] leading-tight">
                  {user.name}
                </span>
                <span className="text-xs font-mono text-[#445166]">
                  {user.email}
                </span>
              </div>

              {user.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-9 h-9 border-2 border-[#1F2736] bg-white object-cover"
                />
              ) : (
                <div className="w-9 h-9 border-2 border-[#1F2736] bg-[#D63A35] text-white flex items-center justify-center font-bold">
                  {user.name.charAt(0)}
                </div>
              )}

              <button
                onClick={onLogout}
                title="Logout"
                className="p-2 bg-[#1F2736] text-[#F3ECE5] hover:bg-[#D63A35] transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={onDevLogin}
                className="px-4 py-2 bg-[#E8DDD3] text-[#1F2736] font-mono font-bold text-xs border-blueprint-interactive flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-[#D63A35]" />
                QUICK DEV LOGIN
              </button>

              <button
                onClick={onOpenGoogleLogin}
                className="px-5 py-2 bg-[#D63A35] text-white font-mono font-bold text-xs border-blueprint-interactive flex items-center gap-2 cursor-pointer hover:bg-[#E86A65]"
              >
                <Shield className="w-4 h-4" />
                GOOGLE OAUTH SIGN IN
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
