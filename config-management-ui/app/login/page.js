'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { login, isLoggedIn, getClientId } from '../../lib/auth';
import { resolveClientFromDomain } from '../../lib/clientDetection';

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [unverified, setUnverified] = useState(false);
  const [resendStatus, setResendStatus] = useState(''); // '' | 'sending' | 'sent'

  useEffect(() => {
    if (typeof window !== 'undefined' && isLoggedIn()) {
      window.location.replace('/configs');
      return;
    }
    resolveClientFromDomain();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setUnverified(false);
    setResendStatus('');
    setLoading(true);
    try {
      // Domain is authoritative: you can only log in on a domain that maps to a client.
      const detected = await resolveClientFromDomain({ force: true });
      if (!detected) {
        setError(`No client is configured for this domain (${window.location.hostname}). Log in on a registered client domain.`);
        setLoading(false);
        return;
      }
      await login(email, password);
      router.push('/configs');
    } catch (err) {
      if (err.message?.toLowerCase().includes('verify')) {
        setUnverified(true);
      }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendStatus('sending');
    try {
      const clientId = getClientId();
      await fetch(`${BASE_URL}/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, client_id: clientId }),
      });
      setResendStatus('sent');
    } catch {
      setResendStatus('');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f6f9', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ background: 'white', padding: '44px 40px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', width: '100%', maxWidth: '400px' }}>

        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{ fontWeight: '800', fontSize: '18px', color: '#1a1a2e' }}>Authzy</span>
            <span style={{ fontSize: '10px', background: '#eef', color: '#6366f1', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>BETA</span>
          </div>
          <p style={{ margin: 0, color: '#888', fontSize: '14px' }}>Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              placeholder="you@company.com" style={inputStyle} />
          </div>
          <div style={{ marginBottom: '24px' }}>
            <label style={labelStyle}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              placeholder="••••••••" style={inputStyle} />
          </div>

          {error && (
            <div style={{ marginBottom: '16px', padding: '12px 14px', background: '#ffebee', color: '#c62828', borderRadius: '6px', fontSize: '14px' }}>
              {error}
              {unverified && (
                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #ffcdd2' }}>
                  {resendStatus === 'sent' ? (
                    <span style={{ color: '#2e7d32', fontWeight: '600' }}>Verification email sent — check your inbox.</span>
                  ) : (
                    <button type="button" onClick={handleResend} disabled={resendStatus === 'sending'}
                      style={{ background: 'none', border: 'none', color: '#c62828', cursor: 'pointer', fontSize: '13px', fontWeight: '600', textDecoration: 'underline', padding: 0 }}>
                      {resendStatus === 'sending' ? 'Sending…' : 'Resend verification email'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          <button type="submit" disabled={loading}
            style={{ width: '100%', padding: '12px', background: loading ? '#aaa' : '#1a1a2e', color: 'white', border: 'none', borderRadius: '6px', fontSize: '15px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p style={{ marginTop: '24px', textAlign: 'center', fontSize: '14px', color: '#888' }}>
          No account?{' '}
          <button onClick={() => router.push('/register')}
            style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', fontSize: '14px', fontWeight: '600', padding: 0 }}>
            Create one
          </button>
        </p>
      </div>
    </div>
  );
}

const labelStyle = { display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '13px', color: '#444' };
const inputStyle = { width: '100%', padding: '10px 12px', border: '1px solid #e0e0e0', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box', background: '#fafafa', outline: 'none' };
