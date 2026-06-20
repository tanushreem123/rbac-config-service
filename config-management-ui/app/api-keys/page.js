'use client';
import { useState, useEffect } from 'react';
import Navbar from '../../components/Navbar';
import { isLoggedIn, getSessionUser } from '../../lib/auth';
import { listApiKeys, createApiKey, revokeApiKey } from '../../lib/ConfigService';

function timeAgo(dateStr) {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function ApiKeysPage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newKeyName, setNewKeyName] = useState('');
  const [generating, setGenerating] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState(null); // { id, secret, name }
  const [copied, setCopied] = useState(false);
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isLoggedIn()) { window.location.replace('/login'); return; }
    setAuthChecked(true);
  }, []);

  useEffect(() => { if (authChecked) load(); }, [authChecked]);

  const load = async () => {
    setLoading(true);
    setError('');
    try { setKeys(await listApiKeys()); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    setGenerating(true);
    setError('');
    try {
      const result = await createApiKey(newKeyName.trim());
      setRevealedSecret({ id: result.key.id, secret: result.secret, name: result.key.name });
      setNewKeyName('');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async (key) => {
    if (!window.confirm(`Revoke "${key.name}"? Apps using this key will lose access immediately.`)) return;
    try {
      await revokeApiKey(key.id);
      if (revealedSecret?.id === key.id) setRevealedSecret(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCopy = () => {
    if (!revealedSecret?.secret) return;
    navigator.clipboard.writeText(revealedSecret.secret).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const user = getSessionUser();

  if (!authChecked) return null;

  const activeKeys = keys.filter(k => !k.revoked_at);
  const revokedKeys = keys.filter(k => k.revoked_at);

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', minHeight: '100vh', background: '#f4f6f9' }}>
      <Navbar />
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 24px 48px' }}>

        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: '#1a1a2e' }}>API Keys</h1>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#888' }}>
            Use API keys to read configs from your backend without a user session.
          </p>
        </div>

        {error && <div style={{ padding: '12px 16px', background: '#ffebee', color: '#c62828', borderRadius: '6px', marginBottom: '20px', fontSize: '14px' }}>{error}</div>}

        {/* Revealed secret banner */}
        {revealedSecret && (
          <div style={{ background: '#1a1a2e', color: 'white', borderRadius: '10px', padding: '20px 24px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '4px' }}>Save your key now</div>
                <div style={{ fontSize: '13px', color: '#aaa' }}>This is the only time it will be shown. Copy it to a safe place.</div>
              </div>
              <button onClick={() => setRevealedSecret(null)}
                style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '20px', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <code style={{ flex: 1, background: '#0d0d1a', padding: '12px 16px', borderRadius: '6px', fontSize: '13px', fontFamily: 'monospace', wordBreak: 'break-all', color: '#7aff83', letterSpacing: '0.3px' }}>
                {revealedSecret.secret}
              </code>
              <button onClick={handleCopy}
                style={{ padding: '10px 16px', background: copied ? '#2e7d32' : '#007bff', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', whiteSpace: 'nowrap' }}>
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div style={{ marginTop: '16px', padding: '14px 16px', background: '#0d0d1a', borderRadius: '6px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Usage example</div>
              <code style={{ fontSize: '12px', fontFamily: 'monospace', color: '#aaa', whiteSpace: 'pre', display: 'block' }}>{`curl "${apiBaseUrl}/configs?env=prod" \\
  -H "Authorization: Bearer ${revealedSecret.secret}" \\
  -H "x-client-id: ${user?.client_id || '<your-client-id>'}"`}</code>
            </div>
          </div>
        )}

        {/* Generate new key */}
        <div style={{ background: 'white', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', padding: '24px', marginBottom: '24px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: '700', color: '#1a1a2e' }}>Generate New Key</h3>
          <form onSubmit={handleGenerate} style={{ display: 'flex', gap: '12px' }}>
            <input
              value={newKeyName}
              onChange={e => setNewKeyName(e.target.value)}
              required
              placeholder="Key name, e.g. Production Server"
              style={{ flex: 1, padding: '10px 14px', border: '1px solid #e0e0e0', borderRadius: '6px', fontSize: '14px', outline: 'none', background: '#fafafa' }}
            />
            <button type="submit" disabled={generating || !newKeyName.trim()}
              style={{ padding: '10px 20px', background: generating ? '#aaa' : '#1a1a2e', color: 'white', border: 'none', borderRadius: '6px', cursor: generating ? 'not-allowed' : 'pointer', fontWeight: '600', fontSize: '14px', whiteSpace: 'nowrap' }}>
              {generating ? 'Generating...' : 'Generate'}
            </button>
          </form>
        </div>

        {/* Active keys */}
        <div style={{ background: 'white', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden', marginBottom: '20px' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', background: '#f8f9fa' }}>
            <span style={{ fontWeight: '700', fontSize: '14px', color: '#1a1a2e' }}>Active Keys</span>
            <span style={{ marginLeft: '8px', fontSize: '12px', color: '#888' }}>({activeKeys.length})</span>
          </div>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#ccc', fontSize: '14px' }}>Loading...</div>
          ) : activeKeys.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#bbb', fontSize: '14px' }}>No active API keys. Generate one above.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <th style={th}>Name</th>
                  <th style={th}>Key Preview</th>
                  <th style={th}>Last Used</th>
                  <th style={th}>Created</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {activeKeys.map(k => (
                  <tr key={k.id} style={{ borderBottom: '1px solid #f8f8f8' }}>
                    <td style={{ ...td, fontWeight: '600', color: '#1a1a2e' }}>{k.name}</td>
                    <td style={{ ...td, fontFamily: 'monospace', color: '#666', fontSize: '12px' }}>{k.key_prefix}</td>
                    <td style={{ ...td, color: '#888', fontSize: '13px' }}>{timeAgo(k.last_used_at)}</td>
                    <td style={{ ...td, color: '#888', fontSize: '13px' }}>{timeAgo(k.created_at)}</td>
                    <td style={td}>
                      <button onClick={() => handleRevoke(k)}
                        style={{ padding: '5px 12px', background: 'transparent', color: '#d32f2f', border: '1px solid #d32f2f', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Revoked keys */}
        {revokedKeys.length > 0 && (
          <div style={{ background: 'white', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', background: '#f8f9fa' }}>
              <span style={{ fontWeight: '700', fontSize: '14px', color: '#999' }}>Revoked Keys</span>
              <span style={{ marginLeft: '8px', fontSize: '12px', color: '#ccc' }}>({revokedKeys.length})</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {revokedKeys.map(k => (
                  <tr key={k.id} style={{ borderBottom: '1px solid #f8f8f8', opacity: 0.5 }}>
                    <td style={{ ...td, fontWeight: '600', color: '#999' }}>{k.name}</td>
                    <td style={{ ...td, fontFamily: 'monospace', color: '#bbb', fontSize: '12px' }}>{k.key_prefix}</td>
                    <td style={{ ...td, color: '#bbb', fontSize: '13px' }}>Revoked {timeAgo(k.revoked_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const th = { padding: '11px 16px', textAlign: 'left', fontWeight: '600', fontSize: '12px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.4px' };
const td = { padding: '14px 16px', fontSize: '14px' };
