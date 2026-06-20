'use client';
import { useState, useEffect } from 'react';
import Navbar from '../../components/Navbar';
import { listPermissions, createPermission } from '../../lib/RbacService';
import { isLoggedIn } from '../../lib/auth';
import { friendlyPermissionError } from '../../lib/permissions';

const ACTION_STYLE = {
  delete: { background: '#ffebee', color: '#c62828' },
  write:  { background: '#fff3e0', color: '#e65100' },
  read:   { background: '#e8f5e9', color: '#2e7d32' },
};

function groupByResource(permissions) {
  const map = {};
  for (const p of permissions) {
    if (!map[p.resource]) map[p.resource] = [];
    map[p.resource].push(p);
  }
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
}

export default function PermissionsPage() {
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [authChecked, setAuthChecked] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ service: '', resource: '', action: 'read', description: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isLoggedIn()) { window.location.replace('/login'); return; }
    setAuthChecked(true);
  }, []);

  useEffect(() => {
    if (authChecked) load();
  }, [authChecked]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listPermissions();
      setPermissions(data.permissions || data);
    } catch (err) {
      setError(friendlyPermissionError(err.message));
    } finally {
      setLoading(false);
    }
  };

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await createPermission(form);
      setForm({ service: '', resource: '', action: 'read', description: '' });
      setShowForm(false);
      await load();
    } catch (err) {
      setError(friendlyPermissionError(err.message));
    } finally {
      setSaving(false);
    }
  };

  if (!authChecked) return null;

  const inputStyle = { width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box' };
  const grouped = groupByResource(permissions);

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', minHeight: '100vh', background: '#fafafa' }}>
      <Navbar />
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 20px 40px' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h2 style={{ margin: '0 0 4px' }}>Permissions</h2>
            {!loading && <span style={{ fontSize: '13px', color: '#999' }}>{permissions.length} permissions across {grouped.length} resources</span>}
          </div>
          <button onClick={() => setShowForm(!showForm)}
            style={{ padding: '9px 18px', background: showForm ? '#6c757d' : '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}>
            {showForm ? 'Cancel' : '+ New Permission'}
          </button>
        </div>

        {error && <div style={{ padding: '10px 14px', background: '#ffebee', color: '#c62828', borderRadius: '4px', marginBottom: '16px' }}>{error}</div>}

        {showForm && (
          <form onSubmit={handleCreate} style={{ background: 'white', padding: '24px', borderRadius: '6px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '24px' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: '16px' }}>New Permission</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '13px' }}>Service</label>
                <input value={form.service} onChange={set('service')} required placeholder="e.g. config" style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '13px' }}>Resource</label>
                <input value={form.resource} onChange={set('resource')} required placeholder="e.g. configs" style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '13px' }}>Action</label>
                <select value={form.action} onChange={set('action')} style={inputStyle}>
                  <option value="read">read</option>
                  <option value="write">write</option>
                  <option value="delete">delete</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '13px' }}>Description</label>
                <input value={form.description} onChange={set('description')} placeholder="Optional" style={inputStyle} />
              </div>
            </div>
            <button type="submit" disabled={saving}
              style={{ padding: '9px 20px', background: saving ? '#aaa' : '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: '600' }}>
              {saving ? 'Creating...' : 'Create'}
            </button>
          </form>
        )}

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>Loading permissions...</div>
        ) : permissions.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#999', background: 'white', borderRadius: '6px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            No permissions yet. Click &quot;+ New Permission&quot; to create one.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {grouped.map(([resource, perms]) => (
              <div key={resource} style={{ background: 'white', borderRadius: '6px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                {/* Resource header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 20px', background: '#f8f9fa', borderBottom: '1px solid #e9ecef' }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: '700', fontSize: '14px', color: '#1a1a2e' }}>{resource}</span>
                  <span style={{ fontSize: '12px', color: '#999', background: '#e9ecef', padding: '1px 7px', borderRadius: '10px' }}>{perms.length}</span>
                </div>

                {/* Permission rows */}
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    {perms
                      .sort((a, b) => ['read','write','delete'].indexOf(a.action) - ['read','write','delete'].indexOf(b.action))
                      .map((p, i) => (
                      <tr key={p.id} style={{ borderBottom: i < perms.length - 1 ? '1px solid #f5f5f5' : 'none' }}>
                        <td style={{ padding: '11px 20px', width: '90px' }}>
                          <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '600', ...(ACTION_STYLE[p.action] || ACTION_STYLE.read) }}>
                            {p.action}
                          </span>
                        </td>
                        <td style={{ padding: '11px 20px', fontSize: '14px', color: '#444' }}>
                          {p.description || <span style={{ color: '#bbb' }}>No description</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
