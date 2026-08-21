'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (error) {
      setStatus('error');
      setErrorMsg(searchParams.get('error_description') || 'Authorization was denied.');
      return;
    }

    if (!token) {
      setStatus('error');
      setErrorMsg('No authentication token received.');
      return;
    }

    localStorage.setItem('reachinbox_jwt_token', token);
    setStatus('success');
    setTimeout(() => router.push('/'), 1000);
  }, [searchParams, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="card p-8 text-center max-w-sm animate-scale-in">
          <div className="spinner mx-auto mb-4" style={{ width: 32, height: 32, borderWidth: 3 }} />
          <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>Signing you in...</p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Verifying with Google</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="card p-8 text-center max-w-sm animate-scale-in">
          <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--danger)', marginBottom: 8 }}>Authentication Failed</p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>{errorMsg}</p>
          <button onClick={() => router.push('/')} className="btn-primary">Back to Login</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
      <div className="card p-8 text-center max-w-sm animate-scale-in">
        <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--success)', marginBottom: 8 }}>Login Successful</p>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Redirecting to dashboard...</p>
      </div>
    </div>
  );
}
