'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { resolveClientFromDomain, getDetectedClientId } from '../../lib/clientDetection';

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [clientReady, setClientReady] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('access_token')) {
      window.location.replace('/');
      return;
    }
    resolveClientFromDomain().then(() => setClientReady(true));
  }, []);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const clientId = getDetectedClientId();
      if (!clientId) throw new Error('Could not detect client for this domain. Contact your administrator.');
      const res = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, client_id: clientId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      setSuccess('Account created! Check your email to verify before logging in.');
      setForm({ name: '', email: '', password: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = { width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box' };
  const labelStyle = { display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '14px' };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ background: 'white', padding: '40px', borderRadius: '8px', boxShadow: '0 2px 12px rgba(0,0,0,0.1)', width: '100%', maxWidth: '400px' }}>
        <h1 style={{ margin: '0 0 8px', fontSize: '24px' }}>Create account</h1>
        <p style={{ margin: '0 0 32px', color: '#666', fontSize: '14px' }}>Register for RBAC Config Service</p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Name</label>
            <input type="text" value={form.name} onChange={set('name')} required placeholder="Your name" style={inputStyle} />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Email</label>
            <input type="email" value={form.email} onChange={set('email')} required placeholder="you@example.com" style={inputStyle} />
          </div>
          <div style={{ marginBottom: '24px' }}>
            <label style={labelStyle}>Password</label>
            <input type="password" value={form.password} onChange={set('password')} required placeholder="••••••••" style={inputStyle} />
          </div>

          {error && <div style={{ marginBottom: '16px', padding: '10px 12px', background: '#ffebee', color: '#c62828', borderRadius: '4px', fontSize: '14px' }}>{error}</div>}
          {success && <div style={{ marginBottom: '16px', padding: '10px 12px', background: '#e8f5e9', color: '#2e7d32', borderRadius: '4px', fontSize: '14px' }}>{success}</div>}

          <button type="submit" disabled={loading} style={{ width: '100%', padding: '11px', background: loading ? '#aaa' : '#007bff', color: 'white', border: 'none', borderRadius: '4px', fontSize: '15px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p style={{ marginTop: '24px', textAlign: 'center', fontSize: '14px', color: '#666' }}>
          Already have an account?{' '}
          <button onClick={() => router.push('/login')} style={{ background: 'none', border: 'none', color: '#007bff', cursor: 'pointer', fontSize: '14px', padding: 0 }}>Sign in</button>
        </p>
      </div>
    </div>
  );
}
