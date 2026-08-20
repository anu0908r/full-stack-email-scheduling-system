'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authService } from '../../../services/api';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      setStatus('error');
      setErrorMsg(searchParams.get('error_description') || 'Authorization was denied.');
      return;
    }

    if (!code) {
      setStatus('error');
      setErrorMsg('No authorization code received.');
      return;
    }

    const exchangeCode = async () => {
      try {
        const result = await authService.googleCallback({ code });
        localStorage.setItem('reachinbox_jwt_token', result.token);
        setStatus('success');
        setTimeout(() => router.push('/'), 1000);
      } catch (err: any) {
        setStatus('error');
        setErrorMsg(err.response?.data?.error || err.message || 'Authentication failed.');
      }
    };

    exchangeCode();
  }, [searchParams, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-drafting-grid flex items-center justify-center font-mono text-[#1F2736]">
        <div className="p-8 bg-[#F7F1EB] border-blueprint text-center max-w-sm">
          <div className="w-10 h-10 border-4 border-[#1F2736] border-t-transparent animate-spin mx-auto mb-4" />
          <p className="font-bold text-sm">EXCHANGING GOOGLE AUTHORIZATION...</p>
          <p className="text-xs text-[#445166] mt-2">Verifying OAuth code with Google servers</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-drafting-grid flex items-center justify-center font-mono text-[#1F2736]">
        <div className="p-8 bg-[#F7F1EB] border-blueprint text-center max-w-sm">
          <p className="font-bold text-sm text-[#D63A35] mb-2">AUTHENTICATION FAILED</p>
          <p className="text-xs text-[#445166] mb-4">{errorMsg}</p>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-[#1F2736] text-[#F3ECE5] font-mono text-xs font-bold border-blueprint-interactive cursor-pointer"
          >
            RETURN TO DASHBOARD
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-drafting-grid flex items-center justify-center font-mono text-[#1F2736]">
      <div className="p-8 bg-[#F7F1EB] border-blueprint text-center max-w-sm">
        <p className="font-bold text-sm text-emerald-700 mb-2">LOGIN SUCCESSFUL</p>
        <p className="text-xs text-[#445166]">Redirecting to dashboard...</p>
      </div>
    </div>
  );
}
