'use client';
import { useState, useEffect } from 'react';
import Navbar from '../../components/Navbar';
import { listUsers, createUser, deleteUser, listRoles } from '../../lib/RbacService';
import { getClientId, isLoggedIn } from '../../lib/auth';
import { fetchMyPermissions, friendlyPermissionError } from '../../lib/permissions';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [authChecked, setAuthChecked] = useState(false);
  const [myPerms, setMyPerms] = useState(new Set());

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role_id: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isLoggedIn()) { window.location.replace('/login'); return; }
    setAuthChecked(true);
    fetchMyPermissions().then(setMyPerms);
  }, []);

  useEffect(() => {
    if (authChecked) load();
  }, [authChecked]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const clientId = getClientId();
      const [usersData, rolesData] = await Promise.all([
        listUsers(clientId),
        listRoles(clientId),
      ]);
      setUsers(usersData.users || usersData);
      setRoles(rolesData.roles || rolesData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      await createUser(form);
      setForm({ name: '', email: '', password: '', role_id: '' });
      setShowForm(false);
      await load();
    } catch (err) {
      setFormError(friendlyPermissionError(err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (user) => {
    if (!window.confirm(`Delete user ${user.email}? This cannot be undone.`)) return;
    try {
      await deleteUser(user.id);
      await load();
    } catch (err) {
      setError(friendlyPermissionError(err.message));
    }
  };

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  if (!authChecked) return null;

  const inp = { width: '100%', padding: '9px 11px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box' };

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', minHeight: '100vh', background: '#fafafa' }}>
      <Navbar />
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 20px 40px' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ margin: 0 }}>Users</h2>
          {myPerms.has('users:write') && (
            <button onClick={() => { setShowForm(!showForm); setFormError(''); }}
              style={{ padding: '9px 18px', background: showForm ? '#6c757d' : '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>
              {showForm ? 'Cancel' : '+ Add User'}
            </button>
          )}
        </div>

        {error && <div style={{ padding: '10px 14px', background: '#ffebee', color: '#c62828', borderRadius: '4px', marginBottom: '16px' }}>{error}</div>}

        {/* Create user form */}
        {showForm && (
          <form onSubmit={handleCreate} style={{ background: 'white', padding: '24px', borderRadius: '6px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '24px' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: '16px' }}>New User</h3>

            {formError && <div style={{ padding: '10px 12px', background: '#ffebee', color: '#c62828', borderRadius: '4px', marginBottom: '16px', fontSize: '14px' }}>{formError}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '13px' }}>Full Name *</label>
                <input value={form.name} onChange={set('name')} required placeholder="Jane Doe" style={inp} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '13px' }}>Email *</label>
                <input type="email" value={form.email} onChange={set('email')} required placeholder="jane@company.com" style={inp} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '13px' }}>Password *</label>
                <input type="password" value={form.password} onChange={set('password')} required placeholder="Min 8 characters" style={inp} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '13px' }}>Assign Role</label>
                <select value={form.role_id} onChange={set('role_id')} style={inp}>
                  <option value="">No role</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}{r.is_default ? ' (default)' : ''}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button type="submit" disabled={saving}
                style={{ padding: '9px 20px', background: saving ? '#aaa' : '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: '600' }}>
                {saving ? 'Creating...' : 'Create User'}
              </button>
              <span style={{ fontSize: '12px', color: '#888' }}>
                {form.role_id
                  ? roles.find(r => r.id === form.role_id)?.skip_email_verification
                    ? 'This role skips email verification — user can log in immediately.'
                    : 'A verification email will be sent before the user can log in.'
                  : 'Select a role to see verification requirement.'}
              </span>
            </div>
          </form>
        )}

        {/* Users table */}
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>Loading users...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '6px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <thead>
              <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #e0e0e0' }}>
                <th style={th}>Name</th>
                <th style={th}>Email</th>
                <th style={th}>Verified</th>
                <th style={th}>Active</th>
                <th style={th}>Roles</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: '#999' }}>No users yet. Click &quot;+ Add User&quot; to create one.</td></tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={td}>{u.name || '—'}</td>
                    <td style={td}>{u.email}</td>
                    <td style={td}>
                      <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '12px', background: u.is_email_verified ? '#e8f5e9' : '#fff3e0', color: u.is_email_verified ? '#2e7d32' : '#e65100' }}>
                        {u.is_email_verified ? 'Verified' : 'Pending'}
                      </span>
                    </td>
                    <td style={td}>
                      <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '12px', background: u.is_active ? '#e8f5e9' : '#ffebee', color: u.is_active ? '#2e7d32' : '#c62828' }}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={td}>
                      {u.roles?.filter(Boolean).length > 0
                        ? u.roles.filter(Boolean).map((r) => (
                            <span key={r} style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '12px', background: '#e3f2fd', color: '#1565c0', marginRight: '4px' }}>{r}</span>
                          ))
                        : <span style={{ color: '#999', fontSize: '13px' }}>No roles</span>}
                    </td>
                    <td style={td}>
                      {myPerms.has('users:delete') ? (
                        <button onClick={() => handleDelete(u)}
                          style={{ padding: '5px 12px', background: '#d32f2f', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>
                          Delete
                        </button>
                      ) : (
                        <span style={{ fontSize: '12px', color: '#bbb' }}>No access</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const th = { padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: '13px' };
const td = { padding: '12px 16px', fontSize: '14px' };
