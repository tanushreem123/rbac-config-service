'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function VerifyContent() {
  const [status, setStatus] = useState('verifying');
  const [message, setMessage] = useState('');
  const params = useSearchParams();
  const router = useRouter();
  const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      setStatus('error');
      setMessage('No verification token found in the link.');
      return;
    }
    fetch(`${BASE_URL}/auth/verify?token=${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.message) { setStatus('success'); setMessage(data.message); }
        else { setStatus('error'); setMessage(data.error || 'Verification failed.'); }
      })
      .catch(() => { setStatus('error'); setMessage('Network error — please try again.'); });
  }, [params, BASE_URL]);

  const icon = status === 'verifying' ? '⏳' : status === 'success' ? '✅' : '❌';
  const color = status === 'success' ? '#2e7d32' : status === 'error' ? '#c62828' : '#555';
  const bg   = status === 'success' ? '#e8f5e9' : status === 'error' ? '#ffebee' : '#f5f5f5';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f6f9', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', padding: '48px 40px', maxWidth: '420px', width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>{icon}</div>
        <h1 style={{ margin: '0 0 8px', fontSize: '22px', fontWeight: '700', color: '#1a1a2e' }}>
          {status === 'verifying' ? 'Verifying…' : status === 'success' ? 'Email verified!' : 'Verification failed'}
        </h1>
        {message && (
          <div style={{ margin: '16px 0 24px', padding: '12px 16px', background: bg, color, borderRadius: '6px', fontSize: '14px' }}>
            {message}
          </div>
        )}
        {status === 'success' && (
          <button onClick={() => router.push('/login')}
            style={{ padding: '11px 28px', background: '#1a1a2e', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '15px', fontWeight: '600' }}>
            Sign in
          </button>
        )}
        {status === 'error' && (
          <button onClick={() => router.push('/login')}
            style={{ padding: '11px 28px', background: 'transparent', color: '#1a1a2e', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>
            Back to login
          </button>
        )}
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui' }}>Verifying…</div>}>
      <VerifyContent />
    </Suspense>
  );
}
